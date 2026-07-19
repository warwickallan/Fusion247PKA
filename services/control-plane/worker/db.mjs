// BUILD-014 WP-B — Postgres connection layer for the durable worker runtime.
//
// FAIL-FAST env validation (Mack rule 5): a missing DATABASE_URL is a loud startup
// error, never a silent undefined. Point DATABASE_URL at an ISOLATED dev Postgres —
// this runtime is DEV-only and MUST NOT be aimed at any live/prod project.

import pg from 'pg';

const { Pool } = pg;

/** Read + require DATABASE_URL. Throws loudly (fail-fast) when unset. */
export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error(
      'DATABASE_URL is required. Point it at an ISOLATED dev Postgres (never prod). ' +
      'For a hermetic throwaway cluster, run: node worker/test/run-worker-tests.mjs');
  }
  return url;
}

/** Create a pg Pool. `connectionString` overrides DATABASE_URL (used by the test runner). */
export function createPool(opts = {}) {
  const connectionString = opts.connectionString ?? requireDatabaseUrl();
  return new Pool({
    connectionString,
    max: opts.max ?? 10,
    idleTimeoutMillis: opts.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: opts.connectionTimeoutMillis ?? 10_000,
  });
}
