import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runHandoff, findMatchingReply } from '../src/handoff.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { formatResponse, formatCheckpoint } from '../src/checkpoint.js';
import { fakeNotifier } from '../test-helpers/fakes.js';

const HEAD = 'abc123def456';
const CP = { checkpoint_id: 'cp-500', head_sha: HEAD, build_id: 'B', branch: 'br' };

const noSleep = async () => {};

test('re-entrant — an existing matching reply RESUMES without re-posting', async () => {
  const reply = formatResponse({ checkpoint_id: 'cp-500', reviewed_head: HEAD, prompt_fingerprint: 'fp', verdict: 'APPROVE', summary: 'ok', next_action: 'go' });
  const clickup = createFakeClickup({ comments: [{ comment_text: formatCheckpoint({ ...CP, state: 'READY_FOR_TOWER_REVIEW', brief_ref: 'b', base_sha: 'x' }) }, { comment_text: reply }] });
  const before = clickup._comments.length;
  const r = await runHandoff({ clickup, notifier: fakeNotifier(), taskId: 't', checkpoint: CP, sleep: noSleep });
  assert.equal(r.status, 'RESUMED');
  assert.equal(r.response.verdict, 'APPROVE');
  assert.equal(clickup._comments.length, before, 'no new comment posted on resume');
});

test('poll receives ONLY the matching response (non-matching ignored → timeout HALT)', async () => {
  const otherReply = formatResponse({ checkpoint_id: 'cp-OTHER', reviewed_head: 'zzz', verdict: 'APPROVE', summary: 'not mine', next_action: 'x' });
  const clickup = createFakeClickup({ comments: [{ comment_text: otherReply }] });
  const r = await runHandoff({ clickup, notifier: fakeNotifier(), taskId: 't', checkpoint: CP, timeoutMs: 0, sleep: noSleep });
  assert.equal(r.status, 'TIMED_OUT');
  assert.equal(r.halt, true);
});

test('stale response rejected — same checkpoint, different head is not a match', () => {
  const stale = { checkpoint_id: 'cp-500', reviewed_head: 'OLD', verdict: 'APPROVE' };
  const hit = findMatchingReply([{ id: '1', text: formatResponse(stale) }], { checkpointId: 'cp-500', expectedHead: HEAD });
  assert.equal(hit, null);
});

test('no Tower response → honest TOWER_UNAVAILABLE + Telegram alert + HALT', async () => {
  const clickup = createFakeClickup({ comments: [] });
  const notifier = fakeNotifier();
  const r = await runHandoff({ clickup, notifier, taskId: 't', checkpoint: CP, timeoutMs: 0, sleep: noSleep });
  assert.equal(r.status, 'TIMED_OUT');
  assert.equal(r.halt, true);
  // an honest TOWER_UNAVAILABLE was posted
  assert.ok(clickup._comments.some((c) => /TOWER_UNAVAILABLE/.test(c.comment_text)));
  // a Telegram alert fired
  assert.ok(notifier.calls.some((c) => c.purpose === 'tower_unavailable'));
});

test('re-entrant — checkpoint already posted is NOT double-posted on timeout', async () => {
  const clickup = createFakeClickup({ comments: [{ comment_text: formatCheckpoint({ ...CP, state: 'READY_FOR_TOWER_REVIEW', brief_ref: 'b' }) }] });
  const before = clickup._comments.length;
  const r = await runHandoff({ clickup, notifier: fakeNotifier(), taskId: 't', checkpoint: CP, timeoutMs: 0, sleep: noSleep });
  assert.equal(r.status, 'TIMED_OUT');
  // only the TOWER_UNAVAILABLE comment is added (checkpoint not re-posted)
  assert.equal(clickup._comments.length, before + 1);
});
