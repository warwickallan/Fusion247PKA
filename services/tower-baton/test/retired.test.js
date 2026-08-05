// WO-2026-08-05-03 — the RETIREMENT GUARD is proven BY ATTEMPT.
//
// Warwick's decision (BUILD-020 proofline map §14.13 D-A) was REFUSE, not delete: legacy
// tower-baton must be unable to start while services/tower-baton/src/clickupClient.js — the
// target of the tower-loop `control-trap` negative control — stays present. Deletion would
// have proven itself by absence; a refusal has to be proven by running the thing.
//
// These tests exist because two weaker proofs were available and both are false comfort:
//   - "the guard is in the file" is a grep, not a behaviour;
//   - "it exited non-zero" is not the guard: this entrypoint has ALWAYS exited non-zero when
//     config was missing (1) or a watcher already held the lock (3). So the assertions below
//     pin the DISTINCT exit code 78 AND the exact output, which no other path in this file
//     can produce.
//
// The third test is the one that keeps the guard honest over time. The guard sits after the
// import block (ESM hoists static imports, so it cannot be written above them) and is
// nevertheless first-to-act only because every module under src/** is declaration-only. That
// invariant is not enforced by a comment — it is enforced here: assert the process emits the
// retirement notice and NOTHING ELSE, run with the secret store pointed at a path that does
// not exist. Pre-retirement that configuration printed "[TOWER] startup fail-closed: ..." and
// exited 1. If anything in src/** ever gains an import-time side effect that reads, writes or
// logs, this test goes red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = path.resolve(__dirname, '..');
const ENTRYPOINT = path.join(SERVICE_DIR, 'bin', 'tower-watch.js');
const LAUNCHER = path.join(SERVICE_DIR, 'scripts', 'start-fusion-tower.ps1');
const CLICKUP_CLIENT = path.join(SERVICE_DIR, 'src', 'clickupClient.js');

const RETIRED_EXIT_CODE = 78;

/** A secret-store path that is guaranteed not to exist, so nothing real can be read. */
function absentHome() {
  return path.join(os.tmpdir(), `tower-baton-absent-home-${process.pid}-${Date.now()}`);
}

function runEntrypoint(env = {}) {
  return spawnSync(process.execPath, [ENTRYPOINT], {
    encoding: 'utf8',
    env: { ...process.env, FUSION247_HOME: absentHome(), ...env },
  });
}

test('the retired entrypoint refuses to start, with the distinct retirement exit code', () => {
  const r = runEntrypoint();
  assert.equal(r.status, RETIRED_EXIT_CODE, `expected exit ${RETIRED_EXIT_CODE}, got ${r.status}; stderr: ${r.stderr}`);
  assert.notEqual(r.status, 0, 'a refusal is never a success exit');
});

test('the refusal NAMES what is retired and what to use instead — a human can act on it', () => {
  const out = runEntrypoint().stderr;
  assert.match(out, /TOWER-BATON RETIRED/, 'the notice identifies itself');
  assert.match(out, /will NOT start/, 'it says plainly that nothing started');
  assert.match(out, /run-watcher\.mjs/, 'it names the replacement runtime');
  assert.match(out, /2026-08-05/, 'it dates the retirement');
});

test('the guard acts BEFORE anything is loaded, read or logged — exact output, nothing else', () => {
  const home = absentHome();
  const r = spawnSync(process.execPath, [ENTRYPOINT], {
    encoding: 'utf8',
    env: { ...process.env, FUSION247_HOME: home },
  });

  assert.equal(r.stdout, '', 'the retired entrypoint writes nothing to stdout');

  const lines = r.stderr.split('\n').filter(Boolean);
  assert.equal(lines.length, 5, `expected exactly the 5 notice lines, got:\n${r.stderr}`);
  for (const line of lines) {
    assert.ok(line.startsWith('[TOWER-BATON RETIRED]'), `unexpected output line: ${line}`);
  }
  // The pre-retirement failure mode for this exact invocation.
  assert.doesNotMatch(r.stderr, /startup fail-closed/, 'config loading must not have been reached');

  // And no side effect landed on disk: the logger created <home>/logs/tower-baton before the
  // guard existed. Its absence is the observable form of "no store was touched".
  assert.equal(fs.existsSync(home), false, 'nothing was created under the secret store path');
});

test('the negative control target survives the retirement — src/clickupClient.js is still present', () => {
  // services/control-plane/tower-loop/test/doubles/graph-probe.mjs resolves this exact path and
  // exits 4 with CONTROL_TARGET_MISSING if it is gone. Deleting it would have removed a control
  // whose entire job is to fail, which is why this retirement is a refusal and not a deletion.
  assert.ok(fs.existsSync(CLICKUP_CLIENT), 'services/tower-baton/src/clickupClient.js must remain');
});

test('the documented launcher carries its own guard — the .ps1 route is closed too', () => {
  // Read rather than executed: this suite must run on non-Windows CI, and the .ps1 refusal is
  // proven by attempt in the Work Order evidence. What is pinned here is that the guard exists,
  // exits with the same distinct code, and sits ahead of the launcher body.
  const body = fs.readFileSync(LAUNCHER, 'utf8');
  const guardAt = body.indexOf('TOWER-BATON RETIRED');
  const preflightAt = body.indexOf('running masked pre-flight');
  assert.ok(guardAt > -1, 'the launcher carries the retirement notice');
  assert.match(body, new RegExp(`exit \\$RetiredExitCode`), 'the launcher exits on the guard');
  assert.match(body, new RegExp(`RetiredExitCode = ${RETIRED_EXIT_CODE}\\b`), 'with the same distinct code');
  assert.ok(preflightAt > guardAt, 'and the guard precedes the launcher body it retires');
});

test('the launcher is pure ASCII — otherwise the guard is unreachable on the documented host', () => {
  // Not cosmetic. As committed before 2026-08-05 this file carried UTF-8 em-dashes with no BOM.
  // Windows PowerShell 5.1 — the host `powershell -ExecutionPolicy Bypass -File ...` actually
  // launches, and the one Builds/BUILD-010-fusion-tower/Runtime/recovery.md:58 documents —
  // decodes it as ANSI/OEM and dies with "The string is missing the terminator" at PARSE time,
  // before any statement runs. So a single non-ASCII byte turns the retirement notice above
  // into unreachable code and the refusal into a crash. pwsh 7 reads UTF-8 and never saw it,
  // which is exactly how the defect survived. This assertion is the mechanical pin.
  const bytes = fs.readFileSync(LAUNCHER);
  const offending = [];
  for (let i = 0; i < bytes.length && offending.length < 5; i += 1) {
    if (bytes[i] > 0x7f) offending.push(`byte ${i} = 0x${bytes[i].toString(16)}`);
  }
  assert.deepEqual(offending, [], `non-ASCII bytes in ${path.basename(LAUNCHER)}: ${offending.join(', ')}`);
});
