// BUILD-002 WP6 — email → durable store: fixtures proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailToStore } from './emailToStore.mjs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';

const NOW = 1_800_000_000_000;
const EMAIL = { message_id: '<store1@x>', from: 'w@x', to: ['a@x'], subject: 'Follow up', body: 'chase the pricing model' };

test('an email is recorded as a durable capture (accepted) with its route', () => {
  const store = createInMemoryOperationalStore();
  const r = emailToStore(EMAIL, store, { now: NOW });
  assert.equal(r.isNew, true);
  assert.equal(r.record.state, 'accepted');
  assert.equal(r.record.source_channel, 'email');
  assert.equal(r.route, 'note');
  assert.equal(store.list().length, 1);
});

test('re-delivery of the same message id dedups (idempotent on message id)', () => {
  const store = createInMemoryOperationalStore();
  emailToStore(EMAIL, store, { now: NOW });
  const again = emailToStore({ ...EMAIL, subject: 'edited subject' }, store, { now: NOW + 5 });
  assert.equal(again.isNew, false);
  assert.equal(store.list().length, 1);
});

test('a YouTube-link email is recorded and routed to the youtube lane', () => {
  const store = createInMemoryOperationalStore();
  const r = emailToStore({ ...EMAIL, message_id: '<yt@x>', body: 'https://youtu.be/pcR30j-sKxU' }, store, { now: NOW });
  assert.equal(r.route, 'youtube');
  assert.equal(r.record.state, 'accepted');
});

test('an empty email is held for clarification, NOT recorded as actionable', () => {
  const store = createInMemoryOperationalStore();
  const r = emailToStore({ message_id: '<empty@x>', from: 'x', subject: '', body: '' }, store, { now: NOW });
  assert.equal(r.route, 'needs_clarification');
  assert.equal(r.record, null);
  assert.equal(store.list().length, 0);
});
