// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/provenance.js
//
// WHERE EVERY LINE OF THIS WEEK'S SHOP CAME FROM (WP-B15-35 AC4).
//
// ⛔ THE FOUR ORIGINS STAY DISTINCT AND ARE NEVER COLLAPSED.
//    PHOTO is not REGULARS. REGULARS is not RULE. RULE is not WARWICK.
//    Warwick needs to see what came from each, and a single "added by AsdAIr"
//    bucket would destroy exactly the information he asked for.
//
// THE VOCABULARY IS NOT INVENTED. 'PHOTO' | 'REGULARS' | 'RULE' | 'WARWICK' is
// the closed set of `asdair.shop_line_provenance.provenance`, enforced by that
// table's own CHECK constraint in migration 020 section 2. SKIPPED is the fifth
// display bucket - not an origin but a disposition, and Warwick's summary
// equation subtracts it, so it travels with them.
//
// ── THE HONEST GAP, WHICH IS THE WHOLE DESIGN PROBLEM HERE ──────────────────
//
// `asdair.shop_line_provenance` is the table that would answer this question
// exactly. Verified read-only against the live database on 2026-08-13: IT DOES
// NOT EXIST - migration 020 is committed to this repository and has not been
// applied. So three of the five buckets are derivable from durable data that
// does exist, and two are not:
//
//   PHOTO    EXACT.   asdair.shop_line rows joined to the list by list_item_id.
//                     Live check: shop 26 has 39 lines, 39 of them linked.
//                     That IS Warwick's "39 from the photograph".
//   WARWICK  EXACT.   a human decision (shop_decision.interpreted_by='human')
//                     or a line the human corrected (shop_line.corrected).
//   SKIPPED  EXACT.   shopping_list_items.status='excluded_this_week'.
//   REGULARS PARTIAL. only where the run durably reported a count
//                     (status.regulars_added). Otherwise UNKNOWN.
//   RULE     UNKNOWN. ALWAYS, today. Nothing durable records that a standing
//                     household rule put an item on a list. The provenance
//                     ledger is the mechanism that would, and it is not there.
//
// AN UNKNOWN BUCKET RETURNS null AND IS RENDERED "unknown". IT IS NEVER
// RETURNED AS 0. "0 from household rules" is a claim that no rule fired, which
// is a different statement from "we do not record that yet" - and it is the
// claim a reader would act on. Every unknown carries a NAMED GAP saying what is
// missing and what would close it.
//
// Items attributable to none of the exact buckets are counted as
// `unattributed` and REPORTED AS SUCH. They are deliberately NOT distributed
// across REGULARS and RULE to make the equation balance: a tidy total built
// from a guess is worse than a visible gap.
//
// PURE. No DB, no clock, no network, no randomness.
//
// PURE ASCII only.
// =====================================================================

'use strict';

/** The five display buckets, in the order Warwick reads them. */
const ORIGINS = Object.freeze(['PHOTO', 'REGULARS', 'RULE', 'WARWICK', 'SKIPPED']);

/** Item statuses that mean "deliberately left out of this week's shop". */
const SKIPPED_ITEM_STATUSES = Object.freeze(['excluded_this_week', 'not_added']);

/** Item statuses that mean the run reached a conclusion about the line. */
const RECONCILED_ITEM_STATUSES = Object.freeze(['added', 'substituted', 'discontinued']);

function arr(v) { return Array.isArray(v) ? v : []; }
function key(v) { return v === null || v === undefined || v === '' ? null : String(v); }

/**
 * PURE. Attribute every list item to at most ONE origin, using durable
 * evidence only. An item nothing durable speaks for is attributed to NOTHING -
 * it is not guessed into a bucket.
 *
 * @returns {Map<string,string>} list_item_id -> one of ORIGINS
 */
function attributeItems(input) {
  const origins = new Map();

  // PHOTO: the interpretation of the photograph produced this line, and the
  // line was bound to this list item. Both halves are durable.
  for (const line of arr(input.shop_lines)) {
    const k = key(line && line.list_item_id);
    if (k !== null) origins.set(k, 'PHOTO');
  }

  // WARWICK OVERRIDES PHOTO, deliberately. A line Warwick corrected is HIS
  // line now, whatever originally read it - that is the fact he is looking for
  // when he asks what he decided this week.
  for (const line of arr(input.shop_lines)) {
    if (!line || line.corrected !== true) continue;
    const k = key(line.list_item_id);
    if (k !== null) origins.set(k, 'WARWICK');
  }
  for (const d of arr(input.decisions)) {
    if (!d || d.interpreted_by !== 'human') continue;
    const k = key(d.list_item_id);
    if (k !== null) origins.set(k, 'WARWICK');
  }

  // SKIPPED is a disposition and wins over everything: whatever put it on the
  // list, it is not being bought this week, and showing it under its origin
  // would overstate the basket.
  for (const item of arr(input.list_items)) {
    if (!item || SKIPPED_ITEM_STATUSES.indexOf(item.status) === -1) continue;
    const k = key(item.id);
    if (k !== null) origins.set(k, 'SKIPPED');
  }

  return origins;
}

/**
 * PURE. The whole AC4 answer.
 *
 * @param {object} input
 * @param {Array}  input.shop_lines    asdair.shop_line rows for this shop
 * @param {Array}  input.list_items    asdair.shopping_list_items rows
 * @param {Array}  input.decisions     asdair.shop_decision rows
 * @param {Array}  input.source_images asdair.shop_source_image rows
 * @param {object} input.status        the shopStatus projection
 */
function computeProvenance(input) {
  const i = input && typeof input === 'object' ? input : {};
  const items = arr(i.list_items);
  const lines = arr(i.shop_lines);
  const status = i.status && typeof i.status === 'object' ? i.status : {};

  const attributed = attributeItems(i);

  // NOT SUPPLIED IS NOT ZERO. A caller that never read asdair.shop_line at all
  // must not produce "0 from the photograph" - that is a claim the photograph
  // yielded nothing, which is a different statement from "nobody looked". An
  // EMPTY ARRAY is a real measured zero (a typed list has no photo lines);
  // `undefined` is an unasked question.
  const linesSupplied = Array.isArray(i.shop_lines);

  const counts = {
    PHOTO: linesSupplied ? 0 : null,
    REGULARS: null,
    RULE: null,
    WARWICK: linesSupplied ? 0 : null,
    SKIPPED: 0,
  };
  let unattributed = 0;

  for (const item of items) {
    const origin = attributed.get(key(item && item.id)) || null;
    if (origin === null) { unattributed += 1; continue; }
    if (counts[origin] === null) continue;
    if (origin === 'PHOTO' || origin === 'WARWICK' || origin === 'SKIPPED') counts[origin] += 1;
  }

  // REGULARS only where the run durably said so. `regulars_added` comes from
  // the supervised runner's own progress record, not from a tally taken here.
  const regularsReported = status.regulars_added;
  if (regularsReported !== null && regularsReported !== undefined && Number.isFinite(Number(regularsReported))) {
    counts.REGULARS = Number(regularsReported);
  }

  // THE NAMED GAPS. One per unknown, saying what is missing and what closes it.
  // These are what the UI renders instead of a number, and they are the reason
  // a zero is never invented.
  const gaps = [];
  if (!linesSupplied) {
    gaps.push('PHOTO / WARWICK: asdair.shop_line was not read for this shop, so what came from the ' +
      'photograph and what you decided cannot be counted. Reported as unknown rather than as zero.');
  }
  if (counts.REGULARS === null) {
    gaps.push('REGULARS: no durable count of items added from your Regulars exists for this shop. ' +
      'The run records one only once it has planned the basket.');
  }
  if (counts.RULE === null) {
    gaps.push('RULE: nothing durable records that a household rule put an item on this list. ' +
      'asdair.shop_line_provenance (migration 020) is the ledger that would, and it is not applied ' +
      'to this database yet.');
  }
  if (unattributed > 0) {
    gaps.push('UNATTRIBUTED: ' + unattributed + ' item(s) on the list are spoken for by no durable ' +
      'origin record. They are counted separately rather than being distributed across Regulars and ' +
      'household rules to make the total balance.');
  }

  // THE SOURCE. What arrived, and whether it was read.
  const sourceImages = arr(i.source_images);
  const sourceLines = lines.length > 0 ? lines.length : null;
  let sourceRead = null;
  if (sourceImages.length > 0) {
    sourceRead = lines.length > 0
      ? 'read - ' + lines.length + ' line(s) interpreted from the photograph'
      : 'received, not yet read';
  } else if (status.source_kind === 'text') {
    sourceRead = lines.length > 0 ? 'typed list, ' + lines.length + ' line(s) interpreted' : 'typed list';
  }

  const reconciled = items.filter((it) => it && RECONCILED_ITEM_STATUSES.indexOf(it.status) !== -1).length;
  const finalProducts = items.filter((it) => it && SKIPPED_ITEM_STATUSES.indexOf(it.status) === -1).length;
  const finalItems = items
    .filter((it) => it && SKIPPED_ITEM_STATUSES.indexOf(it.status) === -1)
    .reduce((n, it) => n + (Number.isFinite(Number(it.added_qty)) && Number(it.added_qty) > 0
      ? Number(it.added_qty)
      : (Number.isFinite(Number(it.requested_qty)) ? Number(it.requested_qty) : 1)), 0);

  // WARWICK'S EQUATION, assembled ONLY from terms that are actually known.
  // A missing term is never filled with a zero - the sentence simply is not
  // claimed, and the gap above says why.
  let summary = null;
  if (counts.PHOTO !== null && counts.REGULARS !== null && counts.SKIPPED !== null) {
    summary = counts.PHOTO + ' from the photograph + ' + counts.REGULARS + ' from Regulars - ' +
      counts.SKIPPED + ' skipped = ' + finalProducts + ' products / ' + finalItems + ' items';
  }

  return {
    counts: counts,
    unattributed: unattributed,
    gaps: gaps,
    source_lines: sourceLines,
    source_read_status: sourceRead,
    reconciled_products: reconciled,
    final_products: finalProducts,
    final_items: finalItems,
    summary: summary,
    // The per-item map, so the line view can label each row without a second
    // pass over the same evidence (AC7).
    item_origins: attributed,
  };
}

module.exports = {
  ORIGINS: ORIGINS,
  SKIPPED_ITEM_STATUSES: SKIPPED_ITEM_STATUSES,
  RECONCILED_ITEM_STATUSES: RECONCILED_ITEM_STATUSES,
  attributeItems: attributeItems,
  computeProvenance: computeProvenance,
};
