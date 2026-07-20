// BUILD-014 PR-3b — notifier runtime ASSEMBLY (wire-up, no auto-launch).
//
// This module ASSEMBLES the sender: a pg Pool + an INJECTED transport + the Notifier loop + the
// SendingWatchdog. It does NOT auto-start against real Telegram. Per the campaign boundary and
// the myPKA "never auto-launch a runtime" rule, turning on real delivery is a SEPARATE, GATED
// LIVE step — the caller must EXPLICITLY inject a transport. In DEV the only transport is the
// fake (createFakeTransport); the real Telegram transport is not wired here.

import { createPool } from '../worker/db.mjs';
import { createLogger } from '../worker/util.mjs';
import { Notifier, SendingWatchdog } from './notifier.mjs';

/**
 * Assemble a notifier runtime. The transport is REQUIRED and INJECTED — there is no default,
 * so a runtime can never silently come up on an unintended delivery path.
 *
 * @param {object} cfg
 * @param {{ send(payload): Promise<{ok:boolean}> }} cfg.transport  REQUIRED injected transport.
 * @param {string[]} [cfg.destinations]   logical channels to serve (default ['warwick_primary']).
 * @param {string}   [cfg.connectionString]  DATABASE_URL override (isolated dev Postgres only).
 * @param {object}   [cfg.notifierOpts]   forwarded to Notifier.
 * @param {object}   [cfg.watchdogOpts]   forwarded to SendingWatchdog.
 * @returns {{ pool, notifier, watchdog, destinations, start(): void, stop(): Promise<void> }}
 */
export function createNotifierRuntime(cfg = {}) {
  if (!cfg.transport || typeof cfg.transport.send !== 'function') {
    throw new Error(
      'createNotifierRuntime: a transport MUST be injected (e.g. createFakeTransport() in DEV). ' +
      'The real Telegram transport is a separate, gated LIVE step — never wired here.');
  }
  const logger = cfg.logger ?? createLogger({ base: { component: 'notifier-runtime' } });
  const pool = createPool({ connectionString: cfg.connectionString });
  const destinations = cfg.destinations ?? ['warwick_primary'];
  const notifier = new Notifier(pool, cfg.transport, { logger, ...(cfg.notifierOpts ?? {}) });
  const watchdog = new SendingWatchdog(pool, { logger, ...(cfg.watchdogOpts ?? {}) });

  return {
    pool, notifier, watchdog, destinations,
    start() {
      logger.info('notifier_runtime.start', { destinations, transport: cfg.transport.kind ?? 'injected' });
      watchdog.start();
      // Fire-and-forget the poll loop; stop() halts both.
      notifier.runLoop(destinations);
    },
    async stop() {
      notifier.stop();
      watchdog.stop();
      await pool.end();
      logger.info('notifier_runtime.stopped');
    },
  };
}

// Direct-run guard: this file is NOT a launcher. Running it does not open a Telegram send path;
// it prints how the sender is wired and refuses to auto-launch a live runtime.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.mjs')) {
  console.log(
    '[notifier] BUILD-014 PR-3b notifier assembly. This module does NOT auto-launch.\n' +
    '  · DEV/tests: inject createFakeTransport() and drive Notifier.processOnce / drain.\n' +
    '  · Proofs:    node services/control-plane/notifier/test/run-notifier-tests.mjs\n' +
    '  · LIVE:      wiring the real Telegram transport is a separate, gated step (a real bot\n' +
    '               token + chat-id from a notifier-only secret store, Warwick go-ahead) — NOT DEV.');
}
