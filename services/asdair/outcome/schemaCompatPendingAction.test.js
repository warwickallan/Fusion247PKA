// =====================================================================
// BUILD-015 AsdAIr - the learning loop: schemaCompatPendingAction.test.js
//
// Runs under: node --test
//
// STATIC schema/code compatibility guard for the ONE table recordAnswerLearning
// writes that no other writer in outcome/ touches: asdair.pending_action. NO
// live database, no network, no pg connection is ever opened here -- it reads
// the committed migration off disk and compares it with the SQL the writer
// actually issues.
//
// WHY THIS EXISTS. recordAnswerLearning is the first and only writer of
// asdair.pending_action. Its INSERT names six columns and relies on a PARTIAL
// unique index; if any of those disagreed with db/006_shop_control_surface.sql,
// the failure would surface at run time, mid-shop, as an un-clicked ASDA
// Favourite silently lost -- which is the exact class of loss the pending_action
// table exists to prevent. This makes it surface in CI instead.
//
// It also pins the ON CONFLICT target against the migration's real partial
// index. An ON CONFLICT naming a predicate Postgres cannot match raises 42P10
// at run time, not at parse time, so nothing else would catch it.
//
// The migration parser is deliberately a local copy of the one in
// schemaCompatRegulars.test.js, which is itself a local copy: these guards must
// not depend on one another, and an additive file may not edit an existing test.
//
// PURE ASCII only. Synthetic strings only; no real household data.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { _internal } = require('./recordAnswerLearning');
const { ADD_FAVOURITE_ACTION } = require('./buildAnswerLearning');

const CONTROL_SURFACE_PATH = path.join(__dirname, '..', 'db', '006_shop_control_surface.sql');

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

function readMigration() {
  assert.ok(fs.existsSync(CONTROL_SURFACE_PATH), 'expected ' + CONTROL_SURFACE_PATH + ' to exist');
  return fs.readFileSync(CONTROL_SURFACE_PATH, 'utf8');
}

// The columns the INSERT actually names, read out of the SQL the writer issues
// rather than hand-copied here - a hand-copied list is exactly what rots.
function insertedColumns() {
  const m = _internal.PENDING_ACTION_SQL.match(/INSERT INTO asdair\.pending_action\s*\(([^)]+)\)/i);
  assert.ok(m, 'the pending_action INSERT must name its columns explicitly');
  return m[1].split(',').map(function (c) { return c.trim().toLowerCase(); });
}

// ---------------------------------------------------------------------

test('every column the pending_action writer INSERTs is defined on asdair.pending_action', function () {
  const cols = parseTableColumns(readMigration(), 'asdair.pending_action');
  insertedColumns().forEach(function (col) {
    assert.ok(cols.indexOf(col) !== -1,
      'recordAnswerLearning inserts "' + col + '" but asdair.pending_action has no such column in ' +
      '006_shop_control_surface.sql');
  });
});

test('the writer supplies no column the table does not default or allow to be null', function () {
  // status, created_at and resolved_at are deliberately NOT written: the first
  // two have defaults and the third is set when a human resolves the action.
  const inserted = insertedColumns();
  ['status', 'created_at', 'resolved_at', 'id'].forEach(function (col) {
    assert.equal(inserted.indexOf(col), -1,
      '"' + col + '" is owned by the database or by a later human act, and must not be written here');
  });
});

test('every NOT NULL column without a default IS supplied by the writer', function () {
  // household_id, action_type and action_key are NOT NULL with no default.
  // Omitting one would raise a 23502 mid-shop.
  const inserted = insertedColumns();
  ['household_id', 'action_type', 'action_key'].forEach(function (col) {
    assert.ok(inserted.indexOf(col) !== -1,
      '"' + col + '" is NOT NULL with no default and must be supplied by the INSERT');
  });
});

test('the ON CONFLICT target matches the migration\'s real PARTIAL unique index', function () {
  const sql = readMigration();
  // db/006: create unique index ... pending_action_key_uniq
  //           on asdair.pending_action (household_id, action_type, action_key)
  //           where status = 'pending';
  const idx = sql.match(
    /create unique index if not exists pending_action_key_uniq\s+on asdair\.pending_action\s*\(([^)]+)\)\s*where\s+([^;]+);/i
  );
  assert.ok(idx, 'the pending_action partial unique index must exist in the migration');

  const indexColumns = idx[1].split(',').map(function (c) { return c.trim().toLowerCase(); });
  const indexPredicate = idx[2].trim().toLowerCase().replace(/\s+/g, ' ');

  const conflict = _internal.PENDING_ACTION_SQL.match(/ON CONFLICT\s*\(([^)]+)\)\s*WHERE\s+([^\n]+?)\s*DO NOTHING/i);
  assert.ok(conflict, 'the INSERT must name the conflict target AND its predicate, or Postgres cannot ' +
    'match a partial index (42P10 at run time)');

  const conflictColumns = conflict[1].split(',').map(function (c) { return c.trim().toLowerCase(); });
  const conflictPredicate = conflict[2].trim().toLowerCase().replace(/\s+/g, ' ');

  assert.deepEqual(conflictColumns, indexColumns,
    'the ON CONFLICT columns must match the partial unique index exactly, in order');
  assert.equal(conflictPredicate, indexPredicate,
    'the ON CONFLICT predicate must match the index predicate, or the index cannot be inferred');
});

test('the action_type this build writes is the one the migration documents', function () {
  const sql = readMigration();
  assert.match(sql, /add_favourite/i,
    'db/006 names \'add_favourite\' as the worked example of a pending_action action_type');
  assert.equal(ADD_FAVOURITE_ACTION, 'add_favourite');
});

test('asdair_rw holds INSERT on asdair.pending_action - both halves of the boundary', function () {
  // A write path with no write grant is a blocker discovered at run time.
  const sql = readMigration();
  assert.match(sql, /grant select, insert, update on asdair\.pending_action\s+to asdair_rw/i,
    'the writing role must actually hold INSERT on the table this module writes');
});
