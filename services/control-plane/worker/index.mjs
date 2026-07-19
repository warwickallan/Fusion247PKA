// BUILD-014 WP-B — durable worker runtime: public surface + optional manual entrypoint.
//
// Importing this module gives you the runtime pieces:
//   createPool, requireDatabaseUrl, enqueue, HandlerRegistry, Worker, Reclaimer,
//   appendEvent, hashPayload, createLogger.
//
// Running it directly (`node worker/index.mjs`) starts a demo runtime against
// $DATABASE_URL with a graceful-shutdown wire. This file NEVER auto-launches: the main()
// below runs ONLY when the file is the process entrypoint. In tests and library use it is
// inert. (Mack discipline: announce runtime, never auto-start it on import.)

import { createPool, requireDatabaseUrl } from './db.mjs';
import { enqueue } from './enqueue.mjs';
import { HandlerRegistry } from './handlers.mjs';
import { Worker, Reclaimer } from './worker.mjs';
import { appendEvent, hashPayload } from './events.mjs';
import { createLogger } from './util.mjs';
import { pathToFileURL } from 'node:url';

export {
  createPool, requireDatabaseUrl,
  enqueue,
  HandlerRegistry,
  Worker, Reclaimer,
  appendEvent, hashPayload,
  createLogger,
};

async function main() {
  const logger = createLogger();
  requireDatabaseUrl(); // fail-fast if unset
  const pool = createPool();

  const registry = new HandlerRegistry();
  // A minimal demo handler: records an idempotent effect event then succeeds.
  registry.register('demo', async (ctx) => {
    ctx.emit('demo.effect', {
      deliveryKey: ctx.effectKey('demo'),
      payload: { jobId: String(ctx.job.id) },
    });
    return { status: 'succeeded' };
  });

  const worker = new Worker(pool, registry, {
    workerId: process.env.WORKER_ID,
    leaseSeconds: Number(process.env.LEASE_SECONDS ?? 30),
    logger,
  });
  const reclaimer = new Reclaimer(pool, {
    intervalMs: Number(process.env.RECLAIM_INTERVAL_MS ?? 1000),
    logger,
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown.begin', { signal });
    worker.stop();
    reclaimer.stop();
    // give the current processOnce a moment to finish, then close the pool
    setTimeout(async () => {
      try { await pool.end(); } catch { /* best effort */ }
      logger.info('shutdown.complete');
      process.exit(0);
    }, 250);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  reclaimer.start();
  void enqueue; // exported for callers; not enqueuing here.
  await worker.runLoop((process.env.QUEUES ?? 'demo').split(',').map((s) => s.trim()));
}

// Only run when invoked directly — never on import. pathToFileURL normalises Windows
// backslash paths + drive letters so the comparison is correct cross-platform.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly || process.env.WORKER_MAIN === '1') {
  main().catch((err) => { console.error(err); process.exit(1); });
}
