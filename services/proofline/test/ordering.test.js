// T-3d — fsync-before-ack, proven as CALL ORDERING.
// G-3 (process half) — the worker never runs on the request's path to the client.
//
// This is the file that carries the G-2a claim, and the claim is deliberately
// narrow: `fsyncSync` RETURNED before the acknowledgement was written. It is
// not, and can never be, a claim about the platter (map F-2).
//
// Each ordering assertion is paired with a MUTATION that makes it fail, because
// an ordering assertion that would pass against a broken implementation is
// decoration.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { mkTempDir, rmTempDir, startApp, httpJson } from './helpers/harness.mjs';

/** An fs façade that records enter/return around the two durable-write calls. */
function recordingFs(events) {
  return {
    ...fs,
    writeSync(...args) {
      events.push('fs.writeSync.enter');
      const r = fs.writeSync(...args);
      events.push('fs.writeSync.return');
      return r;
    },
    fsyncSync(...args) {
      events.push('fs.fsyncSync.enter');
      const r = fs.fsyncSync(...args);
      events.push('fs.fsyncSync.return');
      return r;
    },
  };
}

/** MUTANT writer: writeSync but NO fsync. Used to prove T-3d discriminates. */
function noFsyncWriterFactory(events) {
  return (journalPath, fsImpl) => {
    const fd = fsImpl.openSync(journalPath, 'a');
    return {
      kind: 'no-fsync-mutant',
      append(line) {
        fsImpl.writeSync(fd, line);
        // fsyncSync deliberately omitted
      },
      close() {
        try {
          fsImpl.closeSync(fd);
        } catch {
          /* already closed */
        }
      },
    };
  };
}

async function runSubmit({ writerFactory } = {}) {
  const dir = mkTempDir('proofline-order');
  const events = [];
  const ctx = await startApp({
    dataDir: dir,
    fsImpl: recordingFs(events),
    trace: (event) => events.push(event),
    ...(writerFactory ? { writerFactory: writerFactory(events) } : {}),
  });
  try {
    events.length = 0; // discard startup (the epoch append)
    const res = await httpJson(`${ctx.url}/api/jobs`, { method: 'POST', body: { key: 'ordering', text: 'prove it' } });
    assert.equal(res.status, 201);
    return { events: [...events], ctx, dir };
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
}

test('T-3d — fsyncSync RETURNED before the HTTP response was written', async () => {
  const { events } = await runSubmit();

  const idxResponse = events.indexOf('http.response');
  const idxFsyncReturn = events.indexOf('fs.fsyncSync.return');

  assert.ok(idxResponse >= 0, 'the response trace point fired');
  assert.ok(idxFsyncReturn >= 0, 'fsyncSync was called at all');
  assert.ok(
    idxFsyncReturn < idxResponse,
    `fsyncSync must return before the response is written — got ${JSON.stringify(events.slice(0, idxResponse + 1))}`,
  );

  // Stronger than "before": NOTHING but the durable append happened first.
  assert.deepEqual(events.slice(0, idxResponse), [
    'fs.writeSync.enter',
    'fs.writeSync.return',
    'fs.fsyncSync.enter',
    'fs.fsyncSync.return',
  ]);
});

test('T-3d MUTATION — with fsync removed, the very same assertion FAILS', async () => {
  const { events } = await runSubmit({ writerFactory: noFsyncWriterFactory });

  const idxResponse = events.indexOf('http.response');
  assert.ok(idxResponse >= 0);

  const beforeResponse = events.slice(0, idxResponse);
  assert.deepEqual(beforeResponse, ['fs.writeSync.enter', 'fs.writeSync.return'], 'the write still happened');
  assert.equal(
    beforeResponse.includes('fs.fsyncSync.return'),
    false,
    'the control discriminates: no fsync returned before the ack',
  );

  // And state it as the assertion the passing test makes, so the two are
  // visibly the same check with opposite outcomes.
  assert.throws(
    () => assert.ok(events.indexOf('fs.fsyncSync.return') >= 0 && events.indexOf('fs.fsyncSync.return') < idxResponse),
    'the T-3d assertion is not vacuous — it fails against a no-fsync store',
  );
});

test('G-3 (process half) — the worker starts processing only AFTER the response is written', async () => {
  const { events } = await runSubmit();

  const idxResponse = events.indexOf('http.response');
  const idxProcess = events.indexOf('worker.process.start');

  assert.ok(idxProcess >= 0, 'the worker did run');
  assert.ok(
    idxProcess > idxResponse,
    `processing must begin after the client is answered — got ${JSON.stringify(events)}`,
  );

  // The lease is a SEPARATE fsynced append, after the response.
  const tail = events.slice(idxResponse + 1, idxProcess);
  assert.deepEqual(tail, ['fs.writeSync.enter', 'fs.writeSync.return', 'fs.fsyncSync.enter', 'fs.fsyncSync.return']);
});
