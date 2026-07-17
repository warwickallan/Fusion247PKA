// Fusion Tower — Postgres/Supabase TLS config builder.
//
// Mirrors the BUILD-002 doctrine: a real Supabase connection is verify-full with
// a PINNED CA (DATABASE_SSL_CA_FILE), never `rejectUnauthorized:false`. A local
// throwaway cluster (the integration proof substrate) speaks plaintext, so SSL is
// disabled there. This module decides which, from config, without ever holding a
// secret value (the CA is a PUBLIC certificate; the DB password lives in the
// connection string, not here).

import fs from 'node:fs';

/**
 * Build the `ssl` option for node-postgres Pool from config + connection string.
 *
 * Rules:
 *   - A local/loopback host (127.0.0.1 / localhost) => no TLS (dev cluster).
 *   - DATABASE_SSL_CA_FILE present => verify-full with that pinned CA.
 *   - Remote host without a pinned CA => still require TLS (sslmode in the URL),
 *     but we refuse to silently disable verification — we return `true` so libpq
 *     verifies against the system trust store rather than trusting blindly.
 *
 * @param {object} args
 * @param {string} args.connectionString
 * @param {string|null} [args.caFile]  path to a pinned CA PEM
 * @returns {false|true|{ca:string, rejectUnauthorized:true, minVersion:string}}
 */
export function buildSslConfig({ connectionString, caFile }) {
  const isLocal = /(@|\/\/)(127\.0\.0\.1|localhost)(:|\/)/i.test(connectionString ?? '')
    || /host=(127\.0\.0\.1|localhost)/i.test(connectionString ?? '');
  if (isLocal) return false; // throwaway local cluster: plaintext, no TLS

  if (caFile) {
    const ca = fs.readFileSync(caFile, 'utf8');
    return {
      ca,
      rejectUnauthorized: true, // verify-full: pinned CA must validate the chain
      minVersion: 'TLSv1.2',
    };
  }
  // Remote, no pinned CA: require TLS with default verification. Never disable it.
  return true;
}
