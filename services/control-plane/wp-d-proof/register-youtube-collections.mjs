// BUILD-002 WP2 — register the YouTube-source projection as LIVE Directus collections.
//   node wp-d-proof/register-youtube-collections.mjs   (then restart Directus)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const CONN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime-live', 'directus-live.env.json'), 'utf8'));
const { default: pg } = await import('pg');
const c = new pg.Client({ host: CONN.host, port: CONN.port, database: CONN.database, user: CONN.pooler_user, password: CONN.password, ssl: { ca: fs.readFileSync(CONN.ssl_ca_file), rejectUnauthorized: true } });
await c.connect();
await c.query(`set search_path to ${CONN.directus_schema}, cockpit`);
const collections = [
  ['youtube_source', 'smart_display', '{{title}} — {{review_state}}', null,
    'Processed YouTube sources (BUILD-002): the standalone knowledge brief (readable Markdown), review state, and links to the immutable RAW transcript + git-tracked vault note.'],
  ['learning_candidate', 'lightbulb', '{{candidate_ref}} — {{recommendation}} ({{status}})', 'sort',
    'Suggested learnings from processed sources — recommendation + why + evidence + confidence/risk. Readable; Accept/Decline (durable governed decision) is the WP3 seam.'],
];
try {
  for (const [name, icon, tmpl, sortField, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, display_template, sort_field, accountability)
       values ($1,$2,$3,$4,$5,'all') on conflict (collection) do update set icon=excluded.icon, note=excluded.note, display_template=excluded.display_template, sort_field=excluded.sort_field`,
      [name, icon, note, tmpl, sortField]);
    console.log('[register-yt] collection:', name);
  }
  await c.query(`delete from directus_fields where collection='youtube_source' and field='brief_markdown'`);
  await c.query(`insert into directus_fields (collection, field, interface, display, sort, width) values ('youtube_source','brief_markdown','input-rich-text-md','formatted-value',30,'full')`);
  console.log('[register-yt] field: youtube_source.brief_markdown -> Markdown');
} finally { await c.end(); }
console.log('[register-yt] done — restart Directus to pick these up.');
