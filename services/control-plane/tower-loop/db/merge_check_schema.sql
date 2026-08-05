-- WP-2F Tower — MERGE-CHECK run/message schema (SQLite, WAL). One canonical store.
-- Applied by apply.mjs -> applyMergeCheckSchema(); both merge-check entrypoints apply it on
-- startup (idempotent), exactly as watcher.mjs re-applies the other five on boot.
--
-- WHERE THIS DDL CAME FROM. It lived INLINE, in Postgres dialect, inside
-- tower/merge-check.mjs::ensureSchema() — `create schema if not exists tower` plus two
-- `create table if not exists` statements. That was the only definition of these two tables and
-- it ran against Supabase. It is deleted there and lives here, so the merge-check tables are
-- provisioned by the same applier pattern as every other table in this subsystem and there is
-- exactly ONE place the shape is stated.
--
-- SQLite has no `create schema`. The `tower` name is an ATTACHed database alias supplied by
-- db.mjs::openDb(), which is why every statement below can keep the `tower.` prefix the SQL
-- literals in this subsystem already use, and why the schema-creation statement has no
-- counterpart and needs none.
--
-- SQLite quirks carried over from WO-TW-01, both already paid for on this estate:
--   * in DDL the schema qualifier goes on the INDEX name, never on the table it indexes —
--     `create index tower.x on merge_check_run (...)`, never `on tower.merge_check_run`;
--   * `uuid`/`timestamptz`/`int` become text/text/integer, and the uuid default is generated
--     in SQL (same expression as db/post_schema.sql) so `insert ... returning id` still works.
--
-- NO BOOLEAN COLUMN EXISTS HERE, deliberately and explicitly. db.mjs coerces booleans out by
-- COLUMN NAME from a frozen set, and adding a boolean column without registering its name there
-- is a quiet false green. There is nothing to register for these two tables: `rounds` and
-- `pr_number` are counts, `status` is text. Stated so nobody "fixes" a boolean into existence.
-- `created_at`/`updated_at` ARE timestamp columns and are ALREADY in db.mjs's TIMESTAMP_COLUMNS,
-- so they rehydrate to Date on the way out with no change to that file.

create table if not exists tower.merge_check_run (
  id          text primary key default (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),

  pr_number   integer,          -- null in local (--wp) mode
  build_ref   text,
  wp_ref      text,
  head_sha    text,

  -- 'open' | 'blocked' | 'ready' | 'ready_to_merge' | 'changes_requested' | 'commented'
  -- | 'needs_warwick'. Deliberately NOT a CHECK constraint: the two entrypoints write
  -- overlapping but different vocabularies and a CHECK here would fail a run CLOSED on a
  -- vocabulary mismatch rather than on anything about the merge.
  status      text not null default 'open',
  rounds      integer not null default 0,

  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- The two lookup paths the entrypoints actually take, both `... and status='open' order by
-- created_at`: tower-loop/mergeCheck.mjs resumes on (pr_number, head_sha); tower/merge-check.mjs
-- keys on pr_number in PR mode and on wp_ref in local mode (never on head_sha, which changes
-- every corrective commit and would reset the round count).
create index if not exists tower.merge_check_run_pr_idx
  on merge_check_run (pr_number, head_sha, created_at) where status = 'open';
create index if not exists tower.merge_check_run_wp_idx
  on merge_check_run (wp_ref, created_at) where status = 'open';

create table if not exists tower.merge_check_message (
  id          text primary key default (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),

  run_id      text not null references merge_check_run(id) on delete cascade,
  seq         integer not null,
  sender      text not null check (sender in ('larry','gpt_codex')),
  round       integer not null,
  status      text,
  text        text not null,
  head_sha    text,

  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- Ordering within a run is the audit trail; a duplicate seq would make the exchange
  -- unreadable. Carried over verbatim from the Postgres original.
  unique (run_id, seq)
);
