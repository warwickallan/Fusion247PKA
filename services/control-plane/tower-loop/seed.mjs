// BUILD-014 Tower supervisor loop — seed the active supervisor prompt.
// WO-TW-01: the store is SQLite (better-sqlite3, WAL), not Postgres.
//
// Seeds prompts/supervisor-prompt.md as tower.supervisor_prompt v1, active=true,
// content_hash=sha256(content), approved_by='ai-authored-unapproved'. Idempotent by
// content_hash: if a row with the same hash already exists it is (re)activated rather than
// duplicated. Loading a NEW active prompt deactivates any prior active one (the schema
// enforces a single active).
//
// TRUTHFUL APPROVAL (FIX 1a): this delivery-supervisor prompt is AI-authored and has NOT
// been reviewed/approved by Warwick. We label it honestly as 'ai-authored-unapproved' and
// never auto-claim Warwick approval. (The Tower QA skill run on merge-class turns IS the
// separately-approved, Warwick-ratified governing prompt.) When Warwick reviews and approves
// this prompt, set approved_by='warwick' explicitly — the seed must never do it for him.
//
//   node seed.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openDb } from './db.mjs';
import { applyAll } from './apply.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {ReturnType<import('./db.mjs').openDb>} db an open Tower store handle.
 */
export async function seedPrompt(db) {
  const promptPath = path.join(__dirname, 'prompts', 'supervisor-prompt.md');
  const content = fs.readFileSync(promptPath, 'utf8');
  const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');

  // One write transaction: deactivate-then-activate must never be observable half-done, because
  // the single-active unique index would reject the intermediate state from another writer.
  const row = await db.immediate((q) => {
    const existing = q(
      `select id, version from tower.supervisor_prompt where content_hash = ? limit 1`,
      [contentHash],
    );

    if (existing.rows.length > 0) {
      q(`update tower.supervisor_prompt set active = 0 where active = 1`);
      return q(
        `update tower.supervisor_prompt set active = 1 where id = ?
         returning id, version, content_hash, active, approved_by`,
        [existing.rows[0].id],
      ).rows[0];
    }

    // Next version number = max+1 (v1 on an empty table).
    const maxRes = q(`select coalesce(max(version), 0) as maxv from tower.supervisor_prompt`);
    const nextVersion = Number(maxRes.rows[0].maxv) + 1;
    q(`update tower.supervisor_prompt set active = 0 where active = 1`);
    return q(
      `insert into tower.supervisor_prompt (version, content, content_hash, active, approved_by)
       values (?, ?, ?, 1, 'ai-authored-unapproved')
       returning id, version, content_hash, active, approved_by`,
      [nextVersion, content, contentHash],
    ).rows[0];
  });

  return { promptPath, ...row };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const db = openDb();
    try {
      await applyAll(db);
      return await seedPrompt(db);
    } finally { await db.end(); }
  })()
    .then((r) => { console.log(`[seed] active supervisor prompt v${r.version} (${r.content_hash.slice(0, 12)}…) approved_by=${r.approved_by} id=${r.id}`); process.exit(0); })
    .catch((e) => { console.error(`[seed] FAILED: ${e.message}`); process.exit(1); });
}
