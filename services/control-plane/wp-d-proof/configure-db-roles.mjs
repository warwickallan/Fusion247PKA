// BUILD-014 WP-D increment 2 — DB-layer least-privilege roles for the write-back seam.
//
//   node wp-d-proof/configure-db-roles.mjs    (run AFTER setup-directus.mjs)
//
// Increment 1 connected Directus to Postgres as the SUPERUSER (cp_admin) and enforced
// least-privilege only at the Directus APP layer. Increment 2's brief requires the
// cockpit + worker to run as LEAST-PRIVILEGE db roles, NEVER superuser. This script:
//
//   1. Creates two narrow LOGIN roles:
//        cp_directus — the Directus RUNTIME connection (the cockpit).
//        cp_worker   — the trusted executor that drains the command queue.
//   2. Reassigns ownership of the directus_* system tables to cp_directus so Directus
//      can fully operate its own CMS tables at runtime WITHOUT any rights on the
//      domain tables beyond the tightly-scoped grants below.
//   3. Applies the least-privilege domain GRANTs that ARE the trust seam:
//        cp_directus:  SELECT on read-models + shopping + queue; UPDATE(is_checked)
//                      ONLY on list_items; INSERT(intent columns) ONLY on
//                      command_request. NO update on the queue, NO receipts, NO
//                      ops.* ledger, NO other writes.
//        cp_worker:    SELECT+UPDATE on command_request (claim + receipt), SELECT on
//                      list_items (to recompute), write on cockpit_metric. NO INSERT
//                      on the queue (it cannot fabricate requests), NO ops.* ledger,
//                      NO shopping writes, NO directus_* access.
//   4. Repoints directus/.env DB_USER/DB_PASSWORD from cp_admin -> cp_directus so the
//      cockpit RUNS as least-privilege. (Bootstrap already ran as superuser; runtime
//      does not need superuser.)
//
// The asymmetry is the point: Directus REQUESTS (insert-intent, no execute), the
// worker EXECUTES (update/receipt, no request). Neither can touch the ledger.
//
// LOCAL-ONLY / DEV-ONLY / SYNTHETIC. Passwords are dev-only, stored in .runtime
// (gitignored) and the gitignored .env — never committed.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RT = path.join(__dirname, '.runtime', 'runtime.json');
const ENVFILE = path.join(__dirname, 'directus', '.env');

if (!fs.existsSync(RT)) { console.error('[db-roles] run provision.mjs + setup-directus.mjs first (no runtime.json)'); process.exit(1); }
const rt = JSON.parse(fs.readFileSync(RT, 'utf8'));

const DIRECTUS_PW = rt.dbRoles?.directusPassword || ('cpd_' + crypto.randomBytes(9).toString('base64url'));
const WORKER_PW   = rt.dbRoles?.workerPassword   || ('cpw_' + crypto.randomBytes(9).toString('base64url'));

const { default: pg } = await import('pg');
const admin = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await admin.connect();

async function ensureRole(name, password) {
  await admin.query(`do $$
    begin
      if not exists (select 1 from pg_roles where rolname = '${name}') then
        create role ${name} login password '${password}';
      else
        execute format('alter role ${name} login password %L', '${password}');
      end if;
    end $$;`);
  console.log(`[db-roles] role ${name} ready (login, least-privilege)`);
}

try {
  await ensureRole('cp_directus', DIRECTUS_PW);
  await ensureRole('cp_worker',   WORKER_PW);

  // ---- Reset any prior grants so this script is idempotent + deterministic. ----
  // Revoke everything these roles might hold, then re-grant exactly the scoped set.
  for (const r of ['cp_directus', 'cp_worker']) {
    await admin.query(`revoke all on all tables    in schema public from ${r}`);
    await admin.query(`revoke all on all sequences  in schema public from ${r}`);
    await admin.query(`revoke all on schema public              from ${r}`);
    await admin.query(`revoke all on schema ops                 from ${r}`).catch(() => {});
    await admin.query(`revoke usage on schema ops               from ${r}`).catch(() => {});
  }

  // ---- Directus runtime owns its OWN system tables (so it can operate the CMS) --
  // but has NO ownership of the domain tables. Reassign directus_* + their sequences.
  const dtabs = await admin.query(
    `select tablename from pg_tables where schemaname='public' and tablename like 'directus\\_%'`);
  for (const { tablename } of dtabs.rows) {
    await admin.query(`alter table public."${tablename}" owner to cp_directus`);
  }
  const dseqs = await admin.query(
    `select sequencename from pg_sequences where schemaname='public' and sequencename like 'directus\\_%'`);
  for (const { sequencename } of dseqs.rows) {
    await admin.query(`alter sequence public."${sequencename}" owner to cp_directus`);
  }
  console.log(`[db-roles] cp_directus now owns ${dtabs.rows.length} directus_* tables + ${dseqs.rows.length} sequences`);

  // ---- Schema usage (needed to reference ANY object in a schema) ---------------
  await admin.query(`grant usage on schema public to cp_directus`);
  await admin.query(`grant usage on schema public to cp_worker`);
  // Deliberately NO `grant usage on schema ops` to either role -> the ledger is
  // invisible at the DB layer, not merely denied at the app layer.

  // =====================================================================
  //  cp_directus — the COCKPIT. Reads its views; the ONLY writes it can do
  //  are: toggle is_checked, and request (never execute) a command.
  // =====================================================================
  await admin.query(`grant select on public.lists            to cp_directus`);
  await admin.query(`grant select on public.list_items       to cp_directus`);
  await admin.query(`grant select on public.tower_review_log to cp_directus`);
  await admin.query(`grant select on public.tower_verdicts   to cp_directus`);
  await admin.query(`grant select on public.command_request  to cp_directus`);
  await admin.query(`grant select on public.cockpit_metric   to cp_directus`);
  // THE constrained CRUD: column-scoped UPDATE — is_checked and nothing else.
  await admin.query(`grant update (is_checked) on public.list_items to cp_directus`);
  // THE seam: column-scoped INSERT of INTENT only. status/receipt/timestamps are
  // NOT grantable to it, so they take their safe defaults (status='requested',
  // receipt=null); the insert guard trigger double-enforces intent-only.
  await admin.query(`grant insert (requested_by, command, args, idempotency_key) on public.command_request to cp_directus`);
  // NO update/delete on command_request (cannot claim/complete/write receipts).
  // NO write on lists / read-models / cockpit_metric. NO ops.* at all.
  console.log('[db-roles] cp_directus: SELECT views + UPDATE(is_checked) + INSERT-intent(command_request) ONLY');

  // =====================================================================
  //  cp_worker — the TRUSTED EXECUTOR. Claims + completes queue rows and
  //  writes the safe metric. It cannot fabricate requests or touch the ledger.
  // =====================================================================
  await admin.query(`grant select on public.command_request to cp_worker`);
  // Column-scoped UPDATE: the worker may ONLY advance the lifecycle + stamp times +
  // append a receipt. It CANNOT rewrite requested_by/command/args/idempotency_key or
  // flip is_synthetic (those columns are not granted -> 42501). The transition trigger
  // further constrains which status moves are legal.
  await admin.query(`grant update (status, claimed_at, completed_at, receipt) on public.command_request to cp_worker`);
  await admin.query(`grant select on public.list_items to cp_worker`);       // to recompute counts
  await admin.query(`grant select, insert, update on public.cockpit_metric to cp_worker`);
  // NO INSERT on command_request (asymmetry: requests come from the cockpit only).
  // NO update on the request fields / is_synthetic. NO write on shopping/read-models.
  // NO ops.* ledger. NO directus_* access.
  console.log('[db-roles] cp_worker: SELECT + UPDATE(status,claimed_at,completed_at,receipt) on command_request, SELECT(list_items), R/W(cockpit_metric) ONLY');

  // ---- Persist dev-only passwords (gitignored) ---------------------------------
  rt.dbRoles = {
    directusUser: 'cp_directus', directusPassword: DIRECTUS_PW,
    workerUser:   'cp_worker',   workerPassword:   WORKER_PW,
  };
  fs.writeFileSync(RT, JSON.stringify(rt, null, 2));

  // ---- Repoint Directus RUNTIME connection to the least-privilege role ---------
  if (fs.existsSync(ENVFILE)) {
    let env = fs.readFileSync(ENVFILE, 'utf8');
    env = env.replace(/^DB_USER=.*$/m, `DB_USER=cp_directus`);
    env = env.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${DIRECTUS_PW}`);
    fs.writeFileSync(ENVFILE, env);
    console.log('[db-roles] directus/.env DB_USER -> cp_directus (cockpit now runs LEAST-PRIVILEGE, not superuser)');
  } else {
    console.warn('[db-roles] directus/.env not found — run setup-directus.mjs before starting Directus');
  }

  console.log('[db-roles] DONE. The write-back trust seam is enforced at the DB layer.');
} finally {
  await admin.end();
}
