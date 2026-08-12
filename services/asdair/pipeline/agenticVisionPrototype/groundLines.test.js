// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/groundLines.test.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC3-AC8: proofs for the application-side
// grounding contract, including the AC4 MUTATION PROOF (an out-of-enum
// product_id driven through the validator, asserted to fail loudly).
//
// PURE - no network, no gateway, no database.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groundLines, assertProductIdsInEnum, checkSourceRegionMembership, markDuplicates, verbatimOf,
} from './groundLines.js';
import { UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';

const ENUM = ['7', '42', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE];
const REGIONS = [1, 2, 3];

function line(over = {}) {
  return {
    line_no: 1,
    as_written: '2 pints milk',
    visible_line: true,
    product_id: '7',
    source_region: 2,
    quantity: null,
    confidence: 0.9,
    ...over,
  };
}

// ── AC4: THE MUTATION PROOF ────────────────────────────────────────────
test('AC4 MUTATION PROOF: a product_id OUTSIDE the enum the application sent fails LOUDLY', () => {
  const escaped = [line(), line({ line_no: 2, product_id: 'Nivea Soft Moisturiser' })];
  assert.throws(
    () => assertProductIdsInEnum(escaped, ENUM),
    /SCHEMA ENFORCEMENT FAILURE.*Nivea Soft Moisturiser/s,
    'a deployment that has quietly stopped enforcing the schema must not be able to look healthy',
  );
  // ...and through the full grounding path, not only the bare validator.
  assert.throws(() => groundLines({ lines: escaped, productIdEnum: ENUM, regionNos: REGIONS }), /SCHEMA ENFORCEMENT FAILURE/);
});

test('AC4: a MISSING product_id is an escape too - absence is not "in the enum"', () => {
  assert.throws(() => assertProductIdsInEnum([line({ product_id: undefined })], ENUM), /SCHEMA ENFORCEMENT FAILURE/);
});

test('AC4: in-enum lines pass and report that the check actually ran', () => {
  assert.equal(assertProductIdsInEnum([line()], ENUM), true);
});

test('AC4: the unconstrained arm sends no enum, so the check reports NOT RUN rather than a false pass', () => {
  assert.equal(assertProductIdsInEnum([line({ product_id: undefined })], null), false);
  const out = groundLines({ lines: [line({ product_id: undefined })], productIdEnum: null, regionNos: REGIONS });
  assert.equal(out.enumVerified, false, 'a control that did not run must never be reported as a control that passed');
});

// ── AC5: MEMBERSHIP, NOT NULLNESS ──────────────────────────────────────
test('AC5: a source_region the application never supplied is REJECTED, not downgraded', () => {
  const out = groundLines({ lines: [line({ source_region: 9 })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(out.accepted.length, 0, 'a citation to a region that was never sent is evidence of nothing');
  assert.deepEqual(out.rejected[0].reasons, ['source_region_not_supplied']);
});

test('AC5: membership is stricter than the ported null-check - a non-null but unsupplied region still fails', () => {
  assert.equal(checkSourceRegionMembership({ source_region: 9 }, REGIONS), 'source_region_not_supplied');
  assert.equal(checkSourceRegionMembership({ source_region: null }, REGIONS), 'missing_source_region');
  assert.equal(checkSourceRegionMembership({ source_region: 2 }, REGIONS), null);
});

// ── AC3: THE TWO QUESTIONS ─────────────────────────────────────────────
test('AC3: visible_line false or NOT_A_LINE never becomes PHOTO truth', () => {
  const out = groundLines({
    lines: [line({ visible_line: false }), line({ line_no: 2, product_id: NOT_A_LINE })],
    productIdEnum: ENUM,
    regionNos: REGIONS,
  });
  assert.equal(out.accepted.length, 0);
  assert.equal(out.counts.notALine, 2);
});

test('AC3: an explicit UNKNOWN_VISIBLE_ITEM IS accepted as a seen line - an honest unknown is a successful outcome', () => {
  const out = groundLines({
    lines: [line({ product_id: UNKNOWN_VISIBLE_ITEM })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted.length, 1);
  assert.equal(out.accepted[0].identified, false);
  assert.equal(out.counts.unknownVisible, 1);
});

// ── AC6: CONFIDENCE TRIGGERS, NEVER ACCEPTS ────────────────────────────
test('AC6: a LOW-confidence line is still accepted - confidence is never acceptance authority', () => {
  const out = groundLines({ lines: [line({ confidence: 0.05 })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(out.accepted.length, 1, 'Terra can be confidently wrong, so its self-assessment cannot decide what is true');
  assert.equal(out.accepted[0].look_again, true);
  assert.deepEqual(out.lookAgainRegions, [2]);
});

test('AC6: a MISSING confidence is recorded as null and demotes nothing (the Number(null)===0 hazard)', () => {
  const out = groundLines({ lines: [line({ confidence: undefined })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(out.accepted.length, 1);
  assert.equal(out.accepted[0].confidence, null);
  assert.equal(out.accepted[0].look_again, false, 'a missing confidence must not become 0 and demote every matched line');
});

// ── AC7 (WP-B15-29) + AC1 (WP-B15-30): THE QUANTITY INVARIANT ──────────
//
// ⚠️ THE REQUIREMENT CHANGED HERE, THE PROOF DID NOT WEAKEN. Until WP-B15-30
// this test asserted `quantity === null` for the Richmond class. Warwick then
// ruled (Amendment 1, AC1) that the household default is ONE retail unit, so
// `null` is no longer the correct answer - `1` is. The invariant being
// protected is unchanged and is now asserted MORE strictly than before: the
// model's 16 must not survive, must be recorded as discarded, and the 1 that
// replaces it must be distinguishable from a 1 the page actually wrote.
// Three assertions where there was one.
test('AC7+AC1: a pack-size number inside the product name is DISCARDED, and the household default replaces it', () => {
  const out = groundLines({
    lines: [line({ as_written: 'Richmond 16 pork sausages', quantity: 16 })],
    productIdEnum: ENUM,
    regionNos: REGIONS,
  });
  const got = out.accepted[0];
  assert.notEqual(got.quantity, 16, '"16" names a 16-sausage pack, it is not an instruction to buy sixteen packs');
  assert.equal(got.quantity, 1, 'Warwick\'s household default: one retail unit');
  assert.equal(got.quantity_basis, 'household-default-one', 'the 1 must never look like a written 1');
  assert.equal(got.model_quantity, 16, 'what the model claimed stays visible as evidence about the model');
  assert.equal(got.model_quantity_disagreed, true);
  assert.ok(got.flags.includes('unjustified_quantity'), 'the detection flag itself must not regress');
});

test('AC7: a genuine LEADING count survives - the caution must not suppress a real quantity', () => {
  const out = groundLines({
    lines: [line({ as_written: '2 Yazoo choc', quantity: 2 })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted[0].quantity, 2);
  assert.deepEqual(out.accepted[0].flags, []);
});

test('AC7+AC1: an explicit multiplier survives, and an implausible quantity is REFUSED (not clamped, not kept)', () => {
  const ok = groundLines({ lines: [line({ as_written: 'yazoo x3', quantity: 3 })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(ok.accepted[0].quantity, 3);
  assert.equal(ok.accepted[0].quantity_basis, 'explicit-on-page');

  // "900 milk" reads as a leading count of 900, which is implausible. It is
  // flagged, and the number does NOT survive - it is neither kept nor clamped
  // to the ceiling. Under AC1 the line still resolves to the household
  // default rather than to null, because 900 is unusable, not absent.
  const silly = groundLines({ lines: [line({ as_written: '900 milk', quantity: 900 })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.notEqual(silly.accepted[0].quantity, 900, 'an implausible count must never survive');
  assert.ok(silly.accepted[0].flags.includes('implausible_quantity'));
});

// ── AC8: DUPLICATES SURFACE, NEVER VANISH ──────────────────────────────
test('AC8: SAME-region duplicates keep ONE survivor, chosen by first report - never by confidence', () => {
  const { lines, duplicateGroups } = markDuplicates([
    { line_no: 1, as_written: 'milk', product_id: '7', quantity: 2, source_region: 2, confidence: 0.1 },
    { line_no: 2, as_written: 'milk', product_id: '7', quantity: 2, source_region: 2, confidence: 0.99 },
  ]);
  assert.equal(duplicateGroups.length, 1);
  assert.equal(duplicateGroups[0].kind, 'same_region');
  assert.equal(lines[0].duplicate_of, null, 'the FIRST report survives - AC6 forbids confidence deciding this');
  assert.equal(lines[1].duplicate_of, 0);
});

test('AC8: CROSS-region collisions have NO survivor and every member is surfaced for a human', () => {
  const { lines, duplicateGroups } = markDuplicates([
    { line_no: 1, as_written: 'milk', product_id: '7', quantity: 2, source_region: 2, confidence: 0.4 },
    { line_no: 2, as_written: 'milk', product_id: '7', quantity: 2, source_region: 3, confidence: 0.9 },
  ]);
  assert.equal(duplicateGroups[0].kind, 'cross_region');
  assert.equal(duplicateGroups[0].survivorIndex, null, 'quietly picking one is how a real line disappears');
  assert.ok(lines.every((l) => l.duplicate_collision && l.needs_human));
  assert.ok(lines.every((l) => l.duplicate_of === null), 'nothing is deleted or superseded on a cross-region collision');
  assert.equal(duplicateGroups[0].members.length, 2, 'the collided candidate is preserved, not summarised away');
});

test('AC8: two REAL lines of the same product at DIFFERENT quantities are never collapsed', () => {
  const { duplicateGroups } = markDuplicates([
    { line_no: 1, as_written: '2 milk', product_id: '7', quantity: 2, source_region: 2 },
    { line_no: 2, as_written: '4 milk', product_id: '7', quantity: 4, source_region: 2 },
  ]);
  assert.deepEqual(duplicateGroups, [], 'the (product, quantity) key is what protects two genuine milk lines');
});

test('AC8: unidentified lines group on normalised verbatim text, not on a shared UNKNOWN token', () => {
  const { duplicateGroups } = markDuplicates([
    { line_no: 1, as_written: 'Bloo  loo   cleaner', product_id: UNKNOWN_VISIBLE_ITEM, quantity: null, source_region: 2 },
    { line_no: 2, as_written: 'bloo loo cleaner', product_id: UNKNOWN_VISIBLE_ITEM, quantity: null, source_region: 2 },
    { line_no: 3, as_written: 'something else entirely', product_id: UNKNOWN_VISIBLE_ITEM, quantity: null, source_region: 2 },
  ]);
  assert.equal(duplicateGroups.length, 1, 'two UNKNOWNs are not duplicates just because they are both UNKNOWN');
  assert.equal(duplicateGroups[0].members.length, 2);
});

// ── general ────────────────────────────────────────────────────────────
test('verbatimOf: reads either contract - as_written (constrained) or raw_reading (unconstrained)', () => {
  assert.equal(verbatimOf({ as_written: 'a' }), 'a');
  assert.equal(verbatimOf({ raw_reading: 'b' }), 'b');
  assert.equal(verbatimOf({}), '');
});

test('a line with no verbatim reading at all is rejected - there is nothing to check it against', () => {
  const out = groundLines({ lines: [line({ as_written: '   ' })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(out.accepted.length, 0);
  assert.ok(out.rejected[0].reasons.includes('no_verbatim_reading'));
});

test('counts reconcile: returned = accepted + rejected, always', () => {
  const out = groundLines({
    lines: [line(), line({ line_no: 2, source_region: 9 }), line({ line_no: 3, product_id: NOT_A_LINE })],
    productIdEnum: ENUM,
    regionNos: REGIONS,
  });
  assert.equal(out.counts.returned, 3);
  assert.equal(out.counts.accepted + out.counts.rejected, 3);
});
