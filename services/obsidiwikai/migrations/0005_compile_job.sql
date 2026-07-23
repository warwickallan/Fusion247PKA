-- Learn lane → durable compile job. Cairn routing must not BLOCK on a (slow, costly) compile,
-- and a capture that Cairn decided to "learn" must not be lost if the compile crashes. So the
-- Learn adapter enqueues a durable job; a claim-safe worker runs the compiler asynchronously.
-- Unlike Honcho delivery, compile is idempotent (source-keyed upsert) → a crashed 'running' job
-- is SAFE to re-run, so stale jobs return to 'queued' (not a fail-safe hold).
-- Idempotent; safe to re-run.

set search_path to obsidiwikai, public;

create table if not exists obsidiwikai.compile_job (
  job_id       uuid primary key default gen_random_uuid(),
  capture_id   text not null unique,          -- one compile per captured object (idempotent)
  source_id    text,
  source_type  text,
  url          text,
  title        text,
  treatment    text not null default 'learn',  -- learn → extract | keep → keep_raw
  state        text not null default 'queued', -- queued | running | done | failed
  claimed_at   timestamptz,
  receipt      text,
  stats        jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists compile_job_state_idx on obsidiwikai.compile_job(state);
