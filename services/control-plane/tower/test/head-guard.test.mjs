// Regression proof for the merge-check head-provenance guard (Codex QA / GPT finding 2026-07-21):
// in PR mode the review must bind to the PR's authoritative head and FAIL CLOSED when the local
// checkout does not match it. Run: node --test services/control-plane/tower/test/head-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headGuard } from '../merge-check.mjs';

test('local mode (no PR): ok, uses local head', () => {
  const r = headGuard({ pr: null, localHead: 'abc123', prHead: null });
  assert.equal(r.ok, true);
  assert.equal(r.head, 'abc123');
});

test('PR mode, local matches PR head: ok, uses the authoritative PR head', () => {
  const r = headGuard({ pr: 56, localHead: 'deadbeef', prHead: 'deadbeef' });
  assert.equal(r.ok, true);
  assert.equal(r.head, 'deadbeef');
});

test('PR mode, local HEAD != PR head: BLOCKED (fail closed) — the defect GPT caught', () => {
  const r = headGuard({ pr: 56, localHead: 'localsha0000', prHead: 'prsha1111' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'head_mismatch');
  assert.equal(r.head, undefined, 'must NOT hand back a usable head on mismatch');
  assert.match(r.message, /!=/);
});

test('PR mode, PR head unresolved: BLOCKED (fail closed)', () => {
  const r = headGuard({ pr: 56, localHead: 'x', prHead: null });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_pr_head');
});
