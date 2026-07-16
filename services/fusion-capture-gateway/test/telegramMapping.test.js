// Shared Telegram → envelope mapping — reuse contract. Hermetic, no network.

import test from 'node:test';
import assert from 'node:assert/strict';

import { mapTelegramUpdate, deriveCaptureId, intentFromAction } from '../src/adapters/telegramMapping.js';

const AUTH_ID = 424242;
const NOW = 1_700_000_000_000;

function update(messageId, text, fromId = AUTH_ID) {
  return { message: { message_id: messageId, from: { id: fromId }, text } };
}

test('authorised sender maps onto a channel-neutral envelope (no Telegram leak in intent)', () => {
  const r = mapTelegramUpdate({ update: update(1, 'hello brain'), now: NOW, authorisedUserId: AUTH_ID });
  assert.equal(r.ok, true);
  assert.equal(r.value.source_channel, 'telegram');
  assert.equal(r.value.sender_identity_ref, `telegram:user:${AUTH_ID}`);
  assert.equal(r.value.technical_source_type, 'text');
  assert.equal(r.value.recorded_intent, 'SaveToBrain');
  assert.equal(r.senderId, String(AUTH_ID));
});

test('single-user default-deny: a foreign sender is rejected with sender id surfaced for logging', () => {
  const r = mapTelegramUpdate({ update: update(2, 'let me in', 999), now: NOW, authorisedUserId: AUTH_ID });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unauthorised_sender');
  assert.equal(r.senderId, '999');
});

test('malformed update with no message is rejected (no_message)', () => {
  const r = mapTelegramUpdate({ update: {}, now: NOW, authorisedUserId: AUTH_ID });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_message');
});

test('capture_id is deterministic per idempotency key; action maps to intent', () => {
  const a = mapTelegramUpdate({ update: update(3, 'same body'), now: NOW, authorisedUserId: AUTH_ID });
  const b = mapTelegramUpdate({ update: update(3, 'same body'), now: NOW + 5000, authorisedUserId: AUTH_ID });
  assert.equal(a.value.capture_id, b.value.capture_id, 'same logical message → same id');
  assert.equal(a.value.capture_id, deriveCaptureId(a.value.idempotency_key));
  assert.equal(intentFromAction('AskLarry'), 'LarryDirect');
  const asked = mapTelegramUpdate({ update: update(4, 'q'), now: NOW, authorisedUserId: AUTH_ID, action: 'AskLarry' });
  assert.equal(asked.value.recorded_intent, 'LarryDirect');
});
