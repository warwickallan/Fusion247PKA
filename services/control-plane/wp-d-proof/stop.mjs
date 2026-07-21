// BUILD-014 WP-D increment 1 — tear down the disposable proof cluster.
//   node wp-d-proof/stop.mjs
// Stops the Postgres server (immediate) and deletes the entire .runtime dir.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime');
const CLUSTER = path.join(RUNTIME, 'cluster');

function bin(name) {
  const dir = process.env.POSTGRES_BIN;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return dir ? path.join(dir, exe) : exe;
}

// Stop Directus first (pidfile written by start-directus.mjs), if running.
const pidFile = path.join(RUNTIME, 'directus.pid');
if (fs.existsSync(pidFile)) {
  const pid = fs.readFileSync(pidFile, 'utf8').trim();
  if (pid) {
    const k = process.platform === 'win32'
      ? spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { encoding: 'utf8' })
      : spawnSync('kill', ['-9', pid], { encoding: 'utf8' });
    console.log('[stop] directus stop:', k.status === 0 ? `killed pid ${pid}` : (k.stderr || 'not running'));
  }
}

if (fs.existsSync(path.join(CLUSTER, 'PG_VERSION'))) {
  const r = spawnSync(bin('pg_ctl'), ['-D', CLUSTER, '-w', '-m', 'immediate', 'stop'], { encoding: 'utf8' });
  console.log('[stop] pg_ctl stop:', r.status === 0 ? 'stopped' : (r.stderr || r.stdout || 'not running'));
}
try { fs.rmSync(RUNTIME, { recursive: true, force: true }); console.log('[stop] removed .runtime'); }
catch (e) { console.error('[stop] could not remove .runtime:', e.message); }
