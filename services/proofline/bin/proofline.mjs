#!/usr/bin/env node
// Proofline — the entrypoint. This is what the launcher, the runbook and any
// manual start all invoke. There is no second startup path.
//
// Stop is abrupt on Windows, by design. See RUNBOOK.md §Stopping: there is no
// signal-delivered graceful shutdown path on win32, and Proofline does not
// pretend to have one. Every acknowledged record is already fsynced, so an
// abrupt stop loses nothing that was acknowledged, and a job caught mid-flight
// is re-queued on the next start.

import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/app.mjs';

function log(entry) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), service: 'proofline', ...entry })}\n`);
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log({ level: 'fatal', event: 'config.invalid', message: err.message });
    process.exit(2);
  }

  log({ level: 'info', event: 'starting', dataDir: config.dataDir, host: config.host, port: config.port });

  const app = await createApp({ ...config, log });
  const { url, address, port } = await app.listen();

  log({
    level: 'info',
    event: 'listening',
    url,
    address,
    port,
    epoch: app.store.epoch,
    counts: app.store.counts(),
    note: 'loopback only — this service is not reachable from another machine',
  });
}

main().catch((err) => {
  log({ level: 'fatal', event: 'startup_failed', message: err.message, stack: err.stack });
  process.exit(1);
});
