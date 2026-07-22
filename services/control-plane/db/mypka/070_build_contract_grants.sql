-- =============================================================================
-- MyPKA cockpit migration 070 — BUILD-002 contract layer least-privilege grants
--
-- Same asymmetry + idempotence discipline as 040: REVOKE the contract objects from both roles
-- first, then GRANT exactly the narrow set, in ONE transaction (a re-apply never opens a window
-- where the running cockpit/worker loses privileges, and never leaves a wider privilege in place).
--
--   cp_directus  — RENDER + REQUEST: SELECT the contract; SELECT the queue; INSERT an intent only
--                  (column-scoped; no status/receipt/claim columns). NO write on build_contract.
--   cp_worker    — EXECUTE: claim the queue (status/claimed/completed/receipt) + APPLY the approval
--                  to build_contract (lifecycle/approval columns only). NO insert on the queue.
--
-- Reversible via teardown.sql.
-- =============================================================================
begin;

-- ---- Reset the contract objects (scoped) ----
do $$
begin
  if exists (select 1 from pg_roles where rolname='cp_directus') then
    if to_regclass('cockpit.build_contract')   is not null then execute 'revoke all on cockpit.build_contract from cp_directus'; end if;
    if to_regclass('cockpit.contract_command') is not null then execute 'revoke all on cockpit.contract_command from cp_directus'; end if;
  end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') then
    if to_regclass('cockpit.build_contract')   is not null then execute 'revoke all on cockpit.build_contract from cp_worker'; end if;
    if to_regclass('cockpit.contract_command') is not null then execute 'revoke all on cockpit.contract_command from cp_worker'; end if;
  end if;
end $$;

-- ---- cp_directus: render the contract + request-only on the approval queue ----
grant usage on schema cockpit to cp_directus;
grant select on cockpit.build_contract   to cp_directus;
grant select on cockpit.contract_command to cp_directus;
grant insert (requested_by, command, build_id, contract_version, bound_git_sha, bound_content_hash, note, idempotency_key)
  on cockpit.contract_command to cp_directus;
-- NO update/delete on the queue; NO write of any kind on build_contract.

-- ---- cp_worker: execute the approval intent ----
grant usage on schema cockpit to cp_worker;
grant select on cockpit.contract_command to cp_worker;
grant update (status, claimed_at, completed_at, receipt) on cockpit.contract_command to cp_worker;
grant select on cockpit.build_contract to cp_worker;
grant update (lifecycle_state, approved_by, approved_at, changes_requested_note, superseded_by_version, current_wp, updated_at)
  on cockpit.build_contract to cp_worker;
-- NO insert on contract_command (asymmetry: requests come from the cockpit only).
-- NO insert/delete on build_contract (the contract row is seeded/superseded by the owner, not the worker).

commit;
