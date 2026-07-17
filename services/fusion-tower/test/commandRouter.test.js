// Fusion Tower — governance command router unit suite (BUILD-010 WP1). NO DB, NO
// live send: a memory store + the REAL durable outbox notifier (enqueue only, never
// drained) prove each command drives the right store mutation and ENQUEUES the right
// [TOWER] reply. `pg` is never loaded.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryStore } from '../src/store/memoryStore.js';
import { createTelegramNotifier } from '../src/adapters/telegramNotifier.js';
import {
  handleCommandEvent,
  parseCommandEvent,
  isAuthorisedSender,
  resolveActiveRun,
  GOVERNANCE_COMMANDS,
} from '../src/core/commandRouter.js';
import { FORBIDDEN_ACTIONS } from '../src/core/guardrails.js';
import { RUN_STATUS } from '../src/core/states.js';

const CHAT = '123456789';
const ALLOW = [CHAT];

function makeNotifier() {
  // The real durable notifier bound to the authorised chat as recipient. No client
  // is supplied and drainOnce is never called, so NOTHING is ever sent live.
  return createTelegramNotifier({ config: { authorisedTelegramUserId: CHAT } });
}

// Build a durable command run_event exactly as the WP2 capture worker writes it.
function cmdEvent(name, { args = [], sender = CHAT, updateId = 'u-1', runId = null } = {}) {
  return {
    event_id: `evt-${updateId}`,
    run_id: runId,
    source: 'telegram',
    source_event_id: String(updateId),
    kind: `command:${name}`,
    payload: { command: `/${name}`, args, chat_id: CHAT, sender_id: sender, ts: 1 },
    self_generated: false,
    processed: false,
    received_at: 1,
    created_at: 1,
  };
}

async function seedRun(store, over = {}) {
  return store.createRun({ title: 'BUILD-010 WP1', scope: 'wp1', maxRounds: 2, ...over }, { now: 1000 });
}

// Move a run to awaiting_decision with a genuinely-pending bounded decision.
async function parkAwaitingDecision(store, runId, now = 1100) {
  await store.setRunStatus(runId, RUN_STATUS.ACTIVE, { now });
  await store.setRunStatus(runId, RUN_STATUS.AWAITING_DECISION, { now, decisionRequired: true });
}

// -------- parsing + auth primitives ------------------------------------------

test('parseCommandEvent — derives name from kind and normalises args/ids', () => {
  const p = parseCommandEvent(cmdEvent('watch', { args: ['on'], updateId: 'u9' }));
  assert.equal(p.command, 'watch');
  assert.deepEqual(p.args, ['on']);
  assert.equal(p.senderId, CHAT);
  assert.equal(p.sourceEventId, 'u9');
  assert.equal(p.known, true);
});

test('parseCommandEvent — tolerates a string args field and a slash-prefixed payload.command', () => {
  const ev = cmdEvent('watch', { updateId: 'u10' });
  ev.payload.args = 'off';
  ev.payload.command = '/WATCH@FusionBot';
  const p = parseCommandEvent(ev);
  assert.equal(p.command, 'watch');
  assert.deepEqual(p.args, ['off']);
});

test('isAuthorisedSender — allowlist match, deny on miss, fail-closed on empty', () => {
  assert.equal(isAuthorisedSender(CHAT, ALLOW), true);
  assert.equal(isAuthorisedSender('999', ALLOW), false);
  assert.equal(isAuthorisedSender(CHAT, []), false);       // empty => deny all
  assert.equal(isAuthorisedSender(null, ALLOW), false);
  assert.equal(isAuthorisedSender(CHAT, new Set([CHAT])), true);
  assert.equal(isAuthorisedSender(CHAT, CHAT), true);       // single scalar allowed
});

test('resolveActiveRun — most-recent non-terminal wins; explicit id wins; terminal excluded', async () => {
  const store = createMemoryStore();
  const a = await store.createRun({ title: 'a' }, { now: 100 });
  const b = await store.createRun({ title: 'b' }, { now: 200 });
  // b is newest and non-terminal.
  assert.equal((await resolveActiveRun(store, [])).run_id, b.run_id);
  // Terminate b -> a becomes the active one.
  await store.setRunStatus(b.run_id, RUN_STATUS.CANCELLED, { now: 300 });
  assert.equal((await resolveActiveRun(store, [])).run_id, a.run_id);
  // Explicit id in args wins even if terminal.
  assert.equal((await resolveActiveRun(store, [b.run_id])).run_id, b.run_id);
});

// -------- /status ------------------------------------------------------------

test('/status — composes the full contract shape from a seeded run and ENQUEUES one [TOWER] reply', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store, {
    evidencePrRef: 'acme/widgets#7', evidenceCommitSha: 'deadbeefcafe', evidenceTaskRef: 'CU-869',
  });
  const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 1 }, { now: 1 });
  await store.setCurrentTurn(run.run_id, turn.turn_id, { now: 2 });
  await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: 3 });
  await store.setRunStatus(run.run_id, RUN_STATUS.AWAITING_RESPONDER, { now: 4 });

  const res = await handleCommandEvent(store, notifier, cmdEvent('status', { updateId: 's1' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.ok, true);
  assert.equal(res.authorised, true);
  assert.equal(res.runId, run.run_id);
  assert.equal(res.merge, false);
  const b = res.reply.body;
  assert.match(b, new RegExp(run.run_id));
  assert.match(b, /build\/WP: BUILD-010 WP1/);
  assert.match(b, /state: awaiting_responder/);
  assert.match(b, /expected responder: gpt_codex/);
  assert.match(b, /round: 0\/2/);
  assert.match(b, /head: deadbeef/);
  assert.match(b, /GitHub: https:\/\/github\.com\/acme\/widgets\/pull\/7/);
  assert.match(b, /ClickUp: https:\/\/app\.clickup\.com\/t\/869/);
  // Exactly one durable pending reply row.
  assert.equal(res.reply.enqueued, true);
  const n = await store.getNotification(res.reply.dedupKey);
  assert.equal(n.state, 'pending');
  assert.equal(n.logical_source, 'TOWER');
  assert.equal((await store.claimPendingNotifications(50)).length, 1);
});

test('/status — no active run yields a concise "no active run" reply', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const res = await handleCommandEvent(store, notifier, cmdEvent('status', { updateId: 's2' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.ok, true);
  assert.equal(res.runId, null);
  assert.match(res.reply.body, /no active run/i);
});

// -------- /trace -------------------------------------------------------------

test('/trace — compact newest-first lines + ClickUp detail link, no giant dump', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store, { evidenceTaskRef: 'CU-42' });
  await store.ingestEvent({ source: 'github', sourceEventId: 'g1', kind: 'pull_request.opened', runId: run.run_id }, { now: 20 });
  await store.ingestEvent({ source: 'github', sourceEventId: 'g2', headSha: 'abc', kind: 'check_suite.completed', runId: run.run_id }, { now: 30 });

  const res = await handleCommandEvent(store, notifier, cmdEvent('trace', { updateId: 't1' }), { now: 40, allowlist: ALLOW });
  assert.equal(res.ok, true);
  const b = res.reply.body;
  assert.match(b, /check_suite\.completed/);
  assert.match(b, /pull_request\.opened/);
  assert.match(b, /detail: https:\/\/app\.clickup\.com\/t\/42/);
  // Newest first: check event line precedes the PR event line.
  assert.ok(b.indexOf('check_suite.completed') < b.indexOf('pull_request.opened'));
});

// -------- /watch -------------------------------------------------------------

test('/watch on|milestones|off — maps to watch_level and confirms; bogus arg = usage, no mutation', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);

  const on = await handleCommandEvent(store, notifier, cmdEvent('watch', { args: ['on'], updateId: 'w1' }), { now: 10, allowlist: ALLOW });
  assert.equal(on.mutation, 'setRunWatchLevel(all)');
  assert.equal((await store.getRun(run.run_id)).watch_level, 'all');

  const off = await handleCommandEvent(store, notifier, cmdEvent('watch', { args: ['off'], updateId: 'w2' }), { now: 11, allowlist: ALLOW });
  assert.equal(off.mutation, 'setRunWatchLevel(terminal)');
  assert.equal((await store.getRun(run.run_id)).watch_level, 'terminal');

  const ms = await handleCommandEvent(store, notifier, cmdEvent('watch', { args: ['milestones'], updateId: 'w3' }), { now: 12, allowlist: ALLOW });
  assert.equal(ms.mutation, 'setRunWatchLevel(milestones)');
  assert.equal((await store.getRun(run.run_id)).watch_level, 'milestones');

  const bad = await handleCommandEvent(store, notifier, cmdEvent('watch', { args: ['loud'], updateId: 'w4' }), { now: 13, allowlist: ALLOW });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid-watch-arg');
  assert.equal(bad.mutation, null);
  assert.match(bad.reply.body, /Usage: \/watch on\|milestones\|off/);
  assert.equal((await store.getRun(run.run_id)).watch_level, 'milestones'); // unchanged
});

// -------- /pause /resume /stop ----------------------------------------------

test('/pause + /resume — flip paused durable state and confirm', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);

  const p = await handleCommandEvent(store, notifier, cmdEvent('pause', { updateId: 'p1' }), { now: 10, allowlist: ALLOW });
  assert.equal(p.mutation, 'setRunPaused(true)');
  assert.equal((await store.getRun(run.run_id)).paused, true);
  assert.match(p.reply.body, /Paused/);

  const r = await handleCommandEvent(store, notifier, cmdEvent('resume', { updateId: 'r1' }), { now: 11, allowlist: ALLOW });
  assert.equal(r.mutation, 'setRunPaused(false)');
  assert.equal((await store.getRun(run.run_id)).paused, false);
  assert.match(r.reply.body, /Resumed/);
});

test('/stop — requests a safe halt and confirms the atomic-boundary contract', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);
  const res = await handleCommandEvent(store, notifier, cmdEvent('stop', { updateId: 'st1' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.mutation, 'requestRunStop');
  assert.equal((await store.getRun(run.run_id)).stop_requested, true);
  assert.match(res.reply.body, /halt safely at the next atomic boundary/);
});

// -------- /approve — NEVER a merge ------------------------------------------

test('/approve on a NON-pending run replies "nothing pending", performs NO mutation and NO merge', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store); // status 'created' — no pending decision
  const res = await handleCommandEvent(store, notifier, cmdEvent('approve', { updateId: 'a1' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.ok, true);
  assert.equal(res.mutation, null, 'no gate advance when nothing is pending');
  assert.equal(res.merge, false);
  assert.match(res.reply.body, /Nothing pending to approve/);
  assert.match(res.reply.body, /No merge performed/);
  // The run is untouched.
  assert.equal((await store.getRun(run.run_id)).status, RUN_STATUS.CREATED);
});

test('/approve on an awaiting_decision run ADVANCES the gate (-> active, decision cleared) and asserts NO merge action exists', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);
  await parkAwaitingDecision(store, run.run_id);
  const before = await store.getRun(run.run_id);
  assert.equal(before.status, RUN_STATUS.AWAITING_DECISION);
  assert.equal(before.decision_required, true);

  const res = await handleCommandEvent(store, notifier, cmdEvent('approve', { updateId: 'a2' }), { now: 20, allowlist: ALLOW });
  assert.equal(res.ok, true);
  assert.match(res.mutation, /advance_gate/);
  assert.equal(res.merge, false, 'the router carries no merge path — merge is always false');
  assert.match(res.reply.body, /No merge performed/);

  const after = await store.getRun(run.run_id);
  assert.equal(after.status, RUN_STATUS.ACTIVE, 'gate advanced back to active');
  assert.equal(after.decision_required, false, 'decision cleared');
  assert.equal(after.no_autonomous_merge, true, 'no-autonomous-merge invariant untouched');

  // PROOF (no merge path): the router never touched the external-write outbox, and
  // `merge`/`merge_pr` are in the FORBIDDEN set no code path here can emit.
  assert.equal(await store.getWrite('any'), null, 'no external write (no merge) was ever claimed');
  assert.ok(FORBIDDEN_ACTIONS.includes('merge') && FORBIDDEN_ACTIONS.includes('merge_pr'));
});

test('/approve is idempotent — a redelivered approve after the gate advanced replies "nothing pending"', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);
  await parkAwaitingDecision(store, run.run_id);
  const ev = cmdEvent('approve', { updateId: 'a3' });
  const first = await handleCommandEvent(store, notifier, ev, { now: 20, allowlist: ALLOW });
  const second = await handleCommandEvent(store, notifier, ev, { now: 21, allowlist: ALLOW });
  assert.match(first.mutation, /advance_gate/);
  // Same durable event => the reply dedups (one physical reply row) AND the second
  // pass finds the run already active (no second advance).
  assert.equal(second.mutation, null, 'no second advance — the gate is no longer pending');
  assert.equal((await store.getRun(run.run_id)).status, RUN_STATUS.ACTIVE);
  assert.equal(second.reply.enqueued, false, 'redelivered reply collides on the dedup key — enqueued once');
});

// -------- auth: silent default-deny -----------------------------------------

test('unauthorised sender — ZERO reply, ZERO mutation, audited (silent default-deny)', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);
  const res = await handleCommandEvent(store, notifier, cmdEvent('pause', { sender: '999', updateId: 'x1' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.authorised, false);
  assert.equal(res.reason, 'unauthorised');
  assert.equal(res.audited, true);
  assert.equal(res.reply, null, 'no reply for an unauthorised sender');
  // No mutation happened.
  assert.equal((await store.getRun(run.run_id)).paused, false);
  // No notification enqueued at all.
  assert.equal((await store.claimPendingNotifications(50)).length, 0);
});

// -------- unknown command ----------------------------------------------------

test('unknown/malformed command — brief help reply listing the commands, no mutation', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  await seedRun(store);
  const res = await handleCommandEvent(store, notifier, cmdEvent('frobnicate', { updateId: 'u2' }), { now: 10, allowlist: ALLOW });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unknown-command');
  assert.equal(res.mutation, null);
  for (const c of GOVERNANCE_COMMANDS) assert.match(res.reply.body, new RegExp(`/${c}`));
});

// -------- redelivery / idempotency ------------------------------------------

test('redelivered command update (same source_event_id) — ONE mutation-effect, ONE reply', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const run = await seedRun(store);
  const ev = cmdEvent('pause', { updateId: 'dup-1' });
  const first = await handleCommandEvent(store, notifier, ev, { now: 10, allowlist: ALLOW });
  const second = await handleCommandEvent(store, notifier, ev, { now: 11, allowlist: ALLOW });
  assert.equal(first.reply.enqueued, true);
  assert.equal(second.reply.enqueued, false, 'second reply collides on the dedup key');
  // Mutation is idempotent (still paused once) and exactly one reply row exists.
  assert.equal((await store.getRun(run.run_id)).paused, true);
  assert.equal((await store.claimPendingNotifications(50)).length, 1);
});

test('handleCommandEvent never throws — a malformed event object returns an error result', async () => {
  const store = createMemoryStore();
  const notifier = makeNotifier();
  const res = await handleCommandEvent(store, notifier, null, { now: 10, allowlist: ALLOW });
  assert.equal(res.ok, false);
  assert.equal(res.merge, false);
});
