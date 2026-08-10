// =====================================================================
// BUILD-015 AsdAIr - handoff/completion.test.js
//
// The ingestion produces the reconciler's INPUT and never a verdict, refuses a
// report against a superseded packet, and never manufactures a number it was
// not given.
//
// FULLY OFFLINE.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHandoff } = require('./buildHandoff');
const { ingestCompletion, toBasketObservation, basketEvidence, CompletionContractError } = require('./completion');
const { basePacket, goodReport } = require('./test/fixtures');

const handoffOf = () => buildHandoff(basePacket());

const codeOf = (fn) => {
  try { fn(); } catch (e) {
    assert.ok(e instanceof CompletionContractError, `expected CompletionContractError, got ${e && e.name}: ${e && e.message}`);
    return e.code;
  }
  assert.fail('expected a CompletionContractError, none was thrown');
  return null;
};

// ---------------------------------------------------------------------
// THE SUPERSESSION GUARD
// ---------------------------------------------------------------------

test('A COMPLETION REPORT AGAINST A SUPERSEDED PACKET IS REFUSED', () => {
  const h = handoffOf();
  const stale = buildHandoff(basePacket({
    expected_total_units: 8,
    lines: basePacket().lines.map((l, i) => (i === 0 ? { ...l, required_quantity: 3 } : l)),
  }));
  assert.notEqual(h.packet_fingerprint, stale.packet_fingerprint);
  assert.equal(codeOf(() => ingestCompletion(h, goodReport(stale.packet_fingerprint))), 'SUPERSEDED_PACKET');
});

test('A report with NO fingerprint is refused - silence is not agreement', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  delete r.packet_fingerprint;
  assert.equal(codeOf(() => ingestCompletion(h, r)), 'SUPERSEDED_PACKET');
  assert.equal(codeOf(() => ingestCompletion(h, { ...r, packet_fingerprint: '' })), 'SUPERSEDED_PACKET');
});

test('A report for a different shop is refused', () => {
  const h = handoffOf();
  assert.equal(codeOf(() => ingestCompletion(h, goodReport(h.packet_fingerprint, { shop_ref: 'SHOP-2026-01-01' }))), 'SHOP_REF_MISMATCH');
});

// ---------------------------------------------------------------------
// NOTHING IS INVENTED
// ---------------------------------------------------------------------

test('AN ADDED LINE WITH NO QUANTITY IS REFUSED - it is never assumed to be the expected one', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  delete r.lines[0].quantity;
  assert.equal(codeOf(() => ingestCompletion(h, r)), 'REPORT_MISSING_QUANTITY');
});

test("THERE IS NO 'substituted' STATUS TO REPORT ONE WITH", () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[0] = { seq: 1, status: 'substituted', quantity: 2 };
  assert.equal(codeOf(() => ingestCompletion(h, r)), 'REPORT_BAD_STATUS');
});

test('A duplicated seq in the report is refused', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines.push({ seq: 1, status: 'added', quantity: 9 });
  assert.equal(codeOf(() => ingestCompletion(h, r)), 'REPORT_DUPLICATE_SEQ');
});

test('ingestCompletion never mutates the handoff or the report', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  const hBefore = JSON.stringify(h);
  const rBefore = JSON.stringify(r);
  const out = ingestCompletion(h, r);
  out.lines[0].expected_quantity = 999;
  out.held.push({ tampered: true });
  assert.equal(JSON.stringify(h), hBefore);
  assert.equal(JSON.stringify(r), rBefore);
});

// ---------------------------------------------------------------------
// THE STRUCTURE WORKSTREAM F CONSUMES
// ---------------------------------------------------------------------

test('A perfect shop: observed matches expected, and the facts say so without a verdict', () => {
  const h = handoffOf();
  const out = ingestCompletion(h, goodReport(h.packet_fingerprint));

  assert.deepEqual(out.expected, { distinct_products: 4, total_units: 7 });
  assert.deepEqual(out.observed, { distinct_products: 4, total_units: 7 });
  assert.equal(out.distinct_products_agree, true);
  assert.equal(out.total_units_agree, true);
  assert.equal(out.declared_basket_agrees, true);
  assert.equal(out.lines.length, 4);
  assert.deepEqual(out.missing_from_report, []);
  assert.deepEqual(out.unknown_in_report, []);
  assert.deepEqual(out.not_in_basket, []);
  assert.equal(out.boundary_confirmations_complete, true);

  // No verdict field of any kind. Workstream F decides.
  for (const k of ['passed', 'ok', 'verdict', 'result', 'basket_ready']) {
    assert.equal(k in out, false, `ingestCompletion emitted a verdict field '${k}' - that is the reconciler's job`);
  }
});

test('A SHORT QUANTITY is surfaced per line and in the totals - a headline count alone never hides it', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[1].quantity = 1;                         // asked for 3
  r.basket = { distinct_products: 4, total_units: 5 };
  const out = ingestCompletion(h, r);

  assert.equal(out.observed.distinct_products, 4);
  assert.equal(out.distinct_products_agree, true, 'the DISTINCT count still matches - this is exactly the case a headline count hides');
  assert.equal(out.observed.total_units, 5);
  assert.equal(out.total_units_agree, false);
  const l2 = out.lines.find((l) => l.seq === 2);
  assert.equal(l2.expected_quantity, 3);
  assert.equal(l2.reported_quantity, 1);
  assert.equal(l2.quantity_matches, false);
});

test('AN UNAVAILABLE PRODUCT is recorded as unavailable, never as anything else', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  // The quantity SOUGHT is required even here - see REQUIRES_QUANTITY. It is a
  // fact Sonnet knows, and verifyBasket rejects a 0 on any actual line.
  r.lines[3] = { seq: 4, status: 'out_of_stock', quantity: 1, note: 'shelf empty' };
  const out = ingestCompletion(h, r);

  assert.equal(out.observed.distinct_products, 3, 'an unavailable product is NOT in the basket');
  assert.equal(out.observed.total_units, 6, 'and its sought quantity must not be counted as observed units');
  assert.equal(out.distinct_products_agree, false);
  assert.deepEqual(out.not_in_basket, [{ seq: 4, canonical_product_name: 'Table Salt', status: 'out_of_stock', note: 'shelf empty' }]);
  assert.equal(out.lines.find((l) => l.seq === 4).in_basket, false);
});

test('A LINE SONNET NEVER MENTIONED is named, not treated as absent-and-fine', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines = r.lines.filter((l) => l.seq !== 2);
  const out = ingestCompletion(h, r);
  assert.deepEqual(out.missing_from_report, [2]);
  assert.equal(out.lines.find((l) => l.seq === 2).reported, false);
  assert.equal(out.lines.find((l) => l.seq === 2).reported_status, null);
});

test('A REPORT LINE WITH NO PACKET LINE is surfaced - something unexpected is in the basket', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines.push({ seq: 99, status: 'added', quantity: 1 });
  const out = ingestCompletion(h, r);
  assert.deepEqual(out.unknown_in_report, [99]);
});

test('A DECLARED BASKET TOTAL THAT DISAGREES WITH THE LINES IS ITSELF A FINDING', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint, { basket: { distinct_products: 4, total_units: 99 } });
  const out = ingestCompletion(h, r);
  assert.equal(out.total_units_agree, true, 'the LINES still add up');
  assert.equal(out.declared_basket_agrees, false, "Sonnet's own headline disagrees with its own lines");
  assert.deepEqual(out.declared_basket, { distinct_products: 4, total_units: 99 });
});

test('A NEW PRODUCT carries its captured identity into the learning loop', () => {
  const h = handoffOf();
  const out = ingestCompletion(h, goodReport(h.packet_fingerprint));
  assert.equal(out.new_products.length, 1);
  const n = out.new_products[0];
  assert.equal(n.canonical_product_name, 'Cocoa Drops');
  assert.equal(n.original_list_line, 'coco drops??', 'the photographed wording must reach the write-back as the alias');
  assert.equal(n.approved_search_term, 'Zenith Cocoa Drops 200g');
  assert.equal(n.asda_product_ref, '1000003');
  assert.equal(n.favourited, true);
  assert.deepEqual(out.identity_capture_missing, []);
});

test('A NEW PRODUCT WITH NO CAPTURED IDENTITY is RECORDED, not silently dropped and not a refusal', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[2] = { seq: 3, status: 'added', quantity: 1 };     // added, but no ref and no favourite
  const out = ingestCompletion(h, r);

  assert.equal(out.observed.distinct_products, 4, 'the basket is real and must still reconcile');
  assert.equal(out.identity_capture_missing.length, 1);
  assert.deepEqual(out.identity_capture_missing[0], {
    seq: 3, canonical_product_name: 'Cocoa Drops', missing_ref: true, missing_favourite: true,
  });
  assert.equal(out.new_products[0].asda_product_ref, null);
});

test('A WRONG ASDA PRODUCT for a known line is visible as an identity mismatch', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[0].asda_product_ref = '9999999';
  const out = ingestCompletion(h, r);
  const l1 = out.lines.find((l) => l.seq === 1);
  assert.equal(l1.expected_asda_product_ref, '1000001');
  assert.equal(l1.reported_asda_product_ref, '9999999');
  assert.equal(l1.identity_matches, false);
});

test('THE FIVE BOUNDARY CONFIRMATIONS ARE ALL REQUIRED, and a missing one is loud', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  delete r.confirmations.no_automatic_substitution;
  const out = ingestCompletion(h, r);
  assert.equal(out.boundary_confirmations.no_automatic_substitution, false);
  assert.equal(out.boundary_confirmations_complete, false);

  const none = ingestCompletion(h, goodReport(h.packet_fingerprint, { confirmations: undefined }));
  assert.equal(none.boundary_confirmations_complete, false, 'a report that confirms nothing must not read as confirmed');
  assert.deepEqual(Object.keys(none.boundary_confirmations).sort(),
    ['no_automatic_substitution', 'no_checkout', 'no_delivery_slot', 'no_password_entry', 'no_payment']);
});

test('HELD LINES are carried through so the reconciler knows what was never going to be bought', () => {
  const h = handoffOf();
  const out = ingestCompletion(h, goodReport(h.packet_fingerprint));
  assert.equal(out.held.length, 1);
  assert.equal(out.held[0].reason, 'ambiguous');
});

// ---------------------------------------------------------------------
// THE ADAPTER TO reconcile/verifyBasket.js
// ---------------------------------------------------------------------

test('toBasketObservation emits exactly the fields verifyBasket reads from actual.lines', () => {
  const h = handoffOf();
  const obs = toBasketObservation(h, goodReport(h.packet_fingerprint));

  assert.equal(obs.lines.length, 4);
  for (const l of obs.lines) {
    assert.deepEqual(Object.keys(l).sort(), ['asda_product_ref', 'canonical_product_id', 'product_name', 'quantity', 'unavailable']);
    assert.equal(typeof l.product_name, 'string');   // requireText
    assert.ok(Number.isInteger(l.quantity));         // requireQty
    assert.equal(typeof l.unavailable, 'boolean');   // must be exactly true/false
  }
  assert.equal(obs.lines[0].product_name, 'Oat Crunch');
  assert.equal(obs.lines[0].asda_product_ref, '1000001');
  assert.equal(obs.lines[2].asda_product_ref, '1000003', 'the NEW product carries the ref Sonnet captured, not the packet null');
});

test('toBasketObservation: out_of_stock is unavailable; not_found and skipped are simply ABSENT', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[1] = { seq: 2, status: 'out_of_stock', quantity: 3 };
  r.lines[3] = { seq: 4, status: 'not_found' };
  const obs = toBasketObservation(h, r);

  const names = obs.lines.map((l) => l.product_name);
  assert.ok(names.includes('Rice Pot'), 'an unavailable product is still reported, flagged unavailable');
  assert.equal(obs.lines.find((l) => l.product_name === 'Rice Pot').unavailable, true);
  assert.equal(obs.lines.find((l) => l.product_name === 'Rice Pot').quantity, 3, 'the quantity SOUGHT, taken from the report');
  assert.equal(names.includes('Table Salt'), false, "a not_found line is absent, so verifyBasket reports it 'missing' - 'we could not find it' is not 'ASDA says unavailable'");
});

test('NO QUANTITY IS EVER INVENTED: an unavailable line without one is refused, not defaulted to 0', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[1] = { seq: 2, status: 'out_of_stock' };            // no quantity
  assert.equal(codeOf(() => toBasketObservation(h, r)), 'REPORT_MISSING_QUANTITY');
  assert.equal(codeOf(() => ingestCompletion(h, r)), 'REPORT_MISSING_QUANTITY');
});

test("EVERY emitted quantity satisfies verifyBasket's requireQty - a whole number 1 or more, never 0", () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines[1] = { seq: 2, status: 'out_of_stock', quantity: 3 };
  for (const l of toBasketObservation(h, r).lines) {
    assert.ok(Number.isInteger(l.quantity) && l.quantity >= 1,
      `verifyBasket.requireQty rejects ${JSON.stringify(l.quantity)} - it demands a whole number 1 or more on every actual line`);
  }
});

test('toBasketObservation NEVER returns null, and an empty basket is a legitimate { lines: [] }', () => {
  const h = handoffOf();
  const r = goodReport(h.packet_fingerprint);
  r.lines = h.lines.map((l) => ({ seq: l.seq, status: 'not_found' }));
  const obs = toBasketObservation(h, r);
  assert.notEqual(obs, null, 'a missing capture and an empty basket are different things; only the caller knows which it holds');
  assert.ok(Array.isArray(obs.lines));
  assert.equal(obs.lines.length, 0, 'an empty basket - verifyBasket reads this as every expected line missing');
});

test('toBasketObservation applies the SAME supersession guard', () => {
  const h = handoffOf();
  assert.equal(codeOf(() => toBasketObservation(h, goodReport('sha256:someone-elses-packet'))), 'SUPERSEDED_PACKET');
});

test('DETERMINISTIC: the same handoff and report always produce the same structure', () => {
  const h = handoffOf();
  const a = ingestCompletion(h, goodReport(h.packet_fingerprint));
  const b = ingestCompletion(handoffOf(), goodReport(h.packet_fingerprint));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ---------------------------------------------------------------------
// WP-B15-14 - basketEvidence: THE FACTS A CALLER NEEDS TO REFUSE AN EMPTY BASKET
//
// WP-B15-12 installed the rule in the CDP arm (browser-runner/runner.js
// finishBasketReady + EmptyBasketError): a basket that was not built is never
// reported as built. The supervised arm needs the SAME rule, and it needs it
// from the only evidence a supervised operator produces - the validated line
// report this module already ingests.
//
// This function stays inside this module's charter: it emits FACTS, never a
// verdict. It does not decide whether Warwick should be told the basket is
// ready - the caller does, exactly as browser-runner's runner does. What it
// removes is the caller's need to re-derive counts this module already owns.
// ---------------------------------------------------------------------

const evidenceFor = (h, over) => basketEvidence(ingestCompletion(h, goodReport(h.packet_fingerprint, over)));

test('basketEvidence: a fully reported basket is not empty and not short', () => {
  const h = handoffOf();
  const e = evidenceFor(h);
  assert.equal(e.intended, 4);
  assert.equal(e.observed, 4);
  assert.equal(e.empty, false);
  assert.equal(e.short, false);
  assert.equal(e.shortfall, 0);
  assert.equal(e.unavailable, 0);
});

test('basketEvidence: NOTHING in the trolley is EMPTY - the absence of the thing being claimed', () => {
  const h = handoffOf();
  const e = evidenceFor(h, { lines: h.lines.map((l) => ({ seq: l.seq, status: 'not_found' })) });
  assert.equal(e.intended, 4);
  assert.equal(e.observed, 0);
  assert.equal(e.empty, true, 'zero products against four intended is the defect WP-B15-12 closed in the other arm');
});

test('basketEvidence: ALL UNAVAILABLE is a DIFFERENT empty from a broken report', () => {
  const h = handoffOf();
  // out_of_stock still requires a real quantity - what was SOUGHT. Nothing is defaulted.
  const e = evidenceFor(h, { lines: h.lines.map((l) => ({ seq: l.seq, status: 'out_of_stock', quantity: l.required_quantity })) });
  assert.equal(e.observed, 0);
  assert.equal(e.empty, true);
  assert.equal(e.unavailable, 4);
  assert.equal(e.all_unavailable, true,
    '"ASDA had none of it" and "the report says nothing went in" are the same empty trolley and completely different problems');

  const broken = evidenceFor(h, { lines: h.lines.map((l) => ({ seq: l.seq, status: 'not_found' })) });
  assert.equal(broken.all_unavailable, false);
});

test('basketEvidence: a SHORTFALL is recorded and NEVER refused - there is no fill-rate threshold', () => {
  const h = handoffOf();
  const e = evidenceFor(h, {
    lines: [
      { seq: 1, status: 'added', quantity: 2 },
      { seq: 2, status: 'out_of_stock', quantity: 3 },
      { seq: 3, status: 'not_found' },
      { seq: 4, status: 'added', quantity: 1 },
    ],
  });
  assert.equal(e.observed, 2);
  assert.equal(e.intended, 4);
  assert.equal(e.shortfall, 2);
  assert.equal(e.short, true);
  assert.equal(e.empty, false,
    'items go out of stock; inventing a threshold here would strand a perfectly good trolley behind a number nobody chose');
});

test('basketEvidence: intending NOTHING cannot be an empty-basket failure', () => {
  // Mirrors runner.js `sf.intended > 0 &&` exactly: the guard is about a basket
  // that was supposed to be built, not about a packet that asked for nothing.
  //
  // The input is built directly because THE ESTATE CANNOT PRODUCE IT - asserted
  // below rather than assumed. buildHandoff refuses a zero-line packet, so this
  // branch is unreachable from a real handoff and the guard is belt-and-braces.
  // Pinning it here means a future packet change that permits an empty list
  // cannot quietly turn "nothing was asked for" into "the basket is missing".
  const e = basketEvidence({
    expected: { distinct_products: 0, total_units: 0 },
    observed: { distinct_products: 0, total_units: 0 },
    not_in_basket: [],
  });
  assert.equal(e.intended, 0);
  assert.equal(e.observed, 0);
  assert.equal(e.empty, false, 'intended 0 is not the absence of a claimed basket');
  assert.equal(e.all_unavailable, false);

  assert.throws(
    () => buildHandoff(basePacket({ lines: [], expected_distinct_products: 0, expected_total_units: 0, held: [] })),
    /nothing to shop/,
    'if a zero-line packet ever becomes buildable, the guard above is the thing standing between it and a false BASKET_READY',
  );
});

test('basketEvidence refuses anything that is not an ingestCompletion result', () => {
  for (const bad of [null, undefined, 'nope', 42, [], {}, { expected: {}, observed: {} }]) {
    assert.throws(() => basketEvidence(bad), (err) => err instanceof CompletionContractError && err.code === 'NO_INGEST',
      `basketEvidence accepted ${JSON.stringify(bad)} and would have read counts off nothing`);
  }
});

test('basketEvidence emits FACTS ONLY - no verdict field creeps in', () => {
  const h = handoffOf();
  const e = evidenceFor(h);
  for (const k of ['verified', 'passed', 'ok', 'basket_ready', 'blocking', 'reason', 'refused']) {
    assert.equal(k in e, false, `basketEvidence emitted a verdict field '${k}' - the decision belongs to the caller`);
  }
});
