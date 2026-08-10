// =====================================================================
// cockpit-api/server.test.js - THE BINDER'S ONE RULE: a markdown body goes out
// as markdown.
//
// WHY THIS FILE EXISTS. server.js had no test at all, and the defect it hid was
// not subtle: `JSON.stringify(out.body)` was applied to EVERY routed answer,
// including httpApi.markdown()'s string bodies. The checklist - the page a
// person reads standing in a shop - was served under `text/markdown` as a JSON
// string literal: wrapped in double quotes, every newline a literal backslash-n.
// Confirmed against the LIVE service before the fix.
//
// httpApi.test.js could never have caught it. It tests the router, and the
// router was always right: it returned a plain string and the correct header.
// The corruption happened one layer below, in a closure with no seam. So this
// file tests the BINDER, over a real socket.
//
// THE ROUTE USED HERE TOUCHES NO DATABASE. `GET /asdair/checklist` with no
// `shop` returns markdown(400, ...) from readChecklist's own early return,
// before any pool is opened - so this is a genuine end-to-end through
// createServer(), handleRequest() and send(), with no Postgres anywhere.
//
// PURE ASCII.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { createServer, _internal } = require('./server');

function get(port, path) {
  return new Promise(function (resolve, reject) {
    const req = http.request({ host: '127.0.0.1', port: port, path: path, method: 'GET' }, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve({ status: res.statusCode, headers: res.headers, body: body }); });
    });
    req.on('error', reject);
    req.end();
  });
}

test('serialiseBody writes a string body verbatim - no quotes, real newlines', function () {
  const markdown = '# Checklist\n\n- 2 x Milk\n- 1 x Bread\n';
  const out = _internal.serialiseBody(markdown);
  assert.strictEqual(out, markdown);
  assert.ok(!out.startsWith('"'), 'a markdown body must not be wrapped in JSON quotes');
  assert.ok(out.indexOf('\\n') === -1, 'a markdown body must not carry literal backslash-n');
  assert.ok(out.indexOf('\n') !== -1, 'a markdown body must carry real newlines');
});

test('serialiseBody still JSON-encodes an object body - no JSON route changes shape', function () {
  const out = _internal.serialiseBody({ ok: false, error: 'no_shop' });
  assert.strictEqual(out, '{"ok":false,"error":"no_shop"}');
  assert.deepStrictEqual(JSON.parse(out), { ok: false, error: 'no_shop' });
});

test('serialiseBody JSON-encodes the shapes a JSON route actually returns', function () {
  assert.strictEqual(_internal.serialiseBody({ ok: true, rows: [1, 2] }), '{"ok":true,"rows":[1,2]}');
  assert.strictEqual(_internal.serialiseBody(null), 'null');
  assert.strictEqual(_internal.serialiseBody([1, 2]), '[1,2]');
});

test('END TO END over a real socket: the markdown route serves real markdown', async function () {
  const server = createServer();
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const port = server.address().port;
  try {
    // No `shop`: readChecklist returns ok:false before opening any connection,
    // and httpApi answers with markdown(400, ...). No database is involved.
    const res = await get(port, '/asdair/checklist');
    assert.strictEqual(res.status, 400);
    assert.match(String(res.headers['content-type']), /text\/markdown/);
    // THE REGRESSION, stated as the wire bytes rather than as an intention.
    assert.ok(!res.body.startsWith('"'), 'body was JSON-quoted: ' + res.body.slice(0, 40));
    assert.ok(res.body.indexOf('\\n') === -1, 'body carried literal backslash-n: ' + res.body.slice(0, 60));
    assert.ok(res.body.startsWith('# '), 'body did not begin with a markdown heading: ' + res.body.slice(0, 40));
    assert.ok(res.body.indexOf('\n') !== -1, 'body carried no real newline');
  } finally {
    server.closeAllConnections();
    await new Promise(function (r) { server.close(r); });
  }
});

test('END TO END: a JSON route is unchanged - still a JSON object on the wire', async function () {
  const server = createServer();
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const port = server.address().port;
  try {
    const res = await get(port, '/asdair/health');
    assert.match(String(res.headers['content-type']), /application\/json/);
    const parsed = JSON.parse(res.body);          // throws if the shape changed
    assert.strictEqual(typeof parsed, 'object');
    assert.notStrictEqual(parsed, null);
  } finally {
    server.closeAllConnections();
    await new Promise(function (r) { server.close(r); });
  }
});
