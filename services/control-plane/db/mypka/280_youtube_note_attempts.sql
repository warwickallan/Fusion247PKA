-- =============================================================================
-- MyPKA cockpit migration 280 — YouTube standalone-note attempts (BUILD-002 WP2: automated Cairn note retry)
--
-- The standalone knowledge note is now generated automatically (headless Cairn/Sonnet) right after extraction,
-- instead of being authored in-session. Generation can fail transiently (model call, incomplete note) — that
-- failure must be EXPLICIT + retryable without re-extracting. This adds a bounded-retry counter: the watcher
-- (re)generates the note for an extracted-but-noteless row (raw_path not null AND note_path null) up to a cap,
-- then stops nudging on it. A COMPLETE row (note_path not null) is never regenerated. Idempotent; teardown-cascade.
-- =============================================================================
alter table cockpit.youtube_source add column if not exists note_attempts integer not null default 0;
