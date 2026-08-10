// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/runtime.test.js
//
// THE LOOP, AND THE CHANNEL ADAPTER.
//
// The two things proven here that nothing else can prove:
//   1. ONE POLLER SERVES BOTH CONSUMERS. The list receiver and the control
//      surface read the SAME fetch, so a button tap is not silently swallowed
//      by the receiver and the week's list is not silently swallowed by a
//      second poller.
//   2. A TAP AND A CLICK ARE THE SAME CALL. Every Telegram intent becomes a
//      member of the command surface, recorded in the ledger the Cockpit reads.
//
// FULLY OFFLINE. The Telegram client is an injected fake, every token is an
// obvious fake, and no fetch exists anywhere in this suite.
// =====================================================================

import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { makeHarness, makeIntake, textUpdate, callbackUpdate, HOUSEHOLD_ID } from './test/harness.js';
import {
  runOnce, runWatch, pollIntake, routeTaps, drainOutbox, queueShopCards, createCapturingTelegram,
  BASKET_HANDBACK_CONTRACT, basketHandbackPayload, withChecklistUrl,
  // WP-B15-15. The board's truthfulness is decided by these two pure functions,
  // so they are proven directly as well as through the wire.
  boardStateOf, parkStateOf,
} from './runtime.js';
import { MESSAGES } from '../bot/renderMessages.js';
import { intentToCommand, ADAPTER_REFUSALS } from './telegramAdapter.js';
import { COMMANDS } from './commandNames.js';
import * as commands from './commands.js';
import { questionKeyFor } from './keys.js';
import { sendQuestionCard } from '../bot/questionRender.js';
import { TAP_REFUSALS } from '../bot/resolveTap.js';
import { buildAnswerArg, isValidShopRef, MAX_SHOP_REF_BYTES } from '../bot/callbackProtocol.js';
// WP-B15-07 / AC9. The three downstream pins a fresh shop's ref must survive,
// imported HERE so the proof runs against the ref the runtime actually created
// rather than against a ref this file made up.
import { listDateOf, runPipeline } from './runPipeline.js';
import { buildExecutionPacket } from '../packet/buildExecutionPacket.js';
// WP-B15-15 AC4. The exclusion statement is imported from the module that OWNS
// it, so a proof about its text can never drift from the text in production.
import { _internal as shopLinesSql } from './shopLines.js';

const REF = 'SHOP-2026-08-03';

/** The MACHINE ledger (migration 009). Every command and every queued card lives
 *  here; asdair.pending_action holds Warwick's genuine to-dos and nothing else. */
const ledger = (h, kind, name) =>
  h.db.pipeline_command.filter((c) => c.kind === kind && c.command === name);

/** The real bot modules, wired to fakes. Nothing is stubbed that matters. */
async function makeBot({ resolveCandidate = null, resolveQuestionByMessage = null } = {}) {
  const router = await import('../bot/inboundRouter.js');
  const messages = await import('../bot/renderMessages.js');
  const callback = await import('../bot/callbackProtocol.js');
  const sent = [];
  const answered = [];
  return {
    sent,
    answered,
    routeAsdairUpdate: router.routeAsdairUpdate,
    parseAnswerArg: callback.parseAnswerArg,
    messages: messages.MESSAGES,
    chatId: '555',
    send: async (chatId, message) => { sent.push({ chatId, message }); return { message_id: sent.length }; },
    answerTap: async (id, text) => { answered.push({ id, text }); return true; },
    resolveQuestionByMessage: resolveQuestionByMessage || (() => null),
    resolveCandidate: resolveCandidate || (() => null),
  };
}

// =====================================================================
// ONE PASS
// =====================================================================

test('a pass with nothing to do is clean, bounded and writes nothing', async () => {
  const h = makeHarness();
  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });
  assert.equal(report.ok, true);
  assert.equal(report.intake.received, 0);
  assert.equal(report.shops.length, 0);
  assert.equal(report.stepped, 0);
  assert.equal(h.db.shop.length, 0);
});

test('a pass turns an inbound list into a shop, and stops at the human gate', async () => {
  const h = makeHarness();
  const intake = makeIntake([textUpdate({ text: '3 gourmet cat food\n1 weetabix protein' })]);
  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake });

  assert.equal(report.intake.received, 1);
  assert.equal(h.db.shop.length, 1);
  assert.equal(h.db.shop[0].status, 'RECEIVED');
  assert.equal(h.db.shop[0].raw_text, '3 gourmet cat food\n1 weetabix protein');
  assert.equal(report.shops[0].step, 'wait:build_command',
    'the loop must not interpret a list nobody asked it to');
});

test('EACH PASS ADVANCES EACH SHOP BY ONE STEP - never "until it stops"', async () => {
  const h = makeHarness();
  const intake = makeIntake([textUpdate()]);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);

  const second = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });
  assert.equal(second.stepped, 1);
  assert.equal(h.db.shop[0].status, 'PROCESSING');

  const third = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });
  assert.equal(third.stepped, 1);
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP');
});

test('IDEMPOTENCY: the same message re-delivered across passes never creates a second shop', async () => {
  const h = makeHarness();
  const update = textUpdate();
  // A state store that never advances - the worst case: total redelivery.
  const stuck = makeIntake([update]);
  stuck.state = { async read() { return { lastUpdateId: null }; }, async write() { return null; } };

  for (let i = 0; i < 4; i += 1) await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: stuck });
  assert.equal(h.db.shop.length, 1, 'a redelivered message duplicated the week');
  assert.equal(h.db.shopping_lists.length <= 1, true);
});

test('a shop that cannot even be read does not stop the others', async () => {
  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: 'milk', actor: 'cockpit:warwick', telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-10', sourceKind: 'text',
    rawText: 'bread', actor: 'cockpit:warwick', telegramChatId: '555', telegramMessageId: '901',
  }, h.deps);
  // Corrupt the FIRST shop so the stage table cannot answer for it.
  h.db.shop[0].status = 'NONSENSE';

  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });
  assert.equal(report.shops.length, 2);
  assert.equal(report.shops.filter((s) => s.ok === false).length, 1);
  assert.equal(report.shops.filter((s) => s.ok !== false).length, 1);
});

// =====================================================================
// ONE POLLER, TWO CONSUMERS
// =====================================================================

test('ONE POLLER: the receiver and the control surface read the SAME fetch', async () => {
  const inner = { getUpdates: async () => [textUpdate(), callbackUpdate()], getFile: async () => ({}), downloadFile: async () => Buffer.alloc(0) };
  const capturing = createCapturingTelegram(inner);
  const fetched = await capturing.getUpdates({});
  assert.equal(fetched.length, 2);
  assert.equal(capturing.captured.length, 2, 'the taps the receiver ignores must still be captured');
});

test('THE JOIN: a button tap the receiver ignores still becomes a command', async () => {
  const h = makeHarness();
  // Pass 1: the list arrives.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  assert.equal(h.db.shop[0].status, 'RECEIVED');

  // Pass 2: Warwick taps "Build this shop". The receiver classifies a
  // callback_query as "no message" and ignores it - the runtime must not.
  const bot = await makeBot();
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([callbackUpdate({ updateId: 2, data: `asd:build:${REF}` })]),
    bot,
  });

  assert.equal(report.taps.routed, 1);
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP).length, 1);
  assert.equal(bot.answered.length, 1, 'a tap that is never answered looks to Warwick like the bot died');
  assert.equal(bot.answered[0].text, 'Got it');
  // And the SAME pass advanced the shop on the strength of that tap.
  assert.equal(h.db.shop[0].status, 'PROCESSING');
});

test('a repeated tap is answered honestly rather than acted on twice', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const bot = await makeBot();
  const tap = callbackUpdate({ updateId: 2, data: `asd:cancel:${REF}` });
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([tap]), bot });
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([tap]), bot });

  // The week is cancelled EXACTLY ONCE, however many times the button is hit.
  assert.equal(h.db.shop[0].status, 'CANCELLED');
  assert.equal(h.db.shop_event.filter((e) => e.to_status === 'CANCELLED').length, 1);

  // And nothing is left nagging: a command issued against a shop that has since
  // finished is RETIRED with a reason, not left "pending" in the machine ledger
  // forever holding that generation of the command open.
  const stillPending = ledger(h, 'command', COMMANDS.CANCEL_SHOP).filter((c) => c.status === 'pending');
  assert.equal(stillPending.length, 0, 'a dead command was left outstanding against a finished week');
  const retired = ledger(h, 'command', COMMANDS.CANCEL_SHOP).filter((c) => c.status === 'retired');
  assert.equal(retired.length, 1);
  assert.match(retired[0].result.note, /already CANCELLED/);
  assert.equal(h.db.pending_action.length, 0,
    'the whole cancel round trip must not put a single row in the household outstanding-actions list');
});

test('a LATCH command is never abandoned - it is a permanent fact about the week', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  await commands.confirmInterpretation({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await commands.cancelShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // -> CANCELLED
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // housekeeping

  const latch = ledger(h, 'command', COMMANDS.CONFIRM_INTERPRETATION)[0];
  assert.equal(latch.status, 'pending', 'a latch was retired - the record of a human decision was erased');
  const receive = ledger(h, 'command', COMMANDS.RECEIVE_LIST)[0];
  assert.equal(receive.status, 'pending', 'the provenance of the week was retired');
});

test('a foreign callback (the hub\'s decision cards share this phone) is never claimed', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const bot = await makeBot();
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([callbackUpdate({ updateId: 2, data: 'decision:card-7:approve' })]),
    bot,
  });
  assert.equal(report.taps.routed, 0);
  assert.equal(report.taps.refused, 0, 'a foreign namespace is not ours to refuse out loud');
  assert.equal(bot.answered.length, 0);
});

// =====================================================================
// THE OUTBOX
// =====================================================================

test('a queued card is rendered, sent, and only THEN resolved', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]) });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  const bot = await makeBot();

  // The receipt (queued on intake, before a bot existed to send it) is drained
  // THIS pass, alongside the interpret step - which is exactly the self-heal
  // this suite proves elsewhere. This test is about plan_ready specifically.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });  // interpret
  const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });  // plan + send

  assert.equal(report.outbox.sent.length, 1);
  const planMessage = bot.sent.find((s) => /Plan ready/.test(s.message.text));
  assert.ok(planMessage, 'the plan_ready card was never sent');
  assert.equal(planMessage.chatId, '555', 'the card must go to the chat the list came from');
  assert.ok(planMessage.message.reply_markup.inline_keyboard.length > 0);
  assert.equal(ledger(h, 'outbox', 'plan_ready').filter((c) => c.status === 'pending').length, 0);
});

test('a send that FAILS leaves the card queued - a lost failure card is a silent stall', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]) });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  const bot = await makeBot();
  bot.send = async () => { throw new Error('telegram is down'); };

  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  const failed = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  // TWO cards are stuck behind the same outage: the receipt (queued on intake,
  // pass 1) and plan_ready (queued this pass). Neither is lost.
  assert.equal(failed.outbox.failed.length, 2);
  assert.equal(ledger(h, 'outbox', 'plan_ready').filter((c) => c.status === 'pending').length, 1);
  assert.equal(ledger(h, 'outbox', 'receipt').filter((c) => c.status === 'pending').length, 1);

  // A later pass, once Telegram is back, sends both exactly once.
  const working = await makeBot();
  const ok = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot: working });
  assert.equal(ok.outbox.sent.length, 2);
  assert.equal(working.sent.length, 2);
});

test('THE RECEIPT: a single --watch pass both queues AND sends the card - no restart of the DATA is needed', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]), bot,
  });

  assert.equal(h.db.shop[0].status, 'RECEIVED');
  assert.equal(report.outbox.sent.length, 1);
  assert.equal(bot.sent.length, 1);
  assert.match(bot.sent[0].message.text, /Shopping list received/);
  assert.ok(
    bot.sent[0].message.reply_markup.inline_keyboard.some((row) => row.some((btn) => btn.text === 'Build this shop')),
    'the receipt must offer the "Build this shop" button - that is the entire point',
  );
});

test('an unrenderable card is abandoned with a reason, never retried forever', async () => {
  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: 'milk', actor: 'cockpit:warwick', telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  const store = await import('./store.js');
  await store.enqueueMessage(h.deps, {
    householdId: HOUSEHOLD_ID, shopId: h.db.shop[0].id, kind: 'not_a_real_card',
    key: 'x', payload: { shopRef: REF },
  });
  const bot = await makeBot();
  await drainOutbox(h.deps, { bot });
  const row = ledger(h, 'outbox', 'not_a_real_card')[0];
  assert.equal(row.status, 'retired');
  assert.match(row.result.note, /no renderer/);
});

// =====================================================================
// WATCH
// =====================================================================

test('watch runs bounded passes and stops cleanly', async () => {
  const h = makeHarness();
  const loop = runWatch(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]) },
    { intervalSeconds: 0, maxPasses: 3 });
  const passes = await loop.done;
  assert.equal(passes, 3);
  assert.equal(h.db.shop.length, 1, 'three passes must not produce three shops');
});

test('a pass that blows up does not kill the loop - the next one re-derives from Postgres', async () => {
  const h = makeHarness();
  let calls = 0;
  const intake = makeIntake([]);
  intake.runIntake = async () => { calls += 1; if (calls === 1) throw new Error('boom'); return { emitted: [], ignored: [], failed: [], fetched: 0 }; };
  const events = [];
  const loop = runWatch(h.deps, { householdId: HOUSEHOLD_ID, intake, log: (e, d) => events.push([e, d]) },
    { intervalSeconds: 0, maxPasses: 3 });
  const passes = await loop.done;
  assert.equal(passes, 3);
  assert.equal(events.filter(([e]) => e === 'pass_failed').length, 1);
  assert.equal(events.filter(([e]) => e === 'pass').length, 2);
});

// =====================================================================
// THE CHANNEL ADAPTER
// =====================================================================

test('every mappable button becomes a member of the command surface', async () => {
  const cases = [
    ['build', null, COMMANDS.BUILD_SHOP],
    ['cancel', null, COMMANDS.CANCEL_SHOP],
    ['basket', null, COMMANDS.REQUEST_BASKET_BUILD],
    ['pause', null, COMMANDS.PAUSE_BASKET_BUILD],
    ['retry', null, COMMANDS.RETRY_STAGE],
    ['status', null, COMMANDS.GET_STATUS],
    ['held', null, COMMANDS.GET_STATUS],
    ['exceptions', null, COMMANDS.GET_STATUS],
    ['review', null, COMMANDS.GET_STATUS],
    ['answer', null, COMMANDS.GET_STATUS],
    ['skip', 'q1234abcd', COMMANDS.ANSWER_QUESTION],
  ];
  for (const [action, arg, expected] of cases) {
    const mapped = intentToCommand({ ok: true, action, shopRef: REF, arg, responder: 'telegram:555', raw: { kind: 'callback' } });
    assert.equal(mapped.ok, true, `${action} did not map`);
    assert.equal(mapped.command, expected, `${action} mapped to the wrong command`);
    assert.equal(mapped.spec.actor, 'telegram:555');
  }
});

test('"Skip this week" settles the question - it is an answer, not a dismissal', () => {
  const mapped = intentToCommand({ ok: true, action: 'skip', shopRef: REF, arg: 'q1234abcd', responder: 'telegram:555', raw: { kind: 'callback' } });
  assert.equal(mapped.command, COMMANDS.ANSWER_QUESTION);
  assert.equal(mapped.spec.skip, true);
  assert.equal(mapped.spec.questionKey, 'q1234abcd');
});

test('a tapped candidate resolves its INDEX back to a product, or is refused', async () => {
  const callback = await import('../bot/callbackProtocol.js');
  const key = questionKeyFor('Dreamies cheese');
  const arg = callback.buildAnswerArg(key, 1);

  const resolved = intentToCommand(
    { ok: true, action: 'answer', shopRef: REF, arg, responder: 'telegram:555', raw: { kind: 'callback' } },
    { parseAnswerArg: callback.parseAnswerArg, resolveCandidate: (r, k, i) => (i === 1 ? 'Dreamies Cheese Large' : null) },
  );
  assert.equal(resolved.command, COMMANDS.ANSWER_QUESTION);
  assert.equal(resolved.spec.answerText, 'Dreamies Cheese Large');
  assert.equal(resolved.spec.answerSource, 'button');

  // An index the caller can no longer resolve is REFUSED, never answered with a number.
  const unresolvable = intentToCommand(
    { ok: true, action: 'answer', shopRef: REF, arg, responder: 'telegram:555', raw: { kind: 'callback' } },
    { parseAnswerArg: callback.parseAnswerArg, resolveCandidate: () => null },
  );
  assert.equal(unresolvable.ok, false);
  assert.equal(unresolvable.reason, ADAPTER_REFUSALS.BAD_ANSWER_ARG);
});

test('a TYPED reply becomes the answer verbatim - the adapter decides nothing', () => {
  const mapped = intentToCommand({
    ok: true, action: 'answer', shopRef: REF, arg: 'q1234abcd', responder: 'telegram:555',
    raw: { kind: 'reply', text: 'the Yeo Valley one please' },
  });
  assert.equal(mapped.command, COMMANDS.ANSWER_QUESTION);
  assert.equal(mapped.spec.answerText, 'the Yeo Valley one please');
  assert.equal(mapped.spec.answerSource, 'typed');
});

test('the buttons that are NOT commands are refused with an honest reason - never mapped to the nearest thing', () => {
  for (const action of ['search', 'confirm', 'close']) {
    const mapped = intentToCommand({ ok: true, action, shopRef: REF, arg: null, responder: 'telegram:555', raw: { kind: 'callback' } });
    assert.equal(mapped.ok, false, `${action} was mapped to a command it does not mean`);
    assert.equal(mapped.reason, ADAPTER_REFUSALS.NOT_A_COMMAND);
    assert.ok(mapped.detail && mapped.detail.length > 10, `${action} was refused without telling the human why`);
  }
  // "Close shop" must NEVER become a cancel - that would throw away a finished week.
  const close = intentToCommand({ ok: true, action: 'close', shopRef: REF, arg: null, responder: 'telegram:555', raw: {} });
  assert.notEqual(close.command, COMMANDS.CANCEL_SHOP);
});

test('a tap that names no shop is refused rather than applied to "the latest" one', () => {
  const mapped = intentToCommand({ ok: true, action: 'cancel', shopRef: null, arg: null, responder: 'telegram:555', raw: {} });
  assert.equal(mapped.ok, false);
  assert.equal(mapped.reason, ADAPTER_REFUSALS.NO_SHOP);
});

// =====================================================================
// THE QUESTION CARD, AND THE ANSWER COMING BACK
//
// Until this existed the product could not ASK. sendQuestionCard() was complete
// and tested with ZERO production callers, nothing enqueued an outbox row of kind
// `question`, and the live wiring passed `resolveCandidate: () => null` so every
// tap was refused. Every question this system has ever asked was asked by hand.
//
// Still FULLY OFFLINE: the question store is an in-memory view over the SAME
// asdair.shop_question rows the real pipeline writes through openQuestion, so
// these prove the join rather than a mock of the join.
// =====================================================================

/** asdair.shop_question + the joined shop_ref, over the harness's own rows. */
function makeQuestionStore(h) {
  const refOf = (shopId) => {
    const s = h.db.shop.find((x) => String(x.id) === String(shopId));
    return s ? s.shop_ref : null;
  };
  const withRef = (r) => (r ? { ...r, shop_ref: refOf(r.shop_id) } : null);
  const find = (shopRef, questionKey) => h.db.shop_question.find(
    (q) => refOf(q.shop_id) === shopRef && q.question_key === questionKey,
  ) || null;

  return {
    async getQuestionByCard({ chatId, messageId }) {
      // EXACT on both, exactly as the real SQL must be. A loose lookup here
      // would defeat the entire staleness scheme.
      return withRef(h.db.shop_question.find(
        (q) => q.card_chat_id !== null && q.card_chat_id !== undefined
          && String(q.card_chat_id) === String(chatId)
          && q.card_message_id !== null && q.card_message_id !== undefined
          && String(q.card_message_id) === String(messageId),
      ) || null);
    },
    async getQuestionByKey({ shopRef, questionKey }) {
      return withRef(find(shopRef, questionKey));
    },
    async saveRender({ shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint, renderVersion }) {
      const row = find(shopRef, questionKey);
      if (!row) throw new Error(`saveRender: no question ${questionKey} on shop ${shopRef}`);
      row.card_chat_id = String(chatId);
      row.card_message_id = String(messageId);
      row.rendered_candidates = renderedCandidates;
      row.render_fingerprint = renderFingerprint;
      row.render_version = renderVersion;
      return withRef(row);
    },
  };
}

/** The real bot, plus the question sender and the durable render contract. */
async function makeAskingBot(h) {
  const bot = await makeBot();
  const questions = makeQuestionStore(h);
  const cards = [];
  const sender = {
    async sendMessage(chatId, message) {
      cards.push({ chatId, message });
      // A distinct id space, so a card's identity is obvious in a failure.
      return { message_id: 9000 + cards.length, chat: { id: chatId } };
    },
    async editMessageText() { return {}; },
  };
  bot.cards = cards;
  bot.questions = questions;
  bot.sendQuestionCard = (spec) => sendQuestionCard({ sender, store: questions, ...spec });
  return bot;
}

/** A tapped candidate button on a SPECIFIC card. */
function tapOnCard({ messageId, questionKey, index, chatId = 555, updateId = 50, queryId = 'cbq-tap' }) {
  return {
    update_id: updateId,
    callback_query: {
      id: queryId,
      from: { id: chatId },
      data: `asd:answer:${REF}:${buildAnswerArg(questionKey, index)}`,
      message: { message_id: messageId, chat: { id: chatId } },
    },
  };
}

/** A typed reply to a SPECIFIC card. */
function replyToCard({ messageId, text, chatId = 555, updateId = 60 }) {
  return {
    update_id: updateId,
    message: {
      message_id: 7777,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      text,
      reply_to_message: { message_id: messageId, chat: { id: chatId } },
    },
  };
}

/** A received shop carrying one open question with the given candidates. */
async function seedQuestion(h, candidates) {
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const shop = h.db.shop[0];
  const questionKey = questionKeyFor('dreamies cheese');
  await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: questionKey,
    question_text: 'Which product is "dreamies cheese"?',
    candidates,
  });
  return { shop, questionKey };
}

const outboxRows = (h, kind) => h.db.pipeline_command.filter((c) => c.kind === 'outbox' && c.command === kind);

test('B1 END TO END: an unmatched line becomes an open question AND a real question card', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  // perQuestionCards NAMES THE MODE THIS PROOF IS ABOUT. It is no longer the
  // default (WP-B15-09: one board, not N cards), but the render-contract
  // machinery it exercises is still live for shops carded before that change,
  // so the proof stays - with its subject stated rather than assumed.
  const asking = { householdId: HOUSEHOLD_ID, bot, perQuestionCards: true };
  await runOnce(h.deps, {
    ...asking,
    intake: makeIntake([textUpdate({ text: '1 dreamies cheese\n2 gourmet cat food' })]),
  });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await runOnce(h.deps, { ...asking, intake: makeIntake([]) });   // interpret
  const planned = await runOnce(h.deps, { ...asking, intake: makeIntake([]) }); // plan + card

  assert.equal(h.db.shop[0].status, 'NEEDS_DECISION');
  assert.equal(h.db.shop_question.length, 1, 'the planner did not open the question this test depends on');
  assert.equal(planned.cards.questions, 1, 'the shop needed a decision and no question card was queued');
  assert.equal(outboxRows(h, 'question').length, 1);
  assert.equal(outboxRows(h, 'question')[0].status, 'done', 'the question card was queued but never sent');

  // It went out through sendQuestionCard, so the RENDER CONTRACT is sealed - not
  // through the generic renderer, which would have left every button dead.
  assert.equal(bot.cards.length, 1);
  assert.match(bot.cards[0].message.text, /Needs a decision/);
  assert.equal(bot.cards[0].chatId, '555', 'the card must go to the chat the list came from');
  const q = h.db.shop_question[0];
  assert.equal(q.card_message_id, '9001');
  assert.equal(q.render_version, 1);
  assert.match(String(q.render_fingerprint), /^[0-9a-f]{64}$/);
});

test('NEVER CARD TWICE: once a question is on his phone, no later pass re-asks it', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);

  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  assert.equal(bot.cards.length, 1);
  assert.equal(h.db.shop_question[0].card_message_id, '9001');

  // Four more passes over a shop whose question is still OPEN and unanswered.
  for (let i = 0; i < 4; i += 1) {
    await queueShopCards(h.deps, { perQuestionCards: true });
    await drainOutbox(h.deps, { bot });
  }
  assert.equal(bot.cards.length, 1, 'the same question was carded more than once');
  assert.equal(outboxRows(h, 'question').length, 1, 'a second question row was minted for an already-asked question');
  assert.equal(shop.id, h.db.shop[0].id);
});

test('the window between queueing and sending is closed by the ledger, not by luck', async () => {
  const h = makeHarness();
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);

  // Three passes with NO bot at all: nothing can send, so card_message_id stays
  // null. The pending row must be ADOPTED each time, never stacked.
  const first = await queueShopCards(h.deps, { perQuestionCards: true });
  const second = await queueShopCards(h.deps, { perQuestionCards: true });
  const third = await queueShopCards(h.deps, { perQuestionCards: true });
  assert.equal(first.questions.length, 1);
  assert.equal(second.questions.length, 0, 'an adopted row was reported as a fresh queue');
  assert.equal(third.questions.length, 0);
  assert.equal(outboxRows(h, 'question').length, 1, 'the same card was queued more than once');
  assert.equal(outboxRows(h, 'question')[0].status, 'pending');
});

test('B2 THE ANSWER COMES BACK: a tapped candidate becomes an answerQuestion command', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [
    { label: 'Dreamies Cheese 60g', regular_id: 41 },
    { label: 'Dreamies Chicken 60g', regular_id: 42 },
  ]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  const report = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 9001, questionKey, index: 1 })],
    bot,
    questions: bot.questions,
  });

  assert.equal(report.refused.length, 0, `the tap was refused: ${JSON.stringify(report.refused)}`);
  assert.equal(report.routed.length, 1);
  assert.equal(report.routed[0].command, COMMANDS.ANSWER_QUESTION);
  // Resolved THROUGH THE STORED LIST: index 1 is the SECOND thing displayed.
  assert.equal(h.db.shop_question[0].answer_text, 'Dreamies Chicken 60g');
  assert.equal(h.db.shop_question[0].answer_source, 'button');
  assert.equal(h.db.shop_question[0].status, 'answered');
  assert.equal(ledger(h, 'command', COMMANDS.ANSWER_QUESTION).length, 1);
  assert.equal(bot.answered.length, 1, 'the tap was never acknowledged - the phone spins for 30 seconds');
});

test('STALE TAP: a button on a superseded card is REFUSED, never mapped to the new ordering', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const A = { label: 'Dreamies Cheese 60g', regular_id: 41 };
  const B = { label: 'Dreamies Chicken 60g', regular_id: 42 };
  const { questionKey } = await seedQuestion(h, [A, B]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  assert.equal(h.db.shop_question[0].card_message_id, '9001');

  // The question is re-rendered as a NEW card with the order REVERSED - a fresh
  // catalogue search, a re-rank, a candidate that went out of stock.
  await bot.sendQuestionCard({
    chatId: '555', shopRef: REF, questionKey, item: 'dreamies cheese',
    candidates: [{ id: 'regular:42', label: B.label }, { id: 'regular:41', label: A.label }],
  });
  assert.equal(h.db.shop_question[0].card_message_id, '9002');
  assert.equal(h.db.shop_question[0].render_version, 2);

  // Warwick taps index 0 on the OLD card still in his scrollback. On that card
  // index 0 was Cheese; on the live card index 0 is Chicken. A silent remap
  // would put CHICKEN in the basket and nobody would ever find out.
  const report = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 9001, questionKey, index: 0 })],
    bot,
    questions: bot.questions,
  });

  assert.equal(report.routed.length, 0, 'a stale tap was acted on');
  assert.equal(report.refused.length, 1);
  assert.equal(report.refused[0].reason, TAP_REFUSALS.STALE_CARD);
  assert.equal(report.refused[0].refresh, true);
  assert.match(report.refused[0].detail, /out of date/);
  assert.equal(h.db.shop_question[0].status, 'open', 'a stale tap answered the question');
  assert.equal(h.db.shop_question[0].answer_text, null);
  assert.equal(ledger(h, 'command', COMMANDS.ANSWER_QUESTION).length, 0,
    'a stale tap reached the command ledger');
  // He is told WHY, and told the card is refreshable - not left with a dead button.
  assert.equal(bot.answered.length, 1);
  assert.match(bot.answered[0].text, /out of date/);

  // The LIVE card still works, and resolves index 0 to Chicken - the exact value
  // a silent remap of the stale tap would have produced.
  const live = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 9002, questionKey, index: 0, queryId: 'cbq-live' })],
    bot,
    questions: bot.questions,
  });
  assert.equal(live.routed.length, 1);
  assert.equal(h.db.shop_question[0].answer_text, B.label);
});

test('a tap nothing has any record of is refused, and the two flavours of "no" are distinguished', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);

  // (a) A card AND a question nothing knows about at all -> UNKNOWN_CARD.
  const unknown = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 4242, questionKey: 'q99999999', index: 0 })],
    bot,
    questions: bot.questions,
  });
  assert.equal(unknown.routed.length, 0);
  assert.equal(unknown.refused[0].reason, TAP_REFUSALS.UNKNOWN_CARD);

  // (b) A question that IS alive, tapped from a card that is not its card -> the
  //     card has been superseded. A DIFFERENT and much more useful fact, and the
  //     one Warwick needs, so the two are never collapsed into one message.
  const superseded = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 4242, questionKey, index: 0, queryId: 'cbq-2' })],
    bot,
    questions: bot.questions,
  });
  assert.equal(superseded.refused[0].reason, TAP_REFUSALS.STALE_CARD);
  assert.notEqual(unknown.refused[0].detail, superseded.refused[0].detail);

  assert.equal(ledger(h, 'command', COMMANDS.ANSWER_QUESTION).length, 0);
  assert.equal(bot.answered.length, 2, 'a refused tap must still be answered');
});

// ─────────────────────────────────────────────────────────────────────────────
// WO-2026-08-10-B15-04 AC3 - THE COSMETIC FAILURE THAT KILLED THE EVENING.
//
// Observed live on 2026-08-09/10: Telegram answers a stale callback query with
// "Bad Request: query is too old and response timeout expired or query ID is
// invalid". The throw escaped routeTaps, escaped runOnce, and runWatch logged
// pass_failed - repeatedly, all evening. Everything AFTER routeTaps in that pass
// (advanceAll, queueShopCards, drainOutbox) never ran, so nothing progressed and
// no card reached his phone.
//
// The acknowledgement is a grey toast on a button. The tap itself is already
// durable and every answer landed. A toast must never be able to stop the shop.
// ─────────────────────────────────────────────────────────────────────────────
test('AC3 A REJECTED TAP ACKNOWLEDGEMENT MUST NOT ABORT THE PASS', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, questionKey } = await seedQuestion(h, [
    { label: 'Dreamies Cheese 60g', regular_id: 41 },
    { label: 'Dreamies Chicken 60g', regular_id: 42 },
  ]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  assert.equal(bot.cards.length, 1, 'setup: the first question card never went out');

  // A SECOND question, opened but not yet carded. It is the witness: it can only
  // reach his phone if the pass gets PAST routeTaps to queueShopCards/drainOutbox.
  await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: questionKeyFor('gourmet cat food'),
    question_text: 'Which product is "gourmet cat food"?',
    candidates: [{ label: 'Gourmet Gold 12x85g', regular_id: 77 }],
  });

  // Telegram rejects the acknowledgement. Verbatim wording from the live failure.
  let acks = 0;
  bot.answerTap = async () => {
    acks += 1;
    throw new Error('Bad Request: query is too old and response timeout expired or query ID is invalid');
  };

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    perQuestionCards: true,
    intake: makeIntake([tapOnCard({ messageId: 9001, questionKey, index: 1 })]),
  });

  assert.equal(acks, 1, 'the acknowledgement was never attempted - this test proves nothing');
  assert.equal(report.ok, true, 'a cosmetic acknowledgement failure aborted the whole pass');
  // The tap is durable regardless - that was true before the fix and must stay true.
  assert.equal(h.db.shop_question[0].status, 'answered', 'the tap itself did not land');
  assert.equal(h.db.shop_question[0].answer_text, 'Dreamies Chicken 60g');
  // ...and the pass carried on doing the work Warwick was waiting for.
  assert.equal(bot.cards.length, 2,
    'the pass died at the acknowledgement - the second question card never reached his phone');
});

test('AC3 the rejection is REPORTED, not silently swallowed', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  bot.answerTap = async () => { throw new Error('query is too old'); };
  const events = [];
  const report = await routeTaps(h.deps, {
    updates: [tapOnCard({ messageId: 9001, questionKey, index: 0 })],
    bot,
    questions: bot.questions,
    log: (event, detail) => events.push([event, detail]),
  });

  // The command still succeeded. It is NOT reported as a failed command, because
  // it did not fail - only its receipt did.
  assert.equal(report.routed.length, 1, 'a successful command was lost to a failed acknowledgement');
  assert.equal(report.refused.length, 0, 'a landed answer was misreported as a refusal');
  const logged = events.filter(([e]) => e === 'tap_ack_failed');
  assert.equal(logged.length, 1, 'a swallowed acknowledgement failure left no trace at all');
  assert.match(String(logged[0][1].detail), /too old/);
});

test('B2 TYPED REPLY: replying to a question card answers it, verbatim', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  const report = await routeTaps(h.deps, {
    updates: [replyToCard({ messageId: 9001, text: 'the cheese one please' })],
    bot,
    questions: bot.questions,
  });
  assert.equal(report.routed.length, 1);
  assert.equal(report.routed[0].command, COMMANDS.ANSWER_QUESTION);
  assert.equal(h.db.shop_question[0].answer_text, 'the cheese one please');
  assert.equal(h.db.shop_question[0].answer_source, 'typed');
});

test('a reply to something that is NOT a question card is not correlated to a guess', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  const report = await routeTaps(h.deps, {
    updates: [replyToCard({ messageId: 12345, text: 'the cheese one please' })],
    bot,
    questions: bot.questions,
  });
  assert.equal(report.routed.length, 0);
  assert.equal(h.db.shop_question[0].status, 'open');
});

test('the planner shape is adapted, not dropped: id-less suggestions still reach the human', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [
    { label: 'Dreamies Cheese 60g', regular_id: 41, source: 'asdair.regulars (resolveByCatalogue)' },
    { label: 'Felix Crispies', source: 'planner suggestion (no product id)' },
  ]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  const card = bot.cards[0].message;
  // The identified one is a BUTTON.
  assert.ok(card.text.includes('Dreamies Cheese 60g'));
  assert.ok(
    card.reply_markup.inline_keyboard.some((row) => row.some((b) => b.text === 'Dreamies Cheese 60g')),
    'the candidate with a real id did not become a button',
  );
  // The id-less one is TEXT he can reply to - never a button that could only refuse.
  assert.match(card.text, /Felix Crispies/);
  assert.ok(
    !card.reply_markup.inline_keyboard.some((row) => row.some((b) => b.text === 'Felix Crispies')),
    'a candidate with no product id was given a button',
  );
  assert.deepEqual(h.db.shop_question[0].rendered_candidates, [
    { index: 0, id: 'regular:41', label: 'Dreamies Cheese 60g' },
  ]);
});

test('a question card on a runtime with no question sender is NOT thrown away', async () => {
  const h = makeHarness();
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });

  const bot = await makeBot();   // no sendQuestionCard wired
  const report = await drainOutbox(h.deps, { bot });
  assert.equal(report.sent.some((s) => s.kind === 'question'), false);
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].kind, 'question');
  assert.match(report.failed[0].detail, /no question sender/);
  assert.equal(outboxRows(h, 'question')[0].status, 'pending',
    'a question was abandoned because this runner could not send it');
  // And the GENERIC renderer never got hold of it: a question card sent that way
  // carries live buttons and no render contract, so every tap on it would refuse.
  assert.equal(bot.sent.some((s) => /Needs a decision/.test(s.message.text)), false,
    'a question card went out through the generic renderer, with no render contract');
  assert.equal(h.db.shop_question[0].card_message_id ?? null, null);
});

test('B5: a shop that reaches BASKET_READY hands the basket back - once, ever, per contract', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]), bot });
  h.db.shop[0].status = 'BASKET_READY';

  const first = await queueShopCards(h.deps, { perQuestionCards: true });
  assert.equal(first.basketReady.length, 1, 'a built basket told Warwick nothing');
  await drainOutbox(h.deps, { bot });
  const card = bot.sent.find((s) => /Basket/.test(s.message.text));
  assert.ok(card, 'the basket handback was never sent');
  assert.match(card.message.text, /Nothing has been ordered/);
  // No verification provider is wired here, so the FAIL-SAFE card is the correct
  // one: a handback that cannot say the basket reconciles must not read as ready.
  assert.match(card.message.text, /^⚠️ Basket NOT VERIFIED$/m);

  // Three more passes, still at BASKET_READY, waiting for him to check out.
  for (let i = 0; i < 3; i += 1) {
    await queueShopCards(h.deps, { perQuestionCards: true });
    await drainOutbox(h.deps, { bot });
  }
  assert.equal(outboxRows(h, 'basket_ready').length, 1, 'the basket handback was sent more than once');
  assert.equal(bot.sent.filter((s) => /Basket/.test(s.message.text)).length, 1);

  // The row carries the contract it was written under, and supersedes nothing.
  const row = outboxRows(h, 'basket_ready')[0];
  assert.equal(row.args.handbackContract, BASKET_HANDBACK_CONTRACT);
  assert.deepEqual(row.args.supersedes, []);
});

test('B5 SUPERSESSION: a shop already handed back at an OLD contract still receives the new one', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]), bot });
  h.db.shop[0].status = 'BASKET_READY';

  // The thin handback of today goes out and is RESOLVED - the exact state that
  // a per-KIND guard would suppress from ever being replaced.
  await queueShopCards(h.deps, { contract: 1 });
  await drainOutbox(h.deps, { bot });
  assert.equal(outboxRows(h, 'basket_ready').filter((r) => r.status === 'done').length, 1);

  // The basket contract lands. The SAME shop must get the real handback.
  const upgraded = await queueShopCards(h.deps, { contract: 2 });
  assert.equal(upgraded.basketReady.length, 1, 'a shop with a thin handback was permanently suppressed');
  assert.deepEqual(upgraded.basketReady[0].supersedes, [1]);

  // ...and the ledger says WHY there are two, without anyone diffing kinds.
  const rows = outboxRows(h, 'basket_ready');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].args.handbackContract, 2);
  assert.deepEqual(rows[1].args.supersedes, [1], 'the ledger cannot explain the second handback');
  assert.notEqual(rows[0].idempotency_key, rows[1].idempotency_key);

  await drainOutbox(h.deps, { bot });
  assert.equal(bot.sent.filter((s) => /Basket/.test(s.message.text)).length, 2);

  // AND THE ONCE-EVER PROPERTY SURVIVES INSIDE THE NEW CONTRACT. Trading a
  // permanent-suppression trap for a duplicate-card trap is not progress.
  for (let i = 0; i < 3; i += 1) {
    await queueShopCards(h.deps, { contract: 2 });
    await drainOutbox(h.deps, { bot });
  }
  assert.equal(outboxRows(h, 'basket_ready').length, 2, 'the new contract handed back more than once');
  assert.equal(bot.sent.filter((s) => /Basket/.test(s.message.text)).length, 2);
});

// ── the handback payload, against the REAL reconciler ───────────────────────
//
// Built from `reconcile/verifyBasket.js` output, not a hand-written fake of it.
// A fake report would prove my field names agree with my own imagination.

const requireCjs = createRequire(import.meta.url);
const { verifyBasket } = requireCjs('../reconcile/verifyBasket.js');

/** A packet + basket in the shapes verifyBasket actually validates. */
function packet(lines) {
  return {
    expected_distinct_products: lines.length,
    expected_total_units: lines.reduce((n, l) => n + l.required_quantity, 0),
    lines,
  };
}
const PACKET_LINES = [
  { seq: 1, canonical_product_id: 11, canonical_product_name: 'Oat Crunch', asda_product_ref: '1000001', brand: 'Alpen', required_quantity: 2 },
  { seq: 2, canonical_product_id: 12, canonical_product_name: 'Rice Pot', asda_product_ref: '1000002', brand: 'Batchelors', required_quantity: 3 },
  { seq: 3, canonical_product_id: null, canonical_product_name: 'Cocoa Drops', asda_product_ref: null, brand: null, required_quantity: 1 },
];

test('B5 CONTRACT 2: the card is derived from the VERIFICATION, and a clean basket reads verified', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]), bot });
  h.db.shop[0].status = 'BASKET_READY';

  const report = verifyBasket({
    expected: packet(PACKET_LINES),
    actual: {
      lines: [
        { canonical_product_id: 11, product_name: 'Oat Crunch', asda_product_ref: '1000001', quantity: 2 },
        { canonical_product_id: 12, product_name: 'Rice Pot', asda_product_ref: '1000002', quantity: 3 },
        { canonical_product_id: null, product_name: 'Cocoa Drops', asda_product_ref: null, quantity: 1 },
      ],
    },
  });
  assert.equal(report.verified, true, 'fixture drifted: the reconciler did not verify a clean basket');

  await queueShopCards(h.deps, { verificationFor: async () => report });
  await drainOutbox(h.deps, { bot });

  const card = bot.sent.find((s) => /Basket ready/.test(s.message.text));
  assert.ok(card, 'the basket handback was never sent');
  assert.match(card.message.text, /^🧺 Basket ready — VERIFIED against the plan$/m);
  assert.match(card.message.text, /^Distinct products: expected 3, basket 3$/m);
  assert.match(card.message.text, /^Total units: expected 6, basket 6$/m);
  assert.match(card.message.text, /^Counts match: yes — headline only, NOT the verdict$/m);
  // Cocoa Drops carries no ref and no id, so it can only have matched on NAME.
  assert.match(card.message.text, /Matched on NAME ONLY/);
  assert.match(card.message.text, /• Cocoa Drops/);
  assert.match(card.message.text, /no checkout, no payment, no delivery slot/);
  assert.ok(!/substitut/i.test(card.message.text));

  const row = outboxRows(h, 'basket_ready')[0];
  assert.equal(row.args.handbackContract, 2);
  assert.equal(row.args.verification.verified, true);
});

test('B5 CONTRACT 2: a MATCHING HEADLINE over wrong contents never reads as ready', async () => {
  // The exact failure the reconciler exists to catch: same distinct count, same
  // total units, wrong products. Deriving `verified` from counts would pass it.
  const report = verifyBasket({
    expected: packet(PACKET_LINES),
    actual: {
      lines: [
        { canonical_product_id: 11, product_name: 'Oat Crunch', asda_product_ref: '1000001', quantity: 2 },
        { canonical_product_id: 99, product_name: 'Cola 2L', asda_product_ref: '1009999', quantity: 3 },
        { canonical_product_id: null, product_name: 'Cocoa Drops', asda_product_ref: null, quantity: 1 },
      ],
    },
  });
  assert.equal(report.counts_match, true, 'fixture drifted: the headline was meant to match');
  assert.equal(report.verified, false);

  const payload = basketHandbackPayload(report);
  assert.equal(payload.verified, false);
  assert.equal(payload.countsMatch, true, 'the weak headline must still be reported, separately');
  assert.deepEqual(payload.missing.map((m) => m.name), ['Rice Pot']);
  assert.deepEqual(payload.unexpected.map((u) => u.name), ['Cola 2L']);

  const out = MESSAGES.basket_ready(payload && { shopRef: REF, verification: payload });
  assert.equal(out.text.split('\n')[0], '⚠️ Basket NOT VERIFIED — do not check out yet');
  assert.ok(out.text.indexOf('Not verified because:') < out.text.indexOf('Counts match'));
});

test('B5 CONTRACT 2: an unobtainable line is reported UNAVAILABLE and never as a substitution', async () => {
  const report = verifyBasket({
    expected: packet(PACKET_LINES),
    actual: {
      lines: [
        { canonical_product_id: 11, product_name: 'Oat Crunch', asda_product_ref: '1000001', quantity: 1 },
        { canonical_product_id: 12, product_name: 'Rice Pot', asda_product_ref: '1000002', quantity: 3, unavailable: true },
        { canonical_product_id: null, product_name: 'Cocoa Drops', asda_product_ref: null, quantity: 1 },
      ],
    },
  });
  const payload = basketHandbackPayload(report);
  assert.equal(payload.verified, false);
  assert.deepEqual(payload.unavailable, [{ name: 'Rice Pot', quantity: 3 }]);
  assert.deepEqual(payload.quantityMismatches, [{ name: 'Oat Crunch', expected: 2, actual: 1 }]);

  const out = MESSAGES.basket_ready({ shopRef: REF, verification: payload });
  assert.match(out.text, /UNAVAILABLE at ASDA — nothing was put in its place, you decide:/);
  assert.match(out.text, /• Rice Pot x3/);
  assert.match(out.text, /• Oat Crunch: expected 2, basket 1/);
  assert.ok(!/substitut/i.test(out.text), 'the handback used the forbidden word');
});

test('B5 CONTRACT 2: an EMPTY basket reports every line missing; a MISSING capture is never verified', async () => {
  // { lines: [] } is a legitimate empty basket.
  const empty = verifyBasket({ expected: packet(PACKET_LINES), actual: { lines: [] } });
  assert.equal(empty.verified, false);
  assert.equal(basketHandbackPayload(empty).missing.length, 3);

  // `actual: null` is NOT an empty basket and must not verify as one.
  assert.throws(() => verifyBasket({ expected: packet(PACKET_LINES), actual: null }),
    /actual` captured basket is required/);
  // ...and a quantity is never defaulted.
  assert.throws(() => verifyBasket({
    expected: packet(PACKET_LINES), actual: { lines: [{ product_name: 'Oat Crunch' }] },
  }), /quantity is required/);
});

test('B5 CONTRACT 2 FAIL SAFE: no provider, an empty result, or a THROW all render NOT VERIFIED', async () => {
  const cases = [
    [undefined, /no basket verification is wired/],
    [async () => null, /no basket capture has been recorded/],
    [async () => { throw new Error('the packet store is down'); }, /could not be run/],
  ];
  let checked = 0;
  for (const [provider, reason] of cases) {
    const h = makeHarness();
    const bot = await makeBot();
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]), bot });
    h.db.shop[0].status = 'BASKET_READY';

    await queueShopCards(h.deps, { verificationFor: provider });
    await drainOutbox(h.deps, { bot });

    const card = bot.sent.find((s) => /Basket/.test(s.message.text));
    assert.ok(card, 'no handback was sent at all');
    assert.match(card.message.text, /^⚠️ Basket NOT VERIFIED$/m);
    assert.match(card.message.text, reason);
    // The failure this build keeps re-committing: a well-shaped card of zeros.
    assert.ok(!/: 0$/m.test(card.message.text), 'an unverified handback fabricated a zero');
    assert.ok(!/Counts match/.test(card.message.text));
    assert.equal(outboxRows(h, 'basket_ready')[0].args.verification, null);
    checked += 1;
  }
  assert.equal(checked, 3, 'the loop executed no cases');
});

test('B5 CONTRACT 2: packetSelfConsistent is null when the packet declared nothing to check', () => {
  // verifyBasket returns `true` vacuously when no counts were declared. A card
  // must not read that as "checked and fine".
  const nothingDeclared = verifyBasket({
    expected: { lines: PACKET_LINES },
    actual: { lines: [{ canonical_product_id: 11, product_name: 'Oat Crunch', asda_product_ref: '1000001', quantity: 2 }] },
  });
  assert.equal(nothingDeclared.packet_self_consistent, true, 'upstream changed: it no longer passes vacuously');
  assert.equal(basketHandbackPayload(nothingDeclared).packetSelfConsistent, null,
    'a vacuous true was passed to the card as though a check had run');

  // Declared and WRONG -> false, and it reaches the card as a producer defect.
  const declaredWrong = verifyBasket({
    expected: { ...packet(PACKET_LINES), expected_distinct_products: 999 },
    actual: { lines: [{ canonical_product_id: 11, product_name: 'Oat Crunch', asda_product_ref: '1000001', quantity: 2 }] },
  });
  assert.equal(basketHandbackPayload(declaredWrong).packetSelfConsistent, false);
  const out = MESSAGES.basket_ready({ shopRef: REF, verification: basketHandbackPayload(declaredWrong) });
  assert.match(out.text, /defect in the plan, not in the basket/);
});

test('B5 SUPERSESSION: a shop that never saw the old contract is not recorded as superseding it', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]), bot });
  h.db.shop[0].status = 'BASKET_READY';

  // First handback ever, straight in at contract 3.
  const out = await queueShopCards(h.deps, { contract: 3 });
  assert.equal(out.basketReady.length, 1);
  assert.deepEqual(out.basketReady[0].supersedes, [],
    'a shop was recorded as superseding handbacks it never received');
  assert.deepEqual(outboxRows(h, 'basket_ready')[0].args.supersedes, []);
});

test('a refused tap is still ANSWERED, so the phone does not spin', async () => {
  const h = makeHarness();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const bot = await makeBot();
  const report = await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 2, data: `asd:search:${REF}:q1234abcd` })],
    bot,
  });
  assert.equal(report.refused.length, 1);
  assert.equal(bot.answered.length, 1);
  assert.match(bot.answered[0].text, /supervised browser step/);
});

// =====================================================================
// WP-B15-1: THE CONFIRMATION SURFACE, END TO END THROUGH THE LOOP
//
// What only this file can prove: the whole journey rides the ONE poller and the
// SAME command surface - photo in, fingerprint bound at receive, park carded,
// card DELIVERED, approve TAP routed, gate cleared, replan proceeds - with no
// manual command insert anywhere. (The live acceptance event itself - real
// Telegram, real thumb - is explicitly NOT provable offline and is not claimed
// here; these are the source-level halves.)
// =====================================================================

/** A raw Telegram photo update, as the wire delivers it. Obvious fixtures. */
function photoTgUpdate({ updateId = 1, chatId = 555, messageId = 900 } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      photo: [{ file_id: 'BIG', file_unique_id: 'u', width: 100, height: 100, file_size: 5 }],
    },
  };
}

/** What makeIntake's fake telegram serves for every download. */
const FAKE_PHOTO_BYTES = 'not-a-real-photo';

test('APPROVE maps to confirmInterpretation - and the pre-existing confirm refusal is untouched beside it', () => {
  const mapped = intentToCommand({
    ok: true, action: 'approve', shopRef: REF, arg: null,
    responder: 'telegram:555', raw: { kind: 'callback' },
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.command, COMMANDS.CONFIRM_INTERPRETATION);
  assert.equal(mapped.spec.shopRef, REF);
  assert.equal(mapped.spec.actor, 'telegram:555');

  // The reconcile-stage prompt keeps its meaning: still refused, still honest.
  const confirm = intentToCommand({
    ok: true, action: 'confirm', shopRef: REF, arg: null,
    responder: 'telegram:555', raw: { kind: 'callback' },
  });
  assert.equal(confirm.ok, false);
  assert.equal(confirm.reason, ADAPTER_REFUSALS.NOT_A_COMMAND);
});

test('END TO END: photo in -> fingerprint bound at receive -> park carded and DELIVERED -> approve tap clears the gate -> replan proceeds', async () => {
  const { createHash } = await import('node:crypto');
  const expectedFp = createHash('sha256').update(Buffer.from(FAKE_PHOTO_BYTES)).digest('hex');

  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
    ],
  });
  const bot = await makeBot();

  // PASS 1 - the photo arrives through the real poller path. The shop is
  // durable, flagged for review, and the fingerprint binding was written by
  // the SAME receive, before the offset moved - not by any later step.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([photoTgUpdate()]), bot });
  assert.equal(h.db.shop.length, 1);
  assert.equal(h.db.shop[0].needs_review, true);
  assert.equal(h.db.shop_source_image.length, 1, 'the binding must be written by the production receive path');
  assert.equal(h.db.shop_source_image[0].fingerprint, expectedFp,
    'the stored fingerprint must be the sha256 of the exact downloaded bytes');

  // PASS 2 - Warwick taps "Build this shop" ON THE PHONE. No manual command.
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([callbackUpdate({ updateId: 2, data: `asd:build:${REF}` })]),
    bot,
  });
  assert.equal(h.db.shop[0].status, 'TRANSCRIBING');

  // PASS 3 - interpretation (the one model call, faked).
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  assert.equal(h.db.shop[0].status, 'PROCESSING');

  // PASS 4 - planning parks at the gate, queues the card, AND DELIVERS IT in
  // the same pass: queueShopCards/drainOutbox run after the advance.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  assert.equal(h.db.shop[0].status, 'PROCESSING', 'the park holds until a human confirms');
  assert.equal(ledger(h, 'outbox', 'confirm_interpretation').length, 1);
  const delivered = bot.sent.find((s) => s.message.text.includes('Confirm this reading'));
  assert.ok(delivered, 'the confirmation card must actually reach the send seam');
  assert.ok(delivered.message.text.includes(`sha256:${expectedFp.slice(0, 12)}`),
    'the card must show WHICH photograph produced the reading');
  const approveButton = delivered.message.reply_markup.inline_keyboard.flat()
    .find((b) => b.callback_data === `asd:approve:${REF}`);
  assert.ok(approveButton, 'the card must carry the distinct approve tap');

  // PASS 5 - the real deliberate act: Warwick taps the button the card carries.
  // The tap is routed BEFORE the advance, so the same pass clears the gate and
  // re-plans through the existing chain. Zero manual inserts anywhere.
  const approve = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([callbackUpdate({ updateId: 3, data: approveButton.callback_data })]),
    bot,
  });
  assert.equal(approve.taps.routed, 1, 'the approve tap must route as a command');
  const confirmRows = ledger(h, 'command', COMMANDS.CONFIRM_INTERPRETATION);
  assert.equal(confirmRows.length, 1, 'exactly one confirmInterpretation latch');
  assert.equal(confirmRows[0].args.actor, 'telegram:555', 'the latch must record the REAL human actor, never a pipeline identity');
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP', 'the gate must clear through the existing command/latch/replan chain');

  // And never a second card, however many more passes run.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  assert.equal(ledger(h, 'outbox', 'confirm_interpretation').length, 1);
});

test('PROCESS DEATH before delivery: the queued card survives the restart and is sent exactly once, never re-queued', async () => {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
    ],
  });
  // Drive to the park with NO bot wired - the card is queued durably but the
  // process "dies" before anything can send it.
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: 'telegram:555', telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: 'telegram:555' }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) }); // -> TRANSCRIBING
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) }); // -> PROCESSING
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) }); // parks + queues card
  const queuedRows = ledger(h, 'outbox', 'confirm_interpretation');
  assert.equal(queuedRows.length, 1);
  assert.equal(queuedRows[0].status, 'pending', 'undelivered, exactly as a crash-before-send leaves it');

  // A brand-new process (the restart), pointed at the SAME durable database.
  const restarted = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
    ],
    seed: h.db,
  });
  const bot = await makeBot();
  await runOnce(restarted.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });

  const cards = ledger(restarted, 'outbox', 'confirm_interpretation');
  assert.equal(cards.length, 1, 'the restart must ADOPT the pending card, never queue a second');
  assert.equal(cards[0].status, 'done', 'the surviving card must actually be delivered after the restart');
  assert.equal(bot.sent.filter((s) => s.message.text.includes('Confirm this reading')).length, 1,
    'exactly one confirmation card reaches the phone across the death and revival');

  // Further passes: no resend, no requeue.
  await runOnce(restarted.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  assert.equal(bot.sent.filter((s) => s.message.text.includes('Confirm this reading')).length, 1);
  assert.equal(ledger(restarted, 'outbox', 'confirm_interpretation').length, 1);
});

// =====================================================================
// WP-B15-A1 - FREE TEXT AS A FIRST-CLASS PRODUCTION ANSWER
//
// The defect, proven live on 2026-08-09: Warwick typed an answer into Telegram
// and question 76463 stayed `open` with answer_text NULL, because only a message
// carrying `reply_to_message` ever reached ACTIONS.ANSWER. His words: "I dont
// have a bloody card I can type an answer... I don't want to be pressing
// buttons."
//
// Every test below drives runOnce - the SAME function the production CLI calls -
// so what is proven is the production path, not a function in isolation.
// =====================================================================

/** A shop carrying TWO open questions, for the one-message-many-answers case. */
async function seedTwoQuestions(h) {
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const shop = h.db.shop[0];
  const cheeseKey = questionKeyFor('dreamies cheese');
  const breadKey = questionKeyFor('bread');
  await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: cheeseKey,
    question_text: 'Which product is "dreamies cheese"?',
    candidates: [{ label: 'Dreamies Cheese 60g', regular_id: 41 }],
  });
  await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: breadKey,
    question_text: 'Which product is "bread"?',
    candidates: [{ label: 'Warburtons Toastie 800g', regular_id: 77 }],
  });
  return { shop, cheeseKey, breadKey };
}

const questionRow = (h, key) => h.db.shop_question.find((q) => q.question_key === key);

test('AC1 THE DEFECT ITSELF: a BARE typed message - no reply_to - answers the open question', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);

  // NO reply_to_message. This is exactly the update that was dropped in
  // production, and textUpdate builds a plain message.
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'the cheese one please' })]),
    bot,
    questions: bot.questions,
  });

  const q = questionRow(h, questionKey);
  assert.equal(q.status, 'answered', 'a bare typed message still did not answer the question');
  assert.equal(q.answer_text, 'the cheese one please', 'the human words were not recorded verbatim');
  assert.equal(report.answers.length, 1);
  assert.equal(ledger(h, 'command', COMMANDS.ANSWER_QUESTION).length, 1,
    'the answer must reach the SAME durable command surface a button tap reaches');
});

test('AC2 AND IT IS NOT ALSO A SHOPPING LIST - both halves', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  const shopsBefore = h.db.shop.length;
  const listsBefore = h.db.shopping_lists.length;

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'the cheese one please' })]),
    bot,
    questions: bot.questions,
  });

  // HALF ONE: the answer landed.
  assert.equal(questionRow(h, questionKey).status, 'answered');
  // HALF TWO: nothing was received as a list, and no shop was created OR resumed.
  assert.equal(report.intake.received, 0, 'the answer was ALSO eaten as a shopping list');
  assert.equal(report.intake.claimed, 1, 'the message should be reported as claimed, not ignored');
  assert.equal(h.db.shop.length, shopsBefore, 'a shop was created from an answer');
  assert.equal(h.db.shopping_lists.length, listsBefore, 'a list was created from an answer');
});

test('AC3a A GENUINE LIST STILL WORKS: a typed list with NO open question creates a shop', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 1, text: '3 gourmet cat food\n1 weetabix protein' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(report.intake.received, 1, 'route-first ate a genuine shopping list');
  assert.equal(report.intake.claimed, 0);
  assert.equal(h.db.shop.length, 1);
  assert.equal(h.db.shop[0].raw_text, '3 gourmet cat food\n1 weetabix protein');
});

test('AC3b A PHOTO IS ALWAYS A LIST, even while a question is open', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  const shopsBefore = h.db.shop.length;

  const photo = {
    update_id: 2,
    message: {
      message_id: 902,
      from: { id: 555 },
      chat: { id: 555, type: 'private' },
      photo: [{ file_id: 'f1', file_unique_id: 'u1', width: 100, height: 100, file_size: 10 }],
    },
  };
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID, intake: makeIntake([photo]), bot, questions: bot.questions,
  });

  assert.equal(report.intake.claimed, 0, 'a photograph of a list was claimed as an answer');
  assert.equal(report.intake.received, 1, 'the photo did not reach receiveList');
  // NOT shopsBefore + 1: createOrResumeShop keys on (household, listDate), so a
  // photo arriving in the same week RESUMES that week rather than starting a
  // second one. That is pre-existing behaviour and the correct outcome here -
  // what this test proves is that the photo went to INTAKE and not to routing.
  assert.equal(h.db.shop.length, shopsBefore, 'the week was duplicated rather than resumed');
  assert.equal(h.db.shop_question[0].status, 'open', 'a photo answered a question');
});

test('AC4 NOTHING IS SILENTLY DROPPED: an unroutable inbound leaves a trace', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const events = [];

  // A foreign callback - the hub `decision:` cards share this phone. It is NOT
  // ours to refuse out loud, but it must not vanish without a word either.
  await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 7, data: 'decision:something-else' })],
    bot,
    questions: bot.questions,
    log: (event, detail) => events.push({ event, detail }),
  });

  const traces = events.filter((e) => e.event === 'inbound_refused');
  assert.equal(traces.length, 1, 'a refused inbound left NO trace - this is the 76463 failure mode');
  assert.equal(traces[0].detail.updateId, 7, 'the trace must name the update it dropped');
  assert.ok(typeof traces[0].detail.reason === 'string' && traces[0].detail.reason.length > 0,
    'a trace with no reason cannot be debugged');
});

test('AC5 PROVENANCE IS TRUTHFUL: a typed answer is `typed`, never relabelled `button`', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'the cheese one please' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(questionRow(h, questionKey).answer_source, 'typed',
    'free text recorded as a button press is a false provenance record');
});

test('AC7 ONE REPLY, SEVERAL QUESTIONS - and each is its own durable answer', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { cheeseKey, breadKey } = await seedTwoQuestions(h);

  // TERRA, ONCE, with every open key. The fake stands in for the gateway call;
  // what is proven here is the WIRING and the per-question split, not the model.
  const calls = [];
  h.deps.correlateAnswer = async (grounding) => {
    calls.push(grounding);
    return {
      mappings: [
        { question_key: cheeseKey, answer_text: 'the cheese one', confidence: 'high' },
        { question_key: breadKey, answer_text: 'the toastie loaf', confidence: 'high' },
      ],
      unmapped_text: null,
    };
  };

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'cheese one and the toastie loaf' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(calls.length, 1, 'Terra must be called ONCE with every open question, not once per question');
  assert.equal(calls[0].questions.length, 2, 'the correlator was not shown every open question');
  assert.equal(questionRow(h, cheeseKey).status, 'answered');
  assert.equal(questionRow(h, breadKey).status, 'answered');
  assert.equal(questionRow(h, cheeseKey).answer_text, 'the cheese one');
  assert.equal(questionRow(h, breadKey).answer_text, 'the toastie loaf');
  assert.equal(report.answers.length, 2);
  assert.equal(ledger(h, 'command', COMMANDS.ANSWER_QUESTION).length, 2,
    'each settled question must be its own durable command, never one combined write');
});

test('AC10 PARTIAL SUCCESS: two clear answers land even when a third cannot be placed', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, cheeseKey, breadKey } = await seedTwoQuestions(h);
  const milkKey = questionKeyFor('milk');
  await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: milkKey,
    question_text: 'Which product is "milk"?',
    candidates: [{ label: 'Semi Skimmed 4pt', regular_id: 88 }],
  });

  h.deps.correlateAnswer = async () => ({
    mappings: [
      { question_key: cheeseKey, answer_text: 'the cheese one', confidence: 'high' },
      { question_key: breadKey, answer_text: 'the toastie loaf', confidence: 'high' },
      // NOT placeable: the correlator is not sure these words were aimed here.
      { question_key: milkKey, answer_text: 'the usual', confidence: 'low' },
    ],
    unmapped_text: null,
  });

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'cheese one, toastie loaf, and the usual' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(questionRow(h, cheeseKey).status, 'answered', 'a clear answer was discarded by an unclear one');
  assert.equal(questionRow(h, breadKey).status, 'answered', 'a clear answer was discarded by an unclear one');
  assert.equal(questionRow(h, milkKey).status, 'open',
    'a low-confidence correlation was claimed anyway - that is a guess');
  assert.equal(questionRow(h, milkKey).answer_text, null);
});

test('DETERMINISTIC FIRST: an exact candidate label spends NO model call', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { cheeseKey } = await seedTwoQuestions(h);

  let modelCalls = 0;
  h.deps.correlateAnswer = async () => { modelCalls += 1; return { mappings: [], unmapped_text: null }; };

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    // The EXACT label of one candidate, with two questions open.
    intake: makeIntake([textUpdate({ updateId: 2, text: 'Dreamies Cheese 60g' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(modelCalls, 0, 'an answer that was already certain spent a model call');
  assert.equal(questionRow(h, cheeseKey).status, 'answered');
});

test('NEVER GUESSES: with several questions open and no correlator, nothing is claimed', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { cheeseKey, breadKey } = await seedTwoQuestions(h);
  // No correlator wired at all - the degraded case.
  h.deps.correlateAnswer = undefined;

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'you know the one' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(questionRow(h, cheeseKey).status, 'open', 'a question was answered on a guess');
  assert.equal(questionRow(h, breadKey).status, 'open', 'a question was answered on a guess');
  // NOT CLAIMED means intake keeps it, which is Warwick own guard: a genuine new
  // shopping list must never be lost because a stale question was open.
  assert.equal(report.intake.claimed, 0);
  assert.equal(report.intake.received, 1);
});

test('A CORRELATOR THAT THROWS never eats the message', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedTwoQuestions(h);
  h.deps.correlateAnswer = async () => { throw new Error('gateway unreachable'); };

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([textUpdate({ updateId: 2, text: 'milk and bread' })]),
    bot,
    questions: bot.questions,
  });

  assert.equal(report.intake.claimed, 0);
  assert.equal(report.intake.received, 1, 'a failed correlation lost the message entirely');
});

// =====================================================================
// AC5 - THE ARTEFACT IS PRODUCED BY THE REAL PASS, ONCE
//
// Root CLAUDE.md, "Nothing may live only in Larry's head": a callable
// buildHandoff(), a green unit test and a successful manual invocation prove
// CAPABILITY only. So this test invokes nothing directly. It drives `runOnce` -
// the exact function `runtime.js main()` calls on every `--once` and every tick
// of `--watch` - and asserts on what the pass LEFT BEHIND in durable state.
//
// And it runs the pass MANY times, not once. The estate has shipped the
// once-per-round defect twice: eighteen identical clarification cards in
// seventeen minutes, keyed on a value that changed every round. A single pass
// cannot distinguish "produced once" from "produced once per minute", so a
// single pass is not the proof.
// =====================================================================

/** Drive the real pass until the shop stops moving, or `limit` passes elapse. */
async function passUntilSettled(h, bot, limit = 8) {
  let passes = 0;
  for (; passes < limit; passes += 1) {
    const report = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
    if (report.stepped === 0) break;
  }
  return passes;
}

test('AC5: the REAL PASS leaves a durable browser handoff, and TWELVE passes leave exactly ONE', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]), bot });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await passUntilSettled(h, bot);

  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP');
  // NOTHING IS HANDED OVER BEFORE WARWICK ASKS. The "Build ASDA basket" gate is
  // deliberate (stages.js READY_TO_SHOP waitsFor), and this pins that closing
  // the seam did not quietly remove it.
  assert.equal(h.db.browser_build_request.length, 0,
    'a shop must not be handed to a browser step nobody asked for');

  await commands.requestBasketBuild({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);

  // THE PASS RUNS EVERY MINUTE. Twelve minutes of it.
  for (let i = 0; i < 12; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  }

  assert.equal(h.db.browser_build_request.length, 1,
    'twelve passes must leave ONE browser build request, not twelve');

  const request = h.db.browser_build_request[0];
  assert.ok(request.progress && request.progress.handoff,
    'the pass must leave a durable HANDOFF on the request - a bare "go and shop" row is the defect');
  assert.ok(request.progress.handoff.packet_fingerprint,
    'and it must be bound to the packet it was built from');
  assert.equal(request.progress.handoff.opened_by, 'asdair:pipeline',
    'PRODUCED BY THE PIPELINE. A handoff opened by anything else would prove capability, not automation.');
  assert.ok(request.progress.handoff.instructions_version,
    'the operating contract version travels with it - buildHandoff refuses to build without one');

  assert.equal(h.db.shop[0].status, 'WAITING_FOR_BROWSER');
});

test('AC5: Warwick is told ONCE that the basket build was handed over, not once per pass', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]), bot });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await passUntilSettled(h, bot);
  await commands.requestBasketBuild({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);

  for (let i = 0; i < 12; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  }

  // The handover card, on the phone, exactly once across twelve passes.
  const handover = bot.sent.filter((s) => /browser build requested/.test(s.message.text || ''));
  assert.equal(handover.length, 1,
    `Warwick received ${handover.length} handover cards. Twenty identical cards is the defect this build has `
    + 'already shipped twice; the key must be stable for the life of the shop.');
  assert.equal(ledger(h, 'outbox', 'progress').filter((c) => c.status === 'pending').length, 0,
    'and nothing is left stuck in the outbox');
});

// =====================================================================
// AC7 - THE CHECKLIST WARWICK ACTUALLY SHOPS FROM
//
// AC5 proved the real pass leaves a durable artefact. That is not yet a shop:
// until this, the artefact stored on the request was a RECEIPT - a fingerprint,
// two version numbers and the expected counts - so a supervised worker who
// claimed it had nothing to shop from, and renderChecklist(), which renders
// from the artefact and nothing else, had no artefact to render.
//
// These drive the REAL PASS and then render what it left behind, through the
// SAME renderer the cockpit route uses. Nothing is invoked by hand.
// =====================================================================

test('AC7: the artefact the REAL PASS stores renders a checklist with the lines, method and prohibitions', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]), bot });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await passUntilSettled(h, bot);
  await commands.requestBasketBuild({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });

  const stored = h.db.browser_build_request[0].progress.handoff;

  // THE ARTEFACT, NOT A RECEIPT. Each of these was absent before 2026-08-10.
  assert.ok(Array.isArray(stored.lines) && stored.lines.length > 0,
    'the pass stored no LINES - a worker claiming this request has nothing to shop from');
  assert.ok(Array.isArray(stored.method) && stored.method.length > 0, 'the pass stored no METHOD');
  assert.ok(Array.isArray(stored.prohibited_actions) && stored.prohibited_actions.length > 0,
    'the pass stored no PROHIBITIONS - the five things that must never happen');

  // AND IT RENDERS. Through the one renderer, the same one the cockpit calls.
  const { renderChecklist } = requireCjs('../handoff/renderChecklist.js');
  const md = renderChecklist(stored);
  for (const line of stored.lines) {
    assert.ok(md.includes(line.canonical_product_name), `"${line.canonical_product_name}" missing from the checklist`);
  }
  for (const p of stored.prohibited_actions) {
    assert.ok(md.includes(p.text), `prohibition "${p.text}" missing from the checklist`);
  }
  assert.ok(md.includes(stored.packet_fingerprint), 'the fingerprint he must quote back is missing');
});

test('AC7: the handover card TELLS Warwick where the checklist is', async () => {
  const h = makeHarness();
  const bot = await makeBot();
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate()]), bot });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await passUntilSettled(h, bot);
  await commands.requestBasketBuild({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  for (let i = 0; i < 6; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
  }

  const handover = bot.sent.filter((s) => /browser build requested/.test(s.message.text || ''));
  assert.equal(handover.length, 1, 'still exactly one handover card across many passes');
  // ── TIGHTENED, because the loose form passed over the defect ──────────────
  // This assertion was `/\/asdair\/checklist\?shop=SHOP-/`, which the BROKEN
  // string satisfied: the card emitted `/asdair/checklist?shop=...`, a route
  // that exists ONLY on the read service at 127.0.0.1:8710 - an address that on
  // Warwick's phone is the PHONE's own loopback. The card was green here and
  // unopenable in his hand. A test that cannot tell the reachable route from
  // the unreachable one is not testing reachability, so it now names the
  // COCKPIT route, which is the only surface he can actually reach.
  assert.match(handover[0].message.text, /\/api\/asdair\/checklist\?shop=SHOP-/,
    'the card must carry the COCKPIT route to the checklist. Telling him the shop is ready while giving '
    + 'him no way to reach the list is the silent park this build has already closed three times.');
  assert.ok(!/(^|[^i])\/asdair\/checklist/.test(handover[0].message.text.replace(/\/api\/asdair\/checklist/g, '')),
    'the card must not carry the read-service-only path, which resolves on nothing he can open');
  assert.match(handover[0].message.text, new RegExp(REF),
    'and it must name HIS shop, not just a route');
});

// ── THE HOST IS APPLIED AT SEND TIME, NEVER STORED ──────────────────────────
// A bare path is not tappable in Telegram. An absolute https URL is. The path
// is the durable fact and the host is deployment config, so the join happens at
// the last moment before the bytes leave - and absent config degrades to the
// path rather than to a guessed host.
test('AC7: a configured cockpit base URL makes the card carry a tappable absolute link', () => {
  const payload = { shopRef: REF, checklistPath: '/api/asdair/checklist?shop=' + REF };

  const withBase = withChecklistUrl(payload, 'https://warwick-yoga.example.ts.net:8443');
  assert.equal(withBase.checklistPath, 'https://warwick-yoga.example.ts.net:8443/api/asdair/checklist?shop=' + REF);
  assert.equal(payload.checklistPath, '/api/asdair/checklist?shop=' + REF, 'the durable payload must not be mutated');
  assert.match(MESSAGES.progress(withBase).text, /https:\/\/warwick-yoga\.example\.ts\.net:8443\/api\/asdair\/checklist/);

  // A trailing slash on the configured origin must not produce a double slash.
  assert.equal(withChecklistUrl(payload, 'https://h:8443/').checklistPath, 'https://h:8443/api/asdair/checklist?shop=' + REF);

  // UNSET is the honest degraded state: the path, unchanged. Not a guessed host.
  assert.equal(withChecklistUrl(payload, null).checklistPath, '/api/asdair/checklist?shop=' + REF);
  assert.equal(withChecklistUrl(payload, '   ').checklistPath, '/api/asdair/checklist?shop=' + REF);

  // A payload with no checklist path stays without one - an absent path renders
  // NOTHING, never a dead link on a card someone is holding in a supermarket.
  const noPath = withChecklistUrl({ shopRef: REF }, 'https://h:8443');
  assert.equal(noPath.checklistPath, undefined);
  assert.ok(!/https:/.test(MESSAGES.progress(noPath).text), 'no link may appear when no path was supplied');

  // An already-absolute path is never given a second origin.
  const already = { checklistPath: 'https://elsewhere/x' };
  assert.equal(withChecklistUrl(already, 'https://h:8443').checklistPath, 'https://elsewhere/x');
});

// =====================================================================
// WP-B15-07 - A NEW LIST NEVER DIES IN A TERMINAL SHOP
//
// THE LIVE FAILURE THESE REPRODUCE (2026-08-10, a real lost shopping list):
//   Warwick's photograph arrived on a date whose shop had already been
//   CANCELLED. nextShopRef computed the DEAD row's ref, the INSERT hit
//   shop_ref_uniq, ON CONFLICT DO NOTHING wrote nothing, createOrResumeShop
//   reported `resumed`/`shop_ref`, receiveList returned NORMALLY - and the
//   caller, seeing no throw, let the Telegram offset advance. Telegram then
//   forgot the update permanently. A CANCELLED shop is terminal, so no pass
//   ever advanced it, so no card was ever sent. The list is gone.
//
// These tests drive the REAL production path - runIntake -> onRecord ->
// receiveList -> createOrResumeShop - against the fake database's REAL unique
// indexes. They are not calls to a helper.
// =====================================================================

// buildHandoff is CommonJS, so it comes through the same bridge the rest of
// this file already uses for CJS modules.
const { buildHandoff } = createRequire(import.meta.url)('../handoff/buildHandoff.js');

const DEAD_DATE = '2026-08-10';
const DEAD_REF = 'SHOP-' + DEAD_DATE;
const DEAD_CLOCK = () => Date.parse(DEAD_DATE + 'T09:00:00.000Z');

/** The CANCELLED row that already owns the date. Shaped exactly as fakePg's
 *  SHOP_COLUMNS, so nothing about it is a convenience the real table lacks. */
function terminalShopSeed(overrides = {}) {
  return {
    id: 1,
    household_id: HOUSEHOLD_ID,
    shop_ref: DEAD_REF,
    status: 'CANCELLED',
    source_kind: 'text',
    telegram_chat_id: '555',
    telegram_message_id: '58',
    telegram_update_id: '171031151',
    raw_text: 'the list that was abandoned',
    raw_media_path: null,
    transcript: null,
    transcript_provider: null,
    transcript_model: null,
    transcript_confidence: null,
    needs_review: false,
    list_id: null,
    last_error: null,
    created_at: DEAD_DATE + 'T00:15:00.000Z',
    updated_at: DEAD_DATE + 'T00:49:00.000Z',
    ...overrides,
  };
}

/** A photograph of a handwritten list. Built here rather than in the harness
 *  because the harness is not this Work Order's to widen. */
function photoUpdate({ updateId = 171031156, chatId = 555, messageId = 63 } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      photo: [{ file_id: 'f-' + messageId, file_unique_id: 'u-' + messageId, width: 900, height: 1200, file_size: 4096 }],
    },
  };
}

test('AC6 REGRESSION: a DIFFERENT list on a date whose shop is TERMINAL starts a FRESH shop, and the dead row is untouched', async () => {
  const h = makeHarness({ seed: { shop: [terminalShopSeed()] } });
  const deadBefore = JSON.stringify(h.db.shop[0]);

  const report = await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate()], { mediaPath: 'C:/tmp/fake-msg-63.jpg' }),
    now: DEAD_CLOCK,
  });

  // THE FAILURE THIS REPRODUCES: pre-fix this is 1, because the photo was
  // absorbed into the cancelled row and reported as a successful receive.
  assert.equal(h.db.shop.length, 2, 'the new list was absorbed into the terminal shop instead of starting a fresh one');

  const fresh = h.db.shop.find((s) => String(s.telegram_message_id) === '63');
  assert.ok(fresh, 'no shop carries the NEW message - the inbound event was dropped');
  assert.notEqual(fresh.id, 1, 'the "fresh" shop is the dead row');
  assert.equal(fresh.telegram_update_id, '171031156');
  assert.equal(fresh.source_kind, 'photo');
  assert.equal(fresh.raw_media_path, 'C:/tmp/fake-msg-63.jpg', 'the raw evidence was not retained');
  assert.equal(fresh.needs_review, true, 'a photographed list must be flagged for review');
  assert.equal(fresh.status, 'RECEIVED', 'the fresh shop is not in a live status, so nothing will ever advance it');

  // The identity is grounded in the inbound event and is NOT the dead ref.
  assert.notEqual(fresh.shop_ref, DEAD_REF);
  assert.equal(fresh.shop_ref, DEAD_REF + '-M63');

  // AC2: the terminal row is left EXACTLY as it was - every column, including
  // updated_at. Asserted, not assumed.
  const dead = h.db.shop.find((s) => s.id === 1);
  assert.equal(JSON.stringify(dead), deadBefore, 'the terminal shop was mutated');

  // The receive was reported as a genuine creation, not a resume.
  assert.equal(report.received.length, 1);
  assert.equal(report.received[0].created, true, 'receiveList reported a resume for a brand-new list');
  assert.equal(report.failed.length, 0);
});

test('AC1: the SAME message redelivered onto a terminal date still yields exactly ONE fresh shop', async () => {
  const h = makeHarness({ seed: { shop: [terminalShopSeed()] } });
  const opts = {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate()], { mediaPath: 'C:/tmp/fake-msg-63.jpg' }),
    now: DEAD_CLOCK,
  };

  await pollIntake(h.deps, opts);
  assert.equal(h.db.shop.length, 2);

  // A fresh intake wiring re-delivering the identical update - i.e. the offset
  // file was lost and Telegram sent it again.
  const again = await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate()], { mediaPath: 'C:/tmp/fake-msg-63.jpg' }),
    now: DEAD_CLOCK,
  });

  assert.equal(h.db.shop.length, 2, 'a redelivery of the same message created a second shop');
  assert.equal(again.received.length, 1);
  assert.equal(again.received[0].created, false, 'a redelivery must resume, not create');
  assert.equal(again.received[0].matched_by, 'telegram_message',
    'the inbound unique index must be what matched - it is the instrument that makes a retry idempotent');
  assert.equal(again.failed.length, 0, 'a redelivery must NOT hold the offset - that would wedge the poller forever');
});

test('AC2: two DIFFERENT new lists on the same terminal date get two DIFFERENT fresh shops', async () => {
  const h = makeHarness({ seed: { shop: [terminalShopSeed()] } });

  await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate({ updateId: 900001, messageId: 63 })]),
    now: DEAD_CLOCK,
  });
  await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate({ updateId: 900002, messageId: 64 })]),
    now: DEAD_CLOCK,
  });

  const refs = h.db.shop.map((s) => s.shop_ref).sort();
  assert.deepEqual(refs, [DEAD_REF, DEAD_REF + '-M63', DEAD_REF + '-M64'],
    'a genuinely different message on the same date must get its own identity');
});

test('AC3: a LIVE shop on the same date still RESUMES - multi-shop semantics are unchanged', async () => {
  const h = makeHarness({ seed: { shop: [terminalShopSeed({ status: 'RECEIVED' })] } });

  const report = await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate()]),
    now: DEAD_CLOCK,
  });

  assert.equal(h.db.shop.length, 1, 'a live shop on the same date must be RESUMED, exactly as it is today');
  assert.equal(report.received[0].created, false);
  assert.equal(report.received[0].matched_by, 'shop_ref');
  assert.equal(h.db.shop[0].shop_ref, DEAD_REF, 'the live shop was renamed');
});

test('AC9: the fresh shop can ADVANCE - its ref survives listDateOf, the execution packet and the browser handoff', async () => {
  const h = makeHarness({ seed: { shop: [terminalShopSeed()] } });
  await pollIntake(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([photoUpdate()], { mediaPath: 'C:/tmp/fake-msg-63.jpg' }),
    now: DEAD_CLOCK,
  });

  const fresh = h.db.shop.find((s) => String(s.telegram_message_id) === '63');
  assert.ok(fresh, 'no fresh shop was created, so there is nothing to advance');
  const ref = fresh.shop_ref;

  // 1. THE PIPELINE. listDateOf runs on every advancing pass; a throw here is
  //    the fresh shop dying on its first step - which is the original bug
  //    moved rather than fixed.
  assert.equal(listDateOf(ref), DEAD_DATE, 'the date part must still be derivable from the collision ref');

  // 2. THE EXECUTION PACKET. Without this the shop can never be shopped.
  const packet = buildExecutionPacket({
    shop_ref: ref,
    generated_at: '2026-08-10T09:00:00.000Z',
    household_id: HOUSEHOLD_ID,
    lines: [{
      original_list_line: 'milk 2',
      origin: 'known',
      canonical_product_id: 41,
      canonical_product_name: 'Semi Skimmed Milk 2L',
      brand: 'ASDA',
      source_view: 'regulars',
      asda_product_ref: '1000383091',
      required_quantity: 1,
    }],
  });
  assert.equal(packet.shop_ref, ref);

  // 3. THE BROWSER HANDOFF. Without this the basket is never built.
  const artefact = buildHandoff(packet);
  assert.equal(artefact.shop_ref, ref);

  // 4. THE BUTTON WARWICK ACTUALLY TAPS. callback_data is capped by Telegram and
  //    this protocol never truncates, so a ref that outgrew the cap would render
  //    a shop nobody can act on - a fresh shop that exists, advances, and then
  //    cannot be built. Checked here rather than reasoned about.
  assert.equal(isValidShopRef(ref), true, 'the fresh shop ref cannot ride a callback button');
});

test('AC9: the collision ref stays inside the Telegram callback budget, and the ceiling is stated', () => {
  // 'SHOP-YYYY-MM-DD' (15) + '-M' (2) = 17 bytes of fixed prefix, against a
  // 32-byte cap. So the suffix affords 15 digits of message id. Real Telegram
  // message ids in a private chat are small - Warwick's was 63 - and this is
  // recorded so the margin is a measured fact rather than an assumption.
  assert.equal(MAX_SHOP_REF_BYTES, 32, 'the callback budget moved - re-check the collision ref ceiling');
  assert.equal(isValidShopRef('SHOP-2026-08-10-M63'), true);
  assert.equal(isValidShopRef('SHOP-2026-08-10-M' + '9'.repeat(15)), true, '15 digits must still fit');
  assert.equal(isValidShopRef('SHOP-2026-08-10-M' + '9'.repeat(16)), false,
    '16 digits exceeds the cap - if Telegram message ids ever reach this, the scheme needs revisiting');
});

// =====================================================================
// WP-B15-08 AC1 - AN ANSWER IS NEVER ALSO A SHOPPING LIST
//
// THE LIVE DEFECT, 2026-08-10. Warwick photographed his list. It became
// SHOP-2026-08-10-M64 with 8 question cards. He REPLIED to those cards in free
// text, and every reply did TWO things: it answered the question (6 of 8
// landed) AND it was ingested as a brand-new shopping list, minting M76, M77,
// M79 and M82 - one junk shop per answer.
//
// ── WHY THE EXISTING SUITE NEVER CAUGHT IT ──────────────────────────────────
// "B2 TYPED REPLY: replying to a question card answers it, verbatim" drives
// routeTaps DIRECTLY. It proves the answer lands and can say nothing at all
// about what intake did with the same message on the way past. The double
// effect only exists in a WHOLE PASS, so these tests drive runOnce.
//
// The seam is one line in the claim closure: a message carrying
// reply_to_message was declined outright ("routeTaps handles it"), so intake
// treated it as a list before routing ever saw it.
// =====================================================================

test('AC1 A TYPED REPLY TO A CARD CREATES NO SHOP - the live 2026-08-10 defect', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  const shopsBefore = h.db.shop.length;
  const listItemsBefore = h.db.shopping_list_items.length;

  // A DIFFERENT CALENDAR DAY, deliberately. On the seeded day the receiver
  // would RESUME the existing week and the new row would be invisible; on the
  // next day an ingested reply mints a genuinely new shop, which is exactly
  // the shape of the four junk shops Warwick got. The 08-03 shop stays active
  // and still carries the open question, so the claim path is fully engaged.
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([replyToCard({ messageId: 9001, text: 'the cheese one please', updateId: 61 })]),
    bot,
    questions: bot.questions,
    now: () => Date.parse('2026-08-04T09:00:00.000Z'),
  });

  assert.equal(h.db.shop.length, shopsBefore,
    'his ANSWER was ingested as a shopping list - this is the live defect: SHOP-2026-08-10-M76/M77/M79/M82');
  assert.equal(h.db.shopping_list_items.length, listItemsBefore,
    'his answer became a line on a shopping list');
  assert.equal(report.intake.received, 0, 'the answer reached receiveList at all');
  assert.equal(report.intake.claimed, 1, 'the reply was not claimed by the router');
});

test('AC1 THE ANSWER STILL LANDS, VERBATIM - suppression must never become a silent drop', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([replyToCard({ messageId: 9001, text: 'the cheese one please', updateId: 61 })]),
    bot,
    questions: bot.questions,
    now: () => Date.parse('2026-08-04T09:00:00.000Z'),
  });

  const q = h.db.shop_question.find((r) => r.question_key === questionKey);
  assert.equal(q.status, 'answered', 'the reply was swallowed without being recorded - a SILENT DROP, worse than the junk shop');
  assert.equal(q.answer_text, 'the cheese one please', 'his words were not recorded verbatim');
  assert.equal(q.answer_source, 'typed', 'a typed reply recorded as anything else is a false provenance record');
});

test('AC1 A REPLY THAT CANNOT BE CORRELATED IS STILL A LIST - failing towards intake is the safe direction', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  const shopsBefore = h.db.shop.length;

  // A reply to a message that is NOT a question card. Nothing correlates it, so
  // claiming it would throw a genuine shopping list away. It must fall through.
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([replyToCard({ messageId: 12345, text: '3 gourmet cat food', updateId: 62 })]),
    bot,
    questions: bot.questions,
    now: () => Date.parse('2026-08-04T09:00:00.000Z'),
  });

  assert.equal(report.intake.claimed, 0, 'an uncorrelatable reply was claimed and lost');
  assert.equal(report.intake.received, 1, 'a genuine shopping list was swallowed by the router');
  assert.equal(h.db.shop.length, shopsBefore + 1, 'the new list did not become a shop');
  assert.equal(h.db.shop_question[0].status, 'open', 'an unrelated question was answered by a guess');
});

test('AC1 A REPLY TO AN ALREADY-ANSWERED CARD IS NOT SWALLOWED', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { questionKey } = await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, { perQuestionCards: true });
  await drainOutbox(h.deps, { bot });
  await commands.answerQuestion({
    shopRef: REF, actor: 'cockpit:warwick', questionKey,
    answerText: 'the cheese one', answerSource: 'typed',
  }, h.deps);

  // answerQuestion is a compare-and-set on status='open', so a LATER reply with
  // DIFFERENT words is refused by the row and recorded nowhere. Claiming on that
  // receipt would swallow a message that was never stored - the B15-04 lesson,
  // which must survive this change.
  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([replyToCard({ messageId: 9001, text: 'actually the chicken one', updateId: 63 })]),
    bot,
    questions: bot.questions,
    now: () => Date.parse('2026-08-04T09:00:00.000Z'),
  });

  assert.equal(report.intake.claimed, 0,
    'a message whose words were stored NOWHERE was claimed and swallowed');
  assert.equal(h.db.shop_question.find((r) => r.question_key === questionKey).answer_text, 'the cheese one',
    'first answer wins - a later reply must not overwrite a recorded decision');
});

// =====================================================================
// WP-B15-08 AC10 - OUR OWN REFUSALS ARE NOT FOREIGN TRAFFIC
//
// `refused` is what a pass REPORTS; the journal is where a trace is left. The
// existing rule - "a foreign namespace is not ours to refuse out loud" - is
// right, and it was being applied to EVERYTHING, including callbacks in our own
// `asd:` namespace that came off cards we drew ourselves. The distinction is
// the NAMESPACE, never a list of action names.
// =====================================================================

test('AC10 a refused callback in OUR namespace is REPORTED, not merely journaled', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const events = [];

  const report = await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 8, data: 'asd:notanaction:SHOP-2026-08-03' })],
    bot,
    questions: bot.questions,
    log: (event, detail) => events.push({ event, detail }),
  });

  assert.equal(report.refused.length, 1,
    'a button in our own namespace was refused and the pass reported nothing - Warwick pressed it and nothing happened');
  assert.equal(events.filter((e) => e.event === 'inbound_refused').length, 1,
    'the journal trace must survive too - reporting does not replace it');
});

test('AC10 a FOREIGN namespace is still not ours to refuse out loud', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const events = [];

  const report = await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 9, data: 'decision:something-else' })],
    bot,
    questions: bot.questions,
    log: (event, detail) => events.push({ event, detail }),
  });

  assert.equal(report.refused.length, 0,
    'the hub\'s cards share this phone - reporting their traffic as our refusals makes every pass look broken');
  assert.equal(events.filter((e) => e.event === 'inbound_refused').length, 1,
    'a foreign inbound must still leave a trace in the journal');
});

// =====================================================================
// WP-B15-09 - THE BOARD. ONE SURFACE WARWICK CAN ACTUALLY READ.
//
// The defect these prove closed, in his own words after eight cards landed for
// one shop: "How am I supposed to know I have answered all the questions and
// the basket is not stuck?" - and Larry had to run a SELECT to tell him "6 of
// 8". Nothing in the product reported answered-versus-outstanding at all.
//
// Every test below fails against the behaviour that shipped before this Work
// Package. They are the RED half of AC9.
// =====================================================================

/** A shop carrying SEVERAL open questions, which is the case that broke. */
async function seedQuestions(h, specs) {
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const shop = h.db.shop[0];
  const keys = [];
  for (const s of specs) {
    const questionKey = questionKeyFor(s.item);
    await h.deps.shopStore.openQuestion({
      shop_id: shop.id,
      question_key: questionKey,
      question_text: 'Which product is "' + s.item + '"?',
      candidates: s.candidates || [],
    });
    keys.push(questionKey);
  }
  return { shop, keys };
}

/** Every board this bot has put on the wire, oldest first. */
const boardsOf = (bot) => bot.sent.filter((s) => /still need from you/i.test(s.message.text));

/** The Telegram message_id of the board. The fake sender numbers its messages
 *  by send order, so the board's id IS its 1-based position - which is exactly
 *  why this is derived rather than hardcoded: a receipt card goes out first, and
 *  an earlier draft of these tests replied to THAT and proved nothing. */
const boardMessageId = (bot) => bot.sent.findIndex((s) => /still need from you/i.test(s.message.text)) + 1;

test('B15-09 AC1+AC2: ONE board names every outstanding question AND every answered one, with the answer he gave', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, keys } = await seedQuestions(h, [
    { item: 'richmond pork sausages', candidates: [{ label: 'Richmond 12 Skinless Pork Sausages 319g', regular_id: 41 }] },
    { item: 'ariel 4in1 pods 33', candidates: [{ label: 'Ariel 4in1 PODS, Washing Capsules 33', regular_id: 42 }] },
    { item: 'vanish pretreat gel', candidates: [] },
  ]);
  // He has already answered ONE of the three.
  await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[2], answer_text: 'Vanish pre treat gel', answer_source: 'typed',
  });

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const boards = boardsOf(bot);
  assert.equal(boards.length, 1, 'no board reached him - this is the Gate 2 FAIL exactly');
  const text = boards[0].message.text;

  assert.match(text, /STILL WAITING ON YOU\D*2 of 3/,
    'the board must count outstanding against the total, which is the "6 of 8" Larry had to query for');
  assert.match(text, /ALREADY ANSWERED\D*1 of 3/);
  assert.match(text, /richmond pork sausages/i);
  assert.match(text, /ariel 4in1 pods 33/i);
  assert.match(text, /Vanish pre treat gel/,
    'an answered question must show WHAT WAS ACCEPTED, not merely that it is done');
});

test('B15-09 AC4: the board says in its own voice whether anything is blocking the shop', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, keys } = await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  assert.match(boardsOf(bot)[0].message.text, /THIS SHOP IS BLOCKED/,
    'a blocked shop that does not say so is the silent park this build keeps re-creating');

  await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'Richmond 12 Skinless', answer_source: 'typed',
  });
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const latest = boardsOf(bot).slice(-1)[0].message.text;
  assert.match(latest, /NOTHING IS BLOCKING THIS SHOP/,
    'he must be able to see the shop is unblocked without interpreting anything');
});

test('B15-09 AC3: answering REWRITES THE SAME MESSAGE - it does not send a second board', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const edits = [];
  bot.editMessage = async (chatId, messageId, message) => { edits.push({ chatId, messageId, message }); return {}; };
  const { shop, keys } = await seedQuestions(h, [
    { item: 'richmond pork sausages', candidates: [] },
    { item: 'ariel 4in1 pods 33', candidates: [] },
  ]);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  const firstBoardCount = boardsOf(bot).length;
  assert.equal(firstBoardCount, 1);

  await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'Richmond 12 Skinless', answer_source: 'typed',
  });
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  assert.equal(boardsOf(bot).length, firstBoardCount,
    'a SECOND board was sent - he is back to reconstructing state from scrolling history');
  assert.equal(edits.length, 1, 'the existing board was never rewritten in place');
  assert.match(edits[0].message.text, /STILL WAITING ON YOU\D*1 of 2/);
  assert.match(edits[0].message.text, /Richmond 12 Skinless/);
});

test('B15-09 AC3: a pass that changes nothing sends and edits NOTHING', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const edits = [];
  bot.editMessage = async (...a) => { edits.push(a); return {}; };
  await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  for (let i = 0; i < 4; i += 1) {
    await queueShopCards(h.deps, {});
    await drainOutbox(h.deps, { bot });
  }

  assert.equal(boardsOf(bot).length, 1, 'the board was re-sent on a pass where nothing changed');
  assert.equal(edits.length, 0, 'the board was rewritten on a pass where nothing changed');
});

test('B15-09 THE STORM STOPS: three open questions produce ONE card, not three', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestions(h, [
    { item: 'richmond pork sausages', candidates: [] },
    { item: 'ariel 4in1 pods 33', candidates: [] },
    { item: 'batchelors mac n cheese', candidates: [] },
  ]);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  assert.equal(bot.cards.length, 0,
    'per-question cards are still the default - a board plus three cards is still three cards');
  assert.equal(outboxRows(h, 'question').length, 0);
  assert.equal(boardsOf(bot).length, 1);
});

test('B15-09 FREE TEXT: one reply to the board answers SEVERAL numbered questions at once', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  bot.editMessage = async () => ({});
  await seedQuestions(h, [
    { item: 'richmond pork sausages', candidates: [] },
    { item: 'ariel 4in1 pods 33', candidates: [] },
  ]);
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const report = await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([replyToCard({
      messageId: boardMessageId(bot),
      updateId: 77,
      text: '1: the 12 skinless ones\n2: the 33 pack',
    })]),
  });

  assert.equal(h.db.shop.length, 1,
    'his answer became a NEW SHOP - this is SHOP-2026-08-10-M76 all over again');
  const answered = h.db.shop_question.filter((q) => q.status === 'answered');
  assert.equal(answered.length, 2, 'one reply must settle both numbered questions, settled ' + answered.length);
  assert.equal(report.answers.length, 2);
});

test('B15-09 AC5: a control that reads as actionable produces a real card, never silence', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const edits = [];
  bot.editMessage = async (...a) => { edits.push(a); return {}; };
  await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  const before = boardsOf(bot).length + edits.length;

  // "Show me what is waiting" / "View status" - every one of these maps to
  // getStatus, which is durable:false and queued NOTHING. He pressed and the
  // product said nothing at all.
  await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 88, data: 'asd:status:' + REF, queryId: 'cbq-status' })],
    bot,
    questions: bot.questions,
  });
  await drainOutbox(h.deps, { bot });

  assert.ok(boardsOf(bot).length + edits.length > before,
    'the tap produced nothing he can see - a control that appears actionable and does nothing');
});

test('B15-09 AC6: a REFUSED tap in our own namespace reaches him by a route that survives the toast', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);
  // The toast is the ONLY route today, and Telegram rejects it once the tap is
  // more than ~15 minutes old. Make it fail exactly as it does live.
  bot.answerTap = async () => { throw new Error('query is too old and response timeout expired or query ID is invalid'); };

  await routeTaps(h.deps, {
    updates: [callbackUpdate({ updateId: 91, data: 'asd:search:' + REF, queryId: 'cbq-search' })],
    bot,
    questions: bot.questions,
  });
  await drainOutbox(h.deps, { bot });

  const told = bot.sent.filter((s) => /that button|not a command|did not work|no longer/i.test(s.message.text));
  assert.ok(told.length >= 1,
    'he pressed a button we drew, the toast expired, and the only other record was a journal line he will never read');
});

test('B15-09 AC7: a stale button tapped five times produces exactly ONE notice, not a storm', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);

  // DRAIN BETWEEN EVERY TAP, and that is the whole point of this test. While a
  // notice is still PENDING the ledger adopts a repeat by itself, so a version
  // of this test that drained only at the end passed with the guard DELETED -
  // it was pinning the ledger's ordinary idempotency, not this guard. The guard
  // bites only once the previous notice has been SENT and its generation spent,
  // which is exactly the live shape: a pass sends, he presses again, or the
  // offset never advanced and Telegram redelivers the same update.
  for (let i = 0; i < 5; i += 1) {
    await routeTaps(h.deps, {
      updates: [callbackUpdate({ updateId: 95, data: 'asd:search:' + REF, queryId: 'cbq-' + i })],
      bot,
      questions: bot.questions,
    });
    await drainOutbox(h.deps, { bot });
  }

  const notices = outboxRows(h, 'control_refused');
  assert.equal(notices.length, 1,
    'one redelivered tap minted ' + notices.length + ' notices - that is the storm this guard exists to stop');
});

test('B15-09 AC8: a reply when nothing is open is NOT a shopping list, and he is told', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  bot.editMessage = async () => ({});
  const { shop, keys } = await seedQuestions(h, [{ item: 'richmond pork sausages', candidates: [] }]);
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'Richmond 12 Skinless', answer_source: 'typed',
  });

  const shopsBefore = h.db.shop.length;
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([replyToCard({ messageId: boardMessageId(bot), updateId: 78, text: 'actually make it the 24 pack' })]),
  });
  await drainOutbox(h.deps, { bot });

  assert.equal(h.db.shop.length, shopsBefore,
    'a reply to a settled card became a shopping list - the M76/M77/M79/M82 defect');
  const told = bot.sent.filter((s) => /not taken|NOT recorded|not been taken|have not taken/i.test(s.message.text));
  assert.ok(told.length >= 1, 'his words vanished silently, which is strictly worse than the spurious shop');
});

test('B15-09 C-3: READY_TO_SHOP is unreachable while a question is open - proven on the REAL gate', async () => {
  const { planOutcome } = await import('./stages.js');
  assert.equal(planOutcome({ openQuestions: 1, needsReview: false, interpretationConfirmed: true }).to,
    'NEEDS_DECISION');
  assert.equal(planOutcome({ openQuestions: 3, needsReview: false, interpretationConfirmed: true }).to,
    'NEEDS_DECISION');
  assert.equal(planOutcome({ openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: 2 }).to,
    null, 'an unresolved LINE must park the shop too, not just an open question');
  assert.equal(planOutcome({ openQuestions: 0, needsReview: false, interpretationConfirmed: true }).to,
    'READY_TO_SHOP');
});

test('B15-09 PRODUCTION WIRING: the real runtime edits the board, and never turns the storm back on', () => {
  const src = readFileSync(new URL('./runtime.js', import.meta.url), 'utf8');
  const wiring = src.slice(src.indexOf('async function realWiring'));

  // WITHOUT editMessage on the bot object, drainOutbox can only ever SEND, and
  // Warwick is back to reading a scrolling history of superseded boards - the
  // exact complaint this Work Package answers. sendShopperMessage.editMessageText
  // existed from the start and had no production caller until now.
  assert.match(wiring, /editMessage:\s*\(chat, messageId, message\)\s*=>\s*sender\.editMessageText\(/,
    'the real wiring cannot rewrite a board, so every answer would post a new one');

  // And the storm stays off where it matters: in the process that actually talks
  // to Warwick. `perQuestionCards` is a test-only fallback for the render-contract
  // machinery; realWiring must never set it.
  assert.equal(/perQuestionCards/.test(wiring), false,
    'the production wiring re-enables per-question cards - a board plus eight cards is still eight cards');
});

// =====================================================================
// WP-B15-15 - THE BOARD IS NEVER WRONG ABOUT BEING BLOCKED
//
// WP-B15-09 gave Warwick ONE board and told him to trust it. WP-B15-10 found,
// while proving something else, that in the one state he most needs telling it
// says the opposite of the truth.
//
// ── THE PARKED-STATE ENUMERATION, WHICH IS THE SCOPE ────────────────────────
// `planOutcome` (stages.js:337-356) has FOUR exits. A park is an exit with
// `to: null`; stepPlan takes the `gate.to === null` branch, writes NO
// transition, and the shop STAYS at PROCESSING.
//
//   E0      openQuestions > 0                      -> NEEDS_DECISION   (moves)
//   PARK-1  needsReview && !interpretationConfirmed -> to:null  wait:interpretation_confirmation
//   PARK-2  unresolvedLines > 0                    -> to:null  wait:line_resolution
//   E3      else                                    -> READY_TO_SHOP   (moves)
//
// So there are EXACTLY TWO parks, and BOTH are structurally unreachable unless
// `openQuestions === 0` - which is precisely the condition under which
// `boardStateOf`'s `outstanding` array is empty and `blocked` was computed as
// `false`. The board therefore printed "NOTHING IS BLOCKING THIS SHOP" over a
// shop that cannot reach READY_TO_SHOP, or - with no question rows at all -
// printed nothing whatsoever.
//
// PARK-1 IS THE OLDER AND MORE REACHABLE OF THE TWO, and it is the recorded
// shape of shop 6: PROCESSING, needs_review, every question answered, five
// days, not one event. A fix aimed only at PARK-2 would have left the board
// asserting "nothing is blocking" over exactly that.
//
// Every test below fails against the behaviour that shipped before this Work
// Package. They are the RED half of AC5.
// =====================================================================

/**
 * Drive a shop into the exact window planOutcome's parks live in: PROCESSING,
 * with zero OPEN questions. Answered rows are left in place deliberately -
 * "every question is answered" is the state in which the board used to say the
 * shop was clear.
 */
async function shopInParkWindow(h, { needsReview = false, items = [] } = {}) {
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  const shop = h.db.shop[0];
  for (const item of items) {
    const key = questionKeyFor(item);
    await h.deps.shopStore.openQuestion({
      shop_id: shop.id, question_key: key, question_text: `Which product is "${item}"?`, candidates: [],
    });
    await h.deps.shopStore.answerQuestion({
      shop_id: shop.id, question_key: key, answer_text: 'the one I meant', answer_source: 'typed',
    });
  }
  shop.status = 'PROCESSING';
  shop.needs_review = needsReview;
  return shop;
}

/**
 * The durable trace PARK-2 leaves, written exactly as runPipeline.stepPlan
 * writes it. This row is the board's ONLY evidence that the line gate parked
 * this shop, which is why `lines_unresolved` may not be retired.
 */
async function announceLinesUnresolved(h, shop) {
  const storeMod = await import('./store.js');
  const { outboxKeyFor } = await import('./keys.js');
  await storeMod.enqueueMessage(h.deps, {
    householdId: shop.household_id,
    shopId: shop.id,
    kind: 'lines_unresolved',
    key: outboxKeyFor(shop.shop_ref, 'lines_unresolved'),
    payload: {
      shopRef: shop.shop_ref, items: ['1 PKT HAM ON THE BONE'], unresolvedCount: 1, awaitingClarification: 0,
    },
  });
}

/** The board text most recently put on the wire, or null. */
const latestBoard = (bot) => {
  const all = boardsOf(bot);
  return all.length === 0 ? null : all[all.length - 1].message.text;
};

test('B15-15 AC1 PARK-2: the board must not say NOTHING IS BLOCKING a shop parked on unresolved LINES', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const shop = await shopInParkWindow(h, { items: ['richmond pork sausages'] });
  await announceLinesUnresolved(h, shop);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const text = latestBoard(bot);
  assert.ok(text, 'no board reached him at all for a parked shop');
  assert.equal(/NOTHING IS BLOCKING THIS SHOP/.test(text), false,
    'the board positively asserted that nothing is blocking a shop that CANNOT reach READY_TO_SHOP - '
    + 'worse than the eight cards it replaced, because he would believe it');
  assert.match(text, /THIS SHOP IS BLOCKED/);
  assert.match(text, /line/i, 'the board says it is blocked but never says the lines are why');
});

test('B15-15 AC1 PARK-1: the board must not say NOTHING IS BLOCKING a shop parked on an UNCONFIRMED reading', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  // needs_review with no confirmInterpretation ever issued: shop 6's exact
  // shape, and the park planOutcome checks FIRST.
  await shopInParkWindow(h, { needsReview: true, items: ['richmond pork sausages'] });

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const text = latestBoard(bot);
  assert.ok(text, 'no board reached him at all for a parked shop');
  assert.equal(/NOTHING IS BLOCKING THIS SHOP/.test(text), false,
    'PARK-1 is the older and more reachable park - repairing PARK-2 alone moves the defect, it does not close it');
  assert.match(text, /THIS SHOP IS BLOCKED/);
  assert.match(text, /confirm/i, 'the board never says the unconfirmed reading is what is holding the shop');
});

test('B15-15 AC1 ORDER: a shop holding BOTH parks reports the one planOutcome checks first', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const shop = await shopInParkWindow(h, { needsReview: true, items: ['richmond pork sausages'] });
  await announceLinesUnresolved(h, shop);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const text = latestBoard(bot);
  assert.ok(text, 'no board reached him at all');
  // planOutcome evaluates the interpretation gate BEFORE the line gate, so the
  // board must name the interpretation - and flip to the lines the moment he
  // confirms the reading. Picking one would make the board disagree with the
  // authority about why the shop is stopped.
  assert.match(text, /confirm/i,
    'the board named the wrong park - it must follow stages.js own ordering, not choose');
});

test('B15-15 AC2: a question-less parked shop still gets a board - silence is not an acceptable answer', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const shop = await shopInParkWindow(h, { items: [] });
  await announceLinesUnresolved(h, shop);

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const text = latestBoard(bot);
  assert.ok(text,
    'queueBoard returned "no questions" and he was left with NOTHING in exactly the state '
    + 'he most needs telling');
  assert.match(text, /THIS SHOP IS BLOCKED/);
});

test('B15-15 AC2: a question-less shop parked on an UNCONFIRMED reading also gets a board', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await shopInParkWindow(h, { needsReview: true, items: [] });

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  assert.ok(latestBoard(bot), 'the shop is parked and the board does not exist - a park with no voice');
});

test('B15-15 AC1: where the board CANNOT see, it says so - it never says "nothing is blocking"', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  // PROCESSING, no open questions, and NO park evidence. `unresolvedLines` is
  // computed by the planner inside runPipeline and cannot be re-derived here;
  // re-implementing it would create a second authority that can drift from
  // stages.js, which is the very class of defect this closes. So the board
  // stops claiming rather than guesses.
  await shopInParkWindow(h, { items: ['richmond pork sausages'] });

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  const text = latestBoard(bot);
  assert.ok(text);
  assert.equal(/NOTHING IS BLOCKING THIS SHOP/.test(text), false,
    'the board cannot see the line gate from here, so asserting the shop is clear is a guess dressed as a fact');
  assert.match(text, /I cannot tell you whether anything is blocking/,
    'the renderer has shipped this third state since WP-B15-09 and nothing has ever produced it');
});

test('B15-15 AC2: an "I cannot tell" state does NOT queue a board of its own - the storm stays off', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await shopInParkWindow(h, { items: [] });   // no questions, no park evidence

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  assert.equal(boardsOf(bot).length, 0,
    'an "I cannot tell" card for every question-less PROCESSING shop is the storm this build removed');
});

test('B15-15 AC1: becoming parked REWRITES the board even though the question set never changed', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const edits = [];
  bot.editMessage = async (chatId, messageId, message) => { edits.push({ chatId, messageId, message }); return {}; };
  const shop = await shopInParkWindow(h, { items: ['richmond pork sausages'] });

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  assert.equal(boardsOf(bot).length, 1);

  // The park arrives. Not one question row moves.
  await announceLinesUnresolved(h, shop);
  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });

  assert.equal(edits.length, 1,
    'the fingerprint covers only the question rows, so a shop that BECOMES parked keeps the board '
    + 'it had before - the fix would exist and never reach his phone');
  assert.match(edits[0].message.text, /THIS SHOP IS BLOCKED/);
});

test('B15-15 AC1: parkStateOf answers for EVERY park planOutcome can reach', async () => {
  const { planOutcome, STEPS } = await import('./stages.js');

  // The enumeration, established against the authority rather than asserted.
  // Any exit carrying `to: null` is a park the board must be able to report.
  const parks = [
    { name: 'PARK-1', gate: { openQuestions: 0, needsReview: true, interpretationConfirmed: false, unresolvedLines: 0 },
      evidence: { status: 'PROCESSING', openQuestions: 0, needsReview: true, interpretationConfirmed: false } },
    { name: 'PARK-2', gate: { openQuestions: 0, needsReview: false, interpretationConfirmed: true, unresolvedLines: 3 },
      evidence: { status: 'PROCESSING', openQuestions: 0, needsReview: false, interpretationConfirmed: true, linesUnresolvedAnnounced: true } },
  ];
  for (const p of parks) {
    const outcome = planOutcome(p.gate);
    assert.equal(outcome.to, null, `${p.name} is meant to be a park`);
    const park = parkStateOf(p.evidence);
    assert.equal(park.parked, true, `${p.name} is a park the board cannot report`);
    assert.equal(park.step, outcome.step, `${p.name}: the board names a different step from the authority`);
  }

  // And the two exits that MOVE are not parks, so the board must not invent one.
  assert.equal(planOutcome({ openQuestions: 2, needsReview: false, interpretationConfirmed: true }).to, 'NEEDS_DECISION');
  assert.equal(parkStateOf({ status: 'NEEDS_DECISION', openQuestions: 2 }), null);
  assert.equal(planOutcome({ openQuestions: 0, needsReview: false, interpretationConfirmed: true }).to, 'READY_TO_SHOP');
  assert.equal(parkStateOf({ status: 'READY_TO_SHOP', openQuestions: 0 }), null);
  assert.ok(STEPS.AWAIT_LINE_RESOLUTION && STEPS.AWAIT_INTERPRETATION_CONFIRMATION);
});

test('B15-15 AC1: boardStateOf never returns blocked:false while a park is evidenced', () => {
  const rows = [{ question_key: 'q1', status: 'answered', answer_text: 'yes', item_name: 'ham' }];

  // No park supplied - the pure back-compatible reading, decided by questions.
  assert.equal(boardStateOf(rows).blocked, false);

  const parked = boardStateOf(rows, { parked: true, step: 'wait:line_resolution', reason: 'lines' });
  assert.equal(parked.blocked, true);
  assert.equal(parked.blockedReason, 'lines');

  const unknown = boardStateOf(rows, { parked: null, step: null, reason: null });
  assert.equal(unknown.blocked, null, 'the third state must be null - never dressed up as either of the other two');

  // An OPEN question still wins outright: it is the one blocker the board can
  // see for itself, and its reason must not be replaced by a park's.
  const open = boardStateOf([{ question_key: 'q1', status: 'open' }], { parked: null });
  assert.equal(open.blocked, true);
  assert.match(open.blockedReason, /question is open/);
});

test('B15-15 AC1: the park travels in the fingerprint, or a newly parked shop is never rewritten', () => {
  const rows = [{ question_key: 'q1', status: 'answered', answer_text: 'yes' }];
  const clear = boardStateOf(rows, { parked: false, step: null, reason: null });
  const parked = boardStateOf(rows, { parked: true, step: 'wait:line_resolution', reason: 'lines' });
  assert.notEqual(clear.fingerprint, parked.fingerprint,
    'two boards saying opposite things share a fingerprint, so the second one is never sent');
});

// =====================================================================
// WP-B15-15 AC4 - THE HARNESS MODELS THE SQL, NOT ITS INTENT
//
// WP-B15-10 mutated its own exclusion statement to `shop_id = $1` - the
// ALLOWLIST direction, the very bug it had just reverted - and EVERY
// BEHAVIOURAL TEST STAYED GREEN. Only a statement-shape test went red.
//
// The cause is not the statement. `test/fakePg.js` had no handler for it, so
// `runPipeline.test.js` answered it from a hand-written closure that matched
// the EXPORTED CONSTANT and then applied its own hardcoded `shop_id !==`
// semantics. It modelled what the query is MEANT to do, not what it SAYS, so
// inverting the text changed the constant on both sides of an equality check
// and nothing else. A harness like that cannot fail.
//
// The handler now lives in test/fakePg.js and READS THE OPERATOR OUT OF THE
// STATEMENT, in the same spirit as selectProjection() above it: no SQL parser,
// no schema registry, and it throws loudly on anything it cannot read.
//
// ── WHY THIS PROOF LIVES HERE AND NOT BESIDE ITS SUBJECT ────────────────────
// The behavioural foreign-claim tests are in runPipeline.test.js, which is
// another Work Package's ACTIVE surface and is READ-ONLY to this one. Every one
// of them still routes through `withForeignClaimStatement`, which replaces
// `deps.readQuery` and returns BEFORE delegating to fakePg - so those
// particular tests remain blind to the statement until that closure is deleted.
// This suite drives the SAME production path - real shopLines.
// listForeignClaimedItemIds, real excludeForeignListItems, real runPipeline
// wiring, real rows - through fakePg's OWN dispatch, so the inversion that
// survived once cannot survive here.
// =====================================================================

/** A dead shop (id 99) that already owns list 20, plus an item nobody claims -
 *  the shape a cockpit `add_regular_to_next_week` leaves behind. Mirrors the
 *  fixture in runPipeline.test.js deliberately: the same durable rows, answered
 *  by fakePg's dispatch instead of by a closure. */
function sharedListSeedForFakePg() {
  return {
    shopping_lists: [{ id: 20, household_id: HOUSEHOLD_ID, status: 'next_week_draft', list_date: '2026-08-03' }],
    shopping_list_items: [
      {
        id: 210, list_id: 20, item_name: 'HAM ON THE BONE', matched_product_id: null,
        requested_qty: 1, added_qty: null, status: 'needs_decision', price: null,
        note: 'typed the night before, for the week that was cancelled', one_week_only: false,
      },
      {
        id: 211, list_id: 20, item_name: 'Cockpit Added Regular', matched_product_id: null,
        requested_qty: 2, added_qty: null, status: 'requested', price: null,
        note: 'added via cockpit', one_week_only: false,
      },
    ],
    shop_line: [{
      id: 900, shop_id: 99, line_no: 1, raw_reading: 'HAM ON THE BONE', quantity: null,
      matched_regular_id: null, match_basis: null, match_confidence: null, alternatives: [],
      status: 'unmatched_new_item', confirmed_by: null, confirmed_at: null, corrected: false,
      list_item_id: 210,
    }],
  };
}

/** Drive a fresh shop onto the shared list with NO statement wiring at all, so
 *  the exclusion is answered by test/fakePg.js reading the real SQL. */
async function planOnSharedListThroughFakePg() {
  const handed = [];
  const h = makeHarness({
    seed: sharedListSeedForFakePg(),
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: 'fruit splits', quantity: null },
    ],
  });
  const realPlan = h.deps.planBasket;
  h.deps.planBasket = (input) => {
    handed.push(input.listItems.map((i) => String(i.item_name)));
    return realPlan(input);
  };
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: 'telegram:555', telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: 'telegram:555' }, h.deps);
  await runPipeline({ shopRef: REF }, h.deps);   // transcribe
  await runPipeline({ shopRef: REF }, h.deps);   // interpret
  await runPipeline({ shopRef: REF }, h.deps);   // plan
  return { h, handed, last: () => handed[handed.length - 1] || [] };
}

test('B15-15 AC4 BEHAVIOURAL: a DEAD shop\'s item is excluded, answered by fakePg reading the real SQL', async () => {
  const { last } = await planOnSharedListThroughFakePg();
  assert.ok(last().length > 0, 'the planner was never handed anything - the fixture stopped proving anything');
  assert.ok(!last().some((n) => /HAM ON THE BONE/i.test(n)),
    `a cancelled week's item reached the plan: ${JSON.stringify(last())}`);
});

test('B15-15 AC4 BEHAVIOURAL: THIS shop\'s own lines still reach the planner', async () => {
  // ESTABLISHED BY EXECUTING THE INVERSION, not assumed: this assertion holds
  // in BOTH directions, and the reason is worth carrying. Under `shop_id = $1`
  // the statement returns what THIS shop claims - but excludeForeignListItems
  // then subtracts `ownIds` from the foreign set ("a row this shop also claims
  // is this shop's, whatever else claims it", runPipeline.js:511-515), which
  // empties it. So the allowlist direction degrades to EXCLUDING NOTHING rather
  // than to deleting Warwick's week.
  //
  // That is exactly why the bug was so quiet, and why the test above - the dead
  // shop's item coming BACK - is the assertion that kills it. This one pins the
  // other half: the fix must never start dropping the shop's own lines either.
  const { last } = await planOnSharedListThroughFakePg();
  assert.ok(last().some((n) => /gourmet cat food/i.test(n)),
    `the shop's own interpreted line was excluded from its own plan: ${JSON.stringify(last())}`);
});

test('B15-15 AC4 BEHAVIOURAL: an UNCLAIMED item still reaches the plan', async () => {
  // Unclaimed belongs to nobody and STAYS. Neither direction of the statement
  // returns it, so this pins that the handler is not simply keeping everything.
  const { last } = await planOnSharedListThroughFakePg();
  assert.ok(last().some((n) => /Cockpit Added Regular/i.test(n)),
    `an item Warwick added from the cockpit was silently dropped: ${JSON.stringify(last())}`);
});

test('B15-15 AC4: fakePg REFUSES a foreign-claims statement whose predicate it cannot read', async () => {
  // A handler that silently tolerated an unrecognised shape would recreate the
  // exact blindness this closes, so the failure is loud rather than lenient.
  const { _internal } = await import('./test/fakePg.js');
  assert.throws(
    () => _internal.foreignClaimPredicate(
      'SELECT DISTINCT list_item_id FROM asdair.shop_line WHERE shop_id ~~ $1 AND list_item_id = ANY($2::bigint[])'),
    /operator/i,
  );
  assert.throws(
    () => _internal.foreignClaimPredicate(
      'SELECT DISTINCT list_item_id FROM asdair.shop_line WHERE shop_id <> $1'),
    /list_item_id/i,
  );
  // And it reads BOTH directions rather than assuming the one it prefers.
  assert.equal(_internal.foreignClaimPredicate(shopLinesSql.SELECT_FOREIGN_CLAIMS_SQL).foreign, true);
  assert.equal(
    _internal.foreignClaimPredicate(
      shopLinesSql.SELECT_FOREIGN_CLAIMS_SQL.replace('shop_id <> $1', 'shop_id = $1')).foreign,
    false,
    'the handler cannot see the inversion, so every test built on it is blind to the statement',
  );
});
