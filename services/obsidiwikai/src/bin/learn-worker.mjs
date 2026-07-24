// Learn worker — drains Cairn's LEARN queue: KEEP → retained; LEARN → faithful-clean §7.1 into
// LightRAG → Neo4JStorage. Then reconciles the health check (searchable+represented, or visibly
// failed). Runs once, or as a daemon with LEARN_POLL_INTERVAL_S set.
//   node --env-file=C:/.fusion247/lightrag.env --env-file=C:/.fusion247/neo4j.env \
//     --env-file=C:/.fusion247/honcho.env --env-file=C:/.fusion247/fusion-capture-gateway.env \
//     src/bin/learn-worker.mjs
import { assertConfig } from '../config.mjs';
import { runLearnQueue, reconcileLearn } from '../core/learnIngest.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const INTERVAL = Number(process.env.LEARN_POLL_INTERVAL_S || 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cycle() {
  const ingested = await runLearnQueue({ limit: Number(process.env.LEARN_BATCH || 5) });
  const reconciled = await reconcileLearn({});
  const parts = [];
  if (ingested.length) parts.push('ingest ' + ingested.map((j) => `${(j.source || j.job_id || '').toString().slice(0, 16)}:${j.state}`).join(' '));
  if (reconciled.length) parts.push('reconcile ' + reconciled.map((j) => `${(j.source || '').slice(0, 16)}:${j.state}`).join(' '));
  console.log(`[${new Date().toISOString()}] ${parts.join(' | ') || 'no learn jobs'}`);
  return { ingested, reconciled };
}

if (INTERVAL > 0) {
  console.log(`learn-worker daemon — every ${INTERVAL}s (Ctrl-C to stop)`);
  for (;;) {
    try { await cycle(); } catch (e) { console.error('learn-worker error:', e.message); }
    await sleep(INTERVAL * 1000);
  }
} else {
  try { await cycle(); } catch (e) { console.error('❌ learn-worker failed:', e.message); process.exitCode = 1; }
  finally { await close(); }
}
