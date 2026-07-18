// Regression tests for the three defects the FIRST live Larry->Tower->Codex proof
// surfaced (2026-07-18):
//   1. poll re-entrancy — overlapping ticks must not double-review a checkpoint;
//   2. Codex diff-staging — the real unified diff is staged into the packet/prompt so
//      a read-only sandbox that cannot self-read the disk still reviews the real change;
//   3. packet identity — checkpoint_id/build_id/wp_id reach Codex so the reply correlates.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createWatcher } from '../src/watcher.js';
import { buildCodexPrompt } from '../src/codexAdapter.js';
import { loadConfig } from '../src/config.js';
import { loadQaSkill } from '../src/qaSkill.js';
import { openState } from '../src/state.js';
import { formatCheckpoint } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { fakeGithub, fakeNotifier, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';

const HEAD = '2ceffd0383b73f8f24dfe5e30904080eca446f5f';

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function buildWatcher({ codex, github }) {
  const config = loadConfig({ env: { GITHUB_REPO: 'o/r' }, home: tmpPath() });
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const brief = writeTmp('# Brief\nacceptance: the watcher works', '.md');
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = fakeNotifier();
  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-500', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: brief, branch: 'build-010/wp1', head_sha: HEAD, base_sha: '1390dd6e21c0fc24c66d567a7dfbd5742de5ae3f',
    summary: 'built it', tests: 'green',
  };
  const clickup = createFakeClickup({ comments: [{ comment_text: formatCheckpoint(cp) }] });
  const watcher = createWatcher({
    config, clickup, github: github ?? fakeGithub(), codex,
    notifier, state, taskId: 'task1', qaSkillPath: skillPath, fs, now: () => 1000,
  });
  return { watcher, clickup, state, notifier };
}

test('re-entrancy — a poll while another is in flight is refused (no duplicate Codex turn)', async () => {
  const gate = deferred();
  const calls = [];
  const codex = {
    calls,
    async runTurn(args) {
      calls.push(args);
      await gate.promise; // hold the turn open, simulating a slow (~60s) Codex review
      return { ok: true, blocked: false, structuredResult: { status: 'ok', verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } }, envelope: {}, signature: null };
    },
  };
  const h = buildWatcher({ codex });

  const p1 = h.watcher.pollOnce();          // starts, will suspend inside the (slow) Codex turn
  const r2 = await h.watcher.pollOnce();    // overlapping tick — must be refused
  assert.equal(r2.busy, true, 'the second poll is refused while the first is in flight');
  assert.equal(r2.processed.length, 0, 'the refused poll did not process anything');

  gate.resolve();
  const r1 = await p1;
  assert.equal(r1.processed.length, 1);
  assert.equal(calls.length, 1, 'still exactly one Codex turn after the first completes');
  const posts = h.clickup._comments.filter((c) => /\[TOWER → LARRY\]/.test(c.comment_text));
  assert.equal(posts.length, 1, 'exactly one reply posted (no duplicates)');
});

test('diff-staging + identity — the Codex packet carries the real diff and checkpoint identity', async () => {
  const calls = [];
  const codex = {
    calls,
    async runTurn(args) { calls.push(args); return { ok: true, blocked: false, structuredResult: { status: 'ok', verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } }, envelope: {}, signature: null }; },
  };
  const github = fakeGithub({ diffText: 'diff --git a/x.js b/x.js\n+const hello = 1;', diffTruncated: false, changedFiles: ['x.js'] });
  const h = buildWatcher({ codex, github });
  await h.watcher.pollOnce();

  assert.equal(calls.length, 1);
  const packet = calls[0].packet;
  assert.equal(packet.diff_text, 'diff --git a/x.js b/x.js\n+const hello = 1;', 'the real unified diff is staged into the packet');
  assert.equal(packet.checkpoint_id, 'cp-500', 'checkpoint_id reaches Codex');
  assert.equal(packet.build_id, 'BUILD-010');
  assert.equal(packet.wp_id, 'WP1', 'wp_id reaches Codex');
});

test('buildCodexPrompt — stages the diff and identity, and tells Codex not to report blocked on a read-only sandbox', () => {
  const prompt = buildCodexPrompt({ skillText: 'SKILL-BODY', packet: { checkpoint_id: 'cp-1', wp_id: 'WP1', diff_text: 'DIFF-CONTENT-HERE', diff_range: 'a..b' } });
  assert.match(prompt, /SKILL-BODY/);
  assert.match(prompt, /checkpoint_id: cp-1/);
  assert.match(prompt, /STAGED DIFF/);
  assert.match(prompt, /DIFF-CONTENT-HERE/);
  assert.match(prompt, /do NOT report "blocked" merely because you/i, 'instructs Codex that a blocked shell is expected, not a review blocker');
});

test('buildCodexPrompt — absent diff is stated honestly (no fabricated review)', () => {
  const prompt = buildCodexPrompt({ skillText: 'S', packet: { checkpoint_id: 'cp-1' } });
  assert.match(prompt, /STAGED DIFF: \(none captured/);
  assert.match(prompt, /do not fabricate/i);
});
