import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assessRotationSafety,
  isBankingCommit,
  rotateSession,
  renderClearInstruction,
  renderRefusal,
  normaliseSeparators,
  EXIT,
} from './rotate-session.mjs';
import { readProgrammeState, HANDOFF_SECTIONS } from './programme-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const ROTATE_SRC = join(__dirname, 'rotate-session.mjs');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

function safeEstate(worktreePath) {
  return {
    repository: {
      head_sha: '1111111111111111111111111111111111111111',
      clean: true,
      unpushed_commits: 0,
    },
    worktrees: [
      { path: worktreePath, classification: 'active-build', disposition: 'in-progress-owned', liveWorkerPids: [] },
    ],
    unknown: [],
  };
}

// ---------------------------------------------------------------------------
// assessRotationSafety — the judgement, pure
// ---------------------------------------------------------------------------

test('assess: a clean, pushed, worker-free estate is safe', () => {
  const r = assessRotationSafety(safeEstate('C:/wt'), { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, true);
  assert.deepEqual(r.obstacles, []);
  assert.ok(r.checked > 0, 'must assert a non-zero count of checks actually run (INV-5)');
});

test('MUTATION: a dirty tree makes it REFUSE, with the precise obstacle', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.clean = false;
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.equal(r.obstacles.length, 1);
  assert.equal(r.obstacles[0].kind, 'dirty-tree');
  assert.match(r.obstacles[0].detail, /uncommitted/i);
});

test('MUTATION: an unpushed commit makes it REFUSE, with the count named', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.unpushed_commits = 3;
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.equal(r.obstacles[0].kind, 'unpushed-commits');
  assert.match(r.obstacles[0].detail, /3 commit/);
});

test('MUTATION: a live worker in this worktree makes it REFUSE, with the pids named', () => {
  const estate = safeEstate('C:/wt');
  estate.worktrees[0].liveWorkerPids = [4242, 4243];
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.equal(r.obstacles[0].kind, 'live-worker');
  assert.match(r.obstacles[0].detail, /4242/);
});

test('a live worker that is the rotation process itself is excluded, not a false refusal', () => {
  const estate = safeEstate('C:/wt');
  estate.worktrees[0].liveWorkerPids = [999];
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt', excludePids: [999] });
  assert.equal(r.safe, true);
});

test('a live worker in ANOTHER worktree is not this rotation\'s business', () => {
  const estate = safeEstate('C:/wt');
  estate.worktrees.push({ path: 'C:/other', classification: 'primary-checkout', disposition: 'reconciled-clean', liveWorkerPids: [777] });
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, true);
});

test('MUTATION (unknown is not safe): unreadable HEAD refuses rather than banking blind', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.head_sha = 'unknown';
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.ok(r.obstacles.some((o) => o.kind === 'unreadable'));
});

test('MUTATION (unknown is not clean): null cleanliness refuses, never treated as clean', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.clean = null;
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.match(r.obstacles[0].detail, /Unknown is not clean/);
});

test('MUTATION (unknown is never zero): null unpushed count refuses', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.unpushed_commits = null;
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.match(r.obstacles[0].detail, /never zero/);
});

test('MUTATION: a safety-critical declared `unknown` becomes an obstacle, never a silently-passed check', () => {
  const estate = safeEstate('C:/wt');
  estate.unknown = [{ path: 'worktrees', why: 'worktree reconciliation failed' }];
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.ok(r.obstacles.some((o) => o.detail.includes('worktree reconciliation failed')));
});

test('a NON-safety-critical unknown (branches.behind) does not block rotation', () => {
  const estate = safeEstate('C:/wt');
  estate.unknown = [{ path: 'branches.behind', why: 'no fetch performed' }];
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, true);
});

test('MUTATION: own worktree missing from the report refuses (cannot check what was not seen)', () => {
  const estate = safeEstate('C:/somewhere-else');
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.safe, false);
  assert.ok(r.obstacles.some((o) => o.kind === 'unreadable'));
});

test('multiple simultaneous obstacles are ALL reported, not just the first', () => {
  const estate = safeEstate('C:/wt');
  estate.repository.clean = false;
  estate.repository.unpushed_commits = 2;
  estate.worktrees[0].liveWorkerPids = [55];
  const r = assessRotationSafety(estate, { programmeWorktree: 'C:/wt' });
  assert.equal(r.obstacles.length, 3);
  const kinds = r.obstacles.map((o) => o.kind).sort();
  assert.deepEqual(kinds, ['dirty-tree', 'live-worker', 'unpushed-commits']);
});

// ---------------------------------------------------------------------------
// AD-14 — the banking-commit comparison
// ---------------------------------------------------------------------------

test('AD-14: a freshly banked state is NOT stale — HEAD is the banking commit whose parent is banked.head_sha', () => {
  assert.equal(
    isBankingCommit({ headSha: 'bbb', bankedHeadSha: 'aaa', headParentSha: 'aaa' }),
    true
  );
});

test('AD-14: HEAD equal to banked.head_sha is also current (state written but not yet committed)', () => {
  assert.equal(isBankingCommit({ headSha: 'aaa', bankedHeadSha: 'aaa', headParentSha: 'zzz' }), true);
});

test('AD-14 positive control: a genuinely moved HEAD is NOT the banking commit', () => {
  assert.equal(
    isBankingCommit({ headSha: 'ccc', bankedHeadSha: 'aaa', headParentSha: 'bbb' }),
    false
  );
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test('the /clear instruction names the exact command and the exact next action', () => {
  const out = renderClearInstruction(loadFixture());
  assert.match(out, /\/clear/);
  assert.match(out, /Dispatch T-02 to a Sonnet worker/);
  assert.match(out, /build-999\/synthetic/);
});

test('INV-7: the instruction tells Warwick to type /clear, and says it did not run it itself', () => {
  const out = renderClearInstruction(loadFixture());
  assert.match(out, /did NOT run \/clear/);
  assert.match(out, /Rotation recommends; you act/);
});

test('a refusal says nothing was banked and warns against typing /clear', () => {
  const out = renderRefusal({ obstacles: [{ kind: 'dirty-tree', detail: 'x' }], checked: 4 });
  assert.match(out, /REFUSED/);
  assert.match(out, /nothing was banked/i);
  assert.match(out, /Do NOT type \/clear/);
});

// ---------------------------------------------------------------------------
// INV-4 / AD-13 — enforced by source scan, not by comment
// ---------------------------------------------------------------------------

// A substring ban on these NAMES is the wrong control: this module legitimately
// PRINTS "This command did NOT run /close-session", and a test that forbids the
// string would forbid the very sentence that tells Warwick the invariant held.
// The real invariant is that it never INVOKES them — so assert on invocation
// shapes: what it imports, and what it ever shells out to.

test('INV-4: the module imports nothing from close-session, ClickUp, Drive or the session-log surface', () => {
  const src = readFileSync(ROTATE_SRC, 'utf8');
  const imports = [...src.matchAll(/^import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0, 'expected to find imports to check');
  for (const spec of imports) {
    assert.equal(
      /close-session|clickup|googleapis|google-drive|session-logs|librarian/i.test(spec),
      false,
      `rotate-session must not import ${spec}`
    );
  }
});

test('INV-4 / AD-13: the ONLY external command the module ever shells out to is git', () => {
  const src = readFileSync(ROTATE_SRC, 'utf8');
  // Every child_process invocation in this module goes through `execFile(cmd, ...)`.
  const calls = [...src.matchAll(/execFile\s*\(\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  assert.ok(calls.length > 0, 'expected to find at least one execFile invocation to check');
  for (const cmd of calls) {
    assert.equal(cmd, 'git', `rotate-session shelled out to "${cmd}" — only git is permitted`);
  }
});

test('INV-4: the module never writes into the session-log or fusion-brief surfaces other than the one derived handoff', () => {
  const src = readFileSync(ROTATE_SRC, 'utf8');
  assert.equal(/session-logs/i.test(src), false, 'must not touch the session-log surface (AD-13: that is close-session\'s job)');
  // The single permitted write target is the handoff, and it is reached via T-09's
  // sessionHandoffPath() helper rather than a hand-built path.
  assert.match(src, /sessionHandoffPath\(/);
});

test('INV-7: the module never shells out to /clear', () => {
  const src = readFileSync(ROTATE_SRC, 'utf8');
  assert.equal(/execFile\w*\(\s*['"]clear/.test(src), false);
});

// ---------------------------------------------------------------------------
// REAL-GIT end-to-end: scratch repo with a real origin, real commits, real push
// ---------------------------------------------------------------------------

function makeScratchRepo() {
  const root = mkdtempSync(join(tmpdir(), 'governor-rotate-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

  execFileSync('git', ['init', '--bare', origin], { encoding: 'utf8' });
  execFileSync('git', ['init', work], { encoding: 'utf8' });
  git(work, ['config', 'user.email', 'test@example.com']);
  git(work, ['config', 'user.name', 'Test']);
  git(work, ['config', 'commit.gpgsign', 'false']);

  const programmeHome = join(work, 'Deliverables', 'BUILD-999-synthetic');
  mkdirSync(programmeHome, { recursive: true });
  // An unrelated tracked file, so a "dirty tree" test can dirty something OTHER
  // than the state document — dirtying the state itself would fail as corrupt JSON
  // before the dirty-tree check ever ran, testing the wrong control.
  writeFileSync(join(work, 'unrelated-tracked.txt'), 'committed content\n');

  const state = loadFixture();
  state.programme.home = 'Deliverables/BUILD-999-synthetic';
  state.repository.worktree = work;
  state.repository.primary_checkout = work;
  writeFileSync(join(programmeHome, 'programme-state.json'), JSON.stringify(state, null, 2) + '\n');

  git(work, ['add', '-A']);
  git(work, ['commit', '-m', 'initial']);
  git(work, ['remote', 'add', 'origin', origin]);
  git(work, ['push', '-u', 'origin', 'HEAD']);

  return { root, work, origin, programmeHome, git };
}

// A reconcile stub: the scratch repo is not a worktree of the real estate, and this
// test is about the ROTATION, not about re-testing T-07 (already proven, 12/12).
function scratchReconcile(worktreePath, liveWorkerPids = []) {
  return () => [
    {
      path: worktreePath,
      branch: 'master',
      head: 'x',
      dirty: false,
      unpushedCount: 0,
      classification: 'active-build',
      disposition: 'in-progress-owned',
      liveWorkerPids,
    },
  ];
}

test('END-TO-END (real git): a safe estate banks, writes the handoff, commits and pushes', () => {
  const repo = makeScratchRepo();
  try {
    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      bankedBy: 'Opus',
      bankedAt: '2026-07-31',
      reconcileFn: scratchReconcile(repo.work),
      ghRepo: null,
    });

    assert.equal(result.status, 'rotated', JSON.stringify(result));
    assert.equal(result.exitCode, EXIT.ROTATED);
    assert.equal(result.pushed, true);

    // The state on disk is valid and readable.
    const read = readProgrammeState(result.statePath);
    assert.equal(read.ok, true);

    // The handoff was written, and it is the DERIVED render (AD-12): all five
    // section headings, in order.
    assert.equal(existsSync(result.handoffPath), true);
    const handoff = readFileSync(result.handoffPath, 'utf8');
    let cursor = -1;
    for (const section of HANDOFF_SECTIONS) {
      const idx = handoff.indexOf(`## ${section}`);
      assert.ok(idx > cursor, `handoff section out of order or missing: ${section}`);
      cursor = idx;
    }
    assert.match(handoff, /provenance: derived/);

    // AD-14 proven on real git: banked.head_sha is the PARENT of the banking commit.
    const headNow = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const parent = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
    assert.equal(result.bankedHeadSha, parent);
    assert.notEqual(result.bankedHeadSha, headNow);
    assert.equal(isBankingCommit({ headSha: headNow, bankedHeadSha: result.bankedHeadSha, headParentSha: parent }), true);

    // Actually pushed: origin's ref matches local HEAD.
    const originHead = execFileSync('git', ['-C', repo.origin, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(originHead, headNow);

    // The tree is clean afterwards — rotation left nothing uncommitted behind.
    const status = execFileSync('git', ['-C', repo.work, 'status', '--porcelain'], { encoding: 'utf8' });
    assert.equal(status.trim(), '');
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION (real git): a genuinely dirty tree REFUSES and writes nothing', () => {
  const repo = makeScratchRepo();
  try {
    // Dirty a tracked file that is NOT the state document, so the state stays valid
    // and the dirty-tree check is genuinely the control under test.
    writeFileSync(join(repo.work, 'unrelated-tracked.txt'), 'uncommitted edit\n');

    const headBefore = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      bankedBy: 'Opus',
      reconcileFn: scratchReconcile(repo.work),
    });

    // It refuses on the REAL dirty tree that real git reports.
    assert.equal(result.status, 'refused');
    assert.equal(result.exitCode, EXIT.REFUSED);
    assert.ok(result.assessment.obstacles.some((o) => o.kind === 'dirty-tree'));

    // And it committed nothing.
    const headAfter = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(headAfter, headBefore);
    assert.equal(existsSync(join(repo.work, 'Team Knowledge', 'fusion-brief', 'session-handoff.md')), false);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION (real git): a genuinely unpushed commit REFUSES and writes nothing', () => {
  const repo = makeScratchRepo();
  try {
    writeFileSync(join(repo.work, 'unrelated.txt'), 'work that is committed but not pushed\n');
    repo.git(repo.work, ['add', '-A']);
    repo.git(repo.work, ['commit', '-m', 'unpushed work']);

    const headBefore = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      bankedBy: 'Opus',
      reconcileFn: scratchReconcile(repo.work),
    });

    assert.equal(result.status, 'refused');
    assert.ok(result.assessment.obstacles.some((o) => o.kind === 'unpushed-commits'));

    const headAfter = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(headAfter, headBefore);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION (real git): a live worker REFUSES and writes nothing', () => {
  const repo = makeScratchRepo();
  try {
    const headBefore = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      bankedBy: 'Opus',
      reconcileFn: scratchReconcile(repo.work, [31337]),
    });

    assert.equal(result.status, 'refused');
    assert.ok(result.assessment.obstacles.some((o) => o.kind === 'live-worker'));
    assert.match(result.message, /31337/);

    const headAfter = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(headAfter, headBefore);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION: a missing durable state file reports BLIND with its own exit code, never "rotated"', () => {
  const repo = makeScratchRepo();
  try {
    rmSync(join(repo.programmeHome, 'programme-state.json'));
    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      reconcileFn: scratchReconcile(repo.work),
    });
    assert.equal(result.status, 'blind');
    assert.equal(result.exitCode, EXIT.BLIND);
    assert.notEqual(result.exitCode, EXIT.ROTATED);
    assert.match(result.reason, /missing/);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION: a corrupt durable state file reports BLIND, never proceeds to bank over it', () => {
  const repo = makeScratchRepo();
  try {
    writeFileSync(join(repo.programmeHome, 'programme-state.json'), '{ not valid json');
    repo.git(repo.work, ['add', '-A']);
    repo.git(repo.work, ['commit', '-m', 'corrupt the state']);
    repo.git(repo.work, ['push']);

    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      reconcileFn: scratchReconcile(repo.work),
    });
    assert.equal(result.status, 'blind');
    assert.equal(result.exitCode, EXIT.BLIND);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('dry run does the whole judgement and writes NOTHING', () => {
  const repo = makeScratchRepo();
  try {
    const headBefore = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      dryRun: true,
      reconcileFn: scratchReconcile(repo.work),
    });
    assert.equal(result.status, 'would-rotate');
    assert.ok(result.assessment.checked > 0);
    const headAfter = execFileSync('git', ['-C', repo.work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(headAfter, headBefore);
    assert.equal(existsSync(join(repo.work, 'Team Knowledge', 'fusion-brief', 'session-handoff.md')), false);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('the banked document never mixes path separators — a Windows resolve() path is normalised', () => {
  assert.equal(normaliseSeparators('C:\\Fusion247PKA-governor'), 'C:/Fusion247PKA-governor');
  assert.equal(normaliseSeparators('C:/already/forward/'), 'C:/already/forward');
  assert.equal(normaliseSeparators(null), null);
});

test('REGRESSION (real git): repository.worktree in the banked document uses forward slashes, matching every other path', () => {
  const repo = makeScratchRepo();
  try {
    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work.replace(/\//g, '\\'), // simulate a Windows resolve() path
      branch: 'master',
      bankedBy: 'Opus',
      bankedAt: '2026-07-31',
      reconcileFn: scratchReconcile(repo.work),
    });
    assert.equal(result.status, 'rotated', JSON.stringify(result));
    const banked = readProgrammeState(result.statePath);
    assert.equal(banked.ok, true);
    assert.equal(
      banked.data.repository.worktree.includes('\\'),
      false,
      'repository.worktree must not carry backslashes — T-11 compares it against resumption.worktree'
    );
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});

test('MUTATION: a push failure is reported, never silently claimed as a successful rotation', () => {
  const repo = makeScratchRepo();
  try {
    const result = rotateSession({
      programmeHome: repo.programmeHome,
      repoRoot: repo.work,
      branch: 'master',
      bankedBy: 'Opus',
      reconcileFn: scratchReconcile(repo.work),
      git: {
        headSha: () => 'abc',
        headParentSha: () => 'def',
        add: () => {},
        commit: () => {},
        push: () => {
          throw new Error('remote rejected');
        },
      },
    });
    assert.equal(result.status, 'banked-not-pushed');
    assert.notEqual(result.exitCode, EXIT.ROTATED);
    assert.match(result.reason, /remote rejected/);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
});
