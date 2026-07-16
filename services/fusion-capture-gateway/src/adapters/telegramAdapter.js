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

import { mapTelegramUpdate } from './telegramMapping.js';

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
      // Delegate the channel-neutral mapping + single-user default-deny to the
      // SHARED mapping module (identical logic the live adapter reuses).
      const mapped = mapTelegramUpdate({
        update,
        now,
        authorisedUserId: authorised,
        action,
        defaultAction,
      });
      if (!mapped.ok) {
        if (mapped.reason === 'unauthorised_sender') {
          // Default-deny event: logged (sender id + when), never actioned.
          rejections.push({ sender_id: mapped.senderId, at_ms: now, reason: mapped.reason });
        }
        return { ok: false, reason: mapped.reason };
      }
      return { ok: true, value: mapped.value };
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
