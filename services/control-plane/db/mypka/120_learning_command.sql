-- =============================================================================
-- MyPKA cockpit migration 120 — learning Accept/Decline seam (BUILD-002 WP3)
--
-- The suggested-learning decision loop (§14). Same trust seam as the contract-approval + asdair
-- write-back: the cockpit (cp_directus) may only INSERT an intent (accept / decline / defer,
-- status=requested, no receipt); a trusted worker (cp_worker) claims it and applies the decision to
-- cockpit.learning_candidate (status only) + writes a receipt. Accept does NOT silently rewrite any
-- governed material — it records a durable decision + marks the candidate accepted (a governed apply
-- by Larry/Cairn is a separate step). Decline records the decision + reason. Idempotent; reversible
-- via teardown.sql (cockpit-schema cascade).
-- =============================================================================
create table if not exists cockpit.learning_command (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  command          text        not null check (command in ('accept','decline','defer')),
  candidate_id     uuid        not null references cockpit.learning_candidate (id) on delete no action,
  note             text,
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  is_synthetic     boolean     not null default false,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz
);
create index if not exists cockpit_learning_command_status_idx on cockpit.learning_command (status, requested_at);

comment on table cockpit.learning_command is
  'Learning Accept/Decline INTENT queue (BUILD-002 WP3). cp_directus INSERTs status=requested only; '
  'cp_worker applies the decision to learning_candidate.status + writes a receipt. Accept records a '
  'durable decision; it does not bypass governance (a governed apply is a separate step).';

create or replace function cockpit.learning_command_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then raise exception 'learning_command insert must be status=requested' using errcode='23514'; end if;
  if new.receipt is not null or new.claimed_at is not null or new.completed_at is not null then raise exception 'learning_command insert: no receipt/claim/complete' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists learning_command_insert_guard_t on cockpit.learning_command;
create trigger learning_command_insert_guard_t before insert on cockpit.learning_command for each row execute function cockpit.learning_command_insert_guard();

create or replace function cockpit.learning_command_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by is distinct from old.requested_by or new.command is distinct from old.command
     or new.candidate_id is distinct from old.candidate_id or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at is distinct from old.requested_at or new.is_synthetic is distinct from old.is_synthetic then
    raise exception 'learning_command core fields are immutable after creation' using errcode='23514';
  end if;
  if old.status in ('done','failed') then raise exception 'a completed learning_command (status=%) is immutable', old.status using errcode='23514'; end if;
  if new.status is distinct from old.status and not ((old.status='requested' and new.status='claimed') or (old.status='claimed' and new.status in ('done','failed'))) then
    raise exception 'invalid learning_command transition % -> %', old.status, new.status using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists learning_command_update_guard_t on cockpit.learning_command;
create trigger learning_command_update_guard_t before update on cockpit.learning_command for each row execute function cockpit.learning_command_update_guard();

-- Least-privilege grants: cp_directus request-only; cp_worker execute-only.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') and to_regclass('cockpit.learning_command') is not null then execute 'revoke all on cockpit.learning_command from cp_directus'; end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.learning_command') is not null then execute 'revoke all on cockpit.learning_command from cp_worker'; end if;
end $$;
grant usage on schema cockpit to cp_directus;
grant select on cockpit.learning_command to cp_directus;
grant insert (requested_by, command, candidate_id, note, idempotency_key) on cockpit.learning_command to cp_directus;
grant usage on schema cockpit to cp_worker;
grant select on cockpit.learning_command to cp_worker;
grant update (status, claimed_at, completed_at, receipt) on cockpit.learning_command to cp_worker;
grant select on cockpit.learning_candidate to cp_worker;
grant update (status, updated_at) on cockpit.learning_candidate to cp_worker;
commit;
