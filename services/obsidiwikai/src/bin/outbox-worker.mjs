// Context Outbox worker — drains queued packets to Honcho (once) with receipts.
// Usage: node --env-file=... src/bin/outbox-worker.mjs [--watch]
import { assertConfig } from '../config.mjs';
import { processQueue } from '../core/contextOutbox.mjs';
import { close } from '../clients/db.mjs';

assertConfig();
const watch = process.argv.includes('--watch');

async function tick() {
  const r = await processQueue({ limit: 20 });
  if (r.length) console.log(new Date().toISOString(), JSON.stringify(r));
  return r.length;
}

if (watch) {
  console.log('outbox worker watching (10s)…');
  // eslint-disable-next-line no-constant-condition
  for (;;) { await tick(); await new Promise((r) => setTimeout(r, 10000)); }
} else {
  const n = await tick();
  console.log(n ? `delivered/processed ${n} packet(s)` : 'nothing queued');
  await close();
}
