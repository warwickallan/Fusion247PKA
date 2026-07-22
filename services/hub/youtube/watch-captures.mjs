// BUILD-002 WP2 — auto-detect YouTube captures in the gateway and run the deterministic pipeline.
//   node services/hub/youtube/watch-captures.mjs --once   (one pass)
//   node services/hub/youtube/watch-captures.mjs --watch=30   (poll every 30s)
//
// THE GOAL (Warwick): a YouTube link sent through Telegram is auto-detected + processed — no telling
// Larry each time. This worker scans fcg.capture_envelope, classifies each capture, and for any
// YouTube video with no cockpit.youtube_source row yet: runs TubeAIR (reused), preserves the immutable
// RAW, and creates a youtube_source row (note_path NULL = "extracted; standalone knowledge note pending
// in-session authoring by Larry", per the approved D-cairn decision — the generative note needs a
// session, not a headless API key). Idempotent: youtube_source.video_id is unique, so a re-scan or a
// duplicate capture never re-processes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { classifyYouTube } from './youtubeClassify.mjs';
import { preserveRaw } from './ingest.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const TUBEAIR = 'C:/Fusion247PKA/tools/tubeair';
const OUT = 'out/auto';
const args = process.argv.slice(2);
const watchArg = args.find((a) => a.startsWith('--watch'));
const WATCH_SEC = watchArg ? Number(watchArg.split('=')[1] || 30) : null;
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 25);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
}
const db = new pg.Client(gatewayDsn());

function runTubeair(url, videoId) {
  const py = path.join(TUBEAIR, '.venv/Scripts/python.exe');
  const r = spawnSync(py, ['tubeair.py', '--url', url, '--out', OUT, '--languages', 'en,en-US,en-GB', '--note', 'BUILD-002 WP2 auto-detect'],
    { cwd: TUBEAIR, encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || 'tubeair failed').split('\n').slice(-3).join(' ') };
  const outRoot = path.join(TUBEAIR, OUT);
  // NEWEST matching packet dir + manifest.video_id validation (QA2-A: a stale/mismatched older packet
  // must never be ingested; find() order is not a freshness guarantee).
  const dirs = fs.existsSync(outRoot)
    ? fs.readdirSync(outRoot).filter((d) => d.includes(videoId)).map((d) => ({ d, m: fs.statSync(path.join(outRoot, d)).mtimeMs })).sort((a, b) => b.m - a.m)
    : [];
  if (!dirs.length) return { ok: false, error: 'tubeair ran but no packet dir found' };
  const full = path.join(outRoot, dirs[0].d);
  const manifest = JSON.parse(fs.readFileSync(path.join(full, 'manifest.json'), 'utf8'));
  if (manifest.video_id !== videoId) return { ok: false, error: `packet manifest video_id ${manifest.video_id} != requested ${videoId} — refusing stale/mismatched packet` };
  const reportName = fs.readdirSync(full).find((f) => f.endsWith('.md'));
  const report = fs.readFileSync(path.join(full, reportName), 'utf8');
  return { ok: true, manifest, report };
}

async function scanOnce() {
  const caps = (await db.query(
    `select capture_id, coalesce(payload_text, text_preview, '') as text, captured_at
       from fcg.capture_envelope order by coalesce(captured_at, created_at) desc limit $1`, [LIMIT])).rows;
  let processed = 0, skipped = 0, failed = 0;
  for (const cap of caps) {
    const cls = classifyYouTube(cap.text);
    if (!cls.isYouTube) { continue; }
    // QA2-A: skip only a COMPLETE row (raw_path present) or a failed row that has EXHAUSTED its bounded
    // retries — a transient failure (raw_path null, attempts < cap) is re-attempted, not permanently
    // suppressed. (The watcher is single-instance — ensure-youtube-watcher kills any prior instance — so
    // two concurrent extractions do not arise in practice; the youtube_source unique row is the backstop.)
    const MAX_ATTEMPTS = 3;
    const row = (await db.query(`select raw_path, extract_attempts from cockpit.youtube_source where video_id=$1`, [cls.videoId])).rows[0];
    if (row && (row.raw_path !== null || row.extract_attempts >= MAX_ATTEMPTS)) { skipped++; continue; }
    console.log(`[watch] YouTube capture ${cls.videoId} (fcg ${cap.capture_id}) — extracting (attempt ${(row?.extract_attempts ?? 0) + 1})…`);
    const t = runTubeair(cls.canonicalUrl, cls.videoId);
    if (!t.ok) {
      console.log(`[watch]   extraction FAILED for ${cls.videoId}: ${t.error} — attempt recorded (bounded retry up to ${MAX_ATTEMPTS})`);
      await db.query(
        `insert into cockpit.youtube_source (video_id, title, source_url, capture_id, review_state, brief_markdown, extract_attempts)
         values ($1,$2,$3,$4,'ai_created',$5,1)
         on conflict (video_id) do update set extract_attempts = cockpit.youtube_source.extract_attempts + 1, brief_markdown = excluded.brief_markdown`,
        [cls.videoId, `(extraction failed) ${cls.videoId}`, cls.canonicalUrl, cap.capture_id, `> Extraction failed: ${t.error}. Bounded retry (up to ${MAX_ATTEMPTS} attempts).`]);
      failed++; continue;
    }
    const m = t.manifest;
    const packetFiles = [{ name: 'tubeair-report.md', content: t.report }, { name: 'manifest.json', content: JSON.stringify(m, null, 2) }];
    const raw = await preserveRaw({ vaultRoot: VAULT, videoId: cls.videoId, packetFiles });
    const stub = `> **Extracted + RAW preserved — standalone knowledge note pending in-session authoring by Larry** (D-cairn: the semantic step runs in-session, not headless).\n\n- **Title:** ${m.title}\n- **Channel:** ${m.channel}\n- **Published:** ${m.published_date}\n- **Transcript:** ${m.transcript_source}, ${m.segment_count} segments\n- **RAW evidence:** \`${raw.dir}/\` (sha256 \`${raw.files[0].sha256.slice(0, 12)}…\`)\n`;
    await db.query(
      `insert into cockpit.youtube_source (video_id, title, source_url, channel, published, transcript_source, segment_count, captured_at, capture_id, review_state, note_path, raw_path, raw_sha256, brief_markdown, learning_count)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_created',NULL,$10,$11,$12,0)
       on conflict (video_id) do nothing`,
      [cls.videoId, m.title, m.source_url, m.channel, m.published_date, m.transcript_source, m.segment_count, m.captured_at, cap.capture_id, raw.dir, raw.files[0].sha256, stub]);
    console.log(`[watch]   ${cls.videoId} extracted (${m.segment_count} segments) + RAW preserved + youtube_source created (note pending in-session).`);
    processed++;
  }
  return { processed, skipped, failed };
}

// Option C (Warwick): nudge ONCE per video that is extracted-but-note-pending, so nothing sits
// silently. Idempotent via pending_nudged_at — a re-scan never re-nudges. Best-effort: a ding failure
// never breaks the scan loop.
async function nudgePending() {
  let pend;
  try {
    pend = (await db.query(`select video_id, title from cockpit.youtube_source where note_path is null and pending_nudged_at is null order by created_at`)).rows;
  } catch (e) { return; } // column may not exist yet if migration 170 not applied
  if (!pend.length) return;
  const lines = pend.map((p) => `• ${p.title || p.video_id}`).join('\n');
  const msg = `📝 ${pend.length} YouTube link(s) extracted — knowledge note pending (I'll write it next session):\n${lines}`;
  const tmp = path.join(os.tmpdir(), `yt-nudge-${pend.map((p) => p.video_id).join('-').slice(0, 40)}.txt`);
  try {
    fs.writeFileSync(tmp, msg);
    const r = spawnSync(process.execPath, ['--env-file=C:/.fusion247/fusion-capture-gateway.env', 'C:/.fusion247/larry-ding.mjs', tmp], { encoding: 'utf8' });
    if (r.status === 0) {
      for (const p of pend) await db.query(`update cockpit.youtube_source set pending_nudged_at=now() where video_id=$1`, [p.video_id]);
      console.log(`[watch]   nudged Warwick about ${pend.length} pending note(s)`);
    }
  } catch (e) { /* best-effort */ } finally { try { fs.unlinkSync(tmp); } catch {} }
}

async function main() {
  await db.connect();
  do {
    const r = await scanOnce();
    console.log(`[watch] pass: ${r.processed} newly extracted, ${r.skipped} already processed, ${r.failed} failed`);
    await nudgePending();
    if (WATCH_SEC) await sleep(WATCH_SEC * 1000);
  } while (WATCH_SEC);
}
main().catch((e) => { console.error('[watch] error', e.message); process.exitCode = 1; }).finally(async () => { if (!WATCH_SEC) await db.end().catch(() => {}); });
