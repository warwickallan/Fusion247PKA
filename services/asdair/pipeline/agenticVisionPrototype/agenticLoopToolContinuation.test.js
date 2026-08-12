// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/agenticLoopToolContinuation.test.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-02, AC3 (= acceptance_property) and AC4:
// proves the fix END TO END - runAgenticVisionLoop() driven by the REAL
// models.mjs visionAgenticTurn (not the injected mock agenticLoop.test.js
// uses elsewhere), with ONLY `fetch` mocked. agenticLoop.test.js's own tests
// prove the loop's turn-chaining logic against a scripted callModel; they do
// NOT exercise the actual request body models.mjs sends - which is exactly
// where Asdair's first live run crashed ("No tool output found for function
// call ..."). This file is what would have caught that before the live run.
//
// AC3's own wording: "given a mocked response shaped exactly like the real
// captured turn-1 output (two simultaneous request_crop function_call
// items, per Deliverables/2026-08-12-capability-probe-evidence/ and
// Asdair's live capture), the loop's next request includes a
// function_call_output item for EACH call_id, and the loop successfully
// continues past turn 2 to a final answer in the mocked test - not just
// past turn 1."
//
// THE TURN-1 SHAPE BELOW is the field shape CONFIRMED BY REAL EXECUTION in
// Deliverables/2026-08-12-capability-probe-evidence/toolcall2-results.json
// (`responses_api.output`: a `reasoning` item, then a `function_call` item
// with `arguments`/`call_id`/`name`/`type`/`id`/`status`) - applied TWICE,
// with two distinct call_ids and regions (2 and 3), matching what Asdair's
// live-run report (relayed into WO-02's own `outcome` text) describes: Terra
// called request_crop twice simultaneously on turn 1. This is the real
// captured single-call shape doubled, not an invented multi-call shape.
//
// Every network call is MOCKED (`network: none`) - no real fetch, no
// gateway, no credentials, ever.
//
// Runs under: node --test (no DB, no model, no network, no sharp).
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FUSION_GATEWAY_URL = 'http://fusion-gateway.test/v1';
process.env.FUSION_GATEWAY_KEY = 'test-key-not-a-real-secret';

const { runAgenticVisionLoop } = await import('./agenticLoop.js');
const { REQUEST_CROP_TOOL } = await import('./tools.js');

const FULL_PAGE = 'data:image/jpeg;base64,PAGE';
const REGIONS = { 2: 'data:image/jpeg;base64,STRIP2', 3: 'data:image/jpeg;base64,STRIP3' };

/** Scripts a sequence of /v1/responses-shaped bodies to a mocked global fetch, in call order. Captures every request body. */
function scriptedFetch(responseBodies) {
  const calls = [];
  let i = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    const responseBody = responseBodies[Math.min(i, responseBodies.length - 1)];
    i += 1;
    return { ok: true, json: async () => responseBody };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ---------------------------------------------------------------------
// AC3 (acceptance_property) - the two-simultaneous-call turn.
// ---------------------------------------------------------------------

test('AC3: a turn-1 response with TWO simultaneous request_crop calls (the real captured shape, doubled) - turn 2 sends a function_call_output for EACH call_id, and the loop reaches a final answer', async () => {
  const { calls, restore } = scriptedFetch([
    {
      // Turn 1 - shaped exactly like toolcall2-results.json's
      // responses_api.output, doubled to two simultaneous calls.
      id: 'resp_turn1_multicall',
      output: [
        {
          id: 'rs_1', summary: [], type: 'reasoning', content: [],
        },
        {
          arguments: '{"region":"2"}', call_id: 'call_region2', name: 'request_crop', type: 'function_call', id: 'fc_region2', status: 'completed',
        },
        {
          arguments: '{"region":"3"}', call_id: 'call_region3', name: 'request_crop', type: 'function_call', id: 'fc_region3', status: 'completed',
        },
      ],
      usage: { input_tokens: 4200, output_tokens: 60, total_tokens: 4260 },
    },
    {
      // Turn 2 - the continuation, now a genuine final answer (this is the
      // turn that used to 400 before AC1/AC2's fix).
      id: 'resp_turn2_final',
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"lines":[{"line_no":1,"raw_reading":"Weetabix","quantity":null,"source_region":2},{"line_no":2,"raw_reading":"Marmite","quantity":1,"source_region":3}]}' }],
      }],
      usage: { input_tokens: 300, output_tokens: 50, total_tokens: 350 },
    },
  ]);
  try {
    const result = await runAgenticVisionLoop({
      prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL,
    });

    // The loop must have actually made a SECOND request (past turn 1) -
    // this is the "successfully continues... not just past turn 1" bar.
    assert.equal(calls.length, 2, 'the loop must reach turn 2, not crash on it');

    const turn2Input = calls[1].body.input;
    assert.ok(Array.isArray(turn2Input), 'a pending tool call forces the array input form');
    const functionCallOutputs = turn2Input.filter((item) => item.type === 'function_call_output');
    assert.equal(functionCallOutputs.length, 2, 'ONE function_call_output per pending call_id - neither dropped');
    assert.deepEqual(
      functionCallOutputs.map((o) => o.call_id).sort(),
      ['call_region2', 'call_region3'],
      'both call_ids answered, matching exactly the two calls Terra actually made',
    );
    assert.equal(calls[1].body.previous_response_id, 'resp_turn1_multicall');

    // Both requested crops must be supplied, not just the first (AC2's own
    // defect: the loop used to read only toolCalls[0]).
    const userMessageItem = turn2Input.find((item) => item.role === 'user');
    const imageUrlsSent = userMessageItem.content.filter((c) => c.type === 'input_image').map((c) => c.image_url);
    assert.deepEqual(imageUrlsSent.sort(), [REGIONS[2], REGIONS[3]].sort(), 'both requested crops sent, region 3 not silently dropped');

    // And the whole point: a real final answer, not a crash.
    assert.deepEqual(result.lines, [
      {
        line_no: 1, raw_reading: 'Weetabix', quantity: null, source_region: 2,
      },
      {
        line_no: 2, raw_reading: 'Marmite', quantity: 1, source_region: 3,
      },
    ]);
    assert.equal(result.toolCallRounds, 1);
    assert.equal(result.hitIterationCap, false);
    assert.deepEqual(result.turns[0].requestedRegions, [2, 3]);
    assert.equal(result.turns[0].requestedRegion, 2, 'back-compat: first requested region');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// AC4 - re-run the SIMPLER single-call case through the same real,
// end-to-end path, to confirm the multi-call fix does not regress it.
// ---------------------------------------------------------------------

test('AC4: a turn-1 response with ONE request_crop call still works exactly as round 1 proved - one function_call_output, one crop, a real final answer', async () => {
  const { calls, restore } = scriptedFetch([
    {
      id: 'resp_turn1_singlecall',
      output: [
        {
          id: 'rs_1', summary: [], type: 'reasoning', content: [],
        },
        {
          arguments: '{"region":"3"}', call_id: 'call_region3_only', name: 'request_crop', type: 'function_call', id: 'fc_region3', status: 'completed',
        },
      ],
      usage: { input_tokens: 4000, output_tokens: 30, total_tokens: 4030 },
    },
    {
      id: 'resp_turn2_final_single',
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"lines":[{"line_no":1,"raw_reading":"Marmite","quantity":1,"source_region":3}]}' }],
      }],
      usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240 },
    },
  ]);
  try {
    const result = await runAgenticVisionLoop({
      prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL,
    });

    assert.equal(calls.length, 2, 'no regression - still reaches turn 2');
    const turn2Input = calls[1].body.input;
    const functionCallOutputs = turn2Input.filter((item) => item.type === 'function_call_output');
    assert.equal(functionCallOutputs.length, 1, 'exactly one function_call_output for the one pending call');
    assert.equal(functionCallOutputs[0].call_id, 'call_region3_only');

    const userMessageItem = turn2Input.find((item) => item.role === 'user');
    const imageUrlsSent = userMessageItem.content.filter((c) => c.type === 'input_image').map((c) => c.image_url);
    assert.deepEqual(imageUrlsSent, [REGIONS[3]], 'only the one requested crop - no resent history, no phantom second crop');

    assert.deepEqual(result.lines, [{
      line_no: 1, raw_reading: 'Marmite', quantity: 1, source_region: 3,
    }]);
    assert.equal(result.toolCallRounds, 1);
    assert.equal(result.hitIterationCap, false);
    assert.deepEqual(result.turns[0].requestedRegions, [3]);
    assert.equal(result.turns[0].requestedRegion, 3);
  } finally {
    restore();
  }
});
