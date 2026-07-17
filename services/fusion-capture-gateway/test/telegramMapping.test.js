// Shared Telegram → envelope mapping — reuse contract. Hermetic, no network.

import test from 'node:test';
import assert from 'node:assert/strict';

import { mapTelegramUpdate, deriveCaptureId, intentFromAction } from '../src/adapters/telegramMapping.js';

const AUTH_ID = 424242;
const NOW = 1_700_000_000_000;

function update(messageId, text, fromId = AUTH_ID) {
  return { message: { message_id: messageId, from: { id: fromId }, chat: { id: fromId, type: 'private' }, text } };
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

test('NON-TEXT rejection: authorised photo/voice/document/sticker updates never map to an envelope', () => {
  // Live defect 2026-07-16: a photo produced an empty capture that falsely
  // completed. The mapping now rejects any authorised message with no usable
  // text — no envelope is ever built for it.
  const media = [
    { photo: [{ file_id: 'AgACAgQAAxk', width: 90, height: 90 }] },
    { voice: { file_id: 'AwACAgQAAxk', duration: 3 } },
    { document: { file_id: 'BQACAgQAAxk', file_name: 'x.pdf' } },
    { sticker: { file_id: 'CAACAgQAAxk', emoji: '👍' } },
  ];
  for (const extra of media) {
    const r = mapTelegramUpdate({
      update: { message: { message_id: 42, from: { id: AUTH_ID }, ...extra } },
      now: NOW,
      authorisedUserId: AUTH_ID,
    });
    assert.equal(r.ok, false, `${Object.keys(extra)[0]} must not map`);
    assert.equal(r.reason, 'unsupported_content_type');
    assert.equal(r.senderId, String(AUTH_ID), 'sender surfaced so the caller can reply');
  }
});

test('NON-TEXT rejection: empty or whitespace-only text is unusable text, same rejection', () => {
  for (const text of ['', '   ', '\n\t ']) {
    const r = mapTelegramUpdate({ update: update(43, text), now: NOW, authorisedUserId: AUTH_ID });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unsupported_content_type');
  }
});

test('NON-TEXT rejection: an UNAUTHORISED photo stays a plain unauthorised_sender (no content-type oracle)', () => {
  const r = mapTelegramUpdate({
    update: { message: { message_id: 44, from: { id: 999 }, photo: [{ file_id: 'AgACAgQAAxk' }] } },
    now: NOW,
    authorisedUserId: AUTH_ID,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unauthorised_sender', 'allowlist check comes first');
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
