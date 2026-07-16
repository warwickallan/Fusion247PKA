import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { STATES } from '../src/core/states.js';
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

test('accept is durable and lands in accepted state', () => {
  const store = createInMemoryOperationalStore();
  const { record, isNew } = store.recordIntake(envelope(), { now: T0 });
  assert.equal(isNew, true);
  assert.equal(record.state, STATES.ACCEPTED);
  assert.equal(record.capture_id, 'cap-1');
  assert.equal(store.getByCaptureId('cap-1').state, STATES.ACCEPTED);
  assert.equal(store.list().length, 1);
});

test('duplicate (same idempotency key) does NOT create a second record', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  // Re-delivery: same key, even with a different proposed capture_id.
  const again = store.recordIntake(envelope({ capture_id: 'cap-DIFFERENT' }), { now: T0 + 5 });
  assert.equal(again.isNew, false);
  assert.equal(again.record.capture_id, 'cap-1'); // existing capture returned
  assert.equal(store.list().length, 1);
  assert.equal(store.getByCaptureId('cap-DIFFERENT'), undefined);
});

test('claim leases the oldest claimable item and enforces the lease', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1', msg: 'm1' }), { now: T0 });
  store.recordIntake(envelope({ capture_id: 'cap-2', msg: 'm2' }), { now: T0 + 1 });
  store.enqueue('cap-1', { now: T0 + 2 });
  store.enqueue('cap-2', { now: T0 + 3 });

  const leaseMs = 30_000;
  const claimed = store.claim('worker-A', leaseMs, { now: T0 + 10 });
  assert.equal(claimed.capture_id, 'cap-1'); // oldest first
  assert.equal(claimed.state, STATES.CLAIMED);
  assert.equal(claimed.claimed_by, 'worker-A');
  assert.equal(claimed.lease_expires_at_ms, T0 + 10 + leaseMs);

  // A second worker within the lease window cannot re-grab cap-1; it gets cap-2.
  const claimed2 = store.claim('worker-B', leaseMs, { now: T0 + 20 });
  assert.equal(claimed2.capture_id, 'cap-2');

  // Nothing left claimable while both leases are live.
  assert.equal(store.claim('worker-C', leaseMs, { now: T0 + 25 }), null);
});

test('an expired lease is reclaimable by another worker', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1', msg: 'm1' }), { now: T0 });
  store.enqueue('cap-1', { now: T0 + 1 });

  const leaseMs = 30_000;
  const a = store.claim('worker-A', leaseMs, { now: T0 + 10 });
  assert.equal(a.claimed_by, 'worker-A');

  // Before expiry: not reclaimable.
  assert.equal(store.claim('worker-B', leaseMs, { now: T0 + 100 }), null);

  // After expiry (now >= lease_expires_at): worker-B reclaims it.
  const b = store.claim('worker-B', leaseMs, { now: T0 + 10 + leaseMs + 1 });
  assert.equal(b.capture_id, 'cap-1');
  assert.equal(b.claimed_by, 'worker-B');
  assert.equal(b.state, STATES.CLAIMED);
  assert.ok(b.attempt_count >= 2);
});

test('write → evidence → completion transitions work and are gated', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });

  store.transition('cap-1', STATES.WRITING, { now: T0 + 3 });
  store.recordDestination('cap-1', { path: 'PKM/Notes/aquaponics.md', anchor: 'ph-buffer' }, { now: T0 + 4 });
  const written = store.transition('cap-1', STATES.WRITTEN, { now: T0 + 5 });
  assert.equal(written.state, STATES.WRITTEN);

  // Cannot complete before evidenced.
  assert.throws(() => store.complete('cap-1', { now: T0 + 6 }), /must be "evidenced"/);

  store.recordEvidence('cap-1', { evidence_kind: 'git_commit', target_ref: 'abc123' }, { now: T0 + 6 });
  store.transition('cap-1', STATES.EVIDENCED, { now: T0 + 7 });

  const completed = store.complete('cap-1', { now: T0 + 8 });
  assert.equal(completed.state, STATES.COMPLETED);
  assert.equal(completed.destination_ref.path, 'PKM/Notes/aquaponics.md');
  assert.equal(completed.evidence_pointers.length, 1);
});

test('complete refuses when evidenced but no destination pointer exists', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { now: T0 + 1 });
  store.claim('worker-A', 30_000, { now: T0 + 2 });
  store.transition('cap-1', STATES.WRITING, { now: T0 + 3 });
  store.transition('cap-1', STATES.WRITTEN, { now: T0 + 4 });
  store.recordEvidence('cap-1', { evidence_kind: 'git_commit', target_ref: 'abc' }, { now: T0 + 5 });
  store.transition('cap-1', STATES.EVIDENCED, { now: T0 + 6 });
  assert.throws(() => store.complete('cap-1', { now: T0 + 7 }), /no destination pointer/);
});

test('evidence recording is idempotent on (kind, target_ref)', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.recordEvidence('cap-1', { evidence_kind: 'markdown_write', target_ref: 'PKM/x.md' }, { now: T0 + 1 });
  const rec = store.recordEvidence('cap-1', { evidence_kind: 'markdown_write', target_ref: 'PKM/x.md' }, { now: T0 + 2 });
  assert.equal(rec.evidence_pointers.length, 1); // not multiplied on retry
});

test('illegal transition is rejected by the store', () => {
  const store = createInMemoryOperationalStore();
  store.recordIntake(envelope({ capture_id: 'cap-1' }), { now: T0 });
  store.enqueue('cap-1', { now: T0 + 1 });
  // queued → completed is not a legal hop.
  assert.throws(() => store.transition('cap-1', STATES.COMPLETED, { now: T0 + 2 }), /Illegal state transition/);
});

test('methods demand an injected numeric now (no wall-clock)', () => {
  const store = createInMemoryOperationalStore();
  assert.throws(() => store.recordIntake(envelope(), {}), /injected numeric `now`/);
  assert.throws(() => store.claim('w', 1000, {}), /injected numeric `now`/);
});
