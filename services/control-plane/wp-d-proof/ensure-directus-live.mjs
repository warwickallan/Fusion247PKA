// BUILD-014 — self-healing Directus supervisor. Directus boots INTERMITTENTLY on this machine
// (some boots wedge early, before the DB connect; a fresh DB connection itself is fine). This
// launcher makes the boot RELIABLE: start -> wait for /server/ping -> if it doesn't bind in
// BIND_TIMEOUT, kill and retry, up to MAX_TRIES. It doubles as the reboot-recovery mechanism.
//
//   node wp-d-proof/ensure-directus-live.mjs
//
// Detached, fail-safe, single-instance: kills any existing Directus cli.js first so there is
// never a second binder. Prints each attempt. Exits 0 on bind, 1 if it never binds.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'directus');
const RUNTIME = path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime-live');
const cli = path.join(DIR, 'node_modules', 'directus', 'cli.js');
const PORT = 8074;
const BIND_TIMEOUT_MS = 75_000;
const MAX_TRIES = 8;

function killExisting() {
  spawnSync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*directus*cli.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
    { windowsHide: true });
}
async function pingOnce() {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000);
    const r = await fetch(`http://127.0.0.1:${PORT}/server/ping`, { signal: c.signal }); clearTimeout(t);
    return r.ok && (await r.text()).includes('pong');
  } catch { return false; }
}
function startOne() {
  fs.mkdirSync(RUNTIME, { recursive: true });
  const logFd = fs.openSync(path.join(RUNTIME, 'directus.log'), 'a');
  const child = spawn(process.execPath, [cli, 'start'], {
    cwd: DIR, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd],
    env: { ...process.env, NO_UPDATE_NOTIFIER: '1', TELEMETRY: 'false' },
  });
  child.unref();
  fs.writeFileSync(path.join(RUNTIME, 'directus.pid'), String(child.pid));
  return child.pid;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// If it's already up, do nothing.
if (await pingOnce()) { console.log('[directus] already online'); process.exit(0); }

for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
  killExisting();
  await sleep(1500);
  try { fs.rmSync(path.join(RUNTIME, 'directus.log'), { force: true }); } catch {}
  const pid = startOne();
  console.log(`[directus] attempt ${attempt}/${MAX_TRIES} — started pid ${pid}, waiting for bind…`);
  const deadline = Date.now() + BIND_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(4000);
    if (await pingOnce()) { console.log(`[directus] ONLINE on attempt ${attempt} (pid ${pid}) — http://127.0.0.1:${PORT}`); process.exit(0); }
  }
  console.log(`[directus] attempt ${attempt} did not bind in ${BIND_TIMEOUT_MS / 1000}s — retrying`);
}
console.log(`[directus] FAILED to bind after ${MAX_TRIES} attempts`);
process.exit(1);
