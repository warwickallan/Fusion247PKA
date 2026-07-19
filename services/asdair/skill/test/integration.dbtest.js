// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: integration.dbtest.js
//
// Runs under: node --test
//
// CLEAN-POSTGRES INTEGRATION test (GPT PR #36 review item #2). It proves
// the FULL skill path against a real, from-scratch Postgres:
//
//     apply committed db/001_asdair_schema.sql
//       -> seed SYNTHETIC rows
//       -> data.js loadList/loadRules/loadProducts/loadBudget read them
//       -> planner.js planBasket() produces the expected plan
//
// This is the end-to-end complement to constraints.dbtest.js (which only
// proves the unique indexes). It exercises the real read-only adapter and
// the real pure planner together, including the #4 cross-household
// matched_product_id scope-mismatch, proven all the way THROUGH the DB.
//
// GATED (two independent layers -- this test runs DROP SCHEMA ... CASCADE,
// so it is destructive and stays INERT by default):
//   * PRIMARY, POSITIVE OPT-IN: it runs ONLY when the operator has EXPLICITLY
//     opted in by setting ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE to exactly "1" or
//     "true" (a dedicated, single-purpose marker -- see dbSafeTarget.js).
//   * AND ASDAIR_DB_URL must also be set (where to run).
//   Missing EITHER -> the test is a NO-OP (skipped), never a failure and
//   never a destructive run. A laptop with no Postgres stays green.
//
// SAFETY (critical):
//   * The explicit opt-in above is the PRIMARY gate: it does not trust any
//     hostname / db-name heuristic (a `localhost` can be an SSH tunnel to
//     prod; a live DB can be named `*_test`). Without the marker nothing
//     connects and no DDL runs.
//   * assertSafeDbTarget() is a SECONDARY defence-in-depth backstop that runs
//     AFTER the opt-in gate passes and REFUSES (throws) if ASDAIR_DB_URL still
//     points anywhere that could be live: any host containing 'supabase' or
//     'pooler', or any non-local host that is not an explicit *_test
//     database. This test only ever runs against a throwaway / CI Postgres.
//   * It creates the real `asdair` schema (which is what data.js queries)
//     but ONLY inside that throwaway DB, drops it clean before AND after,
//     and touches no other schema.
//   * SYNTHETIC data only: invented households ('Test Household',
//     'Other Household') and invented terms ('widget a'...). No real
//     household / personal data anywhere.
//   * The connection string is read only from process.env.ASDAIR_DB_URL and
//     is NEVER printed or logged (only host / db-name are inspected, and
//     only to refuse an unsafe target).
//
// HOW TO RUN (against a throwaway/local Postgres, NOT live Supabase):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:5432/postgres \
//     node --test test/integration.dbtest.js
//   (from services/asdair/skill). Without the explicit opt-in marker (or
//   with ASDAIR_DB_URL unset) it no-ops.
//
//   !! WARNING -- DESTRUCTIVE, RE-CREATES THE LITERAL `asdair` SCHEMA !!
//   Because data.js is schema-qualified, this test operates on the REAL
//   `asdair` schema name (not a throwaway `asdair_test_*` schema) on whatever
//   ASDAIR_DB_URL reaches: it DROPs and recreates `asdair` on that database.
//   ONLY ever point ASDAIR_DB_URL at a throwaway / CI Postgres that holds no
//   real asdair data. As a safety net (Finding 5) the test ABORTS before the
//   drop if it finds a pre-existing, non-empty asdair.households -- so it will
//   refuse to clobber a real local copy rather than destroy it -- but you
//   should still never aim it at a database you care about.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// SAFETY GATING (shared, one source of truth with constraints.dbtest.js).
// destructiveTestsEnabled() is the PRIMARY, positive opt-in; assertSafeDbTarget()
// is the SECONDARY defence-in-depth host check applied after the opt-in passes.
const { assertSafeDbTarget, destructiveTestsEnabled } = require('./dbSafeTarget.js');

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

// Gate: skip=false runs it, skip=<string> records the reason and no-ops. This
// is a DESTRUCTIVE test (DROP SCHEMA ... CASCADE), so it runs ONLY when the
// operator has EXPLICITLY opted in (ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1|true)
// AND ASDAIR_DB_URL is set. Missing EITHER -> clean skip, never a DDL run.
const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : { skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres integration test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres integration test skipped (no-op)' };

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', '001_asdair_schema.sql');

test('asdair full path: clean Postgres -> schema -> seed -> data.js -> planner.js', gate, async function () {
  // The gate above already proved the operator explicitly opted in
  // (ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE) AND ASDAIR_DB_URL is set; if not, this
  // body never runs. SECONDARY defence-in-depth: refuse an obviously-live
  // target before opening any connection, so even an opted-in run is backstopped.
  assertSafeDbTarget(DB_URL);

  // Lazy-require so the file still loads (and skips cleanly) on a box with no
  // deps installed. data.js reads its own Pool from process.env.ASDAIR_DB_URL.
  const { Client } = require('pg');
  const data = require('../data.js');
  const { planBasket } = require('../planner.js');

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const q = function (sql, params) { return client.query(sql, params); };

  // Only the cleanup in `finally` may drop the schema, and ONLY once this test
  // has itself (re)created it. If the pre-drop guard below ABORTS, this stays
  // false so `finally` NEVER drops a pre-existing schema it did not create
  // (Finding 5 -- otherwise the guard's own throw would fall into `finally` and
  // destroy the very schema it just refused to clobber).
  let createdSchema = false;

  try {
    // ---- pre-drop safety guard (Finding 5) --------------------------------
    // Never clobber a pre-existing, NON-TEST `asdair` schema. This test DROPs
    // and recreates the literal `asdair` schema, so an opted-in operator who
    // points ASDAIR_DB_URL at a local Postgres that happens to hold a REAL
    // `asdair` copy would lose it. Nothing has been seeded yet, so ANY rows in
    // asdair.households are pre-existing data we did not create: if the table
    // exists AND holds rows, ABORT loudly instead of dropping. Only proceed
    // when the schema is absent or empty. (to_regclass returns null when the
    // table -- or the whole schema -- does not exist, so this is safe on a
    // pristine DB.)
    const pre = await q("select to_regclass('asdair.households') is not null as has_table");
    if (pre.rows[0].has_table) {
      const existing = (await q('select count(*)::int as n from asdair.households')).rows[0].n;
      if (existing > 0) {
        throw new Error(
          'ABORT (Finding 5): asdair.households already exists and contains ' + existing +
          ' row(s) BEFORE seeding. This integration test DROPs and recreates the literal ' +
          '`asdair` schema and refuses to clobber a pre-existing, non-test copy. Point ' +
          'ASDAIR_DB_URL at a throwaway/CI Postgres with no real asdair data.'
        );
      }
    }

    // ---- clean slate: drop and re-apply the committed schema from scratch --
    // Safe: assertSafeDbTarget() + the guard above have proven this is a
    // throwaway DB with no pre-existing asdair data. From here WE own the
    // schema, so cleanup in `finally` may drop it.
    createdSchema = true;
    await q('drop schema if exists asdair cascade');
    const ddl = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await q(ddl); // idempotent: create schema/tables/indexes if not exists

    // ---- seed: SYNTHETIC rows only -------------------------------------
    // Two households: the active one under test, and a DIFFERENT one that
    // owns a product -- so a list line pointing at that foreign product id
    // exercises the #4 cross-household scope mismatch end-to-end.
    const hhTest = (await q(
      "insert into asdair.households (name, display_name) values ('test-household', 'Test Household') returning id"
    )).rows[0].id;
    const hhOther = (await q(
      "insert into asdair.households (name, display_name) values ('other-household', 'Other Household') returning id"
    )).rows[0].id;

    // Budgets: a global default band AND a household-scoped band. loadBudget()
    // must prefer the household band (25-60) over the global (120-150).
    await q('insert into asdair.budget_settings (household_id, min_normal, max_normal, currency) values (null, 120, 150, $1)', ['GBP']);
    await q('insert into asdair.budget_settings (household_id, min_normal, max_normal, currency) values ($1, 25, 60, $2)', [hhTest, 'GBP']);

    // Products: a GLOBAL mapping, a HOUSEHOLD mapping for the active house,
    // and one owned by the OTHER household (the scope-mismatch bait).
    await q(
      'insert into asdair.products (list_term, matched_product, category, household_id) values ($1,$2,$3,null)',
      ['widget a', 'Global Widget A', 'grocery']
    );
    await q(
      'insert into asdair.products (list_term, matched_product, category, household_id) values ($1,$2,$3,$4)',
      ['widget b', 'HH Widget B', 'grocery', hhTest]
    );
    const prodOther = (await q(
      'insert into asdair.products (list_term, matched_product, category, household_id) values ($1,$2,$3,$4) returning id',
      ['widget c', 'Foreign Widget C', 'grocery', hhOther]
    )).rows[0].id;

    // Rules: an INFO row (must be ignored by the planner), a structured
    // needs_decision directive on a term, and a structured map directive.
    await q(
      "insert into asdair.rules (category, rule_text, scope, directive, household_id) values " +
      "('general', 'informational note, no action', 'global', 'info', null)"
    );
    await q(
      "insert into asdair.rules (category, rule_text, scope, directive, match_term, reason, household_id) values " +
      "('produce', 'ask before buying widget d', 'product', 'needs_decision', $1, $2, $3)",
      ['widget d', 'confirm brand before adding', hhTest]
    );
    await q(
      "insert into asdair.rules (category, rule_text, scope, directive, match_term, matched_product, household_id) values " +
      "('mapping', 'widget e maps to the mapped product', 'product', 'map', $1, $2, null)",
      ['widget e', 'Mapped Widget E']
    );

    // Shopping list + line items for the active household.
    const listId = (await q(
      "insert into asdair.shopping_lists (household_id, list_date, status) values ($1, '2026-07-13', 'pending') returning id",
      [hhTest]
    )).rows[0].id;

    // Item 1: plain add (no product mapping exists for this term).
    await q(
      'insert into asdair.shopping_list_items (list_id, item_name, requested_qty, price) values ($1,$2,$3,$4)',
      [listId, 'plain thing', 1, 10.00]
    );
    // Item 2: maps to a product via household-scoped term match.
    await q(
      'insert into asdair.shopping_list_items (list_id, item_name, requested_qty, price) values ($1,$2,$3,$4)',
      [listId, 'widget b', 2, 20.00]
    );
    // Item 3: carries a cross-household matched_product_id (the #4 bait).
    await q(
      'insert into asdair.shopping_list_items (list_id, item_name, matched_product_id, requested_qty) values ($1,$2,$3,$4)',
      [listId, 'widget c thing', prodOther, 1]
    );
    // Item 4: trips the needs_decision directive on its term.
    await q(
      'insert into asdair.shopping_list_items (list_id, item_name, requested_qty) values ($1,$2,$3)',
      [listId, 'widget d', 1]
    );
    // Item 5: mapped to a product by the map directive.
    await q(
      'insert into asdair.shopping_list_items (list_id, item_name, requested_qty, price) values ($1,$2,$3,$4)',
      [listId, 'widget e', 1, 5.00]
    );

    // ---- exercise the REAL read-only adapter + REAL pure planner -------
    const list = await data.loadList('2026-07-13', 'test-household');
    const rules = await data.loadRules();
    const products = await data.loadProducts();
    const budget = await data.loadBudget('test-household');

    // Sanity: loadBudget picked the household band, not the global default.
    assert.equal(Number(budget.min_normal), 25, 'loadBudget must return the household band (min 25)');
    assert.equal(Number(budget.max_normal), 60, 'loadBudget must return the household band (max 60)');

    const plan = planBasket({
      listItems: list.listItems,
      rules: rules,
      products: products,
      budget: budget
    });

    // Index the plan items by name for order-independent assertions.
    const byName = Object.create(null);
    plan.items.forEach(function (it) { byName[it.item_name] = it; });

    // Item 1 -- plain add, no mapping.
    assert.equal(byName['plain thing'].status, 'add', 'plain item plans to add');
    assert.equal(byName['plain thing'].matched_product, null, 'plain item has no matched product');
    assert.ok(
      byName['plain thing'].flags.indexOf('no explicit product mapping') !== -1,
      'plain item is flagged as unmapped'
    );

    // Item 2 -- maps to the household product via term match.
    assert.equal(byName['widget b'].status, 'add', 'mapped item plans to add');
    assert.equal(byName['widget b'].matched_product, 'HH Widget B', 'mapped item resolves to the household product');
    assert.equal(byName['widget b'].planned_qty, 2, 'mapped item carries its requested qty');

    // Item 3 -- cross-household matched_product_id: #4 scope mismatch,
    // proven end-to-end THROUGH the DB (the id resolves to a product owned by
    // hhOther, so the planner refuses it and sends it to a human).
    assert.equal(byName['widget c thing'].status, 'needs_decision', 'cross-household id -> needs_decision');
    assert.ok(
      byName['widget c thing'].flags.indexOf('product id household scope mismatch') !== -1,
      'cross-household id carries the scope-mismatch flag'
    );
    assert.ok(
      byName['widget c thing'].flags.indexOf('never auto-substitute') !== -1,
      'scope-mismatch line is never auto-substituted'
    );
    assert.equal(byName['widget c thing'].matched_product, null, 'foreign product is never accepted');

    // Item 4 -- trips the needs_decision directive.
    assert.equal(byName['widget d'].status, 'needs_decision', 'directive item -> needs_decision');
    assert.ok(
      byName['widget d'].flags.indexOf('flagged by rule') !== -1,
      'directive item carries the flagged-by-rule flag'
    );

    // Item 5 -- mapped by the map directive.
    assert.equal(byName['widget e'].status, 'add', 'map-directive item plans to add');
    assert.equal(byName['widget e'].matched_product, 'Mapped Widget E', 'map directive sets the matched product');
    assert.ok(
      byName['widget e'].flags.indexOf('product mapped by rule') !== -1,
      'map-directive item carries the mapped-by-rule flag'
    );

    // ---- summary counts ------------------------------------------------
    assert.equal(plan.summary.total_requested, 5, 'five distinct list lines');
    assert.equal(plan.summary.planned_add, 3, 'three lines plan to add');
    assert.equal(plan.summary.needs_decision, 2, 'two lines need a human decision');
    assert.equal(plan.summary.excluded, 0, 'no exclusions in this list');
    // 10.00*1 + 20.00*2 + 5.00*1 = 55.00, within the household band [25,60].
    assert.equal(plan.summary.estimated_total, 55, 'basket estimate sums the add lines');
    assert.equal(plan.summary.currency, 'GBP', 'currency carried from the budget row');
    assert.equal(plan.summary.budget_flag, 'within', 'basket sits within the household budget band');
  } finally {
    // Drop the throwaway schema ONLY if THIS test created it (createdSchema).
    // If the pre-drop guard aborted, createdSchema is false and we must NOT
    // drop the pre-existing schema we just refused to clobber (Finding 5).
    // Always close BOTH the raw client and the adapter's pool so node --test
    // exits cleanly, regardless.
    if (createdSchema) {
      try { await q('drop schema if exists asdair cascade'); } catch (e) { /* best-effort */ }
    }
    try { await client.end(); } catch (e) { /* best-effort */ }
    try { await data.close(); } catch (e) { /* best-effort */ }
  }
});
