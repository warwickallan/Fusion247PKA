// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-19-01 AC3 - THE PRODUCTION PATH IS THE ONE
// THE REGRESSION TEST COVERS.
//
// Runs under: node --test
//
// -- WHY THIS FILE EXISTS ----------------------------------------------------
// The three-counters defect was already fixed, and basket.test.cjs already
// proves the fixed function refuses a basket it cannot describe - including
// "a total and an item count alone can never open the announcement gate".
//
// None of that proves the SHIPPING CODE CALLS IT. That is a different claim,
// and it is the one the Work Order actually asks for: "make sure the production
// path is the one it covers." A perfect proof of an uncalled function is the
// trap that caught the 37/37 measurement two days running.
//
// So this file walks the announcement from the trolley to the sentence and pins
// every hop. It deliberately mixes two kinds of evidence, because neither alone
// is enough here:
//
//   * BEHAVIOURAL - the gate really refuses on real inputs.
//   * WIRING - the shipping module imports THAT reconcile, derives the field
//     from it, and has no second, independent way of producing it. A drift
//     guard, in the estate's existing style, because a behavioural test cannot
//     see a caller that quietly stops calling.
//
// -- THE HOPS ----------------------------------------------------------------
//   reconcile.cjs      reconcile() -> { ready: basketReady(...) }
//   run-basket.cjs:47  requires reconcile FROM ./reconcile.cjs
//   run-basket.cjs     truth = basket ? reconcile(...) : null
//                      payload.reconciliation = truth ? {summary, ready} : null
//                      ready = payload.reconciliation ? ...ready
//                                                     : trolley-not-read
//                      returns { basketReady: ready.ready, blockers }
//   consume-request    ready = !!result.basketReady
//                      announce(ready ? basket_ready : basket_not_ready)
//
// PURE ASCII. No database, no browser, no network.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reconcile, basketReady } = require('./reconcile.cjs');

const RUN_BASKET = path.join(__dirname, 'run-basket.cjs');
const CONSUME = path.join(__dirname, 'consume-request.cjs');

/** Comments stripped, so a claim in prose can never satisfy a wiring assertion. */
function code(f) {
  return fs.readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

const MANIFEST = {
  shop_ref: 'SHOP-AC3-2026-08-19',
  line_count: 2,
  lines: [
    { n: 1, product: 'Weetabix Protein', qty: 1, asda_product_id: 'A12' },
    { n: 2, product: 'Arla semi skimmed 4pt', qty: 3, asda_product_id: 'A13' },
  ],
};

// ---------------------------------------------------------------------
// 1. BEHAVIOURAL - the gate refuses what it cannot account for
// ---------------------------------------------------------------------

test('AC3: a trolley that was never read cannot open the gate, whatever else is known', () => {
  const r = basketReady({ rows: [], unexpected: [], summary: {}, basket: null });
  assert.equal(r.ready, false);
  assert.equal(r.blockers[0].kind, 'trolley-not-read');
});

test('AC3: a HEADLINE TOTAL and ITEM COUNT that agree with the plan do not open the gate', () => {
  // The exact shape Warwick ruled insufficient: the page summary numbers look
  // perfect, and not one product line was enumerated.
  const basket = { order_total: 135.02, item_count: 2, product_count: 2, products: [] };
  const out = reconcile({ manifest: MANIFEST, outcomes: [], basket });
  assert.equal(out.ready.ready, false, 'a total and an item count opened the announcement gate');
  assert.equal(out.summary.trolley_products, 0);
  assert.equal(out.summary.missing_unexplained, 2);
  for (const b of out.ready.blockers) assert.equal(b.kind, 'unexplained-absence');
});

test('AC3: one unaccountable line blocks a basket that is otherwise perfect', () => {
  const basket = {
    order_total: 9.99, item_count: 4, product_count: 1,
    products: [{ product_ref: 'A12', name: 'Weetabix Protein', qty: 1, qty_source: 'read' }],
  };
  const out = reconcile({ manifest: MANIFEST, outcomes: [], basket });
  assert.equal(out.ready.ready, false);
  assert.deepEqual(out.ready.blockers.map((b) => b.line), [2]);
});

test('AC3: a line in the trolley whose QUANTITY could not be read is a blocker, not a pass', () => {
  const basket = {
    order_total: 9.99, item_count: 4, product_count: 2,
    products: [
      { product_ref: 'A12', name: 'Weetabix Protein', qty: 1, qty_source: 'read' },
      { product_ref: 'A13', name: 'Arla semi skimmed 4pt', qty: null, qty_source: 'not-established' },
    ],
  };
  const out = reconcile({ manifest: MANIFEST, outcomes: [], basket });
  assert.equal(out.ready.ready, false);
  assert.equal(out.ready.blockers[0].kind, 'quantity-not-established');
});

test('AC3: a fully accounted trolley DOES open the gate - the fix is not a permanent refusal', () => {
  const basket = {
    order_total: 9.99, item_count: 4, product_count: 2,
    products: [
      { product_ref: 'A12', name: 'Weetabix Protein', qty: 1, qty_source: 'read' },
      { product_ref: 'A13', name: 'Arla semi skimmed 4pt', qty: 3, qty_source: 'read' },
    ],
  };
  const out = reconcile({ manifest: MANIFEST, outcomes: [], basket });
  assert.equal(out.ready.ready, true, 'blocked: ' + JSON.stringify(out.ready.blockers));
  assert.deepEqual(out.ready.blockers, []);
});

// ---------------------------------------------------------------------
// 2. WIRING - the shipping code calls THAT function, and has no second route
// ---------------------------------------------------------------------

test('AC3 WIRING: run-basket imports reconcile from ./reconcile.cjs and from nowhere else', () => {
  const c = code(RUN_BASKET);
  assert.match(c, /require\('\.\/reconcile\.cjs'\)/,
    'run-basket no longer imports the reconciler it is proven against');
  const imports = c.match(/require\([^)]*reconcile[^)]*\)/g) || [];
  assert.ok(imports.length > 0, 'no reconcile import found at all - this proof would pass vacuously');
  for (const r of imports) {
    assert.ok(r.includes('./reconcile.cjs'),
      'run-basket imports a SECOND reconciler: ' + r
      + ' - services/asdair/reconcile/ is the post-delivery order-confirmation reconciler, a different concern');
  }
});

test('AC3 WIRING: basketReady is derived from the reconciliation, never counted independently', () => {
  const c = code(RUN_BASKET);
  assert.match(c, /const truth = basket \? reconcile\(/,
    'the single reconciliation call site moved or changed shape');
  assert.match(c, /basketReady: ready\.ready/,
    'the returned basketReady field is no longer the reconciliation verdict');
  // Exactly three assignments of the returned field: the dry-run false, the
  // launcher-config false, and the real verdict. A fourth would be a second
  // opinion, which is the three-counters defect returning by another door.
  const assigns = (c.match(/basketReady:/g) || []).length;
  assert.equal(assigns, 3,
    'expected exactly 3 basketReady: sites in run-basket; found ' + assigns
    + ' - a new one is a second source of truth');
});

test('AC3 WIRING: with no trolley there is no reconciliation, and the field fails CLOSED', () => {
  const c = code(RUN_BASKET);
  assert.match(c, /reconciliation: truth \? \{ summary: truth\.summary, ready: truth\.ready \} : null/,
    'the payload no longer goes null when the trolley was not read');
  assert.match(c, /trolley-not-read/,
    'the absent-reconciliation fallback no longer names its blocker');
  assert.doesNotMatch(c, /basketReady: true/,
    'a literal true was assigned to the announcement field somewhere in run-basket');
});

test('AC3 WIRING: the announcement reads the gated field and nothing else', () => {
  const c = code(CONSUME);
  assert.match(c, /const ready = !!\(result && result\.basketReady\)/,
    'consume-request no longer derives the announcement from the gated field');
  assert.match(c, /ready[\s\S]{0,40}kind: 'basket_ready'/,
    'the basket_ready message is no longer guarded by that flag');
  const said = (c.match(/basket is ready/g) || []).length;
  assert.equal(said, 1, 'the announcement sentence appears ' + said + ' times in consume-request');
});

test('AC3 WIRING: the post-delivery reconciler is a DIFFERENT module and is not on this path', () => {
  // services/asdair/reconcile/ parses the order-confirmation after delivery.
  // Naming the distinction here so a future reader does not "unify" two things
  // that answer different questions.
  const other = path.join(__dirname, '..', 'reconcile', 'reconcile.js');
  assert.ok(fs.existsSync(other), 'the sibling reconciler moved - re-check which module the lane calls');
  assert.doesNotMatch(code(RUN_BASKET), /\.\.\/reconcile\//,
    'the basket lane reached into the post-delivery reconciler');
  assert.doesNotMatch(code(CONSUME), /\.\.\/reconcile\//,
    'consume-request reached into the post-delivery reconciler');
});
