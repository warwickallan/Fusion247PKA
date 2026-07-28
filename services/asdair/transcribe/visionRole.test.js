// =====================================================================
// BUILD-015 - the `vision` role added to the shared model gateway.
//
// FULLY OFFLINE: global fetch is stubbed, so no request ever leaves the
// process. models.mjs reads FUSION_GATEWAY_URL once at module load, so
// each scenario imports a FRESH module instance via a cache-busting query.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const MODELS = pathToFileURL(join(import.meta.dirname, '../../obsidiwikai/src/core/models.mjs')).href;

let bust = 0;
async function loadModels(env) {
  const keys = ['FUSION_GATEWAY_URL', 'FUSION_GATEWAY_KEY', 'FUSION_MODEL_VISION'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return await import(MODELS + '?bust=' + (++bust));
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

// ---------------------------------------------------------------------
// The safety property: no capable gateway -> loud failure, never a
// silent fall back to a blind text model.
// ---------------------------------------------------------------------
test('vision() with NO gateway configured fails clearly and calls nothing', async () => {
  const m = await loadModels({});
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error('should never be called'); };
  try {
    assert.equal(m.visionConfigured, false);
    await assert.rejects(
      () => m.vision('read this list', 'data:image/png;base64,AA'),
      /no vision-capable gateway configured \(set FUSION_GATEWAY_URL\).*Refusing to fall back to a text-only model/s
    );
    assert.equal(fetched, 0, 'no request was attempted');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('vision() refuses a missing or non-string image reference', async () => {
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://127.0.0.1:1/v1' });
  for (const bad of [undefined, null, '', 42, {}]) {
    await assert.rejects(() => m.vision('p', bad), /an image reference .* is required/);
  }
});

// ---------------------------------------------------------------------
// The wire shape, with a stubbed fetch.
// ---------------------------------------------------------------------
function stubFetch(captured) {
  return async (url, opts) => {
    captured.url = url;
    captured.opts = opts;
    captured.body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"lines":[]}' } }] }) };
  };
}

test('vision() sends OpenAI-style multimodal content parts under the vision alias', async () => {
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://127.0.0.1:1/v1/', FUSION_GATEWAY_KEY: 'k' });
  const realFetch = globalThis.fetch;
  const cap = {};
  globalThis.fetch = stubFetch(cap);
  try {
    const out = await m.vision('read this list', 'data:image/png;base64,AA');
    assert.equal(out, '{"lines":[]}');
    assert.equal(cap.url, 'http://127.0.0.1:1/v1/chat/completions');
    assert.equal(cap.body.model, 'fusion.vision');
    assert.deepEqual(cap.body.messages[0].content, [
      { type: 'text', text: 'read this list' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('FUSION_MODEL_VISION overrides the alias; default is fusion.vision', async () => {
  const a = await loadModels({});
  assert.equal(a.ROLE_ALIAS.vision, 'fusion.vision');
  const b = await loadModels({ FUSION_MODEL_VISION: 'house.qwen-vl' });
  assert.equal(b.ROLE_ALIAS.vision, 'house.qwen-vl');
});

// ---------------------------------------------------------------------
// Regression: the existing roles are untouched.
// ---------------------------------------------------------------------
test('reason() still sends a PLAIN STRING content (text roles unchanged)', async () => {
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://127.0.0.1:1/v1' });
  const realFetch = globalThis.fetch;
  const cap = {};
  globalThis.fetch = stubFetch(cap);
  try {
    await m.reason('hello');
    assert.equal(cap.body.messages[0].content, 'hello', 'not an array - byte-identical to before');
    assert.equal(cap.body.model, 'fusion.reason');
    assert.equal(cap.body.stream, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the existing role aliases and gatewayConfigured are unchanged', async () => {
  const m = await loadModels({});
  assert.equal(m.gatewayConfigured, false);
  assert.deepEqual(m.ROLE_ALIAS, {
    extract: 'fusion.extract',
    keyword: 'fusion.keyword',
    query: 'fusion.query',
    reason: 'fusion.reason',
    embed: 'fusion.embed',
    vision: 'fusion.vision',
  });
});
