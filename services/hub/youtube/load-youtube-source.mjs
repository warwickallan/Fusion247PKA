// BUILD-002 WP2 — project a processed YouTube source into Directus (readable page + learning candidates).
//   node services/hub/youtube/load-youtube-source.mjs
// Reads the governed vault note + the TubeAIR manifest and upserts cockpit.youtube_source
// (brief_markdown = the readable note) + cockpit.learning_candidate. Idempotent. Owner connection.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const NOTE = 'Sources/pcr30j-skxu-ai-memory-just-got-solved-they-beat-openai-anthropic.md';
const PACKET = 'C:/Fusion247PKA/tools/tubeair/out/honcho';
const dir = path.join(PACKET, fs.readdirSync(PACKET).find((d) => d.includes('pcR30j-sKxU')));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const brief = fs.readFileSync(path.join(VAULT, NOTE), 'utf8');

const CANDIDATES = [
  { ref: 'LC-1', recommendation: 'Evaluate a periodic reconcile/self-clean pass over Larry\'s memory files (inspired by Honcho "dreaming")',
    why: 'Larry\'s memory grows append-only; stale/contradictory notes are a known risk.', evidence: 'Note §"Automatic dreaming" + §Fusion247 relevance',
    target: 'Larry memory system / a future SOP', effect: 'Fresher, self-reconciled memory', confidence: 'medium', risk: 'low (design spike only)' },
  { ref: 'LC-2', recommendation: 'Scoped assessment: Honcho (self-hosted) as an optional memory layer for MyPKA agents',
    why: 'Directly adjacent to MyPKA\'s persistent-memory thesis.', evidence: 'Whole note; Pax research (dispatched)',
    target: 'Foundry idea / evaluation only', effect: 'Potential portable-memory upgrade', confidence: 'low', risk: 'medium (new dependency, privacy surface)' },
  { ref: 'LC-3', recommendation: 'Verify the factual claims (Neuromancer=Qwen-3; benchmark numbers) against Honcho\'s own docs before trusting any of the above',
    why: 'Single promotional narrator + auto-captions.', evidence: 'Note §"Claims requiring verification"',
    target: 'Pax (already researching)', effect: 'Verified basis for any decision', confidence: 'n/a', risk: 'low' },
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

await db.connect();
await db.query(
  `insert into cockpit.youtube_source (video_id, title, source_url, channel, published, transcript_source, segment_count, captured_at, capture_id, review_state, note_path, raw_path, brief_markdown, learning_count)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_created',$10,$11,$12,$13)
   on conflict (video_id) do update set title=excluded.title, brief_markdown=excluded.brief_markdown, review_state=excluded.review_state, learning_count=excluded.learning_count, updated_at=now()`,
  [manifest.video_id, manifest.title, manifest.source_url, manifest.channel, manifest.published_date, manifest.transcript_source,
   manifest.segment_count, manifest.captured_at, 'd8544749-0fb9-5849-902f-e92bde7935c9', NOTE, `Sources/_raw/${manifest.video_id}`, brief, CANDIDATES.length]);

await db.query(`delete from cockpit.learning_candidate where source_video_id=$1`, [manifest.video_id]);
let sort = 0;
for (const c of CANDIDATES) {
  await db.query(
    `insert into cockpit.learning_candidate (source_video_id, candidate_ref, recommendation, why, evidence, proposed_target, expected_effect, confidence, risk, status, correlation_id, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
    [manifest.video_id, c.ref, c.recommendation, c.why, c.evidence, c.target, c.effect, c.confidence, c.risk, `honcho-${c.ref}`, sort++]);
}
const src = (await db.query(`select review_state, learning_count from cockpit.youtube_source where video_id=$1`, [manifest.video_id])).rows[0];
console.log(`[project] youtube_source ${manifest.video_id} loaded — review_state=${src.review_state}, ${src.learning_count} learning candidates`);
await db.end();
