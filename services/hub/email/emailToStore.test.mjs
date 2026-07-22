// BUILD-002 WP6 — email → durable store: fixtures proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailToStore } from './emailToStore.mjs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';

const NOW = 1_800_000_000_000;
const EMAIL = { message_id: '<store1@x>', from: 'w@x', to: ['a@x'], subject: 'Follow up', body: 'chase the pricing model' };

test('an email is recorded as a durable capture (accepted) with its route', async () => {
  const store = createInMemoryOperationalStore();
  const r = await emailToStore(EMAIL, store, { now: NOW });
  assert.equal(r.isNew, true);
  assert.equal(r.record.state, 'accepted');
  assert.equal(r.record.source_channel, 'email');
  assert.equal(r.route, 'note');
  assert.equal(store.list().length, 1);
});

test('re-delivery of the same message id dedups (idempotent on message id)', async () => {
  const store = createInMemoryOperationalStore();
  await emailToStore(EMAIL, store, { now: NOW });
  const again = await emailToStore({ ...EMAIL, subject: 'edited subject' }, store, { now: NOW + 5 });
  assert.equal(again.isNew, false);
  assert.equal(store.list().length, 1);
});

test('a YouTube-link email is recorded and routed to the youtube lane', async () => {
  const store = createInMemoryOperationalStore();
  const r = await emailToStore({ ...EMAIL, message_id: '<yt@x>', body: 'https://youtu.be/pcR30j-sKxU' }, store, { now: NOW });
  assert.equal(r.route, 'youtube');
  assert.equal(r.record.state, 'accepted');
});

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

test('an uncertain (empty) email is DURABLY HELD + its clarification card is filed (TQA-005)', async () => {
  const store = createInMemoryOperationalStore();
  const { cards, fileDecisionCard } = makeCardWriter();
  const r = await emailToStore({ message_id: '<empty@x>', from: 'x@y', subject: '', body: '' }, store, { now: NOW, fileDecisionCard });
  assert.equal(r.route, 'needs_clarification');
  assert.equal(r.held, true, 'truthfully held awaiting clarification');
  assert.notEqual(r.record, null, 'the uncertain email is durably persisted — never record:null');
  assert.equal(r.record.recorded_intent, 'needs_clarification', 'held state is truthful');
  assert.equal(r.record.source_channel, 'email', 'channel retained');
  assert.equal(r.record.original_source_ref.message_id, '<empty@x>', 'provenance retained');
  assert.ok(r.capture_id, 'a durable capture id is returned');
  assert.ok(r.card_id.startsWith('email-decision:'), 'a durable card id is returned');
  assert.equal(store.list().length, 1, 'the held capture IS durably recorded');
  assert.equal(cards.size, 1, 'the correlated clarification card is durably filed');
});

test('a re-delivered uncertain email duplicates neither the capture nor the card (idempotent hold)', async () => {
  const store = createInMemoryOperationalStore();
  const { cards, fileDecisionCard } = makeCardWriter();
  const email = { message_id: '<empty2@x>', from: 'x@y', subject: '', body: '' };
  const a = await emailToStore(email, store, { now: NOW, fileDecisionCard });
  const b = await emailToStore(email, store, { now: NOW + 5, fileDecisionCard });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false, 'retry returns the existing capture');
  assert.equal(store.list().length, 1, 'no duplicate capture');
  assert.equal(cards.size, 1, 'no duplicate card');
});

test('an uncertain email fails CLOSED if no durable card writer is provided (never silently dropped)', async () => {
  const store = createInMemoryOperationalStore();
  await assert.rejects(
    emailToStore({ message_id: '<empty3@x>', subject: '', body: '' }, store, { now: NOW }),
    /fileDecisionCard is required/,
  );
  assert.equal(store.list().length, 0, 'nothing half-written on the fail-closed path');
});
