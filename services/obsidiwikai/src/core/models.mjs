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
// TWO figures are on record for Terra because GPT-5.6 pricing moved once in
// its first month (that research's own finding). The CURRENT constant below
// uses the POST-CUT figure ($2/$12, the more recent of the two, per Vellum)
// - the OLDER $2.50/$15 figure is kept alongside it, named, so a future
// reader can see exactly what changed and by how much rather than losing
// the superseded number entirely. Recorded as a documented, overridable
// constant rather than a bare number buried in a calculation, so the NEXT
// price change (near-certain, per that same research) is a one-line diff,
// not an archaeology exercise - and per AC8, a live gateway pricing check
// remains Asdair's job, not re-derived here from an env var this order was
// not given.
//
// USD, per 1,000,000 tokens - the unit that source publishes in, so this
// needs no unit conversion at the point of use.
export const TERRA_PRICING_USD_PER_MILLION_TOKENS_OLDER = Object.freeze({
  input: 2.50, output: 15.00, // superseded - kept for traceability only, NOT used by estimateUsdCost
});
export const TERRA_PRICING_USD_PER_MILLION_TOKENS = Object.freeze({
  input: 2.00,  // prompt_tokens - Pax's research, Vellum post-30-July-2026 cut, GPT-5.6 Terra
  output: 12.00, // completion_tokens - Pax's research, Vellum post-30-July-2026 cut, GPT-5.6 Terra
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
