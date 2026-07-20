// BUILD-014 PR-2b — the packet-driven Tower review orchestration (the runtime trust core).
//
// Flow, per checkpoint:
//   1. Resolve read-only git ONCE; compute + persist checkpoint_assurance from the ACTUAL diff
//      surface (risk-routing, Part B) — product_qa always, adversarial/security/warwick raised by
//      the touched surface, auto_merge EXPLICIT.
//   2. Build ONE canonical, hashed, immutable review_packet (fail-closed: unresolved/truncated
//      mandatory evidence -> BLOCKED, never a partial review).
//   3. Dispatch the REQUIRED ROLES to AUTHORISED, ENABLED reviewers via the registry (model-
//      agnostic). A required role with no dispatchable reviewer -> BLOCKED (never silent product_qa).
//   4. Stage the SAME packet_hash + evidence to each reviewer with the VERSIONED product-QA prompt
//      (acceptance-first, all prior open findings). Reviewer subprocesses get ONLY the staged
//      evidence (adapter secret-stripping preserved) — never DB/GitHub creds.
//   5. Write a review_run per reviewer (prompt_version + fingerprint, packet_hash, exact head,
//      prd/plan versions, honest registry identity, outcome, evidence_accessed) + keep the legacy
//      head-attestation cross-check (downgrade to blocked on a signed head != checkpoint head) +
//      keep writing the legacy verdict for legacy principals so the flag-OFF governing readiness
//      is unchanged.
//   6. Mark the packet consumed; return the outcome + the (feature-gated) effective readiness.

import { appendEvent } from '../worker/events.mjs';
import { verdictFromAdapterResult, recordVerdict, SIGNER_ROLE } from './reviewCore.mjs';
import { deriveDiffSurfaces, computeAssurance, persistAssurance, requiredRolesFromProfile } from './riskRouting.mjs';
import { dispatchRoles } from './registryDispatch.mjs';
import { readEffectiveReadiness } from './readiness.mjs';
import {
  validateReviewerResult, dispositionBlocksMerge, acceptanceFailed, persistReviewerClassification,
} from './reviewClassification.mjs';

const OUTCOME_MAP = Object.freeze({
  approve: 'approved',
  request_changes: 'changes_requested',
  comment: 'comment',
  blocked: 'blocked',
});

// Effective run outcome -> the legacy ops.verdict_value (so the flag-OFF readiness stays consistent
// with the disposition-derived outcome, not the raw reviewer verdict).
const OUTCOME_TO_VERDICT = Object.freeze({
  approved: 'approve',
  changes_requested: 'request_changes',
  comment: 'comment',
  blocked: 'blocked',
});

/** Shape the resolved packet payload into the packet arg the ported adapters expect. */
function adapterPacketFrom(resolvedPayload, packetHash) {
  const rp = resolvedPayload ?? {};
  return {
    checkpoint_id: rp.checkpoint?.checkpoint_id ?? null,
    build_id: rp.build?.build_id ?? null,
    wp_id: null,
    repo: rp.build?.repo ?? '(local working tree)',
    branch: rp.checkpoint?.branch ?? '(unknown)',
    head_sha: rp.checkpoint?.head_sha ?? null,
    base_sha: rp.checkpoint?.base_sha ?? null,
    diff_range: rp.diff?.diff_range ?? null,
    changed_files: Array.isArray(rp.diff?.changed_files) ? rp.diff.changed_files : [],
    diff_text: rp.diff?.diff_text ?? null,
    brief_ref: rp.checkpoint?.brief_ref ?? null,
    summary: null,
    acceptance_rows: Array.isArray(rp.acceptance_rows) ? rp.acceptance_rows : [],
    open_findings: Array.isArray(rp.open_findings) ? rp.open_findings : [],
    evidence_refs: (rp.acceptance_rows ?? []).map((a) => a.acceptance_ref),
    ci_checks: rp.ci ? JSON.stringify(rp.ci) : null,
    packet_hash: packetHash,
  };
}

/**
 * runTowerReview(opts) -> {
 *   status: 'succeeded'|'failed',
 *   outcome: 'REVIEWED'|'BLOCKED — review evidence incomplete'|'BLOCKED — required reviewer unavailable',
 *   assurance, packet, runs, blockedRoles, readiness
 * }
 */
export async function runTowerReview({
  pool, checkpointId, checkpoint: cpArg = null, reviewers = [],
  packetBuilder, productQaPrompt, evidenceSources = {}, riskInput = {}, findingLinker, log,
}) {
  if (!packetBuilder) throw new Error('runTowerReview: packetBuilder is required');
  if (!productQaPrompt?.ok) {
    // The versioned product-QA prompt failed to load (fail-closed) — refuse to review headless.
    return { status: 'failed', outcome: 'BLOCKED — product-QA prompt unavailable',
      error: productQaPrompt?.error ?? 'productQaPrompt not loaded', runs: [] };
  }

  // (0) Load the checkpoint's OWN recorded head (never trust a payload copy).
  let checkpoint = cpArg;
  if (!checkpoint) {
    const cp = await pool.query(
      `select c.id, c.build_id, c.checkpoint_ref, c.head_sha, c.branch, c.brief_ref, b.build_ref, b.repo
         from ops.checkpoint c join ops.build b on b.id = c.build_id where c.id = $1`, [checkpointId]);
    if (cp.rowCount !== 1) return { status: 'failed', outcome: 'checkpoint not found', runs: [] };
    checkpoint = cp.rows[0];
  }
  const headSha = checkpoint.head_sha;

  // (1) Resolve git ONCE for risk-routing + the packet.
  let git = null;
  try {
    git = await evidenceSources.resolveGit?.({ repo: checkpoint.repo, branch: checkpoint.branch, headSha });
  } catch (e) { git = { ok: false, error: `git source threw: ${String(e?.message ?? e)}` }; }

  // (2) Compute + persist the checkpoint assurance profile (Part B risk-routing). Surfaces come from
  // the ACTUAL diff; wpBaseline may be injected (riskInput.wpBaseline); Warwick stress flags too.
  const diffSurfaces = git?.ok
    ? deriveDiffSurfaces({ changedFiles: git.changedFiles, diffText: git.diffText })
    : [];
  const profile = computeAssurance({
    wpBaseline: riskInput.wpBaseline ?? null,
    diffSurfaces,
    warwickStressFlags: riskInput.warwickStressFlags ?? [],
  });
  await persistAssurance(pool, { checkpointId: checkpoint.id, buildId: checkpoint.build_id, profile });

  // (3) Build the packet (pass the pre-resolved git so the read-only diff is not fetched twice).
  const packet = await packetBuilder.buildPacket({ checkpointId: checkpoint.id, checkpoint, git });
  if (packet.state === 'blocked') {
    await recordBlockedEvent(pool, checkpoint, `packet:${packet.blockedReason}`, log);
    const readiness = await readEffectiveReadiness(pool, checkpoint.id);
    return { status: 'succeeded', outcome: packet.outcome, assurance: profile, packet, runs: [], blockedRoles: [], readiness };
  }

  // (4) Dispatch required roles -> authorised, enabled reviewers (registry-driven, model-agnostic).
  const requiredRoles = requiredRolesFromProfile(profile);
  const { assignments, blockedRoles } = await dispatchRoles(pool, { requiredRoles, adapters: reviewers });
  if (blockedRoles.length > 0) {
    // A REQUIRED role has no dispatchable reviewer -> BLOCKED (never silently product_qa-only).
    await recordBlockedEvent(pool, checkpoint,
      `dispatch:${blockedRoles.map((b) => b.reason).join('; ')}`, log);
    const readiness = await readEffectiveReadiness(pool, checkpoint.id);
    return { status: 'succeeded', outcome: 'BLOCKED — required reviewer unavailable',
      assurance: profile, packet, runs: [], blockedRoles, readiness };
  }

  // (5) Run each assigned reviewer against the SAME packet + staged product-QA prompt.
  const adapterPacket = adapterPacketFrom(packet.resolvedPayload, packet.packetHash);
  const checkpointArg = { checkpoint_id: checkpoint.checkpoint_ref, head_sha: headSha };
  const stagedSkillText = productQaPrompt.assemble({ packet: packet.resolvedPayload });
  const runs = [];

  for (const { role, adapter, reviewerKey } of assignments) {
    // Idempotency: a completed run for this (packet, reviewer, role) already exists -> skip (a
    // re-review is a NEW run only when deliberately re-triggered, not on an at-least-once retry).
    const dup = await pool.query(
      `select id, outcome::text as outcome from ops.review_run
        where review_packet_id=$1 and reviewer_key=$2 and review_role=$3::ops.review_role
        order by created_at desc limit 1`,
      [packet.packetId, reviewerKey, role]);
    if (dup.rowCount === 1 && dup.rows[0].outcome !== 'pending') {
      runs.push({ role, reviewerKey, reviewRunId: dup.rows[0].id, outcome: dup.rows[0].outcome, deduped: true });
      continue;
    }

    let result;
    try {
      result = await adapter.runTurn({
        checkpoint: checkpointArg, packet: adapterPacket, skillText: stagedSkillText,
        promptFingerprint: productQaPrompt.promptFingerprint,
      });
    } catch {
      result = { ok: false, blocked: true, signerPrincipal: adapter?.principal ?? null,
        error: 'adapter runTurn threw', structuredResult: { status: 'blocked', kind: 'adapter_threw' } };
    }

    // Head-attestation cross-check preserved (downgrade to blocked on a signed head != checkpoint head).
    const decision = verdictFromAdapterResult(result, headSha);
    const refused = decision.refused === true;
    // adapterBlocked = the adapter itself blocked, OR head-mismatch / non-conforming verdict downgrade.
    const adapterBlocked = !refused && decision.verdict === 'blocked';

    // FAIL-CLOSED classification validation (Condition 2): a non-blocked reviewer result MUST carry the
    // explicit machine-readable answers — a per-acceptance result, a per-prior-finding disposition, and
    // three-axis-classified findings — or the review is BLOCKED (never accepted with answers buried in
    // summary). The DISPOSITION (not severity) then decides the merge (amendment merge rule).
    let classValidation = { ok: true, errors: [] };
    let effectiveVerdict = decision.verdict;
    let persistClassification = false;
    if (!refused && !adapterBlocked) {
      classValidation = validateReviewerResult(result?.structuredResult, {
        acceptanceRows: packet.resolvedPayload.acceptance_rows ?? [],
        openFindings: packet.resolvedPayload.open_findings ?? [],
      });
      if (!classValidation.ok) {
        effectiveVerdict = 'blocked'; // answers missing/malformed -> fail-closed
      } else {
        const sr = result.structuredResult;
        const blocks = dispositionBlocksMerge(sr.findings) || acceptanceFailed(sr.acceptance_results);
        effectiveVerdict = blocks ? 'request_changes' : decision.verdict;
        persistClassification = true; // validated + head-matched -> persist the answers to the records
      }
    }
    const runOutcome = refused ? 'blocked' : (OUTCOME_MAP[effectiveVerdict] ?? 'blocked');
    const promptVersion = role === 'product_qa'
      ? productQaPrompt.promptVersion
      : `${productQaPrompt.promptVersion}+adversarial-cold-final(builtin)`;
    const evidenceAccessed = [
      ...(packet.resolvedPayload.acceptance_rows ?? []).map((a) => `acceptance:${a.acceptance_ref}`),
      ...(packet.resolvedPayload.open_findings ?? []).map((f) => `finding:${f.finding_ref}`),
      packet.resolvedPayload.diff?.diff_range ? `diff:${packet.resolvedPayload.diff.diff_range}` : null,
    ].filter(Boolean);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const ins = await client.query(
        `insert into ops.review_run
           (review_packet_id, reviewer_key, review_role, model_provider, model_id,
            prompt_version, prompt_fingerprint, packet_hash, reviewed_head_sha,
            prd_version_id, plan_version_id, completed_at, outcome, evidence_accessed)
         values ($1,$2,$3::ops.review_role,$4,$5,$6,$7,$8,$9,$10,$11, now(), $12::ops.review_outcome, $13)
         returning id`,
        [packet.packetId, reviewerKey, role,
          result?.envelope?.provider ?? null, result?.envelope?.model_id ?? null,
          promptVersion, productQaPrompt.promptFingerprint, packet.packetHash, headSha,
          packet.prdVersionId, packet.planVersionId, runOutcome, evidenceAccessed]);
      const reviewRunId = ins.rows[0].id;

      // WRITE-PATH (Condition 2): persist the validated answers to the APPEND-ONLY records — in THIS
      // same transaction so it commits/rolls back atomically with the run (retry-idempotent: a rolled-
      // back attempt persisted nothing; a committed run is skipped by the dedup above; and each write is
      // itself idempotent at the same head). Only when the result is head-matched + classification-valid.
      if (persistClassification) {
        await persistReviewerClassification(client, {
          buildId: checkpoint.build_id, checkpointId: checkpoint.id, checkpointRef: checkpoint.checkpoint_ref,
          headSha, reviewerPrincipal: decision.reviewer, reviewRunId,
          prdVersionId: packet.prdVersionId, planVersionId: packet.planVersionId,
          acceptanceRows: packet.resolvedPayload.acceptance_rows ?? [],
          openFindings: packet.resolvedPayload.open_findings ?? [],
          structuredResult: result.structuredResult,
        });
      }

      // Legacy verdict for legacy principals (preserves flag-OFF governing readiness). Uses the
      // DISPOSITION-derived effective verdict (amendment merge rule), not the raw reviewer verdict. A
      // non-legacy reviewer (e.g. a future grok) has no SIGNER_ROLE mapping -> review_run only.
      if (!refused && SIGNER_ROLE[result?.signerPrincipal ?? result?.envelope?.agent]) {
        await recordVerdict(client, {
          checkpointId: checkpoint.id, headSha, reviewer: decision.reviewer, verdictType: decision.verdictType,
          verdict: OUTCOME_TO_VERDICT[runOutcome] ?? 'blocked', promptFingerprint: productQaPrompt.promptFingerprint });
      }

      // review_run_finding: only from an EXPLICIT linker (never fabricated from fuzzy text). The linker
      // maps the reviewer result -> [{ findingId, relation∈{opened,closed} }] against real ops.finding ids.
      const links = typeof findingLinker === 'function'
        ? (findingLinker({ result, packet, role, reviewRunId }) ?? []) : [];
      for (const lk of links) {
        await client.query(
          `insert into ops.review_run_finding (review_run_id, finding_id, relation) values ($1,$2,$3)
             on conflict do nothing`,
          [reviewRunId, lk.findingId, lk.relation]);
      }

      await appendEvent(client, {
        buildId: checkpoint.build_id,
        deliveryKey: `review_run:${reviewRunId}`,
        eventKind: 'review.run_recorded',
        actor: 'tower',
        payload: { checkpointId: checkpoint.id, headSha, packetHash: packet.packetHash, reviewerKey, role, outcome: runOutcome, promptVersion },
      });
      await client.query('commit');
      const blockedReason = decision.blockedReason
        ?? (!classValidation.ok ? `classification fail-closed: ${classValidation.errors.slice(0, 4).join('; ')}` : null);
      runs.push({ role, reviewerKey, reviewRunId, outcome: runOutcome, promptVersion, blockedReason });
    } catch (err) {
      await client.query('rollback').catch(() => {});
      log?.warn?.('review.run_write_failed', { checkpointId: checkpoint.id, reviewerKey, role });
      client.release();
      return { status: 'failed', outcome: 'review_run write failed', assurance: profile, packet, runs, blockedRoles: [] };
    } finally {
      client.release?.();
    }
  }

  // (6) Mark the packet consumed (ready -> consumed) — proves a run read it. Idempotent.
  await pool.query(`update ops.review_packet set state='consumed' where id=$1 and state='ready'`, [packet.packetId]);

  const readiness = await readEffectiveReadiness(pool, checkpoint.id);
  return { status: 'succeeded', outcome: 'REVIEWED', assurance: profile, packet, runs, blockedRoles: [], readiness };
}

async function recordBlockedEvent(pool, checkpoint, reason, log) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await appendEvent(client, {
      buildId: checkpoint.build_id,
      deliveryKey: `review_blocked:${checkpoint.id}:${checkpoint.head_sha}:${reason.slice(0, 40)}`,
      eventKind: 'review.blocked',
      actor: 'tower',
      payload: { checkpointId: checkpoint.id, headSha: checkpoint.head_sha, reason },
    });
    await client.query('commit');
  } catch {
    await client.query('rollback').catch(() => {});
    log?.warn?.('review.blocked_event_failed', { checkpointId: checkpoint.id });
  } finally { client.release(); }
}
