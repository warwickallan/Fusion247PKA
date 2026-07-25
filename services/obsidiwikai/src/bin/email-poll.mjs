// Poll the Fusion247 mailbox: retrieve new mail → durable capture → hand capture_id to Cairn.
// The adapter owns NONE of the routing; Cairn decides the destination. Runs once by default, or
// as a daemon with EMAIL_POLL_INTERVAL_S set (Hetzner watches; the Yoga can be off).
//   node --env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/lightrag.env \
//     --env-file=C:/.fusion247/neo4j.env --env-file=C:/.fusion247/honcho.env \
//     --env-file=C:/.fusion247/obsidiwikai.env services/obsidiwikai/src/bin/email-poll.mjs
import { assertConfig } from '../config.mjs';
import { graph } from '../clients/msgraph.mjs';
import { emailStore } from '../sources/emailStore.mjs';
import { createEmailSource } from '../sources/email.mjs';
import { routeCapture } from '../cairn/cairn.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const INTERVAL = Number(process.env.EMAIL_POLL_INTERVAL_S || 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = createEmailSource({ graph, store: emailStore, route: routeCapture, log: (m) => console.log('·', m) });

async function cycle() {
  await src.routeUnrouted();          // recover any previously-captured-but-unrouted mail first
  const r = await src.pollOnce();
  console.log(`[${new Date().toISOString()}] captured ${r.captured} · routed ${r.routed} · skipped ${r.skipped}`);
}

if (INTERVAL > 0) {
  console.log(`email-poll daemon — every ${INTERVAL}s (Ctrl-C to stop)`);
  for (;;) {
    try { await cycle(); } catch (e) { console.error('poll error:', e.message); }
    await sleep(INTERVAL * 1000);
  }
} else {
  try { await cycle(); } catch (e) { console.error('❌ poll failed:', e.message); process.exitCode = 1; }
  finally { await close(); }
}
