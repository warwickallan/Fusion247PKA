// BUILD-002 WP2 — LIVE wiring for the spine YouTube route (feature-flagged).
//
// Builds a routing governed writer backed by the REAL classify + TubeAIR extract + immutable RAW
// preserve + cockpit.youtube_source upsert, for injection into the live gateway worker when
// HUB_YOUTUBE_ROUTE=1. Kept OUT of the static import graph (runtime.js imports it dynamically, only
// inside the flag branch) so the unit suite never loads pg or spawns a subprocess — exactly the same
// discipline the Postgres store uses.
//
// Enablement is a deliberate, Warwick-present switch: set HUB_YOUTUBE_ROUTE=1 and restart the gateway,
// AND stop the standalone auto-detect poller (ensure-youtube-watcher) so a capture is processed once.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRoutingWriter } from './routingWriter.mjs';
import { createYoutubeProcessor } from './youtubeProcessor.mjs';
import { classifyYouTube } from '../youtube/youtubeClassify.mjs';
import { preserveRaw as vaultPreserveRaw } from '../youtube/ingest.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const TUBEAIR = 'C:/Fusion247PKA/tools/tubeair';
const OUT = 'out/spine';

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
}

function realExtract(url, videoId) {
  const py = path.join(TUBEAIR, '.venv/Scripts/python.exe');
  const r = spawnSync(py, ['tubeair.py', '--url', url, '--out', OUT, '--languages', 'en,en-US,en-GB', '--note', 'BUILD-002 WP2 spine-route'],
    { cwd: TUBEAIR, encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || 'tubeair failed').split('\n').slice(-3).join(' ') };
  const outRoot = path.join(TUBEAIR, OUT);
  // Pick the NEWEST packet dir for this video (a stale older packet must never be ingested), then
  // VALIDATE the manifest actually belongs to the requested capture — belt-and-braces against a
  // find() ordering surprise or a moved/renamed dir feeding the wrong transcript into the gate.
  const dirs = fs.existsSync(outRoot)
    ? fs.readdirSync(outRoot).filter((d) => d.includes(videoId)).map((d) => ({ d, m: fs.statSync(path.join(outRoot, d)).mtimeMs })).sort((a, b) => b.m - a.m)
    : [];
  if (!dirs.length) return { ok: false, error: 'tubeair ran but no packet dir found' };
  const full = path.join(outRoot, dirs[0].d);
  const manifest = JSON.parse(fs.readFileSync(path.join(full, 'manifest.json'), 'utf8'));
  if (manifest.video_id !== videoId) return { ok: false, error: `packet manifest video_id ${manifest.video_id} != requested ${videoId} — refusing stale/mismatched packet` };
  const reportName = fs.readdirSync(full).find((f) => f.endsWith('.md'));
  const report = fs.readFileSync(path.join(full, reportName), 'utf8');
  return { ok: true, manifest, packetFiles: [{ name: 'tubeair-report.md', content: report }, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }] };
}

// Returns { writer, close } — the routing writer + a pool closer for shutdown.
export async function createLiveYoutubeRoutingWriter({ markdownWriter }) {
  const { default: pg } = await import('file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js');
  const db = new pg.Client(gatewayDsn());
  await db.connect();

  const deps = {
    classify: classifyYouTube,
    async getExistingSource(videoId) {
      const r = await db.query('select raw_path, raw_sha256 from cockpit.youtube_source where video_id=$1', [videoId]);
      return r.rowCount ? { raw_path: r.rows[0].raw_path, raw_sha256: r.rows[0].raw_sha256 } : null;
    },
    extract: async (url, videoId) => realExtract(url, videoId),
    preserveRaw: ({ videoId, packetFiles }) => vaultPreserveRaw({ vaultRoot: VAULT, videoId, packetFiles }),
    async upsertSource(row) {
      await db.query(
        `insert into cockpit.youtube_source (video_id, title, source_url, channel, published, transcript_source, segment_count, captured_at, capture_id, review_state, note_path, raw_path, raw_sha256, learning_count)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_created',NULL,$10,$11,0) on conflict (video_id) do nothing`,
        [row.video_id, row.title, row.source_url, row.channel, row.published, row.transcript_source, row.segment_count, row.captured_at, row.capture_id, row.raw_path, row.raw_sha256]);
    },
  };
  const youtubeProcessor = createYoutubeProcessor(deps);
  return { writer: createRoutingWriter({ markdownWriter, youtubeProcessor }), close: () => db.end().catch(() => {}) };
}
