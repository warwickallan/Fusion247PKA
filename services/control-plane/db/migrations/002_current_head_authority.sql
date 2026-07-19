-- =============================================================================
-- BUILD-014 WP-D0 — AUTHORITATIVE CURRENT HEAD per build (Postgres DDL)
-- Migration: 002_current_head_authority                           (author: mack)
--
-- WHY THIS EXISTS
--   WP-C left two coupled gaps in the SAME head-binding bug class WP-014 exists to kill:
--     1. STALE WINDOW. Ingress of a new head B created checkpoint B + its review job but did
--        NOT supersede head A's live ops.merge_gate. readLiveGate(build) therefore kept
--        returning head A as 'mergeable' until some later evaluation re-ran — a consumer (the
--        cockpit) reads a stale 'mergeable' for a head that has moved.
--     2. REVIVE-OLD-HEAD. evaluatePolicyGate trusted whatever {checkpointId, headSha} the
--        caller passed. An OUT-OF-ORDER review-job completion (a reclaimed/slow stale job for
--        head A completing AFTER head B is live) superseded the newer gate and re-inserted the
--        OLD head as live.
--
-- THE STRUCTURAL FIX (at the boundary, not per-call-site)
--   Establish ONE authoritative current head per build in the DB and bind the durable state to
--   the full identity tuple (build_id, checkpoint_id, canonical head):
--     · ops.build_head  — a SINGLE row per build (build_id PRIMARY KEY => "at most one
--       authoritative current head per build" is structural, not conventional). Its
--       (build_id, current_checkpoint_id, current_head_sha) COMPOSITE-FKs onto
--       checkpoint(build_id, id, head_sha), so the authoritative head is ALWAYS a real recorded
--       checkpoint head for THIS build — canonicalised by the ops.git_sha domain. A head that a
--       later '=' comparison would silently fail to match cannot even be stored (same kill as WP-A).
--     · ops.advance_build_head(build, checkpoint, head) — called by ingress IN THE SAME
--       TRANSACTION as the checkpoint upsert. MONOTONIC (advances only to a strictly-newer
--       checkpoint, so a redelivery of an old head can NEVER move the head backward — the
--       revive-via-ingress path is closed) and, when it advances, SUPERSEDES any live merge_gate
--       bound to a different head — closing the STALE WINDOW at the edge.
--     · The policy gate refuses (fail-closed) to create/keep-live a gate for any head that is NOT
--       the authoritative current head — closing the REVIVE-OLD-HEAD path regardless of caller.
--       (That refusal lives in gate/policyGate.mjs; this migration provides the authority + the
--       shared lock key it reads.)
--
-- LOCK ORDER (deadlock-freedom for advance vs evaluatePolicyGate)
--   Both head-authority paths take ops.build_head_lock_key(build_id) as a transaction-scoped
--   pg_advisory_xact_lock FIRST — before any row lock. advance_build_head takes it here; the JS
--   evaluatePolicyGate takes the IDENTICAL key (via this same function) before it locks the live
--   merge_gate row. Because the OUTERMOST lock both paths acquire is the same build-scoped
--   advisory lock, advance-vs-evaluate and advance-vs-advance and evaluate-vs-evaluate for one
--   build fully SERIALISE — no AB-BA cycle is possible between the build_head row and the
--   merge_gate row. This advisory lock sits OUTSIDE the existing (build, checkpoint, head)
--   approve-vs-verdict-supersede advisory dance from WP-A R4-3B (a different key, taken later and
--   nested), so it does not change that path's accepted residual clean-abort behaviour.
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD. Additive to the immutable,
--    already-merged 001; it does NOT modify 001. Idempotent / re-runnable (guarded throughout).
--    Target schema `ops`; never touches `asdair` or any personal/entrusted data. A live apply is
--    Larry-gated to an ISOLATED dev database. !!
-- =============================================================================

-- --------------------------------------------------------------------------
-- Shared build-scoped advisory-lock key. STABLE derivation so advance_build_head and the JS
-- evaluatePolicyGate serialise on the IDENTICAL key (both call THIS function — the derivation
-- is never duplicated by hand). Collisions across distinct builds only over-serialise (never
-- mis-serialise); acceptable. search_path pinned (function-hijack fence, like every ops function).
-- --------------------------------------------------------------------------
create or replace function ops.build_head_lock_key(p_build_id uuid)
returns bigint
language sql
immutable
set search_path = ops, pg_catalog
as $$ select hashtext($1::text)::bigint $$;

revoke execute on function ops.build_head_lock_key(uuid) from public;
grant execute on function ops.build_head_lock_key(uuid) to service_role;

-- --------------------------------------------------------------------------
-- ops.build_head — THE authoritative current head per build. ONE row per build.
--   · build_id PRIMARY KEY               => at most one authoritative current head per build.
--   · (build_id, current_checkpoint_id, current_head_sha) COMPOSITE-FK -> checkpoint
--       (build_id, id, head_sha)         => the current head is ALWAYS a real recorded checkpoint
--                                            head for THIS build (canonical by ops.git_sha domain).
--   · build_id FK -> build ON DELETE NO ACTION (a build with a head-authority row is undeletable,
--       like every other build FK in 001).
-- --------------------------------------------------------------------------
create table if not exists ops.build_head (
  build_id              uuid not null
    constraint build_head_pkey primary key
    constraint build_head_build_fkey references ops.build (id) on delete no action,
  current_checkpoint_id uuid not null,
  current_head_sha      ops.git_sha not null,               -- canonical exact head (domain-enforced)
  advanced_at           timestamptz not null default now(), -- when the head last moved
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Bind the authority to the FULL identity tuple: a current head that is not a recorded
  -- checkpoint of THIS build is a FK violation (23503), not a runtime state.
  constraint build_head_checkpoint_fkey
    foreign key (build_id, current_checkpoint_id, current_head_sha)
    references ops.checkpoint (build_id, id, head_sha) match simple on delete no action
);

comment on table ops.build_head is
  'BUILD-014 WP-D0: the single authoritative current head per build (build_id PK => at most one). '
  'Advanced ONLY via ops.advance_build_head (monotonic, boundary-canonicalised, gate-superseding). '
  'gate/policyGate.mjs reads this as the head authority and refuses gates for any non-current head.';

-- Guard: build_id + created_at are immutable; DELETE is rejected (the head advances in place,
-- it is never deleted — deleting it would orphan the authority). Only current_checkpoint_id /
-- current_head_sha / advanced_at / updated_at may change (all via advance_build_head, whose new
-- tuple is re-validated by the composite FK above).
create or replace function ops.build_head_guard_mutation()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ops.build_head is the authoritative head record: DELETE is rejected (the head advances in place, never deleted)'
      using errcode = 'restrict_violation';
  end if;
  if new.build_id <> old.build_id or new.created_at <> old.created_at then
    raise exception 'ops.build_head: build_id and created_at are immutable (a head-authority row belongs to exactly one build for its lifetime)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists build_head_immutable_guard on ops.build_head;
create trigger build_head_immutable_guard
  before update or delete on ops.build_head
  for each row execute function ops.build_head_guard_mutation();

-- Keep updated_at honest (shared toucher from 001).
drop trigger if exists build_head_touch_updated_at on ops.build_head;
create trigger build_head_touch_updated_at before update on ops.build_head
  for each row execute function ops.touch_updated_at();

-- TRUNCATE bypasses row triggers — guard it like the other authority/evidence tables.
drop trigger if exists build_head_no_truncate on ops.build_head;
create trigger build_head_no_truncate
  before truncate on ops.build_head
  for each statement execute function ops.reject_truncate();

-- --------------------------------------------------------------------------
-- ops.advance_build_head(build, checkpoint, head) — the BOUNDARY operation ingress calls in the
-- SAME transaction as the checkpoint upsert.
--
--   1. Canonicalise the head at the boundary (ops.canonicalize_sha — refuses short/upper/padded).
--   2. Take the build-scoped advisory lock FIRST (see LOCK ORDER above).
--   3. Confirm (build, checkpoint, head) is a recorded checkpoint (defense; the FK also enforces
--      it) and read its IMMUTABLE created_at as the monotonic order key.
--   4. MONOTONIC advance: move the authoritative head ONLY to a STRICTLY-NEWER checkpoint, ordered
--      by (created_at, checkpoint_id) lexicographically. A redelivery of an OLD or the CURRENT head
--      is therefore a NO-OP (idempotent/convergent) and can NEVER move the head backward — the
--      revive-via-ingress path is structurally closed.
--   5. On an actual advance, SUPERSEDE any LIVE merge_gate bound to a DIFFERENT head — closing the
--      stale window at the edge so a moved head's old gate can never keep reading 'mergeable'.
--
-- Returns the authoritative ops.build_head row (post-advance, or the unchanged current row on a
-- monotonic no-op). RAISES fail-closed on an unrecorded/ non-canonical (build, checkpoint, head).
-- --------------------------------------------------------------------------
create or replace function ops.advance_build_head(p_build_id uuid, p_checkpoint_id uuid, p_head_sha text)
returns ops.build_head
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  v_head        ops.git_sha := ops.canonicalize_sha(p_head_sha);   -- (1) canonicalise at the boundary
  v_new_created timestamptz;
  v_cur         ops.build_head;
  v_cur_created timestamptz;
  v_result      ops.build_head;
begin
  -- (2) OUTERMOST lock: serialise all head-authority ops for this build (advance + evaluate).
  perform pg_advisory_xact_lock(ops.build_head_lock_key(p_build_id));

  -- (3) The new head MUST be a recorded checkpoint of THIS build (defense-in-depth; the build_head
  -- composite FK enforces it structurally too). Its created_at is the immutable monotonic order key.
  select c.created_at into v_new_created
    from ops.checkpoint c
   where c.build_id = p_build_id and c.id = p_checkpoint_id and c.head_sha = v_head;
  if not found then
    raise exception 'advance_build_head: (build %, checkpoint %, head %) is not a recorded checkpoint — refusing to make a non-existent head authoritative', p_build_id, p_checkpoint_id, v_head
      using errcode = 'check_violation';
  end if;

  select * into v_cur from ops.build_head where build_id = p_build_id;

  if found then
    select c.created_at into v_cur_created
      from ops.checkpoint c where c.id = v_cur.current_checkpoint_id;
    -- (4) MONOTONIC: only advance to a STRICTLY-NEWER checkpoint. Redelivery of an old/current head
    -- is a no-op (no head move, no supersede) — convergent and backward-move-proof.
    if (v_new_created, p_checkpoint_id) <= (v_cur_created, v_cur.current_checkpoint_id) then
      return v_cur;
    end if;
    update ops.build_head
       set current_checkpoint_id = p_checkpoint_id,
           current_head_sha      = v_head,
           advanced_at           = now()
     where build_id = p_build_id
     returning * into v_result;
  else
    insert into ops.build_head (build_id, current_checkpoint_id, current_head_sha)
    values (p_build_id, p_checkpoint_id, v_head)
    returning * into v_result;
  end if;

  -- (5) Close the STALE WINDOW: supersede any LIVE gate bound to a DIFFERENT head. The
  -- merge_gate guard permits this pending/approved -> superseded transition (superseded_at set in
  -- the SAME update); require_reviewers is skipped for a non-'approved' new decision.
  update ops.merge_gate
     set fusion_policy_decision = 'superseded'::ops.fusion_policy_decision,
         superseded_at = now(),
         policy_reason = coalesce(policy_reason || ' | ', '')
           || 'superseded: authoritative head advanced to a new checkpoint (WP-D0)'
   where build_id = p_build_id
     and superseded_at is null
     and expected_head_sha <> v_head;

  return v_result;
end;
$$;

revoke execute on function ops.advance_build_head(uuid, uuid, text) from public;
grant execute on function ops.advance_build_head(uuid, uuid, text) to service_role;

-- --------------------------------------------------------------------------
-- SECURITY GATE (matches 001): RLS enabled + FORCED deny-by-default; service_role ONLY.
-- No DELETE grant (the head advances in place; it is never deleted).
-- --------------------------------------------------------------------------
alter table ops.build_head enable row level security;
alter table ops.build_head force  row level security;

grant select, insert, update on ops.build_head to service_role;

drop policy if exists service_role_all_build_head on ops.build_head;
create policy service_role_all_build_head on ops.build_head
  for all to service_role using (true) with check (true);
