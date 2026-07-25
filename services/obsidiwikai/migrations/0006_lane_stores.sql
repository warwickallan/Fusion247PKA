-- Real personal + task lane stores. Cairn routes to these; they DURABLY record the capture in the
-- private Supabase. Personal content is PRIVATE by rule (never git, never the encyclopedia) — this
-- schema definition carries no data. Downstream materialisation (Obsidian vault write / ClickUp
-- or Todoist sync) is the deferred step; the durable record is what makes the lane non-lossy now.
-- Idempotent; safe to re-run.

set search_path to obsidiwikai, public;

-- Personal lane — journals/reflections/health. One row per captured object (idempotent).
create table if not exists obsidiwikai.personal_entry (
  entry_id        uuid primary key default gen_random_uuid(),
  capture_id      text not null unique,
  privacy_domain  text not null default 'personal',
  subject         text,
  body            text,
  source_type     text,
  source_id       text,
  synced_to_vault boolean not null default false,   -- Obsidian-vault materialisation is deferred
  created_at      timestamptz not null default now()
);

-- Task lane — reminders/todos. Durable record; external sync (ClickUp/Todoist) deferred.
create table if not exists obsidiwikai.task_item (
  task_id      uuid primary key default gen_random_uuid(),
  capture_id   text not null unique,
  title        text not null,
  detail       text,
  due_hint     text,
  source_type  text,
  source_id    text,
  synced_ref   text,                                 -- external system id once synced (deferred)
  state        text not null default 'open',         -- open | done | dropped
  created_at   timestamptz not null default now()
);
