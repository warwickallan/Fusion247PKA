// MULTIMODAL MAPPING (G2) — opt-in photo + voice accept. Hermetic, no network.
//
// Proves the mapping change is BACKWARD-COMPATIBLE (default off = WP0 text-only
// unchanged) and, when opted in, ACCEPTS an authorised private photo/voice with
// the correct technical_source_type + a raw_object pointer — WITHOUT weakening
// the security ORDER (allowlist -> private-chat -> content-type).

import test from 'node:test';
import assert from 'node:assert/strict';

import { mapTelegramUpdate, deriveCaptureId } from '../src/adapters/telegramMapping.js';
import { buildIdempotencyKey } from '../src/core/idempotency.js';
import { validateEnvelope } from '../src/core/contracts.js';

const AUTH_ID = 424242;
const NOW = 1_700_000_000_000;

function photoMsg(messageId, { fromId = AUTH_ID, chat = { id: AUTH_ID, type: 'private' }, photo, caption } = {}) {
  return {
    message: {
      message_id: messageId,
      from: { id: fromId },
      chat,
      photo: photo ?? [
        { file_id: 'AgAC-small', file_unique_id: 'uniqA', width: 90, height: 90, file_size: 1200 },
        { file_id: 'AgAC-big', file_unique_id: 'uniqA', width: 800, height: 600, file_size: 90000 },
      ],
      ...(caption !== undefined ? { caption } : {}),
    },
  };
}

function voiceMsg(messageId, { fromId = AUTH_ID, chat = { id: AUTH_ID, type: 'private' }, voice } = {}) {
  return {
    message: {
      message_id: messageId,
      from: { id: fromId },
      chat,
      voice: voice ?? { file_id: 'AwAC-voice', file_unique_id: 'uniqV', duration: 4, mime_type: 'audio/ogg', file_size: 5555 },
    },
  };
}

// ── DEFAULT OFF: WP0 text-only contract is UNCHANGED ────────────────────────

test('DEFAULT (acceptMultimodal off): authorised private photo/voice still reject unsupported_content_type', () => {
  const p = mapTelegramUpdate({ update: photoMsg(1), now: NOW, authorisedUserId: AUTH_ID });
  assert.equal(p.ok, false);
  assert.equal(p.reason, 'unsupported_content_type');

  const v = mapTelegramUpdate({ update: voiceMsg(2), now: NOW, authorisedUserId: AUTH_ID });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'unsupported_content_type');
});

// ── OPT-IN ON: photo accepted as an 'image' envelope with a raw_object pointer ─

test('acceptMultimodal: authorised private PHOTO maps to an image envelope with a raw_object pointer', () => {
  const r = mapTelegramUpdate({ update: photoMsg(10, { caption: 'my shopping list' }), now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true });
  assert.equal(r.ok, true);
  const env = r.value;
  assert.equal(env.technical_source_type, 'image');
  assert.equal(env.source_channel, 'telegram');
  assert.equal(env.sender_identity_ref, `telegram:user:${AUTH_ID}`);
  // raw_object pointer (G2): carries the LARGEST photo's file id + the private bucket key.
  assert.ok(env.raw_object, 'raw_object descriptor present');
  assert.equal(env.raw_object.technical_source_type, 'image');
  assert.equal(env.raw_object.bucket, 'fcg-raw-private');
  assert.equal(env.raw_object.object_key, 'telegram:image:uniqA');
  assert.equal(env.raw_object.source.file_id, 'AgAC-big', 'largest photo chosen for OCR fidelity');
  assert.deepEqual(env.raw_object.source.file_ids, ['AgAC-small', 'AgAC-big']);
  assert.equal(env.raw_object.fetched, false, 'bytes not fetched in this increment');
  assert.equal(env.raw_object.sha256, null);
  // raw_payload_ref IS the pointer; original retained.
  assert.equal(env.raw_payload_ref.object_key, 'telegram:image:uniqA');
  assert.equal(env.raw_payload_ref.content_type, 'image/jpeg');
  assert.equal(env.original_source_ref.retained, true);
  // caption surfaces as the (non-authoritative) preview.
  assert.equal(env.text_preview, 'my shopping list');
  // A well-formed envelope.
  assert.equal(validateEnvelope(env).ok, true);
});

test('acceptMultimodal: authorised private VOICE maps to a voice envelope', () => {
  const r = mapTelegramUpdate({ update: voiceMsg(11), now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true });
  assert.equal(r.ok, true);
  const env = r.value;
  assert.equal(env.technical_source_type, 'voice');
  assert.equal(env.raw_object.technical_source_type, 'voice');
  assert.equal(env.raw_object.object_key, 'telegram:voice:uniqV');
  assert.equal(env.raw_object.content_type, 'audio/ogg');
  assert.equal(env.raw_payload_ref.content_type, 'audio/ogg');
  assert.equal(env.raw_object.source.file_id, 'AwAC-voice');
  assert.equal(validateEnvelope(env).ok, true);
});

// ── SECURITY ORDER preserved even with multimodal ON ────────────────────────

test('acceptMultimodal ON does NOT weaken the order: stranger photo -> unauthorised_sender (no content oracle)', () => {
  const r = mapTelegramUpdate({
    update: photoMsg(20, { fromId: 999, chat: { id: 999, type: 'private' } }),
    now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unauthorised_sender');
});

test('acceptMultimodal ON does NOT weaken the order: authorised group photo -> non_private_chat (before content-type)', () => {
  const r = mapTelegramUpdate({
    update: photoMsg(21, { chat: { id: -100, type: 'group' } }),
    now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'non_private_chat');
});

test('acceptMultimodal ON: a document (non photo/voice) still rejects unsupported_content_type', () => {
  const r = mapTelegramUpdate({
    update: { message: { message_id: 22, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, document: { file_id: 'BQAC-doc', file_name: 'x.pdf' } } },
    now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unsupported_content_type');
});

// ── IDEMPOTENCY: a re-sent identical photo dedups to the same capture_id ─────

test('idempotency: a re-delivered identical photo resolves to the SAME capture_id + key', () => {
  const a = mapTelegramUpdate({ update: photoMsg(30), now: NOW, authorisedUserId: AUTH_ID, acceptMultimodal: true });
  const b = mapTelegramUpdate({ update: photoMsg(30), now: NOW + 5000, authorisedUserId: AUTH_ID, acceptMultimodal: true });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.idempotency_key, b.value.idempotency_key, 're-send yields the same key (no wall-clock)');
  assert.equal(a.value.capture_id, b.value.capture_id);
  // Key folds the stable per-file id, matching the mapping's construction.
  const expectedKey = buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: `chat:${AUTH_ID}:msg:30`,
    raw_payload: 'uniqA',
  });
  assert.equal(a.value.idempotency_key, expectedKey);
  assert.equal(a.value.capture_id, deriveCaptureId(expectedKey));
});
