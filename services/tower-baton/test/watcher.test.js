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
import { wireText } from '../src/telegramNotifier.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';

function harness({ codex, github, comments, briefRef, roundsSeed, reviewMode, authorIds = 'larry', commentUser, extraEnv = {}, cycleWatchdogMs, failurePostDeadlineMs } = {}) {
  // authorIds === null → leave TOWER_AUTHORISED_AUTHOR_IDS unset (exercise fail-closed).
  const env = { GITHUB_REPO: 'o/r' };
  if (authorIds !== null) env.TOWER_AUTHORISED_AUTHOR_IDS = authorIds;
  // extraEnv lets a test inject a secret VALUE (e.g. TELEGRAM_BOT_TOKEN) so the
  // redaction path (config.redact) can be exercised end to end on the milestone body.
  Object.assign(env, extraEnv);
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
    ...(cycleWatchdogMs !== undefined ? { cycleWatchdogMs } : {}),
    ...(failurePostDeadlineMs !== undefined ? { failurePostDeadlineMs } : {}),
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

test('review-outcome milestone speaks in the CODEX voice (logicalSource CODEX, bare-status body, one [CODEX] added by the notifier layer, plain verdict)', async () => {
  const codex = fakeCodex();
  const h = harness({ codex });
  await h.watcher.pollOnce();
  const ding = h.notifier.calls.find((c) => c.purpose === 'review_posted');
  assert.ok(ding, 'a review_posted milestone fired');
  assert.equal(ding.logicalSource, 'CODEX', 'review outcomes are sourced as CODEX, not TOWER');
  // SINGLE-OWNER PREFIX: the composed BODY carries NO [CODEX] tag; the notifier's
  // wireText() (driven by logicalSource: 'CODEX') adds EXACTLY ONE on the final wire.
  assert.ok(!ding.body.includes('[CODEX]'), 'the composed milestone body carries no [CODEX] tag');
  assert.ok(ding.body.startsWith('APPROVED'), 'the body leads with the bare verdict/status line');
  const wired = wireText(ding.logicalSource, ding.body);
  assert.ok(wired.startsWith('[CODEX] '), 'the notifier layer adds exactly one [CODEX] prefix');
  assert.ok(!wired.includes('[CODEX] [CODEX]'), 'no doubled [CODEX] on the final wire');
  assert.ok(ding.body.includes('signed it off'), 'the APPROVE briefing reads in plain English');
  assert.ok(ding.body.includes(HEAD.slice(0, 8)), 'the briefing carries the short reviewed SHA');
  assert.equal(ding.checkpointId, 'cp-100', 'dedup key material (checkpointId) is unchanged');
  assert.ok(ding.body.length <= 1200, 'briefing stays under the Telegram ceiling');
});

test('BLOCKED review outcome — milestone purpose "blocked", [CODEX] body, dedup key + redaction intact (F2)', async () => {
  // Route a secret through the BLOCKED briefing: the fail-closed gate error echoes
  // the brief_ref, so embedding the secret VALUE in the brief_ref path proves the
  // milestone body is passed through config.redact before it reaches Telegram.
  const leakMarker = 'blockedpath-fake-value-000001';
  const codex = fakeCodex();
  const h = harness({ codex, briefRef: `C:/no/such/${leakMarker}.md`, extraEnv: { TELEGRAM_BOT_TOKEN: leakMarker } });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'BLOCKED', 'a missing brief fails closed to BLOCKED');
  assert.equal(codex.calls.length, 0, 'Codex is not invoked on a closed gate');
  const ding = h.notifier.calls.find((c) => c.checkpointId === 'cp-100');
  assert.ok(ding, 'a milestone fired for the checkpoint');
  assert.equal(ding.purpose, 'blocked', 'BLOCKED maps to the "blocked" milestone purpose (unchanged)');
  assert.equal(ding.checkpointId, 'cp-100', 'dedup key material (checkpointId) is unchanged');
  assert.equal(ding.logicalSource, 'CODEX', 'review outcomes are sourced as CODEX');
  assert.ok(!ding.body.includes('[CODEX]'), 'the composed milestone body carries no [CODEX] tag -- the notifier owns it');
  assert.ok(ding.body.startsWith('BLOCKED'), 'the body leads with the bare BLOCKED status line');
  assert.ok(!wireText(ding.logicalSource, ding.body).includes('[CODEX] [CODEX]'), 'the notifier adds exactly one [CODEX] -- never doubled');
  assert.ok(ding.body.includes("couldn't complete it"), 'plain-English BLOCKED wording present');
  assert.ok(!ding.body.includes(leakMarker), 'the injected secret VALUE does not leak into the Telegram body');
  assert.ok(ding.body.includes('***redacted***'), 'the body was passed through config.redact');
});

test('DECISION_REQUIRED review outcome — milestone purpose "escalation", [CODEX] body, dedup key + redaction intact (F2)', async () => {
  // A critical finding escalates to DECISION_REQUIRED; the finding text carries a
  // secret VALUE so the milestone-body redaction is proven on the escalation path.
  const leakMarker = 'escalation-fake-value-000002';
  const codex = fakeCodex({
    status: 'ok', verdict: 'request_changes', summary: 'security-sensitive change',
    claims_verified: [],
    findings: [{ id: 'S1', severity: 'critical', evidence: 'auth.js:4', rationale: 'auth bypass', required_correction: `close the bypass; do not print ${leakMarker}` }],
    proposed_action: { type: 'noop', target: '' },
  });
  const h = harness({ codex, extraEnv: { TELEGRAM_BOT_TOKEN: leakMarker } });
  await h.watcher.pollOnce();
  assert.equal(lastReply(h.clickup).verdict, 'DECISION_REQUIRED', 'a critical finding escalates to DECISION_REQUIRED');
  const ding = h.notifier.calls.find((c) => c.checkpointId === 'cp-100');
  assert.ok(ding, 'a milestone fired for the checkpoint');
  assert.equal(ding.purpose, 'escalation', 'DECISION_REQUIRED maps to the "escalation" milestone purpose (unchanged)');
  assert.equal(ding.checkpointId, 'cp-100', 'dedup key material (checkpointId) is unchanged');
  assert.equal(ding.logicalSource, 'CODEX', 'review outcomes are sourced as CODEX');
  assert.ok(!ding.body.includes('[CODEX]'), 'the composed milestone body carries no [CODEX] tag -- the notifier owns it');
  assert.ok(ding.body.startsWith('DECISION REQUIRED'), 'the body leads with the bare DECISION REQUIRED status line');
  assert.ok(!wireText(ding.logicalSource, ding.body).includes('[CODEX] [CODEX]'), 'the notifier adds exactly one [CODEX] -- never doubled');
  assert.ok(ding.body.includes('needs your call'), 'plain-English DECISION_REQUIRED wording present');
  assert.ok(!ding.body.includes(leakMarker), 'the injected secret VALUE does not leak into the Telegram body');
  assert.ok(ding.body.includes('***redacted***'), 'the body was passed through config.redact');
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

// -- WP1: stuck-run watchdog + recoverable-failure evidence -------------------

test('cycle watchdog -- a WEDGED Codex turn is aborted, a recoverable TOWER_RUN_FAILED verdict is posted, and the loop recovers', async () => {
  // Simulate the exact defect: a codex turn that does not return within the cycle bound.
  // A deferred stands in for the wedged turn; the watchdog must fire and rescue the loop
  // WITHOUT waiting for it. We settle the deferred at the end only to leave the test
  // runner nothing pending.
  let releaseTurn;
  const wedged = new Promise((res) => { releaseTurn = res; });
  const codex = { calls: [], async runTurn(a) { this.calls.push(a); return wedged; } };
  const h = harness({ codex, cycleWatchdogMs: 40, failurePostDeadlineMs: 40 });
  const r = await h.watcher.pollOnce(); // MUST return (not hang) -- the loop recovers
  const reply = lastReply(h.clickup);
  assert.ok(reply, 'a [TOWER -> LARRY] reply was still posted (no silent HALT)');
  assert.equal(reply.verdict, 'BLOCKED', 'a wedged cycle posts a recoverable BLOCKED verdict (existing vocabulary)');
  assert.match(reply.summary, /TOWER_RUN_FAILED/, 'the run-state TOWER_RUN_FAILED is carried');
  assert.match(reply.summary, /run_timeout/, 'the failure kind is run_timeout');
  assert.match(reply.summary, /stage=codex_turn/, 'the stage it wedged at is reported');
  assert.match(reply.summary, /elapsed_ms=/, 'elapsed ms is reported');
  assert.equal(reply.reviewed_head, HEAD, 'the reviewed head is carried as evidence');
  assert.equal(r.processed.length, 1, 'the aborted cycle is surfaced as a processed run-failure');
  assert.equal(r.processed[0].runFailed, true);
  assert.equal(r.processed[0].kind, 'run_timeout');
  assert.ok(h.notifier.calls.some((c) => c.purpose === 'blocked'), 'a blocked milestone fired for the failure');
  // The loop truly recovered: a second poll does NOT reprocess the now-answered checkpoint.
  const r2 = await h.watcher.pollOnce();
  assert.equal(r2.processed.length, 0, 'answered -- not reprocessed (recovery, not a retry loop)');
  // Settle the abandoned turn + drain so the test runner has no pending promise.
  releaseTurn({ ok: false, blocked: true, structuredResult: { status: 'blocked', kind: 'test' }, envelope: {}, signature: null });
  await wedged;
  await new Promise((res) => setTimeout(res, 0));
});

test('cycle failure -- a THROWING Codex turn posts a recoverable run_error verdict and keeps polling', async () => {
  const codex = { calls: [], async runTurn() { throw new Error('codex spawn exploded'); } };
  const h = harness({ codex });
  const r = await h.watcher.pollOnce();
  const reply = lastReply(h.clickup);
  assert.equal(reply.verdict, 'BLOCKED', 'a thrown cycle fails closed to a recoverable BLOCKED');
  assert.match(reply.summary, /TOWER_RUN_FAILED/);
  assert.match(reply.summary, /run_error/, 'a throw is classified run_error');
  assert.match(reply.summary, /stage=codex_turn/);
  assert.equal(r.processed[0].runFailed, true);
});

test('cycle-failure post redacts secret VALUES before they reach the thread', async () => {
  // The thrown error carries a secret value; the recoverable-failure reply must be
  // passed through config.redact (same discipline as the normal reply path).
  const leak = 'runfail-secret-value-000003';
  const codex = { calls: [], async runTurn() { throw new Error(`boom ${leak}`); } };
  const h = harness({ codex, extraEnv: { TELEGRAM_BOT_TOKEN: leak } });
  await h.watcher.pollOnce();
  const posts = towerReplies(h.clickup);
  const raw = posts[posts.length - 1].comment_text;
  assert.ok(!raw.includes(leak), 'the secret VALUE does not leak into the recoverable-failure reply');
  assert.ok(raw.includes('***redacted***'), 'the failure reply was passed through config.redact');
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
