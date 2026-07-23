// Email source adapter — deterministic acceptance with injected fakes (no live Graph / no DB).
// Proves the contract Warwick set: baseline ingests nothing; new mail → durable capture → Cairn
// receipt; replay creates no duplicate; a routing failure loses nothing (and is recoverable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmailSource } from './email.mjs';
import { classify } from '../cairn/classify.mjs';
import { LANE } from '../cairn/contracts.mjs';

function fakeGraph(pages, messages) {
  return {
    mailbox: 'warwickallan-f247@outlook.com',
    calls: [],
    async deltaPage(link) { this.calls.push(link ?? 'INIT'); return pages[link ?? 'INIT']; },
    async getMessage(id) { return messages[id]; },
    async listAttachments() { return []; },
  };
}

function fakeStore() {
  const captures = new Map(); const cursors = new Map(); const errors = new Map();
  return {
    captures, cursors, errors,
    async getCursor(mb) { return cursors.get(mb) || null; },
    async saveCursor(mb, dl, { baseline = false } = {}) {
      const prev = cursors.get(mb) || {};
      cursors.set(mb, { mailbox: mb, delta_link: dl, baseline_at: baseline ? 'now' : prev.baseline_at });
    },
    async hasCapture(k) { for (const c of captures.values()) if (c.dedupe_key === k) return true; return false; },
    async saveCapture(c) { if (!captures.has(c.capture_id)) captures.set(c.capture_id, { ...c, routed: false }); },
    async markRouted(id, r) { const c = captures.get(id); if (c) { c.routed = true; c.receipt = r; } },
    async markError(id, e) { errors.set(id, e); },
    async touchPolled() {},
    async unrouted() {
      return [...captures.values()].filter((c) => !c.routed)
        .map((c) => ({ capture_id: c.capture_id, subject: c.subject, text: c.text, source_type: 'email', source_id: c.dedupe_key }));
    },
  };
}

const msgMeta = (id, imid) => ({ id, internetMessageId: imid });
const msgFull = (id, imid, subject, content) => ({
  id, internetMessageId: imid, subject, body: { contentType: 'text', content },
  from: { emailAddress: { address: 'gpt-bridge@gmail.com', name: 'GPT' } }, toRecipients: [], receivedDateTime: '2026-07-23T10:00:00Z', hasAttachments: false,
});

test('baseline walks to the deltaLink and ingests NOTHING', async () => {
  const graph = fakeGraph({
    INIT: { messages: [msgMeta('w1', '<welcome@ms>'), msgMeta('w2', '<security@ms>')], nextLink: 'P2', deltaLink: null },
    P2: { messages: [msgMeta('w3', '<promo@ms>')], nextLink: null, deltaLink: 'DELTA0' },
  }, {});
  const store = fakeStore();
  const src = createEmailSource({ graph, store, route: async () => { throw new Error('route must NOT be called during baseline'); } });
  const r = await src.establishBaseline();
  assert.equal(r.skipped, 3);
  assert.equal(store.captures.size, 0);                     // no pre-existing mail captured
  assert.equal(store.cursors.get(graph.mailbox).delta_link, 'DELTA0'); // cursor persisted
});

test('new mail after baseline → durable capture → Cairn receipt', async () => {
  const graph = fakeGraph({
    DELTA0: { messages: [msgMeta('n1', '<hello@x>')], nextLink: null, deltaLink: 'DELTA1' },
  }, { n1: msgFull('n1', '<hello@x>', 'Honch that', 'Warwick builds to the goal, not a narrow slice') });
  const store = fakeStore();
  store.cursors.set(graph.mailbox, { mailbox: graph.mailbox, delta_link: 'DELTA0', baseline_at: 'now' });
  const routed = [];
  const src = createEmailSource({ graph, store, route: async (c) => { routed.push(c); return { receipt: `→ ${classify(c).lane}` }; } });
  const r = await src.pollOnce();
  assert.equal(r.captured, 1);
  assert.equal(r.routed, 1);
  assert.equal(store.captures.size, 1);
  assert.equal(routed[0].capture_id, 'email:<hello@x>');
  assert.equal(classify(routed[0]).lane, LANE.HONCHO);       // Cairn (not the mailbox) routes "Honch that" → Honcho
  assert.equal(store.cursors.get(graph.mailbox).delta_link, 'DELTA1'); // cursor advanced
});

test('replay creates no duplicate', async () => {
  const graph = fakeGraph({
    DELTA0: { messages: [msgMeta('n1', '<dup@x>')], nextLink: null, deltaLink: 'DELTA0' }, // delta re-serves the same id
  }, { n1: msgFull('n1', '<dup@x>', 'A note', 'body') });
  const store = fakeStore();
  store.cursors.set(graph.mailbox, { mailbox: graph.mailbox, delta_link: 'DELTA0', baseline_at: 'now' });
  const src = createEmailSource({ graph, store, route: async () => ({ receipt: 'ok' }) });
  const a = await src.pollOnce();
  const b = await src.pollOnce();
  assert.equal(a.captured, 1);
  assert.equal(b.captured, 0);   // second pass dedupes
  assert.equal(b.skipped, 1);
  assert.equal(store.captures.size, 1);
});

test('routing failure loses NOTHING — mail stays captured and is recoverable', async () => {
  const graph = fakeGraph({
    DELTA0: { messages: [msgMeta('n1', '<fail@x>')], nextLink: null, deltaLink: 'DELTA1' },
  }, { n1: msgFull('n1', '<fail@x>', 'remind me to chase this Tuesday', 'chase it') });
  const store = fakeStore();
  store.cursors.set(graph.mailbox, { mailbox: graph.mailbox, delta_link: 'DELTA0', baseline_at: 'now' });
  let failNext = true;
  const src = createEmailSource({ graph, store, route: async () => { if (failNext) throw new Error('Cairn down'); return { receipt: 'ok' }; } });
  const r = await src.pollOnce();
  assert.equal(r.captured, 1);
  assert.equal(r.routed, 0);                                  // route failed
  assert.equal(store.captures.get('email:<fail@x>').routed, false); // but the mail is durably captured
  assert.ok(store.errors.get('email:<fail@x>'));              // error recorded
  failNext = false;
  const rec = await src.routeUnrouted();                       // reconcile sweep recovers it
  assert.equal(rec.routed, 1);
  assert.equal(store.captures.get('email:<fail@x>').routed, true);
});
