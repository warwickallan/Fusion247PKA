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
