// BUILD-014 WP-D increment 2 — ONE-COMMAND provision + start + seed + PROVE.
//
//   node wp-d-proof/run-increment-2.mjs
//
// Stands up the whole disposable proof from scratch and runs every increment-2 proof:
//   1. provision.mjs          — Postgres cluster + ops schema + SYNTHETIC seed (010-040).
//   2. setup-directus.mjs     — bootstrap Directus (system tables + admin) as superuser.
//   3. configure-db-roles.mjs — create cp_directus/cp_worker least-priv roles; repoint
//                               the Directus RUNTIME connection to cp_directus.
//   4. register-collections   — expose the proof tables (incl. command_request) as collections.
//   5. start-directus.mjs     — start the cockpit as LEAST-PRIVILEGE cp_directus (localhost).
//   6. configure-access.mjs   — create the non-priv viewer policy (read + constrained write).
//   7. permission-test.mjs    — full acceptance + adversarial + DB-layer least-priv matrix.
//   8. outage-test.mjs        — seam trace + Directus-outage independence proof.
//
// LOCAL-ONLY / DEV-ONLY / SYNTHETIC. Announce-only: the cockpit URL is printed, never
// auto-opened. Tear everything down with: node wp-d-proof/stop.mjs

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime');

function step(label, file, argv = []) {
  console.log(`\n============================================================\n▶ ${label}\n============================================================`);
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...argv], { encoding: 'utf8', stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\n[run] STEP FAILED: ${label} (exit ${r.status}). Aborting.`); process.exit(r.status || 1); }
}

async function waitDirectusUp(ms = 45000) {
  const rt = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'runtime.json'), 'utf8'));
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(rt.directus.url + '/server/ping'); if (r.ok) return true; } catch { /* not yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  return false;
}

step('1/8  provision Postgres + SYNTHETIC seed (010-040)', 'provision.mjs');
step('2/8  bootstrap Directus (superuser, one-time install)', 'setup-directus.mjs');
step('3/8  create least-privilege DB roles + repoint Directus runtime', 'configure-db-roles.mjs');
step('4/8  register proof collections (incl. command_request)', 'register-collections.mjs');
step('5/8  start Directus cockpit as cp_directus (least-privilege)', 'start-directus.mjs');

console.log('\n[run] waiting for the cockpit to answer /server/ping…');
if (!(await waitDirectusUp())) { console.error('[run] Directus did not become ready in time. Check .runtime/directus.log'); process.exit(1); }
console.log('[run] cockpit is up.');

step('6/8  configure non-privileged viewer (read + constrained write)', 'configure-access.mjs');
step('7/8  permission test (acceptance + adversarial + DB least-priv)', 'permission-test.mjs');
step('8/8  outage-independence + seam trace', 'outage-test.mjs');

console.log('\n============================================================');
console.log('✓ WP-D increment 2 — all steps + proofs completed.');
console.log('  Cockpit (announce-only, localhost): open the URL printed above yourself.');
console.log('  Tear down with: node wp-d-proof/stop.mjs');
console.log('============================================================');
