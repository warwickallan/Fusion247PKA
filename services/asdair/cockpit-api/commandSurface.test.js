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
  // WP-B15-48 moved this from TEN to ELEVEN. WO-2026-08-19-03 moves it from
  // ELEVEN to TWELVE. Each number was changed on purpose, in the same commit as
  // the surface, which is exactly what the pin is for.
  'receiveList',
  'confirmInterpretation',
  'correctLine',
  'buildShop',
  'answerQuestion',
  // WO-2026-08-19-03 AC1. The Cockpit could not route the answer-correction
  // capability at all: the pipeline has had `correctAnswer` since 2026-08-18
  // and this surface did not, so the operation existed on Telegram and was
  // simply absent from the other control surface the goal contract names.
  'correctAnswer',
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
    // `deps` is the SECOND argument every pipeline command takes, and it
    // arriving undefined was WP-B15-41 AC3 - the surface bound, name-asserted,
    // deny-listed, and never wired. Recorded so a test can assert it arrived.
    mod[n] = async (args, deps) => {
      if (record) record.push({ name: n, args: args, deps: deps });
      return { ok: true, command: n };
    };
  });
  return mod;
}

test('the command names match the shared surface EXACTLY - no more, no fewer', () => {
  assert.deepEqual([...CS.COMMAND_NAMES], EXPECTED);
  assert.equal(CS.COMMAND_NAMES.length, 12);
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

// =====================================================================
// WO-2026-08-19-03 AC1 - THE PARITY GAP, PROVEN CLOSED AT THE SURFACE
// =====================================================================

test('AC1: correctAnswer is ON the surface - the Cockpit can name the correction capability', () => {
  assert.equal(CS.isCommandName('correctAnswer'), true,
    'the Cockpit could not route correctAnswer at all before this Work Order');
  assert.equal(CS.isForbiddenName('correctAnswer'), false);
  // It WRITES. Listing it read-only would route a write down the read path.
  assert.equal(CS.READ_ONLY_COMMANDS.includes('correctAnswer'), false);
});

test('AC1: the REAL pipeline module exports correctAnswer - the surface is not a promise about a stub', () => {
  if (!CS.isBound()) return;
  const mod = require(CS.PIPELINE_COMMANDS_PATH);
  assert.equal(typeof mod.correctAnswer, 'function',
    'adding a name this surface cannot bind to would break loadCommands() for EVERY command');
});

test('AC1: the whole surface still BINDS against the real pipeline - adding a name broke nothing', () => {
  if (!CS.isBound()) return;
  assert.equal(CS.isDispatchable(), true,
    'isDispatchable() does everything dispatch does before calling a command; false here means the '
    + 'cockpit command layer is down, not merely that one name is missing');
});

test('AC1: correctAnswer dispatches, and reaches the implementation with its deps', async () => {
  const seen = [];
  const commands = stubSurface(seen);
  const deps = { marker: 'the-container' };
  const out = await CS.dispatch('correctAnswer', { questionKey: 'q1', answerText: 'the blue one' },
    { commands: commands, deps: deps });
  assert.deepEqual(out, { ok: true, command: 'correctAnswer' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, 'correctAnswer');
  // WP-B15-41 AC3 was `deps` arriving undefined, so every real invocation threw
  // before it reached a row. Asserted here for the NEW command specifically.
  assert.equal(seen[0].deps, deps, 'correctAnswer must be called with the dependency container');
});

// =====================================================================
// WO-2026-08-19-03 AC3 - THE DENY LIST IS A CONTROL, AND THIS FAILS IF IT
// STOPS BITING.
//
// The header comment now says what the code does. That is worth nothing on its
// own: an honest comment about a control that later rots is the same defect one
// release later. These tests exist so the control cannot be gutted quietly.
//
// PINNED TO A LITERAL TABLE HELD HERE, NOT DERIVED FROM THE SOURCE IT CHECKS.
// A test that read FORBIDDEN_COMMAND_PATTERNS and asserted each pattern matched
// something it generated from that same pattern would pass over an empty list.
// =====================================================================

// One real-world spelling per forbidden CATEGORY, longhand. Deleting or
// weakening any single pattern in commandSurface.js turns one of these red.
const FORBIDDEN_BY_CATEGORY = {
  checkout: ['checkout', 'checkOut', 'check_out', 'checkoutBasket', 'startCheckout'],
  payment: ['pay', 'payNow', 'pay_now', 'PayNow', 'makePayment', 'payments', 'paying', 'purchase'],
  slot: ['slot', 'bookSlot', 'book_slot', 'chooseDeliverySlot', 'booking', 'booked'],
  credential: ['password', 'enterPassword', 'credential', 'credentials', 'readCredential',
    'secret', 'secrets', 'token', 'tokens'],
  order: ['placeOrder', 'place_order', 'submitOrder', 'orderNow'],
  autonomy: ['driveBrowser', 'drive_browser', 'autopilot', 'autonomous']
};

test('AC3/AC4: EVERY forbidden category is still refused, in every spelling that reaches a name', () => {
  let checked = 0;
  Object.keys(FORBIDDEN_BY_CATEGORY).forEach((category) => {
    FORBIDDEN_BY_CATEGORY[category].forEach((name) => {
      checked += 1;
      assert.equal(CS.isForbiddenName(name), true,
        'category "' + category + '": "' + name + '" must be refused - the deny list has stopped biting');
    });
  });
  // A loop that silently iterated nothing would be a green proving nothing.
  assert.equal(checked, 36, 'the forbidden table itself must not shrink unnoticed');
});

test('AC3: each pattern in the deny list is LOAD-BEARING - none is decorative', () => {
  // Every pattern must be the ONLY thing standing between some real name and
  // acceptance. Remove any one and at least one name above becomes permitted.
  const all = Object.keys(FORBIDDEN_BY_CATEGORY)
    .reduce((acc, k) => acc.concat(FORBIDDEN_BY_CATEGORY[k]), []);
  CS.FORBIDDEN_COMMAND_PATTERNS.forEach((pattern, i) => {
    const others = CS.FORBIDDEN_COMMAND_PATTERNS.filter((_, j) => j !== i);
    const onlyThisOneCatches = all.filter((name) => {
      const s = CS.normaliseName(name);
      return pattern.test(s) && !others.some((p) => p.test(s));
    });
    assert.ok(onlyThisOneCatches.length > 0,
      'pattern ' + i + ' (' + pattern + ') catches nothing that the others do not - it is either '
      + 'redundant or it has been gutted');
  });
});

test('AC3: the deny list is reached AT BIND TIME, even when every command is present', () => {
  // The surface being complete must never buy a module past the deny list.
  const rogue = stubSurface();
  rogue.bookDeliverySlot = async () => ({});
  assert.throws(() => CS.assertCommandSurface(rogue), /forbidden command\(s\) exported: bookDeliverySlot/);

  const payer = stubSurface();
  payer.payNow = async () => ({});
  assert.throws(() => CS.assertCommandSurface(payer), /forbidden command\(s\) exported: payNow/);
});

test('AC3: the comment is TRUE - extra NON-command exports are tolerated, deliberately', () => {
  // This is the behaviour the header now documents, asserted so that "make the
  // comment true" cannot silently become "make the comment wrong again".
  const withHelpers = stubSurface();
  withHelpers.dispatch = async () => ({});
  withHelpers.questionKeyFor = () => 'k';
  assert.doesNotThrow(() => CS.assertCommandSurface(withHelpers),
    'a strict "no more" bind would throw here - and would take the whole command layer down the '
    + 'next time the pipeline exported a helper');

  // And a MISSING command is still refused, which is the direction that hurts.
  const partial = stubSurface();
  delete partial.correctAnswer;
  assert.throws(() => CS.assertCommandSurface(partial), /missing: correctAnswer/);
});

// =====================================================================
// WO-2026-08-19-03 AC4 - NOTHING MAY EVER REACH CHECKOUT, PAYMENT, A SLOT
// OR A CREDENTIAL. Goal contract S-3, permanent.
//
// Asserted over the FINAL vocabulary on BOTH sides of the seam, not over a
// fixture copy of it - the question is whether the shipped names can express a
// forbidden operation, and a test that asked its own list would never know.
// =====================================================================

test('AC4: no name on the cockpit surface can express a forbidden operation', () => {
  assert.ok(CS.COMMAND_NAMES.length > 0);
  CS.COMMAND_NAMES.forEach((n) => {
    assert.equal(CS.isForbiddenName(n), false, n + ' is a legitimate command');
  });
});


test('AC4: no name in the PIPELINE vocabulary can express one either - checked over its real list', () => {
  // The pipeline is the vocabulary of record and is outside this Work Order's
  // surface. Reading it here is what makes AC4 a claim about the SYSTEM rather
  // than about this file.
  let names = null;
  try {
    names = [...require('../pipeline/commandNames.js').COMMAND_NAMES];
  } catch (ignore) {
    return; // pipeline not on this checkout
  }
  assert.ok(names.length > 0, 'the pipeline vocabulary must not read as empty');
  names.forEach((n) => {
    assert.equal(CS.isForbiddenName(n), false,
      'the pipeline vocabulary contains "' + n + '", which the cockpit deny list forbids');
  });
  // And every cockpit name is a real pipeline name - the cockpit invents none.
  CS.COMMAND_NAMES.forEach((n) => {
    assert.ok(names.includes(n),
      'the cockpit offers "' + n + '", which is not in the pipeline vocabulary');
  });
});

test('AC4: the permanently prohibited operations are unreachable through dispatch', async () => {
  for (const n of ['checkout', 'payNow', 'bookSlot', 'readCredential', 'placeOrder']) {
    await assert.rejects(() => CS.dispatch(n, {}, { commands: stubSurface() }),
      (err) => { assert.equal(err.code, 'ASDAIR_COMMAND_FORBIDDEN'); return true; },
      n + ' must be refused by the dispatcher, before anything is loaded');
  }
  // A name that is neither known nor forbidden is still refused - the surface
  // is an allowlist, so "not on the deny list" is never a route in.
  await assert.rejects(() => CS.dispatch('bookTheVan', {}, { commands: stubSurface() }),
    (err) => { assert.equal(err.code, 'ASDAIR_COMMAND_FORBIDDEN'); return true; });
});
