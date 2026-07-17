// BUILD-002 WP1 — service-credential resolver + PostgREST header builder.
//
// PURE + PORTABLE: no I/O, no logging, no wall-clock, and NO secret value is
// ever placed in a thrown message. Runs unchanged under Deno (imported by
// index.ts) and under Node `node --test` (services/.../test/credential.test.js).
//
// WHY THIS EXISTS (GPT-BUILD-002-WP1-REVIEW-0001, correction 1): Supabase is
// migrating from LEGACY JWT `service_role` keys to MODERN OPAQUE `sb_secret_…`
// API keys. The two must be sent to PostgREST DIFFERENTLY:
//
//   * LEGACY service_role (a JWT): PostgREST derives the role from the JWT, so
//     the key is sent in BOTH `apikey` AND `Authorization: Bearer` (its
//     historical dual-header shape).
//   * MODERN sb_secret_ (opaque, NOT a JWT): it is an API key only and MUST be
//     sent on `apikey` ONLY. Putting an opaque key in `Authorization: Bearer`
//     makes GoTrue/PostgREST attempt to parse it as a JWT and REJECT the call.
//
// The original index.ts returned a BARE STRING and put it in both headers — safe
// for a legacy JWT, WRONG for a modern opaque key. This module returns an
// explicit DESCRIPTOR that records exactly how the emitted headers must be
// shaped, and a builder that shapes them. index.ts wires env → descriptor, and
// rpc() builds headers from the descriptor.

/**
 * @typedef {Object} CredentialDescriptor
 * @property {string}  credential  the secret value (never logged / never thrown).
 * @property {true}    apikey      always emitted on the `apikey` header.
 * @property {boolean} bearer      also emit `Authorization: Bearer <credential>`.
 * @property {'service_role_key'|'secret_keys_default'} source  provenance (safe).
 */

/**
 * Resolve the service credential from the auto-injected Supabase env values.
 *
 * PRECEDENCE (documented, unchanged from the original): the LEGACY
 * `SUPABASE_SERVICE_ROLE_KEY` WINS when present — it is unambiguous and
 * backward-compatible. Only when it is absent do we parse `SUPABASE_SECRET_KEYS`
 * and select the EXPLICITLY NAMED `default` key (never "the first plausible
 * value" — an unnamed guess is exactly the ambiguity that fails closed below).
 *
 * FAIL CLOSED: missing / malformed JSON / non-object / no string `default` all
 * THROW a GENERIC error (no key content, no key names beyond the env-var name)
 * so the caller NEVER proceeds to call the RPC with a guessed credential.
 *
 * @param {{ serviceRoleKey?: string|undefined, secretKeys?: string|undefined }} env
 * @returns {CredentialDescriptor}
 */
export function resolveServiceCredential({ serviceRoleKey, secretKeys } = {}) {
  // 1. Legacy JWT service_role key wins (precedence).
  if (typeof serviceRoleKey === 'string' && serviceRoleKey.length > 0) {
    return Object.freeze({
      credential: serviceRoleKey,
      apikey: true,
      bearer: true, // JWT: PostgREST reads the role from the Bearer token.
      source: 'service_role_key',
    });
  }

  // 2. Modern opaque sb_secret_ keys: parse + select the NAMED `default`.
  if (typeof secretKeys === 'string' && secretKeys.length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(secretKeys);
    } catch {
      // Note: the raw string is NOT included — it holds secret key material.
      throw new Error('service credential: SUPABASE_SECRET_KEYS is not valid JSON');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('service credential: SUPABASE_SECRET_KEYS is not a JSON object');
    }
    const chosen = parsed.default;
    if (typeof chosen !== 'string' || chosen.length === 0) {
      // We ONLY accept the explicitly named `default`. Anything else — an object
      // shape we do not recognise, a missing `default`, or a non-string value —
      // is AMBIGUOUS and fails closed rather than guessing a key.
      throw new Error('service credential: SUPABASE_SECRET_KEYS has no string "default" key');
    }
    return Object.freeze({
      credential: chosen,
      apikey: true,
      bearer: false, // opaque key: apikey ONLY — a Bearer would be parsed as a JWT.
      source: 'secret_keys_default',
    });
  }

  // 3. Nothing usable in env → fail closed.
  throw new Error(
    'service credential: neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_SECRET_KEYS is set',
  );
}

/**
 * Build the PostgREST request headers for a resolved credential descriptor.
 * `apikey` is ALWAYS set; `Authorization: Bearer` is set ONLY when the
 * descriptor says so (legacy JWT). Extra headers (e.g. content-type) merge in.
 *
 * @param {CredentialDescriptor} descriptor
 * @param {Record<string,string>} [base]  extra headers to merge (never a secret).
 * @returns {Record<string,string>}
 */
export function buildRpcHeaders(descriptor, base = {}) {
  if (!descriptor || typeof descriptor.credential !== 'string' || descriptor.credential.length === 0) {
    throw new Error('buildRpcHeaders: invalid credential descriptor');
  }
  const headers = { ...base, apikey: descriptor.credential };
  if (descriptor.bearer) {
    headers.authorization = `Bearer ${descriptor.credential}`;
  }
  return headers;
}
