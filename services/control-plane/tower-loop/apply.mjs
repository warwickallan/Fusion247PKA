// BUILD-014 Tower supervisor loop — apply db/loop_schema.sql (idempotent).
//
// Connects via CONTROL_PLANE_DEV_DATABASE_URL (a standard postgres:// URL). Same code runs
// unchanged against a throwaway LOCAL Postgres now and the isolated Supabase DEV project
// later — only the env var changes. The schema itself is `create ... if not exists`, so
// re-running is safe.
//
//   node apply.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function applySchema(databaseUrl = process.env.CONTROL_PLANE_DEV_DATABASE_URL) {
  if (!databaseUrl) throw new Error('CONTROL_PLANE_DEV_DATABASE_URL is not set — point it at the throwaway local Postgres (or Supabase DEV).');
  const sqlPath = path.join(__dirname, 'db', 'loop_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query(sql);
    return { applied: true, sqlPath };
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  applySchema()
    .then((r) => { console.log(`[apply] schema applied (idempotent) from ${r.sqlPath}`); process.exit(0); })
    .catch((e) => { console.error(`[apply] FAILED: ${e.message}`); process.exit(1); });
}
