// =====================================================================
// IDEA-012 AsdAIr - skill: rankAlternatives.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. Every item, product, name, and price below is
// invented ("Orange Juice 1L", "Store Apple Juice 1L", household ids 1/2).
// There is ZERO real household data here - nothing from the seed, no real
// names, no real Asda products. This file runs in CI on the PUBLIC repo.
//
// Covers the alternative/substitution SUGGESTION ranker (rule 6):
//   * an out-of-stock line gets a ranked, same-category alternatives list
//   * matched_product is NEVER written from an alternative (suggestion-only)
//   * a needs_decision line with no own match keeps matched_product null
//   * output ordering is deterministic (score desc, tie-break by id asc)
//   * no alternative EVER crosses household scope
//   * add lines carry an empty alternatives array (additive, consistent shape)
//
// SHAPE ASSUMPTION: the base asdair.products schema has no `price` column, so
// the ranker treats price proximity as NEUTRAL when a product carries no price.
// These fixtures add an optional synthetic `price` on some products purely to
// exercise the proximity component; a caller/adapter may join one in future.
//
// PURE ASCII only. Currency is written as "GBP".
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planBasket, rankAlternatives, _internal } = require('./planner');

// Convenience: find an output line by item_name.
function byName(plan, name) {
  return plan.items.find(function (it) { return it.item_name === name; });
}

const HH = 1;        // active household under test
const OTHER = 2;     // a different household

const budget = { min_normal: 120, max_normal: 150, currency: 'GBP', household_id: HH };

const products = [
  { id: 20, list_term: 'Orange Juice 1L', matched_product: 'Store Orange Juice 1L',   category: 'juice',       household_id: HH,    price: 1.20 },
  { id: 21, list_term: 'Orange Juice 1L', matched_product: 'Premium Orange Juice 1L', category: 'juice',       household_id: HH,    price: 2.50 },
  { id: 22, list_term: 'Apple Juice 1L',  matched_product: 'Store Apple Juice 1L',    category: 'juice',       household_id: null,  price: 1.10 },
  { id: 23, list_term: 'Grape Juice 1L',  matched_product: 'Foreign Grape Juice 1L',  category: 'juice',       household_id: OTHER, price: 1.15 },
  { id: 24, list_term: 'Cola 2L',         matched_product: 'Store Cola 2L',           category: 'soft drinks', household_id: HH,    price: 1.00 }
];

// ---------------------------------------------------------------------
// End-to-end wiring: an OOS line gains a ranked, same-category alternatives
// list, and (because it never had its own match) matched_product stays null.
// ---------------------------------------------------------------------

test('OOS line: needs_decision gets a ranked same-category alternatives list; matched_product stays null', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Mystery Juice', category: 'juice', requested_qty: 1, out_of_stock: true, price: 1.30 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const j = byName(plan, 'Mystery Juice');
  assert.equal(j.status, 'needs_decision');
  assert.equal(j.planned_qty, 0, 'nothing added pending a human decision');
  assert.equal(j.matched_product, null, 'no own match -> matched_product stays null; ranker never writes it');

  // Same-category (juice), in-scope candidates only: two HH + one global.
  // The OTHER-household grape juice and the soft-drinks cola are excluded.
  const names = j.alternatives.map(function (a) { return a.name; });
  assert.deepEqual(
    names,
    ['Store Orange Juice 1L', 'Store Apple Juice 1L', 'Premium Orange Juice 1L'],
    'best-first: closest price wins, then next, then far-price HH option'
  );
  assert.ok(!names.includes('Foreign Grape Juice 1L'), 'a foreign-household product is never surfaced');
  assert.ok(!names.includes('Store Cola 2L'), 'a different-category product is never surfaced');
});

test('each alternative has exactly { name, price, reason, score }, scores are descending', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Mystery Juice', category: 'juice', requested_qty: 1, out_of_stock: true, price: 1.30 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const alts = byName(plan, 'Mystery Juice').alternatives;
  assert.equal(alts.length, 3);
  let prev = Infinity;
  alts.forEach(function (a) {
    assert.deepEqual(Object.keys(a).sort(), ['name', 'price', 'reason', 'score']);
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.reason, 'string');
    assert.ok(a.reason.includes('same category'), 'reason states the same-category basis');
    assert.equal(typeof a.score, 'number');
    assert.ok(a.score <= prev, 'scores are sorted best-first (non-increasing)');
    prev = a.score;
  });
});

// ---------------------------------------------------------------------
// Suggestion-only: an OOS line that DOES have its own match keeps that
// original matched_product; the ranker never overwrites it with an
// alternative, and never suggests the item's own (out-of-stock) product.
// ---------------------------------------------------------------------

test('suggestion-only: matched_product stays the ORIGINAL match, never an alternative', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Orange Juice 1L', requested_qty: 2, out_of_stock: true, matched_product_id: 20, price: 1.30 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const j = byName(plan, 'Orange Juice 1L');
  assert.equal(j.status, 'needs_decision');
  assert.equal(j.planned_qty, 0);
  assert.equal(j.matched_product, 'Store Orange Juice 1L', 'original match is preserved, not replaced');

  const names = j.alternatives.map(function (a) { return a.name; });
  assert.ok(!names.includes('Store Orange Juice 1L'), 'the item OWN out-of-stock product is not re-suggested');
  assert.ok(names.length > 0, 'other in-scope same-category options are still surfaced');
  names.forEach(function (n) {
    assert.notEqual(n, j.matched_product, 'no alternative was written into matched_product');
  });
});

test('ambiguous line: the OTHER matching option is surfaced as an alternative, match not overwritten', function () {
  // 'Orange Juice 1L' has TWO household products (ids 20 + 21) -> ambiguous ->
  // needs_decision. The resolved pick stays in matched_product; the alternate
  // option is surfaced for the human.
  const plan = planBasket({
    listItems: [{ item_name: 'Orange Juice 1L', requested_qty: 1 }],
    products: products, rules: [], budget: budget, household: HH
  });
  const j = byName(plan, 'Orange Juice 1L');
  assert.equal(j.status, 'needs_decision');
  assert.ok(j.flags.includes('ambiguous match'));
  assert.equal(j.matched_product, 'Store Orange Juice 1L');
  const names = j.alternatives.map(function (a) { return a.name; });
  assert.ok(names.includes('Premium Orange Juice 1L'), 'the other ambiguous option is offered');
  assert.ok(!names.includes('Store Orange Juice 1L'), 'the resolved pick is not repeated as an alternative');
});

// ---------------------------------------------------------------------
// Household scope is never crossed.
// ---------------------------------------------------------------------

test('household scope: no alternative crosses household scope (foreign product never appears)', function () {
  const alts = rankAlternatives(
    { item_name: 'Mystery Juice', category: 'juice', price: 1.30 },
    products, HH
  );
  assert.ok(alts.length > 0);
  alts.forEach(function (a) {
    assert.notEqual(a.name, 'Foreign Grape Juice 1L', 'an OTHER-household product is never a candidate');
  });
});

test('household scope flips with the active household (proves scope is enforced, not hard-coded)', function () {
  // With OTHER as the active household, the HH-owned orange juices drop out of
  // scope and the OTHER-owned grape juice becomes eligible; the global apple
  // juice stays eligible for either household.
  const alts = rankAlternatives(
    { item_name: 'Mystery Juice', category: 'juice', price: 1.30 },
    products, OTHER
  );
  const names = alts.map(function (a) { return a.name; });
  assert.ok(names.includes('Foreign Grape Juice 1L'), 'the ACTIVE household own product is now eligible');
  assert.ok(names.includes('Store Apple Juice 1L'), 'the global option is eligible for either household');
  assert.ok(!names.includes('Store Orange Juice 1L'), 'the now-foreign HH product is out of scope');
  assert.ok(!names.includes('Premium Orange Juice 1L'), 'the now-foreign HH product is out of scope');
});

// ---------------------------------------------------------------------
// Deterministic ordering with a real tie: equal score -> tie-break by id asc,
// regardless of input order, and identical across repeated calls.
// ---------------------------------------------------------------------

test('determinism: equal-score candidates tie-break by product id ascending, regardless of input order', function () {
  // No line price -> price proximity is neutral for all; both candidates are
  // GLOBAL -> equal household weight -> identical score -> id asc decides.
  // Input order is deliberately REVERSED (id 31 before id 30).
  const tieProducts = [
    { id: 31, list_term: 'Tea Bravo', matched_product: 'Tea Bravo', category: 'tea', household_id: null },
    { id: 30, list_term: 'Tea Alpha', matched_product: 'Tea Alpha', category: 'tea', household_id: null }
  ];
  const line = { item_name: 'Mystery Tea', category: 'tea', out_of_stock: true };
  const alts = rankAlternatives(line, tieProducts, HH);
  assert.deepEqual(alts.map(function (a) { return a.name; }), ['Tea Alpha', 'Tea Bravo'],
    'lower id (30) sorts first on a score tie, not the input order');
  assert.equal(alts[0].score, alts[1].score, 'the two candidates genuinely tie on score');

  // Same inputs -> byte-identical result.
  const again = rankAlternatives(line, tieProducts, HH);
  assert.deepEqual(again, alts);
});

test('determinism: identical planBasket inputs yield identical alternatives', function () {
  const input = {
    listItems: [{ item_name: 'Mystery Juice', category: 'juice', requested_qty: 1, out_of_stock: true, price: 1.30 }],
    products: products, rules: [], budget: budget, household: HH
  };
  const a = JSON.stringify(planBasket(input));
  const b = JSON.stringify(planBasket(input));
  assert.equal(a, b);
});

// ---------------------------------------------------------------------
// Additive + consistent shape: non-needs_decision lines carry [].
// ---------------------------------------------------------------------

test('add lines carry an empty alternatives array (additive, consistent output shape)', function () {
  const plan = planBasket({
    listItems: [{ item_name: 'Orange Juice 1L', requested_qty: 1, matched_product_id: 20 }],  // explicit id -> add
    products: products, rules: [], budget: budget, household: HH
  });
  const j = byName(plan, 'Orange Juice 1L');
  assert.equal(j.status, 'add');
  assert.deepEqual(j.alternatives, [], 'no suggestions for a line that resolved cleanly');
});

test('a needs_decision line with no determinable category returns no alternatives (cannot claim same-category)', function () {
  const alts = rankAlternatives(
    { item_name: 'Totally Unknown Thing', out_of_stock: true },  // no category, no product match
    products, HH
  );
  assert.deepEqual(alts, []);
});

// ---------------------------------------------------------------------
// Purity: the ranker mutates neither the line nor the products.
// ---------------------------------------------------------------------

test('purity: rankAlternatives does not mutate its inputs', function () {
  const line = { item_name: 'Mystery Juice', category: 'juice', price: 1.30 };
  const lineCopy = JSON.parse(JSON.stringify(line));
  const productsCopy = JSON.parse(JSON.stringify(products));
  _internal.rankAlternatives(line, products, HH);
  assert.deepEqual(line, lineCopy, 'the line is not mutated');
  assert.deepEqual(products, productsCopy, 'the products set is not mutated');
});
