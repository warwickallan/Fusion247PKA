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
//   1. A test can pin it. BROWSER_METHOD and PROHIBITED_ACTIONS are asserted
//      against literals held in the test file, so quietly dropping "never check
//      out" - or dropping the stepper lesson - fails the suite rather than
//      shipping.
//   2. RUNTIME-DECISION.md records honestly that Sonnet in Chrome has NO
//      mechanical enforcement of these boundaries - the CDP runner blocks them
//      in code, the browser adapter can only instruct. That makes the wording
//      of the instruction the entire control. It is therefore versioned,
//      pinned and reviewable, not improvised per shop.
//
// ---------------------------------------------------------------------
// WHERE THE METHOD COMES FROM (v2, 2026-08-09)
// ---------------------------------------------------------------------
// Every behaviour below is drawn from the PRESERVATION CONTRACT in
// `Deliverables/2026-08-09-pax-browser-method-recovery-audit.md` section E,
// whose stated rule is that each line is PROVEN BY A REAL RUN - anything that
// could only be found asserted in a document was excluded by design.
//
// v1 of this file carried three of those behaviours and omitted eleven,
// including the two the household has already paid for in a live basket:
// typed quantities do not persist, and the trolley must be reconciled from
// each line's actual quantity field rather than its displayed price.
//
// One instruction here is NOT evidence-backed in the same way and is labelled
// so nobody later mistakes it for a measured result: `set_brand_az_ordering`.
// The audit classifies Brand A-Z as a DURABLE INSTRUCTION ONLY (class B) -
// RUN-3 used plain A-Z and RUN-2 records it only as Warwick's mid-run
// instruction. It is retained because it is the ruled sort contract the packet
// is built to, not because a run measured it.
//
// PURE ASCII SOURCE ONLY. No dependencies. No clock. No I/O.
// =====================================================================
'use strict';

/**
 * Bumped whenever the method or the prohibitions change. It travels on every
 * artefact, so a completion report can be traced to the exact wording that was
 * in force when the basket was built.
 *
 * v2 (2026-08-09): the full proven method (audit section E), and Warwick's
 * Product Ruling 2 separating household identity from ASDA retrieval method.
 */
const INSTRUCTIONS_VERSION = 2;

/**
 * THE ORDERED BROWSER METHOD.
 *
 * Each entry has a STABLE `id` and the `text` a human reads. The id is what the
 * test pins, so the wording can be improved without weakening the check while
 * DROPPING a behaviour still fails the suite.
 *
 * Do not reorder casually: the ordering is the shape of the shop. Audit the
 * trolley before touching it, source before searching, verify before moving on,
 * reconcile before stopping.
 */
const BROWSER_METHOD = Object.freeze([
  Object.freeze({
    id: 'audit_trolley_first',
    text: 'Before adding anything, read what is already in the trolley. Leave every line that is already correct exactly as it is. Do not clear the trolley and start again.',
  }),
  Object.freeze({
    id: 'set_brand_az_ordering',
    text: 'Set the ASDA ordering to Brand A-Z before you add anything, so the page order matches this list. Do this BEFORE you start working down the list, not part-way through.',
  }),
  Object.freeze({
    id: 'consume_plan_in_order',
    text: 'Work the lines below in the order given, top to bottom. They are already sorted. Never re-sort them, and never reinterpret the original handwritten list yourself - the line as written here is the decision.',
  }),
  Object.freeze({
    id: 'regulars_favourites_first',
    text: 'Source from the Regulars / Favourites view FIRST. Do NOT browse category or shelf pages hunting a size variant - that was stopped mid-shop once and must not come back.',
  }),
  Object.freeze({
    id: 'known_item_retrieval',
    text: 'A KNOWN household item is identified by our catalogue, not by how you find it. Use its ASDA product reference when this list gives you one. When it does not, you MAY search or navigate ASDA to retrieve it, using only the product identity, brand and variant printed on its line. Searching is how you FETCH it - it does NOT make the item "new". Before adding, check the ASDA product you found really is that household product. If two or more plausible products remain, STOP that line and ask - never pick the least-bad one, and never quietly swap in something else.',
  }),
  Object.freeze({
    id: 'new_item_search_exact_wording',
    text: 'Free-search a NEW approved line using its approved wording EXACTLY as printed. That wording is Warwick\'s approval; never widen it, narrow it or improve it.',
  }),
  Object.freeze({
    id: 'favourite_and_capture_new_product',
    text: 'After adding an approved NEW product, click ASDA\'s Favourite control for it and capture its real ASDA product reference and URL.',
  }),
  Object.freeze({
    id: 'one_session_one_page_context',
    text: 'Work one coherent browser session and one page context. Do NOT open a page per product - the whole speed of this method is many items from one page.',
  }),
  Object.freeze({
    id: 'read_structure_not_pixels',
    text: 'Read STRUCTURE, not pixels: use the page text / accessibility tree to locate each product\'s quantity input and checkbox by reference. Screenshots come out blank on the heavy Regulars grid, so do not rely on them there; the trolley page itself renders fine.',
  }),
  Object.freeze({
    id: 'reacquire_refs_after_mutation',
    text: 'Re-acquire your page references after EVERY mutation. Adding, ticking or changing a quantity re-renders the grid, and a reference captured before that change may now point at the wrong row.',
  }),
  Object.freeze({
    id: 'batch_adds_and_split_on_failure',
    text: 'Batch adds where the grid offers a multi-select - one 25-item bulk tick has succeeded in a real shop. It is not guaranteed: a 14-item bulk add once failed twice in a row. If a batch fails, treat that as an OUT-OF-STOCK signal and split it to ISOLATE and DROP the offending item. Do NOT conclude the batch was too big.',
  }),
  Object.freeze({
    id: 'verify_each_add_from_trolley',
    text: 'Verify every add from the trolley itself before moving to the next line. Do not trust that a click worked because it did not visibly fail.',
  }),
  Object.freeze({
    id: 'unavailable_item_handling',
    text: 'Handle an unavailable item deliberately: confirm it on its own product page, leave it OUT of the basket, and report the priced alternatives you can see. Never substitute.',
  }),
  Object.freeze({
    id: 'quantity_by_stepper_not_typing',
    text: 'Correct a quantity with the + / - steppers, never by typing into the field. A TYPED quantity does not persist server-side and the page will show it as though it did. If you must type, reload and re-read the field before believing it.',
  }),
  Object.freeze({
    id: 'reconcile_from_quantity_field',
    text: 'Reconcile the finished trolley line by line, reading each line\'s ACTUAL quantity field from the trolley. Never infer a quantity from the displayed price - multibuy offers change the price and will lie to you. This check has caught real errors, including an item silently missed entirely.',
  }),
  Object.freeze({
    id: 'batch_questions_into_one_ask',
    text: 'Collect every open question into ONE message and wait for the answers. Do not ask them one at a time, and do not guess to avoid asking.',
  }),
  Object.freeze({
    id: 'stop_at_checkout_ready_basket',
    text: 'Stop at a checkout-ready basket and report back. Never book a slot, check out, pay, or enter a credential.',
  }),
  Object.freeze({
    id: 'record_run_and_mark_reuse',
    text: 'Report the run so it survives: what you did, what you could not do, and for every question that got answered, whether that answer should apply again next week.',
  }),
]);

/**
 * PROVEN ENVIRONMENTAL CONSTRAINTS - facts about ASDA, not actions.
 *
 * Kept deliberately SEPARATE from BROWSER_METHOD. The recovery audit records
 * this as a constraint rather than a numbered behaviour precisely because no
 * run proves an ACTION here - it proves an ABSENCE. Folding it in with the
 * behaviours would dress an absence up as a proven move.
 */
const ENVIRONMENT_CONSTRAINTS = Object.freeze([
  Object.freeze({
    id: 'regulars_not_curatable',
    text: 'The ASDA Regulars list is auto-generated from order history and has NO manual per-item remove control. You cannot curate it. Favourites is the surface that can be shaped, which is why favouriting an approved new product is the only lever over what next week\'s grid looks like.',
  }),
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
 * WARWICK'S PRODUCT RULING 2 (2026-08-09), as data.
 *
 * "Known household identity and ASDA retrieval method are SEPARATE concerns."
 *
 * This travels with any KNOWN line that has no usable ASDA product reference.
 * Before this ruling such a line refused the ENTIRE weekly shop, against a
 * catalogue where a large minority of known products carry no reference.
 *
 * The ruling's four load-bearing clauses, kept as separate entries so a test
 * can prove each one still reaches the worker:
 *   retrieval_permitted   - search/navigation is allowed as a RETRIEVAL route
 *   identity_unchanged    - it does NOT reclassify the item as new
 *   verify_before_add     - the found product is checked against our identity
 *   ambiguity_stops_line  - several plausible matches means ASK, never choose
 */
const RETRIEVAL_CONTRACT = Object.freeze([
  Object.freeze({
    id: 'retrieval_permitted',
    text: 'This is a KNOWN household product with no ASDA reference on file. You MAY find it by searching or navigating ASDA, using the product identity, brand and variant printed on this line.',
  }),
  Object.freeze({
    id: 'identity_unchanged',
    text: 'Searching for it does NOT make it a new product. It stays a known household item and needs no approval - retrieval is a method, not a reclassification.',
  }),
  Object.freeze({
    id: 'verify_before_add',
    text: 'Before you add it, verify the ASDA product you found IS this household product - same brand, same variant, same size. Never silently substitute something close.',
  }),
  Object.freeze({
    id: 'ambiguity_stops_line',
    text: 'If two or more plausible products are still in the running, STOP this line and ask. Do not choose the least-bad result.',
  }),
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
  'For every KNOWN line you had to retrieve by searching: confirm you checked the product against the identity printed on its line before adding it.',
  'If a line stopped because several plausible products remained, say so IN WORDS as a question for Warwick, and name the candidates. Do NOT file it as not_found - "I could not find it" and "I found too many" are different facts and only one of them is a search failure.',
  'The basket totals you can see: distinct products and total units.',
  'Confirm explicitly that no checkout, payment, slot or substitution action was taken.',
  'Report anything unexpected rather than resolving it.',
  'For every question that got answered during this shop, say whether that answer should apply again next week.',
]);

/**
 * The reconciliation contract - what Workstream F checks the report against.
 * Stated on the artefact so Sonnet knows in advance what it will be measured
 * on, and so a matching headline count is not mistaken for success.
 */
const RECONCILIATION_CONTRACT = Object.freeze([
  'expected_distinct_products and expected_total_units are compared against the basket.',
  'A matching headline count alone is NOT sufficient - every line identity and quantity is checked too.',
  'Quantities are read from each trolley line\'s own quantity field, never inferred from the displayed price.',
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
 *
 * KNOWN GAP, recorded rather than papered over: there is also no member for
 * "found too many plausible products, stopping to ask". Warwick's Ruling 2
 * requires that behaviour, and COMPLETION_CONTRACT carries it as a duty stated
 * in words. A status was deliberately NOT added here (Larry, 2026-08-09):
 * the status label map that renders these lives in
 * services/asdair/cockpit-api/readPacket.js, outside this Work Order's file
 * surface, so adding a member would have shipped a known display gap to buy
 * tidiness. Reported as a residual instead.
 */
const LINE_REPORT_STATUSES = Object.freeze(['added', 'not_found', 'out_of_stock', 'skipped']);

module.exports = {
  INSTRUCTIONS_VERSION,
  BROWSER_METHOD,
  ENVIRONMENT_CONSTRAINTS,
  PROHIBITED_ACTIONS,
  RETRIEVAL_CONTRACT,
  COMPLETION_CONTRACT,
  RECONCILIATION_CONTRACT,
  LINE_REPORT_STATUSES,
  assertRuleRow,
};
