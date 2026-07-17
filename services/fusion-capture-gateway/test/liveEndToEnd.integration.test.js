// LIVE end-to-end saga against REAL Postgres — the strongest proof short of the
// actual Telegram bot + Warwick's phone.
//
// GATED: every test is `{ skip: !DB }`, so the default unit run (node --test with
// NO DATABASE_URL) skips this file cleanly and NEVER loads `pg` or opens a
// socket. `pg` is imported DYNAMICALLY (inside the store factory + the reset
// helper), never at module top-level.
//
// This proves the ASYNC-UNIFIED intake + worker actually drive Silas's async
// Postgres store: one code path, awaited end-to-end. It assembles the REAL
// components — Postgres operational store + real sandbox markdownWriter (temp
// dir) + mock Telegram adapter (NO bot token) — and runs a full capture saga,
// plus the offline-safe and dead-letter paths, all against real Postgres.
//
// RUN:
//   PATH=/usr/lib/postgresql/16/bin:$PATH psql -h 127.0.0.1 -p 55432 -U postgres \
//     -c "drop database if exists fcg_dev; create database fcg_dev;"
//   cd services/fusion-capture-gateway
//   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/fcg_dev \
//     node --test test/liveEndToEnd.integration.test.js

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresOperationalStore } from '../src/store/postgresOperationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createIntake } from '../src/intake.js';
import { createWorker } from '../src/worker.js';
import { createLiveRunner } from '../src/live/liveRunner.js';
import { createAccessLogger } from '../src/security/accessLog.js';
import { STATES, MAX_DELIVERY_ATTEMPTS } from '../src/core/states.js';
import { MAX_BACKOFF_MS } from '../src/core/retryPolicy.js';

const DB = process.env.DATABASE_URL;
const AUTH_ID = 424242;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_operational_baseline.sql',
  '0002_wp0_deletion_and_retention.sql',
  '0003_wp0_rls_policies.sql',
  '0004_wp0_retry_retention_indexes.sql',
  '0005_wp0_card_target_and_poll_offset.sql',
  '0006_wp1_cloud_intake_rpcs.sql',
];
const ADVANCE_PAST_ANY_BACKOFF_MS = MAX_BACKOFF_MS + 1;

// ISOLATION: this file provisions its OWN dedicated database ("<db>_e2e") so it
// never collides with the postgresStore integration file's per-test resets of
// the shared `fcg` schema. That keeps plain `node --test` (which runs test files
// in PARALLEL) green without touching Silas's integration test or the migrations,
// and without needing --test-concurrency=1.
function e2eDbUrls(base) {
  const dbName = `${new URL(base).pathname.replace(/^\//, '')}_e2e`;
  const e2e = new URL(base); e2e.pathname = `/${dbName}`;
  const maint = new URL(base); maint.pathname = '/postgres'; // maintenance DB for drop/create
  return { e2e: e2e.toString(), maint: maint.toString(), dbName };
}
const URLS = DB ? e2eDbUrls(DB) : null;
const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

// Drop+create the isolated e2e database, then apply all migrations into it.
// `pg` is loaded DYNAMICALLY here — never at module top-level.
async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;

  // 1. Maintenance connection: recreate the dedicated e2e database from empty.
  const admin = new Pool({ connectionString: URLS.maint });
  try {
    await admin.query(`drop database if exists ${quoteIdent(URLS.dbName)} with (force)`);
    await admin.query(`create database ${quoteIdent(URLS.dbName)}`);
  } finally {
    await admin.end();
  }

  // 2. Apply migrations into the isolated e2e database.
  const pool = new Pool({ connectionString: URLS.e2e });
  try {
    for (const file of MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

// Assemble the REAL live-shaped pipeline against Postgres (mock adapter, no token).
async function harness({ isWorkerOnline } = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-e2e-'));
  const store = await createPostgresOperationalStore({ connectionString: URLS.e2e });
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const markdownWriter = createSandboxMarkdownWriter({ baseDir });
  const clock = fixedClock(1_752_600_000_000);
  const records = [];
  const accessLog = createAccessLogger({ sink: (r) => records.push(r) });
  const intake = createIntake({ store, adapter, clock, isWorkerOnline });
  const worker = createWorker({
    store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 60_000, accessLog,
  });
  return { baseDir, store, adapter, markdownWriter, clock, intake, worker, records };
}

function update(messageId, text, fromId = AUTH_ID) {
  return { message: { message_id: messageId, from: { id: fromId }, chat: { id: fromId, type: 'private' }, text } };
}

before(async () => { if (DB) await resetAndMigrate(); });

test('full saga vs real Postgres: update → durable row → note on disk → evidence rows → completed', { skip: !DB }, async () => {
  const h = await harness();
  try {
    // 1. Intake → durable row in Postgres (the commit point).
    const accepted = await h.intake.accept(update(90001, 'live e2e: aquaponics pH log'));
    assert.equal(accepted.ok, true);
    assert.equal(accepted.isNew, true);
    const captureId = accepted.captureId;

    const afterIntake = await h.store.getByCaptureId(captureId);
    assert.ok(afterIntake, 'a durable Postgres row exists after intake');
    assert.equal(afterIntake.state, STATES.ACCEPTED, 'tap-gated intake holds the item pending in Postgres');

    // 1b. The user taps "Save to Brain" → the capture is queued for the worker.
    const confirmed = await h.intake.confirmSave(captureId);
    assert.equal(confirmed.outcome, 'queued');

    // 2. Worker drives the saga end-to-end against real Postgres.
    h.clock.advance(1000);
    const final = await h.worker.processOne({ now: h.clock.now() });
    assert.ok(final, 'worker claimed + processed a real Postgres item');
    assert.equal(final.state, STATES.COMPLETED);

    // 3. A REAL Markdown note exists on disk.
    const notePath = final.destination_ref.path;
    assert.ok(fs.existsSync(notePath), 'the governed Markdown note exists on disk');
    assert.match(fs.readFileSync(notePath, 'utf8'), /aquaponics pH log/);
    assert.equal(h.markdownWriter.writeCount(), 1, 'exactly one governed write');

    // 4. Evidence + destination pointers are persisted IN Postgres, completion gated.
    const rec = await h.store.getByCaptureId(captureId);
    assert.equal(rec.state, STATES.COMPLETED);
    assert.equal(rec.evidence_pointers.length, 1, 'one evidence row in Postgres');
    assert.equal(rec.evidence_pointers[0].evidence_kind, 'markdown_write');
    assert.ok(rec.destination_ref && rec.destination_ref.path, 'destination pointer persisted');

    // 5. Card shows Completed; F-05 capture_write logged (secret-free).
    const editCards = h.adapter.sentCards.filter((c) => c.op === 'edit');
    assert.equal(editCards.length, 1);
    assert.equal(editCards[0].cardModel.is_completed, true);
    const writeLogs = h.records.filter((r) => r.event === 'capture_write' && r.capture_id === captureId);
    assert.equal(writeLogs.length, 1);
    assert.ok(!JSON.stringify(writeLogs[0]).includes('aquaponics pH log'), 'payload never logged');
  } finally {
    await h.store.end();
    fs.rmSync(h.baseDir, { recursive: true, force: true });
  }
});

test('live RUNNER vs real Postgres: long-poll → capture → completed; offset + card_ref durable across a restart', { skip: !DB }, async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-e2e-runner-'));
  const clock = fixedClock(1_752_600_500_000);
  // A live-mode config; the runner reaches the REAL Postgres store via the
  // injected factory (no pg import path change) and a mock adapter (no token).
  const store = await createPostgresOperationalStore({ connectionString: URLS.e2e });
  const liveConfig = {
    fixturesMode: false,
    missingRequired: [],
    databaseUrl: URLS.e2e,
    telegramBotToken: '123456:FAKE-e2e-token',
    authorisedTelegramUserId: String(AUTH_ID),
    workerId: 'worker-runner',
    captureBrainDir: baseDir,
    captureSandboxDir: null,
    supabaseSecretKey: null,
    telegramWebhookSecret: null,
    describe: () => ({ DATABASE_URL: '***set (masked)***' }),
  };
  const adapter1 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  try {
    const runner = await createLiveRunner(liveConfig, {
      clock,
      leaseMs: 60_000,
      factories: { storeFactory: async () => store, adapterFactory: async () => adapter1 },
    });

    adapter1.deliver({ update_id: 7, message: { message_id: 91001, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text: 'runner e2e: solar log' } });
    await runner.runUntilIdle();

    // TAP-GATED: the capture holds pending in REAL Postgres until the tap.
    // (This file's e2e DB is shared across its tests, so select MY capture by
    // content, not [0].)
    const mine = (await store.list()).find((r) => r.text_preview && r.text_preview.includes('solar log'));
    assert.ok(mine, 'the runner-captured row exists in Postgres');
    assert.equal(mine.state, STATES.ACCEPTED, 'pending until the user taps');
    assert.ok(mine.card_ref && mine.card_ref.message_id !== undefined, 'card_ref persisted in Postgres (§4)');
    const originalMessageId = mine.card_ref.message_id;

    // The user taps "Save to Brain" on the card → the saga completes.
    adapter1.deliver({
      update_id: 8,
      callback_query: {
        id: 'cb-e2e-1', from: { id: AUTH_ID }, data: 'SaveToBrain',
        message: { message_id: originalMessageId, chat: { id: mine.card_ref.chat_id, type: 'private' } },
      },
    });
    await runner.runUntilIdle();

    const rec = await store.getByCaptureId(mine.capture_id);
    assert.equal(rec.state, STATES.COMPLETED);
    assert.ok(fs.existsSync(rec.destination_ref.path));
    assert.ok(rec.destination_ref.path.includes(`${path.sep}captures${path.sep}`), 'lands in the governed captures leaf');

    // Offset advanced past BOTH updates AND persisted in Postgres.
    assert.equal(runner.offset, 9, 'offset advanced to last update_id+1');
    assert.equal(await store.getPollOffset('telegram'), 9, 'offset durable in Postgres');

    // RESTART: a fresh adapter (empty in-memory map) + a fresh runner over the
    // SAME Postgres store. Re-project the completed card — it must re-target the
    // ORIGINAL message id recovered purely from the durable card_ref.
    const adapter2 = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const runner2 = await createLiveRunner(liveConfig, {
      clock,
      leaseMs: 60_000,
      factories: { storeFactory: async () => store, adapterFactory: async () => adapter2 },
    });
    // A restarted runner resumes from the durable offset — no re-fetch of acked updates.
    assert.equal(runner2.offset, 9, 'restart resumes from the durable Postgres offset');
    const entry = await runner2.reprojectCard(rec.capture_id);
    assert.equal(entry.messageId, originalMessageId, 'restart re-targets the ORIGINAL card from Postgres card_ref');
    assert.equal(entry.cardModel.is_completed, true);
  } finally {
    await store.end();
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('offline-safe vs real Postgres: worker down → offline_queued (durable) → later completes', { skip: !DB }, async () => {
  let online = false;
  const h = await harness({ isWorkerOnline: () => online });
  try {
    const accepted = await h.intake.accept(update(90002, 'captured while the worker was offline'));
    assert.equal(accepted.ok, true);
    const captureId = accepted.captureId;
    assert.equal(accepted.receipt.safe_and_waiting, true);

    // The user taps while the worker is offline: durable + offline-queued +
    // never falsely completed.
    const confirmed = await h.intake.confirmSave(captureId);
    assert.equal(confirmed.outcome, 'queued');
    const offlineRec = await h.store.getByCaptureId(captureId);
    assert.equal(offlineRec.state, STATES.OFFLINE_QUEUED, 'offline tap is durable + offline_queued in Postgres');
    assert.notEqual(offlineRec.state, STATES.COMPLETED);

    // Worker comes online and completes it against real Postgres.
    online = true;
    h.clock.advance(1000);
    const final = await h.worker.processOne({ now: h.clock.now() });
    assert.equal(final.state, STATES.COMPLETED);
    assert.ok(fs.existsSync(final.destination_ref.path));
    assert.equal(h.markdownWriter.writeCount(), 1);
  } finally {
    await h.store.end();
    fs.rmSync(h.baseDir, { recursive: true, force: true });
  }
});

test('dead-letter vs real Postgres: repeated write failure burns attempts → dead_letter, never completed', { skip: !DB }, async () => {
  const h = await harness();
  try {
    const accepted = await h.intake.accept(update(90003, 'dead-letter me if I keep failing'));
    const captureId = accepted.captureId;
    await h.intake.confirmSave(captureId); // the user taps Save to Brain

    // Fail the governed write on EVERY attempt up to the cap.
    h.markdownWriter.failNextWrite(MAX_DELIVERY_ATTEMPTS);

    for (let attempt = 1; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      h.clock.advance(1000);
      const rec = await h.worker.processOne({ now: h.clock.now() });
      assert.equal(rec.state, STATES.FAILED, `attempt ${attempt} fails honestly, not completed`);
      assert.equal(rec.attempt_count, attempt);
      // Not-yet-due: the real claim() path refuses to reclaim early.
      const tooSoon = await h.worker.processOne({ now: h.clock.now() });
      assert.equal(tooSoon, null, 'a not-yet-due failed item is not reclaimed early');
      h.clock.advance(ADVANCE_PAST_ANY_BACKOFF_MS);
    }

    // Final attempt hits the cap → dead-lettered in Postgres.
    const dead = await h.worker.processOne({ now: h.clock.now() });
    assert.equal(dead.attempt_count, MAX_DELIVERY_ATTEMPTS);
    assert.equal(dead.state, STATES.DEAD_LETTER, 'exhausted attempts park in dead_letter');
    assert.notEqual(dead.state, STATES.COMPLETED);

    // Terminal + never reclaimed again; no note leaked, no false completion.
    h.clock.advance(ADVANCE_PAST_ANY_BACKOFF_MS);
    assert.equal(await h.worker.processOne({ now: h.clock.now() }), null, 'dead_letter is never reclaimed');
    assert.equal(h.markdownWriter.writeCount(), 0, 'no governed write ever landed on disk');
    const finalRec = await h.store.getByCaptureId(captureId);
    assert.equal(finalRec.state, STATES.DEAD_LETTER);
    const completedCards = h.adapter.sentCards.filter((c) => c.cardModel && c.cardModel.is_completed);
    assert.equal(completedCards.length, 0, 'no card ever falsely claimed completion');
  } finally {
    await h.store.end();
    fs.rmSync(h.baseDir, { recursive: true, force: true });
  }
});
