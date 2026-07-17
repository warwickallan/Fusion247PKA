// REAL Postgres integration suite for the BUILD-002 WP2 ftw command-intake writer.
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test with
// NO DATABASE_URL) skips this file cleanly and NEVER loads `pg` or touches a DB.
// `pg` is imported DYNAMICALLY inside helpers, never at module top-level.
//
// Proves the Postgres ftw writer inserts genuine ftw.run_event rows over the SAME
// service_role connection the operational store uses (store.query passthrough),
// with (source, source_event_id) dedup — against a real schema where BOTH the fcg
// migrations AND ftw 0001 have been applied so ftw.run_event actually exists.
//
// RUN (throwaway cluster):
//   cd services/fusion-capture-gateway
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54343/postgres \
//     node --test --test-concurrency=1 test/ftwCommandIntake.integration.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresOperationalStore } from '../src/store/postgresOperationalStore.js';
import { createPgFtwCommandIntake } from '../src/store/ftwCommandIntake.js';

const DB = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FCG_MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const FTW_MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'fusion-tower', 'migrations');

const FCG_MIGRATIONS = [
  '0001_wp0_operational_baseline.sql',
  '0002_wp0_deletion_and_retention.sql',
  '0003_wp0_rls_policies.sql',
  '0004_wp0_retry_retention_indexes.sql',
  '0005_wp0_card_target_and_poll_offset.sql',
  '0006_wp1_cloud_intake_rpcs.sql',
];
const FTW_MIGRATIONS = ['0001_wp0_control_plane.sql'];

// Drop fcg + ftw schemas and re-apply BOTH from empty. `pg` loaded dynamically.
async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    await pool.query('drop schema if exists fcg cascade');
    await pool.query('drop function if exists public.fcg_webhook_intake(text, bigint, text, text, uuid, text, text, text, text, jsonb, timestamptz)');
    await pool.query('drop function if exists public.fcg_webhook_confirm_tap(text, bigint, text, text, text, text)');
    await pool.query('drop function if exists public.fcg_webhook_card_ref(uuid, text, text)');
    for (const file of FCG_MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(FCG_MIGRATIONS_DIR, file), 'utf8'));
    }
    for (const file of FTW_MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(FTW_MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}

async function freshWriter() {
  await resetAndMigrate();
  const store = await createPostgresOperationalStore({ connectionString: DB });
  const writer = createPgFtwCommandIntake({ query: (t, p) => store.query(t, p) });
  return { store, writer };
}

test('0. both fcg AND ftw migrations apply cleanly; ftw.run_event exists', { skip: !DB }, async () => {
  await resetAndMigrate();
  const store = await createPostgresOperationalStore({ connectionString: DB });
  try {
    const res = await store.query(
      `select count(*)::int as n from information_schema.tables where table_schema = 'ftw' and table_name = 'run_event'`,
      [],
    );
    assert.equal(res.rows[0].n, 1, 'ftw.run_event table is present');
  } finally { await store.end(); }
});

test('1. a command event lands one ftw.run_event kind=command:<name>, self_generated=false', { skip: !DB }, async () => {
  const { store, writer } = await freshWriter();
  try {
    const { event, isNew } = await writer.recordCommandEvent({
      command: 'status', args: [], chatId: '424242', senderId: '424242', updateId: 1001, now: 1_700_000_000_000,
    });
    assert.equal(isNew, true);
    assert.ok(event.event_id, 'a real event_id was returned');

    const row = (await store.query(
      `select source::text, source_event_id, kind, payload, self_generated, run_id from ftw.run_event where source_event_id = $1`,
      ['1001'],
    )).rows[0];
    assert.equal(row.source, 'telegram');
    assert.equal(row.kind, 'command:status');
    assert.equal(row.source_event_id, '1001');
    assert.equal(row.self_generated, false);
    assert.equal(row.run_id, null, 'unbound until the Tower binds it');
    assert.equal(row.payload.command, 'status');
    assert.equal(row.payload.sender_id, '424242');
    assert.equal(row.payload.chat_id, '424242');
  } finally { await store.end(); }
});

test('2. dedup: the SAME update_id inserted twice yields ONE row, second isNew=false', { skip: !DB }, async () => {
  const { store, writer } = await freshWriter();
  try {
    const a = await writer.recordCommandEvent({ command: 'pause', args: [], chatId: '424242', senderId: '424242', updateId: 2002, now: 1 });
    const b = await writer.recordCommandEvent({ command: 'pause', args: [], chatId: '424242', senderId: '424242', updateId: 2002, now: 2 });
    assert.equal(a.isNew, true);
    assert.equal(b.isNew, false, 'ON CONFLICT (source, source_event_id) DO NOTHING → dedup');
    assert.equal(a.event.event_id, b.event.event_id, 'the dedup read returns the original row');
    const n = (await store.query(`select count(*)::int as n from ftw.run_event where source_event_id = $1`, ['2002'])).rows[0].n;
    assert.equal(n, 1, 'exactly one durable row despite the redelivery');
  } finally { await store.end(); }
});

test('3. a decision tap lands kind=command:decision, source_event_id=cb:<id>, full payload', { skip: !DB }, async () => {
  const { store, writer } = await freshWriter();
  try {
    const { isNew } = await writer.recordDecisionEvent({
      callbackData: 'dec:gate-abc:proceed', decision: 'proceed', gateToken: 'gate-abc',
      chatId: '424242', senderId: '424242', messageId: 5150, callbackId: 'cbq-xyz', now: 1_700_000_000_000,
    });
    assert.equal(isNew, true);
    const row = (await store.query(
      `select kind, source_event_id, payload, self_generated from ftw.run_event where source_event_id = $1`,
      ['cb:cbq-xyz'],
    )).rows[0];
    assert.equal(row.kind, 'command:decision');
    assert.equal(row.self_generated, false);
    assert.equal(row.payload.callback_data, 'dec:gate-abc:proceed');
    assert.equal(row.payload.decision, 'proceed');
    assert.equal(row.payload.gate_token, 'gate-abc');
    assert.equal(row.payload.message_id, '5150');
  } finally { await store.end(); }
});

test('4. the writer touches ONLY ftw.run_event (least privilege) — no fcg rows created', { skip: !DB }, async () => {
  const { store, writer } = await freshWriter();
  try {
    await writer.recordCommandEvent({ command: 'stop', args: [], chatId: '424242', senderId: '424242', updateId: 4004, now: 1 });
    const captures = (await store.query('select count(*)::int as n from fcg.capture_envelope', [])).rows[0].n;
    assert.equal(captures, 0, 'a governance command creates NO capture rows');
    const events = (await store.query('select count(*)::int as n from ftw.run_event', [])).rows[0].n;
    assert.equal(events, 1, 'exactly the one governance event');
  } finally { await store.end(); }
});
