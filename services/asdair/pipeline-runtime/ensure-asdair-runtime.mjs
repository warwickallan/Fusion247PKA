// BUILD-015 AsdAIr Stage 1 - ensure-asdair-runtime.mjs
//
// THE SINGLE, SUPERVISED AsdAIr RUNTIME. Warwick authorised exactly this and no
// more (2026-07-28): one ShopperBot getUpdates consumer, the deterministic
// command worker, pipeline resumption for incomplete shops, and Windows
// logon/restart recovery. It is explicitly NOT an LLM daemon, not an autonomous
// browser, and it can never check out or pay.
//
//   node --env-file=<env> ensure-asdair-runtime.mjs            start (live)
//   node --env-file=<env> ensure-asdair-runtime.mjs --status   machine-readable health
//   node --env-file=<env> ensure-asdair-runtime.mjs --stop     stop the one holder
//   node --env-file=<env> ensure-asdair-runtime.mjs --restart  stop then start
//   node --env-file=<env> ensure-asdair-runtime.mjs --preflight can it start?
//   node ensure-asdair-runtime.mjs --arm | --disarm            the consume gate
//   node ensure-asdair-runtime.mjs --selftest                  spawn path, no Telegram
//
// Modelled on the proven wp-d-proof/ensure-directus-live.mjs launcher, which is
// what already survives reboots on this machine - including its most important
// habit: it does not merely START the thing, it WAITS for evidence the thing is
// actually up, and retries if it is not.
//
// THE SINGLE-POLLER RULE IS THE WHOLE SAFETY ARGUMENT.
// Telegram getUpdates is a single-consumer, destructive-ack protocol with no
// lease or lock. Two pollers do not "share" the stream - they race it, and the
// realistic failure is a shopping list silently consumed and permanently lost
// with no error surfaced. So this launcher takes an exclusive lock (see
// runtime-lock.mjs) and REFUSES to start a second instance. It does not "start
// anyway just in case".
//
// THE ARMING GATE. The live poller consumes updates destructively, so it will
// not start until it has been armed once, explicitly. That is not timidity: a
// logon task firing unattended on a machine nobody is watching can eat a list
// that was being kept for acceptance, and no amount of later care gets it back.
// `--arm` is a single command and it persists across reboots.
//
// CREDENTIALS: consumed from the environment via `node --env-file=`. This file
// opens no credentials file, prints no value, and knows env var NAMES only.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  acquire, holderStatus, stopHolder, clearLock, inspectPid, isBlocking, sleepSync,
} from './runtime-lock.mjs';
import { collect, writeCache, armed } from './asdair-status.mjs';
import {
  STATE_DIR, LOG, RUNTIME_ENTRY, RUNTIME_CWD, SELFTEST_ENTRY, HERE,
} from './runtime-paths.mjs';

const argv = new Set(process.argv.slice(2));

/** How long a freshly-spawned runtime must survive before we call it started. */
const SETTLE_MS = Number(process.env.ASDAIR_RUNTIME_SETTLE_MS || 8000);
const MAX_TRIES = 3;
const LOG_ROTATE_BYTES = 8 * 1024 * 1024;

/** Env var NAMES the live runtime needs. Presence only - no value is ever read,
 *  compared, printed or logged. */
const REQUIRED_ENV = ['SHOPPER_BOT_TOKEN', 'ASDAIR_DB_URL', 'ASDAIR_WRITE_DB_URL'];
const REQUIRED_ENV_EITHER = [['SHOPPER_ALLOWED_SENDER_IDS', 'SHOPPER_ALLOWED_USER_IDS']];

function log(msg) { console.log(`[asdair-runtime] ${msg}`); }

// ---------------------------------------------------------------------
// Preflight - the questions worth answering BEFORE taking the lock
// ---------------------------------------------------------------------

/**
 * Can the live runtime actually run?
 *
 * A launcher that cheerfully spawns a process which dies two seconds later is
 * worse than one that refuses: the lock churns, the log fills with the same
 * stack trace, and the status card says "not running" without saying why.
 */
export function preflight({ mode = 'live', env = process.env } = {}) {
  const problems = [];
  const checks = [];

  const entry = mode === 'selftest' ? SELFTEST_ENTRY : RUNTIME_ENTRY;
  const entryOk = fs.existsSync(entry);
  checks.push({ check: 'runtime entry exists', ok: entryOk, detail: entry });
  if (!entryOk) problems.push(`runtime entry not found: ${entry}`);

  if (mode === 'live') {
    for (const name of REQUIRED_ENV) {
      const ok = typeof env[name] === 'string' && env[name].length > 0;
      checks.push({ check: `env ${name} is set`, ok, detail: ok ? 'set (value never read here)' : 'MISSING' });
      if (!ok) problems.push(`${name} is not set - pass it with node --env-file=<credentials file>`);
    }
    for (const names of REQUIRED_ENV_EITHER) {
      const ok = names.some((n) => typeof env[n] === 'string' && env[n].length > 0);
      checks.push({ check: `env ${names.join(' or ')} is set`, ok, detail: ok ? 'set' : 'MISSING' });
      if (!ok) problems.push(`none of ${names.join(' / ')} is set - the sender allowlist is default-deny`);
    }

    // The pipeline reaches Postgres through `pg`, resolved from ITS OWN folder.
    // If that resolution fails the runtime starts and then dies on the first
    // database touch, so it is checked here rather than discovered at 3am.
    const pgOk = canResolvePgForPipeline();
    checks.push({
      check: "the pipeline can resolve the 'pg' driver", ok: pgOk,
      detail: pgOk ? 'resolvable' : 'MODULE_NOT_FOUND from services/asdair/shop/ - install pg for services/asdair (not this folder: node resolves from the caller)',
    });
    if (!pgOk) problems.push("the pipeline cannot resolve 'pg' - the runtime would start and then die on its first database read. Install dependencies for services/asdair before arming.");
  }

  const arm = armed(STATE_DIR);
  checks.push({ check: 'live runtime is armed', ok: arm.armed, detail: arm.armed ? `armed ${arm.since}` : arm.reason });
  if (mode === 'live' && !arm.armed) problems.push(arm.reason);

  return { ok: problems.length === 0, mode, entry, checks, problems };
}

/** Does `require('pg')` resolve from where shopStore.js will ask for it? */
function canResolvePgForPipeline() {
  try {
    const from = path.join(HERE, '..', 'shop', 'shopStore.js');
    if (!fs.existsSync(from)) return false;
    createRequire(from).resolve('pg');
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------
// Arming
// ---------------------------------------------------------------------

function armFile() { return path.join(STATE_DIR, 'runtime.armed'); }

function arm() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(armFile(), `${JSON.stringify({
    armed_at: new Date().toISOString(),
    armed_by: `${os.userInfo().username}@${os.hostname()}`,
    note: 'the AsdAIr runtime may now poll ShopperBot. getUpdates is DESTRUCTIVE: pending updates will be consumed and turned into shops.',
  }, null, 1)}\n`);
  log(`ARMED. The live runtime may now consume ShopperBot updates. (${armFile()})`);
  return 0;
}

function disarm() {
  try { fs.rmSync(armFile(), { force: true }); } catch { /* best effort */ }
  log('DISARMED. The live runtime will refuse to start until --arm is run again.');
  log('NOTE: this does not stop a runtime that is already running - use --stop for that.');
  return 0;
}

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------

function rotateLogIfBig() {
  try {
    const st = fs.statSync(LOG);
    if (st.size > LOG_ROTATE_BYTES) fs.renameSync(LOG, `${LOG}.1`);
  } catch { /* no log yet */ }
}

/** The fingerprint the lock binds the holder's command line to. */
function fingerprintFor(entry) { return path.basename(entry); }

function spawnRuntime(entry, extraArgs = []) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  rotateLogIfBig();
  const logFd = fs.openSync(LOG, 'a');
  fs.writeSync(logFd, `${JSON.stringify({ event: 'launcher_spawn', entry, at: new Date().toISOString() })}\n`);
  const child = spawn(process.execPath, [entry, '--watch', ...extraArgs], {
    cwd: entry === SELFTEST_ENTRY ? HERE : RUNTIME_CWD,
    detached: true,          // its own process group: it outlives this launcher,
    windowsHide: true,       // and outlives the Task Scheduler job that ran it.
    stdio: ['ignore', logFd, logFd],
    env: process.env,        // credentials are CONSUMED from the environment,
  });                        // never read from disk here.
  child.unref();
  try { fs.closeSync(logFd); } catch { /* the child holds its own handle */ }
  return child;
}

function tailLog(lines = 12) {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).slice(-lines);
  } catch { return []; }
}

async function start({ mode = 'live' } = {}) {
  const pre = preflight({ mode });
  if (!pre.ok) {
    log('REFUSING to start - preflight failed:');
    for (const p of pre.problems) log(`  - ${p}`);
    return 1;
  }
  const entry = pre.entry;

  const existing = holderStatus(STATE_DIR);
  if (isBlocking(existing.state)) {
    // Refusing is the correct behaviour, not an inconvenience.
    log(`already running as pid ${existing.record.pid ?? existing.record.launcher_pid} (${existing.state}) - REFUSING to start a SECOND poller`);
    log(`  reason: ${existing.reason}`);
    return 0;
  }
  if (existing.state === 'stale') {
    log(`reclaiming a stale lock: ${existing.reason}`);
  }

  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const claim = acquire(STATE_DIR, { mode, entry });
    if (!claim.ok) {
      log(`another launcher won the race (${claim.status.state}) - REFUSING to start a SECOND poller`);
      log(`  reason: ${claim.status.reason}`);
      return 0;
    }

    const child = spawnRuntime(entry);
    // Bind the lock to the child's FULL identity, read back from the OS, so a
    // recycled pid can never later masquerade as this runtime.
    let identity = null;
    for (let i = 0; i < 20 && !identity; i += 1) { identity = inspectPid(child.pid); if (!identity) sleepSync(150); }
    claim.commit({
      pid: child.pid,
      process_created_at: identity ? identity.createdAt : null,
      fingerprint: fingerprintFor(entry),
      identity_verified: Boolean(identity && identity.createdAt),
    });
    log(`attempt ${attempt}/${MAX_TRIES} - started pid ${child.pid} (${mode}), waiting for it to settle...`);

    // WAIT FOR EVIDENCE, do not merely assume. A runtime that dies three
    // seconds in on a bad connection string must be reported as failed, not
    // announced as running. The settle window is deliberately longer than the
    // time it takes the pipeline to open its first database connection, which
    // is where a misconfigured runtime actually falls over.
    const deadline = Date.now() + SETTLE_MS;
    let alive = true;
    while (Date.now() < deadline && alive) {
      sleepSync(1000);
      alive = Boolean(inspectPid(child.pid));
    }

    if (alive && holderStatus(STATE_DIR).state === 'held') {
      log(`ONLINE - pid ${child.pid} holds the single-poller lock (log: ${LOG})`);
      const status = await collect({ db: mode === 'live' });
      writeCache(status);
      log(`status written to ${path.join(STATE_DIR, 'status.json')}`);
      return 0;
    }

    log(`attempt ${attempt} did not settle - the runtime exited. Last log lines:`);
    for (const line of tailLog()) log(`  | ${line}`);
    clearLock(STATE_DIR);
    if (attempt < MAX_TRIES) sleepSync(2000);
  }
  log(`FAILED to keep the runtime up after ${MAX_TRIES} attempts`);
  return 1;
}

// ---------------------------------------------------------------------
// Stop / status / restart
// ---------------------------------------------------------------------

function stop() {
  const r = stopHolder(STATE_DIR);
  log(r.reason);
  return r.stopped || r.cleared || r.status.state === 'free' ? 0 : 1;
}

async function status() {
  const s = await collect({ db: !argv.has('--no-db') });
  console.log(JSON.stringify(s, null, 1));
  return s.healthy ? 0 : 1;
}

// ---------------------------------------------------------------------

async function main() {
  if (argv.has('--arm')) return arm();
  if (argv.has('--disarm')) return disarm();
  if (argv.has('--preflight')) {
    const pre = preflight({ mode: argv.has('--selftest') ? 'selftest' : 'live' });
    console.log(JSON.stringify(pre, null, 1));
    return pre.ok ? 0 : 1;
  }
  if (argv.has('--status')) return status();
  if (argv.has('--stop')) return stop();
  if (argv.has('--restart')) { stop(); sleepSync(500); return start({ mode: argv.has('--selftest') ? 'selftest' : 'live' }); }
  return start({ mode: argv.has('--selftest') ? 'selftest' : 'live' });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  process.exit(await main());
}
