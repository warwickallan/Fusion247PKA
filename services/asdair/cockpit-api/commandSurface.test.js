// BUILD-015 - cockpit-api/commandSurface.test.js
//
// The cockpit and Telegram must be two skins over ONE command surface. These
// tests fail the moment the names drift, and fail if a local fallback
// implementation is ever quietly introduced.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const CS = require('./commandSurface');

// The exact surface named in the BUILD-015 directive, written out longhand so
// this assertion is independent of the module it checks.
const EXPECTED = [
  // WP-B15-48 moved this from TEN to ELEVEN. The number was changed on purpose,
  // in the same commit as the surface, which is exactly what the pin is for.
  'receiveList',
  'confirmInterpretation',
  'correctLine',
  'buildShop',
  'answerQuestion',
  'requestBasketBuild',
  'pauseBasketBuild',
  'submitConfirmation',
  'retryStage',
  'cancelShop',
  'getStatus'
];

function stubSurface(record) {
  const mod = {};
  EXPECTED.forEach((n) => {
    mod[n] = async (args) => { if (record) record.push({ name: n, args: args }); return { ok: true, command: n }; };
  });
  return mod;
}

test('the command names match the shared surface EXACTLY - no more, no fewer', () => {
  assert.deepEqual([...CS.COMMAND_NAMES], EXPECTED);
  assert.equal(CS.COMMAND_NAMES.length, 11);
  assert.ok(Object.isFrozen(CS.COMMAND_NAMES));
});

// ---------------------------------------------------------------------
// WP-B15-48 AC1. THE SURFACE GREW BY ONE COMMAND, AND THE DENY LIST IS
// UNWEAKENED - PROVEN BY CALLING IT, NOT BY READING THE ARRAY.
//
// A test that asserts the literal FORBIDDEN_COMMAND_PATTERNS array still has
// six entries proves nothing about behaviour: the patterns could be gutted and
// the count kept. So every assertion below CALLS isForbiddenName(), which is
// the function the dispatcher actually consults, and the four names named in
// the Work Order are checked in the exact spellings it named them in.
// ---------------------------------------------------------------------
test('AC1: growing the surface did NOT weaken the deny list - the four named actions are still refused', () => {
  ['checkout', 'payNow', 'book_slot', 'submitOrder'].forEach((n) => {
    assert.equal(CS.isForbiddenName(n), true, n + ' must still be refused after the surface grew');
  });
  // And the dispatcher refuses them before anything is loaded - the deny list
  // is only worth something at the point of dispatch.
  ['checkout', 'payNow', 'book_slot', 'submitOrder'].forEach(async (n) => {
    await assert.rejects(() => CS.dispatch(n, {}, { commands: stubSurface() }),
      (err) => { assert.equal(err.code, 'ASDAIR_COMMAND_FORBIDDEN'); return true; });
  });
});

test('AC1: receiveList is a legitimate INTAKE command, on the surface and not on the deny list', () => {
  assert.ok(CS.COMMAND_NAMES.includes('receiveList'));
  assert.equal(CS.isForbiddenName('receiveList'), false);
  assert.equal(CS.isCommandName('receiveList'), true);
  // It WRITES. It must never be listed as read-only, or the HTTP layer would
  // route a write down the read path.
  assert.equal(CS.READ_ONLY_COMMANDS.includes('receiveList'), false);
});

test('AC1: the real pipeline module exports receiveList - the surface is not a promise about a stub', () => {
  if (!CS.isBound()) return;
  const mod = require(CS.PIPELINE_COMMANDS_PATH);
  assert.equal(typeof mod.receiveList, 'function');
});

test('the canonical implementation is named as services/asdair/pipeline/commands.js', () => {
  assert.match(CS.PIPELINE_COMMANDS_MODULE.replace(/\\/g, '/'), /\.\.\/pipeline\/commands\.js$/);
  assert.match(CS.PIPELINE_COMMANDS_PATH.replace(/\\/g, '/'), /services\/asdair\/pipeline\/commands\.js$/);
});

test('when the pipeline module IS present it must expose exactly this surface', () => {
  if (!CS.isBound()) {
    // Not on this checkout yet. The binding contract is asserted by the
    // not-bound test below; this is the same contract from the other side.
    assert.equal(fs.existsSync(CS.PIPELINE_COMMANDS_PATH), false);
    return;
  }
  const mod = require(CS.PIPELINE_COMMANDS_PATH);
  assert.doesNotThrow(() => CS.assertCommandSurface(mod));
  EXPECTED.forEach((n) => assert.equal(typeof mod[n], 'function', 'pipeline/commands.js is missing ' + n));
});

test('with the pipeline absent, binding fails LOUDLY - there is no local fallback', () => {
  if (CS.isBound()) return; // covered above
  assert.throws(() => CS.loadCommands(), (err) => {
    assert.equal(err.code, 'ASDAIR_COMMANDS_NOT_BOUND');
    assert.match(err.message, /pipeline\/commands\.js/);
    assert.match(err.message, /NO local fallback/);
    return true;
  });
});

test('a module missing a command is refused', () => {
  const partial = stubSurface();
  delete partial.answerQuestion;
  assert.throws(() => CS.assertCommandSurface(partial), /missing: answerQuestion/);
});

test('a module exporting a forbidden command is refused outright', () => {
  const rogue = stubSurface();
  rogue.checkoutBasket = async () => ({});
  assert.throws(() => CS.assertCommandSurface(rogue), /forbidden command/);
});

test('the deny list refuses the actions AsdAIr must never take', () => {
  ['checkout', 'checkoutBasket', 'payNow', 'makePayment', 'bookSlot', 'chooseDeliverySlot',
    'enterPassword', 'readCredential', 'placeOrder', 'driveBrowser'].forEach((n) => {
    assert.equal(CS.isForbiddenName(n), true, n + ' should be forbidden');
  });
  CS.COMMAND_NAMES.forEach((n) => {
    assert.equal(CS.isForbiddenName(n), false, n + ' is a legitimate command and must not be caught by the deny list');
  });
});

test('dispatch refuses an unknown command before loading anything', async () => {
  await assert.rejects(() => CS.dispatch('doTheShopping', {}, { commands: stubSurface() }),
    (err) => { assert.equal(err.code, 'ASDAIR_COMMAND_UNKNOWN'); return true; });
});

test('dispatch refuses a forbidden command before loading anything', async () => {
  await assert.rejects(() => CS.dispatch('checkout', {}, { commands: stubSurface() }),
    (err) => { assert.equal(err.code, 'ASDAIR_COMMAND_FORBIDDEN'); return true; });
});

test('dispatch forwards a known command to the shared implementation, unchanged', async () => {
  const seen = [];
  const out = await CS.dispatch('answerQuestion', { question_key: 'q1', answer: 'the blue one' }, { commands: stubSurface(seen) });
  assert.deepEqual(out, { ok: true, command: 'answerQuestion' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, 'answerQuestion');
  assert.deepEqual(seen[0].args, { question_key: 'q1', answer: 'the blue one' });
});

test('every command in the surface is reachable through dispatch', async () => {
  const seen = [];
  const commands = stubSurface(seen);
  for (const name of CS.COMMAND_NAMES) {
    await CS.dispatch(name, {}, { commands: commands });
  }
  assert.deepEqual(seen.map((s) => s.name), [...CS.COMMAND_NAMES]);
});

test('this module implements no shopping logic of its own', () => {
  const src = fs.readFileSync(require.resolve('./commandSurface.js'), 'utf8');
  // A local implementation would have to touch the database or a basket.
  assert.doesNotMatch(src, /require\(['"]pg['"]\)/);
  assert.doesNotMatch(src, /INSERT|UPDATE\s+asdair/i);
});
