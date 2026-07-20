// TRANSCRIPTION STAGE (D1 / G3 / B1) — injected transcriber + on-main normaliser.
// Hermetic: the transcriber is a FAKE returning fixture OCR/STT text; no model
// call, no network, no bytes fetched.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTranscriptionStage, deriveRawObject } from '../src/transcription/transcriptionStage.js';

const IMAGE_RAW = {
  technical_source_type: 'image',
  store: 'supabase-storage',
  object_key: 'telegram:image:uniqA',
  content_type: 'image/jpeg',
  bytes: 90000,
  sha256: null,
  fetched: false,
};

const VOICE_RAW = {
  technical_source_type: 'voice',
  store: 'supabase-storage',
  object_key: 'telegram:voice:uniqV',
  content_type: 'audio/ogg',
  bytes: 5555,
  sha256: null,
  fetched: false,
};

test('constructor requires an injected transcriber fn', () => {
  assert.throws(() => createTranscriptionStage({}), /injected `transcriber` fn is required/);
});

test('IMAGE: injected transcriber is CALLED and OCR text is wired into normaliseRawList', async () => {
  const calls = [];
  const fakeOcr = 'Milk x2\n- eggs (organic)\n3 apples\nx4 bananas';
  const transcriber = (rawObject) => {
    calls.push(rawObject);
    return { text: fakeOcr, confidence: 0.91 };
  };
  const stage = createTranscriptionStage({ transcriber });

  const out = await stage.transcribe(IMAGE_RAW);

  // Injected transcriber called exactly once, with the raw_object.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].object_key, 'telegram:image:uniqA');
  assert.equal(calls[0].technical_source_type, 'image');

  // B1 shape + normaliser output correct (asserted against the on-main parser).
  assert.equal(out.kind, 'image');
  assert.equal(out.text, fakeOcr);
  assert.equal(out.confidence, 0.91);
  assert.ok(Array.isArray(out.items));
  assert.ok(Array.isArray(out.needs_review));
  assert.deepEqual(out.items, [
    { item_name: 'milk', requested_qty: 2, note: '' },
    { item_name: 'eggs', requested_qty: 1, note: 'organic' },
    { item_name: 'apples', requested_qty: 3, note: '' },
    { item_name: 'bananas', requested_qty: 4, note: '' },
  ]);
  assert.equal(out.needs_review.length, 0);
});

test('IMAGE: an ambiguous OCR line lands in needs_review (never guessed) — proves the real normaliser is wired', async () => {
  const transcriber = () => 'milk\n5 vs 6 eggs\n0 bread';
  const stage = createTranscriptionStage({ transcriber });
  const out = await stage.transcribe(IMAGE_RAW);
  // "0 bread" is a non-positive quantity -> needs_review; "milk" -> qty 1 item.
  const reviewReasons = out.needs_review.map((r) => r.reason);
  assert.ok(reviewReasons.some((r) => /non-positive quantity/.test(r)), 'non-positive qty routed to review');
  assert.ok(out.items.some((it) => it.item_name === 'milk' && it.requested_qty === 1));
});

test('VOICE: injected transcriber is CALLED; transcript text returned (no normaliser step)', async () => {
  const calls = [];
  const transcriber = (rawObject) => {
    calls.push(rawObject);
    return { text: 'remember to call the plumber tomorrow', confidence: 0.8 };
  };
  const stage = createTranscriptionStage({ transcriber });

  const out = await stage.transcribeVoice(VOICE_RAW);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].technical_source_type, 'voice');
  assert.equal(out.kind, 'voice');
  assert.equal(out.text, 'remember to call the plumber tomorrow');
  assert.equal(out.confidence, 0.8);
  assert.equal(out.items, undefined, 'voice does not normalise into a list');
});

test('a bare-string transcriber result is accepted (text, null confidence)', async () => {
  const stage = createTranscriptionStage({ transcriber: () => 'apples\nbread' });
  const out = await stage.transcribe(IMAGE_RAW);
  assert.equal(out.confidence, null);
  assert.equal(out.items.length, 2);
});

test('wrong modality is rejected (image method on a voice raw_object and vice versa)', async () => {
  const stage = createTranscriptionStage({ transcriber: () => 'x' });
  await assert.rejects(() => stage.transcribe(VOICE_RAW), /technical_source_type 'image' required/);
  await assert.rejects(() => stage.transcribeVoice(IMAGE_RAW), /technical_source_type 'voice' required/);
});

test('a transcriber that throws PROPAGATES (so the worker treats it as an honest failure -> retry)', async () => {
  const stage = createTranscriptionStage({ transcriber: () => { throw new Error('model timeout'); } });
  await assert.rejects(() => stage.transcribe(IMAGE_RAW), /model timeout/);
});

// ── deriveRawObject: reconstruct the descriptor from a durable store record ──

test('deriveRawObject rebuilds the raw_object from a durable record (technical_source_type + raw_payload_ref)', () => {
  const record = {
    technical_source_type: 'image',
    raw_payload_ref: { store: 'supabase-storage', object_key: 'telegram:image:uniqA', content_type: 'image/jpeg', bytes: 90000 },
  };
  const raw = deriveRawObject(record);
  assert.equal(raw.technical_source_type, 'image');
  assert.equal(raw.object_key, 'telegram:image:uniqA');
  assert.equal(raw.content_type, 'image/jpeg');
  assert.equal(raw.bytes, 90000);
  assert.equal(raw.fetched, false);
});

test('deriveRawObject rejects a non-multimodal record', () => {
  assert.throws(() => deriveRawObject({ technical_source_type: 'text' }), /image\|voice only/);
});
