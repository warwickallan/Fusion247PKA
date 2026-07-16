// Intake — the durable acceptance path (fixtures).
//
// Source of truth: supabase-operational-foundation-boundary.md §3/§4:
// intake into the operational store is the COMMIT POINT. The instant
// recordIntake returns success the capture is durable — independent of worker
// liveness. The card then renders "safe and waiting"; it can NEVER say
// "Completed" here (completion is gated on write+evidence downstream).
//
// FIXTURES ONLY (WP0): no network. Adapter + store + clock are injected.

import { validateEnvelope } from './core/contracts.js';
import { projectReceipt, projectCard } from './receiptProjection.js';

/**
 * @param {object} deps
 * @param {object} deps.store    OperationalStore (recordIntake/enqueue/getByCaptureId).
 * @param {object} deps.adapter  channel adapter (toEnvelope/sendCard).
 * @param {object} deps.clock    { now: () => number } injected clock (epoch ms).
 * @param {function} [deps.isWorkerOnline]  () => boolean. Absent/true ⇒ online ⇒
 *                   queued; false ⇒ offline ⇒ offline_queued (still durable/safe).
 */
export function createIntake({ store, adapter, clock, isWorkerOnline } = {}) {
  if (!store) throw new Error('createIntake: store required');
  if (!adapter) throw new Error('createIntake: adapter required');
  if (!clock || typeof clock.now !== 'function') {
    throw new Error('createIntake: clock with now() required');
  }

  return {
    /**
     * Accept a synthetic inbound update.
     *
     * @param {object} update
     * @param {object} [options]
     * @param {boolean} [options.offline]  force offline queueing (overrides isWorkerOnline).
     * @param {string}  [options.action]   chosen capture action (default SaveToBrain).
     * @returns {{ ok:true, receipt, isNew, captureId } | { ok:false, reason }}
     */
    accept(update, options = {}) {
      const now = clock.now();

      const mapped = adapter.toEnvelope(update, { now, action: options.action });
      if (!mapped.ok) {
        // Default-deny / malformed: no capture, no durable row (fail-closed).
        return { ok: false, reason: mapped.reason };
      }

      const validated = validateEnvelope(mapped.value);
      if (!validated.ok) {
        return { ok: false, reason: 'invalid_envelope', errors: validated.errors };
      }
      const envelope = validated.value;

      // COMMIT POINT — durable the instant this returns. Upsert-by-idempotency
      // key: a re-delivery returns the existing record, isNew=false (dedup).
      const { record, isNew } = store.recordIntake(envelope, { now });

      if (isNew) {
        const online = typeof isWorkerOnline === 'function' ? isWorkerOnline() : true;
        const offline = options.offline === true || !online;
        store.enqueue(record.capture_id, { now, offline });
        // Initial card: safe-and-waiting. Never a completion claim.
        adapter.sendCard(record.capture_id, projectCard(store.getByCaptureId(record.capture_id)));
      }

      const current = store.getByCaptureId(record.capture_id);
      return {
        ok: true,
        receipt: projectReceipt(current),
        isNew,
        captureId: record.capture_id,
      };
    },
  };
}
