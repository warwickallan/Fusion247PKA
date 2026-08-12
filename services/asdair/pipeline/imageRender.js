// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/imageRender.js
//
// WO-2026-08-11-B15-VISION-01, Amendment 3 (Warwick, 2026-08-12): the real
// pixel rendering imagePrep.js's own header named as deferred pending a
// dependency decision. Warwick chose "add a minimal image library
// (Recommended)" over a coordinate-only fallback - `sharp`, pinned to
// 0.35.3, scoped to THIS package's own package.json only (not
// obsidiwikai's, not cockpit's).
//
// WHY THIS IS A SEPARATE FILE FROM imagePrep.js, DELIBERATELY: imagePrep.js
// still says, truthfully, "PURE. No I/O..." - every function in it runs
// with zero dependencies installed, which is what let its own tests (and
// every file that merely reads its coordinate math) stay part of this
// package's dependency-free offline suite. Splitting the sharp-dependent
// RENDERING into its own module keeps that claim true rather than quietly
// falsifying it, and keeps deps.js's own "the whole test suite binds fakes
// and runs FULLY OFFLINE" header true too - deps.js lazily `await import()`s
// this module only inside the one function that needs it (interpretPhoto),
// exactly as it already lazily imports vision()/extractJson().
//
// `sharp` IS imported at the top of THIS file, deliberately - a module
// whose entire job is rendering pixels has no honest zero-dep path, and
// hiding that behind a lazy import here would only move the same real
// requirement one file down without changing it.
// =====================================================================

'use strict';

import sharp from 'sharp';

/**
 * Produce the "prepared" (upright, orientation-corrected) full-page image
 * buffer imagePrep.js's planRegions() coordinates are computed against.
 * Applies the flip named by transformForOrientation() BEFORE the rotation
 * - the same order EXIF's own orientation semantics require, and the same
 * order imagePrep.js's own doc comment states.
 *
 * @param {Buffer} originalBuf
 * @param {{rotate:0|90|180|270, flip:'horizontal'|null}} transform - from
 *   imagePrep.js's transformForOrientation().
 * @returns {Promise<Buffer>} a JPEG buffer, whatever the input format.
 */
export async function renderPreparedPage(originalBuf, transform) {
  let pipeline = sharp(originalBuf);
  if (transform.flip === 'horizontal') pipeline = pipeline.flop();
  if (transform.rotate !== 0) pipeline = pipeline.rotate(transform.rotate);
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

/**
 * Render ONE region's actual crop from an already-prepared (upright) page
 * buffer. `full_page` returns the whole prepared page, re-encoded, never
 * re-cropped (matches its all-null pixel bounds - there is nothing to
 * extract). A `strip` region is cropped to its exact
 * (pixel_top, pixel_left, pixel_bottom, pixel_right) box.
 *
 * @param {Buffer} preparedBuf - from renderPreparedPage().
 * @param {{region_kind:'full_page'|'strip', pixel_top:number|null,
 *   pixel_left:number|null, pixel_bottom:number|null, pixel_right:number|null}} region
 * @returns {Promise<Buffer>} a JPEG buffer of exactly that region.
 */
export async function renderRegionCrop(preparedBuf, region) {
  if (region.region_kind === 'full_page') {
    return sharp(preparedBuf).jpeg({ quality: 90 }).toBuffer();
  }
  const width = region.pixel_right - region.pixel_left;
  const height = region.pixel_bottom - region.pixel_top;
  if (!(width > 0) || !(height > 0)) {
    throw new Error('imageRender: region has a non-positive extract box (left=' + region.pixel_left
      + ' top=' + region.pixel_top + ' right=' + region.pixel_right + ' bottom=' + region.pixel_bottom + ')');
  }
  return sharp(preparedBuf)
    .extract({ left: region.pixel_left, top: region.pixel_top, width, height })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Render EVERY region in one imagePrep.js planRegions() plan against one
 * original image buffer: prepare the upright page once, then crop each
 * region from that SAME prepared buffer (never re-preparing per region -
 * one rotation, N crops, so every region's pixels are guaranteed to agree
 * with the coordinates planRegions() computed them against).
 *
 * @param {Buffer} originalBuf
 * @param {{rotate:0|90|180|270, flip:'horizontal'|null}} transform
 * @param {Array<object>} regions - planRegions().regions.
 * @returns {Promise<Array<{region_no:number, buffer:Buffer}>>} in the SAME
 *   order as `regions`.
 */
export async function renderAllRegions(originalBuf, transform, regions) {
  const preparedBuf = await renderPreparedPage(originalBuf, transform);
  const rendered = [];
  for (const region of regions) {
    const buffer = await renderRegionCrop(preparedBuf, region);
    rendered.push({ region_no: region.region_no, buffer });
  }
  return rendered;
}

/** `Buffer` -> `data:image/jpeg;base64,...` - the shape models.mjs's vision() expects per image. */
export function toDataUrl(buffer) {
  return 'data:image/jpeg;base64,' + buffer.toString('base64');
}
