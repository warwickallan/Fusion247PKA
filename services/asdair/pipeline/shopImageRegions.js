// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/shopImageRegions.js
//
// WO-2026-08-11-B15-VISION-01, AC1/AC2/AC3: persists the application-owned,
// model-cannot-write region list (asdair.shop_image_region, migration 020)
// that imagePrep.js's planRegions() computes and groundedPrompt.js's
// region-citation contract asks the model to cite against.
//
// INSERT-ONLY (migration 020 section 6: asdair_rw holds SELECT+INSERT only,
// no UPDATE/DELETE) - this module never emits either.
//
// KNOWN, REPORTED GAP (not fixed here - see this Work Order's return): this
// module writes asdair.shop_image_region directly, which
// invariants.test.js's "this work package owns ONE folder" check does not
// yet allow - its own OWNED allowlist does not (yet) name
// shop_image_region or shop_line_provenance. That test's own comment
// states plainly this is added by whoever owns the invariant, not by the
// implementing worker: "ADDED BY LARRY, not by the implementing worker...
// the worker correctly refused BOTH to edit it AND to reshape its own SQL
// to dodge the regex". This module follows that same precedent rather than
// relitigating it - see lineProvenance.js's module header for the sibling
// case (shop_line_provenance) and this Work Order's return for the exact
// two-line addition both tables need.
// =====================================================================

'use strict';

const INSERT_COLUMNS = [
  'shop_id', 'region_no', 'region_kind', 'pixel_top', 'pixel_left',
  'pixel_bottom', 'pixel_right', 'image_fingerprint',
];

const SELECT_LIST =
  'id, shop_id, region_no, region_kind, pixel_top, pixel_left, pixel_bottom, pixel_right, ' +
  'image_fingerprint, created_at';

const INSERT_SQL =
  `INSERT INTO asdair.shop_image_region (${INSERT_COLUMNS.join(', ')}) ` +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ' +
  `RETURNING ${SELECT_LIST}`;

const REGION_KINDS = Object.freeze(['full_page', 'strip']);

/** Client-side mirror of migration 020's shop_image_region CHECK constraints - fast-fail only; the database is authoritative. */
function assertRegionSatisfiesChecks(region) {
  if (!REGION_KINDS.includes(region.region_kind)) {
    throw new Error('shopImageRegions: region_kind must be one of ' + REGION_KINDS.join(', '));
  }
  if (!(Number.isInteger(region.region_no) && region.region_no > 0)) {
    throw new Error('shopImageRegions: region_no must be a positive integer');
  }
  const bounds = [region.pixel_top, region.pixel_left, region.pixel_bottom, region.pixel_right];
  const setCount = bounds.filter((b) => b !== null && b !== undefined).length;
  if (setCount !== 0 && setCount !== 4) {
    throw new Error('shopImageRegions: pixel bounds must be all four present or all four null');
  }
  if (setCount === 4) {
    if (!(region.pixel_bottom > region.pixel_top) || !(region.pixel_right > region.pixel_left)) {
      throw new Error('shopImageRegions: pixel bounds must describe a positive-area box');
    }
  }
  if (region.image_fingerprint !== null && region.image_fingerprint !== undefined
    && !/^[0-9a-f]{16,128}$/.test(region.image_fingerprint)) {
    throw new Error('shopImageRegions: image_fingerprint must be null or 16-128 lowercase hex chars');
  }
}

/**
 * Shape one row from imagePrep.js's planRegions() output plus the shop it
 * belongs to. `region` is exactly one entry of planRegions().regions.
 * @param {number} shopId
 * @param {object} region - {region_no, region_kind, pixel_top, pixel_left, pixel_bottom, pixel_right}
 * @param {string|null} [imageFingerprint] - from imagePrep.js's imageFingerprint().
 */
export function buildRegionRow(shopId, region, imageFingerprint = null) {
  const row = {
    shop_id: shopId,
    region_no: region.region_no,
    region_kind: region.region_kind,
    pixel_top: region.pixel_top ?? null,
    pixel_left: region.pixel_left ?? null,
    pixel_bottom: region.pixel_bottom ?? null,
    pixel_right: region.pixel_right ?? null,
    image_fingerprint: imageFingerprint,
  };
  assertRegionSatisfiesChecks(row);
  return row;
}

function rowsOf(res) {
  return (res && res.rows) || [];
}

function paramsOf(row) {
  return INSERT_COLUMNS.map((c) => row[c] ?? null);
}

/**
 * Persist every region from one imagePrep.js planRegions() plan for one
 * shop, and return a Map<region_no, real_db_id> - exactly the shape
 * lineProvenance.js's insertPhotoProvenanceBatch needs as its
 * `regionIdByNumber` argument, so the anti-hallucination FK
 * (shop_line_provenance_region_fk) always binds to a region that is
 * genuinely persisted, never to an in-memory region_no alone.
 *
 * @param {object} deps - {writeQuery}
 * @param {number} shopId
 * @param {Array<object>} regions - planRegions().regions.
 * @param {string|null} [imageFingerprint]
 * @returns {Promise<Map<number, number>>}
 */
export async function insertRegionBatch(deps, shopId, regions, imageFingerprint = null) {
  const regionIdByNumber = new Map();
  for (const region of regions) {
    const row = buildRegionRow(shopId, region, imageFingerprint);
    const res = await deps.writeQuery(INSERT_SQL, paramsOf(row));
    const persisted = rowsOf(res)[0];
    regionIdByNumber.set(persisted.region_no, persisted.id);
  }
  return regionIdByNumber;
}

export const _internal = { INSERT_SQL, INSERT_COLUMNS, assertRegionSatisfiesChecks };
