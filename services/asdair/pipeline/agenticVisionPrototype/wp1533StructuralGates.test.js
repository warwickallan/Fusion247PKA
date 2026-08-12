// =====================================================================
// BUILD-015 AsdAIr - WP-B15-33 structural gates and their mutation proofs.
//
// WO-2026-08-12-06 AC7: "mutation-prove the deterministic invariants... A gate
// no test can fail is not a gate."
//
// Every guard below is proved TWICE, and the second half is the one that
// matters:
//
//   1. the guard produces its protective outcome on the real shape of input;
//   2. the DISCRIMINATING EVIDENCE is removed or inverted, and the protection
//      demonstrably disappears.
//
// Half 2 exists because half 1 alone cannot distinguish "the guard worked"
// from "nothing was ever going to go wrong here". Each mutation therefore
// carries an explicit MUTATION DID NOT BITE assertion: if the mutated input
// still produces the protected outcome, the test fails and says that the test
// proves nothing - rather than passing quietly and being counted as coverage.
//
// This follows the pattern already established in this suite
// (`leadingCountAndReconciliation.test.js` AC1/AC1b) and does not invent a new
// one. The mutation is applied to the INPUT, never to the source file on disk:
// an interrupted source-mutation run leaves the module mutated, which has
// already cost this estate a real incident.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileAcrossBands, markDisputedCounts } from './bandInspection.js';
import { groundLines, markDuplicates, NEEDS_HUMAN } from './groundLines.js';
import { applyVisualEvidenceGate, PROVENANCE, absolutePosition } from './visualEvidenceGate.js';
import { buildLineSchema, buildProductIdEnum, UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';
import { resolveQuantity, QUANTITY_BASIS } from './quantityRule.js';

/** The application's own band rectangles, in the real shape and real axis. */
const REGIONS = [
  { region_no: 1, region_kind: 'full_page' },
  { region_no: 2, region_kind: 'strip', pixel_left: 0, pixel_right: 100, pixel_top: 192, pixel_bottom: 991 },
  { region_no: 3, region_kind: 'strip', pixel_left: 80, pixel_right: 180, pixel_top: 192, pixel_bottom: 991 },
  { region_no: 4, region_kind: 'strip', pixel_left: 160, pixel_right: 260, pixel_top: 192, pixel_bottom: 991 },
  { region_no: 8, region_kind: 'strip', pixel_left: 480, pixel_right: 576, pixel_top: 192, pixel_bottom: 991 },
];
const AXIS = 'x';
const PITCH = 15.54054054054054;

/** One accepted line, in `groundLines()`'s output shape. */
function line(over = {}) {
  return {
    line_no: 1,
    as_written: '1 THING',
    visible_line: true,
    product_id: '7',
    identified: true,
    source_region: 2,
    quantity: 1,
    quantity_basis: QUANTITY_BASIS.EXPLICIT,
    leading_mark: '1',
    confidence: 0.9,
    flags: [],
    duplicate_of: null,
    duplicate_collision: false,
    needs_human: false,
    needs_human_reasons: [],
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AC7 PROOF 1 - THE SAME PHYSICAL SOURCE LINE COLLAPSES TO ONE
// ═══════════════════════════════════════════════════════════════════════

test('AC7 PROOF 1: two observations of ONE source line in overlapping bands collapse to ONE purchase', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, source_region: 2, as_written: '1 PRINCES LEAN CORNED BEEF' }),
      line({ line_no: 2, source_region: 3, as_written: '1 PRINCES LEAN CORNED BEEF.' }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(out.reconciled.length, 1, 'one physical line seen twice is ONE purchase');
  assert.equal(out.merges.length, 1);
  assert.deepEqual(out.reconciled[0].seen_in_regions, [2, 3]);
  assert.equal(out.accounting.closes, true, 'every line must land in exactly one bucket');
});

test('AC7 PROOF 1 MUTATION: put the same two readings in bands that DO NOT TOUCH and the collapse must STOP', () => {
  const mutated = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, source_region: 2, as_written: '1 PRINCES LEAN CORNED BEEF' }),
      // Bands 2 (0-100px) and 8 (480-576px) share no pixels. By the
      // application's own geometry these CANNOT be one physical line - which is
      // exactly the page-1 Arla case from the variance runs, and the adjacency
      // rule is correct to refuse it.
      line({ line_no: 2, source_region: 8, as_written: '1 PRINCES LEAN CORNED BEEF.' }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(
    mutated.reconciled.length, 2,
    'MUTATION DID NOT BITE - non-adjacent bands still collapsed, so adjacency is not what is holding this '
    + 'invariant up and PROOF 1 proves nothing',
  );
});

// ═══════════════════════════════════════════════════════════════════════
// AC7 PROOF 2 - TWO DIFFERENT SOURCE LINES ARE NEVER MERGED
//
// The regression this pins destroyed three real purchases Warwick had asked
// for: Yazoo strawberry into Yazoo chocolate, Twix ice cream into Twix biscuit
// bars, Arla milk into ASDA milk. Every one of them read as "nearly the same
// words", which is why text similarity must never be reached in this case.
// ═══════════════════════════════════════════════════════════════════════

test('AC7 PROOF 2: two DIFFERENT products with near-identical readings are NEVER merged', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, source_region: 2, product_id: '59', as_written: '2 YAZOO STRAWBERRY MILK SHAKE', quantity: 2 }),
      line({ line_no: 2, source_region: 3, product_id: '15', as_written: '2 YAZOO CHOCOLATE MILK SHAKE', quantity: 2 }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(out.reconciled.length, 2, 'two products the household actually buys are two purchases');
  assert.equal(out.merges.length, 0);
});

test('AC7 PROOF 2 MUTATION: make the two identities THE SAME and the merge must happen', () => {
  const mutated = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, source_region: 2, product_id: '59', as_written: '2 YAZOO STRAWBERRY MILK SHAKE', quantity: 2 }),
      // The ONLY change from PROOF 2 is the identity. If this still refuses to
      // merge, then something other than the identity veto was keeping them
      // apart and PROOF 2 is testing the wrong mechanism.
      line({ line_no: 2, source_region: 3, product_id: '59', as_written: '2 YAZOO CHOCOLATE MILK SHAKE', quantity: 2 }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(
    mutated.reconciled.length, 1,
    'MUTATION DID NOT BITE - identical identities still did not merge, so the identity VETO is not what '
    + 'separates the Yazoo pair and PROOF 2 proves nothing',
  );
});

test('AC7 PROOF 2b: the SAME product at DIFFERENT quantities stays two purchases - the milk case', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, source_region: 2, product_id: '4', as_written: '2 MILK', quantity: 2 }),
      line({ line_no: 2, source_region: 3, product_id: '4', as_written: '4 MILK', quantity: 4 }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(out.reconciled.length, 2, 'the household genuinely buys "2 milk" AND "4 milk" in one shop');
});

// ═══════════════════════════════════════════════════════════════════════
// AC7 PROOF 3 - NO VISUAL EVIDENCE, NO PHOTO PROVENANCE
// ═══════════════════════════════════════════════════════════════════════

test('AC7 PROOF 3: a catalogue item with NO located visual evidence is REFUSED photo provenance', () => {
  const out = applyVisualEvidenceGate({
    lines: [
      line({ line_no: 1, source_region: 2, band_position_pct: 12, as_written: '1 REAL LINE' }),
      // The phantom: a perfectly valid catalogue product, a valid supplied
      // region, a non-empty reading - and no position, because there is nothing
      // on the page to place. This is the "1 box MILKY WAY" shape.
      line({ line_no: 2, source_region: 2, band_position_pct: null, product_id: '103', as_written: '1 box MILKY WAY' }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  const [real, phantom] = out.lines;
  assert.equal(real.provenance_eligible, PROVENANCE.PHOTO);
  assert.equal(phantom.provenance_eligible, PROVENANCE.WITHHELD, 'no located evidence means PHOTO is withheld');
  assert.ok(phantom.needs_human_reasons.includes(NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE));
});

test('AC7 PROOF 3 MUTATION: give the phantom a position and it must pass - the position is what withholds', () => {
  const mutated = applyVisualEvidenceGate({
    lines: [
      line({ line_no: 1, source_region: 2, band_position_pct: 12, as_written: '1 REAL LINE' }),
      line({ line_no: 2, source_region: 2, band_position_pct: 70, product_id: '103', as_written: '1 box MILKY WAY' }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(
    mutated.lines[1].provenance_eligible, PROVENANCE.PHOTO,
    'MUTATION DID NOT BITE - the line was withheld even WITH a position, so the positional evidence is not '
    + 'what PROOF 3 is testing',
  );
});

test('AC7 PROOF 3b: the gate WITHHOLDS and never DELETES - C5, and it is asserted, not promised', () => {
  const input = [
    line({ line_no: 1, source_region: 2, band_position_pct: null }),
    line({ line_no: 2, source_region: 2, band_position_pct: null }),
    line({ line_no: 3, source_region: 2, band_position_pct: null }),
  ];
  const out = applyVisualEvidenceGate({
    lines: input, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(out.lines.length, input.length, 'every line in must be a line out - a withheld line is still detected');
  assert.equal(out.counts.withheld, 3);
  assert.ok(out.lines.every((l) => l.as_written !== undefined), 'a withheld line keeps its reading and stays reportable');
});

test('AC7 PROOF 3c: two lines claiming ONE physical place are BOTH withheld - never one elected', () => {
  const out = applyVisualEvidenceGate({
    lines: [
      line({ line_no: 1, source_region: 2, product_id: '7', band_position_pct: 50 }),
      line({ line_no: 2, source_region: 2, product_id: '9', band_position_pct: 51 }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(out.lines[0].provenance_eligible, PROVENANCE.WITHHELD);
  assert.equal(out.lines[1].provenance_eligible, PROVENANCE.WITHHELD);
  assert.equal(out.counts.withheldPositionCollision, 2, 'quietly picking a winner is how a real line disappears');
});

test('AC7 PROOF 3c MUTATION: move them a full line pitch apart and BOTH must pass', () => {
  // 100px band, pitch 15.54px: 50% and 51% are 1px apart; 20% and 80% are 60px
  // apart, which is nearly four full line pitches.
  const mutated = applyVisualEvidenceGate({
    lines: [
      line({ line_no: 1, source_region: 2, product_id: '7', band_position_pct: 20 }),
      line({ line_no: 2, source_region: 2, product_id: '9', band_position_pct: 80 }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(
    mutated.counts.withheldPositionCollision, 0,
    'MUTATION DID NOT BITE - lines a full pitch apart still collided, so the tolerance is not what PROOF 3c '
    + 'is testing and the gate would withhold every real neighbouring line',
  );
});

test('AC3: a run whose contract never asked for a position is NOT ASSESSED - which is not a pass', () => {
  // Every artefact banked before WP-B15-33 has no such key. Treating that as
  // "the model declined to place its lines" would withhold every line of every
  // historical run and make `silentlyWrong` read 0 for want of a mechanism.
  const out = applyVisualEvidenceGate({
    lines: [line({ line_no: 1, source_region: 2 })],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(out.counts.applicable, false);
  assert.equal(out.counts.withheld, 0, 'a gate that could not run withholds nothing');
  assert.equal(out.lines[0].provenance_eligible, PROVENANCE.NOT_ASSESSED);
  assert.notEqual(out.lines[0].provenance_eligible, PROVENANCE.PHOTO, 'NOT_ASSESSED must never be rendered as a pass');
});

test('AC3 MUTATION: present-but-null IS an answer - the model was asked and declined, so it withholds', () => {
  const mutated = applyVisualEvidenceGate({
    lines: [line({ line_no: 1, source_region: 2, band_position_pct: null })],
    regions: REGIONS,
    axis: AXIS,
    linePitch: PITCH,
  });
  assert.equal(
    mutated.counts.applicable, true,
    'MUTATION DID NOT BITE - a present key was still read as "never asked", which would let a model silence '
    + 'the gate by returning null for every line',
  );
  assert.equal(mutated.counts.withheld, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// AC1(a) - THE REFERRAL THAT WAS NEVER CLEARED
// ═══════════════════════════════════════════════════════════════════════

test('AC1(a): a cross-region collision RESOLVED by reconciliation stops demanding a human', () => {
  const grounded = markDuplicates([
    line({ line_no: 1, source_region: 2, as_written: '1 SULTANA & CHERRY CAKE' }),
    line({ line_no: 2, source_region: 3, as_written: '1 SULTANA & CHERRY CAKE' }),
  ]);
  assert.ok(grounded.lines.every((l) => l.needs_human), 'at THIS point the collision is genuinely unresolved');

  const out = reconcileAcrossBands({
    lines: grounded.lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(out.reconciled.length, 1);
  assert.equal(
    out.reconciled[0].needs_human, false,
    'the collision was resolved by the merge - continuing to demand a human for an answered question is the '
    + 'defect this AC exists to fix',
  );
  assert.equal(out.reconciled[0].duplicate_resolved_by_reconciliation, true);
});

test('AC1(a) MUTATION: the discharge is NARROW - an unrelated referral survives the same merge', () => {
  const grounded = markDuplicates([
    line({ line_no: 1, source_region: 2, as_written: '1 SULTANA & CHERRY CAKE' }),
    line({ line_no: 2, source_region: 3, as_written: '1 SULTANA & CHERRY CAKE' }),
  ]);
  // A second, unrelated cause on the survivor. Reconciliation knows nothing
  // about it and must not clear it. A stage that cleared a bare boolean would.
  grounded.lines[0].needs_human_reasons.push(NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE);

  const out = reconcileAcrossBands({
    lines: grounded.lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(
    out.reconciled[0].needs_human, true,
    'MUTATION DID NOT BITE - reconciliation cleared a referral it had not resolved, which is exactly the '
    + 'blanket-clear failure the reason list exists to prevent',
  );
  assert.deepEqual(out.reconciled[0].needs_human_reasons, [NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE]);
});

// ═══════════════════════════════════════════════════════════════════════
// AC2 - A DISPUTED COUNT IS NOT A SETTLED ONE
// ═══════════════════════════════════════════════════════════════════════

test('AC2: two readings of ONE line that disagree about the count REFER it instead of believing one', () => {
  // The real page-16 shape: ONE physical line, read from two crops, whose
  // leading marks disagree ("2" against "-"). Band 2 spans 0-100px and band 3
  // spans 80-180px, so 90% of band 2 is x=90 and 10% of band 3 is x=90 - the
  // same physical place, reached from both crops, inside their overlap.
  const lines = [
    line({ line_no: 1, source_region: 2, product_id: '59', quantity: 2, leading_mark: '2', band_position_pct: 90 }),
    line({ line_no: 2, source_region: 3, product_id: '59', quantity: 1, leading_mark: '-', band_position_pct: 10 }),
  ];

  const referred = markDisputedCounts({
    reconciled: lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(referred, 2, 'both readings are referred - the application does not know which count is right');
  assert.ok(lines[0].needs_human_reasons.includes(NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT));
  assert.ok(lines[1].needs_human_reasons.includes(NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT));
});

test('AC2 MUTATION: agree about the count and NOTHING is referred', () => {
  const lines = [
    line({ line_no: 1, source_region: 2, product_id: '59', quantity: 2, leading_mark: '2', band_position_pct: 50 }),
    line({ line_no: 2, source_region: 2, product_id: '59', quantity: 2, leading_mark: '2', band_position_pct: 52 }),
  ];
  const referred = markDisputedCounts({
    reconciled: lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(
    referred, 0,
    'MUTATION DID NOT BITE - agreeing readings were still referred, so the mechanism is not keyed on the '
    + 'disagreement and would refer every line',
  );
});

test('AC2: the GENUINE two-purchase case is left alone when position settles it', () => {
  // Same product, touching bands, different quantities - but at two different
  // physical places on the page. That is the household buying the same thing
  // twice, and referring it would be noise.
  const lines = [
    line({ line_no: 1, source_region: 2, product_id: '4', quantity: 2, leading_mark: '2', band_position_pct: 10 }),
    line({ line_no: 2, source_region: 2, product_id: '4', quantity: 4, leading_mark: '4', band_position_pct: 90 }),
  ];
  const referred = markDisputedCounts({
    reconciled: lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
  });
  assert.equal(referred, 0, 'two real purchases at two places are not a disputed count');
});

// ═══════════════════════════════════════════════════════════════════════
// AC5 - THE EYESIGHT ARCHITECTURE. Pinned so a regression fails a SUITE
//       rather than surfacing later as a percentage nobody can explain.
// ═══════════════════════════════════════════════════════════════════════

test('AC5 PIN: the household default-one rule is unchanged and is never weakened', () => {
  assert.equal(resolveQuantity({ asWritten: 'CRAVENDALE MILK' }).quantity, 1);
  assert.equal(resolveQuantity({ asWritten: 'CRAVENDALE MILK' }).basis, QUANTITY_BASIS.HOUSEHOLD_DEFAULT);
  assert.equal(resolveQuantity({ asWritten: '4 x 4pts ARLA' }).quantity, 4);
  assert.equal(resolveQuantity({ asWritten: '4 x 4pts ARLA' }).basis, QUANTITY_BASIS.EXPLICIT);
});

test('AC5 PIN: a product-pack number is NEVER a purchase quantity', () => {
  assert.equal(resolveQuantity({ asWritten: 'Richmond 16 SKINLESS PORK SAUSAGES' }).quantity, 1);
  assert.equal(resolveQuantity({ asWritten: 'Ariel Pods 33' }).quantity, 1);
  assert.equal(
    resolveQuantity({ asWritten: 'Richmond 16 SAUSAGES', reportedQuantity: 16 }).quantity, 1,
    'a model quantity with no page evidence behind it is discarded, not believed',
  );
});

test('AC5 PIN: the candidate set stays CLOSED and both escape values remain mandatory', () => {
  const e = buildProductIdEnum([{ id: '7' }, { id: '42' }]);
  assert.deepEqual(e, ['7', '42', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
  assert.ok(e.includes(UNKNOWN_VISIBLE_ITEM), 'removing the UNKNOWN escape converts invention into confident error');
  assert.ok(e.includes(NOT_A_LINE));
});

test('AC5 PIN: an out-of-enum identity still fails LOUDLY, and the new field does not soften it', () => {
  assert.throws(
    () => groundLines({
      lines: [{ line_no: 1, as_written: 'X', product_id: '999', source_region: 2, band_position_pct: 10 }],
      productIdEnum: ['7', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE],
      regionNos: [2],
    }),
    /SCHEMA ENFORCEMENT FAILURE/,
  );
});

test('AC5 PIN: source_region stays closed to the regions the application actually supplied', () => {
  const schema = buildLineSchema({ candidates: [{ id: '7' }], regionNos: [2, 3] });
  assert.deepEqual(schema.properties.lines.items.properties.source_region.enum, [2, 3]);
});

test('AC5 PIN: source truth stays SEPARATE from catalogue identity - as_written is unconstrained', () => {
  const props = buildLineSchema({ candidates: [{ id: '7' }], regionNos: [2] }).properties.lines.items.properties;
  assert.equal(props.as_written.type, 'string');
  assert.equal(props.as_written.enum, undefined);
  assert.equal(props.band_position_pct.enum, undefined, 'the position is an observation, not a closed choice');
});

test('C6 BOUND: band_position_pct has NO bearing on identity or quantity', () => {
  const withPos = groundLines({
    lines: [{
      line_no: 1, as_written: '2 THING', leading_mark: '2', product_id: '7', source_region: 2, quantity: 2, confidence: 0.9, band_position_pct: 40,
    }],
    productIdEnum: ['7', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE],
    regionNos: [2],
  });
  const withoutPos = groundLines({
    lines: [{
      line_no: 1, as_written: '2 THING', leading_mark: '2', product_id: '7', source_region: 2, quantity: 2, confidence: 0.9, band_position_pct: null,
    }],
    productIdEnum: ['7', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE],
    regionNos: [2],
  });
  assert.equal(withPos.accepted[0].product_id, withoutPos.accepted[0].product_id);
  assert.equal(withPos.accepted[0].quantity, withoutPos.accepted[0].quantity);
  assert.equal(withPos.accepted[0].quantity_basis, withoutPos.accepted[0].quantity_basis);
});

test('C6 BOUND: the position may only ever WITHHOLD a line - it can never accept a rejected one', () => {
  // A line rejected upstream for citing a region nobody supplied does not
  // become acceptable by carrying a beautiful position.
  const out = groundLines({
    lines: [{
      line_no: 1, as_written: 'X', product_id: '7', source_region: 99, quantity: 1, confidence: 0.9, band_position_pct: 50,
    }],
    productIdEnum: ['7', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE],
    regionNos: [2],
  });
  assert.equal(out.accepted.length, 0);
  assert.equal(out.rejected.length, 1);
  assert.ok(out.rejected[0].reasons.includes('source_region_not_supplied'));
});

test('geometry: a position is only meaningful against the application\'s OWN band rectangle', () => {
  const regionsByNo = new Map(REGIONS.filter((r) => r.region_kind === 'strip').map((r) => [r.region_no, r]));
  // 50% along band 2 (0-100px) is x=50; 50% along band 4 (160-260px) is x=210.
  assert.equal(absolutePosition({ band_position_pct: 50, source_region: 2 }, regionsByNo, AXIS), 50);
  assert.equal(absolutePosition({ band_position_pct: 50, source_region: 4 }, regionsByNo, AXIS), 210);
  assert.equal(
    absolutePosition({ band_position_pct: 50, source_region: 1 }, regionsByNo, AXIS), null,
    'the full-page region has no recorded strip geometry, so no position can be derived from it',
  );
});
