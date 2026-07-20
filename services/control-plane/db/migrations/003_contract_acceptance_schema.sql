-- =============================================================================
-- BUILD-014 PR-1 — Contract & Acceptance schema (Postgres DDL)
-- Migration: 003_contract_acceptance_schema                       (author: silas)
--
-- WHY THIS EXISTS
--   001 gave us the head-bound checkpoint/verdict/merge-gate core. 002 gave us the
--   authoritative current head per build. This migration adds the CONTRACT layer the
--   Tower review flow verifies against: the immutable, versioned PRD/Plan; the WP
--   assurance baseline; the immutable acceptance requirement; the append-only builder
--   EVIDENCE claim and the append-only, REVIEWER-ONLY acceptance VERIFICATION; the
--   normalised finding + its many-to-many link to acceptance rows; the cached-GitHub
--   PR head; and two DERIVED views that make "is this requirement still verified?" a
--   question the database answers structurally — a moved head OR a superseded contract
--   automatically invalidates a prior verification.
--
--   The load-bearing invariant of this slice: the BUILDER (larry) is STRUCTURALLY unable
--   to write an acceptance_verification. Verification is reviewer-principal only. This is
--   enforced here at the constraint/trigger layer (a non-bypassable CHECK plus a
--   defence-in-depth trigger), INDEPENDENT of the DB-GRANT role separation that PR-4
--   applies and tests. Self-verification by the builder is not merely disallowed by
--   policy — it cannot be represented.
--
-- SCOPE (this PR is the contract + acceptance + findings layer ONLY):
--   ADDED:   prd, plan, wp, acceptance_row, acceptance_evidence, acceptance_verification,
--            finding, acceptance_finding, pr; the contract_stale + current_acceptance_state
--            views. NOT added here (PR-2 owns them): review_packet, review_run,
--            checkpoint_assurance, and any change to the ops.principal enum (e.g. a future
--            'grok' reviewer). The reviewer-principal check below is written so PR-2 can
--            widen the reviewer set in ONE place without a schema rewrite.
--
-- DEPENDS ON (applied in order): 001_control_plane_min_schema.sql (build, checkpoint,
--   ops.git_sha domain, ops.canonicalize_sha, ops.reject_truncate, ops.touch_updated_at,
--   ops.data_classification, ops.principal) and 002_current_head_authority.sql
--   (ops.build_head — the authoritative current head the current_acceptance_state view
--   reads). This file is ADDITIVE and does NOT modify 001 or 002.
--
-- INFORMED BY (read, not copied): the same house style as 001/002 —
--   · exact-SHA binding by COMPOSITE FK onto checkpoint (id, head_sha) so evidence and
--     verification can only be bound to a head the checkpoint actually recorded;
--   · supersede-then-insert version discipline (the partial-unique-active index is the
--     ONLY path to a new active contract version — mirrors verdict_active_unique);
--   · evidence/immutability via triggers AND typed constraints, with BEFORE TRUNCATE
--     guards because TRUNCATE bypasses row triggers;
--   · every plpgsql/sql function pins `set search_path = ops, pg_catalog`.
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD/hosted/live DB. !!
--   Target schema `ops` (control-plane DEV namespace). Never touches the `asdair` schema
--   or any personal/entrusted data. A live apply is Larry-gated to an ISOLATED dev
--   database. Fully idempotent / re-runnable (enums guarded by DO-blocks, `if not exists`
--   throughout, `create or replace` for functions/views, drop-if-exists for triggers/
--   policies) so it can be applied repeatedly against a throwaway dev substrate.
--
-- !! SECURITY GATE — DO NOT WEAKEN !!
--   RLS is ENABLED **and FORCED** deny-by-default on EVERY new table. ONLY the server-side
--   `service_role` gets a grant + policy; `anon`/`authenticated` get NEITHER. No column
--   stores a secret value: every `*_ref`/pointer/payload holds a POINTER or sanitised
--   metadata, and `classification` marks sensitive/secret payloads as never eligible for
--   public git provenance. THREAT-MODEL RESIDUALS (documented in 001 README §Threat model)
--   still apply: a SUPERUSER/BYPASSRLS role sidesteps RLS, and the OWNER can DISABLE
--   TRIGGER / set session_replication_role=replica to bypass row triggers. The
--   reviewer-principal CHECK constraint below is deliberately a CHECK (not only a trigger)
--   precisely because a CHECK is NOT bypassed by session_replication_role — the
--   builder-cannot-verify guarantee survives a trigger-disable.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 001): a table implicitly creates a
--   composite type of the same name, so NO enum below shares a name with any table.
--   New tables: prd, plan, wp, acceptance_row, acceptance_evidence, acceptance_verification,
--   finding, acceptance_finding, pr. New enums: version_state, risk_tier, evidence_type,
--   acceptance_result, finding_severity, finding_reachability, finding_disposition,
--   finding_state. No overlap by construction (and none collide with 001's enums).
--
-- FIELD CLASSIFICATION: every column is tagged inline
--   [phase0] | [projection-only] | [later]
-- =============================================================================

-- Depends on 001 having created the schema; harmless if already present.
create schema if not exists ops;

-- --------------------------------------------------------------------------
-- Enumerated types (closed vocabularies). DO-block wrapped for idempotency.
-- --------------------------------------------------------------------------

-- [phase0] Lifecycle of an immutable CONTRACT version (prd, plan). A version is born
-- 'active' and may transition ONCE to 'superseded'; a superseded version is retained
-- for audit and is excluded from the partial-unique-active index.
do $$ begin
  create type ops.version_state as enum ('active', 'superseded');
exception when duplicate_object then null; end $$;

-- [phase0] WP assurance BASELINE risk tier. The WP is the baseline; the checkpoint
-- computes the FINAL required-assurance profile in PR-2 (checkpoint_assurance).
do $$ begin
  create type ops.risk_tier as enum ('low', 'standard', 'elevated', 'high');
exception when duplicate_object then null; end $$;

-- [phase0] Kind of a builder EVIDENCE claim. Pointers/metadata only — never content.
do $$ begin
  create type ops.evidence_type as enum (
    'test',        -- an executed test / test result pointer
    'ci_run',      -- a CI/Actions run pointer
    'artifact',    -- a produced artifact pointer
    'log',         -- a log excerpt pointer
    'screenshot',  -- a UI/screenshot pointer
    'manual',      -- a manually-attested observation
    'doc'          -- a document/section pointer
  );
exception when duplicate_object then null; end $$;

-- [phase0] The reviewer's VERIFICATION result for one acceptance requirement.
do $$ begin
  create type ops.acceptance_result as enum (
    'pass',            -- requirement met at this head under these contract versions
    'fail',            -- requirement not met
    'partial',         -- partially met
    'blocked',         -- could not be evaluated (fail-closed)
    'not_applicable'   -- requirement does not apply to this diff/scope
  );
exception when duplicate_object then null; end $$;

-- [phase0] Finding severity (ordered low->high by intent; enum order is documentary).
do $$ begin
  create type ops.finding_severity as enum ('info', 'low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

-- [phase0] Finding reachability under FIRST-PARTY use (the hobby-brain threat bar).
do $$ begin
  create type ops.finding_reachability as enum (
    'unknown',      -- not yet assessed
    'unreachable',  -- not reachable in the first-party runtime
    'conditional',  -- reachable only under specific conditions
    'reachable'     -- reachable in normal first-party use
  );
exception when duplicate_object then null; end $$;

-- [phase0] Finding disposition — the authority's resolution judgement. 'unresolved'
-- is the only disposition compatible with an OPEN finding (see finding CHECK below).
do $$ begin
  create type ops.finding_disposition as enum (
    'unresolved',      -- open, no resolution yet
    'fixed',           -- resolved by a code change
    'deferred',        -- deferred to a later WP/gate
    'wont_fix',        -- deliberately not fixing
    'false_positive',  -- not a real defect
    'accepted_risk'    -- accepted as a documented residual
  );
exception when duplicate_object then null; end $$;

-- [phase0] Finding current lifecycle state. Kept distinct from disposition: state is
-- the open/closed lifecycle; disposition is HOW it was resolved.
do $$ begin
  create type ops.finding_state as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- SHARED GUARD FUNCTIONS (added by this migration; every one pins search_path).
-- --------------------------------------------------------------------------

-- Generic APPEND-ONLY / IMMUTABLE guard: rejects any UPDATE or DELETE. Used for the
-- immutable requirement (acceptance_row) and the append-only claim tables
-- (acceptance_evidence, acceptance_verification). Corrections are NEW rows, never edits.
-- restrict_violation = SQLSTATE 23001 (matches 001's reject_event_mutation).
create or replace function ops.reject_row_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  raise exception 'ops.% is append-only/immutable: % is rejected. Corrections are NEW rows, never edits.', tg_table_name, tg_op
    using errcode = 'restrict_violation';
  return null;
end;
$$;

-- Generic IMMUTABLE-VERSION guard (prd, plan): DEFAULT-DENY. DELETE is rejected; every
-- base column is frozen EXCEPT the supersede allow-list (state, superseded_at), and the
-- ONLY permitted transition is active->superseded (superseded_at is FORCED to now(), so a
-- caller cannot forge the audit timestamp). Mirrors ops.verdict_guard_mutation +
-- ops.merge_gate_guard_mutation (default-deny) so both prd and plan share one guarantee.
-- Generic-safe: both tables carry `state` (ops.version_state) and `superseded_at`.
create or replace function ops.immutable_version_guard()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  allow_supersede constant text[] := array['state', 'superseded_at'];
  generated_cols text[];
  old_j jsonb;
  new_j jsonb;
  col text;
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.% is an immutable contract version: DELETE is rejected (supersede, never delete — a superseded version is retained for audit)', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  -- Skip generated columns (none today), read from catalog so a FUTURE generated column
  -- is auto-skipped too — NEW carries no user value for them in a BEFORE trigger.
  select coalesce(array_agg(attname), array[]::text[]) into generated_cols
    from pg_attribute
   where attrelid = tg_relid and attgenerated <> '' and not attisdropped;
  old_j := to_jsonb(old);
  new_j := to_jsonb(new);
  for col in select jsonb_object_keys(new_j) loop
    if col = any(generated_cols) then
      continue;
    end if;
    if (new_j -> col) is distinct from (old_j -> col) then
      if col = any(allow_supersede) then
        continue;
      end if;
      raise exception 'ops.%: column "%" is immutable — a contract version may only transition active->superseded; a changed contract is a NEW version', tg_table_name, col
        using errcode = 'restrict_violation';
    end if;
  end loop;
  if not (old.state = 'active' and new.state = 'superseded') then
    raise exception 'ops.%: the only permitted UPDATE is the active->superseded transition (got % -> %)', tg_table_name, old.state, new.state
      using errcode = 'restrict_violation';
  end if;
  -- Non-forgeable supersession timestamp (matches verdict G9).
  new.superseded_at := now();
  return new;
end;
$$;

-- Generic BORN-ACTIVE guard (prd, plan): a version may not be INSERTed already superseded —
-- it must pass through 'active' first, so the active->superseded audit chain is unforgeable
-- (mirrors ops.verdict_reject_insert_superseded).
create or replace function ops.reject_insert_superseded_version()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if new.state = 'superseded' then
    raise exception 'ops.% cannot be INSERTed with state=superseded — a version must be born active (supersede an existing active version instead)', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Generic IDENTITY-FREEZE guard (wp, pr): the operational-record identity
-- (id, build_id, created_at) is immutable; DELETE is rejected (these are contract records
-- retained for audit — no DELETE grant either). Everything else is mutable
-- (WP baseline fields; PR cached-GitHub projection). Generic-safe: all three columns
-- exist on both wp and pr.
create or replace function ops.identity_immutable_guard()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.% is a contract record: DELETE is rejected (retained for audit)', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  if new.id <> old.id or new.build_id <> old.build_id or new.created_at <> old.created_at then
    raise exception 'ops.%: identity (id/build_id/created_at) is immutable', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- REVIEWER-PRINCIPAL assertion for acceptance_verification (defence-in-depth behind the
-- non-bypassable CHECK constraint). This is the STRUCTURAL kill of builder self-verification:
-- only a reviewer principal may author a verification row; larry (builder) and warwick are
-- rejected. The reviewer set is defined HERE in one place so PR-2 can widen it (e.g. add a
-- future 'grok') without a table rewrite. NB: this deliberately differs from 001's stricter
-- verdict rule (gpt_codex/fable only) — Tower is the trusted runtime that WRITES verifications
-- on behalf of validated reviewer results (v3 correction #1), so 'tower' is an allowed
-- verification principal here while it is NOT an allowed verdict reviewer in 001.
create or replace function ops.assert_acceptance_reviewer()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if new.reviewer not in ('gpt_codex', 'fable', 'tower') then
    raise exception 'ops.acceptance_verification.reviewer must be a REVIEWER principal (gpt_codex/fable/tower) — the builder (larry) and warwick cannot self-verify acceptance (got %)', new.reviewer
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- Finding evidence/authority guard: identity + authority fields are immutable
-- (id, build_id, finding_ref, opened_by, created_at, opened_at_sha); DELETE is rejected
-- (a finding is closed via disposition/state, never deleted). The authority's judgement
-- fields (severity/impact/reachability/disposition/state/title/detail/classification) stay
-- mutable so re-triage is possible.
create or replace function ops.finding_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.finding is an authority record: DELETE is rejected (close via disposition/state, never delete)'
      using errcode = 'restrict_violation';
  end if;
  if new.id <> old.id
     or new.build_id <> old.build_id
     or new.finding_ref <> old.finding_ref
     or new.opened_by <> old.opened_by
     or new.created_at <> old.created_at
     or new.opened_at_sha is distinct from old.opened_at_sha then
    raise exception 'ops.finding: identity/authority (id/build_id/finding_ref/opened_by/created_at/opened_at_sha) is immutable; only the triage/disposition fields may change'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- ==========================================================================
-- PRD — immutable, VERSIONED. Each row is ONE version. A version chain is expressed by
-- (prd_key, version) + the supersedes_id self-pointer; at most ONE active version per
-- (build_id, prd_key) via the partial-unique-active index, so supersede-then-insert in one
-- transaction is the ONLY path to a new active version (mirrors verdict_active_unique). A
-- superseded version is RETAINED for audit. content_ref/content_hash are a pointer + integrity
-- fingerprint — the governed PRD text is not stored as a value here.
-- ==========================================================================
create table if not exists ops.prd (
  id             uuid not null
    constraint prd_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint prd_build_fkey references ops.build (id) on delete no action,
  prd_key        text not null,                                  -- [phase0] stable logical id across versions
  version        integer not null default 1                      -- [phase0]
    constraint prd_version_positive_chk check (version >= 1),
  supersedes_id  uuid,                                           -- [phase0] prior version (NULL for v1)
  title          text,                                           -- [phase0]
  content_ref    text,                                           -- [phase0] pointer to the governed PRD
  content_hash   text,                                           -- [phase0] integrity fingerprint
  authored_by    ops.principal,                                  -- [phase0] who authored this version
  classification ops.data_classification not null default 'internal', -- [phase0]
  state          ops.version_state not null default 'active',    -- [phase0]
  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  -- state is 'superseded' IFF superseded_at is set (mirrors verdict_superseded_consistency_chk).
  constraint prd_superseded_consistency_chk check (
    (state = 'superseded') = (superseded_at is not null)
  ),
  constraint prd_build_key_version_key unique (build_id, prd_key, version),
  -- Composite-FK target so a verification can bind (acceptance_row_id, prd_version_id) and so
  -- the supersedes chain can be build-scoped.
  constraint prd_id_build_uk unique (id, build_id),
  -- The supersedes pointer must reference a PRD version of the SAME build (build-scoped chain).
  constraint prd_supersedes_fkey
    foreign key (supersedes_id, build_id) references ops.prd (id, build_id) on delete no action
);

-- HARD INVARIANT: at most ONE active version per (build_id, prd_key). To record a new active
-- version you MUST first supersede the prior in the SAME transaction (else 23505).
create unique index if not exists prd_one_active_per_key
  on ops.prd (build_id, prd_key) where state = 'active';

comment on index ops.prd_one_active_per_key is
  'At most one ACTIVE PRD version per (build_id, prd_key). Supersede-then-insert in one txn is '
  'the ONLY path to a new active version; a superseded version is retained for audit. DO NOT WEAKEN.';

drop trigger if exists prd_immutable_guard on ops.prd;
create trigger prd_immutable_guard
  before update or delete on ops.prd
  for each row execute function ops.immutable_version_guard();
drop trigger if exists prd_reject_insert_superseded on ops.prd;
create trigger prd_reject_insert_superseded
  before insert on ops.prd
  for each row execute function ops.reject_insert_superseded_version();
drop trigger if exists prd_no_truncate on ops.prd;
create trigger prd_no_truncate
  before truncate on ops.prd
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- PLAN — immutable, VERSIONED. Same discipline as prd. The plan is MyPKA-AUTHORITATIVE
-- (mypka_authoritative flags the human/MyPKA narrative as canonical) PLUS machine-readable
-- elements (machine_elements holds pointers/sanitised structured elements, never content).
-- ==========================================================================
create table if not exists ops.plan (
  id             uuid not null
    constraint plan_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint plan_build_fkey references ops.build (id) on delete no action,
  plan_key       text not null,                                  -- [phase0] stable logical id across versions
  version        integer not null default 1                      -- [phase0]
    constraint plan_version_positive_chk check (version >= 1),
  supersedes_id  uuid,                                           -- [phase0] prior version (NULL for v1)
  title          text,                                           -- [phase0]
  content_ref    text,                                           -- [phase0] pointer to the governed Plan
  content_hash   text,                                           -- [phase0] integrity fingerprint
  mypka_authoritative boolean not null default true,             -- [phase0] MyPKA narrative is canonical
  machine_elements jsonb not null default '{}'::jsonb,           -- [phase0] pointers/sanitised structured
  authored_by    ops.principal,                                  -- [phase0]
  classification ops.data_classification not null default 'internal', -- [phase0]
  state          ops.version_state not null default 'active',    -- [phase0]
  superseded_at  timestamptz,                                    -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  constraint plan_superseded_consistency_chk check (
    (state = 'superseded') = (superseded_at is not null)
  ),
  constraint plan_build_key_version_key unique (build_id, plan_key, version),
  constraint plan_id_build_uk unique (id, build_id),
  constraint plan_supersedes_fkey
    foreign key (supersedes_id, build_id) references ops.plan (id, build_id) on delete no action
);

create unique index if not exists plan_one_active_per_key
  on ops.plan (build_id, plan_key) where state = 'active';

drop trigger if exists plan_immutable_guard on ops.plan;
create trigger plan_immutable_guard
  before update or delete on ops.plan
  for each row execute function ops.immutable_version_guard();
drop trigger if exists plan_reject_insert_superseded on ops.plan;
create trigger plan_reject_insert_superseded
  before insert on ops.plan
  for each row execute function ops.reject_insert_superseded_version();
drop trigger if exists plan_no_truncate on ops.plan;
create trigger plan_no_truncate
  before truncate on ops.plan
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- WP — the assurance BASELINE. The WP is where the risk/assurance baseline is recorded;
-- the checkpoint computes the FINAL required-assurance profile in PR-2 (checkpoint_assurance
-- is NOT added here). Identity (id/build_id/created_at) is frozen; the baseline fields stay
-- mutable so a WP may be re-baselined.
-- ==========================================================================
create table if not exists ops.wp (
  id             uuid not null
    constraint wp_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint wp_build_fkey references ops.build (id) on delete no action,
  plan_version_id uuid                                           -- [phase0] the plan version defining this WP
    constraint wp_plan_fkey references ops.plan (id) on delete no action,
  wp_ref         text not null,                                  -- [phase0] e.g. 'WP-1'
  title          text,                                           -- [phase0]
  -- BASELINE assurance profile (the checkpoint refines this in PR-2).
  baseline_risk_tier ops.risk_tier not null default 'standard',              -- [phase0]
  baseline_codex_required boolean not null default true,                     -- [phase0]
  baseline_adversarial_required boolean not null default false,              -- [phase0]
  baseline_security_review_required boolean not null default false,          -- [phase0]
  baseline_warwick_approval_required boolean not null default false,         -- [phase0]
  classification ops.data_classification not null default 'internal',        -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]
  constraint wp_build_ref_key unique (build_id, wp_ref)
);

drop trigger if exists wp_identity_guard on ops.wp;
create trigger wp_identity_guard
  before update or delete on ops.wp
  for each row execute function ops.identity_immutable_guard();
drop trigger if exists wp_touch_updated_at on ops.wp;
create trigger wp_touch_updated_at before update on ops.wp
  for each row execute function ops.touch_updated_at();

-- ==========================================================================
-- PR — the pull request. current_head_sha is a CACHED GitHub value (GitHub is authoritative
-- for it); the CHECKPOINT (001) stores the exact frozen review target. This row is a
-- projection you refresh, never the source of truth for the head under review.
-- ==========================================================================
create table if not exists ops.pr (
  id             uuid not null
    constraint pr_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint pr_build_fkey references ops.build (id) on delete no action,
  repo           text,                                           -- [phase0] 'owner/repo' pointer
  pr_number      integer,                                        -- [phase0]
  current_head_sha ops.git_sha,                                  -- [projection-only] CACHED GitHub head (canonical)
  base_sha       ops.git_sha,                                    -- [projection-only] CACHED GitHub base (canonical)
  github_pr_state text,                                          -- [projection-only] open/closed/merged (cached)
  github_observed_at timestamptz,                                -- [projection-only] when GH was last read
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]
  constraint pr_build_number_key unique (build_id, pr_number)
);

comment on column ops.pr.current_head_sha is
  'CACHED GitHub value — GitHub is AUTHORITATIVE for the PR head. This is a projection you '
  'refresh; the EXACT frozen review target lives on ops.checkpoint (head_sha), and the '
  'authoritative current head per build lives on ops.build_head (002). DO NOT treat this as '
  'the head under review.';

drop trigger if exists pr_identity_guard on ops.pr;
create trigger pr_identity_guard
  before update or delete on ops.pr
  for each row execute function ops.identity_immutable_guard();
drop trigger if exists pr_touch_updated_at on ops.pr;
create trigger pr_touch_updated_at before update on ops.pr
  for each row execute function ops.touch_updated_at();

-- ==========================================================================
-- ACCEPTANCE_ROW — the IMMUTABLE requirement ONLY. No mutable evidence/result columns live
-- here (evidence is a separate append-only claim; verification is a separate append-only,
-- reviewer-only row). Bound to the EXACT prd_version_id it was authored against, so when the
-- PRD supersedes, the requirement's verifications go stale (via the current-state view) and a
-- NEW acceptance_row set is authored for the new version. UPDATE and DELETE are BOTH rejected.
-- ==========================================================================
create table if not exists ops.acceptance_row (
  id             uuid not null
    constraint acceptance_row_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint acceptance_row_build_fkey references ops.build (id) on delete no action,
  prd_version_id uuid not null                                   -- [phase0] the EXACT PRD version
    constraint acceptance_row_prd_fkey references ops.prd (id) on delete no action,
  acceptance_ref text not null,                                  -- [phase0] e.g. 'AC-04'
  requirement_text text not null,                                -- [phase0]
  owning_wp_id   uuid                                            -- [phase0] the WP that owns delivery (nullable)
    constraint acceptance_row_wp_fkey references ops.wp (id) on delete no action,
  expected_proof text,                                           -- [phase0] what proof is expected
  impl_path      text,                                           -- [phase0] where it is implemented
  created_at     timestamptz not null default now(),             -- [phase0]
  constraint acceptance_row_build_ref_key unique (build_id, acceptance_ref),
  -- Composite-FK target: lets acceptance_verification bind (acceptance_row_id, prd_version_id)
  -- so a verification can only cite the SAME PRD version the requirement was authored against.
  constraint acceptance_row_id_prd_uk unique (id, prd_version_id)
);

drop trigger if exists acceptance_row_immutable on ops.acceptance_row;
create trigger acceptance_row_immutable
  before update or delete on ops.acceptance_row
  for each row execute function ops.reject_row_mutation();
drop trigger if exists acceptance_row_no_truncate on ops.acceptance_row;
create trigger acceptance_row_no_truncate
  before truncate on ops.acceptance_row
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- ACCEPTANCE_EVIDENCE — APPEND-ONLY builder CLAIM. exact_sha is bound to the checkpoint's
-- EXACT head by COMPOSITE FK (checkpoint_id, exact_sha) -> checkpoint (id, head_sha), so an
-- evidence claim can only be attached to a head the checkpoint actually recorded (the same
-- exact-SHA-binding kill as 001's verdict). submitted_by is unrestricted (the BUILDER may
-- submit evidence — a claim is not a verification). UPDATE/DELETE rejected.
-- ==========================================================================
create table if not exists ops.acceptance_evidence (
  id             uuid not null
    constraint acceptance_evidence_pkey primary key default gen_random_uuid(),
  acceptance_row_id uuid not null                                -- [phase0]
    constraint acceptance_evidence_row_fkey references ops.acceptance_row (id) on delete no action,
  checkpoint_id  uuid not null,                                  -- [phase0]
  submitted_by   ops.principal not null,                         -- [phase0] the builder claim (any principal)
  evidence_type  ops.evidence_type not null,                     -- [phase0]
  evidence_ref   text,                                           -- [phase0] pointer to the evidence
  evidence_hash  text,                                           -- [phase0] integrity fingerprint
  exact_sha      ops.git_sha not null,                           -- [phase0] canonical head the claim is bound to
  created_at     timestamptz not null default now(),             -- [phase0]
  -- EXACT-SHA BINDING: the claim's head MUST be a head this checkpoint recorded (else 23503).
  constraint acceptance_evidence_checkpoint_head_fkey
    foreign key (checkpoint_id, exact_sha) references ops.checkpoint (id, head_sha) on delete no action
);

create index if not exists acceptance_evidence_row_idx
  on ops.acceptance_evidence (acceptance_row_id, created_at);

drop trigger if exists acceptance_evidence_append_only on ops.acceptance_evidence;
create trigger acceptance_evidence_append_only
  before update or delete on ops.acceptance_evidence
  for each row execute function ops.reject_row_mutation();
drop trigger if exists acceptance_evidence_no_truncate on ops.acceptance_evidence;
create trigger acceptance_evidence_no_truncate
  before truncate on ops.acceptance_evidence
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- ACCEPTANCE_VERIFICATION — APPEND-ONLY, REVIEWER-PRINCIPAL ONLY. This is the load-bearing
-- table of this PR: the BUILDER is STRUCTURALLY UNABLE to write here.
--   · reviewer-only: a non-bypassable CHECK constraint (NOT disabled by
--     session_replication_role=replica) restricts reviewer to {gpt_codex, fable, tower};
--     a BEFORE INSERT trigger repeats it as defence-in-depth with a clear message and is the
--     one-place seam PR-2 widens (e.g. a future 'grok').
--   · contract-bound: prd_version_id + plan_version_id record the EXACT contract the reviewer
--     verified against; the composite FK (acceptance_row_id, prd_version_id) forces the cited
--     PRD version to match the requirement's own PRD version.
--   · head-bound: the composite FK (checkpoint_id, exact_sha) -> checkpoint (id, head_sha)
--     forces the verification onto a head the checkpoint actually recorded.
-- Current validity is DERIVED (see current_acceptance_state): a moved head or a superseded
-- contract automatically invalidates a prior verification. UPDATE/DELETE rejected.
-- ==========================================================================
create table if not exists ops.acceptance_verification (
  id             uuid not null
    constraint acceptance_verification_pkey primary key default gen_random_uuid(),
  acceptance_row_id uuid not null,                               -- [phase0]
  checkpoint_id  uuid not null,                                  -- [phase0]
  reviewer       ops.principal not null,                         -- [phase0] REVIEWER principal only
  result         ops.acceptance_result not null,                 -- [phase0]
  rationale      text,                                           -- [phase0]
  exact_sha      ops.git_sha not null,                           -- [phase0] canonical head reviewed
  prd_version_id uuid not null,                                  -- [phase0] contract binding
  plan_version_id uuid not null                                  -- [phase0] contract binding
    constraint acceptance_verification_plan_fkey references ops.plan (id) on delete no action,
  created_at     timestamptz not null default now(),             -- [phase0]
  -- STRUCTURAL builder-cannot-verify guarantee (non-bypassable CHECK). PR-2 widens the set
  -- here + in ops.assert_acceptance_reviewer when a new reviewer principal is authorised.
  constraint acceptance_verification_reviewer_is_reviewer_chk
    check (reviewer in ('gpt_codex', 'fable', 'tower')),
  -- The verification's cited PRD version MUST match the requirement's PRD version (else 23503).
  constraint acceptance_verification_row_prd_fkey
    foreign key (acceptance_row_id, prd_version_id) references ops.acceptance_row (id, prd_version_id) on delete no action,
  -- EXACT-SHA BINDING onto the checkpoint's recorded head.
  constraint acceptance_verification_checkpoint_head_fkey
    foreign key (checkpoint_id, exact_sha) references ops.checkpoint (id, head_sha) on delete no action
);

create index if not exists acceptance_verification_row_idx
  on ops.acceptance_verification (acceptance_row_id, created_at desc);

comment on constraint acceptance_verification_reviewer_is_reviewer_chk on ops.acceptance_verification is
  'BUILDER-CANNOT-VERIFY: reviewer is restricted to reviewer principals (gpt_codex/fable/tower). '
  'A CHECK (not only a trigger) because a CHECK is NOT bypassed by session_replication_role=replica, '
  'so larry/warwick cannot self-verify even with triggers disabled. PR-2 owns widening this set '
  '(and the ops.principal enum). DO NOT WEAKEN to include larry/warwick.';

drop trigger if exists acceptance_verification_reviewer_only on ops.acceptance_verification;
create trigger acceptance_verification_reviewer_only
  before insert on ops.acceptance_verification
  for each row execute function ops.assert_acceptance_reviewer();
drop trigger if exists acceptance_verification_append_only on ops.acceptance_verification;
create trigger acceptance_verification_append_only
  before update or delete on ops.acceptance_verification
  for each row execute function ops.reject_row_mutation();
drop trigger if exists acceptance_verification_no_truncate on ops.acceptance_verification;
create trigger acceptance_verification_no_truncate
  before truncate on ops.acceptance_verification
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- FINDING — NORMALISED. Replaces any array-of-ids drift with a first-class row carrying the
-- authority fields: opened_by, disposition, severity, impact, reachability, current state.
-- Identity/authority is frozen; the triage fields are the authority's to update; DELETE is
-- rejected (close via disposition/state, never delete).
-- ==========================================================================
create table if not exists ops.finding (
  id             uuid not null
    constraint finding_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint finding_build_fkey references ops.build (id) on delete no action,
  finding_ref    text not null,                                  -- [phase0] e.g. 'F-046-A'
  opened_by      ops.principal not null,                         -- [phase0] authority: who opened it
  title          text,                                           -- [phase0]
  detail_ref     text,                                           -- [phase0] pointer to the detail
  detail_hash    text,                                           -- [phase0] integrity fingerprint
  severity       ops.finding_severity not null default 'medium', -- [phase0] authority: severity/impact
  impact         text,                                           -- [phase0]
  reachability   ops.finding_reachability not null default 'unknown', -- [phase0] authority: reachability
  disposition    ops.finding_disposition not null default 'unresolved', -- [phase0] authority: disposition
  state          ops.finding_state not null default 'open',      -- [phase0] authority: current state
  opened_at_sha  ops.git_sha,                                    -- [phase0] canonical head at open (nullable)
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]
  constraint finding_build_ref_key unique (build_id, finding_ref),
  -- An OPEN finding is unresolved; a CLOSED finding carries a resolution disposition.
  constraint finding_state_disposition_chk check (
    (state = 'open') = (disposition = 'unresolved')
  )
);

create index if not exists finding_build_open_idx
  on ops.finding (build_id) where state = 'open';

drop trigger if exists finding_guard on ops.finding;
create trigger finding_guard
  before update or delete on ops.finding
  for each row execute function ops.finding_guard_mutation();
drop trigger if exists finding_touch_updated_at on ops.finding;
create trigger finding_touch_updated_at before update on ops.finding
  for each row execute function ops.touch_updated_at();
drop trigger if exists finding_no_truncate on ops.finding;
create trigger finding_no_truncate
  before truncate on ops.finding
  for each statement execute function ops.reject_truncate();

-- ==========================================================================
-- ACCEPTANCE_FINDING — the many-to-many join that REPLACES open_finding_ids[]. A proper,
-- constrainable relation (no array drift): which findings bear on which acceptance rows. A
-- mistaken link may be removed (DELETE granted) — the finding itself persists on ops.finding.
-- ==========================================================================
create table if not exists ops.acceptance_finding (
  acceptance_row_id uuid not null
    constraint acceptance_finding_row_fkey references ops.acceptance_row (id) on delete no action,
  finding_id     uuid not null
    constraint acceptance_finding_finding_fkey references ops.finding (id) on delete no action,
  linked_by      ops.principal,                                  -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  constraint acceptance_finding_pkey primary key (acceptance_row_id, finding_id)
);

create index if not exists acceptance_finding_finding_idx
  on ops.acceptance_finding (finding_id);

-- ==========================================================================
-- VIEW ops.contract_stale — SYSTEM-DERIVED / SYSTEM-CONTROLLED, never agent-editable. Per
-- acceptance_verification, whether its bound PRD or Plan version has been SUPERSEDED. This is
-- a VIEW by design (SSOT: staleness is DERIVED from version supersession — the single source
-- of truth is prd.state/plan.state; storing it in a table would duplicate that fact). A view
-- is trivially never-agent-editable. security_invoker keeps RLS honest.
-- ==========================================================================
create or replace view ops.contract_stale
with (security_invoker = true) as
select
  av.id              as verification_id,
  ar.build_id        as build_id,
  av.acceptance_row_id,
  av.prd_version_id,
  (p.state = 'superseded')  as prd_superseded,
  av.plan_version_id,
  (pl.state = 'superseded') as plan_superseded,
  (p.state = 'superseded' or pl.state = 'superseded') as contract_stale
from ops.acceptance_verification av
join ops.acceptance_row ar on ar.id = av.acceptance_row_id
join ops.prd  p  on p.id  = av.prd_version_id
join ops.plan pl on pl.id = av.plan_version_id;

comment on view ops.contract_stale is
  'SYSTEM-DERIVED staleness of each acceptance_verification from CONTRACT version supersession '
  '(prd.state/plan.state). A VIEW by design (SSOT — derived from version supersession, not stored). '
  'Never agent-editable.';

-- ==========================================================================
-- VIEW ops.current_acceptance_state — the CURRENT verification state per acceptance_row.
-- A verification COUNTS as current/valid ONLY when all three hold simultaneously:
--   (1) its PRD version is the ACTIVE one   (p.state = 'active'),
--   (2) its Plan version is the ACTIVE one  (pl.state = 'active'),
--   (3) its exact_sha equals the AUTHORITATIVE CURRENT head for the build
--       (ops.build_head.current_head_sha from 002).
-- The LATEST such verification (by created_at) is the current state. Therefore:
--   · a HEAD MOVE (build_head advances) makes exact_sha != current head -> the prior
--     verification stops counting -> the requirement reverts to unverified;
--   · a CONTRACT SUPERSESSION (prd/plan -> superseded) drops the join on state='active' ->
--     the prior verification stops counting -> unverified.
-- Invalidation is thus AUTOMATIC and STRUCTURAL — no agent writes it. LEFT JOIN so every
-- acceptance_row is listed, with is_currently_verified=false when nothing valid exists.
-- security_invoker keeps RLS honest.
-- ==========================================================================
create or replace view ops.current_acceptance_state
with (security_invoker = true) as
select
  ar.id            as acceptance_row_id,
  ar.build_id,
  ar.acceptance_ref,
  ar.prd_version_id,
  ar.owning_wp_id,
  v.id             as verification_id,
  v.result         as current_result,
  v.reviewer       as verified_by,
  v.exact_sha      as verified_head_sha,
  v.checkpoint_id  as verified_checkpoint_id,
  v.plan_version_id as verified_plan_version_id,
  v.created_at     as verified_at,
  (v.id is not null) as is_currently_verified,
  (v.id is not null and v.result = 'pass') as is_currently_passed
from ops.acceptance_row ar
left join lateral (
  select av.*
  from ops.acceptance_verification av
  join ops.prd  p  on p.id  = av.prd_version_id  and p.state  = 'active'
  join ops.plan pl on pl.id = av.plan_version_id and pl.state = 'active'
  join ops.build_head bh on bh.build_id = ar.build_id and bh.current_head_sha = av.exact_sha
  where av.acceptance_row_id = ar.id
  order by av.created_at desc, av.id desc
  limit 1
) v on true;

comment on view ops.current_acceptance_state is
  'CURRENT verification state per acceptance_row: the latest acceptance_verification bound to '
  'the ACTIVE prd_version + ACTIVE plan_version + the AUTHORITATIVE current head (ops.build_head, '
  '002). A moved head OR a superseded contract automatically invalidates a prior verification '
  '(is_currently_verified flips to false). Fully derived — no agent writes it.';

-- =============================================================================
-- SECURITY GATE — RLS deny-by-default, FORCED. DO NOT WEAKEN. (Mirrors 001/002.)
-- Enable + FORCE RLS on EVERY new table; grant + policy the server-side service_role ONLY.
-- Immutable requirement + append-only claim tables get SELECT+INSERT (no UPDATE/DELETE).
-- Immutable versioned tables get SELECT+INSERT+UPDATE (UPDATE narrowed to active->superseded
-- by the guard) with NO DELETE. Operational records (wp, pr, finding) get SELECT+INSERT+UPDATE
-- with NO DELETE (identity frozen by guard). The join relation gets SELECT+INSERT+DELETE.
-- anon/authenticated get NEITHER a grant NOR a policy.
-- =============================================================================

alter table ops.prd                     enable row level security;
alter table ops.plan                    enable row level security;
alter table ops.wp                      enable row level security;
alter table ops.pr                      enable row level security;
alter table ops.acceptance_row          enable row level security;
alter table ops.acceptance_evidence     enable row level security;
alter table ops.acceptance_verification enable row level security;
alter table ops.finding                 enable row level security;
alter table ops.acceptance_finding      enable row level security;

alter table ops.prd                     force row level security;
alter table ops.plan                    force row level security;
alter table ops.wp                      force row level security;
alter table ops.pr                      force row level security;
alter table ops.acceptance_row          force row level security;
alter table ops.acceptance_evidence     force row level security;
alter table ops.acceptance_verification force row level security;
alter table ops.finding                 force row level security;
alter table ops.acceptance_finding      force row level security;

grant usage on schema ops to service_role;

-- Immutable versioned contract: no DELETE (supersede, never delete).
grant select, insert, update on ops.prd, ops.plan to service_role;
-- Operational records: no DELETE (retained for audit; identity frozen by guard).
grant select, insert, update on ops.wp, ops.pr, ops.finding to service_role;
-- Immutable requirement + append-only claims: SELECT + INSERT only.
grant select, insert on
  ops.acceptance_row, ops.acceptance_evidence, ops.acceptance_verification
  to service_role;
-- Join relation: a mistaken link may be removed.
grant select, insert, delete on ops.acceptance_finding to service_role;

grant usage, select on all sequences in schema ops to service_role;
grant select on ops.contract_stale, ops.current_acceptance_state to service_role;

-- G10 (carried): default-deny function EXECUTE. New functions get PUBLIC execute by default;
-- revoke it. Every function this migration adds is a TRIGGER function (Postgres does not
-- privilege-check trigger invocation, so the guards still fire) — no explicit service_role
-- EXECUTE grant is required. This revoke also re-affirms 001/002's posture idempotently
-- without touching their explicit service_role grants (revoking PUBLIC leaves those intact).
revoke execute on all functions in schema ops from public;

-- One permissive FOR ALL policy per new table, scoped TO service_role. Idempotent.
do $$
declare t text;
begin
  foreach t in array array[
    'prd','plan','wp','pr','acceptance_row','acceptance_evidence',
    'acceptance_verification','finding','acceptance_finding'
  ] loop
    execute format('drop policy if exists service_role_all_%1$s on ops.%1$s', t);
    execute format(
      'create policy service_role_all_%1$s on ops.%1$s for all to service_role using (true) with check (true)',
      t);
  end loop;
end
$$;

-- (No anon/authenticated policies on purpose — deny-by-default. The 5-role least-privilege
--  DB-GRANT separation, including proving larry CANNOT verify at the grant layer, is applied
--  and tested in PR-4; the structural reviewer-only CHECK above already makes builder
--  self-verification impossible independent of grants.)
