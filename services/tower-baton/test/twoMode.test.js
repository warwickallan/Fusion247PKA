// WP3 -- two-mode routing: Codex = correction-loop reviewer; Fable = adversarial
// cold-final reviewer. A Codex APPROVE auto-routes into a Fable cold-final pass; only
// Codex APPROVE + Fable APPROVE is merge-ready. All WP1 protections wrap the Fable turn.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createWatcher, computeMergeReady, DEFAULT_CYCLE_WATCHDOG_MS } from '../src/watcher.js';
import { DEFAULT_CODEX_TIMEOUT_MS } from '../src/codexAdapter.js';
import { DEFAULT_FABLE_TIMEOUT_MS } from '../src/fableAdapter.js';
import { loadConfig } from '../src/config.js';
import { loadQaSkill } from '../src/qaSkill.js';
import { openState } from '../src/state.js';
import { formatCheckpoint, formatResponse, formatFableResponse, parseResponse, parseFableResponse, terminallyAnsweredCheckpointIds } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { fakeGithub, fakeCodex, fakeFable, fakeNotifier, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';
import { wireText } from '../src/telegramNotifier.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';

function harness({ codex, fable, extraEnv = {}, cycleWatchdogMs, failurePostDeadlineMs, makeClickup, briefRef, headSha = HEAD, seedComments = [] } = {}) {
  const env = { GITHUB_REPO: 'o/r', TOWER_AUTHORISED_AUTHOR_IDS: 'larry' };
  Object.assign(env, extraEnv);
  const config = loadConfig({ env, home: tmpPath() });
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const brief = briefRef ?? writeTmp('# Brief\nacceptance: the watcher works', '.md');
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = fakeNotifier();
  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-100', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: brief, branch: 'build-010/wp1', head_sha: headSha, summary: 'built it', tests: 'green', evidence_refs: ['PR#1'],
  };
  const cpComment = { comment_text: formatCheckpoint(cp), user: 'larry' };
  const clickup = makeClickup ? makeClickup(cpComment) : createFakeClickup({ comments: [cpComment, ...seedComments] });
  const watcher = createWatcher({
    config, clickup, github: fakeGithub(), codex: codex ?? fakeCodex(), fable: fable ?? fakeFable(),
    notifier, state, taskId: 'task1', qaSkillPath: skillPath, fs, now: () => 1000,
    ...(cycleWatchdogMs !== undefined ? { cycleWatchdogMs } : {}),
    ...(failurePostDeadlineMs !== undefined ? { failurePostDeadlineMs } : {}),
  });
  return { watcher, clickup, state, notifier, brief, cp };
}

const towerReplies = (c) => c._comments.filter((x) => /\[TOWER [^\]]*LARRY\]/.test(x.comment_text));
const fableReplies = (c) => c._comments.filter((x) => /\[FABLE [^\]]*LARRY\]/.test(x.comment_text));
const lastTower = (c) => { const p = towerReplies(c); return p.length ? parseResponse(p[p.length - 1].comment_text).response : null; };
const lastFable = (c) => { const p = fableReplies(c); return p.length ? parseFableResponse(p[p.length - 1].comment_text).response : null; };

test('computeMergeReady -- merge-ready ONLY when BOTH derive APPROVE AND both RAW verdicts are genuine approve', () => {
  // HIGH #2 -- the undefined-head escape is removed, so these calls now supply matching heads.
  const genuine = { codexRawVerdict: 'approve', fableRawVerdict: 'approve', codexHead: HEAD, fableHead: HEAD, currentHead: HEAD };
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...genuine }), true);
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'CORRECTIONS_REQUIRED', ...genuine }), false);
  assert.equal(computeMergeReady({ codexVerdict: 'CORRECTIONS_REQUIRED', fableVerdict: 'APPROVE', ...genuine }), false);
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'BLOCKED', ...genuine }), false);
  // HIGH C: a `comment`/unverifiable outcome derives APPROVE but is NEVER merge-ready.
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...genuine, codexRawVerdict: 'comment' }), false, 'codex comment-derived approve is not genuine');
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...genuine, fableRawVerdict: 'comment' }), false, 'fable comment-derived approve is not genuine');
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...genuine, codexRawVerdict: null, fableRawVerdict: null }), false, 'unknown raw (crash resume) fails closed');
});

test('HIGH #2 -- computeMergeReady with heads OMITTED (or empty) no longer fails OPEN to merge-ready', () => {
  const raw = { codexRawVerdict: 'approve', fableRawVerdict: 'approve' };
  // Both principals genuinely approve, but NO head evidence at all -> the removed escape used
  // to return true here. It must now be false: no merge-ready without positive head evidence.
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...raw }), false, 'absent heads must NOT yield merge-ready');
  // Empty-string heads are not valid heads either.
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...raw, codexHead: '', fableHead: '', currentHead: '' }), false, 'empty heads must NOT yield merge-ready');
  // A codex head that differs from the current head is not merge-ready even if both approve.
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...raw, codexHead: 'aaaaaaa', fableHead: HEAD, currentHead: HEAD }), false, 'a stale codex head is not merge-ready');
  // Positive, matching heads still bind to merge-ready.
  assert.equal(computeMergeReady({ codexVerdict: 'APPROVE', fableVerdict: 'APPROVE', ...raw, codexHead: HEAD, fableHead: HEAD, currentHead: HEAD }), true, 'matching real heads still bind');
});

test('HIGH D -- the default cycle watchdog COVERS the codex + fable turn budgets plus slack', () => {
  assert.ok(
    DEFAULT_CYCLE_WATCHDOG_MS >= DEFAULT_CODEX_TIMEOUT_MS + DEFAULT_FABLE_TIMEOUT_MS,
    `watchdog (${DEFAULT_CYCLE_WATCHDOG_MS}ms) must cover codex (${DEFAULT_CODEX_TIMEOUT_MS}) + fable (${DEFAULT_FABLE_TIMEOUT_MS}) or a healthy slow two-turn cycle is falsely aborted mid-fable`,
  );
  // and it carries real slack beyond the bare sum (overhead: evidence/brief/skill/posts).
  assert.ok(DEFAULT_CYCLE_WATCHDOG_MS - (DEFAULT_CODEX_TIMEOUT_MS + DEFAULT_FABLE_TIMEOUT_MS) >= 60_000, 'at least a minute of slack over the two turn budgets');
});

test('HIGH C (end-to-end) -- an empty/insufficient diff => both reviewers `comment` => both derive APPROVE => merge_ready is NO', async () => {
  // Both reviewers return verdict:'comment' with 0 findings (the "unverifiable / insufficient
  // diff" outcome the prompt instructs). deriveVerdict maps that to APPROVE for BOTH -- but
  // the RAW verdict is `comment`, so the merge-ready gate must refuse.
  const commentResult = { status: 'ok', verdict: 'comment', summary: 'diff absent/insufficient -- unverifiable', claims_verified: [{ claim: 'x', status: 'unverifiable', evidence: 'no diff' }], findings: [], proposed_action: { type: 'noop', target: '' } };
  const codex = fakeCodex(commentResult);
  const fable = fakeFable(commentResult);
  const h = harness({ codex, fable });
  const r = await h.watcher.pollOnce();

  assert.equal(r.processed[0].verdict, 'APPROVE', 'codex comment+0findings derives APPROVE');
  assert.equal(r.processed[0].fableVerdict, 'APPROVE', 'fable comment+0findings derives APPROVE');
  assert.equal(r.processed[0].mergeReady, false, 'but nothing was verified -> NOT merge-ready');
  const fableReply = lastFable(h.clickup);
  assert.equal(fableReply.merge_ready, 'no', 'the [FABLE -> LARRY] reply refuses merge_ready on an unverifiable outcome');
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
  // J1: a failure in the FABLE stage attributes the ding to FABLE, not hardcoded CODEX.
  const blockedDing = h.notifier.calls.find((c) => c.purpose === 'blocked');
  assert.ok(blockedDing, 'a blocked milestone fired for the failure');
  assert.equal(blockedDing.logicalSource, 'FABLE', 'a fable-stage failure ding is sourced FABLE');

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

test('MEDIUM G #a -- a FAILED [FABLE -> LARRY] post RESUMES at the fable step next poll (codex NOT re-run, NO duplicate [TOWER -> LARRY])', async () => {
  const codex = fakeCodex();
  const fable = fakeFable();
  let failFablePost = true;
  const store = [];
  const makeClickup = (cpComment) => {
    store.push({ id: 'seed', comment_text: cpComment.comment_text, user: cpComment.user });
    let seq = 0;
    return {
      _comments: store,
      async getTaskComments() { return store.map((c) => ({ ...c })); },
      async createTaskComment(_t, body) {
        if (failFablePost && /\[FABLE/.test(body)) throw new Error('clickup 500 on fable post');
        seq += 1; const id = `posted-${seq}`; store.push({ id, comment_text: body, user: 'tower' }); return { id };
      },
    };
  };
  const h = harness({ codex, fable, makeClickup });

  const r1 = await h.watcher.pollOnce();
  assert.equal(codex.calls.length, 1, 'codex ran once');
  assert.equal(fable.calls.length, 1, 'fable ran once');
  assert.equal(r1.processed[0].error, 'fable-post-failed');
  assert.equal(store.filter((c) => /\[TOWER [^\]]*LARRY\]/.test(c.comment_text)).length, 1, 'one codex reply after the failed fable post');
  assert.equal(h.state.isAnswered('cp-100'), false, 'not answered -- the fable terminal never landed');
  assert.equal(h.state.isInProgress('cp-100'), true, 'a durable awaiting_fable marker was recorded');

  failFablePost = false;
  const r2 = await h.watcher.pollOnce();
  assert.equal(codex.calls.length, 1, 'codex is NOT re-run on resume');
  assert.equal(fable.calls.length, 2, 'the cold-final is retried at the fable step');
  assert.equal(store.filter((c) => /\[TOWER [^\]]*LARRY\]/.test(c.comment_text)).length, 1, 'NO duplicate [TOWER -> LARRY] reply on resume');
  assert.equal(store.filter((c) => /\[FABLE [^\]]*LARRY\]/.test(c.comment_text)).length, 1, 'the fable reply posted exactly once');
  assert.equal(h.state.isAnswered('cp-100'), true, 'answered once the cold-final terminal lands');
  assert.ok(r2.processed[0], 'the resume produced a processed record');
});

test('MEDIUM G #b -- on restart, a codex APPROVE with NO cold-final is NOT counted answered; the cold-final RESUMES (never silently skipped)', async () => {
  const codex = fakeCodex();
  const fable = fakeFable();
  const priorCodexReply = formatResponse({ checkpoint_id: 'cp-100', reviewed_head: HEAD, prompt_fingerprint: 'fp', verdict: 'APPROVE', summary: 'codex approved', next_action: 'proceed' });
  // Fresh state (restart): the thread carries the checkpoint + a codex APPROVE reply but NO
  // fable reply (crash between the two posts). Reconcile must NOT mark it answered.
  const makeClickup = (cpComment) => createFakeClickup({ comments: [cpComment, { comment_text: priorCodexReply, user: 'tower' }] });
  const h = harness({ codex, fable, makeClickup });

  const r = await h.watcher.pollOnce();
  assert.equal(codex.calls.length, 0, 'codex is NOT re-run -- it already approved this head on the thread');
  assert.equal(fable.calls.length, 1, 'the cold-final RESUMES (it was skipped by the crash)');
  assert.equal(fableReplies(h.clickup).length, 1, 'the cold-final reply now posts');
  assert.equal(h.state.getAnswered('cp-100').verdict, 'APPROVE', 'the cold-final terminal is recorded');
  assert.equal(h.state.getAnswered('cp-100').merge_ready, false, 'a crash-resume cannot confirm the codex RAW approve -> merge_ready fails closed');
  assert.equal(r.processed[0].reviewStage, 'cold_final');
});

test('MAJOR F -- reconcileFromThread is GENERATION-FENCED: an older (superseded) reconcile does not mutate state when it resolves late', async () => {
  let releaseSlow; const slow = new Promise((res) => { releaseSlow = res; });
  let call = 0;
  const merged = [];
  const clickup = { async getTaskComments() { call += 1; return call === 1 ? slow : []; } };
  const state = { mergeAnsweredIds: (ids) => merged.push([...ids]), isAnswered: () => false, getInProgress: () => null };
  const watcher = createWatcher({
    config: loadConfig({ env: { TOWER_AUTHORISED_AUTHOR_IDS: 'x' }, home: tmpPath() }),
    clickup, github: fakeGithub(), codex: fakeCodex(), fable: fakeFable(), notifier: fakeNotifier(),
    state, taskId: 't', qaSkillPath: writeTmp(approvedSkill(1), '.md'), fs,
  });
  const p1 = watcher.reconcileFromThread(); // gen 1 -- slow read
  const r2 = await watcher.reconcileFromThread(); // gen 2 -- resolves [] and completes first
  assert.ok(r2.rebuiltFromThread, 'the newer reconcile completed and rebuilt');
  // The abandoned first read now resolves with a thread that WOULD have merged a stale id.
  releaseSlow([{ comment_text: formatResponse({ checkpoint_id: 'cp-stale', reviewed_head: 'h', prompt_fingerprint: 'f', verdict: 'BLOCKED', summary: 's', next_action: 'n' }) }]);
  const r1 = await p1;
  assert.equal(r1.superseded, true, 'the older reconcile no-ops behind the newer generation');
  assert.ok(!merged.some((ids) => ids.includes('cp-stale')), 'the superseded reconcile did NOT merge its stale ids into state');
});

// ── CRIT #1 — head-binding the reconcile / priorFable path ─────────────────────

const HEAD_A = 'a390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';
const HEAD_B = 'b390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';
const freshCorrections = { status: 'ok', verdict: 'request_changes', summary: 'fresh cold-final: gap', claims_verified: [], findings: [{ id: 'B1', severity: 'low', evidence: 'x:1', rationale: 'gap the loop missed', required_correction: 'add the edge test' }], proposed_action: { type: 'noop', target: '' } };

test('CRIT #1 (processCheckpoint) -- a merge-ready [FABLE->LARRY] for a DIFFERENT head does NOT dedup/import; a FRESH review runs at the current head', async () => {
  const codex = fakeCodex(); // APPROVE at head B
  // The FRESH cold-final at B sends it back (merge_ready:false) -- distinct from the stale
  // head-A reply's merge_ready:yes, so importing the stale value would be observable.
  const fable = fakeFable(freshCorrections);
  const h = harness({ codex, fable, headSha: HEAD_B });
  const staleFableA = { comment_text: formatFableResponse({ checkpoint_id: 'cp-100', reviewed_head: HEAD_A, prompt_fingerprint: 'fp', verdict: 'APPROVE', merge_ready: true, summary: 'head A cold-final approved', next_action: 'MERGE-READY' }), user: 'tower' };

  const r = await h.watcher.processCheckpoint(h.cp, { stage: 'start' }, { active: true }, { comments: [staleFableA] });

  assert.equal(codex.calls.length, 1, 'a FRESH codex review ran at head B (the stale head-A reply did NOT short-circuit)');
  assert.equal(fable.calls.length, 1, 'a FRESH fable cold-final ran at head B');
  assert.equal(fable.calls[0].packet.head_sha, HEAD_B, 'fable reviewed the CURRENT head B');
  const ans = h.state.getAnswered('cp-100');
  assert.equal(ans.reviewed_head, HEAD_B, 'the recorded answer is for head B, not the stale head A');
  assert.equal(ans.verdict, 'CORRECTIONS_REQUIRED', 'the FRESH head-B outcome is recorded, not the stale head-A APPROVE');
  assert.equal(ans.merge_ready, false, 'the stale head-A merge_ready:true was NOT imported; fresh head-B corrections => not merge-ready');
  assert.equal(r.mergeReady, false);
});

test('CRIT #1 (processCheckpoint) -- the GENUINE crash-recovery case (fable reply reviewed_head === current head) dedups idempotently (no re-run)', async () => {
  const codex = fakeCodex();
  const fable = fakeFable();
  const h = harness({ codex, fable }); // checkpoint head === HEAD
  const priorFable = { comment_text: formatFableResponse({ checkpoint_id: 'cp-100', reviewed_head: HEAD, prompt_fingerprint: 'fp', verdict: 'APPROVE', merge_ready: true, summary: 'cold-final approved THIS head', next_action: 'MERGE-READY' }), user: 'tower' };

  const r = await h.watcher.processCheckpoint(h.cp, { stage: 'start' }, { active: true }, { comments: [priorFable] });

  assert.equal(codex.calls.length, 0, 'codex is NOT re-run -- the cold-final already landed for THIS head');
  assert.equal(fable.calls.length, 0, 'fable is NOT re-run -- idempotent dedup');
  assert.equal(r.skipped, 'already-answered-thread');
  assert.equal(h.state.getAnswered('cp-100').verdict, 'APPROVE', 'recorded idempotently from the matching-head thread terminal');
  assert.equal(h.state.getAnswered('cp-100').merge_ready, true, 'merge_ready is preserved ONLY because the reply reviewed the CURRENT head');
});

test('CRIT #1 (reconcile, end-to-end) -- a reused checkpoint_id at head B is NOT deduped by a head-A [FABLE->LARRY]; pollOnce runs a FRESH review at B', async () => {
  const codex = fakeCodex();
  const fable = fakeFable(freshCorrections);
  const staleFableA = { comment_text: formatFableResponse({ checkpoint_id: 'cp-100', reviewed_head: HEAD_A, prompt_fingerprint: 'fp', verdict: 'APPROVE', merge_ready: true, summary: 'head A cold-final approved', next_action: 'MERGE-READY' }), user: 'tower' };
  const h = harness({ codex, fable, headSha: HEAD_B, seedComments: [staleFableA] });

  const r = await h.watcher.pollOnce();

  assert.equal(codex.calls.length, 1, 'reconcile did NOT mark cp-100 answered from the stale head-A reply; a fresh codex review ran');
  assert.equal(fable.calls.length, 1, 'a fresh fable cold-final ran at head B');
  assert.equal(r.processed.length, 1, 'the checkpoint was processed (not skipped as already-answered)');
  assert.equal(r.processed[0].mergeReady, false, 'the fresh head-B review is not merge-ready; nothing carried over from head A');
  assert.equal(h.state.getAnswered('cp-100').reviewed_head, HEAD_B);
});

test('CRIT #1 (unit) -- terminallyAnsweredCheckpointIds is HEAD-AWARE: a reply for a different head does not dedup the current checkpoint', () => {
  const fableA = { comment_text: formatFableResponse({ checkpoint_id: 'cp-100', reviewed_head: HEAD_A, prompt_fingerprint: 'fp', verdict: 'APPROVE', merge_ready: true, summary: 's', next_action: 'n' }), user: 'tower' };
  const mismatch = terminallyAnsweredCheckpointIds([fableA], { fableEnabled: true, checkpointHeads: { 'cp-100': HEAD_B } });
  assert.equal(mismatch.has('cp-100'), false, 'a stale-head reply must NOT mark the current (head-B) checkpoint answered');
  const match = terminallyAnsweredCheckpointIds([fableA], { fableEnabled: true, checkpointHeads: { 'cp-100': HEAD_A } });
  assert.equal(match.has('cp-100'), true, 'a reply for the CURRENT head dedups as before');
  const legacy = terminallyAnsweredCheckpointIds([fableA], { fableEnabled: true });
  assert.equal(legacy.has('cp-100'), true, 'without checkpointHeads, behaviour is unchanged (head-blind, back-compat)');
});
