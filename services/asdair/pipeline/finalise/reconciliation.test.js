// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/reconciliation.test.js
//
// WO-2026-08-13-04 (WP-B15-37), AC2 + AC8. THE BOTH-DIRECTIONS PROOFS, AND
// THE MUTATIONS THAT MAKE THEM BITE.
//
//   1. Duplicate observations of ONE physical page line COLLAPSE.
//   2. Genuinely different purchases with similar names DO NOT.
//
// Warwick named three pairs, and all three have been silently merged once in
// this build already: Yazoo strawberry vs chocolate, Twix ice cream vs biscuit
// bars, Arla vs ASDA milk. Each is pinned here, and each proof is then MUTATED
// so a reader can see it fail rather than take its green on trust - "a gate no
// test can fail is not a gate".
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  corroborate, collapseWithinRun, identityKey, pageLineKey, isRealProductId, SUPPORT,
} from './corroborate.js';

const obs = (over = {}) => ({
  line_no: 1,
  as_written: 'x',
  product_id: null,
  identified: false,
  quantity: 1,
  quantity_basis: 'explicit-on-page',
  confidence: 0.9,
  source_region: 2,
  ...over,
});

// =====================================================================
// DIRECTION 1 - duplicate observations of one physical line collapse
// =====================================================================

test('AC2 direction 1: one physical page line read twice in ONE run collapses to one purchase', () => {
  const { lines, collapsed } = collapseWithinRun([
    obs({ line_no: 1, as_written: '1 LENOR O', product_id: '5', identified: true, quantity: 1 }),
    obs({ line_no: 11, as_written: '- LENOR OUTDOOR', product_id: '5', identified: true, quantity: 1, quantity_basis: 'household-default-one' }),
  ]);
  assert.equal(lines.length, 1, 'the household has ONE Lenor line, not two');
  assert.equal(collapsed.length, 1);
  assert.equal(lines[0].product_id, '5');
  assert.equal(lines[0].collapsed_from.length, 1);
});

test('AC2 direction 1: the survivor is elected by EVIDENCE BASIS, never by confidence', () => {
  const { lines } = collapseWithinRun([
    // The LOW-confidence reading is the one carrying page evidence. If
    // confidence decided, the wrong reading would survive and the quantity the
    // page actually carries would be lost.
    obs({ line_no: 1, as_written: '2 x YAZOO STRAWBERRY MILK SHAKE', product_id: '59', identified: true, quantity: 2, quantity_basis: 'explicit-on-page', confidence: 0.11 }),
    obs({ line_no: 9, as_written: '- YAZOO STRAWBERRY milk shake', product_id: '59', identified: true, quantity: 1, quantity_basis: 'household-default-one', confidence: 0.99 }),
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2, 'the page-evidenced reading must survive, whatever the confidences say');
  assert.equal(lines[0].quantity_basis, 'explicit-on-page');
});

// =====================================================================
// DIRECTION 2 - Warwick's three named pairs must NEVER merge
// =====================================================================

const NAMED_PAIRS = [
  {
    name: 'Yazoo strawberry vs Yazoo chocolate',
    a: obs({ line_no: 1, as_written: '3 YAZOO STRAWBERRY MILK SHAKE', product_id: '59', identified: true, quantity: 3 }),
    b: obs({ line_no: 2, as_written: '2 YAZOO CHOCOLATE MILK SHAKE', product_id: '15', identified: true, quantity: 2 }),
  },
  {
    name: 'Twix ice cream vs Twix biscuit bars',
    a: obs({ line_no: 1, as_written: '2 PKTS. TWIX ICECREAM BARS', product_id: '114', identified: true, quantity: 2 }),
    b: obs({ line_no: 2, as_written: '1 PK. TWIX CHOC BISCUIT BARS', product_id: '115', identified: true, quantity: 1 }),
  },
  {
    name: 'Arla/Cravendale milk vs ASDA milk',
    a: obs({ line_no: 1, as_written: '4 x 4pts. ARLA SEMI SKIMMED MILK', product_id: '4', identified: true, quantity: 4 }),
    b: obs({ line_no: 2, as_written: '1 x 6pts. ASDA SEMI SKIMMED MILK', product_id: '2', identified: true, quantity: 1 }),
  },
];

for (const pair of NAMED_PAIRS) {
  test(`AC2 direction 2: ${pair.name} must NOT collapse - within a run`, () => {
    const { lines, collapsed } = collapseWithinRun([pair.a, pair.b]);
    assert.equal(lines.length, 2, `${pair.name} were merged into one purchase - this has happened before in this build`);
    assert.equal(collapsed.length, 0);
    assert.notEqual(identityKey(pair.a), identityKey(pair.b));
  });

  test(`AC2 direction 2: ${pair.name} must NOT collapse - across runs`, () => {
    const r = corroborate([
      { label: 'r1', observations: [pair.a, pair.b] },
      { label: 'r2', observations: [pair.a, pair.b] },
      { label: 'r3', observations: [pair.a, pair.b] },
    ]);
    assert.equal(r.observations.length, 2, `${pair.name} were merged across runs`);
    for (const o of r.observations) assert.equal(o.support_class, SUPPORT.UNANIMOUS);
    const ids = r.observations.map((o) => String(o.product_id)).sort();
    assert.deepEqual(ids, [String(pair.a.product_id), String(pair.b.product_id)].sort());
  });

  // ── THE MUTATION: prove the proof can fail ──────────────────────────────
  // Give the two DIFFERENT purchases the SAME catalogue identity - which is
  // exactly what a resolver bug that merges them would produce - and assert the
  // check above now collapses them. A proof that cannot be made to fail is
  // decoration.
  test(`AC2 MUTATION: ${pair.name} - the proof BITES when the identities are forced equal`, () => {
    const forced = { ...pair.b, product_id: pair.a.product_id };
    const { lines } = collapseWithinRun([pair.a, forced]);
    assert.equal(lines.length, 1,
      'the mutation did not reach the check - this proof would pass over a real merge defect');
  });
}

// =====================================================================
// THE SAME PAIRS, THROUGH THE PAGE-LINE TEXT MERGE
// =====================================================================

test('AC2 direction 2: the cross-run TEXT merge cannot join the three named pairs either', () => {
  for (const pair of NAMED_PAIRS) {
    assert.notEqual(pageLineKey(pair.a.as_written), pageLineKey(pair.b.as_written),
      `${pair.name}: the page-line keys are equal, so a text merge could join them`);
  }
});

test('the page-line key strips a LEADING count and its marker, and nothing else', () => {
  assert.equal(pageLineKey('4 x 4pts. ARLA SEMI SKIMMED MILK'), 'arla semi skimmed milk');
  assert.equal(pageLineKey('2 PKTS. ASDA SHORTBREAD Fingers'), 'asda shortbread finger');
  assert.equal(pageLineKey('1 BAG ASDA PLAIN TOFFEE\'S'), 'asda plain toffee');
  assert.equal(pageLineKey('1 BAG ASDA PLAIN TOFFEES'), 'asda plain toffee');
  // A number INSIDE the name is product identity and is never stripped.
  assert.equal(pageLineKey('16 Richmond SKINLESS PORK SAUSAGES'), 'richmond skinless pork sausage');
});

// =====================================================================
// THE SENTINEL - unidentified lines must never key as one product
// =====================================================================

test('vision\'s UNKNOWN_VISIBLE_ITEM sentinel is not a product id', () => {
  assert.equal(isRealProductId('UNKNOWN_VISIBLE_ITEM'), false);
  assert.equal(isRealProductId('59'), true);
  assert.equal(isRealProductId(null), false);
});

test('two DIFFERENT unidentified lines do not merge into one phantom product', () => {
  const { lines } = collapseWithinRun([
    obs({ line_no: 1, as_written: '1 BOX ASDA FRUIT LOLLY ICES', product_id: 'UNKNOWN_VISIBLE_ITEM', identified: true }),
    obs({ line_no: 2, as_written: '1 4PK BIRDS EYE QUARTER POUNDERS', product_id: 'UNKNOWN_VISIBLE_ITEM', identified: true }),
  ]);
  assert.equal(lines.length, 2, 'the sentinel was treated as a catalogue id and merged two unrelated lines');
});

// =====================================================================
// ANTI-PHANTOM: cross-run corroboration
// =====================================================================

test('AC3: a line only ONE run produced is UNCORROBORATED - the only phantom defence there is', () => {
  const real = obs({ line_no: 1, as_written: '1 CALGON', product_id: '37', identified: true });
  const phantom = obs({ line_no: 2, as_written: '1 TROP. SMOOTH ORANGE', product_id: '47', identified: true });
  const r = corroborate([
    { label: 'r1', observations: [real, phantom] },
    { label: 'r2', observations: [real] },
    { label: 'r3', observations: [real] },
  ]);
  const byKey = new Map(r.observations.map((o) => [o.identity_key, o]));
  assert.equal(byKey.get('id:37').support_class, SUPPORT.UNANIMOUS);
  assert.equal(byKey.get('id:47').support_class, SUPPORT.UNCORROBORATED);
  assert.equal(byKey.get('id:47').support, 1);
});

test('AC3 MUTATION: a phantom reproduced by EVERY run is INVISIBLE to corroboration', () => {
  // This is the limit, asserted rather than described, so nobody reads the
  // mechanism as stronger than it is.
  const phantom = obs({ line_no: 2, as_written: '1 TROP. SMOOTH ORANGE', product_id: '47', identified: true });
  const r = corroborate([
    { label: 'r1', observations: [phantom] },
    { label: 'r2', observations: [phantom] },
    { label: 'r3', observations: [phantom] },
  ]);
  assert.equal(r.observations[0].support_class, SUPPORT.UNANIMOUS,
    'corroboration measures AGREEMENT, not truth - a systematic misreading is systematically repeated');
});

test('a quantity DISAGREEMENT across runs is recorded, never averaged or voted', () => {
  const a = obs({ line_no: 1, as_written: '1 x 6pts. ASDA SEMI SKIMMED MILK', product_id: '2', identified: true, quantity: 1 });
  const b = obs({ line_no: 1, as_written: '7 x 6pts. ASDA SEMI SKIMMED MILK', product_id: '2', identified: true, quantity: 7 });
  const r = corroborate([
    { label: 'r1', observations: [a] },
    { label: 'r2', observations: [a] },
    { label: 'r3', observations: [b] },
  ]);
  assert.equal(r.observations.length, 1);
  assert.equal(r.observations[0].quantity_disagreement, true);
  assert.deepEqual(r.observations[0].quantity_candidates, [1, 7]);
  assert.notEqual(r.observations[0].quantity, 4, 'quantities must never be averaged');
});

test('an IDENTITY disagreement across runs leaves the line unidentified rather than picking one', () => {
  const a = obs({ line_no: 1, as_written: '1 PKT. ROAST BEEF', product_id: '80', identified: true });
  const b = obs({ line_no: 1, as_written: '1 PKT. ROAST BEEF', product_id: '81', identified: true });
  const r = corroborate([
    { label: 'r1', observations: [a] },
    { label: 'r2', observations: [b] },
    { label: 'r3', observations: [b] },
  ]);
  assert.equal(r.observations.length, 1, 'one page line read to two ids must not become two purchases');
  assert.equal(r.observations[0].identity_disagreement, true);
  assert.equal(r.observations[0].product_id, null);
  assert.deepEqual(r.observations[0].identity_candidates, ['80', '81']);
});
