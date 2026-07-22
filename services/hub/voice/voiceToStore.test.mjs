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

// A fixture decision-card writer: durable Map, idempotent on the card's own idempotency_key.
function makeCardWriter() {
  const cards = new Map();
  const fileDecisionCard = async (intent) => {
    const id = intent.idempotency_key;
    const isNew = !cards.has(id);
    if (isNew) cards.set(id, intent);
    return { card_id: id, isNew };
  };
  return { cards, fileDecisionCard };
}

test('an AMBIGUOUS voice memo is DURABLY HELD (never dropped) + its decision card is filed (TQA-005)', async () => {
  const store = createInMemoryOperationalStore();
  const { cards, fileDecisionCard } = makeCardWriter();
  const r = await voiceToStore({ voice_ref: 'V3' }, {
    transcribe: async () => ({ text: 'milk eggs and remind me about the dentist', ambiguous: true,
      interpretations: [{ key: 'A', label: 'Shopping' }, { key: 'B', label: 'Note' }, { key: 'C', label: 'Reminder' }] }),
    fileDecisionCard,
  }, store, { now: NOW });
  assert.equal(r.route, 'needs_decision');
  assert.equal(r.held, true, 'truthfully held awaiting decision');
  assert.notEqual(r.record, null, 'the ambiguous capture is durably persisted — never record:null');
  assert.equal(r.record.recorded_intent, 'needs_decision', 'held state is truthful');
  assert.equal(r.record.text_preview, 'milk eggs and remind me about the dentist', 'original content retained');
  assert.equal(r.record.source_channel, 'voice', 'channel retained');
  assert.equal(r.record.original_source_ref.voice_ref, 'V3', 'provenance retained');
  assert.ok(r.capture_id, 'a durable capture id is returned');
  assert.ok(r.card_id.startsWith('voice-decision:'), 'a durable card id is returned');
  assert.equal(store.list().length, 1, 'the held capture IS durably recorded');
  assert.equal(cards.size, 1, 'the correlated decision card is durably filed');
});

test('a re-delivered AMBIGUOUS voice memo duplicates neither the capture nor the card (idempotent hold)', async () => {
  const store = createInMemoryOperationalStore();
  const { cards, fileDecisionCard } = makeCardWriter();
  const deps = { transcribe: async () => ({ text: 'ambiguous thing', ambiguous: true }), fileDecisionCard };
  const a = await voiceToStore({ voice_ref: 'V4' }, deps, store, { now: NOW });
  const b = await voiceToStore({ voice_ref: 'V4' }, deps, store, { now: NOW + 5 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false, 'retry returns the existing capture');
  assert.equal(store.list().length, 1, 'no duplicate capture');
  assert.equal(cards.size, 1, 'no duplicate card');
});

test('an ambiguous voice memo fails CLOSED if no durable card writer is provided (never silently dropped)', async () => {
  const store = createInMemoryOperationalStore();
  await assert.rejects(
    voiceToStore({ voice_ref: 'V5' }, { transcribe: async () => ({ text: 'x', ambiguous: true }) }, store, { now: NOW }),
    /fileDecisionCard is required/,
  );
  assert.equal(store.list().length, 0, 'nothing half-written on the fail-closed path');
});
