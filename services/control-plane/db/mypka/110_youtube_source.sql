-- =============================================================================
-- MyPKA cockpit migration 110 — YouTube source knowledge page + learning candidates (BUILD-002 WP2)
--
-- Directus human-readable projection of a processed YouTube source (AC4/§10) + its suggested
-- learning candidates (§9/§14). Render-only for cp_directus (SELECT); the note body is Markdown so
-- Directus shows the actual brief, not a raw column. The Accept/Decline *decision* seam (WP3) reuses
-- the intent→worker→receipt pattern and is added separately — this migration is the readable surface.
--
-- Idempotent; reversible via teardown.sql (cockpit-schema cascade). No personal data (public YouTube
-- source knowledge only).
-- =============================================================================
create table if not exists cockpit.youtube_source (
  id               uuid primary key default gen_random_uuid(),
  build_id         text not null default 'BUILD-002',
  video_id         text not null unique,
  title            text not null,
  source_url       text,
  channel          text,
  published        text,
  transcript_source text,
  segment_count    int,
  captured_at      timestamptz,
  capture_id       text,                     -- the originating fcg capture
  review_state     text not null default 'ai_created'
                     check (review_state in ('ai_created','pending_warwick_review','approved','changes_requested')),
  note_path        text,                      -- governed vault note (git-tracked)
  raw_path         text,                      -- immutable RAW evidence dir
  raw_sha256       text,                      -- sha256 of the RAW packet report
  brief_markdown   text,                      -- the readable standalone knowledge note (rendered as Markdown)
  learning_count   int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table cockpit.youtube_source is
  'Readable Directus page for a processed YouTube source (BUILD-002 WP2). brief_markdown renders the '
  'standalone knowledge note; raw_path/raw_sha256 point at the immutable transcript evidence. Render-only.';

create table if not exists cockpit.learning_candidate (
  id               uuid primary key default gen_random_uuid(),
  build_id         text not null default 'BUILD-002',
  source_video_id  text,                      -- the youtube_source it came from
  candidate_ref    text,                      -- e.g. 'LC-1'
  recommendation   text not null,
  why              text,
  evidence         text,
  proposed_target  text,
  expected_effect  text,
  confidence       text,                      -- low | medium | high
  risk             text,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','declined','deferred')),
  correlation_id   text,
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table cockpit.learning_candidate is
  'Suggested learnings from a processed source (BUILD-002 WP2/WP3). Readable with evidence; Accept/'
  'Decline creates a governed decision via the intent seam (WP3), never a silent write. Render-only here.';

grant usage on schema cockpit to cp_directus;
grant select on cockpit.youtube_source, cockpit.learning_candidate to cp_directus;
