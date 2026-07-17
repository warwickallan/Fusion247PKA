// Card-projection retry (WP0 §6 regression).
//
// A card edit is a RETRYABLE PROJECTION (supabase-operational-foundation-
// boundary.md §3/§4): a failed edit-to-Completed must NOT reverse or duplicate
// the durable write. This proves the retry is actually callable — a completed
// capture whose first editCard failed is re-projected by retryCardProjection()
// to Completed, WITHOUT re-running the governed write (writeCount stays 1) and
// WITHOUT touching store state (stays `completed`). Deterministic: injected `now`.

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

test('failed editCard → retryCardProjection re-edits to Completed; no re-write, state stays completed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-card-retry-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    const clock = fixedClock(T0);
    const intake = createIntake({ store, adapter, clock });
    const worker = createWorker({
      store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 30_000,
    });

    const acc = await intake.accept({
      message: { message_id: 60600, from: { id: AUTH_ID }, text: 'card should end Completed' },
    });
    const captureId = acc.captureId;
    await intake.confirmSave(captureId); // the user taps Save to Brain

    // Arm the adapter so the worker's edit-to-Completed FAILS once (swallowed).
    adapter.failNextEdit();

    clock.advance(1000);
    const done = await worker.processOne({ now: clock.now() });
    // The write + completion are durable despite the failed card projection.
    assert.equal(done.state, STATES.COMPLETED);
    assert.equal(markdownWriter.writeCount(), 1);

    // The failed edit never landed — no Completed card yet.
    let edits = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 0, 'the first editCard threw and recorded nothing');

    // Retry the projection — re-derives the card from CURRENT state and re-sends.
    clock.advance(1000);
    const entry = await worker.retryCardProjection(captureId, { now: clock.now() });
    assert.equal(entry.op, 'edit');
    assert.equal(entry.cardModel.is_completed, true);
    assert.match(entry.cardModel.status_line, /Completed/);

    edits = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 1, 'exactly one Completed card after the retry');
    assert.equal(edits[0].cardModel.is_completed, true);

    // Projection retry touched neither the write nor the store state.
    assert.equal(markdownWriter.writeCount(), 1, 'no governed re-write on card retry');
    assert.equal(store.getByCaptureId(captureId).state, STATES.COMPLETED, 'state unchanged');

    // Idempotent: retrying again just re-sends the same card, still no re-write.
    clock.advance(1000);
    const again = await worker.retryCardProjection(captureId, { now: clock.now() });
    assert.equal(again.cardModel.is_completed, true);
    assert.equal(markdownWriter.writeCount(), 1, 'still one write after a second retry');
    assert.equal(store.getByCaptureId(captureId).state, STATES.COMPLETED);

    // Exactly one note on disk throughout.
    const notes = fs.readdirSync(markdownWriter.inboxDir).filter((f) => f.endsWith('.md'));
    assert.equal(notes.length, 1);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
