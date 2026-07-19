// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: data.js
//
// READ-ONLY data adapter. It loads the pure planner's inputs from the
// live asdair Postgres schema and returns plain objects.
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

  const listRows = await readQuery(
    'SELECT id, list_date, status FROM asdair.shopping_lists WHERE household_id = $1 AND list_date = $2 LIMIT 1',
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

// Load the list_term -> matched_product mappings. SELECT only.
async function loadProducts() {
  const rows = await readQuery(
    'SELECT id, list_term, matched_product, category, household_id FROM asdair.products ORDER BY id',
    []
  );
  return rows;
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
  loadBudget: loadBudget,
  close: close,
  // Exported for schemaCompat.test.js (schema/code drift guard). Not used by
  // the CLI runtime path.
  RULES_SELECT_COLUMNS: RULES_SELECT_COLUMNS
};
