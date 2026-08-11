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
// 6. The one entry point deps.js's interpretPhoto seam will call.
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
