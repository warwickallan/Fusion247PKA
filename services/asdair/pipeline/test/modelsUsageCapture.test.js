// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/modelsUsageCapture.test.js
//
// WO-2026-08-12-B15-VISION-02, AC7 proof for the usage-capture additions to
// services/obsidiwikai/src/core/models.mjs (a file granted to Keel by the
// original file_surface, not this file specifically). This test lives here,
// inside pipeline/test/, rather than as an addition to
// services/obsidiwikai/src/core/models.test.mjs - the SAME reasoning
// groundedPromptRegionContract.test.js already recorded for groundedPrompt.js
// in this same directory: the granted surface names the SOURCE file
// (services/obsidiwikai/src/core/models.mjs) exactly, not a new or extended
// sibling test file under services/obsidiwikai/src/core/. Reaching across
// the package boundary from an already-broadly-granted location
// (services/asdair/pipeline/**) avoids any file_surface ambiguity.
//
// models.mjs is ESM (`export`/`import`), so this reaches it with a plain
// relative import - no createRequire needed, unlike groundedPrompt.js (CJS).
//
// Every network call is MOCKED (`network: none` in this Work Order's
// authority block) - no real fetch, no gateway, no credentials, ever.
//
// Runs under: node --test (no DB, no model, no network, no sharp).
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FUSION_GATEWAY_URL = 'http://fusion-gateway.test/v1';
process.env.FUSION_GATEWAY_KEY = 'test-key-not-a-real-secret';

const {
  vision, visionWithUsage, estimateUsdCost, TERRA_PRICING_USD_PER_MILLION_TOKENS,
} = await import('../../../obsidiwikai/src/core/models.mjs');

/** Install a fetch mock for one test, returning the captured request bodies and a restore function. */
function mockFetch({ content, usage }) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: content ?? '{"lines":[]}' } }],
        ...(usage !== undefined ? { usage } : {}),
      }),
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ---------------------------------------------------------------------
// visionWithUsage - the new additive export
// ---------------------------------------------------------------------

test('visionWithUsage: returns BOTH the content AND the gateway-reported usage', async () => {
  const { restore } = mockFetch({
    content: '{"lines":[]}',
    usage: { prompt_tokens: 1500, completion_tokens: 40, total_tokens: 1540 },
  });
  try {
    const result = await visionWithUsage('read this list', 'data:image/jpeg;base64,AAAA');
    assert.equal(result.content, '{"lines":[]}');
    assert.deepEqual(result.usage, { prompt_tokens: 1500, completion_tokens: 40, total_tokens: 1540 });
  } finally {
    restore();
  }
});

test('visionWithUsage: a gateway response with NO usage field returns usage: null - an honest "not reported", never a fabricated zero', async () => {
  const { restore } = mockFetch({ content: '{"lines":[]}' }); // usage deliberately omitted
  try {
    const result = await visionWithUsage('read this list', 'data:image/jpeg;base64,AAAA');
    assert.equal(result.usage, null);
  } finally {
    restore();
  }
});

test('visionWithUsage: shares the SAME validation as vision() - refuses an empty image array', async () => {
  await assert.rejects(visionWithUsage('read this list', []), /at least one image reference/);
});

test('visionWithUsage: with no gateway configured, still throws rather than falling back', async () => {
  const savedUrl = process.env.FUSION_GATEWAY_URL;
  delete process.env.FUSION_GATEWAY_URL;
  try {
    const { visionWithUsage: visionWithUsageNoGateway } = await import('../../../obsidiwikai/src/core/models.mjs?no-gateway-usage-check');
    await assert.rejects(
      visionWithUsageNoGateway('read this list', 'data:image/jpeg;base64,AAAA'),
      /no vision-capable gateway configured/,
    );
  } finally {
    process.env.FUSION_GATEWAY_URL = savedUrl;
  }
});

// ---------------------------------------------------------------------
// vision() itself - REGRESSION: still returns a bare string, unaffected by
// the internal gatewayChat reshape to {content, usage}.
// ---------------------------------------------------------------------

test('REGRESSION: vision() still returns a bare string, not {content, usage} - every existing caller is unaffected', async () => {
  const { restore } = mockFetch({
    content: '{"lines":[{"line_no":1}]}',
    usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
  });
  try {
    const result = await vision('read this list', 'data:image/jpeg;base64,AAAA');
    assert.equal(typeof result, 'string');
    assert.equal(result, '{"lines":[{"line_no":1}]}');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// estimateUsdCost - AC7's authored pricing arithmetic, PURE, no network
// ---------------------------------------------------------------------

test('estimateUsdCost: uses the AUTHORED Terra pricing constant, cited to Pax\'s research', () => {
  assert.equal(TERRA_PRICING_USD_PER_MILLION_TOKENS.input, 2.00, 'Pax\'s research, Vellum post-30-July-2026 cut, GPT-5.6 Terra input rate');
  assert.equal(TERRA_PRICING_USD_PER_MILLION_TOKENS.output, 12.00, 'Pax\'s research, Vellum post-30-July-2026 cut, GPT-5.6 Terra output rate');
});

test('estimateUsdCost: a real-shaped clean-shop usage record costs a small, correctly-computed amount', () => {
  // A normal whole-page-plus-strips first pass: ~8000 prompt tokens (the
  // household catalogue + region strips), ~600 completion tokens (the
  // structured JSON line list) - representative of this build's own
  // grounded-prompt shape, not an arbitrary round number.
  const usage = { prompt_tokens: 8000, completion_tokens: 600, total_tokens: 8600 };
  const cost = estimateUsdCost(usage);
  const expected = (8000 / 1_000_000) * 2.00 + (600 / 1_000_000) * 12.00;
  assert.ok(Math.abs(cost - expected) < 1e-9, `expected ${expected}, got ${cost}`);
  assert.ok(cost > 0 && cost < 0.05, 'a single clean-shop vision call costs a few cents at most, not pounds');
});

test('estimateUsdCost: null usage (gateway never reported it) returns null, never a fabricated zero', () => {
  assert.equal(estimateUsdCost(null), null);
  assert.equal(estimateUsdCost(undefined), null);
});

test('estimateUsdCost: a missing individual token count is treated as zero for THAT count only, not the whole record discarded', () => {
  const cost = estimateUsdCost({ prompt_tokens: 1000, completion_tokens: null });
  assert.equal(cost, (1000 / 1_000_000) * 2.00);
});
