// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/humanState.dbtest.js
//
// WO-2026-08-13-10 (WP-B15-40), AC4. `human_state` IS WRITTEN BY RUNNING CODE,
// PROVEN AGAINST A REAL POSTGRES.
//
// `test/humanState.test.js` (the sibling this file is named after) proves the
// mapping is correct and that `applyTransition` assigns the column in the SAME
// UPDATE as `status` - both asserted against `shop/fakeClient.js`, a scripted
// stand-in. That is a proof about the STATEMENT THIS CODE SENDS.
//
// It is not a proof that the statement is ACCEPTED, that the column exists with
// that name, or that migration 020's six-value CHECK admits exactly the values
// `computeHumanState` produces. A scripted client accepts any SQL at all. This
// file closes that gap by running the REAL `applyTransition` against a REAL
// database and reading the row BACK OUT.
//
// GATED exactly as its siblings - see test/dbSafeTarget.mjs.
//
// HOW TO RUN (throwaway/local Postgres only, never live):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://owner@127.0.0.1:PORT/asdair_test \
//     node --test test/humanState.dbtest.js
//
// PURE ASCII only.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { assertSafeDbTarget, destructiveTestsEnabled } from './dbSafeTarget.mjs';
import { applyThrowawaySchema, dropThrowawaySchema } from './dbtestSchema.mjs';

const require = createRequire(import.meta.url);
const shopStore = require('../../shop/shopStore.js');
const { computeHumanState, HUMAN_STATE_BY_STATUS, applyTransition } = shopStore._internal;

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();
const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres test skipped (no-op)',
  };

const TEST_SCHEMA = 'asdair_test_wo_b15_40_humanstate';

test('AC4: applyTransition writes human_state to a REAL Postgres, and every mapped value survives the CHECK', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const raw = new Client({ connectionString: DB_URL });
  await raw.connect();

  const S = TEST_SCHEMA;
  // shopStore.js writes `asdair.`-qualified SQL. The throwaway schema is
  // addressed the same way every other dbtest here addresses it.
  const client = { query: async (sql, params) => raw.query(sql.replace(/asdair\./g, S + '.'), params) };

  try {
    await dropThrowawaySchema(raw, S);
    await applyThrowawaySchema(raw, S);

    const household = (await raw.query(`INSERT INTO ${S}.households (name) VALUES ('Test Household - AC4') RETURNING id`)).rows[0];

    await t.test('a real status transition durably writes the matching human_state', async () => {
      const shop = (await raw.query(
        `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind, status) VALUES ($1, 'SHOP-AC4-1', 'photo', 'PROCESSING') RETURNING id`,
        [household.id],
      )).rows[0];

      const out = await applyTransition(client, {
        shop_id: shop.id,
        from_status: 'PROCESSING',
        to_status: 'READY_TO_SHOP',
        set: { status: 'READY_TO_SHOP' },
        event: { event_type: 'milestone', from_status: 'PROCESSING', to_status: 'READY_TO_SHOP', description: 'ready' },
      });
      assert.equal(out.shop.status, 'READY_TO_SHOP');

      // READ IT BACK OUT OF POSTGRES. The scripted-client proof cannot do this.
      const row = (await raw.query(`SELECT status, human_state FROM ${S}.shop WHERE id = $1`, [shop.id])).rows[0];
      assert.equal(row.status, 'READY_TO_SHOP');
      assert.equal(row.human_state, computeHumanState('READY_TO_SHOP'));
      assert.equal(row.human_state, 'READY_FOR_WARWICK');
    });

    await t.test('EVERY status the mapping defines produces a human_state the database ACCEPTS', async () => {
      // The mapping and migration 020's six-value CHECK are two independent
      // artefacts that must agree. A value `computeHumanState` can emit but the
      // CHECK refuses would fail only in production, on that one status.
      const statuses = Object.keys(HUMAN_STATE_BY_STATUS);
      assert.ok(statuses.length > 0, 'the status vocabulary must not be empty');

      const accepted = [];
      for (const status of statuses) {
        const shop = (await raw.query(
          `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind, status) VALUES ($1, $2, 'photo', 'PROCESSING') RETURNING id`,
          [household.id, `SHOP-AC4-${status}`],
        )).rows[0];

        await applyTransition(client, {
          shop_id: shop.id,
          from_status: 'PROCESSING',
          to_status: status,
          set: { status },
          event: { event_type: 'milestone', from_status: 'PROCESSING', to_status: status, description: 'ac4 sweep' },
        });

        const row = (await raw.query(`SELECT status, human_state FROM ${S}.shop WHERE id = $1`, [shop.id])).rows[0];
        assert.equal(row.human_state, computeHumanState(status),
          `status ${status} wrote human_state "${row.human_state}", expected "${computeHumanState(status)}"`);
        accepted.push(status);
      }

      assert.equal(accepted.length, statuses.length,
        'every status in the vocabulary must round-trip through the real database');
    });

    await t.test('the CHECK is real: a human_state outside the six is refused by Postgres', async () => {
      const shop = (await raw.query(
        `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind, status) VALUES ($1, 'SHOP-AC4-BAD', 'photo', 'PROCESSING') RETURNING id`,
        [household.id],
      )).rows[0];

      await assert.rejects(
        raw.query(`UPDATE ${S}.shop SET human_state = 'NOT_A_REAL_STATE' WHERE id = $1`, [shop.id]),
        (err) => {
          assert.equal(err.code, '23514', `expected a CHECK violation (23514), got ${err.code}`);
          return true;
        },
      );
    });

    await t.test('the single-writer invariant holds at runtime: ONE UPDATE per transition', async () => {
      const shop = (await raw.query(
        `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind, status) VALUES ($1, 'SHOP-AC4-ONE', 'photo', 'PROCESSING') RETURNING id`,
        [household.id],
      )).rows[0];

      const seen = [];
      const counting = { query: async (sql, params) => { seen.push(sql); return client.query(sql, params); } };
      await applyTransition(counting, {
        shop_id: shop.id,
        from_status: 'PROCESSING',
        to_status: 'FAILED',
        set: { status: 'FAILED' },
        event: { event_type: 'milestone', from_status: 'PROCESSING', to_status: 'FAILED', description: 'failed' },
      });

      const updates = seen.filter((s) => s.indexOf('UPDATE asdair.shop') === 0);
      assert.equal(updates.length, 1, 'human_state must ride the EXISTING update, never add a second one');
      assert.match(updates[0], /human_state = \$\d+/);

      const row = (await raw.query(`SELECT human_state FROM ${S}.shop WHERE id = $1`, [shop.id])).rows[0];
      assert.equal(row.human_state, computeHumanState('FAILED'));
    });
  } finally {
    await dropThrowawaySchema(raw, S);
    await raw.end();
  }
});
