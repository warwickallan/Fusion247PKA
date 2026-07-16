// Local worker — the pull/claim/write/evidence/complete cycle (fixtures).
//
// Source of truth: supabase-operational-foundation-boundary.md §3:
//   claim (lease) → writing → governed Markdown write → evidence → complete.
//   completed is set ONLY after the write + evidence pointers both exist.
//   Resume is idempotent end-to-end: claim reclaims expired leases, and the
//   markdown write is idempotent, so a worker resuming after a dead worker
//   completes WITHOUT double-writing.
//
// FIXTURES ONLY (WP0): no network, no wall-clock. `now` is injected everywhere.

import { STATES, MAX_DELIVERY_ATTEMPTS } from './core/states.js';
import { computeNextAttemptAtMs } from './core/retryPolicy.js';
import { projectCard } from './receiptProjection.js';

/**
 * @param {object} deps
 * @param {object} deps.store           OperationalStore.
 * @param {object} deps.markdownWriter  sandboxed governed writer (idempotent write()).
 * @param {object} deps.adapter         channel adapter (editCard).
 * @param {object} deps.clock           { now: () => number } (used only if `now` not passed).
 * @param {string} deps.workerId        this worker's principal id.
 * @param {number} deps.leaseMs         claim lease duration in ms.
 */
export function createWorker({ store, markdownWriter, adapter, clock, workerId, leaseMs } = {}) {
  if (!store) throw new Error('createWorker: store required');
  if (!markdownWriter) throw new Error('createWorker: markdownWriter required');
  if (!adapter) throw new Error('createWorker: adapter required');
  if (typeof workerId !== 'string' || workerId.length === 0) {
    throw new Error('createWorker: workerId required');
  }
  if (typeof leaseMs !== 'number' || leaseMs <= 0) {
    throw new Error('createWorker: positive leaseMs required');
  }

  function resolveNow(opts) {
    if (opts && typeof opts.now === 'number' && Number.isFinite(opts.now)) return opts.now;
    if (clock && typeof clock.now === 'function') return clock.now();
    throw new Error('worker: injected numeric `now` (epoch ms) required');
  }

  return {
    /**
     * Process one claimable item end-to-end. Returns the final record, or null
     * if nothing was claimable.
     *
     * Recovery: because store.claim reclaims expired leases and markdownWriter.write
     * is idempotent, a second worker resuming after a dead worker's claim expires
     * completes the item without a duplicate write and without false completion.
     */
    processOne({ now: injectedNow } = {}) {
      const now = resolveNow({ now: injectedNow });

      // 1. Atomically claim the oldest claimable (or reclaim an expired lease).
      const claimed = store.claim(workerId, leaseMs, { now });
      if (!claimed) return null;
      const captureId = claimed.capture_id;

      // 2. claimed → writing.
      store.transition(captureId, STATES.WRITING, { now });

      // 3-6. Governed write + evidence + gated completion. If ANY step throws
      //      (the governed Markdown write or its evidence/complete follow-up),
      //      we record an HONEST failure and NEVER reach `completed`. Because the
      //      writer is idempotent and the synthetic/real write faults throw
      //      before touching disk, no partial or duplicate note leaks.
      let final;
      try {
        // 3. Governed Markdown write (idempotent). Re-processing an already-
        //    written capture detects the existing note and does NOT rewrite.
        const record = store.getByCaptureId(captureId);
        const result = markdownWriter.write(record, { now });

        // 4. Record destination pointer, then writing → written.
        store.recordDestination(captureId, result.destination_ref, { now });
        store.transition(captureId, STATES.WRITTEN, { now });

        // 5. Record evidence pointer (idempotent on kind+target_ref), then
        //    written → evidenced.
        store.recordEvidence(captureId, result.evidence, { now });
        store.transition(captureId, STATES.EVIDENCED, { now });

        // 6. complete — gated by the store on evidenced + destination + evidence.
        final = store.complete(captureId, { now });
      } catch (writeErr) {
        const errMsg = writeErr && writeErr.message ? writeErr.message : String(writeErr);
        // attempt_count was already incremented by claim() at the top of this
        // call — use it to compute THIS failure's autonomous retry due time.
        const attemptCount = store.getByCaptureId(captureId).attempt_count;
        // Honest failure + autonomous retry scheduling (Sonnet review fix — this
        // is the real runtime path behind "will be retried"; no external
        // scheduler or test-only helper required). writing/written/evidenced →
        // failed is legal; recordFailure stamps next_attempt_at_ms so a LATER
        // claim() reclaims this item once due.
        store.recordFailure(captureId, {
          now,
          error: errMsg,
          nextAttemptAtMs: computeNextAttemptAtMs(attemptCount, now),
        });
        const failedRec = store.getByCaptureId(captureId);

        // Retry-exhaustion decision belongs to the worker (states.js §): compare
        // the claim-incremented attempt_count against the shared cap.
        if (failedRec.attempt_count >= MAX_DELIVERY_ATTEMPTS) {
          // Budget burned → park permanently for operator attention. Terminal;
          // `completed` is now unreachable for this capture.
          const dead = store.deadLetter(captureId, { now, error: errMsg });
          // eslint-disable-next-line no-console
          console.error(JSON.stringify({
            service: 'fusion-capture-gateway',
            component: 'worker',
            event: 'delivery_dead_lettered',
            worker_id: workerId,
            capture_id: captureId,
            attempt_count: failedRec.attempt_count,
            max_delivery_attempts: MAX_DELIVERY_ATTEMPTS,
            error: errMsg,
            at_ms: now,
          }));
          return dead;
        }

        // Under the cap: leave it `failed` — a non-terminal, reclaimable state.
        // A later reclaim (fresh claim via the queue / an expired lease) resumes
        // the attempt; attempt_count keeps climbing toward the cap.
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          service: 'fusion-capture-gateway',
          component: 'worker',
          event: 'governed_write_failed',
          worker_id: workerId,
          capture_id: captureId,
          attempt_count: failedRec.attempt_count,
          error: errMsg,
          at_ms: now,
        }));
        return failedRec;
      }

      // 7. Edit the card to Completed. This is a RETRYABLE PROJECTION: a failure
      //    here must NOT reverse or duplicate the successful write/complete.
      //    Swallow the projection error, leave state completed, log it.
      try {
        adapter.editCard(captureId, projectCard(final));
      } catch (err) {
        // Structured log (no secrets, no full payload) — the card is stale but
        // the capture is durably completed. It can be re-projected later.
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          service: 'fusion-capture-gateway',
          component: 'worker',
          event: 'card_edit_failed_after_complete',
          worker_id: workerId,
          capture_id: captureId,
          state: final.state,
          error: err && err.message ? err.message : String(err),
          at_ms: now,
        }));
      }

      return final;
    },

    /**
     * Re-project and retry the channel card for a capture. A card edit is a
     * RETRYABLE PROJECTION: if the edit-to-Completed swallowed by processOne
     * failed, this re-derives the card from CURRENT store state via
     * receiptProjection and calls adapter.editCard again.
     *
     * Pure projection retry: it does NOT mutate store state and does NOT re-run
     * the governed Markdown write. Idempotent — safe to call repeatedly; each
     * call simply re-sends the card that matches the record's current state.
     *
     * @param {string} captureId
     * @param {{ now?: number }} [opts]  injected epoch ms (signature parity).
     * @returns {object} the adapter card-log entry.
     */
    retryCardProjection(captureId, { now: injectedNow } = {}) {
      resolveNow({ now: injectedNow }); // signature parity + validates injection
      const record = store.getByCaptureId(captureId);
      if (!record) {
        throw new Error(`retryCardProjection: unknown capture_id "${captureId}"`);
      }
      // Re-derive from current state and re-send. No store mutation, no re-write.
      return adapter.editCard(captureId, projectCard(record));
    },

    /** Drain: process claimable items until none remain. Returns count processed. */
    drain({ now } = {}) {
      let processed = 0;
      // Bounded loop guard — never spins forever on a fixture.
      for (let i = 0; i < 10_000; i += 1) {
        const rec = this.processOne({ now });
        if (!rec) break;
        processed += 1;
      }
      return processed;
    },
  };
}
