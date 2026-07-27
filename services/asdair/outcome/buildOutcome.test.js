// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: buildOutcome.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. Every item, product, household and price below is
// invented ("Widget A", "Generic Milk 2L", household ids 1/2). There is ZERO
// real household data here - nothing from the seed, no real names, no real
// Asda products. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE. buildOutcome is pure, so every branch below is proven with
// plain objects and no connection of any kind.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOutcome, ORDER_COLUMNS, EVENT_TYPES, ITEM_STATUSES } = require('./buildOutcome');
// The REAL planner, so the builder is proven against the shape planBasket
// actually produces rather than a hand-copied idea of it.
const { planBasket } = require('../skill/planner.js');

const HH = 1;
const LIST = 7;

const products = [
  { id: 10, list_term: 'Widget A', matched_product: 'Widget A Deluxe', category: 'household', household_id: null },
  { id: 11, list_term: 'Generic Milk 2L', matched_product: 'Store Brand Milk 2L', category: 'dairy', household_id: HH }
];

// A minimal, valid reconcile record. Individual tests override single keys.
function reconcileFixture(overrides) {
  const base = {
    list_id: LIST,
    household_id: HH,
    run_at: '2026-07-27T09:30:00.000Z',
    attempt: 1,
    basket_total: 130.005,
    budget: { min_normal: 120, max_normal: 150 },
    items: [
      { item_name: 'Widget A', status: 'added' },
      { item_name: 'Generic Milk 2L', status: 'added' },
      { item_name: 'Gadget Z', status: 'needs_decision' },
      { item_name: 'Sundry Item', status: 'not_added' }
    ],
    events: [
      { event_type: 'info', description: 'run started', occurred_at: '2026-07-27T09:30:00.000Z' },
      { event_type: 'correction', description: 'quantity corrected from 2 to 1' },
      { event_type: 'decision', description: 'Gadget Z out of stock; waiting on a human' }
    ]
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

// A plan built by the REAL planner from synthetic fixtures.
function planFixture() {
  return planBasket({
    listItems: [
      { item_name: 'Widget A', requested_qty: 1, price: 3 },
      { item_name: 'Generic Milk 2L', requested_qty: 2, price: 1.5 },
      { item_name: 'Gadget Z', requested_qty: 1 },
      { item_name: 'Sundry Item', requested_qty: 1 }
    ],
    products: products,
    rules: [],
    budget: { min_normal: 120, max_normal: 150, currency: 'GBP', household_id: HH },
    household: HH
  });
}

// ---------------------------------------------------------------------

test('maps a real planBasket result plus a reconcile record to order and event rows', function () {
  const plan = planFixture();
  const out = buildOutcome({ plan: plan, reconcile: reconcileFixture() });

  assert.deepEqual(out.order, {
    list_id: LIST,
    household_id: HH,
    run_at: '2026-07-27T09:30:00.000Z',
    total_requested: 4,            // from the PLAN: four distinct lines asked for
    total_added: 2,                // from the RUN: two lines actually added
    total_needs_decision: 1,       // from the RUN
    basket_total: 130.01,          // rounded to the numeric(10,2) the column stores
    outside_budget_range: false,   // 130.01 sits inside 120-150
    checked_out: false,
    checked_out_at: null,
    attempt: 1,
    source_document_id: null
  });

  assert.equal(out.events.length, 3);
  assert.deepEqual(out.events[0], {
    event_type: 'info',
    description: 'run started',
    occurred_at: '2026-07-27T09:30:00.000Z'
  });
  // No occurred_at on the input -> null, so the WRITER lets the database
  // default supply the time (this function has no clock).
  assert.equal(out.events[1].occurred_at, null);
});

test('the order row carries exactly the contracted columns, no more and no fewer', function () {
  const out = buildOutcome({ plan: planFixture(), reconcile: reconcileFixture() });
  assert.deepEqual(Object.keys(out.order).slice().sort(), ORDER_COLUMNS.slice().sort());
});

test('rule 8: checked_out is ALWAYS false and checked_out_at ALWAYS null', function () {
  // Even when the run reports a full, priced, in-budget basket.
  const out = buildOutcome({ plan: planFixture(), reconcile: reconcileFixture() });
  assert.equal(out.order.checked_out, false);
  assert.equal(out.order.checked_out_at, null);
});

test('rule 8: an input asking for a checked-out order is REFUSED, not honoured', function () {
  assert.throws(function () {
    buildOutcome({ plan: planFixture(), reconcile: reconcileFixture({ checked_out: true }) });
  }, /never checks out/);

  assert.throws(function () {
    buildOutcome({
      plan: planFixture(),
      reconcile: reconcileFixture({ checked_out_at: '2026-07-27T10:00:00.000Z' })
    });
  }, /never checks out/);

  // An explicit false / null is fine -- it agrees with the invariant.
  const ok = buildOutcome({
    plan: planFixture(),
    reconcile: reconcileFixture({ checked_out: false, checked_out_at: null })
  });
  assert.equal(ok.order.checked_out, false);
});

test('totals: the ASK comes from the plan, what happened comes from the run', function () {
  const plan = planFixture();
  // The run added nothing at all and flagged everything.
  const out = buildOutcome({
    plan: plan,
    reconcile: reconcileFixture({
      items: [
        { item_name: 'Widget A', status: 'needs_decision' },
        { item_name: 'Generic Milk 2L', status: 'needs_decision' },
        { item_name: 'Gadget Z', status: 'not_added' },
        { item_name: 'Sundry Item', status: 'excluded_this_week' }
      ]
    })
  });
  assert.equal(out.order.total_requested, 4);
  assert.equal(out.order.total_added, 0);
  assert.equal(out.order.total_needs_decision, 2);
});

test('an item status outside the shopping_list_items vocabulary is rejected', function () {
  assert.throws(function () {
    buildOutcome({
      plan: planFixture(),
      reconcile: reconcileFixture({ items: [{ item_name: 'Widget A', status: 'bought' }] })
    });
  }, /is not one of/);
  // Sanity: the vocabulary this guards is the schema's, not an invented one.
  assert.deepEqual(ITEM_STATUSES.slice().sort(),
    ['added', 'excluded_this_week', 'needs_decision', 'not_added', 'requested']);
});

test('reconcile.items is required (an unrecorded run is not silently counted as zero)', function () {
  assert.throws(function () {
    buildOutcome({ plan: planFixture(), reconcile: reconcileFixture({ items: undefined }) });
  }, /reconcile\.items must be an array/);
});

test('an event_type outside the order_events CHECK vocabulary is rejected before any DB', function () {
  EVENT_TYPES.forEach(function (t) {
    const out = buildOutcome({
      plan: planFixture(),
      reconcile: reconcileFixture({ events: [{ event_type: t, description: 'ok' }] })
    });
    assert.equal(out.events[0].event_type, t);
  });

  ['checkout', 'CORRECTION', '', 'note', null, undefined].forEach(function (bad) {
    assert.throws(function () {
      buildOutcome({
        plan: planFixture(),
        reconcile: reconcileFixture({ events: [{ event_type: bad, description: 'nope' }] })
      });
    }, /is not one of/, 'event_type ' + String(bad) + ' must be rejected');
  });

  // The vocabulary matches the CHECK in 001_asdair_schema.sql exactly.
  assert.deepEqual(EVENT_TYPES.slice().sort(),
    ['correction', 'decision', 'error', 'flag', 'info', 'warning']);
});

test('an event with no description is rejected (order_events.description is NOT NULL)', function () {
  assert.throws(function () {
    buildOutcome({
      plan: planFixture(),
      reconcile: reconcileFixture({ events: [{ event_type: 'info', description: '   ' }] })
    });
  }, /description/);
});

test('a Date is normalised to an ISO string; an absent timestamp stays null', function () {
  const out = buildOutcome({
    plan: planFixture(),
    reconcile: reconcileFixture({
      run_at: new Date(Date.UTC(2026, 6, 27, 9, 0, 0)),
      events: [{ event_type: 'flag', description: 'flagged' }]
    })
  });
  assert.equal(out.order.run_at, '2026-07-27T09:00:00.000Z');
  assert.equal(out.events[0].occurred_at, null);

  const noRun = buildOutcome({ plan: planFixture(), reconcile: reconcileFixture({ run_at: null }) });
  assert.equal(noRun.order.run_at, null);
});

test('outside_budget_range is judged on the ACTUAL basket total against the band', function () {
  const plan = planFixture();
  const band = { min_normal: 120, max_normal: 150 };

  const over = buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: 151, budget: band }) });
  assert.equal(over.order.outside_budget_range, true);

  const under = buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: 119.99, budget: band }) });
  assert.equal(under.order.outside_budget_range, true);

  const inside = buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: 120, budget: band }) });
  assert.equal(inside.order.outside_budget_range, false);
});

test('with no band or no actual total it falls back to the plan flag; unknown is never "outside"', function () {
  const plan = planFixture();

  const above = { items: [], summary: { total_requested: 3, budget_flag: 'above' } };
  assert.equal(
    buildOutcome({ plan: above, reconcile: reconcileFixture({ basket_total: null, budget: null }) })
      .order.outside_budget_range,
    true
  );

  const unknown = { items: [], summary: { total_requested: 3, budget_flag: 'unknown' } };
  assert.equal(
    buildOutcome({ plan: unknown, reconcile: reconcileFixture({ basket_total: null, budget: null }) })
      .order.outside_budget_range,
    false
  );

  // The real planner returns 'unknown' when the add lines are not all priced,
  // so this fallback is the live case, not a hypothetical.
  assert.equal(plan.summary.budget_flag, 'unknown');
});

test('basket_total is rounded to 2dp, and null when the run did not know it', function () {
  const plan = planFixture();
  assert.equal(buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: 12.345 }) }).order.basket_total, 12.35);
  assert.equal(buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: null }) }).order.basket_total, null);
  assert.throws(function () {
    buildOutcome({ plan: plan, reconcile: reconcileFixture({ basket_total: 'lots' }) });
  }, /finite number/);
});

test('attempt defaults to 1 and rejects a non-positive or fractional value', function () {
  const plan = planFixture();
  assert.equal(buildOutcome({ plan: plan, reconcile: reconcileFixture({ attempt: undefined }) }).order.attempt, 1);
  assert.equal(buildOutcome({ plan: plan, reconcile: reconcileFixture({ attempt: 3 }) }).order.attempt, 3);
  [0, -1, 1.5, 'two'].forEach(function (bad) {
    assert.throws(function () {
      buildOutcome({ plan: plan, reconcile: reconcileFixture({ attempt: bad }) });
    }, /positive integer/);
  });
});

test('list_id and household_id are required (both are NOT NULL in asdair.orders)', function () {
  const plan = planFixture();
  assert.throws(function () {
    buildOutcome({ plan: plan, reconcile: reconcileFixture({ list_id: undefined }) });
  }, /list_id is required/);
  assert.throws(function () {
    buildOutcome({ plan: plan, reconcile: reconcileFixture({ household_id: null }) });
  }, /household_id is required/);
  // A numeric string id (pg returns bigint as a string) is accepted.
  assert.equal(buildOutcome({ plan: plan, reconcile: reconcileFixture({ list_id: '7' }) }).order.list_id, 7);
});

test('a missing plan or reconcile is rejected rather than defaulted', function () {
  assert.throws(function () { buildOutcome({ reconcile: reconcileFixture() }); }, /plan is required/);
  assert.throws(function () { buildOutcome({ plan: planFixture() }); }, /reconcile is required/);
  assert.throws(function () { buildOutcome({ plan: { items: [] }, reconcile: reconcileFixture() }); }, /plan\.summary/);
});

test('PURE: identical inputs give an identical result and the inputs are never mutated', function () {
  const plan = planFixture();
  const rec = reconcileFixture();
  const before = JSON.stringify({ plan: plan, rec: rec });

  const a = buildOutcome({ plan: plan, reconcile: rec });
  const b = buildOutcome({ plan: plan, reconcile: rec });

  assert.deepEqual(a, b);
  assert.equal(JSON.stringify({ plan: plan, rec: rec }), before, 'inputs must not be mutated');
  // Fresh objects each call, not shared references into the input.
  assert.notEqual(a.order, b.order);
  assert.notEqual(a.events[0], rec.events[0]);
});
