// Export a read-only snapshot of the encyclopedia for a dashboard (no OpenAI cost — DB reads only).
import { q, close } from '../clients/db.mjs';
import { rows as cyrows } from '../clients/neo4j.mjs';
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'snapshot.json';

const stats = (await cyrows('MATCH (c:OwaiConcept) RETURN count(c) AS concepts'))[0];
const rels = (await cyrows('MATCH (:OwaiConcept)-[r]->() RETURN count(r) AS rels'))[0];
const byType = await cyrows('MATCH (c:OwaiConcept) RETURN c.type AS type, count(c) AS n ORDER BY n DESC');
const topConcepts = await cyrows(
  `MATCH (c:OwaiConcept) OPTIONAL MATCH (c)-[r]->() RETURN c.canonical_name AS name, c.type AS type, count(r) AS deg ORDER BY deg DESC LIMIT 24`
);
const bySource = await cyrows('MATCH (c:OwaiConcept)-[:MENTIONED_IN]->(s:OwaiSource) RETURN s.source_id AS source, count(c) AS n ORDER BY n DESC');
const crossLinks = await cyrows(
  `MATCH (a:OwaiConcept)-[r]->(b:OwaiConcept) MATCH (a)-[:MENTIONED_IN]->(sa:OwaiSource) MATCH (b)-[:MENTIONED_IN]->(sb:OwaiSource)
   WHERE sa.source_id<>sb.source_id
   RETURN a.canonical_name AS from, type(r) AS rel, b.canonical_name AS to LIMIT 12`
);

const sources = (await q('select source_id, title, source_url from obsidiwikai.source order by first_seen')).rows;
const cards = (await q('select source_id, why_it_matters, how_changed from obsidiwikai.knowledge_card order by created_at desc limit 5')).rows;
const suggestions = (await q('select kind, summary, confidence, next_step, what_invalidates from obsidiwikai.suggestion order by created_at desc limit 8')).rows;
const lens = (await q("select label, horizon, weight from obsidiwikai.canonical_interest where status='active' order by horizon, weight desc")).rows;
const packets = (await q('select type, left(summary,60) summary, state from obsidiwikai.context_packet order by created_at desc limit 6')).rows;
const reviews = (await q("select question from obsidiwikai.review_item where status='open' limit 6")).rows;

writeFileSync(out, JSON.stringify({
  generated_at: new Date().toISOString(),
  stats: { concepts: stats.concepts, relationships: rels.rels, sources: sources.length, cross_source_links_shown: crossLinks.length },
  byType, topConcepts, bySource, crossLinks, sources, cards, suggestions, lens, packets, reviews,
}, null, 2));
console.log('wrote', out);
await close();
