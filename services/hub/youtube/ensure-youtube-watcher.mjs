// BUILD-002 WP2 — START-ON-DEMAND launcher for the YouTube auto-detect watcher.
//   node services/hub/youtube/ensure-youtube-watcher.mjs
// Starts watch-captures.mjs in --watch mode, detached, single-instance, so YouTube links sent through
// Telegram are auto-detected + extracted + RAW-preserved without telling Larry each time. NOT
// self-healing on its own: crash/reboot recovery = a logon Scheduled Task (needs elevation = Warwick).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WATCHER = path.join(HERE, 'watch-captures.mjs');
const LOGDIR = 'C:/.fusion247/logs';
const INTERVAL = 30;

spawnSync('powershell', ['-NoProfile', '-Command',
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*watch-captures.mjs*--watch*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
  { windowsHide: true });
fs.mkdirSync(LOGDIR, { recursive: true });
const logFd = fs.openSync(path.join(LOGDIR, 'youtube-watcher.log'), 'a');
const child = spawn(process.execPath, [WATCHER, `--watch=${INTERVAL}`], { cwd: 'C:/Fusion247PKA', detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd] });
child.unref();
console.log(`[youtube-watcher] started pid ${child.pid} (--watch=${INTERVAL}s), detached. Log: ${LOGDIR}/youtube-watcher.log`);
