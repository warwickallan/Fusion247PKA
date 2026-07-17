-- =============================================================================
-- BUILD-010 WP1 — Reliable Autonomous Governance Loop, delta migration
-- Migration: 0005_wp1_run_control_state                          (author: silas)
--
-- PROVENANCE — implements the shared convergence/interface contract:
--   Source of truth: Builds/CONVERGENCE-fusion-governance-interface.md
--     (§"Command grammar" — /status /trace /watch /pause /resume /stop /approve).
--   Requirement: the Telegram control surface needs DURABLE, RESTART-SAFE run-level
--            CONTROL STATE that the governance commands mutate and read. The commands
--            themselves arrive as `ftw.run_event` rows (kind = 'command:*') written by
--            the capture worker — that run_event IS the dedup/audit trail (primary
--            dedup on (source, source_event_id); see 0001). This migration therefore
--            adds NO command-audit table; it adds ONLY the run-level state the handlers
--            act upon:
--              * /pause  -> paused = true,  paused_at = now()
--              * /resume -> paused = false
--              * /watch  -> watch_level in (all | milestones | terminal)
--              * /stop   -> stop_requested = true, stop_requested_at = now()
--   Defect it forecloses: WITHOUT durable control state, a /pause or /stop that
--            arrives while a turn is in flight would live only in memory. A process
--            restart between "command received" and "loop honoured it" would silently
--            drop the human's intent — the loop would resume agent turns Warwick had
--            paused, or keep driving a run he asked to stop. Persisting the intent on
--            the run row makes it survive a restart and be read back verbatim by
--            /status.
--
-- SAFE-HALT BOUNDARY (loop-enforced, NOT enforced here):
--   /stop sets `stop_requested = true`. It is the LOOP — not this migration — that
--   halts at the next ATOMIC boundary and NEVER stops mid-write without recording
--   `outcome_unknown` (see 0003 external-write outbox + the convergence contract
--   §"Hard boundaries"). This migration only records the request durably.
--
-- WHY A NEW MIGRATION (not an edit to 0001–0004):
--   0001, 0002, 0003 and 0004 are committed, reviewed, and part of the WP0/WP1 proof
--   history — they are IMMUTABLE. This discrete 0005 delta only ADDS a new enum
--   (ftw.watch_level) and five columns to the EXISTING ftw.governance_run table. Apply
--   order is always 0001 -> 0002 -> 0003 -> 0004 -> 0005 on a clean DB.
--
-- ENUM-VS-TABLE COLLISION LESSON (carried from 0001/0003/0004): a table implicitly
-- creates a composite type of the same name, so NO enum may share a name with any
-- table. This migration adds enum `ftw.watch_level`; there is NO table named
-- watch_level, so there is no collision.
--
-- Supabase is DURABLE OPERATIONAL STATE, NOT the canonical Brain. Every column here
-- holds a control BOOLEAN or a TIMESTAMP — pointers / metadata, NEVER a secret and
-- NEVER governed content.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- RLS is UNCHANGED by this migration. ftw.governance_run already has Row-Level
-- Security ENABLED deny-by-default with a single service_role-only policy
-- (service_role_all_governance_run, migration 0001). The five new columns inherit
-- that posture automatically — a column add grants NOTHING new. This migration
-- adds NO grant, NO policy, and touches NO role. Do NOT add an anon/authenticated
-- policy, do NOT disable RLS, and do NOT relabel these control columns as anything
-- that could carry a secret — they are booleans + timestamps only.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Enumerated type: the run's notification verbosity (the /watch setting). Guarded
-- create so re-applying 0005 on an already-migrated DB is a no-op (`create type` is
-- not natively idempotent).
--   all         -- notify on every run transition            (/watch on)
--   milestones  -- notify on milestones only  (DEFAULT)       (/watch milestones)
--   terminal    -- notify on terminal outcomes only           (/watch off)
-- The command layer maps the Telegram grammar (on|milestones|off) onto these enum
-- values; the enum itself is the honest, durable vocabulary.
-- NB: `watch_level` is an ENUM; there is NO table by that name — no collision.
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ftw' and t.typname = 'watch_level'
  ) then
    create type ftw.watch_level as enum (
      'all',
      'milestones',
      'terminal'
    );
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- ftw.governance_run — ADD the five durable control-state columns. Each ADD is
-- guarded with `if not exists` so the whole migration is re-runnable (idempotent):
-- a second apply on an already-migrated DB is a clean no-op.
--
--   paused             -- /pause set it true, /resume set it false. The loop reads
--                      --   this and prepares no NEW agent turn while it is true.
--   watch_level        -- the /watch verbosity setting (enum above). Default
--                      --   'milestones' — the safe, low-noise middle.
--   paused_at          -- WHEN the run was paused (set by /pause, cleared on resume).
--   stop_requested     -- /stop set it true. The loop halts SAFELY at the next atomic
--                      --   boundary (never mid-write without outcome_unknown).
--   stop_requested_at  -- WHEN /stop was first requested (stamped once; idempotent).
--
-- NOT NULL + DEFAULT on `paused`, `watch_level`, `stop_requested` means every
-- existing row is backfilled to the safe posture (not paused, milestones, no stop)
-- and every future insert defaults the same way. The two *_at timestamps are
-- nullable — NULL means "never paused / never asked to stop".
-- --------------------------------------------------------------------------
alter table ftw.governance_run
  add column if not exists paused boolean not null default false;

alter table ftw.governance_run
  add column if not exists watch_level ftw.watch_level not null default 'milestones';

alter table ftw.governance_run
  add column if not exists paused_at timestamptz;

alter table ftw.governance_run
  add column if not exists stop_requested boolean not null default false;

alter table ftw.governance_run
  add column if not exists stop_requested_at timestamptz;

comment on column ftw.governance_run.paused is
  '/pause -> true, /resume -> false. DURABLE control state: the loop prepares no NEW '
  'agent turn while true. Survives a restart so a human pause is never silently lost.';

comment on column ftw.governance_run.watch_level is
  'The /watch notification verbosity (all | milestones | terminal). Default '
  'milestones. The command layer maps the Telegram grammar (on|milestones|off) here.';

comment on column ftw.governance_run.stop_requested is
  '/stop -> true. The LOOP (not this migration) halts SAFELY at the next atomic '
  'boundary and NEVER stops mid-write without recording outcome_unknown. DO NOT '
  'reinterpret this as an autonomous-merge or destructive signal.';

-- =============================================================================
-- SECURITY GATE (Vex) — RLS UNCHANGED. DO NOT WEAKEN.
-- No `enable/disable row level security`, no grant, no policy, no role change here.
-- ftw.governance_run keeps its 0001 posture: RLS enabled, deny-by-default, one
-- service_role-only policy. The five added columns inherit it. anon/authenticated
-- remain denied. Do NOT add a policy or grant to weaken this.
-- =============================================================================
