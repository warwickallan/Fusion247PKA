// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/regionAvailability.test.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC1 - THE MUTATION PROOF for the SILENT
// half of the split-representation defect.
//
// The loud half (the crop-granting branch) always threw, so it was already
// covered. The dangerous half was the ITERATION-CAP branch, which resolved
// the same requested regions with `.filter(Boolean)`: an unavailable region
// was silently dropped, the forced final call went out with fewer images than
// the model had asked for, and NOTHING anywhere recorded that the request had
// gone unmet. A model that asked for a closer look and was handed nothing
// still answers - and its answer looks exactly like a confident one.
//
// A guard no test can fail is not a guard, so this file drives a scripted
// model that ALWAYS requests a region no crop exists for, past the iteration
// cap, and asserts the loop now errors on that path. Every call is a local
// function - no network, no gateway, no credentials.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgenticVisionLoop, cropsForRegions } from './agenticLoop.js';
import { REQUEST_CROP_TOOL } from './tools.js';

const TURN = (region) => ({
  responseId: `resp_${region}`,
  outputText: null,
  toolCalls: [{ name: 'request_crop', callId: `call_${region}`, arguments: { region: String(region) } }],
  usage: { input_tokens: 10, output_tokens: 1 },
});

test('AC1 mutation proof: an unavailable region forced down the ITERATION-CAP branch now ERRORS instead of being silently dropped', async () => {
  // maxIterations 1, and the scripted model asks for an AVAILABLE region
  // first: that consumes the one permitted round through the normal branch,
  // so the SECOND request - for a region with no crop - lands in the
  // iteration-cap branch. That is the exact path `.filter(Boolean)` used to
  // swallow, and it cannot be reached by asking for a bad region immediately
  // (the normal branch would throw first and prove nothing about the cap).
  const calls = [];
  const callModel = async (args) => {
    calls.push(args);
    return calls.length === 1 ? TURN(2) : TURN(99);
  };

  await assert.rejects(
    () => runAgenticVisionLoop({
      prompt: 'read this',
      fullPageImageUrl: 'data:image/jpeg;base64,PAGE',
      regionImageUrls: { 1: 'data:image/jpeg;base64,PAGE', 2: 'data:image/jpeg;base64,STRIP2' },
      tool: REQUEST_CROP_TOOL,
      maxIterations: 1,
      callModel,
    }),
    /iteration-cap branch.*region\(s\) 99.*no crop available for 99/s,
    'the cap branch must fail loudly - a silently short-changed model still answers, and its answer looks confident',
  );
});

test('AC1: the crop-granting branch fails loudly too, with the SAME message shape', async () => {
  const callModel = async () => TURN(99);
  await assert.rejects(
    () => runAgenticVisionLoop({
      prompt: 'read this',
      fullPageImageUrl: 'data:image/jpeg;base64,PAGE',
      regionImageUrls: { 1: 'data:image/jpeg;base64,PAGE', 2: 'data:image/jpeg;base64,STRIP2' },
      tool: REQUEST_CROP_TOOL,
      maxIterations: 4,
      callModel,
    }),
    /crop-granting branch.*no crop available for 99/s,
  );
});

test('AC1: region 1 is servable end to end - the loop completes when the model asks for the full page', async () => {
  const seen = [];
  let turn = 0;
  const callModel = async (args) => {
    seen.push(args.imageUrls);
    turn += 1;
    if (turn === 1) return TURN(1); // the mid-loop full-page re-look
    return {
      responseId: 'resp_final',
      outputText: '{"lines":[{"line_no":1,"as_written":"milk","visible_line":true,"product_id":"7","source_region":1,"quantity":null,"confidence":0.9}]}',
      toolCalls: [],
      usage: { input_tokens: 20, output_tokens: 5 },
    };
  };

  const result = await runAgenticVisionLoop({
    prompt: 'read this',
    fullPageImageUrl: 'data:image/jpeg;base64,PAGE',
    regionImageUrls: { 1: 'data:image/jpeg;base64,PAGE', 2: 'data:image/jpeg;base64,STRIP2' },
    tool: REQUEST_CROP_TOOL,
    callModel,
  });

  assert.equal(result.toolCallRounds, 1);
  assert.equal(result.hitIterationCap, false);
  assert.equal(result.lines.length, 1);
  assert.deepEqual(seen[1], ['data:image/jpeg;base64,PAGE'], 'turn 2 receives the region-1 crop the model asked for');
});

test('cropsForRegions: names the missing region AND what was available - a diagnosable error, not just a throw', () => {
  assert.throws(
    () => cropsForRegions({ 1: 'a', 2: 'b' }, [2, 7], 'test branch'),
    /test branch.*no crop available for 7.*available: 1, 2/s,
  );
});

test('cropsForRegions: a tool call whose region could not be parsed is an error, never an empty crop list', () => {
  assert.throws(() => cropsForRegions({ 1: 'a' }, [], 'test branch'), /no parseable region number/);
});
