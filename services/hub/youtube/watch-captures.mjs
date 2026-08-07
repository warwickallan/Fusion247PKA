// BUILD-002 WP2 — auto-detect YouTube captures in the gateway and run the deterministic pipeline.
//   node services/hub/youtube/watch-captures.mjs --once   (one pass)
//   node services/hub/youtube/watch-captures.mjs --watch=30   (poll every 30s)
//
// THE GOAL (Warwick): a YouTube link sent through Telegram is auto-detected + processed — no telling
// Larry each time. This worker scans fcg.capture_envelope, classifies each capture, and for any
// YouTube video with no cockpit.youtube_source row yet: runs TubeAIR (reused), preserves the immutable
// RAW, creates a youtube_source row, and then AUTOMATICALLY generates the standalone knowledge note via
// headless Cairn/Sonnet (generate-source-note.mjs) — no in-session hand-authoring. note_path is set only
// when a complete note is filed; a generation failure leaves note_path NULL (explicit + retryable — the
// next pass regenerates and nudgePending flags it). Idempotent: youtube_source.video_id is unique, so a
// re-scan or a duplicate capture never re-processes.
//
// ── WO-27 (Warwick, 2026-08-07) ──────────────────────────────────────────────────────────────────────
// "He sent a link, nothing happened, and nothing told him — for four days." Three changes here:
//
//  1. HEARTBEAT. The watcher records that it is still polling, so ensure-youtube-watcher.mjs can tell a
//     HUNG watcher from a healthy one. A process being alive proves nothing; this is the only evidence
//     that it is still working. Beaten per pass, per capture and per note, so one long unit of work
//     never reads as a hang.
//
//  2. ONE HONEST BRIEFING PER CAPTURE. Warwick: "'success' means the durable pipeline destination has
//     been reached, not merely that the note was generated." A briefing says COMPLETE only when the note
//     is filed, the DB row is right AND git actually holds it. Otherwise DEGRADED/PENDING. Durability is
//     PROBED (captureIsPersisted), never read off persistCapture's returned flag — a claimed commit is
//     not a durable commit, and a green that outruns durability is the defect this exists to prevent.
//
//  3. RECONCILE. A capture stranded by a transient `.git/index.lock` is picked up on a later pass and
//     committed, with the DEGRADED -> COMPLETE transition reported. Idempotent: reconciling an already
//     durable capture is a no-op, never a second commit.
//
// IMPORT SAFETY (defect found and fixed under WO-27). This module used to call main() at the top level
// with a static `pg` import, so MERELY IMPORTING IT read the gateway credentials, opened a connection to
// production Postgres and ran a full live pass. Everything heavy is now behind a dynamic import inside
// main(), and main() runs only under the CLI guard at the foot of the file — so this file can be proven
// without a database and without the network (AC7).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyYouTube } from './youtubeClassify.mjs';
import { preserveRaw } from './ingest.mjs';
import { YOUTUBE_SOURCE_SUCCESS_UPSERT } from './youtubeSourceSql.mjs';
import { persistCapture, captureCommitMessage, captureIsPersisted } from './persistCapture.mjs';
import { writeHeartbeat, DEFAULT_STATE_PATH } from './ensure-youtube-watcher.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const TUBEAIR = 'C:/Fusion247PKA/tools/tubeair';
const OUT = 'out/auto';

/** The repository the vault lives in, and the vault's directory name inside it. */
export const REPO_ROOT = path.dirname(VAULT);
export const VAULT_DIR = path.basename(VAULT);

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

// ── notification — ONE transport, the one that already exists ────────────────────────────────────────
// Warwick reads these on a phone, and a second notification route is explicitly out of scope. Both the
// STUCK nudge and the capture briefing go through here. Best-effort by construction: a failed send must
// never break a scan pass.
export function defaultSendDing(message, tag = 'yt') {
  const tmp = path.join(os.tmpdir(), `${tag}-${Date.now()}.txt`);
  try {
    fs.writeFileSync(tmp, message);
    const r = spawnSync(process.execPath,
      ['--env-file=C:/.fusion247/fusion-capture-gateway.env', 'C:/.fusion247/larry-ding.mjs', tmp],
      { encoding: 'utf8', windowsHide: true });
    return r.status === 0;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
}

// ── durability: what git actually holds ──────────────────────────────────────────────────────────────

export const CAPTURE_STATES = Object.freeze({ COMPLETE: 'COMPLETE', DEGRADED: 'DEGRADED', PENDING: 'PENDING' });

/** The repo-relative paths that make up one capture: the note, and its immutable RAW evidence. */
export function capturePaths({ notePath, rawPath, vaultDir = VAULT_DIR }) {
  return [notePath, rawPath]
    .filter((p) => typeof p === 'string' && p.trim().length)
    .map((p) => `${vaultDir}/${p.replace(/\\/g, '/').replace(/^\/+/, '')}`);
}

/**
 * The state Warwick is told about.
 *
 * `durable` is the answer from a PROBE of git, never persistCapture's returned flag. That distinction is
 * the acceptance property of this Work Order: a capture whose note and row are correct but whose commit
 * has not completed must never be reported COMPLETE.
 */
export function classifyCapture({ notePath, durable }) {
  if (!notePath) return { state: CAPTURE_STATES.PENDING, durable: false, detail: 'note not filed yet' };
  if (!durable) return { state: CAPTURE_STATES.DEGRADED, durable: false, detail: 'note filed; git persistence NOT completed' };
  return { state: CAPTURE_STATES.COMPLETE, durable: true, detail: 'note filed and committed to git' };
}

/**
 * One short message per capture (AC6) — title, state, and the one thing Warwick would want to know.
 * A DEGRADED briefing says plainly that nothing is lost, because the honest answer is that it is not:
 * the note exists and the reconcile pass will commit it.
 */
export function briefingMessage({ videoId, title, state, notePath, sha, detail, transition = false }) {
  const name = (title || videoId || 'YouTube capture').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (state === CAPTURE_STATES.COMPLETE) {
    return [
      transition
        ? '✅ YouTube note now safely stored — COMPLETE'
        : '✅ YouTube note filed — COMPLETE',
      `“${name}”`,
      transition
        ? `The commit that was outstanding has now completed${sha ? ` (${String(sha).slice(0, 8)})` : ''}.`
        : `Note written and committed to git${sha ? ` (${String(sha).slice(0, 8)})` : ''}.`,
      notePath ? `📄 ${notePath}` : '',
    ].filter(Boolean).join('\n');
  }
  if (state === CAPTURE_STATES.DEGRADED) {
    return [
      '⚠️ YouTube note filed — DEGRADED, not yet stored in git',
      `“${name}”`,
      `The note and its record are correct, but the git commit has NOT completed${detail ? ` (${detail})` : ''}.`,
      'Nothing is lost — it will be committed automatically on a later pass, and I will tell you when it is.',
      notePath ? `📄 ${notePath}` : '',
    ].filter(Boolean).join('\n');
  }
  return [
    '⏳ YouTube capture PENDING',
    `“${name}”`,
    detail || 'The note has not been filed yet.',
  ].join('\n');
}

/**
 * Bring one capture to durability if it is not there already.
 *
 * IDEMPOTENT BY PROBE-FIRST: an already-durable capture returns `already-durable` without running a
 * commit at all, so a reconcile pass can run on every tick without producing a second commit.
 */
export function reconcileCapture({
  videoId, title, notePath, rawPath, repoRoot = REPO_ROOT, vaultDir = VAULT_DIR,
  probe = captureIsPersisted, persist = persistCapture, runGit,
}) {
  const paths = capturePaths({ notePath, rawPath, vaultDir });
  if (!paths.length) return { action: 'nothing-to-do', committed: false, durable: false, paths };

  if (probe({ repoRoot, paths, runGit })) {
    return { action: 'already-durable', committed: false, durable: true, paths };
  }

  const r = persist({ repoRoot, paths, message: captureCommitMessage({ videoId, title }), runGit });
  if (r.committed) return { action: 'reconciled', committed: true, durable: true, sha: r.sha, paths, lockRetries: r.lockRetries };

  // `no-changes` means the working tree matches the index and there was nothing to stage. That is the
  // normal already-persisted path; re-probe rather than assume either way.
  if (r.reason === 'no-changes') {
    const durable = probe({ repoRoot, paths, runGit });
    return { action: durable ? 'already-durable' : 'still-degraded', committed: false, durable, reason: r.reason, paths };
  }

  return { action: 'still-degraded', committed: false, durable: false, reason: r.reason, error: r.error, paths };
}

// ── extraction ───────────────────────────────────────────────────────────────────────────────────────

function runTubeair(url, videoId) {
  const py = path.join(TUBEAIR, '.venv/Scripts/python.exe');
  const r = spawnSync(py, ['tubeair.py', '--url', url, '--out', OUT, '--languages', 'en,en-US,en-GB', '--note', 'BUILD-002 WP2 auto-detect'],
    { cwd: TUBEAIR, encoding: 'utf8', timeout: 180000, windowsHide: true });
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

async function scanOnce(db, beat = () => {}) {
  const caps = (await db.query(
    `select capture_id, coalesce(payload_text, text_preview, '') as text, captured_at
       from fcg.capture_envelope order by coalesce(captured_at, created_at) desc limit $1`, [LIMIT])).rows;
  let processed = 0, skipped = 0, failed = 0;
  for (const cap of caps) {
    const cls = classifyYouTube(cap.text);
    if (!cls.isYouTube) { continue; }
    // QA2-A: skip only a COMPLETE row (raw_path present) or a failed row that has EXHAUSTED its bounded
    // retries — a transient failure (raw_path null, attempts < cap) is re-attempted, not permanently
    // suppressed. (Exactly one poller runs at a time: ensure-youtube-watcher.mjs holds the estate to a
    // single healthy instance — since WO-27 by LEAVING a healthy one alone and replacing only an absent,
    // hung or duplicated one, rather than by killing unconditionally on every invocation. The unique
    // youtube_source.video_id row remains the backstop.)
    const MAX_ATTEMPTS = 3;
    const row = (await db.query(`select raw_path, extract_attempts from cockpit.youtube_source where video_id=$1`, [cls.videoId])).rows[0];
    if (row && (row.raw_path !== null || row.extract_attempts >= MAX_ATTEMPTS)) { skipped++; continue; }
    beat(); // a long extraction must not read as a hang
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
    const stub = `> **Extracted + RAW preserved — standalone knowledge note generating (headless Cairn/Sonnet)…**\n\n- **Title:** ${m.title}\n- **Channel:** ${m.channel}\n- **Published:** ${m.published_date}\n- **Transcript:** ${m.transcript_source}, ${m.segment_count} segments\n- **RAW evidence:** \`${raw.dir}/\` (sha256 \`${raw.files[0].sha256.slice(0, 12)}…\`)\n`;
    await db.query(YOUTUBE_SOURCE_SUCCESS_UPSERT,
      [cls.videoId, m.title, m.source_url, m.channel, m.published_date, m.transcript_source, m.segment_count, m.captured_at, cap.capture_id, raw.dir, raw.files[0].sha256, stub]);
    console.log(`[watch]   ${cls.videoId} extracted (${m.segment_count} segments) + RAW preserved + youtube_source created (note generated in the pending-note pass).`);
    processed++;
  }
  return { processed, skipped, failed };
}

const MAX_NOTE_ATTEMPTS = 3;

// AUTOMATED Cairn Source Intelligence — generate the standalone knowledge note for every extracted-but-noteless
// row (raw_path present, note_path null), headless Sonnet. Bounded-retry via note_attempts (mirrors extraction):
// the counter is advanced BEFORE the call so a crash mid-generation still counts (fail-safe, no infinite loop),
// and a genuinely un-noteable source stops after the cap. On success generateSourceNote sets note_path, so the
// row is never regenerated. A note failure never breaks the scan loop; the next pass retries until the cap.
// Serial (one claude -p at a time) — videos are infrequent and this avoids parallel spawns.
//
// WO-27: on a filed note, PROBE durability and brief Warwick once — COMPLETE only if git holds it.
async function generatePendingNotes(db, { beat = () => {}, sendDing = defaultSendDing, probe = captureIsPersisted } = {}) {
  let pend;
  try {
    pend = (await db.query(
      `select video_id, title, note_attempts, raw_path from cockpit.youtube_source
        where raw_path is not null and note_path is null and note_attempts < $1 order by created_at limit 5`, [MAX_NOTE_ATTEMPTS])).rows;
  } catch (e) { return; } // note_attempts column may not exist yet if migration 280 not applied
  if (!pend.length) return;

  // Kept OUT of the static import graph on purpose: generate-source-note.mjs statically imports pg and
  // the Claude caller, so importing it at module scope would make this file unloadable without a
  // database — which is exactly what AC7 forbids.
  const { generateSourceNote } = await import('./generate-source-note.mjs');

  for (const p of pend) {
    beat();
    await db.query(`update cockpit.youtube_source set note_attempts = note_attempts + 1 where video_id=$1`, [p.video_id]);
    console.log(`[watch]   generating standalone note for ${p.video_id} (attempt ${(p.note_attempts ?? 0) + 1}/${MAX_NOTE_ATTEMPTS})…`);
    try {
      const n = await generateSourceNote({ video: p.video_id, out: OUT });
      beat();
      if (n.ok) {
        console.log(`[watch]   ${p.video_id} standalone note filed → ${n.note_path} (${n.note_chars} chars).`);
        // The briefing is built from a PROBE, not from n.persisted. n.persisted is a claim that a commit
        // was made; this asks git what it actually holds.
        const paths = capturePaths({ notePath: n.note_path, rawPath: p.raw_path });
        const durable = probe({ repoRoot: REPO_ROOT, paths });
        const c = classifyCapture({ notePath: n.note_path, durable });
        const sent = sendDing(briefingMessage({
          videoId: p.video_id, title: p.title || n.note_path, state: c.state, notePath: n.note_path,
          sha: durable ? n.persisted_sha : null,
          detail: durable ? c.detail : (n.persist_reason ? `${n.persist_reason}` : c.detail),
        }), `yt-brief-${p.video_id}`);
        console.log(`[watch]   ${p.video_id} briefing: ${c.state}${sent ? ' (sent)' : ' (SEND FAILED — state recorded in this log only)'}`);
      } else {
        console.log(`[watch]   ${p.video_id} note NOT filed (${n.reason}) — note_path left NULL${n.retryable ? ', will retry next pass' : ' (not retryable)'}.`);
      }
    } catch (e) { console.log(`[watch]   ${p.video_id} note generation error: ${e.message} — note_path left NULL, will retry.`); }
  }
}

// WO-27 AC5 — a capture stranded by a transient `.git/index.lock` is picked up here without anyone
// remembering it. Bounded to the most recent rows so a pass stays short, and PROBE-FIRST so an already
// durable capture costs one read and never a second commit.
export async function reconcileStranded(db, { beat = () => {}, sendDing = defaultSendDing, probe = captureIsPersisted, persist = persistCapture, limit = 10 } = {}) {
  let rows;
  try {
    rows = (await db.query(
      `select video_id, title, note_path, raw_path from cockpit.youtube_source
        where note_path is not null order by updated_at desc nulls last limit $1`, [limit])).rows;
  } catch (e) { return { checked: 0, reconciled: 0 }; }

  let reconciled = 0;
  for (const r of rows) {
    beat();
    const out = reconcileCapture({
      videoId: r.video_id, title: r.title, notePath: r.note_path, rawPath: r.raw_path, probe, persist,
    });
    if (out.action === 'reconciled') {
      reconciled++;
      console.log(`[watch]   RECONCILED ${r.video_id} — previously stranded capture committed ${String(out.sha).slice(0, 8)}`
        + `${out.lockRetries ? ` (after ${out.lockRetries} lock retr${out.lockRetries === 1 ? 'y' : 'ies'})` : ''}`);
      sendDing(briefingMessage({
        videoId: r.video_id, title: r.title, state: CAPTURE_STATES.COMPLETE, notePath: r.note_path,
        sha: out.sha, transition: true,
      }), `yt-brief-${r.video_id}-durable`);
    } else if (out.action === 'still-degraded') {
      console.log(`[watch]   ${r.video_id} still DEGRADED (${out.reason}${out.error ? `: ${out.error}` : ''}) — will retry next pass`);
    }
  }
  return { checked: rows.length, reconciled };
}

// Option C (Warwick): nudge ONCE per video that is genuinely STUCK — either extraction has exhausted its bounded
// retries (caption-less video: raw_path null) OR note generation has exhausted its bounded retries (extracted but
// note_path still null). Transient failures self-heal (extract/generatePendingNotes retry) and never nudge — only
// exhaustion does, so nothing sits silently. Idempotent via pending_nudged_at. Best-effort: a ding failure never
// breaks the scan loop.
async function nudgePending(db, { sendDing = defaultSendDing } = {}) {
  let pend;
  try {
    pend = (await db.query(
      `select video_id, title,
              (raw_path is null and extract_attempts >= $1) as extract_failed
         from cockpit.youtube_source
        where pending_nudged_at is null
          and ((raw_path is null and extract_attempts >= $1)
               or (raw_path is not null and note_path is null and note_attempts >= $2))
        order by created_at`, [3, MAX_NOTE_ATTEMPTS])).rows;
  } catch (e) { return; } // columns may not exist yet if migrations 170/220/280 not applied
  if (!pend.length) return;
  const lines = pend.map((p) => `• ${p.title || p.video_id} — ${p.extract_failed ? 'transcript extraction failed' : 'note generation failed'}`).join('\n');
  const msg = `📝 ${pend.length} YouTube link(s) are STUCK after automatic retries (flag me and I'll look):\n${lines}`;
  if (sendDing(msg, `yt-nudge-${pend.map((p) => p.video_id).join('-').slice(0, 40)}`)) {
    for (const p of pend) await db.query(`update cockpit.youtube_source set pending_nudged_at=now() where video_id=$1`, [p.video_id]);
    console.log(`[watch]   nudged Warwick about ${pend.length} pending note(s)`);
  }
}

async function main({ statePath = DEFAULT_STATE_PATH } = {}) {
  // Dynamic: keeps pg and the gateway credentials out of the module graph of anything that merely
  // imports this file (see IMPORT SAFETY above).
  const { default: pg } = await import('file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js');
  const db = new pg.Client(gatewayDsn());
  const beat = () => { writeHeartbeat({ statePath }); };

  await db.connect();
  do {
    beat(); // "still polling" — the only evidence ensure-youtube-watcher has that this is not hung
    const r = await scanOnce(db, beat);
    console.log(`[watch] pass: ${r.processed} newly extracted, ${r.skipped} already processed, ${r.failed} failed`);
    await generatePendingNotes(db, { beat });
    const rec = await reconcileStranded(db, { beat });
    if (rec.reconciled) console.log(`[watch] reconcile: ${rec.reconciled} of ${rec.checked} checked were stranded and are now committed`);
    await nudgePending(db);
    beat();
    if (WATCH_SEC) await sleep(WATCH_SEC * 1000);
  } while (WATCH_SEC);
  if (!WATCH_SEC) await db.end().catch(() => {});
}

// CLI guard — importing this module must have NO side effect. Before WO-27 main() ran at the top level,
// so a mere import opened production Postgres and ran a full pass.
const isCli = !!process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isCli) {
  main().catch((e) => { console.error('[watch] error', e.message); process.exitCode = 1; });
}
