// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/readWorkspace.js
//
// THE READ SIDE. SELECT ONLY, BY CONSTRUCTION.
//
//   * Connection from ASDAIR_DB_URL - the SELECT-only asdair_ro role, never
//     the write URL. Same rule shopStatus.js and skill/data.js follow.
//   * Everything runs inside ONE `BEGIN TRANSACTION READ ONLY`, so the status,
//     the lines, the questions, the confirmation and the catalogue are all read
//     from a SINGLE consistent snapshot. A cockpit that showed a stage from one
//     instant and a line count from another would be lying quietly.
//   * Every statement in this file begins with SELECT. readWorkspace.test.js
//     asserts that over the exported SQL constants, so a future edit that adds
//     an UPDATE fails the suite rather than the household.
//
// THE STATUS PROJECTION IS NOT REIMPLEMENTED HERE. getShopStatus() is called
// with the SAME client, inside the same transaction (its documented `client`
// option), so the stage, the money-with-basis, the browser request and the
// pending actions all come from shopStatus.js and stay identical to what
// Telegram says.
//
// FORWARD COMPATIBILITY, HONESTLY DONE. The catalogue-grounded interpretation
// (matched_regular_id, interpretation_status, match_basis, confidence) is being
// persisted by services/asdair/pipeline/. Until those columns exist, this
// module reads what IS there and reports the rest as unknown - it never
// re-derives a match. The column probe below is what makes both worlds work
// without a fork.
//
// PURE ASCII.
// =====================================================================

'use strict';

const { getShopStatus, SHOP_STATUSES } = require('../shop/shopStatus');
const { assembleWorkspace } = require('./assembleWorkspace');

// ---------------------------------------------------------------------
// SQL. All SELECT. All parameterised.
// ---------------------------------------------------------------------
const CURRENT_SHOP_SQL =
  'SELECT id, shop_ref, status, updated_at FROM asdair.shop ' +
  'WHERE ($1::bigint IS NULL OR household_id = $1) ' +
  'ORDER BY (status IN (\'RECONCILED\',\'CANCELLED\')) ASC, updated_at DESC, id DESC LIMIT 1';

const SHOP_LIST_SQL =
  'SELECT id, shop_ref, status, source_kind, created_at, updated_at FROM asdair.shop ' +
  'WHERE ($1::bigint IS NULL OR household_id = $1) ORDER BY id DESC LIMIT 25';

const SHOP_ROW_SQL =
  'SELECT id, household_id, shop_ref, status, source_kind, raw_text, raw_media_path, ' +
  'transcript, transcript_provider, transcript_model, transcript_confidence, needs_review, ' +
  'list_id, last_error, created_at, updated_at FROM asdair.shop WHERE id = $1';

const EVENTS_SQL =
  'SELECT event_type, from_status, to_status, description, occurred_at ' +
  'FROM asdair.shop_event WHERE shop_id = $1 ORDER BY id ASC LIMIT 500';

// WP-B15-35 AC4. The durable interpretation of the PHOTOGRAPH, and the source
// image that produced it. SELECT-only, like everything in this reader.
//
// Without these two the provenance breakdown cannot say what came from the
// photograph, and it reports UNKNOWN rather than zero - so a reader that
// skipped them degrades honestly instead of claiming the photo yielded
// nothing. Live: shop 26 has 39 shop_line rows, all 39 bound to list items.
const SHOP_LINES_SQL =
  'SELECT id, shop_id, line_no, raw_reading, matched_regular_id, match_basis, match_confidence, ' +
  'status, confirmed_by, corrected, list_item_id ' +
  'FROM asdair.shop_line WHERE shop_id = $1 ORDER BY line_no ASC';

const SOURCE_IMAGES_SQL =
  'SELECT shop_id, fingerprint, algo, byte_length, captured_at ' +
  'FROM asdair.shop_source_image WHERE shop_id = $1 ORDER BY captured_at ASC';

const QUESTIONS_SQL =
  'SELECT id, list_item_id, question_key, question_text, candidates, status, answer_text, ' +
  'answer_source, asked_at, answered_at FROM asdair.shop_question WHERE shop_id = $1 ORDER BY id ASC';

// The durable, per-question DECISION (migration 017). What an answer MEANT for
// this shop - never re-derived here, only read. May not exist yet on every
// database (017 is a recent migration): read via readDecisions() below, which
// treats "relation does not exist" as "none recorded", exactly like
// probeItemColumns() already does for optional columns. A MISSING row (or a
// missing TABLE) means "decided before this existed" or "not yet decided" -
// it never means no decision was made; assembleWorkspace.js's buildQuestions
// degrades to the raw answer_text when no decision row is present.
const DECISIONS_SQL =
  'SELECT id, question_id, decision_kind, decided_regular_id, decided_quantity, decided_item_name, ' +
  'clarification_reason, forward_intent, interpreted_by, interpreted_at ' +
  'FROM asdair.shop_decision WHERE shop_id = $1 ORDER BY id ASC';

const ALTERNATIVES_SQL =
  'SELECT id, list_item_id, alternative_name, price, chosen FROM asdair.product_alternatives ' +
  'WHERE list_item_id = ANY($1::bigint[]) ORDER BY id ASC';

const CATALOGUE_SQL =
  'SELECT id, name, brand, category, high_level_category, asda_product_id, asda_url, typical_qty, ' +
  'aka, substitutes_allowed, active, created_at, updated_at FROM asdair.regulars ' +
  'WHERE household_id = $1 ORDER BY id ASC';

const CONFIRMATION_SQL =
  'SELECT id, order_id, source_kind, raw_text, raw_media_path, parsed, parse_provider, ' +
  'stated_total, received_at, reconciled_at FROM asdair.order_confirmation ' +
  'WHERE shop_id = $1 ORDER BY id DESC LIMIT 1';

const CONFIRMATION_LINES_SQL =
  'SELECT id, line_no, product_name, quantity, pack_size, promotion, line_price, price_basis, ' +
  'matched_regular_id, outcome, note FROM asdair.order_confirmation_line ' +
  'WHERE confirmation_id = $1 ORDER BY line_no ASC, id ASC';

const PREVIOUS_ORDER_SQL =
  'SELECT id, list_id, run_at, total_requested, total_added, total_needs_decision, basket_total, ' +
  'outside_budget_range, checked_out, checked_out_at, created_at FROM asdair.orders ' +
  'WHERE household_id = $1 AND ($2::bigint IS NULL OR list_id IS DISTINCT FROM $2) ' +
  'ORDER BY coalesce(run_at, created_at) DESC, id DESC LIMIT 1';

const PREVIOUS_ORDER_ITEMS_SQL =
  'SELECT id, item_name, requested_qty, added_qty, status, note FROM asdair.shopping_list_items ' +
  'WHERE list_id = $1 ORDER BY id ASC';

const ROTATION_RULES_SQL =
  'SELECT id, category, rule_text, directive, match_term, match_category, matched_product, reason, note, active ' +
  'FROM asdair.rules WHERE directive = \'rotate\' AND (household_id IS NULL OR household_id = $1) ' +
  'ORDER BY id ASC';

const COLUMN_PROBE_SQL =
  'SELECT column_name FROM information_schema.columns ' +
  'WHERE table_schema = \'asdair\' AND table_name = $1';

// Every statement this module can issue, so the SELECT-only property is
// testable rather than merely asserted in a comment.
const ALL_SQL = Object.freeze([
  CURRENT_SHOP_SQL, SHOP_LIST_SQL, SHOP_ROW_SQL, EVENTS_SQL, QUESTIONS_SQL, DECISIONS_SQL, ALTERNATIVES_SQL,
  CATALOGUE_SQL, CONFIRMATION_SQL, CONFIRMATION_LINES_SQL, PREVIOUS_ORDER_SQL,
  PREVIOUS_ORDER_ITEMS_SQL, ROTATION_RULES_SQL, COLUMN_PROBE_SQL
]);

// asdair.shopping_list_items columns that always exist (migration 001).
const ITEM_BASE_COLUMNS = Object.freeze([
  'id', 'item_name', 'matched_product_id', 'requested_qty', 'added_qty', 'status', 'price', 'note', 'one_week_only'
]);

// Columns the interpretation writer may add. Read when present, reported as
// unknown when not. Whitelisted here, then intersected with what the database
// itself reports, so nothing outside this list can ever reach a statement.
const ITEM_OPTIONAL_COLUMNS = Object.freeze([
  'line_no', 'raw_reading', 'matched_regular_id', 'interpretation_status',
  'match_basis', 'match_confidence', 'applied_rule_id', 'applied_rule'
]);

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

let pool = null;

// shopStatus.js keeps its own pool for its own callers; this is a second
// handle on the SAME read-only URL, not a second implementation of anything.
function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string as ASDAIR_DB_URL ' +
      'before reading the cockpit workspace.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

// ---------------------------------------------------------------------------
// DEPENDENCY CHECK - what makes /asdair/health honest.
//
// THE INCIDENT THIS EXISTS FOR (2026-08-03): GET /asdair/health returned
// `ok: true` WHILE GET /asdair/workspace was returning 500 on a missing `pg`
// module. Health was a literal - it reported on nothing and could not fail.
// A green that cannot go red is worse than no indicator, because it is trusted.
//
// WHY IT LIVES HERE, NEXT TO getPool(), AND NOT IN ITS OWN MODULE. The check
// must exercise the EXACT path that broke: this lazy `require('pg')`, this
// env var, this pool. A health check that opens its own connection its own way
// is testing something adjacent to the thing that failed, and would have
// reported green through the entire incident. Same code path, or it is theatre.
//
// PURE ASCII. Never returns a connection string: the message is scrubbed, and
// the reason codes below are fixed strings chosen so the cockpit can say what
// is wrong in words without ever echoing configuration back to a browser.
function scrubbed(err) {
  var msg = (err && err.message) ? String(err.message) : 'unexpected error';
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, '[redacted-connection-string]');
}

function classifyDependencyError(err) {
  var code = (err && (err.code || (err.cause && err.cause.code))) || '';
  var msg = (err && err.message) ? String(err.message) : '';
  // The 2026-08-03 failure exactly: the driver itself is not installed.
  if (code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(msg)) return 'driver_not_installed';
  if (/ASDAIR_DB_URL is not set/.test(msg)) return 'not_configured';
  if (code === 'ECONNREFUSED') return 'database_not_listening';
  if (code === 'ENOTFOUND') return 'database_host_unresolved';
  if (code === 'ETIMEDOUT' || code === 'ASDAIR_HEALTH_TIMEOUT') return 'database_timeout';
  if (code === '28P01' || code === '28000') return 'database_auth_rejected';
  if (code === '3D000') return 'database_missing';
  return 'database_unreachable';
}

var DEPENDENCY_REASONS = Object.freeze({
  driver_not_installed: 'the PostgreSQL driver is not installed for this service',
  not_configured: 'ASDAIR_DB_URL is not set, so the reader has no database to read',
  database_not_listening: 'nothing is listening on the configured database address',
  database_host_unresolved: 'the configured database host does not resolve',
  database_timeout: 'the database did not answer in time',
  database_auth_rejected: 'the database rejected this service credentials',
  database_missing: 'the configured database does not exist',
  database_unreachable: 'the database could not be reached'
});

/**
 * Can this service actually do its job right now?
 *
 * connect + SELECT 1 + release, against the same pool readWorkspace uses. Kept
 * deliberately trivial: /asdair/health is polled by the cockpit, so the check
 * must be cheap enough to run on every poll. It is a liveness probe, not a
 * self-test - it answers "could I serve a workspace read", nothing more.
 *
 * NEVER THROWS. A health check that throws cannot report ill health.
 *
 * @param {{timeoutMs?: number, pool?: object}} [options]
 */
async function checkDependencies(options) {
  var opts = options || {};
  var timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 2000;
  var started = Date.now();
  var timer = null;
  try {
    // getPool() is where the lazy require('pg') and the env-var check live -
    // both failure modes surface here rather than later.
    var p = opts.pool || getPool();
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        var e = new Error('dependency check exceeded ' + timeoutMs + 'ms');
        e.code = 'ASDAIR_HEALTH_TIMEOUT';
        reject(e);
      }, timeoutMs);
      // Do not hold the process open just for the health timer.
      if (timer.unref) timer.unref();
    });
    var probe = (async function () {
      var client = await p.connect();
      try { await client.query('select 1'); } finally { client.release(); }
    }());
    await Promise.race([probe, timeout]);
    // A rejection AFTER the race is lost would otherwise be an unhandled
    // rejection that takes the service down - the opposite of a health check.
    probe.catch(function () {});
    return { ok: true, dependency: 'database', checked: true, latency_ms: Date.now() - started };
  } catch (err) {
    var reason = classifyDependencyError(err);
    return {
      ok: false,
      dependency: 'database',
      checked: true,
      latency_ms: Date.now() - started,
      reason: reason,
      detail: DEPENDENCY_REASONS[reason] || DEPENDENCY_REASONS.database_unreachable,
      message: scrubbed(err)
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function rows(res) {
  return (res && res.rows) || [];
}

function first(res) {
  const r = rows(res);
  return r.length ? r[0] : null;
}

/**
 * PURE. Build the shopping_list_items SELECT from the columns that actually
 * exist. Every name is checked against the whitelist AND against a strict
 * identifier pattern before it is concatenated, so this cannot become an
 * injection point even if information_schema returned something exotic.
 */
function buildItemSelect(presentColumns) {
  const have = new Set((presentColumns || []).map(function (c) { return String(c); }));
  const cols = ITEM_BASE_COLUMNS.filter(function (c) { return have.size === 0 || have.has(c); });
  const extra = ITEM_OPTIONAL_COLUMNS.filter(function (c) { return have.has(c); });
  const all = (cols.length ? cols : ITEM_BASE_COLUMNS.slice()).concat(extra);
  all.forEach(function (c) {
    if (!IDENTIFIER.test(c)) throw new Error('readWorkspace: refusing unsafe column name "' + c + '".');
  });
  return 'SELECT ' + all.join(', ') + ' FROM asdair.shopping_list_items WHERE list_id = $1 ORDER BY ' +
    (extra.indexOf('line_no') === -1 ? 'id ASC' : 'line_no ASC, id ASC');
}

async function probeItemColumns(client) {
  try {
    const res = await client.query(COLUMN_PROBE_SQL, ['shopping_list_items']);
    return rows(res).map(function (r) { return r.column_name; });
  } catch (ignore) {
    // A database that will not answer the probe still gets the base columns.
    return [];
  }
}

// asdair.shop_decision (migration 017) may not exist on every database yet.
// Same shape as probeItemColumns above: a database that cannot answer this
// query (relation does not exist, or any other error) yields "no durable
// decisions known" rather than a 500 - the workspace still reads, it just
// cannot show the machine-interpreted resolution and falls back to the raw
// answer_text (assembleWorkspace.js's buildQuestions does that fallback).
/**
 * WP-B15-35 AC4. Read a table that may not exist on every database yet.
 *
 * Returns [] on "relation does not exist", exactly as readDecisions already
 * does for migration 017 - a workspace must not 500 because one optional
 * table has not landed. It returns an ARRAY either way, which is what makes
 * the provenance breakdown report a real zero rather than an unknown; the
 * unknown case is a caller that never asked at all.
 */
async function readOptional(client, sql, shopId) {
  // ⚠️ THE SAVEPOINT IS LOAD-BEARING, NOT DEFENSIVE DECORATION.
  //
  // In Postgres, ONE failed statement aborts the whole transaction: every
  // later statement returns "current transaction is aborted" until a rollback.
  // So a bare try/catch here does NOT make a read optional - it swallows the
  // error and then the ENTIRE workspace fails on the next query, with a
  // message pointing nowhere near the cause.
  //
  // Found by execution on 2026-08-13: a wrong column list on shop_source_image
  // took the whole /asdair/workspace route to `read_failed` even though the
  // read was wrapped in try/catch. The catch was there; it did nothing useful.
  //
  // Rolling back to a savepoint discards only the failed statement and leaves
  // the surrounding read-only snapshot intact, which is what "optional" has
  // to mean for it to be worth anything.
  await client.query('SAVEPOINT optional_read');
  try {
    const res = rows(await client.query(sql, [shopId]));
    await client.query('RELEASE SAVEPOINT optional_read');
    return res;
  } catch (ignore) {
    await client.query('ROLLBACK TO SAVEPOINT optional_read');
    return [];
  }
}

async function readDecisions(client, shopId) {
  try {
    const res = await client.query(DECISIONS_SQL, [shopId]);
    return rows(res);
  } catch (ignore) {
    return [];
  }
}

/**
 * Read everything the workspace needs, inside ONE read-only snapshot.
 *
 * @param {object} [options] { shop, household_id, client }
 *        shop  : an asdair.shop.id or a shop_ref. Omitted = the current shop
 *                (the most recent one that is not finished).
 */
async function readWorkspace(options) {
  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();

  try {
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    const payload = await gather(client, opts);
    if (!injected) await client.query('COMMIT');
    return payload;
  } catch (err) {
    if (!injected) {
      try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

async function gather(client, opts) {
  const householdId = opts.household_id === undefined || opts.household_id === null
    ? null : Number(opts.household_id);

  // 1. Which shop.
  let handle = opts.shop === undefined || opts.shop === null || opts.shop === '' ? null : opts.shop;
  if (handle === null) {
    const current = first(await client.query(CURRENT_SHOP_SQL, [householdId]));
    if (!current) {
      return {
        ok: false,
        reason: 'no_shop',
        message: 'No shop has been received yet.',
        shops: []
      };
    }
    handle = current.id;
  }

  // 2. The projection - shopStatus.js, same transaction, same snapshot.
  const status = await getShopStatus(handle, { client: client, household_id: householdId });

  // 3. The raw evidence row (the photo path, the pasted text, the transcript).
  const shop = first(await client.query(SHOP_ROW_SQL, [status.shop_id]));

  const events = rows(await client.query(EVENTS_SQL, [status.shop_id]));
  const questions = rows(await client.query(QUESTIONS_SQL, [status.shop_id]));

  // AC4. Both are optional in the sense that a database without them must not
  // 500 the workspace - readOptional treats "relation does not exist" as
  // "none recorded", exactly as readDecisions already does for migration 017.
  const shopLines = await readOptional(client, SHOP_LINES_SQL, status.shop_id);
  const sourceImages = await readOptional(client, SOURCE_IMAGES_SQL, status.shop_id);
  const decisions = await readDecisions(client, status.shop_id);

  // 4. The list, if one exists yet.
  let listItems = [];
  let alternatives = [];
  if (status.list_id !== null && status.list_id !== undefined) {
    const present = await probeItemColumns(client);
    listItems = rows(await client.query(buildItemSelect(present), [status.list_id]));
    const ids = listItems.map(function (i) { return i.id; }).filter(function (i) { return i !== null && i !== undefined; });
    if (ids.length) alternatives = rows(await client.query(ALTERNATIVES_SQL, [ids]));
  }

  // 5. The catalogue - the thing that DETERMINES identity.
  const catalogue = rows(await client.query(CATALOGUE_SQL, [status.household_id]));

  // 6. The confirmation and its lines.
  const confirmation = first(await client.query(CONFIRMATION_SQL, [status.shop_id]));
  const confirmationLines = confirmation
    ? rows(await client.query(CONFIRMATION_LINES_SQL, [confirmation.id]))
    : [];

  // 7. Prior-order context and the rotate directive.
  const previousOrder = first(await client.query(PREVIOUS_ORDER_SQL, [status.household_id, status.list_id === undefined ? null : status.list_id]));
  const previousOrderItems = previousOrder && previousOrder.list_id
    ? rows(await client.query(PREVIOUS_ORDER_ITEMS_SQL, [previousOrder.list_id]))
    : [];
  const rotationRules = rows(await client.query(ROTATION_RULES_SQL, [status.household_id]));

  // 8. The switcher.
  const shops = rows(await client.query(SHOP_LIST_SQL, [householdId === null ? status.household_id : householdId]));

  const payload = assembleWorkspace({
    status: status,
    shop: shop,
    events: events,
    list_items: listItems,
    alternatives: alternatives,
    questions: questions,
    decisions: decisions,
    shop_lines: shopLines,
    source_images: sourceImages,
    catalogue: catalogue,
    confirmation: confirmation,
    confirmation_lines: confirmationLines,
    previous_order: previousOrder,
    previous_order_items: previousOrderItems,
    rotation_rules: rotationRules,
    all_stages: SHOP_STATUSES
  });

  payload.shops = shops.map(function (s) {
    return { id: s.id, shop_ref: s.shop_ref, status: s.status, source_kind: s.source_kind, updated_at: s.updated_at };
  });
  return payload;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  readWorkspace: readWorkspace,
  checkDependencies: checkDependencies,
  DEPENDENCY_REASONS: DEPENDENCY_REASONS,
  close: close,
  ALL_SQL: ALL_SQL,
  ITEM_BASE_COLUMNS: ITEM_BASE_COLUMNS,
  ITEM_OPTIONAL_COLUMNS: ITEM_OPTIONAL_COLUMNS,
  _internal: {
    // Exported so readPacket.js shares the SAME lazy pool, the same lazy
    // require('pg') and the same env var. A sibling reader that opened its own
    // connection its own way would be a second configuration path to keep in
    // sync, and the health check would no longer speak for both.
    getPool: getPool,
    gather: gather,
    buildItemSelect: buildItemSelect,
    probeItemColumns: probeItemColumns,
    readDecisions: readDecisions,
    CURRENT_SHOP_SQL: CURRENT_SHOP_SQL,
    SHOP_ROW_SQL: SHOP_ROW_SQL,
    EVENTS_SQL: EVENTS_SQL,
    QUESTIONS_SQL: QUESTIONS_SQL,
    DECISIONS_SQL: DECISIONS_SQL,
    CATALOGUE_SQL: CATALOGUE_SQL,
    CONFIRMATION_SQL: CONFIRMATION_SQL,
    CONFIRMATION_LINES_SQL: CONFIRMATION_LINES_SQL,
    PREVIOUS_ORDER_SQL: PREVIOUS_ORDER_SQL,
    ROTATION_RULES_SQL: ROTATION_RULES_SQL
  }
};
