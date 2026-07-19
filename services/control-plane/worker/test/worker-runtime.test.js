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
// The acceptance proofs (over the WP-A ops.job / ops.agent_event runtime):
//   1. One job + N concurrent workers -> claimed by EXACTLY ONE (genuine multi-connection).
//   2. Worker crash mid-lease -> reclaim -> another worker completes it EXACTLY once
//      (real interleaving: the stale worker's completion is rejected + rolled back).
//   3. Duplicate enqueue (same idempotency_key) -> one job, one effect.
//   4. attempts increment on retry; dead_letter after max_attempts.
//   5. ops.agent_event append-only reconstructs the full lifecycle (enqueued -> claimed ->
//      handler events -> terminal), and remains immutable (UPDATE rejected, 23001).
//   6. Correctness with NOTIFY/Realtime disabled entirely (polling-only loop).
// ROUND-2 review fixes (Codex + Fable consolidation):
//   7.  effect-key INJECTIVITY despite ':' in idempotency_key/name (Codex CRIT).
//   8.  malformed handler return (undefined / unknown status) is NOT success (Codex MAJOR).
//   9.  enqueue is ATOMIC: neither the job nor the enqueued event commits alone (both).
//   10. a caller deliveryKey in the reserved lifecycle namespace is rejected (Codex HIGH).
//   11. reclaimer emits idempotent lease_reclaimed / dead_lettered ledger events (Fable).
//   12. graceful failed -> pending -> retried -> effect exactly once; per-attempt terminals (Fable).
//   13. graceful failed at attempts==max_attempts -> dead_letter (+ ledger event) (Fable).
//   14. cross-queue idempotency_key reuse is refused (Fable).
//   15. concurrent same-key enqueues -> one job + one enqueued event (both).
// ROUND-3 review fixes (final targeted pass):
//   16. reclaim atomicity — a fault between reclaim and its events commits NEITHER (mirrors #9).
//   17. a handler-error message carrying a secret-shaped token never reaches the ledger OR logs.
//   18. a throwing `status` getter (and null / a primitive / a missing status) routes through
//       the invalid_result / handler_error path, never an unhandled escape or silent success.
//   19. default per-attempt key hardening: eventKind 'terminal:failed' cannot shadow the runtime
//       terminal, and two same-kind emits in one attempt both land (distinct keys).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { enqueue } from '../enqueue.mjs';
import { HandlerRegistry } from '../handlers.mjs';
import { Worker, Reclaimer } from '../worker.mjs';
import { effectDeliveryKey, assertEventKindAllowed } from '../events.mjs';
import { createLogger, sanitizeError, sleep, waitFor } from '../util.mjs';

/** A logger that RECORDS every line (with fields) instead of writing — for leak assertions. */
function recordingLogger(sink) {
  const make = () => ({
    error: (msg, fields) => { sink.push({ level: 'error', msg, fields }); },
    warn: (msg, fields) => { sink.push({ level: 'warn', msg, fields }); },
    info: (msg, fields) => { sink.push({ level: 'info', msg, fields }); },
    debug: (msg, fields) => { sink.push({ level: 'debug', msg, fields }); },
    child: () => make(),
  });
  return make();
}

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
      effect: effectName,
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
      ctx.emit('work.done', { effect: 'done', payload: { jobId: String(ctx.job.id) } });
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

// ===========================================================================
// ROUND-2 review fixes — additional proofs (Codex + Fable consolidation).
// ===========================================================================

// ---------------------------------------------------------------------------
// Fix 1 (Codex CRIT) — effect-key INJECTIVITY. The old effect:${key}:${name}
// template collided whenever key/name contained ':'. The hashed versioned tuple
// must keep distinct (key,name) pairs distinct — proven at the unit level AND by
// two jobs whose OLD keys would have flattened to the same string both landing.
gated('7. effect keys are INJECTIVE despite ":" in idempotency_key/name — distinct effects both land', async () => {
  // Unit: the two tuples the OLD template flattened to `effect:a::b`.
  assert.notEqual(effectDeliveryKey('a:', 'b'), effectDeliveryKey('a', ':b'),
    'colliding (key,name) tuples must yield DISTINCT delivery keys');

  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q7', async (ctx) => {
      ctx.emit('work.done', { effect: ctx.job.payload.effectName, payload: { jobId: String(ctx.job.id) } });
      return { status: 'succeeded' };
    });
    // Job X: key 'k:1', name 'n'  |  Job Y: key 'k', name '1:n'.  OLD encoding: BOTH `effect:k:1:n`.
    const { job: jx } = await enqueue(pool, { jobType: 'q7', idempotencyKey: 'k:1', payload: { effectName: 'n' } });
    const { job: jy } = await enqueue(pool, { jobType: 'q7', idempotencyKey: 'k', payload: { effectName: '1:n' } });

    const w = new Worker(pool, reg, { workerId: 'w7', leaseSeconds: 30, logger: SILENT });
    assert.equal((await w.processOnce('q7')).outcome, 'succeeded');
    assert.equal((await w.processOnce('q7')).outcome, 'succeeded');
    assert.equal(await w.processOnce('q7'), null, 'both jobs processed');

    const kx = (await eventsForJob(pool, jx.id)).filter((e) => e.event_kind === 'work.done');
    const ky = (await eventsForJob(pool, jy.id)).filter((e) => e.event_kind === 'work.done');
    assert.equal(kx.length, 1, 'job X effect landed');
    assert.equal(ky.length, 1, 'job Y effect landed (would have been dropped by the old collision)');
    assert.notEqual(kx[0].delivery_key, ky[0].delivery_key, 'the two effects have DISTINCT delivery keys');
    assert.equal(kx[0].delivery_key, effectDeliveryKey('k:1', 'n'));
    assert.equal(ky[0].delivery_key, effectDeliveryKey('k', '1:n'));
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 2 (Codex MAJOR) — a malformed handler return is NOT success. undefined and
// a typo'd status must route through the failure/retry path, never silently commit.
gated('8. malformed handler return (undefined / unknown status) is NOT success', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry()
      .register('undef', async () => { /* returns undefined */ })
      .register('bogus', async () => ({ status: 'donezo' }));
    await enqueue(pool, { jobType: 'undef', idempotencyKey: 'u-1', maxAttempts: 1 });
    await enqueue(pool, { jobType: 'bogus', idempotencyKey: 'b-1', maxAttempts: 1 });

    const w = new Worker(pool, reg, { workerId: 'w8', leaseSeconds: 60, logger: SILENT });
    assert.equal((await w.processOnce('undef')).outcome, 'invalid_result', 'undefined return is not success');
    assert.equal((await w.processOnce('bogus')).outcome, 'invalid_result', 'unknown status is not success');

    // Not completed: still leased (awaiting reclaim), never a terminal succeeded.
    const ju = await jobRow(pool, 'u-1');
    assert.equal(ju.status, 'leased', 'undefined-return job left for reclaim, not succeeded');
    assert.equal((await jobRow(pool, 'b-1')).status, 'leased', 'unknown-status job left for reclaim, not succeeded');
    const evu = await eventsForJob(pool, ju.id);
    assert.equal(evu.filter((e) => e.event_kind === 'job.succeeded').length, 0, 'never succeeded');
    assert.equal(evu.filter((e) => e.event_kind === 'job.invalid_result').length, 1, 'invalid_result recorded on the ledger');

    // On reclaim (max_attempts=1, already at 1 attempt) the ambiguous work dead-letters —
    // parked for a human, NOT silently marked done.
    await pool.query(`update ops.job set lease_deadline_at = now() - interval '1 second' where status='leased'`);
    const reclaimed = await new Reclaimer(pool, { logger: SILENT }).tick();
    assert.equal(reclaimed.length, 2, 'both stuck jobs reclaimed');
    assert.ok(reclaimed.every((r) => r.status === 'dead_letter'), 'exhausted invalid-result jobs dead-letter, never succeed');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 3 (both) — enqueue is ATOMIC: a fault between the job insert and the
// enqueued event must commit NEITHER half.
gated('9. enqueue atomicity — a fault between job insert and enqueued event commits neither', async () => {
  const pool = await freshPool();
  try {
    let threw = null;
    try {
      await enqueue(pool, { jobType: 'q9', idempotencyKey: 'atomic-1' }, {
        afterJobInsertBeforeEvent: async () => { throw new Error('injected fault'); },
      });
    } catch (e) { threw = e; }
    assert.ok(threw, 'the injected fault propagates out of enqueue');

    const jobs = (await pool.query(`select count(*)::int n from ops.job where idempotency_key='atomic-1'`)).rows[0].n;
    assert.equal(jobs, 0, 'NO job row committed (the insert rolled back with the txn)');
    const evs = (await pool.query(`select count(*)::int n from ops.agent_event where delivery_key='job:enq:atomic-1'`)).rows[0].n;
    assert.equal(evs, 0, 'NO enqueued event committed either — neither half lands alone');

    // A clean re-enqueue afterwards still yields exactly one job + one enqueued event.
    const { deduped } = await enqueue(pool, { jobType: 'q9', idempotencyKey: 'atomic-1' });
    assert.equal(deduped, false, 'the earlier abort left nothing behind — this is a fresh insert');
    const e2 = (await pool.query(`select count(*)::int n from ops.agent_event where delivery_key='job:enq:atomic-1'`)).rows[0].n;
    assert.equal(e2, 1, 'the retry enqueue lands exactly one enqueued event');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 4 (Codex HIGH) — a caller deliveryKey inside the reserved lifecycle
// namespace is REJECTED, never read as an already-delivered success.
gated('10. a caller deliveryKey colliding with the reserved lifecycle namespace is rejected', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q10', async (ctx) => {
      // Try to hand-craft a key in another job's reserved terminal slot.
      ctx.emit('work.done', { deliveryKey: 'job:999999:terminal:succeeded', payload: { jobId: String(ctx.job.id) } });
      return { status: 'succeeded' };
    });
    const { job } = await enqueue(pool, { jobType: 'q10', idempotencyKey: 'guard-1', maxAttempts: 1 });
    const w = new Worker(pool, reg, { workerId: 'w10', leaseSeconds: 60, logger: SILENT });
    const r = await w.processOnce('q10');
    assert.equal(r.outcome, 'handler_error', 'the reserved-namespace emit throws -> crash-equivalent, not success');

    const forged = (await pool.query(
      `select count(*)::int n from ops.agent_event where delivery_key='job:999999:terminal:succeeded'`)).rows[0].n;
    assert.equal(forged, 0, 'the forged reserved key never landed as an event');
    const evs = await eventsForJob(pool, job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'job.succeeded').length, 0, 'the job did NOT complete on a rejected key');
    assert.notEqual((await jobRow(pool, 'guard-1')).status, 'succeeded', 'the job is not marked done');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 6 (Fable) — the reclaimer emits idempotent lease_reclaimed / dead_lettered
// ledger events so the lifecycle is reconstructable from ops.agent_event alone.
gated('11. reclaimer emits idempotent lease_reclaimed / dead_lettered ledger events', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q11', async () => { throw new Error('boom'); });
    await enqueue(pool, { jobType: 'q11', idempotencyKey: 'rc-1', maxAttempts: 2 });
    const reclaimer = new Reclaimer(pool, { logger: SILENT });
    const w = new Worker(pool, reg, { workerId: 'w11', leaseSeconds: 60, logger: SILENT });

    // Attempt 1: throw -> expire -> reclaim -> pending (job.lease_reclaimed).
    await w.processOnce('q11');
    await pool.query(`update ops.job set lease_deadline_at = now() - interval '1 second' where idempotency_key='rc-1'`);
    assert.equal((await reclaimer.tick())[0].status, 'pending', 'attempt-1 reclaim returns to pending');
    const job = await jobRow(pool, 'rc-1');
    assert.equal((await eventsForJob(pool, job.id)).filter((e) => e.event_kind === 'job.lease_reclaimed').length, 1,
      'a lease_reclaimed event is on the ledger');
    // Idempotent across ticks: nothing left to reclaim, no duplicate emitted.
    await reclaimer.tick();
    assert.equal((await eventsForJob(pool, job.id)).filter((e) => e.event_kind === 'job.lease_reclaimed').length, 1,
      'reclaim event is not duplicated');

    // Attempt 2: throw -> expire -> reclaim -> dead_letter (job.dead_lettered).
    await w.processOnce('q11');
    await pool.query(`update ops.job set lease_deadline_at = now() - interval '1 second' where idempotency_key='rc-1'`);
    assert.equal((await reclaimer.tick())[0].status, 'dead_letter', 'attempt-2 reclaim dead-letters (budget exhausted)');
    const evs = await eventsForJob(pool, job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'job.dead_lettered').length, 1, 'a dead_lettered event is on the ledger');
    const kinds = new Set(evs.map((e) => e.event_kind));
    assert.ok(kinds.has('job.enqueued') && kinds.has('job.claimed')
      && kinds.has('job.lease_reclaimed') && kinds.has('job.dead_lettered'),
      `ledger reconstructs the reclaim + dead-letter lifecycle (got: ${[...kinds].join(', ')})`);
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 7 + 8 (Fable) — graceful {status:'failed'} path has real coverage:
// pending -> retried -> effect EXACTLY once; and each failed terminal is
// per-attempt (not dedup-collapsed against attempt 1).
gated('12. graceful failed -> pending -> retried -> effect exactly once; per-attempt terminals', async () => {
  const pool = await freshPool();
  try {
    let calls = 0;
    const reg = new HandlerRegistry().register('q12', async (ctx) => {
      calls += 1;
      if (calls < 3) return { status: 'failed' };
      ctx.emit('work.done', { effect: 'done', payload: { jobId: String(ctx.job.id) } });
      return { status: 'succeeded' };
    });
    const { job } = await enqueue(pool, { jobType: 'q12', idempotencyKey: 'gf-1', maxAttempts: 5 });
    const w = new Worker(pool, reg, { workerId: 'w12', leaseSeconds: 60, logger: SILENT });

    assert.equal((await w.processOnce('q12')).outcome, 'failed', 'attempt 1 graceful-failed');
    assert.equal((await jobRow(pool, 'gf-1')).status, 'pending', 'immediately back to pending (no reclaim needed)');
    assert.equal((await w.processOnce('q12')).outcome, 'failed', 'attempt 2 graceful-failed');
    assert.equal((await w.processOnce('q12')).outcome, 'succeeded', 'attempt 3 succeeds');

    const finalJob = await jobRow(pool, 'gf-1');
    assert.equal(finalJob.status, 'succeeded');
    assert.equal(finalJob.attempts, 3, 'three attempts');

    const evs = await eventsForJob(pool, job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'work.done').length, 1, 'effect ran EXACTLY once across the retries');
    const failed = evs.filter((e) => e.event_kind === 'job.failed');
    assert.equal(failed.length, 2, 'both graceful-failed terminals survive on the ledger (per-attempt keys)');
    assert.equal(new Set(failed.map((e) => e.delivery_key)).size, 2, 'the two failed terminals have DISTINCT keys');
    assert.equal(evs.filter((e) => e.event_kind === 'job.succeeded').length, 1, 'one succeeded terminal (singleton)');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 8 (Fable) — graceful-failed at attempts==max_attempts dead-letters, with a
// ledger event, and never succeeds.
gated('13. graceful failed at attempts==max_attempts -> dead_letter (+ ledger event)', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q13', async () => ({ status: 'failed' }));
    const MAX = 2;
    const { job } = await enqueue(pool, { jobType: 'q13', idempotencyKey: 'gd-1', maxAttempts: MAX });
    const w = new Worker(pool, reg, { workerId: 'w13', leaseSeconds: 60, logger: SILENT });

    assert.equal((await w.processOnce('q13')).outcome, 'failed', 'attempt 1');
    assert.equal((await jobRow(pool, 'gd-1')).status, 'pending', 'still retryable after attempt 1');
    assert.equal((await w.processOnce('q13')).outcome, 'failed', 'attempt 2 (budget now exhausted)');

    const dead = await jobRow(pool, 'gd-1');
    assert.equal(dead.status, 'dead_letter', 'graceful-failed at max_attempts dead-letters immediately');
    assert.equal(dead.attempts, MAX);
    assert.ok(dead.dead_lettered_at, 'dead_lettered_at stamped');
    const evs = await eventsForJob(pool, job.id);
    assert.equal(evs.filter((e) => e.event_kind === 'job.dead_lettered').length, 1, 'graceful-exhaustion dead-letter on the ledger');
    assert.equal(evs.filter((e) => e.event_kind === 'job.succeeded').length, 0, 'never succeeded');
    assert.equal(await w.processOnce('q13'), null, 'a dead-lettered job is not re-claimed');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 9 (Fable) — reusing an idempotency_key on a DIFFERENT queue is refused, so
// the caller's work is never silently absorbed into a different-type job.
gated('14. cross-queue idempotency_key reuse is refused (no silent cross-type absorption)', async () => {
  const pool = await freshPool();
  try {
    assert.equal((await enqueue(pool, { jobType: 'typeA', idempotencyKey: 'x-1' })).deduped, false);
    let threw = null;
    try { await enqueue(pool, { jobType: 'typeB', idempotencyKey: 'x-1' }); }
    catch (e) { threw = e; }
    assert.ok(threw, 'a cross-queue key reuse throws');
    assert.match(String(threw.message), /different-type job|already exists on queue/);
    const rows = (await pool.query(`select queue from ops.job where idempotency_key='x-1'`)).rows;
    assert.equal(rows.length, 1, 'still exactly one job');
    assert.equal(rows[0].queue, 'typeA', 'and it is still the original type');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 10 (both) — two concurrent same-key enqueues on DISTINCT connections yield
// exactly one job and one truthful enqueued event.
gated('15. concurrent same-key enqueues (distinct connections) -> one job + one enqueued event', async () => {
  const pool = await freshPool();
  try {
    const [a, b] = await Promise.all([
      enqueue(pool, { jobType: 'q15', idempotencyKey: 'race-1', payload: { v: 1 } }),
      enqueue(pool, { jobType: 'q15', idempotencyKey: 'race-1', payload: { v: 2 } }),
    ]);
    assert.equal(String(a.job.id), String(b.job.id), 'both enqueues resolve to the same job row');
    assert.equal([a.deduped, b.deduped].filter(Boolean).length, 1, 'exactly one of the two is deduped');
    const jobs = (await pool.query(`select count(*)::int n from ops.job where idempotency_key='race-1'`)).rows[0].n;
    assert.equal(jobs, 1, 'exactly one job row');
    const evs = (await pool.query(`select count(*)::int n from ops.agent_event where delivery_key='job:enq:race-1'`)).rows[0].n;
    assert.equal(evs, 1, 'exactly one truthful enqueued event');
  } finally { await pool.end(); }
});

// ===========================================================================
// ROUND-3 review fixes — final targeted pass.
// ===========================================================================

// ---------------------------------------------------------------------------
// Fix 1 (round-3) — reclaim is ATOMIC (mirrors enqueue). A fault between
// reclaim_expired_leases() and its ledger events must commit NEITHER the state
// transition NOR the event; a clean retry then reclaims + emits.
gated('16. reclaim atomicity — a fault between reclaim and its events commits neither', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry().register('q16', async () => { throw new Error('boom'); });
    const { job } = await enqueue(pool, { jobType: 'q16', idempotencyKey: 'ra-1', maxAttempts: 5 });
    const w = new Worker(pool, reg, { workerId: 'w16', leaseSeconds: 60, logger: SILENT });

    // One crash-equivalent attempt leaves the job LEASED; then force-expire its lease.
    assert.equal((await w.processOnce('q16')).outcome, 'handler_error');
    assert.equal((await jobRow(pool, 'ra-1')).status, 'leased', 'job is leased awaiting reclaim');
    await pool.query(`update ops.job set lease_deadline_at = now() - interval '1 second' where idempotency_key='ra-1'`);

    const reclaimer = new Reclaimer(pool, { logger: SILENT });

    // Inject a fault INSIDE the reclaim transaction, after reclaim_expired_leases() has moved
    // the row (in-txn) but before its ledger events. The whole pass must roll back.
    let threw = null;
    try {
      await reclaimer.tick({
        afterReclaimBeforeEvents: async ({ rows }) => {
          assert.ok(rows.find((r) => String(r.id) === String(job.id)),
            'reclaim_expired_leases returned the expired job inside the txn');
          throw new Error('injected fault mid-reclaim');
        },
      });
    } catch (e) { threw = e; }
    assert.ok(threw, 'the injected fault propagates out of tick');

    // Neither half committed: the job is STILL leased, and NO reclaim event landed.
    assert.equal((await jobRow(pool, 'ra-1')).status, 'leased',
      'the state transition rolled back — job is still leased, not pending');
    const afterFault = await eventsForJob(pool, job.id);
    assert.equal(afterFault.filter((e) => e.event_kind === 'job.lease_reclaimed').length, 0,
      'no lease_reclaimed event committed alongside the rolled-back transition');

    // A clean retry now reclaims AND emits — both together.
    const rows = await reclaimer.tick();
    assert.ok(rows.find((r) => String(r.id) === String(job.id) && r.status === 'pending'),
      'the clean retry reclaims the job to pending');
    assert.equal((await jobRow(pool, 'ra-1')).status, 'pending', 'job is now back to pending');
    const afterClean = await eventsForJob(pool, job.id);
    assert.equal(afterClean.filter((e) => e.event_kind === 'job.lease_reclaimed').length, 1,
      'exactly one lease_reclaimed event now on the ledger (state + evidence committed together)');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 2 (round-3) — a handler error whose MESSAGE contains a secret-shaped token
// must never surface in the ledger row OR the structured log fields. The sanitised
// shape carries only a fixed class/code + correlationId + messageLength — no
// message-derived text (the old allow-list `summary` would have kept it verbatim).
gated('17. a secret-shaped token in an error message never reaches the ledger or the logs', async () => {
  const SECRET = 'ABC123SECRETtokenXYZ789'; // alphanumeric — survived the old summary allow-list
  const pool = await freshPool();
  const logs = [];
  try {
    const reg = new HandlerRegistry().register('q17', async () => {
      const err = new Error(`auth failed for credential ${SECRET} at https://api.example/secret`);
      err.code = SECRET; // even a secret smuggled onto err.code must be dropped (unknown shape)
      throw err;
    });
    const { job } = await enqueue(pool, { jobType: 'q17', idempotencyKey: 'sec-1', maxAttempts: 1 });
    const w = new Worker(pool, reg, { workerId: 'w17', leaseSeconds: 60, logger: recordingLogger(logs) });

    const r = await w.processOnce('q17');
    assert.equal(r.outcome, 'handler_error', 'the throwing handler is a crash-equivalent');

    // (a) LEDGER: the attempt_failed row (and every row for this job) is secret-free.
    const evs = await eventsForJob(pool, job.id);
    const failed = evs.filter((e) => e.event_kind === 'job.attempt_failed');
    assert.equal(failed.length, 1, 'the failed attempt is on the ledger');
    const ledgerText = JSON.stringify(evs);
    assert.ok(!ledgerText.includes(SECRET), 'no secret token anywhere in the ledger rows');
    // the sanitised shape is present and message-free
    assert.equal(failed[0].payload.errorClass, 'Error', 'fixed classification recorded');
    assert.equal(failed[0].payload.errorCode, null, 'a secret-shaped err.code was dropped (unknown shape)');
    assert.equal(typeof failed[0].payload.messageLength, 'number', 'messageLength is a signal, not the bytes');
    assert.equal(failed[0].payload.summary, undefined, 'there is NO message-derived summary field');

    // (b) LOGS: no captured structured log line carries the secret in any field or message.
    assert.ok(logs.length > 0, 'the worker emitted structured logs');
    const logText = JSON.stringify(logs);
    assert.ok(!logText.includes(SECRET), 'no secret token anywhere in the structured logs');

    // Unit: sanitizeError itself never emits a message-derived field, even given a rich message.
    const safe = sanitizeError(new TypeError(`boom ${SECRET}`));
    assert.ok(!JSON.stringify(safe).includes(SECRET), 'sanitizeError output is secret-free');
    assert.equal(safe.summary, undefined, 'sanitizeError emits no summary');
    assert.equal(safe.errorClass, 'TypeError', 'known class preserved');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 3 (round-3) — result.status is read INSIDE the handler try/catch, so a
// throwing getter / hostile proxy routes through the sanitised failure path, and
// null / a primitive / a missing status route through invalid_result. Never an
// unhandled escape, never a silent success.
gated('18. a throwing status getter (and null / primitive / missing) is not an escape or a success', async () => {
  const pool = await freshPool();
  try {
    const reg = new HandlerRegistry()
      .register('thrower', async () => ({ get status() { throw new Error('hostile getter'); } }))
      .register('nully', async () => null)
      .register('prim', async () => 42)
      .register('missing', async () => ({}));
    for (const [q, key] of [['thrower', 't-1'], ['nully', 'n-1'], ['prim', 'p-1'], ['missing', 'm-1']]) {
      await enqueue(pool, { jobType: q, idempotencyKey: key, maxAttempts: 1 });
    }
    const w = new Worker(pool, reg, { workerId: 'w18', leaseSeconds: 60, logger: SILENT });

    const cases = [
      { q: 'thrower', key: 't-1', expect: ['handler_error'] }, // caught inside the try
      { q: 'nully', key: 'n-1', expect: ['invalid_result'] },
      { q: 'prim', key: 'p-1', expect: ['invalid_result'] },
      { q: 'missing', key: 'm-1', expect: ['invalid_result'] },
    ];
    for (const c of cases) {
      const r = await w.processOnce(c.q);
      assert.ok(c.expect.includes(r.outcome),
        `${c.q}: outcome '${r.outcome}' routes through ${c.expect.join('/')} (no unhandled escape)`);
      const jr = await jobRow(pool, c.key);
      assert.notEqual(jr.status, 'succeeded', `${c.q}: job is NOT silently succeeded`);
      const evs = await eventsForJob(pool, jr.id);
      assert.equal(evs.filter((e) => e.event_kind === 'job.succeeded').length, 0, `${c.q}: no succeeded terminal`);
      // an explicit ledger event marks the failed/invalid attempt (attempt_failed or invalid_result)
      const marked = evs.filter((e) => e.event_kind === 'job.attempt_failed' || e.event_kind === 'job.invalid_result');
      assert.equal(marked.length, 1, `${c.q}: the bad attempt is recorded on the ledger`);
    }
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
// Fix 4 (round-3) — default per-attempt key hardening. (a) An eventKind carrying ':'
// (e.g. 'terminal:failed') is rejected loudly, so it can never shadow the runtime's own
// terminal slot; the runtime's legitimate terminal still lands. (b) Two same-kind emits
// in one attempt both land, on DISTINCT keys, instead of the second being silently dropped.
gated('19. default eventKind key hardening — no reserved-slot shadow; repeated same-kind emits both land', async () => {
  // Unit: the guard rejects ':' loudly and accepts a dotted kind.
  assert.throws(() => assertEventKindAllowed('terminal:failed'), /must not contain/,
    'an eventKind with ":" is rejected');
  assert.equal(assertEventKindAllowed('work.progress'), 'work.progress', 'a dotted kind is allowed');

  const pool = await freshPool();
  try {
    // (a) A handler that tries to emit a ':'-bearing kind aimed at a reserved terminal slot.
    const regShadow = new HandlerRegistry().register('q19a', async (ctx) => {
      ctx.emit('terminal:failed', { payload: { jobId: String(ctx.job.id) } }); // must THROW here
      return { status: 'succeeded' };
    });
    const { job: ja } = await enqueue(pool, { jobType: 'q19a', idempotencyKey: 'sh-1', maxAttempts: 1 });
    const wa = new Worker(pool, regShadow, { workerId: 'w19a', leaseSeconds: 60, logger: SILENT });
    const ra = await wa.processOnce('q19a');
    assert.equal(ra.outcome, 'handler_error', 'the reserved-slot emit throws -> crash-equivalent, not success');
    const evsA = await eventsForJob(pool, ja.id);
    // The forged 'terminal:failed' never reached the ledger, and the runtime terminal is untouched.
    assert.equal(evsA.filter((e) => e.event_kind === 'terminal:failed').length, 0, 'the ":"-kind event never landed');
    const forgedTerminal = (await pool.query(
      `select count(*)::int n from ops.agent_event where delivery_key = $1`,
      [`job:${ja.id}:attempt:1:terminal:failed`])).rows[0].n;
    assert.equal(forgedTerminal, 0, 'the runtime terminal slot was NOT shadowed by the caller');
    assert.equal(evsA.filter((e) => e.event_kind === 'job.succeeded').length, 0, 'the job did not complete on a rejected emit');

    // (b) Two same-kind emits in ONE attempt both land on distinct keys.
    const regTwice = new HandlerRegistry().register('q19b', async (ctx) => {
      ctx.emit('work.progress', { payload: { jobId: String(ctx.job.id), step: 'a' } });
      ctx.emit('work.progress', { payload: { jobId: String(ctx.job.id), step: 'b' } });
      ctx.emit('work.done', { effect: 'done', payload: { jobId: String(ctx.job.id) } });
      return { status: 'succeeded' };
    });
    const { job: jb } = await enqueue(pool, { jobType: 'q19b', idempotencyKey: 'tw-1', maxAttempts: 1 });
    const wb = new Worker(pool, regTwice, { workerId: 'w19b', leaseSeconds: 60, logger: SILENT });
    assert.equal((await wb.processOnce('q19b')).outcome, 'succeeded');

    const evsB = await eventsForJob(pool, jb.id);
    const progress = evsB.filter((e) => e.event_kind === 'work.progress');
    assert.equal(progress.length, 2, 'BOTH same-kind emits landed (the second was not silently dropped)');
    assert.equal(new Set(progress.map((e) => e.delivery_key)).size, 2, 'the two emits have DISTINCT per-attempt keys');
    const steps = new Set(progress.map((e) => e.payload.step));
    assert.ok(steps.has('a') && steps.has('b'), 'both distinct progress payloads survived');
  } finally { await pool.end(); }
});
