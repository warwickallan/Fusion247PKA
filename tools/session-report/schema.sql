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
