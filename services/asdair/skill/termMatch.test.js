// =====================================================================
// BUILD-015 AsdAIr - WO-Y: termMatch.test.js
//
// Runs under: node --test
//
// MUTATION-TESTED IN BOTH DIRECTIONS, because only one direction is the
// dangerous one. A matcher is easy to prove "works" by feeding it the cases it
// was written for; the failure that costs money is the case it should have
// REFUSED and did not. So the refusal cases below are pinned as hard as the
// acceptance cases, and each names the real grocery pair it protects.
//
// PURE ASCII. No database, no network, no clock.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const tm = require('./termMatch.js');

// ---------------------------------------------------------------------
// The thresholds, pinned to literals held HERE rather than read from the
// module's own comments. If someone loosens a constant to make a case pass,
// this fails first and says so.
// ---------------------------------------------------------------------
test('the refusal thresholds are exactly what the module documents', function () {
  assert.deepEqual(tm.THRESHOLDS, {
    TYPO_MIN_LEN: 6,
    TYPO_PREFIX_LEN: 2,
    SUBSET_SINGLE_TOKEN_MIN_LEN: 6,
    SUBSET_MIN_SIGNIFICANT_LEN: 4,
    ADVISORY_MIN_TOKEN_LEN: 5,
    ADVISORY_MIN_KEY_COVERAGE: 0.5
  });
});

// ---------------------------------------------------------------------
// DIRECTION 1 - it catches the real 2026-08-03 failures.
//
// Both stored aliases below are REAL, verified live on 2026-08-04:
//   regular 15  "Yazoo Chocolate Milk Drink 400ml"
//               aka ["chocolate yazoo", "choc yazoo", "choc yazoos"]
//   regular 11  "ASDA British Double Gloucester 400g"
//               aka ["double gloucester"]
// ---------------------------------------------------------------------

test('WORD ORDER: "2 yazoo choc" reaches the stored alias "choc yazoo"', function () {
  const m = tm.matchTerms('2 yazoo choc', 'choc yazoo');
  assert.equal(m.tier, tm.TIER.TOKEN_SET);
  assert.equal(m.confident, true, 'word order alone must be enough to establish identity');
});

test('the leading COUNT is stripped, not treated as part of the name', function () {
  assert.equal(tm.stripLeadingQuantity('2 yazoo choc'), 'yazoo choc');
  assert.equal(tm.stripLeadingQuantity('1 4pk orange lucozade'), '4pk orange lucozade');
  assert.equal(tm.stripLeadingQuantity('3 x dreamies'), 'dreamies');
});

test('ONE LETTER: "Double Glouester cheese" reaches the stored alias "double gloucester"', function () {
  const m = tm.matchTerms('Double Glouester cheese', 'double gloucester');
  assert.equal(m.tier, tm.TIER.KEY_SUBSET);
  assert.equal(m.confident, true);
  assert.deepEqual(m.via, ['glouester', 'gloucester'], 'the typo pair it leant on must be reportable');
});

test('PUNCTUATION and SPACING cannot cause a miss', function () {
  ['choc-yazoo', 'Choc  Yazoo', 'choc, yazoo', ' CHOC YAZOO '].forEach(function (written) {
    assert.equal(tm.matchTerms(written, 'choc yazoo').confident, true, written);
  });
});

test('extra descriptive words do not break a multi-word alias', function () {
  assert.equal(tm.matchTerms('vanilla ice cream', 'ice cream').confident, true);
  assert.equal(tm.matchTerms('1 dreamies cheese large', 'dreamies cheese').confident, true);
});

// ---------------------------------------------------------------------
// DIRECTION 2 - it still REFUSES a genuinely different product.
//
// Every case here is a pair that a naive matcher gets wrong, and every one of
// them would put the wrong thing in a real basket.
// ---------------------------------------------------------------------

test('REFUSES "Sure female" against "sure male" - the pair rule 37 would create', function () {
  const m = tm.matchTerms('Sure female', 'sure male');
  assert.equal(m.tier, null, 'male/female are four letters and one edit apart; this must never match');
  assert.equal(m.confident, false);
});

test('REFUSES a four-letter one-edit pair: milk / silk', function () {
  assert.equal(tm.matchTerms('milk', 'silk').tier, null);
});

test('REFUSES a five-letter one-edit pair: beans / beers, lemon / melon', function () {
  assert.equal(tm.matchTerms('baked beans', 'baked beers').confident, false,
    'beans and beers differ by one letter at length 5 and are not the same shop');
  assert.equal(tm.matchTerms('lemon', 'melon').tier, null);
});

test('REFUSES a six-letter one-edit pair that disagrees on its first two letters: butter / batter', function () {
  assert.equal(tm.matchTerms('butter', 'batter').tier, null);
  assert.equal(tm.isTypoPair('butter', 'batter'), false);
  // ... while still admitting the real case, so the guard is not just "off".
  assert.equal(tm.isTypoPair('glouester', 'gloucester'), true);
});

test('REFUSES matching ACROSS word boundaries: "bread" is not "shortbread"', function () {
  assert.equal(tm.matchTerms('bread', 'shortbread fingers').tier, null);
  assert.equal(tm.matchTerms('shortbread fingers', 'bread').tier, null);
});

test('REFUSES a short single-word key claiming a longer line: "cream" is not "ice cream"', function () {
  const m = tm.matchTerms('ice cream', 'cream');
  assert.equal(m.confident, false, 'a 5-letter single-token key must not establish identity by subset');
});

test('a shared word alone is ADVISORY, never confident', function () {
  // "Yazoo strawberry" shares "yazoo" with the chocolate alias. It is a real
  // different drink. It may earn a note; it may never be bought as the other.
  const strawberry = tm.matchTerms('Yazoo strawberry', 'choc yazoo');
  assert.equal(strawberry.tier, tm.TIER.SHARED_DISTINCTIVE);
  assert.equal(strawberry.confident, false);

  // "double cream" shares "double" with "double gloucester". Same again.
  const cream = tm.matchTerms('double cream', 'double gloucester');
  assert.equal(cream.tier, tm.TIER.SHARED_DISTINCTIVE);
  assert.equal(cream.confident, false);
});

test('every CONFIDENT tier is in CONFIDENT_TIERS and the advisory tier is not', function () {
  assert.equal(tm.CONFIDENT_TIERS.indexOf(tm.TIER.SHARED_DISTINCTIVE), -1,
    'the advisory tier must never be treated as confident');
  [tm.TIER.EXACT, tm.TIER.TOKEN_SET, tm.TIER.TYPO, tm.TIER.KEY_SUBSET].forEach(function (t) {
    assert.notEqual(tm.CONFIDENT_TIERS.indexOf(t), -1, t + ' should be confident');
  });
});

// ---------------------------------------------------------------------
// The live rule-12 / rule-25 pair. Verified live 2026-08-04:
//   rule 12  needs_decision  match_term "Nescafe Azera"
//   rule 25  needs_decision  match_term "Nescafe"
// The photographed line on 2026-08-03 was "bottle Azera coffee".
// ---------------------------------------------------------------------

test('LIVE CASE: "bottle Azera coffee" reaches rule 12 ("Nescafe Azera") at ADVISORY grade', function () {
  const m = tm.matchTerms('bottle Azera coffee', 'Nescafe Azera');
  assert.equal(m.tier, tm.TIER.SHARED_DISTINCTIVE);
  assert.equal(m.confident, false, 'it may hold the line and carry the reason; it must not name a product');
  assert.deepEqual(m.via, ['azera']);
});

test('LIVE CASE: "bottle Azera coffee" must NOT reach rule 25 ("Nescafe") at any grade', function () {
  const m = tm.matchTerms('bottle Azera coffee', 'Nescafe');
  assert.equal(m.tier, null, 'the line and the term share nothing; a bare overlap threshold would still fire');
});

// ---------------------------------------------------------------------
// The distance primitive, asserted directly.
// ---------------------------------------------------------------------

test('isOneEditApart answers exactly one edit, never "close enough"', function () {
  assert.equal(tm.isOneEditApart('gloucester', 'glouester'), true);   // one deletion
  assert.equal(tm.isOneEditApart('butter', 'batter'), true);          // one substitution
  assert.equal(tm.isOneEditApart('cat', 'cat'), false);               // identical is not one edit
  assert.equal(tm.isOneEditApart('lemon', 'melon'), false);           // two substitutions
  assert.equal(tm.isOneEditApart('abc', 'abcde'), false);             // two insertions
});

test('bestMatch returns the STRONGEST tier across a set of aliases', function () {
  const aliases = ['chocolate yazoo', 'choc yazoo', 'choc yazoos'];
  assert.equal(tm.bestMatch('choc yazoo', aliases).tier, tm.TIER.EXACT);
  assert.equal(tm.bestMatch('2 yazoo choc', aliases).tier, tm.TIER.TOKEN_SET);
  assert.equal(tm.bestMatch('nothing like it', aliases).tier, null);
});

test('empty and junk input match nothing rather than everything', function () {
  assert.equal(tm.matchTerms('', 'choc yazoo').tier, null);
  assert.equal(tm.matchTerms('choc yazoo', '').tier, null);
  assert.equal(tm.matchTerms(null, null).tier, null);
  assert.equal(tm.matchTerms('...', '---').tier, null);
});
