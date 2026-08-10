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
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { makeHarness, makeIntake, textUpdate, callbackUpdate, HOUSEHOLD_ID } from './test/harness.js';
import {
  runOnce, runWatch, pollIntake, routeTaps, drainOutbox, queueShopCards, createCapturingTelegram,
  BASKET_HANDBACK_CONTRACT, basketHandbackPayload,
} from './runtime.js';
import { MESSAGES } from '../bot/renderMessages.js';
import { intentToCommand, ADAPTER_REFUSALS } from './telegramAdapter.js';
import { COMMANDS } from './commandNames.js';
import * as commands from './commands.js';
import { questionKeyFor } from './keys.js';
import { sendQuestionCard } from '../bot/questionRender.js';
import { TAP_REFUSALS } from '../bot/resolveTap.js';
import { buildAnswerArg } from '../bot/callbackProtocol.js';

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
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID, bot,
    intake: makeIntake([textUpdate({ text: '1 dreamies cheese\n2 gourmet cat food' })]),
  });
  await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });   // interpret
  const planned = await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot }); // plan + card

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

  await queueShopCards(h.deps, {});
  await drainOutbox(h.deps, { bot });
  assert.equal(bot.cards.length, 1);
  assert.equal(h.db.shop_question[0].card_message_id, '9001');

  // Four more passes over a shop whose question is still OPEN and unanswered.
  for (let i = 0; i < 4; i += 1) {
    await queueShopCards(h.deps, {});
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
  const first = await queueShopCards(h.deps, {});
  const second = await queueShopCards(h.deps, {});
  const third = await queueShopCards(h.deps, {});
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
  await queueShopCards(h.deps, {});
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
  await queueShopCards(h.deps, {});
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

test('B2 TYPED REPLY: replying to a question card answers it, verbatim', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await seedQuestion(h, [{ label: 'Dreamies Cheese 60g', regular_id: 41 }]);
  await queueShopCards(h.deps, {});
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
  await queueShopCards(h.deps, {});
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
  await queueShopCards(h.deps, {});
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
  await queueShopCards(h.deps, {});

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

  const first = await queueShopCards(h.deps, {});
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
    await queueShopCards(h.deps, {});
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
  assert.match(handover[0].message.text, /\/asdair\/checklist\?shop=SHOP-/,
    'the card must carry the route to the checklist. Telling him the shop is ready while giving him no '
    + 'way to reach the list is the silent park this build has already closed three times.');
  assert.match(handover[0].message.text, new RegExp(REF),
    'and it must name HIS shop, not just a route');
});
