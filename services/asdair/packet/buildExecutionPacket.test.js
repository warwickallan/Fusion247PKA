// =====================================================================
// BUILD-015 AsdAIr - packet/buildExecutionPacket.test.js
//
// Every produced packet here is validated against the COMMITTED contract
// loaded from the build folder - never hand-checked, and never against a
// copy vendored into this module. schemaAssert.test.js separately proves
// that validator actually rejects things.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExecutionPacket,
  normalizeSortKey,
  PacketError,
  SORT_CONTRACT,
  ORIGINS,
  SOURCE_VIEWS,
  HELD_REASONS,
  FORBIDDEN_HELD_REASON
} from './buildExecutionPacket.js';
import { assertValid, validate } from './schemaAssert.js';
import { SCHEMA } from './committedSchema.js';

const GENERATED_AT = '2026-08-04T09:00:00.000Z';
const SHOP_REF = 'SHOP-2026-08-03';

function known(overrides) {
  return Object.assign({
    original_list_line: 'milk 2',
    origin: 'known',
    canonical_product_id: 41,
    canonical_product_name: 'Semi Skimmed Milk 2L',
    brand: 'ASDA',
    source_view: 'regulars',
    asda_product_ref: '1000383091',
    required_quantity: 1
  }, overrides || {});
}

function newApproved(overrides) {
  return Object.assign({
    original_list_line: 'oat mlk',
    origin: 'new_approved',
    canonical_product_id: null,
    canonical_product_name: 'Oat Milk Barista 1L',
    brand: 'Oatly',
    source_view: 'search',
    approved_search_term: 'oatly barista oat drink 1l',
    required_quantity: 1
  }, overrides || {});
}

function build(lines, extra) {
  return buildExecutionPacket(Object.assign({
    shop_ref: SHOP_REF,
    generated_at: GENERATED_AT,
    household_id: 1,
    lines
  }, extra || {}));
}

// ---------------------------------------------------------------------
// The contract itself: this module's vocabularies must not drift from the
// committed schema. Pinned to the SCHEMA FILE, not to a literal restated
// in this test, so the assertion cannot rot alongside the code.
// ---------------------------------------------------------------------

test('the vocabularies in the producer match the COMMITTED schema exactly', () => {
  const line = SCHEMA.$defs.line.properties;
  assert.deepEqual(Array.from(ORIGINS), line.origin.enum);
  assert.deepEqual(Array.from(SOURCE_VIEWS), line.source_view.enum);
  assert.deepEqual(Array.from(HELD_REASONS), SCHEMA.$defs.heldLine.properties.reason.enum);
  assert.equal(SORT_CONTRACT, SCHEMA.properties.sort_contract.const);
});

test('SUBSTITUTION IS NEVER A PERMITTED OUTCOME: the held-reason enum has no "substituted" member', () => {
  // Asserted against the committed schema, so adding it there fails here.
  assert.ok(
    !SCHEMA.$defs.heldLine.properties.reason.enum.includes(FORBIDDEN_HELD_REASON),
    'the committed schema has grown a "substituted" held reason - substitution is not a permitted outcome anywhere in this product'
  );
  assert.ok(!HELD_REASONS.includes(FORBIDDEN_HELD_REASON));
  assert.throws(
    () => build([known({ hold: { reason: 'substituted' } }), known()]),
    (err) => err instanceof PacketError && /is not one of/.test(err.message)
  );
});

// ---------------------------------------------------------------------
// Schema validity of real output
// ---------------------------------------------------------------------

test('a mixed packet validates against the COMMITTED schema', () => {
  const packet = build([
    known(),
    newApproved(),
    known({
      original_list_line: 'picnic bars',
      canonical_product_id: 88,
      canonical_product_name: 'Picnic Chocolate Bar 4 Pack',
      brand: 'Cadbury',
      source_view: 'favourites',
      asda_product_ref: '910284',
      required_quantity: 4,
      applied_rules: [37],
      quantity_rationale: 'list said 3; rule 37 rounds up to 4 for the any-2-for-X offer',
      asda_url: 'https://groceries.asda.com/product/910284'
    }),
    known({ original_list_line: 'yazoo', hold: { reason: 'ambiguous', detail: 'two flavours in Regulars' } })
  ]);

  assertValid(SCHEMA, packet, 'packet');
  assert.equal(packet.packet_version, 1);
  assert.equal(packet.sort_contract, SORT_CONTRACT);
  assert.equal(packet.shop_ref, SHOP_REF);
  assert.equal(packet.generated_at, GENERATED_AT);
  assert.equal(packet.household_id, 1);
});

test('household_id is OMITTED rather than emitted null when unknown (the contract permits no null there)', () => {
  const packet = buildExecutionPacket({ shop_ref: SHOP_REF, generated_at: GENERATED_AT, lines: [known()] });
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'household_id'), false);
  assertValid(SCHEMA, packet, 'packet');
});

test('shop_line_no is OMITTED rather than null when unknown, and carried through when known', () => {
  const packet = build([known({ shop_line_no: 3 }), known({ original_list_line: 'bread' })]);
  const withNo = packet.lines.find((l) => l.original_list_line === 'milk 2');
  const without = packet.lines.find((l) => l.original_list_line === 'bread');
  assert.equal(withNo.shop_line_no, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(without, 'shop_line_no'), false);
  assertValid(SCHEMA, packet, 'packet');
});

test('the packet is deeply frozen and the caller\'s input is never mutated', () => {
  const input = [known({ applied_rules: [37] })];
  const snapshot = JSON.parse(JSON.stringify(input));
  const packet = build(input);
  assert.ok(Object.isFrozen(packet));
  assert.ok(Object.isFrozen(packet.lines));
  assert.ok(Object.isFrozen(packet.lines[0]));
  assert.ok(Object.isFrozen(packet.lines[0].applied_rules));
  assert.deepEqual(input, snapshot);
});

test('PURE: identical inputs produce an identical packet', () => {
  const a = build([known(), newApproved()]);
  const b = build([known(), newApproved()]);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------
// THE SORT - the entire speed argument
// ---------------------------------------------------------------------

test('normalizeSortKey is explicit, deterministic and case/punctuation insensitive', () => {
  assert.equal(normalizeSortKey('  ASDA  '), 'asda');
  assert.equal(normalizeSortKey("Sainsbury's"), 'sainsbury s');
  assert.equal(normalizeSortKey('Coca-Cola'), 'coca cola');
  assert.equal(normalizeSortKey('M&S'), 'm s');
  assert.equal(normalizeSortKey("WALL'S"), 'wall s');
  assert.equal(normalizeSortKey(null), null);
  assert.equal(normalizeSortKey(undefined), null);
  assert.equal(normalizeSortKey('   '), null);
  assert.equal(normalizeSortKey('---'), null, 'a brand that normalizes away to nothing must sort as NULL, not as an empty string that sorts FIRST');
});

test('lines sort by normalized brand A-Z, then canonical product name A-Z, with NULL brand LAST', () => {
  const packet = build([
    known({ brand: null, canonical_product_name: 'Zebra Cakes', original_list_line: 'zebra', canonical_product_id: 1, asda_product_ref: '111' }),
    known({ brand: 'walkers', canonical_product_name: 'Ready Salted', original_list_line: 'crisps', canonical_product_id: 2, asda_product_ref: '222' }),
    known({ brand: 'ASDA', canonical_product_name: 'Butter', original_list_line: 'butter', canonical_product_id: 3, asda_product_ref: '333' }),
    known({ brand: null, canonical_product_name: 'Apples', original_list_line: 'apples', canonical_product_id: 4, asda_product_ref: '444' }),
    known({ brand: 'asda', canonical_product_name: 'Apples Bramley', original_list_line: 'bramleys', canonical_product_id: 5, asda_product_ref: '555' })
  ]);

  assert.deepEqual(
    packet.lines.map((l) => l.canonical_product_name),
    ['Apples Bramley', 'Butter', 'Ready Salted', 'Apples', 'Zebra Cakes']
  );
  // seq is the position in the SORTED order, 1..N
  assert.deepEqual(packet.lines.map((l) => l.seq), [1, 2, 3, 4, 5]);
  // 'ASDA' and 'asda' are ONE brand group - case must not split it
  assert.deepEqual(packet.lines.slice(0, 2).map((l) => l.normalized_brand), ['asda', 'asda']);
  assert.equal(packet.lines[3].normalized_brand, null);
  assert.equal(packet.lines[4].normalized_brand, null);
  assertValid(SCHEMA, packet, 'packet');
});

test('duplicate brands keep a deterministic order, and equal keys fall back to INPUT ORDER (stability)', () => {
  // Three lines identical on BOTH sort keys, distinguishable only by input
  // order. Asserting input order proves the tie-break rather than relying
  // on the engine's sort happening to be stable.
  const packet = build([
    known({ brand: 'ASDA', canonical_product_name: 'Milk', original_list_line: 'first', canonical_product_id: 1, asda_product_ref: '111' }),
    known({ brand: 'asda ', canonical_product_name: 'milk', original_list_line: 'second', canonical_product_id: 2, asda_product_ref: '222' }),
    known({ brand: ' ASDA', canonical_product_name: 'MILK', original_list_line: 'third', canonical_product_id: 3, asda_product_ref: '333' })
  ]);
  assert.deepEqual(packet.lines.map((l) => l.original_list_line), ['first', 'second', 'third']);
});

test('the sort is CODE-UNIT, not locale collation - the two must not be allowed to differ silently', () => {
  // These values are chosen precisely BECAUSE the two collations disagree on
  // them: by code unit "cafz" < "cafe-acute", but localeCompare sorts the
  // accented e next to a plain e and gives the reverse. Without a
  // discriminating pair, a comparator swapped to localeCompare passes every
  // test - which is exactly what a mutation run found on 2026-08-04.
  // Accented brands are real in a UK grocery catalogue (Nescafe, Cafe Direct).
  const accented = 'Café';
  assert.ok(accented.localeCompare('Cafz') < 0, 'precondition: localeCompare disagrees with code-unit order here');

  const packet = build([
    known({ brand: accented, canonical_product_name: 'A', original_list_line: 'acc', canonical_product_id: 1, asda_product_ref: '111' }),
    known({ brand: 'Cafz', canonical_product_name: 'B', original_list_line: 'plain', canonical_product_id: 2, asda_product_ref: '222' }),
    known({ brand: 'Zebra', canonical_product_name: 'Z', original_list_line: 'z', canonical_product_id: 3, asda_product_ref: '333' }),
    known({ brand: 'apple', canonical_product_name: 'A', original_list_line: 'a', canonical_product_id: 4, asda_product_ref: '444' })
  ]);

  assert.deepEqual(
    packet.lines.map((l) => l.original_list_line),
    ['a', 'plain', 'acc', 'z'],
    'code-unit order puts "cafz" before the accented brand; localeCompare would reverse those two'
  );
  // The discriminating pair, asserted directly so the property cannot be
  // lost if the surrounding fixture is ever edited.
  const plainAt = packet.lines.findIndex((l) => l.original_list_line === 'plain');
  const accAt = packet.lines.findIndex((l) => l.original_list_line === 'acc');
  assert.ok(plainAt < accAt, '"cafz" must sort before the accented brand under code-unit comparison');

  // And the reproducibility property: a consumer re-sorting the emitted keys
  // by code unit must recover the exact packet order.
  const keys = packet.lines.map((l) => l.normalized_brand);
  const resorted = keys.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  assert.deepEqual(keys, resorted, 'a consumer must be able to ASSERT the order from normalized_brand alone');
});

test('every line carries normalized_brand so the primary key is reproducible', () => {
  const packet = build([known({ brand: "Sainsbury's" })]);
  assert.equal(packet.lines[0].brand, "Sainsbury's");
  assert.equal(packet.lines[0].normalized_brand, 'sainsbury s');
});

// ---------------------------------------------------------------------
// REQUIREMENT 2 - conditional requirements, enforced ABOVE the schema
// ---------------------------------------------------------------------

// SUPERSEDED 2026-08-09 by Warwick's Product Ruling 2. This test used to assert
// that a KNOWN line with no asda_product_ref was REJECTED. That rule failed the
// entire weekly shop over one missing reference, against a catalogue where a
// large minority of known products have none. The requirement changed; the test
// follows the requirement, and the replacement below is deliberately no weaker.
test('RULING 2: a KNOWN line with NO asda_product_ref is ACCEPTED and stays KNOWN', () => {
  for (const absent of [undefined, null]) {
    const packet = build([known({ asda_product_ref: absent, source_view: 'search' })]);
    const line = packet.lines[0];

    assert.equal(line.origin, 'known',
      'retrieval is a METHOD, not a reclassification - a missing reference must never turn a known household item into a new one');
    assert.equal(line.asda_product_ref, null, 'an absent reference must normalise to null, never to undefined or a placeholder');
    assert.equal(line.canonical_product_id, 41, 'identity is what makes it known and must survive intact');
    assert.equal(line.approved_search_term, null,
      'no search wording may be invented for a known item - approved wording exists only for a new_approved line');
  }
});

test('RULING 2: identity is still mandatory - only the REFERENCE became optional', () => {
  // The ruling separated identity from retrieval. It did not make identity
  // optional, and a line with neither is not a known household product at all.
  for (const bad of [undefined, null]) {
    assert.throws(
      () => build([known({ canonical_product_id: bad, asda_product_ref: null })]),
      (err) => err instanceof PacketError && /canonical_product_id/.test(err.message),
      'a known line with no identity must still be rejected even now that the reference is optional'
    );
  }
});

test('a KNOWN line with a MALFORMED asda_product_ref is still REJECTED - absent and broken are different', () => {
  // "Use its durable ASDA reference when available AND VALID" - a malformed
  // reference is an upstream defect, not a missing one, and must not be quietly
  // downgraded to "search for it instead", which would hide the bug.
  for (const bad of ['abc', '12', '1234567890123', ' ']) {
    assert.throws(
      () => build([known({ asda_product_ref: bad })]),
      (err) => err instanceof PacketError && /asda_product_ref/.test(err.message),
      'origin known with asda_product_ref=' + JSON.stringify(bad) + ' must be rejected'
    );
  }
});

test('a KNOWN line missing its canonical_product_id is REJECTED, not silently emitted', () => {
  for (const bad of [undefined, null]) {
    assert.throws(
      () => build([known({ canonical_product_id: bad })]),
      (err) => err instanceof PacketError && /canonical_product_id/.test(err.message)
    );
  }
});

test('a NEW_APPROVED line missing its approved_search_term is REJECTED', () => {
  for (const bad of [undefined, null, '', '   ']) {
    assert.throws(
      () => build([newApproved({ approved_search_term: bad })]),
      (err) => err instanceof PacketError && /approved_search_term/.test(err.message),
      'new_approved with approved_search_term=' + JSON.stringify(bad) + ' must be rejected'
    );
  }
});

test('a KNOWN item that HAS a valid reference may not be free-searched - use the reference', () => {
  // The surviving half of the old rule, narrowed by Ruling 2. Where we hold a
  // usable reference, sending the line to a free search throws away identity we
  // already have.
  assert.throws(
    () => build([known({ source_view: 'search' })]),
    (err) => err instanceof PacketError && /ONLY when no usable reference exists/.test(err.message)
  );
});

test('a KNOWN item with NO reference MAY be retrieved by search - that is the whole point of Ruling 2', () => {
  const packet = build([known({ asda_product_ref: null, source_view: 'search' })]);
  assert.equal(packet.lines[0].source_view, 'search');
  assert.equal(packet.lines[0].origin, 'known');
});

test('DEFENCE IN DEPTH: a null-identity line is rejected by the COMMITTED SCHEMA and, independently, by the producer', () => {
  // History, because it is the reason both halves exist. The original
  // contract used `required` alone, which asserts PRESENCE only, and typed
  // these fields nullable - so {origin:'known', canonical_product_id:null,
  // asda_product_ref:null} was SCHEMA-VALID while describing a known item
  // with no identity at all, which Sonnet could only resolve by
  // free-searching it. Raised at read-back 2026-08-04 and closed in the
  // schema the same day.
  //
  // This asserts the PROPERTY, not the mechanism: any schema that rejects
  // these shapes passes, however it achieves it. Pinning the exact `not`
  // clauses would fail a correct schema that closed the hole another way.
  function handBuilt(lineOverrides) {
    return {
      packet_version: 1,
      shop_ref: SHOP_REF,
      generated_at: GENERATED_AT,
      sort_contract: SORT_CONTRACT,
      expected_distinct_products: 1,
      expected_total_units: 1,
      lines: [Object.assign({
        seq: 1,
        original_list_line: 'milk 2',
        canonical_product_id: 41,
        canonical_product_name: 'Semi Skimmed Milk 2L',
        brand: 'ASDA',
        source_view: 'regulars',
        asda_product_ref: '1000383091',
        required_quantity: 1,
        origin: 'known'
      }, lineOverrides)],
      held: []
    };
  }

  // Control: the same packet with real identity IS valid, so the rejections
  // below are caused by the null and not by some unrelated defect.
  assert.equal(validate(SCHEMA, handBuilt({})).valid, true, 'the control packet must be schema-valid');

  // NOTE (2026-08-09): `known with a null asda_product_ref` used to be in this
  // list. Ruling 2 made that shape LEGITIMATE, so it moved to its own test
  // below, which pins the resulting divergence from the committed schema.
  // Identity is still defended here, by both halves.
  const nullShapes = [
    ['known with a null canonical_product_id', { canonical_product_id: null }],
    ['known with both null', { canonical_product_id: null, asda_product_ref: null }],
    ['new_approved with a null approved_search_term',
      { origin: 'new_approved', source_view: 'search', canonical_product_id: null, asda_product_ref: null, approved_search_term: null }]
  ];

  for (const [label, overrides] of nullShapes) {
    const verdict = validate(SCHEMA, handBuilt(overrides));
    assert.equal(verdict.valid, false,
      'the committed schema must reject ' + label + ' - if this fails the schema has been loosened');
  }

  // AND the producer rejects it on its own account. This is the durable
  // control: a schema is a contract, not a substitute for the producer's
  // own guard, and this half must hold even if the contract is loosened
  // again later.
  assert.throws(
    () => build([known({ canonical_product_id: null, asda_product_ref: null })]),
    (err) => err instanceof PacketError
  );
  assert.throws(
    () => build([newApproved({ approved_search_term: null })]),
    (err) => err instanceof PacketError
  );
});

test('a KNOWN line with NO asda_product_ref is schema-VALID — Warwick Ruling 2, contract and producer agree', () => {
  // This replaces the DIVERGENCE PIN that stood here from 2026-08-09 until the
  // committed schema was corrected the same day. The pin existed because the
  // producer implemented Warwick's Product Ruling 2 while
  // Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json still
  // required a non-null asda_product_ref for every known line — so a packet that
  // was CORRECT under the ruling was INVALID under the contract. The implementer
  // could not fix it: Builds/** is categorically outside its file surface. It
  // asserted the contradiction here instead of leaving it to be rediscovered in a
  // live shop, and the pin failed the moment the schema was relaxed — exactly as
  // designed. That is why this test now asserts the opposite.
  //
  // The RULING, and both halves matter:
  //   Known household identity and ASDA retrieval method are SEPARATE concerns.
  //   A missing reference is a RETRIEVAL problem, not grounds to reject a known
  //   household product — but the durable reference is used WHEN AVAILABLE, so
  //   search is the fallback and never a parallel route.
  function knownWithoutRefPacket() {
    return {
      packet_version: 1,
      shop_ref: SHOP_REF,
      generated_at: GENERATED_AT,
      sort_contract: SORT_CONTRACT,
      expected_distinct_products: 1,
      expected_total_units: 1,
      lines: [{
        seq: 1,
        original_list_line: 'milk 2',
        canonical_product_id: 41,
        canonical_product_name: 'Semi Skimmed Milk 2L',
        brand: 'ASDA',
        source_view: 'search',
        asda_product_ref: null,
        required_quantity: 1,
        origin: 'known'
      }],
      held: []
    };
  }

  // The producer accepts it.
  const produced = build([known({ asda_product_ref: null, source_view: 'search' })]);
  assert.equal(produced.lines[0].origin, 'known');
  assert.equal(produced.lines[0].asda_product_ref, null);

  // And so does the committed contract. Producer and contract now agree.
  const verdict = validate(SCHEMA, knownWithoutRefPacket());
  assert.equal(verdict.valid, true,
    'A known line with no asda_product_ref must be schema-VALID under Ruling 2. If this fails the ' +
    'schema has regressed to the retired rule — fix the schema, never the producer.');

  // IDENTITY IS STILL MANDATORY. The ruling separated identity from retrieval; it
  // did not make identity optional. A known line with no canonical_product_id
  // stays invalid, and this is the half a careless relaxation would have lost.
  const noIdentity = knownWithoutRefPacket();
  noIdentity.lines[0].canonical_product_id = null;
  assert.equal(validate(SCHEMA, noIdentity).valid, false,
    'A known line with no canonical_product_id must remain INVALID — identity is governed by the ' +
    'household catalogue and is not what Ruling 2 relaxed.');

  // SEARCH IS A FALLBACK, NOT A PARALLEL ROUTE. Where a valid reference exists,
  // source_view "search" is a silent-substitution path and stays invalid.
  const searchDespiteRef = knownWithoutRefPacket();
  searchDespiteRef.lines[0].asda_product_ref = '123456';
  assert.equal(validate(SCHEMA, searchDespiteRef).valid, false,
    'source_view "search" with a valid asda_product_ref must remain INVALID: Ruling 2 permits ' +
    'search only where no durable reference is available.');
});

test('an out-of-vocabulary source_view is REJECTED - regulars.source is NEVER silently mapped', () => {
  for (const bad of ['regular', 'decisions-log', 'Regulars', '', null, undefined]) {
    assert.throws(
      () => build([known({ source_view: bad })]),
      (err) => err instanceof PacketError && /source_view/.test(err.message),
      'source_view=' + JSON.stringify(bad) + ' must be rejected'
    );
  }
});

test('an unknown key on an input line is REJECTED rather than silently dropped', () => {
  assert.throws(
    () => build([newApproved({ approved_search_terms: 'typo' })]),
    (err) => err instanceof PacketError && /unknown key "approved_search_terms"/.test(err.message)
  );
});

test('quantity is never invented: absent, zero, fractional or out-of-range is REJECTED', () => {
  for (const bad of [undefined, null, 0, -1, 1.5, '2', 100]) {
    assert.throws(
      () => build([known({ required_quantity: bad })]),
      (err) => err instanceof PacketError && /required_quantity/.test(err.message),
      'required_quantity=' + JSON.stringify(bad) + ' must be rejected'
    );
  }
});

test('generated_at is REQUIRED - the module has no clock and never invents a timestamp', () => {
  assert.throws(
    () => buildExecutionPacket({ shop_ref: SHOP_REF, lines: [known()] }),
    (err) => err instanceof PacketError && /has no clock/.test(err.message)
  );
  assert.throws(
    () => buildExecutionPacket({ shop_ref: SHOP_REF, generated_at: 'not a date', lines: [known()] }),
    (err) => err instanceof PacketError && /not a parseable date-time/.test(err.message)
  );
  const fromDate = buildExecutionPacket({
    shop_ref: SHOP_REF, generated_at: new Date(Date.UTC(2026, 7, 4, 9, 0, 0)), lines: [known()]
  });
  assert.equal(fromDate.generated_at, GENERATED_AT);
  assertValid(SCHEMA, fromDate, 'packet');
});

test('a malformed shop_ref is REJECTED', () => {
  for (const bad of ['SHOP-26-08-03', 'shop-2026-08-03', '2026-08-03', '', undefined]) {
    assert.throws(
      () => buildExecutionPacket({ shop_ref: bad, generated_at: GENERATED_AT, lines: [known()] }),
      (err) => err instanceof PacketError && /shop_ref/.test(err.message)
    );
  }
});

// ---------------------------------------------------------------------
// RECONCILIATION INPUTS - computed from the lines
// ---------------------------------------------------------------------

test('expected_total_units is the SUM of quantities, not the line count', () => {
  const packet = build([
    known({ required_quantity: 4, canonical_product_id: 1, asda_product_ref: '111', canonical_product_name: 'A' }),
    known({ required_quantity: 1, canonical_product_id: 2, asda_product_ref: '222', canonical_product_name: 'B' }),
    known({ required_quantity: 12, canonical_product_id: 3, asda_product_ref: '333', canonical_product_name: 'C' })
  ]);
  assert.equal(packet.expected_total_units, 17);
  assert.equal(packet.expected_distinct_products, 3);
  assert.equal(packet.lines.length, 3);
});

test('expected_distinct_products counts PRODUCT IDENTITIES, so two lines for one product count ONCE', () => {
  // The basket shows one product with 5 units. Counting lines would report
  // a false mismatch at reconciliation the moment a list says milk twice.
  const packet = build([
    known({ original_list_line: 'milk', required_quantity: 2, canonical_product_id: 41, asda_product_ref: '1000383091' }),
    known({ original_list_line: 'more milk', required_quantity: 3, canonical_product_id: 41, asda_product_ref: '1000383091' })
  ]);
  assert.equal(packet.lines.length, 2, 'both list lines are preserved');
  assert.equal(packet.expected_distinct_products, 1);
  assert.equal(packet.expected_total_units, 5);
  assertValid(SCHEMA, packet, 'packet');
});

test('a new_approved line with no catalogue id counts as its own distinct product', () => {
  const packet = build([
    known(),
    newApproved({ approved_search_term: 'oatly barista oat drink 1l' }),
    newApproved({ original_list_line: 'oat mlk again', approved_search_term: 'Oatly  Barista OAT drink 1L' })
  ]);
  // The two new lines normalize to the SAME approved term, so they are one
  // product in the trolley.
  assert.equal(packet.expected_distinct_products, 2);
  assert.equal(packet.expected_total_units, 3);
});

test('held lines are EXCLUDED from both expected counts', () => {
  const packet = build([
    known({ required_quantity: 2 }),
    known({ original_list_line: 'yazoo', required_quantity: 9, hold: { reason: 'awaiting_decision' } })
  ]);
  assert.equal(packet.expected_total_units, 2);
  assert.equal(packet.expected_distinct_products, 1);
});

// ---------------------------------------------------------------------
// HELD - nothing is silently dropped
// ---------------------------------------------------------------------

test('a held line NEVER appears in lines[], and always appears in held[]', () => {
  const packet = build([
    known(),
    known({ original_list_line: 'yazoo', hold: { reason: 'ambiguous', detail: 'two flavours', rule_id: 12 } }),
    known({ original_list_line: 'wine', hold: { reason: 'excluded_by_rule', rule_id: 4 } })
  ]);

  assert.equal(packet.lines.length, 1);
  assert.equal(packet.held.length, 2);

  const heldTexts = packet.held.map((h) => h.original_list_line);
  const lineTexts = packet.lines.map((l) => l.original_list_line);
  for (const text of heldTexts) {
    assert.ok(!lineTexts.includes(text), '"' + text + '" is held and must not be in the basket');
  }
  assert.deepEqual(heldTexts, ['yazoo', 'wine']);
  assert.equal(packet.held[0].reason, 'ambiguous');
  assert.equal(packet.held[0].detail, 'two flavours');
  assert.equal(packet.held[0].rule_id, 12);
  assert.equal(packet.held[1].detail, null);
  assertValid(SCHEMA, packet, 'packet');
});

test('a held line needs NO product identity - it is held precisely because identity is unresolved', () => {
  const packet = build([
    known(),
    { original_list_line: 'the smudged one', hold: { reason: 'ambiguous', detail: 'unreadable on the photo' } }
  ]);
  assert.equal(packet.held.length, 1);
  assertValid(SCHEMA, packet, 'packet');
});

test('held[] is always present, even when empty, so "nothing dropped" is visible rather than absent', () => {
  const packet = build([known()]);
  assert.deepEqual(packet.held, []);
  assertValid(SCHEMA, packet, 'packet');
});

test('a standalone held[] argument is accepted alongside lines carrying hold', () => {
  const packet = build(
    [known(), known({ original_list_line: 'yazoo', hold: { reason: 'ambiguous' } })],
    { held: [{ original_list_line: 'never legible', reason: 'ambiguous', shop_line_no: 9 }] }
  );
  assert.equal(packet.held.length, 2);
  assert.equal(packet.held[1].shop_line_no, 9);
  assertValid(SCHEMA, packet, 'packet');
});

test('an out-of-enum hold reason is REJECTED - shop_line.status is NEVER silently mapped', () => {
  for (const bad of ['needs_confirmation', 'unmatched_new_item', 'unreadable', 'excluded', 'substituted']) {
    assert.throws(
      () => build([known(), known({ original_list_line: 'x', hold: { reason: bad } })]),
      (err) => err instanceof PacketError && /is not one of/.test(err.message),
      'hold reason "' + bad + '" must be rejected'
    );
  }
});

test('an ALL-HELD shop THROWS loudly naming the held count - it never emits an empty or invalid packet', () => {
  assert.throws(
    () => build([
      known({ original_list_line: 'a', hold: { reason: 'ambiguous' } }),
      known({ original_list_line: 'b', hold: { reason: 'awaiting_decision' } })
    ]),
    (err) => err instanceof PacketError &&
             /zero basket lines \(2 line\(s\) held\)/.test(err.message) &&
             /minItems/.test(err.message)
  );
  assert.throws(
    () => build([]),
    (err) => err instanceof PacketError && /zero basket lines \(0 line\(s\) held\)/.test(err.message)
  );
});

// ---------------------------------------------------------------------
// RULES AND RATIONALE - so a rule that fires is visible (D-2026-08-04-04)
// ---------------------------------------------------------------------

test('applied_rules and quantity_rationale are carried through verbatim', () => {
  const rationale = 'list said 3; rule 37 rounds up to 4 for the any-2-for-X offer, 4th is the female variant';
  const packet = build([known({ required_quantity: 4, applied_rules: [37, 38], quantity_rationale: rationale })]);
  assert.deepEqual(packet.lines[0].applied_rules, [37, 38]);
  assert.equal(packet.lines[0].quantity_rationale, rationale);
  assertValid(SCHEMA, packet, 'packet');
});

test('applied_rules defaults to an empty array and rejects a non-id member', () => {
  assert.deepEqual(build([known()]).lines[0].applied_rules, []);
  assert.throws(
    () => build([known({ applied_rules: ['37'] })]),
    (err) => err instanceof PacketError && /applied_rules\[0\]/.test(err.message)
  );
});

test('substitutes_allowed defaults to false and must be a boolean when given', () => {
  assert.equal(build([known()]).lines[0].substitutes_allowed, false);
  assert.equal(build([known({ substitutes_allowed: true })]).lines[0].substitutes_allowed, true);
  assert.throws(
    () => build([known({ substitutes_allowed: 'yes' })]),
    (err) => err instanceof PacketError && /substitutes_allowed/.test(err.message)
  );
});

// ---------------------------------------------------------------------
// A realistic shop, end to end
// ---------------------------------------------------------------------

test('a realistic 8-line shop is ordered, counted and schema-valid', () => {
  const packet = build([
    known({ original_list_line: 'milk 2', canonical_product_id: 41, canonical_product_name: 'Semi Skimmed Milk 2L', brand: 'ASDA', asda_product_ref: '1000383091', required_quantity: 2 }),
    known({ original_list_line: 'picnic bars', canonical_product_id: 88, canonical_product_name: 'Picnic Chocolate Bar 4 Pack', brand: 'Cadbury', source_view: 'favourites', asda_product_ref: '910284', required_quantity: 1 }),
    known({ original_list_line: 'choc yazoo', canonical_product_id: 12, canonical_product_name: 'Chocolate Milkshake 400ml', brand: 'Yazoo', asda_product_ref: '556677', required_quantity: 6 }),
    known({ original_list_line: 'azera', canonical_product_id: 30, canonical_product_name: 'Azera Americano Instant Coffee', brand: 'Nescafe', asda_product_ref: '778899', required_quantity: 1 }),
    known({ original_list_line: 'bananas', canonical_product_id: 5, canonical_product_name: 'Bananas Loose', brand: null, asda_product_ref: '223344', required_quantity: 6 }),
    known({ original_list_line: 'dairy milk', canonical_product_id: 89, canonical_product_name: 'Dairy Milk 110g', brand: 'Cadbury', source_view: 'favourites', asda_product_ref: '910285', required_quantity: 2 }),
    newApproved({ original_list_line: 'oat mlk', approved_search_term: 'oatly barista oat drink 1l', brand: 'Oatly', required_quantity: 1 }),
    known({ original_list_line: 'that sauce', hold: { reason: 'ambiguous', detail: 'three candidates in Regulars' } })
  ]);

  assertValid(SCHEMA, packet, 'packet');
  assert.deepEqual(packet.lines.map((l) => l.normalized_brand),
    ['asda', 'cadbury', 'cadbury', 'nescafe', 'oatly', 'yazoo', null]);
  assert.deepEqual(packet.lines.map((l) => l.canonical_product_name), [
    'Semi Skimmed Milk 2L',
    'Dairy Milk 110g',
    'Picnic Chocolate Bar 4 Pack',
    'Azera Americano Instant Coffee',
    'Oat Milk Barista 1L',
    'Chocolate Milkshake 400ml',
    'Bananas Loose'
  ]);
  assert.equal(packet.expected_distinct_products, 7);
  assert.equal(packet.expected_total_units, 19);
  assert.equal(packet.held.length, 1);
});
