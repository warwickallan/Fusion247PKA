// Compile worker — drains Cairn's Learn-lane compile queue: claim a queued job → run the compiler
// → the encyclopedia grows. Runs once by default, or as a daemon with COMPILE_POLL_INTERVAL_S set.
//   node --env-file=C:/.fusion247/lightrag.env --env-file=C:/.fusion247/neo4j.env \
//     --env-file=C:/.fusion247/honcho.env --env-file=C:/.fusion247/fusion-capture-gateway.env \
//     src/bin/compile-worker.mjs
import { assertConfig } from '../config.mjs';
import { runCompileJobs } from '../core/compileQueue.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const INTERVAL = Number(process.env.COMPILE_POLL_INTERVAL_S || 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cycle() {
  const out = await runCompileJobs({ limit: Number(process.env.COMPILE_BATCH || 5) });
  if (out.length) console.log(`[${new Date().toISOString()}]`, out.map((j) => `${j.job_id?.slice(0, 8)}:${j.state}`).join(' · '));
  else console.log(`[${new Date().toISOString()}] no queued compile jobs`);
  return out;
}

if (INTERVAL > 0) {
  console.log(`compile-worker daemon — every ${INTERVAL}s (Ctrl-C to stop)`);
  for (;;) {
    try { await cycle(); } catch (e) { console.error('compile-worker error:', e.message); }
    await sleep(INTERVAL * 1000);
  }
} else {
  try { await cycle(); } catch (e) { console.error('❌ compile-worker failed:', e.message); process.exitCode = 1; }
  finally { await close(); }
}
