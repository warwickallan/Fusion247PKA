-- =============================================================================
-- MyPKA cockpit migration 240 — Brain held-decision seam (IDEA-016)
--
-- A held canonicalisation surfaces in the cockpit as an attention_item with Merge/Keep buttons.
-- The tap follows the SAME governed trust seam as learning_command / asdair command_request:
-- cp_directus may INSERT an INTENT only (command + held_id, status=requested, no receipt); a trusted
-- worker (cp_worker) claims it, applies the decision to the authoritative Brain (obsidiwikai
-- wp15_canonicalisation: merge → mergeEntities on the one graph + action='merged'; keep → action='kept'),
-- and writes a receipt. Directus never mutates the graph. Idempotent; reversible via teardown (cockpit cascade).
-- =============================================================================
create table if not exists cockpit.brain_command (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  command          text        not null check (command in ('merge','keep')),
  held_id          uuid        not null,                 -- obsidiwikai.wp15_canonicalisation.id
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz
);
create index if not exists cockpit_brain_command_status_idx on cockpit.brain_command (status, requested_at);

comment on table cockpit.brain_command is
  'Brain held-decision INTENT queue (IDEA-016). cp_directus INSERTs status=requested only; cp_worker '
  'applies merge/keep to the authoritative graph + wp15_canonicalisation and writes a receipt.';

create or replace function cockpit.brain_command_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then raise exception 'brain_command insert must be status=requested' using errcode='23514'; end if;
  if new.receipt is not null or new.claimed_at is not null or new.completed_at is not null then raise exception 'brain_command insert: no receipt/claim/complete' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists brain_command_insert_guard_t on cockpit.brain_command;
create trigger brain_command_insert_guard_t before insert on cockpit.brain_command for each row execute function cockpit.brain_command_insert_guard();

create or replace function cockpit.brain_command_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by is distinct from old.requested_by or new.command is distinct from old.command
     or new.held_id is distinct from old.held_id or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at is distinct from old.requested_at then
    raise exception 'brain_command core fields are immutable after creation' using errcode='23514';
  end if;
  if old.status in ('done','failed') then raise exception 'a completed brain_command (status=%) is immutable', old.status using errcode='23514'; end if;
  if new.status is distinct from old.status and not ((old.status='requested' and new.status='claimed') or (old.status='claimed' and new.status in ('done','failed'))) then
    raise exception 'invalid brain_command transition % -> %', old.status, new.status using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists brain_command_update_guard_t on cockpit.brain_command;
create trigger brain_command_update_guard_t before update on cockpit.brain_command for each row execute function cockpit.brain_command_update_guard();

-- Least-privilege: cp_directus request-only; cp_worker execute-only.
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_directus') then
    execute 'grant usage on schema cockpit to cp_directus';
    execute 'grant select on cockpit.brain_command to cp_directus';
    execute 'grant insert (requested_by, command, held_id, idempotency_key) on cockpit.brain_command to cp_directus';
  end if;
  if exists (select 1 from pg_roles where rolname='cp_worker') then
    execute 'grant usage on schema cockpit to cp_worker';
    execute 'grant select on cockpit.brain_command to cp_worker';
    execute 'grant update (status, claimed_at, completed_at, receipt) on cockpit.brain_command to cp_worker';
  end if;
end $$;
commit;
