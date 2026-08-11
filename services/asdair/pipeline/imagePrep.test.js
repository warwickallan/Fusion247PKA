// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/imagePrep.test.js
//
// WO-2026-08-11-B15-VISION-01, AC1 proof. Every fixture below is a
// hand-built, MINIMAL, synthetic JPEG/PNG header - no real photograph, no
// binary test asset, no new dependency. That is deliberate: it proves the
// BYTE-LEVEL parsing against a known-exact input, and it keeps this suite
// runnable offline with zero fixtures to maintain.
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readImageDimensions, readExifOrientation, transformForOrientation,
  borderTrimBox, planRegions, imageFingerprint, prepareImage,
  DEFAULT_BORDER_TRIM_FRACTION, DEFAULT_STRIP_OVERLAP_FRACTION,
} from './imagePrep.js';

// ---------------------------------------------------------------------
// Fixture builders - minimal, spec-correct headers, nothing else.
// ---------------------------------------------------------------------

/** A minimal JPEG: SOI, one SOF0 segment carrying width/height, EOI. */
function buildJpeg({ width, height, exifOrientation = null }) {
  const parts = [Buffer.from([0xff, 0xd8])]; // SOI

  if (exifOrientation !== null) {
    // APP1 "Exif\0\0" + little-endian TIFF header + one IFD0 entry
    // (tag 0x0112 Orientation, type SHORT, count 1, value in the next 2
    // bytes of the 4-byte value field) + a null next-IFD offset.
    const tiff = Buffer.alloc(8 + 2 + 12 + 4);
    tiff.write('II', 0, 'ascii'); // little-endian
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4); // IFD0 offset, relative to TIFF start
    tiff.writeUInt16LE(1, 8); // one entry
    tiff.writeUInt16LE(0x0112, 10); // tag: Orientation
    tiff.writeUInt16LE(3, 12); // type: SHORT
    tiff.writeUInt32LE(1, 14); // count
    tiff.writeUInt16LE(exifOrientation, 18); // value (first 2 bytes of the 4-byte field)
    tiff.writeUInt32LE(0, 20); // next IFD offset: none

    const exifHeader = Buffer.from('Exif\0\0', 'ascii');
    const app1Payload = Buffer.concat([exifHeader, tiff]);
    const app1 = Buffer.alloc(4 + app1Payload.length);
    app1.writeUInt8(0xff, 0);
    app1.writeUInt8(0xe1, 1);
    app1.writeUInt16BE(app1Payload.length + 2, 2); // length INCLUDES itself, not the marker
    app1Payload.copy(app1, 4);
    parts.push(app1);
  }

  // SOF0: marker(2) + length(2, includes itself) + precision(1) + height(2)
  // + width(2) + numComponents(1) + numComponents*3 bytes.
  const numComponents = 1;
  const sofLength = 2 + 1 + 2 + 2 + 1 + numComponents * 3;
  const sof = Buffer.alloc(2 + sofLength);
  sof.writeUInt8(0xff, 0);
  sof.writeUInt8(0xc0, 1);
  sof.writeUInt16BE(sofLength, 2);
  sof.writeUInt8(8, 4); // precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof.writeUInt8(numComponents, 9);
  sof.writeUInt8(1, 10); sof.writeUInt8(0x11, 11); sof.writeUInt8(0, 12);
  parts.push(sof);

  parts.push(Buffer.from([0xff, 0xd9])); // EOI
  return Buffer.concat(parts);
}

/** A minimal PNG: signature + IHDR chunk carrying width/height. */
function buildPng({ width, height }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // colour type: truecolour
  const chunk = Buffer.alloc(4 + 4 + 13 + 4); // length + type + data + crc(unchecked)
  chunk.writeUInt32BE(13, 0);
  chunk.write('IHDR', 4, 'ascii');
  ihdrData.copy(chunk, 8);
  return Buffer.concat([signature, chunk]);
}

// ---------------------------------------------------------------------
// 1. Dimensions
// ---------------------------------------------------------------------

test('readImageDimensions: reads real width/height from a JPEG SOF0 segment', () => {
  const jpeg = buildJpeg({ width: 1920, height: 2560 });
  const dims = readImageDimensions(jpeg);
  assert.deepEqual(dims, { width: 1920, height: 2560, format: 'jpeg' });
});

test('readImageDimensions: reads real width/height from a PNG IHDR chunk', () => {
  const png = buildPng({ width: 800, height: 600 });
  const dims = readImageDimensions(png);
  assert.deepEqual(dims, { width: 800, height: 600, format: 'png' });
});

test('readImageDimensions: refuses an unrecognised format rather than guessing', () => {
  assert.throws(() => readImageDimensions(Buffer.from('not an image', 'utf8')),
    /unrecognised image format/);
});

test('readImageDimensions: refuses a JPEG with no SOF marker rather than guessing', () => {
  const noSof = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // SOI immediately followed by EOI
  assert.throws(() => readImageDimensions(noSof), /no Start-Of-Frame marker/);
});

// ---------------------------------------------------------------------
// 2. EXIF orientation
// ---------------------------------------------------------------------

test('readExifOrientation: reads a real orientation tag out of APP1', () => {
  const jpeg = buildJpeg({ width: 100, height: 200, exifOrientation: 6 });
  assert.equal(readExifOrientation(jpeg), 6);
});

test('readExifOrientation: null for a JPEG with no EXIF - never guessed as 1', () => {
  const jpeg = buildJpeg({ width: 100, height: 200 });
  assert.equal(readExifOrientation(jpeg), null);
});

test('readExifOrientation: null for a PNG (no EXIF orientation concept)', () => {
  const png = buildPng({ width: 100, height: 200 });
  assert.equal(readExifOrientation(png), null);
});

test('transformForOrientation: every one of the 8 EXIF values maps to a known rotate/flip', () => {
  const expected = {
    1: { rotate: 0, flip: null },
    2: { rotate: 0, flip: 'horizontal' },
    3: { rotate: 180, flip: null },
    4: { rotate: 180, flip: 'horizontal' },
    5: { rotate: 90, flip: 'horizontal' },
    6: { rotate: 90, flip: null },
    7: { rotate: 270, flip: 'horizontal' },
    8: { rotate: 270, flip: null },
  };
  for (const [orientation, transform] of Object.entries(expected)) {
    assert.deepEqual(transformForOrientation(Number(orientation)), transform);
  }
});

test('transformForOrientation: null orientation is the identity transform, not a guess', () => {
  assert.deepEqual(transformForOrientation(null), { rotate: 0, flip: null });
});

// ---------------------------------------------------------------------
// 3. Border trim
// ---------------------------------------------------------------------

test('borderTrimBox: trims a symmetric fixed-fraction margin off every edge', () => {
  const box = borderTrimBox(1000, 2000, 0.05);
  assert.deepEqual(box, { top: 100, left: 50, bottom: 1900, right: 950 });
});

test('borderTrimBox: uses the declared default fraction when none is given', () => {
  const withDefault = borderTrimBox(1000, 1000);
  const explicit = borderTrimBox(1000, 1000, DEFAULT_BORDER_TRIM_FRACTION);
  assert.deepEqual(withDefault, explicit);
});

test('borderTrimBox: refuses a fraction that would erase the page', () => {
  assert.throws(() => borderTrimBox(1000, 1000, 0.5), /fraction must be in/);
});

// ---------------------------------------------------------------------
// 4. Region plan
// ---------------------------------------------------------------------

test('planRegions: region 1 is always full_page with all-null bounds (matches migration 020\'s CHECK)', () => {
  const { regions } = planRegions({ width: 1200, height: 3000, rotate: 0 });
  assert.equal(regions[0].region_no, 1);
  assert.equal(regions[0].region_kind, 'full_page');
  assert.equal(regions[0].pixel_top, null);
  assert.equal(regions[0].pixel_left, null);
  assert.equal(regions[0].pixel_bottom, null);
  assert.equal(regions[0].pixel_right, null);
});

test('planRegions: strip regions are numbered sequentially from 2, each with all-four bounds set', () => {
  const { regions } = planRegions({ width: 1200, height: 3500, rotate: 0 });
  const strips = regions.slice(1);
  assert.ok(strips.length >= 2, 'expected at least MIN_STRIPS strips for a tall page');
  strips.forEach((r, i) => {
    assert.equal(r.region_no, i + 2);
    assert.equal(r.region_kind, 'strip');
    assert.ok(Number.isInteger(r.pixel_top) && Number.isInteger(r.pixel_left));
    assert.ok(Number.isInteger(r.pixel_bottom) && Number.isInteger(r.pixel_right));
    assert.ok(r.pixel_bottom > r.pixel_top, 'a strip must have positive height');
    assert.ok(r.pixel_right > r.pixel_left, 'a strip must have positive width');
  });
});

test('planRegions: consecutive strips genuinely overlap - a seam line is never in zero strips', () => {
  const { regions } = planRegions({ width: 1200, height: 4000, rotate: 0, overlapFraction: DEFAULT_STRIP_OVERLAP_FRACTION });
  const strips = regions.slice(1);
  for (let i = 0; i < strips.length - 1; i += 1) {
    assert.ok(strips[i + 1].pixel_top < strips[i].pixel_bottom,
      'strip ' + (i + 2) + ' must start before strip ' + (i + 1) + ' ends');
  }
});

test('planRegions: the last strip never overshoots the trimmed page bottom', () => {
  const { regions, preparedHeight } = planRegions({ width: 1200, height: 4123, rotate: 0 });
  const trimBox = borderTrimBox(1200, preparedHeight);
  const lastStrip = regions[regions.length - 1];
  assert.equal(lastStrip.pixel_bottom, trimBox.bottom);
});

test('planRegions: a 90-degree rotation swaps prepared width and height', () => {
  const upright = planRegions({ width: 1200, height: 3000, rotate: 0 });
  const rotated = planRegions({ width: 1200, height: 3000, rotate: 90 });
  assert.equal(rotated.preparedWidth, upright.preparedHeight);
  assert.equal(rotated.preparedHeight, upright.preparedWidth);
});

test('planRegions: strip count is deterministic and bounded (same input -> same plan, always)', () => {
  const a = planRegions({ width: 1200, height: 3000, rotate: 0 });
  const b = planRegions({ width: 1200, height: 3000, rotate: 0 });
  assert.deepEqual(a, b);
  const stripCount = a.regions.length - 1;
  assert.ok(stripCount >= 2 && stripCount <= 6, 'strip count must stay inside the declared MIN/MAX bounds');
});

test('planRegions: refuses a non-90-multiple rotation rather than silently truncating it', () => {
  assert.throws(() => planRegions({ width: 100, height: 100, rotate: 45 }), /rotate must be one of/);
});

// ---------------------------------------------------------------------
// 5. Fingerprint
// ---------------------------------------------------------------------

test('imageFingerprint: deterministic, and shaped as migration 020 requires (16-128 lowercase hex)', () => {
  const buf = buildJpeg({ width: 10, height: 10 });
  const fp = imageFingerprint(buf);
  assert.match(fp, /^[0-9a-f]{16,128}$/);
  assert.equal(imageFingerprint(buf), fp, 'must be deterministic for identical bytes');
});

test('imageFingerprint: different bytes produce different fingerprints', () => {
  const a = imageFingerprint(buildJpeg({ width: 10, height: 10 }));
  const b = imageFingerprint(buildJpeg({ width: 11, height: 10 }));
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------
// 6. prepareImage - the one entry point
// ---------------------------------------------------------------------

test('prepareImage: end-to-end on a rotated JPEG - dimensions, rotation and region plan all agree', () => {
  const jpeg = buildJpeg({ width: 1000, height: 2200, exifOrientation: 6 }); // rotate 90, no flip
  const prepared = prepareImage(jpeg);
  assert.equal(prepared.format, 'jpeg');
  assert.equal(prepared.originalWidth, 1000);
  assert.equal(prepared.originalHeight, 2200);
  assert.equal(prepared.rotate, 90);
  assert.equal(prepared.flip, null);
  assert.equal(prepared.preparedWidth, 2200);
  assert.equal(prepared.preparedHeight, 1000);
  assert.equal(prepared.regions[0].region_kind, 'full_page');
  assert.ok(prepared.regions.length > 1);
  assert.match(prepared.imageFingerprint, /^[0-9a-f]{64}$/);
});

test('prepareImage: a PNG with no EXIF concept still produces a full region plan', () => {
  const png = buildPng({ width: 1500, height: 2100 });
  const prepared = prepareImage(png);
  assert.equal(prepared.format, 'png');
  assert.equal(prepared.rotate, 0);
  assert.equal(prepared.preparedWidth, 1500);
  assert.equal(prepared.preparedHeight, 2100);
});
