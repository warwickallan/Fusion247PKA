// BUILD-014 Tower supervisor loop — DETERMINISTIC fake reviewer (CI test double, FIX 3/4).
//
// A canned stand-in for the REAL Codex supervisor + merge-class QA. NO network, NO codex
// binary, NO auth — fully deterministic verdicts derived from the staged text, so CI can
// exercise ingest→claim→process→verdict→notify, the merge-class routing, dedup, restart
// recovery, and the long-run/concurrent-watcher exactly-once guarantee without any real model.
//
// Loaded by watcher.mjs when TOWER_REVIEWER_MODULE points here. It exports the SAME shape the
// watcher expects: runSupervisor(...) and runMergeReview(...). It never fakes a real-Codex
// claim (model_id = 'fake-reviewer').
//
// Control knobs (env, all optional):
//   FAKE_REVIEWER_SLEEP_MS   — sleep this long inside runSupervisor when the staged text
//                              contains the marker below (the FIX 4 long-run test).
//   FAKE_REVIEWER_SLEEP_MARKER (default 'SLEEP_LONG')

const SLEEP_MS = Number(process.env.FAKE_REVIEWER_SLEEP_MS || 0);
const SLEEP_MARKER = process.env.FAKE_REVIEWER_SLEEP_MARKER || 'SLEEP_LONG';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function verdictFor(text) {
  const t = String(text ?? '').toLowerCase();
  // Deterministic mapping aligned with the four acceptance archetypes.
  if (t.includes('greeting framework') || t.includes('plugin registry') || t.includes('etl framework') || t.includes('architecture doc')) {
    return { aligned: false, over_engineering: true, drifting: true, administering: false, warwick_needed: false, verdict: 'correct', next_action: 'Drop the framework; write the single file the ask names.', summary: 'Over-engineering the ask — correct back to the one concrete deliverable.' };
  }
  if (t.includes('completely done and fully working') || t.includes('shipped. all good')) {
    return { aligned: false, over_engineering: false, drifting: false, administering: false, warwick_needed: false, verdict: 'correct', next_action: 'Show the actual evidence the feature works before claiming done.', summary: 'Unsupported completion claim — no evidence; do not accept "done".' };
  }
  if (t.includes('everything is on track') || t.includes('status update')) {
    return { aligned: false, over_engineering: false, drifting: false, administering: true, warwick_needed: false, verdict: 'correct', next_action: 'Resolve the open finding before any status; stop administering.', summary: 'Administering, not delivering — an open finding is unaddressed.' };
  }
  if (t.includes('colour-coded console output') || t.includes('confirmed output.json')) {
    return { aligned: true, over_engineering: false, drifting: false, administering: false, warwick_needed: false, verdict: 'continue', next_action: 'Ship it; the cosmetic extra is optional.', summary: 'Fit for purpose — works and matches the ask; continue.' };
  }
  // Default: aligned continue.
  return { aligned: true, over_engineering: false, drifting: false, administering: false, warwick_needed: false, verdict: 'continue', next_action: 'Proceed with the next shipping step.', summary: 'Aligned and shipping (fake reviewer default).' };
}

export async function runSupervisor({ reconstructedTurnText } = {}) {
  if (SLEEP_MS > 0 && String(reconstructedTurnText ?? '').includes(SLEEP_MARKER)) {
    await sleep(SLEEP_MS);
  }
  const r = verdictFor(reconstructedTurnText);
  return { ok: true, blocked: false, modelId: 'fake-reviewer', result: { status: 'ok', ...r }, rawStdout: '' };
}

export async function runMergeReview({ packet } = {}) {
  const claim = String(packet?.summary ?? '').toLowerCase();
  const changed = Array.isArray(packet?.changed_files) ? packet.changed_files.length : 0;
  // Deterministic merge-class QA: an evidence-free "done" claim → request_changes; a normal
  // diff with a real summary → approve. Keeps the merge-class routing test deterministic.
  if (claim.includes('completely done') || claim.includes('no evidence') || changed === 0) {
    return {
      ok: true, blocked: false, modelId: 'fake-reviewer',
      result: {
        status: 'ok', verdict: 'request_changes',
        summary: 'Fake QA: completion claim not supported by the staged diff.',
        claims_verified: [{ claim: 'feature done', status: 'refuted', evidence: 'diff does not implement it' }],
        acceptance_results: [{ acceptance_row_id: 'AC-01', result: 'fail', rationale: 'unsupported', evidence: 'no matching change' }],
        prior_finding_results: [], findings: [],
      },
    };
  }
  return {
    ok: true, blocked: false, modelId: 'fake-reviewer',
    result: {
      status: 'ok', verdict: 'approve',
      summary: 'Fake QA: staged diff matches the claimed change.',
      claims_verified: [{ claim: 'change present', status: 'confirmed', evidence: `${changed} changed files` }],
      acceptance_results: [{ acceptance_row_id: 'AC-01', result: 'pass', rationale: 'implemented', evidence: 'diff' }],
      prior_finding_results: [], findings: [],
    },
  };
}
