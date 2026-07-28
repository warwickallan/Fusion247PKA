// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: schemaCompat.test.js
//
// Runs under: node --test
//
// STATIC schema/code compatibility guard for the WRITE side. NO live
// database, no network, no pg connection is ever opened here -- it reads the
// committed migrations off disk and compares them with the column lists the
// writers actually INSERT (imported as the shared constants, NOT hand-copied
// lists, so they cannot silently rot out of sync with the real SQL).
//
// WHY THIS EXISTS (the bug it guards against):
//   A clean database built from git alone runs db/001_asdair_schema.sql and
//   db/004_asdair_regulars.sql and nothing else (the seed with real
//   household data is gitignored). If a writer INSERTs a column the
//   migrations never create -- or if a CHECK vocabulary drifts from the one
//   the code validates against -- the failure would surface at run time, on
//   a real shop, as a lost outcome. This test makes it surface in CI.
//
// It also guards the outcome writers' HARD RULE at the schema level: the
// checked_out columns must exist and be exactly the two the writer pins to
// SQL literals.
//
// PURE ASCII only. Synthetic strings only; no real household data.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ORDER_COLUMNS, EVENT_TYPES } = require('./buildOutcome');
const { _internal } = require('./promoteDecision');

const DB_DIR = path.join(__dirname, '..', 'db');
const SCHEMA_PATH = path.join(DB_DIR, '001_asdair_schema.sql');
const REGULARS_PATH = path.join(DB_DIR, '004_asdair_regulars.sql');

// ---------------------------------------------------------------------
// Parse the column names defined on a given table's `create table` block.
// Same strategy as skill/schemaCompat.test.js: find the create-table marker,
// walk the parentheses with a depth counter to the MATCHING close paren
// (check(...) / references(...) nest), then take the first bareword token of
// each line, skipping comments, blanks and table-level constraint leaders.
// ---------------------------------------------------------------------
const NON_COLUMN_LEADERS = new Set([
  'check', 'unique', 'primary', 'foreign', 'constraint', 'references', 'create'
]);

function parseTableColumns(sql, tableName) {
  const marker = 'create table if not exists ' + tableName;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, 'create table for ' + tableName + ' not found in the migration');

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
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, 'matching close paren for ' + tableName + ' not found');

  const columns = [];
  sql.slice(open + 1, end).split('\n').forEach(function (rawLine) {
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

// Parse a `check (<column> in ('a','b'))` value list.
function parseCheckValues(sql, column) {
  const re = new RegExp('check\\s*\\(\\s*' + column + '\\s+in\\s*\\(([^)]*)\\)', 'i');
  const m = sql.match(re);
  assert.ok(m, 'CHECK constraint on ' + column + ' not found');
  const values = [];
  const q = /'([^']*)'/g;
  let hit;
  while ((hit = q.exec(m[1])) !== null) values.push(hit[1]);
  return values;
}

function readSchema() {
  assert.ok(fs.existsSync(SCHEMA_PATH), 'expected ' + SCHEMA_PATH + ' to exist');
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

// ---------------------------------------------------------------------

test('every column the outcome writer INSERTs is defined on asdair.orders', function () {
  const cols = parseTableColumns(readSchema(), 'asdair.orders');
  ORDER_COLUMNS.forEach(function (col) {
    assert.ok(cols.indexOf(col) !== -1,
      'recordShopOutcome inserts "' + col + '" but asdair.orders has no such column in 001_asdair_schema.sql');
  });
  // The two columns the writer pins to SQL literals must really exist.
  assert.ok(cols.includes('checked_out'));
  assert.ok(cols.includes('checked_out_at'));
});

test('the order_events CHECK vocabulary matches the one the code validates against', function () {
  const values = parseCheckValues(readSchema(), 'event_type');
  assert.deepEqual(values.slice().sort(), EVENT_TYPES.slice().sort());
});

test('every column promoteDecision INSERTs is defined on asdair.rule_qa_log and asdair.rules', function () {
  const sql = readSchema();

  const logCols = parseTableColumns(sql, 'asdair.rule_qa_log');
  _internal.LOG_COLUMNS.forEach(function (col) {
    assert.ok(logCols.indexOf(col) !== -1, 'rule_qa_log has no column "' + col + '"');
  });
  // The back-link this module exists to write.
  assert.ok(logCols.includes('promoted_rule_id'));

  const ruleCols = parseTableColumns(sql, 'asdair.rules');
  _internal.RULE_COLUMNS.forEach(function (col) {
    assert.ok(ruleCols.indexOf(col) !== -1, 'asdair.rules has no column "' + col + '"');
  });
});

test('the rules directive and scope vocabularies match the ones promoteDecision enforces', function () {
  const sql = readSchema();
  assert.deepEqual(parseCheckValues(sql, 'directive').slice().sort(), _internal.DIRECTIVES.slice().sort());
  assert.deepEqual(parseCheckValues(sql, 'scope').slice().sort(), _internal.SCOPES.slice().sort());
});

test('004_asdair_regulars.sql defines asdair.regulars with exactly the live columns', function () {
  assert.ok(fs.existsSync(REGULARS_PATH), 'expected ' + REGULARS_PATH + ' to exist');
  const sql = fs.readFileSync(REGULARS_PATH, 'utf8');
  const cols = parseTableColumns(sql, 'asdair.regulars');

  assert.deepEqual(cols, [
    'id',
    'household_id',
    'high_level_category',
    'category',
    'name',
    'asda_product_id',
    'asda_url',
    'typical_qty',
    'source',
    'active',
    'created_at',
    'updated_at',
    'brand',
    'aka',
    'substitutes_allowed'
  ]);

  // Idempotent, and the three live index names are reproduced.
  assert.match(sql, /create table if not exists asdair\.regulars/);
  assert.match(sql, /create index if not exists regulars_household_category_idx/);
  assert.match(sql, /create index if not exists regulars_household_brand_idx/);
  assert.match(sql, /create index if not exists regulars_aka_gin[\s\S]*using gin \(aka\)/);
  assert.match(sql, /unique \(household_id, source, name\)/);
});

test('the migrations are pure ASCII and ship no rows (structure only, no personal data)', function () {
  [SCHEMA_PATH, REGULARS_PATH].forEach(function (p) {
    const sql = fs.readFileSync(p, 'utf8');
    // eslint-disable-next-line no-control-regex
    assert.equal(/[^\x00-\x7F]/.test(sql), false, path.basename(p) + ' must be pure ASCII');
    assert.equal(/insert\s+into/i.test(sql), false, path.basename(p) + ' must ship columns, never rows');
    assert.equal(/copy\s+asdair\./i.test(sql), false, path.basename(p) + ' must ship columns, never rows');
  });
});
