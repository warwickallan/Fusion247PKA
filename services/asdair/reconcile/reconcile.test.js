// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: reconcile.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (see fixtures.js). ZERO real household data. This
// file runs in CI on the PUBLIC repo.
//
// NO DATABASE, NO NETWORK, NO CREDENTIALS. reconcile is pure.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseConfirmation } = require('./parseConfirmation');
const { reconcile, OUTCOMES, OUTCOME_PRECEDENCE, _internal } = require('./reconcile');
const planner = require('../skill/planner');

const F = require('./fixtures');
const P = F.P;

function run(text, overrides) {
  const o = overrides || {};
  return reconcile({
    confirmation: typeof text === 'string' ? parseConfirmation({ text: text }) : text,
    plan: o.plan === undefined ? F.PLAN : o.plan,
    list_items: o.list_items === undefined ? F.LIST_ITEMS : o.list_items,
    regulars: o.regulars === undefined ? F.REGULARS : o.regulars,
    household_id: o.household_id === undefined ? 1 : o.household_id
  });
}

function byName(result, needle) {
  const hits = result.lines.filter(function (l) { return l.product_name.indexOf(needle) !== -1; });
  assert.equal(hits.length, 1, 'expected exactly one line matching "' + needle + '"');
  return hits[0];
}

// ---------------------------------------------------------------------
// The seven outcomes
// ---------------------------------------------------------------------

test('every one of the seven outcomes is produced, exactly once each', function () {
  const r = run(F.SEVEN_OUTCOME_CONFIRMATION_TEXT);
  assert.deepEqual(r.summary.counts, {
    as_planned: 1,
    added_after_planning: 2,   // the held-for-decision line AND an off-plan regular
    omitted: 1,
    qty_changed: 1,
    variant_changed: 1,
    price_missing: 1,
    unmatched: 1
  });
  OUTCOMES.forEach(function (o) {
    assert.ok(r.summary.counts[o] >= 1, o + ' is exercised');
  });
});

test('each line lands on the right outcome for the right reason', function () {
  const r = run(F.SEVEN_OUTCOME_CONFIRMATION_TEXT);

  assert.equal(byName(r, 'Arla British Semi Skimmed Milk').outcome, 'as_planned');
  assert.equal(byName(r, 'Warburtons').outcome, 'qty_changed');
  assert.equal(byName(r, 'Sausage Rolls').outcome, 'price_missing');
  assert.equal(byName(r, 'ASDA Organic Natural Yogurt').outcome, 'variant_changed');
  assert.equal(byName(r, 'Ready Salted Crisps').outcome, 'added_after_planning');
  assert.equal(byName(r, 'Cadbury Dairy Milk').outcome, 'added_after_planning');
  assert.equal(byName(r, 'Zeta Widget Cleaner').outcome, 'unmatched');
  assert.equal(byName(r, 'Nescafe').outcome, 'omitted');

  assert.match(byName(r, 'Warburtons').note, /planned quantity 1, received quantity 2/);
  assert.match(byName(r, 'ASDA Organic Natural Yogurt').note, /planned "Yeo Valley Organic Natural Yogurt 500g"/);
  assert.match(byName(r, 'Ready Salted Crisps').note, /needs_decision/);
  assert.match(byName(r, 'Cadbury Dairy Milk').note, /household regular/);
  assert.match(byName(r, 'Zeta Widget Cleaner').note, /would be a guess/);
});

test('every emitted line carries EXACTLY ONE outcome, from the vocabulary', function () {
  const r = run(F.SEVEN_OUTCOME_CONFIRMATION_TEXT);
  r.lines.forEach(function (l) {
    assert.equal(typeof l.outcome, 'string');
    assert.ok(OUTCOMES.indexOf(l.outcome) !== -1, l.outcome + ' is in the vocabulary');
  });
  const total = Object.keys(r.summary.counts).reduce(function (a, k) { return a + r.summary.counts[k]; }, 0);
  assert.equal(total, r.lines.length, 'the counts partition the lines - no line is counted twice or missed');
});

// ---------------------------------------------------------------------
// `omitted` comes from the PLAN and nowhere else
// ---------------------------------------------------------------------

test('omitted is DERIVED FROM THE STORED PLAN: with an empty plan nothing is ever omitted', function () {
  const r = run(F.SEVEN_OUTCOME_CONFIRMATION_TEXT, { plan: { items: [] } });
  assert.equal(r.summary.counts.omitted, 0,
    'a confirmation alone can never prove an omission - nothing was planned');
  assert.equal(r.summary.planned_add_count, 0);
});

test('a planned line that never arrived is omitted; a line the planner did NOT plan is not', function () {
  const plan = {
    items: [
      { item_name: 'coffee', matched_product: 'Nescafe Gold Blend Instant Coffee 200g', planned_qty: 1, status: 'add' },
      { item_name: 'biscuits', matched_product: 'Generic Biscuits 300g', planned_qty: 1, status: 'needs_decision' },
      { item_name: 'wine', matched_product: 'Generic Red Wine 750ml', planned_qty: 1, status: 'excluded' },
      { item_name: 'ice cream', matched_product: 'Generic Ice Cream 1L', planned_qty: 1, status: 'excluded_this_week' }
    ]
  };
  const r = run('1 x Generic Widget Nothing Matches 100g ' + P + '1.00', { plan: plan, list_items: [], regulars: [] });

  const omitted = r.lines.filter(function (l) { return l.outcome === 'omitted'; });
  assert.equal(omitted.length, 1, 'only the status "add" line can be omitted');
  assert.equal(omitted[0].product_name, 'Nescafe Gold Blend Instant Coffee 200g');
  assert.equal(omitted[0].source, 'plan');
});

test('an omitted line has no price to know, and says it came from the plan', function () {
  const r = run(F.SEVEN_OUTCOME_CONFIRMATION_TEXT);
  const omitted = r.lines.filter(function (l) { return l.outcome === 'omitted'; });
  assert.equal(omitted.length, 1);
  assert.equal(omitted[0].line_price, null);
  assert.equal(omitted[0].price_basis, 'unknown');
  assert.match(omitted[0].note, /PLAN-DERIVED, not from the confirmation/);
  assert.ok(omitted[0].line_no > r.summary.confirmation_line_count,
    'plan-derived lines are numbered after the confirmation lines');
});

test('the plan is REQUIRED: without it, omission cannot be derived and must not be guessed', function () {
  assert.throws(function () {
    reconcile({ confirmation: parseConfirmation({ text: '1 x Generic Widget ' + P + '1.00' }) });
  }, /plan is required/);
  assert.throws(function () {
    reconcile({ confirmation: parseConfirmation({ text: '1 x Generic Widget ' + P + '1.00' }), plan: 'the plan' });
  }, /plan is required/);
});

// ---------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------

test('an `aka` alias on a regular matches the receipt name to the planned line', function () {
  const plan = { items: [{ item_name: '4pt milk', matched_product: '', planned_qty: 2, status: 'add' }] };
  const r = run('2 x Arla British Semi Skimmed Milk 2.27L ' + P + '3.35', { plan: plan, list_items: [] });

  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].outcome, 'as_planned');
  assert.equal(r.lines[0].match_pass, 'regular');
  assert.equal(r.lines[0].matched_regular_id, 41);
  assert.equal(r.summary.counts.omitted, 0, 'the planned line was matched, so it is not omitted');
});

test('an explicit asda_product_id matches even when the two names differ completely', function () {
  const plan = {
    items: [{ item_name: 'milk', matched_product: 'Arla British Semi Skimmed Milk 2.27L',
      asda_product_id: '1000000000041', planned_qty: 2, status: 'add' }]
  };
  const confirmation = {
    lines: [{
      line_no: 1,
      product_name: 'ARLA BRIT SEMI SKIM MLK 2.27LT',   // the receipt's own abbreviation
      quantity: 2,
      pack_size: null,
      promotion: null,
      line_price: 3.35,
      price_basis: 'stated',
      note: null,
      asda_product_id: '1000000000041'
    }],
    stated_total: null,
    stated_total_basis: 'unknown'
  };
  const r = run(confirmation, { plan: plan, list_items: [] });

  assert.equal(r.lines[0].match_pass, 'asda_product_id');
  assert.equal(r.lines[0].outcome, 'as_planned',
    'a matching ASDA product id is the same product, so a different printed name is not a variant change');
  assert.equal(r.summary.counts.omitted, 0);
});

test('an AMBIGUOUS alias resolves to nothing rather than picking one regular', function () {
  const regulars = [
    { id: 51, household_id: 1, name: 'Generic Blue Milk 2L', aka: ['milk'], active: true },
    { id: 52, household_id: 1, name: 'Generic Green Milk 2L', aka: ['milk'], active: true }
  ];
  const index = _internal.buildRegularsIndex(regulars, 1);
  assert.equal(index.resolve('milk', null).regular, null);
  assert.equal(index.resolve('milk', null).via, 'ambiguous_alias');
  assert.equal(index.resolve('Generic Blue Milk 2L', null).regular.id, 51);
});

test('another household\'s regular is never used, and an inactive one is ignored', function () {
  const regulars = [
    { id: 61, household_id: 2, name: 'Other Household Widget', aka: ['widget'], active: true },
    { id: 62, household_id: 1, name: 'Retired Widget', aka: ['old widget'], active: false },
    { id: 63, name: 'Global Widget', aka: ['global widget'], active: true }
  ];
  const index = _internal.buildRegularsIndex(regulars, 1);
  assert.equal(index.resolve('widget', null).regular, null, 'household 2 is out of scope');
  assert.equal(index.resolve('old widget', null).regular, null, 'inactive rows are ignored');
  assert.equal(index.resolve('global widget', null).regular.id, 63, 'a global row is in scope');
});

test('a plan line is claimed at most once, so a duplicate receipt line does not double-count it', function () {
  const plan = { items: [{ item_name: 'widget', matched_product: 'Generic Widget A 500g', planned_qty: 1, status: 'add' }] };
  const r = run('1 x Generic Widget A 500g ' + P + '2.00\n1 x Generic Widget A 500g ' + P + '2.00',
    { plan: plan, list_items: [], regulars: [] });

  assert.equal(r.summary.matched_plan_count, 1);
  const outcomes = r.lines.map(function (l) { return l.outcome; }).sort();
  assert.deepEqual(outcomes, ['as_planned', 'unmatched']);
  assert.equal(r.summary.counts.omitted, 0);
});

test('two plan lines with the same product name are AMBIGUOUS and neither is claimed by guesswork', function () {
  const plan = {
    items: [
      { item_name: 'widget one', matched_product: 'Generic Widget A 500g', planned_qty: 1, status: 'add' },
      { item_name: 'widget two', matched_product: 'Generic Widget A 500g', planned_qty: 1, status: 'add' }
    ]
  };
  const r = run('1 x Generic Widget A 500g ' + P + '2.00', { plan: plan, list_items: [], regulars: [] });
  const conf = r.lines.filter(function (l) { return l.source === 'confirmation'; })[0];
  assert.equal(conf.matched_plan_index, null, 'an ambiguous plan side matches nothing');
  assert.equal(r.summary.counts.omitted, 2, 'both planned lines are reported as omitted for a human to settle');
});

test('reconcile normalises with the PLANNER\'S OWN normaliseTerm, not a copy of it', function () {
  assert.equal(_internal.normaliseTerm, planner._internal.normaliseTerm,
    'the exported function must be the identical reference, so the two can never drift');
  [
    ['  ASDA   Semi Skimmed  MILK ', 'asda semi skimmed milk'],
    ['Wall\'s 4 Pork Sausage Rolls', 'wall\'s 4 pork sausage rolls'],
    [null, ''],
    [undefined, '']
  ].forEach(function (pair) {
    assert.equal(_internal.normaliseTerm(pair[0]), pair[1]);
  });
});

// ---------------------------------------------------------------------
// The price contract survives reconciliation
// ---------------------------------------------------------------------

test('price_basis passes through reconciliation untouched, including a derived line', function () {
  const parsed = parseConfirmation({ text: F.DERIVABLE_CONFIRMATION_TEXT, derive_single_missing_price: true });
  const plan = {
    items: [
      { item_name: 'widget a', matched_product: 'Generic Widget A 500g', planned_qty: 2, status: 'add' },
      { item_name: 'widget b', matched_product: 'Generic Widget B 250g', planned_qty: 1, status: 'add' }
    ]
  };
  const r = run(parsed, { plan: plan, list_items: [], regulars: [] });

  const a = byName(r, 'Widget A');
  const b = byName(r, 'Widget B');
  assert.equal(a.price_basis, 'stated');
  assert.equal(b.price_basis, 'derived');
  assert.equal(b.line_price, 3.50);
  assert.match(b.note, /line_price is DERIVED, not quoted by ASDA/);
  assert.equal(r.summary.stated_line_price_sum, 5.00, 'the derived amount is not folded into the stated sum');
  assert.equal(r.summary.derived_price_line_count, 1);
});

test('price_missing never displaces a stronger finding - it only ever replaces as_planned', function () {
  const plan = {
    items: [{ item_name: 'sausage rolls', matched_product: "Wall's 4 Pork Sausage Rolls", planned_qty: 2, status: 'add' }]
  };
  const r = run("3 x Wall's 4 Pork Sausage Rolls", { plan: plan, list_items: [], regulars: [] });

  const line = r.lines[0];
  assert.equal(line.outcome, 'qty_changed', 'the quantity change outranks the missing price');
  assert.equal(line.price_basis, 'unknown', 'the missing price is still recorded on the line');
  assert.equal(line.price_missing, true);
  assert.equal(line.line_price, null);
  assert.match(line.note, /no price was inferred/);
  assert.equal(r.summary.lines_without_price, 1, 'and it is still counted');

  // The precedence ladder is data, and it says exactly this.
  assert.ok(OUTCOME_PRECEDENCE.qty_changed > OUTCOME_PRECEDENCE.price_missing);
  assert.ok(OUTCOME_PRECEDENCE.price_missing > OUTCOME_PRECEDENCE.as_planned);
  assert.ok(OUTCOME_PRECEDENCE.unmatched > OUTCOME_PRECEDENCE.price_missing);
});

test('a line whose price_basis is missing or bogus is rejected, never defaulted', function () {
  const bad = {
    lines: [{ line_no: 1, product_name: 'Generic Widget', quantity: 1, line_price: 1.00 }],
    stated_total: null,
    stated_total_basis: 'unknown'
  };
  assert.throws(function () { run(bad, { plan: { items: [] } }); }, /Every line MUST carry a price_basis/);

  const bogus = {
    lines: [{ line_no: 1, product_name: 'Generic Widget', quantity: 1, line_price: 1.00, price_basis: 'quoted' }],
    stated_total: null,
    stated_total_basis: 'unknown'
  };
  assert.throws(function () { run(bogus, { plan: { items: [] } }); }, /Every line MUST carry a price_basis/);
});

test('an unshown quantity never becomes a quantity change', function () {
  const plan = { items: [{ item_name: 'widget', matched_product: 'Generic Widget A 500g', planned_qty: 3, status: 'add' }] };
  const r = run('Generic Widget A 500g ' + P + '2.00', { plan: plan, list_items: [], regulars: [] });
  assert.equal(r.lines[0].quantity, null);
  assert.equal(r.lines[0].outcome, 'as_planned');
  assert.match(r.lines[0].note, /did not show a quantity/);
});

// ---------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------

test('reconciling is pure: the frozen parse is untouched and the result is deterministic', function () {
  const parsed = parseConfirmation({ text: F.SEVEN_OUTCOME_CONFIRMATION_TEXT });
  const before = JSON.parse(JSON.stringify(parsed));

  const a = run(parsed);
  const b = run(parsed);

  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), before, 'the parse was not mutated');
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.throws(function () { a.lines[0].outcome = 'as_planned'; }, TypeError);
});

test('the 32-line confirmation reconciles against a plan built from itself with no omissions', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const plan = {
    items: F.EXPECTED_LINES.map(function (row) {
      return { item_name: row[0], matched_product: row[0], planned_qty: row[1], status: 'add' };
    })
  };
  const r = run(parsed, { plan: plan, list_items: [], regulars: [] });

  assert.equal(r.summary.counts.as_planned, 31);
  assert.equal(r.summary.counts.price_missing, 1, 'the unpriced Wall\'s line');
  assert.equal(r.summary.counts.omitted, 0);
  assert.equal(r.summary.counts.unmatched, 0);
  assert.equal(r.summary.stated_line_price_sum, F.EXPECTED_STATED_PRICE_SUM);
});
