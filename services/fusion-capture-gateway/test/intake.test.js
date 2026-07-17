// Intake tests — durable acceptance, allowlist, dedup. Hermetic, no network.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createIntake } from '../src/intake.js';
import { validateReceipt } from '../src/core/contracts.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242; // synthetic authorised id — NOT a real account.

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

function makeUpdate(messageId, text, fromId = AUTH_ID) {
  return { message: { message_id: messageId, from: { id: fromId }, text } };
}

test('synthetic update → durable accept, contract-valid safe-and-waiting receipt', async () => {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const clock = fixedClock(1_000_000);
  const intake = createIntake({ store, adapter, clock });

  const res = await intake.accept(makeUpdate(1001, 'remember to ship WP0'));
  assert.equal(res.ok, true);
  assert.equal(res.isNew, true);

  // Durable row exists at the commit point. TAP-GATED: intake HOLDS the capture
  // at `accepted` (pending, non-claimable) — it is NOT queued until the user
  // taps "Save to Brain" (intake.confirmSave).
  const rec = store.getByCaptureId(res.captureId);
  assert.ok(rec, 'a durable record exists after accept');
  assert.equal(rec.state, STATES.ACCEPTED, 'tap-gated intake holds the item pending');

  // Receipt is contract-valid, safe-and-waiting, never completed.
  const v = validateReceipt(res.receipt);
  assert.equal(v.ok, true, `receipt should be valid: ${JSON.stringify(v.errors)}`);
  assert.equal(res.receipt.safe_and_waiting, true);
  assert.equal(res.receipt.is_terminal, false);
  assert.notEqual(res.receipt.state, STATES.COMPLETED);

  // An initial card was sent (safe-and-waiting, not completed).
  assert.equal(adapter.sentCards.length, 1);
  assert.equal(adapter.sentCards[0].op, 'send');
  assert.equal(adapter.sentCards[0].cardModel.is_completed, false);
});

test('unauthorised sender is rejected (default-deny) — no capture, no row', async () => {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const clock = fixedClock(2_000_000);
  const intake = createIntake({ store, adapter, clock });

  const res = await intake.accept(makeUpdate(2002, 'let me in', 999999));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unauthorised_sender');

  // No durable state created, and the rejection is logged (not actioned).
  assert.equal(store.list().length, 0);
  assert.equal(adapter.sentCards.length, 0);
  assert.equal(adapter.rejections.length, 1);
  assert.equal(adapter.rejections[0].sender_id, '999999');
});

test('duplicate re-delivery dedups — one record, same receipt', async () => {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const clock = fixedClock(3_000_000);
  const intake = createIntake({ store, adapter, clock });

  const first = await intake.accept(makeUpdate(3003, 'same message body'));
  clock.advance(5000); // even with time passing, the key is content-derived.
  const second = await intake.accept(makeUpdate(3003, 'same message body'));

  assert.equal(first.isNew, true);
  assert.equal(second.isNew, false, 're-delivery must not create a new record');
  assert.equal(store.list().length, 1, 'exactly one durable record');
  assert.equal(first.captureId, second.captureId);

  // Same receipt identity + state (idempotent projection).
  assert.equal(second.receipt.capture_id, first.receipt.capture_id);
  assert.equal(second.receipt.state, first.receipt.state);

  // No second initial card on the duplicate.
  assert.equal(adapter.sentCards.length, 1);
});
