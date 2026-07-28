// =====================================================================
// IDEA-012 AsdAIr - the learning writer: schemaCompatRegulars.test.js
//
// Runs under: node --test
//
// STATIC schema/code compatibility guard for the REGULARS write path. NO live
// database, no network, no pg connection is ever opened here -- it reads the
// committed migration off disk and compares it with the column lists the
// writer actually uses (imported as the shared constants, NOT hand-copied
// lists, so they cannot silently rot out of sync with the real SQL).
//
// WHY THIS EXISTS (the bug it guards against):
//   A clean database built from git alone runs db/001_asdair_schema.sql and
//   db/004_asdair_regulars.sql and nothing else (the seed with real household
//   data is gitignored). If the writer INSERTs or UPDATEs a column the
//   migration never creates, the failure would surface at run time, during a
//   shop, as lost learning. This makes it surface in CI.
//
//   It also pins the ALLOWLIST against the real table: every allowlisted
//   column must exist, and -- more importantly -- the columns that must NEVER
//   be updated must be shown to be ABSENT from the allowlist even though they
//   ARE on the table. A test that only checked "allowlist columns exist" would
//   pass just as happily with `name` added to the allowlist.
//
// The migration parser is deliberately a local copy of the one in
// schemaCompat.test.js (which is itself a copy of skill/schemaCompat.test.js):
// these guards must not depend on each other, and additive files may not edit
// the existing test.
//
// PURE ASCII only. Synthetic strings only; no real household data.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  REGULAR_INSERT_COLUMNS,
  ENRICH_ALLOWED_COLUMNS,
  ENRICH_WRITER_OWNED
} = require('./buildRegularsUpdate');
const { _internal } = require('./updateRegulars');

const DB_DIR = path.join(__dirname, '..', 'db');
const REGULARS_PATH = path.join(DB_DIR, '004_asdair_regulars.sql');

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

function readRegularsMigration() {
  assert.ok(fs.existsSync(REGULARS_PATH), 'expected ' + REGULARS_PATH + ' to exist');
  return fs.readFileSync(REGULARS_PATH, 'utf8');
}

// ---------------------------------------------------------------------

test('every column the regulars writer INSERTs is defined on asdair.regulars', function () {
  const cols = parseTableColumns(readRegularsMigration(), 'asdair.regulars');
  REGULAR_INSERT_COLUMNS.forEach(function (col) {
    assert.ok(cols.indexOf(col) !== -1,
      'updateRegulars inserts "' + col + '" but asdair.regulars has no such column in 004_asdair_regulars.sql');
  });
});

test('every ALLOWLISTED column really exists on asdair.regulars', function () {
  const cols = parseTableColumns(readRegularsMigration(), 'asdair.regulars');
  ENRICH_ALLOWED_COLUMNS.forEach(function (col) {
    assert.ok(cols.indexOf(col) !== -1,
      'the enrich allowlist names "' + col + '" but asdair.regulars has no such column');
  });
});

test('the columns that must NEVER be updated exist on the table and are ABSENT from the allowlist', function () {
  const cols = parseTableColumns(readRegularsMigration(), 'asdair.regulars');
  // These are real columns -- that is exactly why their absence from the
  // allowlist is the guarantee, rather than an accident of them not existing.
  ['id', 'household_id', 'high_level_category', 'category', 'name', 'source', 'active', 'created_at']
    .forEach(function (col) {
      assert.ok(cols.indexOf(col) !== -1, col + ' should exist on asdair.regulars');
      assert.equal(ENRICH_ALLOWED_COLUMNS.indexOf(col), -1,
        col + ' must NEVER be on the enrich allowlist');
    });
});

test('the allowlist is a strict subset of the table, and updated_at is the only writer-owned column', function () {
  const cols = parseTableColumns(readRegularsMigration(), 'asdair.regulars');
  assert.ok(ENRICH_ALLOWED_COLUMNS.length < cols.length, 'the allowlist must be a STRICT subset');
  assert.deepEqual(ENRICH_WRITER_OWNED, ['updated_at']);
  assert.deepEqual(Object.keys(_internal.ENRICH_LITERALS), ENRICH_WRITER_OWNED);
});

test('aka is text[] NOT NULL defaulting to the empty array -- the shape the merge is built for', function () {
  const sql = readRegularsMigration();
  assert.match(sql, /aka\s+text\[\]\s+not null\s+default\s+'\{\}'::text\[\]/,
    'the alias merge is implemented against text[]; if this column type changes, mergeAka must change with it');
});

test('the dedupe probe normalises name in SQL exactly as the builder does in JS', function () {
  // trim -> collapse internal whitespace -> lower-case, both sides.
  assert.match(
    _internal.FIND_REGULAR_BY_NORMALISED_NAME_SQL,
    /lower\(regexp_replace\(btrim\(name\), '\\s\+', ' ', 'g'\)\)/
  );
  // Scoped to the household, and deliberately NOT to `source`: the same item
  // from a different source is still the same item.
  assert.match(_internal.FIND_REGULAR_BY_NORMALISED_NAME_SQL, /WHERE household_id = \$1 AND/);
  assert.equal(/source = /.test(_internal.FIND_REGULAR_BY_NORMALISED_NAME_SQL), false);
  // Deterministic adoption.
  assert.match(_internal.FIND_REGULAR_BY_NORMALISED_NAME_SQL, /ORDER BY id ASC/);
});

test('the UNIQUE identity the ON CONFLICT target names really exists in the migration', function () {
  assert.match(readRegularsMigration(), /unique \(household_id, source, name\)/);
});

test('the read path this writer must stay compatible with is untouched (skill/ is read-only by contract)', function () {
  const dataJs = fs.readFileSync(path.join(__dirname, '..', 'skill', 'data.js'), 'utf8');
  // Every column loadRegulars SELECTs must still exist on the table, so an
  // enrichment can never write something the planner cannot read back.
  const cols = parseTableColumns(readRegularsMigration(), 'asdair.regulars');
  ['aka', 'asda_product_id', 'asda_url', 'brand', 'typical_qty', 'substitutes_allowed'].forEach(function (col) {
    assert.ok(dataJs.indexOf("'" + col + "'") !== -1, 'skill/data.js should still SELECT ' + col);
    assert.ok(cols.indexOf(col) !== -1);
  });
  // And the skill is still SELECT-only: it must contain no write of its own.
  const code = dataJs.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/\b(INSERT INTO|UPDATE\s+asdair|DELETE FROM)\b/i.test(code), false,
    'services/asdair/skill/ is read-only by contract and must contain no writer');
});
