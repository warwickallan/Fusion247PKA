// Fusion Tower — always-on runtime entrypoint.
//
// Wires config -> store -> adapters -> dispatcher -> terminal notifier, and runs
// a restart-safe SHORT-POLL loop with a per-loop heartbeat and an in-loop watchdog
// sweep. Designed to be hosted by NSSM (or a Scheduled Task) on the always-on
// Windows host — see src/host/ + Architecture/tower-host-runbook.md.
//
// ANNOUNCE-DON'T-LAUNCH (BUILD-002 doctrine): this file is the runtime the host
// starts; nothing here auto-installs a service or connects to a live external
// surface beyond the configured store. In fixtures mode (no DATABASE_URL) it runs
// against the in-memory store and records blockers — it never crashes.

import { loadConfig } from './config.js';
import { createMemoryStore } from './store/memoryStore.js';
import { createDispatcher } from './dispatcher.js';
import { createLarryAdapter } from './adapters/larryAdapter.js';
import { createCodexAdapter } from './adapters/codexAdapter.js';
import { createTelegramControls } from './adapters/telegramControls.js';

/**
 * Build the runtime object (no loop started). Returns { config, store, dispatcher,
 * controls, adapters, tick, start, stop }.
 */
export async function createTowerRuntime({ env = process.env, cwd = process.cwd() } = {}) {
  const config = loadConfig(env);

  // Store: real Postgres when DATABASE_URL is present, else the in-memory fixture.
  let store;
  if (config.isRuntimeReady()) {
    const { createPostgresStore } = await import('./store/postgresStore.js');
    store = await createPostgresStore({ connectionString: config.databaseUrl, caFile: config.databaseSslCaFile });
  } else {
    store = createMemoryStore();
  }

  // Adapters. In fixtures mode both run fail-closed (record-blocker) unless the
  // gated credentials/binaries are present.
  const larry = createLarryAdapter({ config, cwd, mode: config.fixturesMode ? 'record-blocker' : 'auto' });
  const gpt_codex = createCodexAdapter({ config, cwd, mode: 'auto' }); // auto self-blocks without key/binary
  const adapters = { larry, gpt_codex };

  const dispatcher = createDispatcher({ store, config, adapters });
  const controls = createTelegramControls({ config, dispatcher });
  // Late-bind the terminal-only Telegram notifier now that both exist.
  dispatcher.setNotifier(controls.notifier);

  let running = false;
  let timer = null;
  const heartbeat = { at: null, ticks: 0 };

  async function tick() {
    heartbeat.at = Date.now();
    heartbeat.ticks += 1;
    // 1. Watchdog: reap silent turns, retry-within-budget or terminalise.
    await dispatcher.watchdog();
    // 2. Drain unprocessed, non-self events (advance-once). The concrete run
    //    advance is orchestrated by higher-level logic / the E2E proof; here we
    //    only guarantee exactly-once consume for bound events.
    // (Left intentionally minimal in WP0 runtime; the proof exercises the full path.)
    return { heartbeat: { ...heartbeat } };
  }

  return {
    config,
    store,
    dispatcher,
    controls,
    adapters,
    heartbeat,
    tick,
    async start({ intervalMs = 15000 } = {}) {
      if (running) return;
      running = true;
      const loop = async () => {
        if (!running) return;
        try { await tick(); } catch { /* a tick failure never kills the loop */ }
        if (running) timer = setTimeout(loop, intervalMs);
      };
      await loop();
    },
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
      await store.end();
    },
  };
}

// Direct-run entrypoint (NSSM / Scheduled Task target). Announces status; never
// auto-installs. Prints a masked config snapshot and starts the loop.
async function main() {
  const runtime = await createTowerRuntime();
  const snapshot = runtime.config.describe();
  // Structured, secret-masked startup log.
  process.stdout.write(JSON.stringify({ service: 'fusion-tower', event: 'startup', config: snapshot }) + '\n');
  if (runtime.config.fixturesMode) {
    process.stdout.write(JSON.stringify({ service: 'fusion-tower', event: 'fixtures-mode', note: 'DATABASE_URL unset — running against in-memory store; live wiring gated' }) + '\n');
  }
  const shutdown = async () => { await runtime.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await runtime.start();
}

// Only run main() when executed directly, never on import.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('tower.js')) {
  main().catch((err) => {
    process.stderr.write(JSON.stringify({ service: 'fusion-tower', event: 'fatal', error: String(err?.message ?? err) }) + '\n');
    process.exit(1);
  });
}
