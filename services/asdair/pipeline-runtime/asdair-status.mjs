// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline-runtime/asdair-status.mjs
//
// THE HEALTH SURFACE. One machine-readable document answering the five
// questions anyone (the Cockpit, the ShopperBot /status card, Warwick at 7am)
// actually asks: is it running, which process, where has the Telegram offset
// got to, when did it last do anything and did it break, and is there work
// waiting.
//
//   node --env-file=<env> asdair-status.mjs [--write] [--no-db] [--compact]
//
// ── WHY THIS IS ASSEMBLED, NOT STORED ───────────────────────────────────────
// The brief asked for a durable/queryable source in preference to a file. The
// honest answer is that no ONE source can answer all five, and inventing a
// single "runtime status" record would create a second source of truth for
// facts that already have one. So each fact is read from whatever already owns
// it, and the document says where each came from:
//
//   liveness / pid   -> THE OPERATING SYSTEM (Win32_Process), cross-checked
//                       against the lock's pid + creation-time + command-line.
//                       Deliberately NOT a database heartbeat: a heartbeat row
//                       is a *claim* written by a process that may since have
//                       died, and "the DB says a poller is alive" is precisely
//                       the false belief that lets a second poller start. Only
//                       the box that owns the poller can answer liveness, and
//                       only the OS can answer it truthfully.
//   telegram offset  -> the intake's OWN durable state file, which is already
//                       the SSOT for that number. Copying it into Postgres
//                       would give the one value that must never be wrong two
//                       homes and a window in which they disagree.
//   last activity /
//   last error       -> the runtime's own JSONL event log (its emissions,
//                       re-read - not re-derived, not re-interpreted).
//   PENDING WORK     -> POSTGRES, read-only, through the SELECT-only role.
//                       This is the durable, queryable source, and it is the
//                       part of the answer that genuinely belongs in a
//                       database: shops, questions, commands and the outbox
//                       survive the process and are authoritative regardless of
//                       which machine asks.
//
// A cached copy is written to <state>/status.json for cheap consumers, stamped
// with generated_at and explicitly labelled a CACHE. Nothing reads it as truth.
//
// No migration is applied, no schema is touched, and every statement here is a
// SELECT inside BEGIN TRANSACTION READ ONLY.
//
// ── PERSONAL DATA ───────────────────────────────────────────────────────────
// The per-shop breakdown carries refs, stages and error text ONLY. It never
// selects raw_text, transcript, media paths or item names: this document is
// designed to be pasteable into a status card, and the household's shopping is
// not status metadata. No credentials file is opened; env var NAMES only.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { holderStatus } from './runtime-lock.mjs';
import { STATE_DIR, RUNTIME_ENTRY, LOG, intakeStateFile } from './runtime-paths.mjs';
import { assessLiveness, probePgConsumers, PG_CONSUMERS } from './runtime-deps.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** How much of the tail of the event log to parse. Bounded so a status call
 *  stays cheap no matter how long the runtime has been up. */
const LOG_TAIL_BYTES = 64 * 1024;

// ---------------------------------------------------------------------
// The event log
// ---------------------------------------------------------------------

/** PURE. Fold a runtime JSONL event log into the few facts a status card needs. */
export function summariseEvents(lines) {
  const events = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try { events.push(JSON.parse(t)); } catch { /* a torn final line; ignore */ }
  }
  const last = (pred) => { for (let i = events.length - 1; i >= 0; i -= 1) if (pred(events[i])) return events[i]; return null; };

  const lastPass = last((e) => e.event === 'pass');
  const lastPoll = last((e) => e.event === 'fetched');
  const lastFailure = last((e) => e.event === 'pass_failed' || e.event === 'failed_offset_held'
    || e.event === 'send_failed' || e.event === 'tap_failed' || e.event === 'launcher_error');
  return {
    events_parsed: events.length,
    last_pass: lastPass,
    last_poll: lastPoll,
    last_error: lastFailure,
    // A HELD offset means a message could not be handled and is deliberately
    // being redelivered. It is the one condition where "nothing is happening"
    // is not the same as "nothing to do", so it is surfaced by name.
    offset_held: Boolean(lastFailure && lastFailure.event === 'failed_offset_held'),
  };
}

export function readEventLog(logPath = LOG) {
  let stat;
  try { stat = fs.statSync(logPath); } catch { return { exists: false, path: logPath }; }
  const start = Math.max(0, stat.size - LOG_TAIL_BYTES);
  const fd = fs.openSync(logPath, 'r');
  let text = '';
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    text = buf.toString('utf8');
  } finally { fs.closeSync(fd); }
  return {
    exists: true,
    path: logPath,
    size_bytes: stat.size,
    // The runtime's own log lines carry no timestamp, so the file's last write
    // is the honest answer to "when did anything last happen" - and it is
    // labelled as exactly that rather than dressed up as an event time.
    last_write_at: new Date(stat.mtimeMs).toISOString(),
    truncated: start > 0,
    ...summariseEvents(text.split(/\r?\n/)),
  };
}

// ---------------------------------------------------------------------
// The Telegram offset
// ---------------------------------------------------------------------

/**
 * The durable offset, read from the intake's own state file.
 *
 * A MISSING file is reported as `last_update_id: null` with `consumed: false` -
 * which is the true and important statement "this receiver has never acked
 * anything, so nothing has been consumed", not an error.
 */
export function readOffset(stateFile = intakeStateFile()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const n = Number(parsed && parsed.last_update_id);
    return {
      source: stateFile, exists: true,
      last_update_id: Number.isFinite(n) ? n : null,
      updated_at: parsed && parsed.updated_at ? String(parsed.updated_at) : null,
      consumed: Number.isFinite(n),
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { source: stateFile, exists: false, last_update_id: null, updated_at: null, consumed: false,
        note: 'no offset file - this receiver has never acknowledged an update, so nothing has been consumed' };
    }
    return { source: stateFile, exists: true, last_update_id: null, updated_at: null, consumed: null,
      error: `offset file unreadable: ${err.message}` };
  }
}

// ---------------------------------------------------------------------
// Pending work - the durable, queryable half
// ---------------------------------------------------------------------

const COUNTS_SQL = `
  SELECT
    (SELECT count(*) FROM asdair.shop WHERE status NOT IN ('RECONCILED','CANCELLED'))::int   AS shops_active,
    (SELECT count(*) FROM asdair.shop WHERE status = 'FAILED')::int                          AS shops_failed,
    (SELECT count(*) FROM asdair.shop WHERE needs_review IS TRUE
        AND status NOT IN ('RECONCILED','CANCELLED'))::int                                   AS shops_needing_review,
    (SELECT count(*) FROM asdair.shop_question WHERE status = 'open')::int                   AS questions_open,
    (SELECT count(*) FROM asdair.pending_action
       WHERE status = 'pending' AND action_type LIKE 'cmd:%')::int                           AS commands_pending,
    (SELECT count(*) FROM asdair.pending_action
       WHERE status = 'pending' AND action_type LIKE 'msg:%')::int                           AS outbox_queued,
    (SELECT count(*) FROM asdair.browser_build_request
       WHERE status IN ('queued','claimed','running'))::int                                  AS browser_requests_live`;

// Refs, stages and errors only. NEVER list content.
const SHOPS_SQL = `
  SELECT shop_ref, status, needs_review, last_error, updated_at
    FROM asdair.shop
   WHERE status NOT IN ('RECONCILED','CANCELLED')
   ORDER BY id ASC LIMIT 25`;

export async function readPendingWork({ connectionString = process.env.ASDAIR_DB_URL } = {}) {
  if (!connectionString || String(connectionString).trim() === '') {
    return { available: false, source: 'postgres', reason: 'ASDAIR_DB_URL is not set (pass it with node --env-file=<env>)' };
  }
  let Pool;
  try { ({ Pool } = require('pg')); } catch {
    return { available: false, source: 'postgres', reason: "the 'pg' driver is not installed for this folder - run: npm install --omit=dev (in services/asdair/pipeline-runtime)" };
  }
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8000, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN TRANSACTION READ ONLY');
      const counts = (await client.query(COUNTS_SQL)).rows[0];
      const shops = (await client.query(SHOPS_SQL)).rows;
      await client.query('COMMIT');
      const total = Number(counts.questions_open) + Number(counts.commands_pending)
        + Number(counts.outbox_queued) + Number(counts.browser_requests_live);
      return {
        available: true, source: 'postgres (read-only role, BEGIN TRANSACTION READ ONLY)',
        ...counts,
        work_waiting: total > 0 || Number(counts.shops_active) > 0,
        shops,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* no-op */ }
      throw err;
    } finally { client.release(); }
  } catch (err) {
    return { available: false, source: 'postgres', reason: `query failed: ${err.message}` };
  } finally {
    await pool.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------
// Dependencies - health that reflects what the service NEEDS, not that it exists
// ---------------------------------------------------------------------

/**
 * Resolve `pg` from the perspective of each folder that calls it, for real.
 *
 * Node resolves from the CALLER, so `pg` being installed for pipeline-runtime
 * says nothing about `shop/`, `pipeline/` or `browser-runner/`. On 2026-08-03
 * three separate folders were broken at once while the service reported healthy.
 *
 * The resolver is injected in tests, so an unresolvable dependency can be proven
 * to turn health red without uninstalling anything.
 */
export function readDependencies({ resolveFrom = defaultPgResolver(), consumers = PG_CONSUMERS } = {}) {
  const pg = probePgConsumers({ resolveFrom, consumers });
  return {
    ok: pg.available === true && pg.ok === true,
    pg,
    note: 'a dependency the service needs but cannot load is a RED health state, even when the process is alive',
  };
}

function defaultPgResolver() {
  const servicesRoot = path.resolve(HERE, '..', '..');
  return (rel) => {
    const from = path.join(servicesRoot, 'asdair', rel);
    createRequire(from).resolve('pg');
  };
}

// ---------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------

export async function collect({
  stateDir = STATE_DIR, logPath = LOG, stateFile = intakeStateFile(), db = true,
  // Injected so liveness and dependency health are provable offline. Neither
  // default reaches anything a test cannot control.
  nowMs = Date.now(), env = process.env, dependencies: injectedDependencies = null,
  holder: injectedHolder = null,
} = {}) {
  const holder = injectedHolder || holderStatus(stateDir);
  const running = holder.state === 'held';
  const log = readEventLog(logPath);
  const offset = readOffset(stateFile);
  const pending = db ? await readPendingWork() : { available: false, source: 'postgres', reason: 'skipped (--no-db)' };
  const mode = (holder.record && holder.record.mode) || 'live';

  // LIVENESS OF WORK, not of the process. Twice on 2026-08-03 this surface said
  // running: true while the log had not moved for an hour. The process table
  // cannot answer "is it doing anything" and was never asked to.
  const liveness = assessLiveness({
    running, lastWriteAt: log.exists ? log.last_write_at : null, nowMs, mode, env,
  });

  const dependencies = injectedDependencies || readDependencies();

  const problems = [];
  if (!running && holder.state === 'unverifiable') problems.push(`lock holder could not be verified: ${holder.reason}`);
  if (holder.state === 'stale') problems.push(`a stale lock is present and will be reclaimed on next start: ${holder.reason}`);
  if (!running && holder.state === 'free') problems.push('no poller is running - messages sent to ShopperBot WAIT in Telegram (they are not lost) until one starts');
  // STALLED: alive and silent. Recovery is `--restart`, which is named here so
  // the status document carries its own remedy rather than requiring the source.
  if (liveness.stalled === true) {
    problems.push(`the runtime is STALLED - ${liveness.reason}. It holds the lock, so nothing else will start; recover with: node ensure-asdair-runtime.mjs --restart`);
  }
  if (liveness.stalled === null && running && liveness.silent_for_seconds !== null) {
    problems.push(`runtime liveness could not be judged: ${liveness.reason}`);
  }
  // DEPENDENCY-AWARE HEALTH. `healthy` must not be able to be true while
  // something the live path requires cannot even be loaded.
  if (!dependencies.ok) {
    const callers = dependencies.pg.unresolvable.map((u) => u.caller).join(', ');
    problems.push(`a required dependency is UNRESOLVABLE from ${dependencies.pg.unresolvable.length} of ${dependencies.pg.checked} calling folders: ${callers} - node resolves from the CALLER, so installing it for pipeline-runtime does not help them`);
  }
  if (log.offset_held) problems.push('the intake offset is HELD on a failed update - it is being redelivered, and nothing after it is being processed');
  if (log.last_error) problems.push(`last recorded runtime error: ${log.last_error.event}`);
  if (!pending.available && db) problems.push(`pending work could not be read: ${pending.reason}`);
  if (!armed(stateDir).armed) problems.push(`the live runtime is DISARMED - ${armed(stateDir).reason}`);

  return {
    generated_at: new Date(nowMs).toISOString(),
    host: os.hostname(),
    runtime: {
      running,
      lock_state: holder.state,
      pid: holder.record && !holder.record.malformed ? (holder.record.pid ?? null) : null,
      mode: holder.record ? holder.record.mode || null : null,
      started_at: holder.record ? holder.record.started_at || null : null,
      uptime_seconds: uptimeSeconds(holder, nowMs),
      entry: holder.record ? holder.record.entry || RUNTIME_ENTRY : RUNTIME_ENTRY,
      identity_verified: holder.state === 'held',
      reason: holder.reason,
      source: 'operating system process table, cross-checked against the runtime lock',
      // Alive is not the same as working. Both are reported, side by side, so a
      // consumer cannot read one and believe it has the other.
      stalled: liveness.stalled,
      liveness,
    },
    armed: armed(stateDir),
    dependencies,
    telegram_offset: offset,
    activity: log,
    pending_work: pending,
    problems,
    healthy: problems.length === 0,
    paths: { state_dir: stateDir, lock: path.join(stateDir, 'runtime.pid'), log: logPath, cache: path.join(stateDir, 'status.json') },
  };
}

function uptimeSeconds(holder, nowMs = Date.now()) {
  if (holder.state !== 'held') return null;
  const started = holder.process && holder.process.createdAt ? Date.parse(holder.process.createdAt) : null;
  return started ? Math.round((nowMs - started) / 1000) : null;
}

/**
 * The arming gate.
 *
 * The live poller CONSUMES Telegram updates destructively. It must therefore
 * never start itself for the first time by accident - a logon task that fires
 * on a machine nobody was watching can eat a shopping list that was being kept
 * for acceptance. Arming is one explicit command and it persists across
 * reboots; disarming is one more.
 */
export function armed(stateDir = STATE_DIR) {
  const file = path.join(stateDir, 'runtime.armed');
  try {
    const body = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { armed: true, since: body.armed_at || null, by: body.armed_by || null, file };
  } catch {
    return { armed: false, file, reason: `no arming file at ${file} - run: node ensure-asdair-runtime.mjs --arm` };
  }
}

/** Write the cached snapshot. Atomic, and stamped so nobody mistakes it for live. */
export function writeCache(status, stateDir = STATE_DIR) {
  const target = path.join(stateDir, 'status.json');
  fs.mkdirSync(stateDir, { recursive: true });
  const body = `${JSON.stringify({ _cache: 'a SNAPSHOT of asdair-status.mjs, not a source of truth - re-run the command for live facts', ...status }, null, 1)}\n`;
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, target);
  return target;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  const argv = new Set(process.argv.slice(2));
  const status = await collect({ db: !argv.has('--no-db') });
  if (argv.has('--write')) writeCache(status);
  console.log(JSON.stringify(status, null, argv.has('--compact') ? 0 : 1));
  process.exit(status.healthy ? 0 : 1);
}

export { HERE };
