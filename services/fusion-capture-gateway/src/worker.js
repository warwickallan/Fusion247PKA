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

import { STATES } from './core/states.js';
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

      // 3. Governed Markdown write (idempotent). Re-processing an already-written
      //    capture detects the existing note and does NOT rewrite.
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
      const final = store.complete(captureId, { now });

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
