// BUILD-014 WP-B — durable worker runtime proofs against REAL Postgres.
//
// DB-GATED but NOT silently self-skipping (mirrors WP-A's F8 discipline):
//   - DATABASE_URL UNSET  -> the suite skips with a LOUD message pointing at the runner
//     (worker/test/run-worker-tests.mjs), which provisions a throwaway Postgres and runs
//     this file. A skip is NEVER a pass: the runner fails on 0 executed subtests.
//   - DATABASE_URL SET but `pg` missing -> the suite FAILS (throws), never green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: every test DROPs and
// rebuilds the `ops` schema from the WP-A migration.
//
// The six acceptance proofs (over the WP-A ops.job / ops.agent_event runtime):
//   1. One job + N concurrent workers -> claimed by EXACTLY ONE (genuine multi-connection).
//   2. Worker crash mid-lease -> reclaim -> another worker completes it EXACTLY once
//      (real interleaving: the stale worker's completion is rejected + rolled back).
//   3. Duplicate enqueue (same idempotency_key) -> one job, one effect.
//   4. attempts increment on retry; dead_letter after max_attempts.
//   5. ops.agent_event append-only reconstructs the full lifecycle (enqueued -> claimed ->
//      handler events -> terminal), and remains immutable (UPDATE rejected, 23001).
//   6. Correctness with NOTIFY/Realtime disabled entirely (polling-only loop).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { enqueue } from '../enqueue.mjs';
import { HandlerRegistry } from '../handlers.mjs';
import { Worker, Reclaimer } from '../worker.mjs';
import { createLogger, sleep, waitFor } from '../util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(__dirname, '..', '..', 'db', 'migrations', '001_control_plane_min_schema.sql');
const DB = process.env.DATABASE_URL;

const SILENT = createLogger({ level: 'silent' });

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the WP-B worker ` +
    `proofs. Install pg or use run-worker-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/worker/test/run-worker-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB, max: 12 });
  await pool.query('drop schema if exists ops cascade');
  await pool.query(fs.readFileSync(MIGRATION, 'utf8'));
  return pool;
}

/** Count agent_event rows carrying a given jobId in their payload (lifecycle for one job). */
async function eventsForJob(pool, jobId) {
  const { rows } = await pool.query(
    `select event_kind, delivery_key, payload
       from ops.agent_event
      where payload->>'jobId' = $1
      order by occurred_at, id`, [String(jobId)]);
  return rows;
}

async function jobRow(pool, idempotencyKey) {
  const { rows } = await pool.query(`select * from ops.job where idempotency_key = $1`, [idempotencyKey]);
  return rows[0];
}

/** A handler that records ONE idempotent effect event then succeeds. */
function effectHandler(effectName = 'done') {
  return async (ctx) => {
    ctx.emit('work.done', {
      deliveryKey: ctx.effectKey(effectName),
      payload: { jobId: String(ctx.job.id), effect: effectName },
    });
    return { status: 'succeeded' };
  };
}

// ---------------------------------------------------------------------------
gated('1. one job + N concurrent workers -> claimed by EXACTLY ONE (multi-connection)', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q1', effectHandler());
    const { job } = await enqueue(pool, { jobType: 'q1', idempotencyKey: 'job-1' });

    const N = 6;
    const workers = Array.from({ length: N }, (_, i) =>
      new Worker(pool, reg, { workerId: `w${i}`, leaseSeconds: 30, logger: SILENT }));

    // Genuine concurrency: N processOnce() calls race on distinct pooled connections.
    const results = await Promise.all(workers.map((w) => w.processOnce('q1')));

    const claimed = results.filter((r) => r !== null);
    const succeeded = claimed.filter((r) => r.outcome === 'succeeded');
    assert.equal(claimed.length, 1, 'exactly one worker may claim the single job');
    assert.equal(succeeded.length, 1, 'the one claimer completes it');
    assert.equal(results.filter((r) => r === null).length, N - 1, 'all other workers get no work');

    // Exactly one effect event, and the job is terminal-succeeded.
    const evs = await eventsForJob(pool, job.id);
    const effects = evs.filter((e) => e.event_kind === 'work.done');
    assert.equal(effects.length, 1, 'the effect ran exactly once');
    assert.equal((await jobRow(pool, 'job-1')).status, 'succeeded');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('2. worker crash mid-lease -> reclaim -> another worker completes EXACTLY once', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q2', effectHandler());
    const { job } = await enqueue(pool, { jobType: 'q2', idempotencyKey: 'job-2' });

    const reclaimer = new Reclaimer(pool, { logger: SILENT });
    const workerA = new Worker(pool, reg, { workerId: 'A', leaseSeconds: 60, logger: SILENT });
    const workerB = new Worker(pool, reg, { workerId: 'B', leaseSeconds: 60, logger: SILENT });

    let bResult = null;
    // A runs the handler (buffers its effect) but, right before A commits, we simulate A
    // stalling past its visibility timeout: force-expire A's lease, reclaim it (-> pending),
    // and let B fully claim + run + complete. THEN A's completion txn runs and must be
    // REJECTED (stale lease) and rolled back — so A's buffered effect never lands.
    const aResult = await workerA.processOnce('q2', {
      beforeComplete: async ({ job: aJob }) => {
        await pool.query(
          `update ops.job set lease_deadline_at = now() - interval '1 second' where id = $1`, [aJob.id]);
        const reclaimed = await reclaimer.tick();
        assert.ok(reclaimed.find((r) => String(r.id) === String(aJob.id) && r.status === 'pending'),
          'A\'s expired lease is reclaimed to pending');
        bResult = await workerB.processOnce('q2');
      },
    });

    assert.equal(aResult.outcome, 'completion_failed', 'the stale worker A must fail to complete');
    assert.equal(aResult.error?.code, '23001', 'complete_job rejects the stale lease (restrict_violation)');
    assert.equal(bResult.outcome, 'succeeded', 'worker B completes the reclaimed job');

    const finalJob = await jobRow(pool, 'job-2');
    assert.equal(finalJob.status, 'succeeded', 'the baton is not lost — the job is done');
    assert.equal(finalJob.attempts, 2, 'two attempts: A (crashed) then B (completed)');

    const evs = await eventsForJob(pool, job.id);
    const effects = evs.filter((e) => e.event_kind === 'work.done');
    assert.equal(effects.length, 1, 'EXACTLY ONE effect despite two claims (no duplicate effect)');
    const claimedEvs = evs.filter((e) => e.event_kind === 'job.claimed');
    assert.equal(claimedEvs.length, 2, 'both attempts recorded as claim evidence');
    const terminal = evs.filter((e) => e.event_kind === 'job.succeeded');
    assert.equal(terminal.length, 1, 'exactly one terminal succeeded event');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('3. duplicate enqueue (same idempotency_key) -> one job, one effect', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q3', effectHandler());

    const first = await enqueue(pool, { jobType: 'q3', idempotencyKey: 'dup-1', payload: { v: 1 } });
    const second = await enqueue(pool, { jobType: 'q3', idempotencyKey: 'dup-1', payload: { v: 2 } });

    assert.equal(first.deduped, false, 'first enqueue creates the job');
    assert.equal(second.deduped, true, 'second enqueue is deduped by the unique idempotency_key');
    assert.equal(String(first.job.id), String(second.job.id), 'both point at the same job row');

    const { rows: countRows } = await pool.query(
      `select count(*)::int as n from ops.job where idempotency_key = 'dup-1'`);
    assert.equal(countRows[0].n, 1, 'exactly one job row exists for the key');

    // Process it (only one job to process) -> exactly one effect.
    const w = new Worker(pool, reg, { workerId: 'w', leaseSeconds: 30, logger: SILENT });
    const r = await w.processOnce('q3');
    assert.equal(r.outcome, 'succeeded');
    assert.equal(await w.processOnce('q3'), null, 'no second job to claim');

    const evs = await eventsForJob(pool, first.job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'work.done').length, 1, 'one effect');
    assert.equal(evs.filter((e) => e.event_kind === 'job.enqueued').length, 1, 'one enqueued event too');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('4. attempts increment on retry; dead_letter after max_attempts', async () => {
  const pool = await freshPool();
  try {
    // A handler that ALWAYS throws -> every attempt is a crash-equivalent failure.
    const reg = new HandlerRegistry().register('q4', async () => { throw new Error('boom'); });
    const MAX = 3;
    await enqueue(pool, { jobType: 'q4', idempotencyKey: 'retry-1', maxAttempts: MAX });

    const reclaimer = new Reclaimer(pool, { logger: SILENT });
    const w = new Worker(pool, reg, { workerId: 'w', leaseSeconds: 60, logger: SILENT });

    const seenAttempts = [];
    for (let i = 1; i <= MAX; i++) {
      const r = await w.processOnce('q4');
      assert.equal(r.outcome, 'handler_error', `attempt ${i} fails in the handler`);
      seenAttempts.push(r.job.attempts);
      // expire the lease + reclaim -> pending (or dead_letter once exhausted)
      await pool.query(
        `update ops.job set lease_deadline_at = now() - interval '1 second' where idempotency_key = 'retry-1'`);
      await reclaimer.tick();
    }
    assert.deepEqual(seenAttempts, [1, 2, 3], 'attempts increment on each claim/retry');

    const dead = await jobRow(pool, 'retry-1');
    assert.equal(dead.status, 'dead_letter', 'the job is dead-lettered after max_attempts');
    assert.equal(dead.attempts, MAX, 'attempts capped at the retry budget');
    assert.ok(dead.dead_lettered_at, 'dead_lettered_at stamped');

    // A dead-lettered job is not claimable and never produced a successful effect.
    assert.equal(await w.processOnce('q4'), null, 'a dead-lettered job is not re-claimed');
    const evs = await eventsForJob(pool, dead.id);
    assert.equal(evs.filter((e) => e.event_kind === 'job.succeeded').length, 0, 'never succeeded');
    assert.equal(evs.filter((e) => e.event_kind === 'job.attempt_failed').length, MAX, 'each failed attempt recorded');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('5. agent_event append-only reconstructs the full lifecycle + stays immutable', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q5', async (ctx) => {
      // a per-attempt progress event + the idempotent effect event
      ctx.emit('work.progress', { payload: { jobId: String(ctx.job.id), step: 'started' } });
      ctx.emit('work.done', { deliveryKey: ctx.effectKey('done'), payload: { jobId: String(ctx.job.id) } });
      return { status: 'succeeded' };
    });
    const { job } = await enqueue(pool, { jobType: 'q5', idempotencyKey: 'life-1' });

    const w = new Worker(pool, reg, { workerId: 'w', leaseSeconds: 30, logger: SILENT });
    const r = await w.processOnce('q5');
    assert.equal(r.outcome, 'succeeded');

    const evs = await eventsForJob(pool, job.id);
    const kinds = evs.map((e) => e.event_kind);
    // full lifecycle, in order
    assert.deepEqual(kinds, ['job.enqueued', 'job.claimed', 'work.progress', 'work.done', 'job.succeeded'],
      `lifecycle reconstructed in order (got: ${kinds.join(' -> ')})`);

    // append-only: an existing event cannot be mutated (defence-in-depth trigger, 23001)
    const someId = evs[0] ? (await pool.query(
      `select id from ops.agent_event where payload->>'jobId'=$1 limit 1`, [String(job.id)])).rows[0].id : null;
    let upErr = null;
    try { await pool.query(`update ops.agent_event set event_kind='tamper' where id=$1`, [someId]); }
    catch (e) { upErr = e; }
    assert.ok(upErr, 'agent_event UPDATE must be rejected');
    assert.equal(upErr.code, '23001', 'append-only trigger rejects the edit (restrict_violation)');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('6. correctness with NOTIFY/Realtime DISABLED (polling-only loop drives it)', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q6', effectHandler());
    const reclaimer = new Reclaimer(pool, { intervalMs: 100, logger: SILENT });
    const worker = new Worker(pool, reg, { workerId: 'poll', leaseSeconds: 5, pollIntervalMs: 40, logger: SILENT });

    // Start the poll loop + reclaim ticker. There is NO LISTEN/NOTIFY anywhere in this
    // runtime — the job below is discovered and processed purely by polling claim_job.
    reclaimer.start();
    const loop = worker.runLoop(['q6']);

    // Enqueue AFTER the loop is already polling an empty queue.
    await sleep(80);
    const { job } = await enqueue(pool, { jobType: 'q6', idempotencyKey: 'poll-1' });

    const done = await waitFor(async () => {
      const { rows } = await pool.query(
        `select count(*)::int as n from ops.agent_event
          where event_kind='work.done' and payload->>'jobId'=$1`, [String(job.id)]);
      return rows[0].n === 1;
    }, { timeoutMs: 8000, intervalMs: 50 });

    worker.stop();
    reclaimer.stop();
    await loop;

    assert.ok(done, 'the polling loop processed the job with no NOTIFY/Realtime at all');
    assert.equal((await jobRow(pool, 'poll-1')).status, 'succeeded');
    const evs = await eventsForJob(pool, job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'work.done').length, 1, 'exactly one effect via polling');
  } finally { await pool.end(); }
});
