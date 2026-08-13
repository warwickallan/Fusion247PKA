// =====================================================================
// BUILD-015 AsdAIr - cockpit-api/commandDeps.js
//
// THE WIRING THAT HAD NEVER EXISTED (WP-B15-41 AC3).
//
// ── THE DEFECT, STATED PRECISELY, BECAUSE IT IS EASY TO MISDESCRIBE ────────
//
// commandSurface.dispatch() calls `commands[name](args || {})` - ONE argument.
// Every command in services/asdair/pipeline/commands.js takes TWO:
// `answerQuestion(spec, deps)`, and its very first acts are
// `store.requireShop(deps, spec)` and `deps.shopStore.answerQuestion(...)`.
// So POST /asdair/command with `answerQuestion` threw on an undefined `deps`
// before it reached a row: the command surface was BOUND but never WIRED, and
// no answer given in the cockpit could ever have been applied.
//
// The command itself is unchanged and needs no change - it is correct, it is
// first-answer-wins idempotent, and it is the same function Telegram calls.
// What was missing is the container it is called with. Both statements are true
// at once, and this file is the second one.
//
// ── WHY THE CONTAINER IS BUILT HERE AND NOT IN THE PIPELINE ────────────────
//
// pipeline/deps.js's own pools `require('pg')` relative to services/asdair/
// pipeline, which has no node_modules in this checkout - and that directory is
// another lane's surface. So this module supplies its OWN readQuery/writeQuery,
// resolving `pg` from cockpit-api's dependencies, and hands them to the REAL
// createDeps() as overrides. Everything else in the container stays exactly
// what the pipeline builds, so the cockpit cannot drift into a second
// definition of what a command does. That is the same reason commandSurface.js
// refuses to keep a local fallback implementation.
//
// ── THE TWO CONNECTIONS ARE TWO ROLES, AND THAT IS THE POINT ───────────────
//
//   ASDAIR_DB_URL        the SELECT-only asdair_ro role. Reads only.
//   ASDAIR_WRITE_DB_URL  asdair_rw. INSERT/UPDATE, and NO DELETE anywhere in
//                        the grant matrix - verified against the target on
//                        2026-08-13.
//
// Keeping them apart is what makes a bug in a read path unable to write. This
// module never reads, logs, prints or interpolates either value: it hands the
// string to pg and nothing else, and httpApi.safeMessage() scrubs any
// connection string out of an error before it can reach a browser.
//
// PURE ASCII.
// =====================================================================

'use strict';

const path = require('path');

const PIPELINE_DEPS_PATH = path.join(__dirname, '..', 'pipeline', 'deps.js');

// ---------------------------------------------------------------------
// Pools. Lazy, so importing this module needs neither `pg` nor an environment
// - the whole pure surface still loads on a box with nothing installed, which
// is the construction rule every reader in this folder already follows.
// ---------------------------------------------------------------------

let readPool = null;
let writePool = null;

function makePool(url) {
  // Resolved from cockpit-api's OWN node_modules. `pg` is already declared in
  // this service's package.json (^8.11.0), so this adds no dependency.
  const { Pool } = require('pg');
  return new Pool({ connectionString: url });
}

function requireUrl(name) {
  const url = process.env[name];
  if (!url || String(url).trim() === '') {
    // Names the variable and what it is FOR. A service that fails on a missing
    // config must say which one, or the operator is left guessing - and the
    // message must never contain a value, only a name.
    const e = new Error('asdair cockpit-api: ' + name + ' is not set, so no command can be applied. '
      + 'Set it to the asdair ' + (name === 'ASDAIR_DB_URL' ? 'READ (asdair_ro)' : 'WRITE (asdair_rw)')
      + ' connection string.');
    e.code = 'ASDAIR_CONFIG_MISSING';
    throw e;
  }
  return url;
}

function getReadPool() {
  if (!readPool) readPool = makePool(requireUrl('ASDAIR_DB_URL'));
  return readPool;
}

function getWritePool() {
  if (!writePool) writePool = makePool(requireUrl('ASDAIR_WRITE_DB_URL'));
  return writePool;
}

/**
 * Every read inside BEGIN TRANSACTION READ ONLY - belt and braces on top of the
 * SELECT-only role, exactly as pipeline/deps.js, shopStatus.js and every reader
 * in this folder already do. Same return shape as the pipeline's own
 * realReadQuery: the pg result, because store.rowsOf() reads `result.rows`.
 */
async function readQuery(sql, params) {
  const client = await getReadPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* the read is over */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The write path, for the ledger table shopStore does not own
 * (asdair.pipeline_command, migration 009). One statement, one transaction.
 *
 * There is NO DELETE reachable from here: not because this function forbids it,
 * but because asdair_rw holds no DELETE grant on any table in the schema. The
 * boundary is the database's, which is the only place it is worth anything.
 */
async function writeQuery(sql, params) {
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* the write is over */ }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------
// The container.
// ---------------------------------------------------------------------

let container = null;

/**
 * Build (once) the dependency container the shared commands are called with.
 *
 * @param {object} [overrides] injected by tests. A test passes stubs and never
 *        touches `pg` or an environment variable.
 */
function getCommandDeps(overrides) {
  if (overrides) {
    // NOT cached. A test's container must never become the process's container,
    // or the first test to run would decide what production uses.
    // eslint-disable-next-line global-require
    const { createDeps } = require(PIPELINE_DEPS_PATH);
    return createDeps(Object.assign({ readQuery: readQuery, writeQuery: writeQuery }, overrides));
  }
  if (!container) {
    // require() of an ESM module: supported from Node 22.12, and this estate
    // runs v22.18.0. Established by execution rather than assumed, because a
    // failure here is a 500 on the only route that can settle a question.
    // eslint-disable-next-line global-require
    const { createDeps } = require(PIPELINE_DEPS_PATH);
    container = createDeps({ readQuery: readQuery, writeQuery: writeQuery });
  }
  return container;
}

/** Close every pool this module opened. Called by server.js on shutdown. */
async function closeCommandDeps() {
  const pools = [readPool, writePool].filter(Boolean);
  readPool = null;
  writePool = null;
  container = null;
  await Promise.all(pools.map(function (p) {
    return p.end().catch(function () { /* shutting down; a failed close is not news */ });
  }));
}

module.exports = {
  getCommandDeps: getCommandDeps,
  closeCommandDeps: closeCommandDeps,
  PIPELINE_DEPS_PATH: PIPELINE_DEPS_PATH,
  _internal: {
    readQuery: readQuery,
    writeQuery: writeQuery,
    requireUrl: requireUrl,
  },
};
