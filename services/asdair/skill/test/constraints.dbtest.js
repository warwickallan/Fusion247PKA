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
// GATED (two independent layers -- this test runs DROP SCHEMA ... CASCADE,
// so it is destructive and stays INERT by default):
//   * PRIMARY, POSITIVE OPT-IN: it runs ONLY when the operator has EXPLICITLY
//     opted in by setting ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE to exactly "1" or
//     "true" (a dedicated, single-purpose marker -- see dbSafeTarget.js).
//   * AND ASDAIR_DB_URL must also be set (where to run).
//   Missing EITHER -> the test is a NO-OP (skipped), never a failure and
//   never a destructive run. So even a box whose ASDAIR_DB_URL happens to
//   point somewhere stays inert until the operator explicitly opts in. A
//   laptop with no Postgres stays green.
//
// SAFETY:
//   * The explicit opt-in above is the PRIMARY gate: it does not trust any
//     hostname / db-name heuristic (a `localhost` can be a tunnel to prod; a
//     live DB can be named `*_test`). Without the marker, nothing connects.
//   * assertSafeDbTarget() (shared with integration.dbtest.js) is a SECONDARY
//     defence-in-depth backstop that runs AFTER the opt-in gate passes and
//     REFUSES (throws) if ASDAIR_DB_URL still points anywhere that could be
//     live: any host containing 'supabase' or 'pooler', or any non-local host
//     that is not an explicit *_test database. Only host / db-name are
//     inspected; credentials are never read out or logged. So even an
//     opted-in run can never CREATE/DROP a throwaway schema on a live host.
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
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:5432/postgres \
//     node --test test/constraints.dbtest.js
//   (from services/asdair/skill). Without the explicit opt-in marker (or
//   with ASDAIR_DB_URL unset) it no-ops.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// SAFETY GATING (shared, one source of truth with integration.dbtest.js).
// destructiveTestsEnabled() is the PRIMARY, positive opt-in; assertSafeDbTarget()
// is the SECONDARY defence-in-depth host check applied after the opt-in passes.
const { assertSafeDbTarget, destructiveTestsEnabled } = require('./dbSafeTarget.js');

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

// Gate object shared by the test: skip=false runs it, skip=<string> records
// the reason and no-ops. This is a DESTRUCTIVE test, so it runs ONLY when the
// operator has EXPLICITLY opted in (ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1|true)
// AND ASDAIR_DB_URL is set. Missing EITHER -> clean skip, never a DDL run.
const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : { skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres constraint test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres constraint test skipped (no-op)' };

// Deterministic throwaway schema name. It is dropped-if-exists before AND
// after the run, so a crashed prior run cannot poison this one, and it is
// never the real `asdair` schema.
const TEST_SCHEMA = 'asdair_test_constraints';

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', '001_asdair_schema.sql');

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
  // The gate above already proved the operator explicitly opted in
  // (ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE) AND ASDAIR_DB_URL is set; if not, this
  // body never runs. As a SECONDARY defence-in-depth backstop, refuse an
  // obviously-live target BEFORE opening any connection or running any DDL,
  // so even an opted-in run can never CREATE/DROP a schema on a live host.
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

    // PR #36 Fable finding #2: prove the REORDERED index (collapse whitespace
    // FIRST, then btrim) rejects non-space leading/trailing whitespace that
    // normaliseTerm folds away. These FAIL against the pre-fix index, which
    // btrim'd (spaces only) BEFORE collapsing and so left a leading tab/newline
    // as a distinguishing leading space -> no collision.
    await t.test('REJECT: GLOBAL duplicate with a leading TAB (normalises identically)', async function () {
      await reset();
      await insertProduct('Widget A', null);
      await expectUniqueViolation(
        insertProduct('\twidget a', null),
        'a leading-tab variant normalises to the same term and must collide (global)'
      );
    });

    await t.test('REJECT: GLOBAL duplicate with surrounding NEWLINES (normalises identically)', async function () {
      await reset();
      await insertProduct('Widget A', null);
      await expectUniqueViolation(
        insertProduct('\nwidget   a\n', null),
        'a newline-wrapped variant normalises to the same term and must collide (global)'
      );
    });

    await t.test('REJECT: HOUSEHOLD duplicate with trailing whitespace incl. TAB (normalises identically)', async function () {
      await reset();
      await insertProduct('Widget A', householdId);
      await expectUniqueViolation(
        insertProduct('widget a \t', householdId),
        'a trailing-whitespace variant normalises to the same term and must collide (household)'
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
