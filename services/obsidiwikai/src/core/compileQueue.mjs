// Learn-lane job queue. Cairn's Learn adapter ENQUEUES here (never blocks on ingest); the
// learn-worker (src/core/learnIngest.mjs) drains it, sending the faithful-clean §7.1 source into
// LightRAG → Neo4JStorage → Neo4j. One authoritative graph — there is NO OwaiConcept projection.
// Idempotent by capture_id: a replay never queues a second job for the same object.
import { q } from '../clients/db.mjs';

export async function enqueueCompileJob(capture, treatment = 'learn') {
  const captureId = String(capture.capture_id || capture.source_id || capture.url || '').trim();
  if (!captureId) throw new Error('compileQueue: capture_id required');
  const sourceId = capture.source_id || capture.url || captureId;
  const norm = treatment === 'keep' ? 'keep' : 'learn';
  const r = await q(
    `insert into obsidiwikai.compile_job(capture_id,source_id,source_type,url,title,treatment,state)
     values($1,$2,$3,$4,$5,$6,'queued')
     on conflict (capture_id) do nothing returning job_id`,
    [captureId, sourceId, capture.source_type || null, capture.url || null, capture.title || capture.subject || null, norm]
  );
  return r.rows[0]?.job_id || null; // null = duplicate → idempotent
}
