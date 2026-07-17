// TAP-GATED CAPTURE (Warwick decision, 2026-07-16 live phone test — "option B")
// + NON-TEXT rejection + Completed-receipt formatting. Hermetic: fixture store,
// mock adapter, injected `now`, no network.
//
// The three live findings this file pins down:
//   1. A text capture must NOT auto-write: the card holds pending (with its
//      action buttons) until the user taps "Save to Brain"; only then does the
//      existing saga (claim → write → evidence → completed) run.
//   2. A non-text update (photo/voice/…) must NEVER produce an empty capture or
//      any brain write (live defect: a photo silently "completed" empty).
//   3. The Completed receipt wraps the destination path in a Markdown code span
//      so Telegram cannot auto-link the `.md` filename as a bogus URL.

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
import { projectCard, projectReceipt } from '../src/receiptProjection.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;
const T0 = 1_752_700_000_000;

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

function harness(baseDir, { isWorkerOnline } = {}) {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const markdownWriter = createSandboxMarkdownWriter({ baseDir });
  const clock = fixedClock(T0);
  const intake = createIntake({ store, adapter, clock, isWorkerOnline });
  const worker = createWorker({
    store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 30_000,
  });
  return { store, adapter, markdownWriter, clock, intake, worker };
}

function textUpdate(messageId, text) {
  return { message: { message_id: messageId, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text } };
}

test('accept() HOLDS the capture pending: durable + card_ref, NOT claimable, NO write before the tap', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-hold-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = await intake.accept(textUpdate(1, 'tap-gated thought'));
    assert.equal(acc.ok, true);

    // Durable pending row at the legal, NON-claimable `accepted` state.
    const rec = store.getByCaptureId(acc.captureId);
    assert.equal(rec.state, STATES.ACCEPTED);
    assert.equal(acc.receipt.safe_and_waiting, true, 'accepted is a safe-and-waiting state');
    assert.match(acc.receipt.status_line, /Tap "Save to Brain"/, 'card copy asks for the tap');

    // The card is durable-addressable for a post-restart tap.
    assert.ok(rec.card_ref && rec.card_ref.message_id !== undefined, 'card_ref persisted at intake');
    assert.equal(adapter.sentCards[0].cardModel.is_completed, false);

    // The worker finds NOTHING claimable — no write can happen before the tap.
    clock.advance(60_000);
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'pending capture is not claimable');
    assert.equal(markdownWriter.writeCount(), 0, 'no governed write before the tap');
    // An untapped card simply stays pending — WP0 has no timeout logic.
    assert.equal(store.getByCaptureId(acc.captureId).state, STATES.ACCEPTED);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('confirmSave() on the tap runs the FULL existing saga: queued → claim → write → evidence → completed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-save-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = await intake.accept(textUpdate(2, 'write me after the tap'));
    const confirmed = await intake.confirmSave(acc.captureId);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.outcome, 'queued');
    assert.equal(store.getByCaptureId(acc.captureId).state, STATES.QUEUED);

    clock.advance(1000);
    const final = await worker.processOne({ now: clock.now() });
    assert.equal(final.state, STATES.COMPLETED);
    assert.ok(fs.existsSync(final.destination_ref.path), 'governed note on disk');
    assert.match(fs.readFileSync(final.destination_ref.path, 'utf8'), /write me after the tap/);
    assert.equal(markdownWriter.writeCount(), 1);

    // The Completed card edit landed on the ORIGINAL card message.
    const edits = adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].cardModel.is_completed, true);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('confirmSave() is idempotent: double-confirm and confirm-after-completion are no-ops (one write)', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-idem-'));
  try {
    const { store, markdownWriter, clock, intake, worker } = harness(baseDir);

    const acc = await intake.accept(textUpdate(3, 'tap me twice'));

    // Double-tap BEFORE the worker drains: second confirm is a state-inspected no-op.
    const first = await intake.confirmSave(acc.captureId);
    const second = await intake.confirmSave(acc.captureId);
    assert.equal(first.outcome, 'queued');
    assert.equal(second.outcome, 'no_op', 'double-tap does not double-queue');
    assert.equal(second.state, STATES.QUEUED);

    clock.advance(1000);
    const final = await worker.processOne({ now: clock.now() });
    assert.equal(final.state, STATES.COMPLETED);
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'nothing left to claim');
    assert.equal(markdownWriter.writeCount(), 1, 'exactly one governed write');

    // Tap AFTER completion: honest already-completed no-op, still one write.
    const late = await intake.confirmSave(acc.captureId);
    assert.equal(late.outcome, 'already_completed');
    assert.equal(await worker.processOne({ now: clock.now() }), null);
    assert.equal(markdownWriter.writeCount(), 1, 'no re-write on a late tap');

    // Unknown capture id: honest failure, no throw.
    const unknown = await intake.confirmSave('00000000-0000-5000-8000-000000000000');
    assert.deepEqual(unknown, { ok: false, reason: 'unknown_capture' });
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('restart-safety at the intake seam: a FRESH worker/adapter completes a pre-restart pending capture on the ORIGINAL card', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-restart-'));
  try {
    // "Before the restart": intake accepts and holds; card + card_ref durable.
    const { store, adapter, clock, intake } = harness(baseDir);
    const acc = await intake.accept(textUpdate(4, 'pending across a restart'));
    const originalCardRef = store.getByCaptureId(acc.captureId).card_ref;
    assert.ok(originalCardRef && originalCardRef.message_id !== undefined);
    assert.equal(adapter.sentCards.filter((c) => c.op === 'send').length, 1);

    // "After the restart": a BRAND-NEW adapter (empty in-memory card map) and a
    // BRAND-NEW worker/intake over the SAME durable store.
    const adapter2 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter2 = createSandboxMarkdownWriter({ baseDir });
    const intake2 = createIntake({ store, adapter: adapter2, clock });
    const worker2 = createWorker({
      store, markdownWriter: markdownWriter2, adapter: adapter2, clock, workerId: 'worker-B', leaseMs: 30_000,
    });
    assert.equal(adapter2.cardTarget(acc.captureId), undefined, 'fresh adapter knows nothing in-memory');

    // The tap arrives only now — the durable card_ref still routes it.
    const captureId = store.findCaptureIdByCard(originalCardRef.chat_id, originalCardRef.message_id);
    assert.equal(captureId, acc.captureId, 'durable card_ref reverse lookup survives the restart');
    const confirmed = await intake2.confirmSave(captureId);
    assert.equal(confirmed.outcome, 'queued');

    clock.advance(1000);
    const final = await worker2.processOne({ now: clock.now() });
    assert.equal(final.state, STATES.COMPLETED);

    // The Completed edit re-targeted the ORIGINAL pre-restart card message.
    const edits = adapter2.sentCards.filter((c) => c.op === 'edit');
    assert.equal(edits.length, 1);
    assert.equal(edits[0].messageId, originalCardRef.message_id, 'edit lands on the original card');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('NON-TEXT at the intake seam: no envelope, no queue row, no card, no write — fail-closed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-nontext-'));
  try {
    const { store, adapter, markdownWriter, clock, intake, worker } = harness(baseDir);

    const res = await intake.accept({
      message: {
        message_id: 5,
        from: { id: AUTH_ID },
        photo: [{ file_id: 'AgACAgQAAxk', width: 90, height: 90 }],
      },
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unsupported_content_type');

    // Absolutely nothing durable happened — the exact opposite of the live
    // defect (empty capture, empty note, false 'completed').
    assert.equal(store.list().length, 0, 'no capture row');
    assert.equal(adapter.sentCards.length, 0, 'no card');
    clock.advance(1000);
    assert.equal(await worker.processOne({ now: clock.now() }), null, 'nothing claimable');
    assert.equal(markdownWriter.writeCount(), 0, 'no governed write');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('Completed receipt formatting: destination path is backtick-wrapped and ONLY the completed card carries parse_mode', () => {
  const completed = {
    capture_id: 'cap_fmt',
    state: STATES.COMPLETED,
    updated_at_ms: T0,
    destination_ref: { kind: 'markdown', path: 'C:\\repo\\Team Inbox\\captures\\cap_fmt.md' },
    evidence_pointers: [{ evidence_kind: 'markdown_write', target_ref: 'x', content_hash: 'h' }],
    last_error: null,
  };
  const card = projectCard(completed);
  assert.equal(card.is_completed, true);
  assert.equal(card.parse_mode, 'Markdown', 'completed card asks for Markdown rendering');
  assert.match(card.status_line, /\(`C:\\repo\\Team Inbox\\captures\\cap_fmt\.md`\)/, 'path sits inside a code span');
  assert.ok(!/\(C:/.test(card.status_line), 'the bare (unwrapped) path form is gone');

  const receipt = projectReceipt(completed);
  assert.match(receipt.status_line, /`.*cap_fmt\.md`/, 'receipt carries the same code-span path');

  // A backtick smuggled into the path cannot break the code span.
  const withBacktick = projectCard({
    ...completed,
    destination_ref: { kind: 'markdown', path: 'a`b.md' },
  });
  assert.match(withBacktick.status_line, /\(`a'b\.md`\)/, 'inner backticks are stripped defensively');

  // Non-completed cards NEVER carry a parse_mode (their text may embed
  // arbitrary error strings that must not hit Telegram's Markdown parser).
  for (const state of [STATES.ACCEPTED, STATES.QUEUED, STATES.FAILED, STATES.NEEDS_CLARIFICATION]) {
    const c = projectCard({
      capture_id: 'cap_fmt', state, updated_at_ms: T0, destination_ref: null, evidence_pointers: [], last_error: 'weird _*`_ error',
    });
    assert.equal(c.parse_mode, undefined, `${state} card has no parse_mode`);
    assert.equal(c.is_completed, false);
  }
});
