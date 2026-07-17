import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoAutonomousMerge, assertWithinScope, isWithinScope,
  roundBudgetOk, budgetOk, assertSignerMatchesResponder, assertValidResponder,
  DEFAULT_MAX_REVIEW_ROUNDS,
} from '../src/core/guardrails.js';

test('no-autonomous-merge blocks merge and destructive actions', () => {
  for (const bad of ['merge', 'merge_pr', 'force_push', 'delete_branch', 'deploy', 'release']) {
    assert.throws(() => assertNoAutonomousMerge({ type: bad }), /NO-AUTONOMOUS-MERGE|not in the allowed/i, `must block ${bad}`);
  }
});

test('allowed governance actions pass', () => {
  for (const ok of ['post_comment', 'post_review', 'set_task_status', 'noop']) {
    assert.doesNotThrow(() => assertNoAutonomousMerge({ type: ok }));
  }
});

test('scope lock: empty lock permits allowed actions but never forbidden ones', () => {
  assert.equal(isWithinScope({}, { type: 'post_comment' }), true);
  assert.equal(isWithinScope({}, { type: 'merge' }), false);
});

test('scope lock: repo + action + path glob enforced', () => {
  const lock = { repos: ['acme/app'], allowed_actions: ['post_comment'], path_globs: ['docs/**'] };
  assert.equal(isWithinScope(lock, { type: 'post_comment', repo: 'acme/app', path: 'docs/x.md' }), true);
  assert.equal(isWithinScope(lock, { type: 'post_comment', repo: 'other/repo', path: 'docs/x.md' }), false);
  assert.equal(isWithinScope(lock, { type: 'post_review', repo: 'acme/app' }), false); // action not allowed
  assert.equal(isWithinScope(lock, { type: 'post_comment', repo: 'acme/app', path: 'src/x.js' }), false); // path out
  assert.throws(() => assertWithinScope(lock, { type: 'post_comment', repo: 'other/x' }), /SCOPE-LOCK/);
});

test('round budget: default is 2 review rounds; refuses at cap', () => {
  assert.equal(DEFAULT_MAX_REVIEW_ROUNDS, 2);
  assert.equal(roundBudgetOk({ max_rounds: 2, round_count: 1 }).allowed, true);
  assert.equal(roundBudgetOk({ max_rounds: 2, round_count: 2 }).allowed, false);
});

test('budget: token overspend and passed deadline both terminate', () => {
  assert.equal(budgetOk({ token_budget: 100, token_spent: 101 }).allowed, false);
  assert.equal(budgetOk({ token_budget: 100, token_spent: 50 }).allowed, true);
  assert.equal(budgetOk({ deadline_at: new Date(1000) }, 2000).allowed, false);
  assert.equal(budgetOk({ deadline_at: new Date(5000) }, 2000).allowed, true);
  assert.equal(budgetOk({ token_budget: null }).allowed, true); // unbounded
});

test('signer must match expected responder — a gpt_codex result signed as larry is rejected', () => {
  assert.doesNotThrow(() => assertSignerMatchesResponder('gpt_codex', 'gpt_codex'));
  assert.throws(() => assertSignerMatchesResponder('gpt_codex', 'larry'), /signed by/);
});

test('tower can never be a responder', () => {
  assert.doesNotThrow(() => assertValidResponder('larry'));
  assert.throws(() => assertValidResponder('tower'), /never takes a turn/);
});
