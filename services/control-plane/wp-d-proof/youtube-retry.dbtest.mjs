// BUILD-002 WP2/WP7 — TQA-006 regression proof against a THROWAWAY Postgres.
//   (run via run-youtube-retry-test.sh — provisions the cluster + sets PGPORT)
// Proves the poller retry path: a FAILED extraction leaves a partial youtube_source row (raw_path NULL,
// placeholder title/brief, extract_attempts>0); a LATER SUCCESS must FILL the RAW/source pointers +
// supersede the failure placeholders WITHOUT overwriting valid existing values, so downstream (note
// authoring / learning) can continue. Uses the EXACT statement the poller runs.
import pg from 'pg';
import { YOUTUBE_SOURCE_SUCCESS_UPSERT } from '../../hub/youtube/youtubeSourceSql.mjs';

const PORT = Number(process.env.PGPORT || 0);
if (!PORT) { console.error('set PGPORT (run via run-youtube-retry-test.sh)'); process.exit(2); }
const db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', database: 'postgres' });

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };
const VID = 'RETRYVID001';

// The poller's FAILURE-path insert (verbatim) — leaves the partial row.
const FAIL_UPSERT = `insert into cockpit.youtube_source (video_id, title, source_url, capture_id, review_state, brief_markdown, extract_attempts)
  values ($1,$2,$3,$4,'ai_created',$5,1)
  on conflict (video_id) do update set extract_attempts = cockpit.youtube_source.extract_attempts + 1, brief_markdown = excluded.brief_markdown`;

async function row() { return (await db.query(`select * from cockpit.youtube_source where video_id=$1`, [VID])).rows[0]; }

async function main() {
  await db.connect();
  await db.query(`create schema if not exists cockpit`);
  await db.query(`create table if not exists cockpit.youtube_source (
    id uuid primary key default gen_random_uuid(), build_id text not null default 'BUILD-002',
    video_id text not null unique, title text not null, source_url text, channel text, published text,
    transcript_source text, segment_count int, captured_at timestamptz, capture_id text,
    review_state text not null default 'ai_created' check (review_state in ('ai_created','pending_warwick_review','approved','changes_requested')),
    note_path text, raw_path text, raw_sha256 text, brief_markdown text, learning_count int not null default 0,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    extract_attempts integer not null default 0)`);
  await db.query(`delete from cockpit.youtube_source where video_id=$1`, [VID]);

  console.log('1) a FAILED extraction leaves a partial row (raw_path NULL, placeholder title, attempts=1):');
  await db.query(FAIL_UPSERT, [VID, `(extraction failed) ${VID}`, `https://youtu.be/${VID}`, 'cap-1', '> Extraction failed: transient net error. Bounded retry.']);
  const p = await row();
  ok(p && p.raw_path === null && p.extract_attempts === 1 && p.title.startsWith('(extraction failed)'), 'partial row present (raw_path NULL, placeholder title, attempts=1)');

  console.log('2) a LATER SUCCESS fills the RAW/source pointers + supersedes the placeholders (TQA-006 fix):');
  const capturedAt = new Date(1_800_000_000_000).toISOString();
  await db.query(YOUTUBE_SOURCE_SUCCESS_UPSERT, [VID, 'Real Title — How X Works', `https://www.youtube.com/watch?v=${VID}`, 'Real Channel', '2026-01-01', 'manual_captions', 42, capturedAt, 'cap-1', 'Sources/_raw/RETRYVID001', 'abc123sha', '> Extracted + RAW preserved — note pending in-session.']);
  const s = await row();
  ok(s.raw_path === 'Sources/_raw/RETRYVID001', 'raw_path is NOW populated (was NULL) — the source is no longer lost');
  ok(s.raw_sha256 === 'abc123sha', 'raw_sha256 populated');
  ok(s.channel === 'Real Channel' && s.published === '2026-01-01' && s.transcript_source === 'manual_captions' && s.segment_count === 42, 'required source fields (channel/published/transcript/segments) populated');
  ok(s.title === 'Real Title — How X Works', 'placeholder title superseded by the real title (row had no RAW yet)');
  ok(s.brief_markdown.includes('RAW preserved'), 'failure brief superseded by the success brief');
  ok(s.extract_attempts === 1, 'extract_attempts NOT reset (attempt history preserved)');
  ok(s.note_path === null, 'note_path untouched (in-session authoring still pending — not clobbered)');
  // downstream can continue: raw_path + real title present ⇒ finish-note / learning can proceed.
  ok(s.raw_path !== null && !s.title.startsWith('(extraction failed)'), 'downstream processing can now continue (RAW pointer + real title present)');

  console.log('3) COALESCE never overwrites VALID existing values (a prior SUCCESS is left untouched):');
  await db.query(`update cockpit.youtube_source set note_path='Sources/real-note.md' where video_id=$1`, [VID]);
  await db.query(YOUTUBE_SOURCE_SUCCESS_UPSERT, [VID, 'A DIFFERENT title', `https://www.youtube.com/watch?v=${VID}`, 'Other', '2027', 'auto', 99, capturedAt, 'cap-1', 'Sources/_raw/OTHER', 'zzz', '> other']);
  const s2 = await row();
  ok(s2.raw_path === 'Sources/_raw/RETRYVID001' && s2.raw_sha256 === 'abc123sha', 'valid RAW pointers NOT overwritten (COALESCE keeps existing)');
  ok(s2.title === 'Real Title — How X Works', 'a real title is NOT clobbered on a duplicate success (raw present ⇒ keep existing)');
  ok(s2.note_path === 'Sources/real-note.md', 'a filled note_path survives (not touched by the upsert)');

  await db.query(`delete from cockpit.youtube_source where video_id=$1`, [VID]);
  console.log(`\nRESULT: ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
}
main().catch((e) => { console.error('[youtube-retry] error', e.message); fail++; }).finally(async () => { await db.end().catch(() => {}); process.exit(fail === 0 ? 0 : 1); });
