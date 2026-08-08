// =====================================================================
// BUILD-015 AsdAIr — bot: callbackProtocol.js
//
// THE WIRE FORMAT. One module owns the exact bytes that travel on an inline
// button, and BOTH halves of the control surface import it:
//   * renderMessages.js  builds every button through buildCallbackData()
//   * inboundRouter.js   reads every tap through parseCallbackData()
// so the outbound and inbound halves cannot drift apart. This mirrors
// services/hub/decision/telegramInbound.mjs, which keeps `decision:<card_id>:
// <choiceKey>` in one place for exactly the same reason.
//
// ── THE 64-BYTE CEILING ──────────────────────────────────────────────────────
// Telegram hard-limits InlineKeyboardButton.callback_data to 1-64 BYTES. A
// longer value is rejected by the Bot API (or, worse, silently mangled by an
// intermediary), which would produce a button that answers the wrong question.
//
// This module makes an over-long callback IMPOSSIBLE rather than unlikely:
//   1. It NEVER truncates. There is no code path that shortens a value.
//   2. Every field has a declared, enforced byte budget, and the budgets are
//      chosen so that the WORST legal combination lands on exactly 64 bytes:
//
//        "asd"            3   namespace
//        ":"              1
//        <action>        10   the longest member of ACTIONS ("exceptions")
//        ":"              1
//        <shopRef>       32   MAX_SHOP_REF_BYTES
//        ":"              1
//        <arg>           16   MAX_ARG_BYTES
//                       ---
//                        64   = CALLBACK_DATA_MAX_BYTES
//
//   3. Every field is restricted to an ASCII charset, so byte length ==
//      character length and no multi-byte surprise can blow the budget.
//   4. A final assertion re-measures the assembled string with
//      Buffer.byteLength() and throws if it is over. That line is unreachable
//      given (2) and (3) — it is a deliberate belt-and-braces invariant that a
//      future edit to ACTIONS or a budget cannot quietly defeat.
//   5. parseCallbackData() rejects anything over the ceiling too, so a forged
//      or corrupted inbound payload is refused rather than half-read.
//
// FAIL CLOSED, LOUDLY. buildCallbackData() THROWS on an over-long shop ref
// instead of trimming it. A thrown render is a visible bug for Larry to fix by
// supplying a compact ref; a trimmed ref is an invisible bug that answers the
// wrong shop. Callers must keep shop refs inside MAX_SHOP_REF_BYTES.
//
// PURE. No I/O, no clock, no randomness, no database.
// =====================================================================

/** Namespace for EVERY AsdAIr callback. Keeps this protocol disjoint from the
 *  hub's `decision:` protocol so neither router can ever claim the other's taps. */
export const CALLBACK_NAMESPACE = 'asd';

/** Telegram's hard limit on InlineKeyboardButton.callback_data. */
export const CALLBACK_DATA_MAX_BYTES = 64;

/** Field separator. Not legal inside any field charset (see FIELD_RE). */
export const CALLBACK_SEPARATOR = ':';

/**
 * Every action the control surface can emit. Frozen: parseCallbackData refuses
 * anything not listed here, so an unknown/forged action never reaches a handler.
 *
 * The longest member is what sizes the byte budget — see the table above. If a
 * longer action is ever added, MAX_SHOP_REF_BYTES/MAX_ARG_BYTES must shrink to
 * match, and the budget test in callbackProtocol.test.js will fail until they do.
 */
export const ACTIONS = Object.freeze({
  BUILD: 'build',           // Build this shop
  REVIEW: 'review',         // Review list
  CANCEL: 'cancel',         // Cancel
  // ANSWER carries an arg on a question card (arg = <questionKey>.<candidateIndex>,
  // i.e. "this exact choice") and NO arg on the plan-ready card ("open the
  // question queue"). Presence of the arg is what distinguishes the two, which is
  // why parseCallbackData always reports `arg: null` explicitly rather than
  // omitting the field — a handler must be able to tell them apart.
  ANSWER: 'answer',
  SEARCH: 'search',         // Search ASDA for this question (arg = <questionKey>)
  SKIP: 'skip',             // Skip this week (arg = <questionKey>)
  BASKET: 'basket',         // Build ASDA basket
  STATUS: 'status',         // View status
  HELD: 'held',             // View held items
  PAUSE: 'pause',           // Pause
  EXCEPTIONS: 'exceptions', // View exceptions
  CLOSE: 'close',           // Close shop
  RETRY: 'retry',           // Retry the failed step
  CONFIRM: 'confirm',       // Send order confirmation (Warwick forwards the ASDA email)
  // APPROVE is the interpretation-confirmation gate's deliberate act ("Confirm
  // this reading" on the confirmation card -> confirmInterpretation). It is
  // DELIBERATELY NOT `confirm`: that name is already the reconcile-stage
  // order-email prompt above, and one tap word carrying two meanings is the
  // exact ambiguity the "a glance is not an approval" design exists to prevent.
  // 7 bytes, so `exceptions` (10) still sizes the budget and nothing shrinks.
  APPROVE: 'approve',       // Confirm this reading (interpretation gate)
});

/** The action names as a lookup set, for O(1) validation. */
export const ACTION_VALUES = Object.freeze(Object.values(ACTIONS));
const ACTION_SET = new Set(ACTION_VALUES);

/** Longest action name, in bytes. Drives the budget arithmetic. */
export const MAX_ACTION_BYTES = ACTION_VALUES.reduce((m, a) => Math.max(m, a.length), 0);

/**
 * Field charset: ASCII alphanumerics plus `. _ -`. Deliberately excludes the
 * separator `:`, so a field can never fake an extra field, and excludes every
 * non-ASCII codepoint, so byte length == character length.
 */
export const FIELD_RE = /^[A-Za-z0-9._-]+$/;

/** Per-field byte budgets. Sum + separators + namespace == exactly 64. */
export const MAX_SHOP_REF_BYTES = 32;
export const MAX_ARG_BYTES = 16;

/**
 * A question key must leave room for `.<candidateIndex>` inside MAX_ARG_BYTES:
 * 12 + 1 + up to 3 digits = 16.
 */
export const MAX_QUESTION_KEY_BYTES = 12;
export const MAX_CANDIDATE_INDEX = 999;

// Compile-time-ish proof that the budgets are self-consistent. If someone widens
// a budget or adds a longer action without re-doing the arithmetic, the module
// refuses to load rather than shipping a silently over-long button.
const BUDGET_TOTAL =
  CALLBACK_NAMESPACE.length + 1 + MAX_ACTION_BYTES + 1 + MAX_SHOP_REF_BYTES + 1 + MAX_ARG_BYTES;
if (BUDGET_TOTAL > CALLBACK_DATA_MAX_BYTES) {
  throw new Error(
    `callbackProtocol budgets are inconsistent: worst case ${BUDGET_TOTAL}B exceeds the ${CALLBACK_DATA_MAX_BYTES}B Telegram limit`,
  );
}
/** The worst legal payload size, in bytes. Exported so the tests can assert it. */
export const WORST_CASE_BYTES = BUDGET_TOTAL;

/** PURE. Byte length of a string as Telegram measures it (UTF-8). */
export function byteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function assertField(label, value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`callback ${label} required (non-empty string)`);
  }
  if (!FIELD_RE.test(value)) {
    throw new Error(`callback ${label} "${value}" must match ${FIELD_RE} (ASCII letters, digits, . _ - only)`);
  }
  const bytes = byteLength(value);
  if (bytes > maxBytes) {
    // NEVER truncate — see the module header. Fail closed so the caller supplies
    // a compact ref rather than shipping a button that answers the wrong shop.
    throw new Error(
      `callback ${label} "${value}" is ${bytes}B; the limit is ${maxBytes}B (Telegram caps callback_data at ${CALLBACK_DATA_MAX_BYTES}B and this protocol never truncates)`,
    );
  }
  return value;
}

/** PURE. True when `shopRef` is usable on a button. Lets a caller check before rendering. */
export function isValidShopRef(shopRef) {
  return typeof shopRef === 'string'
    && shopRef.length > 0
    && FIELD_RE.test(shopRef)
    && byteLength(shopRef) <= MAX_SHOP_REF_BYTES;
}

/** PURE. Throws with an actionable message when a shop ref cannot ride a button. */
export function assertShopRef(shopRef) {
  return assertField('shopRef', shopRef, MAX_SHOP_REF_BYTES);
}

/** PURE. True when `action` is a member of ACTIONS. */
export function isValidAction(action) {
  return typeof action === 'string' && ACTION_SET.has(action);
}

/**
 * PURE. Build the callback_data for one button.
 *
 * @param {{action:string, shopRef:string, arg?:string|null}} spec
 * @returns {string} `asd:<action>:<shopRef>` or `asd:<action>:<shopRef>:<arg>`
 * @throws on an unknown action, an ill-shaped field, or any budget breach.
 */
export function buildCallbackData({ action, shopRef, arg = null } = {}) {
  if (!isValidAction(action)) {
    throw new Error(`callback action "${action}" is not one of: ${ACTION_VALUES.join(', ')}`);
  }
  assertField('shopRef', shopRef, MAX_SHOP_REF_BYTES);
  const parts = [CALLBACK_NAMESPACE, action, shopRef];
  if (arg !== null && arg !== undefined && arg !== '') {
    assertField('arg', arg, MAX_ARG_BYTES);
    parts.push(arg);
  }
  const data = parts.join(CALLBACK_SEPARATOR);
  // Belt-and-braces: unreachable given the budgets above, and kept precisely so
  // a future edit to ACTIONS or a budget cannot quietly ship an over-long button.
  const bytes = byteLength(data);
  if (bytes > CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`callback_data would be ${bytes}B, over Telegram's ${CALLBACK_DATA_MAX_BYTES}B limit: refusing to truncate`);
  }
  return data;
}

/**
 * PURE. Parse an inbound callback_data payload.
 *
 * Refuses (never guesses) on: a foreign namespace, an unknown action, a missing
 * field, an over-long payload, a bad charset, or extra fields. The caller gets a
 * structured `{ ok:false, reason }` and can answer the tap with a visible refusal.
 *
 * @returns {{ok:true, action:string, shopRef:string, arg:string|null}|{ok:false, reason:string}}
 */
export function parseCallbackData(data) {
  if (typeof data !== 'string' || data.length === 0) {
    return { ok: false, reason: 'empty callback_data' };
  }
  if (byteLength(data) > CALLBACK_DATA_MAX_BYTES) {
    return { ok: false, reason: `callback_data exceeds ${CALLBACK_DATA_MAX_BYTES} bytes` };
  }
  const parts = data.split(CALLBACK_SEPARATOR);
  if (parts[0] !== CALLBACK_NAMESPACE) {
    return { ok: false, reason: 'not an asdair callback' };
  }
  if (parts.length < 3 || parts.length > 4) {
    return { ok: false, reason: 'malformed asdair callback_data' };
  }
  const [, action, shopRef, rawArg] = parts;
  if (!isValidAction(action)) return { ok: false, reason: `unknown asdair action "${action}"` };
  if (!shopRef || !FIELD_RE.test(shopRef) || byteLength(shopRef) > MAX_SHOP_REF_BYTES) {
    return { ok: false, reason: 'malformed asdair shopRef' };
  }
  let arg = null;
  if (parts.length === 4) {
    if (!rawArg || !FIELD_RE.test(rawArg) || byteLength(rawArg) > MAX_ARG_BYTES) {
      return { ok: false, reason: 'malformed asdair arg' };
    }
    arg = rawArg;
  }
  return { ok: true, action, shopRef, arg };
}

/**
 * PURE. Build the `answer` arg for candidate #index of a question.
 *
 * The INDEX travels, not the product id: an ASDA product id is unbounded, an
 * index is one to three digits, and that is what keeps the budget provable. The
 * caller MUST persist the candidate list against `questionKey` in the same order
 * it rendered, so the index resolves back to the product. (The router does not
 * resolve it — routing is not deciding.)
 */
export function buildAnswerArg(questionKey, candidateIndex) {
  assertField('questionKey', questionKey, MAX_QUESTION_KEY_BYTES);
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex > MAX_CANDIDATE_INDEX) {
    throw new Error(`candidateIndex must be an integer 0..${MAX_CANDIDATE_INDEX}, got ${candidateIndex}`);
  }
  return `${questionKey}.${candidateIndex}`;
}

/**
 * PURE. Inverse of buildAnswerArg.
 * @returns {{ok:true, questionKey:string, candidateIndex:number}|{ok:false, reason:string}}
 */
export function parseAnswerArg(arg) {
  if (typeof arg !== 'string' || arg.length === 0) return { ok: false, reason: 'empty answer arg' };
  const dot = arg.lastIndexOf('.');
  if (dot <= 0 || dot === arg.length - 1) return { ok: false, reason: 'malformed answer arg' };
  const questionKey = arg.slice(0, dot);
  const rawIndex = arg.slice(dot + 1);
  if (!/^\d{1,3}$/.test(rawIndex)) return { ok: false, reason: 'malformed answer arg' };
  if (!FIELD_RE.test(questionKey) || byteLength(questionKey) > MAX_QUESTION_KEY_BYTES) {
    return { ok: false, reason: 'malformed answer arg' };
  }
  return { ok: true, questionKey, candidateIndex: Number(rawIndex) };
}

/** PURE. Throws unless `questionKey` fits the arg budget. Used by the question renderer. */
export function assertQuestionKey(questionKey) {
  return assertField('questionKey', questionKey, MAX_QUESTION_KEY_BYTES);
}
