// BUILD-002 WP0 — START-ON-DEMAND launcher for the contract approval-apply worker.
//
//   node wp-d-proof/ensure-contract-worker.mjs
//
// Makes the approval-apply worker OPERATIONAL (not manual-per-approval): starts
// apply-contract-command.mjs in --watch mode, detached, single-instance. While running, a valid
// Directus approve/request_changes intent in cockpit.contract_command is claimed + applied
// automatically — Warwick never has to tell Larry to run a script per approval.
//
// HONEST SCOPE — this is START-ON-DEMAND, NOT self-healing on its own:
//   • It starts (or restarts) the worker ONCE when invoked; it does NOT respawn the worker if the
//     node process later crashes, and it does NOT survive a machine reboot by itself.
//   • The internal --watch loop tolerates transient DB/poll errors and keeps polling, but a hard
//     process exit or reboot is out of its scope.
//   • Genuine crash/reboot recovery is provided by registering this as a logon Scheduled Task
//     (`MyPKA-Contract-Worker`, mirroring MyPKA-Directus-Live) — that registration needs elevation
//     and is Warwick's step (attempted here returned Access denied without admin rights).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, '.runtime-live');
const WORKER = path.join(HERE, 'apply-contract-command.mjs');
const INTERVAL = 15;

function killExisting() {
  spawnSync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*apply-contract-command.mjs*--watch*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
    { windowsHide: true });
}

killExisting();
fs.mkdirSync(RUNTIME, { recursive: true });
const logFd = fs.openSync(path.join(RUNTIME, 'contract-worker.log'), 'a');
const child = spawn(process.execPath, [WORKER, `--watch=${INTERVAL}`], {
  cwd: HERE, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.writeFileSync(path.join(RUNTIME, 'contract-worker.pid'), String(child.pid));
console.log(`[contract-worker] started pid ${child.pid} (--watch=${INTERVAL}s), detached. Log: .runtime-live/contract-worker.log`);
