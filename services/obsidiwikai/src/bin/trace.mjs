// WP6 — bounded source/evidence navigation over the one read-only Brain.
import { assertRetrievalConfig } from '../config.mjs';
import { brainAccess } from '../core/brainAccess.mjs';

const query = process.argv.slice(2).join(' ') || 'knowledge graph';
assertRetrievalConfig();
const result = await brainAccess.search(query);

console.log(`\n🔎 tracing: "${result.query}"\n`);
console.log('CONCEPTS');
for (const entity of result.evidence.entities) {
  console.log(`  • ${entity.name}${entity.description ? ` — ${entity.description}` : ''}`);
}
console.log('\nRELATIONSHIPS');
for (const relation of result.evidence.relationships) {
  console.log(`  • ${relation.from || '?'} → ${relation.to || '?'}${relation.relationship ? ` — ${relation.relationship}` : ''}`);
}
console.log(`\nSUPPORTING SOURCES (${result.evidence.chunks.length} chunk(s))`);
for (const chunk of result.evidence.chunks) {
  console.log(`  • source: ${chunk.source_identity || '?'}`);
  console.log(`    chunk: ${chunk.chunk_id || '?'}`);
  console.log(`    passage: ${chunk.passage || '(empty)'}`);
}
if (!result.evidence.chunks.length) console.log(`  ${result.uncertainty}`);
