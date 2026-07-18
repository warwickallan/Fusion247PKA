// Tower baton — signed, HONESTLY-LABELLED result envelopes.
//
// Copied self-contained from the frozen fusion-tower core/envelope.js (no import
// from the reactor tree). Every QA verdict Codex returns is wrapped in a
// canonicalised JSON envelope and signed with HMAC-SHA256 under the gpt_codex
// per-principal secret when present. HONESTY IS THE POINT: gpt_codex is ALWAYS
// openai-codex — NEVER xAI/Grok or any borrowed vendor. buildEnvelope() throws on
// a dishonest label. When no signing secret is configured the envelope is still
// built (honest but unsigned) — signing is integrity, not a gate.

import crypto from 'node:crypto';

// The honest provider slug per principal — the anti-spoof registry.
export const HONEST_PROVIDER = Object.freeze({
  larry: 'anthropic-claude-code',
  gpt_codex: 'openai-codex', // NEVER 'xai-grok'. OpenAI/Codex, honestly labelled.
  warwick: 'human',
  tower: 'fusion-tower',
});

const FORBIDDEN_CODEX_LABELS = Object.freeze([
  'xai-grok', 'grok', 'xai', 'anthropic', 'anthropic-claude-code', 'claude', 'gemini', 'google',
]);

/** Deterministic RFC-8785-style canonicalisation (sufficient subset). */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`);
  return `{${parts.join(',')}}`;
}

/** Assert a principal is labelled honestly for a provider. Throws on a spoof. */
export function assertHonestLabel(principal, provider) {
  const expected = HONEST_PROVIDER[principal];
  if (!expected) throw new Error(`unknown principal for honest-label check: ${principal}`);
  if (provider !== expected) {
    throw new Error(`dishonest agent label: ${principal} must be provider "${expected}", got "${provider}"`);
  }
  if (principal === 'gpt_codex' && FORBIDDEN_CODEX_LABELS.includes(String(provider).toLowerCase())) {
    throw new Error('honesty violation: gpt_codex is OpenAI/Codex and must never be labelled xAI/Grok');
  }
}

/** Build the unsigned envelope core. Fields are pointer/metadata only — never a secret. */
export function buildEnvelope({
  principal, provider, modelId = null, checkpointId = null, reviewedHead = null,
  promptFingerprint = null, payload, ts = new Date().toISOString(),
}) {
  const prov = provider ?? HONEST_PROVIDER[principal];
  assertHonestLabel(principal, prov); // hard anti-spoof gate
  return {
    schema: 'tower-baton.qa-envelope/v1',
    agent: principal,
    provider: prov,
    model_id: modelId,
    checkpoint_id: checkpointId,
    reviewed_head: reviewedHead,
    prompt_fingerprint: promptFingerprint,
    ts,
    payload,
  };
}

/** Sign an envelope → { envelope, signature } (detached hex HMAC-SHA256). */
export function signEnvelope(envelope, secret) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('signEnvelope: a non-empty signing secret is required');
  }
  const signature = crypto.createHmac('sha256', secret).update(canonicalize(envelope)).digest('hex');
  return { envelope, signature };
}

/** Verify a detached signature (constant-time) + re-assert the honest label. */
export function verifyEnvelope(envelope, signature, secret) {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof signature !== 'string' || signature.length === 0) return false;
  try {
    assertHonestLabel(envelope.agent, envelope.provider);
  } catch {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(canonicalize(envelope)).digest('hex');
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Build + (optionally) sign a verdict envelope. Unsigned when secret is absent. */
export function makeSignedVerdict(args, secret) {
  const envelope = buildEnvelope(args);
  if (typeof secret === 'string' && secret.length > 0) return signEnvelope(envelope, secret);
  return { envelope, signature: null };
}
