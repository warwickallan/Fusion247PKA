// =====================================================================
// IDEA-012 AsdAIr - the learning writer: updateRegulars.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented ids, "Widget A"-style names). ZERO real
// household data. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE. The writer's transaction shape, the SQL it emits, and its
// refusals are proven against a FAKE client that records the statements it is
// given. Nothing here opens a connection of any kind.
//
// The point of these tests is that the guarantees the pure builder makes
// SURVIVE INTO THE SQL: the UPDATE really is column-restricted, `aka` really
// is merged from what was READ, and no DELETE exists anywhere.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { updateRegulars, _internal } = require('./updateRegulars');
const { ENRICH_ALLOWED_COLUMNS, REGULAR_INSERT_COLUMNS } = require('./buildRegularsUpdate');

// ---------------------------------------------------------------------
// A fake pg client. Each entry in `responses` is matched against the SQL by
// regexp, in order of definition, and supplies the rows to return.
// ---------------------------------------------------------------------
function fakeClient(responses, options) {
  const opts = options || {};
  const calls = [];
  const table = responses || [];
  return {
    calls: calls,
    query: async function (sql, params) {
      const text = String(sql);
      calls.push({ sql: text, params: params || [] });
      if (opts.failOn && opts.failOn.test(text)) {
        throw new Error('synthetic failure on: ' + text.slice(0, 40));
      }
      for (let i = 0; i < table.length; i++) {
        if (table[i].match.test(text)) {
          const rows = table[i].rows || [];
          return { rows: rows, rowCount: rows.length };
        }
      }
      return { rows: [], rowCount: 0 };
    }
  };
}

function sqlOf(client) {
  return client.calls.map(function (c) { return c.sql; });
}

function callMatching(client, re) {
  return client.calls.find(function (c) { return re.test(c.sql); });
}

const NEW_REGULAR = {
  op: 'upsertRegular',
  regular: {
    household_id: 1,
    high_level_category: 'Chilled',
    category: 'Dairy',
    name: 'Widget A Semi Skimmed',
    brand: 'Widgetco',
    asda_product_id: '1000000000001',
    typical_qty: 2
  }
};

// ---------------------------------------------------------------------
// upsertRegular
// ---------------------------------------------------------------------

test('upsertRegular: dedupe probe FIRST, then insert, in ONE transaction', async function () {
  const client = fakeClient([
    { match: /INSERT INTO asdair\.regulars/, rows: [{ id: 77 }] }
  ]);
  const res = await updateRegulars(NEW_REGULAR, { client: client });

  assert.deepEqual(res, { op: 'upsertRegular', id: 77, created: true, adopted: false, matched_by: null });

  const statements = sqlOf(client);
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /^SELECT id, name, source, active FROM asdair\.regulars/,
    'the dedupe guard runs BEFORE anything is created');
  assert.match(statements[2], /^INSERT INTO asdair\.regulars \(/);
  assert.equal(statements[3], 'COMMIT');
  assert.equal(statements.indexOf('ROLLBACK'), -1);

  // The probe asks with the NORMALISED name, in the read path's normalisation.
  assert.deepEqual(client.calls[1].params, [1, 'widget a semi skimmed']);

  // The insert is fully parameterised over the contracted column list.
  const insert = client.calls[2];
  const cols = insert.sql.match(/\(([^)]*)\) VALUES/)[1].split(',').map(function (s) { return s.trim(); });
  assert.deepEqual(cols, REGULAR_INSERT_COLUMNS);
  assert.equal(insert.params.length, REGULAR_INSERT_COLUMNS.length);
});

test('upsertRegular is SAFE TO RE-RUN: an existing normalised name is ADOPTED, and nothing is written', async function () {
  const client = fakeClient([
    {
      match: /SELECT id, name, source, active FROM asdair\.regulars/,
      rows: [{ id: 12, name: 'Widget A  Semi Skimmed', source: 'regular', active: true }]
    }
  ]);
  const res = await updateRegulars(NEW_REGULAR, { client: client });

  assert.equal(res.id, 12);
  assert.equal(res.created, false);
  assert.equal(res.adopted, true);
  assert.equal(res.matched_by, 'normalised_name');
  assert.equal(res.existing_name, 'Widget A  Semi Skimmed');

  const statements = sqlOf(client);
  assert.deepEqual(statements, ['BEGIN', statements[1], 'COMMIT']);
  assert.equal(statements.filter(function (s) { return /INSERT|UPDATE/.test(s); }).length, 0,
    'adopting must write NOTHING -- not an insert, and certainly not an update');
});

test('upsertRegular ON CONFLICT DO NOTHING is the race backstop, and it never DO UPDATEs', async function () {
  const client = fakeClient([
    { match: /INSERT INTO asdair\.regulars/, rows: [{ id: 5 }] }
  ]);
  await updateRegulars(NEW_REGULAR, { client: client });

  const insert = callMatching(client, /INSERT INTO asdair\.regulars/);
  assert.match(insert.sql, /ON CONFLICT \(household_id, source, name\) DO NOTHING RETURNING id/);
  assert.equal(/DO UPDATE/i.test(insert.sql), false,
    'DO UPDATE would be a route to rewriting an existing row, bypassing the enrich allowlist');
});

test('upsertRegular: a conflict that the probe missed falls back to adopting by exact identity', async function () {
  // The insert writes nothing (a concurrent writer won the race).
  const client = fakeClient([
    { match: /INSERT INTO asdair\.regulars/, rows: [] },
    { match: /WHERE household_id = \$1 AND source = \$2 AND name = \$3/, rows: [{ id: 31 }] }
  ]);
  const res = await updateRegulars(NEW_REGULAR, { client: client });
  assert.deepEqual(res, { op: 'upsertRegular', id: 31, created: false, adopted: true, matched_by: 'identity' });
  assert.equal(sqlOf(client).indexOf('COMMIT') !== -1, true);
});

test('upsertRegular: an insert that wrote nothing and matches nothing ROLLBACKs rather than guessing', async function () {
  const client = fakeClient([]);   // every query returns no rows
  await assert.rejects(updateRegulars(NEW_REGULAR, { client: client }), /Nothing was written/);
  const statements = sqlOf(client);
  assert.equal(statements.indexOf('COMMIT'), -1);
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
});

// ---------------------------------------------------------------------
// enrichRegular
// ---------------------------------------------------------------------

function enrichClient(existing) {
  return fakeClient([
    {
      match: /^SELECT id, name, aka, active FROM asdair\.regulars WHERE id = \$1/,
      rows: [{ id: 4, name: 'Widget A Semi Skimmed', aka: existing, active: true }]
    },
    { match: /^UPDATE asdair\.regulars/, rows: [{ id: 4 }] }
  ]);
}

test('enrichRegular: READ the row, merge, then a column-restricted UPDATE, in ONE transaction', async function () {
  const client = enrichClient(['arla 4pt', 'milk']);
  const res = await updateRegulars({
    op: 'enrichRegular',
    id: 4,
    set: { asda_product_id: '1000000000009' },
    add_aka: ['blue milk']
  }, { client: client });

  const statements = sqlOf(client);
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /^SELECT id, name, aka, active FROM asdair\.regulars WHERE id = \$1/);
  assert.match(statements[2], /^UPDATE asdair\.regulars SET /);
  assert.equal(statements[3], 'COMMIT');

  assert.equal(res.updated, true);
  assert.deepEqual(res.aka, ['arla 4pt', 'milk', 'blue milk']);
});

test('THE ALLOWLIST REACHES THE SQL: the SET clause can only name allowlisted columns', async function () {
  const client = enrichClient([]);
  await updateRegulars({
    op: 'enrichRegular',
    id: 4,
    set: { asda_product_id: 'X1', asda_url: 'https://example.invalid/x', brand: 'Widgetco', typical_qty: 3, substitutes_allowed: true }
  }, { client: client });

  const update = callMatching(client, /^UPDATE asdair\.regulars/);
  const setClause = update.sql.match(/SET ([\s\S]*?) WHERE /)[1];
  const assigned = setClause.split(',').map(function (s) { return s.trim().split(/\s*=/)[0]; });

  assigned.forEach(function (col) {
    assert.ok(ENRICH_ALLOWED_COLUMNS.indexOf(col) !== -1, col + ' is not allowlisted but reached the SQL');
  });
  // Not one of the forbidden identities can appear anywhere in the statement.
  ['name', 'household_id', 'active', 'source', 'created_at'].forEach(function (col) {
    assert.equal(new RegExp('\\b' + col + '\\s*=').test(update.sql), false,
      update.sql + ' must never assign ' + col);
  });
});

test('the UPDATE always sets updated_at as the SQL LITERAL now(), never a parameter', async function () {
  const client = enrichClient([]);
  await updateRegulars({ op: 'enrichRegular', id: 4, set: { brand: 'Widgetco' } }, { client: client });

  const update = callMatching(client, /^UPDATE asdair\.regulars/);
  assert.match(update.sql, /updated_at = now\(\)/);
  assert.equal(update.params.indexOf('now()'), -1, 'now() is in the SQL text, never a bound value');
  // brand + the id: the literal adds no parameter.
  assert.equal(update.params.length, 2);
  assert.deepEqual(_internal.ENRICH_LITERALS, { updated_at: 'now()' });
});

test('the UPDATE only ever targets the one row named, by primary key', async function () {
  const client = enrichClient([]);
  await updateRegulars({ op: 'enrichRegular', id: 4, set: { brand: 'Widgetco' } }, { client: client });

  const update = callMatching(client, /^UPDATE asdair\.regulars/);
  assert.match(update.sql, /WHERE id = \$2 RETURNING id$/);
  assert.equal(update.params[update.params.length - 1], 4);
});

test('the merged aka comes from the array READ FROM THE DATABASE, not from caller input', async function () {
  const stored = ['already', 'here'];
  const client = enrichClient(stored);
  await updateRegulars({ op: 'enrichRegular', id: 4, add_aka: ['new one'] }, { client: client });

  const update = callMatching(client, /^UPDATE asdair\.regulars/);
  // param 1 = the merged array; the last params are the id and the expected array.
  assert.deepEqual(update.params[0], ['already', 'here', 'new one']);
  assert.match(update.sql, /aka = \$1::text\[\]/);
});

test('OPTIMISTIC GUARD: an aka write is conditional on the row still holding what was read', async function () {
  const stored = ['already'];
  const client = enrichClient(stored);
  await updateRegulars({ op: 'enrichRegular', id: 4, add_aka: ['new one'] }, { client: client });

  const update = callMatching(client, /^UPDATE asdair\.regulars/);
  assert.match(update.sql, /WHERE id = \$2 AND aka = \$3::text\[\] RETURNING id$/);
  assert.deepEqual(update.params[2], stored);
});

test('a concurrent alias change loses NOTHING: zero rows updated -> ROLLBACK with a clear message', async function () {
  const client = fakeClient([
    {
      match: /^SELECT id, name, aka, active FROM asdair\.regulars/,
      rows: [{ id: 4, name: 'Widget A', aka: ['one'], active: true }]
    },
    { match: /^UPDATE asdair\.regulars/, rows: [] }      // the guard did not match
  ]);
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 4, add_aka: ['two'] }, { client: client }),
    /modified concurrently/
  );
  const statements = sqlOf(client);
  assert.equal(statements.indexOf('COMMIT'), -1, 'a lost update must never COMMIT');
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
});

test('an enrich of a regular that does not exist ROLLBACKs and says so', async function () {
  const client = fakeClient([]);
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 999, set: { brand: 'Widgetco' } }, { client: client }),
    /no asdair\.regulars row with id 999/
  );
  assert.equal(sqlOf(client).indexOf('COMMIT'), -1);
});

test('a failure part-way through ROLLBACKs and never COMMITs', async function () {
  const client = fakeClient([
    { match: /^SELECT id, name, aka, active/, rows: [{ id: 4, name: 'Widget A', aka: [], active: true }] }
  ], { failOn: /^UPDATE/ });
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 4, set: { brand: 'Widgetco' } }, { client: client }),
    /synthetic failure/
  );
  const statements = sqlOf(client);
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.indexOf('COMMIT'), -1);
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
});

// ---------------------------------------------------------------------
// The refusals reach the database as NOTHING AT ALL
// ---------------------------------------------------------------------

test('a forbidden column is refused BEFORE any query runs', async function () {
  const client = fakeClient([]);
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 4, set: { active: false } }, { client: client }),
    /may not update "active"/
  );
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 4, set: { name: 'Renamed' } }, { client: client }),
    /may not update "name"/
  );
  await assert.rejects(
    updateRegulars({ op: 'enrichRegular', id: 4, set: { aka: ['clobber'] } }, { client: client }),
    /may not SET "aka" directly/
  );
  assert.equal(client.calls.length, 0, 'not even a BEGIN may reach the database');
});

test('an unknown operation is refused before any query runs', async function () {
  const client = fakeClient([]);
  await assert.rejects(
    updateRegulars({ op: 'deleteRegular', id: 4 }, { client: client }),
    /is not one of/
  );
  assert.equal(client.calls.length, 0);
});

// ---------------------------------------------------------------------
// The three hard rules, asserted on the SOURCE TEXT so a later edit cannot
// quietly lose them.
// ---------------------------------------------------------------------

test('NEVER DELETE: no DELETE, TRUNCATE or DROP exists anywhere in the write path', function () {
  ['updateRegulars.js', 'buildRegularsUpdate.js', 'update-regulars.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    // Strip comments so the prose ("NEVER DELETE") does not trip the check.
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(/\bDELETE\s+FROM\b/i.test(code), false, f + ' must contain no DELETE');
    assert.equal(/\bTRUNCATE\b/i.test(code), false, f + ' must contain no TRUNCATE');
    assert.equal(/\bDROP\s+(TABLE|COLUMN|SCHEMA)\b/i.test(code), false, f + ' must contain no DROP');
  });
});

test('NEVER DEACTIVATE / RENAME / REHOME: the SET clause is GENERATED FROM the allowlist, not filtered against it', function () {
  // The strongest form of this test: bypass the pure builder entirely and hand
  // the SQL builder a `set` that has been stuffed with every forbidden column,
  // exactly as a compromised or buggy caller would. Because the clause is
  // generated by iterating ENRICH_ALLOWED_COLUMNS -- rather than by iterating
  // the caller's keys and rejecting the bad ones -- a column that is not on
  // the list has no path into the statement at all.
  const smuggled = {
    op: 'enrichRegular',
    id: 4,
    requires_existing_aka: false,
    expected_aka: null,
    set: {
      brand: 'Widgetco',
      active: false,
      name: 'Renamed',
      household_id: 999,
      id: 1,
      source: 'hijacked',
      created_at: '1999-01-01',
      high_level_category: 'x',
      category: 'y',
      no_such_column: 'z'
    }
  };

  const update = _internal.buildRegularUpdate(smuggled);

  const setClause = update.sql.match(/SET ([\s\S]*?) WHERE /)[1];
  const assigned = setClause.split(',').map(function (s) { return s.trim().split(/\s*=/)[0]; });
  assert.deepEqual(assigned, ['brand', 'updated_at'],
    'only the allowlisted column that was supplied, plus the writer-owned updated_at');

  ['active', 'name', 'household_id', 'source', 'created_at', 'high_level_category', 'category', 'no_such_column']
    .forEach(function (col) {
      assert.equal(new RegExp('\\b' + col + '\\s*=').test(update.sql), false,
        update.sql + ' must never assign ' + col);
    });
  // And none of the smuggled VALUES became a bound parameter either.
  assert.deepEqual(update.params, ['Widgetco', 4]);

  // The forbidden columns are simply not on the list the clause is built from.
  ['active', 'name', 'household_id', 'id', 'source', 'created_at'].forEach(function (col) {
    assert.equal(ENRICH_ALLOWED_COLUMNS.indexOf(col), -1);
  });
});

test('the writer refuses to build an UPDATE before the alias merge has been applied', function () {
  assert.throws(
    function () {
      _internal.buildRegularUpdate({
        op: 'enrichRegular', id: 4, set: { brand: 'Widgetco' },
        requires_existing_aka: true, add_aka: ['x']
      });
    },
    /applyAkaMerge must run against the aliases READ from the database/
  );
});

test('no connection string is ever hardcoded; ASDAIR_WRITE_DB_URL is the only env var read', function () {
  ['updateRegulars.js', 'update-regulars.js', 'buildRegularsUpdate.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    assert.equal(/postgres(ql)?:\/\//.test(src), false, 'no connection string literal in ' + f);
    const envReads = src.match(/process\.env\.[A-Z_]+/g) || [];
    const unique = Array.from(new Set(envReads));
    unique.forEach(function (e) {
      assert.equal(e, 'process.env.ASDAIR_WRITE_DB_URL', f + ' reads ' + e);
    });
  });
});

test('with no ASDAIR_WRITE_DB_URL configured the writer refuses clearly instead of guessing', {
  skip: process.env.ASDAIR_WRITE_DB_URL ? 'ASDAIR_WRITE_DB_URL is set in this environment' : false
}, async function () {
  await assert.rejects(updateRegulars(NEW_REGULAR), /ASDAIR_WRITE_DB_URL is not set/);
});
