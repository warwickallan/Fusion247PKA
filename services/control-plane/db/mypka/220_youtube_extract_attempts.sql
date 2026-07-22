-- =============================================================================
-- MyPKA cockpit migration 220 — YouTube extraction attempts (BUILD-002 QA2-A finding: retry availability)
--
-- A failed extraction used to create a youtube_source row that then permanently SUPPRESSED retry (every
-- scan skipped any existing row). This adds a bounded-retry counter: the watcher retries a failed/partial
-- row (raw_path null) up to a cap, then stops (a genuinely caption-less video shouldn't be re-hammered).
-- A COMPLETE row (raw_path not null) is never re-extracted. Idempotent; reversed by teardown (cascade).
-- =============================================================================
alter table cockpit.youtube_source add column if not exists extract_attempts integer not null default 0;
