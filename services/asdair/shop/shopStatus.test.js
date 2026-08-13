// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopStatus.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. NO DATABASE, NO NETWORK, NO CREDENTIALS - the
// projection is exercised against a scripted fake client.
//
// WHAT THESE TESTS ARE FOR: the projection's one hard rule is NEVER FABRICATE.
// Most of what follows is therefore about what it must NOT say - no zero
// standing in for unknown, no "shopping" inferred from a request that merely
// exists, and no derived figure presented as an ASDA-quoted one.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shopStatus = require('./shopStatus');
const { makeClient, countMatching } = require('./fakeClient');

const project = shopStatus._internal.project;

const HH = 1;
const SHOP_ID = 42;

function shopRow(overrides) {
  const base = {
    id: SHOP_ID, household_id: HH, shop_ref: 'SHOP-2026-07-27', status: 'RECEIVED',
    source_kind: 'text', list_id: null, needs_review: false, transcript_confidence: null,
    last_error: null, created_at: '2026-07-27T09:00:00.000Z', updated_at: '2026-07-27T09:05:00.000Z'
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

// A full script for one projection. Anything not overridden reads as "nothing
// there", which is the honest empty-shop case.
function script(over) {
  const o = over || {};
  const steps = [
    { match: 'FROM asdair.shop s WHERE id = $1', rows: o.shop === undefined ? [shopRow()] : o.shop },
    { match: 'FROM asdair.shop s WHERE shop_ref = $1', rows: o.byRef || [] },
    { match: 'FROM asdair.shopping_list_items', rows: o.items || [] },
    { match: 'FROM asdair.shop_question WHERE shop_id = $1 GROUP BY status', rows: o.questionCounts || [] },
    { match: "FROM asdair.shop_question WHERE shop_id = $1 AND status = 'open'", rows: o.openQuestions || [] },
    { match: 'FROM asdair.browser_build_request WHERE shop_id = $1', rows: o.browser || [] },
    { match: 'FROM asdair.order_confirmation WHERE shop_id = $1', rows: o.confirmation || [] },
    { match: 'FROM asdair.order_confirmation_line', rows: o.confirmationLines || [] },
    { match: 'FROM asdair.pending_action', rows: o.pending || [] },
    { match: "FROM asdair.shop_event WHERE shop_id = $1 AND event_type = 'failure' ORDER BY id DESC",
      rows: o.lastFailure || [] },
    { match: "count(*)::int AS n FROM asdair.shop_event", rows: o.failureCount || [{ n: 0 }] },
    { match: 'FROM asdair.regulars WHERE household_id = $1', rows: o.regulars || [{ total: 90, allowing: 12 }] },
    { match: 'FROM asdair.shop_event WHERE shop_id = $1 ORDER BY id DESC', rows: o.lastEvent || [] }
  ];
  return steps.map(function (s) { s.repeat = true; return s; });
}

test('a shop with no list yet reports NULL line counts - never zero', async function () {
  const client = makeClient(script());
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.lines, null, '"0 of 0 lines resolved" would read as an empty list, which is a lie');
  assert.equal(s.list_id, null);
  assert.equal(s.unknown_means_unknown, true);
});

test('once a list exists the counts are real, and open vs resolved are distinguished', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'NEEDS_DECISION', list_id: 7 })],
    items: [
      { status: 'added', n: 30 },
      { status: 'needs_decision', n: 3 },
      { status: 'not_added', n: 2 },
      { status: 'requested', n: 1 }
    ]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.lines.total, 36);
  assert.equal(s.lines.resolved, 32);           // added + not_added + excluded_this_week
  assert.equal(s.lines.open, 4);                // requested + needs_decision
  assert.equal(s.lines.needs_decision, 3);
});

test('the stage is asdair.shop.status and is NEVER inferred from a browser request', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'READY_TO_SHOP' })],
    browser: [{ id: 3, status: 'queued', claimed_by: null, progress: {}, requested_at: 't' }]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.stage, 'READY_TO_SHOP',
    'a queued request means somebody asked - it is not evidence that shopping is happening');
  assert.equal(s.browser.status, 'queued');
  assert.equal(s.browser.claimed_by, null);
});

test('the basket count and the total are NULL until something durable reports them', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'SHOPPING' })],
    browser: [{ id: 3, status: 'running', claimed_by: 'runner-a', progress: {}, requested_at: 't' }]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.basket_product_count, null);
  assert.equal(s.basket_product_count_source, null);
  assert.equal(s.total, null);
  assert.equal(s.regulars_added, null);
  assert.equal(s.searched_items_added, null);
});

test('what the runner reported is used, and labelled as coming from the runner', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'SHOPPING' })],
    browser: [{
      id: 3, status: 'running', claimed_by: 'runner-a', requested_at: 't',
      progress: { regulars_added: 28, searched_added: 6, basket_product_count: 34, estimated_total: 131.5 }
    }]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.regulars_added, 28);
  assert.equal(s.searched_items_added, 6);
  assert.equal(s.basket_product_count, 34);
  assert.equal(s.basket_product_count_source, 'browser_progress');
  assert.deepEqual(s.total, { amount: 131.5, currency: 'GBP', basis: 'derived', source: 'browser_progress' });
});

test('an ASDA-stated total is labelled "stated"; anything summed is labelled "derived"', async function () {
  const stated = makeClient(script({
    shop: [shopRow({ status: 'ORDER_CONFIRMATION_RECEIVED' })],
    confirmation: [{ id: 8, stated_total: '142.63', received_at: 't', reconciled_at: null }],
    confirmationLines: [{ lines: 41, stated_lines: 41, stated_sum: '142.63' }]
  }));
  const a = await project(stated, SHOP_ID, {});
  assert.equal(a.total.basis, 'stated');
  assert.equal(a.total.amount, 142.63);
  assert.equal(a.basket_product_count, 41);
  assert.equal(a.basket_product_count_source, 'order_confirmation');

  const derived = makeClient(script({
    shop: [shopRow({ status: 'ORDER_CONFIRMATION_RECEIVED' })],
    confirmation: [{ id: 8, stated_total: null, received_at: 't', reconciled_at: null }],
    confirmationLines: [{ lines: 41, stated_lines: 41, stated_sum: '142.63' }]
  }));
  const b = await project(derived, SHOP_ID, {});
  assert.equal(b.total.basis, 'derived',
    'a sum is inferred and may NEVER be presented as an ASDA-quoted value');
});

test('a partial set of stated line prices does not become a total at all', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'ORDER_CONFIRMATION_RECEIVED' })],
    confirmation: [{ id: 8, stated_total: null }],
    confirmationLines: [{ lines: 41, stated_lines: 30, stated_sum: '90.00' }]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.total, null, 'summing only the lines ASDA priced would understate the shop');
});

test('open questions are surfaced with their text, so status can say what is held', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'NEEDS_DECISION', list_id: 7 })],
    questionCounts: [{ status: 'open', n: 2 }, { status: 'answered', n: 5 }],
    openQuestions: [
      { id: 1, question_key: 'line-3-brand', question_text: 'Which milk?', candidates: ['a', 'b'] },
      { id: 2, question_key: 'line-9-size', question_text: 'Which size?', candidates: null }
    ]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.questions.open, 2);
  assert.equal(s.questions.answered, 5);
  assert.equal(s.questions.total, 7);
  assert.equal(s.questions.held.length, 2);
  assert.deepEqual(s.questions.held[1].candidates, [], 'a null jsonb must not leak out as null');
});

test('a parked shop reports what it can resume to; a resumed one does not', async function () {
  const parked = makeClient(script({
    shop: [shopRow({ status: 'FAILED', last_error: 'ASDA session expired' })],
    lastFailure: [{ from_status: 'SHOPPING', description: 'ASDA session expired', occurred_at: 't' }],
    failureCount: [{ n: 2 }]
  }));
  const a = await project(parked, SHOP_ID, {});
  assert.equal(a.failure.resumable, true);
  assert.equal(a.failure.resume_to, 'SHOPPING');
  assert.equal(a.failure.failure_count, 2);
  assert.equal(a.failure.last_error, 'ASDA session expired');

  const resumed = makeClient(script({
    shop: [shopRow({ status: 'SHOPPING' })],
    lastFailure: [{ from_status: 'SHOPPING', description: 'ASDA session expired', occurred_at: 't' }],
    failureCount: [{ n: 1 }]
  }));
  const b = await project(resumed, SHOP_ID, {});
  assert.equal(b.failure.resumable, false, 'a shop that already resumed is not waiting to be resumed');
  assert.equal(b.failure.resume_to, null);
});

test('a shop that never failed reports no failure at all', async function () {
  const client = makeClient(script());
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.failure, null);
});

test('outstanding actions are surfaced so nothing is forgotten', async function () {
  const client = makeClient(script({
    pending: [{ id: 2, action_type: 'add_favourite', action_key: 'synthetic-item-1', payload: {}, note: null, created_at: 't' }]
  }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.outstanding_actions.length, 1);
  assert.equal(s.outstanding_actions[0].action_type, 'add_favourite');
});

test('the substitutions setting states the doctrine, not a guess', async function () {
  const client = makeClient(script({ regulars: [{ total: 97, allowing: 12 }] }));
  const s = await project(client, SHOP_ID, {});
  assert.equal(s.substitutions.auto_substitute, false);
  assert.equal(s.substitutions.active_regulars, 97);
  assert.equal(s.substitutions.regulars_allowing_substitutes, 12);
});

test('every stage has a human label', function () {
  shopStatus.SHOP_STATUSES.forEach(function (s) {
    assert.equal(typeof shopStatus.STAGE_LABELS[s], 'string', s + ' has no label');
    assert.notEqual(shopStatus.STAGE_LABELS[s].trim(), '');
  });
});

// ---------------------------------------------------------------------
// Resolving the handle
// ---------------------------------------------------------------------

test('a shop_ref that exists for two households is refused, not guessed', async function () {
  const client = makeClient(script({
    byRef: [shopRow({ id: 1, household_id: 1 }), shopRow({ id: 2, household_id: 2 })]
  }));
  await assert.rejects(function () { return project(client, 'SHOP-2026-07-27', {}); },
    /more than one household/);
});

test('a shop_ref plus household_id resolves cleanly', async function () {
  const client = makeClient(script({
    byRef: [shopRow({ id: 1, household_id: 1 }), shopRow({ id: 2, household_id: 2 })]
  }));
  const s = await project(client, 'SHOP-2026-07-27', { household_id: 2 });
  assert.equal(s.shop_id, 2);
});

test('a malformed handle is refused by name', async function () {
  const client = makeClient(script());
  await assert.rejects(function () { return project(client, 'last week', {}); },
    /neither a shop id nor a shop_ref/);
  await assert.rejects(function () { return project(client, '', {}); }, /required/);
});

test('a FRESH shop (WP-B15-07) is lookupable by its collision ref', async function () {
  // A shop that started fresh because a terminal one owned its date carries a
  // `-M<message id>` suffix. If status refused that handle, the shop would exist
  // and nobody - not the Cockpit, not the CLI, not Warwick - could ask about it.
  const client = makeClient(script({
    byRef: [shopRow({ id: 77, household_id: 1, shop_ref: 'SHOP-2026-08-10-M63' })]
  }));
  const s = await project(client, 'SHOP-2026-08-10-M63', {});
  assert.equal(s.shop_id, 77);
});

test('a missing shop is an error, not an empty projection', async function () {
  const client = makeClient(script({ shop: [] }));
  await assert.rejects(function () { return project(client, SHOP_ID, {}); }, /no shop with id 42/);
});

// ---------------------------------------------------------------------
// Read-only by construction
// ---------------------------------------------------------------------

test('the projection issues SELECTs and nothing else', async function () {
  const client = makeClient(script({
    shop: [shopRow({ status: 'SHOPPING', list_id: 7 })],
    items: [{ status: 'added', n: 30 }]
  }));
  await project(client, SHOP_ID, {});
  client.log.forEach(function (entry) {
    assert.match(entry.sql.trim(), /^SELECT/i, 'the projection must only SELECT, saw: ' + entry.sql);
  });
  assert.equal(countMatching(client, /(INSERT|UPDATE|DELETE)/i), 0);
});

test('shopStatus reads through the READ role, inside a READ ONLY transaction', function () {
  const raw = fs.readFileSync(path.join(__dirname, 'shopStatus.js'), 'utf8');
  const code = raw.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
  assert.match(code, /process\.env\.ASDAIR_DB_URL/);
  assert.equal(/ASDAIR_WRITE_DB_URL/.test(code), false, 'the reader must never touch the write credential');
  assert.match(code, /BEGIN TRANSACTION READ ONLY/);
  [/\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/].forEach(function (re) {
    assert.equal(re.test(code), false, 'shopStatus must contain no write verb: ' + re);
  });
});
