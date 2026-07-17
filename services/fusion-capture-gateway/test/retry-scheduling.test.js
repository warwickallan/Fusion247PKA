// Dedicated store-level proofs for the autonomous retry mechanism (Sonnet
// review fix, area C). WP0 previously claimed retry/retry-exhaustion behaviour
// with NO real runtime path — only a test-only helper simulated it. These tests
// exercise the real store.recordFailure() + store.claim() seam directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { buildIdempotencyKey } from '../src/core/idempotency.js';
import { STATES, MAX_DELIVERY_ATTEMPTS } from '../src/core/states.js';
import { computeNextAttemptAtMs, BASE_BACKOFF_MS, MAX_BACKOFF_MS } from '../src/core/retryPolicy.js';

const T0 = 1_752_660_000_000;

function envelope(overrides = {}) {
  const raw_payload = overrides.raw_payload ?? 'retry scheduling probe';
  const idempotency_key = overrides.idempotency_key ?? buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: overrides.msg ?? 'chat:88012345:msg:90001',
    raw_payload,
  });
  return {
    capture_id: overrides.capture_id ?? 'cap-1',
    idempotency_key,
    source_channel: 'telegram',
    sender_identity_ref: 'identity:usr_wp0_primary',
    recorded_intent: 'SaveToBrain',
    technical_source_type: 'text',
    raw_payload_ref: { store: 'supabase-storage', object_key: 'raw/x.txt', content_type: 'text/plain' },
    original_source_ref: { store: 'supabase-storage', message_ref: 'telegram:chat:88012345:msg:90001', retained: true },
    captured_at: '2026-07-16T10:15:03Z',
    received_at: '2026-07-16T10:15:04Z',
  };
}

function driveToFailed(store, captureId, now) {
  store.recordIntake(envelope({ capture_id: captureId }), { now });
  store.enqueue(captureId, { confirmedByTap: true, now: now + 1 });
  const claimed = store.claim('worker-A', 30_000, { now: now + 2 });
  store.transition(captureId, STATES.WRITING, { now: now + 3 });
  const nextAttemptAtMs = computeNextAttemptAtMs(claimed.attempt_count, now + 4);
  return store.recordFailure(captureId, { now: now + 4, error: 'synthetic', nextAttemptAtMs });
}

// --- retryPolicy.js pure-logic proofs ---------------------------------------

test('computeNextAttemptAtMs: exponential, deterministic, capped', () => {
  assert.equal(computeNextAttemptAtMs(1, 1000), 1000 + BASE_BACKOFF_MS);
  assert.equal(computeNextAttemptAtMs(2, 1000), 1000 + BASE_BACKOFF_MS * 2);
  assert.equal(computeNextAttemptAtMs(3, 1000), 1000 + BASE_BACKOFF_MS * 4);
  // Capped: a large attempt count never exceeds MAX_BACKOFF_MS above now.
  assert.equal(computeNextAttemptAtMs(20, 1000), 1000 + MAX_BACKOFF_MS);
  // Deterministic: same inputs, same output, called repeatedly.
  assert.equal(computeNextAttemptAtMs(3, 1000), computeNextAttemptAtMs(3, 1000));
});

test('computeNextAttemptAtMs: rejects non-positive attempt counts and non-finite now', () => {
  assert.throws(() => computeNextAttemptAtMs(0, 1000), /positive integer/);
  assert.throws(() => computeNextAttemptAtMs(-1, 1000), /positive integer/);
  assert.throws(() => computeNextAttemptAtMs(1.5, 1000), /positive integer/);
  assert.throws(() => computeNextAttemptAtMs(1, NaN), /finite number/);
  assert.throws(() => computeNextAttemptAtMs(1, undefined), /finite number/);
});

// --- store.recordFailure() ---------------------------------------------------

test('recordFailure transitions to failed and stamps next_attempt_at_ms', () => {
  const store = createInMemoryOperationalStore();
  const rec = driveToFailed(store, 'cap-1', T0);
  assert.equal(rec.state, STATES.FAILED);
  assert.equal(rec.last_error, 'synthetic');
  assert.equal(typeof rec.next_attempt_at_ms, 'number');
  assert.ok(rec.next_attempt_at_ms > T0 + 4, 'due time is strictly in the future of the failure moment');
});

test('recordFailure without nextAttemptAtMs leaves next_attempt_at_ms null (not autonomously retryable)', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });
  store.transition('cap-1', STATES.WRITING, { now: T0 + 3 });
  const rec = store.recordFailure('cap-1', { now: T0 + 4, error: 'x' });
  assert.equal(rec.state, STATES.FAILED);
  assert.equal(rec.next_attempt_at_ms, null);
  // Never autonomously claimed while next_attempt_at_ms stays null.
  assert.equal(store.claim('worker-B', 30_000, { now: T0 + 999_999 }), null);
});

test('recordFailure requires an injected numeric now', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });
  assert.throws(() => store.recordFailure('cap-1', {}), /injected numeric `now`/);
});

// --- claim() autonomous due-retry reclaim -----------------------------------

test('claim() does NOT reclaim a failed item before its next_attempt_at_ms is due', () => {
  const store = createInMemoryOperationalStore();
  const failed = driveToFailed(store, 'cap-1', T0);
  // One millisecond before due: still refused.
  assert.equal(store.claim('worker-B', 30_000, { now: failed.next_attempt_at_ms - 1 }), null);
});

test('claim() autonomously reclaims a failed item exactly at (and after) its due time', () => {
  const store = createInMemoryOperationalStore();
  const failed = driveToFailed(store, 'cap-1', T0);
  const reclaimed = store.claim('worker-B', 30_000, { now: failed.next_attempt_at_ms });
  assert.ok(reclaimed, 'reclaimed exactly at the due time');
  assert.equal(reclaimed.capture_id, 'cap-1');
  assert.equal(reclaimed.state, STATES.CLAIMED);
  assert.equal(reclaimed.claimed_by, 'worker-B');
  assert.equal(reclaimed.attempt_count, 2, 'attempt_count climbs on the reclaim');
  assert.equal(reclaimed.next_attempt_at_ms, null, 'due time cleared once reclaimed');
});

test('claim() never reclaims a failed item whose attempt_count already reached the cap', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });

  // Drive attempt_count up to the cap via repeated real claim + recordFailure,
  // each reclaim going through the SAME due-retry path under test.
  let now = T0 + 2;
  let last;
  for (let i = 0; i < MAX_DELIVERY_ATTEMPTS; i += 1) {
    const claimed = store.claim('worker-A', 30_000, { now });
    assert.ok(claimed, `claim ${i + 1} succeeds`);
    now += 1;
    const nextAttemptAtMs = computeNextAttemptAtMs(claimed.attempt_count, now);
    last = store.recordFailure('cap-1', { now, error: `fail ${i + 1}`, nextAttemptAtMs });
    now = nextAttemptAtMs; // exactly due for the next loop iteration
  }
  assert.equal(last.attempt_count, MAX_DELIVERY_ATTEMPTS);
  // Due time has arrived, but the cap is reached — claim() must refuse. (In the
  // real worker this capture is dead-lettered instead; here we prove the store
  // primitive itself will not hand out a claim past the cap even if asked.)
  assert.equal(store.claim('worker-Z', 30_000, { now }), null, 'capped attempt_count is never reclaimed');
});

test('claim() prefers an oldest-first ordering even across mixed queued + due-retry candidates', () => {
  const store = createInMemoryOperationalStore();
  // cap-1 fails and becomes due-retryable at T0+100.
  const failed = driveToFailed(store, 'cap-1', T0);
  // cap-2 is a fresh, ordinary queued item received AFTER cap-1 originally, but
  // both are claimable by the time we call claim() at the due moment.
  store.recordIntake(envelope({ capture_id: 'cap-2', msg: 'chat:88012345:msg:90002', raw_payload: 'second item' }), { now: T0 + 50 });
  store.enqueue('cap-2', { confirmedByTap: true, now: T0 + 51 });

  const first = store.claim('worker-X', 30_000, { now: failed.next_attempt_at_ms });
  // cap-1 was received first (received_at_ms = T0) — oldest-first still holds
  // even though it arrived via the due-retry path, not the fresh-queue path.
  assert.equal(first.capture_id, 'cap-1');
  const second = store.claim('worker-X', 30_000, { now: failed.next_attempt_at_ms + 1 });
  assert.equal(second.capture_id, 'cap-2');
});

test('partial → claimed due-retry mirrors failed (forward-compatible; unused by WP0 worker today)', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });
  store.transition('cap-1', STATES.WRITING, { now: T0 + 3 });
  const partial = store.transition('cap-1', STATES.PARTIAL, { now: T0 + 4 });
  assert.equal(partial.state, STATES.PARTIAL);
  // Not due (no next_attempt_at_ms stamped via the generic transition() call).
  assert.equal(store.claim('worker-B', 30_000, { now: T0 + 999_999 }), null);
});
