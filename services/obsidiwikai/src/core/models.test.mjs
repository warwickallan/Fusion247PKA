// BUILD-015 AsdAIr / WO-2026-08-11-B15-VISION-01, AC2 proof.
//
// models.mjs's `GATEWAY` constant is resolved from FUSION_GATEWAY_URL at
// MODULE LOAD TIME (a top-level `const`), so this file sets the env var
// BEFORE importing it, via a top-level dynamic import rather than a static
// one (which the ESM loader would hoist ahead of any env-var write here).
//
// Every network call is MOCKED (`network: none` in this Work Order's
// authority block) — no real fetch, no gateway, no credentials, ever.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FUSION_GATEWAY_URL = 'http://fusion-gateway.test/v1';
process.env.FUSION_GATEWAY_KEY = 'test-key-not-a-real-secret';

const { vision } = await import('./models.mjs');

/** Install a fetch mock for one test, returning the captured request bodies and a restore function. */
function mockFetch(responseText) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: responseText ?? '{"lines":[]}' } }] }),
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('vision(prompt, singleUrlString): unchanged, single image_url content part (regression)', async () => {
  const { calls, restore } = mockFetch();
  try {
    await vision('read this list', 'data:image/jpeg;base64,AAAA');
    assert.equal(calls.length, 1);
    const content = calls[0].body.messages[0].content;
    assert.equal(content.length, 2, 'one text part + one image_url part');
  } finally {
    restore();
  }
});

test('vision(prompt, singleUrlString): content shape is [text, image_url] in that order', async () => {
  const { calls, restore } = mockFetch();
  try {
    await vision('read this list', 'data:image/jpeg;base64,AAAA');
    const content = calls[0].body.messages[0].content;
    assert.equal(content[0].type, 'text');
    assert.equal(content[0].text, 'read this list');
    assert.equal(content[1].type, 'image_url');
    assert.equal(content[1].image_url.url, 'data:image/jpeg;base64,AAAA');
  } finally {
    restore();
  }
});

test('vision(prompt, [url1, url2, url3]): sends every image as a separate part, IN ORDER, in ONE request', async () => {
  const { calls, restore } = mockFetch();
  try {
    await vision('read this list', [
      'data:image/jpeg;base64,PAGE',
      'data:image/jpeg;base64,STRIP1',
      'data:image/jpeg;base64,STRIP2',
    ]);
    assert.equal(calls.length, 1, 'the whole multi-image request must be ONE HTTP call, not one per image');
    const content = calls[0].body.messages[0].content;
    assert.equal(content.length, 4, 'one text part + three image_url parts');
    assert.equal(content[0].type, 'text');
    assert.equal(content[1].image_url.url, 'data:image/jpeg;base64,PAGE');
    assert.equal(content[2].image_url.url, 'data:image/jpeg;base64,STRIP1');
    assert.equal(content[3].image_url.url, 'data:image/jpeg;base64,STRIP2');
  } finally {
    restore();
  }
});

test('vision(prompt, []): refuses an empty image array rather than silently sending text-only', async () => {
  await assert.rejects(vision('read this list', []), /at least one image reference/);
});

test('vision(prompt, [validUrl, \'\']): refuses when any array entry is an empty string', async () => {
  await assert.rejects(
    vision('read this list', ['data:image/jpeg;base64,AAAA', '']),
    /every image reference must be a non-empty/,
  );
});

test('vision(prompt, [123]): refuses a non-string entry rather than sending it to the gateway', async () => {
  await assert.rejects(vision('read this list', [123]), /every image reference must be a non-empty/);
});

test('vision(prompt, undefined): still refuses exactly as the single-image form always did', async () => {
  // undefined is neither an array nor a non-empty string, so it is wrapped to
  // [undefined] and caught by the per-entry check - a refusal either way,
  // exactly as the pre-WP single-URL form always refused a non-string.
  await assert.rejects(vision('read this list', undefined), /every image reference must be a non-empty/);
});

test('vision: with no gateway configured, still throws rather than falling back to a blind text model', async () => {
  const savedUrl = process.env.FUSION_GATEWAY_URL;
  delete process.env.FUSION_GATEWAY_URL;
  try {
    // Cache-bust: a distinct module specifier forces a fresh evaluation, so
    // this instance resolves GATEWAY with FUSION_GATEWAY_URL genuinely unset,
    // independent of the module already cached (and gateway-configured) above.
    const { vision: visionNoGateway } = await import('./models.mjs?no-gateway-check');
    await assert.rejects(visionNoGateway('read this list', 'data:image/jpeg;base64,AAAA'), /no vision-capable gateway configured/);
  } finally {
    process.env.FUSION_GATEWAY_URL = savedUrl;
  }
});
