// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/packIdentityRule.js
//
// WO-2026-08-13-04 (WP-B15-37), AC4. THE RECONCILIATION-SIDE PACK-IDENTITY
// RULE: a number written on the page that is the PRODUCT'S OWN PACK COUNT is
// never a purchase quantity.
//
// Warwick's ruling, and his own two named cases are the specification:
//
//     "Richmond 16 sausages" -> 1 pack of the identified 16-count product
//     "Ariel Pods 33"        -> 1 pack of the 33-count product
//     "Product-pack numbers are PRODUCT IDENTITY, not purchase quantity."
//
// ── WHY THIS EXISTS AT ALL, GIVEN photoSanityChecks.js IS CORRECT ──────────
// `photoSanityChecks.leadingQuantityEvidence` is correct and is NOT weakened,
// bypassed or special-cased here; it is not even imported, so nothing in this
// file can change what it decides. Its rule is "a count that is the FIRST token
// of the line is evidence", and that rule is right - it is what makes
// "3 gourmet cat food" a purchase of three.
//
// The gap it cannot close is the one its own header names: 16 is a perfectly
// plausible number, it IS the first token of "16 Richmond Skinless Pork
// Sausages", and it sits comfortably under MAX_PLAUSIBLE_QUANTITY (24). The
// module says so in its own words - "the flagship failure this whole design
// doc cites sits under its own threshold". MEASURED on the three frozen final
// vision runs of the real photograph: two of the three returned
// `quantity: 16, quantity_basis: explicit-on-page` for that line. Vision is
// FINAL and PARKED, so this is caught at reconciliation or it is not caught.
//
// ── THE RULE: THREE CONDITIONS, ALL OF WHICH MUST HOLD ────────────────────
// A leading count N on the page is REFUSED as a purchase quantity when:
//
//   (a) NO PURCHASE MARKER travels with it. `x`, `pk`, `pkt`, `pkts`, `pack`,
//       `packs`, `box`, `bag`, `bottle`, `can`, `tin`, `pt`, `pts` are how a
//       human writes a multiple of a retail unit ("4 x 4pts", "2 pkts"), and a
//       marked count keeps its full range untouched. This is what keeps every
//       genuine bulk purchase believable.
//
//   (b) N >= 10. Every purchase count actually written on this household's
//       page is a single digit; a bare two-digit number beside a product name
//       is the shape of a pack descriptor. Stated as a boundary rather than
//       hidden: a genuine UNMARKED purchase of ten or more of a counted-pack
//       product would be refused down to one - and would be visible, because
//       the refused number travels on the line.
//
//   (c) THE RESOLVED CATALOGUE PRODUCT IS SOLD IN COUNTED PACKS - its own name
//       carries a standalone integer ("Richmond 12 Skinless Pork Sausages
//       319g", "Ariel 4in1 PODS, Washing Capsules 33"). This is the condition
//       that makes the rule Warwick's rather than a threshold: it fires only
//       where the product genuinely HAS a pack count for a page number to be
//       confused with. A product measured by weight or volume alone
//       ("Yazoo Strawberry Milk Drink 400ml", "Gourmet ... 6x50g") never
//       triggers it, because "400ml" and "6x50g" are attached tokens, not
//       standalone counts.
//
// Note that (c) does NOT require the page number to EQUAL the catalogue pack
// count, and must not: the real Richmond page line says 16 while the household's
// catalogue row is the 12-pack. Requiring equality would have missed the exact
// case Warwick named.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

/** Refused counts are recorded under their own basis, never as a plain default. */
export const PACK_IDENTITY_BASIS = 'pack-identity-not-quantity';

/** Warwick's household default when the page carries no believable count. */
export const HOUSEHOLD_DEFAULT_QUANTITY = 1;

/** The smallest leading count this rule will treat as a pack descriptor. */
export const UNMARKED_PACK_COUNT_FLOOR = 10;

/**
 * How a human writes "several of this retail unit". A count carrying one of
 * these is a purchase multiplier and is never refused by this rule.
 */
export const PURCHASE_MARKERS = Object.freeze([
  'x', 'pk', 'pks', 'pkt', 'pkts', 'pack', 'packs', 'packet', 'packets',
  'box', 'boxes', 'bag', 'bags', 'bottle', 'bottles', 'can', 'cans',
  'tin', 'tins', 'pt', 'pts', 'pint', 'pints', 'jar', 'jars', 'tub', 'tubs',
]);

const MARKER_SET = new Set(PURCHASE_MARKERS);

function words(text) {
  return String(text ?? '').trim().split(/\s+/).filter((t) => t !== '');
}

/** Strip trailing punctuation a handwritten line picks up ("PKTS." -> "pkts"). */
function bare(token) {
  return String(token ?? '').toLowerCase().replace(/[^a-z0-9]+$/g, '').replace(/^[^a-z0-9]+/g, '');
}

/**
 * PURE. Does a purchase marker travel with the leading count?
 *
 * True when the leading token itself carries a marker suffix ("4pk", "2x"), or
 * when the token immediately after the count is a marker or begins with a digit
 * that carries one ("4 x 4pts", "2 4pk.", "2 PKTS.").
 */
export function hasPurchaseMarker(probeText) {
  const toks = words(probeText).map(bare).filter((t) => t !== '');
  if (toks.length === 0) return false;

  const first = toks[0];
  // "4pk", "2x", "16pkts" - a count fused to its own marker.
  const fused = /^(\d+)([a-z]+)$/.exec(first);
  if (fused && MARKER_SET.has(fused[2])) return true;

  const second = toks[1];
  if (second === undefined) return false;
  if (MARKER_SET.has(second)) return true;
  const fusedSecond = /^(\d+)([a-z]+)$/.exec(second);
  if (fusedSecond && MARKER_SET.has(fusedSecond[2])) return true;
  return false;
}

/**
 * PURE. Is this catalogue product sold in COUNTED PACKS - does its own name
 * carry a standalone integer?
 *
 * "Richmond 12 Skinless Pork Sausages 319g" -> true  (12 stands alone)
 * "Ariel 4in1 PODS, Washing Capsules 33"    -> true  (33 stands alone)
 * "Yazoo Strawberry Milk Drink 400ml"       -> false (400ml is attached)
 * "Gourmet ... Wet Cat Food 6x50g"          -> false (6x50g is attached)
 * "Twix ... Ice Cream 4pk"                  -> false (4pk is attached)
 */
export function isCountedPackProduct(productName) {
  for (const token of words(productName)) {
    const t = bare(token);
    if (t !== '' && /^\d+$/.test(t)) return true;
  }
  return false;
}

/**
 * PURE. Decide whether a leading count is pack identity rather than a purchase
 * quantity.
 *
 * @param {object} args
 * @param {number|null} args.quantity        what the page evidence says
 * @param {string} args.quantityBasis        the basis vision recorded for it
 * @param {string} args.probeText            the text the count was read from
 * @param {string|null} args.productName     the RESOLVED catalogue product name
 * @returns {{quantity:number|null, basis:string, refusedEvidence:number|null,
 *            packIdentityApplied:boolean, reason:string|null}}
 */
export function applyPackIdentityRule({ quantity, quantityBasis, probeText, productName }) {
  const unchanged = {
    quantity,
    basis: quantityBasis,
    refusedEvidence: null,
    packIdentityApplied: false,
    reason: null,
  };

  if (!Number.isInteger(quantity)) return unchanged;
  // Only a count the page actually carried can be a pack descriptor. A
  // household default was never read off the page and has nothing to refuse.
  if (quantityBasis !== 'explicit-on-page') return unchanged;

  if (hasPurchaseMarker(probeText)) return unchanged;            // (a)
  if (quantity < UNMARKED_PACK_COUNT_FLOOR) return unchanged;    // (b)
  if (!isCountedPackProduct(productName)) return unchanged;      // (c)

  return {
    quantity: HOUSEHOLD_DEFAULT_QUANTITY,
    basis: PACK_IDENTITY_BASIS,
    refusedEvidence: quantity,
    packIdentityApplied: true,
    reason: `the page's unmarked leading "${quantity}" is the pack count of "${productName}", not a purchase quantity - asking for 1 pack`,
  };
}
