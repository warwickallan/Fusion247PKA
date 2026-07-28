// =====================================================================
// BUILD-015 AsdAIr Stage 1 - schemaCompat.test.js
//
// Runs under: node --test
//
// STATIC schema/code compatibility guard for the shop control surface. NO live
// database, no network, no pg connection is ever opened - it reads the
// committed migration off disk and compares it with the constants the code
// actually uses (imported, NOT hand-copied, so they cannot silently rot).
//
// WHY THIS EXISTS: if shopState validates against a status vocabulary the
// migration's CHECK constraint does not share, or the writer INSERTs a column
// the migration never creates, the failure surfaces at run time on a real
// shop, as a lost week. This makes it surface in CI.
//
// MIGRATION 006 IS OWNED ELSEWHERE. It is authored and committed by another
// work package, so when it is not present on this branch these checks SKIP
// with a loud reason rather than failing - and they bite the moment the two
// land together. The skip is deliberate and visible; it is never silent.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const state = require('./shopState');
const store = require('./shopStore');

const MIGRATION_PATH = path.join(__dirname, '..', 'db', '006_shop_control_surface.sql');
const PRESENT = fs.existsSync(MIGRATION_PATH);
const SQL = PRESENT ? fs.readFileSync(MIGRATION_PATH, 'utf8') : '';

const SKIP = PRESENT
  ? false
  : { skip: 'db/006_shop_control_surface.sql is not on this branch (it is owned by another work package). ' +
      'These checks activate as soon as the migration lands beside this module.' };

const NON_COLUMN_LEADERS = new Set([
  'check', 'unique', 'primary', 'foreign', 'constraint', 'references', 'create'
]);

// Walk the parentheses of a `create table` block with a depth counter to the
// MATCHING close paren (check(...) and references(...) nest), then take the
// first bareword of each line. Same strategy as outcome/schemaCompat.test.js.
function parseTableColumns(sql, tableName) {
  const marker = 'create table if not exists ' + tableName;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, 'create table for ' + tableName + ' not found in migration 006');

  const open = sql.indexOf('(', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, 'unbalanced parentheses for ' + tableName);

  const body = sql.slice(open + 1, end);
  const columns = [];
  body.split('\n').forEach(function (line) {
    const trimmed = line.replace(/--.*$/, '').trim();
    if (trimmed === '') return;
    const first = trimmed.split(/[\s(,]/)[0].toLowerCase();
    if (first === '' || NON_COLUMN_LEADERS.has(first)) return;
    columns.push(first);
  });
  return columns;
}

// The values inside a `check (col in ('a','b',...))` clause.
function parseCheckVocabulary(sql, constraintName) {
  const at = sql.indexOf(constraintName);
  assert.notEqual(at, -1, 'constraint ' + constraintName + ' not found in migration 006');
  const open = sql.indexOf('in (', at);
  assert.notEqual(open, -1, 'no IN list for ' + constraintName);
  const close = sql.indexOf(')', open + 4);
  return sql.slice(open + 4, close)
    .split(',')
    .map(function (s) { return s.trim().replace(/^'|'$/g, ''); })
    .filter(function (s) { return s !== ''; });
}

test('the shop status vocabulary matches the CHECK constraint exactly', SKIP, function () {
  const fromSql = parseCheckVocabulary(SQL, 'shop_status_known');
  assert.deepEqual(fromSql.slice().sort(), state.SHOP_STATUSES.slice().sort(),
    'shopState.SHOP_STATUSES has drifted from the shop_status_known CHECK');
});

test('the source_kind vocabulary matches the CHECK constraint', SKIP, function () {
  assert.deepEqual(parseCheckVocabulary(SQL, 'shop_source_known').slice().sort(),
    state.SOURCE_KINDS.slice().sort());
});

test('the question status vocabulary matches the CHECK constraint', SKIP, function () {
  assert.deepEqual(parseCheckVocabulary(SQL, 'shop_question_status_known').slice().sort(),
    state.QUESTION_STATUSES.slice().sort());
});

test('the browser request vocabulary matches the CHECK constraint', SKIP, function () {
  assert.deepEqual(parseCheckVocabulary(SQL, 'bbr_status_known').slice().sort(),
    state.BROWSER_STATUSES.slice().sort());
});

test('the pending action vocabulary matches the CHECK constraint', SKIP, function () {
  assert.deepEqual(parseCheckVocabulary(SQL, 'pending_action_status_known').slice().sort(),
    state.PENDING_ACTION_STATUSES.slice().sort());
});

test('every column the writer INSERTs exists on the table it targets', SKIP, function () {
  const shop = parseTableColumns(SQL, 'asdair.shop');
  state.SHOP_INSERT_COLUMNS.forEach(function (col) {
    assert.ok(shop.indexOf(col) !== -1, 'asdair.shop has no column "' + col + '" in migration 006');
  });

  const question = parseTableColumns(SQL, 'asdair.shop_question');
  state.QUESTION_INSERT_COLUMNS.forEach(function (col) {
    assert.ok(question.indexOf(col) !== -1, 'asdair.shop_question has no column "' + col + '"');
  });

  const pending = parseTableColumns(SQL, 'asdair.pending_action');
  state.PENDING_ACTION_INSERT_COLUMNS.forEach(function (col) {
    assert.ok(pending.indexOf(col) !== -1, 'asdair.pending_action has no column "' + col + '"');
  });
});

test('every column the writer UPDATEs or reads back exists on asdair.shop', SKIP, function () {
  const shop = parseTableColumns(SQL, 'asdair.shop');
  store._internal.SHOP_UPDATE_ALLOWED_COLUMNS.forEach(function (col) {
    assert.ok(shop.indexOf(col) !== -1, 'asdair.shop has no column "' + col + '"');
  });
  Object.keys(store._internal.SHOP_UPDATE_LITERALS).forEach(function (col) {
    assert.ok(shop.indexOf(col) !== -1, 'asdair.shop has no column "' + col + '"');
  });
  store._internal.SHOP_SELECT_COLUMNS.forEach(function (col) {
    assert.ok(shop.indexOf(col) !== -1, 'asdair.shop has no column "' + col + '"');
  });
});

test('the idempotency indexes the writers rely on are actually in the migration', SKIP, function () {
  // If any of these ever disappeared, the ON CONFLICT DO NOTHING paths would
  // stop being idempotent and would start duplicating weeks, questions and
  // build requests in complete silence.
  assert.match(SQL, /create unique index if not exists shop_inbound_uniq[\s\S]*?telegram_chat_id, telegram_message_id/,
    'the (telegram_chat_id, telegram_message_id) unique index is what makes a redelivery resume');
  assert.match(SQL, /create unique index if not exists shop_ref_uniq[\s\S]*?household_id, shop_ref/);
  assert.match(SQL, /create unique index if not exists shop_question_key_uniq[\s\S]*?shop_id, question_key/,
    'without this a question could be asked twice');
  assert.match(SQL, /create unique index if not exists bbr_one_live_per_shop/,
    'without this a repeated tap would queue a second build request');
  assert.match(SQL, /create unique index if not exists pending_action_key_uniq/);
});

test('the live-request statuses in the code match the partial index predicate', SKIP, function () {
  const at = SQL.indexOf('bbr_one_live_per_shop');
  const window = SQL.slice(at, at + 400);
  state.BROWSER_LIVE_STATUSES.forEach(function (s) {
    assert.ok(window.indexOf(s) !== -1,
      '"' + s + '" is treated as live in code but is not in the bbr_one_live_per_shop predicate');
  });
});

test('migration 006 grants the writer no DELETE anywhere', SKIP, function () {
  // Comments are stripped first: the migration's own prose says the writer
  // "may never delete one", and matching that would be a test passing on a
  // sentence instead of on a grant. `on delete cascade` in the create-table
  // blocks is a foreign-key action, not a privilege, and is separated from
  // any GRANT by a statement terminator.
  const statementsOnly = SQL.split('\n')
    .map(function (line) { return line.replace(/--.*$/, ''); })
    .join('\n');
  const offending = statementsOnly.match(/\bgrant\b[^;]*\bdelete\b/i);
  assert.equal(offending, null,
    'the write role must never be able to delete a shop, but found: ' + String(offending));
});

test('this module never alters migration 006', function () {
  // A tripwire, not a schema check: this work package builds AGAINST the
  // migration and owns none of it. Nothing in services/asdair/shop/ may emit
  // DDL.
  ['shopState.js', 'shopStore.js', 'shopStatus.js', 'shop-cli.js'].forEach(function (file) {
    const raw = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const code = raw.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
    [/\bCREATE TABLE\b/i, /\bALTER TABLE\b/i, /\bDROP\b/i, /\bGRANT\b/i].forEach(function (re) {
      assert.equal(re.test(code), false, file + ' must not contain DDL (' + re + ')');
    });
  });
});
