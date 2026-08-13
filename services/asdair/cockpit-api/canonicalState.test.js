// BUILD-015 - cockpit-api/canonicalState.test.js
//
// PURE. No DB, no network. See canonicalState.js's file header for why this
// module is a documented placeholder rather than a read of the real durable
// field (that field does not exist yet on this branch - AC1's schema_decision).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CANONICAL_STATES, STAGE_MAP, computeCanonicalState } = require('./canonicalState');
const { SHOP_STATUSES } = require('../shop/shopState');

test('CANONICAL_STATES is exactly the six values the design names, in the order it names them', () => {
  assert.deepEqual(CANONICAL_STATES, [
    'NEEDS_WARWICK', 'ASDAIR_WORKING', 'READY_FOR_WARWICK', 'BROWSER_WORKING', 'COMPLETE', 'FAILED',
  ]);
});

test('every real pipeline stage is mapped - no silent fallthrough for a new stage', () => {
  // Pinned against the ACTUAL SHOP_STATUSES export, not a copied list, so a
  // future stage added to the pipeline's own vocabulary fails HERE rather
  // than being silently misreported as some other canonical value.
  assert.deepEqual(Object.keys(STAGE_MAP).sort(), [...SHOP_STATUSES].sort());
  Object.values(STAGE_MAP).forEach((v) => assert.ok(CANONICAL_STATES.includes(v), `${v} is not a canonical state`));
});

test('an unknown or missing stage is refused loudly, never guessed', () => {
  assert.throws(() => computeCanonicalState({ stage: 'NOT_A_REAL_STAGE' }), /unknown or missing st(age|atus)/);
  assert.throws(() => computeCanonicalState({}), /unknown or missing st(age|atus)/);
  assert.throws(() => computeCanonicalState(null), /unknown or missing st(age|atus)/);
});

test('FAILED is unconditional, even if needs_review is somehow also true', () => {
  assert.equal(computeCanonicalState({ stage: 'FAILED', needs_review: true }), 'FAILED');
  assert.equal(computeCanonicalState({ stage: 'FAILED', needs_review: false }), 'FAILED');
});

test('RECONCILED is COMPLETE and CANCELLED is FAILED, both unconditionally', () => {
  assert.equal(computeCanonicalState({ stage: 'RECONCILED', needs_review: true }), 'COMPLETE');

  // WP-B15-35: CANCELLED was COMPLETE here and in migration 020's proposed
  // default. OVERRULED (Larry, 2026-08-13): "Complete" tells Warwick his shop
  // is done, which for a cancelled shop implies groceries are coming when
  // nothing was ordered. FAILED is imprecise - cancellation is deliberate, not
  // breakage - but imprecise in the SAFE direction, and explainState.js
  // carries the nuance the closed six-value set cannot
  // ("This shop was cancelled. Nothing was ordered.").
  assert.equal(computeCanonicalState({ stage: 'CANCELLED', needs_review: true }), 'FAILED');
});

test('needs_review escalates a live, non-terminal stage to NEEDS_WARWICK even outside NEEDS_DECISION', () => {
  assert.equal(computeCanonicalState({ stage: 'PROCESSING', needs_review: true }), 'NEEDS_WARWICK');
  assert.equal(computeCanonicalState({ stage: 'READY_TO_SHOP', needs_review: true }), 'NEEDS_WARWICK');
});

test('the ordinary per-stage mapping holds when needs_review is false or absent', () => {
  const cases = [
    ['RECEIVED', 'ASDAIR_WORKING'],
    ['TRANSCRIBING', 'ASDAIR_WORKING'],
    ['PROCESSING', 'ASDAIR_WORKING'],
    ['NEEDS_DECISION', 'NEEDS_WARWICK'],
    ['READY_TO_SHOP', 'READY_FOR_WARWICK'],
    ['WAITING_FOR_BROWSER', 'BROWSER_WORKING'],
    ['SHOPPING', 'BROWSER_WORKING'],
    ['BASKET_READY', 'READY_FOR_WARWICK'],
    ['ORDER_CONFIRMATION_RECEIVED', 'ASDAIR_WORKING'],
  ];
  cases.forEach(([stage, expected]) => {
    assert.equal(computeCanonicalState({ stage, needs_review: false }), expected, `stage ${stage}`);
    assert.equal(computeCanonicalState({ stage }), expected, `stage ${stage} (needs_review absent)`);
  });
});

test('NEEDS_DECISION is NEEDS_WARWICK even when needs_review happens to read false', () => {
  // The stage itself already means "waiting on your answers" - a false
  // needs_review must never downgrade that.
  assert.equal(computeCanonicalState({ stage: 'NEEDS_DECISION', needs_review: false }), 'NEEDS_WARWICK');
});
