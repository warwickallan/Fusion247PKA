// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: schemaCompat.test.js
//
// Runs under: node --test
//
// Catches SCHEMA / CODE DRIFT without a database: every column this module
// writes must actually exist on the committed table definition, and every
// CHECK vocabulary it validates in JavaScript must match the one the database
// will enforce.
//
// The migration that creates these tables (db/006_shop_control_surface.sql) is
// delivered by a sibling work package. Until it lands on the same branch these
// checks SKIP with a loud reason rather than failing - they must never be the
// thing that blocks the migration merging, but they must start biting the
// moment it does.
//
// NO DATABASE. This reads the .sql file as text.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CONFIRMATION_COLUMNS, LINE_COLUMNS } = require('./recordConfirmation');
const { PRICE_BASIS, SOURCE_KINDS } = require('./parseConfirmation');
const { OUTCOMES } = require('./reconcile');

const MIGRATION = path.join(__dirname, '..', 'db', '006_shop_control_surface.sql');

function loadSql() {
  if (!fs.existsSync(MIGRATION)) return null;
  return fs.readFileSync(MIGRATION, 'utf8');
}

// The body of `create table if not exists asdair.<name> ( ... );`
function tableBody(sql, name) {
  const re = new RegExp('create\\s+table\\s+if\\s+not\\s+exists\\s+asdair\\.' + name + '\\s*\\(', 'i');
  const m = re.exec(sql);
  assert.ok(m, 'asdair.' + name + ' is not defined in ' + path.basename(MIGRATION));
  let depth = 1;
  let i = m.index + m[0].length;
  for (; i < sql.length && depth > 0; i++) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') depth -= 1;
  }
  return sql.slice(m.index + m[0].length, i - 1);
}

function hasColumn(body, column) {
  return new RegExp('(^|\\n)\\s*' + column + '\\s+[a-z]', 'i').test(body);
}

// The literal list inside `check (<column> in ('a','b'))`.
function checkVocabulary(body, column) {
  const re = new RegExp('check\\s*\\(\\s*' + column + '\\s+in\\s*\\(([^)]*)\\)', 'i');
  const m = re.exec(body);
  if (!m) return null;
  return m[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); });
}

const SKIP_REASON = 'db/006_shop_control_surface.sql is not on this branch yet (it is delivered by a sibling ' +
  'work package). These checks start enforcing as soon as it lands.';

test('every asdair.order_confirmation column this writer INSERTs exists in the migration', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation');
  CONFIRMATION_COLUMNS.forEach(function (col) {
    assert.ok(hasColumn(body, col), 'asdair.order_confirmation.' + col + ' is missing from the migration');
  });
});

test('every asdair.order_confirmation_line column this writer INSERTs exists in the migration', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation_line');
  LINE_COLUMNS.forEach(function (col) {
    if (col === 'confirmation_id') {
      assert.ok(/confirmation_id\s+bigint/i.test(body), 'confirmation_id is missing');
      return;
    }
    assert.ok(hasColumn(body, col), 'asdair.order_confirmation_line.' + col + ' is missing from the migration');
  });
});

test('the price_basis CHECK vocabulary in the database matches the one validated in code', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation_line');
  const vocab = checkVocabulary(body, 'price_basis');
  assert.ok(vocab, 'asdair.order_confirmation_line has no price_basis CHECK');
  assert.deepEqual(vocab.slice().sort(), PRICE_BASIS.slice().sort());
});

test('the source_kind CHECK vocabulary in the database matches the one validated in code', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation');
  const vocab = checkVocabulary(body, 'source_kind');
  assert.ok(vocab, 'asdair.order_confirmation has no source_kind CHECK');
  assert.deepEqual(vocab.slice().sort(), SOURCE_KINDS.slice().sort());
});

test('the natural-key lookup is possible: `parsed` is a jsonb column', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation');
  assert.match(body, /\n\s*parsed\s+jsonb/i,
    'the (shop_id, content_fingerprint) natural key is read from parsed->>\'content_fingerprint\'');
});

test('if the database ever constrains `outcome`, every outcome this module emits must be allowed by it', function (t) {
  const sql = loadSql();
  if (sql === null) { t.skip(SKIP_REASON); return; }
  const body = tableBody(sql, 'order_confirmation_line');
  const vocab = checkVocabulary(body, 'outcome');
  if (vocab === null) {
    // No CHECK today. The vocabulary is enforced in recordConfirmation's
    // assertRecordable instead; this test exists so that adding a CHECK later
    // that omits an outcome (`price_missing` is the one at risk - the column
    // comment in 006 does not list it) fails here rather than in production.
    return;
  }
  OUTCOMES.forEach(function (o) {
    assert.ok(vocab.indexOf(o) !== -1, 'the outcome "' + o + '" would be rejected by the database CHECK');
  });
});
