-- =============================================================================
-- BUILD-014 WP-D increment 2 — the WRITE-BACK TRUST SEAM                (author: silas)
--
-- Increment 1 stood up READ views + a read-only cockpit. Increment 2 adds the
-- narrow, permission-bounded WRITE-BACK that makes Directus worth running as a
-- control surface — WITHOUT letting the cockpit become the runtime:
--
--   1. A constrained check/uncheck surface on the SYNTHETIC shopping items
--      (only public.list_items.is_checked is ever mutable by the cockpit role).
--   2. A `command_request` INTENT queue. The cockpit may only REQUEST a command
--      (status=requested, no receipt). A SEPARATE trusted worker CLAIMS the row
--      (FOR UPDATE SKIP LOCKED), EXECUTES one genuinely-safe synthetic command,
--      and writes a VISIBLE RECEIPT back (status=done + receipt). Directus never
--      executes anything itself — it requests; the trusted worker executes.
--   3. A `cockpit_metric` side-effect table the safe command writes to, proving a
--      real (harmless, synthetic) effect crossed the trust boundary.
--
-- !! DECISION #4 DEFAULT — SYNTHETIC / DEV DATA ONLY. !!
--   Every row carries is_synthetic = true. NO real AsdAIr / household / entrusted
--   data touches this table, Directus, the worker, or any committed file.
--
-- The DB-LAYER enforcement here is deliberately belt-and-braces with the Directus
-- app-layer policy: even a connection that bypassed Directus entirely is bounded
-- by the triggers below (intent-only inserts, immutable request core) and by the
-- least-privilege GRANTs applied in configure-db-roles.mjs.
-- =============================================================================

begin;

drop table if exists public.command_request cascade;
drop table if exists public.cockpit_metric  cascade;

-- ---- The command INTENT queue (the trust seam) -----------------------------
create table public.command_request (
  id               uuid primary key default gen_random_uuid(),
  requested_by     text        not null,
  command          text        not null,
  args             jsonb       not null default '{}'::jsonb,
  status           text        not null default 'requested'
                     check (status in ('requested','claimed','done','failed')),
  idempotency_key  text        not null unique,
  receipt          jsonb,
  is_synthetic     boolean     not null default true,
  requested_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  completed_at     timestamptz
);

create index command_request_status_idx on public.command_request (status, requested_at);

comment on table public.command_request is
  'WP-D write-back seam: INTENT queue. The cockpit role may only INSERT status=requested (no receipt); a separate trusted worker claims + executes + writes the receipt. SYNTHETIC/DEV only.';

-- ---- Side-effect table the safe worker command writes to -------------------
create table public.cockpit_metric (
  key          text primary key,
  value        bigint      not null,
  computed_by  text        not null,
  computed_at  timestamptz not null default now(),
  is_synthetic boolean     not null default true
);

comment on table public.cockpit_metric is
  'WP-D write-back seam: harmless synthetic side-effect surface for the worker safe command (e.g. recomputed read-model counts). SYNTHETIC/DEV only.';

-- ---- Guard 1: INSERTs are intent-only --------------------------------------
-- Fires for EVERY role (belt-and-braces with the column-scoped INSERT grant and
-- the Directus field policy). The cockpit can request, never pre-execute.
create or replace function public.command_request_insert_guard() returns trigger
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
  new.is_synthetic := true;  -- force synthetic; the cockpit cannot mint "real" rows
  return new;
end $$;

drop trigger if exists command_request_insert_guard_t on public.command_request;
create trigger command_request_insert_guard_t
  before insert on public.command_request
  for each row execute function public.command_request_insert_guard();

-- ---- Guard 2: the request CORE is immutable after creation ------------------
-- The worker may only advance status / stamp times / append a receipt. It cannot
-- rewrite what was requested (append-only-ish request provenance).
create or replace function public.command_request_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by    is distinct from old.requested_by
     or new.command      is distinct from old.command
     or new.args         is distinct from old.args
     or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at  is distinct from old.requested_at then
    raise exception 'command_request core fields (requested_by/command/args/idempotency_key/requested_at) are immutable after creation'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists command_request_update_guard_t on public.command_request;
create trigger command_request_update_guard_t
  before update on public.command_request
  for each row execute function public.command_request_update_guard();

commit;
