// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/quantityRule.test.js
//
// WO-2026-08-12-02 (WP-B15-30), AC1. The Work Order's own instruction:
// "unit-test each of the four cases above BY NAME". Warwick's four examples
// are therefore individually named test cases, not rows in a loop - a named
// failure says which of his rulings broke.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveQuantity, QUANTITY_BASIS, HOUSEHOLD_DEFAULT_QUANTITY,
} from './quantityRule.js';

// ── WARWICK'S FOUR EXAMPLES, BY NAME (AC1) ────────────────────────────────

test('AC1 Warwick example 1: "Richmond 16 sausages" -> 1 pack of the 16-count product, NOT 16', () => {
  const r = resolveQuantity({ asWritten: 'Richmond 16 sausages' });
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
  assert.equal(r.evidence, null, 'the 16 is pack identity and must never register as evidence');
});

test('AC1 Warwick example 2: "Ariel Pods 33" -> 1 pack of the 33-count product, NOT 33', () => {
  const r = resolveQuantity({ asWritten: 'Ariel Pods 33' });
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
  assert.equal(r.evidence, null);
});

test('AC1 Warwick example 3: "Cravendale milk x4" -> 4 bottles, from the explicit multiplier', () => {
  const r = resolveQuantity({ asWritten: 'Cravendale milk x4' });
  assert.equal(r.quantity, 4);
  assert.equal(r.basis, QUANTITY_BASIS.EXPLICIT);
  assert.equal(r.evidence, 4);
});

test('AC1 Warwick example 4: "Cravendale milk" -> 1 bottle, the household default', () => {
  const r = resolveQuantity({ asWritten: 'Cravendale milk' });
  assert.equal(r.quantity, HOUSEHOLD_DEFAULT_QUANTITY);
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
});

// ── THE RULE'S THREE BOUNDARIES ───────────────────────────────────────────

test('AC1: a leading count on the page is explicit evidence - "2 chips with skins on" -> 2', () => {
  const r = resolveQuantity({ asWritten: '2 chips with skins on' });
  assert.equal(r.quantity, 2);
  assert.equal(r.basis, QUANTITY_BASIS.EXPLICIT);
});

test('AC1: page evidence OVERRIDES the model - the model saying 1 cannot beat a written "3"', () => {
  const r = resolveQuantity({ asWritten: '3 Yazoo strawberry milk shake', reportedQuantity: 1 });
  assert.equal(r.quantity, 3);
  assert.equal(r.basis, QUANTITY_BASIS.EXPLICIT);
  assert.equal(r.modelDisagreed, true, 'the disagreement must be visible, not swallowed');
});

test('AC1: the Richmond CLASS - a model quantity with no page evidence is DISCARDED and reported', () => {
  // The exact failure Warwick named: a pack size lifted out of the product's
  // own name and returned as a purchase count.
  const r = resolveQuantity({ asWritten: 'Richmond 16 skinless pork sausages', reportedQuantity: 16 });
  assert.equal(r.quantity, 1, 'the household default replaces the inferred pack size');
  assert.equal(r.modelQuantity, 16, 'what the model claimed is retained as evidence about the model');
  assert.equal(r.modelDisagreed, true);
});

test('AC1: the default NEVER applies to a non-purchase line - NOT_A_LINE gets null, not 1', () => {
  const r = resolveQuantity({ asWritten: 'Shopping list', isPurchaseLine: false });
  assert.equal(r.quantity, null);
  assert.equal(r.basis, QUANTITY_BASIS.NOT_A_PURCHASE);
});

test('AC1: every resolution states its basis - a 1 from the default is never indistinguishable from a written 1', () => {
  const written = resolveQuantity({ asWritten: '1 pkt roast beef' });
  const defaulted = resolveQuantity({ asWritten: 'Lurpak butter' });
  assert.equal(written.quantity, 1);
  assert.equal(defaulted.quantity, 1);
  assert.notEqual(written.basis, defaulted.basis,
    'two 1s reached differently MUST be distinguishable, or the default becomes invisible');
  assert.equal(written.basis, QUANTITY_BASIS.EXPLICIT);
  assert.equal(defaulted.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
});

test('AC1: an empty or missing reading still resolves to the household default, never to null', () => {
  assert.equal(resolveQuantity({ asWritten: '' }).quantity, 1);
  assert.equal(resolveQuantity({}).quantity, 1);
});

// ── THE PLAUSIBILITY BOUND, found by this file's own sibling test ──────────
// Regression pin: moving the quantity decision INTO this rule briefly
// reinstated a defect the pipeline had already fixed - "900 milk" parses as a
// leading count of 900 and was returned as explicit evidence. The bound lives
// here now, and MAX_PLAUSIBLE_QUANTITY is imported rather than restated.

test('AC1: an IMPLAUSIBLE leading count is refused, and the refusal is visible - never a silent 900', () => {
  const r = resolveQuantity({ asWritten: '900 milk', reportedQuantity: 900 });
  assert.notEqual(r.quantity, 900);
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.REFUSED_IMPLAUSIBLE);
  assert.equal(r.refusedEvidence, 900, 'the refused reading must stay visible to a human');
});

test('AC1: "the page said nothing" and "the page said something unbelievable" are DIFFERENT states', () => {
  const nothing = resolveQuantity({ asWritten: 'Lurpak butter' });
  const unbelievable = resolveQuantity({ asWritten: '900 milk' });
  assert.equal(nothing.quantity, unbelievable.quantity, 'both land on the household default');
  assert.notEqual(nothing.basis, unbelievable.basis, 'and must remain distinguishable');
});

test('AC1: a plausible bulk count at the ceiling still survives as page evidence', () => {
  const r = resolveQuantity({ asWritten: '24 yazoo' });
  assert.equal(r.quantity, 24);
  assert.equal(r.basis, QUANTITY_BASIS.EXPLICIT);
});
