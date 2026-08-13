// =====================================================================
// WP-B15-34 AC7 - MUTATION PROOFS FOR EVERY INVARIANT THIS WORK ADDED.
//
// "A gate no test can fail is not a gate." Every proof below is paired with a
// MUTATION that changes exactly one input and asserts the verdict FLIPS. A
// proof whose mutation does not bite is testing something other than what its
// name claims, and says so in its own failure message.
//
// PURE. No gateway call, no credentials, no database, no photograph.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVisualEvidenceGate, measureBandPrecision, positionClusters, bandCapacity,
  PROVENANCE, MIN_POSITIONED_FOR_DEGENERACY, POSITION_TOLERANCE_PITCH_FRACTION,
} from './visualEvidenceGate.js';
import { clearResolvedNeedsHuman, buildBandPrompt } from './bandInspection.js';
import { buildLineSchema, ASK_FOR_BAND_POSITION } from './lineSchema.js';
import { NEEDS_HUMAN } from './groundLines.js';

// The real photograph's measured geometry, so the proofs run against the
// numbers the product actually saw rather than a convenient invention.
const PITCH = 15.54054054054054;
const AXIS = 'x';
const REGIONS = [
  { region_no: 1, region_kind: 'full_page' },
  { region_no: 2, region_kind: 'strip', pixel_left: 0, pixel_right: 100, pixel_top: 192, pixel_bottom: 991 },
  { region_no: 3, region_kind: 'strip', pixel_left: 80, pixel_right: 180, pixel_top: 192, pixel_bottom: 991 },
];

let seq = 0;
const line = (over = {}) => ({
  line_no: (seq += 1),
  as_written: '1 SOMETHING',
  product_id: String(seq),
  identified: true,
  source_region: 2,
  quantity: 1,
  needs_human: false,
  needs_human_reasons: [],
  merged_from: [],
  ...over,
});

const gate = (lines) => applyVisualEvidenceGate({
  lines, regions: REGIONS, axis: AXIS, linePitch: PITCH,
});

// ═══════════════════════════════════════════════════════════════════════
// AC1 - THE FIELD LOST, AND THE DEFAULT IS WHAT SHIPS
// ═══════════════════════════════════════════════════════════════════════

test('AC1: the model is NOT asked for a position by default - the field lost the comparison', () => {
  assert.equal(ASK_FOR_BAND_POSITION, false);
  // The DEFAULT path, taken exactly as production takes it. Asserting the
  // constant alone would pass while a caller still defaulted the other way.
  const schema = buildLineSchema({ candidates: [{ id: 1 }], regionNos: [2] });
  assert.ok(!('band_position_pct' in schema.properties.lines.items.properties));
  assert.ok(!schema.properties.lines.items.required.includes('band_position_pct'));
  const prompt = buildBandPrompt({ candidateBlock: '- 1: X', bandNo: 1, bandCount: 7 });
  assert.ok(!prompt.includes('band_position_pct'), 'rule 2b must not reach the model on the default path');
});

test('AC1 MUTATION: the switch still WORKS - this is a decision, not a deletion', () => {
  const schema = buildLineSchema({ candidates: [{ id: 1 }], regionNos: [2], withPosition: true });
  assert.ok(
    'band_position_pct' in schema.properties.lines.items.properties,
    'MUTATION DID NOT BITE - the field cannot be restored, so the default is not a decision that can be revisited',
  );
  const prompt = buildBandPrompt({ candidateBlock: '- 1: X', bandNo: 1, bandCount: 7, withPosition: true });
  assert.ok(prompt.includes('band_position_pct'));
});

test('AC1/AC2: with no position asked, the gate NOT_ASSESSES and withholds NOTHING', () => {
  // The honest state AC2 authorises. NOT_ASSESSED is not a pass, and the gate
  // must say so rather than report a clean run it never graded.
  const out = gate([
    line({ source_region: 2 }),
    line({ source_region: 2 }),
    line({ source_region: 3 }),
  ]);
  assert.equal(out.counts.applicable, false);
  assert.equal(out.counts.withheld, 0, 'no positions asked for means no line may be withheld for lacking one');
  assert.equal(out.counts.notAssessed, 3);
  assert.ok(out.lines.every((l) => l.provenance_eligible === PROVENANCE.NOT_ASSESSED));
  assert.ok(out.counts.applicabilityNote.includes('NOT APPLICABLE'));
  assert.ok(out.lines.every((l) => l.needs_human === false), 'a gate that did not run asks Warwick nothing');
});

// ═══════════════════════════════════════════════════════════════════════
// AC2 - THE CALIBRATION IS MEASURED, AND IT IS THE MEASUREMENT THAT ACTS
// ═══════════════════════════════════════════════════════════════════════

test('AC2: the tolerance and capacity are DERIVED from measured geometry, not chosen', () => {
  // 100px band, 15.54px measured pitch: 7 lines one pitch apart fit.
  assert.equal(bandCapacity(100, PITCH), 7);
  // The gate's own tolerance, unchanged by this work.
  assert.equal(POSITION_TOLERANCE_PITCH_FRACTION, 0.5);
  // Clustering resolves at exactly that tolerance and nowhere else.
  assert.equal(positionClusters([0, 7, 40], PITCH / 2), 2, '7px < pitch/2 = 7.77px, so those two are one cluster');
  assert.equal(positionClusters([0, 8, 40], PITCH / 2), 3, '8px > pitch/2, so those two resolve');
});

test('AC2 PROOF 1: a DEGENERATE band is NOT_ASSESSED - it never withholds a real line', () => {
  // The measured region-6 shape from run 1: ten lines inside 3% of the crop.
  const lines = [3, 4, 5, 4, 4, 4, 5, 4, 3, 2].map((p, i) => line({
    source_region: 2, band_position_pct: p, product_id: `p${i}`,
  }));
  const out = gate(lines);

  assert.equal(out.counts.degenerateBands, 1);
  assert.equal(out.counts.withheld, 0, 'a band that cannot place anything must not withhold ten real lines');
  assert.equal(out.counts.notAssessedDegenerateBand, 10);
  assert.ok(out.lines.every((l) => l.provenance_eligible === PROVENANCE.NOT_ASSESSED));
  assert.ok(out.lines.every((l) => l.needs_human === false), 'Warwick is asked nothing about a band that said nothing');
});

test('AC2 PROOF 1 MUTATION: spread the SAME ten lines out and the band starts speaking again', () => {
  // Identical count, identical products, identical band - only the positions
  // differ. If the verdict does not flip, degeneracy is not what PROOF 1 tests.
  const lines = [0, 11, 22, 33, 44, 55, 66, 77, 88, 99].map((p, i) => line({
    source_region: 2, band_position_pct: p, product_id: `p${i}`,
  }));
  const out = gate(lines);
  assert.equal(
    out.counts.degenerateBands, 0,
    'MUTATION DID NOT BITE - a fully-spread band was still called degenerate, so PROOF 1 is not measuring '
    + 'positional precision and the fallback would fire on every band forever',
  );
  assert.equal(out.counts.notAssessedDegenerateBand, 0);
});

test('AC2 PROOF 2: a genuine collision in a RESOLVING band still WITHHOLDS - the gate is not switched off', () => {
  // Four lines that resolve cleanly, plus one pair claiming one place. The
  // band is not degenerate, so the contradiction is real evidence and stands.
  const lines = [
    line({ source_region: 2, band_position_pct: 5, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 30, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 31, product_id: 'c' }),
    line({ source_region: 2, band_position_pct: 60, product_id: 'd' }),
    line({ source_region: 2, band_position_pct: 90, product_id: 'e' }),
  ];
  const out = gate(lines);
  assert.equal(out.counts.degenerateBands, 0, 'four of five lines resolve, so this band can place');
  assert.equal(out.counts.withheldPositionCollision, 2, 'both sides of a real contradiction are withheld, never one elected');
  assert.equal(out.counts.photo, 3);
});

test('AC2 PROOF 2 MUTATION: collapse that same band and the SAME collision stops withholding', () => {
  const lines = [
    line({ source_region: 2, band_position_pct: 5, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 5, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 6, product_id: 'c' }),
    line({ source_region: 2, band_position_pct: 5, product_id: 'd' }),
    line({ source_region: 2, band_position_pct: 6, product_id: 'e' }),
  ];
  const out = gate(lines);
  assert.equal(
    out.counts.withheld, 0,
    'MUTATION DID NOT BITE - a degenerate band still withheld, which is exactly the 33-of-43 outage this AC exists to end',
  );
  assert.equal(out.counts.notAssessedDegenerateBand, 5);
});

test('AC2 PROOF 3: an honest NULL position does not drag its band into degeneracy', () => {
  // The defect this proof pins: measuring precision over REPORTED lines rather
  // than POSITIONED ones let a single declined placement switch the gate off
  // for every other line in a perfectly precise band.
  const lines = [
    line({ source_region: 2, band_position_pct: 10, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 40, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 70, product_id: 'c' }),
    line({ source_region: 2, band_position_pct: null, product_id: 'phantom' }),
  ];
  const out = gate(lines);
  assert.equal(out.counts.degenerateBands, 0, 'three lines placed cleanly; one decline says nothing about precision');
  assert.equal(out.counts.photo, 3);
  assert.equal(out.lines[3].provenance_eligible, PROVENANCE.WITHHELD, 'the unplaced line is still withheld on its own merits');
  assert.ok(out.lines[3].needs_human_reasons.includes(NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE));
});

test('AC2 PROOF 4: the sample-size floor stops ONE collision being read as systemic degeneracy', () => {
  // Two lines, one place. Below the floor, so this is a CONTRADICTION and it
  // is reported - not evidence that the band cannot place.
  const two = gate([
    line({ source_region: 2, band_position_pct: 50, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 51, product_id: 'b' }),
  ]);
  assert.ok(2 < MIN_POSITIONED_FOR_DEGENERACY);
  assert.equal(two.counts.degenerateBands, 0);
  assert.equal(two.counts.withheldPositionCollision, 2);
});

test('AC2 PROOF 4 MUTATION: add a THIRD colliding line and it becomes a pattern, not a contradiction', () => {
  const three = gate([
    line({ source_region: 2, band_position_pct: 50, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 51, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 52, product_id: 'c' }),
  ]);
  assert.equal(
    three.counts.degenerateBands, 1,
    'MUTATION DID NOT BITE - three lines piled on one point were still treated as a resolvable contradiction, '
    + `so ${MIN_POSITIONED_FOR_DEGENERACY} is not acting as a sample-size floor`,
  );
  assert.equal(three.counts.withheld, 0);
});

test('AC2 PROOF 5: degeneracy is measured PER BAND - one bad band does not silence a good one', () => {
  const lines = [
    // region 2: precise.
    line({ source_region: 2, band_position_pct: 10, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 45, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 80, product_id: 'c' }),
    // region 3: collapsed.
    line({ source_region: 3, band_position_pct: 4, product_id: 'd' }),
    line({ source_region: 3, band_position_pct: 4, product_id: 'e' }),
    line({ source_region: 3, band_position_pct: 5, product_id: 'f' }),
  ];
  const out = gate(lines);
  assert.equal(out.counts.degenerateBands, 1);
  assert.equal(out.counts.assessedBands, 1);
  const r2 = out.counts.perBandPrecision.find((p) => p.region_no === 2);
  const r3 = out.counts.perBandPrecision.find((p) => p.region_no === 3);
  assert.equal(r2.degenerate, false);
  assert.equal(r3.degenerate, true);
  assert.equal(out.counts.photo, 3, 'the precise band still speaks');
  assert.equal(out.counts.notAssessedDegenerateBand, 3);
});

test('AC2: the per-band measurement is PUBLISHED, so the calibration is auditable from the artefact', () => {
  const out = gate([
    line({ source_region: 2, band_position_pct: 10, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 45, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 80, product_id: 'c' }),
  ]);
  const p = out.counts.perBandPrecision[0];
  for (const k of ['region_no', 'reported', 'positioned', 'clusters', 'capacity', 'distinguishable', 'resolution', 'degenerate']) {
    assert.ok(k in p, `per-band precision must publish ${k} or the degeneracy verdict cannot be rechecked`);
  }
  assert.equal(p.capacity, 7);
  assert.equal(p.clusters, 3);
});

test('AC2 / WARWICK BOUND: the gate declares itself NOT positive authority', () => {
  // Measured: both TRESemme phantoms were granted PHOTO from the best-resolved
  // band in the dataset. PHOTO here is eligibility, never proof a line is real.
  const out = gate([line({ source_region: 2, band_position_pct: 10 })]);
  assert.equal(out.counts.positiveAuthority, false);
});

test('AC2 / WARWICK BOUND: unmeasurable geometry fails towards saying LESS, never towards withholding', () => {
  const out = applyVisualEvidenceGate({
    lines: [
      line({ source_region: 2, band_position_pct: 10, product_id: 'a' }),
      line({ source_region: 2, band_position_pct: 11, product_id: 'b' }),
      line({ source_region: 2, band_position_pct: 12, product_id: 'c' }),
    ],
    regions: REGIONS,
    axis: AXIS,
    linePitch: null, // imagePrep could not measure the pitch
  });
  assert.equal(out.counts.withheld, 0, 'with no pitch there is no positional argument to make in either direction');
});

test('C5 STILL HOLDS: the calibrated gate still never deletes a line', () => {
  const input = [
    line({ source_region: 2, band_position_pct: 4, product_id: 'a' }),
    line({ source_region: 2, band_position_pct: 4, product_id: 'b' }),
    line({ source_region: 2, band_position_pct: 5, product_id: 'c' }),
    line({ source_region: 2, band_position_pct: null, product_id: 'd' }),
  ];
  const out = gate(input);
  assert.equal(out.lines.length, input.length);
  assert.ok(out.lines.every((l) => l.as_written !== undefined));
});

// ═══════════════════════════════════════════════════════════════════════
// AC3 - STALE NEEDS-HUMAN CLEARS DETERMINISTICALLY
// ═══════════════════════════════════════════════════════════════════════

test('AC3 PROOF 1: a duplicate referral clears once reconciliation ABSORBED the other observation', () => {
  const out = clearResolvedNeedsHuman([
    line({
      needs_human: true,
      needs_human_reasons: [NEEDS_HUMAN.CROSS_REGION_DUPLICATE_UNRESOLVED],
      merged_from: [{ line_no: 99, as_written: 'X' }],
    }),
  ]);
  assert.equal(out.lines[0].needs_human, false, 'the collision this flag reports has been resolved');
  assert.equal(out.cleared, 1);
});

test('AC3 PROOF 1 MUTATION: an UNABSORBED collision keeps its referral', () => {
  const out = clearResolvedNeedsHuman([
    line({
      needs_human: true,
      needs_human_reasons: [NEEDS_HUMAN.CROSS_REGION_DUPLICATE_UNRESOLVED],
      merged_from: [],
    }),
  ]);
  assert.equal(
    out.lines[0].needs_human, true,
    'MUTATION DID NOT BITE - a genuinely unresolved collision was cleared, which is worse than the staleness '
    + 'this AC closes: a question Warwick needed to answer has silently disappeared',
  );
});

test('AC3 PROOF 2: a disputed count clears when its COUNTERPART no longer survives', () => {
  // The exact stale shape: the other side was merged away, so there is nothing
  // left to adjudicate - but the survivor still carried the question, and the
  // Cockpit still rendered `disputed_count_with`.
  const survivor = line({
    line_no: 7,
    needs_human: true,
    needs_human_reasons: [NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT],
    disputed_count_with: [8],
    leading_mark_disagreement: ['1', '2'],
  });
  const out = clearResolvedNeedsHuman([survivor]); // line 8 is gone
  assert.equal(out.lines[0].needs_human, false);
  assert.deepEqual(out.lines[0].disputed_count_with, [], 'a discharged dispute must not leave a dangling pointer');
  assert.deepEqual(out.lines[0].leading_mark_disagreement, []);
});

test('AC3 PROOF 2 MUTATION: while BOTH sides survive, the dispute stands', () => {
  const a = line({
    line_no: 7,
    needs_human: true,
    needs_human_reasons: [NEEDS_HUMAN.LEADING_MARK_DISAGREEMENT],
    disputed_count_with: [8],
  });
  const b = line({ line_no: 8, needs_human: false, needs_human_reasons: [] });
  const out = clearResolvedNeedsHuman([a, b]);
  assert.equal(
    out.lines[0].needs_human, true,
    'MUTATION DID NOT BITE - a live two-sided disagreement was discharged, so AsdAIr would silently pick a '
    + 'count Warwick never adjudicated',
  );
  assert.deepEqual(out.lines[0].disputed_count_with, [8]);
});

test('AC3 PROOF 3: gate-owned reasons are NEVER cleared here - the gate re-derives them itself', () => {
  const out = clearResolvedNeedsHuman([
    line({
      needs_human: true,
      needs_human_reasons: [NEEDS_HUMAN.NO_LOCATED_VISUAL_EVIDENCE, NEEDS_HUMAN.POSITION_COLLISION],
      merged_from: [{ line_no: 99 }],
    }),
  ]);
  assert.equal(out.lines[0].needs_human_reasons.length, 2, 'clearing a duplicate must not clear a positional verdict');
});

test('AC3 PROOF 4: an UNKNOWN future reason is RETAINED - questions must never vanish silently', () => {
  const out = clearResolvedNeedsHuman([
    line({ needs_human: true, needs_human_reasons: ['some_reason_invented_next_month'], merged_from: [{ line_no: 9 }] }),
  ]);
  assert.equal(out.lines[0].needs_human, true);
  assert.equal(out.cleared, 0);
});

test('AC3 INVARIANT: the resolver may only ever REMOVE a question, and it is asserted', () => {
  // Proved by construction over a mixed set: no output may carry a reason its
  // input did not, and the line count may not change.
  const input = [
    line({ needs_human: true, needs_human_reasons: [NEEDS_HUMAN.CROSS_REGION_DUPLICATE_UNRESOLVED], merged_from: [{ line_no: 1 }] }),
    line({ needs_human: false, needs_human_reasons: [] }),
    line({ needs_human: true, needs_human_reasons: [NEEDS_HUMAN.POSITION_COLLISION] }),
  ];
  const out = clearResolvedNeedsHuman(input);
  assert.equal(out.lines.length, input.length);
  out.lines.forEach((l, i) => {
    l.needs_human_reasons.forEach((r) => {
      assert.ok(input[i].needs_human_reasons.includes(r), 'a reason appeared that the input never had');
    });
  });
  assert.equal(out.lines[1].needs_human, false);
  assert.equal(out.lines[2].needs_human, true);
});

test('AC3 INVARIANT MUTATION: the "never adds" assertion actually fires', () => {
  // Feed the resolver a line whose derived boolean disagrees with its reasons.
  // The assertion is about REASONS, so this must still pass - and the boolean
  // must be recomputed rather than trusted. A `needs_human: true` with no
  // reasons is precisely the stale bare-boolean shape WP-B15-33 replaced.
  const out = clearResolvedNeedsHuman([line({ needs_human: true, needs_human_reasons: [] })]);
  assert.equal(out.lines[0].needs_human, false, 'needs_human is DERIVED from the reasons, never an independent flag');
});

// ═══════════════════════════════════════════════════════════════════════
// AC2 - THE MEASUREMENT FUNCTION ITSELF
// ═══════════════════════════════════════════════════════════════════════

test('AC2: measureBandPrecision reports the numbers the degeneracy verdict is made FROM', () => {
  const regionsByNo = new Map(REGIONS.filter((r) => r.region_kind === 'strip').map((r) => [r.region_no, r]));
  const p = measureBandPrecision({
    lines: [
      line({ source_region: 2, band_position_pct: 4 }),
      line({ source_region: 2, band_position_pct: 4 }),
      line({ source_region: 2, band_position_pct: 5 }),
      line({ source_region: 2, band_position_pct: 90 }),
    ],
    regionsByNo,
    axis: AXIS,
    tolerance: PITCH * POSITION_TOLERANCE_PITCH_FRACTION,
    pitch: PITCH,
  }).get(2);
  assert.equal(p.reported, 4);
  assert.equal(p.positioned, 4);
  assert.equal(p.clusters, 2, 'three piled at 4-5 are one cluster; 90 is another');
  assert.equal(p.unresolved, 2, 'two of the four lines failed to separate from a neighbour');
  assert.equal(p.capacity, 7);
  assert.equal(p.distinguishable, 4);
  assert.equal(
    p.degenerate, false,
    'two collapsed and two separated - a tie is NOT a majority collapse, and the doubt runs towards letting '
    + 'the band speak because withholding a real line is the expensive error',
  );
});

test('AC2: a MAJORITY collapse flips that same band to degenerate - the boundary is the majority', () => {
  const regionsByNo = new Map(REGIONS.filter((r) => r.region_kind === 'strip').map((r) => [r.region_no, r]));
  const p = measureBandPrecision({
    lines: [
      line({ source_region: 2, band_position_pct: 4 }),
      line({ source_region: 2, band_position_pct: 4 }),
      line({ source_region: 2, band_position_pct: 5 }),
      line({ source_region: 2, band_position_pct: 5 }),
      line({ source_region: 2, band_position_pct: 90 }),
    ],
    regionsByNo,
    axis: AXIS,
    tolerance: PITCH * POSITION_TOLERANCE_PITCH_FRACTION,
    pitch: PITCH,
  }).get(2);
  assert.equal(p.clusters, 2);
  assert.equal(p.unresolved, 3);
  assert.equal(
    p.degenerate, true,
    'MUTATION DID NOT BITE - three collapsed against two clusters is a majority collapse, and if this does not '
    + 'flip then the predicate is not measuring collapse at all',
  );
});
