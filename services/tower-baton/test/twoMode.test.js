// WP3 -- two-mode routing: Codex = correction-loop reviewer; Fable = adversarial
// cold-final reviewer. A Codex APPROVE auto-routes into a Fable cold-final pass; only
// Codex APPROVE + Fable APPROVE is merge-ready. All WP1 protections wrap the Fable turn.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createWatcher, computeMergeReady } from '../src/watcher.js';
import { loadConfig } from '../src/config.js';
import { loadQaSkill } from '../src/qaSkill.js';
import { openState } from '../src/state.js';
import { formatCheckpoint, parseResponse, parseFableResponse } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { fakeGithub, fakeCodex, fakeFable, fakeNotifier, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';
import { wireText } from '../src/telegramNotifier.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';

function harness({ codex, fable, extraEnv = {}, cycleWatchdogMs, failurePostDeadlineMs, makeClickup, briefRef } = {}) {
  const env = { GITHUB_REPO: 'o/r', TOWER_AUTHORISED_AUTHOR_IDS: 'larry' };
  Object.assign(env, extraEnv);
  const config = loadConfig({ env, home: tmpPath() });
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const brief = briefRef ?? writeTmp('# Brief\nacceptance: the watcher works', '.md');
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = fakeNotifier();
  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-100', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: brief, branch: 'build-010/wp1', head_sha: HEAD, summary: 'built it', tests: 'green', evidence_refs: ['PR#1'],
  };
  const cpComment = { comment_text: formatCheckpoint(cp), user: 'larry' };
  const clickup = makeClickup ? makeClickup(cpComment) : createFakeClickup({ comments: [cpComment] });
  const watcher = createWatcher({
    config, clickup, github: fakeGithub(), codex: codex ?? fakeCodex(), fable: fable ?? fakeFable(),
    notifier, state, taskId: 'task1', qaSkillPath: skillPath, fs, now: () => 1000,
    ...(cycleWatchdogMs !== undefined ? { cycleWatchdogMs } : {}),
    ...(failurePostDeadlineMs !== undefined ? { failurePostDeadlineMs } : {}),
  });
  return { watcher, clickup, state, notifier, brief };
}

const towerReplies = (c) => c._comments.filter((x) => /\[TOWER [^\]]*LARRY\]/.test(x.comment_text));
const fableReplies = (c) => c._comments.filter((x) => /\[FABLE [^\]]*LARRY\]/.test(x.comment_text));
const lastTower = (c) => { const p = towerReplies(c); return p.length ? parseResponse(p[p.length - 1].comment_text).response : null; };
const lastFable = (c) => { const p = fableReplies(c); return p.length ? parseFableResponse(p[p.length - 1].comment_text).response : null; };

test('computeMergeReady -- merge-ready ONLY when both principals APPROVE', () => {
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE' }), true);
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'CORRECTIONS_REQUIRED' }), false);
  assert.equal(computeMergeReady({ codexVerdict: 'CORRECTIONS_REQUIRED', fableVerdict: 'APPROVE' }), false);
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'BLOCKED' }), false);
});

test('Codex APPROVE AUTO-ROUTES into a Fable cold-final turn; BOTH verdicts posted, attributed to their principals', async () => {
  const codex = fakeCodex();
  const fable = fakeFable();
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(codex.calls.length, 1, 'Codex ran the correction-loop review');
  assert.equal(fable.calls.length, 1, 'a Codex APPROVE auto-routed into ONE Fable cold-final turn');
  // Fable reviewed the SAME head as Codex.
  assert.equal(fable.calls[0].packet.head_sha, codex.calls[0].packet.head_sha);
  assert.equal(fable.calls[0].packet.head_sha, HEAD);

  // Both replies are on the thread, each under its own principal marker.
  assert.equal(towerReplies(h.clickup).length, 1, 'the Codex [TOWER -> LARRY] reply is posted');
  assert.equal(fableReplies(h.clickup).length, 1, 'the Fable [FABLE -> LARRY] reply is posted');
  const fableReply = lastFable(h.clickup);
  assert.equal(fableReply.review_stage, 'cold_final', 'the Fable reply is explicitly the cold-final stage');
  assert.equal(fableReply.reviewer, 'claude_fable', 'attributed to the claude_fable principal');
  assert.equal(r.processed[0].reviewStage, 'cold_final');
});

test('Codex APPROVE + Fable APPROVE -> MERGE-READY', async () => {
  const codex = fakeCodex();
  const fable = fakeFable(); // default APPROVE
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(r.processed[0].verdict, 'APPROVE', 'codex correction-loop verdict');
  assert.equal(r.processed[0].fableVerdict, 'APPROVE', 'fable cold-final verdict');
  assert.equal(r.processed[0].mergeReady, true, 'both APPROVE -> merge-ready');

  const fableReply = lastFable(h.clickup);
  assert.equal(fableReply.verdict, 'APPROVE');
  assert.equal(fableReply.merge_ready, 'yes', 'the [FABLE -> LARRY] reply marks merge_ready: yes');
  assert.match(fableReply.next_action, /MERGE-READY/);

  // Durable state records the FINAL outcome + merge-ready flag.
  assert.equal(h.state.getAnswered('cp-100').verdict, 'APPROVE');
  assert.equal(h.state.getAnswered('cp-100').merge_ready, true);

  // Two DISTINCT milestones fired -- CODEX (correction-loop) + FABLE (cold-final).
  const codexDing = h.notifier.calls.find((c) => c.logicalSource === 'CODEX');
  const fableDing = h.notifier.calls.find((c) => c.logicalSource === 'FABLE');
  assert.ok(codexDing, 'a CODEX milestone fired');
  assert.ok(fableDing, 'a distinct FABLE milestone fired');
  assert.equal(fableDing.extra, 'cold_final', 'the FABLE ding uses a distinct dedup extra so it is not swallowed');
  assert.ok(wireText(fableDing.logicalSource, fableDing.body).startsWith('[FABLE] '), 'the notifier tags the Fable ding [FABLE], distinct from [CODEX]');
  assert.ok(!fableDing.body.includes('[FABLE]'), 'the composed body carries no [FABLE] tag -- the notifier owns it');
});

test('Codex APPROVE + Fable CORRECTIONS -> corrections outcome, NOT merge-ready (round advanced)', async () => {
  const codex = fakeCodex();
  const fable = fakeFable({ status: 'ok', verdict: 'request_changes', summary: 'cold-final caught an untested edge', claims_verified: [], findings: [{ id: 'C1', severity: 'low', evidence: 'x:9', rationale: 'small gap the loop missed', required_correction: 'add the edge test' }], proposed_action: { type: 'post_review', target: 'pr' } });
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(r.processed[0].verdict, 'APPROVE', 'codex approved');
  assert.equal(r.processed[0].fableVerdict, 'CORRECTIONS_REQUIRED', 'fable sent it back');
  assert.equal(r.processed[0].mergeReady, false, 'a Fable corrections outcome is NOT merge-ready');

  const fableReply = lastFable(h.clickup);
  assert.equal(fableReply.verdict, 'CORRECTIONS_REQUIRED');
  assert.equal(fableReply.merge_ready, 'no');

  // The combined loop is bounded: a Fable corrections outcome advances the per-chain round.
  assert.equal(h.state.roundCount(`BUILD-010|WP1|${h.brief}`), 1);
  assert.equal(h.state.getAnswered('cp-100').verdict, 'CORRECTIONS_REQUIRED', 'the FINAL (fable) outcome is recorded');
});

test('a NON-APPROVE Codex verdict does NOT route to Fable (correction-loop only, no merge-ready)', async () => {
  const codex = fakeCodex({ status: 'ok', verdict: 'request_changes', summary: 'loop found a gap', claims_verified: [], findings: [{ id: 'L1', severity: 'low', evidence: 'x:1', rationale: 'gap', required_correction: 'fix' }], proposed_action: { type: 'noop', target: '' } });
  const fable = fakeFable();
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(r.processed[0].verdict, 'CORRECTIONS_REQUIRED');
  assert.equal(fable.calls.length, 0, 'Fable is not invoked until Codex APPROVES');
  assert.equal(fableReplies(h.clickup).length, 0, 'no [FABLE -> LARRY] reply for a non-approve');
  assert.equal(r.processed[0].mergeReady, undefined, 'no merge-ready signal on the correction-loop-only path');
});

test('a Codex APPROVE that has not yet passed Fable is NOT labelled merge-ready (Fable BLOCKED)', async () => {
  const codex = fakeCodex();
  const fable = fakeFable({ status: 'blocked', kind: 'no_binary' });
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(r.processed[0].fableVerdict, 'BLOCKED', 'a blocked Fable turn maps to BLOCKED');
  assert.equal(r.processed[0].mergeReady, false, 'Codex APPROVE + Fable BLOCKED is NOT merge-ready');
  assert.equal(lastFable(h.clickup).merge_ready, 'no');
});

test('WP1 wraps the Fable turn -- a STUCK Fable cold-final is reaped and posted as a recoverable failure (stage=fable_turn); the loop recovers', async () => {
  const codex = fakeCodex(); // APPROVE -> routes to fable
  let releaseTurn;
  const wedged = new Promise((res) => { releaseTurn = res; });
  const fable = { calls: [], async runTurn(a) { this.calls.push(a); return wedged; } };
  const h = harness({ codex, fable, cycleWatchdogMs: 40, failurePostDeadlineMs: 40 });

  const r = await h.watcher.pollOnce(); // MUST return -- the watchdog rescues the wedged Fable turn
  assert.equal(fable.calls.length, 1, 'the cold-final turn was started');
  const recovery = lastTower(h.clickup);
  assert.ok(recovery, 'a recoverable [TOWER -> LARRY] verdict was posted (no silent HALT)');
  assert.equal(recovery.verdict, 'BLOCKED', 'a stuck Fable turn posts a recoverable BLOCKED (existing vocabulary)');
  assert.match(recovery.summary, /TOWER_RUN_FAILED/);
  assert.match(recovery.summary, /run_timeout/);
  assert.match(recovery.summary, /stage=fable_turn/, 'the failure is attributed to the Fable turn stage');
  assert.equal(fableReplies(h.clickup).length, 0, 'the wedged Fable produced no cold-final verdict');
  assert.equal(r.processed[0].runFailed, true);
  assert.ok(h.notifier.calls.some((c) => c.purpose === 'blocked'), 'a blocked milestone fired for the failure');

  // The loop truly recovered: the now-answered checkpoint is not reprocessed.
  const r2 = await h.watcher.pollOnce();
  assert.equal(r2.processed.length, 0, 'answered -- not reprocessed');

  releaseTurn({ ok: true, blocked: false, structuredResult: { status: 'ok', verdict: 'approve', summary: 'late', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } }, envelope: {}, signature: null });
  await wedged;
  await new Promise((res) => setTimeout(res, 0));
});

test('the Fable cold-final reply is passed through config.redact (no secret VALUE reaches the thread)', async () => {
  const leak = 'fable-reply-secret-value-000009';
  const codex = fakeCodex();
  // The secret rides in Fable's finding text; the [FABLE -> LARRY] body must be redacted.
  const fable = fakeFable({ status: 'ok', verdict: 'request_changes', summary: `cold-final note ${leak}`, claims_verified: [], findings: [{ id: 'S1', severity: 'low', evidence: 'x:1', rationale: 'gap', required_correction: `do not print ${leak}` }], proposed_action: { type: 'noop', target: '' } });
  const h = harness({ codex, fable, extraEnv: { TELEGRAM_BOT_TOKEN: leak } });
  await h.watcher.pollOnce();
  const raw = fableReplies(h.clickup)[0].comment_text;
  assert.ok(!raw.includes(leak), 'the secret VALUE does not leak into the [FABLE -> LARRY] reply');
  assert.ok(raw.includes('***redacted***'), 'the Fable reply body was passed through config.redact');
});
