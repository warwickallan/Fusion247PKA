// T-6a / T-6b — the two mutations that decide whether the recovery predicate
// is load-bearing, plus the attempt guard (§5.3) that bounds G-8.
//
// A control is not evidence until it has been made to fail. Each mutation below
// is run ALONGSIDE the production predicate on an identical setup, so the only
// difference between the passing run and the failing run is `isOrphaned`.
//
// Determinism note: the analysis step is injected as a DEFERRED promise the
// test resolves by hand. That is a test double controlling timing — not an
// artificial delay in the service. C-4 forbade building a delay into the
// product to make a state observable; it did not forbid a test from holding a
// job in flight so a scan can be made to land while it is there. Nothing in
// src/ waits for anything.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/store.mjs';
import { isOrphaned } from '../src/recovery.mjs';
import {
  mkTempDir, rmTempDir, journalPathIn, startApp, httpJson, waitFor, staysFalse, readJournal, countRecords,
} from './helpers/harness.mjs';

/** Build a journal that already contains a job stranded in `processing`. */
function seedOrphan(dir, { key = 'stranded', text = 'left mid-flight', leases = 1 } = {}) {
  const store = createStore({ journalPath: journalPathIn(dir) });
  store.createJob({ key, text });
  for (let i = 0; i < leases; i++) {
    store.lease(key);
    if (i < leases - 1) store.requeue(key, 'synthesised previous crash');
  }
  const epoch = store.epoch;
  const job = store.getJob(key);
  assert.equal(job.state, 'processing');
  assert.equal(job.attempts, leases);
  store.close();
  return { key, text, epoch };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// ---------------------------------------------------------------------------
// The predicate itself
// ---------------------------------------------------------------------------

test('isOrphaned is a pure predicate over state and epoch', () => {
  assert.equal(isOrphaned({ state: 'processing', epoch: 1 }, 2), true);
  assert.equal(isOrphaned({ state: 'processing', epoch: 2 }, 2), false, 'this process\'s own in-flight job');
  assert.equal(isOrphaned({ state: 'queued', epoch: 1 }, 2), false);
  assert.equal(isOrphaned({ state: 'awaiting_approval', epoch: 1 }, 2), false);
  assert.equal(isOrphaned({ state: 'approved', epoch: 1 }, 2), false);
  assert.equal(isOrphaned(null, 2), false);
});

// ---------------------------------------------------------------------------
// T-6a — isOrphaned always FALSE
// ---------------------------------------------------------------------------

test('T-6a CONTROL — with the real predicate, a stranded job is re-queued and completes', async () => {
  const dir = mkTempDir('proofline-t6a-control');
  const { key } = seedOrphan(dir);
  const ctx = await startApp({ dataDir: dir, scanIntervalMs: 50 });
  try {
    const job = await waitFor(
      async () => {
        const { json } = await httpJson(`${ctx.url}/api/jobs/${key}`);
        return json.job.state === 'awaiting_approval' ? json.job : null;
      },
      { timeoutMs: 5000, what: 'the stranded job to be recovered' },
    );
    assert.equal(job.attempts, 2, 'a second lease was taken on restart');
    assert.equal(job.text, 'left mid-flight', 'the text survived');
    assert.notEqual(job.resultSha256, null);

    const records = readJournal(dir);
    assert.equal(countRecords(records, 'job.requeued', key), 1);
    assert.equal(countRecords(records, 'job.started', key), 2);
    assert.equal(countRecords(records, 'job.completed', key), 1, 'completed EXACTLY once');
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});

test('T-6a MUTATION — isOrphaned always false ⇒ the job is STUCK IN PROCESSING FOREVER', async () => {
  const dir = mkTempDir('proofline-t6a-mutant');
  const { key } = seedOrphan(dir);
  const ctx = await startApp({ dataDir: dir, scanIntervalMs: 50, isOrphanedFn: () => false });
  try {
    // ~30 scans at 50 ms. The control above recovers in well under one.
    const neverRecovered = await staysFalse(
      async () => (await httpJson(`${ctx.url}/api/jobs/${key}`)).json.job.state !== 'processing',
      { ms: 1500, intervalMs: 50 },
    );
    assert.equal(neverRecovered, true, 'the mutant must never recover — if it did, the predicate was not load-bearing');

    const { json } = await httpJson(`${ctx.url}/api/jobs/${key}`);
    assert.equal(json.job.state, 'processing');
    assert.equal(json.job.attempts, 1, 'no second lease was ever taken');

    const records = readJournal(dir);
    assert.equal(countRecords(records, 'job.requeued', key), 0);
    assert.equal(countRecords(records, 'job.completed', key), 0);

    // The CONTROL's assertion, run against the MUTANT, fails. Same check,
    // opposite outcome — that is what makes T-6a evidence.
    assert.throws(() => assert.equal(json.job.state, 'awaiting_approval'));
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});

// ---------------------------------------------------------------------------
// T-6b — isOrphaned always TRUE. The failure v1's T-6 could not catch.
// ---------------------------------------------------------------------------

async function liveScanScenario({ isOrphanedFn }) {
  const dir = mkTempDir('proofline-t6b');
  const gate = deferred();
  const ctx = await startApp({
    dataDir: dir,
    // Only the scan this test triggers by hand runs — no timer race.
    scanIntervalMs: 3600000,
    analyzeFn: () => gate.promise,
    ...(isOrphanedFn ? { isOrphanedFn } : {}),
  });

  const key = 'live-inflight';
  const submit = await httpJson(`${ctx.url}/api/jobs`, { method: 'POST', body: { key, text: 'held in flight' } });
  assert.equal(submit.status, 201);

  // The job is now genuinely, durably `processing` under THIS process's epoch.
  await waitFor(async () => (await httpJson(`${ctx.url}/api/jobs/${key}`)).json.job.state === 'processing', {
    what: 'the job to be leased',
  });
  const beforeScan = readJournal(dir);
  assert.equal(countRecords(beforeScan, 'job.started', key), 1);

  // The LIVE periodic scan, fired deterministically.
  ctx.worker.scanOnce();
  await new Promise((r) => setImmediate(r));

  const afterScan = readJournal(dir);

  // Release the in-flight analysis and let everything settle.
  gate.resolve({ version: 1, words: 3 });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const afterRelease = readJournal(dir);
  const epoch = ctx.store.epoch;

  await ctx.app.close();
  rmTempDir(dir);

  return { key, epoch, beforeScan, afterScan, afterRelease };
}

test('T-6b CONTROL — with the real predicate, the live scan LEAVES the in-flight job alone', async () => {
  const { key, afterScan, afterRelease } = await liveScanScenario({});

  assert.equal(countRecords(afterScan, 'job.requeued', key), 0, 'the worker did not re-queue its own in-flight job');
  assert.equal(countRecords(afterScan, 'job.started', key), 1);
  assert.equal(countRecords(afterRelease, 'job.started', key), 1, 'leased exactly once');
  assert.equal(countRecords(afterRelease, 'job.completed', key), 1, 'processed EXACTLY once — this is G-8');
});

test('T-6b MUTATION — isOrphaned always true ⇒ the live worker re-queues its OWN in-flight job and processes it TWICE', async () => {
  const { key, epoch, afterScan, afterRelease } = await liveScanScenario({ isOrphanedFn: () => true });

  // The scan re-queued a job that was in flight in this very process.
  assert.equal(countRecords(afterScan, 'job.requeued', key), 1, 'the mutant re-queued its own in-flight job');

  const starts = afterScan.filter((r) => r.t === 'job.started' && r.key === key);
  assert.equal(starts.length, 2, 'it was leased a second time while the first lease was still running');
  assert.deepEqual(starts.map((r) => r.epoch), [epoch, epoch], 'BOTH leases are under the SAME, current epoch — the exact condition the epoch check exists to prevent');
  assert.deepEqual(starts.map((r) => r.attempts), [1, 2]);

  // And it really did process it twice, not merely re-queue it.
  assert.equal(countRecords(afterRelease, 'job.completed', key), 2, 'processed twice — G-8 broken');

  // The CONTROL's assertions, run against the MUTANT, fail.
  assert.throws(() => assert.equal(countRecords(afterRelease, 'job.completed', key), 1));
  assert.throws(() => assert.equal(countRecords(afterScan, 'job.requeued', key), 0));
});

// ---------------------------------------------------------------------------
// The attempt guard — the stated boundary of G-8 (§5.3)
// ---------------------------------------------------------------------------

test('§5.3 — a job stranded on its 3rd lease becomes FAILED with the reason recorded, not retried forever', async () => {
  const dir = mkTempDir('proofline-attempts');
  const { key } = seedOrphan(dir, { leases: 3 });
  const ctx = await startApp({ dataDir: dir, scanIntervalMs: 50 });
  try {
    const job = await waitFor(
      async () => {
        const { json } = await httpJson(`${ctx.url}/api/jobs/${key}`);
        return json.job.state === 'failed' ? json.job : null;
      },
      { what: 'the attempt guard to fire' },
    );
    assert.equal(job.attempts, 3);
    assert.match(job.failedReason, /abandoned after 3 attempts/);
    assert.equal(countRecords(readJournal(dir), 'job.started', key), 3, 'no 4th lease was taken');
    assert.equal(job.result, null);
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});

test('§5.3 — a job stranded on its 2nd lease still gets its 3rd and completes', async () => {
  const dir = mkTempDir('proofline-attempts2');
  const { key } = seedOrphan(dir, { leases: 2 });
  const ctx = await startApp({ dataDir: dir, scanIntervalMs: 50 });
  try {
    const job = await waitFor(
      async () => {
        const { json } = await httpJson(`${ctx.url}/api/jobs/${key}`);
        return json.job.state === 'awaiting_approval' ? json.job : null;
      },
      { what: 'the third attempt to complete' },
    );
    assert.equal(job.attempts, 3);
    assert.equal(countRecords(readJournal(dir), 'job.completed', key), 1);
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});

test('a failed job cannot be approved — it never reached awaiting_approval', async () => {
  const dir = mkTempDir('proofline-failapprove');
  const { key } = seedOrphan(dir, { leases: 3 });
  const ctx = await startApp({ dataDir: dir, scanIntervalMs: 50 });
  try {
    await waitFor(async () => (await httpJson(`${ctx.url}/api/jobs/${key}`)).json.job.state === 'failed', { what: 'failure' });
    const res = await httpJson(`${ctx.url}/api/jobs/${key}/approve`, { method: 'POST', body: {} });
    assert.equal(res.status, 409);
    assert.match(res.json.detail, /state is failed/);
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});
