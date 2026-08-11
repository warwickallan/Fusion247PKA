// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/shopImageRegions.test.js
// WO-2026-08-11-B15-VISION-01, AC1/AC2/AC3 proof (pure half).
// The real database-level proof lives in test/provenanceConstraints.dbtest.js.
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRegionRow, insertRegionBatch } from './shopImageRegions.js';
import { planRegions, imageFingerprint } from './imagePrep.js';

test('buildRegionRow: shapes a valid full_page row (all-null bounds)', () => {
  const row = buildRegionRow(9, { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null });
  assert.equal(row.shop_id, 9);
  assert.equal(row.region_kind, 'full_page');
  assert.equal(row.pixel_top, null);
});

test('buildRegionRow: shapes a valid strip row (all-four bounds)', () => {
  const row = buildRegionRow(9, { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: 700, pixel_right: 1000 });
  assert.equal(row.pixel_bottom, 700);
});

test('buildRegionRow: refuses a partial bounds set (some but not all four) - mirrors migration 020\'s CHECK', () => {
  assert.throws(
    () => buildRegionRow(9, { region_no: 2, region_kind: 'strip', pixel_top: 0, pixel_left: 0, pixel_bottom: null, pixel_right: 1000 }),
    /pixel bounds must be all four present or all four null/,
  );
});

test('buildRegionRow: refuses a degenerate (zero/negative area) box', () => {
  assert.throws(
    () => buildRegionRow(9, { region_no: 2, region_kind: 'strip', pixel_top: 100, pixel_left: 0, pixel_bottom: 100, pixel_right: 50 }),
    /positive-area box/,
  );
});

test('buildRegionRow: refuses an unknown region_kind', () => {
  assert.throws(
    () => buildRegionRow(9, { region_no: 1, region_kind: 'thumbnail', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null }),
    /region_kind must be one of/,
  );
});

test('buildRegionRow: accepts a real imagePrep.js fingerprint shape', () => {
  const fp = imageFingerprint(Buffer.from('some bytes'));
  const row = buildRegionRow(9, { region_no: 1, region_kind: 'full_page', pixel_top: null, pixel_left: null, pixel_bottom: null, pixel_right: null }, fp);
  assert.equal(row.image_fingerprint, fp);
});

test('insertRegionBatch: persists an ENTIRE real imagePrep.js plan and returns region_no -> id', async () => {
  const { regions } = planRegions({ width: 1200, height: 3500, rotate: 0 });
  let nextId = 900;
  const writeQuery = async (sql, params) => {
    const [, region_no] = params;
    return { rows: [{ id: nextId++, region_no }] };
  };
  const regionIdByNumber = await insertRegionBatch({ writeQuery }, 55, regions);
  assert.equal(regionIdByNumber.size, regions.length);
  regions.forEach((r) => assert.ok(regionIdByNumber.has(r.region_no)));
});
