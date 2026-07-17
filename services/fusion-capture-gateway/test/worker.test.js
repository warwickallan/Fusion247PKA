// Worker happy-path test — update → intake → processOne → real file → completed.

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

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

test('full happy path: capture → worker → file on disk → evidence → completed card', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-worker-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    const clock = fixedClock(10_000_000);
    const intake = createIntake({ store, adapter, clock });
    const worker = createWorker({
      store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 30_000,
    });

    const accepted = await intake.accept({
      message: { message_id: 7007, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text: 'capture this thought' },
    });
    assert.equal(accepted.ok, true);
    const captureId = accepted.captureId;

    // TAP-GATED: before the tap nothing is claimable — the worker must not write.
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'no write before the tap');

    // The user taps "Save to Brain" on the card.
    const confirmed = await intake.confirmSave(captureId);
    assert.equal(confirmed.outcome, 'queued');

    clock.advance(1000);
    const final = await worker.processOne({ now: clock.now() });
    assert.ok(final, 'worker claimed and processed an item');
    assert.equal(final.state, STATES.COMPLETED);

    // A real Markdown file exists in the sandbox.
    const filePath = final.destination_ref.path;
    assert.ok(fs.existsSync(filePath), 'the governed Markdown note exists on disk');
    const body = fs.readFileSync(filePath, 'utf8');
    assert.match(body, /capture this thought/);
    assert.equal(markdownWriter.writeCount(), 1);

    // Evidence recorded, gated completion honoured.
    const rec = store.getByCaptureId(captureId);
    assert.equal(rec.state, STATES.COMPLETED);
    assert.equal(rec.evidence_pointers.length, 1);
    assert.equal(rec.evidence_pointers[0].evidence_kind, 'markdown_write');
    assert.ok(rec.evidence_pointers[0].content_hash, 'evidence carries a content hash');
    assert.ok(rec.destination_ref, 'destination pointer present');

    // Card was edited to Completed.
    const editCards = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(editCards.length, 1);
    assert.equal(editCards[0].cardModel.is_completed, true);
    assert.match(editCards[0].cardModel.status_line, /Completed/);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('worker returns null when nothing is claimable', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-worker-empty-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    const worker = createWorker({
      store, markdownWriter, adapter, workerId: 'worker-A', leaseMs: 30_000,
    });
    assert.equal(await worker.processOne({ now: 1 }), null);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
