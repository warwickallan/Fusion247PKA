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

import { needsFollowUp, flaggedRegionsForFollowUp, LOW_CONFIDENCE_THRESHOLD } from './followUpTrigger.js';

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
