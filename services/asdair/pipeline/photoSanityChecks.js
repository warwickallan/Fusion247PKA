// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/photoSanityChecks.js
//
// WO-2026-08-11-B15-VISION-01, AC4: deterministic, LLM-FREE sanity checks
// over one photo interpretation pass's per-line reads. Runs AFTER the vision
// call returns and BEFORE anything is persisted or a follow-up call is
// considered - this module makes no network call and asks nothing of a model.
//
// PURE. No I/O, no clock, no randomness. Every function here takes plain
// data in and returns plain data out.
//
// WHAT THIS CHECKS (Part 1 design doc, step 3; Pax's independent review):
//   * implausible quantity (design doc's own example: "16 sausage packs");
//   * a line with no catalogue match (status unmatched_new_item);
//   * a PHOTO-origin line with no source_region citation - the deterministic
//     backstop for the region-citation prompt contract in groundedPrompt.js;
//     migration 020's CHECK+FK is the database-level backstop underneath
//     THIS one (AC3), so a line that slips past this check is still refused
//     at persistence, never silently accepted.
//   * cross-strip duplicates - the SAME physical line read once per
//     overlapping strip it appears in, which overlapping strips make
//     structurally likely at every seam. Resolved by naming a survivor and
//     marking every other candidate row of the same physical line, NOT by a
//     blanket "duplicates" flag that cannot tell a strip-seam echo from two
//     genuinely separate purchases (design doc's own worked example: two
//     real, distinct milk lines at different quantities must NOT collapse).
// =====================================================================

'use strict';

// A quantity above this is flagged, never silently accepted or clamped.
// Chosen from the design doc's own worked failure example ("16 sausage
// packs" was already implausible) with headroom for genuine bulk buys
// (e.g. a multipack of 12) - not tuned to any specific product, since this
// module has no catalogue access and must not pretend to.
export const MAX_PLAUSIBLE_QUANTITY = 24;

/** @returns {string|null} a flag name, or null if the quantity is plausible. */
export function checkImplausibleQuantity(line) {
  const qty = line.quantity;
  if (qty === null || qty === undefined) return null; // "unreadable" is its own honest state, not implausible
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_PLAUSIBLE_QUANTITY) return 'implausible_quantity';
  return null;
}

/** @returns {string|null} */
export function checkUnmatched(line) {
  if (line.matched_regular_id === null || line.matched_regular_id === undefined) return 'unmatched';
  return null;
}

/**
 * A PHOTO-origin line asserting no resolvable source_region is a defect at
 * THIS layer too (not only at the database - see the module header). A line
 * genuinely marked "unreadable" still needs a region: the whole point of a
 * region citation is "here is where I looked", which holds even when what
 * was seen there could not be read cleanly.
 * @returns {string|null}
 */
export function checkMissingSourceRegion(line) {
  if (line.source_region === null || line.source_region === undefined) return 'missing_source_region';
  return null;
}

/** Normalise text for duplicate comparison: trim, lowercase, collapse whitespace. */
function normaliseText(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The comparison key two reads must share to be considered candidates for
 * "the same physical line, read twice because of strip overlap":
 *   - matched to the same real catalogue product: keyed on (product id, qty)
 *     so "2x milk" and "4x milk" are NEVER collapsed into each other (the
 *     design doc's explicit two-real-milk-lines guard);
 *   - unmatched (no catalogue id): keyed on the normalised raw text alone,
 *     since there is no product identity to compare.
 */
function duplicateKey(line) {
  if (line.matched_regular_id !== null && line.matched_regular_id !== undefined) {
    return 'p:' + String(line.matched_regular_id) + '|' + String(line.quantity ?? 'null');
  }
  return 't:' + normaliseText(line.raw_reading);
}

/**
 * Resolve cross-strip duplicates. Only a group whose members were read from
 * MORE THAN ONE distinct source_region is treated as a strip-seam echo - a
 * group entirely within one region is left untouched (that is a same-region
 * repeat, already covered by the model's own "possible_duplicate" status and
 * out of this function's remit).
 *
 * The survivor is the group's highest-confidence member; a tie is broken by
 * the LOWER region_no (the design's own instruction to the model - "cite the
 * ONE strip that gives the clearest, most complete view" - biases toward an
 * earlier, more central region as the tiebreak here for the same reason).
 *
 * Returns a NEW array (input is never mutated); every element gains:
 *   supersededByIndex: null | the array index of the surviving line.
 *
 * @param {Array<object>} lines - each with matched_regular_id, quantity,
 *   raw_reading, source_region, confidence.
 * @returns {Array<object>}
 */
export function resolveCrossStripDuplicates(lines) {
  const groups = new Map();
  lines.forEach((line, index) => {
    const key = duplicateKey(line);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });

  const supersededByIndex = new Array(lines.length).fill(null);

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const distinctRegions = new Set(indices.map((i) => lines[i].source_region));
    if (distinctRegions.size < 2) continue; // same-region repeat: not this function's job

    // Highest confidence wins; ties broken by the lower source_region.
    let survivorIndex = indices[0];
    for (const i of indices.slice(1)) {
      const a = lines[i];
      const b = lines[survivorIndex];
      const aConf = Number.isFinite(a.confidence) ? a.confidence : -1;
      const bConf = Number.isFinite(b.confidence) ? b.confidence : -1;
      const better = aConf > bConf
        || (aConf === bConf && (a.source_region ?? Infinity) < (b.source_region ?? Infinity));
      if (better) survivorIndex = i;
    }
    for (const i of indices) {
      if (i !== survivorIndex) supersededByIndex[i] = survivorIndex;
    }
  }

  return lines.map((line, index) => ({ ...line, supersededByIndex: supersededByIndex[index] }));
}

/**
 * Run every deterministic check over one interpretation pass and annotate
 * each line with its flags plus the shop-level anomaly verdict AC5 consumes.
 *
 * A SUPERSEDED line (see resolveCrossStripDuplicates) is excluded from the
 * implausible-quantity/unmatched/missing-region flagging: it is not the
 * canonical reading of its physical line, so flagging it as anomalous would
 * double-count one problem as two and could trigger a follow-up call over a
 * strip the survivor already resolved.
 *
 * @param {Array<object>} lines
 * @returns {{lines: Array<object>, anyAnomaly: boolean}}
 */
export function runSanityChecks(lines) {
  const deduped = resolveCrossStripDuplicates(lines);
  let anyAnomaly = false;

  const annotated = deduped.map((line) => {
    if (line.supersededByIndex !== null) {
      return { ...line, flags: ['cross_strip_duplicate'], hasAnomaly: false };
    }
    const flags = [
      checkImplausibleQuantity(line),
      checkUnmatched(line),
      checkMissingSourceRegion(line),
    ].filter(Boolean);
    const hasAnomaly = flags.length > 0;
    if (hasAnomaly) anyAnomaly = true;
    return { ...line, flags, hasAnomaly };
  });

  return { lines: annotated, anyAnomaly };
}
