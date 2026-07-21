// Regression proof for the merge-check exact-head evidence chain (Codex QA / GPT findings 2026-07-21).
// The review must bind to the PR's authoritative head AND that head must be consistent across the
// WHOLE evidence-collection window: PR head before, PR head after, CI SHA, and local HEAD must all
// match, else fail closed. Run: node --test services/control-plane/tower/test/head-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headGuard } from '../merge-check.mjs';

const SHA = 'deadbeefcafe0001';
const OTHER = 'feedface0002abcd';

test('local mode (no PR): ok, uses local head', () => {
  const r = headGuard({ pr: null, localHead: 'abc123', prHead1: null, prHead2: null, ciSha: null });
  assert.equal(r.ok, true);
  assert.equal(r.head, 'abc123');
});

test('PR mode, whole chain matches: ok, uses the authoritative head', () => {
  const r = headGuard({ pr: 56, localHead: SHA, prHead1: SHA, prHead2: SHA, ciSha: SHA });
  assert.equal(r.ok, true);
  assert.equal(r.head, SHA);
});

test('PR mode, local HEAD differs: BLOCKED (fail closed)', () => {
  const r = headGuard({ pr: 56, localHead: OTHER, prHead1: SHA, prHead2: SHA, ciSha: SHA });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'head_mismatch');
  assert.equal(r.head, undefined);
});

test('PR mode, PR head CHANGES mid-collection (TOCTOU): BLOCKED (fail closed)', () => {
  // head read before != head read after collecting diff/CI -> the PR advanced during the window.
  const r = headGuard({ pr: 56, localHead: SHA, prHead1: SHA, prHead2: OTHER, ciSha: SHA });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'head_mismatch');
  assert.match(r.message, /prHead\(after\)/);
});

test('PR mode, CI evidence is for a different SHA: BLOCKED (fail closed)', () => {
  const r = headGuard({ pr: 56, localHead: SHA, prHead1: SHA, prHead2: SHA, ciSha: OTHER });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'head_mismatch');
});

test('PR mode, PR head unresolved: BLOCKED (fail closed)', () => {
  const r = headGuard({ pr: 56, localHead: SHA, prHead1: null, prHead2: null, ciSha: null });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_pr_head');
});
