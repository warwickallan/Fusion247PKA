// Telegram channel adapter — INTERFACE + a MOCK (fixtures) implementation.
//
// Source of truth: supabase-operational-foundation-boundary.md §4 (thin channel
// adapter; Telegram gets no special backend path) and wp0-security-gate.md §1
// (single-user allowlist, default-deny).
//
// FIXTURES ONLY (WP0): NO network, NO real bot token, NO real user. The adapter
// maps a SYNTHETIC inbound Telegram-shaped update onto the channel-neutral
// Capture Envelope, and records "sent"/"edited" cards into an in-memory log so
// tests can assert card behaviour without touching Telegram.
//
// Channel-neutral rule: all Telegram-specific knowledge lives HERE. The intake,
// store, worker, and contracts never mention Telegram.

import { createEnvelope } from '../core/contracts.js';
import { buildIdempotencyKey, sha256Hex } from '../core/idempotency.js';

const SOURCE_CHANNEL = 'telegram';

// Map an optional chosen capture action onto the recorded_intent enum
// (RECORDED_INTENTS = LarryDirect | SaveToBrain | ConfirmedAction). Default:
// SaveToBrain — durable capture is authorised by the action itself.
function intentFromAction(action) {
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
 */
function deriveCaptureId(idempotencyKey) {
  return `cap_${sha256Hex(idempotencyKey).slice(0, 24)}`;
}

/**
 * TelegramAdapter interface (documentation contract). A conforming
 * implementation MUST provide:
 *
 *   toEnvelope(update, { now, action }) -> { ok:true, value:Envelope }
 *                                        | { ok:false, reason:string }
 *       Map a SYNTHETIC inbound update { message:{ message_id, from:{ id }, text } }
 *       onto a channel-neutral Capture Envelope. Enforces the single-user
 *       allowlist: a sender whose from.id !== the authorised id is rejected with
 *       reason 'unauthorised_sender' (default-deny). `now` is injected epoch ms.
 *
 *   sendCard(captureId, cardModel) -> entry       (initial card)
 *   editCard(captureId, cardModel) -> entry       (status update, e.g. Completed)
 *       Record the card into an in-memory log. NO network.
 *
 *   failNextEdit()                                (test hook)
 *       Make the NEXT editCard throw once, to simulate a failed card projection.
 */

/**
 * Create the MOCK Telegram adapter.
 *
 * @param {object} opts
 * @param {string|number} opts.authorisedUserId  the single allowlisted numeric id.
 * @param {string} [opts.defaultAction]           default capture action (SaveToBrain).
 */
export function createMockTelegramAdapter({ authorisedUserId, defaultAction = 'SaveToBrain' } = {}) {
  if (authorisedUserId === undefined || authorisedUserId === null || authorisedUserId === '') {
    throw new Error('createMockTelegramAdapter: authorisedUserId required (allowlist of one)');
  }
  const authorised = String(authorisedUserId);

  // In-memory card log — the fixture stand-in for real Telegram card calls.
  const sentCards = [];
  // Rejection log — default-deny events are logged (sender id + when), never actioned.
  const rejections = [];
  let failEditOnce = false;

  return {
    // --- expose the log for tests ---
    sentCards,
    rejections,

    toEnvelope(update, { now, action } = {}) {
      if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new Error('toEnvelope: injected numeric `now` (epoch ms) required');
      }

      const message = update && typeof update === 'object' ? update.message : undefined;
      if (!message || typeof message !== 'object') {
        return { ok: false, reason: 'no_message' };
      }

      const from = message.from;
      const senderId = from && from.id !== undefined ? String(from.id) : undefined;

      // Single-user allowlist, default-deny (wp0-security-gate.md §1). A numeric
      // id, never a username. Any other sender is silently ignored + logged.
      if (senderId === undefined || senderId !== authorised) {
        rejections.push({ sender_id: senderId ?? null, at_ms: now, reason: 'unauthorised_sender' });
        return { ok: false, reason: 'unauthorised_sender' };
      }

      // WP0: text only (technical_source_type 'text'). Untrusted content stays
      // inert data — it is never interpolated into a path/command/query here.
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

      return { ok: true, value: envelope };
    },

    sendCard(captureId, cardModel) {
      const entry = { op: 'send', captureId, cardModel };
      sentCards.push(entry);
      return entry;
    },

    editCard(captureId, cardModel) {
      if (failEditOnce) {
        failEditOnce = false;
        // A failed card edit is a failed PROJECTION only. Per the durable-saga
        // model it must NOT reverse or duplicate the completed write — the
        // worker swallows this and leaves state completed.
        throw new Error(`editCard: simulated card edit failure for ${captureId}`);
      }
      const entry = { op: 'edit', captureId, cardModel };
      sentCards.push(entry);
      return entry;
    },

    /** Test hook: force the next editCard to throw once. */
    failNextEdit() {
      failEditOnce = true;
    },
  };
}
