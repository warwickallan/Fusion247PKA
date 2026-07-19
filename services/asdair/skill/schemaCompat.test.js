// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: schemaCompat.test.js
//
// Runs under: node --test
//
// STATIC schema/code compatibility guard. NO live database, no network,
// no pg connection is ever opened here -- it reads two files off disk and
// compares them:
//
//   1. The columns DEFINED on asdair.rules in db/001_asdair_schema.sql.
//   2. The columns data.js loadRules() SELECTs (imported as the single
//      exported constant RULES_SELECT_COLUMNS -- NOT a hand-copied list, so
//      it cannot silently rot out of sync with the real query).
//
// WHY THIS EXISTS (the bug it guards against):
//   A clean database built from git alone runs 001_asdair_schema.sql and
//   nothing else (the seed with real household data is gitignored). If
//   loadRules() SELECTs a column that the migration never creates, the
//   read-only CLI throws "column ... does not exist" the moment it runs.
//   This test makes that failure show up in CI instead of in production:
//   every column the code selects MUST be defined by the committed schema.
//
// PROOF THE TEST FAILS ON A MISSING COLUMN:
//   The core assertion loops over RULES_SELECT_COLUMNS and asserts each one
//   is present in the set parsed from the migration. assert.ok(false, ...)
//   throws, which fails the test. So if someone deletes (say) `directive`
//   from the create-table block, or adds a new selected column to
//   RULES_SELECT_COLUMNS without adding it to the migration, this test goes
//   red. (Sanity-checked below by parsing a synthetic create-table string
//   that is deliberately missing a column and asserting the same comparison
//   reports it as missing.)
//
// PURE ASCII only. Synthetic strings only; no real household data.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { RULES_SELECT_COLUMNS } = require('./data');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', '001_asdair_schema.sql');

// ---------------------------------------------------------------------
// Parse the column names defined on a given table's `create table` block.
//
// Strategy: locate `create table ... <tableName> (`, walk the parentheses
// with a depth counter to find the MATCHING close paren (there are nested
// parens inside check(...) and references(...) clauses), then read the body.
// For each line inside the body, take the first bareword token. A real
// column definition starts with the column NAME; table-level constraints and
// wrapped continuation lines start with a SQL keyword (check / unique /
// primary / foreign / constraint / references / create), so those tokens are
// filtered out. Comment ('--') and blank lines are skipped.
// ---------------------------------------------------------------------
const NON_COLUMN_LEADERS = new Set([
  'check', 'unique', 'primary', 'foreign', 'constraint', 'references', 'create'
]);

function parseTableColumns(sql, tableName) {
  const marker = 'create table if not exists ' + tableName;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, 'create table for ' + tableName + ' not found in schema');

  const open = sql.indexOf('(', start);
  assert.notEqual(open, -1, 'open paren for ' + tableName + ' not found');

  let depth = 0;
  let end = -1;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.notEqual(end, -1, 'matching close paren for ' + tableName + ' not found');

  const body = sql.slice(open + 1, end);
  const columns = [];
  body.split('\n').forEach(function (rawLine) {
    const line = rawLine.trim();
    if (line === '' || line.indexOf('--') === 0) return;
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (!m) return;
    const token = m[1].toLowerCase();
    if (NON_COLUMN_LEADERS.has(token)) return;
    if (columns.indexOf(token) === -1) columns.push(token);
  });
  return columns;
}

// ---------------------------------------------------------------------
// Parse the value list from the `check (directive in ('...','...'))` clause
// on the rules table. Returns the quoted tokens in the order written.
// ---------------------------------------------------------------------
function parseDirectiveCheckValues(sql) {
  const m = sql.match(/check\s*\(\s*directive\s+in\s*\(([^)]*)\)/i);
  assert.ok(m, "directive CHECK constraint not found on asdair.rules");
  const inner = m[1];
  const values = [];
  const re = /'([^']*)'/g;
  let hit;
  while ((hit = re.exec(inner)) !== null) {
    values.push(hit[1]);
  }
  return values;
}

// ---------------------------------------------------------------------

test('the migration file exists and defines asdair.rules', function () {
  assert.ok(fs.existsSync(SCHEMA_PATH), 'expected ' + SCHEMA_PATH + ' to exist');
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const cols = parseTableColumns(sql, 'asdair.rules');
  assert.ok(cols.length > 0, 'no columns parsed from asdair.rules');
  // Spot-check a couple of long-standing columns are seen by the parser.
  assert.ok(cols.includes('id'), 'parser should see the id column');
  assert.ok(cols.includes('rule_text'), 'parser should see the rule_text column');
});

test('every column loadRules() SELECTs is defined on asdair.rules in the migration', function () {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const schemaColumns = parseTableColumns(sql, 'asdair.rules');

  // The heart of the drift guard. If a selected column is not defined by the
  // committed schema, a clean git-built DB would make the read-only CLI throw
  // at runtime -- so we FAIL here instead.
  RULES_SELECT_COLUMNS.forEach(function (col) {
    const present = schemaColumns.indexOf(col.toLowerCase()) !== -1;
    assert.ok(
      present,
      'loadRules() selects "' + col + '" but asdair.rules has no such column in 001_asdair_schema.sql'
    );
  });

  // Explicitly assert the previously-drifted structured columns are present.
  ['directive', 'match_term', 'match_category', 'matched_product', 'reason', 'note'].forEach(function (col) {
    assert.ok(schemaColumns.includes(col), 'asdair.rules must define the ' + col + ' column');
  });
});

test('the directive CHECK lists exactly the planner vocabulary: info, exclude, needs_decision, map', function () {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const values = parseDirectiveCheckValues(sql);
  // "Exactly" = these four, no more, no fewer. Order in a CHECK is not
  // semantically meaningful, so compare as sorted sets. planner.js branches on
  // precisely this vocabulary (actionableRules ignores 'info'; the map /
  // needs_decision / exclude directives drive the plan).
  const expected = ['exclude', 'info', 'map', 'needs_decision'];
  assert.deepEqual(values.slice().sort(), expected);
});

// ---------------------------------------------------------------------
// Sanity check: prove the comparison logic actually detects a missing
// column, using a SYNTHETIC create-table string (nothing real, no DB). This
// demonstrates that the assertion above would fail if the schema regressed.
// ---------------------------------------------------------------------
test('drift guard proof: a schema missing a selected column is detected as missing', function () {
  const brokenSchema =
    'create table if not exists asdair.rules (\n' +
    '    id       bigint generated by default as identity primary key,\n' +
    '    category text not null,\n' +
    '    active   boolean not null default true\n' +   // note: no `directive` column
    ');\n';
  const cols = parseTableColumns(brokenSchema, 'asdair.rules');
  assert.ok(cols.includes('id'));
  assert.ok(cols.includes('active'));
  // The selected column `directive` is NOT defined here -> the same check the
  // real test performs would report it missing (present === false).
  const present = cols.indexOf('directive') !== -1;
  assert.equal(present, false, 'the broken synthetic schema must be seen as missing directive');
});
