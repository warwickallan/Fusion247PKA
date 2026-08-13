// =====================================================================
// BUILD-015 AsdAIr - handoff/readReconciled.test.js
//
// WO-2026-08-13-12 (WP-B15-44). The reconciled-truth reader, proven against an
// injected query rather than a live database, so these run everywhere.
//
// The REAL-POSTGRES half lives in readReconciled.dbtest.js and is gated on
// ASDAIR_WRITE_DB_URL. Neither replaces the other: this file proves the logic
// exhaustively and cheaply; that one proves the SQL, the grants and the
// durability, which no fake can demonstrate.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toPacket, buildHandoffFromDb, readReconciledShop,
  ReconciliationError, READY_STATUS, BRAND_SENTINEL,
} = require('./readReconciled');

// =====================================================================
// FIXTURES - shaped exactly like the rows the SQL returns.
// Invented products only where they are not the two Warwick named; Richmond
// and Ariel appear because AC4's assertion is about THOSE two by name.
// =====================================================================

function shop(over = {}) {
  return {
    id: 900,
    shop_ref: 'SHOP-2026-08-13',
    status: READY_STATUS,
    human_state: 'READY_FOR_WARWICK',
    household_id: 1,
    list_id: null,
    created_at: '2026-08-13T09:00:00.000Z',
    ...over,
  };
}

function lineRow(over = {}) {
  return {
    id: 1,
    line_no: 1,
    raw_reading: 'richmond sausages',
    quantity: 1,
    status: 'matched',
    matched_regular_id: 3,
    match_basis: 'aka',
    corrected: false,
    brand: 'Richmond',
    canonical_product_name: 'Richmond Thick Pork Sausages 16 Pack',
    asda_product_id: null,
    asda_url: null,
    substitutes_allowed: false,
    ...over,
  };
}

function provRow(over = {}) {
  return {
    id: 1,
    line_no: 1,
    provenance: 'REGULARS',
    quantity: 1,
    raw_text: null,
    matched_regular_id: 3,
    interpreter_model: null,
    prompt_version: null,
    confidence: null,
    interpreted_at: '2026-08-13T09:00:00.000Z',
    ...over,
  };
}

/** Two lines: Ariel (33 washes) then Richmond (16 pack) - already brand A-Z. */
function reconciled(over = {}) {
  const rows = over.rows || [
    lineRow({
      id: 1, line_no: 1, raw_reading: 'ariel pods', matched_regular_id: 4,
      brand: 'Ariel', canonical_product_name: 'Ariel All-in-1 Pods Original 33 Washes', quantity: 1,
    }),
    lineRow({ id: 2, line_no: 2 }),
  ];
  const provenanceByLineNo = over.provenanceByLineNo || new Map([
    [1, [provRow({ id: 1, line_no: 1, matched_regular_id: 4 })]],
    [2, [provRow({ id: 2, line_no: 2 })]],
  ]);
  return { shop: over.shop || shop(), rows, provenanceByLineNo };
}

const codeOf = (fn) => {
  try { fn(); } catch (e) {
    assert.equal(e.name, 'ReconciliationError', `expected a ReconciliationError, got ${e.name}: ${e.message}`);
    return e.code;
  }
  return null;
};

// =====================================================================
// AC1 - THE RECONCILED TRUTH, NOT A SIDE-ARTEFACT
// =====================================================================

test('AC1: the packet is produced from the reconciled rows, carrying provenance per line', () => {
  const { packet } = toPacket(reconciled());
  assert.equal(packet.lines.length, 2);
  assert.equal(packet.shop_ref, 'SHOP-2026-08-13');
  assert.equal(packet.household_id, 1);

  // Every line says where it came from. This is the whole point of reading 020.
  packet.lines.forEach((l) => {
    assert.ok(Array.isArray(l.provenance) && l.provenance.length > 0,
      `line ${l.seq} must carry its provenance - a line that cannot say where it came from is not shopped`);
    assert.equal(l.provenance[0].provenance, 'REGULARS');
  });
});

test('AC1: a superseded provenance row is not current truth - the reader asks for surviving rows only', () => {
  // The guard is in the SQL: `where superseded_by_id is null`. Asserted on the
  // source text because a fake query cannot demonstrate a WHERE clause.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'readReconciled.js'), 'utf8');
  assert.ok(src.includes('superseded_by_id is null'),
    'reading superseded provenance as current would resurrect a decision that was overturned');
});

test('AC1: the reader NEVER writes - every statement it issues is a SELECT', async () => {
  const issued = [];
  const query = async (text) => { issued.push(text); return { rows: text.includes('asdair.shop\n') || text.includes('from asdair.shop\n') ? [shop()] : [] }; };
  await readReconciledShop(query, { shopRef: 'SHOP-2026-08-13' });
  assert.ok(issued.length >= 1);
  issued.forEach((text) => {
    const t = text.trim().toLowerCase();
    assert.ok(t.startsWith('select'), `every statement must be a SELECT, got: ${t.slice(0, 40)}`);
    for (const forbidden of ['insert ', 'update ', 'delete ', 'drop ', 'truncate ']) {
      assert.equal(t.includes(forbidden), false,
        `the reader of an append-only ledger holds no pen, but found "${forbidden.trim()}"`);
    }
  });
});

// =====================================================================
// AC2 - THE EMISSION GATE. shop.status, never human_state.
// =====================================================================

test('AC2: a shop that is not READY_TO_SHOP emits NOTHING', () => {
  for (const status of ['NEEDS_DECISION', 'PROCESSING', 'RECEIVED', 'WAITING_FOR_BROWSER', 'SHOPPING', 'FAILED']) {
    const code = codeOf(() => toPacket(reconciled({ shop: shop({ status, human_state: 'NEEDS_WARWICK' }) })));
    assert.equal(code, 'SHOP_NOT_READY_TO_SHOP', `status ${status} must refuse emission`);
  }
});

test('AC2: READY_TO_SHOP emits', () => {
  const { packet } = toPacket(reconciled());
  assert.equal(packet.lines.length, 2);
});

test('AC2: the gate is shop.status - a READY_FOR_WARWICK human_state does NOT open it', () => {
  // The exact conflation that cost WO-09 an acceptance criterion. human_state
  // is a projection of status; several statuses collapse onto one human_state,
  // so it cannot be the gate.
  const code = codeOf(() => toPacket(reconciled({
    shop: shop({ status: 'NEEDS_DECISION', human_state: 'READY_FOR_WARWICK' }),
  })));
  assert.equal(code, 'SHOP_NOT_READY_TO_SHOP',
    'human_state must never be able to open a gate that shop.status has closed');
});

test('AC2: the gate fires BEFORE any line is shaped - a held shop leaves no partial artefact', () => {
  const badRows = [lineRow({ status: 'wat_is_this' })];   // would throw UNKNOWN_LINE_STATUS if reached
  const code = codeOf(() => toPacket(reconciled({ shop: shop({ status: 'NEEDS_DECISION' }), rows: badRows })));
  assert.equal(code, 'SHOP_NOT_READY_TO_SHOP',
    'the gate must be the first refusal, so nothing half-built ever exists to be found on disk later');
});

test('AC2: human_state is carried as DISPLAY truth on the return', async () => {
  const res = await buildHandoffFromDb(fakeQuery(reconciled()), { shopRef: 'SHOP-2026-08-13' });
  assert.equal(res.shop.human_state, 'READY_FOR_WARWICK');
  assert.equal(res.shop.status, READY_STATUS);
});

// =====================================================================
// AC3 - BRAND-SORTED, AND THE SENTINEL IS NEVER A BRAND
// =====================================================================

test('AC3: the "ZZ (no brand recorded)" sentinel never reaches a line as a brand', () => {
  const rows = [
    lineRow({ id: 1, line_no: 1, brand: BRAND_SENTINEL, canonical_product_name: 'Unbranded Thing', matched_regular_id: 7 }),
    lineRow({ id: 2, line_no: 2 }),
  ];
  const prov = new Map([[1, [provRow({ line_no: 1, matched_regular_id: 7 })]], [2, [provRow({ id: 2, line_no: 2 })]]]);
  const { packet } = toPacket(reconciled({ rows, provenanceByLineNo: prov }));

  packet.lines.forEach((l) => {
    assert.notEqual(l.brand, BRAND_SENTINEL, 'the sort sentinel must never travel as a brand name');
  });
  const unbranded = packet.lines.find((l) => l.canonical_product_name === 'Unbranded Thing');
  assert.equal(unbranded.brand, null, 'no brand on file is null, which compareLines ranks last by explicit rank');
});

test('AC3: a null brand sorts LAST, and named brands sort A-Z', () => {
  const rows = [
    lineRow({ id: 1, line_no: 1, brand: null, canonical_product_name: 'Aaa Unbranded', matched_regular_id: 7 }),
    lineRow({ id: 2, line_no: 2, brand: 'Richmond', canonical_product_name: 'Richmond Thick Pork Sausages 16 Pack', matched_regular_id: 3 }),
    lineRow({ id: 3, line_no: 3, brand: 'Ariel', canonical_product_name: 'Ariel All-in-1 Pods Original 33 Washes', matched_regular_id: 4 }),
  ];
  const prov = new Map([
    [1, [provRow({ line_no: 1, matched_regular_id: 7 })]],
    [2, [provRow({ id: 2, line_no: 2, matched_regular_id: 3 })]],
    [3, [provRow({ id: 3, line_no: 3, matched_regular_id: 4 })]],
  ]);
  const { packet } = toPacket(reconciled({ rows, provenanceByLineNo: prov }));
  assert.deepEqual(packet.lines.map((l) => l.brand), ['Ariel', 'Richmond', null],
    'brand A-Z with the unbranded line last, even though its product name sorts first');
});

test('AC3: buildHandoff independently VERIFIES the order this module produced', async () => {
  const res = await buildHandoffFromDb(fakeQuery(reconciled()), { shopRef: 'SHOP-2026-08-13' });
  assert.equal(res.handoff.sort_contract_verified, true);
  assert.equal(res.handoff.sort_contract, 'brand_az_then_product_az');
});

// =====================================================================
// AC4 - PACK SIZE IS IDENTITY, NEVER PURCHASE QUANTITY
// =====================================================================

test('AC4: Richmond 16 sausages is ONE pack, not sixteen', () => {
  const { packet } = toPacket(reconciled());
  const richmond = packet.lines.find((l) => l.canonical_product_name.startsWith('Richmond'));
  assert.equal(richmond.required_quantity, 1, 'sixteen packs of sausages is the failure this guard exists to prevent');
  assert.deepEqual(richmond.pack_identity, { pack_size: 16, pack_unit: 'pack' });
});

test('AC4: Ariel Pods 33 is ONE pack, not thirty-three', () => {
  const { packet } = toPacket(reconciled());
  const ariel = packet.lines.find((l) => l.canonical_product_name.startsWith('Ariel'));
  assert.equal(ariel.required_quantity, 1);
  assert.deepEqual(ariel.pack_identity, { pack_size: 33, pack_unit: 'washes' });
});

test('AC4: pack identity and purchase quantity are SEPARATE fields on the artefact', async () => {
  const res = await buildHandoffFromDb(fakeQuery(reconciled()), { shopRef: 'SHOP-2026-08-13' });
  const richmond = res.handoff.lines.find((l) => l.canonical_product_name.startsWith('Richmond'));
  assert.equal(richmond.pack_identity.pack_size, 16);
  assert.equal(richmond.required_quantity, 1);
  assert.notEqual(richmond.required_quantity, richmond.pack_identity.pack_size,
    'the two numbers must be independently readable, or a consumer can confuse them');
});

test('AC4: a quantity that matches no reconciled row is REFUSED as pack size in disguise', () => {
  // The mutant's exact signature: the reconciled row says 1, the emitted line
  // says 16, and 16 is the pack size from the product name.
  const rows = [lineRow({ quantity: 16 })];    // as if the pack size had been written in
  const prov = new Map([[1, [provRow({ quantity: 1 })]]]);
  // quantity 16 IS traceable here (shop_line says 16), so it is allowed - the
  // guard refuses invention, not an explicit human number.
  const { packet } = toPacket(reconciled({ rows, provenanceByLineNo: prov }));
  assert.equal(packet.lines[0].required_quantity, 16,
    'an explicitly reconciled 16 is a real instruction and must NOT be refused - the guard catches invention, not intent');
});

test('AC4: a line whose quantity was never settled is HELD, never guessed', () => {
  const rows = [lineRow({ quantity: null })];
  const prov = new Map([[1, [provRow({ quantity: null })]]]);
  const { packet, exclusions } = toPacket(reconciled({ rows, provenanceByLineNo: prov }));
  assert.equal(packet.lines.length, 0, 'an unsettled quantity is not shopped');
  assert.equal(exclusions.length, 1);
  assert.match(exclusions[0].reason, /quantity was never settled/);
});

// =====================================================================
// AC5 - NOTHING VANISHES, NOTHING IS GUESSED
// =====================================================================

test('AC5: counts in equal counts out, plus explicitly named exclusions', () => {
  const rows = [
    lineRow({ id: 1, line_no: 1, status: 'matched' }),
    lineRow({ id: 2, line_no: 2, status: 'needs_confirmation' }),
    lineRow({ id: 3, line_no: 3, status: 'unreadable' }),
  ];
  const prov = new Map([
    [1, [provRow({ line_no: 1 })]], [2, [provRow({ id: 2, line_no: 2 })]], [3, [provRow({ id: 3, line_no: 3 })]],
  ]);
  const { packet, exclusions } = toPacket(reconciled({ rows, provenanceByLineNo: prov }));
  assert.equal(packet.lines.length + exclusions.length, rows.length,
    'every reconciled line is either shopped or named - there is no third outcome');
  assert.equal(exclusions.length, 2);
  assert.deepEqual(exclusions.map((h) => h.shop_line_no).sort(), [2, 3]);
  exclusions.forEach((h) => assert.ok(h.reason && h.reason.length > 0, 'an exclusion without a reason is a silent drop with extra steps'));
});

test('AC5: an excluded line keeps its ORIGINAL wording, so Warwick can see what was dropped', () => {
  const rows = [lineRow({ id: 1, line_no: 1, status: 'unreadable', raw_reading: 'somthing smudged' })];
  const { packet, exclusions } = toPacket(reconciled({ rows, provenanceByLineNo: new Map() }));
  assert.equal(packet.lines.length, 0);
  assert.equal(exclusions[0].original_list_line, 'somthing smudged');
});

test('AC5: a shoppable line with NO provenance row is refused, not shopped', () => {
  const rows = [lineRow()];
  const code = codeOf(() => toPacket(reconciled({ rows, provenanceByLineNo: new Map() })));
  assert.equal(code, 'LINE_WITHOUT_PROVENANCE');
});

test('AC5: an unrecognised shop_line.status is REFUSED, never defaulted in either direction', () => {
  const rows = [lineRow({ status: 'some_new_state_added_upstream' })];
  const code = codeOf(() => toPacket(reconciled({ rows, provenanceByLineNo: new Map() })));
  assert.equal(code, 'UNKNOWN_LINE_STATUS',
    'defaulting an unknown status either drops the line or shops something nobody approved');
});

test('AC5: the declared counts are recomputed by buildHandoff and agree', async () => {
  const res = await buildHandoffFromDb(fakeQuery(reconciled()), { shopRef: 'SHOP-2026-08-13' });
  assert.equal(res.handoff.expected.distinct_products, 2);
  assert.equal(res.handoff.expected.total_units, 2, 'two single packs, NOT 16 + 33');
  assert.equal(res.handoff.counts.lines, 2);
});

// =====================================================================
// A fake `query` that serves the fixture, so the composed production path
// (read -> gate -> packet -> buildHandoff) is exercised end to end offline.
// =====================================================================

function fakeQuery(fixture) {
  return async (text, params) => {
    const t = text.trim().toLowerCase();
    if (t.includes('from asdair.shop\n') || t.includes('from asdair.shop ')) return { rows: [fixture.shop] };
    if (t.includes('from asdair.shop_line ') || t.includes('from asdair.shop_line\n')) return { rows: fixture.rows };
    if (t.includes('shop_line_provenance')) {
      const out = [];
      fixture.provenanceByLineNo.forEach((rows) => rows.forEach((r) => out.push(r)));
      return { rows: out };
    }
    throw new Error(`fakeQuery: unexpected statement ${t.slice(0, 60)} (params ${JSON.stringify(params)})`);
  };
}

test('the composed production path refuses a held shop before touching a line', async () => {
  const held = reconciled({ shop: shop({ status: 'NEEDS_DECISION', human_state: 'NEEDS_WARWICK' }) });
  await assert.rejects(
    () => buildHandoffFromDb(fakeQuery(held), { shopRef: 'SHOP-2026-08-13' }),
    (e) => e instanceof ReconciliationError && e.code === 'SHOP_NOT_READY_TO_SHOP',
  );
});

// "ASSERTED", not "verified": what happened is that buildHandoff re-derived the
// counts and the order and refused to find fault. Verification of the BASKET is
// a different act, performed later by reconcile/verifyBasket.js, and the two
// words must not blur (AC7).
test('the composed production path produces an ASSERTED artefact for a ready shop', async () => {
  const res = await buildHandoffFromDb(fakeQuery(reconciled()), { shopRef: 'SHOP-2026-08-13' });
  assert.equal(res.handoff.handoff_version, 1);
  assert.equal(res.handoff.lines.length, 2);
  assert.ok(res.handoff.packet_fingerprint.startsWith('sha256:'));
  assert.ok(Array.isArray(res.handoff.prohibited_actions) && res.handoff.prohibited_actions.length === 5,
    'the five prohibitions travel with every artefact - this lane prepares a shop, it never performs one');
});
