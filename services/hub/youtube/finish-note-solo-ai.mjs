// BUILD-002 WP2 — in-session note finisher for dhbcVxYhWaQ ("The $1,000/hour Solo AI Business").
//   node services/hub/youtube/finish-note-solo-ai.mjs
// The watcher auto-detected + extracted this capture and left youtube_source.note_path NULL
// (D-cairn: the generative note is authored in-session, not headless). This runner takes the
// in-session-authored note body, ingests it through the ONE write authority (idempotent RAW +
// note), then flips the youtube_source row from "pending" to "noted" and files its learning
// candidates. Idempotent: re-running writes nothing new (VaultWriter is write-once on video id).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { ingestYouTube } from './ingest.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const VIDEO = 'dhbcVxYhWaQ';
const PACKET = 'C:/Fusion247PKA/tools/tubeair/out/auto';
const BODY = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/4191b69f-b367-4926-be91-95f92f8aa1b1/scratchpad/solo-ai-note-body.md';

const dir = path.join(PACKET, fs.readdirSync(PACKET).find((d) => d.includes(VIDEO)));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const reportName = fs.readdirSync(dir).find((f) => f.endsWith('.md'));
const report = fs.readFileSync(path.join(dir, reportName), 'utf8');
const authoredBody = fs.readFileSync(BODY, 'utf8');

const CANDIDATES = [
  { ref: 'LC-1', recommendation: 'Foundry idea: package a "Fusion247 AI Assessment" productized service (discovery → Claude-Skill analysis → templated report → review)',
    why: 'Directly on Fusion247\'s consultancy lane; low capital, fast pilot; fulfilled with our own Claude/Skills stack.', evidence: 'Note §Fusion247 relevance + §The model',
    target: 'Foundry (new idea candidate)', effect: 'A repeatable productized consultancy offer', confidence: 'medium', risk: 'low (pilot)' },
  { ref: 'LC-2', recommendation: 'Build a Larry "assessment" skill: transcript → governed pain-point + tool-prescription report, with the QA/substitution + evals loop',
    why: 'Reuses our stack; turns the manual 4-phase play into a governed agent step.', evidence: 'Note §The model (phases 2–3)',
    target: 'MyPKA build backlog', effect: 'Automated first-draft assessment report', confidence: 'medium', risk: 'low' },
  { ref: 'LC-3', recommendation: 'Lift the discovery-question set + report template + "3 ROI levers" framing into Team Knowledge/ as reusable consultancy assets',
    why: 'High-value, low-effort reusable assets independent of whether we run the full service.', evidence: 'Note §The model + §Reusable assets',
    target: 'Team Knowledge/ (consultancy playbook)', effect: 'Ready-to-use assessment scaffolding', confidence: 'high', risk: 'low' },
];

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres',
    ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
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
await db.query(
  `update cockpit.youtube_source
     set note_path=$2, brief_markdown=$3, learning_count=$4, updated_at=now()
   where video_id=$1`,
  [VIDEO, notePathRel, brief, CANDIDATES.length]);

await db.query(`delete from cockpit.learning_candidate where source_video_id=$1`, [VIDEO]);
let sort = 0;
for (const c of CANDIDATES) {
  await db.query(
    `insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, why, evidence, proposed_target, expected_effect, confidence, risk, status, correlation_id, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
    [VIDEO, c.ref, c.recommendation, c.why, c.evidence, c.target, c.effect, c.confidence, c.risk, `soloai-${c.ref}`, sort++]);
}
const src = (await db.query(`select review_state, note_path, learning_count from cockpit.youtube_source where video_id=$1`, [VIDEO])).rows[0];
console.log(`[finish] youtube_source ${VIDEO} — note_path=${src.note_path ? 'set' : 'NULL'}, review_state=${src.review_state}, ${src.learning_count} learning candidates`);
await db.end();
