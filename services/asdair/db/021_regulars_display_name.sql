-- =====================================================================
-- BUILD-015 AsdAIr - migration 021: asdair.regulars.display_name
--
-- WARWICK'S OWN SCHEMA DECISION (2026-08-13), in his words:
--
--   "Can you create a third linked field called display name? Asda listing is
--    the official one, Alias is what mum writes on her lists but neither
--    should be editable but alias shouldn't necessarily be displayed. Display
--    name would be a name I can enter/amend/edit on a page on my cockpit."
--
-- THE DEFECT THIS CLOSES ------------------------------------------------
-- 55 of the 109 active regulars have no usable `aka`, so over half of what Mum
-- reads today is the raw retailer catalogue string - "Sure Nonstop Protection
-- Sport Cool Anti-Perspirant Aerosol 250 ml".
--
-- WHY A THIRD COLUMN AND NOT AN EDIT TO `aka` ---------------------------
-- `aka` is THE MATCHER'S INPUT. resolveByCatalogue.js reads it (aliasesOf) to
-- decide which product a written line means. Editing `aka` to improve what Mum
-- READS would silently change what MATCHES: renaming the BOB milk to "milk"
-- would make every written "milk" ambiguous against the Cravendale. Warwick's
-- separation makes that impossible.
--
--   name          the official ASDA listing. Not editable. The matcher reads it.
--   aka           what Mum writes on her lists. A MATCHING TERM. Not editable.
--   display_name  NEW. What Mum reads. Warwick edits it from his Cockpit.
--                 The matcher never reads it.
--
-- NO BACKFILL, AND NO `UPDATE` STATEMENT ANYWHERE IN THIS FILE ----------
-- 020 carried a `update asdair.shop set human_state = case status ... end`
-- that re-fires on every run. That is safe for a mechanical re-expression of
-- shop.status; it would be destructive here, because display_name holds
-- Warwick's own typed words. There is nothing in this file that could
-- overwrite one, so re-running it changes nothing.
--
-- THE GRANT, AND WHY ONE IS NEEDED HERE WHERE 020 NEEDED NONE ----------
-- asdair.shop carries TABLE-level UPDATE for asdair_rw, which covers a column
-- added later. asdair.regulars does NOT: its write path is COLUMN-scoped (005),
-- and a column-level privilege does not extend to a column that did not exist
-- when it was granted. Without the grant below, display_name would be readable
-- and permanently unwritable.
--
-- Verified against the target: asdair_rw holds no UPDATE on `name` (so the
-- database refuses it for free) and does hold UPDATE on `aka` (the weekly
-- learning write-back needs it). Both are left exactly as they are. This file
-- grants UPDATE on display_name and nothing else.
--
-- asdair_ro needs no grant: its SELECT on asdair.regulars is TABLE-level (012),
-- which does cover a column added later. A column-level read grant here would
-- be a no-op that misleads a future reader - 017's, 018's and 020's reasoning.
--
-- NUMBERING: repo migrations are 001, 004-010, 012, 016-020 (gaps at 002, 003,
-- 011, 013-015 - see 016's header for why 013-015 are not to be claimed). 021
-- is the next free number.
--
-- Depends on 001 (schema) and 004 (asdair.regulars).
--
-- PURE ASCII, no secrets, no rows written, idempotent, forward-only.
-- =====================================================================


-- =====================================================================
-- 1. The column.
--
-- Nullable, no default. NULL means "Warwick has not named this one yet", and
-- the reader falls back to `aka` or `name` exactly as it does today.
--
-- A nullable column with no default on an existing table is a catalogue-only
-- change - no table rewrite, only a brief ACCESS EXCLUSIVE lock (019's and
-- 020's own reasoning).
-- =====================================================================
alter table asdair.regulars
  add column if not exists display_name text;


-- =====================================================================
-- 2. The grant. ONE column, to ONE role.
--
-- GRANT is idempotent in Postgres and the role guard makes this file safe on a
-- database where asdair_rw has not been provisioned yet - 005's own rule.
--
-- Nothing here widens anything else: no other column, no table-level grant, no
-- revoke.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw absent - skipping 021 display_name grant';
  else
    execute 'grant update (display_name) on asdair.regulars to asdair_rw';
  end if;
end $$;
