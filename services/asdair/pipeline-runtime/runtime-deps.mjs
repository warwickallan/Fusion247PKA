// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline-runtime/runtime-deps.mjs
//
// WHAT THE RUNTIME DEPENDS ON, AND HOW FAST IT IS SUPPOSED TO TICK - in ONE
// place, so the launcher's preflight, the status surface and the proofs cannot
// disagree about either.
//
// This module exists because of two measured defects on 2026-08-03:
//
//   D-2026-08-03-01  `/asdair/health` answered `ok: true` while `/asdair/workspace`
//                    was returning 500 on an unresolvable `pg`. Health that
//                    reports on the PROCESS and not on its DEPENDENCIES is a
//                    green light wired to nothing.
//   (twice, same day) `--status` reported `running: true` while the runtime's
//                    own log had not been written for an HOUR, and a real retry
//                    sat unprocessed for ~60 minutes. The process table said
//                    alive; the work said otherwise. Liveness has to be measured
//                    against the CLOCK, not against the process table.
//
// It is deliberately dependency-free and side-effect-free: every function here
// is pure or takes its filesystem/clock as an argument, so both behaviours can
// be proven offline with no live runtime, no database and no network.
//
// ── WHY THE TICK CONSTANTS ARE COPIED RATHER THAN IMPORTED ──────────────────
// The cadence literals below live in pipeline/ and intake/, which this Work
// Order may not touch and which pull in `pg` transitively - importing them here
// would make a read-only status call depend on the driver being installed,
// which is the very failure this module exists to detect.
//
// So they are copied, WITH their source of truth named, and runtime-deps.test.mjs
// READS THOSE SOURCE FILES and fails if the literals have drifted apart. A
// copied constant with no drift test is a lie waiting to happen; a copied
// constant pinned to its source by an executing test is a cache.
// =====================================================================

/**
 * Every folder whose code calls require('pg') on the LIVE shopping path, and a
 * real file in it to resolve from. Node resolves from the CALLER, so `pg` being
 * installed for pipeline-runtime says nothing about any of these.
 *
 * D-2026-08-03-01: this exact class hit THREE separate folders in one live run.
 *
 * Moved here from ensure-asdair-runtime.mjs on 2026-08-04 (WO-ZA) so that the
 * status surface can probe the same list the launcher's preflight gates on,
 * without importing the launcher - which imports the status surface, and would
 * be a cycle. ensure-asdair-runtime.mjs re-exports it, so its own importers and
 * its test suite are unaffected.
 */
export const PG_CONSUMERS = Object.freeze([
  'shop/shopStore.js',
  'pipeline/deps.js',
  'interpret/interpret-list.js',
  'skill/data.js',
  'outcome/recordShopOutcome.js',
  'reconcile/recordConfirmation.js',
  'browser-runner/store.cjs',
]);

// ---------------------------------------------------------------------
// The tick contract - measured from the real code, not chosen
// ---------------------------------------------------------------------

/** The watch loop's pass interval. SOURCE OF TRUTH: `DEFAULT_INTERVAL_SECONDS`
 *  in services/asdair/pipeline/runtime.js. Every pass emits a `pass` JSONL line,
 *  so this is how often a healthy live runtime writes to its log. */
export const RUNTIME_WATCH_INTERVAL_SECONDS = 60;

/** The largest long-poll window the intake will hold open inside one pass.
 *  SOURCE OF TRUTH: `MAX_POLL_TIMEOUT_SECONDS` in
 *  services/asdair/intake/shopperIntake.js. A healthy pass may legitimately be
 *  silent for this long ON TOP OF the interval, so it is slack, not lateness. */
export const INTAKE_MAX_POLL_TIMEOUT_SECONDS = 25;

/** The stand-in runtime's tick. SOURCE OF TRUTH: `ASDAIR_SELFTEST_INTERVAL_MS`
 *  default in pipeline-runtime/selftest-entry.mjs. Selftest opens no socket, so
 *  it carries no long-poll slack. */
export const SELFTEST_DEFAULT_INTERVAL_MS = 2000;

/**
 * How many expected writes may be missed before the runtime is called stalled.
 *
 * THREE, and the reasoning is the whole point of not picking a round number:
 * one missed pass is ordinary noise (a slow query, a GC pause, a laptop lid);
 * two is bad luck; three consecutive misses is a pattern, and every pass is
 * independent and re-derives its state, so three in a row is not something a
 * healthy loop does. It is also cheap to be wrong in this direction - a stall
 * report is a line in `problems`, not an intervention.
 */
export const STALL_INTERVAL_MULTIPLE = 3;

/**
 * The floor, in seconds.
 *
 * Without it the selftest's 2-second tick would give a ~6-second stall
 * threshold, and any pause at all - a debugger, a slow disk, a busy CI box -
 * would report a stall. A detector that cries wolf gets ignored, which is how a
 * gate dies. Two minutes is far below the SIXTY MINUTES actually observed on
 * 2026-08-03, so the floor never blunts the real case it was built for.
 */
export const STALL_FLOOR_SECONDS = 120;

/** The operator override. Mack owns the value; this module owns the name and
 *  the validation, per the Keel/Mack configuration split. */
export const STALL_ENV_VAR = 'ASDAIR_STALL_AFTER_SECONDS';

/** The selftest tick override, read so the threshold tracks a retuned selftest. */
export const SELFTEST_INTERVAL_ENV_VAR = 'ASDAIR_SELFTEST_INTERVAL_MS';

/**
 * PURE. How often this runtime, in this mode, is expected to write to its log.
 *
 * `mode` comes from the lock record the launcher wrote, so the threshold tracks
 * what is ACTUALLY running rather than what the default happens to be.
 */
export function expectedWriteIntervalSeconds({ mode = 'live', env = {} } = {}) {
  if (mode === 'selftest') {
    const raw = Number(env[SELFTEST_INTERVAL_ENV_VAR]);
    const ms = Number.isFinite(raw) && raw > 0 ? raw : SELFTEST_DEFAULT_INTERVAL_MS;
    return { seconds: ms / 1000, slack_seconds: 0, basis: `selftest tick (${SELFTEST_INTERVAL_ENV_VAR} or ${SELFTEST_DEFAULT_INTERVAL_MS}ms), no long-poll` };
  }
  return {
    seconds: RUNTIME_WATCH_INTERVAL_SECONDS,
    slack_seconds: INTAKE_MAX_POLL_TIMEOUT_SECONDS,
    basis: `watch interval ${RUNTIME_WATCH_INTERVAL_SECONDS}s + max long-poll ${INTAKE_MAX_POLL_TIMEOUT_SECONDS}s`,
  };
}

/**
 * PURE. The silence, in seconds, after which a running runtime is stalled.
 *
 * DERIVED, not chosen:  max(floor, multiple x expected_interval + poll slack).
 * An explicit override wins outright, because Mack may know something about a
 * particular box that this derivation cannot.
 */
export function stallThresholdSeconds({ mode = 'live', env = {} } = {}) {
  const override = Number(env[STALL_ENV_VAR]);
  if (Number.isFinite(override) && override > 0) {
    return { seconds: override, derived: false, basis: `${STALL_ENV_VAR}=${override} (operator override)` };
  }
  const expected = expectedWriteIntervalSeconds({ mode, env });
  const derived = (STALL_INTERVAL_MULTIPLE * expected.seconds) + expected.slack_seconds;
  const seconds = Math.max(STALL_FLOOR_SECONDS, derived);
  return {
    seconds,
    derived: true,
    basis: `max(floor ${STALL_FLOOR_SECONDS}s, ${STALL_INTERVAL_MULTIPLE} x ${expected.basis}) = ${seconds}s`,
  };
}

/**
 * PURE. Is a runtime that the process table calls alive actually DOING anything?
 *
 * The clock is injected, so the detector can be made to fire in a test without
 * waiting out a real threshold. That matters: a stall detector that has never
 * been made to fire is not evidence that it would.
 *
 * Three outcomes, and `unknown` is a real one rather than a polite `false`:
 *   stalled: false    - it wrote recently enough
 *   stalled: true     - it is alive and silent past the threshold
 *   stalled: null     - it cannot be judged (not running, no log yet, or the
 *                       last write is in the FUTURE, which means the clock moved
 *                       and any answer would be fiction)
 */
export function assessLiveness({ running, lastWriteAt = null, nowMs = Date.now(), mode = 'live', env = {} } = {}) {
  const threshold = stallThresholdSeconds({ mode, env });
  const base = {
    stalled: null,
    threshold_seconds: threshold.seconds,
    threshold_basis: threshold.basis,
    silent_for_seconds: null,
    last_write_at: lastWriteAt,
    source: 'the runtime log last-write time, compared against the wall clock',
  };

  if (!running) {
    return { ...base, reason: 'no runtime is holding the lock - liveness of work is not the question here, whether it is running is' };
  }
  if (!lastWriteAt) {
    return { ...base, reason: 'the runtime log does not exist yet - a runtime that has just started has not written a pass' };
  }
  const parsed = Date.parse(lastWriteAt);
  if (!Number.isFinite(parsed)) {
    return { ...base, reason: `the last-write time could not be parsed: ${String(lastWriteAt)}` };
  }

  const silentFor = (nowMs - parsed) / 1000;
  if (silentFor < 0) {
    return {
      ...base,
      silent_for_seconds: Math.round(silentFor),
      reason: 'the runtime log was last written in the FUTURE - the clock moved, so staleness cannot be judged',
    };
  }

  const stalled = silentFor > threshold.seconds;
  return {
    ...base,
    stalled,
    silent_for_seconds: Math.round(silentFor),
    reason: stalled
      ? `the process is alive but has written nothing for ${Math.round(silentFor)}s, past the ${threshold.seconds}s threshold (${threshold.basis})`
      : `last wrote ${Math.round(silentFor)}s ago, inside the ${threshold.seconds}s threshold`,
  };
}

/**
 * Can every folder on the live shopping path resolve `pg`?
 *
 * THE POINT OF ITEM 1. `/asdair/health` said `ok: true` while `/asdair/workspace`
 * was 500-ing because `pg` was unresolvable from its caller. Node resolves from
 * the CALLER, so this cannot be answered once for the service - it has to be
 * asked per folder, which is exactly what the launcher's preflight already does
 * and what the status surface did not.
 *
 * `resolveFrom` is injected so the failure can be proven without uninstalling a
 * real dependency. The default resolves for real.
 */
export function probePgConsumers({ resolveFrom, consumers = PG_CONSUMERS } = {}) {
  if (typeof resolveFrom !== 'function') {
    return { available: false, reason: 'no resolver supplied', checked: 0, unresolvable: [] };
  }
  const unresolvable = [];
  for (const rel of consumers) {
    try {
      resolveFrom(rel);
    } catch (err) {
      unresolvable.push({ caller: rel, error: err && err.code ? err.code : 'RESOLVE_FAILED' });
    }
  }
  return {
    available: true,
    module: 'pg',
    checked: consumers.length,
    ok: unresolvable.length === 0,
    unresolvable,
    source: "require.resolve('pg') from each calling folder - node resolves from the CALLER, so one answer per folder",
  };
}
