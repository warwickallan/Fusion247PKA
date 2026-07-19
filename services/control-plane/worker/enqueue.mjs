// BUILD-014 WP-B — durable enqueue.
//
// Inserts one ops.job row AND its 'job.enqueued' lifecycle event in ONE transaction on a
// pinned client (round-2 fix 3 — both reviewers). Previously the job insert and the event
// were separate auto-commit statements: a crash in between left a CLAIMABLE job with no
// enqueued event, so the ledger could not reconstruct the job's birth. Now both halves
// commit together or not at all.
//
// The idempotency_key is UNIQUE in the WP-A schema, so a DUPLICATE enqueue (same key) does
// NOT create a second job — ON CONFLICT DO NOTHING absorbs the collision and we read the
// existing row back. Under READ COMMITTED, ON CONFLICT DO NOTHING blocks on a concurrent
// uncommitted insert of the same key until it commits, then our follow-up SELECT (a fresh
// per-statement snapshot) sees the committed row — so two concurrent same-key enqueues on
// DISTINCT connections still yield exactly one job and one enqueued event.

import { appendEvent, hashPayload } from './events.mjs';

/**
 * enqueue(pool, { jobType, payload, idempotencyKey, maxAttempts?, classification?, buildId? }, hooks?)
 *   -> { job, deduped }
 *
 * `deduped` is true when the idempotency_key already existed (no new row created).
 * `hooks.afterJobInsertBeforeEvent({ client, job, deduped })` is an OPTIONAL test seam
 * invoked INSIDE the transaction, after the job upsert but before the enqueued event —
 * used by the fault-injection proof to abort mid-transaction and assert neither half
 * commits alone. It is never used in production.
 */
export async function enqueue(pool, {
  jobType, payload = {}, idempotencyKey,
  maxAttempts = null, classification = null, buildId = null,
} = {}, hooks = {}) {
  if (!jobType) throw new Error('enqueue: jobType is required');
  if (!idempotencyKey) throw new Error('enqueue: idempotencyKey is required');

  const client = await pool.connect();
  try {
    await client.query('begin');

    const ins = await client.query(
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
      const sel = await client.query(`select * from ops.job where idempotency_key = $1`, [idempotencyKey]);
      job = sel.rows[0];
      deduped = true;
    }

    // Fix 9 (Fable): the idempotency_key is GLOBAL across queues. If a duplicate enqueue
    // reuses a key that belongs to a DIFFERENT jobType, silently absorbing the caller's
    // work into the wrong-type job would lose it. Refuse loudly instead.
    if (deduped && job.queue !== jobType) {
      throw new Error(
        `enqueue: idempotency_key '${idempotencyKey}' already exists on queue '${job.queue}', ` +
        `but this enqueue targets queue '${jobType}'. The key is a global unit-of-work identity — ` +
        `refusing to absorb this work into a different-type job.`);
    }

    if (hooks.afterJobInsertBeforeEvent) {
      await hooks.afterJobInsertBeforeEvent({ client, job, deduped });
    }

    // Lifecycle marker — idempotent on the job identity, so a duplicate enqueue does not
    // duplicate the event either. build_id stays null unless the caller bound a real build.
    await appendEvent(client, {
      buildId,
      deliveryKey: `job:enq:${idempotencyKey}`,
      eventKind: 'job.enqueued',
      actor: 'tower',
      payload: { jobId: String(job.id), jobType, idempotencyKey },
    });

    await client.query('commit');
    return { job, deduped };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
