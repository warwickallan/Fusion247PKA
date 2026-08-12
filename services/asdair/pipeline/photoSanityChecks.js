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
//   * UNJUSTIFIED quantity (WO-2026-08-12-B15-VISION-02, AC1) - a reported
//     quantity with no independent purchase-count evidence behind it, e.g.
//     "16" lifted straight out of the product's own name "Richmond 16 Pork
//     Sausages". This is a DIFFERENT check from implausible-quantity above:
//     16 is well under MAX_PLAUSIBLE_QUANTITY and is exactly the case that
//     slipped through undetected in the discriminating test;
//   * a line with no catalogue match (status unmatched_new_item);
//   * a PHOTO-origin line with no source_region citation - the deterministic
//     backstop for the region-citation prompt contract in groundedPrompt.js;
//     migration 020's CHECK+FK is the database-level backstop underneath
//     THIS one (AC3), so a line that slips past this check is still refused
//     at persistence, never silently accepted.
//   * duplicates, cross-strip OR SAME-region (WO-2026-08-12-B15-VISION-02,
//     AC4 widened this from cross-strip-only) - the SAME physical line read
//     more than once, whether because an overlapping strip saw it twice or
//     because the model repeated itself within one region (the diagnostic
//     run's real "2 Vanish oxi pink" duplicate was the latter shape, and the
//     model's own "possible_duplicate" self-label was never actually acted
//     on downstream). Resolved by naming a survivor and marking every other
//     candidate row of the same physical line, NOT by a blanket "duplicates"
//     flag that cannot tell a repeat from two genuinely separate purchases
//     (design doc's own worked example: two real, distinct milk lines at
//     different quantities must NOT collapse - unaffected by the AC4 change,
//     since the (product id, quantity) key already keeps them apart).
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

// ── AC1 (WO-2026-08-12-B15-VISION-02) - QUANTITY SEMANTICS AS A CLASS ──────
//
// Raising MAX_PLAUSIBLE_QUANTITY was never the fix (Amendment 4, point 7):
// 16 is a perfectly plausible NUMBER and sits comfortably under the ceiling
// above, which is exactly why "Richmond 16 Pork Sausages" slipped through
// undetected as quantity 16 in the discriminating test - the flagship
// failure this whole design doc cites sits under its own threshold.
//
// THE REAL INVARIANT: a number that is part of a product's own printed
// name/pack descriptor is NOT automatically the requested purchase
// quantity. groundedPrompt.js (v3) now asks the model not to do this; this
// is the DETERMINISTIC BACKSTOP that enforces it regardless of whether the
// model actually complied - the only proof available offline, since this
// build has no live gateway credentials here (AC8: the live re-test is
// Asdair's job, separately, against the real gateway).
//
// THE RULE: independent quantity evidence is a count that is the FIRST
// token of what was actually written (a genuine LEADING count - "2 chips
// with skins on", "3 x Yazoo choc", "4 pk kitchen roll") or an explicit
// multiplier anywhere in the text ("buy 2", "x3"). A number appearing
// anywhere else in raw_reading (e.g. "16" after the brand name "Richmond")
// is presumed to be part of the product's own descriptor and carries NO
// purchase-quantity evidence on its own. This mirrors, but deliberately does
// not reuse, skill/termMatch.js's stripLeadingQuantity - that module sits
// outside this Work Order's declared surface, and its job (feeding the
// tolerant MATCHER) is a different question from this one (deciding whether
// a REPORTED quantity is trustworthy), so a small, self-contained function
// here is the smaller, more honest diff than reaching into another file.
const LEADING_QUANTITY_RE = /^(\d+)\s*(?:x\b|pk\b|packs?\b|\s)/i;
const EXPLICIT_MULTIPLIER_RE = /\b(?:x\s*(\d+)|buy\s+(\d+))\b/i;

/**
 * The ONE piece of independent purchase-quantity evidence found in raw text,
 * or null when none exists. PURE - no catalogue, no model, no I/O.
 * @param {string} rawReading
 * @returns {number|null}
 */
export function leadingQuantityEvidence(rawReading) {
  const text = String(rawReading || '').trim();
  if (text === '') return null;
  const leading = text.match(LEADING_QUANTITY_RE);
  if (leading) return Number(leading[1]);
  const explicit = text.match(EXPLICIT_MULTIPLIER_RE);
  if (explicit) return Number(explicit[1] ?? explicit[2]);
  return null;
}

/**
 * @returns {string|null} 'unjustified_quantity' when a reported quantity has
 *   no independent evidence behind it (or disagrees with the ONE piece of
 *   evidence found), null otherwise. A null/undefined quantity is never
 *   flagged here - "unreadable" is its own honest state, covered by
 *   checkImplausibleQuantity's own guard, not this one.
 */
export function checkUnjustifiedQuantity(line) {
  if (line.quantity === null || line.quantity === undefined) return null;
  const evidence = leadingQuantityEvidence(line.raw_reading);
  if (evidence === null) return 'unjustified_quantity';
  if (evidence !== line.quantity) return 'unjustified_quantity';
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
 * Resolve duplicate lines - the SAME physical item read more than once,
 * whether that happened CROSS-STRIP (an overlapping strip saw it twice) or
 * WITHIN ONE region (the model repeated itself in a single read).
 *
 * WIDENED under WO-2026-08-12-B15-VISION-02, AC4: the previous rule ("a
 * group entirely within one region is left untouched... already covered by
 * the model's own possible_duplicate status") relied on the model's own
 * self-label ever being ACTED on downstream - it never was, which is
 * precisely how the diagnostic run's real "2 Vanish oxi pink" line (both
 * reads from the SAME region, the second self-labelled possible_duplicate by
 * the model) survived as two separate rows. The design doc's own guard is
 * UNCHANGED and still enforced: duplicateKey() keys on (product id,
 * quantity), so two REAL milk lines at DIFFERENT quantities are never
 * grouped together at all, regardless of region - only an EXACT repeat of
 * the same product at the same quantity collapses, same-region or not.
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
 * AC1's unjustified-quantity CORRECTION runs before the other per-line
 * checks and mutates `quantity` to null when it fires - deliberately, so the
 * value this function RETURNS never carries an unjustified figure forward
 * (the acceptance property is about the OUTPUT, not merely a flag sitting
 * beside an unchanged wrong number). Nulling first also means a corrected
 * line can never then trip checkImplausibleQuantity a second time for the
 * same underlying defect.
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
    const unjustifiedQuantityFlag = checkUnjustifiedQuantity(line);
    const correctedLine = unjustifiedQuantityFlag ? { ...line, quantity: null } : line;
    const flags = [
      unjustifiedQuantityFlag,
      checkImplausibleQuantity(correctedLine),
      checkUnmatched(correctedLine),
      checkMissingSourceRegion(correctedLine),
    ].filter(Boolean);
    const hasAnomaly = flags.length > 0;
    if (hasAnomaly) anyAnomaly = true;
    return { ...correctedLine, flags, hasAnomaly };
  });

  return { lines: annotated, anyAnomaly };
}
