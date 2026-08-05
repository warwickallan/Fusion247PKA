// WP-2F — the child process that exercises the MERGE-CHECK path under the zero-Postgres hooks.
//
// Two modes, and the second exists so the first cannot go green on a broken instrument:
//
//   merge-check    registers the hooks, imports BOTH merge-check entrypoints, and EXECUTES the
//                  real runMergeCheck fail-closed branch against a throwaway SQLite store.
//                  Whatever that path loads is recorded.
//   control-trap   registers the same hooks and deliberately imports the estate's REAL pg driver.
//                  The trap must fire. If it does not, the zero-Postgres result from `merge-check`
//                  mode is meaningless and the suite says so.
//
// NO NETWORK, NO CODEX, NO TELEGRAM. The fail-closed branch runs before any reviewer is reached,
// and sendTowerBot returns immediately with no token/chat supplied.
//
// Not a test file: it has no assertions and prints machine-readable output for the runner to
// assert on. It is spawned, never imported.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

register('./pg-hooks.mjs', import.meta.url, { data: { outPath: process.env.PG_OUT ?? null } });

const mode = process.argv[2] ?? 'merge-check';

if (mode === 'control-trap') {
  // Resolve the REAL driver from this package's own node_modules and import it. If the trap is
  // working, this throws; if the driver is genuinely absent, say so rather than passing.
  let pgEntry = null;
  try { pgEntry = createRequire(import.meta.url).resolve('pg'); } catch { /* absent */ }
  if (!pgEntry || !fs.existsSync(pgEntry)) { console.log('CONTROL_TARGET_MISSING'); process.exit(4); }
  try {
    await import(pathToFileURL(pgEntry).href);
    console.log('TRAP_DID_NOT_FIRE');
    process.exit(3);
  } catch (e) {
    console.log(`TRAP_FIRED: ${String(e?.message ?? e).slice(0, 160)}`);
    process.exit(0);
  }
}

// ── merge-check mode ─────────────────────────────────────────────────────────
// BOTH entrypoints, because the acceptance property is about the merge-check PATH, not one file.
// tower/merge-check.mjs is import-safe by design (main() is behind a direct-invocation guard).
const { openDb } = await import('../../db.mjs');
const { applyMergeCheckSchema } = await import('../../apply.mjs');
const { runMergeCheck } = await import('../../mergeCheck.mjs');
const towerMergeCheck = await import('../../../tower/merge-check.mjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-pg-probe-'));
const pool = openDb(path.join(dir, 'probe.db'));
try {
  await applyMergeCheckSchema(pool);
  // The fail-closed branch: an invalid build_ref is rejected by classifyMergeRun BEFORE any
  // reviewer or notifier is reached. It still writes a run and a message, so the store path is
  // genuinely exercised under the hooks.
  const out = await runMergeCheck({
    pool, repo: 'warwickallan/Fusion247PKA', prNumber: 4242,
    headSha: 'a'.repeat(40), buildRef: 'not-a-build-ref', wpRef: 'WP-2F',
    larryClaim: 'probe', telegramToken: null, telegramChat: null,
  });
  const runs = (await pool.query(`select id, status from tower.merge_check_run where pr_number=?`, [4242])).rows;
  const msgs = (await pool.query(`select seq, sender, status from tower.merge_check_message where run_id=?`, [out.runId])).rows;
  console.log(JSON.stringify({
    blocked: out.blocked, status: out.status, runs: runs.length, msgs: msgs.length,
    towerExports: Object.keys(towerMergeCheck).sort(),
  }));
} finally {
  await pool.end();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
