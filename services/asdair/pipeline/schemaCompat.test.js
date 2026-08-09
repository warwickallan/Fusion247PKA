// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - pipeline/schemaCompat.test.js
//
// Runs under: node --test
//
// STATIC SCHEMA/CODE COMPATIBILITY GUARD FOR MIGRATION 017.
//
// NO live database, no network, no pg connection is ever opened: it reads the
// committed migration off disk and compares it with the constants the code
// actually uses - IMPORTED, not hand-copied, so the two cannot silently rot
// apart. Same strategy and the same parsing helpers as
// services/asdair/shop/schemaCompat.test.js.
//
// WHY THIS EXISTS: if shopDecisions.js INSERTs a column 017 never creates, or
// validates against a vocabulary 017's CHECK does not share, the failure
// surfaces at run time on a real shop - as a lost week, at the exact moment
// Warwick is trying to answer a question. This makes it surface in CI instead.
//
// WHAT IT CANNOT DO, STATED PLAINLY: this is a TEXT comparison against SQL
// that has never been executed. It proves the migration and the code agree
// about names and vocabularies. It does NOT prove 017 applies, that its
// pg_constraint guards work, or that it is idempotent - only running it twice
// against a real Postgres proves that, and that is a live action outside this
// Work Package.
//
// PURE ASCII.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DECISION_KINDS, FORWARD_INTENTS, INTERPRETERS, _internal,
} from './shopDecisions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.join(HERE, '..', 'db', '017_shop_decision.sql');
const RAW_SQL = fs.readFileSync(MIGRATION_PATH, 'utf8');

/**
 * SQL line comments are stripped before any STRUCTURAL match.
 *
 * 017's own header explains that `alter table ... add constraint` has no
 * `if not exists` form - and a structural test that reads raw text finds that
 * sentence and reports it as an unguarded constraint named "if". The prose
 * describing a rule is not an instance of breaking it.
 *
 * This is the second time in this Work Package that a comment was counted as
 * code (the first was `deps.planBasket(` inside a doc-comment). Both were
 * caught by the control failing rather than by review, which is the argument
 * for mutation-testing every one of them.
 *
 * The column and vocabulary parsers below do their own per-line `--` stripping
 * and take RAW_SQL, matching the helpers in shop/schemaCompat.test.js.
 */
function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, '');
}

const SQL = stripSqlComments(RAW_SQL);

const NON_COLUMN_LEADERS = new Set([
  'check', 'unique', 'primary', 'foreign', 'constraint', 'references', 'create',
]);

/** Walk the parentheses of a `create table` block to the MATCHING close paren
 *  (check(...) and references(...) nest), then take the first bareword of each
 *  line. Same strategy as shop/schemaCompat.test.js. */
function parseTableColumns(sql, tableName) {
  const marker = `create table if not exists ${tableName}`;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, `create table for ${tableName} not found in migration 017`);

  const open = sql.indexOf('(', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, `unbalanced parentheses for ${tableName}`);

  return sql.slice(open + 1, end).split('\n').map((line) => {
    const trimmed = line.replace(/--.*$/, '').trim();
    if (trimmed === '') return null;
    const first = trimmed.split(/[\s(,]/)[0].toLowerCase();
    return first === '' || NON_COLUMN_LEADERS.has(first) ? null : first;
  }).filter((c) => c !== null);
}

/** The values inside a `check (col in ('a','b',...))` clause. */
function parseCheckVocabulary(sql, constraintName) {
  const at = sql.indexOf(constraintName);
  assert.notEqual(at, -1, `constraint ${constraintName} not found in migration 017`);
  const open = sql.indexOf('in (', at);
  assert.notEqual(open, -1, `no IN list for ${constraintName}`);
  const close = sql.indexOf(')', open + 4);
  return sql.slice(open + 4, close).split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter((s) => s !== '');
}

// ---------------------------------------------------------------------
// The vocabularies
// ---------------------------------------------------------------------

test('the decision_kind vocabulary matches the CHECK constraint exactly', () => {
  assert.deepEqual(
    parseCheckVocabulary(SQL, 'shop_decision_kind_known').slice().sort(),
    [...DECISION_KINDS].sort(),
    'shopDecisions.DECISION_KINDS has drifted from the shop_decision_kind_known CHECK',
  );
});

test('the forward_intent vocabulary matches the CHECK constraint exactly', () => {
  assert.deepEqual(
    parseCheckVocabulary(SQL, 'shop_decision_forward_intent_known').slice().sort(),
    [...FORWARD_INTENTS].sort(),
    'shopDecisions.FORWARD_INTENTS has drifted from the shop_decision_forward_intent_known CHECK',
  );
});

test('the interpreted_by vocabulary matches the CHECK constraint exactly', () => {
  assert.deepEqual(
    parseCheckVocabulary(SQL, 'shop_decision_interpreter_known').slice().sort(),
    [...INTERPRETERS].sort(),
    'shopDecisions.INTERPRETERS has drifted from the shop_decision_interpreter_known CHECK',
  );
});

// ---------------------------------------------------------------------
// The columns
// ---------------------------------------------------------------------

test('every column the writer INSERTs exists on asdair.shop_decision', () => {
  const columns = parseTableColumns(SQL, 'asdair.shop_decision');
  for (const col of _internal.INSERT_COLUMNS) {
    assert.ok(columns.includes(col),
      `asdair.shop_decision has no column "${col}" in migration 017, but shopDecisions.js INSERTs it`);
  }
});

test('every column the writer READS BACK exists on asdair.shop_decision', () => {
  const columns = parseTableColumns(SQL, 'asdair.shop_decision');
  // The SELECT list, taken from the statement the module actually emits.
  const selected = _internal.SELECT_BY_QUESTION_SQL
    .replace(/^SELECT\s+/i, '').replace(/\s+FROM[\s\S]*$/i, '')
    .split(',').map((s) => s.trim());
  assert.ok(selected.length > 10, 'the SELECT list failed to parse - this test would prove nothing');
  for (const col of selected) {
    assert.ok(columns.includes(col),
      `shopDecisions.js selects "${col}" but migration 017 does not create it`);
  }
});

test('the INSERT parameter count matches the column count - an off-by-one here is a runtime 42601', () => {
  const cols = _internal.INSERT_COLUMNS.length;
  const placeholders = [...new Set(
    [..._internal.INSERT_SQL.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])),
  )];
  assert.equal(placeholders.length, cols,
    `${cols} columns but ${placeholders.length} distinct placeholders`);
  assert.equal(Math.max(...placeholders), cols, 'the highest placeholder must equal the column count');
});

// ---------------------------------------------------------------------
// The two columns added to an EXISTING table
// ---------------------------------------------------------------------

test('017 adds question_round and parent_question_id to asdair.shop_question', () => {
  assert.match(SQL, /alter table asdair\.shop_question\s+add column if not exists question_round\s+integer not null default 1/i);
  assert.match(SQL, /alter table asdair\.shop_question\s+add column if not exists parent_question_id\s+bigint/i);
});

test('the round columns the question writer emits are the ones 017 adds', () => {
  // shopState.buildQuestion pushes exactly these two when a clarification round
  // is asked for. A rename on either side breaks the insert at run time.
  for (const col of ['question_round', 'parent_question_id']) {
    assert.match(SQL, new RegExp(`add column if not exists ${col}\\b`, 'i'),
      `migration 017 does not add "${col}", but the question writer INSERTs it for a clarification round`);
  }
});

// ---------------------------------------------------------------------
// The properties the schema decision turns on
// ---------------------------------------------------------------------

test('EVERY added constraint carries a pg_constraint guard - 017 must be re-runnable', () => {
  // Postgres has no `alter table ... add constraint if not exists`, so an
  // unguarded one aborts the WHOLE migration with 42710 on a re-run. Silas
  // named this the single most likely implementation defect, and there is no
  // precedent for the guard anywhere else in services/asdair/db/.
  const added = [...SQL.matchAll(/add constraint\s+(\w+)/gi)].map((m) => m[1]);
  assert.ok(added.length > 0, 'no `add constraint` found - this test would prove nothing');
  for (const name of added) {
    const guard = new RegExp(
      `if not exists\\s*\\(\\s*select 1 from pg_constraint where conname = '${name}'\\s*\\)`, 'i',
    );
    assert.match(SQL, guard,
      `constraint "${name}" is added WITHOUT a pg_constraint guard - a re-run of 017 aborts with 42710`);
  }
});

test('shop_decision is immutable BY GRANT - no UPDATE or DELETE is granted to anybody', () => {
  // This is the entire reason the decision is a table rather than columns on
  // shop_question, which asdair_rw may already UPDATE at table level.
  const grants = [...SQL.matchAll(/grant\s+([^']*?)\s+on\s+asdair\.shop_decision/gi)]
    .map((m) => m[1].toLowerCase());
  assert.ok(grants.length > 0, 'no grants found on asdair.shop_decision');
  for (const g of grants) {
    assert.doesNotMatch(g, /\bupdate\b/, 'UPDATE granted on shop_decision - the decision would be rewritable');
    assert.doesNotMatch(g, /\bdelete\b/, 'DELETE granted on shop_decision');
  }
});

test('the composite FK to shop_question exists, so shop_id can never drift from its question', () => {
  assert.match(SQL, /foreign key \(question_id, shop_id\)\s*references asdair\.shop_question \(id, shop_id\)/i);
  // ...and the unique index that FK requires.
  assert.match(SQL, /create unique index if not exists shop_question_id_shop_uniq\s+on asdair\.shop_question \(id, shop_id\)/i);
});

test('ONE decision per question, ever - the unique index is present', () => {
  assert.match(SQL, /create unique index if not exists shop_decision_question_uniq\s+on asdair\.shop_decision \(question_id\)/i);
  // And the writer relies on exactly that conflict target.
  assert.match(_internal.INSERT_SQL, /ON CONFLICT \(question_id\) DO NOTHING/i);
});

test('017 creates no updated_at, because nothing may update the row', () => {
  const columns = parseTableColumns(SQL, 'asdair.shop_decision');
  assert.equal(columns.includes('updated_at'), false,
    'an updated_at on an insert-only table is a column claiming to record something that cannot happen');
});

test('017 ships STRUCTURE and no rows - no backfill was invented for the three live shops', () => {
  assert.doesNotMatch(SQL, /^\s*insert\s+into\s+asdair\.shop_decision/im,
    'a backfill row would be a fabricated decision nobody made');
});
