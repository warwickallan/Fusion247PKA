// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: recordShopOutcome.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented ids, "Widget A"-style names). ZERO real
// household data. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE. The writer's transaction shape, its SQL, and its refusals are
// proven against a FAKE client that records the statements it is given. The
// real-Postgres proof (that the SQL is valid against the committed schema and
// that the CHECK constraints bite) lives in the DB-gated
// test/outcome.dbtest.js, which stays inert without an explicit opt-in.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { recordShopOutcome, _internal } = require('./recordShopOutcome');
const { buildOutcome, ORDER_COLUMNS } = require('./buildOutcome');

// ---------------------------------------------------------------------
// A fake pg client. It records every statement and returns a synthetic id
// for any RETURNING id insert. No connection of any kind is opened.
// ---------------------------------------------------------------------
function fakeClient(options) {
  const opts = options || {};
  const calls = [];
  return {
    calls: calls,
    query: async function (sql, params) {
      const text = String(sql);
      calls.push({ sql: text, params: params || [] });
      if (opts.failOn && opts.failOn.test(text)) {
        throw new Error('synthetic failure on: ' + text.slice(0, 40));
      }
      if (/RETURNING id/i.test(text)) return { rows: [{ id: opts.newId || 99 }] };
      return { rows: [] };
    }
  };
}

function sqlOf(client) {
  return client.calls.map(function (c) { return c.sql; });
}

const OUTCOME = buildOutcome({
  plan: { items: [], summary: { total_requested: 3, budget_flag: 'within' } },
  reconcile: {
    list_id: 7,
    household_id: 1,
    run_at: '2026-07-27T09:30:00.000Z',
    basket_total: 131.5,
    budget: { min_normal: 120, max_normal: 150 },
    items: [
      { item_name: 'Widget A', status: 'added' },
      { item_name: 'Generic Milk 2L', status: 'added' },
      { item_name: 'Gadget Z', status: 'needs_decision' }
    ],
    events: [
      { event_type: 'info', description: 'run started', occurred_at: '2026-07-27T09:30:00.000Z' },
      { event_type: 'decision', description: 'Gadget Z out of stock; waiting on a human' }
    ]
  }
});

// ---------------------------------------------------------------------

test('ONE transaction: BEGIN -> insert order -> insert each event -> COMMIT, returning the new id', async function () {
  const client = fakeClient({ newId: 4242 });
  const orderId = await recordShopOutcome(OUTCOME, { client: client });

  assert.equal(orderId, 4242);

  const statements = sqlOf(client);
  assert.equal(statements.length, 5, 'BEGIN + 1 order insert + 2 event inserts + COMMIT');
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /^INSERT INTO asdair\.orders \(/);
  assert.match(statements[2], /^INSERT INTO asdair\.order_events \(/);
  assert.match(statements[3], /^INSERT INTO asdair\.order_events \(/);
  assert.equal(statements[4], 'COMMIT');
  assert.equal(statements.filter(function (s) { return s === 'ROLLBACK'; }).length, 0);

  // Every event is written against the order the transaction just created.
  assert.equal(client.calls[2].params[0], 4242);
  assert.equal(client.calls[3].params[0], 4242);
});

test('rule 8: checked_out is a SQL LITERAL false, never a parameter that input could flip', async function () {
  const client = fakeClient();
  await recordShopOutcome(OUTCOME, { client: client });

  const orderCall = client.calls[1];
  // The literals are in the SQL text itself...
  assert.match(orderCall.sql, /checked_out, checked_out_at/);
  assert.match(orderCall.sql, /false, null/);
  // ...so no bound parameter carries a checkout value at all.
  assert.equal(orderCall.params.length, ORDER_COLUMNS.length - 2,
    'two columns are literals, so there are two fewer parameters than columns');
  assert.equal(orderCall.params.indexOf(true), -1, 'no parameter is boolean true');

  // And the column order in the INSERT is exactly the contracted list.
  const cols = orderCall.sql.match(/\(([^)]*)\) VALUES/)[1].split(',').map(function (s) { return s.trim(); });
  assert.deepEqual(cols, ORDER_COLUMNS);
});

test('rule 8: a hand-built order claiming a checkout is REFUSED before any query runs', async function () {
  const client = fakeClient();
  await assert.rejects(
    recordShopOutcome({ order: { list_id: 7, household_id: 1, checked_out: true }, events: [] }, { client: client }),
    /never checks out/
  );
  await assert.rejects(
    recordShopOutcome(
      { order: { list_id: 7, household_id: 1, checked_out: false, checked_out_at: '2026-07-27T10:00:00.000Z' }, events: [] },
      { client: client }
    ),
    /never checks out/
  );
  assert.equal(client.calls.length, 0, 'nothing may reach the database');
});

test('an event_type outside the CHECK vocabulary is rejected BEFORE the database is touched', async function () {
  const client = fakeClient();
  await assert.rejects(
    recordShopOutcome({
      order: { list_id: 7, household_id: 1, checked_out: false, checked_out_at: null },
      events: [{ event_type: 'checkout', description: 'nope' }]
    }, { client: client }),
    /is not one of/
  );
  assert.equal(client.calls.length, 0, 'no BEGIN, no INSERT -- the bad value never reaches Postgres');
});

test('required NOT NULL ids are rejected before any query', async function () {
  const client = fakeClient();
  await assert.rejects(
    recordShopOutcome({ order: { household_id: 1, checked_out: false }, events: [] }, { client: client }),
    /order\.list_id is required/
  );
  await assert.rejects(
    recordShopOutcome({ order: { list_id: 7, checked_out: false }, events: [] }, { client: client }),
    /order\.household_id is required/
  );
  assert.equal(client.calls.length, 0);
});

test('a failure part-way through ROLLBACKs and never COMMITs (no half-recorded run)', async function () {
  const client = fakeClient({ failOn: /order_events/ });
  await assert.rejects(recordShopOutcome(OUTCOME, { client: client }), /synthetic failure/);

  const statements = sqlOf(client);
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.indexOf('COMMIT'), -1, 'a failed run must never COMMIT');
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
});

test('a null occurred_at defers to the database default rather than writing NULL', function () {
  // occurred_at is NOT NULL with a now() default. buildOutcome has no clock,
  // so it emits null and the writer COALESCEs to now() in SQL.
  assert.match(_internal.EVENT_INSERT_SQL, /COALESCE\(\$4::timestamptz, now\(\)\)/);
});

test('no connection string is ever hardcoded; ASDAIR_DB_URL is the only env var read', function () {
  const src = fs.readFileSync(path.join(__dirname, 'recordShopOutcome.js'), 'utf8');
  assert.equal(/postgres(ql)?:\/\//.test(src), false, 'no connection string literal in the writer');
  const envReads = src.match(/process\.env\.[A-Z_]+/g) || [];
  assert.deepEqual(Array.from(new Set(envReads)), ['process.env.ASDAIR_DB_URL']);
});

test('with no ASDAIR_DB_URL configured the writer refuses clearly instead of guessing', {
  skip: process.env.ASDAIR_DB_URL ? 'ASDAIR_DB_URL is set in this environment' : false
}, async function () {
  await assert.rejects(recordShopOutcome(OUTCOME), /ASDAIR_DB_URL is not set/);
});
