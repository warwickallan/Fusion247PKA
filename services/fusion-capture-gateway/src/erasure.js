// Erasure orchestration — the APPLICATION-LAYER GDPR/erasure path (security
// finding F-03), built on top of Silas's data-layer `store.deleteCapture`.
//
// Source of truth: wp0-security-gate.md §6 (right-to-erasure) and the
// supabase-operational-foundation-boundary matrix §3. A capture spreads across
// THREE places: the governed Markdown note (canonical knowledge), the raw
// storage object (original payload), and the operational store rows (envelope /
// state / evidence pointers). A real erasure must reach ALL of them. This
// orchestrator sequences that fan-out and returns an evidence record.
//
// FIXTURES ONLY (WP0): no network, no wall-clock. `now` is injected. The raw
// storage object is only a pointer here — in a real deployment the raw-object
// step deletes the Supabase Storage object referenced by `raw_payload_ref`.

/**
 * @param {object} deps
 * @param {object} deps.store           OperationalStore (getByCaptureId + deleteCapture).
 * @param {object} deps.markdownWriter  sandboxed writer exposing remove().
 */
export function createEraser({ store, markdownWriter } = {}) {
  if (!store || typeof store.getByCaptureId !== 'function' || typeof store.deleteCapture !== 'function') {
    throw new Error('createEraser: store with getByCaptureId + deleteCapture required');
  }
  if (!markdownWriter || typeof markdownWriter.remove !== 'function') {
    throw new Error('createEraser: markdownWriter with remove() required');
  }

  return {
    /**
     * Erase every trace of a capture. Idempotent: erasing an unknown or
     * already-erased id returns `{ erased:false, ... }` and never throws, so an
     * erasure job can be safely re-run.
     *
     * @param {string} captureId
     * @param {{ now: number }} opts  injected epoch ms.
     * @returns {{
     *   capture_id: string,
     *   erased: boolean,
     *   removed: { markdown: boolean, record: boolean },
     *   at_ms: number
     * }}
     */
    erase(captureId, { now } = {}) {
      if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new Error('erase: injected numeric `now` (epoch ms) required');
      }
      if (typeof captureId !== 'string' || captureId.length === 0) {
        throw new Error('erase: captureId required');
      }

      const record = store.getByCaptureId(captureId);
      if (!record) {
        // Unknown or already erased — nothing to do, but a safe, truthful answer.
        return {
          capture_id: captureId,
          erased: false,
          removed: { markdown: false, record: false },
          at_ms: now,
        };
      }

      // 1. Governed Markdown note (canonical knowledge copy).
      let markdownRemoved = false;
      if (record.destination_ref && typeof record.destination_ref.path === 'string') {
        markdownRemoved = markdownWriter.remove(record.destination_ref, { now }).removed;
      }

      // 2. Raw storage object. In fixtures the raw payload is only a POINTER on
      //    the operational record (`raw_payload_ref`), which is destroyed with
      //    the row in step 3 — there is no separate raw store to clear here. In a
      //    real deployment THIS is where the Supabase Storage object keyed by
      //    `raw_payload_ref.object_key` is deleted.

      // 3. Operational store rows (envelope + state + evidence pointers). Also
      //    frees the idempotency key so the same key can back a fresh capture.
      const { deleted } = store.deleteCapture(captureId, { now });

      return {
        capture_id: captureId,
        erased: true,
        removed: { markdown: markdownRemoved, record: deleted },
        at_ms: now,
      };
    },
  };
}
