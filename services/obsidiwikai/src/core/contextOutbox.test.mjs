import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePacket, effectiveSensitivity, deliverPacket } from './contextOutbox.mjs';

function fakeHoncho({ fail = false } = {}) {
  return {
    async ensureWorkspace() {},
    async ensurePeer() {},
    async ensureSession() {},
    async addMessage() { if (fail) throw new Error('honcho down'); return { id: 'honcho-msg-1' }; },
  };
}

// Fake db: the atomic claim succeeds; tx() can be made to throw to simulate a receipt-write failure
// AFTER Honcho has already accepted. Records every statement so tests can assert the state machine.
function fakeDb({ txFails = false } = {}) {
  const calls = [];
  const q = async (text, params) => {
    calls.push({ text, params });
    if (/set state='delivering'/.test(text)) return { rowCount: 1, rows: [{ packet_id: params[0] }] };
    return { rowCount: 1, rows: [{}] };
  };
  const tx = async (fn) => {
    if (txFails) throw new Error('receipt write failed');
    const c = { query: async (text, params) => { calls.push({ text, params }); return { rowCount: 1, rows: [] }; } };
    return fn(c);
  };
  return { db: { q, tx }, calls };
}

test('validatePacket accepts a good preference packet', () => {
  const r = validatePacket({ type: 'preference', summary: 'Warwick prefers visual routing maps.' });
  assert.equal(r.ok, true);
});

test('validatePacket rejects missing type + short summary', () => {
  assert.equal(validatePacket({ summary: 'x' }).ok, false);
  assert.equal(validatePacket({ type: 'nonsense', summary: 'a real summary here' }).ok, false);
});

test('privacy guard escalates health/employer content to restricted', () => {
  assert.equal(effectiveSensitivity({ type: 'decision', summary: 'blood pressure medical review' }), 'restricted');
  assert.equal(effectiveSensitivity({ type: 'decision', summary: 'Bellrock client delivery note' }), 'restricted');
  assert.equal(effectiveSensitivity({ type: 'preference', summary: 'prefers dark mode dashboards' }), 'ordinary');
});

test('prohibited stays prohibited', () => {
  assert.equal(effectiveSensitivity({ type: 'preference', summary: 'x y z', sensitivity: 'prohibited' }), 'prohibited');
});

test('deliverPacket: Honcho ACCEPTED but receipt write fails → needs_reconcile, never requeue (GPT-002)', async () => {
  const { db, calls } = fakeDb({ txFails: true });
  const r = await deliverPacket(
    { packet_id: 'p1', type: 'preference', summary: 'a valid summary here' },
    { honchoClient: fakeHoncho(), db },
  );
  assert.equal(r.state, 'needs_reconcile');
  assert.equal(r.honcho_accepted, true);
  assert.ok(calls.some((c) => /set state='needs_reconcile'/.test(c.text)), 'must fail-safe to needs_reconcile');
  assert.ok(!calls.some((c) => /set state='queued'/.test(c.text)), 'must NOT reset to queued (would duplicate)');
});

test('deliverPacket: Honcho delivery not confirmed → released back to queued for retry (GPT-002)', async () => {
  const { db, calls } = fakeDb();
  await assert.rejects(deliverPacket(
    { packet_id: 'p2', type: 'preference', summary: 'another valid summary' },
    { honchoClient: fakeHoncho({ fail: true }), db },
  ));
  assert.ok(calls.some((c) => /set state='queued'/.test(c.text)), 'unconfirmed delivery is safe to requeue');
  assert.ok(!calls.some((c) => /set state='needs_reconcile'/.test(c.text)));
});

test('deliverPacket: a correction retires the packet it supersedes (GPT-002 supersession)', async () => {
  const { db, calls } = fakeDb();
  const r = await deliverPacket(
    { packet_id: 'p3', type: 'correction', summary: 'supersedes an earlier note', supersedes: 'p0' },
    { honchoClient: fakeHoncho(), db },
  );
  assert.equal(r.state, 'delivered');
  assert.equal(r.superseded, 'p0');
  const sup = calls.find((c) => /set state='superseded'/.test(c.text));
  assert.ok(sup, 'expected the prior packet to be retired to superseded');
  assert.equal(sup.params[0], 'p0');
});
