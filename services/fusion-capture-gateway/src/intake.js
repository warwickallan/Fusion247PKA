// Intake — the durable acceptance path (fixtures).
//
// Source of truth: supabase-operational-foundation-boundary.md §3/§4:
// intake into the operational store is the COMMIT POINT. The instant
// recordIntake returns success the capture is durable — independent of worker
// liveness. The card then renders "safe and waiting"; it can NEVER say
// "Completed" here (completion is gated on write+evidence downstream).
//
// TAP-GATED CAPTURE (Warwick decision, 2026-07-16, live phone test — "option B"):
// accept() records the capture durably and sends the action card, but does NOT
// enqueue it for the worker. The capture HOLDS at the legal, non-claimable
// `accepted` state until the user taps "Save to Brain" on the card — only then
// does confirmSave() enqueue it and the existing saga (claim → write → evidence
// → completed) runs. `accepted` is not in CLAIMABLE_STATES, so no store change
// is needed to keep the worker's hands off a pending capture, and the hold is
// restart-safe: the pending row + its durable card_ref survive a worker restart,
// and a post-restart tap resolves the capture via the card_ref reverse lookup.
// An untapped card simply stays pending forever in WP0 — no timeout logic.
//
// FIXTURES ONLY (WP0): no network. Adapter + store + clock are injected.

import { validateEnvelope } from './core/contracts.js';
import { projectReceipt, projectCard } from './receiptProjection.js';
import { STATES } from './core/states.js';

/**
 * @param {object} deps
 * @param {object} deps.store    OperationalStore (recordIntake/enqueue/getByCaptureId).
 * @param {object} deps.adapter  channel adapter (toEnvelope/sendCard).
 * @param {object} deps.clock    { now: () => number } injected clock (epoch ms).
 * @param {function} [deps.isWorkerOnline]  () => boolean. Consulted at CONFIRM
 *                   time (the tap): absent/true ⇒ online ⇒ queued; false ⇒
 *                   offline ⇒ offline_queued (still durable/safe).
 * @param {object} [deps.rateLimiter]  F-04 per-sender token-bucket. Optional; when
 *                   present, an authorised sender flooding is bounded — excess is
 *                   REJECTED before the durable commit (capture NOT accepted).
 */
export function createIntake({ store, adapter, clock, isWorkerOnline, rateLimiter } = {}) {
  if (!store) throw new Error('createIntake: store required');
  if (!adapter) throw new Error('createIntake: adapter required');
  if (!clock || typeof clock.now !== 'function') {
    throw new Error('createIntake: clock with now() required');
  }

  return {
    /**
     * Accept a synthetic inbound update. TAP-GATED: durably records the capture
     * and sends the action card, but does NOT enqueue — the capture holds at
     * `accepted` (pending, non-claimable) until confirmSave() runs on the tap.
     *
     * @param {object} update
     * @param {object} [options]
     * @param {string}  [options.action]   chosen capture action (default SaveToBrain).
     * @returns {{ ok:true, receipt, isNew, captureId } | { ok:false, reason }}
     */
    async accept(update, options = {}) {
      const now = clock.now();

      // ASYNC-UNIFIED: every store/adapter call below is awaited. Awaiting the
      // in-memory fixture's synchronous return is a no-op, so ONE code path
      // drives both the fixture store and Silas's async Postgres store.
      const mapped = adapter.toEnvelope(update, { now, action: options.action });
      if (!mapped.ok) {
        // Default-deny / malformed / non-text: no capture, no durable row
        // (fail-closed). 'unsupported_content_type' reaches here too — a
        // photo/voice/document update NEVER creates envelope or queue rows.
        return { ok: false, reason: mapped.reason };
      }

      const validated = validateEnvelope(mapped.value);
      if (!validated.ok) {
        return { ok: false, reason: 'invalid_envelope', errors: validated.errors };
      }
      const envelope = validated.value;

      // F-04 flood control (wp0-security-gate.md §5). Checked AFTER auth passes
      // (only an authorised sender reaches here) and BEFORE the durable commit —
      // so a burst cannot exhaust the store/worker/write path. Fail-closed: the
      // excess message is rejected and NOT durably accepted.
      if (rateLimiter && typeof rateLimiter.check === 'function') {
        const senderId = (envelope.channel_context && envelope.channel_context.chat_id)
          ?? envelope.sender_identity_ref;
        const verdict = rateLimiter.check(String(senderId), now);
        if (!verdict.allowed) {
          return { ok: false, reason: 'rate_limited', retryAfterMs: verdict.retryAfterMs };
        }
      }

      // COMMIT POINT — durable the instant this returns. Upsert-by-idempotency
      // key: a re-delivery returns the existing record, isNew=false (dedup).
      const { record, isNew } = await store.recordIntake(envelope, { now });

      if (isNew) {
        // TAP-GATED: no enqueue here. The row holds at `accepted` — durable,
        // safe-and-waiting, and NOT claimable — until the user taps the card.
        // Initial card: pending with action buttons. Never a completion claim.
        await adapter.sendCard(record.capture_id, projectCard(await store.getByCaptureId(record.capture_id)));

        // Persist the DURABLE card target (§4): {chat_id, message_id} of the card
        // we just sent, so (a) a post-restart tap can resolve this capture via
        // the card_ref reverse lookup, and (b) the completion projection can
        // re-target the ORIGINAL card after a worker restart (when the adapter's
        // in-memory map is empty). Guarded so it is a no-op for stores/adapters
        // that don't expose the seam.
        if (typeof store.recordCardRef === 'function' && typeof adapter.cardTarget === 'function') {
          const target = adapter.cardTarget(record.capture_id);
          if (target && target.messageId !== undefined) {
            await store.recordCardRef(
              record.capture_id,
              { chat_id: target.chatId, message_id: target.messageId },
              { now },
            );
          }
        }
      }

      const current = await store.getByCaptureId(record.capture_id);
      return {
        ok: true,
        receipt: projectReceipt(current),
        isNew,
        captureId: record.capture_id,
      };
    },

    /**
     * The TAP path: the user tapped "Save to Brain" on a pending card. Enqueues
     * the held capture so the existing saga (claim → governed write → evidence →
     * completed) runs. IDEMPOTENT by state inspection:
     *   - `accepted` (pending)        → enqueue, outcome 'queued'.
     *   - `completed`                 → no-op, outcome 'already_completed'.
     *   - anything else (in flight /
     *     failed-awaiting-retry / …)  → no-op, outcome 'no_op'.
     * Double-taps and taps after completion are therefore safe no-ops — no
     * second queue hop, no second write.
     *
     * @param {string} captureId
     * @param {object} [options]
     * @param {boolean} [options.offline]  force offline queueing (overrides isWorkerOnline).
     * @returns {{ ok:true, outcome:'queued'|'already_completed'|'no_op', state, receipt, captureId }
     *          | { ok:false, reason:'unknown_capture' }}
     */
    async confirmSave(captureId, options = {}) {
      const now = clock.now();
      const record = await store.getByCaptureId(captureId);
      if (!record) return { ok: false, reason: 'unknown_capture' };

      if (record.state === STATES.ACCEPTED) {
        const online = typeof isWorkerOnline === 'function' ? isWorkerOnline() : true;
        const offline = options.offline === true || !online;
        // confirmedByTap: the store-enforced tap-gate acknowledgement (2026-07-17)
        // — THIS call site, and only this one, acts on a real user tap.
        await store.enqueue(captureId, { now, offline, confirmedByTap: true });
        const current = await store.getByCaptureId(captureId);
        return {
          ok: true, outcome: 'queued', state: current.state, receipt: projectReceipt(current), captureId,
        };
      }

      const outcome = record.state === STATES.COMPLETED ? 'already_completed' : 'no_op';
      return {
        ok: true, outcome, state: record.state, receipt: projectReceipt(record), captureId,
      };
    },
  };
}
