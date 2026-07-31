import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseWorktreePorcelain,
  classifyWorktree,
  computeDisposition,
  matchLiveWorkers,
  gitStatusFor,
  unpushedCountFor,
} from './worktree-recon.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SELF_SOURCE = readFileSync(join(__dirname, 'worktree-recon.mjs'), 'utf8');

const SAMPLE_PORCELAIN = `worktree C:/Fusion247PKA
HEAD 95c265de729e26114b1e1eb7dc7d8630502aca1d
branch refs/heads/recovery/2026-07-31-governor-abort-handoff

worktree C:/Fusion247PKA/.claude/worktrees/agent-a183841aed5508d75
HEAD acd3512fb68bcc30a11bf375a3dcf3adfbc38502
branch refs/heads/build-015/shop-state-store

worktree C:/Fusion247PKA-audit
HEAD c5160a9
branch refs/heads/audit/de-mypka-extraction-20260728

worktree C:/Fusion247PKA-governor
HEAD 780a517
branch refs/heads/build-018/session-governor
`;

test('parseWorktreePorcelain extracts path/head/branch per block', () => {
  const parsed = parseWorktreePorcelain(SAMPLE_PORCELAIN);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].path, 'C:/Fusion247PKA');
  assert.equal(parsed[0].branch, 'recovery/2026-07-31-governor-abort-handoff');
  assert.equal(parsed[1].path, 'C:/Fusion247PKA/.claude/worktrees/agent-a183841aed5508d75');
});

test('classifyWorktree recognises primary, active-build, agent-worktree, named-worktree', () => {
  const opts = { primaryPath: 'C:/Fusion247PKA', buildPaths: ['C:/Fusion247PKA-governor'] };
  assert.equal(classifyWorktree({ path: 'C:/Fusion247PKA' }, opts), 'primary-checkout');
  assert.equal(classifyWorktree({ path: 'C:/Fusion247PKA-governor' }, opts), 'active-build');
  assert.equal(
    classifyWorktree({ path: 'C:/Fusion247PKA/.claude/worktrees/agent-a183841aed5508d75' }, opts),
    'baseline-agent-worktree'
  );
  assert.equal(classifyWorktree({ path: 'C:/Fusion247PKA-audit' }, opts), 'baseline-named-worktree');
  assert.equal(classifyWorktree({ path: 'C:/Fusion247PKA-tower' }, opts), 'baseline-named-worktree');
  assert.equal(classifyWorktree({ path: 'C:/Fusion247PKA-w01' }, opts), 'baseline-named-worktree');
  assert.equal(classifyWorktree({ path: 'C:/SomewhereElse' }, opts), 'unknown');
});

test('computeDisposition: active-build always in-progress-owned regardless of dirt', () => {
  assert.equal(
    computeDisposition({ classification: 'active-build', dirty: true, unpushedCount: 3 }),
    'in-progress-owned'
  );
});

test('computeDisposition: unreadable status never silently reported clean', () => {
  assert.equal(
    computeDisposition({ classification: 'baseline-agent-worktree', statusError: true }),
    'unknown-unreadable'
  );
});

test('computeDisposition: clean + fully pushed -> reconciled-clean', () => {
  assert.equal(
    computeDisposition({ classification: 'baseline-agent-worktree', dirty: false, unpushedCount: 0 }),
    'reconciled-clean'
  );
});

test('computeDisposition: unpushed commits with a clean tree -> unreconciled-unpushed', () => {
  assert.equal(
    computeDisposition({ classification: 'baseline-agent-worktree', dirty: false, unpushedCount: 2 }),
    'unreconciled-unpushed'
  );
});

// Mutation test (per 02-MAP.md §9 T-07 row): inject a fake dirty worktree -> appears as
// unreconciled. This is the acceptance-critical case: a dirty tree must never be
// reported as reconciled.
test('mutation: a dirty worktree is reported unreconciled, never reconciled-clean', () => {
  const disposition = computeDisposition({
    classification: 'baseline-agent-worktree',
    dirty: true,
    unpushedCount: 0,
  });
  assert.equal(disposition, 'unreconciled-dirty');
  assert.notEqual(disposition, 'reconciled-clean');
});

test('matchLiveWorkers attaches pids of processes whose command line references the worktree path', () => {
  const worktrees = [{ path: 'C:/Fusion247PKA-governor' }, { path: 'C:/Fusion247PKA-audit' }];
  const processes = [
    { pid: 111, commandLine: 'node C:\\Fusion247PKA-governor\\tools\\governor\\reconcile.mjs' },
    { pid: 222, commandLine: 'node C:\\Windows\\unrelated.js' },
  ];
  const result = matchLiveWorkers(worktrees, processes);
  assert.deepEqual(result[0].liveWorkerPids, [111]);
  assert.deepEqual(result[1].liveWorkerPids, []);
});

// Regression: found by running reconcile() against the real 22-worktree estate.
// "C:/Fusion247PKA" is a literal substring of "C:/Fusion247PKA-governor" (and
// -audit/-tower/-w01) — a naive .includes() falsely attributed a sibling worktree's
// live worker to the primary checkout.
test('mutation: a sibling worktree with a shared name prefix is never falsely matched', () => {
  const worktrees = [{ path: 'C:/Fusion247PKA' }, { path: 'C:/Fusion247PKA-governor' }];
  const processes = [
    { pid: 999, commandLine: 'node C:\\Fusion247PKA-governor\\tools\\governor\\reconcile.mjs' },
  ];
  const result = matchLiveWorkers(worktrees, processes);
  assert.deepEqual(result[0].liveWorkerPids, [], 'primary checkout must NOT claim the sibling worktree\'s worker');
  assert.deepEqual(result[1].liveWorkerPids, [999]);
});

test('the module never invokes a destructive git or filesystem operation', () => {
  const forbidden = [
    /worktree['"]?\s*,\s*['"]remove/i,
    /\bgit\b[^\n]*\bbranch\b[^\n]*-D\b/,
    /\brmSync\b/,
    /\bunlinkSync\b/,
    /\brm -rf\b/,
    /--force\b/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(SELF_SOURCE, pattern, `forbidden destructive pattern found: ${pattern}`);
  }
});

// Real-git mutation test: create a scratch repo + a genuine worktree, dirty it for
// real, and prove the read-only git-status adapter reports dirty=true. This exercises
// the actual git adapter (gitStatusFor), not just the pure disposition function above.
test('mutation (real git): a genuinely dirtied worktree is detected as dirty, and cleanup never touches it destructively', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'governor-recon-realgit-'));
  const repo = join(scratch, 'repo');
  const wtPath = join(scratch, 'repo-wt');
  try {
    execFileSync('git', ['init', '-q', repo]);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test']);
    writeFileSync(join(repo, 'file.txt'), 'v1\n');
    execFileSync('git', ['-C', repo, 'add', 'file.txt']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'init']);
    execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'test-branch', wtPath]);

    // Clean immediately after creation.
    const cleanStatus = gitStatusFor(wtPath);
    assert.equal(cleanStatus.dirty, false);
    assert.equal(computeDisposition({ classification: 'unknown', ...cleanStatus, unpushedCount: 0 }), 'reconciled-clean');

    // Now genuinely dirty it — this is the injected fault.
    appendFileSync(join(wtPath, 'file.txt'), 'uncommitted change\n');
    const dirtyStatus = gitStatusFor(wtPath);
    assert.equal(dirtyStatus.dirty, true);
    assert.equal(
      computeDisposition({ classification: 'unknown', ...dirtyStatus, unpushedCount: 0 }),
      'unreconciled-dirty',
      'a real dirty worktree must be reported unreconciled, never reconciled'
    );
  } finally {
    // Test-harness cleanup of our OWN scratch fixture is not the module doing it —
    // the module under test never called this.
    try {
      execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', wtPath]);
    } catch {
      // best-effort cleanup
    }
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('unpushedCountFor returns null (unknown, never 0) when there is no upstream', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'governor-recon-noupstream-'));
  try {
    execFileSync('git', ['init', '-q', scratch]);
    execFileSync('git', ['-C', scratch, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', scratch, 'config', 'user.name', 'Test']);
    writeFileSync(join(scratch, 'f.txt'), 'x\n');
    execFileSync('git', ['-C', scratch, 'add', 'f.txt']);
    execFileSync('git', ['-C', scratch, 'commit', '-q', '-m', 'init']);
    assert.equal(unpushedCountFor(scratch), null);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
