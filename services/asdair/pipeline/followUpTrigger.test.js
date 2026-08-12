// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/followUpTrigger.test.js
// WO-2026-08-11-B15-VISION-01, AC5 proof.
//
// THE ACCEPTANCE CRITERION, verbatim: "proven by two separate tests, one
// exercising each trigger path independently, confirming neither alone is
// sufficient by design and either alone is sufficient in practice." Both
// tests below hold the OTHER signal absent throughout, so the passing
// assertion cannot be smuggled in by the wrong path.
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { needsFollowUp, flaggedRegionsForFollowUp, silentRegions, LOW_CONFIDENCE_THRESHOLD } from './followUpTrigger.js';

function cleanLine(overrides) {
  return {
    line_no: 1, source_region: 2, confidence: 0.95, hasAnomaly: false, supersededByIndex: null,
    ...overrides,
  };
}

test('a fully clean pass (high confidence, no anomalies) never triggers a follow-up', () => {
  const lines = [cleanLine({ line_no: 1 }), cleanLine({ line_no: 2, source_region: 3 })];
  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines);
  assert.equal(triggered, false);
  assert.equal(reasons.lowConfidence, false);
  assert.equal(reasons.deterministicAnomaly, false);
});

test('TRIGGER PATH 1 (low confidence ALONE, hasAnomaly false throughout): follow-up fires', () => {
  const lines = [
    cleanLine({ line_no: 1, confidence: 0.95, hasAnomaly: false }),
    cleanLine({ line_no: 2, confidence: LOW_CONFIDENCE_THRESHOLD - 0.01, hasAnomaly: false, source_region: 3 }),
  ];
  // Confirm the anomaly signal is genuinely absent throughout this fixture,
  // so a passing result cannot be attributed to the other path.
  assert.ok(lines.every((l) => l.hasAnomaly === false), 'precondition: no deterministic anomaly anywhere in this fixture');

  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines);
  assert.equal(triggered, true);
  assert.equal(reasons.lowConfidence, true);
  assert.equal(reasons.deterministicAnomaly, false, 'the anomaly reason must stay false - low confidence alone did the work');
});

test('TRIGGER PATH 2 (deterministic anomaly ALONE, every confidence high): follow-up fires', () => {
  const lines = [
    cleanLine({ line_no: 1, confidence: 0.99, hasAnomaly: false }),
    cleanLine({ line_no: 2, confidence: 0.98, hasAnomaly: true, source_region: 3 }),
  ];
  // Confirm confidence is genuinely high throughout, so a passing result
  // cannot be attributed to the low-confidence path.
  assert.ok(lines.every((l) => l.confidence >= LOW_CONFIDENCE_THRESHOLD), 'precondition: no low-confidence line anywhere in this fixture');

  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines);
  assert.equal(triggered, true);
  assert.equal(reasons.deterministicAnomaly, true);
  assert.equal(reasons.lowConfidence, false, 'the low-confidence reason must stay false - the anomaly alone did the work');
});

test('both signals present at once still triggers exactly once, both reasons true', () => {
  const lines = [cleanLine({ confidence: 0.1, hasAnomaly: true })];
  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines);
  assert.equal(triggered, true);
  assert.equal(reasons.lowConfidence, true);
  assert.equal(reasons.deterministicAnomaly, true);
});

test('a SUPERSEDED (cross-strip duplicate) line never triggers a follow-up on its own account', () => {
  const lines = [cleanLine({ confidence: 0.01, hasAnomaly: true, supersededByIndex: 0 })];
  const { needsFollowUp: triggered } = needsFollowUp(lines);
  assert.equal(triggered, false, 'a resolved duplicate must not spend the one follow-up call re-reading an already-resolved strip');
});

test('flaggedRegionsForFollowUp: collects the DISTINCT regions needing a re-read, sorted, deduplicated', () => {
  const lines = [
    cleanLine({ line_no: 1, source_region: 5, confidence: 0.2 }),
    cleanLine({ line_no: 2, source_region: 5, hasAnomaly: true }), // same region, different line - collapses to one
    cleanLine({ line_no: 3, source_region: 2, hasAnomaly: true }),
    cleanLine({ line_no: 4, source_region: 3, confidence: 0.99, hasAnomaly: false }), // clean - excluded
  ];
  assert.deepEqual(flaggedRegionsForFollowUp(lines), [2, 5]);
});

test('flaggedRegionsForFollowUp: excludes superseded lines and lines with no region on record', () => {
  const lines = [
    cleanLine({ source_region: 4, confidence: 0.1, supersededByIndex: 1 }),
    cleanLine({ source_region: null, confidence: 0.1 }),
  ];
  assert.deepEqual(flaggedRegionsForFollowUp(lines), []);
});

test('flaggedRegionsForFollowUp: a fully clean pass needs no follow-up regions at all', () => {
  assert.deepEqual(flaggedRegionsForFollowUp([cleanLine({}), cleanLine({ source_region: 3 })]), []);
});

// ── AC1 (WO-2026-08-12-B15-VISION-03) - SILENCE AS ITS OWN ANOMALY ─────────
//
// THE ACCEPTANCE CRITERION, mirroring AC5's own discipline above: proven as
// a THIRD trigger path, independent of the two above - every test here holds
// confidence high and hasAnomaly false throughout, so a passing result
// cannot be attributed to either pre-existing path.

test('silentRegions: with no expectedRegionNos supplied, always returns [] - the honest "nothing to compare" default', () => {
  assert.deepEqual(silentRegions([cleanLine({ source_region: 2 })]), []);
  assert.deepEqual(silentRegions([cleanLine({ source_region: 2 })], []), []);
});

test('silentRegions: a region no LIVE line cites is silent; a region a line DOES cite is not', () => {
  const lines = [cleanLine({ source_region: 2 }), cleanLine({ source_region: 4 })];
  assert.deepEqual(silentRegions(lines, [2, 3, 4, 5]), [3, 5]);
});

test('silentRegions: a SUPERSEDED line does not count as covering its region - its survivor must', () => {
  const lines = [cleanLine({ source_region: 2, supersededByIndex: 1 })];
  assert.deepEqual(silentRegions(lines, [2]), [2], 'a superseded line is not live, so its region is still silent unless another live line covers it');
});

test('TRIGGER PATH 3 (silent region ALONE, every confidence high, no anomaly anywhere): follow-up fires', () => {
  const lines = [cleanLine({ line_no: 1, source_region: 2, confidence: 0.99, hasAnomaly: false })];
  assert.ok(lines.every((l) => l.hasAnomaly === false && l.confidence >= LOW_CONFIDENCE_THRESHOLD),
    'precondition: neither of the other two signals is present anywhere in this fixture');

  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines, [2, 3]);
  assert.equal(triggered, true, 'region 3 produced no live line at all and must trigger a follow-up on that fact alone');
  assert.equal(reasons.silentRegion, true);
  assert.equal(reasons.lowConfidence, false, 'the low-confidence reason must stay false - silence alone did the work');
  assert.equal(reasons.deterministicAnomaly, false, 'the anomaly reason must stay false - silence alone did the work');
});

test('a fully clean pass over EVERY expected region never triggers a follow-up, even with expectedRegionNos supplied', () => {
  const lines = [cleanLine({ line_no: 1, source_region: 2 }), cleanLine({ line_no: 2, source_region: 3 })];
  const { needsFollowUp: triggered, reasons } = needsFollowUp(lines, [2, 3]);
  assert.equal(triggered, false);
  assert.equal(reasons.silentRegion, false);
});

test('flaggedRegionsForFollowUp: a silent region is included alongside any per-line flagged region, deduplicated', () => {
  const lines = [
    cleanLine({ line_no: 1, source_region: 2, confidence: 0.2 }), // low confidence -> flags region 2
    cleanLine({ line_no: 2, source_region: 4 }), // clean, covers region 4
    // region 5: no line at all -> silent
  ];
  assert.deepEqual(flaggedRegionsForFollowUp(lines, [2, 4, 5]), [2, 5]);
});

test('flaggedRegionsForFollowUp: omitting expectedRegionNos preserves every pre-existing caller\'s exact prior behaviour', () => {
  const lines = [cleanLine({ line_no: 1, source_region: 5, confidence: 0.2 })];
  assert.deepEqual(flaggedRegionsForFollowUp(lines), [5], 'unchanged from the pre-AC1 behaviour when no region list is supplied');
});
