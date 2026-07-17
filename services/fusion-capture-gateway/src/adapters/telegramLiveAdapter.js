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

import { mapTelegramUpdate, mapTelegramCallbackQuery } from './telegramMapping.js';

const DEFAULT_API_BASE = 'https://api.telegram.org';

// getUpdates long-poll wait, seconds. LIVE FINDING (2026-07-17, Warwick's home
// network): the consumer router/NAT silently kills any TCP connection held open
// ≥~45s — every empty long-poll died at ~45s with "fetch failed", metronomic,
// and the poisoned keep-alive socket then failed the NEXT Bot API call too.
// 25s stays safely under the observed ~45s middlebox kill window.
const DEFAULT_GET_UPDATES_WAIT_SECONDS = 25;

// One retry, short pause — see isTransientNetworkError() below.
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 250;

/**
 * Classify a fetch REJECTION as a transient network/socket failure. fetch()
 * rejects ONLY at the network layer — an HTTP 4xx/5xx RESOLVES with a response
 * and is never retried here. Walks the undici `cause` chain (global fetch wraps
 * the real socket error in TypeError('fetch failed').cause).
 *
 * LIVE FINDING (2026-07-17): a NAT-killed keep-alive socket makes the next
 * pooled request fail once; undici discards the dead socket, so ONE retry gets
 * a FRESH socket from the pool and succeeds. This is the no-new-deps fix.
 */
export function isTransientNetworkError(err) {
  const TRANSIENT_CODES = [
    'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT',
    'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
  ];
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth += 1) {
    const msg = typeof e.message === 'string' ? e.message : '';
    const code = typeof e.code === 'string' ? e.code : '';
    if (TRANSIENT_CODES.includes(code)
      || msg.includes('fetch failed')
      || msg.includes('socket hang up')
      || msg.includes('other side closed')
      || msg.includes('terminated')) {
      return true;
    }
  }
  return false;
}

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
 * @param {number} [opts.retryDelayMs]      pause before the single transient-network
 *                 retry (default 250ms; tests pass 0).
 */
export function createLiveTelegramAdapter({
  botToken,
  authorisedUserId,
  fetchImpl = (typeof fetch === 'function' ? fetch : undefined),
  now = Date.now,
  apiBase = DEFAULT_API_BASE,
  defaultAction = 'SaveToBrain',
  accessLog,
  retryDelayMs = DEFAULT_TRANSIENT_RETRY_DELAY_MS,
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
   *
   * TRANSIENT-NETWORK RESILIENCE (live finding 2026-07-17): a network-level
   * rejection (NAT-killed keep-alive socket → 'fetch failed'/ECONNRESET) is
   * retried ONCE after a short pause — the retry draws a FRESH socket because
   * undici discards the dead one. HTTP-level errors (parsed ok:false) are NEVER
   * retried. Idempotency note: if the first attempt actually reached Telegram
   * and only the response was lost, the retry can duplicate a sendMessage
   * (worst case: one extra card — accepted for WP0) or hit "message is not
   * modified" on an editMessageText (surfaces as a projection failure the
   * worker already swallows). getUpdates retries are inherently safe (offset
   * ack semantics).
   */
  async function callApi(method, body) {
    const url = `${base}/${method}`;
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (netErr) {
      if (!isTransientNetworkError(netErr)) {
        const msg = netErr && netErr.message ? netErr.message : String(netErr);
        throw new Error(`telegram ${method} request failed: ${maskedUrl(msg, botToken)}`);
      }
      // ONE retry on a fresh socket. A second failure is a real outage — throw.
      await new Promise((resolve) => { setTimeout(resolve, retryDelayMs); });
      try {
        res = await fetchImpl(url, init);
      } catch (retryErr) {
        const msg = retryErr && retryErr.message ? retryErr.message : String(retryErr);
        throw new Error(`telegram ${method} request failed after retry: ${maskedUrl(msg, botToken)}`);
      }
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

    /**
     * Channel-neutral CALLBACK mapping + single-user default-deny. Returns the
     * card routing coordinates + chosen action; the runner resolves the owning
     * capture via the durable card_ref reverse lookup. Auth rejections logged.
     */
    toCallback(update, { now: nowMs } = {}) {
      const mapped = mapTelegramCallbackQuery({ update, now: nowMs, authorisedUserId: authorised });
      if (!mapped.ok) {
        if (mapped.reason === 'unauthorised_sender') {
          rejections.push({ sender_id: mapped.senderId, at_ms: nowMs, reason: mapped.reason });
          if (accessLog && typeof accessLog.authRejection === 'function') {
            accessLog.authRejection({
              principal: mapped.senderId, channel: 'telegram', when: nowMs, reason: mapped.reason,
            });
          }
        }
        return { ok: false, reason: mapped.reason };
      }
      return { ok: true, value: mapped.value };
    },

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
        // Set ONLY when the projection asks for it (completed card's monospace
        // destination path); pending/failed cards stay parse-mode-free.
        ...(cardModel && cardModel.parse_mode ? { parse_mode: cardModel.parse_mode } : {}),
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
        // Completed receipt: parse_mode 'Markdown' renders the backticked
        // destination path as monospace, so Telegram does not auto-link the
        // `.md` filename as a bogus URL. Only present when the projection set it.
        ...(cardModel && cardModel.parse_mode ? { parse_mode: cardModel.parse_mode } : {}),
      });
      return parsed;
    },

    /**
     * Plain informational message — NO card, NO buttons, NO parse mode. Used for
     * the WP0 "text only" notice on a non-text update. Best-effort projection:
     * the caller decides whether to swallow a failure.
     * @returns parsed Bot API result.
     */
    async sendMessage(chatId, text) {
      return callApi('sendMessage', { chat_id: chatId, text });
    },

    /**
     * Acknowledge a callback_query so Telegram dismisses the button's loading
     * spinner. `text` is a brief, secret-free toast. Best-effort: a failure here
     * is a projection failure, never a data-integrity one — the caller decides
     * whether to swallow it. Returns the parsed API result.
     *
     * `showAlert: true` renders a DISMISSABLE POP-UP instead of the subtle
     * ~2s toast (live phone finding 2026-07-17: the plain toast is invisible in
     * practice — Warwick reported the KeepRaw/AskLarry buttons "just don't do
     * anything"). Use it for answers the user MUST see; the SaveToBrain ack
     * stays subtle because the card edit itself is the feedback.
     */
    async answerCallbackQuery(callbackQueryId, text, { showAlert = false } = {}) {
      return callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: typeof text === 'string' ? text : undefined,
        ...(showAlert ? { show_alert: true } : {}),
      });
    },

    /**
     * The durable-recovery seam: the persisted card target for a capture, if the
     * runner has one. The runner promotes this to the operational store's
     * card_ref so a restart can re-target editCard without this in-memory map.
     */
    cardTarget(captureId) {
      const t = cardMessages.get(captureId);
      return t ? { chatId: t.chatId, messageId: t.messageId } : undefined;
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
     * @param {number} [opts.timeout]  long-poll seconds (default: the named
     *                 constant — MUST stay under the ~45s NAT kill window).
     * @param {number} [opts.limit]    max updates per batch.
     * @returns {Promise<object[]>} the parsed updates array.
     */
    async getUpdates({ offset, timeout = DEFAULT_GET_UPDATES_WAIT_SECONDS, limit = 100 } = {}) {
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
