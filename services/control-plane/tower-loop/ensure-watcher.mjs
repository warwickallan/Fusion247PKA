// BUILD-014 Tower — SessionStart launcher. Brings the persistent watcher ONLINE if it is
// not already running, so a new Claude Code session never depends on Larry hand-starting it.
//
// Wired as a SessionStart hook in .claude/settings.local.json:
//   node --env-file=C:/.fusion247/control-plane-dev.env --env-file=C:/.fusion247/tower-baton.env \
//        C:/Fusion247PKA/services/control-plane/tower-loop/ensure-watcher.mjs
// The hook loads BOTH env files, so this process (and the watcher it spawns, which inherits
// process.env) get the DEV DB url + the real TowerBot Telegram creds.
//
// SINGLETON + REBOOT-SAFE liveness: a watcher is considered ONLINE only when it has a RECENT
// heartbeat row (tower.watcher_heartbeat) AND the OS PID encoded in its watcher_id is still
// alive. The PID check reads "alive" even during a long (up to 8-min) Codex turn when the beat
// pauses; the recency window guards against PID reuse after a reboot. Duplicate watchers are
// SAFE by design (durable lease + unique(turn_id) backstops), so on any uncertainty we bias
// toward starting one — but we never block or slow session start.
//
// Fail-safe: every path exits 0. A DB/spawn problem is logged, never thrown up to the hook.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const LOOP_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = 'C:/.fusion247/logs';
// Beat must be within this window to count as live. Comfortably covers an 8-min Codex turn
// (during which the watcher does not beat) plus margin; also bounds PID-reuse false-positives
// after a reboot to a small window.
const RECENT_MS = 15 * 60 * 1000;

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }        // no-op signal: existence probe
  catch (e) { return e?.code === 'EPERM'; }          // EPERM = exists but not ours (alive); ESRCH = dead
}

function parsePid(watcherId) {
  const m = /#(\d+)\s*$/.exec(String(watcherId ?? ''));
  return m ? Number(m[1]) : NaN;
}

async function checkLive() {
  const url = process.env.CONTROL_PLANE_DEV_DATABASE_URL;
  if (!url) return { live: false, why: 'CONTROL_PLANE_DEV_DATABASE_URL unset' };
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const r = await pool.query(
      `select watcher_id, extract(epoch from (now() - last_beat)) * 1000 as age_ms
         from tower.watcher_heartbeat order by last_beat desc limit 1`);
    if (r.rows.length === 0) return { live: false, why: 'no heartbeat rows yet' };
    const age = Number(r.rows[0].age_ms);
    const pid = parsePid(r.rows[0].watcher_id);
    const recent = Number.isFinite(age) && age <= RECENT_MS;
    const alive = pidAlive(pid);
    if (recent && alive) return { live: true, why: `beat ${Math.round(age / 1000)}s ago, pid ${pid} alive` };
    return { live: false, why: `stale/dead (age ${Math.round(age / 1000)}s, pid ${pid} alive=${alive})` };
  } finally { await pool.end().catch(() => {}); }
}

function startWatcher() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(path.join(LOG_DIR, 'tower-watcher.out.log'), 'a');
  const err = fs.openSync(path.join(LOG_DIR, 'tower-watcher.err.log'), 'a');
  // detached + unref + file stdio: the watcher survives this launcher, the session, and the
  // terminal closing (it does NOT survive sign-out/reboot — that is what this hook is for).
  const child = spawn(process.execPath, ['watcher.mjs'], {
    cwd: LOOP_DIR, detached: true, windowsHide: true, stdio: ['ignore', out, err], env: process.env,
  });
  child.unref();
  return child.pid;
}

try {
  const status = await checkLive();
  if (status.live) {
    console.log(`[tower] watcher already online — ${status.why}`);
  } else {
    const pid = startWatcher();
    console.log(`[tower] watcher STARTED pid ${pid} — was: ${status.why}`);
  }
} catch (e) {
  // Bias toward Tower-up on uncertainty (duplicate watchers are safe); never block the session.
  try { const pid = startWatcher(); console.log(`[tower] watcher started pid ${pid} after check error: ${String(e?.message ?? e)}`); }
  catch (e2) { console.log(`[tower] could NOT start watcher: ${String(e2?.message ?? e2)}`); }
}
process.exit(0);
