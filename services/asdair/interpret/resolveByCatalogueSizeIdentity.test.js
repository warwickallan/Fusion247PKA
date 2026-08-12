// =====================================================================
// BUILD-015 AsdAIr Stage 1 - resolveByCatalogueSizeIdentity.test.js
//
// WO-2026-08-12-B15-VISION-02, AC3 proof. File surface granted by
// AMENDMENT 1 (Larry, 2026-08-12, after Keel's round-2 read-back CLARIFY) -
// this file and services/asdair/interpret/resolveByCatalogue.js were both
// widened onto the order after the original file_surface named only
// groundedPrompt.js in this directory. Narrowly scoped to the size/identity
// confusion bug, per that amendment's own instruction.
//
// THE REAL DIAGNOSTIC-RUN CONFUSION, reproduced from the live scratchpad
// capture (asdair-vision-test/new-pipeline-output.json): the raw reading
// "1 pkt ASDA semi skimmed milk 6 pints" wrongly resolved to "Cravendale
// Arla Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer" instead of
// "ASDA British Milk Semi Skimmed 6 Pints" - two DIFFERENT products, sharing
// almost every descriptive word, at two DIFFERENT sizes. The two catalogue
// rows below (ids 2 and 4) are the REAL live household rows, copied
// verbatim from catalogueGrounding.test.js's own "faithful slice of the
// REAL household catalogue" fixture, so this is a reproduction of the ACTUAL
// bug, not an invented approximation of it.
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveReading, sizeToken, regularSizeTokens, sizeCompatible,
} = require('./resolveByCatalogue.js');

// The REAL live household rows (catalogueGrounding.test.js REGULARS ids 2
// and 4, copied verbatim) - the exact two products the diagnostic run
// confused.
const MILK_REGULARS = [
  { id: 2, name: 'ASDA British Milk Semi Skimmed 6 Pints', brand: 'ASDA',
    aka: ['6pt milk', '6pts milk', 'franks 6 pint'] },
  { id: 4, name: 'Cravendale Arla  Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer', brand: 'Cravendale',
    aka: ['arla 4pt milk', 'arla 4pt', 'arla semi', 'milk'] },
];

// ---------------------------------------------------------------------
// THE EXACT DIAGNOSTIC-RUN REGRESSION
// ---------------------------------------------------------------------

test('AC3 acceptance_property: the EXACT diagnostic-run reading resolves to the 6-pint regular, not the 2L one', () => {
  const r = resolveReading('1 pkt ASDA semi skimmed milk 6 pints', MILK_REGULARS);
  assert.equal(r.status, 'matched', 'the correctly-sized regular genuinely exists in the catalogue - this must resolve, not ask');
  assert.equal(r.matched_regular_id, 2, 'must reach the 6-pint ASDA regular');
  assert.notEqual(r.matched_regular_id, 4, 'must NEVER resolve to the differently-sized 2L Cravendale regular');
});

test('AC3: the REVERSE case also resolves correctly - a 2L reading never wrongly reaches the 6-pint regular', () => {
  const r = resolveReading('2L semi skimmed milk', MILK_REGULARS);
  assert.notEqual(r.matched_regular_id, 2, 'a 2L reading must never resolve to the 6-pint regular');
});

test('AC3: WITHOUT a correctly-sized alternative in the catalogue, a size-mismatched reading is honestly UNMATCHED, never silently wrong', () => {
  // Only the 2L regular exists here - proving the guard actively EXCLUDES
  // the wrong-size candidate rather than merely deprioritising it. A
  // household should be ASKED, not silently sold the wrong size.
  const cravendaleOnly = [MILK_REGULARS[1]];
  const r = resolveReading('1 pkt ASDA semi skimmed milk 6 pints', cravendaleOnly);
  assert.notEqual(r.matched_regular_id, 4, 'the size-mismatched candidate must never become the sole confident match');
  assert.ok(r.status === 'unmatched_new_item' || r.status === 'needs_confirmation',
    'an honest "I do not know" beats a confidently wrong size - never a silently wrong purchase');
});

test('AC3: the household\'s own messy real data (name says 2L, alias says 4pt) is still honoured for its OWN size', () => {
  // Regular id 4's name says "2L" but its alias list says "arla 4pt milk" -
  // real, live, slightly inconsistent household data. A reading that
  // matches the ALIAS's size claim must still resolve to id 4; the guard is
  // lenient across a candidate's own recorded forms, not just its name.
  const r = resolveReading('4 pints Arla semi skimmed', MILK_REGULARS);
  assert.equal(r.matched_regular_id, 4, 'the alias\'s own "4pt" size claim is honoured, even though the name says 2L');
});

// ---------------------------------------------------------------------
// The pure size-token helpers, in isolation
// ---------------------------------------------------------------------

test('sizeToken: extracts volume/weight units in several real spellings', () => {
  assert.equal(sizeToken('ASDA Semi Skimmed 6 Pints'), '6pt');
  assert.equal(sizeToken('6pt milk'), '6pt');
  assert.equal(sizeToken('6pts milk'), '6pt');
  assert.equal(sizeToken('Cravendale...2L Fresher for Longer'), '2l');
  assert.equal(sizeToken('Coca-Cola 1.5L'), '1.5l');
  assert.equal(sizeToken('450g'), '450g');
  assert.equal(sizeToken('1.5kg bag'), '1.5kg');
});

test('sizeToken: no unit present is null, not a guess', () => {
  assert.equal(sizeToken('milk'), null);
  assert.equal(sizeToken('Richmond 16 Pork Sausages'), null, 'a bare pack-count number with no unit is not a size claim');
});

test('sizeToken: "pk"/"pack" is DELIBERATELY not a size unit - it is a purchase-count marker, AC1\'s concern, not AC3\'s', () => {
  assert.equal(sizeToken('1 pk small Mars bars'), null);
  assert.equal(sizeToken('4 pk kitchen roll'), null);
});

test('regularSizeTokens: collects DISTINCT size tokens from name and every alias', () => {
  assert.deepEqual(regularSizeTokens(MILK_REGULARS[0]), ['6pt']);
  assert.deepEqual(regularSizeTokens(MILK_REGULARS[1]), ['2l', '4pt']);
});

test('regularSizeTokens: a regular with no size information anywhere returns an empty list', () => {
  assert.deepEqual(regularSizeTokens({ name: 'Black Pepper', aka: ['pepper'] }), []);
});

test('sizeCompatible: a reading with NO size claim is compatible with everything', () => {
  assert.equal(sizeCompatible(null, MILK_REGULARS[0]), true);
  assert.equal(sizeCompatible(null, MILK_REGULARS[1]), true);
});

test('sizeCompatible: a candidate with NO recorded size is never excluded, regardless of the reading\'s claim', () => {
  assert.equal(sizeCompatible('6pt', { name: 'Black Pepper', aka: [] }), true);
});

test('sizeCompatible: a candidate whose recorded size DISAGREES is excluded', () => {
  assert.equal(sizeCompatible('6pt', MILK_REGULARS[1]), false, '2L/4pt disagrees with 6pt');
  assert.equal(sizeCompatible('2l', MILK_REGULARS[0]), false, '6pt disagrees with 2l');
});

test('sizeCompatible: a candidate whose recorded size AGREES (via name OR alias) is compatible', () => {
  assert.equal(sizeCompatible('6pt', MILK_REGULARS[0]), true);
  assert.equal(sizeCompatible('2l', MILK_REGULARS[1]), true, 'agrees via the name');
  assert.equal(sizeCompatible('4pt', MILK_REGULARS[1]), true, 'agrees via an alias, even though the name says 2L');
});

// ---------------------------------------------------------------------
// The guard must not break identity resolution for products that carry NO
// size information at all - the overwhelming majority of the catalogue.
// ---------------------------------------------------------------------

test('REGRESSION: an ordinary reading with no size claim resolves exactly as before this Work Order', () => {
  const r = resolveReading('black pepper', [{ id: 106, name: 'COOK by ASDA Cook Ground Black Pepper 25g', aka: ['black pepper', 'pepper'] }]);
  assert.equal(r.status, 'matched');
  assert.equal(r.matched_regular_id, 106);
});
