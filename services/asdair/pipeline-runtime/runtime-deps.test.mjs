// =====================================================================
// BUILD-015 AsdAIr Stage 1 - runtime-deps.test.mjs
//
// The two 2026-08-03 health defects, proven offline:
//
//   item 1  dependency-aware health - `/asdair/health` said ok:true while the
//           live path could not load `pg`. Health that ignores dependencies is
//           a green light wired to nothing.
//   item 2  stalled-run detection - `--status` said running:true while the
//           runtime's own log had not moved for an HOUR.
//
// EVERY behaviour here is proven by a test that FAILS WITHOUT THE FIX, and the
// stall detector and the dependency probe are each MADE TO FIRE, with the
// negative control beside them. A detector that has never been observed to fire
// is not evidence that it would.
//
// Nothing here starts a runtime, opens a socket, reaches a database, or reads
// or writes anything under C:\.fusion247\** . The clock, the resolver, the lock
// holder and every path are injected.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PG_CONSUMERS,
  RUNTIME_WATCH_INTERVAL_SECONDS, INTAKE_MAX_POLL_TIMEOUT_SECONDS,
  SELFTEST_DEFAULT_INTERVAL_MS, STALL_INTERVAL_MULTIPLE, STALL_FLOOR_SECONDS,
  STALL_ENV_VAR, SELFTEST_INTERVAL_ENV_VAR,
  expectedWriteIntervalSeconds, stallThresholdSeconds, assessLiveness, probePgConsumers,
} from './runtime-deps.mjs';
import { collect } from './asdair-status.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASDAIR = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(ASDAIR, rel), 'utf8');

// =====================================================================
// 1. THE TICK CONSTANTS ARE PINNED TO THEIR SOURCE
//
// runtime-deps.mjs COPIES three cadence literals out of files this Work Order
// may not touch. A copy with no drift test is a lie waiting to happen: retune
// the watch loop and the stall threshold silently keeps deriving from the old
// number. These tests read the real source files and fail on drift, which is
// what makes "derived, not invented" true tomorrow as well as today.
// =====================================================================

test('the watch interval is pinned to pipeline/runtime.js, not chosen here', () => {
  const src = read('pipeline/runtime.js');
  const m = src.match(/DEFAULT_INTERVAL_SECONDS\s*=\s*(\d+)/);
  assert.ok(m, 'DEFAULT_INTERVAL_SECONDS not found in pipeline/runtime.js - the source of truth moved');
  assert.equal(Number(m[1]), RUNTIME_WATCH_INTERVAL_SECONDS,
    `the watch loop now ticks every ${m[1]}s but runtime-deps.mjs still derives the stall threshold from ${RUNTIME_WATCH_INTERVAL_SECONDS}s`);
});

test('the long-poll slack is pinned to intake/shopperIntake.js, not chosen here', () => {
  const src = read('intake/shopperIntake.js');
  const m = src.match(/MAX_POLL_TIMEOUT_SECONDS\s*=\s*(\d+)/);
  assert.ok(m, 'MAX_POLL_TIMEOUT_SECONDS not found in intake/shopperIntake.js - the source of truth moved');
  assert.equal(Number(m[1]), INTAKE_MAX_POLL_TIMEOUT_SECONDS);
});

test('the selftest tick is pinned to selftest-entry.mjs, not chosen here', () => {
  const src = fs.readFileSync(path.join(HERE, 'selftest-entry.mjs'), 'utf8');
  const m = src.match(/ASDAIR_SELFTEST_INTERVAL_MS\s*\|\|\s*(\d+)/);
  assert.ok(m, 'the selftest interval default moved');
  assert.equal(Number(m[1]), SELFTEST_DEFAULT_INTERVAL_MS);
});

test('PG_CONSUMERS is one list - the launcher re-exports it rather than holding a second copy', async () => {
  const launcher = await import('./ensure-asdair-runtime.mjs');
  assert.equal(launcher.PG_CONSUMERS, PG_CONSUMERS,
    'the launcher must re-export the SAME frozen array, not an equal-looking copy');
});

test('every file named in PG_CONSUMERS still exists (the probe cannot check a fiction)', () => {
  for (const rel of PG_CONSUMERS) {
    assert.ok(fs.existsSync(path.join(ASDAIR, rel)), `PG_CONSUMERS names a file that does not exist: ${rel}`);
  }
});

// =====================================================================
// 2. THE THRESHOLD IS DERIVED, AND THE DERIVATION IS THE ASSERTION
// =====================================================================

test('the live threshold is 3 x the real watch interval plus the real long-poll slack', () => {
  const t = stallThresholdSeconds({ mode: 'live', env: {} });
  const expected = (STALL_INTERVAL_MULTIPLE * RUNTIME_WATCH_INTERVAL_SECONDS) + INTAKE_MAX_POLL_TIMEOUT_SECONDS;
  assert.equal(t.seconds, expected);
  assert.equal(t.derived, true);
  // Pinned to the literal so a silent retune of the multiple is caught here too.
  assert.equal(expected, 205, 'the derivation changed; confirm that is intended');
  assert.ok(t.basis.includes('watch interval'), 'the basis must say where the number came from');
});

test('the floor stops a fast selftest tick producing a hair-trigger threshold', () => {
  const t = stallThresholdSeconds({ mode: 'selftest', env: {} });
  const naive = STALL_INTERVAL_MULTIPLE * (SELFTEST_DEFAULT_INTERVAL_MS / 1000);
  assert.equal(naive, 6, 'the naive derivation for selftest');
  assert.equal(t.seconds, STALL_FLOOR_SECONDS, 'the floor must win over a 6-second threshold');
});

test('the threshold tracks a RETUNED selftest tick rather than a hardcoded one', () => {
  const t = expectedWriteIntervalSeconds({ mode: 'selftest', env: { [SELFTEST_INTERVAL_ENV_VAR]: '90000' } });
  assert.equal(t.seconds, 90, 'a 90s selftest tick must produce a 90s expectation');
  assert.equal(stallThresholdSeconds({ mode: 'selftest', env: { [SELFTEST_INTERVAL_ENV_VAR]: '90000' } }).seconds, 270);
});

test('an operator override wins outright, and a malformed one is ignored rather than obeyed', () => {
  assert.equal(stallThresholdSeconds({ env: { [STALL_ENV_VAR]: '900' } }).seconds, 900);
  assert.equal(stallThresholdSeconds({ env: { [STALL_ENV_VAR]: '900' } }).derived, false);
  for (const bad of ['0', '-5', 'soon', '', 'NaN']) {
    assert.equal(stallThresholdSeconds({ env: { [STALL_ENV_VAR]: bad } }).seconds, 205,
      `a malformed override (${JSON.stringify(bad)}) must fall back to the derivation, not disable the detector`);
  }
});

// =====================================================================
// 3. THE STALL DETECTOR, MADE TO FIRE
//
// This is the 2026-08-03 incident reproduced exactly: alive, holding the lock,
// and silent for an hour. Before this detector existed the surface reported
// running: true and healthy, which is what these assertions now forbid.
// =====================================================================

const T0 = Date.parse('2026-08-04T12:00:00.000Z');
const ago = (seconds) => new Date(T0 - (seconds * 1000)).toISOString();

test('THE INCIDENT: alive and silent for an hour is STALLED', () => {
  const l = assessLiveness({ running: true, lastWriteAt: ago(3600), nowMs: T0, mode: 'live' });
  assert.equal(l.stalled, true);
  assert.equal(l.silent_for_seconds, 3600);
  assert.ok(l.reason.includes('3600s'), 'the reason must carry the measured silence, not just a verdict');
});

test('a runtime writing on time is NOT stalled (the detector discriminates)', () => {
  const l = assessLiveness({ running: true, lastWriteAt: ago(30), nowMs: T0, mode: 'live' });
  assert.equal(l.stalled, false);
});

test('the boundary is exact: at the threshold is alive, one second past it is stalled', () => {
  const at = assessLiveness({ running: true, lastWriteAt: ago(205), nowMs: T0, mode: 'live' });
  const past = assessLiveness({ running: true, lastWriteAt: ago(206), nowMs: T0, mode: 'live' });
  assert.equal(at.stalled, false, 'exactly at the threshold is not yet late');
  assert.equal(past.stalled, true, 'one second past it is');
});

test('a missed pass or two is tolerated - only the third makes it a pattern', () => {
  // One and two missed 60s passes stay inside 205s; three (180s) plus the
  // 25s poll slack sits exactly at it. The tolerance is the design, asserted.
  assert.equal(assessLiveness({ running: true, lastWriteAt: ago(60), nowMs: T0 }).stalled, false);
  assert.equal(assessLiveness({ running: true, lastWriteAt: ago(120), nowMs: T0 }).stalled, false);
  assert.equal(assessLiveness({ running: true, lastWriteAt: ago(300), nowMs: T0 }).stalled, true);
});

test('staleness is UNKNOWN rather than false when it cannot honestly be judged', () => {
  assert.equal(assessLiveness({ running: false, lastWriteAt: ago(9999), nowMs: T0 }).stalled, null,
    'a runtime that is not running is a different problem and must not be reported as stalled');
  assert.equal(assessLiveness({ running: true, lastWriteAt: null, nowMs: T0 }).stalled, null,
    'a runtime that has not written its first pass is not yet stalled');
  assert.equal(assessLiveness({ running: true, lastWriteAt: 'not a date', nowMs: T0 }).stalled, null);

  const future = assessLiveness({ running: true, lastWriteAt: new Date(T0 + 60000).toISOString(), nowMs: T0 });
  assert.equal(future.stalled, null, 'a future last-write means the clock moved; any verdict would be fiction');
  assert.ok(future.reason.includes('FUTURE'));
});

test('the threshold used is the one for the mode ACTUALLY running, not the default', () => {
  // 100s of silence: stalled under selftest (floor 120? no - inside it), and
  // the point is that the two modes genuinely differ.
  const live = assessLiveness({ running: true, lastWriteAt: ago(150), nowMs: T0, mode: 'live' });
  const self = assessLiveness({ running: true, lastWriteAt: ago(150), nowMs: T0, mode: 'selftest' });
  assert.equal(live.stalled, false, '150s is inside the live 205s threshold');
  assert.equal(self.stalled, true, '150s is past the selftest 120s floor');
});

// =====================================================================
// 4. THE DEPENDENCY PROBE, MADE TO FIRE
// =====================================================================

test('THE INCIDENT: an unresolvable dependency is reported per CALLING FOLDER', () => {
  const broken = new Set(['shop/shopStore.js', 'pipeline/deps.js', 'browser-runner/store.cjs']);
  const p = probePgConsumers({
    resolveFrom: (rel) => { if (broken.has(rel)) { const e = new Error('x'); e.code = 'MODULE_NOT_FOUND'; throw e; } },
  });
  assert.equal(p.ok, false);
  assert.equal(p.checked, PG_CONSUMERS.length);
  assert.equal(p.unresolvable.length, 3, 'D-2026-08-03-01 hit three folders at once');
  assert.deepEqual(p.unresolvable.map((u) => u.caller).sort(), [...broken].sort());
});

test('the probe passes only when EVERY caller resolves (one folder is not the answer)', () => {
  assert.equal(probePgConsumers({ resolveFrom: () => {} }).ok, true);
  const oneBroken = probePgConsumers({
    resolveFrom: (rel) => { if (rel === 'skill/data.js') throw new Error('nope'); },
  });
  assert.equal(oneBroken.ok, false, 'six of seven resolving is not healthy');
});

test('the probe refuses to answer at all without a resolver, rather than answering "fine"', () => {
  const p = probePgConsumers({});
  assert.equal(p.available, false);
  assert.notEqual(p.ok, true, 'an unaskable question must never come back as a pass');
});

// =====================================================================
// 5. END TO END: BOTH FAULTS TURN THE HEALTH DOCUMENT RED
//
// The unit tests above prove the detectors. These prove they are WIRED - that
// `healthy` actually goes false, which is the thing that was broken.
// =====================================================================

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asdair-wo-za-'));
  fs.writeFileSync(path.join(dir, 'runtime.armed'), JSON.stringify({ armed_at: '2026-08-04T00:00:00.000Z', armed_by: 'test' }));
  fs.writeFileSync(path.join(dir, 'runtime.log'), `${JSON.stringify({ event: 'pass', pass: 1 })}\n`);
  fs.writeFileSync(path.join(dir, 'intake.json'), JSON.stringify({ last_update_id: 1, updated_at: '2026-08-04T00:00:00.000Z' }));
  return dir;
}

const HELD = { state: 'held', record: { mode: 'live', started_at: '2026-08-04T00:00:00.000Z' }, reason: 'test holder', process: null };
const OK_DEPS = { ok: true, pg: { available: true, checked: 7, ok: true, unresolvable: [] } };

async function statusFor({ dir, silentForSeconds, dependencies = OK_DEPS }) {
  const logPath = path.join(dir, 'runtime.log');
  const writtenAt = T0 - (silentForSeconds * 1000);
  fs.utimesSync(logPath, new Date(writtenAt), new Date(writtenAt));
  return collect({
    stateDir: dir, logPath, stateFile: path.join(dir, 'intake.json'),
    db: false, nowMs: T0, env: {}, holder: HELD, dependencies,
  });
}

test('WIRED: a runtime silent for an hour reports healthy:false and names the recovery command', async () => {
  const dir = scratch();
  const s = await statusFor({ dir, silentForSeconds: 3600 });
  assert.equal(s.runtime.running, true, 'the process really is alive - that is the whole trap');
  assert.equal(s.runtime.stalled, true);
  assert.equal(s.healthy, false, 'THE 2026-08-03 DEFECT: this used to be true while nothing was happening');
  const stall = s.problems.find((p) => p.includes('STALLED'));
  assert.ok(stall, `no STALLED problem was raised; got ${JSON.stringify(s.problems)}`);
  assert.ok(stall.includes('--restart'), 'the status document must carry its own remedy');
});

test('WIRED, negative control: the same runtime writing on time is healthy', async () => {
  const dir = scratch();
  const s = await statusFor({ dir, silentForSeconds: 20 });
  assert.equal(s.runtime.stalled, false);
  assert.equal(s.healthy, true, `expected healthy; problems were ${JSON.stringify(s.problems)}`);
});

test('WIRED: an unloadable dependency turns health red even though the process is alive', async () => {
  const dir = scratch();
  const s = await statusFor({
    dir,
    silentForSeconds: 20,
    dependencies: { ok: false, pg: { available: true, checked: 7, ok: false, unresolvable: [{ caller: 'shop/shopStore.js', error: 'MODULE_NOT_FOUND' }] } },
  });
  assert.equal(s.runtime.running, true);
  assert.equal(s.runtime.stalled, false, 'it is ticking fine - the fault is a dependency, not liveness');
  assert.equal(s.healthy, false, 'THE 2026-08-03 DEFECT: ok:true while the live path could not load pg');
  assert.ok(s.problems.some((p) => p.includes('UNRESOLVABLE') && p.includes('shop/shopStore.js')),
    'the problem must name the calling folder, because node resolves from the caller');
});

test('WIRED: the health document reports liveness and dependencies as first-class fields', async () => {
  const dir = scratch();
  const s = await statusFor({ dir, silentForSeconds: 20 });
  assert.equal(typeof s.dependencies, 'object');
  assert.equal(typeof s.runtime.liveness.threshold_seconds, 'number');
  assert.ok(s.runtime.liveness.threshold_basis.length > 0, 'the threshold must show its derivation to whoever reads the document');
  assert.equal(s.runtime.liveness.source, 'the runtime log last-write time, compared against the wall clock');
});

test('the real dependency probe resolves against the real tree (it is not a stub in production)', async () => {
  const { readDependencies } = await import('./asdair-status.mjs');
  const d = readDependencies();
  assert.equal(d.pg.available, true, 'the default resolver must actually run');
  assert.equal(d.pg.checked, PG_CONSUMERS.length);
});
