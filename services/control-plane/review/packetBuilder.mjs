// BUILD-014 PR-2b — the Tower packet-builder (TRUSTED runtime).
//
// Given a checkpoint, RESOLVE every required evidence source and build ONE canonical, immutable,
// HASHED snapshot (review_packet, PR-2a). This is the TRUST CORE: the trusted Tower runtime holds
//   · read-only GitHub access (source, base..head diff, Actions/CI) — INJECTED as `evidenceSources`
//     so CI/tests drive fakes + a real-diff fixture; production wires the real allowlisted git; AND
//   · Supabase reviewer-view access (PRD/Plan versions, acceptance rows, prior open findings,
//     Warwick decisions) — read here directly via the pool.
// The reviewer MODEL SUBPROCESSES NEVER get this access — they receive ONLY the staged packet.
//
// FAIL-CLOSED (correction #2/#3): if ANY required source is unresolvable -> packet state='blocked'
// with a reason, outcome 'BLOCKED — review evidence incomplete'. NO SILENT TRUNCATION: if mandatory
// evidence cannot fit (the git source signals a truncated diff) -> BLOCKED (require split/approved
// bounded scope). Never "review the available bits."
//
// The persisted resolved_payload + packet_hash is the exact evidence set the reviewers saw — both
// reviewers get the SAME packet_hash; only the PROMPT differs (recorded on review_run).

import crypto from 'node:crypto';
import { canonicalize } from './envelope.mjs';

/** Canonical content hash of the resolved payload (key-order independent via RFC-8785-ish canon). */
export function packetHash(payload) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalize(payload), 'utf8').digest('hex');
}

const BLOCKED_OUTCOME = 'BLOCKED — review evidence incomplete';

// The DEFAULT mandatory evidence sources. A production wiring may add 'ci'. 'open_findings' is NOT
// mandatory (a build may legitimately have zero open findings — but ALL that exist are injected).
export const DEFAULT_MANDATORY = Object.freeze(['git', 'prd', 'plan', 'acceptance_rows']);

/**
 * createPacketBuilder({ pool, evidenceSources, mandatory?, log? }) -> { buildPacket({ checkpointId, checkpoint? }) }
 *
 * `evidenceSources` (the CI/test seam, mirrors the injected `reviewers`):
 *   · resolveGit({ repo, branch, headSha }) -> { ok, baseSha, headSha, diffRange, changedFiles,
 *       diffText, truncated, ci, error } — read-only GitHub. `truncated:true` => fail-closed.
 *   · resolveWarwickDecisions?({ buildId }) -> { ok, decisions[] }  (soft; empty is a valid resolve)
 * DB-backed sources (PRD/Plan/acceptance/findings) are read here directly from the pool — the
 * trusted runtime's Supabase reviewer-view access, NEVER handed to a reviewer subprocess.
 */
export function createPacketBuilder({ pool, evidenceSources = {}, mandatory = DEFAULT_MANDATORY, log } = {}) {
  if (!pool) throw new Error('createPacketBuilder: pool is required');
  if (typeof evidenceSources.resolveGit !== 'function') {
    throw new Error('createPacketBuilder: evidenceSources.resolveGit is required (the injectable read-only git seam)');
  }
  const mandatorySet = new Set(mandatory);

  /** The assurance_profile_ref is a nullable convenience FK -> checkpoint_assurance(checkpoint_id).
   * Only reference it when the row actually exists (self-safe whether or not the orchestrator
   * persisted assurance first), so the packet build never FK-fails on a missing profile. */
  async function assuranceRef(checkpointId) {
    const r = await pool.query('select 1 from ops.checkpoint_assurance where checkpoint_id=$1', [checkpointId]);
    return r.rowCount === 1 ? checkpointId : null;
  }

  /** Insert a BLOCKED packet row (when we have a base_sha to satisfy NOT NULL); else return no-row. */
  async function persistBlocked({ checkpoint, baseSha, reason, prdVersionId = null, planVersionId = null }) {
    if (!baseSha) {
      // Cannot even resolve base -> no review_packet row is constructable (base_sha is NOT NULL).
      // Return a row-less blocked outcome; the caller records a durable blocked event.
      log?.warn?.('packet.blocked_no_row', { checkpointId: checkpoint.id, reason });
      return { state: 'blocked', packetId: null, packetHash: null, blockedReason: reason, outcome: BLOCKED_OUTCOME, resolvedPayload: null };
    }
    const aref = await assuranceRef(checkpoint.id);
    const { rows } = await pool.query(
      `insert into ops.review_packet
         (build_id, checkpoint_id, exact_head_sha, base_sha, prd_version_id, plan_version_id,
          assurance_profile_ref, state, blocked_reason)
       values ($1,$2,$3,$4,$5,$6,$7,'blocked',$8) returning id`,
      [checkpoint.build_id, checkpoint.id, checkpoint.head_sha, baseSha,
        prdVersionId, planVersionId, aref, reason]);
    return { state: 'blocked', packetId: rows[0].id, packetHash: null, blockedReason: reason, outcome: BLOCKED_OUTCOME, resolvedPayload: null };
  }

  return {
    async buildPacket({ checkpointId, checkpoint: cpArg = null, git: gitArg = null }) {
      // (0) Load the checkpoint's OWN recorded head (never trust a payload copy).
      let checkpoint = cpArg;
      if (!checkpoint) {
        const cp = await pool.query(
          `select c.id, c.build_id, c.checkpoint_ref, c.head_sha, c.branch, c.brief_ref,
                  b.build_ref, b.repo
             from ops.checkpoint c join ops.build b on b.id = c.build_id
            where c.id = $1`, [checkpointId]);
        if (cp.rowCount !== 1) {
          return { state: 'blocked', packetId: null, packetHash: null,
            blockedReason: `checkpoint ${checkpointId} not found`, outcome: BLOCKED_OUTCOME, resolvedPayload: null };
        }
        checkpoint = cp.rows[0];
      }

      // (1) GIT (read-only) — base..head diff, changed files, CI. Mandatory + no silent truncation.
      // A pre-resolved git result may be injected (the orchestrator resolves it once for risk-routing
      // AND the packet, so the real read-only git read is not run twice).
      let git = gitArg;
      if (!git) {
        try {
          git = await evidenceSources.resolveGit({
            repo: checkpoint.repo, branch: checkpoint.branch, headSha: checkpoint.head_sha });
        } catch (e) {
          git = { ok: false, error: `git source threw: ${String(e?.message ?? e)}` };
        }
      }
      if (mandatorySet.has('git')) {
        if (!git?.ok) {
          return persistBlocked({ checkpoint, baseSha: git?.baseSha ?? null,
            reason: `git evidence unresolvable: ${git?.error ?? 'no result'}` });
        }
        if (git.truncated === true) {
          // NO SILENT TRUNCATION: mandatory evidence that cannot fit is a BLOCK, not a partial review.
          return persistBlocked({ checkpoint, baseSha: git.baseSha ?? null,
            reason: 'diff exceeds the review bound (truncated) — split the checkpoint or obtain an approved bounded scope; NOT reviewing the available bits' });
        }
        if (!git.baseSha) {
          return persistBlocked({ checkpoint, baseSha: null, reason: 'git evidence resolved without a base_sha (base..head diff unbindable)' });
        }
      }
      const baseSha = git?.baseSha ?? null;

      // (2) CONTRACT — the EXACT active PRD + Plan versions (trusted DB reviewer-view read).
      const prdRes = await pool.query(
        `select id, prd_key, version from ops.prd where build_id=$1 and state='active' order by created_at desc, id desc limit 1`,
        [checkpoint.build_id]);
      const prd = prdRes.rows[0] ?? null;
      if (mandatorySet.has('prd') && !prd) {
        return persistBlocked({ checkpoint, baseSha, reason: 'no ACTIVE PRD version for the build — contract unresolved' });
      }
      const planRes = await pool.query(
        `select id, plan_key, version from ops.plan where build_id=$1 and state='active' order by created_at desc, id desc limit 1`,
        [checkpoint.build_id]);
      const plan = planRes.rows[0] ?? null;
      if (mandatorySet.has('plan') && !plan) {
        return persistBlocked({ checkpoint, baseSha, reason: 'no ACTIVE Plan version for the build — contract unresolved',
          prdVersionId: prd?.id ?? null });
      }

      // (3) ACCEPTANCE ROWS — the ordinary user-journey requirements (bound to the active PRD).
      const accRes = prd ? await pool.query(
        `select id, acceptance_ref, requirement_text, expected_proof, owning_wp_id
           from ops.acceptance_row where build_id=$1 and prd_version_id=$2 order by acceptance_ref`,
        [checkpoint.build_id, prd.id]) : { rows: [] };
      const acceptanceRows = accRes.rows;
      if (mandatorySet.has('acceptance_rows') && acceptanceRows.length === 0) {
        return persistBlocked({ checkpoint, baseSha, reason: 'no acceptance rows for the active PRD — nothing to product-QA against',
          prdVersionId: prd?.id ?? null, planVersionId: plan?.id ?? null });
      }

      // (4) PRIOR OPEN FINDINGS — ALL of them (explicit consumption; no silent carry-over).
      const findRes = await pool.query(
        `select id, finding_ref, severity::text as severity, title, state::text as state
           from ops.finding where build_id=$1 and state='open' order by finding_ref`,
        [checkpoint.build_id]);
      const openFindings = findRes.rows;

      // (5) WARWICK DECISIONS — soft (no decisions table yet in 001/003; empty is a valid resolve).
      let warwickDecisions = [];
      if (typeof evidenceSources.resolveWarwickDecisions === 'function') {
        try {
          const wd = await evidenceSources.resolveWarwickDecisions({ buildId: checkpoint.build_id });
          if (mandatorySet.has('warwick_decisions') && !wd?.ok) {
            return persistBlocked({ checkpoint, baseSha, reason: `Warwick decisions unresolvable: ${wd?.error ?? 'no result'}`,
              prdVersionId: prd?.id ?? null, planVersionId: plan?.id ?? null });
          }
          warwickDecisions = Array.isArray(wd?.decisions) ? wd.decisions : [];
        } catch (e) {
          if (mandatorySet.has('warwick_decisions')) {
            return persistBlocked({ checkpoint, baseSha, reason: `Warwick decisions source threw: ${String(e?.message ?? e)}`,
              prdVersionId: prd?.id ?? null, planVersionId: plan?.id ?? null });
          }
        }
      }

      // (6) BUILD THE RESOLVED IMMUTABLE PAYLOAD (canonical) + hash it.
      const resolvedPayload = {
        schema: 'tower.review-packet/v1',
        checkpoint: {
          checkpoint_id: checkpoint.checkpoint_ref, head_sha: checkpoint.head_sha,
          base_sha: baseSha, branch: checkpoint.branch ?? null, brief_ref: checkpoint.brief_ref ?? null,
        },
        build: { build_id: checkpoint.build_ref, repo: checkpoint.repo ?? null },
        contract: {
          prd_version_id: prd?.id ?? null, prd_key: prd?.prd_key ?? null, prd_version: prd?.version ?? null,
          plan_version_id: plan?.id ?? null, plan_key: plan?.plan_key ?? null, plan_version: plan?.version ?? null,
        },
        diff: {
          diff_range: git?.diffRange ?? (baseSha ? `${baseSha}..${checkpoint.head_sha}` : null),
          changed_files: Array.isArray(git?.changedFiles) ? git.changedFiles : [],
          diff_text: git?.diffText ?? null,
        },
        ci: git?.ci ?? null,
        acceptance_rows: acceptanceRows.map((a) => ({
          id: a.id, acceptance_ref: a.acceptance_ref, requirement_text: a.requirement_text,
          expected_proof: a.expected_proof ?? null, owning_wp_id: a.owning_wp_id ?? null,
        })),
        open_findings: openFindings.map((f) => ({
          id: f.id, finding_ref: f.finding_ref, severity: f.severity, title: f.title ?? null, state: f.state,
        })),
        warwick_decisions: warwickDecisions,
        assurance_profile_ref: checkpoint.id,
      };
      const hash = packetHash(resolvedPayload);

      // (7) PERSIST as a READY, hashed, immutable packet (born ready is legal; consumed/stale are not).
      const aref = await assuranceRef(checkpoint.id);
      const { rows } = await pool.query(
        `insert into ops.review_packet
           (build_id, checkpoint_id, exact_head_sha, base_sha, prd_version_id, plan_version_id,
            assurance_profile_ref, resolved_payload, packet_hash, state)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'ready') returning id`,
        [checkpoint.build_id, checkpoint.id, checkpoint.head_sha, baseSha,
          prd?.id ?? null, plan?.id ?? null, aref,
          JSON.stringify(resolvedPayload), hash]);

      return {
        state: 'ready', packetId: rows[0].id, packetHash: hash, blockedReason: null,
        outcome: 'READY', resolvedPayload,
        prdVersionId: prd?.id ?? null, planVersionId: plan?.id ?? null,
        baseSha, headSha: checkpoint.head_sha,
      };
    },
  };
}
