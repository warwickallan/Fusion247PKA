// =====================================================================
// BUILD-015 AsdAIr — bot: sendShopperMessage.js
//
// THE OUTBOUND HALF. Puts a rendered { text, reply_markup } on the wire as
// @Fusion247shopperbot, edits a card in place once it has been answered, and
// stops a tapped button spinning.
//
// ── EXACTLY THREE METHODS, AND IT NEVER POLLS ────────────────────────────────
// sendMessage · editMessageText · answerCallbackQuery. That is the whole API.
//
// Telegram's long-poll method is deliberately ABSENT from this file, and must
// stay absent. Long-polling is DESTRUCTIVE — an offset ACKS every update below
// it — and exactly one consumer of the ShopperBot stream already exists, in
// services/asdair/intake/. A second poller would race the receiver and one of
// them would silently swallow the week's shopping list.
// noPolling.test.js scans this file's own source (and inboundRouter.js) for the
// poll-method identifier and FAILS if it ever appears. The rule is enforced by a
// test, not by good intentions — which is also why this comment spells the
// identifier nowhere.
//
// ── HERMETIC BY DESIGN ───────────────────────────────────────────────────────
// `fetchImpl` is INJECTED (defaulting to the Node global fetch — no npm
// dependency), exactly as services/asdair/intake/shopperIntake.js does it. The
// suite passes a fake, so the tests never touch the network.
//
// ── SECRET HYGIENE ───────────────────────────────────────────────────────────
// The token is read from the environment BY NAME ONLY (SHOPPER_BOT_TOKEN — the
// same bot account the receiver uses, so there is one credential, not two). No
// credentials file is ever read, parsed, printed or inspected here.
// The token value appears in exactly ONE place: the request URL handed to
// fetchImpl. It is never logged, never thrown, never returned by describe(), and
// every error message this module produces is passed through maskTokenIn()
// before it escapes — so a Telegram error that echoes the URL cannot leak it.
//
// ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
// It does not start a browser, does not add anything to a basket, does not book
// a slot, does not check out and does not pay. It sends text.
// =====================================================================

/** Telegram Bot API root. Overridable for tests/diagnostics; not a secret. */
export const DEFAULT_API_BASE = 'https://api.telegram.org';

/** Environment variable NAMES. Values never appear in this file. */
export const SHOPPER_BOT_ENV = Object.freeze({
  // SECRET — the @Fusion247shopperbot token. Same name the receiver uses: one
  // bot account, one credential. Supply it with `node --env-file=<file>`, never
  // on a command line and never in git.
  SHOPPER_BOT_TOKEN: 'SHOPPER_BOT_TOKEN',
  // The chat the control surface talks to. Not a secret.
  SHOPPER_CHAT_ID: 'SHOPPER_CHAT_ID',
  // Test/diagnostic override of the Bot API base. Not a secret.
  SHOPPER_TELEGRAM_API_BASE: 'SHOPPER_TELEGRAM_API_BASE',
});

/** The env names that hold a SECRET. Anything listed here must never be logged. */
export const SHOPPER_BOT_SECRET_KEYS = Object.freeze([SHOPPER_BOT_ENV.SHOPPER_BOT_TOKEN]);

/**
 * Mask a bot token for any diagnostic. Keeps only the public-ish numeric bot-id
 * prefix; the secret body never survives. Mirrors shopperIntake.maskToken so the
 * two halves of the bot mask identically.
 */
export function maskToken(token) {
  if (typeof token !== 'string' || token.length === 0) return '(unset)';
  const colon = token.indexOf(':');
  if (colon <= 0) return '***masked***';
  return `${token.slice(0, colon)}:***masked***`;
}

/** Replace every occurrence of the token in a diagnostic string with its mask. */
export function maskTokenIn(text, token) {
  if (typeof text !== 'string') return String(text ?? '');
  if (typeof token !== 'string' || token.length === 0) return text;
  return text.split(token).join(maskToken(token));
}

/**
 * Load the sender config from an environment map (defaults to process.env).
 * Fails closed: an absent token throws rather than starting half-configured.
 * `describe()` is a log-safe snapshot — the token is ALWAYS masked.
 */
export function loadSenderConfig(env = process.env) {
  const get = (name) => {
    const v = env[name];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const botToken = get(SHOPPER_BOT_ENV.SHOPPER_BOT_TOKEN);
  if (!botToken) {
    throw new Error(`${SHOPPER_BOT_ENV.SHOPPER_BOT_TOKEN} is required (pass it with node --env-file=<credentials file>; never on the command line)`);
  }
  const config = {
    botToken, // SECRET — never logged, never returned by describe()
    chatId: get(SHOPPER_BOT_ENV.SHOPPER_CHAT_ID),
    apiBase: get(SHOPPER_BOT_ENV.SHOPPER_TELEGRAM_API_BASE) ?? DEFAULT_API_BASE,
    describe() {
      return {
        SHOPPER_BOT_TOKEN: maskToken(botToken),
        SHOPPER_CHAT_ID: config.chatId ?? '(unset)',
        SHOPPER_TELEGRAM_API_BASE: config.apiBase,
      };
    },
  };
  return config;
}

/** PURE. Validate a rendered message before it can reach the wire. */
function assertRendered(message) {
  if (!message || typeof message !== 'object') throw new Error('sendShopperMessage: a rendered { text, reply_markup } is required');
  if (typeof message.text !== 'string' || message.text.trim().length === 0) {
    throw new Error('sendShopperMessage: rendered message has no text');
  }
  return message;
}

/**
 * The ShopperBot OUTBOUND client.
 *
 * @param {{botToken:string, fetchImpl?:Function, apiBase?:string}} opts
 */
export function createShopperSender({
  botToken,
  fetchImpl = (typeof fetch === 'function' ? fetch : undefined),
  apiBase = DEFAULT_API_BASE,
} = {}) {
  if (typeof botToken !== 'string' || botToken.length === 0) {
    throw new Error('createShopperSender: botToken required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('createShopperSender: fetchImpl required (global fetch or an injected fake)');
  }
  const apiRoot = `${apiBase}/bot${botToken}`;

  async function callApi(method, body) {
    let res;
    try {
      res = await fetchImpl(`${apiRoot}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      const raw = netErr && netErr.message ? netErr.message : String(netErr);
      throw new Error(`shopper ${method} request failed: ${maskTokenIn(raw, botToken)}`);
    }
    let parsed;
    try {
      parsed = await res.json();
    } catch (parseErr) {
      const raw = parseErr && parseErr.message ? parseErr.message : String(parseErr);
      throw new Error(`shopper ${method} returned unreadable JSON: ${maskTokenIn(raw, botToken)}`);
    }
    if (!parsed || parsed.ok !== true) {
      const desc = parsed && parsed.description ? parsed.description : `http_${res && res.status}`;
      // Telegram's own error text — masked defensively in case the URL echoes back.
      throw new Error(`shopper ${method} rejected: ${maskTokenIn(String(desc), botToken)}`);
    }
    return parsed;
  }

  return {
    /**
     * Send a rendered message (with its inline keyboard) to a chat.
     * PLAIN TEXT — no parse_mode, deliberately: see renderMessages.js.
     * @returns the Telegram Message (so the caller can remember its message_id
     *          for later correlation and in-place edits).
     */
    async sendMessage(chatId, message) {
      if (chatId === undefined || chatId === null || chatId === '') throw new Error('sendShopperMessage: chatId required');
      assertRendered(message);
      const parsed = await callApi('sendMessage', {
        chat_id: chatId,
        text: message.text,
        ...(message.reply_markup ? { reply_markup: message.reply_markup } : {}),
        disable_web_page_preview: true,
      });
      return parsed.result || {};
    },

    /**
     * Edit a message in place. This is how an answered question card stops being
     * tappable: the pipeline rewrites it to show the answer and (usually) drops
     * the keyboard, so the same question cannot be answered twice from scrollback.
     * Pass `reply_markup: { inline_keyboard: [] }` to remove the buttons.
     */
    async editMessageText(chatId, messageId, message) {
      if (chatId === undefined || chatId === null || chatId === '') throw new Error('sendShopperMessage: chatId required');
      if (messageId === undefined || messageId === null) throw new Error('sendShopperMessage: messageId required');
      assertRendered(message);
      const parsed = await callApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: message.text,
        ...(message.reply_markup ? { reply_markup: message.reply_markup } : {}),
        disable_web_page_preview: true,
      });
      return parsed.result || {};
    },

    /**
     * Acknowledge a tapped button so Telegram stops showing the spinner.
     * ALWAYS call this — including on a refusal, where `text` is the honest
     * reason. A tap that never gets answered looks to Warwick like the bot died.
     */
    async answerCallbackQuery(callbackQueryId, { text = '', showAlert = false } = {}) {
      if (!callbackQueryId) throw new Error('sendShopperMessage: callbackQueryId required');
      await callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(text ? { text: String(text).slice(0, 200) } : {}),
        show_alert: Boolean(showAlert),
      });
      return true;
    },

    /** Diagnostics only — ALWAYS masked. Never returns the real token. */
    describe() {
      return { bot: 'shopperbot', direction: 'outbound', api_base: apiBase, bot_token: maskToken(botToken) };
    },
  };
}

/**
 * Convenience: build a sender straight from the environment.
 * Reads env by NAME only — no credentials file is opened here.
 */
export function createShopperSenderFromEnv(env = process.env, { fetchImpl } = {}) {
  const config = loadSenderConfig(env);
  return {
    sender: createShopperSender({ botToken: config.botToken, fetchImpl, apiBase: config.apiBase }),
    chatId: config.chatId,
    describe: config.describe,
  };
}
