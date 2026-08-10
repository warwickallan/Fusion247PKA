// BUILD-015 - cockpit-api/readChecklist.test.js
//
// Offline. A scripted fake client; no socket, no DB.
//
// THE BAR THESE HOLD: the page Warwick shops from must carry the lines, the
// method and the prohibitions - and must never render an empty shopping list
// over a request that carries no artefact.
//
// The artefact under test is produced by the REAL producer (handoff/claim.js
// openHandoff over its own offline fake), not by a fixture written here, so
// these tests fail if the producer stops storing what the renderer needs.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const RC = require('./readChecklist');
const { buildHandoff } = require('../handoff/buildHandoff');
const { openHandoff } = require('../handoff/claim');
const { basePacket } = require('../handoff/test/fixtures');
const { makeFakeStore } = require('../handoff/test/fakeRequestStore');

// --- a scripted client -------------------------------------------------
function makeClient(rows) {
  const seen = [];
  return {
    seen: seen,
    query: async function (sql, params) {
      seen.push({ sql: sql, params: params });
      return { rows: rows };
    }
  };
}

/** The row the PIPELINE actually writes, produced by the real producer. */
async function realRequestRow() {
  const store = makeFakeStore({ requests: [], now: () => new Date() });
  const opened = await openHandoff(store.query, {
    shopId: 1, handoff: buildHandoff(basePacket()), openedBy: 'asdair:pipeline'
  });
  return opened.request;
}

// ---------------------------------------------------------------------

test('SELECT ONLY - every statement this module can issue begins with SELECT', () => {
  assert.ok(RC.ALL_SQL.length > 0, 'a module that issues no SQL cannot be read-only by accident');
  for (const sql of RC.ALL_SQL) {
    assert.match(sql.trim(), /^SELECT\b/, `not a SELECT: ${sql}`);
  }
});

test('a shop must be named', async () => {
  const res = await RC.readChecklist({});
  assert.equal(res.ok, false);
  assert.equal(res.error, 'no_shop');
});

test('AC7: the checklist carries the LINES, the METHOD and the PROHIBITIONS', async () => {
  const row = await realRequestRow();
  const client = makeClient([row]);
  const res = await RC.readChecklist({ shop: 1, client: client });

  assert.equal(res.ok, true);
  assert.equal(res.state, 'ready');
  assert.ok(typeof res.markdown === 'string' && res.markdown.length > 0);

  const handoff = row.progress.handoff;

  // EVERY LINE. Not a count of them - the actual products, by name, because a
  // checklist that silently drops a line is worse than no checklist.
  assert.ok(handoff.lines.length > 0, 'the fixture must have lines or this proves nothing');
  for (const line of handoff.lines) {
    assert.ok(res.markdown.includes(line.canonical_product_name),
      `line "${line.canonical_product_name}" is missing from the checklist`);
  }

  // EVERY PROHIBITION. These are the five things that must never happen.
  assert.ok(handoff.prohibited_actions.length > 0);
  for (const p of handoff.prohibited_actions) {
    assert.ok(res.markdown.includes(p.text), `prohibition "${p.text}" is missing from the checklist`);
  }

  // EVERY METHOD STEP.
  assert.ok(handoff.method.length > 0);
  for (const step of handoff.method) {
    assert.ok(res.markdown.includes(step.text), `method step "${step.text}" is missing from the checklist`);
  }

  // The fingerprint the worker is asked to quote back.
  assert.ok(res.markdown.includes(handoff.packet_fingerprint));
  assert.equal(res.packet_fingerprint, handoff.packet_fingerprint);
  assert.equal(res.lines_count, handoff.lines.length);
});

test('AC7: the checklist is rendered by handoff/renderChecklist.js and by nothing else', async () => {
  const row = await realRequestRow();
  const res = await RC.readChecklist({ shop: 1, client: makeClient([row]) });
  const { renderChecklist } = require('../handoff/renderChecklist');
  assert.equal(res.markdown, renderChecklist(row.progress.handoff),
    'this module must DELEGATE to the one renderer. A byte that differs is a second renderer, '
    + 'and a second renderer is free to drift from the artefact.');
});

test('NOT HANDED OVER is a first-class state, not an empty shopping list', async () => {
  const res = await RC.readChecklist({ shop: 1, client: makeClient([]) });
  assert.equal(res.ok, true);
  assert.equal(res.state, 'not_handed_over');
  assert.equal(res.markdown, null, 'a shop with no handover must not render as a list with no items');
  assert.match(res.message, /has not been handed over/);
});

test('A RECEIPT-ONLY ROW is named as such, never rendered as a shop with nothing to buy', async () => {
  // The pre-2026-08-10 shape: the six summary fields and no artefact.
  const legacy = {
    id: 9, shop_id: 1, status: 'queued',
    progress: {
      handoff: {
        packet_fingerprint: 'abc123', shop_ref: 'SHOP-2026-08-09',
        handoff_version: 1, instructions_version: '1.0.0',
        expected: { distinct_products: 4, total_units: 7 }, opened_by: 'asdair:pipeline'
      }
    }
  };
  const res = await RC.readChecklist({ shop: 1, client: makeClient([legacy]) });
  assert.equal(res.ok, true);
  assert.equal(res.state, 'artefact_absent');
  assert.equal(res.markdown, null);
  // The fingerprint still travels, so the row can be identified.
  assert.equal(res.packet_fingerprint, 'abc123');
  assert.match(res.message, /no checklist artefact/);
});

test('the read is parameterised on the shop and names no file or table from the request', async () => {
  const client = makeClient([]);
  await RC.readChecklist({ shop: 42, client: client });
  assert.equal(client.seen.length, 1);
  assert.deepEqual(client.seen[0].params, [42]);
  // A shop_ref works too - it is the only identifier Warwick has ever seen.
  const byRef = makeClient([]);
  await RC.readChecklist({ shop: 'SHOP-2026-08-09', client: byRef });
  assert.deepEqual(byRef.seen[0].params, ['SHOP-2026-08-09']);
  assert.match(client.seen[0].sql, /browser_build_request/);
});
