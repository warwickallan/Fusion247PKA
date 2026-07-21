// BUILD-002 capture gateway — SessionStart launcher. Brings the LIVE Telegram→Brain poller
// (DevBot → Team Inbox\captures) ONLINE if it is not already running, so a new session never
// depends on hand-starting it. Mirrors the Tower ensure-watcher.mjs pattern.
//
// Wired as a SessionStart hook in .claude/settings.local.json:
//   node C:/Fusion247PKA/services/fusion-capture-gateway/ensure-capture-gateway.mjs
//
// SINGLE-INSTANCE: the live runner long-polls Telegram getUpdates, and Telegram allows only ONE
// getUpdates consumer per bot — a second poller gets HTTP 409. So we START only when no
// liveRunner process is already running (detected by command-line scan). The runner's durable
// offset (channel_poll_offset) makes a fresh start resume from the last acknowledged update, so
// pending messages queued while it was down are picked up on the next poll — no lost updates.
//
// Fail-safe: every path exits 0. A spawn/scan problem is logged, never thrown up to the hook.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(SERVICE_DIR, 'src', 'live', 'liveRunner.js');
const ENVFILE = 'C:/.fusion247/fusion-capture-gateway.env';
const LOG_DIR = 'C:/.fusion247/logs';
const LOG = path.join(LOG_DIR, 'capture-gateway.out.log');

// True if a liveRunner node process is already running (avoid a second getUpdates consumer -> 409).
function alreadyRunning() {
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*liveRunner*' } | Measure-Object).Count"],
      { encoding: 'utf8', windowsHide: true });
    return Number(String(r.stdout || '').trim()) > 0;
  } catch { return false; } // on uncertainty, bias to start (the runner itself 409s-safe if a dup slips in)
}

function start() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(LOG, 'a');
  // Detached + unref + file stdio: survives this launcher, the session, and the terminal closing
  // (it does NOT survive sign-out/reboot — that is what this SessionStart hook is for).
  const child = spawn(process.execPath, ['--env-file', ENVFILE, RUNNER], {
    cwd: SERVICE_DIR, detached: true, windowsHide: true, stdio: ['ignore', out, out],
  });
  child.unref();
  return child.pid;
}

try {
  if (!fs.existsSync(ENVFILE)) {
    console.log(`[capture-gateway] env file missing (${ENVFILE}) — not started`);
  } else if (alreadyRunning()) {
    console.log('[capture-gateway] already online — a liveRunner process is running');
  } else {
    const pid = start();
    console.log(`[capture-gateway] STARTED pid ${pid} — long-polling DevBot -> Team Inbox\\captures (resumes from durable offset)`);
  }
} catch (e) {
  console.log(`[capture-gateway] could NOT start: ${String(e?.message ?? e)}`);
}
process.exit(0);
