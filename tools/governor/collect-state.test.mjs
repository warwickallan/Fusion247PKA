import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  collectRepository,
  collectWorktrees,
  collectBranches,
  collectPullRequests,
  collectEstateState,
  mergeEstateIntoState,
  toUnknownEntry,
} from './collect-state.mjs';
import { validateProgrammeState } from './programme-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

// A fake execFile that dispatches on the git subcommand so each test can control
// exactly which git call succeeds or fails, independent of the real repository.
function fakeExecFile(handlers) {
  return (cmd, args) => {
    if (cmd === 'gh') {
      const key = 'gh';
      if (handlers[key]) return handlers[key](args);
      throw new Error('unexpected gh call in test');
    }
    // args: ['-C', repoPath, ...gitArgs]
    const gitArgs = args.slice(2);
    const key = gitArgs.join(' ');
    for (const [pattern, fn] of Object.entries(handlers)) {
      if (key.startsWith(pattern)) return fn(gitArgs);
    }
    throw new Error(`unhandled git call in test: git ${key}`);
  };
}

// ---------------------------------------------------------------------------
// collectRepository
// ---------------------------------------------------------------------------

test('collectRepository: success path reads all fields', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => '.git',
    'rev-parse HEAD': () => '1111111111111111111111111111111111111111\n',
    'status --porcelain': () => '',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': () => 'origin/build-018/session-governor\n',
    'rev-list --count @{u}..HEAD': () => '0\n',
  });

  const result = collectRepository({
    repoPath: 'C:/fake-repo',
    primaryCheckout: 'C:/fake-primary',
    worktree: 'C:/fake-repo',
    branch: 'build-018/session-governor',
    baseSha: '0000000000000000000000000000000000000000',
    execFile,
  });

  assert.equal(result.repository.head_sha, '1111111111111111111111111111111111111111');
  assert.equal(result.repository.clean, true);
  assert.equal(result.repository.upstream, 'origin/build-018/session-governor');
  assert.equal(result.repository.unpushed_commits, 0);
  assert.deepEqual(result.unknown, []);
});

test('collectRepository: dirty tree is reported dirty, not silently clean', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => '.git',
    'rev-parse HEAD': () => '1111111111111111111111111111111111111111',
    'status --porcelain': () => ' M some/file.js\n',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': () => 'origin/main',
    'rev-list --count @{u}..HEAD': () => '2',
  });
  const result = collectRepository({ repoPath: 'C:/fake-repo', branch: 'x', execFile });
  assert.equal(result.repository.clean, false);
  assert.equal(result.repository.unpushed_commits, 2);
});

test('mutation (git error): unreadable repository -> head_sha is the "unknown" sentinel, never a fake sha, and it lands in `unknown`', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => {
      throw new Error('fatal: not a git repository');
    },
  });
  const result = collectRepository({ repoPath: 'C:/not-a-repo', branch: 'x', baseSha: 'y', execFile });
  assert.equal(result.repository.head_sha, 'unknown');
  assert.equal(result.repository.clean, null);
  assert.equal(result.repository.unpushed_commits, null);
  assert.equal(result.repository.upstream, null);
  assert.ok(result.unknown.some((u) => u.path === 'repository.head_sha'));
  assert.ok(result.unknown[0].why.length > 0);
});

test('collectRepository: no upstream configured -> upstream and unpushed_commits are null, never 0', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => '.git',
    'rev-parse HEAD': () => '1111111111111111111111111111111111111111',
    'status --porcelain': () => '',
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': () => {
      throw new Error('no upstream configured');
    },
    'rev-list --count @{u}..HEAD': () => {
      throw new Error('no upstream configured');
    },
  });
  const result = collectRepository({ repoPath: 'C:/fake-repo', branch: 'x', execFile });
  assert.equal(result.repository.upstream, null);
  assert.equal(result.repository.unpushed_commits, null);
  // A legitimately-nullable field failing does not itself need a declared `unknown`
  // entry (the schema already treats null as "don't know" for these fields) — only
  // required-but-uncapturable fields (head_sha) do.
  assert.equal(result.repository.head_sha, '1111111111111111111111111111111111111111');
});

// ---------------------------------------------------------------------------
// collectWorktrees
// ---------------------------------------------------------------------------

test('collectWorktrees: success maps worktree-recon output onto the schema shape', () => {
  const reconcileFn = () => [
    {
      path: 'C:/fake-repo',
      branch: 'main',
      head: 'abc',
      dirty: false,
      unpushedCount: 0,
      classification: 'primary-checkout',
      disposition: 'reconciled-clean',
      liveWorkerPids: [],
    },
    {
      path: 'C:/fake-repo-build',
      branch: 'build-x',
      head: 'def',
      dirty: true,
      unpushedCount: null,
      classification: 'active-build',
      disposition: 'in-progress-owned',
      liveWorkerPids: [123],
    },
  ];
  const result = collectWorktrees({ repoPath: 'C:/fake-repo', reconcileFn });
  assert.equal(result.worktrees.length, 2);
  assert.equal(result.worktrees[0].protected, true);
  assert.equal(result.worktrees[1].protected, false);
  assert.deepEqual(result.worktrees[1].liveWorkerPids, [123]);
  assert.deepEqual(result.unknown, []);
});

test('mutation (unreadable worktree): reconcile() throwing lands worktrees in `unknown`, never as an empty list silently', () => {
  const reconcileFn = () => {
    throw new Error('git worktree list failed: permission denied');
  };
  const result = collectWorktrees({ repoPath: 'C:/fake-repo', reconcileFn });
  assert.deepEqual(result.worktrees, []);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].path, 'worktrees');
  assert.match(result.unknown[0].why, /permission denied/);
});

test('collectWorktrees: reconcile() returning zero worktrees is still declared unknown, not a silent []', () => {
  const result = collectWorktrees({ repoPath: 'C:/fake-repo', reconcileFn: () => [] });
  assert.deepEqual(result.worktrees, []);
  assert.equal(result.unknown[0].path, 'worktrees');
});

// ---------------------------------------------------------------------------
// collectBranches
// ---------------------------------------------------------------------------

test('collectBranches: success computes head and ahead per spec; behind is always null and always declared unknown', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => '.git',
    'rev-parse build-018/session-governor': () => 'cccc',
    'rev-list --count origin/build-018/session-governor..build-018/session-governor': () => '3',
  });
  const result = collectBranches({
    repoPath: 'C:/fake-repo',
    branchSpecs: [{ name: 'build-018/session-governor', role: 'build', upstream: 'origin/build-018/session-governor' }],
    execFile,
  });
  assert.equal(result.branches[0].head, 'cccc');
  assert.equal(result.branches[0].ahead, 3);
  assert.equal(result.branches[0].behind, null);
  assert.ok(result.unknown.some((u) => u.path === 'branches.behind'));
});

test('mutation (git error): unreadable repository -> branches is empty and declared unknown, never a silent []', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => {
      throw new Error('fatal: not a git repository');
    },
  });
  const result = collectBranches({
    repoPath: 'C:/not-a-repo',
    branchSpecs: [{ name: 'main', role: 'protected' }],
    execFile,
  });
  assert.deepEqual(result.branches, []);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].path, 'branches');
  assert.match(result.unknown[0].why, /unreadable/);
});

test('collectBranches: a branch that cannot be resolved locally gets a null head, not an empty string, and does not break sibling branches', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => '.git',
    'rev-parse main': () => 'main-sha',
    'rev-parse deleted-branch': () => {
      throw new Error('unknown revision');
    },
  });
  const result = collectBranches({
    repoPath: 'C:/fake-repo',
    branchSpecs: [
      { name: 'main', role: 'protected' },
      { name: 'deleted-branch', role: 'other' },
    ],
    execFile,
  });
  const main = result.branches.find((b) => b.name === 'main');
  const deleted = result.branches.find((b) => b.name === 'deleted-branch');
  assert.equal(main.head, 'main-sha');
  assert.equal(deleted.head, null);
});

test('collectBranches: no specs supplied -> empty and declared unknown', () => {
  const result = collectBranches({ repoPath: 'C:/fake-repo', branchSpecs: [], execFile: fakeExecFile({ 'rev-parse --git-dir': () => '.git' }) });
  assert.deepEqual(result.branches, []);
  assert.equal(result.unknown[0].path, 'branches');
});

// ---------------------------------------------------------------------------
// collectPullRequests
// ---------------------------------------------------------------------------

test('collectPullRequests: no PR for a branch is a positive "none", not a failure', () => {
  const execFile = fakeExecFile({ gh: () => '[]' });
  const result = collectPullRequests({ ghRepo: 'owner/repo', branchSpecs: [{ name: 'build-x' }], execFile });
  assert.equal(result.pull_requests.length, 1);
  assert.equal(result.pull_requests[0].state, 'none');
  assert.deepEqual(result.unknown, []);
});

test('collectPullRequests: maps gh states onto the schema enum', () => {
  const execFile = fakeExecFile({
    gh: () => JSON.stringify([{ number: 42, url: 'https://x/42', title: 'T', state: 'OPEN', headRefName: 'build-x' }]),
  });
  const result = collectPullRequests({ ghRepo: 'owner/repo', branchSpecs: [{ name: 'build-x' }], execFile });
  assert.equal(result.pull_requests[0].state, 'open');
  assert.equal(result.pull_requests[0].number, 42);
});

test('mutation (no gh): gh invocation failing lands pull_requests in `unknown`, never an empty list silently', () => {
  const execFile = fakeExecFile({
    gh: () => {
      throw new Error("spawn gh ENOENT");
    },
  });
  const result = collectPullRequests({ ghRepo: 'owner/repo', branchSpecs: [{ name: 'build-x' }], execFile });
  assert.deepEqual(result.pull_requests, []);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].path, 'pull_requests');
  assert.match(result.unknown[0].why, /ENOENT/);
});

test('collectPullRequests: no ghRepo configured -> declared unknown without attempting a call', () => {
  let called = false;
  const execFile = () => {
    called = true;
    throw new Error('should not be called');
  };
  const result = collectPullRequests({ ghRepo: null, branchSpecs: [{ name: 'x' }], execFile });
  assert.equal(called, false);
  assert.deepEqual(result.pull_requests, []);
  assert.equal(result.unknown[0].path, 'pull_requests');
});

// ---------------------------------------------------------------------------
// collectEstateState / mergeEstateIntoState — composition
// ---------------------------------------------------------------------------

test('collectEstateState: composes all four sources and aggregates + dedupes unknown', () => {
  const execFile = fakeExecFile({
    'rev-parse --git-dir': () => {
      throw new Error('fatal: not a git repository');
    },
    gh: () => {
      throw new Error('gh not found');
    },
  });
  const estate = collectEstateState({
    repoPath: 'C:/fake-repo',
    branch: 'x',
    baseSha: 'y',
    branchSpecs: [{ name: 'x', role: 'build' }],
    ghRepo: 'owner/repo',
    reconcileFn: () => {
      throw new Error('worktree list failed');
    },
    execFile,
  });
  assert.equal(estate.repository.head_sha, 'unknown');
  assert.deepEqual(estate.worktrees, []);
  assert.deepEqual(estate.branches, []);
  assert.deepEqual(estate.pull_requests, []);
  const paths = estate.unknown.map((u) => u.path);
  assert.ok(paths.includes('repository.head_sha'));
  assert.ok(paths.includes('worktrees'));
  assert.ok(paths.includes('branches'));
  assert.ok(paths.includes('pull_requests'));
});

test('mergeEstateIntoState: overlays estate-derived fields and dedupes `unknown` by path', () => {
  const base = { programme: { id: 'x' }, workers: ['w'], unknown: [toUnknownEntry('workers', 'best-effort only')] };
  const estate = {
    repository: { branch: 'x' },
    worktrees: [],
    branches: [],
    pull_requests: [],
    unknown: [toUnknownEntry('workers', 'duplicate reason should be dropped'), toUnknownEntry('branches', 'unreadable')],
  };
  const merged = mergeEstateIntoState(base, estate);
  assert.equal(merged.repository.branch, 'x');
  assert.equal(merged.workers.length, 1); // untouched — T-13 does not collect workers
  const workersUnknown = merged.unknown.filter((u) => u.path === 'workers');
  assert.equal(workersUnknown.length, 1);
  assert.equal(workersUnknown[0].why, 'best-effort only'); // first occurrence wins
  assert.ok(merged.unknown.some((u) => u.path === 'branches'));
});

// ---------------------------------------------------------------------------
// ACCEPTANCE (real estate, no mocks): collectEstateState against THIS actual repo,
// merged onto a fixture's non-estate sections, must validate as a whole.
// ---------------------------------------------------------------------------

test('acceptance: collectEstateState against the real repository produces a document that passes validateProgrammeState', () => {
  const repoPath = dirname(dirname(__dirname)); // tools/governor -> tools -> repo root
  const estate = collectEstateState({
    repoPath,
    primaryCheckout: 'C:/Fusion247PKA',
    worktree: repoPath,
    branch: 'build-018/session-governor',
    baseSha: 'ef96a3327f896e025731769c72157fd722daa02f',
    branchSpecs: [{ name: 'build-018/session-governor', role: 'build', upstream: 'origin/build-018/session-governor', note: 'This programme.' }],
    ghRepo: 'warwickallan/Fusion247PKA',
    primaryPath: 'C:/Fusion247PKA',
    buildPaths: [repoPath],
  });

  assert.equal(estate.repository.branch, 'build-018/session-governor');
  assert.match(estate.repository.head_sha, /^([0-9a-f]{40}|unknown)$/);
  assert.ok(Array.isArray(estate.worktrees) && estate.worktrees.length > 0, 'expected at least one real worktree');
  assert.ok(Array.isArray(estate.branches) && estate.branches.length === 1);
  assert.ok(Array.isArray(estate.pull_requests) && estate.pull_requests.length === 1);

  const fixture = loadFixture();
  const merged = mergeEstateIntoState(fixture, estate);
  const validation = validateProgrammeState(merged);
  assert.equal(validation.ok, true, `expected valid, got errors: ${JSON.stringify(validation.errors)}`);
  assert.ok(validation.examined > 0);
});
