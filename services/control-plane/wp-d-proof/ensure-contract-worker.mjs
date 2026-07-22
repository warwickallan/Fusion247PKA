// BUILD-002 WP0 — self-healing supervisor for the contract approval-apply worker.
//
//   node wp-d-proof/ensure-contract-worker.mjs
//
// Makes the approval-apply worker OPERATIONAL (not manual-only): starts apply-contract-command.mjs
// in --watch mode, detached, single-instance. It doubles as the reboot-recovery entrypoint (register
// it as a logon Scheduled Task, mirroring MyPKA-Directus-Live). Once running, a valid Directus
// approve/request_changes intent in cockpit.contract_command is claimed + applied automatically —
// Warwick never has to tell Larry to run a script.
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
