// The store — append-only truth, replay, and the two halves of §5.6.
//
// T-7  journal prefix stability across further work → append-only is real
// T-8  synthesised torn tail → clean recovery; synthesised MID-FILE corruption
//      → LOUD failure

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createStore, replayJournal, JournalCorruptError } from '../src/store.mjs';
import { mkTempDir, rmTempDir, journalPathIn } from './helpers/harness.mjs';

function withStore(fn) {
  const dir = mkTempDir('proofline-store');
  const journalPath = journalPathIn(dir);
  let store = null;
  try {
    store = createStore({ journalPath });
    return fn({ dir, journalPath, store });
  } finally {
    if (store) store.close();
    rmTempDir(dir);
  }
}

test('the epoch is allocated at startup, is monotonic, and is the FIRST record this process wrote', () => {
  const dir = mkTempDir('proofline-epoch');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    assert.equal(s1.epoch, 1);
    s1.close();

    const s2 = createStore({ journalPath });
    assert.equal(s2.epoch, 2);
    s2.close();

    const s3 = createStore({ journalPath });
    assert.equal(s3.epoch, 3);
    s3.close();

    const lines = fs.readFileSync(journalPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(
      lines.filter((r) => r.t === 'epoch.started').map((r) => r.epoch),
      [1, 2, 3],
    );
  } finally {
    rmTempDir(dir);
  }
});

test('the epoch record is durable before any lease can happen', () =>
  withStore(({ journalPath, store }) => {
    // The store constructor has already returned, so the append (writeSync +
    // fsyncSync) has already returned. Read the file from scratch — the epoch
    // is on disk before a single job exists.
    const onDisk = fs.readFileSync(journalPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(onDisk.length, 1);
    assert.equal(onDisk[0].t, 'epoch.started');
    assert.equal(onDisk[0].epoch, store.epoch);
  }));

test('createJob → lease → complete → decide replays to the same state', () => {
  const dir = mkTempDir('proofline-replay');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    s1.createJob({ key: 'k1', text: 'hello world' });
    s1.lease('k1');
    s1.complete('k1', { version: 1, words: 2 }, 'deadbeef');
    s1.decide('k1', 'approved', 'looks right');
    const before = s1.getJob('k1');
    s1.close();

    const s2 = createStore({ journalPath });
    const after = s2.getJob('k1');
    assert.equal(after.state, 'approved');
    assert.equal(after.text, 'hello world');
    assert.equal(after.attempts, 1);
    assert.equal(after.resultSha256, 'deadbeef');
    assert.equal(after.note, 'looks right');
    assert.deepEqual(after.timeline.map((e) => e.t), before.timeline.map((e) => e.t));
    s2.close();
  } finally {
    rmTempDir(dir);
  }
});

test('T-7 — the journal is append-only: every earlier byte is unchanged after further work', () =>
  withStore(({ journalPath, store }) => {
    const prefixes = [];

    prefixes.push(fs.readFileSync(journalPath));
    store.createJob({ key: 'a', text: 'first' });

    prefixes.push(fs.readFileSync(journalPath));
    store.lease('a');

    prefixes.push(fs.readFileSync(journalPath));
    store.complete('a', { version: 1 }, 'sha-a');

    prefixes.push(fs.readFileSync(journalPath));
    store.createJob({ key: 'b', text: 'second' });
    store.lease('b');
    store.complete('b', { version: 1 }, 'sha-b');
    store.decide('a', 'approved', null);

    const finalBytes = fs.readFileSync(journalPath);

    // Every earlier snapshot must be a byte-exact PREFIX of the final file.
    for (const [i, prefix] of prefixes.entries()) {
      assert.ok(prefix.length > 0 || i === 0);
      assert.deepEqual(
        finalBytes.subarray(0, prefix.length),
        prefix,
        `snapshot ${i} (${prefix.length} bytes) is not a prefix of the final journal — something was rewritten`,
      );
      assert.ok(finalBytes.length >= prefix.length);
    }
    assert.ok(finalBytes.length > prefixes.at(-1).length, 'the journal did grow');
  }));

test('T-8a — a synthesised TORN TRAILING line is discarded and the store recovers cleanly', () => {
  const dir = mkTempDir('proofline-torn');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    s1.createJob({ key: 'k', text: 'intact' });
    s1.lease('k');
    s1.close();

    const good = fs.readFileSync(journalPath);

    // Simulate the tear an abrupt kill leaves: a partial final line with no
    // newline. Deterministic by construction — not by hoping to catch a real
    // tear (map §5.6).
    const tornLine = '{"t":"job.completed","key":"k","result":{"vers';
    fs.appendFileSync(journalPath, tornLine);
    assert.equal(fs.readFileSync(journalPath).length, good.length + tornLine.length);

    const s2 = createStore({ journalPath });
    const job = s2.getJob('k');
    assert.equal(job.state, 'processing', 'the torn completion was discarded, not half-applied');
    assert.equal(job.text, 'intact');
    assert.equal(s2.epoch, 2);

    // The tear was truncated away, so the next append lands on a clean line
    // boundary and the journal stays replayable.
    s2.complete('k', { version: 1 }, 'sha');
    s2.close();

    const s3 = createStore({ journalPath });
    assert.equal(s3.getJob('k').state, 'awaiting_approval');
    s3.close();
  } finally {
    rmTempDir(dir);
  }
});

test('T-8b — a synthesised MID-FILE corrupt line FAILS LOUD and is never silently skipped', () => {
  const dir = mkTempDir('proofline-corrupt');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    s1.createJob({ key: 'k', text: 'intact' });
    s1.lease('k');
    s1.complete('k', { version: 1 }, 'sha');
    s1.close();

    const lines = fs.readFileSync(journalPath, 'utf8').split('\n');
    // Corrupt a line in the MIDDLE — a complete line, terminated, that is not
    // valid JSON. Silently skipping this would turn data loss into a
    // plausible-looking journal.
    lines[2] = '{"t":"job.started","key":"k",BROKEN';
    fs.writeFileSync(journalPath, lines.join('\n'));

    assert.throws(
      () => createStore({ journalPath }),
      (err) => err instanceof JournalCorruptError && /line 3/.test(err.message),
    );
  } finally {
    rmTempDir(dir);
  }
});

test('T-8b (variant) — a mid-file line with an UNKNOWN record type also fails loud', () => {
  const dir = mkTempDir('proofline-unknown');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    s1.createJob({ key: 'k', text: 'x' });
    s1.close();
    fs.appendFileSync(journalPath, `${JSON.stringify({ t: 'job.teleported', key: 'k' })}\n`);
    assert.throws(() => createStore({ journalPath }), JournalCorruptError);
  } finally {
    rmTempDir(dir);
  }
});

test('replayJournal reports a torn tail rather than throwing on it', () => {
  const bytes = Buffer.from(
    `${JSON.stringify({ t: 'epoch.started', epoch: 1, at: 'x' })}\n{"t":"job.cre`,
    'utf8',
  );
  const { records, tornTail } = replayJournal(bytes);
  assert.equal(records.length, 1);
  assert.equal(tornTail, '{"t":"job.cre');
});

test('replay refuses a record for an unknown key rather than inventing a job', () => {
  const dir = mkTempDir('proofline-orphanrec');
  const journalPath = journalPathIn(dir);
  try {
    fs.mkdirSync(path.dirname(journalPath), { recursive: true });
    fs.writeFileSync(journalPath, `${JSON.stringify({ t: 'job.started', key: 'ghost', attempts: 1, epoch: 1, at: 'x' })}\n`);
    assert.throws(() => createStore({ journalPath }), /unknown key/);
  } finally {
    rmTempDir(dir);
  }
});

test('replay refuses a DUPLICATE job.created — G-9 broken is an invariant violation, not a state', () => {
  const dir = mkTempDir('proofline-dupcreate');
  const journalPath = journalPathIn(dir);
  try {
    const s1 = createStore({ journalPath });
    s1.createJob({ key: 'k', text: 'x' });
    s1.close();
    fs.appendFileSync(journalPath, `${JSON.stringify({ t: 'job.created', key: 'k', text: 'y', textSha256: 'z', textLength: 1, at: 'x' })}\n`);
    assert.throws(() => createStore({ journalPath }), /duplicate job.created/);
  } finally {
    rmTempDir(dir);
  }
});

test('counts() reports every state and a total', () =>
  withStore(({ store }) => {
    store.createJob({ key: 'q', text: 'x' });
    store.createJob({ key: 'p', text: 'x' });
    store.lease('p');
    store.createJob({ key: 'a', text: 'x' });
    store.lease('a');
    store.complete('a', { version: 1 }, 's');
    const c = store.counts();
    assert.deepEqual(c, { queued: 1, processing: 1, awaiting_approval: 1, approved: 0, rejected: 0, failed: 0, total: 3 });
  }));
