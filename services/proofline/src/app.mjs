// Proofline — process wiring.
//
// One place where store, worker and HTTP server are composed, so `bin/` and the
// test harness boot the SAME thing. Every seam a test needs (the fs façade, the
// writer factory, the recovery predicate, the analysis function, the trace
// sink) is an optional parameter that defaults to the production value — the
// tests do not get a different service, they get the same service with one
// named part swapped.

import fs from 'node:fs';

import { createStore, createDurableWriter } from './store.mjs';
import { createWorker } from './worker.mjs';
import { createHttpServer } from './server.mjs';
import { analyze } from './processor.mjs';
import { isOrphaned, MAX_ATTEMPTS } from './recovery.mjs';

function defaultLog(entry) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), service: 'proofline', ...entry })}\n`);
}

export async function createApp({
  journalPath,
  publicDir,
  host,
  port,
  scanIntervalMs = 1000,
  textLimitBytes,
  bodyLimitBytes,
  // --- injectable seams (all default to production behaviour) ---
  writerFactory = createDurableWriter,
  fsImpl = fs,
  analyzeFn = analyze,
  isOrphanedFn = isOrphaned,
  maxAttempts = MAX_ATTEMPTS,
  now = () => new Date().toISOString(),
  trace = () => {},
  log = defaultLog,
} = {}) {
  const store = createStore({ journalPath, writerFactory, fsImpl, now, log });

  const worker = createWorker({
    store,
    analyze: analyzeFn,
    isOrphaned: isOrphanedFn,
    scanIntervalMs,
    maxAttempts,
    trace,
    log,
  });

  const { server } = createHttpServer({ store, worker, publicDir, textLimitBytes, bodyLimitBytes, trace, log });

  let listening = false;

  return {
    store,
    worker,
    server,

    /** Startup recovery runs BEFORE the port is accepting connections. */
    async listen() {
      worker.start();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          listening = true;
          resolve();
        });
      });
      const addr = server.address();
      return { address: addr.address, port: addr.port, url: `http://${addr.address}:${addr.port}/` };
    },

    async close() {
      worker.stop();
      if (listening) {
        await new Promise((resolve) => server.close(resolve));
        listening = false;
      }
      store.close();
    },
  };
}
