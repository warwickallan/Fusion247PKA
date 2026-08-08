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
// The WO-B checks below EXTEND that discipline rather than relaxing it: the
// gateway URL may itself carry userinfo (https://user:pass@host/v1), so nothing
// here ever echoes a URL - only its `host`, which excludes userinfo by
// construction - and nothing echoes a fetch error message, which can embed the
// whole URL. The scheduled task's argument string contains the PATHS of the
// credentials files, so only the launcher path is ever extracted from it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  acquire, holderStatus, stopHolder, clearLock, inspectPid, isBlocking, sleepSync,
} from './runtime-lock.mjs';
import { collect, writeCache, armed } from './asdair-status.mjs';
import { PG_CONSUMERS } from './runtime-deps.mjs';
import {
  STATE_DIR, LOG, RUNTIME_ENTRY, RUNTIME_CWD, SELFTEST_ENTRY, HERE,
  CHROME_DEFAULT_PROFILE_DIR, chromeProfileDir,
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

// =====================================================================
// WO-B - THE CONFIGURATION CONTRACT
//
// WHY THIS SECTION EXISTS (SHOP-2026-08-03; DEFECT-LEDGER D-02/D-04/D-05/D-07):
// preflight used to check that four environment variables were SET. A live shop
// then failed four times on things preflight had just called fine - a vision
// model alias the gateway does not serve, a gateway that was never configured at
// all, two tables whose grants existed in the live database but nowhere in git,
// and a media root whose absence disabled photo evidence in silence.
//
// The lesson, in Warwick's words: "A default model name that the gateway does
// not provide must never survive preflight again." A presence check is not a
// proof. Everything below asks the thing itself.
//
// The full variable-by-variable contract lives in
// services/asdair/CONFIGURATION.md, which is canonical.
// =====================================================================

/** Two exit classes. BLOCKING lands in `problems[]` and stops a start.
 *  ADVISORY lands in `warnings[]` and does not. */
export const BLOCKING = 'blocking';
export const ADVISORY = 'advisory';

/**
 * THE GRANT MATRIX - READ from migrations 005/006/008/009/010, not decided here.
 *
 * This is not a design. Every positive row below is a `grant` statement
 * committed in services/asdair/db/, and every deliberate ABSENCE is one those
 * migrations state in prose as intentional. Keel does not decide schema; WO-B
 * records this explicitly ("the grant matrix is READ from committed migrations
 * as a decision already made").
 *
 * WHY THE NEGATIVES MATTER AS MUCH AS THE POSITIVES. The first draft of this
 * Work Order said "every table, for BOTH roles". Applied literally that ships a
 * preflight which refuses to start a CORRECTLY provisioned database: migration
 * 010 deliberately gives asdair_rw no grant at all on budget_settings or
 * product_alternatives ("no asdair_rw code path touches either table anywhere in
 * this codebase"), and 005 deliberately withholds UPDATE on rules. So an
 * over-grant is a finding in its own right, and a check that cannot tell the two
 * apart is not checking the matrix at all.
 *
 *   table  - granted at TABLE level       -> has_table_privilege must be true
 *   column - granted at COLUMN level only -> has_table_privilege must be FALSE
 *            and has_any_column_privilege must be true. Postgres does not treat
 *            a column grant as a table grant; conflating them would report a
 *            false BLOCKING failure on the regulars learning path.
 *   anything else on a listed table -> must be absent in both forms.
 *
 * SCOPE LIMIT, STATED RATHER THAN PAPERED OVER: a table absent from this matrix
 * is a table no migration in git grants to that role. Absence of a grant
 * statement is not the same as a committed denial, so no expectation is asserted
 * for those pairs. See the README and the handback: asdair_ro's SELECT on
 * asdair.regulars is read live and appears in NO migration - the same provenance
 * gap class as D-07, reported and deliberately not invented here.
 */
export const GRANT_MATRIX = Object.freeze({
  // The SELECT-only planning role (ASDAIR_DB_URL). Contractually SELECT-only so
  // that a bug CANNOT write.
  asdair_ro: Object.freeze({
    // 006_shop_control_surface.sql
    'asdair.shop': { table: ['SELECT'] },
    'asdair.shop_event': { table: ['SELECT'] },
    'asdair.shop_question': { table: ['SELECT'] },
    'asdair.browser_build_request': { table: ['SELECT'] },
    'asdair.pending_action': { table: ['SELECT'] },
    'asdair.order_confirmation': { table: ['SELECT'] },
    'asdair.order_confirmation_line': { table: ['SELECT'] },
    // 008_shop_line_interpretation.sql
    'asdair.shop_line': { table: ['SELECT'] },
    // 009_pipeline_command_and_question_render.sql
    'asdair.pipeline_command': { table: ['SELECT'] },
    // 010_household_and_list_grants.sql
    'asdair.households': { table: ['SELECT'] },
    'asdair.budget_settings': { table: ['SELECT'] },
    'asdair.shopping_lists': { table: ['SELECT'] },
    'asdair.shopping_list_items': { table: ['SELECT'] },
    'asdair.product_alternatives': { table: ['SELECT'] },
  }),
  // The narrow write role (ASDAIR_WRITE_DB_URL). No DELETE anywhere, by design:
  // 006 states the runtime "may never delete" a shop, and no migration grants
  // DELETE on any table to this role.
  asdair_rw: Object.freeze({
    // 005_asdair_rw_grants.sql - the learning path. INSERT and UPDATE on
    // regulars are COLUMN-scoped on purpose: 005 calls the update column list
    // "the security boundary", so a learning write can enrich a regular and can
    // never rename or retire one.
    'asdair.regulars': { table: ['SELECT'], column: ['INSERT', 'UPDATE'] },
    'asdair.orders': { table: ['SELECT', 'INSERT'] },
    'asdair.order_events': { table: ['SELECT', 'INSERT'] },
    // UPDATE (promoted_rule_id) only - the learning back-link and nothing else.
    'asdair.rule_qa_log': { table: ['SELECT', 'INSERT'], column: ['UPDATE'] },
    // No UPDATE: a rule is immutable to this role (D-2026-08-03-16).
    'asdair.rules': { table: ['SELECT', 'INSERT'] },
    'asdair.source_documents': { table: ['SELECT'] },
    // 006_shop_control_surface.sql
    'asdair.shop': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.shop_event': { table: ['SELECT', 'INSERT'] },   // append-only ledger
    'asdair.shop_question': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.browser_build_request': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.pending_action': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.order_confirmation': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.order_confirmation_line': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    // 008 / 009
    'asdair.shop_line': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    'asdair.pipeline_command': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    // 010_household_and_list_grants.sql
    'asdair.households': { table: ['SELECT'] },
    'asdair.shopping_lists': { table: ['SELECT', 'INSERT'] },
    'asdair.shopping_list_items': { table: ['SELECT', 'INSERT', 'UPDATE'] },
    // DELIBERATE NEGATIVES, stated in 010's own header: no asdair_rw code path
    // touches either table, so it gets no grant on either.
    'asdair.budget_settings': {},
    'asdair.product_alternatives': {},
  }),
});

/** The privileges the matrix reasons about. DELETE has no column-level form. */
export const MATRIX_PRIVILEGES = Object.freeze(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
const COLUMN_CAPABLE = Object.freeze(['SELECT', 'INSERT', 'REFERENCES', 'UPDATE']);

/**
 * Named column-level denials migration 005 calls out explicitly: "name,
 * household_id and active are absent on purpose and must stay absent." A
 * table-level probe cannot see these, so they are probed by column.
 */
export const COLUMN_DENIALS = Object.freeze([
  { role: 'asdair_rw', table: 'asdair.regulars', column: 'name', privilege: 'UPDATE' },
  { role: 'asdair_rw', table: 'asdair.regulars', column: 'household_id', privilege: 'UPDATE' },
  { role: 'asdair_rw', table: 'asdair.regulars', column: 'active', privilege: 'UPDATE' },
]);

/**
 * Every folder whose code calls require('pg') on the LIVE shopping path, and a
 * real file in it to resolve from. Node resolves from the CALLER, so `pg` being
 * installed for pipeline-runtime says nothing about any of these.
 *
 * D-2026-08-03-01: this exact class hit THREE separate folders in one live run.
 * Checking only shop/ - which is what this file used to do - was checking a
 * third of the failure.
 */
// MOVED 2026-08-04 (WO-ZA item 1) to runtime-deps.mjs, and re-exported here so
// every existing importer and this file's own test suite are unaffected. It had
// to move because the STATUS surface must probe the same list preflight gates
// on, and status cannot import this file - this file imports status. Imported
// at the top of this module; re-exported here to keep the surface identical.
export { PG_CONSUMERS };

/** Chrome. Neither path was configuration before WO-B - the profile directory
 *  existed only as a comment in browser-runner/cdp.js, which is exactly why it
 *  was unverifiable. Mack owns the real values. See CONFIGURATION.md. */
export const CHROME_DEFAULT_EXE_CANDIDATES = Object.freeze([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]);
// MOVED 2026-08-04 (WO-ZA follow-up) to runtime-paths.mjs, alongside the two
// other helpers that fall through to the household root, and re-exported here
// so this module's own test suite is unaffected. It was the third fall-through
// found by the 5A sweep and the only one left documented rather than guarded;
// PROOF 10 now resolves it with the other two.
export { CHROME_DEFAULT_PROFILE_DIR };
export const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';

/** The logon task install-startup-task.ps1 registers. One literal, one place. */
export const SCHEDULED_TASK_NAME = 'MyPKA-AsdAIr-Runtime';

/** The vision alias services/obsidiwikai/src/core/models.mjs falls back to when
 *  FUSION_MODEL_VISION is unset. THE GATEWAY DOES NOT SERVE IT (D-05). Named
 *  here so preflight fails on the default instead of a live shop failing on it;
 *  the default itself is outside this Work Order's file surface and is
 *  REPORTED, not fixed. */
export const VISION_MODEL_DEFAULT = 'fusion.vision';

// ---------------------------------------------------------------------
// Pure evaluators - the decision logic, separated from the wire so it can be
// proved offline in BOTH directions. A check that cannot be made to fail is
// not a check.
// ---------------------------------------------------------------------

/** Flatten GRANT_MATRIX into one expectation per (role, table, privilege). */
export function grantExpectations(matrix = GRANT_MATRIX) {
  const out = [];
  for (const [role, tables] of Object.entries(matrix)) {
    for (const [table, spec] of Object.entries(tables)) {
      const tableLevel = spec.table || [];
      const columnLevel = spec.column || [];
      for (const privilege of MATRIX_PRIVILEGES) {
        let expect = 'absent';
        if (tableLevel.includes(privilege)) expect = 'table';
        else if (columnLevel.includes(privilege)) expect = 'column-only';
        out.push({ role, table, privilege, expect });
      }
    }
  }
  return out;
}

/**
 * Compare what Postgres reports against what git commits.
 *
 * @param {Array} expectations from grantExpectations()
 * @param {Map<string,{table_priv:boolean, any_col_priv:boolean|null}>} observed
 *        keyed `role|table|privilege`
 */
export function evaluateGrants(expectations, observed) {
  const missing = [];
  const overGranted = [];
  const unobserved = [];
  let verified = 0;

  for (const e of expectations) {
    const key = `${e.role}|${e.table}|${e.privilege}`;
    const seen = observed.get(key);
    if (!seen) { unobserved.push(key); continue; }
    const heldInAnyForm = seen.table_priv === true
      || (seen.any_col_priv === true && e.privilege !== 'DELETE');

    if (e.expect === 'table') {
      if (seen.table_priv === true) verified += 1;
      else missing.push(`${e.role} lacks table-level ${e.privilege} on ${e.table}`);
    } else if (e.expect === 'column-only') {
      if (seen.table_priv === true) {
        overGranted.push(`${e.role} has TABLE-level ${e.privilege} on ${e.table}; migration 005 grants it per-column only`);
      } else if (seen.any_col_priv === true) {
        verified += 1;
      } else {
        missing.push(`${e.role} lacks column-level ${e.privilege} on ${e.table}`);
      }
    } else if (heldInAnyForm) {
      overGranted.push(`${e.role} HAS ${e.privilege} on ${e.table}; no committed migration grants it`);
    } else {
      verified += 1;
    }
  }
  return { missing, overGranted, unobserved, verified };
}

/** The named column denials from 005. `observed` maps `role|table|column|priv`. */
export function evaluateColumnDenials(denials, observed) {
  const overGranted = [];
  const unobserved = [];
  let verified = 0;
  for (const d of denials) {
    const key = `${d.role}|${d.table}|${d.column}|${d.privilege}`;
    const seen = observed.get(key);
    if (seen === undefined) { unobserved.push(key); continue; }
    if (seen === true) {
      overGranted.push(`${d.role} has ${d.privilege} on ${d.table}.${d.column}; migration 005 states it must stay absent`);
    } else verified += 1;
  }
  return { overGranted, unobserved, verified };
}

/**
 * Read model ids out of a gateway /models response, tolerating both the OpenAI
 * `{data:[{id}]}` envelope and a bare array. `null` means "not a model list",
 * which is NOT the same as "the model is missing" and must not read as a pass.
 */
export function extractModelIds(body) {
  const rows = Array.isArray(body)
    ? body
    : (body && Array.isArray(body.data) ? body.data : null);
  if (!rows) return null;
  return rows
    .map((r) => (typeof r === 'string' ? r : (r && typeof r.id === 'string' ? r.id : null)))
    .filter((v) => typeof v === 'string' && v.length > 0);
}

/**
 * AC7, the criterion Warwick named. Is the model the pipeline will actually ask
 * for one the gateway will actually serve?
 *
 * `configured` is the EFFECTIVE alias - FUSION_MODEL_VISION, or the models.mjs
 * fallback when it is unset. An unset variable is not a pass: the fallback is
 * precisely the value that killed every photo list on 2026-08-03.
 */
export function evaluateVisionModel(configured, ids, { usingDefault = false } = {}) {
  if (ids === null) {
    return { ok: false, reason: "the gateway's /models response was not a recognisable model list, so the configured vision model could NOT be verified" };
  }
  if (ids.includes(configured)) {
    return { ok: true, reason: `'${configured}' is served by this gateway (${ids.length} model(s) offered)` };
  }
  const suffix = usingDefault
    ? ` FUSION_MODEL_VISION is UNSET, so the pipeline falls back to '${VISION_MODEL_DEFAULT}' (services/obsidiwikai/src/core/models.mjs).`
    : '';
  return {
    ok: false,
    reason: `the configured vision model '${configured}' is NOT in this gateway's /models list (${ids.length} model(s) offered).${suffix} Set FUSION_MODEL_VISION to an id the gateway actually offers.`,
  };
}

/**
 * AC11 helper. SECRET HYGIENE: the registered argument string contains the
 * `--env-file=` PATHS of the credentials files. Those are never returned, never
 * logged and never compared - only the launcher .mjs path is extracted.
 */
export function launcherPathFromTaskArguments(argumentString) {
  if (typeof argumentString !== 'string') return null;
  const m = argumentString.match(/"?([^"]*ensure-asdair-runtime\.mjs)"?/i);
  return m ? m[1] : null;
}

// Slashes are normalised to '/' BEFORE path.resolve() runs, not after. On a
// POSIX host (the Linux CI runner, or any non-Windows dev box) path.resolve()
// treats a backslash as an ordinary character, not a separator, so a
// Windows-style registered path such as '\TMP\CHECKOUT-A\ensure...mjs' is NOT
// recognised as absolute - it gets silently joined onto process.cwd() instead
// of compared as itself, and two paths that are the SAME checkout, differing
// only by slash direction and case, come out as different strings. Converting
// backslashes to forward slashes first makes the path POSIX-absolute (it
// still starts with '/'), so resolve() leaves it alone on every platform and
// the only remaining differences are exactly the ones this comparison exists
// to ignore: slash direction and case.
export function samePath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const norm = (p) => path.resolve(p.replace(/\\/g, '/')).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

export function evaluateScheduledTask(task, expectedLauncher) {
  if (!task || task.found !== true) {
    return { ok: false, registered: false, detail: `no scheduled task named ${SCHEDULED_TASK_NAME} is registered - a reboot would not bring the runtime back` };
  }
  const registered = launcherPathFromTaskArguments(task.arguments);
  if (!registered) {
    return { ok: false, registered: true, detail: `${SCHEDULED_TASK_NAME} is registered but its command line names no ensure-asdair-runtime.mjs launcher` };
  }
  if (!samePath(registered, expectedLauncher)) {
    return {
      ok: false,
      registered: true,
      detail: `${SCHEDULED_TASK_NAME} points at a DIFFERENT checkout: ${registered} (this checkout: ${expectedLauncher}) - a reboot would start the other one`,
    };
  }
  return { ok: true, registered: true, detail: `${SCHEDULED_TASK_NAME} points at this checkout` };
}

/** A Telegram bot token is <digits>:<url-safe token>. Shape only - the value is
 *  never printed and the answer is a boolean. */
export function looksLikeTelegramToken(value) {
  return typeof value === 'string' && /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

// ---------------------------------------------------------------------
// Injected effects - everything that touches a wire lives behind one of these,
// so the decision logic above is provable offline. Nothing here executes during
// the test suite.
// ---------------------------------------------------------------------

async function defaultConnectDb(connectionString) {
  const require = createRequire(import.meta.url);
  let Client;
  try { ({ Client } = require('pg')); } catch {
    throw new Error("the 'pg' driver is not installed for pipeline-runtime");
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });
  await client.connect();
  return {
    query: (sql, params) => client.query(sql, params),
    end: async () => { try { await client.end(); } catch { /* already gone */ } },
  };
}

/**
 * A GET that returns a status and a parsed body and NEVER returns an error
 * message. A fetch failure message routinely embeds the whole request URL, and
 * FUSION_GATEWAY_URL may carry userinfo - so the failure vocabulary here is a
 * closed set of two words rather than whatever the runtime produced.
 */
async function defaultHttpGetJson(url, { headers = {}, timeoutMs = 10000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: ac.signal });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { reached: true, status: res.status, body };
  } catch (err) {
    return {
      reached: false, status: 0, body: null,
      failure: err && err.name === 'AbortError' ? 'not answering (timed out)' : 'unreachable',
    };
  } finally { clearTimeout(timer); }
}

/** READ-ONLY. Get-ScheduledTask inspects; it never registers, enables or runs. */
function defaultReadScheduledTask(taskName) {
  const ps = "$ErrorActionPreference='SilentlyContinue';"
    + ` $t = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue;`
    + " if (-not $t) { Write-Output '{\"found\":false}' } else {"
    + ' @{ found = $true; execute = $t.Actions[0].Execute; arguments = $t.Actions[0].Arguments;'
    + ' workingDirectory = $t.Actions[0].WorkingDirectory } | ConvertTo-Json -Compress }';
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
    });
    if (r.error || typeof r.stdout !== 'string' || r.stdout.trim() === '') return null;
    return JSON.parse(r.stdout.trim());
  } catch { return null; }
}

function defaultResolveFrom(fromFile, spec) {
  try {
    if (!fs.existsSync(fromFile)) return 'caller file missing';
    createRequire(fromFile).resolve(spec);
    return 'ok';
  } catch { return 'unresolvable'; }
}

export function defaultPreflightDeps() {
  return {
    existsSync: (p) => fs.existsSync(p),
    writeFileSync: (p, d) => fs.writeFileSync(p, d),
    rmSync: (p) => fs.rmSync(p, { force: true }),
    connectDb: defaultConnectDb,
    httpGetJson: defaultHttpGetJson,
    readScheduledTask: defaultReadScheduledTask,
    resolveFrom: defaultResolveFrom,
    holderStatus: (dir) => holderStatus(dir),
    armed: (dir) => armed(dir),
  };
}

// ---------------------------------------------------------------------
// Preflight - the questions worth answering BEFORE taking the lock
// ---------------------------------------------------------------------

/** NEVER return a URL. `new URL(u).host` is host:port and excludes userinfo. */
function hostOnly(url) {
  try { return new URL(url).host; } catch { return '(unparseable URL)'; }
}

function joinUrl(base, suffix) {
  return `${String(base).replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

function probeWritable(dir, deps) {
  const probe = path.join(dir, `.asdair-preflight-${process.pid}-${Date.now()}`);
  try {
    deps.writeFileSync(probe, 'preflight write probe');
    deps.rmSync(probe);
    return { writable: true };
  } catch (err) {
    return { writable: false, code: (err && err.code) || 'EUNKNOWN' };
  }
}

/**
 * Can the live runtime actually run?
 *
 * A launcher that cheerfully spawns a process which dies two seconds later is
 * worse than one that refuses: the lock churns, the log fills with the same
 * stack trace, and the status card says "not running" without saying why.
 *
 * SHAPE: returns exactly what it always did - { ok, mode, entry, checks,
 * problems } - plus `warnings[]`. `ok` still means "no BLOCKING problem", so
 * nothing that consumed the old shape behaves differently. Each entry in
 * `checks[]` now carries `ac` and `severity`.
 *
 * @param {boolean} o.includeSinglePoller AC9. FALSE on the start path, where an
 *   existing holder is handled separately and must keep exiting 0: the logon
 *   task re-firing while a healthy runtime is already up is NORMAL, and turning
 *   that into a preflight failure would report working recovery as broken.
 */
export async function preflight({
  mode = 'live',
  env = process.env,
  deps = defaultPreflightDeps(),
  includeSinglePoller = true,
  stateDir = STATE_DIR,
  launcherPath = fileURLToPath(import.meta.url),
} = {}) {
  const problems = [];
  const warnings = [];
  const checks = [];

  const add = (ac, check, ok, severity, detail) => {
    checks.push({ ac, check, ok, severity, detail });
    if (ok) return;
    if (severity === BLOCKING) problems.push(`[${ac}] ${detail}`);
    else warnings.push(`[${ac}] ${detail}`);
  };

  const entry = mode === 'selftest' ? SELFTEST_ENTRY : RUNTIME_ENTRY;
  const entryOk = deps.existsSync(entry);
  add('AC0', 'runtime entry exists', entryOk, BLOCKING,
    entryOk ? entry : `runtime entry not found: ${entry}`);

  if (mode === 'live') {
    // --- AC1: credentials present, never read ----------------------------
    for (const name of REQUIRED_ENV) {
      const ok = typeof env[name] === 'string' && env[name].length > 0;
      add('AC1', `env ${name} is set`, ok, BLOCKING,
        ok ? 'set (value never read here)'
          : `${name} is not set - pass it with node --env-file=<credentials file>`);
    }
    if (typeof env.SHOPPER_BOT_TOKEN === 'string' && env.SHOPPER_BOT_TOKEN.length > 0) {
      const shaped = looksLikeTelegramToken(env.SHOPPER_BOT_TOKEN);
      add('AC1', 'SHOPPER_BOT_TOKEN has the shape of a Telegram bot token', shaped, ADVISORY,
        shaped ? 'shape ok (value never read here)'
          : 'set, but does not match <digits>:<token> - a truncated or mis-pasted token authenticates as nothing');
    }

    // --- AC2: the allowlist PARSES, not merely "is set" -------------------
    await checkAllowlist(env, add);

    // --- AC10: dependencies resolve, from every caller --------------------
    checkDependencies(deps, add);

    // --- AC3 + AC4: the databases, and the grants Postgres itself reports --
    await checkDatabases(env, deps, add);

    // --- AC5: media root (ADVISORY - see the function's own reasoning) -----
    checkMediaRoot(env, deps, add);

    // --- AC6 + AC7: the gateway, and the model it will actually serve ------
    await checkGateway(env, deps, add);

    // --- AC8: Chrome -------------------------------------------------------
    await checkChrome(env, deps, add);

    // --- AC11: the logon task points at THIS checkout ----------------------
    checkScheduledTask(deps, add, launcherPath);
  }

  // --- AC9: exactly one runtime -----------------------------------------
  if (includeSinglePoller) {
    const holder = deps.holderStatus(stateDir);
    const alone = !isBlocking(holder.state);
    add('AC9', 'exactly one runtime (nothing else holds the single-poller lock)', alone, BLOCKING,
      alone ? `lock state: ${holder.state}`
        : `another runtime already holds the single-poller lock (${holder.state}): ${holder.reason}`);
  }

  const arm = deps.armed(stateDir);
  const armOk = mode !== 'live' || arm.armed;
  add('ARM', 'live runtime is armed', armOk, BLOCKING,
    arm.armed ? `armed ${arm.since}` : arm.reason);

  return { ok: problems.length === 0, mode, entry, checks, problems, warnings };
}

/**
 * AC2. "Is it set" was never the question - a list of blanks, or of names
 * instead of numeric ids, is set and allows nobody.
 *
 * The parser is IMPORTED from the intake rather than copied: the receiver's
 * behaviour is the thing preflight must predict, and a second implementation
 * would drift from it exactly when it mattered. Imported lazily so a missing
 * intake folder degrades this one check instead of stopping the launcher from
 * loading at all.
 */
async function checkAllowlist(env, add) {
  const raw = [env.SHOPPER_ALLOWED_SENDER_IDS, env.SHOPPER_ALLOWED_USER_IDS]
    .find((v) => typeof v === 'string' && v.length > 0);

  if (raw === undefined) {
    add('AC2', `env ${REQUIRED_ENV_EITHER[0].join(' or ')} is set`, false, BLOCKING,
      `none of ${REQUIRED_ENV_EITHER[0].join(' / ')} is set - the sender allowlist is default-deny, so nothing would be accepted`);
    return;
  }

  let parse = null;
  try {
    ({ parseAllowedSenderIds: parse } = await import('../intake/shopperIntake.js'));
  } catch {
    add('AC2', 'the sender allowlist parses to at least one valid id', false, ADVISORY,
      'set, but services/asdair/intake/shopperIntake.js could not be loaded to parse it the way the receiver will - NOT CHECKED, which is not a pass');
    return;
  }

  try {
    const ids = parse(raw);
    add('AC2', 'the sender allowlist parses to at least one valid id', ids.length > 0, BLOCKING,
      `${ids.length} allowed sender id(s) (values never printed)`);
  } catch (err) {
    add('AC2', 'the sender allowlist parses to at least one valid id', false, BLOCKING,
      `the allowlist is set but the receiver would reject it: ${err.message}`);
  }
}

/** AC10. `pg` resolved from every folder that will ask for it. */
function checkDependencies(deps, add) {
  const unresolved = [];
  for (const rel of PG_CONSUMERS) {
    const from = path.join(HERE, '..', rel);
    const state = deps.resolveFrom(from, 'pg');
    if (state !== 'ok') unresolved.push(`${rel} (${state})`);
  }
  add('AC10', `the live path can resolve 'pg' from all ${PG_CONSUMERS.length} calling folders`,
    unresolved.length === 0, BLOCKING,
    unresolved.length === 0
      ? `resolvable from: ${PG_CONSUMERS.join(', ')}`
      : `'pg' is unresolvable from ${unresolved.length} of ${PG_CONSUMERS.length} callers: ${unresolved.join('; ')} - node resolves from the CALLER, so installing it for pipeline-runtime does not help them. Run npm install in each folder before arming.`);
}

/**
 * AC3 + AC4. Connect as each role for real, confirm WHICH role answered, then
 * ask Postgres itself about every privilege the committed migrations grant.
 *
 * Confirming the role NAME is not decoration. This estate has already issued a
 * Work Order that named the SELECT-only URL as the writer; a connection string
 * that "works" says nothing about which role is behind it.
 */
async function checkDatabases(env, deps, add) {
  const roles = [
    { label: 'read', varName: 'ASDAIR_DB_URL', expectRole: 'asdair_ro' },
    { label: 'write', varName: 'ASDAIR_WRITE_DB_URL', expectRole: 'asdair_rw' },
  ];

  let probeConn = null;
  for (const r of roles) {
    const cs = env[r.varName];
    if (typeof cs !== 'string' || cs.length === 0) continue;   // AC1 already reported it
    let conn = null;
    try {
      conn = await deps.connectDb(cs);
      const who = await conn.query('select current_user as role, current_database() as db');
      const actual = who.rows[0].role;
      add('AC3', `the ${r.label} database connection works (${r.varName})`, true, BLOCKING,
        `connected as ${actual} to database ${who.rows[0].db}`);
      const roleOk = actual === r.expectRole;
      add('AC3', `${r.varName} connects as ${r.expectRole}`, roleOk, BLOCKING,
        roleOk
          ? `role confirmed: ${actual}`
          : `${r.varName} connects as '${actual}', not '${r.expectRole}' - the grant matrix describes ${r.expectRole}, so this connection is not the one the runtime's safety argument assumes`);
      if (!probeConn) probeConn = conn; else await conn.end();
    } catch (err) {
      add('AC3', `the ${r.label} database connection works (${r.varName})`, false, BLOCKING,
        `${r.varName} did not connect: ${dbFailure(err)} - the runtime would start and then die on its first query`);
      if (conn) await conn.end();
    }
  }

  if (!probeConn) {
    add('AC4', 'the committed grant matrix matches what Postgres reports', false, BLOCKING,
      'NOT CHECKED - no database connection was available to ask. This is not a pass.');
    return;
  }

  try {
    await checkGrantMatrix(probeConn, add);
  } catch (err) {
    add('AC4', 'the committed grant matrix matches what Postgres reports', false, BLOCKING,
      `NOT CHECKED - the privilege probe itself failed: ${dbFailure(err)}. This is not a pass.`);
  } finally {
    await probeConn.end();
  }
}

/** A connection failure reported WITHOUT the connection string in it. */
function dbFailure(err) {
  return err && err.code ? String(err.code) : 'refused, or timed out';
}

const PRIVILEGE_SQL = `
  select t.role, t.tbl, t.priv,
         has_table_privilege(t.role, t.tbl, t.priv) as table_priv,
         case when t.priv = any($4::text[])
              then has_any_column_privilege(t.role, t.tbl, t.priv)
              else null end                          as any_col_priv
    from unnest($1::text[], $2::text[], $3::text[]) as t(role, tbl, priv)
   where to_regclass(t.tbl) is not null`;

const COLUMN_SQL = `
  select t.role, t.tbl, t.col, t.priv,
         has_column_privilege(t.role, t.tbl, t.col, t.priv) as col_priv
    from unnest($1::text[], $2::text[], $3::text[], $4::text[]) as t(role, tbl, col, priv)
   where to_regclass(t.tbl) is not null`;

async function checkGrantMatrix(conn, add) {
  // Roles first: has_table_privilege raises if the role does not exist.
  const wanted = Object.keys(GRANT_MATRIX);
  const present = new Set(
    (await conn.query('select rolname from pg_roles where rolname = any($1::text[])', [wanted]))
      .rows.map((r) => r.rolname),
  );
  const absentRoles = wanted.filter((r) => !present.has(r));
  if (absentRoles.length > 0) {
    add('AC4', 'both roles exist on this database', false, BLOCKING,
      `role(s) not provisioned: ${absentRoles.join(', ')} - the grant matrix cannot be verified and the runtime's access model does not exist here`);
    return;
  }
  add('AC4', 'both roles exist on this database', true, BLOCKING, wanted.join(', '));

  const expectations = grantExpectations().filter((e) => present.has(e.role));
  const res = await conn.query(PRIVILEGE_SQL, [
    expectations.map((e) => e.role),
    expectations.map((e) => e.table),
    expectations.map((e) => e.privilege),
    COLUMN_CAPABLE,
  ]);
  const observed = new Map(res.rows.map((r) => [`${r.role}|${r.tbl}|${r.priv}`, {
    table_priv: r.table_priv, any_col_priv: r.any_col_priv,
  }]));
  const verdict = evaluateGrants(expectations, observed);

  const colRes = await conn.query(COLUMN_SQL, [
    COLUMN_DENIALS.map((d) => d.role),
    COLUMN_DENIALS.map((d) => d.table),
    COLUMN_DENIALS.map((d) => d.column),
    COLUMN_DENIALS.map((d) => d.privilege),
  ]);
  const colObserved = new Map(colRes.rows.map((r) => [`${r.role}|${r.tbl}|${r.col}|${r.priv}`, r.col_priv]));
  const colVerdict = evaluateColumnDenials(COLUMN_DENIALS, colObserved);

  const { missing } = verdict;
  const over = [...verdict.overGranted, ...colVerdict.overGranted];
  const unobserved = [...verdict.unobserved, ...colVerdict.unobserved];

  add('AC4', 'every grant the committed migrations make is genuinely in place',
    missing.length === 0, BLOCKING,
    missing.length === 0
      ? `${verdict.verified + colVerdict.verified} privilege assertions verified via has_table_privilege / has_any_column_privilege / has_column_privilege across ${wanted.length} roles`
      : `${missing.length} committed grant(s) MISSING from this database: ${missing.join('; ')}`);

  // An over-grant is a finding in its own right (AC4). ADVISORY rather than
  // BLOCKING: a role holding MORE than git says is real drift and a real
  // widening of the blast radius, but it does not stop a shop completing, and
  // refusing to start over it would strand the household mid-week.
  add('AC4', 'neither role holds a privilege the migrations do not grant',
    over.length === 0, ADVISORY,
    over.length === 0
      ? 'no over-grant detected'
      : `${over.length} privilege(s) exist that NO committed migration grants - schema-as-deployed has drifted from schema-as-code: ${over.join('; ')}`);

  const missingTables = [...new Set(unobserved.map((k) => k.split('|')[1]))];
  add('AC4', 'every table in the matrix exists on this database',
    unobserved.length === 0, BLOCKING,
    unobserved.length === 0
      ? `${new Set(expectations.map((e) => e.table)).size} table(s) present`
      : `${missingTables.length} table(s) in the committed matrix do not exist here: ${missingTables.join(', ')}`);
}

/**
 * AC5. ADVISORY, deliberately.
 *
 * ASDAIR_MEDIA_ROOT is read by services/asdair/cockpit-api/server.js - a
 * SEPARATE process, started with its own --env-file pair. This process's
 * environment therefore proves nothing about cockpit-api's, in either
 * direction, and blocking the runtime on it would refuse to shop because a
 * photo viewer is misconfigured. What preflight can honestly say is what it
 * found HERE, labelled as such.
 */
function checkMediaRoot(env, deps, add) {
  const root = env.ASDAIR_MEDIA_ROOT;
  const note = " (consumed by cockpit-api, a separate process with its own env-file pair - this runtime's environment neither proves nor disproves cockpit-api's)";
  if (typeof root !== 'string' || root.length === 0) {
    add('AC5', 'ASDAIR_MEDIA_ROOT is set and writable', false, ADVISORY,
      `ASDAIR_MEDIA_ROOT is not set in THIS process's environment; if it is also absent from cockpit-api's, Cockpit photo evidence is silently disabled (media_root_not_configured)${note}`);
    return;
  }
  if (!deps.existsSync(root)) {
    add('AC5', 'ASDAIR_MEDIA_ROOT is set and writable', false, ADVISORY,
      `ASDAIR_MEDIA_ROOT points at a directory that does not exist${note}`);
    return;
  }
  const w = probeWritable(root, deps);
  add('AC5', 'ASDAIR_MEDIA_ROOT is set and writable', w.writable, ADVISORY,
    w.writable ? `set and writable${note}` : `set and present, but NOT writable (${w.code})${note}`);
}

/**
 * AC6 + AC7. The gateway is asked, not assumed.
 *
 * The unauthenticated probe is genuinely useful: a 401 proves the endpoint is a
 * real, key-protected gateway rather than a proxy, a captive portal, or a stale
 * DNS answer that happens to accept TCP.
 */
async function checkGateway(env, deps, add) {
  const url = env.FUSION_GATEWAY_URL;
  const notChecked = (why) => add('AC7', "FUSION_MODEL_VISION is present in the gateway's own /models response",
    false, BLOCKING, `NOT CHECKED - ${why}. This is not a pass.`);

  if (typeof url !== 'string' || url.length === 0) {
    add('AC6', 'FUSION_GATEWAY_URL is reachable', false, BLOCKING,
      'FUSION_GATEWAY_URL is not set - every photo list dies at TRANSCRIBING with "no vision-capable gateway configured"');
    notChecked('no gateway is configured to ask');
    return;
  }
  const modelsUrl = joinUrl(url, 'models');
  const host = hostOnly(url);

  const anon = await deps.httpGetJson(modelsUrl, {});
  if (!anon.reached) {
    add('AC6', 'FUSION_GATEWAY_URL is reachable', false, BLOCKING,
      `the gateway at ${host} is ${anon.failure} - every photo list would die at TRANSCRIBING`);
    notChecked('the gateway could not be reached');
    return;
  }
  add('AC6', 'FUSION_GATEWAY_URL is reachable', true, BLOCKING, `${host} answered (HTTP ${anon.status})`);

  const key = env.FUSION_GATEWAY_KEY;
  if (typeof key !== 'string' || key.length === 0) {
    add('AC6', 'FUSION_GATEWAY_KEY authenticates', false, BLOCKING,
      `FUSION_GATEWAY_KEY is not set; ${host} answered an unauthenticated request with HTTP ${anon.status}`);
    notChecked('there is no gateway key to authenticate with');
    return;
  }

  if (anon.status === 200) {
    add('AC6', 'the gateway requires a key', false, ADVISORY,
      `${host} served /models to an UNAUTHENTICATED request - the endpoint is open, so FUSION_GATEWAY_KEY is not actually protecting it`);
  }

  const authed = await deps.httpGetJson(modelsUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!authed.reached) {
    add('AC6', 'FUSION_GATEWAY_KEY authenticates', false, BLOCKING,
      `the authenticated request to ${host} was ${authed.failure}`);
    notChecked('the authenticated request did not complete');
    return;
  }
  if (authed.status !== 200) {
    add('AC6', 'FUSION_GATEWAY_KEY authenticates', false, BLOCKING,
      `${host} rejected the configured key with HTTP ${authed.status} - the gateway is reachable but every call would fail`);
    notChecked('the key did not authenticate');
    return;
  }
  add('AC6', 'FUSION_GATEWAY_KEY authenticates', true, BLOCKING,
    `${host} accepted the configured key (HTTP 200; the key itself is never printed)`);

  // AC7 - the criterion Warwick named by name.
  const usingDefault = !(typeof env.FUSION_MODEL_VISION === 'string' && env.FUSION_MODEL_VISION.length > 0);
  const configured = usingDefault ? VISION_MODEL_DEFAULT : env.FUSION_MODEL_VISION;
  const verdict = evaluateVisionModel(configured, extractModelIds(authed.body), { usingDefault });
  add('AC7', "FUSION_MODEL_VISION is present in the gateway's own /models response",
    verdict.ok, BLOCKING, verdict.reason);
}

/**
 * AC8. Chrome, and the deliberate split between what must exist and what may
 * legitimately not be running yet.
 *
 * THE REASONING, recorded here because the Work Order requires the decision to
 * be defended rather than merely made:
 *
 *  - The EXECUTABLE and the DEDICATED PROFILE DIRECTORY are BLOCKING. Neither
 *    can appear by itself later. The missing profile is the worse of the two:
 *    the runner would drive some other profile, which is not signed in to the
 *    grocery account, and that surfaces halfway through a basket as an
 *    unexplained empty page rather than as a configuration error.
 *  - The CDP ENDPOINT is ADVISORY. Preflight runs at logon, thirty seconds
 *    after the desktop appears; the browser is opened later in the week when a
 *    basket is actually built. Blocking on a browser nobody has opened yet would
 *    make every logon report a failure, and would teach the household to ignore
 *    preflight - which is how a gate dies. The runner opens Chrome itself; what
 *    preflight can usefully say is whether one is already listening.
 */
async function checkChrome(env, deps, add) {
  const configuredExe = env.ASDAIR_CHROME_EXE;
  const candidates = (typeof configuredExe === 'string' && configuredExe.length > 0)
    ? [configuredExe] : CHROME_DEFAULT_EXE_CANDIDATES;
  const foundExe = candidates.find((c) => deps.existsSync(c)) || null;
  add('AC8', 'the Chrome executable exists', Boolean(foundExe), BLOCKING,
    foundExe || `no Chrome executable at ${candidates.join(' or ')} - set ASDAIR_CHROME_EXE to the real path`);

  // Resolved through runtime-paths.mjs, so this probe is covered by the same
  // household-root control as the state dir and the intake offset - rather than
  // being the one fall-through with a note on it instead of a test.
  const profile = chromeProfileDir(env);
  const profileOk = deps.existsSync(profile);
  add('AC8', 'the dedicated Chrome profile directory exists', profileOk, BLOCKING,
    profileOk ? profile
      : `no dedicated profile directory at ${profile} - the runner would drive a profile that is not signed in. Set ASDAIR_CHROME_PROFILE_DIR, or create it by launching Chrome once with --user-data-dir`);

  const endpoint = (typeof env.ASDAIR_CDP_ENDPOINT === 'string' && env.ASDAIR_CDP_ENDPOINT.length > 0)
    ? env.ASDAIR_CDP_ENDPOINT : DEFAULT_CDP_ENDPOINT;
  const probe = await deps.httpGetJson(joinUrl(endpoint, 'json/version'), { timeoutMs: 3000 });
  const live = probe.reached && probe.status === 200;
  add('AC8', 'a debuggable Chrome is listening (advisory - it is opened when a basket is built)',
    live, ADVISORY,
    live ? `CDP answered at ${hostOnly(endpoint)}`
      : `no CDP endpoint at ${hostOnly(endpoint)} - expected, unless a basket is being built right now`);
}

/** AC11. ADVISORY: a stale registration does not stop THIS start, it stops the
 *  NEXT reboot from bringing the right checkout back. */
function checkScheduledTask(deps, add, launcherPath) {
  let task = null;
  try { task = deps.readScheduledTask(SCHEDULED_TASK_NAME); } catch { task = null; }
  if (task === null) {
    add('AC11', 'the logon task points at this checkout', false, ADVISORY,
      'NOT CHECKED - the scheduled task could not be queried on this machine, which is not a pass');
    return;
  }
  const v = evaluateScheduledTask(task, launcherPath);
  add('AC11', 'the logon task points at this checkout', v.ok, ADVISORY, v.detail);
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
  // includeSinglePoller:false - an existing holder is handled below, where it is
  // a NORMAL outcome that exits 0. See preflight()'s note on AC9.
  const pre = await preflight({ mode, includeSinglePoller: false });
  for (const w of pre.warnings) log(`WARNING ${w}`);
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
    const pre = await preflight({ mode: argv.has('--selftest') ? 'selftest' : 'live' });
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
