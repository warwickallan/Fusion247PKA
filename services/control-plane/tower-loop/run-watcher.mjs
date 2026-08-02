// BUILD-014 Tower — launcher for the tower-loop control-plane watcher (tower-loop/watcher.mjs).
//
// Starts the CORRECT watcher (NOT the BUILD-010 tower-baton) against the durable SQLite store,
// with the REAL Codex reviewer, the REAL TowerBot notifications and the WO-TW-02 PR-comment poll
// enabled, detached and logged. Single-instance: any existing tower-loop watcher is stopped first
// so two watchers never race for the same turns.
//
//   node services/control-plane/tower-loop/run-watcher.mjs
//
// ── WO-TW-02: three things about this file changed, and each was a real defect ────────────────
//
// 1. IT NO LONGER READS ANYTHING UNDER C:\.fusion247\. It used to load `control-plane-dev.env`
//    and `tower-baton.env` and inject their values into the child. That is credential handling,
//    and it belongs to whoever operates the service, not to the code. The launcher now VALIDATES
//    that the variables exist in its own environment and refuses to start when one does not.
//    Supplying them is the operator's job — on this estate that means
//    `node --env-file=<file> run-watcher.mjs`, exactly as every other service here is started.
//
//    THE CONSEQUENCE IS INTENDED: launching with a bare environment now FAILS, naming the
//    missing variable, instead of silently working. A launcher that silently works on wrong
//    configuration is how an estate ends up believing a control is live when it is inert.
//
// 2. IT SETS TOWER_SQLITE_PATH EXPLICITLY. Before, it gated on a Postgres URL the subsystem no
//    longer uses and never set the store path at all — so a watcher launched through it would
//    demand a database it does not talk to, then quietly use whatever the default resolved to.
//    The path is resolved HERE, logged, and passed to the child, so what the watcher opened is
//    visible in the launcher's own output rather than inferred.
//
// 3. NOTHING HAPPENS ON IMPORT. Every side effect below — creating the log directory, stopping
//    the running watcher, spawning a new one — now sits behind a main guard. The previous version
//    did all three at MODULE SCOPE, so `import('./run-watcher.mjs')` from any test or tool would
//    mkdir into the secrets-store tree, read two credential files, and `Stop-Process -Force`
//    every matching node process. Documenting that landmine is not the same as removing it.
//
// STATE LIVES OUTSIDE THE CHECKOUT, and that is not a detail. The store is ~/.mypka/tower/tower.db
// and the logs are ~/.mypka/tower/logs/ — never a worktree, a temp dir or a scratchpad. A daemon
// pinned to disposable storage loses its durable state silently, and silence from this watcher is
// indistinguishable from "nothing to review".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaultDbPath } from './db.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WATCHER = path.join(HERE, 'watcher.mjs');
// The launcher runs the watcher from ITS OWN checkout (…/tower-loop → up 3 = repo root), never a
// hardcoded mutable path. Point autostart at the stable Tower worktree and both the watcher code
// AND its git-evidence REPO_ROOT are pinned to that stable location by construction.
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const LOG_DIR = path.join(os.homedir(), '.mypka', 'tower', 'logs');

/**
 * The configuration contract, validated at startup.
 *
 * Keel owns the SCHEMA and the validation; Mack owns the VALUES and where they live. That split
 * is why this function names variables and never reads a secret store: it can tell you a token is
 * missing without ever being able to tell you what it is.
 *
 * @returns {{ok:true, notify:string} | {ok:false, missing:string[], hint:string}}
 */
export function validateEnv(env = process.env) {
  // An explicit `TOWER_NOTIFY_TRANSPORT=none` is a deliberate no-Telegram run (rehearsal, a
  // second watcher, a host without the bot). Anything else means notifications are expected to
  // work, and a watcher that cannot notify is a watcher whose failures are invisible.
  if (String(env.TOWER_NOTIFY_TRANSPORT ?? '') === 'none') return { ok: true, notify: 'disabled' };

  const required = ['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID'];
  const missing = required.filter((k) => !env[k] || String(env[k]).trim() === '');
  if (missing.length === 0) return { ok: true, notify: 'enabled' };
  return {
    ok: false,
    missing,
    hint: "Supply it in the launcher's own environment — e.g. "
      + '`node --env-file=<your env file> run-watcher.mjs` — or set TOWER_NOTIFY_TRANSPORT=none '
      + 'to start deliberately without TowerBot notifications.',
  };
}

/** Stop any running tower-loop watcher. Matched on the watcher.mjs path so the BUILD-010
 *  tower-baton (a different process in a different subsystem) is never touched. */
function stopExistingWatcher() {
  spawnSync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*tower-loop*watcher.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
    { windowsHide: true });
}

export function main() {
  const check = validateEnv();
  if (!check.ok) {
    console.error(`[tower-cp] REFUSING TO START — missing required environment variable(s): ${check.missing.join(', ')}`);
    console.error(`[tower-cp] ${check.hint}`);
    process.exit(1);
  }

  const dbPath = defaultDbPath();
  fs.mkdirSync(LOG_DIR, { recursive: true });

  stopExistingWatcher();

  const childEnv = {
    ...process.env,
    // Explicit, so the child can never disagree with what this launcher just logged.
    TOWER_SQLITE_PATH: dbPath,
    WATCHER_ID: process.env.WATCHER_ID || `${os.hostname()}#cp#${Date.now()}`,
    WATCHER_POLL_MS: process.env.WATCHER_POLL_MS || '3000',
    // Pin the merge-check git-evidence root to this stable checkout (not the mutable working tree).
    TOWER_EVIDENCE_REPO_DIR: process.env.TOWER_EVIDENCE_REPO_DIR || REPO_ROOT,
  };
  // REAL reviewer, REAL git evidence, REAL `gh`: ensure no test double is inherited.
  delete childEnv.TOWER_REVIEWER_MODULE;
  delete childEnv.TOWER_GIT_EVIDENCE_MODULE;
  delete childEnv.TOWER_GH_MODULE;

  const logFile = path.join(LOG_DIR, 'watcher.log');
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [WATCHER], {
    cwd: REPO_ROOT, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd], env: childEnv,
  });
  child.unref();

  console.log(`[tower-cp] started tower-loop/watcher.mjs pid ${child.pid} as WATCHER_ID=${childEnv.WATCHER_ID}`);
  console.log(`[tower-cp] store: ${dbPath}`);
  console.log(`[tower-cp] log:   ${logFile}`);
  console.log(`[tower-cp] TowerBot notifications: ${check.notify}`);
  console.log(`[tower-cp] PR-comment poll: ${process.env.TOWER_PR_POLL === 'off' ? 'OFF' : 'ON'}`
    + `${process.env.TOWER_PR_SEED ? ` (seed: ${process.env.TOWER_PR_SEED})` : ''}`);
  return child.pid;
}

// THE MAIN GUARD. Everything above is inert on import; nothing below runs unless this file is the
// process entrypoint. See note 3 in the header — this guard is the fix, not the note about it.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
