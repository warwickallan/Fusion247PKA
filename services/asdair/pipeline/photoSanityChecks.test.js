// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/photoSanityChecks.test.js
// WO-2026-08-11-B15-VISION-01, AC4 proof.
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PLAUSIBLE_QUANTITY, checkImplausibleQuantity, checkUnmatched,
  checkMissingSourceRegion, resolveCrossStripDuplicates, runSanityChecks,
} from './photoSanityChecks.js';

function line(overrides) {
  return {
    line_no: 1, raw_reading: 'Cravendale Milk', quantity: 2,
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

test('resolveCrossStripDuplicates: two reads from the SAME region are left alone (not this function\'s job)', () => {
  const lines = [
    line({ source_region: 2, confidence: 0.7 }),
    line({ source_region: 2, confidence: 0.9 }),
  ];
  const resolved = resolveCrossStripDuplicates(lines);
  assert.equal(resolved[0].supersededByIndex, null);
  assert.equal(resolved[1].supersededByIndex, null);
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
  const { lines } = runSanityChecks([line({ quantity: 999, matched_regular_id: null, source_region: null })]);
  assert.deepEqual(lines[0].flags.sort(), ['implausible_quantity', 'missing_source_region', 'unmatched'].sort());
});
