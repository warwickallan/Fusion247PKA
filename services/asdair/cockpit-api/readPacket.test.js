// BUILD-015 - cockpit-api/readPacket.test.js
//
// Offline. A scripted fake client; no socket, no DB.
//
// The bar these hold, in one line: the cockpit must never render a reassuring
// value over a producer that has not run, and must never present a matching
// headline count as proof when the lines underneath disagree.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const RP = require('./readPacket');

// --- a scripted client -------------------------------------------------
function makeClient(script) {
  const seen = [];
  return {
    seen: seen,
    query: async function (sql, params) {
      seen.push({ sql: sql, params: params });
      for (const step of script) {
        if (sql.indexOf(step.match) !== -1) return { rows: step.rows };
      }
      return { rows: [] };
    }
  };
}
const TABLES_PRESENT = { match: 'to_regclass', rows: [{ has_packet: true, has_reconciliation: true }] };
const TABLES_ABSENT = { match: 'to_regclass', rows: [{ has_packet: false, has_reconciliation: false }] };

function packetDoc(over) {
  return Object.assign({
    packet_version: 1,
    shop_ref: 'SHOP-2026-01-01',
    generated_at: '2026-01-01T09:00:00Z',
    sort_contract: 'brand_az_then_product_az',
    expected_distinct_products: 2,
    expected_total_units: 3,
    lines: [
      { seq: 1, original_list_line: 'example oat drink', canonical_product_id: 11,
        canonical_product_name: 'Example Brand Oat Drink 1L', brand: 'Example Brand',
        normalized_brand: 'example brand', source_view: 'regulars', asda_product_ref: '1000001',
        required_quantity: 2, origin: 'known', applied_rules: [1],
        quantity_rationale: 'list said 1; rule 1 rounds up to 2 for the any-2-for-X offer' },
      { seq: 2, original_list_line: 'brand new thing', canonical_product_id: null,
        canonical_product_name: 'Zebra Sample Thing', brand: 'Zebra',
        normalized_brand: 'zebra', source_view: 'search', required_quantity: 1,
        origin: 'new_approved', approved_search_term: 'zebra sample thing' }
    ],
    held: [{ original_list_line: 'placeholder juice', reason: 'awaiting_decision', detail: 'question open' }]
  }, over || {});
}

// =====================================================================
// SQL discipline
// =====================================================================

test('every statement is a SELECT - the reader cannot write', () => {
  assert.ok(RP.ALL_SQL.length > 0, 'a vacuous SQL list would make this assertion meaningless');
  for (const sql of RP.ALL_SQL) {
    assert.match(sql.trim(), /^SELECT/i, 'not a SELECT: ' + sql.slice(0, 60));
  }
});

test('the shop is parameterised, never interpolated', () => {
  for (const sql of RP.ALL_SQL) assert.ok(!/\$\{/.test(sql));
  assert.match(RP._internal.PACKET_SQL, /\$1/);
  assert.match(RP._internal.RECONCILIATION_SQL, /\$1/);
});

// =====================================================================
// The producers do not exist yet - the normal case today
// =====================================================================

test('a table that has not been built reads as not_built, NOT as a read failure', async () => {
  const client = makeClient([TABLES_ABSENT]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.ok, true, 'a feature that has not shipped is not a broken reader');
  assert.equal(r.packet, null);
  assert.equal(r.reconciliation, null);
  assert.equal(r.packet_state, 'not_built');
  assert.equal(r.reconciliation_state, 'not_built');
  // It must not go looking in tables it has established do not exist.
  assert.equal(client.seen.length, 1);
});

test('a built table with no row reads as not_produced', async () => {
  const client = makeClient([TABLES_PRESENT]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.ok, true);
  assert.equal(r.packet, null);
  assert.equal(r.packet_state, 'not_produced');
});

test('a packet with no reconciliation degrades ONLY the reconciliation half', async () => {
  const client = makeClient([
    TABLES_PRESENT,
    { match: 'execution_packet', rows: [{ shop_id: 1, payload: packetDoc() }] }
  ]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.packet_state, 'produced');
  assert.equal(r.reconciliation, null);
  assert.equal(r.reconciliation_state, 'not_produced');
});

test('naming no shop is refused rather than guessed at', async () => {
  const r = await RP.readPacket({ client: makeClient([TABLES_PRESENT]) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'no_shop');
});

// =====================================================================
// The packet
// =====================================================================

test('lines are presented in ARRAY ORDER - the reader never re-sorts', async () => {
  const doc = packetDoc();
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: doc }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.deepEqual(
    r.packet.lines.map((l) => l.canonical_product_name_display),
    ['Example Brand Oat Drink 1L', 'Zebra Sample Thing']
  );
  assert.equal(r.packet.sort_verified, true);
});

test('a packet whose declared sort is a LIE is reported, not silently corrected', async () => {
  const doc = packetDoc();
  doc.lines = [doc.lines[1], doc.lines[0]]; // zebra before example - out of order
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: doc }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.packet.sort_verified, false, 'a mis-sorted packet must be visible');
  assert.equal(r.packet.sort_first_break_display, '2');
  // and NOT reordered behind Warwick's back
  assert.equal(r.packet.lines[0].canonical_product_name_display, 'Zebra Sample Thing');
});

test('a NULL brand sorts last and is not treated as out of order', () => {
  const check = RP._internal.checkSort([
    { normalized_brand: 'aaa', canonical_product_name: 'a' },
    { normalized_brand: 'zzz', canonical_product_name: 'z' },
    { brand: null, canonical_product_name: 'no brand' }
  ]);
  assert.equal(check.ok, true);
});

test('a NULL brand appearing BEFORE a branded line is out of order', () => {
  const check = RP._internal.checkSort([
    { brand: null, canonical_product_name: 'no brand' },
    { normalized_brand: 'aaa', canonical_product_name: 'a' }
  ]);
  assert.equal(check.ok, false);
});

test('applied_rules and quantity_rationale are surfaced - the point of the view', async () => {
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: packetDoc() }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  const first = r.packet.lines[0];
  assert.equal(first.has_applied_rules, true);
  assert.deepEqual(first.applied_rules, ['1']);
  assert.equal(first.has_quantity_rationale, true);
  assert.match(first.quantity_rationale_display, /rounds up to 2/);
});

test('a MISSING quantity rationale is shown as missing, never invented', async () => {
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: packetDoc() }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  const second = r.packet.lines[1];
  assert.equal(second.has_quantity_rationale, false);
  assert.equal(second.quantity_rationale_display, 'unknown');
  assert.equal(second.has_applied_rules, false);
});

test('known and genuinely-new lines are distinguishable without reading prose', async () => {
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: packetDoc() }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.packet.lines[0].is_known, true);
  assert.equal(r.packet.lines[0].is_new, false);
  assert.equal(r.packet.lines[1].is_new, true);
  assert.equal(r.packet.new_items_count_display, '1');
  assert.equal(r.packet.known_items_count_display, '1');
});

test('a KNOWN line with no catalogue id is flagged, not rendered as fine', async () => {
  const doc = packetDoc();
  doc.lines[0].canonical_product_id = null; // schema-invalid: known requires it
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: doc }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.packet.lines[0].identity_incomplete, true);
  assert.equal(r.packet.identity_incomplete_count_display, '1');
});

test('held lines are carried, so nothing is silently dropped', async () => {
  const client = makeClient([TABLES_PRESENT, { match: 'execution_packet', rows: [{ payload: packetDoc() }] }]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.equal(r.packet.held_count_display, '1');
  assert.equal(r.packet.held[0].reason_meaning, 'waiting on an answer from you');
});

test('an EMPTY packet is not the same fact as an ABSENT one', async () => {
  const client = makeClient([
    TABLES_PRESENT,
    { match: 'execution_packet', rows: [{ payload: packetDoc({ lines: [], held: [] }) }] }
  ]);
  const r = await RP.readPacket({ shop: 1, client: client });
  assert.notEqual(r.packet, null, 'a produced-but-empty packet must not collapse to null');
  assert.equal(r.packet_state, 'produced');
  assert.equal(r.packet.lines_count_display, '0', 'a MEASURED zero prints as 0');
});

// =====================================================================
// Reconciliation - ruling section 3
// =====================================================================

function reconDoc(over) {
  return Object.assign({
    reconciliation_version: 1,
    shop_ref: 'SHOP-2026-01-01',
    reconciled_at: '2026-01-01T18:00:00Z',
    expected_distinct_products: 2, expected_total_units: 3,
    actual_distinct_products: 2, actual_total_units: 3,
    checkout_performed: false, payment_performed: false, slot_booked: false,
    lines: [
      { seq: 1, canonical_product_name: 'Example Brand Oat Drink 1L', expected_quantity: 2,
        actual_quantity: 2, identity_match: 'exact', quantity_match: 'exact' },
      { seq: 2, canonical_product_name: 'Zebra Sample Thing', expected_quantity: 1,
        actual_quantity: 1, identity_match: 'exact', quantity_match: 'exact' }
    ],
    unavailable: [], unexpected: []
  }, over || {});
}
const withRecon = (doc) => makeClient([
  TABLES_PRESENT,
  { match: 'execution_packet', rows: [{ payload: packetDoc() }] },
  { match: 'basket_reconciliation', rows: [{ payload: doc }] }
]);

test('a genuinely clean reconciliation reads as fully reconciled', async () => {
  const r = await RP.readPacket({ shop: 1, client: withRecon(reconDoc()) });
  assert.equal(r.reconciliation.fully_reconciled, true);
  assert.equal(r.reconciliation.no_purchase_action_confirmed, true);
});

// THE RULING SECTION 3 CASE, and the reason this module computes the verdict
// rather than leaving it to a template.
test('MATCHING HEADLINE COUNTS with a wrong product is NOT reconciled', async () => {
  const doc = reconDoc();
  doc.lines[1].identity_match = 'different_product';
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.distinct_products_match, true, 'the headline counts DO agree');
  assert.equal(r.reconciliation.total_units_match, true);
  assert.equal(r.reconciliation.fully_reconciled, false, 'but the basket is wrong, so this must be false');
  assert.equal(r.reconciliation.counts_agree_but_lines_do_not, true);
  assert.equal(r.reconciliation.mismatched_lines_count_display, '1');
});

test('a wrong QUANTITY with matching counts is also not reconciled', async () => {
  const doc = reconDoc();
  doc.lines[0].quantity_match = 'short';
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.fully_reconciled, false);
  assert.equal(r.reconciliation.counts_agree_but_lines_do_not, true);
});

test('an UNCHECKED purchase action never reads as a reassuring no', async () => {
  const r = await RP.readPacket({ shop: 1, client: withRecon(reconDoc({ checkout_performed: null })) });
  assert.equal(r.reconciliation.checkout_performed.display, 'not confirmed');
  assert.equal(r.reconciliation.checkout_performed.value, null);
  assert.equal(r.reconciliation.no_purchase_action_confirmed, false,
    'unknown must not satisfy the no-purchase confirmation');
});

test('a checkout that DID happen is reported plainly', async () => {
  const r = await RP.readPacket({ shop: 1, client: withRecon(reconDoc({ checkout_performed: true })) });
  assert.equal(r.reconciliation.checkout_performed.display, 'yes');
  assert.equal(r.reconciliation.no_purchase_action_confirmed, false);
});

test('unavailable items are carried and never described as substituted', async () => {
  const doc = reconDoc({ unavailable: [{ original_list_line: 'placeholder juice', reason: 'out_of_stock' }] });
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.unavailable_count_display, '1');
  assert.equal(r.reconciliation.unavailable[0].reason_meaning, 'out of stock');
  assert.ok(!JSON.stringify(r.reconciliation).toLowerCase().includes('substitut'),
    'substitution is not a permitted outcome anywhere in this product');
});

test('an unexpected basket item is surfaced - a count alone hides it', async () => {
  const doc = reconDoc({ unexpected: [{ canonical_product_name: 'Something Nobody Asked For', actual_quantity: 1 }] });
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.unexpected_count_display, '1');
  assert.equal(r.reconciliation.unexpected[0].canonical_product_name_display, 'Something Nobody Asked For');
});

test('a missing actual count reads as unknown, never as 0', async () => {
  const doc = reconDoc({ actual_total_units: null, actual_distinct_products: null });
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.actual_total_units_display, 'unknown');
  assert.equal(r.reconciliation.total_units_match, false, 'unknown must never satisfy a match');
  assert.equal(r.reconciliation.fully_reconciled, false);
});

test('a MEASURED zero still prints as 0', async () => {
  const doc = reconDoc({ actual_total_units: 0, actual_distinct_products: 0 });
  const r = await RP.readPacket({ shop: 1, client: withRecon(doc) });
  assert.equal(r.reconciliation.actual_total_units_display, '0');
});

// =====================================================================
// Transaction discipline
// =====================================================================

test('an injected client is used as-is - the reader opens no transaction over one', async () => {
  const client = makeClient([TABLES_PRESENT]);
  await RP.readPacket({ shop: 1, client: client });
  const stmts = client.seen.map((s) => s.sql);
  assert.equal(stmts.filter((s) => s === 'BEGIN TRANSACTION READ ONLY').length, 0);
  assert.equal(stmts.filter((s) => s === 'COMMIT').length, 0);
});
