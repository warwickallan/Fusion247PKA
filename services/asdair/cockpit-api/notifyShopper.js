// =====================================================================
// BUILD-015 AsdAIr WP-B15-50 - cockpit-api/notifyShopper.js
//
// WARWICK'S PHONE BUZZES WHEN MUM SENDS HER LIST. Once, and only when
// something was actually recorded.
//
// ── FIRED BY THE REAL SUBMISSION EVENT ────────────────────────────────────
//
// This is called from httpApi.js's POST /asdair/list handler - the same code
// path Mum's SEND button reaches through the Cockpit proxy. Not a script, not a
// scheduled job, not a manual step, not anyone remembering. There is no other
// caller and there is no invocation to forget.
//
// ⛔ AND NOT INSIDE THE SHARED `receiveList` COMMAND, deliberately. Telegram
// drives that same command, so putting the send there would ping Warwick every
// time HE sent a list to his own bot. "Mum submitted" is a fact about the
// COCKPIT DOOR, which is exactly where this lives.
//
// ── WHEN IT FIRES, AND WHEN IT MUST NOT ───────────────────────────────────
//
//   created: true                      -> a shop was created from her list
//   created: false, recorded_new: true -> today's shop already existed, and
//                                         what she changed IS durably recorded
//   created: false, recorded_new:false -> NOTHING was written. NO MESSAGE.
//
// The third row is a real requirement, not an optimisation: a no-op ping
// teaches Warwick to ignore the channel, and an ignored alert is worse than no
// alert.
//
// ── ⛔ WHY THE MESSAGE CARRIES HER WORDS ──────────────────────────────────
//
// On the middle row the page tells her "I've told Warwick what you changed".
// That promise had NOTHING BEHIND IT: `raw_*` is excluded from shopStore's
// UPDATE allowlist, so the shop's evidence text still belongs to her FIRST
// submission, and the command row's payload carries a content HASH, not her
// words. Nothing anywhere durably records what she typed the second time.
//
// So THIS MESSAGE IS THE ONLY SURVIVING CARRIER of it, and it carries her lines
// verbatim. Without that, the page promises Warwick was told and tells him
// nothing of the sort - the same defect as a page claiming a list was sent when
// it was not, one layer up.
//
// Her shopping is NOT private - ruled three times - so nothing here is hedged,
// abbreviated or redacted to protect something that does not need protecting.
//
// ── ⛔ IT NEVER MESSAGES MUM. MECHANICALLY, NOT BY INTENTION ──────────────
//
// The destination is SHOPPER_CHAT_ID and nothing else. This module takes NO
// chat argument: there is no parameter for a caller to pass one, so no field of
// her request can reach the destination even if a future edit forwarded the
// whole body. notifyShopper.test.js asserts that by trying it.
//
// It never polls: it calls the outbound sender's sendMessage and nothing else.
//
// ── ⛔ A FAILED NOTIFICATION NEVER FAILS HER SUBMISSION ───────────────────
//
// Her list is durable the moment `receiveList` returns. A Telegram outage must
// not turn a saved shop into an error on her screen. So this function NEVER
// throws and NEVER rejects - every failure comes back as a value.
//
// But it is never silent either: every failure is logged loudly as one
// structured line AND reported to the caller, which puts it on the response.
//
// ── SECRET HYGIENE ───────────────────────────────────────────────────────
//
// The token is CONSUMED BY NAME, never read. `loadSenderConfig` (in the bot
// module, which is hermetic by design) takes the environment map and pulls
// SHOPPER_BOT_TOKEN out of it. This file never reads, prints, logs, returns or
// copies that value, and no diagnostic here can contain it - the config's own
// describe() masks it and is not called on any path below.
//
// PURE ASCII.
// =====================================================================

'use strict';

// The bot package is ESM ("type": "module"); this one is CommonJS. Node 22.12+
// supports require(esm), and commandSurface.js already relies on exactly this to
// load the ESM pipeline - so this is the established route on this service, not
// a new mechanism. Verified by execution on Node v22.18.0.
const shopperBot = require('../bot/sendShopperMessage.js');

/**
 * ⛔ THE BUDGET. Her SEND button waits for this, so it is bounded and small.
 *
 * The response cannot report whether Warwick was told unless it waits for the
 * answer - and "must not be silent" plus "must not fail her submission" can only
 * both hold if the wait is bounded. Five seconds against her page's own 15 s
 * client timeout leaves two thirds of the budget for the write that matters.
 */
const NOTIFY_TIMEOUT_MS = 5000;

/** Telegram's own hard limit is 4096 characters. Stay well inside it. */
const MAX_MESSAGE_CHARS = 3500;
/** Beyond this many lines the message summarises rather than scrolls. */
const MAX_RENDERED_LINES = 60;

const WHO = 'Mum';

/**
 * PURE. Should this outcome produce a message at all?
 *
 * Reads the two booleans the route already computed from the store's own
 * report. It never re-derives them, because two derivations of one fact is how
 * the page and the notification would come to disagree about whether Warwick
 * was told.
 */
function shouldNotify(outcome) {
  const o = outcome || {};
  return o.created === true || o.recorded_new === true;
}

/** PURE. One line per thing she sent, capped so a malformed client cannot spend the wire. */
function renderLines(rawText) {
  const text = typeof rawText === 'string' ? rawText : '';
  if (text.trim() === '') return '';
  const lines = text.split('\n');
  if (lines.length <= MAX_RENDERED_LINES) return lines.join('\n');
  return lines.slice(0, MAX_RENDERED_LINES).join('\n')
    + '\n... and ' + (lines.length - MAX_RENDERED_LINES) + ' more lines';
}

/**
 * PURE. The message itself.
 *
 * @param {{created:boolean, recorded_new:boolean, shop_ref:*, items:*, extras:*,
 *          extraWords:*, rawText:*, clock:*}} outcome
 *
 * Plain text, no parse_mode - the same decision renderMessages.js documents: a
 * shopping list full of brackets and apostrophes is a minefield for Markdown,
 * and an escaping bug would mangle the one thing this message exists to carry.
 */
function renderShopperNotification(outcome) {
  const o = outcome || {};
  const created = o.created === true;
  const ref = o.shop_ref === undefined || o.shop_ref === null || o.shop_ref === ''
    ? '(no shop reference)' : String(o.shop_ref);
  const items = Number.isFinite(Number(o.items)) ? Number(o.items) : 0;
  const extras = Number.isFinite(Number(o.extras)) ? Number(o.extras) : 0;

  const head = created
    ? WHO + ' sent this week\'s shopping list.'
    : WHO + ' re-sent her list, and it changed.';

  const what = created
    ? 'A new shop was created from it: ' + ref
    // ⛔ THE HONEST SENTENCE. Her page says today's list has already gone and
    // that Warwick has been told what she changed. Both halves are true, and
    // this is the half that makes the second one true.
    : 'Today\'s shop ' + ref + ' already existed, so this does NOT change it. '
      + 'Nothing else records what she sent, so it is below.';

  // ⛔ THE TYPED ONES ARE IN ADDITION TO THE TAPPED ONES, NOT A SUBSET.
  // `items` counts what she tapped; `extras` counts what she typed. An earlier
  // draft read "1 item, 1 of them typed", which stated a falsehood about a
  // two-line list - and the count in this message is the only count Warwick
  // gets on the row where nothing else records what she sent.
  const counts = items + (items === 1 ? ' tapped item' : ' tapped items')
    + (extras > 0 ? ', plus ' + extras + (extras === 1 ? ' she typed' : ' she typed') : '');

  const parts = [head, what, counts];

  // The clock disagreement, for Warwick and only for Warwick. She is never told
  // and was never blocked; this is the only place it surfaces to a human.
  const clock = o.clock && typeof o.clock === 'object' ? o.clock : null;
  if (clock && clock.agrees === false) {
    parts.push('NOTE: her tablet said the date was ' + String(clock.claimed)
      + ', but the shop was recorded as ' + String(clock.recorded) + '.');
  }

  // ⭐ WARWICK, 2026-08-14, after the FIRST REAL SUBMISSION, and it is the whole
  // reason this block exists: "there should be a little header or section in the
  // telegram message that says new items and then lists any she has manually
  // added so they are easy to see."
  //
  // WHY IT MATTERS MORE THAN IT LOOKS. On the recorded-not-created row this
  // message is the ONLY place her typed words survive - `raw_*` is excluded from
  // shopStore's UPDATE allowlist, so nothing downstream carries them. Warwick
  // read a 32-line list, did not spot the one line that was new, and told Larry
  // "bacon added" when it was not in the shop at all. The information was
  // present and invisible, which for this message is the same as absent.
  //
  // It goes FIRST, above the full list, because that is where the eye lands.
  const extraWords = Array.isArray(o.extraWords)
    ? o.extraWords.map(function (x) { return typeof x === 'string' ? x.trim() : ''; }).filter(Boolean)
    : [];
  if (extraWords.length > 0) {
    parts.push('', 'NEW ITEMS');
    extraWords.slice(0, MAX_RENDERED_LINES).forEach(function (w) { parts.push('  * ' + w); });
    if (extraWords.length > MAX_RENDERED_LINES) {
      parts.push('  ... and ' + (extraWords.length - MAX_RENDERED_LINES) + ' more');
    }
  }

  const lines = renderLines(o.rawText);
  if (lines !== '') {
    // The list is only LABELLED when there is something above it to distinguish it
    // from. On its own it needs no heading, and an unconditional one would leave a
    // stray blank line above the list on every ordinary submission.
    if (extraWords.length > 0) parts.push('', 'HER WHOLE LIST:');
    else parts.push('');
    parts.push(lines);
  }

  const text = parts.join('\n');
  return { text: text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) + '\n...' : text };
}

/**
 * A rejection that resolves instead - the bounded wait, without an unhandled rejection.
 *
 * ⛔ THE TIMER IS NOT `unref`d, AND THAT IS THE WHOLE POINT. An unref'd timer
 * does not hold the event loop open, so in a quiet process the loop drains, the
 * timeout never fires, and a hung Telegram leaves this awaiting a promise that
 * can never settle - which is an unbounded wait wearing a bounded one's
 * clothes, on the path Mum's SEND button is waiting on. Caught by the hanging-
 * Telegram test below, which failed with "the event loop has already resolved"
 * until this was removed. Keeping the loop alive for at most `ms` is the cost
 * of the guarantee.
 */
function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timedOut: true }), ms);
  });
  return Promise.race([
    Promise.resolve(promise).then(
      (value) => ({ value: value }),
      (error) => ({ error: error })
    ),
    timeout
  ]).then((r) => { if (timer) clearTimeout(timer); return r; });
}

/**
 * ONE structured line, loud, on the service's error stream.
 *
 * A failure that is only reported in an HTTP response nobody reads is a silent
 * failure. This is the half that survives after the request is over.
 *
 * It carries no credential and cannot: the only strings interpolated are a
 * machine code, a shop reference, and a message the bot module has already
 * passed through maskTokenIn().
 */
function logNotifyFailure(code, detail, outcome) {
  const o = outcome || {};
  try {
    console.error('[asdair-cockpit-api] SHOPPER NOTIFICATION FAILED ' + JSON.stringify({
      event: 'shopper_notify_failed',
      error: code,
      detail: typeof detail === 'string' ? detail.slice(0, 400) : String(detail),
      shop_ref: o.shop_ref === undefined ? null : o.shop_ref,
      created: o.created === true,
      recorded_new: o.recorded_new === true,
      consequence: 'Her list IS saved. Warwick was NOT told.',
      at: new Date().toISOString()
    }));
  } catch (ignore) {
    // Logging must never be the thing that breaks the request.
  }
}

/**
 * Build the real sender from the environment, BY NAME.
 *
 * Fails with a coded, credential-free error when the configuration is not
 * there. SHOPPER_CHAT_ID is checked HERE rather than left to fail at send time:
 * `loadSenderConfig` returns a null chatId perfectly happily, and a notifier
 * that only discovers it has no destination at the moment it needs one is the
 * silent-failure shape this estate forbids.
 */
function senderFromEnv(env, fetchImpl) {
  const built = shopperBot.createShopperSenderFromEnv(env || process.env, { fetchImpl: fetchImpl });
  if (!built.chatId) {
    const e = new Error('SHOPPER_CHAT_ID is not set, so there is no chat to notify');
    e.code = 'notify_not_configured';
    throw e;
  }
  return { sender: built.sender, chatId: built.chatId };
}

/**
 * ⛔ SEND THE NOTIFICATION. NEVER THROWS. NEVER REJECTS.
 *
 * @param {object} outcome  what the submission actually did - created,
 *                          recorded_new, shop_ref, items, extras, extraWords, rawText, clock
 * @param {{sender?:object, chatId?:*, env?:object, fetchImpl?:Function,
 *          timeoutMs?:number, log?:Function}} [deps]
 * @returns {Promise<{attempted:boolean, notified:boolean, error:string|null}>}
 *
 * ⛔ THERE IS NO chatId PARAMETER ON THE OUTCOME, AND THAT IS THE CONTROL.
 * `deps.chatId` exists only so a test can inject one. In production the
 * destination comes from SHOPPER_CHAT_ID via senderFromEnv, and nothing that
 * arrives in an HTTP body can reach it.
 */
async function notifySubmission(outcome, deps) {
  const d = deps || {};
  const log = typeof d.log === 'function' ? d.log : logNotifyFailure;

  if (!shouldNotify(outcome)) {
    // The zero case. Not an error, not a skip to explain - simply nothing
    // happened, so nobody is told.
    return { attempted: false, notified: false, error: null };
  }

  let sender = d.sender || null;
  let chatId = d.chatId === undefined ? null : d.chatId;

  if (!sender) {
    try {
      const built = senderFromEnv(d.env, d.fetchImpl);
      sender = built.sender;
      chatId = built.chatId;
    } catch (err) {
      const code = (err && err.code) || 'notify_not_configured';
      log(code, (err && err.message) || String(err), outcome);
      return { attempted: true, notified: false, error: code };
    }
  }

  if (chatId === null || chatId === undefined || chatId === '') {
    log('notify_not_configured', 'no chat id was available', outcome);
    return { attempted: true, notified: false, error: 'notify_not_configured' };
  }

  const message = renderShopperNotification(outcome);
  const budget = Number.isFinite(Number(d.timeoutMs)) ? Number(d.timeoutMs) : NOTIFY_TIMEOUT_MS;

  let raced;
  try {
    raced = await withTimeout(sender.sendMessage(chatId, message), budget);
  } catch (err) {
    // sendMessage throwing SYNCHRONOUSLY would escape the race. Belt and
    // braces: this function's whole contract is that it cannot throw.
    log('notify_failed', (err && err.message) || String(err), outcome);
    return { attempted: true, notified: false, error: 'notify_failed' };
  }

  if (raced && raced.__timedOut) {
    log('notify_timeout', 'no answer from Telegram within ' + budget + 'ms', outcome);
    return { attempted: true, notified: false, error: 'notify_timeout' };
  }
  if (raced && raced.error) {
    const err = raced.error;
    log('notify_failed', (err && err.message) || String(err), outcome);
    return { attempted: true, notified: false, error: 'notify_failed' };
  }
  return { attempted: true, notified: true, error: null };
}

module.exports = {
  notifySubmission: notifySubmission,
  shouldNotify: shouldNotify,
  renderShopperNotification: renderShopperNotification,
  NOTIFY_TIMEOUT_MS: NOTIFY_TIMEOUT_MS,
  MAX_MESSAGE_CHARS: MAX_MESSAGE_CHARS,
  MAX_RENDERED_LINES: MAX_RENDERED_LINES,
  _internal: {
    renderLines: renderLines,
    senderFromEnv: senderFromEnv,
    withTimeout: withTimeout,
    logNotifyFailure: logNotifyFailure
  }
};
