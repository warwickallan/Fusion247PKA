// BUILD-015 WP-B15-41 - cockpit-api/answerRoutes.test.js
//
// AC3 - THE THREE RESOLUTION ROUTES, AND THE WIRING THAT HAD NEVER EXISTED.
//
// The first test in this file is the one that matters: it proves `deps` now
// reaches the command. Everything the command surface had before - the name
// list, the deny list, the binding assertion - was green while every real
// invocation would have thrown on an undefined second argument.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { handleRequest, ROUTES, ANSWER_ROUTES } = require('./httpApi');
const commandSurface = require('./commandSurface');

// A stand-in for pipeline/commands.js that RECORDS what it was called with.
function recordingCommands() {
  const calls = [];
  const stub = {};
  commandSurface.COMMAND_NAMES.forEach(function (n) {
    stub[n] = async function (spec, deps) {
      calls.push({ name: n, spec: spec, deps: deps });
      return { command: n, changed: true, already_answered: false, question_key: spec && spec.questionKey };
    };
  });
  return { stub: stub, calls: calls };
}

// ---------------------------------------------------------------------
// THE WIRING.
// ---------------------------------------------------------------------
test('AC3 THE DEFECT: commandSurface.dispatch passes deps as the SECOND argument', async () => {
  const { stub, calls } = recordingCommands();
  const deps = { marker: 'the-container' };

  await commandSurface.dispatch('answerQuestion', { questionKey: 'q1' }, { commands: stub, deps: deps });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].deps, deps,
    'the container must reach the command - without it answerQuestion throws inside store.requireShop '
    + 'before it can reach a row, which is what made the bound surface unusable');
});

test('AC3: a command invoked with no container still gets undefined, not a fabricated one', async () => {
  // commandSurface holds no connection and must never build one. Proving it
  // does NOT quietly manufacture a container is as important as proving it
  // forwards one: a self-built container is how a pure module acquires a pool.
  const { stub, calls } = recordingCommands();
  await commandSurface.dispatch('answerQuestion', { questionKey: 'q1' }, { commands: stub });
  assert.equal(calls[0].deps, undefined);
});

test('AC3: resolveCommandDeps builds nothing when the caller injected behaviour', () => {
  const { resolveCommandDeps } = require('./httpApi')._internal;
  // An injected dispatch/commands means the caller owns the implementation, so
  // no container is built - and, critically, no `pg` and no env var is touched.
  assert.equal(resolveCommandDeps({ dispatch: async () => ({}) }), undefined);
  assert.equal(resolveCommandDeps({ commands: {} }), undefined);
  // An explicit commandDeps wins, including an explicit null.
  assert.equal(resolveCommandDeps({ commandDeps: null }), null);
  assert.deepEqual(resolveCommandDeps({ commandDeps: { a: 1 } }), { a: 1 });
});

// ---------------------------------------------------------------------
// THE THREE SHAPES.
// ---------------------------------------------------------------------
test('AC3: the surface grew by three ROUTES and by zero COMMANDS', () => {
  // WP-B15-48 moved both numbers by exactly one, and neither move belongs to
  // WP-B15-41's AC3: the eleventh route is POST /asdair/list and the eleventh
  // command is `receiveList`. The pin stays, and the point of THIS test is
  // unchanged - the three ANSWER routes still land on one existing command and
  // added no command of their own.
  assert.equal(ROUTES.length, 11);
  assert.deepEqual(Object.keys(ANSWER_ROUTES).sort(),
    ['/asdair/answer', '/asdair/answer/choose', '/asdair/answer/skip']);
  // THE POINT OF AC3. All three land on one existing command.
  assert.equal(commandSurface.COMMAND_NAMES.length, 11);
  assert.ok(commandSurface.COMMAND_NAMES.includes('answerQuestion'));
  assert.ok(!commandSurface.COMMAND_NAMES.includes('chooseCandidate'));
  assert.ok(!commandSurface.COMMAND_NAMES.includes('skipThisWeek'));
});

test('AC3: free text answers with answer_source "typed"', async () => {
  const { stub, calls } = recordingCommands();
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'SHOP-2026-08-13', question_key: 'q1111427e', answer_text: 'the 500g one' }
  }, { commands: stub });

  assert.equal(res.status, 200);
  assert.equal(calls[0].name, 'answerQuestion');
  assert.equal(calls[0].spec.answerSource, 'typed');
  assert.equal(calls[0].spec.answerText, 'the 500g one');
  assert.equal(calls[0].spec.skip, false);
  assert.equal(calls[0].spec.shopRef, 'SHOP-2026-08-13');
  assert.equal(calls[0].spec.actor, 'cockpit:warwick');
});

test('AC3: choosing a candidate answers with answer_source "button"', async () => {
  const { stub, calls } = recordingCommands();
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer/choose',
    body: { shop: 'SHOP-2026-08-13', question_key: 'q1', answer_text: 'Arla semi skimmed 4pt' }
  }, { commands: stub });

  assert.equal(res.status, 200);
  assert.equal(calls[0].spec.answerSource, 'button');
  assert.equal(res.body.answer_source, 'button');
});

test('AC3: "not this week" is a real decision, recorded as skipped and carrying no answer text', async () => {
  const { stub, calls } = recordingCommands();
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer/skip',
    body: { shop: '7', question_key: 'q1' }
  }, { commands: stub });

  assert.equal(res.status, 200);
  assert.equal(calls[0].spec.skip, true);
  assert.equal(calls[0].spec.answerText, undefined, 'a skip carries no answer text');
  // An all-digit handle is an id, not a ref.
  assert.equal(calls[0].spec.shopId, 7);
  assert.equal(calls[0].spec.shopRef, undefined);
  assert.equal(res.body.skipped, true);
});

// ---------------------------------------------------------------------
// THE CONFIRMATION. `applied` is the durable outcome, not "we accepted it".
// ---------------------------------------------------------------------
test('AC3: a first answer reports applied AND changed', async () => {
  const stub = { };
  commandSurface.COMMAND_NAMES.forEach((n) => { stub[n] = async () => ({ changed: true, already_answered: false }); });
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', question_key: 'q1', answer_text: 'x' }
  }, { commands: stub });
  assert.equal(res.body.applied, true);
  assert.equal(res.body.changed, true);
  assert.equal(res.body.already_answered, false);
});

test('AC3: FIRST ANSWER WINS - a repeat is applied but NOT changed, and says so', async () => {
  const stub = { };
  commandSurface.COMMAND_NAMES.forEach((n) => { stub[n] = async () => ({ changed: false, already_answered: true }); });
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', question_key: 'q1', answer_text: 'x' }
  }, { commands: stub });
  // "You already answered this" is more truthful than silently doing nothing,
  // and more truthful than pretending it just landed.
  assert.equal(res.body.applied, true, 'the row DOES hold the answer');
  assert.equal(res.body.changed, false, 'but this request did not move it');
  assert.equal(res.body.already_answered, true);
});

test('AC3: a failure reports applied:false on EVERY error path', async () => {
  const stub = { };
  commandSurface.COMMAND_NAMES.forEach((n) => {
    stub[n] = async () => { throw new Error('store: no shop matches ref SHOP-NOPE'); };
  });
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'SHOP-NOPE', question_key: 'q1', answer_text: 'x' }
  }, { commands: stub });
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.applied, false,
    'a caller must never have to infer from an error shape whether the durable row moved');
  assert.equal(res.body.question_key, 'q1');
});

// ---------------------------------------------------------------------
// REFUSALS, BY NAME, BEFORE ANYTHING IS DISPATCHED.
// ---------------------------------------------------------------------
test('AC3: a missing shop, question or answer text is refused by name', async () => {
  const { stub } = recordingCommands();

  const noShop = await handleRequest({ method: 'POST', path: '/asdair/answer',
    body: { question_key: 'q1', answer_text: 'x' } }, { commands: stub });
  assert.equal(noShop.status, 400);
  assert.equal(noShop.body.error, 'no_shop');

  const noQ = await handleRequest({ method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', answer_text: 'x' } }, { commands: stub });
  assert.equal(noQ.status, 400);
  assert.equal(noQ.body.error, 'no_question');

  const noText = await handleRequest({ method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', question_key: 'q1', answer_text: '   ' } }, { commands: stub });
  assert.equal(noText.status, 400);
  assert.equal(noText.body.error, 'no_answer_text');
  // And it points at the route that DOES settle a question without a product,
  // so an empty answer is never the way to say "not this week".
  assert.match(noText.body.message, /\/asdair\/answer\/skip/);
});

test('AC3: skip needs no answer text', async () => {
  const { stub, calls } = recordingCommands();
  const res = await handleRequest({ method: 'POST', path: '/asdair/answer/skip',
    body: { shop: 'S1', question_key: 'q1' } }, { commands: stub });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

test('AC3: the answer routes are POST-only and reject a bad body', async () => {
  const { stub } = recordingCommands();
  const get = await handleRequest({ method: 'GET', path: '/asdair/answer' }, { commands: stub });
  assert.equal(get.status, 405);

  const bad = await handleRequest({ method: 'POST', path: '/asdair/answer', body: '{not json' }, { commands: stub });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_json');
});

test('AC3: an unconfigured writer answers 503 not_configured, in words, and applies nothing', async () => {
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', question_key: 'q1', answer_text: 'x' }
  }, {
    commandDeps: undefined,
    // No commands and no dispatch injected, but commandDeps is explicitly
    // present-and-undefined, so the real container is not built either. The
    // dispatch then fails to bind, which is the honest 503.
    dispatch: async () => { const e = new Error('ASDAIR_WRITE_DB_URL is not set'); e.code = 'ASDAIR_CONFIG_MISSING'; throw e; }
  });
  assert.equal(res.body.ok, false);
  assert.equal(res.body.applied, false);
});

test('AC3: a connection string can never reach the caller through an error', async () => {
  const stub = { };
  commandSurface.COMMAND_NAMES.forEach((n) => {
    stub[n] = async () => { throw new Error('connect failed for postgresql://asdair_rw:hunter2@10.0.0.1:5432/asdair'); };
  });
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'S1', question_key: 'q1', answer_text: 'x' }
  }, { commands: stub });
  assert.ok(!/hunter2/.test(JSON.stringify(res.body)), 'a credential must never reach a browser');
  assert.match(res.body.message, /\[redacted-connection-string\]/);
});
