// =====================================================================
// BUILD-015 AsdAIr - WO-Y: tolerantResolve.test.js
//
// Runs under: node --test
//
// The INTERPRETATION half of the same defect. `resolveByCatalogue.js` decides
// product identity from the model's raw reading; on 2026-08-03 it turned two
// products the household already owns into questions, and it also carried a
// false-positive of its own that nobody had noticed.
//
// Both directions are pinned, and the second matters more: the authority
// boundary in this file says the CATALOGUE determines identity, so a wrong
// resolution here becomes a wrong item in a basket with no human in between.
//
// Aliases below are LIVE-VERIFIED (2026-08-04): regular 15 and regular 11.
//
// PURE ASCII.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveReading, BASIS } = require('./resolveByCatalogue.js');

// LIVE-VERIFIED rows.
const CATALOGUE = [
  { id: 15, name: 'Yazoo Chocolate Milk Drink 400ml',
    aka: ['chocolate yazoo', 'choc yazoo', 'choc yazoos'] },
  { id: 11, name: 'ASDA British Double Gloucester 400g',
    aka: ['double gloucester'] },
  // CONSTRUCTED, to give the refusal cases something real to be confused with.
  { id: 20, name: 'Yazoo Strawberry Milk Drink 400ml',
    aka: ['strawberry yazoo'] },
  { id: 21, name: 'ASDA Shortbread Fingers 250g',
    aka: ['shortbread'] },
  // NOTE the alias here is "white bread", NOT "bread". That is deliberate: an
  // exact alias "bread" would satisfy pass 1 and MASK the substring defect the
  // refusal test below exists to catch. The first draft of this file had that
  // mistake, and the mutation run is what found it.
  { id: 22, name: 'Warburtons Toastie White Bread 800g',
    aka: ['white bread'] }
];

// ---------------------------------------------------------------------
// DIRECTION 1 - the real 2026-08-03 failures now resolve.
// ---------------------------------------------------------------------

test('WORD ORDER: "2 yazoo choc" resolves to regular 15, not a question', function () {
  const r = resolveReading('2 yazoo choc', CATALOGUE);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 15);
  assert.equal(r.matched_product_name, 'Yazoo Chocolate Milk Drink 400ml');
});

test('ONE LETTER: "Double Glouester cheese" resolves to regular 11, not a question', function () {
  const r = resolveReading('Double Glouester cheese', CATALOGUE);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 11);
});

test('an exact alias still wins and still reports itself as an exact alias', function () {
  const r = resolveReading('choc yazoo', CATALOGUE);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 15);
  assert.equal(r.match_basis, BASIS.EXACT_ALIAS);
});

// ---------------------------------------------------------------------
// DIRECTION 2 - it refuses what it should refuse.
// ---------------------------------------------------------------------

test('REFUSAL: a strawberry Yazoo is never resolved as the chocolate one', function () {
  const r = resolveReading('yazoo strawberry', CATALOGUE);
  assert.notEqual(r.matched_regular_id, 15, 'buying chocolate for strawberry is worse than asking');
  assert.equal(r.matched_regular_id, 20, 'it should reach the strawberry row, or nothing at all');
});

test('REFUSAL (regression found by WO-Y): "bread" is NOT "shortbread"', function () {
  // Pass 3 used raw SUBSTRING containment, so "shortbread".includes("bread")
  // resolved a loaf of bread to a packet of biscuits. Containment is now
  // token-wise. This is the case that proves it.
  //
  // Under the old code BOTH "shortbread" and "white bread" claimed this line,
  // so it came back needs_confirmation with a biscuit among the options.
  const r = resolveReading('bread', CATALOGUE);
  assert.notEqual(r.matched_regular_id, 21, '"bread" must never resolve to Shortbread Fingers');
  assert.equal(r.status, 'matched', 'exactly one catalogue row genuinely answers to "bread"');
  assert.equal(r.matched_regular_id, 22, 'it should reach the actual loaf');
  assert.equal(r.alternatives.length, 0, 'a biscuit must not appear as an alternative for bread');
});

test('REFUSAL: an unknown product is still an unmatched new item', function () {
  const r = resolveReading('quinoa flakes', CATALOGUE);
  assert.equal(r.status, 'unmatched_new_item');
  assert.equal(r.matched_regular_id, null);
});

test('REFUSAL: an unreadable line is refused rather than guessed', function () {
  assert.equal(resolveReading('', CATALOGUE).status, 'unreadable');
  assert.equal(resolveReading('   ', CATALOGUE).status, 'unreadable');
});

test('two regulars answering one reading is handed to a human, never picked between', function () {
  const twins = [
    { id: 30, name: 'Sure Men Quantum Dry Anti-Perspirant', aka: ['sure male'] },
    { id: 31, name: 'Sure Men Sensitive Anti-Perspirant', aka: ['sure male'] }
  ];
  const r = resolveReading('sure male', twins);
  assert.equal(r.status, 'needs_confirmation');
  assert.equal(r.matched_regular_id, null);
  assert.equal(r.alternatives.length, 2);
});

test('the interpret and plan halves share ONE matcher, so they cannot drift apart', function () {
  const interpret = require('./resolveByCatalogue.js');
  const planner = require('../skill/planner.js');
  assert.equal(interpret.normaliseTerm, planner.termMatch.normaliseMatchText,
    'two matchers written twice is how this defect got in; there must be exactly one');
});
