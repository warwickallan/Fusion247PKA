-- =====================================================================
-- IDEA-012 AsdAIr - migration 005: the asdair_rw write grants
--
-- WHY THIS FILE EXISTS (two reasons):
--
--   1. THE LEARNING GAP. Nothing in the database could write asdair.regulars.
--      Not asdair_rw, not cp_worker, not cp_directus - SELECT was the only
--      privilege that existed anywhere. So the three most valuable things a
--      real shop produces could not persist at all:
--        * an alias ("Mum writes 'chips' and means Crispy Skin-On Fries"),
--        * a harvested asda_product_id (only obtainable while shopping),
--        * a genuinely new item found mid-shop.
--      Every week therefore re-derived them from scratch. This migration
--      opens the narrowest possible write path that closes that loop.
--
--   2. THE PROVENANCE GAP. The asdair_rw grants provisioned on 2026-07-27
--      for the outcome writers (BUILD-015 / PR #73) existed ONLY in the live
--      database and in prose in services/asdair/outcome/README.md. A database
--      rebuilt from git alone would silently lack them. They are restated
--      here so git is again the source of truth.
--
-- SAFETY MODEL - what this deliberately does NOT grant:
--   * NO DELETE anywhere. Nothing in this system deletes household data.
--   * NO UPDATE on regulars.active   -> the writer can never RETIRE a regular.
--   * NO UPDATE on regulars.name or .household_id
--                                    -> it can never re-point an existing row
--                                       at a different product or household.
--   * NO INSERT on regulars.active   -> a new regular is always born active,
--                                       by column default, never by assertion.
--   The writer may therefore ADD a regular and ENRICH a regular, and can do
--   nothing else to one. The column allowlist in
--   services/asdair/outcome/buildRegularsUpdate.js mirrors this list; the
--   grant below is the one that actually enforces it.
--
-- Rules of the road (same as 001/004):
--   * PURE ASCII only.
--   * NO secrets. Role PASSWORDS are never in migrations - they are set
--     out-of-band from the gitignored runtime store. A role with no password
--     cannot authenticate, so this file is fail-closed on its own.
--   * Idempotent: re-running is a no-op. GRANT is idempotent in Postgres,
--     and the role check below means this file is safe on a database where
--     asdair_rw has not been provisioned yet.
--   * Depends on 001_asdair_schema.sql and 004_asdair_regulars.sql.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw does not exist on this database - skipping grants (provision the role out-of-band first)';
    return;
  end if;

  -- -------------------------------------------------------------------
  -- Schema access
  -- -------------------------------------------------------------------
  execute 'grant usage on schema asdair to asdair_rw';

  -- -------------------------------------------------------------------
  -- (1) NEW in 005: the learning path - asdair.regulars
  -- -------------------------------------------------------------------
  execute 'grant select on asdair.regulars to asdair_rw';

  -- Add a genuinely new regular. "active" IS insertable (buildRegularsUpdate.js
  -- names it explicitly, validated as a strict boolean defaulting true) - but it
  -- is deliberately absent from the UPDATE grant below, so a learning write can
  -- create an active regular and can NEVER retire an existing one.
  execute 'grant insert (household_id, high_level_category, category, name, '
       || 'asda_product_id, asda_url, typical_qty, source, brand, aka, '
       || 'substitutes_allowed, active) on asdair.regulars to asdair_rw';

  -- Enrich an EXISTING regular. This column list is the security boundary -
  -- name, household_id and active are absent on purpose and must stay absent.
  execute 'grant update (asda_product_id, asda_url, aka, brand, '
       || 'substitutes_allowed, typical_qty, updated_at) '
       || 'on asdair.regulars to asdair_rw';

  execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.regulars', 'id') || ' to asdair_rw';

  -- -------------------------------------------------------------------
  -- (2) RESTATED from the 2026-07-27 provisioning (BUILD-015 / PR #73):
  --     the outcome + promotion path. Restated so git is the source of
  --     truth; these are already live, so this is a no-op there.
  -- -------------------------------------------------------------------
  execute 'grant select, insert on asdair.orders       to asdair_rw';
  execute 'grant select, insert on asdair.order_events to asdair_rw';
  execute 'grant select, insert on asdair.rule_qa_log  to asdair_rw';
  execute 'grant select, insert on asdair.rules        to asdair_rw';

  -- The learning back-link, and nothing else, on rule_qa_log.
  execute 'grant update (promoted_rule_id) on asdair.rule_qa_log to asdair_rw';

  -- Read-only, for provenance verification by the promotion guard.
  execute 'grant select on asdair.source_documents to asdair_rw';

  execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.orders',       'id') || ' to asdair_rw';
  execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.order_events', 'id') || ' to asdair_rw';
  execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.rule_qa_log',  'id') || ' to asdair_rw';
  execute 'grant usage on sequence ' || pg_get_serial_sequence('asdair.rules',        'id') || ' to asdair_rw';
end $$;
