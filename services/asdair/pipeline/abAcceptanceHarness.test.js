// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/abAcceptanceHarness.test.js
//
// WO-2026-08-11-B15-VISION-01, AC8 proof: this proves the harness is
// CALLABLE (its ground-truth parser, its scoring function, and both
// strategy functions with INJECTED, no-network dependencies) - never that
// it was run against the live gateway, which this Work Order's own scope
// forbids (see the module's own header).
//
// Runs under: node --test (no DB, no model, no network - every vision()
// call below is a local stub, never fetch).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  parseTrolleyGroundTruth, loadGroundTruth, scoreInterpretation,
  runBundledStrategy, runIndividualStrategy, runAdaptiveStrategy, scoreSevenWay, GROUND_TRUTH_PATH,
} from './abAcceptanceHarness.js';

const SAMPLE_TABLE = `
| # | Product as it appears in the ASDA trolley | Qty |
|---|---|---|
| 1 | ASDA British Milk Semi Skimmed 6 Pints | 1 |
| 2 | Cravendale Arla Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer | 4 |
Some prose paragraph that must not be parsed as a row.
| 41 | Ariel 4in1 PODS, Washing Capsules 33 | 1 |
`;

test('parseTrolleyGroundTruth: extracts exactly the numbered data rows, skipping the header/separator/prose', () => {
  const rows = parseTrolleyGroundTruth(SAMPLE_TABLE);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { product: 'ASDA British Milk Semi Skimmed 6 Pints', qty: 1 });
  assert.deepEqual(rows[2], { product: 'Ariel 4in1 PODS, Washing Capsules 33', qty: 1 });
});

test('loadGroundTruth: the REAL committed trolley-reconciliation file parses to exactly 41 rows summing to 58 units', () => {
  assert.ok(fs.existsSync(GROUND_TRUTH_PATH), 'the ground-truth file this Work Order names must exist at the path the harness reads');
  const rows = loadGroundTruth();
  assert.equal(rows.length, 41, 'the document\'s own claim: "41 distinct products"');
  const totalUnits = rows.reduce((sum, r) => sum + r.qty, 0);
  assert.equal(totalUnits, 58, 'the document\'s own claim: "58 units"');
});

test('scoreInterpretation: an exact product+qty match against the real ground truth scores MATCHED', () => {
  const groundTruth = loadGroundTruth();
  const score = scoreInterpretation([{ product_name: 'Ariel 4in1 PODS', quantity: 1 }], groundTruth);
  assert.equal(score.matched, 1);
  assert.equal(score.wrongProduct, 0);
});

test('scoreInterpretation: a right product, wrong quantity scores QUANTITY_MISMATCH, not silently MATCHED', () => {
  const groundTruth = loadGroundTruth();
  const score = scoreInterpretation([{ product_name: 'Ariel 4in1 PODS', quantity: 5 }], groundTruth);
  assert.equal(score.missingQty, 1);
  assert.equal(score.matched, 0);
});

test('scoreInterpretation: a product genuinely absent from the trolley scores NO_MATCH_IN_TROLLEY', () => {
  const groundTruth = loadGroundTruth();
  const score = scoreInterpretation([{ product_name: 'Completely Invented Item Nobody Bought', quantity: 1 }], groundTruth);
  assert.equal(score.wrongProduct, 1);
});

test('scoreInterpretation: a null quantity (unreadable) is never penalised as a mismatch', () => {
  const groundTruth = loadGroundTruth();
  const score = scoreInterpretation([{ product_name: 'Ariel 4in1 PODS', quantity: null }], groundTruth);
  assert.equal(score.matched, 1);
});

// ---------------------------------------------------------------------
// Strategy functions - fully injected, zero network. Proves the harness
// is CALLABLE (AC8's own word); never that it was run live.
// ---------------------------------------------------------------------

function stubDeps({ visionCallLog }) {
  return {
    vision: async (prompt, imageUrl) => {
      visionCallLog.push({ prompt, imageCount: Array.isArray(imageUrl) ? imageUrl.length : 1 });
      return '{"lines":[]}';
    },
    buildGroundedPrompt: (catalogue, options) => 'PROMPT for ' + (options && options.regions ? options.regions.length : 0) + ' region(s)',
    prepareImage: () => ({
      regions: [
        { region_no: 1, region_kind: 'full_page' },
        { region_no: 2, region_kind: 'strip' },
        { region_no: 3, region_kind: 'strip' },
      ],
    }),
    imageToDataUrl: () => 'data:image/jpeg;base64,STUB',
  };
}

test('runBundledStrategy: exactly ONE vision() call, carrying every region as a separate image part', async () => {
  const visionCallLog = [];
  const result = await runBundledStrategy(Buffer.from('x'), {}, stubDeps({ visionCallLog }));
  assert.equal(result.callCount, 1);
  assert.equal(visionCallLog.length, 1);
  assert.equal(visionCallLog[0].imageCount, 3, 'all three regions must be sent as separate image parts in the one call');
});

test('runIndividualStrategy: ONE call per region - full page first, then each strip separately', async () => {
  const visionCallLog = [];
  const result = await runIndividualStrategy(Buffer.from('x'), {}, stubDeps({ visionCallLog }));
  assert.equal(result.callCount, 3, 'full page + 2 strips = 3 separate calls');
  assert.equal(visionCallLog.length, 3);
  visionCallLog.forEach((c) => assert.equal(c.imageCount, 1, 'each individual call sends exactly one image'));
});

test('a custom renderRegionImage is genuinely used when injected (the Finding-2 escape hatch works)', async () => {
  const visionCallLog = [];
  const seenRegions = [];
  const deps = stubDeps({ visionCallLog });
  deps.renderRegionImage = (buf, region) => { seenRegions.push(region.region_no); return 'data:image/jpeg;base64,REAL-CROP-' + region.region_no; };
  await runIndividualStrategy(Buffer.from('x'), {}, deps);
  assert.deepEqual(seenRegions, [1, 2, 3]);
});

// ---------------------------------------------------------------------
// runAdaptiveStrategy (WO-2026-08-12-B15-VISION-02, AC2/AC8) - the REAL
// production shape, reached through interpretPhotoOrchestrator.js itself
// so this arm can never drift from what production actually does.
// ---------------------------------------------------------------------

function adaptiveDeps({ visionCallLog, followUpNeeded }) {
  return {
    prepareImage: () => ({
      rotate: 0, flip: null, imageFingerprint: 'abc123abc123abc1',
      regions: [
        { region_no: 1, region_kind: 'full_page' },
        { region_no: 2, region_kind: 'strip' },
      ],
    }),
    renderAllRegions: async (buf, transform, regions) => regions.map((r) => ({ region_no: r.region_no, buffer: Buffer.from('r' + r.region_no) })),
    toDataUrl: (buf) => 'data:image/jpeg;base64,' + buf.toString('utf8'),
    insertRegionBatch: async (deps, shopId, regions) => new Map(regions.map((r, i) => [r.region_no, 900 + i])),
    buildGroundedPrompt: () => 'PROMPT',
    vision: async (prompt, imageUrls) => {
      visionCallLog.push(Array.isArray(imageUrls) ? imageUrls.length : 1);
      return JSON.stringify({
        lines: [{ line_no: 1, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: followUpNeeded ? 0.3 : 0.95, status: 'matched', source_region: 1 }],
      });
    },
    extractJson: async (text) => JSON.parse(text),
    runSanityChecks: (lines) => ({
      lines: lines.map((l) => ({ ...l, hasAnomaly: l.confidence < 0.5, supersededByIndex: null })),
      anyAnomaly: lines.some((l) => l.confidence < 0.5),
    }),
    needsFollowUp: (lines) => {
      const trigger = lines.some((l) => l.confidence < 0.5);
      return { needsFollowUp: trigger, reasons: { lowConfidence: trigger, deterministicAnomaly: false } };
    },
    flaggedRegionsForFollowUp: (lines) => lines.filter((l) => l.confidence < 0.5).map((l) => l.source_region),
    insertPhotoProvenanceBatch: async () => [],
    writeQuery: async () => ({ rows: [] }),
  };
}

test('runAdaptiveStrategy: a clean pass costs exactly ONE vision call - the same production behaviour AC2 requires', async () => {
  const visionCallLog = [];
  const result = await runAdaptiveStrategy(Buffer.from('img'), {}, adaptiveDeps({ visionCallLog, followUpNeeded: false }));
  assert.equal(result.strategy, 'adaptive');
  assert.equal(result.callCount, 1);
  assert.equal(result.followUpFired, false);
});

test('runAdaptiveStrategy: a flagged region triggers exactly one additional individual call - real interpretPhotoOrchestrator wiring, not a re-implementation', async () => {
  const visionCallLog = [];
  const result = await runAdaptiveStrategy(Buffer.from('img'), {}, adaptiveDeps({ visionCallLog, followUpNeeded: true }));
  assert.equal(result.callCount, 2, 'one first-pass call + one individual follow-up for the one flagged region');
  assert.equal(result.followUpFired, true);
});

// ---------------------------------------------------------------------
// scoreSevenWay - Warwick's seven-category breakdown (Amendment 4, point 1)
// ---------------------------------------------------------------------

const SEVEN_WAY_TRUTH = [
  { product: 'ASDA British Milk Semi Skimmed 6 Pints', qty: 1 },
  { product: 'Yazoo Chocolate Milk Drink 400ml', qty: 2 },
];

test('scoreSevenWay: an exact product+qty match is CORRECTLY IDENTIFIED', () => {
  const score = scoreSevenWay([{ raw_reading: 'ASDA British Milk Semi Skimmed 6 Pints', quantity: 1 }], SEVEN_WAY_TRUTH);
  assert.equal(score.correctlyIdentified, 1);
  assert.equal(score.omitted, 1, 'the Yazoo line was never interpreted at all');
});

test('scoreSevenWay: a ground-truth product never interpreted at all is OMITTED', () => {
  const score = scoreSevenWay([], SEVEN_WAY_TRUTH);
  assert.equal(score.omitted, 2);
});

test('scoreSevenWay: an interpreted line matching NOTHING in the ground truth is INVENTED', () => {
  const score = scoreSevenWay([{ raw_reading: 'Completely Invented Item Nobody Bought', quantity: 1 }], SEVEN_WAY_TRUTH);
  assert.equal(score.invented, 1);
});

test('scoreSevenWay: a right product, wrong quantity is WRONG QUANTITY, never silently correct', () => {
  const score = scoreSevenWay([{ raw_reading: 'ASDA British Milk Semi Skimmed 6 Pints', quantity: 99 }], SEVEN_WAY_TRUTH);
  assert.equal(score.wrongQuantity, 1);
  assert.equal(score.correctlyIdentified, 0);
});

test('scoreSevenWay: a low-confidence or needs_confirmation/unreadable line is GENUINELY UNCERTAIN, not silently right or wrong', () => {
  const lowConfidence = scoreSevenWay([{ raw_reading: 'Yazoo Chocolate Milk Drink 400ml', quantity: 2, confidence: 0.3 }], SEVEN_WAY_TRUTH);
  assert.equal(lowConfidence.genuinelyUncertain, 1);
  assert.equal(lowConfidence.correctlyIdentified, 0);

  const needsConfirmation = scoreSevenWay([{ raw_reading: 'something ambiguous', quantity: null, status: 'needs_confirmation' }], SEVEN_WAY_TRUTH);
  assert.equal(needsConfirmation.genuinelyUncertain, 1);
  assert.equal(needsConfirmation.invented, 0, 'an honest "not sure" must never be scored as a confident invention');
});

test('scoreSevenWay: wrongIdentity is honestly reported as NOT computable by this pure text-matching function', () => {
  const score = scoreSevenWay([], SEVEN_WAY_TRUTH);
  assert.equal(score.wrongIdentity, 0);
  assert.match(score.wrongIdentityNote, /resolveByCatalogue\.js output/);
});
