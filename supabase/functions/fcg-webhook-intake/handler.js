// BUILD-002 WP1 — PURE webhook intake handler (portable: Deno edge + Node test).
//
// Design of record: Builds/BUILD-002-unified-personal-capture-gateway/
//   Architecture/wp1-architecture-decision.md (§0–§4) — Silas's factoring:
//   the Deno index.ts is a THIN shell; ALL decision logic lives here so the
//   identical code is unit-tested under `node --test` (no Deno runtime needed)
//   and deployed unchanged under Deno.
//
// The handler does five things and nothing else (Pax Q1 bottom line):
//   1. Reject non-POST (405).
//   2. Constant-time secret-token compare → 401, NO DB touch, NO BODY READ, NO
//      detail leak. The body is consumed LAZILY (see readBody below) so an
//      unauthenticated POST never forces the function to buffer an arbitrary
//      request body before the auth gate runs (Vex L-3).
//   3. Parse the update; malformed / unknown kind → 200 {ignored} (never a
//      retry-spam loop on garbage).
//   4. ONE RPC call per update (fcg_webhook_intake / fcg_webhook_confirm_tap /
//      fcg_webhook_card_ref via the injected `rpc`).
//   5. Send/edit the Telegram card via the injected `telegram`, fast 200.
//      A failed card send after a NEW durable intake returns 500 so Telegram's
//      own retry queue becomes the card-delivery retry loop (architecture §2).
//
// SECRET HYGIENE: this module never sees the bot token (the injected `telegram`
// client holds it) and never logs or echoes `secret`. Every `log` line is
// structured and secret-free by construction; test U13 sweeps every path with
// canary secrets and asserts absence.
//
// REQUEST SHAPE (from the shell):
//   method   → string
//   headers  → header map
//   readBody → () => Promise<string>  LAZY body reader. The pure handler invokes
//              it ONLY after the auth gate passes, so an unauthenticated request
//              never buffers/parses a body (Vex L-3). The Deno shell passes
//              `readBody: () => req.text()`. A `bodyText: string` field is still
//              honoured as a compat fallback for the unit suite; the deployed
//              shell always uses the lazy reader.
//
// DEPENDENCY SHAPE (injected — the handler is pure):
//   rpc(fnName, args)                → Promise<jsonb result>   (throws on failure)
//   telegram.sendMessage(payload)    → Promise<{ result: { message_id } }>
//   telegram.editMessageText(payload)→ Promise<any>
//   telegram.answerCallbackQuery(payload) → Promise<any>
//   secret                           → the configured webhook secret token
//   log(event)                       → void (structured, secret-free)

import { deriveTelegramTextKeys } from './derive.js';
import { isPrivateDirectChat } from './chatBoundary.js';

// ── Card copy — MUST stay verbatim-identical to receiptProjection.js wording
// (statusLineFor `accepted` and the queued/offline family). SSOT is enforced by
// test (webhookHandler.test.js asserts these equal the projection's output for
// the corresponding states) rather than by import, so the deployed edge bundle
// stays self-contained.
export const PENDING_CARD_TEXT = 'Received — safe and saved. Tap "Save to Brain" to write it to your Brain.';
export const WAITING_CARD_TEXT = 'Saved and safe — waiting to be written to your Brain.';

// Same inline keyboard the WP0 adapters offer (telegramLiveAdapter ACTION_BUTTONS).
export const ACTION_KEYBOARD = Object.freeze({
  inline_keyboard: [[
    { text: 'Save to Brain', callback_data: 'SaveToBrain' },
    { text: 'Ask Larry', callback_data: 'AskLarry' },
    { text: 'Keep Raw', callback_data: 'KeepRaw' },
  ]],
});

// Callback answers — wording parity with liveRunner.handleCallback.
const ANSWER_SAVING = 'Saving to your Brain…';
const ANSWER_ALREADY_COMPLETED = 'Already saved to your Brain.';
const ANSWER_IN_PROGRESS = 'Already in progress — nothing to do.';
const ANSWER_NOT_FOUND = 'No capture found for this card.';
const ANSWER_UNAVAILABLE = 'Not available in WP0 — your capture stays pending.';

const CHANNEL = 'telegram';
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

const encoder = new TextEncoder();

/**
 * Constant-time string comparison, portable (WebCrypto only). Both inputs are
 * SHA-256 hashed first so the XOR loop runs over fixed-length digests — the
 * comparison cost is independent of both content and length, and a length
 * mismatch is not observable as an early return.
 */
export async function timingSafeEqualStrings(a, b) {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b))),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i += 1) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function headerLookup(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === name) return v;
  }
  return undefined;
}

const ok = (body) => ({ status: 200, body: { ok: true, ...body } });
const ignored = (reason) => ({ status: 200, body: { ok: true, ignored: true, reason } });

/**
 * Redact the ONE secret this handler knows (the webhook secret token) from any
 * error text before it reaches a log line. The bot token never enters this
 * module (the telegram client holds it and masks its own errors); defence in
 * depth for rpc/telegram error strings that might echo request material.
 */
function maskErr(err, secret) {
  let msg = err && err.message ? err.message : String(err);
  if (typeof secret === 'string' && secret.length > 0) {
    msg = msg.split(secret).join('***redacted***');
  }
  return msg;
}

/**
 * Send the pending card + persist its durable target via fcg_webhook_card_ref.
 * Used for both the fresh `new` outcome and duplicate/existing reconciliation.
 * Throws on failure — the CALLER maps that to a 500 so Telegram redelivers
 * (architecture §2: Telegram's retry queue is the card-delivery retry loop).
 */
async function sendCardAndPersistRef({ telegram, rpc, log }, { chatId, captureId }) {
  const sent = await telegram.sendMessage({
    chat_id: chatId,
    text: PENDING_CARD_TEXT,
    reply_markup: ACTION_KEYBOARD,
  });
  const messageId = sent && sent.result ? sent.result.message_id : undefined;
  if (messageId === undefined) {
    throw new Error('sendMessage returned no message_id');
  }
  const refRes = await rpc('fcg_webhook_card_ref', {
    p_capture_id: captureId,
    p_chat_id: String(chatId),
    p_message_id: String(messageId),
  });
  log({ event: 'card_sent', capture_id: captureId, outcome: refRes && refRes.outcome });
  return messageId;
}

async function handleMessage(update, deps) {
  const { rpc, log } = deps;
  const msg = update.message;
  const from = msg.from;
  const senderId = from && from.id !== undefined ? String(from.id) : undefined;
  if (senderId === undefined || update.update_id === undefined) {
    return ignored('malformed_message');
  }

  // WP1 boundary: text only (exactly like the WP0 poll path's
  // unsupported_content_type rejection — no envelope, no rows). The webhook
  // path stays SILENT for non-text (no "text only" notice): the allowlist
  // lives in the DB, and messaging an unverified sender would leak the bot's
  // existence to strangers. The pending capture never exists, so nothing is
  // lost; the poll path still answers the notice when the Yoga is awake.
  const text = typeof msg.text === 'string' ? msg.text : '';
  if (text.trim().length === 0) {
    log({ event: 'unsupported_content_ignored', update_id: update.update_id });
    return ignored('unsupported_content_type');
  }

  // PRIVATE-DIRECT-CHAT BOUNDARY (correction 3). This BUILD serves Warwick's DM
  // only. A group / supergroup / channel / missing-or-malformed chat context is
  // refused HERE — before any derivation, RPC, card, or durable row — with the
  // same QUIET default-deny posture as an unauthorised sender (200, no reply, no
  // oracle). The shared predicate is the SINGLE source the poll path uses too.
  if (!isPrivateDirectChat({ chat: msg.chat, senderId })) {
    log({ event: 'non_private_chat_ignored', update_id: update.update_id });
    return ignored('non_private_chat');
  }

  const chat = msg.chat; // predicate guarantees an object with id === senderId
  const chatId = String(chat.id);

  // Byte-parity derivation (the cross-transport dedup guarantee).
  const { idempotencyKey, captureId } = await deriveTelegramTextKeys({
    senderId,
    messageId: msg.message_id,
    text,
  });

  // ONE intake RPC. Throws → 500 (Telegram holds + redelivers; nothing lost).
  const res = await rpc('fcg_webhook_intake', {
    p_channel: CHANNEL,
    p_update_id: update.update_id,
    p_sender_principal: senderId,
    p_idempotency_key: idempotencyKey,
    p_capture_id: captureId,
    p_recorded_intent: 'SaveToBrain',
    p_technical_source_type: 'text',
    p_payload_text: text,
    p_text_preview: text.slice(0, 280),
    p_channel_context: { chat_id: senderId, message_id: msg.message_id },
    p_captured_at: typeof msg.date === 'number'
      ? new Date(msg.date * 1000).toISOString()
      : null,
  });
  const outcome = res && res.outcome;

  if (outcome === 'unauthorised' || outcome === 'rate_limited') {
    // Fail-closed + no retry-spam: 200, no card, secret-free counter only.
    log({ event: `intake_${outcome}`, update_id: update.update_id });
    return ok({ outcome });
  }

  if (outcome === 'new') {
    // Durably committed at `accepted` (tap-gate hold). Card send/persist
    // failure → 500 WITHOUT a consumed success; redelivery reconciles.
    await sendCardAndPersistRef(deps, { chatId, captureId: res.capture_id });
    return ok({ outcome });
  }

  if (outcome === 'duplicate' || outcome === 'existing') {
    if (res.capture_id && res.has_card_ref !== true) {
      // Reconciliation: the earlier attempt committed the capture but the card
      // never landed (or its card_ref persist failed). Re-send now.
      await sendCardAndPersistRef(deps, { chatId, captureId: res.capture_id });
    } else if (!res.capture_id) {
      // Ledger row with no capture: the capture was ERASED after commit
      // (0002/0006 SET NULL semantics). Nothing to reconcile — honour erasure.
      log({ event: 'duplicate_of_erased_capture', update_id: update.update_id });
    }
    return ok({ outcome });
  }

  log({ event: 'intake_unexpected_outcome', update_id: update.update_id, outcome });
  return ok({ outcome });
}

async function handleCallback(update, deps) {
  const { rpc, telegram, log } = deps;
  const cq = update.callback_query;
  const from = cq.from;
  const senderId = from && from.id !== undefined ? String(from.id) : undefined;
  const msg = cq.message && typeof cq.message === 'object' ? cq.message : {};
  const chat = msg.chat && typeof msg.chat === 'object' ? msg.chat : {};
  const chatId = chat.id !== undefined ? String(chat.id) : senderId;
  const messageId = msg.message_id;

  if (senderId === undefined || update.update_id === undefined || messageId === undefined) {
    return ignored('malformed_callback');
  }

  // PRIVATE-DIRECT-CHAT BOUNDARY (correction 3) — the callback's card message
  // must live in the authorised user's own private chat. A tap arriving on a
  // card in a group / supergroup / channel (or a malformed chat) is refused
  // QUIETLY: no answer, no edit, no RPC, zero rows. Same shared predicate as the
  // message path and the poll path.
  if (!isPrivateDirectChat({ chat: msg.chat, senderId })) {
    log({ event: 'non_private_chat_callback_ignored', update_id: update.update_id });
    return ignored('non_private_chat');
  }

  // ONE confirm RPC — the cloud twin of confirmedByTap. Throws → 500.
  const res = await rpc('fcg_webhook_confirm_tap', {
    p_channel: CHANNEL,
    p_update_id: update.update_id,
    p_sender_principal: senderId,
    p_chat_id: String(chatId),
    p_message_id: String(messageId),
    p_action: typeof cq.data === 'string' ? cq.data : null,
  });
  const outcome = res && res.outcome;

  if (outcome === 'unauthorised') {
    // Default-deny silence: no answer, no card, no oracle for strangers.
    log({ event: 'tap_unauthorised', update_id: update.update_id });
    return ok({ outcome });
  }

  // From here the durable state decision is COMMITTED. Card answers/edits are
  // RETRYABLE PROJECTIONS (worker.js precedent): a projection failure must not
  // 500 — a 500 would redeliver a callback whose transition already consumed
  // its ledger slot (duplicate_update), retrying nothing. Swallow + log; the
  // waking worker's completion edit is the durable card reconciler.
  const answer = async (text, showAlert = false) => {
    try {
      await telegram.answerCallbackQuery({
        callback_query_id: cq.id,
        text,
        ...(showAlert ? { show_alert: true } : {}),
      });
    } catch (err) {
      log({ event: 'answer_callback_failed', update_id: update.update_id, error: maskErr(err, deps.secret) });
    }
  };

  if (outcome === 'queued') {
    await answer(ANSWER_SAVING);
    try {
      await telegram.editMessageText({
        chat_id: String(chatId),
        message_id: messageId,
        text: WAITING_CARD_TEXT,
        reply_markup: ACTION_KEYBOARD,
      });
    } catch (err) {
      log({ event: 'waiting_card_edit_failed', update_id: update.update_id, error: maskErr(err, deps.secret) });
    }
    return ok({ outcome });
  }

  if (outcome === 'already_completed') {
    await answer(ANSWER_ALREADY_COMPLETED);
    return ok({ outcome });
  }
  if (outcome === 'no_op' || outcome === 'duplicate_update') {
    await answer(ANSWER_IN_PROGRESS);
    return ok({ outcome });
  }
  if (outcome === 'not_found') {
    await answer(ANSWER_NOT_FOUND);
    return ok({ outcome });
  }
  if (outcome === 'unavailable_action') {
    // Must-see pop-up (live phone finding 2026-07-17: plain toasts are invisible).
    await answer(ANSWER_UNAVAILABLE, true);
    return ok({ outcome });
  }

  log({ event: 'tap_unexpected_outcome', update_id: update.update_id, outcome });
  return ok({ outcome });
}

/**
 * The pure handler. Same code under Deno (index.ts shell) and Node (unit
 * suite). Returns { status, body } — the shell serialises it.
 *
 * @param {object} request  { method, headers, readBody?: () => Promise<string>,
 *                            bodyText?: string }
 * @param {object} deps     { rpc, telegram, secret, log }
 */
export async function handleTelegramWebhook(request, deps) {
  const { method, headers } = request ?? {};
  const log = (deps && typeof deps.log === 'function') ? deps.log : () => {};
  const fullDeps = { ...deps, log };

  // 1. Method gate — before anything else, including the secret compare.
  if (method !== 'POST') {
    return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
  }

  // 2. Constant-time secret-token gate. Missing/empty configured secret is a
  //    DEPLOYMENT fault → fail closed (401 for everyone; never an open door).
  //    NO BODY IS READ before this gate passes (Vex L-3): an unauthenticated
  //    request cannot make the function buffer/parse an arbitrary body, touch
  //    the DB, send a card, or write anything durable.
  const provided = headerLookup(headers, SECRET_HEADER);
  const configured = fullDeps.secret;
  const authed = typeof configured === 'string' && configured.length > 0
    && typeof provided === 'string' && provided.length > 0
    && await timingSafeEqualStrings(provided, configured);
  if (!authed) {
    log({ event: 'webhook_auth_rejected' }); // deliberately detail-free
    return { status: 401, body: { ok: false, error: 'unauthorized' } };
  }

  // 3. AUTH HAS PASSED — only now consume the body. Lazy reader is preferred
  //    (the deployed shell passes `readBody: () => req.text()`); `bodyText` is a
  //    compat fallback for the unit suite. A body-read failure on an authed
  //    request is transient → 500 so Telegram redelivers (nothing lost).
  let bodyText;
  try {
    bodyText = typeof request?.readBody === 'function'
      ? await request.readBody()
      : request?.bodyText;
  } catch (err) {
    log({ event: 'webhook_body_read_failed', error: maskErr(err, fullDeps.secret) });
    return { status: 500, body: { ok: false, error: 'processing_failed' } };
  }

  // Parse. Garbage gets a 200 so Telegram never retry-spams it.
  let update;
  try {
    update = JSON.parse(bodyText);
  } catch {
    log({ event: 'malformed_body_ignored' });
    return ignored('malformed_json');
  }
  if (!update || typeof update !== 'object') return ignored('malformed_json');

  // 4./5. Route by update kind. Unknown kinds are ignored WITHOUT an RPC —
  //       WP1 decision: don't ledger noise (test plan U4).
  try {
    if (update.message && typeof update.message === 'object') {
      return await handleMessage(update, fullDeps);
    }
    if (update.callback_query && typeof update.callback_query === 'object') {
      return await handleCallback(update, fullDeps);
    }
    log({ event: 'unknown_update_kind_ignored' });
    return ignored('unknown_update_kind');
  } catch (err) {
    // RPC/DB down, card send failed after a new intake, etc. → 500 so Telegram
    // holds the update and redelivers: the at-least-once lever. Secret-free.
    log({ event: 'webhook_processing_failed', error: maskErr(err, fullDeps.secret) });
    return { status: 500, body: { ok: false, error: 'processing_failed' } };
  }
}
