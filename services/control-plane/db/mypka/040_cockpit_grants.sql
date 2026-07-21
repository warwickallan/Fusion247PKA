-- =============================================================================
-- MyPKA cockpit migration 040 — least-privilege grants (the trust seam)
--
-- Idempotent least-privilege: REVOKE the write-back objects from both roles first, then
-- GRANT exactly the narrow set — so a re-run always ENFORCES the "ONLY" boundary (a re-run
-- can never leave a wider privilege in place). Faithful to the state applied to hosted MyPKA
-- this session; verified against the live catalog.
--
-- Asymmetry is the point: cp_directus REQUESTS (insert-intent, no execute); cp_worker
-- EXECUTES (claim/receipt + effect, no request). Neither can touch anything else in asdair.
-- Reversible via teardown.sql.
-- =============================================================================

-- Atomic: revoke + re-grant in ONE transaction so a re-apply against the LIVE database never
-- opens a window where the running cockpit/worker briefly loses its privileges.
begin;

-- ---- Reset the write-back objects (scoped — does NOT touch cp_directus's directus_sys) ----
do $$
begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('asdair.command_request') is not null then
    execute 'revoke all on asdair.command_request from cp_directus';
  end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') then
    if to_regclass('asdair.command_request')     is not null then execute 'revoke all on asdair.command_request from cp_worker'; end if;
    if to_regclass('asdair.shopping_lists')       is not null then execute 'revoke all on asdair.shopping_lists from cp_worker'; end if;
    if to_regclass('asdair.shopping_list_items')  is not null then execute 'revoke all on asdair.shopping_list_items from cp_worker'; end if;
    if to_regclass('asdair.regulars')             is not null then execute 'revoke all on asdair.regulars from cp_worker'; end if;
    if to_regclass('asdair.households')           is not null then execute 'revoke all on asdair.households from cp_worker'; end if;
  end if;
end $$;

-- ---- cp_directus: read views + request-only on the queue ----
grant usage on schema asdair to cp_directus;
grant usage, create on schema directus_sys to cp_directus;   -- Directus owns its system tables here
grant select on asdair.regulars        to cp_directus;
grant select on asdair.command_request to cp_directus;
grant insert (requested_by, command, args, idempotency_key) on asdair.command_request to cp_directus;
-- NO update/delete on the queue; NO write on shopping tables; NO other asdair objects.

-- ---- cp_worker: execute-only ----
grant usage on schema asdair to cp_worker;
grant select on asdair.command_request to cp_worker;
grant update (status, claimed_at, completed_at, receipt) on asdair.command_request to cp_worker;
grant select on asdair.regulars  to cp_worker;   -- resolve regular -> household + name
grant select on asdair.households to cp_worker;   -- FK check when creating a draft list
grant select, insert, update on asdair.shopping_lists      to cp_worker;
grant select, insert, update on asdair.shopping_list_items to cp_worker;
-- NO insert on command_request (asymmetry: requests come from the cockpit only).

-- Sequence-grant note: shopping_lists / shopping_list_items ids are GENERATED ... AS IDENTITY
-- BY DEFAULT, so INSERT covers the identity default — no separate sequence USAGE grant is needed.

commit;
