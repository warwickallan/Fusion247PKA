// =====================================================================
// IDEA-012 / BUILD-015 AsdAIr - skill: lastOrder.test.js
//
// Runs under: node --test
//
// Covers the two halves of the "load the previous order" gap:
//   1. data.js  loadLastOrder(household) - the SELECT-only adapter that finds
//      the most recent COMPLETED order and its purchased lines, resolved
//      against asdair.regulars.
//   2. planner.js chooseRotatedVariant(...) + planBasket({ lastOrder, rotation })
//      - "a different variant each week", decided deterministically or refused.
//
// FULLY OFFLINE. NO DATABASE IS EVER CONTACTED.
//   * `pg` is replaced in the module cache with a FAKE pool BEFORE data.js is
//     required, so no socket is ever opened. data.js itself is untouched by the
//     test: there is no production test-seam to inject a (writable) pool
//     through, which is deliberate -- the read-only guarantee must not have a
//     back door cut into it for testing convenience.
//   * ASDAIR_DB_URL is set to an obvious placeholder. No credentials file is
//     read, and nothing connects to it.
//
// The fake client LOGS every statement it is handed, so one test can assert the
// hard contract of this file directly: the read path issues NO WRITE, and every
// SELECT runs inside the BEGIN TRANSACTION READ ONLY wrapper.
//
// PURE ASCII only. Fixtures are synthetic ("Widget A", household 1). The single
// acceptance test that proves the named rotation case uses public product names
// (Sure variants) because that IS the case being closed; it carries no
// household state -- no real list, no real ids, no real aliases.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------
// Fake `pg`, installed before data.js is loaded.
// ---------------------------------------------------------------------
let QUERY_LOG = [];
let ROWS = { households: [], orders: [], lines: [], regulars: [] };

function respond(text) {
  if (text.indexOf('asdair.households') !== -1) return ROWS.households;
  if (text.indexOf('asdair.orders') !== -1) return ROWS.orders;
  if (text.indexOf('asdair.shopping_list_items') !== -1) return ROWS.lines;
  if (text.indexOf('asdair.regulars') !== -1) return ROWS.regulars;
  return [];
}

function FakePool() {
  this.connect = async function () {
    return {
      query: async function (text, params) {
        QUERY_LOG.push({ text: String(text), params: params });
        return { rows: respond(String(text)) };
      },
      release: function () { /* no-op */ }
    };
  };
  this.end = async function () { /* no-op */ };
}

const pgPath = require.resolve('pg');
require.cache[pgPath] = {
  id: pgPath,
  filename: pgPath,
  loaded: true,
  children: [],
  paths: [],
  exports: { Pool: FakePool }
};

// Placeholder DSN. Never connected to (the pool above is a fake), never a real
// credential, never read from a file.
process.env.ASDAIR_DB_URL = 'postgres://placeholder:placeholder@127.0.0.1:5432/asdair_offline_fake';

const data = require('./data');
const planner = require('./planner');
const { planBasket, chooseRotatedVariant } = planner;

function resetDb(rows) {
  QUERY_LOG = [];
  ROWS = {
    households: rows.households || [],
    orders: rows.orders || [],
    lines: rows.lines || [],
    regulars: rows.regulars || []
  };
}

// ---------------------------------------------------------------------
// Synthetic fixtures for the adapter.
// ---------------------------------------------------------------------
const HH = 1;

const HOUSEHOLD_ROWS = [{ id: HH }];

const ORDER_ROW = {
  id: 77,
  list_id: 55,
  household_id: HH,
  run_at: '2026-07-13T09:00:00.000Z',
  total_requested: 3,
  total_added: 2,
  total_needs_decision: 1,
  basket_total: '42.10',
  outside_budget_range: false,
  checked_out: false,
  attempt: 1,
  created_at: '2026-07-13T08:00:00.000Z',
  list_date: '2026-07-13'
};

const LINE_ROWS = [
  {
    id: 501, item_name: 'widget a', matched_product_id: 9, requested_qty: 2,
    added_qty: 2, status: 'added', price: '3.00', note: null,
    matched_product: 'Widget A 500g'
  },
  {
    id: 502, item_name: 'generic milk 2l', matched_product_id: null, requested_qty: 1,
    added_qty: 1, status: 'added', price: null, note: 'swapped size',
    matched_product: null
  }
];

const REGULAR_ROWS = [
  { id: 11, household_id: HH, name: 'Widget A 500g', brand: 'Bramble', aka: ['widget a'], active: true },
  { id: 12, household_id: HH, name: 'Generic Milk 2L', brand: null, aka: [], active: true }
];

// ---------------------------------------------------------------------
// 1. loadLastOrder: shape
// ---------------------------------------------------------------------
test('loadLastOrder returns the order, its purchased lines, and the regular each line resolves to', async function () {
  resetDb({ households: HOUSEHOLD_ROWS, orders: [ORDER_ROW], lines: LINE_ROWS, regulars: REGULAR_ROWS });

  const last = await data.loadLastOrder('household-a');

  assert.equal(last.household_id, HH);
  assert.deepEqual(Object.keys(last).sort(), ['household_id', 'lines', 'order']);

  assert.equal(last.order.id, 77);
  assert.equal(last.order.list_id, 55);
  assert.equal(last.order.list_date, '2026-07-13');
  assert.equal(last.order.run_at, '2026-07-13T09:00:00.000Z');
  assert.equal(last.order.total_requested, 3);
  assert.equal(last.order.total_added, 2);
  assert.equal(last.order.total_needs_decision, 1);
  assert.equal(last.order.basket_total, '42.10');
  assert.equal(last.order.checked_out, false, 'rule 8: the agent never places the order');

  assert.equal(last.lines.length, 2);

  const widget = last.lines[0];
  assert.equal(widget.item_name, 'widget a');
  assert.equal(widget.matched_product, 'Widget A 500g');
  assert.equal(widget.added_qty, 2, 'quantity ACTUALLY added, not requested');
  assert.equal(widget.requested_qty, 2);
  assert.equal(widget.regular_id, 11, 'resolved to a regular by its matched product name');
  assert.equal(widget.regular_name, 'Widget A 500g');
  assert.equal(widget.regular_brand, 'Bramble');
  assert.equal(widget.regular_ambiguous, false);

  const milk = last.lines[1];
  assert.equal(milk.matched_product, null, 'no product row was matched for this line');
  assert.equal(milk.regular_id, 12, 'falls back to the household shorthand when no product name was recorded');
  assert.equal(milk.added_qty, 1);
});

test('loadLastOrder never picks between two regulars that answer the same name', async function () {
  resetDb({
    households: HOUSEHOLD_ROWS,
    orders: [ORDER_ROW],
    lines: [LINE_ROWS[1]],
    regulars: [
      { id: 21, household_id: HH, name: 'Generic Milk 2L', brand: 'Alpha', aka: [], active: true },
      { id: 22, household_id: HH, name: 'Own Brand Milk', brand: null, aka: ['generic milk 2l'], active: true }
    ]
  });

  const last = await data.loadLastOrder(HH);
  assert.equal(last.lines[0].regular_ambiguous, true);
  assert.equal(last.lines[0].regular_id, null, 'rule 6 discipline: the adapter never chooses');
  assert.equal(last.lines[0].regular_name, null);
});

test('loadLastOrder tolerates a completed order with no purchased lines', async function () {
  resetDb({ households: HOUSEHOLD_ROWS, orders: [ORDER_ROW], lines: [], regulars: REGULAR_ROWS });
  const last = await data.loadLastOrder(HH);
  assert.equal(last.order.id, 77);
  assert.deepEqual(last.lines, []);
});

// ---------------------------------------------------------------------
// 2. loadLastOrder: the no-previous-order case
// ---------------------------------------------------------------------
test('loadLastOrder returns null (never throws) when the household has no completed order', async function () {
  resetDb({ households: HOUSEHOLD_ROWS, orders: [], lines: LINE_ROWS, regulars: REGULAR_ROWS });

  const last = await data.loadLastOrder('household-a');
  assert.equal(last, null, 'a first-ever shop must not crash');

  // And the planner is happy with that null: the plan is identical to one made
  // with no lastOrder key at all.
  const base = { listItems: [{ item_name: 'Widget A', requested_qty: 1 }], products: [], rules: [], regulars: [], household: HH };
  const withNull = JSON.stringify(planBasket(Object.assign({}, base, { lastOrder: last })));
  const without = JSON.stringify(planBasket(base));
  assert.equal(withNull, without);
});

test('loadLastOrder throws on an unresolvable household, like every other loader here', async function () {
  resetDb({ households: [], orders: [], lines: [], regulars: [] });
  await assert.rejects(function () { return data.loadLastOrder('no-such-household'); }, /Unknown household/);
});

// ---------------------------------------------------------------------
// 3. THE HARD CONTRACT: the read path issues no write
// ---------------------------------------------------------------------
const WRITE_KEYWORDS = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|merge|copy|set\s+transaction\s+read\s+write)\b/i;

test('loadLastOrder issues SELECTs only, every one inside a READ ONLY transaction', async function () {
  resetDb({ households: HOUSEHOLD_ROWS, orders: [ORDER_ROW], lines: LINE_ROWS, regulars: REGULAR_ROWS });
  await data.loadLastOrder('household-a');

  assert.ok(QUERY_LOG.length > 0, 'the fake client saw the statements');

  let selects = 0;
  let begins = 0;
  let commits = 0;
  let inReadOnlyTx = false;

  QUERY_LOG.forEach(function (q) {
    const text = q.text.trim();
    assert.equal(WRITE_KEYWORDS.test(text), false, 'no write statement was issued: ' + text);

    if (text === 'BEGIN TRANSACTION READ ONLY') {
      begins += 1;
      inReadOnlyTx = true;
      return;
    }
    if (text === 'COMMIT' || text === 'ROLLBACK') {
      commits += text === 'COMMIT' ? 1 : 0;
      inReadOnlyTx = false;
      return;
    }
    assert.ok(/^SELECT /i.test(text), 'only SELECT reaches the database: ' + text);
    assert.ok(inReadOnlyTx, 'the SELECT ran inside BEGIN TRANSACTION READ ONLY: ' + text);
    selects += 1;
  });

  assert.ok(selects >= 4, 'household + order + lines + regulars were all read');
  assert.equal(begins, commits, 'every read-only transaction was closed');
});

test('the loadLastOrder source contains no write statement at all', function () {
  const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  const start = src.indexOf('async function loadLastOrder');
  assert.notEqual(start, -1, 'loadLastOrder must exist in data.js');
  const end = src.indexOf('\n}', start);
  assert.notEqual(end, -1, 'end of loadLastOrder not found');
  const body = src.slice(start, end);

  // Only the SQL string literals matter; the surrounding prose lives in
  // comments outside this slice.
  assert.equal(WRITE_KEYWORDS.test(body.replace(/created_at/g, '')), false,
    'loadLastOrder issues no INSERT / UPDATE / DELETE / DDL');
  assert.ok(body.indexOf("'SELECT '") !== -1, 'its queries are SELECTs');
});

// ---------------------------------------------------------------------
// 4. Static schema/code drift guards (no database), matching the treatment
//    schemaCompat.test.js gives asdair.rules.
// ---------------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, '..', 'db', '001_asdair_schema.sql');
const NON_COLUMN_LEADERS = new Set(['check', 'unique', 'primary', 'foreign', 'constraint', 'references', 'create']);

function parseTableColumns(sql, tableName) {
  const marker = 'create table if not exists ' + tableName;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, 'create table for ' + tableName + ' not found');
  const open = sql.indexOf('(', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, 'matching close paren for ' + tableName + ' not found');

  const columns = [];
  sql.slice(open + 1, end).split('\n').forEach(function (rawLine) {
    const line = rawLine.trim();
    if (line === '' || line.indexOf('--') === 0) return;
    const token = (line.match(/^[a-z_][a-z0-9_]*/i) || [''])[0].toLowerCase();
    if (token === '' || NON_COLUMN_LEADERS.has(token)) return;
    if (columns.indexOf(token) === -1) columns.push(token);
  });
  return columns;
}

test('every column loadLastOrder SELECTs is defined by the committed migration', function () {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  const orderCols = parseTableColumns(sql, 'asdair.orders');
  data.ORDERS_SELECT_COLUMNS.forEach(function (c) {
    assert.ok(orderCols.indexOf(c) !== -1, 'asdair.orders is missing selected column: ' + c);
  });

  const lineCols = parseTableColumns(sql, 'asdair.shopping_list_items');
  data.ORDER_LINE_SELECT_COLUMNS.forEach(function (c) {
    assert.ok(lineCols.indexOf(c) !== -1, 'asdair.shopping_list_items is missing selected column: ' + c);
  });

  // The two joined columns.
  assert.ok(parseTableColumns(sql, 'asdair.shopping_lists').indexOf('list_date') !== -1);
  assert.ok(parseTableColumns(sql, 'asdair.products').indexOf('matched_product') !== -1);

  // Sanity: the parser really would notice a missing column.
  assert.equal(orderCols.indexOf('no_such_column'), -1);
});

test('data.js term normalisation cannot drift from planner.js', function () {
  const samples = ['Widget A', '  WIDGET   a ', '', null, undefined, 'Sure  Men Quantum Dry'];
  samples.forEach(function (s) {
    assert.equal(data._internal.normaliseTerm(s), planner._internal.normaliseTerm(s), 'normaliseTerm(' + String(s) + ')');
  });

  const regs = [
    { name: 'Widget A 500g', aka: ['widget a', ' WIDGET A '] },
    { name: '', aka: [] },
    { name: 'Milk', aka: null }
  ];
  regs.forEach(function (r) {
    assert.deepEqual(data._internal.regularAliasKeys(r), planner._internal.regularAliases(r));
  });
});

// ---------------------------------------------------------------------
// 5. Rotation - the named acceptance case.
//
// The household's rulebook says rotate the men's Sure variant weekly. Last week
// was Sure Quantum Dry x3 plus Sure Bright Bouquet x1 (the second is the
// women's variant and is NOT in the male candidate ring). Next week's plan must
// therefore be able to choose a DIFFERENT male variant.
// ---------------------------------------------------------------------
const SURE_MALE_REGULARS = [
  { id: 41, household_id: HH, name: 'Men Quantum Dry Anti-Perspirant 250ml', brand: 'Sure', aka: ['male deodorant'], active: true, substitutes_allowed: false },
  { id: 42, household_id: HH, name: 'Men Sport Cool Anti-Perspirant 250ml', brand: 'Sure', aka: ['male deodorant'], active: true, substitutes_allowed: false },
  { id: 43, household_id: HH, name: 'Men Invisible Pure Anti-Perspirant 250ml', brand: 'Sure', aka: ['male deodorant'], active: true, substitutes_allowed: false }
];

const QUANTUM = 'Sure Men Quantum Dry Anti-Perspirant 250ml';
const SPORT = 'Sure Men Sport Cool Anti-Perspirant 250ml';
const INVISIBLE = 'Sure Men Invisible Pure Anti-Perspirant 250ml';

const LAST_ORDER_SURE = {
  household_id: HH,
  order: { id: 77, list_id: 55, list_date: '2026-07-13', run_at: '2026-07-13T09:00:00.000Z', total_added: 4, checked_out: false },
  lines: [
    { list_item_id: 601, item_name: 'male deodorant', matched_product: QUANTUM, added_qty: 3, requested_qty: 3, status: 'added', regular_id: 41, regular_ambiguous: false },
    { list_item_id: 602, item_name: 'womens deodorant', matched_product: 'Sure Women Bright Bouquet Anti-Perspirant 250ml', added_qty: 1, requested_qty: 1, status: 'added', regular_id: 45, regular_ambiguous: false }
  ]
};

test('rotation: last week was Quantum Dry x3, so this week picks a DIFFERENT male variant', function () {
  const outcome = chooseRotatedVariant({
    candidates: SURE_MALE_REGULARS,
    lastOrder: LAST_ORDER_SURE,
    itemName: 'male deodorant'
  });

  assert.equal(outcome.status, 'rotated');
  assert.notEqual(outcome.chosen.name, QUANTUM, 'never repeats last week s variant');
  assert.equal(outcome.chosen.name, SPORT, 'the next variant round the stable ring');
  assert.equal(outcome.chosen.regular_id, 42);
  assert.deepEqual(outcome.previous.map(function (p) { return p.name + ' x' + p.qty; }), [QUANTUM + ' x3']);
  assert.ok(outcome.note.indexOf('x3') !== -1, 'the note says what the last order held');
  assert.equal(outcome.question, null);
});

test('rotation is deterministic: candidate order and repeat calls cannot change the answer', function () {
  const shuffled = [SURE_MALE_REGULARS[2], SURE_MALE_REGULARS[0], SURE_MALE_REGULARS[1]];
  const a = chooseRotatedVariant({ candidates: SURE_MALE_REGULARS, lastOrder: LAST_ORDER_SURE, itemName: 'male deodorant' });
  const b = chooseRotatedVariant({ candidates: shuffled, lastOrder: LAST_ORDER_SURE, itemName: 'male deodorant' });
  const c = chooseRotatedVariant({ candidates: SURE_MALE_REGULARS, lastOrder: LAST_ORDER_SURE, itemName: 'male deodorant' });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(a), JSON.stringify(c));
});

test('rotation with no previous order still picks deterministically from the approved ring', function () {
  const outcome = chooseRotatedVariant({ candidates: SURE_MALE_REGULARS, lastOrder: null, itemName: 'male deodorant' });
  assert.equal(outcome.status, 'rotated');
  assert.equal(outcome.chosen.name, INVISIBLE, 'first in stable ring order');
  assert.deepEqual(outcome.previous, []);
  assert.ok(outcome.flags.indexOf('no previous purchase to rotate from') !== -1);
});

// ---------------------------------------------------------------------
// 6. Rotation refuses to guess.
// ---------------------------------------------------------------------
test('rotation: the ring is exhausted -> needs_decision, never a silent repeat', function () {
  const bothBought = {
    household_id: HH,
    order: { id: 78 },
    lines: [
      { item_name: 'male deodorant', matched_product: QUANTUM, added_qty: 3, regular_id: 41 },
      { item_name: 'male deodorant', matched_product: SPORT, added_qty: 1, regular_id: 42 }
    ]
  };
  const outcome = chooseRotatedVariant({
    candidates: [SURE_MALE_REGULARS[0], SURE_MALE_REGULARS[1]],
    lastOrder: bothBought,
    itemName: 'male deodorant'
  });

  assert.equal(outcome.status, 'needs_decision');
  assert.equal(outcome.reason, 'rotation_exhausted');
  assert.equal(outcome.chosen, null);
  assert.ok(outcome.question.indexOf(QUANTUM) !== -1 && outcome.question.indexOf(SPORT) !== -1);
  assert.ok(outcome.flags.indexOf('rotation exhausted') !== -1);
});

test('rotation: no candidates -> needs_decision asking which variants should alternate', function () {
  const outcome = chooseRotatedVariant({ candidates: [], lastOrder: LAST_ORDER_SURE, itemName: 'male deodorant' });
  assert.equal(outcome.status, 'needs_decision');
  assert.equal(outcome.reason, 'no_candidates');
  assert.ok(outcome.flags.indexOf('no rotation candidates') !== -1);
  assert.ok(outcome.question.indexOf('male deodorant') !== -1);
});

test('rotation: a map rule that FIXES the variant conflicts with an instruction to vary it -> ask the human', function () {
  const outcome = chooseRotatedVariant({
    candidates: SURE_MALE_REGULARS,
    lastOrder: LAST_ORDER_SURE,
    itemName: 'male deodorant',
    fixedProduct: QUANTUM
  });
  assert.equal(outcome.status, 'needs_decision');
  assert.equal(outcome.reason, 'fixed_variant_conflict');
  assert.equal(outcome.chosen, null, 'the planner does not resolve a live rulebook conflict');
  assert.ok(outcome.question.indexOf(QUANTUM) !== -1);
  assert.ok(outcome.flags.indexOf('rotation conflict') !== -1);
});

// ---------------------------------------------------------------------
// 7. planBasket wiring - additive, and inert without the new inputs.
// ---------------------------------------------------------------------
const ROTATE_MALE_DEO = [{ match_term: 'male deodorant', household_id: HH, active: true }];
const BUDGET = { min_normal: 120, max_normal: 150, currency: 'GBP', household_id: HH };

function planSure(extra) {
  return planBasket(Object.assign({
    listItems: [{ item_name: 'male deodorant', requested_qty: 1 }],
    products: [],
    rules: [],
    regulars: SURE_MALE_REGULARS,
    budget: BUDGET,
    household: HH
  }, extra || {}));
}

test('planBasket without the new inputs is unchanged: three variants share a term -> ambiguous regulars match', function () {
  const line = planSure().items[0];
  assert.equal(line.status, 'needs_decision');
  assert.ok(line.flags.indexOf('ambiguous regulars match') !== -1);

  // Supplying only lastOrder (no rotation instruction) changes nothing at all.
  const withLastOrder = JSON.stringify(planSure({ lastOrder: LAST_ORDER_SURE }));
  assert.equal(withLastOrder, JSON.stringify(planSure()));
});

test('planBasket with a rotation instruction plans a DIFFERENT variant from last week', function () {
  const plan = planSure({ lastOrder: LAST_ORDER_SURE, rotation: ROTATE_MALE_DEO });
  const line = plan.items[0];

  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, SPORT);
  assert.notEqual(line.matched_product, QUANTUM);
  assert.equal(line.planned_qty, 1);
  assert.ok(line.flags.indexOf('rotated from last order') !== -1);
  assert.ok(line.flags.indexOf('ambiguous regulars match') === -1, 'rotation is how the household resolves that ambiguity');
  assert.ok(line.note.indexOf(QUANTUM) !== -1, 'the plan says what it rotated away from');
  assert.equal(plan.summary.planned_add, 1);
  assert.equal(plan.summary.needs_decision, 0);

  // The output surface is unchanged: no new keys, no action verbs.
  assert.deepEqual(Object.keys(plan).sort(), ['items', 'summary']);
  assert.deepEqual(
    Object.keys(line).sort(),
    ['alternatives', 'flags', 'item_name', 'matched_product', 'note', 'planned_qty', 'requested_qty', 'status']
  );
  const blob = JSON.stringify(plan).toLowerCase();
  assert.equal(/checkout/.test(blob), false);
  assert.equal(/\bpay\b/.test(blob), false);
});

// SUPERSEDED AND REPLACED, 2026-08-04 (WO-Y), on Warwick's live reading of the
// rulebook - NOT on the implementation's own say-so.
//
// This test used to assert that ONE `map` rule plus a rotation instruction was
// a conflict and produced a needs_decision. That encoded db/007's note about
// rules 23/24 clashing with the rotate instruction. The live rows show the
// premise was wrong: rule 32 OPENS by agreeing with rule 23 ("Sure male
// (men's blue)") and then refines it. Under the old assertion Sure became a
// question every single week, which is the failure WO-Y exists to end.
//
// The assertion is REPLACED, not deleted, and the conflict detector keeps an
// executing proof in the test immediately below - a genuine clash still asks.
test('planBasket: a map rule + a rotation instruction REFINES, it does not conflict', function () {
  const plan = planSure({
    lastOrder: LAST_ORDER_SURE,
    rotation: ROTATE_MALE_DEO,
    rules: [{
      id: 23, directive: 'map', scope: 'product', active: true,
      match_term: 'male deodorant', matched_product: QUANTUM, household_id: HH
    }]
  });
  const line = plan.items[0];

  assert.equal(line.status, 'add', 'the map picks the family, the rotation picks this week - no question');
  assert.equal(line.planned_qty, 1);
  assert.equal(line.flags.indexOf('rotation conflict'), -1, 'this is not a conflict');
  assert.notEqual(line.matched_product, QUANTUM, 'it must still rotate AWAY from what the last order held');
  assert.ok(line.flags.indexOf('rotation refines mapped family') !== -1);
  assert.ok(line.note.indexOf(QUANTUM) !== -1, 'the family the map chose stays traceable on the line');
});

test('planBasket: TWO map rules naming DIFFERENT products IS a genuine clash -> needs_decision', function () {
  // The detector must still fire. This is mechanically decidable - two `map`
  // directives claiming the same line for different products - unlike a prose
  // contradiction, which this planner deliberately does not try to detect.
  const plan = planSure({
    lastOrder: LAST_ORDER_SURE,
    rotation: ROTATE_MALE_DEO,
    rules: [
      { id: 23, directive: 'map', scope: 'product', active: true,
        match_term: 'male deodorant', matched_product: QUANTUM, household_id: HH },
      { id: 24, directive: 'map', scope: 'product', active: true,
        match_term: 'male deodorant', matched_product: 'Sure Men Invisible Ice Anti-Perspirant',
        household_id: HH }
    ]
  });
  const line = plan.items[0];

  assert.equal(line.status, 'needs_decision');
  assert.equal(line.planned_qty, 0);
  assert.ok(line.flags.indexOf('rotation conflict') !== -1);
  assert.ok(line.flags.indexOf('never auto-substitute') !== -1);
  assert.ok(line.note.indexOf('rotation conflict') !== -1, 'the clash is put to the human as a question');
});

test('planBasket: rotation asked for on a line with no known variants -> needs_decision', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'mystery item', requested_qty: 1 }],
    products: [], rules: [], regulars: SURE_MALE_REGULARS, budget: BUDGET, household: HH,
    lastOrder: LAST_ORDER_SURE,
    rotation: [{ match_term: 'mystery item', household_id: HH, active: true }]
  });
  const line = plan.items[0];
  assert.equal(line.status, 'needs_decision');
  assert.ok(line.flags.indexOf('no rotation candidates') !== -1);
  assert.equal(line.planned_qty, 0);
});

test('planBasket: a rotation instruction never blanket-matches, and never touches another household', function () {
  const untargeted = planSure({ lastOrder: LAST_ORDER_SURE, rotation: [{ active: true }] });
  assert.ok(untargeted.items[0].flags.indexOf('rotated from last order') === -1, 'target-less instruction is ignored');

  const otherHousehold = planSure({
    lastOrder: LAST_ORDER_SURE,
    rotation: [{ match_term: 'male deodorant', household_id: 2, active: true }]
  });
  assert.ok(otherHousehold.items[0].flags.indexOf('rotated from last order') === -1, 'another household s instruction never applies');

  const inactive = planSure({
    lastOrder: LAST_ORDER_SURE,
    rotation: [{ match_term: 'male deodorant', household_id: HH, active: false }]
  });
  assert.ok(inactive.items[0].flags.indexOf('rotated from last order') === -1, 'an inactive instruction never applies');
});

test('planBasket: an excluded line is never rotated', function () {
  const plan = planSure({
    lastOrder: LAST_ORDER_SURE,
    rotation: ROTATE_MALE_DEO,
    rules: [{
      id: 24, directive: 'exclude', scope: 'product', active: true,
      match_term: 'male deodorant', household_id: HH, reason: 'household stopped buying this'
    }]
  });
  const line = plan.items[0];
  assert.equal(line.status, 'excluded');
  assert.equal(line.planned_qty, 0);
  assert.ok(line.flags.indexOf('rotated from last order') === -1);
});

test('planBasket: rotation with an explicit candidate list on the instruction', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'male deodorant', requested_qty: 2 }],
    products: [], rules: [], regulars: [], budget: BUDGET, household: HH,
    lastOrder: LAST_ORDER_SURE,
    rotation: [{ match_term: 'male deodorant', household_id: HH, active: true, candidates: [QUANTUM, SPORT, INVISIBLE] }]
  });
  const line = plan.items[0];
  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, SPORT, 'plain-string candidates rotate the same way');
  assert.equal(line.planned_qty, 2, 'rotation changes WHICH variant, never how many');
});
