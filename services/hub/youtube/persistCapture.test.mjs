// Tests for durable auto-persistence of generated captures.
// These drive a REAL temporary git repository rather than a mocked git, because the behaviour under
// test IS the git behaviour (staging only named paths, --only commits, idempotent re-runs).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { persistCapture, captureCommitMessage } from './persistCapture.mjs';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persist-capture-'));
  git(['init', '-q', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  git(['add', 'seed.txt'], dir);
  git(['commit', '-q', '-m', 'seed'], dir);
  return dir;
}

function writeCapture(dir, videoId) {
  const noteRel = `Team Knowledge/Sources/${videoId}-note.md`;
  const rawRel = `Team Knowledge/Sources/_raw/${videoId}`;
  fs.mkdirSync(path.join(dir, rawRel), { recursive: true });
  fs.writeFileSync(path.join(dir, noteRel), `# note ${videoId}\n`);
  fs.writeFileSync(path.join(dir, rawRel, 'tubeair-report.md'), 'raw transcript\n');
  fs.writeFileSync(path.join(dir, rawRel, 'manifest.json'), '{}\n');
  return { noteRel, rawRel };
}

test('a generated capture is committed, so it no longer exists only as untracked working-tree state', () => {
  const dir = makeRepo();
  const { noteRel, rawRel } = writeCapture(dir, 'vid1');

  const before = git(['rev-parse', 'HEAD'], dir);
  const r = persistCapture({ repoRoot: dir, paths: [noteRel, rawRel], message: 'Capture: vid1' });

  assert.equal(r.committed, true);
  assert.notEqual(r.sha, before, 'a new commit was created');
  assert.equal(git(['status', '--porcelain'], dir), '', 'nothing left untracked or dirty');

  const files = git(['show', '--name-only', '--format=', 'HEAD'], dir).split('\n').filter(Boolean);
  assert.ok(files.includes(noteRel), 'the note is in the commit');
  assert.ok(files.some((f) => f.startsWith(rawRel)), 'the immutable _raw evidence is in the commit');
});

test('re-running on an unchanged capture makes no empty commit (writeNote is idempotent)', () => {
  const dir = makeRepo();
  const { noteRel, rawRel } = writeCapture(dir, 'vid2');
  const first = persistCapture({ repoRoot: dir, paths: [noteRel, rawRel], message: 'Capture: vid2' });
  assert.equal(first.committed, true);

  const second = persistCapture({ repoRoot: dir, paths: [noteRel, rawRel], message: 'Capture: vid2' });
  assert.equal(second.committed, false);
  assert.equal(second.reason, 'no-changes');
  assert.equal(git(['rev-parse', 'HEAD'], dir), first.sha, 'HEAD did not move');
});

test('unrelated work in the tree is NEVER swept into the capture commit', () => {
  const dir = makeRepo();
  const { noteRel, rawRel } = writeCapture(dir, 'vid3');

  // Someone is mid-edit on unrelated files: one staged, one merely modified, one untracked.
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed edited\n');
  fs.writeFileSync(path.join(dir, 'staged.txt'), 'staged work\n');
  fs.writeFileSync(path.join(dir, 'scratch.txt'), 'untracked scratch\n');
  git(['add', 'staged.txt'], dir);

  const r = persistCapture({ repoRoot: dir, paths: [noteRel, rawRel], message: 'Capture: vid3' });
  assert.equal(r.committed, true);

  const files = git(['show', '--name-only', '--format=', 'HEAD'], dir).split('\n').filter(Boolean);
  assert.ok(!files.includes('seed.txt'), 'unrelated modified file not committed');
  assert.ok(!files.includes('staged.txt'), 'unrelated STAGED file not committed');
  assert.ok(!files.includes('scratch.txt'), 'unrelated untracked file not committed');
  assert.deepEqual(files.filter((f) => !f.startsWith('Team Knowledge/')), [], 'only capture paths committed');

  // And the caller's in-progress work is still exactly where they left it.
  const status = git(['status', '--porcelain'], dir);
  assert.match(status, /staged\.txt/);
  assert.match(status, /seed\.txt/);
  assert.match(status, /scratch\.txt/);
});

test('persisting does not approve: review_state / pending-warwick-review are untouched', () => {
  const dir = makeRepo();
  const videoId = 'vid4';
  const noteRel = `Team Knowledge/Sources/${videoId}-note.md`;
  fs.mkdirSync(path.join(dir, 'Team Knowledge/Sources'), { recursive: true });
  fs.writeFileSync(path.join(dir, noteRel),
    '---\nreview_state: ai_created\ntags:\n  - pending-warwick-review\n---\n\n# body\n');

  persistCapture({ repoRoot: dir, paths: [noteRel], message: captureCommitMessage({ videoId, title: 'T' }) });

  const committed = git(['show', `HEAD:${noteRel}`], dir);
  assert.match(committed, /review_state: ai_created/, 'review_state preserved verbatim');
  assert.match(committed, /pending-warwick-review/, 'human acceptance gate preserved');

  const msg = git(['log', '-1', '--format=%B'], dir);
  assert.match(msg, /STORED, NOT APPROVED/, 'history records that storing is not approving');
});

test('fails soft and never throws when the target is not a git repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  fs.writeFileSync(path.join(dir, 'note.md'), 'x\n');
  let r;
  assert.doesNotThrow(() => { r = persistCapture({ repoRoot: dir, paths: ['note.md'], message: 'Capture: x' }); });
  assert.equal(r.committed, false);
  assert.equal(r.reason, 'git-failed');
  assert.ok(r.error, 'the reason is reported rather than swallowed silently');
});

test('fails soft on bad input rather than throwing into the capture path', () => {
  for (const bad of [
    { repoRoot: null, paths: ['a'], message: 'm', expect: 'no-repo-root' },
    { repoRoot: '/tmp', paths: [], message: 'm', expect: 'no-paths' },
    { repoRoot: '/tmp', paths: ['a'], message: '  ', expect: 'no-message' },
  ]) {
    let r;
    assert.doesNotThrow(() => { r = persistCapture(bad); });
    assert.equal(r.committed, false);
    assert.equal(r.reason, bad.expect);
  }
});

test('a git failure is reported, not thrown — capture must never be broken by persistence', () => {
  const r = persistCapture({
    repoRoot: '/anywhere', paths: ['a'], message: 'm',
    runGit: () => { throw new Error('simulated git explosion'); },
  });
  assert.equal(r.committed, false);
  assert.equal(r.reason, 'git-failed');
  assert.match(r.error, /simulated git explosion/);
});

test('captureCommitMessage states the storage/approval distinction', () => {
  const m = captureCommitMessage({ videoId: 'abc', title: 'A Title' });
  assert.match(m, /^Capture: abc — A Title/);
  assert.match(m, /review_state: ai_created/);
  assert.match(m, /STORED, NOT APPROVED/);
  assert.match(m, /pending-warwick-review remains/);
});
