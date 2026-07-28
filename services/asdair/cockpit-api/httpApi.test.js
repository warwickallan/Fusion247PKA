// BUILD-015 - cockpit-api/httpApi.test.js
//
// The transport. Offline: no socket, no DB, no pipeline - handleRequest is
// called directly with injected dependencies.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { handleRequest, resolveMediaPath, ROUTES } = require('./httpApi');
const { COMMAND_NAMES } = require('./commandSurface');

function stubCommands(seen) {
  const mod = {};
  COMMAND_NAMES.forEach((n) => { mod[n] = async (args) => { seen.push({ name: n, args: args }); return { accepted: true }; }; });
  return mod;
}

test('health reports the surface without touching a database', async () => {
  const res = await handleRequest({ method: 'GET', path: '/asdair/health' });
  assert.equal(res.status, 200);
  assert.equal(res.body.read_only, true);
  assert.deepEqual(res.body.command_names, COMMAND_NAMES);
});

test('the workspace route returns the reader payload verbatim', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/workspace', query: { shop: 'SHOP-2026-07-28' } },
    { readWorkspace: async (opts) => ({ ok: true, echoed: opts }) }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.echoed.shop, 'SHOP-2026-07-28');
});

test('a read failure is reported without leaking a connection string', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/workspace' },
    { readWorkspace: async () => { throw new Error('connect ECONNREFUSED postgres://user:pw@host:5432/db'); } }
  );
  assert.equal(res.status, 500);
  assert.ok(!/pw@host/.test(res.body.message));
  assert.match(res.body.message, /redacted-connection-string/);
});

test('a command from the shared surface is forwarded, stamped with the calling surface', async () => {
  const seen = [];
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/command', body: { command: 'answerQuestion', args: { question_key: 'q1', answer: 'the blue one' }, idempotency_key: 'k-1' } },
    { commands: stubCommands(seen) }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.command, 'answerQuestion');
  assert.equal(seen[0].name, 'answerQuestion');
  assert.equal(seen[0].args.question_key, 'q1');
  assert.equal(seen[0].args.requested_by, 'cockpit:warwick');
  assert.equal(seen[0].args.idempotency_key, 'k-1');
});

test('every command the workspace offers is routable', async () => {
  const seen = [];
  const commands = stubCommands(seen);
  for (const name of COMMAND_NAMES) {
    const res = await handleRequest({ method: 'POST', path: '/asdair/command', body: { command: name } }, { commands: commands });
    assert.equal(res.status, 200, name + ' should be routable');
  }
  assert.deepEqual(seen.map((s) => s.name), [...COMMAND_NAMES]);
});

test('an unknown or forbidden command is refused with the real surface listed', async () => {
  for (const bad of ['checkout', 'payNow', 'bookSlot', 'doTheShopping', '', null, 42]) {
    const res = await handleRequest({ method: 'POST', path: '/asdair/command', body: { command: bad } }, { commands: stubCommands([]) });
    assert.equal(res.status, 400, JSON.stringify(bad) + ' must be refused');
    assert.equal(res.body.error, 'unknown_command');
    assert.deepEqual(res.body.command_names, COMMAND_NAMES);
  }
});

test('the command route is POST only, and bad JSON is refused', async () => {
  const get = await handleRequest({ method: 'GET', path: '/asdair/command' }, { commands: stubCommands([]) });
  assert.equal(get.status, 405);
  const bad = await handleRequest({ method: 'POST', path: '/asdair/command', body: 'not json' }, { commands: stubCommands([]) });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_json');
});

test('an unbound pipeline is a 503 the UI can explain, not a silent success', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/command', body: { command: 'buildShop' } },
    { dispatch: async () => { const e = new Error('not bound'); e.code = 'ASDAIR_COMMANDS_NOT_BOUND'; throw e; } }
  );
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'ASDAIR_COMMANDS_NOT_BOUND');
});

test('an unknown route is a 404 that names the whole surface', async () => {
  const res = await handleRequest({ method: 'GET', path: '/asdair/checkout' });
  assert.equal(res.status, 404);
  assert.deepEqual(res.body.routes, ROUTES);
  assert.equal(ROUTES.length, 4);
});

// ---------------------------------------------------------------------
// MEDIA. The request names a SHOP; the database names the FILE.
// ---------------------------------------------------------------------
test('media is disabled unless a root is configured', () => {
  assert.deepEqual(resolveMediaPath('lists/a.jpg', null), { ok: false, reason: 'media_root_not_configured' });
  assert.deepEqual(resolveMediaPath('lists/a.jpg', '  '), { ok: false, reason: 'media_root_not_configured' });
});

test('a shop with no retained media is honest about it', () => {
  assert.deepEqual(resolveMediaPath(null, '/data/asdair'), { ok: false, reason: 'no_media_retained' });
  assert.deepEqual(resolveMediaPath('', '/data/asdair'), { ok: false, reason: 'no_media_retained' });
});

test('a stored path is resolved INSIDE the media root', () => {
  const root = path.resolve('/data/asdair');
  const out = resolveMediaPath('lists/2026-07-28.jpg', root);
  assert.equal(out.ok, true);
  assert.equal(out.path, path.join(root, 'lists', '2026-07-28.jpg'));
});

test('a stored path that escapes the root is refused', () => {
  const root = path.resolve('/data/asdair');
  ['../../etc/passwd', 'lists/../../../etc/passwd', path.resolve('/etc/passwd')].forEach((p) => {
    assert.equal(resolveMediaPath(p, root).ok, false, p + ' should be refused');
  });
  // A sibling directory whose name merely starts with the root must not pass.
  assert.equal(resolveMediaPath('../asdair-backup/x.jpg', root).ok, false);
});
