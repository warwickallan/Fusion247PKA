// BUILD-014 WP-D increment 1 — bootstrap the DISPOSABLE, LOCAL Directus cockpit.
//
//   node wp-d-proof/setup-directus.mjs
//
// Reads the provisioned Postgres descriptor (.runtime/runtime.json), writes a gitignored
// Directus .env pointed at that localhost cluster, runs `directus bootstrap` (creates the
// directus_* system tables + the first admin), and records the generated admin/viewer
// credentials into runtime.json (gitignored) for the configure + permission-test steps.
//
// LOCAL-ONLY / DEV-ONLY. No secrets are committed; all creds live in .runtime only.
// Directus is started separately (start-directus.mjs) so its process is independent.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime');
const RUNTIME_JSON = path.join(RUNTIME, 'runtime.json');
const DIR = path.join(__dirname, 'directus');
const ENVFILE = path.join(DIR, '.env');

function directusCli() {
  const pkg = JSON.parse(fs.readFileSync(path.join(DIR, 'node_modules', 'directus', 'package.json'), 'utf8'));
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.directus;
  return path.join(DIR, 'node_modules', 'directus', rel);
}

if (!fs.existsSync(RUNTIME_JSON)) { console.error('[directus] run provision.mjs first (no runtime.json)'); process.exit(1); }
const rt = JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8'));

// Free-ish port for Directus (fixed 8074 unless overridden — localhost only).
const DIRECTUS_PORT = Number(process.env.WPD_DIRECTUS_PORT || 8074);
const ADMIN_EMAIL = 'admin@wpd.example.com';
const ADMIN_PASSWORD = rt.directus?.adminPassword || crypto.randomBytes(12).toString('base64url');
const VIEWER_EMAIL = 'viewer@wpd.example.com';
const VIEWER_PASSWORD = rt.directus?.viewerPassword || crypto.randomBytes(12).toString('base64url');
const KEY = rt.directus?.key || crypto.randomUUID();
const SECRET = rt.directus?.secret || crypto.randomBytes(24).toString('hex');

const envLines = [
  `HOST=127.0.0.1`,
  `PORT=${DIRECTUS_PORT}`,
  `PUBLIC_URL=http://127.0.0.1:${DIRECTUS_PORT}`,
  `KEY=${KEY}`,
  `SECRET=${SECRET}`,
  `DB_CLIENT=pg`,
  `DB_HOST=${rt.host}`,
  `DB_PORT=${rt.port}`,
  `DB_DATABASE=${rt.database}`,
  `DB_USER=${rt.superuser}`,
  `DB_PASSWORD=${rt.password}`,
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
console.log(`[directus] wrote ${ENVFILE} (gitignored) — DB ${rt.host}:${rt.port}/${rt.database}, Directus port ${DIRECTUS_PORT}`);

// Fresh-install guarantee: `directus bootstrap` only creates the first admin on a FRESH
// install. Drop any pre-existing directus_* system tables so each setup re-installs cleanly
// AND creates the admin (never touches the lists / list_items / tower_* proof tables).
console.log('[directus] clearing any prior directus_* system tables (fresh install)…');
const { default: pg } = await import('pg');
const cleaner = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await cleaner.connect();
try {
  const { rows } = await cleaner.query(`select tablename from pg_tables where schemaname='public' and tablename like 'directus\\_%'`);
  for (const r of rows) await cleaner.query(`drop table if exists public."${r.tablename}" cascade`);
  console.log(`[directus] dropped ${rows.length} directus_* tables`);
} finally { await cleaner.end(); }

console.log('[directus] bootstrapping (directus_* system tables + first admin)…');
const r = spawnSync(process.execPath, [directusCli(), 'bootstrap'], { cwd: DIR, encoding: 'utf8', stdio: 'inherit' });
if (r.status !== 0) { console.error('[directus] bootstrap FAILED (exit ' + r.status + ')'); process.exit(1); }

rt.directus = {
  port: DIRECTUS_PORT, url: `http://127.0.0.1:${DIRECTUS_PORT}`,
  adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD,
  viewerEmail: VIEWER_EMAIL, viewerPassword: VIEWER_PASSWORD,
  key: KEY, secret: SECRET,
};
fs.writeFileSync(RUNTIME_JSON, JSON.stringify(rt, null, 2));
console.log(`[directus] bootstrap DONE. Admin: ${ADMIN_EMAIL} / ***  (creds in .runtime/runtime.json, gitignored)`);
console.log('[directus] next: node wp-d-proof/start-directus.mjs');
