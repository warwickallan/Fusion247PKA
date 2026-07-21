// BUILD-014 — provision the AsdAIr write-back trust seam roles + grants on hosted MyPKA
// Supabase, entirely from this machine (secrets never leave). Adds a NEW least-privilege
// cp_worker role and the asymmetric grants that ARE the seam:
//
//   cp_directus (the cockpit): SELECT + INSERT(intent columns) on asdair.command_request.
//                              NO update/delete; NO write on shopping_lists/items. It requests.
//   cp_worker   (the executor): SELECT + UPDATE(status,claimed_at,completed_at,receipt) on
//                              asdair.command_request; SELECT regulars/households; INSERT/UPDATE
//                              shopping_lists + shopping_list_items. NO insert on the queue.
//
// Run: node wp-d-proof/provision-writeback-live.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CFGPATH = path.join(here, '.runtime-live', 'directus-live.env.json');
const cfg = JSON.parse(fs.readFileSync(CFGPATH, 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file);

function readGatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  const u = new URL(line.slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres',
    ssl: { ca, rejectUnauthorized: true } };
}

// Persist a cp_worker password (gitignored) — generate once, reuse on re-run.
const workerPw = cfg.worker_password || crypto.randomBytes(24).toString('base64url');
cfg.worker_password = workerPw;
cfg.worker_role = 'cp_worker';
cfg.worker_pooler_user = `cp_worker.${cfg.project_ref}`;

const priv = new pg.Client(readGatewayDsn());
await priv.connect();
console.log('[wb] connected as', (await priv.query('select current_user')).rows[0].current_user);

// Dollar-quote the password literal (base64url has no '$').
const pw = `$pw$${workerPw}$pw$`;
await priv.query(`do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'cp_worker') then
    create role cp_worker login password ${pw} noinherit;
  else
    alter role cp_worker login password ${pw};
  end if;
end
$do$;`);
console.log('[wb] role cp_worker ready');

// ---- cp_directus: request-only on the queue (belt-and-braces with the insert guard) ----
await priv.query(`grant usage on schema asdair to cp_directus`);
await priv.query(`grant select on asdair.command_request to cp_directus`);
await priv.query(`grant insert (requested_by, command, args, idempotency_key) on asdair.command_request to cp_directus`);
console.log('[wb] cp_directus: SELECT + INSERT-intent(command_request) ONLY');

// ---- cp_worker: execute-only. Claims/receipts the queue; performs the effect. ----
await priv.query(`grant usage on schema asdair to cp_worker`);
await priv.query(`grant select on asdair.command_request to cp_worker`);
await priv.query(`grant update (status, claimed_at, completed_at, receipt) on asdair.command_request to cp_worker`);
await priv.query(`grant select on asdair.regulars   to cp_worker`);
await priv.query(`grant select on asdair.households  to cp_worker`);   // FK check when creating a list
await priv.query(`grant select, insert, update on asdair.shopping_lists      to cp_worker`);
await priv.query(`grant select, insert, update on asdair.shopping_list_items to cp_worker`);
console.log('[wb] cp_worker: SELECT+UPDATE(command_request) + SELECT(regulars,households) + R/W(shopping_lists,shopping_list_items)');

await priv.end();
fs.writeFileSync(CFGPATH, JSON.stringify(cfg, null, 2));
console.log('[wb] worker creds saved to .runtime-live/directus-live.env.json (gitignored). DONE.');
