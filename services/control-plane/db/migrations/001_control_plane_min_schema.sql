-- =============================================================================
-- BUILD-014 WP-A — Fusion247 Control Plane: MINIMUM Phase-0 schema (Postgres DDL)
-- Migration: 001_control_plane_min_schema                        (author: silas)
--
-- WHY THIS EXISTS
--   Postgres becomes the AUTHORITATIVE live operational + merge-gate store. GitHub
--   stays the mechanical merge enforcer + code/evidence authority. A verdict is
--   bound to an EXACT commit SHA by TYPED CONSTRAINTS — not by fragile application
--   `===` string comparisons. The Tower merge gate took four review rounds to
--   harden precisely because "merge-ready" state was HEAD-BLIND. This schema moves
--   that invariant out of code and into the database, where it is structurally
--   impossible to violate.
--
-- INFORMED BY (read, not copied) — the exact Tower bug this schema kills:
--   services/tower-baton/src/watcher.js  computeMergeReady() — head binding by ===
--   services/tower-baton/src/checkpoint.js line ~104 — head_sha is accepted as
--     /^[0-9a-f]{7,40}$/i (SEVEN-to-forty hex, CASE-INSENSITIVE), yet every head
--     comparison downstream is a raw `===`. A short `abc1234` or an upper-case
--     `ABC1234...` therefore silently fails to bind and a stale approval can be
--     carried to the wrong head. See the `ops.git_sha` DOMAIN below: a non-canonical
--     SHA cannot be STORED, so that comparison bug cannot be REPRESENTED here.
--
-- HOUSE-STYLE REFERENCE (matched deliberately):
--   services/fusion-tower/migrations/0001_wp0_control_plane.sql
--     (schema-namespace + enum-vs-table collision lesson + RLS deny-by-default +
--      evidence-pointers-not-content + named CHECKs + idempotent seed)
--   services/fusion-tower/migrations/0003_wp0_external_write_outbox.sql
--     (per-mutation idempotency key + payload checksum patterns)
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD. !!
--   Target schema: `ops` (control-plane DEV namespace). This file is NOT applied to
--   any live/prod Supabase project by this work package, and it must NEVER touch the
--   `asdair` schema or any personal/entrusted data. A live apply is Larry-gated and
--   must target an ISOLATED dev database. The migration is fully idempotent /
--   re-runnable (enums guarded by DO-blocks, `if not exists` throughout) so it can be
--   applied repeatedly against a throwaway dev substrate for verification.
--
-- !! SECURITY GATE — DO NOT WEAKEN !!
--   Row-Level Security is ENABLED **and FORCED** deny-by-default on EVERY table (see
--   the SECURITY GATE section). FORCE means even the table OWNER is subject to the
--   policies, so a mis-owned migration role cannot silently read/write around RLS.
--   ONLY the server-side `service_role` gets a grant + policy; `anon`/`authenticated`
--   get NEITHER. No column stores a secret value: every `*_ref`/pointer/payload holds
--   a POINTER or sanitised metadata, and a `classification` column marks any
--   sensitive/secret payload as NEVER eligible for public git provenance.
--   THREAT-MODEL RESIDUALS (documented, accepted for DEV) live in README §Threat model:
--     - a SUPERUSER / BYPASSRLS role sidesteps RLS entirely;
--     - the OWNER can `ALTER TABLE ... DISABLE TRIGGER` or `SET session_replication_role
--       = replica` to bypass the append-only / evidence-guard / no-truncate triggers.
--   Both are out-of-band admin actions, not reachable by the runtime `service_role`.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from BUILD-010 0001): a table implicitly
--   creates a composite type of the same name, so NO enum below shares a name with
--   any table. Tables: build, agent_run, job, agent_event, checkpoint, verdict,
--   merge_gate, command_request. Enums: data_classification, principal, job_status,
--   verdict_type, verdict_value, verdict_state, fusion_policy_decision,
--   github_mech_state, command_status. No overlap by construction.
--
-- R2/R3 CHANGE LOG (this amend — 001 has NEVER been applied to any live DB, so the
--   round-2 reviewer findings are folded into ONE clean migration, not a 002 patch):
--   F1  active-verdict uniqueness drops `active_generation` from the KEY (audit-only
--       counter now); supersede-then-insert in one txn is the ONLY path to a new
--       active verdict; readiness view made robust (bool_and over the single active).
--   F2  merge_gate composite FK (checkpoint_id, expected_head_sha) -> checkpoint
--       (id, head_sha) MATCH SIMPLE + a trigger that forbids fusion_policy_decision
--       ='approved' unless the head-bound TWO-reviewer approval actually exists.
--   F3  verdict/checkpoint evidence guards (deny rewrite + deny cascade-delete);
--       build/checkpoint/verdict FKs are ON DELETE NO ACTION.
--   F4  agent_event.build_id ON DELETE NO ACTION (reconciled with append-only).
--   F5  BEFORE TRUNCATE guards on evidence tables; FORCE RLS; security_invoker view
--       + GRANT SELECT to service_role.
--   F6  verdict reviewer<->type binding CHECK (codex=correction_loop, fable=cold_final).
--   F7  overall_action_state folds github_review_decision_cached (non-APPROVED blocks).
--   F8  test SQLSTATE fixed (restrict_violation = 23001) + new tests + real run.
--   F9  ops.claim_job / ops.reclaim_expired_leases (FOR UPDATE SKIP LOCKED) +
--       biconditional lease lifecycle CHECK.
--   F10 readiness aggregates coalesced to false for unreviewed checkpoints.
--   F11 checkpoint natural key is per-build (build_id, checkpoint_ref, head_sha).
--   F12 canonicalize_sha reports LENGTH only (never echoes the raw candidate).
--   F13 overall_action_state distinguishes github_unobserved from head_moved.
--   F14 CHECK ties fusion_policy_decision='superseded' to superseded_at NOT NULL.
--   F15 shared ops.touch_updated_at() trigger; lease hygiene biconditional CHECK.
--   R3-trim  workflow_run REMOVED (unreferenced projection-only, no Phase-0 proof
--            needs it — Codex flab call); agent_run.role REMOVED (free-text [later]).
--
-- FIELD CLASSIFICATION (R3): every table and column is tagged inline
--   [phase0] | [later] | [projection-only] | [provenance-later] | [not-yet-justified]
--   with the full table reproduced in services/control-plane/db/README.md.
-- =============================================================================

create schema if not exists ops;

-- --------------------------------------------------------------------------
-- Enumerated types (closed vocabularies). Each is wrapped in a DO-block so the
-- migration is idempotent (`create type` has no `if not exists`).
-- --------------------------------------------------------------------------

-- [phase0] Data sensitivity classification. Drives the git-provenance rule below.
do $$ begin
  create type ops.data_classification as enum (
    'public',    -- safe for public git provenance
    'internal',  -- operational; safe for the private control plane, not public git
    'sensitive', -- private / entrusted (e.g. household data) — NEVER public git
    'secret'     -- credentials/tokens — must never be stored as a value here at all
  );
exception when duplicate_object then null; end $$;

-- [phase0] Actor / reviewer registry vocabulary. HONEST provider labels only:
-- gpt_codex is OpenAI/Codex and MUST NEVER be relabelled xAI/Grok. `fable` is the
-- cold-final adversarial reviewer; `tower` orchestrates but never reviews.
do $$ begin
  create type ops.principal as enum (
    'larry',      -- Claude Code (Anthropic) — orchestrator
    'gpt_codex',  -- OpenAI Codex — correction-loop reviewer (NEVER xAI/Grok)
    'fable',      -- cold-final adversarial reviewer
    'warwick',    -- the single authorised human principal
    'tower'       -- Fusion Tower orchestrator (self-generated events; never reviews)
  );
exception when duplicate_object then null; end $$;

-- [phase0] Durable job/lease lifecycle (pgmq-compatible shape).
do $$ begin
  create type ops.job_status as enum (
    'pending',      -- ready to be leased
    'leased',       -- claimed; lease clock running (pgmq: visibility timeout)
    'succeeded',    -- terminal: done
    'failed',       -- transient failure; retryable while attempts < max_attempts
    'dead_letter'   -- terminal: exhausted attempts — parked for a human
  );
exception when duplicate_object then null; end $$;

-- [phase0] Which reviewer principal produced a verdict, by role. Head-bound
-- two-reviewer merge-readiness = one active approve of EACH type at the SAME head.
-- The reviewer<->type binding is enforced by ops.verdict.verdict_reviewer_role_chk
-- so 'correction_loop' can ONLY be gpt_codex and 'cold_final' can ONLY be fable —
-- two DISTINCT authorised reviewers, never one principal filling both slots (F6).
do $$ begin
  create type ops.verdict_type as enum (
    'correction_loop', -- the Codex correction-loop reviewer (principal = gpt_codex)
    'cold_final'       -- the Fable cold-final adversarial reviewer (principal = fable)
  );
exception when duplicate_object then null; end $$;

-- [phase0] The RAW reviewer verdict. `comment` is explicitly NOT an approval — it is
-- the "unverifiable" outcome and can never contribute to merge-readiness (mirrors
-- watcher.js computeMergeReady requiring the RAW verdict === 'approve').
do $$ begin
  create type ops.verdict_value as enum (
    'approve',
    'request_changes',
    'comment',   -- unverifiable / insufficient-diff — NEVER merge-ready
    'blocked'
  );
exception when duplicate_object then null; end $$;

-- [phase0] Verdict record lifecycle. Only an `active` verdict counts; a superseded
-- verdict is retained for audit but excluded from the active-uniqueness index. The
-- evidence-guard trigger allows ONLY the active->superseded transition — a superseded
-- verdict can NEVER flip back to active (F3).
do $$ begin
  create type ops.verdict_state as enum ('active', 'superseded');
exception when duplicate_object then null; end $$;

-- [phase0] FUSION policy-gate decision — distinct from GitHub mechanical state.
do $$ begin
  create type ops.fusion_policy_decision as enum (
    'pending',   -- no policy decision yet
    'approved',  -- Fusion policy approves THIS expected head
    'blocked',   -- Fusion policy blocks
    'superseded' -- a newer head/decision replaced this one
  );
exception when duplicate_object then null; end $$;

-- [projection-only] CACHED GitHub mechanical mergeable state. This is a PROJECTION
-- of GitHub's own `mergeable_state`; GitHub remains authoritative. `unknown` is the
-- honest default before an observation lands.
do $$ begin
  create type ops.github_mech_state as enum (
    'unknown',   -- not yet observed
    'clean',     -- mechanically mergeable
    'blocked',   -- required checks/reviews not satisfied
    'behind',    -- base moved; branch is behind
    'dirty',     -- merge conflict
    'draft',     -- PR is a draft
    'unstable'   -- non-required checks failing
  );
exception when duplicate_object then null; end $$;

-- [phase0] Command request/result lifecycle.
do $$ begin
  create type ops.command_status as enum (
    'requested',  -- intent recorded (idempotency reserved)
    'dispatched', -- handed to an executor
    'succeeded',
    'failed',
    'rejected'    -- refused by policy/authority
  );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- DOMAIN ops.git_sha — THE encoding of the Tower head-binding bug fix.
-- A canonical git commit SHA: lower-case, full 40 hex chars. A short (`abc1234`)
-- or upper-case (`ABC1234...`) value is REJECTED at write time. Callers MUST
-- canonicalise at the boundary (see ops.canonicalize_sha); they can NOT store an
-- un-normalised head that a later `=` comparison would silently fail to match.
-- This makes "merge-ready for the wrong head" impossible to REPRESENT, not merely
-- impossible to compute.
-- --------------------------------------------------------------------------
do $$ begin
  create domain ops.git_sha as text
    constraint git_sha_canonical_chk check (value ~ '^[0-9a-f]{40}$');
exception when duplicate_object then null; end $$;

-- Boundary canonicaliser. Trims surrounding whitespace, lower-cases, and validates a
-- full 40-char SHA; RAISES on a short/abbreviated head (the Tower `/[0-9a-f]{7,40}/`
-- acceptance is refused here). Use this to normalise an inbound head BEFORE storing.
-- F12: the exception reports only the candidate LENGTH, never the raw candidate —
-- a SHA is not itself a secret, but not echoing untrusted input into server logs is
-- house discipline. WHITESPACE POLICY (documented in README): only leading/trailing
-- ASCII whitespace is stripped; any interior whitespace or non-hex char fails.
create or replace function ops.canonicalize_sha(raw text)
returns ops.git_sha
language plpgsql
immutable
as $$
declare v text := lower(btrim(coalesce(raw, '')));
begin
  if v !~ '^[0-9a-f]{40}$' then
    raise exception 'non-canonical git SHA (candidate length %): a full 40-char lower-case hex SHA is required; short/abbreviated/upper-case heads are refused — this is the Tower head-binding bug class', length(v)
      using errcode = 'check_violation';
  end if;
  return v::ops.git_sha;
end;
$$;

-- Shared BEFORE UPDATE touch: keeps updated_at honest without per-table boilerplate
-- (F15). Attached only to the MUTABLE tables that carry updated_at.
create or replace function ops.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Shared BEFORE TRUNCATE guard for append-only / evidence tables (F5). TRUNCATE
-- bypasses row triggers, so it needs its own statement-level guard. RESIDUAL: the
-- table owner can DISABLE TRIGGER / SET session_replication_role=replica to bypass —
-- documented in README §Threat model; not reachable by the runtime service_role.
create or replace function ops.reject_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ops.% is append-only/evidence: TRUNCATE is rejected.', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

-- --------------------------------------------------------------------------
-- IDENTITY (minimum needed to hang the seven proofs on).
-- --------------------------------------------------------------------------

-- [phase0] build — one row per governed build (e.g. 'BUILD-014').
-- ON DELETE NO ACTION on every FK into build (F3/F4): a build with dependent evidence
-- (checkpoints, verdicts, events, gates) is deliberately UNDELETABLE — deleting it is
-- an honest 23503, never a silent cascade that shreds review evidence.
create table if not exists ops.build (
  id             uuid not null
    constraint build_pkey primary key default gen_random_uuid(),
  build_ref      text not null                                   -- [phase0] e.g. 'BUILD-014'
    constraint build_ref_key unique,
  repo           text,                                           -- [phase0] 'owner/repo' pointer
  title          text,                                           -- [phase0]
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now()              -- [phase0]
);

-- [phase0] agent_run — a minimal record of one agent's working span on a build.
-- R3-trim: the free-text `role` [later] column is removed — unjustified by any
-- Phase-0 proof (the reviewer ROLE that matters lives on verdict.verdict_type).
create table if not exists ops.agent_run (
  id             uuid not null
    constraint agent_run_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint agent_run_build_fkey references ops.build (id) on delete no action,
  principal      ops.principal not null,                         -- [phase0] who ran
  status         text,                                           -- [phase0]
  started_at     timestamptz not null default now(),             -- [phase0]
  ended_at       timestamptz                                     -- [phase0]
);

-- --------------------------------------------------------------------------
-- PROOF 1 — durable job/lease (pgmq-compatible). Leaseable, idempotency-keyed,
-- attempt-bounded, with a dead-letter terminal state. Claim/reclaim are transactional
-- functions (F9) so the attempt-increment + retry semantics live in ONE place.
-- --------------------------------------------------------------------------
create table if not exists ops.job (
  id             bigint generated always as identity            -- [phase0] pgmq: msg_id bigint
    constraint job_pkey primary key,
  queue          text not null,                                  -- [phase0] logical queue name
  -- [phase0] IDEMPOTENCY KEY: the same logical unit of work enqueued twice collides
  -- here and is read back rather than duplicated. GLOBAL across all queues (documented
  -- in README): a redelivery re-using a key in a DIFFERENT queue collides too — the
  -- key is the unit-of-work identity, not a per-queue counter.
  idempotency_key text not null
    constraint job_idempotency_key_key unique,
  payload        jsonb not null default '{}'::jsonb,             -- [phase0] pointers/metadata ONLY
  payload_hash   text,                                           -- [phase0] fingerprint of payload
  classification ops.data_classification not null default 'internal', -- [phase0]
  status         ops.job_status not null default 'pending',      -- [phase0]

  -- [phase0] LEASE (pgmq visibility-timeout analogue). BICONDITIONAL lease hygiene
  -- (F9/F15): a job is 'leased' IFF both owner and deadline are set; in EVERY other
  -- status both MUST be null. This makes a "leaked" half-lease unrepresentable.
  lease_owner    text,                                           -- [phase0]
  lease_deadline_at timestamptz,                                 -- [phase0]
  constraint job_lease_iff_leased_chk
    check (case when status = 'leased'
                then lease_owner is not null and lease_deadline_at is not null
                else lease_owner is null and lease_deadline_at is null
           end),

  attempts       integer not null default 0                      -- [phase0]
    constraint job_attempts_nonneg_chk check (attempts >= 0),
  max_attempts   integer not null default 5                      -- [phase0]
    constraint job_max_attempts_positive_chk check (max_attempts >= 1),

  -- [phase0] DEAD-LETTER. A job may only be dead_letter once its attempts are
  -- exhausted (structural, not merely conventional).
  dead_lettered_at timestamptz,                                  -- [phase0]
  last_error     text,                                           -- [phase0]
  constraint job_dead_letter_requires_exhausted_chk
    check (status <> 'dead_letter' or attempts >= max_attempts),

  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now()              -- [phase0]
);

-- [phase0] Ready-scan: pull the next pending job (FIFO by id). Partial-index-confined.
create index if not exists job_ready_idx on ops.job (queue, id) where status = 'pending';
-- [phase0] Lease-reclaim watchdog scan: leased jobs past their deadline.
create index if not exists job_lease_watchdog_idx on ops.job (lease_deadline_at) where status = 'leased';

comment on constraint job_dead_letter_requires_exhausted_chk on ops.job is
  'A job can only be dead_letter after its retry budget is exhausted (attempts >= max_attempts). '
  'DO NOT WEAKEN — this keeps the dead-letter park a genuine terminal, not a bypass of retry.';
comment on constraint job_lease_iff_leased_chk on ops.job is
  'BICONDITIONAL lease hygiene: leased IFF (owner AND deadline set); any non-leased status '
  'requires BOTH null. A half-set lease is unrepresentable. DO NOT WEAKEN.';

-- [phase0] Transactional CLAIM (F9): atomically lease the oldest pending job on a
-- queue with FOR UPDATE SKIP LOCKED, so N concurrent workers each grab a DISTINCT
-- job (no double-lease, no blocking). Attempt-increment semantics: EACH lease counts
-- as one attempt (incremented here at claim time). Returns the leased row, or NULL
-- when the queue has no pending work.
create or replace function ops.claim_job(p_queue text, p_owner text, p_lease_seconds integer default 30)
returns ops.job
language plpgsql
as $$
declare j ops.job;
begin
  if p_lease_seconds <= 0 then
    raise exception 'lease seconds must be positive' using errcode = 'check_violation';
  end if;
  select * into j
    from ops.job
   where queue = p_queue and status = 'pending'
   order by id
   for update skip locked
   limit 1;
  if not found then
    return null;
  end if;
  update ops.job
     set status            = 'leased'::ops.job_status,
         lease_owner       = p_owner,
         lease_deadline_at = now() + make_interval(secs => p_lease_seconds),
         attempts          = attempts + 1
   where id = j.id
   returning * into j;
  return j;
end;
$$;

-- [phase0] Transactional RECLAIM (F9): expire stale leases. RETRY semantics: a job
-- whose lease deadline has passed goes back to 'pending' (retryable) UNLESS its
-- attempts are already exhausted, in which case it is parked in 'dead_letter'. Clears
-- the lease either way (biconditional check stays satisfied). Returns the reclaimed rows.
create or replace function ops.reclaim_expired_leases()
returns setof ops.job
language plpgsql
as $$
begin
  return query
  update ops.job
     set status            = (case when attempts >= max_attempts then 'dead_letter' else 'pending' end)::ops.job_status,
         dead_lettered_at  = case when attempts >= max_attempts then now() else dead_lettered_at end,
         lease_owner       = null,
         lease_deadline_at = null
   where status = 'leased' and lease_deadline_at < now()
   returning *;
end;
$$;

-- --------------------------------------------------------------------------
-- PROOF 2 — append-only event path. INSERT-only + immutable: a trigger REJECTS any
-- UPDATE or DELETE of an existing event. Corrections are NEW events, never edits.
-- Every event carries a delivery/idempotency key; material payloads carry a hash.
-- Sensitive/secret payloads are flagged so they are never destined for public git.
-- --------------------------------------------------------------------------
create table if not exists ops.agent_event (
  id             uuid not null
    constraint agent_event_pkey primary key default gen_random_uuid(),
  -- [phase0] nullable until bound. ON DELETE NO ACTION (F4): SET NULL would fire the
  -- append-only BEFORE UPDATE trigger and abort — an impossible cascade. NO ACTION is
  -- the honest choice: a build that has emitted events is UNDELETABLE (23503), which
  -- also protects the event evidence. Corrections/rebinding are NEW events, never edits.
  build_id       uuid
    constraint agent_event_build_fkey references ops.build (id) on delete no action,
  -- [phase0] DELIVERY / IDEMPOTENCY KEY — every external event carries one; a
  -- redelivery collides here and is ingested at most once.
  delivery_key   text not null
    constraint agent_event_delivery_key_key unique,
  event_kind     text not null,                                  -- [phase0] e.g. 'checkpoint.posted'
  actor          ops.principal,                                  -- [phase0] who emitted it
  -- [phase0] MATERIAL PAYLOAD HASH — a fingerprint proving payload integrity without
  -- storing the governed content. NOT NULL: an event with material content must carry
  -- its hash (use a sentinel hash for a genuinely empty payload).
  payload_hash   text not null,
  payload        jsonb not null default '{}'::jsonb,             -- [phase0] pointers/sanitised ONLY
  -- [phase0] CLASSIFICATION + provenance rule (see git_provenance_eligible below).
  classification ops.data_classification not null default 'internal',
  -- [phase0] Derived: only public/internal events may ever feed PUBLIC git provenance.
  -- sensitive/secret are structurally excluded (generated, cannot be set by hand).
  git_provenance_eligible boolean
    generated always as (classification in ('public', 'internal')) stored,
  occurred_at    timestamptz not null default now(),             -- [phase0]
  received_at    timestamptz not null default now()              -- [phase0]
);

create index if not exists agent_event_build_idx on ops.agent_event (build_id, occurred_at);

comment on column ops.agent_event.git_provenance_eligible is
  'DERIVED, immutable: true only for public/internal. sensitive/secret events are NEVER '
  'eligible for PUBLIC git provenance (Fusion247 repo is public; entrusted data stays off git). '
  'DO NOT WEAKEN to include sensitive/secret.';

-- APPEND-ONLY ENFORCEMENT (trigger). Agents get INSERT + SELECT only (grants below);
-- this trigger is defence-in-depth: even a mis-granted UPDATE/DELETE is rejected. A
-- correction is a NEW event, never a mutation of an existing one. restrict_violation
-- maps to SQLSTATE 23001 (F8 — the round-1 test mis-asserted 2F004).
create or replace function ops.reject_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ops.agent_event is APPEND-ONLY: % is rejected. Corrections are NEW events, never edits.', tg_op
    using errcode = 'restrict_violation';
  return null;
end;
$$;

drop trigger if exists agent_event_append_only on ops.agent_event;
create trigger agent_event_append_only
  before update or delete on ops.agent_event
  for each row execute function ops.reject_event_mutation();

-- F5: TRUNCATE would bypass the row trigger — guard it at the statement level.
drop trigger if exists agent_event_no_truncate on ops.agent_event;
create trigger agent_event_no_truncate
  before truncate on ops.agent_event
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- PROOF 3 — exact-SHA checkpoint -> verdict. THE core invariant.
--
-- A checkpoint is one (logical checkpoint ref, exact head) pair; a Tower
-- checkpoint_ref reused at a new head is a NEW checkpoint row. head_sha is a
-- canonical SHA by domain. The UNIQUE (id, head_sha) is what lets a verdict
-- COMPOSITE-FK onto the checkpoint's EXACT head — so a verdict whose SHA is not the
-- checkpoint's recorded head is a FOREIGN KEY VIOLATION, not a runtime bug.
--
-- Evidence protection (F3): checkpoint identity (id, build_id, checkpoint_ref,
-- head_sha, created_at) is immutable via the guard trigger; build_id FK and the
-- verdict->checkpoint FK are ON DELETE NO ACTION, so a checkpoint referenced by any
-- verdict cannot be deleted (23503) — evidence never silently cascades away.
-- --------------------------------------------------------------------------
create table if not exists ops.checkpoint (
  id             uuid not null
    constraint checkpoint_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint checkpoint_build_fkey references ops.build (id) on delete no action,
  checkpoint_ref text not null,                                  -- [phase0] Tower checkpoint_id (reusable)
  head_sha       ops.git_sha not null,                           -- [phase0] canonical exact head
  branch         text,                                           -- [phase0] mutable pointer
  brief_ref      text,                                           -- [phase0] mutable pointer
  created_at     timestamptz not null default now(),             -- [phase0]
  -- F11: natural key is PER-BUILD — a (ref, head) pair is unique within a build, not
  -- globally (two builds may legitimately share a checkpoint_ref/head).
  constraint checkpoint_build_ref_head_key unique (build_id, checkpoint_ref, head_sha),
  -- The composite-FK target: lets verdict/merge_gate bind to this checkpoint's EXACT head.
  constraint checkpoint_id_head_uk unique (id, head_sha)
);

-- Evidence guard (F3): checkpoint IDENTITY is immutable; only the branch/brief_ref
-- pointers may be updated. DELETE is left to the FK (NO ACTION -> 23503 when referenced).
create or replace function ops.checkpoint_guard_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.build_id <> old.build_id
     or new.checkpoint_ref <> old.checkpoint_ref
     or new.head_sha <> old.head_sha
     or new.created_at <> old.created_at then
    raise exception 'ops.checkpoint identity (id/build_id/checkpoint_ref/head_sha/created_at) is immutable; a head change is a NEW checkpoint row (this is what makes head-binding an FK)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists checkpoint_immutable_identity on ops.checkpoint;
create trigger checkpoint_immutable_identity
  before update on ops.checkpoint
  for each row execute function ops.checkpoint_guard_mutation();

drop trigger if exists checkpoint_no_truncate on ops.checkpoint;
create trigger checkpoint_no_truncate
  before truncate on ops.checkpoint
  for each statement execute function ops.reject_truncate();

create table if not exists ops.verdict (
  id             uuid not null
    constraint verdict_pkey primary key default gen_random_uuid(),
  checkpoint_id  uuid not null,                                  -- [phase0]
  -- HARD INVARIANT: reviewed_commit_sha NOT NULL, canonical by domain.
  reviewed_commit_sha ops.git_sha not null,                      -- [phase0]
  reviewer       ops.principal not null,                         -- [phase0] HARD INVARIANT: NOT NULL
  verdict_type   ops.verdict_type not null,                      -- [phase0]
  verdict        ops.verdict_value not null,                     -- [phase0] HARD INVARIANT: NOT NULL
  state          ops.verdict_state not null default 'active',    -- [phase0]
  -- [phase0] AUDIT-ONLY generation counter (F1). It is NO LONGER part of the active
  -- uniqueness key — bumping it can no longer conjure a second concurrent active
  -- verdict. It records how many times this (reviewer, head, type) slot has cycled.
  active_generation integer not null default 1
    constraint verdict_active_generation_positive_chk check (active_generation >= 1),
  prompt_fingerprint text,                                       -- [phase0] QA-skill fingerprint
  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]

  -- F6: reviewer<->type binding — 'correction_loop' verdicts come ONLY from gpt_codex,
  -- 'cold_final' ONLY from fable. One principal therefore cannot satisfy both reviewer
  -- slots, so the two-reviewer gate means two DISTINCT authorised reviewers.
  constraint verdict_reviewer_role_chk check (
    (verdict_type = 'correction_loop' and reviewer = 'gpt_codex')
    or (verdict_type = 'cold_final' and reviewer = 'fable')
  ),

  -- EXACT-SHA BINDING: the verdict can ONLY reference a head that this checkpoint
  -- actually recorded. A verdict for the "wrong head" cannot be inserted at all.
  -- ON DELETE NO ACTION (F3): deleting a checkpoint that has verdicts is a 23503, not
  -- a cascade that erases review evidence.
  constraint verdict_checkpoint_head_fkey
    foreign key (checkpoint_id, reviewed_commit_sha)
    references ops.checkpoint (id, head_sha) on delete no action
);

-- HARD INVARIANT (F1): at most ONE active verdict per (reviewer, reviewed head, type).
-- active_generation is DELIBERATELY NOT in the key — to record a NEW active verdict you
-- MUST first supersede the prior (state='superseded') in the SAME transaction. A
-- concurrent second active row is a 23505. This closes the round-1 hole where a bumped
-- generation let a stale active 'approve' co-exist with (and mask) a newer active reject.
create unique index if not exists verdict_active_unique
  on ops.verdict (reviewer, reviewed_commit_sha, verdict_type)
  where state = 'active';

comment on constraint verdict_checkpoint_head_fkey on ops.verdict is
  'EXACT-SHA BINDING: (checkpoint_id, reviewed_commit_sha) FKs onto ops.checkpoint '
  '(id, head_sha). A verdict can only exist bound to the checkpoint''s recorded head, '
  'so "merge-ready for the wrong head" is a FK violation, not a runtime bug. Combined '
  'with the ops.git_sha domain (canonical SHAs only) this is the DB-level kill of the '
  'Tower head-binding bug class. DO NOT WEAKEN to a single-column FK.';

comment on index ops.verdict_active_unique is
  'HARD INVARIANT (F1): no duplicate ACTIVE verdict for the same (reviewer, reviewed '
  'head, verdict_type). active_generation is an AUDIT counter, NOT part of this key — '
  'supersede-then-insert in one txn is the ONLY path to a fresh active verdict. '
  'DO NOT re-add active_generation to this index.';

-- Evidence guard (F3): a verdict is review evidence. The ONLY permitted UPDATE is the
-- active->superseded transition (setting superseded_at); every other column is frozen,
-- and a superseded verdict can NEVER flip back to active. DELETE is always rejected
-- (supersede, never delete).
create or replace function ops.verdict_guard_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.verdict is review evidence: DELETE is rejected (supersede, never delete)'
      using errcode = 'restrict_violation';
  end if;
  if not (old.state = 'active' and new.state = 'superseded') then
    raise exception 'ops.verdict UPDATE only permits the active->superseded transition (got % -> %)', old.state, new.state
      using errcode = 'restrict_violation';
  end if;
  if new.id <> old.id
     or new.checkpoint_id <> old.checkpoint_id
     or new.reviewed_commit_sha <> old.reviewed_commit_sha
     or new.reviewer <> old.reviewer
     or new.verdict_type <> old.verdict_type
     or new.verdict <> old.verdict
     or new.active_generation <> old.active_generation
     or coalesce(new.prompt_fingerprint, '') <> coalesce(old.prompt_fingerprint, '')
     or new.created_at <> old.created_at then
    raise exception 'ops.verdict UPDATE may only set state=superseded (+ superseded_at); no other column may change'
      using errcode = 'restrict_violation';
  end if;
  new.superseded_at := coalesce(new.superseded_at, now());
  return new;
end;
$$;

drop trigger if exists verdict_evidence_guard on ops.verdict;
create trigger verdict_evidence_guard
  before update or delete on ops.verdict
  for each row execute function ops.verdict_guard_mutation();

drop trigger if exists verdict_no_truncate on ops.verdict;
create trigger verdict_no_truncate
  before truncate on ops.verdict
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- [projection-only] VIEW — head-bound two-reviewer merge readiness. This MOVES
-- Tower's computeMergeReady() invariant into the DB as data: because verdict is
-- composite-FK-bound to the checkpoint's EXACT head, any verdict joined here is
-- guaranteed to have reviewed THIS head. Readiness = one ACTIVE genuine `approve`
-- of EACH type at the same head. (`comment` is excluded — never merge-ready.)
--
-- F1 robustness: with the active-uniqueness index there is at most ONE active verdict
--   per (reviewer, head, type). We use bool_and(verdict='approve') FILTERed to the
--   active rows of each type — true ONLY when the single active verdict is 'approve';
--   a newer active reject makes it false. It can never be masked by a stale approve.
-- F10: bool_and over a LEFT JOIN is NULL for an unreviewed checkpoint -> coalesced false.
-- F5: security_invoker so the view runs with the QUERYING role's privileges (not the
--   view owner's), keeping RLS honest; GRANT SELECT to service_role is in the gate below.
-- --------------------------------------------------------------------------
create or replace view ops.checkpoint_merge_readiness
with (security_invoker = true) as
select
  c.id                     as checkpoint_id,
  c.build_id,
  c.checkpoint_ref,
  c.head_sha,
  coalesce(bool_and(v.verdict = 'approve')
    filter (where v.verdict_type = 'correction_loop' and v.state = 'active'), false)
      as correction_loop_approved,
  coalesce(bool_and(v.verdict = 'approve')
    filter (where v.verdict_type = 'cold_final' and v.state = 'active'), false)
      as cold_final_approved,
  (coalesce(bool_and(v.verdict = 'approve')
     filter (where v.verdict_type = 'correction_loop' and v.state = 'active'), false)
   and
   coalesce(bool_and(v.verdict = 'approve')
     filter (where v.verdict_type = 'cold_final' and v.state = 'active'), false))
      as both_reviewers_approved_this_head
from ops.checkpoint c
left join ops.verdict v
  on v.checkpoint_id = c.id and v.reviewed_commit_sha = c.head_sha
group by c.id, c.build_id, c.checkpoint_ref, c.head_sha;

-- --------------------------------------------------------------------------
-- PROOF 4/5 — Fusion policy-gate decision (merge_gate) WITH dual-gate separation.
--
-- Fusion POLICY state (fusion_policy_decision, expected_head_sha) is kept STRICTLY
-- distinct from CACHED GitHub MECHANICAL state (github_*_cached, *_observed_at). It
-- is impossible to represent one undifferentiated "Approved": the cockpit reads the
-- two source fields plus the derived overall_action_state.
--
-- F2 (head-bound + verdict-bound):
--   (a) COMPOSITE FK (checkpoint_id, expected_head_sha) -> checkpoint (id, head_sha)
--       MATCH SIMPLE: when checkpoint_id is set, the gate's expected head MUST be a
--       head that checkpoint actually recorded (else FK 23503). MATCH SIMPLE leaves
--       the link optional while checkpoint_id is NULL (expected_head_sha is NOT NULL,
--       so a set checkpoint_id always triggers the check). ON DELETE NO ACTION — a
--       SET NULL would collide with expected_head_sha NOT NULL.
--   (b) TRIGGER merge_gate_require_reviewers: fusion_policy_decision='approved' is
--       REJECTED unless the head-bound TWO-reviewer approval actually exists for
--       (checkpoint_id, expected_head_sha) per the readiness view. Because
--       overall_action_state='mergeable' requires fusion_policy_decision='approved',
--       a gate can NEVER advertise 'mergeable' for a head that both required reviewers
--       have not ACTIVELY approved. Readiness is DERIVED from the verdict chain, never
--       a free-text field a caller can set.
-- --------------------------------------------------------------------------
create table if not exists ops.merge_gate (
  id             uuid not null
    constraint merge_gate_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint merge_gate_build_fkey references ops.build (id) on delete no action,
  checkpoint_id  uuid,                                           -- [phase0] head's checkpoint (required when approved)

  -- ---- FUSION POLICY side (authoritative for POLICY) ----
  fusion_policy_decision ops.fusion_policy_decision not null default 'pending', -- [phase0]
  -- HARD INVARIANT: expected_head_sha NOT NULL, canonical by domain. The head the
  -- Fusion policy decision is bound to.
  expected_head_sha ops.git_sha not null,                        -- [phase0]
  policy_reason  text,                                           -- [phase0]

  -- ---- CACHED GITHUB MECHANICAL side (PROJECTION; GitHub authoritative) ----
  github_mech_state_cached ops.github_mech_state not null default 'unknown', -- [projection-only]
  github_head_sha_cached   ops.git_sha,                          -- [projection-only] canonical
  github_review_decision_cached text,                            -- [projection-only] APPROVED/CHANGES_REQUESTED/REVIEW_REQUIRED
  github_observed_at       timestamptz,                          -- [projection-only] when GH was read

  -- ---- DERIVED (generated, immutable) ----
  -- [phase0] Do the two sides even refer to the same head? (cockpit convenience)
  heads_agree    boolean
    generated always as (
      github_head_sha_cached is not null and github_head_sha_cached = expected_head_sha
    ) stored,
  -- [phase0] The single overall action state. References ONLY base columns (a
  -- generated column may not reference another generated column). F13 distinguishes
  -- github_unobserved (no cached head yet) from head_moved (cached head diverged).
  -- F7 folds the cached GitHub REVIEW decision in: a non-APPROVED review decision
  -- (e.g. CHANGES_REQUESTED / REVIEW_REQUIRED) blocks 'mergeable'.
  overall_action_state text
    generated always as (
      case
        when superseded_at is not null then 'superseded'
        when fusion_policy_decision <> 'approved' then 'fusion_not_approved'
        when github_head_sha_cached is null then 'github_unobserved'
        when github_head_sha_cached <> expected_head_sha then 'head_moved'
        when github_mech_state_cached <> 'clean' then 'github_blocked'
        when github_review_decision_cached is not null
             and github_review_decision_cached <> 'APPROVED' then 'github_blocked'
        else 'mergeable'
      end
    ) stored,

  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]

  -- F2(a): composite FK binds expected_head_sha to the checkpoint's recorded head.
  constraint merge_gate_checkpoint_head_fkey
    foreign key (checkpoint_id, expected_head_sha)
    references ops.checkpoint (id, head_sha) match simple on delete no action,
  -- F7: restrict the cached review decision to GitHub's known reviewDecision values
  -- (or NULL = not-yet-observed / no review required).
  constraint merge_gate_github_review_decision_chk check (
    github_review_decision_cached is null
    or github_review_decision_cached in ('APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED')
  ),
  -- F14: tie the two supersession representations together.
  constraint merge_gate_superseded_consistency_chk check (
    fusion_policy_decision <> 'superseded' or superseded_at is not null
  )
);

-- A moved head must invalidate the prior decision: at most ONE non-superseded gate
-- per build. To record a decision for a new head, supersede the prior first.
create unique index if not exists merge_gate_one_live_per_build
  on ops.merge_gate (build_id)
  where superseded_at is null;

-- F2(b): 'approved' REQUIRES a real head-bound two-reviewer approval. This is the
-- clause that stops a caller writing fusion_policy_decision='approved' (and thus a
-- 'mergeable' overall state) for a head the reviewers never both approved.
create or replace function ops.merge_gate_require_reviewers()
returns trigger
language plpgsql
as $$
declare v_ready boolean;
begin
  if new.fusion_policy_decision = 'approved' and new.superseded_at is null then
    if new.checkpoint_id is null then
      raise exception 'merge_gate: fusion_policy_decision=approved requires a checkpoint_id (the head under review)'
        using errcode = 'check_violation';
    end if;
    -- The composite FK already guarantees (checkpoint_id, expected_head_sha) is a real
    -- recorded checkpoint head, so this lookup always finds exactly one row.
    select both_reviewers_approved_this_head into v_ready
      from ops.checkpoint_merge_readiness
     where checkpoint_id = new.checkpoint_id
       and head_sha = new.expected_head_sha;
    if not coalesce(v_ready, false) then
      raise exception 'merge_gate: cannot approve — both required reviewers (gpt_codex correction_loop + fable cold_final) do not have an ACTIVE approve at head %', new.expected_head_sha
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists merge_gate_require_reviewers on ops.merge_gate;
create trigger merge_gate_require_reviewers
  before insert or update on ops.merge_gate
  for each row execute function ops.merge_gate_require_reviewers();

comment on column ops.merge_gate.overall_action_state is
  'DUAL-GATE SEPARATION (do not collapse): derived from BOTH the Fusion policy side '
  '(fusion_policy_decision, expected_head_sha) AND the cached GitHub mechanical side '
  '(github_mech_state_cached, github_head_sha_cached, github_review_decision_cached). '
  'Impossible to represent one undifferentiated "Approved": the cockpit shows '
  '"Fusion policy: approved for <sha> / GitHub mechanical: <state> / Overall: <this>". '
  'F13 splits github_unobserved from head_moved; F7 folds the GitHub review decision in '
  '(non-APPROVED -> github_blocked). ''approved'' itself is gated by '
  'merge_gate_require_reviewers, so mergeable REQUIRES a real head-bound two-reviewer approve.';

-- --------------------------------------------------------------------------
-- PROOF 6 — command request/result. Idempotency-keyed; args/result carry hashes;
-- classification governs provenance.
-- --------------------------------------------------------------------------
create table if not exists ops.command_request (
  id             uuid not null
    constraint command_request_pkey primary key default gen_random_uuid(),
  build_id       uuid                                            -- [phase0] nullable
    constraint command_request_build_fkey references ops.build (id) on delete no action,
  -- [phase0] IDEMPOTENCY KEY — a redelivered command collides here and reads back.
  idempotency_key text not null
    constraint command_request_idempotency_key_key unique,
  command_kind   text not null,                                  -- [phase0]
  requested_by   ops.principal not null,                         -- [phase0]
  args           jsonb not null default '{}'::jsonb,             -- [phase0] pointers/sanitised
  args_hash      text,                                           -- [phase0] fingerprint
  status         ops.command_status not null default 'requested',-- [phase0]
  result         jsonb,                                          -- [phase0] pointers/sanitised
  result_hash    text,                                           -- [phase0] fingerprint
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now()              -- [phase0]
);

-- --------------------------------------------------------------------------
-- F15: shared touch triggers keep updated_at honest on the MUTABLE tables.
-- --------------------------------------------------------------------------
drop trigger if exists build_touch_updated_at on ops.build;
create trigger build_touch_updated_at before update on ops.build
  for each row execute function ops.touch_updated_at();
drop trigger if exists job_touch_updated_at on ops.job;
create trigger job_touch_updated_at before update on ops.job
  for each row execute function ops.touch_updated_at();
drop trigger if exists merge_gate_touch_updated_at on ops.merge_gate;
create trigger merge_gate_touch_updated_at before update on ops.merge_gate
  for each row execute function ops.touch_updated_at();
drop trigger if exists command_request_touch_updated_at on ops.command_request;
create trigger command_request_touch_updated_at before update on ops.command_request
  for each row execute function ops.touch_updated_at();

-- =============================================================================
-- SECURITY GATE — RLS deny-by-default, FORCED. DO NOT WEAKEN.
-- Enable + FORCE RLS on EVERY table; grant + policy the server-side `service_role`
-- ONLY. FORCE (F5) makes even the table owner subject to the policies, so ownership
-- and the runtime role are separated in effect. agent_event gets INSERT + SELECT only
-- and verdict gets NO DELETE (append-only / evidence at the privilege layer too).
-- anon/authenticated get NEITHER a grant NOR a policy.
-- SUPABASE ASSUMPTION (documented in README): the runtime `service_role` there is a
-- BYPASSRLS role, so these policies are defence-in-depth; the object owner should be a
-- DISTINCT admin role, never the runtime role.
-- =============================================================================

alter table ops.build            enable row level security;
alter table ops.agent_run        enable row level security;
alter table ops.job              enable row level security;
alter table ops.agent_event      enable row level security;
alter table ops.checkpoint       enable row level security;
alter table ops.verdict          enable row level security;
alter table ops.merge_gate       enable row level security;
alter table ops.command_request  enable row level security;

alter table ops.build            force row level security;
alter table ops.agent_run        force row level security;
alter table ops.job              force row level security;
alter table ops.agent_event      force row level security;
alter table ops.checkpoint       force row level security;
alter table ops.verdict          force row level security;
alter table ops.merge_gate       force row level security;
alter table ops.command_request  force row level security;

-- Roles pre-exist on real Supabase; created-if-absent for an isolated dev substrate.
-- Concurrency-safe guard (roles are cluster-wide in pg_authid).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    begin create role anon nologin; exception when duplicate_object then null; when unique_violation then null; end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin create role authenticated nologin; exception when duplicate_object then null; when unique_violation then null; end;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    begin create role service_role nologin; exception when duplicate_object then null; when unique_violation then null; end;
  end if;
end
$$;

grant usage on schema ops to service_role;
-- Full DML for service_role on the fully-mutable tables...
grant select, insert, update, delete on
  ops.build, ops.agent_run, ops.job, ops.checkpoint, ops.merge_gate, ops.command_request
  to service_role;
-- ...verdict is EVIDENCE: NO DELETE at the privilege layer (F3). UPDATE is allowed but
-- the evidence-guard trigger narrows it to active->superseded only.
grant select, insert, update on ops.verdict to service_role;
-- ...agent_event is APPEND-ONLY at the privilege layer: INSERT + SELECT only.
-- (The trigger is defence-in-depth behind this grant.)
grant select, insert on ops.agent_event to service_role;
grant usage, select on all sequences in schema ops to service_role;
-- F5: the readiness view must be selectable by the runtime role (round-1 granted it to
-- no one — a functional dead-end). security_invoker means the caller still needs SELECT
-- on the underlying checkpoint/verdict, which service_role has.
grant select on ops.checkpoint_merge_readiness to service_role;
-- The transactional job helpers + the boundary canonicaliser.
grant execute on function ops.canonicalize_sha(text) to service_role;
grant execute on function ops.claim_job(text, text, integer) to service_role;
grant execute on function ops.reclaim_expired_leases() to service_role;

-- One permissive FOR ALL policy per table, scoped TO service_role. Because no policy
-- names anon/authenticated and RLS is enabled+forced, those roles stay denied. The
-- policies are idempotent via drop-if-exists.
do $$
declare t text;
begin
  foreach t in array array[
    'build','agent_run','job','agent_event',
    'checkpoint','verdict','merge_gate','command_request'
  ] loop
    execute format('drop policy if exists service_role_all_%1$s on ops.%1$s', t);
    execute format(
      'create policy service_role_all_%1$s on ops.%1$s for all to service_role using (true) with check (true)',
      t);
  end loop;
end
$$;

-- (No anon/authenticated policies on purpose — deny-by-default until a future WP
--  authors a gated direct-principal path under the security gate.)
