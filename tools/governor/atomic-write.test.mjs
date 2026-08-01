import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  atomicWriteFileSync,
  isRetryableError,
  backoffDelayMs,
  sleepSync,
  RETRYABLE_ERROR_CODES,
  MAX_ATTEMPTS,
  RETRY_BUDGET_MS,
  BACKOFF_MS,
  BACKOFF_JITTER,
} from './atomic-write.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_URL = pathToFileURL(join(__dirname, 'atomic-write.mjs')).href;

function freshDir() {
  return mkdtempSync(join(tmpdir(), 'governor-atomic-write-test-'));
}

function tmpFilesIn(dir) {
  return readdirSync(dir).filter((f) => f.includes('.tmp-'));
}

function errWithCode(code) {
  const e = new Error(`forced ${code}`);
  e.code = code;
  return e;
}

// ---------------------------------------------------------------------------
// AC1 — the retry policy is one readable, named, exported constant set.
//
// The budget arithmetic is asserted against LITERALS held here, not against the
// module's own constants alone. Comparing a module to itself would let the
// source and its "proof" drift into agreeing on a wrong answer; the ceiling
// Larry set (250ms, M2) has to be pinned somewhere outside the file that is
// supposed to respect it.
// ---------------------------------------------------------------------------

test('AC1: the retry policy is exported as named constants a reviewer can read in one place', () => {
  assert.deepEqual([...RETRYABLE_ERROR_CODES], ['EPERM', 'EBUSY', 'EACCES']);
  assert.ok(Object.isFrozen(RETRYABLE_ERROR_CODES), 'the retryable code list must be frozen');
  assert.ok(Object.isFrozen(BACKOFF_MS), 'the backoff schedule must be frozen');
  assert.equal(MAX_ATTEMPTS, 5, 'Larry set 5 attempts (M2)');
  assert.equal(RETRY_BUDGET_MS, 250, 'Larry set a 250ms ceiling (M2/M3)');
  assert.equal(
    BACKOFF_MS.length,
    MAX_ATTEMPTS - 1,
    'one backoff gap between each pair of attempts — a mismatch would silently truncate or repeat the schedule'
  );
});

test('AC1/M2: the WORST-CASE total blocking time is inside the 250ms ceiling, not merely the average', () => {
  const nominal = BACKOFF_MS.reduce((a, b) => a + b, 0);
  const worstCase = nominal * (1 + BACKOFF_JITTER);
  assert.equal(nominal, 150, 'nominal backoff total');
  assert.ok(
    worstCase <= 250,
    `worst-case backoff ${worstCase}ms must not exceed the 250ms ceiling — a hook that blocks longer than that is in the way (AD-19)`
  );
  assert.ok(worstCase <= RETRY_BUDGET_MS, 'and it must match the module\'s own declared budget');
});

test('backoffDelayMs stays inside the jitter band at both extremes of the random draw', () => {
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    const base = BACKOFF_MS[attempt - 1];
    const low = backoffDelayMs(attempt, { random: () => 0 });
    const high = backoffDelayMs(attempt, { random: () => 0.999999 });
    assert.equal(low, base * (1 - BACKOFF_JITTER), `attempt ${attempt} lower bound`);
    assert.ok(high < base * (1 + BACKOFF_JITTER), `attempt ${attempt} upper bound is exclusive`);
    assert.ok(low < high, 'the band must be non-degenerate, or jitter is doing nothing');
  }
});

test('sleepSync really blocks the thread — an async or no-op sleep would make the whole retry decorative', () => {
  const t0 = Date.now();
  sleepSync(60);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 55, `expected a real >=60ms block, measured ${elapsed}ms`);
  assert.ok(elapsed < 2000, `expected a bounded block, measured ${elapsed}ms`);
});

test('sleepSync(0) and negative durations return immediately rather than blocking forever', () => {
  const t0 = Date.now();
  sleepSync(0);
  sleepSync(-5);
  assert.ok(Date.now() - t0 < 50);
});

// ---------------------------------------------------------------------------
// AC2 — retry the three transient sharing codes, rethrow everything else on the
// FIRST attempt.
// ---------------------------------------------------------------------------

test('isRetryableError accepts exactly the three transient sharing codes', () => {
  for (const code of ['EPERM', 'EBUSY', 'EACCES']) {
    assert.equal(isRetryableError(errWithCode(code)), true, `${code} must be retryable`);
  }
  for (const code of ['ENOENT', 'ENOSPC', 'EROFS', 'EMFILE', 'EISDIR']) {
    assert.equal(isRetryableError(errWithCode(code)), false, `${code} must NOT be retryable`);
  }
  assert.equal(isRetryableError(new Error('no code property')), false);
  assert.equal(isRetryableError(null), false);
  assert.equal(isRetryableError(undefined), false);
  assert.equal(isRetryableError({ code: 123 }), false, 'a non-string code must not be matched');
});

test('AC2: each of EPERM/EBUSY/EACCES is genuinely retried to exhaustion, not just listed', () => {
  const dir = freshDir();
  try {
    for (const code of RETRYABLE_ERROR_CODES) {
      let attempts = 0;
      assert.throws(
        () =>
          atomicWriteFileSync(join(dir, `${code}.json`), 'x', {
            renameFile: () => {
              attempts += 1;
              throw errWithCode(code);
            },
            sleep: () => {},
          }),
        (err) => err.code === code
      );
      assert.equal(attempts, MAX_ATTEMPTS, `${code} must be retried up to MAX_ATTEMPTS`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC2: a NON-retryable code is rethrown on the first attempt and never masked by the retry loop', () => {
  const dir = freshDir();
  try {
    for (const code of ['ENOENT', 'ENOSPC']) {
      let attempts = 0;
      let slept = 0;
      assert.throws(
        () =>
          atomicWriteFileSync(join(dir, 'x.json'), 'x', {
            renameFile: () => {
              attempts += 1;
              throw errWithCode(code);
            },
            sleep: () => {
              slept += 1;
            },
          }),
        (err) => err.code === code,
        `${code} must surface as itself`
      );
      assert.equal(attempts, 1, `${code} must not be retried — a real disk-full must not be reported as a sharing problem`);
      assert.equal(slept, 0, 'and nothing must be slept away before reporting it');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// This is the exact shape delegation-gate.test.mjs's fail-open mutation test
// injects: a bare Error carrying NO `.code`. If the retry treated an unknown
// error as retryable, that test would still pass but would sleep through the
// entire budget first — AC2 is what keeps AC6 both green AND fast.
test('AC2/AC6: a bare Error with no .code is rethrown immediately (the delegation-gate mutation-test shape)', () => {
  const dir = freshDir();
  try {
    let attempts = 0;
    let slept = 0;
    assert.throws(
      () =>
        atomicWriteFileSync(join(dir, 'x.json'), 'x', {
          writeFile: () => {
            attempts += 1;
            throw new Error('simulated disk-full on append');
          },
          sleep: () => {
            slept += 1;
          },
        }),
      /simulated disk-full on append/
    );
    assert.equal(attempts, 1);
    assert.equal(slept, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC5 — mutation, both directions.
// ---------------------------------------------------------------------------

test('AC5a: a transient EPERM on the first 3 attempts is retried and ultimately SUCCEEDS', () => {
  const dir = freshDir();
  try {
    const target = join(dir, 'sample.json');
    let attempts = 0;
    const result = atomicWriteFileSync(target, '{"ok":1}', {
      renameFile: (from, to) => {
        attempts += 1;
        if (attempts <= 3) throw errWithCode('EPERM');
        return renameSync(from, to); // the real rename, once the forced failures are spent
      },
    });
    assert.equal(result, target);
    assert.equal(attempts, 4, 'must have taken exactly 4 attempts — 3 forced failures then a real success');
    assert.equal(readFileSync(target, 'utf8'), '{"ok":1}', 'the payload must actually be on disk');
    assert.deepEqual(tmpFilesIn(dir), [], 'AC3: retry-then-success must leave no temp file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC5b: a PERMANENTLY failing rename reports failure honestly — it never silently reports success', () => {
  const dir = freshDir();
  try {
    const target = join(dir, 'sample.json');
    let attempts = 0;
    let returned = 'NOT-SET';
    let caught = null;
    try {
      returned = atomicWriteFileSync(target, 'x', {
        renameFile: () => {
          attempts += 1;
          throw errWithCode('EPERM');
        },
        sleep: () => {},
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'a permanent failure MUST throw — returning normally here is the silent-success defect');
    assert.equal(caught.code, 'EPERM', 'and it must surface the real error, not a substitute');
    assert.equal(returned, 'NOT-SET', 'nothing may be returned on the failure path');
    assert.equal(attempts, MAX_ATTEMPTS, 'the attempt budget must be spent, not abandoned early');
    assert.equal(existsSync(target), false, 'and no target file may appear');
    assert.deepEqual(tmpFilesIn(dir), [], 'AC3: permanent failure must ALSO leave no temp file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC3 — no orphaned temp file on ANY path.
// ---------------------------------------------------------------------------

test('AC3: the happy path leaves no temp file and writes the exact payload', () => {
  const dir = freshDir();
  try {
    const target = join(dir, 'nested', 'deep', 'sample.json');
    const result = atomicWriteFileSync(target, 'hello');
    assert.equal(result, target);
    assert.equal(readFileSync(target, 'utf8'), 'hello');
    assert.deepEqual(tmpFilesIn(join(dir, 'nested', 'deep')), [], 'no temp file after a clean write');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC3: temp files do not ACCUMULATE across retry attempts — each attempt cleans its own', () => {
  const dir = freshDir();
  try {
    const seen = new Set();
    assert.throws(
      () =>
        atomicWriteFileSync(join(dir, 'x.json'), 'x', {
          renameFile: (from) => {
            seen.add(from);
            // Every attempt must have found its OWN temp file present on disk...
            assert.equal(existsSync(from), true, 'the attempt must have written its temp file');
            throw errWithCode('EBUSY');
          },
          sleep: () => {},
        }),
      (err) => err.code === 'EBUSY'
    );
    assert.equal(seen.size, MAX_ATTEMPTS, 'each attempt must use a FRESH temp name, never reuse a contended one');
    assert.deepEqual(tmpFilesIn(dir), [], '...and none of them may survive');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC3: a cleanup that itself fails must NOT mask the original error', () => {
  const dir = freshDir();
  try {
    let caught = null;
    try {
      atomicWriteFileSync(join(dir, 'x.json'), 'x', {
        renameFile: () => {
          throw errWithCode('EPERM');
        },
        unlink: () => {
          throw errWithCode('EACCES');
        },
        sleep: () => {},
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.equal(
      caught.code,
      'EPERM',
      'the caller must see the real rename failure, not the cleanup failure that happened afterwards'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// M1 — the payload PRODUCER is re-invoked per attempt.
//
// This is the assertion that stops a future refactor quietly reverting to
// replaying a stale snapshot, which would let a record another writer landed
// during the backoff be discarded by this writer's later successful rename.
// ---------------------------------------------------------------------------

test('M1: a producer payload is RE-DERIVED on every attempt, never replayed from a stale snapshot', () => {
  const dir = freshDir();
  try {
    const target = join(dir, 'ledger.jsonl');
    let produced = 0;
    let attempts = 0;
    atomicWriteFileSync(
      target,
      () => {
        produced += 1;
        // Model the read-modify-write: read whatever is there NOW and append.
        const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
        return `${existing}line-${produced}\n`;
      },
      {
        renameFile: (from, to) => {
          attempts += 1;
          if (attempts <= 2) {
            // Another writer lands its own record during our backoff.
            writeFileSync(target, 'from-another-writer\n');
            throw errWithCode('EPERM');
          }
          return renameSync(from, to);
        },
        sleep: () => {},
      }
    );
    assert.equal(produced, 3, 'the producer must run once per attempt');
    assert.equal(
      readFileSync(target, 'utf8'),
      'from-another-writer\nline-3\n',
      'the winning write must PRESERVE the record that landed during the backoff — replaying the first snapshot would have discarded it'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M1: a constant (non-function) payload is written as-is, the health-store form', () => {
  const dir = freshDir();
  try {
    const target = join(dir, 'sample.json');
    atomicWriteFileSync(target, '{"constant":true}');
    assert.equal(readFileSync(target, 'utf8'), '{"constant":true}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC4 — THE concurrency proof. Real processes, reader contention, three
// witnesses, and a harness proven able to report failure before any green from
// it is cited.
//
// MEASURED BOUNDARY, stated here so a green below is not read as more than it
// is. Reader contention — not writer-vs-writer — is what breaks the rename
// (16 writers alone: ~2% failures; 16 writers + 16 readers: 43.8%). A bounded
// retry can only bridge a contention window shorter than its own budget. With
// readers hammering the target continuously for well over a second, writers
// STILL fail 2-6 of 16 even with the retry, and no policy inside the 250ms
// ceiling can fix that. This test uses a reader burst that is already far more
// aggressive than the real callers (statusLine reads once per message), and the
// full band is recorded in the ticket evidence.
// ---------------------------------------------------------------------------

const CONCURRENCY_N = 16; // literal, and asserted to be >= 16 below
const READS_PER_READER = 25;

function spawnChild(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('exit', (code) => resolve({ code, stderr }));
  });
}

/**
 * Runs N writer processes and N reader processes against ONE target.
 * `writerOpts` is literal JS source spliced into the child, so a variant can
 * force a failure through the SAME harness that produces the green.
 */
async function runConcurrencyHarness({ dir, writerOpts = '{}' }) {
  const target = join(dir, 'contended.json');
  const targetLit = JSON.stringify(target);
  const jobs = [];
  for (let i = 0; i < CONCURRENCY_N; i += 1) {
    const payload = JSON.stringify(JSON.stringify({ writer: i, marker: 'x'.repeat(200) }));
    jobs.push(
      spawnChild(
        `import { atomicWriteFileSync } from ${JSON.stringify(MODULE_URL)};\n` +
          `atomicWriteFileSync(${targetLit}, ${payload}, ${writerOpts});\n`
      )
    );
  }
  for (let i = 0; i < CONCURRENCY_N; i += 1) {
    jobs.push(
      spawnChild(
        `import { readFileSync } from "node:fs";\n` +
          `for (let k = 0; k < ${READS_PER_READER}; k += 1) { try { readFileSync(${targetLit}, "utf8"); } catch {} }\n`
      )
    );
  }
  const all = await Promise.all(jobs);
  const writers = all.slice(0, CONCURRENCY_N);
  return {
    writers,
    successCount: writers.filter((r) => r.code === 0).length,
    orphanedTmpCount: tmpFilesIn(dir).length,
    target,
  };
}

test('AC4: N concurrent writers under N concurrent readers ALL succeed, with zero orphaned temp files', async () => {
  const dir = freshDir();
  try {
    assert.ok(CONCURRENCY_N >= 16, 'the order requires at least 16 concurrent writers and readers');

    const { writers, successCount, orphanedTmpCount, target } = await runConcurrencyHarness({ dir });

    // (2) Closes the Promise.all([]) hole: a spawn loop that never ran would
    // otherwise resolve green over nothing at all.
    assert.equal(writers.length, CONCURRENCY_N, 'every writer process must have been spawned and observed');

    // (3) === N, never > 0. The original wording of this criterion was
    // satisfiable by the UNFIXED code: 47 of 48 writers succeeded against it.
    assert.equal(
      successCount,
      CONCURRENCY_N,
      `every writer must exit 0; failures:\n${writers
        .filter((r) => r.code !== 0)
        .map((r) => r.stderr.split('\n').find((l) => l.includes('Error')) || `exit ${r.code}`)
        .join('\n')}`
    );

    // (4) The witness that does NOT depend on any writer's self-report. A
    // swallowed failure still leaves its temp file, and cannot remove it
    // without having actually succeeded.
    assert.equal(orphanedTmpCount, 0, 'no writer may leave a temp file behind on any path');

    // A last-write-wins target can only ever evidence ONE landed write from the
    // artefact itself. Stated at that strength and no higher.
    const finalDoc = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(typeof finalDoc.writer, 'number');
    assert.equal(finalDoc.marker, 'x'.repeat(200), 'the surviving file must be one writer\'s COMPLETE output, never a mix');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// AC4 clause 5 — made to fail before it is cited.
//
// NOTE ON A CONTRADICTION IN THE ORDER (reported, not silently resolved):
// AC4 clause 5 asks this variant to assert "orphan count non-zero", but AC3
// requires permanent failure to leave ZERO temp files. Both cannot hold at
// once — clause 5 was written against the PRE-FIX behaviour, where a failed
// rename orphaned its temp, which is exactly what AC3 abolishes. The intent of
// clause 5 is that both counters be shown capable of reporting failure, so it
// is satisfied here by TWO variants rather than one: the first drives
// successCount to 0 (with orphans still 0, per AC3), the second disables the
// cleanup to drive the orphan counter non-zero and prove it is live.
test('AC4c5: forcing a PERMANENT rename failure through the same harness drives successCount to 0', async () => {
  const dir = freshDir();
  try {
    const { writers, successCount, orphanedTmpCount } = await runConcurrencyHarness({
      dir,
      writerOpts:
        '{ renameFile: () => { const e = new Error("forced permanent failure"); e.code = "EPERM"; throw e; } }',
    });
    assert.equal(writers.length, CONCURRENCY_N);
    assert.equal(
      successCount,
      0,
      'a counter a forced permanent failure cannot drive to zero measures nothing, and every green above it would be worthless'
    );
    assert.equal(orphanedTmpCount, 0, 'AC3 still holds on the permanent-failure path: cleanup runs even as the error propagates');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC4c5: disabling cleanup drives the ORPHAN counter non-zero — proving "orphans === 0" above is a real observation', async () => {
  const dir = freshDir();
  try {
    const { successCount, orphanedTmpCount } = await runConcurrencyHarness({
      dir,
      writerOpts:
        '{ renameFile: () => { const e = new Error("forced permanent failure"); e.code = "EPERM"; throw e; }, unlink: () => {} }',
    });
    assert.equal(successCount, 0);
    assert.equal(
      orphanedTmpCount,
      CONCURRENCY_N * MAX_ATTEMPTS,
      'with cleanup disabled every attempt of every writer must strand its temp file — this is the pre-fix behaviour, reproduced deliberately'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
