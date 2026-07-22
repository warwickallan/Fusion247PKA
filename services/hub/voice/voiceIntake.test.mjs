// BUILD-002 WP6 — voice intake: fixtures proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceIntake } from './voiceIntake.mjs';

test('preserves + transcribes a voice memo, routes a clear note intent', async () => {
  const r = await voiceIntake({ voice_ref: 'tg:file:V1', duration_sec: 12 }, { transcribe: async () => ({ text: 'Idea: a weekly review ritual on Sundays.' }) });
  assert.equal(r.envelope.source_channel, 'voice');
  assert.equal(r.envelope.transcript, 'Idea: a weekly review ritual on Sundays.');
  assert.equal(r.envelope.idempotency_key, 'voice:tg:file:V1');
  assert.equal(r.route, 'note');
});

test('a YouTube link in a transcript routes to the youtube lane (same router as every channel)', async () => {
  const r = await voiceIntake({ voice_ref: 'V2' }, { transcribe: async () => ({ text: 'check out https://youtu.be/pcR30j-sKxU' }) });
  assert.equal(r.route, 'youtube');
});

test('an AMBIGUOUS voice intent is resolved through the A/B/C decision seam (no guess)', async () => {
  const r = await voiceIntake({ voice_ref: 'V3' }, {
    transcribe: async () => ({ text: 'milk eggs bread and also remind me about the dentist', ambiguous: true,
      interpretations: [{ key: 'A', label: 'Shopping list' }, { key: 'B', label: 'A note' }, { key: 'C', label: 'A reminder' }] }),
  });
  assert.equal(r.route, 'needs_decision');
  assert.match(r.card.rendered, /\*A\* — Shopping list/);
  assert.match(r.card.rendered, /\*C\* — A reminder/);
  assert.equal(r.card.intent.related_ref, 'voice:V3');
  assert.equal(r.card.intent.options.length, 3);
});

test('fails closed without a transcriber and without a voice_ref', async () => {
  await assert.rejects(() => voiceIntake({ voice_ref: 'x' }, {}), /fail closed/);
  await assert.rejects(() => voiceIntake({}, { transcribe: async () => ({ text: 'x' }) }), /voice_ref/);
});
