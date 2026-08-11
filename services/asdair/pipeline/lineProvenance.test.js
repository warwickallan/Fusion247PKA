// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/lineProvenance.test.js
//
// WO-2026-08-11-B15-VISION-01, AC6 proof (the PURE half - row shape and
// client-side CHECK mirroring). The REAL database-level proof that Silas's
// actual committed constraints accept/refuse these shapes lives in
// test/lineProvenance.dbtest.js (a DB-gated companion, opt-in only) and in
// test/provenanceConstraints.dbtest.js (AC3's own acceptance_property).
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPhotoProvenanceRow, buildRegularsProvenanceRow, buildRuleProvenanceRow,
  buildWarwickProvenanceRow, insertPhotoProvenanceBatch, insertProvenanceRow,
} from './lineProvenance.js';

const PHOTO_LINE = {
  line_no: 1, raw_reading: 'Cravendale Milk', quantity: 2,
  matched_regular_id: 101, confidence: 0.9, source_region: 3,
};

// ---------------------------------------------------------------------
// buildPhotoProvenanceRow
// ---------------------------------------------------------------------

test('buildPhotoProvenanceRow: shapes a valid PHOTO row', () => {
  const row = buildPhotoProvenanceRow(PHOTO_LINE, {
    shopId: 55, sourceRegionId: 9, interpreterModel: 'gpt-5.6-terra', promptVersion: 'v3',
  });
  assert.equal(row.shop_id, 55);
  assert.equal(row.provenance, 'PHOTO');
  assert.equal(row.source_region_id, 9);
  assert.equal(row.interpreter_model, 'gpt-5.6-terra');
  assert.equal(row.prompt_version, 'v3');
  assert.equal(row.raw_text, 'Cravendale Milk');
  assert.equal(row.matched_regular_id, 101);
  assert.equal(row.quantity, 2);
  assert.equal(row.confidence, 0.9);
  assert.equal(row.superseded_by_id, null);
});

test('buildPhotoProvenanceRow: THE ACCEPTANCE_PROPERTY, client-side mirror - no sourceRegionId throws', () => {
  assert.throws(
    () => buildPhotoProvenanceRow(PHOTO_LINE, { shopId: 55, sourceRegionId: null, interpreterModel: 'm', promptVersion: 'v' }),
    /a PHOTO row requires source_region_id/,
  );
});

test('buildPhotoProvenanceRow: refuses empty raw_reading ("no line without visible evidence")', () => {
  assert.throws(
    () => buildPhotoProvenanceRow({ ...PHOTO_LINE, raw_reading: '   ' }, { shopId: 55, sourceRegionId: 9, interpreterModel: 'm', promptVersion: 'v' }),
    /a PHOTO row requires non-empty raw_text/,
  );
});

test('buildPhotoProvenanceRow: refuses a missing interpreter_model or prompt_version', () => {
  assert.throws(
    () => buildPhotoProvenanceRow(PHOTO_LINE, { shopId: 55, sourceRegionId: 9, interpreterModel: null, promptVersion: 'v' }),
    /requires interpreter_model and prompt_version/,
  );
  assert.throws(
    () => buildPhotoProvenanceRow(PHOTO_LINE, { shopId: 55, sourceRegionId: 9, interpreterModel: 'm', promptVersion: '' }),
    /requires interpreter_model and prompt_version/,
  );
});

test('buildPhotoProvenanceRow: refuses an implausible quantity outside 1..999', () => {
  assert.throws(
    () => buildPhotoProvenanceRow({ ...PHOTO_LINE, quantity: 0 }, { shopId: 55, sourceRegionId: 9, interpreterModel: 'm', promptVersion: 'v' }),
    /quantity must be null or an integer/,
  );
});

test('buildPhotoProvenanceRow: a null confidence and null quantity are both honest, valid values', () => {
  const row = buildPhotoProvenanceRow({ ...PHOTO_LINE, quantity: null, confidence: null }, {
    shopId: 55, sourceRegionId: 9, interpreterModel: 'm', promptVersion: 'v',
  });
  assert.equal(row.quantity, null);
  assert.equal(row.confidence, null);
});

// ---------------------------------------------------------------------
// The other three provenance kinds
// ---------------------------------------------------------------------

test('buildRegularsProvenanceRow: requires matched_regular_id (a REGULARS row is a known catalogue item, by definition)', () => {
  const row = buildRegularsProvenanceRow({ shopId: 1, lineNo: null, matchedRegularId: 55, quantity: 2 });
  assert.equal(row.provenance, 'REGULARS');
  assert.equal(row.matched_regular_id, 55);
  assert.equal(row.source_region_id, null);
  assert.throws(() => buildRegularsProvenanceRow({ shopId: 1, matchedRegularId: null }), /a REGULARS row requires matched_regular_id/);
});

test('buildRuleProvenanceRow: accepts EITHER a real product OR free text, never neither', () => {
  const withProduct = buildRuleProvenanceRow({ shopId: 1, matchedRegularId: 55, rawText: null, quantity: null });
  assert.equal(withProduct.matched_regular_id, 55);
  const withText = buildRuleProvenanceRow({ shopId: 1, matchedRegularId: null, rawText: 'New household item', quantity: null });
  assert.equal(withText.raw_text, 'New household item');
  assert.throws(
    () => buildRuleProvenanceRow({ shopId: 1, matchedRegularId: null, rawText: '  ' }),
    /must name either matched_regular_id or non-empty raw_text/,
  );
});

test('buildWarwickProvenanceRow: same shape as RULE, provenance tagged WARWICK', () => {
  const row = buildWarwickProvenanceRow({ shopId: 1, matchedRegularId: null, rawText: 'Something Warwick asked for this week' });
  assert.equal(row.provenance, 'WARWICK');
  assert.equal(row.raw_text, 'Something Warwick asked for this week');
});

test('every non-PHOTO builder refuses a source_region (only PHOTO may carry one)', () => {
  // toRow() always sets source_region_id null for non-photo builders - this
  // asserts that INVARIANT holds, i.e. these builders never expose a way to
  // smuggle a region onto a non-PHOTO row.
  const regulars = buildRegularsProvenanceRow({ shopId: 1, matchedRegularId: 1 });
  const rule = buildRuleProvenanceRow({ shopId: 1, matchedRegularId: 1 });
  const warwick = buildWarwickProvenanceRow({ shopId: 1, matchedRegularId: 1 });
  [regulars, rule, warwick].forEach((row) => assert.equal(row.source_region_id, null));
});

// ---------------------------------------------------------------------
// insertPhotoProvenanceBatch - survivor-then-superseded write ORDER
// (against a FAKE deps.writeQuery - the real-Postgres proof is the
// companion .dbtest.js file; this proves the ORDERING logic in isolation).
// ---------------------------------------------------------------------

function fakeWriteQueryCapturingOrder() {
  let nextId = 1000;
  const inserted = [];
  const writeQuery = async (sql, params) => {
    const row = {
      id: nextId++, shop_id: params[0], line_no: params[1], provenance: params[2],
      source_region_id: params[3], interpreter_model: params[4], prompt_version: params[5],
      raw_text: params[6], matched_regular_id: params[7], quantity: params[8],
      confidence: params[9], superseded_by_id: params[10],
    };
    inserted.push(row);
    return { rows: [row] };
  };
  return { writeQuery, inserted };
}

test('insertPhotoProvenanceBatch: survivors are inserted BEFORE any row that supersedes them', async () => {
  const { writeQuery, inserted } = fakeWriteQueryCapturingOrder();
  const lines = [
    { line_no: 1, raw_reading: 'Milk', quantity: 2, matched_regular_id: 101, confidence: 0.5, source_region: 2, supersededByIndex: 1 },
    { line_no: 1, raw_reading: 'Milk', quantity: 2, matched_regular_id: 101, confidence: 0.9, source_region: 3, supersededByIndex: null },
  ];
  const regionIdByNumber = new Map([[2, 501], [3, 502]]);
  const result = await insertPhotoProvenanceBatch({ writeQuery }, lines, {
    shopId: 7, regionIdByNumber, interpreterModel: 'gpt-5.6-terra', promptVersion: 'v1',
  });

  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].superseded_by_id, null, 'the survivor (index 1) must be inserted FIRST, unsuperseded');
  assert.equal(inserted[1].superseded_by_id, inserted[0].id, 'the superseded row (index 0) is inserted SECOND, pointing at the real id just returned');

  // Result array preserves the ORIGINAL line order/indexing, not insert order.
  assert.equal(result[0].superseded_by_id, inserted[0].id);
  assert.equal(result[1].superseded_by_id, null);
});

test('insertPhotoProvenanceBatch: a fully clean batch (no duplicates) inserts every row unsuperseded', async () => {
  const { writeQuery, inserted } = fakeWriteQueryCapturingOrder();
  const lines = [
    { line_no: 1, raw_reading: 'Milk', quantity: 2, matched_regular_id: 101, confidence: 0.9, source_region: 2, supersededByIndex: null },
    { line_no: 2, raw_reading: 'Bread', quantity: 1, matched_regular_id: 102, confidence: 0.9, source_region: 2, supersededByIndex: null },
  ];
  const regionIdByNumber = new Map([[2, 501]]);
  await insertPhotoProvenanceBatch({ writeQuery }, lines, {
    shopId: 7, regionIdByNumber, interpreterModel: 'gpt-5.6-terra', promptVersion: 'v1',
  });
  assert.equal(inserted.length, 2);
  inserted.forEach((r) => assert.equal(r.superseded_by_id, null));
});

test('insertPhotoProvenanceBatch: an unresolvable region number fails loudly rather than inserting a wrong FK target', async () => {
  const { writeQuery } = fakeWriteQueryCapturingOrder();
  const lines = [{ line_no: 1, raw_reading: 'Milk', quantity: 1, matched_regular_id: 101, confidence: 0.9, source_region: 99, supersededByIndex: null }];
  await assert.rejects(
    insertPhotoProvenanceBatch({ writeQuery }, lines, { shopId: 7, regionIdByNumber: new Map(), interpreterModel: 'm', promptVersion: 'v' }),
    /no persisted shop_image_region id known for region_no 99/,
  );
});

test('insertProvenanceRow: sends the row through deps.writeQuery and returns the persisted row', async () => {
  const { writeQuery, inserted } = fakeWriteQueryCapturingOrder();
  const row = buildRegularsProvenanceRow({ shopId: 3, matchedRegularId: 44, quantity: 1 });
  const result = await insertProvenanceRow({ writeQuery }, row);
  assert.equal(inserted.length, 1);
  assert.equal(result.provenance, 'REGULARS');
  assert.equal(result.matched_regular_id, 44);
});
