// BUILD-014 Tower — launcher for the Supabase control-plane watcher (tower-loop/watcher.mjs).
//
// Starts the CORRECT watcher (NOT the BUILD-010 tower-baton) against the Tower DEV Supabase, with the
// REAL Codex reviewer + REAL TowerBot notifications, detached + logged. Single-instance: kills any
// existing tower-loop/watcher.mjs first so no duplicate watcher runs. Secrets are read from
// C:\.fusion247 (DB from control-plane-dev.env, TowerBot token/chat from tower-baton.env) and passed
// via the child's env — never on a command line, never logged.
//
//   node services/control-plane/tower-loop/run-watcher.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WATCHER = path.join(HERE, 'watcher.mjs');
// F3 — the launcher runs the watcher from ITS OWN checkout (…/tower-loop → up 3 = repo root),
// never a hardcoded mutable path. Point autostart at the stable Tower worktree and both the
// watcher code AND its git-evidence REPO_ROOT are pinned to that stable location by construction.
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const LOGDIR = 'C:/.fusion247/logs/tower-control-plane';
fs.mkdirSync(LOGDIR, { recursive: true });

function readEnvFile(p) {
  const out = {};
  try { for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) out[m[1]] = m[2].trim(); } } catch {}
  return out;
}
const dbEnv = readEnvFile('C:/.fusion247/control-plane-dev.env');
const botEnv = readEnvFile('C:/.fusion247/tower-baton.env');
if (!dbEnv.CONTROL_PLANE_DEV_DATABASE_URL) { console.error('missing CONTROL_PLANE_DEV_DATABASE_URL'); process.exit(1); }
if (!botEnv.TELEGRAM_BOT_TOKEN || !botEnv.AUTHORISED_TELEGRAM_USER_ID) { console.error('missing TowerBot TELEGRAM_BOT_TOKEN / AUTHORISED_TELEGRAM_USER_ID'); process.exit(1); }

// Single-instance: kill any existing control-plane watcher (NOT the tower-baton — matched on watcher.mjs path).
spawnSync('powershell', ['-NoProfile', '-Command',
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*tower-loop*watcher.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
  { windowsHide: true });

const childEnv = {
  ...process.env,
  CONTROL_PLANE_DEV_DATABASE_URL: dbEnv.CONTROL_PLANE_DEV_DATABASE_URL,
  TELEGRAM_BOT_TOKEN: botEnv.TELEGRAM_BOT_TOKEN,
  AUTHORISED_TELEGRAM_USER_ID: botEnv.AUTHORISED_TELEGRAM_USER_ID,
  WATCHER_ID: process.env.WATCHER_ID || `${os.hostname()}#cp#${Date.now()}`,
  WATCHER_POLL_MS: process.env.WATCHER_POLL_MS || '3000',
  // Pin the merge-check git-evidence root to this stable checkout (not the mutable working tree).
  TOWER_EVIDENCE_REPO_DIR: process.env.TOWER_EVIDENCE_REPO_DIR || REPO_ROOT,
};
// REAL reviewer + REAL notifications: ensure the test doubles are NOT inherited.
delete childEnv.TOWER_NOTIFY_TRANSPORT;
delete childEnv.TOWER_REVIEWER_MODULE;
delete childEnv.TOWER_GIT_EVIDENCE_MODULE;

const logFd = fs.openSync(path.join(LOGDIR, 'watcher.log'), 'a');
const child = spawn(process.execPath, [WATCHER], { cwd: REPO_ROOT, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd], env: childEnv });
child.unref();
console.log(`[tower-cp] started tower-loop/watcher.mjs pid ${child.pid} as WATCHER_ID=${childEnv.WATCHER_ID}. Log: ${LOGDIR}/watcher.log`);
