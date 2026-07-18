// BUILD-002 FU-1 -- the trust-anchor PIN GUARD.
//
// This test LOCKS the committed Supabase session-pooler CA bundle
// (certs/supabase-pooler-ca.pem). It is the pin: if the file is ever silently
// changed -- a different bundle committed, a cert swapped, a private key
// slipped in -- this test FAILS ON PURPOSE.
//
// If Supabase legitimately ROTATES its CA, that is not a bug in this test: the
// rotation must be handled DELIBERATELY. Someone re-runs
// scripts/fu1-ca-crosscheck.mjs against the fresh dashboard download
// (prod-ca-2021.crt), confirms the new anchor is authentic, and then updates
// the two EXPECTED_* fingerprints below in the same reviewed change. The pin
// must never move by accident and never move without that review.
//
// This does NOT duplicate test/tlsTransportGuards.test.js. That file grep-gates
// runtime SOURCE (no rejectUnauthorized:false, no bare require-mode sslmode,
// claim path stays intake_transport-blind) and asserts the CA file, WHEN
// PRESENT, is a cert bundle and not a private key. THIS file instead parses the
// bundle cryptographically and pins its exact identity + chain shape. The
// one-line private-key assert here is intentional belt-and-braces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { X509Certificate, generateKeyPairSync } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CA_PATH = path.join(__dirname, '..', 'certs', 'supabase-pooler-ca.pem');

// The PIN. These are X509Certificate.fingerprint256 over the DER encoding,
// lowercased with the colons stripped. Sourced from the committed bundle and
// recorded in the PEM header + the FU-1 closure-evidence note. Changing either
// value is changing the trust anchor -- do it only with a reviewed cross-check.
const EXPECTED_INTERMEDIATE_CN = 'Supabase Intermediate 2021 CA';
const EXPECTED_ROOT_CN = 'Supabase Root 2021 CA';
const EXPECTED_INTERMEDIATE_FP =
  '303b0a59bbc8d77e967fbed20b3fe68ec5d7d391c3081ece9936efceef0a55ea';
const EXPECTED_ROOT_FP =
  '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';

// X509Certificate.subject / .issuer are multiline RFC-4514-ish strings
// ("C=US\nST=...\nCN=Supabase Root 2021 CA"). Pull the CN line out.
const cnOf = (dn) => {
  const line = dn.split('\n').find((l) => l.startsWith('CN='));
  return line ? line.slice(3) : null;
};

// fingerprint256 comes back uppercase, colon-separated ("30:3B:..."). Normalise
// to the lowercase, colon-free form the pin is recorded in.
const normFp = (fp) => fp.replace(/:/g, '').toLowerCase();

const readPem = () => fs.readFileSync(CA_PATH, 'utf8');
const certBlocks = (pem) =>
  pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];

test('pin: the committed pooler CA file exists', () => {
  assert.ok(fs.existsSync(CA_PATH), `${CA_PATH} is missing -- the FU-1 trust anchor must be committed`);
});

test('pin: the bundle contains EXACTLY two certificates', () => {
  const blocks = certBlocks(readPem());
  assert.equal(
    blocks.length,
    2,
    `expected exactly 2 CA certificates (intermediate + root), found ${blocks.length}`,
  );
});

test('pin: subject CNs are exactly the two Supabase 2021 CAs', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));
  assert.equal(cnOf(intermediate.subject), EXPECTED_INTERMEDIATE_CN, 'cert 1 subject CN drifted from the pinned intermediate');
  assert.equal(cnOf(root.subject), EXPECTED_ROOT_CN, 'cert 2 subject CN drifted from the pinned root');
});

test('pin: each certificate fingerprint256 matches the recorded anchor (this is the pin)', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));
  assert.equal(
    normFp(intermediate.fingerprint256),
    EXPECTED_INTERMEDIATE_FP,
    'INTERMEDIATE fingerprint changed -- CA rotation or tampering. Do NOT edit the expected value to make this pass without a reviewed dashboard cross-check.',
  );
  assert.equal(
    normFp(root.fingerprint256),
    EXPECTED_ROOT_FP,
    'ROOT fingerprint changed -- CA rotation or tampering. Do NOT edit the expected value to make this pass without a reviewed dashboard cross-check.',
  );
});

test('pin: the chain is cryptographically valid (intermediate SIGNED BY the pinned root; root self-signature valid)', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));

  // TRUST BASIS: cryptographic SIGNATURE verification, not name matching.
  // X509Certificate.verify(publicKey) returns true iff this certificate was
  // signed by the private key corresponding to that public key. A same-name
  // FORGED certificate (an attacker who sets subject/issuer CN to the Supabase
  // strings but signs with their own key) would pass a name check and FAIL
  // here. These two asserts are the load-bearing trust anchor.
  assert.equal(
    intermediate.verify(root.publicKey),
    true,
    'the intermediate is NOT signed by the pinned root public key -- chain is cryptographically broken (a forged/rotated cert)',
  );
  assert.equal(
    root.verify(root.publicKey),
    true,
    "the root's self-signature does NOT verify against its own public key -- it is not a valid trust anchor",
  );

  // COMPLEMENTARY sanity (names + CA flags). These are NOT the trust basis --
  // they cannot detect a same-name forgery -- but they catch an accidentally
  // reshaped bundle early and keep the intent readable.
  assert.equal(
    cnOf(intermediate.issuer),
    EXPECTED_ROOT_CN,
    'the intermediate issuer CN drifted from the pinned root CN',
  );
  assert.equal(
    cnOf(root.issuer),
    cnOf(root.subject),
    'the root issuer CN != subject CN -- not self-signed by name',
  );
  assert.equal(intermediate.ca, true, 'the intermediate is not marked as a CA');
  assert.equal(root.ca, true, 'the root is not marked as a CA');
});

test('pin (negative): a WRONG public key does NOT verify the intermediate -- proves the signature check is real', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));

  // Two independently-generated keypairs stand in for an attacker's key. The
  // pinned certs are RSA; we reject both an unrelated RSA key and an unrelated
  // EC key. If verify() were a no-op / tautology these would (wrongly) pass.
  const wrongRsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  const wrongEc = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey;

  assert.equal(intermediate.verify(wrongRsa), false, 'intermediate wrongly verified against an unrelated RSA key');
  assert.equal(intermediate.verify(wrongEc), false, 'intermediate wrongly verified against an unrelated EC key');
  assert.equal(root.verify(wrongRsa), false, 'root wrongly verified against an unrelated RSA key');

  // And the intermediate is NOT self-signed: it does not verify against its own
  // public key. This proves verify() actually checks the signer, not merely
  // "any well-formed key".
  assert.equal(
    intermediate.verify(intermediate.publicKey),
    false,
    'intermediate wrongly verified against its OWN key -- verify() is not checking the true signer',
  );
});

test('pin (negative): SAME-NAME forgery -- identical CN with a different key passes the name check but FAILS signature verification', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));

  // This is the exact forgery class TQA-001 named. An attacker fully controls
  // the CN STRINGS in a certificate they mint, so a forged "Supabase Root 2021
  // CA" trivially satisfies every CN-based check:
  const forgedRootSubjectCn = EXPECTED_ROOT_CN; // attacker sets this freely
  assert.equal(cnOf(intermediate.issuer), forgedRootSubjectCn, 'name-only issuer check (attacker can satisfy this)');
  assert.equal(forgedRootSubjectCn, cnOf(root.subject), 'name-only subject check (attacker can satisfy this)');

  // What the attacker CANNOT forge is the root private key. Their forged root
  // carries a different keypair; the pinned intermediate was signed by the REAL
  // root, so it does not verify against the forged root's public key. We model
  // the forged root's key with an independently-generated keypair.
  //
  // NOTE ON SCOPE: node's stdlib crypto cannot MINT a full X509Certificate
  // object (no cert-generation API; that needs openssl CLI or a third-party
  // lib, neither guaranteed in CI). Per the fix brief this unrelated-public-key
  // model is the acceptable minimum: it exercises the identical code path --
  // X509Certificate.verify(<forged root key>) -- and proves that name equality
  // is insufficient and the signature is what establishes trust.
  const forgedRootPublicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  assert.equal(
    intermediate.verify(forgedRootPublicKey),
    false,
    'a same-name forged root (different key) wrongly verified the intermediate -- name matching is NOT a trust basis',
  );
});

test('pin: NO private key block is ever present in the CA file (belt-and-braces)', () => {
  assert.ok(
    !/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(readPem()),
    'a PRIVATE KEY block in certs/ would be a committed secret -- hard failure',
  );
});
