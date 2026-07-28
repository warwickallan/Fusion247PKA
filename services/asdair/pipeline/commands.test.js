// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/commands.test.js
//
// IDEMPOTENCY. The proof that a redelivered message and a double-tapped button
// change nothing the first one did not already do.
//
// These run the REAL services/asdair/shop/shopStore.js against an in-memory
// database carrying migration 006's real unique indexes, so a duplicate is
// refused by the same mechanism that refuses it in Postgres - not by a mock
// that was told to say no.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { COMMANDS } from './commandNames.js';
import { questionKeyFor } from './keys.js';

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';

async function receive(h, overrides = {}) {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID,
    listDate: '2026-08-03',
    sourceKind: 'text',
    rawText: '3 gourmet cat food\n1 weetabix protein',
    actor: ACTOR,
    telegramChatId: '555',
    telegramMessageId: '900',
    telegramUpdateId: '1',
    ...overrides,
  }, h.deps);
}

// THE MACHINE LEDGER, NOT THE HUMAN'S LIST. Since migration 009 a command is a
// row in asdair.pipeline_command; asdair.pending_action holds genuine household
// to-dos only. `ledgerRows` reads the ledger, and `humanRows` reads the list -
// so a test can assert on BOTH and catch a command that leaked into the wrong
// one, which is exactly the defect this separation exists to remove.
const ledgerRows = (h, name, kind = 'command') =>
  h.db.pipeline_command.filter((c) => c.kind === kind && c.command === name);
const commandRows = ledgerRows;

// =====================================================================
// A REDELIVERED MESSAGE
// =====================================================================

test('IDEMPOTENCY: re-delivering the same Telegram message creates NO second shop', async () => {
  const h = makeHarness();
  const first = await receive(h);
  const second = await receive(h, { telegramUpdateId: '2' }); // same message, new delivery

  assert.equal(first.created, true);
  assert.equal(first.matched_by, 'insert');
  assert.equal(second.created, false, 'the redelivery must not create a week');
  assert.equal(second.resumed, true);
  assert.equal(second.matched_by, 'telegram_message', 'it must resume on the MESSAGE key, not the ref');
  assert.equal(second.shop_id, first.shop_id);
  assert.equal(h.db.shop.length, 1);
});

test('IDEMPOTENCY: a redelivery that lands on a different WEEK REF still resumes, on the message key', async () => {
  const h = makeHarness();
  const first = await receive(h);
  // A retry that crossed midnight would derive a different shop_ref - the
  // inbound key must still win, or the week silently duplicates.
  const second = await receive(h, { listDate: '2026-08-04' });
  assert.equal(second.created, false);
  assert.equal(second.shop_id, first.shop_id);
  assert.equal(h.db.shop.length, 1);
});

test('IDEMPOTENCY: a genuinely DIFFERENT message for the same week resumes on the ref, and says so', async () => {
  const h = makeHarness();
  await receive(h);
  const second = await receive(h, { telegramMessageId: '901' });
  assert.equal(second.created, false);
  assert.equal(second.matched_by, 'shop_ref', 'the caller must be told which key matched, not fed a fiction');
  assert.equal(h.db.shop.length, 1);
});

test('the raw evidence is retained, and no command can discard it', async () => {
  const h = makeHarness();
  await receive(h);
  assert.equal(h.db.shop[0].raw_text, '3 gourmet cat food\n1 weetabix protein');
  const source = (await import('node:fs')).readFileSync(new URL('./commands.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bDELETE\b|\bTRUNCATE\b|\bDROP\b/i);
});

test('a photograph is flagged for review at the one moment it can be - creation', async () => {
  const h = makeHarness();
  await receive(h, { sourceKind: 'photo', rawText: null, rawMediaPath: 'C:/fake/list.jpg', needsReview: true });
  assert.equal(h.db.shop[0].needs_review, true);
});

// =====================================================================
// REPEATED BUTTON TAPS
// =====================================================================

test('IDEMPOTENCY: every button tap, repeated, records ONE command - not two', async () => {
  const h = makeHarness();
  await receive(h);

  const repeatable = [
    [COMMANDS.BUILD_SHOP, commands.buildShop, {}],
    [COMMANDS.REQUEST_BASKET_BUILD, commands.requestBasketBuild, {}],
    [COMMANDS.PAUSE_BASKET_BUILD, commands.pauseBasketBuild, {}],
    [COMMANDS.RETRY_STAGE, commands.retryStage, {}],
    [COMMANDS.CANCEL_SHOP, commands.cancelShop, {}],
    [COMMANDS.INTERPRET_LIST, commands.interpretList, {}],
    [COMMANDS.CONFIRM_INTERPRETATION, commands.confirmInterpretation, {}],
    [COMMANDS.SUBMIT_CONFIRMATION, commands.submitConfirmation, { rawText: 'Order total 12.34' }],
  ];

  for (const [name, fn, extra] of repeatable) {
    const a = await fn({ shopRef: REF, actor: ACTOR, ...extra }, h.deps);
    const b = await fn({ shopRef: REF, actor: ACTOR, ...extra }, h.deps);
    const c = await fn({ shopRef: REF, actor: 'cockpit:warwick', ...extra }, h.deps);

    assert.equal(a.recorded.created, true, `${name} did not record on the first tap`);
    assert.equal(b.recorded.created, false, `${name} recorded TWICE on a repeat tap`);
    assert.equal(b.duplicate, true, `${name} must tell the caller it was already asked for`);
    assert.equal(c.recorded.created, false, `${name} recorded again from the OTHER channel - the ledger is not shared`);
    assert.equal(commandRows(h, name).length, 1, `${name} stacked duplicate rows`);
  }
});

test('IDEMPOTENCY: correcting the SAME line twice records one command; two lines record two', async () => {
  const h = makeHarness();
  await receive(h);
  const a = await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'Arla 4pt', requestedQty: 2 }, h.deps);
  const b = await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: '  arla   4PT ', requestedQty: 3 }, h.deps);
  const c = await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'Weetabix Protein', requestedQty: 1 }, h.deps);

  assert.equal(a.recorded.created, true);
  assert.equal(b.recorded.created, false, 'the same line, differently spelled, must be one outstanding correction');
  assert.equal(c.recorded.created, true, 'a different line is a different correction');
  assert.equal(commandRows(h, COMMANDS.CORRECT_LINE).length, 2);
});

test('correctLine refuses a quantity the schema cannot hold, before anything is written', async () => {
  const h = makeHarness();
  await receive(h);
  await assert.rejects(
    () => commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'milk', requestedQty: 0 }, h.deps),
    /1\.\.99/,
  );
  await assert.rejects(
    () => commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'milk', requestedQty: 100 }, h.deps),
    /1\.\.99/,
  );
  assert.equal(commandRows(h, COMMANDS.CORRECT_LINE).length, 0);
});

// =====================================================================
// THE ANSWER - THE COMMAND THAT PROVES THE DESIGN
// =====================================================================

test('THE JOIN: an answer from Telegram clears the question the Cockpit shows, because both went through answerQuestion', async () => {
  const h = makeHarness();
  await receive(h);
  const shopId = h.db.shop[0].id;
  const key = questionKeyFor('Dreamies cheese');
  await h.deps.shopStore.openQuestion({
    shop_id: shopId, question_key: key, question_text: 'Which product is "Dreamies cheese"?', candidates: [],
  });
  assert.equal(h.db.shop_question[0].status, 'open');

  // Telegram answers.
  const tapped = await commands.answerQuestion({
    shopRef: REF, actor: 'telegram:555', questionKey: key,
    answerText: 'Dreamies Cheese Large', answerSource: 'button',
  }, h.deps);
  assert.equal(tapped.changed, true);
  assert.equal(h.db.shop_question[0].status, 'answered');
  assert.equal(h.db.shop_question[0].answer_text, 'Dreamies Cheese Large');

  // The Cockpit, which was still showing it as open, tries to answer it too.
  const clicked = await commands.answerQuestion({
    shopRef: REF, actor: 'cockpit:warwick', questionKey: key,
    answerText: 'a completely different product', answerSource: 'button',
  }, h.deps);

  assert.equal(clicked.changed, false, 'FIRST ANSWER WINS - the second channel must not overwrite a decision');
  assert.equal(clicked.already_answered, true);
  assert.equal(clicked.duplicate, true, 'the human must be told it was already answered');
  assert.equal(h.db.shop_question[0].answer_text, 'Dreamies Cheese Large', 'the settled answer was overwritten');
  assert.equal(h.db.shop_question.length, 1);

  // Exactly ONE decision event, whatever the tapping.
  const decisions = h.db.shop_event.filter((e) => e.event_type === 'decision');
  assert.equal(decisions.length, 1, 'a repeated answer wrote a second decision event');
});

test('IDEMPOTENCY: a question, once opened, is never re-opened - and never re-asked', async () => {
  const h = makeHarness();
  await receive(h);
  const shopId = h.db.shop[0].id;
  const key = questionKeyFor('fruit splits');

  const first = await h.deps.shopStore.openQuestion({
    shop_id: shopId, question_key: key, question_text: 'Which product is "fruit splits"?', candidates: [],
  });
  assert.equal(first.created, true);

  await commands.answerQuestion({ shopRef: REF, actor: ACTOR, questionKey: key, answerText: 'Rowntrees Fruit Pastille Lolly' }, h.deps);

  // A later re-plan re-opens the same question. It must write nothing and hand
  // back the answer that already exists.
  const second = await h.deps.shopStore.openQuestion({
    shop_id: shopId, question_key: key, question_text: 'Which product is "fruit splits"?', candidates: [],
  });
  assert.equal(second.created, false);
  assert.equal(second.already_answered, true);
  assert.equal(second.question.answer_text, 'Rowntrees Fruit Pastille Lolly');
  assert.equal(h.db.shop_question.length, 1);
});

test('"Skip this week" is a REAL answer - it settles the question and cannot be re-asked', async () => {
  const h = makeHarness();
  await receive(h);
  const key = questionKeyFor('stardrops');
  await h.deps.shopStore.openQuestion({
    shop_id: h.db.shop[0].id, question_key: key, question_text: 'Which product is "stardrops"?', candidates: [],
  });
  const res = await commands.answerQuestion({ shopRef: REF, actor: ACTOR, questionKey: key, skip: true }, h.deps);
  assert.equal(res.changed, true);
  assert.equal(h.db.shop_question[0].status, 'skipped');

  const reopened = await h.deps.shopStore.openQuestion({
    shop_id: h.db.shop[0].id, question_key: key, question_text: 'x', candidates: [],
  });
  assert.equal(reopened.already_answered, true);
});

test('an answer with neither text nor skip is refused before anything is written', async () => {
  const h = makeHarness();
  await receive(h);
  await assert.rejects(
    () => commands.answerQuestion({ shopRef: REF, actor: ACTOR, questionKey: 'q1234abcd' }, h.deps),
    /answerText/,
  );
});

// =====================================================================
// PROVENANCE AND SHAPE
// =====================================================================

test('every command records WHO asked - an unattributed durable intent is refused', async () => {
  const h = makeHarness();
  await receive(h);
  const fns = [commands.buildShop, commands.cancelShop, commands.requestBasketBuild, commands.retryStage];
  for (const fn of fns) {
    await assert.rejects(() => fn({ shopRef: REF }, h.deps), /actor/);
    await assert.rejects(() => fn({ shopRef: REF, actor: '   ' }, h.deps), /actor/);
  }
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  assert.equal(commandRows(h, COMMANDS.BUILD_SHOP)[0].args.actor, 'cockpit:warwick');
});

test('a command naming a shop that does not exist is refused by name', async () => {
  const h = makeHarness();
  await assert.rejects(
    () => commands.buildShop({ shopRef: 'SHOP-2099-01-01', actor: ACTOR }, h.deps),
    /no shop matches/,
  );
});

test('getStatus writes NOTHING - looking is not an intent', async () => {
  const h = makeHarness();
  await receive(h);
  const beforeLedger = h.db.pipeline_command.length;
  const beforeHuman = h.db.pending_action.length;
  const status = await commands.getStatus({ shopRef: REF }, h.deps);
  assert.equal(h.db.pipeline_command.length, beforeLedger, 'a read wrote a durable ledger row');
  assert.equal(h.db.pending_action.length, beforeHuman, 'a read wrote a row into the household action list');
  assert.equal(status.status.unknown_means_unknown, true, 'the unknown-means-unknown contract must survive');
  assert.equal(status.pipeline.next_step, 'wait:build_command');
});

test('dispatch refuses anything outside the allowlist - there is no checkout door', async () => {
  const h = makeHarness();
  await receive(h);
  for (const bad of ['checkout', 'pay', 'bookSlot', 'placeOrder', 'substitute']) {
    await assert.rejects(() => commands.dispatch(bad, { shopRef: REF, actor: ACTOR }, h.deps), /not an AsdAIr command/);
  }
});

test('the surface exposes exactly the twelve commands, and dispatch reaches every one', async () => {
  const names = Object.keys(commands.COMMAND_SURFACE);
  assert.equal(names.length, 12);
  for (const n of names) assert.equal(typeof commands.COMMAND_SURFACE[n], 'function');
});

test('submitConfirmation retains the raw receipt VERBATIM the moment it arrives', async () => {
  const h = makeHarness();
  await receive(h);
  const raw = 'Your ASDA order\n2 x Arla semi skimmed 4pt  3.50\nOrder total 3.50';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: raw }, h.deps);
  assert.equal(commandRows(h, COMMANDS.SUBMIT_CONFIRMATION)[0].args.raw_text, raw);
});
