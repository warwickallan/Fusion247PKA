// BUILD-014 LIVE cockpit — start the local Directus (detached, 127.0.0.1 only). ANNOUNCE ONLY:
// it prints the localhost URL; it does NOT open a browser. Stop with stop-live.mjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'directus');
const RUNTIME = path.join(__dirname, '.runtime-live');
const rt = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'runtime.json'), 'utf8'));
const port = rt.directus.port;

await new Promise((resolve) => {
  const probe = net.connect(port, '127.0.0.1');
  probe.on('connect', () => {
    probe.destroy();
    console.error(`[live] port ${port} already in use — run node wp-d-proof/stop-live.mjs first.`);
    process.exit(1);
  });
  probe.on('error', () => { probe.destroy(); resolve(); });
});

const cli = path.join(DIR, 'node_modules', 'directus', 'cli.js');
const logFd = fs.openSync(path.join(RUNTIME, 'directus.log'), 'a');
const child = spawn(process.execPath, [cli, 'start'], { cwd: DIR, detached: true, stdio: ['ignore', logFd, logFd] });
child.unref();
fs.writeFileSync(path.join(RUNTIME, 'directus.pid'), String(child.pid));
console.log(`[live] started (pid ${child.pid}). Cockpit (localhost-only): ${rt.directus.url}`);
console.log('[live] ANNOUNCE ONLY — open that URL yourself; nothing is auto-launched.');
