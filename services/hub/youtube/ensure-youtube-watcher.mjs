// BUILD-020 Sub-phase 4B (WO-27) — ENSURE the YouTube auto-detect watcher is alive and polling.
//
//   node services/hub/youtube/ensure-youtube-watcher.mjs
//
// WHAT CHANGED AND WHY (Warwick, 2026-08-07: "he sent a link, nothing happened, and nothing told him —
// for four days"). This file used to be a START-ON-DEMAND launcher: it UNCONDITIONALLY killed any
// running watcher and started a new one. That is correct for a one-shot hand invocation and WRONG for
// anything a Scheduled Task fires periodically — a repeating trigger built on that behaviour would kill
// a PERFECTLY HEALTHY watcher on every tick, mid-extraction, forever.
//
// So this is now a true `ensure`:
//
//   healthy      -> leave it completely alone, exit 0, say so.
//   absent       -> start one.
//   hung         -> a process that is ALIVE but no longer polling is killed and replaced.
//   duplicated   -> more than one poller collapses back to exactly one.
//
// THE HUNG CASE IS THE ONE THAT MATTERS, and "process alive" cannot see it: a wedged watcher looks
// identical to a working one in the process table. So the watcher writes a HEARTBEAT once per pass (and
// once per capture and per note, so a long unit of work does not read as a hang), and `ensure` treats
// ALIVE **AND** FRESH as healthy. Nothing else in this estate can observe that: `ensure` has no database
// client and no access to the log directory by design.
//
// REPEATED RECOVERY FAILURE REACHES WARWICK (Warwick: "If repeated recovery fails, tell Warwick rather
// than remaining silently dead"). Consecutive unhealthy ticks are counted in a small state file;
// crossing the threshold sends exactly ONE message per episode — the `pending_nudged_at` idempotence
// pattern from watch-captures.mjs, applied to recovery. A tick that finds the watcher healthy clears the
// counter, which is what makes the count mean "recovery keeps failing" rather than "the watcher restarted
// once". No daemon, no supervisor, no monitoring platform.
//
// STATE LIVES IN ~/.mypka/ (Larry, WO-27 Amendment 1 §2). NOT os.tmpdir(): if temp is cleared between
// attempts the counter never accumulates, the threshold is never reached, and the watcher stays SILENTLY
// DEAD — the precise outcome the escalation exists to prevent. `~/.mypka/` already exists and is already
// load-bearing (governor/ding.mjs, tower/tower.db, run-hidden.vbs), so this invents no location. The path
// is INJECTABLE with that default: tests pass a temp path and never write to the real one.
//
// EVERY external effect is an injected seam — process listing, killing, spawning, notification, clock and
// state path. That is what lets the whole of this file be proven by execution without touching the live
// watcher, the real log directory, the database, or the network (capture-durability-check.mjs).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_WATCHER = path.join(HERE, 'watch-captures.mjs');
export const DEFAULT_LOG_DIR = 'C:/.fusion247/logs';
export const DEFAULT_CWD = 'C:/Fusion247PKA';
export const DEFAULT_INTERVAL_SEC = 30;

/** The command-line shape that identifies a running poller. Injectable so a test can use a sentinel. */
export const DEFAULT_MATCH = '*watch-captures.mjs*--watch*';

/** Durable, reboot-surviving state. Injectable; the default is never written by a test. */
export const DEFAULT_STATE_PATH = path.join(os.homedir(), '.mypka', 'youtube-watcher-state.json');

// FRESHNESS THRESHOLD — 10 minutes. Justification (one line, as ordered): the poll interval is 30s and the
// watcher beats at every pass, capture and note, so a healthy watcher refreshes ~20x inside this window,
// while the longest single uninterruptible gap between beats is one TubeAIR extraction (hard-capped at
// 180s by runTubeair's timeout) or one headless note generation — so 10 minutes cannot fire on ordinary
// work, yet still catches a genuine hang within two ticks of a 5-minute Scheduled Task.
export const HEARTBEAT_STALE_MS = 10 * 60 * 1000;

// Three consecutive unhealthy ticks. On the PT5M trigger below that is ~15 minutes of a watcher that will
// not stay up — long enough that a single reboot or a one-off crash never pages Warwick, short enough that
// four days of silence cannot happen again.
export const ESCALATE_AFTER_ATTEMPTS = 3;

export const EMPTY_STATE = Object.freeze({
  heartbeat_at: null,
  heartbeat_pid: null,
  recovery_attempts: 0,
  escalated_at: null,
  last_action: null,
  last_action_at: null,
});

// ── state ────────────────────────────────────────────────────────────────────────────────────────────
// Fail-soft in both directions: a missing or corrupt state file must never stop the watcher being
// ensured, and an unwritable state file must never throw into a Scheduled Task.

export function readState({ statePath = DEFAULT_STATE_PATH } = {}) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function writeState({ statePath = DEFAULT_STATE_PATH, state } = {}) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    // Write-then-rename so a torn write can never leave unparseable state behind.
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ ...EMPTY_STATE, ...state }, null, 2)}\n`);
    fs.renameSync(tmp, statePath);
    return true;
  } catch {
    return false;
  }
}

/** Called by the watcher itself, once per pass / capture / note. Merges, never clobbers the counters. */
export function writeHeartbeat({ statePath = DEFAULT_STATE_PATH, now = Date.now(), pid = process.pid } = {}) {
  const state = readState({ statePath });
  return writeState({ statePath, state: { ...state, heartbeat_at: new Date(now).toISOString(), heartbeat_pid: pid } });
}

export function heartbeatIsFresh({ state, now = Date.now(), staleMs = HEARTBEAT_STALE_MS } = {}) {
  if (!state || !state.heartbeat_at) return false;
  const beat = Date.parse(state.heartbeat_at);
  if (!Number.isFinite(beat)) return false;
  return now - beat >= 0 && now - beat < staleMs;
}

// ── default (real) probes — every one replaceable ────────────────────────────────────────────────────

export function defaultListWatchers({ match = DEFAULT_MATCH } = {}) {
  const r = spawnSync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '${match}' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`],
  { encoding: 'utf8', windowsHide: true });
  const out = (r.stdout || '').trim();
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter(Boolean).map((p) => ({ pid: p.ProcessId, commandLine: p.CommandLine }));
  } catch {
    return [];
  }
}

export function defaultKillWatcher(pid) {
  spawnSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${Number(pid)} -Force`], { windowsHide: true });
  return true;
}

export function defaultStartWatcher({
  logDir = DEFAULT_LOG_DIR, watcher = DEFAULT_WATCHER, cwd = DEFAULT_CWD, interval = DEFAULT_INTERVAL_SEC,
} = {}) {
  fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(path.join(logDir, 'youtube-watcher.log'), 'a');
  const child = spawn(process.execPath, [watcher, `--watch=${interval}`], {
    cwd, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  return { pid: child.pid };
}

/**
 * Escalation transport. The SAME route the STUCK nudge already uses (watch-captures.mjs) — one
 * notification path, not a second one (AC6). Best-effort: a failed send must never break recovery.
 *
 * The route is the CANONICAL governor ding at `~/.mypka/governor/ding.mjs` (source of truth:
 * `tools/governor/ding.mjs`), not the loose out-of-version-control script this used to spawn —
 * WO-2026-08-15-06, Warwick's decision 2026-08-15. It must stay identical to the invocation in
 * watch-captures.mjs, which carries the full reasoning including why there is no `--env-file`.
 * Credentials still live outside Git; ding.mjs reads them itself and only a path literal is here.
 */
export function defaultNotify(message) {
  const tmp = path.join(os.tmpdir(), `yt-watcher-escalation-${Date.now()}.txt`);
  const ding = path.join(os.homedir(), '.mypka', 'governor', 'ding.mjs');
  try {
    fs.writeFileSync(tmp, message);
    const r = spawnSync(process.execPath, [ding, tmp], { encoding: 'utf8', windowsHide: true });
    return r.status === 0;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
}

export function escalationMessage({ attempts, reason, startError }) {
  return [
    `🔴 The YouTube watcher will not stay up — ${attempts} recovery attempts in a row have failed.`,
    `Last check: ${reason}${startError ? ` · restart error: ${startError}` : ''}.`,
    'YouTube links you send are NOT being processed until this is fixed.',
  ].join('\n');
}

// ── ensure ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Bring the watcher to exactly one alive-and-polling instance, and say what it did.
 *
 * @returns {{action:'left-running'|'started'|'restarted', reason:string, healthy:boolean,
 *            running:number, pid:(number|null), attempts:number, escalated:boolean,
 *            startError:(string|null)}}
 */
export function ensureWatcher({
  listWatchers = defaultListWatchers,
  killWatcher = defaultKillWatcher,
  startWatcher = defaultStartWatcher,
  notify = defaultNotify,
  statePath = DEFAULT_STATE_PATH,
  logDir = DEFAULT_LOG_DIR,
  watcher = DEFAULT_WATCHER,
  cwd = DEFAULT_CWD,
  interval = DEFAULT_INTERVAL_SEC,
  match = DEFAULT_MATCH,
  now = Date.now(),
  staleMs = HEARTBEAT_STALE_MS,
  escalateAfter = ESCALATE_AFTER_ATTEMPTS,
  log = console.log,
} = {}) {
  const state = readState({ statePath });
  const running = listWatchers({ match }) || [];
  const fresh = heartbeatIsFresh({ state, now, staleMs });
  const at = new Date(now).toISOString();

  // ── healthy: alive AND polling. Leave it completely alone. ──
  if (running.length === 1 && fresh) {
    writeState({
      statePath,
      state: { ...state, recovery_attempts: 0, escalated_at: null, last_action: 'left-running', last_action_at: at },
    });
    log(`[youtube-watcher] healthy — pid ${running[0].pid} alive and heartbeat fresh. Left running.`);
    return {
      action: 'left-running', reason: 'healthy', healthy: true, running: running.length,
      pid: running[0].pid, attempts: 0, escalated: false, startError: null,
    };
  }

  // ── unhealthy: name WHY before acting, because the three causes are not the same event. ──
  let reason;
  if (running.length === 0) reason = 'no-watcher-running';
  else if (running.length > 1) reason = 'multiple-instances';
  else reason = 'heartbeat-stale';

  for (const w of running) {
    try { killWatcher(w.pid); } catch { /* a process that is already gone is not an error */ }
  }

  let pid = null;
  let startError = null;
  try {
    const started = startWatcher({ logDir, watcher, cwd, interval }) || {};
    pid = started.pid ?? null;
  } catch (e) {
    startError = (e && e.message) || String(e);
  }

  // Count CONSECUTIVE unhealthy ticks. This is what makes the number mean "recovery keeps failing":
  // a tick that finds the watcher healthy resets it to 0 above.
  const attempts = (Number(state.recovery_attempts) || 0) + 1;

  // Escalate ONCE per episode, not once per tick (AC3 idempotence).
  let escalated = false;
  let escalatedAt = state.escalated_at;
  if (attempts >= escalateAfter && !state.escalated_at) {
    try { escalated = !!notify(escalationMessage({ attempts, reason, startError })); } catch { escalated = false; }
    // Mark the episode as escalated even if the SEND failed, so a broken transport cannot turn into a
    // message on every single tick. A failed send is reported in the return and in the log.
    escalatedAt = at;
  }

  writeState({
    statePath,
    state: {
      ...state,
      recovery_attempts: attempts,
      escalated_at: escalatedAt,
      last_action: running.length ? 'restarted' : 'started',
      last_action_at: at,
    },
  });

  const action = running.length ? 'restarted' : 'started';
  log(`[youtube-watcher] ${action} (${reason}) — killed ${running.length}, new pid ${pid ?? 'NONE'}, `
    + `consecutive failed recoveries ${attempts}${escalated ? ' — ESCALATED to Warwick' : ''}`
    + `${startError ? ` — START FAILED: ${startError}` : ''}. Log: ${logDir}/youtube-watcher.log`);

  return { action, reason, healthy: false, running: running.length, pid, attempts, escalated, startError };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────
// Guarded, so importing this module for its state helpers or for a proof has NO side effect. (The
// unguarded top-level form is exactly the defect found in watch-captures.mjs during this Work Order.)
const isCli = !!process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isCli) {
  const r = ensureWatcher();
  process.exitCode = r.healthy || r.pid ? 0 : 1;
}
