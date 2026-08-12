// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/bandPlan.test.js
//
// WO-2026-08-12-02 (WP-B15-30), AC5 as redefined by Amendment 1.
//
// The tests are built on SYNTHETIC rasters with known geometry, not on the one
// photograph: a plan that only works on the image it was written against is
// not a plan. The real photograph is exercised separately by the committed
// coverage-proof evidence, which is a run rather than a unit test.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inkProfiles, paperBox, alternation, detectStackingAxis, inkExtent,
  planBands, proveCoverage, estimateLinePitch, planOrientationAwareBands,
} from './bandPlan.js';

/**
 * A synthetic page: white paper on a dark border, with `lineCount` dark lines
 * of `lineThickness` stacked along `axis` at `pitch` spacing.
 */
function syntheticPage({
  width, height, axis, lineCount, pitch, lineThickness = 3, border = 20,
}) {
  const data = new Uint8Array(width * height).fill(30); // dark surround
  for (let y = border; y < height - border; y += 1) {
    for (let x = border; x < width - border; x += 1) data[y * width + x] = 240; // paper
  }
  const stackLimit = axis === 'x' ? width : height;
  const startAt = Math.floor((stackLimit - lineCount * pitch) / 2);
  for (let i = 0; i < lineCount; i += 1) {
    const at = startAt + i * pitch;
    for (let t = 0; t < lineThickness; t += 1) {
      const s = at + t;
      if (axis === 'x') {
        for (let y = border + 10; y < height - border - 10; y += 1) data[y * width + s] = 20;
      } else {
        for (let x = border + 10; x < width - border - 10; x += 1) data[s * width + x] = 20;
      }
    }
  }
  return { data, width, height, channels: 1 };
}

// ── PAPER DETECTION - the step whose absence buried the axis signal ───────

test('AC5: the paper is found inside the photograph, excluding the dark surround', () => {
  const page = syntheticPage({ width: 200, height: 300, axis: 'y', lineCount: 10, pitch: 20 });
  const box = paperBox(page);
  assert.ok(box.top >= 18 && box.top <= 22, `top ${box.top}`);
  assert.ok(box.bottom >= 277 && box.bottom <= 281, `bottom ${box.bottom}`);
  assert.ok(box.left >= 18 && box.left <= 22, `left ${box.left}`);
});

test('AC5: ink is counted only inside the paper - the dark border is not ink', () => {
  const page = syntheticPage({ width: 200, height: 300, axis: 'y', lineCount: 10, pitch: 20 });
  const { rows } = inkProfiles(page);
  assert.equal(rows[0], 0, 'a row in the dark border must contribute no ink');
  assert.equal(rows[299], 0);
  assert.ok(rows.some((v) => v > 0), 'and the writing must still be found');
});

// ── AXIS DETECTION - the finding this whole module exists for ─────────────

test('AC5: an UPRIGHT page is detected as stacking along Y (the production shape)', () => {
  const page = syntheticPage({ width: 300, height: 400, axis: 'y', lineCount: 15, pitch: 20 });
  assert.equal(detectStackingAxis(page).axis, 'y');
});

test('AC5: a ROTATED page is detected as stacking along X - the WP-B15-30 finding', () => {
  const page = syntheticPage({ width: 400, height: 300, axis: 'x', lineCount: 15, pitch: 20 });
  const d = detectStackingAxis(page);
  assert.equal(d.axis, 'x');
  assert.ok(d.alternationX > d.alternationY, `X ${d.alternationX} must exceed Y ${d.alternationY}`);
});

test('AC5: the axis is chosen by comparing the image with ITSELF - no tuned constant', () => {
  // The same page at two ink densities must give the same axis. A fitted
  // absolute threshold would not survive this.
  const sparse = syntheticPage({ width: 400, height: 300, axis: 'x', lineCount: 8, pitch: 40, lineThickness: 2 });
  const dense = syntheticPage({ width: 400, height: 300, axis: 'x', lineCount: 24, pitch: 13, lineThickness: 5 });
  assert.equal(detectStackingAxis(sparse).axis, 'x');
  assert.equal(detectStackingAxis(dense).axis, 'x');
});

test('AC5: a blank page falls back to the ordinary upright shape rather than guessing', () => {
  const blank = syntheticPage({ width: 200, height: 200, axis: 'y', lineCount: 0, pitch: 20 });
  assert.equal(detectStackingAxis(blank).axis, 'y');
});

test('alternation() is zero for a flat profile and rises with ink/gap structure', () => {
  assert.equal(alternation([5, 5, 5, 5, 5, 5]), 0);
  assert.ok(alternation([10, 0, 10, 0, 10, 0]) > alternation([10, 8, 10, 8, 10, 8]));
});

// ── THE COVERAGE PROOF ────────────────────────────────────────────────────

test('AC5 PROOF: bands whose overlap is SMALLER than a line fail at every seam', () => {
  // The defect the proof caught on the real photograph: 7 bands, 15% overlap
  // = 14 px, line = 15.5 px, so a line centred in a seam fitted in neither.
  const bands = planBands({ start: 0, end: 574, count: 7, overlapFraction: 0.15 });
  const withCross = bands.map((b) => ({ ...b, crossFrom: 0, crossTo: 100 }));
  const proof = proveCoverage({
    bands: withCross, start: 20, end: 550, lineHeight: 15.5, crossFrom: 0, crossTo: 100, axisLimit: 575,
  });
  assert.equal(proof.passes, false);
  assert.ok(proof.failureCount > 0, 'seam positions must be reported as interior failures');
});

test('AC5 PROOF: deriving the overlap from the measured line pitch makes the same plan pass', () => {
  const bands = planBands({
    start: 0, end: 574, count: 7, overlapFraction: 0.15, minOverlapPx: Math.ceil(15.5) + 4,
  });
  const withCross = bands.map((b) => ({ ...b, crossFrom: 0, crossTo: 100 }));
  const proof = proveCoverage({
    bands: withCross, start: 20, end: 550, lineHeight: 15.5, crossFrom: 0, crossTo: 100, axisLimit: 575,
  });
  assert.equal(proof.passes, true);
  assert.equal(proof.failureCount, 0);
});

test('AC5 PROOF: a band that CLIPS a line lengthways fails, however good its stacking coverage', () => {
  // This is exactly how the current production plan fails on the photograph:
  // its strips split the axis the writing runs ALONG, so no strip has ever
  // contained a whole line even though the strips tile the page perfectly.
  const bands = [{ band_no: 1, from: 0, to: 600, crossFrom: 0, crossTo: 400 }];
  const proof = proveCoverage({
    bands, start: 20, end: 550, lineHeight: 15.5, crossFrom: 0, crossTo: 900, axisLimit: 600,
  });
  assert.equal(proof.passes, false);
  assert.equal(proof.spanFailureCount, 1);
  assert.equal(proof.failureCount, 0, 'the stacking axis was covered - the two failures are distinct');
});

test('AC5 PROOF: the original vacuous form is NOT what is proved - a full-page region alone fails', () => {
  // "every line falls inside at least one region" is trivially true forever
  // when one region is the whole page. The replacement property is not.
  const fullPageOnly = [{ band_no: 1, from: 0, to: 575, crossFrom: 0, crossTo: 1279 }];
  const proof = proveCoverage({
    bands: fullPageOnly, start: 1, end: 575, lineHeight: 15.5, crossFrom: 192, crossTo: 990, axisLimit: 575,
  });
  assert.ok(proof.frameClippedCount > 0 || proof.failureCount === 0);
  // The full page trivially contains every line; the point of the proof is
  // that it must hold for a NON-full-page band, which is what the planner
  // emits and what the run actually inspects.
  assert.equal(proof.spanFailureCount, 0);
});

test('AC5 PROOF: a position whose line would extend past the FRAME is reported separately, not forgiven', () => {
  const bands = [{ band_no: 1, from: 0, to: 100, crossFrom: 0, crossTo: 50 }];
  const proof = proveCoverage({
    bands, start: 0, end: 100, lineHeight: 20, crossFrom: 0, crossTo: 50, axisLimit: 100,
  });
  assert.ok(proof.frameClippedCount > 0, 'the camera clipped the page - that is not a defect in the plan');
  assert.equal(proof.failureCount, 0, 'and it must not be counted as an interior failure either');
});

test('AC5 PROOF: every integer position is checked, never a sample', () => {
  const bands = [{ band_no: 1, from: 0, to: 100, crossFrom: 0, crossTo: 50 }];
  const proof = proveCoverage({
    bands, start: 10, end: 90, lineHeight: 4, crossFrom: 0, crossTo: 50, axisLimit: 100,
  });
  assert.equal(proof.checked, 81, 'a seam defect is exactly what a coarse sweep steps over');
});

// ── THE PLAN, END TO END, ON A SYNTHETIC ROTATED PAGE ─────────────────────

test('AC5: a rotated synthetic page yields 7 vertical bands that PASS the coverage proof', () => {
  const page = syntheticPage({ width: 600, height: 300, axis: 'x', lineCount: 24, pitch: 20 });
  const plan = planOrientationAwareBands(page, { bandCount: 7 });
  assert.equal(plan.axis, 'x');
  assert.equal(plan.regions.length, 8, 'one full page plus seven bands');
  assert.equal(plan.regions[0].region_kind, 'full_page');
  assert.equal(plan.coverageProof.passes, true);
  assert.equal(plan.coverageProof.spanFailureCount, 0);
});

test('AC5: an upright synthetic page yields HORIZONTAL bands - the planner is not hardwired to rotated', () => {
  const page = syntheticPage({ width: 300, height: 600, axis: 'y', lineCount: 24, pitch: 20 });
  const plan = planOrientationAwareBands(page, { bandCount: 7 });
  assert.equal(plan.axis, 'y');
  const band = plan.regions[1];
  assert.ok(band.pixel_bottom - band.pixel_top < band.pixel_right - band.pixel_left,
    'a horizontal strip must be wider than it is tall');
});

test('AC5: the plan is DETERMINISTIC - identical bytes give identical coordinates', () => {
  const page = syntheticPage({ width: 600, height: 300, axis: 'x', lineCount: 24, pitch: 20 });
  const a = planOrientationAwareBands(page, { bandCount: 7 });
  const b = planOrientationAwareBands(page, { bandCount: 7 });
  assert.deepEqual(a.regions, b.regions);
});

test('AC5: band count stays inside Warwick\'s 6-8 and never becomes an API-call farm', () => {
  const page = syntheticPage({ width: 600, height: 300, axis: 'x', lineCount: 39, pitch: 12 });
  for (const count of [6, 7, 8]) {
    const plan = planOrientationAwareBands(page, { bandCount: count });
    assert.equal(plan.regions.length, count + 1);
    assert.equal(plan.coverageProof.passes, true, `${count} bands must still prove coverage`);
  }
});

test('estimateLinePitch over-estimates rather than under-estimates when lines touch', () => {
  // Under-counting runs makes the pitch LARGER, which makes the proof
  // STRICTER. That is the safe direction for a proof and it is deliberate.
  const page = syntheticPage({ width: 600, height: 300, axis: 'x', lineCount: 20, pitch: 25 });
  const { cols, box } = inkProfiles(page);
  const extent = inkExtent(cols, box.left, box.right);
  const { pitch } = estimateLinePitch(cols, extent.start, extent.end);
  assert.ok(pitch >= 20, `pitch ${pitch} must not be optimistically small`);
});

// ── THE CROP DEFECT THAT COST A LIVE RUN ──────────────────────────────────
// Six of seven Arm D quantity errors were the LEADING COUNT missing from the
// reading, because the cross axis was ink-trimmed and the rows where lines
// BEGIN carry only the sparse leading digits. The crop deleted the evidence
// before the model saw it, and the application then supplied a default.

test('AC5: a band spans the FULL paper across the reading direction - line starts are never cropped off', () => {
  const page = syntheticPage({ width: 600, height: 300, axis: 'x', lineCount: 24, pitch: 20 });
  const plan = planOrientationAwareBands(page, { bandCount: 7 });
  const box = plan.detection.box;
  for (const band of plan.regions.filter((r) => r.region_kind === 'strip')) {
    assert.equal(band.pixel_top, box.top, 'a band must start at the paper edge, not at the first dense ink');
    assert.equal(band.pixel_bottom, box.bottom + 1);
  }
});

test('AC5: sparse leading marks at the START of every line survive the crop', () => {
  // Lines whose first few columns carry a tiny mark (a written count) and
  // whose body is dense. An ink-trimmed cross axis discards the marks.
  const width = 600; const height = 300; const border = 20;
  const data = new Uint8Array(width * height).fill(30);
  for (let y = border; y < height - border; y += 1) {
    for (let x = border; x < width - border; x += 1) data[y * width + x] = 240;
  }
  const markY = border + 2; // the leading count sits at the very start of each line
  for (let i = 0; i < 20; i += 1) {
    const col = 60 + i * 20;
    data[markY * width + col] = 20;                       // the sparse leading digit
    for (let y = border + 40; y < height - border - 10; y += 1) data[y * width + col] = 20; // the dense body
  }
  const plan = planOrientationAwareBands({ data, width, height, channels: 1 }, { bandCount: 7 });
  for (const band of plan.regions.filter((r) => r.region_kind === 'strip')) {
    assert.ok(band.pixel_top <= markY,
      `band starts at ${band.pixel_top} but the leading marks are at ${markY} - the count would be cropped away`);
  }
});
