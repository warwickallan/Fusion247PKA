-- =============================================================================
-- MyPKA cockpit migration 170 — "note pending" nudge tracking (BUILD-002 WP2, option C)
--
-- Warwick option C: a Telegram nudge when a YouTube link has been auto-extracted but its knowledge
-- note is not yet written (D-cairn: authored in-session). This column lets the watcher nudge EXACTLY
-- ONCE per pending video (set when the nudge is sent), so a 30s poll never spams. Cleared implicitly
-- once the note is authored (note_path becomes non-null, so the row no longer matches "pending").
-- Idempotent; reversed by teardown.sql (cockpit-schema cascade).
-- =============================================================================
alter table cockpit.youtube_source add column if not exists pending_nudged_at timestamptz;

-- cp_worker (the watcher's role, when used) may set the nudge stamp; the gateway/admin path also sets it.
do $$ begin
  if exists (select 1 from pg_roles where rolname='cp_worker') and to_regclass('cockpit.youtube_source') is not null then
    execute 'grant update (pending_nudged_at) on cockpit.youtube_source to cp_worker';
  end if;
end $$;
