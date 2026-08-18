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

// ---------------------------------------------------------------------
// THE VISION ALIAS - PINNED TO A LITERAL HELD HERE, OUTSIDE THE SOURCE
// UNDER TEST. (WO-2026-08-18-01)
//
// These assertions used to read `assert.equal(..., 'fusion.vision')`. Commit
// 67736bb changed the default deliberately, because `fusion.vision` is A DEAD
// ALIAS THE GATEWAY DOES NOT REGISTER, and this suite was not moved with it -
// so it has been RED on `main` ever since, which is worse than no test at all.
//
// Re-pinning to whatever `models.mjs` says today would assert a source against
// itself and would re-create the exact defect 67736bb closed: a defaults test
// that cannot see a wrong default. So the invariant is stated in terms of a
// literal owned by THIS file:
//
//   * the vision role must NEVER resolve to `fusion.vision` - the value proven
//     dead on a live run;
//   * it must be a non-empty string, because an empty model id fails at the
//     gateway rather than here;
//   * it must remain overridable by FUSION_MODEL_VISION, read at call time.
//
// ⚠️ WHAT THIS DOES NOT ESTABLISH: that the value in force IS registered on the
// live gateway. Establishing that needs a network call, and this Work Order
// runs under `network: none`. UNVERIFIED, deliberately, and said out loud
// rather than implied by a green.
const DEAD_VISION_ALIAS = 'fusion.vision';

test('vision() sends OpenAI-style multimodal content parts under the vision alias', async () => {
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://127.0.0.1:1/v1/', FUSION_GATEWAY_KEY: 'k' });
  const realFetch = globalThis.fetch;
  const cap = {};
  globalThis.fetch = stubFetch(cap);
  try {
    const out = await m.vision('read this list', 'data:image/png;base64,AA');
    assert.equal(out, '{"lines":[]}');
    assert.equal(cap.url, 'http://127.0.0.1:1/v1/chat/completions');
    // The request must go out under the role's OWN resolved alias - never a
    // literal this file happens to remember, and never the dead one.
    assert.equal(cap.body.model, m.ROLE_ALIAS.vision);
    assert.notEqual(cap.body.model, DEAD_VISION_ALIAS,
      'the vision request went out under an alias the gateway does not register - this failed LIVE');
    assert.deepEqual(cap.body.messages[0].content, [
      { type: 'text', text: 'read this list' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the vision default is NOT the dead alias, and FUSION_MODEL_VISION still overrides it', async () => {
  const a = await loadModels({});
  assert.notEqual(a.ROLE_ALIAS.vision, DEAD_VISION_ALIAS,
    'the vision role defaulted back to an alias the gateway does not register');
  assert.equal(typeof a.ROLE_ALIAS.vision, 'string');
  assert.ok(a.ROLE_ALIAS.vision.trim().length > 0, 'an empty model id fails at the gateway, not here');

  const b = await loadModels({ FUSION_MODEL_VISION: 'house.qwen-vl' });
  assert.equal(b.ROLE_ALIAS.vision, 'house.qwen-vl',
    'the override is what makes a bad default recoverable without a code change');
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
  // The FIVE TEXT ROLES are pinned exactly - they are unchanged and any drift
  // in them is a regression. `vision` is deliberately excluded and checked by
  // its own invariant above: it is the one alias that has legitimately moved,
  // and pinning it here is what made this suite red rather than useful.
  const { vision, ...textRoles } = m.ROLE_ALIAS;
  assert.deepEqual(textRoles, {
    extract: 'fusion.extract',
    keyword: 'fusion.keyword',
    query: 'fusion.query',
    reason: 'fusion.reason',
    embed: 'fusion.embed',
  });
  assert.notEqual(vision, DEAD_VISION_ALIAS);
  assert.equal(Object.keys(m.ROLE_ALIAS).length, 6,
    'a role was added or removed - the alias contract changed and this pin must be revisited');
});
