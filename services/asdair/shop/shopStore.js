// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopStore.js
//
// The WRITE half of the shop control surface. One transaction per operation,
// every operation idempotent by CONSTRUCTION rather than by convention.
//
// WRITE BOUNDARY (why this file is not in services/asdair/skill/):
//   services/asdair/skill/ is READ-ONLY BY CONTRACT - every query in data.js
//   is a SELECT inside `BEGIN TRANSACTION READ ONLY`. That invariant is not
//   weakened here: this writer lives in its own sibling folder, exactly as
//   outcome/recordShopOutcome.js does, so "the skill never writes" stays
//   literally true and reviewable.
//
// THE FOUR GUARANTEES THIS MODULE EXISTS TO PROVIDE
//
//  1. A REDELIVERED TELEGRAM MESSAGE RESUMES, IT NEVER DUPLICATES A WEEK.
//     createOrResumeShop is INSERT ... ON CONFLICT DO NOTHING followed by a
//     re-select on the natural key. It is NOT check-then-insert: between a
//     "does it exist?" SELECT and an INSERT, a concurrent delivery can slip
//     in, and both callers would then believe they created the week. Here the
//     database decides, and the loser simply reads back the winner's row.
//     ON CONFLICT carries NO target, so it covers BOTH unique indexes on
//     asdair.shop - the inbound (chat, message) key and (household, shop_ref).
//
//  2. A STATUS CHANGE WITHOUT AN AUDIT EVENT IS IMPOSSIBLE.
//     applyTransition() is the ONLY function in this file that emits an
//     `UPDATE asdair.shop SET status`, and it always emits the matching
//     asdair.shop_event INSERT immediately afterwards, inside the SAME
//     transaction. transition() and recordFailure() both go through it.
//     shopStore.test.js asserts on the source text that no second
//     status-writing statement has appeared, so the guarantee cannot be
//     quietly lost in a later edit.
//
//  3. TWO RUNNERS CAN NEVER BOTH CLAIM THE SAME BROWSER BUILD.
//     claimBrowserBuild is a single atomic statement -
//     `UPDATE ... WHERE status = 'queued' RETURNING` - so the row lock and the
//     status re-check happen together in the database. The loser gets zero
//     rows and is told who holds it. No advisory lock, no read-then-write, no
//     window.
//
//  4. A QUESTION IS ASKED AT MOST ONCE PER SHOP, EVER.
//     openQuestion is ON CONFLICT (shop_id, question_key) DO NOTHING plus a
//     re-select, so re-opening an already-ANSWERED question writes nothing and
//     hands back the answer that already exists.
//
// NEVER DELETES. This module emits exactly two statement shapes, INSERT and a
// column-restricted UPDATE. There is no DELETE, no TRUNCATE and no DROP
// anywhere in it, and the test suite asserts that on the source text.
//
// SECRETS:
//   The connection string comes ONLY from process.env.ASDAIR_WRITE_DB_URL. It
//   is never hardcoded, never printed, never logged, and never passed on a
//   command line. `pg` is required lazily so this module (and all of its pure
//   validation) loads on a box with no dependencies installed.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const {
  buildShopCreate,
  buildTransition,
  buildQuestion,
  buildAnswer,
  buildBrowserRequest,
  buildPendingAction,
  assertTransition,
  SHOP_INSERT_COLUMNS,
  QUESTION_INSERT_COLUMNS,
  PENDING_ACTION_INSERT_COLUMNS,
  BROWSER_LIVE_STATUSES,
  TERMINAL_STATUSES,
  _internal: stateInternal
} = require('./shopState');

const toDbId = stateInternal.toDbId;
const requireText = stateInternal.requireText;

// Columns every read-back hands to the caller. One constant so a resumed shop
// and a freshly-created one are always the same shape.
const SHOP_SELECT_COLUMNS = [
  'id', 'household_id', 'shop_ref', 'status', 'source_kind',
  'telegram_chat_id', 'telegram_message_id', 'telegram_update_id',
  'list_id', 'needs_review', 'last_error', 'created_at', 'updated_at'
];
const SHOP_SELECT_LIST = SHOP_SELECT_COLUMNS.join(', ');

const QUESTION_SELECT_LIST =
  'id, shop_id, list_item_id, question_key, question_text, candidates, status, ' +
  'answer_text, answer_source, card_chat_id, card_message_id, asked_at, answered_at';

const BROWSER_SELECT_LIST =
  'id, shop_id, status, claimed_by, progress, last_error, requested_at, claimed_at, finished_at';

const PENDING_SELECT_LIST =
  'id, household_id, shop_id, action_type, action_key, payload, status, note, created_at, resolved_at';

// The columns of asdair.shop this module is allowed to SET, and nothing else.
// The SET clause is BUILT from this list rather than filtered against it, so a
// column that is not here has no path into the SQL at all. Note what is
// absent and must stay absent: household_id, shop_ref, source_kind, and every
// raw_* evidence column. Progressing a shop must never be able to rewrite what
// arrived or which week it belongs to.
const SHOP_UPDATE_ALLOWED_COLUMNS = ['status', 'last_error', 'list_id'];

// SQL literals for columns the database, not the caller, must time. This
// module has no clock; now() is the honest answer for "when did this happen".
const SHOP_UPDATE_LITERALS = { updated_at: 'now()' };

const SHOP_EVENT_INSERT_SQL =
  'INSERT INTO asdair.shop_event (shop_id, event_type, from_status, to_status, description) ' +
  'VALUES ($1, $2, $3, $4, $5) RETURNING id, occurred_at';

const SELECT_SHOP_FOR_UPDATE_SQL =
  'SELECT ' + SHOP_SELECT_LIST + ' FROM asdair.shop WHERE id = $1 FOR UPDATE';

const SELECT_SHOP_BY_INBOUND_SQL =
  'SELECT ' + SHOP_SELECT_LIST + ' FROM asdair.shop ' +
  'WHERE telegram_chat_id = $1 AND telegram_message_id = $2';

const SELECT_SHOP_BY_REF_SQL =
  'SELECT ' + SHOP_SELECT_LIST + ' FROM asdair.shop WHERE household_id = $1 AND shop_ref = $2';

// The resume point after a failure is not guessed: it is the from_status of
// the shop's most recent durable failure event.
const SELECT_LAST_FAILURE_SQL =
  "SELECT from_status, description, occurred_at FROM asdair.shop_event " +
  "WHERE shop_id = $1 AND event_type = 'failure' ORDER BY id DESC LIMIT 1";

const SELECT_QUESTION_BY_KEY_SQL =
  'SELECT ' + QUESTION_SELECT_LIST + ' FROM asdair.shop_question WHERE shop_id = $1 AND question_key = $2';

const SELECT_QUESTION_BY_KEY_FOR_UPDATE_SQL = SELECT_QUESTION_BY_KEY_SQL + ' FOR UPDATE';

const SELECT_QUESTION_BY_ID_FOR_UPDATE_SQL =
  'SELECT ' + QUESTION_SELECT_LIST + ' FROM asdair.shop_question WHERE id = $1 FOR UPDATE';

const SELECT_LIVE_BROWSER_REQUEST_SQL =
  'SELECT ' + BROWSER_SELECT_LIST + ' FROM asdair.browser_build_request ' +
  "WHERE shop_id = $1 AND status IN ('queued','claimed','running') ORDER BY id DESC LIMIT 1";

const SELECT_BROWSER_REQUEST_BY_ID_SQL =
  'SELECT ' + BROWSER_SELECT_LIST + ' FROM asdair.browser_build_request WHERE id = $1';

// ATOMIC CLAIM. One statement: the WHERE re-checks 'queued' under the row lock
// the UPDATE itself takes, so of two concurrent runners exactly one can match.
const CLAIM_BROWSER_REQUEST_SQL =
  'UPDATE asdair.browser_build_request ' +
  "SET status = 'claimed', claimed_by = $2, claimed_at = now() " +
  "WHERE shop_id = $1 AND status = 'queued' RETURNING " + BROWSER_SELECT_LIST;

const SELECT_PENDING_ACTION_SQL =
  'SELECT ' + PENDING_SELECT_LIST + ' FROM asdair.pending_action ' +
  "WHERE household_id = $1 AND action_type = $2 AND action_key = $3 AND status = 'pending'";

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair Postgres connection string as ' +
      'ASDAIR_WRITE_DB_URL before writing to the shop control surface.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

function fail(message) {
  throw new Error('shopStore: ' + message);
}

function firstRow(res) {
  const rows = (res && res.rows) || [];
  return rows.length ? rows[0] : null;
}

function rowCount(res) {
  if (!res) return 0;
  if (typeof res.rowCount === 'number') return res.rowCount;
  return ((res.rows) || []).length;
}

// jsonb parameters are JSON.stringify'd and explicitly cast. Left as a bare
// JS value, node-postgres would render an ARRAY as a Postgres array literal
// ({a,b}) rather than JSON, which asdair.shop_question.candidates would then
// reject or, worse, store wrong. Stringify + ::jsonb removes the ambiguity.
function jsonParam(value) {
  return JSON.stringify(value === undefined ? null : value);
}

// ---------------------------------------------------------------------
// Run `fn` inside one transaction. An injected client (options.client) is
// used as-is so a caller composing several writes owns the transaction
// boundary; otherwise a client is taken from the pool and released.
// Any throw ROLLBACKs, so no operation is ever half-written.
// ---------------------------------------------------------------------
async function inTransaction(options, fn) {
  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

// =====================================================================
// 1. createOrResumeShop - idempotent on (telegram_chat_id, telegram_message_id)
// =====================================================================
//
// Returns { shop, created, resumed, matched_by }.
//
//   matched_by 'insert'            this call created the week.
//   matched_by 'telegram_message'  a shop already existed for this exact
//                                  Telegram message: it is RESUMED and
//                                  NOTHING was written.
//   matched_by 'shop_ref'          a shop already existed for this household
//                                  and week under a DIFFERENT message (a
//                                  second list for the same week). It is also
//                                  resumed, and the caller is told which key
//                                  matched so it can say so out loud rather
//                                  than pretend the new message created it.
//
async function createOrResumeShop(intent, options) {
  // PURE validation first: a bad shop_ref or half an inbound key fails BEFORE
  // any connection is opened.
  const built = buildShopCreate(intent);

  return inTransaction(options, async function (client) {
    const params = built.columns.map(function (col) {
      const v = built.row[col];
      return v === undefined ? null : v;
    });
    const placeholders = built.columns.map(function (_, i) { return '$' + (i + 1); });

    // NO conflict target: asdair.shop carries TWO unique indexes and this must
    // survive a collision on either. DO NOTHING (never DO UPDATE) because an
    // upsert would be a route to rewriting an existing week's evidence.
    const insertSql = 'INSERT INTO asdair.shop (' + built.columns.join(', ') + ') VALUES (' +
      placeholders.join(', ') + ') ON CONFLICT DO NOTHING RETURNING ' + SHOP_SELECT_LIST;

    const inserted = firstRow(await client.query(insertSql, params));
    if (inserted) {
      await client.query(SHOP_EVENT_INSERT_SQL, [
        inserted.id,
        'milestone',
        null,
        'RECEIVED',
        'shop ' + built.row.shop_ref + ' created from a ' + built.row.source_kind + ' message'
      ]);
      return { shop: inserted, created: true, resumed: false, matched_by: 'insert' };
    }

    // The insert wrote nothing, so an existing row holds one of the natural
    // keys. Re-select on them, most specific first.
    if (built.row.telegram_chat_id !== null && built.row.telegram_message_id !== null) {
      const byInbound = firstRow(await client.query(SELECT_SHOP_BY_INBOUND_SQL,
        [built.row.telegram_chat_id, built.row.telegram_message_id]));
      if (byInbound) {
        return { shop: byInbound, created: false, resumed: true, matched_by: 'telegram_message' };
      }
    }

    const byRef = firstRow(await client.query(SELECT_SHOP_BY_REF_SQL,
      [built.row.household_id, built.row.shop_ref]));
    if (byRef) {
      return { shop: byRef, created: false, resumed: true, matched_by: 'shop_ref' };
    }

    fail('the insert wrote no shop and no existing shop matches either natural key ' +
      '(telegram_chat_id + telegram_message_id, or household_id + shop_ref). Nothing was written.');
  });
}

// =====================================================================
// 2. applyTransition - THE ONLY place asdair.shop.status is written.
// =====================================================================
//
// It runs the guarded UPDATE and the matching shop_event INSERT back to back
// on the SAME client, inside the caller's transaction. There is no argument,
// no flag and no code path that produces one without the other.
//
// The UPDATE carries `AND status = $expected`: combined with the SELECT ...
// FOR UPDATE the callers take first, that means a concurrent writer which
// moved the shop between the read and the write causes zero rows to match and
// the whole operation to ROLLBACK with a clear message - rather than
// overwriting a status the validation never saw.
//
async function applyTransition(client, spec) {
  const params = [];
  const assignments = [];

  SHOP_UPDATE_ALLOWED_COLUMNS.forEach(function (col) {
    if (!Object.prototype.hasOwnProperty.call(spec.set, col)) return;
    params.push(spec.set[col] === undefined ? null : spec.set[col]);
    assignments.push(col + ' = $' + params.length);
  });
  Object.keys(SHOP_UPDATE_LITERALS).forEach(function (col) {
    assignments.push(col + ' = ' + SHOP_UPDATE_LITERALS[col]);
  });

  params.push(spec.shop_id);
  const idPlaceholder = '$' + params.length;
  params.push(spec.from_status);
  const expectedPlaceholder = '$' + params.length;

  const sql = 'UPDATE asdair.shop SET ' + assignments.join(', ') +
    ' WHERE id = ' + idPlaceholder + ' AND status = ' + expectedPlaceholder + ' RETURNING ' + SHOP_SELECT_LIST;

  const res = await client.query(sql, params);
  if (rowCount(res) !== 1) {
    fail('shop ' + String(spec.shop_id) + ' was modified concurrently - its status was no longer "' +
      spec.from_status + '" when the update ran, so the transition to "' + spec.to_status +
      '" was validated against a stale state. Nothing was written; re-read and retry.');
  }

  const event = firstRow(await client.query(SHOP_EVENT_INSERT_SQL, [
    spec.shop_id,
    spec.event.event_type,
    spec.event.from_status,
    spec.event.to_status,
    spec.event.description
  ]));

  return { shop: firstRow(res), event: event };
}

async function readShopForUpdate(client, shopId) {
  const shop = firstRow(await client.query(SELECT_SHOP_FOR_UPDATE_SQL, [shopId]));
  if (!shop) fail('no asdair.shop row with id ' + String(shopId) + '. Nothing was written.');
  return shop;
}

async function readResumeFrom(client, shopId) {
  const row = firstRow(await client.query(SELECT_LAST_FAILURE_SQL, [shopId]));
  return row ? row.from_status : null;
}

// =====================================================================
// 3. transition - validate, update, audit. All three or none.
// =====================================================================
async function transition(shopId, toStatus, description, options) {
  const id = toDbId(shopId, 'transition: shopId');

  return inTransaction(options, async function (client) {
    const shop = await readShopForUpdate(client, id);

    // Resuming from FAILED needs the state it failed from. That is DURABLE
    // state (the last failure event), never a caller assertion, so a caller
    // cannot smuggle a shop back into a stage it never reached.
    let resumeFrom = null;
    if (shop.status === 'FAILED') resumeFrom = await readResumeFrom(client, id);

    const built = buildTransition({
      from_status: shop.status,
      to_status: toStatus,
      description: description,
      resume_from: resumeFrom
    });

    if (built.kind === 'noop') {
      // A redelivered tap re-driving the shop to the stage it already holds.
      // Writing an event for it would be noise pretending to be history.
      return { shop: shop, changed: false, kind: 'noop', event: null };
    }

    const applied = await applyTransition(client, {
      shop_id: id,
      from_status: shop.status,
      to_status: built.to_status,
      set: { status: built.to_status },
      event: built.event
    });

    return { shop: applied.shop, changed: true, kind: built.kind, event: applied.event };
  });
}

// =====================================================================
// 4. recordFailure - park the shop, keeping enough to resume.
// =====================================================================
//
// The resume point is the failure event's from_status. That is why a SECOND
// failure while already FAILED does NOT rewrite it: the shop failed out of the
// original live state, and losing that would strand the week. The repeat call
// records the new error and a fresh failure event carrying the SAME
// from_status, so the resume target survives any number of retries.
//
async function recordFailure(shopId, error, options) {
  const id = toDbId(shopId, 'recordFailure: shopId');
  const message = typeof error === 'string'
    ? requireText(error, 'recordFailure: error')
    : requireText(error && error.message ? error.message : String(error), 'recordFailure: error');

  return inTransaction(options, async function (client) {
    const shop = await readShopForUpdate(client, id);

    if (TERMINAL_STATUSES.indexOf(shop.status) !== -1) {
      fail('shop ' + String(id) + ' is ' + shop.status + ', which is terminal - it cannot fail. ' +
        'Nothing was written.');
    }

    if (shop.status === 'FAILED') {
      const resumeFrom = await readResumeFrom(client, id);
      const applied = await applyTransition(client, {
        shop_id: id,
        from_status: 'FAILED',
        to_status: 'FAILED',
        set: { status: 'FAILED', last_error: message },
        event: {
          event_type: 'failure',
          // Deliberately the ORIGINAL resume point, not 'FAILED': the durable
          // answer to "where does this shop resume?" must not decay with
          // repeated failures.
          from_status: resumeFrom,
          to_status: 'FAILED',
          description: message
        }
      });
      return {
        shop: applied.shop,
        changed: false,
        already_failed: true,
        resume_from: resumeFrom,
        event: applied.event
      };
    }

    // Proves the abort is legal from here (and refuses it from a terminal
    // state) using the same map every other move is judged by.
    assertTransition(shop.status, 'FAILED', {});

    const applied = await applyTransition(client, {
      shop_id: id,
      from_status: shop.status,
      to_status: 'FAILED',
      set: { status: 'FAILED', last_error: message },
      event: {
        event_type: 'failure',
        from_status: shop.status,
        to_status: 'FAILED',
        description: message
      }
    });

    return {
      shop: applied.shop,
      changed: true,
      already_failed: false,
      resume_from: shop.status,
      event: applied.event
    };
  });
}

// =====================================================================
// 5. openQuestion - idempotent on (shop_id, question_key)
// =====================================================================
//
// Returns { question, created, already_answered }. Re-opening a question that
// has already been answered writes NOTHING and hands back the existing answer,
// which is what stops the bot re-asking something Warwick has already settled.
//
async function openQuestion(intent, options) {
  const built = buildQuestion(intent);

  return inTransaction(options, async function (client) {
    const params = built.columns.map(function (col) {
      const v = built.row[col];
      if (col === 'candidates') return jsonParam(v);
      return v === undefined ? null : v;
    });
    const placeholders = built.columns.map(function (col, i) {
      return '$' + (i + 1) + (col === 'candidates' ? '::jsonb' : '');
    });

    const insertSql = 'INSERT INTO asdair.shop_question (' + built.columns.join(', ') + ') VALUES (' +
      placeholders.join(', ') + ') ON CONFLICT (shop_id, question_key) DO NOTHING RETURNING ' +
      QUESTION_SELECT_LIST;

    const inserted = firstRow(await client.query(insertSql, params));
    if (inserted) {
      return { question: inserted, created: true, already_answered: false };
    }

    const existing = firstRow(await client.query(SELECT_QUESTION_BY_KEY_SQL,
      [built.row.shop_id, built.row.question_key]));
    if (!existing) {
      fail('the insert wrote no question and no question with key "' + built.row.question_key +
        '" exists on shop ' + String(built.row.shop_id) + '. Nothing was written.');
    }
    return {
      question: existing,
      created: false,
      already_answered: existing.status === 'answered' || existing.status === 'skipped'
    };
  });
}

// =====================================================================
// 6. answerQuestion - the decision, plus its audit event.
// =====================================================================
//
// FIRST ANSWER WINS. A question already answered or skipped is returned
// unchanged with changed:false, so a double-tapped Telegram button cannot
// overwrite a decision or write a second decision event. Changing a settled
// answer is a deliberate act, and there is no flag here that performs one.
//
async function answerQuestion(intent, options) {
  const built = buildAnswer(intent);

  return inTransaction(options, async function (client) {
    const existing = built.question_id === null
      ? firstRow(await client.query(SELECT_QUESTION_BY_KEY_FOR_UPDATE_SQL, [built.shop_id, built.question_key]))
      : firstRow(await client.query(SELECT_QUESTION_BY_ID_FOR_UPDATE_SQL, [built.question_id]));

    if (!existing) {
      fail('no open question matches ' + (built.question_id === null
        ? 'shop ' + String(built.shop_id) + ' / key "' + built.question_key + '"'
        : 'question id ' + String(built.question_id)) + '. Nothing was written.');
    }

    if (existing.status !== 'open') {
      return { question: existing, changed: false, already_answered: true, event: null };
    }

    const updateSql =
      'UPDATE asdair.shop_question SET status = $1, answer_text = $2, answer_source = $3, ' +
      "answered_at = now() WHERE id = $4 AND status = 'open' RETURNING " + QUESTION_SELECT_LIST;

    const res = await client.query(updateSql, [
      built.set.status,
      built.set.answer_text,
      built.set.answer_source,
      existing.id
    ]);
    if (rowCount(res) !== 1) {
      fail('question ' + String(existing.id) + ' was answered concurrently between the read and the write. ' +
        'Nothing was written.');
    }

    const event = firstRow(await client.query(SHOP_EVENT_INSERT_SQL, [
      existing.shop_id,
      built.event.event_type,
      null,
      null,
      built.event.description
    ]));

    return { question: firstRow(res), changed: true, already_answered: false, event: event };
  });
}

// =====================================================================
// 7. The browser build request lifecycle
// =====================================================================

// requestBrowserBuild - repeated taps RESUME the live request rather than
// queueing a second one. Migration 006's partial unique index (one live
// request per shop) is what makes that structural; ON CONFLICT DO NOTHING with
// no target lets the database enforce it and this code simply reads back.
async function requestBrowserBuild(shopId, options) {
  const built = buildBrowserRequest(shopId);

  return inTransaction(options, async function (client) {
    const insertSql =
      'INSERT INTO asdair.browser_build_request (shop_id, status) VALUES ($1, $2) ' +
      'ON CONFLICT DO NOTHING RETURNING ' + BROWSER_SELECT_LIST;

    const inserted = firstRow(await client.query(insertSql, [built.row.shop_id, built.row.status]));
    if (inserted) {
      await client.query(SHOP_EVENT_INSERT_SQL, [
        built.row.shop_id, 'milestone', null, null, 'browser build requested'
      ]);
      return { request: inserted, created: true, resumed: false };
    }

    const live = firstRow(await client.query(SELECT_LIVE_BROWSER_REQUEST_SQL, [built.row.shop_id]));
    if (!live) {
      fail('the insert wrote no browser build request and shop ' + String(built.row.shop_id) +
        ' has no live one. Nothing was written.');
    }
    return { request: live, created: false, resumed: true };
  });
}

// claimBrowserBuild - ATOMIC. One statement, so two runners cannot both win.
// The loser is told who holds it rather than being left to guess.
async function claimBrowserBuild(shopId, claimedBy, options) {
  const id = toDbId(shopId, 'claimBrowserBuild: shopId');
  const who = requireText(claimedBy, 'claimBrowserBuild: claimedBy');

  return inTransaction(options, async function (client) {
    const claimed = firstRow(await client.query(CLAIM_BROWSER_REQUEST_SQL, [id, who]));
    if (claimed) {
      await client.query(SHOP_EVENT_INSERT_SQL, [
        id, 'milestone', null, null, 'browser build claimed by ' + who
      ]);
      return { request: claimed, claimed: true, held_by: who };
    }

    const live = firstRow(await client.query(SELECT_LIVE_BROWSER_REQUEST_SQL, [id]));
    return {
      request: live,
      claimed: false,
      held_by: live ? live.claimed_by : null,
      reason: live
        ? 'the live request for this shop is already "' + live.status + '"' +
          (live.claimed_by ? ' and is held by ' + live.claimed_by : '')
        : 'this shop has no queued browser build request'
    };
  });
}

// updateBrowserProgress - progress reporting from the supervised runner.
// Only a request the runner already holds may be progressed, so a stale runner
// cannot resurrect a finished one.
async function updateBrowserProgress(requestId, progress, options) {
  const id = toDbId(requestId, 'updateBrowserProgress: requestId');
  if (progress !== null && progress !== undefined && (typeof progress !== 'object' || Array.isArray(progress))) {
    fail('updateBrowserProgress: progress must be an object (jsonb).');
  }
  const opts = options || {};
  const claimedBy = opts.claimed_by === undefined ? null : opts.claimed_by;

  return inTransaction(options, async function (client) {
    const params = [jsonParam(progress || {}), id];
    let where = 'id = $2';
    if (claimedBy !== null) {
      params.push(requireText(claimedBy, 'updateBrowserProgress: claimed_by'));
      where += ' AND claimed_by = $' + params.length;
    }

    const sql = 'UPDATE asdair.browser_build_request ' +
      "SET progress = $1::jsonb, status = 'running' " +
      'WHERE ' + where + " AND status IN ('claimed','running') RETURNING " + BROWSER_SELECT_LIST;

    const res = await client.query(sql, params);
    if (rowCount(res) !== 1) {
      const current = firstRow(await client.query(SELECT_BROWSER_REQUEST_BY_ID_SQL, [id]));
      fail('browser build request ' + String(id) + ' is not claimed/running' +
        (current ? ' (it is "' + current.status + '")' : ' (no such request)') +
        (claimedBy === null ? '' : ' by ' + String(claimedBy)) + '. Nothing was written.');
    }
    return { request: firstRow(res), changed: true };
  });
}

// finishBrowserBuild - complete | failed | cancelled, always terminal for the
// request. Only a LIVE request can be finished, so a second call is refused
// rather than silently rewriting a recorded outcome.
async function finishBrowserBuild(requestId, outcome, options) {
  const id = toDbId(requestId, 'finishBrowserBuild: requestId');
  const spec = (outcome && typeof outcome === 'object') ? outcome : { status: outcome };
  const status = spec.status;
  if (['complete', 'failed', 'cancelled'].indexOf(status) === -1) {
    fail('finishBrowserBuild: status must be "complete", "failed" or "cancelled", got "' + String(status) + '".');
  }
  if (status === 'failed' && (spec.last_error === undefined || spec.last_error === null || String(spec.last_error).trim() === '')) {
    fail('finishBrowserBuild: a failed browser build must carry last_error - "it failed" with no reason ' +
      'cannot be resumed from.');
  }

  return inTransaction(options, async function (client) {
    const params = [status, spec.last_error === undefined ? null : spec.last_error, id];
    const sql = 'UPDATE asdair.browser_build_request ' +
      'SET status = $1, last_error = $2, finished_at = now() ' +
      "WHERE id = $3 AND status IN ('" + BROWSER_LIVE_STATUSES.join("','") + "') RETURNING " + BROWSER_SELECT_LIST;

    const res = await client.query(sql, params);
    if (rowCount(res) !== 1) {
      const current = firstRow(await client.query(SELECT_BROWSER_REQUEST_BY_ID_SQL, [id]));
      if (current && BROWSER_LIVE_STATUSES.indexOf(current.status) === -1) {
        return { request: current, changed: false, already_finished: true };
      }
      fail('browser build request ' + String(id) + ' could not be finished' +
        (current ? ' (it is "' + current.status + '")' : ' (no such request)') + '. Nothing was written.');
    }

    const request = firstRow(res);
    await client.query(SHOP_EVENT_INSERT_SQL, [
      request.shop_id,
      status === 'failed' ? 'failure' : 'milestone',
      null,
      null,
      'browser build ' + status + (spec.last_error ? ': ' + String(spec.last_error) : '')
    ]);
    return { request: request, changed: true, already_finished: false };
  });
}

// =====================================================================
// 8. pending_action - the things that must never be forgotten
// =====================================================================

// Idempotent on (household_id, action_type, action_key) while pending, per
// migration 006's partial unique index. Re-adding the same outstanding action
// adopts the existing one instead of stacking duplicates in the status view.
async function addPendingAction(intent, options) {
  const built = buildPendingAction(intent);

  return inTransaction(options, async function (client) {
    const params = built.columns.map(function (col) {
      const v = built.row[col];
      if (col === 'payload') return jsonParam(v);
      return v === undefined ? null : v;
    });
    const placeholders = built.columns.map(function (col, i) {
      return '$' + (i + 1) + (col === 'payload' ? '::jsonb' : '');
    });

    const insertSql = 'INSERT INTO asdair.pending_action (' + built.columns.join(', ') + ') VALUES (' +
      placeholders.join(', ') + ') ON CONFLICT DO NOTHING RETURNING ' + PENDING_SELECT_LIST;

    const inserted = firstRow(await client.query(insertSql, params));
    if (inserted) return { action: inserted, created: true, resumed: false };

    const existing = firstRow(await client.query(SELECT_PENDING_ACTION_SQL,
      [built.row.household_id, built.row.action_type, built.row.action_key]));
    if (!existing) {
      fail('the insert wrote no pending action and none is pending for (' + built.row.action_type + ', ' +
        built.row.action_key + '). Nothing was written.');
    }
    return { action: existing, created: false, resumed: true };
  });
}

// resolvePendingAction - 'done' or 'abandoned'. Only a PENDING action can be
// resolved, so the record of how it ended is written exactly once.
async function resolvePendingAction(actionId, resolution, options) {
  const id = toDbId(actionId, 'resolvePendingAction: actionId');
  const spec = (resolution && typeof resolution === 'object') ? resolution : { status: resolution };
  const status = spec.status;
  if (status !== 'done' && status !== 'abandoned') {
    fail('resolvePendingAction: status must be "done" or "abandoned", got "' + String(status) + '".');
  }

  return inTransaction(options, async function (client) {
    const sql = 'UPDATE asdair.pending_action SET status = $1, note = $2, resolved_at = now() ' +
      "WHERE id = $3 AND status = 'pending' RETURNING " + PENDING_SELECT_LIST;
    const res = await client.query(sql, [status, spec.note === undefined ? null : spec.note, id]);
    if (rowCount(res) !== 1) {
      fail('pending action ' + String(id) + ' is not pending (already resolved, or no such row). ' +
        'Nothing was written.');
    }
    return { action: firstRow(res), changed: true };
  });
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  createOrResumeShop: createOrResumeShop,
  transition: transition,
  recordFailure: recordFailure,
  openQuestion: openQuestion,
  answerQuestion: answerQuestion,
  requestBrowserBuild: requestBrowserBuild,
  claimBrowserBuild: claimBrowserBuild,
  updateBrowserProgress: updateBrowserProgress,
  finishBrowserBuild: finishBrowserBuild,
  addPendingAction: addPendingAction,
  resolvePendingAction: resolvePendingAction,
  close: close,

  // Exported for tests: the SQL constants and the transition applier, so all
  // of it can be exercised against a fake client with no database.
  _internal: {
    applyTransition: applyTransition,
    inTransaction: inTransaction,
    jsonParam: jsonParam,
    SHOP_SELECT_COLUMNS: SHOP_SELECT_COLUMNS,
    SHOP_UPDATE_ALLOWED_COLUMNS: SHOP_UPDATE_ALLOWED_COLUMNS,
    SHOP_UPDATE_LITERALS: SHOP_UPDATE_LITERALS,
    SHOP_EVENT_INSERT_SQL: SHOP_EVENT_INSERT_SQL,
    CLAIM_BROWSER_REQUEST_SQL: CLAIM_BROWSER_REQUEST_SQL,
    SELECT_LAST_FAILURE_SQL: SELECT_LAST_FAILURE_SQL,
    SELECT_SHOP_BY_INBOUND_SQL: SELECT_SHOP_BY_INBOUND_SQL,
    SELECT_SHOP_BY_REF_SQL: SELECT_SHOP_BY_REF_SQL
  }
};
