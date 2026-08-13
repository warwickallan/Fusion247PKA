// =====================================================================
// BUILD-015 AsdAIr - shop/humanState.js
//
// THE ONE PLACE THE SIX-VALUE HUMAN-FACING STATE IS DERIVED (WP-B15-35 AC1/AC2).
//
// WHY THIS FILE EXISTS, AND WHY IT IS HERE RATHER THAN IN cockpit-api
// Migration 020 section 5 settled the schema and handed the mapping to the
// implementer in as many words:
//
//     "What THIS migration guarantees is the vocabulary and the single column
//      both surfaces read; WHAT MAPS TO WHAT is Keel's to implement (extending
//      shopState.js with the mapping function), written by the SAME code path
//      that already transitions shop.status, so Cockpit and Telegram only ever
//      SELECT this column and never independently derive their own reading of
//      it."
//
// So the mapping lives beside the state machine it mirrors, NOT in the Cockpit
// reader. cockpit-api/canonicalState.js previously carried its own STAGE_MAP;
// it now delegates here. That is the whole of AC2: two surfaces cannot disagree
// about which state a shop is in, because there is only one function that
// decides.
//
// PURE. No DB, no clock, no network, no randomness.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { SHOP_STATUSES } = require('./shopState');

// The six canonical values, and nothing else. Mirrors the CHECK constraint
// `shop_human_state_known` in db/020_shop_line_provenance_and_human_state.sql;
// humanState.test.js parses that migration and asserts the two agree, exactly
// as schemaCompat.test.js already does for the 12 pipeline statuses. A drift is
// a test failure, not a runtime surprise on a real shop.
const HUMAN_STATES = Object.freeze([
  'NEEDS_WARWICK',
  'ASDAIR_WORKING',
  'READY_FOR_WARWICK',
  'BROWSER_WORKING',
  'COMPLETE',
  'FAILED',
]);

// ---------------------------------------------------------------------
// THE MAPPING. Every one of the 12 pipeline statuses appears exactly once;
// humanState.test.js asserts that against SHOP_STATUSES itself, so a new
// pipeline stage cannot silently fall through to a default.
//
// TWO CALLS ARE PRODUCT DECISIONS RATHER THAN MECHANICS, and both were taken
// deliberately. Migration 020 flagged them as "genuinely arguable and for
// Keel/Warwick to confirm at implementation time, not settled here":
//
//   * BASKET_READY -> READY_FOR_WARWICK. CONFIRMED (Larry, 2026-08-13). The
//     basket is built and what is owed is Warwick's review, so it belongs on
//     his side of the line, not AsdAIr's.
//
//   * CANCELLED -> FAILED. Migration 020 and the first Cockpit implementation
//     both proposed COMPLETE. OVERRULED (Larry, 2026-08-13), and the reasoning
//     is recorded here because the mapping looks wrong without it:
//
//         "Complete" tells Warwick his shop is done, which for a cancelled
//         shop implies groceries are coming when nothing was ordered.
//         "Failed" is imprecise - cancellation is deliberate, not breakage -
//         but imprecise in the SAFE direction.
//
//     The imprecision is repaired one layer up rather than here: the closed
//     six-value set cannot express "deliberately abandoned", so AC3's sentence
//     carries the nuance ("This shop was cancelled. Nothing was ordered.").
//     That is why explainBlockage() reads `stage` and not only this value.
//     Reversing this is a one-word change to the line below plus its test.
// ---------------------------------------------------------------------
const STATUS_TO_HUMAN_STATE = Object.freeze({
  RECEIVED: 'ASDAIR_WORKING',
  TRANSCRIBING: 'ASDAIR_WORKING',
  PROCESSING: 'ASDAIR_WORKING',
  NEEDS_DECISION: 'NEEDS_WARWICK',
  READY_TO_SHOP: 'READY_FOR_WARWICK',
  WAITING_FOR_BROWSER: 'BROWSER_WORKING',
  SHOPPING: 'BROWSER_WORKING',
  BASKET_READY: 'READY_FOR_WARWICK',
  ORDER_CONFIRMATION_RECEIVED: 'ASDAIR_WORKING',
  RECONCILED: 'COMPLETE',
  FAILED: 'FAILED',
  CANCELLED: 'FAILED',
});

// A shop is terminal when nothing further is owed by anyone. needs_review must
// not be able to drag a finished or abandoned shop back onto Warwick's plate.
const TERMINAL_FOR_HUMAN = Object.freeze(['RECONCILED', 'CANCELLED', 'FAILED']);

function fail(message) {
  throw new Error('humanState: ' + message);
}

/** True when `value` is one of the six. Nothing else is a human state. */
function isHumanState(value) {
  return typeof value === 'string' && HUMAN_STATES.indexOf(value) !== -1;
}

/**
 * PURE. THE derivation. One status (+ the durable needs_review boolean) in,
 * one of the six out.
 *
 * REFUSES TO GUESS. An unknown status throws rather than defaulting, because a
 * default here is precisely how a new pipeline stage would start reporting
 * "AsdAIr working" to Warwick while actually being unhandled.
 *
 * needs_review is READ as the durable boolean the projection already carries -
 * never recomputed from a list of open items. It escalates any LIVE stage to
 * NEEDS_WARWICK, and is deliberately powerless over a terminal one.
 *
 * @param {string} status one of shopState.SHOP_STATUSES
 * @param {{needs_review?:boolean|null}} [flags]
 * @returns {string} one of HUMAN_STATES
 */
function humanStateFor(status, flags) {
  if (typeof status !== 'string' || !Object.prototype.hasOwnProperty.call(STATUS_TO_HUMAN_STATE, status)) {
    fail('unknown or missing status "' + String(status) + '" - not one of the ' + SHOP_STATUSES.length +
      ' known pipeline statuses. Refusing to guess a human state rather than silently misreporting one.');
  }

  if (TERMINAL_FOR_HUMAN.indexOf(status) !== -1) return STATUS_TO_HUMAN_STATE[status];

  const f = flags && typeof flags === 'object' ? flags : {};
  if (f.needs_review === true) return 'NEEDS_WARWICK';

  return STATUS_TO_HUMAN_STATE[status];
}

/**
 * PURE. What the backend should report, given a row that MAY OR MAY NOT carry
 * the durable column.
 *
 * THE SEAM THIS FUNCTION EXISTS TO MAKE HONEST (WP-B15-35 AC1).
 *
 * ⚠️ CORRECTED 2026-08-13 (WP-B15-41). This comment previously stated that
 * migration 020 "HAS NOT BEEN APPLIED" and that `asdair.shop` carries no
 * `human_state` column. That was a dated observation written as a standing
 * fact, and 020 was applied and verified the same day. It is the SECOND copy of
 * the identical false claim - AC9 named the one in cockpit-api/provenance.js,
 * and this one was found by searching for the CLAIM rather than by trusting the
 * one location that had been pointed at.
 *
 * The function's reason for existing is unchanged and does not depend on which
 * migrations are applied: a database may or may not carry the column, code that
 * simply SELECTed it would 500 the whole Cockpit where it is absent, and code
 * that silently fell back would hide that the canonical column is missing. So
 * the fallback is explicit and it is REPORTED:
 *
 *   source 'column'  - the durable value was read. This is the intended state.
 *   source 'derived' - the column is absent (or empty) and the value was
 *                      derived from `status` by the SAME mapping that writes
 *                      the column, so the two can never disagree in content -
 *                      only in durability.
 *
 * The caller surfaces `source` so an operator can see which path answered, and
 * so "the migration has not been run" is visible rather than inferred.
 *
 * @param {{status?:string, human_state?:string|null, needs_review?:boolean|null}} row
 * @returns {{human_state:string, source:'column'|'derived'}}
 */
function resolveHumanState(row) {
  const r = row && typeof row === 'object' ? row : {};

  if (isHumanState(r.human_state)) {
    return { human_state: r.human_state, source: 'column' };
  }

  return { human_state: humanStateFor(r.status, r), source: 'derived' };
}

module.exports = {
  HUMAN_STATES: HUMAN_STATES,
  STATUS_TO_HUMAN_STATE: STATUS_TO_HUMAN_STATE,
  TERMINAL_FOR_HUMAN: TERMINAL_FOR_HUMAN,
  isHumanState: isHumanState,
  humanStateFor: humanStateFor,
  resolveHumanState: resolveHumanState,
};
