// Projection tests — wording per state (all contract-valid), and a failed
// editCard leaving the store completed + the markdown write intact.

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
import { projectReceipt, projectCard } from '../src/receiptProjection.js';
import { validateReceipt } from '../src/core/contracts.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;

// Build a minimal record-shaped object for pure projection testing.
function recordFor(state, extra = {}) {
  return {
    capture_id: 'cap_test',
    state,
    updated_at_ms: 1_000,
    destination_ref: null,
    evidence_pointers: [],
    last_error: null,
    ...extra,
  };
}

test('safe-and-waiting states project honest "safe / waiting" wording, never completed', () => {
  for (const state of [STATES.QUEUED, STATES.OFFLINE_QUEUED, STATES.CLAIMED, STATES.WRITING]) {
    const card = projectCard(recordFor(state));
    assert.equal(card.is_completed, false, `${state} must not be completed`);
    assert.match(card.status_line, /safe|waiting/i, `${state} wording is safe-and-waiting`);

    const receipt = projectReceipt(recordFor(state));
    const v = validateReceipt(receipt);
    assert.equal(v.ok, true, `${state} receipt valid: ${JSON.stringify(v.errors)}`);
  }
});

test('completed projection shows Completed with destination + evidence, is_completed true', () => {
  const rec = recordFor(STATES.COMPLETED, {
    destination_ref: { kind: 'markdown', path: '/sandbox/inbox/cap_test.md' },
    evidence_pointers: [{ evidence_kind: 'markdown_write', target_ref: '/sandbox/inbox/cap_test.md', content_hash: 'abc123' }],
  });
  const card = projectCard(rec);
  assert.equal(card.is_completed, true);
  assert.match(card.status_line, /Completed/);

  const receipt = projectReceipt(rec);
  const v = validateReceipt(receipt);
  assert.equal(v.ok, true, `completed receipt valid: ${JSON.stringify(v.errors)}`);
  assert.equal(receipt.is_terminal, true);
  assert.ok(receipt.destination_ref);
  assert.ok(receipt.evidence_ref);
});

test('failed / partial projections carry an honest failure block, not completed', () => {
  for (const state of [STATES.FAILED, STATES.PARTIAL]) {
    const rec = recordFor(state, { last_error: 'write target unavailable' });
    const card = projectCard(rec);
    assert.equal(card.is_completed, false);
    assert.match(card.status_line, /fail|retried|Partially/i);

    const receipt = projectReceipt(rec);
    const v = validateReceipt(receipt);
    assert.equal(v.ok, true, `${state} receipt valid: ${JSON.stringify(v.errors)}`);
    assert.ok(receipt.failure, `${state} carries a failure block`);
    assert.equal(receipt.is_terminal, false);
  }
});

test('failed editCard leaves store record completed and the Markdown write intact', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-projection-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    let t = 40_000_000;
    const clock = { now: () => t };
    const intake = createIntake({ store, adapter, clock });
    const worker = createWorker({
      store, markdownWriter, adapter, workerId: 'worker-A', leaseMs: 30_000,
    });

    const accepted = await intake.accept({
      message: { message_id: 5005, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text: 'card edit will fail' },
    });
    const captureId = accepted.captureId;
    await intake.confirmSave(captureId); // the user taps Save to Brain
    const filePath = path.join(markdownWriter.inboxDir, `${captureId}.md`);

    // Arm the failure BEFORE processing so the completion edit throws.
    adapter.failNextEdit();
    t += 1000;
    const final = await worker.processOne({ now: t });

    // The failed projection did NOT reverse or duplicate the completion.
    assert.equal(final.state, STATES.COMPLETED);
    const rec = store.getByCaptureId(captureId);
    assert.equal(rec.state, STATES.COMPLETED, 'state stays completed despite card failure');

    // The write is intact and not duplicated.
    assert.ok(fs.existsSync(filePath), 'the note is intact on disk');
    assert.equal(markdownWriter.writeCount(), 1, 'no duplicate write');
    assert.equal(rec.evidence_pointers.length, 1, 'evidence intact, not duplicated');

    // The failed edit was swallowed — no successful completed-edit card recorded.
    const editCards = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(editCards.length, 0, 'the completed-edit card failed and was not logged');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
