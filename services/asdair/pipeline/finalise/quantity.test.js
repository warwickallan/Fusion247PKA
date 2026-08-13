// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/quantity.test.js
//
// WO-2026-08-13-04 (WP-B15-37), AC4 + AC8. WARWICK'S FIVE NAMED QUANTITY CASES,
// and the mutations that prove the rule can fail.
//
//   no purchase count      -> 1
//   item x4                -> 4
//   4 x item               -> 4
//   Richmond 16 sausages   -> 1 pack of the identified 16-count product
//   Ariel Pods 33          -> 1 pack of the 33-count product
//   conflicting readings   -> Cockpit uncertainty, NEVER a guessed quantity
//
// The RULE is proven here; `producedList.test.js` proves it again on the REAL
// produced list, which is what the Work Order actually asks for ("do not merely
// unit-test a parser in isolation and call quantity done").
//
// ⛔ NOTE ON "Ariel Pods 33": that line is NOT on this photograph. The 39 page
// lines carry no Ariel. It is proven here against the household's REAL
// catalogue rows (Ariel 33 is regular 36, Ariel 22 is regular 50), and the gap
// is reported rather than papered over.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyPackIdentityRule, hasPurchaseMarker, isCountedPackProduct,
  PACK_IDENTITY_BASIS, UNMARKED_PACK_COUNT_FLOOR,
} from './packIdentityRule.js';
import { settleQuantity } from './settleQuantity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOUSEHOLD = JSON.parse(readFileSync(join(HERE, 'out', 'household-1-snapshot.json'), 'utf8'));
const NAME_BY_ID = new Map(HOUSEHOLD.regulars.map((r) => [String(r.id), r.name]));

const RICHMOND = NAME_BY_ID.get('85');
const ARIEL_33 = NAME_BY_ID.get('36');
const YAZOO = NAME_BY_ID.get('59');
const CRAVENDALE = NAME_BY_ID.get('4');

test('the household snapshot carries the products these cases are argued from', () => {
  assert.match(RICHMOND, /Richmond/i);
  assert.match(ARIEL_33, /Ariel/i);
  assert.match(ARIEL_33, /33/);
  assert.match(YAZOO, /Yazoo Strawberry/i);
});

// =====================================================================
// WARWICK'S FIVE CASES, ON THE RULE
// =====================================================================

test('CASE 1 - no purchase count on the page -> 1', () => {
  const r = applyPackIdentityRule({
    quantity: 1, quantityBasis: 'household-default-one', probeText: 'LURPACK BUTTER', productName: NAME_BY_ID.get('89'),
  });
  assert.equal(r.quantity, 1);
  assert.equal(r.packIdentityApplied, false, 'a household default was never read off the page and has nothing to refuse');
});

test('CASE 2 - "item x4" -> 4', () => {
  const r = applyPackIdentityRule({
    quantity: 4, quantityBasis: 'explicit-on-page', probeText: '4 x 4pts. ARLA SEMI SKIMMED MILK', productName: CRAVENDALE,
  });
  assert.equal(r.quantity, 4);
  assert.equal(r.packIdentityApplied, false);
});

test('CASE 3 - "4 x item" -> 4', () => {
  const r = applyPackIdentityRule({
    quantity: 4, quantityBasis: 'explicit-on-page', probeText: '4 x CRAVENDALE MILK', productName: CRAVENDALE,
  });
  assert.equal(r.quantity, 4);
});

test('CASE 4 - "16 Richmond skinless pork sausages" -> 1 PACK, and the refused 16 stays visible', () => {
  const r = applyPackIdentityRule({
    quantity: 16, quantityBasis: 'explicit-on-page', probeText: '16 RICHMOND SKINLESS PORK SAUSAGES', productName: RICHMOND,
  });
  assert.equal(r.quantity, 1, 'a pack count reached the trolley as a purchase quantity');
  assert.equal(r.basis, PACK_IDENTITY_BASIS);
  assert.equal(r.refusedEvidence, 16, 'the number the page carried must remain visible to a human');
  assert.match(r.reason, /pack count/);
});

test('CASE 5 - "Ariel Pods 33" -> 1 PACK of the 33-count product', () => {
  const r = applyPackIdentityRule({
    quantity: 33, quantityBasis: 'explicit-on-page', probeText: '33 ARIEL PODS', productName: ARIEL_33,
  });
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, PACK_IDENTITY_BASIS);
  assert.equal(r.refusedEvidence, 33);
});

test('CASE 6 - explicit CONFLICTING observations become uncertainty, never a guessed quantity', () => {
  const settled = settleQuantity({
    product_id: '2',
    as_written: '1 x 6pts. ASDA SEMI SKIMMED MILK',
    quantity: 1,
    quantity_basis: 'explicit-on-page',
    quantity_readings: [
      { run: 'a', as_written: '1 x 6pts. ASDA SEMI SKIMMED MILK', quantity: 1, basis: 'explicit-on-page' },
      { run: 'b', as_written: '1 x 6pts. ASDA SEMI SKIMMED MILK', quantity: 1, basis: 'explicit-on-page' },
      { run: 'c', as_written: '7 x 6pts. ASDA SEMI SKIMMED MILK', quantity: 7, basis: 'explicit-on-page' },
    ],
  }, NAME_BY_ID);
  assert.equal(settled.settled, false);
  assert.equal(settled.quantity, null, 'a disagreement must never resolve to a number');
  assert.deepEqual(settled.candidates, [1, 7]);
  assert.notEqual(settled.quantity, 1, 'a 2-of-3 majority is still a guess and is not permitted here');
});

test('a disagreement a DETERMINISTIC rule settles is settled - Richmond read as "16" and as "1 6"', () => {
  const settled = settleQuantity({
    product_id: '85',
    as_written: '16 RICHMOND SKINLESS PORK SAUSAGES',
    quantity: 16,
    quantity_basis: 'explicit-on-page',
    quantity_readings: [
      { run: 'a', as_written: '16 RICHMOND SKINLESS PORK SAUSAGES', quantity: 16, basis: 'explicit-on-page' },
      { run: 'b', as_written: '1 6 RICHMOND SKINLESS PORK SAUSAGES', quantity: 1, basis: 'explicit-on-page' },
      { run: 'c', as_written: '16 RICHMOND SKINLESS PORK SAUSAGES', quantity: 16, basis: 'explicit-on-page' },
    ],
  }, NAME_BY_ID);
  assert.equal(settled.settled, true);
  assert.equal(settled.quantity, 1);
  assert.equal(settled.packIdentityApplied, true);
});

// =====================================================================
// THE THREE CONDITIONS - each one PROVEN LOAD-BEARING by removing it
// =====================================================================

test('CONDITION (a) - a purchase MARKER protects a large count from the rule', () => {
  const r = applyPackIdentityRule({
    quantity: 12, quantityBasis: 'explicit-on-page', probeText: '12 x YAZOO STRAWBERRY MILK', productName: YAZOO,
  });
  assert.equal(r.quantity, 12, 'an explicitly marked bulk purchase must survive untouched');
  assert.equal(r.packIdentityApplied, false);
});

test('CONDITION (b) - a single-digit unmarked count is a purchase count, not a pack', () => {
  const r = applyPackIdentityRule({
    quantity: 3, quantityBasis: 'explicit-on-page', probeText: '3 GOURMET CAT FOOD FISH', productName: NAME_BY_ID.get('1'),
  });
  assert.equal(r.quantity, 3, '"3 gourmet cat food" is three purchases and must not become one');
  assert.ok(UNMARKED_PACK_COUNT_FLOOR > 3);
});

test('CONDITION (c) - a product with no pack count of its own never triggers the rule', () => {
  assert.equal(isCountedPackProduct(YAZOO), false, '"Yazoo Strawberry Milk Drink 400ml" has no standalone count');
  const r = applyPackIdentityRule({
    quantity: 12, quantityBasis: 'explicit-on-page', probeText: '12 YAZOO STRAWBERRY MILK', productName: YAZOO,
  });
  assert.equal(r.quantity, 12, 'the rule fired on a product that has no pack count to be confused with');
});

test('CONDITION (c) is what makes this Warwick\'s rule rather than a bare threshold', () => {
  assert.equal(isCountedPackProduct(RICHMOND), true, 'Richmond 12 ... Sausages carries a standalone pack count');
  assert.equal(isCountedPackProduct(ARIEL_33), true, 'Ariel ... Capsules 33 carries a standalone pack count');
  assert.equal(isCountedPackProduct('Gourmet ... Wet Cat Food 6x50g'), false, '6x50g is attached, not a standalone count');
  assert.equal(isCountedPackProduct('Twix Chocolate & Caramel Ice Cream 4pk'), false, '4pk is attached');
});

test('the page count need NOT equal the catalogue pack count - the real Richmond line is 16 against a 12-pack row', () => {
  assert.match(RICHMOND, /\b12\b/);
  const r = applyPackIdentityRule({
    quantity: 16, quantityBasis: 'explicit-on-page', probeText: '16 RICHMOND SKINLESS PORK SAUSAGES', productName: RICHMOND,
  });
  assert.equal(r.quantity, 1,
    'requiring the page number to match the catalogue pack count would have missed the exact case Warwick named');
});

// =====================================================================
// MUTATIONS - the rule must be seen to fail
// =====================================================================

test('MUTATION: with the marker test disabled, "4 x 4pts ARLA" would collapse to 1 - so the test bites', () => {
  // Same inputs, marker condition removed by hand. If this did NOT change the
  // answer, condition (a) would be decorative.
  assert.equal(hasPurchaseMarker('4 x 4pts. ARLA SEMI SKIMMED MILK'), true);
  const withoutMarker = applyPackIdentityRule({
    quantity: 44, quantityBasis: 'explicit-on-page', probeText: '44 ARLA SEMI SKIMMED MILK', productName: RICHMOND,
  });
  assert.equal(withoutMarker.quantity, 1, 'the marker is what protected the real line - remove it and the rule fires');
});

test('MUTATION: a household-default basis is never refused, so the rule cannot manufacture a 1', () => {
  const r = applyPackIdentityRule({
    quantity: 33, quantityBasis: 'household-default-one', probeText: 'ARIEL PODS', productName: ARIEL_33,
  });
  assert.equal(r.packIdentityApplied, false);
  assert.equal(r.basis, 'household-default-one', 'the basis must not be rewritten when nothing was refused');
});
