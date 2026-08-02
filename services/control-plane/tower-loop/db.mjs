// WO-TW-01 Tower supervisor loop — the SQLite store handle.
//
// WHAT THIS IS. A deliberately DUMB, pg-shaped façade over better-sqlite3, so the ten tower-loop
// modules keep the call shape they already had (`await pool.query(sql, params)` returning
// `{ rows, rowCount }`) while the store underneath is a single WAL SQLite file. It is NOT a
// Postgres→SQLite translator and must never grow into one: the SQL in this subsystem is a CLOSED
// SET of literals living in this repo, every one of them rewritten by hand at its call-site. If a
// new dialect difference turns up, fix the literal — do not teach this file to rewrite SQL.
//
// WHY SQLite. The subsystem needed a Postgres SERVER running for its runtime AND its tests. That
// server is the thing being removed; the dependency count barely moves (`pg` is a devDependency
// and stays, because other control-plane suites still use it).
//
// WHERE THE FILE LIVES. TOWER_SQLITE_PATH, defaulting to ~/.mypka/tower/tower.db — outside the
// repo, outside C:\.fusion247\, matching the existing ~/.mypka/governor/health/ precedent. NEVER
// a worktree, a temp dir or a scratchpad for the real watcher: a daemon pinned to disposable
// storage loses its durable state silently, which is the failure mode this store exists to avoid.
// Tests pass an explicit temp path per run.
//
// SCHEMA ALIAS. The real database is ATTACHed as `tower`, so every SQL literal in this subsystem
// keeps writing `tower.turn` / `tower.finding` verbatim. `main` is :memory: and holds nothing.
// One SQLite quirk that bites immediately: in DDL the SCHEMA QUALIFIER GOES ON THE INDEX/TRIGGER
// NAME, not on the table — `create index tower.foo_idx on turn (...)`, never `on tower.turn`.
//
// TYPE FIDELITY IS THE WHOLE RISK. SQLite has no boolean, no timestamptz and no jsonb. The suite
// asserts `row.applied === false` under assert/strict (where 0 !== false) and calls
// Array.isArray() on a jsonb column, so an uncoerced read is a QUIET FALSE GREEN — worse than a
// failure. Coercion is therefore per COLUMN NAME, from the frozen maps below, on the way out; and
// booleans/Dates/undefined are coerced on the way in, because better-sqlite3 refuses to bind them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

/** The ISO-8601 shape every timestamp column is stored in — byte-identical to
 *  `new Date().toISOString()`, so the SQL default and the JS `now()` function agree and the
 *  values sort lexicographically in the same order they sort chronologically. */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/**
 * Columns whose Postgres type is `boolean`. Read back as real booleans.
 * The map is keyed by COLUMN NAME across the whole `tower` schema, which is safe here and is
 * asserted by the enumeration below: no name appears in two tables with two different types.
 *   supervisor_prompt.active · turn.goal_complete · notification.telegram_ok ·
 *   supervisor_review.{aligned,over_engineering,drifting,administering,warwick_needed} ·
 *   pr_comment.applied
 */
const BOOLEAN_COLUMNS = new Set([
  'active', 'goal_complete', 'telegram_ok', 'aligned', 'over_engineering',
  'drifting', 'administering', 'warwick_needed', 'applied',
]);

/** Columns whose Postgres type is `timestamptz`. Stored as ISO-8601 TEXT, rehydrated to `Date`. */
const TIMESTAMP_COLUMNS = new Set([
  'created_at', 'updated_at', 'lease_deadline_at', 'held_at', 'hold_until',
  'disposition_at', 'received_at', 'ingested_at', 'last_beat',
]);

/** Columns whose Postgres type is `jsonb`. Stored as TEXT, parsed on the way out — the callers
 *  already `JSON.stringify` on the way in, exactly as they did for pg. */
const JSON_COLUMNS = new Set(['raw_output', 'prompts_applied', 'merge_review']);

/** Where the durable Tower store lives. */
export function defaultDbPath() {
  const explicit = process.env.TOWER_SQLITE_PATH;
  if (explicit && explicit.trim() !== '') return explicit;
  return path.join(os.homedir(), '.mypka', 'tower', 'tower.db');
}

/** SQLITE_BUSY is a REAL code path in this subsystem (two watchers race for the same turn), not
 *  something to discover in production. `busy_timeout` absorbs the ordinary contention; this
 *  recognises the case where it did not, so a caller can back off instead of crashing. */
export function isBusyError(e) {
  const code = String(e?.code ?? '');
  return code === 'SQLITE_BUSY' || code === 'SQLITE_BUSY_SNAPSHOT' || code === 'SQLITE_LOCKED';
}

function coerceOut(column, value) {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_COLUMNS.has(column)) return value !== 0;
  if (TIMESTAMP_COLUMNS.has(column)) return value instanceof Date ? value : new Date(String(value));
  if (JSON_COLUMNS.has(column)) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function coerceRow(row) {
  const out = {};
  for (const k of Object.keys(row)) out[k] = coerceOut(k, row[k]);
  return out;
}

/** better-sqlite3 binds numbers, strings, bigints, buffers and null — and nothing else. Everything
 *  the pg driver used to accept silently has to be turned into one of those here. */
function coerceIn(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Open the Tower store.
 *
 * @param {string} [dbPath] absolute path to the SQLite file (default: {@link defaultDbPath}).
 * @returns the pg-shaped façade every tower-loop module takes as its `pool` argument.
 */
export function openDb(dbPath = defaultDbPath()) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

  const db = new Database(':memory:');
  // The real store, attached under the alias every SQL literal in this subsystem already uses.
  db.prepare('attach database ? as tower').run(path.resolve(dbPath));
  db.pragma('tower.journal_mode = WAL');       // readers never block the writer across processes
  db.pragma('busy_timeout = 5000');            // absorb ordinary two-watcher write contention
  db.pragma('foreign_keys = ON');              // the schema declares them; enforce them

  // `now()` and interval arithmetic, so the rewritten SQL literals stay readable. Both emit the
  // same ISO-8601 shape as SQL_NOW above.
  db.function('now', () => new Date().toISOString());
  db.function('now_plus_seconds', (secs) => new Date(Date.now() + Number(secs) * 1000).toISOString());

  const cache = new Map();
  const prepare = (sql) => {
    let stmt = cache.get(sql);
    if (!stmt) { stmt = db.prepare(sql); cache.set(sql, stmt); }
    return stmt;
  };

  /** The one primitive. Synchronous, because better-sqlite3 is. */
  const querySync = (sql, params = []) => {
    const stmt = prepare(sql);
    const bound = (params ?? []).map(coerceIn);
    if (stmt.reader) {
      const rows = stmt.all(...bound).map(coerceRow);
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...bound);
    return { rows: [], rowCount: info.changes };
  };

  const facade = {
    path: path.resolve(dbPath),
    raw: db,
    querySync,
    /** The pg-shaped call every module already makes. Async only so `await` keeps working. */
    async query(sql, params = []) { return querySync(sql, params); },
    /**
     * BEGIN IMMEDIATE ... COMMIT. The write lock is taken up front, so a read-then-write claim
     * cannot interleave with another process's claim of the same row. `fn` receives the
     * synchronous query primitive and must stay synchronous — that is what makes the transaction
     * a transaction rather than a hopeful pair of statements.
     */
    async immediate(fn) {
      return db.transaction(() => fn(querySync)).immediate();
    },
    async end() { cache.clear(); db.close(); },
  };
  return facade;
}

/** Recognise a façade, so the schema appliers can refuse a Postgres URL loudly rather than
 *  creating a file named after one. */
export function isTowerDb(x) {
  return !!x && typeof x.query === 'function' && typeof x.querySync === 'function' && typeof x.immediate === 'function';
}
