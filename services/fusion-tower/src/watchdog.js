// Fusion Tower — standalone 5-minute dead-man watchdog.
//
// Runs as an INDEPENDENT Scheduled Task (separate failure domain from the main
// dispatcher service, per Pax Item 4): every 5 minutes it sweeps dispatched turns
// whose lease expired and drives each reaped turn's run to retry-within-budget or
// a terminal timed_out. A single sweep then exits — it is safe to run on any
// cadence and never clobbers a genuine return (only touches state='dispatched').
//
// Fail-closed: without DATABASE_URL it runs against the in-memory store (a no-op
// against an empty store) and records that live wiring is gated — it never crashes.

import { loadConfig } from './config.js';
import { createMemoryStore } from './store/memoryStore.js';
import { createDispatcher } from './dispatcher.js';

export async function runWatchdogOnce({ env = process.env } = {}) {
  const config = loadConfig(env);
  let store;
  if (config.isRuntimeReady()) {
    const { createPostgresStore } = await import('./store/postgresStore.js');
    store = await createPostgresStore({ connectionString: config.databaseUrl, caFile: config.databaseSslCaFile });
  } else {
    store = createMemoryStore();
  }
  const dispatcher = createDispatcher({ store, config });
  const result = await dispatcher.watchdog();
  await store.end();
  return { fixturesMode: config.fixturesMode, ...result };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('watchdog.js')) {
  runWatchdogOnce()
    .then((r) => {
      process.stdout.write(JSON.stringify({ service: 'fusion-tower-watchdog', event: 'sweep', ...r }) + '\n');
      process.exit(0);
    })
    .catch((err) => {
      process.stderr.write(JSON.stringify({ service: 'fusion-tower-watchdog', event: 'error', error: String(err?.message ?? err) }) + '\n');
      process.exit(1);
    });
}
