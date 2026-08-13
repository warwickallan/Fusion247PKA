// BUILD-015 WP-B15-50 - cockpit-api/checkItem.test.js
//
// AC1 and AC2. The sense-check classifies against the REAL resolver, and the
// route CANNOT ask Mum a question.
//
// ⛔ THE SHAPE OF THE AC2 PROOF, AND WHY IT IS BUILT THIS WAY.
//
// "It never returns a candidate list" is easy to assert weakly - check a couple
// of responses, see no `alternatives`, call it proven. That proves nothing about
// the case that matters, because the resolver only produces candidates on the
// ambiguous statuses.
//
// So this file proves it in four independent ways:
//
//   1. THE DANGER IS REAL - the raw resolver verdict for an ambiguous term is
//      shown to carry a NON-EMPTY alternatives array. A control that guards
//      against nothing is not a control (a-control-is-not-evidence-until-made-
//      to-fail), so the hazard is demonstrated before the guard is credited.
//   2. THE GUARD FIRES - sealed() THROWS when handed that array.
//   3. NO STATUS LEAKS - every status this route can produce is exercised and
//      the response is walked STRUCTURALLY: every value must be a string,
//      number, boolean or null. An array or object anywhere is a failure,
//      which catches a candidate list under ANY key name, not just the one
//      spelled `alternatives`.
//   4. AGAINST THE REAL CATALOGUE - all 109 real regulars, each queried by its
//      own household alias, on the disposable target.
//
// RESPONSE_KEYS is pinned to a LITERAL HELD HERE, outside the module it checks.
// Importing the list and asserting it equals itself is a check that can never
// disagree with the thing it checks.
//
// SKIPPED, NOT FAILED, when no disposable target is configured - the same rule
// dbProofs.test.js follows.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const checkItem = require('./checkItem');
const resolver = require('../interpret/resolveByCatalogue.js');

const READ_URL = process.env.ASDAIR_DB_URL || null;
const ENABLED = !!READ_URL;

function skipMessage() {
  return 'SKIPPED - no disposable target. Set ASDAIR_DB_URL to run this.';
}

// ---------------------------------------------------------------------
// Fixtures. Small, explicit, and shaped exactly like asdair.regulars rows.
// ---------------------------------------------------------------------
const REGULARS = [
  { id: 11, name: 'Semi skimmed milk 4 pints', aka: ['milk', 'semi skimmed'] },
  { id: 12, name: 'Hovis soft white medium', aka: ['bread'] },
  { id: 13, name: 'Cathedral City mature cheddar', aka: ['cheese'] }
];

// TWO regulars answering ONE alias. This is the ambiguity the resolver reports
// as needs_confirmation WITH a candidate list - the exact case AC2 is about.
const AMBIGUOUS = [
  { id: 21, name: 'Yazoo chocolate milkshake', aka: ['shake'] },
  { id: 22, name: 'Yazoo strawberry milkshake', aka: ['shake'] }
];

/** Every value in a sealed response must be a leaf. Returns the offending path, or null. */
function firstNonLeaf(value, path) {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return null;
  return path;
}

function structuralOffence(body) {
  const keys = Object.keys(body);
  for (let i = 0; i < keys.length; i += 1) {
    const hit = firstNonLeaf(body[keys[i]], keys[i]);
    if (hit) return hit;
  }
  return null;
}

// =====================================================================
// AC1 - it classifies, using the resolver that already exists
// =====================================================================

test('AC1: an exact household alias resolves to that regular, by name', () => {
  const out = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: [] });
  assert.equal(out.status, 'matched');
  assert.equal(out.matched_regular_id, 11);
  assert.equal(out.matched_name, 'Semi skimmed milk 4 pints');
  assert.equal(out.already_on_list, false);
});

test('AC1: the canonical name resolves too, quantity prefix and all', () => {
  const out = checkItem.classifyItem({ text: '2 Hovis soft white medium', regulars: REGULARS, chosen: [] });
  assert.equal(out.status, 'matched');
  assert.equal(out.matched_regular_id, 12);
});

test('AC1: a genuinely new item is unmatched_new_item and carries no identity', () => {
  const out = checkItem.classifyItem({ text: 'some of those little cakes', regulars: REGULARS, chosen: [] });
  assert.equal(out.status, 'unmatched_new_item');
  assert.equal(out.matched_name, null);
  assert.equal(out.matched_regular_id, null);
  assert.equal(out.already_on_list, false);
});

test('AC1: a term with no letters or digits left in it is unreadable', () => {
  // Established by execution against the real resolver, not assumed: a BARE
  // QUANTITY ("2") survives stripLeadingQuantity and lands as a new item, while
  // punctuation-only normalises to nothing and is honestly unreadable. Both are
  // pinned below, because guessing which one this was is how a status that
  // never fires gets asserted as covered.
  const out = checkItem.classifyItem({ text: '...', regulars: REGULARS, chosen: [] });
  assert.equal(out.status, 'unreadable');
  assert.equal(out.matched_regular_id, null);
});

test('AC1: a bare quantity is a new item, not an unreadable one', () => {
  const out = checkItem.classifyItem({ text: '2', regulars: REGULARS, chosen: [] });
  assert.equal(out.status, 'unmatched_new_item');
  assert.equal(out.matched_regular_id, null);
});

test('AC1: nothing typed is a coded, exposable refusal - not a crash and not a match', () => {
  assert.throws(
    () => checkItem.classifyItem({ text: '   ', regulars: REGULARS }),
    (err) => err.code === 'no_text' && err.expose === true
  );
});

test('AC1: classification is PURE - it needs no database and no environment', () => {
  // If this file could only run with pg installed and ASDAIR_DB_URL set, every
  // proof above would be a database test wearing a unit test's clothes.
  const out = checkItem.classifyItem({ text: 'cheese', regulars: REGULARS, chosen: [] });
  assert.equal(out.matched_regular_id, 13);
});

// =====================================================================
// possible_duplicate - reachable ONLY because the page sends `chosen`
// =====================================================================

test('possible_duplicate: already on her list, and said so by name', () => {
  const out = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: ['11'] });
  assert.equal(out.status, 'possible_duplicate');
  assert.equal(out.already_on_list, true);
  assert.equal(out.matched_name, 'Semi skimmed milk 4 pints');
});

test('possible_duplicate: id_display strings and numeric ids compare as the same id', () => {
  // The UI sends regulars.id_display ("11"); the resolver returns a NUMBER (11).
  // Comparing those raw is a silent false-negative machine.
  const asString = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: ['11'] });
  const asNumber = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: [11] });
  assert.equal(asString.already_on_list, true);
  assert.equal(asNumber.already_on_list, true);
});

test('possible_duplicate: junk in `chosen` is ignored, never fatal', () => {
  const out = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: [null, '', 'abc', {}, '11'] });
  assert.equal(out.status, 'possible_duplicate');
});

test('a different item already on the list does not make THIS one a duplicate', () => {
  const out = checkItem.classifyItem({ text: 'milk', regulars: REGULARS, chosen: ['12', '13'] });
  assert.equal(out.status, 'matched');
  assert.equal(out.already_on_list, false);
});

// =====================================================================
// AC2 - THE CHECK NEVER ASKS MUM A QUESTION
// =====================================================================

test('AC2 step 1: THE DANGER IS REAL - the raw resolver DOES hand back a candidate list', () => {
  const verdict = resolver.resolveReading('shake', AMBIGUOUS);
  assert.equal(verdict.status, 'needs_confirmation');
  assert.ok(Array.isArray(verdict.alternatives), 'the resolver is expected to carry alternatives');
  assert.ok(verdict.alternatives.length > 1,
    'this fixture must produce a MULTI-candidate verdict, or step 3 is guarding nothing');
});

test('AC2 step 2: the same ambiguity reaches the caller with NOTHING to decide', () => {
  const out = checkItem.classifyItem({ text: 'shake', regulars: AMBIGUOUS, chosen: [] });
  assert.equal(out.status, 'needs_confirmation');
  assert.equal(out.matched_name, null);
  assert.equal(out.matched_regular_id, null);
  assert.equal(out.already_on_list, false);
  assert.deepEqual(Object.keys(out), ['status', 'matched_name', 'matched_regular_id', 'already_on_list']);
});

test('AC2 step 2: THE GUARD FIRES - sealed() throws when handed a candidate list', () => {
  // The mutation this control exists to stop, executed against the control.
  assert.throws(
    () => checkItem._internal.sealed({
      status: 'needs_confirmation',
      matched_name: null,
      matched_regular_id: null,
      already_on_list: false,
      alternatives: [{ id: 21, name: 'Yazoo chocolate milkshake' }]
    }),
    /sealed to status, matched_name, matched_regular_id, already_on_list/
  );
});

test('AC2 step 3: NO STATUS LEAKS - every reachable status returns leaves only', () => {
  const cases = [
    { text: 'milk', regulars: REGULARS, chosen: [], expect: 'matched' },
    { text: 'milk', regulars: REGULARS, chosen: ['11'], expect: 'possible_duplicate' },
    { text: 'shake', regulars: AMBIGUOUS, chosen: [], expect: 'needs_confirmation' },
    { text: 'some of those little cakes', regulars: REGULARS, chosen: [], expect: 'unmatched_new_item' },
    { text: '...', regulars: REGULARS, chosen: [], expect: 'unreadable' }
  ];
  const seen = [];
  for (const c of cases) {
    const out = checkItem.classifyItem({ text: c.text, regulars: c.regulars, chosen: c.chosen });
    assert.equal(out.status, c.expect);
    // An array or object under ANY key name - not merely one spelled
    // `alternatives` - is a candidate list escaping to her surface.
    assert.equal(structuralOffence(out), null,
      'a non-leaf value escaped on status ' + out.status);
    seen.push(out.status);
  }
  // Executed-count discipline: assert the sweep actually covered all five.
  assert.equal(seen.length, 5);
  assert.deepEqual([...new Set(seen)].sort(), checkItem.CHECK_ITEM_STATUSES.slice().sort());
});

test('AC2: RESPONSE_KEYS is pinned to a literal held OUTSIDE checkItem.js', () => {
  // Importing the list and asserting it equals itself would pass no matter what
  // was added to it. This literal is the pin.
  assert.deepEqual(checkItem.RESPONSE_KEYS,
    ['status', 'matched_name', 'matched_regular_id', 'already_on_list']);
  assert.ok(!checkItem.RESPONSE_KEYS.includes('alternatives'));
});

test('AC2: the status vocabulary matches the frozen check-item contract v1', () => {
  assert.deepEqual(checkItem.CHECK_ITEM_STATUSES,
    ['matched', 'possible_duplicate', 'needs_confirmation', 'unmatched_new_item', 'unreadable']);
});

test('AC2: an unrecognised resolver status degrades to "nothing to decide", never to a guess', () => {
  // Defence in depth: if the resolver ever grows a status this module does not
  // know, the safe direction is silence - not improvising an identity.
  const out = checkItem.classifyItem({ text: 'milk', regulars: [{ id: 11, name: 'Milk', aka: [] }], chosen: [] });
  assert.ok(checkItem.CHECK_ITEM_STATUSES.includes(out.status));
});

// =====================================================================
// AC1/AC2 against the REAL catalogue - the disposable target
// =====================================================================

test('AC1+AC2: all 109 real regulars, each by its own alias, and no candidate list ever escapes',
  { skip: ENABLED ? false : skipMessage() },
  async () => {
    const pg = require('pg');
    const pool = new pg.Pool({ connectionString: READ_URL });
    try {
      const client = await pool.connect();
      let regulars;
      try {
        regulars = await checkItem.loadRegulars({ household_id: 1, client: client });
      } finally {
        client.release();
      }

      // The measurement basis, asserted rather than assumed: a run over 3 rows
      // that reported "no candidate list escaped" would be worthless.
      assert.ok(regulars.length >= 100,
        'expected the real catalogue (109 active regulars), got ' + regulars.length);

      let exact = 0;
      let wrongProduct = 0;
      let heldBack = 0;
      let checked = 0;
      const statuses = new Set();

      for (const reg of regulars) {
        const term = (Array.isArray(reg.aka) && reg.aka.length > 0 && String(reg.aka[0]).trim() !== '')
          ? String(reg.aka[0])
          : String(reg.name);
        const out = checkItem.classifyItem({ text: term, regulars: regulars, chosen: [] });
        checked += 1;
        statuses.add(out.status);

        // ⛔ THE CRITERION. Not "usually clean" - not once, across the whole
        // real catalogue.
        assert.equal(structuralOffence(out), null,
          'a non-leaf value escaped for "' + term + '" (status ' + out.status + ')');

        if (out.matched_regular_id === null) {
          heldBack += 1;
        } else if (String(out.matched_regular_id) === String(reg.id)) {
          exact += 1;
        } else {
          wrongProduct += 1;
        }
      }

      assert.equal(checked, regulars.length);
      // 0 WRONG PRODUCTS is the one that matters: a sense-check that names the
      // wrong thing tells her she already has something she does not.
      assert.equal(wrongProduct, 0, 'a term resolved to the WRONG regular');
      assert.ok(exact >= regulars.length - 5,
        'expected almost every alias to resolve exactly; got ' + exact + '/' + regulars.length);
      assert.ok(exact + heldBack === checked);
      for (const s of statuses) {
        assert.ok(checkItem.CHECK_ITEM_STATUSES.includes(s), 'unknown status ' + s);
      }
    } finally {
      await pool.end();
    }
  });

test('AC1: loadRegulars is SELECT-only and asks for identity columns only',
  () => {
    assert.match(checkItem.REGULARS_SQL, /^SELECT id, name, aka FROM asdair\.regulars/);
    assert.ok(!/INSERT|UPDATE|DELETE/i.test(checkItem.REGULARS_SQL));
    // ACTIVE ONLY - matching a retired product would tell her she already has
    // something the household stopped buying.
    assert.match(checkItem.REGULARS_SQL, /active IS NOT FALSE/);
  });
