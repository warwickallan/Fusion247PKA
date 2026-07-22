// BUILD-002 WP4 — telegram inbound decision mapper: unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapInboundDecision, decisionCallbackData, DECISION_CALLBACK_PREFIX } from './telegramInbound.mjs';

test('maps an inline-button tap (callback_query) to {card_id, responder, raw_text}', () => {
  const data = decisionCallbackData('card-123', 'A');
  assert.equal(data, `${DECISION_CALLBACK_PREFIX}card-123:A`);
  const r = mapInboundDecision({ callback_query: { data, from: { id: 42 } } });
  assert.deepEqual(r, { ok: true, kind: 'callback', card_id: 'card-123', responder: 'telegram:42', raw_text: 'A' });
});

test('maps a typed reply to the card message via a card_ref reverse lookup', () => {
  const r = mapInboundDecision(
    { message: { text: 'B', chat: { id: 9 }, reply_to_message: { message_id: 555 }, from: { id: 42 } } },
    { resolveCardByMessage: (chat, msg) => (chat === 9 && msg === 555 ? 'card-xyz' : null) },
  );
  assert.equal(r.ok, true);
  assert.equal(r.card_id, 'card-xyz');
  assert.equal(r.raw_text, 'B');
});

test('an uncorrelated reply is not mapped', () => {
  const r = mapInboundDecision(
    { message: { text: 'A', chat: { id: 1 }, reply_to_message: { message_id: 1 } } },
    { resolveCardByMessage: () => null },
  );
  assert.equal(r.ok, false);
});

test('malformed and non-decision updates are refused', () => {
  assert.equal(mapInboundDecision({ callback_query: { data: 'decision:onlyid', from: { id: 1 } } }).ok, false);
  assert.equal(mapInboundDecision({ callback_query: { data: 'somethingelse' } }).ok, false);
  assert.equal(mapInboundDecision({ message: { text: 'hi' } }).ok, false);
  assert.equal(mapInboundDecision({}).ok, false);
});
