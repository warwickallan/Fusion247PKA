-- =====================================================================
-- AsdAIr - migration 010: households / budget_settings / shopping_lists /
--                         shopping_list_items / product_alternatives grants
--
-- WHY THIS FILE EXISTS (WO-2026-08-03-ASDAIR-HOUSEHOLDS-PERM-01, live
-- incident): SHOP-2026-08-03 repeatedly failed with "permission denied for
-- table households". Larry re-granted SELECT on asdair.households to both
-- asdair_ro and asdair_rw directly against the live database via Supabase's
-- migration tool, and confirmed with has_table_privilege() that both grants
-- are genuinely in place right now.
--
-- THE GAP THIS CLOSES: that grant, and the equivalent grants this same
-- access model implies for asdair.budget_settings, asdair.shopping_lists,
-- asdair.shopping_list_items and asdair.product_alternatives, existed
-- NOWHERE in git. None of 005/006/008/009 - the migrations that DO carry
-- every other asdair_ro/asdair_rw grant in this schema - ever mention any
-- of these five tables. So the schema-as-code and the schema-as-deployed
-- have been silently out of sync on exactly these tables since WP1
-- (001_asdair_schema.sql): whatever privilege has been getting the service
-- through until now was never committed, which means a role recreated or
-- reset from git alone reproduces this exact failure. This migration is
-- the durable fix - restating the grant so git is the source of truth
-- again, the same reasoning 005 used to restate the 2026-07-27 asdair_rw
-- provisioning.
--
-- WHO ACTUALLY TOUCHES WHAT (read by tracing the real code, not assumed):
--   asdair_ro (ASDAIR_DB_URL, SELECT-only) reads all five tables:
--     - households            : services/asdair/skill/data.js resolveHouseholdId()
--     - budget_settings       : services/asdair/skill/data.js loadBudget()
--     - shopping_lists        : services/asdair/skill/data.js loadList(),
--                                services/asdair/cockpit-api/readWorkspace.js
--     - shopping_list_items   : same two call sites, plus product_alternatives' FK scope
--     - product_alternatives  : services/asdair/skill/data.js loadList(),
--                                services/asdair/cockpit-api/readWorkspace.js
--   asdair_rw (ASDAIR_WRITE_DB_URL, via pipeline/deps.js realExecuteIntents)
--   reaches these tables only through services/control-plane/wp-d-proof/
--   asdairCommands.mjs, and only touches THREE of the five:
--     - households            : SELECT only (resolveHousehold)
--     - shopping_lists        : SELECT + INSERT (findOrCreateDraftList)
--     - shopping_list_items   : SELECT ... FOR UPDATE + INSERT + UPDATE
--   asdair_rw never touches budget_settings or product_alternatives
--   anywhere in the codebase, so it gets no grant on either here - the same
--   narrowest-possible-write-path posture 005's own SAFETY MODEL states.
--
-- NOTE ON A DIFFERENT ROLE, OUT OF SCOPE HERE: services/control-plane/
-- wp-d-proof/asdair-worker.mjs (BUILD-014's Directus command-queue drain
-- worker) calls the SAME asdairCommands.execute() under a THIRD role,
-- cp_worker, connected via services/control-plane/wp-d-proof/.runtime-live/
-- directus-live.env.json rather than ASDAIR_DB_URL/ASDAIR_WRITE_DB_URL.
-- That role's grants are not touched by this migration - it was not named
-- in this Work Order, and this migration cannot see its provisioning to
-- verify it is even the same live database role set. Reported, not fixed.
--
-- Rules of the road (same as 001/004/005/006/008/009):
--   * PURE ASCII only.
--   * NO secrets. No role passwords here.
--   * Idempotent: GRANT is idempotent in Postgres, and the role-existence
--     guards below make this file a no-op on a database where asdair_ro or
--     asdair_rw has not been provisioned yet.
--   * Depends on 001_asdair_schema.sql.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_ro') then
    raise notice 'asdair_ro does not exist on this database - skipping asdair_ro grants (provision the role out-of-band first)';
  else
    execute 'grant usage on schema asdair to asdair_ro';
    execute 'grant select on asdair.households, asdair.budget_settings, '
         || 'asdair.shopping_lists, asdair.shopping_list_items, '
         || 'asdair.product_alternatives to asdair_ro';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw does not exist on this database - skipping asdair_rw grants (provision the role out-of-band first)';
  else
    execute 'grant usage on schema asdair to asdair_rw';

    -- households: resolveHousehold() in asdairCommands.mjs only ever SELECTs.
    execute 'grant select on asdair.households to asdair_rw';

    -- shopping_lists: findOrCreateDraftList() SELECTs and, on first use for a
    -- household/date, INSERTs a new next_week_draft row. No UPDATE, no DELETE.
    execute 'grant select, insert on asdair.shopping_lists to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shopping_lists', 'id') || ' to asdair_rw';

    -- shopping_list_items: add_regular_to_next_week and add_list_item both
    -- SELECT ... FOR UPDATE an existing line, INSERT a new one, or UPDATE the
    -- existing one's requested_qty/status/note. No DELETE.
    execute 'grant select, insert, update on asdair.shopping_list_items to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shopping_list_items', 'id') || ' to asdair_rw';

    -- budget_settings and product_alternatives: no asdair_rw code path
    -- touches either table anywhere in this codebase, so no grant here -
    -- the narrowest-possible-write-path posture 005 already established.
  end if;
end $$;
