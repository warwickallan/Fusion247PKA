// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: data.js
//
// READ-ONLY data adapter. It loads the pure planner's inputs from the
// live asdair Postgres schema and returns plain objects:
//   loadList / loadRules / loadProducts / loadRegulars / loadBudget
//
// READ-ONLY INTENT (enforced by review):
//   * Every query in this file is a SELECT. There is NO INSERT, UPDATE,
//     DELETE, or DDL anywhere in this adapter, by design.
//   * Each connection opens a "SET TRANSACTION READ ONLY"-style guard:
//     queries run inside a read-only transaction so the database itself
//     rejects any accidental write.
//
// SECRETS:
//   * The connection string comes ONLY from process.env.ASDAIR_DB_URL.
//   * It is never hardcoded, never printed, never logged.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const { Pool } = require('pg');

let pool = null;

// The EXACT column list loadRules() SELECTs from asdair.rules, kept as one
// exported constant so there is a SINGLE source of truth. schemaCompat.test.js
// imports this array and asserts every entry is defined on asdair.rules in the
// migration -- so schema/code drift (a column selected here but missing from
// 001_asdair_schema.sql) is caught automatically, with no duplicated list to
// rot. These are fixed identifiers (no external input), so building the SELECT
// from them keeps the query SELECT-only and safe.
const RULES_SELECT_COLUMNS = [
  'id',
  'category',
  'rule_text',
  'scope',
  'active',
  'household_id',
  'directive',
  'match_term',
  'match_category',
  'matched_product',
  'reason',
  'note'
];

// The EXACT column list loadRuleQaLog() SELECTs from asdair.rule_qa_log, kept
// as one exported constant for the same single-source-of-truth reason as
// RULES_SELECT_COLUMNS. schemaCompat.test.js asserts every entry is defined on
// asdair.rule_qa_log in db/001_asdair_schema.sql.
//
// WHY THIS TABLE IS SUDDENLY A PLANNING INPUT (WO-Y): it holds the household's
// ANSWERED questions -- five of them, including Ariel Pods = "best value/wash"
// recorded 2026-07-21 -- and NOTHING in the planning path has ever read it. The
// only non-test readers in the whole service were outcome/promoteDecision.js
// (a writer) and cockpit-api/readRules.js (a display reader). So on 2026-08-03
// the shop asked Warwick a question whose answer was already in the database.
//
// NOTE there is no match_term column here: it is free text. planner.js links a
// row to a line by matching the LINE against the QUESTION text with the
// conservative matcher in termMatch.js.
const RULE_QA_LOG_SELECT_COLUMNS = [
  'id',
  'asked_on',
  'question',
  'answer',
  'applies_going_forward',
  'promoted_rule_id',
  'household_id'
];

// The EXACT column list loadRegulars() SELECTs from asdair.regulars, kept as
// one exported constant for the same single-source-of-truth reason as
// RULES_SELECT_COLUMNS above. These are fixed identifiers (no external input),
// so building the SELECT from them keeps the query SELECT-only and safe.
//
// SCHEMA NOTE (drift, reported not fixed): asdair.regulars exists in the LIVE
// asdair schema but is NOT defined in the committed migration
// db/001_asdair_schema.sql, so it is not covered by the schemaCompat.test.js
// drift guard the way asdair.rules is. Adding it to the migration is out of
// scope for this change; until it lands, a database built from git alone does
// not have this table and loadRegulars() will throw against it.
const REGULARS_SELECT_COLUMNS = [
  'id',
  'household_id',
  'high_level_category',
  'category',
  'name',
  'brand',
  'aka',
  'asda_product_id',
  'asda_url',
  'typical_qty',
  'substitutes_allowed'
];

// The EXACT column list loadLastOrder() SELECTs from asdair.orders, kept as one
// exported constant for the same single-source-of-truth reason as the two lists
// above. Fixed identifiers (no external input), so building the SELECT from them
// keeps the query SELECT-only and safe. lastOrder.test.js asserts every entry is
// defined on asdair.orders in db/001_asdair_schema.sql, so schema/code drift is
// caught statically with no live database.
const ORDERS_SELECT_COLUMNS = [
  'id',
  'list_id',
  'household_id',
  'run_at',
  'total_requested',
  'total_added',
  'total_needs_decision',
  'basket_total',
  'outside_budget_range',
  'checked_out',
  'attempt',
  'created_at'
];

// The EXACT column list loadLastOrder() SELECTs from asdair.shopping_list_items
// for the previous order's PURCHASED lines. Same single-source-of-truth and
// drift-guard treatment as the lists above.
const ORDER_LINE_SELECT_COLUMNS = [
  'id',
  'item_name',
  'matched_product_id',
  'requested_qty',
  'added_qty',
  'status',
  'price',
  'note'
];

// Normalise a term for matching: lower-case, trim, collapse whitespace.
//
// This MUST stay behaviourally identical to planner.js normaliseTerm(). It is
// duplicated rather than imported so the adapter keeps its only dependency on
// `pg` and the layering stays one-way (cli -> data -> nothing; cli -> planner).
// lastOrder.test.js asserts the two implementations agree over a fixture set,
// so the copy cannot silently drift.
function normaliseTerm(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Every normalised name a regular answers to: its `name` plus each `aka` alias.
// Mirrors planner.js regularAliases(); same drift guard as normaliseTerm above.
function regularAliasKeys(reg) {
  const names = [];
  if (!reg) return names;
  const primary = normaliseTerm(reg.name);
  if (primary !== '') names.push(primary);
  const aka = Array.isArray(reg.aka) ? reg.aka : [];
  aka.forEach(function (a) {
    const t = normaliseTerm(a);
    if (t !== '' && names.indexOf(t) === -1) names.push(t);
  });
  return names;
}

// Lazily create a single shared pool from the environment. Throws a clear
// error if the connection string is not configured. The URL value is never
// echoed back in the error or anywhere else.
function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair Postgres connection string as ASDAIR_DB_URL before running the skill.');
  }
  pool = new Pool({ connectionString: url });
  return pool;
}

// Run a SELECT inside a READ ONLY transaction. This is a belt-and-braces
// guard: even if a query were changed to attempt a write, the database
// rejects it because the transaction is read only.
async function readQuery(text, params) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const res = await client.query(text, params || []);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

// Resolve a household argument (a stable name like 'household-a' or a numeric id)
// to its numeric id. Returns null when it cannot be resolved.
async function resolveHouseholdId(household) {
  if (household === null || household === undefined || String(household).trim() === '') return null;
  // SELECT only.
  const rows = await readQuery(
    'SELECT id FROM asdair.households WHERE name = $1 OR CAST(id AS text) = $1 LIMIT 1',
    [String(household)]
  );
  return rows.length > 0 ? rows[0].id : null;
}

// Load one weekly list for a household + date, with its line items and any
// alternatives already recorded against each line. SELECT only.
async function loadList(listDate, household) {
  const householdId = await resolveHouseholdId(household);
  if (householdId === null) {
    throw new Error('Unknown household "' + String(household) + '". Check asdair.households.name.');
  }

  // WP-B15-16: `LIMIT 1` with NO `ORDER BY` was non-deterministic the moment more than one list can
  // share a date -- and after migration 019 (the shop owns the list, not the date) that is the normal
  // case, not an edge case. Postgres is free to return either row, so the same question could answer
  // from a different shop's list between two calls. `ORDER BY id DESC` makes it deterministic and
  // resolves to the most recently created list, which is the live shop's.
  //
  // Deliberately NOT joining asdair.shop to prefer the live shop's list, though that would be the
  // sharper rule: the complete grant matrix (012) gives asdair_ro no privilege on asdair.shop, so a
  // join here would risk `permission denied for table shop` on the live read path -- the exact failure
  // that killed a live shop twice on 2026-08-03 and caused migration 010. That is a grant decision,
  // not something a read path should assume. This form needs no new grant and behaves identically
  // before and after 019.
  const listRows = await readQuery(
    'SELECT id, list_date, status FROM asdair.shopping_lists WHERE household_id = $1 AND list_date = $2 ORDER BY id DESC LIMIT 1',
    [householdId, listDate]
  );
  if (listRows.length === 0) {
    throw new Error('No shopping list found for household id ' + householdId + ' on ' + String(listDate) + '.');
  }
  const list = listRows[0];

  const itemRows = await readQuery(
    'SELECT id, item_name, matched_product_id, requested_qty, status, price, note, one_week_only ' +
    'FROM asdair.shopping_list_items WHERE list_id = $1 ORDER BY id',
    [list.id]
  );

  const altRows = await readQuery(
    'SELECT list_item_id, alternative_name, price, chosen FROM asdair.product_alternatives ' +
    'WHERE list_item_id IN (SELECT id FROM asdair.shopping_list_items WHERE list_id = $1) ORDER BY id',
    [list.id]
  );

  const altsByItem = Object.create(null);
  altRows.forEach(function (a) {
    const key = String(a.list_item_id);
    if (!altsByItem[key]) altsByItem[key] = [];
    altsByItem[key].push({ alternative_name: a.alternative_name, price: a.price });
  });

  const listItems = itemRows.map(function (r) {
    return {
      id: r.id,
      item_name: r.item_name,
      matched_product_id: r.matched_product_id,
      requested_qty: r.requested_qty,
      status: r.status,
      price: r.price,
      note: r.note,
      one_week_only: r.one_week_only,
      alternatives: altsByItem[String(r.id)] || []
    };
  });

  return {
    household_id: householdId,
    list_id: list.id,
    list_date: list.list_date,
    status: list.status,
    listItems: listItems
  };
}

// Load active standing rules. These carry free-text rule_text (informational
// to the pure planner) plus scope/household for applicability, AND the
// structured directive columns the planner acts on (Option A): directive,
// match_term, match_category, matched_product, plus reason and note (surfaced
// to a human by the planner). The returned row keys are the raw column names,
// so they line up exactly with what planner.js reads (rule.directive,
// rule.match_term, rule.match_category, rule.matched_product, rule.reason,
// rule.note). Columns come from the RULES_SELECT_COLUMNS constant above.
// SELECT only.
async function loadRules() {
  const rows = await readQuery(
    'SELECT ' + RULES_SELECT_COLUMNS.join(', ') + ' FROM asdair.rules WHERE active = true ORDER BY id',
    []
  );
  return rows;
}

// Load the household's ANSWERED questions -- asdair.rule_qa_log (WO-Y).
// SELECT only.
//
// SCOPE: the named household's rows PLUS the global ones (household_id null),
// mirroring loadRules() rather than loadRegulars(). A global recorded decision
// is exactly as binding as a global rule. Passing no household loads the global
// rows only, so a caller can never accidentally widen the scope by omission.
//
// The planner filters further (it honours `applies_going_forward` and re-checks
// household scope), so this is the read, not the policy. Ordered oldest-first
// by asked_on so a later answer on the same subject is appended after an
// earlier one and reads in the order the household decided things.
async function loadRuleQaLog(household) {
  const householdId = await resolveHouseholdId(household);
  const rows = await readQuery(
    'SELECT ' + RULE_QA_LOG_SELECT_COLUMNS.join(', ') + ' FROM asdair.rule_qa_log '
      + 'WHERE household_id IS NULL OR household_id = $1 ORDER BY asked_on, id',
    [householdId]
  );
  return rows;
}

// Load the list_term -> matched_product mappings. SELECT only.
async function loadProducts() {
  const rows = await readQuery(
    'SELECT id, list_term, matched_product, category, household_id FROM asdair.products ORDER BY id',
    []
  );
  return rows;
}

// Load the household's ACTIVE Regulars -- the standing "this is what we
// actually buy" knowledge (brand, `aka` aliases, asda_product_id,
// substitutes_allowed). This is the resolution source the planner was missing:
// without it an item the household buys every week resolved to nothing and the
// plan was confidently wrong. SELECT only.
//
// Scoping is done HERE as well as in the planner, deliberately narrower than
// loadRules(): regulars carry a household's private preferences, so a run loads
// exactly ONE household's rows and another household's regulars never enter
// memory in the first place.
//
// THERE ARE NO GLOBAL REGULARS. `asdair.regulars.household_id` is NOT NULL
// (see 004_asdair_regulars.sql, which is faithful to the live table) -- unlike
// `products` and `budget_settings`, which DO carry a nullable global row. An
// earlier version of this function assumed the global-row convention held here
// too, so an unnamed run queried `household_id IS NULL` and SILENTLY returned
// zero regulars: a planner that resolved nothing while appearing to work, which
// is the exact confidently-wrong failure this function exists to fix. Found by
// independent QA at the integration seam -- the migration and this loader were
// written by different workers and only contradicted each other once merged.
//
// So a run MUST name its household. Unnamed or unresolvable THROWS (the
// loadList precedent, not the loadBudget one) rather than returning an empty
// set, because silently dropping every piece of the household's resolution
// knowledge is worse than failing loudly.
async function loadRegulars(household) {
  const named = !(household === null || household === undefined || String(household).trim() === '');
  if (!named) {
    throw new Error(
      'loadRegulars requires a household: asdair.regulars.household_id is NOT NULL, so there are no global '
      + 'regulars to fall back to. Pass --household <name>.'
    );
  }

  const householdId = await resolveHouseholdId(household);
  if (householdId === null) {
    throw new Error('Unknown household "' + String(household) + '". Check asdair.households.name.');
  }
  return await readQuery(
    'SELECT ' + REGULARS_SELECT_COLUMNS.join(', ')
      + ' FROM asdair.regulars WHERE active = true AND household_id = $1 ORDER BY id',
    [householdId]
  );
}

// Load the budget band for a household, falling back to the global default
// row (household_id IS NULL) when the household has no specific band.
// SELECT only.
async function loadBudget(household) {
  const householdId = await resolveHouseholdId(household);
  if (householdId !== null) {
    const scoped = await readQuery(
      'SELECT min_normal, max_normal, currency, household_id FROM asdair.budget_settings WHERE household_id = $1 LIMIT 1',
      [householdId]
    );
    if (scoped.length > 0) return scoped[0];
  }
  const global = await readQuery(
    'SELECT min_normal, max_normal, currency, household_id FROM asdair.budget_settings WHERE household_id IS NULL LIMIT 1',
    []
  );
  return global.length > 0 ? global[0] : { min_normal: 120, max_normal: 150, currency: 'GBP', household_id: null };
}

// ---------------------------------------------------------------------
// loadLastOrder(household) -- the PREVIOUS shop, as a planning input.
//
// WHY THIS EXISTS: SOP-021 makes the last order a REQUIRED planning input,
// because some regulars rotate deliberately (a different variant each week) and
// rotation cannot be resolved without knowing what the previous shop actually
// contained. Nothing loaded it, so every rotation rule was structurally
// unimplementable -- the rulebook said rotate and the planner had no idea what
// was bought last week. This closes that gap.
//
// SELECT ONLY, like every other loader here: three SELECTs inside the same
// read-only transaction wrapper. Nothing in this path writes.
//
// "MOST RECENT COMPLETED ORDER" -- the definition chosen, and why:
//
//   COMPLETED  ==  `total_added IS NOT NULL`.
//     asdair.orders has no status column, and `checked_out` is FALSE BY
//     CONSTRUCTION (rule 8: the agent produces a checkout-ready basket and
//     never places the order; outcome/recordShopOutcome.js writes that column
//     as the SQL literal `false`). So "completed" can NOT mean checked_out --
//     that would match nothing, forever, and rotation would stay dead while
//     appearing to work. What DOES mark a finished run is the outcome recorder
//     having written back the reconciled totals: `total_added` is populated
//     from the reconcile step's items. A row without it is an in-flight or
//     abandoned run, not a shop that happened.
//
//   MOST RECENT  ==  ORDER BY COALESCE(run_at, created_at) DESC, id DESC.
//     `run_at` is the truth when known, but buildOutcome.js deliberately leaves
//     it NULL when the run did not say when it happened (it is clock-free), so
//     ordering on run_at alone would sort real orders last. created_at is NOT
//     NULL with a now() default, so it is the honest fallback. `id DESC` is the
//     deterministic tie-break (later insert wins) -- including for retried runs
//     of the same list, where the higher `attempt` row has the higher id.
//
// PURCHASED LINES: the schema has no per-order line table -- lines live on the
// order's shopping_list, so they are read from asdair.shopping_list_items for
// `orders.list_id`. A line counts as PURCHASED when the run actually put units
// in the basket: `added_qty > 0`, or `status = 'added'` for a run that recorded
// the status but not the count.
//
// RESOLVED AGAINST REGULARS: a caller (rotation, in particular) needs to reason
// in terms of regulars, not free text, so each line carries the id/name/brand of
// the regular it matches. Two or more active regulars answering the same name is
// AMBIGUOUS: the line reports `regular_ambiguous: true` and NO regular id. The
// adapter never picks one -- same discipline as standing rule 6 in the planner.
//
// Returns null -- cleanly, never throwing -- when the household has no completed
// order yet, so a first-ever shop plans normally instead of crashing.
// ---------------------------------------------------------------------

// Coerce a raw count to a non-negative integer, or null when it is absent or
// unusable. PURE: no I/O, exported for offline tests.
function orderQty(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 0 ? i : null;
}

// Resolve one purchased line to a regular. `regulars` is already scoped (ACTIVE
// rows for this household only -- loadRegulars did that), so no scope logic is
// repeated here. Identification is by exact normalised name over the regular's
// `name` and every `aka` alias: the line's matched product name first (the
// specific thing bought), then the household's own shorthand from the list.
// Two or more hits -> ambiguous, and NO id is chosen. PURE.
function resolveLineRegular(line, regulars) {
  const list = Array.isArray(regulars) ? regulars : [];
  const terms = [];
  const byProduct = normaliseTerm(line && line.matched_product);
  const byItem = normaliseTerm(line && line.item_name);
  if (byProduct !== '') terms.push(byProduct);
  if (byItem !== '' && byItem !== byProduct) terms.push(byItem);

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const hits = list.filter(function (r) {
      return regularAliasKeys(r).indexOf(term) !== -1;
    });
    if (hits.length === 1) return { regular: hits[0], ambiguous: false };
    if (hits.length > 1) return { regular: null, ambiguous: true };
  }
  return { regular: null, ambiguous: false };
}

// Shape the three SELECT results into the returned object. PURE -- no I/O, no
// clock -- so the whole shape (including the regulars resolution) is testable
// offline against fixtures. Exported via _internal for exactly that reason.
function shapeLastOrder(orderRow, lineRows, regularRows) {
  if (!orderRow) return null;
  const lines = (Array.isArray(lineRows) ? lineRows : []).map(function (r) {
    const resolved = resolveLineRegular(r, regularRows);
    return {
      list_item_id: r.id,
      item_name: r.item_name,
      matched_product: (r.matched_product === undefined ? null : r.matched_product),
      requested_qty: orderQty(r.requested_qty),
      added_qty: orderQty(r.added_qty),
      status: r.status,
      note: (r.note === undefined ? null : r.note),
      regular_id: resolved.regular ? resolved.regular.id : null,
      regular_name: resolved.regular ? resolved.regular.name : null,
      regular_brand: resolved.regular ? resolved.regular.brand : null,
      regular_ambiguous: resolved.ambiguous
    };
  });

  return {
    household_id: orderRow.household_id,
    order: {
      id: orderRow.id,
      list_id: orderRow.list_id,
      list_date: (orderRow.list_date === undefined ? null : orderRow.list_date),
      run_at: orderRow.run_at,
      created_at: orderRow.created_at,
      attempt: orderRow.attempt,
      total_requested: orderRow.total_requested,
      total_added: orderRow.total_added,
      total_needs_decision: orderRow.total_needs_decision,
      basket_total: orderRow.basket_total,
      outside_budget_range: orderRow.outside_budget_range,
      checked_out: orderRow.checked_out
    },
    lines: lines
  };
}

// SELECT only. Accepts a household name or a numeric id, exactly like every
// other loader in this file (resolveHouseholdId handles both).
async function loadLastOrder(household) {
  const householdId = await resolveHouseholdId(household);
  if (householdId === null) {
    throw new Error('Unknown household "' + String(household) + '". Check asdair.households.name.');
  }

  const orderRows = await readQuery(
    'SELECT ' + ORDERS_SELECT_COLUMNS.map(function (c) { return 'o.' + c; }).join(', ')
      + ', l.list_date FROM asdair.orders o'
      + ' JOIN asdair.shopping_lists l ON l.id = o.list_id'
      + ' WHERE o.household_id = $1 AND o.total_added IS NOT NULL'
      + ' ORDER BY COALESCE(o.run_at, o.created_at) DESC, o.id DESC LIMIT 1',
    [householdId]
  );
  // No completed order yet (a first-ever shop). Not an error.
  if (orderRows.length === 0) return null;
  const orderRow = orderRows[0];

  const lineRows = await readQuery(
    'SELECT ' + ORDER_LINE_SELECT_COLUMNS.map(function (c) { return 'i.' + c; }).join(', ')
      + ', p.matched_product FROM asdair.shopping_list_items i'
      + ' LEFT JOIN asdair.products p ON p.id = i.matched_product_id'
      + ' WHERE i.list_id = $1 AND (i.added_qty > 0 OR i.status = $2)'
      + ' ORDER BY i.id',
    [orderRow.list_id, 'added']
  );

  // Reuses loadRegulars so the household scoping and ACTIVE filter are the
  // SAME code the planner's resolution source uses -- one definition, not two.
  const regularRows = await loadRegulars(household);

  return shapeLastOrder(orderRow, lineRows, regularRows);
}

// Close the shared pool (call once when a CLI run finishes).
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  loadList: loadList,
  loadRules: loadRules,
  loadProducts: loadProducts,
  loadRegulars: loadRegulars,
  loadBudget: loadBudget,
  loadLastOrder: loadLastOrder,
  loadRuleQaLog: loadRuleQaLog,
  close: close,
  // Exported for schemaCompat.test.js (schema/code drift guard). Not used by
  // the CLI runtime path.
  RULES_SELECT_COLUMNS: RULES_SELECT_COLUMNS,
  REGULARS_SELECT_COLUMNS: REGULARS_SELECT_COLUMNS,
  ORDERS_SELECT_COLUMNS: ORDERS_SELECT_COLUMNS,
  ORDER_LINE_SELECT_COLUMNS: ORDER_LINE_SELECT_COLUMNS,
  RULE_QA_LOG_SELECT_COLUMNS: RULE_QA_LOG_SELECT_COLUMNS,
  // PURE helpers, exported so the shaping and the regulars resolution can be
  // tested offline against fixtures with no database. Not used by the CLI.
  _internal: {
    normaliseTerm: normaliseTerm,
    regularAliasKeys: regularAliasKeys,
    orderQty: orderQty,
    resolveLineRegular: resolveLineRegular,
    shapeLastOrder: shapeLastOrder
  }
};
