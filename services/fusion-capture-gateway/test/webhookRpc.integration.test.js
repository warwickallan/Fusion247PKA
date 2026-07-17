// BUILD-002 WP1 — REAL-Postgres integration suite for migration 0006's RPC
// surface (test plan §2, P1–P12; drain-contract invariants I2/I3/I4/I9/I10).
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test,
// no DATABASE_URL) skips this file cleanly and never loads `pg`.
//
// ISOLATION: like the e2e file, this suite provisions its OWN database
// ("<db>_wp1") so parallel test files never collide — and the parallel
// CREATE ROLE DO-blocks across databases exercise 0003/0006's cluster-wide
// role-race guards for real.
//
// RUN:
//   cd services/fusion-capture-gateway
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
//     node --test test/webhookRpc.integration.test.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIdempotencyKey } from '../src/core/idempotency.js';
import { deriveCaptureId } from '../src/adapters/telegramMapping.js';
import { createPostgresOperationalStore } from '../src/store/postgresOperationalStore.js';
import { STATES } from '../src/core/states.js';

const DB = process.env.DATABASE_URL;
const AUTH_ID = '424242';
const AUTH_IDENTITY_REF = `telegram:user:${AUTH_ID}`;
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

function isolatedDbUrls(base, suffix) {
  const dbName = `${new URL(base).pathname.replace(/^\//, '')}_${suffix}`;
  const iso = new URL(base); iso.pathname = `/${dbName}`;
  const maint = new URL(base); maint.pathname = '/postgres';
  return { iso: iso.toString(), maint: maint.toString(), dbName };
}
const URLS = DB ? isolatedDbUrls(DB, 'wp1') : null;
const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

let pgPool = null; // shared pool over the isolated DB (created in before())

async function applyMigrations(pool) {
  for (const file of MIGRATIONS) {
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

async function recreateDb() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const admin = new Pool({ connectionString: URLS.maint });
  try {
    await admin.query(`drop database if exists ${quoteIdent(URLS.dbName)} with (force)`);
    await admin.query(`create database ${quoteIdent(URLS.dbName)}`);
  } finally {
    await admin.end();
  }
  const pool = new Pool({ connectionString: URLS.iso });
  await applyMigrations(pool);
  return pool;
}

// ── RPC bridges — invoked AS service_role (the only granted principal),
//    mirroring the PostgREST call the edge function makes.
async function asServiceRole(fn) {
  const client = await pgPool.connect();
  try {
    await client.query('set role service_role');
    return await fn(client);
  } finally {
    try { await client.query('reset role'); } catch { /* session poisoned */ }
    client.release();
  }
}

const INTAKE_SIG = '($1, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10::jsonb, $11::timestamptz)';

function keysFor(senderId, messageId, text) {
  const key = buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: `chat:${senderId}:msg:${messageId}`,
    raw_payload: text,
  });
  return { key, captureId: deriveCaptureId(key) };
}

async function rpcIntake(client, { updateId, senderId, messageId, text, channel = 'telegram' }) {
  const { key, captureId } = keysFor(senderId, messageId, text);
  const res = await client.query(
    `select public.fcg_webhook_intake${INTAKE_SIG} as r`,
    [channel, updateId, senderId, key, captureId, 'SaveToBrain', 'text',
      text, text.slice(0, 280), JSON.stringify({ chat_id: senderId, message_id: messageId }), null],
  );
  return { ...res.rows[0].r, derived_capture_id: captureId, derived_key: key };
}

async function rpcConfirmTap(client, { updateId, senderId, chatId, messageId, action = 'SaveToBrain', channel = 'telegram' }) {
  const res = await client.query(
    'select public.fcg_webhook_confirm_tap($1, $2, $3, $4, $5, $6) as r',
    [channel, updateId, senderId, String(chatId), String(messageId), action],
  );
  return res.rows[0].r;
}

async function rpcCardRef(client, { captureId, chatId, messageId }) {
  const res = await client.query(
    'select public.fcg_webhook_card_ref($1::uuid, $2, $3) as r',
    [captureId, String(chatId), String(messageId)],
  );
  return res.rows[0].r;
}

// Row-count fingerprint across every surface an unauthorised call could touch.
async function rowCounts() {
  const res = await pgPool.query(`
    select
      (select count(*) from fcg.capture_envelope)     as envelopes,
      (select count(*) from fcg.processing_state)     as states,
      (select count(*) from fcg.idempotency_key)      as keys,
      (select count(*) from fcg.channel_update_dedup) as ledger,
      (select count(*) from fcg.channel_identity)     as identities
  `);
  return res.rows[0];
}

async function seedAuthorisedIdentity() {
  // Deploy-time-seed shape (wp1-safe-cutover.md): identity_ref matches the poll
  // path's, channel_principal_ref is the BARE NUMERIC the RPC allowlist matches.
  await pgPool.query(
    `insert into fcg.channel_identity (identity_ref, channel, channel_principal_ref, is_authorised)
     values ($1, 'telegram', $2, true)
     on conflict (identity_ref) do update
       set channel_principal_ref = excluded.channel_principal_ref,
           is_authorised = excluded.is_authorised`,
    [AUTH_IDENTITY_REF, AUTH_ID],
  );
}

let nextUpdate = 100000;
let nextMessage = 50000;
const freshUpdateId = () => (nextUpdate += 1);
const freshMessageId = () => (nextMessage += 1);

before(async () => { if (DB) pgPool = await recreateDb(); });
after(async () => { if (pgPool) await pgPool.end(); });

// ── P1 — deterministic apply, twice, incl. re-run of the cluster-wide DO blocks.
test('P1: migrations 0001→0006 apply cleanly from empty, twice (role DO-blocks are re-run-safe)', { skip: !DB }, async () => {
  // before() already applied once into a fresh DB. Recreate + re-apply: the
  // cluster-wide roles (anon/authenticated/service_role/fcg_rpc_owner) now
  // pre-exist, so the guarded DO blocks must no-op instead of erroring.
  await pgPool.end();
  pgPool = await recreateDb();
  const fns = await pgPool.query(
    "select proname from pg_proc where proname like 'fcg_webhook_%' order by proname",
  );
  assert.deepEqual(
    fns.rows.map((r) => r.proname),
    ['fcg_webhook_card_ref', 'fcg_webhook_confirm_tap', 'fcg_webhook_intake'],
  );
  await seedAuthorisedIdentity();
});

// ── P2 — EXECUTE matrix.
test('P2 (I9): anon/authenticated cannot EXECUTE any fcg_webhook_* RPC; service_role can; PUBLIC holds no EXECUTE acl', { skip: !DB }, async () => {
  const args = { updateId: freshUpdateId(), senderId: '999000', messageId: freshMessageId(), text: 'denied' };
  for (const role of ['anon', 'authenticated']) {
    const client = await pgPool.connect();
    try {
      await client.query(`set role ${role}`);
      await assert.rejects(
        () => rpcIntake(client, args),
        /permission denied for function/,
        `${role} must not execute fcg_webhook_intake`,
      );
      await assert.rejects(
        () => rpcConfirmTap(client, { updateId: freshUpdateId(), senderId: '999000', chatId: '1', messageId: '1' }),
        /permission denied for function/,
        `${role} must not execute fcg_webhook_confirm_tap`,
      );
      await assert.rejects(
        () => rpcCardRef(client, { captureId: '00000000-0000-5000-8000-000000000000', chatId: '1', messageId: '1' }),
        /permission denied for function/,
        `${role} must not execute fcg_webhook_card_ref`,
      );
      await client.query('reset role');
    } finally {
      client.release();
    }
  }
  // service_role: executes (unauthorised outcome ≠ permission denied).
  const out = await asServiceRole((c) => rpcIntake(c, { ...args, updateId: freshUpdateId() }));
  assert.equal(out.outcome, 'unauthorised');
  // PUBLIC holds no EXECUTE: no empty-grantee ACL entry on any of the three.
  const acl = await pgPool.query(
    "select proname, coalesce(proacl::text, '') as acl from pg_proc where proname like 'fcg_webhook_%'",
  );
  assert.equal(acl.rows.length, 3);
  for (const row of acl.rows) {
    assert.ok(!/[{,]=/.test(row.acl), `${row.proname} must have no PUBLIC acl entry: ${row.acl}`);
    const perRole = await pgPool.query(
      "select has_function_privilege($1, p.oid, 'execute') as ok from pg_proc p where p.proname = $2",
      ['anon', row.proname],
    );
    assert.equal(perRole.rows[0].ok, false, `${row.proname}: anon has_function_privilege must be false`);
  }
});

// ── P3 — definer hardening.
test('P3: all three RPCs are SECURITY DEFINER, pin search_path, and are owned by fcg_rpc_owner (Vex gate)', { skip: !DB }, async () => {
  const res = await pgPool.query(`
    select p.proname, p.prosecdef, p.proconfig, r.rolname as owner
      from pg_proc p join pg_roles r on r.oid = p.proowner
     where p.proname like 'fcg_webhook_%' order by p.proname
  `);
  assert.equal(res.rows.length, 3);
  for (const row of res.rows) {
    assert.equal(row.prosecdef, true, `${row.proname} must be SECURITY DEFINER`);
    assert.ok((row.proconfig ?? []).some((c) => c.startsWith('search_path=')), `${row.proname} must pin search_path`);
    assert.equal(row.owner, 'fcg_rpc_owner', `${row.proname} must be owned by fcg_rpc_owner`);
  }
  // The transient CREATE-on-public grant was revoked again inside 0006.
  const createPriv = await pgPool.query(
    "select has_schema_privilege('fcg_rpc_owner', 'public', 'create') as ok",
  );
  assert.equal(createPriv.rows[0].ok, false, 'fcg_rpc_owner holds no standing CREATE on public');
});

// ── P4 — least-privilege definer role.
test('P4: fcg_rpc_owner cannot DELETE anywhere and cannot SELECT raw_object/evidence_pointer/channel_poll_offset', { skip: !DB }, async () => {
  const client = await pgPool.connect();
  try {
    await client.query('set role fcg_rpc_owner');
    for (const tbl of ['capture_envelope', 'processing_state', 'idempotency_key', 'channel_update_dedup', 'channel_identity']) {
      await assert.rejects(
        () => client.query(`delete from fcg.${tbl}`),
        /permission denied/,
        `fcg_rpc_owner must not DELETE from fcg.${tbl}`,
      );
    }
    for (const tbl of ['raw_object', 'evidence_pointer', 'channel_poll_offset']) {
      await assert.rejects(
        () => client.query(`select count(*) from fcg.${tbl}`),
        /permission denied/,
        `fcg_rpc_owner must not SELECT fcg.${tbl}`,
      );
    }
    await client.query('reset role');
  } finally {
    client.release();
  }
});

// ── P5 — cloud-side default-deny (I10).
test('P5 (I10): unauthorised sender leaves ZERO rows; is_authorised=false still refuses; the seeded row admits', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const beforeCounts = await rowCounts();

  // (a) unknown sender.
  let out = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: '31337', messageId: freshMessageId(), text: 'stranger message',
  }));
  assert.equal(out.outcome, 'unauthorised');
  assert.deepEqual(await rowCounts(), beforeCounts, 'not one row — not even a ledger entry (no stranger PII)');

  // (b) present but is_authorised = false.
  await pgPool.query(
    `insert into fcg.channel_identity (identity_ref, channel, channel_principal_ref, is_authorised)
     values ('telegram:user:555001', 'telegram', '555001', false) on conflict (identity_ref) do nothing`,
  );
  const withDisabled = await rowCounts();
  out = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: '555001', messageId: freshMessageId(), text: 'disabled sender',
  }));
  assert.equal(out.outcome, 'unauthorised');
  assert.deepEqual(await rowCounts(), withDisabled, 'a de-authorised identity writes nothing');

  // (c) the authorised seed → new, committed at accepted with webhook transport.
  out = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: AUTH_ID, messageId: freshMessageId(), text: 'first webhook capture',
  }));
  assert.equal(out.outcome, 'new');
  assert.equal(out.capture_id, out.derived_capture_id, 'RPC echoes the derived capture id');
  const row = await pgPool.query(
    `select ce.intake_transport, ce.sender_identity_ref, ps.state
       from fcg.capture_envelope ce join fcg.processing_state ps using (capture_id)
      where ce.capture_id = $1`,
    [out.capture_id],
  );
  assert.equal(row.rows[0].intake_transport, 'webhook');
  assert.equal(row.rows[0].sender_identity_ref, AUTH_IDENTITY_REF);
  assert.equal(row.rows[0].state, STATES.ACCEPTED, 'tap-gate hold — webhook intake NEVER enqueues');
});

// ── P6 — transport dedup (I3, I4).
test('P6 (I3/I4): the same (channel, update_id) ×5 → outcomes new + duplicate×4, ONE envelope, ONE ledger row; has_card_ref reflects reconciliation need', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const updateId = freshUpdateId();
  const messageId = freshMessageId();
  const args = { updateId, senderId: AUTH_ID, messageId, text: 'redelivered exactly once, hopefully' };

  const outcomes = [];
  let captureId;
  for (let i = 0; i < 5; i += 1) {
    const out = await asServiceRole((c) => rpcIntake(c, args));
    outcomes.push(out.outcome);
    captureId = captureId ?? out.capture_id;
    if (i > 0) {
      assert.equal(out.capture_id, captureId, 'every duplicate resolves to the SAME capture');
      assert.equal(out.has_card_ref, false, 'no card yet → the edge must reconcile');
    }
  }
  assert.deepEqual(outcomes, ['new', 'duplicate', 'duplicate', 'duplicate', 'duplicate']);

  const env = await pgPool.query('select count(*)::int as n from fcg.capture_envelope where capture_id = $1', [captureId]);
  assert.equal(env.rows[0].n, 1, 'exactly one envelope across five deliveries');
  const led = await pgPool.query(
    "select count(*)::int as n from fcg.channel_update_dedup where channel = 'telegram' and update_id = $1", [updateId],
  );
  assert.equal(led.rows[0].n, 1, 'exactly one ledger row (PK held)');

  // After the edge persists the card_ref, a further redelivery reports it.
  await asServiceRole((c) => rpcCardRef(c, { captureId, chatId: AUTH_ID, messageId: 777001 }));
  const out = await asServiceRole((c) => rpcIntake(c, args));
  assert.equal(out.outcome, 'duplicate');
  assert.equal(out.has_card_ref, true, 'reconciled card suppresses further re-sends');
});

// ── P7 — cross-transport dedup (layer 2).
test('P7: a poll-path capture (store.recordIntake) then the SAME message via webhook (new update_id) → existing, no second envelope, ledger linked', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const store = await createPostgresOperationalStore({ connectionString: URLS.iso });
  try {
    const messageId = freshMessageId();
    const text = 'crossover: seen by the poll runner first';
    const { key, captureId } = keysFor(AUTH_ID, messageId, text);
    const pollIn = await store.recordIntake({
      capture_id: captureId,
      idempotency_key: key,
      source_channel: 'telegram',
      sender_identity_ref: AUTH_IDENTITY_REF,
      channel_principal_ref: AUTH_ID,
      recorded_intent: 'SaveToBrain',
      technical_source_type: 'text',
      payload_text: text,
      text_preview: text,
    }, { now: 1_752_700_000_000 });
    assert.equal(pollIn.isNew, true);

    // Webhook redelivery of the same logical message under a DIFFERENT update_id.
    const webhookUpdate = freshUpdateId();
    const out = await asServiceRole((c) => rpcIntake(c, {
      updateId: webhookUpdate, senderId: AUTH_ID, messageId, text,
    }));
    assert.equal(out.outcome, 'existing');
    assert.equal(out.capture_id, captureId, 'layer-2 dedup resolves to the poll capture');

    const env = await pgPool.query('select count(*)::int as n from fcg.capture_envelope where capture_id = $1', [captureId]);
    assert.equal(env.rows[0].n, 1, 'no second envelope');
    const led = await pgPool.query(
      "select capture_id from fcg.channel_update_dedup where channel = 'telegram' and update_id = $1", [webhookUpdate],
    );
    assert.equal(led.rows[0].capture_id, captureId, 'ledger row linked to the existing capture');
    // Poll-origin row keeps its historically-correct transport marker.
    const tr = await pgPool.query('select intake_transport from fcg.capture_envelope where capture_id = $1', [captureId]);
    assert.equal(tr.rows[0].intake_transport, 'poll');
  } finally {
    await store.end();
  }
});

// ── P8 — durable backpressure.
test('P8: 21st accepted capture in the 60s window → rate_limited with no row; window advance readmits', { skip: !DB }, async () => {
  // Fresh DB section: recreate to get a clean rate window (prior tests inserted
  // envelopes for AUTH_ID with received_at = now()).
  await pgPool.end();
  pgPool = await recreateDb();
  await seedAuthorisedIdentity();

  for (let i = 0; i < 20; i += 1) {
    const out = await asServiceRole((c) => rpcIntake(c, {
      updateId: freshUpdateId(), senderId: AUTH_ID, messageId: freshMessageId(), text: `burst ${i}`,
    }));
    assert.equal(out.outcome, 'new', `burst item ${i} admitted`);
  }
  const beforeCounts = await rowCounts();
  const refused = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: AUTH_ID, messageId: freshMessageId(), text: 'burst 20 — one too many',
  }));
  assert.equal(refused.outcome, 'rate_limited');
  assert.deepEqual(await rowCounts(), beforeCounts, 'the refused capture wrote nothing (fail-closed before commit)');

  // Advance the window: age the existing envelopes (service_role-style direct
  // manipulation per the test plan — injected clocks don't reach DB now()).
  await pgPool.query("update fcg.capture_envelope set received_at = received_at - interval '2 minutes'");
  const readmitted = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: AUTH_ID, messageId: freshMessageId(), text: 'after the window',
  }));
  assert.equal(readmitted.outcome, 'new', 'a fresh window admits again');
});

// ── P9 — confirm_tap state matrix (I2).
test('P9 (I2): confirm_tap transitions ONLY accepted→offline_queued; every other state is an honest no-op; ledger dedups the callback itself', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const store = await createPostgresOperationalStore({ connectionString: URLS.iso });
  try {
    // Helper: a webhook-accepted capture with a card_ref at known coordinates.
    async function acceptedWithCard() {
      const messageId = freshMessageId();
      const out = await asServiceRole((c) => rpcIntake(c, {
        updateId: freshUpdateId(), senderId: AUTH_ID, messageId, text: `tap matrix ${messageId}`,
      }));
      assert.equal(out.outcome, 'new');
      const cardMessageId = 800000 + messageId;
      await asServiceRole((c) => rpcCardRef(c, { captureId: out.capture_id, chatId: AUTH_ID, messageId: cardMessageId }));
      return { captureId: out.capture_id, cardMessageId };
    }
    const stateOf = async (captureId) => (await store.getByCaptureId(captureId)).state;

    // accepted → queued outcome, state offline_queued (THE gated hop).
    const a = await acceptedWithCard();
    const tapUpdateId = freshUpdateId();
    let res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: tapUpdateId, senderId: AUTH_ID, chatId: AUTH_ID, messageId: a.cardMessageId,
    }));
    assert.equal(res.outcome, 'queued');
    assert.equal(await stateOf(a.captureId), STATES.OFFLINE_QUEUED, 'the cloud always uses the offline-honest state');

    // Redelivered SAME callback update → duplicate_update, state untouched.
    res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: tapUpdateId, senderId: AUTH_ID, chatId: AUTH_ID, messageId: a.cardMessageId,
    }));
    assert.equal(res.outcome, 'duplicate_update');
    assert.equal(await stateOf(a.captureId), STATES.OFFLINE_QUEUED);

    // A SECOND tap (fresh update_id) on the now-offline_queued capture → no_op.
    res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: freshUpdateId(), senderId: AUTH_ID, chatId: AUTH_ID, messageId: a.cardMessageId,
    }));
    assert.equal(res.outcome, 'no_op');
    assert.equal(res.state, STATES.OFFLINE_QUEUED);

    // KeepRaw / AskLarry / unknown actions → unavailable_action, state untouched.
    const b = await acceptedWithCard();
    for (const action of ['KeepRaw', 'AskLarry', 'FormatDisk']) {
      res = await asServiceRole((c) => rpcConfirmTap(c, {
        updateId: freshUpdateId(), senderId: AUTH_ID, chatId: AUTH_ID, messageId: b.cardMessageId, action,
      }));
      assert.equal(res.outcome, 'unavailable_action', `${action} must not confirm`);
      assert.equal(await stateOf(b.captureId), STATES.ACCEPTED, `${action} left the capture pending`);
    }

    // Unknown card coordinates → not_found.
    res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: freshUpdateId(), senderId: AUTH_ID, chatId: AUTH_ID, messageId: 424242424,
    }));
    assert.equal(res.outcome, 'not_found');

    // Unauthorised tap → unauthorised AND no ledger row (allowlist precedes ledger).
    const strangerUpdate = freshUpdateId();
    res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: strangerUpdate, senderId: '31337', chatId: AUTH_ID, messageId: b.cardMessageId,
    }));
    assert.equal(res.outcome, 'unauthorised');
    const led = await pgPool.query(
      "select count(*)::int as n from fcg.channel_update_dedup where channel = 'telegram' and update_id = $1", [strangerUpdate],
    );
    assert.equal(led.rows[0].n, 0, 'a stranger tap leaves no ledger row');

    // in-flight states → no_op with state untouched. Setup FORCES the state
    // directly (as the DB owner): the matrix tests confirm_tap's response PER
    // STATE, not transition legality — the legal saga path is proven end-to-end
    // by webhookE2E.integration.test.js. (store.claim cannot be used for setup:
    // it claims the OLDEST claimable row, which is order-fragile here.)
    const forceState = (captureId, state) => pgPool.query(
      'update fcg.processing_state set state = $2::fcg.capture_processing_state, updated_at = now() where capture_id = $1',
      [captureId, state],
    );
    const c1 = await acceptedWithCard();
    for (const state of [STATES.QUEUED, STATES.OFFLINE_QUEUED, STATES.CLAIMED, STATES.WRITING, STATES.FAILED]) {
      await forceState(c1.captureId, state);
      res = await asServiceRole((c) => rpcConfirmTap(c, {
        updateId: freshUpdateId(), senderId: AUTH_ID, chatId: AUTH_ID, messageId: c1.cardMessageId,
      }));
      assert.equal(res.outcome, 'no_op', `${state} must be an honest no-op`);
      assert.equal(res.state, state, `${state} reported unchanged`);
      assert.equal(await stateOf(c1.captureId), state, `${state} left untouched by the tap`);
    }

    // completed → already_completed, state untouched.
    const d = await acceptedWithCard();
    await forceState(d.captureId, STATES.COMPLETED);
    res = await asServiceRole((c) => rpcConfirmTap(c, {
      updateId: freshUpdateId(), senderId: AUTH_ID, chatId: AUTH_ID, messageId: d.cardMessageId,
    }));
    assert.equal(res.outcome, 'already_completed');
    assert.equal(await stateOf(d.captureId), STATES.COMPLETED);
  } finally {
    await store.end();
  }
});

// ── P10 — card_ref persistence seam.
test('P10: fcg_webhook_card_ref persists the 0005 JSONB shape, overwrites idempotently, and reports not_found honestly', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const out = await asServiceRole((c) => rpcIntake(c, {
    updateId: freshUpdateId(), senderId: AUTH_ID, messageId: freshMessageId(), text: 'card ref target',
  }));
  assert.equal(out.outcome, 'new');

  let res = await asServiceRole((c) => rpcCardRef(c, { captureId: out.capture_id, chatId: AUTH_ID, messageId: 910001 }));
  assert.equal(res.outcome, 'ok');
  let row = await pgPool.query('select card_ref from fcg.processing_state where capture_id = $1', [out.capture_id]);
  assert.deepEqual(row.rows[0].card_ref, { chat_id: AUTH_ID, message_id: '910001' }, 'exact 0005 shape (string coordinates)');

  // Idempotent overwrite (reconciliation re-send may mint a new message id).
  res = await asServiceRole((c) => rpcCardRef(c, { captureId: out.capture_id, chatId: AUTH_ID, messageId: 910002 }));
  assert.equal(res.outcome, 'ok');
  row = await pgPool.query('select card_ref from fcg.processing_state where capture_id = $1', [out.capture_id]);
  assert.deepEqual(row.rows[0].card_ref, { chat_id: AUTH_ID, message_id: '910002' });

  // The worker-facing reverse lookup resolves the NEW coordinates.
  const store = await createPostgresOperationalStore({ connectionString: URLS.iso });
  try {
    assert.equal(await store.findCaptureIdByCard(AUTH_ID, 910002), out.capture_id);
  } finally {
    await store.end();
  }

  res = await asServiceRole((c) => rpcCardRef(c, { captureId: '00000000-0000-5000-8000-00000000dead', chatId: '1', messageId: '1' }));
  assert.equal(res.outcome, 'not_found');
});

// ── P11 — erasure interplay (GDPR + redelivery honesty).
test('P11: erasing a webhook capture nulls the ledger link; the freed idempotency key admits a NEW capture under a NEW update_id; the OLD update_id stays consumed', { skip: !DB }, async () => {
  await seedAuthorisedIdentity();
  const store = await createPostgresOperationalStore({ connectionString: URLS.iso });
  try {
    const messageId = freshMessageId();
    const text = 'erase me, then send me again';
    const firstUpdate = freshUpdateId();
    const first = await asServiceRole((c) => rpcIntake(c, {
      updateId: firstUpdate, senderId: AUTH_ID, messageId, text,
    }));
    assert.equal(first.outcome, 'new');

    const del = await store.deleteCapture(first.capture_id);
    assert.equal(del.deleted, true);

    // Ledger row SURVIVES with capture_id NULL — a number, no personal content.
    const led = await pgPool.query(
      "select capture_id from fcg.channel_update_dedup where channel = 'telegram' and update_id = $1", [firstUpdate],
    );
    assert.equal(led.rows.length, 1, 'the transport fact survives erasure');
    assert.equal(led.rows[0].capture_id, null, 'the personal link is severed (SET NULL)');

    // The OLD update_id redelivered → duplicate with no capture (erasure honoured,
    // no card resurrect — the edge treats null capture_id as nothing-to-do).
    const replayOld = await asServiceRole((c) => rpcIntake(c, {
      updateId: firstUpdate, senderId: AUTH_ID, messageId, text,
    }));
    assert.equal(replayOld.outcome, 'duplicate');
    assert.equal(replayOld.capture_id, null);

    // The SAME message re-sent (Telegram would mint a NEW update_id) → a
    // genuinely NEW capture: the idempotency key was freed by the cascade.
    const again = await asServiceRole((c) => rpcIntake(c, {
      updateId: freshUpdateId(), senderId: AUTH_ID, messageId, text,
    }));
    assert.equal(again.outcome, 'new');
    assert.equal(again.capture_id, first.derived_capture_id, 'deterministic id returns for the same logical message');
    const st = await store.getByCaptureId(again.capture_id);
    assert.equal(st.state, STATES.ACCEPTED);
  } finally {
    await store.end();
  }
});

// ── P12 — RLS posture regression for the new table.
test('P12: anon/authenticated are denied on channel_update_dedup; service_role passes (deny-by-default stands)', { skip: !DB }, async () => {
  const client = await pgPool.connect();
  try {
    for (const role of ['anon', 'authenticated']) {
      await client.query(`set role ${role}`);
      await assert.rejects(
        () => client.query('select count(*) from fcg.channel_update_dedup'),
        /permission denied/,
        `${role} must be denied on channel_update_dedup`,
      );
      await client.query('reset role');
    }
    await client.query('set role service_role');
    const res = await client.query('select count(*)::int as n from fcg.channel_update_dedup');
    assert.ok(res.rows[0].n >= 0, 'service_role reads the ledger');
    await client.query('reset role');
  } finally {
    client.release();
  }
});
