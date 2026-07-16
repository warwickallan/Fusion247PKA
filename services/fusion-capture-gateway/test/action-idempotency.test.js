// Action / re-delivery idempotency (WP0 §6 regression).
//
// Applying the SAME Save-to-Brain action — i.e. re-delivering the identical
// inbound update — is idempotent end-to-end: ONE durable capture, ONE governed
// write, the SAME receipt. No second store row, no second note. Exercised through
// the real intake→adapter→store→worker path (there is no standalone action-apply
// function; the action rides on the update). Deterministic: injected `now`.

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
  return { store, adapter, markdownWriter, clock, intake, worker };
}

// The same logical message ⇒ same idempotency key ⇒ same capture_id.
const UPDATE = {
  message: { message_id: 33012, from: { id: AUTH_ID }, text: 'save this once, deliver it twice' },
};

test('re-delivering the identical Save-to-Brain update twice: one capture, same receipt, no second row', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-actidem-'));
  try {
    const { store, intake } = harness(baseDir);

    const first = intake.accept(UPDATE, { action: 'SaveToBrain' });
    assert.equal(first.ok, true);
    assert.equal(first.isNew, true, 'first delivery creates the durable capture');

    const second = intake.accept(UPDATE, { action: 'SaveToBrain' });
    assert.equal(second.ok, true);
    assert.equal(second.isNew, false, 'the re-delivery is a dedup hit, not a new row');
    assert.equal(second.captureId, first.captureId, 'both resolve to the SAME capture_id');

    // Exactly one durable record; identical receipt.
    assert.equal(store.list().length, 1, 'exactly one durable capture');
    assert.deepEqual(second.receipt, first.receipt, 'the same receipt is returned both times');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('re-delivery after the write completed: still one row, still one note, no second write', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-actidem-post-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const first = intake.accept(UPDATE, { action: 'SaveToBrain' });
    clock.advance(1000);
    const done = worker.processOne({ now: clock.now() });
    assert.equal(done.state, STATES.COMPLETED);
    assert.equal(markdownWriter.writeCount(), 1);

    const sendCardsBefore = adapter.sentCards.filter((c) => c.op === 'send').length;

    // Re-deliver the identical update AFTER completion.
    clock.advance(1000);
    const replay = intake.accept(UPDATE, { action: 'SaveToBrain' });
    assert.equal(replay.isNew, false, 'no new capture on replay');
    assert.equal(replay.captureId, first.captureId);

    // No second durable row, no second card, no second worker item, no second write.
    assert.equal(store.list().length, 1, 'still exactly one capture');
    const sendCardsAfter = adapter.sentCards.filter((c) => c.op === 'send').length;
    assert.equal(sendCardsAfter, sendCardsBefore, 'no second initial card on a dedup hit');

    clock.advance(1000);
    const nothing = worker.processOne({ now: clock.now() });
    assert.equal(nothing, null, 'nothing new to claim after a dedup re-delivery');
    assert.equal(markdownWriter.writeCount(), 1, 'still exactly one governed write');

    // Exactly one note file for this capture.
    const notes = fs.readdirSync(markdownWriter.inboxDir).filter((f) => f.endsWith('.md'));
    assert.equal(notes.length, 1, 'exactly one note on disk');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
