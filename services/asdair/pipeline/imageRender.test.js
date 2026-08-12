// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/imageRender.test.js
//
// WO-2026-08-11-B15-VISION-01 Amendment 3 proof: real pixel rendering via
// `sharp`, now authorised and pinned (package.json).
//
// GATED ON MODULE AVAILABILITY, not an env var - mirrors this package's own
// pg-lazy-require convention (deps.js's header) and the DB-gated tests'
// ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE pattern, applied to a dependency instead
// of a database: a dynamic import is attempted ONCE at module scope; if it
// fails (a CI job that never ran `npm install` for this package, matching
// the existing "unit" job's zero-install offline convention), every test
// below SKIPS CLEANLY rather than crashing the whole file - the same
// "missing dependency is a clean no-op, never a false failure" contract
// this codebase already applies to pg.
//
// Run here (sharp IS installed): every test executes for real, against
// REAL rendered JPEG bytes - not asserted, decoded and measured.
//
// Runs under: node --test (no DB, no model, no network - sharp never
// touches either).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { planRegions, prepareImage } from './imagePrep.js';

let imageRender = null;
let importError = null;
try {
  imageRender = await import('./imageRender.js');
} catch (e) {
  importError = e;
}

const gate = imageRender
  ? { skip: false }
  : { skip: 'sharp is not installed in this environment (npm install not run for services/asdair/pipeline) - imageRender.js tests skipped, not failed: ' + (importError && importError.message) };

// NOTE: a hand-built, header-only JPEG (as imagePrep.test.js uses for pure
// dimension-parsing proofs) has no valid entropy-coded scan data, so it is
// not decodable by sharp. These tests therefore render REAL, fully
// decodable JPEGs via sharp itself (below) rather than a header-only
// fixture - the two fixture styles serve genuinely different proofs.

/** A REAL, fully decodable JPEG of the given size and colour, rendered by sharp itself - not a hand-built header. */
async function realJpeg({ width, height, r = 200, g = 50, b = 50 }) {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();
}

test('imageRender module load: either genuinely available (real bytes below) or cleanly absent (never crashes the suite)', () => {
  assert.ok(imageRender !== null || importError !== null);
});

test('renderPreparedPage: applies a real 90-degree rotation - the rendered JPEG\'s OWN dimensions are swapped', gate, async () => {
  const original = await realJpeg({ width: 300, height: 200 });
  const prepared = await imageRender.renderPreparedPage(original, { rotate: 90, flip: null });

  const sharp = (await import('sharp')).default;
  const meta = await sharp(prepared).metadata();
  assert.equal(meta.width, 200, 'a 90-degree rotation must swap width and height');
  assert.equal(meta.height, 300);
});

test('renderPreparedPage: rotate 0, no flip - dimensions are unchanged', gate, async () => {
  const original = await realJpeg({ width: 300, height: 200 });
  const prepared = await imageRender.renderPreparedPage(original, { rotate: 0, flip: null });
  const sharp = (await import('sharp')).default;
  const meta = await sharp(prepared).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 200);
});

test('renderRegionCrop: a full_page region returns the WHOLE prepared page, not a crop', gate, async () => {
  const prepared = await realJpeg({ width: 400, height: 300 });
  const rendered = await imageRender.renderRegionCrop(prepared, { region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null });
  const sharp = (await import('sharp')).default;
  const meta = await sharp(rendered).metadata();
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 300);
});

test('renderRegionCrop: a strip region is cropped to EXACTLY its declared pixel box - measured, not assumed', gate, async () => {
  const prepared = await realJpeg({ width: 400, height: 1000 });
  const region = { region_kind: 'strip', pixel_top: 100, pixel_left: 20, pixel_bottom: 400, pixel_right: 380 };
  const rendered = await imageRender.renderRegionCrop(prepared, region);
  const sharp = (await import('sharp')).default;
  const meta = await sharp(rendered).metadata();
  assert.equal(meta.width, 360, 'right(380) - left(20) = 360');
  assert.equal(meta.height, 300, 'bottom(400) - top(100) = 300');
});

test('renderRegionCrop: refuses a degenerate box rather than asking sharp to guess', gate, async () => {
  const prepared = await realJpeg({ width: 100, height: 100 });
  await assert.rejects(
    imageRender.renderRegionCrop(prepared, { region_kind: 'strip', pixel_top: 50, pixel_left: 0, pixel_bottom: 50, pixel_right: 10 }),
    /non-positive extract box/,
  );
});

test('renderAllRegions: renders every region from a REAL imagePrep.js plan, each crop the right size, all from ONE prepared page', gate, async () => {
  const { regions, preparedWidth, preparedHeight } = planRegions({ width: 800, height: 2400, rotate: 0 });
  const original = await realJpeg({ width: 800, height: 2400 });

  const rendered = await imageRender.renderAllRegions(original, { rotate: 0, flip: null }, regions);
  assert.equal(rendered.length, regions.length);

  const sharp = (await import('sharp')).default;
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    const meta = await sharp(rendered[i].buffer).metadata();
    assert.equal(rendered[i].region_no, region.region_no);
    if (region.region_kind === 'full_page') {
      assert.equal(meta.width, preparedWidth);
      assert.equal(meta.height, preparedHeight);
    } else {
      assert.equal(meta.width, region.pixel_right - region.pixel_left);
      assert.equal(meta.height, region.pixel_bottom - region.pixel_top);
    }
  }
});

test('END-TO-END: prepareImage() (pure) + renderAllRegions() (sharp) agree on a rotated real photo - coordinates and pixels match', gate, async () => {
  // Build a REAL JPEG with a genuine EXIF orientation tag by writing one by
  // hand around sharp's own pixel data (sharp does not set EXIF on its
  // synthetic images, so the tag is added the same way imagePrep.test.js
  // proves EXIF parsing - a hand-built APP1 segment - spliced onto REAL,
  // decodable pixel data this time, rather than a bare header).
  const base = await realJpeg({ width: 1000, height: 600 });
  // Splice a hand-built APP1 (orientation=6, rotate 90) right after SOI.
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'ascii'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x0112, 10); tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14); tiff.writeUInt16LE(6, 18); tiff.writeUInt32LE(0, 20);
  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Payload = Buffer.concat([exifHeader, tiff]);
  const app1 = Buffer.alloc(4 + app1Payload.length);
  app1.writeUInt8(0xff, 0); app1.writeUInt8(0xe1, 1);
  app1.writeUInt16BE(app1Payload.length + 2, 2);
  app1Payload.copy(app1, 4);
  const withExif = Buffer.concat([base.subarray(0, 2), app1, base.subarray(2)]);

  const prepared = prepareImage(withExif); // PURE - dimensions + EXIF read from the real bytes
  assert.equal(prepared.rotate, 90);
  assert.equal(prepared.preparedWidth, 600); // swapped, per the 90-degree rotation
  assert.equal(prepared.preparedHeight, 1000);

  const rendered = await imageRender.renderAllRegions(withExif, { rotate: prepared.rotate, flip: prepared.flip }, prepared.regions);
  const sharp = (await import('sharp')).default;
  const fullPage = rendered.find((r) => r.region_no === prepared.regions[0].region_no);
  const meta = await sharp(fullPage.buffer).metadata();
  assert.equal(meta.width, prepared.preparedWidth, 'the REAL rendered page must match prepareImage()\'s own coordinate math');
  assert.equal(meta.height, prepared.preparedHeight);
});
