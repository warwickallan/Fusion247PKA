// Post-clear model selection gate (BUILD-018 T-15)
//
// THE DEFECT THIS CLOSES
// -----------------------
// A live /clear -> continue cycle exposed a real Governor hole: the bank correctly
// recommended Opus, the visible session mode was Auto, reorientation did NOT present
// the model recommendation before anything else, and implementation reconnaissance
// began before Warwick could select the recommended model. T-04 was built under an
// unverified model. This module makes that structurally impossible going forward: a
// fresh session's first visible output is a compact gate, and implementation stays
// withheld until the current model is VERIFIED (not asserted) to match.
//
// WHY THIS IS DELIBERATELY CONSERVATIVE (requirement 6)
// -------------------------------------------------------
// The only real signal available today is a health-store sample carrying
// `model.id`/`model.display_name` (T-01/T-03). That field reports the RESOLVED
// concrete model for the turn — it does NOT reliably distinguish "Auto resolved here"
// from "Warwick explicitly pinned this". Recorded as new fog (see the map's F-9 row):
// unconfirmed on this machine whether the payload ever literally reads "Auto". This
// module treats a label containing "auto" as a confirmed AUTO block, and treats the
// ABSENCE of any fresh, session-matched sample as UNKNOWN — never as a pass. An
// effective model chosen behind Auto is NOT equivalent to an explicit selection, and
// whenever the mode cannot be observed reliably, this fails closed to UNKNOWN, exactly
// as requirement 6 demands.
//
// WHY THIS IS SEPARATE FROM reorient.mjs, NOT MERGED INTO IT
// ------------------------------------------------------------
// `reorient()` (T-11) is untouched by this ticket — every one of its existing tests
// keeps passing unmodified. This module composes ON TOP of a `reorient()` result via
// `applyModelGate()`, wired in at the `runHook()` boundary only. That keeps T-11's own
// contract (the pointer brief, the location gate) exactly as landed, and makes this
// gate a bounded, additive, independently-testable layer — the same discipline T-04's
// write-back log insisted on for itself.
//
// AD-11-STYLE PURITY WHERE IT MATTERS
// -------------------------------------
// `normaliseModelFamily`, `isAutoLabel`, `resolveCurrentModel`, `evaluateModelGate` and
// `renderCompactGate` are pure — signals in, a verdict or text out. Only
// `applyModelGate` (which reads the health store) and the CLI are impure.

import { readHealthSample } from './health-store.mjs';
import { readProgrammeState } from './programme-state.mjs';
import { LOCATION } from './worktree-guard.mjs';
import { pathToFileURL } from 'node:url';

// Mirrors reorient.mjs's AD-5 CONTEXT_CAP. Duplicated as a literal, not imported —
// reorient.mjs imports `applyModelGate` from this module, so importing reorient.mjs
// back would create a circular module dependency for the sake of one integer.
const CONTEXT_CAP = 10000;

// A sample older (or, absurdly, newer) than this is not trusted as "the current
// model". Generous enough for normal turn cadence (statusLine refreshes within the
// same turn per T-01's own evidence), tight enough to catch a genuinely stale sample
// surviving from before a model switch.
export const DEFAULT_MAX_SAMPLE_AGE_MS = 10 * 60 * 1000;

export const STATUS = Object.freeze({
  MATCH: 'match',
  MISMATCH: 'mismatch',
  AUTO: 'auto',
  UNKNOWN: 'unknown',
});

// Distinct exit codes (INV-1 mirrored here) — "did not verify" must never look like
// "verified and released".
export const EXIT_CODE = Object.freeze({
  [STATUS.MATCH]: 0,
  [STATUS.MISMATCH]: 1,
  [STATUS.AUTO]: 2,
  [STATUS.UNKNOWN]: 3,
});

// The verdict string this module hands back on `applyModelGate`'s blocked path. Kept
// as a local literal rather than a new entry on reorient.mjs's VERDICT enum, for the
// same import-direction reason as CONTEXT_CAP above.
export const MODEL_GATE_VERDICT = 'model-gate-blocked';

// ---------------------------------------------------------------------------
// Pure: model-label recognition
// ---------------------------------------------------------------------------

export function isAutoLabel(label) {
  return typeof label === 'string' && /\bauto\b/i.test(label);
}

// Coarse family only ("opus"/"sonnet"/"haiku") — matches the granularity of
// model_recommendation.model (T-09's schema: Opus|Sonnet|Haiku|any|unknown). Returns
// null rather than guessing when the label names no known family.
export function normaliseModelFamily(label) {
  if (typeof label !== 'string') return null;
  const lower = label.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  return null;
}

// ---------------------------------------------------------------------------
// Pure: resolve "current model" from a health-store read result
// ---------------------------------------------------------------------------
// `sampleResult` is exactly the shape `readHealthSample()` returns: { ok, data|reason }.
// Every failure path returns UNKNOWN with a `reason` — never a guess, per requirement 6.

export function resolveCurrentModel({
  sampleResult,
  sessionId,
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_SAMPLE_AGE_MS,
} = {}) {
  if (!sampleResult || sampleResult.ok !== true || !sampleResult.data || typeof sampleResult.data !== 'object') {
    return {
      label: 'UNKNOWN',
      reason:
        sampleResult && sampleResult.ok === false && sampleResult.reason === 'unreadable'
          ? `a health sample exists but is unreadable: ${sampleResult.error || '(no detail)'}`
          : 'no health sample has been recorded for this session yet',
    };
  }

  const sample = sampleResult.data;

  // The health store is keyed by session_id in its file path, so a cross-session read
  // should not normally happen — but the sample's OWN recorded session_id is checked
  // explicitly anyway, so a caller that ever passes a mismatched path/opts combination
  // fails closed instead of silently trusting the wrong session's model.
  if (typeof sessionId === 'string' && sessionId.length > 0 && sample.session_id !== sessionId) {
    return {
      label: 'UNKNOWN',
      reason:
        `sample belongs to session ${sample.session_id ? JSON.stringify(sample.session_id) : '(none recorded)'}, ` +
        `not the current session ${JSON.stringify(sessionId)} — refusing to trust a sample from a different session`,
    };
  }

  const sampledAtMs = typeof sample.sampled_at === 'string' ? Date.parse(sample.sampled_at) : NaN;
  if (!Number.isFinite(sampledAtMs)) {
    return { label: 'UNKNOWN', reason: 'sample has no readable sampled_at timestamp — freshness cannot be established' };
  }

  const ageMs = now - sampledAtMs;
  if (Math.abs(ageMs) > maxAgeMs) {
    return {
      label: 'UNKNOWN',
      reason:
        `sample is ${Math.round(Math.abs(ageMs) / 1000)}s ${ageMs < 0 ? 'in the future' : 'old'}, outside the ` +
        `${Math.round(maxAgeMs / 1000)}s freshness window — treated as stale`,
    };
  }

  const rawLabel = sample.model?.display_name || sample.model?.id;
  if (!rawLabel || typeof rawLabel !== 'string') {
    return { label: 'UNKNOWN', reason: 'sample has no readable model.display_name or model.id' };
  }

  if (isAutoLabel(rawLabel)) return { label: 'AUTO', raw: rawLabel };
  return { label: rawLabel, raw: rawLabel };
}

// ---------------------------------------------------------------------------
// Pure: the gate decision
// ---------------------------------------------------------------------------

export function evaluateModelGate({ recommendedModel, currentModel } = {}) {
  const label = currentModel?.label;

  if (label === 'UNKNOWN' || label === undefined || label === null) {
    return { status: STATUS.UNKNOWN, label: 'UNKNOWN', reason: currentModel?.reason || 'current model could not be established' };
  }
  if (label === 'AUTO') {
    return { status: STATUS.AUTO, label: 'AUTO', reason: currentModel?.reason };
  }

  const currentFamily = normaliseModelFamily(label);
  if (!currentFamily) {
    return {
      status: STATUS.UNKNOWN,
      label,
      reason: `current model label ${JSON.stringify(label)} does not match any known family (opus/sonnet/haiku)`,
    };
  }

  if (recommendedModel === 'any') {
    return { status: STATUS.MATCH, label };
  }
  if (recommendedModel !== 'Opus' && recommendedModel !== 'Sonnet' && recommendedModel !== 'Haiku') {
    return {
      status: STATUS.UNKNOWN,
      label,
      reason: `model_recommendation is ${JSON.stringify(recommendedModel)} — not a concrete family to verify an explicit selection against`,
    };
  }

  const recommendedFamily = normaliseModelFamily(recommendedModel);
  return currentFamily === recommendedFamily
    ? { status: STATUS.MATCH, label }
    : { status: STATUS.MISMATCH, label };
}

export function isReleased(gate) {
  return gate?.status === STATUS.MATCH;
}

// ---------------------------------------------------------------------------
// Pure: render the compact gate (requirement 1's exact six-line shape)
// ---------------------------------------------------------------------------

export function renderCompactGate({
  buildId,
  locationVerdict,
  nextTicket,
  recommendedModel,
  gate,
  sessionId,
  statePath,
} = {}) {
  const selectTarget =
    recommendedModel === 'any' || recommendedModel === 'unknown' || recommendedModel === undefined
      ? 'an explicit model'
      : recommendedModel;

  const actionLine =
    gate.status === STATUS.MATCH
      ? 'continue — model verified, implementation permitted.'
      : `select ${selectTarget} in the model selector, then send "continue".`;

  const lines = [
    `REORIENTED — ${buildId || '(unknown build)'}`,
    `Location: ${locationVerdict || 'unknown'}`,
    `Next ticket: ${nextTicket || '(none)'}`,
    `Recommended model: ${recommendedModel ?? 'unknown'}`,
    `Current model: ${gate.label}`,
    `Action: ${actionLine}`,
  ];

  if (gate.status !== STATUS.MATCH) {
    lines.push(
      '',
      '🚨 STOP — POST-CLEAR MODEL SELECTION GATE (BUILD-018 T-15) 🚨',
      `Current model status: ${gate.status.toUpperCase()}${gate.reason ? ` — ${gate.reason}` : ''}.`,
      'Do NOT read implementation files for the next ticket, search code, dispatch workers, or make ANY',
      'mutation until the model is verified. An effective model chosen behind Auto is NOT equivalent to',
      'Warwick explicitly selecting the recommended model (T-15, requirement 6) — this gate fails closed',
      'on anything it cannot verify, on purpose.',
      '',
      'After Warwick selects the model and sends "continue", re-verify with the real observable data —',
      'do not accept chat text claiming the model changed:',
      `  node tools/governor/model-gate.mjs check --state ${statePath || '<state-path>'} --session ${sessionId || '<session-id>'}`,
      'Only that command releasing MATCH permits implementation to begin.'
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Impure: compose a reorient() result with the model gate
// ---------------------------------------------------------------------------
// A no-op unless the underlying reorientation already says implementation is
// permitted (VERDICT.ORIENTED or non-misplaced VERDICT.STALE) — every other outcome
// (WRONG_WORKTREE, MISSING, CORRUPT, AMBIGUOUS, FAILED, SKIPPED) already withholds
// implementation through its own existing mechanism, and this gate has nothing to add.

function combineWithCap(gateText, originalContext) {
  const sep = '\n\n';
  const budget = CONTEXT_CAP - gateText.length - sep.length;
  if (budget <= 0) return gateText.slice(0, CONTEXT_CAP);
  if (typeof originalContext !== 'string' || originalContext.length <= budget) {
    return gateText + sep + (originalContext || '');
  }
  const marker = '\n\n… [TRUNCATED to fit the model-gate banner within the SessionStart cap — read the map for the rest]';
  const keep = Math.max(0, budget - marker.length);
  return gateText + sep + originalContext.slice(0, keep) + marker;
}

export function applyModelGate(
  reorientResult,
  { sessionId, readSample = readHealthSample, healthOpts = {}, now = Date.now(), recommendedModel } = {}
) {
  if (!reorientResult || reorientResult.implementationPermitted !== true) {
    return reorientResult;
  }

  const rec = recommendedModel ?? reorientResult.state?.model_recommendation?.model ?? 'unknown';
  const sampleResult =
    typeof sessionId === 'string' && sessionId.length > 0
      ? readSample(sessionId, healthOpts)
      : { ok: false, reason: 'no-session-id' };
  const currentModel = resolveCurrentModel({ sampleResult, sessionId, now });
  const gate = evaluateModelGate({ recommendedModel: rec, currentModel });

  const nextTicket = reorientResult.state?.resumption?.ticket || '(none)';
  const buildId = reorientResult.state?.programme?.id || '(unknown build)';
  const locationVerdict = !reorientResult.location
    ? 'unknown'
    : reorientResult.location.verdict === LOCATION.ALIGNED
      ? 'verified'
      : 'refused';

  const gateText = renderCompactGate({
    buildId,
    locationVerdict,
    nextTicket,
    recommendedModel: rec,
    gate,
    sessionId,
    statePath: reorientResult.statePath,
  });

  if (gate.status === STATUS.MATCH) {
    return {
      ...reorientResult,
      modelGate: gate,
      context: combineWithCap(gateText, reorientResult.context),
    };
  }

  return {
    ...reorientResult,
    verdict: MODEL_GATE_VERDICT,
    modelGate: gate,
    implementationPermitted: false,
    context: gateText.length <= CONTEXT_CAP ? gateText : gateText.slice(0, CONTEXT_CAP),
  };
}

// ---------------------------------------------------------------------------
// CLI — the ad-hoc recheck Larry runs after Warwick selects a model (requirement 4/5)
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function runCli(argv) {
  const [cmd, ...rest] = argv;
  const usage = 'usage: node model-gate.mjs check --state <programme-state.json> --session <id> [--now <iso>]';

  if (cmd !== 'check') {
    process.stderr.write(usage + '\n');
    return { exitCode: EXIT_CODE[STATUS.UNKNOWN], text: usage };
  }

  const flags = parseFlags(rest);
  if (!flags.state || !flags.session) {
    process.stderr.write(usage + '\n');
    return { exitCode: EXIT_CODE[STATUS.UNKNOWN], text: usage };
  }

  const read = readProgrammeState(flags.state);
  if (!read.ok) {
    const text =
      `MODEL GATE: durable state at ${flags.state} is ${read.reason} — cannot verify. ` +
      'Treat as UNKNOWN and do not proceed.';
    return { exitCode: EXIT_CODE[STATUS.UNKNOWN], text };
  }

  const state = read.data;
  const recommendedModel = state.model_recommendation?.model ?? 'unknown';
  const nextTicket = state.resumption?.ticket || '(none)';
  const buildId = state.programme?.id || '(unknown build)';

  const now = typeof flags.now === 'string' ? Date.parse(flags.now) : Date.now();
  const sampleResult = readHealthSample(flags.session, {});
  const currentModel = resolveCurrentModel({ sampleResult, sessionId: flags.session, now });
  const gate = evaluateModelGate({ recommendedModel, currentModel });

  const text = renderCompactGate({
    buildId,
    locationVerdict: 'verified (unchanged since reorientation — this recheck does not re-run the location check)',
    nextTicket,
    recommendedModel,
    gate,
    sessionId: flags.session,
    statePath: flags.state,
  });

  return { exitCode: EXIT_CODE[gate.status], text, gate };
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const { exitCode, text } = runCli(process.argv.slice(2));
  process.stdout.write(text + '\n');
  process.exitCode = exitCode;
}

export { runCli };
