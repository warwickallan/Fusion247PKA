// WO-2026-08-05-TW3 — Proofs for gitEvidence.mjs's GH-SOURCED mechanism (Gap 2).
//
// Gap 2, stated exactly: `gatherGitEvidence`'s `git rev-parse`/`git diff` calls needed the target
// commits to already exist in the LOCAL object database at `cwd`. That happened to work only
// because every worktree in this estate shares one underlying `.git` object store via
// `git worktree add` — a convention, never a guarantee, and exactly the kind of "tied to a
// specific checkout" dependency this whole phase exists to remove.
//
// These proofs exercise gatherGitEvidence from a directory GENUINELY DISCONNECTED from
// Fusion247PKA's object database (a fresh `git init` in an OS temp dir, holding no relationship
// whatsoever to the reviewed repo or its commits) and show evidence-gathering still correctly
// resolves the diff for a real-shaped PR head — via an injected `spawn` standing in for `gh`,
// so the suite makes no real network call, same discipline as reviewTooling.test.mjs.
//
//   node --test test/gitEvidenceGh.test.mjs
//
// NOT wired into a package.json script or a CI workflow, same limitation reviewTooling.test.mjs
// already carries and reports plainly rather than silently — services/control-plane/package.json
// and .github/workflows/ are both outside this Work Order's file surface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';

import { gatherGitEvidence, MAX_DIFF_BYTES } from '../gitEvidence.mjs';

const REPO = 'warwickallan/Fusion247PKA';
const PR = 4242;
const HEAD_SHA = 'e'.repeat(40);
const BASE_SHA = 'f'.repeat(40);

/** A fresh directory holding a git repository with NO relationship whatsoever to
 *  Fusion247PKA's object database — unrelated history, a different remote, nothing shared.
 *  This is the literal disconnected surface the required proof asks for: "a fresh `git init` in
 *  a temp dir ... show evidence-gathering still correctly resolves the diff." */
function makeDisconnectedRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitevidence-disconnected-'));
  // windowsHide:true on every launch — WH3's enumeration scanner (run-tower-loop-tests.mjs)
  // covers this file too and holds every child_process call site to the same convention.
  execFileSync('git', ['init', '--quiet'], { cwd: dir, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'nobody@example.invalid'], { cwd: dir, windowsHide: true });
  execFileSync('git', ['config', 'user.name', 'Disconnected Fixture'], { cwd: dir, windowsHide: true });
  fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'this repo has never heard of Fusion247PKA\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: dir, windowsHide: true });
  execFileSync('git', ['commit', '--quiet', '-m', 'unrelated history, disconnected from Fusion247PKA'], { cwd: dir, windowsHide: true });
  return dir;
}

/** Records every child launch. `git` calls are recorded too (never silently swallowed) so a
 *  test can assert the local git state was NEVER consulted, rather than merely that the result
 *  looked right — the same "the tool cannot claim to have seen ground it did not walk" bar
 *  reviewTooling.test.mjs already applies to the local-git mechanism.
 *
 *  Only the `gh` argv shapes gatherGitEvidence's gh-sourced mechanism actually issues are
 *  modelled; anything else is REFUSED — a permissive double would prove something about the
 *  double, not about the code. */
function makeGhFixture({ diffChunks = [Buffer.from('diff --git a/x.mjs b/x.mjs\n+hello\n')], names = 'x.mjs\n', headSha = HEAD_SHA, baseSha = BASE_SHA } = {}) {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    const c = new EventEmitter();
    c.stdout = new EventEmitter();
    c.stderr = new EventEmitter();
    c.kill = () => {};
    setImmediate(() => {
      if (cmd !== 'gh') {
        c.stderr.emit('data', Buffer.from(`fixture refuses a non-gh command: ${cmd} ${args.join(' ')}\n`));
        return c.emit('close', 127);
      }
      if (args[0] === 'api' && args[1] === `repos/${REPO}/pulls/${PR}`) {
        c.stdout.emit('data', Buffer.from(`${JSON.stringify({ head: headSha, base: baseSha })}\n`));
        return c.emit('close', 0);
      }
      if (args[0] === 'pr' && args[1] === 'diff' && args.includes('--name-only')) {
        c.stdout.emit('data', Buffer.from(names));
        return c.emit('close', 0);
      }
      if (args[0] === 'pr' && args[1] === 'diff') {
        for (const chunk of diffChunks) c.stdout.emit('data', chunk);
        return c.emit('close', 0);
      }
      if (args[0] === 'pr' && args[1] === 'checks') {
        c.stdout.emit('data', Buffer.from('unit-tests\tpass\t2s\n'));
        return c.emit('close', 0);
      }
      c.stderr.emit('data', Buffer.from(`fixture does not model this gh invocation: ${args.join(' ')}\n`));
      c.emit('close', 1);
    });
    return c;
  };
  spawn.calls = calls;
  return spawn;
}

// ══ 1. THE REQUIRED PROOF — a genuinely disconnected directory, resolved via gh ═════════════

test('a directory with NO relationship to Fusion247PKA\'s object database resolves REAL-SHAPED PR evidence entirely via gh', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const diffText = 'diff --git a/services/foo.mjs b/services/foo.mjs\n@@ -1 +1 @@\n-old\n+new\n';
    const spawn = makeGhFixture({ diffChunks: [Buffer.from(diffText)], names: 'services/foo.mjs\n' });

    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, spawn });

    assert.equal(ev.resolved, true, `expected resolved:true, got blocker=${ev.blocker}`);
    assert.equal(ev.head_sha, HEAD_SHA, 'head came from gh, not from any local ref');
    assert.equal(ev.base_sha, BASE_SHA, 'base came from gh (no explicit baseSha given)');
    assert.deepEqual(ev.changed_files, ['services/foo.mjs']);
    assert.equal(ev.diff_text, diffText, 'the diff text is exactly what gh returned');
    assert.equal(ev.diff_truncated, false);

    // THE ACTUAL PROOF: local git state at `cwd` was NEVER consulted for the diff. A disconnected
    // temp repo has no relationship to head/base SHAs shaped like this — if ANY local git call had
    // been attempted for rev-parse/diff, it would have hit this fixture's refusal branch (exit
    // 127) and `resolved` would be false. It is true, AND no `git` launch was ever recorded.
    assert.ok(spawn.calls.every((c) => c.cmd === 'gh'), `expected every launch to be gh, got: ${spawn.calls.map((c) => c.cmd).join(', ')}`);
    assert.ok(spawn.calls.length >= 3, `expected at least 3 gh calls (pulls, diff --name-only, diff), got ${spawn.calls.length}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the SAME disconnected directory ALSO carries CI checks, via gh, unchanged from before', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const spawn = makeGhFixture();
    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, spawn });
    assert.equal(ev.resolved, true);
    assert.equal(ev.ci_source, 'gh pr checks');
    assert.match(ev.ci_checks, /unit-tests/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ══ 2. changed_files and diff_text — the SAME range, never quietly divergent ════════════════

test('changed_files and diff_text both come from gh pr diff for the SAME PR — never two different ranges', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const spawn = makeGhFixture({
      diffChunks: [Buffer.from('diff --git a/a.mjs b/a.mjs\n+x\ndiff --git a/b.mjs b/b.mjs\n+y\n')],
      names: 'a.mjs\nb.mjs\n',
    });
    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, spawn });
    assert.equal(ev.resolved, true);
    assert.deepEqual(ev.changed_files, ['a.mjs', 'b.mjs']);
    assert.ok(ev.diff_text.includes('a.mjs') && ev.diff_text.includes('b.mjs'), 'both changed files appear in the diff text too');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ══ 3. MAX_DIFF_BYTES truncation carries over to the gh-sourced diff ════════════════════════

test('a gh-sourced diff over MAX_DIFF_BYTES is truncated LOUDLY, the same discipline as the local-git path', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const big = Buffer.from('x'.repeat(MAX_DIFF_BYTES + 5_000), 'utf8');
    const spawn = makeGhFixture({ diffChunks: [big] });
    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, spawn });
    assert.equal(ev.resolved, true);
    assert.equal(ev.diff_truncated, true);
    assert.equal(ev.diff_total_bytes, big.length);
    assert.ok(ev.diff_bytes <= MAX_DIFF_BYTES, 'the delivered payload respects the cap');
    assert.match(ev.diff_text, /\[diff truncated at \d+ bytes \(cap 60000\) of \d+ bytes\]/, 'the truncation notice is explicit, not silent');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ══ 4. FAIL-CLOSED — a gh failure, or a moved PR, never produces a false resolved:true ═══════

test('a gh api failure fails CLOSED — resolved:false, blocker named, no diff fabricated', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const spawn = () => {
      const c = new EventEmitter();
      c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); c.kill = () => {};
      setImmediate(() => { c.stderr.emit('data', Buffer.from('HTTP 404: Not Found\n')); c.emit('close', 1); });
      return c;
    };
    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, spawn });
    assert.equal(ev.resolved, false);
    assert.match(ev.blocker, /gh api .* failed/);
    assert.equal(ev.diff_text, null, 'no diff text is offered when evidence could not resolve');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a caller-supplied headSha that disagrees with the PR\'s authoritative gh head fails CLOSED (the PR may have moved)', async () => {
  const dir = makeDisconnectedRepo();
  try {
    const spawn = makeGhFixture();
    const ev = await gatherGitEvidence({ cwd: dir, repo: REPO, prNumber: PR, headSha: 'c'.repeat(40), spawn });
    assert.equal(ev.resolved, false);
    assert.match(ev.blocker, /head mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ══ 5. THE CONTROL — the local-git fallback (no prNumber) still works EXACTLY as before ═════

test('CONTROL: with NO prNumber, gatherGitEvidence uses the LOCAL-GIT mechanism exclusively — gh is never invoked, not even for the diff', async () => {
  const HEAD = 'a'.repeat(40);
  const BASE = 'b'.repeat(40);
  const calls = [];
  const fakeSpawn = (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    const c = new EventEmitter();
    c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); c.kill = () => {};
    setImmediate(() => {
      if (cmd !== 'git') { c.stderr.emit('data', Buffer.from(`refused non-git: ${cmd}\n`)); return c.emit('close', 127); }
      if (args[0] === 'rev-parse') {
        const wantsBase = String(args[2]).startsWith(BASE);
        c.stdout.emit('data', Buffer.from(`${wantsBase ? BASE : HEAD}\n`));
        return c.emit('close', 0);
      }
      if (args[0] === 'diff' && args.includes('--name-only')) { c.stdout.emit('data', Buffer.from('local.mjs\n')); return c.emit('close', 0); }
      if (args[0] === 'diff') { c.stdout.emit('data', Buffer.from('diff --git a/local.mjs b/local.mjs\n+local change\n')); return c.emit('close', 0); }
      c.emit('close', 0);
    });
    return c;
  };

  // NO prNumber — this is reviewDiff.mjs's own shape: cwd, headSha, baseSha, spawn, and nothing
  // naming a PR, because a local/dev review genuinely has no PR to ask GitHub about.
  const ev = await gatherGitEvidence({ cwd: '/nowhere', headSha: HEAD, baseSha: BASE, spawn: fakeSpawn });

  assert.equal(ev.resolved, true, `expected the local-git mechanism to resolve, got blocker=${ev.blocker}`);
  assert.equal(ev.head_sha, HEAD);
  assert.equal(ev.base_sha, BASE);
  assert.deepEqual(ev.changed_files, ['local.mjs']);
  assert.equal(ev.diff_text, 'diff --git a/local.mjs b/local.mjs\n+local change\n');
  assert.ok(calls.every((c) => c.cmd === 'git'), `expected every launch to be git, got: ${calls.map((c) => c.cmd).join(', ')}`);
  assert.ok(!calls.some((c) => c.cmd === 'gh'), 'no prNumber ⇒ gh is never invoked, not even for CI checks (unchanged contract)');
});
