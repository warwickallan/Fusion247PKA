// BUILD-002 WP2 — pure SQL for the cockpit.youtube_source SUCCESS-path upsert (no DB, no env, no side
// effects) so both the poller (watch-captures.mjs) and the regression test import the EXACT statement.
//
// TQA-006 fix — previously the success path used `on conflict (video_id) do nothing`, so a video that
// FAILED once (leaving a partial row: raw_path NULL + placeholder title/brief + extract_attempts>0) then
// SUCCEEDED kept the partial row forever: the real RAW/source pointers were never written and the source
// was effectively lost. This mirrors the spine's upsertSource: COALESCE fills the NULL RAW/source pointers
// WITHOUT overwriting valid existing values; title/brief supersede the failure placeholders only when the
// row had no RAW yet (a prior SUCCESS — raw present — is left untouched); note_path + extract_attempts are
// not touched (a prior success's note survives; the attempt counter is preserved).
export const YOUTUBE_SOURCE_SUCCESS_UPSERT = `
  insert into cockpit.youtube_source (video_id, title, source_url, channel, published, transcript_source, segment_count, captured_at, capture_id, review_state, note_path, raw_path, raw_sha256, brief_markdown, learning_count)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_created',NULL,$10,$11,$12,0)
  on conflict (video_id) do update set
    raw_path          = coalesce(cockpit.youtube_source.raw_path, excluded.raw_path),
    raw_sha256        = coalesce(cockpit.youtube_source.raw_sha256, excluded.raw_sha256),
    source_url        = coalesce(cockpit.youtube_source.source_url, excluded.source_url),
    channel           = coalesce(cockpit.youtube_source.channel, excluded.channel),
    published         = coalesce(cockpit.youtube_source.published, excluded.published),
    transcript_source = coalesce(cockpit.youtube_source.transcript_source, excluded.transcript_source),
    segment_count     = coalesce(cockpit.youtube_source.segment_count, excluded.segment_count),
    captured_at       = coalesce(cockpit.youtube_source.captured_at, excluded.captured_at),
    title             = case when cockpit.youtube_source.raw_path is null then excluded.title else cockpit.youtube_source.title end,
    brief_markdown    = case when cockpit.youtube_source.raw_path is null then excluded.brief_markdown else cockpit.youtube_source.brief_markdown end,
    updated_at        = now()`;
