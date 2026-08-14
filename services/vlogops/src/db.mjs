// BUILD-006 Phase 1 — the connection to the durable store.
//
// The estate's convention, followed here rather than reinvented: the `pg` driver, a DSN
// from an environment variable, and a LAZILY constructed pool so that importing this
// module does no I/O, opens no socket and starts no timer. Import is inert; connecting is
// something a caller asks for explicitly.
//
// This service never opens a credential file and never learns a password. It is handed a
// DSN by whoever runs it, and that is the whole of its relationship with secrets.

import pg from 'pg';

let pool = null;

/** Construct (once) and return the pool. The first call is what actually opens sockets. */
export function getPool(databaseUrl) {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      // A CLI intake is short-lived and single-purpose. A large pool here would only make
      // an abrupt kill messier without making anything faster.
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/** Close the pool, if one was ever opened. Safe to call when none was. */
export async function closePool() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

/**
 * Run `fn` inside ONE transaction, committing on success and rolling back on any throw.
 *
 * This is the mechanism that makes an abrupt kill safe. Every intake writes its seed, all
 * of its snapshots and its ledger row inside a single call to this function, so the
 * database has exactly two possible outcomes: everything, or nothing. A process killed at
 * any instant before COMMIT leaves no partial seed for anybody to reconcile, and one
 * killed after COMMIT leaves a complete one. There is no third state, which is why this
 * service needs no recovery pass, no lease and no reconciler.
 */
export async function withTransaction(pool_, fn) {
  const client = await pool_.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* the connection is already gone */ }
    throw err;
  } finally {
    client.release();
  }
}
