// Supabase (Postgres) client — canonical operational + provenance ledger.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { secrets } from '../config.mjs';

const { Pool } = pg;

function ssl() {
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  if (caFile) {
    try { return { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true }; }
    catch { /* fall through */ }
  }
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: secrets.databaseUrl,
  ssl: ssl(),
  max: 4,
  application_name: 'obsidiwikai',
});

export async function q(text, params) {
  const c = await pool.connect();
  try { return await c.query(text, params); }
  finally { c.release(); }
}

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally { c.release(); }
}

export async function close() { await pool.end(); }
