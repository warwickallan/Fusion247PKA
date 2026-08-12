// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/agenticLoop.test.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC3/AC6: proves the loop's
// turn-chaining and, most load-bearingly, that the hard iteration cap
// actually BOUNDS the loop rather than merely existing as an unused constant
// - a mocked model response that ALWAYS requests another crop must still
// terminate the loop at a known, small number of calls.
//
// Every collaborator (`callModel`) is INJECTED and fully mocked - no real
// fetch, no gateway, no credentials, ever (`network: none`).
//
// Runs under: node --test (no DB, no model, no network, no sharp).
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAgenticVisionLoop, normalizeResponsesUsage, DEFAULT_MAX_TOOL_CALL_ROUNDS,
} from './agenticLoop.js';
import { REQUEST_CROP_TOOL } from './tools.js';

const FULL_PAGE = 'data:image/jpeg;base64,PAGE';
const REGIONS = { 2: 'data:image/jpeg;base64,STRIP2', 3: 'data:image/jpeg;base64,STRIP3' };

/** A scripted callModel: returns each entry in `script` in order, records every call's args. */
function scriptedModel(script) {
  const calls = [];
  let i = 0;
  const fn = async (args) => {
    calls.push(args);
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    return typeof step === 'function' ? step(args) : step;
  };
  return { fn, calls };
}

// ---------------------------------------------------------------------
// AC6 case 1: a FRESH vision call that goes straight to a final answer -
// no tool call at all.
// ---------------------------------------------------------------------

test('runAgenticVisionLoop: no tool call on turn 1 - returns the final answer immediately, one turn, zero tool-call rounds', async () => {
  const { fn, calls } = scriptedModel([
    {
      responseId: 'r1',
      outputText: '{"lines":[{"line_no":1,"raw_reading":"Weetabix","quantity":null,"source_region":1}]}',
      toolCalls: [],
      usage: { input_tokens: 4000, output_tokens: 100, total_tokens: 4100 },
    },
  ]);
  const result = await runAgenticVisionLoop({
    prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL, callModel: fn,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].previousResponseId, null);
  assert.deepEqual(calls[0].imageUrls, [FULL_PAGE, REGIONS[2], REGIONS[3]], 'turn 1 sends the full page + EVERY region together');
  assert.equal(result.toolCallRounds, 0);
  assert.equal(result.hitIterationCap, false);
  assert.equal(result.turns.length, 1);
  assert.deepEqual(result.lines, [{
    line_no: 1, raw_reading: 'Weetabix', quantity: null, source_region: 1,
  }]);
});

// ---------------------------------------------------------------------
// AC6 case 2/3: a TOOL-CALL response followed by a FINAL-ANSWER response -
// proves the crop-request/continuation chain, not just each turn in
// isolation.
// ---------------------------------------------------------------------

test('runAgenticVisionLoop: a tool-call turn, then a final-answer turn - chains previous_response_id, sends ONLY the requested crop on turn 2', async () => {
  const { fn, calls } = scriptedModel([
    {
      responseId: 'r1', outputText: null, toolCalls: [{ name: 'request_crop', callId: 'c1', arguments: { region: '3' } }], usage: { input_tokens: 4000, output_tokens: 30, total_tokens: 4030 },
    },
    {
      responseId: 'r2',
      outputText: '{"lines":[{"line_no":1,"raw_reading":"Marmite","quantity":1,"source_region":3}]}',
      toolCalls: [],
      usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240 },
    },
  ]);
  const result = await runAgenticVisionLoop({
    prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL, callModel: fn,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].previousResponseId, 'r1');
  assert.deepEqual(calls[1].imageUrls, [REGIONS[3]], 'turn 2 sends ONLY the requested region 3 crop - no resent history');
  assert.equal(result.toolCallRounds, 1);
  assert.equal(result.hitIterationCap, false);
  assert.equal(result.turns.length, 2);
  assert.equal(result.turns[0].requestedRegion, 3);
  assert.deepEqual(result.lines, [{
    line_no: 1, raw_reading: 'Marmite', quantity: 1, source_region: 3,
  }]);
});

// ---------------------------------------------------------------------
// AC3/AC6 case 4 - THE ITERATION-CAP CASE, the load-bearing test: a mocked
// model response that ALWAYS requests another crop must still terminate.
// ---------------------------------------------------------------------

test('AC3: a model that ALWAYS requests another crop is bounded by the iteration cap, not looped unboundedly', async () => {
  const alwaysAskForACrop = () => ({
    responseId: 'r-always', outputText: null, toolCalls: [{ name: 'request_crop', callId: 'c', arguments: { region: '2' } }], usage: null,
  });
  const { fn, calls } = scriptedModel([alwaysAskForACrop]);
  const maxIterations = 2; // small on purpose so the test is fast and the bound is exactly checkable
  const result = await runAgenticVisionLoop({
    prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL, maxIterations, callModel: fn,
  });
  // turn1 (round becomes 1) -> turn2 (round becomes 2, ==cap) -> turn3 (cap
  // already reached, wants another crop -> forced tools-omitted final call)
  // -> turn4 (the forced call, model STILL emits a tool call in this
  // adversarial mock - loop must stop here rather than call a 5th time).
  assert.equal(calls.length, maxIterations + 2, 'the loop must stop at a bounded, known call count');
  assert.equal(result.hitIterationCap, true);
  assert.equal(result.toolCallRounds, maxIterations, 'never exceeds the cap even though the model kept asking');
  // The FORCED final call is sent with NO tools - proves the cap actually
  // withdraws the tool, not merely that the loop happens to stop.
  const forcedCall = calls[calls.length - 1];
  assert.deepEqual(forcedCall.tools, [], 'the forced final call must offer NO tools');
  // Best-effort result, never fabricated: the adversarial mock never returned
  // any outputText, so lines is honestly null, not an invented empty array
  // dressed up as a real answer.
  assert.equal(result.lines, null);
});

test('runAgenticVisionLoop: the cap is respected exactly at the boundary - a model that stops asking exactly at the cap gets a real final answer, not a forced one', async () => {
  const { fn, calls } = scriptedModel([
    () => ({
      responseId: 'r1', outputText: null, toolCalls: [{ name: 'request_crop', callId: 'c1', arguments: { region: '2' } }], usage: null,
    }),
    () => ({
      responseId: 'r2',
      outputText: '{"lines":[{"line_no":1,"raw_reading":"Milk","quantity":null,"source_region":2}]}',
      toolCalls: [],
      usage: null,
    }),
  ]);
  const result = await runAgenticVisionLoop({
    prompt: 'inspect this', fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL, maxIterations: 1, callModel: fn,
  });
  assert.equal(calls.length, 2, 'exactly one crop round, then the model itself stopped - the cap is never forced when the model finishes within budget');
  assert.equal(result.hitIterationCap, false);
  assert.equal(result.toolCallRounds, 1);
  assert.deepEqual(result.lines, [{
    line_no: 1, raw_reading: 'Milk', quantity: null, source_region: 2,
  }]);
});

// ---------------------------------------------------------------------
// normalizeResponsesUsage - PURE, no network, unit-tested directly since
// AC5's cost reporting depends on it mapping fields correctly.
// ---------------------------------------------------------------------

test('normalizeResponsesUsage: maps input_tokens/output_tokens to prompt_tokens/completion_tokens for estimateUsdCost()', () => {
  assert.deepEqual(
    normalizeResponsesUsage({ input_tokens: 35, output_tokens: 8, total_tokens: 43 }),
    { prompt_tokens: 35, completion_tokens: 8 },
  );
});

test('normalizeResponsesUsage: null/absent usage stays null - never a fabricated zero', () => {
  assert.equal(normalizeResponsesUsage(null), null);
  assert.equal(normalizeResponsesUsage(undefined), null);
});

// ---------------------------------------------------------------------
// Validation and the default cap constant.
// ---------------------------------------------------------------------

test('DEFAULT_MAX_TOOL_CALL_ROUNDS is the WP-proposed default of 4', () => {
  assert.equal(DEFAULT_MAX_TOOL_CALL_ROUNDS, 4);
});

test('runAgenticVisionLoop: missing prompt is refused before any call', async () => {
  const { fn, calls } = scriptedModel([{ responseId: 'x', outputText: null, toolCalls: [], usage: null }]);
  await assert.rejects(
    runAgenticVisionLoop({
      fullPageImageUrl: FULL_PAGE, regionImageUrls: REGIONS, tool: REQUEST_CROP_TOOL, callModel: fn,
    }),
    /prompt is required/,
  );
  assert.equal(calls.length, 0, 'refused before ever calling the model');
});
