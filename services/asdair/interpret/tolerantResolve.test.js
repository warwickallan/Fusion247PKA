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

const { resolveReading, BASIS, VISION_CONFIDENCE_THRESHOLD } = require('./resolveByCatalogue.js');

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

// ---------------------------------------------------------------------
// WP-B15-22 - GATE ZERO. A confident CATALOGUE match must never override the
// MODEL'S OWN uncertainty about the reading it came from. SHOP-2026-08-10-M64:
// ~17 real items missing, 7 invented - the model was asked for a per-line
// confidence and the code threw it away before this gate existed.
// ---------------------------------------------------------------------

test('GATE ZERO: an exact-alias match is HELD for confirmation when the model itself scored it below threshold', function () {
  // Same reading as the exact-alias test above (`choc yazoo` -> 15,
  // status "matched", no doubt at all from the catalogue's side) - the ONLY
  // difference is the model's own confidence. The catalogue evidence did not
  // get weaker; the model's certainty about what it READ did, and that is
  // enough on its own to hold the line.
  const r = resolveReading('choc yazoo', CATALOGUE, { visionConfidence: 0.3 });
  assert.equal(r.status, 'needs_confirmation',
    'a low-confidence reading must be held regardless of how strong the catalogue match looked');
  assert.match(String(r.match_basis), /confidence/i, 'the reason the line was held must be visible, not silent');
});

test('GATE ZERO: a confidence AT the threshold is trusted; just below it is not (boundary, not a vibe)', function () {
  const atThreshold = resolveReading('choc yazoo', CATALOGUE, { visionConfidence: VISION_CONFIDENCE_THRESHOLD });
  assert.equal(atThreshold.status, 'matched', `${VISION_CONFIDENCE_THRESHOLD} itself must still be trusted`);
  const justBelow = resolveReading('choc yazoo', CATALOGUE, { visionConfidence: VISION_CONFIDENCE_THRESHOLD - 0.01 });
  assert.equal(justBelow.status, 'needs_confirmation', 'one hundredth below the threshold must already be held');
});

test('GATE ZERO: the model\'s own "unreadable" status is honoured even when the catalogue would have matched confidently', function () {
  const r = resolveReading('choc yazoo', CATALOGUE, { visionStatus: 'unreadable' });
  assert.equal(r.status, 'unreadable', 'the model said it could not read this - that verdict is never overridden');
  assert.equal(r.matched_regular_id, null, 'an unreadable line must never carry a matched identity');
});

test('GATE ZERO: a MISSING confidence on a vision-graded line is treated as the WORST case, never as 1.0', function () {
  // visionStatus present but visionConfidence absent - the model answered
  // something, but not the number. Warwick's ruling on this Work Order: never
  // invent a confidence, and a missing one is low-confidence, not full marks.
  const r = resolveReading('choc yazoo', CATALOGUE, { visionStatus: 'matched' });
  assert.equal(r.status, 'needs_confirmation', 'a missing confidence value must not silently pass as confident');
});

test('GATE ZERO: a TYPED reading (no vision signal at all) is never touched by this gate', function () {
  // `visionConfidence`/`visionStatus` both undefined - exactly what a typed
  // list line looks like, since it was never read by a vision model. The gate
  // must not invent uncertainty for input that was never photographed.
  const r = resolveReading('choc yazoo', CATALOGUE, {});
  assert.equal(r.status, 'matched', 'a line with no vision signal at all must resolve exactly as before this gate existed');
});

test('GATE ZERO: the gate never manufactures a match - an already-unmatched line stays unmatched, it does not become "matched" with high confidence', function () {
  const r = resolveReading('quinoa flakes', CATALOGUE, { visionConfidence: 0.99 });
  assert.equal(r.status, 'unmatched_new_item', 'high model confidence about the READING is not evidence the catalogue has the product');
  assert.equal(r.matched_regular_id, null);
});

test('the interpret and plan halves share ONE matcher, so they cannot drift apart', function () {
  const interpret = require('./resolveByCatalogue.js');
  const planner = require('../skill/planner.js');
  assert.equal(interpret.normaliseTerm, planner.termMatch.normaliseMatchText,
    'two matchers written twice is how this defect got in; there must be exactly one');
});

// ---------------------------------------------------------------------
// WP-B15-13 - the LIVE failure of SHOP-2026-08-10-M64.
//
// Warwick was asked "Which product is VANISH PRETREAT GEL?" against a
// household regular literally named "Vanish Pre-Treat Gel", and the card
// said "No candidate products found". His words: "its bloody obvious!"
//
// The rows below are the five products the runtime itself offered on that
// card, so the refusal cases have the real neighbours to be confused with.
// ---------------------------------------------------------------------

const VANISH_CATALOGUE = [
  { id: 40, name: 'Vanish Pre-Treat Gel', aka: [] },
  { id: 41, name: 'Vanish Gold Oxi Action Stain Remover Powder for clothes 450g', aka: [] },
  { id: 42, name: 'Vanish Oxi Action Laundry Stain Remover Powder, 450g', aka: [] },
  { id: 43, name: 'Vanish Oxi Action Laundry Whitener and Stain Remover Powder, 450g', aka: [] },
  { id: 44, name: 'VO5 Volume Boost Gel Spray 165g', aka: [] }
];

test('LIVE CASE 2026-08-10: "VANISH PRETREAT GEL" resolves to the Vanish Pre-Treat Gel regular', function () {
  const r = resolveReading('VANISH PRETREAT GEL', VANISH_CATALOGUE);
  assert.equal(r.status, 'matched', 'grounding the household already holds must not become a question');
  assert.equal(r.matched_regular_id, 40);
  assert.equal(r.matched_product_name, 'Vanish Pre-Treat Gel');
  assert.equal(r.match_basis, BASIS.REGULAR,
    'a punctuation-only difference is the canonical name, not an approximation - the record must say so');
});

test('the same reading spelled the catalogue way still resolves the same way', function () {
  const r = resolveReading('Vanish Pre-Treat Gel', VANISH_CATALOGUE);
  assert.equal(r.matched_regular_id, 40);
  assert.equal(r.match_basis, BASIS.REGULAR);
});

test('a separator-blind ALIAS is still reported as an exact alias', function () {
  const withAlias = [{ id: 45, name: 'Vanish Pre-Treat Gel', aka: ['pre-treat'] }];
  const r = resolveReading('pretreat', withAlias);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 45);
  assert.equal(r.match_basis, BASIS.EXACT_ALIAS);
});

test('REFUSAL: the OXI card still asks, and still never picks a Vanish for Warwick', function () {
  // "VANISH OXI ACTION POWDER" genuinely has three plausible answers. The
  // separator rule must not turn a real ambiguity into a silent purchase.
  const r = resolveReading('VANISH OXI ACTION POWDER', VANISH_CATALOGUE);
  assert.equal(r.status, 'needs_confirmation');
  assert.equal(r.matched_regular_id, null);
  assert.equal(r.alternatives.some(function (a) { return a.id === 40; }), false,
    'the pre-treat gel is not an oxi action powder');
});

test('OUT OF SCOPE and it must STAY out: "BATCHLORS MAC N CHEESE" is still unmatched', function () {
  // A misspelling plus a token subset. Fixing it needs fuzzy or subset
  // matching, which this Work Order refuses to build - the same suggestion
  // channel that got Batchelors right also offered toothpaste for gloves.
  const r = resolveReading('BATCHLORS MAC N CHEESE', [
    { id: 50, name: "Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g", aka: [] }
  ]);
  assert.equal(r.matched_regular_id, null, 'a separator rule must not be credited with fixing a misspelling');
});
