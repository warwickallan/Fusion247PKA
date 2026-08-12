// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/imagePrep.js
//
// WO-2026-08-11-B15-VISION-01, AC1: deterministic, model-free image
// preparation ahead of the one household-aware vision call.
//
// PURE. No I/O beyond reading the bytes it is handed, no model call, no
// randomness, no clock (the returned shape carries no timestamp - a caller
// that wants one stamps it, this module never invents one).
//
// ── HONEST SCOPE, STATED ONCE HERE, NOT TO BE QUIETLY WIDENED ────────────
// `dependency_policy: no-new-runtime-deps` (critical rule 8) makes real pixel
// manipulation - rotating, deskewing and cropping actual image bytes into new
// strip images to attach to the vision request - unbuildable in this module
// without a JPEG/PNG codec, which this repo has never carried and which this
// Work Order does not authorise adding. That question (WO-2026-08-11-B15-
// VISION-01 read-back Finding 2) is with Warwick as of this file's authorship
// and is NOT resolved here.
//
// What THIS module delivers is everything that genuinely needs no decoded
// bitmap - and it is real, useful, zero-dependency work, not a stub:
//   * image dimensions, read from the JPEG/PNG header bytes directly
//     (bounded, well-defined byte parsing - not a decode);
//   * the EXIF orientation tag, read the same way, and the rotation/flip it
//     implies (a FACT about the file, computed without touching a pixel);
//   * the full deterministic REGION PLAN - numbered, overlapping strip
//     COORDINATES plus a full_page region, matching the shape
//     asdair.shop_image_region (migration 020) expects to persist;
//   * a border-trim default, deterministic but a DECLARED HEURISTIC (a fixed
//     fractional margin), not real content-adaptive edge detection - real
//     border detection needs decoded pixels for the same reason rotation
//     does, and is named as a residual below rather than faked.
//
// Actually RENDERING the prepared bitmap and the per-region crops - the step
// that turns this plan into real image bytes to attach as extra `image_url`
// parts on the vision call - is NOT this module's job even once a library is
// authorised: it is deps.js's `interpretPhoto` seam, which this Work Order's
// Amendment 2 explicitly holds pending Finding 2. This module is written so
// that seam has nothing left to invent: every number a renderer would need
// (which pixels, which order, which region is which) is already decided here,
// deterministically, and unit-tested independent of any renderer.
// =====================================================================

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------
// 1. Dimensions - JPEG (SOF markers) and PNG (IHDR), no decode.
// ---------------------------------------------------------------------

/**
 * Read {width, height} from a JPEG buffer by walking its marker segments to
 * the first Start-Of-Frame marker (0xC0-0xCF, excluding the DHT/JPG-reserved
 * markers 0xC4, 0xC8, 0xCC). This is header parsing, not decoding: no pixel
 * is ever touched.
 *
 * @param {Buffer} buf
 * @returns {{width:number, height:number}}
 */
function jpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error('imagePrep: not a JPEG (missing SOI marker 0xFFD8)');
  }
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      throw new Error('imagePrep: malformed JPEG - expected a marker at byte ' + offset);
    }
    const marker = buf[offset + 1];
    // Markers with no length-prefixed payload: standalone markers we can skip
    // by exactly two bytes. 0xD8/0xD9 (SOI/EOI) and 0xD0-0xD7 (RST0-RST7).
    if (marker === 0xd9) break; // EOI - no frame found
    if (marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
    if (offset + 4 > buf.length) break;
    const segmentLength = buf.readUInt16BE(offset + 2);
    const isSofMarker = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSofMarker) {
      if (offset + 9 > buf.length) throw new Error('imagePrep: truncated JPEG SOF segment');
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    if (marker === 0xda) break; // Start-Of-Scan - no SOF seen before entropy data
    offset += 2 + segmentLength;
  }
  throw new Error('imagePrep: no Start-Of-Frame marker found - not a readable JPEG');
}

/** Read {width, height} from a PNG buffer's IHDR chunk (fixed offsets). */
function pngDimensions(buf) {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('imagePrep: not a PNG (missing signature)');
  }
  // IHDR is always the first chunk, immediately after the 8-byte signature:
  // 4 bytes length, 4 bytes "IHDR", 4 bytes width, 4 bytes height, ...
  const chunkType = buf.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') throw new Error('imagePrep: PNG missing leading IHDR chunk');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Detect format from the magic bytes and read {width, height}. Supports
 * exactly the two formats models.mjs's realInterpretPhoto already accepts
 * (see the MIME table in pipeline/deps.js): JPEG and PNG. WEBP is accepted
 * for upload but has no dimension reader here yet - reported honestly via
 * the thrown error's message rather than a guessed dimension.
 *
 * @param {Buffer} buf - the raw image bytes.
 * @returns {{width:number, height:number, format:'jpeg'|'png'}}
 */
export function readImageDimensions(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('imagePrep: readImageDimensions requires a Buffer');
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return { ...jpegDimensions(buf), format: 'jpeg' };
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { ...pngDimensions(buf), format: 'png' };
  }
  throw new Error('imagePrep: unrecognised image format (only JPEG and PNG headers are read)');
}

// ---------------------------------------------------------------------
// 2. EXIF orientation - JPEG only (PNG carries no EXIF orientation tag).
// ---------------------------------------------------------------------

// The eight EXIF Orientation values (TIFF tag 0x0112) and the rotation +
// flip they mean, per the standard EXIF orientation table. `rotate` is
// degrees CLOCKWISE needed to display the image upright; `flip` is applied
// BEFORE the rotation. This is a lookup of a published spec, not a guess.
const EXIF_ORIENTATION_TRANSFORM = Object.freeze({
  1: { rotate: 0, flip: null },
  2: { rotate: 0, flip: 'horizontal' },
  3: { rotate: 180, flip: null },
  4: { rotate: 180, flip: 'horizontal' },
  5: { rotate: 90, flip: 'horizontal' },
  6: { rotate: 90, flip: null },
  7: { rotate: 270, flip: 'horizontal' },
  8: { rotate: 270, flip: null },
});

/**
 * Read the EXIF Orientation tag (0x0112) out of a JPEG's APP1 segment, if
 * present. Returns `null` for a PNG, a JPEG with no EXIF, or a JPEG whose
 * EXIF carries no orientation tag - `null` is the honest "nothing to
 * correct" value, never guessed as 1 (upright).
 *
 * This walks marker segments exactly as jpegDimensions does and parses the
 * TIFF header inside APP1 far enough to find one tag. It does not decode
 * anything beyond that tag's 12-byte IFD entry.
 *
 * @param {Buffer} buf
 * @returns {1|2|3|4|5|6|7|8|null}
 */
export function readExifOrientation(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) return null; // EOI / start-of-scan, no APP1 seen
    if (marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (marker === 0xe1) { // APP1 - candidate EXIF segment
      const segStart = offset + 4;
      const exifHeader = buf.toString('ascii', segStart, segStart + 6);
      if (exifHeader === 'Exif  ') {
        const tiffStart = segStart + 6;
        return readOrientationFromTiff(buf, tiffStart);
      }
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readOrientationFromTiff(buf, tiffStart) {
  if (tiffStart + 8 > buf.length) return null;
  const byteOrderMark = buf.toString('ascii', tiffStart, tiffStart + 2);
  const little = byteOrderMark === 'II';
  if (!little && byteOrderMark !== 'MM') return null;
  const readU16 = (o) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const readU32 = (o) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd0Offset = tiffStart + readU32(tiffStart + 4);
  if (ifd0Offset + 2 > buf.length) return null;
  const entryCount = readU16(ifd0Offset);
  for (let i = 0; i < entryCount; i += 1) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (entryOffset + 12 > buf.length) return null;
    const tag = readU16(entryOffset);
    if (tag === 0x0112) {
      const value = readU16(entryOffset + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/**
 * The rotation/flip a given EXIF orientation implies. `null` orientation
 * (no tag, or not a JPEG) means no correction is known - returns the
 * identity transform rather than guessing.
 *
 * @param {1|2|3|4|5|6|7|8|null} orientation
 */
export function transformForOrientation(orientation) {
  if (orientation === null || orientation === undefined) return { rotate: 0, flip: null };
  const t = EXIF_ORIENTATION_TRANSFORM[orientation];
  if (!t) throw new Error('imagePrep: unknown EXIF orientation value ' + String(orientation));
  return t;
}

// ---------------------------------------------------------------------
// 3. Border trim - a DECLARED HEURISTIC, not content-adaptive detection.
// ---------------------------------------------------------------------

// Real edge/content detection needs decoded pixels (same reason rotation
// does - see the module header). Absent that, a fixed fractional margin is
// the honest, deterministic default: it trims a small, constant border
// (photographed lists routinely carry a table edge / hand / phone-frame
// sliver) without claiming to have found the page's real content box. Named
// here as a residual, not silently promoted to "border detection".
export const DEFAULT_BORDER_TRIM_FRACTION = 0.02;

/**
 * Compute a trimmed pixel box for a page of the given (already
 * orientation-corrected) dimensions, trimming `fraction` off each edge.
 * @returns {{top:number, left:number, bottom:number, right:number}}
 */
export function borderTrimBox(preparedWidth, preparedHeight, fraction = DEFAULT_BORDER_TRIM_FRACTION) {
  if (!(preparedWidth > 0) || !(preparedHeight > 0)) {
    throw new Error('imagePrep: borderTrimBox requires positive prepared dimensions');
  }
  if (!(fraction >= 0) || fraction >= 0.5) {
    throw new Error('imagePrep: borderTrimBox fraction must be in [0, 0.5)');
  }
  const marginX = Math.round(preparedWidth * fraction);
  const marginY = Math.round(preparedHeight * fraction);
  return {
    top: marginY,
    left: marginX,
    bottom: preparedHeight - marginY,
    right: preparedWidth - marginX,
  };
}

// ---------------------------------------------------------------------
// 4. Region plan - the numbered, overlapping strip coordinates.
// ---------------------------------------------------------------------

export const DEFAULT_STRIP_OVERLAP_FRACTION = 0.15;
// One strip per ~700 prepared-px of height is a deliberately simple,
// deterministic density choice - dense enough that a line near a strip seam
// is still fully inside at least one strip, cheap enough not to inflate the
// single vision request past what "one request per normal case" (AC2) means.
const TARGET_STRIP_HEIGHT_PX = 700;
const MIN_STRIPS = 2;
const MAX_STRIPS = 6;

/**
 * Build the full, deterministic region plan for one prepared page:
 * region 1 is always the full page (bounds null, per migration 020's own
 * shape for `region_kind = 'full_page'`); regions 2..N are numbered,
 * overlapping horizontal strips covering the (border-trimmed) page top to
 * bottom, each spanning the full trimmed width.
 *
 * PURE: no I/O, no image bytes read here - only the dimensions already
 * established by readImageDimensions + the rotation already established by
 * transformForOrientation.
 *
 * @param {object} args
 * @param {number} args.width - original (pre-rotation) pixel width.
 * @param {number} args.height - original (pre-rotation) pixel height.
 * @param {number} args.rotate - 0|90|180|270, from transformForOrientation.
 * @param {number} [args.overlapFraction] - fraction of one strip's height
 *   shared with the next (0 = no overlap, must stay < 1).
 * @param {number} [args.borderTrimFraction]
 * @returns {{preparedWidth:number, preparedHeight:number, regions:Array}}
 */
export function planRegions({
  width, height, rotate = 0,
  overlapFraction = DEFAULT_STRIP_OVERLAP_FRACTION,
  borderTrimFraction = DEFAULT_BORDER_TRIM_FRACTION,
}) {
  if (!(width > 0) || !(height > 0)) {
    throw new Error('imagePrep: planRegions requires positive width/height');
  }
  if (![0, 90, 180, 270].includes(rotate)) {
    throw new Error('imagePrep: planRegions rotate must be one of 0, 90, 180, 270');
  }
  if (!(overlapFraction >= 0) || overlapFraction >= 1) {
    throw new Error('imagePrep: planRegions overlapFraction must be in [0, 1)');
  }

  // A 90/270 rotation swaps which original axis becomes "prepared" width vs
  // height - the strip plan always runs over the PREPARED (post-rotation)
  // page, since that is what region_no is stamped into the prompt against.
  const preparedWidth = rotate === 90 || rotate === 270 ? height : width;
  const preparedHeight = rotate === 90 || rotate === 270 ? width : height;

  const trimBox = borderTrimBox(preparedWidth, preparedHeight, borderTrimFraction);
  const contentHeight = trimBox.bottom - trimBox.top;
  const contentWidth = trimBox.right - trimBox.left;

  const rawStripCount = Math.round(contentHeight / TARGET_STRIP_HEIGHT_PX);
  const stripCount = Math.min(MAX_STRIPS, Math.max(MIN_STRIPS, rawStripCount));

  // Strip height chosen so that N overlapping strips of this height, spaced
  // by (1 - overlapFraction) * stripHeight, exactly cover contentHeight:
  //   contentHeight = stripHeight * (1 + (stripCount - 1) * (1 - overlapFraction))
  const coverageFactor = 1 + (stripCount - 1) * (1 - overlapFraction);
  const stripHeight = Math.ceil(contentHeight / coverageFactor);
  const stride = Math.round(stripHeight * (1 - overlapFraction));

  const regions = [
    { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
  ];

  for (let i = 0; i < stripCount; i += 1) {
    const top = trimBox.top + i * stride;
    // The final strip is clamped to the trimmed bottom rather than
    // overshooting it - overlap is deliberate at seams, not past the page edge.
    const bottom = i === stripCount - 1 ? trimBox.bottom : Math.min(trimBox.bottom, top + stripHeight);
    regions.push({
      region_no: regions.length + 1,
      region_kind: 'strip',
      pixel_top: top,
      pixel_left: trimBox.left,
      pixel_bottom: bottom,
      pixel_right: trimBox.right,
    });
  }

  return { preparedWidth, preparedHeight, regions };
}

// ---------------------------------------------------------------------
// 5. Fingerprint - matches shop_image_region.image_fingerprint's shape
//    check (migration 020: `^[0-9a-f]{16,128}$`).
// ---------------------------------------------------------------------

/** SHA-256 hex digest of the raw image bytes. 64 lowercase hex chars. */
export function imageFingerprint(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('imagePrep: imageFingerprint requires a Buffer');
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------
// 6. ORIENTATION-AWARE REGION PLAN - reading direction from INK, not EXIF.
//
// WP-B15-31 AC2. This is the canonical production home of the behaviour
// proven in WP-B15-30; agenticVisionPrototype/bandPlan.js now RE-EXPORTS
// from here rather than carrying a second copy. Two copies of a geometry
// this subtle would drift, and the prototype is where it was proven, not
// where it belongs.
//
// ── THE DEFECT THIS FIXES ───────────────────────────────────────────────
// `planRegions()` above always cuts HORIZONTAL strips, because the only
// orientation signal it has is the EXIF tag. On the real photograph that tag
// reads NULL, and the page is rotated ~90 degrees: the handwritten lines run
// along the image's Y axis and STACK along X, in two columns. So every strip
// ever cut sliced every line PERPENDICULAR, and no strip has ever contained a
// whole line - only the full-page region has. Cutting MORE strips on that axis
// makes it worse, slicing each line into more fragments. Overlap does not
// rescue it: the failure is not lines falling near a seam, it is no line being
// whole in any band.
//
// ── WHY THIS STAYS DEPENDENCY-FREE AND PURE ─────────────────────────────
// It takes a DECODED GREYSCALE RASTER in and gives COORDINATES out. The decode
// belongs to imageRender.js, which already owns `sharp`. That split is the
// whole reason this module's "PURE. No I/O..." header is still true and this
// package's offline suite still runs with zero dependencies installed - and it
// is why `prepareImage` was NOT made async (rejected explicitly: it would have
// falsified this module's own header and deps.js's fully-offline claim).
// ---------------------------------------------------------------------

/** Below this grey value a pixel counts as ink. Handwriting on white paper. */
export const INK_THRESHOLD = 110;

/** Warwick's band count for this page. 6-8 sensible regions, not 39 calls. */
export const DEFAULT_BAND_COUNT = 7;

/** Warwick's modest overlap, carried over from the strip planner above. */
export const DEFAULT_BAND_OVERLAP_FRACTION = 0.15;

/**
 * The deterministic enlargement applied to each region BEFORE inspection.
 *
 * Not a taste choice and not a tunable: measured. Correctly oriented bands at
 * 1x scored 28/39 with 7 inventions; the SAME bands at 3x scored 39/39 with 0.
 * A crop is not a zoom - `extract` alone hands the model pixels it already had.
 */
export const DEFAULT_REGION_UPSCALE = 3;

/**
 * Find the PAPER inside the photograph.
 *
 * ⚠️ NOT OPTIONAL, and leaving it out was a real defect in the first cut. A
 * phone photograph of a sheet of paper carries black letterbox bars and
 * whatever the sheet was resting on, and those pixels are DARKER than the
 * handwriting. Counting them as ink put the written extent at the full image,
 * buried the alternation signal, and spent bands on furniture.
 *
 * The comparison is against the image's OWN mean brightness, so there is no
 * tuned constant and no assumption about how much of the frame the sheet fills.
 */
export function paperBox({ data, width, height, channels = 1 }) {
  if (!data || !(width > 0) || !(height > 0)) throw new Error('imagePrep: paperBox requires a sized raster');
  let total = 0;
  for (let i = 0; i < width * height; i += 1) total += data[i * channels];
  const meanBrightness = total / (width * height);

  // FIRST and LAST bright position, not the longest contiguous bright run. The
  // run form was brittle in exactly the way that matters: writing interrupts
  // the paper, so a densely written sheet fragments into many short bright runs
  // and the "longest" one is a GAP BETWEEN TWO LINES rather than the page.
  const brightSpan = (meanAt, n) => {
    let start = 0;
    let end = n - 1;
    while (start < n && meanAt(start) <= meanBrightness) start += 1;
    while (end > start && meanAt(end) <= meanBrightness) end -= 1;
    return { start: Math.min(start, end), end };
  };

  const rowMean = (y) => {
    let s = 0;
    for (let x = 0; x < width; x += 1) s += data[(y * width + x) * channels];
    return s / width;
  };
  const vertical = brightSpan(rowMean, height);
  const colMean = (x) => {
    let s = 0;
    for (let y = vertical.start; y <= vertical.end; y += 1) s += data[(y * width + x) * channels];
    return s / (vertical.end - vertical.start + 1);
  };
  const horizontal = brightSpan(colMean, width);
  return {
    top: vertical.start, bottom: vertical.end, left: horizontal.start, right: horizontal.end,
  };
}

/**
 * Sum ink along each row and each column, WITHIN the paper only. Profiles are
 * indexed in FULL-IMAGE coordinates with zeroes outside the paper box, so every
 * coordinate emitted here is directly usable as a crop box with no offset step
 * to get wrong.
 */
export function inkProfiles(raster, box = null) {
  const {
    data, width, height, channels = 1,
  } = raster;
  if (!data || !(width > 0) || !(height > 0)) throw new Error('imagePrep: inkProfiles requires a sized raster');
  const b = box ?? paperBox(raster);
  const rows = new Array(height).fill(0);
  const cols = new Array(width).fill(0);
  for (let y = b.top; y <= b.bottom; y += 1) {
    for (let x = b.left; x <= b.right; x += 1) {
      if (data[(y * width + x) * channels] < INK_THRESHOLD) { rows[y] += 1; cols[x] += 1; }
    }
  }
  return { rows, cols, box: b };
}

/**
 * How strongly a profile ALTERNATES between ink and gap. Lines stacked along an
 * axis alternate strongly along that axis and smoothly along the other.
 * Mean absolute first difference over mean level, so it is scale-free: it
 * compares an image with ITSELF on its two axes and needs no tuned constant.
 */
export function alternation(profile) {
  if (!Array.isArray(profile) || profile.length < 3) return 0;
  const mean = profile.reduce((s, v) => s + v, 0) / profile.length;
  if (mean <= 0) return 0;
  let diff = 0;
  for (let i = 1; i < profile.length; i += 1) diff += Math.abs(profile[i] - profile[i - 1]);
  return (diff / (profile.length - 1)) / mean;
}

/**
 * Decide which axis the handwritten lines STACK along - THE READING DIRECTION,
 * TAKEN FROM IMAGE EVIDENCE RATHER THAN FROM EXIF.
 *
 * 'y' - ordinary upright page: bands are horizontal strips (planRegions' shape).
 * 'x' - the page is rotated: bands must be VERTICAL, or every band cuts every line.
 *
 * Ties fall to 'y', which is the ordinary upright page and the previous
 * production behaviour - so an image carrying no signal degrades to exactly
 * what this module did before.
 */
export function detectStackingAxis(raster, box = null) {
  const { rows, cols, box: paper } = inkProfiles(raster, box);
  // Only the paper's own span carries signal; the zeroes outside it would
  // dilute the mean and flatten both measurements towards each other.
  const alternationY = alternation(rows.slice(paper.top, paper.bottom + 1));
  const alternationX = alternation(cols.slice(paper.left, paper.right + 1));
  return {
    axis: alternationX > alternationY ? 'x' : 'y',
    alternationX,
    alternationY,
    ratio: alternationY > 0 ? alternationX / alternationY : Infinity,
    box: paper,
  };
}

/** First and last position along an axis carrying a non-trivial amount of ink. */
export function inkExtent(profile, from = 0, to = profile.length - 1, floorFraction = 0.1) {
  const slice = profile.slice(from, to + 1);
  const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
  const floor = mean * floorFraction;
  let start = from;
  let end = to;
  while (start < to && profile[start] <= floor) start += 1;
  while (end > start && profile[end] <= floor) end -= 1;
  return { start, end, length: end - start + 1 };
}

/**
 * Estimate line pitch along the stacking axis from the ink profile itself.
 * Where writing is dense enough that adjacent lines touch this UNDER-counts the
 * runs and therefore OVER-estimates the pitch, which makes the coverage proof
 * STRICTER rather than more permissive - the safe direction for a proof.
 */
export function estimateLinePitch(profile, start, end) {
  const slice = profile.slice(start, end + 1);
  const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
  let runs = 0;
  let inRun = false;
  for (const v of slice) {
    if (v > mean && !inRun) { runs += 1; inRun = true; } else if (v <= mean) { inRun = false; }
  }
  const lineCount = Math.max(1, runs);
  return { lineCount, pitch: (end - start + 1) / lineCount };
}

/**
 * `count` overlapping bands covering [start, end], cut PERPENDICULAR to the
 * reading direction so each band holds a few WHOLE lines rather than fragments.
 *
 * ── THE OVERLAP IS DERIVED FROM MEASURED LINE PITCH, NOT ASSUMED ────────
 * At 7 bands over 575 px a 15% overlap is 14 px while a line is 15.5 px: a line
 * centred in a seam fitted in NEITHER band and the coverage proof failed at all
 * six seams. "Modest overlap so a line near a boundary cannot vanish" is only
 * true if the overlap EXCEEDS a line. The requested fraction is a FLOOR.
 */
export function planBands({
  start, end, count = DEFAULT_BAND_COUNT,
  overlapFraction = DEFAULT_BAND_OVERLAP_FRACTION, minOverlapPx = 0,
}) {
  if (!(end > start)) throw new Error('imagePrep: planBands end must exceed start');
  if (!(count >= 1)) throw new Error('imagePrep: planBands count must be at least 1');
  if (!(overlapFraction >= 0) || overlapFraction >= 1) throw new Error('imagePrep: planBands overlapFraction must be in [0, 1)');
  const extent = end - start + 1;
  let bandSize = Math.ceil(extent / (1 + (count - 1) * (1 - overlapFraction)));
  let stride = Math.round(bandSize * (1 - overlapFraction));
  if (minOverlapPx > 0 && (bandSize - stride) < minOverlapPx) {
    bandSize = Math.ceil((extent + (count - 1) * minOverlapPx) / count);
    stride = bandSize - minOverlapPx;
  }
  const bands = [];
  for (let i = 0; i < count; i += 1) {
    const from = start + i * stride;
    const to = i === count - 1 ? end : Math.min(end, from + bandSize - 1);
    bands.push({ band_no: i + 1, from, to });
  }
  return bands;
}

/**
 * THE COVERAGE PROOF, in the form that actually proves something.
 *
 * "Every line falls inside at least one region" is trivially and permanently
 * TRUE because the full-page region covers the page. It proves nothing. The
 * real property, and it needs no per-line coordinates - which matters, because
 * the only source of those would be a model reading the photograph, i.e. the
 * instrument under test:
 *
 *   for EVERY position on the stacking axis, a band of one line-height centred
 *   there must be FULLY CONTAINED, with margin, inside at least one NON-full-
 *   page band; AND no band may clip a line lengthways along the reading
 *   direction.
 */
export function proveCoverage({
  bands, start, end, lineHeight, margin = 2,
  crossFrom = null, crossTo = null, axisLimit = null,
}) {
  if (!Array.isArray(bands) || bands.length === 0) throw new Error('imagePrep: proveCoverage requires bands');
  if (!(lineHeight > 0)) throw new Error('imagePrep: proveCoverage requires a positive lineHeight');
  const half = lineHeight / 2;
  const interiorFailures = [];
  const frameClipped = [];
  let checked = 0;

  // PART 2 FIRST: does a band even span a WHOLE line lengthways? A band that
  // clips a line along the READING direction is exactly as broken as one that
  // cuts it across, and it is the failure mode of the strip planner above.
  const spanFailures = (crossFrom === null || crossTo === null)
    ? []
    : bands.filter((b) => !(b.crossFrom <= crossFrom && b.crossTo >= crossTo))
      .map((b) => ({ band_no: b.band_no, crossFrom: b.crossFrom, crossTo: b.crossTo }));

  // PART 1: every position, not a sample. A seam failure is exactly the defect
  // a coarse sweep steps over.
  for (let p = start; p <= end; p += 1) {
    checked += 1;
    const lineFrom = p - half;
    const lineTo = p + half;
    if (bands.some((b) => (lineFrom - margin) >= b.from && (lineTo + margin) <= b.to)) continue;
    // A line centred within half a line-height of the image edge extends beyond
    // the FRAME. No band plan can contain it - the camera clipped the page.
    // Reported separately and honestly, never counted as a defect in the plan
    // and never quietly dropped from the denominator.
    const clipped = axisLimit !== null && ((lineFrom - margin) < 0 || (lineTo + margin) > axisLimit);
    if (clipped) frameClipped.push({ position: p, lineFrom, lineTo });
    else interiorFailures.push({ position: p, lineFrom, lineTo });
  }

  return {
    passes: interiorFailures.length === 0 && spanFailures.length === 0,
    checked,
    failures: interiorFailures,
    failureCount: interiorFailures.length,
    frameClipped,
    frameClippedCount: frameClipped.length,
    spanFailures,
    spanFailureCount: spanFailures.length,
    worstPosition: interiorFailures.length > 0 ? interiorFailures[Math.floor(interiorFailures.length / 2)].position : null,
  };
}

/**
 * THE PRODUCTION ORIENTATION-AWARE REGION PLAN, in one call.
 *
 * Same output contract as `planRegions` - region 1 is the full page with
 * all-null bounds, regions 2..N are numbered strips - so every consumer
 * (migration 020's `shop_image_region`, the prompt's region numbering, the
 * renderer) is unchanged. What differs is that the strips are cut on the axis
 * the WRITING actually stacks along, and span the full paper across the
 * reading direction.
 *
 * @param {{data:Uint8Array|Buffer, width:number, height:number, channels?:number}} raster
 *   a DECODED GREYSCALE raster - see imageRender.decodeGreyscaleRaster.
 */
export function planOrientationAwareRegions(raster, {
  bandCount = DEFAULT_BAND_COUNT, overlapFraction = DEFAULT_BAND_OVERLAP_FRACTION, margin = 2,
} = {}) {
  const { rows, cols, box } = inkProfiles(raster);
  const detection = detectStackingAxis(raster, box);
  const stackingProfile = detection.axis === 'x' ? cols : rows;
  const stackFrom = detection.axis === 'x' ? box.left : box.top;
  const stackTo = detection.axis === 'x' ? box.right : box.bottom;
  const crossFrom = detection.axis === 'x' ? box.top : box.left;
  const crossTo = detection.axis === 'x' ? box.bottom : box.right;
  const axisLimit = detection.axis === 'x' ? raster.width - 1 : raster.height - 1;

  const extent = inkExtent(stackingProfile, stackFrom, stackTo);

  // ── THE CROSS AXIS IS **NOT** INK-TRIMMED, AND THIS COST A LIVE RUN ─────
  // The cross extent used to be ink-trimmed with a floor at 10% of mean ink,
  // and the rows where lines BEGIN carry only the leading digits - far less ink
  // than the rows through the middle of the words. The trim cut the start of
  // every line off the crop. A band therefore spans the FULL PAPER across the
  // reading direction: the cost is a slightly larger crop, the alternative is
  // deleting written evidence before anybody looks at it.
  const cross = { start: crossFrom, end: crossTo, length: crossTo - crossFrom + 1 };
  const pitch = estimateLinePitch(stackingProfile, extent.start, extent.end);

  // ⚠️ BANDS MUST BE PADDED PAST THE INK. A line CENTRED on the first inked
  // position extends half a line-height above it, into blank paper. Without the
  // pad that line can never be "fully contained with margin" and the proof
  // fails at both outer edges - 70 failing positions on the real photograph.
  const pad = Math.ceil(pitch.pitch / 2) + margin;
  const planFrom = Math.max(0, extent.start - pad);
  const planTo = Math.min(axisLimit, extent.end + pad);

  const minOverlapPx = Math.ceil(pitch.pitch) + 2 * margin;
  const bands = planBands({
    start: planFrom, end: planTo, count: bandCount, overlapFraction, minOverlapPx,
  }).map((b) => ({ ...b, crossFrom: cross.start, crossTo: cross.end }));

  // The PROOF runs over the INK extent - the property is about lines, and
  // padding the plan must never weaken what is being proved.
  const coverageProof = proveCoverage({
    bands,
    start: extent.start,
    end: extent.end,
    lineHeight: pitch.pitch,
    margin,
    crossFrom: cross.start,
    crossTo: cross.end,
    axisLimit,
  });

  const strips = bands.map((b) => (detection.axis === 'x'
    ? {
      region_no: b.band_no + 1,
      region_kind: 'strip',
      pixel_left: b.from,
      pixel_right: b.to + 1,
      pixel_top: cross.start,
      pixel_bottom: cross.end + 1,
    }
    : {
      region_no: b.band_no + 1,
      region_kind: 'strip',
      pixel_top: b.from,
      pixel_bottom: b.to + 1,
      pixel_left: cross.start,
      pixel_right: cross.end + 1,
    }));

  return {
    axis: detection.axis,
    detection,
    stackingExtent: extent,
    crossExtent: cross,
    linePitch: pitch,
    bands,
    preparedWidth: raster.width,
    preparedHeight: raster.height,
    regions: [
      {
        region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null,
      },
      ...strips,
    ],
    coverageProof,
  };
}

// ---------------------------------------------------------------------
// 7. The one entry point deps.js's interpretPhoto seam will call.
// ---------------------------------------------------------------------

/**
 * Deterministically prepare one photographed page: read its real dimensions
 * and EXIF orientation from the bytes, compute the rotation that would be
 * needed to display it upright, and build the full numbered region plan
 * against the PREPARED (post-rotation) page.
 *
 * Returns everything a renderer needs to decide WHAT to produce; it does not
 * produce pixels itself (see the module header for why, and for what is
 * deferred).
 *
 * @param {Buffer} buf - the raw, as-received image bytes.
 * @returns {{
 *   format: 'jpeg'|'png',
 *   originalWidth: number, originalHeight: number,
 *   rotate: 0|90|180|270, flip: 'horizontal'|null,
 *   preparedWidth: number, preparedHeight: number,
 *   regions: Array<{region_no:number, region_kind:'full_page'|'strip',
 *     pixel_top:number|null, pixel_left:number|null,
 *     pixel_bottom:number|null, pixel_right:number|null}>,
 *   imageFingerprint: string,
 * }}
 */
export function prepareImage(buf) {
  const { width, height, format } = readImageDimensions(buf);
  const orientation = format === 'jpeg' ? readExifOrientation(buf) : null;
  const { rotate, flip } = transformForOrientation(orientation);
  const { preparedWidth, preparedHeight, regions } = planRegions({ width, height, rotate });
  return {
    format,
    originalWidth: width,
    originalHeight: height,
    rotate,
    flip,
    preparedWidth,
    preparedHeight,
    regions,
    imageFingerprint: imageFingerprint(buf),
  };
}
