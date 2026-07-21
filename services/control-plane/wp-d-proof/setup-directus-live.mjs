// BUILD-014 LIVE cockpit — bootstrap a LOCAL Directus bound to 127.0.0.1 whose data source is
// the HOSTED MyPKA Supabase (real asdair data), connecting as the least-privilege cp_directus
// role. Directus's own ~40 system tables are confined to the isolated `directus_sys` schema;
// `asdair` is added to the search path so the real `regulars` table (PK id) is discoverable.
//
//   node wp-d-proof/setup-directus-live.mjs
//
// LOCAL-ONLY (Directus binds 127.0.0.1). The hosted connection is over TLS. Real household data
// is reachable ONLY from this machine — no off-loopback exposure here (that is gated by G1–G8).
// All secrets live in .runtime-live/ (gitignored); nothing real is committed.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime-live');
const RUNTIME_JSON = path.join(RUNTIME, 'runtime.json');
const CONN = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'directus-live.env.json'), 'utf8'));
const DIR = path.join(__dirname, 'directus');
const ENVFILE = path.join(DIR, '.env');
const ca = fs.readFileSync(CONN.ssl_ca_file);

function directusCli() {
  return path.join(DIR, 'node_modules', 'directus', 'cli.js');
}

const DIRECTUS_PORT = Number(process.env.WPD_LIVE_DIRECTUS_PORT || 8074);
const prev = fs.existsSync(RUNTIME_JSON) ? JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8')) : {};
const ADMIN_EMAIL = 'admin@wpd.example.com';
const ADMIN_PASSWORD = prev.directus?.adminPassword || crypto.randomBytes(12).toString('base64url');
const KEY = prev.directus?.key || crypto.randomUUID();
const SECRET = prev.directus?.secret || crypto.randomBytes(24).toString('hex');

// Directus system tables -> directus_sys; collections resolvable from asdair too.
const envLines = [
  `HOST=127.0.0.1`,
  `PORT=${DIRECTUS_PORT}`,
  `PUBLIC_URL=http://127.0.0.1:${DIRECTUS_PORT}`,
  `KEY=${KEY}`,
  `SECRET=${SECRET}`,
  `DB_CLIENT=pg`,
  `DB_HOST=${CONN.host}`,
  `DB_PORT=${CONN.port}`,
  `DB_DATABASE=${CONN.database}`,
  `DB_USER=${CONN.pooler_user}`,
  `DB_PASSWORD=${CONN.password}`,
  // TLS on (Supabase requires it). CA-verify is deferred to the exposure gates (G2/G3); this
  // is a localhost read proof, so encrypt-without-strict-verify matches the gateway's sslmode=require.
  `DB_SSL__REJECT_UNAUTHORIZED=false`,
  `DB_SEARCH_PATH=${CONN.directus_schema},asdair`,
  `ADMIN_EMAIL=${ADMIN_EMAIL}`,
  `ADMIN_PASSWORD=${ADMIN_PASSWORD}`,
  `TELEMETRY=false`,
  `WEBSOCKETS_ENABLED=false`,
  `CACHE_ENABLED=false`,
  `LOG_LEVEL=warn`,
  '',
].join('\n');
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(ENVFILE, envLines);
console.log(`[live] wrote ${ENVFILE} (gitignored) — Directus 127.0.0.1:${DIRECTUS_PORT} -> hosted ${CONN.host}/${CONN.database} as ${CONN.role}`);

// Fresh-install guarantee, scoped STRICTLY to directus_sys (never touches asdair).
const { default: pg } = await import('pg');
const cleaner = new pg.Client({
  host: CONN.host, port: CONN.port, database: CONN.database,
  user: CONN.pooler_user, password: CONN.password, ssl: { ca, rejectUnauthorized: true },
});
await cleaner.connect();
try {
  const { rows } = await cleaner.query(
    `select tablename from pg_tables where schemaname = 'directus_sys' and tablename like 'directus\\_%'`);
  for (const r of rows) await cleaner.query(`drop table if exists directus_sys."${r.tablename}" cascade`);
  console.log(`[live] cleared ${rows.length} prior directus_* tables in directus_sys (asdair untouched)`);
} finally { await cleaner.end(); }

console.log('[live] bootstrapping Directus (system tables in directus_sys + first admin)…');
const r = spawnSync(process.execPath, [directusCli(), 'bootstrap'], { cwd: DIR, encoding: 'utf8', stdio: 'inherit' });
if (r.status !== 0) { console.error('[live] bootstrap FAILED (exit ' + r.status + ')'); process.exit(1); }

const rt = {
  host: CONN.host, port: CONN.port, database: CONN.database, role: CONN.role,
  directus: {
    port: DIRECTUS_PORT, url: `http://127.0.0.1:${DIRECTUS_PORT}`,
    adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD, key: KEY, secret: SECRET,
  },
};
fs.writeFileSync(RUNTIME_JSON, JSON.stringify(rt, null, 2));
console.log(`[live] bootstrap DONE. Admin: ${ADMIN_EMAIL} (password in .runtime-live/runtime.json, gitignored)`);
console.log('[live] next: node wp-d-proof/register-live.mjs && node wp-d-proof/start-directus-live.mjs');
