// TAP-GATE INVARIANT (Warwick decision 2026-07-16; regression-guarded after the
// 2026-07-17 live restart scare): `accepted` means AWAITING THE HUMAN'S TAP.
// An accepted capture only ever leaves `accepted` via intake.confirmSave() on a
// SaveToBrain callback — NOT at startup, NOT by lease reclaim, NOT by any drain,
// NOT by the card-recovery sweep.
//
// Context: at a live restart the DB timestamps made it LOOK like an accepted
// row was auto-claimed 2ms after start ("legacy startup-recovery" hypothesis).
// Code archaeology found no such path (the pre-tap auto-enqueue lived in
// intake.accept() and was removed with the tap-gate change); the real cause was
// the cycle-scoped `now` stamping every write with cycle-START time. This suite
// pins the invariant mechanically anyway:
//   1. restart + many loop cycles + lease-scale time advances never move
//      accepted rows (with OR without a card_ref);
//   2. the cardless row still gets its recovered card (recovery ≠ progression);
//   3. the store's enqueue() REFUSES without the explicit confirmedByTap
//      acknowledgement, so any future "unstick accepted rows" helper fails
//      closed instead of silently bypassing the gate.
//
// Hermetic: NO pg, NO network (same harness as liveRunner.test.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createLiveRunner } from '../src/live/liveRunner.js';
import { loadConfig } from '../src/config.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = '424242';
// Obviously-fake token: 3-digit prefix does NOT match the scanner's Telegram
// VALUE pattern (needs 6+ digits) — safe to keep as a literal inside a test.
const FAKE_TOKEN = '123:AA-FAKE-not-a-real-token';

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, advance: (d) => { t += d; } };
}

function liveEnv(brainDir) {
  return {
    DATABASE_URL: 'postgresql://postgres:sUpErSeCrEtDbPw@localhost:5432/db?sslmode=verify-full&sslrootcert=/fake/ca.pem',
    TELEGRAM_BOT_TOKEN: FAKE_TOKEN,
    AUTHORISED_TELEGRAM_USER_ID: AUTH_ID,
    WORKER_ID: 'worker-live',
    CAPTURE_BRAIN_DIR: brainDir,
  };
}

async function makeRunner(brainDir, { store, adapter, clock } = {}) {
  const config = loadConfig(liveEnv(brainDir));
  assert.equal(config.fixturesMode, false);
  return createLiveRunner(config, {
    clock,
    leaseMs: 30_000,
    factories: { storeFactory: async () => store, adapterFactory: async () => adapter },
  });
}

function tap(updateId, cardRef, { action = 'SaveToBrain', cbId = `cb-${updateId}` } = {}) {
  return {
    update_id: updateId,
    callback_query: {
      id: cbId, from: { id: AUTH_ID }, data: action,
      message: { message_id: cardRef.message_id, chat: { id: cardRef.chat_id } },
    },
  };
}

function acceptedRow(store, id, now) {
  store.recordIntake(
    {
      idempotency_key: `k-${id}`,
      capture_id: id,
      source_channel: 'telegram',
      sender_identity_ref: `telegram:user:${AUTH_ID}`,
      recorded_intent: 'SaveToBrain',
      technical_source_type: 'text',
      text_preview: `pending ${id}`,
    },
    { now },
  );
}

function tmpBrain() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-tapgate-'));
}

test('RESTART + N loop cycles: accepted rows (with AND without card_ref) are NEVER auto-progressed; the cardless one gets a card; zero markdown', async () => {
  const brainDir = tmpBrain();
  try {
    // "Restart": the durable store predates the runner — rows were left behind
    // by a previous worker life.
    const store = createInMemoryOperationalStore();
    const T0 = 20_000_000;
    // (a) accepted WITH a durable card_ref — card delivered, human never tapped.
    acceptedRow(store, 'cap_carded', T0);
    store.recordCardRef('cap_carded', { chat_id: AUTH_ID, message_id: 777 }, { now: T0 + 1 });
    // (b) accepted with NULL card_ref — the live "Test new" shape (initial card
    //     send died on the NAT-killed socket).
    acceptedRow(store, 'cap_cardless', T0 + 2);

    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const clock = fixedClock(T0 + 10_000);
    const runner = await makeRunner(brainDir, { store, adapter, clock });

    // N idle loop cycles, each followed by a time jump well past the 30s worker
    // lease AND past any due-retry horizon — startup, drain, lease reclaim and
    // the recovery sweep all get every chance to misbehave.
    const rounds = [];
    for (let i = 0; i < 6; i += 1) {
      rounds.push(await runner.pollOnce());
      clock.advance(120_000);
    }

    const carded = store.getByCaptureId('cap_carded');
    const cardless = store.getByCaptureId('cap_cardless');

    // THE INVARIANT: both are STILL accepted. Nothing claimed, nothing written.
    assert.equal(carded.state, STATES.ACCEPTED, '(a) accepted+card_ref is still awaiting the tap');
    assert.equal(cardless.state, STATES.ACCEPTED, '(b) accepted+recovered-card is still awaiting the tap');
    assert.equal(carded.attempt_count, 0, '(a) never claimed');
    assert.equal(cardless.attempt_count, 0, '(b) never claimed');
    assert.ok(rounds.every((r) => r.processed === 0), 'no drain cycle ever processed a pending capture');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 0, 'NO markdown was written for either');

    // Recovery did its job WITHOUT progressing state: (b) got exactly one card,
    // (a)'s original card target is untouched.
    assert.ok(cardless.card_ref && cardless.card_ref.message_id !== undefined, '(b) got a recovered card');
    assert.deepEqual(carded.card_ref, { chat_id: AUTH_ID, message_id: 777 }, "(a)'s card_ref unchanged — never re-sent");
    const sends = adapter.sentCards.filter((c) => c.op === 'send');
    assert.deepEqual(sends.map((c) => c.captureId), ['cap_cardless'], 'exactly one recovered card, for (b) only');

    // The gate still opens the RIGHT way: a real tap on (b) completes it while
    // (a) — untapped — keeps holding.
    adapter.deliver(tap(1, cardless.card_ref));
    await runner.runUntilIdle();
    assert.equal(store.getByCaptureId('cap_cardless').state, STATES.COMPLETED, 'tap → saga → completed');
    assert.equal(store.getByCaptureId('cap_carded').state, STATES.ACCEPTED, 'the untapped capture STILL holds');
    assert.equal(runner.runtime.markdownWriter.writeCount(), 1, 'exactly the tapped capture was written');
    await runner.shutdown();
  } finally {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

test('store.enqueue is fail-closed: without the confirmedByTap acknowledgement it throws and the row stays accepted', () => {
  const store = createInMemoryOperationalStore();
  acceptedRow(store, 'cap_gate', 1_000);

  // Any legacy/future "unstick accepted rows" helper that calls enqueue without
  // acting on a user tap dies HERE — fail-closed, state untouched.
  assert.throws(
    () => store.enqueue('cap_gate', { now: 1_001 }),
    /tap-gate violation/,
    'enqueue without the tap acknowledgement is refused',
  );
  assert.throws(() => store.enqueue('cap_gate', { now: 1_002, confirmedByTap: false }), /tap-gate violation/);
  assert.equal(store.getByCaptureId('cap_gate').state, STATES.ACCEPTED, 'refusal left the state untouched');

  // The one legal caller shape (intake.confirmSave) still works.
  const rec = store.enqueue('cap_gate', { now: 1_003, confirmedByTap: true });
  assert.equal(rec.state, STATES.QUEUED, 'the acknowledged tap path still enqueues');
});
