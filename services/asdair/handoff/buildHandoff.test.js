// =====================================================================
// BUILD-015 AsdAIr - handoff/buildHandoff.test.js
//
// The artefact must be IDEMPOTENT, must ASSERT the sort contract rather than
// trust it, and must never let a known item reach a free search.
//
// FULLY OFFLINE. No database, no network, no model, no credentials.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHandoff, PacketContractError, normalizeSortKey, identityKey, _internal } = require('./buildHandoff');
const { renderChecklist } = require('./renderChecklist');
const { fingerprintPacket } = require('./fingerprint');
const { basePacket, line } = require('./test/fixtures');

// The boundaries, held as a LITERAL IN THIS TEST FILE rather than imported from
// the source it checks. Deleting a prohibition from instructions.js must fail
// here; if this list were imported, deleting one would quietly agree with
// itself. RUNTIME-DECISION.md is the authority for the five.
const REQUIRED_PROHIBITIONS = [
  'no_checkout', 'no_payment', 'no_delivery_slot', 'no_password_entry', 'no_automatic_substitution',
];

const codeOf = (fn) => {
  try { fn(); } catch (e) {
    assert.ok(e instanceof PacketContractError, `expected PacketContractError, got ${e && e.name}: ${e && e.message}`);
    return e.code;
  }
  assert.fail('expected a PacketContractError, none was thrown');
  return null;
};

// ---------------------------------------------------------------------
// IDEMPOTENCY
// ---------------------------------------------------------------------

test('IDEMPOTENT: the same packet always produces a byte-identical artefact', () => {
  const p = basePacket();
  const a = buildHandoff(p);
  const b = buildHandoff(basePacket());
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'artefact is not byte-stable - something non-deterministic leaked in');
  assert.equal(a.packet_fingerprint, b.packet_fingerprint);
});

test('IDEMPOTENT: no clock. Building twice a second apart cannot differ', async () => {
  const first = buildHandoff(basePacket());
  await new Promise((r) => setTimeout(r, 25));
  const second = buildHandoff(basePacket());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.generated_at, '2026-08-09T09:00:00.000Z', 'generated_at must come from the PACKET, never from a clock');
});

test('IDEMPOTENT: buildHandoff never mutates the packet it was given', () => {
  const p = basePacket();
  const before = JSON.stringify(p);
  const h = buildHandoff(p);
  h.lines[0].required_quantity = 999;
  h.lines[0].canonical_product_name = 'tampered';
  assert.equal(JSON.stringify(p), before, 'the packet was mutated');
});

test('FINGERPRINT: key ORDER does not change it, but any VALUE does', () => {
  const p = basePacket();
  const reordered = { lines: p.lines, shop_ref: p.shop_ref, packet_version: p.packet_version, generated_at: p.generated_at, household_id: p.household_id, sort_contract: p.sort_contract, expected_total_units: p.expected_total_units, expected_distinct_products: p.expected_distinct_products, held: p.held };
  assert.equal(fingerprintPacket(p), fingerprintPacket(reordered), 'key order must not change identity');

  const changed = basePacket();
  changed.lines[0].required_quantity = 5;
  changed.expected_total_units = 10;
  assert.notEqual(fingerprintPacket(p), fingerprintPacket(changed), 'a changed quantity MUST change identity, or supersession cannot be detected');
});

test('FINGERPRINT: array order is meaningful and is NOT normalised away', () => {
  const p = basePacket();
  const swapped = basePacket();
  const tmp = swapped.lines[0];
  swapped.lines[0] = swapped.lines[1];
  swapped.lines[1] = tmp;
  assert.notEqual(fingerprintPacket(p), fingerprintPacket(swapped), 'reordering the lines must change identity - the order IS the contract');
});

// ---------------------------------------------------------------------
// THE SORT CONTRACT IS ASSERTED, NOT TRUSTED
// ---------------------------------------------------------------------

test('SORT: a mis-ordered packet is REFUSED even though it DECLARES the contract', () => {
  const p = basePacket();
  const tmp = p.lines[0];                       // acme
  p.lines[0] = { ...p.lines[1], seq: 1 };       // brava first
  p.lines[1] = { ...tmp, seq: 2 };              // acme second
  assert.equal(p.sort_contract, 'brand_az_then_product_az', 'fixture must still DECLARE the contract it violates');
  assert.equal(codeOf(() => buildHandoff(p)), 'SORT_CONTRACT_VIOLATED');
});

test('SORT: the order is verified even when sort_contract is ABSENT (it is optional in the schema)', () => {
  const ok = basePacket();
  delete ok.sort_contract;
  const h = buildHandoff(ok);
  assert.equal(h.sort_contract_declared, false);
  assert.equal(h.sort_contract_verified, true);

  const bad = basePacket();
  delete bad.sort_contract;
  const tmp = bad.lines[0];
  bad.lines[0] = { ...bad.lines[1], seq: 1 };
  bad.lines[1] = { ...tmp, seq: 2 };
  assert.equal(codeOf(() => buildHandoff(bad)), 'SORT_CONTRACT_VIOLATED',
    'an UNDECLARED packet must still have its actual order checked, or the assertion is trust in disguise');
});

test('SORT: a sort_contract this consumer cannot verify is refused, not assumed', () => {
  const p = basePacket({ sort_contract: 'category_then_aisle' });
  assert.equal(codeOf(() => buildHandoff(p)), 'UNKNOWN_SORT_CONTRACT');
});

test('SORT: a NULL brand sorts LAST, and a packet that puts it first is refused', () => {
  const p = basePacket();
  const nullBrand = { ...p.lines[3], seq: 1 };
  p.lines = [nullBrand, { ...p.lines[0], seq: 2 }, { ...p.lines[1], seq: 3 }, { ...p.lines[2], seq: 4 }];
  assert.equal(codeOf(() => buildHandoff(p)), 'SORT_CONTRACT_VIOLATED');
});

test('SORT: within one brand, product name A-Z is enforced', () => {
  const p = basePacket({
    expected_distinct_products: 2,
    expected_total_units: 2,
    held: [],
    lines: [
      line({ seq: 1, canonical_product_id: 21, canonical_product_name: 'Zucchini Soup', brand: 'Acme', normalized_brand: 'acme', asda_product_ref: '2000001' }),
      line({ seq: 2, canonical_product_id: 22, canonical_product_name: 'Apple Sauce', brand: 'Acme', normalized_brand: 'acme', asda_product_ref: '2000002' }),
    ],
  });
  assert.equal(codeOf(() => buildHandoff(p)), 'SORT_CONTRACT_VIOLATED');
});

test('SORT: the comparison is codepoint-based, not locale-dependent', () => {
  assert.ok(_internal.compareLines({ normalized_brand: 'acme', canonical_product_name: 'a' }, { normalized_brand: 'brava', canonical_product_name: 'a' }) < 0);
  assert.ok(_internal.compareLines({ normalized_brand: null, brand: null, canonical_product_name: 'a' }, { normalized_brand: 'zzz', canonical_product_name: 'a' }) > 0, 'NULL brand must sort last');
});

// ---------------------------------------------------------------------
// THE RULES THAT PROTECT THE METHOD
// ---------------------------------------------------------------------

test('A KNOWN ITEM CAN NEVER BE SENT TO FREE SEARCH', () => {
  const p = basePacket();
  p.lines[0].source_view = 'search';
  assert.equal(codeOf(() => buildHandoff(p)), 'KNOWN_ITEM_SENT_TO_SEARCH');
});

test('A known item without an ASDA reference is refused - it would have to be searched for', () => {
  const p = basePacket();
  p.lines[0].asda_product_ref = null;
  assert.equal(codeOf(() => buildHandoff(p)), 'KNOWN_WITHOUT_ASDA_REF');

  const q = basePacket();
  q.lines[0].asda_product_ref = 'not-a-ref';
  assert.equal(codeOf(() => buildHandoff(q)), 'KNOWN_WITHOUT_ASDA_REF');
});

test('A new item without Warwick approved wording is refused - wording is NEVER invented', () => {
  const p = basePacket();
  p.lines[2].approved_search_term = null;
  assert.equal(codeOf(() => buildHandoff(p)), 'NEW_WITHOUT_APPROVED_TERM');
});

test('The declared reconciliation counts must agree with the packet content', () => {
  assert.equal(codeOf(() => buildHandoff(basePacket({ expected_distinct_products: 3 }))), 'EXPECTED_DISTINCT_MISMATCH');
  assert.equal(codeOf(() => buildHandoff(basePacket({ expected_total_units: 99 }))), 'EXPECTED_UNITS_MISMATCH');
});

// ---------------------------------------------------------------------
// OPERATING GUIDANCE IS CARRIED, NEVER AUTHORED (rule 38 and its kind)
// ---------------------------------------------------------------------

test('OPERATING GUIDANCE: the caller passes the asdair.rules row and its text is carried verbatim with its id', () => {
  // Stand-in wording. The point of the proof is that whatever the row says is
  // what appears - this module supplies no text of its own.
  const row = { id: 38, category: 'operating', rule_text: 'WHATEVER THE HOUSEHOLD SAYS HERE', active: true };
  const h = buildHandoff(basePacket(), { operatingRules: [row] });

  assert.deepEqual(h.operating_guidance, [{ rule_id: 38, text: 'WHATEVER THE HOUSEHOLD SAYS HERE', category: 'operating' }]);
  const md = renderChecklist(h);
  assert.ok(md.includes('WHATEVER THE HOUSEHOLD SAYS HERE'), 'the rule text must reach the checklist');
  assert.ok(md.includes('(rule 38)'), 'the rule id must travel with it so provenance is visible');
});

test('OPERATING GUIDANCE: no rule text is hardcoded anywhere in this module', () => {
  const h = buildHandoff(basePacket());
  assert.deepEqual(h.operating_guidance, [], 'with no rows passed there must be NO guidance - none may be built in');
  assert.ok(!renderChecklist(h).includes('Household rules for this shop'), 'an empty guidance block must not render');
});

test('OPERATING GUIDANCE: a malformed or inactive rule row is refused, never patched up', () => {
  const bad = [
    [{ id: 38, rule_text: '', active: true }, /rule_text/],
    [{ id: 38, active: true }, /rule_text/],
    [{ rule_text: 'x', active: true }, /id/],
    [{ id: 38, rule_text: 'x', active: false }, /not active/],
  ];
  for (const [row, re] of bad) {
    assert.throws(() => buildHandoff(basePacket(), { operatingRules: [row] }), re);
  }
});

test('OPERATING GUIDANCE: it does NOT enter the packet, and the method stays pinned', () => {
  const p = basePacket();
  const before = JSON.stringify(p);
  const h = buildHandoff(p, { operatingRules: [{ id: 38, rule_text: 'guidance', active: true }] });
  assert.equal(JSON.stringify(p), before, 'the packet must be untouched - its root is additionalProperties:false and stays closed');
  assert.deepEqual(h.method, buildHandoff(basePacket()).method, 'guidance must not be spliced into the fixed BROWSER_METHOD');
});

test('DISTINCT PRODUCTS COUNTS IDENTITIES, NOT LINES - matching the packet producer', () => {
  // services/asdair/packet/buildExecutionPacket.js counts distinct identityKey
  // values, deliberately, so that a list saying the same thing twice does not
  // report a false mismatch. Two lines, one identity => 2 lines, 1 distinct.
  const p = basePacket();
  p.lines[1].canonical_product_id = 11;              // same identity as line 1
  p.expected_distinct_products = 3;                  // 4 lines, 3 identities
  const h = buildHandoff(p);

  assert.equal(h.expected.distinct_products, 3);
  assert.equal(h.counts.lines, 4, 'the LINE count must still be visible - it is what Sonnet traverses');
  assert.equal(h.duplicate_identities.length, 1, 'a duplicate identity must be SURFACED, never silently absorbed');
  assert.deepEqual(h.duplicate_identities[0].seqs, [1, 2]);
});

test('A DUPLICATE IS A PRODUCER DEFECT (rule 3), reported to the shelf as STOP - never a choice Sonnet makes', () => {
  const p = basePacket();
  p.lines[1].canonical_product_id = 11;
  p.expected_distinct_products = 3;
  const h = buildHandoff(p);
  const d = h.duplicate_identities[0];

  assert.equal(d.rule, 3, 'the detector must name the rule that settles it: one product, one line');
  assert.deepEqual(d.quantities, [2, 3]);
  assert.equal(d.quantities_differ, true, 'differing quantities are the case rule 3 does NOT settle');

  const md = renderChecklist(h);
  assert.ok(md.includes('STOP - this packet has a defect'));
  assert.ok(/Do not decide at the shelf/.test(md), 'the shelf must never be asked to choose one-combined vs two-separate');
  assert.ok(/needs an answer from Warwick, not a guess/.test(md), 'the ambiguous case must be escalated, not resolved either way');
});

test('Equal-quantity duplicates are flagged too, but NOT as the ambiguous case', () => {
  const p = basePacket();
  p.lines[1].canonical_product_id = 11;
  p.lines[1].required_quantity = 2;                 // same as line 1
  p.expected_distinct_products = 3;
  p.expected_total_units = 6;
  const h = buildHandoff(p);
  assert.equal(h.duplicate_identities[0].quantities_differ, false);
  assert.ok(!/needs an answer from Warwick/.test(renderChecklist(h)));
  assert.ok(/STOP - this packet has a defect/.test(renderChecklist(h)), 'it is still a producer defect');
});

test('A declared distinct count that disagrees with the IDENTITIES is still refused', () => {
  const p = basePacket();
  p.lines[1].canonical_product_id = 11;
  // producer would say 3; leaving it at 4 must fail loudly
  assert.equal(codeOf(() => buildHandoff(p)), 'EXPECTED_DISTINCT_MISMATCH');
});

test('Identity precedence is id, then ASDA ref, then approved search term', () => {
  const { identityKey } = _internal;
  assert.equal(identityKey({ canonical_product_id: 7, asda_product_ref: '123', approved_search_term: 'x' }), 'id:7');
  assert.equal(identityKey({ canonical_product_id: null, asda_product_ref: '123', approved_search_term: 'x' }), 'ref:123');
  assert.equal(identityKey({ canonical_product_id: null, asda_product_ref: null, approved_search_term: ' Zenith Cocoa ' }), 'term:zenith cocoa');
});

test('seq must run 1..N with no gaps or repeats - Sonnet works them positionally', () => {
  const p = basePacket();
  p.lines[2].seq = 7;
  assert.equal(codeOf(() => buildHandoff(p)), 'BAD_SEQ_SEQUENCE');
});

test('An empty packet and a bad shop_ref are refused', () => {
  assert.equal(codeOf(() => buildHandoff(basePacket({ lines: [] }))), 'EMPTY_PACKET');
  assert.equal(codeOf(() => buildHandoff(basePacket({ shop_ref: 'shop-2026-08-09' }))), 'BAD_SHOP_REF');
  assert.equal(codeOf(() => buildHandoff(basePacket({ packet_version: 2 }))), 'BAD_PACKET_VERSION');
});

// ---------------------------------------------------------------------
// THE ARTEFACT ITSELF
// ---------------------------------------------------------------------

test('THE ARTEFACT CARRIES ALL FIVE PROHIBITIONS - pinned to a literal held in this test', () => {
  const h = buildHandoff(basePacket());
  const ids = h.prohibited_actions.map((p) => p.id).sort();
  assert.deepEqual(ids, REQUIRED_PROHIBITIONS.slice().sort(),
    'a prohibition was added or removed. RUNTIME-DECISION.md: these are Warwick gates and no change of runtime touches them.');
  for (const p of h.prohibited_actions) assert.ok(p.text.length > 10, `${p.id} has no readable text`);
});

test('The artefact carries the Brand A-Z ordering step BEFORE the traversal step', () => {
  const h = buildHandoff(basePacket());
  const orderStep = h.method.findIndex((s) => /Brand A-Z/.test(s));
  const traverseStep = h.method.findIndex((s) => /in the order given/.test(s));
  assert.ok(orderStep >= 0, 'the Brand A-Z instruction is missing');
  assert.ok(traverseStep > orderStep, 'ordering must be set BEFORE traversal begins');
  assert.ok(h.method.some((s) => /NEVER free-search a known item/.test(s)));
});

test('The artefact carries expectations, counts and the held lines', () => {
  const h = buildHandoff(basePacket());
  assert.deepEqual(h.expected, { distinct_products: 4, total_units: 7 });
  assert.deepEqual(h.counts, { lines: 4, known: 3, new_approved: 1, held: 1 });
  assert.equal(h.held.length, 1, 'held lines must be carried so nothing is silently dropped');
  assert.equal(h.lines[2].approved_search_term, 'Zenith Cocoa Drops 200g');
  assert.equal(h.lines[0].approved_search_term, null, 'a known line must carry NO search wording');
});

test('The artefact is JSON round-trippable - Sonnet consumes it as data', () => {
  const h = buildHandoff(basePacket());
  assert.deepEqual(JSON.parse(JSON.stringify(h)), h);
});

// ---------------------------------------------------------------------
// THE HUMAN RENDERING IS THE SAME ARTEFACT
// ---------------------------------------------------------------------

test('CHECKLIST: every line, every prohibition and the fingerprint appear', () => {
  const h = buildHandoff(basePacket());
  const md = renderChecklist(h);
  for (const l of h.lines) {
    assert.ok(md.includes(l.canonical_product_name), `checklist omits ${l.canonical_product_name}`);
    assert.ok(md.includes(l.original_list_line), `checklist omits what was written: ${l.original_list_line}`);
  }
  for (const p of h.prohibited_actions) assert.ok(md.includes(p.text), `checklist omits prohibition ${p.id}`);
  assert.ok(md.includes(h.packet_fingerprint), 'the fingerprint must be quotable from the phone');
  assert.ok(md.includes('4 products, 7 units'));
  assert.ok(md.includes('something unreadable'), 'held lines must be visible, not dropped');
});

test('CHECKLIST: search wording appears ONLY for the new item', () => {
  const md = renderChecklist(buildHandoff(basePacket()));
  const searchLines = md.split('\n').filter((s) => s.includes('SEARCH:'));
  assert.equal(searchLines.length, 1, 'exactly one line may carry a search instruction');
  assert.ok(searchLines[0].includes('Zenith Cocoa Drops 200g'));
  assert.ok(md.includes('REGULARS ref 1000001'));
  assert.ok(md.includes('FAVOURITES ref 1000002'));
});

test('CHECKLIST: deterministic - same artefact, same bytes', () => {
  const h = buildHandoff(basePacket());
  assert.equal(renderChecklist(h), renderChecklist(buildHandoff(basePacket())));
});
