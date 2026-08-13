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
  humanStateFor,
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

/**
 * ⚠️ THE STORED VERDICT CAN DRIFT FROM `status`, AND THE READER MUST SAY SO.
 *
 * ── THE HAZARD (found by Lane F, 2026-08-13, proved by execution) ──────────
 *
 * Migration 020 adds `asdair.shop.human_state` with a default and backfills it
 * ONCE. It installs NO TRIGGER. So the column is only correct for as long as
 * every writer of `status` also writes `human_state` in the same transaction.
 * Lane F demonstrated the gap directly: a row inserted with
 * `status = 'READY_TO_SHOP'` came back carrying `human_state = 'ASDAIR_WORKING'`.
 *
 * The pipeline's own transitions are covered (Lane AB wired them and read every
 * status back out of Postgres). The exposure is any OTHER writer - direct SQL, a
 * future service, a path that forgets. That makes this a STANDING HAZARD rather
 * than a bug with a fix date, which is exactly why the read layer needs a
 * position on it.
 *
 * ── WHAT THIS FUNCTION DOES, AND THE TWO THINGS IT REFUSES TO DO ───────────
 *
 * It COMPARES and it REPORTS. It does not choose.
 *
 *   ⛔ It does NOT re-derive the verdict. Reading one stored value is the whole
 *      point of 020, and a read layer that second-guesses the column has simply
 *      recreated the second opinion the column exists to abolish. The fix for
 *      drift belongs at the WRITE side - a trigger or a write-path change - and
 *      that is Silas's schema decision, outside this surface. REPORTED, not
 *      fixed.
 *
 *   ⛔ It does NOT prefer `status` when they disagree. Silently preferring
 *      either field turns a visible contradiction into an invisible one, and
 *      the reader would then be confidently wrong instead of loudly unsure.
 *
 * A disagreement is a REAL CONDITION about this shop, and Warwick is better
 * served seeing "these two records disagree" than a confident single answer
 * that happens to come from the wrong one. This extends the honesty
 * `canonical_state_source` already provides; it invents no new mechanism.
 *
 * @param {object} status the shopStatus projection
 * @returns {{checked:boolean, stored:string|null, expected_from_status:string|null,
 *            agrees:boolean|null, contradiction:string|null}}
 */
function detectStateDrift(status) {
  const s = status && typeof status === 'object' ? status : {};
  const stored = isHumanState(s.human_state) ? s.human_state : null;
  const stage = typeof s.stage === 'string' ? s.stage : s.status;

  const notChecked = {
    checked: false, stored: stored, expected_from_status: null, agrees: null, contradiction: null,
  };

  // Nothing durable to disagree WITH. Where the value was derived from `status`
  // there is one source, so drift is not a thing that can happen.
  if (stored === null || (s.human_state_source && s.human_state_source !== 'column')) return notChecked;

  let expected;
  try {
    // The SAME mapping the writer uses, with the SAME needs_review escalation -
    // comparing against anything else would manufacture disagreements that are
    // really just two different questions.
    expected = humanStateFor(stage, { needs_review: s.needs_review });
  } catch (ignore) {
    // An unknown status cannot be mapped, so nothing can be concluded. Not an
    // agreement, and not a contradiction: unchecked.
    return notChecked;
  }

  const agrees = expected === stored;
  return {
    checked: true,
    stored: stored,
    expected_from_status: expected,
    agrees: agrees,
    contradiction: agrees ? null
      : 'The stored human_state says "' + stored + '" while this shop\'s status ("' + String(stage)
        + '") maps to "' + expected + '". asdair.shop.human_state has NO trigger, so any writer that '
        + 'updates status without updating human_state in the same transaction leaves the two '
        + 'disagreeing. Neither has been preferred here.',
  };
}

module.exports = {
  CANONICAL_STATES: CANONICAL_STATES,
  // Kept for callers that read the mapping itself. It is now THE map, imported
  // from its one home rather than a local copy of it.
  STAGE_MAP: STATUS_TO_HUMAN_STATE,
  computeCanonicalState: computeCanonicalState,
  detectStateDrift: detectStateDrift,
};
