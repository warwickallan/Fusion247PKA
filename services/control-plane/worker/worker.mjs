// BUILD-014 WP-B — the durable worker loop + lease reclaimer.
//
// CORRECTNESS MODEL (why this is safe under at-least-once delivery):
//   1. claim_job(queue, worker, leaseSeconds) atomically leases ONE eligible job with
//      FOR UPDATE SKIP LOCKED and increments attempts. N concurrent workers therefore
//      grab DISTINCT jobs — no double-claim. (The WP-A function owns this; we never
//      re-implement the queue in app code.)
//   2. A 'job.claimed' event is appended immediately (per-attempt key) — evidence that
//      the attempt happened, even if the worker then crashes.
//   3. The handler runs. It may BUFFER effect events via ctx.emit and choose a STABLE
//      ctx.effectKey(...) for its idempotent effect.
//   4. COMPLETION IS ONE TRANSACTION on a pinned client: the buffered events + a terminal
//      event are inserted (ON CONFLICT DO NOTHING), THEN ops.complete_job(id, worker,
//      status) runs. complete_job is GUARDED by (status='leased' AND lease_owner=worker):
//      a worker whose lease already expired-and-was-reclaimed matches NO row and RAISES,
//      so the whole txn — including its buffered effect — ROLLS BACK. The live leaseholder
//      is never clobbered, and a stale worker can never double-apply the effect.
//   5. A handler that THROWS is treated as a crash: we do NOT complete. The lease expires,
//      the reclaim ticker returns the job to pending (or dead-letters it when the attempt
//      budget is exhausted), and it is retried. The idempotent effect key guarantees the
//      retry's effect collides with any prior one -> exactly-once effect.
//
// NOTIFY/Realtime is NOT used: correctness rests entirely on polling + claim_job. A
// wake-hint could be layered later purely as an optimisation; nothing here depends on it.

import { appendEvent } from './events.mjs';
import { createLogger, sleep } from './util.mjs';

export class Worker {
  constructor(pool, registry, opts = {}) {
    this.pool = pool;
    this.registry = registry;
    this.workerId = opts.workerId ?? `worker-${Math.random().toString(36).slice(2, 8)}`;
    this.leaseSeconds = opts.leaseSeconds ?? 30;
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.logger = opts.logger ?? createLogger({ base: { workerId: this.workerId } });
    this.running = false;
  }

  /**
   * Claim + process at most ONE job from `queue`. Returns null when the queue has no
   * eligible work, else an outcome object { job, outcome, error? } where outcome is one
   * of 'succeeded' | 'failed' | 'handler_error' | 'completion_failed' | 'no_handler'.
   *
   * `hooks.beforeComplete({ job, workerId, events })` is an OPTIONAL test seam invoked
   * after the handler runs but before the completion transaction — used by the crash/
   * reclaim proof to interleave a competing worker. It is never used in production.
   */
  async processOnce(queue, hooks = {}) {
    const claim = await this.pool.query(
      `select * from ops.claim_job($1, $2, $3)`, [queue, this.workerId, this.leaseSeconds]);
    const job = claim.rows[0];
    // claim_job returns SQL NULL (a row of all-null columns) when nothing is claimable.
    if (!job || job.id === null) return null;

    const jobId = String(job.id);
    const attempt = job.attempts;
    const log = this.logger.child({ jobId, queue, attempt });
    log.info('job.claimed');

    // (2) append-only claim evidence — per-attempt key, written immediately (auto-commit).
    await appendEvent(this.pool, {
      deliveryKey: `job:${jobId}:attempt:${attempt}:claimed`,
      eventKind: 'job.claimed',
      actor: 'tower',
      payload: { jobId, queue, attempt, workerId: this.workerId },
    });

    const handler = this.registry.get(queue);
    if (!handler) {
      // No handler bound: treat as crash-equivalent (do NOT complete). The lease will
      // expire and the job will be retried/dead-lettered — loud, never silently dropped.
      log.error('no_handler_registered');
      await appendEvent(this.pool, {
        deliveryKey: `job:${jobId}:attempt:${attempt}:no_handler`,
        eventKind: 'job.no_handler',
        actor: 'tower',
        payload: { jobId, queue, attempt },
      });
      return { job, outcome: 'no_handler' };
    }

    // (3) run the handler. Effect events are buffered and flushed inside the completion txn.
    const events = [];
    const ctx = {
      job,
      workerId: this.workerId,
      attempt,
      effectKey: (name) => `effect:${job.idempotency_key}:${name}`,
      emit: (eventKind, o = {}) => {
        events.push({
          buildId: o.buildId ?? null,
          deliveryKey: o.deliveryKey ?? `job:${jobId}:attempt:${attempt}:${eventKind}`,
          eventKind,
          actor: o.actor ?? null,
          payload: o.payload ?? {},
          payloadHash: o.payloadHash,
          classification: o.classification,
        });
      },
    };

    let result;
    try {
      result = await handler(ctx);
    } catch (err) {
      // (5) crash-equivalent: do NOT complete. Record the failed attempt (append-only),
      // let the lease expire -> reclaim -> retry (or dead_letter when exhausted).
      log.warn('handler_threw', { error: String(err?.message ?? err) });
      await appendEvent(this.pool, {
        deliveryKey: `job:${jobId}:attempt:${attempt}:failed`,
        eventKind: 'job.attempt_failed',
        actor: 'tower',
        payload: { jobId, attempt, error: String(err?.message ?? err) },
      });
      return { job, outcome: 'handler_error', error: err };
    }

    const status = result?.status === 'failed' ? 'failed' : 'succeeded';

    if (hooks.beforeComplete) {
      await hooks.beforeComplete({ job, workerId: this.workerId, events });
    }

    // (4) atomic completion: buffered effects + terminal event + complete_job, one txn.
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const ev of events) await appendEvent(client, ev);
      await appendEvent(client, {
        deliveryKey: `job:${jobId}:terminal:${status}`,
        eventKind: `job.${status}`,
        actor: 'tower',
        payload: { jobId, status, attempt, workerId: this.workerId },
      });
      // Raises restrict_violation (23001) if this worker no longer holds the lease —
      // rolling back the buffered effect above. This is the exactly-once guard.
      await client.query(`select ops.complete_job($1, $2, $3)`, [job.id, this.workerId, status]);
      await client.query('commit');
      log.info('job.completed', { status });
      return { job, outcome: status };
    } catch (err) {
      await client.query('rollback').catch(() => {});
      // A stale lease (reclaimed + re-leased elsewhere) lands here: the effect rolled back,
      // the live leaseholder is untouched. Not a crash — expected under a lost race.
      log.warn('completion_failed_rolled_back', { code: err?.code, error: String(err?.message ?? err) });
      return { job, outcome: 'completion_failed', error: err };
    } finally {
      client.release();
    }
  }

  /** Poll `queues` in a loop until stop(). Correctness rests on this poll alone. */
  async runLoop(queues) {
    const qs = Array.isArray(queues) ? queues : [queues];
    this.running = true;
    this.logger.info('worker.loop_start', { queues: qs });
    while (this.running) {
      let didWork = false;
      for (const q of qs) {
        if (!this.running) break;
        try {
          const r = await this.processOnce(q);
          if (r) didWork = true;
        } catch (err) {
          this.logger.error('processOnce_unexpected', { queue: q, error: String(err?.message ?? err) });
        }
      }
      if (!didWork) await sleep(this.pollIntervalMs);
    }
    this.logger.info('worker.loop_stopped');
  }

  stop() {
    this.running = false;
  }
}

/**
 * The lease-reclaim ticker. Calls ops.reclaim_expired_leases() on an interval so a
 * crashed worker's leased job is recovered after its visibility timeout — returned to
 * pending for retry, or parked in dead_letter once the attempt budget is exhausted.
 */
export class Reclaimer {
  constructor(pool, opts = {}) {
    this.pool = pool;
    this.intervalMs = opts.intervalMs ?? 1000;
    this.logger = opts.logger ?? createLogger({ base: { component: 'reclaimer' } });
    this.timer = null;
  }

  /** One reclaim pass. Returns the reclaimed rows. */
  async tick() {
    const { rows } = await this.pool.query(`select * from ops.reclaim_expired_leases()`);
    if (rows.length) {
      this.logger.info('leases.reclaimed', {
        count: rows.length,
        toPending: rows.filter((r) => r.status === 'pending').length,
        toDeadLetter: rows.filter((r) => r.status === 'dead_letter').length,
      });
    }
    return rows;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger.error('reclaim_tick_failed', { error: String(err?.message ?? err) }));
    }, this.intervalMs);
    this.timer.unref?.();
    this.logger.info('reclaimer.started', { intervalMs: this.intervalMs });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
