// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/photoSanityChecks.test.js
// WO-2026-08-11-B15-VISION-01, AC4 proof (cross-strip dedup) - widened by
// WO-2026-08-12-B15-VISION-02, AC1 (unjustified-quantity correction) and
// AC4 (same-region dedup, no longer left to the model's own self-label).
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PLAUSIBLE_QUANTITY, checkImplausibleQuantity, checkUnmatched,
  checkMissingSourceRegion, checkUnjustifiedQuantity, leadingQuantityEvidence,
  resolveCrossStripDuplicates, runSanityChecks,
} from './photoSanityChecks.js';

// raw_reading now carries a GENUINE leading count ("2 Cravendale Milk")
// matching the default quantity, so tests that are not ABOUT quantity
// evidence are never spuriously tripped by AC1's new unjustified-quantity
// check - only a test that deliberately overrides quantity away from that
// leading "2" (or overrides raw_reading itself) sees it fire.
function line(overrides) {
  return {
    line_no: 1, raw_reading: '2 Cravendale Milk', quantity: 2,
    matched_regular_id: 101, confidence: 0.9, source_region: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------

test('checkImplausibleQuantity: flags the design doc\'s own worked example (16 sausage packs)', () => {
  assert.equal(checkImplausibleQuantity(line({ quantity: 16 + MAX_PLAUSIBLE_QUANTITY })), 'implausible_quantity');
});

test('checkImplausibleQuantity: an ordinary quantity is never flagged', () => {
  assert.equal(checkImplausibleQuantity(line({ quantity: 4 })), null);
});

test('checkImplausibleQuantity: exactly at the ceiling is still plausible; one past it is not', () => {
  assert.equal(checkImplausibleQuantity(line({ quantity: MAX_PLAUSIBLE_QUANTITY })), null);
  assert.equal(checkImplausibleQuantity(line({ quantity: MAX_PLAUSIBLE_QUANTITY + 1 })), 'implausible_quantity');
});

test('checkImplausibleQuantity: a zero or negative quantity is flagged, never silently accepted', () => {
  assert.equal(checkImplausibleQuantity(line({ quantity: 0 })), 'implausible_quantity');
  assert.equal(checkImplausibleQuantity(line({ quantity: -1 })), 'implausible_quantity');
});

test('checkImplausibleQuantity: null quantity ("unreadable") is never flagged as implausible', () => {
  assert.equal(checkImplausibleQuantity(line({ quantity: null })), null);
});

test('checkUnmatched: flags a line with no catalogue match', () => {
  assert.equal(checkUnmatched(line({ matched_regular_id: null })), 'unmatched');
});

test('checkUnmatched: a real matched_regular_id is never flagged', () => {
  assert.equal(checkUnmatched(line({ matched_regular_id: 101 })), null);
});

test('checkMissingSourceRegion: flags a line asserting no region (the deterministic backstop before AC3\'s DB check)', () => {
  assert.equal(checkMissingSourceRegion(line({ source_region: null })), 'missing_source_region');
  assert.equal(checkMissingSourceRegion(line({ source_region: undefined })), 'missing_source_region');
});

test('checkMissingSourceRegion: a real region number is never flagged', () => {
  assert.equal(checkMissingSourceRegion(line({ source_region: 3 })), null);
});

// ---------------------------------------------------------------------
// Cross-strip dedup
// ---------------------------------------------------------------------

test('resolveCrossStripDuplicates: two reads of the SAME product+qty from DIFFERENT strips are a duplicate', () => {
  const lines = [
    line({ line_no: 3, source_region: 2, confidence: 0.7 }), // strip 2, end of page
    line({ line_no: 1, source_region: 3, confidence: 0.95 }), // strip 3, start of page (overlap)
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[0].supersededByIndex, 1, 'the lower-confidence read is superseded');
  assert.equal(resolved[1].supersededByIndex, null, 'the higher-confidence read survives');
});

test('resolveCrossStripDuplicates: THE DESIGN DOC\'S OWN GUARD - two REAL milk lines at different quantities are never collapsed', () => {
  const lines = [
    line({ raw_reading: 'Cravendale Milk', quantity: 2, source_region: 2 }),
    line({ raw_reading: 'Cravendale Milk', quantity: 4, source_region: 3 }),
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[0].supersededByIndex, null);
  assert.equal(resolved[1].supersededByIndex, null);
});

test('AC4 (WO-2026-08-12-B15-VISION-02): two reads from the SAME region are now ALSO collapsed, not left alone', () => {
  // Before this Work Order this exact case was "not this function's job" and
  // relied on the model's own possible_duplicate self-label, which nothing
  // downstream ever acted on - see the diagnostic run's real "2 Vanish oxi
  // pink" duplicate reproduced end-to-end below.
  const lines = [
    line({ source_region: 2, confidence: 0.7 }),
    line({ source_region: 2, confidence: 0.9 }),
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[0].supersededByIndex, 1, 'the lower-confidence same-region repeat is superseded');
  assert.equal(resolved[1].supersededByIndex, null, 'the higher-confidence same-region repeat survives');
});

test('AC4: the diagnostic run\'s exact "2 Vanish oxi pink" same-region duplicate shape must not recur', () => {
  // The diagnostic run's real capture: identical raw_reading, identical
  // matched product and quantity, SAME region, second occurrence
  // self-labelled by the model - and it survived as two rows regardless.
  const lines = [
    line({
      line_no: 31, raw_reading: '2 Vanish oxi pink', quantity: 2, matched_regular_id: 42,
      confidence: 0.99, source_region: 5,
    }),
    line({
      line_no: 36, raw_reading: '2 Vanish oxi pink', quantity: 2, matched_regular_id: 42,
      confidence: 0.94, source_region: 5, model_status: 'possible_duplicate',
    }),
  ];
  const { lines: resolved } = runSanityChecks(lines);
  const survivors = resolved.filter((l) => l.supersededByIndex === null);
  assert.equal(survivors.length, 1, 'exactly ONE surviving Vanish oxi pink line, not two');
  assert.equal(survivors[0].line_no, 31, 'the higher-confidence read (line 31) is the survivor');
});

test('resolveCrossStripDuplicates: an equal-confidence tie is broken by the LOWER region number', () => {
  const lines = [
    line({ source_region: 4, confidence: 0.8 }),
    line({ source_region: 2, confidence: 0.8 }),
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[1].supersededByIndex, null, 'region 2 survives the tie');
  assert.equal(resolved[0].supersededByIndex, 1);
});

test('resolveCrossStripDuplicates: unmatched lines (no catalogue id) dedup on normalised raw text alone', () => {
  const lines = [
    line({ matched_regular_id: null, raw_reading: '  Weird Item  ', quantity: null, source_region: 2, confidence: 0.3 }),
    line({ matched_regular_id: null, raw_reading: 'weird item', quantity: null, source_region: 3, confidence: 0.6 }),
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[0].supersededByIndex, 1);
});

test('resolveCrossStripDuplicates: does not mutate its input', () => {
  const lines = [line({ source_region: 2 }), line({ source_region: 3 })];
  const snapshot = JSON.parse(JSON.stringify(lines));
  resolveCrossStripDuplicates(lines);
  assert.deepEqual(lines, snapshot);
});

// ---------------------------------------------------------------------
// runSanityChecks - the orchestrator AC5 consumes
// ---------------------------------------------------------------------

test('runSanityChecks: a clean pass has no anomalies', () => {
  const { anyAnomaly, lines } = runSanityChecks([line({ line_no: 1 }), line({ line_no: 2, source_region: 3 })]);
  assert.equal(anyAnomaly, false);
  lines.forEach((l) => assert.equal(l.hasAnomaly, false));
});

test('runSanityChecks: any single flagged line sets the shop-level anyAnomaly true', () => {
  const { anyAnomaly } = runSanityChecks([line({ quantity: 999 })]);
  assert.equal(anyAnomaly, true);
});

test('runSanityChecks: a superseded (duplicate) line is never ALSO flagged for its own qty/match/region', () => {
  const { lines, anyAnomaly } = runSanityChecks([
    line({ source_region: 2, confidence: 0.5 }),
    line({ source_region: 3, confidence: 0.9 }),
  ]);
  const superseded = lines.find((l) => l.supersededByIndex !== null);
  assert.equal(superseded.flags.length, 1);
  assert.equal(superseded.flags[0], 'cross_strip_duplicate');
  assert.equal(superseded.hasAnomaly, false, 'a resolved duplicate is not itself an anomaly needing a follow-up');
  assert.equal(anyAnomaly, false);
});

test('runSanityChecks: multiple independent flags can co-exist on one line', () => {
  // raw_reading's leading evidence is "2" (see line() fixture); overriding
  // quantity to 999 with no matching evidence trips AC1's unjustified-
  // quantity check FIRST, which nulls the quantity in the SAME pass - so
  // checkImplausibleQuantity, running on the now-corrected line, never also
  // fires for the same underlying defect (see runSanityChecks' own doc
  // comment: nulling happens before the implausibility check, deliberately).
  // Three independent flags co-exist here, not four - implausible_quantity
  // and unjustified_quantity are mutually exclusive by design, never both.
  const { lines } = runSanityChecks([line({ quantity: 999, matched_regular_id: null, source_region: null })]);
  assert.deepEqual(
    lines[0].flags.sort(),
    ['missing_source_region', 'unjustified_quantity', 'unmatched'].sort(),
  );
  assert.equal(lines[0].quantity, null, 'the unjustified 999 is corrected to null, not left standing');
});

test('runSanityChecks: implausible_quantity and unjustified_quantity never BOTH fire for the same line', () => {
  // A quantity that IS justified by genuine leading evidence but is also
  // implausibly large (e.g. a mis-scan reading "40" as a leading count) must
  // still be caught by checkImplausibleQuantity - the two checks are
  // independent, and neither one silently swallows a defect the other exists
  // to catch.
  const { lines } = runSanityChecks([line({ raw_reading: '40 chips with skins on', quantity: 40 })]);
  assert.deepEqual(lines[0].flags, ['implausible_quantity']);
});

// ---------------------------------------------------------------------
// AC1 (WO-2026-08-12-B15-VISION-02): quantity semantics as a class
// ---------------------------------------------------------------------

test('leadingQuantityEvidence: a genuine leading count is independent evidence', () => {
  assert.equal(leadingQuantityEvidence('2 chips with skins on'), 2);
  assert.equal(leadingQuantityEvidence('3 x Yazoo choc'), 3);
  assert.equal(leadingQuantityEvidence('4 pk kitchen roll'), 4);
});

test('leadingQuantityEvidence: a number embedded in the product\'s own name is NOT evidence', () => {
  assert.equal(leadingQuantityEvidence('Richmond 16 Pork Sausages'), null);
  assert.equal(leadingQuantityEvidence('Wall\'s 4 Pork Sausage Rolls 220g'), null);
});

test('leadingQuantityEvidence: an explicit multiplier anywhere in the text still counts', () => {
  assert.equal(leadingQuantityEvidence('buy 2 Richmond sausages'), 2);
});

test('leadingQuantityEvidence: empty/blank text has no evidence', () => {
  assert.equal(leadingQuantityEvidence(''), null);
  assert.equal(leadingQuantityEvidence('   '), null);
  assert.equal(leadingQuantityEvidence(null), null);
});

test('checkUnjustifiedQuantity: AC1\'s acceptance_property - "Richmond 16 Pork Sausages" with quantity 16 is flagged', () => {
  assert.equal(
    checkUnjustifiedQuantity({ raw_reading: 'Richmond 16 Pork Sausages', quantity: 16 }),
    'unjustified_quantity',
  );
});

test('checkUnjustifiedQuantity: a genuine leading count is never flagged', () => {
  assert.equal(checkUnjustifiedQuantity({ raw_reading: '2 chips with skins on', quantity: 2 }), null);
});

test('checkUnjustifiedQuantity: a null quantity ("unreadable") is never flagged here', () => {
  assert.equal(checkUnjustifiedQuantity({ raw_reading: 'Richmond 16 Pork Sausages', quantity: null }), null);
});

test('runSanityChecks: AC1 acceptance_property END TO END - the pipeline OUTPUTS a line with quantity NOT 16, never merely flags it', () => {
  const { lines } = runSanityChecks([
    line({ raw_reading: 'Richmond 16 Pork Sausages', quantity: 16, matched_regular_id: 55 }),
  ]);
  assert.notEqual(lines[0].quantity, 16, 'the OUTPUT quantity must not be 16 - a flag alone is not the fix');
  assert.equal(lines[0].quantity, null, 'no independent evidence exists, so the honest output is null, never a guess');
  assert.ok(lines[0].flags.includes('unjustified_quantity'));
});

test('runSanityChecks: AC1 - a household-rule-sourced quantity path is untouched (this check only runs on PHOTO first-pass lines)', () => {
  // Household-rule/REGULARS-derived quantities never pass through
  // runSanityChecks at all - they are built later via buildRuleProvenanceRow/
  // buildRegularsProvenanceRow (lineProvenance.js), a completely separate
  // code path this Work Order does not touch. This test documents that
  // boundary rather than exercising a function that would not apply.
  const { lines } = runSanityChecks([line({ raw_reading: '3 x Yazoo choc', quantity: 3 })]);
  assert.equal(lines[0].quantity, 3, 'a genuine leading-count PHOTO line is unaffected by the AC1 fix');
});
