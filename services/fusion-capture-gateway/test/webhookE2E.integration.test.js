// BUILD-002 WP1 — SYNTHETIC END-TO-END PROOF (test plan §3, E2E-1 … E2E-6).
//
// The strongest proof short of a live bot: synthetic SIGNED webhook POSTs are
// fed to the REAL pure edge handler (supabase/functions/fcg-webhook-intake/
// handler.js) whose rpc dependency is bridged to the REAL SECURITY DEFINER
// RPCs from migration 0006 (invoked AS service_role, exactly like PostgREST
// would) against a REAL throwaway Postgres — then the REAL WP0 worker +
// markdownWriter drain the rows to completed markdown, and the completion is
// projected back onto the ORIGINAL mock-Telegram card via the durable card_ref.
//
// GATED: `{ skip: !DB }`; the default unit run never loads pg.
// ISOLATION: own database "<db>_wp1e2e" (parallel-safe with every other file).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleTelegramWebhook, PENDING_CARD_TEXT, WAITING_CARD_TEXT } from '../../../supabase/functions/fcg-webhook-intake/handler.js';
import { createPostgresOperationalStore } from '../src/store/postgresOperationalStore.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createWorker } from '../src/worker.js';
import { STATES } from '../src/core/states.js';
import { MAX_BACKOFF_MS } from '../src/core/retryPolicy.js';

const DB = process.env.DATABASE_URL;
const AUTH_ID = '424242';
const AUTH_IDENTITY_REF = `telegram:user:${AUTH_ID}`;
const WEBHOOK_SECRET = 'e2e~synthetic~webhook~secret~42';
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
const URLS = DB ? isolatedDbUrls(DB, 'wp1e2e') : null;
const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

let pgPool = null;

async function resetAndMigrate() {
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
  for (const file of MIGRATIONS) {
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  // Deploy-time allowlist seed (wp1-safe-cutover.md shape).
  await pool.query(
    `insert into fcg.channel_identity (identity_ref, channel, channel_principal_ref, is_authorised)
     values ($1, 'telegram', $2, true)
     on conflict (identity_ref) do update
       set channel_principal_ref = excluded.channel_principal_ref, is_authorised = true`,
    [AUTH_IDENTITY_REF, AUTH_ID],
  );
  return pool;
}

// ── The rpc bridge: named handler args → positional SECURITY DEFINER calls,
//    executed AS service_role (what PostgREST does for the edge function).
async function rpcAsServiceRole(fn, args) {
  const client = await pgPool.connect();
  try {
    await client.query('set role service_role');
    let res;
    if (fn === 'fcg_webhook_intake') {
      res = await client.query(
        'select public.fcg_webhook_intake($1, $2, $3, $4, $5::uuid, $6, $7, $8, $9, $10::jsonb, $11::timestamptz) as r',
        [args.p_channel, args.p_update_id, args.p_sender_principal, args.p_idempotency_key,
          args.p_capture_id, args.p_recorded_intent, args.p_technical_source_type,
          args.p_payload_text, args.p_text_preview,
          args.p_channel_context ? JSON.stringify(args.p_channel_context) : null,
          args.p_captured_at ?? null],
      );
    } else if (fn === 'fcg_webhook_confirm_tap') {
      res = await client.query(
        'select public.fcg_webhook_confirm_tap($1, $2, $3, $4, $5, $6) as r',
        [args.p_channel, args.p_update_id, args.p_sender_principal,
          args.p_chat_id, args.p_message_id, args.p_action],
      );
    } else if (fn === 'fcg_webhook_card_ref') {
      res = await client.query(
        'select public.fcg_webhook_card_ref($1::uuid, $2, $3) as r',
        [args.p_capture_id, args.p_chat_id, args.p_message_id],
      );
    } else {
      throw new Error(`rpc bridge: unknown function ${fn}`);
    }
    return res.rows[0].r;
  } finally {
    try { await client.query('reset role'); } catch { /* ignore */ }
    client.release();
  }
}

// ── Mock Telegram API — ONE recorder shared by the edge handler AND the
//    worker's card projection, so "the ORIGINAL card was edited" is assertable.
//
// CHANNEL FIDELITY (same root-cause fix as telegramAdapter.js, 2026-07-17):
// message_id is MODULE-level — real Telegram never re-mints a message id in
// the same chat, and the scenarios share one durable DB, so per-instance
// counters would mint colliding card_refs and cross-wire the tap resolution.
let nextTelegramMessageId = 60000;

function createTelegramMock() {
  const events = [];
  let failSends = 0;
  return {
    events,
    failNextSend(n = 1) { failSends = n; },
    async sendMessage(payload) {
      if (failSends > 0) {
        failSends -= 1;
        events.push({ method: 'sendMessage', payload, failed: true });
        throw new Error('telegram sendMessage rejected: http_502 (synthetic)');
      }
      nextTelegramMessageId += 1;
      events.push({ method: 'sendMessage', payload, message_id: nextTelegramMessageId });
      return { ok: true, result: { message_id: nextTelegramMessageId } };
    },
    async editMessageText(payload) {
      events.push({ method: 'editMessageText', payload });
      return { ok: true, result: true };
    },
    async answerCallbackQuery(payload) {
      events.push({ method: 'answerCallbackQuery', payload });
      return { ok: true, result: true };
    },
  };
}

// Worker-side adapter: the completion projection edits the ORIGINAL card via
// the durable card_ref coordinates — through the SAME mock recorder.
function workerAdapterOver(telegramMock) {
  return {
    async editCard(captureId, model) {
      if (model.message_id === undefined) {
        throw new Error(`editCard: no durable card target for ${captureId}`);
      }
      return telegramMock.editMessageText({
        chat_id: model.chat_id,
        message_id: model.message_id,
        text: model.status_line,
        ...(model.parse_mode ? { parse_mode: model.parse_mode } : {}),
      });
    },
    async sendCard() {
      throw new Error('the worker must never SEND cards in the webhook e2e (edge owns the send)');
    },
  };
}

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, advance: (d) => { t += d; } };
}

// Synthetic signed POST → the REAL pure handler with the REAL rpc bridge.
function postUpdate(update, telegram, { secret = WEBHOOK_SECRET, logs = [] } = {}) {
  return handleTelegramWebhook(
    {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': secret, 'content-type': 'application/json' },
      bodyText: JSON.stringify(update),
    },
    { rpc: rpcAsServiceRole, telegram, secret: WEBHOOK_SECRET, log: (e) => logs.push(e) },
  );
}

function textUpdate(updateId, messageId, text) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: Number(AUTH_ID) },
      chat: { id: Number(AUTH_ID), type: 'private' },
      date: 1752700000,
      text,
    },
  };
}

function tapUpdate(updateId, cardMessageId, action = 'SaveToBrain') {
  return {
    update_id: updateId,
    callback_query: {
      id: `cbq-${updateId}`,
      from: { id: Number(AUTH_ID) },
      data: action,
      message: { message_id: cardMessageId, chat: { id: Number(AUTH_ID), type: 'private' } },
    },
  };
}

async function scenario({ leaseMs = 60_000 } = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-wp1e2e-'));
  const store = await createPostgresOperationalStore({ connectionString: URLS.iso });
  const telegram = createTelegramMock();
  const markdownWriter = createSandboxMarkdownWriter({ baseDir });
  const clock = fixedClock(1_752_710_000_000);
  const worker = createWorker({
    store, markdownWriter, adapter: workerAdapterOver(telegram), clock, workerId: 'wp1-e2e-worker', leaseMs,
  });
  return {
    baseDir,
    store,
    telegram,
    markdownWriter,
    clock,
    worker,
    async close() {
      await store.end();
      fs.rmSync(baseDir, { recursive: true, force: true });
    },
  };
}

const mdFiles = (baseDir) => (fs.existsSync(path.join(baseDir, 'inbox'))
  ? fs.readdirSync(path.join(baseDir, 'inbox')).filter((f) => f.endsWith('.md'))
  : []);

let nextUpdate = 500000;
let nextMessage = 70000;
const freshUpdateId = () => (nextUpdate += 1);
const freshMessageId = () => (nextMessage += 1);

before(async () => { if (DB) pgPool = await resetAndMigrate(); });
after(async () => { if (pgPool) await pgPool.end(); });

test('E2E-1 happy path: signed POST → accepted(webhook) + card → tap → offline_queued + waiting copy → worker drain → markdown + evidence → completed on the ORIGINAL card', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const text = 'wp1 e2e: solar inverter readings from the cloud path';
    const msgUpdate = textUpdate(freshUpdateId(), freshMessageId(), text);

    // 1. Message arrives at the edge while the Yoga is "asleep".
    const res1 = await postUpdate(msgUpdate, s.telegram);
    assert.equal(res1.status, 200);
    assert.equal(res1.body.outcome, 'new');

    const send = s.telegram.events.find((e) => e.method === 'sendMessage');
    assert.ok(send, 'the edge sent the card (the Yoga may be asleep; silence is forbidden)');
    assert.equal(send.payload.text, PENDING_CARD_TEXT, 'honest tap-gate copy — never a completion claim');
    const cardMessageId = send.message_id;

    const rows = await pgPool.query(
      `select ce.intake_transport, ce.payload_text, ps.state, ps.card_ref
         from fcg.capture_envelope ce join fcg.processing_state ps using (capture_id)
        where ce.payload_text = $1`,
      [text],
    );
    assert.equal(rows.rows.length, 1, 'exactly one durable envelope');
    assert.equal(rows.rows[0].intake_transport, 'webhook');
    assert.equal(rows.rows[0].state, STATES.ACCEPTED, 'tap-gate hold');
    assert.deepEqual(rows.rows[0].card_ref, { chat_id: AUTH_ID, message_id: String(cardMessageId) }, '0005-shaped durable card target');

    // 2. The user taps "Save to Brain" — still cloud-only.
    const res2 = await postUpdate(tapUpdate(freshUpdateId(), cardMessageId), s.telegram);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.outcome, 'queued');
    const afterTap = await pgPool.query('select state from fcg.processing_state ps join fcg.capture_envelope ce using (capture_id) where ce.payload_text = $1', [text]);
    assert.equal(afterTap.rows[0].state, STATES.OFFLINE_QUEUED, 'the cloud always uses the offline-honest claimable state');
    const waitingEdit = s.telegram.events.find((e) => e.method === 'editMessageText');
    assert.equal(waitingEdit.payload.text, WAITING_CARD_TEXT);
    assert.equal(waitingEdit.payload.message_id, cardMessageId, 'the ORIGINAL card was edited');
    const answer = s.telegram.events.find((e) => e.method === 'answerCallbackQuery');
    assert.equal(answer.payload.text, 'Saving to your Brain…');

    // 3. The Yoga wakes: the UNCHANGED WP0 worker claims and completes.
    s.clock.advance(5_000);
    const processed = await s.worker.drain({ now: s.clock.now() });
    assert.equal(processed, 1, 'the waking worker drained exactly the tapped capture');

    const finalRec = (await s.store.list()).find((r) => r.text_preview && r.text_preview.includes('solar inverter'));
    assert.equal(finalRec.state, STATES.COMPLETED);
    assert.ok(finalRec.destination_ref && fs.existsSync(finalRec.destination_ref.path), 'the governed markdown note exists on disk');
    assert.match(fs.readFileSync(finalRec.destination_ref.path, 'utf8'), /solar inverter readings/);
    assert.equal(finalRec.evidence_pointers.length, 1);
    assert.equal(finalRec.evidence_pointers[0].evidence_kind, 'markdown_write');
    assert.equal(mdFiles(s.baseDir).length, 1, 'exactly one markdown file');

    // 4. Completion was projected onto the ORIGINAL card (same message_id).
    const completionEdit = s.telegram.events.filter((e) => e.method === 'editMessageText').at(-1);
    // The RPC stores card_ref coordinates as TEXT (0005 ->> comparisons); the
    // worker re-targets with that durable string form.
    assert.equal(String(completionEdit.payload.message_id), String(cardMessageId), 're-targeted from durable card_ref');
    assert.match(completionEdit.payload.text, /^Completed — saved to your Brain \(`.+\.md`\)\.$/);
  } finally {
    await s.close();
  }
});

test('E2E-2 duplicate redelivery while the worker sleeps: POST ×3 → 1 envelope, 1 card, 1 ledger row; tap + redelivered tap → one queued, one dedup; drain → ONE markdown file', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const text = 'wp1 e2e: redelivered while asleep';
    const update = textUpdate(freshUpdateId(), freshMessageId(), text);

    const outcomes = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await postUpdate(update, s.telegram);
      assert.equal(res.status, 200);
      outcomes.push(res.body.outcome);
    }
    assert.deepEqual(outcomes, ['new', 'duplicate', 'duplicate']);
    assert.equal(s.telegram.events.filter((e) => e.method === 'sendMessage').length, 1, 'has_card_ref short-circuits: ONE card');
    const env = await pgPool.query('select count(*)::int as n from fcg.capture_envelope where payload_text = $1', [text]);
    assert.equal(env.rows[0].n, 1);
    const led = await pgPool.query(
      "select count(*)::int as n from fcg.channel_update_dedup where update_id = $1 and channel = 'telegram'", [update.update_id],
    );
    assert.equal(led.rows[0].n, 1, 'one ledger row across three deliveries');

    // Tap twice: once real, once redelivered (same update_id).
    const cardMessageId = s.telegram.events.find((e) => e.method === 'sendMessage').message_id;
    const tap = tapUpdate(freshUpdateId(), cardMessageId);
    const tapRes1 = await postUpdate(tap, s.telegram);
    const tapRes2 = await postUpdate(tap, s.telegram);
    assert.equal(tapRes1.body.outcome, 'queued');
    assert.equal(tapRes2.body.outcome, 'duplicate_update', 'the redelivered tap is a ledger-level no-op');

    s.clock.advance(1_000);
    const processed = await s.worker.drain({ now: s.clock.now() });
    assert.equal(processed, 1);
    assert.equal(mdFiles(s.baseDir).length, 1, 'exactly ONE markdown file despite 3 deliveries + 2 taps');
  } finally {
    await s.close();
  }
});

test('E2E-3 restart + duplicate safety: write fails once → failed+due-retry → a FRESH worker instance completes from durable state → ONE file; late redeliveries are inert', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const text = 'wp1 e2e: survive a mid-write crash';
    const update = textUpdate(freshUpdateId(), freshMessageId(), text);
    await postUpdate(update, s.telegram);
    const cardMessageId = s.telegram.events.find((e) => e.method === 'sendMessage').message_id;
    const tap = tapUpdate(freshUpdateId(), cardMessageId);
    await postUpdate(tap, s.telegram);

    // First worker life: the governed write throws once → honest failed state.
    s.markdownWriter.failNextWrite(1);
    s.clock.advance(1_000);
    const failedRec = await s.worker.processOne({ now: s.clock.now() });
    assert.equal(failedRec.state, STATES.FAILED, 'honest failure, never a false completion');
    assert.ok(failedRec.next_attempt_at_ms > s.clock.now(), 'autonomous retry scheduled');
    assert.equal(mdFiles(s.baseDir).length, 0, 'no partial note leaked');

    // "Restart": a brand-new worker over a FRESH store connection and a fresh
    // adapter (no in-memory card map) — everything must come from durable state.
    const store2 = await createPostgresOperationalStore({ connectionString: URLS.iso });
    try {
      const worker2 = createWorker({
        store: store2,
        markdownWriter: s.markdownWriter,
        adapter: workerAdapterOver(s.telegram),
        clock: s.clock,
        workerId: 'wp1-e2e-worker-B',
        leaseMs: 60_000,
      });
      s.clock.advance(MAX_BACKOFF_MS + 1);
      const done = await worker2.processOne({ now: s.clock.now() });
      assert.equal(done.state, STATES.COMPLETED);
      assert.equal(mdFiles(s.baseDir).length, 1, 'exactly one note after the retry');
      const completionEdit = s.telegram.events.filter((e) => e.method === 'editMessageText').at(-1);
      assert.equal(String(completionEdit.payload.message_id), String(cardMessageId), 'the restarted worker re-targeted the ORIGINAL card from card_ref');
      assert.match(completionEdit.payload.text, /^Completed — saved to your Brain/);

      // Late redeliveries after completion: all inert.
      const sendsBefore = s.telegram.events.filter((e) => e.method === 'sendMessage').length;
      const replayMsg = await postUpdate(update, s.telegram);
      assert.equal(replayMsg.body.outcome, 'duplicate');
      const replayTap = await postUpdate(tap, s.telegram); // SAME callback update_id
      assert.equal(replayTap.body.outcome, 'duplicate_update');
      const freshTap = await postUpdate(tapUpdate(freshUpdateId(), cardMessageId), s.telegram);
      assert.equal(freshTap.body.outcome, 'already_completed', 'a genuinely new tap on a completed capture answers honestly (P9 semantics)');
      assert.equal(s.telegram.events.filter((e) => e.method === 'sendMessage').length, sendsBefore, 'zero new cards');
      assert.equal(mdFiles(s.baseDir).length, 1, 'still exactly one file');
    } finally {
      await store2.end();
    }
  } finally {
    await s.close();
  }
});

test('E2E-4 card-send failure honesty: send fails → 500 → redelivery reconciles the card → tap → drain → completed; the wording sequence never claims completion early', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const text = 'wp1 e2e: the card died on the first try';
    const update = textUpdate(freshUpdateId(), freshMessageId(), text);

    // First delivery: durable intake, then the card send fails → 500.
    s.telegram.failNextSend(1);
    const res1 = await postUpdate(update, s.telegram);
    assert.equal(res1.status, 500, 'no ledger-consumed success without the card path completing');
    const afterFail = await pgPool.query(
      `select ps.state, ps.card_ref from fcg.processing_state ps
        join fcg.capture_envelope ce using (capture_id) where ce.payload_text = $1`,
      [text],
    );
    assert.equal(afterFail.rows[0].state, STATES.ACCEPTED, 'the capture was durable the whole time');
    assert.equal(afterFail.rows[0].card_ref, null, 'no card target yet');

    // Telegram redelivers the SAME update_id → reconciliation sends the card.
    const res2 = await postUpdate(update, s.telegram);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.outcome, 'duplicate');
    const send = s.telegram.events.find((e) => e.method === 'sendMessage' && !e.failed);
    assert.ok(send, 'reconciliation delivered the card');
    assert.equal(send.payload.text, PENDING_CARD_TEXT);

    // Tap → drain → completed.
    await postUpdate(tapUpdate(freshUpdateId(), send.message_id), s.telegram);
    s.clock.advance(1_000);
    await s.worker.drain({ now: s.clock.now() });

    // Full user-visible wording sequence, in order — completion only at the end,
    // and only AFTER the evidence-gated store transition (drain already ran).
    const visible = s.telegram.events
      .filter((e) => !e.failed && (e.method === 'sendMessage' || e.method === 'editMessageText'))
      .map((e) => e.payload.text);
    assert.equal(visible[0], PENDING_CARD_TEXT);
    assert.equal(visible[1], WAITING_CARD_TEXT);
    assert.match(visible[2], /^Completed — saved to your Brain/);
    assert.equal(visible.length, 3, 'no extra/early cards');
    assert.ok(
      visible.slice(0, 2).every((t) => !/Completed/.test(t)),
      'no receipt claimed completion before evidence existed',
    );
    assert.equal(mdFiles(s.baseDir).length, 1);
  } finally {
    await s.close();
  }
});

test('E2E-5 worker waking mid-redelivery: a duplicate burst races the drain → 1 envelope, 1 file, completed; no illegal transition escapes', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const text = 'wp1 e2e: burst racing the waking worker';
    const update = textUpdate(freshUpdateId(), freshMessageId(), text);
    await postUpdate(update, s.telegram);
    const cardMessageId = s.telegram.events.find((e) => e.method === 'sendMessage').message_id;
    await postUpdate(tapUpdate(freshUpdateId(), cardMessageId), s.telegram);

    // Worker wakes WHILE Telegram redelivers the original message ×6.
    s.clock.advance(1_000);
    const [processed, ...burst] = await Promise.all([
      s.worker.drain({ now: s.clock.now() }),
      ...Array.from({ length: 6 }, () => postUpdate(update, s.telegram)),
    ]);
    assert.equal(processed, 1, 'the drain completed the capture exactly once');
    for (const res of burst) {
      assert.equal(res.status, 200, 'every redelivery was acknowledged');
      assert.equal(res.body.outcome, 'duplicate');
    }

    const env = await pgPool.query('select count(*)::int as n from fcg.capture_envelope where payload_text = $1', [text]);
    assert.equal(env.rows[0].n, 1, 'one envelope despite the race');
    assert.equal(mdFiles(s.baseDir).length, 1, 'one file despite the race');
    const rec = (await s.store.list()).find((r) => r.text_preview && r.text_preview.includes('burst racing'));
    assert.equal(rec.state, STATES.COMPLETED);
  } finally {
    await s.close();
  }
});

test('E2E-6 auth negatives: wrong secret → 401 with ZERO DB writes; valid secret + stranger sender → 200 unauthorised with ZERO rows and no card', { skip: !DB }, async () => {
  const s = await scenario();
  try {
    const counts = async () => (await pgPool.query(`
      select (select count(*) from fcg.capture_envelope)     as envelopes,
             (select count(*) from fcg.processing_state)     as states,
             (select count(*) from fcg.idempotency_key)      as keys,
             (select count(*) from fcg.channel_update_dedup) as ledger,
             (select count(*) from fcg.channel_identity)     as identities
    `)).rows[0];
    const before1 = await counts();

    // Wrong secret: rejected before ANY parse/DB work.
    const bad = await postUpdate(textUpdate(freshUpdateId(), freshMessageId(), 'forged'), s.telegram, { secret: 'wrong~secret~value' });
    assert.equal(bad.status, 401);
    assert.deepEqual(await counts(), before1, 'zero rows from a forged POST');
    assert.equal(s.telegram.events.length, 0, 'no outbound Telegram call');

    // Valid secret, stranger sender: allowlist refuses INSIDE the RPC (I10).
    const strangerUpdate = {
      update_id: freshUpdateId(),
      message: { message_id: freshMessageId(), from: { id: 31337 }, chat: { id: 31337, type: 'private' }, text: 'let me in' },
    };
    const res = await postUpdate(strangerUpdate, s.telegram);
    assert.equal(res.status, 200, '200 so Telegram does not retry-spam');
    assert.equal(res.body.outcome, 'unauthorised');
    assert.deepEqual(await counts(), before1, 'zero rows — not even a ledger entry (no stranger PII)');
    assert.equal(s.telegram.events.length, 0, 'no card, no oracle for strangers');
  } finally {
    await s.close();
  }
});
