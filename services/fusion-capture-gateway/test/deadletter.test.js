import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATES,
  ALL_STATES,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS,
  MAX_DELIVERY_ATTEMPTS,
  canTransition,
  assertTransition,
  isTerminal,
} from '../src/core/states.js';
import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { buildIdempotencyKey } from '../src/core/idempotency.js';

const T0 = 1_752_660_000_000; // fixed synthetic epoch ms; NO wall-clock in tests

function envelope(overrides = {}) {
  const raw_payload = overrides.raw_payload ?? 'aquaponics pH buffer note';
  const idempotency_key = overrides.idempotency_key ?? buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: overrides.msg ?? 'chat:88012345:msg:40771',
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
    original_source_ref: { store: 'supabase-storage', message_ref: 'telegram:chat:88012345:msg:40771', retained: true },
    captured_at: '2026-07-16T10:15:03Z',
    received_at: '2026-07-16T10:15:04Z',
  };
}

// Drive a fresh capture up to `failed` deterministically for store tests.
function makeFailed(store) {
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });
  store.transition('cap-1', STATES.WRITING, { now: T0 + 3 });
  return store.transition('cap-1', STATES.FAILED, { now: T0 + 4 });
}

test('MAX_DELIVERY_ATTEMPTS is exported as a positive integer', () => {
  assert.equal(typeof MAX_DELIVERY_ATTEMPTS, 'number');
  assert.equal(Number.isInteger(MAX_DELIVERY_ATTEMPTS), true);
  assert.ok(MAX_DELIVERY_ATTEMPTS > 0);
});

test('failed → dead_letter is legal; partial → dead_letter mirrors it', () => {
  assert.equal(canTransition(STATES.FAILED, STATES.DEAD_LETTER), true);
  assert.equal(canTransition(STATES.PARTIAL, STATES.DEAD_LETTER), true);
  // Retry hops still legal — dead-letter is additive, not a replacement.
  assert.equal(canTransition(STATES.FAILED, STATES.CLAIMED), true);
  assert.equal(canTransition(STATES.PARTIAL, STATES.WRITING), true);
});

test('dead_letter is terminal: no outgoing transitions, in TERMINAL_STATES', () => {
  assert.deepEqual(ALLOWED_TRANSITIONS[STATES.DEAD_LETTER], []);
  assert.equal(isTerminal(STATES.DEAD_LETTER), true);
  assert.equal(TERMINAL_STATES.includes(STATES.DEAD_LETTER), true);
});

test('dead_letter → anything is rejected (incl. cancel and completed)', () => {
  for (const to of ALL_STATES) {
    assert.equal(
      canTransition(STATES.DEAD_LETTER, to), false,
      `dead_letter → ${to} must be illegal`,
    );
  }
  assert.equal(canTransition(STATES.DEAD_LETTER, STATES.COMPLETED), false);
  assert.equal(canTransition(STATES.DEAD_LETTER, STATES.CANCELLED), false);
  assert.throws(
    () => assertTransition(STATES.DEAD_LETTER, STATES.CLAIMED),
    /Illegal state transition/,
  );
});

test('completed is NOT reachable from dead_letter', () => {
  assert.equal(canTransition(STATES.DEAD_LETTER, STATES.COMPLETED), false);
});

test('store.deadLetter moves failed → dead_letter and records last_error', () => {
  const store = createInMemoryOperationalStore();
  makeFailed(store);
  const dl = store.deadLetter('cap-1', { now: T0 + 5, error: 'adapter 500 x5' });
  assert.equal(dl.state, STATES.DEAD_LETTER);
  assert.equal(dl.last_error, 'adapter 500 x5');
  assert.equal(dl.updated_at_ms, T0 + 5);
  assert.equal(store.getByCaptureId('cap-1').state, STATES.DEAD_LETTER);
});

test('store.deadLetter exposes attempt_count for the worker cap comparison', () => {
  const store = createInMemoryOperationalStore();
  makeFailed(store);
  const dl = store.deadLetter('cap-1', { now: T0 + 5 });
  // claim() incremented attempt_count once; the worker compares it to the cap.
  assert.equal(typeof dl.attempt_count, 'number');
  assert.ok(dl.attempt_count >= 1);
});

test('store.deadLetter requires an injected numeric now', () => {
  const store = createInMemoryOperationalStore();
  makeFailed(store);
  assert.throws(() => store.deadLetter('cap-1', {}), /injected numeric `now`/);
});

test('store.deadLetter rejects an illegal source state', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { confirmedByTap: true, now: T0 + 1 });
  // queued → dead_letter is not a legal hop.
  assert.throws(
    () => store.deadLetter('cap-1', { now: T0 + 2 }),
    /Illegal state transition/,
  );
});
