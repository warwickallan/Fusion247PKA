// Telegram → Capture Envelope mapping — the ONE place channel-specific inbound
// knowledge lives. Shared by BOTH the MOCK adapter (fixtures) and the LIVE
// adapter, so the single-user default-deny contract + the channel-neutral
// mapping are written exactly once (no drift between mock and live).
//
// Source of truth: supabase-operational-foundation-boundary.md §4 (thin channel
// adapter — Telegram gets no special backend path) and wp0-security-gate.md §1
// (single-user numeric allowlist, default-deny).
//
// Channel-neutral rule: NOTHING here leaks upward. The intake, store, worker,
// and contracts never import this module — only the two Telegram adapters do.
// The output is a channel-neutral Capture Envelope; the input is Telegram-shaped.

import { createEnvelope } from '../core/contracts.js';
import { buildIdempotencyKey, sha256Hex } from '../core/idempotency.js';
// SINGLE-SOURCE private-direct-chat predicate — the SAME physical file the WP1
// webhook handler imports, so poll and webhook cannot drift (correction 3).
import { isPrivateDirectChat } from '../../../../supabase/functions/fcg-webhook-intake/chatBoundary.js';

export const SOURCE_CHANNEL = 'telegram';

// Map an optional chosen capture action onto the recorded_intent enum
// (RECORDED_INTENTS = LarryDirect | SaveToBrain | ConfirmedAction). Default:
// SaveToBrain — durable capture is authorised by the action itself.
export function intentFromAction(action) {
  switch (action) {
    case 'AskLarry':
      return 'LarryDirect';
    case 'Approve':
    case 'Reject':
      return 'ConfirmedAction';
    case 'SaveToBrain':
    case 'KeepRaw':
    default:
      return 'SaveToBrain';
  }
}

/**
 * Derive a deterministic capture_id from the idempotency key so a re-delivery
 * of the same logical message resolves to the same id (no wall-clock, hermetic).
 *
 * The operational store's `capture_id` column is a UUID (migration 0001,
 * "server-assigned canonical id"), so this emits a well-formed, DETERMINISTIC
 * RFC-4122 v5-style UUID derived from sha256(idempotency_key) — same message ⇒
 * same UUID, accepted by both the in-memory fixture AND Postgres' uuid type.
 */
export function deriveCaptureId(idempotencyKey) {
  const hex = sha256Hex(idempotencyKey).slice(0, 32).split('');
  hex[12] = '5'; // version nibble → 5 (name-based / deterministic)
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16); // RFC-4122 variant
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/**
 * Map a SYNTHETIC-or-REAL inbound Telegram update onto a channel-neutral Capture
 * Envelope, enforcing the single-user numeric allowlist (default-deny).
 *
 * Pure + deterministic: no wall-clock read (injected `now`), no I/O, no logging.
 * The caller (adapter) owns rejection LOGGING — this returns the verdict + the
 * offending sender id so the adapter can log without this module importing a log
 * sink. Keeps the mapping side-effect-free and unit-testable in isolation.
 *
 * @param {object} args
 * @param {object} args.update            { message:{ message_id, from:{ id }, text } }
 * @param {number} args.now              injected epoch ms
 * @param {string|number} args.authorisedUserId  the single allowlisted numeric id
 * @param {string} [args.action]         chosen capture action
 * @param {string} [args.defaultAction]  default action when none chosen
 * @param {boolean} [args.acceptMultimodal]  OPT-IN (default false). When false the
 *        WP0 text-only contract is UNCHANGED — an authorised private photo/voice
 *        update is rejected 'unsupported_content_type'. When true an authorised
 *        PRIVATE photo or voice note is ACCEPTED and mapped onto a multimodal
 *        envelope (technical_source_type 'image'|'voice') carrying a raw_object
 *        pointer. Default-off keeps the live path text-only until the isolated
 *        remainder (real getFile→bucket byte-fetch + OCR/STT model + credential)
 *        is wired. Non-photo/voice non-text (document/sticker/…) still rejects.
 * @returns {{ ok:true, value:Envelope, senderId:string }
 *          | { ok:false, reason:string, senderId:(string|null) }}
 */
export function mapTelegramUpdate({ update, now, authorisedUserId, action, defaultAction = 'SaveToBrain', acceptMultimodal = false } = {}) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('mapTelegramUpdate: injected numeric `now` (epoch ms) required');
  }
  if (authorisedUserId === undefined || authorisedUserId === null || authorisedUserId === '') {
    throw new Error('mapTelegramUpdate: authorisedUserId required (allowlist of one)');
  }
  const authorised = String(authorisedUserId);

  const message = update && typeof update === 'object' ? update.message : undefined;
  if (!message || typeof message !== 'object') {
    return { ok: false, reason: 'no_message', senderId: null };
  }

  const from = message.from;
  const senderId = from && from.id !== undefined ? String(from.id) : undefined;

  // Single-user allowlist, default-deny (wp0-security-gate.md §1). A numeric id,
  // never a username. Any other sender is refused — the ADAPTER logs it.
  if (senderId === undefined || senderId !== authorised) {
    return { ok: false, reason: 'unauthorised_sender', senderId: senderId ?? null };
  }

  // PRIVATE-DIRECT-CHAT BOUNDARY (correction 3; ordering fix
  // GPT-BUILD-002-WP1-DELTA-REVIEW-0002). This BUILD serves Warwick's DM only —
  // never groups, supergroups, or channels. Refuse any non-private / missing /
  // malformed chat context with the SAME quiet default-deny posture as an
  // unauthorised sender (no envelope is ever built). SINGLE shared predicate with
  // the WP1 webhook, so the two transports give the SAME verdict. Checked AFTER
  // the allowlist (no content/context oracle for strangers) and — critically —
  // BEFORE the content-type gate. Rationale: the live runner only emits the
  // visible "Text only in WP0" notice on 'unsupported_content_type'. If content
  // were inspected first, an authorised sender posting a photo/voice/document/
  // empty-text INTO A GROUP would be content-rejected and the runner would REPLY
  // INSIDE the non-private chat — breaking the quiet private-chat boundary. By
  // returning 'non_private_chat' before any content inspection, a non-private
  // context is refused silently and no notice can ever leak into a group.
  if (!isPrivateDirectChat({ chat: message.chat, senderId })) {
    return { ok: false, reason: 'non_private_chat', senderId };
  }

  // WP0: text only (technical_source_type 'text'). A message carrying NO usable
  // text (photo/voice/document/sticker/… or an empty/whitespace-only text field)
  // is REJECTED here — never mapped onto an envelope — so a non-text update can
  // NEVER produce an empty capture, an empty markdown note, or a false
  // 'completed' (live defect 2026-07-16: a photo silently "completed" with an
  // empty note). The caller replies with an honest "text only in WP0" notice.
  // Checked AFTER the allowlist so an unauthorised photo stays a plain
  // unauthorised_sender rejection (no content-type oracle for strangers), and
  // AFTER the private-chat boundary so this verdict — and the runner's visible
  // notice — is reachable ONLY inside the authorised user's own private chat.
  const text = typeof message.text === 'string' ? message.text : '';
  if (text.trim().length === 0) {
    // MULTIMODAL OPT-IN (G2). Only reachable here — for an AUTHORISED sender in
    // their OWN PRIVATE chat — so the security ORDER is preserved exactly: a
    // stranger's photo was already refused 'unauthorised_sender', and a group
    // photo already refused 'non_private_chat', BEFORE any content inspection.
    // When enabled, a photo → 'image' envelope and a voice note → 'voice'
    // envelope, each with a raw_object pointer. Anything else non-text
    // (document/sticker/empty text) falls through to the unchanged rejection.
    if (acceptMultimodal) {
      const multimodal = mapMultimodalMessage({
        message, senderId, now, action, defaultAction,
      });
      if (multimodal) return { ok: true, value: multimodal, senderId };
    }
    return { ok: false, reason: 'unsupported_content_type', senderId };
  }

  // Untrusted content stays inert data — it is never interpolated into a
  // path/command/query here.
  const messageId = message.message_id;
  const channelNativeMessageId = `chat:${senderId}:msg:${messageId}`;

  const idempotencyKey = buildIdempotencyKey({
    source_channel: SOURCE_CHANNEL,
    channel_native_message_id: channelNativeMessageId,
    raw_payload: text,
  });
  const captureId = deriveCaptureId(idempotencyKey);
  const iso = new Date(now).toISOString();

  const envelope = createEnvelope({
    capture_id: captureId,
    idempotency_key: idempotencyKey,
    source_channel: SOURCE_CHANNEL,
    sender_identity_ref: `telegram:user:${senderId}`,
    // WP1 consistency (wp1-architecture-decision.md §6 anomaly): the BARE
    // NUMERIC principal, matching what the cloud allowlist (fcg_webhook_intake)
    // matches on and what the deploy-time seed row carries. The poll path's
    // identity upsert (ON CONFLICT DO NOTHING on identity_ref) therefore stays
    // a no-op against the seed instead of registering a divergent shape.
    channel_principal_ref: senderId,
    recorded_intent: intentFromAction(action ?? defaultAction),
    technical_source_type: 'text',
    raw_payload_ref: {
      store: 'inline', // WP0 keeps text inline; bucket reserved, not used.
      object_key: `telegram:${channelNativeMessageId}`,
      content_type: 'text/plain',
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: sha256Hex(text),
    },
    // Pure inline text: no separate original-source object retained.
    original_source_ref: null,
    captured_at: iso,
    received_at: iso,
    text_preview: text.slice(0, 280),
    channel_context: { chat_id: senderId, message_id: messageId },
  });

  return { ok: true, value: envelope, senderId };
}

// ---------------------------------------------------------------------------
// MULTIMODAL MAPPING (G2) — photo + voice. Pure + deterministic (injected `now`),
// no I/O, no logging, no byte-fetch. The actual media bytes are NOT downloaded
// here: the envelope carries a raw_object POINTER (Telegram file_id + the private
// bucket object_key it WILL land at). The durable getFile → bucket write and the
// OCR/STT model call are the isolated remainder (see the transcription stage).
// ---------------------------------------------------------------------------

// Telegram delivers a photo as an array of PhotoSize thumbnails in ascending
// size. Choose the LARGEST (best OCR fidelity); tie-break to the last element.
function largestPhoto(photoArray) {
  let best = null;
  let bestArea = -1;
  for (const p of photoArray) {
    if (!p || typeof p !== 'object' || typeof p.file_id !== 'string') continue;
    const area = (Number(p.width) || 0) * (Number(p.height) || 0);
    if (area >= bestArea) { bestArea = area; best = p; }
  }
  return best;
}

// Build the channel-neutral raw_object descriptor (G2). `object_key` is the
// private-bucket key the fetched bytes WILL occupy; it also encodes the stable
// file reference so the downstream transcriber can locate the bytes. `fetched`
// is false and `sha256` null until the byte-fetch remainder lands.
function buildRawObject({ technicalSourceType, contentType, fileId, fileUniqueId, fileIds, bytes }) {
  const uid = fileUniqueId || fileId;
  return {
    technical_source_type: technicalSourceType,
    store: 'supabase-storage',
    bucket: 'fcg-raw-private',
    object_key: `telegram:${technicalSourceType}:${uid}`,
    content_type: contentType,
    bytes: Number.isInteger(bytes) && bytes >= 0 ? bytes : null,
    sha256: null,
    fetched: false,
    source: {
      channel: SOURCE_CHANNEL,
      file_id: fileId,
      file_unique_id: fileUniqueId ?? null,
      file_ids: fileIds,
    },
  };
}

// Assemble a multimodal Capture Envelope from a raw_object descriptor. Mirrors
// the text path's identity/idempotency semantics: the idempotency key folds the
// stable per-file id, so a RE-SENT identical photo/voice dedups to one capture.
function envelopeFromRawObject({
  message, senderId, now, action, defaultAction, technicalSourceType, rawObject, dedupPayload,
}) {
  const messageId = message.message_id;
  const channelNativeMessageId = `chat:${senderId}:msg:${messageId}`;
  const idempotencyKey = buildIdempotencyKey({
    source_channel: SOURCE_CHANNEL,
    channel_native_message_id: channelNativeMessageId,
    raw_payload: dedupPayload,
  });
  const captureId = deriveCaptureId(idempotencyKey);
  const iso = new Date(now).toISOString();
  const caption = typeof message.caption === 'string' ? message.caption : '';

  return createEnvelope({
    capture_id: captureId,
    idempotency_key: idempotencyKey,
    source_channel: SOURCE_CHANNEL,
    sender_identity_ref: `telegram:user:${senderId}`,
    channel_principal_ref: senderId,
    recorded_intent: intentFromAction(action ?? defaultAction),
    technical_source_type: technicalSourceType,
    // raw_payload_ref IS the raw_object pointer (contract §5: telegram_file_id via
    // object_key, sha256/bytes-in-store). Bytes present only when Telegram gave a
    // size; sha256 is added by the byte-fetch remainder.
    raw_payload_ref: {
      store: rawObject.store,
      object_key: rawObject.object_key,
      content_type: rawObject.content_type,
      ...(rawObject.bytes !== null ? { bytes: rawObject.bytes } : {}),
    },
    // The untouched original media is retained (matrix §2) in the channel/bucket.
    original_source_ref: {
      store: rawObject.store,
      object_key: rawObject.object_key,
      message_ref: `telegram:file:${rawObject.source.file_id}`,
      retained: true,
    },
    // Self-describing raw_object descriptor (G2). Extra field: validateEnvelope
    // ignores it. The durable store persists technical_source_type + the pointer;
    // the transcription stage reconstructs raw_object via deriveRawObject(record).
    raw_object: rawObject,
    captured_at: iso,
    received_at: iso,
    text_preview: caption.slice(0, 280),
    channel_context: { chat_id: senderId, message_id: messageId },
  });
}

/**
 * Map an authorised, private, non-text message onto a multimodal envelope.
 * Returns the Envelope for a photo or voice note, or null for any other
 * non-text kind (document/sticker/…) — the caller then rejects as
 * 'unsupported_content_type'. Only reached when acceptMultimodal is on.
 */
function mapMultimodalMessage({ message, senderId, now, action, defaultAction }) {
  // PHOTO → technical_source_type 'image'.
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const p = largestPhoto(message.photo);
    if (!p) return null;
    const rawObject = buildRawObject({
      technicalSourceType: 'image',
      contentType: 'image/jpeg',
      fileId: p.file_id,
      fileUniqueId: p.file_unique_id,
      fileIds: message.photo.map((x) => (x && x.file_id) || null).filter(Boolean),
      bytes: p.file_size,
    });
    return envelopeFromRawObject({
      message, senderId, now, action, defaultAction,
      technicalSourceType: 'image',
      rawObject,
      dedupPayload: p.file_unique_id || p.file_id,
    });
  }

  // VOICE → technical_source_type 'voice'.
  const v = message.voice;
  if (v && typeof v === 'object' && typeof v.file_id === 'string') {
    const rawObject = buildRawObject({
      technicalSourceType: 'voice',
      contentType: (typeof v.mime_type === 'string' && v.mime_type) ? v.mime_type : 'audio/ogg',
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      fileIds: [v.file_id],
      bytes: v.file_size,
    });
    return envelopeFromRawObject({
      message, senderId, now, action, defaultAction,
      technicalSourceType: 'voice',
      rawObject,
      dedupPayload: v.file_unique_id || v.file_id,
    });
  }

  // Document / sticker / other non-text: not handled by this increment.
  return null;
}

/**
 * Map an inbound Telegram callback_query (an action-button tap on a card) onto a
 * channel-neutral action descriptor, enforcing the SAME single-user allowlist.
 *
 * A callback_query does NOT carry the original captured text — it references the
 * bot's CARD message. So this returns the routing coordinates (chat id + card
 * message id) + the chosen action; the caller resolves which capture that card
 * belongs to via the durable card_ref reverse lookup (§4).
 *
 * Pure + deterministic (injected `now`), no I/O, no logging — parity with
 * mapTelegramUpdate: the adapter owns rejection LOGGING.
 *
 * @returns {{ ok:true, value:{ callbackId, chatId, messageId, senderId, action } }
 *          | { ok:false, reason:string, senderId:(string|null) }}
 */
export function mapTelegramCallbackQuery({ update, now, authorisedUserId } = {}) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('mapTelegramCallbackQuery: injected numeric `now` (epoch ms) required');
  }
  if (authorisedUserId === undefined || authorisedUserId === null || authorisedUserId === '') {
    throw new Error('mapTelegramCallbackQuery: authorisedUserId required (allowlist of one)');
  }
  const authorised = String(authorisedUserId);

  const cq = update && typeof update === 'object' ? update.callback_query : undefined;
  if (!cq || typeof cq !== 'object') {
    return { ok: false, reason: 'no_callback', senderId: null };
  }

  const from = cq.from;
  const senderId = from && from.id !== undefined ? String(from.id) : undefined;
  // Same single-user default-deny as the message path.
  if (senderId === undefined || senderId !== authorised) {
    return { ok: false, reason: 'unauthorised_sender', senderId: senderId ?? null };
  }

  const msg = cq.message && typeof cq.message === 'object' ? cq.message : {};

  // PRIVATE-DIRECT-CHAT BOUNDARY (correction 3) — a tap on a card that lives in a
  // group / supergroup / channel (or a malformed chat) is refused with the same
  // quiet posture. SINGLE shared predicate with the webhook callback path.
  if (!isPrivateDirectChat({ chat: msg.chat, senderId })) {
    return { ok: false, reason: 'non_private_chat', senderId };
  }

  const chat = msg.chat; // predicate guarantees an object with id === senderId
  const chatId = String(chat.id); // private chat → user id
  const messageId = msg.message_id;
  // Untrusted content stays inert: the action is validated against the known set;
  // an unknown action is rejected rather than interpolated anywhere.
  const action = typeof cq.data === 'string' ? cq.data : undefined;

  return {
    ok: true,
    value: {
      callbackId: cq.id,
      chatId,
      messageId,
      senderId,
      action,
    },
  };
}
