// BUILD-014 PR-3b — executed proofs for the notification SENDER (notifier.mjs) on the PR-3a
// outbox (005). DB-GATED but NOT silently self-skipping (mirrors PR-3a/WP-A/WP-B):
//   - DATABASE_URL UNSET -> the suite skips with a LOUD message pointing at the runner
//     (test/run-notifier-tests.mjs), which provisions a throwaway Postgres, applies 001+002+005,
//     and runs this file. A skip is NEVER a pass.
//   - DATABASE_URL SET but `pg` missing -> the suite FAILS (throws), never green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: this DROPs + rebuilds `ops`.
//
//   node services/control-plane/notifier/test/run-notifier-tests.mjs   # provisions + runs
//
// What it proves (the PR-3b sender invariants):
//   1. claim -> send(fake) -> sent; ACTION_NEEDED + MILESTONE each dispatched EXACTLY ONCE per
//      outbox row; the dispatched payload carries the cockpit_url + github_url DEEP LINKS.
//   2. RESTART re-run sends NO duplicate: an already-'sent' row is never re-dispatched.
//   3. transport failure -> failed -> retry WITH BACKOFF (gates the next claim) -> dead_letter
//      at the retry budget.
//   4. CRASH mid-'sending' is reclaimed by the watchdog and re-driven EXACTLY ONCE (not looped).
//   5. SILENT is NEVER dispatched (suppressed rows are unclaimable; transport sees nothing).
//   6. LEAST-PRIVILEGE: the whole sender + watchdog surface runs under SET ROLE notifier.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Notifier, SendingWatchdog } from '../notifier.mjs';
import { createFakeTransport } from '../transport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const MIGRATIONS = [
  '001_control_plane_min_schema.sql',
  '002_current_head_authority.sql',
  '005_notification_outbox.sql',
].map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the PR-3b notifier ` +
    `proofs. Install pg or use run-notifier-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/notifier/test/run-notifier-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function applyMigrations(pool) {
  for (const m of MIGRATIONS) await pool.query(fs.readFileSync(m, 'utf8'));
}
async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  await applyMigrations(pool);
  return pool;
}
async function seedBuild(pool) {
  const { rows } = await pool.query(
    `insert into ops.build (build_ref, repo) values ($1,$2) returning id`,
    [`BUILD-014-${Math.random().toString(36).slice(2)}`, 'warwickallan/Fusion247PKA']);
  return rows[0].id;
}
/** Seed an immutable agent_event to project from. */
async function seedEvent(pool, buildId, eventKind, payload = {}) {
  const { rows } = await pool.query(
    `insert into ops.agent_event (build_id, delivery_key, event_kind, actor, payload_hash, payload)
     values ($1,$2,$3,'tower',$4,$5::jsonb) returning id`,
    [buildId, `dk-${Math.random().toString(36).slice(2)}`, eventKind,
     'sha256:0000000000000000000000000000000000000000000000000000000000000000',
     JSON.stringify(payload)]);
  return rows[0].id;
}
/** Project an event into the outbox and return the resulting row. */
async function project(pool, eventId, dest = 'warwick_primary') {
  const { rows } = await pool.query(`select * from ops.project_event_to_outbox($1,$2)`, [eventId, dest]);
  return rows[0];
}
async function stateOf(pool, id) {
  const { rows } = await pool.query(`select state, attempts, sent_at, next_attempt_at from ops.notification_outbox where id=$1`, [id]);
  return rows[0];
}

// ---------------------------------------------------------------------------
gated('1. claim -> send(fake) -> sent; ACTION_NEEDED + MILESTONE each dispatched exactly once; deep links present', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const evAction = await seedEvent(pool, buildId, 'warwick.decision_needed',
      { headline: 'Decide: merge-live?', message: 'Warwick call needed',
        cockpit_url: 'https://cockpit/x', github_url: 'https://gh/pr/1' });
    const evMilestone = await seedEvent(pool, buildId, 'merge.landed',
      { headline: 'Merge landed', message: 'BUILD-014 merged', cockpit_url: 'https://cockpit/m', github_url: 'https://gh/pr/2' });
    const rowA = await project(pool, evAction);
    const rowM = await project(pool, evMilestone);
    assert.equal(rowA.notification_class, 'ACTION_NEEDED');
    assert.equal(rowM.notification_class, 'MILESTONE');

    const transport = createFakeTransport();               // always ok
    const n = new Notifier(pool, transport, { pollIntervalMs: 5 });
    const outcomes = await n.drain('warwick_primary');

    assert.equal(outcomes.length, 2, 'both due rows dispatched');
    assert.ok(outcomes.every((o) => o.outcome === 'sent'), 'both outcomes are sent');

    // Each outbox row is terminally 'sent', with sent_at.
    for (const id of [rowA.id, rowM.id]) {
      const s = await stateOf(pool, id);
      assert.equal(s.state, 'sent');
      assert.ok(s.sent_at, 'sent_at set');
      assert.equal(s.attempts, 1, 'delivered on the first attempt');
    }

    // EXACTLY ONCE per row: two sends total, one per id.
    assert.equal(transport.calls.length, 2, 'transport called exactly twice');
    assert.equal(transport.countFor(rowA.id), 1, 'ACTION_NEEDED dispatched exactly once');
    assert.equal(transport.countFor(rowM.id), 1, 'MILESTONE dispatched exactly once');

    // DEEP LINKS present in the dispatched payload.
    const callA = transport.calls.find((c) => c.id === String(rowA.id));
    assert.equal(callA.notificationClass, 'ACTION_NEEDED');
    assert.equal(callA.cockpitUrl, 'https://cockpit/x', 'cockpit deep link present');
    assert.equal(callA.githubUrl, 'https://gh/pr/1', 'github deep link present');
    assert.equal(callA.headline, 'Decide: merge-live?');
    assert.equal(callA.message, 'Warwick call needed');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('2. RESTART re-run sends NO duplicate: an already-sent row is never re-dispatched', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'wp.built', { headline: 'WP built', message: 'done' });
    const row = await project(pool, ev);

    const transport = createFakeTransport();
    await new Notifier(pool, transport).drain('warwick_primary');
    assert.equal(transport.countFor(row.id), 1, 'delivered once');
    assert.equal((await stateOf(pool, row.id)).state, 'sent');

    // Simulate a NOTIFIER RESTART: a brand-new instance, same durable outbox, same transport.
    const outcomes = await new Notifier(pool, transport).drain('warwick_primary');
    assert.equal(outcomes.length, 0, 'nothing due after restart (all rows terminal)');
    assert.equal(transport.countFor(row.id), 1, 'NO duplicate send after restart');
    assert.equal(transport.calls.length, 1, 'transport not called again');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('3. transport failure -> failed -> retry WITH BACKOFF (gates claim) -> dead_letter at budget', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'merge.landed', { headline: 'Merge', message: 'm' });
    // Insert directly with a SMALL budget (max_attempts is frozen after write).
    const ins = await pool.query(
      `insert into ops.notification_outbox
         (source_event_id, notification_class, destination, headline, message, state, max_attempts, next_attempt_at)
       values ($1,'MILESTONE','warwick_primary','Merge','m','queued',3,now()) returning id`, [ev]);
    const id = ins.rows[0].id;

    const transport = createFakeTransport({ decide: () => ({ ok: false, errorCode: 'HTTP_500' }) });
    const n = new Notifier(pool, transport, { backoffBaseSeconds: 60, maxBackoffSeconds: 3600 });

    // backoff is EXPONENTIAL (pure-function proof): 60, 120, 240 for attempts 1,2,3.
    assert.equal(n.backoffSeconds(1), 60);
    assert.equal(n.backoffSeconds(2), 120);
    assert.equal(n.backoffSeconds(3), 240);

    // attempt 1: claim -> send fails -> queued with a FUTURE next_attempt_at (backoff).
    let o = await n.processOnce('warwick_primary');
    assert.equal(o.outcome, 'failed');
    let s = await stateOf(pool, id);
    assert.equal(s.state, 'queued');
    assert.equal(s.attempts, 1);
    assert.ok(new Date(s.next_attempt_at).getTime() > Date.now() + 30_000, 'backoff pushes next_attempt_at into the future');

    // The BACKOFF GATES the claim: nothing is due yet.
    assert.equal(await n.processOnce('warwick_primary'), null, 'a not-yet-due row is not re-claimed (backoff gate)');

    // Fast-forward the backoff (as the projector/superuser) to drive the next attempt.
    await pool.query(`update ops.notification_outbox set next_attempt_at=now() where id=$1`, [id]);
    o = await n.processOnce('warwick_primary');
    assert.equal(o.outcome, 'failed');
    s = await stateOf(pool, id);
    assert.equal(s.state, 'queued');
    assert.equal(s.attempts, 2);

    // Fast-forward again -> attempt 3 is the budget -> dead_letter.
    await pool.query(`update ops.notification_outbox set next_attempt_at=now() where id=$1`, [id]);
    o = await n.processOnce('warwick_primary');
    assert.equal(o.outcome, 'dead_letter');
    s = await stateOf(pool, id);
    assert.equal(s.state, 'dead_letter');
    assert.equal(s.attempts, 3);

    // A dead_letter row is never claimed again; transport was tried exactly 3 times.
    assert.equal(await n.processOnce('warwick_primary'), null, 'dead_letter row is not re-claimed');
    assert.equal(transport.countFor(id), 3, 'exactly one transport attempt per claim, up to the budget');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('4. CRASH mid-sending is reclaimed by the watchdog and re-driven exactly once', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'finding.high_crit', { headline: 'HIGH', message: 'eyes' });
    const row = await project(pool, ev);

    // Simulate a sender that CLAIMS then CRASHES before sending: a beforeSend hook that throws
    // strands the row in 'sending' (claim already moved it), transport never called.
    const transport = createFakeTransport();
    const n = new Notifier(pool, transport, { backoffBaseSeconds: 0 });
    await assert.rejects(
      () => n.processOnce('warwick_primary', { beforeSend: () => { throw new Error('crash mid-send'); } }),
      /crash mid-send/);
    let s = await stateOf(pool, row.id);
    assert.equal(s.state, 'sending', 'row is stranded in sending after the crash');
    assert.equal(s.attempts, 1);
    assert.equal(transport.calls.length, 0, 'transport never delivered (crash before send)');

    // Watchdog reclaims the stale 'sending' row (staleSeconds=0 => immediately stale;
    // backoffSeconds=0 => re-driveable now).
    const wd = new SendingWatchdog(pool, { staleSeconds: 0, backoffSeconds: 0 });
    const reclaimed = await wd.tick();
    assert.equal(reclaimed.length, 1, 'the stranded row is reclaimed exactly once');
    assert.equal(reclaimed[0], String(row.id));
    s = await stateOf(pool, row.id);
    assert.equal(s.state, 'queued', 'reclaimed back to queued for a retry');
    assert.equal(s.attempts, 1, 'the crashed attempt still counts against the budget');

    // Re-drive: a healthy send now delivers the row exactly once.
    const o = await n.processOnce('warwick_primary');
    assert.equal(o.outcome, 'sent');
    assert.equal(transport.countFor(row.id), 1, 're-driven and delivered exactly once');
    s = await stateOf(pool, row.id);
    assert.equal(s.state, 'sent');
    assert.equal(s.attempts, 2);

    // The watchdog does NOT re-drive a delivered row: a second tick reclaims nothing.
    assert.deepEqual(await wd.tick(), [], 'no re-reclaim of a sent row (re-driven ONCE, not looped)');
    assert.equal(await n.processOnce('warwick_primary'), null, 'nothing else due');
    assert.equal(transport.calls.length, 1, 'exactly one delivery total');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('5. SILENT is NEVER dispatched (suppressed is unclaimable; transport sees nothing)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const evSilent = await seedEvent(pool, buildId, 'commit.pushed', { headline: 'commit', message: 'noise' });
    const sup = await project(pool, evSilent);
    assert.equal(sup.notification_class, 'SILENT');
    assert.equal(sup.state, 'suppressed');

    // A MILESTONE alongside it, to prove the sender DOES deliver the sendable one and ONLY it.
    const evM = await seedEvent(pool, buildId, 'wp.built', { headline: 'WP', message: 'built' });
    const rowM = await project(pool, evM);

    const transport = createFakeTransport();
    const outcomes = await new Notifier(pool, transport).drain('warwick_primary');

    assert.equal(outcomes.length, 1, 'only the sendable row is dispatched');
    assert.equal(transport.calls.length, 1, 'transport called once');
    assert.equal(transport.countFor(sup.id), 0, 'the SILENT row is NEVER dispatched');
    assert.equal(transport.countFor(rowM.id), 1, 'the MILESTONE row is dispatched');
    // The SILENT row is still terminally suppressed (never touched by the sender).
    assert.equal((await stateOf(pool, sup.id)).state, 'suppressed');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('6. LEAST-PRIVILEGE: the sender + watchdog surface runs under SET ROLE notifier', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    // (a) happy path under the notifier role: claim + mark_sent.
    const evOk = await seedEvent(pool, buildId, 'merge.landed', { headline: 'Merge', message: 'm' });
    const rowOk = await project(pool, evOk);
    const okTransport = createFakeTransport();
    const nOk = new Notifier(pool, okTransport, { sessionRole: 'notifier' });
    const o = await nOk.processOnce('warwick_primary');
    assert.equal(o.outcome, 'sent', 'notifier role can claim + mark_sent');
    assert.equal((await stateOf(pool, rowOk.id)).state, 'sent');

    // (b) failure path under the notifier role: claim + mark_failed.
    const evBad = await seedEvent(pool, buildId, 'wp.built', { headline: 'WP', message: 'x' });
    const rowBad = await project(pool, evBad, 'ops_channel');
    const badTransport = createFakeTransport({ decide: () => ({ ok: false, errorCode: 'HTTP_503' }) });
    const nBad = new Notifier(pool, badTransport, { sessionRole: 'notifier', backoffBaseSeconds: 0 });
    const ob = await nBad.processOnce('ops_channel');
    assert.equal(ob.outcome, 'failed', 'notifier role can claim + mark_failed');
    assert.equal((await stateOf(pool, rowBad.id)).state, 'queued');

    // (c) watchdog surface under the notifier role: SELECT stale 'sending' + mark_failed.
    // Strand a fresh row in 'sending' (claim as superuser), then reclaim as notifier.
    const evStuck = await seedEvent(pool, buildId, 'finding.high_crit', { headline: 'H', message: 'y' });
    const rowStuck = await project(pool, evStuck, 'ops_channel');
    await pool.query(`select ops.claim_notification($1)`, ['ops_channel']); // -> sending (but rowBad is queued... claim picks the due one)
    // Ensure the STUCK row is the one sending: claim picks FIFO by next_attempt_at; rowBad was
    // re-queued with next_attempt_at=now() (backoff 0) so it may be picked first. Robustly, mark
    // whichever is 'sending'. The watchdog under notifier role must reclaim ALL stale sending rows.
    const wd = new SendingWatchdog(pool, { staleSeconds: 0, backoffSeconds: 0, sessionRole: 'notifier' });
    const reclaimed = await wd.tick();
    assert.ok(reclaimed.length >= 1, 'notifier role can run the watchdog reclaim (SELECT + mark_failed)');
    const anySending = await pool.query(`select count(*)::int c from ops.notification_outbox where state='sending'`);
    assert.equal(anySending.rows[0].c, 0, 'no row left stranded in sending after the notifier-role watchdog');
    void rowStuck;
  } finally { await pool.end(); }
});
