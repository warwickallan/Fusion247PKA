// BUILD-002 WP2 — AUTOMATED Cairn Source Intelligence (closes the "note pending in-session" gap).
// Headless Sonnet applies the approved F247.template.youtube-transcript-knowledge-note contract to the RAW
// transcript → a STANDALONE knowledge note (stands alone without the video) → governed write via ingestYouTube
// (RAW immutability + one write authority) → flips cockpit.youtube_source pending→noted. No hand-authoring, no new
// agent (Cairn owns Source Intelligence). Failure is EXPLICIT + retryable: an incomplete/invalid note is never
// persisted or marked complete, and the DB stays 'pending'.
//   node --env-file=C:/.fusion247/fusion-capture-gateway.env services/hub/youtube/generate-source-note.mjs --video=<id> [--out=out/auto] [--dry]
// Also exports generateSourceNote({ video, out, dry }) for the live watcher (returns a result; never exits).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { ingestYouTube } from './ingest.mjs';
import { callClaude } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/t2-calibrate.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';

// The knowledge-note sections these headings MUST be present for the note to count as complete (structural gate).
const REQUIRED_SECTIONS = [
  'Executive orientation', 'What the source says', 'Mechanisms', 'Tools, people', 'Examples',
  'Claims & confidence', 'Caveats', 'What this means for Fusion', 'Key concepts', 'Actions',
];

// Pull the cleaned reading view (§7.1) out of the TubeAIR report; fall back to the whole §7 or the raw report.
function extractTranscript(md) {
  const lines = md.split(/\r?\n/);
  let start = -1; let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && /^###\s*7\.1\b/.test(lines[i])) start = i + 1;
    else if (start >= 0 && /^###\s*7\.2\b/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) return md.trim();
  return lines.slice(start, end).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// The approved template, applied. Not a summary, not a dump — a stand-alone reconstruction that retains EVERY
// material vein (technical / operational / strategic / commercial / career-reputation), with the actual argument.
function notePrompt(meta, transcript) {
  return `You are Cairn, Knowledge Intake Specialist of Fusion / myPKA. Produce a STANDALONE knowledge note from this
YouTube source so Warwick NEVER needs to watch the video or read the transcript. This is the approved
F247.template.youtube-transcript-knowledge-note contract (BUILD-002 §8/§10).

HARD RULES:
- STANDS ALONE without the video. A reader with ONLY this note must understand what the source said, its arguments,
  its mechanisms, its examples, and why it matters — without ever seeing the transcript.
- NOT a transcript dump and NOT a thin executive summary. A faithful, comprehensive reconstruction.
- Retain EVERY material vein. A rich source carries multiple materially-different threads — technical, operational,
  strategic, commercial, and career/reputation. Capture them ALL in substance, with the ACTUAL argument and why it
  matters. Never drop a whole theme because it isn't the "main" one; a reputation/career or business thread is as
  material as a technical one.
- PRESERVE COUNTERINTUITIVE REVERSALS. Where the source overturns a common assumption or reframes a belief ("we all
  thought X was going away, but actually Y"), state BOTH the assumption and the reversal explicitly — do not fold it
  into the nearest adjacent point and lose it. A myth-busting or counterintuitive claim is one of the highest-value
  things a source carries; losing the reversal loses the insight.
- Before you finish, run a silent coverage self-check: re-read the transcript and confirm every materially-different
  thread you can find is present in substance. If you notice a thread you compressed away, add it back. Under-including
  a material thread is a failure; a slightly longer note is not.
- SEPARATE claim/opinion from verified fact; mark each key claim fact | claim | opinion with a confidence.
- Record uncertainty and SOURCE GAPS honestly. Do NOT hallucinate detail the source didn't give — where the source
  is thin or hand-wavy, say so rather than inventing. A THIN source yields a SHORT, honest note that says what little
  was actually there; never pad a thin source with invented specifics to look comprehensive.
- SEPARATE source content from Fusion247 interpretation — the "What this means for Fusion247" section is YOUR
  interpretation, clearly marked, never mixed into the reconstruction.
- Cite [timestamps] for key points (provenance). Remove filler/repetition. No empty stubs.

PRODUCE ALL of these sections (markdown ## headings, in order):
## Executive orientation
(2-4 sentences: what this is, who's in it, the single reason it matters.)
## What the source says
(The substantive core — a full structured reconstruction of the argument/content, with as many subsections as the
source demands. This is the heart; be thorough. Every material thread appears here.)
## Mechanisms, methods & implementation detail
(The how: workflows, step-by-step, concrete practices the source described.)
## Tools, people, products & organisations
(Each named thing: what it is / does, per the source.)
## Examples & use cases
(Concrete instances the source gave.)
## Claims & confidence
(Key claims as a list, each tagged [fact|claim|opinion] + confidence.)
## Caveats & source gaps
(What's uncertain, unsupported, contested, or absent.)
## What this means for Fusion247
(YOUR interpretation — implications, connections to Warwick's goals/systems/decisions. Clearly separate from source.)
## Key concepts & takeaways
## Actions & open questions
(What Warwick might do / decide / verify next.)

SOURCE: "${meta.title}" — ${meta.channel || 'unknown channel'} — ${meta.sourceUrl}

THE TRANSCRIPT (timestamped):
${transcript}

Return ONLY the note as Markdown (the sections above), no preamble, no code fences.`;
}

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
}

// Generate + (unless dry) persist the standalone knowledge note for one video. Returns a RESULT object; never
// exits the process. Failure => { ok:false, retryable, reason } and the DB is left 'pending' (nothing persisted).
export async function generateSourceNote({ video, out = 'out/auto', dry = false }) {
  if (!video) return { ok: false, retryable: false, reason: 'no video id' };
  // Locate the TubeAIR packet (newest matching + manifest.video_id equality — never file a stale/mismatched packet).
  const PACKET = `C:/Fusion247PKA/tools/tubeair/${out}`;
  const dirs = fs.readdirSync(PACKET).filter((d) => d.includes(video)).map((d) => ({ d, m: fs.statSync(path.join(PACKET, d)).mtimeMs })).sort((a, b) => b.m - a.m);
  if (!dirs.length) return { ok: false, retryable: false, reason: `no TubeAIR packet dir for ${video} under ${PACKET}` };
  const dir = path.join(PACKET, dirs[0].d);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (manifest.video_id !== video) return { ok: false, retryable: false, reason: `packet manifest ${manifest.video_id} != ${video} — refusing stale packet` };
  const report = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.md'))), 'utf8');
  const transcript = extractTranscript(report);
  if (transcript.length < 400) return { ok: false, retryable: false, reason: `transcript too short (${transcript.length} chars) — refusing to generate a note from near-empty source` };

  const meta = { videoId: video, title: manifest.title, sourceUrl: manifest.source_url, channel: manifest.channel,
    published: manifest.published_date, transcriptSource: manifest.transcript_source, capturedAt: manifest.captured_at, captureId: null };

  console.error(`[note] ${video} "${meta.title}" · transcript ${transcript.length} chars · generating standalone note (Sonnet)…`);
  const call = await callClaude(notePrompt(meta, transcript), 'source-note');
  if (!call.ok) return { ok: false, retryable: true, reason: `generation call failed: ${call.error}` };
  const noteBody = (call.resultText || '').replace(/^```(markdown)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // EXPLICIT completeness gate: never persist or mark complete an invalid/incomplete note (Fable-style fail-closed).
  const missing = REQUIRED_SECTIONS.filter((s) => !noteBody.includes(s));
  if (noteBody.length < 1500 || missing.length) {
    try { fs.writeFileSync(`${dir}/_note-INVALID.md`, noteBody); } catch {}
    return { ok: false, retryable: true, reason: `incomplete note — ${noteBody.length} chars, missing sections: ${missing.join(', ') || 'none'}` };
  }

  if (dry) { fs.writeFileSync(`${dir}/_note-DRY.md`, noteBody); return { ok: true, dry: true, chars: noteBody.length, sections_present: REQUIRED_SECTIONS.length }; }

  // Persist through the ONE write authority (RAW immutability preserved), then flip pending→noted.
  const packetFiles = [{ name: 'tubeair-report.md', content: report }, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }];
  const result = await ingestYouTube({ vaultRoot: VAULT, meta, packetFiles, authoredBody: noteBody, authoredBy: 'cairn-sonnet' });
  const notePathRel = result.note.path.replace(/^.*Team Knowledge[\\/]/, '').replace(/\\/g, '/');
  const brief = fs.readFileSync(path.join(VAULT, notePathRel), 'utf8');

  const db = new pg.Client(gatewayDsn());
  await db.connect();
  try {
    await db.query(`update cockpit.youtube_source set note_path=$2, brief_markdown=$3, review_state='ai_created', updated_at=now() where video_id=$1`, [video, notePathRel, brief]);
    const src = (await db.query('select review_state, (note_path is not null) noted from cockpit.youtube_source where video_id=$1', [video])).rows[0];
    return {
      ok: true, video, note_path: notePathRel, note_chars: brief.length, note_created: result.note.created,
      raw_preserved: result.raw.dir, noted: src?.noted, review_state: src?.review_state,
      faculty_output_tokens: call.output, cost_usd: call.cost_usd, s: +(call.duration_ms / 1000).toFixed(1),
    };
  } finally { await db.end().catch(() => {}); }
}

// ── CLI wrapper ───────────────────────────────────────────────────────────────────────────────────────────────
const isCli = !!process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isCli) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
  const flag = (n) => args.includes(`--${n}`);
  const video = arg('video');
  if (!video) { console.error('usage: --video=<id> [--out=out/auto] [--dry]'); process.exit(2); }
  generateSourceNote({ video, out: arg('out', 'out/auto'), dry: flag('dry') })
    .then((r) => {
      if (!r.ok) { console.error(`[note] ${r.retryable ? 'FAILED (retryable — DB left pending)' : 'REFUSED'}: ${r.reason}`); process.exit(1); }
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => { console.error('[note] FAILED:', e.stack || e.message); process.exit(1); });
}
