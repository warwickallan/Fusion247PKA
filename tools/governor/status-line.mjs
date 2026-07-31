// Compact status-line renderer (BUILD-018 T-05)
//
// AD-11 purity split, matching model-gate.mjs's (T-15) precedent exactly: a pure
// renderer (verdict object in, string out) plus exactly one impure composition
// function.
//
// `renderStatusLine` is pure — zero filesystem, git, or myPKA-estate imports. It does
// not know `evaluate()` exists; it only knows the verdict SHAPE `evaluate()` returns
// (`{ state, exitCode, reasons, unknownSignals, examinedSignals, advice }`, per
// evaluator.mjs). That is what makes it independently unit-testable with a hand-built
// verdict object without ever calling `evaluate()` (AC3), and portable alongside the
// evaluator core to Project ManagAIr later (F-8) without dragging this module's
// concerns with it.
//
// `computeStatusLine` is the one impure composition function: it calls `evaluate()`
// (or an injected stand-in — mirrors model-gate.mjs's `readSample = readHealthSample`
// default-parameter pattern, needed here because the real `evaluate()` is proven total
// over its documented domain by T-04's own 64-combination sweep and so cannot be made
// to throw without injection) inside a try/catch. A throw never reaches the caller and
// never renders anything but BLIND (AC2; INV-1: unreadable telemetry is never GREEN)
// — it is caught and turned into a synthetic BLIND-shaped verdict object, which is
// then handed to the SAME pure renderer a real verdict would be. The pure renderer's
// contract stays exactly "verdict object in, string out"; there is no error-shaped
// special case inside it (AC3).
//
// Target surface: the literal single-line Claude Code statusLine UI — one compact
// line, not model-gate.mjs's multi-line SessionStart gate banner (a different
// rendering context entirely). Wiring this renderer into the live statusLine command
// is explicitly deferred by this ticket; this module only builds and proves the
// renderer in isolation.

import { evaluate, STATE, EXIT_CODE, SIGNAL_KEYS } from './evaluator.mjs';

// ---------------------------------------------------------------------------
// Pure: a T-04 verdict object -> a single compact status-line string
// ---------------------------------------------------------------------------
// Degrades gracefully (AC4): a verdict missing `advice`, carrying an empty
// `reasons`/`unknownSignals`, or missing `unknownSignals`/`examinedSignals` entirely
// still renders without throwing. Even a non-object or nullish `verdict` renders a
// line rather than throwing, so a caller that builds this on a slightly wrong shape
// gets a visibly odd line instead of a crash.

export function renderStatusLine(verdict) {
  const v = verdict && typeof verdict === 'object' ? verdict : {};

  const state = typeof v.state === 'string' && v.state.length > 0 ? v.state : 'UNKNOWN';
  const advice = typeof v.advice === 'string' && v.advice.length > 0 ? v.advice : '(no advice available)';
  const unknownCount = Array.isArray(v.unknownSignals) ? v.unknownSignals.length : 0;
  const examinedCount =
    typeof v.examinedSignals === 'number' && Number.isFinite(v.examinedSignals) ? v.examinedSignals : 0;

  const unknownSuffix =
    unknownCount > 0
      ? ` [${unknownCount}/${examinedCount || unknownCount} signal${unknownCount === 1 ? '' : 's'} unknown]`
      : '';

  return `GOVERNOR ${state} — ${advice}${unknownSuffix}`;
}

// ---------------------------------------------------------------------------
// Impure: compose evaluate(signals) with the pure renderer, defensively
// ---------------------------------------------------------------------------

// A synthetic BLIND-shaped verdict, built to the exact same shape `evaluate()`
// returns, so it can be handed to `renderStatusLine` exactly like a real one. Kept
// unexported: it is an implementation detail of the defensive catch, not part of this
// module's public contract.
function blindVerdictFromThrow(err) {
  const message = err && typeof err === 'object' && typeof err.message === 'string' ? err.message : String(err);
  return {
    state: STATE.BLIND,
    exitCode: EXIT_CODE[STATE.BLIND],
    reasons: [`evaluate() threw and could not produce a verdict: ${message}`],
    unknownSignals: [...SIGNAL_KEYS],
    examinedSignals: 0,
    advice: 'telemetry unreadable — treat as at least AMBER; say so loudly, never report GREEN.',
  };
}

/**
 * computeStatusLine(signals, opts?) -> string
 *
 * The one impure composition function. Calls `evaluateFn(signals)` (defaults to the
 * real `evaluate` from evaluator.mjs) and renders the result. If `evaluateFn` throws
 * for any reason, the throw is caught here — never propagated to the caller — and a
 * BLIND line is rendered instead (AC2).
 *
 * `evaluateFn` is injectable purely so a test can force the throw path against the
 * real evaluator's contract without monkey-patching an ES module's named export.
 */
export function computeStatusLine(signals, { evaluateFn = evaluate } = {}) {
  let verdict;
  try {
    verdict = evaluateFn(signals);
  } catch (err) {
    verdict = blindVerdictFromThrow(err);
  }
  return renderStatusLine(verdict);
}
