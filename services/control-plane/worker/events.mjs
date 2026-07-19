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

// ---------------------------------------------------------------------------
// DELIVERY-KEY NAMESPACES + INJECTIVE ENCODING (round-2 fixes 1 & 4).
//
// The delivery_key is the exactly-once pivot. Two logically DISTINCT events must
// never produce the SAME key (a false collision silently drops one), and a false
// SHARE must never happen across jobs. Two namespaces are RESERVED for the runtime:
//   'job:'    — lifecycle events (enqueued/claimed/terminal/reclaimed/dead_lettered/…),
//               scoped by numeric job id (ids are digits-only, so ':' can't smuggle
//               a caller into another job's lifecycle slot).
//   'effect:' — idempotent handler effects, derived below.
// A handler may NOT hand-craft a key in either reserved namespace (assertCallerKeyAllowed).
// ---------------------------------------------------------------------------
export const RESERVED_DELIVERY_PREFIXES = Object.freeze(['job:', 'effect:']);

/**
 * INJECTIVE effect delivery-key (fix 1 — Codex CRIT).
 *
 * The old `effect:${idempotency_key}:${name}` template is NOT injective: any ':' in
 * idempotency_key or name shifts the boundary, so (key='a:', name='b') and
 * (key='a', name=':b') both render `effect:a::b` — a distinct effect silently dedups
 * against another while its job still completes => exactly-once BROKEN.
 *
 * We instead hash a VERSIONED, canonically-encoded tuple. `JSON.stringify(['v1', key,
 * name])` is an unambiguous encoding of the two strings (RFC-8259 escaping makes the
 * array text a bijection of the ordered pair), so distinct (key,name) tuples map to
 * distinct JSON, hence distinct sha256, hence distinct delivery keys — regardless of
 * how many ':' either component contains. The `v1:` version tag lets the encoding evolve.
 */
export function effectDeliveryKey(idempotencyKey, name) {
  if (typeof idempotencyKey !== 'string') throw new Error('effectDeliveryKey: idempotencyKey must be a string');
  if (typeof name !== 'string') throw new Error('effectDeliveryKey: effect name must be a string');
  const canonical = JSON.stringify(['v1', idempotencyKey, name]);
  return 'effect:v1:' + createHash('sha256').update(canonical).digest('hex');
}

/**
 * Guard a CALLER-supplied delivery key (fix 4 — Codex HIGH). A handler that hand-crafts
 * a key MUST NOT be able to land in — and thus dedup against / forge — the runtime's
 * reserved lifecycle ('job:') or effect ('effect:') namespaces, nor another job's scope
 * (which lives under 'job:'). Any such key is REJECTED loudly, never silently treated as
 * an already-delivered success. Caller keys that pass are namespaced under this job's own
 * 'job:<id>:custom:' segment by the runtime, so they can never collide across jobs either.
 */
export function assertCallerKeyAllowed(deliveryKey) {
  if (typeof deliveryKey !== 'string' || deliveryKey.length === 0) {
    throw new Error('emit: a caller deliveryKey must be a non-empty string');
  }
  for (const p of RESERVED_DELIVERY_PREFIXES) {
    if (deliveryKey.startsWith(p)) {
      throw new Error(
        `emit: deliveryKey '${deliveryKey.slice(0, 24)}…' collides with the reserved '${p}' ` +
        `namespace — lifecycle and effect keys are runtime-derived. Use { effect: '<name>' } ` +
        `for an idempotent effect, or omit deliveryKey for a per-attempt event.`);
    }
  }
  return deliveryKey;
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
