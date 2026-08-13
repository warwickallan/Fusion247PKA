// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/humanRouting.js
//
// WO-2026-08-13-10 (WP-B15-40), AC5. THE TRUTHFUL ROUTE TO A HUMAN.
//
// Warwick's ruling, and it is the whole reason this module exists:
//
//     "Three readings by one model of one image are CORROBORATED, never
//      VERIFIED. The system must still have a truthful route to HUMAN rather
//      than silently turning agreement into certainty where other evidence
//      conflicts."
//
// ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
// `corroborate()` computes `vision_needs_human` and `vision_needs_human_reasons`
// for every observation, carrying forward the vision layer's OWN "ask a human"
// referral (agenticVisionPrototype/groundLines.js NEEDS_HUMAN). Before this
// module, NOTHING IN THE PIPELINE READ EITHER FIELD. They were computed and
// discarded - a signal whose only effect was to exist.
//
// Measured on the frozen 39-line reading at the time this was written: five
// established lines carried `vision_needs_human: true`, FOUR of them unanimous
// 3-of-3, and every one of the five had `identity_disagreement: false` and a
// settled quantity - so all five passed every certainty test the pipeline had
// and entered the shop as shoppable. Three correlated readings agreeing is
// exactly the case where agreement proves nothing, and the loudest of them
// ("4 x 4pts. ARLA SEMI SKIMMED MILK", an unresolved cross-region duplicate)
// reached Warwick's basket carrying an implied certainty nobody had earned.
//
// ── WHY THIS IS AN ALLOWLIST AND NOT A DENYLIST ──────────────────────────
// A referral is discharged ONLY if it appears in DETERMINISTICALLY_SETTLED
// below - a CLOSED list of causes that a deterministic rule provably resolves.
// Every other cause, INCLUDING ONE THAT DOES NOT EXIST YET, routes to a human.
//
// That direction is deliberate and is the fail-safe one. A denylist would mean
// a new referral cause added to the vision layer tomorrow is silently swallowed
// here and never reaches Warwick; an allowlist means it is routed until someone
// deliberately proves a rule settles it. The costly failure is a line that
// needed a human and did not get one - never the reverse.
//
// ── WHAT IS DELIBERATELY *NOT* ROUTED, AND ON WHOSE AUTHORITY ────────────
// `leading_mark_disagreement` is discharged, because Warwick's pack-identity
// convention ALREADY settles it by deterministic rule: "16 Richmond Skinless
// Pork Sausages" is one pack whether a run read the leading mark as "16" or as
// "1 6", and `settleQuantity`/`packIdentityRule` reach the same answer from
// either reading. Routing those to a human would be the system forgetting a
// decision it already holds. It is discharged ONLY when the quantity actually
// settled - where `settleQuantity` refused, `settled === false` routes the line
// on its own and this module never overrides that.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

/**
 * CLOSED ALLOWLIST. A vision referral cause that a DETERMINISTIC RULE provably
 * resolves, so it does not by itself require a human.
 *
 * Adding a member here is a product decision, not a tidy-up: it asserts that a
 * rule in this codebase reaches the same answer from either conflicting
 * reading. Nothing may be added without naming that rule.
 */
export const DETERMINISTICALLY_SETTLED = Object.freeze([
  // Settled by finalise/packIdentityRule.js, on Warwick's pack-identity ruling:
  // pack size is IDENTITY, never purchase quantity.
  'leading_mark_disagreement',
]);

const SETTLED = new Set(DETERMINISTICALLY_SETTLED);

/**
 * PURE. The vision referral causes on this observation that NO deterministic
 * rule discharges. Empty means every cause it carried is provably settled.
 *
 * @param {object} observation - a `corroborate()` observation
 * @returns {string[]} the unsettled causes, in the order the observation carried them
 */
export function unresolvedHumanReasons(observation) {
  const reasons = Array.isArray(observation && observation.vision_needs_human_reasons)
    ? observation.vision_needs_human_reasons
    : [];
  return reasons.filter((r) => !SETTLED.has(r));
}

/**
 * PURE. Does this observation have to reach a human before it can be shopped?
 *
 * The four independent causes, any one of which is sufficient. They are listed
 * rather than collapsed so that a return can say WHICH one fired:
 *
 *   1. `unsupported`      - fewer than two independent readings saw it at all.
 *   2. `identity_conflict`- the readings disagree about WHAT the product is.
 *   3. `quantity_unsettled` - `settleQuantity` refused to pick a number.
 *   4. `vision_referral`  - the vision layer referred it and no deterministic
 *                           rule discharges the cause. THIS IS THE ONE THAT
 *                           SURVIVES UNANIMOUS AGREEMENT, and it is why
 *                           agreement can no longer become certainty here.
 *
 * @param {object} observation - a `corroborate()` observation
 * @param {{settled:boolean}} settled - the `settleQuantity` result for it
 * @returns {{human:boolean, causes:string[], unresolvedReasons:string[]}}
 */
export function routeToHuman(observation, settled) {
  const causes = [];

  if (!(Number(observation && observation.support) >= 2)) causes.push('unsupported');
  if (observation && observation.identity_disagreement === true) causes.push('identity_conflict');
  if (settled && settled.settled === false) causes.push('quantity_unsettled');

  const unresolvedReasons = unresolvedHumanReasons(observation);
  if (unresolvedReasons.length > 0) causes.push('vision_referral');

  return { human: causes.length > 0, causes, unresolvedReasons };
}
