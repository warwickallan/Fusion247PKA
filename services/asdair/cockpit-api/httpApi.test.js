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

// ── HEALTH IS DEPENDENCY-AWARE ────────────────────────────────────────────
// The test that used to live here was called "health reports the surface
// WITHOUT TOUCHING A DATABASE", and it passed throughout the 2026-08-03
// incident in which /asdair/health returned ok:true while /asdair/workspace
// was 500-ing on a missing `pg` module. The test was not wrong about the code;
// it was asserting the defect. It is replaced rather than amended, because
// keeping a green test over that behaviour is how the false green survived.
//
// checkDependencies is INJECTED here so these stay offline. The real one is
// exercised in readWorkspace.test.js.

test('health is 200 and ok when its dependency is reachable', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => ({ ok: true, dependency: 'database', checked: true, latency_ms: 3 }) }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.read_only, true);
  assert.deepEqual(res.body.command_names, COMMAND_NAMES);
  assert.equal(res.body.dependencies[0].dependency, 'database');
  assert.equal(res.body.dependencies[0].checked, true);
});

// THE MUTATION. Break the dependency and prove health goes red. This is the
// exact 2026-08-03 failure: the driver module was not installed.
test('health goes RED when the database driver is missing (the 2026-08-03 failure)', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => ({
      ok: false, dependency: 'database', checked: true, reason: 'driver_not_installed',
      detail: 'the PostgreSQL driver is not installed for this service',
      message: "Cannot find module 'pg'" }) }
  );
  assert.equal(res.status, 503, 'an unhealthy reader must NOT answer 200');
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'dependency_unavailable');
  assert.match(res.body.message, /cannot reach its database/i);
  assert.equal(res.body.dependencies[0].reason, 'driver_not_installed');
});

test('health goes RED when the database is not listening', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => ({
      ok: false, dependency: 'database', checked: true, reason: 'database_not_listening',
      detail: 'nothing is listening on the configured database address' }) }
  );
  assert.equal(res.status, 503);
  assert.equal(res.body.ok, false);
});

test('health NEVER answers ok:true when the dependency check throws', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => { throw new Error('exploded'); } }
  );
  assert.equal(res.status, 503, 'a thrown check must not fall through to a reassuring green');
  assert.equal(res.body.ok, false);
  assert.equal(res.body.dependencies[0].reason, 'check_failed');
});

test('an unhealthy health response never leaks a connection string', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => { throw new Error('connect ECONNREFUSED postgres://user:pw@host:5432/db'); } }
  );
  assert.equal(res.status, 503);
  const blob = JSON.stringify(res.body);
  assert.ok(!blob.includes('user:pw'), 'credentials leaked into the health response');
  assert.ok(blob.includes('[redacted-connection-string]'));
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
  // Pinned to a LITERAL so growing the surface is a deliberate edit here, never
  // a silent side effect. It has already done that job FOUR times: adding
  // GET /asdair/rules failed this line before anything else noticed, then
  // GET /asdair/packet, then GET /asdair/checklist, and then WP-B15-41's three
  // resolution routes (7 -> 10). Each time the number was changed on purpose,
  // in the same commit as the route, which is exactly what the pin is for.
  assert.equal(ROUTES.length, 10);
  assert.ok(ROUTES.includes('GET /asdair/rules'));
  assert.ok(ROUTES.includes('GET /asdair/packet'));
  assert.ok(ROUTES.includes('GET /asdair/checklist'));
  assert.ok(ROUTES.includes('POST /asdair/answer'));
  assert.ok(ROUTES.includes('POST /asdair/answer/choose'));
  assert.ok(ROUTES.includes('POST /asdair/answer/skip'));
  // The header comment above ROUTES states a count in prose. Prose rots; this
  // asserts the two agree, which is why the header's stale "THREE" cannot recur.
  const header = require('node:fs').readFileSync(require('node:path').join(__dirname, 'httpApi.js'), 'utf8');
  assert.ok(/TEN ROUTES/.test(header), 'the header route count no longer matches ROUTES.length');
});

test('the packet route forwards the reader payload verbatim', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/packet', query: { shop: '6' } },
    { readPacket: async (opts) => ({ ok: true, echoed: opts, packet: null, packet_state: 'not_built' }) }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.echoed.shop, '6');
  assert.equal(res.body.packet, null);
});

test('a packet read failure never leaks a connection string', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/packet', query: { shop: '6' } },
    { readPacket: async () => { throw new Error('connect ECONNREFUSED postgres://user:pw@host:5432/db'); } }
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'read_failed');
  assert.ok(!JSON.stringify(res.body).includes('user:pw'));
});

// ---------------------------------------------------------------------
// RULES. The rulebook read. Same contract as /asdair/workspace: an injectable
// reader, a forwarded payload, and a failure that never leaks a connection
// string.
// ---------------------------------------------------------------------
test('the rules route forwards the reader payload and passes the household through', async () => {
  let seen = null;
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/rules', query: { household: '1' } },
    { readRules: async (opts) => { seen = opts; return { ok: true, rules: { total_display: '7' } }; } }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.rules.total_display, '7');
  assert.equal(seen.household_id, '1');
});

test('the rules route with no household asks for null, never a guessed id', async () => {
  let seen = 'untouched';
  await handleRequest(
    { method: 'GET', path: '/asdair/rules' },
    { readRules: async (opts) => { seen = opts.household_id; return { ok: true }; } }
  );
  assert.equal(seen, null);
});

test('a failing rules read is a scrubbed 500, never a stack or a connection string', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/rules' },
    { readRules: async () => { throw new Error('connect failed for postgresql://user:pw@host/db'); } }
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'read_failed');
  assert.ok(!/postgres/i.test(res.body.message), 'connection string reached the response');
  assert.match(res.body.message, /\[redacted-connection-string\]/);
});

test('the rules route is READ-only — a POST to it is not a way in', async () => {
  const res = await handleRequest({ method: 'POST', path: '/asdair/rules', body: {} });
  assert.equal(res.status, 404);
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

// ── THE CHECKLIST ROUTE ───────────────────────────────────────────────────
// Markdown for a person on a phone; ?format=json for a caller that wants the
// state. A state that is not `ready` is still a 200, because "not handed over
// yet" is a true answer to a well-formed question, not a broken link.

test('GET /asdair/checklist serves the checklist as MARKDOWN, not as JSON', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/checklist', query: { shop: '1' } },
    { readChecklist: async () => ({ ok: true, state: 'ready', markdown: '# ASDA basket - SHOP-X\n- [ ] 1. milk' }) }
  );
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/markdown/);
  assert.equal(res.body, '# ASDA basket - SHOP-X\n- [ ] 1. milk');
  assert.equal(typeof res.body, 'string', 'a phone must not have to unwrap JSON to read a shopping list');
});

test('GET /asdair/checklist?format=json returns the state and counts', async () => {
  const payload = { ok: true, state: 'ready', markdown: '# x', lines_count: 4, packet_fingerprint: 'abc' };
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/checklist', query: { shop: '1', format: 'json' } },
    { readChecklist: async () => payload }
  );
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(res.body.lines_count, 4);
});

test('a shop with no handover answers 200 with the REASON - never an empty list', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/checklist', query: { shop: '1' } },
    { readChecklist: async () => ({ ok: true, state: 'not_handed_over', markdown: null, message: 'This shop has not been handed over to the browser step yet.' }) }
  );
  assert.equal(res.status, 200, '"not yet" is a true answer, not a 404');
  assert.match(res.body, /No checklist yet/);
  assert.match(res.body, /has not been handed over/, 'the reason must reach the page');
});

test('a read failure on the checklist route is a scrubbed 500, never a stack', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/checklist', query: { shop: '1' } },
    { readChecklist: async () => { throw new Error('connect ECONNREFUSED postgres://u:p@h/db'); } }
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'read_failed');
  assert.ok(!/postgres:\/\/u:p/.test(JSON.stringify(res.body)), 'a connection string must never reach a browser');
});
