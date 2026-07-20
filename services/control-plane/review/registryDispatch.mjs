// BUILD-014 PR-2b — MODEL-AGNOSTIC role -> reviewer dispatch via the PR-2a registry.
//
// The routing logic contains NO hardcoded model names. It reads reviewer_registry +
// reviewer_authorised_role and maps each REQUIRED ROLE to an AUTHORISED, ENABLED reviewer. Codex
// fills product_qa and Fable fills adversarial TODAY purely because that is their registry grant
// (seed) — a future 'grok' becomes an adversarial reviewer by one registry row + one grant + an
// adapter, with zero change to this file.
//
// The ONLY vocabulary bridge is signer-principal -> DB-principal (the adapters SIGN under
// 'gpt_codex' / 'claude_fable'; the DB principal enum uses 'gpt_codex' / 'fable'), matching the
// existing reviewHandler SIGNER_ROLE. An adapter may instead expose `.reviewerKey` directly
// (preferred + fully extensible) and skip the bridge entirely.
//
// FAIL-CLOSED (correction #4): a REQUIRED role with no enabled authorised reviewer — or with none
// among the PROVIDED adapters — is BLOCKED, NEVER silently downgraded to a product_qa-only review.

// signer principal (envelope HONEST_PROVIDER key) -> DB ops.principal. Matches reviewHandler.
const SIGNER_TO_DB_PRINCIPAL = Object.freeze({
  gpt_codex: 'gpt_codex',
  claude_fable: 'fable',
});

/**
 * Resolve each provided adapter to its registry reviewer_key. Prefers adapter.reviewerKey; else
 * bridges adapter.principal -> DB principal -> reviewer_registry.principal_alias -> reviewer_key.
 * Returns Map<adapter, reviewerKey|null>.
 */
function resolveAdapterKeys(adapters, { aliasToKey }) {
  const map = new Map();
  for (const a of adapters) {
    if (typeof a?.reviewerKey === 'string' && a.reviewerKey) { map.set(a, a.reviewerKey); continue; }
    const dbPrincipal = SIGNER_TO_DB_PRINCIPAL[a?.principal] ?? null;
    map.set(a, dbPrincipal ? (aliasToKey.get(dbPrincipal) ?? null) : null);
  }
  return map;
}

/**
 * dispatchRoles(pool, { requiredRoles, adapters }) ->
 *   { assignments: [{ role, adapter, reviewerKey }], blockedRoles: [{ role, reason }] }
 *
 * For each required role: pick the FIRST provided adapter that resolves to an ENABLED reviewer_key
 * AUTHORISED for that role. If none exists among the adapters, the role is BLOCKED — with a reason
 * that distinguishes "no enabled authorised reviewer exists at all" (reviewer-unavailable) from
 * "an authorised reviewer exists but was not provided to this dispatch" (not-provisioned).
 */
export async function dispatchRoles(pool, { requiredRoles = [], adapters = [] } = {}) {
  const reg = await pool.query(`select reviewer_key, principal_alias::text as alias, enabled from ops.reviewer_registry`);
  const grants = await pool.query(`select reviewer_key, review_role::text as role from ops.reviewer_authorised_role`);

  const enabledByKey = new Map();          // reviewer_key -> enabled
  const aliasToKey = new Map();            // db principal -> reviewer_key
  for (const r of reg.rows) {
    enabledByKey.set(r.reviewer_key, r.enabled);
    if (r.alias) aliasToKey.set(r.alias, r.reviewer_key);
  }
  const roleToKeys = new Map();            // role -> Set<reviewer_key>
  for (const g of grants.rows) {
    if (!roleToKeys.has(g.role)) roleToKeys.set(g.role, new Set());
    roleToKeys.get(g.role).add(g.reviewer_key);
  }
  const roleHasEnabledReviewer = (role) => {
    const keys = roleToKeys.get(role);
    if (!keys) return false;
    for (const k of keys) if (enabledByKey.get(k) === true) return true;
    return false;
  };

  const adapterKeys = resolveAdapterKeys(adapters, { aliasToKey });

  const assignments = [];
  const blockedRoles = [];
  for (const role of requiredRoles) {
    let picked = null;
    for (const a of adapters) {
      const key = adapterKeys.get(a);
      if (!key) continue;
      if (enabledByKey.get(key) !== true) continue;
      const keys = roleToKeys.get(role);
      if (keys && keys.has(key)) { picked = { role, adapter: a, reviewerKey: key }; break; }
    }
    if (picked) { assignments.push(picked); continue; }
    // No dispatchable reviewer for a REQUIRED role -> BLOCKED (never silent).
    const reason = roleHasEnabledReviewer(role)
      ? `role '${role}' has an enabled authorised reviewer in the registry, but no such adapter was provided to this dispatch (not provisioned)`
      : `role '${role}' has NO enabled authorised reviewer in the registry (reviewer-unavailable)`;
    blockedRoles.push({ role, reason });
  }
  return { assignments, blockedRoles };
}
