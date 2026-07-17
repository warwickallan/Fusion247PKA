-- =============================================================================
-- BUILD-010 WP0 — Fusion Tower control-plane, delta migration
-- Migration: 0003_wp0_external_write_outbox                      (author: silas)
--
-- PROVENANCE — closes a GPT-controller review finding:
--   Finding id: GPT MEDIUM-1  (severity: MEDIUM)
--   Defect:  the ClickUp review write path (src/adapters/clickupPoster.js) guards
--            duplicate writes with a PROCESS-LOCAL, IN-MEMORY Map keyed on the TASK
--            id. Four concrete failure modes follow from that:
--              (1) RESTART LOSES THE GUARD — a process restart empties the Map, so a
--                  redelivered webhook re-posts a duplicate comment.
--              (2) TIMEOUT-AFTER-REMOTE-COMMIT — if the ClickUp call commits remotely
--                  but the response is lost (timeout), the in-memory guard was never
--                  set, so the retry duplicates the comment.
--              (3) KEYING ON THE TASK BLOCKS LEGITIMATE LATER REVIEWS — a later,
--                  genuinely-distinct review of the SAME control task is refused,
--                  because the key is the task id, not the mutation.
--              (4) NO-COMMENT-ID STILL "POSTED" — a response that carries no comment
--                  id is still recorded as a successful write.
--   Fix:     a DURABLE Tower outbox. The write is CLAIMED (durably reserved) BEFORE
--            any remote post, keyed on a per-MUTATION idempotency key (NOT the task);
--            a write is only `applied_verified` once a real comment id comes back; an
--            ambiguous timeout is recorded as `outcome_unknown` for a reconciler to
--            resolve by searching the target for the embedded `mutation_id`.
--
-- Source of truth for this shape:
--   Builds/BUILD-010-fusion-tower/Architecture/dedup-and-timeout-contract.md
--     (§"external write idempotency" / §"ambiguous-timeout reconcile")
--
-- WHY A NEW MIGRATION (not an edit to 0001/0002):
--   0001 and 0002 are committed, Vex-reviewed, and part of the WP0 proof history —
--   they are IMMUTABLE. This discrete 0003 delta only ADDS a new enum, a new table,
--   and its RLS. Apply order is always 0001 THEN 0002 THEN 0003 on a clean DB.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 0001): a table implicitly creates a
-- composite type of the same name, so NO enum may share a name with any table. This
-- migration adds enum `ftw.write_state` and table `ftw.external_write`. The names
-- differ by construction — no enum named `external_write`, no table named
-- `write_state` — so there is no collision.
--
-- Supabase is DURABLE OPERATIONAL STATE, NOT the canonical Brain. Every column here
-- holds a POINTER / metadata (task id, comment id, payload CHECKSUM), NEVER the
-- governed content itself and NEVER a secret.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Row-Level Security is ENABLED deny-by-default on the new table. ONLY the
-- server-side `service_role` principal receives a grant + policy;
-- `anon`/`authenticated` get NEITHER, so both the privilege check and RLS refuse
-- them. POINTERS / METADATA ONLY: `target_id`, `mutation_id`, `response_id`,
-- `payload_checksum` and `mutation_key` are identifiers / checksums, NEVER a secret
-- and NEVER governed content. Do NOT add an anon/authenticated policy, do NOT
-- disable RLS, do NOT store a secret value or a payload body here, and do NOT weaken
-- the `applied_verified => response_id is not null` invariant.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Enumerated type: the write lifecycle. Guarded create so re-applying 0003 on an
-- already-migrated DB is a no-op (`create type` is not natively idempotent).
--   applying          -- claimed/reserved; the remote post has NOT been confirmed
--   applied_verified  -- confirmed: a real comment id came back (response_id set)
--   outcome_unknown   -- ambiguous timeout: may or may not have committed remotely;
--                     --   a reconciler resolves it by searching for mutation_id
--   retry_pending     -- a retriable failure; the claim may be re-attempted
--   failed            -- terminal failure; no further attempt
-- NB: `write_state` is an ENUM; the table is `external_write` — no name collision.
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ftw' and t.typname = 'write_state'
  ) then
    create type ftw.write_state as enum (
      'applying',
      'applied_verified',
      'outcome_unknown',
      'retry_pending',
      'failed'
    );
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- external_write — the DURABLE outbox. One row per external write MUTATION.
-- `create table if not exists` makes the migration re-runnable; all named
-- constraints are created inline with the table (a no-op on re-apply because the
-- table already exists).
--
-- IDEMPOTENCY KEY: `mutation_key`. It identifies the review MUTATION, NOT the task —
-- it is derived by the app from run_id + turn_id + target + payload checksum. Its
-- UNIQUE constraint is what makes claim-before-post idempotent: the first INSERT
-- reserves it; every retry/redelivery collides and reads back the existing row (and
-- its current state) instead of posting again. Keying on the mutation (not the task)
-- is exactly what unblocks a legitimate LATER review of the same control task.
-- --------------------------------------------------------------------------
create table if not exists ftw.external_write (
  write_id         uuid not null
    constraint external_write_pkey primary key
    default gen_random_uuid(),

  -- THE IDEMPOTENCY KEY (per-mutation, NOT per-task). UNIQUE, explicitly named.
  mutation_key     text not null
    constraint external_write_mutation_key_key unique,

  -- Provenance links into the control plane. run delete cascades the outbox row;
  -- a turn delete only clears the pointer (nullable-safe: the write record and its
  -- idempotency guarantee outlive an individual turn).
  run_id           uuid
    constraint external_write_run_id_fkey
    references ftw.governance_run (run_id) on delete cascade,
  turn_id          uuid
    constraint external_write_turn_id_fkey
    references ftw.run_turn (turn_id) on delete set null,

  -- Target POINTER (never content). e.g. ('clickup_task', '869e5zu97').
  target_kind      text not null,
  target_id        text not null,

  -- CHECKSUM of the payload (a fingerprint, NOT the payload/body itself).
  payload_checksum text not null,

  -- Stable PUBLIC id EMBEDDED in the posted comment (alongside the self-marker) so
  -- an ambiguous-timeout reconciler can search the target for it and resolve a
  -- lost-response write without re-posting. UNIQUE, explicitly named.
  mutation_id      text not null
    constraint external_write_mutation_id_key unique,

  state            ftw.write_state not null default 'applying',

  -- The REAL ClickUp comment id. NULL until the write is verified.
  response_id      text,

  -- HARD INVARIANT: a write can be `applied_verified` ONLY if it carries a real
  -- comment id. A response without a comment id can NEVER be applied_verified. This
  -- closes GPT MEDIUM-1 failure mode (4) at the DB level. Explicitly named.
  constraint external_write_applied_requires_response_chk
    check (state <> 'applied_verified' or response_id is not null),

  attempt_count    integer not null default 0
    constraint external_write_attempt_count_nonneg_chk check (attempt_count >= 0),
  last_error       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on constraint external_write_mutation_key_key on ftw.external_write is
  'IDEMPOTENCY KEY (per-MUTATION, not per-task): derived from '
  'run_id + turn_id + target + payload checksum. UNIQUE here is what makes '
  'claim-before-post idempotent across restarts and retries. DO NOT WEAKEN to a '
  'per-task key — that re-introduces GPT MEDIUM-1 (a legitimate later review blocked).';

comment on constraint external_write_applied_requires_response_chk on ftw.external_write is
  'HARD INVARIANT: applied_verified REQUIRES response_id is not null. A response '
  'without a real comment id can NEVER be recorded as applied_verified (GPT MEDIUM-1 '
  'failure mode 4). DO NOT WEAKEN or drop without an equal-or-stronger replacement.';

comment on column ftw.external_write.payload_checksum is
  'CHECKSUM / fingerprint of the payload — NOT the payload body. DO NOT WEAKEN: no '
  'governed content and no secret is ever stored in this table (pointers only).';

comment on column ftw.external_write.mutation_id is
  'Stable public id EMBEDDED in the posted comment so an ambiguous-timeout reconciler '
  'can find a lost-response write on the target and resolve it without re-posting.';

-- Reconciler scan: find writes stuck mid-flight (claimed but not yet verified) whose
-- outcome is unknown or retriable. Partial index confines it to the small backlog.
create index if not exists external_write_reconcile_idx
  on ftw.external_write (updated_at)
  where state in ('applying', 'outcome_unknown', 'retry_pending');

-- =============================================================================
-- SECURITY GATE (Vex) — RLS. DO NOT WEAKEN.
-- Enable RLS, then grant + policy the server-side `service_role` ONLY.
-- `anon`/`authenticated` get NEITHER a grant NOR a policy, so both the privilege
-- check and RLS refuse them (deny-by-default from both gates). Mirrors 0001 exactly,
-- including the concurrency-safe role guard, and is guarded to be re-runnable.
-- =============================================================================

alter table ftw.external_write enable row level security;

-- Roles pre-exist on real Supabase and are created by 0001; created-if-absent here
-- too so 0003 is robust if ever applied against an isolated substrate. Concurrency-
-- safe guard (roles live in cluster-wide pg_authid): the inner exception blocks turn
-- a "someone created it first" race into the intended no-op.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      create role anon nologin;
    exception
      when duplicate_object then null;
      when unique_violation then null;
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

-- Table + sequence privileges: service_role ONLY. anon/authenticated get nothing.
grant usage on schema ftw to service_role;
grant select, insert, update, delete on ftw.external_write to service_role;
grant usage, select on all sequences in schema ftw to service_role;

-- One permissive FOR ALL policy scoped TO service_role. Guarded so re-applying 0003
-- is a no-op (`create policy` is not natively idempotent). Because no policy names
-- anon/authenticated and RLS is enabled, those roles stay denied.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'ftw'
      and tablename = 'external_write'
      and policyname = 'service_role_all_external_write'
  ) then
    create policy service_role_all_external_write
      on ftw.external_write
      for all to service_role
      using (true) with check (true);
  end if;
end
$$;

-- (No anon/authenticated policies on purpose — deny-by-default. DO NOT WEAKEN.)
