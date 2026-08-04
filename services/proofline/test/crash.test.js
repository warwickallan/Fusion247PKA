// T-3a, T-3b, T-3c, T-4 — real child process, real SIGKILL, real restart.
//
// WHAT IS CLAIMED HERE, EXACTLY (map C-1 / F-1 / F-2):
//
//   Claimed  — a record whose append RETURNED before the acknowledgement is
//              still there after an abrupt kill and a restart (G-2b);
//              a writer that returns while the bytes are still in USERSPACE
//              loses that record (G-2c);
//              the kill is a crash, not a stop (T-3a).
//
//   NOT claimed — that `fsyncSync` rather than `writeSync` is what saves the
//              data under SIGKILL. It is not, and no test can show it is: a
//              completed writeSync is already in the OS page cache, which
//              survives process death. Only power loss distinguishes them, and
//              power loss is permanently out of scope (F-2). The fsync claim is
//              an ORDERING claim and lives in ordering.test.js (T-3d).
//
// The kill is made to land mid-flight DETERMINISTICALLY by injecting an
// analysis step that never resolves in the child. C-4 measured the real window
// at ~2.5 ms; racing it would make this suite flaky, and a flaky crash test is
// worse than none.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  mkTempDir, rmTempDir, spawnChild, httpJson, waitFor, readJournal, countRecords, killAllChildren, EXIT_MARKER,
} from './helpers/harness.mjs';

// A failing assertion must produce a FAILURE, never a hang: any child left
// alive by a thrown assertion holds this process's stdio pipes open.
after(() => killAllChildren());

const IS_WIN32 = process.platform === 'win32';

function markerPath(dir) {
  return path.join(dir, EXIT_MARKER);
}

async function waitForJournal(dir, predicate, what) {
  return waitFor(() => (predicate(readJournal(dir)) ? readJournal(dir) : null), { timeoutMs: 8000, what });
}

// ---------------------------------------------------------------------------
// T-3a — the abruptness control
// ---------------------------------------------------------------------------

test('T-3a — an exit handler that DOES fire on a graceful exit does NOT fire on the kill', async (t) => {
  // --- control: graceful exit. The handler is proven to work.
  const gDir = mkTempDir('proofline-graceful');
  const graceful = await spawnChild({ dataDir: gDir, mode: 'normal' });
  const gExit = await graceful.stopGracefully();
  assert.equal(gExit.code, 0, 'the graceful child exited cleanly');
  assert.equal(
    fs.existsSync(markerPath(gDir)),
    true,
    'the exit handler ran on a graceful exit — so its absence below means something',
  );
  rmTempDir(gDir);

  // --- the kill: the SAME handler, in the SAME child code, must not run.
  const kDir = mkTempDir('proofline-killed');
  const killed = await spawnChild({ dataDir: kDir, mode: 'normal' });
  const kExit = await killed.kill();

  assert.equal(
    fs.existsSync(markerPath(kDir)),
    false,
    'no exit handler ran — the kill is a crash, not a stop',
  );

  // Map F-1a: the win32 shape is code=1, signal=null — NOT signal==='SIGKILL'
  // and NOT 137. A harness asserting the POSIX shape fails on this machine.
  t.diagnostic(`killed child exit shape on ${process.platform}: code=${kExit.code} signal=${kExit.signal}`);
  if (IS_WIN32) {
    assert.equal(kExit.code, 1, 'win32 TerminateProcess reports code=1');
    assert.equal(kExit.signal, null, 'win32 reports signal=null, not SIGKILL');
  } else {
    assert.equal(kExit.signal, 'SIGKILL');
  }

  rmTempDir(kDir);
});

// ---------------------------------------------------------------------------
// T-3b — acknowledged record survives; job is re-queued and completes ONCE
// ---------------------------------------------------------------------------

test('T-3b — an acknowledged record survives an abrupt kill, and the job completes exactly once on restart', async () => {
  const dir = mkTempDir('proofline-t3b');
  const key = 't3b-midflight';
  const text = 'caught in flight\r\nwith a CR and an é';

  try {
    // --- the process that gets killed
    const first = await spawnChild({ dataDir: dir, mode: 'hang' });
    const submit = await httpJson(`${first.url}/api/jobs`, { method: 'POST', body: { key, text } });
    assert.equal(submit.status, 201, 'the client was acknowledged');

    // Wait until the job is DURABLY processing, so the kill genuinely lands
    // mid-flight rather than before the lease.
    await waitForJournal(dir, (recs) => countRecords(recs, 'job.started', key) === 1, 'the lease to be durable');

    const kExit = await first.kill();
    if (IS_WIN32) assert.equal(kExit.code, 1);

    // --- G-2b: the acknowledged record is still on disk after the crash.
    const afterKill = readJournal(dir);
    assert.equal(countRecords(afterKill, 'job.created', key), 1, 'the acknowledged record survived');
    assert.equal(countRecords(afterKill, 'job.started', key), 1);
    assert.equal(countRecords(afterKill, 'job.completed', key), 0, 'it really was killed mid-flight');
    const created = afterKill.find((r) => r.t === 'job.created' && r.key === key);
    assert.equal(created.text, text, 'the text is byte-intact in the journal');

    // --- G-8: restart, recover, finish. Exactly once.
    const second = await spawnChild({ dataDir: dir, mode: 'normal' });
    try {
      const job = await waitFor(
        async () => {
          const { status, json } = await httpJson(`${second.url}/api/jobs/${key}`);
          return status === 200 && json.job.state === 'awaiting_approval' ? json.job : null;
        },
        { timeoutMs: 8000, what: 'recovery to complete the job' },
      );

      assert.equal(job.text, text, 'the text survived the crash and the restart');
      assert.equal(job.attempts, 2, 'attempts incremented at the new lease');
      assert.notEqual(job.resultSha256, null);
      assert.equal(job.result.textSha256, created.textSha256);

      const final = readJournal(dir);
      assert.equal(countRecords(final, 'job.completed', key), 1, 'completed EXACTLY once — not twice');
      assert.equal(countRecords(final, 'job.requeued', key), 1);
      assert.equal(countRecords(final, 'job.created', key), 1);

      // Two distinct epochs are visible in the journal: the crashed one and
      // the recovering one.
      const epochs = final.filter((r) => r.t === 'epoch.started').map((r) => r.epoch);
      assert.deepEqual(epochs, [1, 2]);
    } finally {
      await second.kill();
    }
  } finally {
    rmTempDir(dir);
  }
});

// ---------------------------------------------------------------------------
// T-3c — the MUTATION: the store's durable write is what makes T-3b true
// ---------------------------------------------------------------------------

test('T-3c CONTROL — with the durable writer, the acknowledged record is on disk BEFORE the kill', async () => {
  const dir = mkTempDir('proofline-t3c-control');
  const key = 't3c-durable';
  try {
    const child = await spawnChild({ dataDir: dir, mode: 'hang' });
    const submit = await httpJson(`${child.url}/api/jobs`, { method: 'POST', body: { key, text: 'durable' } });
    assert.equal(submit.status, 201);

    // Read the file directly, from the PARENT process, the moment the ack
    // arrives — no waiting, no polling.
    const atAck = readJournal(dir);
    assert.equal(countRecords(atAck, 'job.created', key), 1, 'already durable at acknowledgement time');

    await child.kill();
    assert.equal(countRecords(readJournal(dir), 'job.created', key), 1, 'and still there after the kill');
  } finally {
    rmTempDir(dir);
  }
});

test('T-3c MUTATION — swap the durable write for a userspace-buffered stream: the acknowledged record is LOST', async (t) => {
  const dir = mkTempDir('proofline-t3c-mutant');
  const key = 't3c-lost';
  try {
    const child = await spawnChild({ dataDir: dir, mode: 'hang-stream-corked' });
    const submit = await httpJson(`${child.url}/api/jobs`, { method: 'POST', body: { key, text: 'this will not survive' } });
    assert.equal(submit.status, 201, 'the client was acknowledged just the same — that is the danger');

    // The ack has been given, and NOTHING is on disk.
    assert.equal(countRecords(readJournal(dir), 'job.created', key), 0, 'acknowledged but not durable');

    await child.kill();

    const afterKill = readJournal(dir);
    assert.equal(countRecords(afterKill, 'job.created', key), 0, 'the acknowledged record is LOST');
    assert.equal(afterKill.length, 0, 'not even the epoch record made it');

    // Restart with the real store: the job Warwick was told was accepted is gone.
    const restart = await spawnChild({ dataDir: dir, mode: 'normal' });
    try {
      const res = await httpJson(`${restart.url}/api/jobs/${key}`);
      assert.equal(res.status, 404, 'the job does not exist after restart');

      // T-3b's assertion, run against the mutant, fails.
      assert.throws(() => assert.equal(res.status, 200), 'T-3b is not vacuous — it fails against a non-durable store');
    } finally {
      await restart.kill();
    }
    t.diagnostic('mutant writer: createWriteStream, corked — bytes deterministically still in userspace at kill time');
  } finally {
    rmTempDir(dir);
  }
});

test('T-3c MEASUREMENT — an UNCORKED createWriteStream: whether the record survives is a race, and this records which way it went', async (t) => {
  const dir = mkTempDir('proofline-t3c-plain');
  const key = 't3c-plain';
  try {
    const child = await spawnChild({ dataDir: dir, mode: 'hang-stream' });
    const submit = await httpJson(`${child.url}/api/jobs`, { method: 'POST', body: { key, text: 'racy' } });
    assert.equal(submit.status, 201);

    const atAck = countRecords(readJournal(dir), 'job.created', key);
    await child.kill();
    const afterKill = countRecords(readJournal(dir), 'job.created', key);

    t.diagnostic(`uncorked stream — at ack: ${atAck === 1 ? 'ON DISK' : 'not on disk'}; after kill: ${afterKill === 1 ? 'RETAINED' : 'LOST'}`);

    // The only claim this test makes: the outcome is one of the two, and it is
    // reported rather than asserted. Asserting "LOST" here would be asserting
    // the timing of libuv's flush, which is not a property of Proofline.
    assert.ok(afterKill === 0 || afterKill === 1);
  } finally {
    rmTempDir(dir);
  }
});

// ---------------------------------------------------------------------------
// T-4 — the decision survives
// ---------------------------------------------------------------------------

test('T-4 — an approval survives an abrupt kill and comes back identical (G-7)', async () => {
  const dir = mkTempDir('proofline-t4');
  const key = 't4-decision';
  const note = 'approved by Warwick — note text with a "quote" and a newline\nsecond line';

  try {
    const first = await spawnChild({ dataDir: dir, mode: 'normal' });
    await httpJson(`${first.url}/api/jobs`, { method: 'POST', body: { key, text: 'decide and crash' } });
    await waitFor(async () => (await httpJson(`${first.url}/api/jobs/${key}`)).json.job.state === 'awaiting_approval', {
      timeoutMs: 8000,
      what: 'the job to reach awaiting_approval',
    });

    const approve = await httpJson(`${first.url}/api/jobs/${key}/approve`, { method: 'POST', body: { note } });
    assert.equal(approve.status, 200);
    const before = approve.json.job;
    assert.equal(before.state, 'approved');

    await first.kill();

    const second = await spawnChild({ dataDir: dir, mode: 'normal' });
    try {
      const { status, json } = await httpJson(`${second.url}/api/jobs/${key}`);
      assert.equal(status, 200);
      const after = json.job;

      assert.equal(after.state, 'approved');
      assert.equal(after.decision, 'approved');
      assert.equal(after.note, note, 'the note came back byte-identical');
      assert.equal(after.decidedAt, before.decidedAt);
      assert.equal(after.resultSha256, before.resultSha256, 'and the result digest is unchanged');
      assert.equal(after.attempts, before.attempts, 'a decided job is never reprocessed');

      // The decision is a RECORD, not a mutated row (D-9): it is still in the
      // ordered journal after the crash.
      const records = readJournal(dir);
      assert.equal(countRecords(records, 'job.decided', key), 1);
      const decidedIdx = records.findIndex((r) => r.t === 'job.decided' && r.key === key);
      const completedIdx = records.findIndex((r) => r.t === 'job.completed' && r.key === key);
      assert.ok(decidedIdx > completedIdx, 'the decision is ordered after the completion it decided on');
    } finally {
      await second.kill();
    }
  } finally {
    rmTempDir(dir);
  }
});
