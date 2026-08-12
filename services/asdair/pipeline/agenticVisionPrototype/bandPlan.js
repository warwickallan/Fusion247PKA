// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/bandPlan.js
//
// WO-2026-08-12-02 (WP-B15-30), AC5 as redefined by Amendment 1: an
// ORIENTATION-AWARE, application-owned, deterministic region plan.
//
// ── THE FINDING THAT MADE THIS NECESSARY ────────────────────────────────
// The photograph is rotated ~90°: the handwritten lines run along the image's
// Y axis and STACK along its X axis, in two columns. `imagePrep.planRegions()`
// always cuts HORIZONTAL strips (splitting by Y), because it has only the EXIF
// orientation to go on and this file's EXIF orientation tag is `null`.
//
// So every strip ever cut has sliced every line PERPENDICULAR. No strip has
// ever contained a whole line - only the full-page region has. That is almost
// certainly why the model kept requesting region 1 mid-loop in both WP-B15-29
// arms: it was reaching for the only region in which the writing was whole.
//
// Cutting 6-8 strips on that axis would have made the result WORSE, slicing
// each line into 6-8 fragments. Overlap does not rescue it, because the
// failure is not lines falling near a seam - it is no line being whole in any
// band.
//
// ── WHAT THIS MODULE DOES, AND WHAT IT REFUSES TO DO ────────────────────
// It measures the ink and cuts perpendicular to the way the writing stacks.
// It is DETERMINISTIC and APPLICATION-OWNED: the same bytes always produce the
// same plan, and the model never proposes a coordinate. It contains no
// threshold fitted to this photograph - the axis is chosen by comparing two
// measurements of the same image against each other, not against a constant.
//
// ⚠️ IT DOES NOT LIVE IN imagePrep.js. That module owns the production region
// plan and is OUTSIDE this Work Order's file surface. The finer plan is built
// here, in-surface, exactly as the order instructed. Whether the production
// planner should become orientation-aware is a REPORTED finding, not a change
// made here.
//
// Takes a decoded greyscale raster in, gives coordinates out. The decode
// itself belongs to the caller (sharp lives in imageRender.js, and this
// package's convention is that coordinate math stays dependency-free).
// =====================================================================

'use strict';

/** Below this grey value a pixel counts as ink. Handwriting on white paper. */
export const INK_THRESHOLD = 110;

/** Warwick's band count for this page. 6-8 sensible regions, not 39 calls. */
export const DEFAULT_BAND_COUNT = 7;

/** Warwick's modest overlap, carried over from the production planner. */
export const DEFAULT_BAND_OVERLAP_FRACTION = 0.15;

/**
 * Find the PAPER inside the photograph.
 *
 * ⚠️ THIS STEP IS NOT OPTIONAL, and leaving it out was a real defect in the
 * first cut of this module. A phone photograph of a sheet of paper carries
 * black letterbox bars and whatever the sheet was resting on, and those pixels
 * are DARKER than the handwriting. Counting them as ink put the "written
 * extent" at the full image, buried the alternation signal (the axis ratio
 * came out at 1.18 - barely a decision), and spent bands on furniture.
 *
 * The paper is the brightest contiguous run along each axis. The comparison is
 * against the image's OWN mean brightness, so there is no tuned constant and
 * no assumption about how much of the frame the sheet fills.
 *
 * @returns {{top:number, bottom:number, left:number, right:number}}
 */
export function paperBox({ data, width, height, channels = 1 }) {
  if (!data || !(width > 0) || !(height > 0)) throw new Error('paperBox: a sized raster is required');
  let total = 0;
  for (let i = 0; i < width * height; i += 1) total += data[i * channels];
  const meanBrightness = total / (width * height);

  // FIRST and LAST bright position, not the longest contiguous bright run.
  // The run form was brittle in exactly the way that matters here: writing
  // interrupts the paper, so a densely written sheet fragments into many short
  // bright runs and the "longest" one is a gap between two lines rather than
  // the page. Caught by this module's own synthetic-page tests, where a page
  // with a 20 px border reported its paper starting at row 233.
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
 * Sum ink along each row and each column, WITHIN the paper only.
 *
 * The returned profiles are indexed in FULL-IMAGE coordinates, with zeroes
 * outside the paper box, so every coordinate this module emits is directly
 * usable as a crop box without an offset step to get wrong.
 *
 * @param {{data: Uint8Array|Buffer, width: number, height: number, channels?: number}} raster
 * @param {{top:number,bottom:number,left:number,right:number}} [box]
 * @returns {{rows: number[], cols: number[], box: object}}
 */
export function inkProfiles(raster, box = null) {
  const {
    data, width, height, channels = 1,
  } = raster;
  if (!data || !(width > 0) || !(height > 0)) throw new Error('inkProfiles: a sized raster is required');
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
 * How strongly a profile ALTERNATES between ink and gap.
 *
 * Lines of text stacked along an axis produce a strongly alternating profile
 * along that axis (line, gap, line, gap...) and a smooth one along the other.
 * Measured as the mean absolute first difference divided by the mean level, so
 * it is scale-free: it compares an image with ITSELF on its two axes and needs
 * no tuned constant.
 *
 * @param {number[]} profile
 * @returns {number}
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
 * Decide which axis the handwritten lines STACK along.
 *
 * `'y'` - ordinary upright page: lines run left-to-right and stack down the
 *         image. Bands are horizontal strips (the production planner's shape).
 * `'x'` - the page is rotated: lines run down the image and stack across it.
 *         Bands must be VERTICAL, or every band cuts every line.
 *
 * @returns {{axis:'x'|'y', alternationX:number, alternationY:number, ratio:number}}
 */
export function detectStackingAxis(raster, box = null) {
  const { rows, cols, box: paper } = inkProfiles(raster, box);
  // Only the paper's own span carries signal; the zeroes outside it would
  // dilute the mean and flatten both measurements towards each other.
  const alternationY = alternation(rows.slice(paper.top, paper.bottom + 1));
  const alternationX = alternation(cols.slice(paper.left, paper.right + 1));
  // No constant: the two measurements are compared with each other. Ties fall
  // to 'y', which is the ordinary upright page and the production behaviour.
  return {
    axis: alternationX > alternationY ? 'x' : 'y',
    alternationX,
    alternationY,
    ratio: alternationY > 0 ? alternationX / alternationY : Infinity,
    box: paper,
  };
}

/**
 * The extent of the written content along an axis: the first and last position
 * carrying a non-trivial amount of ink.
 *
 * Bands are cut over the INK extent rather than the whole image, so the black
 * letterbox borders of a phone photograph do not consume bands that could have
 * gone to writing.
 *
 * @param {number[]} profile
 * @param {number} [floorFraction] - of the profile's own mean; scale-free.
 */
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
 * Build the band plan: `count` overlapping bands covering `[start, end]`,
 * cut PERPENDICULAR to the reading direction so each band holds a few WHOLE
 * lines rather than fragments of many.
 *
 * The geometry is the same one the production planner uses, and deliberately
 * so - only the axis changed:
 *   extent = bandSize * (1 + (count - 1) * (1 - overlapFraction))
 *
 * @returns {Array<{band_no:number, from:number, to:number}>}
 */
export function planBands({
  start, end, count = DEFAULT_BAND_COUNT,
  overlapFraction = DEFAULT_BAND_OVERLAP_FRACTION, minOverlapPx = 0,
}) {
  if (!(end > start)) throw new Error('planBands: end must exceed start');
  if (!(count >= 1)) throw new Error('planBands: count must be at least 1');
  if (!(overlapFraction >= 0) || overlapFraction >= 1) throw new Error('planBands: overlapFraction must be in [0, 1)');
  const extent = end - start + 1;

  // ── THE OVERLAP IS DERIVED FROM THE MEASURED LINE PITCH, NOT ASSUMED ────
  // The coverage proof caught this and it is the whole reason the proof runs
  // BEFORE any spend. At 7 bands over 575 px, a 15% overlap is 14 px while a
  // line is 15.5 px: a line centred in a seam fitted in NEITHER band, and the
  // proof failed at all six seams. "Modest overlap so a line near a boundary
  // cannot silently vanish" is only true if the overlap EXCEEDS a line.
  //
  // So the requirement is computed from the image (one line-height plus the
  // margin each side) rather than fitted to it. The requested fraction is a
  // FLOOR, never a ceiling.
  let bandSize = Math.ceil(extent / (1 + (count - 1) * (1 - overlapFraction)));
  let stride = Math.round(bandSize * (1 - overlapFraction));
  if (minOverlapPx > 0 && (bandSize - stride) < minOverlapPx) {
    // extent = bandSize + (count-1) * (bandSize - minOverlapPx)
    bandSize = Math.ceil((extent + (count - 1) * minOverlapPx) / count);
    stride = bandSize - minOverlapPx;
  }

  const bands = [];
  for (let i = 0; i < count; i += 1) {
    const from = start + i * stride;
    // The last band is clamped to the end rather than overshooting it.
    const to = i === count - 1 ? end : Math.min(end, from + bandSize - 1);
    bands.push({ band_no: i + 1, from, to });
  }
  return bands;
}

/**
 * ── AC5's COVERAGE PROOF, in the form Amendment 1 accepted ──────────────
 *
 * The order's original form - "every line falls inside at least one region" -
 * is trivially and permanently TRUE, because the full-page region covers the
 * page. It proves nothing. Larry upheld the replacement:
 *
 *   for EVERY position on the stacking axis, a band of one line-height
 *   centred there must be FULLY CONTAINED, with margin, inside at least one
 *   NON-full-page band.
 *
 * That is what "no line sits only at a boundary" actually means, and it needs
 * no per-line coordinates - which matters, because the only available source
 * of per-line coordinates would be a model reading the photograph, i.e. the
 * instrument under test.
 *
 * @param {object} args
 * @param {Array<{from:number,to:number}>} args.bands
 * @param {number} args.start - first position of the written content.
 * @param {number} args.end - last position.
 * @param {number} args.lineHeight - measured line pitch along the stacking axis.
 * @param {number} [args.margin] - required clear space each side, in pixels.
 * @returns {{passes:boolean, checked:number, failures:Array<object>, worstPosition:number|null}}
 */
export function proveCoverage({
  bands, start, end, lineHeight, margin = 2,
  crossFrom = null, crossTo = null, axisLimit = null,
}) {
  if (!Array.isArray(bands) || bands.length === 0) throw new Error('proveCoverage: bands are required');
  if (!(lineHeight > 0)) throw new Error('proveCoverage: a positive lineHeight is required');
  const half = lineHeight / 2;
  const interiorFailures = [];
  const frameClipped = [];
  let checked = 0;

  // ── PART 2 FIRST: does a band even span a WHOLE line lengthways? ────────
  // A band that truncates a line along the READING direction is exactly as
  // broken as one that cuts it across, and it is the failure mode of the
  // current production plan on this photograph: its strips split the axis the
  // writing runs ALONG, so no strip has ever held a complete line.
  const spanFailures = (crossFrom === null || crossTo === null)
    ? []
    : bands.filter((b) => !(b.crossFrom <= crossFrom && b.crossTo >= crossTo))
      .map((b) => ({ band_no: b.band_no, crossFrom: b.crossFrom, crossTo: b.crossTo }));

  // ── PART 1: every position on the stacking axis, not a sample. A seam
  //    failure is exactly the defect a coarse sweep steps over.
  for (let p = start; p <= end; p += 1) {
    checked += 1;
    const lineFrom = p - half;
    const lineTo = p + half;
    const contained = bands.some((b) => (lineFrom - margin) >= b.from && (lineTo + margin) <= b.to);
    if (contained) continue;
    // A line centred within half a line-height of the image edge extends
    // beyond the FRAME. No band plan can contain it - the camera clipped the
    // page. Reported separately and honestly rather than counted as a defect
    // in the plan or quietly excluded from the denominator.
    const clipped = axisLimit !== null && ((lineFrom - margin) < 0 || (lineTo + margin) > axisLimit);
    if (clipped) frameClipped.push({ position: p, lineFrom, lineTo });
    else interiorFailures.push({ position: p, lineFrom, lineTo });
  }

  return {
    // The plan passes when every INTERIOR position is covered and every band
    // spans a whole line lengthways. Frame-clipped positions are a property of
    // the photograph and are reported, never silently forgiven.
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
 * Estimate the line pitch along the stacking axis from the ink profile itself:
 * the extent divided by the number of ink runs found in it.
 *
 * Deterministic and measured, not assumed. Where the writing is dense enough
 * that adjacent lines touch, this UNDER-counts the runs and therefore
 * OVER-estimates the pitch, which makes the coverage proof STRICTER rather
 * than more permissive - the safe direction for a proof.
 *
 * @returns {{lineCount:number, pitch:number}}
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
 * The whole plan for one decoded page, in one call.
 *
 * @param {object} raster - `{data, width, height, channels}` greyscale.
 * @param {object} [opts] - `{bandCount, overlapFraction, margin}`
 * @returns {object} axis, extent, pitch, bands as PIXEL BOXES, and the proof.
 */
export function planOrientationAwareBands(raster, {
  bandCount = DEFAULT_BAND_COUNT, overlapFraction = DEFAULT_BAND_OVERLAP_FRACTION, margin = 2,
} = {}) {
  const { rows, cols, box } = inkProfiles(raster);
  const detection = detectStackingAxis(raster, box);
  const stackingProfile = detection.axis === 'x' ? cols : rows;
  const crossProfile = detection.axis === 'x' ? rows : cols;
  const stackFrom = detection.axis === 'x' ? box.left : box.top;
  const stackTo = detection.axis === 'x' ? box.right : box.bottom;
  const crossFrom = detection.axis === 'x' ? box.top : box.left;
  const crossTo = detection.axis === 'x' ? box.bottom : box.right;
  const axisLimit = detection.axis === 'x' ? raster.width - 1 : raster.height - 1;

  const extent = inkExtent(stackingProfile, stackFrom, stackTo);
  const cross = inkExtent(crossProfile, crossFrom, crossTo);
  const pitch = estimateLinePitch(stackingProfile, extent.start, extent.end);

  // ⚠️ BANDS MUST BE PADDED PAST THE INK, and omitting this was the second
  // real defect the coverage proof caught. A line CENTRED on the first inked
  // position extends half a line-height above it, into blank paper. If the
  // first band begins exactly at the first ink, that line can never be
  // "fully contained with margin" and the proof fails at both outer edges -
  // 70 failing positions on the real photograph. The blank paper either side
  // belongs inside the outer bands.
  const pad = Math.ceil(pitch.pitch / 2) + margin;
  const planFrom = Math.max(0, extent.start - pad);
  const planTo = Math.min(axisLimit, extent.end + pad);

  const minOverlapPx = Math.ceil(pitch.pitch) + 2 * margin;
  const bands = planBands({
    start: planFrom, end: planTo, count: bandCount, overlapFraction, minOverlapPx,
  }).map((b) => ({ ...b, crossFrom: cross.start, crossTo: cross.end }));

  // The PROOF is run over the INK extent - the property is about lines, and
  // padding the plan must never be allowed to weaken what is being proved.
  const proof = proveCoverage({
    bands,
    start: extent.start,
    end: extent.end,
    lineHeight: pitch.pitch,
    margin,
    crossFrom: cross.start,
    crossTo: cross.end,
    axisLimit,
  });

  // Bands become pixel boxes spanning the FULL written width across the
  // reading direction - a band must never truncate a line lengthways either.
  const regions = bands.map((b) => (detection.axis === 'x'
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
    // region 1 remains the full page, exactly as the production plan numbers it
    regions: [
      {
        region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null,
      },
      ...regions,
    ],
    coverageProof: proof,
  };
}
