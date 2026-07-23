// WP6 — ask the encyclopedia a grounded question (FR-019/FR-028). Combines LightRAG semantic
// retrieval (the answer, with source knowledge) with the Neo4j encyclopedia (related concepts +
// which sources they came from = provenance). This is how Larry/agents reason with evidence.
import { assertConfig } from '../config.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { rows as cyrows } from '../clients/neo4j.mjs';
import { close } from '../clients/db.mjs';

const question = process.argv.slice(2).join(' ') || 'What have I learned about backpropagation and how does it connect to language models?';

assertConfig();
console.log('Q:', question, '\n');

const answer = await lightrag.query(question, { mode: 'mix' });
console.log('=== grounded answer (LightRAG over your sources) ===');
console.log(typeof answer === 'string' ? answer.slice(0, 1400) : JSON.stringify(answer).slice(0, 1400));

// Provenance from the curated encyclopedia: concepts related to the question's key terms + their sources.
const terms = question.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 4).slice(0, 6);
const related = await cyrows(
  `MATCH (c:OwaiConcept)
   WHERE any(t IN $terms WHERE toLower(c.canonical_name) CONTAINS toLower(t))
   OPTIONAL MATCH (c)-[:MENTIONED_IN]->(s:OwaiSource)
   RETURN c.canonical_name AS concept, c.type AS type, collect(DISTINCT s.source_id) AS sources
   LIMIT 12`,
  { terms }
);
console.log('\n=== encyclopedia provenance (curated Neo4j) ===');
if (related.length) related.forEach((r) => console.log(`  • ${r.concept} [${r.type}] ← ${(r.sources || []).filter(Boolean).join(', ') || 'source'}`));
else console.log('  (no directly-named concepts; the answer above draws on retrieval across all sources)');

await close();
