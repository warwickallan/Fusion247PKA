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
  // WP-B15-A1. A plain typed message that answered no open question. NOT an
  // error and NOT a defect: it is the ordinary case for a new shopping list, and
  // the caller deliberately leaves such a message to intake instead of claiming
  // it. Distinct from UNCORRELATED_REPLY, which means a reply pointed at a card
  // we no longer recognise - that one really is a miss.
  UNCORRELATED_TEXT: 'typed message did not answer any open question',
});

/** PURE. Stable identity for whoever acted. Never a name, never a handle — the
 *  numeric Telegram id is the only non-spoofable part of an update. */
function responderOf(from) {
  return from && from.id !== undefined && from.id !== null ? `telegram:${from.id}` : 'telegram:unknown';
}

/**
 * PURE. Map an inbound Telegram update onto an AsdAIr intent.
 *
 * Three shapes are recognised, and only three (the third added by WP-B15-A1):
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
 *  3. A PLAIN TYPED MESSAGE - `update.message` with text and NO
 *     `reply_to_message`. There is nothing on the wire to correlate on, so the
 *     injected `resolveAnswersByText` is asked which open question(s) the words
 *     answer. It returns already-resolved mappings or nothing; the router makes
 *     no correlation decision of its own, and a message that maps to nothing is
 *     refused as UNCORRELATED_TEXT so it can go on to intake as a list.
 *
 * @param {object} update a Telegram Update object
 * @param {{resolveQuestionByMessage?: (chatId:any, messageId:any) =>
 *          (null|string|{questionKey:string, shopRef?:string}),
 *          resolveAnswersByText?: (text:string) =>
 *          (null|{mappings:{questionKey:string, shopRef?:string, answerText?:string}[]})}} [deps]
 * @returns {{ok:true, action:string, shopRef:string|null, arg:string|null,
 *            responder:string, raw:object}|{ok:false, reason:string}}
 */
export function routeAsdairUpdate(update, { resolveQuestionByMessage, resolveAnswersByText } = {}) {
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
    // ── A REPLY TO THE BOARD IS NOT A REPLY TO A QUESTION CARD (WP-B15-09) ──
    //
    // The board is ONE card carrying every outstanding question, so there is no
    // per-question (chat, message) for the lookup below to hit: it is not a
    // question card and `getQuestionByCard` correctly finds nothing. Before this
    // fall-through that produced UNCORRELATED_REPLY, the claim declined, intake
    // took the message, and his answer became next week's shopping list - the
    // M76/M77/M79/M82 defect arriving through a new door.
    //
    // THE DIRECTION OF THE FALL-THROUGH IS WHAT MAKES IT SAFE. The free-text
    // branch below refuses anything it cannot ground, so a genuine new list that
    // happens to be a reply still reaches intake exactly as before. The card
    // lookup keeps PRECEDENCE, so a reply to a real question card is unchanged.
    const cardLookup = typeof resolveQuestionByMessage === 'function';
    const textLookup = typeof resolveAnswersByText === 'function';
    if (!cardLookup && !textLookup) return { ok: false, reason: REFUSALS.NO_LOOKUP };
    const chatId = msg.chat && msg.chat.id !== undefined ? msg.chat.id : null;
    const repliedTo = msg.reply_to_message.message_id;
    const hit = cardLookup ? resolveQuestionByMessage(chatId, repliedTo) : null;
    if (!hit) {
      if (!textLookup) return { ok: false, reason: REFUSALS.UNCORRELATED_REPLY };
      return routeTypedText(msg, resolveAnswersByText, REFUSALS.UNCORRELATED_REPLY);
    }

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

  // ── 3. A PLAIN TYPED MESSAGE (WP-B15-A1) ───────────────────────────────────
  //
  // Warwick: "I dont have a bloody card I can type an answer... I don't want to
  // be pressing buttons." Until this branch existed, a typed answer only counted
  // if he first long-pressed the right card and used reply-to. Everything else
  // fell out of the bottom of this function as NOT_ASDAIR and was never seen
  // again - which is exactly what happened to question 76463.
  //
  // ── CORRELATION IS INJECTED, ALREADY RESOLVED ──────────────────────────────
  // `resolveAnswersByText` is a SYNC closure the caller has already filled in.
  // Working out which open question a sentence belongs to needs the database and
  // may need a model call; this module is PURE and stays pure, exactly as it does
  // for `resolveQuestionByMessage`. The router asks "whose is this?" and is told;
  // it never goes and looks.
  //
  // ── WITHOUT THE LOOKUP, BEHAVIOUR IS UNCHANGED ─────────────────────────────
  // No lookup injected means no correlation is possible, so the message is not
  // ours and falls through to NOT_ASDAIR precisely as before. A caller that
  // wires nothing keeps today's behaviour.
  if (msg && typeof msg === 'object' && typeof resolveAnswersByText === 'function') {
    const routed = routeTypedText(msg, resolveAnswersByText, REFUSALS.NOT_ASDAIR);
    if (routed) return routed;
  }

  return { ok: false, reason: REFUSALS.NOT_ASDAIR };
}

/**
 * PURE. The free-text half, shared by branches 2 and 3.
 *
 * Extracted verbatim by WP-B15-09 so a reply whose card cannot be identified -
 * a reply to THE BOARD, above all - takes exactly the same grounded path as a
 * plain typed message, rather than a second implementation of it that could
 * drift. `emptyReason` is what a message with no usable text refuses as, which
 * differs by branch and is the only thing the two callers disagree about.
 *
 * Returns an intent, or a structured refusal. Never null for a caller that
 * supplied a lookup.
 */
function routeTypedText(msg, resolveAnswersByText, emptyReason) {
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (!text) return { ok: false, reason: emptyReason };

  const hit = resolveAnswersByText(text);
  const mappings = hit && Array.isArray(hit.mappings) ? hit.mappings.filter(
    (m) => m && typeof m.questionKey === 'string' && m.questionKey !== '',
  ) : [];

  // NOT CORRELATED IS NOT A FAILURE. A genuine new shopping list lands here
  // every week, and claiming it would be the defect - so it is refused with
  // its own reason and the caller lets intake have it.
  if (mappings.length === 0) return { ok: false, reason: REFUSALS.UNCORRELATED_TEXT };

  return {
    ok: true,
    action: ACTIONS.ANSWER,
    // One message may settle SEVERAL questions. `shopRef`/`arg` name the
    // first for callers that read one intent; `raw.mappings` carries all of
    // them, and the adapter turns each into its own answerQuestion command.
    // Per-mapping is what makes partial success possible: two clear answers
    // land durably even when a third fragment cannot be placed.
    shopRef: mappings[0].shopRef || null,
    arg: mappings[0].questionKey,
    responder: responderOf(msg.from),
    raw: {
      kind: 'text',
      callbackQueryId: null,
      chatId: msg.chat && msg.chat.id !== undefined ? msg.chat.id : null,
      messageId: msg.message_id !== undefined ? msg.message_id : null,
      data: null,
      // VERBATIM, exactly as the reply branch above. Which product the words
      // mean is a decision, and it is not made here.
      text,
      mappings: mappings.map((m) => ({
        questionKey: m.questionKey,
        shopRef: m.shopRef || null,
        answerText: typeof m.answerText === 'string' && m.answerText.trim() !== ''
          ? m.answerText.trim() : text,
      })),
    },
  };
}

export default routeAsdairUpdate;
