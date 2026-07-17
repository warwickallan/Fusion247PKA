// BUILD-002 WP1 — portable (Node `node --test`, no Deno) unit suite for the
// service-credential resolver + PostgREST header builder
// (supabase/functions/fcg-webhook-intake/credential.js).
//
// GPT-BUILD-002-WP1-REVIEW-0001 correction 1: legacy JWT service_role keys and
// modern OPAQUE sb_secret_ keys must be sent to PostgREST with DIFFERENT headers.
// These tests pin the EXACT emitted headers for every supported shape and prove
// every malformed/ambiguous shape FAILS CLOSED without leaking key material.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveServiceCredential,
  buildRpcHeaders,
} from '../../../supabase/functions/fcg-webhook-intake/credential.js';

// Synthetic, NOT-real values shaped to dodge the repo secret-scanner while
// staying unique + grep-able. The resolver treats the legacy credential
// OPAQUELY (it only checks presence + sets the JWT header shape), so the test
// value need not — and deliberately does not — look like a real base64url JWT;
// what matters is the emitted-header shape (apikey + Authorization: Bearer).
const LEGACY_JWT = 'legacy~service~role~key~not~real~001';
const SB_SECRET_DEFAULT = 'sb_secret_default~not~real~001';
const SB_SECRET_OTHER = 'sb_secret_other~not~real~002';

const headers = (descriptor) => buildRpcHeaders(descriptor, { 'content-type': 'application/json' });

// ── Legacy JWT service_role: apikey AND Authorization: Bearer (its historic dual shape).
test('legacy SUPABASE_SERVICE_ROLE_KEY (JWT) → apikey + Authorization: Bearer, exact headers', () => {
  const d = resolveServiceCredential({ serviceRoleKey: LEGACY_JWT, secretKeys: undefined });
  assert.equal(d.source, 'service_role_key');
  assert.equal(d.bearer, true);
  assert.deepEqual(headers(d), {
    'content-type': 'application/json',
    apikey: LEGACY_JWT,
    authorization: `Bearer ${LEGACY_JWT}`,
  });
});

// ── Modern opaque sb_secret_ (named `default`): apikey ONLY, NO Authorization.
test('modern SUPABASE_SECRET_KEYS default (opaque sb_secret) → apikey ONLY, no Authorization', () => {
  const d = resolveServiceCredential({
    serviceRoleKey: undefined,
    secretKeys: JSON.stringify({ default: SB_SECRET_DEFAULT }),
  });
  assert.equal(d.source, 'secret_keys_default');
  assert.equal(d.bearer, false);
  const h = headers(d);
  assert.deepEqual(h, { 'content-type': 'application/json', apikey: SB_SECRET_DEFAULT });
  assert.ok(!('authorization' in h), 'an opaque key must NOT be sent as a Bearer JWT');
});

// ── Multiple named keys: the EXPLICITLY NAMED `default` is selected; others ignored.
test('multiple named secret keys → the named `default` is selected, others ignored (never "first plausible")', () => {
  // Put a plausible non-default FIRST to prove we do not pick by iteration order.
  const d = resolveServiceCredential({
    serviceRoleKey: undefined,
    secretKeys: JSON.stringify({ readonly: SB_SECRET_OTHER, default: SB_SECRET_DEFAULT, publishable: 'sb_publishable~x' }),
  });
  assert.equal(d.credential, SB_SECRET_DEFAULT);
  const h = headers(d);
  assert.equal(h.apikey, SB_SECRET_DEFAULT);
  assert.ok(!Object.values(h).includes(SB_SECRET_OTHER), 'the non-default key is never emitted');
});

// ── Precedence: legacy wins even when both are present.
test('precedence: legacy SUPABASE_SERVICE_ROLE_KEY wins when both are present', () => {
  const d = resolveServiceCredential({
    serviceRoleKey: LEGACY_JWT,
    secretKeys: JSON.stringify({ default: SB_SECRET_DEFAULT }),
  });
  assert.equal(d.source, 'service_role_key');
  assert.equal(d.credential, LEGACY_JWT);
  assert.equal(d.bearer, true);
});

// ── FAIL CLOSED cases (6 total across the suite): none call an RPC, none leak key content.
function assertFailsClosed(env, label, forbidden = []) {
  let threw;
  assert.throws(() => resolveServiceCredential(env), (err) => { threw = err; return true; }, `${label}: must throw`);
  const msg = String(threw && threw.message);
  for (const secret of forbidden) {
    assert.ok(!msg.includes(secret), `${label}: thrown message must not contain key material`);
  }
}

test('FAIL CLOSED 1/6: missing `default` in the secret-keys object → throws, no key content', () => {
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: JSON.stringify({ readonly: SB_SECRET_OTHER }) },
    'missing default',
    [SB_SECRET_OTHER],
  );
});

test('FAIL CLOSED 2/6: malformed JSON → throws, raw (secret-bearing) string never echoed', () => {
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: `{ default: ${SB_SECRET_DEFAULT}` }, // not valid JSON
    'malformed JSON',
    [SB_SECRET_DEFAULT],
  );
});

test('FAIL CLOSED 3/6: unknown credential format (JSON array, not an object) → throws', () => {
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: JSON.stringify([SB_SECRET_DEFAULT]) },
    'array shape',
    [SB_SECRET_DEFAULT],
  );
});

test('FAIL CLOSED 4/6: unknown credential format (`default` is a nested object, not a string) → throws', () => {
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: JSON.stringify({ default: { api_key: SB_SECRET_DEFAULT } }) },
    'nested-object default',
    [SB_SECRET_DEFAULT],
  );
});

test('FAIL CLOSED 5/6: neither env var set → throws (no credential at all)', () => {
  assertFailsClosed({ serviceRoleKey: undefined, secretKeys: undefined }, 'nothing set');
  assertFailsClosed({}, 'empty env object');
  assertFailsClosed({ serviceRoleKey: '', secretKeys: '' }, 'empty strings');
});

test('FAIL CLOSED 6/6: JSON null / empty-string `default` → throws (ambiguous, no guess)', () => {
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: JSON.stringify(null) },
    'JSON null',
  );
  assertFailsClosed(
    { serviceRoleKey: undefined, secretKeys: JSON.stringify({ default: '' }) },
    'empty default',
  );
});

// ── The builder itself rejects a broken descriptor (defensive).
test('buildRpcHeaders rejects an invalid descriptor', () => {
  assert.throws(() => buildRpcHeaders(null), /invalid credential descriptor/);
  assert.throws(() => buildRpcHeaders({ credential: '' }), /invalid credential descriptor/);
});
