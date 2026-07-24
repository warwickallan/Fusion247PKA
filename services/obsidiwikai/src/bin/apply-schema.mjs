// Apply the ObsidiWikAi schema to the live stores: Supabase (obsidiwikai.*) + Neo4j (Owai* graph).
// Idempotent. Run: node --env-file=... src/bin/apply-schema.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { q, close } from '../clients/db.mjs';
import { cypher } from '../clients/neo4j.mjs';
import { assertConfig } from '../config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function applySupabase() {
  const dir = join(root, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    await q(readFileSync(join(dir, f), 'utf8'));
    console.log('  applied migration', f);
  }
  const r = await q(
    "select table_schema||'.'||table_name t from information_schema.tables where table_schema in ('obsidiwikai','cairn') order by table_schema, table_name"
  );
  return r.rows.map((x) => x.t);
}

async function applyNeo4j() {
  const raw = readFileSync(join(root, 'src', 'encyclopedia', 'neo4j-schema.cypher'), 'utf8');
  const stmts = raw
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
  // schema ops must each be their own transaction
  for (const s of stmts) await cypher([{ statement: s }]);
  return stmts.length;
}

async function main() {
  assertConfig();
  console.log('→ Supabase migration…');
  const tables = await applySupabase();
  console.log('  obsidiwikai tables (' + tables.length + '):', tables.join(', '));
  console.log('→ Neo4j schema…');
  const n = await applyNeo4j();
  console.log('  applied ' + n + ' cypher statements');
  await close();
  console.log('✅ schema applied');
}

main().catch((e) => { console.error('❌ apply-schema FAILED:', e.message); process.exit(1); });
