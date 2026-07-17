import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGithubEvent, normalizeClickupEvent, routeResponder,
  pollGithub, TOWER_SELF_MARKER,
} from '../src/adapters/eventIntake.js';

test('normalize GitHub PR event', () => {
  const raw = { action: 'opened', pull_request: { number: 7, head: { sha: 'deadbeef' }, base: { repo: { full_name: 'acme/app' } }, html_url: 'u' } };
  const n = normalizeGithubEvent(raw, 'delivery-1');
  assert.equal(n.source, 'github');
  assert.equal(n.kind, 'pull_request.opened');
  assert.equal(n.headSha, 'deadbeef');
  assert.equal(n.sourceEventId, 'delivery-1');
  assert.equal(n.payload.pr_ref, 'acme/app#7');
});

test('normalize GitHub check_suite event', () => {
  const raw = { check_suite: { head_sha: 'abc', conclusion: 'success', app: { slug: 'ci' } } };
  const n = normalizeGithubEvent(raw);
  assert.equal(n.kind, 'check_suite.completed');
  assert.equal(n.headSha, 'abc');
  assert.equal(n.payload.conclusion, 'success');
});

test('self-generated GitHub comment (tower marker) is flagged', () => {
  const raw = { comment: { body: `Automated note ${TOWER_SELF_MARKER}`, id: 5, user: { login: 'tower' } }, action: 'created', repository: { full_name: 'acme/app' }, issue: { number: 7 } };
  const n = normalizeGithubEvent(raw);
  assert.equal(n.selfGenerated, true);
});

test('normalize ClickUp task event; synthetic id is deterministic', () => {
  const a = normalizeClickupEvent({ event: 'taskUpdated', task_id: 'T1', task: { status: { status: 'in review' } } });
  const b = normalizeClickupEvent({ event: 'taskUpdated', task_id: 'T1', task: { status: { status: 'in review' } } });
  assert.equal(a.kind, 'task.status_changed');
  assert.equal(a.payload.task_id, 'T1');
  assert.equal(a.sourceEventId, b.sourceEventId, 'deterministic synthetic id enables dedup');
});

test('routeResponder: green check -> gpt_codex review; comment -> larry; task -> larry', () => {
  assert.equal(routeResponder({ source: 'github', kind: 'check_suite.completed', payload: { conclusion: 'success' } }), 'gpt_codex');
  assert.equal(routeResponder({ source: 'github', kind: 'issue_comment.created', payload: {} }), 'larry');
  assert.equal(routeResponder({ source: 'clickup', kind: 'task.status_changed', payload: {} }), 'larry');
});

test('pollGithub is GATED without a fetch impl (no live call)', async () => {
  const r = await pollGithub({ repo: 'acme/app', resource: 'pulls' });
  assert.equal(r.status, 'gated');
  assert.match(r.blocker, /gated/);
});

test('pollGithub honors ETag 304 (no events, unchanged etag)', async () => {
  const fetchImpl = async () => ({ status: 304, headers: { get: () => '"etag1"' }, json: async () => [] });
  const r = await pollGithub({ repo: 'acme/app', resource: 'pulls', etag: '"etag1"', fetchImpl });
  assert.equal(r.notModified, true);
  assert.equal(r.events.length, 0);
  assert.equal(r.etag, '"etag1"');
});

test('pollGithub 200 returns normalized events + next etag', async () => {
  const fetchImpl = async () => ({
    status: 200,
    headers: { get: (h) => (h.toLowerCase() === 'etag' ? '"etag2"' : null) },
    json: async () => ([{ action: 'opened', pull_request: { number: 1, head: { sha: 's' }, base: { repo: { full_name: 'acme/app' } } } }]),
  });
  const r = await pollGithub({ repo: 'acme/app', resource: 'pulls', fetchImpl });
  assert.equal(r.status, 200);
  assert.equal(r.etag, '"etag2"');
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].kind, 'pull_request.opened');
});
