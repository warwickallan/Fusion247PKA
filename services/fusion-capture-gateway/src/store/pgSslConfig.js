// FU-1 (Vex live sign-off V-01, MANDATED) — verify-full TLS for the worker's
// Postgres connection with a PINNED Supabase pooler CA.
//
// Source of truth: Builds/BUILD-002-.../Security/wp0-live-signoff-2026-07-17.md
// (V-01 remediation) + Pax WP1 research brief Q5 (node-postgres SSL traps).
//
// THE TWO SUPPORTED CONFIG FORMS (Pax Q5 — pick ONE, never mix):
//
//   A. EXPLICIT ssl OBJECT (preferred — this module): set
//      DATABASE_SSL_CA_FILE=<path to the pinned CA PEM>. At startup the CA file
//      is read once and the pool gets `ssl: { ca, rejectUnauthorized: true }`.
//      Node's TLS layer then verifies BOTH the chain (against the pinned CA
//      only) AND the hostname (checkServerIdentity) — the verify-full
//      equivalent. CRITICAL TRAP (node-postgres, verbatim-documented): if the
//      connection string ALSO carries any of sslmode/sslrootcert/sslcert/
//      sslkey, the config-object `ssl` is REPLACED and silently lost. This
//      module therefore STRIPS every ssl-related query param from the DSN when
//      the explicit form is active — the pinned CA always wins.
//
//   B. DSN PARAMS (fallback, no code involvement): leave DATABASE_SSL_CA_FILE
//      unset and spell the DSN
//        ?sslmode=verify-full&sslrootcert=<path to the pinned CA PEM>
//      (with or without uselibpqcompat=true — under BOTH pg-connection-string
//      interpretations this spelling verifies chain + hostname). A bare
//      `sslmode=require` DSN does NOT verify the CA in node-postgres (libpq
//      compat mode skips CA validation by design; non-compat maps it to
//      rejectUnauthorized:false) and is a Vex-gate failure — the static guard
//      in test/tlsTransportGuards.test.js greps it out of existence.
//
// The pinned CA ships at services/fusion-capture-gateway/certs/
// supabase-pooler-ca.pem (a PUBLIC certificate, not a secret — see the header
// inside the PEM for its TOFU provenance + the dashboard cross-check action).

import fs from 'node:fs';

// Query params that make node-postgres replace a config-object `ssl` (the
// documented trap) — every one of them is stripped when the explicit form runs.
const DSN_SSL_PARAMS = Object.freeze([
  'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword',
  'sslnegotiation', 'uselibpqcompat', 'ssl',
]);

/**
 * Build the {connectionString, poolConfig} pair for createPostgresOperationalStore.
 *
 * @param {object} args
 * @param {string} args.connectionString  the DATABASE_URL (SECRET — never logged here).
 * @param {string} [args.sslCaFile]       DATABASE_SSL_CA_FILE; when set, activates
 *                 the explicit verify-full form with the pinned CA.
 * @param {(p: string) => string} [args.readFile]  injection seam for tests.
 * @returns {{ connectionString: string, poolConfig: (object|undefined),
 *             mode: 'explicit-pinned-ca'|'dsn-passthrough', strippedParams: string[] }}
 */
export function buildPgSslConfig({ connectionString, sslCaFile, readFile } = {}) {
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('buildPgSslConfig: connectionString required');
  }

  if (typeof sslCaFile !== 'string' || sslCaFile.length === 0) {
    // Form B / plain: the DSN speaks for itself (verify-full + sslrootcert, or
    // a local throwaway with no TLS at all). Nothing to do here.
    return { connectionString, poolConfig: undefined, mode: 'dsn-passthrough', strippedParams: [] };
  }

  const read = readFile ?? ((p) => fs.readFileSync(p, 'utf8'));
  const ca = read(sslCaFile); // fail fast + loud at startup if the CA is missing
  if (typeof ca !== 'string' || !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error(`buildPgSslConfig: "${sslCaFile}" does not look like a PEM certificate bundle`);
  }

  // Strip every ssl-ish DSN param so the explicit object cannot be replaced.
  let sanitized = connectionString;
  const strippedParams = [];
  try {
    const url = new URL(connectionString);
    for (const param of DSN_SSL_PARAMS) {
      if (url.searchParams.has(param)) {
        strippedParams.push(param);
        url.searchParams.delete(param);
      }
    }
    sanitized = url.toString();
  } catch {
    // Non-URL DSN (key=value form). Keep it intact — but refuse the footgun of
    // mixing forms rather than silently losing the pinned CA.
    if (/\bsslmode=|\bsslrootcert=|\buselibpqcompat=/i.test(connectionString)) {
      throw new Error(
        'buildPgSslConfig: DATABASE_SSL_CA_FILE is set but the (non-URL) DSN also carries ssl params — '
        + 'remove them from the DSN or unset DATABASE_SSL_CA_FILE (never mix the two forms)',
      );
    }
  }

  return {
    connectionString: sanitized,
    poolConfig: {
      ssl: {
        ca,
        // Explicit although true is the TLS default — a diff flipping this to
        // false is a Vex-gate failure caught by the static guard test.
        rejectUnauthorized: true,
      },
    },
    mode: 'explicit-pinned-ca',
    strippedParams,
  };
}
