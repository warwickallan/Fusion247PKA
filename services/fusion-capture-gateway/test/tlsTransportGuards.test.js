// BUILD-002 WP1 — static grep-gates (test plan §6 + drain contract I8).
//
// Cheap, fast, CI-enforced (runs in the default no-DB suite):
//   1. `rejectUnauthorized: false` must never appear in runtime source — it
//      silently disables ALL certificate verification (Vex-gate failure).
//   2. A bare require-mode `sslmode` DSN must never appear in runtime source or
//      .env.example — in node-postgres it does NOT verify the CA (Pax Q5).
//      verify-full (+ sslrootcert or the explicit ssl object) is the only
//      acceptable spelling for real Supabase.
//   3. I8: no worker/store/claim logic may read `intake_transport` — the
//      0006 column is observability-only; the claim loop stays transport-blind
//      (wp1-drain-contract.md §2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(SERVICE_ROOT, '..', '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// The gate targets CODE, not the explanatory comments that document the traps
// themselves — strip line + block comments before matching.
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const srcFiles = walk(path.join(SERVICE_ROOT, 'src')).filter((f) => f.endsWith('.js'));
const edgeFiles = walk(path.join(REPO_ROOT, 'supabase', 'functions'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
const scriptFiles = fs.existsSync(path.join(SERVICE_ROOT, 'scripts'))
  ? walk(path.join(SERVICE_ROOT, 'scripts')).filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))
  : [];
const runtimeFiles = [...srcFiles, ...edgeFiles, ...scriptFiles];

// The ONE sanctioned exception: the TOFU chain-extraction script must complete
// an unverified handshake to OBSERVE the not-yet-pinned chain — that is its
// entire purpose, it moves no data, and its output is cross-checked against the
// dashboard CA (wp1-safe-cutover.md morning action). Everything else is gated.
const EXTRACTION_EXCEPTION = path.join(SERVICE_ROOT, 'scripts', 'tls-extract-ca.mjs');

test('guard: rejectUnauthorized:false never appears in any runtime source (src/, scripts/, supabase/functions/)', () => {
  assert.ok(runtimeFiles.length > 10, 'sanity: the walker found the source tree');
  for (const file of runtimeFiles.filter((f) => f !== EXTRACTION_EXCEPTION)) {
    const content = stripJsComments(fs.readFileSync(file, 'utf8'));
    assert.doesNotMatch(
      content,
      /rejectUnauthorized\s*:\s*false/,
      `${path.relative(REPO_ROOT, file)} disables certificate verification — Vex-gate failure`,
    );
  }
});

test('guard: no bare require-mode sslmode DSN in runtime source or .env.example (it does NOT verify the CA in node-postgres)', () => {
  const filesToCheck = [...runtimeFiles, path.join(SERVICE_ROOT, '.env.example')];
  for (const file of filesToCheck) {
    const raw = fs.readFileSync(file, 'utf8');
    const content = file.endsWith('.env.example') ? raw : stripJsComments(raw);
    // Match the DSN-parameter spelling specifically ("sslmode=require"), which
    // is exactly the trap: encrypted but UNVERIFIED under pg-connection-string,
    // and no-CA-validation under uselibpqcompat.
    assert.doesNotMatch(
      content,
      /sslmode=require\b/,
      `${path.relative(REPO_ROOT, file)} carries a bare require-mode DSN — use sslmode=verify-full + sslrootcert (or DATABASE_SSL_CA_FILE)`,
    );
  }
});

test('guard (I8): worker/store claim paths never read intake_transport — the claim loop stays transport-blind', () => {
  const claimPathFiles = [
    path.join(SERVICE_ROOT, 'src', 'worker.js'),
    path.join(SERVICE_ROOT, 'src', 'intake.js'),
    path.join(SERVICE_ROOT, 'src', 'store', 'operationalStore.js'),
    path.join(SERVICE_ROOT, 'src', 'store', 'postgresOperationalStore.js'),
    path.join(SERVICE_ROOT, 'src', 'core', 'states.js'),
    path.join(SERVICE_ROOT, 'src', 'core', 'retryPolicy.js'),
    path.join(SERVICE_ROOT, 'src', 'live', 'liveRunner.js'),
  ];
  for (const file of claimPathFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      !content.includes('intake_transport'),
      `${path.relative(REPO_ROOT, file)} references intake_transport — the 0006 column is observability-only; no worker/claim/retry logic may branch on it (I8)`,
    );
  }
});

test('guard: the pinned pooler CA, when present, is a certificate bundle and NOT a private key', () => {
  const caPath = path.join(SERVICE_ROOT, 'certs', 'supabase-pooler-ca.pem');
  if (!fs.existsSync(caPath)) return; // FU-1 extraction may not have run yet in a fork
  const pem = fs.readFileSync(caPath, 'utf8');
  assert.match(pem, /-----BEGIN CERTIFICATE-----/, 'the pinned file must contain a certificate');
  assert.ok(!/PRIVATE KEY/.test(pem), 'a private key in certs/ would be a committed secret — hard failure');
});
