// =====================================================================
// WO-2026-08-18-B15-RUNTIME - THE EXECUTABLE PROOFS FOR GAPS 1, 6 AND 10.
//
// THESE RUN AGAINST THE REAL COMMITTED HOUSEHOLD FIXTURES, not against data
// invented to make them pass:
//   services/asdair/pipeline/testdata/household-regulars.json  109 rows, 45 with
//                                                              no ASDA id
//   services/asdair/pipeline/testdata/household-rules.json      28 active rules
//
// The products asserted below are the ones the 2026-08-17 run actually got
// wrong - the TRESemme conditioner and shampoo (abstained on, and sitting in
// Favourites with unambiguous identity), and the Sweetex (out of stock, and
// reported as a pack-size ambiguity).
//
// THE SEARCH COUNTER IS THE POINT OF MOST OF THIS FILE. `favouritesFirst` is
// not a claim about intent - it is a claim that ZERO navigations happen for a
// line the Favourites grid can identify. A fake session that counts its own
// calls is what makes that checkable.
// =====================================================================
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { methodPolicy, methodReport } = require('./method.cjs');
const { resolveLine, UNRESOLVED } = require('./resolve.cjs');
const { matchFavourite, queriesForLine, catalogueRow, score } = require('./favourites.cjs');
const { BROWSER_METHOD } = require('../handoff/instructions.js');

const TESTDATA = path.resolve(__dirname, '..', 'pipeline', 'testdata');
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(TESTDATA, 'household-regulars.json'), 'utf8'));
const RULES = JSON.parse(fs.readFileSync(path.join(TESTDATA, 'household-rules.json'), 'utf8'));

/** A Favourites grid, as `read_regulars` returns it. */
const GRID = [
  { product_ref: '1001', name: 'TRESemme Rich Moisture Hair Conditioner 680ml' },
  { product_ref: '1002', name: 'TRESemme Rich Moisture Hair Shampoo 680ml' },
  { product_ref: '1003', name: 'ASDA Paracetamol 500mg Capsules 16 Capsules' },
  { product_ref: '1004', name: 'ASDA Sliced Topside of Beef 90g' },
  { product_ref: '1005', name: 'Exceptional by ASDA Roast Topside of Beef 90g' },
  { product_ref: '1006', name: 'Heinz Baked Beans 6x415g' },
  { product_ref: '1007', name: 'Heinz Baked Beans & Richmond Pork Sausages 200g' },
];

/** A session that records every navigation it is asked to make. */
function fakeSession(results = {}) {
  const calls = { search: [] };
  return {
    calls,
    async search(term) {
      calls.search.push(term);
      return { term, results: results[term] || results['*'] || [] };
    },
    async read_regulars() { return { items: GRID, bulk_control_present: true, checkbox_count: GRID.length }; },
  };
}

const neverJudge = async () => { throw new Error('the model must not be called for a line Favourites already identified'); };
const ON = methodPolicy(BROWSER_METHOD);

// =====================================================================
// GAP 1 - FAVOURITES FIRST, AND ZERO SEARCHES FOR A KNOWN LINE
// =====================================================================

test('the fixtures are the real ones, or every assertion below is theatre', () => {
  const rows = CATALOGUE.rows;
  assert.strictEqual(rows.length, 109, 'the committed household catalogue is 109 rows');
  assert.strictEqual(rows.filter((r) => !r.asda_product_id).length, 45, '45 of them carry no ASDA id');
  const active = (RULES.rows || RULES).filter((r) => r.active !== false);
  assert.strictEqual(active.length, 28);
  for (const id of ['33', '34', '40']) {
    assert.ok(active.some((r) => String(r.id) === id), `rule ${id} must be in the active fixture`);
  }
});

test('a known product with NO stored id is identified from Favourites with ZERO searches', async () => {
  // THE HEADLINE FAILURE OF 2026-08-17. This line free-searched, took ~40s and
  // abstained; the product was on the grid the whole time.
  const session = fakeSession();
  const out = await resolveLine(
    { line: 31, product: 'Tresemme conditioner', qty: 1 },
    { session, policy: ON, favourites: GRID, catalogue: CATALOGUE, judge: neverJudge },
  );
  assert.strictEqual(out.resolved, true);
  assert.strictEqual(out.via, 'favourites');
  assert.strictEqual(out.product_ref, '1001');
  assert.deepStrictEqual(session.calls.search, [], 'NOT ONE search may be issued for a line Favourites can identify');
});

test('the conditioner and the shampoo are two products, and are not confused', async () => {
  // Both were on the list; the run collapsed the pair once already.
  const s1 = fakeSession();
  const cond = await resolveLine(
    { line: 31, product: 'Tresemme conditioner', qty: 1 },
    { session: s1, policy: ON, favourites: GRID, catalogue: CATALOGUE, judge: neverJudge },
  );
  const s2 = fakeSession();
  const sham = await resolveLine(
    { line: 32, product: 'Tresemme shampoo', qty: 1 },
    { session: s2, policy: ON, favourites: GRID, catalogue: CATALOGUE, judge: neverJudge },
  );
  assert.strictEqual(cond.product_ref, '1001');
  assert.strictEqual(sham.product_ref, '1002');
  assert.notStrictEqual(cond.product_ref, sham.product_ref);
});

test("Mum's wording reaches the canonical ASDA description through the household catalogue", () => {
  // Warwick: "we should be working off the ASDA item name ... each ASDA
  // description is unique". The catalogue is the bridge from what she writes.
  const { row, queries } = queriesForLine('sliced beef', CATALOGUE);
  assert.ok(row, 'the catalogue must recognise the household wording');
  assert.strictEqual(row.name, 'ASDA Sliced Topside of Beef 90g');
  assert.strictEqual(queries[0], 'ASDA Sliced Topside of Beef 90g', 'the canonical description leads');
});

test('a stored id is used when present, and is never required when absent', async () => {
  const withId = await resolveLine(
    { line: 1, product: 'Anything', qty: 1, product_ref: '4996753' },
    { session: fakeSession(), policy: ON, favourites: [], catalogue: null, judge: neverJudge },
  );
  assert.strictEqual(withId.via, 'stored-id');

  // And the same product identified with no id at all, from the grid alone.
  const withoutId = await resolveLine(
    { line: 2, product: 'ASDA Paracetamol 500mg Capsules 16 Capsules', qty: 1 },
    { session: fakeSession(), policy: ON, favourites: GRID, catalogue: CATALOGUE, judge: neverJudge },
  );
  assert.strictEqual(withoutId.resolved, true, 'a missing id must NEVER block a line');
  assert.strictEqual(withoutId.via, 'favourites');
});

test('two genuinely plausible Favourites are NOT guessed between - the line falls through to the model', async () => {
  const grid = [
    { product_ref: '2001', name: 'ASDA Semi Skimmed Milk 2 Pints' },
    { product_ref: '2002', name: 'ASDA Semi Skimmed Milk 2 Pints Organic' },
  ];
  const hit = matchFavourite(['ASDA Semi Skimmed Milk 2 Pints'], grid);
  // Both contain every identity token of the query, and neither is ahead.
  assert.strictEqual(hit.resolved, false);
  assert.strictEqual(hit.reason, 'ambiguous-in-favourites');
  assert.strictEqual(hit.contenders.length, 2);
});

test('a different pack of the same brand is not a Favourites match', () => {
  const hit = matchFavourite(['Heinz Baked Beans 6x415g'], GRID);
  assert.strictEqual(hit.resolved, true);
  assert.strictEqual(hit.product_ref, '1006', 'the 6x415g pack, not the sausage tin');
  const s = score('Heinz Baked Beans 6x415g', 'Heinz Baked Beans & Richmond Pork Sausages 200g');
  assert.strictEqual(s.sizeOk, false, 'a size the line names must be present');
  assert.strictEqual(s.strong, false);
});

test('identity established on the grid but no reference exposed still buys the line', async () => {
  // The grid gives the canonical description; retrieval then runs against the
  // best query we will ever have. Ruling 2 - identity and retrieval are
  // separate concerns, and neither is allowed to veto the other.
  const grid = [{ product_ref: null, name: 'ASDA Sliced Topside of Beef 90g' }];
  const session = fakeSession({ 'ASDA Sliced Topside of Beef 90g': [{ product_ref: '7777', name: 'ASDA Sliced Topside of Beef 90g' }] });
  const out = await resolveLine(
    { line: 5, product: 'sliced beef', qty: 2 },
    {
      session, policy: ON, favourites: grid, catalogue: CATALOGUE,
      judge: async (line, candidates) => ({ resolved: true, product_ref: candidates[0].product_ref, name: candidates[0].name, why: 'exact' }),
    },
  );
  assert.strictEqual(out.resolved, true);
  assert.strictEqual(out.via, 'searched');
  assert.strictEqual(session.calls.search[0], 'ASDA Sliced Topside of Beef 90g', 'the grid supplied the exact query');
});

// =====================================================================
// GAP 6 - UNAVAILABLE IS NOT AMBIGUOUS
// =====================================================================

test('a product ASDA does not have is UNAVAILABLE, and no question is raised', async () => {
  // The Sweetex. Last night this came back as a pack-size ambiguity, putting a
  // question in front of Warwick that no answer of his could have resolved.
  const session = fakeSession({ '*': [] });
  const out = await resolveLine(
    { line: 20, product: 'Sweetex Calorie Free Sweeteners 600 Tablets', qty: 1 },
    { session, policy: ON, favourites: [], catalogue: CATALOGUE, judge: neverJudge },
  );
  assert.strictEqual(out.resolved, false);
  assert.strictEqual(out.kind, UNRESOLVED.UNAVAILABLE);
  assert.notStrictEqual(out.kind, UNRESOLVED.AMBIGUOUS);
  assert.match(out.why, /absence, not an ambiguity/);
});

test('several plausible LIVE candidates is a genuine ambiguity, and it IS answerable', async () => {
  const session = fakeSession({ '*': [{ product_ref: '1', name: 'A' }, { product_ref: '2', name: 'B' }] });
  const out = await resolveLine(
    { line: 21, product: 'Wet body wipes for women', qty: 1 },
    {
      session, policy: ON, favourites: [], catalogue: null,
      judge: async () => ({ resolved: false, reason: 'model-abstained', why: 'two remain plausible', candidates: [{ product_ref: '1', name: 'A' }, { product_ref: '2', name: 'B' }] }),
    },
  );
  assert.strictEqual(out.kind, UNRESOLVED.AMBIGUOUS);
  assert.strictEqual(out.answerable_by_warwick, true);
  assert.strictEqual(out.candidates.length, 2, 'the real candidates travel with the question');
});

test('a gateway failure is an ambiguity nobody can answer, and says so', async () => {
  const session = fakeSession({ '*': [{ product_ref: '1', name: 'A' }] });
  const out = await resolveLine(
    { line: 22, product: 'Anything', qty: 1 },
    {
      session, policy: ON, favourites: [], catalogue: null,
      judge: async () => ({ resolved: false, reason: 'gateway-failed', why: 'connect ECONNREFUSED', candidates: [] }),
    },
  );
  assert.strictEqual(out.kind, UNRESOLVED.AMBIGUOUS);
  assert.strictEqual(out.answerable_by_warwick, false, 'Warwick cannot answer "the model was unreachable"');
});

// =====================================================================
// GAP 10 - THE RULE CHANGE MUST MOVE THE RUNTIME
// =====================================================================

test('the pinned browser method reaches the executor as behaviour, not as prose', () => {
  const report = methodReport(BROWSER_METHOD);
  assert.strictEqual(report.source, 'services/asdair/handoff/instructions.js BROWSER_METHOD');
  assert.ok(report.delivered >= 18, 'the whole pinned method is delivered');
  assert.ok(report.implemented_ids.includes('regulars_favourites_first'));
  assert.strictEqual(report.delivered_but_unrecognised.length, 0,
    'an instruction this executor does not even recognise is a silent gap: ' + report.delivered_but_unrecognised.join(', '));
  assert.ok(ON.favouritesFirst);
  assert.ok(ON.reconcileFromQuantityField);
});

test('REMOVING regulars_favourites_first from the pinned method CHANGES WHAT THE RUNTIME DOES', async () => {
  // THE MUTATION PROOF. Warwick: "Do not repeat tonight's mistake of proving
  // rules exist in files while the executor ignores them. The test is runtime
  // behaviour, not text in the repository."
  //
  // Same line, same grid, same catalogue. The ONLY difference is one id
  // removed from the method - and the executor stops consulting Favourites and
  // goes to the browser instead.
  const mutated = BROWSER_METHOD.filter((m) => m.id !== 'regulars_favourites_first');
  const OFF = methodPolicy(mutated);
  assert.strictEqual(OFF.favouritesFirst, false, 'the mutation must actually change the policy');

  const line = { line: 31, product: 'Tresemme conditioner', qty: 1 };
  const judge = async (l, candidates) => ({ resolved: true, product_ref: candidates[0].product_ref, name: candidates[0].name, why: 'only candidate' });

  const withMethod = fakeSession({ '*': [{ product_ref: '9999', name: 'whatever search returns' }] });
  const a = await resolveLine(line, { session: withMethod, policy: ON, favourites: GRID, catalogue: CATALOGUE, judge });

  const withoutMethod = fakeSession({ '*': [{ product_ref: '9999', name: 'whatever search returns' }] });
  const b = await resolveLine(line, { session: withoutMethod, policy: OFF, favourites: GRID, catalogue: CATALOGUE, judge });

  assert.strictEqual(a.via, 'favourites');
  assert.deepStrictEqual(withMethod.calls.search, []);

  assert.strictEqual(b.via, 'searched', 'with the instruction removed the Favourites rung is GONE');
  assert.ok(withoutMethod.calls.search.length > 0, 'and the executor falls through to the browser');
  assert.notStrictEqual(a.product_ref, b.product_ref, 'the two runs reach different products - the behaviour moved');
});

test('every method flag defaults OFF, so a dropped instruction can never be silently assumed', () => {
  const none = methodPolicy([]);
  for (const [flag, value] of Object.entries(none)) {
    assert.strictEqual(value, false, `${flag} must be false when the method carries nothing`);
  }
});

test('the executor never claims to perform an instruction it has no code path for', () => {
  const report = methodReport(BROWSER_METHOD);
  // `set_brand_az_ordering` is pinned, real, and needs a sort control on the
  // live grid that nothing here has been able to verify. Saying so is the
  // difference between a delivered method and an obeyed one.
  assert.ok(report.delivered_but_not_implemented_here.includes('set_brand_az_ordering'));
  assert.ok(!report.implemented_ids.includes('set_brand_az_ordering'));
});
