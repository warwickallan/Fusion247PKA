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
// WO-2026-08-12-B15-VISION-PROTOTYPE-02, AC1 - `function_call_output`
// construction: the exact defect that crashed Asdair's first live run
// (turn 2, all 3 runs, "No tool output found for function call ...").
// ---------------------------------------------------------------------

test('visionAgenticTurn: a continuation with ONE pending tool call sends ONE function_call_output item, ahead of the new user message', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_final_1',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
    usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240 },
  });
  try {
    await visionAgenticTurn({
      prompt: 'Here is the crop of region 3 you requested.',
      imageUrls: ['data:image/jpeg;base64,CROP3'],
      previousResponseId: 'resp_tool_1',
      toolOutputs: [{ callId: 'call_region3', output: 'Crop rendered and attached to the next message.' }],
    });
    const { input } = calls[0].body;
    assert.ok(Array.isArray(input), 'a pending tool call forces the array input form, never the bare-string form');
    assert.equal(input.length, 2, 'one function_call_output item, then the new user message item');
    assert.deepEqual(input[0], {
      type: 'function_call_output', call_id: 'call_region3', output: 'Crop rendered and attached to the next message.',
    });
    assert.equal(input[1].role, 'user');
    assert.equal(input[1].content[0].type, 'input_text');
    assert.equal(input[1].content[1].type, 'input_image');
  } finally {
    restore();
  }
});

test('visionAgenticTurn: a continuation with TWO pending tool calls sends a function_call_output for EACH call_id - the exact multi-call shape Asdair\'s live run needed', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_final_2',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
    usage: { input_tokens: 300, output_tokens: 50, total_tokens: 350 },
  });
  try {
    await visionAgenticTurn({
      prompt: 'Here are the crops of regions 2, 3 you requested.',
      imageUrls: ['data:image/jpeg;base64,CROP2', 'data:image/jpeg;base64,CROP3'],
      previousResponseId: 'resp_tool_1',
      toolOutputs: [
        { callId: 'call_region2', output: 'Crop rendered and attached to the next message.' },
        { callId: 'call_region3', output: 'Crop rendered and attached to the next message.' },
      ],
    });
    const { input } = calls[0].body;
    assert.equal(input.length, 3, 'two function_call_output items, then the one new user message item');
    assert.deepEqual(
      input.slice(0, 2).map((i) => i.type),
      ['function_call_output', 'function_call_output'],
    );
    assert.deepEqual(
      input.slice(0, 2).map((i) => i.call_id),
      ['call_region2', 'call_region3'],
      'one output per call_id, in the order supplied - neither dropped',
    );
    assert.equal(input[2].role, 'user');
  } finally {
    restore();
  }
});

test('visionAgenticTurn: no pending tool calls (toolOutputs omitted) keeps the EXISTING behaviour - no regression to the round-1 continuation shape', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_final_3',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
    usage: null,
  });
  try {
    await visionAgenticTurn({
      prompt: 'Here is the crop of region 3 you requested.',
      imageUrls: ['data:image/jpeg;base64,CROP3'],
      previousResponseId: 'resp_tool_1',
    });
    assert.equal(calls[0].body.input.length, 1, 'no function_call_output items when toolOutputs is empty/omitted');
    assert.equal(calls[0].body.input[0].role, 'user');
  } finally {
    restore();
  }
});

test('visionAgenticTurn: toolOutputs must be an array, refused otherwise', async () => {
  await assert.rejects(
    visionAgenticTurn({ prompt: 'x', toolOutputs: 'not-an-array' }),
    /toolOutputs must be an array/,
  );
});

test('visionAgenticTurn: every toolOutputs entry needs a non-empty callId, refused otherwise', async () => {
  await assert.rejects(
    visionAgenticTurn({ prompt: 'x', toolOutputs: [{ output: 'ok' }] }),
    /toolOutputs entry needs a non-empty callId/,
  );
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

// =====================================================================
// WO-2026-08-12-01-v2 (WP-B15-29), AC2 - the `textFormat` pass-through.
//
// These assert the WIRE, because the failure this parameter guards against is
// invisible at every other layer: `response_format` on /v1/responses returns
// HTTP 200 with the constraint simply not applied, so a caller that checked
// only the status code would ship an unconstrained pipeline that looks
// healthy. What is on the wire is therefore the only thing worth asserting.
// =====================================================================

test('AC2: textFormat is nested under `text.format` EXACTLY as supplied - never rewritten, never wrapped again', async () => {
  const fmt = {
    type: 'json_schema', name: 'asdair_photo_lines', strict: true, schema: { type: 'object', properties: {} },
  };
  const { calls, restore } = mockFetch({
    id: 'resp_fmt', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
  });
  try {
    await visionAgenticTurn({ prompt: 'read this', imageUrls: ['data:image/jpeg;base64,PAGE'], textFormat: fmt });
    assert.deepEqual(calls[0].body.text, { format: fmt });
    assert.equal(calls[0].body.text.format.strict, true, 'strict:true is the enforcing switch - omitting it returns 200 and enforces nothing');
    assert.equal(calls[0].body.response_format, undefined, 'response_format on /responses is the SILENT trap and must never be sent');
    assert.equal(calls[0].body.text.format.json_schema, undefined, 'a nested json_schema under text.format is a loud 400');
  } finally {
    restore();
  }
});

test('AC2: with NO textFormat the body is unchanged - every existing caller is unaffected', async () => {
  const { calls, restore } = mockFetch({
    id: 'resp_plain', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }],
  });
  try {
    await visionAgenticTurn({ prompt: 'read this' });
    assert.equal(calls[0].body.text, undefined, 'the pass-through must add nothing at all when it is not used');
    assert.equal(calls[0].body.input, 'read this', 'the bare-string input path is untouched');
  } finally {
    restore();
  }
});

test('AC2: the schema composes with images AND tools in ONE request - no turn-splitting is needed', async () => {
  const fmt = { type: 'json_schema', name: 'n', strict: true, schema: { type: 'object' } };
  const { calls, restore } = mockFetch({
    id: 'resp_all', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"lines":[]}' }] }],
  });
  try {
    await visionAgenticTurn({
      prompt: 'read this',
      imageUrls: ['data:image/jpeg;base64,PAGE'],
      tools: [{ type: 'function', name: 'request_crop', parameters: { type: 'object', properties: {} } }],
      previousResponseId: 'resp_prev',
      toolOutputs: [{ callId: 'call_1', output: 'ok' }],
      textFormat: fmt,
    });
    const body = calls[0].body;
    assert.equal(body.text.format.name, 'n');
    assert.equal(body.tools.length, 1);
    assert.equal(body.previous_response_id, 'resp_prev');
    assert.equal(body.input[0].type, 'function_call_output');
    assert.equal(body.input[1].content[1].type, 'input_image');
  } finally {
    restore();
  }
});
