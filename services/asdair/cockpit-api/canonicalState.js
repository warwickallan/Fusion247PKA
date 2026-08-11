// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/canonicalState.js
//
// THE ONE PLACE THE SIX-VALUE CANONICAL SHOP STATE IS COMPUTED (AC1).
//
// WHAT THE DESIGN ASKS FOR
// `Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md` Part 2,
// "Overview screen": one canonical human-facing state, computed ONCE in the
// pipeline layer and consumed by both Cockpit and Telegram - never
// recalculated independently by each surface. Exactly six values:
//   NEEDS_WARWICK / ASDAIR_WORKING / READY_FOR_WARWICK / BROWSER_WORKING /
//   COMPLETE / FAILED
//
// THIS IS A DOCUMENTED PLACEHOLDER, NOT THE FINAL FIELD (WO-2026-08-11-B15-
// COCKPIT-BE-01 `schema_decision`). The parallel vision-pipeline WP
// (WO-2026-08-11-B15-VISION-01) is expected to introduce a genuinely durable
// field for this state, written once by the pipeline itself. That field does
// not exist anywhere in services/asdair as of this WP (grepped for every
// candidate name - NEEDS_WARWICK / ASDAIR_WORKING / READY_FOR_WARWICK /
// BROWSER_WORKING / shop_state / "canonical.*state" - zero hits outside this
// file and its own test). Inventing that schema is Silas's decision, not
// Keel's (per Keel's contract, "The Silas boundary"), so this module derives
// the six values from the EXISTING durable projection instead.
//
// THE EXACT INTEGRATION POINT, FOR WHOEVER LANDS THE REAL FIELD:
//   1. Add the durable column/table (Silas's decision) and have
//      services/asdair/shop/shopStatus.js's getShopStatus() read it onto the
//      `status` object this module already receives (no new query needed
//      here - shopStatus already opens one consistent snapshot).
//   2. Replace the body of computeCanonicalState() with a direct read of
//      that field (falling back to this stage/needs_review mapping only for
//      historical shops written before the field existed, if that matters).
//   3. Delete STAGE_MAP and this file's placeholder tests once nothing
//      depends on the derived path any more.
// Until then, this is the ONE function that may derive the six-value state.
// Nothing else in cockpit-api or services/cockpit/** may recompute it - that
// is what AC1's "checkable by: grep for any second, independent
// state-derivation logic" is asserting the absence of.
//
// PURE. No DB, no clock, no network, no randomness. The input is the SAME
// `status` object shopStatus.getShopStatus() already returns inside
// readWorkspace.js's one consistent read-only snapshot - this module adds no
// new query and reads no raw counts of its own; `needs_review` is read as
// the durable boolean the projection already carries, never recomputed from
// a list of open items.
// =====================================================================

'use strict';

/** The six canonical values, and nothing else. */
const CANONICAL_STATES = Object.freeze([
  'NEEDS_WARWICK',
  'ASDAIR_WORKING',
  'READY_FOR_WARWICK',
  'BROWSER_WORKING',
  'COMPLETE',
  'FAILED',
]);

// The 12-state pipeline lifecycle (services/asdair/shop/shopState.js
// SHOP_STATUSES) mapped onto the six-value model above. A PLACEHOLDER
// mapping - see the file header. Every one of the 12 stages must appear here
// exactly once; canonicalState.test.js asserts that against the real
// SHOP_STATUSES export so a new pipeline stage cannot silently fall through.
//
// The two calls worth explaining, because nothing in this WP's inputs
// settles them and a future reader should not have to re-derive the
// reasoning:
//   * CANCELLED -> COMPLETE, not FAILED. An abandoned shop is not an error
//     and nothing further is owed to Warwick - it reads the same as a
//     finished one from "does this need my attention" perspective. Flagged
//     as an assumption in this WP's handback; the real field's semantics
//     may reasonably disagree.
//   * SHOPPING -> BROWSER_WORKING, not ASDAIR_WORKING. By the time a shop
//     reaches SHOPPING, WAITING_FOR_BROWSER has already handed the build to
//     the supervised runner (see shopState.js's transition map:
//     WAITING_FOR_BROWSER -> SHOPPING is the only forward move into it), so
//     "the browser is working" is the true statement, not "AsdAIr is
//     working" in the planning sense RECEIVED/TRANSCRIBING/PROCESSING mean.
const STAGE_MAP = Object.freeze({
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
  CANCELLED: 'COMPLETE',
});

function fail(message) {
  throw new Error('canonicalState: ' + message);
}

/**
 * PURE. THE ONE canonical-state derivation. See the file header for why this
 * is a placeholder and what supersedes it.
 *
 * @param {{stage?:string, needs_review?:boolean|null}} status  the SAME
 *        object shopStatus.getShopStatus() already returned - not a new
 *        read, and never a raw count tallied by this module.
 * @returns {string} one of CANONICAL_STATES
 */
function computeCanonicalState(status) {
  const s = status && typeof status === 'object' ? status : {};
  const stage = s.stage;

  if (typeof stage !== 'string' || !(stage in STAGE_MAP)) {
    fail('unknown or missing stage "' + String(stage) + '" - not one of the known pipeline stages this '
      + 'module maps. Refusing to guess a canonical state for it rather than silently misreporting one.');
  }

  // FAILED is unconditional: a failed shop is FAILED regardless of needs_review.
  if (stage === 'FAILED') return 'FAILED';

  // Terminal (finished or abandoned) is unconditional too - nothing is
  // pending from Warwick once a shop is RECONCILED or CANCELLED.
  if (stage === 'RECONCILED' || stage === 'CANCELLED') return STAGE_MAP[stage];

  // needs_review is a DURABLE BOOLEAN already on the projection (never a
  // count this module tallies), and it can be true mid-pipeline (a stalled
  // or ambiguous read) even outside the NEEDS_DECISION stage. Read it, do
  // not recompute it, and let it escalate any live, non-terminal stage.
  if (s.needs_review === true) return 'NEEDS_WARWICK';

  return STAGE_MAP[stage];
}

module.exports = {
  CANONICAL_STATES: CANONICAL_STATES,
  STAGE_MAP: STAGE_MAP,
  computeCanonicalState: computeCanonicalState,
};
