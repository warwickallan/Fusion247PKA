// =====================================================================
// BUILD-015 AsdAIr - handoff/readReconciled.js
//
// WO-2026-08-13-12 (WP-B15-44). THE HANDOFF READS THE RECONCILED TRUTH.
//
// Before this file, the only way into buildHandoff() was a packet object that
// somebody else had already assembled - in practice a JSON file written earlier
// in the pipeline. That is a side-artefact: it is written once, it is never
// re-derived, and nothing makes it agree with the database afterwards. A line
// decided at 20:00 and a file written at 19:30 disagree silently, and the
// disagreement reaches the trolley.
//
// So this module reads the post-020 schema directly - asdair.shop,
// asdair.shop_line, asdair.shop_line_provenance, joined to the household
// catalogue - and produces the packet from the reconciled rows themselves.
// buildHandoff() then asserts that packet exactly as it always has. The two
// halves stay separate ON PURPOSE: this file PRODUCES (it may sort, it may
// exclude), buildHandoff() VERIFIES (it re-derives every count and refuses).
// A producer that also grades its own output is not a control.
//
// FOUR GUARDS LIVE HERE, and each one is removed on purpose by
// mutation-proof.js. A guard nobody has ever broken is a guard nobody has
// proven.
//
//   1. SHOP_NOT_READY_TO_SHOP        - nothing is emitted while a hold stands.
//   2. BRAND_SENTINEL_LEAKED         - "ZZ (no brand recorded)" is a SORT KEY,
//                                      and must never reach a human as a brand.
//   3. PACK_SIZE_TREATED_AS_QUANTITY - 16 sausages is ONE pack, not sixteen.
//   4. RECONCILED_LINE_DROPPED       - counts in equal counts out, plus named
//      / LINE_WITHOUT_PROVENANCE       exclusions. Nothing vanishes, nothing is
//                                      guessed.
//
// `query` is ALWAYS injected: `(text, params) => Promise<{rows}>`. This module
// opens no connection, reads no environment variable and holds no credential.
//
// WHAT THIS MODULE MAY NOT DO, and the reason is not stylistic: it NEVER
// writes. Every statement here is a SELECT. asdair.shop_line_provenance is
// append-only by grant (INSERT+SELECT, no UPDATE, no DELETE) and the reader of
// an immutable ledger has no business holding a pen.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

// =====================================================================
// THE EMISSION GATE - AC2, and the field is NOT a matter of taste.
//
// `shop.status` is the machine gate. `shop.human_state` is DISPLAY TRUTH,
// derived from status by migration 020's own mapping
// ('READY_TO_SHOP' -> 'READY_FOR_WARWICK') and carried onto the return so a
// human sees the same word the Cockpit shows. It is NEVER the gate.
//
// Gating on human_state would be gating on a projection: 020 maps several
// statuses onto one human_state, so a human_state test cannot distinguish the
// states it collapses. It would also compete with the EXISTING reconciliation
// guard in services/asdair/pipeline/applyDecisions.js, proven at
// decisionSpine.test.js:338 ("AC6: READY_TO_SHOP is UNREACHABLE while any line
// is unresolved"), which gates on status. Two controls on one property must
// agree or one of them is noise; this one follows that one.
// =====================================================================
const READY_STATUS = 'READY_TO_SHOP';

/**
 * The sort sentinel the finalise stage writes for a line with no brand on file.
 *
 * IT IS A SORT KEY AND IT IS NOT A BRAND. Lane D found it on all 8 held lines
 * of the reconciled artefact, sitting in the `brand` field. The handoff's own
 * sort puts a null brand last by an explicit RANK (see brandKey/compareLines in
 * buildHandoff.js) precisely so that no string is needed for the purpose - so
 * the sentinel has no job here at all, and the one thing it must never do is
 * reach a phone screen looking like a manufacturer.
 */
const BRAND_SENTINEL = 'ZZ (no brand recorded)';

/** asdair.shop_line.status - the one value that means "shop this". */
const SHOPPABLE_STATUS = 'matched';

/**
 * Every other asdair.shop_line.status, with the human reason it is not shopped.
 * A status absent from BOTH lists is an unknown state and is REFUSED, never
 * quietly treated as one or the other - a new status added upstream must not be
 * able to disappear from the trolley by default.
 */
const EXCLUSION_REASONS = {
  needs_confirmation: 'needs Warwick to confirm the match',
  unmatched_new_item: 'no household product matched, and no approved wording exists',
  unreadable: 'the photographed line could not be read',
  possible_duplicate: 'may duplicate another line - rule 3 dedupe belongs at planning',
  excluded: 'explicitly excluded from this shop',
};

class ReconciliationError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'ReconciliationError';
    this.code = code;
    this.detail = detail === undefined ? null : detail;
  }
}

const isInt = (v) => Number.isInteger(v);

// =====================================================================
// GUARD 1 - THE EMISSION GATE (AC2)
// =====================================================================

/**
 * Refuse to emit anything at all while the shop is not READY_TO_SHOP.
 *
 * This is the difference between "the handoff is wrong" and "the handoff does
 * not exist". A shop sitting in NEEDS_DECISION has an open question against a
 * line; emitting a payload for it would hand Warwick a trolley built around an
 * answer nobody gave. Refusing costs a message. Emitting costs the shop.
 *
 * @throws {ReconciliationError} SHOP_NOT_READY_TO_SHOP
 */
function assertEmissionAllowed(shop) {
  if (!shop || typeof shop !== 'object') {
    throw new ReconciliationError('SHOP_NOT_FOUND', 'no shop row was read, so no state could be established');
  }
  if (shop.status !== READY_STATUS) {
    throw new ReconciliationError(
      'SHOP_NOT_READY_TO_SHOP',
      `shop ${shop.shop_ref} is '${shop.status}' (human_state '${shop.human_state}'); a handoff is emitted only from '${READY_STATUS}'. `
      + 'A hold is outstanding somewhere upstream and the trolley must not be built around it.',
      { shop_ref: shop.shop_ref, status: shop.status, human_state: shop.human_state, required: READY_STATUS },
    );
  }
  return true;
}

// =====================================================================
// GUARD 2 - THE BRAND SENTINEL (AC3)
// =====================================================================

/**
 * The brand for one reconciled line, with the sort sentinel collapsed to null.
 *
 * null is the CORRECT representation of "no brand on file": buildHandoff's
 * compareLines ranks a null brand last explicitly, so nothing is lost by
 * refusing to carry the sentinel, and everything is lost by carrying it.
 *
 * @throws {ReconciliationError} BRAND_SENTINEL_LEAKED if it is still present
 *         downstream of this function - i.e. if somebody bypassed it.
 */
function brandFor(row) {
  const raw = row.brand == null ? null : String(row.brand).trim();
  if (raw === null || raw === '') return null;
  if (raw === BRAND_SENTINEL) return null;
  return raw;
}

/**
 * The assertion half, checked on the LINES THAT TRAVEL rather than on the rows
 * that were read - because what travels is what a human sees.
 */
function assertNoSentinelBrand(lines) {
  lines.forEach((l) => {
    if (l.brand === BRAND_SENTINEL || l.normalized_brand === BRAND_SENTINEL) {
      throw new ReconciliationError(
        'BRAND_SENTINEL_LEAKED',
        `line ${l.seq} carries the sort sentinel '${BRAND_SENTINEL}' as its brand. `
        + 'That string is an ordering device for a line with NO brand on file; presented to a human it reads as a manufacturer that does not exist.',
        { seq: l.seq, canonical_product_name: l.canonical_product_name },
      );
    }
  });
  return true;
}

// =====================================================================
// GUARD 3 - PACK SIZE IS IDENTITY, NEVER PURCHASE QUANTITY (AC4)
// =====================================================================

/**
 * The pack size carried in a catalogue product NAME - "Richmond Thick Pork
 * Sausages 16 Pack", "Ariel All-in-1 Pods Original 33 Washes".
 *
 * This is IDENTITY. It says what one unit of this product IS. It is the
 * difference between two products, not a number of them, and the canonical
 * implementation of that semantics is Lane AB's
 * services/asdair/pipeline/finalise/settleQuantity.js, whose own note puts it
 * exactly: the pack-identity rule "turns the real page line '16 Richmond
 * Skinless Pork Sausages' into ONE PACK". This module does not own that rule
 * and does not re-decide it - it extracts the identity so the guard below can
 * assert that the rule was not inverted somewhere between the row and the phone.
 *
 * @returns {{pack_size:number, pack_unit:string}|null}
 */
function packIdentityOf(productName) {
  if (typeof productName !== 'string') return null;

  // EVERY match, not the first. "Ariel All-in-1 Pods Original 33 Washes"
  // contains "1 Pods" inside the BRAND VARIANT before it reaches the real pack
  // size at the end, and a first-match read returns 1 - silently losing the
  // identity on exactly one of the two products this guard is named for. Found
  // by readReconciled.test.js's own Ariel case, which is why that case names
  // the number rather than asserting "some pack identity exists".
  const all = [...productName.matchAll(/(\d+)\s*(packs?|washes|wash|pints?|sausages|pods|tablets|capsules|sheets|rolls|bags)\b/gi)]
    .map((m) => ({ pack_size: Number(m[1]), pack_unit: m[2].toLowerCase() }))
    .filter((p) => isInt(p.pack_size) && p.pack_size >= 2);

  // The LAST qualifying match. Catalogue names put the pack size at the end,
  // after the variant - "Original 33 Washes", "Thick Pork Sausages 16 Pack".
  return all.length > 0 ? all[all.length - 1] : null;
}

/**
 * THE GUARD, and it is a TRACEABILITY assertion rather than a range check.
 *
 * Every quantity that travels must equal a number that was actually recorded
 * against that line in the reconciled rows - asdair.shop_line.quantity, or the
 * quantity on its surviving asdair.shop_line_provenance row. Nothing else is a
 * source. A number parsed out of a product name is not a source.
 *
 * Written this way it has NO false-refusal edge: if Warwick genuinely wants
 * sixteen packs, shop_line.quantity says 16, the emitted quantity is 16, and
 * they match. What it catches is the number that appeared from nowhere - which
 * is exactly what "pack size became the purchase quantity" looks like from
 * here, and is why the mutant that makes that substitution goes red.
 *
 * @throws {ReconciliationError} PACK_SIZE_TREATED_AS_QUANTITY
 */
function assertQuantityIsTraceable(line, reconciledQuantities, packIdentity) {
  const permitted = reconciledQuantities.filter((q) => isInt(q) && q > 0);
  if (permitted.length === 0) {
    throw new ReconciliationError(
      'QUANTITY_NOT_RECONCILED',
      `line ${line.seq} (${line.canonical_product_name}) carries quantity ${line.required_quantity} with no reconciled source. `
      + 'A quantity is never invented; an unsettled line is held and asked about, not shopped.',
      { seq: line.seq, required_quantity: line.required_quantity },
    );
  }
  if (!permitted.includes(line.required_quantity)) {
    const packNote = packIdentity && packIdentity.pack_size === line.required_quantity
      ? ` That number is the PACK SIZE from the product name (${packIdentity.pack_size} ${packIdentity.pack_unit}); pack size is identity - one pack - and is never a purchase quantity.`
      : '';
    throw new ReconciliationError(
      'PACK_SIZE_TREATED_AS_QUANTITY',
      `line ${line.seq} (${line.canonical_product_name}) would be shopped ${line.required_quantity} times, but the reconciled rows record ${permitted.join('/')}.${packNote}`,
      {
        seq: line.seq,
        emitted: line.required_quantity,
        reconciled: permitted,
        pack_identity: packIdentity,
        canonical_product_name: line.canonical_product_name,
      },
    );
  }
  return true;
}

// =====================================================================
// GUARD 4 - NOTHING VANISHES, NOTHING IS GUESSED (AC5)
// =====================================================================

/**
 * Every reconciled line is either shopped or NAMED as an exclusion. The
 * arithmetic is asserted rather than assumed, because a silent drop is the one
 * failure this whole module exists to prevent and it is invisible by
 * construction: a payload with a line missing looks exactly like a payload.
 *
 * @throws {ReconciliationError} RECONCILED_LINE_DROPPED
 */
function assertNothingDropped(allRows, shoppable, exclusions) {
  const accounted = shoppable.length + exclusions.length;
  if (accounted !== allRows.length) {
    const seen = new Set([...shoppable.map((l) => l.shop_line_no), ...exclusions.map((h) => h.shop_line_no)]);
    const missing = allRows.filter((r) => !seen.has(r.line_no)).map((r) => r.line_no);
    throw new ReconciliationError(
      'RECONCILED_LINE_DROPPED',
      `${allRows.length} reconciled lines were read but only ${accounted} are accounted for `
      + `(${shoppable.length} shopped, ${exclusions.length} excluded). Missing line_no: ${missing.join(', ') || '(unknown)'}.`,
      { read: allRows.length, shopped: shoppable.length, excluded: exclusions.length, missing },
    );
  }
  return true;
}

/**
 * A shoppable line with no surviving provenance row cannot say where it came
 * from. It is not dropped and it is not guessed at: it is REFUSED, loudly,
 * because "we do not know why this is in the trolley" is not a state a shop
 * should be allowed to reach.
 *
 * @throws {ReconciliationError} LINE_WITHOUT_PROVENANCE
 */
function assertProvenancePresent(lines, provenanceByLineNo) {
  lines.forEach((l) => {
    const rows = provenanceByLineNo.get(l.shop_line_no);
    if (!rows || rows.length === 0) {
      throw new ReconciliationError(
        'LINE_WITHOUT_PROVENANCE',
        `line ${l.seq} (${l.canonical_product_name}, shop_line ${l.shop_line_no}) has no surviving asdair.shop_line_provenance row. `
        + 'Post-020 every reconciled line carries its origin; a line that cannot say where it came from is not shopped.',
        { seq: l.seq, shop_line_no: l.shop_line_no },
      );
    }
  });
  return true;
}

// =====================================================================
// THE READS. Every statement is a SELECT.
// =====================================================================

const SHOP_SQL = `
  select id, shop_ref, status, human_state, household_id, list_id, created_at
    from asdair.shop
   where shop_ref = $1`;

const SHOP_BY_ID_SQL = `
  select id, shop_ref, status, human_state, household_id, list_id, created_at
    from asdair.shop
   where id = $1`;

/**
 * The reconciled lines, joined to the household catalogue for brand, canonical
 * name and durable ASDA reference. LEFT JOIN on purpose: a line with no matched
 * regular is a real reconciled line and must be visible so it can be EXCLUDED
 * by name, rather than filtered out here and silently lost.
 */
const LINES_SQL = `
  select sl.id, sl.line_no, sl.raw_reading, sl.quantity, sl.status,
         sl.matched_regular_id, sl.match_basis, sl.corrected,
         r.brand, r.name as canonical_product_name, r.asda_product_id,
         r.asda_url, r.substitutes_allowed
    from asdair.shop_line sl
    left join asdair.regulars r on r.id = sl.matched_regular_id
   where sl.shop_id = $1
   order by sl.line_no`;

/**
 * Surviving provenance only. A superseded row is history: it records what was
 * believed earlier, and 020 keeps it precisely so the correction is auditable.
 * Reading it as current truth would resurrect a decision that was overturned.
 */
const PROVENANCE_SQL = `
  select id, line_no, provenance, quantity, raw_text, matched_regular_id,
         interpreter_model, prompt_version, confidence, interpreted_at
    from asdair.shop_line_provenance
   where shop_id = $1
     and superseded_by_id is null
   order by line_no, id`;

/**
 * Read one shop's reconciled truth. READ-ONLY.
 *
 * @param {(text:string, params:any[]) => Promise<{rows:any[]}>} query
 * @param {{shopRef?:string, shopId?:number}} opts
 */
async function readReconciledShop(query, { shopRef, shopId } = {}) {
  if (typeof query !== 'function') throw new TypeError('readReconciledShop: query must be injected as (text, params) => Promise<{rows}>');
  if (shopRef == null && shopId == null) throw new TypeError('readReconciledShop: one of shopRef or shopId is required');

  const shopRes = shopId != null
    ? await query(SHOP_BY_ID_SQL, [shopId])
    : await query(SHOP_SQL, [shopRef]);
  const shop = shopRes.rows[0];
  if (!shop) {
    throw new ReconciliationError('SHOP_NOT_FOUND', `no asdair.shop row for ${shopId != null ? `id ${shopId}` : shopRef}`, { shopRef, shopId });
  }

  const [lineRes, provRes] = [
    await query(LINES_SQL, [shop.id]),
    await query(PROVENANCE_SQL, [shop.id]),
  ];

  const provenanceByLineNo = new Map();
  provRes.rows.forEach((p) => {
    const key = p.line_no;
    if (!provenanceByLineNo.has(key)) provenanceByLineNo.set(key, []);
    provenanceByLineNo.get(key).push(p);
  });

  return { shop, rows: lineRes.rows, provenanceByLineNo };
}

// =====================================================================
// THE PACKET - produced from reconciled rows, then handed to buildHandoff to
// be verified independently.
// =====================================================================

/**
 * Turn reconciled rows into a Sonnet Browser Execution Packet.
 *
 * The emission gate fires FIRST, before any line is shaped, so a held shop
 * produces no partial artefact to be found on disk later and mistaken for one.
 */
function toPacket({ shop, rows, provenanceByLineNo }, { generatedAt } = {}) {
  assertEmissionAllowed(shop);

  const exclusions = [];
  const shoppableRows = [];

  rows.forEach((r) => {
    if (r.status === SHOPPABLE_STATUS) {
      shoppableRows.push(r);
      return;
    }
    const reason = EXCLUSION_REASONS[r.status];
    if (!reason) {
      throw new ReconciliationError(
        'UNKNOWN_LINE_STATUS',
        `asdair.shop_line ${r.id} (line ${r.line_no}) has status '${r.status}', which this consumer cannot classify as shoppable or excluded. `
        + 'An unrecognised status is refused rather than defaulted - defaulting it either drops the line or shops something nobody approved.',
        { shop_line_id: r.id, line_no: r.line_no, status: r.status },
      );
    }
    exclusions.push({
      shop_line_no: r.line_no,
      original_list_line: r.raw_reading,
      reason,
      detail: r.status,
      rule_id: null,
    });
  });

  // Produce the ORDER. buildHandoff will independently verify it and refuse if
  // this sort is wrong - which is the point of doing it in two places.
  const shaped = shoppableRows.map((r) => {
    const brand = brandFor(r);
    const packIdentity = packIdentityOf(r.canonical_product_name);
    const provRows = provenanceByLineNo.get(r.line_no) || [];

    // The quantity comes from the reconciled rows and from nowhere else.
    const reconciledQuantities = [r.quantity, ...provRows.map((p) => p.quantity)]
      .filter((q) => q != null)
      .map((q) => Number(q));

    return {
      row: r,
      brand,
      packIdentity,
      provRows,
      reconciledQuantities,
      canonical_product_name: r.canonical_product_name,
      required_quantity: reconciledQuantities.length > 0 ? reconciledQuantities[0] : null,
    };
  });

  // A line whose quantity was never settled is HELD, not guessed and not
  // dropped. It leaves the shoppable set and enters the named exclusions, so
  // the arithmetic below still balances.
  const settled = [];
  shaped.forEach((s) => {
    if (s.required_quantity == null) {
      exclusions.push({
        shop_line_no: s.row.line_no,
        original_list_line: s.row.raw_reading,
        reason: 'quantity was never settled - it is asked about, never assumed',
        detail: 'no quantity on the shop_line row and none on its surviving provenance',
        rule_id: null,
      });
      return;
    }
    settled.push(s);
  });

  settled.sort((a, b) => {
    const ba = a.brand === null ? null : a.brand.toLowerCase();
    const bb = b.brand === null ? null : b.brand.toLowerCase();
    if (ba !== bb) {
      if (ba === null) return 1;
      if (bb === null) return -1;
      return ba < bb ? -1 : 1;
    }
    const na = (a.canonical_product_name || '').toLowerCase();
    const nb = (b.canonical_product_name || '').toLowerCase();
    if (na === nb) return 0;
    return na < nb ? -1 : 1;
  });

  const lines = settled.map((s, i) => ({
    seq: i + 1,
    shop_line_no: s.row.line_no,
    original_list_line: s.row.raw_reading,
    canonical_product_id: s.row.matched_regular_id,
    canonical_product_name: s.canonical_product_name,
    brand: s.brand,
    normalized_brand: undefined,
    source_view: 'regulars',
    asda_product_ref: s.row.asda_product_id == null ? null : String(s.row.asda_product_id),
    asda_url: s.row.asda_url == null ? null : s.row.asda_url,
    required_quantity: s.required_quantity,
    origin: 'known',
    approved_search_term: null,
    substitutes_allowed: s.row.substitutes_allowed === true,
    applied_rules: [],
    quantity_rationale: s.packIdentity
      ? `pack identity: one ${s.packIdentity.pack_size} ${s.packIdentity.pack_unit} pack is ONE unit`
      : null,

    // Carried as IDENTITY metadata. Never read as a count.
    pack_identity: s.packIdentity,

    // The surviving provenance for this line, reduced to what a human needs to
    // see: WHERE it came from and WHAT was read. The model name and prompt
    // version travel too, because "a model said so" is a materially different
    // fact from "the rulebook said so" and the person at the shelf is entitled
    // to know which one they are looking at.
    provenance: s.provRows.map((p) => ({
      provenance: p.provenance,
      raw_text: p.raw_text == null ? null : p.raw_text,
      quantity: p.quantity == null ? null : Number(p.quantity),
      interpreter_model: p.interpreter_model == null ? null : p.interpreter_model,
      prompt_version: p.prompt_version == null ? null : p.prompt_version,
      confidence: p.confidence == null ? null : Number(p.confidence),
    })),
  }));

  // ---- the guards, on what actually travels ----
  assertNoSentinelBrand(lines);
  assertProvenancePresent(lines, provenanceByLineNo);
  lines.forEach((l, i) => assertQuantityIsTraceable(l, settled[i].reconciledQuantities, settled[i].packIdentity));
  assertNothingDropped(rows, lines, exclusions);

  const identities = new Set(lines.map((l) => (l.canonical_product_id != null ? `id:${l.canonical_product_id}` : `ref:${l.asda_product_ref}`)));

  const packet = {
    packet_version: 1,
    shop_ref: shop.shop_ref,
    generated_at: generatedAt || (shop.created_at instanceof Date ? shop.created_at.toISOString() : String(shop.created_at)),
    household_id: shop.household_id,
    sort_contract: 'brand_az_then_product_az',
    expected_distinct_products: identities.size,
    expected_total_units: lines.reduce((sum, l) => sum + l.required_quantity, 0),
    lines,
    held: exclusions,
  };

  return { packet, exclusions, shop };
}

/**
 * THE PRODUCTION PATH. Read the reconciled truth, refuse if a hold stands,
 * produce the packet, and let buildHandoff verify it independently.
 *
 * Returns the artefact together with the shop's DISPLAY state, so a caller can
 * show Warwick the same word the Cockpit shows without ever having gated on it.
 */
async function buildHandoffFromDb(query, opts = {}) {
  const { buildHandoff } = require('./buildHandoff');
  const reconciled = await readReconciledShop(query, opts);
  const { packet, exclusions, shop } = toPacket(reconciled, opts);
  const handoff = buildHandoff(packet, { operatingRules: opts.operatingRules || [] });
  return {
    handoff,
    packet,
    exclusions,
    shop: { id: shop.id, shop_ref: shop.shop_ref, status: shop.status, human_state: shop.human_state },
  };
}

module.exports = {
  buildHandoffFromDb,
  readReconciledShop,
  toPacket,
  ReconciliationError,
  READY_STATUS,
  BRAND_SENTINEL,
  SHOPPABLE_STATUS,
  EXCLUSION_REASONS,

  // Exported at the top level so mutation-proof.js can remove each guard on
  // purpose and require the property to break. A guard that cannot be reached
  // from a test cannot be proven load-bearing.
  _internal: {
    assertEmissionAllowed,
    assertNoSentinelBrand,
    assertQuantityIsTraceable,
    assertNothingDropped,
    assertProvenancePresent,
    brandFor,
    packIdentityOf,
  },
};
