-- =============================================================================
-- BUILD-002 WP0 — RLS policy set (Supabase / Postgres DDL)
-- Migration: 0003_wp0_rls_policies
--
-- Source of truth for this shape:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     supabase-operational-foundation-boundary.md  (§1.1, security gate)
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     source-of-truth-and-authority-matrix.md      (§3 guardrail)
--
-- WHY THIS EXISTS (security finding F-07):
-- 0001 ENABLED row-level security on every fcg.* table but defined NO policies.
-- RLS-enabled-with-no-policy denies all access to non-owner roles — safe, but
-- it also denies the legitimate server-side worker/API principal. This migration
-- adds the explicit, minimal allow-list that makes the deny-by-default posture
-- OPERATIONAL for WP0 without weakening it:
--
--   * service_role  — the server-side worker / gateway / erasure principal.
--                     FULL DML on every fcg.* table (SELECT/INSERT/UPDATE/DELETE).
--                     This is the ONLY principal that touches the data layer in WP0.
--   * authenticated — NO access. The single authorised user drives the gateway
--                     through the server; there is NO direct client->DB path in WP0.
--   * anon          — NO access. The publishable/anon key must never reach fcg.*.
--
-- Deny-by-default STANDS: anon and authenticated receive neither table grants nor
-- a policy, so RLS + privilege checks both refuse them. Only service_role is
-- granted schema USAGE + table privileges AND a matching permissive policy — a
-- request must pass BOTH gates, so a stray grant without a policy (or vice-versa)
-- still denies.
--
-- FUTURE WP NOTE: a later work-package that introduces a direct client->DB path
-- (e.g. a user browsing their own captures) will add per-user `authenticated`
-- policies of the form `using (sender_identity_ref = auth_identity())`. That is
-- explicitly OUT OF SCOPE for WP0 and intentionally absent here.
--
-- FIXTURES-ONLY NOTE: this file is the migration ARTIFACT. Applying it against
-- the throwaway localhost verification DB is how it is proven; it provisions no
-- secrets and no data.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Nothing here grants anon/authenticated any access, and nothing disables RLS.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Roles. In real Supabase `anon`, `authenticated`, and `service_role` PRE-EXIST
-- as part of the platform. For the isolated dev/verification substrate we create
-- them if absent (NOLOGIN is sufficient — policies are exercised via SET ROLE).
-- Guarded so re-running the migration, or running it against real Supabase where
-- the roles already exist, is a no-op (idempotent).
--
-- CONCURRENCY-SAFE (root-cause fix, 2026-07-17): roles live in the CLUSTER-wide
-- shared catalog (pg_authid), not in any one database. When two sessions apply
-- this migration into DIFFERENT databases of the same cluster at the same time
-- (exactly what CI does: the postgresStore integration file migrates the main
-- DB while the e2e file migrates its isolated "<db>_e2e" DB, in parallel test
-- processes on a fresh service container), the original check-then-create guard
-- raced: both sessions saw "role absent", both ran CREATE ROLE, and the loser
-- died with 23505 `duplicate key value violates unique constraint
-- "pg_authid_rolname_index"` (or 42710 `role ... already exists`), aborting the
-- whole migration. Reproduced deterministically with two concurrent appliers on
-- a fresh cluster (~1-in-4 per attempt). The nested exception blocks below turn
-- "somebody else created it first" into the no-op it was always meant to be.
-- The security posture is UNCHANGED: same three NOLOGIN roles, nothing more.
-- --------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      create role anon nologin;
    exception
      when duplicate_object then null;  -- 42710: lost the race after our check
      when unique_violation then null;  -- 23505: concurrent pg_authid insert
    end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      create role authenticated nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
    end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    begin
      create role service_role nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
    end;
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- Schema + table privileges. service_role ONLY. anon/authenticated get nothing.
-- RLS is a SECOND gate on top of these grants; both must pass.
-- --------------------------------------------------------------------------

grant usage on schema fcg to service_role;

grant select, insert, update, delete on all tables in schema fcg to service_role;

-- Sequences (e.g. gen_random_uuid uses none, but future serial/identity columns);
-- harmless and forward-safe for the single server-side principal.
grant usage, select on all sequences in schema fcg to service_role;

-- --------------------------------------------------------------------------
-- Policies. One permissive FOR ALL policy per table, scoped TO service_role.
-- Because no policy names anon/authenticated, and RLS is enabled, those roles
-- remain denied. `using (true)` + `with check (true)` = full row visibility and
-- full write for the trusted server-side principal only.
-- --------------------------------------------------------------------------

create policy service_role_all_channel_identity
  on fcg.channel_identity
  for all to service_role
  using (true) with check (true);

create policy service_role_all_raw_object
  on fcg.raw_object
  for all to service_role
  using (true) with check (true);

create policy service_role_all_capture_envelope
  on fcg.capture_envelope
  for all to service_role
  using (true) with check (true);

create policy service_role_all_idempotency_key
  on fcg.idempotency_key
  for all to service_role
  using (true) with check (true);

create policy service_role_all_processing_state
  on fcg.processing_state
  for all to service_role
  using (true) with check (true);

create policy service_role_all_evidence_pointer
  on fcg.evidence_pointer
  for all to service_role
  using (true) with check (true);
