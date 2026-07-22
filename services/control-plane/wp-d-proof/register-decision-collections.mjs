// BUILD-002 WP4 — register the decision-card queue as a LIVE Directus collection.
//   node wp-d-proof/register-decision-collections.mjs   (then restart Directus)
// Surfaces cockpit.decision_card in the cockpit: Warwick (or Larry via Directus) files a card intent;
// the worker renders + receipts it. body_markdown + options + receipt shown readably.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const CONN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime-live', 'directus-live.env.json'), 'utf8'));
const { default: pg } = await import('pg');
const c = new pg.Client({ host: CONN.host, port: CONN.port, database: CONN.database, user: CONN.pooler_user, password: CONN.password, ssl: { ca: fs.readFileSync(CONN.ssl_ca_file), rejectUnauthorized: true } });
await c.connect();
await c.query(`set search_path to ${CONN.directus_schema}, cockpit`);
try {
  await c.query(
    `insert into directus_collections (collection, icon, note, display_template, sort_field, accountability)
     values ('decision_card','ballot',$1,'{{subject}} — {{status}}',null,'all')
     on conflict (collection) do update set icon=excluded.icon, note=excluded.note, display_template=excluded.display_template`,
    ['Outbound decision cards (BUILD-002 WP4): a decision needing Warwick\'s tap becomes a governed Telegram card. File an intent (subject, body, options A/B/C, target). A trusted worker renders + receipts it. dry_run=true (default) renders WITHOUT sending; a real send needs dry_run=false AND the worker\'s --allow-send flag.']);
  console.log('[register-dc] collection: decision_card');
  for (const [field, iface, display, sort, width] of [
    ['body_markdown', 'input-rich-text-md', 'formatted-value', 40, 'full'],
    ['options', 'input-code', null, 45, 'full'],
    ['receipt', 'input-code', null, 90, 'full'],
  ]) {
    await c.query(`delete from directus_fields where collection='decision_card' and field=$1`, [field]);
    await c.query(`insert into directus_fields (collection, field, interface, display, sort, width, options) values ('decision_card',$1,$2,$3,$4,$5,$6)`,
      [field, iface, display, sort, width, iface === 'input-code' ? JSON.stringify({ language: 'json' }) : null]);
    console.log('[register-dc] field:', field, '->', iface);
  }
} finally { await c.end(); }
console.log('[register-dc] done — restart Directus to pick these up.');
