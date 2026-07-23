// Learn-lane compile queue. Cairn's Learn adapter ENQUEUES here (never blocks on the compile);
// a claim-safe worker runs the compiler asynchronously so the encyclopedia grows on its own.
// Compile is idempotent (source-keyed upsert), so — unlike Honcho delivery — a crashed 'running'
// job is safe to re-run: stale claims simply return to 'queued'.
import { existsSync } from 'node:fs';
import { q } from '../clients/db.mjs';
import { compileSource } from './compiler.mjs';

// learn → full-quality key-content extraction (cost-safe default); keep → source only; deep is opt-in.
function intentFor(treatment) {
  if (treatment === 'keep') return 'keep_raw';
  if (treatment === 'deep_index') return 'deep_index';
  return 'extract';
}

function rawRefFor(sourceId) {
  const guess = `Team Knowledge/Sources/_raw/${sourceId}`;
  return existsSync(`C:/Fusion247PKA/${guess}`) ? guess : null;
}

// Idempotent by capture_id: a replay never queues a second compile for the same object.
export async function enqueueCompileJob(capture, treatment = 'learn') {
  const captureId = String(capture.capture_id || capture.source_id || capture.url || '').trim();
  if (!captureId) throw new Error('compileQueue: capture_id required');
  const sourceId = capture.source_id || capture.url || captureId;
  const r = await q(
    `insert into obsidiwikai.compile_job(capture_id,source_id,source_type,url,title,treatment,state)
     values($1,$2,$3,$4,$5,$6,'queued')
     on conflict (capture_id) do nothing returning job_id`,
    [captureId, sourceId, capture.source_type || null, capture.url || null, capture.title || capture.subject || null, treatment]
  );
  return r.rows[0]?.job_id || null; // null = duplicate → idempotent
}

// Run queued compile jobs. `compile` is injectable for testing (default = the real compiler).
export async function runCompileJobs({ limit = 5, leaseSeconds = 1800, compile = compileSource } = {}) {
  // Reclaim stale 'running' jobs — compile is re-runnable, so just requeue (no fail-safe hold needed).
  await q(`update obsidiwikai.compile_job set state='queued', claimed_at=null where state='running' and claimed_at < now() - make_interval(secs => $1)`, [leaseSeconds]);
  const rows = (await q(`select * from obsidiwikai.compile_job where state='queued' order by created_at limit $1`, [limit])).rows;
  const out = [];
  for (const job of rows) {
    // Atomic single-worker claim.
    const claim = await q(`update obsidiwikai.compile_job set state='running', claimed_at=now() where job_id=$1 and state='queued' returning job_id`, [job.job_id]);
    if (claim.rowCount === 0) continue; // another worker took it
    try {
      const r = await compile({ sourceId: job.source_id, title: job.title || job.source_id, url: job.url, intent: intentFor(job.treatment), rawRef: rawRefFor(job.source_id) });
      await q(`update obsidiwikai.compile_job set state='done', stats=$2, receipt=$3, done_at=now(), error=null where job_id=$1`,
        [job.job_id, JSON.stringify(r?.stats || {}), (r?.card ? 'card + encyclopedia updated' : 'source retained')]);
      out.push({ job_id: job.job_id, state: 'done', stats: r?.stats || {} });
    } catch (e) {
      await q(`update obsidiwikai.compile_job set state='failed', error=$2 where job_id=$1`, [job.job_id, String(e.message).slice(0, 300)]);
      out.push({ job_id: job.job_id, state: 'failed', error: e.message });
    }
  }
  return out;
}
