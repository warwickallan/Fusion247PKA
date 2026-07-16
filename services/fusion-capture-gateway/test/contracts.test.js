import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION,
  ENVELOPE_SCHEMA,
  ACTION_SCHEMA,
  RECEIPT_SCHEMA,
  createEnvelope,
  validateEnvelope,
  createAction,
  validateAction,
  createReceipt,
  validateReceipt,
} from '../src/core/contracts.js';
import { STATES } from '../src/core/states.js';

// A known-good synthetic envelope (no real data).
function goodEnvelope(overrides = {}) {
  return createEnvelope({
    capture_id: '9f1c2a4e-0000-4d11-a000-abc123synthetic',
    idempotency_key: 'telegram:chat:88012345:msg:40771:sha256:3f9a',
    source_channel: 'telegram',
    sender_identity_ref: 'identity:usr_wp0_primary',
    recorded_intent: 'SaveToBrain',
    technical_source_type: 'text',
    raw_payload_ref: {
      store: 'supabase-storage',
      object_key: 'raw/2026/07/16/9f1c2a4e.txt',
      content_type: 'text/plain',
      bytes: 214,
      sha256: '3f9a1b7c',
    },
    original_source_ref: {
      store: 'supabase-storage',
      message_ref: 'telegram:chat:88012345:msg:40771',
      retained: true,
    },
    captured_at: '2026-07-16T10:15:03Z',
    received_at: '2026-07-16T10:15:04Z',
    ...overrides,
  });
}

test('SCHEMA_VERSION is exported and stable', () => {
  assert.equal(SCHEMA_VERSION, 'v1');
  assert.equal(ENVELOPE_SCHEMA, 'capture-envelope/v1');
  assert.equal(ACTION_SCHEMA, 'capture-action/v1');
  assert.equal(RECEIPT_SCHEMA, 'capture-receipt/v1');
});

test('valid envelope passes', () => {
  const res = validateEnvelope(goodEnvelope());
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(res.value.schema_version, ENVELOPE_SCHEMA);
});

test('envelope with inline text and null original_source_ref passes', () => {
  const res = validateEnvelope(goodEnvelope({ original_source_ref: null }));
  assert.equal(res.ok, true, JSON.stringify(res.errors));
});

test('invalid envelope: bad enum + missing field returns errors, does not throw', () => {
  const res = validateEnvelope(goodEnvelope({
    source_channel: 'carrier-pigeon',
    sender_identity_ref: undefined,
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('source_channel')));
  assert.ok(res.errors.some((e) => e.startsWith('sender_identity_ref')));
});

test('invalid envelope: original_source_ref present but not retained is rejected', () => {
  const res = validateEnvelope(goodEnvelope({
    original_source_ref: { store: 'supabase-storage', message_ref: 'x', retained: false },
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('retained')));
});

test('invalid envelope: malformed raw_payload_ref is rejected', () => {
  const res = validateEnvelope(goodEnvelope({ raw_payload_ref: { store: 'x' } }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('raw_payload_ref.object_key')));
});

test('non-object envelope returns error, does not throw', () => {
  assert.equal(validateEnvelope(null).ok, false);
  assert.equal(validateEnvelope('nope').ok, false);
});

// --- Action ---------------------------------------------------------------

test('valid action passes', () => {
  const action = createAction({
    capture_id: '9f1c2a4e-0000-4d11-a000-abc123synthetic',
    action: 'SaveToBrain',
    action_id: 'act-0001',
    actor_identity_ref: 'identity:usr_wp0_primary',
    requested_at: '2026-07-16T10:16:00Z',
    params: { destination_hint: 'aquaponics' },
  });
  const res = validateAction(action);
  assert.equal(res.ok, true, JSON.stringify(res.errors));
});

test('invalid action: unknown action enum rejected', () => {
  const res = validateAction(createAction({
    capture_id: 'c1',
    action: 'Nuke',
    action_id: 'a1',
    actor_identity_ref: 'identity:usr_wp0_primary',
    requested_at: '2026-07-16T10:16:00Z',
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('action:')));
});

test('invalid action: missing action_id + bad timestamp', () => {
  const res = validateAction(createAction({
    capture_id: 'c1',
    action: 'Retry',
    actor_identity_ref: 'identity:usr_wp0_primary',
    requested_at: 'not-a-time',
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('action_id')));
  assert.ok(res.errors.some((e) => e.startsWith('requested_at')));
});

// --- Receipt --------------------------------------------------------------

test('valid safe-and-waiting receipt passes', () => {
  const res = validateReceipt(createReceipt({
    capture_id: 'c1',
    state: STATES.OFFLINE_QUEUED,
    status_line: "Saved and waiting — I'll process this as soon as the worker is back.",
    is_terminal: false,
    safe_and_waiting: true,
    updated_at: '2026-07-16T10:16:05Z',
  }));
  assert.equal(res.ok, true, JSON.stringify(res.errors));
});

test('valid completed receipt with both pointers passes', () => {
  const res = validateReceipt(createReceipt({
    capture_id: 'c1',
    state: STATES.COMPLETED,
    status_line: 'Completed.',
    is_terminal: true,
    safe_and_waiting: false,
    destination_ref: { path: 'PKM/Notes/x.md' },
    evidence_ref: { commit: 'abc123' },
    updated_at: '2026-07-16T10:20:00Z',
  }));
  assert.equal(res.ok, true, JSON.stringify(res.errors));
});

test('invalid receipt: completed without evidence/destination is rejected', () => {
  const res = validateReceipt(createReceipt({
    capture_id: 'c1',
    state: STATES.COMPLETED,
    status_line: 'Completed.',
    is_terminal: true,
    safe_and_waiting: false,
    updated_at: '2026-07-16T10:20:00Z',
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('destination_ref')));
  assert.ok(res.errors.some((e) => e.startsWith('evidence_ref')));
});

test('invalid receipt: safe-and-waiting flag missing on queued state', () => {
  const res = validateReceipt(createReceipt({
    capture_id: 'c1',
    state: STATES.QUEUED,
    status_line: 'waiting',
    is_terminal: false,
    safe_and_waiting: false,
    updated_at: '2026-07-16T10:16:05Z',
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('safe_and_waiting')));
});

test('invalid receipt: failed state without failure block rejected', () => {
  const res = validateReceipt(createReceipt({
    capture_id: 'c1',
    state: STATES.FAILED,
    status_line: 'It failed.',
    is_terminal: false,
    safe_and_waiting: false,
    updated_at: '2026-07-16T10:16:05Z',
  }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.startsWith('failure')));
});
