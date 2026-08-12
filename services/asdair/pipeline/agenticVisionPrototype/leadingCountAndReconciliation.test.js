// =====================================================================
// BUILD-015 AsdAIr - WP-B15-31 regression suite
//
// Two defects, both MEASURED on the real Arm D artefact rather than imagined,
// and both pinned here with a mutation proof - a control nobody has watched
// fail is not evidence that it works.
//
//   AC1  the leading count written on the page was destroyed upstream of the
//        deterministic quantity rule. The rule is UNTOUCHED; the evidence
//        handed to it is repaired.
//
//   AC1b reconciliation merged two lines with DIFFERENT established identities
//        on text similarity alone, destroying three real purchases in one run,
//        and the accounting was never required to add up so nobody saw it.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { composeQuantityProbe, resolveQuantity, QUANTITY_BASIS, EVIDENCE_SOURCE } from './quantityRule.js';
import { reconcileAcrossBands, assertReconciliationCloses } from './bandInspection.js';
import { buildLineSchema } from './lineSchema.js';
import { leadingQuantityEvidence } from '../photoSanityChecks.js';

// ---------------------------------------------------------------------
// AC1 - the schema carries the mark as its own required field
// ---------------------------------------------------------------------

test('lineSchema: leading_mark is REQUIRED and nullable - strict mode admits no optional-by-omission field', () => {
  const schema = buildLineSchema({ candidates: [{ id: '1' }], regionNos: [2] });
  const item = schema.properties.lines.items;
  assert.ok(item.required.includes('leading_mark'), 'leading_mark must be in required');
  assert.deepEqual(item.properties.leading_mark.type, ['string', 'null']);
  assert.equal(item.additionalProperties, false);
  // Every declared property is required - the strict-mode rule this schema obeys.
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
});

// ---------------------------------------------------------------------
// AC1 - the probe repairs the INPUT and never the rule
// ---------------------------------------------------------------------

test('composeQuantityProbe: a bare mark is put back at the FRONT of the line, where the rule looks', () => {
  const probe = composeQuantityProbe('BLOO TOILET RIM', '2');
  assert.equal(probe.text, '2 BLOO TOILET RIM');
  assert.equal(probe.source, EVIDENCE_SOURCE.LEADING_MARK);
  // The rule itself is unchanged and is what actually reads the number.
  assert.equal(leadingQuantityEvidence(probe.text), 2);
});

test('composeQuantityProbe: a mark already at the front is not duplicated', () => {
  const probe = composeQuantityProbe('16 Richmond SKiNLESS PORK SAUSAGES', '16');
  assert.equal(probe.text, '16 Richmond SKiNLESS PORK SAUSAGES');
  assert.equal(leadingQuantityEvidence(probe.text), 16);
});

test('composeQuantityProbe: no mark leaves the reading exactly as it was (older contracts unaffected)', () => {
  const probe = composeQuantityProbe('MASHED POTATO', null);
  assert.equal(probe.text, 'MASHED POTATO');
  assert.equal(probe.source, EVIDENCE_SOURCE.AS_WRITTEN);
});

test('AC1 THE MEASURED FAILING LINE: "2 BLOO TOILET Rim" read as "BLOO TOILET RIM" now resolves to 2, not the default 1', () => {
  const withoutMark = resolveQuantity({ asWritten: 'BLOO TOILET RIM' });
  assert.equal(withoutMark.quantity, 1);
  assert.equal(withoutMark.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);

  const withMark = resolveQuantity({ asWritten: 'BLOO TOILET RIM', leadingMark: '2' });
  assert.equal(withMark.quantity, 2, 'the count written on the page must survive');
  assert.equal(withMark.basis, QUANTITY_BASIS.EXPLICIT);
  assert.equal(withMark.evidenceSource, EVIDENCE_SOURCE.LEADING_MARK);
});

test('AC1 THE CASCADE: a lost leading count let the PACK SIZE become the quantity - "2 4PK. LUCOZADE" read as "4 pk Lucozade"', () => {
  // The measured Arm D failure: expected 2, got a CONFIDENT 4 - worse than a
  // default, because it is a silent wrong number rather than a known unknown.
  const damaged = resolveQuantity({ asWritten: '4 pk Lucozade orange sport' });
  assert.equal(damaged.quantity, 4, 'this is the defect being fixed, pinned so it cannot come back unnoticed');

  const repaired = resolveQuantity({ asWritten: '4 pk Lucozade orange sport', leadingMark: '2' });
  assert.equal(repaired.quantity, 2, 'the page count wins over the pack size once it survives');
});

test('AC1 the household default still applies when the page genuinely carries no count', () => {
  const r = resolveQuantity({ asWritten: 'LENOR OUTDOOR', leadingMark: null });
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
});

test('AC1 the plausibility ceiling is NOT bypassed by the new field', () => {
  const r = resolveQuantity({ asWritten: 'milk', leadingMark: '900' });
  assert.equal(r.quantity, 1);
  assert.equal(r.basis, QUANTITY_BASIS.REFUSED_IMPLAUSIBLE);
  assert.equal(r.refusedEvidence, 900);
});

test('AC1 MUTATION: strip the leading mark and the repaired line silently reverts to the default', () => {
  const line = { asWritten: 'RUSTLERS SAUSAGE muffins', leadingMark: '2' };
  assert.equal(resolveQuantity(line).quantity, 2);
  // The mutation: the fix removed. The wrong answer must come back, or this
  // test was never sensitive to the thing it claims to protect.
  const mutated = { ...line, leadingMark: null };
  assert.equal(resolveQuantity(mutated).quantity, 1, 'MUTATION DID NOT BITE - this test proves nothing');
});

// ---------------------------------------------------------------------
// AC1b - reconciliation: identity VETOES a merge
// ---------------------------------------------------------------------

const line = (line_no, source_region, as_written, product_id, quantity) => ({
  line_no,
  source_region,
  as_written,
  product_id,
  identified: product_id !== 'UNKNOWN_VISIBLE_ITEM' && product_id !== null,
  quantity,
});

test('AC1b MEASURED: two Yazoo variants in the SAME band are two purchases, not one', () => {
  // Arm D destroyed this: "Yazoo strawberry milk shake" (59) absorbed
  // "Yazoo chocolate milk shake" (15) on text similarity alone.
  const { reconciled } = reconcileAcrossBands({
    lines: [
      line(12, 4, 'Yazoo strawberry milk shake', '59', 1),
      line(13, 4, 'Yazoo chocolate milk shake', '15', 1),
    ],
  });
  assert.equal(reconciled.length, 2, 'different established identities must never merge');
  assert.deepEqual(reconciled.map((l) => l.product_id).sort(), ['15', '59']);
});

test('AC1b MEASURED: the two TWIX products in one band survive as two lines', () => {
  const { reconciled } = reconcileAcrossBands({
    lines: [
      line(41, 7, '2 PKTS. TWIX ICECREAM BARS', '114', 2),
      line(42, 7, '1 PKT. TWIX CHOC BISCUIT BARS', '115', 1),
    ],
  });
  assert.equal(reconciled.length, 2);
});

test('AC1b MEASURED: two different milks read almost identically still survive as two lines', () => {
  const { reconciled } = reconcileAcrossBands({
    lines: [
      line(46, 8, 'x 4pts. ARLA SEMI SKIMMED MILK', '4', 1),
      line(47, 8, 'x 6pts. ASDA SEMI SKIMMED MILK', '2', 1),
    ],
  });
  assert.equal(reconciled.length, 2);
});

test('AC1b the genuine overlap duplicate STILL merges - the fix must not disable deduplication', () => {
  const { reconciled, merges } = reconcileAcrossBands({
    lines: [
      line(36, 7, 'MASHED POTATO', '72', 1),
      line(50, 8, 'MASHED POTATO', '72', 1),
    ],
  });
  assert.equal(reconciled.length, 1, 'the same product at the same quantity in adjacent bands is ONE line');
  assert.equal(merges.length, 1);
  assert.deepEqual(reconciled[0].seen_in_regions, [7, 8]);
});

test('AC1b the fragment case STILL merges - same identity, one page line split in two by the model', () => {
  const { reconciled } = reconcileAcrossBands({
    lines: [
      line(3, 2, 'SUPERGLUE', '116', 1),
      line(4, 2, 'LOCTITE', '116', 1),
    ],
  });
  assert.equal(reconciled.length, 1);
});

test('AC1b same product, DIFFERENT quantity, remains two real lines (the design doc worked example)', () => {
  const { reconciled } = reconcileAcrossBands({
    lines: [line(1, 2, '2 milk', '4', 2), line(2, 2, '4 milk', '4', 4)],
  });
  assert.equal(reconciled.length, 2);
});

test('AC1b non-adjacent bands are never merged - a page may carry the same item twice', () => {
  const { reconciled } = reconcileAcrossBands({
    lines: [line(1, 2, 'MASHED POTATO', '72', 1), line(2, 6, 'MASHED POTATO', '72', 1)],
  });
  assert.equal(reconciled.length, 2);
});

// ---------------------------------------------------------------------
// AC1b - the accounting is CLOSED and the assertion is proved to fire
// ---------------------------------------------------------------------

test('AC1b accounting closes: every accepted line survives or is absorbed into a named survivor', () => {
  const lines = [
    line(1, 2, 'MASHED POTATO', '72', 1),
    line(2, 3, 'MASHED POTATO', '72', 1),
    line(3, 3, 'Yazoo strawberry milk shake', '59', 1),
    line(4, 3, 'Yazoo chocolate milk shake', '15', 1),
  ];
  const out = reconcileAcrossBands({ lines });
  assert.equal(out.accounting.accepted, 4);
  assert.equal(out.accounting.survived + out.accounting.absorbed, 4);
  assert.equal(out.accounting.closes, true);
  assert.equal(out.reconciled.length, 3);
  assert.equal(out.merges.length, 1);
});

test('AC1b MUTATION: a line that vanishes with no disposition makes the assertion FIRE', () => {
  const reconciled = [{ line_no: 1 }, { line_no: 2 }];
  const merges = [{ kept_line_no: 1, merged_line_no: 3 }];
  // 2 survived + 1 absorbed = 3, and that is the honest state.
  assert.equal(assertReconciliationCloses({ inputCount: 3, reconciled, merges }), true);
  // The mutation: a fourth line went in and came out nowhere. This is EXACTLY
  // the Arm D shape - 49 in, 38 out, nothing saying where the rest went.
  assert.throws(
    () => assertReconciliationCloses({ inputCount: 4, reconciled, merges }),
    /ACCOUNTING DOES NOT CLOSE/,
    'MUTATION DID NOT BITE - the accounting assertion is decorative',
  );
});

test('AC1b MUTATION: absorbing a line into a survivor that was itself removed FIRES', () => {
  assert.throws(
    () => assertReconciliationCloses({
      inputCount: 2,
      reconciled: [{ line_no: 1 }],
      merges: [{ kept_line_no: 99, merged_line_no: 2 }],
    }),
    /not among the survivors/,
  );
});

test('AC1b MUTATION: the same line absorbed twice FIRES - buckets must be exclusive', () => {
  assert.throws(
    () => assertReconciliationCloses({
      inputCount: 3,
      reconciled: [{ line_no: 1 }],
      merges: [{ kept_line_no: 1, merged_line_no: 2 }, { kept_line_no: 1, merged_line_no: 2 }],
    }),
    /absorbed more than once/,
  );
});

test('AC1b the fullest reading is RECORDED when the survivor is not the best one', () => {
  // Arm D kept "1 box" and absorbed "1 BOX ASDA FRUIT LOLLY ICE B.". The
  // survivor is simply whichever arrived first. Reported, not silently swapped.
  const out = reconcileAcrossBands({
    lines: [
      line(17, 5, '1 box', 'UNKNOWN_VISIBLE_ITEM', 1),
      line(34, 6, '1 box ASDA FRUIT LOLLY ICE B.', 'UNKNOWN_VISIBLE_ITEM', 1),
    ],
  });
  assert.equal(out.reconciled.length, 1);
  assert.equal(out.reconciled[0].fullest_reading, '1 box ASDA FRUIT LOLLY ICE B.');
  assert.equal(out.reconciled[0].survivor_is_fullest, false);
  assert.equal(out.survivorsNotFullestReading, 1);
});
