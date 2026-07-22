// BUILD-002 WP3/WP4 — register the follow-on + inbound-response + command-route collections in Directus.
//   node wp-d-proof/register-wp34-collections.mjs   (then restart Directus)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const CONN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime-live', 'directus-live.env.json'), 'utf8'));
const { default: pg } = await import('pg');
const c = new pg.Client({ host: CONN.host, port: CONN.port, database: CONN.database, user: CONN.pooler_user, password: CONN.password, ssl: { ca: fs.readFileSync(CONN.ssl_ca_file), rejectUnauthorized: true } });
await c.connect();
await c.query(`set search_path to ${CONN.directus_schema}, cockpit`);
const collections = [
  ['follow_on_task', 'task_alt', '{{title}} ({{status}})', 'created_at',
    'Governed follow-on work (BUILD-002 WP3/WP4): an accepted learning candidate or an A/B/C decision creates a tracked, correlated to-do here — never a silent edit of governed material. Close from here or via a command.'],
  ['decision_response', 'question_answer', '{{chosen_key}} → {{status}}', null,
    'Inbound A/B/C replies to decision cards (BUILD-002 WP4). File the raw reply; a worker parses it against the card options, records the correlated decision, and creates follow-on work on a match. Never guesses.'],
  ['command_request', 'terminal', '{{command}} ({{status}})', null,
    'Safe Directus command route (BUILD-002 WP4): file a validated command intent (allowlisted only). A worker executes it, emits a result_event + receipt, and fails closed on anything unknown.'],
];
try {
  for (const [name, icon, tmpl, sortField, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, display_template, sort_field, accountability)
       values ($1,$2,$3,$4,$5,'all') on conflict (collection) do update set icon=excluded.icon, note=excluded.note, display_template=excluded.display_template, sort_field=excluded.sort_field`,
      [name, icon, note, tmpl, sortField]);
    console.log('[register-wp34] collection:', name);
  }
  for (const [coll, field] of [['follow_on_task', 'detail'], ['decision_response', 'raw_text']]) {
    await c.query(`delete from directus_fields where collection=$1 and field=$2`, [coll, field]);
    await c.query(`insert into directus_fields (collection, field, interface, display, sort, width) values ($1,$2,'input-multiline','formatted-value',40,'full')`, [coll, field]);
  }
  for (const [coll, field] of [['decision_response', 'receipt'], ['command_request', 'args'], ['command_request', 'receipt'], ['command_request', 'result_event']]) {
    await c.query(`delete from directus_fields where collection=$1 and field=$2`, [coll, field]);
    await c.query(`insert into directus_fields (collection, field, interface, display, sort, width, options) values ($1,$2,'input-code',null,80,'full',$3)`, [coll, field, JSON.stringify({ language: 'json' })]);
  }
} finally { await c.end(); }
console.log('[register-wp34] done — restart Directus to pick these up.');
