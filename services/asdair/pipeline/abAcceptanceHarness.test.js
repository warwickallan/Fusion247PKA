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
  runBundledStrategy, runIndividualStrategy, GROUND_TRUTH_PATH,
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
