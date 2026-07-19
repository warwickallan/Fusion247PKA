// BUILD-014 WP-B — append-only event-ledger helpers (ops.agent_event).
//
// ops.agent_event is INSERT-only + immutable (the WP-A migration rejects UPDATE/DELETE/
// TRUNCATE). Corrections are NEW events, never edits. Every event carries a unique
// delivery_key: a REDELIVERY of the same logical event collides on that key and is
// ingested at most once. That unique key is the pivot of exactly-once EFFECT: an
// at-least-once handler that re-emits the same effect event lands it exactly once.

import { createHash } from 'node:crypto';

/** sha256 fingerprint of a payload (proves integrity without storing governed content). */
export function hashPayload(payload) {
  const json = JSON.stringify(payload ?? {});
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}

/**
 * Append ONE event to ops.agent_event, idempotently.
 *
 * ON CONFLICT (delivery_key) DO NOTHING makes the write safe to retry: a re-delivery of
 * the same delivery_key is a no-op, so at-least-once delivery yields an exactly-once row.
 * Returns true if a NEW row was inserted, false if the key already existed (deduped).
 *
 * `client` may be a Pool OR a pinned client — pass a pinned client to make the event
 * part of the SAME transaction as ops.complete_job (see worker.mjs), so the effect and
 * the completion commit atomically (or roll back together on a stale lease).
 *
 * occurred_at defaults to clock_timestamp() (NOT now()): now() is fixed at transaction
 * start, so multiple events emitted inside one completion txn would tie and lose their
 * order. clock_timestamp() advances between the sequential INSERTs, giving the ledger a
 * deterministic emission order that reconstructs the lifecycle faithfully.
 */
export async function appendEvent(client, ev) {
  if (!ev.deliveryKey) throw new Error('appendEvent: deliveryKey is required (idempotency pivot)');
  if (!ev.eventKind) throw new Error('appendEvent: eventKind is required');
  const payload = ev.payload ?? {};
  const res = await client.query(
    `insert into ops.agent_event
       (build_id, delivery_key, event_kind, actor, payload_hash, payload, classification, occurred_at)
     values ($1, $2, $3, $4, $5, $6::jsonb,
             coalesce($7, 'internal')::ops.data_classification,
             coalesce($8, clock_timestamp()))
     on conflict (delivery_key) do nothing
     returning id`,
    [
      ev.buildId ?? null,
      ev.deliveryKey,
      ev.eventKind,
      ev.actor ?? null,
      ev.payloadHash ?? hashPayload(payload),
      JSON.stringify(payload),
      ev.classification ?? null,
      ev.occurredAt ?? null,
    ]);
  return res.rowCount === 1;
}
