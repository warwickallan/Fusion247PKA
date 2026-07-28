// =====================================================================
// BUILD-015 AsdAIr — bot: inboundRouter.js
//
// THE ROUTER ROUTES. IT NEVER DECIDES.
//
// This module maps ONE inbound Telegram update onto ONE intent:
//   { action, shopRef, arg, responder, raw }
// and that is the whole job. It does not resolve a product, does not choose a
// substitute, does not decide whether the shop may proceed, does not write
// anything, and does not open a database connection. Larry's pipeline consumes
// the intent and performs the action; this file only says WHAT was asked and BY
// WHOM. Same discipline as services/hub/decision/telegramInbound.mjs, which is
// deliberately the smallest possible surface at the human-tap gate.
//
// ── IT DOES NOT POLL ─────────────────────────────────────────────────────────
// Telegram's long-poll method appears nowhere here, and must never appear.
// Exactly one consumer of the ShopperBot update stream exists — services/asdair/
// intake/ — and long-polling is destructive: an offset ACKS every update below
// it, so a second poller would race the receiver and the loser would silently
// lose the week's shopping list. This module is HANDED updates by whoever is
// already polling; it never reaches for them. noPolling.test.js scans this file
// for the poll-method identifier and fails if it is ever introduced (which is
// why this comment does not spell it either).
//
// ── FAIL CLOSED ON ANYTHING UNRECOGNISED ─────────────────────────────────────
// Every refusal is a structured `{ ok:false, reason }`. Nothing is guessed. A
// foreign callback (the hub's `decision:` protocol, say), an unknown action, an
// uncorrelated reply and a malformed payload are all refused with a distinct
// reason, so the caller can answer the tap with something honest rather than
// acting on a misread.
//
// PURE. No I/O, no clock, no randomness. `resolveQuestionByMessage` is INJECTED
// — the lookup itself lives with whoever owns the question state.
// =====================================================================

import { ACTIONS, CALLBACK_NAMESPACE, parseCallbackData } from './callbackProtocol.js';

/** The prefix an AsdAIr callback must carry. Anything else is not ours. */
export const ASDAIR_CALLBACK_PREFIX = `${CALLBACK_NAMESPACE}:`;

/** Every refusal reason this router can return. Frozen so callers can switch on them. */
export const REFUSALS = Object.freeze({
  NOT_AN_UPDATE: 'not a telegram update',
  NOT_ASDAIR: 'not an asdair update',
  BAD_CALLBACK: 'malformed asdair callback_data',
  NO_LOOKUP: 'reply received but no resolveQuestionByMessage lookup was injected',
  UNCORRELATED_REPLY: 'reply not correlated to a known asdair question',
  EMPTY_REPLY: 'reply carried no text',
});

/** PURE. Stable identity for whoever acted. Never a name, never a handle — the
 *  numeric Telegram id is the only non-spoofable part of an update. */
function responderOf(from) {
  return from && from.id !== undefined && from.id !== null ? `telegram:${from.id}` : 'telegram:unknown';
}

/**
 * PURE. Map an inbound Telegram update onto an AsdAIr intent.
 *
 * Two shapes are recognised, and only two:
 *
 *  1. A TAPPED BUTTON — `update.callback_query` whose `data` starts `asd:`.
 *     The action, shopRef and arg come straight off the wire via
 *     parseCallbackData, so the button that was rendered and the intent that
 *     comes back cannot disagree.
 *
 *  2. A TYPED REPLY TO A QUESTION CARD — `update.message` with text and a
 *     `reply_to_message`. Correlation works exactly as telegramInbound.mjs does
 *     it: the (chatId, messageId) of the message being replied to is handed to
 *     the injected `resolveQuestionByMessage`, which returns the question that
 *     card asked (or null). The reply TEXT is passed through untouched in
 *     `raw.text` — matching it against the candidates is a decision, and
 *     decisions are not this module's job.
 *
 * @param {object} update a Telegram Update object
 * @param {{resolveQuestionByMessage?: (chatId:any, messageId:any) =>
 *          (null|string|{questionKey:string, shopRef?:string})}} [deps]
 * @returns {{ok:true, action:string, shopRef:string|null, arg:string|null,
 *            responder:string, raw:object}|{ok:false, reason:string}}
 */
export function routeAsdairUpdate(update, { resolveQuestionByMessage } = {}) {
  if (!update || typeof update !== 'object') return { ok: false, reason: REFUSALS.NOT_AN_UPDATE };

  // ── 1. Tapped inline button ────────────────────────────────────────────────
  const cq = update.callback_query;
  if (cq && typeof cq === 'object') {
    const data = typeof cq.data === 'string' ? cq.data : '';
    if (!data.startsWith(ASDAIR_CALLBACK_PREFIX)) {
      // Explicitly NOT ours — e.g. the hub's `decision:` cards share the phone
      // but not this protocol. Refusing by namespace keeps the two disjoint.
      return { ok: false, reason: REFUSALS.NOT_ASDAIR };
    }
    const parsed = parseCallbackData(data);
    if (!parsed.ok) return { ok: false, reason: parsed.reason || REFUSALS.BAD_CALLBACK };
    const msg = cq.message || {};
    return {
      ok: true,
      action: parsed.action,
      shopRef: parsed.shopRef,
      arg: parsed.arg,
      responder: responderOf(cq.from),
      raw: {
        kind: 'callback',
        callbackQueryId: cq.id !== undefined ? cq.id : null,
        chatId: msg.chat && msg.chat.id !== undefined ? msg.chat.id : null,
        messageId: msg.message_id !== undefined ? msg.message_id : null,
        data,
        text: null,
      },
    };
  }

  // ── 2. Typed reply to a question card ──────────────────────────────────────
  const msg = update.message;
  if (msg && typeof msg === 'object' && msg.reply_to_message && typeof msg.reply_to_message === 'object') {
    if (typeof resolveQuestionByMessage !== 'function') return { ok: false, reason: REFUSALS.NO_LOOKUP };
    const chatId = msg.chat && msg.chat.id !== undefined ? msg.chat.id : null;
    const repliedTo = msg.reply_to_message.message_id;
    const hit = resolveQuestionByMessage(chatId, repliedTo);
    if (!hit) return { ok: false, reason: REFUSALS.UNCORRELATED_REPLY };

    // The lookup may answer with a bare questionKey or with {questionKey, shopRef}.
    const questionKey = typeof hit === 'string' ? hit : (hit && hit.questionKey);
    const shopRef = typeof hit === 'string' ? null : (hit && hit.shopRef) || null;
    if (!questionKey) return { ok: false, reason: REFUSALS.UNCORRELATED_REPLY };

    // Text is required and passed through VERBATIM. Trimming only — no parsing,
    // no candidate matching, no normalisation that could change what was meant.
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    if (!text) return { ok: false, reason: REFUSALS.EMPTY_REPLY };

    return {
      ok: true,
      action: ACTIONS.ANSWER,
      shopRef,
      // For a typed reply the arg is the QUESTION, not a candidate index: which
      // candidate (if any) the text means is a decision, made downstream.
      arg: questionKey,
      responder: responderOf(msg.from),
      raw: {
        kind: 'reply',
        callbackQueryId: null,
        chatId,
        messageId: msg.message_id !== undefined ? msg.message_id : null,
        replyToMessageId: repliedTo !== undefined ? repliedTo : null,
        data: null,
        text,
      },
    };
  }

  return { ok: false, reason: REFUSALS.NOT_ASDAIR };
}

export default routeAsdairUpdate;
