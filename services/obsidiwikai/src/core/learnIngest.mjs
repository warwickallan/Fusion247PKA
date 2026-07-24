// The permanent Learn path: a Cairn LEARN decision → durable job → this worker automatically sends
// the faithful-clean FULL-DETAIL source (TubeAIR §7.1) into LightRAG → Neo4JStorage → Neo4j.
// NO manual/Larry-in-session step. One authoritative graph; no OwaiConcept projection.
//
// Operational health check (reconcileLearn): a source marked LEARN must end up either searchable +
// represented in the graph, or visibly failed — never a silent "captured but never finished".
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { q } from '../clients/db.mjs';
import { lightrag } from '../clients/lightrag.mjs';

// services/obsidiwikai/src/core/learnIngest.mjs → repo root is four levels up.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const reportPath = (sourceId) => join(repoRoot, 'Team Knowledge', 'Sources', '_raw', sourceId, 'tubeair-report.md');

// The LightRAG ingest artefact = TubeAIR §7.1 "Cleaned reading view" (faithful, full-detail, de-duped).
// NOT the analysis (§1–6) and NOT the raw (§7.2). Throws if unavailable or implausibly short.
export function faithfulClean(sourceId) {
  const p = reportPath(sourceId);
  if (!existsSync(p)) throw new Error(`no tubeair-report for ${sourceId} at ${p}`);
  const md = readFileSync(p, 'utf8').replace(/\r/g, '');
  const out = [];
  let on = false;
  for (const l of md.split('\n')) {
    if (/^###\s*7\.1/.test(l)) { on = true; continue; }
    if (/^###\s*7\.2/.test(l)) { on = false; }
    if (on) out.push(l);
  }
  const clean = out.join('\n').trim();
  if (clean.length < 200) throw new Error(`faithful-clean §7.1 too short for ${sourceId} (${clean.length}c)`);
  return clean;
}

// Drain queued LEARN jobs: KEEP → retained (no learning); LEARN → ingest §7.1 into LightRAG (async
// extraction). Atomic single-worker claim. Idempotent by capture (the enqueue is unique per capture).
export async function runLearnQueue({ limit = 5 } = {}) {
  const rows = (await q(`select * from obsidiwikai.compile_job where state='queued' order by created_at limit $1`, [limit])).rows;
  const out = [];
  for (const job of rows) {
    const claim = await q(`update obsidiwikai.compile_job set state='running', claimed_at=now() where job_id=$1 and state='queued' returning job_id`, [job.job_id]);
    if (claim.rowCount === 0) continue;
    try {
      if (job.treatment === 'keep') {
        await q(`update obsidiwikai.compile_job set state='done', receipt='retained (KEEP — source preserved, not learned)', done_at=now() where job_id=$1`, [job.job_id]);
        out.push({ job_id: job.job_id, state: 'done', treatment: 'keep' });
        continue;
      }
      const clean = faithfulClean(job.source_id);
      const res = await lightrag.ingestText(clean, { source: job.source_id });
      const trackId = res.track_id || res.trackId || null;
      await q(`update obsidiwikai.compile_job set state='ingesting', stats=$2, receipt=$3 where job_id=$1`,
        [job.job_id, JSON.stringify({ track_id: trackId, chars: clean.length }), `ingesting §7.1 faithful-clean (${clean.length}c) → LightRAG/Neo4j`]);
      out.push({ job_id: job.job_id, state: 'ingesting', source: job.source_id, chars: clean.length, track_id: trackId });
    } catch (e) {
      await q(`update obsidiwikai.compile_job set state='failed', error=$2 where job_id=$1`, [job.job_id, String(e.message).slice(0, 400)]);
      out.push({ job_id: job.job_id, state: 'failed', source: job.source_id, error: e.message });
    }
  }
  return out;
}

// HEALTH CHECK — an 'ingesting' LEARN source must become searchable+represented, or fail visibly.
export async function reconcileLearn({ staleMinutes = 30 } = {}) {
  const rows = (await q(`select * from obsidiwikai.compile_job where state='ingesting'`)).rows;
  if (!rows.length) return [];
  let byFile = {};
  try {
    const d = await lightrag.documents();
    const s = d.statuses || d || {};
    for (const [status, arr] of Object.entries(s)) {
      for (const doc of (arr || [])) byFile[doc.file_path || doc.file_source || doc.id] = status;
    }
  } catch { return []; } // LightRAG unreachable → leave state, retry next cycle
  const out = [];
  for (const job of rows) {
    const st = byFile[job.source_id];
    if (st === 'processed') {
      await q(`update obsidiwikai.compile_job set state='done', receipt='searchable + represented in the graph', done_at=now() where job_id=$1`, [job.job_id]);
      // Reflect the learn outcome on the Directus-visible cockpit record: a learned source moves
      // into Warwick's review queue ('pending_warwick_review' is the in-schema state Directus surfaces).
      // Best-effort — no-op if it isn't a youtube source.
      await q(`update cockpit.youtube_source set review_state='pending_warwick_review', learning_count=coalesce(learning_count,0)+1, updated_at=now() where video_id=$1 and review_state='ai_created'`, [job.source_id]).catch(() => {});
      out.push({ job_id: job.job_id, state: 'done', source: job.source_id });
    } else if (st === 'failed') {
      await q(`update obsidiwikai.compile_job set state='failed', error='LightRAG extraction failed' where job_id=$1`, [job.job_id]);
      out.push({ job_id: job.job_id, state: 'failed', source: job.source_id });
    } else {
      const ageMin = (Date.now() - new Date(job.claimed_at || job.created_at).getTime()) / 60000;
      if (ageMin > staleMinutes) {
        await q(`update obsidiwikai.compile_job set state='failed', error='ingest stale — not represented after ${staleMinutes}min' where job_id=$1`, [job.job_id]);
        out.push({ job_id: job.job_id, state: 'failed-stale', source: job.source_id });
      }
    }
  }
  return out;
}
