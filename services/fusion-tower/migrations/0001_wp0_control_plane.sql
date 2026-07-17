-- =============================================================================
-- BUILD-010 WP0 — Fusion Tower governance control-plane (Supabase / Postgres DDL)
-- Migration: 0001_wp0_control_plane                              (author: silas)
--
-- Source of truth for this shape:
--   Builds/BUILD-010-fusion-tower/Architecture/control-plane-schema.md
--   Builds/BUILD-010-fusion-tower/Architecture/dedup-and-timeout-contract.md
--
-- House-style reference (MERGED BUILD-002 WP0 patterns, on main):
--   services/fusion-capture-gateway/migrations/0001_wp0_operational_baseline.sql
--     (schema-namespace + enum-vs-table collision lesson + RLS-enable stub)
--   services/fusion-capture-gateway/migrations/0003_wp0_rls_policies.sql
--     (concurrency-safe role guard + service_role-only deny-by-default policies)
--   services/fusion-capture-gateway/migrations/0004_wp0_retry_retention_indexes.sql
--     (partial index over a lease/deadline column — the watchdog scan pattern)
--   services/fusion-capture-gateway/SECURITY.md  (secret homes: pointers, never values)
--
-- SCOPE: the SMALLEST reusable governed slice of a "governance air-traffic
-- control" loop. A governance RUN advances through bounded TURNS; a specific
-- RESPONDER (larry = Claude Code, gpt_codex = OpenAI Codex controller, or the
-- human warwick) owns each turn; external EVENTS (GitHub PR/check/comment,
-- ClickUp task changes) advance state; a 5-minute dead-man watchdog reaps a
-- silent turn; Warwick sees only terminal outcomes.
--
-- Supabase is DURABLE OPERATIONAL STATE for this control plane — NOT the
-- canonical Brain. Markdown / myPKA stays canonical (BUILD-002 matrix §3). Every
-- evidence column and every payload here holds a POINTER (PR ref / commit sha /
-- task id / path), NEVER the governed content itself. Single authorised user,
-- low volume.
--
-- DESIGN ARTIFACT ONLY: this file is NOT applied to the live Supabase project by
-- this work package. Larry gates any live apply. It provisions no secrets and no
-- personal data. The four `ftw.agent_identity` seed rows are non-secret REFERENCE
-- data (honest signer labels + NULL key pointers), not personal data.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from BUILD-002 0001): a table
-- implicitly creates a composite type of the same name, so NO enum below shares a
-- name with any table. Tables: governance_run, run_turn, run_event,
-- agent_identity. Enums: run_status, run_outcome, turn_state, principal,
-- event_source. No overlap by construction.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Row-Level Security is ENABLED deny-by-default on EVERY table. WP0 is a SINGLE
-- authorised user; ONLY the server-side `service_role` principal touches this
-- schema. `anon`/`authenticated` receive NEITHER a grant NOR a policy — both the
-- privilege check and RLS refuse them. No secret value is stored in any column:
-- `agent_identity.signing_key_ref` is a KEY ID / POINTER only, never a private
-- key; `run_event.payload` and every `*_ref`/`*_context` jsonb hold pointers and
-- sanitised metadata, never secrets or governed knowledge. Do not add an
-- anon/authenticated policy, do not disable RLS, do not store a secret value.
-- =============================================================================

-- Namespaced so the Tower control plane attaches to the shared Fusion247 Supabase
-- foundation WITHOUT forking it or colliding with fcg.* (BUILD-002). "ftw" =
-- fusion-tower.
create schema if not exists ftw;

-- --------------------------------------------------------------------------
-- Enumerated types. First-class Postgres enums for every closed vocabulary.
-- Provider-neutral where it can be; honest where it must be (see `principal`).
-- --------------------------------------------------------------------------

-- Run lifecycle (see control-plane-schema.md §"run lifecycle"). `blocked`,
-- `timed_out`, `completed`, `cancelled` are the terminal statuses; the rest are
-- live/waiting states.
create type ftw.run_status as enum (
  'created',            -- row exists, scope locked, not yet dispatched
  'active',             -- tower is driving; a turn is being prepared
  'awaiting_responder', -- a turn is dispatched; waiting on larry/gpt_codex
  'awaiting_decision',  -- a human decision gate is open; waiting on warwick
  'blocked',            -- terminal-ish: cannot proceed without intervention
  'timed_out',          -- terminal: a watchdog/budget deadline fired
  'completed',          -- terminal: goal reached
  'cancelled'           -- terminal: withdrawn
);

-- Terminal outcome Warwick actually sees. Distinct from `run_status`: several
-- statuses can map to one surfaced outcome. Named `run_outcome` (NOT
-- `terminal_outcome`) purely for brevity; no table by either name exists so
-- there is no collision.
create type ftw.run_outcome as enum (
  'ready',             -- work is ready for the human (e.g. PR green, awaiting merge)
  'blocked',           -- stuck; needs a human unblock
  'timed_out',         -- a deadline fired before resolution
  'decision_required', -- an explicit human decision gate is open
  'completed'          -- fully done
);

-- Turn lifecycle (see dedup-and-timeout-contract.md §"turn idempotency" and
-- §"watchdog"). `dispatched` + `lease_deadline_at` is what the 5-min dead-man
-- watchdog sweeps.
create type ftw.turn_state as enum (
  'pending',      -- created, not yet dispatched
  'dispatched',   -- handed to the responder; lease clock running
  'in_progress',  -- responder acknowledged / is working
  'returned',     -- responder returned a (signed) structured result
  'failed',       -- responder returned an error
  'timed_out'     -- lease deadline passed with no return (watchdog reaped)
);

-- Signer / responder vocabulary. HONEST LABELS ONLY: the GPT controller is
-- OpenAI/Codex and MUST NEVER be spoofed as xAI/Grok or anyone else. `tower` is
-- the orchestrator itself (it signs its own generated events but never takes a
-- turn). A SINGLE enum is used for agent_identity, event.bound_responder, turn
-- signer, and (constrained) turn.expected_responder — smaller reusable slice
-- than two near-identical enums that would have to be kept in sync.
create type ftw.principal as enum (
  'larry',      -- Claude Code (Anthropic) — the myPKA orchestrator responder
  'gpt_codex',  -- OpenAI Codex controller (NEVER labelled xAI/Grok)
  'warwick',    -- the single authorised human principal (decision gates)
  'tower'       -- Fusion Tower orchestrator (signs self-generated events)
);

-- External event origin (dedup + routing). Provider-neutral naming; `tower` is
-- the self-generated (self-loop) origin that must never double-advance a run.
create type ftw.event_source as enum (
  'telegram',  -- human ingress (Warwick), reuses the BUILD-002 channel
  'github',    -- PR / check_suite / issue_comment webhooks
  'clickup',   -- task status / field changes
  'tower'      -- self-generated by the orchestrator (self-loop; usually ignored)
);

-- --------------------------------------------------------------------------
-- agent_identity — signer registry. Created FIRST: run_turn.signer_principal and
-- run_event.bound_responder reference it. HONEST provider labels only. The
-- signing key is a POINTER (a key id / KMS handle / env-var NAME), never a
-- private-key value — enforced by convention + the SECURITY gate, documented on
-- the column. Reference/config data, not personal data.
-- --------------------------------------------------------------------------

create table ftw.agent_identity (
  principal       ftw.principal not null
    constraint agent_identity_pkey primary key,
  display_label   text not null,          -- human-readable honest label
  provider        text not null,          -- honest provider slug (see CHECK)
  can_sign        boolean not null default false,  -- produces signed turn results?
  -- KEY POINTER ONLY. A key id / KMS handle / env-var NAME. NEVER a secret value.
  signing_key_ref text,
  key_algo        text,                   -- e.g. 'ed25519' (informational)
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Anti-spoof guardrail: the GPT controller is OpenAI/Codex. The provider slug
  -- is constrained to the known-honest set so a future edit cannot quietly
  -- relabel gpt_codex as xAI/Grok (or anything else) without failing this CHECK.
  constraint agent_identity_provider_honest_chk
    check (provider in (
      'anthropic-claude-code',  -- larry
      'openai-codex',           -- gpt_codex  (NEVER 'xai-grok')
      'human',                  -- warwick
      'fusion-tower'            -- tower
    ))
);

comment on column ftw.agent_identity.signing_key_ref is
  'POINTER ONLY (key id / KMS handle / env-var NAME). NEVER a private-key value. '
  'DO NOT WEAKEN: storing a secret value here is a security-gate violation.';

-- --------------------------------------------------------------------------
-- governance_run — one row per governance RUN. Holds the scope lock, the status
-- machine, budgets/counters, the guardrail flags, and EVIDENCE POINTERS (never
-- content). `current_turn_id` is a forward pointer to run_turn; the FK is added
-- after run_turn exists (circular reference resolved at the foot of this file).
-- --------------------------------------------------------------------------

create table ftw.governance_run (
  run_id           uuid not null
    constraint governance_run_pkey primary key
    default gen_random_uuid(),
  schema_version   text not null default 'governance-run/v1',

  title            text not null,
  scope            text,                              -- short scope/title descriptor
  -- Scope-lock descriptor: the in-bounds surface (repos, path globs, task ids,
  -- allowed actions). Structured, pointers only — never governed content.
  scope_lock       jsonb not null default '{}'::jsonb,

  status           ftw.run_status not null default 'created',
  current_turn_id  uuid,                              -- FK added at foot of file

  -- Round budget (max_rounds enforcement, see dedup-and-timeout-contract.md).
  max_rounds       integer not null default 1
    constraint governance_run_max_rounds_positive_chk check (max_rounds >= 1),
  round_count      integer not null default 0
    constraint governance_run_round_count_nonneg_chk  check (round_count >= 0),
  constraint governance_run_round_within_max_chk      check (round_count <= max_rounds),

  -- Token budget (counters; NULL budget = unbounded-for-now).
  token_budget     bigint
    constraint governance_run_token_budget_nonneg_chk check (token_budget is null or token_budget >= 0),
  token_spent      bigint not null default 0
    constraint governance_run_token_spent_nonneg_chk  check (token_spent >= 0),

  -- Time budget. `time_budget_seconds` is the intent; `deadline_at` is the
  -- materialised wall-clock deadline the watchdog/budget sweep compares to now().
  time_budget_seconds integer
    constraint governance_run_time_budget_nonneg_chk  check (time_budget_seconds is null or time_budget_seconds >= 0),
  deadline_at      timestamptz,

  -- Terminal outcome Warwick sees. NULL until the run reaches a terminal status.
  terminal_outcome ftw.run_outcome,
  constraint governance_run_terminal_outcome_chk
    check (terminal_outcome is null
           or status in ('blocked', 'timed_out', 'completed', 'cancelled')),

  -- Guardrail-supporting columns.
  decision_required   boolean not null default false, -- a human decision gate is open
  -- NO AUTONOMOUS MERGE: the Tower NEVER merges on its own authority. A terminal
  -- `ready` outcome surfaces to Warwick; the merge is a human decision. Default
  -- true is the safe posture; flipping it false is an explicit, audited choice.
  no_autonomous_merge boolean not null default true,

  -- EVIDENCE POINTERS (never content). Mirrors BUILD-002's evidence-pointer
  -- doctrine: prove the run reached its governed artefacts without copying them.
  evidence_pr_ref     text,   -- GitHub PR pointer, e.g. 'owner/repo#123' or URL
  evidence_commit_sha text,   -- head commit sha pointer
  evidence_task_ref   text,   -- ClickUp task pointer (id / URL)
  evidence_refs       jsonb,  -- general pointer bag: [{kind, ref}, ...] pointers only

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column ftw.governance_run.no_autonomous_merge is
  'Guardrail: the Tower never merges on its own authority. A `ready` outcome is '
  'surfaced to Warwick; merge is a human decision. DO NOT default this false.';

-- --------------------------------------------------------------------------
-- run_turn — one bounded turn of one responder within a run. Idempotent per
-- (run_id, ordinal): re-dispatch of the same logical turn maps to the SAME row.
-- Carries the lease/deadline the 5-min dead-man watchdog sweeps, and the SIGNED
-- structured result (result + detached signature + signer identity).
-- --------------------------------------------------------------------------

create table ftw.run_turn (
  turn_id          uuid not null
    constraint run_turn_pkey primary key
    default gen_random_uuid(),
  run_id           uuid not null
    constraint run_turn_run_id_fkey
    references ftw.governance_run (run_id) on delete cascade,
  ordinal          integer not null
    constraint run_turn_ordinal_positive_chk check (ordinal >= 1),

  -- Who is expected to answer. `tower` orchestrates turns, it never TAKES one,
  -- so it is excluded here by CHECK (the single-enum + CHECK approach keeps the
  -- vocabulary DRY vs a second near-identical enum).
  expected_responder ftw.principal not null
    constraint run_turn_expected_responder_not_tower_chk
    check (expected_responder <> 'tower'),

  state            ftw.turn_state not null default 'pending',

  -- The bounded context handed to the responder this turn: what it may see / do
  -- (path globs, task ids, the specific PR). Pointers + scope, never content.
  bounded_context_ref jsonb,

  -- Dispatch + dead-man lease. When state='dispatched', both timestamps are set;
  -- lease_deadline_at = dispatched_at + watchdog window (5 min, see contract).
  dispatched_at    timestamptz,
  lease_deadline_at timestamptz,
  returned_at      timestamptz,
  constraint run_turn_dispatched_has_lease_chk
    check (state <> 'dispatched'
           or (dispatched_at is not null and lease_deadline_at is not null)),

  -- SIGNED structured result. `structured_result` is the returned envelope;
  -- `result_signature` is a DETACHED signature over it (a signature string /
  -- pointer, not a secret key); `signer_principal` names who signed.
  structured_result jsonb,
  result_signature  text,
  signer_principal  ftw.principal
    constraint run_turn_signer_fkey references ftw.agent_identity (principal),
  signed_at         timestamptz,

  attempt_count    integer not null default 0
    constraint run_turn_attempt_count_nonneg_chk check (attempt_count >= 0),
  last_error       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- TURN IDEMPOTENCY / DEDUP: one logical turn per (run, ordinal). A re-dispatch
  -- upserts on this key rather than creating a duplicate turn.
  constraint run_turn_run_ordinal_key unique (run_id, ordinal)
);

comment on constraint run_turn_run_ordinal_key on ftw.run_turn is
  'Turn idempotency: one logical turn = one (run_id, ordinal). Re-dispatch uses '
  'INSERT ... ON CONFLICT (run_id, ordinal) so redelivery never doubles a turn.';

-- Watchdog scan (see 0004 due-retry partial-index pattern). The 5-min dead-man
-- sweep is: SELECT ... WHERE state='dispatched' AND lease_deadline_at <= now().
-- A PARTIAL index keyed on lease_deadline_at confines it to live dispatched
-- turns and keeps the range scan index-driven.
create index run_turn_watchdog_idx
  on ftw.run_turn (lease_deadline_at)
  where state = 'dispatched';

-- --------------------------------------------------------------------------
-- run_event — one row per external (or self-generated) event that may advance a
-- run. `run_id` is NULLABLE until the event is bound to a run. DEDUP is the whole
-- point: (source, source_event_id) is globally unique, and for GitHub a
-- (source, head_sha, kind) partial-unique stops a redelivered/self-generated
-- check/PR event from double-advancing. `payload` carries sanitised pointers /
-- metadata — NO secrets, NO governed content.
-- --------------------------------------------------------------------------

create table ftw.run_event (
  event_id        uuid not null
    constraint run_event_pkey primary key
    default gen_random_uuid(),
  run_id          uuid
    constraint run_event_run_id_fkey
    references ftw.governance_run (run_id) on delete cascade,   -- NULLable until bound

  source          ftw.event_source not null,
  -- Provider-native event id — the primary dedup key (delivery id / hook id /
  -- webhook event id). Required: an event with no stable native id cannot be
  -- safely deduped and must be given a deterministic synthetic id upstream.
  source_event_id text not null,
  -- GitHub head commit sha for check/PR dedup (nullable; non-GH events omit it).
  head_sha        text,
  kind            text not null,   -- e.g. 'pull_request.opened', 'check_suite.completed',
                                   --      'issue_comment.created', 'task.status_changed'

  -- Sanitised payload: pointers + metadata only. NO secrets, NO governed content.
  payload         jsonb,

  bound_responder ftw.principal
    constraint run_event_bound_responder_fkey references ftw.agent_identity (principal),
  -- Self-loop marker: events the Tower itself generated. The advance loop ignores
  -- self-generated events so the Tower cannot advance a run off its own output.
  self_generated  boolean not null default false,

  processed       boolean not null default false,
  processed_at    timestamptz,
  received_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  -- PRIMARY DEDUP: a given provider event is ingested at most once.
  constraint run_event_source_eventid_key unique (source, source_event_id)
);

comment on column ftw.run_event.payload is
  'Sanitised pointers + metadata ONLY. DO NOT WEAKEN: no secrets, no tokens, and '
  'no governed knowledge content — evidence is pointers (BUILD-002 doctrine).';

-- SECONDARY DEDUP (GitHub redelivery / self-generated check storms): the same
-- head_sha + kind must not advance a run twice even if delivered under different
-- native ids. Partial: only rows that carry a head_sha participate.
create unique index run_event_source_headsha_kind_key
  on ftw.run_event (source, head_sha, kind)
  where head_sha is not null;

-- Unprocessed-advance scan: the loop pulls unbound-or-bound unprocessed events.
-- Partial index keeps it confined to the (small) unprocessed backlog.
create index run_event_unprocessed_idx
  on ftw.run_event (received_at)
  where processed = false;

-- --------------------------------------------------------------------------
-- Circular FK resolution: governance_run.current_turn_id -> run_turn.turn_id.
-- Added here because run_turn did not exist when governance_run was created.
-- ON DELETE SET NULL: if the pointed-at turn is removed the pointer clears; a run
-- delete cascades to its turns anyway.
-- --------------------------------------------------------------------------

alter table ftw.governance_run
  add constraint governance_run_current_turn_fkey
  foreign key (current_turn_id) references ftw.run_turn (turn_id)
  on delete set null;

-- --------------------------------------------------------------------------
-- Reference seed: the four honest signer identities. Non-secret config data.
-- signing_key_ref is left NULL (a POINTER is bound at live wiring, never here).
-- Idempotent: ON CONFLICT DO NOTHING so re-running the migration is a no-op.
-- HONEST LABELS: gpt_codex is OpenAI/Codex — NEVER xAI/Grok.
-- --------------------------------------------------------------------------

insert into ftw.agent_identity (principal, display_label, provider, can_sign) values
  ('larry',     'Larry (Claude Code, Anthropic)',   'anthropic-claude-code', true),
  ('gpt_codex', 'GPT Controller (OpenAI Codex)',     'openai-codex',          true),
  ('warwick',   'Warwick (human principal)',         'human',                 false),
  ('tower',     'Fusion Tower (orchestrator)',       'fusion-tower',          true)
on conflict (principal) do nothing;

-- =============================================================================
-- SECURITY GATE (Vex) — RLS. DO NOT WEAKEN.
-- Enable RLS on EVERY table, then grant + policy the server-side `service_role`
-- ONLY. `anon`/`authenticated` get NEITHER a grant NOR a policy, so both the
-- privilege check and RLS refuse them (deny-by-default stands from both gates).
-- This mirrors BUILD-002 0003 exactly, including the concurrency-safe role guard.
-- =============================================================================

alter table ftw.agent_identity  enable row level security;
alter table ftw.governance_run  enable row level security;
alter table ftw.run_turn        enable row level security;
alter table ftw.run_event       enable row level security;

-- Roles pre-exist on real Supabase; created-if-absent for an isolated dev/verify
-- substrate. Concurrency-safe guard (BUILD-002 0003 root-cause fix): roles live
-- in the CLUSTER-wide pg_authid, so two parallel appliers into different DBs can
-- race the check-then-create; the inner exception blocks turn "someone created it
-- first" into the intended no-op. Same NOLOGIN roles, nothing more.
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

-- Schema + table privileges: service_role ONLY. anon/authenticated get nothing.
grant usage on schema ftw to service_role;
grant select, insert, update, delete on all tables in schema ftw to service_role;
grant usage, select on all sequences in schema ftw to service_role;

-- One permissive FOR ALL policy per table, scoped TO service_role. Because no
-- policy names anon/authenticated and RLS is enabled, those roles stay denied.
create policy service_role_all_agent_identity
  on ftw.agent_identity
  for all to service_role
  using (true) with check (true);

create policy service_role_all_governance_run
  on ftw.governance_run
  for all to service_role
  using (true) with check (true);

create policy service_role_all_run_turn
  on ftw.run_turn
  for all to service_role
  using (true) with check (true);

create policy service_role_all_run_event
  on ftw.run_event
  for all to service_role
  using (true) with check (true);

-- (No anon/authenticated policies on purpose — deny-by-default until a future WP
--  introduces a gated direct-principal path and the security gate authors it.)
