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
 * @returns {{ ok:true, value:Envelope, senderId:string }
 *          | { ok:false, reason:string, senderId:(string|null) }}
 */
export function mapTelegramUpdate({ update, now, authorisedUserId, action, defaultAction = 'SaveToBrain' } = {}) {
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

  // WP0: text only (technical_source_type 'text'). Untrusted content stays inert
  // data — it is never interpolated into a path/command/query here.
  const text = typeof message.text === 'string' ? message.text : '';
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
