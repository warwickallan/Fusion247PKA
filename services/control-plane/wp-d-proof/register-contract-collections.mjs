// BUILD-002 WP0 — register the build-contract layer as LIVE Directus collections.
//
//   node wp-d-proof/register-contract-collections.mjs
//
// Directus won't ADOPT an existing table via POST /collections, so we register the cockpit
// contract tables directly in directus_collections (resolves via search_path to the directus
// schema). Directus infers fields + PK (id) from the live schema. We additionally set the
// build_contract_doc.body_markdown field to the Markdown interface so Warwick reads the actual
// document body as formatted Markdown (GPT review item 4), not a raw text column.
//
//   build_contract       — render-only (cp_directus SELECT): pack identity, hashes, lifecycle
//   build_contract_doc   — render-only: one readable Markdown body per member (brief/contract/plan)
//   contract_command     — request-only (cp_directus column-scoped INSERT): approve / request_changes
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

// [collection, icon, display_template, sort_field|null, note]
const collections = [
  ['build_contract', 'fact_check', '{{build_id}} {{contract_version}} — {{lifecycle_state}}', null,
    'BUILD contract PACK — identity, hashes, lifecycle. Read the actual documents in build_contract_doc. Render-only; approval is filed in contract_command.'],
  ['build_contract_doc', 'description', '{{doc_role}} — {{title}}', 'sort',
    'The three approval-pack documents as readable Markdown (Brief / Contract / Plan), each with its exact Git path, commit, blob and sha256. Render-only.'],
  ['contract_command', 'how_to_reg', '{{command}} {{build_id}} {{contract_version}} ({{status}})', null,
    'BUILD contract approval seam: create an INTENT (command = approve_contract | request_changes; bind build_id + contract_version + bound_git_sha + bound_content_hash from the contract row). A trusted worker executes it + writes a receipt. The cockpit can never execute or rewrite approval history.'],
];
try {
  for (const [name, icon, display_template, sort_field, note] of collections) {
    await c.query(
      `insert into directus_collections (collection, icon, note, display_template, sort_field, accountability)
       values ($1,$2,$3,$4,$5,'all')
       on conflict (collection) do update set icon=excluded.icon, note=excluded.note, display_template=excluded.display_template, sort_field=excluded.sort_field`,
      [name, icon, note, display_template, sort_field]);
    console.log(`[register-contract] collection registered: ${name}`);
  }
  // Render body_markdown as Markdown (readable), not a raw textarea. directus_fields has no unique
  // on (collection, field), so delete-then-insert for idempotency.
  await c.query(`delete from directus_fields where collection='build_contract_doc' and field='body_markdown'`);
  await c.query(
    `insert into directus_fields (collection, field, interface, display, sort, width)
     values ('build_contract_doc','body_markdown','input-rich-text-md','formatted-value',20,'full')`);
  console.log('[register-contract] field configured: build_contract_doc.body_markdown -> Markdown interface');
} finally { await c.end(); }
console.log('[register-contract] done — (re)start Directus so the schema scan picks these up.');
