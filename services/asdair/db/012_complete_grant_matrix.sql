-- =====================================================================
-- AsdAIr - migration 012: THE COMPLETE asdair_ro / asdair_rw GRANT MATRIX
--
-- == CORRECTION, 2026-08-19. THE BODY BELOW IS WHAT RAN. ==================
-- This header used to deny two things its own SQL does. Both statements are
-- corrected in place below rather than annotated, because a migration whose
-- prose contradicts its own statements will be believed by the next reader
-- over the statements themselves. The BODY is unchanged and is the record
-- of what the database was actually told.
--
--   1. This file DOES grant asdair_rw SELECT on asdair.budget_settings and
--      asdair.product_alternatives - see the READ-ONLY tier of the asdair_rw
--      block below. The header previously asserted the opposite. That grant
--      is an OVER-GRANT: no asdair_rw code path in the estate reads either
--      table (every reader goes through ASDAIR_DB_URL / asdair_ro, traced in
--      022's header), and 010 deliberately withheld it. It reached git
--      because this file was enumerated from the LIVE database, and an
--      enumeration cannot tell an intended grant from an accident.
--      It is SUPERSEDED, forward-only, by
--      022_revoke_rw_budget_and_alternatives.sql.
--
--   2. This file does NOT apply cleanly to an empty PostgreSQL built from
--      git alone, which is the property the header claimed for it. Proven
--      by execution on a disposable PostgreSQL 17.4 cluster, 2026-08-19:
--      applying 001-021 in order and then this file ABORTS with
--      `relation "asdair.command_request" does not exist`. Three objects
--      named below are not created by anything in services/asdair/db/:
--        * asdair.command_request  - created by
--          services/control-plane/db/mypka/030_command_request.sql, i.e. an
--          UNDECLARED CROSS-SERVICE DEPENDENCY of this migration;
--        * asdair.previously_ordered, asdair.skill_steps - created by NO
--          committed SQL anywhere in the repository. They exist only in the
--          live database. 016's numbering note already records these three
--          as parked table drift that nothing reconciles.
--      So the very failure mode this file was written to prevent - a
--      database rebuilt from git that does not match - still applies to
--      this file itself. Recorded here, NOT fixed here: repatriating those
--      three objects is a schema decision and is not this migration's.
-- =========================================================================
--
-- WHY THIS FILE EXISTS. Migration 010 closed a provenance gap for five
-- tables after `permission denied for table households` killed a live shop
-- twice on 2026-08-03. It fixed the instance. This file closes the CLASS.
--
-- On 2026-08-04, WO-B's builder found that `asdair_ro`'s SELECT on
-- asdair.regulars - the CATALOGUE, the single most-read table in the whole
-- product - exists in NO migration. Verified both directions before writing
-- this file:
--   * live:  has_table_privilege('asdair_ro','asdair.regulars','SELECT') = true
--   * git:   `grep -rn "to asdair_ro" services/asdair/db/*.sql` returns only
--            006 (order_confirmation*), 008 (shop_line), 009
--            (pipeline_command) and 010 (the five it was written for).
-- So a database rebuilt from git alone would start, connect, and then fail
-- on the first catalogue read - exactly the failure of 2026-08-03, on a more
-- important table.
--
-- THE METHOD, and why it is not another five-table patch: the matrix below
-- was ENUMERATED from information_schema.role_table_grants on the live
-- database, not assembled from what anyone remembered. Fixing the instance
-- and leaving the class is this build's documented signature failure (see
-- DEFECT-LEDGER.md - loadRegulars vs loadBudget, D-06 vs D-13, and 010
-- itself). This file is the enumeration.
--
-- IDEMPOTENT AND SAFE ON THE LIVE DATABASE. Every statement below grants a
-- privilege the live database ALREADY had when this file was enumerated, so
-- applying it there is a no-op. GRANT is idempotent in Postgres and the role
-- guards make it a no-op where the roles are not provisioned.
--
-- IT DOES NOT REACH THE GOAL IT CLAIMED. This paragraph used to end "its
-- value is that an empty PostgreSQL, built from git, ends up in the same
-- state." That is FALSE and is corrected here: on a from-git build this file
-- aborts on the first of three objects git does not create. See CORRECTION
-- item 2 at the top of this file for the executed evidence.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO:
--   * It does not re-state the COLUMN-level grants on asdair.regulars. Those
--     live in 005_asdair_rw_grants.sql, which is their canonical home and
--     whose SAFETY MODEL comment explains each omission (no DELETE anywhere,
--     no UPDATE on name/household_id/active). `regulars` therefore appears
--     below for asdair_rw as SELECT only - matching what the live table-level
--     matrix reports - because its write path is column-scoped by design.
--   * It grants nothing that was not ALREADY LIVE when it was enumerated -
--     which is not the same as granting nothing new IN GIT, and this bullet
--     used to conflate the two. Against git it grants plenty that no earlier
--     migration did, including the asdair_rw SELECT on budget_settings and
--     product_alternatives that 010 had deliberately withheld. See
--     CORRECTION item 1 at the top; that pair is superseded by 022.
--     Where a privilege is absent here it was absent live at enumeration,
--     and 010's SAFETY MODEL reasoning applies: absence is often deliberate
--     (no UPDATE on rules, for one).
--   * It does not touch cp_worker or cp_directus. Their matrix is unaudited -
--     recorded as an open risk in DEFECT-LEDGER.md D-2026-08-03-07.
--
-- Rules of the road (same as 001/004/005/006/008/009/010):
--   * PURE ASCII. No secrets - role passwords are never in migrations.
--   * Idempotent; safe to re-run; safe where a role does not exist.
--   * Depends on 001_asdair_schema.sql and every migration that creates a
--     table named below.
-- =====================================================================

do $$
begin
  -- -------------------------------------------------------------------
  -- asdair_ro - SELECT on everything the read path touches.
  -- 26 objects: 25 base tables + the previously_ordered view.
  -- -------------------------------------------------------------------
  if not exists (select 1 from pg_roles where rolname = 'asdair_ro') then
    raise notice 'asdair_ro does not exist - skipping (provision the role out-of-band first)';
  else
    execute 'grant usage on schema asdair to asdair_ro';
    execute 'grant select on '
         || 'asdair.browser_build_request, asdair.budget_settings, '
         || 'asdair.command_request, asdair.credentials_ref, '
         || 'asdair.households, asdair.order_confirmation, '
         || 'asdair.order_confirmation_line, asdair.order_events, '
         || 'asdair.orders, asdair.pending_action, '
         || 'asdair.pipeline_command, asdair.previously_ordered, '
         || 'asdair.process_suggestions, asdair.product_alternatives, '
         || 'asdair.products, asdair.regulars, '
         || 'asdair.rule_qa_log, asdair.rules, '
         || 'asdair.shop, asdair.shop_event, '
         || 'asdair.shop_line, asdair.shop_question, '
         || 'asdair.shopping_list_items, asdair.shopping_lists, '
         || 'asdair.skill_steps, asdair.source_documents '
         || 'to asdair_ro';
  end if;

  -- -------------------------------------------------------------------
  -- asdair_rw - the write path, exactly as the live matrix reports it.
  -- Three tiers, and the tiers are the safety model:
  --   read-only        : reference data the writer must never mutate
  --   insert + select  : append-only ledgers and history
  --   + update         : rows whose lifecycle genuinely advances
  -- -------------------------------------------------------------------
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw does not exist - skipping (provision the role out-of-band first)';
  else
    execute 'grant usage on schema asdair to asdair_rw';

    -- READ-ONLY for the writer. Reference and configuration data.
    -- regulars is here at TABLE level on purpose: its write path is the
    -- COLUMN-scoped grant in 005, which is narrower and stays canonical there.
    execute 'grant select on '
         || 'asdair.budget_settings, asdair.command_request, '
         || 'asdair.credentials_ref, asdair.households, '
         || 'asdair.previously_ordered, asdair.process_suggestions, '
         || 'asdair.product_alternatives, asdair.products, '
         || 'asdair.regulars, asdair.skill_steps, '
         || 'asdair.source_documents '
         || 'to asdair_rw';

    -- APPEND-ONLY. A ledger entry is never edited or removed.
    execute 'grant select, insert on '
         || 'asdair.order_events, asdair.orders, '
         || 'asdair.rule_qa_log, asdair.rules, '
         || 'asdair.shop_event, asdair.shopping_lists '
         || 'to asdair_rw';

    -- LIFECYCLE. These rows legitimately advance through states.
    execute 'grant select, insert, update on '
         || 'asdair.browser_build_request, asdair.order_confirmation, '
         || 'asdair.order_confirmation_line, asdair.pending_action, '
         || 'asdair.pipeline_command, asdair.shop, '
         || 'asdair.shop_line, asdair.shop_question, '
         || 'asdair.shopping_list_items '
         || 'to asdair_rw';

    -- Sequence usage for every table the writer may INSERT into.
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.browser_build_request', 'id')  || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.order_confirmation', 'id')      || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.order_confirmation_line', 'id') || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.pending_action', 'id')          || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.pipeline_command', 'id')        || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shop', 'id')                    || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shop_event', 'id')              || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shop_line', 'id')               || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shop_question', 'id')           || ' to asdair_rw';
    execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.shopping_list_items', 'id')     || ' to asdair_rw';
  end if;
end $$;
