// Operational store — INTERFACE + in-memory fixture implementation.
//
// Models the Supabase operational store (Supabase Operational Foundation
// Boundary §1.1, §3). This is the "fixture": no network, no real Supabase, no
// secrets. A real Supabase-backed implementation must satisfy the same
// OperationalStore surface so it can drop in later without touching callers.
//
// HARD BOUNDARY (source-of-truth matrix §3): this store is OPERATIONAL ONLY.
// It never holds the canonical copy of durable general knowledge — Markdown
// stays canonical. It carries envelopes in flight, queue/processing state,
// idempotency keys, operational relationships, and evidence POINTERS (not the
// knowledge itself).
//
// Determinism: NO Date.now() anywhere in here. Every method that needs the
// current time takes an injected `now` (epoch milliseconds) so tests are
// deterministic and leases are reproducible.

import {
  STATES,
  CLAIMABLE_STATES,
  assertTransition,
} from '../core/states.js';

/**
 * OperationalStore interface (documentation contract). A conforming
 * implementation MUST provide:
 *
 *   recordIntake(envelope, { now }) -> { record, isNew }
 *       Durably record an accepted envelope. Upsert-by-idempotency-key:
 *       a second envelope with a known key returns the existing record and
 *       isNew=false — no second row. This is the intake COMMIT POINT.
 *
 *   getByCaptureId(captureId) -> record | undefined
 *   getByIdempotencyKey(key)  -> record | undefined
 *
 *   enqueue(captureId, { now, offline }) -> record
 *       accepted -> queued (or offline_queued when offline:true). Both are the
 *       "safe and waiting" states a card renders offline-safe copy for.
 *
 *   claim(workerId, leaseMs, { now }) -> record | null
 *       Atomically lease the oldest claimable item (queued/offline_queued, or a
 *       claimed item whose lease has expired). Sets claimed_by + lease_expires_at
 *       and transitions to `claimed`. Returns null if nothing is claimable.
 *
 *   transition(captureId, toState, { now }) -> record
 *       Apply a state-machine transition (asserts legality).
 *
 *   recordEvidence(captureId, evidencePointer, { now }) -> record
 *       Append an evidence pointer (operational pointer, not knowledge).
 *
 *   recordDestination(captureId, destinationRef, { now }) -> record
 *       Record the canonical destination pointer produced by the write step.
 *
 *   complete(captureId, { now }) -> record
 *       Transition to `completed`. Refuses unless the item is `evidenced` AND
 *       both a destination pointer and an evidence pointer exist.
 *
 *   list() -> record[]   (fixture/testing helper; not part of the durable API)
 */

function requireNow(opts, method) {
  const now = opts?.now;
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error(`${method}: an injected numeric \`now\` (epoch ms) is required`);
  }
  return now;
}

function cloneRecord(record) {
  // Shallow-immutable snapshot returned to callers so internal state cannot be
  // mutated from outside (mirrors a DB read returning a fresh row).
  return {
    ...record,
    raw_payload_ref: record.raw_payload_ref ? { ...record.raw_payload_ref } : record.raw_payload_ref,
    original_source_ref: record.original_source_ref ? { ...record.original_source_ref } : record.original_source_ref,
    destination_ref: record.destination_ref ? { ...record.destination_ref } : null,
    evidence_pointers: record.evidence_pointers.map((e) => ({ ...e })),
  };
}

/**
 * In-memory fixture implementation of OperationalStore.
 */
export function createInMemoryOperationalStore() {
  /** @type {Map<string, object>} capture_id -> internal record */
  const byCaptureId = new Map();
  /** @type {Map<string, string>} idempotency_key -> capture_id */
  const byIdempotencyKey = new Map();
  let seq = 0; // monotonic insertion order for deterministic "oldest first"

  function getInternal(captureId) {
    const rec = byCaptureId.get(captureId);
    if (!rec) throw new Error(`operationalStore: unknown capture_id "${captureId}"`);
    return rec;
  }

  return {
    recordIntake(envelope, opts) {
      const now = requireNow(opts, 'recordIntake');
      if (!envelope || typeof envelope !== 'object') {
        throw new Error('recordIntake: envelope object required');
      }
      const { idempotency_key: key, capture_id: captureId } = envelope;
      if (typeof key !== 'string' || key.length === 0) {
        throw new Error('recordIntake: envelope.idempotency_key required');
      }
      if (typeof captureId !== 'string' || captureId.length === 0) {
        throw new Error('recordIntake: envelope.capture_id required');
      }

      // Upsert-by-idempotency-key: a re-delivery returns the existing record.
      const existingId = byIdempotencyKey.get(key);
      if (existingId) {
        return { record: cloneRecord(byCaptureId.get(existingId)), isNew: false };
      }

      const record = {
        capture_id: captureId,
        idempotency_key: key,
        seq: seq++,
        source_channel: envelope.source_channel ?? null,
        sender_identity_ref: envelope.sender_identity_ref ?? null,
        recorded_intent: envelope.recorded_intent ?? null,
        technical_source_type: envelope.technical_source_type ?? null,
        raw_payload_ref: envelope.raw_payload_ref ?? null,
        original_source_ref: envelope.original_source_ref ?? null,
        text_preview: envelope.text_preview ?? null,
        // Intake commit point: durable and accepted immediately.
        state: STATES.ACCEPTED,
        received_at_ms: now,
        updated_at_ms: now,
        claimed_by: null,
        lease_expires_at_ms: null,
        attempt_count: 0,
        last_error: null,
        destination_ref: null,
        evidence_pointers: [],
      };
      byCaptureId.set(captureId, record);
      byIdempotencyKey.set(key, captureId);
      return { record: cloneRecord(record), isNew: true };
    },

    getByCaptureId(captureId) {
      const rec = byCaptureId.get(captureId);
      return rec ? cloneRecord(rec) : undefined;
    },

    getByIdempotencyKey(key) {
      const id = byIdempotencyKey.get(key);
      if (!id) return undefined;
      return cloneRecord(byCaptureId.get(id));
    },

    /**
     * Enqueue an accepted item: accepted -> queued (or offline_queued). Both
     * are "safe and waiting". Only a live worker moves either into processing.
     */
    enqueue(captureId, opts) {
      const now = requireNow(opts, 'enqueue');
      const offline = opts?.offline === true;
      const rec = getInternal(captureId);
      const to = offline ? STATES.OFFLINE_QUEUED : STATES.QUEUED;
      assertTransition(rec.state, to);
      rec.state = to;
      rec.updated_at_ms = now;
      return cloneRecord(rec);
    },

    claim(workerId, leaseMs, opts) {
      const now = requireNow(opts, 'claim');
      if (typeof workerId !== 'string' || workerId.length === 0) {
        throw new Error('claim: workerId required');
      }
      if (typeof leaseMs !== 'number' || leaseMs <= 0) {
        throw new Error('claim: positive leaseMs required');
      }

      // Claimable = a queued/offline_queued item, OR a claimed item whose lease
      // has expired (a crashed/hung worker's row auto-releases).
      const candidates = [];
      for (const rec of byCaptureId.values()) {
        const isFreshlyClaimable = CLAIMABLE_STATES.includes(rec.state);
        const isExpiredClaim = rec.state === STATES.CLAIMED
          && rec.lease_expires_at_ms !== null
          && rec.lease_expires_at_ms <= now;
        if (isFreshlyClaimable || isExpiredClaim) candidates.push(rec);
      }
      if (candidates.length === 0) return null;

      // Oldest first (deterministic): by received time, tie-broken by seq.
      candidates.sort((a, b) => (a.received_at_ms - b.received_at_ms) || (a.seq - b.seq));
      const rec = candidates[0];

      // An expired claim is re-queued first so the transition stays legal.
      if (rec.state === STATES.CLAIMED) {
        assertTransition(rec.state, STATES.QUEUED);
        rec.state = STATES.QUEUED;
      }
      assertTransition(rec.state, STATES.CLAIMED);
      rec.state = STATES.CLAIMED;
      rec.claimed_by = workerId;
      rec.lease_expires_at_ms = now + leaseMs;
      rec.attempt_count += 1;
      rec.updated_at_ms = now;
      return cloneRecord(rec);
    },

    transition(captureId, toState, opts) {
      const now = requireNow(opts, 'transition');
      const rec = getInternal(captureId);
      assertTransition(rec.state, toState);
      rec.state = toState;
      rec.updated_at_ms = now;
      if (toState === STATES.QUEUED || toState === STATES.OFFLINE_QUEUED) {
        // Releasing back to the queue clears the lease.
        rec.claimed_by = null;
        rec.lease_expires_at_ms = null;
      }
      return cloneRecord(rec);
    },

    recordDestination(captureId, destinationRef, opts) {
      const now = requireNow(opts, 'recordDestination');
      if (!destinationRef || typeof destinationRef !== 'object') {
        throw new Error('recordDestination: destinationRef object required');
      }
      const rec = getInternal(captureId);
      rec.destination_ref = { ...destinationRef };
      rec.updated_at_ms = now;
      return cloneRecord(rec);
    },

    recordEvidence(captureId, evidencePointer, opts) {
      const now = requireNow(opts, 'recordEvidence');
      if (!evidencePointer || typeof evidencePointer !== 'object') {
        throw new Error('recordEvidence: evidencePointer object required');
      }
      const rec = getInternal(captureId);
      // Idempotent on (capture_id, evidence_kind + target_ref): do not multiply
      // identical evidence on retry (§5.4).
      const dupe = rec.evidence_pointers.some(
        (e) => e.evidence_kind === evidencePointer.evidence_kind
          && e.target_ref === evidencePointer.target_ref,
      );
      if (!dupe) {
        rec.evidence_pointers.push({ ...evidencePointer, created_at_ms: now });
      }
      rec.updated_at_ms = now;
      return cloneRecord(rec);
    },

    complete(captureId, opts) {
      const now = requireNow(opts, 'complete');
      const rec = getInternal(captureId);
      // completed is gated: must be evidenced, with both pointers present.
      if (rec.state !== STATES.EVIDENCED) {
        throw new Error(`complete: capture "${captureId}" is "${rec.state}", must be "evidenced" first`);
      }
      if (!rec.destination_ref) {
        throw new Error(`complete: capture "${captureId}" has no destination pointer`);
      }
      if (rec.evidence_pointers.length === 0) {
        throw new Error(`complete: capture "${captureId}" has no evidence pointer`);
      }
      assertTransition(rec.state, STATES.COMPLETED);
      rec.state = STATES.COMPLETED;
      rec.updated_at_ms = now;
      return cloneRecord(rec);
    },

    list() {
      return [...byCaptureId.values()]
        .sort((a, b) => a.seq - b.seq)
        .map(cloneRecord);
    },
  };
}
