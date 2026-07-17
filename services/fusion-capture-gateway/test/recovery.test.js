// Recovery test — a dead worker's lease expires, a second worker resumes and
// completes WITHOUT double-writing. No false completion; completed only after
// evidence. Simulates a crash where the file side-effect landed but the store
// transition never committed — the realistic crash-consistency case.

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

test('dead worker → lease expiry → second worker resumes, single write, no false completion', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-recovery-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    const t0 = 20_000_000;
    const leaseMs = 30_000;

    const intake = createIntake({ store, adapter, clock: { now: () => t0 } });
    const accepted = await intake.accept({
      message: { message_id: 8008, from: { id: AUTH_ID }, text: 'survive the crash' },
    });
    const captureId = accepted.captureId;
    await intake.confirmSave(captureId); // the user taps Save to Brain

    // --- Worker A claims, writes the file, then CRASHES before committing the
    //     store transition/destination/evidence. State stays `claimed`.
    const aClaim = store.claim('worker-A', leaseMs, { now: t0 });
    assert.equal(aClaim.capture_id, captureId);
    assert.equal(aClaim.state, STATES.CLAIMED);
    const aWrite = markdownWriter.write(store.getByCaptureId(captureId), { now: t0 });
    assert.equal(aWrite.existed, false, 'worker A performed the first (only) disk write');
    assert.equal(markdownWriter.writeCount(), 1);

    // Store still shows the item claimed by A, never completed.
    let rec = store.getByCaptureId(captureId);
    assert.equal(rec.state, STATES.CLAIMED);
    assert.notEqual(rec.state, STATES.COMPLETED);

    // --- Lease expires; Worker B resumes.
    const t1 = t0 + leaseMs + 1;
    const workerB = createWorker({
      store, markdownWriter, adapter, workerId: 'worker-B', leaseMs,
    });
    const final = await workerB.processOne({ now: t1 });

    assert.ok(final, 'worker B reclaimed the expired lease');
    assert.equal(final.state, STATES.COMPLETED);
    assert.equal(final.claimed_by, 'worker-B', 'reclaimed by B');

    // Idempotent write: still exactly ONE disk write across both workers.
    assert.equal(markdownWriter.writeCount(), 1, 'no duplicate write on resume');

    // Exactly one Markdown file for this capture.
    const inboxFiles = fs.readdirSync(markdownWriter.inboxDir).filter((f) => f.endsWith('.md'));
    assert.equal(inboxFiles.length, 1, 'exactly one note written');

    // Completed only after evidence exists; evidence recorded once.
    rec = store.getByCaptureId(captureId);
    assert.equal(rec.evidence_pointers.length, 1, 'evidence deduped to one pointer');
    assert.ok(rec.destination_ref);
    assert.equal(rec.state, STATES.COMPLETED);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
