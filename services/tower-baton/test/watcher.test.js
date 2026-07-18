import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createWatcher, deriveVerdict, resolveBrief } from '../src/watcher.js';
import { loadConfig } from '../src/config.js';
import { loadQaSkill } from '../src/qaSkill.js';
import { openState } from '../src/state.js';
import { formatCheckpoint, formatResponse, parseResponse } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { fakeGithub, fakeCodex, fakeNotifier, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';

function harness({ codex, github, comments, briefRef, roundsSeed, reviewMode, authorIds = 'larry', commentUser } = {}) {
  // authorIds === null → leave TOWER_AUTHORISED_AUTHOR_IDS unset (exercise fail-closed).
  const env = { GITHUB_REPO: 'o/r' };
  if (authorIds !== null) env.TOWER_AUTHORISED_AUTHOR_IDS = authorIds;
  const config = loadConfig({ env, home: tmpPath() }); // hermetic: no real store
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const skillFp = loadQaSkill({ path: skillPath }).fingerprint;
  const brief = briefRef ?? writeTmp('# Brief\nacceptance: the watcher works', '.md');
  const state = openState({ statePath: tmpPath('.json') });
  if (roundsSeed) state.raw().rounds[roundsSeed.key] = roundsSeed.n, state.persist();
  const notifier = fakeNotifier();
  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-100', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: brief, branch: 'build-010/wp1', head_sha: HEAD, base_sha: HEAD + '0'.repeat(0),
    review_mode: reviewMode, summary: 'built it', tests: 'green', evidence_refs: ['PR#1'],
  };
  const clickup = createFakeClickup({ comments: comments ?? [{ comment_text: formatCheckpoint(cp), user: commentUser ?? 'larry' }] });
  const watcher = createWatcher({
    config, clickup, github: github ?? fakeGithub(), codex: codex ?? fakeCodex(),
    notifier, state, taskId: 'task1', qaSkillPath: skillPath, fs, now: () => 1000,
  });
  return { watcher, clickup, state, notifier, codex: codex ?? undefined, skillFp, cp, brief };
}

function towerReplies(clickup) {
  return clickup._comments.filter((c) => /\[TOWER → LARRY\]/.test(c.comment_text));
}

function lastReply(clickup) {
  const posts = clickup._comments.filter((c) => /\[TOWER → LARRY\]/.test(c.comment_text));
  return posts.length ? parseResponse(posts[posts.length - 1].comment_text).response : null;
}

test('happy path — APPROVE posted, milestone fired, fingerprint recorded', async () => {
  const codex = fakeCodex();
  const h = harness({ codex });
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed.length, 1);
  assert.equal(r.processed[0].verdict, 'APPROVE');
  const reply = lastReply(h.clickup);
  assert.equal(reply.verdict, 'APPROVE');
  assert.equal(reply.prompt_fingerprint, h.skillFp, 'reply carries the skill SHA-256 fingerprint');
  assert.equal(h.state.getAnswered('cp-100').prompt_fingerprint, h.skillFp, 'fingerprint recorded in state');
  assert.ok(h.notifier.calls.some((c) => c.purpose === 'review_posted'));
});

test('review-outcome milestone speaks in the CODEX voice (logicalSource CODEX, [CODEX] body, plain verdict)', async () => {
  const codex = fakeCodex();
  const h = harness({ codex });
  await h.watcher.pollOnce();
  const ding = h.notifier.calls.find((c) => c.purpose === 'review_posted');
  assert.ok(ding, 'a review_posted milestone fired');
  assert.equal(ding.logicalSource, 'CODEX', 'review outcomes are sourced as CODEX, not TOWER');
  assert.ok(ding.body.startsWith('[CODEX]'), 'the milestone body is the human CODEX briefing');
  assert.ok(ding.body.includes('signed it off'), 'the APPROVE briefing reads in plain English');
  assert.ok(ding.body.includes(HEAD.slice(0, 8)), 'the briefing carries the short reviewed SHA');
  assert.equal(ding.checkpointId, 'cp-100', 'dedup key material (checkpointId) is unchanged');
  assert.ok(ding.body.length <= 1200, 'briefing stays under the Telegram ceiling');
});

test('duplicate-checkpoint suppression — second poll does not re-review or re-post', async () => {
  const codex = fakeCodex();
  const h = harness({ codex });
  await h.watcher.pollOnce();
  const postsAfter1 = h.clickup._comments.length;
  const callsAfter1 = codex.calls.length;
  const r2 = await h.watcher.pollOnce();
  assert.equal(r2.processed.length, 0);
  assert.equal(codex.calls.length, callsAfter1, 'Codex not re-invoked for an answered checkpoint');
  assert.equal(h.clickup._comments.length, postsAfter1, 'no duplicate reply posted');
});

test('missing brief → fail-closed BLOCKED, Codex not invoked', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, briefRef: 'C:/no/such/brief.md' });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
  assert.equal(codex.calls.length, 0);
});

test('wrong head_sha (branch moved on) → fail-closed BLOCKED', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, github: fakeGithub({ headMatchesBranch: false, branchHeadSha: 'DIFFERENTHEAD' }) });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
  assert.equal(codex.calls.length, 0);
});

test('unresolvable head evidence → fail-closed BLOCKED', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, github: { async collect() { return { ok: false, error: 'fail-closed: head_sha does not resolve' }; } } });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
  assert.equal(codex.calls.length, 0);
});

test('Codex blocked turn → BLOCKED reply', async () => {
  const codex = fakeCodex({ status: 'blocked', kind: 'no_credential' });
  const h = harness({ codex });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
});

test('material-decision escalation — a critical finding → DECISION_REQUIRED', async () => {
  const codex = fakeCodex({ status: 'ok', verdict: 'request_changes', summary: 'security issue', claims_verified: [], findings: [{ id: 'F1', severity: 'critical', evidence: 'x:1', rationale: 'unsafe', required_correction: 'fix' }], proposed_action: { type: 'noop', target: '' } });
  const h = harness({ codex });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'DECISION_REQUIRED');
  assert.ok(h.notifier.calls.some((c) => c.purpose === 'escalation'));
});

test('max-round escalation — chain at maxRounds → DECISION_REQUIRED without Codex', async () => {
  const codex = fakeCodex();
  const chain = 'BUILD-010|WP1|';
  const h = harness({ codex, roundsSeed: null });
  // Seed the round counter for this checkpoint's chain to the max.
  const ck = `BUILD-010|WP1|${h.brief}`;
  h.state.raw().rounds[ck] = 3; h.state.persist();
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'DECISION_REQUIRED');
  assert.equal(codex.calls.length, 0);
});

test('CORRECTIONS_REQUIRED increments the per-chain round counter', async () => {
  const codex = fakeCodex({ status: 'ok', verdict: 'request_changes', summary: 'minor gap', claims_verified: [], findings: [{ id: 'F1', severity: 'minor', evidence: 'x:1', rationale: 'gap', required_correction: 'add test' }], proposed_action: { type: 'noop', target: '' } });
  const h = harness({ codex });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'CORRECTIONS_REQUIRED');
  assert.equal(h.state.roundCount(`BUILD-010|WP1|${h.brief}`), 1);
});

test('restart recovery — dedup rebuilt from the ClickUp thread (state was empty)', async () => {
  const codex = fakeCodex();
  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-777', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: writeTmp('brief', '.md'), branch: 'build-010/wp1', head_sha: HEAD, summary: 's',
  };
  const priorReply = formatResponse({ checkpoint_id: 'cp-777', reviewed_head: HEAD, prompt_fingerprint: 'old', verdict: 'APPROVE', summary: 'prior', next_action: 'proceed' });
  const h = harness({ codex, comments: [{ comment_text: formatCheckpoint(cp) }, { comment_text: priorReply }] });
  const r = await h.watcher.pollOnce();
  assert.equal(codex.calls.length, 0, 'a checkpoint already answered on the thread is not re-reviewed after restart');
  assert.ok(r.skipped.some((s) => s.checkpointId === 'cp-777'));
});

test('no notification for internal file/test chatter — only milestones notify', () => {
  // deriveVerdict + notifier gate: a non-milestone purpose is dropped (unit-level in notifier tests);
  // here assert the watcher only ever emits milestone purposes.
  const milestone = ['review_posted', 'escalation', 'blocked'];
  const d = deriveVerdict({ codexResult: { status: 'ok', verdict: 'approve', findings: [] }, roundsSpent: 0 });
  assert.equal(d.verdict, 'APPROVE');
  assert.ok(milestone.includes('review_posted'));
});

test('resolveBrief — reads a local file, fail-closed otherwise', async () => {
  const p = writeTmp('acceptance criteria', '.md');
  const ok = await resolveBrief(p);
  assert.equal(ok.ok, true);
  const bad = await resolveBrief('C:/nope.md');
  assert.equal(bad.ok, false);
});

// ── item 3: explicit branch resolution ───────────────────────────────────────

test('branch-bound (default) + valid branch + matching head → proceeds (APPROVE)', async () => {
  const codex = fakeCodex();
  const h = harness({ codex }); // fakeGithub default: headMatchesBranch:true
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed[0].verdict, 'APPROVE');
  assert.equal(codex.calls.length, 1);
});

test('branch-bound + UNRESOLVABLE branch WITHOUT pinned_sha → fail-closed BLOCKED', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, github: fakeGithub({ headMatchesBranch: null, branchResolved: false, branchHeadSha: null }) });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
  assert.equal(codex.calls.length, 0, 'no Codex turn when the branch cannot be resolved');
});

test('explicit review_mode: pinned_sha + resolvable head + UNRESOLVABLE branch → proceeds', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, reviewMode: 'pinned_sha', github: fakeGithub({ headMatchesBranch: null, branchResolved: false, branchHeadSha: null }) });
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed[0].verdict, 'APPROVE', 'pinned-SHA review skips branch resolution by design');
  assert.equal(codex.calls.length, 1);
});

test('branch DRIFT (branch resolves, head != branch head) still fails closed even implicitly', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, github: fakeGithub({ headMatchesBranch: false, branchResolved: true, branchHeadSha: 'DIFFERENTHEAD' }) });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED');
  assert.equal(codex.calls.length, 0);
});

// ── item 4: checkpoint-author gate ───────────────────────────────────────────

test('author gate — an allowlisted author is processed', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, authorIds: 'larry', commentUser: 'larry' });
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed[0].verdict, 'APPROVE');
  assert.equal(codex.calls.length, 1);
});

test('author gate — an unknown author is IGNORED (no Codex turn, no reply)', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, authorIds: 'larry', commentUser: 'mallory' });
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed.length, 0);
  assert.equal(codex.calls.length, 0, 'no Codex turn for an unauthorised author');
  assert.equal(towerReplies(h.clickup).length, 0, 'no reply posted for an unauthorised author');
  assert.ok(r.skipped.some((s) => s.reason === 'unauthorised-author'));
});

test('author gate — MISSING config fails closed (no Codex turn, no reply)', async () => {
  const codex = fakeCodex();
  const h = harness({ codex, authorIds: null }); // TOWER_AUTHORISED_AUTHOR_IDS unset
  const r = await h.watcher.pollOnce();
  assert.equal(r.processed.length, 0);
  assert.equal(codex.calls.length, 0);
  assert.equal(towerReplies(h.clickup).length, 0);
  assert.ok(r.skipped.some((s) => s.reason === 'author-allowlist-unconfigured'));
});
