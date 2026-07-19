// BUILD-014 WP-D increment 1 — register the proof tables as Directus collections.
//
//   node wp-d-proof/register-collections.mjs
//
// Directus won't ADOPT an existing table via POST /collections ("already exists"), so we
// register the four proof tables directly in directus_collections. Directus infers each
// collection's fields + primary key from the live DB schema (every table has a real PK),
// so no directus_fields rows are needed. Run this BEFORE start-directus.mjs (or restart
// Directus after) so the startup schema scan picks the collections up.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rt = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime', 'runtime.json'), 'utf8'));
const { default: pg } = await import('pg');
const c = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await c.connect();

const collections = [
  ['tower_review_log', 'forum', 'The Tower conversations log — review beats + Larry summaries (read-model of ops.agent_event).'],
  ['tower_verdicts',   'gavel', 'Head-bound review verdicts (read-model of ops.verdict).'],
  ['lists',            'shopping_cart', 'SYNTHETIC shopping lists (dev persona — no real household data).'],
  ['list_items',       'checklist', 'SYNTHETIC shopping list items.'],
];
try {
  for (const [name, icon, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, accountability)
       values ($1,$2,$3,'all') on conflict (collection) do update set icon=excluded.icon, note=excluded.note`,
      [name, icon, note]);
    console.log(`[register] collection registered: ${name}`);
  }
} finally { await c.end(); }
console.log('[register] done — (re)start Directus so the schema scan picks these up.');
