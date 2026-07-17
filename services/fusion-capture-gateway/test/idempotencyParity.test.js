// BUILD-002 WP1 — U12: golden-vector byte-parity between the Node WP0
// derivation (core/idempotency.js + telegramMapping.deriveCaptureId) and the
// Deno-portable edge port (supabase/functions/fcg-webhook-intake/derive.js).
//
// THE PARITY IS THE CROSS-TRANSPORT DEDUP GUARANTEE: a message that reaches
// the WP0 poll runner AND the WP1 edge webhook must resolve to the SAME
// idempotency_key and the SAME capture_id, or layer-2 dedup (architecture §0)
// is aspirational. Expected values are PINNED in the fixture (generated once
// from the Node implementation, 2026-07-17); BOTH implementations are asserted
// against the pins, so drift in EITHER side fails CI — including any change to
// normalisation, hashing, the native-id shape, or the v5-UUID derivation.
//
// Hermetic: no network, no DB, no Deno runtime — the port is plain WebCrypto
// ESM that Node 22 executes natively.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIdempotencyKey as nodeBuildKey } from '../src/core/idempotency.js';
import { deriveCaptureId as nodeDeriveCaptureId } from '../src/adapters/telegramMapping.js';
import {
  buildIdempotencyKey as portBuildKey,
  deriveCaptureId as portDeriveCaptureId,
  deriveTelegramTextKeys,
  channelNativeMessageId,
} from '../../../supabase/functions/fcg-webhook-intake/derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'idempotency-golden-vectors.json');
const { vectors } = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

function textOf(vector) {
  if (vector.textRepeat) return vector.textRepeat.unit.repeat(vector.textRepeat.times);
  return vector.text;
}

test('fixture sanity: vectors cover NFC/NFD, whitespace, emoji, CJK, and the 4096-char bound', () => {
  assert.ok(vectors.length >= 9, 'at least the nine designed vectors');
  const nfd = vectors.find((v) => v.name.startsWith('nfd decomposed'));
  const nfc = vectors.find((v) => v.name.startsWith('nfc composed'));
  assert.ok(nfd && nfc);
  assert.notEqual(textOf(nfd), textOf(nfc), 'the NFD twin is genuinely decomposed on disk');
  assert.equal(textOf(nfd).normalize('NFC'), textOf(nfc), 'NFD normalises to the NFC twin');
  assert.equal(nfd.expected_idempotency_key, nfc.expected_idempotency_key, 'NFC/NFD twins pin the SAME key');
  const big = vectors.find((v) => v.textRepeat);
  assert.equal(textOf(big).length, 4096, 'the max-length vector is exactly 4096 chars');
});

for (const vector of vectors) {
  test(`golden vector [${vector.name}]: Node impl reproduces the pinned key + capture_id`, () => {
    const text = textOf(vector);
    const key = nodeBuildKey({
      source_channel: 'telegram',
      channel_native_message_id: `chat:${vector.senderId}:msg:${vector.messageId}`,
      raw_payload: text,
    });
    assert.equal(key, vector.expected_idempotency_key, 'Node idempotency key drifted from the pin');
    assert.equal(nodeDeriveCaptureId(key), vector.expected_capture_id, 'Node capture_id drifted from the pin');
  });

  test(`golden vector [${vector.name}]: Deno-port impl reproduces the pinned key + capture_id byte-identically`, async () => {
    const text = textOf(vector);
    const key = await portBuildKey({
      source_channel: 'telegram',
      channel_native_message_id: channelNativeMessageId(vector.senderId, vector.messageId),
      raw_payload: text,
    });
    assert.equal(key, vector.expected_idempotency_key, 'edge-port idempotency key drifted from the pin');
    assert.equal(await portDeriveCaptureId(key), vector.expected_capture_id, 'edge-port capture_id drifted from the pin');

    // The one-call convenience used by the handler produces the same pair.
    const combined = await deriveTelegramTextKeys({
      senderId: vector.senderId,
      messageId: vector.messageId,
      text,
    });
    assert.equal(combined.idempotencyKey, vector.expected_idempotency_key);
    assert.equal(combined.captureId, vector.expected_capture_id);
  });
}

test('parity extends beyond the pins: 64 random-ish inputs agree between Node and the port', async () => {
  // Deterministic pseudo-random corpus (no wall clock, no Math.random seed
  // drift): cover ascii, unicode, long runs, and pathological whitespace.
  const alphabets = ['abc XYZ 123 ', 'дом 語 ', '\t\n é é ', '🚀👍🏽 ', ' x '];
  for (let i = 0; i < 64; i += 1) {
    const a = alphabets[i % alphabets.length];
    const text = (a.repeat((i % 7) + 1) + i).slice(0, 4096);
    const senderId = String(1000 + i);
    const messageId = 5000 + i;
    const nodeKey = nodeBuildKey({
      source_channel: 'telegram',
      channel_native_message_id: `chat:${senderId}:msg:${messageId}`,
      raw_payload: text,
    });
    const portPair = await deriveTelegramTextKeys({ senderId, messageId, text });
    assert.equal(portPair.idempotencyKey, nodeKey, `corpus item ${i}: key parity`);
    assert.equal(portPair.captureId, nodeDeriveCaptureId(nodeKey), `corpus item ${i}: capture_id parity`);
  }
});
