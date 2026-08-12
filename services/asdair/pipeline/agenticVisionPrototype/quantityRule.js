// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/quantityRule.js
//
// WO-2026-08-12-02 (WP-B15-30), AC1: the HOUSEHOLD DEFAULT-ONE QUANTITY
// RULE, as a deterministic application-side rule.
//
// Warwick's ruling, and his four examples ARE the specification:
//
//   "Richmond 16 sausages"  -> 1  (a 16-count PACK, bought once)
//   "Ariel Pods 33"         -> 1  (a 33-count PACK, bought once)
//   "Cravendale milk x4"    -> 4  (an explicit multiplier)
//   "Cravendale milk"       -> 1  (no evidence -> the household default)
//
//   "Product-pack numbers are PRODUCT IDENTITY, not purchase quantity."
//
// ── WHY THIS IS A RULE AND NOT A PROMPT LINE ────────────────────────────
// The prompt already asks for exactly this behaviour (buildAgenticPrompt's
// rule 6, tuned over six rounds) and the model already largely complies. A
// prompt request is not a rule: it holds until the next model, temperature
// or gateway change, and its compliance is unobservable. This module decides
// the number the application BELIEVES, from text the application can see,
// with no model in the path.
//
// ── WHAT IS NEW HERE, AND WHAT WAS ALREADY BUILT ────────────────────────
// `photoSanityChecks.leadingQuantityEvidence` ALREADY implements Warwick's
// semantics exactly - a count that is the first token, or an explicit "xN"
// multiplier, is evidence; a number anywhere else in the text belongs to the
// product's own descriptor and is not. Verified against all four examples
// above. That function is IMPORTED, not reimplemented: six rounds of tuning
// live in it, and a second copy of a quantity heuristic is how the two
// drift apart.
//
// The genuinely new step is the LAST one, and it is the whole of AC1: where
// there is no evidence, the answer is no longer `null`. It is ONE. The
// pipeline previously carried "unknown quantity" all the way to a human,
// and Warwick has now ruled that the household's real-world default is one
// retail unit.
//
// ── THE THREE BOUNDARIES ON THAT DEFAULT (Larry, Amendment 1, confirming
//    Keel's read-back assumption) ────────────────────────────────────────
//   * It applies to ACCEPTED, VISIBLE lines only. A NOT_A_LINE is not a
//     purchase with an unknown quantity; it is not a purchase.
//   * It NEVER overrides explicit evidence. Evidence always wins.
//   * It is recorded as a BASIS, never silently. Every resolved quantity
//     carries how it was reached, so "the household default put a 1 here"
//     is visible to a human and to the scorer, and can never be mistaken for
//     something the page actually said.
//
// ⛔ NOT PRODUCTION LOGIC FOR THE PIPELINE. This module lives inside the
// standalone prototype and is imported by nothing outside it.
//
// PURE. No I/O, no model call, no credentials, no database.
// =====================================================================

'use strict';

import { leadingQuantityEvidence, MAX_PLAUSIBLE_QUANTITY } from '../photoSanityChecks.js';

/** Warwick's ruling: one retail unit when the page carries no explicit count. */
export const HOUSEHOLD_DEFAULT_QUANTITY = 1;

/** How a resolved quantity was arrived at. Always reported, never implied. */
export const QUANTITY_BASIS = Object.freeze({
  /** A count written on the page: a leading number, or an explicit "xN". */
  EXPLICIT: 'explicit-on-page',
  /** No count on the page - Warwick's authorised household default of one. */
  HOUSEHOLD_DEFAULT: 'household-default-one',
  /**
   * A count WAS read on the page and was REFUSED as implausible, so the
   * household default applied instead.
   *
   * Deliberately a separate basis rather than folding into HOUSEHOLD_DEFAULT:
   * "the page said nothing" and "the page said something this application
   * would not believe" are different states for a human reviewing the line,
   * and collapsing them hides a bad reading behind a plausible-looking 1.
   */
  REFUSED_IMPLAUSIBLE: 'household-default-one-after-refused-evidence',
  /** Not a shopping line at all, so there is no quantity to resolve. */
  NOT_A_PURCHASE: 'not-a-purchase',
});

/**
 * Resolve the quantity the application will believe for one line.
 *
 * @param {object} args
 * @param {string} args.asWritten - the VERBATIM reading of the page. Never a
 *   catalogue product name: a catalogue name smuggles its own pack size in,
 *   which is precisely the failure this rule exists to prevent.
 * @param {number|null} [args.reportedQuantity] - what the model claimed, if
 *   anything. It is EVIDENCE ABOUT THE MODEL, never an input to the answer.
 * @param {boolean} [args.isPurchaseLine] - false for NOT_A_LINE / not visible.
 * @returns {{quantity:number|null, basis:string, evidence:number|null,
 *            modelQuantity:number|null, modelDisagreed:boolean}}
 */
export function resolveQuantity({ asWritten, reportedQuantity = null, isPurchaseLine = true } = {}) {
  const modelQuantity = Number.isFinite(Number(reportedQuantity)) && reportedQuantity !== null
    ? Number(reportedQuantity)
    : null;

  if (!isPurchaseLine) {
    return {
      quantity: null,
      basis: QUANTITY_BASIS.NOT_A_PURCHASE,
      evidence: null,
      modelQuantity,
      modelDisagreed: false,
    };
  }

  const evidence = leadingQuantityEvidence(asWritten);

  // ⚠️ EVIDENCE MUST STILL BE BELIEVABLE. Caught by this module's own test
  // during WP-B15-30: "900 milk" yields a LEADING count of 900, which the old
  // path nulled via checkImplausibleQuantity. Once the rule owns the number,
  // the plausibility bound has to live here too, or moving the decision into
  // the rule would silently reinstate a defect the pipeline had already fixed.
  // The ceiling is imported, never re-declared - one home for the number.
  if (evidence !== null && (!Number.isInteger(evidence) || evidence <= 0 || evidence > MAX_PLAUSIBLE_QUANTITY)) {
    return {
      quantity: HOUSEHOLD_DEFAULT_QUANTITY,
      basis: QUANTITY_BASIS.REFUSED_IMPLAUSIBLE,
      evidence: null,
      refusedEvidence: evidence,
      modelQuantity,
      modelDisagreed: modelQuantity !== null && modelQuantity !== HOUSEHOLD_DEFAULT_QUANTITY,
    };
  }

  // Evidence on the page always wins. The model's own number is recorded so a
  // disagreement is visible - it is the signature of a quantity inferred from
  // a pack size, which is the class Warwick named - but it never decides.
  if (evidence !== null) {
    return {
      quantity: evidence,
      basis: QUANTITY_BASIS.EXPLICIT,
      evidence,
      modelQuantity,
      modelDisagreed: modelQuantity !== null && modelQuantity !== evidence,
    };
  }

  return {
    quantity: HOUSEHOLD_DEFAULT_QUANTITY,
    basis: QUANTITY_BASIS.HOUSEHOLD_DEFAULT,
    evidence: null,
    // A model quantity with NO page evidence behind it is the Richmond class:
    // a pack size read as a purchase count. It is discarded, and the fact that
    // it was discarded is reported rather than swallowed.
    modelQuantity,
    modelDisagreed: modelQuantity !== null && modelQuantity !== HOUSEHOLD_DEFAULT_QUANTITY,
  };
}
