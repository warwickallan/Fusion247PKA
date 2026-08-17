// =====================================================================
// BUILD-015 AsdAIr - transcribe/prepareImage.js
//
// MAKE THE HANDWRITING RESOLVABLE BEFORE ASKING ANYTHING TO READ IT.
//
// ── THE MEASUREMENT THIS EXISTS FOR (2026-08-17) ────────────────────────────
// Mum's list reaches us from Telegram at 720 x 1280. That is not a bug in the
// download - it IS Telegram's largest compressed size, and pickLargestPhoto
// already asks for it. Across 37 handwritten lines it leaves roughly 34 PIXELS
// PER LINE, which is below what a vision model can resolve. It did not fail
// honestly at that size. It produced something plausible instead:
//
//     "2 sliced roast beef"  ->  "2 skinny cow bars"     beef drifted to cow
//
// Same model, same prompt, same photograph, ONE variable changed:
//
//     input                     lines   invented   line 14    line 16
//     720 x 1280 (as shipped)     37        1        wrong    merged away
//     rotate 90 + 3x              32        0      correct         -
//     rotate 270 + 3x             34        0       absent         -
//     2x upscale, no rotation     37        0      correct      correct
//     3x upscale, no rotation     37        0      correct      correct
//
// ── TWO CONCLUSIONS, AND THE SECOND ONE IS THE EASY MISTAKE ─────────────────
// SCALE fixes the invention and keeps every line. ROTATION COSTS RECALL - five
// and three lines respectively, simply gone - and buys nothing, because the
// model reads sideways text perfectly well once the strokes are resolvable.
// The arms were run separately, which is the only reason we know that; a single
// "rotate and scale" arm would have shipped a line-losing step as a success.
//
//     ⛔ THIS MODULE MUST NEVER ROTATE. It is not an oversight to be tidied up.
//
// ── THE FLOOR IS MEASURED, NOT A MAGIC MULTIPLIER ──────────────────────────
// "3x" is a property of one 720px photograph, not a rule. What generalises is
// the floor the short edge has to clear, so a larger source is left alone and a
// smaller one is lifted by however much it needs.
//
// PURE ASCII. No network, no database, no credentials. One dependency: jimp,
// which is pure JavaScript with no native build step.
import { extname, resolve as resolvePath } from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { SUPPORTED_IMAGE_TYPES, MAX_IMAGE_BYTES, validateImageRef, readImageAsDataUrl } from './transcribeList.js';

// ── THE FLOOR ───────────────────────────────────────────────────────────────
// 1440 is the SMALLEST short edge MEASURED to read Mum's list cleanly (the 2x
// arm above). 720 is measured to fail. Anything between 721 and 1439 is
// UNTESTED, and this constant deliberately sits at the proven-good end of that
// gap rather than in the middle of it: the cost of being generous is some
// arithmetic and a bigger upload, and the cost of being stingy is the wrong
// food. Raising it needs a new measurement, not an opinion.
export const MIN_SHORT_EDGE = 1440;

// A guard against an absurd payload from a tiny or malformed source. Neither
// has been hit in practice; they exist so a strange input degrades into a
// large-but-sane request rather than a gigabyte of pixels.
export const MAX_SCALE = 4;
export const MAX_LONG_EDGE = 6000;

// Upscaled handwriting is exactly where JPEG artefacts would undo the point, so
// this is deliberately high. It is not "best quality" - that would inflate the
// upload for no measured gain.
export const JPEG_QUALITY = 90;

/**
 * PURE. How much must this image grow before a model can resolve the strokes?
 *
 * Integer factors only, because that is what was measured and because a whole
 * multiple avoids the resampling smear that a fractional one introduces on thin
 * pen strokes. Returns 1 when the source already clears the floor - in which
 * case NOTHING is done to the image at all, and it is passed through untouched
 * rather than re-encoded for the sake of consistency.
 */
export function scaleFor(width, height, { minShortEdge = MIN_SHORT_EDGE, maxScale = MAX_SCALE, maxLongEdge = MAX_LONG_EDGE } = {}) {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  if (!Number.isFinite(shortEdge) || shortEdge <= 0) return 1;
  if (shortEdge >= minShortEdge) return 1;

  let scale = Math.ceil(minShortEdge / shortEdge);
  if (scale > maxScale) scale = maxScale;
  while (scale > 1 && longEdge * scale > maxLongEdge) scale -= 1;
  return scale;
}

/**
 * Prepare a photograph for one vision request.
 *
 * @returns {Promise<{dataUrl: string, provenance: object}>}
 *
 * `provenance` is the record of WHAT WAS DONE, and it is the second half of
 * this fix. On 17 August nobody could tell a good read from a lucky one,
 * because nothing anywhere recorded the pixels the model was actually given.
 * It carries dimensions and a scale factor - never the photograph, never a
 * product, never a line of the list.
 */
export async function prepareImage(imagePath, {
  statImpl = statSync,
  readImpl = readFileSync,
  minShortEdge = MIN_SHORT_EDGE,
} = {}) {
  const ref = validateImageRef(imagePath, { statImpl });

  const { Jimp } = await import('jimp');
  const image = await Jimp.read(ref.path);
  const sourceWidth = image.bitmap.width;
  const sourceHeight = image.bitmap.height;
  const scale = scaleFor(sourceWidth, sourceHeight, { minShortEdge });

  if (scale === 1) {
    // ALREADY BIG ENOUGH. The original bytes go up exactly as they arrived -
    // re-encoding a photograph that needs no help can only lose information.
    return {
      dataUrl: readImageAsDataUrl(ref, { readImpl }),
      provenance: {
        source_width: sourceWidth,
        source_height: sourceHeight,
        scale: 1,
        width: sourceWidth,
        height: sourceHeight,
        prepared: false,
        reason: `short edge ${Math.min(sourceWidth, sourceHeight)} already clears the ${minShortEdge} floor`,
        floor: minShortEdge,
      },
    };
  }

  // ⛔ SCALE ONLY. See the header: rotation was measured to LOSE LINES.
  image.scale(scale);
  const buffer = await image.getBuffer('image/jpeg', { quality: JPEG_QUALITY });

  return {
    dataUrl: `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`,
    provenance: {
      source_width: sourceWidth,
      source_height: sourceHeight,
      scale,
      width: image.bitmap.width,
      height: image.bitmap.height,
      prepared: true,
      reason: `short edge ${Math.min(sourceWidth, sourceHeight)} is below the ${minShortEdge} floor - roughly ${Math.round(Math.max(sourceWidth, sourceHeight) / 37)} pixels per line on a 37-line list`,
      floor: minShortEdge,
      bytes: buffer.length,
    },
  };
}

export { SUPPORTED_IMAGE_TYPES, MAX_IMAGE_BYTES, validateImageRef };
