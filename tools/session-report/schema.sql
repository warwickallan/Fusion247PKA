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
