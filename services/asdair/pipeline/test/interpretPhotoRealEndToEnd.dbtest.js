// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/interpretPhotoRealEndToEnd.dbtest.js
//
// WO-2026-08-11-B15-VISION-01 Amendment 3, the CAPSTONE proof: the full
// interpretPhotoWithDeps orchestrator, run with EVERY collaborator REAL
// except the model call itself (no gateway credentials in this Work
// Order's scope - vision()/extractJson are the ONE mocked pair, returning
// a canned response that cites REAL region numbers this run itself
// produced) -
//   * imagePrep.prepareImage - REAL, on a REAL JPEG.
//   * imageRender.renderAllRegions - REAL sharp, real crops.
//   * shopImageRegions.insertRegionBatch / lineProvenance.insertPhotoProvenanceBatch
//     - REAL writes against a real, disposable Postgres.
//   * groundedPrompt.buildGroundedPrompt - REAL.
//
// GATED on BOTH: the DB opt-in (test/dbSafeTarget.mjs) AND sharp being
// installed (mirrors imageRender.test.js's own module-availability gate) -
// missing either is a clean skip, never a failure.
//
// HOW TO RUN:
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgres://user:pass@localhost:PORT/postgres \
//     node --test test/interpretPhotoRealEndToEnd.dbtest.js
//   (from services/asdair/pipeline, with `npm install` run so sharp/pg exist).
//
// PURE ASCII only.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { assertSafeDbTarget, destructiveTestsEnabled } from './dbSafeTarget.mjs';
import { applyThrowawaySchema, dropThrowawaySchema } from './dbtestSchema.mjs';
import { prepareImage } from '../imagePrep.js';
import { runSanityChecks } from '../photoSanityChecks.js';
import { needsFollowUp, flaggedRegionsForFollowUp } from '../followUpTrigger.js';
import { insertRegionBatch } from '../shopImageRegions.js';
import { insertPhotoProvenanceBatch } from '../lineProvenance.js';
import { interpretPhotoWithDeps } from '../interpretPhotoOrchestrator.js';

const require = createRequire(import.meta.url);

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

let imageRender = null;
let sharpImportError = null;
try {
  imageRender = await import('../imageRender.js');
} catch (e) {
  sharpImportError = e;
}

const gate = (OPTED_IN && DB_URL && imageRender)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- skipped (no-op)'
      : !DB_URL
        ? 'ASDAIR_DB_URL not set -- skipped (no-op)'
        : 'sharp is not installed -- skipped (no-op): ' + (sharpImportError && sharpImportError.message),
  };

const TEST_SCHEMA = 'asdair_test_wo_vision_e2e';

test('CAPSTONE: real imagePrep + real sharp rendering + real Postgres writes, wired end to end (model call mocked - no gateway creds)', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const S = TEST_SCHEMA;
  const deps = { writeQuery: async (sql, params) => client.query(sql.replace(/asdair\./g, S + '.'), params) };

  try {
    await dropThrowawaySchema(client, TEST_SCHEMA);
    await applyThrowawaySchema(client, TEST_SCHEMA);

    const household = (await client.query(`INSERT INTO ${S}.households (name) VALUES ('Test Household - E2E') RETURNING id`)).rows[0];
    const shop = (await client.query(
      `INSERT INTO ${S}.shop (household_id, shop_ref, source_kind) VALUES ($1, 'SHOP-TEST-E2E', 'photo') RETURNING id`, [household.id],
    )).rows[0];
    // A REAL asdair.regulars row - the model's claimed matched_regular_id
    // below must reference a REAL row (matched_regular_id has a genuine FK
    // to asdair.regulars), exactly as production would.
    const regular = (await client.query(
      `INSERT INTO ${S}.regulars (household_id, name, active) VALUES ($1, 'Cravendale Milk 2L', true) RETURNING id`, [household.id],
    )).rows[0];

    // A REAL, decodable JPEG, tall enough that planRegions() produces more
    // than one strip - not a synthetic 1x1 pixel.
    const sharp = (await import('sharp')).default;
    const realPhoto = await sharp({ create: { width: 1000, height: 3000, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer();

    // AC1 (WO-2026-08-12-B15-VISION-03): the REAL region plan for THIS real
    // photo, computed the same way interpretPhotoWithDeps computes it
    // internally - so the fixture below covers every STRIP region that
    // exists, whatever planRegions' own constants currently produce, rather
    // than hardcoding a strip count that would silently drift out of sync.
    const fixtureRegions = prepareImage(realPhoto).regions;
    const fixtureStripRegionNos = fixtureRegions.filter((r) => r.region_kind === 'strip').map((r) => r.region_no);

    let visionCallCount = 0;
    const mockCollaborators = {
      prepareImage,
      renderAllRegions: imageRender.renderAllRegions, // REAL sharp
      toDataUrl: imageRender.toDataUrl,
      insertRegionBatch,        // REAL writer
      insertPhotoProvenanceBatch, // REAL writer
      runSanityChecks, needsFollowUp, flaggedRegionsForFollowUp, // REAL logic
      buildGroundedPrompt: require('../../interpret/groundedPrompt.js').buildGroundedPrompt, // REAL
      writeQuery: deps.writeQuery,
      // ONLY these two are mocked - no gateway credentials in this WO's scope.
      vision: async (prompt, imageUrls) => {
        visionCallCount += 1;
        assert.ok(Array.isArray(imageUrls) && imageUrls.length > 1, 'the real region plan must produce more than one image part for a 3000px-tall photo');
        assert.match(prompt, /AVAILABLE IMAGE REGIONS/, 'the REAL region-citation prompt must have been built and sent');
        // Cite EVERY real strip region this run's OWN imagePrep.prepareImage()
        // produced, one line each, proving the model's answer is checked
        // against REAL, already-persisted region numbers.
        //
        // AC1 (WO-2026-08-12-B15-VISION-03): a genuinely CLEAN read must now
        // cover every strip region, or the new silent-region check
        // (followUpTrigger.js silentRegions) correctly asks for a follow-up
        // - this fixture previously cited only region 1 (full_page), leaving
        // every real strip silent, which is precisely the anomaly AC1 now
        // detects. Updated here to stay a genuinely clean read, matching the
        // AC1/AC2 quantity-evidence precedent immediately below (same
        // discipline: fix the fixture to be actually clean, never work
        // around a new, correct check).
        //
        // Each line carries a GENUINE LEADING count ("1 ...", "2 ...", ...)
        // ahead of the product's own name/size descriptor - WO-2026-08-12-
        // B15-VISION-02, AC1's unjustified-quantity check (photoSanityChecks.js)
        // would otherwise correctly flag "Cravendale Milk 2L" alone as
        // unjustified (the "2" in "2L" is the product's own size, not
        // purchase-count evidence, the exact same defect class as "Richmond
        // 16 Pork Sausages"). Every line resolves to the SAME real regular
        // but at a DIFFERENT quantity, so photoSanityChecks' own cross-strip
        // dedup (keyed on product id + quantity, the design doc's own
        // "two real milk lines at different quantities must not collapse"
        // rule) never collapses any of them into another - verified by
        // direct execution against the real followUpTrigger.js/
        // photoSanityChecks.js modules before this fixture was written.
        //
        // Number(regular.id), NOT the raw pg row value: node-postgres returns
        // a bigint column as a STRING (confirmed by execution: typeof "1"),
        // but a REAL model's JSON response contains a genuine JSON number
        // (it never round-trips a Postgres value) - JSON.stringify below
        // faithfully reproduces THAT shape, which is what caught a real
        // Number.isInteger("1") === false bug in an earlier draft of this
        // test (passing the raw string mis-modelled the model's own output
        // shape, not a product defect).
        return JSON.stringify({
          lines: fixtureStripRegionNos.map((regionNo, i) => ({
            line_no: i + 1,
            raw_reading: `${i + 1} Cravendale Milk 2L`,
            quantity: i + 1,
            matched_regular_id: Number(regular.id),
            confidence: 0.9,
            status: 'matched',
            source_region: regionNo,
          })),
        });
      },
      extractJson: async (text) => JSON.parse(text),
    };

    const catalogue = { candidates: [{ id: Number(regular.id), name: 'Cravendale Milk 2L' }], rules: [], last_order: { lines: [] } };
    const result = await interpretPhotoWithDeps(
      { catalogue, imageBuffer: realPhoto, shopId: shop.id, interpreterModel: 'gpt-5.6-terra', promptVersion: 'e2e-test' },
      mockCollaborators,
    );

    await t.test('the model was called exactly once (no follow-up needed - every real strip region was covered)', () => {
      assert.equal(visionCallCount, 1);
      assert.equal(result.followUpFired, false);
      assert.deepEqual(result.initialSilentRegions, [], 'AC6: every real strip was covered, so nothing is silent');
    });

    await t.test('real shop_image_region rows exist, matching the real imagePrep.js plan', async () => {
      const rows = (await client.query(`SELECT region_no, region_kind FROM ${S}.shop_image_region WHERE shop_id = $1 ORDER BY region_no`, [shop.id])).rows;
      assert.ok(rows.length > 1, 'a 3000px page must produce more than one region (full_page + strips)');
      assert.equal(rows[0].region_kind, 'full_page');
      assert.equal(rows.length, fixtureRegions.length, 'every region the real plan produced must be persisted');
    });

    await t.test('a real PHOTO shop_line_provenance row exists per strip line, each correctly bound to a REAL region id via the composite FK', async () => {
      const rows = (await client.query(
        `SELECT p.id, p.provenance, p.source_region_id, r.region_no FROM ${S}.shop_line_provenance p ` +
        `JOIN ${S}.shop_image_region r ON r.id = p.source_region_id WHERE p.shop_id = $1`, [shop.id],
      )).rows;
      assert.equal(rows.length, fixtureStripRegionNos.length);
      assert.ok(rows.every((r) => r.provenance === 'PHOTO'));
      assert.deepEqual(rows.map((r) => r.region_no).sort((a, b) => a - b), [...fixtureStripRegionNos].sort((a, b) => a - b),
        'every row must bind to one of the REAL strip regions the model cited');
    });

    await t.test('the returned lines match what the (mocked) model said, one per real strip', () => {
      assert.equal(result.lines.length, fixtureStripRegionNos.length);
      assert.deepEqual(result.lines.map((l) => l.quantity).sort((a, b) => a - b),
        fixtureStripRegionNos.map((r, i) => i + 1).sort((a, b) => a - b));
    });
  } finally {
    await dropThrowawaySchema(client, TEST_SCHEMA);
    await client.end();
  }
});
