// Source navigation — the usable evidence surface for the ONE graph.
// Ask about a concept/question; get the supporting source chunks with their exact passages, each
// traceable to its faithful-clean transcript (§7.1) and the immutable raw TubeAIR source (§7.2).
// Uses LightRAG's existing grounded-retrieval API (no new frontend).
//   node --env-file=... src/bin/trace.mjs "what is a knowledge graph"
import { lightrag } from '../clients/lightrag.mjs';
import { assertConfig } from '../config.mjs';

assertConfig();
const query = process.argv.slice(2).join(' ') || 'knowledge graph';
console.log(`\n🔎 tracing: "${query}"\n`);

const data = await lightrag.queryData(query, { mode: 'mix', topK: 6 });
const ctx = data?.data || data || {};
const chunks = ctx.chunks || ctx.text_units || ctx.contexts || [];
const entities = ctx.entities || [];

if (entities.length) {
  console.log('CONCEPTS (graph):');
  for (const e of entities.slice(0, 6)) console.log('  •', e.entity || e.name || e.entity_name || e.id, '—', (e.description || '').slice(0, 90));
  console.log();
}

console.log(`SUPPORTING SOURCES (${chunks.length} chunk(s)):`);
for (const c of chunks.slice(0, 6)) {
  const src = c.file_path || c.source_id || c.source || '?';
  const passage = (c.content || c.text || '').replace(/\s+/g, ' ').trim();
  console.log(`\n  ── source: ${src}`);
  console.log(`     passage: ${passage.slice(0, 220)}`);
  const sid = String(src).split(/[<|]/)[0].replace(/^doc-/, '').trim();
  console.log(`     clean transcript: Team Knowledge/Sources/_raw/${sid}/tubeair-report.md  §7.1`);
  console.log(`     raw TubeAIR:       Team Knowledge/Sources/_raw/${sid}/tubeair-report.md  §7.2 (immutable)`);
}
if (!chunks.length) console.log('  (no supporting chunks returned — try a different phrasing or check the source is LEARN-processed)');
console.log();
