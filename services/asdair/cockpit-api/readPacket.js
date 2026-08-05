// =====================================================================
// AsdAIr cockpit-api/readPacket.js - THE SONNET EXECUTION PACKET AND THE
// BASKET RECONCILIATION, READ-ONLY.
//
// WHY THIS EXISTS. readWorkspace.js answers "what is happening to this shop".
// readRules.js answers "what has this thing learned". This answers a third
// question: "what exactly is Sonnet being asked to put in the basket, WHY is
// each quantity what it is, and afterwards - did the basket match?"
//
// CONTRACT. The shape is published in
//   Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md
// and the packet document itself is canonically
//   Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json
// This module restates NEITHER. It reads what the producers write.
//
// THE PRODUCERS DO NOT EXIST YET (WO-P, WO-S - Keel). That is the normal case
// today, and it is handled as a FIRST-CLASS state rather than an error:
//   * table absent      -> not_produced   (the tables land with WO-P/WO-S)
//   * no row            -> not_produced
//   * row present       -> the document, presented
// A missing table is NOT reported as a read failure. It means the feature has
// not shipped, and telling Warwick "the reader is broken" when the answer is
// "this has not been built yet" is a different and worse lie.
//
// NULL versus EMPTY IS LOAD-BEARING. null = the producer has not run. An object
// with lines: [] = it ran and found nothing. The cockpit renders these
// differently, so this module must never collapse one into the other.
//
// SAME CONSTRUCTION RULES AS ITS TWO SIBLINGS, deliberately:
//   * connection from ASDAIR_DB_URL, the SELECT-only asdair_ro role;
//   * everything inside ONE `BEGIN TRANSACTION READ ONLY`, so the packet and
//     the reconciliation of the same shop are one consistent snapshot;
//   * every statement begins with SELECT, and ALL_SQL is exported so that is
//     TESTABLE rather than merely asserted in this comment.
//
// SORT ORDER IS THE PRODUCER'S. Lines arrive pre-sorted Brand A-Z then product
// A-Z, because that is the order Sonnet works in ASDA and the ordering IS the
// speed. This module does NOT re-sort. It ASSERTS the declared sort_contract
// and reports a mismatch, because a consumer that silently re-sorts hides a
// producer bug, and one that silently trusts propagates it.
//
// PURE ASCII.
// =====================================================================

'use strict';

const P = require('./present');
const MISSING = P._internal.isMissing;

// ---------------------------------------------------------------------
// SQL. All SELECT. All parameterised.
// ---------------------------------------------------------------------

// to_regclass returns NULL rather than raising when a table does not exist,
// which is what lets "not built yet" be answered without a failed transaction.
// Asking the catalogue is cheaper and far clearer than catching error 42P01,
// and - unlike a caught error - it cannot be confused with a real read failure.
const TABLES_SQL =
  "SELECT to_regclass('asdair.execution_packet') IS NOT NULL AS has_packet, " +
  "to_regclass('asdair.basket_reconciliation') IS NOT NULL AS has_reconciliation";

// Latest by generated_at, so a re-generated packet supersedes rather than
// duplicates. LIMIT 1 because the surface shows one shop's packet.
const PACKET_SQL =
  'SELECT shop_id, packet_version, generated_at, payload ' +
  'FROM asdair.execution_packet WHERE shop_id = $1 ' +
  'ORDER BY generated_at DESC LIMIT 1';

const RECONCILIATION_SQL =
  'SELECT shop_id, reconciled_at, payload ' +
  'FROM asdair.basket_reconciliation WHERE shop_id = $1 ' +
  'ORDER BY reconciled_at DESC LIMIT 1';

const ALL_SQL = Object.freeze([TABLES_SQL, PACKET_SQL, RECONCILIATION_SQL]);

// ---------------------------------------------------------------------
// Presentation. Server-side, so the browser has nothing left to fabricate.
// ---------------------------------------------------------------------

const SOURCE_VIEW_MEANING = Object.freeze({
  regulars: 'from your Regulars list',
  favourites: 'from your Favourites',
  search: 'searched for - this item is new'
});

const HELD_REASON_MEANING = Object.freeze({
  ambiguous: 'the reading was ambiguous',
  awaiting_decision: 'waiting on an answer from you',
  excluded_by_rule: 'excluded by a standing rule',
  not_stocked: 'ASDA does not stock it',
  out_of_stock: 'out of stock',
  possible_duplicate: 'looks like a duplicate of another line'
});

const IDENTITY_MEANING = Object.freeze({
  exact: 'the right product',
  different_product: 'a DIFFERENT product',
  missing: 'not in the basket',
  unexpected: 'in the basket but not on the plan'
});

const QUANTITY_MEANING = Object.freeze({
  exact: 'the right quantity',
  short: 'fewer than planned',
  over: 'more than planned',
  unknown: 'quantity not established'
});

/** A tri-state flag where null genuinely means "nobody checked". */
function confirmation(value) {
  if (value === true) return { value: true, display: 'yes' };
  if (value === false) return { value: false, display: 'no' };
  // Never renders as a reassuring "no". Not checked is not the same as not done.
  return { value: null, display: 'not confirmed' };
}

function presentLine(line, index) {
  const l = line || {};
  const origin = P.text(l.origin);
  const sourceView = P.text(l.source_view);
  const rules = Array.isArray(l.applied_rules) ? l.applied_rules : [];
  return {
    seq_display: P.count(l.seq === undefined || l.seq === null ? index + 1 : l.seq),
    shop_line_no_display: P.count(l.shop_line_no),
    original_list_line_display: P.text(l.original_list_line),
    canonical_product_id_display: P.count(l.canonical_product_id),
    canonical_product_name_display: P.text(l.canonical_product_name),
    brand_display: P.text(l.brand),
    // NULL brand sorts last by the packet's own contract. Surfaced as a real
    // fact so a whole run of unbranded lines at the end reads as intended
    // rather than as a sorting bug.
    has_brand: !MISSING(l.brand),
    source_view_display: sourceView,
    source_view_meaning: SOURCE_VIEW_MEANING[sourceView] || 'unknown',
    asda_product_ref_display: P.text(l.asda_product_ref),
    asda_url_display: P.text(l.asda_url),
    required_quantity_display: P.count(l.required_quantity),
    origin_display: origin,
    // The distinction the whole Details/packet surface turns on. A known item
    // must never be free-searched; a new one must carry Warwick's own wording.
    is_new: origin === 'new_approved',
    is_known: origin === 'known',
    approved_search_term_display: P.text(l.approved_search_term),
    substitutes_allowed_display: l.substitutes_allowed === true ? 'yes' : 'no',
    applied_rules: rules.map(function (r) { return String(r); }),
    applied_rules_count_display: P.count(rules.length),
    has_applied_rules: rules.length > 0,
    quantity_rationale_display: P.text(l.quantity_rationale),
    // Absence is SHOWN, not hidden: a quantity with no recorded reason is
    // exactly what Warwick needs to be able to see (defect D-2026-08-04-04).
    has_quantity_rationale: !MISSING(l.quantity_rationale),
    // The upstream contradiction the cockpit surfaces rather than resolves:
    // the schema requires a catalogue id for a 'known' line, so one without is
    // a producer defect and must be visible, not quietly rendered as fine.
    identity_incomplete: origin === 'known' && MISSING(l.canonical_product_id)
  };
}

function presentHeld(held) {
  const h = held || {};
  const reason = P.text(h.reason);
  return {
    shop_line_no_display: P.count(h.shop_line_no),
    original_list_line_display: P.text(h.original_list_line),
    reason_display: reason,
    reason_meaning: HELD_REASON_MEANING[reason] || 'unknown',
    detail_display: P.text(h.detail),
    rule_id_display: P.count(h.rule_id)
  };
}

/**
 * Is `lines` actually in the order sort_contract claims? Checked, not trusted -
 * the packet declares its own order specifically so a consumer can assert it.
 * Reported, never corrected: silently re-sorting would hide a producer bug.
 */
function checkSort(lines) {
  const key = function (l) {
    const b = l && l.normalized_brand !== undefined && l.normalized_brand !== null
      ? String(l.normalized_brand)
      : (l && l.brand !== null && l.brand !== undefined ? String(l.brand).trim().toLowerCase() : null);
    // NULL brand sorts LAST, per the schema.
    return { brand: b, name: String((l && l.canonical_product_name) || '').trim().toLowerCase() };
  };
  for (let i = 1; i < lines.length; i++) {
    const a = key(lines[i - 1]);
    const b = key(lines[i]);
    if (a.brand === null && b.brand !== null) return { ok: false, at: i + 1 };
    if (a.brand !== null && b.brand !== null) {
      if (a.brand > b.brand) return { ok: false, at: i + 1 };
      if (a.brand === b.brand && a.name > b.name) return { ok: false, at: i + 1 };
    } else if (a.brand === null && b.brand === null && a.name > b.name) {
      return { ok: false, at: i + 1 };
    }
  }
  return { ok: true, at: null };
}

function presentPacket(row) {
  const doc = (row && row.payload) || {};
  const rawLines = Array.isArray(doc.lines) ? doc.lines : [];
  const rawHeld = Array.isArray(doc.held) ? doc.held : [];
  const lines = rawLines.map(presentLine);
  const sort = checkSort(rawLines);
  const newCount = lines.filter(function (l) { return l.is_new; }).length;
  return {
    packet_version_display: P.count(doc.packet_version),
    shop_ref_display: P.text(doc.shop_ref),
    generated_at_display: P.when(doc.generated_at || (row && row.generated_at)),
    household_id_display: P.count(doc.household_id),
    sort_contract_display: P.text(doc.sort_contract),
    // The cockpit renders array order and does NOT re-sort. If this is false,
    // the producer's declared contract and its actual output disagree and the
    // UI says so - loudly, because Sonnet's speed depends on that order.
    sort_verified: sort.ok,
    sort_first_break_display: sort.ok ? 'unknown' : P.count(sort.at),
    expected_distinct_products_display: P.count(doc.expected_distinct_products),
    expected_total_units_display: P.count(doc.expected_total_units),
    lines: lines,
    lines_count_display: P.count(lines.length),
    new_items_count_display: P.count(newCount),
    known_items_count_display: P.count(lines.length - newCount),
    // Counted from the presented rows so it cannot disagree with what is shown.
    identity_incomplete_count_display: P.count(lines.filter(function (l) { return l.identity_incomplete; }).length),
    held: rawHeld.map(presentHeld),
    held_count_display: P.count(rawHeld.length)
  };
}

function presentReconciliationLine(line) {
  const l = line || {};
  const identity = P.text(l.identity_match);
  const quantity = P.text(l.quantity_match);
  return {
    seq_display: P.count(l.seq),
    canonical_product_id_display: P.count(l.canonical_product_id),
    canonical_product_name_display: P.text(l.canonical_product_name),
    brand_display: P.text(l.brand),
    expected_quantity_display: P.count(l.expected_quantity),
    actual_quantity_display: P.count(l.actual_quantity),
    identity_match_display: identity,
    identity_meaning: IDENTITY_MEANING[identity] || 'unknown',
    quantity_match_display: quantity,
    quantity_meaning: QUANTITY_MEANING[quantity] || 'unknown',
    expected_product_ref_display: P.text(l.expected_product_ref),
    actual_product_ref_display: P.text(l.actual_product_ref),
    detail_display: P.text(l.detail),
    // One flag the row can be styled from, so "matched" never has to be
    // inferred in the template from two separate strings.
    is_match: identity === 'exact' && quantity === 'exact'
  };
}

function presentReconciliation(row) {
  const doc = (row && row.payload) || {};
  const lines = (Array.isArray(doc.lines) ? doc.lines : []).map(presentReconciliationLine);
  const unavailable = Array.isArray(doc.unavailable) ? doc.unavailable : [];
  const unexpected = Array.isArray(doc.unexpected) ? doc.unexpected : [];
  const distinctMatch = !MISSING(doc.expected_distinct_products)
    && !MISSING(doc.actual_distinct_products)
    && Number(doc.expected_distinct_products) === Number(doc.actual_distinct_products);
  const unitsMatch = !MISSING(doc.expected_total_units)
    && !MISSING(doc.actual_total_units)
    && Number(doc.expected_total_units) === Number(doc.actual_total_units);
  const mismatchedLines = lines.filter(function (l) { return !l.is_match; }).length;
  return {
    reconciliation_version_display: P.count(doc.reconciliation_version),
    shop_ref_display: P.text(doc.shop_ref),
    reconciled_at_display: P.when(doc.reconciled_at || (row && row.reconciled_at)),
    expected_distinct_products_display: P.count(doc.expected_distinct_products),
    actual_distinct_products_display: P.count(doc.actual_distinct_products),
    expected_total_units_display: P.count(doc.expected_total_units),
    actual_total_units_display: P.count(doc.actual_total_units),
    distinct_products_match: distinctMatch,
    total_units_match: unitsMatch,
    lines: lines,
    lines_count_display: P.count(lines.length),
    mismatched_lines_count_display: P.count(mismatchedLines),
    // RULING SECTION 3, ENCODED: a matching headline count is NOT sufficient
    // proof if the wrong product or quantity is present. So "everything agrees"
    // requires both headline counts AND every per-line identity and quantity.
    // Computing this here rather than in the template means the rule is in
    // tested code, and the browser cannot reach a friendlier conclusion.
    fully_reconciled: distinctMatch && unitsMatch && mismatchedLines === 0 && lines.length > 0,
    counts_agree_but_lines_do_not: distinctMatch && unitsMatch && mismatchedLines > 0,
    unavailable: unavailable.map(function (u) {
      const reason = P.text(u && u.reason);
      return {
        original_list_line_display: P.text(u && u.original_list_line),
        canonical_product_name_display: P.text(u && u.canonical_product_name),
        reason_display: reason,
        reason_meaning: HELD_REASON_MEANING[reason] || 'unknown',
        detail_display: P.text(u && u.detail)
      };
    }),
    unavailable_count_display: P.count(unavailable.length),
    unexpected: unexpected.map(function (u) {
      return {
        canonical_product_name_display: P.text(u && u.canonical_product_name),
        actual_product_ref_display: P.text(u && u.actual_product_ref),
        actual_quantity_display: P.count(u && u.actual_quantity),
        detail_display: P.text(u && u.detail)
      };
    }),
    unexpected_count_display: P.count(unexpected.length),
    checkout_performed: confirmation(doc.checkout_performed),
    payment_performed: confirmation(doc.payment_performed),
    slot_booked: confirmation(doc.slot_booked),
    // True only when all three are an explicit false. A null anywhere means
    // nobody confirmed it, and that must never read as "safe".
    no_purchase_action_confirmed: doc.checkout_performed === false
      && doc.payment_performed === false
      && doc.slot_booked === false
  };
}

// ---------------------------------------------------------------------
// The read.
// ---------------------------------------------------------------------

let getPool = null;

async function gather(client, shopId) {
  const tables = await client.query(TABLES_SQL);
  const t = (tables && tables.rows && tables.rows[0]) || {};
  const out = {
    packet: null,
    reconciliation: null,
    packet_state: t.has_packet ? 'not_produced' : 'not_built',
    reconciliation_state: t.has_reconciliation ? 'not_produced' : 'not_built'
  };
  if (t.has_packet) {
    const r = await client.query(PACKET_SQL, [shopId]);
    const row = r && r.rows && r.rows[0];
    if (row) { out.packet = presentPacket(row); out.packet_state = 'produced'; }
  }
  if (t.has_reconciliation) {
    const r = await client.query(RECONCILIATION_SQL, [shopId]);
    const row = r && r.rows && r.rows[0];
    if (row) { out.reconciliation = presentReconciliation(row); out.reconciliation_state = 'produced'; }
  }
  return out;
}

/**
 * @param {{shop?: string|number, shop_ref?: string, client?: object}} [options]
 */
async function readPacket(options) {
  const opts = options || {};
  const shopId = opts.shop === undefined || opts.shop === null ? null : opts.shop;
  if (shopId === null || String(shopId).trim() === '') {
    return { ok: false, error: 'no_shop', message: 'A shop must be named to read its packet.' };
  }
  const injected = opts.client || null;
  let client = injected;
  let pool = null;
  if (!client) {
    // Same lazy handle as readWorkspace: the driver and the env var are only
    // required when a real read happens, so the tests never need either.
    if (!getPool) getPool = require('./readWorkspace')._internal.getPool;
    pool = getPool();
    client = await pool.connect();
  }
  try {
    // An injected client is used AS-IS - the caller owns its transaction. Same
    // rule as readWorkspace, so a test client never sees a nested BEGIN.
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    const body = await gather(client, shopId);
    if (!injected) await client.query('COMMIT');
    return Object.assign({
      ok: true,
      generated_from: 'durable state only',
      unknown_means_unknown: true,
      shop_id_display: P.text(shopId)
    }, body);
  } catch (err) {
    if (!injected) { try { await client.query('ROLLBACK'); } catch (ignore) { /* the read is over */ } }
    throw err;
  } finally {
    if (!injected && client && client.release) client.release();
  }
}

module.exports = {
  readPacket: readPacket,
  ALL_SQL: ALL_SQL,
  _internal: {
    presentPacket: presentPacket,
    presentReconciliation: presentReconciliation,
    presentLine: presentLine,
    checkSort: checkSort,
    confirmation: confirmation,
    gather: gather,
    TABLES_SQL: TABLES_SQL,
    PACKET_SQL: PACKET_SQL,
    RECONCILIATION_SQL: RECONCILIATION_SQL
  }
};
