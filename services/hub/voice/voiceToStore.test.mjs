// BUILD-002 WP6 — voice → durable store: fixtures proof (parity with emailToStore).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceToStore } from './voiceToStore.mjs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';

const NOW = 1_800_000_000_000;

test('a clear voice memo becomes a durable capture (accepted) with its route', async () => {
  const store = createInMemoryOperationalStore();
  const r = await voiceToStore({ voice_ref: 'V1' }, { transcribe: async () => ({ text: 'book the dentist on Friday' }) }, store, { now: NOW });
  assert.equal(r.isNew, true);
  assert.equal(r.record.state, 'accepted');
  assert.equal(r.record.text_preview, 'book the dentist on Friday', 'the transcript is durably preserved in the store');
  assert.equal(r.route, 'note');
  assert.equal(store.list().length, 1);
});

test('re-delivery of the same voice ref dedups', async () => {
  const store = createInMemoryOperationalStore();
  await voiceToStore({ voice_ref: 'V2' }, { transcribe: async () => ({ text: 'a note' }) }, store, { now: NOW });
  const again = await voiceToStore({ voice_ref: 'V2' }, { transcribe: async () => ({ text: 'a note' }) }, store, { now: NOW + 5 });
  assert.equal(again.isNew, false);
  assert.equal(store.list().length, 1);
});

test('an AMBIGUOUS voice memo is NOT recorded as actionable — it returns the A/B/C card to resolve first', async () => {
  const store = createInMemoryOperationalStore();
  const r = await voiceToStore({ voice_ref: 'V3' }, {
    transcribe: async () => ({ text: 'milk eggs and remind me about the dentist', ambiguous: true,
      interpretations: [{ key: 'A', label: 'Shopping' }, { key: 'B', label: 'Note' }, { key: 'C', label: 'Reminder' }] }),
  }, store, { now: NOW });
  assert.equal(r.route, 'needs_decision');
  assert.equal(r.record, null);
  assert.ok(r.card.intent.idempotency_key.startsWith('voice-decision:'));
  assert.equal(store.list().length, 0, 'nothing recorded as actionable until the ambiguity is resolved');
});
