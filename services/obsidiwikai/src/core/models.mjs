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

async function gatewayChat(role, prompt, imageUrl = null, modelOverride = null) {
  // Text-only when no imageUrl is given (identical wire body to before); OpenAI-style
  // multimodal content parts when one is.
  const content = imageUrl === null
    ? prompt
    : [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }];
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
  return j.choices?.[0]?.message?.content ?? '';
}

// The reasoning role: canonicaliser tie-breaks, Warwick-relevance, suggestions.
export async function reason(prompt) {
  if (GATEWAY) return gatewayChat('reason', prompt);
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
  return gatewayChat('answer', prompt, null, answerModel());
}

// The vision role: read an IMAGE (e.g. a photographed handwritten shopping list) plus a prompt.
// `imageUrl` is a data: or http(s): URL — the caller decides what it is willing to send.
//
// Deliberately NO fallback. The box path (`lightrag.generate`) is text-only, so falling back would
// hand a blind text model a prompt about an image it cannot see and invite an invented answer —
// exactly the failure mode a household shopping list must never have. With no gateway configured
// this throws instead. "Capable" is only proven at call time: a configured gateway without a
// vision-bound `fusion.vision` alias surfaces the gateway's own error, it is never papered over.
export async function vision(prompt, imageUrl) {
  if (!GATEWAY) {
    throw new Error(
      'fusion-gateway: no vision-capable gateway configured (set FUSION_GATEWAY_URL). ' +
      'Refusing to fall back to a text-only model for an image task.'
    );
  }
  if (typeof imageUrl !== 'string' || imageUrl === '') {
    throw new Error('fusion-gateway vision: an image reference (data: or http(s): URL) is required');
  }
  return gatewayChat('vision', prompt, imageUrl);
}

// extract/keyword/query are LightRAG-internal roles today (bound on the box). They move behind the
// same gateway when FUSION_GATEWAY_URL is set — LightRAG's LLM_BINDING_HOST points at it too.
export const gatewayConfigured = !!GATEWAY;
// A vision call has somewhere to go at all. Not a promise the bound model can see — see vision().
export const visionConfigured = !!GATEWAY;
