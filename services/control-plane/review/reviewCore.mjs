// BUILD-014 — shared review-core helpers (extracted from reviewHandler.mjs in PR-2b so both the
// legacy verdict handler AND the PR-2b packet-driven Tower runtime can use them without an import
// cycle). Behaviour is byte-for-byte the WP-C logic; only its home moved. reviewHandler.mjs
// re-exports these for back-compat (ingress/policyGate import canonicalizeShaOrNull from there).

// Honest signer-principal -> (DB reviewer principal, verdict_type) mapping. The adapters sign under
// 'gpt_codex' / 'claude_fable' (envelope HONEST_PROVIDER); the WP-A `principal` enum uses
// 'gpt_codex' / 'fable'. This is the ONLY place the two vocabularies meet — anything not in this
// table is refused, so a mislabelled reviewer can never occupy a role slot.
export const SIGNER_ROLE = Object.freeze({
  gpt_codex:    { reviewer: 'gpt_codex', verdictType: 'correction_loop' },
  claude_fable: { reviewer: 'fable',     verdictType: 'cold_final' },
});

// The adapter verdict vocabulary ({approve|request_changes|comment}) maps 1:1 onto the DB
// verdict_value enum; a blocked/absent/hostile outcome collapses to 'blocked' (default-deny).
export const OK_VERDICTS = new Set(['approve', 'request_changes', 'comment']);

/** JS-side SHA canonicaliser mirroring ops.canonicalize_sha — lower/trim, full-40-hex or null. */
export function canonicalizeShaOrNull(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(v) ? v : null;
}

/**
 * Decide the DB verdict value + role from ONE adapter runTurn result, cross-checking the reviewed
 * head. NEVER throws. Returns { reviewer, verdictType, verdict, promptFingerprint, blockedReason? }
 * — or { refused, reason } when the signer is unmappable.
 */
export function verdictFromAdapterResult(result, checkpointHead) {
  const principal = result?.signerPrincipal ?? result?.envelope?.agent ?? null;
  const role = principal && SIGNER_ROLE[principal];
  if (!role) return { refused: true, reason: `unmappable signer principal: ${String(principal)}` };

  const promptFingerprint =
    typeof result?.envelope?.prompt_fingerprint === 'string' ? result.envelope.prompt_fingerprint : null;

  // Fail-closed: a blocked adapter result is a 'blocked' verdict (never an approve).
  if (!result || result.blocked === true || result.ok !== true) {
    return { ...role, verdict: 'blocked', promptFingerprint,
      blockedReason: String(result?.error ?? result?.structuredResult?.kind ?? 'adapter blocked') };
  }

  // HEAD-ATTESTATION CROSS-CHECK: an ok result whose signed reviewed_head is not THIS head is
  // downgraded to blocked — we refuse to record an approve for a head the reviewer never saw.
  const reviewedHead = canonicalizeShaOrNull(result?.envelope?.reviewed_head);
  if (reviewedHead !== checkpointHead) {
    return { ...role, verdict: 'blocked', promptFingerprint,
      blockedReason: `head attestation mismatch: reviewer signed ${String(result?.envelope?.reviewed_head)}, checkpoint head is ${checkpointHead}` };
  }

  const raw = result?.structuredResult?.verdict;
  const verdict = OK_VERDICTS.has(raw) ? raw : 'blocked';
  return { ...role, verdict, promptFingerprint,
    blockedReason: verdict === 'blocked' ? `non-conforming verdict value: ${String(raw)}` : undefined };
}

/**
 * Record ONE verdict, supersede-then-insert, idempotent. MUST run on a pinned client already inside
 * a transaction. Binds reviewed_commit_sha to the checkpoint's EXACT head (the composite FK
 * checkpoint(id, head_sha) refuses any other). Returns { action: 'inserted'|'unchanged' }.
 */
export async function recordVerdict(client, {
  checkpointId, headSha, reviewer, verdictType, verdict, promptFingerprint = null,
}) {
  const existing = await client.query(
    `select id, verdict, prompt_fingerprint
       from ops.verdict
      where checkpoint_id = $1 and reviewer = $2::ops.principal and verdict_type = $3::ops.verdict_type
        and state = 'active'
      for update`,
    [checkpointId, reviewer, verdictType]);

  if (existing.rowCount === 1) {
    const cur = existing.rows[0];
    // Idempotent retry: an identical active verdict (same value + fingerprint) is left as-is.
    if (cur.verdict === verdict && (cur.prompt_fingerprint ?? null) === (promptFingerprint ?? null)) {
      return { action: 'unchanged' };
    }
    // A genuinely new outcome: supersede the prior active verdict IN THIS TXN.
    await client.query(`update ops.verdict set state = 'superseded' where id = $1`, [cur.id]);
  }

  await client.query(
    `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
     values ($1, ops.canonicalize_sha($2), $3::ops.principal, $4::ops.verdict_type, $5::ops.verdict_value, $6)`,
    [checkpointId, headSha, reviewer, verdictType, verdict, promptFingerprint]);
  return { action: 'inserted' };
}
