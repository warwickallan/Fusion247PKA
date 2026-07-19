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
--   Row-Level Security is ENABLED deny-by-default on EVERY table. ONLY the
--   server-side `service_role` gets a grant + policy; `anon`/`authenticated` get
--   NEITHER. No column stores a secret value: every `*_ref`/pointer/payload holds a
--   POINTER or sanitised metadata, and a `classification` column marks any
--   sensitive/secret payload as NEVER eligible for public git provenance.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from BUILD-010 0001): a table implicitly
--   creates a composite type of the same name, so NO enum below shares a name with
--   any table. Tables: build, workflow_run, agent_run, job, agent_event, checkpoint,
--   verdict, merge_gate, command_request. Enums: data_classification, principal,
--   job_status, verdict_type, verdict_value, verdict_state, fusion_policy_decision,
--   github_mech_state, command_status. No overlap by construction.
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
do $$ begin
  create type ops.verdict_type as enum (
    'correction_loop', -- the Codex correction-loop reviewer
    'cold_final'       -- the Fable cold-final adversarial reviewer
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
-- verdict is retained for audit but excluded from the active-uniqueness index.
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

-- Boundary canonicaliser. Lower-cases and validates a full 40-char SHA; RAISES on a
-- short/abbreviated head (the Tower `/[0-9a-f]{7,40}/` acceptance is refused here).
-- Use this to normalise an inbound head BEFORE it is stored in a git_sha column.
create or replace function ops.canonicalize_sha(raw text)
returns ops.git_sha
language plpgsql
immutable
as $$
declare v text := lower(trim(coalesce(raw, '')));
begin
  if v !~ '^[0-9a-f]{40}$' then
    raise exception 'non-canonical git SHA %: a full 40-char lower-case hex SHA is required (short/abbreviated heads are refused — this is the Tower head-binding bug class)', raw
      using errcode = 'check_violation';
  end if;
  return v::ops.git_sha;
end;
$$;

-- --------------------------------------------------------------------------
-- IDENTITY (minimum needed to hang the seven proofs on).
-- --------------------------------------------------------------------------

-- [phase0] build — one row per governed build (e.g. 'BUILD-014').
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

-- [projection-only] workflow_run — a CACHED projection of a GitHub Actions / CI run.
-- GitHub remains authoritative; this exists only so a run can be pointed at from the
-- control plane. Head is a canonical SHA by domain.
create table if not exists ops.workflow_run (
  id             uuid not null
    constraint workflow_run_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint workflow_run_build_fkey references ops.build (id) on delete cascade,
  github_run_id  text,                                           -- [projection-only] GH run id pointer
  head_sha       ops.git_sha,                                    -- [projection-only] canonical head
  status         text,                                           -- [projection-only] cached GH status
  observed_at    timestamptz,                                    -- [projection-only] when GH was read
  created_at     timestamptz not null default now()              -- [phase0]
);

-- [phase0] agent_run — a minimal record of one agent's working span on a build.
create table if not exists ops.agent_run (
  id             uuid not null
    constraint agent_run_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint agent_run_build_fkey references ops.build (id) on delete cascade,
  principal      ops.principal not null,                         -- [phase0] who ran
  role           text,                                           -- [later] free-text role hint
  status         text,                                           -- [phase0]
  started_at     timestamptz not null default now(),             -- [phase0]
  ended_at       timestamptz                                     -- [phase0]
);

-- --------------------------------------------------------------------------
-- PROOF 1 — durable job/lease (pgmq-compatible). Leaseable, idempotency-keyed,
-- attempt-bounded, with a dead-letter terminal state.
-- --------------------------------------------------------------------------
create table if not exists ops.job (
  id             bigint generated always as identity            -- [phase0] pgmq: msg_id bigint
    constraint job_pkey primary key,
  queue          text not null,                                  -- [phase0] logical queue name
  -- [phase0] IDEMPOTENCY KEY: the same logical unit of work enqueued twice collides
  -- here and is read back rather than duplicated.
  idempotency_key text not null
    constraint job_idempotency_key_key unique,
  payload        jsonb not null default '{}'::jsonb,             -- [phase0] pointers/metadata ONLY
  payload_hash   text,                                           -- [phase0] fingerprint of payload
  classification ops.data_classification not null default 'internal', -- [phase0]
  status         ops.job_status not null default 'pending',      -- [phase0]

  -- [phase0] LEASE (pgmq visibility-timeout analogue). When leased, BOTH the owner
  -- and the deadline are set; the watchdog reclaims a lease past its deadline.
  lease_owner    text,                                           -- [phase0]
  lease_deadline_at timestamptz,                                 -- [phase0]
  constraint job_leased_requires_lease_chk
    check (status <> 'leased'
           or (lease_owner is not null and lease_deadline_at is not null)),

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

-- --------------------------------------------------------------------------
-- PROOF 2 — append-only event path. INSERT-only + immutable: a trigger REJECTS any
-- UPDATE or DELETE of an existing event. Corrections are NEW events, never edits.
-- Every event carries a delivery/idempotency key; material payloads carry a hash.
-- Sensitive/secret payloads are flagged so they are never destined for public git.
-- --------------------------------------------------------------------------
create table if not exists ops.agent_event (
  id             uuid not null
    constraint agent_event_pkey primary key default gen_random_uuid(),
  build_id       uuid                                            -- [phase0] nullable until bound
    constraint agent_event_build_fkey references ops.build (id) on delete set null,
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
-- correction is a NEW event, never a mutation of an existing one.
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

-- --------------------------------------------------------------------------
-- PROOF 3 — exact-SHA checkpoint -> verdict. THE core invariant.
--
-- A checkpoint is one (logical checkpoint ref, exact head) pair; a Tower
-- checkpoint_ref reused at a new head is a NEW checkpoint row. head_sha is a
-- canonical SHA by domain. The UNIQUE (id, head_sha) is what lets a verdict
-- COMPOSITE-FK onto the checkpoint's EXACT head — so a verdict whose SHA is not the
-- checkpoint's recorded head is a FOREIGN KEY VIOLATION, not a runtime bug.
-- --------------------------------------------------------------------------
create table if not exists ops.checkpoint (
  id             uuid not null
    constraint checkpoint_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint checkpoint_build_fkey references ops.build (id) on delete cascade,
  checkpoint_ref text not null,                                  -- [phase0] Tower checkpoint_id (reusable)
  head_sha       ops.git_sha not null,                           -- [phase0] canonical exact head
  branch         text,                                           -- [phase0] pointer
  brief_ref      text,                                           -- [phase0] pointer
  created_at     timestamptz not null default now(),             -- [phase0]
  -- One row per (logical checkpoint, head). Reuse at a new head = a new row.
  constraint checkpoint_ref_head_key unique (checkpoint_ref, head_sha),
  -- The composite-FK target: lets verdict bind to this checkpoint's EXACT head.
  constraint checkpoint_id_head_uk unique (id, head_sha)
);

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
  -- [phase0] Generation token. Superseding bumps this so a fresh active verdict for
  -- the same (reviewer, sha, type) is allowed AFTER the prior one is retired.
  active_generation integer not null default 1
    constraint verdict_active_generation_positive_chk check (active_generation >= 1),
  prompt_fingerprint text,                                       -- [phase0] QA-skill fingerprint
  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]

  -- EXACT-SHA BINDING: the verdict can ONLY reference a head that this checkpoint
  -- actually recorded. A verdict for the "wrong head" cannot be inserted at all.
  constraint verdict_checkpoint_head_fkey
    foreign key (checkpoint_id, reviewed_commit_sha)
    references ops.checkpoint (id, head_sha) on delete cascade
);

-- HARD INVARIANT: at most ONE active verdict per (reviewer, reviewed head, type,
-- generation). Partial over state='active'; to record a new active verdict you must
-- first supersede the prior (state='superseded') or bump active_generation.
create unique index if not exists verdict_active_unique
  on ops.verdict (reviewer, reviewed_commit_sha, verdict_type, active_generation)
  where state = 'active';

comment on constraint verdict_checkpoint_head_fkey on ops.verdict is
  'EXACT-SHA BINDING: (checkpoint_id, reviewed_commit_sha) FKs onto ops.checkpoint '
  '(id, head_sha). A verdict can only exist bound to the checkpoint''s recorded head, '
  'so "merge-ready for the wrong head" is a FK violation, not a runtime bug. Combined '
  'with the ops.git_sha domain (canonical SHAs only) this is the DB-level kill of the '
  'Tower head-binding bug class. DO NOT WEAKEN to a single-column FK.';

comment on index ops.verdict_active_unique is
  'HARD INVARIANT: no duplicate ACTIVE verdict for the same (reviewer, reviewed head, '
  'verdict_type, active_generation). Superseding (state=superseded) or bumping '
  'active_generation is the only way to record a new active verdict. DO NOT WEAKEN.';

-- --------------------------------------------------------------------------
-- PROOF 4/5 — Fusion policy-gate decision (merge_gate) WITH dual-gate separation.
--
-- Fusion POLICY state (fusion_policy_decision, expected_head_sha) is kept STRICTLY
-- distinct from CACHED GitHub MECHANICAL state (github_*_cached, *_observed_at). It
-- is impossible to represent one undifferentiated "Approved": the cockpit reads the
-- two source fields plus the derived overall_action_state. A moved head invalidates
-- the prior decision two ways: (a) an explicit supersede (superseded_at), and (b)
-- the derived state flips to 'head_moved' the instant GitHub's cached head diverges
-- from expected_head_sha.
-- --------------------------------------------------------------------------
create table if not exists ops.merge_gate (
  id             uuid not null
    constraint merge_gate_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint merge_gate_build_fkey references ops.build (id) on delete cascade,
  checkpoint_id  uuid                                            -- [phase0] optional link to the head's checkpoint
    constraint merge_gate_checkpoint_fkey references ops.checkpoint (id) on delete set null,

  -- ---- FUSION POLICY side (authoritative for POLICY) ----
  fusion_policy_decision ops.fusion_policy_decision not null default 'pending', -- [phase0]
  -- HARD INVARIANT: expected_head_sha NOT NULL, canonical by domain. The head the
  -- Fusion policy decision is bound to.
  expected_head_sha ops.git_sha not null,                        -- [phase0]
  policy_reason  text,                                           -- [phase0]

  -- ---- CACHED GITHUB MECHANICAL side (PROJECTION; GitHub authoritative) ----
  github_mech_state_cached ops.github_mech_state not null default 'unknown', -- [projection-only]
  github_head_sha_cached   ops.git_sha,                          -- [projection-only] canonical
  github_review_decision_cached text,                            -- [projection-only] APPROVED/CHANGES_REQUESTED/...
  github_observed_at       timestamptz,                          -- [projection-only] when GH was read

  -- ---- DERIVED (generated, immutable) ----
  -- [phase0] Do the two sides even refer to the same head? (cockpit convenience)
  heads_agree    boolean
    generated always as (
      github_head_sha_cached is not null and github_head_sha_cached = expected_head_sha
    ) stored,
  -- [phase0] The single overall action state. References ONLY base columns (a
  -- generated column may not reference another generated column), so heads-agreement
  -- is inlined here.
  overall_action_state text
    generated always as (
      case
        when superseded_at is not null then 'superseded'
        when fusion_policy_decision <> 'approved' then 'fusion_not_approved'
        when github_head_sha_cached is null
          or github_head_sha_cached <> expected_head_sha then 'head_moved'
        when github_mech_state_cached <> 'clean' then 'github_blocked'
        else 'mergeable'
      end
    ) stored,

  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now()              -- [phase0]
);

-- A moved head must invalidate the prior decision: at most ONE non-superseded gate
-- per build. To record a decision for a new head, supersede the prior first.
create unique index if not exists merge_gate_one_live_per_build
  on ops.merge_gate (build_id)
  where superseded_at is null;

comment on column ops.merge_gate.overall_action_state is
  'DUAL-GATE SEPARATION (do not collapse): derived from BOTH the Fusion policy side '
  '(fusion_policy_decision, expected_head_sha) AND the cached GitHub mechanical side '
  '(github_mech_state_cached, github_head_sha_cached). It is impossible to represent one '
  'undifferentiated "Approved": the cockpit shows "Fusion policy: approved for <sha> / '
  'GitHub mechanical: <state> / Overall: <this>". A moved head flips this to head_moved.';

-- --------------------------------------------------------------------------
-- PROOF 6 — command request/result. Idempotency-keyed; args/result carry hashes;
-- classification governs provenance.
-- --------------------------------------------------------------------------
create table if not exists ops.command_request (
  id             uuid not null
    constraint command_request_pkey primary key default gen_random_uuid(),
  build_id       uuid                                            -- [phase0] nullable
    constraint command_request_build_fkey references ops.build (id) on delete set null,
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
-- [projection-only] VIEW — head-bound two-reviewer merge readiness. This MOVES
-- Tower's computeMergeReady() invariant into the DB as data: because verdict is
-- composite-FK-bound to the checkpoint's EXACT head, any verdict joined here is
-- guaranteed to have reviewed THIS head. Readiness = one ACTIVE genuine `approve`
-- of EACH type at the same head. (`comment` is excluded — never merge-ready.)
-- --------------------------------------------------------------------------
create or replace view ops.checkpoint_merge_readiness as
select
  c.id                     as checkpoint_id,
  c.build_id,
  c.checkpoint_ref,
  c.head_sha,
  bool_or(v.verdict_type = 'correction_loop'
          and v.verdict = 'approve' and v.state = 'active') as correction_loop_approved,
  bool_or(v.verdict_type = 'cold_final'
          and v.verdict = 'approve' and v.state = 'active')  as cold_final_approved,
  bool_or(v.verdict_type = 'correction_loop'
          and v.verdict = 'approve' and v.state = 'active')
    and bool_or(v.verdict_type = 'cold_final'
          and v.verdict = 'approve' and v.state = 'active')  as both_reviewers_approved_this_head
from ops.checkpoint c
left join ops.verdict v
  on v.checkpoint_id = c.id and v.reviewed_commit_sha = c.head_sha
group by c.id, c.build_id, c.checkpoint_ref, c.head_sha;

-- =============================================================================
-- SECURITY GATE — RLS deny-by-default. DO NOT WEAKEN.
-- Enable RLS on EVERY table; grant + policy the server-side `service_role` ONLY.
-- agent_event gets INSERT + SELECT only (append-only at the privilege layer too).
-- anon/authenticated get NEITHER a grant NOR a policy.
-- =============================================================================

alter table ops.build            enable row level security;
alter table ops.workflow_run     enable row level security;
alter table ops.agent_run        enable row level security;
alter table ops.job              enable row level security;
alter table ops.agent_event      enable row level security;
alter table ops.checkpoint       enable row level security;
alter table ops.verdict          enable row level security;
alter table ops.merge_gate       enable row level security;
alter table ops.command_request  enable row level security;

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
-- Full DML for service_role on the mutable tables...
grant select, insert, update, delete on
  ops.build, ops.workflow_run, ops.agent_run, ops.job,
  ops.checkpoint, ops.verdict, ops.merge_gate, ops.command_request
  to service_role;
-- ...but agent_event is APPEND-ONLY at the privilege layer: INSERT + SELECT only.
-- (The trigger is defence-in-depth behind this grant.)
grant select, insert on ops.agent_event to service_role;
grant usage, select on all sequences in schema ops to service_role;

-- One permissive FOR ALL policy per table, scoped TO service_role. Because no policy
-- names anon/authenticated and RLS is enabled, those roles stay denied. Idempotent
-- via drop-if-exists.
do $$
declare t text;
begin
  foreach t in array array[
    'build','workflow_run','agent_run','job','agent_event',
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
