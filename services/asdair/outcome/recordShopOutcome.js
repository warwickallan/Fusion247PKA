// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: recordShopOutcome.js
//
// The thin WRITE half of "record what actually happened". It takes the rows
// buildOutcome.js produced and persists them in ONE transaction:
//
//   recordShopOutcome({ order, events }) -> the new asdair.orders id
//
// WRITE BOUNDARY (why this file is NOT in services/asdair/skill/):
//   services/asdair/skill/ is READ-ONLY BY CONTRACT -- every query in
//   data.js is a SELECT inside `BEGIN TRANSACTION READ ONLY`. That invariant
//   is deliberate and is NOT weakened here: the writer lives in this separate
//   sibling folder, so "the skill never writes" stays literally true and
//   reviewable. This module is the ONLY place the outcome tables are written.
//
// TRANSACTION:
//   BEGIN -> insert the order -> insert each of its events -> COMMIT.
//   Any failure ROLLBACKs, so a run is never half-recorded (an order with a
//   missing timeline, or events orphaned from their order).
//
// HARD GUARANTEES:
//   * `checked_out` is written as the SQL LITERAL false and `checked_out_at`
//     as the SQL LITERAL null. They are not parameters, so NO input value --
//     not even a malformed order object -- can put this agent on record as
//     having checked out (standing rule 8).
//   * Every event_type is re-validated against the CHECK vocabulary BEFORE
//     the first query runs, so a bad value never reaches the database.
//   * Column identifiers come from the shared ORDER_COLUMNS constant (fixed
//     identifiers, never external input), so the INSERT is parameterised for
//     every value and cannot be injected into.
//
// SECRETS:
//   * The connection string comes ONLY from process.env.ASDAIR_WRITE_DB_URL, the
//     same convention as skill/data.js. It is never hardcoded, never printed,
//     never logged.
//   * OPERATIONAL NOTE: skill/README.md provisions ASDAIR_WRITE_DB_URL as a
//     SELECT-only role for the read-only skill. A role with only SELECT
//     cannot run this writer -- recording an outcome needs INSERT (and
//     UPDATE for promoteDecision.js) on the asdair schema. Which role the
//     writer runs as is a deployment decision for the operator; this module
//     hardcodes nothing and simply uses whatever ASDAIR_WRITE_DB_URL provides.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { ORDER_COLUMNS, EVENT_TYPES } = require('./buildOutcome');

// SQL LITERALS for the columns that must NEVER be driven by input. Rule 8:
// the agent produces a checkout-READY basket and never checks out, so these
// two columns are written as constants in the SQL text itself.
const ORDER_LITERALS = {
  checked_out: 'false',
  checked_out_at: 'null'
};

let pool = null;

// Lazily create a single shared pool from the environment. Throws a clear
// error if the connection string is not configured. The URL value is never
// echoed back in the error or anywhere else. `pg` is required lazily so this
// module (and its pure validation) loads on a box with no deps installed.
function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair Postgres connection string as ASDAIR_WRITE_DB_URL before recording an outcome.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

// ---------------------------------------------------------------------
// Defence in depth: re-validate the rows before opening a transaction.
// buildOutcome already enforces all of this, but recordShopOutcome is a
// public entry point and could be handed a hand-built object. Rejecting here
// means a bad value fails BEFORE any connection or query.
// ---------------------------------------------------------------------
function assertRecordable(outcome) {
  if (!outcome || typeof outcome !== 'object') {
    throw new Error('recordShopOutcome: an { order, events } object is required (see buildOutcome).');
  }
  const order = outcome.order;
  if (!order || typeof order !== 'object') {
    throw new Error('recordShopOutcome: outcome.order is required (see buildOutcome).');
  }
  if (order.checked_out === true || (order.checked_out_at !== null && order.checked_out_at !== undefined)) {
    throw new Error('recordShopOutcome: refusing to record a checked-out order -- the agent never checks out (standing rule 8).');
  }
  ['list_id', 'household_id'].forEach(function (col) {
    const v = order[col];
    if (v === null || v === undefined || v === '') {
      throw new Error('recordShopOutcome: order.' + col + ' is required (NOT NULL in asdair.orders).');
    }
  });
  const events = outcome.events;
  if (events !== null && events !== undefined && !Array.isArray(events)) {
    throw new Error('recordShopOutcome: outcome.events must be an array when given.');
  }
  (Array.isArray(events) ? events : []).forEach(function (ev, idx) {
    if (!ev || typeof ev !== 'object') {
      throw new Error('recordShopOutcome: outcome.events[' + idx + '] must be an object.');
    }
    if (EVENT_TYPES.indexOf(ev.event_type) === -1) {
      throw new Error('recordShopOutcome: outcome.events[' + idx + '].event_type "' + String(ev.event_type) +
        '" is not one of: ' + EVENT_TYPES.join(', ') + ' (asdair.order_events CHECK).');
    }
    if (ev.description === null || ev.description === undefined || String(ev.description).trim() === '') {
      throw new Error('recordShopOutcome: outcome.events[' + idx + '].description is required (NOT NULL).');
    }
  });
}

// Build the parameterised INSERT for asdair.orders from the shared column
// list. Columns in ORDER_LITERALS are emitted as SQL constants (never
// parameters); everything else becomes a bound parameter, in column order.
function buildOrderInsert(order) {
  const params = [];
  const placeholders = ORDER_COLUMNS.map(function (col) {
    if (Object.prototype.hasOwnProperty.call(ORDER_LITERALS, col)) return ORDER_LITERALS[col];
    const v = order[col];
    params.push(v === undefined ? null : v);
    return '$' + params.length;
  });
  const sql = 'INSERT INTO asdair.orders (' + ORDER_COLUMNS.join(', ') + ') VALUES (' +
    placeholders.join(', ') + ') RETURNING id';
  return { sql: sql, params: params };
}

// occurred_at is NOT NULL with a now() default. A null from the pure builder
// means "the run did not say when", so COALESCE lets the DATABASE supply the
// time -- buildOutcome stays clock-free and the column stays non-null.
const EVENT_INSERT_SQL =
  'INSERT INTO asdair.order_events (order_id, event_type, description, occurred_at) ' +
  'VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))';

// ---------------------------------------------------------------------
// Main entry point.
//
// options.client (optional): an already-connected pg client to run on. This
// exists so tests and callers that are composing several writes into one
// caller-owned connection can do so; it hardcodes no connection string and
// changes nothing about the SQL. When omitted, a client is taken from the
// shared pool built from ASDAIR_WRITE_DB_URL and released afterwards.
// ---------------------------------------------------------------------
async function recordShopOutcome(outcome, options) {
  assertRecordable(outcome);

  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();

  try {
    await client.query('BEGIN');

    const insert = buildOrderInsert(outcome.order);
    const res = await client.query(insert.sql, insert.params);
    const orderId = res.rows[0].id;

    const events = Array.isArray(outcome.events) ? outcome.events : [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      await client.query(EVENT_INSERT_SQL, [
        orderId,
        ev.event_type,
        String(ev.description),
        ev.occurred_at === undefined ? null : ev.occurred_at
      ]);
    }

    await client.query('COMMIT');
    return orderId;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

// Close the shared pool (call once when a run finishes).
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  recordShopOutcome: recordShopOutcome,
  close: close,
  // Exported for tests: the pure pre-flight validation and the SQL builder,
  // so both can be exercised with no database.
  _internal: {
    assertRecordable: assertRecordable,
    buildOrderInsert: buildOrderInsert,
    EVENT_INSERT_SQL: EVENT_INSERT_SQL,
    ORDER_LITERALS: ORDER_LITERALS
  }
};
