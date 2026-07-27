// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: outcome.dbtest.js
//
// Runs under: node --test
//
// LIVE-POSTGRES proof for the WRITE side: that recordShopOutcome.js and
// promoteDecision.js actually work against the COMMITTED migrations
// (db/001_asdair_schema.sql + db/004_asdair_regulars.sql) -- the order and
// its events land, checked_out stays false, the rule_qa_log -> rules
// back-link is really written, and the database CHECK constraints bite.
//
// GATED (two independent layers -- this test runs DROP SCHEMA ... CASCADE,
// so it is destructive and stays INERT by default):
//   * PRIMARY, POSITIVE OPT-IN: it runs ONLY when the operator has EXPLICITLY
//     set ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE to exactly "1" or "true".
//   * AND ASDAIR_DB_URL must also be set (where to run).
//   Missing EITHER -> the test is a NO-OP (skipped), never a failure and
//   never a destructive run. A laptop with no Postgres stays green.
//   The gate helpers are REUSED from the skill's test/dbSafeTarget.js so
//   there is ONE source of truth for how a destructive asdair DB test is
//   authorised and refused.
//
// SAFETY:
//   * assertSafeDbTarget() refuses any host that could be live (supabase /
//     pooler / any non-local host that is not an explicit *_test database)
//     BEFORE a connection is opened.
//   * Like skill/test/integration.dbtest.js, this operates on the LITERAL
//     `asdair` schema (the writers are schema-qualified), so it ABORTS
//     before dropping if it finds a pre-existing, non-empty
//     asdair.households -- it refuses to clobber a real local copy.
//   * SYNTHETIC data only: invented households, "Widget A"-style names,
//     invented questions and answers. No real household data anywhere.
//   * It must not run CONCURRENTLY with skill/test/integration.dbtest.js --
//     both re-create the literal `asdair` schema. Run them in separate
//     `node --test` invocations (CI does).
//
// HOW TO RUN (against a throwaway/local Postgres, NOT live Supabase):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:5432/postgres \
//     node --test test/outcome.dbtest.js
//   (from services/asdair/outcome). Without the explicit opt-in marker (or
//   with ASDAIR_DB_URL unset) it no-ops.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ONE source of truth for the destructive-test gating, shared with the
// skill's DB-gated tests. (Read-only reuse; nothing in skill/ is modified.)
const { assertSafeDbTarget, destructiveTestsEnabled } = require('../../skill/test/dbSafeTarget.js');

const { buildOutcome } = require('../buildOutcome.js');
const recorder = require('../recordShopOutcome.js');
const promoter = require('../promoteDecision.js');

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : { skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres outcome test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres outcome test skipped (no-op)' };

const DB_DIR = path.join(__dirname, '..', '..', 'db');
const MIGRATIONS = ['001_asdair_schema.sql', '004_asdair_regulars.sql'];

test('asdair outcome path: clean Postgres -> migrations -> record a shop -> promote a decision', gate, async function (t) {
  // The gate proved the operator explicitly opted in AND ASDAIR_DB_URL is
  // set. SECONDARY defence-in-depth: refuse an obviously-live target before
  // opening any connection or running any DDL.
  assertSafeDbTarget(DB_URL);

  // Lazy-require pg so the file still loads (and skips cleanly) on a box
  // where dependencies were never installed.
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const q = function (sql, params) { return client.query(sql, params); };

  // Only the cleanup in `finally` may drop the schema, and ONLY once this
  // test has itself (re)created it -- so an ABORT below never destroys the
  // very schema it just refused to clobber.
  let createdSchema = false;

  try {
    // ---- pre-drop safety guard ------------------------------------------
    const pre = await q("select to_regclass('asdair.households') is not null as has_table");
    if (pre.rows[0].has_table) {
      const existing = (await q('select count(*)::int as n from asdair.households')).rows[0].n;
      if (existing > 0) {
        throw new Error(
          'ABORT: asdair.households already exists and contains ' + existing +
          ' row(s) BEFORE seeding. This test DROPs and recreates the literal `asdair` schema and ' +
          'refuses to clobber a pre-existing, non-test copy. Point ASDAIR_DB_URL at a throwaway ' +
          'Postgres with no real asdair data.'
        );
      }
    }

    // ---- clean slate: apply the COMMITTED migrations from scratch --------
    createdSchema = true;
    await q('drop schema if exists asdair cascade');
    for (let i = 0; i < MIGRATIONS.length; i++) {
      const ddl = fs.readFileSync(path.join(DB_DIR, MIGRATIONS[i]), 'utf8');
      await q(ddl); // idempotent: create schema/table/index if not exists
    }

    // Applying them a SECOND time must be a no-op (idempotency proof).
    for (let i = 0; i < MIGRATIONS.length; i++) {
      await q(fs.readFileSync(path.join(DB_DIR, MIGRATIONS[i]), 'utf8'));
    }

    // ---- synthetic fixtures ---------------------------------------------
    const householdId = (await q(
      "insert into asdair.households (name, display_name) values ('test-household', 'Test Household') returning id"
    )).rows[0].id;

    const listId = (await q(
      "insert into asdair.shopping_lists (household_id, list_date, status) values ($1, '2026-07-27', 'pending') returning id",
      [householdId]
    )).rows[0].id;

    // =====================================================================
    // 004: asdair.regulars matches what the code expects
    // =====================================================================
    await t.test('004 regulars: columns, defaults and the unique key behave as committed', async function () {
      const reg = (await q(
        'insert into asdair.regulars (household_id, name, category, brand, typical_qty) ' +
        "values ($1, 'Widget A', 'household', 'Generic', 2) returning *",
        [householdId]
      )).rows[0];
      assert.equal(reg.name, 'Widget A');
      assert.equal(reg.source, 'regular');          // column default
      assert.equal(reg.active, true);               // column default
      assert.deepEqual(reg.aka, []);                // text[] default '{}'
      assert.equal(reg.substitutes_allowed, false); // column default
      assert.ok(reg.created_at instanceof Date);

      // UNIQUE (household_id, source, name) bites.
      await assert.rejects(
        q("insert into asdair.regulars (household_id, name) values ($1, 'Widget A')", [householdId]),
        function (err) { assert.equal(err.code, '23505'); return true; }
      );

      // The gin index on aka supports array containment lookups.
      await q("update asdair.regulars set aka = array['widget','widget a deluxe'] where id = $1", [reg.id]);
      const found = await q("select id from asdair.regulars where aka @> array['widget']::text[]");
      assert.equal(found.rows.length, 1);
    });

    // =====================================================================
    // recordShopOutcome: the shop is no longer forgotten
    // =====================================================================
    let orderId;
    await t.test('recordShopOutcome writes the order and its events in one transaction', async function () {
      const outcome = buildOutcome({
        plan: { items: [], summary: { total_requested: 3, budget_flag: 'within' } },
        reconcile: {
          list_id: listId,
          household_id: householdId,
          run_at: '2026-07-27T09:30:00.000Z',
          attempt: 2,
          basket_total: 131.55,
          budget: { min_normal: 120, max_normal: 150 },
          items: [
            { item_name: 'Widget A', status: 'added' },
            { item_name: 'Generic Milk 2L', status: 'added' },
            { item_name: 'Gadget Z', status: 'needs_decision' }
          ],
          events: [
            { event_type: 'info', description: 'run started', occurred_at: '2026-07-27T09:30:00.000Z' },
            { event_type: 'correction', description: 'quantity corrected from 2 to 1' },
            { event_type: 'decision', description: 'Gadget Z out of stock; waiting on a human' }
          ]
        }
      });

      // Uses the module's own pool, built from ASDAIR_DB_URL -- the real path.
      orderId = await recorder.recordShopOutcome(outcome);
      assert.ok(orderId, 'an order id is returned');

      const row = (await q('select * from asdair.orders where id = $1', [orderId])).rows[0];
      assert.equal(String(row.list_id), String(listId));
      assert.equal(String(row.household_id), String(householdId));
      assert.equal(row.total_requested, 3);
      assert.equal(row.total_added, 2);
      assert.equal(row.total_needs_decision, 1);
      assert.equal(Number(row.basket_total), 131.55);
      assert.equal(row.outside_budget_range, false);
      assert.equal(row.attempt, 2);
      // RULE 8, proven at the database: never checked out.
      assert.equal(row.checked_out, false);
      assert.equal(row.checked_out_at, null);

      const events = (await q('select event_type, description, occurred_at from asdair.order_events where order_id = $1 order by id', [orderId])).rows;
      assert.equal(events.length, 3);
      assert.deepEqual(events.map(function (e) { return e.event_type; }), ['info', 'correction', 'decision']);
      // The event with no occurred_at got the database default, not NULL.
      assert.ok(events[1].occurred_at instanceof Date);
    });

    await t.test('the order_events CHECK rejects an out-of-vocabulary event_type at the database', async function () {
      await assert.rejects(
        q("insert into asdair.order_events (order_id, event_type, description) values ($1, 'checkout', 'nope')", [orderId]),
        function (err) { assert.equal(err.code, '23514', 'expected a CHECK violation'); return true; }
      );
    });

    // =====================================================================
    // promoteDecision: the learning loop is no longer dead code
    // =====================================================================
    await t.test('applies_going_forward true promotes a rule and writes the back-link', async function () {
      const res = await promoter.promoteDecision({
        asked_on: '2026-07-27',
        question: 'Should we keep buying Widget A?',
        answer: 'No - stop buying Widget A from now on.',
        applies_going_forward: true,
        household_id: householdId,
        rule: {
          category: 'household',
          rule_text: 'Do not buy Widget A.',
          scope: 'product',
          directive: 'exclude',
          match_term: 'Widget A',
          reason: 'household decided it is not wanted'
        }
      });

      assert.ok(res.logId);
      assert.ok(res.ruleId);

      const log = (await q('select * from asdair.rule_qa_log where id = $1', [res.logId])).rows[0];
      assert.equal(log.applies_going_forward, true);
      assert.equal(String(log.promoted_rule_id), String(res.ruleId), 'the back-link must point at the new rule');

      const rule = (await q('select * from asdair.rules where id = $1', [res.ruleId])).rows[0];
      assert.equal(rule.directive, 'exclude');
      assert.equal(rule.match_term, 'Widget A');
      assert.equal(rule.scope, 'product');
      assert.equal(rule.active, true);
      assert.equal(String(rule.household_id), String(householdId));

      // The promoted rule is one the READ-ONLY skill actually loads: it is
      // active, so loadRules() would return it and the planner would act on it.
      const active = (await q('select count(*)::int as n from asdair.rules where active = true and match_term = $1', ['Widget A'])).rows[0].n;
      assert.equal(active, 1);
    });

    await t.test('applies_going_forward false records the answer and promotes NOTHING', async function () {
      const before = (await q('select count(*)::int as n from asdair.rules')).rows[0].n;

      const res = await promoter.promoteDecision({
        asked_on: '2026-07-27',
        question: 'Skip Widget B this week?',
        answer: 'Yes, just this week.',
        applies_going_forward: false,
        household_id: householdId
      });

      assert.equal(res.ruleId, null);
      const log = (await q('select * from asdair.rule_qa_log where id = $1', [res.logId])).rows[0];
      assert.equal(log.applies_going_forward, false);
      assert.equal(log.promoted_rule_id, null, 'promoted_rule_id must stay null');

      const after = (await q('select count(*)::int as n from asdair.rules')).rows[0].n;
      assert.equal(after, before, 'no rule may be created');
    });

    await t.test('rule 10: a one-week-only decision is refused before anything is written', async function () {
      const logsBefore = (await q('select count(*)::int as n from asdair.rule_qa_log')).rows[0].n;
      const rulesBefore = (await q('select count(*)::int as n from asdair.rules')).rows[0].n;

      await assert.rejects(promoter.promoteDecision({
        asked_on: '2026-07-27',
        question: 'Skip Widget C this week?',
        answer: 'Yes, this week only.',
        applies_going_forward: true,
        one_week_only: true,
        household_id: householdId,
        rule: {
          category: 'household', rule_text: 'Skip Widget C', scope: 'product',
          directive: 'exclude', match_term: 'Widget C'
        }
      }), /one-week-only/);

      assert.equal((await q('select count(*)::int as n from asdair.rule_qa_log')).rows[0].n, logsBefore,
        'a refused promotion writes no log row either');
      assert.equal((await q('select count(*)::int as n from asdair.rules')).rows[0].n, rulesBefore);
    });

    await t.test('the rules CHECK rejects a target-less actionable directive at the database', async function () {
      await assert.rejects(
        q("insert into asdair.rules (category, rule_text, scope, directive) values ('x', 'y', 'global', 'exclude')"),
        function (err) { assert.equal(err.code, '23514'); return true; }
      );
    });
  } finally {
    try { await recorder.close(); } catch (ignore) { /* no-op */ }
    try { await promoter.close(); } catch (ignore) { /* no-op */ }
    if (createdSchema) {
      try { await client.query('drop schema if exists asdair cascade'); } catch (ignore) { /* no-op */ }
    }
    await client.end();
  }
});
