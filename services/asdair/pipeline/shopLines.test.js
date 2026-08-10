// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/shopLines.test.js
//
// THE DURABLE INTERPRETATION (asdair.shop_line, migration 008).
//
// The properties that matter here are all about NOT LOSING and NOT LYING:
// re-reading a list must update it rather than append a second copy, a human's
// confirmation must survive a re-read, and a canonical product name must come
// from asdair.regulars by id rather than from anything a model wrote.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, makeCatalogue } from './test/harness.js';
import {
  buildLine, upsertLine, upsertLines, listLines, linkListItem, markCorrected,
  listForeignClaimedItemIds,
  withCanonicalNames, INTERPRETATION_COLUMNS, LINE_STATUSES, _internal as sql,
} from './shopLines.js';

const SHOP = 1;

const line = (over = {}) => ({
  line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3,
  matched_regular_id: 11, match_basis: 'exact alias', status: 'matched',
  alternatives: [], ...over,
});

test('IDEMPOTENCY: re-reading a page UPDATES its line - it never appends a second copy', async () => {
  const h = makeHarness();
  const first = await upsertLine(h.deps, SHOP, line());
  assert.equal(first.written, true);
  assert.equal(h.db.shop_line.length, 1);

  const second = await upsertLine(h.deps, SHOP, line({ raw_reading: '3 gormay cat fud', quantity: 4 }));
  assert.equal(second.written, true);
  assert.equal(second.skipped, false);
  assert.equal(h.db.shop_line.length, 1, 'the interpretation was appended instead of updated');
  assert.equal(h.db.shop_line[0].raw_reading, '3 gormay cat fud');
  assert.equal(h.db.shop_line[0].quantity, 4);

  // A different page line is a different row.
  await upsertLine(h.deps, SHOP, line({ line_no: 2, matched_regular_id: 12, raw_reading: 'weetabix' }));
  assert.equal(h.db.shop_line.length, 2);
});

test('A HUMAN CONFIRMATION SURVIVES A RE-READ, and the refusal is reported not silent', async () => {
  const h = makeHarness();
  await upsertLine(h.deps, SHOP, line());
  await markCorrected(h.deps, SHOP, 1, 'telegram:555');
  assert.equal(h.db.shop_line[0].confirmed_by, 'telegram:555');
  assert.equal(h.db.shop_line[0].corrected, true);

  const again = await upsertLine(h.deps, SHOP, line({ raw_reading: 'a completely different guess', matched_regular_id: 12 }));
  assert.equal(again.written, false);
  assert.equal(again.skipped, true, 'a refused re-read must SAY it was refused');
  assert.equal(again.line.raw_reading, '3 gourmet cat food', 'a human decision was overwritten by a fresh guess');
  assert.equal(again.line.matched_regular_id, 11);
});

test('a line is bound to the list item it became - the replay guard', async () => {
  const h = makeHarness();
  await upsertLine(h.deps, SHOP, line());
  assert.equal(h.db.shop_line[0].list_item_id, null);
  const linked = await linkListItem(h.deps, SHOP, 1, 77);
  assert.equal(linked.list_item_id, 77);
});

test('lines come back in PAGE ORDER, whatever order they were written in', async () => {
  const h = makeHarness();
  await upsertLines(h.deps, SHOP, [
    line({ line_no: 3, matched_regular_id: null, status: 'unmatched_new_item', raw_reading: 'fruit splits', quantity: null }),
    line({ line_no: 1 }),
    line({ line_no: 2, matched_regular_id: 12, raw_reading: 'weetabix', quantity: 1 }),
  ]);
  assert.deepEqual((await listLines(h.deps, SHOP)).map((l) => l.line_no), [1, 2, 3]);
});

test('THE NAME IS NEVER STORED - it is looked up from asdair.regulars by id', async () => {
  const h = makeHarness();
  await upsertLine(h.deps, SHOP, line());
  const stored = h.db.shop_line[0];
  for (const key of Object.keys(stored)) {
    assert.ok(!/name/i.test(key) || key === 'raw_reading',
      `shop_line stores "${key}" - a stored product name goes stale on a rename and lets model prose look canonical`);
  }
  const named = withCanonicalNames(await listLines(h.deps, SHOP), makeCatalogue());
  assert.equal(named[0].canonical_name, 'Gourmet cat food');
  assert.equal(named[0].asda_product_id, 'A11');
});

test('withCanonicalNames works from a plain regulars array as well as the loadCatalogue Map', () => {
  const asArray = withCanonicalNames([{ matched_regular_id: 5 }],
    { regulars: [{ id: 5, name: 'Arla 4pt', asda_product_id: 'A5' }] });
  assert.equal(asArray[0].canonical_name, 'Arla 4pt');
  const none = withCanonicalNames([{ matched_regular_id: null }], makeCatalogue());
  assert.equal(none[0].canonical_name, null);
});

test('the interpretation column allowlist is exactly what a re-read may write', () => {
  assert.deepEqual([...INTERPRETATION_COLUMNS], [
    'shop_id', 'line_no', 'raw_reading', 'quantity', 'matched_regular_id',
    'match_basis', 'match_confidence', 'alternatives', 'status',
  ]);
  // The SET clause is BUILT from the allowlist, so a column outside it has no
  // path into the SQL at all - not a filter that could be worked around.
  for (const forbidden of ['confirmed_by', 'confirmed_at', 'corrected', 'list_item_id']) {
    assert.doesNotMatch(sql.UPSERT_SQL, new RegExp(`${forbidden}\\s*=\\s*EXCLUDED`));
  }
});

test('buildLine is PURE and total - it validates everything the database would', () => {
  const a = buildLine(SHOP, line());
  const b = buildLine(SHOP, line());
  assert.deepEqual(a, b, 'identical input produced different rows');

  assert.throws(() => buildLine(SHOP, line({ line_no: 0 })), /positive integer/);
  assert.throws(() => buildLine(SHOP, line({ matched_regular_id: -1 })), /positive integer or null/);
  assert.throws(() => buildLine(SHOP, line({ match_confidence: 1.4 })), /0\.\.1/);
  assert.equal(buildLine(SHOP, line({ raw_reading: '   ' , status: 'unreadable', matched_regular_id: null })).raw_reading, null);
  assert.deepEqual(buildLine(SHOP, line({ alternatives: undefined })).alternatives, []);
  for (const s of LINE_STATUSES) {
    const row = buildLine(SHOP, line({ status: s, matched_regular_id: s === 'matched' ? 11 : null }));
    assert.equal(row.status, s);
  }
});

test('an upsert that writes nothing AND finds nothing fails loudly rather than pretending', async () => {
  const h = makeHarness();
  // A write path that silently swallows the row, and a read that finds nothing.
  h.deps.writeQuery = async () => ({ rows: [], rowCount: 0 });
  h.deps.readQuery = async () => ({ rows: [], rowCount: 0 });
  await assert.rejects(() => upsertLine(h.deps, SHOP, line()), /wrote nothing.*and no such line exists/s);
});

// =====================================================================
// WP-B15-10 - WHICH LIST ITEMS ANOTHER SHOP PROVABLY OWNS
//
// `asdair.shopping_lists` carries `unique (household_id, list_date)`
// (001_asdair_schema.sql:251), so two shops on one calendar date SHARE one list
// row. This statement is the only durable evidence that a row on that shared
// list was put there by somebody else's shop.
//
// THE DIRECTION IS THE WHOLE DESIGN, and these tests exist to keep it. A row
// that comes back is PROVABLY another shop's. A row that does not is NOT
// thereby this shop's - stepInterpret is the only caller of linkListItem, so
// corrections and cockpit additions carry no claim at all. Read as an allowlist
// this silently drops what Warwick asked for; that version was built, the suite
// killed it, and it must not come back.
// =====================================================================

/** A deps carrying only what this function uses, recording what it was asked. */
function recordingDeps(rows) {
  const asked = [];
  return {
    asked,
    readQuery: async (text, params) => {
      asked.push({ text, params });
      return { rows, rowCount: rows.length };
    },
  };
}

test('B15-10: the statement asks for OTHER shops\' claims, and could not be read as an allowlist', () => {
  const stmt = sql.SELECT_FOREIGN_CLAIMS_SQL;
  assert.match(stmt, /FROM asdair\.shop_line/i, 'the claim evidence lives in shop_line');
  assert.match(stmt, /shop_id <> \$1/i,
    'the statement stopped excluding OTHER shops. `shop_id = $1` here would invert it into the '
    + 'allowlist that silently drops corrections and cockpit additions');
  assert.doesNotMatch(stmt, /shop_id\s*=\s*\$1/i, 'the statement was inverted into an allowlist');
  assert.match(stmt, /SELECT DISTINCT list_item_id/i,
    'a fan-out would make the caller count claims rather than name them');
  assert.match(stmt, /list_item_id = ANY\(\$2::bigint\[\]\)/i,
    'the question must be bounded to the rows actually on this list');
});

test('B15-10: it asks only about the ids it was given, and returns them as strings', async () => {
  const deps = recordingDeps([{ list_item_id: 210 }, { list_item_id: '211' }]);
  const out = await listForeignClaimedItemIds(deps, 7, [210, '211', 212]);

  assert.equal(deps.asked.length, 1, 'exactly one read');
  assert.equal(deps.asked[0].text, sql.SELECT_FOREIGN_CLAIMS_SQL, 'the named statement, not an ad-hoc one');
  assert.deepEqual(deps.asked[0].params, [7, [210, 211, 212]], 'the shop and the bounded id set');
  assert.deepEqual(out, ['210', '211'],
    'ids must come back as strings - a bigint arrives from pg as either, and a claim that misses '
    + 'its own row silently stops excluding anything');
});

test('B15-10: nothing to ask about means NO query at all', async () => {
  const deps = recordingDeps([]);
  assert.deepEqual(await listForeignClaimedItemIds(deps, 7, []), []);
  assert.deepEqual(await listForeignClaimedItemIds(deps, 7, null), []);
  assert.equal(deps.asked.length, 0, 'an empty list must never reach the database');
});

test('B15-10: junk ids are dropped before the query, never sent as junk', async () => {
  const deps = recordingDeps([]);
  await listForeignClaimedItemIds(deps, 7, [210, null, undefined, '', 'not-a-number', 0, -3]);
  assert.deepEqual(deps.asked[0].params, [7, [210]]);
});

test('B15-10 FAIL OPEN: an unusable answer names NOTHING rather than guessing', async () => {
  // Rows with no usable id must not become exclusions. Returning [] here means
  // "nothing is provably foreign", which leaves the working set untouched.
  const deps = recordingDeps([{ list_item_id: null }, {}, { list_item_id: '' }, null]);
  assert.deepEqual(await listForeignClaimedItemIds(deps, 7, [210]), [],
    'an unreadable claim row became an exclusion - a bad read must never remove a real item');
});

test('B15-10 FAIL OPEN: a read that THROWS propagates, so the caller can decide to keep everything', async () => {
  const deps = { readQuery: async () => { throw new Error('connection reset'); } };
  await assert.rejects(() => listForeignClaimedItemIds(deps, 7, [210]), /connection reset/,
    'swallowing the failure here would hide it from the caller that has to fail OPEN on it');
});
