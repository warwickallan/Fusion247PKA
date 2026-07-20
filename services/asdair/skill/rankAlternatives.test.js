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

// =====================================================================
// Regression coverage for the Codex + Fable consensus findings.
// =====================================================================

// ---------------------------------------------------------------------
// FIX 1 (FIX-BEFORE-MERGE): category resolution is a strict FALLBACK CHAIN,
// not a union. A line that maps to a product must IGNORE a stale/conflicting
// free-text category hint, so a wrong-category product never surfaces.
//
// The proven defect: an 'Orange Juice 1L' line (maps to juice products 20/21)
// carrying a conflicting `category: 'soft drinks'` hint used to UNION juice +
// soft drinks and surface Store Cola at rank 1 (score 0.84), beating the true
// juice option -- violating the module's own SAME-CATEGORY rule.
// ---------------------------------------------------------------------

test('FIX 1: a conflicting category hint on a mapped line is ignored (cola never surfaces for a juice line)', function () {
  const plan = planBasket({
    listItems: [{
      item_name: 'Orange Juice 1L',   // maps to products 20/21 -> category juice
      category: 'soft drinks',        // stale, conflicting hint -> must be ignored
      requested_qty: 1,
      out_of_stock: true,
      price: 1.30
    }],
    products: products, rules: [], budget: budget, household: HH
  });
  const j = byName(plan, 'Orange Juice 1L');
  assert.equal(j.status, 'needs_decision');

  const names = j.alternatives.map(function (a) { return a.name; });
  assert.ok(!names.includes('Store Cola 2L'),
    'the conflicting soft-drinks hint is ignored: cola (wrong category) never surfaces');
  j.alternatives.forEach(function (a) {
    assert.ok(a.reason.includes('same category (juice)'),
      'every suggestion is a juice, matching the line\'s product mapping (not its stale hint)');
  });
  // The true juice option now wins rank 1, not the cola the union used to float up.
  assert.equal(j.alternatives[0].name, 'Store Apple Juice 1L',
    'a same-category juice takes rank 1, not the mis-categorised cola');
  assert.ok(j.alternatives[0].score < 0.84,
    'the spurious 0.84 cola score is gone');
});

test('FIX 1: the category hint is STILL used as a genuine fallback when the line has no product mapping', function () {
  // 'Mystery Juice' matches no product -> tiers (a)/(b) empty -> tier (c) hint used.
  const alts = rankAlternatives(
    { item_name: 'Mystery Juice', category: 'juice', out_of_stock: true, price: 1.30 },
    products, HH
  );
  assert.ok(alts.length > 0, 'the hint still drives suggestions when nothing else determines a category');
  alts.forEach(function (a) {
    assert.ok(a.reason.includes('same category (juice)'));
  });
});

// ---------------------------------------------------------------------
// FIX 2 (FOLD): sort on the UNROUNDED raw score; round only the display value.
// Two candidates whose distinct raw scores round to the SAME 2dp value must
// stay ordered by raw score, NOT collapse into an id-ascending tie.
// ---------------------------------------------------------------------

test('FIX 2: distinct raw scores that round to the same 2dp value are ordered by raw score, not by id', function () {
  // Both GLOBAL (scope 0), same category, line price 1.00.
  //   id 50 price 1.100 -> rel .100 -> raw 0.7*0.900 = 0.6300 -> display 0.63
  //   id 51 price 1.095 -> rel .095 -> raw 0.7*0.905 = 0.6335 -> display 0.63
  // Raw: 51 (0.6335) > 50 (0.6300). Rounded: tie at 0.63 -> id asc would put 50 first.
  const rawProducts = [
    { id: 50, list_term: 'Tea Fifty',    matched_product: 'Tea Fifty',    category: 'tea', household_id: null, price: 1.100 },
    { id: 51, list_term: 'Tea FiftyOne', matched_product: 'Tea FiftyOne', category: 'tea', household_id: null, price: 1.095 }
  ];
  const line = { item_name: 'Mystery Tea', category: 'tea', out_of_stock: true, price: 1.00 };
  const alts = rankAlternatives(line, rawProducts, HH);
  assert.deepEqual(alts.map(function (a) { return a.name; }), ['Tea FiftyOne', 'Tea Fifty'],
    'higher RAW score (id 51) sorts first, even though it has the higher id');
  assert.equal(alts[0].score, alts[1].score,
    'both display the same rounded score (0.63) -- proving the sort used the raw value, not the display');
  assert.equal(alts[0].score, 0.63);
});

// ---------------------------------------------------------------------
// FIX 3 (FOLD): the ranked list is capped at TOP_N (5). A large same-category
// set must not produce an unbounded payload.
// ---------------------------------------------------------------------

test('FIX 3: the alternatives payload is capped at 5 (TOP_N), best-first', function () {
  const many = [];
  for (let i = 0; i < 8; i++) {
    many.push({
      id: 200 + i,
      list_term: 'Bulk Juice ' + i,
      matched_product: 'Bulk Juice ' + i,
      category: 'juice',
      household_id: HH,
      price: 1.00 + i * 0.10
    });
  }
  const alts = rankAlternatives(
    { item_name: 'Mystery Juice', category: 'juice', out_of_stock: true, price: 1.30 },
    many, HH
  );
  assert.equal(alts.length, 5, '8 same-category candidates are capped to the top 5');
  let prev = Infinity;
  alts.forEach(function (a) { assert.ok(a.score <= prev); prev = a.score; });
});

// ---------------------------------------------------------------------
// FIX 4 (FOLD): degenerate-row guard + id-less self exclusion.
//   * a candidate with no usable identity (empty matched_product) is dropped.
//   * the line's own product is excluded even when it carries no id (by name),
//     where the old id-only check re-suggested it.
// ---------------------------------------------------------------------

test('FIX 4: a nameless candidate is dropped, and an id-LESS self product is not re-suggested', function () {
  const widgets = [
    // self product for the line: matches by term, carries NO id.
    { list_term: 'Widget', matched_product: 'No-Id Widget', category: 'widgets', household_id: HH },
    // a genuine alternative.
    { id: 60, list_term: 'Gadget', matched_product: 'Other Widget', category: 'widgets', household_id: HH },
    // degenerate: same category, in scope, but NO usable name -> must be dropped.
    { id: 61, list_term: 'Nameless', matched_product: '', category: 'widgets', household_id: HH }
  ];
  const alts = rankAlternatives(
    { item_name: 'Widget', out_of_stock: true },
    widgets, HH
  );
  const names = alts.map(function (a) { return a.name; });
  assert.ok(!names.includes('No-Id Widget'),
    'the id-less self product is excluded by name, not re-suggested');
  assert.ok(!names.some(function (n) { return normalise(n) === ''; }),
    'no nameless (degenerate) candidate is surfaced');
  assert.deepEqual(names, ['Other Widget'], 'only the genuine alternative remains');

  function normalise(v) { return v === null || v === undefined ? '' : String(v).trim(); }
});

// ---------------------------------------------------------------------
// FIX 5 (COSMETIC): priceOf() treats a non-positive price as "no price" (null).
// A candidate priced 0 contributes a NEUTRAL price component and reports its
// price as null / "price unknown".
// ---------------------------------------------------------------------

test('FIX 5: a non-positive price is treated as unknown (null), not a real GBP 0.00 shelf price', function () {
  const freebies = [
    { id: 70, list_term: 'Free Juice',  matched_product: 'Free Juice 1L',  category: 'juice', household_id: HH, price: 0 },
    { id: 71, list_term: 'Cheap Juice', matched_product: 'Cheap Juice 1L', category: 'juice', household_id: HH, price: -5 }
  ];
  const alts = rankAlternatives(
    { item_name: 'Mystery Juice', category: 'juice', out_of_stock: true, price: 1.30 },
    freebies, HH
  );
  assert.equal(alts.length, 2);
  alts.forEach(function (a) {
    assert.equal(a.price, null, 'a non-positive price surfaces as null, never 0 or a negative');
    assert.ok(a.reason.includes('price unknown'), 'the reason reports the price as unknown');
  });
});
