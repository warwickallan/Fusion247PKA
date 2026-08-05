// Fusion247 Cockpit — "why is this service not answering", in words.
//
// WHY IT IS ITS OWN MODULE. It used to live in server.mjs, which imports db.mjs, which opens a live
// write pool the moment it loads — so nothing could import it and nothing could execute it. That is
// the same trap static.mjs was extracted from, and the rule it established applies here: **if a line
// is load-bearing, put it somewhere a test can RUN it.** A regex over source is a description of
// code, not evidence about it.
//
// ── THE DEFECT THIS FILE WAS EXTRACTED TO FIX ────────────────────────────────────────────────────
// node's fetch buries the real reason under a generic TypeError, and "TypeError" tells Warwick
// nothing. The old resolver read `e.cause?.code || e.code || e.name`.
//
// **A fetch timeout throws a DOMException, and DOMException carries a LEGACY NUMERIC `code`**
// (`TIMEOUT_ERR = 23`, `ABORT_ERR = 20`). That number is truthy, so `e.name` was never reached for
// exactly the two cases the map named — the `TimeoutError` and `AbortError` entries were unreachable
// dead code from the day they were written.
//
// It was live on Warwick's phone on 2026-08-04:
//     "AsdAIr's read service is not answering on 127.0.0.1:8710 — 23."
// while the service was answering perfectly. A bare "23" is not a reason, and the app read as DOWN
// when it was UP — a lying red, which costs trust just as fast as a lying green.
//
// Proven by execution rather than inferred:
//     name= TimeoutError | legacy e.code= 23 | cause= undefined | whyDown -> "23"
//
// ORDER IS THEREFORE LOAD-BEARING: named DOM errors first, then `e.cause.code` (where node hides the
// real socket error), then a string `e.code`, and a raw value only as a last resort — never a bare
// number. `down-reason-check.mjs` executes every branch, including the two that were dead.

/** Reason strings, keyed by either an error name or a socket/undici code. */
export const DOWN_REASONS = Object.freeze({
  ECONNREFUSED: 'nothing is listening there',
  ENOTFOUND: 'that address does not resolve',
  EHOSTUNREACH: 'that host is unreachable',
  ENETUNREACH: 'that network is unreachable',
  ECONNRESET: 'the connection was reset',
  EPIPE: 'the connection closed early',
  UND_ERR_CONNECT_TIMEOUT: 'it did not answer in time',
  TimeoutError: 'it did not answer in time',
  AbortError: 'it did not answer in time',
});

/**
 * @param {unknown} e An error from `fetch`, or anything at all.
 * @returns {string} A phrase that completes "… — <this>."
 */
export function whyDown(e) {
  if (!e || typeof e !== 'object') return 'unreachable';
  const err = /** @type {any} */ (e);
  // 1. The error's NAME. MUST come first — see the DOMException note above.
  if (err.name && DOWN_REASONS[err.name]) return DOWN_REASONS[err.name];
  // 2. The underlying cause's code, where node hides the real socket error.
  const causeCode = err.cause && err.cause.code;
  if (typeof causeCode === 'string' && DOWN_REASONS[causeCode]) return DOWN_REASONS[causeCode];
  // 3. The error's own string code.
  if (typeof err.code === 'string' && DOWN_REASONS[err.code]) return DOWN_REASONS[err.code];
  // 4. Nothing recognised. Prefer a STRING code; never surface a bare legacy number — a number here
  //    is always the DOMException legacy field, and "23" is not something a human can act on.
  if (typeof causeCode === 'string' && causeCode) return causeCode;
  if (typeof err.code === 'string' && err.code) return err.code;
  if (err.name) return String(err.name);
  return 'unreachable';
}
