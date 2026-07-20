// BUILD-014 PR-2b (completion) — the SHARED reviewer-classification contract + fail-closed validation
// + the append-only, RETRY-IDEMPOTENT write-path.
//
// This closes two campaign conditions at once:
//   · Condition 2 — the reviewer result must carry EXPLICIT, machine-readable answers (acceptance
//     results, prior-finding dispositions, three-axis-classified findings). Validation is FAIL-CLOSED:
//     a missing/malformed array means the review is BLOCKED, never accepted with the answer buried in
//     `summary`. Then the answers are PERSISTED to the correct append-only records (acceptance_
//     verification / finding / links) so there is finally somewhere to put them.
//   · the classification amendment's merge rule — the DISPOSITION (not severity) decides the merge:
//     an improvement (NOTE_ONLY / TRACKED_FOLLOWUP) can never block; only a BLOCKS_CURRENT_MERGE
//     finding (or a failed/blocked acceptance) blocks the current merge.
//
// The module is DB-agnostic beyond running client.query on the trusted runtime's pool: it never hands
// any of this to a reviewer subprocess, and it writes verifications under a REVIEWER principal only
// (PR-1's builder-cannot-verify rule is enforced structurally by the schema; we honour it here).

// ---- closed vocabularies (mirror the amendment + the CODEX_RESULT_SCHEMA additions) -------------
export const ACCEPTANCE_RESULTS = Object.freeze(['pass', 'fail', 'partial', 'blocked', 'not_applicable']);
export const PRIOR_FINDING_STATUSES = Object.freeze(['addressed', 'remains_open', 'unrelated']);
export const TECHNICAL_IMPACTS = Object.freeze(['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'NOTE']);
export const REACHABILITIES = Object.freeze(['ACTIVE', 'LATENT', 'HYPOTHETICAL']);
export const REQUIRED_DISPOSITIONS = Object.freeze([
  'BLOCKS_CURRENT_MERGE', 'REQUIRED_BEFORE_LIVE',
  'REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS', 'TRACKED_FOLLOWUP', 'NOTE_ONLY',
]);

// The classification policy version stamped onto every classifier-produced finding. It is a RUNTIME
// policy fact (the amendment version), not a reviewer choice, so the runtime stamps it — and its
// presence is what marks a finding as NON-LEGACY (a legacy finding carries classification_version NULL).
export const CLASSIFICATION_VERSION = 'reviewer-classification-amendment@1';

// amendment three-axis -> the ops.finding schema. technical_impact -> finding_severity;
// reachability -> finding_reachability; required_disposition -> the TYPED ops.required_disposition
// column (006, the merge lever) + assumed_deployment_baseline -> its own bounded column + a stamped
// classification_version. A human-readable `impact` summary is ALSO kept for the cockpit, but authority
// is NEVER parsed from it — the readiness gate reads the typed columns. A newly-opened finding is
// state='open' and MUST be disposition='unresolved' (003 CHECK) — the LIFECYCLE disposition is distinct.
const IMPACT_TO_SEVERITY = Object.freeze({ BLOCKER: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NOTE: 'info' });
const REACH_TO_ENUM = Object.freeze({ ACTIVE: 'reachable', LATENT: 'conditional', HYPOTHETICAL: 'unreachable' });
export const mapImpactToSeverity = (i) => IMPACT_TO_SEVERITY[i] ?? 'medium';
export const mapReachability = (r) => REACH_TO_ENUM[r] ?? 'unknown';

const nonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
const present = (v) => v !== undefined && v !== null;

/**
 * FAIL-CLOSED validation of a reviewer's structured result against the amendment + acceptance-first
 * contract. Given the packet's acceptance rows + open findings, EVERY acceptance criterion must carry
 * a result and EVERY prior open finding must carry a disposition (no silent carry-over), and every
 * reported finding must carry the full three-axis classification + a stated baseline (R2). Returns
 * { ok, errors[] }. NEVER throws.
 */
export function validateReviewerResult(structuredResult, { acceptanceRows = [], openFindings = [] } = {}) {
  const errors = [];
  const sr = structuredResult;
  if (!sr || typeof sr !== 'object') return { ok: false, errors: ['structured result is not an object'] };

  // acceptance_results[] — one per acceptance criterion (by ref OR row id).
  const accRes = sr.acceptance_results;
  if (!Array.isArray(accRes)) {
    errors.push('acceptance_results must be an array (fail-closed — answers never buried in summary)');
  } else {
    const answered = new Set();
    for (const [i, a] of accRes.entries()) {
      if (!a || typeof a !== 'object') { errors.push(`acceptance_results[${i}] is not an object`); continue; }
      if (!nonEmptyStr(a.acceptance_row_id)) errors.push(`acceptance_results[${i}].acceptance_row_id is required`);
      if (!ACCEPTANCE_RESULTS.includes(a.result)) errors.push(`acceptance_results[${i}].result invalid: ${String(a.result)}`);
      if (!nonEmptyStr(a.rationale)) errors.push(`acceptance_results[${i}].rationale is required`);
      if (!present(a.evidence)) errors.push(`acceptance_results[${i}].evidence is required`);
      if (nonEmptyStr(a.acceptance_row_id)) answered.add(String(a.acceptance_row_id));
    }
    for (const row of acceptanceRows) {
      if (!answered.has(String(row.acceptance_ref)) && !answered.has(String(row.id))) {
        errors.push(`acceptance criterion ${row.acceptance_ref} has no acceptance_results entry (acceptance-first, fail-closed)`);
      }
    }
  }

  // prior_finding_results[] — one per prior OPEN finding (no silent carry-over).
  const pfr = sr.prior_finding_results;
  if (!Array.isArray(pfr)) {
    errors.push('prior_finding_results must be an array (fail-closed)');
  } else {
    const disposed = new Set();
    for (const [i, f] of pfr.entries()) {
      if (!f || typeof f !== 'object') { errors.push(`prior_finding_results[${i}] is not an object`); continue; }
      if (!nonEmptyStr(f.finding_id)) errors.push(`prior_finding_results[${i}].finding_id is required`);
      if (!PRIOR_FINDING_STATUSES.includes(f.status)) errors.push(`prior_finding_results[${i}].status invalid: ${String(f.status)}`);
      if (!nonEmptyStr(f.rationale)) errors.push(`prior_finding_results[${i}].rationale is required`);
      if (nonEmptyStr(f.finding_id)) disposed.add(String(f.finding_id));
    }
    for (const of of openFindings) {
      if (!disposed.has(String(of.finding_ref)) && !disposed.has(String(of.id))) {
        errors.push(`prior open finding ${of.finding_ref} has no prior_finding_results disposition (no silent carry-over, fail-closed)`);
      }
    }
  }

  // findings[] — each carries the full three-axis classification + a stated baseline (R2).
  const finds = sr.findings;
  if (finds !== undefined && !Array.isArray(finds)) {
    errors.push('findings must be an array when present');
  } else if (Array.isArray(finds)) {
    for (const [i, f] of finds.entries()) {
      if (!f || typeof f !== 'object') { errors.push(`findings[${i}] is not an object`); continue; }
      const id = f.id ?? f.ref ?? f.finding_ref;
      if (!nonEmptyStr(id)) errors.push(`findings[${i}] needs a stable id/ref`);
      if (!TECHNICAL_IMPACTS.includes(f.technical_impact)) errors.push(`findings[${i}].technical_impact invalid: ${String(f.technical_impact)}`);
      if (!REACHABILITIES.includes(f.reachability)) errors.push(`findings[${i}].reachability invalid: ${String(f.reachability)}`);
      if (!REQUIRED_DISPOSITIONS.includes(f.required_disposition)) errors.push(`findings[${i}].required_disposition invalid: ${String(f.required_disposition)}`);
      if (!nonEmptyStr(f.assumed_deployment_baseline)) errors.push(`findings[${i}].assumed_deployment_baseline is required (R2 — reachability must cite a baseline)`);
      if (!present(f.evidence)) errors.push(`findings[${i}].evidence is required`);
      if (!nonEmptyStr(f.required_correction)) errors.push(`findings[${i}].required_correction is required`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** DISPOSITION governs the merge: any BLOCKS_CURRENT_MERGE finding blocks. (Amendment merge rule.) */
export function dispositionBlocksMerge(findings = []) {
  return Array.isArray(findings) && findings.some((f) => f && f.required_disposition === 'BLOCKS_CURRENT_MERGE');
}

/** A failed/blocked acceptance breaches the WP's acceptance criteria -> blocks the current merge. */
export function acceptanceFailed(acceptanceResults = []) {
  return Array.isArray(acceptanceResults) && acceptanceResults.some((a) => a && (a.result === 'fail' || a.result === 'blocked'));
}

const sanitizeRef = (s) => String(s ?? '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

/** A deterministic, per-(reviewer, checkpoint, reviewer-finding-id, head) finding_ref, so a re-run at
 * the same head re-derives the SAME ref -> the unique (build_id, finding_ref) makes re-insert a no-op. */
export function makeFindingRef({ reviewerPrincipal, checkpointRef, findingId, headSha }) {
  return `TR-${sanitizeRef(reviewerPrincipal)}-${sanitizeRef(checkpointRef)}-${sanitizeRef(findingId)}-${String(headSha ?? '').slice(0, 8)}`.slice(0, 120);
}

/**
 * Persist one reviewer's validated classification answers to the append-only records. RETRY-IDEMPOTENT
 * at the same head (Warwick's addition): re-running the SAME review yields no duplicate rows.
 *   · acceptance_results -> ops.acceptance_verification  (REVIEWER principal, bound to checkpoint +
 *     EXACT head + prd/plan versions). Idempotency key: (acceptance_row_id, checkpoint_id, reviewer,
 *     exact_sha) — INSERT ... WHERE NOT EXISTS so a retry is a no-op, never a duplicate append.
 *   · prior_finding_results -> ops.finding disposition update (addressed -> closed/fixed, single
 *     active transition via `and state='open'`) + review_run_finding relation='closed' (append-only,
 *     on-conflict-do-nothing). remains_open / unrelated leave the finding OPEN (never deleted).
 *   · findings[] -> ops.finding (deterministic finding_ref, on-conflict-do-nothing) carrying the
 *     three-axis classification, + review_run_finding relation='opened' + an acceptance_finding link
 *     when the finding maps to an acceptance row.
 * MUST run on a pinned client already inside the review_run transaction (so it commits/rolls back
 * atomically with the run). Returns a small counters object for tests/telemetry.
 */
export async function persistReviewerClassification(client, {
  buildId, checkpointId, checkpointRef, headSha, reviewerPrincipal, reviewRunId,
  prdVersionId, planVersionId, acceptanceRows = [], openFindings = [], structuredResult = {},
}) {
  const accByKey = new Map();
  for (const a of acceptanceRows) { accByKey.set(String(a.acceptance_ref), a); accByKey.set(String(a.id), a); }
  const findByKey = new Map();
  for (const f of openFindings) { findByKey.set(String(f.finding_ref), f); findByKey.set(String(f.id), f); }

  const counters = { acceptance_verifications: 0, findings_opened: 0, prior_closed: 0 };

  // (1) acceptance_results -> acceptance_verification (idempotent append).
  for (const ar of Array.isArray(structuredResult.acceptance_results) ? structuredResult.acceptance_results : []) {
    const row = accByKey.get(String(ar.acceptance_row_id));
    if (!row) continue; // extra/unknown entry — the validator already ensured every packet row is answered
    const ins = await client.query(
      `insert into ops.acceptance_verification
         (acceptance_row_id, checkpoint_id, reviewer, result, rationale, exact_sha, prd_version_id, plan_version_id)
       select $1,$2,$3::ops.principal,$4::ops.acceptance_result,$5, ops.canonicalize_sha($6),$7,$8
        where not exists (
          select 1 from ops.acceptance_verification
           where acceptance_row_id=$1 and checkpoint_id=$2 and reviewer=$3::ops.principal
             and exact_sha=ops.canonicalize_sha($6))
       returning id`,
      [row.id, checkpointId, reviewerPrincipal, ar.result, ar.rationale ?? null, headSha, prdVersionId, planVersionId]);
    if (ins.rowCount === 1) counters.acceptance_verifications += 1;
  }

  // (2) prior_finding_results -> disposition update + append-only link (addressed only).
  for (const pf of Array.isArray(structuredResult.prior_finding_results) ? structuredResult.prior_finding_results : []) {
    const f = findByKey.get(String(pf.finding_id));
    if (!f) continue;
    if (pf.status === 'addressed') {
      const upd = await client.query(
        `update ops.finding set state='closed', disposition='fixed' where id=$1 and state='open'`, [f.id]);
      if (upd.rowCount === 1) counters.prior_closed += 1;
      await client.query(
        `insert into ops.review_run_finding (review_run_id, finding_id, relation) values ($1,$2,'closed')
           on conflict do nothing`, [reviewRunId, f.id]);
    }
    // remains_open / unrelated: no state change — the finding persists (append-only, cannot vanish).
  }

  // (3) findings[] -> new ops.finding rows (idempotent) + links, carrying the three-axis classification.
  for (const nf of Array.isArray(structuredResult.findings) ? structuredResult.findings : []) {
    const rid = String(nf.id ?? nf.ref ?? nf.finding_ref ?? '').trim();
    if (!rid) continue;
    const findingRef = makeFindingRef({ reviewerPrincipal, checkpointRef, findingId: rid, headSha });
    const baselineText = String(nf.assumed_deployment_baseline ?? '').replace(/\s+/g, ' ').slice(0, 240);
    const classificationVersion = (typeof nf.classification_version === 'string' && nf.classification_version.trim())
      ? nf.classification_version.trim().slice(0, 120)
      : CLASSIFICATION_VERSION;
    // Human-readable summary ONLY (the cockpit reads it; the readiness gate NEVER parses authority from it).
    const impactText = `technical_impact=${nf.technical_impact};reachability=${nf.reachability};`
      + `required_disposition=${nf.required_disposition};assumed_deployment_baseline=${baselineText}`;
    const title = String(nf.title ?? nf.summary ?? rid).slice(0, 200);
    // Write the TYPED merge lever + baseline + classification_version (006) — retry-idempotent via the
    // deterministic finding_ref + ON CONFLICT DO NOTHING (a re-run neither duplicates NOR alters the row).
    const ins = await client.query(
      `insert into ops.finding
         (build_id, finding_ref, opened_by, title, impact, severity, reachability, disposition, state,
          required_disposition, assumed_deployment_baseline, classification_version, opened_at_sha)
       values ($1,$2,$3::ops.principal,$4,$5,$6::ops.finding_severity,$7::ops.finding_reachability,'unresolved','open',
          $8::ops.required_disposition,$9,$10, ops.canonicalize_sha($11))
         on conflict (build_id, finding_ref) do nothing
       returning id`,
      [buildId, findingRef, reviewerPrincipal, title, impactText,
        mapImpactToSeverity(nf.technical_impact), mapReachability(nf.reachability),
        nf.required_disposition, baselineText, classificationVersion, headSha]);
    let findingId = ins.rows[0]?.id ?? null;
    if (!findingId) {
      const sel = await client.query(`select id from ops.finding where build_id=$1 and finding_ref=$2`, [buildId, findingRef]);
      findingId = sel.rows[0]?.id ?? null;
    }
    if (!findingId) continue;
    if (ins.rowCount === 1) counters.findings_opened += 1;
    await client.query(
      `insert into ops.review_run_finding (review_run_id, finding_id, relation) values ($1,$2,'opened')
         on conflict do nothing`, [reviewRunId, findingId]);
    // acceptance link when the finding maps to an acceptance row (explicit ref, or the finding id IS a ref).
    const accRef = nf.acceptance_ref ?? (accByKey.has(rid) ? rid : null);
    if (accRef) {
      const row = accByKey.get(String(accRef));
      if (row) {
        await client.query(
          `insert into ops.acceptance_finding (acceptance_row_id, finding_id, linked_by)
           values ($1,$2,$3::ops.principal) on conflict do nothing`, [row.id, findingId, reviewerPrincipal]);
      }
    }
  }

  return counters;
}
