// =====================================================================
// BUILD-015 AsdAIr - the IMAGE PREPARATION invariant.
//
// These assertions run against MUM'S ACTUAL PHOTOGRAPH - the committed bytes
// of the 17 August list, the ones the live shop ingested - not a synthetic
// fixture chosen to suit the code. The number this suite defends is the one
// that produced an invented product: 720 x 1280, about 34 pixels per
// handwritten line, sent to a vision model as-is.
//
// ⛔ THE ROTATION TESTS ARE NOT DECORATION. Rotating was the intuitive fix and
// it was MEASURED TO LOSE LINES - 37 down to 32 and 34 across two arms - while
// scale alone kept all 37 and removed the invention. A future reader who adds
// "and rotate to portrait" here will silently drop items from a shopping list.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import { prepareImage, scaleFor, MIN_SHORT_EDGE, MAX_SCALE } from './prepareImage.js';

const KNOWN_LIST = path.join(
  import.meta.dirname, '..', 'pipeline', 'testdata', 'known-list', 'mum-list-2026-08-17.jpg',
);

/** Decode whatever we actually produced, rather than believing our own
 *  provenance. A record that says 1440 and a payload that is still 720 is
 *  exactly the shape of defect this whole Work Order is about. */
async function dimensionsOf(dataUrl) {
  const { Jimp } = await import('jimp');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const image = await Jimp.read(Buffer.from(base64, 'base64'));
  return { width: image.bitmap.width, height: image.bitmap.height };
}

// ── 1. THE FLOOR, PINNED TO A LITERAL HELD OUTSIDE THE SOURCE ──────────────

test('the floor is 1440 - the smallest short edge MEASURED to read Mum\'s list cleanly', () => {
  assert.equal(MIN_SHORT_EDGE, 1440,
    'changing this needs a new measurement against the photograph, not an opinion');
  assert.ok(720 < MIN_SHORT_EDGE, 'the size Telegram actually delivers must be below the floor');
});

test('scaleFor lifts a small image, leaves a large one alone, and never inverts', () => {
  assert.equal(scaleFor(720, 1280), 2, "Mum's 17 August photograph");
  assert.equal(scaleFor(576, 1280), 3, "the 11 August photograph is smaller still");
  assert.equal(scaleFor(1440, 2560), 1, 'already at the floor - do nothing');
  assert.equal(scaleFor(2160, 3840), 1, 'comfortably above the floor - do nothing');
  assert.equal(scaleFor(4000, 6000), 1);
  assert.ok(scaleFor(50, 60) <= MAX_SCALE, 'a tiny source must not produce an unbounded payload');
});

// ── 2. THE REAL PHOTOGRAPH ─────────────────────────────────────────────────

test('THE FIX: Mum\'s 720x1280 photograph is upscaled before any model sees it', async () => {
  const { dataUrl, provenance } = await prepareImage(KNOWN_LIST);

  assert.equal(provenance.source_width, 720, 'the committed bytes are the size Telegram delivered');
  assert.equal(provenance.source_height, 1280);
  assert.equal(provenance.prepared, true);
  assert.equal(provenance.scale, 2);

  // And the PAYLOAD really is bigger - decoded, not merely claimed.
  const actual = await dimensionsOf(dataUrl);
  assert.equal(actual.width, 1440);
  assert.equal(actual.height, 2560);
  assert.ok(Math.min(actual.width, actual.height) >= MIN_SHORT_EDGE,
    'the short edge must clear the floor - below it the model invented "2 skinny cow bars"');
});

test('⛔ IT MUST NEVER ROTATE: rotation was measured to lose whole lines', async () => {
  const { dataUrl, provenance } = await prepareImage(KNOWN_LIST);
  const actual = await dimensionsOf(dataUrl);

  assert.ok(actual.height > actual.width,
    'the photograph is portrait and must stay portrait - the 90 and 270 degree arms returned 32 and 34 of 37 lines');
  assert.equal(actual.width / actual.height, provenance.source_width / provenance.source_height,
    'the aspect ratio must be untouched: scale only, never rotate, never crop');
});

test('an image already above the floor is passed through BYTE-FOR-BYTE, not re-encoded', async () => {
  // A photograph that needs no help must not be re-compressed for the sake of
  // consistency: re-encoding can only lose stroke detail.
  const big = path.join(import.meta.dirname, '..', 'pipeline', 'testdata', 'known-list', 'mum-list-2026-08-17.jpg');
  const { dataUrl, provenance } = await prepareImage(big, { minShortEdge: 320 });
  assert.equal(provenance.prepared, false);
  assert.equal(provenance.scale, 1);
  const originalBase64 = readFileSync(big).toString('base64');
  assert.ok(dataUrl.endsWith(originalBase64), 'the original bytes must travel unchanged');
});

// ── 3. PROVENANCE: WHAT WAS DONE, AND NOTHING THE HOUSEHOLD OWNS ───────────

test('the provenance records the read without becoming a copy of the shopping list', async () => {
  const { provenance } = await prepareImage(KNOWN_LIST);
  for (const key of ['source_width', 'source_height', 'scale', 'width', 'height', 'floor']) {
    assert.equal(typeof provenance[key], 'number', `${key} must be recorded`);
  }
  const serialised = JSON.stringify(provenance).toLowerCase();
  for (const word of ['beef', 'heinz', 'lucozade', 'tresemme']) {
    assert.ok(!serialised.includes(word), 'the record carries dimensions, never list content');
  }
});

test('an unreadable or unsupported file is refused rather than silently sent', async () => {
  await assert.rejects(() => prepareImage(path.join(import.meta.dirname, 'nope.jpg')), /not found/);
  await assert.rejects(() => prepareImage(path.join(import.meta.dirname, 'package.json')), /unsupported image type/);
});
