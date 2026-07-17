// Worker-level retry-exhaustion → dead-letter (WP0 §6 regression).
//
// End-to-end on the REAL store + REAL sandbox writer + REAL adapter. A governed
// write that keeps failing burns its bounded attempts and is PARKED in
// `dead_letter` — never `completed`, with an honest failure projection and NO
// note file / NO duplicate write leaked. A transient single failure recovers on
// the next reclaim and completes. Deterministic: injected `now`, no wall-clock.
//
// SONNET REVIEW FIX (2026-07-16): this file previously drove "retry" via a
// TEST-ONLY helper (`requeueForRetry`) that manually called `store.transition`
// twice — no equivalent code existed in `src/`, so WP0's retry claims were only
// proven in a test backdoor, not in production code. That helper is gone. Every
// reclaim below now goes through the REAL autonomous path: worker.processOne()
// -> store.claim(), which only reclaims a failed/partial item once
// `next_attempt_at_ms` (stamped by store.recordFailure(), computed by
// core/retryPolicy.js) is due. See also retry-scheduling.test.js for the
// dedicated "not due yet" / "due" / "cap respected" store-level proofs.

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
import { MAX_BACKOFF_MS } from '../src/core/retryPolicy.js';

const AUTH_ID = 424242;
const T0 = 1_752_660_000_000;

// Always clears the backoff regardless of attempt number (backoff is capped at
// MAX_BACKOFF_MS), so advancing by this much between attempts is guaranteed to
// make the item due again via the REAL claim() due-retry path.
const ADVANCE_PAST_ANY_BACKOFF_MS = MAX_BACKOFF_MS + 1;

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

const UPDATE = {
  message: { message_id: 55501, from: { id: AUTH_ID }, text: 'dead-letter me if I keep failing' },
};

test('retry-exhaustion → dead_letter: never completed, honest failure, no note/no write leak (autonomous reclaim)', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-dlq-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = await intake.accept(UPDATE);
    assert.equal(acc.ok, true);
    const captureId = acc.captureId;
    await intake.confirmSave(captureId); // the user taps Save to Brain

    // Arm the writer to fail the governed write on EVERY attempt up to the cap.
    markdownWriter.failNextWrite(MAX_DELIVERY_ATTEMPTS);

    // Drive attempts 1..(cap-1): each processOne() claims (attempt_count++), the
    // write throws, the worker records an honest `failed` with a scheduled
    // next_attempt_at_ms. Advancing the clock past ANY possible backoff and
    // calling processOne() again proves the REAL production reclaim path — no
    // test-only transition helper involved anywhere in this loop.
    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      clock.advance(1000);
      const rec = await worker.processOne({ now: clock.now() });
      assert.ok(rec, `attempt ${attempt} claimed something`);
      assert.equal(rec.state, STATES.FAILED, `attempt ${attempt} ends failed, not completed`);
      assert.equal(rec.attempt_count, attempt, 'attempt_count climbs by one per claim');
      assert.notEqual(rec.state, STATES.COMPLETED);
      assert.ok(rec.next_attempt_at_ms > clock.now(), 'a scheduled retry is due strictly in the future');

      // Honest failure projection while under the cap.
      const receipt = projectReceipt(store.getByCaptureId(captureId));
      assert.equal(receipt.state, STATES.FAILED);
      assert.ok(receipt.failure, 'receipt carries an honest failure block');
      assert.equal(receipt.is_terminal, false, 'failed is not terminal — it will retry');

      // Immediately re-processing (before the backoff elapses) must NOT claim
      // this item early — nothing else is queued, so processOne() returns null.
      const tooSoon = await worker.processOne({ now: clock.now() });
      assert.equal(tooSoon, null, 'a not-yet-due failed item is never reclaimed early');

      // Advance past ANY possible backoff — the REAL claim() path (inside the
      // next processOne() call) autonomously reclaims it. No manual transition.
      clock.advance(ADVANCE_PAST_ANY_BACKOFF_MS);
    }

    // Final attempt hits the cap → dead-lettered, reclaimed the same real way.
    const dead = await worker.processOne({ now: clock.now() });
    assert.equal(dead.attempt_count, MAX_DELIVERY_ATTEMPTS);
    assert.equal(dead.state, STATES.DEAD_LETTER, 'exhausted attempts park in dead_letter');
    assert.notEqual(dead.state, STATES.COMPLETED);

    // Terminal, honest, and NOT completed in the store either.
    const finalRec = store.getByCaptureId(captureId);
    assert.equal(finalRec.state, STATES.DEAD_LETTER);
    const finalReceipt = projectReceipt(finalRec);
    assert.equal(finalReceipt.is_terminal, true, 'dead_letter is terminal');

    // A dead-lettered item is never reclaimed again, even after more time passes.
    clock.advance(ADVANCE_PAST_ANY_BACKOFF_MS);
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'dead_letter is never reclaimed');

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

test('transient single failure recovers via the real autonomous reclaim: next due claim writes once and completes', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-dlq-transient-'));
  try {
    const { store, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = await intake.accept(UPDATE);
    const captureId = acc.captureId;
    await intake.confirmSave(captureId); // the user taps Save to Brain

    // Only the FIRST write fails.
    markdownWriter.failNextWrite(1);

    clock.advance(1000);
    const failed = await worker.processOne({ now: clock.now() });
    assert.equal(failed.state, STATES.FAILED, 'first attempt fails honestly');
    assert.equal(failed.attempt_count, 1);
    assert.equal(markdownWriter.writeCount(), 0, 'the failed write never touched disk');
    assert.ok(failed.next_attempt_at_ms > clock.now(), 'a retry is scheduled in the future');

    // Too soon: the real claim() path must refuse to reclaim before due.
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'not reclaimed before the due time');

    // Advance past the backoff — the REAL claim() autonomously reclaims it on
    // the worker's next processOne() call. No manual transition anywhere.
    clock.advance(ADVANCE_PAST_ANY_BACKOFF_MS);
    const done = await worker.processOne({ now: clock.now() });
    assert.equal(done.state, STATES.COMPLETED, 'retry recovers before exhaustion');
    assert.equal(done.attempt_count, 2);
    assert.equal(markdownWriter.writeCount(), 1, 'exactly one durable write after recovery');
    assert.ok(fs.existsSync(done.destination_ref.path), 'the note exists on disk');
    assert.equal(store.getByCaptureId(captureId).state, STATES.COMPLETED);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
