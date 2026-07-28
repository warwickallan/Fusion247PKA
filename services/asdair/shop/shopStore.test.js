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
  assert.deepEqual(allowed, ['status', 'last_error', 'list_id']);
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
