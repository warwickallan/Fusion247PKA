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

  // TRANSACTION CONTROL IS NOT A DATA STATEMENT. Savepoints arrived with
  // WP-B15-35's optional reads: in Postgres one failed statement aborts the
  // whole transaction, so an optional read is only optional if it can be
  // rolled back to a savepoint. These three touch no row.
  //
  // The assertion is NOT relaxed - it is made specific. Every DATA statement
  // must still be a SELECT, and the mutation check is NEW: no INSERT, UPDATE,
  // DELETE, TRUNCATE, DROP, ALTER or CREATE may appear at all.
  const TXN_CONTROL = /^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)/;
  const seen = statements(client);
  assert.ok(seen.length > 5, 'a statement sweep over nothing proves nothing (' + seen.length + ')');
  seen.forEach((sql) => {
    const t = sql.trim();
    // ANCHORED, and it must be. An unanchored match fires on the column names
    // `created_at` and `updated_at`, which every SELECT here carries - and a
    // check that fails on correct code is a check people learn to delete. A
    // mutation is issued AS a statement, so its verb is at the start.
    assert.equal(/^(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)/i.test(t), false,
      'a mutating statement reached the read service: ' + t.slice(0, 60));
    if (TXN_CONTROL.test(t)) return;
    assert.match(t, /^SELECT /, 'non-SELECT statement issued: ' + t.slice(0, 60));
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

// =====================================================================
// checkDependencies - what makes /asdair/health honest.
//
// These MUTATE the dependency for real (a pool that refuses, a pool that
// hangs, a pool whose query fails) and assert the check goes red, then a
// working pool and assert it goes green. A health check that has never been
// made to fail is not evidence - and the one this replaces literally could
// not fail, which is how it reported ok:true through an outage.
// =====================================================================

function fakePool(behaviour) {
  return {
    connect: async function () {
      if (behaviour.connectError) throw behaviour.connectError;
      // A SLOW pool, not a black hole. An never-settling promise models nothing real (pg always
      // settles eventually) and leaves the test runner with a permanently pending promise, which
      // it reports as three cancelled tests - a test artefact masquerading as a product defect.
      if (behaviour.slowConnectMs) {
        await new Promise(function (r) { setTimeout(r, behaviour.slowConnectMs); });
      }
      return {
        query: async function () {
          if (behaviour.queryError) throw behaviour.queryError;
          return { rows: [{ '?column?': 1 }] };
        },
        release: function () { behaviour.released = true; }
      };
    }
  };
}

test('checkDependencies is GREEN when the database answers', async () => {
  const b = {};
  const r = await RW.checkDependencies({ pool: fakePool(b) });
  assert.equal(r.ok, true);
  assert.equal(r.dependency, 'database');
  assert.equal(r.checked, true);
  assert.equal(typeof r.latency_ms, 'number');
  assert.equal(b.released, true, 'the connection must be returned to the pool');
});

test('checkDependencies goes RED when the driver is missing (the 2026-08-03 failure)', async () => {
  const err = new Error("Cannot find module 'pg'");
  err.code = 'MODULE_NOT_FOUND';
  const r = await RW.checkDependencies({ pool: fakePool({ connectError: err }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'driver_not_installed');
  assert.equal(r.detail, RW.DEPENDENCY_REASONS.driver_not_installed);
});

test('checkDependencies goes RED when nothing is listening', async () => {
  const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  err.code = 'ECONNREFUSED';
  const r = await RW.checkDependencies({ pool: fakePool({ connectError: err }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'database_not_listening');
});

test('checkDependencies goes RED when credentials are rejected', async () => {
  const err = new Error('password authentication failed');
  err.code = '28P01';
  const r = await RW.checkDependencies({ pool: fakePool({ connectError: err }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'database_auth_rejected');
});

test('checkDependencies goes RED when the connection opens but the query fails', async () => {
  const r = await RW.checkDependencies({ pool: fakePool({ queryError: new Error('read-only transaction aborted') }) });
  assert.equal(r.ok, false, 'connecting is not the same as being able to read');
});

test('checkDependencies goes RED - not hung - when the database is too slow to answer', async () => {
  const started = Date.now();
  const r = await RW.checkDependencies({ pool: fakePool({ slowConnectMs: 250 }), timeoutMs: 40 });
  const elapsed = Date.now() - started;
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'database_timeout');
  assert.ok(elapsed < 200, 'the check must bound its own wait, not inherit the database\'s: ' + elapsed + 'ms');
  // Let the slow connect settle before the test ends, so the late resolution cannot be reported
  // against an unrelated test.
  await new Promise(function (r2) { setTimeout(r2, 300); });
});

test('checkDependencies NEVER throws, whatever the pool does', async () => {
  const exploding = { connect: function () { throw new Error('synchronous explosion'); } };
  const r = await RW.checkDependencies({ pool: exploding });
  assert.equal(r.ok, false, 'a health check that throws cannot report ill health');
});

test('checkDependencies never returns a connection string', async () => {
  const err = new Error('connect ECONNREFUSED postgres://user:pw@host:5432/db');
  err.code = 'ECONNREFUSED';
  const r = await RW.checkDependencies({ pool: fakePool({ connectError: err }) });
  const blob = JSON.stringify(r);
  assert.ok(!blob.includes('user:pw'), 'credentials leaked out of the dependency check');
  assert.ok(blob.includes('[redacted-connection-string]'));
});
