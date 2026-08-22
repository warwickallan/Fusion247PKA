-- =============================================================================
-- MyPKA cockpit migration 290 — cp_worker may READ a shop's owning household
--
-- WHY. Codex finding F-1 (2026-08-15): `add_list_item` validated `shop_id` only as a
-- positive integer and resolved `household_id` separately, never comparing the two — so a
-- foreign household's shop could be handed this household's list (a leak) or, worse, could
-- reclaim this household's unowned list and become its owner (a corruption). The correction
-- in services/control-plane/wp-d-proof/asdairCommands.mjs proves ownership before any read,
-- reclaim or create, which requires reading `asdair.shop.household_id`.
--
-- cp_worker had no privilege on `asdair.shop` at all. The guard therefore FAILS CLOSED on
-- that role — permission denied, nothing written — which is safe but would surface as a
-- broken cockpit lane at the worst possible moment rather than as a refusal.
--
-- HOW THE GAP WAS FOUND, recorded because the mechanism matters more than the fix: the
-- committed least-privilege proof at add-list-item.dbtest.mjs assertion (e) runs the whole
-- write path AS cp_worker rather than as superuser. It went red the moment the guard
-- landed. It was not a test to repair — it is a control, and it fired. Do not "fix" a red
-- (e) by narrowing the proof.
--
-- REACHABILITY, stated honestly. cp_worker serves the cockpit `command_request` lane, which
-- carries no shop behind it and is BELIEVED never to supply a `shop_id`. That belief is
-- INFERENCE from the code and the grant matrix, NOT something anyone has executed against
-- the live route. This grant makes the cost of that inference being wrong a refusal instead
-- of a crash. The path that genuinely supplies `shop_id` today is the AsdAIr pipeline, which
-- connects as asdair_rw and already holds select/insert/update on asdair.shop via
-- services/asdair/db/012_complete_grant_matrix.sql.
--
-- COLUMN-SCOPED ON PURPOSE. The guard reads exactly `id, household_id`. Granting those two
-- columns and no others keeps 040's boundary intact ("Neither can touch anything else in
-- asdair") — a `select *` on asdair.shop as cp_worker is still refused, by design. If a
-- later change needs another column on this role's path, widen this grant deliberately
-- rather than discovering it as a runtime failure.
--
-- ADDITIVE AND INDEPENDENT OF 040. This grants; it revokes nothing and rewrites nothing.
-- 040's own revoke block enumerates command_request, shopping_lists, shopping_list_items,
-- regulars and households — it does NOT name asdair.shop, so re-applying 040 after this
-- migration cannot silently take this privilege away.
--
-- Idempotent. Forward-only. NO secrets and NO rows — structure only.
-- Depends on: 020_cockpit_roles.sql (the cp_worker role) and asdair migration 006
-- (asdair.shop). Guarded on both, so it is a clean no-op where either is absent.
--
-- NOT APPLIED TO ANY LIVE DATABASE BY THIS FILE OR BY ITS AUTHOR. Authored under
-- WO-2026-08-15-01 with live_authority: none; applying it is Larry's on Warwick's decision.
-- Proven against a disposable local cluster only, by add-list-item.dbtest.mjs assertion (e)
-- red without this file and green with it.
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cp_worker') then
    raise notice '290: role cp_worker does not exist on this database - skipping (provision it with 020_cockpit_roles.sql first)';
    return;
  end if;
  if to_regclass('asdair.shop') is null then
    raise notice '290: asdair.shop does not exist on this database - skipping (apply asdair migration 006 first)';
    return;
  end if;

  -- The ownership check, and nothing wider: prove a supplied shop_id belongs to the
  -- household the command already resolved.
  execute 'grant select (id, household_id) on asdair.shop to cp_worker';
end $$;

commit;
