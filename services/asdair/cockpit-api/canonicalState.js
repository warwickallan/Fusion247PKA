// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/canonicalState.js
//
// THE COCKPIT'S ACCESS TO THE SIX-VALUE CANONICAL SHOP STATE.
//
// ⚠️ THIS FILE NO LONGER DERIVES ANYTHING. IT DELEGATES (WP-B15-35 AC1/AC2).
//
// WHAT CHANGED, AND WHY IT MATTERS MORE THAN IT LOOKS
//
// The first version of this module carried its OWN `STAGE_MAP` from the 12
// pipeline statuses to the six human-facing values, described in its own header
// as "a documented placeholder, not the final field", pending a durable column
// that did not yet exist anywhere in services/asdair.
//
// That column now exists - `asdair.shop.human_state`, migration 020 section 5 -
// and the mapping that fills it lives in `shop/humanState.js`, beside the state
// machine it mirrors and inside the code path that writes it. Migration 020
// required exactly that: the value is "written by the SAME code path that
// already transitions shop.status, so Cockpit and Telegram only ever SELECT
// this column and never independently derive their own reading of it."
//
// Keeping a second copy of the mapping here would have been the precise defect
// AC2 forbids - "two surfaces must never be able to disagree about which state
// a shop is in". Two maps that agree today are two maps that disagree after the
// next edit to one of them. So there is now exactly ONE map, in one file, and
// this module re-exports the reading of it.
//
// THE SEAM, STATED HONESTLY. `shopStatus.getShopStatus()` already resolves the
// value - from the durable column where migration 020 has been applied, and by
// deriving it with the same shared function where it has not - and reports
// which of the two happened in `human_state_source`. This module prefers that
// resolved value and only falls back for a caller that has not been updated to
// supply it.
//
// PURE. No DB, no clock, no network, no randomness.
// =====================================================================

'use strict';

const {
  HUMAN_STATES,
  STATUS_TO_HUMAN_STATE,
  isHumanState,
  resolveHumanState,
} = require('../shop/humanState');

/**
 * The six canonical values, and nothing else.
 *
 * Re-exported rather than redeclared: a Cockpit reader importing this constant
 * and a writer importing shop/humanState.js are looking at the same frozen
 * array, so a value can never be renderable by one and unwritable by the other.
 */
const CANONICAL_STATES = HUMAN_STATES;

/**
 * THE ONE canonical-state read for the Cockpit. Delegates; derives nothing.
 *
 * Accepts the `status` object shopStatus.getShopStatus() returns. Where that
 * object carries `human_state` (which it now always does - resolved from the
 * durable column or derived by the shared mapping), it is used as-is. Where an
 * older caller supplies only `stage`, the shared mapping is applied to that.
 *
 * REFUSES TO GUESS, exactly as before: an unrecognised stage throws rather than
 * defaulting to a plausible-looking state.
 *
 * @param {{stage?:string, status?:string, human_state?:string|null, needs_review?:boolean|null}} status
 * @returns {string} one of CANONICAL_STATES
 */
function computeCanonicalState(status) {
  const s = status && typeof status === 'object' ? status : {};

  // Already resolved upstream - the normal path.
  if (isHumanState(s.human_state)) return s.human_state;

  // shopStatus exposes the pipeline status as `stage`; shopStore rows call it
  // `status`. Accept either, and let humanState.js refuse anything unknown.
  return resolveHumanState({
    status: typeof s.stage === 'string' ? s.stage : s.status,
    needs_review: s.needs_review,
  }).human_state;
}

module.exports = {
  CANONICAL_STATES: CANONICAL_STATES,
  // Kept for callers that read the mapping itself. It is now THE map, imported
  // from its one home rather than a local copy of it.
  STAGE_MAP: STATUS_TO_HUMAN_STATE,
  computeCanonicalState: computeCanonicalState,
};
