// BUILD-014 Tower supervisor loop — apply the db/*.sql schema files (idempotent).
// WO-TW-01: the store is SQLite (better-sqlite3, WAL), not Postgres.
//
// Each function takes an OPEN store handle from db.mjs and applies one schema file to it. The
// files are `create ... if not exists` throughout, so re-running is safe — watcher.mjs re-applies
// all five on every boot.
//
//   node apply.mjs            (applies all five to TOWER_SQLITE_PATH / ~/.mypka/tower/tower.db)
//
// THE SIGNATURE CHANGED AND IT FAILS LOUDLY. These functions used to take a `postgres://` URL.
// They now take a handle, and a string argument is REFUSED with a message that says so rather
// than being silently treated as a file path — a Postgres URL landing here would otherwise create
// a file named after a connection string and then quietly not be the database anyone meant.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, isTowerDb } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireDb(db, fn) {
  if (isTowerDb(db)) return db;
  throw new Error(
    `${fn}: expected an open Tower store handle from db.mjs (openDb()). `
    + 'This path no longer accepts a CONTROL_PLANE_DEV_DATABASE_URL — the tower-loop store is SQLite.');
}

async function applyFile(db, fn, fileName) {
  requireDb(db, fn);
  const sqlPath = path.join(__dirname, 'db', fileName);
  db.raw.exec(fs.readFileSync(sqlPath, 'utf8'));
  return { applied: true, sqlPath };
}

export async function applySchema(db) {
  return applyFile(db, 'applySchema', 'loop_schema.sql');
}

/** Apply the watcher schema delta (db/watcher_schema.sql). Idempotent; safe alongside the base
 *  schema. The watcher needs the dedup index, heartbeat + finding tables, and the two uniqueness
 *  backstops. */
export async function applyWatcherSchema(db) {
  return applyFile(db, 'applyWatcherSchema', 'watcher_schema.sql');
}

/** Apply the PR-comment seam schema delta (db/comment_schema.sql). Idempotent; adds
 *  tower.pr_comment and the undisposed-finding index so a PR comment can become machine-readable
 *  input to the next review round (WO-OR-22). */
export async function applyCommentSchema(db) {
  return applyFile(db, 'applyCommentSchema', 'comment_schema.sql');
}

/** Apply the durable-hold schema delta (db/hold_schema.sql). Idempotent; the held_* columns live
 *  on tower.turn so a turn can be explicitly held OUT of the claim/reclaim path (no lease-expiry
 *  release). */
export async function applyHoldSchema(db) {
  return applyFile(db, 'applyHoldSchema', 'hold_schema.sql');
}

/** Apply the PR verdict write-back delta (db/post_schema.sql). Idempotent; adds
 *  tower.pr_verdict_post and its UNIQUE post_key, which is what makes posting a verdict to a PR
 *  idempotent across process death rather than only within one run (WO-TW-02). */
export async function applyPostSchema(db) {
  return applyFile(db, 'applyPostSchema', 'post_schema.sql');
}

/** Apply all five, in dependency order. The order matters: tower.finding (watcher) declares a
 *  foreign key onto tower.pr_comment (comment), the hold index needs tower.turn (base), and
 *  tower.pr_verdict_post references tower.supervisor_review (base). */
export async function applyAll(db) {
  const base = await applySchema(db);
  const watcher = await applyWatcherSchema(db);
  const hold = await applyHoldSchema(db);
  const comment = await applyCommentSchema(db);
  const post = await applyPostSchema(db);
  return { base, watcher, hold, comment, post };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const db = openDb();
    try {
      const r = await applyAll(db);
      console.log(`[apply] store: ${db.path}`);
      console.log(`[apply] base schema applied (idempotent) from ${r.base.sqlPath}`);
      console.log(`[apply] watcher delta applied (idempotent) from ${r.watcher.sqlPath}`);
      console.log(`[apply] hold delta applied (idempotent) from ${r.hold.sqlPath}`);
      console.log(`[apply] comment seam delta applied (idempotent) from ${r.comment.sqlPath}`);
      console.log(`[apply] verdict write-back delta applied (idempotent) from ${r.post.sqlPath}`);
    } finally { await db.end(); }
  })()
    .then(() => process.exit(0))
    .catch((e) => { console.error(`[apply] FAILED: ${e.message}`); process.exit(1); });
}
