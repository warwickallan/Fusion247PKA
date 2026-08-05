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
  // WO-2026-08-05-09 (WP-2E) — an APPROVED merge-class review that STILL raises a non-blocking
  // finding (e.g. a NOTE_ONLY / TRACKED_FOLLOWUP finding attached to an otherwise-clean approve).
  // Proves fireTriggers' 'findings_raised' fallback: without it, an approve + aligned delivery
  // verdict is entirely SILENT and this finding would never reach Telegram. Checked BEFORE the
  // plainer 'with_findings' marker below, because that marker is a substring of this one.
  if (claim.includes('with_findings_approved')) {
    return {
      ok: true, blocked: false, modelId: 'fake-reviewer',
      result: {
        status: 'ok', verdict: 'approve',
        summary: 'Fake QA: approved, with one non-blocking note.',
        claims_verified: [{ claim: 'change present', status: 'confirmed', evidence: `${changed} changed files` }],
        acceptance_results: [{ acceptance_row_id: 'AC-01', result: 'pass', rationale: 'implemented', evidence: 'diff' }],
        prior_finding_results: [],
        findings: [
          {
            id: 'TQA-003', technical_impact: 'NOTE', reachability: 'HYPOTHETICAL',
            required_disposition: 'NOTE_ONLY',
            assumed_deployment_baseline: 'live watcher',
            evidence: 'naming could be clearer in one helper',
            required_correction: 'optional rename, not required',
          },
        ],
      },
    };
  }
  // WO-2026-08-05-09 (WP-2E) — deterministic NEW findings, shaped exactly like
  // CODEX_RESULT_SCHEMA's findings[] (codexAdapter.mjs), for the QA-exchange test suite. Only
  // fires when the staged claim carries this marker, so every PRE-EXISTING test — none of which
  // uses it — is byte-for-byte unaffected.
  if (claim.includes('with_findings')) {
    return {
      ok: true, blocked: false, modelId: 'fake-reviewer',
      result: {
        status: 'ok', verdict: 'request_changes',
        summary: 'Fake QA: two findings raised for the QA-exchange proof.',
        claims_verified: [{ claim: 'change present', status: 'confirmed', evidence: `${changed} changed files` }],
        acceptance_results: [{ acceptance_row_id: 'AC-01', result: 'partial', rationale: 'findings raised', evidence: 'diff' }],
        prior_finding_results: [],
        findings: [
          {
            id: 'TQA-001', technical_impact: 'HIGH', reachability: 'ACTIVE',
            required_disposition: 'BLOCKS_CURRENT_MERGE',
            assumed_deployment_baseline: 'live watcher, real Telegram',
            evidence: 'pool.end() is not in a finally block — connection leak on throw',
            required_correction: 'wrap the close in a finally block',
          },
          {
            id: 'TQA-002', technical_impact: 'MEDIUM', reachability: 'LATENT',
            required_disposition: 'TRACKED_FOLLOWUP',
            assumed_deployment_baseline: 'live watcher',
            evidence: 'retry budget is unbounded',
            required_correction: 'cap the retry count',
          },
        ],
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
