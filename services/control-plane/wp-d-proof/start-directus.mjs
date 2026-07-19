// BUILD-014 WP-D increment 1 — start the local Directus cockpit (detached).
//
//   node wp-d-proof/start-directus.mjs
//
// Launches `directus start` as a detached background process bound to 127.0.0.1, writes a
// pidfile + log under .runtime, and prints the (localhost-only) cockpit URL. This ANNOUNCES
// the runtime; it does not open a browser for you. Stop it with stop-directus.mjs.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'directus');
const RUNTIME = path.join(__dirname, '.runtime');
const rt = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'runtime.json'), 'utf8'));

// Pre-flight: refuse to start if the port is already held (a stale Directus pointing at a
// dead cluster would otherwise answer /server/ping but 500 on real requests). Stop it first.
const port = rt.directus.port;
await new Promise((resolve) => {
  const probe = net.connect(port, '127.0.0.1');
  probe.on('connect', () => {
    probe.destroy();
    console.error(`[directus] port ${port} is already in use — a prior Directus is still running.`);
    console.error(`[directus] run: node wp-d-proof/stop.mjs   (or kill the process on ${port}) and retry.`);
    process.exit(1);
  });
  probe.on('error', () => { probe.destroy(); resolve(); });
});
const cli = path.join(DIR, 'node_modules', 'directus', 'cli.js');
const logFd = fs.openSync(path.join(RUNTIME, 'directus.log'), 'a');

const child = spawn(process.execPath, [cli, 'start'], {
  cwd: DIR, detached: true, stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.writeFileSync(path.join(RUNTIME, 'directus.pid'), String(child.pid));
console.log(`[directus] started (pid ${child.pid}). Cockpit (localhost-only): ${rt.directus.url}`);
console.log('[directus] ANNOUNCE ONLY — open that URL in your browser yourself; nothing is auto-launched.');
console.log(`[directus] admin login is in ${path.join(RUNTIME, 'runtime.json')} (gitignored).`);
