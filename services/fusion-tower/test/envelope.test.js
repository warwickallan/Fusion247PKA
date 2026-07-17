import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalize, buildEnvelope, signEnvelope, verifyEnvelope,
  assertHonestLabel, makeSignedResult, HONEST_PROVIDER,
} from '../src/core/envelope.js';

const SECRET = 'a'.repeat(48);

test('canonicalize is deterministic under key reordering', () => {
  const a = canonicalize({ b: 1, a: 2, c: [3, { z: 1, y: 2 }] });
  const b = canonicalize({ c: [3, { y: 2, z: 1 }], a: 2, b: 1 });
  assert.equal(a, b);
});

test('honest label enforced — gpt_codex is openai-codex', () => {
  assert.doesNotThrow(() => assertHonestLabel('gpt_codex', 'openai-codex'));
  assert.equal(HONEST_PROVIDER.gpt_codex, 'openai-codex');
});

test('dishonest label rejected — gpt_codex must NEVER be xai-grok', () => {
  assert.throws(() => assertHonestLabel('gpt_codex', 'xai-grok'), /dishonest|honesty/i);
  assert.throws(() => buildEnvelope({ principal: 'gpt_codex', provider: 'grok', runId: 'r', ordinal: 1, payload: {} }), /dishonest|honesty/i);
});

test('sign + verify round-trips', () => {
  const env = buildEnvelope({ principal: 'larry', runId: 'r1', ordinal: 1, payload: { summary: 'ok' } });
  const { envelope, signature } = signEnvelope(env, SECRET);
  assert.equal(verifyEnvelope(envelope, signature, SECRET), true);
});

test('tampered payload fails verification', () => {
  const { envelope, signature } = makeSignedResult({ principal: 'larry', runId: 'r1', ordinal: 1, payload: { summary: 'ok' } }, SECRET);
  const tampered = { ...envelope, payload: { summary: 'TAMPERED' } };
  assert.equal(verifyEnvelope(tampered, signature, SECRET), false);
});

test('tampered provider label fails verification even if bytes matched', () => {
  const { envelope, signature } = makeSignedResult({ principal: 'gpt_codex', runId: 'r', ordinal: 1, payload: {} }, SECRET);
  const spoofed = { ...envelope, provider: 'xai-grok' };
  assert.equal(verifyEnvelope(spoofed, signature, SECRET), false);
});

test('wrong secret fails verification', () => {
  const { envelope, signature } = makeSignedResult({ principal: 'tower', runId: 'r', ordinal: 1, payload: {} }, SECRET);
  assert.equal(verifyEnvelope(envelope, signature, 'b'.repeat(48)), false);
});
