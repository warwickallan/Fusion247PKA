// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/provenanceConstraints.dbtest.js
//
// WO-2026-08-11-B15-VISION-01, AC3 (= acceptance_property):
//   "a PHOTO-provenance row asserting no resolvable source_region is
//    structurally unstorable - not merely rejected by application code -
//    verified by an executed test that attempts exactly this insert against
//    Silas's CHECK+composite-FK design and asserts the database itself
//    refuses it."
//
// This test bypasses lineProvenance.js entirely and issues the raw INSERT
// itself, on purpose: the claim is about what asdair.shop_line_provenance
// (migration 020) itself refuses, not about what this Work Order's own
// application code happens to validate first.
//
// GATED, same two independent layers as
// services/asdair/skill/test/constraints.dbtest.js (read there for the
// pattern; not imported - see test/dbSafeTarget.mjs's header):
//   PRIMARY, positive opt-in: ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1|true.
//   AND: ASDAIR_DB_URL must be set.
//   Missing EITHER -> clean skip, never a destructive run.
//   SECONDARY: assertSafeDbTarget() refuses anything that could be live.
//
// NEVER touches the real `asdair` schema - creates a throwaway schema,
// applies the COMMITTED migrations into it, asserts, drops it in a finally.
// SYNTHETIC data only ("Test Household").
//
// HOW TO RUN (against a throwaway/local Postgres, never live Supabase):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:PORT/postgres \
//     node --test test/provenanceConstraints.dbtest.js
//   (from services/asdair/pipeline). Without the opt-in it no-ops.
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

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres constraint test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres constraint test skipped (no-op)',
  };

const TEST_SCHEMA = 'asdair_test_wo_vision_provenance';

test('AC3 acceptance_property: a PHOTO row with no source_region is refused by Silas\'s CHECK+FK, at the database', gate, async (t) => {
  assertSafeDbTarget(DB_URL);

  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    await dropThrowawaySchema(client, TEST_SCHEMA); // clean slate even after a crashed prior run
    await applyThrowawaySchema(client, TEST_SCHEMA);

    const S = TEST_SCHEMA;

    const household = (await client.query(
      `INSERT INTO ${S}.households (name) VALUES ('Test Household - WO-2026-08-11-B15-VISION-01') RETURNING id`,
    )).rows[0];

    const shop = (await client.query(
      `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-AC3', 'photo') RETURNING id`,
      [household.id],
    )).rows[0];

    await t.test('THE ACCEPTANCE_PROPERTY: PHOTO + NULL source_region_id is refused, exactly as claimed', async () => {
      let captured = null;
      await assert.rejects(
        client.query(
          `INSERT INTO ${S}.shop_line_provenance ` +
          '(shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text) ' +
          "VALUES ($1, 'PHOTO', NULL, 'gpt-5.6-terra', 'v1', 'Cravendale Milk 2L')",
          [shop.id],
        ),
        (err) => {
          captured = err;
          // 23514 = check_violation. This is the real Postgres SQLSTATE, not
          // an application-level guess at what "should" happen.
          assert.equal(err.code, '23514', 'expected a CHECK-constraint violation (23514)');
          assert.match(err.constraint || '', /shop_line_provenance_region_iff_photo/);
          return true;
        },
      );
      // REQUIRED EVIDENCE: the exact failing-insert output, pasted verbatim
      // into this Work Order's return - captured here as the actual thrown
      // Postgres error, not a paraphrase.
      // eslint-disable-next-line no-console
      console.log('AC3 CAPTURED DATABASE ERROR:', JSON.stringify({
        code: captured.code, constraint: captured.constraint, message: captured.message, table: captured.table,
      }));
    });

    await t.test('POSITIVE CONTROL: the SAME insert succeeds once a real, persisted source_region_id is given', async () => {
      const region = (await client.query(
        `INSERT INTO ${S}.shop_image_region (shop_id, region_no, region_kind) VALUES ($1, 1, 'full_page') RETURNING id`,
        [shop.id],
      )).rows[0];

      const inserted = await client.query(
        `INSERT INTO ${S}.shop_line_provenance ` +
        '(shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text) ' +
        "VALUES ($1, 'PHOTO', $2, 'gpt-5.6-terra', 'v1', 'Cravendale Milk 2L') RETURNING id",
        [shop.id, region.id],
      );
      assert.equal(inserted.rows.length, 1, 'a PHOTO row WITH a real region must be accepted, proving the CHECK is precise, not blanket-refusing');
    });

    await t.test('THE FK HALF: a source_region_id that does not belong to THIS shop is also refused', async () => {
      const otherShop = (await client.query(
        `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-AC3-OTHER', 'photo') RETURNING id`,
        [household.id],
      )).rows[0];
      const foreignRegion = (await client.query(
        `INSERT INTO ${S}.shop_image_region (shop_id, region_no, region_kind) VALUES ($1, 1, 'full_page') RETURNING id`,
        [otherShop.id],
      )).rows[0];

      await assert.rejects(
        client.query(
          `INSERT INTO ${S}.shop_line_provenance ` +
          '(shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text) ' +
          "VALUES ($1, 'PHOTO', $2, 'gpt-5.6-terra', 'v1', 'Cravendale Milk 2L')",
          [shop.id, foreignRegion.id],
        ),
        (err) => {
          // 23503 = foreign_key_violation - the composite FK
          // (source_region_id, shop_id) refuses a region belonging to a
          // DIFFERENT shop, which is the "not merely exists somewhere but
          // belongs to THIS shop" half of the anti-hallucination design.
          assert.equal(err.code, '23503');
          assert.match(err.constraint || '', /shop_line_provenance_region_fk/);
          return true;
        },
      );
    });
  } finally {
    await dropThrowawaySchema(client, TEST_SCHEMA);
    await client.end();
  }
});
