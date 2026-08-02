// Pure health evaluator (BUILD-018 T-04): evaluate(signals) -> verdict
//
// AD-11: this core has ZERO filesystem, git or myPKA knowledge. It does not read the
// health store, does not shell out, does not know a worktree exists. Every signal it
// needs arrives as a plain value on the `signals` argument; gathering those values is
// an adapter's job (T-05/T-06/T-08/T-12), not this module's. That is what makes the
// core unit-testable without an estate and portable to Project ManagAIr later (F-8).
//
// States (map 02-MAP.md section 4): GREEN -> AMBER -> RED is the main axis; RECOVERY
// and BLIND sit off it and OUTRANK it — a session that is missing required telemetry
// or has already lost authoritative in-context state is never merely "AMBER".
// Priority when more than one condition applies: BLIND > RECOVERY > RED > AMBER > GREEN.
//
// Missing-field semantics (map section 4, explicit per the commission): an ABSENT
// signal is `unknown`, never `0`. A threshold over an unknown input does not fire; it
// is recorded as skipped. Absence alone is not BLIND — only the required signal
// (context used_percentage) being unreadable makes the verdict BLIND (INV-1).
//
// RECOVERY vs the "AMBER/RED floor" wording in section 4 (a judgement call, recorded
// here because the source text does not fully disambiguate it): the states table
// defines RECOVERY as "authoritative state already partly lost (post-compaction, or
// banked state stale vs git HEAD)" and places it OFF the main axis. This module treats
// that table as authoritative over the looser prose bullet ("compactions >= 1 -> AMBER
// floor"): ANY compaction this session, or a banked state known stale against live git
// HEAD, means the verdict is RECOVERY outright, not merely a floor on GREEN/AMBER/RED.
// Rationale: INV-3 (durable state is the source of truth; conversation memory is not) —
// once a compaction has happened, in-context memory is degraded regardless of how much
// context headroom remains, so folding it into the same axis as "context is getting
// full" would let a low context percentage mask a real memory-loss event.
//
// INV-5: every check counts itself in `examinedSignals` REGARDLESS of whether it fired,
// skipped as unknown, or was short-circuited by a worse verdict elsewhere — so deleting
// the state file still produces a non-zero examined count, never a silent no-op.

export const STATE = Object.freeze({
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED: 'RED',
  RECOVERY: 'RECOVERY',
  BLIND: 'BLIND',
});

// Distinct exit codes so "did not run" can never be mistaken for "healthy" (INV-1).
// This used to cite rotate-session.mjs as the module that established the convention;
// that module was deleted by WO-OR-05, and the convention stands on its own.
export const EXIT_CODE = Object.freeze({
  [STATE.GREEN]: 0,
  [STATE.AMBER]: 1,
  [STATE.RED]: 2,
  [STATE.RECOVERY]: 3,
  [STATE.BLIND]: 4,
});

// Hypothesis thresholds from map section 4 — a starting point tuned by dogfood (F-4),
// shipped verbatim rather than re-derived, per this ticket's explicit instruction.
export const THRESHOLDS = Object.freeze({
  CONTEXT_AMBER: 55,
  CONTEXT_RED: 75,
  RATE_LIMIT_FIVE_HOUR_AMBER: 85,
});

// The full signal vocabulary this evaluator understands. Exported so adapters and
// tests have one place to see exactly what `evaluate` looks at.
export const SIGNAL_KEYS = Object.freeze([
  'contextUsedPercentage',
  'rateLimitFiveHourUsedPercentage',
  'growthProjectedRedBeforeCompletion',
  'compactions',
  'bankedStateStale',
  'safeBoundary',
]);

function isUnknown(value) {
  return value === undefined || value === null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function adviceFor(state, { safeBoundary } = {}) {
  switch (state) {
    case STATE.GREEN:
      return 'headroom available — continue.';
    case STATE.AMBER:
      return 'rotation worthwhile at the next safe boundary; do not start a new substantial item, finish the current one.';
    case STATE.RED:
      if (safeBoundary === true) return 'rotate now.';
      if (safeBoundary === false) return 'reach a safe boundary urgently, then rotate.';
      return 'rotate as soon as a safe boundary can be confirmed (safe-boundary status unknown).';
    case STATE.RECOVERY:
      return 'do not trust in-context memory — re-read durable state before acting.';
    case STATE.BLIND:
      return 'telemetry unreadable — treat as at least AMBER; say so loudly, never report GREEN.';
    default:
      return '';
  }
}

/**
 * evaluate(signals) -> verdict
 *
 * signals is a plain object; every field is OPTIONAL. Absent (`undefined`/`null`) is
 * `unknown` and is never treated as `0`/`false`. See SIGNAL_KEYS for the vocabulary.
 *
 * Returns { state, exitCode, reasons, unknownSignals, examinedSignals, advice }.
 */
export function evaluate(signals) {
  const s = signals && typeof signals === 'object' ? signals : {};
  const reasons = [];
  const unknownSignals = [];
  let examinedSignals = 0;

  // --- required signal: context usage -------------------------------------------
  examinedSignals += 1;
  const contextPct = s.contextUsedPercentage;
  let blind = false;
  if (isUnknown(contextPct)) {
    unknownSignals.push('contextUsedPercentage');
    reasons.push('contextUsedPercentage is unreadable — the evaluator cannot determine headroom without it.');
    blind = true;
  } else if (!isFiniteNumber(contextPct)) {
    unknownSignals.push('contextUsedPercentage');
    reasons.push(`contextUsedPercentage is not a readable number (${JSON.stringify(contextPct)}) — treated as unreadable telemetry.`);
    blind = true;
  }

  // --- main axis: context thresholds ---------------------------------------------
  let axis = STATE.GREEN;
  if (!blind) {
    if (contextPct >= THRESHOLDS.CONTEXT_RED) {
      axis = STATE.RED;
      reasons.push(`context used_percentage ${contextPct} >= ${THRESHOLDS.CONTEXT_RED} (RED threshold).`);
    } else if (contextPct >= THRESHOLDS.CONTEXT_AMBER) {
      axis = STATE.AMBER;
      reasons.push(`context used_percentage ${contextPct} >= ${THRESHOLDS.CONTEXT_AMBER} (AMBER threshold).`);
    } else {
      reasons.push(`context used_percentage ${contextPct} < ${THRESHOLDS.CONTEXT_AMBER} (GREEN).`);
    }
  }

  // --- rate-limit floor (optional) ------------------------------------------------
  examinedSignals += 1;
  const rateLimitPct = s.rateLimitFiveHourUsedPercentage;
  if (isUnknown(rateLimitPct)) {
    unknownSignals.push('rateLimitFiveHourUsedPercentage');
    reasons.push('rateLimitFiveHourUsedPercentage unknown — skipped (absence alone is not BLIND).');
  } else if (!isFiniteNumber(rateLimitPct)) {
    unknownSignals.push('rateLimitFiveHourUsedPercentage');
    reasons.push(`rateLimitFiveHourUsedPercentage is not a readable number (${JSON.stringify(rateLimitPct)}) — skipped.`);
  } else if (rateLimitPct >= THRESHOLDS.RATE_LIMIT_FIVE_HOUR_AMBER) {
    reasons.push(`rate_limits.five_hour.used_percentage ${rateLimitPct} >= ${THRESHOLDS.RATE_LIMIT_FIVE_HOUR_AMBER} — AMBER floor (risk of being cut off mid-item).`);
    if (!blind && axis === STATE.GREEN) axis = STATE.AMBER;
  }

  // --- growth-rate heuristic (optional, adapter-precomputed; F-4) -----------------
  examinedSignals += 1;
  const growthFlag = s.growthProjectedRedBeforeCompletion;
  if (isUnknown(growthFlag)) {
    unknownSignals.push('growthProjectedRedBeforeCompletion');
    reasons.push('growthProjectedRedBeforeCompletion unknown — skipped.');
  } else if (growthFlag === true) {
    reasons.push('projected context growth would hit RED before the current item can plausibly finish — AMBER.');
    if (!blind && axis === STATE.GREEN) axis = STATE.AMBER;
  }

  // --- RECOVERY: authoritative state already partly lost --------------------------
  examinedSignals += 1;
  const compactions = s.compactions;
  let recovery = false;
  if (isUnknown(compactions)) {
    unknownSignals.push('compactions');
    reasons.push('compactions unknown — skipped (cannot rule out authoritative-state loss).');
  } else if (!isFiniteNumber(compactions)) {
    unknownSignals.push('compactions');
    reasons.push(`compactions is not a readable number (${JSON.stringify(compactions)}) — skipped.`);
  } else if (compactions >= 1) {
    reasons.push(`compactions=${compactions} (>= 1) — authoritative in-context state has been partly lost.`);
    recovery = true;
  }

  examinedSignals += 1;
  const bankedStale = s.bankedStateStale;
  if (isUnknown(bankedStale)) {
    unknownSignals.push('bankedStateStale');
    reasons.push('bankedStateStale unknown — skipped.');
  } else if (typeof bankedStale !== 'boolean') {
    unknownSignals.push('bankedStateStale');
    reasons.push(`bankedStateStale is not a boolean (${JSON.stringify(bankedStale)}) — skipped.`);
  } else if (bankedStale === true) {
    reasons.push('banked programme state is stale vs the live git HEAD.');
    recovery = true;
  }

  // --- safe-boundary: modulates ADVICE only, never the state -----------------------
  examinedSignals += 1;
  const safeBoundary = s.safeBoundary;
  if (isUnknown(safeBoundary)) {
    unknownSignals.push('safeBoundary');
    reasons.push('safeBoundary unknown — advice will not assume one is available.');
  } else if (typeof safeBoundary !== 'boolean') {
    unknownSignals.push('safeBoundary');
    reasons.push(`safeBoundary is not a boolean (${JSON.stringify(safeBoundary)}) — treated as unknown.`);
  }
  const knownSafeBoundary = typeof safeBoundary === 'boolean' ? safeBoundary : undefined;

  // --- decide the single overall state: BLIND > RECOVERY > RED/AMBER/GREEN --------
  let state;
  if (blind) {
    state = STATE.BLIND;
  } else if (recovery) {
    state = STATE.RECOVERY;
    reasons.push('RECOVERY outranks the GREEN/AMBER/RED axis: do not trust in-context memory — re-read durable state before acting.');
  } else {
    state = axis;
  }

  return {
    state,
    exitCode: EXIT_CODE[state],
    reasons,
    unknownSignals,
    examinedSignals,
    advice: adviceFor(state, { safeBoundary: knownSafeBoundary }),
  };
}
