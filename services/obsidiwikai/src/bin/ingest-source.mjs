// Ingest a text source into LightRAG (extraction engine) and wait for the pipeline to finish.
// Usage: node --env-file=... src/bin/ingest-source.mjs <sourceId> <textFile>
import { readFileSync } from 'node:fs';
import { assertConfig } from '../config.mjs';
import { lightrag } from '../clients/lightrag.mjs';

const sourceId = process.argv[2];
const file = process.argv[3];
if (!sourceId || !file) { console.error('usage: ingest-source <sourceId> <textFile>'); process.exit(1); }

assertConfig();
const text = readFileSync(file, 'utf8');
console.log(`ingesting ${text.length} chars as LightRAG source '${sourceId}'…`);
const ins = await lightrag.ingestText(text, { source: sourceId });
const trackId = ins.track_id;
console.log('track_id:', trackId, '| initial status:', ins.status);

let done = false;
for (let i = 0; i < 60 && !done; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  let st;
  try { st = await lightrag.trackStatus(trackId); } catch (e) { console.log(`  [${i}] poll error: ${e.message}`); continue; }
  const blob = JSON.stringify(st).toLowerCase();
  const summary = st.status || (st.documents && st.documents[0] && st.documents[0].status) || blob.slice(0, 90);
  console.log(`  [${i}] ${typeof summary === 'string' ? summary : JSON.stringify(summary)}`);
  if (blob.includes('"processed"') || blob.includes('failed') || blob.includes('"completed"')) done = true;
}
const counts = await lightrag.statusCounts().catch(() => null);
console.log('status_counts:', JSON.stringify(counts));
console.log(done ? '✅ INGEST DONE' : '⏳ poll window ended (may still be processing)');
