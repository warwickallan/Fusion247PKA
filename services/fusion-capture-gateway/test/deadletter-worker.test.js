// Worker-level retry-exhaustion → dead-letter (WP0 §6 regression).
//
// End-to-end on the REAL store + REAL sandbox writer + REAL adapter. A governed
// write that keeps failing burns its bounded attempts and is PARKED in
// `dead_letter` — never `completed`, with an honest failure projection and NO
// note file / NO duplicate write leaked. A transient single failure recovers on
// the next reclaim and completes. Deterministic: injected `now`, no wall-clock.

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
import { projectReceipt } from '../src/receiptProjection.js';
import { STATES, MAX_DELIVERY_ATTEMPTS } from '../src/core/states.js';

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

// A failed capture has no legal FAILED→QUEUED edge (retry never re-enters via the
// queue directly). A retry scheduler re-queues it via the legal FAILED→CLAIMED→
// QUEUED path, which clears the lease and makes it freshly claimable. attempt_count
// is untouched here — it only climbs when the worker's next claim() runs.
function requeueForRetry(store, captureId, now) {
  store.transition(captureId, STATES.CLAIMED, { now });
  store.transition(captureId, STATES.QUEUED, { now });
}

const UPDATE = {
  message: { message_id: 55501, from: { id: AUTH_ID }, text: 'dead-letter me if I keep failing' },
};

test('retry-exhaustion → dead_letter: never completed, honest failure, no note/no write leak', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-dlq-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = intake.accept(UPDATE);
    assert.equal(acc.ok, true);
    const captureId = acc.captureId;

    // Arm the writer to fail the governed write on EVERY attempt up to the cap.
    markdownWriter.failNextWrite(MAX_DELIVERY_ATTEMPTS);

    // Drive attempts 1..(cap-1): each claim increments attempt_count, the write
    // throws, the worker records an honest `failed`. Reclaim between attempts.
    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      clock.advance(1000);
      const rec = worker.processOne({ now: clock.now() });
      assert.ok(rec, `attempt ${attempt} claimed something`);
      assert.equal(rec.state, STATES.FAILED, `attempt ${attempt} ends failed, not completed`);
      assert.equal(rec.attempt_count, attempt, 'attempt_count climbs by one per claim');
      assert.notEqual(rec.state, STATES.COMPLETED);

      // Honest failure projection while under the cap.
      const receipt = projectReceipt(store.getByCaptureId(captureId));
      assert.equal(receipt.state, STATES.FAILED);
      assert.ok(receipt.failure, 'receipt carries an honest failure block');
      assert.equal(receipt.is_terminal, false, 'failed is not terminal — it will retry');

      requeueForRetry(store, captureId, clock.now());
    }

    // Final attempt hits the cap → dead-lettered.
    clock.advance(1000);
    const dead = worker.processOne({ now: clock.now() });
    assert.equal(dead.attempt_count, MAX_DELIVERY_ATTEMPTS);
    assert.equal(dead.state, STATES.DEAD_LETTER, 'exhausted attempts park in dead_letter');
    assert.notEqual(dead.state, STATES.COMPLETED);

    // Terminal, honest, and NOT completed in the store either.
    const finalRec = store.getByCaptureId(captureId);
    assert.equal(finalRec.state, STATES.DEAD_LETTER);
    const finalReceipt = projectReceipt(finalRec);
    assert.equal(finalReceipt.is_terminal, true, 'dead_letter is terminal');

    // NO note file leaked and NO disk write happened — every write threw before
    // touching disk, so the writer is pristine.
    assert.equal(markdownWriter.writeCount(), 0, 'no governed write ever landed on disk');
    if (fs.existsSync(markdownWriter.inboxDir)) {
      const notes = fs.readdirSync(markdownWriter.inboxDir).filter((f) => f.endsWith('.md'));
      assert.equal(notes.length, 0, 'no note file leaked for a dead-lettered capture');
    }
    // No card ever claimed completion.
    const completedCards = adapter.sentCards.filter((c) => c.cardModel && c.cardModel.is_completed);
    assert.equal(completedCards.length, 0, 'no card ever falsely claimed completion');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('transient single failure recovers: next reclaim writes once and completes', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-dlq-transient-'));
  try {
    const { store, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = intake.accept(UPDATE);
    const captureId = acc.captureId;

    // Only the FIRST write fails.
    markdownWriter.failNextWrite(1);

    clock.advance(1000);
    const failed = worker.processOne({ now: clock.now() });
    assert.equal(failed.state, STATES.FAILED, 'first attempt fails honestly');
    assert.equal(failed.attempt_count, 1);
    assert.equal(markdownWriter.writeCount(), 0, 'the failed write never touched disk');

    // Reclaim → second attempt succeeds (fault budget exhausted).
    requeueForRetry(store, captureId, clock.now());
    clock.advance(1000);
    const done = worker.processOne({ now: clock.now() });
    assert.equal(done.state, STATES.COMPLETED, 'retry recovers before exhaustion');
    assert.equal(done.attempt_count, 2);
    assert.equal(markdownWriter.writeCount(), 1, 'exactly one durable write after recovery');
    assert.ok(fs.existsSync(done.destination_ref.path), 'the note exists on disk');
    assert.equal(store.getByCaptureId(captureId).state, STATES.COMPLETED);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
