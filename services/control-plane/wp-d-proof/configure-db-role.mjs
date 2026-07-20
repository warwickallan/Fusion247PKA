// BUILD-014 WP-D increment 2 — SCOPED Directus DB role (Vex before-live hardening).
//
//   node wp-d-proof/configure-db-role.mjs     (Postgres must be running)
//
// Increment 1 connected Directus to Postgres as the DB SUPERUSER (cp_admin). Vex's
// increment-1 review flagged that before-live: the cockpit must not hold superuser on the
// system of record. This creates a LEAST-PRIVILEGE login role `cp_directus` and re-points
// Directus at it, so the running cockpit's DB principal:
//   • CAN read/write the SYNTHETIC public projections (lists / list_items / tower_* ) and its
//     own directus_* system tables (full DML on schema public);
//   • CANNOT touch schema `ops` AT ALL — no USAGE grant on the schema, so the append-only
//     ledger (ops.agent_event / ops.verdict / ops.command_request / …) is physically
//     unreachable by the cockpit wire. This is a STRUCTURAL bound, not an app-layer rule;
//   • holds NO DDL / superuser / BYPASSRLS — ops.* RLS (forced deny-by-default) is a second
//     independent layer behind the missing schema grant.
//
// The privileged/admin path (provision, directus bootstrap, register-collections) still runs
// as cp_admin — that is the out-of-band migration/owner role, never the runtime cockpit role.
//
// Idempotent: re-running rotates the scoped password and re-applies grants.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_JSON = path.join(__dirname, '.runtime', 'runtime.json');
const ENVFILE = path.join(__dirname, 'directus', '.env');

if (!fs.existsSync(RUNTIME_JSON)) { console.error('[db-role] run provision.mjs + setup-directus.mjs first (no runtime.json)'); process.exit(1); }
const rt = JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8'));

const SCOPED_ROLE = 'cp_directus';
// Reuse a prior scoped password if present so a re-run without a full teardown keeps Directus
// able to authenticate; otherwise mint a fresh one. Never echoed.
const SCOPED_PW = rt.directus?.dbRolePassword || crypto.randomBytes(18).toString('base64url');

const { default: pg } = await import('pg');
const admin = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await admin.connect();
try {
  // 1) Create-or-rotate the scoped LOGIN role. Plain role: NOSUPERUSER, NOBYPASSRLS, NOCREATEDB,
  //    NOCREATEROLE by default — exactly what a disposable cockpit wire should hold.
  await admin.query(`
    do $$ begin
      if exists (select 1 from pg_roles where rolname = '${SCOPED_ROLE}') then
        execute format('alter role ${SCOPED_ROLE} login password %L', $p$${SCOPED_PW}$p$);
      else
        execute format('create role ${SCOPED_ROLE} login password %L', $p$${SCOPED_PW}$p$);
      end if;
    end $$;`);

  // 2) Grant ONLY what the cockpit needs: full DML on schema public (the synthetic projections
  //    + Directus's own directus_* system tables), plus sequence usage for identity columns.
  await admin.query(`grant usage on schema public to ${SCOPED_ROLE}`);
  await admin.query(`grant select, insert, update, delete on all tables in schema public to ${SCOPED_ROLE}`);
  await admin.query(`grant usage, select, update on all sequences in schema public to ${SCOPED_ROLE}`);
  // Future public tables created by cp_admin (e.g. a later projection) auto-grant to the cockpit.
  await admin.query(`alter default privileges for role ${rt.superuser} in schema public grant select, insert, update, delete on tables to ${SCOPED_ROLE}`);
  await admin.query(`alter default privileges for role ${rt.superuser} in schema public grant usage, select, update on sequences to ${SCOPED_ROLE}`);

  // 3) EXPLICIT DENY of the ledger. cp_directus was never granted USAGE on schema ops, so this
  //    revoke is belt-and-braces (and documents intent): the cockpit wire cannot reach ops.*.
  await admin.query(`revoke all on schema ops from ${SCOPED_ROLE}`);
  await admin.query(`revoke all on all tables in schema ops from ${SCOPED_ROLE}`);

  // Sanity: assert the role is not accidentally over-privileged.
  const { rows } = await admin.query(
    `select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
       from pg_roles where rolname = $1`, [SCOPED_ROLE]);
  const r = rows[0];
  if (r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole) {
    throw new Error(`[db-role] REFUSING: ${SCOPED_ROLE} is over-privileged: ${JSON.stringify(r)}`);
  }
  console.log(`[db-role] ${SCOPED_ROLE} ready — login=${r.rolcanlogin}, super=${r.rolsuper}, bypassrls=${r.rolbypassrls}, createdb=${r.rolcreatedb}, createrole=${r.rolcreaterole}`);
} finally {
  await admin.end();
}

// 4) Re-point the (gitignored) Directus .env at the scoped role. Directus must be RESTARTED
//    after this for the new DB principal to take effect (start-directus.mjs refuses a running port).
if (fs.existsSync(ENVFILE)) {
  let env = fs.readFileSync(ENVFILE, 'utf8');
  env = env.replace(/^DB_USER=.*$/m, `DB_USER=${SCOPED_ROLE}`);
  env = env.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${SCOPED_PW}`);
  fs.writeFileSync(ENVFILE, env);
  console.log('[db-role] re-pointed directus/.env DB_USER -> ' + SCOPED_ROLE + ' (password masked, gitignored)');
} else {
  console.log('[db-role] NOTE: directus/.env not found yet — run setup-directus.mjs first, then re-run this.');
}

// 5) Record scoped creds in runtime.json (gitignored) for the tests to open a cp_directus conn.
rt.directus = rt.directus || {};
rt.directus.dbRole = SCOPED_ROLE;
rt.directus.dbRolePassword = SCOPED_PW;
fs.writeFileSync(RUNTIME_JSON, JSON.stringify(rt, null, 2));
console.log('[db-role] DONE. RESTART Directus (stop.mjs is heavy — instead: kill the directus pid, then start-directus.mjs) so it reconnects as ' + SCOPED_ROLE + '.');
