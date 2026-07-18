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

test('resolveBrief — a valid internal Markdown brief resolves', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const inside = path.join(root, 'wp1-brief.md');
  fs.writeFileSync(inside, '# WP1\nacceptance: it works', 'utf8');
  const r = await resolveBrief(inside, { fs, repoRoot: root });
  assert.equal(r.ok, true, r.error ?? '');
  assert.equal(r.kind, 'file');
  assert.match(r.excerpt, /acceptance/);
});

test('resolveBrief — a `../` traversal is refused (OUTSIDE root)', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const r = await resolveBrief('../escape.md', { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /OUTSIDE the governed repo root/);
});

test('resolveBrief — an absolute external path is refused (OUTSIDE root)', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const external = path.join(os.tmpdir(), `external-${randomUUID()}.md`);
  const r = await resolveBrief(external, { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /OUTSIDE the governed repo root/);
});

test('resolveBrief — an unsupported extension is refused', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const bad = path.join(root, 'creds.env');
  fs.writeFileSync(bad, 'CLICKUP_TOKEN=whatever', 'utf8');
  const r = await resolveBrief(bad, { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /not an allowed brief type/);
});

test('resolveBrief — an oversized brief is refused BEFORE reading', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const big = path.join(root, 'huge.md');
  fs.writeFileSync(big, Buffer.alloc(1_000_001, 0x61)); // > 1 MB of 'a'
  const r = await resolveBrief(big, { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /too large/);
});

test('resolveBrief — a symlink INSIDE the repo pointing OUTSIDE is refused (realpath)', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tower-root-')));
  const outside = path.join(os.tmpdir(), `outside-${randomUUID()}.md`);
  fs.writeFileSync(outside, '# secret brief\nacceptance: exfiltrate', 'utf8');
  const link = path.join(root, 'link.md');
  try {
    fs.symlinkSync(outside, link, 'file');
  } catch {
    t.skip('cannot create a symlink on this OS / privilege level');
    return;
  }
  const r = await resolveBrief(link, { fs, repoRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.error, /escapes the governed repo root|OUTSIDE the governed repo root/);
});

test('outbound reply is redacted — a secret in the Codex summary never reaches ClickUp', async () => {
  // Assemble a token-SHAPED value at RUNTIME from harmless fragments so no token-shaped
  // substring exists in this tracked source (keeps the secret-scan green) while still
  // exercising the redactor on a realistic-looking token.
  const SECRET = ['pk', 'LIVE', 'secret', 'value', '1234567890'].join('_');
  const root = path.join(os.tmpdir(), `tower-root-${randomUUID()}`);
  fs.mkdirSync(root, { recursive: true });
  const briefPath = path.join(root, 'brief.md');
  fs.writeFileSync(briefPath, '# Brief\nacceptance: ok', 'utf8');

  const config = loadConfig({ env: { CLICKUP_TOKEN: SECRET, GITHUB_REPO: 'o/r', TOWER_AUTHORISED_AUTHOR_IDS: 'larry' }, home: tmpPath() });
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
