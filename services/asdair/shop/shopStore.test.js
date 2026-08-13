// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopStore.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY - invented household ids, chat ids and question
// keys. ZERO real household data; this file runs in CI on the PUBLIC repo.
//
// NO DATABASE, NO NETWORK, NO CREDENTIALS. Every test injects a scripted fake
// client (fakeClient.js), so `pg` is never required and ASDAIR_WRITE_DB_URL is
// never read. The point is not to emulate Postgres - it is to prove the SHAPE
// and ORDER of the statements, because that is where the guarantees live:
//
//   * insert-first (never check-then-insert) idempotent create
//   * the status UPDATE and its audit event in ONE transaction, always
//   * a single-statement atomic claim
//   * a question asked at most once
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const store = require('./shopStore');
const { makeClient, statements, shapes, countMatching, indexOfMatching } = require('./fakeClient');

// WP-B15-35. Pre-seed the human_state capability probe as ABSENT for this file,
// so every existing statement-sequence assertion below is unchanged - they
// assert the exact order and COUNT of statements in a transition, which is the
// guarantee this file exists to hold, and a capability lookup must not be
// allowed to erode it. The probe and the column write have their own dedicated
// cases at the END of this file, where the sequence is asserted deliberately.
store._internal._setHumanStateProbe(false);

const HH = 1;
const SHOP_ID = 42;

const CREATE_INTENT = {
  household_id: HH,
  shop_ref: 'SHOP-2026-07-27',
  source_kind: 'text',
  raw_text: 'milk\nbread',
  telegram_chat_id: '10001',
  telegram_message_id: '55',
  telegram_update_id: '900'
};

function shopRow(overrides) {
  const base = {
    id: SHOP_ID, household_id: HH, shop_ref: 'SHOP-2026-07-27', status: 'RECEIVED',
    source_kind: 'text', telegram_chat_id: '10001', telegram_message_id: '55',
    telegram_update_id: '900', list_id: null, needs_review: false, last_error: null,
    created_at: '2026-07-27T09:00:00.000Z', updated_at: '2026-07-27T09:00:00.000Z'
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

// =====================================================================
// createOrResumeShop
// =====================================================================

test('createOrResumeShop is INSERT-FIRST - there is no check-then-insert race window', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [shopRow()] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 1, occurred_at: 'now' }] }
  ]);

  const result = await store.createOrResumeShop(CREATE_INTENT, { client: client });

  assert.equal(result.created, true);
  assert.equal(result.resumed, false);
  assert.equal(result.matched_by, 'insert');

  const seen = statements(client);
  assert.equal(seen[0], 'BEGIN');
  assert.match(seen[1], /^INSERT INTO asdair\.shop \(/,
    'the FIRST statement after BEGIN must be the INSERT - a SELECT here would be a check-then-insert race');
  assert.equal(seen[seen.length - 1], 'COMMIT');
  assert.match(seen[1], /ON CONFLICT DO NOTHING/);
  assert.equal(/DO UPDATE/.test(seen[1]), false,
    'DO UPDATE would be a route to rewriting an existing week evidence');
  // No conflict target, so BOTH unique indexes on asdair.shop are covered.
  assert.equal(/ON CONFLICT \(/.test(seen[1]), false);
});

test('a redelivered Telegram message RESUMES the week and writes nothing', async function () {
  const existing = shopRow({ status: 'PROCESSING' });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },          // the unique index bit
    { match: 'WHERE telegram_chat_id = $1', rows: [existing] }
  ]);

  const result = await store.createOrResumeShop(CREATE_INTENT, { client: client });

  assert.equal(result.created, false);
  assert.equal(result.resumed, true);
  assert.equal(result.matched_by, 'telegram_message');
  assert.equal(result.shop.status, 'PROCESSING', 'the shop resumes where it actually is');
  assert.equal(countMatching(client, 'INSERT INTO asdair.shop_event'), 0,
    'a resume must write NOTHING - not even an event');
});

test('a second list for the same week resumes by shop_ref, and says so', async function () {
  const existing = shopRow({ telegram_message_id: '11' });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },
    { match: 'WHERE telegram_chat_id = $1', rows: [] },
    { match: 'WHERE household_id = $1 AND shop_ref = $2', rows: [existing] }
  ]);

  const result = await store.createOrResumeShop(CREATE_INTENT, { client: client });
  assert.equal(result.matched_by, 'shop_ref');
  assert.equal(result.resumed, true);
});

test('createOrResumeShop refuses to guess when nothing matches, and rolls back', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },
    { match: 'WHERE telegram_chat_id = $1', rows: [] },
    { match: 'WHERE household_id = $1 AND shop_ref = $2', rows: [] }
  ]);

  await assert.rejects(function () { return store.createOrResumeShop(CREATE_INTENT, { client: client }); },
    /no existing shop matches either natural key/);
  assert.equal(statements(client)[statements(client).length - 1], 'ROLLBACK');
});

// ── THE TERMINAL COLLISION (WP-B15-07) ────────────────────────────────────
//
// The 2026-08-10 lost list: the date's shop was CANCELLED, the ref matched it,
// ON CONFLICT DO NOTHING wrote nothing, and this function reported a successful
// RESUME of a shop that can never move again.

test('a new list colliding with a TERMINAL shop gets a FRESH shop, not a resume of the dead one', async function () {
  const dead = shopRow({ shop_ref: 'SHOP-2026-07-27', status: 'CANCELLED', telegram_message_id: '11' });
  const fresh = shopRow({ id: 77, shop_ref: 'SHOP-2026-07-27-M55' });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },                  // collides on the ref
    { match: 'WHERE telegram_chat_id = $1', rows: [] },                // this message is new
    { match: 'WHERE household_id = $1 AND shop_ref = $2', rows: [dead] },
    { match: 'INSERT INTO asdair.shop (', rows: [fresh] },             // the retry, insert-first again
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 2, occurred_at: 'now' }] }
  ]);

  const result = await store.createOrResumeShop(CREATE_INTENT, { client: client });

  assert.equal(result.created, true, 'the list was absorbed into a terminal shop instead of starting a fresh one');
  assert.equal(result.resumed, false);
  assert.equal(result.matched_by, 'insert', 'matched_by keeps its three existing values');
  assert.equal(result.superseded_terminal_ref, 'SHOP-2026-07-27',
    'the collision must be reported, not left to be inferred from a ref suffix');
  assert.equal(result.shop.shop_ref, 'SHOP-2026-07-27-M55');

  // THE DEAD ROW IS NEVER WRITTEN TO. Not revived, not updated, not renamed.
  assert.equal(countMatching(client, 'UPDATE asdair.shop'), 0,
    'the terminal shop was mutated - it must be left exactly as it was');

  // STILL INSERT-FIRST on the retry: the second attempt is an INSERT, not a
  // SELECT-then-INSERT, so two concurrent deliveries cannot both believe they won.
  const inserts = statements(client).filter(function (s) { return /^INSERT INTO asdair\.shop \(/.test(s); });
  assert.equal(inserts.length, 2);
  assert.match(inserts[1], /ON CONFLICT DO NOTHING/);
  assert.equal(/DO UPDATE/.test(inserts[1]), false);
});

test('the terminal-collision retry is reported in the audit trail', async function () {
  const dead = shopRow({ status: 'RECONCILED', telegram_message_id: '11' });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },
    { match: 'WHERE telegram_chat_id = $1', rows: [] },
    { match: 'WHERE household_id = $1 AND shop_ref = $2', rows: [dead] },
    { match: 'INSERT INTO asdair.shop (', rows: [shopRow({ id: 77, shop_ref: 'SHOP-2026-07-27-M55' })] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 2, occurred_at: 'now' }] }
  ]);

  await store.createOrResumeShop(CREATE_INTENT, { client: client });

  // RECONCILED is terminal too - this is not a CANCELLED special case.
  const event = client.log.find(function (e) { return e.sql.indexOf('INSERT INTO asdair.shop_event') !== -1; });
  assert.ok(event, 'a fresh shop must still record its creation milestone');
  assert.match(String(event.params[4]), /SHOP-2026-07-27 is terminal and was left untouched/,
    'the audit trail must say WHY this date has two shops');
});

test('a redelivery whose shop was LATER cancelled resumes - it must NOT wedge the poller', async function () {
  // The message IS already durably captured; the shop was cancelled afterwards.
  // Refusing here would hold the Telegram offset and make the same message
  // redeliver forever, which is a worse outage than the defect being fixed.
  const captured = shopRow({ status: 'CANCELLED' });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },
    { match: 'WHERE telegram_chat_id = $1', rows: [captured] }
  ]);

  const result = await store.createOrResumeShop(CREATE_INTENT, { client: client });

  assert.equal(result.matched_by, 'telegram_message',
    'the INBOUND key must be tested before the ref - it is what proves this message was captured');
  assert.equal(result.resumed, true);
  assert.equal(result.superseded_terminal_ref, null);
  assert.equal(countMatching(client, 'INSERT INTO asdair.shop ('), 1, 'a redelivery must write nothing');
});

test('a terminal collision with NO inbound message id REFUSES rather than inventing an identity', async function () {
  const dead = shopRow({ status: 'CANCELLED', telegram_message_id: null, telegram_chat_id: null });
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop (', rows: [] },
    { match: 'WHERE household_id = $1 AND shop_ref = $2', rows: [dead] }
  ]);

  await assert.rejects(function () {
    return store.createOrResumeShop({
      household_id: HH, shop_ref: 'SHOP-2026-07-27', source_kind: 'text', raw_text: 'milk'
    }, { client: client });
  }, /inbound Telegram message id/);

  assert.equal(statements(client)[statements(client).length - 1], 'ROLLBACK', 'nothing may be half-written');
});

test('pure validation happens BEFORE any statement is issued', async function () {
  const client = makeClient([]);
  await assert.rejects(function () {
    return store.createOrResumeShop({ household_id: HH, shop_ref: 'week 30', source_kind: 'text', raw_text: 'x' },
      { client: client });
  }, /SHOP-YYYY-MM-DD/);
  assert.equal(client.log.length, 0, 'not even BEGIN should have run');
});

// =====================================================================
// transition - the update and its audit event are inseparable
// =====================================================================

test('a transition writes the status change AND its event in ONE transaction', async function () {
  const client = makeClient([
    { match: 'FROM asdair.shop WHERE id = $1 FOR UPDATE', rows: [shopRow({ status: 'RECEIVED' })] },
    { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'PROCESSING' })] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 7, occurred_at: 'now' }] }
  ]);

  const result = await store.transition(SHOP_ID, 'PROCESSING', 'list parsed', { client: client });
  assert.equal(result.changed, true);
  assert.equal(result.kind, 'advance');
  assert.equal(result.shop.status, 'PROCESSING');

  // The exact order is the guarantee: read under a row lock, write the status,
  // write the event, commit - with nothing between the UPDATE and its event.
  const seen = statements(client);
  assert.equal(seen.length, 5);
  assert.equal(seen[0], 'BEGIN');
  assert.match(seen[1], /^SELECT .* FROM asdair\.shop WHERE id = \$1 FOR UPDATE$/);
  assert.match(seen[2], /^UPDATE asdair\.shop SET /);
  assert.match(seen[3], /^INSERT INTO asdair\.shop_event /);
  assert.equal(seen[4], 'COMMIT');

  const update = statements(client)[2];
  assert.match(update, /updated_at = now\(\)/, 'updated_at is a SQL literal, never caller-driven');
  assert.match(update, /AND status = \$\d+/,
    'the UPDATE must be guarded on the status the validation actually saw');

  const event = client.log[3];
  assert.deepEqual(event.params.slice(0, 4), [SHOP_ID, 'transition', 'RECEIVED', 'PROCESSING']);
});

test('an illegal transition writes nothing and rolls back', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'RECONCILED' })] }
  ]);

  await assert.rejects(function () { return store.transition(SHOP_ID, 'SHOPPING', 'go again', { client: client }); },
    /RECONCILED is terminal/);

  assert.equal(countMatching(client, 'UPDATE asdair.shop SET'), 0);
  assert.equal(countMatching(client, 'INSERT INTO asdair.shop_event'), 0);
  assert.equal(statements(client).pop(), 'ROLLBACK');
});

test('a no-op transition writes neither a status nor an event', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'SHOPPING' })] }
  ]);
  const result = await store.transition(SHOP_ID, 'SHOPPING', 'again', { client: client });
  assert.equal(result.changed, false);
  assert.equal(result.kind, 'noop');
  assert.equal(countMatching(client, 'UPDATE asdair.shop SET'), 0);
  assert.equal(countMatching(client, 'INSERT'), 0);
  assert.equal(statements(client).pop(), 'COMMIT');
});

test('a concurrent writer that moved the shop causes a rollback, not an overwrite', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'RECEIVED' })] },
    { match: 'UPDATE asdair.shop SET', rows: [] }               // the guard matched zero rows
  ]);

  await assert.rejects(function () { return store.transition(SHOP_ID, 'PROCESSING', 'x', { client: client }); },
    /modified concurrently/);
  assert.equal(countMatching(client, 'INSERT INTO asdair.shop_event'), 0);
  assert.equal(statements(client).pop(), 'ROLLBACK');
});

test('resuming a FAILED shop reads the resume point from DURABLE state, never from the caller', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'FAILED' })] },
    { match: "event_type = 'failure'", rows: [{ from_status: 'SHOPPING', description: 'session expired' }] },
    { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'SHOPPING' })] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 9, occurred_at: 'now' }] }
  ]);

  const result = await store.transition(SHOP_ID, 'SHOPPING', 'runner restarted', { client: client });
  assert.equal(result.kind, 'resume');
  assert.equal(result.shop.status, 'SHOPPING');
});

test('a FAILED shop cannot be resumed into a state it never reached', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'FAILED' })] },
    { match: "event_type = 'failure'", rows: [{ from_status: 'PROCESSING' }] }
  ]);

  await assert.rejects(function () {
    return store.transition(SHOP_ID, 'BASKET_READY', 'skip ahead', { client: client });
  }, /may only resume to the state it failed from \(PROCESSING\)/);
  assert.equal(countMatching(client, 'UPDATE asdair.shop SET'), 0);
});

// =====================================================================
// recordFailure
// =====================================================================

test('recordFailure parks the shop and records the state it can resume from', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'SHOPPING' })] },
    { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'FAILED', last_error: 'ASDA session expired' })] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 11, occurred_at: 'now' }] }
  ]);

  const result = await store.recordFailure(SHOP_ID, new Error('ASDA session expired'), { client: client });
  assert.equal(result.changed, true);
  assert.equal(result.resume_from, 'SHOPPING');

  const update = statements(client)[2];
  assert.match(update, /status = \$1/);
  assert.match(update, /last_error = \$2/);

  const event = client.log[3];
  assert.deepEqual(event.params.slice(0, 4), [SHOP_ID, 'failure', 'SHOPPING', 'FAILED']);
  assert.equal(event.params[4], 'ASDA session expired');
});

test('failing twice does NOT decay the resume point', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'FAILED' })] },
    { match: "event_type = 'failure'", rows: [{ from_status: 'SHOPPING' }] },
    { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'FAILED', last_error: 'again' })] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 12, occurred_at: 'now' }] }
  ]);

  const result = await store.recordFailure(SHOP_ID, 'again', { client: client });
  assert.equal(result.already_failed, true);
  assert.equal(result.resume_from, 'SHOPPING');
  assert.match(client.log[4].sql, /^INSERT INTO asdair\.shop_event /);
  assert.equal(client.log[4].params[2], 'SHOPPING',
    'the repeat failure event must carry the ORIGINAL from_status, not FAILED');
});

test('a reconciled shop cannot be failed', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [shopRow({ status: 'RECONCILED' })] }
  ]);
  await assert.rejects(function () { return store.recordFailure(SHOP_ID, 'too late', { client: client }); },
    /terminal - it cannot fail/);
  assert.equal(countMatching(client, 'UPDATE asdair.shop SET'), 0);
});

// =====================================================================
// questions - asked at most once, first answer wins
// =====================================================================

test('openQuestion is idempotent on (shop_id, question_key)', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop_question', rows: [] },
    { match: 'FROM asdair.shop_question WHERE shop_id = $1 AND question_key = $2',
      rows: [{ id: 5, shop_id: SHOP_ID, question_key: 'line-7-brand', status: 'answered', answer_text: 'Arla 4pt' }] }
  ]);

  const result = await store.openQuestion({
    shop_id: SHOP_ID, question_key: 'line-7-brand', question_text: 'Which milk?', candidates: ['Arla 4pt']
  }, { client: client });

  assert.equal(result.created, false);
  assert.equal(result.already_answered, true);
  assert.equal(result.question.answer_text, 'Arla 4pt',
    're-opening an answered question must hand back the answer, not re-ask');

  const insert = statements(client)[1];
  assert.match(insert, /ON CONFLICT \(shop_id, question_key\) DO NOTHING/);
  assert.equal(countMatching(client, 'UPDATE asdair.shop_question SET'), 0,
    'nothing may be rewritten on a re-open');
});

test('candidates are sent as jsonb, not as a Postgres array literal', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.shop_question', rows: [{ id: 6, shop_id: SHOP_ID, status: 'open' }] }
  ]);

  await store.openQuestion({
    shop_id: SHOP_ID, question_key: 'k', question_text: 't', candidates: ['a', { name: 'b' }]
  }, { client: client });

  const call = client.log[1];
  assert.match(call.sql, /::jsonb/);
  const candidatesParam = call.params[call.params.length - 3];
  assert.equal(typeof candidatesParam, 'string', 'candidates must be JSON.stringify-d');
  assert.deepEqual(JSON.parse(candidatesParam), ['a', { name: 'b' }]);
});

test('answering writes the answer and a decision event in one transaction', async function () {
  const client = makeClient([
    { match: 'FROM asdair.shop_question WHERE shop_id = $1 AND question_key = $2 FOR UPDATE',
      rows: [{ id: 5, shop_id: SHOP_ID, question_key: 'line-7-brand', status: 'open' }] },
    { match: 'UPDATE asdair.shop_question SET',
      rows: [{ id: 5, shop_id: SHOP_ID, status: 'answered', answer_text: 'Arla 4pt' }] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 13, occurred_at: 'now' }] }
  ]);

  const result = await store.answerQuestion({
    shop_id: SHOP_ID, question_key: 'line-7-brand', answer_text: 'Arla 4pt', answer_source: 'button'
  }, { client: client });

  assert.equal(result.changed, true);
  assert.equal(client.log[3].params[1], 'decision');
  assert.match(statements(client)[2], /answered_at = now\(\)/);
  assert.match(statements(client)[2], /AND status = 'open'/, 'the update must be guarded on still-open');
});

test('a double-tapped button cannot overwrite a decision or write a second event', async function () {
  const client = makeClient([
    { match: 'FOR UPDATE', rows: [{ id: 5, shop_id: SHOP_ID, status: 'answered', answer_text: 'Arla 4pt' }] }
  ]);

  const result = await store.answerQuestion({
    shop_id: SHOP_ID, question_key: 'line-7-brand', answer_text: 'Store brand'
  }, { client: client });

  assert.equal(result.changed, false);
  assert.equal(result.already_answered, true);
  assert.equal(result.question.answer_text, 'Arla 4pt', 'first answer wins');
  assert.equal(countMatching(client, 'UPDATE asdair.shop_question SET'), 0);
  assert.equal(countMatching(client, 'INSERT'), 0);
});

// =====================================================================
// browser build requests - one live request, one winner
// =====================================================================

test('a repeated tap resumes the live browser request instead of queueing another', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.browser_build_request', rows: [] },
    { match: "status IN ('queued','claimed','running')",
      rows: [{ id: 3, shop_id: SHOP_ID, status: 'running', claimed_by: 'runner-a' }] }
  ]);

  const result = await store.requestBrowserBuild(SHOP_ID, { client: client });
  assert.equal(result.created, false);
  assert.equal(result.resumed, true);
  assert.equal(result.request.status, 'running');
  assert.match(statements(client)[1], /ON CONFLICT DO NOTHING/);
});

test('the claim is ONE atomic statement, so two runners can never both win', async function () {
  const winner = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [{ id: 3, shop_id: SHOP_ID, status: 'claimed', claimed_by: 'runner-a' }] },
    { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 14, occurred_at: 'now' }] }
  ]);
  const a = await store.claimBrowserBuild(SHOP_ID, 'runner-a', { client: winner });
  assert.equal(a.claimed, true);
  assert.equal(a.held_by, 'runner-a');

  const claimSql = statements(winner)[1];
  assert.match(claimSql, /^UPDATE asdair\.browser_build_request/);
  assert.match(claimSql, /WHERE shop_id = \$1 AND status = 'queued'/);
  assert.match(claimSql, /RETURNING/);
  // The whole point: the claim is decided by ONE statement. A SELECT before it
  // would open exactly the window this design exists to close.
  assert.equal(indexOfMatching(winner, 'SELECT'), -1,
    'no read may precede the claim - the WHERE clause IS the mutual exclusion');

  const loser = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [] },
    { match: "status IN ('queued','claimed','running')",
      rows: [{ id: 3, shop_id: SHOP_ID, status: 'claimed', claimed_by: 'runner-a' }] }
  ]);
  const b = await store.claimBrowserBuild(SHOP_ID, 'runner-b', { client: loser });
  assert.equal(b.claimed, false);
  assert.equal(b.held_by, 'runner-a', 'the loser is told who holds it, not left to guess');
  assert.equal(countMatching(loser, 'INSERT'), 0);
});

test('progress may only be reported on a request the runner holds', async function () {
  const client = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [] },
    { match: 'FROM asdair.browser_build_request WHERE id = $1', rows: [{ id: 3, status: 'complete' }] }
  ]);
  await assert.rejects(function () {
    return store.updateBrowserProgress(3, { basket_product_count: 40 }, { client: client });
  }, /not claimed\/running/);
  assert.equal(statements(client).pop(), 'ROLLBACK');
});

// =====================================================================
// WP-B15-19 - updateBrowserProgress CANNOT SILENTLY DESTROY A HANDOFF
//
// `SET progress = $1::jsonb` replaces the whole object. Once openHandoff began
// writing the operating contract onto `progress.handoff`, a progress write that
// did not carry it DELETED the only artefact the operator's report can ever be
// checked against - and the failure surfaced two steps later, in the pipeline,
// as "carries a completion report but no handoff to check it against".
//
// The guard is a WHERE predicate, so it is proven here the way this file proves
// every other guarantee: by the SHAPE of the statement that was actually sent.
// =====================================================================

test('WP-B15-19: the progress UPDATE carries the artefact predicate, so Postgres refuses the destructive write', async function () {
  const client = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [{ id: 3, status: 'running', progress: {} }] }
  ]);
  await store.updateBrowserProgress(3, { basket_product_count: 40 }, { client: client });

  const update = statements(client).find(function (s) { return s.indexOf('UPDATE asdair.browser_build_request') === 0; });

  // The pinned prefix is unchanged ON PURPOSE - pipeline/test/fakePg.js matches
  // on it, and this writer still REPLACES rather than merges.
  assert.ok(update.indexOf("SET progress = $1::jsonb, status = 'running'") !== -1,
    'the statement must still be a whole-object replace - the fix is a refusal, not a merge');

  assert.ok(update.indexOf("progress->'handoff' IS NULL OR jsonb_exists($1::jsonb, 'handoff')") !== -1,
    'without this predicate a progress write silently deletes progress.handoff, and the loss is UNRECOVERABLE '
    + '- replanning consults a model, so the packet the operator shopped from cannot be rebuilt');
});

test('WP-B15-19: a write that would drop an existing handoff is REFUSED, and says why', async function () {
  const client = makeClient([
    // Postgres matches zero rows because of the artefact predicate.
    { match: 'UPDATE asdair.browser_build_request', rows: [] },
    { match: 'FROM asdair.browser_build_request WHERE id = $1',
      rows: [{ id: 3, status: 'running', claimed_by: 'runner-a', progress: { handoff: { packet_fingerprint: 'abc123' } } }] }
  ]);

  await assert.rejects(function () {
    return store.updateBrowserProgress(3, { basket_product_count: 40 }, { client: client });
  }, function (e) {
    assert.match(e.message, /would DESTROY it/,
      'the operator must be told the artefact was the reason, not sent to look at the lease');
    assert.match(e.message, /handoffCli/, 'and told where a supervised basket report actually belongs');
    assert.match(e.message, /Nothing was written/);
    return true;
  });

  assert.equal(statements(client).pop(), 'ROLLBACK');
});

test('WP-B15-19: the fence is narrow - it stops destruction, not ordinary progress', async function () {
  // (a) A row with NO artefact is the CDP runner's ordinary case, and is untouched.
  const plain = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [{ id: 3, status: 'running', progress: { step: 4 } }] }
  ]);
  const a = await store.updateBrowserProgress(3, { step: 4 }, { client: plain });
  assert.equal(a.changed, true);

  // (b) A caller that DOES carry the artefact through is allowed. The predicate
  //     asks whether the artefact SURVIVES, never who the caller is.
  const carrying = makeClient([
    { match: 'UPDATE asdair.browser_build_request',
      rows: [{ id: 3, status: 'running', progress: { handoff: { packet_fingerprint: 'abc123' }, step: 5 } }] }
  ]);
  const b = await store.updateBrowserProgress(3, { handoff: { packet_fingerprint: 'abc123' }, step: 5 }, { client: carrying });
  assert.equal(b.changed, true);
  assert.equal(countMatching(carrying, 'FROM asdair.browser_build_request WHERE id = $1'), 0,
    'a successful write must not go looking for a reason it did not need');
});

test('a failed browser build must carry a reason, or it cannot be resumed from', async function () {
  const client = makeClient([]);
  await assert.rejects(function () {
    return store.finishBrowserBuild(3, { status: 'failed' }, { client: client });
  }, /must carry last_error/);
  assert.equal(client.log.length, 0);

  await assert.rejects(function () {
    return store.finishBrowserBuild(3, { status: 'done' }, { client: client });
  }, /"complete", "failed" or "cancelled"/);
});

test('finishing an already-finished request is a reported no-op, not a rewrite', async function () {
  const client = makeClient([
    { match: 'UPDATE asdair.browser_build_request', rows: [] },
    { match: 'FROM asdair.browser_build_request WHERE id = $1', rows: [{ id: 3, status: 'complete' }] }
  ]);
  const result = await store.finishBrowserBuild(3, { status: 'complete' }, { client: client });
  assert.equal(result.changed, false);
  assert.equal(result.already_finished, true);
});

// =====================================================================
// pending actions
// =====================================================================

test('adding the same outstanding action twice adopts the pending one', async function () {
  const client = makeClient([
    { match: 'INSERT INTO asdair.pending_action', rows: [] },
    { match: "FROM asdair.pending_action WHERE household_id = $1",
      rows: [{ id: 2, household_id: HH, action_type: 'add_favourite', action_key: 'synthetic-item-1', status: 'pending' }] }
  ]);

  const result = await store.addPendingAction({
    household_id: HH, action_type: 'add_favourite', action_key: 'synthetic-item-1'
  }, { client: client });

  assert.equal(result.created, false);
  assert.equal(result.resumed, true);
  assert.match(statements(client)[1], /ON CONFLICT DO NOTHING/);
  assert.match(statements(client)[1], /::jsonb/);
});

test('only a pending action can be resolved', async function () {
  const client = makeClient([{ match: 'UPDATE asdair.pending_action', rows: [] }]);
  await assert.rejects(function () {
    return store.resolvePendingAction(2, { status: 'done' }, { client: client });
  }, /is not pending/);

  const bad = makeClient([]);
  await assert.rejects(function () {
    return store.resolvePendingAction(2, { status: 'binned' }, { client: bad });
  }, /"done" or "abandoned"/);
  assert.equal(bad.log.length, 0);
});

// =====================================================================
// Structural guarantees asserted on the SOURCE, so a later edit cannot
// quietly lose them.
// =====================================================================

function sourceWithoutComments(file) {
  const raw = fs.readFileSync(path.join(__dirname, file), 'utf8');
  return raw.split('\n').filter(function (line) {
    return line.trim().indexOf('//') !== 0;
  }).join('\n');
}

test('shopStore never deletes: no DELETE, TRUNCATE or DROP anywhere in it', function () {
  const code = sourceWithoutComments('shopStore.js');
  [/\bDELETE\b/i, /\bTRUNCATE\b/i, /\bDROP\b/i].forEach(function (re) {
    assert.equal(re.test(code), false, 'shopStore must not contain ' + re);
  });
});

test('there is EXACTLY ONE place that writes asdair.shop.status', function () {
  const code = sourceWithoutComments('shopStore.js');
  const hits = code.match(/UPDATE asdair\.shop SET/g) || [];
  assert.equal(hits.length, 1,
    'a second status-writing statement would make "no transition without an audit event" unenforceable');
});

test('the shop UPDATE is built from an allowlist that excludes identity and evidence', function () {
  const allowed = store._internal.SHOP_UPDATE_ALLOWED_COLUMNS;
  ['household_id', 'shop_ref', 'source_kind', 'raw_text', 'raw_media_path',
    'telegram_chat_id', 'telegram_message_id', 'created_at'].forEach(function (col) {
    assert.equal(allowed.indexOf(col), -1, col + ' must never be settable while progressing a shop');
  });
  // WP-B15-22 (Gate Zero): transcript_provider/transcript_model/
  // transcript_confidence added - provenance for a photo interpretation,
  // never a substitute for the raw evidence. `transcript` itself (the raw
  // text) is deliberately still absent from this allowlist and must stay so.
  assert.equal(allowed.indexOf('transcript'), -1,
    'the raw transcript text must never be settable while progressing a shop - only its provenance/summary');
  // WP-B15-35: `human_state` added. It is a DERIVED PROJECTION of `status`,
  // written by the same statement, and carries no evidence and no identity -
  // which is why it belongs on this list while `transcript` still does not.
  // The literal is pinned here, outside the source it checks, so adding a
  // column to the allowlist is a deliberate two-file act rather than a drift.
  assert.deepEqual(allowed, [
    'status', 'human_state', 'last_error', 'list_id',
    'transcript_provider', 'transcript_model', 'transcript_confidence',
  ]);
  assert.deepEqual(store._internal.SHOP_UPDATE_LITERALS, { updated_at: 'now()' });
});

test('no connection string is ever hardcoded, logged or read from a file', function () {
  ['shopStore.js', 'shopStatus.js', 'shopState.js', 'shop-cli.js'].forEach(function (file) {
    const code = sourceWithoutComments(file);
    assert.equal(/postgres(ql)?:\/\//.test(code), false, file + ' must not contain a connection string');
    assert.equal(/console\.log\([^)]*DB_URL/.test(code), false, file + ' must never print a DB URL');
    assert.equal(/\.pgpass|credentials|\.env['"]/.test(code), false,
      file + ' must not read a credentials file');
  });
  const storeCode = sourceWithoutComments('shopStore.js');
  assert.match(storeCode, /process\.env\.ASDAIR_WRITE_DB_URL/);
  assert.equal(/process\.env\.ASDAIR_DB_URL/.test(storeCode), false,
    'the writer must use the WRITE url only');
});

test('pg is required lazily, so the pure paths load with no dependencies installed', function () {
  const code = sourceWithoutComments('shopStore.js');
  assert.equal(/^const .*require\(['"]pg['"]\)/m.test(code), false,
    'pg must not be required at module scope');
  assert.match(code, /const \{ Pool \} = require\('pg'\)/);
});

// =====================================================================
// WP-B15-35 - shop.human_state: the capability probe and the column write.
//
// THE SEAM AC1 EXISTS TO CLOSE. Migration 020 defines asdair.shop.human_state
// and hands the mapping to this code path. Verified read-only against the live
// database on 2026-08-13, the migration is NOT applied there - so the write
// must be capability-gated or every transition in production would fail on a
// column that does not exist.
//
// These cases prove BOTH branches, and prove the gate reports itself rather
// than degrading silently.
// =====================================================================

/** The probe is process-cached, so each case below sets the state it needs. */
function withProbe(present, fn) {
  return async function () {
    store._internal._setHumanStateProbe(present);
    try { await fn(); } finally { store._internal._setHumanStateProbe(false); }
  };
}

test('WHEN THE COLUMN EXISTS the transition writes human_state beside status',
  withProbe(true, async function () {
    const client = makeClient([
      { match: 'FROM asdair.shop WHERE id = $1 FOR UPDATE', rows: [shopRow({ status: 'RECEIVED' })] },
      { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'PROCESSING' })] },
      { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 7, occurred_at: 'now' }] }
    ]);

    await store.transition(SHOP_ID, 'PROCESSING', 'list parsed', { client: client });

    const update = client.log[2];
    assert.match(update.sql, /human_state = \$\d+/,
      'the canonical column must be written by the SAME statement that moves status');
    assert.ok(update.params.indexOf('ASDAIR_WORKING') !== -1,
      'PROCESSING must persist as ASDAIR_WORKING - the value the readers derive for it');
  }));

test('WHEN THE COLUMN IS ABSENT the transition still works and writes no human_state',
  withProbe(false, async function () {
    // The production reality tonight. A shop must still be able to progress.
    const client = makeClient([
      { match: 'FROM asdair.shop WHERE id = $1 FOR UPDATE', rows: [shopRow({ status: 'RECEIVED' })] },
      { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'PROCESSING' })] },
      { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 7, occurred_at: 'now' }] }
    ]);

    const result = await store.transition(SHOP_ID, 'PROCESSING', 'list parsed', { client: client });
    assert.equal(result.changed, true, 'a missing column must never block the week');

    const update = client.log[2];
    assert.equal(/human_state/.test(update.sql), false,
      'writing a column the database does not have would 500 every transition');
  }));

test('needs_review escalates the PERSISTED value, not just the displayed one',
  withProbe(true, async function () {
    const client = makeClient([
      { match: 'FROM asdair.shop WHERE id = $1 FOR UPDATE', rows: [shopRow({ status: 'RECEIVED', needs_review: true })] },
      { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'PROCESSING' })] },
      { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 7, occurred_at: 'now' }] }
    ]);

    await store.transition(SHOP_ID, 'PROCESSING', 'list parsed', { client: client });

    assert.ok(client.log[2].params.indexOf('NEEDS_WARWICK') !== -1,
      'a shop flagged needs_review must persist as NEEDS_WARWICK, or Telegram and Cockpit would ' +
      'read a durable value that disagrees with what the reader derives');
  }));

test('recordFailure persists FAILED as the human state too',
  withProbe(true, async function () {
    const client = makeClient([
      { match: 'FROM asdair.shop WHERE id = $1 FOR UPDATE', rows: [shopRow({ status: 'PROCESSING' })] },
      { match: 'UPDATE asdair.shop SET', rows: [shopRow({ status: 'FAILED' })] },
      { match: 'INSERT INTO asdair.shop_event', rows: [{ id: 9, occurred_at: 'now' }] }
    ]);

    await store.recordFailure(SHOP_ID, 'gateway refused', { client: client });

    assert.ok(client.log[2].params.indexOf('FAILED') !== -1,
      'a parked shop must not keep reporting the state it was in before it broke');
  }));

test('the probe asks the CATALOGUE, never the shop table, and caches its answer', async function () {
  store._internal._resetHumanStateProbe();
  try {
    const client = makeClient([
      { match: 'information_schema.columns', rows: [{ '?column?': 1 }], repeat: true }
    ]);

    assert.equal(await store._internal.hasHumanStateColumn(client), true);
    assert.equal(await store._internal.hasHumanStateColumn(client), true);

    assert.equal(client.log.length, 1, 'the probe must run ONCE per process, not once per transition');
    assert.match(client.log[0].sql, /information_schema\.columns/);
    assert.equal(/FROM asdair\.shop\b/.test(client.log[0].sql), false,
      'the probe must not read a single row of shop data');
  } finally {
    store._internal._setHumanStateProbe(false);
  }
});

test('an ABSENT column is reported loudly on stderr, once, naming the migration', async function () {
  store._internal._resetHumanStateProbe();
  const written = [];
  const realError = console.error;
  console.error = function (line) { written.push(String(line)); };

  try {
    const client = makeClient([{ match: 'information_schema.columns', rows: [], repeat: true }]);
    assert.equal(await store._internal.hasHumanStateColumn(client), false);
    await store._internal.hasHumanStateColumn(client);
  } finally {
    console.error = realError;
    store._internal._setHumanStateProbe(false);
  }

  assert.equal(written.length, 1, 'exactly one warning per process - loud, not a log flood');
  const parsed = JSON.parse(written[0]);
  assert.equal(parsed.level, 'warn');
  assert.equal(parsed.event, 'human_state_column_absent');
  assert.match(parsed.migration, /020_shop_line_provenance_and_human_state\.sql/,
    'the warning must name the migration that has not been run, or nobody can act on it');
});
