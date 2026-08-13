// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/provenanceProductionSeam.dbtest.js
//
// WO-2026-08-13-10 (WP-B15-40), AC1 + M2. THREE THINGS THE EXISTING DB PROOFS
// DELIBERATELY DID NOT COVER.
//
//   1. THE PRODUCTION SEAM, AGAINST A REAL DATABASE. regionWiringChain.test.js
//      proves `interpretPhotoWithDeps` calls the writers in the right order,
//      but FAKES both of them ("insertRegionBatch: async () => new Map(...)").
//      lineProvenance.dbtest.js proves the writers persist correctly, but calls
//      them DIRECTLY, never through the orchestrator. Neither exercises the
//      real callers writing real rows. This does.
//
//   2. THE MUTATION PROOF FOR THE COMPOSITE FK. provenanceConstraints.dbtest.js
//      proves a cross-shop region is refused. It cannot show that the COMPOSITE
//      FOREIGN KEY is what refuses it - a CHECK, a trigger or an accident would
//      produce the same red. Here the REAL migration is applied a second time
//      with that ONE constraint removed, and the SAME insert is shown to
//      SUCCEED. A control is not evidence until it has been made to fail.
//
//   3. GRANT PARITY, MEASURED THROUGH THE ENFORCING MECHANISM (M2).
//      lineProvenance.dbtest.js's INSERT-ONLY test reads the MIGRATION TEXT and
//      asserts it contains no UPDATE/DELETE grant - and says so honestly in its
//      own comment, because its superuser connection has no restriction to
//      observe. That is a proof about a FILE, not about a DATABASE. This test
//      connects AS `asdair_rw` and makes Postgres itself refuse the UPDATE and
//      the DELETE. Append-only provenance is the guarantee migration 020 exists
//      to provide; it should be proven, not inferred from a grep.
//
// GATED exactly as its siblings - see test/dbSafeTarget.mjs. Test 3 needs a
// SECOND, separate connection string for the restricted role and skips cleanly
// without one, because a superuser connection cannot prove anything about a
// grant.
//
// HOW TO RUN (throwaway/local Postgres only, never live):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://owner@127.0.0.1:PORT/asdair_test \
//     ASDAIR_DB_RW_URL=postgres://asdair_rw:...@127.0.0.1:PORT/asdair_test \
//     node --test test/provenanceProductionSeam.dbtest.js
//
// PURE ASCII only.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { assertSafeDbTarget, destructiveTestsEnabled } from './dbSafeTarget.mjs';
import { applyThrowawaySchema, dropThrowawaySchema } from './dbtestSchema.mjs';
import { interpretPhotoWithDeps } from '../interpretPhotoOrchestrator.js';
import { insertRegionBatch } from '../shopImageRegions.js';
import { insertPhotoProvenanceBatch } from '../lineProvenance.js';
import { runSanityChecks } from '../photoSanityChecks.js';
import { needsFollowUp, flaggedRegionsForFollowUp } from '../followUpTrigger.js';

const require = createRequire(import.meta.url);
const { buildGroundedPrompt } = require('../../interpret/groundedPrompt.js');

const DB_URL = process.env.ASDAIR_DB_URL;
const RW_URL = process.env.ASDAIR_DB_RW_URL;
const OPTED_IN = destructiveTestsEnabled();

const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres test skipped (no-op)',
  };

const SEAM_SCHEMA = 'asdair_test_wo_b15_40_seam';
const MUTANT_SCHEMA = 'asdair_test_wo_b15_40_fk_removed';

/**
 * The catalogue and the model response are built from REAL persisted regulars
 * ids, not from literals.
 *
 * `shop_line_provenance.matched_regular_id` carries a foreign key to
 * `asdair.regulars`, so a fixture citing an id that was never inserted is
 * refused by the database - correctly, and it refused this test's first draft.
 * The ids therefore have to come from rows that exist.
 */
function catalogueFor(milkId) {
  return {
    candidates: [{ id: milkId, name: 'Cravendale Arla Semi Skimmed Milk 2L', brand: 'Cravendale', aka: ['cravendale'] }],
    rules: [],
    last_order: { lines: [] },
  };
}

/**
 * The I/O boundary only - no sharp, no vision model (vision is PARKED), no
 * network. Everything that decides anything is REAL, and critically the two
 * WRITERS are real and backed by the real client.
 */
function realWriterCollaborators(deps, milkId, otherId) {
  return {
    prepareImage: () => ({
      // 16 LOWERCASE HEX chars - shopImageRegions.js validates this shape and
      // refuses anything else. A memorable-looking non-hex string is rejected.
      rotate: 0, flip: null, imageFingerprint: 'a1b2c3d4e5f60718',
      regions: [
        { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null },
        { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 },
        { region_no: 3, region_kind: 'strip', pixel_top: 600, pixel_left: 0, pixel_bottom: 1300, pixel_right: 1000 },
      ],
    }),
    renderAllRegions: async (buf, transform, regions) => regions.map((r) => ({ region_no: r.region_no, buffer: Buffer.from('rendered-' + r.region_no) })),
    toDataUrl: (buf) => 'data:image/jpeg;base64,' + buf.toString('utf8'),
    buildGroundedPrompt,
    vision: async () => JSON.stringify({
      lines: [
        { line_no: 1, raw_reading: 'CRAVENDALE MILK 2L', quantity: 2, matched_regular_id: milkId, confidence: 0.9, status: 'matched', source_region: 2 },
        { line_no: 2, raw_reading: 'ARLA SEMI SKIMMED', quantity: 1, matched_regular_id: otherId, confidence: 0.9, status: 'matched', source_region: 3 },
      ],
    }),
    extractJson: async (text) => JSON.parse(text),
    runSanityChecks,
    needsFollowUp,
    flaggedRegionsForFollowUp,
    // THE POINT OF THIS FILE: the REAL writers, against the REAL database.
    insertRegionBatch,
    insertPhotoProvenanceBatch,
    writeQuery: deps.writeQuery,
  };
}

test('AC1: the REAL production callers persist regions and PHOTO provenance, in order, against real migration 020', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const S = SEAM_SCHEMA;
  const deps = { writeQuery: async (sql, params) => client.query(sql.replace(/asdair\./g, S + '.'), params) };

  try {
    await dropThrowawaySchema(client, S);
    await applyThrowawaySchema(client, S);

    const household = (await client.query(`INSERT INTO ${S}.households (name) VALUES ('Test Household - WP-B15-40') RETURNING id`)).rows[0];
    const shop = (await client.query(
      `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-B15-40', 'photo') RETURNING id`, [household.id],
    )).rows[0];

    const milk = (await client.query(
      `INSERT INTO ${S}.regulars (household_id, name, active) VALUES ($1, 'Cravendale Arla Semi Skimmed Milk 2L', true) RETURNING id`, [household.id],
    )).rows[0];
    const other = (await client.query(
      `INSERT INTO ${S}.regulars (household_id, name, active) VALUES ($1, 'Arla BOB Semi Skimmed 2L', true) RETURNING id`, [household.id],
    )).rows[0];

    let result;
    await t.test('interpretPhotoWithDeps drives both real writers through the deps.js seam', async () => {
      result = await interpretPhotoWithDeps(
        {
          catalogue: catalogueFor(milk.id), imageBuffer: Buffer.from('photo'), shopId: shop.id,
          interpreterModel: 'frozen-run:wp1534-final (vision PARKED at 54c3b0b)', promptVersion: 'wo-b15-40',
        },
        realWriterCollaborators(deps, milk.id, other.id),
      );
      assert.equal(result.lines.length, 2);
      assert.equal(result.lines[0].source_region, 2, 'source_region must survive the orchestrator return');
    });

    await t.test('the region rows actually landed, and belong to THIS shop', async () => {
      const rows = (await client.query(
        `SELECT id, region_no, region_kind, shop_id FROM ${S}.shop_image_region WHERE shop_id = $1 ORDER BY region_no`, [shop.id],
      )).rows;
      assert.equal(rows.length, 3, 'three planned regions must be persisted by the real insertRegionBatch');
      assert.equal(rows[0].region_kind, 'full_page');
      assert.ok(rows.every((r) => Number(r.shop_id) === Number(shop.id)));
    });

    await t.test('the PHOTO provenance rows landed, each grounded in a region of THIS shop', async () => {
      const rows = (await client.query(
        `SELECT p.id, p.provenance, p.source_region_id, p.raw_text, p.superseded_by_id,
                r.shop_id AS region_shop_id, r.region_no
           FROM ${S}.shop_line_provenance p
           JOIN ${S}.shop_image_region r ON r.id = p.source_region_id
          WHERE p.shop_id = $1 ORDER BY p.id`, [shop.id],
      )).rows;

      // THE FOLLOW-UP PASS FIRED, and that is real production behaviour rather
      // than noise: region 1 (full_page) returned no lines, so
      // followUpTrigger.silentRegions flagged it and the orchestrator ran a
      // second interpretation, writing a second batch and marking the
      // supersession. An earlier draft of this test asserted a flat two rows
      // and failed - the ASSERTION was wrong, not the pipeline. Asserting the
      // CURRENT rows is the claim that actually matters.
      assert.equal(result.followUpFired, true,
        'this fixture deliberately exercises the follow-up path, so the seam proof covers the re-write too');

      assert.ok(rows.length >= 2, 'the real batch writer must have persisted provenance rows');
      assert.ok(rows.every((r) => r.provenance === 'PHOTO'));
      assert.ok(rows.every((r) => Number(r.region_shop_id) === Number(shop.id)),
        'every PHOTO row must be grounded in a region of its OWN shop - that is the whole guarantee');

      const current = rows.filter((r) => r.superseded_by_id === null);
      assert.equal(current.length, 2,
        'exactly one CURRENT provenance row per interpreted line - supersession must leave no ambiguity '
        + `about which reading stands (got ${current.length} of ${rows.length} total)`);
      assert.deepEqual(current.map((r) => r.region_no).sort(), [2, 3],
        'the current rows must cite the STRIP regions the model actually read, not region 1 by default');

      // Every superseded row must name a superseder that is itself a row of
      // THIS shop - the second composite FK, exercised through the real writer.
      const supersededIds = new Set(rows.map((r) => String(r.id)));
      for (const r of rows.filter((x) => x.superseded_by_id !== null)) {
        assert.ok(supersededIds.has(String(r.superseded_by_id)),
          'a superseded row must point at a real row of this same shop');
      }
    });

    await t.test('ORDERING IS ENFORCED BY THE DATABASE: provenance cannot precede its region', async () => {
      // If the seam ever wrote provenance BEFORE regions, the composite FK
      // would reject it. Proven by attempting exactly that ordering.
      const otherShop = (await client.query(
        `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-B15-40-ORDER', 'photo') RETURNING id`, [household.id],
      )).rows[0];
      await assert.rejects(
        client.query(
          `INSERT INTO ${S}.shop_line_provenance (shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text)
             VALUES ($1, 'PHOTO', 999999, 'm', 'v', 'a line whose region was never written')`, [otherShop.id],
        ),
        (err) => {
          assert.equal(err.code, '23503', 'expected a foreign_key_violation');
          assert.match(err.constraint || '', /shop_line_provenance_region_fk/);
          return true;
        },
      );
    });
  } finally {
    await dropThrowawaySchema(client, S);
    await client.end();
  }
});

test('AC1 MUTATION PROOF: with the composite FK removed, the cross-shop row is ACCEPTED - so the FK is what refuses it', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const S = MUTANT_SCHEMA;
  // The constraint name carries the throwaway schema's prefix by the time the
  // transform sees it (dbtestSchema.rewriteForSchema runs first), so the anchor
  // must tolerate it. `[a-z0-9_]*` is what makes this survive that rewrite.
  const FK_BLOCK = /if not exists \(select 1 from pg_constraint where conname = '[a-z0-9_]*shop_line_provenance_region_fk'\) then[\s\S]*?end if;/;

  try {
    await dropThrowawaySchema(client, S);

    let mutationApplied = false;
    await applyThrowawaySchema(client, S, {
      transform: (sql, file) => {
        if (!file.startsWith('020_')) return sql;
        const mutated = sql.replace(FK_BLOCK, 'null;');
        // A mutation that did not mutate proves nothing and must never be
        // reported as a passing proof.
        if (mutated !== sql) mutationApplied = true;
        return mutated;
      },
    });
    assert.equal(mutationApplied, true,
      'the composite-FK block was NOT found in migration 020 - this mutation proof is stale and proves nothing');

    // SCOPED TO THE MUTANT SCHEMA. An unqualified `pg_constraint` lookup is the
    // very defect this Work Order found in migration 020's own guard, and
    // repeating it here would make this proof lie in the same way.
    const absent = (await client.query(
      `SELECT 1 FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND c.conname LIKE '%shop_line_provenance_region_fk'`, [S],
    )).rows;
    assert.equal(absent.length, 0, 'the mutant schema must genuinely lack the composite FK');

    const household = (await client.query(`INSERT INTO ${S}.households (name) VALUES ('Test Household - mutant') RETURNING id`)).rows[0];
    const shop = (await client.query(`INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-MUTANT-A', 'photo') RETURNING id`, [household.id])).rows[0];
    const otherShop = (await client.query(`INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-MUTANT-B', 'photo') RETURNING id`, [household.id])).rows[0];
    const foreignRegion = (await client.query(
      `INSERT INTO ${S}.shop_image_region (shop_id, region_no, region_kind) VALUES ($1, 1, 'full_page') RETURNING id`, [otherShop.id],
    )).rows[0];

    await t.test('the exact insert provenanceConstraints.dbtest.js proves is REFUSED now SUCCEEDS', async () => {
      const inserted = await client.query(
        `INSERT INTO ${S}.shop_line_provenance (shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text)
           VALUES ($1, 'PHOTO', $2, 'gpt-5.6-terra', 'v1', 'a line citing ANOTHER shop''s photograph') RETURNING id`,
        [shop.id, foreignRegion.id],
      );
      assert.equal(inserted.rows.length, 1,
        'without the composite FK the database accepts a line grounded in a DIFFERENT shop\'s photograph. '
        + 'That is what the constraint is preventing, and this is the evidence that it - and nothing else - prevents it.');
    });
  } finally {
    await dropThrowawaySchema(client, S);
    await client.end();
  }
});

test('M2: append-only is enforced BY POSTGRES for asdair_rw - SELECT and INSERT succeed, UPDATE and DELETE are refused', {
  skip: gate.skip || (!RW_URL && 'ASDAIR_DB_RW_URL not set -- the restricted-role grant probe needs a NON-superuser connection to prove anything'),
}, async (t) => {
  assertSafeDbTarget(DB_URL);
  assertSafeDbTarget(RW_URL);
  const { Client } = require('pg');

  // Setup runs as the OWNER, because asdair_rw deliberately holds no INSERT on
  // `households`. The PROOF runs as asdair_rw. Keeping the two roles apart is
  // the point of the test.
  const owner = new Client({ connectionString: DB_URL });
  const rw = new Client({ connectionString: RW_URL });
  await owner.connect();
  await rw.connect();

  try {
    // UNIQUE PER RUN. `asdair.households.name` is unique, asdair_rw holds no
    // DELETE anywhere (which is the very thing under test), and this schema is
    // NOT dropped afterwards - so a fixed name passes once and fails forever
    // after. It did exactly that on the second run.
    const household = (await owner.query(
      'INSERT INTO asdair.households (name) VALUES ($1) RETURNING id',
      [`Test Household - WP-B15-40 grant probe ${Date.now()}-${process.pid}`],
    )).rows[0];

    // Everything below is asdair_rw's own work, on the REAL asdair schema of
    // the DISPOSABLE cluster.
    const shop = (await rw.query(
      "INSERT INTO asdair.shop (household_id, shop_ref, source_kind) VALUES ($1, $2, 'photo') RETURNING id",
      [household.id, `SHOP-GRANT-PROBE-${Date.now()}`],
    )).rows[0];
    const region = (await rw.query(
      "INSERT INTO asdair.shop_image_region (shop_id, region_no, region_kind) VALUES ($1, 1, 'full_page') RETURNING id",
      [shop.id],
    )).rows[0];
    const prov = (await rw.query(
      `INSERT INTO asdair.shop_line_provenance (shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text)
         VALUES ($1, 'PHOTO', $2, 'grant-probe', 'v1', 'append-only probe') RETURNING id`,
      [shop.id, region.id],
    )).rows[0];

    await t.test('asdair_rw CAN read and append provenance - the boundary is not simply closed', async () => {
      const rows = (await rw.query('SELECT id, provenance FROM asdair.shop_line_provenance WHERE id = $1', [prov.id])).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].provenance, 'PHOTO');
    });

    await t.test('asdair_rw CANNOT UPDATE a provenance row - refused by Postgres, not by application code', async () => {
      await assert.rejects(
        rw.query("UPDATE asdair.shop_line_provenance SET raw_text = 'rewritten history' WHERE id = $1", [prov.id]),
        (err) => {
          assert.equal(err.code, '42501', `expected insufficient_privilege (42501), got ${err.code}`);
          return true;
        },
      );
    });

    await t.test('asdair_rw CANNOT DELETE a provenance row - evidence cannot be destroyed by the writer', async () => {
      await assert.rejects(
        rw.query('DELETE FROM asdair.shop_line_provenance WHERE id = $1', [prov.id]),
        (err) => {
          assert.equal(err.code, '42501', `expected insufficient_privilege (42501), got ${err.code}`);
          return true;
        },
      );
    });

    await t.test('the same append-only boundary holds for shop_image_region', async () => {
      await assert.rejects(
        rw.query("UPDATE asdair.shop_image_region SET region_kind = 'strip' WHERE id = $1", [region.id]),
        (err) => { assert.equal(err.code, '42501'); return true; },
      );
      await assert.rejects(
        rw.query('DELETE FROM asdair.shop_image_region WHERE id = $1', [region.id]),
        (err) => { assert.equal(err.code, '42501'); return true; },
      );
    });

    await t.test('the row survived every attempt to change or remove it', async () => {
      const rows = (await rw.query('SELECT raw_text FROM asdair.shop_line_provenance WHERE id = $1', [prov.id])).rows;
      assert.equal(rows.length, 1, 'the provenance row must still exist');
      assert.equal(rows[0].raw_text, 'append-only probe', 'and must still say exactly what it said when written');
    });
  } finally {
    await rw.end();
    await owner.end();
  }
});
