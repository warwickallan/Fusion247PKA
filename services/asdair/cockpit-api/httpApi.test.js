// BUILD-015 - cockpit-api/httpApi.test.js
//
// The transport. Offline: no socket, no DB, no pipeline - handleRequest is
// called directly with injected dependencies.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { handleRequest, resolveMediaPath, ROUTES } = require('./httpApi');
const commandSurface = require('./commandSurface');
const { COMMAND_NAMES } = commandSurface;

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
  // WP-B15-48 AC6. This said `true` while POST /asdair/list was writing shops.
  // The literal moved because the fact moved, and the pin is what forced the
  // question to be asked.
  assert.equal(res.body.read_only, false);
  assert.deepEqual(res.body.command_names, COMMAND_NAMES);
  assert.equal(res.body.dependencies[0].dependency, 'database');
  assert.equal(res.body.dependencies[0].checked, true);
});

// ── WP-B15-48 AC6. `command_surface_bound` MUST MEAN "DISPATCH WOULD WORK" ──
//
// It used to mean "a file exists on disk" (`require.resolve`, which never
// evaluates the module) or, on the injected branch, literally nothing at all -
// `d.commands ? true` asserted no property whatsoever of what was injected.
//
// THE MUTATIONS BELOW ARE THE PROOF. Each hands health a surface that is
// PRESENT but UNUSABLE - exactly the case the old check could not see - and
// requires the flag to go false and the service to answer 503. Under the old
// implementation every one of these returned `command_surface_bound: true`.

test('AC6: a surface that is present but MISSING A COMMAND is reported unbound, not bound', async () => {
  const broken = {};
  COMMAND_NAMES.forEach((n) => { broken[n] = async () => ({}); });
  delete broken.receiveList;                       // present, loadable, and unusable

  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    {
      commands: broken,
      checkDependencies: async () => ({ ok: true, dependency: 'database', checked: true, latency_ms: 3 })
    }
  );
  assert.equal(res.body.command_surface_bound, false, 'the old require.resolve check said TRUE here');
  assert.equal(res.status, 503, 'a service whose commands cannot dispatch is not healthy');
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'command_surface_unbound');
  assert.match(res.body.message, /nothing sent from the cockpit would be applied/i);
});

test('AC6: a surface carrying a FORBIDDEN command is reported unbound', async () => {
  const rogue = {};
  COMMAND_NAMES.forEach((n) => { rogue[n] = async () => ({}); });
  rogue.checkoutBasket = async () => ({});

  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    {
      commands: rogue,
      checkDependencies: async () => ({ ok: true, dependency: 'database', checked: true })
    }
  );
  assert.equal(res.body.command_surface_bound, false);
  assert.equal(res.status, 503);
});

test('AC6: a database that is UP and a surface that is DOWN are reported as different failures', async () => {
  const broken = {};
  COMMAND_NAMES.forEach((n) => { broken[n] = async () => ({}); });
  delete broken.buildShop;

  const surfaceDown = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { commands: broken, checkDependencies: async () => ({ ok: true, dependency: 'database', checked: true }) }
  );
  const dbDown = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => ({ ok: false, dependency: 'database', checked: true, detail: 'nothing is listening' }) }
  );

  assert.equal(surfaceDown.body.error, 'command_surface_unbound');
  assert.equal(dbDown.body.error, 'dependency_unavailable');
  assert.notEqual(surfaceDown.body.message, dbDown.body.message,
    'one message covering both failures would name neither');
});

test('AC6: the health flag tracks the REAL module when nothing is injected', async () => {
  const res = await handleRequest(
    { method: 'GET', path: '/asdair/health' },
    { checkDependencies: async () => ({ ok: true, dependency: 'database', checked: true }) }
  );
  // The real pipeline module is on this checkout and does expose the surface,
  // so this is true - and it is true because it was LOADED and ASSERTED.
  assert.equal(res.body.command_surface_bound, commandSurface.isDispatchable());
  assert.equal(res.body.command_surface_bound, true);
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
  // resolution routes (7 -> 10), then WP-B15-48's write door (10 -> 11), then
  // WP-B15-50's sense-check (11 -> 12), and then WP-B15-51's display-name
  // write (12 -> 13).
  // Each time the number was changed on purpose, in the same commit as the
  // route, which is exactly what the pin is for.
  assert.equal(ROUTES.length, 13);
  assert.ok(ROUTES.includes('POST /asdair/list'));
  assert.ok(ROUTES.includes('POST /asdair/check-item'));
  assert.ok(ROUTES.includes('POST /asdair/display-name'));
  assert.ok(ROUTES.includes('GET /asdair/rules'));
  assert.ok(ROUTES.includes('GET /asdair/packet'));
  assert.ok(ROUTES.includes('GET /asdair/checklist'));
  assert.ok(ROUTES.includes('POST /asdair/answer'));
  assert.ok(ROUTES.includes('POST /asdair/answer/choose'));
  assert.ok(ROUTES.includes('POST /asdair/answer/skip'));
  // The header comment above ROUTES states a count in prose. Prose rots; this
  // asserts the two agree, which is why the header's stale "THREE" cannot recur.
  const header = require('node:fs').readFileSync(require('node:path').join(__dirname, 'httpApi.js'), 'utf8');
  assert.ok(/THIRTEEN ROUTES/.test(header), 'the header route count no longer matches ROUTES.length');
});

// =====================================================================
// WP-B15-51 AC4 - POST /asdair/display-name
//
// What MUM READS, set by WARWICK. The route's whole job is to be narrow: two
// keys in, one column changed.
// =====================================================================

/** A stub write connection that records what the route asked to run. */
function recordingWrite(rows) {
  const seen = [];
  const writeQuery = async (sql, params) => {
    seen.push({ sql, params });
    return { rows: rows === undefined ? [{ id: 4, display_name: 'Milk' }] : rows };
  };
  return { writeQuery, seen };
}

test('POST /asdair/display-name saves the name and answers with what was stored', async () => {
  const w = recordingWrite();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: { id: 4, display_name: '  Milk  ' } },
    { writeQuery: w.writeQuery }
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, id: 4, display_name: 'Milk' });
  assert.deepEqual(w.seen[0].params, ['Milk', 4]);
});

test('AC4: a body carrying name and aka changes neither - they never reach the statement', async () => {
  const w = recordingWrite();
  const res = await handleRequest(
    {
      method: 'POST',
      path: '/asdair/display-name',
      // The hostile body the Work Order named.
      body: { id: 4, display_name: 'Milk', name: 'HACKED', aka: ['hacked'] }
    },
    { writeQuery: w.writeQuery }
  );
  assert.equal(res.status, 200);
  assert.equal(w.seen.length, 1);
  // One statement, and neither forbidden column appears as an assignment or a
  // parameter. `display_name` is stripped before the `name` check so its own
  // substring cannot mask a real `name =`.
  const bare = w.seen[0].sql.replace(/display_name/g, 'COL');
  assert.ok(!/\bname\s*=/.test(bare), 'the route assigned `name`');
  assert.ok(!/\baka\s*=/.test(bare), 'the route assigned `aka`');
  assert.deepEqual(w.seen[0].params, ['Milk', 4], 'a forbidden value reached the parameters');
});

test('POST /asdair/display-name: null clears it', async () => {
  const w = recordingWrite([{ id: 4, display_name: null }]);
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: { id: 4, display_name: null } },
    { writeQuery: w.writeQuery }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.display_name, null);
  assert.equal(w.seen[0].params[0], null);
});

test('POST /asdair/display-name: an over-long name is a 400 with a plain sentence, not a truncation', async () => {
  const w = recordingWrite();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: { id: 4, display_name: 'x'.repeat(200) } },
    { writeQuery: w.writeQuery }
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'display_name_too_long');
  assert.equal(typeof res.body.message, 'string');
  assert.equal(w.seen.length, 0, 'nothing should have been written');
});

test('POST /asdair/display-name: a GET is 405 and bad JSON is 400', async () => {
  const w = recordingWrite();
  const get = await handleRequest({ method: 'GET', path: '/asdair/display-name' }, { writeQuery: w.writeQuery });
  assert.equal(get.status, 405);
  assert.equal(get.body.error, 'method_not_allowed');

  const bad = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: '{not json' },
    { writeQuery: w.writeQuery }
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_json');
  assert.equal(w.seen.length, 0);
});

test('POST /asdair/display-name: an unknown catalogue id is refused, never a quiet success', async () => {
  const w = recordingWrite([]);
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: { id: 999999, display_name: 'Milk' } },
    { writeQuery: w.writeQuery }
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'regular_not_found');
});

test('POST /asdair/display-name: a database failure never leaks a connection string', async () => {
  const writeQuery = async () => {
    throw new Error('connect ECONNREFUSED postgresql://asdair_rw:hunter2@127.0.0.1:55432/asdair_test');
  };
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/display-name', body: { id: 4, display_name: 'Milk' } },
    { writeQuery }
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'display_name_failed');
  assert.ok(!/hunter2/.test(res.body.message), 'a credential reached the response');
  assert.match(res.body.message, /\[redacted-connection-string\]/);
});

// =====================================================================
// WP-B15-48 AC3 - POST /asdair/list, THE WRITE DOOR
//
// Offline: `commands` is injected, so nothing here opens a pool. The live
// HTTP-and-Postgres proof is AC5 and lives in the return.
// =====================================================================

const LIST_BODY = {
  household: 1,
  items: [{ id: '13', name: 'Arla semi-skimmed 4pt', qty: 2 }, { id: '12', name: 'Weetabix Protein', qty: 1 }]
};
const AT = () => '2026-08-13T09:15:00.000Z';

/** A stub surface whose receiveList returns whatever the store would have. */
function listCommands(receipt, seen) {
  const mod = {};
  COMMAND_NAMES.forEach((n) => { mod[n] = async () => ({}); });
  mod.receiveList = async (spec, deps) => {
    if (seen) seen.push({ spec: spec, deps: deps });
    return receipt;
  };
  return mod;
}

const CREATED = {
  ok: true, command: 'receiveList', shop_id: 41, shop_ref: 'SHOP-2026-08-13', household_id: 1,
  status: 'RECEIVED', created: true, resumed: false, matched_by: 'insert',
  source_id: 'cockpit:mum:list:36c46f6a78207ba6', superseded_terminal_ref: null, duplicate: false
};
const RESUMED = Object.assign({}, CREATED, {
  created: false, resumed: true, matched_by: 'shop_ref', duplicate: true
});

test('AC3: a POST creates a shop and reports created:true with the store\'s own matched_by', async () => {
  const seen = [];
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    { commands: listCommands(CREATED, seen), commandDeps: null, now: AT }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.created, true);
  assert.equal(res.body.shop_ref, 'SHOP-2026-08-13');
  assert.equal(res.body.shop_id, 41);
  assert.equal(res.body.matched_by, 'insert');
  assert.equal(res.body.items, 2);
  // The route holds no logic: what reached the command is the adapter's spec.
  assert.equal(seen[0].spec.actor, 'cockpit:mum');
  assert.equal(seen[0].spec.sourceKind, 'text');
  assert.equal(seen[0].spec.listDate, '2026-08-13');
  assert.equal(seen[0].spec.rawText, '2 x Arla semi-skimmed 4pt\n1 x Weetabix Protein');
});

test('AC4: a RESUMED submission reports created:false - the UI may not call that "sent"', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    { commands: listCommands(RESUMED), commandDeps: null, now: AT }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  // ok:true ALONE never licenses the word "sent" (route contract v2). `created`
  // is the field that decides, and it is taken from the store, never inferred.
  assert.equal(res.body.created, false);
  assert.equal(res.body.matched_by, 'shop_ref');
  assert.equal(res.body.duplicate, true);
});

test('AC3: matched_by is passed through VERBATIM - no translation layer, no invented words', async () => {
  const vocab = ['insert', 'shop_ref', 'telegram_message'];
  for (const word of vocab) {
    const res = await handleRequest(
      { method: 'POST', path: '/asdair/list', body: LIST_BODY },
      { commands: listCommands(Object.assign({}, CREATED, { matched_by: word })), commandDeps: null, now: AT }
    );
    assert.equal(res.body.matched_by, word, word + ' must survive the route unchanged');
  }
  // And the fourth value in the contract's type is reported when the store had
  // to start a fresh shop because a terminal one owned the date.
  const superseded = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    {
      commands: listCommands(Object.assign({}, CREATED, { superseded_terminal_ref: 'SHOP-2026-08-13' })),
      commandDeps: null, now: AT
    }
  );
  assert.equal(superseded.body.matched_by, 'superseded_terminal_ref');
  assert.equal(superseded.body.superseded_terminal_ref, 'SHOP-2026-08-13');
});

test('AC3: the stamp is taken ONCE at the edge and decides the week', async () => {
  const seen = [];
  await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    { commands: listCommands(CREATED, seen), commandDeps: null, now: () => '2019-01-02T23:00:00.000Z' }
  );
  assert.equal(seen[0].spec.listDate, '2019-01-02');
});

test('AC3: every refusal arrives as the JSON error shape, never as bare text', async () => {
  const cases = [
    [{ household: 1, items: [] }, 400, 'list_empty'],
    [{ household: 1, items: [{ name: 'milk', qty: 99 }] }, 400, 'list_qty_invalid'],
    [{ items: LIST_BODY.items }, 400, 'household_missing'],
  ];
  for (const [body, status, code] of cases) {
    const res = await handleRequest(
      { method: 'POST', path: '/asdair/list', body: body },
      { commands: listCommands(CREATED), commandDeps: null, now: AT }
    );
    assert.equal(res.status, status);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, code);
    assert.equal(typeof res.body.message, 'string');
    assert.ok(res.body.message.length > 0);
  }
});

test('AC3: the list route is POST only, and bad JSON is refused as JSON', async () => {
  const get = await handleRequest({ method: 'GET', path: '/asdair/list' }, { commandDeps: null });
  assert.equal(get.status, 405);
  assert.equal(get.body.error, 'method_not_allowed');

  const bad = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: '{not json' },
    { commands: listCommands(CREATED), commandDeps: null, now: AT }
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_json');
});

test('AC3: a missing connection string is 503 not_configured, and never leaks the string', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    {
      commands: listCommands(CREATED),
      now: AT,
      dispatch: async () => { throw Object.assign(new Error('ASDAIR_WRITE_DB_URL is not set'), { code: 'ASDAIR_CONFIG_MISSING' }); }
    }
  );
  assert.equal(res.status, 503, 'a missing connection string is a configuration failure, not a bad request');
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'not_configured');
  // It names the VARIABLE and never a value - the operator is left in no doubt
  // which one, and the browser learns nothing.
  assert.match(res.body.message, /ASDAIR_WRITE_DB_URL/);
});

test('AC3: a leaked connection string is scrubbed out of a list failure', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    {
      commandDeps: null, now: AT,
      dispatch: async () => { throw new Error('connect ECONNREFUSED postgresql://user:pw@host:5432/db'); }
    }
  );
  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(res.body).includes('user:pw'));
  assert.ok(JSON.stringify(res.body).includes('[redacted-connection-string]'));
});

// ── THE TERMINAL-SHOP HOLE, AND THE PIN THAT KEEPS THE MAPPING HONEST ──────
//
// The predicate in httpApi.js matches on the message text, because shopState
// throws a plain Error with no code. This test GENERATES that error from the
// REAL shopState.collisionShopRef rather than hand-writing the string, so if
// the upstream wording ever changes, this goes red HERE instead of the
// condition silently becoming a 500 in front of an 84-year-old.
test('AC4: a cancelled week is a named 409, and the real upstream error still matches', async () => {
  const shopState = require('../shop/shopState');
  let realError = null;
  try {
    // Exactly what shopStore does for a Cockpit submission whose date is held
    // by a TERMINAL shop: no Telegram message id to ground a fresh identity on.
    shopState.collisionShopRef('SHOP-2026-08-13', null);
  } catch (err) {
    realError = err;
  }
  assert.ok(realError, 'collisionShopRef must still refuse without a message id');

  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    { commandDeps: null, now: AT, dispatch: async () => { throw realError; } }
  );
  assert.equal(res.status, 409, 'a dead week is a conflict, not a crash');
  assert.equal(res.body.error, 'shop_already_finished');
  assert.match(res.body.message, /already been finished or cancelled/i);
  // Her sentence never mentions a ref, a message id or a collision.
  assert.doesNotMatch(res.body.message, /shop_ref|SHOP-|message id|collision/i);
  // And nothing was invented to route around it.
  assert.equal(res.body.shop_ref, undefined);
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

// =====================================================================
// WP-B15-50 AC1/AC2 - POST /asdair/check-item, THE SENSE-CHECK
//
// The route-level half of the proof. checkItem.test.js proves the
// classification and the seal; these prove the TRANSPORT cannot widen either,
// and that a failure on this route never blocks her.
// =====================================================================

const CHECK_REGULARS = [
  { id: 11, name: 'Semi skimmed milk 4 pints', aka: ['milk'] },
  { id: 21, name: 'Yazoo chocolate milkshake', aka: ['shake'] },
  { id: 22, name: 'Yazoo strawberry milkshake', aka: ['shake'] }
];

function checkDeps(overrides) {
  return Object.assign({ loadRegulars: async () => CHECK_REGULARS }, overrides || {});
}

test('AC1: POST /asdair/check-item names what she already has', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'milk', chosen: [] } },
    checkDeps()
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'matched');
  assert.equal(res.body.matched_name, 'Semi skimmed milk 4 pints');
  assert.equal(res.body.matched_regular_id, 11);
  assert.equal(res.body.already_on_list, false);
});

test('AC1: `chosen` is what makes possible_duplicate reachable through the route', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'milk', chosen: ['11'] } },
    checkDeps()
  );
  assert.equal(res.body.status, 'possible_duplicate');
  assert.equal(res.body.already_on_list, true);
});

test('AC2: an ambiguous term returns a status and NOTHING she must decide', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'shake', chosen: [] } },
    checkDeps()
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'needs_confirmation');
  assert.equal(res.body.matched_name, null);
  assert.equal(res.body.matched_regular_id, null);
  // ⛔ THE WHOLE RESPONSE, KEY BY KEY. The contract's five and nothing else -
  // so a candidate list cannot ride along under any name.
  assert.deepEqual(Object.keys(res.body).sort(),
    ['already_on_list', 'matched_name', 'matched_regular_id', 'ok', 'status']);
  assert.ok(!/alternat/i.test(JSON.stringify(res.body)));
});

test('AC2: EVERY status is exercised through the route and none carries a list', async () => {
  const cases = [
    { text: 'milk', chosen: [], expect: 'matched' },
    { text: 'milk', chosen: ['11'], expect: 'possible_duplicate' },
    { text: 'shake', chosen: [], expect: 'needs_confirmation' },
    { text: 'some of those little cakes', chosen: [], expect: 'unmatched_new_item' },
    { text: '...', chosen: [], expect: 'unreadable' }
  ];
  let exercised = 0;
  for (const c of cases) {
    const res = await handleRequest(
      { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: c.text, chosen: c.chosen } },
      checkDeps()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.status, c.expect);
    for (const k of Object.keys(res.body)) {
      const v = res.body[k];
      assert.ok(v === null || ['string', 'number', 'boolean'].includes(typeof v),
        'a non-leaf value escaped on ' + c.expect + ' under key ' + k);
    }
    exercised += 1;
  }
  // A sweep that silently covered zero cases is a failing sweep.
  assert.equal(exercised, 5);
});

test('AC1: the sense-check route dispatches NO command - it cannot write', async () => {
  let dispatched = 0;
  await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'milk' } },
    checkDeps({ dispatch: async () => { dispatched += 1; return {}; } })
  );
  assert.equal(dispatched, 0, 'the sense-check must never reach the command surface');
});

test('AC1: an empty term is a plain 400 about HER input, never a 500', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: '   ' } },
    checkDeps()
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'no_text');
});

test('AC1: an unconfigured reader answers 503 not_configured, in words', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'milk' } },
    checkDeps({ loadRegulars: async () => { throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string'); } })
  );
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'not_configured');
});

test('AC1: a database failure is a scrubbed 500 - the connection string never reaches her', async () => {
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/check-item', body: { household: 1, text: 'milk' } },
    checkDeps({ loadRegulars: async () => { throw new Error('connect ECONNREFUSED postgresql://asdair_ro:test@127.0.0.1:55432/asdair_test'); } })
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'check_failed');
  assert.ok(!/asdair_ro:test/.test(JSON.stringify(res.body)));
});

test('AC1: GET on the sense-check route is 405, not a silent read', async () => {
  const res = await handleRequest({ method: 'GET', path: '/asdair/check-item' }, checkDeps());
  assert.equal(res.status, 405);
});
