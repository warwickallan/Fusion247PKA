// WO-TW-02 — the child process that runs the trigger UNDER the module-graph hooks.
//
// Two modes, and the second exists so the first cannot go green on a broken instrument:
//
//   trigger        registers the hooks, then EXECUTES a real poll round (target selection →
//                  gh seam → checkpoint turn → ingest). Whatever the trigger loads is recorded.
//   control-trap   registers the same hooks and deliberately imports the estate's REAL ClickUp
//                  client. The trap must fire. If it does not, the zero-ClickUp result from
//                  `trigger` mode is meaningless and the suite says so.
//
// Not a test file: it has no assertions and prints machine-readable output for the runner to
// assert on. It is spawned, never imported.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

register('./graph-hooks.mjs', import.meta.url, { data: { outPath: process.env.GRAPH_OUT ?? null } });

const mode = process.argv[2] ?? 'trigger';

if (mode === 'control-trap') {
  // …/tower-loop/test/doubles → up 4 → services/ ; the legacy ClickUp watcher lives beside us.
  const clickup = path.resolve(__dirname, '..', '..', '..', '..', 'tower-baton', 'src', 'clickupClient.js');
  if (!fs.existsSync(clickup)) { console.log('CONTROL_TARGET_MISSING'); process.exit(4); }
  try {
    await import(pathToFileURL(clickup).href);
    console.log('TRAP_DID_NOT_FIRE');
    process.exit(3);
  } catch (e) {
    console.log(`TRAP_FIRED: ${String(e?.message ?? e).slice(0, 160)}`);
    process.exit(0);
  }
}

// ── trigger mode ─────────────────────────────────────────────────────────────
const { openDb } = await import('../../db.mjs');
const { applyAll } = await import('../../apply.mjs');
const { pollRound } = await import('../../watcher.mjs');
const { ghCliReader } = await import('./fakeGhModule.mjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-graph-'));
const pool = openDb(path.join(dir, 'graph.db'));
try {
  await applyAll(pool);
  // notify is stubbed: this probe is about the module graph, and a real Telegram POST is neither
  // wanted nor available here.
  const res = await pollRound(pool, { gh: ghCliReader, notify: async () => ({}) });
  console.log(JSON.stringify(res));
} finally {
  await pool.end();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
