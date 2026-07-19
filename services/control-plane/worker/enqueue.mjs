// BUILD-014 WP-B — durable enqueue.
//
// Inserts one ops.job row. The idempotency_key is UNIQUE in the WP-A schema, so a
// DUPLICATE enqueue (same key) does NOT create a second job — ON CONFLICT DO NOTHING
// absorbs the collision and we read the existing row back. jobType maps to the logical
// `queue` column (the worker polls by queue and dispatches by the same key).

import { appendEvent, hashPayload } from './events.mjs';

/**
 * enqueue(pool, { jobType, payload, idempotencyKey, maxAttempts?, classification?, buildId? })
 *   -> { job, deduped }
 *
 * `deduped` is true when the idempotency_key already existed (no new row created).
 * Also appends a one-time 'job.enqueued' lifecycle event (idempotent on the same key).
 */
export async function enqueue(pool, {
  jobType, payload = {}, idempotencyKey,
  maxAttempts = null, classification = null, buildId = null,
} = {}) {
  if (!jobType) throw new Error('enqueue: jobType is required');
  if (!idempotencyKey) throw new Error('enqueue: idempotencyKey is required');

  const ins = await pool.query(
    `insert into ops.job (queue, idempotency_key, payload, payload_hash, classification, max_attempts)
     values ($1, $2, $3::jsonb, $4,
             coalesce($5, 'internal')::ops.data_classification,
             coalesce($6, 5))
     on conflict (idempotency_key) do nothing
     returning *`,
    [jobType, idempotencyKey, JSON.stringify(payload), hashPayload(payload), classification, maxAttempts]);

  let job;
  let deduped;
  if (ins.rowCount === 1) {
    job = ins.rows[0];
    deduped = false;
  } else {
    const sel = await pool.query(`select * from ops.job where idempotency_key = $1`, [idempotencyKey]);
    job = sel.rows[0];
    deduped = true;
  }

  // Lifecycle marker — idempotent on the job identity, so a duplicate enqueue does not
  // duplicate the event either. build_id stays null unless the caller bound a real build.
  await appendEvent(pool, {
    buildId,
    deliveryKey: `job:enq:${idempotencyKey}`,
    eventKind: 'job.enqueued',
    actor: 'tower',
    payload: { jobId: String(job.id), jobType, idempotencyKey },
  });

  return { job, deduped };
}
