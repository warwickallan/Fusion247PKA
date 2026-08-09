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

// =====================================================================
// WP-B15-A1 - THE THIRD SHAPE: a plain typed message
//
// Until this existed, a typed answer counted only if Warwick first long-pressed
// the right card and used reply-to. Everything else fell out of the bottom of
// routeAsdairUpdate as NOT_ASDAIR and was never seen again - which is exactly
// what happened to question 76463 in production on 2026-08-09.
// =====================================================================

/** A plain message. No reply_to_message, no callback_query - just words. */
function bareText(text = 'the cheese one please', { chatId = 555, messageId = 900 } = {}) {
  return {
    update_id: 11,
    message: {
      message_id: messageId,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      text,
    },
  };
}

test('A1: a bare typed message becomes an ANSWER intent when the caller correlates it', () => {
  const out = routeAsdairUpdate(bareText(), {
    resolveAnswersByText: () => ({
      mappings: [{ questionKey: 'q-cheese', shopRef: 'SHOP-2026-08-03', answerText: 'the cheese one please' }],
    }),
  });

  assert.equal(out.ok, true, 'a bare typed message is still being dropped');
  assert.equal(out.action, ACTIONS.ANSWER);
  assert.equal(out.arg, 'q-cheese', 'the intent must name the QUESTION, not a candidate index');
  assert.equal(out.shopRef, 'SHOP-2026-08-03');
  assert.equal(out.raw.kind, 'text', 'a bare message must be distinguishable from a reply');
  assert.equal(out.raw.text, 'the cheese one please', 'the words must pass through verbatim');
  assert.equal(out.responder, 'telegram:555');
});

test('A1: BACKWARD COMPATIBLE - with no correlator injected, behaviour is exactly as before', () => {
  const out = routeAsdairUpdate(bareText(), {});
  assert.equal(out.ok, false);
  assert.equal(out.reason, REFUSALS.NOT_ASDAIR,
    'a caller that wires nothing must keep the old behaviour, not acquire a new one');
});

test('A1: an uncorrelated message is refused with its OWN reason, so it can go on to intake', () => {
  const out = routeAsdairUpdate(bareText('4 pints of milk\n2 bread'), {
    resolveAnswersByText: () => null,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, REFUSALS.UNCORRELATED_TEXT,
    'a genuine new shopping list must be distinguishable from a foreign update');
  assert.notEqual(out.reason, REFUSALS.UNCORRELATED_REPLY,
    'a bare message is not a reply that lost its card - conflating them hides a real miss');
});

test('A1: an EMPTY correlation is never a claim', () => {
  const out = routeAsdairUpdate(bareText(), { resolveAnswersByText: () => ({ mappings: [] }) });
  assert.equal(out.ok, false);
  assert.equal(out.reason, REFUSALS.UNCORRELATED_TEXT);
});

test('A1: a mapping with no questionKey is discarded rather than half-used', () => {
  const out = routeAsdairUpdate(bareText(), {
    resolveAnswersByText: () => ({ mappings: [{ shopRef: 'SHOP-2026-08-03', answerText: 'x' }] }),
  });
  assert.equal(out.ok, false, 'a mapping naming no question was treated as an answer');
});

test('A1: ONE message can carry SEVERAL question mappings', () => {
  const out = routeAsdairUpdate(bareText('cheese one and the toastie loaf'), {
    resolveAnswersByText: () => ({
      mappings: [
        { questionKey: 'q-cheese', shopRef: 'SHOP-2026-08-03', answerText: 'cheese one' },
        { questionKey: 'q-bread', shopRef: 'SHOP-2026-08-03', answerText: 'the toastie loaf' },
      ],
    }),
  });

  assert.equal(out.ok, true);
  assert.equal(out.raw.mappings.length, 2, 'a multi-question answer was flattened to one');
  assert.equal(out.raw.mappings[0].answerText, 'cheese one');
  assert.equal(out.raw.mappings[1].answerText, 'the toastie loaf');
  assert.equal(out.arg, 'q-cheese', 'the first mapping should still be readable as a single intent');
});

test('A1: a mapping with no fragment falls back to the whole message, never to empty', () => {
  const out = routeAsdairUpdate(bareText('just the usual'), {
    resolveAnswersByText: () => ({ mappings: [{ questionKey: 'q-cheese', shopRef: 'R' }] }),
  });
  assert.equal(out.raw.mappings[0].answerText, 'just the usual');
});

test('A1: a REPLY still takes the reply path, never the new one', () => {
  const reply = bareText();
  reply.message.reply_to_message = { message_id: 9001, chat: { id: 555 } };

  const out = routeAsdairUpdate(reply, {
    resolveQuestionByMessage: () => ({ questionKey: 'q-from-card', shopRef: 'SHOP-2026-08-03' }),
    // Deliberately wired too: the reply branch must win, because the card it
    // replies to is a HARDER correlation than reading the words.
    resolveAnswersByText: () => ({ mappings: [{ questionKey: 'q-from-text', shopRef: 'R' }] }),
  });

  assert.equal(out.ok, true);
  assert.equal(out.raw.kind, 'reply');
  assert.equal(out.arg, 'q-from-card', 'the card correlation must outrank reading the words');
});

test('A1: a whitespace-only message is never an answer', () => {
  const out = routeAsdairUpdate(bareText('   '), {
    resolveAnswersByText: () => ({ mappings: [{ questionKey: 'q-cheese', shopRef: 'R' }] }),
  });
  assert.equal(out.ok, false, 'blank words were treated as an answer');
});
