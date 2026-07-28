// BUILD-015 - cockpit-api/readWorkspace.test.js
//
// Offline. No database: the scripted fake client from shop/fakeClient.js
// records every statement, so "SELECT only" and "one snapshot" are PROVEN
// rather than asserted in a comment.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const RW = require('./readWorkspace');
const { makeClient, statements } = require('../shop/fakeClient');

// ---------------------------------------------------------------------
// SELECT ONLY
// ---------------------------------------------------------------------
test('every statement this module can issue is a SELECT', () => {
  RW.ALL_SQL.forEach((sql) => {
    assert.match(sql.trim(), /^SELECT\b/, 'not a SELECT: ' + sql.slice(0, 60));
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT)\b/i);
  });
});

test('the dynamic list-item SELECT is also SELECT-only and whitelisted', () => {
  const base = RW._internal.buildItemSelect([]);
  assert.match(base.trim(), /^SELECT\b/);
  RW.ITEM_BASE_COLUMNS.forEach((c) => assert.ok(base.includes(c), 'missing base column ' + c));
  RW.ITEM_OPTIONAL_COLUMNS.forEach((c) => assert.ok(!base.includes(c), 'optional column leaked in: ' + c));
});

test('optional interpretation columns are read only when the database reports them', () => {
  const present = RW.ITEM_BASE_COLUMNS.concat(['matched_regular_id', 'interpretation_status', 'line_no']);
  const sql = RW._internal.buildItemSelect(present);
  assert.ok(sql.includes('matched_regular_id'));
  assert.ok(sql.includes('interpretation_status'));
  assert.ok(sql.includes('ORDER BY line_no ASC, id ASC'));
  assert.ok(!sql.includes('match_confidence'));
});

test('a column name outside the whitelist can never reach a statement', () => {
  const sql = RW._internal.buildItemSelect(RW.ITEM_BASE_COLUMNS.concat(['id; drop table asdair.shop --', 'secret_token']));
  assert.ok(!sql.includes('drop table'));
  assert.ok(!sql.includes('secret_token'));
  assert.match(sql.trim(), /^SELECT\b/);
});

// ---------------------------------------------------------------------
// A FULL READ, against a scripted client.
// ---------------------------------------------------------------------
function script() {
  return [
    // --- shopStatus.js, running inside OUR transaction on OUR client -------
    { match: 'transcript_confidence, last_error', repeat: true, rows: [{
      id: 7, household_id: 1, shop_ref: 'SHOP-2026-07-28', status: 'PROCESSING', source_kind: 'photo',
      list_id: 55, needs_review: false, transcript_confidence: 0.91, last_error: null,
      created_at: '2026-07-28T09:00:00Z', updated_at: '2026-07-28T11:00:00Z' }] },
    { match: 'GROUP BY status', repeat: true, rows: (p) => (
      String(p[0]) === '55' ? [{ status: 'requested', n: 2 }, { status: 'added', n: 1 }] : []) },
    { match: "WHERE shop_id = $1 AND status = 'open'", rows: [] },
    { match: 'FROM asdair.browser_build_request', rows: [] },
    { match: 'FROM asdair.pending_action', rows: [] },
    { match: "event_type = 'failure' ORDER BY id DESC", rows: [] },
    { match: "count(*)::int AS n FROM asdair.shop_event", rows: [{ n: 0 }] },
    { match: 'SELECT id, stated_total, received_at, reconciled_at', rows: [] },
    { match: 'count(*) FILTER (WHERE substitutes_allowed)', rows: [{ total: 3, allowing: 1 }] },
    { match: 'FROM asdair.shop_event WHERE shop_id = $1 ORDER BY id DESC', rows: [] },

    // --- readWorkspace's own statements ------------------------------------
    { match: 'raw_media_path', rows: [{
      id: 7, household_id: 1, shop_ref: 'SHOP-2026-07-28', status: 'PROCESSING', source_kind: 'photo',
      raw_text: null, raw_media_path: 'lists/2026-07-28.jpg', transcript: '3 arla 4pt',
      transcript_provider: 'gateway', transcript_model: 'vision', transcript_confidence: 0.91,
      needs_review: false, list_id: 55, last_error: null,
      created_at: '2026-07-28T09:00:00Z', updated_at: '2026-07-28T11:00:00Z' }] },
    { match: 'ORDER BY id ASC LIMIT 500', rows: [
      { event_type: 'transition', from_status: 'RECEIVED', to_status: 'TRANSCRIBING', description: 'reading the photo', occurred_at: '2026-07-28T09:01:00Z' }] },
    { match: 'answer_source', rows: [] },
    { match: 'information_schema.columns', rows: [
      { column_name: 'id' }, { column_name: 'item_name' }, { column_name: 'matched_product_id' },
      { column_name: 'requested_qty' }, { column_name: 'added_qty' }, { column_name: 'status' },
      { column_name: 'price' }, { column_name: 'note' }, { column_name: 'one_week_only' },
      { column_name: 'matched_regular_id' }, { column_name: 'interpretation_status' }] },
    { match: 'one_week_only', rows: [
      { id: 101, item_name: '3 arla 4pt', requested_qty: 3, added_qty: null, status: 'requested', note: null, matched_regular_id: 11, interpretation_status: 'matched' },
      { id: 102, item_name: 'fruit splits', requested_qty: 1, added_qty: null, status: 'needs_decision', note: null, matched_regular_id: null, interpretation_status: null }] },
    { match: 'FROM asdair.product_alternatives', rows: [] },
    { match: /FROM asdair\.regulars WHERE household_id = \$1 ORDER BY/, rows: [
      { id: 11, name: 'Arla semi skimmed 4pt', brand: 'Arla', category: 'dairy', asda_product_id: 'A-1001', aka: ['arla 4pt'], active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] },
    { match: 'parse_provider', rows: [] },
    { match: 'FROM asdair.orders', rows: [] },
    { match: 'FROM asdair.rules', rows: [] },
    { match: 'ORDER BY id DESC LIMIT 25', rows: [
      { id: 7, shop_ref: 'SHOP-2026-07-28', status: 'PROCESSING', source_kind: 'photo', created_at: '2026-07-28T09:00:00Z', updated_at: '2026-07-28T11:00:00Z' }] }
  ];
}

test('a full read issues nothing but SELECTs and returns a complete payload', async () => {
  const client = makeClient(script());
  const payload = await RW.readWorkspace({ shop: 7, household_id: 1, client: client });

  statements(client).forEach((sql) => {
    assert.match(sql.trim(), /^SELECT\b/, 'non-SELECT statement issued: ' + sql.slice(0, 60));
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.shop.shop_ref_display, 'SHOP-2026-07-28');
  assert.equal(payload.shop.stage_label_display, 'working through the list');
  assert.equal(payload.evidence.raw_media_path_display, 'lists/2026-07-28.jpg');
  assert.equal(payload.timeline.length, 1);
  assert.equal(payload.interpretation.lines.length, 2);
  assert.equal(payload.shops.length, 1);
});

test('the status projection is shopStatus.js, not a second implementation', async () => {
  const client = makeClient(script());
  const payload = await RW.readWorkspace({ shop: 7, household_id: 1, client: client });
  // These fields only exist because getShopStatus produced them.
  assert.equal(payload.shop.lines_summary.total_display, '3');
  assert.equal(payload.shop.lines_summary.resolved_display, '1');
  assert.match(payload.shop.substitution_policy_display, /never auto-substitute/);
});

test('the interpretation is catalogue-grounded end to end', async () => {
  const client = makeClient(script());
  const payload = await RW.readWorkspace({ shop: 7, household_id: 1, client: client });
  const [matched, unmatched] = payload.interpretation.lines;
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matched_regular_id_display, '11');
  assert.equal(matched.canonical_product_name_display, 'Arla semi skimmed 4pt');
  assert.equal(unmatched.status, 'unmatched_new_item');
  assert.equal(unmatched.canonical_product_name_display, 'unknown');
  assert.equal(payload.interpretation.grounded, true);
});

test('an injected client is used as-is - the reader never opens its own transaction over one', async () => {
  const client = makeClient(script());
  await RW.readWorkspace({ shop: 7, household_id: 1, client: client });
  assert.equal(statements(client).filter((s) => s === 'BEGIN TRANSACTION READ ONLY').length, 0);
  assert.equal(statements(client).filter((s) => s === 'COMMIT').length, 0);
});

test('no shop at all is reported honestly, and nothing else is read', async () => {
  const client = makeClient([
    { match: 'ORDER BY (status IN', rows: [] }
  ]);
  const payload = await RW.readWorkspace({ client: client });
  assert.equal(payload.ok, false);
  assert.equal(payload.reason, 'no_shop');
  assert.equal(statements(client).length, 1);
});
