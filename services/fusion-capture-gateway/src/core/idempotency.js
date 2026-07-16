// Idempotency-key construction + dedup helper (Capture Contract Pack v1 §5).
//
// FIXTURES ONLY (WP0): pure logic. Uses node:crypto (stdlib) for hashing only.
//
// Design intent (§5): the key is derived deterministically from stable
// channel-native identifiers + a content digest, conceptually
//   <source_channel>:<channel_native_message_id>:sha256(<normalised_raw_payload>)
//
// It MUST NOT depend on wall-clock time or retry count: the same logical
// capture, re-delivered, yields the same key → the same capture_id.

import { createHash } from 'node:crypto';

/**
 * Deterministic, order-independent JSON serialisation for object payloads, so
 * two structurally-equal payloads hash identically regardless of key order.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Normalise a raw payload before digesting. For strings: Unicode NFC, collapse
 * internal whitespace runs to a single space, and trim. For objects/arrays:
 * stable stringify. Buffers/Uint8Arrays: raw bytes.
 *
 * Normalisation is what makes a re-sent message with cosmetic whitespace
 * differences resolve to the SAME key.
 */
export function normalisePayload(payload) {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') {
    return payload.normalize('NFC').replace(/\s+/g, ' ').trim();
  }
  if (payload instanceof Uint8Array) {
    return Buffer.from(payload); // hashed as raw bytes
  }
  if (typeof payload === 'object') {
    return stableStringify(payload);
  }
  return String(payload);
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Build a deterministic idempotency key.
 *
 * @param {object} parts
 * @param {string} parts.source_channel          e.g. "telegram"
 * @param {string} parts.channel_native_message_id  stable channel-native id,
 *        e.g. "chat:88012345:msg:40771"
 * @param {string|object|Uint8Array} parts.raw_payload  the captured content
 * @returns {string} idempotency key
 */
export function buildIdempotencyKey({ source_channel, channel_native_message_id, raw_payload } = {}) {
  if (typeof source_channel !== 'string' || source_channel.length === 0) {
    throw new Error('buildIdempotencyKey: source_channel required');
  }
  if (typeof channel_native_message_id !== 'string' || channel_native_message_id.length === 0) {
    throw new Error('buildIdempotencyKey: channel_native_message_id required');
  }
  const digest = sha256Hex(normalisePayload(raw_payload));
  return `${source_channel}:${channel_native_message_id}:sha256:${digest}`;
}

/**
 * A tiny dedup index: maps idempotency_key → capture_id. Lets intake resolve a
 * re-delivery to the existing capture instead of creating a duplicate.
 * In-memory fixture; the real implementation is a UNIQUE constraint in
 * Postgres (see migrations/0001_wp0_operational_baseline.sql).
 */
export function createDedupIndex(initial = []) {
  const map = new Map(initial);
  return {
    has: (key) => map.has(key),
    get: (key) => map.get(key),
    /**
     * Register key→capture_id. Idempotent: if the key already exists, returns
     * the EXISTING capture_id and does not overwrite ({ isNew: false }).
     */
    register: (key, captureId) => {
      if (map.has(key)) return { captureId: map.get(key), isNew: false };
      map.set(key, captureId);
      return { captureId, isNew: true };
    },
    get size() { return map.size; },
  };
}
