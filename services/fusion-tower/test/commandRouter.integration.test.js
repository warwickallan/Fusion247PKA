// REAL Postgres integration suite for the governance command router (BUILD-010 WP1).
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test with NO
// DATABASE_URL) skips this file cleanly and never loads `pg`. Proves each command
// drives the right ftw mutation AND enqueues the right [TOWER] reply row through the
// real store (chain 0001 -> 0005), that /approve advances the gate without any merge/
// external-write, and that an unauthorised sender mutates and replies NOTHING.
//
// RUN (throwaway local cluster):
//   cd services/fusion-tower
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54341/ftw_dev \
//     node --test --test-concurrency=1 test/commandRouter.integration.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresStore } from '../src/store/postgresStore.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import { handleCommandEvent } from '../src/core/commandRouter.js';
import { RUN_STATUS } from '../src/core/states.js';

const DB = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql',
  '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql',
  '0004_wp1_notification_outbox.sql',
  '0005_wp1_run_control_state.sql',
  '0006_wp1_notification_cards.sql',
];

const CHAT = '123456789';
const ALLOW = [CHAT];

async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    for (const file of MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}

async function freshStore() {
  await resetAndMigrate();
  return createPostgresStore({ connectionString: DB });
}

function notifier() {
  return createTelegramNotifier({ config: { authorisedTelegramUserId: CHAT } });
}

async function seedRun(store, over = {}) {
  return store.createRun({ title: 'BUILD-010 WP1', scope: 'wp1', maxRounds: 2, ...over }, { now: 1000 });
}

// Persist the command run_event exactly as WP2 writes it, then return the mapped row.
async function writeCommand(store, name, { updateId, args = [], sender = CHAT, runId = null } = {}) {
  const { event } = await store.ingestEvent({
    source: 'telegram',
    sourceEventId: String(updateId),
    kind: `command:${name}`,
    runId,
    payload: { command: `/${name}`, args, chat_id: CHAT, sender_id: sender, ts: 1 },
  }, { now: 10 });
  return event;
}

test('IPG-1 /pause — persists paused=true in ftw.governance_run AND enqueues a pending [TOWER] reply', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const ev = await writeCommand(store, 'pause', { updateId: 'ipg-1' });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.equal(res.mutation, 'setRunPaused(true)');
    assert.equal((await store.getRun(run.run_id)).paused, true);
    const n = await store.getNotification(res.reply.dedupKey);
    assert.equal(n.state, 'pending');
    assert.equal(n.logical_source, 'TOWER');
    assert.equal(n.recipient, CHAT);
  } finally { await store.end(); }
});

test('IPG-2 /watch on — persists watch_level=all through the ::ftw.watch_level cast', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const ev = await writeCommand(store, 'watch', { updateId: 'ipg-2', args: ['on'] });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.equal(res.mutation, 'setRunWatchLevel(all)');
    assert.equal((await store.getRun(run.run_id)).watch_level, 'all');
  } finally { await store.end(); }
});

test('IPG-3 /stop — persists stop_requested=true + stamped stop_requested_at', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const ev = await writeCommand(store, 'stop', { updateId: 'ipg-3' });
    await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    const r = await store.getRun(run.run_id);
    assert.equal(r.stop_requested, true);
    assert.ok(r.stop_requested_at);
  } finally { await store.end(); }
});

test('IPG-4 /status — reply body composed from the real getRunStatus projection', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store, {
      evidencePrRef: 'acme/widgets#7', evidenceCommitSha: 'deadbeefcafe', evidenceTaskRef: 'CU-869',
    });
    const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 1 }, { now: 11 });
    await store.setCurrentTurn(run.run_id, turn.turn_id, { now: 12 });
    const ev = await writeCommand(store, 'status', { updateId: 'ipg-4', runId: run.run_id });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.equal(res.runId, run.run_id);
    assert.match(res.reply.body, new RegExp(run.run_id));
    assert.match(res.reply.body, /expected responder: gpt_codex/);
    assert.match(res.reply.body, /head: deadbeef/);
    assert.match(res.reply.body, /pull\/7/);
    // The reply is durable + pending in the real outbox.
    assert.equal((await store.getNotification(res.reply.dedupKey)).state, 'pending');
  } finally { await store.end(); }
});

test('IPG-5 /trace — reply from real recentRunEvents, newest first', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store, { evidenceTaskRef: 'CU-42' });
    await store.ingestEvent({ source: 'github', sourceEventId: 'g1', kind: 'pull_request.opened', runId: run.run_id }, { now: 21 });
    await store.ingestEvent({ source: 'github', sourceEventId: 'g2', headSha: 'abc', kind: 'check_suite.completed', runId: run.run_id }, { now: 31 });
    const ev = await writeCommand(store, 'trace', { updateId: 'ipg-5', runId: run.run_id });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 40, allowlist: ALLOW });
    const b = res.reply.body;
    assert.ok(b.indexOf('check_suite.completed') < b.indexOf('pull_request.opened'), 'newest first');
    assert.match(b, /app\.clickup\.com\/t\/42/);
  } finally { await store.end(); }
});

test('IPG-6 /approve on awaiting_decision — advances the gate in SQL and NEVER writes a merge (no external_write row)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: 11 });
    await store.setRunStatus(run.run_id, RUN_STATUS.AWAITING_DECISION, { now: 12, decisionRequired: true });
    const ev = await writeCommand(store, 'approve', { updateId: 'ipg-6' });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.match(res.mutation, /advance_gate/);
    assert.equal(res.merge, false);
    const r = await store.getRun(run.run_id);
    assert.equal(r.status, RUN_STATUS.ACTIVE, 'gate advanced back to active');
    assert.equal(r.decision_required, false, 'decision cleared');
    assert.equal(r.no_autonomous_merge, true);
    // PROOF (no merge path): not a single external_write (merge/comment) row exists.
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      const { rows } = await pool.query('select count(*)::int as n from ftw.external_write');
      assert.equal(rows[0].n, 0, 'approve wrote NO external action — merging stays human-only');
    } finally { await pool.end(); }
  } finally { await store.end(); }
});

test('IPG-7 /approve on a non-pending run — replies "nothing pending", no mutation, no merge', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store); // 'created' — nothing pending
    const ev = await writeCommand(store, 'approve', { updateId: 'ipg-7' });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.equal(res.mutation, null);
    assert.equal(res.merge, false);
    assert.match(res.reply.body, /Nothing pending to approve/);
    assert.equal((await store.getRun(run.run_id)).status, RUN_STATUS.CREATED);
  } finally { await store.end(); }
});

test('IPG-8 unauthorised sender — ZERO mutation, ZERO reply row (silent default-deny, audited)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const run = await seedRun(store);
    const ev = await writeCommand(store, 'pause', { updateId: 'ipg-8', sender: '999' });
    const res = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    assert.equal(res.authorised, false);
    assert.equal(res.reason, 'unauthorised');
    assert.equal(res.reply, null);
    assert.equal((await store.getRun(run.run_id)).paused, false);
    assert.equal((await store.claimPendingNotifications(50)).length, 0, 'no reply row for a denied sender');
    // The command run_event row itself remains the durable audit.
    assert.ok(await store.getEvent(ev.event_id));
  } finally { await store.end(); }
});

test('IPG-9 redelivered command — reply dedups to ONE row (idempotent enqueue)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    await seedRun(store);
    const ev = await writeCommand(store, 'pause', { updateId: 'ipg-9' });
    const first = await handleCommandEvent(store, notifier(), ev, { now: 20, allowlist: ALLOW });
    const second = await handleCommandEvent(store, notifier(), ev, { now: 21, allowlist: ALLOW });
    assert.equal(first.reply.enqueued, true);
    assert.equal(second.reply.enqueued, false, 'second reply collides on the dedup key');
    assert.equal((await store.claimPendingNotifications(50)).length, 1, 'exactly one physical reply row');
  } finally { await store.end(); }
});
