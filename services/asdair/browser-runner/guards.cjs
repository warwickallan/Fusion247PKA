// =====================================================================
// BUILD-015 AsdAIr browser runner - THE REFUSAL LAYER.
//
// THIS IS THE ONLY FILE IN THE FOLDER PERMITTED TO NAME THE FORBIDDEN THINGS,
// and it names them solely in order to refuse them. Everywhere else, the words
// below must not appear in executable code at all - `forbidden.test.cjs`
// enforces exactly that, scanning every other source file with comments
// stripped and failing the suite if one shows up.
//
// Concentrating the vocabulary here means a reviewer has ONE file to read to
// satisfy themselves that the runner cannot check out, cannot pay, cannot book
// or change a delivery slot, cannot enter credentials, cannot change payment
// details, cannot enable substitutions and cannot accept a substitute.
//
// Three gates, each independently sufficient:
//   1. URL ALLOWLIST  - navigation is a closed set of exact patterns. There is
//                       no reachable URL for any forbidden surface.
//   2. TARGET DENY    - every click is checked against the deny vocabulary
//                       first, so even a mislabelled or moved control on a
//                       permitted page cannot be clicked by accident.
//   3. NO TYPING      - the runner issues no CDP `Input.` method, ever. A
//                       process that cannot synthesise a keystroke cannot fill
//                       a credential field or a card field, and cannot set a
//                       quantity by typing (typed quantities do not persist
//                       server-side - SOP-021's costliest lesson).
// =====================================================================
'use strict';

/** Every URL the runner is allowed to open. Anything else is refused. */
const PERMITTED_URLS = Object.freeze([
  /^https:\/\/www\.asda\.com\/?$/,
  /^https:\/\/www\.asda\.com\/groceries\/?$/,
  /^https:\/\/www\.asda\.com\/groceries\/trolley\/?$/,
  /^https:\/\/www\.asda\.com\/groceries\/product\/[A-Za-z0-9%\-_/]+\/?$/,
  /^https:\/\/www\.asda\.com\/groceries\/search\/[A-Za-z0-9%\-_.'&+]+$/,
  /^https:\/\/www\.asda\.com\/groceries\/favourites-lists\/regulars\/?$/,
]);

/**
 * Vocabulary the runner refuses to click, whatever page it appears on.
 * Deliberately broad: false refusals are cheap, a wrong click is not.
 */
const DENY_TARGET = new RegExp([
  'check\\s*-?\\s*out',
  'proceed to (pay|check)',
  'place (my |your )?order',
  'pay\\b', 'payment', 'card details', 'card number', 'cvv', 'billing',
  'password', 'passcode', 'sign\\s*in', 'log\\s*in',
  'book (a )?(delivery|collection)?\\s*slot', 'change slot', 'delivery slot', 'reserve slot',
  'substitut',
  'accept (this )?(replacement|alternative)',
].join('|'), 'i');

/** The same vocabulary as bare tokens, for the source scan in forbidden.test.cjs. */
const FORBIDDEN_TOKENS = Object.freeze([
  'checkout', 'check out', 'payment', 'card number', 'cvv',
  'password', 'passcode', 'credential',
  'delivery slot', 'book slot', 'bookslot', 'slot booking',
  'substitut', 'replacement',
]);

/** CDP domains the runner must never use. Input.* is how typing and raw pointer events happen. */
const FORBIDDEN_CDP_METHODS = Object.freeze(['Input.', 'Emulation.setDeviceMetricsOverride', 'Browser.setWindowBounds']);

class RefusedError extends Error {
  constructor(what, why) { super(`refused: ${why} (${what})`); this.name = 'RefusedError'; this.what = what; }
}

/** Gate 1. Throws unless `url` is on the navigation allowlist. */
function assertPermittedUrl(url) {
  const s = String(url || '');
  if (!PERMITTED_URLS.some((re) => re.test(s))) throw new RefusedError(s, 'URL is not on the navigation allowlist');
  return s;
}

/** Gate 2. Throws if a click target's accessible name matches the deny vocabulary. */
function assertSafeTarget(label) {
  const s = String(label == null ? '' : label);
  if (DENY_TARGET.test(s)) throw new RefusedError(s.slice(0, 120), 'click target matches the forbidden vocabulary');
  return s;
}

/** Gate 3. Throws if a CDP method is one the runner must never issue. */
function assertSafeCdpMethod(method) {
  const m = String(method || '');
  if (FORBIDDEN_CDP_METHODS.some((f) => m.startsWith(f) || m === f)) {
    throw new RefusedError(m, 'CDP method is forbidden (the runner never synthesises input)');
  }
  return m;
}

/**
 * The one JS snippet allowed to name the deny vocabulary, injected into the
 * page so the IN-PAGE click helper refuses the same set the Node side does.
 * Built from DENY_TARGET so the two can never drift apart.
 */
function inPageDenyRegexLiteral() {
  return `new RegExp(${JSON.stringify(DENY_TARGET.source)}, 'i')`;
}

/** True when the page we landed on is an authentication surface rather than the store. */
function looksLikeAuthSurface({ url = '', title = '', text = '' } = {}) {
  const u = String(url);
  if (/^https?:\/\/(login|account|accounts|id)\./i.test(u)) return true;
  if (/\/(authorise|authorize|signin|sign-in)\b/i.test(u)) return true;
  if (/sign in to (your )?asda/i.test(String(title) + ' ' + String(text).slice(0, 2000))) return true;
  return false;
}

module.exports = {
  PERMITTED_URLS, DENY_TARGET, FORBIDDEN_TOKENS, FORBIDDEN_CDP_METHODS,
  RefusedError, assertPermittedUrl, assertSafeTarget, assertSafeCdpMethod,
  inPageDenyRegexLiteral, looksLikeAuthSurface,
};
