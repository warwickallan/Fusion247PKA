// Offline test — accept while worker offline ⇒ offline_queued + safe-and-waiting,
// never completed; when the worker comes online it completes the item.

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

test('tap while worker offline ⇒ offline_queued, safe-and-waiting, not completed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-offline-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });

    let online = false; // worker is DOWN when the user taps.
    let t = 30_000_000;
    const clock = { now: () => t };
    const intake = createIntake({ store, adapter, clock, isWorkerOnline: () => online });

    const accepted = await intake.accept({
      message: { message_id: 9009, from: { id: AUTH_ID }, text: 'queued while offline' },
    });
    assert.equal(accepted.ok, true);
    const captureId = accepted.captureId;

    // TAP-GATED: durable + pending + safe-and-waiting, never completed.
    assert.equal(store.getByCaptureId(captureId).state, STATES.ACCEPTED);
    assert.equal(accepted.receipt.safe_and_waiting, true);
    assert.equal(accepted.receipt.is_terminal, false);
    assert.match(accepted.receipt.status_line, /safe/i);
    assert.equal(adapter.sentCards[0].cardModel.is_completed, false);

    // The user taps Save-to-Brain while the worker is offline: the confirm-time
    // online check parks it offline_queued — durable, still safe-and-waiting.
    const confirmed = await intake.confirmSave(captureId);
    assert.equal(confirmed.outcome, 'queued');
    let rec = store.getByCaptureId(captureId);
    assert.equal(rec.state, STATES.OFFLINE_QUEUED);
    assert.equal(confirmed.receipt.safe_and_waiting, true);

    // Worker offline: nothing changes even if we (mistakenly) had a worker — the
    // item just sits offline-queued. No false completion possible.
    rec = store.getByCaptureId(captureId);
    assert.notEqual(rec.state, STATES.COMPLETED);

    // --- Worker comes online and completes it.
    online = true;
    t += 1000;
    const worker = createWorker({
      store, markdownWriter, adapter, workerId: 'worker-A', leaseMs: 30_000,
    });
    const final = await worker.processOne({ now: t });
    assert.ok(final);
    assert.equal(final.state, STATES.COMPLETED);
    assert.ok(fs.existsSync(final.destination_ref.path));
    assert.equal(markdownWriter.writeCount(), 1);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
