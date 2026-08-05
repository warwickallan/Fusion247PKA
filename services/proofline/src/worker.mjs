// Proofline — the background worker.
//
// It runs on the SAME process as the HTTP server but never on the request
// thread's call path: the server appends `job.created`, answers the client, and
// only then nudges the worker. The lease (`job.started`) is a separate,
// separately-fsynced journal record, so the ordering is durable evidence rather
// than a claim (G-3).
//
// Recovery runs at startup AND periodically while live (D-6b). The periodic
// scan is the half that makes the epoch load-bearing.
//
// NOTE ON THE ABSENCE OF A BUSY FLAG — this is deliberate, see recovery.mjs.
// `pump()` is re-entrant and its only guard against double-leasing is that
// `store.lease()` is SYNCHRONOUS: a second pump iterating `queuedKeys()` after
// the lease sees `processing`, not `queued`. The only thing stopping the live
// scan re-queueing an in-flight job is `isOrphaned`.

import { canonicalJson, sha256Hex } from './canonical.mjs';
import { analyze as defaultAnalyze } from './processor.mjs';
import { isOrphaned as defaultIsOrphaned, MAX_ATTEMPTS } from './recovery.mjs';

export function createWorker({
  store,
  analyze = defaultAnalyze,
  isOrphaned = defaultIsOrphaned,
  scanIntervalMs = 1000,
  maxAttempts = MAX_ATTEMPTS,
  trace = () => {},
  log = () => {},
} = {}) {
  if (!store) throw new TypeError('createWorker: store is required');

  let timer = null;
  let stopped = false;

  async function runJob(job) {
    trace('worker.process.start', { key: job.key, attempts: job.attempts, epoch: job.epoch });
    let result;
    try {
      result = await analyze(job.text);
    } catch (err) {
      log({ level: 'error', event: 'job.processing_error', key: job.key, message: err.message });
      store.fail(job.key, `processing error: ${err.message}`);
      return;
    }
    const resultSha256 = sha256Hex(canonicalJson(result));
    store.complete(job.key, result, resultSha256);
    trace('worker.process.done', { key: job.key, resultSha256 });
  }

  async function pump() {
    for (;;) {
      if (stopped) return;
      const key = store.queuedKeys()[0];
      if (key === undefined) return;
      let job;
      try {
        job = store.lease(key);
      } catch (err) {
        log({ level: 'error', event: 'job.lease_error', key, message: err.message });
        return;
      }
      await runJob(job);
    }
  }

  function pumpDetached() {
    pump().catch((err) => log({ level: 'error', event: 'worker.pump_error', message: err.message }));
  }

  /**
   * One recovery pass. Re-queues every orphaned job, or abandons it once the
   * attempt guard is spent, then pumps.
   */
  function scanOnce() {
    let requeued = 0;
    let failed = 0;
    for (const job of store.listJobs()) {
      if (!isOrphaned(job, store.epoch)) continue;
      if (job.attempts >= maxAttempts) {
        store.fail(job.key, `abandoned after ${job.attempts} attempts (last lease under epoch ${job.epoch}, current epoch ${store.epoch})`);
        failed++;
      } else {
        store.requeue(job.key, `orphaned: leased under epoch ${job.epoch}, current epoch ${store.epoch}`);
        requeued++;
      }
    }
    if (requeued || failed) {
      log({ level: 'info', event: 'recovery.scan', requeued, failed, epoch: store.epoch });
    }
    trace('worker.scan', { requeued, failed, epoch: store.epoch });
    pumpDetached();
    return { requeued, failed };
  }

  return {
    /** Startup recovery + the periodic live scan. */
    start() {
      stopped = false;
      const outcome = scanOnce();
      timer = setInterval(scanOnce, scanIntervalMs);
      timer.unref();
      return outcome;
    },

    /** Called by the server AFTER the response has been written. */
    nudge() {
      pumpDetached();
    },

    scanOnce,

    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
