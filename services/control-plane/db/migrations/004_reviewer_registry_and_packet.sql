-- =============================================================================
-- BUILD-014 PR-2a — Reviewer registry + review packet/run + checkpoint assurance
-- Migration: 004_reviewer_registry_and_packet                     (author: silas)
--
-- WHY THIS EXISTS
--   001 gave us the head-bound checkpoint/verdict/merge-gate core, with a HARDCODED
--   two-reviewer rule: verdict_reviewer_role_chk pins correction_loop=gpt_codex and
--   cold_final=fable, and checkpoint_merge_readiness demands an ACTIVE approve of BOTH
--   types at the same head. That is correct for the legacy two-reviewer flow but it
--   cannot express RISK-TIERED review: a low-risk checkpoint that needs only a
--   product-QA pass, or an elevated checkpoint that additionally needs an adversarial
--   or security role. 003 added the immutable contract/acceptance/finding layer.
--
--   This migration adds the REVIEWER-TRUST SCHEMA layer:
--     · a GENERIC reviewer identity REGISTRY (reviewer_registry + reviewer_authorised_role)
--       keyed by TEXT — NOT the closed ops.principal enum — so a new reviewer (e.g. a
--       future 'grok') registers by ONE config row + adapter, with NO schema rewrite and
--       NO new enum value. Codex and Fable are ROWS in this registry, not special cases.
--     · a model-agnostic review ROLE vocabulary (product_qa / adversarial_assurance /
--       security_assurance).
--     · checkpoint_assurance (v3 Part B): the per-checkpoint COMPUTED required-role
--       profile (the COMPUTATION lives in PR-2b; this migration is the table + constraints
--       + FKs only). auto_merge_eligible is EXPLICIT — never inferred from green gates.
--     · review_packet (v3 Part A + campaign correction #2): the first-class, versioned,
--       HASHED, RESOLVED-IMMUTABLE-PAYLOAD snapshot the reviewer runtime dispatches — NOT
--       bare arrays of record ids (a finding can change after packet creation; you must be
--       able to reconstruct exactly what the model saw). Immutable once ready/hashed.
--     · review_run (v3 Part A): proves WHAT a model actually reviewed — bound by COMPOSITE
--       FK to the packet's packet_hash + exact head + prd/plan contract versions, and to an
--       AUTHORISED (reviewer, role) pair from the registry.
--     · a NEW model-agnostic readiness view (checkpoint_role_readiness) that computes
--       merge-readiness from checkpoint_assurance's REQUIRED ROLES + the registry + active
--       review_runs. It is ADDED but INERT (Warwick correction B): it does NOT govern any
--       active gate in this PR. 001's checkpoint_merge_readiness (both-required) remains the
--       governing path; a feature flag (ops.feature_flag[role_based_readiness], OFF by default)
--       + ops.checkpoint_effective_readiness delegate to the LEGACY policy until PR-2b flips it
--       on. So the risk-tiered logic is proven to WORK, yet changes nothing live in PR-2a.
--
-- THE LOAD-BEARING CORRECTION (Warwick, explicit): the NEW reviewer identity is NOT the
--   closed ops.principal enum. It is keyed via the registry (TEXT reviewer_key), so adding
--   Grok later is one reviewer_registry row + one reviewer_authorised_role grant + an
--   adapter — never a schema/enum change. See "RESOLVING THE PRINCIPAL TENSION" below.
--
-- RESOLVING THE PRINCIPAL TENSION (existing verdict.reviewer typed ops.principal):
--   001's ops.verdict.reviewer is typed ops.principal and is IMMUTABLE evidence. This
--   migration does NOT touch 001, does NOT rewrite any historical verdict, and does NOT
--   relabel any reviewer identity. Instead:
--     · every NEW review-layer identity is the TEXT reviewer_key (registry), never a new
--       principal enum value;
--     · reviewer_registry.principal_alias (nullable ops.principal) MAPS a registry row onto
--       the legacy principal it corresponds to (gpt_codex, fable). This is a one-way
--       surfacing map: old verdict evidence (keyed by ops.principal) can be joined to its
--       registry metadata via ops.verdict_reviewer (a VIEW) WITHOUT altering verdict.
--     · new role-based readiness reads the registry + review_run; 001's
--       checkpoint_merge_readiness is left INTACT for historical/back-compat rows.
--   No historical verdict is lost or relabelled; a new reviewer never needs an enum change.
--   (Chosen approach + alternatives + residuals are documented in PR-2a-BUILD-NOTE.md.)
--
-- DEPENDS ON (applied in order): 001 (build, checkpoint, ops.git_sha, ops.canonicalize_sha,
--   ops.reject_truncate, ops.touch_updated_at, ops.principal, ops.data_classification,
--   ops.verdict), 002 (ops.build_head), 003 (prd, plan, wp, pr, finding). ADDITIVE — does
--   NOT modify 001/002/003.
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD/hosted/live DB. !!
--   Target schema `ops`. Never touches the `asdair` schema or any personal/entrusted data.
--   A live apply is Larry-gated to an ISOLATED dev database. Fully idempotent / re-runnable
--   (enums guarded by DO-blocks, `if not exists`, `create or replace`, drop-if-exists for
--   triggers/policies) so it can be applied repeatedly against a throwaway dev substrate.
--
-- !! SECURITY GATE — DO NOT WEAKEN !!
--   RLS ENABLED + FORCED deny-by-default on EVERY new table. ONLY the server-side
--   `service_role` gets a grant + policy; `anon`/`authenticated` get NEITHER. No column
--   stores a secret value: the reviewer registry holds HONEST provider/model labels +
--   adapter identity POINTERS, never credentials (correction #1: reviewer subprocesses get
--   no DB/Telegram/cross-reviewer secrets — the registry stores identity, not secrets).
--   THREAT-MODEL RESIDUALS from 001 (SUPERUSER/BYPASSRLS; owner DISABLE TRIGGER /
--   session_replication_role=replica) still apply to trigger-based guards.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 001/003): a table implicitly creates a
--   composite type of the same name, so NO enum below shares a name with any table.
--   New tables: reviewer_registry, reviewer_authorised_role, checkpoint_assurance,
--   review_packet, review_run, review_run_finding. New enums: review_role, packet_state,
--   review_outcome. No overlap by construction (and none collide with 001/003 enums).
--
-- FIELD CLASSIFICATION: every column is tagged inline
--   [phase0] | [projection-only] | [later]
-- =============================================================================

-- Depends on 001 having created the schema; harmless if already present.
create schema if not exists ops;

-- --------------------------------------------------------------------------
-- Enumerated types (closed vocabularies). DO-block wrapped for idempotency.
-- --------------------------------------------------------------------------

-- [phase0] The model-agnostic review ROLE vocabulary (campaign correction #4). A reviewer
-- IDENTITY (registry) is authorised to fill one or more of these ROLES. Roles are the stable
-- policy vocabulary; the concrete reviewer filling a role is config (registry), never
-- hardcoded. A closed enum is deliberate — new ROLES are a schema decision (rare), new
-- REVIEWERS are config (common); the two axes are kept separate.
do $$ begin
  create type ops.review_role as enum (
    'product_qa',            -- ordinary fitness-for-purpose / acceptance QA (Codex today)
    'adversarial_assurance', -- adversarial cold-final assurance (Fable today; replaceable by config)
    'security_assurance'     -- security-focused assurance (when a security surface is touched)
  );
exception when duplicate_object then null; end $$;

-- [phase0] review_packet lifecycle. A packet is BUILDING while the runtime resolves evidence;
-- becomes READY once the resolved payload is hashed (immutable from here); BLOCKED if mandatory
-- evidence cannot resolve (correction #3 — never silently truncate); CONSUMED once a review_run
-- has read it; STALE once its head moved / contract superseded.
do $$ begin
  create type ops.packet_state as enum ('building', 'ready', 'blocked', 'consumed', 'stale');
exception when duplicate_object then null; end $$;

-- [phase0] review_run outcome. Only 'approved' satisfies a required role (mirrors 001's rule
-- that only a genuine 'approve' verdict is merge-relevant; 'comment' is never sufficient).
do $$ begin
  create type ops.review_outcome as enum (
    'pending',           -- dispatched, not yet returned (never satisfies a role)
    'approved',          -- the role is satisfied at this head/packet
    'changes_requested', -- reviewer wants changes (blocks)
    'blocked',           -- reviewer could not evaluate (fail-closed; blocks)
    'comment',           -- unverifiable / insufficient — NEVER satisfies a role
    'error'              -- run failed / invalid result (blocks)
  );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- SHARED GUARD FUNCTIONS (added by this migration; every one pins search_path).
-- --------------------------------------------------------------------------

-- Generic APPEND-ONLY guard: rejects any UPDATE or DELETE. Used for review_run and
-- review_run_finding (a review run + what it opened/closed is IMMUTABLE evidence — a
-- re-review is a NEW run). restrict_violation = SQLSTATE 23001 (matches 001/003).
create or replace function ops.reject_review_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  raise exception 'ops.% is append-only review evidence: % is rejected. A re-review is a NEW run, never an edit.', tg_table_name, tg_op
    using errcode = 'restrict_violation';
  return null;
end;
$$;

-- reviewer_registry guard: reviewer_key + created_at are immutable identity; DELETE is
-- rejected (a reviewer is RETIRED by setting enabled=false, never deleted — deleting would
-- orphan its historical review_runs / role grants and erase honest-label provenance). The
-- config fields (provider/model/adapter_identity/enabled/honest_label/updated_at) stay mutable.
create or replace function ops.reviewer_registry_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.reviewer_registry is durable reviewer identity: DELETE is rejected (retire via enabled=false; deleting would orphan historical review_runs and role grants)'
      using errcode = 'restrict_violation';
  end if;
  if new.reviewer_key <> old.reviewer_key or new.created_at <> old.created_at then
    raise exception 'ops.reviewer_registry: reviewer_key and created_at are immutable identity (register a NEW reviewer_key instead)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- checkpoint_assurance guard: checkpoint_id + created_at are immutable identity; DELETE is
-- rejected (the assurance profile is recomputed in place, never deleted). Every OTHER column
-- (the required-role booleans, auto_merge_eligible, triggers, policy_version, calculated_at)
-- stays mutable so PR-2b may RECOMPUTE the profile for a new policy_version.
create or replace function ops.checkpoint_assurance_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.checkpoint_assurance is a decision record: DELETE is rejected (recompute in place, never delete)'
      using errcode = 'restrict_violation';
  end if;
  if new.checkpoint_id <> old.checkpoint_id or new.created_at <> old.created_at then
    raise exception 'ops.checkpoint_assurance: checkpoint_id and created_at are immutable identity'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- review_packet guard: DEFAULT-DENY once the packet leaves 'building'. A packet is a snapshot
-- the reviewer READ; once READY/hashed it must be reconstructable byte-for-byte, so its payload,
-- hash, identity and bindings FREEZE. The ONLY legal transitions are:
--     building -> ready | blocked        (resolve succeeds / fails-closed)
--     ready    -> consumed | stale       (a run read it / head or contract moved)
--     consumed -> stale                  (head/contract moved after consumption)
-- While 'building', the resolving runtime may still change payload/bindings (but NOT identity).
-- packet_hash, once set, can NEVER change (hash-immutability). DELETE always rejected.
create or replace function ops.review_packet_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  -- Columns that may change once the packet has left 'building' (i.e. is hashed/frozen).
  allow_after_building constant text[] := array['state', 'updated_at'];
  generated_cols text[];
  old_j jsonb;
  new_j jsonb;
  col text;
  valid_transition boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.review_packet is review evidence: DELETE is rejected (supersede via state=stale, never delete)'
      using errcode = 'restrict_violation';
  end if;

  -- Identity is ALWAYS frozen.
  if new.id <> old.id or new.build_id <> old.build_id or new.created_at <> old.created_at then
    raise exception 'ops.review_packet: identity (id/build_id/created_at) is immutable'
      using errcode = 'restrict_violation';
  end if;

  -- Legal state transitions only.
  valid_transition :=
       (old.state = new.state)
    or (old.state = 'building'  and new.state in ('ready', 'blocked'))
    or (old.state = 'ready'     and new.state in ('consumed', 'stale'))
    or (old.state = 'consumed'  and new.state = 'stale');
  if not valid_transition then
    raise exception 'ops.review_packet: illegal state transition % -> % (allowed: building->ready|blocked, ready->consumed|stale, consumed->stale)', old.state, new.state
      using errcode = 'restrict_violation';
  end if;

  -- packet_hash is write-once: once set it can never change (guarantees reconstructability).
  if old.packet_hash is not null and new.packet_hash is distinct from old.packet_hash then
    raise exception 'ops.review_packet: packet_hash is write-once — a hashed packet is immutable (build a NEW packet)'
      using errcode = 'restrict_violation';
  end if;

  -- Once the packet has left 'building' (hashed/frozen), DEFAULT-DENY every base column except
  -- the allow-list (state transition + updated_at). Skip generated columns (none today; read
  -- from the catalog so a future generated column is auto-skipped).
  if old.state <> 'building' then
    select coalesce(array_agg(attname), array[]::text[]) into generated_cols
      from pg_attribute where attrelid = tg_relid and attgenerated <> '' and not attisdropped;
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    for col in select jsonb_object_keys(new_j) loop
      if col = any(generated_cols) or col = any(allow_after_building) then
        continue;
      end if;
      if (new_j -> col) is distinct from (old_j -> col) then
        raise exception 'ops.review_packet: column "%" is immutable once the packet is hashed/ready (default-deny) — only state may advance and updated_at may refresh', col
          using errcode = 'restrict_violation';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- review_packet born-state guard: a packet may be born building | ready | blocked, but NEVER
-- consumed | stale (those must pass through ready first, so the lifecycle chain is unforgeable).
create or replace function ops.review_packet_reject_insert_state()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if new.state in ('consumed', 'stale') then
    raise exception 'ops.review_packet cannot be INSERTed with state=% — a packet must be born building/ready/blocked (a consumed/stale packet must pass through ready)', new.state
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- =============================================================================
-- REVIEWER REGISTRY — the GENERIC reviewer identity. Keyed by TEXT reviewer_key, NOT the
-- closed ops.principal enum, so a new reviewer registers by config with NO schema/enum change.
-- Codex and Fable are ROWS here, not special cases. HONEST-LABEL discipline: provider/model
-- are the true vendor labels (gpt_codex is OpenAI and must NEVER be relabelled xAI/Grok);
-- adapter_identity is a POINTER to the adapter runtime, never a credential.
-- =============================================================================
create table if not exists ops.reviewer_registry (
  reviewer_key   text not null                                   -- [phase0] stable identity key (e.g. 'gpt_codex','fable','grok')
    constraint reviewer_registry_pkey primary key
    constraint reviewer_registry_key_format_chk
      check (reviewer_key ~ '^[a-z0-9][a-z0-9_]{1,62}$'),         -- lower snake, GL-001-ish slug discipline
  provider       text not null,                                  -- [phase0] HONEST provider label (e.g. 'openai','fable')
  model          text,                                           -- [phase0] model id / family (pointer, not a secret)
  adapter_identity text,                                         -- [phase0] POINTER to the adapter runtime (never a credential)
  -- [phase0] SURFACING MAP onto the legacy principal (001). Nullable: a NEW reviewer (grok)
  -- has NO principal alias and needs none. gpt_codex/fable carry their alias so historical
  -- verdict evidence (typed ops.principal) surfaces via ops.verdict_reviewer WITHOUT rewrite.
  principal_alias ops.principal,                                 -- [phase0]
  honest_label   text,                                           -- [phase0] free-text honesty note (audit)
  enabled        boolean not null default true,                  -- [phase0] AVAILABILITY: false = retired/unavailable
  notes          text,                                           -- [phase0]
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]
  -- at most one registry row per legacy principal alias (so the surfacing map is unambiguous).
  constraint reviewer_registry_principal_alias_key unique (principal_alias)
);

comment on table ops.reviewer_registry is
  'GENERIC reviewer identity registry (BUILD-014 PR-2a). Keyed by TEXT reviewer_key — NOT the '
  'closed ops.principal enum — so a new reviewer (e.g. grok) registers by ONE config row + a '
  'role grant + an adapter, with NO schema/enum rewrite. Codex and Fable are ROWS here. '
  'principal_alias maps a row onto the legacy ops.principal for historical verdict surfacing '
  '(ops.verdict_reviewer) WITHOUT rewriting any historical reviewer identity. Stores HONEST '
  'labels + adapter POINTERS, never credentials. DO NOT add reviewer values to ops.principal.';

drop trigger if exists reviewer_registry_guard on ops.reviewer_registry;
create trigger reviewer_registry_guard
  before update or delete on ops.reviewer_registry
  for each row execute function ops.reviewer_registry_guard_mutation();
drop trigger if exists reviewer_registry_touch_updated_at on ops.reviewer_registry;
create trigger reviewer_registry_touch_updated_at before update on ops.reviewer_registry
  for each row execute function ops.touch_updated_at();
drop trigger if exists reviewer_registry_no_truncate on ops.reviewer_registry;
create trigger reviewer_registry_no_truncate
  before truncate on ops.reviewer_registry
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- REVIEWER_AUTHORISED_ROLE — the normalised (reviewer_key, review_role) grant. This REPLACES
-- an authorised_roles[] array on the registry (no array drift — same discipline that replaced
-- open_finding_ids[] with acceptance_finding in 003). It is the STRUCTURAL FK target that lets
-- review_run prove "a reviewer can only fill its AUTHORISED roles". A grant may be revoked
-- (DELETE) UNLESS a review_run already used it (FK ON DELETE NO ACTION protects used grants).
-- --------------------------------------------------------------------------
create table if not exists ops.reviewer_authorised_role (
  reviewer_key   text not null
    constraint reviewer_authorised_role_reviewer_fkey
      references ops.reviewer_registry (reviewer_key) on delete no action,
  review_role    ops.review_role not null,
  granted_at     timestamptz not null default now(),
  constraint reviewer_authorised_role_pkey primary key (reviewer_key, review_role)
);

comment on table ops.reviewer_authorised_role is
  'Normalised (reviewer_key, review_role) authorisation grant — the FK target that lets '
  'review_run structurally prove a reviewer only fills its authorised roles. Replaces an '
  'authorised_roles[] array (no array drift). Retire via DELETE (unused) or reviewer disable.';

-- =============================================================================
-- CHECKPOINT_ASSURANCE (v3 Part B) — the per-checkpoint COMPUTED required-role profile. The WP
-- is the baseline (003 ops.wp); the CHECKPOINT/diff computes the FINAL required reviewers. The
-- COMPUTATION lives in PR-2b; THIS migration is the table + constraints + FK only. One profile
-- per checkpoint (checkpoint_id PK). auto_merge_eligible is EXPLICIT — never inferred from green
-- gates (a green-gates-only auto-merge is exactly the class of silent escalation v3 forbids).
-- =============================================================================
create table if not exists ops.checkpoint_assurance (
  checkpoint_id  uuid not null                                   -- [phase0] one profile per checkpoint
    constraint checkpoint_assurance_pkey primary key
    constraint checkpoint_assurance_checkpoint_fkey references ops.checkpoint (id) on delete no action,
  build_id       uuid not null                                   -- [phase0] denormalised for scoping/readiness join
    constraint checkpoint_assurance_build_fkey references ops.build (id) on delete no action,
  -- REQUIRED ROLES (the risk-tiered profile). product_qa defaults ON (an ordinary QA pass is
  -- always the floor); adversarial/security default OFF and are raised by the touched surface.
  product_qa_required          boolean not null default true,    -- [phase0]
  adversarial_review_required  boolean not null default false,   -- [phase0]
  security_review_required     boolean not null default false,   -- [phase0]
  warwick_approval_required    boolean not null default false,   -- [phase0]
  -- EXPLICIT auto-merge eligibility. NEVER inferred from green gates; PR-2b/policy sets it
  -- deliberately. A checkpoint can be fully merge-ready yet auto_merge_eligible=false.
  auto_merge_eligible          boolean not null default false,   -- [phase0]
  triggers       text[] not null default array[]::text[],        -- [phase0] which touched surfaces drove the profile
  policy_version text,                                           -- [phase0] the risk-trigger policy version used
  calculated_at  timestamptz not null default now(),             -- [phase0] when the profile was (re)computed
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]
  -- A warwick-approval requirement is a strict human gate: it cannot coexist with auto-merge
  -- eligibility (auto-merge past a required human decision is exactly the silent-escalation
  -- class v3 forbids). Named CHECK, fail-closed.
  constraint checkpoint_assurance_no_auto_merge_when_warwick_chk
    check (not (auto_merge_eligible and warwick_approval_required))
);

comment on column ops.checkpoint_assurance.auto_merge_eligible is
  'EXPLICIT auto-merge eligibility — NEVER inferred from green gates. A checkpoint may be fully '
  'merge-ready (all required roles satisfied) yet auto_merge_eligible=false. PR-2b/policy sets '
  'this deliberately; the merge executor (PR-4) additionally requires the computed gate. '
  'DO NOT WEAKEN to a green-gates inference.';

drop trigger if exists checkpoint_assurance_guard on ops.checkpoint_assurance;
create trigger checkpoint_assurance_guard
  before update or delete on ops.checkpoint_assurance
  for each row execute function ops.checkpoint_assurance_guard_mutation();
drop trigger if exists checkpoint_assurance_touch_updated_at on ops.checkpoint_assurance;
create trigger checkpoint_assurance_touch_updated_at before update on ops.checkpoint_assurance
  for each row execute function ops.touch_updated_at();
drop trigger if exists checkpoint_assurance_no_truncate on ops.checkpoint_assurance;
create trigger checkpoint_assurance_no_truncate
  before truncate on ops.checkpoint_assurance
  for each statement execute function ops.reject_truncate();

-- =============================================================================
-- REVIEW_PACKET (v3 Part A + correction #2) — the first-class, versioned, HASHED, RESOLVED-
-- IMMUTABLE-PAYLOAD snapshot dispatched to reviewers. Both reviewers get the SAME packet id +
-- hash; only the PROMPT differs (recorded on review_run), never the evidence.
--   · exact_head_sha is bound to the checkpoint's recorded head by COMPOSITE FK
--     (checkpoint_id, exact_head_sha) -> checkpoint (id, head_sha) — the same exact-SHA kill
--     as 001's verdict / 003's evidence.
--   · resolved_payload (jsonb) AND/OR payload_artifact_ref (content-addressed pointer) carry the
--     RESOLVED CANONICAL CONTENTS (correction #2) — NOT bare arrays of record ids. packet_hash
--     is the hash of those resolved contents, so exactly what the model saw is reconstructable.
--   · a ready/consumed/stale packet MUST carry packet_hash + a resolved payload (CHECK).
--   · unique(id, <col>) targets exist so review_run can COMPOSITE-FK-bind to hash + head +
--     prd_version + plan_version in ONE structural step.
-- =============================================================================
create table if not exists ops.review_packet (
  id             uuid not null
    constraint review_packet_pkey primary key default gen_random_uuid(),
  build_id       uuid not null                                   -- [phase0]
    constraint review_packet_build_fkey references ops.build (id) on delete no action,
  wp_id          uuid                                            -- [phase0] the WP under review (nullable)
    constraint review_packet_wp_fkey references ops.wp (id) on delete no action,
  pr_id          uuid                                            -- [phase0] the PR (nullable)
    constraint review_packet_pr_fkey references ops.pr (id) on delete no action,
  checkpoint_id  uuid not null,                                  -- [phase0] the frozen review checkpoint
  exact_head_sha ops.git_sha not null,                           -- [phase0] canonical frozen review head
  base_sha       ops.git_sha not null,                           -- [phase0] canonical base for the base..head diff
  prd_version_id uuid                                            -- [phase0] EXACT approved PRD version (nullable while building/blocked)
    constraint review_packet_prd_fkey references ops.prd (id) on delete no action,
  plan_version_id uuid                                           -- [phase0] EXACT approved Plan version (nullable while building/blocked)
    constraint review_packet_plan_fkey references ops.plan (id) on delete no action,
  -- The assurance profile this packet was dispatched under (nullable ref; PR-2b links it).
  assurance_profile_ref uuid                                     -- [phase0]
    constraint review_packet_assurance_fkey references ops.checkpoint_assurance (checkpoint_id) on delete no action,
  -- THE RESOLVED IMMUTABLE PAYLOAD (correction #2). Store the resolved canonical contents inline
  -- (jsonb, pointers/sanitised evidence snapshot) and/or a content-addressed artifact pointer.
  resolved_payload jsonb,                                        -- [phase0] resolved canonical snapshot (immutable once ready)
  payload_artifact_ref text,                                     -- [phase0] content-addressed artifact pointer (alternative/adjunct)
  packet_hash    text,                                           -- [phase0] hash of the resolved canonical contents (write-once)
  state          ops.packet_state not null default 'building',   -- [phase0]
  blocked_reason text,                                           -- [phase0] why a packet is blocked (correction #3, no silent truncation)
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]
  updated_at     timestamptz not null default now(),             -- [phase0]

  -- EXACT-SHA BINDING: the packet head MUST be a head this checkpoint recorded (else 23503).
  constraint review_packet_checkpoint_head_fkey
    foreign key (checkpoint_id, exact_head_sha)
    references ops.checkpoint (id, head_sha) on delete no action,

  -- A ready/consumed/stale packet is HASHED and carries a resolved payload (reconstructable).
  -- A building/blocked packet need not (still resolving / failed-closed).
  constraint review_packet_ready_requires_hash_chk check (
    state in ('building', 'blocked')
    or (packet_hash is not null and (resolved_payload is not null or payload_artifact_ref is not null))
  ),
  -- A blocked packet must state WHY (correction #3 — never silently truncate).
  constraint review_packet_blocked_requires_reason_chk check (
    state <> 'blocked' or blocked_reason is not null
  ),

  -- COMPOSITE-FK TARGETS for review_run binding (id is already unique, so each is trivially
  -- unique; they exist purely to be the reference targets that carry hash/head/contract).
  constraint review_packet_id_hash_uk unique (id, packet_hash),
  constraint review_packet_id_head_uk unique (id, exact_head_sha),
  constraint review_packet_id_prd_uk  unique (id, prd_version_id),
  constraint review_packet_id_plan_uk unique (id, plan_version_id)
);

create index if not exists review_packet_checkpoint_idx
  on ops.review_packet (checkpoint_id, created_at);

comment on constraint review_packet_id_hash_uk on ops.review_packet is
  'COMPOSITE-FK TARGET: review_run (review_packet_id, packet_hash) -> review_packet (id, '
  'packet_hash). Because packet_hash is write-once and NULL until ready, a run can only bind to '
  'a HASHED packet, and only to the packet''s EXACT hash — "Tower approved" is provably an '
  'approval of a specific evidence set, not a vibe.';

drop trigger if exists review_packet_guard on ops.review_packet;
create trigger review_packet_guard
  before update or delete on ops.review_packet
  for each row execute function ops.review_packet_guard_mutation();
drop trigger if exists review_packet_reject_insert_state on ops.review_packet;
create trigger review_packet_reject_insert_state
  before insert on ops.review_packet
  for each row execute function ops.review_packet_reject_insert_state();
drop trigger if exists review_packet_touch_updated_at on ops.review_packet;
create trigger review_packet_touch_updated_at before update on ops.review_packet
  for each row execute function ops.touch_updated_at();
drop trigger if exists review_packet_no_truncate on ops.review_packet;
create trigger review_packet_no_truncate
  before truncate on ops.review_packet
  for each statement execute function ops.reject_truncate();

-- =============================================================================
-- REVIEW_RUN (v3 Part A) — proves WHAT a model actually reviewed. Append-only immutable
-- evidence (a re-review is a NEW run). BOUND, by COMPOSITE FK, to the packet's:
--     · packet_hash          (review_packet_id, packet_hash)       -> review_packet(id, packet_hash)
--     · exact head           (review_packet_id, reviewed_head_sha) -> review_packet(id, exact_head_sha)
--     · PRD contract version (review_packet_id, prd_version_id)    -> review_packet(id, prd_version_id)
--     · Plan contract version(review_packet_id, plan_version_id)   -> review_packet(id, plan_version_id)
-- and to an AUTHORISED (reviewer, role) pair:
--     · (reviewer_key, review_role) -> reviewer_authorised_role(reviewer_key, review_role)
-- So a run can ONLY exist against a HASHED packet, at that packet's EXACT head + contract, filled
-- by a reviewer AUTHORISED for that role. All bindings are STRUCTURAL FKs, not trigger checks.
-- =============================================================================
create table if not exists ops.review_run (
  id             uuid not null
    constraint review_run_pkey primary key default gen_random_uuid(),
  review_packet_id uuid not null,                                -- [phase0]
  reviewer_key   text not null,                                  -- [phase0] registry identity (NOT ops.principal)
  review_role    ops.review_role not null,                      -- [phase0] the role this run fills
  model_provider text,                                          -- [phase0] HONEST provider label (echo of registry at run time)
  model_id       text,                                          -- [phase0]
  prompt_version text,                                          -- [phase0]
  prompt_fingerprint text,                                      -- [phase0] fingerprint of the exact prompt used
  packet_hash    text not null,                                  -- [phase0] MUST equal the packet's hash (composite FK)
  reviewed_head_sha ops.git_sha not null,                        -- [phase0] MUST equal the packet's exact head (composite FK)
  prd_version_id uuid not null,                                  -- [phase0] MUST equal the packet's PRD version (composite FK)
  plan_version_id uuid not null,                                 -- [phase0] MUST equal the packet's Plan version (composite FK)
  started_at     timestamptz not null default now(),             -- [phase0]
  completed_at   timestamptz,                                   -- [phase0] null while pending
  outcome        ops.review_outcome not null default 'pending', -- [phase0]
  evidence_accessed text[] not null default array[]::text[],     -- [phase0] pointers to evidence the run actually read
  classification ops.data_classification not null default 'internal', -- [phase0]
  created_at     timestamptz not null default now(),             -- [phase0]

  -- A completed run carries a completion time; a pending run does not (fail-closed consistency).
  constraint review_run_completed_consistency_chk check (
    (outcome = 'pending') = (completed_at is null)
  ),

  -- STRUCTURAL BINDINGS (correction: "bound to packet_hash + exact SHA + contract versions").
  constraint review_run_packet_hash_fkey
    foreign key (review_packet_id, packet_hash)
    references ops.review_packet (id, packet_hash) on delete no action,
  constraint review_run_packet_head_fkey
    foreign key (review_packet_id, reviewed_head_sha)
    references ops.review_packet (id, exact_head_sha) on delete no action,
  constraint review_run_packet_prd_fkey
    foreign key (review_packet_id, prd_version_id)
    references ops.review_packet (id, prd_version_id) on delete no action,
  constraint review_run_packet_plan_fkey
    foreign key (review_packet_id, plan_version_id)
    references ops.review_packet (id, plan_version_id) on delete no action,
  -- REGISTRY DRIVES ROLE AUTHORISATION: a run's (reviewer, role) MUST be an authorised grant.
  constraint review_run_authorised_role_fkey
    foreign key (reviewer_key, review_role)
    references ops.reviewer_authorised_role (reviewer_key, review_role) on delete no action
);

create index if not exists review_run_packet_idx
  on ops.review_run (review_packet_id, created_at desc);
create index if not exists review_run_head_role_idx
  on ops.review_run (reviewed_head_sha, review_role);

comment on constraint review_run_authorised_role_fkey on ops.review_run is
  'REGISTRY DRIVES ROLE AUTHORISATION: (reviewer_key, review_role) must be a granted '
  'reviewer_authorised_role. A reviewer can ONLY fill a role it is authorised for — a FK '
  'violation, not a runtime check. Adding a new reviewer (grok) is one registry row + one '
  'grant, no schema change. DO NOT WEAKEN to a free-text reviewer field.';

drop trigger if exists review_run_append_only on ops.review_run;
create trigger review_run_append_only
  before update or delete on ops.review_run
  for each row execute function ops.reject_review_mutation();
drop trigger if exists review_run_no_truncate on ops.review_run;
create trigger review_run_no_truncate
  before truncate on ops.review_run
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- REVIEW_RUN_FINDING — normalised (review_run_id, finding_id, relation) join replacing
-- findings_opened[]/findings_closed[] arrays (same no-array-drift discipline). Append-only:
-- what a run opened/closed is immutable evidence (correction of a mistake is a NEW run).
-- --------------------------------------------------------------------------
create table if not exists ops.review_run_finding (
  review_run_id  uuid not null
    constraint review_run_finding_run_fkey references ops.review_run (id) on delete no action,
  finding_id     uuid not null
    constraint review_run_finding_finding_fkey references ops.finding (id) on delete no action,
  relation       text not null                                   -- [phase0] 'opened' | 'closed'
    constraint review_run_finding_relation_chk check (relation in ('opened', 'closed')),
  created_at     timestamptz not null default now(),             -- [phase0]
  constraint review_run_finding_pkey primary key (review_run_id, finding_id, relation)
);

create index if not exists review_run_finding_finding_idx
  on ops.review_run_finding (finding_id);

drop trigger if exists review_run_finding_append_only on ops.review_run_finding;
create trigger review_run_finding_append_only
  before update or delete on ops.review_run_finding
  for each row execute function ops.reject_review_mutation();
drop trigger if exists review_run_finding_no_truncate on ops.review_run_finding;
create trigger review_run_finding_no_truncate
  before truncate on ops.review_run_finding
  for each statement execute function ops.reject_truncate();

-- =============================================================================
-- FEATURE GATE (Warwick correction B) — the new role-based readiness is ADDED but INERT / OFF
-- BY DEFAULT. 001's checkpoint_merge_readiness (both-required) REMAINS the governing readiness
-- path and is NOT modified or superseded by this migration; the ACTIVE merge_gate enforcement
-- trigger (001 merge_gate_require_reviewers) is untouched and still reads the legacy path. The
-- role-based logic depends on PR-2b (packet-builder + risk-routing + product-QA prompt), so it
-- must not govern any active gate here. ops.checkpoint_effective_readiness reads this flag and,
-- by default (flag OFF), delegates to the LEGACY both-required policy — historical readiness is
-- unchanged and the role-based view is advisory-only until PR-2b deliberately flips it on.
-- =============================================================================
create table if not exists ops.feature_flag (
  flag_key   text not null constraint feature_flag_pkey primary key,
  enabled    boolean not null default false,               -- OFF by default (deny-by-default)
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- flag_key + created_at are immutable identity; DELETE rejected (toggle enabled, never delete).
create or replace function ops.feature_flag_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.feature_flag is durable config: DELETE is rejected (toggle enabled instead)'
      using errcode = 'restrict_violation';
  end if;
  if new.flag_key <> old.flag_key or new.created_at <> old.created_at then
    raise exception 'ops.feature_flag: flag_key and created_at are immutable'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists feature_flag_guard on ops.feature_flag;
create trigger feature_flag_guard before update or delete on ops.feature_flag
  for each row execute function ops.feature_flag_guard_mutation();
drop trigger if exists feature_flag_touch_updated_at on ops.feature_flag;
create trigger feature_flag_touch_updated_at before update on ops.feature_flag
  for each row execute function ops.touch_updated_at();
drop trigger if exists feature_flag_no_truncate on ops.feature_flag;
create trigger feature_flag_no_truncate before truncate on ops.feature_flag
  for each statement execute function ops.reject_truncate();

-- OFF by default: role-based readiness does NOT govern until PR-2b enables it.
insert into ops.feature_flag (flag_key, enabled, notes)
values ('role_based_readiness', false,
  'PR-2a: role-based risk-tiered readiness is INERT until PR-2b (packet-builder + risk-routing + product-QA prompt). OFF => legacy 001 both-required governs.')
on conflict (flag_key) do nothing;

-- The gate reader. STABLE + search_path pinned (catalog-fenced by the tests).
create or replace function ops.role_based_readiness_enabled()
returns boolean
language sql
stable
set search_path = ops, pg_catalog
as $$
  select coalesce((select enabled from ops.feature_flag where flag_key = 'role_based_readiness'), false);
$$;

-- =============================================================================
-- VIEW ops.verdict_reviewer — HISTORICAL SURFACING (no rewrite). Surfaces every 001 verdict
-- with the registry metadata for its reviewer principal, via reviewer_registry.principal_alias.
-- verdict.reviewer (typed ops.principal) is UNTOUCHED — this is a read-only join, so old
-- evidence surfaces under registry identity while NO historical reviewer identity is relabelled.
-- security_invoker keeps RLS honest.
-- =============================================================================
create or replace view ops.verdict_reviewer
with (security_invoker = true) as
select
  v.id            as verdict_id,
  v.checkpoint_id,
  v.reviewed_commit_sha,
  v.reviewer      as legacy_principal,      -- the ORIGINAL, unaltered ops.principal
  v.verdict_type,
  v.verdict,
  v.state,
  rr.reviewer_key as registry_reviewer_key, -- the registry identity mapped from the principal
  rr.provider     as registry_provider,
  rr.model        as registry_model,
  rr.enabled      as reviewer_enabled
from ops.verdict v
left join ops.reviewer_registry rr on rr.principal_alias = v.reviewer;

comment on view ops.verdict_reviewer is
  'HISTORICAL SURFACING: joins each 001 verdict to its registry metadata via principal_alias. '
  'verdict.reviewer is UNTOUCHED — no historical reviewer identity is rewritten or relabelled. '
  'A LEFT JOIN so a verdict whose principal has no registry row still surfaces (registry_* null).';

-- =============================================================================
-- VIEW ops.checkpoint_role_readiness — MODEL-AGNOSTIC, RISK-TIERED merge readiness. REPLACES
-- 001's hardcoded both-reviewers rule for risk-tiered checkpoints (001's
-- checkpoint_merge_readiness stays INTACT for historical/back-compat rows). For each checkpoint
-- that has a checkpoint_assurance profile, readiness is computed from the REQUIRED ROLES + the
-- registry + active review_runs:
--   · a role is REQUIRED per checkpoint_assurance (product_qa / adversarial / security).
--   · a role is SATISFIED when the LATEST completed review_run for that role at THIS checkpoint's
--     head (via the packet) has outcome='approved'. (Latest wins — a later changes_requested
--     supersedes an earlier approve, mirroring 001's active-verdict semantics.)
--   · a role is AVAILABLE when at least one ENABLED registry reviewer is authorised for it.
--   · merge_ready  = every REQUIRED role is SATISFIED.
--   · blocked_reviewer_unavailable = some REQUIRED role is NOT satisfied AND has NO enabled
--     authorised reviewer — represented as BLOCKED, NEVER silently downgraded (correction #4).
-- This PROVES the old both-required rule cannot govern a risk-tiered checkpoint: a low-risk
-- checkpoint (only product_qa required) is merge_ready on product_qa ALONE, where 001's view
-- would demand BOTH correction_loop AND cold_final and wrongly report not-ready.
-- security_invoker keeps RLS honest.
-- =============================================================================
create or replace view ops.checkpoint_role_readiness
with (security_invoker = true) as
with role_avail as (
  -- Which roles have at least one ENABLED authorised reviewer right now.
  select rar.review_role, bool_or(rr.enabled) as available
  from ops.reviewer_authorised_role rar
  join ops.reviewer_registry rr on rr.reviewer_key = rar.reviewer_key
  group by rar.review_role
),
latest_run as (
  -- The LATEST completed run per (checkpoint, role) at the checkpoint's head, via the packet.
  select distinct on (p.checkpoint_id, r.review_role)
    p.checkpoint_id,
    r.review_role,
    r.outcome
  from ops.review_run r
  join ops.review_packet p on p.id = r.review_packet_id
  where r.completed_at is not null
  order by p.checkpoint_id, r.review_role, r.completed_at desc, r.created_at desc, r.id desc
)
select
  ca.checkpoint_id,
  ca.build_id,
  c.head_sha,
  -- product_qa
  ca.product_qa_required,
  coalesce((select lr.outcome = 'approved' from latest_run lr
             where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'product_qa'), false)
    as product_qa_satisfied,
  coalesce((select ra.available from role_avail ra where ra.review_role = 'product_qa'), false)
    as product_qa_available,
  -- adversarial_assurance
  ca.adversarial_review_required,
  coalesce((select lr.outcome = 'approved' from latest_run lr
             where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'adversarial_assurance'), false)
    as adversarial_satisfied,
  coalesce((select ra.available from role_avail ra where ra.review_role = 'adversarial_assurance'), false)
    as adversarial_available,
  -- security_assurance
  ca.security_review_required,
  coalesce((select lr.outcome = 'approved' from latest_run lr
             where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'security_assurance'), false)
    as security_satisfied,
  coalesce((select ra.available from role_avail ra where ra.review_role = 'security_assurance'), false)
    as security_available,
  ca.warwick_approval_required,
  ca.auto_merge_eligible,
  -- ALL required roles satisfied?
  (
    (not ca.product_qa_required or coalesce((select lr.outcome = 'approved' from latest_run lr
       where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'product_qa'), false))
    and
    (not ca.adversarial_review_required or coalesce((select lr.outcome = 'approved' from latest_run lr
       where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'adversarial_assurance'), false))
    and
    (not ca.security_review_required or coalesce((select lr.outcome = 'approved' from latest_run lr
       where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'security_assurance'), false))
  ) as all_required_roles_satisfied,
  -- Is a REQUIRED role unsatisfiable because no enabled reviewer can fill it? (fail-closed)
  (
    (ca.product_qa_required
       and not coalesce((select lr.outcome = 'approved' from latest_run lr
              where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'product_qa'), false)
       and not coalesce((select ra.available from role_avail ra where ra.review_role = 'product_qa'), false))
    or
    (ca.adversarial_review_required
       and not coalesce((select lr.outcome = 'approved' from latest_run lr
              where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'adversarial_assurance'), false)
       and not coalesce((select ra.available from role_avail ra where ra.review_role = 'adversarial_assurance'), false))
    or
    (ca.security_review_required
       and not coalesce((select lr.outcome = 'approved' from latest_run lr
              where lr.checkpoint_id = ca.checkpoint_id and lr.review_role = 'security_assurance'), false)
       and not coalesce((select ra.available from role_avail ra where ra.review_role = 'security_assurance'), false))
  ) as blocked_reviewer_unavailable
from ops.checkpoint_assurance ca
join ops.checkpoint c on c.id = ca.checkpoint_id;

comment on view ops.checkpoint_role_readiness is
  'MODEL-AGNOSTIC risk-tiered merge readiness from checkpoint_assurance required ROLES + the '
  'reviewer registry + latest completed review_runs. all_required_roles_satisfied = merge-ready. '
  'blocked_reviewer_unavailable = a required role has no enabled authorised reviewer -> BLOCKED, '
  'never silently downgraded. REPLACES 001''s hardcoded both-reviewers rule for risk-tiered '
  'checkpoints (001''s checkpoint_merge_readiness is retained INTACT for historical rows). '
  'auto_merge_eligible is surfaced but is SEPARATE from readiness (explicit, never inferred).';

-- =============================================================================
-- VIEW ops.checkpoint_effective_readiness — THE GOVERNING readiness read model, FEATURE-GATED
-- (Warwick correction B). By DEFAULT (role_based_readiness flag OFF) it delegates to 001's
-- LEGACY both-required policy — so nothing changes for historical/live readiness. ONLY when
-- PR-2b flips the flag ON does the role-based policy govern. This is how the role-based logic is
-- ADDED but INERT: it is advisory (checkpoint_role_readiness) until the gate is enabled, and even
-- then this is a READ MODEL — the ACTIVE merge_gate enforcement trigger (001) is untouched.
--   flag OFF -> effective_merge_ready = legacy both_reviewers_approved_this_head (001, unchanged)
--   flag ON  -> effective_merge_ready = role-based all_required_roles_satisfied AND not blocked
-- security_invoker keeps RLS honest.
-- =============================================================================
create or replace view ops.checkpoint_effective_readiness
with (security_invoker = true) as
select
  c.id                                as checkpoint_id,
  c.build_id,
  c.head_sha,
  ops.role_based_readiness_enabled()  as role_based_active,
  case when ops.role_based_readiness_enabled() then 'role_based' else 'legacy_both_required' end
                                      as governing_policy,
  case
    when ops.role_based_readiness_enabled()
      then coalesce(rr.all_required_roles_satisfied, false)
           and not coalesce(rr.blocked_reviewer_unavailable, false)
    else coalesce(lr.both_reviewers_approved_this_head, false)
  end                                 as effective_merge_ready,
  -- advisory columns from BOTH policies (for the cockpit's "why (not) ready" explainer)
  lr.both_reviewers_approved_this_head as legacy_both_reviewers_approved,
  rr.all_required_roles_satisfied      as role_based_all_required_satisfied,
  coalesce(rr.blocked_reviewer_unavailable, false) as role_based_blocked_reviewer_unavailable
from ops.checkpoint c
left join ops.checkpoint_merge_readiness lr on lr.checkpoint_id = c.id
left join ops.checkpoint_role_readiness  rr on rr.checkpoint_id = c.id;

comment on view ops.checkpoint_effective_readiness is
  'GOVERNING readiness read model, FEATURE-GATED (PR-2a). Default (flag OFF) delegates to 001''s '
  'legacy both-required policy — role-based readiness is INERT until PR-2b flips '
  'ops.feature_flag[role_based_readiness]. Even ON this is a read model; the active merge_gate '
  'enforcement trigger (001) is unchanged. DO NOT wire the role-based path into an active gate here.';

-- =============================================================================
-- SECURITY GATE — RLS deny-by-default, FORCED. DO NOT WEAKEN. (Mirrors 001/002/003.)
-- Enable + FORCE RLS on EVERY new table; grant + policy the server-side service_role ONLY.
-- anon/authenticated get NEITHER a grant NOR a policy.
--   reviewer_registry        : SELECT+INSERT+UPDATE, NO DELETE (retire via enabled=false; guard).
--   reviewer_authorised_role : SELECT+INSERT+DELETE (grants revocable; FK protects used grants).
--   checkpoint_assurance     : SELECT+INSERT+UPDATE, NO DELETE (recompute in place; guard).
--   review_packet            : SELECT+INSERT+UPDATE, NO DELETE (state transitions; guard freezes
--                              a hashed packet; DELETE guarded).
--   review_run               : SELECT+INSERT only (append-only immutable evidence).
--   review_run_finding       : SELECT+INSERT only (append-only immutable evidence).
-- =============================================================================
alter table ops.reviewer_registry        enable row level security;
alter table ops.reviewer_authorised_role enable row level security;
alter table ops.checkpoint_assurance     enable row level security;
alter table ops.review_packet            enable row level security;
alter table ops.review_run               enable row level security;
alter table ops.review_run_finding       enable row level security;
alter table ops.feature_flag             enable row level security;

alter table ops.reviewer_registry        force row level security;
alter table ops.reviewer_authorised_role force row level security;
alter table ops.checkpoint_assurance     force row level security;
alter table ops.review_packet            force row level security;
alter table ops.review_run               force row level security;
alter table ops.review_run_finding       force row level security;
alter table ops.feature_flag             force row level security;

grant usage on schema ops to service_role;

-- Durable identity / decision records: NO DELETE (retire/recompute in place; guards enforce).
grant select, insert, update on ops.reviewer_registry to service_role;
grant select, insert, update on ops.checkpoint_assurance to service_role;
grant select, insert, update on ops.review_packet to service_role;
-- Feature flag: toggle-only (NO DELETE; flag_key immutable via guard).
grant select, insert, update on ops.feature_flag to service_role;
-- Role grants: revocable (FK ON DELETE NO ACTION protects grants a run already used).
grant select, insert, delete on ops.reviewer_authorised_role to service_role;
-- Append-only immutable review evidence: SELECT + INSERT only.
grant select, insert on ops.review_run, ops.review_run_finding to service_role;

grant usage, select on all sequences in schema ops to service_role;
grant select on ops.verdict_reviewer, ops.checkpoint_role_readiness,
  ops.checkpoint_effective_readiness to service_role;

-- G10 (carried): default-deny function EXECUTE. New functions get PUBLIC execute by default;
-- revoke it. Every TRIGGER function this migration adds fires regardless of grant (Postgres does
-- not privilege-check trigger invocation). ops.role_based_readiness_enabled() is a plain function
-- called by the effective-readiness view (security_invoker), so it needs an explicit grant.
revoke execute on all functions in schema ops from public;
grant execute on function ops.role_based_readiness_enabled() to service_role;

-- One permissive FOR ALL policy per new table, scoped TO service_role. Idempotent.
do $$
declare t text;
begin
  foreach t in array array[
    'reviewer_registry','reviewer_authorised_role','checkpoint_assurance',
    'review_packet','review_run','review_run_finding','feature_flag'
  ] loop
    execute format('drop policy if exists service_role_all_%1$s on ops.%1$s', t);
    execute format(
      'create policy service_role_all_%1$s on ops.%1$s for all to service_role using (true) with check (true)',
      t);
  end loop;
end
$$;

-- --------------------------------------------------------------------------
-- SEED — Codex and Fable as REGISTRY ROWS (not special cases), with today's role grants
-- (correction #4: Codex->product_qa, Fable->adversarial_assurance). principal_alias maps each
-- onto its legacy ops.principal so historical verdict evidence surfaces via ops.verdict_reviewer.
-- Idempotent (on conflict do nothing) — a re-apply never disturbs an operator's config edits.
-- A FUTURE reviewer (e.g. grok) is added the SAME way: one row here (or by config) + one grant,
-- NO schema/enum change. NOTE: 'grok' is deliberately NOT seeded — it is not architecture.
-- --------------------------------------------------------------------------
insert into ops.reviewer_registry (reviewer_key, provider, model, adapter_identity, principal_alias, honest_label, enabled)
values
  ('gpt_codex', 'openai', 'gpt-codex', 'adapter://codex', 'gpt_codex',
     'OpenAI Codex — correction-loop / product-QA reviewer. NEVER relabel xAI/Grok.', true),
  ('fable',     'fable',  'fable-cold-final', 'adapter://fable', 'fable',
     'Fable — cold-final adversarial reviewer.', true)
on conflict (reviewer_key) do nothing;

insert into ops.reviewer_authorised_role (reviewer_key, review_role)
values
  ('gpt_codex', 'product_qa'),
  ('fable',     'adversarial_assurance')
on conflict (reviewer_key, review_role) do nothing;
