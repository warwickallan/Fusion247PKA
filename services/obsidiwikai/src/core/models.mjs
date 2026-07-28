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

async function gatewayChat(role, prompt, imageUrl = null) {
  // Text-only when no imageUrl is given (identical wire body to before); OpenAI-style
  // multimodal content parts when one is.
  const content = imageUrl === null
    ? prompt
    : [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }];
  const res = await fetch(`${GATEWAY.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(GATEWAY_KEY ? { Authorization: `Bearer ${GATEWAY_KEY}` } : {}) },
    body: JSON.stringify({ model: ROLE_ALIAS[role], messages: [{ role: 'user', content }], stream: false }),
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
