-- =============================================================================
-- MyPKA cockpit migration 160 — safe Directus command route (BUILD-002 WP4)
--
-- The other WP4 arm: a Directus/Vue action issues a VALIDATED command into a central queue; a trusted
-- worker executes ONLY allowlisted commands, records a result event + a receipt, and fails closed on
-- anything unknown. Mirrors the asdair.command_request seam. cp_directus may only file an intent
-- (command + args, status=requested); cp_worker validates against its allowlist and applies. Nothing
-- outside the allowlist is ever executed. Idempotent; reversible via teardown.sql (cockpit cascade).
-- =============================================================================
create table if not exists cockpit.command_request (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  command          text        not null,
  args             jsonb       not null default '{}'::jsonb,
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  result_event     jsonb,                    -- the emitted "result event" (WP4 §Directus route)
  is_synthetic     boolean     not null default false,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz,
  constraint command_request_args_is_object check (jsonb_typeof(args) = 'object')
);
create index if not exists cockpit_command_request_status_idx on cockpit.command_request (status, requested_at);

comment on table cockpit.command_request is
  'Safe Directus command route (BUILD-002 WP4). cp_directus files a VALIDATED command intent '
  '(status=requested); cp_worker executes only allowlisted commands, emits a result_event + receipt, '
  'and fails closed on anything unknown. Never executes outside its allowlist.';

create or replace function cockpit.command_request_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then raise exception 'command_request insert must be status=requested' using errcode='23514'; end if;
  if new.receipt is not null or new.result_event is not null or new.claimed_at is not null or new.completed_at is not null then raise exception 'command_request insert: no receipt/result/claim/complete' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists command_request_insert_guard_t on cockpit.command_request;
create trigger command_request_insert_guard_t before insert on cockpit.command_request for each row execute function cockpit.command_request_insert_guard();

create or replace function cockpit.command_request_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by is distinct from old.requested_by or new.command is distinct from old.command
     or new.args is distinct from old.args or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at is distinct from old.requested_at or new.is_synthetic is distinct from old.is_synthetic then
    raise exception 'command_request core fields are immutable after creation' using errcode='23514';
  end if;
  if old.status in ('done','failed') then raise exception 'a completed command_request (status=%) is immutable', old.status using errcode='23514'; end if;
  if new.status is distinct from old.status and not ((old.status='requested' and new.status='claimed') or (old.status='claimed' and new.status in ('done','failed'))) then
    raise exception 'invalid command_request transition % -> %', old.status, new.status using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists command_request_update_guard_t on cockpit.command_request;
create trigger command_request_update_guard_t before update on cockpit.command_request for each row execute function cockpit.command_request_update_guard();

-- Least-privilege grants: cp_directus files intents; cp_worker executes.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.command_request') is not null then execute 'revoke all on cockpit.command_request from cp_directus'; end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.command_request') is not null then execute 'revoke all on cockpit.command_request from cp_worker'; end if;
end $$;
grant usage on schema cockpit to cp_directus;
grant select on cockpit.command_request to cp_directus;
grant insert (requested_by, command, args, idempotency_key) on cockpit.command_request to cp_directus;
grant usage on schema cockpit to cp_worker;
grant select on cockpit.command_request to cp_worker;
grant update (status, claimed_at, completed_at, receipt, result_event) on cockpit.command_request to cp_worker;
commit;
