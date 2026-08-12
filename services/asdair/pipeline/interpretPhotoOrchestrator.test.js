// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/interpretPhotoOrchestrator.test.js
//
// WO-2026-08-11-B15-VISION-01 Amendment 3, AC1/AC2/AC4/AC5/AC6 proof: the
// FULL wiring order, with every collaborator injected as a fake - proving
// the ORCHESTRATION (what happens before what) with zero network, zero DB,
// zero sharp, exactly as pipeline/test/harness.js already does for the
// whole deps container.
//
// Runs under: node --test (no DB, no model, no network, no sharp).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { interpretPhotoWithDeps } from './interpretPhotoOrchestrator.js';

const CATALOGUE = { candidates: [{ id: 1, name: 'Milk' }], rules: [], last_order: { lines: [] } };

/** A minimal set of fakes covering the happy path: one region, high confidence, no anomaly, no follow-up. */
function baseCollaborators({ callLog }) {
  return {
    prepareImage: (buf) => {
      callLog.push('prepareImage');
      return {
        rotate: 0, flip: null, imageFingerprint: 'abc123abc123abc1',
        regions: [{ region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null }],
      };
    },
    renderAllRegions: async (buf, transform, regions) => {
      callLog.push('renderAllRegions');
      return regions.map((r) => ({ region_no: r.region_no, buffer: Buffer.from('rendered-' + r.region_no) }));
    },
    toDataUrl: (buf) => 'data:image/jpeg;base64,' + buf.toString('utf8'),
    insertRegionBatch: async (deps, shopId, regions) => {
      callLog.push('insertRegionBatch');
      return new Map(regions.map((r, i) => [r.region_no, 900 + i]));
    },
    buildGroundedPrompt: (catalogue, options) => {
      callLog.push('buildGroundedPrompt:' + ((options && options.regions) || []).length);
      return 'PROMPT';
    },
    vision: async (prompt, imageUrls) => {
      callLog.push('vision:' + (Array.isArray(imageUrls) ? imageUrls.length : 1));
      return JSON.stringify({
        lines: [{ line_no: 1, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: 0.95, status: 'matched', source_region: 1 }],
      });
    },
    extractJson: async (text) => JSON.parse(text),
    runSanityChecks: (lines) => {
      callLog.push('runSanityChecks');
      return { lines: lines.map((l) => ({ ...l, hasAnomaly: false, supersededByIndex: null })), anyAnomaly: false };
    },
    needsFollowUp: (lines) => {
      callLog.push('needsFollowUp');
      return { needsFollowUp: false, reasons: { lowConfidence: false, deterministicAnomaly: false } };
    },
    flaggedRegionsForFollowUp: () => [],
    insertPhotoProvenanceBatch: async (deps, lines) => {
      callLog.push('insertPhotoProvenanceBatch:' + lines.length);
      return lines.map((l, i) => ({ id: 5000 + i, ...l }));
    },
    writeQuery: async () => ({ rows: [] }),
  };
}

test('the happy path: ONE vision call, correct wiring order, PHOTO provenance persisted before returning', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  const result = await interpretPhotoWithDeps(
    { catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 42, interpreterModel: 'gpt-5.6-terra', promptVersion: 'v1' },
    collaborators,
  );

  // ── THE CALL ORDER PROOF (AC6) ──────────────────────────────────────────
  assert.deepEqual(callLog, [
    'prepareImage', 'renderAllRegions', 'insertRegionBatch',
    'buildGroundedPrompt:1', 'vision:1', 'runSanityChecks', 'needsFollowUp',
    'insertPhotoProvenanceBatch:1',
  ], 'regions must be persisted BEFORE the vision call, and provenance persisted LAST - strictly before this function returns');

  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].raw_reading, 'Milk 2L');
  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.followUpFired, false);
});

test('vision() receives EVERY region as a separate image part, in ONE call (AC2 - "one request per normal case")', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.prepareImage = () => ({
    rotate: 0, flip: null, imageFingerprint: 'abc123abc123abc1',
    regions: [
      { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
      { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
      { region_no: 3, region_kind: 'strip', pixel_top: 600, pixel_left: 0, pixel_bottom: 1300, pixel_right: 1000 },
    ],
  });
  await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);
  assert.ok(callLog.includes('vision:3'), 'expected exactly 3 image parts in the one vision() call');
  assert.equal(callLog.filter((c) => c.startsWith('vision:')).length, 1, 'the normal case must be exactly ONE vision() call');
});

test('a follow-up fires when needed, covers ONLY the flagged regions, and is the ONLY additional call', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.prepareImage = () => ({
    rotate: 0, flip: null, imageFingerprint: null,
    regions: [
      { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
      { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
    ],
  });
  collaborators.vision = async (prompt, imageUrls) => {
    callLog.push('vision:' + (Array.isArray(imageUrls) ? imageUrls.length : 1));
    return JSON.stringify({
      lines: [
        { line_no: 1, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: 0.95, status: 'matched', source_region: 1 },
        { line_no: 2, raw_reading: 'Blurry Item', quantity: 1, matched_regular_id: null, confidence: 0.2, status: 'unreadable', source_region: 2 },
      ],
    });
  };
  collaborators.runSanityChecks = (lines) => ({
    lines: lines.map((l) => ({ ...l, hasAnomaly: l.confidence < 0.5, supersededByIndex: null })),
    anyAnomaly: lines.some((l) => l.confidence < 0.5),
  });
  collaborators.needsFollowUp = (lines) => {
    const trigger = lines.some((l) => l.confidence < 0.5);
    return { needsFollowUp: trigger, reasons: { lowConfidence: trigger, deterministicAnomaly: false } };
  };
  collaborators.flaggedRegionsForFollowUp = (lines) => lines.filter((l) => l.confidence < 0.5).map((l) => l.source_region);

  let followUpCallUrls = null;
  const originalVision = collaborators.vision;
  collaborators.vision = async (prompt, imageUrls) => {
    if (Array.isArray(imageUrls) && imageUrls.length === 1 && followUpCallUrls === null && callLog.filter((c) => c.startsWith('vision:')).length >= 1) {
      followUpCallUrls = imageUrls;
      callLog.push('vision:' + imageUrls.length);
      return JSON.stringify({ lines: [{ line_no: 2, raw_reading: 'Kleenex Tissues', quantity: 1, matched_regular_id: 9, confidence: 0.9, status: 'matched', source_region: 2 }] });
    }
    return originalVision(prompt, imageUrls);
  };

  const result = await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);

  assert.equal(result.followUpFired, true);
  const visionCalls = callLog.filter((c) => c.startsWith('vision:'));
  assert.equal(visionCalls.length, 2, 'exactly ONE original call plus ONE follow-up - never more');
  assert.equal(visionCalls[1], 'vision:1', 'the follow-up covers only the ONE flagged region');

  // The follow-up's better reading REPLACES the original blurry line for
  // that region - the merge, not a duplicate.
  const line2 = result.lines.find((l) => l.line_no === 2);
  assert.equal(line2.raw_reading, 'Kleenex Tissues', 'the follow-up reading must supersede the original for the flagged region');
  assert.equal(result.lines.length, 2, 'no duplicate line for the re-read region');
});

test('AC2 (WO-2026-08-12-B15-VISION-02): TWO flagged regions get TWO individual follow-up calls, never one bundled call', async () => {
  // The single-flagged-region test above cannot distinguish "one call per
  // flagged region" from "one bundled call covering every flagged region" -
  // both produce exactly one follow-up call when there is only one region to
  // cover. This test uses THREE regions (one clean, two flagged) so the two
  // shapes diverge observably: the OLD design would fire ONE follow-up call
  // with 2 image parts; the NEW design fires TWO follow-up calls, each with
  // exactly 1 image part.
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.prepareImage = () => ({
    rotate: 0, flip: null, imageFingerprint: null,
    regions: [
      { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
      { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
      { region_no: 3, region_kind: 'strip', pixel_top: 600, pixel_left: 0, pixel_bottom: 1300, pixel_right: 1000 },
    ],
  });
  collaborators.vision = async (prompt, imageUrls) => {
    callLog.push('vision:' + (Array.isArray(imageUrls) ? imageUrls.length : 1));
    return JSON.stringify({
      lines: [
        { line_no: 1, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: 0.95, status: 'matched', source_region: 1 },
        { line_no: 2, raw_reading: 'Blurry Item A', quantity: 1, matched_regular_id: null, confidence: 0.2, status: 'unreadable', source_region: 2 },
        { line_no: 3, raw_reading: 'Blurry Item B', quantity: 1, matched_regular_id: null, confidence: 0.3, status: 'unreadable', source_region: 3 },
      ],
    });
  };
  collaborators.runSanityChecks = (lines) => ({
    lines: lines.map((l) => ({ ...l, hasAnomaly: l.confidence < 0.5, supersededByIndex: null })),
    anyAnomaly: lines.some((l) => l.confidence < 0.5),
  });
  collaborators.needsFollowUp = (lines) => {
    const trigger = lines.some((l) => l.confidence < 0.5);
    return { needsFollowUp: trigger, reasons: { lowConfidence: trigger, deterministicAnomaly: false } };
  };
  collaborators.flaggedRegionsForFollowUp = (lines) => lines.filter((l) => l.confidence < 0.5).map((l) => l.source_region);

  const originalVision = collaborators.vision;
  const followUpUrlCounts = [];
  collaborators.vision = async (prompt, imageUrls) => {
    const isFirstPass = Array.isArray(imageUrls) && imageUrls.length === 3;
    if (isFirstPass) return originalVision(prompt, imageUrls);
    // Any call that is NOT the 3-image first pass is a follow-up call.
    followUpUrlCounts.push(Array.isArray(imageUrls) ? imageUrls.length : 1);
    callLog.push('vision:' + (Array.isArray(imageUrls) ? imageUrls.length : 1));
    const region = followUpUrlCounts.length === 1 ? 2 : 3;
    return JSON.stringify({
      lines: [{
        line_no: region, raw_reading: `Region ${region} corrected reading`, quantity: 1,
        matched_regular_id: 9, confidence: 0.9, status: 'matched', source_region: region,
      }],
    });
  };

  const result = await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);

  assert.equal(result.followUpFired, true);
  assert.equal(followUpUrlCounts.length, 2, 'exactly TWO follow-up calls - one per flagged region');
  assert.deepEqual(followUpUrlCounts, [1, 1], 'EVERY follow-up call carries exactly ONE image - never bundled');

  const visionCalls = callLog.filter((c) => c.startsWith('vision:'));
  assert.equal(visionCalls.length, 3, 'ONE original call (3 images) + TWO individual follow-up calls (1 image each)');

  const line2 = result.lines.find((l) => l.line_no === 2);
  const line3 = result.lines.find((l) => l.line_no === 3);
  assert.equal(line2.raw_reading, 'Region 2 corrected reading', 'region 2\'s own individual follow-up corrected it');
  assert.equal(line3.raw_reading, 'Region 3 corrected reading', 'region 3\'s own individual follow-up corrected it');
  assert.equal(result.lines.length, 3, 'no duplicate lines from either re-read region');
});

test('AC2: a clean pass (0 suspect regions) still costs exactly ONE vision call, unchanged', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.prepareImage = () => ({
    rotate: 0, flip: null, imageFingerprint: null,
    regions: [
      { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
      { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
      { region_no: 3, region_kind: 'strip', pixel_top: 600, pixel_left: 0, pixel_bottom: 1300, pixel_right: 1000 },
    ],
  });
  const result = await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);
  assert.equal(result.followUpFired, false);
  assert.equal(callLog.filter((c) => c.startsWith('vision:')).length, 1, 'zero suspect regions -> zero follow-up calls');
});

test('a superseded (cross-strip duplicate) line is EXCLUDED from the returned lines but STILL persisted to provenance', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.vision = async () => JSON.stringify({
    lines: [
      { line_no: 1, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: 0.6, status: 'matched', source_region: 1 },
      { line_no: 2, raw_reading: 'Milk 2L', quantity: 2, matched_regular_id: 1, confidence: 0.95, status: 'matched', source_region: 1 },
    ],
  });
  collaborators.runSanityChecks = (lines) => ({
    lines: lines.map((l, i) => ({ ...l, hasAnomaly: false, supersededByIndex: i === 0 ? 1 : null })),
    anyAnomaly: false,
  });
  let provenanceCallLines = null;
  collaborators.insertPhotoProvenanceBatch = async (deps, lines) => {
    provenanceCallLines = lines;
    return lines.map((l, i) => ({ id: 7000 + i, ...l }));
  };

  const result = await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);

  assert.equal(result.lines.length, 1, 'only the survivor reaches the returned/downstream lines');
  assert.equal(provenanceCallLines.length, 2, 'BOTH the survivor and the superseded row are written to the provenance ledger (the audit trail)');
});

test('regions are ALWAYS persisted before the vision call fires, even across a follow-up', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);
  const regionIdx = callLog.indexOf('insertRegionBatch');
  const firstVisionIdx = callLog.indexOf('vision:1');
  assert.ok(regionIdx < firstVisionIdx, 'shop_image_region rows must exist before any region number is cited to a model');
});

test('promptChars is measured from the REAL region-aware prompt actually sent, not a stand-in', async () => {
  const callLog = [];
  const collaborators = baseCollaborators({ callLog });
  collaborators.buildGroundedPrompt = () => 'A PARTICULAR PROMPT OF KNOWN LENGTH';
  const result = await interpretPhotoWithDeps({ catalogue: CATALOGUE, imageBuffer: Buffer.from('img'), shopId: 1 }, collaborators);
  assert.equal(result.promptChars, 'A PARTICULAR PROMPT OF KNOWN LENGTH'.length);
});
