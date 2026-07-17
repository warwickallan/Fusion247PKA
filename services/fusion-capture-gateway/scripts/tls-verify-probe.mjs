// FU-1 verification probe — proves the worker's pg connection verifies the
// server certificate against the PINNED pooler CA (verify-full posture).
//
// Pattern of record: Vex's live-sign-off probe (scratchpad/vex-tls-probe.mjs
// shape) — inspects the actual socket pg opened. Prints TLS metadata + cert
// subject/issuer ONLY; every error is masked against the known secrets.
//
// EXPECTED (FU-1 closure): client_socket_encrypted: true, tls_protocol
// TLSv1.2+, cert_verified_by_client: true, authorization_error: null,
// query_ok: true.
//
// RUN (no secrets in argv; the env file carries the DSN):
//   node --env-file=C:\.fusion247\fusion-capture-gateway.env scripts/tls-verify-probe.mjs
//
// Optional: DATABASE_SSL_CA_FILE overrides the CA path (defaults to the
// committed certs/supabase-pooler-ca.pem). This probe opens its OWN
// connection — it never touches a running worker.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { buildPgSslConfig } from '../src/store/pgSslConfig.js';
import { loadConfig, buildSecretRedactor } from '../src/config.js';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CA = path.join(HERE, '..', 'certs', 'supabase-pooler-ca.pem');

const config = loadConfig();
const redact = buildSecretRedactor(config);
if (!config.databaseUrl) {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL not set (use --env-file)' }));
  process.exit(1);
}

const sslCfg = buildPgSslConfig({
  connectionString: config.databaseUrl,
  sslCaFile: config.databaseSslCaFile ?? DEFAULT_CA,
});

const client = new Client({
  connectionString: sslCfg.connectionString,
  ...(sslCfg.poolConfig ?? {}),
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const s = client.connection?.stream;
  const enc = Boolean(s && s.encrypted);
  const out = {
    mode: sslCfg.mode,
    stripped_dsn_ssl_params: sslCfg.strippedParams,
    client_socket_encrypted: enc,
  };
  if (enc) {
    out.tls_protocol = s.getProtocol?.();
    out.cipher = s.getCipher?.()?.name;
    out.cert_verified_by_client = s.authorized === true;
    out.authorization_error = s.authorizationError ? String(s.authorizationError) : null;
    const cert = s.getPeerCertificate?.(false) ?? {};
    out.peer_cert = {
      subject_cn: cert.subject?.CN ?? null,
      issuer_cn: cert.issuer?.CN ?? null,
      valid_to: cert.valid_to ?? null,
    };
  }
  await client.query('select 1');
  out.query_ok = true;
  out.ok = out.client_socket_encrypted === true && out.cert_verified_by_client === true;
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.ok ? 0 : 1;
} catch (err) {
  console.log(JSON.stringify({ ok: false, error_masked: redact(err && err.message), code: err && err.code }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
