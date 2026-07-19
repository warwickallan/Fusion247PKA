// BUILD-014 WP-C — the FUSION POLICY GATE over the Postgres control plane.
//
// Given a checkpoint + its ACTIVE verdicts + (optionally) the CACHED GitHub mechanical state,
// evaluate/maintain the ops.merge_gate row for the build. This is the DUAL-GATE:
//   · FUSION POLICY side (authoritative for POLICY): fusion_policy_decision + expected_head_sha.
//   · CACHED GITHUB MECHANICAL side (PROJECTION; GitHub authoritative): github_*_cached fields.
// We NEVER invent a GitHub fact — the cached fields are LABELLED PROJECTIONS, written only from
// an explicitly-supplied observation (or left 'unknown'/null until one lands).
//
// The DB is the hard enforcer, not this code:
//   · merge_gate_require_reviewers REJECTS fusion_policy_decision='approved' unless BOTH required
//     reviewers (gpt_codex correction_loop + fable cold_final) have an ACTIVE approve at the
//     EXACT head. So we can only ever *attempt* 'approved' when the DB agrees — the JS decision
//     below is belt-and-braces on top of the structural guarantee.
//   · A MOVED head supersedes: only one live gate per build; a new head means supersede-then-
//     insert. overall_action_state for a superseded gate reads 'superseded'.
//   · D1: if a supporting verdict is later superseded, the DB auto-supersedes the approved gate.
//   · Column immutability (R5-1 default-deny): checkpoint_id + expected_head_sha are set at
//     INSERT and NEVER updated; a same-head live gate only ever refreshes its projection /
//     transitions its decision. A new head is always a new row.
//
// OUTCOME-C: the system cannot report merge-readiness ('mergeable') for a DIFFERENT or
// SUPERSEDED head — proven by the e2e tests.

/** Canonical GitHub reviewDecision values (or null = not observed / none required). */
const GH_REVIEW_DECISIONS = new Set(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']);
const GH_MECH_STATES = new Set(['unknown', 'clean', 'blocked', 'behind', 'dirty', 'draft', 'unstable']);

/**
 * Compute the FUSION POLICY decision from readiness + the active verdict set. Pure; never throws.
 *   · both reviewers approve at this head        -> 'approved'
 *   · any active verdict is request_changes/blocked -> 'blocked'
 *   · otherwise (incomplete / comment-only)       -> 'pending'
 */
export function computeFusionDecision({ bothApproved, verdicts = [] }) {
  if (bothApproved) return 'approved';
  if (verdicts.some((v) => v.verdict === 'request_changes' || v.verdict === 'blocked')) return 'blocked';
  return 'pending';
}

/** Normalise a supplied GitHub observation into cached-projection columns (or nulls). Never throws. */
function normaliseGithub(github) {
  if (!github || typeof github !== 'object') return null;
  const mechState = GH_MECH_STATES.has(github.mechState) ? github.mechState : 'unknown';
  const headSha = typeof github.headSha === 'string' && /^[0-9a-f]{40}$/.test(github.headSha.trim().toLowerCase())
    ? github.headSha.trim().toLowerCase() : null;
  const reviewDecision = GH_REVIEW_DECISIONS.has(github.reviewDecision) ? github.reviewDecision : null;
  const observedAt = github.observedAt ?? new Date().toISOString();
  return { mechState, headSha, reviewDecision, observedAt };
}

/**
 * evaluatePolicyGate(pool, { buildId, checkpointId, headSha, github?, policyReason? })
 *   -> { gateId, overallActionState, fusionDecision, bothApproved, superseded, action }
 *
 * Idempotent + serialisation-safe (the DB triggers take the advisory lock on approve/supersede).
 * `github` is an OPTIONAL cached mechanical observation { mechState, headSha, reviewDecision,
 * observedAt } — supply it ONLY from a real GitHub read; omit it to leave the projection untouched.
 */
export async function evaluatePolicyGate(pool, { buildId, checkpointId, headSha, github = null, policyReason = null } = {}) {
  if (!buildId || !checkpointId || !headSha) throw new Error('evaluatePolicyGate: buildId, checkpointId, headSha are required');
  const gh = normaliseGithub(github);

  const client = await pool.connect();
  try {
    await client.query('begin');

    // Lock the current live gate for this build (at most one by the partial unique index).
    const live = await client.query(
      `select * from ops.merge_gate where build_id = $1 and superseded_at is null for update`, [buildId]);
    let liveGate = live.rows[0] ?? null;

    // Readiness (head-bound two-reviewer approve) + the active verdict set at this head.
    const ready = await client.query(
      `select both_reviewers_approved_this_head as both
         from ops.checkpoint_merge_readiness
        where checkpoint_id = $1 and head_sha = ops.canonicalize_sha($2) and build_id = $3`,
      [checkpointId, headSha, buildId]);
    const bothApproved = Boolean(ready.rows[0]?.both);
    const vs = await client.query(
      `select verdict, verdict_type from ops.verdict
        where checkpoint_id = $1 and state = 'active'`, [checkpointId]);
    const fusionDecision = computeFusionDecision({ bothApproved, verdicts: vs.rows });

    // MOVED HEAD: a live gate bound to a different head must be superseded before we record this
    // head — the prior decision can never be carried to a new head.
    let action = 'noop';
    if (liveGate && liveGate.expected_head_sha !== headSha) {
      await client.query(
        `update ops.merge_gate
            set fusion_policy_decision = 'superseded', superseded_at = now(),
                policy_reason = coalesce(policy_reason || ' | ', '') || 'superseded: head moved to a new checkpoint'
          where id = $1`, [liveGate.id]);
      liveGate = null;
      action = 'superseded_prior';
    }

    let gateId;
    if (!liveGate) {
      // No live gate at this head -> born-live insert. 'approved' is only attempted when the DB-
      // backed readiness holds (the require_reviewers trigger is the hard gate regardless).
      const bornDecision = fusionDecision === 'approved' && bothApproved ? 'approved' : (fusionDecision === 'approved' ? 'pending' : fusionDecision);
      const ins = await client.query(
        `insert into ops.merge_gate
           (build_id, checkpoint_id, expected_head_sha, fusion_policy_decision,
            github_mech_state_cached, github_head_sha_cached, github_review_decision_cached, github_observed_at,
            policy_reason)
         values ($1, $2, ops.canonicalize_sha($3), $4::ops.fusion_policy_decision,
                 coalesce($5, 'unknown')::ops.github_mech_state, $6, $7, $8, $9)
         returning id`,
        [buildId, checkpointId, headSha, bornDecision,
         gh?.mechState ?? null, gh?.headSha ?? null, gh?.reviewDecision ?? null, gh?.observedAt ?? null,
         policyReason]);
      gateId = ins.rows[0].id;
      action = action === 'superseded_prior' ? 'superseded_prior+inserted' : 'inserted';
    } else {
      // Live gate at THIS head. checkpoint_id/expected_head_sha are frozen (R5-1); we only refresh
      // the cached projection and, if still pending/blocked, transition the decision. An already-
      // approved gate is left approved (a pure projection refresh) — it can only leave via supersede.
      gateId = liveGate.id;
      if (liveGate.fusion_policy_decision === 'approved') {
        if (gh) {
          await client.query(
            `update ops.merge_gate
                set github_mech_state_cached = $2::ops.github_mech_state, github_head_sha_cached = $3,
                    github_review_decision_cached = $4, github_observed_at = $5,
                    policy_reason = coalesce($6, policy_reason)
              where id = $1`,
            [gateId, gh.mechState, gh.headSha, gh.reviewDecision, gh.observedAt, policyReason]);
          action = 'refreshed_projection';
        }
      } else {
        const nextDecision = fusionDecision === 'approved' && bothApproved ? 'approved' : (fusionDecision === 'approved' ? 'pending' : fusionDecision);
        await client.query(
          `update ops.merge_gate
              set fusion_policy_decision = $2::ops.fusion_policy_decision,
                  github_mech_state_cached = coalesce($3, github_mech_state_cached)::ops.github_mech_state,
                  github_head_sha_cached = coalesce($4, github_head_sha_cached),
                  github_review_decision_cached = coalesce($5, github_review_decision_cached),
                  github_observed_at = coalesce($6, github_observed_at),
                  policy_reason = coalesce($7, policy_reason)
            where id = $1`,
          [gateId, nextDecision, gh?.mechState ?? null, gh?.headSha ?? null, gh?.reviewDecision ?? null, gh?.observedAt ?? null, policyReason]);
        action = 'transitioned';
      }
    }

    await client.query('commit');

    // Read back the derived state (post-commit, fresh) for the caller/cockpit.
    const out = await pool.query(
      `select fusion_policy_decision, expected_head_sha, overall_action_state, superseded_at,
              github_mech_state_cached, github_head_sha_cached, github_review_decision_cached, heads_agree
         from ops.merge_gate where id = $1`, [gateId]);
    const g = out.rows[0];
    return {
      gateId,
      overallActionState: g.overall_action_state,
      fusionDecision: g.fusion_policy_decision,
      bothApproved,
      superseded: g.superseded_at != null,
      action,
    };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Read the current live gate's derived state for a build (or null). For cockpit/tests. */
export async function readLiveGate(pool, buildId) {
  const { rows } = await pool.query(
    `select id, checkpoint_id, expected_head_sha, fusion_policy_decision, overall_action_state,
            github_mech_state_cached, github_head_sha_cached, github_review_decision_cached, heads_agree, superseded_at
       from ops.merge_gate where build_id = $1 and superseded_at is null`, [buildId]);
  return rows[0] ?? null;
}
