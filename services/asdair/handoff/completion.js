// =====================================================================
// BUILD-015 AsdAIr - handoff/completion.js
//
// COMPLETION INGESTION. What Sonnet reports back, turned into the structure
// Workstream F's reconciler consumes. PURE.
//
// THIS MODULE EMITS NO VERDICT. It does not decide whether the basket is
// correct, whether the shop passed, or whether Warwick should be told the
// basket is ready. Those are the reconciler's decisions and they belong to
// Workstream F, which owns reconcile/**. This file produces that reconciler's
// INPUT: the packet's expectation and Sonnet's observation, aligned line by
// line, with every disagreement made explicit and nothing quietly reconciled.
//
// PURE and DETERMINISTIC: no DB, no network, no fs, no clock, no randomness.
// It never mutates its arguments.
//
// -------------------------------------------------------------------------
// TWO REFUSALS AND ONE RECORDED GAP - and the asymmetry is deliberate
// -------------------------------------------------------------------------
// REFUSED (the whole report is rejected):
//   * a report whose packet_fingerprint is absent or does not match the
//     handoff. That is a report against a SUPERSEDED packet, and accepting it
//     would reconcile this week's basket against last week's expectation.
//   * an `added` line with no reported quantity. Quantity is the number
//     reconciliation is built on, and there is no honest substitute for it -
//     defaulting to the expected quantity would manufacture agreement.
//
// RECORDED, NOT REFUSED:
//   * a newly approved product added without its ASDA identity captured. The
//     basket is real and Warwick still needs it reconciled; throwing the whole
//     report away over a missing learning-loop field would cost more than it
//     protects. It is surfaced in `identity_capture_missing` so the write-back
//     cannot silently skip it.
//
// PURE ASCII SOURCE ONLY. No dependencies.
// =====================================================================
'use strict';

const { sameFingerprint } = require('./fingerprint');
const { LINE_REPORT_STATUSES, PROHIBITED_ACTIONS } = require('./instructions');

const INGEST_VERSION = 1;
const IN_BASKET_STATUSES = ['added'];

/**
 * Statuses that become a line in the CAPTURED BASKET, and therefore must carry
 * a real quantity.
 *
 * `out_of_stock` is here for a reason that is not obvious. It does not go in the
 * basket, but reconcile/verifyBasket.js needs it as an `actual` line so it can
 * report the outcome `unavailable` ("ASDA showed this as unobtainable. It must
 * NOT be substituted; Warwick decides") rather than the weaker `missing`. And
 * verifyBasket's `requireQty` rejects 0 - it demands a whole number 1 or more on
 * every actual line, precisely because that module exists to catch quantity
 * errors and will not let one be invented.
 *
 * So the quantity SOUGHT is required on an unavailable line. It is a fact
 * Sonnet knows. Defaulting it here - to 0, or to the packet's own
 * required_quantity - would be this module inventing the number that the next
 * module down was built to protect.
 */
const REQUIRES_QUANTITY = ['added', 'out_of_stock'];

class CompletionContractError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'CompletionContractError';
    this.code = code;
    this.detail = detail;
  }
}

const isInt = (v) => Number.isInteger(v);

function assertReportShape(handoff, report) {
  if (!handoff || typeof handoff !== 'object') throw new CompletionContractError('NO_HANDOFF', 'ingestCompletion: handoff is required');
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new CompletionContractError('REPORT_NOT_OBJECT', 'ingestCompletion: report must be an object');

  // THE SUPERSESSION GUARD. First check, before anything else is read.
  if (!sameFingerprint(report.packet_fingerprint, handoff.packet_fingerprint)) {
    throw new CompletionContractError(
      'SUPERSEDED_PACKET',
      'completion refused: the report does not carry this packet\'s fingerprint. A report against a superseded packet is never silently accepted.',
      { expected: handoff.packet_fingerprint, reported: report.packet_fingerprint == null ? null : String(report.packet_fingerprint) },
    );
  }
  if (report.shop_ref != null && report.shop_ref !== handoff.shop_ref) {
    throw new CompletionContractError('SHOP_REF_MISMATCH', `completion refused: report is for ${report.shop_ref}, handoff is for ${handoff.shop_ref}`, { expected: handoff.shop_ref, reported: report.shop_ref });
  }
  if (!Array.isArray(report.lines)) {
    throw new CompletionContractError('REPORT_LINES_MISSING', 'completion refused: report.lines must be an array, one entry per packet line');
  }
}

function assertReportLine(entry, i) {
  const at = `report.lines[${i}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new CompletionContractError('REPORT_LINE_NOT_OBJECT', `${at} is not an object`);
  if (!isInt(entry.seq) || entry.seq < 1) throw new CompletionContractError('REPORT_BAD_SEQ', `${at}.seq must be an integer >= 1`, { seq: entry.seq });
  if (!LINE_REPORT_STATUSES.includes(entry.status)) {
    throw new CompletionContractError(
      'REPORT_BAD_STATUS',
      `${at}.status must be one of ${LINE_REPORT_STATUSES.join('|')}. There is deliberately no 'substituted' status - substitution is not a permitted outcome anywhere in this product.`,
      { seq: entry.seq, status: entry.status },
    );
  }
  if (REQUIRES_QUANTITY.includes(entry.status) && (!isInt(entry.quantity) || entry.quantity < 1)) {
    throw new CompletionContractError(
      'REPORT_MISSING_QUANTITY',
      `${at}: a '${entry.status}' line must report a whole quantity of 1 or more - what went in the basket, or what was sought when ASDA showed it unobtainable. Reconciliation is built on this number and it is NEVER assumed or defaulted.`,
      { seq: entry.seq, status: entry.status, quantity: entry.quantity },
    );
  }
}

/**
 * Ingest Sonnet's completion report.
 *
 * @param {object} handoff - the artefact returned by buildHandoff()
 * @param {object} report  - what Sonnet reported back
 * @returns {object} the reconciler input structure. No verdict, no decision.
 * @throws {CompletionContractError}
 */
function ingestCompletion(handoff, report) {
  assertReportShape(handoff, report);
  report.lines.forEach(assertReportLine);

  const bySeq = new Map();
  for (const entry of report.lines) {
    if (bySeq.has(entry.seq)) {
      throw new CompletionContractError('REPORT_DUPLICATE_SEQ', `report.lines reports seq ${entry.seq} more than once`, { seq: entry.seq });
    }
    bySeq.set(entry.seq, entry);
  }

  const lines = [];
  const missingFromReport = [];
  const notInBasket = [];
  const newProducts = [];
  const identityCaptureMissing = [];
  let observedDistinct = 0;
  let observedUnits = 0;

  for (const l of handoff.lines) {
    const r = bySeq.get(l.seq) || null;
    if (!r) {
      missingFromReport.push(l.seq);
    }
    const inBasket = r != null && IN_BASKET_STATUSES.includes(r.status);
    const reportedQty = r && isInt(r.quantity) ? r.quantity : null;
    if (inBasket) {
      observedDistinct += 1;
      observedUnits += reportedQty;
    }
    if (r && !inBasket) {
      notInBasket.push({ seq: l.seq, canonical_product_name: l.canonical_product_name, status: r.status, note: r.note == null ? null : String(r.note) });
    }

    const reportedRef = r && r.asda_product_ref != null ? String(r.asda_product_ref) : null;

    if (l.origin === 'new_approved' && inBasket) {
      const favourited = r.favourited === true;
      newProducts.push({
        seq: l.seq,
        canonical_product_name: l.canonical_product_name,
        original_list_line: l.original_list_line,
        brand: l.brand,
        approved_search_term: l.approved_search_term,
        asda_product_ref: reportedRef,
        asda_url: r.asda_url == null ? null : String(r.asda_url),
        favourited,
        quantity: reportedQty,
      });
      if (reportedRef == null || !favourited) {
        identityCaptureMissing.push({
          seq: l.seq,
          canonical_product_name: l.canonical_product_name,
          missing_ref: reportedRef == null,
          missing_favourite: !favourited,
        });
      }
    }

    lines.push({
      seq: l.seq,
      shop_line_no: l.shop_line_no,
      canonical_product_id: l.canonical_product_id,
      canonical_product_name: l.canonical_product_name,
      original_list_line: l.original_list_line,
      brand: l.brand,
      origin: l.origin,
      source_view: l.source_view,
      expected_asda_product_ref: l.asda_product_ref,
      expected_quantity: l.required_quantity,
      reported: r == null ? false : true,
      reported_status: r == null ? null : r.status,
      reported_quantity: reportedQty,
      reported_asda_product_ref: reportedRef,
      identity_matches: l.asda_product_ref == null || reportedRef == null ? null : l.asda_product_ref === reportedRef,
      quantity_matches: reportedQty == null ? null : reportedQty === l.required_quantity,
      in_basket: inBasket,
      substitutes_allowed: l.substitutes_allowed,
      applied_rules: l.applied_rules.slice(),
      note: r && r.note != null ? String(r.note) : null,
    });
  }

  const packetSeqs = new Set(handoff.lines.map((l) => l.seq));
  const unknownInReport = report.lines.filter((r) => !packetSeqs.has(r.seq)).map((r) => r.seq);

  // What Sonnet CLAIMED it could see, kept separate from what its own line
  // reports add up to. A basket total that disagrees with the lines is itself a
  // finding, and collapsing the two would hide it.
  const declared = report.basket && typeof report.basket === 'object'
    ? {
      distinct_products: isInt(report.basket.distinct_products) ? report.basket.distinct_products : null,
      total_units: isInt(report.basket.total_units) ? report.basket.total_units : null,
    }
    : null;

  const confirmations = {};
  let confirmationsComplete = true;
  for (const p of PROHIBITED_ACTIONS) {
    const v = report.confirmations && report.confirmations[p.id] === true;
    confirmations[p.id] = v;
    if (!v) confirmationsComplete = false;
  }

  return {
    ingest_version: INGEST_VERSION,
    handoff_version: handoff.handoff_version,
    instructions_version: handoff.instructions_version,
    shop_ref: handoff.shop_ref,
    packet_fingerprint: handoff.packet_fingerprint,

    expected: {
      distinct_products: handoff.expected.distinct_products,
      total_units: handoff.expected.total_units,
    },
    observed: { distinct_products: observedDistinct, total_units: observedUnits },
    declared_basket: declared,

    // Facts, not verdicts. Workstream F decides what they mean.
    distinct_products_agree: observedDistinct === handoff.expected.distinct_products,
    total_units_agree: observedUnits === handoff.expected.total_units,
    declared_basket_agrees: declared == null
      ? null
      : declared.distinct_products === observedDistinct && declared.total_units === observedUnits,

    lines,
    missing_from_report: missingFromReport,
    unknown_in_report: unknownInReport,
    not_in_basket: notInBasket,
    new_products: newProducts,
    identity_capture_missing: identityCaptureMissing,
    held: handoff.held.map((h) => ({ ...h })),

    boundary_confirmations: confirmations,
    boundary_confirmations_complete: confirmationsComplete,
    reporter_notes: Array.isArray(report.notes) ? report.notes.map((n) => String(n)) : [],
  };
}

/**
 * THE DIRECT ADAPTER TO WORKSTREAM F'S RECONCILER.
 *
 * `reconcile/verifyBasket.js` takes `verifyBasket({ expected, actual })`, where
 * `expected` is THE PACKET and `actual` is the CAPTURED BASKET.
 *
 * ==> PASS THE PACKET AS `expected`. NEVER THE HANDOFF. <==
 *
 *   verifyBasket({ expected: PACKET, actual: toBasketObservation(handoff, report) })
 *
 * An earlier version of this header documented `expected: handoff`, and that was
 * WRONG in a way that was silent rather than loud - which is why the correction
 * is shouted here and enforced by assertVerifyBasketExpected() below.
 *
 * WHY IT MATTERS. verifyBasket reads the counts FLAT
 * (`expected.expected_distinct_products`, `expected.expected_total_units`) and
 * reports `packet_self_consistent` from them. buildHandoff() returns them
 * NESTED (`expected: { distinct_products, total_units }`). Hand it the handoff
 * and both flat reads are `undefined`, so `packet_self_consistent` is
 * structurally always true and the producer-defect check NEVER FIRES. Proven
 * under a runner with the declared counts corrupted to 999: passed as the
 * handoff -> `packet_self_consistent: true, blocking: []`; passed as the packet
 * -> `false`, blocking, `verified: false`.
 *
 * AND WHY THE FIX IS NOT "ALSO PUT THE FLAT FIELDS ON THE HANDOFF".
 * `packet_self_consistent` is a check on the PRODUCER. buildHandoff already
 * refuses a packet whose declared counts disagree with its own lines, so a
 * handoff carrying re-derived counts would satisfy that check tautologically -
 * it would be verifying this module's arithmetic, not the producer's claim. The
 * check has to see the raw producer artefact or it is not the check it says it
 * is. Carrying the numbers twice on one object would also be a second copy of a
 * fact that has an owner, which is the exact defect class being closed today.
 *
 * `handoff.lines` DOES carry every per-line field verifyBasket reads, which is
 * precisely why the wrong call looks plausible and fails quietly.
 *
 * Sonnet does not report a basket - it reports per-line outcomes. This function
 * is the conversion, and it is deliberately separate from ingestCompletion():
 *
 * ingestCompletion() remains the RICHER record - new-product identity capture,
 * boundary confirmations, held lines, the reporter's notes - none of which
 * verifyBasket consumes and none of which should be thrown away to fit it.
 *
 * `unavailable: true` is set for out_of_stock, because that is exactly what
 * verifyBasket documents it to mean: ASDA showed the product as unobtainable.
 * A `not_found` or `skipped` line is NOT in the basket at all and is therefore
 * simply absent, which verifyBasket reports as `missing` - the honest outcome,
 * since "we could not find it" is not "ASDA says it is unavailable".
 *
 * NO QUANTITY IS EVER DEFAULTED HERE. Every emitted line's quantity came from
 * the report and was validated by assertReportLine. An earlier version of this
 * function emitted `quantity: 0` for an unavailable line; verifyBasket's
 * requireQty rejects 0 outright, so that would have thrown at the seam - and it
 * was an invented number besides.
 *
 * `{ lines: [] }` is a legitimate return: an empty basket, which verifyBasket
 * reads as every expected line missing. This function never returns null - a
 * missing capture is a different thing from an empty one, and only the caller
 * can know which it is holding.
 */
function toBasketObservation(handoff, report) {
  assertReportShape(handoff, report);
  report.lines.forEach(assertReportLine);

  const bySeq = new Map(handoff.lines.map((l) => [l.seq, l]));
  const lines = [];
  for (const r of report.lines) {
    const l = bySeq.get(r.seq) || null;
    const inBasket = IN_BASKET_STATUSES.includes(r.status);
    const unavailable = r.status === 'out_of_stock';
    if (!inBasket && !unavailable) continue;          // absent -> verifyBasket reports `missing`

    lines.push({
      canonical_product_id: l ? l.canonical_product_id : (r.canonical_product_id == null ? null : r.canonical_product_id),
      product_name: l ? l.canonical_product_name : String(r.product_name == null ? `unrecognised line ${r.seq}` : r.product_name),
      asda_product_ref: r.asda_product_ref != null ? String(r.asda_product_ref) : (l ? l.asda_product_ref : null),
      quantity: r.quantity,          // validated >= 1 by assertReportLine. NEVER defaulted.
      unavailable,
    });
  }
  return { shop_ref: handoff.shop_ref, packet_fingerprint: handoff.packet_fingerprint, lines };
}

/**
 * THE GUARD THAT MAKES THE WRONG CALL LOUD.
 *
 * Documentation alone was what failed here: the header said `expected: handoff`
 * and nothing objected, because the handoff carries every per-line field
 * verifyBasket reads. The only field that distinguishes them is the one whose
 * absence is silent. So the distinction is now checked rather than described.
 *
 * @throws {CompletionContractError} when handed a handoff, or anything else
 *         that cannot satisfy verifyBasket's flat count contract.
 */
function assertVerifyBasketExpected(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new CompletionContractError('EXPECTED_NOT_OBJECT', 'verifyBasket `expected` must be the execution PACKET object');
  }
  if (candidate.handoff_version !== undefined || candidate.packet_fingerprint !== undefined) {
    throw new CompletionContractError(
      'HANDOFF_PASSED_AS_EXPECTED',
      'verifyBasket `expected` must be the PACKET, not the handoff artefact. The handoff nests its counts under `expected: { distinct_products, total_units }`; verifyBasket reads them FLAT, so passing the handoff makes `packet_self_consistent` structurally always true and the producer-defect check never fires.',
      { pass: 'the packet you gave to buildHandoff()' },
    );
  }
  if (!isInt(candidate.expected_distinct_products) || !isInt(candidate.expected_total_units)) {
    throw new CompletionContractError(
      'EXPECTED_COUNTS_NOT_FLAT',
      'verifyBasket `expected` must carry FLAT expected_distinct_products and expected_total_units. Without them `packet_self_consistent` cannot be computed and silently reads as consistent.',
      {
        has_expected_distinct_products: isInt(candidate.expected_distinct_products),
        has_expected_total_units: isInt(candidate.expected_total_units),
      },
    );
  }
  return candidate;
}

/**
 * The whole call, assembled correctly, so there is ONE way to do it and no
 * plausible-looking wrong option to reach for.
 *
 *   const { expected, actual } = toVerifyBasketArgs(packet, handoff, report);
 *   verifyBasket({ expected, actual });
 *
 * `captured_at` is deliberately NOT set: it is optional in verifyBasket's
 * contract and reading a clock here would destroy the determinism every
 * idempotency proof in this module rests on. The caller adds it if it wants it.
 */
function toVerifyBasketArgs(packet, handoff, report) {
  return {
    expected: assertVerifyBasketExpected(packet),
    actual: toBasketObservation(handoff, report),
  };
}

module.exports = {
  ingestCompletion, toBasketObservation, toVerifyBasketArgs, assertVerifyBasketExpected,
  CompletionContractError, INGEST_VERSION, IN_BASKET_STATUSES, REQUIRES_QUANTITY,
};
