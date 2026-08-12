// =====================================================================
// BUILD-015 AsdAIr - WP-B15-31 AC2
//
// The orientation-aware region plan, tested where it now LIVES: the production
// module, not the prototype. Warwick: "That is acceptance-critical and must NOT
// remain outside the final integrated path."
//
// Every raster here is SYNTHETIC and built in this file, so these tests need no
// image on disk, no `sharp`, no credentials and no network - they run in the
// same fully-offline suite as the rest of imagePrep.js.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planOrientationAwareRegions, planRegions, detectStackingAxis, paperBox,
  DEFAULT_REGION_UPSCALE,
} from './imagePrep.js';

// ---------------------------------------------------------------------
// A synthetic page: white paper on a dark surround, with ruled lines of "ink".
// `vertical: true` writes lines that RUN down the image and STACK across it -
// the real photograph's rotated, EXIF-null shape.
// ---------------------------------------------------------------------
function syntheticPage({
  width, height, margin = 20, pitch = 16, inkThickness = 5, vertical = false,
}) {
  const data = new Uint8Array(width * height).fill(20); // dark surround
  const set = (x, y, v) => { data[y * width + x] = v; };
  for (let y = margin; y < height - margin; y += 1) {
    for (let x = margin; x < width - margin; x += 1) set(x, y, 245); // paper
  }
  // Lines of writing, stacking along one axis and running along the other.
  const stackFrom = margin + pitch;
  const stackTo = (vertical ? width : height) - margin - pitch;
  const runFrom = margin + 6;
  const runTo = (vertical ? height : width) - margin - 6;
  for (let s = stackFrom; s < stackTo; s += pitch) {
    for (let t = 0; t < inkThickness; t += 1) {
      for (let r = runFrom; r < runTo; r += 1) {
        if (vertical) set(Math.min(width - 1, s + t), r, 30);
        else set(r, Math.min(height - 1, s + t), 30);
      }
    }
  }
  return { data, width, height, channels: 1 };
}

/** Does every strip contain at least one WHOLE line along the writing direction? */
function everyStripHoldsWholeLines(regions, { vertical, margin, width, height }) {
  const strips = regions.filter((r) => r.region_kind === 'strip');
  const runFrom = margin + 6;
  const runTo = (vertical ? height : width) - margin - 6;
  return strips.every((r) => (vertical
    // lines run down the image: a strip must span the full vertical run
    ? r.pixel_top <= runFrom && r.pixel_bottom >= runTo
    // lines run across the image: a strip must span the full horizontal run
    : r.pixel_left <= runFrom && r.pixel_right >= runTo));
}

// ---------------------------------------------------------------------
// AC2 - reading direction from IMAGE EVIDENCE, not EXIF
// ---------------------------------------------------------------------

test('AC2 a ROTATED page (lines running down, stacking across) is detected as axis x from ink alone', () => {
  const raster = syntheticPage({ width: 400, height: 900, vertical: true });
  const detection = detectStackingAxis(raster);
  assert.equal(detection.axis, 'x', 'the writing stacks across the image, so bands must be vertical');
  assert.ok(detection.alternationX > detection.alternationY);
});

test('AC2 an UPRIGHT page is detected as axis y - the ordinary case still behaves as before', () => {
  const raster = syntheticPage({ width: 900, height: 400, vertical: false });
  assert.equal(detectStackingAxis(raster).axis, 'y');
});

test('AC2 EXIF is NOT consulted - the plan is derived with no orientation tag available at all', () => {
  // The real photograph's EXIF orientation reads null. The planner takes a
  // raster and nothing else: there is no tag to consult even if it wanted one.
  const raster = syntheticPage({ width: 400, height: 900, vertical: true });
  const plan = planOrientationAwareRegions(raster);
  assert.equal(plan.axis, 'x');
  assert.ok(plan.regions.length > 1);
});

// ---------------------------------------------------------------------
// AC2 - whole lines preserved, and the production defect demonstrated
// ---------------------------------------------------------------------

test('AC2 THE DEFECT: the EXIF-only strip planner cuts ACROSS every line on a rotated page', () => {
  const geom = { width: 400, height: 900, margin: 20, vertical: true };
  const raster = syntheticPage(geom);
  // planRegions only ever cuts horizontal strips; on a rotated page the lines
  // run vertically, so no strip can span a whole line lengthways.
  const old = planRegions({ width: raster.width, height: raster.height, rotate: 0 });
  assert.equal(
    everyStripHoldsWholeLines(old.regions, geom), false,
    'this is the acceptance-critical production defect - if it ever passes, the test is not measuring it',
  );
});

test('AC2 THE FIX: every strip of the orientation-aware plan holds WHOLE lines', () => {
  const geom = { width: 400, height: 900, margin: 20, vertical: true };
  const plan = planOrientationAwareRegions(syntheticPage(geom));
  assert.equal(everyStripHoldsWholeLines(plan.regions, geom), true);
});

test('AC2 the coverage proof PASSES on a rotated page and reports no band clipping a line lengthways', () => {
  const plan = planOrientationAwareRegions(syntheticPage({ width: 400, height: 900, vertical: true }));
  assert.equal(plan.coverageProof.spanFailureCount, 0);
  assert.equal(plan.coverageProof.failureCount, 0, 'no interior position may be uncovered');
  assert.equal(plan.coverageProof.passes, true);
  assert.ok(plan.coverageProof.checked > 100, 'every position is checked, not a sample');
});

test('AC2 MUTATION: force the axis to the EXIF-era default and the whole-line property FAILS', () => {
  const geom = { width: 400, height: 900, margin: 20, vertical: true };
  const raster = syntheticPage(geom);
  const correct = planOrientationAwareRegions(raster);
  assert.equal(everyStripHoldsWholeLines(correct.regions, geom), true);

  // THE MUTATION: remove the orientation logic by taking the axis the old
  // planner always assumed. If this still passes, the test above proves nothing.
  const box = paperBox(raster);
  const mutated = planRegions({ width: raster.width, height: raster.height, rotate: 0 });
  assert.equal(
    everyStripHoldsWholeLines(mutated.regions, geom), false,
    'MUTATION DID NOT BITE - removing orientation-awareness must break the whole-line property',
  );
  assert.ok(box.right > box.left && box.bottom > box.top);
});

// ---------------------------------------------------------------------
// AC2 - contract compatibility, so nothing downstream had to change
// ---------------------------------------------------------------------

test('AC2 region 1 is still full_page with all-null bounds (migration 020 CHECK) and strips number from 2', () => {
  const plan = planOrientationAwareRegions(syntheticPage({ width: 400, height: 900, vertical: true }));
  const [first, ...rest] = plan.regions;
  assert.equal(first.region_no, 1);
  assert.equal(first.region_kind, 'full_page');
  assert.deepEqual(
    [first.pixel_top, first.pixel_left, first.pixel_bottom, first.pixel_right],
    [null, null, null, null],
  );
  rest.forEach((r, i) => {
    assert.equal(r.region_no, i + 2);
    assert.equal(r.region_kind, 'strip');
    for (const k of ['pixel_top', 'pixel_left', 'pixel_bottom', 'pixel_right']) {
      assert.equal(typeof r[k], 'number', `${k} must be a real coordinate on a strip`);
    }
  });
});

test('AC2 the plan is DETERMINISTIC - the same raster always yields the same regions', () => {
  const a = planOrientationAwareRegions(syntheticPage({ width: 400, height: 900, vertical: true }));
  const b = planOrientationAwareRegions(syntheticPage({ width: 400, height: 900, vertical: true }));
  assert.deepEqual(a.regions, b.regions);
  assert.equal(a.axis, b.axis);
});

test('AC2 the enlargement applied before inspection is a fixed, declared factor', () => {
  assert.equal(DEFAULT_REGION_UPSCALE, 3);
});

test('AC2 imagePrep stays PURE and dependency-free - its own header claim, asserted', async () => {
  // If the orientation planner had been built by making prepareImage async and
  // importing sharp here, this import would drag a native dependency into the
  // offline suite. That option was explicitly rejected; this pins the decision.
  const mod = await import('./imagePrep.js');
  assert.equal(typeof mod.planOrientationAwareRegions, 'function');
  assert.equal(typeof mod.prepareImage, 'function');
  // prepareImage remains SYNCHRONOUS: an async one would be a promise here.
  const jpegHeader = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x01, 0x11, 0x00,
    0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
  ]);
  const prepared = mod.prepareImage(jpegHeader);
  assert.equal(typeof prepared.then, 'undefined', 'prepareImage must not become a promise');
  assert.equal(prepared.originalWidth, 200);
  assert.equal(prepared.originalHeight, 100);
});
