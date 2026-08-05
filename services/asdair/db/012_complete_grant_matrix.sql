-- =====================================================================
-- AsdAIr - migration 012: THE COMPLETE asdair_ro / asdair_rw GRANT MATRIX
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
-- IDEMPOTENT AND SAFE. Every statement below grants a privilege the live
-- database ALREADY has, so applying it there is a no-op. Its value is that
-- an empty PostgreSQL, built from git, ends up in the same state. GRANT is
-- idempotent in Postgres and the role guards make it a no-op where the roles
-- are not provisioned.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO:
--   * It does not re-state the COLUMN-level grants on asdair.regulars. Those
--     live in 005_asdair_rw_grants.sql, which is their canonical home and
--     whose SAFETY MODEL comment explains each omission (no DELETE anywhere,
--     no UPDATE on name/household_id/active). `regulars` therefore appears
--     below for asdair_rw as SELECT only - matching what the live table-level
--     matrix reports - because its write path is column-scoped by design.
--   * It grants NOTHING new. If a privilege is absent here it is absent live,
--     and 010's SAFETY MODEL reasoning applies: absence is often deliberate
--     (asdair_rw has no grant on budget_settings or product_alternatives, and
--     no UPDATE on rules).
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
