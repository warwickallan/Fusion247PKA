// IDEA-016 — register the two universal contract collections into the LIVE Directus (directus_collections).
// cp_directus already holds SELECT on them (migration 230). Reads live creds from the gitignored
// .runtime-live/directus-live.env.json. Idempotent.  Run: node services/control-plane/cockpit/register-contracts.mjs
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const ENV = 'C:/Fusion247PKA/services/control-plane/wp-d-proof/.runtime-live/directus-live.env.json';
const CONN = JSON.parse(fs.readFileSync(ENV, 'utf8'));
const ca = fs.readFileSync(CONN.ssl_ca_file);
const c = new pg.Client({ host: CONN.host, port: CONN.port, database: CONN.database, user: CONN.pooler_user, password: CONN.password, ssl: { ca, rejectUnauthorized: true } });
await c.connect();
await c.query('set search_path to directus_sys, cockpit');

const collections = [
  ['attention_item', 'Attention — things that genuinely need you', 'inbox'],
  ['output_item', 'Outputs — genuine results Fusion made for you', 'move_to_inbox'],
];
for (const [name, note, icon] of collections) {
  await c.query(
    `insert into directus_collections (collection, note, icon, accountability)
     values ($1,$2,$3,'all')
     on conflict (collection) do update set note=excluded.note, icon=excluded.icon`,
    [name, note, icon],
  );
  console.log('registered', name);
}
await c.end();
