// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/visionAgenticTurn.test.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC1/AC6: proof for the new
// /v1/responses export added to services/obsidiwikai/src/core/models.mjs
// (a file granted to Keel by THIS Work Order's file_surface, not this test
// file specifically). Lives here, inside agenticVisionPrototype/, for the
// SAME reason services/asdair/pipeline/test/modelsUsageCapture.test.js
// already recorded for an earlier models.mjs addition: the granted surface
// names the SOURCE file exactly, and this WP's own broadly-granted directory
// (agenticVisionPrototype/**) is where its own tests belong.
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

const { visionAgenticTurn } = await import('../../../obsidiwikai/src/core/models.mjs');

/** Install a fetch mock for one test: captures every request body, returns a scripted /v1/responses-shaped body. */
function mockFetch(responseBody) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, json: async () => responseBody };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ---------------------------------------------------------------------
// A FRESH vision call - first turn, image(s) + text, no previous_response_id.
// ---------------------------------------------------------------------

test('visionAgenticTurn: a fresh call sends input as image+text content parts, no previous_response_id, and hits /responses', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_fresh_1',
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
    usage: { input_tokens: 500, output_tokens: 20, total_tokens: 520 },
  });
  try {
    const result = await visionAgenticTurn({
      prompt: 'read this list',
      imageUrls: ['data:image/jpeg;base64,PAGE', 'data:image/jpeg;base64,STRIP2'],
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/responses$/);
    assert.equal(calls[0].body.previous_response_id, undefined);
    assert.equal(calls[0].body.input[0].content[0].type, 'input_text');
    assert.equal(calls[0].body.input[0].content[0].text, 'read this list');
    assert.deepEqual(
      calls[0].body.input[0].content.slice(1).map((p) => p.type),
      ['input_image', 'input_image'],
    );
    assert.equal(calls[0].body.input[0].content[1].image_url, 'data:image/jpeg;base64,PAGE');
    assert.equal(result.responseId, 'resp_fresh_1');
    assert.equal(result.outputText, '{"lines":[]}');
    assert.deepEqual(result.toolCalls, []);
    assert.deepEqual(result.usage, { input_tokens: 500, output_tokens: 20, total_tokens: 520 });
  } finally {
    restore();
  }
});

test('visionAgenticTurn: text-only (no images) sends a bare string `input`, matching the committed probe evidence shape', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_text_1',
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }],
    usage: null,
  });
  try {
    await visionAgenticTurn({ prompt: 'Remember codeword OTTER-3. Reply OK only.' });
    assert.equal(calls[0].body.input, 'Remember codeword OTTER-3. Reply OK only.');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// A TOOL-CALL response - the load-bearing shape, cited to the real probe
// (toolcall2-results.json: responses_api.output has a reasoning item then a
// function_call item, name:"request_crop", arguments:{"region":"3"}).
// ---------------------------------------------------------------------

test('visionAgenticTurn: a tool-call response parses name/arguments/callId, alongside a reasoning item it ignores', async () => {
  const { restore } = mockFetch({
    id: 'resp_tool_1',
    output: [
      { id: 'rs_1', type: 'reasoning', summary: [], content: [] },
      {
        type: 'function_call', name: 'request_crop', arguments: '{"region":"3"}', call_id: 'call_abc123', id: 'fc_1', status: 'completed',
      },
    ],
    usage: { input_tokens: 4000, output_tokens: 30, total_tokens: 4030 },
  });
  try {
    const result = await visionAgenticTurn({
      prompt: 'inspect this', imageUrls: ['data:image/jpeg;base64,PAGE'], tools: [{ type: 'function', name: 'request_crop' }],
    });
    assert.equal(result.outputText, null, 'a tool-call-only turn has no message-type output item');
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'request_crop');
    assert.deepEqual(result.toolCalls[0].arguments, { region: '3' });
    assert.equal(result.toolCalls[0].callId, 'call_abc123');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// A FINAL-ANSWER (continuation) turn - previous_response_id set, genuine
// server-side continuation, no resent history.
// ---------------------------------------------------------------------

test('visionAgenticTurn: a continuation turn sends previous_response_id and only the NEW content, never resending prior history', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_final_1',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[{"line_no":1,"raw_reading":"Weetabix","quantity":null,"source_region":3}]}' }] }],
    usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240 },
  });
  try {
    const result = await visionAgenticTurn({
      prompt: 'Here is the crop of region 3 you requested.',
      imageUrls: ['data:image/jpeg;base64,CROP3'],
      previousResponseId: 'resp_tool_1',
    });
    assert.equal(calls[0].body.previous_response_id, 'resp_tool_1');
    assert.equal(calls[0].body.input[0].content.length, 2, 'only the new prompt + the one new crop - never the original page/strips resent');
    assert.equal(result.outputText, '{"lines":[{"line_no":1,"raw_reading":"Weetabix","quantity":null,"source_region":3}]}');
    assert.deepEqual(result.toolCalls, []);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// Validation and error paths, matching vision()'s own established discipline.
// ---------------------------------------------------------------------

test('visionAgenticTurn: with no gateway configured, throws rather than falling back', async () => {
  const savedUrl = process.env.FUSION_GATEWAY_URL;
  delete process.env.FUSION_GATEWAY_URL;
  try {
    const { visionAgenticTurn: visionAgenticTurnNoGateway } = await import('../../../obsidiwikai/src/core/models.mjs?no-gateway-agentic-check');
    await assert.rejects(
      visionAgenticTurnNoGateway({ prompt: 'x' }),
      /no gateway configured/,
    );
  } finally {
    process.env.FUSION_GATEWAY_URL = savedUrl;
  }
});

test('visionAgenticTurn: an empty prompt is refused', async () => {
  await assert.rejects(visionAgenticTurn({ prompt: '' }), /prompt is required/);
});

test('visionAgenticTurn: a non-empty-string image entry is refused, same discipline as vision()', async () => {
  await assert.rejects(
    visionAgenticTurn({ prompt: 'x', imageUrls: [''] }),
    /every image reference must be a non-empty/,
  );
});

test('visionAgenticTurn: a non-ok gateway response throws with the status and body, matching gatewayChat()', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  try {
    await assert.rejects(visionAgenticTurn({ prompt: 'x' }), /fusion-gateway responses -> 400/);
  } finally {
    globalThis.fetch = original;
  }
});

test('visionAgenticTurn: usage absent from the response returns null, never a fabricated zero, matching vision()\'s discipline', async () => {
  const { restore } = mockFetch({ id: 'resp_no_usage', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] });
  try {
    const result = await visionAgenticTurn({ prompt: 'x' });
    assert.equal(result.usage, null);
  } finally {
    restore();
  }
});
