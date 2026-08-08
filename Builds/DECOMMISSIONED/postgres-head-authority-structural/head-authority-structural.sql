-- ⛔ DECOMMISSIONED — REFERENCE ONLY. DO NOT APPLY THIS FILE TO ANY DATABASE.
--
-- This is a historical Supabase/Postgres alternative preserved as design capital during
-- BUILD-020 Sub-phase 4C estate reconciliation (Warwick, 2026-08-07). It is deliberately
-- NOT in any migrations directory and is NOT discovered by the migration runner, which
-- scans a specific directory only.
--
-- SQLite is the current canonical architecture. Reactivating this requires a NEW explicit
-- Warwick architecture decision and reconciliation against the then-current system.
-- Its original slot 003 is occupied on main by 003_contract_acceptance_schema.sql; it must
-- NOT be renumbered into the live sequence as-is. See README.md beside this file.
--
-- Partial by its author's own statement: "WIP: before-live-hardening partial
-- (agent stopped mid shared-tree race) — preserved for isolated re-run."

-- =============================================================================
-- BUILD-014 BEFORE-LIVE HARDENING — make the head-authority guarantees DB-STRUCTURAL
-- Migration: 003_head_authority_structural                          (author: mack)
--
-- WHY THIS EXISTS
--   WP-D0 (002) made "the authoritative current head" a real row (ops.build_head) and had the
--   JS gate (evaluatePolicyGate) refuse a non-current head. But Fable's adversarial probes showed
--   three guarantees were only JS-BOUNDARY-DEEP — a RAW SQL writer could still bypass them:
--     · P2: raw INSERT of a merge_gate bound to an OLD head (evaluatePolicyGate never ran).
--     · P3: raw UPDATE moved ops.build_head BACKWARD (the table had no monotonicity guard).
--     · Codex: the order key was wall-clock checkpoint.created_at — vulnerable to a clock STEP,
--            and to the "first-time-delivered old git head gets a newer created_at" surprise.
--   003 closes all three AT THE DATABASE so the bad states are UNREPRESENTABLE, not merely refused
--   by one code path (banked lesson: canonicalize at the boundary + bind durable state to the
--   authoritative identity; do not rely on every call site passing the right head).
--
-- WHAT 003 ADDS (all ADDITIVE — 001 and 002 files are UNTOUCHED; 003 create-or-replaces the two
-- 002 head-authority routines forward, the standard migration pattern, and adds new guards/columns)
--   (1) DB-STRUCTURAL REVIVE-BIND. A BEFORE INSERT trigger on ops.merge_gate (under the shared
--       ops.build_head_lock_key) REQUIRES a new gate's (checkpoint_id, expected_head_sha) to equal
--       ops.build_head's current tuple for that build — or permits it only when no build_head row
--       exists yet. "A gate bound to a non-current head" is now impossible to INSERT, even by raw SQL.
--   (2) DEFAULT-DENY build_head MONOTONICITY. A new BEFORE UPDATE trigger rejects ANY UPDATE that
--       does not move the order key STRICTLY FORWARD, and binds head_seq to the current checkpoint's
--       recorded arrival_seq (no free-set). A backward/in-place raw UPDATE is rejected at the table.
--   (3) PER-BUILD MONOTONIC SEQUENCE order key. ops.checkpoint.arrival_seq (set-once, assigned under
--       the advisory lock at first advance) REPLACES wall-clock created_at as the advance order key.
--       Ordering is now ARRIVAL-BASED — immune to clock steps and to created_at surprises — while a
--       redelivery stays a monotonic no-op (its checkpoint keeps its original, <= current, seq).
--
-- LOCK ORDER (deadlock-freedom preserved). Every head-authority path takes
-- ops.build_head_lock_key(build_id) as its OUTERMOST transaction-scoped advisory lock:
--     · advance_build_head : lock -> checkpoint row (arrival_seq set-once) -> build_head -> merge_gate
--     · evaluatePolicyGate : lock -> build_head (read) -> merge_gate (for update) -> [insert fires the
--                            bind trigger, which re-takes the SAME lock (reentrant) + reads build_head]
--     · merge_gate bind trigger (raw-insert path): lock -> build_head (read)
--   Because the outermost lock all of them acquire is the IDENTICAL per-build advisory key, they
--   fully SERIALISE per build — no AB-BA cycle is possible between build_head, checkpoint and
--   merge_gate rows. The nested (build,checkpoint,head) approve-vs-verdict-supersede advisory dance
--   from WP-A R4-3B is a DIFFERENT key taken LATER and is unchanged (advance's supersede sets the
--   decision to 'superseded', never 'approved', so it never enters that nested branch).
--
-- !! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD. Additive to the immutable, already-
--    merged 001 + 002. Idempotent / re-runnable (guarded throughout). Target schema `ops`; never
--    touches `asdair` or any personal/entrusted data. A live apply is Larry-gated to an ISOLATED
--    dev database. !!
-- =============================================================================

-- --------------------------------------------------------------------------
-- (3) ORDER-KEY COLUMNS.
--   · ops.checkpoint.arrival_seq — the per-build monotonic ARRIVAL order key (set-once, assigned by
--     ops.advance_build_head under the build-scoped advisory lock). REPLACES wall-clock created_at
--     for advance ordering. Nullable: a checkpoint that has not yet been advanced has none.
--   · ops.build_head.head_seq — the arrival_seq of the CURRENT authoritative head; the value the
--     monotonicity guard enforces strictly-forward. Defaults to 0 so a pre-existing row (none in a
--     fresh apply) is well-formed; ops.advance_build_head always writes the real value.
-- --------------------------------------------------------------------------
alter table ops.checkpoint add column if not exists arrival_seq bigint;
alter table ops.build_head add column if not exists head_seq bigint not null default 0;

comment on column ops.checkpoint.arrival_seq is
  'BUILD-014 003: per-build monotonic ARRIVAL order key. Set-once by ops.advance_build_head under '
  'ops.build_head_lock_key. REPLACES wall-clock created_at for advance ordering (clock-step immune).';
comment on column ops.build_head.head_seq is
  'BUILD-014 003: arrival_seq of the current authoritative head. The build_head monotonicity guard '
  'requires every UPDATE to move this STRICTLY FORWARD and to equal the current checkpoint arrival_seq.';

-- Index supporting the per-build max(arrival_seq) next-seq read under the lock.
create index if not exists checkpoint_build_arrival_seq_idx
  on ops.checkpoint (build_id, arrival_seq);

-- --------------------------------------------------------------------------
-- (3a) SET-ONCE guard for checkpoint.arrival_seq. Complements the 001 identity guard (which freezes
-- id/build_id/checkpoint_ref/head_sha/created_at and permits this new column to move NULL->value).
-- Once assigned, arrival_seq can NEVER change — so the arrival order of a checkpoint is immutable
-- evidence, exactly like its head. search_path pinned (function-hijack fence, like every ops fn).
-- --------------------------------------------------------------------------
create or replace function ops.checkpoint_guard_arrival_seq()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
begin
  if old.arrival_seq is not null and new.arrival_seq is distinct from old.arrival_seq then
    raise exception 'ops.checkpoint.arrival_seq is set-once (monotonic arrival order key): it cannot change once assigned (attempted % -> %)', old.arrival_seq, new.arrival_seq
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists checkpoint_arrival_seq_set_once on ops.checkpoint;
create trigger checkpoint_arrival_seq_set_once
  before update on ops.checkpoint
  for each row execute function ops.checkpoint_guard_arrival_seq();

-- --------------------------------------------------------------------------
-- (3) ops.advance_build_head — REPLACES the 002 version to order on arrival_seq INSTEAD of
-- wall-clock created_at. Same signature, same grants, same fail-closed contract; only the order key
-- changes (+ it now stamps the arrival_seq). Ingress calls it in the same transaction as the
-- checkpoint upsert.
--
--   1. canonicalise the head at the boundary (ops.canonicalize_sha — refuses short/upper/padded);
--   2. take the build-scoped advisory lock FIRST (outermost — see LOCK ORDER);
--   3. confirm (build, checkpoint, head) is a recorded checkpoint (defense; the FK enforces it too);
--   4. ASSIGN the checkpoint's arrival_seq on first advance (set-once) from a per-build max()+1 —
--      race-free because the advisory lock serialises all advances for the build;
--   5. MONOTONIC advance: move the authority ONLY to a STRICTLY-HIGHER arrival_seq. A redelivery of
--      an old/current checkpoint carries its ORIGINAL (<= current) seq, so it is a NO-OP — the
--      revive-via-ingress path stays structurally closed, now clock-step immune;
--   6. on an actual advance, SUPERSEDE any live merge_gate bound to a DIFFERENT head (stale window).
-- --------------------------------------------------------------------------
create or replace function ops.advance_build_head(p_build_id uuid, p_checkpoint_id uuid, p_head_sha text)
returns ops.build_head
language plpgsql
set search_path = ops, pg_catalog
as $$
declare
  v_head    ops.git_sha := ops.canonicalize_sha(p_head_sha);   -- (1) canonicalise at the boundary
  v_cp_seq  bigint;
  v_cur     ops.build_head;
  v_result  ops.build_head;
begin
  -- (2) OUTERMOST lock: serialise all head-authority ops for this build (advance + evaluate + bind).
  perform pg_advisory_xact_lock(ops.build_head_lock_key(p_build_id));

  -- (3) The new head MUST be a recorded checkpoint of THIS build (defense-in-depth; the build_head
  -- composite FK enforces it structurally too). Fail-closed BEFORE assigning any sequence.
  perform 1 from ops.checkpoint c
    where c.build_id = p_build_id and c.id = p_checkpoint_id and c.head_sha = v_head;
  if not found then
    raise exception 'advance_build_head: (build %, checkpoint %, head %) is not a recorded checkpoint — refusing to make a non-existent head authoritative', p_build_id, p_checkpoint_id, v_head
      using errcode = 'check_violation';
  end if;

  -- (4) ASSIGN the arrival_seq on first advance (set-once). max()+1 per build is race-free under the
  -- advisory lock. This is the arrival order key that REPLACES wall-clock created_at.
  select arrival_seq into v_cp_seq from ops.checkpoint where id = p_checkpoint_id;
  if v_cp_seq is null then
    select coalesce(max(arrival_seq), 0) + 1 into v_cp_seq
      from ops.checkpoint where build_id = p_build_id;
    update ops.checkpoint set arrival_seq = v_cp_seq where id = p_checkpoint_id;
  end if;

  select * into v_cur from ops.build_head where build_id = p_build_id;
  if found then
    -- (5) MONOTONIC on the ARRIVAL sequence: advance only to a strictly-higher seq. A redelivery of
    -- an old/current checkpoint has its original seq (<= current) -> no-op (convergent, backward-proof).
    if v_cp_seq <= v_cur.head_seq then
      return v_cur;
    end if;
    update ops.build_head
       set current_checkpoint_id = p_checkpoint_id,
           current_head_sha      = v_head,
           head_seq              = v_cp_seq,
           advanced_at           = now()
     where build_id = p_build_id
     returning * into v_result;
  else
    insert into ops.build_head (build_id, current_checkpoint_id, current_head_sha, head_seq)
    values (p_build_id, p_checkpoint_id, v_head, v_cp_seq)
    returning * into v_result;
  end if;

  -- (6) Close the STALE WINDOW: supersede any LIVE gate bound to a DIFFERENT head. The merge_gate
  -- guard permits this pending/approved -> superseded transition (superseded_at set in the SAME
  -- update); require_reviewers is skipped for a non-'approved' new decision.
  update ops.merge_gate
     set fusion_policy_decision = 'superseded'::ops.fusion_policy_decision,
         superseded_at = now(),
         policy_reason = coalesce(policy_reason || ' | ', '')
           || 'superseded: authoritative head advanced to a new checkpoint (WP-D0/003)'
   where build_id = p_build_id
     and superseded_at is null
     and expected_head_sha <> v_head;

  return v_result;
end;
$$;

revoke execute on function ops.advance_build_head(uuid, uuid, text) from public;
grant execute on function ops.advance_build_head(uuid, uuid, text) to service_role;

-- --------------------------------------------------------------------------
-- (2) DEFAULT-DENY build_head MONOTONICITY guard (a SEPARATE, additive BEFORE UPDATE trigger — the
-- 002 build_head_guard_mutation is left untouched). We keep the table-guard approach (the brief's
-- preference) rather than revoking UPDATE from service_role + a SECURITY DEFINER sole writer,
-- because: (a) it matches every other ops table (service_role + trigger enforcement — uniform mental
-- model, no SECURITY DEFINER privilege-escalation surface); and (b) it is defense-in-depth that also
-- catches a BUGGY future writer, not only a malicious one — the right bar for a first-party plane.
--
-- Enforced on every UPDATE:
--   · head_seq MUST equal the recorded arrival_seq of new.current_checkpoint_id (the order key is
--     BOUND to the checkpoint, not free-settable) — so a raw writer cannot forge a high seq for an
--     old head, and cannot point the authority at a checkpoint that was never arrival-sequenced.
--   · head_seq MUST move STRICTLY FORWARD (new > old) — a backward/in-place UPDATE is rejected
--     (Fable probe P3). Legitimate advances always carry a strictly-higher arrival_seq.
-- (INSERT is intentionally not guarded here: build_id PK caps it at one row, the composite FK binds
-- the head to a real checkpoint, and ops.advance_build_head is the sole legitimate inserter — so the
-- INSERT path's integrity rests on those structural facts, while the repeated UPDATE path Fable
-- probed is table-guarded. This also preserves WP-D0 test 7's raw-second-insert -> 23505.)
-- --------------------------------------------------------------------------
create or replace function ops.build_head_guard_monotonic()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
declare v_cp_seq bigint;
begin
  select arrival_seq into v_cp_seq from ops.checkpoint where id = new.current_checkpoint_id;
  if v_cp_seq is null then
    raise exception 'ops.build_head: current checkpoint % has no arrival_seq — the authority may only point at an arrival-sequenced checkpoint (advance via ops.advance_build_head)', new.current_checkpoint_id
      using errcode = 'check_violation';
  end if;
  if new.head_seq is distinct from v_cp_seq then
    raise exception 'ops.build_head: head_seq (%) must equal the current checkpoint arrival_seq (%) — the order key is bound to the checkpoint, never free-set', new.head_seq, v_cp_seq
      using errcode = 'check_violation';
  end if;
  if new.head_seq <= old.head_seq then
    raise exception 'ops.build_head: the authoritative head advances STRICTLY FORWARD only — a backward/in-place UPDATE of the arrival order key (% -> %) is rejected (monotonic; supersede-forward only)', old.head_seq, new.head_seq
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists build_head_monotonic_guard on ops.build_head;
create trigger build_head_monotonic_guard
  before update on ops.build_head
  for each row execute function ops.build_head_guard_monotonic();

-- --------------------------------------------------------------------------
-- (1) DB-STRUCTURAL REVIVE-BIND. A BEFORE INSERT trigger on ops.merge_gate that makes "a gate bound
-- to a non-current head" UNREPRESENTABLE — not merely refused inside evaluatePolicyGate. Fable probe
-- P2 showed raw SQL could previously insert an old-head gate; this closes that at the DB.
--
-- Under the shared ops.build_head_lock_key (reentrant when evaluatePolicyGate already holds it; taken
-- fresh on a raw-insert path), the new gate's (checkpoint_id, expected_head_sha) MUST equal
-- ops.build_head's authoritative (current_checkpoint_id, current_head_sha) for the build — OR the
-- build has no build_head row yet (permitted: the very first gate before any head is recorded;
-- evaluatePolicyGate itself already refuses that path, and ingress records the head before any gate
-- in the real flow). Full-tuple bind (checkpoint_id AND head): a same-SHA/different-checkpoint gate
-- is also refused — the authority is a specific checkpoint, not just a SHA.
-- --------------------------------------------------------------------------
create or replace function ops.merge_gate_bind_current_head()
returns trigger
language plpgsql
set search_path = ops, pg_catalog
as $$
declare v_cur ops.build_head;
begin
  -- OUTERMOST lock: identical key to advance_build_head + evaluatePolicyGate, so the current-head
  -- read serialises against any concurrent advance (no TOCTOU between read and insert).
  perform pg_advisory_xact_lock(ops.build_head_lock_key(new.build_id));
  select * into v_cur from ops.build_head where build_id = new.build_id;
  if not found then
    return new;   -- no authority row yet for this build: permitted (documented allowance above)
  end if;
  if new.expected_head_sha is distinct from v_cur.current_head_sha
     or new.checkpoint_id  is distinct from v_cur.current_checkpoint_id then
    raise exception 'ops.merge_gate: a gate may only be born for the AUTHORITATIVE current head of build % (current checkpoint %, head %); attempted (checkpoint %, head %) — this bind is DB-structural, not JS-boundary-only (before-live hardening)',
      new.build_id, v_cur.current_checkpoint_id, v_cur.current_head_sha, new.checkpoint_id, new.expected_head_sha
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists merge_gate_bind_current_head on ops.merge_gate;
create trigger merge_gate_bind_current_head
  before insert on ops.merge_gate
  for each row execute function ops.merge_gate_bind_current_head();
