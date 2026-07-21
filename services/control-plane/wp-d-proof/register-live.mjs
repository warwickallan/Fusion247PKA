// BUILD-014 LIVE cockpit — expose the real asdair.regulars as a Directus collection.
// Directus won't ADOPT an existing table via POST /collections, so we register it directly in
// directus_collections (resolves to directus_sys.directus_collections via search_path). Directus
// infers fields + PK (id) from the live schema. cp_directus has SELECT on asdair.regulars only,
// so this is the single exposed live collection; everything else stays invisible/denied.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime-live');
const CONN = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'directus-live.env.json'), 'utf8'));
const ca = fs.readFileSync(CONN.ssl_ca_file);
const { default: pg } = await import('pg');
const c = new pg.Client({
  host: CONN.host, port: CONN.port, database: CONN.database,
  user: CONN.pooler_user, password: CONN.password, ssl: { ca, rejectUnauthorized: true },
});
await c.connect();
await c.query(`set search_path to ${CONN.directus_schema}, asdair`);
const collections = [
  ['regulars', 'shopping_cart', 'AsdAIr Regulars — the real weekly-shop favourites (LIVE, read-only, hosted MyPKA Supabase).'],
  ['command_request', 'send', 'AsdAIr write-back seam: the cockpit INSERTs an INTENT (add_regular_to_next_week); a trusted worker executes it + writes a receipt. The cockpit can never execute.'],
];
try {
  for (const [name, icon, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, accountability)
       values ($1,$2,$3,'all') on conflict (collection) do update set icon=excluded.icon, note=excluded.note`,
      [name, icon, note]);
    console.log(`[register-live] collection registered: ${name}`);
  }
} finally { await c.end(); }
console.log('[register-live] done — (re)start Directus so the schema scan picks it up.');
