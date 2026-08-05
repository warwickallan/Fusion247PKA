// BUILD-015 AsdAIr Stage 1 - loadCatalogue.test.js
//
// THE id-TYPE INVARIANT (closed 2026-08-03, live incident: SHOP-2026-08-03).
//
// asdair.regulars.id and asdair.shop_line.matched_regular_id are both `bigint`
// (001_asdair_schema.sql, 008_shop_line_interpretation.sql). node-postgres
// returns a bigint column as a STRING by default, and no
// pg.types.setTypeParser override exists anywhere in this codebase (grepped
// services/ - confirmed absent). Every known consumer of `regularsById` -
// services/asdair/pipeline/shopLines.js's withCanonicalNames, this directory's
// own interpret-list.js resolve() - looks a row up by Number(matched_regular_id).
//
// A Map keyed by the RAW row id therefore had STRING keys in production while
// every real lookup used a NUMBER. Every keyed lookup silently missed,
// canonical_name came back null for every genuinely MATCHED line, and
// runPipeline.buildGroundedIntents's own "neither a catalogue match nor a
// readable raw_reading" guard threw for a line that WAS matched. That is what
// actually crashed SHOP-2026-08-03 - not an illegible line, a type mismatch on
// every matched one.
//
// It was invisible to the rest of the suite because
// services/asdair/pipeline/test/harness.js's loadCatalogue stub returns a
// hand-built catalogue object directly - it never calls this module, and never
// exercises a real (string-typed) client.query() result. This file is what
// closes that gap: it drives loadCatalogue() through a stub client that
// returns ids as STRINGS, exactly as real Postgres does, and proves the
// Number-keyed lookup every consumer actually performs now succeeds.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadCatalogue } = require('./loadCatalogue');

/**
 * A stub `client` shaped like the real `pg` client this module expects
 * (`{ query(sql, params) }`), routed by which table the statement names.
 * Regulars rows carry `id` as a STRING - what node-postgres actually returns
 * for a bigint column - never a numeric literal, which would silently hide
 * the exact defect this file exists to close.
 */
function stubClient({ regulars = [], rules = [], lastOrder = [] } = {}) {
  return {
    async query(sql) {
      const s = String(sql);
      if (/from asdair\.regulars/i.test(s)) return { rows: regulars };
      if (/from asdair\.rules/i.test(s)) return { rows: rules };
      if (/from asdair\.orders/i.test(s)) return { rows: lastOrder };
      throw new Error(`stubClient: no handler for statement: ${s}`);
    },
  };
}

test('regularsById is keyed so a Number(matched_regular_id) lookup succeeds against a real bigint-shaped (STRING) id', async () => {
  const client = stubClient({
    regulars: [
      { id: '11', name: 'Gourmet cat food', brand: 'Gourmet', category: 'pet', aka: ['gourmet'], typical_qty: 3 },
      { id: '104', name: 'Mars Caramel Multipack', brand: 'Mars', category: null, aka: [], typical_qty: null },
    ],
  });

  const catalogue = await loadCatalogue(client, 1);

  assert.ok(catalogue.regularsById instanceof Map);
  // THE INVARIANT under test: every real caller coerces to Number before
  // reading this Map (shopLines.withCanonicalNames, interpret-list.js resolve()).
  const hit = catalogue.regularsById.get(11);
  assert.ok(hit, 'a Number(11) lookup must hit the row whose raw id was the string "11"');
  assert.equal(hit.name, 'Gourmet cat food');
  assert.equal(catalogue.regularsById.get(104).name, 'Mars Caramel Multipack');
  assert.equal(catalogue.regularsById.size, 2);
});

test('a household with no regulars yet produces an empty, still-Number-keyed map - never a crash', async () => {
  const client = stubClient({ regulars: [] });
  const catalogue = await loadCatalogue(client, 1);
  assert.ok(catalogue.regularsById instanceof Map);
  assert.equal(catalogue.regularsById.size, 0);
  assert.equal(catalogue.regularsById.get(11), undefined);
});

test('the compact prompt candidate keeps its id verbatim, and that id still resolves against the map once coerced', async () => {
  const client = stubClient({
    regulars: [{ id: '7', name: 'ASDA Crispy Skin-On Fries 750g', brand: 'ASDA', category: 'frozen', aka: [], typical_qty: 1 }],
  });
  const catalogue = await loadCatalogue(client, 1);
  // The prompt candidate is unchanged by this fix - only the Map's keys are
  // normalised, never the row data callers read.
  assert.equal(catalogue.candidates[0].id, '7');
  assert.ok(
    catalogue.regularsById.get(Number(catalogue.candidates[0].id)),
    'the candidate id, coerced to Number exactly as every real consumer does, must resolve against the map',
  );
});
