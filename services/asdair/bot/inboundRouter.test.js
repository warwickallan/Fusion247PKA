// BUILD-015 AsdAIr bot — the inbound router: unit tests. Fully offline, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFUSALS, routeAsdairUpdate } from './inboundRouter.js';
import { ACTIONS, ACTION_VALUES, buildAnswerArg, buildCallbackData } from './callbackProtocol.js';
import { renderQuestionCard } from './renderMessages.js';

const REF = 'shop-2026-07-28';

const tap = (data, from = { id: 42 }, message = { message_id: 900, chat: { id: 7 } }) =>
  ({ callback_query: { id: 'cbq-1', data, from, message } });

// ── tapped buttons ───────────────────────────────────────────────────────────

test('a tapped button maps to { action, shopRef, arg, responder, raw }', () => {
  const r = routeAsdairUpdate(tap(buildCallbackData({ action: ACTIONS.BUILD, shopRef: REF })));
  assert.equal(r.ok, true);
  assert.equal(r.action, 'build');
  assert.equal(r.shopRef, REF);
  assert.equal(r.arg, null);
  assert.equal(r.responder, 'telegram:42');
  assert.equal(r.raw.kind, 'callback');
  assert.equal(r.raw.callbackQueryId, 'cbq-1');
  assert.equal(r.raw.chatId, 7);
  assert.equal(r.raw.messageId, 900);
});

test('EVERY action round-trips render -> tap -> intent', () => {
  for (const action of ACTION_VALUES) {
    const bare = routeAsdairUpdate(tap(buildCallbackData({ action, shopRef: REF })));
    assert.equal(bare.ok, true, `${action} not routed`);
    assert.equal(bare.action, action);
    assert.equal(bare.arg, null);

    const withArg = routeAsdairUpdate(tap(buildCallbackData({ action, shopRef: REF, arg: 'q7.2' })));
    assert.equal(withArg.ok, true, `${action} with arg not routed`);
    assert.equal(withArg.arg, 'q7.2');
  }
});

test('the buttons a REAL question card renders all route back correctly', () => {
  const card = renderQuestionCard({
    shopRef: REF, questionKey: 'q7', item: 'yoghurt',
    candidates: ['Yeo Valley Natural 500g', 'Arla Skyr 450g'],
  });
  const buttons = card.reply_markup.inline_keyboard.flat();
  const intents = buttons.map((b) => routeAsdairUpdate(tap(b.callback_data)));
  assert.ok(intents.every((i) => i.ok && i.shopRef === REF));
  assert.deepEqual(intents.map((i) => i.action), ['answer', 'answer', 'search', 'skip']);
  assert.deepEqual(intents.map((i) => i.arg), ['q7.0', 'q7.1', 'q7', 'q7']);
});

test('a responder with no id degrades to telegram:unknown rather than throwing', () => {
  const r = routeAsdairUpdate(tap(buildCallbackData({ action: ACTIONS.STATUS, shopRef: REF }), {}));
  assert.equal(r.ok, true);
  assert.equal(r.responder, 'telegram:unknown');
});

test('a callback with no attached message still routes, with null chat/message ids', () => {
  const r = routeAsdairUpdate({ callback_query: { id: 'x', data: buildCallbackData({ action: ACTIONS.STATUS, shopRef: REF }), from: { id: 1 } } });
  assert.equal(r.ok, true);
  assert.equal(r.raw.chatId, null);
  assert.equal(r.raw.messageId, null);
});

// ── typed replies ────────────────────────────────────────────────────────────

const reply = (text, { chatId = 7, replyTo = 900, from = { id: 42 } } = {}) => ({
  message: { message_id: 901, text, chat: { id: chatId }, reply_to_message: { message_id: replyTo }, from },
});

test('a typed reply to a question card is correlated via the injected lookup', () => {
  const r = routeAsdairUpdate(reply('the Yeo Valley one please'), {
    resolveQuestionByMessage: (chatId, messageId) =>
      (chatId === 7 && messageId === 900 ? { questionKey: 'q7', shopRef: REF } : null),
  });
  assert.equal(r.ok, true);
  assert.equal(r.action, ACTIONS.ANSWER);
  assert.equal(r.shopRef, REF);
  assert.equal(r.arg, 'q7');            // the QUESTION, not a candidate
  assert.equal(r.responder, 'telegram:42');
  assert.equal(r.raw.kind, 'reply');
  assert.equal(r.raw.text, 'the Yeo Valley one please');
  assert.equal(r.raw.replyToMessageId, 900);
});

test('the lookup may answer with a bare question key', () => {
  const r = routeAsdairUpdate(reply('skyr'), { resolveQuestionByMessage: () => 'q7' });
  assert.equal(r.ok, true);
  assert.equal(r.arg, 'q7');
  assert.equal(r.shopRef, null); // the lookup did not supply one; the router will not invent it
});

test('the reply text is passed through VERBATIM — the router routes, it never decides which candidate was meant', () => {
  const weird = "the 100% one, NOT the *low fat* [4 pack]";
  const r = routeAsdairUpdate(reply(`  ${weird}  `), { resolveQuestionByMessage: () => 'q7' });
  assert.equal(r.raw.text, weird);       // trimmed only
  assert.equal(r.arg, 'q7');             // no candidate index was chosen
  assert.ok(!('candidateIndex' in r));   // no resolution happened here
});

test('an uncorrelated reply is refused, not guessed at', () => {
  const r = routeAsdairUpdate(reply('yes'), { resolveQuestionByMessage: () => null });
  assert.equal(r.ok, false);
  assert.equal(r.reason, REFUSALS.UNCORRELATED_REPLY);
});

test('a reply with no lookup injected is refused rather than silently dropped', () => {
  const r = routeAsdairUpdate(reply('yes'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, REFUSALS.NO_LOOKUP);
});

test('an empty or non-text reply is refused', () => {
  const deps = { resolveQuestionByMessage: () => 'q7' };
  assert.equal(routeAsdairUpdate(reply('   '), deps).reason, REFUSALS.EMPTY_REPLY);
  assert.equal(routeAsdairUpdate(reply(''), deps).reason, REFUSALS.EMPTY_REPLY);
  assert.equal(routeAsdairUpdate({ message: { text: null, chat: { id: 7 }, reply_to_message: { message_id: 900 } } }, deps).reason, REFUSALS.EMPTY_REPLY);
});

test('a message that is NOT a reply is not claimed — the intake receiver owns plain messages', () => {
  const r = routeAsdairUpdate({ message: { text: 'milk, bread, eggs', chat: { id: 7 } } }, { resolveQuestionByMessage: () => 'q7' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, REFUSALS.NOT_ASDAIR);
});

// ── refusals ─────────────────────────────────────────────────────────────────

test('a foreign callback protocol is refused by namespace — the hub decision cards stay the hub\'s', () => {
  const r = routeAsdairUpdate(tap('decision:card-123:A'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, REFUSALS.NOT_ASDAIR);
});

test('malformed asdair callbacks are refused with a structured reason', () => {
  for (const bad of [
    'asd', 'asd:', 'asd:build', 'asd:build:', 'asd:notreal:ref',
    'asd:build:ref:arg:extra', 'asd:build:bad ref', `asd:build:${'r'.repeat(200)}`,
  ]) {
    const r = routeAsdairUpdate(tap(bad));
    assert.equal(r.ok, false, `should have refused: ${bad}`);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
});

test('junk updates are refused, never thrown on', () => {
  for (const junk of [null, undefined, 0, 'hello', [], {}, { callback_query: {} }, { callback_query: { data: 42 } }, { edited_message: { text: 'x' } }]) {
    const r = routeAsdairUpdate(junk);
    assert.equal(r.ok, false, `should have refused: ${JSON.stringify(junk)}`);
    assert.equal(typeof r.reason, 'string');
  }
});

test('the router never returns a decision — only an intent to be acted on elsewhere', () => {
  const r = routeAsdairUpdate(tap(buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF, arg: buildAnswerArg('q7', 1) })));
  assert.deepEqual(Object.keys(r).sort(), ['action', 'arg', 'ok', 'raw', 'responder', 'shopRef']);
  // No resolved product, no outcome, no side-effect handle.
  assert.ok(!('product' in r) && !('decision' in r) && !('db' in r) && !('result' in r));
});
