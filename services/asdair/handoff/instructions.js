// =====================================================================
// BUILD-015 AsdAIr - handoff/instructions.js
//
// THE CANONICAL BROWSER METHOD AND THE PROHIBITED ACTIONS, AS DATA.
//
// Sonnet in Claude for Chrome is the Stage 1 live basket writer
// (RUNTIME-DECISION.md, Warwick 2026-08-04). This file is the ONE place the
// method and the prohibitions are written down in executable form. The JSON
// artefact and the human checklist both read from here, so the phone-readable
// text and the machine-readable text can never drift apart - which is exactly
// how three hand-assembled plan files happened on 2026-08-03.
//
// WHY DATA AND NOT PROSE. Two reasons, both load-bearing:
//   1. A test can pin it. PROHIBITED_ACTIONS is asserted against a literal held
//      in the test file, so quietly dropping "never check out" from this list
//      fails the suite rather than shipping.
//   2. RUNTIME-DECISION.md records honestly that Sonnet in Chrome has NO
//      mechanical enforcement of these boundaries - the CDP runner blocks them
//      in code, the browser adapter can only instruct. That makes the wording
//      of the instruction the entire control. It is therefore versioned,
//      pinned and reviewable, not improvised per shop.
//
// PURE ASCII SOURCE ONLY. No dependencies. No clock. No I/O.
// =====================================================================
'use strict';

/**
 * Bumped whenever the method or the prohibitions change. It travels on every
 * artefact, so a completion report can be traced to the exact wording that was
 * in force when the basket was built.
 */
const INSTRUCTIONS_VERSION = 1;

/**
 * The ordered browser method, verbatim from RUNTIME-DECISION.md "What Sonnet in
 * Claude for Chrome must do" and CANONICAL-WEEKLY-SHOP-PROCESS.md section F.
 * Do not reorder: the ordering IS the speed, and step 2 must precede step 3.
 */
const BROWSER_METHOD = Object.freeze([
  'Open the ASDA Regulars / Favourites view.',
  'Change the ASDA ordering to Brand A-Z BEFORE adding anything.',
  'Work the lines below in the order given. They are already sorted to match that view.',
  'Add a KNOWN product from Regulars or Favourites, using the source_view named on its line.',
  'NEVER free-search a known item. If a known item cannot be found in its named view, stop that line and report it as not_found - do not search for it.',
  'Free-search ONLY a line whose origin is new_approved, and ONLY using its approved_search_term exactly as written.',
  'Add the approved new product.',
  "Click ASDA's Favourite control for that new product.",
  'Capture the real ASDA product identity (product reference and URL) for every new product added.',
  'Stop at a checkout-ready basket and report back.',
]);

/**
 * Warwick's gates. RUNTIME-DECISION.md: "Never book a delivery slot - never
 * check out - never pay - never enter a password - never auto-substitute.
 * These are Warwick's gates and no change of runtime touches them."
 *
 * `id` is stable and machine-checkable; `text` is what a human reads.
 */
const PROHIBITED_ACTIONS = Object.freeze([
  Object.freeze({ id: 'no_checkout', text: 'Do NOT check out. Stop at a checkout-ready basket.' }),
  Object.freeze({ id: 'no_payment', text: 'Do NOT pay, and do NOT enter or select any payment method.' }),
  Object.freeze({ id: 'no_delivery_slot', text: 'Do NOT book, change or reserve a delivery slot.' }),
  Object.freeze({ id: 'no_password_entry', text: 'Do NOT enter a password or any credential. If ASDA asks you to log in, stop and report it.' }),
  Object.freeze({ id: 'no_automatic_substitution', text: 'Do NOT accept, enable or choose a substitution. If a product is unavailable, leave it out and report it.' }),
]);

/**
 * What Sonnet must send back. This is the completion contract: ingestCompletion()
 * refuses a report that does not satisfy it, so the wording here and the
 * validation in completion.js describe the same thing.
 */
const COMPLETION_CONTRACT = Object.freeze([
  'Report the packet_fingerprint exactly as printed on this handoff. A report without it, or with a different one, is refused.',
  'For EVERY line: its seq, and one status of added | not_found | out_of_stock | skipped.',
  'For every added line: the quantity actually placed in the basket. For every out_of_stock line: the quantity you were seeking. Never guess either - if you cannot state it, say so instead.',
  'For every added NEW product: its real ASDA product reference and URL, and confirmation that the Favourite control was clicked.',
  'The basket totals you can see: distinct products and total units.',
  'Confirm explicitly that no checkout, payment, slot or substitution action was taken.',
  'Report anything unexpected rather than resolving it.',
]);

/**
 * The reconciliation contract - what Workstream F checks the report against.
 * Stated on the artefact so Sonnet knows in advance what it will be measured
 * on, and so a matching headline count is not mistaken for success.
 */
const RECONCILIATION_CONTRACT = Object.freeze([
  'expected_distinct_products and expected_total_units are compared against the basket.',
  'A matching headline count alone is NOT sufficient - every line identity and quantity is checked too.',
  'Anything unavailable is recorded as unavailable. It is never substituted.',
  'Anything omitted or unexpected is recorded.',
  'Only after this passes does Warwick get "Basket ready for Warwick to review and order."',
]);

/**
 * OPERATING GUIDANCE CARRIED FROM asdair.rules - NEVER HARDCODED HERE.
 *
 * Some household rules are operating guidance for the person at the shelf
 * rather than product identity or quantity (rule 38 is the ruled example). Two
 * boundaries decide where such a rule may travel, and both were ruled rather
 * than chosen:
 *
 *   * NOT in the packet JSON. The packet root is `additionalProperties: false`
 *     and stays closed - it is the deterministic product identity and quantity
 *     contract, and operating guidance is a different kind of fact.
 *   * NOT written into this file. The wording lives in `asdair.rules.rule_text`
 *     and the CALLER passes the row, for exactly the reason the packet builder
 *     refused to hold it: a rule copied into source is a second copy of a fact
 *     that has an owner, and it goes stale silently the moment the household
 *     changes its mind.
 *
 * So this module validates the shape of a rule row and renders it with its id
 * attached. It never authors, edits, defaults or infers the text.
 */
function assertRuleRow(row, i) {
  const at = `operatingRules[${i}]`;
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError(`${at} must be an asdair.rules row object`);
  if (!Number.isInteger(row.id) || row.id < 1) throw new TypeError(`${at}.id must be the rule's integer id, so its provenance is visible`);
  if (typeof row.rule_text !== 'string' || row.rule_text.trim() === '') {
    throw new TypeError(`${at}.rule_text must be the rule's own wording from asdair.rules. This module never supplies it.`);
  }
  if (row.active === false) throw new TypeError(`${at} (rule ${row.id}) is not active - an inactive rule must not be handed to Sonnet`);
  return { rule_id: row.id, text: row.rule_text.trim(), category: row.category == null ? null : String(row.category) };
}

/**
 * Line statuses Sonnet may report. Deliberately has no `substituted` member -
 * substitution is not a permitted outcome anywhere in this product, so there is
 * no vocabulary in which to report one.
 */
const LINE_REPORT_STATUSES = Object.freeze(['added', 'not_found', 'out_of_stock', 'skipped']);

module.exports = {
  INSTRUCTIONS_VERSION,
  BROWSER_METHOD,
  PROHIBITED_ACTIONS,
  COMPLETION_CONTRACT,
  RECONCILIATION_CONTRACT,
  LINE_REPORT_STATUSES,
  assertRuleRow,
};
