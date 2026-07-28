// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: buildOutcome.js
//
// The PURE half of "record what actually happened". It closes the loop the
// schema always designed (request -> plan -> approval -> shop -> RECORD ->
// learn) but which had no writer: asdair.orders and asdair.order_events had
// zero writers anywhere in the repo, so every shop was forgotten.
//
// buildOutcome({ plan, reconcile }) -> { order, events }
//
// PURE and DETERMINISTIC, exactly like planner.js:
//   * No DB, no network, no fs, no Date.now(), no randomness.
//   * Given identical inputs it always returns an identical result.
//   * It never mutates its arguments; it only reads them and returns
//     freshly-built plain objects.
//
// HARD GUARANTEES baked into this function:
//   * `order.checked_out` is ALWAYS false and `order.checked_out_at` is
//     ALWAYS null (standing rule 8: the agent never checks out). An input
//     that asks for a checked-out order is an ERROR, never an honoured
//     request.
//   * Every event_type is validated against the asdair.order_events CHECK
//     vocabulary HERE, in pure code, so a bad value is rejected before any
//     database connection is opened.
//   * It records; it does not learn. Nothing here promotes a rule, and no
//     event is synthesised out of thin air -- the events written are the
//     events the run reported.
//
// INPUT SHAPES
//   plan       : the planner's result, i.e. planBasket(...) ->
//                { items, summary }. Only `summary` is read (the REQUESTED
//                figures and the budget flag).
//   reconcile  : what ACTUALLY happened during the run:
//     {
//       list_id            : required, asdair.shopping_lists.id
//       household_id       : required, asdair.households.id
//       run_at             : optional Date | ISO string (null when unknown)
//       attempt            : optional positive integer (default 1)
//       source_document_id : optional provenance pointer
//       basket_total       : optional number, the ACTUAL basket total
//       budget             : optional { min_normal, max_normal } band used
//                            to judge the ACTUAL total
//       items              : REQUIRED array of what happened per line:
//                            { item_name, status } where status is one of
//                            the asdair.shopping_list_items vocabulary
//                            (requested | added | needs_decision |
//                             not_added | excluded_this_week)
//       events             : optional array of
//                            { event_type, description, occurred_at? }
//       checked_out        : must be absent or false (rule 8)
//       checked_out_at     : must be absent or null (rule 8)
//     }
//
// COLUMN PROVENANCE (why each order column takes the value it does)
//   list_id / household_id / attempt / source_document_id : the run's own
//     identity, from `reconcile`.
//   run_at               : when the run happened, from `reconcile`. This
//     function has no clock, so an unknown run_at stays null rather than
//     being invented.
//   total_requested      : from the PLAN summary -- the ask, i.e. how many
//     distinct lines the list requested.
//   total_added          : from the RECONCILE items -- lines actually added.
//   total_needs_decision : from the RECONCILE items -- lines that ended the
//     run waiting on a human. The run is the truth here, not the plan: a
//     line planned as `add` can still hit an out-of-stock at run time.
//   basket_total         : the ACTUAL total, from `reconcile`, rounded to
//     the 2dp the numeric(10,2) column stores. Null when unknown.
//   outside_budget_range : judged on the ACTUAL basket_total against the
//     supplied band when both are known. When either is missing it falls
//     back to the plan's own budget_flag ('above'/'below' -> true;
//     'within'/'unknown' -> false, because the column is NOT NULL and
//     "unknown" must never be recorded as "outside").
//   checked_out          : ALWAYS false. checked_out_at ALWAYS null.
//
// PURE ASCII only. Currency is written as "GBP", never a symbol.
// =====================================================================

'use strict';

// The EXACT column list the outcome writer INSERTs into asdair.orders, kept
// as one exported constant so there is a SINGLE source of truth (the same
// discipline data.js uses for RULES_SELECT_COLUMNS). schemaCompat.test.js
// imports this array and asserts every entry is defined on asdair.orders in
// db/001_asdair_schema.sql, so schema/code drift is caught in CI.
const ORDER_COLUMNS = [
  'list_id',
  'household_id',
  'run_at',
  'total_requested',
  'total_added',
  'total_needs_decision',
  'basket_total',
  'outside_budget_range',
  'checked_out',
  'checked_out_at',
  'attempt',
  'source_document_id'
];

// The asdair.order_events.event_type CHECK vocabulary. Validated in PURE code
// so an out-of-vocabulary value is rejected before a connection is opened;
// the DB CHECK remains the belt-and-braces backstop.
const EVENT_TYPES = ['correction', 'flag', 'info', 'decision', 'error', 'warning'];

// The asdair.shopping_list_items.status vocabulary (see the schema comment on
// that table). A reconcile line must report one of these; anything else is a
// caller bug and is rejected rather than silently counted as "not added".
const ITEM_STATUSES = ['requested', 'added', 'needs_decision', 'not_added', 'excluded_this_week'];

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

function fail(message) {
  throw new Error('buildOutcome: ' + message);
}

// A database id: a positive integer, accepted as a number or a numeric string
// (pg returns bigint as a string). Returns a Number when it is safely
// representable, else the trimmed string, so a large bigint is never mangled.
function requireId(value, name) {
  if (value === null || value === undefined || value === '') fail(name + ' is required');
  const s = String(value).trim();
  if (!/^\d+$/.test(s) || s === '0') fail(name + ' must be a positive integer id (got "' + s + '")');
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

function optionalId(value, name) {
  if (value === null || value === undefined || value === '') return null;
  return requireId(value, name);
}

function requireText(value, name) {
  if (value === null || value === undefined) fail(name + ' is required');
  const s = String(value).trim();
  if (s === '') fail(name + ' must be a non-empty string');
  return s;
}

// Round a money amount to 2 decimal places (pure arithmetic; matches the
// numeric(10,2) column and planner.js round2).
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function optionalMoney(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) fail(name + ' must be a finite number when given');
  return round2(n);
}

// A timestamp the caller observed. This function has NO clock, so it never
// invents one: an absent value stays null and the writer lets the database
// default supply the time. A Date is normalised to an ISO string so the
// returned rows stay plain, comparable data.
function optionalTimestamp(value, name) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail(name + ' is an invalid Date');
    return value.toISOString();
  }
  if (typeof value !== 'string') fail(name + ' must be a Date or an ISO date-time string');
  const s = value.trim();
  if (s === '') return null;
  if (!Number.isFinite(Date.parse(s))) fail(name + ' is not a parseable date-time string');
  return s;
}

// ---------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------
function buildOutcome(input) {
  const args = input || {};
  const plan = args.plan;
  const reconcile = args.reconcile;

  if (!plan || typeof plan !== 'object') fail('plan is required (the planBasket result)');
  const summary = plan.summary;
  if (!summary || typeof summary !== 'object') fail('plan.summary is required (the planBasket result)');
  if (!reconcile || typeof reconcile !== 'object') fail('reconcile is required (what actually happened)');

  // ---- rule 8: the agent NEVER checks out ------------------------------
  // A caller asking for a checked-out order is not honoured and is not
  // silently downgraded either -- it is an ERROR, so the attempt is loud.
  if (reconcile.checked_out === true) {
    fail('refusing to record a checked-out order: the agent never checks out (standing rule 8). ' +
         'checked_out is always written false.');
  }
  if (reconcile.checked_out_at !== null && reconcile.checked_out_at !== undefined && reconcile.checked_out_at !== '') {
    fail('refusing to record a checkout timestamp: the agent never checks out (standing rule 8). ' +
         'checked_out_at is always written null.');
  }

  // ---- identity --------------------------------------------------------
  const listId = requireId(reconcile.list_id, 'reconcile.list_id');
  const householdId = requireId(reconcile.household_id, 'reconcile.household_id');
  const sourceDocumentId = optionalId(reconcile.source_document_id, 'reconcile.source_document_id');

  let attempt = 1;
  if (reconcile.attempt !== null && reconcile.attempt !== undefined && reconcile.attempt !== '') {
    const a = Number(reconcile.attempt);
    if (!Number.isInteger(a) || a < 1) fail('reconcile.attempt must be a positive integer when given');
    attempt = a;
  }

  const runAt = optionalTimestamp(reconcile.run_at, 'reconcile.run_at');

  // ---- totals ----------------------------------------------------------
  // The ASK comes from the plan; what actually happened comes from the run.
  const totalRequested = Number(summary.total_requested);
  if (!Number.isInteger(totalRequested) || totalRequested < 0) {
    fail('plan.summary.total_requested must be a non-negative integer');
  }

  if (!Array.isArray(reconcile.items)) {
    fail('reconcile.items must be an array of { item_name, status } (use [] when the run recorded no lines)');
  }
  let totalAdded = 0;
  let totalNeedsDecision = 0;
  reconcile.items.forEach(function (raw, idx) {
    if (!raw || typeof raw !== 'object') fail('reconcile.items[' + idx + '] must be an object');
    const status = String(raw.status === null || raw.status === undefined ? '' : raw.status).trim();
    if (ITEM_STATUSES.indexOf(status) === -1) {
      fail('reconcile.items[' + idx + '].status "' + status + '" is not one of: ' + ITEM_STATUSES.join(', '));
    }
    if (status === 'added') totalAdded += 1;
    if (status === 'needs_decision') totalNeedsDecision += 1;
  });

  const basketTotal = optionalMoney(reconcile.basket_total, 'reconcile.basket_total');

  // ---- budget judgement on the ACTUAL total ----------------------------
  let outsideBudgetRange;
  const band = reconcile.budget;
  const min = band ? Number(band.min_normal) : NaN;
  const max = band ? Number(band.max_normal) : NaN;
  if (basketTotal !== null && Number.isFinite(min) && Number.isFinite(max)) {
    outsideBudgetRange = basketTotal < min || basketTotal > max;
  } else {
    // Fall back to the plan's own flag. 'unknown' is NOT "outside": the
    // column is NOT NULL, so an unknown position records as false rather
    // than asserting something the run never established.
    const flag = summary.budget_flag;
    outsideBudgetRange = flag === 'above' || flag === 'below';
  }

  // ---- events ----------------------------------------------------------
  // Passed through from the run, validated. Nothing is synthesised here:
  // this function records what happened, it does not narrate it.
  const rawEvents = reconcile.events;
  if (rawEvents !== null && rawEvents !== undefined && !Array.isArray(rawEvents)) {
    fail('reconcile.events must be an array when given');
  }
  const events = (Array.isArray(rawEvents) ? rawEvents : []).map(function (raw, idx) {
    if (!raw || typeof raw !== 'object') fail('reconcile.events[' + idx + '] must be an object');
    const eventType = String(raw.event_type === null || raw.event_type === undefined ? '' : raw.event_type).trim();
    if (EVENT_TYPES.indexOf(eventType) === -1) {
      fail('reconcile.events[' + idx + '].event_type "' + eventType + '" is not one of: ' + EVENT_TYPES.join(', '));
    }
    return {
      event_type: eventType,
      description: requireText(raw.description, 'reconcile.events[' + idx + '].description'),
      // Null means "the run did not say when"; the writer lets the database
      // default (now()) fill it in rather than this pure function guessing.
      occurred_at: optionalTimestamp(raw.occurred_at, 'reconcile.events[' + idx + '].occurred_at')
    };
  });

  const order = {
    list_id: listId,
    household_id: householdId,
    run_at: runAt,
    total_requested: totalRequested,
    total_added: totalAdded,
    total_needs_decision: totalNeedsDecision,
    basket_total: basketTotal,
    outside_budget_range: outsideBudgetRange,
    // Rule 8, by construction: never derived from input, always these values.
    checked_out: false,
    checked_out_at: null,
    attempt: attempt,
    source_document_id: sourceDocumentId
  };

  return { order: order, events: events };
}

module.exports = {
  buildOutcome: buildOutcome,
  // Exported so recordShopOutcome.js and schemaCompat.test.js share ONE
  // source of truth for the column list and the CHECK vocabularies.
  ORDER_COLUMNS: ORDER_COLUMNS,
  EVENT_TYPES: EVENT_TYPES,
  ITEM_STATUSES: ITEM_STATUSES
};
