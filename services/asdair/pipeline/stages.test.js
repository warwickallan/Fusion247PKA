// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/stages.test.js
//
// THE STAGE TABLE, PROVEN PURE. No database, no network, no model, no clock.
// If the pipeline ever takes a wrong next step, the fault is either here or in
// the snapshot - and this file pins the "here" half.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { STEPS, STAGE_TABLE, decideNextStep, planOutcome, everIssued, pendingCommand } from './stages.js';
import { COMMANDS, COMMAND_NAMES, COMMAND_SPECS, CONSUMPTION, assertCommandName } from './commandNames.js';
import { questionKeyFor, commandKeyFor, normaliseTerm, QUESTION_KEY_BYTES, isPipelineActionType } from './keys.js';

const SHOP_STATUSES = [
  'RECEIVED', 'TRANSCRIBING', 'PROCESSING', 'NEEDS_DECISION', 'READY_TO_SHOP',
  'WAITING_FOR_BROWSER', 'SHOPPING', 'BASKET_READY', 'ORDER_CONFIRMATION_RECEIVED',
  'RECONCILED', 'FAILED', 'CANCELLED',
];

function snap(overrides = {}) {
  return {
    shop: {
      id: 1, shop_ref: 'SHOP-2026-08-03', household_id: 1,
      status: 'RECEIVED', source_kind: 'text', list_id: null, needs_review: false,
      ...overrides.shop,
    },
    openQuestions: overrides.openQuestions ?? 0,
    pendingCommands: overrides.pendingCommands ?? [],
    issuedCommands: overrides.issuedCommands ?? [],
    browser: overrides.browser ?? null,
    browserIsLive: overrides.browserIsLive ?? false,
    resumeFrom: overrides.resumeFrom ?? null,
  };
}

const cmd = (command, payload = {}) => ({ id: 99, command, key: 'k', payload });

// ---------------------------------------------------------------------
test('the stage table covers EVERY shop status - none can be forgotten', () => {
  const covered = STAGE_TABLE.map((r) => r.status);
  for (const s of SHOP_STATUSES) {
    assert.ok(covered.includes(s), `stage table has no row for ${s}`);
  }
  assert.equal(covered.length, SHOP_STATUSES.length, 'the stage table has a row for a status that does not exist');
});

test('decideNextStep answers for every status without throwing', () => {
  for (const status of SHOP_STATUSES) {
    const d = decideNextStep(snap({ shop: { status }, resumeFrom: status === 'FAILED' ? 'PROCESSING' : null }));
    assert.ok(typeof d.step === 'string' && d.step.length > 0, `no step for ${status}`);
    assert.ok(typeof d.reason === 'string' && d.reason.length > 0, `no reason for ${status}`);
  }
});

// ── the human gates ───────────────────────────────────────────────────
test('RECEIVED waits for "Build this shop" - nothing spends a model call unasked', () => {
  const d = decideNextStep(snap({ shop: { status: 'RECEIVED' } }));
  assert.equal(d.step, STEPS.AWAIT_BUILD_COMMAND);
  assert.equal(d.to, null);
});

test('RECEIVED + buildShop routes a PHOTO through transcription and TEXT straight to interpretation', () => {
  const withBuild = { pendingCommands: [cmd(COMMANDS.BUILD_SHOP)] };
  const photo = decideNextStep(snap({ ...withBuild, shop: { status: 'RECEIVED', source_kind: 'photo' } }));
  assert.equal(photo.step, STEPS.TRANSCRIBE);
  assert.equal(photo.to, 'TRANSCRIBING');

  const text = decideNextStep(snap({ ...withBuild, shop: { status: 'RECEIVED', source_kind: 'text' } }));
  assert.equal(text.step, STEPS.INTERPRET);
  assert.equal(text.to, 'PROCESSING');
});

test('READY_TO_SHOP waits for "Build ASDA basket" - a basket is never built unasked', () => {
  assert.equal(decideNextStep(snap({ shop: { status: 'READY_TO_SHOP' } })).step, STEPS.AWAIT_BASKET_REQUEST);
  const asked = decideNextStep(snap({
    shop: { status: 'READY_TO_SHOP' }, pendingCommands: [cmd(COMMANDS.REQUEST_BASKET_BUILD)],
  }));
  assert.equal(asked.step, STEPS.QUEUE_BROWSER_BUILD);
  assert.equal(asked.to, 'WAITING_FOR_BROWSER');
});

test('BASKET_READY waits for the human to check out and forward the confirmation', () => {
  const d = decideNextStep(snap({ shop: { status: 'BASKET_READY' } }));
  assert.equal(d.step, STEPS.AWAIT_CONFIRMATION);
  assert.match(d.reason, /nothing is ordered until Warwick checks out/i);
});

test('WAITING_FOR_BROWSER and SHOPPING wait for a SUPERVISED runner - nothing autonomous claims them', () => {
  assert.equal(decideNextStep(snap({ shop: { status: 'WAITING_FOR_BROWSER' } })).step, STEPS.AWAIT_RUNNER);
  assert.equal(decideNextStep(snap({ shop: { status: 'SHOPPING' } })).step, STEPS.AWAIT_BASKET);
});

// ── questions ─────────────────────────────────────────────────────────
test('NEEDS_DECISION parks while ANY question is open, and re-plans once none are', () => {
  const waiting = decideNextStep(snap({ shop: { status: 'NEEDS_DECISION' }, openQuestions: 2 }));
  assert.equal(waiting.step, STEPS.AWAIT_ANSWERS);
  assert.equal(waiting.to, null);

  const settled = decideNextStep(snap({ shop: { status: 'NEEDS_DECISION' }, openQuestions: 0 }));
  assert.equal(settled.step, STEPS.REPLAN);
  assert.equal(settled.to, 'PROCESSING');
});

// ── failure ───────────────────────────────────────────────────────────
test('FAILED is VISIBLE and RESUMABLE, but never resumes itself', () => {
  const parked = decideNextStep(snap({ shop: { status: 'FAILED' }, resumeFrom: 'PROCESSING' }));
  assert.equal(parked.step, STEPS.AWAIT_RETRY);
  assert.equal(parked.to, 'PROCESSING', 'a parked shop must still report where it WOULD resume to');

  const retried = decideNextStep(snap({
    shop: { status: 'FAILED' }, resumeFrom: 'PROCESSING', pendingCommands: [cmd(COMMANDS.RETRY_STAGE)],
  }));
  assert.equal(retried.step, STEPS.RESUME);
  assert.equal(retried.to, 'PROCESSING');
});

test('a retry with NO durable failure event is refused, not guessed at', () => {
  const d = decideNextStep(snap({
    shop: { status: 'FAILED' }, resumeFrom: null, pendingCommands: [cmd(COMMANDS.RETRY_STAGE)],
  }));
  assert.equal(d.step, STEPS.AWAIT_RETRY);
  assert.match(d.reason, /no durable failure event/i);
});

// ── cancel + terminal ─────────────────────────────────────────────────
test('cancel outranks every other outstanding command, from every live state', () => {
  for (const status of SHOP_STATUSES.filter((s) => s !== 'RECONCILED' && s !== 'CANCELLED')) {
    const d = decideNextStep(snap({
      shop: { status },
      resumeFrom: 'PROCESSING',
      openQuestions: 3,
      pendingCommands: [
        cmd(COMMANDS.REQUEST_BASKET_BUILD), cmd(COMMANDS.BUILD_SHOP), cmd(COMMANDS.CANCEL_SHOP),
      ],
    }));
    assert.equal(d.step, STEPS.CANCEL, `cancel did not outrank from ${status}`);
    assert.equal(d.to, 'CANCELLED');
  }
});

test('RECONCILED and CANCELLED are terminal - no step, no command can revive them', () => {
  for (const status of ['RECONCILED', 'CANCELLED']) {
    const d = decideNextStep(snap({
      shop: { status },
      pendingCommands: [cmd(COMMANDS.CANCEL_SHOP), cmd(COMMANDS.RETRY_STAGE), cmd(COMMANDS.BUILD_SHOP)],
    }));
    assert.equal(d.step, STEPS.DONE, `${status} was not treated as terminal`);
    assert.equal(d.to, null);
  }
});

// ── pause ─────────────────────────────────────────────────────────────
test('pause releases the request; from WAITING_FOR_BROWSER the week returns to READY_TO_SHOP', () => {
  const d = decideNextStep(snap({
    shop: { status: 'WAITING_FOR_BROWSER' },
    pendingCommands: [cmd(COMMANDS.PAUSE_BASKET_BUILD)],
    browser: { id: 7, status: 'queued' },
  }));
  assert.equal(d.step, STEPS.PAUSE_BUILD);
  assert.equal(d.to, 'READY_TO_SHOP');
});

test('pause mid-SHOPPING cancels the request but does NOT invent a transition SHOPPING has no edge for', () => {
  const d = decideNextStep(snap({
    shop: { status: 'SHOPPING' },
    pendingCommands: [cmd(COMMANDS.PAUSE_BASKET_BUILD)],
    browser: { id: 7, status: 'running' },
  }));
  assert.equal(d.step, STEPS.PAUSE_BUILD);
  assert.equal(d.to, null);
});

// ── the interpretation gate ───────────────────────────────────────────
test('planOutcome: open questions always win - the human is already in the loop', () => {
  const out = planOutcome({ openQuestions: 2, needsReview: true, interpretationConfirmed: false });
  assert.equal(out.to, 'NEEDS_DECISION');
});

test('planOutcome: a reviewed list is NOT declared ready on AsdAIr\'s own say-so', () => {
  const gated = planOutcome({ openQuestions: 0, needsReview: true, interpretationConfirmed: false });
  assert.equal(gated.to, null);
  assert.equal(gated.step, STEPS.AWAIT_INTERPRETATION_CONFIRMATION);

  const confirmed = planOutcome({ openQuestions: 0, needsReview: true, interpretationConfirmed: true });
  assert.equal(confirmed.to, 'READY_TO_SHOP');

  const clean = planOutcome({ openQuestions: 0, needsReview: false, interpretationConfirmed: false });
  assert.equal(clean.to, 'READY_TO_SHOP');
});

test('a LATCH gate reads "ever issued", so consuming the command cannot re-close it', () => {
  const s = snap({ issuedCommands: [COMMANDS.CONFIRM_INTERPRETATION], pendingCommands: [] });
  assert.equal(everIssued(s, COMMANDS.CONFIRM_INTERPRETATION), true);
  assert.equal(pendingCommand(s, COMMANDS.CONFIRM_INTERPRETATION), null,
    'the command is resolved, yet the latch must still read true');
});

// ── the command vocabulary ────────────────────────────────────────────
test('the command surface is an ALLOWLIST - nothing outside it can be named', () => {
  assert.throws(() => assertCommandName('checkout'), /not an AsdAIr command/);
  assert.throws(() => assertCommandName('pay'), /not an AsdAIr command/);
  assert.throws(() => assertCommandName('bookSlot'), /not an AsdAIr command/);
  for (const n of COMMAND_NAMES) assert.equal(assertCommandName(n), n);
});

test('every command carries a spec, and only getStatus writes nothing', () => {
  for (const n of COMMAND_NAMES) assert.ok(COMMAND_SPECS[n], `no spec for ${n}`);
  const readOnly = COMMAND_NAMES.filter((n) => COMMAND_SPECS[n].durable === false);
  assert.deepEqual(readOnly, [COMMANDS.GET_STATUS]);
});

test('the two commands that can legitimately stack carry a discriminator', () => {
  assert.equal(COMMAND_SPECS[COMMANDS.CORRECT_LINE].discriminator, 'line');
  assert.equal(COMMAND_SPECS[COMMANDS.ANSWER_QUESTION].discriminator, 'question');
  assert.equal(COMMAND_SPECS[COMMANDS.CANCEL_SHOP].discriminator, null,
    'cancel must be one-per-shop so a double tap is a no-op');
});

test('latch commands are never consumed; consumable ones always are', () => {
  assert.equal(COMMAND_SPECS[COMMANDS.CONFIRM_INTERPRETATION].consumption, CONSUMPTION.LATCH);
  assert.equal(COMMAND_SPECS[COMMANDS.ANSWER_QUESTION].consumption, CONSUMPTION.LATCH);
  assert.equal(COMMAND_SPECS[COMMANDS.REQUEST_BASKET_BUILD].consumption, CONSUMPTION.CONSUME);
});

// ── keys: the whole idempotency story rests on these ──────────────────
test('a question key is DERIVED from the line, so the same line always asks the same question', () => {
  const a = questionKeyFor('Dreamies cheese');
  assert.equal(a, questionKeyFor('  dreamies   CHEESE '), 'normalisation must make these one question');
  assert.equal(a, questionKeyFor('Dreamies cheese!'), 'punctuation must not fork the key');
  assert.notEqual(a, questionKeyFor('Dreamies chicken'));
});

test('a question key fits the callback wire budget, exactly and always', async () => {
  const { MAX_QUESTION_KEY_BYTES, FIELD_RE, buildAnswerArg, MAX_ARG_BYTES } = await import('../bot/callbackProtocol.js');
  const names = ['milk', 'Wall\'s sausage rolls (6 pack)', 'a'.repeat(400), '3 x Arla semi-skimmed 4pts'];
  for (const n of names) {
    const key = questionKeyFor(n);
    assert.equal(Buffer.byteLength(key, 'utf8'), QUESTION_KEY_BYTES);
    assert.ok(Buffer.byteLength(key, 'utf8') <= MAX_QUESTION_KEY_BYTES, `${key} exceeds the protocol budget`);
    assert.match(key, FIELD_RE);
    // And it survives the real arg builder at the worst candidate index.
    const arg = buildAnswerArg(key, 999);
    assert.ok(Buffer.byteLength(arg, 'utf8') <= MAX_ARG_BYTES);
  }
});

test('an unreadable line cannot be turned into a question key by name', () => {
  assert.throws(() => questionKeyFor('   '), /non-empty item name/);
  assert.throws(() => questionKeyFor(null), /non-empty item name/);
});

test('a command key is scoped by the WEEK, so this week cannot collide with last', () => {
  assert.notEqual(commandKeyFor('SHOP-2026-08-03'), commandKeyFor('SHOP-2026-08-10'));
  assert.equal(commandKeyFor('SHOP-2026-08-03', 'q1'), 'SHOP-2026-08-03:q1');
  assert.equal(commandKeyFor('SHOP-2026-08-03'), 'SHOP-2026-08-03');
});

test('pipeline plumbing is filterable out of a household\'s real outstanding actions', () => {
  assert.equal(isPipelineActionType('cmd:buildShop'), true);
  assert.equal(isPipelineActionType('msg:plan_ready'), true);
  assert.equal(isPipelineActionType('add_favourite'), false,
    'a genuine household to-do must never be filtered away as plumbing');
});

test('normaliseTerm matches the resolver and the planner, so "the same line" means one thing', async () => {
  const { normaliseTerm: resolverNormalise } = await import('../interpret/resolveByCatalogue.js');
  for (const s of ['Arla 4pt', "Wall's sausage rolls", '3 x GOURMET  cat food', 'Yeo Valley 100% Fruit (6 pack)']) {
    assert.equal(normaliseTerm(s), resolverNormalise(s), `normalisation drifted on "${s}"`);
  }
});
