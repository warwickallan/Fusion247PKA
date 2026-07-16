import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { STATES } from '../src/core/states.js';
import { buildIdempotencyKey } from '../src/core/idempotency.js';

// DATA-LAYER erasure path (security finding F-03). Deterministic: fixed epoch,
// NO wall-clock — every store method takes an injected `now`.
const T0 = 1_752_660_000_000;

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

test('deleteCapture removes an accepted record (getByCaptureId → undefined after)', () => {
  const store = createInMemoryOperationalStore();
  const { record } = store.recordIntake(envelope(), { now: T0 });
  assert.equal(record.state, STATES.ACCEPTED);
  assert.ok(store.getByCaptureId('cap-1'));

  const result = store.deleteCapture('cap-1', { now: T0 + 10 });
  assert.deepEqual(result, { deleted: true, capture_id: 'cap-1' });

  assert.equal(store.getByCaptureId('cap-1'), undefined);
  assert.equal(store.list().length, 0);
});

test('deleteCapture frees the idempotency key: same key re-accepted as isNew:true', () => {
  const store = createInMemoryOperationalStore();
  const env = envelope({ capture_id: 'cap-1' });

  const first = store.recordIntake(env, { now: T0 });
  assert.equal(first.isNew, true);
  // Confirm the key is indexed while the record exists.
  assert.ok(store.getByIdempotencyKey(env.idempotency_key));

  store.deleteCapture('cap-1', { now: T0 + 10 });
  // The index entry is gone with the record.
  assert.equal(store.getByIdempotencyKey(env.idempotency_key), undefined);

  // Same idempotency_key, brand-new capture_id → a genuinely fresh record.
  const reAccept = store.recordIntake(
    envelope({ capture_id: 'cap-2', idempotency_key: env.idempotency_key }),
    { now: T0 + 20 },
  );
  assert.equal(reAccept.isNew, true, 'freed key must produce a NEW record, not the old one');
  assert.equal(reAccept.record.capture_id, 'cap-2');
  assert.equal(store.getByCaptureId('cap-1'), undefined);
  assert.equal(store.getByIdempotencyKey(env.idempotency_key).capture_id, 'cap-2');
});

test('deleteCapture is idempotent: unknown / already-deleted id returns {deleted:false} and does not throw', () => {
  const store = createInMemoryOperationalStore();

  // Never-existed id.
  assert.deepEqual(
    store.deleteCapture('cap-nope', { now: T0 }),
    { deleted: false, capture_id: 'cap-nope' },
  );

  // Delete twice: second delete is a safe no-op (re-runnable erasure).
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  assert.deepEqual(store.deleteCapture('cap-1', { now: T0 + 10 }), { deleted: true, capture_id: 'cap-1' });
  assert.deepEqual(store.deleteCapture('cap-1', { now: T0 + 20 }), { deleted: false, capture_id: 'cap-1' });
});

test('deleteCapture requires an injected numeric `now` (store determinism contract)', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });

  assert.throws(() => store.deleteCapture('cap-1'), /injected numeric `now`/);
  assert.throws(() => store.deleteCapture('cap-1', {}), /injected numeric `now`/);
  assert.throws(() => store.deleteCapture('cap-1', { now: 'soon' }), /injected numeric `now`/);
  // Rejecting the delete on a bad `now` must NOT have removed the record.
  assert.ok(store.getByCaptureId('cap-1'));
});
