// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/agenticLoop.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC2/AC3: the standalone agentic
// inspection loop. Terra decides, mid-conversation, whether it needs a closer
// look at part of the photograph - the application no longer decides
// after the fact from output it can only partially see (the dominant,
// unsolved failure named in Deliverables/2026-08-12-vision-pipeline-six-
// round-reconciliation.md - roughly half a photographed list's lines
// silently omitted, because a post-hoc signal on the model's own returned
// lines cannot detect what the model never returned at all).
//
// STANDALONE, per the Work Order's explicit instruction: NOT imported by, and
// does not import, interpretPhotoOrchestrator.js / deps.js / runPipeline.js
// or any other production call site. This module's only pipeline-internal
// dependency is estimateUsdCost() from models.mjs (already granted, already
// correct after AC4) for turning a turn's usage into a cost figure.
//
// TURN 1 sends the full prepared page PLUS every numbered strip in ONE
// request (matches the audit's confirmed-working multi-image capability and
// the architecture doc's own diagram - "full prepared image + numbered
// regions" in one call). On a `request_crop` tool call, the SAME already-
// rendered crop for that region_no is sent alone as the next turn, chained
// via `previous_response_id` - genuinely NO resent history (AC2's own
// wording: "supply the requested region's crop as the next turn"). This
// prototype does not re-render a NEW higher-resolution crop on demand - it
// resends the same per-region render imageRender.js already produced
// upfront (an intentional simplification for a first prototype, named here
// rather than silently assumed: whether an ISOLATED look at content already
// sent, without competing visual noise from every other region, helps is
// exactly the thing this prototype exists to test).
//
// THE ITERATION CAP (AC3): `maxIterations` (default 4, see
// DEFAULT_MAX_TOOL_CALL_ROUNDS below) is the maximum number of `request_crop`
// calls this loop will HONOUR with a genuine follow-up turn. If Terra still
// wants another crop after the cap is reached, this loop makes exactly ONE
// further call with NO tools offered (`tools: []`) - forcing a best-effort
// final answer rather than either looping unboundedly or silently returning
// nothing. This is what "returns its best-effort result at the cap" (AC3's
// own wording) means concretely: a real, tested code path, not merely a
// counter that stops calling.
//
// `callModel` is INJECTABLE (defaults to models.mjs's real
// `visionAgenticTurn`) specifically so AC6's tests can supply a scripted
// sequence of mocked responses (a tool-call turn, a final-answer turn, and a
// turn that ALWAYS requests another crop for the cap test) without touching
// global fetch across many sequential turns - the same reason this repo's
// OWN `deps.js` injects its model/DB collaborators rather than importing them
// directly (see deps.js's own header).
//
// ── WO-2026-08-12-B15-VISION-PROTOTYPE-02, AC2/AC1 ──────────────────────────
// Asdair's first live run showed Terra requesting TWO regions simultaneously
// in one turn; this loop used to read only `result.toolCalls[0]`, silently
// dropping the second. It now handles EVERY entry in `result.toolCalls`: a
// crop is supplied for each requested region, and ONE `function_call_output`
// (per models.mjs's own AC1 fix) is built for EACH pending `call_id` and
// passed to the next `callModel()` call via the new `toolOutputs` argument -
// the gateway requires every pending call answered before it will accept the
// next request, regardless of how many crops the model asked for at once.
// =====================================================================

'use strict';

import { estimateUsdCost, visionAgenticTurn } from '../../../obsidiwikai/src/core/models.mjs';

export const DEFAULT_MAX_TOOL_CALL_ROUNDS = 4;

/**
 * ── WO-2026-08-12-01-v2 (WP-B15-29), AC1 — BOTH sides of the
 * split-representation defect, resolved in ONE place ──────────────────────
 *
 * The loop used to resolve requested regions to crops TWICE, in two branches,
 * with two DIFFERENT failure behaviours:
 *
 *   - the normal branch threw when a requested region had no crop;
 *   - the iteration-cap branch used `.filter(Boolean)`, which SILENTLY dropped
 *     an unavailable region and carried on as though the model had been given
 *     what it asked for.
 *
 * The silent one is the dangerous one: a model that asked for a closer look at
 * a region and was quietly handed nothing still answers, and nothing anywhere
 * records that its request went unmet. Both branches now call this single
 * function, so an unavailable region fails LOUDLY on every path there is.
 *
 * @param {Record<number, string>} regionImageUrls
 * @param {number[]} requestedRegions
 * @param {string} where - the branch name, so the error says which path failed.
 * @returns {string[]} one data URL per requested region, in request order.
 */
export function cropsForRegions(regionImageUrls, requestedRegions, where) {
  if (!Array.isArray(requestedRegions) || requestedRegions.length === 0) {
    throw new Error(`runAgenticVisionLoop (${where}): the model made a tool call with no parseable region number`);
  }
  const missing = requestedRegions.filter((r) => !regionImageUrls[r]);
  if (missing.length > 0) {
    throw new Error(
      `runAgenticVisionLoop (${where}): model requested region(s) ${requestedRegions.join(', ')}, `
      + `no crop available for ${missing.join(', ')} - available: ${Object.keys(regionImageUrls).join(', ')}`,
    );
  }
  return requestedRegions.map((r) => regionImageUrls[r]);
}

/**
 * `/v1/responses` usage is `{input_tokens, output_tokens, ...}` -
 * DIFFERENT field names from estimateUsdCost()'s expected
 * `{prompt_tokens, completion_tokens}` (the /v1/chat/completions shape).
 * models.mjs's visionAgenticTurn() deliberately returns usage UNCHANGED, as
 * the gateway actually sends it (see its own header) - this loop, not
 * models.mjs, does the field-name mapping so the SAME estimateUsdCost() (and
 * the SAME corrected AC4 pricing) keeps working for both endpoints without
 * a second pricing function.
 * @param {{input_tokens:number|null, output_tokens:number|null}|null} usage
 * @returns {{prompt_tokens:number|null, completion_tokens:number|null}|null}
 */
export function normalizeResponsesUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return {
    prompt_tokens: Number.isFinite(Number(usage.input_tokens)) ? Number(usage.input_tokens) : null,
    completion_tokens: Number.isFinite(Number(usage.output_tokens)) ? Number(usage.output_tokens) : null,
  };
}

/**
 * Parse the model's final JSON answer into `{lines}`. Returns `null` (never
 * throws, never invents a line) when the text is not parseable strict JSON
 * with a `lines` array - an honest "could not parse this turn's answer",
 * for the caller to report rather than this module silently swallowing it.
 * @param {string|null} outputText
 * @returns {Array<object>|null}
 */
function parseFinalLines(outputText) {
  if (typeof outputText !== 'string' || outputText.trim() === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (e) {
    return null;
  }
  return Array.isArray(parsed?.lines) ? parsed.lines : null;
}

/**
 * Run the agentic inspection loop to completion (a final answer, or the
 * iteration cap forcing one).
 *
 * @param {object} args
 * @param {string} args.prompt - from buildAgenticPrompt() - the FIRST turn's
 *   instruction text.
 * @param {string} args.fullPageImageUrl - the prepared full-page data URL
 *   (region_no 1 - full_page - per imagePrep.js's planRegions()).
 * @param {Record<number, string>} args.regionImageUrls - EVERY region's
 *   rendered crop, keyed by region_no (2..N+1, the strips) - from
 *   imageRender.js's renderAllRegions() + toDataUrl(). Sent ALL TOGETHER on
 *   turn 1, and the SAME per-region entry resent alone on a `request_crop`
 *   follow-up turn.
 * @param {object} args.tool - the tool definition offered while the cap has
 *   not been reached (agenticVisionPrototype/tools.js's REQUEST_CROP_TOOL).
 * @param {number} [args.maxIterations] - default DEFAULT_MAX_TOOL_CALL_ROUNDS.
 * @param {Function} [args.callModel] - default models.mjs's visionAgenticTurn;
 *   injectable for tests.
 * @returns {Promise<{
 *   lines: Array<object>|null,
 *   toolCallRounds: number,
 *   hitIterationCap: boolean,
 *   turns: Array<{turnNo:number, responseId:string|null, requestedRegion:number|null, requestedRegions:number[], usage:object|null, costUsd:number|null}>,
 * }>}
 */
export async function runAgenticVisionLoop({
  prompt,
  fullPageImageUrl,
  regionImageUrls,
  tool,
  maxIterations = DEFAULT_MAX_TOOL_CALL_ROUNDS,
  callModel = visionAgenticTurn,
  textFormat = null,
} = {}) {
  if (typeof prompt !== 'string' || prompt === '') {
    throw new Error('runAgenticVisionLoop: prompt is required');
  }
  if (typeof fullPageImageUrl !== 'string' || fullPageImageUrl === '') {
    throw new Error('runAgenticVisionLoop: fullPageImageUrl is required');
  }
  if (!regionImageUrls || typeof regionImageUrls !== 'object') {
    throw new Error('runAgenticVisionLoop: regionImageUrls (a region_no -> data URL map) is required');
  }
  if (!tool) {
    throw new Error('runAgenticVisionLoop: tool (the request_crop tool definition) is required');
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 0) {
    throw new Error('runAgenticVisionLoop: maxIterations must be a non-negative integer');
  }

  const turns = [];
  let toolCallRounds = 0;
  let hitIterationCap = false;
  let previousResponseId = null;
  let currentPrompt = prompt;
  let currentImageUrls = [fullPageImageUrl, ...Object.values(regionImageUrls)];
  let currentTools = [tool];
  let currentToolOutputs = []; // nothing pending on turn 1 - no prior tool call to answer
  let turnNo = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await callModel({
      prompt: currentPrompt,
      imageUrls: currentImageUrls,
      tools: currentTools,
      previousResponseId,
      toolOutputs: currentToolOutputs,
      // AC2: the strict schema is sent on EVERY turn, not only the last.
      // Live probing established that image input, tool calling and a strict
      // schema compose in one request, and the model may end the loop on any
      // turn - so constraining only a turn we predicted would be final is a
      // constraint that is absent exactly when it is needed. `null` here
      // leaves the request body byte-identical to the unconstrained loop,
      // which is what makes Arm A a fair comparison.
      textFormat,
    });

    const costUsd = estimateUsdCost(normalizeResponsesUsage(result.usage));
    // AC2: EVERY call the model made this turn, not just the first - Asdair's
    // live run showed Terra requesting two regions simultaneously.
    const requestedCalls = Array.isArray(result.toolCalls) ? result.toolCalls : [];
    const requestedRegions = requestedCalls
      .map((c) => Number(c.arguments && c.arguments.region))
      .filter((n) => Number.isFinite(n));

    turns.push({
      turnNo,
      responseId: result.responseId,
      requestedRegion: requestedRegions.length > 0 ? requestedRegions[0] : null, // back-compat: first requested region, or null
      requestedRegions, // every region requested this turn, in call order - [] when none
      usage: result.usage,
      costUsd,
    });

    if (requestedCalls.length === 0) {
      // No tool call - this IS the final answer turn (whether reached
      // normally or as the forced final call after the cap).
      return {
        lines: parseFinalLines(result.outputText), toolCallRounds, hitIterationCap, turns,
      };
    }

    previousResponseId = result.responseId;

    if (currentTools.length === 0) {
      // We already made the forced, tools-omitted final call and the model
      // STILL emitted a tool call shape somehow (a mocked-response edge case
      // or a genuinely surprising live response) - stop here rather than
      // loop again past the point where we deliberately withdrew the tool.
      // Best-effort result: whatever text (if any) came back, honestly
      // parsed - never invented.
      return {
        lines: parseFinalLines(result.outputText), toolCallRounds, hitIterationCap: true, turns,
      };
    }

    // AC1: every pending call_id from the turn just received MUST be
    // answered with a function_call_output before the next request is sent -
    // whether or not we go on to grant a fresh crop for it (the cap branch
    // below still has to answer these, it just declines to grant more).
    const toolOutputsForNextTurn = requestedCalls.map((c) => ({
      callId: c.callId,
      output: 'Crop rendered and attached to the next message.',
    }));

    if (toolCallRounds >= maxIterations) {
      // Cap reached and the model still wants another crop: make exactly
      // ONE more call with NO tools offered, forcing a best-effort final
      // answer instead of honouring the request or looping unboundedly.
      hitIterationCap = true;
      // AC1: was `.filter(Boolean)` - a silent drop. Now the SAME loud
      // resolution the normal branch uses.
      const cropUrls = cropsForRegions(regionImageUrls, requestedRegions, 'iteration-cap branch');
      currentPrompt = 'You have used every available inspection round for this photograph. Give your best final JSON answer now, based on everything you have already seen - do not request another crop.';
      currentImageUrls = cropUrls;
      currentTools = [];
      currentToolOutputs = toolOutputsForNextTurn;
      turnNo += 1;
      continue;
    }

    toolCallRounds += 1;
    const cropUrls = cropsForRegions(regionImageUrls, requestedRegions, 'crop-granting branch');
    currentPrompt = requestedRegions.length > 1
      ? `Here are the crops of regions ${requestedRegions.join(', ')} you requested. Continue inspecting - call request_crop again if you still need another look, or give your final JSON answer when confident you have covered the whole page.`
      : `Here is the crop of region ${requestedRegions[0]} you requested. Continue inspecting - call request_crop again if you still need another look, or give your final JSON answer when confident you have covered the whole page.`;
    currentImageUrls = cropUrls;
    currentTools = [tool];
    currentToolOutputs = toolOutputsForNextTurn;
    turnNo += 1;
  }
}
