// WP1.5 runner — enrich ONE source: lens-condition + conservatively canonicalise on the ONE
// authoritative LightRAG→Neo4j graph.
//   node $ENVS src/bin/enrich-source.mjs <sourceId>          # OBSERVE — record decisions, NO mutation
//   node $ENVS src/bin/enrich-source.mjs <sourceId> --apply  # conservative live apply (≥0.85 only)
import { assertConfig } from '../config.mjs';
import { enrichSource } from '../core/learnEnrich.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const sourceId = process.argv[2];
const apply = process.argv.includes('--apply');
const reportFlag = process.argv.indexOf('--report');
const reportId = reportFlag > -1 ? process.argv[reportFlag + 1] : null;
if (!sourceId) {
  console.error('usage: enrich-source.mjs <sourceId> [--apply] [--report <reportId>]');
  process.exit(1);
}
try {
  console.log(`WP1.5 enrich ${sourceId} — ${apply ? 'LIVE APPLY' : 'OBSERVE (no mutation)'}${reportId ? ` (report=${reportId})` : ''}`);
  const r = await enrichSource(sourceId, { apply, reportId });
  console.log(JSON.stringify(r, null, 2));
} finally {
  await close();
}
