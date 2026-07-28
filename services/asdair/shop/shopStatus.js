// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopStatus.js
//
// The PROJECTION READER behind the directive's "View status". It answers, from
// DURABLE STATE ONLY, the question "where is my shop up to?".
//
// READ-ONLY BY CONSTRUCTION:
//   * Connection from process.env.ASDAIR_DB_URL (the SELECT-only asdair_ro
//     role), never the write URL.
//   * Every query runs inside `BEGIN TRANSACTION READ ONLY`, the same
//     belt-and-braces guard skill/data.js uses - so even a future editing
//     mistake cannot write from here.
//   * One transaction for the whole projection, so the counts, the questions
//     and the failure state are all read from a single consistent snapshot
//     rather than drifting between statements.
//
// THE RULE THAT MATTERS MOST: NEVER FABRICATE.
//   Where a fact is genuinely unknown this returns null and the caller says
//   "unknown". Specifically:
//     * A shop with no list_id yet has null line counts - not zero. Zero would
//       read as "your list is empty", which is a lie.
//     * The basket product count and the estimated total are null until
//       something durable reports them. They are read from the supervised
//       runner's own progress record or from a received ASDA confirmation -
//       never inferred from the fact that a build was requested.
//     * `stage` is asdair.shop.status and nothing else. The mere EXISTENCE of
//       a browser_build_request is NOT evidence that shopping is happening;
//       the request is reported separately, as a request.
//     * Money always carries its basis. `stated` means ASDA showed that
//       figure; `derived` means it was inferred. A derived figure must never
//       be presented as an ASDA-quoted value (migration 006's price_basis rule
//       exists for exactly this reason), so the basis travels with the number
//       and the caller has no way to lose it.
//
// PURE ASCII only. Currency is "GBP", never a symbol.
// =====================================================================

'use strict';

const { SHOP_STATUSES, isShopRef, _internal: stateInternal } = require('./shopState');

const toDbId = stateInternal.toDbId;

// A human sentence per stage, so every surface (Telegram, cockpit, CLI) says
// the same thing about the same state instead of inventing its own wording.
const STAGE_LABELS = {
  RECEIVED: 'received - not started yet',
  TRANSCRIBING: 'reading the photo of your list',
  PROCESSING: 'working through the list',
  NEEDS_DECISION: 'waiting on your answers',
  READY_TO_SHOP: 'planned and ready to build the basket',
  WAITING_FOR_BROWSER: 'waiting for the browser runner to pick this up',
  SHOPPING: 'building the basket',
  BASKET_READY: 'basket ready for you to check',
  ORDER_CONFIRMATION_RECEIVED: 'order confirmation received, reconciling',
  RECONCILED: 'reconciled - this shop is finished',
  FAILED: 'stopped by a failure',
  CANCELLED: 'cancelled'
};

// asdair.shopping_list_items.status vocabulary. A line is RESOLVED when the
// run has reached a conclusion about it; 'requested' and 'needs_decision' mean
// it is still open.
const RESOLVED_ITEM_STATUSES = ['added', 'not_added', 'excluded_this_week'];
const OPEN_ITEM_STATUSES = ['requested', 'needs_decision'];

const SHOP_BY_ID_SQL =
  'SELECT id, household_id, shop_ref, status, source_kind, list_id, needs_review, ' +
  'transcript_confidence, last_error, created_at, updated_at ' +
  'FROM asdair.shop WHERE id = $1';

const SHOP_BY_REF_SQL =
  'SELECT id, household_id, shop_ref, status, source_kind, list_id, needs_review, ' +
  'transcript_confidence, last_error, created_at, updated_at ' +
  'FROM asdair.shop WHERE shop_ref = $1 ORDER BY id ASC';

const ITEM_COUNTS_SQL =
  'SELECT status, count(*)::int AS n FROM asdair.shopping_list_items WHERE list_id = $1 GROUP BY status';

const QUESTION_COUNTS_SQL =
  'SELECT status, count(*)::int AS n FROM asdair.shop_question WHERE shop_id = $1 GROUP BY status';

const OPEN_QUESTIONS_SQL =
  "SELECT id, question_key, question_text, candidates FROM asdair.shop_question " +
  "WHERE shop_id = $1 AND status = 'open' ORDER BY id ASC";

const LIVE_BROWSER_REQUEST_SQL =
  'SELECT id, status, claimed_by, progress, last_error, requested_at, claimed_at, finished_at ' +
  'FROM asdair.browser_build_request WHERE shop_id = $1 ORDER BY id DESC LIMIT 1';

const PENDING_ACTIONS_SQL =
  'SELECT id, action_type, action_key, payload, note, created_at FROM asdair.pending_action ' +
  "WHERE status = 'pending' AND (household_id = $1 OR shop_id = $2) ORDER BY id ASC";

const LAST_FAILURE_SQL =
  "SELECT from_status, description, occurred_at FROM asdair.shop_event " +
  "WHERE shop_id = $1 AND event_type = 'failure' ORDER BY id DESC LIMIT 1";

const FAILURE_COUNT_SQL =
  "SELECT count(*)::int AS n FROM asdair.shop_event WHERE shop_id = $1 AND event_type = 'failure'";

const LAST_EVENT_SQL =
  'SELECT event_type, from_status, to_status, description, occurred_at FROM asdair.shop_event ' +
  'WHERE shop_id = $1 ORDER BY id DESC LIMIT 1';

const CONFIRMATION_SQL =
  'SELECT id, stated_total, received_at, reconciled_at FROM asdair.order_confirmation ' +
  'WHERE shop_id = $1 ORDER BY id DESC LIMIT 1';

const CONFIRMATION_LINE_COUNTS_SQL =
  'SELECT count(*)::int AS lines, ' +
  "count(*) FILTER (WHERE price_basis = 'stated')::int AS stated_lines, " +
  "sum(line_price) FILTER (WHERE price_basis = 'stated') AS stated_sum " +
  'FROM asdair.order_confirmation_line WHERE confirmation_id = $1';

// Substitution policy is a household-wide DOCTRINE plus a per-item permission:
// the agent never auto-substitutes (asdair.product_alternatives exists so a
// human chooses), and asdair.regulars.substitutes_allowed records which items
// may even have a substitute CONSIDERED.
const SUBSTITUTION_SQL =
  'SELECT count(*)::int AS total, ' +
  'count(*) FILTER (WHERE substitutes_allowed)::int AS allowing ' +
  'FROM asdair.regulars WHERE household_id = $1 AND active';

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string as ASDAIR_DB_URL ' +
      'before reading shop status.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

function fail(message) {
  throw new Error('shopStatus: ' + message);
}

function firstRow(res) {
  const rows = (res && res.rows) || [];
  return rows.length ? rows[0] : null;
}

function allRows(res) {
  return (res && res.rows) || [];
}

// A numeric column arrives from pg as a string (numeric is not safely a JS
// number). Convert only when it is genuinely numeric; anything else stays
// null rather than becoming NaN dressed up as a figure.
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function countsToObject(rows) {
  const out = {};
  rows.forEach(function (r) { out[r.status] = Number(r.n) || 0; });
  return out;
}

function sumOf(counts, statuses) {
  return statuses.reduce(function (acc, s) { return acc + (counts[s] || 0); }, 0);
}

// A money figure ALWAYS travels with how it is known. There is no shape in
// this module that carries an amount without its basis.
function money(amount, basis, source) {
  const value = toNumberOrNull(amount);
  if (value === null) return null;
  return { amount: value, currency: 'GBP', basis: basis, source: source };
}

// Read a fact the supervised runner reported into
// browser_build_request.progress. It is DURABLE state written by the runner,
// not an inference - and when the runner never reported it, the answer is
// null, not a guess.
function fromProgress(progress, keys) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null;
  for (let i = 0; i < keys.length; i++) {
    const v = progress[keys[i]];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function progressCount(progress, keys) {
  const v = fromProgress(progress, keys);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

// ---------------------------------------------------------------------
// Resolve the caller's handle to exactly one shop row.
// A shop_ref is unique PER HOUSEHOLD, so a bare ref with more than one match
// is AMBIGUOUS and is refused by name rather than silently answered about the
// wrong household.
// ---------------------------------------------------------------------
async function resolveShop(client, handle, householdId) {
  if (handle === null || handle === undefined || handle === '') {
    fail('a shop id or shop_ref is required.');
  }

  const looksLikeRef = typeof handle === 'string' && !/^[0-9]+$/.test(handle.trim());
  if (!looksLikeRef) {
    const id = toDbId(handle, 'shop id');
    const row = firstRow(await client.query(SHOP_BY_ID_SQL, [id]));
    if (!row) fail('no shop with id ' + String(id) + '.');
    return row;
  }

  const ref = handle.trim();
  if (!isShopRef(ref)) {
    fail('"' + ref + '" is neither a shop id nor a shop_ref of the form SHOP-YYYY-MM-DD.');
  }
  const rows = allRows(await client.query(SHOP_BY_REF_SQL, [ref]));
  if (rows.length === 0) fail('no shop with shop_ref ' + ref + '.');

  if (householdId !== null && householdId !== undefined) {
    const wanted = String(toDbId(householdId, 'household_id'));
    const match = rows.filter(function (r) { return String(r.household_id) === wanted; });
    if (match.length === 0) fail('no shop ' + ref + ' for household ' + wanted + '.');
    return match[0];
  }
  if (rows.length > 1) {
    fail('shop_ref ' + ref + ' exists for more than one household - pass household_id to disambiguate.');
  }
  return rows[0];
}

// ---------------------------------------------------------------------
// getShopStatus(handle, options) -> the projection.
//
// handle  : an asdair.shop.id (number or numeric string) OR a shop_ref
//           ("SHOP-2026-07-27").
// options : { household_id?, client? }. An injected client is used as-is
//           (already inside the caller's read transaction); otherwise one is
//           taken from the read pool and a READ ONLY transaction is opened.
// ---------------------------------------------------------------------
async function getShopStatus(handle, options) {
  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();

  try {
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    const projection = await project(client, handle, opts);
    if (!injected) await client.query('COMMIT');
    return projection;
  } catch (err) {
    if (!injected) {
      try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

async function project(client, handle, opts) {
  const shop = await resolveShop(client, handle, opts.household_id);

  // ---- the list ------------------------------------------------------
  // Null, not zero, until a list actually exists. "0 of 0 lines resolved"
  // would read as an empty list rather than as "not built yet".
  let lines = null;
  if (shop.list_id !== null && shop.list_id !== undefined) {
    const counts = countsToObject(allRows(await client.query(ITEM_COUNTS_SQL, [shop.list_id])));
    lines = {
      total: sumOf(counts, Object.keys(counts)),
      resolved: sumOf(counts, RESOLVED_ITEM_STATUSES),
      open: sumOf(counts, OPEN_ITEM_STATUSES),
      added: counts.added || 0,
      not_added: counts.not_added || 0,
      excluded_this_week: counts.excluded_this_week || 0,
      needs_decision: counts.needs_decision || 0,
      by_status: counts
    };
  }

  // ---- the question loop --------------------------------------------
  const qCounts = countsToObject(allRows(await client.query(QUESTION_COUNTS_SQL, [shop.id])));
  const openQuestions = allRows(await client.query(OPEN_QUESTIONS_SQL, [shop.id]));
  const questions = {
    total: sumOf(qCounts, Object.keys(qCounts)),
    open: qCounts.open || 0,
    answered: qCounts.answered || 0,
    skipped: qCounts.skipped || 0,
    held: openQuestions.map(function (q) {
      return {
        id: q.id,
        question_key: q.question_key,
        question_text: q.question_text,
        candidates: Array.isArray(q.candidates) ? q.candidates : []
      };
    })
  };

  // ---- the browser runner -------------------------------------------
  // Reported as a REQUEST, never as proof that shopping is under way. The
  // stage above is the only thing that says where the shop is.
  const bbr = firstRow(await client.query(LIVE_BROWSER_REQUEST_SQL, [shop.id]));
  const progress = bbr ? bbr.progress : null;
  const browser = bbr === null ? null : {
    request_id: bbr.id,
    status: bbr.status,
    claimed_by: bbr.claimed_by === undefined ? null : bbr.claimed_by,
    requested_at: bbr.requested_at,
    claimed_at: bbr.claimed_at,
    finished_at: bbr.finished_at,
    last_error: bbr.last_error === undefined ? null : bbr.last_error,
    progress: progress && typeof progress === 'object' ? progress : null
  };

  // ---- what the runner said it added --------------------------------
  // These are only knowable from the runner's own durable progress record.
  // Nothing here counts rows and calls the result "regulars added".
  const regularsAdded = progressCount(progress, ['regulars_added', 'regularsAdded']);
  const searchedAdded = progressCount(progress, ['searched_added', 'searchedAdded', 'searched_items_added']);

  // ---- the confirmation ---------------------------------------------
  const confirmation = firstRow(await client.query(CONFIRMATION_SQL, [shop.id]));
  let confirmationLines = null;
  if (confirmation) {
    confirmationLines = firstRow(await client.query(CONFIRMATION_LINE_COUNTS_SQL, [confirmation.id]));
  }

  // Basket product count: the confirmation is the strongest evidence; the
  // runner's progress is the next best; otherwise unknown.
  let basketProductCount = null;
  let basketCountSource = null;
  if (confirmationLines && Number(confirmationLines.lines) > 0) {
    basketProductCount = Number(confirmationLines.lines);
    basketCountSource = 'order_confirmation';
  } else {
    const fromRunner = progressCount(progress, ['basket_product_count', 'basketProductCount', 'products_in_basket']);
    if (fromRunner !== null) {
      basketProductCount = fromRunner;
      basketCountSource = 'browser_progress';
    }
  }

  // Total: a STATED total is one ASDA showed. Anything summed or reported by
  // the runner is DERIVED and is labelled so - it may never be presented as an
  // ASDA-quoted figure.
  let total = null;
  if (confirmation && toNumberOrNull(confirmation.stated_total) !== null) {
    total = money(confirmation.stated_total, 'stated', 'order_confirmation');
  } else if (confirmationLines && toNumberOrNull(confirmationLines.stated_sum) !== null &&
             Number(confirmationLines.stated_lines) === Number(confirmationLines.lines) &&
             Number(confirmationLines.lines) > 0) {
    total = money(confirmationLines.stated_sum, 'derived', 'order_confirmation_line');
  } else {
    const runnerTotal = fromProgress(progress, ['estimated_total', 'estimatedTotal', 'basket_total']);
    if (runnerTotal !== null) total = money(runnerTotal, 'derived', 'browser_progress');
  }

  // ---- outstanding actions ------------------------------------------
  const pending = allRows(await client.query(PENDING_ACTIONS_SQL, [shop.household_id, shop.id]));

  // ---- failure and retry --------------------------------------------
  const lastFailure = firstRow(await client.query(LAST_FAILURE_SQL, [shop.id]));
  const failureCountRow = firstRow(await client.query(FAILURE_COUNT_SQL, [shop.id]));
  const failureCount = failureCountRow ? Number(failureCountRow.n) || 0 : 0;

  const failure = lastFailure === null ? null : {
    description: lastFailure.description,
    occurred_at: lastFailure.occurred_at,
    failed_from: lastFailure.from_status === undefined ? null : lastFailure.from_status,
    last_error: shop.last_error === undefined ? null : shop.last_error,
    failure_count: failureCount,
    // Only meaningful while the shop is actually parked. A shop that failed
    // and was resumed is not waiting to be resumed again.
    resumable: shop.status === 'FAILED' && !!lastFailure.from_status,
    resume_to: shop.status === 'FAILED' ? (lastFailure.from_status || null) : null
  };

  // ---- substitutions --------------------------------------------------
  const subs = firstRow(await client.query(SUBSTITUTION_SQL, [shop.household_id]));

  const lastEvent = firstRow(await client.query(LAST_EVENT_SQL, [shop.id]));

  return {
    shop_id: shop.id,
    shop_ref: shop.shop_ref,
    household_id: shop.household_id,
    source_kind: shop.source_kind,
    created_at: shop.created_at,
    updated_at: shop.updated_at,

    stage: shop.status,
    stage_label: STAGE_LABELS[shop.status] || shop.status,
    is_terminal: shop.status === 'RECONCILED' || shop.status === 'CANCELLED',
    needs_review: shop.needs_review === undefined ? null : shop.needs_review,
    transcript_confidence: toNumberOrNull(shop.transcript_confidence),

    list_id: shop.list_id === undefined ? null : shop.list_id,
    lines: lines,

    questions: questions,

    regulars_added: regularsAdded,
    searched_items_added: searchedAdded,

    substitutions: {
      // Schema-level doctrine, not a per-shop setting: the agent NEVER
      // auto-substitutes; alternatives wait for a human choice.
      auto_substitute: false,
      policy: 'never auto-substitute; alternatives wait for a human choice',
      active_regulars: subs ? Number(subs.total) || 0 : null,
      regulars_allowing_substitutes: subs ? Number(subs.allowing) || 0 : null
    },

    basket_product_count: basketProductCount,
    basket_product_count_source: basketCountSource,
    total: total,

    browser: browser,
    outstanding_actions: pending.map(function (p) {
      return {
        id: p.id,
        action_type: p.action_type,
        action_key: p.action_key,
        payload: p.payload,
        note: p.note === undefined ? null : p.note,
        created_at: p.created_at
      };
    }),

    failure: failure,
    last_event: lastEvent,

    // Every null above means GENUINELY UNKNOWN. The caller must say "unknown",
    // never zero and never a guess.
    unknown_means_unknown: true
  };
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getShopStatus: getShopStatus,
  close: close,
  STAGE_LABELS: STAGE_LABELS,
  SHOP_STATUSES: SHOP_STATUSES,
  _internal: {
    project: project,
    resolveShop: resolveShop,
    money: money,
    toNumberOrNull: toNumberOrNull,
    progressCount: progressCount,
    countsToObject: countsToObject,
    RESOLVED_ITEM_STATUSES: RESOLVED_ITEM_STATUSES,
    OPEN_ITEM_STATUSES: OPEN_ITEM_STATUSES,
    ITEM_COUNTS_SQL: ITEM_COUNTS_SQL,
    SHOP_BY_ID_SQL: SHOP_BY_ID_SQL,
    SHOP_BY_REF_SQL: SHOP_BY_REF_SQL
  }
};
