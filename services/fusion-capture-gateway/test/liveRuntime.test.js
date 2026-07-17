// F-09 live runtime — fixtures/live selection, config validation, identity
// ownership. Hermetic: NO pg, NO DB, NO network. The live branch is only ever
// exercised via injected factory doubles (never a real connection).

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import {
  selectStoreAndAdapter,
  assertLiveConfig,
  buildAuthorisedIdentity,
  ensureAuthorisedIdentity,
  createLiveRuntime,
} from '../src/live/runtime.js';
import { loadConfig } from '../src/config.js';
import { STATES } from '../src/core/states.js';

test('selectStoreAndAdapter returns the FIXTURES pair in fixtures mode (no pg/network)', async () => {
  const config = loadConfig({}); // empty env → fixturesMode true
  assert.equal(config.fixturesMode, true);
  const { mode, store, adapter } = await selectStoreAndAdapter(config);
  assert.equal(mode, 'fixtures');
  // In-memory store surface (list()) + mock adapter surface (sentCards).
  assert.equal(typeof store.recordIntake, 'function');
  assert.deepEqual(store.list(), []);
  assert.ok(Array.isArray(adapter.sentCards), 'mock adapter, not the live one');
});

test('assertLiveConfig rejects missing required env NAMES with NO secret values printed', () => {
  const badConfig = {
    fixturesMode: false,
    missingRequired: ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN'],
    databaseUrl: null,
    telegramBotToken: null,
  };
  assert.throws(
    () => assertLiveConfig(badConfig),
    (err) => {
      assert.ok(/DATABASE_URL/.test(err.message));
      assert.ok(/TELEGRAM_BOT_TOKEN/.test(err.message));
      assert.ok(/NAME/i.test(err.message), 'error is about NAMES');
      return true;
    },
  );
});

test('selectStoreAndAdapter in live mode fails closed on missing NAMES before any connection', async () => {
  const badConfig = { fixturesMode: false, missingRequired: ['DATABASE_URL'] };
  await assert.rejects(() => selectStoreAndAdapter(badConfig), /missing required env NAME/);
});

test('selectStoreAndAdapter live mode uses INJECTED factories (no real pg/adapter)', async () => {
  const goodConfig = {
    fixturesMode: false,
    missingRequired: [],
    databaseUrl: 'postgresql://user@localhost:5432/db?sslmode=require',
    telegramBotToken: '123:AA-FAKE-not-a-real-token',
    authorisedTelegramUserId: '424242',
    workerId: 'w1',
  };
  const seen = {};
  const { mode, store, adapter } = await selectStoreAndAdapter(goodConfig, {
    storeFactory: async ({ connectionString }) => { seen.conn = connectionString; return { kind: 'fake-store' }; },
    adapterFactory: async ({ botToken, authorisedUserId }) => { seen.bot = botToken; seen.uid = authorisedUserId; return { kind: 'fake-adapter' }; },
  });
  assert.equal(mode, 'live');
  assert.equal(store.kind, 'fake-store');
  assert.equal(adapter.kind, 'fake-adapter');
  assert.ok(seen.conn.includes('sslmode=require'), 'TLS-required connection string is passed through');
  assert.equal(seen.uid, '424242');
});

test('buildAuthorisedIdentity yields the expected channel-identity descriptor', () => {
  const id = buildAuthorisedIdentity(424242);
  assert.deepEqual(id, {
    identity_ref: 'telegram:user:424242',
    channel: 'telegram',
    channel_principal_ref: '424242',
    is_authorised: true,
  });
  assert.throws(() => buildAuthorisedIdentity(''), /authorisedUserId required/);
});

test('ensureAuthorisedIdentity: runtime owns registration; uses an injected store stub', async () => {
  const calls = [];
  const store = { registerChannelIdentity: async (id) => calls.push(id) };
  const res = await ensureAuthorisedIdentity({ store, authorisedUserId: 424242 });
  assert.equal(res.registered, true);
  assert.equal(res.ownedBy, 'runtime');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].identity_ref, 'telegram:user:424242');

  // A store WITHOUT the method (in-memory fixture / stopgap self-registration)
  // is a no-throw no-op — ownership is still asserted to be the runtime.
  const noop = await ensureAuthorisedIdentity({ store: {}, authorisedUserId: 424242 });
  assert.equal(noop.registered, false);
  assert.equal(noop.ownedBy, 'runtime');
});

test('createLiveRuntime assembles a working fixtures pipeline end-to-end', async () => {
  const brainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-runtime-'));
  const config = loadConfig({ AUTHORISED_TELEGRAM_USER_ID: '424242', CAPTURE_BRAIN_DIR: brainDir });
  const records = [];
  let t = 4_000_000;
  const rt = await createLiveRuntime(config, {
    clock: { now: () => t },
    leaseMs: 1000,
    accessSink: (r) => records.push(r),
  });
  assert.equal(rt.mode, 'fixtures');
  assert.equal(rt.authorisedIdentity.identity.identity_ref, 'telegram:user:424242');

  const accepted = await rt.intake.accept({ message: { message_id: 1, from: { id: 424242 }, text: 'runtime wire test' } });
  assert.equal(accepted.ok, true);
  await rt.intake.confirmSave(accepted.captureId); // the user taps Save to Brain
  const final = await rt.worker.processOne({ now: t });
  assert.equal(final.state, STATES.COMPLETED);

  // F-05 capture_write was logged through the assembled runtime.
  assert.ok(records.some((r) => r.event === 'capture_write' && r.capture_id === accepted.captureId));
  await rt.shutdown();
});
