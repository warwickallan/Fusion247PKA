// Application-layer erasure test (security finding F-03). End-to-end on the REAL
// store + a REAL sandbox markdownWriter: a completed capture (note on disk) is
// fully erased — note file gone AND operational record gone — and the flow is
// idempotent and re-capturable. Deterministic: injected `now`, no wall-clock.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createIntake } from '../src/intake.js';
import { createWorker } from '../src/worker.js';
import { createEraser } from '../src/erasure.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;
const T0 = 1_752_660_000_000;

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

function harness(baseDir) {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const markdownWriter = createSandboxMarkdownWriter({ baseDir });
  const clock = fixedClock(T0);
  const intake = createIntake({ store, adapter, clock });
  const worker = createWorker({
    store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 30_000,
  });
  const eraser = createEraser({ store, markdownWriter });
  return { store, adapter, markdownWriter, clock, intake, worker, eraser };
}

const UPDATE = {
  message: { message_id: 90210, from: { id: AUTH_ID }, text: 'erase-me: aquaponics pH note' },
};

test('erase() removes the governed note file AND the operational record', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-erase-'));
  try {
    const { intake, worker, clock, store, eraser } = harness(baseDir);

    // capture → intake
    const acc = intake.accept(UPDATE);
    assert.equal(acc.ok, true);
    const captureId = acc.captureId;

    // worker completes → note on disk
    clock.advance(1000);
    const final = worker.processOne({ now: clock.now() });
    assert.equal(final.state, STATES.COMPLETED);
    const notePath = final.destination_ref.path;
    assert.ok(fs.existsSync(notePath), 'note exists before erasure');
    assert.ok(store.getByCaptureId(captureId), 'record exists before erasure');

    // erase
    const at = clock.now() + 5;
    const result = eraser.erase(captureId, { now: at });

    assert.deepEqual(result, {
      capture_id: captureId,
      erased: true,
      removed: { markdown: true, record: true },
      at_ms: at,
    });

    // note file gone AND operational record gone
    assert.equal(fs.existsSync(notePath), false, 'note file removed by erasure');
    assert.equal(store.getByCaptureId(captureId), undefined, 'record removed by erasure');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('after erasure the same idempotency_key is re-accepted as a genuinely NEW capture', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-erase-reaccept-'));
  try {
    const { intake, worker, clock, store, eraser } = harness(baseDir);

    const first = intake.accept(UPDATE);
    assert.equal(first.ok, true);
    assert.equal(first.isNew, true);
    clock.advance(1000);
    worker.processOne({ now: clock.now() });

    eraser.erase(first.captureId, { now: clock.now() + 5 });
    assert.equal(store.getByCaptureId(first.captureId), undefined);

    // Same synthetic message ⇒ same idempotency key. Because erasure freed the
    // key, this is a FRESH capture, not a dedup hit.
    clock.advance(1000);
    const reAccept = intake.accept(UPDATE);
    assert.equal(reAccept.ok, true);
    assert.equal(reAccept.isNew, true, 'freed key must produce a NEW record after erasure');
    assert.ok(store.getByCaptureId(reAccept.captureId), 'the re-accepted capture is durable');
    assert.equal(store.getByCaptureId(reAccept.captureId).state, STATES.QUEUED);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('double-erase is idempotent: second erase returns {erased:false}, no throw, no leftover file', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-erase-double-'));
  try {
    const { intake, worker, clock, store, eraser } = harness(baseDir);

    const acc = intake.accept(UPDATE);
    clock.advance(1000);
    const final = worker.processOne({ now: clock.now() });
    const notePath = final.destination_ref.path;

    const first = eraser.erase(acc.captureId, { now: clock.now() + 5 });
    assert.equal(first.erased, true);
    assert.equal(first.removed.markdown, true);
    assert.equal(first.removed.record, true);
    assert.equal(fs.existsSync(notePath), false);

    // Second erase of the now-unknown id: safe no-op, never throws.
    let second;
    assert.doesNotThrow(() => {
      second = eraser.erase(acc.captureId, { now: clock.now() + 10 });
    });
    assert.deepEqual(second, {
      capture_id: acc.captureId,
      erased: false,
      removed: { markdown: false, record: false },
      at_ms: clock.now() + 10,
    });
    assert.equal(fs.existsSync(notePath), false, 'no note file resurrected by a re-run erase');
    assert.equal(store.getByCaptureId(acc.captureId), undefined);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('erasing an unknown capture id never throws and reports erased:false', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-erase-unknown-'));
  try {
    const { eraser } = harness(baseDir);
    let out;
    assert.doesNotThrow(() => {
      out = eraser.erase('cap_does_not_exist', { now: T0 });
    });
    assert.deepEqual(out, {
      capture_id: 'cap_does_not_exist',
      erased: false,
      removed: { markdown: false, record: false },
      at_ms: T0,
    });
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
