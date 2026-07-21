// BUILD-002 WP0 — register the build-contract layer as LIVE Directus collections.
//
//   node wp-d-proof/register-contract-collections.mjs
//
// Directus won't ADOPT an existing table via POST /collections, so we register the two
// cockpit contract tables directly in directus_collections (resolves via search_path to the
// directus schema). Directus infers fields + PK (id) from the live schema. cp_directus has
// SELECT on cockpit.build_contract (render-only) and column-scoped INSERT on
// cockpit.contract_command (request-only) — so the cockpit can display the contract and let
// Warwick file an approve/request-changes INTENT, but can never mutate approval state.
//
// Run this, then (re)start Directus (ensure-directus-live.mjs) so the schema scan picks it up.
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
await c.query(`set search_path to ${CONN.directus_schema}, cockpit`);

// [collection, icon, display_template, note]
const collections = [
  ['build_contract', 'fact_check', '{{build_id}} {{contract_version}} — {{lifecycle_state}}',
    'BUILD contract review — the readable operational record of the canonical Git contract (GitHub is canonical). Render-only in the cockpit; approval is filed as an INTENT in contract_command and applied by a trusted worker, bound to the exact version + Git SHA + content hash.'],
  ['contract_command', 'how_to_reg', '{{command}} {{build_id}} {{contract_version}} ({{status}})',
    'BUILD contract approval seam: create an INTENT here (command = approve_contract | request_changes; bind build_id + contract_version + bound_git_sha + bound_content_hash from the contract row). A trusted worker executes it + writes a receipt. The cockpit can never execute or rewrite approval history.'],
];
try {
  for (const [name, icon, display_template, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, display_template, accountability)
       values ($1,$2,$3,$4,'all')
       on conflict (collection) do update set icon=excluded.icon, note=excluded.note, display_template=excluded.display_template`,
      [name, icon, note, display_template]);
    console.log(`[register-contract] collection registered: ${name}`);
  }
} finally { await c.end(); }
console.log('[register-contract] done — (re)start Directus so the schema scan picks these up.');
