// BUILD-002 WP2 — GENERIC in-session note finisher for an auto-detected YouTube capture.
//   node services/hub/youtube/finish-note.mjs --video=<id> --body=<path.md> [--candidates=<path.json>] [--out=out/auto]
//
// The watcher auto-detects + extracts a YouTube link and leaves cockpit.youtube_source.note_path NULL
// ("note pending in-session authoring by Larry", per D-cairn — the generative note needs a session, not
// a headless API key). This is the one-command last mile: it ingests the in-session-authored note body
// through the ONE write authority (idempotent RAW + note), flips the youtube_source row pending→noted,
// and files any learning candidates. Idempotent: re-running writes nothing new.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { ingestYouTube } from './ingest.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const args = process.argv.slice(2);
const arg = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const VIDEO = arg('video');
const BODY = arg('body');
const CANDIDATES_FILE = arg('candidates', null);
const OUT = arg('out', 'out/auto');
if (!VIDEO || !BODY) { console.error('usage: --video=<id> --body=<path.md> [--candidates=<path.json>] [--out=out/auto]'); process.exit(2); }

const PACKET = `C:/Fusion247PKA/tools/tubeair/${OUT}`;
// NEWEST matching packet dir + mandatory manifest.video_id equality (QA2-A: never file a stale/mismatched
// packet under the requested video).
const dirs = fs.readdirSync(PACKET).filter((d) => d.includes(VIDEO)).map((d) => ({ d, m: fs.statSync(path.join(PACKET, d)).mtimeMs })).sort((a, b) => b.m - a.m);
if (!dirs.length) { console.error(`no TubeAIR packet dir for ${VIDEO} under ${PACKET}`); process.exit(1); }
const dir = path.join(PACKET, dirs[0].d);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
if (manifest.video_id !== VIDEO) { console.error(`packet manifest video_id ${manifest.video_id} != requested ${VIDEO} — refusing stale/mismatched packet`); process.exit(1); }
const report = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.md'))), 'utf8');
const authoredBody = fs.readFileSync(BODY, 'utf8');
const CANDIDATES = CANDIDATES_FILE ? JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8')) : [];

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
}
const db = new pg.Client(gatewayDsn());

const packetFiles = [{ name: 'tubeair-report.md', content: report }, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }];
const meta = { videoId: VIDEO, title: manifest.title, sourceUrl: manifest.source_url, channel: manifest.channel,
  published: manifest.published_date, transcriptSource: manifest.transcript_source, capturedAt: manifest.captured_at, captureId: null };

const result = await ingestYouTube({ vaultRoot: VAULT, meta, packetFiles, authoredBody });
console.log(`[finish] note ${result.note.created ? 'written' : 'already present'}: ${result.note.path}`);
console.log(`[finish] RAW ${result.raw.created ? 'preserved' : 'already present'}: ${result.raw.dir}/`);

const notePathRel = result.note.path.replace(/^.*Team Knowledge[\\/]/, '').replace(/\\/g, '/');
const brief = fs.readFileSync(path.join(VAULT, notePathRel), 'utf8');

await db.connect();
await db.query(`update cockpit.youtube_source set note_path=$2, brief_markdown=$3, learning_count=$4, updated_at=now() where video_id=$1`,
  [VIDEO, notePathRel, brief, CANDIDATES.length]);
await db.query(`delete from cockpit.learning_candidate where source_video_id=$1`, [VIDEO]);
let sort = 0;
for (const c of CANDIDATES) {
  await db.query(
    `insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, why, evidence, proposed_target, expected_effect, confidence, risk, status, correlation_id, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
    [VIDEO, c.ref, c.recommendation, c.why ?? null, c.evidence ?? null, c.target ?? null, c.effect ?? null, c.confidence ?? null, c.risk ?? null, `${VIDEO}-${c.ref}`, sort++]);
}
const src = (await db.query(`select review_state, (note_path is not null) noted, learning_count from cockpit.youtube_source where video_id=$1`, [VIDEO])).rows[0];
console.log(`[finish] youtube_source ${VIDEO} — noted=${src.noted}, review_state=${src.review_state}, ${src.learning_count} learning candidates`);
await db.end();
