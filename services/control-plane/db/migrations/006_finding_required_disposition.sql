-- =============================================================================
-- BUILD-014 PR-2b (disposition correction) — a FIRST-CLASS, TYPED home for the
-- reviewer-classification merge lever on ops.finding.
-- Migration: 006_finding_required_disposition                     (author: silas)
--
-- WHY THIS EXISTS (Warwick's explicit direction)
--   PR-2b's write-path (review/reviewClassification.mjs) carried the amendment's
--   `required_disposition` (the MERGE lever) + the `assumed_deployment_baseline` (R2)
--   inside the FREE-TEXT ops.finding.impact column, because there was nowhere typed to
--   put them. Free-text is not a governance surface: it cannot be indexed, cannot be a
--   CHECK target, and — worst — the readiness gate would have to PARSE authority out of
--   a prose blob. This migration gives the merge lever a DISTINCT, TYPED column so the
--   readiness view consumes an enum, never a substring.
--
--   KEY DISTINCTION (do NOT overload): the EXISTING ops.finding.disposition is the
--   LIFECYCLE resolution (unresolved/fixed/deferred/… — see 003, and its CHECK that a
--   newly-opened finding is disposition='unresolved'). That stays exactly as-is. The NEW
--   ops.finding.required_disposition is a SEPARATE axis — the amendment's merge authority
--   (BLOCKS_CURRENT_MERGE | REQUIRED_BEFORE_LIVE | … | NOTE_ONLY). Two different questions,
--   two different columns, two different enums. technical_impact stays mapped onto the
--   existing `severity`; reachability stays the existing `reachability` enum — both already
--   typed and already correct.
--
-- SCOPE (additive, three NULLABLE columns + one enum + a readiness-view replace):
--   ADDED:  enum ops.required_disposition; ops.finding.required_disposition (nullable),
--           ops.finding.assumed_deployment_baseline (nullable text),
--           ops.finding.classification_version (nullable text). A GUARDED integrity CHECK
--           (a typed disposition must cite a classification_version). A `create or replace`
--           of ops.checkpoint_effective_readiness (004) that CONSUMES the typed lever when
--           the role_based_readiness flag is ON — and is byte-for-byte the LEGACY path when OFF.
--   NOT here: no backfill of historical findings (legacy rows keep required_disposition NULL
--           behind the compatibility path); no deployment-registry subsystem (a dedicated
--           bounded field is enough); no change to 001/002/003/004 files.
--
-- LEGACY COMPATIBILITY (Warwick point 2): all three columns are NULLABLE. A pre-existing
--   finding is untouched — required_disposition stays NULL and is treated as a LEGACY row by
--   the readiness gate (it neither blocks nor fails closed). A NEW classifier-produced finding
--   is written by review/reviewClassification.mjs carrying ALL of classification_version +
--   required_disposition + assumed_deployment_baseline + technical_impact(severity) +
--   reachability. "Classifier-produced, current, material for a checkpoint" is recognised
--   STRUCTURALLY — the finding is linked to a review_run for that checkpoint via
--   ops.review_run_finding(relation='opened') — NOT by guessing from the impact text.
--
-- DEPENDS ON (applied in order): 001 (ops.finding_* not here; but ops.checkpoint,
--   ops.role_based_readiness_enabled is 004), 002, 003 (ops.finding, its guard, RLS + the
--   service_role UPDATE grant that already covers future columns), 004 (ops.review_packet,
--   ops.review_run, ops.review_run_finding, ops.checkpoint_role_readiness,
--   ops.checkpoint_merge_readiness (001), ops.role_based_readiness_enabled(),
--   ops.checkpoint_effective_readiness — which this file REPLACES via create-or-replace).
--   ADDITIVE — does NOT modify 001/002/003/004. Migration number 006 (NOT 005) deliberately
--   avoids colliding with the external-write outbox migration 005 on the parallel chain.
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD/hosted/live DB. !!
--   Target schema `ops`. Never touches `asdair`/personal data. A live apply is Larry-gated to
--   an ISOLATED dev database. Fully idempotent / re-runnable (enum guarded by DO-block,
--   `add column if not exists`, guarded `add constraint`, `create or replace` view).
--
-- !! SECURITY GATE — DO NOT WEAKEN !!
--   ops.finding already has RLS ENABLED + FORCED deny-by-default (003) and only service_role
--   holds SELECT/INSERT/UPDATE (no DELETE). A table-level UPDATE grant covers these NEW columns,
--   so NO new grant/policy is added or needed; anon/authenticated remain with NEITHER. The
--   readiness view is security_invoker (RLS honest), same as 004. No column stores a secret —
--   required_disposition is a closed enum, assumed_deployment_baseline is a bounded label, and
--   classification_version is a policy-version tag.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 001/003/004): the new enum
--   ops.required_disposition shares no name with any table.
-- =============================================================================

create schema if not exists ops;

-- --------------------------------------------------------------------------
-- ENUM ops.required_disposition — the amendment's MERGE-AUTHORITY axis. DELIBERATELY a
-- SEPARATE enum from ops.finding_disposition (the lifecycle axis). DO-block wrapped for
-- idempotency. Values verbatim from the reviewer-classification amendment (2026-07-19).
-- --------------------------------------------------------------------------
do $$ begin
  create type ops.required_disposition as enum (
    'BLOCKS_CURRENT_MERGE',                          -- blocks the CURRENT merge (the only structural blocker)
    'REQUIRED_BEFORE_LIVE',                          -- must be resolved before a live-apply path
    'REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS',  -- must be resolved before external/untrusted exposure
    'TRACKED_FOLLOWUP',                              -- tracked, non-blocking
    'NOTE_ONLY'                                      -- an observation; never blocks
  );
exception when duplicate_object then null; end $$;

comment on type ops.required_disposition is
  'BUILD-014 amendment MERGE-AUTHORITY axis for ops.finding. SEPARATE from the LIFECYCLE '
  'ops.finding_disposition. Only BLOCKS_CURRENT_MERGE structurally blocks the current merge; every '
  'other value is recorded + tracked + non-blocking. DO NOT overload the lifecycle disposition enum.';

-- --------------------------------------------------------------------------
-- ops.finding — three NULLABLE typed columns (legacy compatibility). The existing
-- finding_guard_mutation (003) freezes identity/authority (id/build_id/finding_ref/opened_by/
-- created_at/opened_at_sha) but leaves the triage/judgement fields mutable — these NEW columns
-- are triage fields, so re-triage (e.g. a later disposition change) is permitted, exactly like
-- severity/reachability/disposition today. `add column if not exists` is natively idempotent.
-- --------------------------------------------------------------------------
alter table ops.finding
  add column if not exists required_disposition ops.required_disposition;        -- [phase0] MERGE lever (nullable=legacy)
alter table ops.finding
  add column if not exists assumed_deployment_baseline text;                     -- [phase0] R2 stated baseline (bounded label)
alter table ops.finding
  add column if not exists classification_version text;                          -- [phase0] classifier policy version (non-legacy marker)

comment on column ops.finding.required_disposition is
  'The amendment MERGE-AUTHORITY (ops.required_disposition). NULLABLE: a legacy finding keeps it '
  'NULL behind the compatibility path (NOT backfilled). A classifier-produced finding carries it. '
  'Only BLOCKS_CURRENT_MERGE structurally blocks the current merge (see checkpoint_effective_readiness).';
comment on column ops.finding.assumed_deployment_baseline is
  'R2: the reviewer-stated "current authorised deployment" baseline the reachability claim is judged '
  'against. A dedicated bounded field — NOT a deployment-registry subsystem. NULLABLE (legacy).';
comment on column ops.finding.classification_version is
  'The classification policy version this finding was classified under. NULL on legacy findings; set '
  'on classifier-produced findings. Presence marks a non-legacy classification record.';

-- Integrity: a TYPED disposition must cite a classification_version (a merge-authority judgement is
-- only decision-grade with a known policy version). Guarded/idempotent add. This does NOT force a
-- classifier finding to carry a disposition — a classifier finding MISSING its required_disposition
-- (required_disposition NULL) remains REPRESENTABLE on purpose, so the readiness gate can FAIL CLOSED
-- on it rather than the constraint hiding it. It only rejects the inverse (disposition set, version
-- absent), and legacy rows (both NULL) pass unchanged.
do $$ begin
  alter table ops.finding
    add constraint finding_typed_disposition_needs_version_chk
    check (required_disposition is null or classification_version is not null);
exception when duplicate_object then null; end $$;

comment on constraint finding_typed_disposition_needs_version_chk on ops.finding is
  'A typed required_disposition must cite a classification_version. Legacy rows (both NULL) pass. A '
  'classifier finding MISSING its required_disposition (NULL) is intentionally still representable so '
  'the readiness gate FAILS CLOSED on it. DO NOT strengthen to require required_disposition NOT NULL.';

-- (No RLS/grant changes: ops.finding already has FORCED RLS + a service_role SELECT/INSERT/UPDATE
--  grant from 003; a table-level UPDATE grant covers these new columns. anon/authenticated: NEITHER.)

-- =============================================================================
-- VIEW ops.checkpoint_effective_readiness — REPLACED to CONSUME the typed merge lever.
-- (create-or-replace: the existing 9 output columns keep their names/types/order; TWO advisory
--  columns are APPENDED at the end — the only shape change create-or-replace permits.)
--
-- FLAG OFF (default): byte-for-byte the LEGACY 001 both-required policy — the disposition lever is
--   INERT (advisory columns are still surfaced, but effective_merge_ready ignores them). Historical
--   readiness is unchanged. DO NOT let the lever leak into the OFF path.
-- FLAG ON: role-based governs, AND the typed lever now blocks structurally:
--   · a CURRENT MATERIAL finding (open, opened by a review_run for THIS checkpoint) with
--     required_disposition = BLOCKS_CURRENT_MERGE  -> NOT merge-ready (blocks);
--   · other dispositions do NOT block the current merge by themselves;
--   · a CURRENT MATERIAL classifier-produced finding MISSING its required_disposition (NULL on a
--     finding a review_run OPENED for this checkpoint) -> FAIL CLOSED (not ready);
--   · LEGACY findings (never linked to a review_run) are OUT of scope — they neither block nor fail
--     closed, so they stay behind the compatibility path.
-- "Current material for checkpoint C" is recognised STRUCTURALLY: finding <- review_run_finding
--   (relation='opened') <- review_run <- review_packet(checkpoint_id = C). No impact-text parsing.
-- security_invoker keeps RLS honest.
-- =============================================================================
create or replace view ops.checkpoint_effective_readiness
with (security_invoker = true) as
with checkpoint_open_disposition as (
  -- Per checkpoint: does an OPEN, classifier-opened finding block, or is one missing its disposition?
  select
    p.checkpoint_id,
    bool_or(f.required_disposition = 'BLOCKS_CURRENT_MERGE') as has_blocking_finding,
    bool_or(f.required_disposition is null)                  as has_unclassified_finding
  from ops.review_run_finding rrf
  join ops.review_run r    on r.id = rrf.review_run_id
  join ops.review_packet p on p.id = r.review_packet_id
  join ops.finding f       on f.id = rrf.finding_id
  where rrf.relation = 'opened'
    and f.state = 'open'
  group by p.checkpoint_id
)
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
           -- the TYPED merge lever: a current BLOCKS_CURRENT_MERGE finding blocks; a classifier
           -- finding MISSING its required_disposition fails closed. Both fold in ONLY when ON.
           and not coalesce(cod.has_blocking_finding, false)
           and not coalesce(cod.has_unclassified_finding, false)
    else coalesce(lr.both_reviewers_approved_this_head, false)
  end                                 as effective_merge_ready,
  -- advisory columns from BOTH policies (for the cockpit's "why (not) ready" explainer)
  lr.both_reviewers_approved_this_head as legacy_both_reviewers_approved,
  rr.all_required_roles_satisfied      as role_based_all_required_satisfied,
  coalesce(rr.blocked_reviewer_unavailable, false) as role_based_blocked_reviewer_unavailable,
  -- NEW advisory columns (appended — the typed-lever signals; advisory when OFF, governing when ON)
  coalesce(cod.has_blocking_finding, false)      as role_based_disposition_blocked,
  coalesce(cod.has_unclassified_finding, false)  as role_based_unclassified_finding
from ops.checkpoint c
left join ops.checkpoint_merge_readiness lr on lr.checkpoint_id = c.id
left join ops.checkpoint_role_readiness  rr on rr.checkpoint_id = c.id
left join checkpoint_open_disposition   cod on cod.checkpoint_id = c.id;

comment on view ops.checkpoint_effective_readiness is
  'GOVERNING readiness read model, FEATURE-GATED (PR-2a) + CONSUMING the typed merge lever (006). '
  'Flag OFF (default) delegates byte-for-byte to 001 legacy both-required; the disposition lever is '
  'inert. Flag ON: role-based governs AND a current OPEN classifier finding with '
  'required_disposition=BLOCKS_CURRENT_MERGE blocks, while a current classifier finding MISSING its '
  'required_disposition FAILS CLOSED. Legacy findings (never review_run-linked) are out of scope. '
  'Even ON this is a read model; the active 001 merge_gate enforcement trigger is unchanged. '
  'role_based_disposition_blocked / role_based_unclassified_finding are advisory when OFF.';

grant select on ops.checkpoint_effective_readiness to service_role;
