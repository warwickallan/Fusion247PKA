// BUILD-014 Tower supervisor loop — seed the active supervisor prompt.
//
// Seeds prompts/supervisor-prompt.md as tower.supervisor_prompt v1, active=true,
// content_hash=sha256(content), approved_by='warwick'. Idempotent by content_hash: if a
// row with the same hash already exists it is (re)activated rather than duplicated. Loading
// a NEW active prompt deactivates any prior active one (the schema enforces a single active).
//
//   node seed.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedPrompt(databaseUrl = process.env.CONTROL_PLANE_DEV_DATABASE_URL) {
  if (!databaseUrl) throw new Error('CONTROL_PLANE_DEV_DATABASE_URL is not set — point it at the throwaway local Postgres (or Supabase DEV).');
  const promptPath = path.join(__dirname, 'prompts', 'supervisor-prompt.md');
  const content = fs.readFileSync(promptPath, 'utf8');
  const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('begin');

    // If this exact content is already stored, just make sure it is the active one.
    const existing = await client.query(
      `select id, version from tower.supervisor_prompt where content_hash = $1 limit 1`,
      [contentHash],
    );

    let row;
    if (existing.rows.length > 0) {
      // Deactivate everything, then activate this one (single-active index safe within tx).
      await client.query(`update tower.supervisor_prompt set active = false where active = true`);
      const upd = await client.query(
        `update tower.supervisor_prompt set active = true where id = $1
         returning id, version, content_hash, active, approved_by`,
        [existing.rows[0].id],
      );
      row = upd.rows[0];
    } else {
      // Next version number = max+1 (v1 on an empty table).
      const maxRes = await client.query(`select coalesce(max(version), 0) as maxv from tower.supervisor_prompt`);
      const nextVersion = Number(maxRes.rows[0].maxv) + 1;
      await client.query(`update tower.supervisor_prompt set active = false where active = true`);
      const ins = await client.query(
        `insert into tower.supervisor_prompt (version, content, content_hash, active, approved_by)
         values ($1, $2, $3, true, 'warwick')
         returning id, version, content_hash, active, approved_by`,
        [nextVersion, content, contentHash],
      );
      row = ins.rows[0];
    }

    await client.query('commit');
    return { promptPath, ...row };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  seedPrompt()
    .then((r) => { console.log(`[seed] active supervisor prompt v${r.version} (${r.content_hash.slice(0, 12)}…) approved_by=${r.approved_by} id=${r.id}`); process.exit(0); })
    .catch((e) => { console.error(`[seed] FAILED: ${e.message}`); process.exit(1); });
}
