// LIVE Telegram adapter — the REAL Bot API wire.
//
// Same adapter interface the MOCK exposes (toEnvelope / sendCard / editCard) so
// intake + worker run against it unchanged, PLUS the real HTTPS Bot API calls
// and F-10 webhook authenticity. Telegram-specific knowledge stays HERE; the
// channel-neutral mapping is delegated to telegramMapping.js (shared with mock).
//
// HERMETIC BY DESIGN: the network client is an INJECTED `fetchImpl` (defaults to
// Node 22's GLOBAL fetch — NO npm dependency added). Unit tests pass a mock
// fetchImpl and a throwaway fake token, so the full surface is verified with no
// real bot, no Supabase, and no network.
//
// SECRET HYGIENE (wp0-security-gate.md §2): the bot token is a full account
// credential. It appears ONLY inside the request URL sent to fetchImpl. It is
// NEVER logged, never thrown in an error, never returned. Every diagnostic uses
// maskToken()/maskedUrl().

import { createHash, timingSafeEqual } from 'node:crypto';

import { mapTelegramUpdate } from './telegramMapping.js';

const DEFAULT_API_BASE = 'https://api.telegram.org';

// The inline-keyboard action buttons offered on the initial card. callback_data
// maps back to the recorded_intent actions the mapping understands.
const ACTION_BUTTONS = Object.freeze([
  { text: 'Save to Brain', callback_data: 'SaveToBrain' },
  { text: 'Ask Larry', callback_data: 'AskLarry' },
  { text: 'Keep Raw', callback_data: 'KeepRaw' },
]);

/**
 * Mask a bot token for any diagnostic. Never reveals the secret body: keeps only
 * the numeric bot-id prefix (public-ish) and masks everything after the colon.
 * A malformed/short token collapses to a fixed marker.
 */
export function maskToken(token) {
  if (typeof token !== 'string' || token.length === 0) return '(unset)';
  const colon = token.indexOf(':');
  if (colon <= 0) return '***masked***';
  return `${token.slice(0, colon)}:***masked***`;
}

// Replace the token segment of a Bot API URL with its masked form for logging.
function maskedUrl(url, token) {
  if (typeof url !== 'string') return url;
  return url.split(token).join(maskToken(token));
}

/**
 * @param {object} opts
 * @param {string} opts.botToken            Telegram bot token (SECRET).
 * @param {string|number} opts.authorisedUserId  single allowlisted numeric id.
 * @param {typeof fetch} [opts.fetchImpl]   injected fetch (default: global fetch).
 * @param {() => number} [opts.now]         injected clock for diagnostics (default Date.now).
 * @param {string} [opts.apiBase]           override API base (tests).
 * @param {string} [opts.defaultAction]     default capture action.
 * @param {object} [opts.accessLog]         optional access logger (auth rejections).
 */
export function createLiveTelegramAdapter({
  botToken,
  authorisedUserId,
  fetchImpl = (typeof fetch === 'function' ? fetch : undefined),
  now = Date.now,
  apiBase = DEFAULT_API_BASE,
  defaultAction = 'SaveToBrain',
  accessLog,
} = {}) {
  if (typeof botToken !== 'string' || botToken.length === 0) {
    throw new Error('createLiveTelegramAdapter: botToken required');
  }
  if (authorisedUserId === undefined || authorisedUserId === null || authorisedUserId === '') {
    throw new Error('createLiveTelegramAdapter: authorisedUserId required (allowlist of one)');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('createLiveTelegramAdapter: fetchImpl required (global fetch or an injected mock)');
  }
  const authorised = String(authorisedUserId);
  const base = `${apiBase}/bot${botToken}`;

  // Card message ids per capture, so editCard can target the right message. Real
  // Telegram returns a message_id on sendMessage; we remember it here.
  const cardMessages = new Map(); // captureId -> { chatId, messageId }
  const rejections = [];

  /**
   * Call a Bot API method. Builds the real HTTPS request and hands it to
   * fetchImpl. NEVER logs the token; any thrown error masks it.
   */
  async function callApi(method, body) {
    const url = `${base}/${method}`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      const msg = netErr && netErr.message ? netErr.message : String(netErr);
      throw new Error(`telegram ${method} request failed: ${maskedUrl(msg, botToken)}`);
    }
    const parsed = await res.json();
    if (!parsed || parsed.ok !== true) {
      const desc = parsed && parsed.description ? parsed.description : `http_${res.status}`;
      // desc is Telegram's own error text — mask defensively in case a token echoes.
      throw new Error(`telegram ${method} rejected: ${maskedUrl(String(desc), botToken)}`);
    }
    return parsed;
  }

  function inlineKeyboard(cardModel) {
    // Once completed the action buttons are cleared; the card is terminal.
    if (cardModel && cardModel.is_completed) return { inline_keyboard: [] };
    return { inline_keyboard: [ACTION_BUTTONS.map((b) => ({ ...b }))] };
  }

  function chatIdFor(captureId, cardModel) {
    const tracked = cardMessages.get(captureId);
    // Private-chat convention: chat_id === the authorised user's id.
    return tracked?.chatId ?? cardModel?.chat_id ?? authorised;
  }

  return {
    rejections,

    /** Channel-neutral mapping + single-user default-deny (shared with mock). */
    toEnvelope(update, { now: nowMs, action } = {}) {
      const mapped = mapTelegramUpdate({
        update,
        now: nowMs,
        authorisedUserId: authorised,
        action,
        defaultAction,
      });
      if (!mapped.ok) {
        if (mapped.reason === 'unauthorised_sender') {
          rejections.push({ sender_id: mapped.senderId, at_ms: nowMs, reason: mapped.reason });
          // F-05: structured auth-rejection log (no content, no secrets).
          if (accessLog && typeof accessLog.authRejection === 'function') {
            accessLog.authRejection({
              principal: mapped.senderId,
              channel: 'telegram',
              when: nowMs,
              reason: mapped.reason,
            });
          }
        }
        return { ok: false, reason: mapped.reason };
      }
      return { ok: true, value: mapped.value };
    },

    /**
     * Initial card: real sendMessage with the action inline keyboard. Remembers
     * the returned message_id so editCard can update THIS card later.
     * @returns parsed Bot API result.
     */
    async sendCard(captureId, cardModel) {
      const chatId = chatIdFor(captureId, cardModel);
      const parsed = await callApi('sendMessage', {
        chat_id: chatId,
        text: cardModel.status_line,
        reply_markup: inlineKeyboard(cardModel),
      });
      const messageId = parsed.result && parsed.result.message_id;
      if (messageId !== undefined) cardMessages.set(captureId, { chatId, messageId });
      return parsed;
    },

    /**
     * Update the card (e.g. to Completed): real editMessageText. When completing,
     * a follow-up editMessageReplyMarkup clears the action buttons.
     * @returns parsed Bot API result.
     */
    async editCard(captureId, cardModel) {
      const tracked = cardMessages.get(captureId);
      const chatId = chatIdFor(captureId, cardModel);
      const messageId = tracked?.messageId ?? cardModel?.message_id;
      if (messageId === undefined) {
        throw new Error(`editCard: no known message_id for capture "${captureId}" (sendCard first)`);
      }
      const parsed = await callApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: cardModel.status_line,
        reply_markup: inlineKeyboard(cardModel),
      });
      return parsed;
    },

    /**
     * F-10 (webhook path): verify Telegram's authenticity header against the
     * configured secret token, CONSTANT-TIME. Default-deny: a missing header, a
     * missing/empty configured secret, or a length/content mismatch all reject.
     *
     * @param {object} headers               inbound request headers (any casing).
     * @param {string} expectedSecretToken   the configured webhook secret.
     * @returns {boolean} true only on an exact match.
     */
    verifyWebhook(headers, expectedSecretToken) {
      if (typeof expectedSecretToken !== 'string' || expectedSecretToken.length === 0) return false;
      if (!headers || typeof headers !== 'object') return false;
      // Case-insensitive header lookup (X-Telegram-Bot-Api-Secret-Token).
      let provided;
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'x-telegram-bot-api-secret-token') { provided = v; break; }
      }
      if (typeof provided !== 'string' || provided.length === 0) return false;
      const a = Buffer.from(provided, 'utf8');
      const b = Buffer.from(expectedSecretToken, 'utf8');
      // timingSafeEqual requires equal length; unequal length is a definite miss.
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    },

    /**
     * F-10 (polling path): long-poll getUpdates. Only the bot's own token
     * receives updates, so this is inherently default-deny at the transport; the
     * per-update sender allowlist is still enforced by toEnvelope downstream.
     *
     * @param {object} [opts]
     * @param {number} [opts.offset]   update_id offset (ack prior updates).
     * @param {number} [opts.timeout]  long-poll seconds.
     * @param {number} [opts.limit]    max updates per batch.
     * @returns {Promise<object[]>} the parsed updates array.
     */
    async getUpdates({ offset, timeout = 30, limit = 100 } = {}) {
      const parsed = await callApi('getUpdates', { offset, timeout, limit });
      return Array.isArray(parsed.result) ? parsed.result : [];
    },

    /** Diagnostics only — the masked token. Never returns the real value. */
    describe() {
      return {
        channel: 'telegram',
        api_base: apiBase,
        bot_token: maskToken(botToken),
        authorised_user_id: authorised,
      };
    },

    // Test/inspection helper — remembered card message ids (no secrets).
    _cardMessages: cardMessages,

    // Stable content fingerprint of the token for equality checks WITHOUT
    // exposing it (never used for auth; diagnostics/tests only).
    _tokenFingerprint() {
      return createHash('sha256').update(botToken).digest('hex').slice(0, 12);
    },
  };
}
