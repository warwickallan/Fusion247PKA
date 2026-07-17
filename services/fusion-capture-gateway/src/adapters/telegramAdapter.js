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

import { mapTelegramUpdate, mapTelegramCallbackQuery } from './telegramMapping.js';

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
  // Plain (non-card) outbound messages — e.g. the WP0 "text only" notice.
  const sentMessages = [];
  // Rejection log — default-deny events are logged (sender id + when), never actioned.
  const rejections = [];
  // Answered callbacks (test-observable) + scripted inbound queue for getUpdates.
  const answered = [];
  let pending = [];
  // Card targets, mirroring the live adapter — so the runner can promote them to
  // the durable store and prove restart recovery (a NEW mock loses this map).
  const cardMessages = new Map(); // captureId -> { chatId, messageId }
  let nextMessageId = 1000;
  let failEditOnce = false;

  return {
    // --- expose the logs for tests ---
    sentCards,
    sentMessages,
    rejections,
    answered,

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

    /** Channel-neutral CALLBACK mapping + single-user default-deny (as live). */
    toCallback(update, { now } = {}) {
      const mapped = mapTelegramCallbackQuery({ update, now, authorisedUserId: authorised });
      if (!mapped.ok) {
        if (mapped.reason === 'unauthorised_sender') {
          rejections.push({ sender_id: mapped.senderId, at_ms: now, reason: mapped.reason });
        }
        return { ok: false, reason: mapped.reason };
      }
      return { ok: true, value: mapped.value };
    },

    sendCard(captureId, cardModel) {
      const chatId = (cardModel && cardModel.chat_id) ?? authorised;
      const messageId = (nextMessageId += 1);
      cardMessages.set(captureId, { chatId, messageId });
      const entry = { op: 'send', captureId, cardModel, chatId, messageId };
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
      // Restart-safe target resolution: prefer the in-memory map, else fall back
      // to the {chat_id, message_id} the runner reconstructed from durable state.
      const tracked = cardMessages.get(captureId);
      const chatId = tracked?.chatId ?? cardModel?.chat_id;
      const messageId = tracked?.messageId ?? cardModel?.message_id;
      if (messageId === undefined) {
        throw new Error(`editCard: no known message_id for capture "${captureId}" (sendCard or restore first)`);
      }
      const entry = { op: 'edit', captureId, cardModel, chatId, messageId };
      sentCards.push(entry);
      return entry;
    },

    /**
     * Plain informational message — NO card, NO buttons (parity with the live
     * adapter's sendMessage). Used for the WP0 "text only" notice. Recorded
     * in-memory so tests can assert it without any network.
     */
    sendMessage(chatId, text) {
      const entry = { op: 'message', chatId, text };
      sentMessages.push(entry);
      return entry;
    },

    /**
     * Acknowledge a callback (test-observable). Never throws. `showAlert`
     * mirrors the live adapter's dismissable-pop-up option (show_alert: true)
     * so the runner's choice of subtle-toast vs must-see-alert is assertable.
     */
    answerCallbackQuery(callbackQueryId, text, { showAlert = false } = {}) {
      const entry = { callbackQueryId, text, showAlert };
      answered.push(entry);
      return entry;
    },

    /** The persisted card target for a capture, if this instance sent it. */
    cardTarget(captureId) {
      const t = cardMessages.get(captureId);
      return t ? { chatId: t.chatId, messageId: t.messageId } : undefined;
    },

    /**
     * Scripted long-poll. Returns queued updates with update_id >= offset and
     * drops them (Telegram's offset-ack semantics), so the runner's loop
     * terminates once the scripted batch is drained.
     */
    async getUpdates({ offset = 0 } = {}) {
      const ready = pending.filter((u) => (u.update_id ?? 0) >= offset);
      pending = pending.filter((u) => (u.update_id ?? 0) < offset);
      return ready;
    },

    /** Test hook: enqueue inbound updates the next getUpdates will deliver. */
    deliver(...updates) {
      pending.push(...updates.flat());
    },

    describe() {
      return { channel: 'telegram', mode: 'mock', authorised_user_id: authorised };
    },

    /** Test hook: force the next editCard to throw once. */
    failNextEdit() {
      failEditOnce = true;
    },
  };
}
