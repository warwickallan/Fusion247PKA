// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/listQuestionsProjection.test.js
//
// THE COLUMN CONTRACT OF store.listQuestions, AND THE PROOF THAT THE OFFLINE
// SUITE CAN ACTUALLY SEE IT CHANGE.
//
// Defect D1 (veritas-wp-red-suite-recovery-0f8a1bc): pipeline/test/fakePg.js
// held the projection of this query as a hard-coded literal while its own
// comment claimed the opposite. Dropping `q.answer_text, q.answer_source` from
// the real SELECT left the suite green at 185/0. So did dropping
// `sl.raw_reading AS photographed_wording`, which leaves a trailing comma before
// FROM and is not valid SQL. So did ADDING a column. The class of defect the
// query was rewritten to fix - a silently dropped select column - was
// undetectable, behind a green suite and a comment vouching for it.
//
// THREE LAYERS, because each catches a failure the others cannot:
//
//   1. THE DERIVATION reads its input. Synthetic statements in, column names
//      out. If selectProjection() ever went back to answering from a literal,
//      these are what redden - nothing downstream would notice, because
//      downstream only ever feeds it the one real statement.
//   2. THE CONTRACT. The column set derived from the statement the REAL
//      store.listQuestions emits must equal EXPECTED_PROJECTION below - a
//      literal held in this file, deliberately outside the source it checks, so
//      that editing the query and the fake together still fails here.
//   3. THE SHAPE. The row listQuestions hands back carries those columns and no
//      others. This is what catches a fake that quietly returns every stored
//      column regardless of what was asked for - the convenient shortcut that
//      would re-open D1 without touching the derivation at all.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakeDatabase, createFakeClient, selectProjection, statements } from './test/fakePg.js';
import { listQuestions } from './store.js';

const SHOP_ID = 7;
const LIST_ITEM_ID = 3;

/**
 * The column set store.listQuestions must project, held HERE and not in
 * fakePg.js.
 *
 * Order matters: this is the select list read left to right, so a reordering is
 * visible too. `item_name` and `photographed_wording` are the two join-sourced
 * names - they are the ones the old fake attached outside the projection
 * entirely, which is why a genuine assertion on `photographed_wording` in
 * runPipeline.test.js could not fire when the column was dropped.
 */
const EXPECTED_PROJECTION = [
  'id', 'list_item_id', 'question_key', 'question_text', 'candidates', 'status',
  'answer_text', 'answer_source', 'card_chat_id', 'card_message_id',
  'rendered_candidates', 'render_fingerprint', 'render_version', 'callback_index',
  'item_name', 'photographed_wording',
];

/** One question, one list item and one shop line - enough for both LEFT JOINs. */
function seeded() {
  const store = createFakeDatabase({
    shop_question: [{
      id: 1, shop_id: SHOP_ID, list_item_id: LIST_ITEM_ID, question_key: 'q:fruit-splits',
      question_text: 'Which product is "fruit splits"?', candidates: [], status: 'open',
      answer_text: null, answer_source: null, card_chat_id: null, card_message_id: null,
      rendered_candidates: [], render_fingerprint: null, render_version: 1, callback_index: 0,
    }],
    shopping_list_items: [{ id: LIST_ITEM_ID, list_id: 1, item_name: 'fruit splits' }],
    shop_line: [{ id: 5, shop_id: SHOP_ID, line_no: 1, list_item_id: LIST_ITEM_ID, raw_reading: 'fruit splits' }],
  });
  const client = createFakeClient(store);
  return { client, deps: { readQuery: (sql, params) => client.query(sql, params) } };
}

/** The real statement's shape, so a test can vary ONE thing about it. */
function questionSql(selectList) {
  return `SELECT ${selectList}
       FROM asdair.shop_question q
       LEFT JOIN asdair.shopping_list_items li ON li.id = q.list_item_id
       LEFT JOIN asdair.shop_line sl ON sl.list_item_id = q.list_item_id AND sl.shop_id = q.shop_id
      WHERE q.shop_id = $1 ORDER BY q.id ASC`;
}

const REAL_SELECT_LIST = `q.id, q.list_item_id, q.question_key, q.question_text, q.candidates, q.status,
            q.answer_text, q.answer_source, q.card_chat_id, q.card_message_id,
            q.rendered_candidates, q.render_fingerprint, q.render_version, q.callback_index,
            li.item_name AS item_name,
            sl.raw_reading AS photographed_wording`;

// ── 1. THE DERIVATION READS ITS INPUT ──────────────────────────────────────

test('the projection is READ FROM the statement - a different select list gives a different answer', () => {
  assert.deepEqual(selectProjection('SELECT a.one, b.two FROM t'), ['one', 'two']);
  // A DROP changes the answer.
  assert.deepEqual(selectProjection('SELECT a.one FROM t'), ['one']);
  // An ADDITION changes the answer.
  assert.deepEqual(selectProjection('SELECT a.one, b.two, c.three FROM t'), ['one', 'two', 'three']);
  // An alias is the projected name; the qualifier is not part of it.
  assert.deepEqual(selectProjection('SELECT sl.raw_reading AS photographed_wording FROM t'), ['photographed_wording']);
  // A comma inside an expression is not a list separator.
  assert.deepEqual(selectProjection('SELECT coalesce(a.x, b.y) AS z, a.w FROM t'), ['z', 'w']);
  // Newlines and runs of whitespace are the real statement's formatting.
  assert.deepEqual(selectProjection('SELECT   a.one,\n   b.two\n  FROM t'), ['one', 'two']);
});

test('a malformed select list THROWS rather than being read past', () => {
  // The exact malformation MUT-5 produced: drop the last column, leave its comma.
  assert.throws(() => selectProjection('SELECT a.one, FROM t'), /empty item in the select list/);
  assert.throws(() => selectProjection('SELECT a.one,, b.two FROM t'), /empty item in the select list/);
  assert.throws(() => selectProjection('SELECT a.one, b.two'), /no top-level FROM/);
  assert.throws(() => selectProjection('SELECT coalesce(a.x, b.y AS z FROM t'), /unbalanced "\("/);
  assert.throws(() => selectProjection('SELECT a.one, ) FROM t'), /unbalanced "\)"/);
  assert.throws(() => selectProjection('SELECT * FROM t'), /could not read a column name/);
  assert.throws(() => selectProjection('UPDATE t SET a = 1'), /not a SELECT statement/);
});

// ── 2. THE CONTRACT ────────────────────────────────────────────────────────

test('THE CONTRACT: store.listQuestions selects exactly the columns this suite models', async () => {
  const { client, deps } = seeded();
  await listQuestions(deps, SHOP_ID);

  const sql = statements(client).find((s) => /FROM asdair\.shop_question q/i.test(s));
  assert.ok(sql, 'store.listQuestions emitted no statement against asdair.shop_question');
  assert.deepEqual(selectProjection(sql), EXPECTED_PROJECTION,
    'the select list of store.listQuestions no longer matches the set this suite models - '
    + 'if the query gained or lost a column deliberately, teach fakePg to source it and update '
    + 'EXPECTED_PROJECTION here; if it did not, a column has been dropped and a consumer is about to read undefined');
});

// ── 3. THE SHAPE ───────────────────────────────────────────────────────────

test('THE SHAPE: the row listQuestions returns carries the projected columns and no others', async () => {
  const { deps } = seeded();
  const [row] = await listQuestions(deps, SHOP_ID);
  assert.ok(row, 'listQuestions returned no row for a seeded question');
  assert.deepEqual([...Object.keys(row)].sort(), [...EXPECTED_PROJECTION].sort(),
    'the offline row is not the shape the statement asked for - a fake that hands back every stored '
    + 'column regardless is exactly how a dropped select column goes unnoticed');
  // The two join-sourced fields travel through the projection like the rest.
  assert.equal(row.item_name, 'fruit splits');
  assert.equal(row.photographed_wording, 'fruit splits');
});

test('a column DROPPED from the statement stops being returned, so a consumer breaks', async () => {
  const { client } = seeded();
  const withoutAnswer = REAL_SELECT_LIST
    .replace('q.answer_text, q.answer_source, ', '');
  const res = await client.query(questionSql(withoutAnswer), [SHOP_ID]);

  assert.equal(res.rows.length, 1);
  assert.equal('answer_text' in res.rows[0], false,
    'the fake still served answer_text after the statement stopped selecting it');
  assert.equal('answer_source' in res.rows[0], false,
    'the fake still served answer_source after the statement stopped selecting it');
  // And what IS still selected is unaffected - the projection narrowed, it did not break.
  assert.equal(res.rows[0].question_key, 'q:fruit-splits');
});

test('a column ADDED that the fake cannot source is a LOUD failure, not a silent null', async () => {
  const { client } = seeded();
  await assert.rejects(
    () => client.query(questionSql(`${REAL_SELECT_LIST}, q.shop_id`), [SHOP_ID]),
    /does not model/,
    'the statement asked for a column the fake has no source for and the fake answered anyway');
});

test('an invalid select list reaches the fake as an ERROR, not as a row', async () => {
  const { client } = seeded();
  // MUT-5 exactly: drop the final column, leave the comma that preceded it.
  const trailingComma = REAL_SELECT_LIST.replace('\n            sl.raw_reading AS photographed_wording', '');
  await assert.rejects(
    () => client.query(questionSql(trailingComma), [SHOP_ID]),
    /empty item in the select list/,
    'a select list with a trailing comma before FROM was answered as though it were valid SQL');
});
