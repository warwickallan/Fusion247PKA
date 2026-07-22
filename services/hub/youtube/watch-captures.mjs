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
  const dir = fs.existsSync(outRoot) ? fs.readdirSync(outRoot).find((d) => d.includes(videoId)) : null;
  if (!dir) return { ok: false, error: 'tubeair ran but no packet dir found' };
  const full = path.join(outRoot, dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(full, 'manifest.json'), 'utf8'));
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
    const exists = (await db.query(`select 1 from cockpit.youtube_source where video_id=$1`, [cls.videoId])).rowCount > 0;
    if (exists) { skipped++; continue; }
    console.log(`[watch] new YouTube capture ${cls.videoId} (fcg ${cap.capture_id}) — extracting…`);
    const t = runTubeair(cls.canonicalUrl, cls.videoId);
    if (!t.ok) {
      console.log(`[watch]   extraction FAILED for ${cls.videoId}: ${t.error} — recorded as failed (no hammering; will not retry an existing row)`);
      await db.query(
        `insert into cockpit.youtube_source (video_id, title, source_url, capture_id, review_state, brief_markdown)
         values ($1,$2,$3,$4,'ai_created',$5) on conflict (video_id) do nothing`,
        [cls.videoId, `(extraction failed) ${cls.videoId}`, cls.canonicalUrl, cap.capture_id, `> Extraction failed: ${t.error}. Retryable via Directus command (WP4).`]);
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

async function main() {
  await db.connect();
  do {
    const r = await scanOnce();
    console.log(`[watch] pass: ${r.processed} newly extracted, ${r.skipped} already processed, ${r.failed} failed`);
    if (WATCH_SEC) await sleep(WATCH_SEC * 1000);
  } while (WATCH_SEC);
}
main().catch((e) => { console.error('[watch] error', e.message); process.exitCode = 1; }).finally(async () => { if (!WATCH_SEC) await db.end().catch(() => {}); });
