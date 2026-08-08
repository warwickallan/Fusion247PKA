-- BUILD-020 rotation performance reporting — smallest schema.
-- Populated at /rotate from the same evidence as the Git Deliverable.
-- Markdown under Deliverables/ remains the human-readable durable report.
-- Supabase is a queryable mirror, not a second SSOT.

create schema if not exists session_report;

create table if not exists session_report.rotation (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_date date not null,
  branch text not null,
  closing_head text not null check (char_length(closing_head) = 40),
  map_path text not null,
  deliverable_path text not null,
  host text,                          -- e.g. grok-build | claude-code
  host_version text,
  elapsed_minutes numeric,
  total_context_tokens_in bigint,
  total_context_tokens_out bigint,
  parent_channel_available boolean,
  queued_messages integer,
  wo_first_dispatch_success integer,
  wo_amendments integer,
  wo_refusals integer,
  doc_lines_changed integer,
  product_lines_changed integer,
  allocation_product_pct numeric,
  allocation_admin_pct numeric,
  allocation_evidence_pct numeric,
  allocation_rework_pct numeric,
  allocation_waiting_pct numeric,
  unestablished jsonb not null default '[]'::jsonb,
  notes text,
  unique (closing_head, deliverable_path)
);

create table if not exists session_report.specialist_dispatch (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null references session_report.rotation(id) on delete cascade,
  specialist text not null,
  dispatches integer not null default 0,
  tokens_in bigint,
  tokens_out bigint,
  notes text
);

create index if not exists session_report_rotation_head_idx
  on session_report.rotation (closing_head);

comment on table session_report.rotation is
  'One row per /rotate close. Mirrors Deliverables/YYYY-MM-DD-session-performance-report.md';

-- ── Forward-only widening (WO-25 / Amendment 7) ──────────────────────────────────────────────────
-- The payload has been richer than this table for some time: total_subagent_tokens, the git stat
-- block, the work-order list and the findings list were all being produced and then discarded at
-- write time. These columns close that gap. Nothing here changes an existing column's type and
-- nothing here can invalidate an existing row:
--
--   * every added column is nullable, or has a default;
--   * ADD COLUMN IF NOT EXISTS makes the file re-runnable, which matters because populate.mjs
--     applies this whole file on every run;
--   * the (closing_head, deliverable_path) uniqueness above is untouched.
--
-- WHY wo_total IS STORED RATHER THAN COMPUTED. "0 of 2 Work Orders survived first read-back" needs a
-- real denominator. Deriving it from wo_first_dispatch_success + wo_amendments + wo_refusals would be
-- circular — those three are outcomes of the same orders, so a total derived from them could never
-- contradict them and could never reveal an order that produced none of the three. The denominator is
-- therefore carried in its own column, and a rotation whose denominator is genuinely unknown holds
-- NULL. NULL means "not established". It does not mean zero.
alter table session_report.rotation add column if not exists total_subagent_tokens bigint;
alter table session_report.rotation add column if not exists wo_total integer;
alter table session_report.rotation add column if not exists git_stat jsonb;
alter table session_report.rotation add column if not exists work_orders jsonb not null default '[]'::jsonb;
alter table session_report.rotation add column if not exists findings jsonb not null default '[]'::jsonb;

-- work_orders and findings follow the existing `unestablished` convention exactly (not null, default
-- '[]') rather than inventing a second one: an empty list is a real answer meaning "none recorded",
-- and it is a different statement from git_stat's NULL, which means "never measured". git_stat is
-- deliberately plain nullable jsonb for that reason.
comment on column session_report.rotation.total_subagent_tokens is
  'Sum of tokens consumed by dispatched specialists. NULL = not established, never 0.';
comment on column session_report.rotation.wo_total is
  'STORED denominator: how many NUMBERED Work Orders were dispatched. NULL = not established, never 0.';
comment on column session_report.rotation.git_stat is
  'The measured git stat block for the session range. NULL = never measured.';
comment on column session_report.rotation.work_orders is
  'Dispatch instances for the session, verbatim from the payload. [] = none recorded.';
comment on column session_report.rotation.findings is
  'Report findings, verbatim from the payload. [] = none recorded.';

-- ── Forward-only idempotency repair (WO-28) ──────────────────────────────────────────────────────
-- session_report.specialist_dispatch had NO uniqueness of any kind, so populate.mjs inserted
-- unconditionally and a re-run against the same payload duplicated every specialist row: the live
-- surface reported 30 dispatches where 15 is the truth. `rotation` never had this defect — it carries
-- unique (closing_head, deliverable_path) and the writer upserts onto it. This gives the child table
-- the same property, so the mirror described at line 4 stays a mirror across re-runs.
--
-- WHY A UNIQUE INDEX AND NOT A TABLE CONSTRAINT. Postgres has no
-- `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS`, and populate.mjs applies this ENTIRE FILE on every
-- run under ON_ERROR_STOP=1. A bare ADD CONSTRAINT would succeed exactly once and then abort every
-- subsequent /rotate with "constraint already exists" — converting today's silent duplication into a
-- hard failure of the rotation transaction, which is the worse of the two bugs. A unique index is
-- natively re-runnable via IF NOT EXISTS, is a valid `ON CONFLICT (rotation_id, specialist)`
-- inference target, and matches the `create index if not exists` form already used above.
create unique index if not exists session_report_specialist_dispatch_rotation_specialist_idx
  on session_report.specialist_dispatch (rotation_id, specialist);

-- The payload carries a measured per-specialist token TOTAL under the key `tokens`. This table had
-- nowhere to hold it, so every one of those measured values was discarded at write time, while
-- Amendment 7 requires the expanded view to show specialist token usage where established.
--
-- tokens_in / tokens_out DELIBERATELY KEEP WRITING NULL. They are genuinely absent from the payload,
-- absent is not zero, and splitting a measured total across an in/out pair would be a fabricated
-- number rather than a mirrored one. Three separate nullable columns state three separate true
-- things: the total is known, the split is not.
alter table session_report.specialist_dispatch add column if not exists tokens bigint;

comment on table session_report.specialist_dispatch is
  'One row per (rotation_id, specialist), enforced by a unique index. populate.mjs upserts onto that key and removes rows the payload no longer lists, so re-running the writer cannot change any count.';
comment on column session_report.specialist_dispatch.tokens is
  'Measured TOTAL tokens for this specialist in this rotation, verbatim from the payload. NULL = not established, never 0. NOT a sum of tokens_in/tokens_out — those are separately absent.';

-- ---------------------------------------------------------------------------
-- CAPAE — the learning loop's durable storage (BUILD-020 Sub-phase 4D)
-- ---------------------------------------------------------------------------
-- BANKED 2026-08-08, Buzz defect 2. These two tables were created directly against the live database
-- and never written down, so the CAPAE datastore could not be reconstructed from Git: a fresh
-- environment applying this file got a session_report schema the shipped code could not run against.
-- The DDL below was derived from the LIVE catalogue (columns, defaults, constraints, indexes), not
-- from memory, so applying it to an empty database produces the storage `capae-sync.mjs` and the
-- Cockpit's /api/capae actually require.
--
-- RE-RUNNABLE, like everything above it: populate.mjs applies this whole file on every rotation.

create table if not exists session_report.capae_family (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  title                     text not null,
  cause_class               text,
  finding                   text,
  latest_correction         text,
  root_cause                text,
  rca_status                text not null default 'UNESTABLISHED',
  rca_confidence            text,
  cause_detection_escape    jsonb not null default '{}'::jsonb,
  preventive_action         text,
  required_larry_behaviour  text,
  state                     text not null default 'MONITORING',
  exposures_clean           integer not null default 0,
  exposures_required        integer,
  effectiveness_note        text,
  unmeasurable              boolean not null default false,
  occurrences               integer not null default 0,
  first_seen_at             timestamptz not null default now(),
  last_occurrence_at        timestamptz,
  evidence_refs             jsonb not null default '[]'::jsonb,
  is_pilot                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists session_report.capae_occurrence (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references session_report.capae_family(id) on delete cascade,
  rotation_id  uuid references session_report.rotation(id) on delete set null,
  occurred_at  timestamptz not null default now(),
  disposition  text not null default 'RECURRENCE',
  summary      text,
  evidence_ref text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists capae_family_state_idx
  on session_report.capae_family (state);
create index if not exists capae_occurrence_family_idx
  on session_report.capae_occurrence (family_id, occurred_at desc);
create index if not exists capae_occurrence_rotation_idx
  on session_report.capae_occurrence (rotation_id);

-- DROP-THEN-ADD, not ADD CONSTRAINT IF NOT EXISTS (which Postgres does not have), for exactly the
-- reason spelled out for the specialist_dispatch index above: this file is applied on every run under
-- ON_ERROR_STOP=1, so a bare ADD would succeed once and then abort every subsequent rotation.
--
-- The occurrence CHECK is WIDENED here to carry 'UNMEASURABLE'. The live constraint listed only
-- NEW / RECURRENCE / CLEAN-EXPOSURE / NONE-THIS-SESSION, which is why an
-- `unmeasurable-at-this-frequency` exposure had nowhere truthful to land. 'NEW' is retained because
-- historical rows carry it; it is no longer producible from the exposure vocabulary.
alter table session_report.capae_family drop constraint if exists capae_family_state_check;
alter table session_report.capae_family add constraint capae_family_state_check
  check (state in ('MONITORING','EFFECTIVE','CHALLENGED','INEFFECTIVE','UNMEASURABLE'));

alter table session_report.capae_family drop constraint if exists capae_family_rca_status_check;
alter table session_report.capae_family add constraint capae_family_rca_status_check
  check (rca_status in ('ESTABLISHED','PARTIAL','UNESTABLISHED'));

alter table session_report.capae_family drop constraint if exists capae_family_rca_confidence_check;
alter table session_report.capae_family add constraint capae_family_rca_confidence_check
  check (rca_confidence in ('high','medium','low','none'));

alter table session_report.capae_occurrence drop constraint if exists capae_occurrence_disposition_check;
alter table session_report.capae_occurrence add constraint capae_occurrence_disposition_check
  check (disposition in ('NEW','RECURRENCE','CLEAN-EXPOSURE','NONE-THIS-SESSION','UNMEASURABLE'));

-- REPLAY SAFETY, ENFORCED BY THE DATABASE — and the KEY IS THE FINDING, NOT THE ROTATION.
--
-- ⚠️ The first version of this index was (family_id, rotation_id), and applying it to the live
-- database FAILED — correctly. Rotation a3e1982e legitimately carries TWO different occurrences of
-- `authority-inferred-from-desired-outcome`: a NEW one (PR #98 merged without authority) and a
-- RECURRENCE (Amendment 14's heading). Those are two distinct pieces of evidence that happen to
-- share a session. A per-rotation key would have silently destroyed one of them — turning a
-- double-count defect into an evidence-loss defect, which is worse.
--
-- `dedupe_key` is the identity of the FINDING (its disposition and summary), computed by the writer.
-- Re-running capae-sync.mjs over a rotation it has already processed therefore inserts nothing,
-- while a genuinely different finding in the same session still records.
--
-- PARTIAL because rotation_id is nullable and NULLs do not collide in a plain unique index — a sync
-- with no rotation id genuinely cannot be deduplicated, and the writer reports that in `unDedupable`
-- rather than pretending otherwise.
alter table session_report.capae_occurrence add column if not exists dedupe_key text;

create unique index if not exists capae_occurrence_replay_idx
  on session_report.capae_occurrence (family_id, rotation_id, dedupe_key)
  where rotation_id is not null and dedupe_key is not null;

comment on column session_report.capae_occurrence.dedupe_key is
  'Identity of the FINDING within a rotation (md5 of disposition + summary), written by capae-sync.mjs. Makes a replayed rotation a no-op WITHOUT collapsing two genuinely different occurrences that share a session.';

comment on table session_report.capae_family is
  'One row per failure family. occurrences / exposures_clean / state are DERIVED from capae_occurrence by tools/session-report/capae-sync.mjs (deriveFamily) and must never be incremented in place — that is what makes a replayed rotation a no-op.';
comment on column session_report.capae_family.exposures_clean is
  'Clean qualified exposures SINCE THE LAST FAILURE — the evidence supporting the CURRENT prevention, not a lifetime total. A recurrence resets it to 0, which is how a family that was EFFECTIVE returns to Larry''s active brief.';
comment on column session_report.capae_occurrence.disposition is
  'NEW and RECURRENCE are failures. CLEAN-EXPOSURE advances effectiveness. NONE-THIS-SESSION and UNMEASURABLE are recorded history that move no counter — they are the difference between "it did not happen" and "no chance arose".';
