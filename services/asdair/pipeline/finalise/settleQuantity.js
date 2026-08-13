// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/settleQuantity.js
//
// WO-2026-08-13-04 (WP-B15-37), AC4. Decide the ONE quantity the application
// believes for a corroborated page line, or refuse to decide it.
//
// Warwick's rule, and it is a refusal rule as much as a resolution rule:
//
//     "explicit conflicting observations -> Cockpit uncertainty,
//      NEVER a guessed quantity."
//
// So there is no averaging here, no majority vote, no "take the confident one".
// The ONLY thing permitted to resolve a disagreement is a DETERMINISTIC RULE
// that would have reached the same answer from either reading on its own -
// today that is the pack-identity rule, which turns the real page line
// "16 Richmond Skinless Pork Sausages" into one pack whether the run read the
// leading mark as "16" or as "1 6". Where the rule does not settle it, the
// quantity is NULL and the line is routed.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

import { applyPackIdentityRule } from './packIdentityRule.js';

/**
 * PURE. Settle one corroborated observation's quantity.
 *
 * @param {object} observation - a `corroborate()` observation
 * @param {Map<string,string>} productNameById - catalogue id -> product name
 * @returns {{quantity:number|null, basis:string, settled:boolean,
 *            candidates:number[], packIdentityApplied:boolean,
 *            refusedEvidence:number|null, reason:string|null}}
 */
export function settleQuantity(observation, productNameById) {
  const productName = observation.product_id !== null && observation.product_id !== undefined
    ? (productNameById.get(String(observation.product_id)) || null)
    : null;

  const readings = Array.isArray(observation.quantity_readings) && observation.quantity_readings.length > 0
    ? observation.quantity_readings
    : [{
      run: 'single',
      as_written: observation.as_written,
      quantity: observation.quantity,
      basis: observation.quantity_basis,
    }];

  const applied = readings.map((r) => applyPackIdentityRule({
    quantity: r.quantity,
    quantityBasis: r.basis,
    probeText: r.as_written,
    productName,
  }));

  const distinct = [...new Set(applied
    .map((a) => a.quantity)
    .filter((q) => Number.isInteger(q)))].sort((a, b) => a - b);

  const packApplied = applied.find((a) => a.packIdentityApplied) || null;

  if (distinct.length === 1) {
    const q = distinct[0];
    // Prefer the pack-identity basis when the rule was what settled it: the
    // reason a 1 is on this line must never be mistaken for "the page said 1".
    const winner = packApplied || applied.find((a) => a.quantity === q);
    return {
      quantity: q,
      basis: winner.basis,
      settled: true,
      candidates: distinct,
      packIdentityApplied: packApplied !== null,
      refusedEvidence: packApplied ? packApplied.refusedEvidence : null,
      reason: packApplied ? packApplied.reason : null,
    };
  }

  if (distinct.length === 0) {
    return {
      quantity: null,
      basis: 'no-quantity-read',
      settled: false,
      candidates: [],
      packIdentityApplied: false,
      refusedEvidence: null,
      reason: 'no run read a quantity for this line',
    };
  }

  return {
    quantity: null,
    basis: 'conflicting-observations',
    settled: false,
    candidates: distinct,
    packIdentityApplied: packApplied !== null,
    refusedEvidence: null,
    reason: `the runs disagree about the quantity (${distinct.join(' vs ')}) and no deterministic rule settles it - routed rather than guessed`,
  };
}
