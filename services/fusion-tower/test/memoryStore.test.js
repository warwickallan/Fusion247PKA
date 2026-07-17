import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../src/store/memoryStore.js';

async function seedRun(store, over = {}) {
  return store.createRun({ title: 't', scope: 's', maxRounds: 2, ...over }, { now: 1000 });
}

test('seed identities include honest gpt_codex = openai-codex', async () => {
  const store = createMemoryStore();
  const id = await store.getAgentIdentity('gpt_codex');
  assert.equal(id.provider, 'openai-codex');
  const all = await store.listAgentIdentities();
  assert.equal(all.length, 4);
});

test('event dedup PRIMARY: duplicate (source, source_event_id) => one row', async () => {
  const store = createMemoryStore();
  const a = await store.ingestEvent({ source: 'github', sourceEventId: 'D1', kind: 'pull_request.opened' }, { now: 1 });
  const b = await store.ingestEvent({ source: 'github', sourceEventId: 'D1', kind: 'pull_request.opened' }, { now: 2 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal((await store.listEvents()).length, 1);
});

test('event dedup SECONDARY: same (github, head_sha, kind) under different ids => one advancing row', async () => {
  const store = createMemoryStore();
  const a = await store.ingestEvent({ source: 'github', sourceEventId: 'X1', headSha: 'abc', kind: 'check_suite.completed' }, { now: 1 });
  const b = await store.ingestEvent({ source: 'github', sourceEventId: 'X2', headSha: 'abc', kind: 'check_suite.completed' }, { now: 2 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal((await store.listEvents()).length, 1);
});

test('self-generated / tower events never advance', async () => {
  const store = createMemoryStore();
  await store.ingestEvent({ source: 'tower', sourceEventId: 'S1', kind: 'noop' }, { now: 1 });
  await store.ingestEvent({ source: 'github', sourceEventId: 'S2', kind: 'issue_comment.created', selfGenerated: true }, { now: 2 });
  await store.ingestEvent({ source: 'github', sourceEventId: 'S3', kind: 'issue_comment.created' }, { now: 3 });
  const next = await store.claimNextEvent();
  assert.equal(next.source_event_id, 'S3', 'only the non-self event is claimable');
});

test('advance-once: processed flips exactly once', async () => {
  const store = createMemoryStore();
  const { event } = await store.ingestEvent({ source: 'github', sourceEventId: 'P1', kind: 'x' }, { now: 1 });
  const p1 = await store.markEventProcessed(event.event_id, { now: 2 });
  assert.equal(p1.processed, true);
  const p2 = await store.markEventProcessed(event.event_id, { now: 3 });
  assert.equal(p2.processed_at, p1.processed_at, 'second mark is idempotent, does not re-stamp');
  assert.equal(await store.claimNextEvent(), null, 'processed event is not re-claimable');
});

test('turn idempotency: duplicate (run_id, ordinal) => one turn', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const t1 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 1 });
  const t2 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 2 });
  assert.equal(t1.turn_id, t2.turn_id);
  assert.equal((await store.listTurns(run.run_id)).length, 1);
});

test('dispatched turn always carries a lease deadline', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const turn = await store.appendTurn(run.run_id, { expectedResponder: 'larry' }, { now: 1 });
  const d = await store.dispatchTurn(turn.turn_id, { now: 1000, leaseMs: 5000 });
  assert.equal(d.state, 'dispatched');
  assert.equal(d.dispatched_at, 1000);
  assert.equal(d.lease_deadline_at, 6000);
});

test('watchdog reaps only EXPIRED dispatched turns; returned turns untouched', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const t1 = await store.appendTurn(run.run_id, { expectedResponder: 'larry', ordinal: 1 }, { now: 1 });
  const t2 = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 2 }, { now: 1 });
  await store.dispatchTurn(t1.turn_id, { now: 0, leaseMs: 100 });   // expires at 100
  await store.dispatchTurn(t2.turn_id, { now: 0, leaseMs: 999999 }); // not expired
  await store.recordTurnResult(t2.turn_id, { structuredResult: { ok: 1 }, signerPrincipal: 'gpt_codex' }, { now: 50 });
  const sweep = await store.watchdogSweep({ now: 200 });
  assert.equal(sweep.reaped, 1);
  assert.equal((await store.getTurn(t1.turn_id)).state, 'timed_out');
  assert.equal((await store.getTurn(t2.turn_id)).state, 'returned', 'a returned turn is never clobbered');
});

test('signer must match expected responder on recordTurnResult', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex' }, { now: 1 });
  await store.dispatchTurn(turn.turn_id, { now: 1 });
  await assert.rejects(
    () => store.recordTurnResult(turn.turn_id, { structuredResult: {}, signerPrincipal: 'larry' }, { now: 2 }),
    /signed by/,
  );
});

test('max_rounds is a hard cap', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store, { maxRounds: 2 });
  await store.incrementRound(run.run_id, { now: 1 });
  await store.incrementRound(run.run_id, { now: 2 });
  await assert.rejects(() => store.incrementRound(run.run_id, { now: 3 }), /exceed max_rounds/);
});

test('terminal_outcome only allowed on a terminal status; illegal transition rejected', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  await store.setRunStatus(run.run_id, 'active', { now: 1 });
  await assert.rejects(
    () => store.setRunStatus(run.run_id, 'active', { now: 2, terminalOutcome: 'ready' }),
    /terminal_outcome only allowed/,
  );
  // active -> completed is legal and may carry an outcome.
  const done = await store.setRunStatus(run.run_id, 'completed', { now: 3, terminalOutcome: 'completed' });
  assert.equal(done.terminal_outcome, 'completed');
});

test('tower rejected as expected_responder', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  await assert.rejects(() => store.appendTurn(run.run_id, { expectedResponder: 'tower' }, { now: 1 }), /not a valid turn responder/);
});

// ---- external write outbox (GPT MEDIUM-1) ----------------------------------

function claimArgs(over = {}) {
  return {
    mutationKey: 'mk-1',
    targetKind: 'clickup_task',
    targetId: '869e5zu97',
    payloadChecksum: 'sha256:abc',
    mutationId: 'mid-1',
    ...over,
  };
}

test('outbox: claimWrite reserves the mutation key once; a second claim is claimed:false with the existing row', async () => {
  const store = createMemoryStore();
  const first = await store.claimWrite(claimArgs(), { now: 1 });
  assert.equal(first.claimed, true);
  assert.equal(first.write.state, 'applying');
  const second = await store.claimWrite(claimArgs(), { now: 2 });
  assert.equal(second.claimed, false, 'a second claim on the same mutation key does NOT re-reserve');
  assert.equal(second.write.write_id, first.write.write_id, 'returns the existing row');
});

test('outbox: an already applied_verified claim is visible to a re-claim (do-not-repost)', async () => {
  const store = createMemoryStore();
  await store.claimWrite(claimArgs(), { now: 1 });
  await store.markWriteApplied('mk-1', 'clickup-comment-123', { now: 2 });
  const again = await store.claimWrite(claimArgs(), { now: 3 });
  assert.equal(again.claimed, false);
  assert.equal(again.write.state, 'applied_verified');
  assert.equal(again.write.response_id, 'clickup-comment-123');
});

test('outbox: markWriteApplied REQUIRES a non-empty response id', async () => {
  const store = createMemoryStore();
  await store.claimWrite(claimArgs(), { now: 1 });
  await assert.rejects(() => store.markWriteApplied('mk-1', '', { now: 2 }), /REQUIRED/);
  await assert.rejects(() => store.markWriteApplied('mk-1', undefined, { now: 2 }), /REQUIRED/);
  const ok = await store.markWriteApplied('mk-1', 'cid-9', { now: 3 });
  assert.equal(ok.state, 'applied_verified');
  assert.equal(ok.response_id, 'cid-9');
});

test('outbox: a DISTINCT mutation key to the SAME target is NOT blocked (legitimate later review)', async () => {
  const store = createMemoryStore();
  const a = await store.claimWrite(claimArgs(), { now: 1 });
  const b = await store.claimWrite(
    claimArgs({ mutationKey: 'mk-2', mutationId: 'mid-2' }), { now: 2 },
  );
  assert.equal(a.claimed, true);
  assert.equal(b.claimed, true, 'a later, distinct review of the same task claims freshly');
  assert.equal(b.write.target_id, '869e5zu97');
});

test('outbox: error transitions bump attempt_count and record last_error', async () => {
  const store = createMemoryStore();
  await store.claimWrite(claimArgs(), { now: 1 });
  const u = await store.markWriteOutcomeUnknown('mk-1', new Error('timeout'), { now: 2 });
  assert.equal(u.state, 'outcome_unknown');
  assert.equal(u.attempt_count, 1);
  assert.equal(u.last_error, 'timeout');
  const r = await store.markWriteRetryPending('mk-1', new Error('429'), { now: 3 });
  assert.equal(r.state, 'retry_pending');
  assert.equal(r.attempt_count, 2);
  const f = await store.markWriteFailed('mk-1', new Error('gave up'), { now: 4 });
  assert.equal(f.state, 'failed');
  assert.equal(f.attempt_count, 3);
});

test('outbox: getWrite returns the row or null', async () => {
  const store = createMemoryStore();
  assert.equal(await store.getWrite('nope'), null);
  await store.claimWrite(claimArgs(), { now: 1 });
  const w = await store.getWrite('mk-1');
  assert.equal(w.mutation_key, 'mk-1');
});

test('outbox: duplicate mutation_id under a different mutation_key is rejected (unique)', async () => {
  const store = createMemoryStore();
  await store.claimWrite(claimArgs(), { now: 1 });
  await assert.rejects(
    () => store.claimWrite(claimArgs({ mutationKey: 'mk-other' }), { now: 2 }),
    /unique/i,
  );
});

// ---- Telegram notification outbox (BUILD-010 WP1) --------------------------

function notifArgs(over = {}) {
  return {
    dedupKey: 'run-1|decision_required|123456789|await-warwick',
    runId: null,
    recipient: '123456789',
    logicalSource: 'TOWER',
    purpose: 'decision_required',
    body: 'Decision required on run-1: approve the merge?',
    ...over,
  };
}

test('notify: enqueueNotification reserves the dedup key once; a second enqueue is enqueued:false with the existing row', async () => {
  const store = createMemoryStore();
  const first = await store.enqueueNotification(notifArgs(), { now: 1 });
  assert.equal(first.enqueued, true);
  assert.equal(first.notification.state, 'pending');
  const second = await store.enqueueNotification(notifArgs(), { now: 2 });
  assert.equal(second.enqueued, false, 'duplicate run+event+recipient+purpose does NOT re-enqueue');
  assert.equal(second.notification.notification_id, first.notification.notification_id);
});

test('notify: markNotificationSent REQUIRES a non-empty provider_message_id', async () => {
  const store = createMemoryStore();
  await store.enqueueNotification(notifArgs(), { now: 1 });
  await assert.rejects(() => store.markNotificationSent(notifArgs().dedupKey, '', { now: 2 }), /REQUIRED/);
  await assert.rejects(() => store.markNotificationSent(notifArgs().dedupKey, undefined, { now: 2 }), /REQUIRED/);
  const ok = await store.markNotificationSent(notifArgs().dedupKey, 'tg-42', { now: 3 });
  assert.equal(ok.state, 'sent');
  assert.equal(ok.provider_message_id, 'tg-42');
  assert.equal(ok.sent_at, 3);
});

test('notify: claimPendingNotifications returns only pending, oldest first', async () => {
  const store = createMemoryStore();
  await store.enqueueNotification(notifArgs({ dedupKey: 'a', purpose: 'run_created' }), { now: 1 });
  await store.enqueueNotification(notifArgs({ dedupKey: 'b', purpose: 'ci_red' }), { now: 2 });
  await store.enqueueNotification(notifArgs({ dedupKey: 'c', purpose: 'terminal_ready' }), { now: 3 });
  await store.markNotificationSent('b', 'tg-9', { now: 4 });
  const pending = await store.claimPendingNotifications(10);
  assert.deepEqual(pending.map((n) => n.dedup_key), ['a', 'c']);
});

test('notify: error/retire transitions bump attempt_count and record last_error', async () => {
  const store = createMemoryStore();
  await store.enqueueNotification(notifArgs(), { now: 1 });
  const f = await store.markNotificationFailed(notifArgs().dedupKey, new Error('bot 502'), { now: 2 });
  assert.equal(f.state, 'failed');
  assert.equal(f.attempt_count, 1);
  assert.equal(f.last_error, 'bot 502');
  const s = await store.markNotificationSuperseded(notifArgs().dedupKey, { now: 3 });
  assert.equal(s.state, 'superseded');
  assert.equal(s.attempt_count, 2);
});

test('notify: an invalid logical_source is rejected (vocabulary CHECK parity)', async () => {
  const store = createMemoryStore();
  await assert.rejects(
    () => store.enqueueNotification(notifArgs({ logicalSource: 'BOGUS' }), { now: 1 }),
    /invalid logical_source/,
  );
});

test('notify: a body carrying a bot-token shape is rejected (secret backstop parity)', async () => {
  const store = createMemoryStore();
  // Build the token-shape string at runtime so no static secret-shaped literal sits
  // in this file (keeps the repo secret-scan clean); the JS backstop still sees it.
  const tokenShape = `${'9'.repeat(9)}:${'z'.repeat(35)}`;
  await assert.rejects(
    () => store.enqueueNotification(
      notifArgs({ body: `leak ${tokenShape} here` }),
      { now: 1 },
    ),
    /bot-token shape/,
  );
});

test('notify: getNotification returns the row or null', async () => {
  const store = createMemoryStore();
  assert.equal(await store.getNotification('nope'), null);
  await store.enqueueNotification(notifArgs(), { now: 1 });
  const n = await store.getNotification(notifArgs().dedupKey);
  assert.equal(n.recipient, '123456789');
  assert.equal(n.logical_source, 'TOWER');
});

// ---- run control state (BUILD-010 WP1, migration 0005) ---------------------

test('control: a new run defaults to not paused, milestones watch, no stop', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  assert.equal(run.paused, false);
  assert.equal(run.watch_level, 'milestones');
  assert.equal(run.paused_at, null);
  assert.equal(run.stop_requested, false);
  assert.equal(run.stop_requested_at, null);
});

test('control: setRunPaused persists paused + paused_at, resume clears paused_at', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const paused = await store.setRunPaused(run.run_id, true, { now: 2000 });
  assert.equal(paused.paused, true);
  assert.equal(paused.paused_at, 2000);
  // Round-trip: a fresh read sees the durable state.
  assert.equal((await store.getRun(run.run_id)).paused, true);
  const resumed = await store.setRunPaused(run.run_id, false, { now: 3000 });
  assert.equal(resumed.paused, false);
  assert.equal(resumed.paused_at, null);
});

test('control: setRunWatchLevel round-trips and rejects an invalid level', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  for (const level of ['all', 'milestones', 'terminal']) {
    const r = await store.setRunWatchLevel(run.run_id, level, { now: 5 });
    assert.equal(r.watch_level, level);
    assert.equal((await store.getRun(run.run_id)).watch_level, level);
  }
  await assert.rejects(
    () => store.setRunWatchLevel(run.run_id, 'bogus', { now: 6 }),
    /invalid watch_level/,
  );
});

test('control: requestRunStop sets stop_requested + stamps stop_requested_at once', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  const stopped = await store.requestRunStop(run.run_id, { now: 4000 });
  assert.equal(stopped.stop_requested, true);
  assert.equal(stopped.stop_requested_at, 4000);
  // A repeated /stop is idempotent on the timestamp (keeps the first request time).
  const again = await store.requestRunStop(run.run_id, { now: 9000 });
  assert.equal(again.stop_requested, true);
  assert.equal(again.stop_requested_at, 4000);
});

test('control: unknown run rejects on every mutating control method', async () => {
  const store = createMemoryStore();
  await assert.rejects(() => store.setRunPaused('nope', true), /unknown run/);
  await assert.rejects(() => store.setRunWatchLevel('nope', 'all'), /unknown run/);
  await assert.rejects(() => store.requestRunStop('nope'), /unknown run/);
});

test('status: getRunStatus composes run + turn + rounds + evidence + control + last event + last notification', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store, {
    evidencePrRef: 'owner/repo#7', evidenceCommitSha: 'deadbeef', evidenceTaskRef: 'CU-123',
  });
  const turn = await store.appendTurn(run.run_id, { expectedResponder: 'gpt_codex', ordinal: 1 }, { now: 1 });
  await store.setCurrentTurn(run.run_id, turn.turn_id, { now: 2 });
  await store.setRunPaused(run.run_id, true, { now: 3 });
  await store.setRunWatchLevel(run.run_id, 'all', { now: 4 });
  await store.ingestEvent(
    { source: 'telegram', sourceEventId: 'u-1', kind: 'command:status', runId: run.run_id }, { now: 10 },
  );
  await store.enqueueNotification({
    dedupKey: `${run.run_id}|run_created|c|x`, runId: run.run_id, recipient: 'c',
    logicalSource: 'TOWER', purpose: 'run_created', body: 'created',
  }, { now: 11 });
  await store.markNotificationSent(`${run.run_id}|run_created|c|x`, 'tg-1', { now: 12 });

  const s = await store.getRunStatus(run.run_id);
  assert.equal(s.run.run_id, run.run_id);
  assert.equal(s.current_turn.expected_responder, 'gpt_codex');
  assert.equal(s.current_turn.state, 'pending');
  assert.deepEqual(s.rounds, { round_count: 0, max_rounds: 2 });
  assert.deepEqual(s.evidence, { pr_ref: 'owner/repo#7', commit_sha: 'deadbeef', task_ref: 'CU-123' });
  assert.equal(s.control.paused, true);
  assert.equal(s.control.paused_at, 3);
  assert.equal(s.control.watch_level, 'all');
  assert.equal(s.control.stop_requested, false);
  assert.equal(s.last_event.kind, 'command:status');
  assert.equal(s.last_event.received_at, 10);
  assert.equal(s.last_notification.state, 'sent');
  assert.equal(s.last_notification.sent_at, 12);
});

test('status: getRunStatus returns null for an unknown run; nulls when nothing attached', async () => {
  const store = createMemoryStore();
  assert.equal(await store.getRunStatus('nope'), null);
  const run = await seedRun(store);
  const s = await store.getRunStatus(run.run_id);
  assert.equal(s.current_turn, null);
  assert.equal(s.last_event, null);
  assert.equal(s.last_notification, null);
  assert.equal(s.control.watch_level, 'milestones');
});

test('trace: recentRunEvents returns the latest N for the run, newest first, bounded', async () => {
  const store = createMemoryStore();
  const run = await seedRun(store);
  for (let i = 1; i <= 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await store.ingestEvent(
      { source: 'telegram', sourceEventId: `u-${i}`, kind: `command:c${i}`, runId: run.run_id },
      { now: i * 10 },
    );
  }
  const recent = await store.recentRunEvents(run.run_id, 3);
  assert.equal(recent.length, 3);
  assert.deepEqual(recent.map((e) => e.kind), ['command:c5', 'command:c4', 'command:c3']);
  // Default limit is 10; only this run's events are returned.
  const all = await store.recentRunEvents(run.run_id);
  assert.equal(all.length, 5);
  assert.ok(all.every((e) => e.run_id === run.run_id));
});
