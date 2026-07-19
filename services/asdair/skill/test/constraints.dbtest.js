// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: constraints.dbtest.js
//
// Runs under: node --test
//
// LIVE-POSTGRES constraint test for the nullable global-uniqueness fixes
// in db/001_asdair_schema.sql (GPT PR #36 review item #3). It proves the
// two partial unique indexes on asdair.products and the single-global
// index on asdair.budget_settings actually reject duplicate rows.
//
// GATED: this test only runs when ASDAIR_DB_URL is set. Without it the
// test is a NO-OP (skipped), never a failure -- same discipline as the
// gateway's DB-gated tests. So a laptop with no Postgres stays green.
//
// SAFETY:
//   * assertSafeDbTarget() (shared with integration.dbtest.js) runs FIRST and
//     REFUSES (throws) if ASDAIR_DB_URL points anywhere that could be live:
//     any host containing 'supabase' or 'pooler', or any non-local host that
//     is not an explicit *_test database. Only host / db-name are inspected;
//     credentials are never read out or logged. So this test can never
//     CREATE/DROP a throwaway schema on a live database.
//   * NEVER touches the real `asdair` schema or any live data. It creates
//     a throwaway schema (asdair_test_constraints), applies the committed
//     DDL into it (rewriting `asdair.` -> the test schema), asserts, then
//     drops the throwaway schema in a finally block.
//   * SYNTHETIC data only -- invented names like 'Test Household',
//     'Widget A'. No real household / personal data anywhere.
//   * Read-only against production: it opens its own throwaway schema and
//     only ever writes there.
//
// HOW TO RUN (against a throwaway/local Postgres, NOT live Supabase):
//   ASDAIR_DB_URL=postgres://user:pass@localhost:5432/postgres \
//     node --test test/constraints.dbtest.js
//   (from services/asdair/skill). With ASDAIR_DB_URL unset it no-ops.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DB_URL = process.env.ASDAIR_DB_URL;

// Gate object shared by the test: skip=false runs it, skip=<string>
// records the reason and no-ops. When ASDAIR_DB_URL is unset we skip.
const gate = DB_URL
  ? { skip: false }
  : { skip: 'ASDAIR_DB_URL not set -- Postgres constraint test skipped (no-op)' };

// Deterministic throwaway schema name. It is dropped-if-exists before AND
// after the run, so a crashed prior run cannot poison this one, and it is
// never the real `asdair` schema.
const TEST_SCHEMA = 'asdair_test_constraints';

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', '001_asdair_schema.sql');

// SAFETY GUARD (shared, one source of truth with integration.dbtest.js):
// refuse to run against anything that could be live. Only host / db-name are
// inspected; credentials are never read out or logged. Throws (loud failure)
// on an unsafe target -- pointing this test at live Supabase MUST fail, never
// silently proceed, and never CREATE/DROP a throwaway schema on live data.
const { assertSafeDbTarget } = require('./dbSafeTarget.js');

// Rewrite the committed DDL so every object lands in the throwaway schema.
// `create schema if not exists asdair;` and every `asdair.` reference are
// retargeted; nothing in the real `asdair` schema is read or written.
function buildTestDdl(schemaName) {
  const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  return raw
    .replace(/create schema if not exists asdair;/g, 'create schema if not exists ' + schemaName + ';')
    .replace(/asdair\./g, schemaName + '.');
}

test('asdair schema enforces scoped, normalised uniqueness', gate, async function (t) {
  // Safety first: refuse an unsafe target BEFORE opening any connection or
  // running any DDL, so an unsafe ASDAIR_DB_URL can never CREATE/DROP a
  // throwaway schema on a live database.
  assertSafeDbTarget(DB_URL);

  // Lazy-require pg so the file still loads (and skips cleanly) on a box
  // where dependencies were never installed for a DB run.
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const S = TEST_SCHEMA;
  const q = function (sql, params) { return client.query(sql, params); };

  // Assert a query rejects with a Postgres unique_violation (SQLSTATE 23505).
  async function expectUniqueViolation(promise, message) {
    await assert.rejects(promise, function (err) {
      assert.equal(err.code, '23505', message + ' (expected SQLSTATE 23505, got ' + err.code + ')');
      return true;
    }, message);
  }

  async function insertProduct(term, householdId) {
    return q(
      'insert into ' + S + '.products (list_term, matched_product, household_id) values ($1, $2, $3)',
      [term, 'Matched ' + term, householdId]
    );
  }

  async function insertBudget(householdId) {
    return q(
      'insert into ' + S + '.budget_settings (household_id) values ($1)',
      [householdId]
    );
  }

  // Wipe the scoped tables between assertions so each case starts clean,
  // while keeping the synthetic household row (products/budgets FK to it).
  async function reset() {
    await q('truncate ' + S + '.products, ' + S + '.budget_settings restart identity cascade');
  }

  let householdId;
  try {
    // Fresh throwaway schema built purely from the committed migration.
    await q('drop schema if exists ' + S + ' cascade');
    await q(buildTestDdl(S));

    // One synthetic household for the household-scoped cases.
    const hh = await q(
      'insert into ' + S + ".households (name, display_name) values ('test-household', 'Test Household') returning id"
    );
    householdId = hh.rows[0].id;

    await t.test('REJECT: two GLOBAL products with the same normalised term', async function () {
      await reset();
      await insertProduct('Widget A', null);
      // Case + whitespace variant that normalises to the SAME term
      // (lower-case, trim, collapse internal whitespace) -> must collide.
      await expectUniqueViolation(
        insertProduct('  widget   a ', null),
        'second global product for a term that normalises identically must be rejected'
      );
    });

    await t.test('REJECT: two GLOBAL budget rows', async function () {
      await reset();
      await insertBudget(null);
      await expectUniqueViolation(
        insertBudget(null),
        'a second global (household_id IS NULL) budget row must be rejected'
      );
    });

    await t.test('REJECT: two HOUSEHOLD products (same household) with the same normalised term', async function () {
      await reset();
      await insertProduct('Widget A', householdId);
      await expectUniqueViolation(
        insertProduct('WIDGET  a', householdId),
        'a second household product for the same normalised term in the same household must be rejected'
      );
    });

    await t.test('ALLOW: a GLOBAL product AND a HOUSEHOLD product for the same term (different scopes)', async function () {
      await reset();
      await insertProduct('Widget A', null);
      // Same normalised term but household-scoped -> different partial index.
      await insertProduct('Widget A', householdId);
      const rows = await q('select count(*)::int as n from ' + S + '.products');
      assert.equal(rows.rows[0].n, 2, 'a global and a household mapping for the same term must coexist');
    });

    await t.test('ALLOW: two products with genuinely different terms', async function () {
      await reset();
      await insertProduct('Widget A', null);
      await insertProduct('Widget B', null);
      const rows = await q('select count(*)::int as n from ' + S + '.products');
      assert.equal(rows.rows[0].n, 2, 'two distinct terms must both be allowed');
    });
  } finally {
    // Always drop the throwaway schema and close the socket.
    try { await q('drop schema if exists ' + S + ' cascade'); } catch (e) { /* best-effort cleanup */ }
    await client.end();
  }
});
