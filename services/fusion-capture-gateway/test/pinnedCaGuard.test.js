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
import { X509Certificate } from 'node:crypto';

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

test('pin: the chain shape is intact (intermediate <- root, root self-signed, both CAs)', () => {
  const [intermediate, root] = certBlocks(readPem()).map((b) => new X509Certificate(b));
  // The intermediate is issued by the root.
  assert.equal(
    cnOf(intermediate.issuer),
    EXPECTED_ROOT_CN,
    'the intermediate is no longer issued by the pinned root -- chain broken',
  );
  // The root is self-signed (issuer CN == subject CN).
  assert.equal(
    cnOf(root.issuer),
    cnOf(root.subject),
    'the root is not self-signed -- it is not a trust anchor',
  );
  // Both must be CA certificates (basicConstraints cA:TRUE).
  assert.equal(intermediate.ca, true, 'the intermediate is not marked as a CA');
  assert.equal(root.ca, true, 'the root is not marked as a CA');
});

test('pin: NO private key block is ever present in the CA file (belt-and-braces)', () => {
  assert.ok(
    !/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(readPem()),
    'a PRIVATE KEY block in certs/ would be a committed secret -- hard failure',
  );
});
