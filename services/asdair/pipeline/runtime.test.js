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

import { makeHarness, makeIntake, textUpdate, callbackUpdate, HOUSEHOLD_ID } from './test/harness.js';
import { runOnce, runWatch, pollIntake, routeTaps, drainOutbox, createCapturingTelegram } from './runtime.js';
import { intentToCommand, ADAPTER_REFUSALS } from './telegramAdapter.js';
import { COMMANDS } from './commandNames.js';
import * as commands from './commands.js';
import { questionKeyFor } from './keys.js';

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
