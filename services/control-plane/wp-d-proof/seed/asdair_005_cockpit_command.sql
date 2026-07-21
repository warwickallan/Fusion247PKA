-- =============================================================================
-- BUILD-014 — AsdAIr cockpit WRITE-BACK trust seam (LIVE, real asdair schema)
--
-- Authorised by Warwick 2026-07-21: "implement the narrow AsdAIr command-request
-- write-back against the real schema, using allowlisted actions, least privilege,
-- idempotency, receipt logging and a synthetic-first test."
--
-- This adds ONE new table to the real asdair schema (additive; existing tables are
-- untouched). The cockpit (Directus, role cp_directus) may only INSERT an INTENT
-- row (status=requested, no receipt). A SEPARATE trusted worker (role cp_worker)
-- CLAIMS the row (FOR UPDATE SKIP LOCKED), executes ONE allowlisted command, and
-- writes a VISIBLE RECEIPT. Directus never executes anything itself.
--
-- Effect of the sole allowlisted command `add_regular_to_next_week {regular_id,qty}`:
--   upsert a shopping_list_item into the referenced regular's household
--   `next_week_draft` shopping_list (worker-side; the cockpit cannot write items).
--
-- SYNTHETIC-FIRST: the proof exercises this against a throwaway synthetic household
-- only; the real household (id 1) is never touched by the test. is_synthetic is an
-- audit flag (default false = a real request); the cockpit cannot set it.
--
-- Reversible: drop table asdair.command_request cascade;
-- =============================================================================

begin;

create table if not exists asdair.command_request (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  command          text        not null,
  args             jsonb       not null default '{}'::jsonb,
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  is_synthetic     boolean     not null default false,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz
);

create index if not exists asdair_command_request_status_idx
  on asdair.command_request (status, requested_at);

comment on table asdair.command_request is
  'AsdAIr cockpit write-back seam: INTENT queue. cp_directus may only INSERT status=requested (no receipt); the trusted cp_worker claims + executes an ALLOWLISTED command + writes the receipt. Existing asdair tables are untouched by this table.';

-- ---- Guard 1: INSERTs are intent-only (belt-and-braces with the column grant) ----
create or replace function asdair.command_request_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then
    raise exception 'command_request may only be INSERTed with status=requested (got %)', new.status
      using errcode = '23514';
  end if;
  if new.receipt is not null then
    raise exception 'command_request may not be INSERTed with a receipt (execution is the worker''s job)'
      using errcode = '23514';
  end if;
  if new.claimed_at is not null or new.completed_at is not null then
    raise exception 'command_request may not be INSERTed already claimed/completed'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists command_request_insert_guard_t on asdair.command_request;
create trigger command_request_insert_guard_t
  before insert on asdair.command_request
  for each row execute function asdair.command_request_insert_guard();

-- ---- Guard 2: request CORE immutable + only valid forward transitions -----------
create or replace function asdair.command_request_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by       is distinct from old.requested_by
     or new.command         is distinct from old.command
     or new.args            is distinct from old.args
     or new.idempotency_key  is distinct from old.idempotency_key
     or new.requested_at     is distinct from old.requested_at
     or new.is_synthetic     is distinct from old.is_synthetic then
    raise exception 'command_request core fields are immutable after creation'
      using errcode = '23514';
  end if;
  if old.status in ('done','failed') then
    raise exception 'a completed command_request (status=%) is immutable', old.status
      using errcode = '23514';
  end if;
  if new.status is distinct from old.status
     and not ( (old.status = 'requested' and new.status = 'claimed')
            or (old.status = 'claimed'   and new.status in ('done','failed')) ) then
    raise exception 'invalid command_request status transition % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists command_request_update_guard_t on asdair.command_request;
create trigger command_request_update_guard_t
  before update on asdair.command_request
  for each row execute function asdair.command_request_update_guard();

commit;
