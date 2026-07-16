import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIdempotencyKey,
  normalisePayload,
  sha256Hex,
  createDedupIndex,
} from '../src/core/idempotency.js';

test('same logical capture ⇒ same key', () => {
  const a = buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: 'chat:88012345:msg:40771',
    raw_payload: 'Reminder: pH buffer note',
  });
  const b = buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: 'chat:88012345:msg:40771',
    raw_payload: 'Reminder: pH buffer note',
  });
  assert.equal(a, b);
});

test('key does not depend on wall-clock or call order', () => {
  const k1 = buildIdempotencyKey({ source_channel: 'web', channel_native_message_id: 'm1', raw_payload: 'hi' });
  // Different moment in time, identical inputs → identical key.
  const k2 = buildIdempotencyKey({ source_channel: 'web', channel_native_message_id: 'm1', raw_payload: 'hi' });
  assert.equal(k1, k2);
});

test('cosmetic whitespace differences normalise to the same key', () => {
  const a = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'm2', raw_payload: 'hello   world' });
  const b = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'm2', raw_payload: '  hello world  ' });
  assert.equal(a, b);
});

test('different content ⇒ different key', () => {
  const a = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'm3', raw_payload: 'one' });
  const b = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'm3', raw_payload: 'two' });
  assert.notEqual(a, b);
});

test('different channel or message id ⇒ different key', () => {
  const base = { channel_native_message_id: 'm4', raw_payload: 'same' };
  const tg = buildIdempotencyKey({ source_channel: 'telegram', ...base });
  const web = buildIdempotencyKey({ source_channel: 'web', ...base });
  assert.notEqual(tg, web);

  const m5 = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'm5', raw_payload: 'same' });
  assert.notEqual(tg, m5);
});

test('key format is <channel>:<msg_id>:sha256:<hex>', () => {
  const k = buildIdempotencyKey({ source_channel: 'telegram', channel_native_message_id: 'chat:1:msg:2', raw_payload: 'x' });
  assert.match(k, /^telegram:chat:1:msg:2:sha256:[0-9a-f]{64}$/);
});

test('object payloads are order-independent', () => {
  const a = buildIdempotencyKey({ source_channel: 'api', channel_native_message_id: 'm6', raw_payload: { a: 1, b: 2 } });
  const b = buildIdempotencyKey({ source_channel: 'api', channel_native_message_id: 'm6', raw_payload: { b: 2, a: 1 } });
  assert.equal(a, b);
});

test('buildIdempotencyKey validates required parts', () => {
  assert.throws(() => buildIdempotencyKey({ channel_native_message_id: 'm', raw_payload: 'x' }), /source_channel required/);
  assert.throws(() => buildIdempotencyKey({ source_channel: 'web', raw_payload: 'x' }), /channel_native_message_id required/);
});

test('normalisePayload + sha256Hex are stable primitives', () => {
  assert.equal(normalisePayload('  a  b '), 'a b');
  assert.equal(sha256Hex('a b'), sha256Hex(normalisePayload('  a  b ')));
});

test('dedup index resolves re-delivery to existing capture_id', () => {
  const idx = createDedupIndex();
  const first = idx.register('k1', 'capture-1');
  assert.deepEqual(first, { captureId: 'capture-1', isNew: true });

  const second = idx.register('k1', 'capture-2-attempt');
  assert.deepEqual(second, { captureId: 'capture-1', isNew: false }); // existing wins
  assert.equal(idx.size, 1);
  assert.equal(idx.get('k1'), 'capture-1');
  assert.equal(idx.has('k2'), false);
});
