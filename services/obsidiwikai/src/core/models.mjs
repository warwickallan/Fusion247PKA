// Fusion model gateway — role-based model access. The compiler asks for a ROLE, never a
// provider or model name. Three independent axes stay unwelded:
//   INTENT (how much work) × ROLE (what capability) × GATEWAY (who supplies).
//
// Today: with no gateway configured, `reason` falls back to the box (LightRAG /api/generate),
// so the OpenAI key stays Coolify-only and nothing breaks. When the thin LiteLLM gateway is up,
// set FUSION_GATEWAY_URL and every role call routes through it — a config change, not a code change.
import { lightrag } from '../clients/lightrag.mjs';

const GATEWAY = process.env.FUSION_GATEWAY_URL || null;      // e.g. http://100.101.240.85:4000/v1 (LiteLLM)
const GATEWAY_KEY = process.env.FUSION_GATEWAY_KEY || null;

// role → model alias, resolved by the gateway (LiteLLM model_list). Only used when a gateway exists.
export const ROLE_ALIAS = {
  extract: process.env.FUSION_MODEL_EXTRACT || 'fusion.extract',
  keyword: process.env.FUSION_MODEL_KEYWORD || 'fusion.keyword',
  query: process.env.FUSION_MODEL_QUERY || 'fusion.query',
  reason: process.env.FUSION_MODEL_REASON || 'fusion.reason',
  embed: process.env.FUSION_MODEL_EMBED || 'fusion.embed',
  vision: process.env.FUSION_MODEL_VISION || 'fusion.vision',
};

/**
 * The model the ANSWER role resolves to, read at CALL TIME (BUILD-015 WP-B15-2).
 *
 * ── WHY THIS IS A MODEL NAME AND NOT `fusion.query` ─────────────────────────
 * Warwick chose Terra deliberately for interpreting a natural-language
 * shopping answer, and ruled: do not substitute another role because it is
 * easier to reach, and do NOT silently assume `fusion.query == gpt-5.6-terra`.
 *
 * `config.mjs` records that mapping in a COMMENT. A comment is evidence, not
 * proof: the mapping lives in the gateway's own model_list, outside this repo.
 * What IS established, by a real `GET {gateway}/v1/models` probe recorded in
 * BUILD-015's DEFECT-LEDGER (D-2026-08-03-05), is that the gateway registers
 * `fusion.reason, fusion.query, fusion.extract, fusion.keyword, fusion.embed,
 * gpt-5.6-terra, gpt-5-mini, gpt-5-nano, text-embedding-3-large` — so
 * `gpt-5.6-terra` is directly addressable, while what `fusion.query` POINTS AT
 * is not knowable from here.
 *
 * That same ledger entry is the precedent: `vision` defaulted to
 * `fusion.vision`, which the gateway does not register, and it failed live
 * with a 400. The fix was to name a model the gateway actually provides.
 * Warwick's words there: "A default model name that the gateway does not
 * provide must never survive preflight again."
 *
 * So this defaults to the name the probe confirms, and stays overridable by
 * FUSION_MODEL_ANSWER so the box can point it elsewhere DELIBERATELY. It is
 * read at call time, not at import, so a decision row records the alias that
 * was actually invoked rather than one captured at process start.
 */
export function answerModel() {
  return process.env.FUSION_MODEL_ANSWER || 'gpt-5.6-terra';
}

// ── AC7 (WO-2026-08-12-B15-VISION-02) - REAL COST INSTRUMENTATION ──────────
// gatewayChat used to discard the gateway's `usage` field entirely (only
// `choices[0].message.content` ever reached a caller). This checked run's
// own scratchpad diagnostic captures (asdair-vision-test/new-pipeline-
// output.json, ab-harness-output.json) confirmed no usage data was ever
// recorded from them either - there was nothing to extract, so this
// instruments the orchestrator to capture it GOING FORWARD, per the order's
// own fallback instruction. `gatewayChat` now returns `{content, usage}`
// always; every EXISTING exported role (reason/answer/vision) keeps
// returning a bare string - see the thin wrappers below - so no existing
// caller's contract changes. `visionWithUsage` is the new, additive export
// a caller can reach for the usage alongside the content.
async function gatewayChat(role, prompt, imageUrl = null, modelOverride = null) {
  // Text-only when no imageUrl is given (identical wire body to before); OpenAI-style
  // multimodal content parts when one is given.
  //
  // MULTI-IMAGE, added WO-2026-08-11-B15-VISION-01 (AC2): `imageUrl` may now
  // ALSO be an array of data:/http(s): URLs, in which case ONE image_url
  // content part is emitted per entry, IN ARRAY ORDER, alongside the single
  // text part — this is what lets vision() send the corrected page plus
  // every numbered strip in ONE request rather than one call per image. A
  // single string still behaves exactly as before (one image_url part); this
  // is purely additive, and every existing caller that never passes an array
  // is unaffected.
  const images = imageUrl === null ? [] : (Array.isArray(imageUrl) ? imageUrl : [imageUrl]);
  const content = images.length === 0
    ? prompt
    : [{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))];
  const res = await fetch(`${GATEWAY.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(GATEWAY_KEY ? { Authorization: `Bearer ${GATEWAY_KEY}` } : {}) },
    body: JSON.stringify({ model: modelOverride || ROLE_ALIAS[role], messages: [{ role: 'user', content }], stream: false }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`fusion-gateway ${role} -> ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  // OpenAI-style `usage: {prompt_tokens, completion_tokens, total_tokens}` -
  // the shape LiteLLM (this gateway) passes through from the underlying
  // provider. NEVER assumed present - a gateway/provider that omits it
  // yields `usage: null`, an honest "not reported" rather than a fabricated
  // zero (a caller computing cost must be able to tell "zero tokens" apart
  // from "the gateway never said").
  const usage = j.usage && typeof j.usage === 'object'
    ? {
      prompt_tokens: Number.isFinite(Number(j.usage.prompt_tokens)) ? Number(j.usage.prompt_tokens) : null,
      completion_tokens: Number.isFinite(Number(j.usage.completion_tokens)) ? Number(j.usage.completion_tokens) : null,
      total_tokens: Number.isFinite(Number(j.usage.total_tokens)) ? Number(j.usage.total_tokens) : null,
    }
    : null;
  return { content: j.choices?.[0]?.message?.content ?? '', usage };
}

// The reasoning role: canonicaliser tie-breaks, Warwick-relevance, suggestions.
export async function reason(prompt) {
  if (GATEWAY) return (await gatewayChat('reason', prompt)).content;
  return lightrag.generate(prompt); // fallback via the box; OpenAI key stays Coolify-only
}

// The ANSWER role: interpret ONE natural-language answer Warwick gave about ONE
// line of THIS WEEK's shopping list (BUILD-015 WP-B15-2).
//
// Deliberately NO fallback, for exactly the reason vision() states below. The
// box path (`lightrag.generate`) would silently substitute a different model
// for a decision that changes what Warwick is actually sent and charged for,
// with nothing on the record saying which model answered — and the whole point
// of this path is that the durable provenance row is TRUE. An answer nobody
// can attribute is the failure mode a household shopping list must never have.
//
// Warwick chose Terra for this specifically and ruled that it must not be
// substituted with another role because that role is easier to reach. Throwing
// here is what makes that ruling enforceable rather than aspirational: with no
// gateway there is no Terra, so there is no interpretation, and the caller
// degrades to asking Warwick another question.
//
// Uses the SAME gatewayChat, the same credentials and the same fetch as every
// other role — there is no second model or credential path here. The model is
// resolved by answerModel() at call time; see its note for why it names a
// model the gateway is PROVEN to register rather than an alias whose target
// this repository cannot see.
export async function answer(prompt) {
  if (!GATEWAY) {
    throw new Error(
      'fusion-gateway: no gateway configured (set FUSION_GATEWAY_URL). '
      + 'Refusing to fall back to a text-only box model for a household shopping decision.'
    );
  }
  return (await gatewayChat('answer', prompt, null, answerModel())).content;
}

// The vision role: read an IMAGE (e.g. a photographed handwritten shopping list) plus a prompt.
// `imageUrl` is a data: or http(s): URL — the caller decides what it is willing to send.
//
// MULTI-IMAGE, added WO-2026-08-11-B15-VISION-01 (AC2): `imageUrl` may ALSO be a
// non-empty ARRAY of such URLs, sent as separate image parts in ONE request — this is
// what lets the vision pipeline send "the corrected page + numbered strips ... in ONE
// request per normal case" (AC2's own wording) rather than a call per image. A single
// string is unchanged, existing behaviour. EVERY entry is validated exactly as the
// single-URL form always was — an empty array, or any non-string/empty entry, is
// refused rather than silently sending a partial or malformed request.
//
// Deliberately NO fallback. The box path (`lightrag.generate`) is text-only, so falling back would
// hand a blind text model a prompt about an image it cannot see and invite an invented answer —
// exactly the failure mode a household shopping list must never have. With no gateway configured
// this throws instead. "Capable" is only proven at call time: a configured gateway without a
// vision-bound `fusion.vision` alias surfaces the gateway's own error, it is never papered over.
function assertValidVisionImages(imageUrl) {
  const images = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
  if (images.length === 0) {
    throw new Error('fusion-gateway vision: at least one image reference (data: or http(s): URL) is required');
  }
  for (const url of images) {
    if (typeof url !== 'string' || url === '') {
      throw new Error('fusion-gateway vision: every image reference must be a non-empty data: or http(s): URL');
    }
  }
}

export async function vision(prompt, imageUrl) {
  if (!GATEWAY) {
    throw new Error(
      'fusion-gateway: no vision-capable gateway configured (set FUSION_GATEWAY_URL). ' +
      'Refusing to fall back to a text-only model for an image task.'
    );
  }
  assertValidVisionImages(imageUrl);
  return (await gatewayChat('vision', prompt, imageUrl)).content;
}

/**
 * AC7 (WO-2026-08-12-B15-VISION-02): the SAME vision call as vision() above,
 * additionally returning the gateway's own reported token usage alongside
 * the content - `{content, usage}`, where `usage` is
 * `{prompt_tokens, completion_tokens, total_tokens}` or `null` when the
 * gateway/provider did not report it. Every validation and error path is
 * identical to vision() - this is purely an additive sibling for a caller
 * that wants to CAPTURE cost, never a replacement for vision()'s existing
 * string-returning contract, which every current pipeline collaborator
 * (interpretPhotoOrchestrator.js) still relies on unchanged.
 *
 * @param {string} prompt
 * @param {string|string[]} imageUrl
 * @returns {Promise<{content: string, usage: {prompt_tokens:number|null, completion_tokens:number|null, total_tokens:number|null}|null}>}
 */
export async function visionWithUsage(prompt, imageUrl) {
  if (!GATEWAY) {
    throw new Error(
      'fusion-gateway: no vision-capable gateway configured (set FUSION_GATEWAY_URL). ' +
      'Refusing to fall back to a text-only model for an image task.'
    );
  }
  assertValidVisionImages(imageUrl);
  return gatewayChat('vision', prompt, imageUrl);
}

// ── AGENTIC VISION PROTOTYPE (WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC1) ──
//
// /v1/responses support, ADDITIVE ONLY. gatewayChat()/vision()/visionWithUsage()
// above are COMPLETELY UNCHANGED - every existing caller (interpretPhotoOrchestrator.js,
// deps.js, and everything else built on build-015/b15-24-vision-pipeline) is
// unaffected. This is a NEW, separate wire path used ONLY by the standalone
// prototype at services/asdair/pipeline/agenticVisionPrototype/** - nothing in
// the production pipeline calls this function.
//
// WHY A SEPARATE FUNCTION RATHER THAN EXTENDING gatewayChat(): /v1/chat/completions
// and /v1/responses are genuinely different wire protocols on this gateway -
// different path, different request shape (`messages` vs `input`), different
// response shape (`choices[0].message` vs `output[]`), and different
// continuation mechanics. `/v1/responses` is the ONLY one of the two where
// `previous_response_id` actually works: confirmed by real execution,
// `/v1/chat/completions` + `previous_response_id` returns a genuine 400
// "Unknown parameter" (Deliverables/2026-08-12-capability-probe-evidence/
// results.json, `multiturn_previous_response_id_on_chat_completions`).
// Bolting this onto gatewayChat() would mean branching its entire body on the
// endpoint; a new function is the smaller, more honest diff.
//
// REAL EVIDENCE for the shapes below, durably committed at
// Deliverables/2026-08-12-capability-probe-evidence/ (not scratchpad-only, not
// a generic public-docs assumption):
//  - genuine server-side continuation via `previous_response_id`: a real
//    two-call exchange where the second call correctly recalls the first
//    call's content having sent NO prior message history (results.json:
//    responses_api__responses.second_call_body.output[0].content[0].text ===
//    "OTTER-3", the codeword ONLY the first call was ever told, plus that
//    second call's own `previous_response_id` field echoing the first call's id)
//  - tool-calling confirmed WORKING on /v1/responses, keeping FULL reasoning
//    (unlike /v1/chat/completions, which needs reasoning_effort:'none' to
//    allow tools at all - see the `tool_calling` 400 in results.json vs
//    toolcall2-results.json's `responses_api` succeeding with reasoning kept):
//    `output` contains a `reasoning`-type item then a `function_call`-type
//    item (`name:"request_crop"`, `arguments:'{"region":"3"}'`, a `call_id`)
//  - the response's own top-level `id` (a `resp_...` string) is what a caller
//    passes back as `previous_response_id` on the next turn
//  - `usage` on this endpoint is SHAPED DIFFERENTLY from gatewayChat()'s
//    `{prompt_tokens, completion_tokens, total_tokens}` - it is
//    `{input_tokens, output_tokens, total_tokens, ...}`. Returned here AS THE
//    GATEWAY ACTUALLY SENDS IT, never renamed - a caller wanting
//    estimateUsdCost() must map the field names itself (done in
//    agenticVisionPrototype/, not here: this function stays a faithful, thin
//    wire wrapper, matching gatewayChat()'s own "never invents, never
//    reshapes" discipline).
//
// ONE GAP, NAMED RATHER THAN HIDDEN: neither committed probe sent an actual
// IMAGE via /v1/responses - both probes exercised text-only `input`. The
// multimodal content-parts shape below (`input_text`/`input_image`, modelled
// on the ALREADY-PROVEN /v1/chat/completions image_url shape used by
// gatewayChat() above, per the Responses API's own documented content-parts
// convention) is NOT independently proven by this WP's own evidence for the
// image case specifically. This is exactly the class of claim AC1 says not to
// build on a "generic public-docs assumption" without saying so - so: said so,
// here, loudly. Asdair's live run against the real gateway (AC5, the actual
// point of this WP) is what proves or falsifies this, not a unit test with a
// mocked fetch.
//
// ── WO-2026-08-12-B15-VISION-PROTOTYPE-02, AC1 — `function_call_output` ────
// Asdair's first live run crashed on turn 2 of every run, identical cause:
// this function never told the gateway what happened with the pending tool
// call before sending the next request, so the gateway correctly 400'd
// ("No tool output found for function call ..."). `toolOutputs` (an array of
// `{callId, output}`, one entry per pending `call_id` from the turn just
// received) fixes that: each entry becomes a `function_call_output` item,
// placed AHEAD of the new user-message item in the `input` array.
//
// A SECOND GAP, NAMED RATHER THAN HIDDEN, same discipline as the multimodal
// gap above: no committed probe captured a SUCCESSFUL continuation after a
// tool call - toolcall2-results.json and results.json between them only show
// (a) a tool-call turn's own response shape, and (b) the 400 this function
// used to trigger by omitting the output entirely. Neither shows what a
// GOOD request looks like. The shape built below - one
// `{type:'function_call_output', call_id, output}` item per pending call,
// `output` a short text acknowledgement, with the actual crop delivered
// separately via the accompanying user message's own `input_image` content
// part exactly as this loop already sends it - is the standard documented
// Responses API convention, NOT independently proven by this WP's own
// evidence. Asdair's next live run (dispatched immediately after this WP,
// per its own Sequencing) is what proves or falsifies this, not a unit test
// with a mocked fetch.
// ── WO-2026-08-12-01-v2 (WP-B15-29), AC2 — the `textFormat` pass-through ──
// ONE optional parameter, added because this function builds the ENTIRE
// /v1/responses body and exposed no seam through which a caller could
// constrain the output. It is a pass-through and nothing else: when
// `textFormat` is absent the body is byte-identical to before, so every
// existing caller is unaffected.
//
// The caller supplies the FLAT Responses-API shape
// `{type:'json_schema', name, strict:true, schema}` and this function nests it
// under `text.format` - the ONE shape live probing found actually enforces.
// Two traps, recorded here because the silent one is the dangerous one:
//   - a NESTED `json_schema` object under `text.format` returns a loud 400;
//   - `response_format` (the /v1/chat/completions field) on /v1/responses
//     returns HTTP 200 with the constraint SILENTLY NOT APPLIED - and
//     /responses is the endpoint this function calls, so a caller that
//     assumed `200 === constrained` would ship an unconstrained pipeline that
//     looks perfectly healthy.
// This function therefore never accepts `response_format` and never rewrites
// the caller's shape: it passes exactly what it was handed, so what the
// caller reasoned about is what goes on the wire.
export async function visionAgenticTurn({
  prompt, imageUrls = [], tools = [], previousResponseId = null, toolOutputs = [], textFormat = null,
} = {}) {
  if (!GATEWAY) {
    throw new Error(
      'fusion-gateway: no gateway configured (set FUSION_GATEWAY_URL). ' +
      'Refusing to fall back for an agentic vision call.'
    );
  }
  if (typeof prompt !== 'string' || prompt === '') {
    throw new Error('fusion-gateway visionAgenticTurn: prompt is required');
  }
  const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  for (const url of images) {
    if (typeof url !== 'string' || url === '') {
      throw new Error('fusion-gateway visionAgenticTurn: every image reference must be a non-empty data: or http(s): URL');
    }
  }
  if (!Array.isArray(toolOutputs)) {
    throw new Error('fusion-gateway visionAgenticTurn: toolOutputs must be an array of {callId, output}');
  }
  for (const t of toolOutputs) {
    if (!t || typeof t.callId !== 'string' || t.callId === '') {
      throw new Error('fusion-gateway visionAgenticTurn: every toolOutputs entry needs a non-empty callId');
    }
  }
  // One function_call_output item per pending call, per AC1 - see the header
  // comment above for what evidence this shape is and is not grounded in.
  const functionCallOutputItems = toolOutputs.map((t) => ({
    type: 'function_call_output',
    call_id: t.callId,
    output: typeof t.output === 'string' ? t.output : JSON.stringify(t.output ?? ''),
  }));
  const userMessageItem = {
    role: 'user',
    content: [
      { type: 'input_text', text: prompt },
      ...images.map((url) => ({ type: 'input_image', image_url: url })),
    ],
  };
  const body = {
    model: answerModel(),
    store: true,
    // Bare-string `input` is preserved EXACTLY as before for the plain
    // text-only, no-pending-tool-call case (the committed probe's proven
    // shape) - only a pending tool call or an image forces the array form.
    input: functionCallOutputItems.length > 0
      ? [...functionCallOutputItems, userMessageItem]
      : (images.length > 0 ? [userMessageItem] : prompt),
  };
  if (previousResponseId) body.previous_response_id = previousResponseId;
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  // AC2: pass-through only. Absent -> the body is exactly what it always was.
  if (textFormat) body.text = { format: textFormat };
  const res = await fetch(`${GATEWAY.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(GATEWAY_KEY ? { Authorization: `Bearer ${GATEWAY_KEY}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`fusion-gateway responses -> ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const output = Array.isArray(j.output) ? j.output : [];
  const messageItem = output.find((item) => item && item.type === 'message');
  const outputText = messageItem && Array.isArray(messageItem.content) && messageItem.content[0]
    ? (messageItem.content[0].text ?? null)
    : null;
  const toolCalls = output
    .filter((item) => item && item.type === 'function_call')
    .map((item) => ({
      name: item.name,
      callId: item.call_id,
      arguments: (() => {
        try { return JSON.parse(item.arguments); } catch (e) { return null; }
      })(),
    }));
  return {
    responseId: j.id ?? null,
    outputText,
    toolCalls,
    usage: j.usage && typeof j.usage === 'object' ? j.usage : null,
  };
}

// ── AC7 (WO-2026-08-12-B15-VISION-02) - AUTHORED PRICING CONFIGURATION ─────
//
// NOT AN EXISTING, PREVIOUSLY-CONFIGURED VALUE. No pricing configuration
// existed anywhere in this repository before this Work Order (checked:
// services/obsidiwikai/src/config.mjs and a repo-wide grep for pricing/cost
// constants near any model name found nothing). AUTHORED here, sourced
// EXACTLY from Deliverables/2026-08-11-pax-vision-pipeline-and-luna-sol-
// terra-research.md ("Pricing (per 1M tokens, input/output)"), cited
// verbatim rather than approximated:
//
//   "Vellum (post-30-July-2026 price cut) gives Sol $5/$30, Terra $2/$12,
//    Luna $0.80/$4; a slightly older/different-dated source gives Sol
//    $5/$30, Terra $2.50/$15, Luna $1/$6."
//
// TWO figures were on record for Terra because GPT-5.6 pricing moved once in
// its first month (that research's own finding), and this constant originally
// picked the WRONG one of the two.
//
// ── CORRECTED (WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC4) ──────────────
// This is no longer a secondary-source pick between two research figures -
// it is now confirmed by a REAL `/model/info` probe against the LIVE deployed
// gateway (Deliverables/2026-08-12-capability-probe-evidence/results.json,
// `model_info_probe[].relevant[model_name=="gpt-5.6-terra"].model_info`):
// `input_cost_per_token: 0.0000025` (= $2.50/M), `output_cost_per_token:
// 0.000015` (= $15/M) - exactly the figure this file previously labelled
// "OLDER" and excluded from estimateUsdCost(). The gateway actually bills
// $2.50/$15, not the $2/$12 this constant used to hold. Every cost figure
// reported across all six vision-pipeline rounds this session was therefore
// ~25% too low (real spend was somewhat higher than reported; the actual
// totals were still small, single-digit dollars, but the constant was wrong
// regardless and is corrected here, not merely re-labelled).
//
// The two exported constants are UNCHANGED IN NAME (so no other file's import
// needs to change) - their VALUES are swapped: `TERRA_PRICING_USD_PER_MILLION_
// TOKENS` (the one estimateUsdCost() actually reads) now holds the
// live-gateway-confirmed $2.50/$15; `_OLDER` now holds the previous, now-
// confirmed-wrong $2/$12 figure, kept for traceability only, same as before.
//
// USD, per 1,000,000 tokens - the unit the gateway's own per-token figures
// convert to cleanly, so this needs no further unit conversion at the point
// of use.
export const TERRA_PRICING_USD_PER_MILLION_TOKENS_OLDER = Object.freeze({
  input: 2.00, output: 12.00, // superseded - kept for traceability only, NOT used by estimateUsdCost
});
export const TERRA_PRICING_USD_PER_MILLION_TOKENS = Object.freeze({
  input: 2.50,  // prompt_tokens - CONFIRMED by live gateway /model/info probe, GPT-5.6 Terra
  output: 15.00, // completion_tokens - CONFIRMED by live gateway /model/info probe, GPT-5.6 Terra
});

/**
 * Approximate USD cost of one gateway usage record, using the authored
 * pricing above. PURE - no I/O, no gateway call. Returns null when usage
 * itself is null (the gateway never reported it - an honest "cannot cost
 * this", never a fabricated zero).
 * @param {{prompt_tokens:number|null, completion_tokens:number|null}|null} usage
 * @returns {number|null}
 */
export function estimateUsdCost(usage) {
  if (!usage) return null;
  const inputTokens = Number.isFinite(Number(usage.prompt_tokens)) ? Number(usage.prompt_tokens) : 0;
  const outputTokens = Number.isFinite(Number(usage.completion_tokens)) ? Number(usage.completion_tokens) : 0;
  return (inputTokens / 1_000_000) * TERRA_PRICING_USD_PER_MILLION_TOKENS.input
    + (outputTokens / 1_000_000) * TERRA_PRICING_USD_PER_MILLION_TOKENS.output;
}

// extract/keyword/query are LightRAG-internal roles today (bound on the box). They move behind the
// same gateway when FUSION_GATEWAY_URL is set — LightRAG's LLM_BINDING_HOST points at it too.
export const gatewayConfigured = !!GATEWAY;
// A vision call has somewhere to go at all. Not a promise the bound model can see — see vision().
export const visionConfigured = !!GATEWAY;
