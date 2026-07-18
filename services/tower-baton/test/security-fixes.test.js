// Security regression tests for the holes Fable's independent review surfaced
// (2026-07-18): an unconstrained brief_ref file read + an un-redacted outbound
// ClickUp body could exfiltrate secrets; and a mutating git verb/flag sat on the
// read-only allowlist. These tests FAIL against the pre-fix code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { createWatcher, resolveBrief } from '../src/watcher.js';
import { assertReadOnlyCommand } from '../src/githubEvidence.js';
import { loadConfig } from '../src/config.js';
import { loadQaSkill } from '../src/qaSkill.js';
import { openState } from '../src/state.js';
import { formatCheckpoint } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { fakeGithub, fakeNotifier, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';

const HEAD = '2ceffd0383b73f8f24dfe5e30904080eca446f5f';

test('resolveBrief — refuses a path OUTSIDE the governed repo root (no secret-file read)', async () => {
  const root = path.join(os.tmpdir(), `tower-root-${randomUUID()}`);
  fs.mkdirSync(root, { recursive: true });
  const outside = path.join(os.tmpdir(), 'fusion-capture-gateway.env'); // e.g. C:\.fusion247\*.env
  const r = await resolveBrief(outside, { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /OUTSIDE the governed repo root/);
});

test('resolveBrief — allows a brief INSIDE the repo root', async () => {
  const root = path.join(os.tmpdir(), `tower-root-${randomUUID()}`);
  fs.mkdirSync(path.join(root, 'Builds'), { recursive: true });
  const inside = path.join(root, 'Builds', 'brief.md');
  fs.writeFileSync(inside, '# Brief\nacceptance: it works', 'utf8');
  const r = await resolveBrief(inside, { fs, repoRoot: root });
  assert.equal(r.ok, true, r.error ?? '');
  assert.match(r.excerpt, /acceptance/);
});

test('outbound reply is redacted — a secret in the Codex summary never reaches ClickUp', async () => {
  const SECRET = 'pk_LIVE_secret_value_1234567890';
  const root = path.join(os.tmpdir(), `tower-root-${randomUUID()}`);
  fs.mkdirSync(root, { recursive: true });
  const briefPath = path.join(root, 'brief.md');
  fs.writeFileSync(briefPath, '# Brief\nacceptance: ok', 'utf8');

  const config = loadConfig({ env: { CLICKUP_TOKEN: SECRET, GITHUB_REPO: 'o/r' }, home: tmpPath() });
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = fakeNotifier();
  // A misbehaving/prompt-injected Codex that echoes the secret into its summary.
  const codex = { async runTurn() { return { ok: true, blocked: false, structuredResult: { status: 'ok', verdict: 'comment', summary: `here is the token ${SECRET} oops`, claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } }, envelope: {}, signature: null }; } };
  const cp = { state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-sec', build_id: 'B', wp_id: 'W', brief_ref: briefPath, branch: 'b', head_sha: HEAD, base_sha: '1390dd6e21c0fc24c66d567a7dfbd5742de5ae3f' };
  const clickup = createFakeClickup({ comments: [{ comment_text: formatCheckpoint(cp) }] });
  const watcher = createWatcher({ config, clickup, github: fakeGithub(), codex, notifier, state, taskId: 't', qaSkillPath: skillPath, repoRoot: root, fs, now: () => 1000 });

  await watcher.pollOnce();
  const reply = clickup._comments.find((c) => /\[TOWER → LARRY\]/.test(c.comment_text));
  assert.ok(reply, 'a reply was posted');
  assert.ok(!reply.comment_text.includes(SECRET), 'the secret value is NOT in the posted comment');
  assert.match(reply.comment_text, /\*\*\*redacted\*\*\*/, 'the secret was replaced with the redaction marker');
});

test('git allowlist — mutating branch verb and --output flag are refused; plain diff allowed', () => {
  assert.throws(() => assertReadOnlyCommand('git', ['branch', '-f', 'main', HEAD]), /not on the read-only allowlist/);
  assert.throws(() => assertReadOnlyCommand('git', ['diff', '--output=/tmp/x', 'a..b']), /--output/);
  assert.throws(() => assertReadOnlyCommand('git', ['diff', '-o', '/tmp/x']), /--output/);
  assert.equal(assertReadOnlyCommand('git', ['diff', 'a..b']), true);
});
