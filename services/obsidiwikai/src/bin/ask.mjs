// WP6 — grounded, read-only Brain question from the command line.
import { assertRetrievalConfig } from '../config.mjs';
import { brainAccess } from '../core/brainAccess.mjs';

const question = process.argv.slice(2).join(' ')
  || 'What have I learned about backpropagation and how does it connect to language models?';

assertRetrievalConfig();
const result = await brainAccess.ask(question);

console.log(`Q: ${result.query}\n`);
console.log(result.answer);
console.log('\nSUPPORTING CONCEPTS');
for (const entity of result.evidence.entities) {
  console.log(`  • ${entity.name}${entity.type ? ` [${entity.type}]` : ''}`);
}
console.log('\nRELATIONSHIPS');
for (const relation of result.evidence.relationships) {
  console.log(`  • ${relation.from || '?'} → ${relation.to || '?'}: ${relation.relationship || 'related'}`);
}
console.log('\nSOURCE / CHUNK TRACE');
for (const chunk of result.evidence.chunks) {
  console.log(`  • ${chunk.source_identity || 'source'}${chunk.chunk_id ? ` / ${chunk.chunk_id}` : ''}`);
  if (chunk.passage) console.log(`    ${chunk.passage}`);
}
if (!result.evidence.chunks.length) console.log('  (no supporting source passage returned)');
console.log(`\nUNCERTAINTY: ${result.uncertainty}`);
console.log(`ADVISORY: ${result.advisory}`);
