// Fusion Tower — signed, HONESTLY-LABELLED result envelopes.
//
// Every turn result an agent returns is wrapped in a canonicalised JSON envelope
// and signed with HMAC-SHA256 under a per-principal shared secret held by the
// Tower (Pax brief Item 5). Signing gives integrity + authenticity within the
// single-host shared-secret boundary — sufficient for WP0.
//
// HONESTY IS THE POINT. A signature over a FALSE vendor label is worse than no
// signature: it lends cryptographic weight to a lie. So the provider label is
// pinned to the same known-honest set the DB CHECK (agent_identity_provider_
// honest_chk) enforces, and gpt_codex is ALWAYS openai-codex — NEVER xai-grok or
// any other borrowed vendor. buildEnvelope() throws on a dishonest label.

import crypto from 'node:crypto';

// The honest provider slug per principal — identical to the migration 0001 seed
// rows. This is the anti-spoof registry: it is the ONLY place a principal→provider
// mapping is authored, and it is asserted on every envelope.
export const HONEST_PROVIDER = Object.freeze({
  larry: 'anthropic-claude-code',
  gpt_codex: 'openai-codex', // NEVER 'xai-grok'. OpenAI/Codex, honestly labelled.
  warwick: 'human',
  tower: 'fusion-tower',
});

// Explicit deny-list of vendor labels that must NEVER attach to gpt_codex. Belt
// and braces alongside the positive HONEST_PROVIDER pin.
const FORBIDDEN_CODEX_LABELS = Object.freeze([
  'xai-grok', 'grok', 'xai', 'anthropic', 'anthropic-claude-code', 'claude',
  'gemini', 'google',
]);

/**
 * RFC-8785-style canonicalisation (sufficient subset): deterministic key order,
 * no insignificant whitespace, arrays preserve order, primitives via JSON. A
 * re-serialisation cannot change the bytes, so the signature stays stable.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Assert a principal is labelled honestly for a provider. Throws on a spoof.
 */
export function assertHonestLabel(principal, provider) {
  const expected = HONEST_PROVIDER[principal];
  if (!expected) {
    throw new Error(`unknown principal for honest-label check: ${principal}`);
  }
  if (provider !== expected) {
    throw new Error(
      `dishonest agent label: ${principal} must be provider "${expected}", got "${provider}"`,
    );
  }
  if (principal === 'gpt_codex' && FORBIDDEN_CODEX_LABELS.includes(String(provider).toLowerCase())) {
    throw new Error('honesty violation: gpt_codex is OpenAI/Codex and must never be labelled xAI/Grok');
  }
}

/**
 * Build the unsigned envelope core. Fields are pointer/metadata only — NEVER
 * governed content or secrets (evidence-pointer doctrine).
 *
 * @param {object} args
 * @param {string} args.principal      honest signer principal (larry|gpt_codex|tower|warwick)
 * @param {string} [args.provider]     provider slug; defaults to the honest one for the principal
 * @param {string} [args.modelId]      the concrete model id (informational, honest)
 * @param {string} args.runId
 * @param {number} args.ordinal        the turn ordinal this result answers
 * @param {string} [args.sourceEventId]
 * @param {string} [args.headSha]
 * @param {object} args.payload        schema-conforming structured result (pointers/metadata)
 * @param {string} [args.ts]           ISO timestamp; defaults to now
 */
export function buildEnvelope({
  principal,
  provider,
  modelId = null,
  runId,
  ordinal,
  sourceEventId = null,
  headSha = null,
  payload,
  ts = new Date().toISOString(),
}) {
  const prov = provider ?? HONEST_PROVIDER[principal];
  assertHonestLabel(principal, prov); // hard anti-spoof gate
  return {
    schema: 'ftw.turn-envelope/v1',
    agent: principal,
    provider: prov,
    model_id: modelId,
    run_id: runId,
    ordinal,
    source_event_id: sourceEventId,
    head_sha: headSha,
    ts,
    payload,
  };
}

/**
 * Sign an envelope. Returns { envelope, signature } where signature is a hex
 * HMAC-SHA256 over the canonicalised envelope bytes. The secret never leaves
 * this call; only the detached hex signature is returned/stored.
 */
export function signEnvelope(envelope, secret) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('signEnvelope: a non-empty signing secret is required');
  }
  const bytes = canonicalize(envelope);
  const signature = crypto.createHmac('sha256', secret).update(bytes).digest('hex');
  return { envelope, signature };
}

/**
 * Verify a detached signature over an envelope. Constant-time compare. Also
 * re-asserts the honest label so a tampered provider slug fails verification even
 * if the signature somehow matched.
 */
export function verifyEnvelope(envelope, signature, secret) {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof signature !== 'string' || signature.length === 0) return false;
  try {
    assertHonestLabel(envelope.agent, envelope.provider);
  } catch {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(canonicalize(envelope))
    .digest('hex');
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Convenience: build + sign in one call, honest-label enforced.
 */
export function makeSignedResult(args, secret) {
  const envelope = buildEnvelope(args);
  return signEnvelope(envelope, secret);
}
