// =====================================================================
// IDEA-012 AsdAIr - the learning writer: buildRegularsUpdate.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented ids, "Widget A"-style names). ZERO real
// household data. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE, NO NETWORK, NO CLOCK. Everything proven here is proven against
// the PURE builder, so the rules that matter -- the strict column allowlist,
// merge-never-clobber aliases, never-delete, never-deactivate, never-rename --
// are provable without a connection.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildRegularsUpdate,
  applyAkaMerge,
  mergeAka,
  normaliseAlias,
  OPS,
  REGULAR_INSERT_COLUMNS,
  ENRICH_ALLOWED_COLUMNS,
  ENRICH_WRITER_OWNED
} = require('./buildRegularsUpdate');

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

function newRegular(overrides) {
  return Object.assign({
    household_id: 1,
    high_level_category: 'Chilled',
    category: 'Dairy',
    name: 'Widget A Semi Skimmed',
    brand: 'Widgetco',
    asda_product_id: '1000000000001',
    asda_url: 'https://example.invalid/product/1000000000001',
    typical_qty: 2,
    substitutes_allowed: false
  }, overrides || {});
}

// ---------------------------------------------------------------------
// The operation surface: two operations, and no third
// ---------------------------------------------------------------------

test('there are exactly two operations -- no delete, no deactivate, no rename', function () {
  assert.deepEqual(OPS, ['upsertRegular', 'enrichRegular']);

  ['deleteRegular', 'deactivateRegular', 'renameRegular', 'removeRegular', 'setActive'].forEach(function (op) {
    assert.throws(function () { buildRegularsUpdate({ op: op, id: 1 }); }, /is not one of/);
  });
});

test('a missing or unknown op is refused, and the refusal names the two that exist', function () {
  assert.throws(function () { buildRegularsUpdate({}); }, /op is required/);
  assert.throws(function () { buildRegularsUpdate(); }, /op is required/);
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsert' }); },
    /no delete, no deactivate and no rename/
  );
});

// ---------------------------------------------------------------------
// upsertRegular -- the happy path
// ---------------------------------------------------------------------

test('upsertRegular builds exactly the contracted insert row', function () {
  const built = buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular() });

  assert.equal(built.op, 'upsertRegular');
  assert.equal(built.table, 'asdair.regulars');
  assert.deepEqual(built.columns, REGULAR_INSERT_COLUMNS);
  assert.equal(built.conflict_target, '(household_id, source, name)');

  assert.deepEqual(built.row, {
    household_id: 1,
    high_level_category: 'Chilled',
    category: 'Dairy',
    name: 'Widget A Semi Skimmed',
    brand: 'Widgetco',
    asda_product_id: '1000000000001',
    asda_url: 'https://example.invalid/product/1000000000001',
    typical_qty: 2,
    source: 'regular',
    active: true,
    aka: [],
    substitutes_allowed: false
  });

  // Every built key is a real column, and every column is built.
  assert.deepEqual(Object.keys(built.row).slice().sort(), REGULAR_INSERT_COLUMNS.slice().sort());
});

test('upsertRegular defaults are the safe ones: source=regular, active=true, substitutes_allowed=false', function () {
  const built = buildRegularsUpdate({
    op: 'upsertRegular',
    regular: { household_id: 2, name: 'Widget B' }
  });
  assert.equal(built.row.source, 'regular');
  assert.equal(built.row.active, true);
  assert.equal(built.row.substitutes_allowed, false);
  assert.deepEqual(built.row.aka, []);
  assert.equal(built.row.brand, null);
  assert.equal(built.row.typical_qty, null);
});

test('upsertRegular carries the DEDUPE KEY: the name, normalised the way the read path matches', function () {
  const built = buildRegularsUpdate({
    op: 'upsertRegular',
    regular: newRegular({ name: '  Widget   A   Semi Skimmed ' })
  });
  // The stored name keeps the caller's casing (trimmed); the dedupe key does not.
  assert.equal(built.row.name, 'Widget   A   Semi Skimmed');
  assert.equal(built.normalised_name, 'widget a semi skimmed');
});

test('upsertRegular: the item is never stored as an alias of itself', function () {
  const built = buildRegularsUpdate({
    op: 'upsertRegular',
    regular: newRegular({ name: 'Widget A', aka: ['widget a', 'WIDGET A', 'the widget'] })
  });
  assert.deepEqual(built.row.aka, ['the widget']);
});

test('upsertRegular normalises and de-duplicates the alias list it is given', function () {
  const built = buildRegularsUpdate({
    op: 'upsertRegular',
    regular: newRegular({ aka: ['  Blue Milk ', 'blue   milk', 'BLUE MILK', 'four pinter'] })
  });
  assert.deepEqual(built.row.aka, ['blue milk', 'four pinter']);
});

// ---------------------------------------------------------------------
// upsertRegular -- missing / invalid required fields
// ---------------------------------------------------------------------

test('upsertRegular rejects a missing household_id or name', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: { name: 'Widget A' } }); },
    /regular\.household_id is required/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: { household_id: 1 } }); },
    /regular\.name is required/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: { household_id: 1, name: '   ' } }); },
    /regular\.name must be a non-empty string/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular' }); },
    /requires a `regular` object/
  );
});

test('upsertRegular rejects a non-id household_id and a non-count typical_qty', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ household_id: 'one' }) }); },
    /must be a positive integer id/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ household_id: 0 }) }); },
    /must be a positive integer id/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ typical_qty: 0 }) }); },
    /must be a positive integer item count/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ typical_qty: 1.5 }) }); },
    /must be a positive integer item count/
  );
});

test('upsertRegular refuses a truthy-but-not-boolean permission flag', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ substitutes_allowed: 'yes' }) }); },
    /must be exactly true or false/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular({ active: 1 }) }); },
    /must be exactly true or false/
  );
});

// ---------------------------------------------------------------------
// enrichRegular -- THE ALLOWLIST. The single most important rule here.
// ---------------------------------------------------------------------

test('the allowlist is exactly the seven contracted columns', function () {
  assert.deepEqual(ENRICH_ALLOWED_COLUMNS, [
    'asda_product_id',
    'asda_url',
    'aka',
    'brand',
    'substitutes_allowed',
    'typical_qty',
    'updated_at'
  ]);
  assert.deepEqual(ENRICH_WRITER_OWNED, ['updated_at']);
});

test('enrichRegular builds a SET containing ONLY allowlisted columns', function () {
  const built = buildRegularsUpdate({
    op: 'enrichRegular',
    id: 4,
    set: {
      asda_product_id: '1000000000002',
      asda_url: 'https://example.invalid/product/1000000000002',
      brand: 'Widgetco',
      typical_qty: 3,
      substitutes_allowed: true
    }
  });

  assert.equal(built.op, 'enrichRegular');
  assert.equal(built.id, 4);
  assert.deepEqual(built.set, {
    asda_product_id: '1000000000002',
    asda_url: 'https://example.invalid/product/1000000000002',
    brand: 'Widgetco',
    typical_qty: 3,
    substitutes_allowed: true
  });
  Object.keys(built.set).forEach(function (col) {
    assert.ok(ENRICH_ALLOWED_COLUMNS.indexOf(col) !== -1, col + ' must be allowlisted');
  });
});

test('ALLOWLIST ENFORCEMENT: any non-allowlisted column THROWS', function () {
  // Every column that really exists on asdair.regulars but is NOT allowlisted,
  // plus a column that does not exist at all.
  const forbidden = [
    'id', 'household_id', 'high_level_category', 'category', 'name',
    'source', 'active', 'created_at', 'no_such_column'
  ];
  forbidden.forEach(function (col) {
    const set = {};
    set[col] = 'anything';
    assert.throws(
      function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: set }); },
      new RegExp('may not update "' + col + '"'),
      col + ' must be refused'
    );
  });
});

test('the three named hazards are refused WITH THE REASON, not just "denied"', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { active: false } }); },
    /retiring a regular is a deliberate human act/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { name: 'Something Else' } }); },
    /identity and what the planner matches on/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { household_id: 2 } }); },
    /stops one household's preferences reaching another's basket/
  );
});

test('a forbidden column is refused EVEN WHEN mixed in with perfectly valid ones', function () {
  assert.throws(
    function () {
      buildRegularsUpdate({
        op: 'enrichRegular',
        id: 4,
        set: { asda_product_id: '1000000000003', active: false }
      });
    },
    /may not update "active"/
  );
});

test('updated_at is allowlisted but may never be supplied: the writer owns it', function () {
  assert.throws(
    function () {
      buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { updated_at: '1999-01-01T00:00:00.000Z' } });
    },
    /written by the writer as the SQL literal now\(\)/
  );
});

test('enrichRegular refuses a missing id, and an enrichment that changes nothing', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', set: { brand: 'Widgetco' } }); },
    /id is required/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 0, set: { brand: 'Widgetco' } }); },
    /must be a positive integer id/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4 }); },
    /must change something/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: {} }); },
    /must change something/
  );
});

test('substitutes_allowed must be an explicit boolean even on an enrich', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { substitutes_allowed: 'true' } }); },
    /must be exactly true or false/
  );
});

// ---------------------------------------------------------------------
// aka -- MERGE, NEVER CLOBBER
// ---------------------------------------------------------------------

test('aka can NEVER be assigned directly -- only added to', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { aka: ['only', 'these'] } }); },
    /may not SET "aka" directly/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { aka: [] } }); },
    /destroy prior learning/
  );
});

test('an add_aka enrichment cannot produce an aka value without reading the database first', function () {
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['blue milk'] });
  assert.equal(built.requires_existing_aka, true);
  assert.equal(built.set.aka, undefined, 'no aka may exist before the existing aliases are read');
  assert.equal(built.expected_aka, null);
});

test('the merge is a UNION: existing aliases come first, in order, and are never dropped', function () {
  const existing = ['arla 4pt milk', 'arla 4pt', 'arla 4pts', 'arla semi', '4pt milk', 'milk'];
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['blue milk', 'the blue one'] });
  const merged = applyAkaMerge(built, existing, 'Widget A Semi Skimmed');

  assert.deepEqual(merged.set.aka, existing.concat(['blue milk', 'the blue one']));
  // Structural: the result always STARTS with the existing array, unchanged.
  assert.deepEqual(merged.set.aka.slice(0, existing.length), existing);
  assert.equal(merged.requires_existing_aka, false);
  // And the array it was computed from is kept for the optimistic guard.
  assert.deepEqual(merged.expected_aka, existing);
});

test('the merge DE-DUPLICATES case-insensitively and normalises what it adds', function () {
  const existing = ['blue milk', 'milk'];
  const built = buildRegularsUpdate({
    op: 'enrichRegular',
    id: 4,
    add_aka: ['Blue Milk', '  MILK  ', 'blue   milk', 'skimmed', 'Skimmed']
  });
  const merged = applyAkaMerge(built, existing, 'Widget A');
  assert.deepEqual(merged.set.aka, ['blue milk', 'milk', 'skimmed']);
});

test('NULL and [] are both treated as "no aliases yet"', function () {
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['blue milk'] });

  assert.deepEqual(applyAkaMerge(built, null, 'Widget A').set.aka, ['blue milk']);
  assert.deepEqual(applyAkaMerge(built, [], 'Widget A').set.aka, ['blue milk']);
  assert.deepEqual(applyAkaMerge(built, undefined, 'Widget A').set.aka, ['blue milk']);
  // A NULL read must still be recorded as [] for the optimistic guard, never null.
  assert.deepEqual(applyAkaMerge(built, null, 'Widget A').expected_aka, []);
});

test('the merge never adds the regular\'s own name as an alias of itself...', function () {
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['Widget A', 'the widget'] });
  assert.deepEqual(applyAkaMerge(built, [], 'widget   a').set.aka, ['the widget']);
});

test('...but it never REMOVES an existing alias equal to the name either (it does not edit history)', function () {
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['the widget'] });
  const merged = applyAkaMerge(built, ['widget a', 'blue one'], 'Widget A');
  assert.deepEqual(merged.set.aka, ['widget a', 'blue one', 'the widget']);
});

test('mergeAka is total and order-preserving for the awkward inputs', function () {
  assert.deepEqual(mergeAka([], [], null), []);
  assert.deepEqual(mergeAka(null, null, null), []);
  // Empty and whitespace-only aliases are dropped, never stored.
  assert.deepEqual(mergeAka(['a'], ['', '   ', '\t'], null), ['a']);
  // Order of ADDITIONS is preserved too.
  assert.deepEqual(mergeAka(['a'], ['d', 'c', 'b'], null), ['a', 'd', 'c', 'b']);
});

test('add_aka is validated purely, before anything is read', function () {
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: 'blue milk' }); },
    /must be an array of alias strings/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: [] }); },
    /must not be empty/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['ok', '   '] }); },
    /must be a non-empty alias/
  );
  assert.throws(
    function () { buildRegularsUpdate({ op: 'enrichRegular', id: 4, add_aka: ['ok', { a: 1 }] }); },
    /must be a string alias/
  );
});

test('applyAkaMerge is a no-op for operations that do not touch aliases', function () {
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: { brand: 'Widgetco' } });
  assert.equal(applyAkaMerge(built, ['x'], 'Widget A'), built, 'the very same object is returned');

  const upsert = buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular() });
  assert.equal(applyAkaMerge(upsert, ['x'], 'Widget A'), upsert);
});

// ---------------------------------------------------------------------
// Normalisation must match the READ path
// ---------------------------------------------------------------------

test('normaliseAlias matches skill/planner.js normaliseTerm exactly', function () {
  // The read path: String(value).trim().toLowerCase().replace(/\s+/g, ' ')
  const cases = [
    ['  Arla 4pt  Milk ', 'arla 4pt milk'],
    ['MILK', 'milk'],
    ['a\tb\nc', 'a b c'],
    ['', ''],
    ['   ', '']
  ];
  cases.forEach(function (c) {
    assert.equal(normaliseAlias(c[0]), c[1]);
  });
  assert.equal(normaliseAlias(null), '');
  assert.equal(normaliseAlias(undefined), '');

  // Pinned against the read path's own source, so a drift in either is caught.
  const planner = fs.readFileSync(path.join(__dirname, '..', 'skill', 'planner.js'), 'utf8');
  assert.match(
    planner,
    /function normaliseTerm\(value\) \{[\s\S]*?String\(value\)\.trim\(\)\.toLowerCase\(\)\.replace\(\/\\s\+\/g, ' '\)/,
    'skill/planner.js normaliseTerm has changed -- the stored alias form must be updated to match it'
  );
});

// ---------------------------------------------------------------------
// PURITY
// ---------------------------------------------------------------------

test('the builder is PURE: no DB, no network, no fs, no clock, no randomness', function () {
  const src = fs.readFileSync(path.join(__dirname, 'buildRegularsUpdate.js'), 'utf8');
  assert.equal(/require\(/.test(src), false, 'a pure builder requires nothing at all');
  assert.equal(/Date\.now|new Date\(\)/.test(src), false, 'no clock');
  assert.equal(/Math\.random/.test(src), false, 'no randomness');
  assert.equal(/process\.env/.test(src), false, 'no environment');
});

test('the builder never mutates its arguments', function () {
  const regular = newRegular({ aka: ['Blue Milk'] });
  const frozenInput = JSON.parse(JSON.stringify(regular));
  buildRegularsUpdate({ op: 'upsertRegular', regular: regular });
  assert.deepEqual(regular, frozenInput);

  const set = { brand: 'Widgetco' };
  const add = ['blue milk'];
  const built = buildRegularsUpdate({ op: 'enrichRegular', id: 4, set: set, add_aka: add });
  const existing = ['milk'];
  applyAkaMerge(built, existing, 'Widget A');
  assert.deepEqual(set, { brand: 'Widgetco' }, 'the caller set object is untouched');
  assert.deepEqual(add, ['blue milk'], 'the caller add_aka array is untouched');
  assert.deepEqual(existing, ['milk'], 'the array read from the database is untouched');
  assert.equal(built.set.aka, undefined, 'applyAkaMerge returns a NEW object, it does not mutate');
});

test('given identical inputs it returns an identical result', function () {
  const a = buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular() });
  const b = buildRegularsUpdate({ op: 'upsertRegular', regular: newRegular() });
  assert.deepEqual(a, b);
});
