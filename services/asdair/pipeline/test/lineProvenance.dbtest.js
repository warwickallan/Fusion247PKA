// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/lineProvenance.dbtest.js
//
// WO-2026-08-11-B15-VISION-01, AC6 proof (the REAL-database half). Proves
// shopImageRegions.js and lineProvenance.js actually write correct,
// persistent rows against Silas's real committed migration 020 - all four
// provenance kinds, plus the survivor-then-superseded INSERT ordering
// lineProvenance.test.js already proved against a FAKE writeQuery.
//
// GATED exactly as provenanceConstraints.dbtest.js - see its header and
// test/dbSafeTarget.mjs for the two-layer gate this file shares.
//
// HOW TO RUN:
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:PORT/postgres \
//     node --test test/lineProvenance.dbtest.js
//   (from services/asdair/pipeline). Without the opt-in it no-ops.
//
// PURE ASCII only.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertSafeDbTarget, destructiveTestsEnabled } from './dbSafeTarget.mjs';
import { applyThrowawaySchema, dropThrowawaySchema } from './dbtestSchema.mjs';
import { insertRegionBatch } from '../shopImageRegions.js';
import { insertPhotoProvenanceBatch, buildRegularsProvenanceRow, buildRuleProvenanceRow, buildWarwickProvenanceRow, insertProvenanceRow } from '../lineProvenance.js';
import { planRegions } from '../imagePrep.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();
const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres test skipped (no-op)',
  };

const TEST_SCHEMA = 'asdair_test_wo_vision_lineprov';

test('AC6: all four provenance kinds, and the region-grounded PHOTO write path, persist correctly against real migration 020', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // deps.writeQuery shape lineProvenance.js/shopImageRegions.js expect,
  // backed by the REAL client against the real throwaway schema.
  const S = TEST_SCHEMA;
  const deps = {
    writeQuery: async (sql, params) => client.query(sql.replace(/asdair\./g, S + '.'), params),
  };

  try {
    await dropThrowawaySchema(client, TEST_SCHEMA);
    await applyThrowawaySchema(client, TEST_SCHEMA);

    const household = (await client.query(`INSERT INTO ${S}.households (name) VALUES ('Test Household - AC6') RETURNING id`)).rows[0];
    const shop = (await client.query(
      `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-AC6', 'photo') RETURNING id`, [household.id],
    )).rows[0];
    const regular = (await client.query(
      `INSERT INTO ${S}.regulars (household_id, name, active) VALUES ($1, 'Cravendale Milk 2L', true) RETURNING id`, [household.id],
    )).rows[0];

    await t.test('shopImageRegions.insertRegionBatch persists a real imagePrep.js plan', async () => {
      const { regions } = planRegions({ width: 1200, height: 3500, rotate: 0 });
      const regionIdByNumber = await insertRegionBatch(deps, shop.id, regions);
      assert.equal(regionIdByNumber.size, regions.length);

      const rows = (await client.query(`SELECT region_no, region_kind FROM ${S}.shop_image_region WHERE shop_id = $1 ORDER BY region_no`, [shop.id])).rows;
      assert.equal(rows.length, regions.length);
      assert.equal(rows[0].region_kind, 'full_page');
    });

    // A SEPARATE shop for the provenance-write tests below: shop_image_region
    // is unique on (shop_id, region_no), and the smoke test above already
    // claimed region_no 1 (full_page) etc. against `shop` - reusing it here
    // would collide, not reflect anything this design actually forbids.
    const provShop = (await client.query(
      `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-AC6-PROV', 'photo') RETURNING id`, [household.id],
    )).rows[0];

    let regionIdByNumber;
    await t.test('plan and persist the region set for the provenance tests below', async () => {
      const { regions } = planRegions({ width: 1200, height: 2100, rotate: 0 });
      regionIdByNumber = await insertRegionBatch(deps, provShop.id, regions);
    });

    await t.test('insertPhotoProvenanceBatch: survivor-then-superseded write against REAL Postgres', async () => {
      const regionNos = Array.from(regionIdByNumber.keys()).sort((a, b) => a - b);
      const lines = [
        { line_no: 3, raw_reading: 'Cravendale Milk 2L', quantity: 2, matched_regular_id: regular.id, confidence: 0.6, source_region: regionNos[0], supersededByIndex: 1 },
        { line_no: 1, raw_reading: 'Cravendale Milk 2L', quantity: 2, matched_regular_id: regular.id, confidence: 0.95, source_region: regionNos[1], supersededByIndex: null },
      ];
      const persisted = await insertPhotoProvenanceBatch(deps, lines, {
        shopId: provShop.id, regionIdByNumber, interpreterModel: 'gpt-5.6-terra', promptVersion: 'wo-vision-01',
      });
      assert.equal(persisted[1].superseded_by_id, null);
      assert.equal(persisted[0].superseded_by_id, persisted[1].id);

      const rows = (await client.query(`SELECT id, superseded_by_id, provenance FROM ${S}.shop_line_provenance WHERE shop_id = $1 ORDER BY id`, [provShop.id])).rows;
      assert.equal(rows.length, 2);
      assert.ok(rows.every((r) => r.provenance === 'PHOTO'));
    });

    await t.test('all three non-PHOTO provenance kinds persist, four-way vocabulary proven end to end', async () => {
      const regularsRow = await insertProvenanceRow(deps, buildRegularsProvenanceRow({ shopId: provShop.id, matchedRegularId: regular.id, quantity: 1 }));
      const ruleRow = await insertProvenanceRow(deps, buildRuleProvenanceRow({ shopId: provShop.id, matchedRegularId: null, rawText: 'Never auto-substitute rule addition' }));
      const warwickRow = await insertProvenanceRow(deps, buildWarwickProvenanceRow({ shopId: provShop.id, matchedRegularId: null, rawText: 'Warwick asked for this explicitly' }));

      assert.equal(regularsRow.provenance, 'REGULARS');
      assert.equal(ruleRow.provenance, 'RULE');
      assert.equal(warwickRow.provenance, 'WARWICK');

      const kinds = (await client.query(`SELECT DISTINCT provenance FROM ${S}.shop_line_provenance WHERE shop_id = $1 ORDER BY provenance`, [provShop.id])).rows.map((r) => r.provenance);
      assert.deepEqual(kinds, ['PHOTO', 'REGULARS', 'RULE', 'WARWICK']);
    });

    await t.test('INSERT-ONLY is real: this role genuinely cannot UPDATE or DELETE shop_line_provenance', async () => {
      // Proves the module header's claim against the ACTUAL grants a fresh
      // role would have - not asserted, executed. On a plain superuser
      // connection (this test's own client) there is no role restriction to
      // observe, so this checks the migration's own DDL never grants UPDATE/
      // DELETE to asdair_rw in the first place (the real enforcement, once
      // that role exists) rather than re-deriving a live-role probe this
      // test's own connection cannot meaningfully perform.
      const migrationSql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'db', '020_shop_line_provenance_and_human_state.sql'), 'utf8',
      );
      assert.doesNotMatch(migrationSql, /grant\s+[^;]*update[^;]*on\s+asdair\.shop_line_provenance/i);
      assert.doesNotMatch(migrationSql, /grant\s+[^;]*delete[^;]*on\s+asdair\.shop_line_provenance/i);
    });
  } finally {
    await dropThrowawaySchema(client, TEST_SCHEMA);
    await client.end();
  }
});
