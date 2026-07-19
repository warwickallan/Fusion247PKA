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

import { appendEvent, effectDeliveryKey, assertCallerKeyAllowed } from './events.mjs';
import { createLogger, sleep, sanitizeError } from './util.mjs';

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
   * of 'succeeded' | 'failed' | 'handler_error' | 'invalid_result' | 'completion_failed'
   * | 'no_handler'.
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
    // Delivery keys are runtime-derived (fixes 1 & 4): an idempotent effect uses an INJECTIVE
    // hash of (idempotency_key, name); a per-attempt event is scoped to job+attempt; a raw
    // caller key is rejected if it lands in a reserved namespace, else namespaced under this
    // job's own 'custom:' segment so it can never collide across jobs.
    const events = [];
    const ctx = {
      job,
      workerId: this.workerId,
      attempt,
      effectKey: (name) => effectDeliveryKey(job.idempotency_key, name),
      emit: (eventKind, o = {}) => {
        let deliveryKey;
        if (o.effect !== undefined) {
          // Sanctioned idempotent-effect path: stable across retries, injective.
          deliveryKey = effectDeliveryKey(job.idempotency_key, o.effect);
        } else if (o.deliveryKey !== undefined) {
          // Caller-chosen key: reject reserved namespaces, then scope to THIS job.
          assertCallerKeyAllowed(o.deliveryKey);
          deliveryKey = `job:${jobId}:custom:${o.deliveryKey}`;
        } else {
          // Default: a fresh per-attempt event.
          deliveryKey = `job:${jobId}:attempt:${attempt}:${eventKind}`;
        }
        events.push({
          buildId: o.buildId ?? null,
          deliveryKey,
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
      // let the lease expire -> reclaim -> retry (or dead_letter when exhausted). The error
      // is SANITISED (fix 5) — only non-sensitive class/code + a correlation id reach the
      // ledger, never the raw message (which could carry payload/secret fragments).
      const safe = sanitizeError(err);
      log.warn('handler_threw', safe);
      await appendEvent(this.pool, {
        deliveryKey: `job:${jobId}:attempt:${attempt}:failed`,
        eventKind: 'job.attempt_failed',
        actor: 'tower',
        payload: { jobId, attempt, ...safe },
      });
      return { job, outcome: 'handler_error', error: err };
    }

    // (2b — fix 2) A handler must EXPLICITLY signal its outcome. Only the allow-listed
    // statuses 'succeeded' | 'failed' are honoured; anything else (undefined, a typo'd or
    // unknown status) is NOT silent success — it routes through the crash-equivalent
    // failure/retry path exactly like a throw, so ambiguous work is never lost.
    const rs = result == null ? undefined : result.status;
    if (rs !== 'succeeded' && rs !== 'failed') {
      const safe = sanitizeError(new Error('handler returned no valid { status }'));
      const got = typeof rs === 'string' ? rs.slice(0, 40) : (rs === undefined ? 'undefined' : typeof rs);
      log.warn('handler_invalid_result', { got, correlationId: safe.correlationId });
      await appendEvent(this.pool, {
        deliveryKey: `job:${jobId}:attempt:${attempt}:invalid_result`,
        eventKind: 'job.invalid_result',
        actor: 'tower',
        payload: { jobId, attempt, got, correlationId: safe.correlationId },
      });
      return { job, outcome: 'invalid_result' };
    }
    const status = rs;

    if (hooks.beforeComplete) {
      await hooks.beforeComplete({ job, workerId: this.workerId, events });
    }

    // (4) atomic completion: buffered effects + terminal event + complete_job, one txn.
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const ev of events) await appendEvent(client, ev);
      // (fix 7) terminal-succeeded is a singleton per job; a non-succeeded terminal is
      // keyed PER ATTEMPT so a 2nd graceful {status:'failed'} does not dedup against
      // attempt-1's terminal (which would lose it from the ledger).
      const terminalKey = status === 'succeeded'
        ? `job:${jobId}:terminal:succeeded`
        : `job:${jobId}:attempt:${attempt}:terminal:${status}`;
      await appendEvent(client, {
        deliveryKey: terminalKey,
        eventKind: `job.${status}`,
        actor: 'tower',
        payload: { jobId, status, attempt, workerId: this.workerId },
      });
      // Raises restrict_violation (23001) if this worker no longer holds the lease —
      // rolling back the buffered effect above. This is the exactly-once guard. `select *`
      // expands the returned ops.job so we can see whether a graceful 'failed' exhausted
      // the retry budget and landed in dead_letter.
      const cj = await client.query(`select * from ops.complete_job($1, $2, $3)`, [job.id, this.workerId, status]);
      const finalStatus = cj.rows[0]?.status;
      // (fix 6) graceful-exhaustion dead-lettering must be reconstructable from the ledger.
      if (finalStatus === 'dead_letter') {
        await appendEvent(client, {
          deliveryKey: `job:${jobId}:attempt:${attempt}:dead_lettered`,
          eventKind: 'job.dead_lettered',
          actor: 'tower',
          payload: { jobId, attempt, reason: 'graceful_failed_exhausted' },
        });
      }
      await client.query('commit');
      log.info('job.completed', { status, finalStatus });
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
      // (fix 6 — Fable) The reclaimer previously emitted NO ledger events, so a lease
      // reclaim (leased->pending) or reclaim-time dead-lettering (leased->dead_letter) was
      // invisible in ops.agent_event — the lifecycle was not reconstructable from the ledger
      // alone. Emit one IDEMPOTENT event per reclaimed row, keyed PER ATTEMPT so re-running a
      // tick (or two overlapping tickers) can never duplicate it.
      for (const r of rows) {
        const jobId = String(r.id);
        const dead = r.status === 'dead_letter';
        await appendEvent(this.pool, {
          deliveryKey: `job:${jobId}:attempt:${r.attempts}:${dead ? 'dead_lettered' : 'reclaimed'}`,
          eventKind: dead ? 'job.dead_lettered' : 'job.lease_reclaimed',
          actor: 'tower',
          payload: {
            jobId, attempt: r.attempts,
            reason: dead ? 'lease_expired_exhausted' : 'lease_expired',
          },
        }).catch((err) => this.logger.error('reclaim_event_failed', { jobId, ...sanitizeError(err) }));
      }
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
