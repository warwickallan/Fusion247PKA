// BUILD-015 AsdAIr Stage 1 - ensure-asdair-runtime.mjs
//
// THE SINGLE, SUPERVISED AsdAIr RUNTIME. Warwick authorised exactly this and no
// more (2026-07-28): one ShopperBot getUpdates consumer, the deterministic
// command worker, pipeline resumption for incomplete shops, and Windows
// logon/restart recovery. It is explicitly NOT an LLM daemon, not an autonomous
// browser, and it can never check out or pay.
//
//   node --env-file=<env> ensure-asdair-runtime.mjs [--stop] [--status]
//
// Modelled on the proven wp-d-proof/ensure-directus-live.mjs launcher, which is
// what already survives reboots on this machine.
//
// THE SINGLE-POLLER RULE IS THE WHOLE SAFETY ARGUMENT.
// Telegram getUpdates is a single-consumer, destructive-ack protocol with no
// lease or lock. Two pollers do not "share" the stream - they race it, and the
// realistic failure is a shopping list silently consumed and permanently lost
// with no error surfaced. So this launcher takes an exclusive PID lock and
// REFUSES to start a second instance. It does not "start anyway just in case".
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ENTRY = path.join(HERE, '..', 'pipeline', 'runtime.js');

// State lives OUTSIDE the public repo - the offset and the lock are operational
// state, and the repo is public.
const STATE_DIR = process.env.ASDAIR_RUNTIME_STATE_DIR
  || (process.platform === 'win32' ? 'C:/.fusion247/asdair' : path.join(os.homedir(), '.fusion247', 'asdair'));
const LOCK = path.join(STATE_DIR, 'runtime.pid');
const LOG = path.join(STATE_DIR, 'runtime.log');

const argv = new Set(process.argv.slice(2));

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readLock() {
  try {
    const pid = Number(fs.readFileSync(LOCK, 'utf8').trim());
    return pidAlive(pid) ? pid : null;   // stale lock from a killed process is not a live poller
  } catch { return null; }
}

function stop() {
  const pid = readLock();
  if (!pid) { console.log('[asdair-runtime] not running'); return 0; }
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  else process.kill(pid, 'SIGTERM');
  try { fs.rmSync(LOCK, { force: true }); } catch { /* best effort */ }
  console.log(`[asdair-runtime] stopped pid ${pid}`);
  return 0;
}

function status() {
  const pid = readLock();
  console.log(JSON.stringify({
    running: !!pid,
    pid: pid || null,
    entry: RUNTIME_ENTRY,
    state_dir: STATE_DIR,
    log: LOG,
    // The honest answer when we cannot tell, rather than an optimistic guess.
    note: pid ? 'exactly one poller holds the lock' : 'no poller running - a list arriving now will WAIT in Telegram, not be lost',
  }, null, 1));
  return 0;
}

function start() {
  const existing = readLock();
  if (existing) {
    // Refusing is the correct behaviour, not an inconvenience.
    console.log(`[asdair-runtime] already running as pid ${existing} - refusing to start a SECOND poller`);
    return 0;
  }
  if (!fs.existsSync(RUNTIME_ENTRY)) {
    console.error(`[asdair-runtime] runtime entry not found: ${RUNTIME_ENTRY}`);
    return 1;
  }
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const logFd = fs.openSync(LOG, 'a');
  const child = spawn(process.execPath, [RUNTIME_ENTRY, '--watch'], {
    cwd: path.join(HERE, '..', 'pipeline'),
    detached: true,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,           // credentials are CONSUMED from the environment, never read from disk here
  });
  child.unref();
  fs.writeFileSync(LOCK, String(child.pid));
  console.log(`[asdair-runtime] started pid ${child.pid} (log: ${LOG})`);
  return 0;
}

if (argv.has('--stop')) process.exit(stop());
else if (argv.has('--status')) process.exit(status());
else process.exit(start());
