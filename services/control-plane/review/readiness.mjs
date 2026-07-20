// BUILD-014 PR-2b — the review -> readiness path, feature-gated (Warwick correction B).
//
// Reads ops.checkpoint_effective_readiness (PR-2a), the GOVERNING read model:
//   · flag OFF (DEFAULT) -> delegates to 001's LEGACY both-required policy — historical readiness
//     is byte-for-byte unchanged, so nothing changes live in this PR.
//   · flag ON  -> the role-based policy governs (all required roles satisfied AND not blocked).
//
// PR-2b WIRES this reader into the runtime and PROVES both branches in tests, but DOES NOT flip the
// flag: role_based_readiness stays OFF by default (PR-2a seeded it OFF; nothing here changes it).
// Live activation is a Warwick gate (activation + product-QA-prompt approval), never a code default.

/**
 * readEffectiveReadiness(pool, checkpointId) -> the governing readiness row, or null if the
 * checkpoint has no readiness projection yet. Shape mirrors ops.checkpoint_effective_readiness.
 */
export async function readEffectiveReadiness(pool, checkpointId) {
  const { rows } = await pool.query(
    `select checkpoint_id, build_id, head_sha, role_based_active, governing_policy,
            effective_merge_ready, legacy_both_reviewers_approved,
            role_based_all_required_satisfied, role_based_blocked_reviewer_unavailable
       from ops.checkpoint_effective_readiness where checkpoint_id = $1`, [checkpointId]);
  return rows[0] ?? null;
}

/** Whether role-based readiness is currently the governing policy (flag ON). */
export async function roleBasedReadinessEnabled(pool) {
  const { rows } = await pool.query(`select ops.role_based_readiness_enabled() as on`);
  return rows[0]?.on === true;
}
