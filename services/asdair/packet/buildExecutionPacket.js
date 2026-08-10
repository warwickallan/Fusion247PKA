// =====================================================================
// BUILD-015 AsdAIr - packet/buildExecutionPacket.js   (WO-P / WO-2026-08-04-Z3)
//
// THE PRODUCER: resolved shop state -> one Sonnet Browser Execution Packet
// valid against the committed contract
//   Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json
//
// WHY THIS FILE EXISTS
//   On 2026-08-03 Warwick's basket was built from THREE PLAN FILES ASSEMBLED
//   BY HAND, over about eight hours, against his own ~5 minute benchmark.
//   The ruling is explicit: "No Claude session constructs this packet
//   manually." This module is the product doing it instead.
//
// PURE and DETERMINISTIC, in the same discipline as outcome/buildOutcome.js:
//   * No DB, no network, no fs, no Date.now(), no randomness.
//   * `generated_at` is REQUIRED FROM THE CALLER. This module has no clock
//     and never invents a timestamp.
//   * It never mutates its arguments; it returns a deeply frozen packet.
//   * Identical inputs always produce an identical packet.
//
// -------------------------------------------------------------------
// THE SORT IS THE PRODUCT REQUIREMENT, NOT A FORMATTING CHOICE
// -------------------------------------------------------------------
//   (1) normalized brand A-Z, NULL/blank brand LAST
//   (2) then normalized canonical product name A-Z
//   (3) then input order, so the result is deterministic without relying
//       on the engine's sort being stable
//
// This is the order Sonnet uses in ASDA after setting the store's own
// "Brand A-Z" ordering. THE ORDERING IS THE ENTIRE SPEED ARGUMENT
// (RUNTIME-DECISION.md; CANONICAL-WEEKLY-SHOP-PROCESS.md section E), which
// is why it is computed here once, emitted with `normalized_brand` and
// declared with `sort_contract` so a consumer can ASSERT the order rather
// than trust it.
//
// Comparison is by CODE UNIT (`<` / `>`), never String.prototype.localeCompare:
// locale collation varies by platform and ICU version, so localeCompare would
// make the packet's order irreproducible across machines. That defeats the
// point of emitting a sort contract at all.
//
// -------------------------------------------------------------------
// WHY THE PRODUCER REJECTS THINGS THE SCHEMA ACCEPTS
// -------------------------------------------------------------------
// JSON Schema `required` asserts PRESENCE ONLY, and the contract types
// canonical_product_id / asda_product_ref / approved_search_term as nullable.
// So this is SCHEMA-VALID today:
//     { origin: "known", canonical_product_id: null }
// which is exactly the failure the rule exists to prevent - a known item
// with no IDENTITY. Schema validation ALONE therefore does not prove the
// requirement.
//
// -------------------------------------------------------------------
// KNOWN DIVERGENCE FROM THE COMMITTED SCHEMA (2026-08-09) - READ THIS
// -------------------------------------------------------------------
// Warwick's Product Ruling 2 made `asda_product_ref` OPTIONAL for a known
// line, and permits source_view "search" for a known line that has no
// usable reference. This producer implements that ruling.
//
// The committed contract still encodes the OLD rule. In
// Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json, the
// `$defs.line.allOf[0]` branch for origin "known" still says:
//     required: [asda_product_ref, canonical_product_id]
//     asda_product_ref: { type: "string", not: { const: null } }
//     source_view:      { enum: ["regulars", "favourites"] }
//
// So a packet that is CORRECT under the ruling is INVALID under the
// committed schema. That file sits under Builds/**, which the implementer
// of this change may not write, so the divergence is REPORTED here rather
// than silently worked around, and it is pinned by a test in
// buildExecutionPacket.test.js so it cannot be forgotten. Larry owns the
// schema. When he corrects it, that test tells you.
//
// Schema validation is TEST-ONLY in this service - this module does not
// import schemaAssert - so the divergence does not block the runtime path.
//
// This module rejects it REGARDLESS of what the schema does. Belt and
// braces: the producer is the control that must hold even if the contract
// is loosened again later.
//
// PURE ASCII throughout.
// =====================================================================

/** Thrown for every rejection. Named so a caller can distinguish a bad
 *  input from a genuine crash. */
export class PacketError extends Error {
  constructor(message) {
    super('buildExecutionPacket: ' + message);
    this.name = 'PacketError';
  }
}

function fail(message) {
  throw new PacketError(message);
}

// The contract's own vocabularies, restated here as the producer's guard.
// They are asserted against the COMMITTED SCHEMA FILE in the tests, so a
// drift between this list and the contract fails the suite rather than
// silently emitting an out-of-vocabulary value.
export const SORT_CONTRACT = 'brand_az_then_product_az';
export const PACKET_VERSION = 1;
export const ORIGINS = Object.freeze(['known', 'new_approved']);
export const SOURCE_VIEWS = Object.freeze(['regulars', 'favourites', 'search']);
export const HELD_REASONS = Object.freeze([
  'ambiguous',
  'awaiting_decision',
  'excluded_by_rule',
  'not_stocked',
  'out_of_stock',
  'possible_duplicate'
]);

// Deliberately absent from HELD_REASONS, and it must stay absent:
// substitution is NEVER a permitted outcome anywhere in this product.
// sortAndCount aside, this is the single most important invariant here and
// it is pinned to the committed schema by buildExecutionPacket.test.js.
export const FORBIDDEN_HELD_REASON = 'substituted';

// The optional `-M<message id>` suffix (WP-B15-07) identifies a shop that had to
// start fresh because a terminal shop already owned the date. Refusing it would
// mean a fresh shop could never be shopped, which is the lost-list defect moved
// one step downstream rather than fixed.
const SHOP_REF_PATTERN = /^SHOP-[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-M[0-9]+)?$/;
const ASDA_PRODUCT_REF_PATTERN = /^[0-9]{3,12}$/;

// The exact keys a caller may put on an input line. Anything else is a
// typo or a stale field name, and a silently-ignored typo on
// `approved_search_term` would produce a packet that is wrong in the one
// way nobody would notice.
const INPUT_LINE_KEYS = new Set([
  'shop_line_no', 'original_list_line', 'origin',
  'canonical_product_id', 'canonical_product_name', 'brand',
  'source_view', 'asda_product_ref', 'asda_url',
  'required_quantity', 'approved_search_term',
  'substitutes_allowed', 'applied_rules', 'quantity_rationale',
  'hold'
]);

const INPUT_HOLD_KEYS = new Set(['reason', 'detail', 'rule_id']);

// ---------------------------------------------------------------------
// Normalization -- explicit, deterministic and locale-independent.
// ---------------------------------------------------------------------

/**
 * The sort key for a brand or a product name.
 *
 * NFKC -> trim -> lowercase -> every non-letter/non-digit run collapses to
 * a single space -> trim. Returns null for a value that is absent, or that
 * normalizes away to nothing (e.g. a brand of "---").
 *
 * Exported because `line.normalized_brand` lets a consumer reproduce the
 * PRIMARY key from the packet, but the contract declares no field for the
 * product-name key and `line` is additionalProperties:false, so the
 * SECONDARY key cannot be emitted. A consumer asserting `sort_contract`
 * fully must call this function. Stated plainly rather than letting
 * `sort_contract` imply more than the packet actually carries.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeSortKey(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).normalize('NFKC').trim().toLowerCase();
  if (s === '') return null;
  const cleaned = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

// Code-unit comparison. NOT localeCompare -- see the header.
function compareCodeUnits(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ---------------------------------------------------------------------
// Small validators
// ---------------------------------------------------------------------

function requireText(value, name) {
  if (value === null || value === undefined) fail(name + ' is required');
  if (typeof value !== 'string') fail(name + ' must be a string (got ' + typeof value + ')');
  const s = value.trim();
  if (s === '') fail(name + ' must be a non-empty string');
  return s;
}

function optionalText(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail(name + ' must be a string or null (got ' + typeof value + ')');
  const s = value.trim();
  return s === '' ? null : s;
}

function requirePositiveInt(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(name + ' must be a positive integer (got ' + JSON.stringify(value) + ')');
  }
  return value;
}

function optionalPositiveInt(value, name) {
  if (value === null || value === undefined) return null;
  return requirePositiveInt(value, name);
}

// A caller's timestamp, normalised to a UTC ISO-8601 string so it always
// satisfies `format: date-time`. This module has NO clock: an absent value
// is an error, never "now".
function requireGeneratedAt(value) {
  if (value === null || value === undefined || value === '') {
    fail('generated_at is required. This module has no clock and never invents a timestamp - pass the caller\'s time.');
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail('generated_at is an invalid Date');
    return value.toISOString();
  }
  if (typeof value !== 'string') fail('generated_at must be a Date or an ISO date-time string');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('generated_at "' + value + '" is not a parseable date-time');
  return new Date(parsed).toISOString();
}

// ---------------------------------------------------------------------
// Held lines
// ---------------------------------------------------------------------
function buildHeldEntry(raw, hold, where) {
  const reason = hold.reason;
  if (typeof reason !== 'string' || HELD_REASONS.indexOf(reason) === -1) {
    fail(where + '.hold.reason ' + JSON.stringify(reason) + ' is not one of: ' + HELD_REASONS.join(', ') +
         '. Note "' + FORBIDDEN_HELD_REASON + '" is deliberately not a member - substitution is never a permitted outcome.');
  }
  // Two shapes reach here: a line carrying `hold: {...}` (hold !== raw), and
  // a standalone entry in the top-level `held[]` argument, where the hold
  // fields sit on the entry itself alongside its identity (hold === raw).
  const allowedKeys = hold === raw
    ? new Set([...INPUT_HOLD_KEYS, 'shop_line_no', 'original_list_line'])
    : INPUT_HOLD_KEYS;
  const label = hold === raw ? where : where + '.hold';
  for (const key of Object.keys(hold)) {
    if (!allowedKeys.has(key)) {
      fail(label + ' has unknown key "' + key + '" (allowed: ' + Array.from(allowedKeys).join(', ') + ')');
    }
  }

  const entry = {};
  // shop_line_no is `{type: integer, minimum: 1}` in the contract with NO
  // null permitted, so it is OMITTED when unknown rather than emitted null.
  const shopLineNo = optionalPositiveInt(raw.shop_line_no, where + '.shop_line_no');
  if (shopLineNo !== null) entry.shop_line_no = shopLineNo;
  entry.original_list_line = requireText(raw.original_list_line, where + '.original_list_line');
  entry.reason = reason;
  entry.detail = optionalText(hold.detail, where + '.hold.detail');
  entry.rule_id = optionalPositiveInt(hold.rule_id, where + '.hold.rule_id');
  return entry;
}

// ---------------------------------------------------------------------
// Basket lines
// ---------------------------------------------------------------------
function buildLine(raw, where) {
  const origin = raw.origin;
  if (typeof origin !== 'string' || ORIGINS.indexOf(origin) === -1) {
    fail(where + '.origin ' + JSON.stringify(origin) + ' is not one of: ' + ORIGINS.join(', '));
  }

  const sourceView = raw.source_view;
  if (typeof sourceView !== 'string' || SOURCE_VIEWS.indexOf(sourceView) === -1) {
    fail(where + '.source_view ' + JSON.stringify(sourceView) + ' is not one of: ' + SOURCE_VIEWS.join(', ') +
         '. It is taken explicitly and never inferred: asdair.regulars.source is free text ' +
         '(values "regular", "decisions-log") and must NOT be silently mapped onto this vocabulary.');
  }

  const line = {};
  const shopLineNo = optionalPositiveInt(raw.shop_line_no, where + '.shop_line_no');
  if (shopLineNo !== null) line.shop_line_no = shopLineNo;

  line.original_list_line = requireText(raw.original_list_line, where + '.original_list_line');
  line.canonical_product_name = requireText(raw.canonical_product_name, where + '.canonical_product_name');

  const brand = optionalText(raw.brand, where + '.brand');
  line.brand = brand;
  line.normalized_brand = normalizeSortKey(brand);

  line.source_view = sourceView;

  const quantity = raw.required_quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    fail(where + '.required_quantity must be an integer between 1 and 99 (got ' + JSON.stringify(quantity) + '). ' +
         'It is never invented here: a list line with no written quantity is resolved to 1 by the caller ' +
         'under the household\'s own standing rule, before it reaches this producer.');
  }
  line.required_quantity = quantity;
  line.origin = origin;

  // ---- the two conditional requirements, enforced ABOVE the schema ----
  if (origin === 'known') {
    // A known item must NEVER be free-searched, so it must carry identity.
    if (raw.canonical_product_id === null || raw.canonical_product_id === undefined) {
      fail(where + ' has origin "known" but canonical_product_id is ' + JSON.stringify(raw.canonical_product_id) +
           '. A known item MUST carry its catalogue identity. (The committed schema only requires the KEY to be ' +
           'present and permits null, so this rejection is the producer\'s, not the schema\'s.)');
    }
    line.canonical_product_id = requirePositiveInt(raw.canonical_product_id, where + '.canonical_product_id');

    // ---------------------------------------------------------------
    // WARWICK'S PRODUCT RULING 2, 2026-08-09. SUPERSEDES the rejection
    // that used to live here.
    // ---------------------------------------------------------------
    // This producer used to fail any known line whose asda_product_ref was
    // absent, on the reasoning that "without an ASDA product reference a known
    // item could only be found by free-searching it, which is forbidden".
    //
    // The ruling separates the two ideas that reasoning fused together:
    //
    //   "Known household identity and ASDA retrieval method are SEPARATE
    //    concerns... use its durable ASDA reference when available and valid;
    //    otherwise the supervised route MAY use bounded ASDA search/navigation
    //    using the canonical product identity, brand, variant and supplied
    //    catalogue evidence; the resulting ASDA product MUST be verified
    //    against the known household identity before addition; search is a
    //    RETRIEVAL method - it does NOT redefine the household item as new."
    //
    // The old rule failed the ENTIRE weekly shop over one missing reference,
    // against a catalogue where a large minority of known products have none.
    // Identity (canonical_product_id, asserted above) is still mandatory. The
    // REFERENCE is now optional, and its absence routes the line to verified
    // retrieval downstream - see `retrieval` in services/asdair/handoff.
    //
    // A reference that is PRESENT must still be valid: "when available and
    // valid" is the ruling's own wording, and a malformed reference is an
    // upstream defect rather than a missing one. It is refused rather than
    // quietly downgraded to "search for it instead", which would hide the bug.
    let ref = null;
    if (raw.asda_product_ref !== null && raw.asda_product_ref !== undefined) {
      ref = requireText(raw.asda_product_ref, where + '.asda_product_ref');
      if (!ASDA_PRODUCT_REF_PATTERN.test(ref)) {
        fail(where + '.asda_product_ref "' + ref + '" must be 3-12 digits');
      }
    }
    line.asda_product_ref = ref;

    // Search is now permitted for a known item ONLY where we hold no usable
    // reference. Where we DO hold one, sending the line to a free search would
    // throw away identity we already have, so that stays refused.
    if (sourceView === 'search' && ref !== null) {
      fail(where + ' has origin "known" with source_view "search" while already carrying a valid ' +
           'asda_product_ref. Use the reference: it is added through Regulars or Favourites. Search is ' +
           'permitted for a known item ONLY when no usable reference exists.');
    }
    line.approved_search_term = optionalText(raw.approved_search_term, where + '.approved_search_term');
  } else {
    // new_approved: Warwick's approved wording, never invented.
    if (raw.approved_search_term === null || raw.approved_search_term === undefined) {
      fail(where + ' has origin "new_approved" but approved_search_term is ' +
           JSON.stringify(raw.approved_search_term) +
           '. The search wording is Warwick\'s approval and is NEVER invented by the model or by this producer. ' +
           '(Schema-valid today; rejected here regardless.)');
    }
    line.approved_search_term = requireText(raw.approved_search_term, where + '.approved_search_term');
    // canonical_product_id is a required KEY in the contract; null is the
    // contract's own meaning of "no regulars row yet".
    line.canonical_product_id = optionalPositiveInt(raw.canonical_product_id, where + '.canonical_product_id');
    const ref = optionalText(raw.asda_product_ref, where + '.asda_product_ref');
    if (ref !== null && !ASDA_PRODUCT_REF_PATTERN.test(ref)) {
      fail(where + '.asda_product_ref "' + ref + '" must be 3-12 digits when given');
    }
    line.asda_product_ref = ref;
  }

  line.asda_url = optionalText(raw.asda_url, where + '.asda_url');

  if (raw.substitutes_allowed === null || raw.substitutes_allowed === undefined) {
    line.substitutes_allowed = false;
  } else if (typeof raw.substitutes_allowed !== 'boolean') {
    fail(where + '.substitutes_allowed must be a boolean when given');
  } else {
    line.substitutes_allowed = raw.substitutes_allowed;
  }

  if (raw.applied_rules === null || raw.applied_rules === undefined) {
    line.applied_rules = [];
  } else if (!Array.isArray(raw.applied_rules)) {
    fail(where + '.applied_rules must be an array of rule ids when given');
  } else {
    line.applied_rules = raw.applied_rules.map((id, i) => requirePositiveInt(id, where + '.applied_rules[' + i + ']'));
  }

  line.quantity_rationale = optionalText(raw.quantity_rationale, where + '.quantity_rationale');

  return line;
}

// The identity a BASKET shows at reconciliation. Two list lines that
// resolve to the same product are ONE product in the trolley, so
// expected_distinct_products counts identities, not lines - otherwise the
// reconciliation reports a false mismatch the moment a list says the same
// thing twice. Precedence is explicit so it is reproducible.
function identityKey(line) {
  if (line.canonical_product_id !== null && line.canonical_product_id !== undefined) {
    return 'id:' + line.canonical_product_id;
  }
  if (line.asda_product_ref !== null && line.asda_product_ref !== undefined) {
    return 'ref:' + line.asda_product_ref;
  }
  return 'term:' + (normalizeSortKey(line.approved_search_term) || '');
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

// ---------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------
/**
 * Build a Sonnet Browser Execution Packet from resolved shop state.
 *
 * @param {object} input
 * @param {string} input.shop_ref            e.g. "SHOP-2026-08-03"
 * @param {string|Date} input.generated_at   REQUIRED - this module has no clock
 * @param {number} [input.household_id]
 * @param {Array<object>} input.lines        UNSORTED resolved lines; a line carrying
 *                                           `hold: { reason, detail?, rule_id? }` is
 *                                           routed to `packet.held` instead
 * @param {Array<object>} [input.held]       additional held entries not present in `lines`
 * @returns {object} a deeply frozen packet, lines pre-sorted with `seq` assigned
 * @throws {PacketError}
 */
export function buildExecutionPacket(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('input must be an object');
  }

  const shopRef = requireText(input.shop_ref, 'shop_ref');
  if (!SHOP_REF_PATTERN.test(shopRef)) {
    fail('shop_ref "' + shopRef + '" must match SHOP-YYYY-MM-DD');
  }
  const generatedAt = requireGeneratedAt(input.generated_at);
  const householdId = optionalPositiveInt(input.household_id, 'household_id');

  if (!Array.isArray(input.lines)) {
    fail('lines must be an array of resolved shop lines');
  }
  if (input.held !== null && input.held !== undefined && !Array.isArray(input.held)) {
    fail('held must be an array when given');
  }

  const basket = [];
  const held = [];

  input.lines.forEach((raw, i) => {
    const where = 'lines[' + i + ']';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(where + ' must be an object');
    for (const key of Object.keys(raw)) {
      if (!INPUT_LINE_KEYS.has(key)) {
        fail(where + ' has unknown key "' + key + '". Allowed: ' + Array.from(INPUT_LINE_KEYS).sort().join(', ') +
             '. Rejected rather than ignored, because a silently-dropped typo produces a packet that is wrong ' +
             'in the one way nobody notices.');
      }
    }

    if (raw.hold !== null && raw.hold !== undefined) {
      if (typeof raw.hold !== 'object' || Array.isArray(raw.hold)) {
        fail(where + '.hold must be an object { reason, detail?, rule_id? } when given');
      }
      held.push(buildHeldEntry(raw, raw.hold, where));
      return;
    }
    basket.push({ line: buildLine(raw, where), index: i });
  });

  (Array.isArray(input.held) ? input.held : []).forEach((raw, i) => {
    const where = 'held[' + i + ']';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(where + ' must be an object');
    for (const key of Object.keys(raw)) {
      if (key !== 'shop_line_no' && key !== 'original_list_line' && !INPUT_HOLD_KEYS.has(key)) {
        fail(where + ' has unknown key "' + key + '"');
      }
    }
    held.push(buildHeldEntry(raw, raw, where));
  });

  // Nothing is silently dropped: an all-held shop has NO schema-valid packet
  // (the contract sets lines.minItems = 1), so this stops loudly and names
  // the held count rather than emitting an empty or invalid handoff.
  if (basket.length === 0) {
    fail('refusing to emit a packet with zero basket lines (' + held.length + ' line(s) held). ' +
         'The contract requires at least one line (lines.minItems = 1). An empty or invalid packet ' +
         'reaching the Sonnet handoff is worse than a hard stop.');
  }

  // ---- THE SORT ------------------------------------------------------
  // (1) normalized brand A-Z with NULL/blank LAST, via an explicit rank
  //     rather than a sentinel string that a real brand could collide with;
  // (2) normalized canonical product name A-Z;
  // (3) input index, so the order is deterministic regardless of whether
  //     the engine's sort is stable.
  const decorated = basket.map(({ line, index }) => ({
    line,
    index,
    brandRank: line.normalized_brand === null ? 1 : 0,
    brandKey: line.normalized_brand === null ? '' : line.normalized_brand,
    nameKey: normalizeSortKey(line.canonical_product_name) || ''
  }));

  decorated.sort((a, b) => {
    if (a.brandRank !== b.brandRank) return a.brandRank - b.brandRank;
    const byBrand = compareCodeUnits(a.brandKey, b.brandKey);
    if (byBrand !== 0) return byBrand;
    const byName = compareCodeUnits(a.nameKey, b.nameKey);
    if (byName !== 0) return byName;
    return a.index - b.index;
  });

  const lines = decorated.map((entry, i) => {
    // seq is assigned AFTER sorting: it is the position in the Brand A-Z
    // order Sonnet works through, not the order of the shopping list.
    const ordered = { seq: i + 1 };
    Object.keys(entry.line).forEach((key) => { ordered[key] = entry.line[key]; });
    return ordered;
  });

  // ---- reconciliation inputs, computed FROM THE LINES ------------------
  const distinct = new Set();
  let totalUnits = 0;
  lines.forEach((line) => {
    distinct.add(identityKey(line));
    totalUnits += line.required_quantity;
  });

  const packet = {
    packet_version: PACKET_VERSION,
    shop_ref: shopRef,
    generated_at: generatedAt
  };
  // household_id is `{type: integer, minimum: 1}` with no null permitted,
  // so it is omitted rather than emitted null when unknown.
  if (householdId !== null) packet.household_id = householdId;
  packet.sort_contract = SORT_CONTRACT;
  packet.expected_distinct_products = distinct.size;
  packet.expected_total_units = totalUnits;
  packet.lines = lines;
  // Always emitted, even empty: "nothing is silently dropped" is better
  // served by a visible empty list than by an absent key.
  packet.held = held;

  return deepFreeze(packet);
}

export default buildExecutionPacket;
