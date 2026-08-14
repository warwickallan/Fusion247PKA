// AC7 — recovery is proven by killing a REAL process.
//
// No injected exception, no mocked failure, no simulated crash. A real child process opens
// a real transaction against a real Postgres, is stopped dead from outside at a chosen
// instant, and the store is then asked what it holds. Afterwards a cold restart runs the
// same intake in a new process, and the store is asked again.
//
// ── THE COVERAGE SPLIT, STATED PLAINLY, BECAUSE "SIGKILL" MUST NOT STAND UNQUALIFIED ────
// On Linux (and so in CI) `child.kill('SIGKILL')` delivers a genuine POSIX SIGKILL: the
// process is destroyed by the kernel with no handler, no unwinding and no flush.
// On Windows there are no POSIX signals. Node maps kill() to TerminateProcess, which ends
// the process unconditionally and without cleanup. That is a real abrupt termination and it
// is the right shape of proof — but it is NOT the same mechanism, and this file reports
// which one it actually used rather than letting one word cover both.
// ────────────────────────────────────────────────────────────────────────────────────────

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { SERVICE_ROOT, databaseUrl, freshSchema, newPool, testConfig } from './helpers/harness.mjs';
import { buildManifest, seedIdentity } from '../src/identity.mjs';
import { suppliedBundle } from '../src/routes/supplied.mjs';

const CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const IS_WINDOWS = process.platform === 'win32';
const KILL_MECHANISM = IS_WINDOWS
  ? 'Windows TerminateProcess (no POSIX signals on this platform)'
  : 'POSIX SIGKILL';

// Every point inside the transaction at which a kill could land. All of them are before
// COMMIT, so all of them must leave the store completely untouched.
const KILL_STAGES = ['transaction-open', 'seed-inserted', 'snapshot-written', 'pre-commit'];

let pool;
let config;
let killsExecuted = 0;

before(async () => {
  pool = newPool();
  config = testConfig();
  await freshSchema(pool);
});

after(async () => {
  await pool.end();
  console.log(`\n[AC7] kill cases executed: ${killsExecuted} of ${KILL_STAGES.length}, via ${KILL_MECHANISM}`);
});

const TEXT = 'A real intake, stopped dead halfway through, on purpose.';
const angleFor = (stage) => `killed at ${stage}`;

/** The identity this intake WILL have — computed independently of the intake itself. */
function expectedSeedId(stage) {
  const bundle = suppliedBundle({ config, angle: angleFor(stage), text: TEXT, privacyState: 'internal' });
  return seedIdentity(buildManifest({
    route: 'supplied',
    angle: bundle.angle,
    members: bundle.members.map((m) => ({ source_ref: m.source_ref, content_sha256: m.content_sha256 })),
  }));
}

function cliArgs(stage, extra = []) {
  return [CLI, 'supplied', '--angle', angleFor(stage), '--text', TEXT, '--privacy', 'internal', ...extra];
}

/** Spawn the intake, wait until it reports it is parked inside the transaction, then kill it. */
function spawnAndKillAt(stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, cliArgs(stage, ['--hold-at', stage]), {
      env: { ...process.env, VLOGOPS_DB_URL: databaseUrl() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    let killed = false;

    const giveUp = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`child never reached stage ${stage}. stdout=${out} stderr=${err}`));
    }, 30_000);

    child.stdout.on('data', (d) => {
      out += d.toString();
      if (!killed && out.includes(`VLOGOPS_HELD_AT ${stage}`)) {
        killed = true;
        // THE KILL. Nothing is mocked and nothing is thrown inside the process: it is
        // destroyed from outside while its transaction is open.
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (d) => { err += d.toString(); });

    child.on('exit', (code, signal) => {
      clearTimeout(giveUp);
      if (!killed) return reject(new Error(`child exited on its own (code=${code}) before it could be killed`));
      resolve({ code, signal });
    });
    child.on('error', reject);
  });
}

/** Wait for the killed backend's transaction to be reaped, so the restart is a COLD one. */
async function waitForBackendsToClear(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await pool.query(
      `select count(*)::int n from pg_stat_activity
        where datname = current_database()
          and state in ('idle in transaction', 'idle in transaction (aborted)')
          and pid <> pg_backend_pid()`,
    );
    if (r.rows[0].n === 0) return;
    if (Date.now() > deadline) {
      throw new Error('a killed backend still holds an open transaction after 15s');
    }
    await new Promise((r2) => { setTimeout(r2, 100); });
  }
}

for (const stage of KILL_STAGES) {
  test(`AC7 — killed at '${stage}': the store holds NOTHING, then a cold restart lands exactly one seed`, async () => {
    const seedId = expectedSeedId(stage);

    const before2 = await pool.query('select count(*)::int n from vlogops.content_seed where seed_id = $1', [seedId]);
    assert.equal(before2.rows[0].n, 0, 'the seed existed before the test started');

    const { code, signal } = await spawnAndKillAt(stage);
    killsExecuted += 1;

    // The process really did die, and it did not exit cleanly.
    assert.notEqual(code, 0, `the killed child reported a clean exit (code=${code}, signal=${signal})`);

    await waitForBackendsToClear();

    // NOTHING was written. Not a partial seed, not an orphan snapshot, not a ledger row.
    const seeds = await pool.query('select count(*)::int n from vlogops.content_seed where seed_id = $1', [seedId]);
    assert.equal(seeds.rows[0].n, 0, `a kill at ${stage} left a seed row behind`);

    const snaps = await pool.query('select count(*)::int n from vlogops.source_snapshot where seed_id = $1', [seedId]);
    assert.equal(snaps.rows[0].n, 0, `a kill at ${stage} left an orphan snapshot behind`);

    const runs = await pool.query('select count(*)::int n from vlogops.intake_run where seed_id = $1', [seedId]);
    assert.equal(runs.rows[0].n, 0, `a kill at ${stage} left a ledger row behind`);

    // THE COLD RESTART. A brand-new process, told nothing about what happened, running the
    // same intake. Nobody re-ran anything by hand and nothing was repaired.
    const restart = spawnSync(process.execPath, cliArgs(stage), {
      encoding: 'utf8',
      env: { ...process.env, VLOGOPS_DB_URL: databaseUrl() },
    });
    assert.equal(restart.status, 0, `the cold restart failed: ${restart.stderr}`);

    const result = JSON.parse(restart.stdout.trim().split('\n').pop());

    // Identity unchanged — the restart recomputed it from content, as it must.
    assert.equal(result.seed_id, seedId, 'the identity changed across the kill');
    assert.equal(result.deduplicated, false, 'the restart thought the killed attempt had already sealed');

    // Exactly one seed, in one terminal state.
    const finalSeeds = await pool.query(
      'select status, sealed_at from vlogops.content_seed where seed_id = $1', [seedId],
    );
    assert.equal(finalSeeds.rowCount, 1, 'the store does not hold exactly one seed');
    assert.equal(finalSeeds.rows[0].status, 'sealed', 'the seed is not in a terminal state');
    assert.ok(finalSeeds.rows[0].sealed_at, 'a sealed seed carries no seal timestamp');

    const finalSnaps = await pool.query(
      'select count(*)::int n from vlogops.source_snapshot where seed_id = $1', [seedId],
    );
    assert.equal(finalSnaps.rows[0].n, 1, 'the restart did not land exactly one snapshot');
  });
}

test('AC7 — a NON-ZERO number of kill cases actually executed', () => {
  // Without this, an all-skipped or all-short-circuited run would read as green — which is
  // the precise failure mode the criterion names.
  assert.ok(killsExecuted > 0, 'NO kill case executed; this suite proved nothing about recovery');
  assert.equal(
    killsExecuted, KILL_STAGES.length,
    `only ${killsExecuted} of ${KILL_STAGES.length} kill cases executed`,
  );
  console.log(`[AC7] ${killsExecuted} real process kills executed via ${KILL_MECHANISM}`);
});
