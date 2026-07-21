-- =============================================================================
-- MyPKA cockpit migration 010 — Directus system schema
--
-- MyPKA (Supabase project kerdinlgcfxnjrztwqde) is the CANONICAL LIVE operational
-- database for the cockpit (architecture decision, Warwick 2026-07-21). Directus runs
-- its ~40 system tables in an ISOLATED schema so the real brain schemas stay clean.
--
-- Idempotent. Reversible via teardown.sql (drop schema directus_sys cascade).
-- =============================================================================
create schema if not exists directus_sys;
comment on schema directus_sys is
  'Directus 11 system tables (directus_*) for the myPKA cockpit. Isolated from the brain schemas; owned by the provisioning role, used by cp_directus.';
