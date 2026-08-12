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
export async function renderRegionCrop(preparedBuf, region, { upscale = 1 } = {}) {
  if (region.region_kind === 'full_page') {
    return sharp(preparedBuf).jpeg({ quality: 90 }).toBuffer();
  }
  const width = region.pixel_right - region.pixel_left;
  const height = region.pixel_bottom - region.pixel_top;
  if (!(width > 0) || !(height > 0)) {
    throw new Error('imageRender: region has a non-positive extract box (left=' + region.pixel_left
      + ' top=' + region.pixel_top + ' right=' + region.pixel_right + ' bottom=' + region.pixel_bottom + ')');
  }
  let pipeline = sharp(preparedBuf).extract({
    left: region.pixel_left, top: region.pixel_top, width, height,
  });
  // ── A CROP IS NOT A ZOOM, AND THIS ONE LINE WAS THE WHOLE RESULT ────────
  // This function used to be a pure `extract` with no resize, so a crop handed
  // the model EXACTLY the pixels the full page already had. Cropping can reduce
  // competing content per call; it cannot add one bit of information. Measured
  // on the real photograph at ~15 px per handwritten line: correctly oriented
  // bands WITHOUT this resize scored 28/39 with 7 inventions - WORSE than the
  // coarse three-region baseline. The SAME bands WITH a deterministic 3x resize
  // scored 39/39 with 0 inventions. The only difference was the resize.
  // RESOLUTION PER LINE was the binding constraint all along.
  //
  // Deterministic and application-owned: a fixed factor and a fixed kernel, so
  // the same bytes always produce the same crop.
  if (upscale > 1) {
    pipeline = pipeline.resize({
      width: Math.round(width * upscale), height: Math.round(height * upscale), kernel: 'lanczos3',
    });
  }
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

/**
 * Decode an image to the greyscale raster imagePrep's orientation-aware
 * planner needs.
 *
 * THIS IS THE SEAM THAT KEEPS imagePrep.js PURE. The planner is coordinate
 * maths over a decoded raster and carries no dependency; the decode lives here,
 * where `sharp` already does. That split is why imagePrep.js's "PURE. No I/O..."
 * header is still true and why this package's suite still runs FULLY OFFLINE
 * with zero dependencies installed - the alternative considered and rejected
 * was making prepareImage async and importing sharp there, which would have
 * falsified both claims to save one file.
 *
 * @param {Buffer} buf
 * @returns {Promise<{data:Buffer, width:number, height:number, channels:number}>}
 */
export async function decodeGreyscaleRaster(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  return {
    data, width: info.width, height: info.height, channels: info.channels,
  };
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
export async function renderAllRegions(originalBuf, transform, regions, { upscale = 1 } = {}) {
  const preparedBuf = await renderPreparedPage(originalBuf, transform);
  const rendered = [];
  for (const region of regions) {
    const buffer = await renderRegionCrop(preparedBuf, region, { upscale });
    rendered.push({ region_no: region.region_no, buffer });
  }
  return rendered;
}

/** `Buffer` -> `data:image/jpeg;base64,...` - the shape models.mjs's vision() expects per image. */
export function toDataUrl(buffer) {
  return 'data:image/jpeg;base64,' + buffer.toString('base64');
}
