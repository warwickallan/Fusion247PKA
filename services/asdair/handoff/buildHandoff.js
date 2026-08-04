// =====================================================================
// BUILD-015 AsdAIr - handoff/buildHandoff.js
//
// THE HANDOFF ARTEFACT. Packet in, artefact out. PURE.
//
// This is the smallest truthful supervised route that removes Larry entirely:
// Warwick opens Sonnet in Claude for Chrome, hands it this one artefact, and
// nobody explains, sorts, translates or reconstructs anything. There is no
// programmatic trigger here and none is claimed - see README.md.
//
// PURE and DETERMINISTIC, exactly like reconcile/reconcile.js and skill/planner.js:
//   * No DB, no network, no fs, no clock, no randomness.
//   * It never mutates its argument; every returned line is a NEW object.
//   * The SAME packet always produces a byte-identical artefact. That is what
//     makes the handoff idempotent, and it is why `generated_at` is copied from
//     the packet and never read from a clock.
//
// -------------------------------------------------------------------------
// IT ASSERTS THE SORT CONTRACT. IT DOES NOT TRUST IT.
// -------------------------------------------------------------------------
// The Work Order says the lines arrive already sorted Brand A-Z and that the
// sort_contract must be ASSERTED rather than trusted. There is a wrinkle the
// order did not know about: in the committed schema `sort_contract` is OPTIONAL
// (it is absent from `required`), so a perfectly valid packet can omit it and
// leave nothing to assert.
//
// So this file does something strictly stronger than asked. It verifies the
// ACTUAL ordering of the lines against the rule - normalized brand A-Z, NULL
// brand last, then canonical product name A-Z - on every packet, whether or not
// the declaration is present; and where the declaration IS present it must also
// carry the expected value. A mis-ordered packet is refused. The ordering is the
// speed of the whole shop, and a silently mis-sorted packet would cost Warwick
// the benefit while looking correct.
//
// It also RECOMPUTES the expected counts from the lines and refuses a packet
// whose declared counts disagree with its own content. Those counts are the
// reconciliation input; if they contradict the lines they were derived from,
// reconciliation would be measuring the basket against a number that was
// already wrong.
//
// PURE ASCII SOURCE ONLY. No dependencies.
// =====================================================================
'use strict';

const { fingerprintPacket } = require('./fingerprint');
const {
  INSTRUCTIONS_VERSION, BROWSER_METHOD, PROHIBITED_ACTIONS,
  COMPLETION_CONTRACT, RECONCILIATION_CONTRACT, LINE_REPORT_STATUSES, assertRuleRow,
} = require('./instructions');

const HANDOFF_VERSION = 1;
const SORT_CONTRACT = 'brand_az_then_product_az';
const SHOP_REF_RE = /^SHOP-[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ASDA_REF_RE = /^[0-9]{3,12}$/;
const SOURCE_VIEWS = ['regulars', 'favourites', 'search'];
const ORIGINS = ['known', 'new_approved'];

/**
 * Every refusal from this module is this one error type, carrying a stable
 * machine-readable `code` so a caller can branch without string-matching prose.
 */
class PacketContractError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'PacketContractError';
    this.code = code;
    this.detail = detail;
  }
}

const isInt = (v) => Number.isInteger(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * THE NORMALISATION. Mirrored EXACTLY from `normalizeSortKey` in
 * services/asdair/packet/buildExecutionPacket.js, which is the producer and
 * therefore the authority. The consumer follows the producer, never the reverse.
 *
 *   NFKC -> trim -> lowercase -> every non-letter/non-digit run collapses to a
 *   single space -> trim. null for absent, or for a value that normalizes away
 *   to nothing (a brand of "---").
 *
 * WHY IT IS COPIED AND NOT IMPORTED. Two reasons, and the second is decisive:
 * the mirror-don't-share shape was ruled deliberately (two zero-dependency
 * modules that do not reach across service folders), AND
 * buildExecutionPacket.js is an ES module while this module is CommonJS - a
 * `require` of it is not possible at all. Keeping the copy honest is therefore
 * a real obligation, closed by a cross-module test pinning both against one
 * fixture set. `normalizeSortKey` and `identityKey` are exported from here for
 * exactly that purpose.
 *
 * THIS IS NOT A HYPOTHETICAL. The first version of this file used a bare
 * `trim().toLowerCase()`. It disagreed with the producer on any value carrying
 * a hyphen, punctuation or doubled whitespace - "yazoo choc 2 pack" versus
 * "yazoo choc 2-pack" - and the consequence was NOT a wrong sort: it was a
 * valid packet being REFUSED and the weekly shop stopping.
 */
function normalizeSortKey(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).normalize('NFKC').trim().toLowerCase();
  if (s === '') return null;
  const cleaned = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * The BRAND sort key. The producer sorts on `line.normalized_brand` as stored
 * rather than re-deriving it, so that is what is read here; the derivation from
 * `brand` is only a fallback for a packet that omitted the optional field.
 * A null key sorts LAST, via an explicit rank rather than a sentinel string a
 * real brand could collide with.
 */
function brandKey(line) {
  if (typeof line.normalized_brand === 'string') return normalizeSortKey(line.normalized_brand);
  if (line.normalized_brand === null) return null;
  return normalizeSortKey(line.brand);
}

/** The SECONDARY key. The packet declares no field for it - see normalizeSortKey's note. */
function nameKey(line) {
  return normalizeSortKey(line.canonical_product_name) || '';
}

/**
 * THE IDENTITY A BASKET SHOWS, and it is NOT the same thing as a line.
 *
 * This mirrors `identityKey` in services/asdair/packet/buildExecutionPacket.js,
 * including its precedence, because that producer is the authority on what
 * `expected_distinct_products` counts. Its own note: two list lines that
 * resolve to the same product are ONE product in the trolley, so the count is
 * of identities, not lines - otherwise reconciliation reports a false mismatch
 * the moment the list says the same thing twice.
 *
 * An earlier version of this file asserted `expected_distinct_products ===
 * lines.length`. That was wrong against the producer and would have REFUSED a
 * valid packet at exactly the case the producer wrote its note about.
 *
 * If the two normalisations ever drift, the disagreement surfaces as a loud
 * EXPECTED_DISTINCT_MISMATCH refusal rather than a silently wrong count - which
 * is the safe direction for a number reconciliation is measured against.
 */
function identityKey(line) {
  if (line.canonical_product_id != null) return `id:${line.canonical_product_id}`;
  if (line.asda_product_ref != null) return `ref:${line.asda_product_ref}`;
  return `term:${normalizeSortKey(line.approved_search_term) || ''}`;
}

/**
 * Compare two adjacent lines under the declared contract.
 * Returns <0 when `a` correctly precedes `b`, 0 when equivalent, >0 when the
 * pair is out of order.
 *
 * Plain codepoint comparison, NOT localeCompare: the sort must be identical on
 * every machine and every locale, and localeCompare is not.
 */
function compareLines(a, b) {
  const ba = brandKey(a);
  const bb = brandKey(b);
  if (ba !== bb) {
    if (ba === null) return 1;       // NULL brand sorts last
    if (bb === null) return -1;
    return ba < bb ? -1 : 1;
  }
  const na = nameKey(a);
  const nb = nameKey(b);
  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}

function assertLine(line, idx) {
  const at = `lines[${idx}]`;
  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    throw new PacketContractError('LINE_NOT_OBJECT', `${at} is not an object`);
  }
  if (!isInt(line.seq) || line.seq < 1) {
    throw new PacketContractError('BAD_SEQ', `${at}.seq must be an integer >= 1`, { seq: line.seq });
  }
  if (!isNonEmptyString(line.original_list_line)) {
    throw new PacketContractError('MISSING_ORIGINAL_LINE', `${at}.original_list_line is required - the photographed wording is never lost`);
  }
  if (!isNonEmptyString(line.canonical_product_name)) {
    throw new PacketContractError('MISSING_CANONICAL_NAME', `${at}.canonical_product_name is required and comes from our rows, never model prose`);
  }
  if (!ORIGINS.includes(line.origin)) {
    throw new PacketContractError('BAD_ORIGIN', `${at}.origin must be one of ${ORIGINS.join('|')}`, { origin: line.origin });
  }
  if (!SOURCE_VIEWS.includes(line.source_view)) {
    throw new PacketContractError('BAD_SOURCE_VIEW', `${at}.source_view must be one of ${SOURCE_VIEWS.join('|')}`, { source_view: line.source_view });
  }
  if (!isInt(line.required_quantity) || line.required_quantity < 1 || line.required_quantity > 99) {
    throw new PacketContractError('BAD_QUANTITY', `${at}.required_quantity must be an integer 1..99 - a quantity is never invented`, { required_quantity: line.required_quantity });
  }

  // THE RULE THAT PROTECTS THE WHOLE METHOD: a known item must never be
  // free-searched, so `search` is only ever legal on an approved new item.
  if (line.source_view === 'search' && line.origin !== 'new_approved') {
    throw new PacketContractError(
      'KNOWN_ITEM_SENT_TO_SEARCH',
      `${at}: source_view 'search' is permitted ONLY when origin is new_approved. A known item must NEVER be free-searched.`,
      { seq: line.seq, origin: line.origin },
    );
  }

  if (line.origin === 'known') {
    if (line.canonical_product_id == null) {
      throw new PacketContractError('KNOWN_WITHOUT_ID', `${at}: origin 'known' requires canonical_product_id`, { seq: line.seq });
    }
    if (!isNonEmptyString(line.asda_product_ref) || !ASDA_REF_RE.test(line.asda_product_ref)) {
      throw new PacketContractError(
        'KNOWN_WITHOUT_ASDA_REF',
        `${at}: origin 'known' requires asda_product_ref, so the item is found rather than searched for`,
        { seq: line.seq, asda_product_ref: line.asda_product_ref == null ? null : '(present but malformed)' },
      );
    }
  }

  if (line.origin === 'new_approved' && !isNonEmptyString(line.approved_search_term)) {
    throw new PacketContractError(
      'NEW_WITHOUT_APPROVED_TERM',
      `${at}: origin 'new_approved' requires approved_search_term - Warwick's approved wording, NEVER invented`,
      { seq: line.seq },
    );
  }
}

function assertPacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new PacketContractError('PACKET_NOT_OBJECT', 'packet must be an object');
  }
  if (packet.packet_version !== 1) {
    throw new PacketContractError('BAD_PACKET_VERSION', 'packet_version must be 1', { packet_version: packet.packet_version });
  }
  if (!isNonEmptyString(packet.shop_ref) || !SHOP_REF_RE.test(packet.shop_ref)) {
    throw new PacketContractError('BAD_SHOP_REF', 'shop_ref must look like SHOP-YYYY-MM-DD - it scopes every write back to one shop', { shop_ref: packet.shop_ref });
  }
  if (!isNonEmptyString(packet.generated_at)) {
    throw new PacketContractError('MISSING_GENERATED_AT', 'generated_at is required');
  }
  if (!Array.isArray(packet.lines) || packet.lines.length < 1) {
    throw new PacketContractError('EMPTY_PACKET', 'lines must be a non-empty array - there is nothing to shop');
  }
  if (packet.held != null && !Array.isArray(packet.held)) {
    throw new PacketContractError('BAD_HELD', 'held, when present, must be an array');
  }

  // The declaration is optional in the schema. When it IS declared it must be
  // the value we know how to verify; an unknown contract is refused rather than
  // silently verified against the wrong rule.
  const declared = packet.sort_contract;
  if (declared != null && declared !== SORT_CONTRACT) {
    throw new PacketContractError('UNKNOWN_SORT_CONTRACT', `sort_contract declares '${declared}', which this consumer cannot verify. Expected '${SORT_CONTRACT}'.`, { sort_contract: declared });
  }

  packet.lines.forEach(assertLine);

  // seq must be exactly 1..N in order. Sonnet works these positionally, so a
  // gap or a repeat would silently desynchronise the report from the packet.
  const seqs = packet.lines.map((l) => l.seq);
  for (let i = 0; i < seqs.length; i += 1) {
    if (seqs[i] !== i + 1) {
      throw new PacketContractError('BAD_SEQ_SEQUENCE', `lines[${i}].seq is ${seqs[i]}; seq must run 1..N with no gaps and no repeats`, { expected: i + 1, actual: seqs[i] });
    }
  }

  // DUPLICATE IDENTITIES ARE A PRODUCER DEFECT, NOT A NORMAL CASE.
  //
  // The household rulebook settles this and it is not a builder's call:
  // asdair.rules id 3 - "Duplicate entries for the same item are deduped to a
  // single line." One product, one line. Dedupe therefore belongs at PLANNING,
  // before the packet is built, and a duplicate reaching a packet means that
  // step did not happen.
  //
  // It is still not refused here - refusing would strand the whole weekly shop
  // over an upstream bug - but it is now a DETECTOR: reported loudly on the
  // artefact and at the top of the checklist, and never something Sonnet is
  // expected to resolve. Choosing one-combined versus two-separate at the shelf
  // is not a decision the person shopping should be made to take.
  //
  // The one case rule 3 does NOT settle is two entries for one product with
  // DIFFERENT explicit quantities. That is genuinely ambiguous and must become a
  // question upstream - never a guess in either direction - so it is flagged
  // distinctly rather than folded in with the rest.
  const seenIdentity = new Map();
  const duplicateIdentities = [];
  packet.lines.forEach((l, i) => {
    const key = identityKey(l);
    if (seenIdentity.has(key)) {
      const first = packet.lines[seenIdentity.get(key)];
      const quantities = [first.required_quantity, l.required_quantity];
      duplicateIdentities.push({
        identity: key,
        seqs: [first.seq, l.seq],
        canonical_product_name: l.canonical_product_name,
        quantities,
        quantities_differ: quantities[0] !== quantities[1],
        rule: 3,
      });
      return;
    }
    seenIdentity.set(key, i);
  });

  // ASSERT THE ORDER ITSELF - the point of this whole check.
  for (let i = 1; i < packet.lines.length; i += 1) {
    if (compareLines(packet.lines[i - 1], packet.lines[i]) > 0) {
      throw new PacketContractError(
        'SORT_CONTRACT_VIOLATED',
        `lines are NOT in ${SORT_CONTRACT} order: lines[${i - 1}] must not precede lines[${i}]. The ordering is the speed of the shop; a mis-sorted packet is refused rather than re-sorted here.`,
        { at: i, seq_before: packet.lines[i - 1].seq, seq_after: packet.lines[i].seq },
      );
    }
  }

  // RECOMPUTE the reconciliation inputs and refuse a packet that contradicts
  // itself. These numbers are what the basket is measured against.
  const distinct = seenIdentity.size;
  const units = packet.lines.reduce((sum, l) => sum + l.required_quantity, 0);
  if (!isInt(packet.expected_distinct_products) || packet.expected_distinct_products !== distinct) {
    throw new PacketContractError(
      'EXPECTED_DISTINCT_MISMATCH',
      `expected_distinct_products is ${packet.expected_distinct_products} but the packet's lines carry ${distinct} distinct identities`,
      { declared: packet.expected_distinct_products, computed: distinct, lines: packet.lines.length },
    );
  }
  if (!isInt(packet.expected_total_units) || packet.expected_total_units !== units) {
    throw new PacketContractError(
      'EXPECTED_UNITS_MISMATCH',
      `expected_total_units is ${packet.expected_total_units} but the packet's quantities sum to ${units}`,
      { declared: packet.expected_total_units, computed: units },
    );
  }

  return { distinct, units, sortContractDeclared: declared != null, duplicateIdentities };
}

function copyLine(line) {
  return {
    seq: line.seq,
    shop_line_no: line.shop_line_no == null ? null : line.shop_line_no,
    original_list_line: line.original_list_line,
    canonical_product_id: line.canonical_product_id == null ? null : line.canonical_product_id,
    canonical_product_name: line.canonical_product_name,
    brand: line.brand == null ? null : line.brand,
    normalized_brand: line.normalized_brand === undefined ? brandKey(line) : line.normalized_brand,
    source_view: line.source_view,
    asda_product_ref: line.asda_product_ref == null ? null : line.asda_product_ref,
    asda_url: line.asda_url == null ? null : line.asda_url,
    required_quantity: line.required_quantity,
    origin: line.origin,
    approved_search_term: line.approved_search_term == null ? null : line.approved_search_term,
    substitutes_allowed: line.substitutes_allowed === true,
    applied_rules: Array.isArray(line.applied_rules) ? line.applied_rules.slice() : [],
    quantity_rationale: line.quantity_rationale == null ? null : line.quantity_rationale,
  };
}

function copyHeld(h) {
  return {
    shop_line_no: h.shop_line_no == null ? null : h.shop_line_no,
    original_list_line: h.original_list_line,
    reason: h.reason,
    detail: h.detail == null ? null : h.detail,
    rule_id: h.rule_id == null ? null : h.rule_id,
  };
}

/**
 * Build the durable handoff artefact from a Sonnet Browser Execution Packet.
 *
 * @param {object} packet - conforming to SONNET-BROWSER-EXECUTION-PACKET.schema.json
 * @param {object} [opts]
 * @param {Array}  [opts.operatingRules] - asdair.rules ROWS (e.g. rule 38) whose
 *        wording is operating guidance for the shelf rather than product
 *        identity. The caller passes the rows; this module never authors them
 *        and never holds their text. See instructions.assertRuleRow.
 * @returns {object} the artefact - JSON-serialisable, deterministic, no clock
 * @throws {PacketContractError} on any packet the supervised route cannot safely execute
 */
function buildHandoff(packet, { operatingRules = [] } = {}) {
  const { distinct, units, sortContractDeclared, duplicateIdentities } = assertPacket(packet);
  if (!Array.isArray(operatingRules)) throw new TypeError('buildHandoff: operatingRules must be an array of asdair.rules rows');
  const guidance = operatingRules.map(assertRuleRow);

  const lines = packet.lines.map(copyLine);
  const held = Array.isArray(packet.held) ? packet.held.map(copyHeld) : [];
  const known = lines.filter((l) => l.origin === 'known').length;
  const newApproved = lines.length - known;

  return {
    handoff_version: HANDOFF_VERSION,
    instructions_version: INSTRUCTIONS_VERSION,
    packet_version: packet.packet_version,

    // Identity. Everything downstream - the claim row, the completion report,
    // the reconciler - is keyed on these two together.
    shop_ref: packet.shop_ref,
    packet_fingerprint: fingerprintPacket(packet),

    generated_at: packet.generated_at,
    household_id: packet.household_id == null ? null : packet.household_id,

    sort_contract: SORT_CONTRACT,
    sort_contract_declared: sortContractDeclared,
    sort_contract_verified: true, // assertPacket() threw if it were not

    expected: { distinct_products: distinct, total_units: units },
    counts: { lines: lines.length, known, new_approved: newApproved, held: held.length },

    // Never hidden: when two lines are one product in the trolley, the line
    // count and the distinct count legitimately differ, and both Sonnet and the
    // reconciler are told why rather than left to infer it.
    duplicate_identities: duplicateIdentities,

    method: BROWSER_METHOD.slice(),

    // Household operating guidance, carried WITH its rule id so its provenance
    // is visible and a stale copy is impossible - the text lives in
    // asdair.rules, never in this repository.
    operating_guidance: guidance,

    prohibited_actions: PROHIBITED_ACTIONS.map((p) => ({ id: p.id, text: p.text })),
    completion_contract: COMPLETION_CONTRACT.slice(),
    reconciliation_contract: RECONCILIATION_CONTRACT.slice(),
    line_report_statuses: LINE_REPORT_STATUSES.slice(),

    lines,
    held,
  };
}

module.exports = {
  buildHandoff,
  PacketContractError,
  HANDOFF_VERSION,
  SORT_CONTRACT,

  // Exported at the top level, NOT hidden behind _internal, so the cross-module
  // pin against packet/buildExecutionPacket.js's exported `normalizeSortKey`
  // can be written without reaching into private shape. Keeping the mirror
  // honest is the whole reason these are public.
  normalizeSortKey,
  identityKey,

  _internal: { compareLines, brandKey, nameKey, identityKey, assertPacket },
};
