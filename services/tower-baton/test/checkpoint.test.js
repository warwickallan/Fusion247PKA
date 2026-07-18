import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCheckpoint, formatCheckpoint, parseResponse, formatResponse, correlateResponse, answeredCheckpointIds, chainKey } from '../src/checkpoint.js';

const GOOD = `[LARRY → TOWER]
state: READY_FOR_TOWER_REVIEW
checkpoint_id: cp-001
build_id: BUILD-010
wp_id: WP1
brief_ref: Builds/BUILD-010/brief.md
branch: build-010/wp1-clickup-baton-mvp
head_sha: 1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900
base_sha: 0000000aaaabbbbcccc
summary: built the baton MVP watcher + adapters
tests: node --test green, 30 tests
evidence_refs:
  - PR#42
  - ci:green
questions_or_blockers:
  - none`;

test('checkpoint parser — parses all fields', () => {
  const { ok, checkpoint, errors } = parseCheckpoint(GOOD);
  assert.equal(ok, true, `errors: ${errors.join('; ')}`);
  assert.equal(checkpoint.checkpoint_id, 'cp-001');
  assert.equal(checkpoint.build_id, 'BUILD-010');
  assert.equal(checkpoint.wp_id, 'WP1');
  assert.equal(checkpoint.head_sha, '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900');
  assert.deepEqual(checkpoint.evidence_refs, ['PR#42', 'ci:green']);
  assert.deepEqual(checkpoint.questions_or_blockers, ['none']);
});

test('checkpoint parser — fail-closed on missing head_sha', () => {
  const bad = GOOD.replace(/head_sha:.*\n/, '');
  const { ok, errors } = parseCheckpoint(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /head_sha/.test(e)));
});

test('checkpoint parser — fail-closed on wrong state', () => {
  const bad = GOOD.replace('READY_FOR_TOWER_REVIEW', 'DRAFT');
  const { ok, errors } = parseCheckpoint(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /state must be/.test(e)));
});

test('checkpoint parser — no marker → not a checkpoint', () => {
  assert.equal(parseCheckpoint('just a normal comment').ok, false);
});

test('checkpoint round-trips through formatCheckpoint', () => {
  const { checkpoint } = parseCheckpoint(GOOD);
  const reparsed = parseCheckpoint(formatCheckpoint(checkpoint));
  assert.equal(reparsed.ok, true);
  assert.equal(reparsed.checkpoint.checkpoint_id, 'cp-001');
});

test('response format + parse round-trip', () => {
  const body = formatResponse({ checkpoint_id: 'cp-001', reviewed_head: 'abc123', prompt_fingerprint: 'ff00', verdict: 'APPROVE', summary: 'ok', material_findings: ['[minor] x: y'], next_action: 'proceed' });
  const { ok, response } = parseResponse(body);
  assert.equal(ok, true);
  assert.equal(response.checkpoint_id, 'cp-001');
  assert.equal(response.verdict, 'APPROVE');
  assert.equal(response.reviewed_head, 'abc123');
});

test('response correlation by checkpoint_id + head', () => {
  const resp = { checkpoint_id: 'cp-001', reviewed_head: 'abc123', verdict: 'APPROVE' };
  assert.equal(correlateResponse(resp, { checkpointId: 'cp-001', expectedHead: 'abc123' }).match, true);
  assert.equal(correlateResponse(resp, { checkpointId: 'cp-999' }).match, false);
});

test('stale response rejected (right checkpoint, different head)', () => {
  const resp = { checkpoint_id: 'cp-001', reviewed_head: 'OLDHEAD', verdict: 'APPROVE' };
  const c = correlateResponse(resp, { checkpointId: 'cp-001', expectedHead: 'NEWHEAD' });
  assert.equal(c.match, false);
  assert.equal(c.stale, true);
});

test('ClickUp thread correlation — answeredCheckpointIds scans replies', () => {
  const comments = [
    { comment_text: GOOD },
    { comment_text: formatResponse({ checkpoint_id: 'cp-001', reviewed_head: 'abc', verdict: 'APPROVE' }) },
    { comment_text: 'unrelated chatter' },
  ];
  const ids = answeredCheckpointIds(comments);
  assert.ok(ids.has('cp-001'));
  assert.equal(ids.size, 1);
});

test('chainKey binds build/wp/brief', () => {
  const { checkpoint } = parseCheckpoint(GOOD);
  assert.equal(chainKey(checkpoint), 'BUILD-010|WP1|Builds/BUILD-010/brief.md');
});
