// Tests for exact-head QA binding (BUILD-018 T-14, deliverable 3)
//
// The supersession and boundary proofs use a REAL git repository in os.tmpdir() with
// REAL commits. Synthetic strings cannot prove that an abbreviation resolves, that a
// tree object is refused, or that a verdict fails to carry across a genuine head move
// — they would only prove that two strings differ.
//
// Every negative has a positive control beside it. Without one, a function that always
// returned false would pass every "must not approve" test in this file.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  QA_SCHEMA_VERSION,
  VERDICT,
  BINDING,
  qaLedgerPath,
  emptyLedger,
  isCanonicalSha,
  canonicaliseTuple,
  readLedger,
  writeLedger,
  recordVerdict,
  verdictStatus,
  renderVerdictSummary,
} from './qa-binding.mjs';

// ---------------------------------------------------------------------------
// A real git repository with two real commits
// ---------------------------------------------------------------------------

const tempRoots = [];

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'governor-qa-'));
  tempRoots.push(root);
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });

  const git = (args) => execFileSync('git', ['-C', work, ...args], { encoding: 'utf8' }).trim();

  execFileSync('git', ['init', '-q', work], { encoding: 'utf8' });
  git(['config', 'user.email', 'governor-test@example.invalid']);
  git(['config', 'user.name', 'Governor Test']);
  git(['config', 'commit.gpgsign', 'false']);

  writeFileSync(join(work, 'a.txt'), 'first\n');
  git(['add', 'a.txt']);
  git(['commit', '-q', '-m', 'first commit']);
  const shaA = git(['rev-parse', 'HEAD']);

  writeFileSync(join(work, 'a.txt'), 'second\n');
  git(['add', 'a.txt']);
  git(['commit', '-q', '-m', 'second commit']);
  const shaB = git(['rev-parse', 'HEAD']);

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  return { root, work, git, shaA, shaB, branch };
}

let REPO = null;
function repo() {
  if (!REPO) REPO = makeRepo();
  return REPO;
}

after(() => {
  for (const root of tempRoots) {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      /* a locked git object on Windows must not fail the suite */
    }
  }
});

function tempDir(prefix = 'governor-qa-ledger-') {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(d);
  return d;
}

// ---------------------------------------------------------------------------
// THE BOUNDARY — canonicaliseTuple, against real git
// ---------------------------------------------------------------------------

test('POSITIVE CONTROL: a full sha at a real commit canonicalises to itself', () => {
  const r = repo();
  const out = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work });
  assert.equal(out.ok, true, out.error || '');
  assert.equal(out.tuple.sha, r.shaA);
  assert.ok(isCanonicalSha(out.tuple.sha));
  assert.equal(out.tuple.branch, r.branch);
});

test('BOUNDARY: an ABBREVIATED sha is resolved to the full 40-hex here, once', () => {
  // This is what makes every downstream comparison safe: nothing below the boundary
  // ever sees an abbreviation, so nothing below the boundary can prefix-match.
  const r = repo();
  const abbrev = r.shaA.slice(0, 7);
  assert.notEqual(abbrev, r.shaA);
  const out = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: abbrev, repoPath: r.work });
  assert.equal(out.ok, true, out.error || '');
  assert.equal(out.tuple.sha, r.shaA);
  assert.equal(out.tuple.sha.length, 40);
});

test('MUTATION: an unresolvable sha is REFUSED, and yields no tuple', () => {
  const r = repo();
  const out = canonicaliseTuple({
    repo: r.work,
    branch: r.branch,
    sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    repoPath: r.work,
  });
  assert.equal(out.ok, false);
  assert.equal(out.tuple, null);
  assert.match(out.error, /could not resolve/i);
});

test('MUTATION: a TREE sha is refused — ^{commit} must reject a non-commit object', () => {
  const r = repo();
  const treeSha = r.git(['rev-parse', 'HEAD^{tree}']);
  assert.ok(isCanonicalSha(treeSha), 'sanity: git gave us a full-length tree sha');
  assert.notEqual(treeSha, r.shaA);
  const out = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: treeSha, repoPath: r.work });
  assert.equal(out.ok, false, 'a tree object must never be bindable as a reviewed commit');
  assert.equal(out.tuple, null);
});

test('MUTATION: missing repoPath refuses WITHOUT shelling out', () => {
  let called = 0;
  const out = canonicaliseTuple({
    repo: 'C:/repo',
    branch: 'main',
    sha: 'abc1234',
    repoPath: null,
    execFile: () => {
      called += 1;
      return 'never';
    },
  });
  assert.equal(out.ok, false);
  assert.equal(out.tuple, null);
  assert.equal(called, 0, 'must not attempt to resolve a sha with no repository');
});

test('MUTATION: missing repo / branch / sha each refuse', () => {
  const r = repo();
  for (const bad of [
    { repo: '', branch: r.branch, sha: r.shaA },
    { repo: r.work, branch: '   ', sha: r.shaA },
    { repo: r.work, branch: r.branch, sha: '' },
  ]) {
    const out = canonicaliseTuple({ ...bad, repoPath: r.work });
    assert.equal(out.ok, false, `expected refusal for ${JSON.stringify(bad)}`);
    assert.equal(out.tuple, null);
  }
});

test('BOUNDARY: repo separators normalised; a refs/heads/ branch prefix stripped', () => {
  const r = repo();
  const out = canonicaliseTuple({
    repo: `${r.work.replace(/\//g, '\\')}\\`,
    branch: `refs/heads/${r.branch}`,
    sha: r.shaA,
    repoPath: r.work,
  });
  assert.equal(out.ok, true, out.error || '');
  assert.ok(!out.tuple.repo.includes('\\'), 'separators are normalised at the boundary');
  assert.ok(!out.tuple.repo.endsWith('/'));
  assert.equal(out.tuple.branch, r.branch);
});

// ---------------------------------------------------------------------------
// CONTRACT MUTATION TEST 1 + POSITIVE CONTROL (contract §Module 2, tests 1 and 3)
// Real git, two real commits, a real head move.
// ---------------------------------------------------------------------------

function ledgerWithApproveAt(r, sha, reviewer = 'codex', at = '2026-07-31T10:00:00Z') {
  const t = canonicaliseTuple({ repo: r.work, branch: r.branch, sha, repoPath: r.work });
  assert.equal(t.ok, true, t.error || '');
  const rec = recordVerdict(emptyLedger(), {
    tuple: t.tuple,
    reviewer,
    verdict: VERDICT.APPROVE,
    summary: 'reviewed',
    evidence: ['node --test'],
    at,
  });
  assert.equal(rec.ok, true, rec.error || '');
  return { ledger: rec.ledger, tuple: t.tuple };
}

test('POSITIVE CONTROL: an approve recorded at A, queried at A, is CURRENT and approved', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.headKnown, true);
  assert.equal(status.head, r.shaA);
  assert.equal(status.reviewers[0].binding, BINDING.CURRENT);
  assert.equal(status.reviewers[0].verdict, VERDICT.APPROVE);
  assert.equal(status.allCurrentApproved, true);
  assert.deepEqual(status.superseded, []);
  assert.ok(status.checked > 0, 'INV-5: a non-zero count of verdicts must actually have been examined');
});

test('CONTRACT MUTATION 1 (real git): move the head A→B and the approve does NOT carry forward', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);

  // The head really moved: two distinct real commits, B's parent is A.
  assert.notEqual(r.shaA, r.shaB);
  assert.equal(r.git(['rev-parse', `${r.shaB}^`]), r.shaA);

  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaB,
    requiredReviewers: ['codex'],
  });

  assert.equal(status.headKnown, true);
  assert.equal(status.head, r.shaB);
  assert.equal(status.reviewers[0].binding, BINDING.SUPERSEDED);
  assert.equal(status.reviewers[0].sha, r.shaA, 'the reported sha is the one REVIEWED, not the current head');
  assert.equal(status.allCurrentApproved, false);
  assert.equal(status.superseded.length, 1);
  assert.equal(status.superseded[0].reviewer, 'codex');
  assert.ok(status.checked > 0);
  assert.match(status.reason, /not currently approving/i);
});

test('CONTRACT MUTATION 1b (real git): a third commit still supersedes — any movement, not just the next commit', () => {
  const r = repo();
  writeFileSync(join(r.work, 'a.txt'), 'third\n');
  r.git(['add', 'a.txt']);
  r.git(['commit', '-q', '-m', 'third commit']);
  const shaC = r.git(['rev-parse', 'HEAD']);
  assert.notEqual(shaC, r.shaB);

  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: shaC,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].binding, BINDING.SUPERSEDED);
  assert.equal(status.allCurrentApproved, false);

  // Restore the repository head so later tests see the two-commit world they expect.
  r.git(['reset', '-q', '--hard', r.shaB]);
});

// ---------------------------------------------------------------------------
// CONTRACT MUTATION TEST 2 — fails closed on an unestablished head
//
// NOTE ON A CORRECTED CONTRACT: the frozen contract asked for "headSha: null (or an
// unresolvable sha)" to be proven at verdictStatus. verdictStatus is PURE — it has no
// repo and no execFile, so it cannot know that a well-formed sha is unresolvable. The
// split, agreed at read-back: UNRESOLVABLE is proven at canonicaliseTuple (above);
// NULL / MALFORMED / ABBREVIATED is proven here. Both halves are proven.
// ---------------------------------------------------------------------------

test('CONTRACT MUTATION 2: headSha null → every reviewer UNKNOWN_HEAD, nothing approved', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: null,
    requiredReviewers: ['codex', 'fable'],
  });
  assert.equal(status.headKnown, false);
  assert.equal(status.head, null);
  assert.equal(status.reviewers.length, 2);
  for (const row of status.reviewers) {
    assert.equal(row.binding, BINDING.UNKNOWN_HEAD);
    assert.equal(row.verdict, null, 'must not display a verdict value beside an unestablished head');
  }
  assert.equal(status.allCurrentApproved, false);
  assert.ok(status.checked > 0, 'the ledger was still examined');
});

test('CONTRACT MUTATION 2b: an ABBREVIATED head is UNKNOWN_HEAD — never prefix-matched', () => {
  // Prefix matching is the Tower head-binding defect wearing a different hat. An
  // abbreviation reaching verdictStatus means the boundary was bypassed; the backstop
  // must fail closed rather than helpfully "recognise" it.
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA.slice(0, 7),
    requiredReviewers: ['codex'],
  });
  assert.equal(status.headKnown, false);
  assert.equal(status.reviewers[0].binding, BINDING.UNKNOWN_HEAD);
  assert.equal(status.allCurrentApproved, false);
});

test('CONTRACT MUTATION 2c: malformed and uppercase heads are UNKNOWN_HEAD', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  for (const bad of ['not-a-sha', '', 'zzzz'.repeat(10), r.shaA.toUpperCase(), 12345, undefined]) {
    const status = verdictStatus(ledger, {
      repo: r.work,
      branch: r.branch,
      headSha: bad,
      requiredReviewers: ['codex'],
    });
    assert.equal(status.headKnown, false, `expected UNKNOWN_HEAD for ${JSON.stringify(bad)}`);
    assert.equal(status.allCurrentApproved, false);
  }
});

test('INV-5: checked equals the number of verdict rows actually examined', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const second = recordVerdict(ledger, {
    tuple: { repo: 'C:/other-repo', branch: 'other', sha: r.shaB },
    reviewer: 'fable',
    verdict: VERDICT.APPROVE,
    at: '2026-07-30T09:00:00Z',
  });
  assert.equal(second.ok, true, second.error || '');
  const status = verdictStatus(second.ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.checked, second.ledger.verdicts.length);
  assert.equal(status.checked, 2);

  // And an empty ledger reports zero — "no failures found" over nothing examined must
  // be visibly zero, not an implied clean bill.
  const none = verdictStatus(emptyLedger(), {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(none.checked, 0);
  assert.equal(none.allCurrentApproved, false);
});

// ---------------------------------------------------------------------------
// Binding semantics
// ---------------------------------------------------------------------------

test('a required reviewer with no verdict at all is ABSENT and blocks — never waived', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA, 'codex');
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex', 'fable'],
  });
  const fable = status.reviewers.find((x) => x.reviewer === 'fable');
  assert.equal(fable.binding, BINDING.ABSENT);
  assert.equal(status.allCurrentApproved, false, 'required-but-unavailable is BLOCKED, not waived');
  assert.match(status.reason, /fable/i);
});

test('a REJECT at the exact head is CURRENT but not approved (positive control beside it)', () => {
  const r = repo();
  const t = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work });
  const rec = recordVerdict(emptyLedger(), {
    tuple: t.tuple,
    reviewer: 'codex',
    verdict: VERDICT.REJECT,
    at: '2026-07-31T10:00:00Z',
  });
  const status = verdictStatus(rec.ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].binding, BINDING.CURRENT);
  assert.equal(status.allCurrentApproved, false);

  // Positive control: the same shape with an approve DOES pass, so the false above is
  // caused by the verdict value and not by the function simply never approving.
  const ok = ledgerWithApproveAt(r, r.shaA);
  const good = verdictStatus(ok.ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(good.allCurrentApproved, true);
});

test('a verdict on a DIFFERENT branch at the same sha does not satisfy the requirement', () => {
  const r = repo();
  const rec = recordVerdict(emptyLedger(), {
    tuple: { repo: r.work.replace(/\\/g, '/'), branch: 'some-other-branch', sha: r.shaA },
    reviewer: 'codex',
    verdict: VERDICT.APPROVE,
    at: '2026-07-31T10:00:00Z',
  });
  assert.equal(rec.ok, true, rec.error || '');
  const status = verdictStatus(rec.ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].binding, BINDING.ABSENT, 'branch is part of the identity, not decoration');
  assert.equal(status.allCurrentApproved, false);
  assert.equal(status.checked, 1, 'the row was examined even though it did not apply');
});

test('a verdict in a DIFFERENT repository does not satisfy the requirement', () => {
  const r = repo();
  const rec = recordVerdict(emptyLedger(), {
    tuple: { repo: 'C:/some-other-repo', branch: r.branch, sha: r.shaA },
    reviewer: 'codex',
    verdict: VERDICT.APPROVE,
    at: '2026-07-31T10:00:00Z',
  });
  const status = verdictStatus(rec.ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].binding, BINDING.ABSENT);
  assert.equal(status.allCurrentApproved, false);
});

test('REGRESSION: a backslash-spelled repo path still matches the boundary-normalised one', () => {
  // Comparing raw strings made every positive control in this file fail while every
  // negative passed: the module could never approve anything, and only the positive
  // controls revealed it. A caller naturally holds a Windows path from git or
  // process.cwd(); a permanent false ABSENT is a control that never runs.
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  assert.ok(!ledger.verdicts[0].tuple.repo.includes('\\'), 'the stored form is boundary-normalised');

  const status = verdictStatus(ledger, {
    repo: r.work.replace(/\//g, '\\'),
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].binding, BINDING.CURRENT);
  assert.equal(status.allCurrentApproved, true);
});

test('repo matching is case-insensitive; branch matching is case-SENSITIVE (git refs are)', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);

  const upperRepo = verdictStatus(ledger, {
    repo: r.work.toUpperCase(),
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(upperRepo.allCurrentApproved, true, 'Windows paths and GitHub slugs are case-insensitive');

  const upperBranch = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch.toUpperCase(),
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(upperBranch.allCurrentApproved, false, 'Main and main are two different branches');
});

test('reviewer names match case-insensitively but are reported as configured', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA, 'Codex');
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(status.reviewers[0].reviewer, 'codex');
  assert.equal(status.allCurrentApproved, true);
});

test('two verdicts by ONE reviewer: each head selects its own row, not "the latest"', () => {
  // The sharpest case. A reviewer who approved at A and then at B must read CURRENT at
  // BOTH heads — and a "latest wins" implementation would wrongly report the B verdict
  // as current when queried at A.
  const r = repo();
  const tA = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work });
  const tB = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaB, repoPath: r.work });

  let ledger = emptyLedger();
  ledger = recordVerdict(ledger, {
    tuple: tA.tuple,
    reviewer: 'codex',
    verdict: VERDICT.APPROVE,
    at: '2026-07-30T09:00:00Z',
  }).ledger;
  ledger = recordVerdict(ledger, {
    tuple: tB.tuple,
    reviewer: 'codex',
    verdict: VERDICT.CHANGES,
    at: '2026-07-31T09:00:00Z',
  }).ledger;
  assert.equal(ledger.verdicts.length, 2, 'a verdict at a different sha is a different record, kept');

  const atA = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaA, requiredReviewers: ['codex'] });
  assert.equal(atA.reviewers[0].binding, BINDING.CURRENT);
  assert.equal(atA.reviewers[0].verdict, VERDICT.APPROVE);
  assert.equal(atA.reviewers[0].sha, r.shaA);
  assert.equal(atA.allCurrentApproved, true);

  const atB = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaB, requiredReviewers: ['codex'] });
  assert.equal(atB.reviewers[0].binding, BINDING.CURRENT);
  assert.equal(atB.reviewers[0].verdict, VERDICT.CHANGES);
  assert.equal(atB.reviewers[0].sha, r.shaB);
  assert.equal(atB.allCurrentApproved, false);
});

test('with no verdict at the head, the most recent superseded row is shown deterministically', () => {
  const r = repo();
  const tA = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work });
  let ledger = recordVerdict(emptyLedger(), {
    tuple: tA.tuple,
    reviewer: 'codex',
    verdict: VERDICT.APPROVE,
    at: '2026-07-29T09:00:00Z',
  }).ledger;
  // Re-recording the SAME (reviewer, tuple) replaces rather than duplicates.
  ledger = recordVerdict(ledger, {
    tuple: tA.tuple,
    reviewer: 'codex',
    verdict: VERDICT.CHANGES,
    at: '2026-07-30T09:00:00Z',
  }).ledger;
  assert.equal(ledger.verdicts.length, 1);

  const status = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaB, requiredReviewers: ['codex'] });
  assert.equal(status.reviewers[0].binding, BINDING.SUPERSEDED);
  assert.equal(status.reviewers[0].at, '2026-07-30T09:00:00Z');
  assert.equal(status.reviewers[0].verdict, VERDICT.CHANGES);
});

test('a non-required reviewer with a verdict is still reported, but does not gate', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA, 'fable');
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: [],
  });
  assert.ok(status.reviewers.some((x) => x.reviewer === 'fable' && x.binding === BINDING.CURRENT));
  assert.equal(status.allCurrentApproved, false);
});

// ---------------------------------------------------------------------------
// requiredReviewers: [] — the deliberate, documented decision
// ---------------------------------------------------------------------------

test('DECISION: an EMPTY requiredReviewers list is NOT a silent path to approval', () => {
  // Vacuous truth ("every member of the empty set approved") would let a programme with
  // no reviewers configured pass Module 3's independent-review gate — a control
  // reporting success over ground it never examined. Required-but-unconfigured is
  // BLOCKED, exactly as required-but-unavailable is.
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: [],
  });
  assert.equal(status.headKnown, true);
  assert.equal(status.allCurrentApproved, false);
  assert.match(status.reason, /no required reviewers/i);

  // Positive control: naming the reviewer flips it. So the false above is caused by the
  // empty list specifically, not by an implementation that can never approve.
  const named = verdictStatus(ledger, {
    repo: r.work,
    branch: r.branch,
    headSha: r.shaA,
    requiredReviewers: ['codex'],
  });
  assert.equal(named.allCurrentApproved, true);
});

test('a non-array / junk requiredReviewers is treated as unconfigured, not as approved', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  for (const junk of [null, undefined, 'codex', [''], ['  ']]) {
    const status = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaA, requiredReviewers: junk });
    assert.equal(status.allCurrentApproved, false, `expected blocked for ${JSON.stringify(junk)}`);
  }
});

// ---------------------------------------------------------------------------
// recordVerdict — fails closed on anything that did not come through the boundary
// ---------------------------------------------------------------------------

test('MUTATION: recordVerdict REFUSES an entry whose tuple did not canonicalise', () => {
  const r = repo();
  const good = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work }).tuple;

  const bad = [
    { name: 'null tuple', tuple: null },
    { name: 'abbreviated sha', tuple: { ...good, sha: r.shaA.slice(0, 7) } },
    { name: 'uppercase sha', tuple: { ...good, sha: r.shaA.toUpperCase() } },
    { name: 'empty sha', tuple: { ...good, sha: '' } },
    { name: 'missing branch', tuple: { repo: good.repo, sha: good.sha } },
    { name: 'missing repo', tuple: { branch: good.branch, sha: good.sha } },
  ];

  for (const c of bad) {
    const out = recordVerdict(emptyLedger(), {
      tuple: c.tuple,
      reviewer: 'codex',
      verdict: VERDICT.APPROVE,
      at: '2026-07-31T10:00:00Z',
    });
    assert.equal(out.ok, false, `expected refusal for ${c.name}`);
    assert.equal(out.ledger.verdicts.length, 0, `${c.name} must not enter the ledger`);
  }

  // Positive control: the canonical tuple IS accepted.
  const ok = recordVerdict(emptyLedger(), {
    tuple: good,
    reviewer: 'codex',
    verdict: VERDICT.APPROVE,
    at: '2026-07-31T10:00:00Z',
  });
  assert.equal(ok.ok, true, ok.error || '');
  assert.equal(ok.ledger.verdicts.length, 1);
});

test('MUTATION: recordVerdict refuses a bad reviewer, verdict value, timestamp or evidence shape', () => {
  const r = repo();
  const tuple = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work }).tuple;
  const base = { tuple, reviewer: 'codex', verdict: VERDICT.APPROVE, at: '2026-07-31T10:00:00Z' };

  for (const patch of [
    { reviewer: '' },
    { reviewer: 42 },
    { verdict: 'lgtm' },
    { verdict: undefined },
    { at: '' },
    { at: null },
    { evidence: 'node --test' },
    { summary: 7 },
  ]) {
    const out = recordVerdict(emptyLedger(), { ...base, ...patch });
    assert.equal(out.ok, false, `expected refusal for ${JSON.stringify(patch)}`);
  }

  const ok = recordVerdict(emptyLedger(), base);
  assert.equal(ok.ok, true, ok.error || '');
});

test('recordVerdict does not mutate the ledger it was given', () => {
  const r = repo();
  const tuple = canonicaliseTuple({ repo: r.work, branch: r.branch, sha: r.shaA, repoPath: r.work }).tuple;
  const before = emptyLedger();
  const out = recordVerdict(before, { tuple, reviewer: 'codex', verdict: VERDICT.APPROVE, at: '2026-07-31T10:00:00Z' });
  assert.equal(out.ok, true);
  assert.equal(before.verdicts.length, 0);
  assert.equal(out.ledger.verdicts.length, 1);
});

// ---------------------------------------------------------------------------
// Ledger path, read and write
// ---------------------------------------------------------------------------

test('qaLedgerPath is <home>/qa-verdicts.json with normalised separators', () => {
  const p = qaLedgerPath('C:\\Fusion247PKA-governor\\Deliverables\\BUILD-018-session-governor\\');
  assert.equal(p, 'C:/Fusion247PKA-governor/Deliverables/BUILD-018-session-governor/qa-verdicts.json');
  assert.throws(() => qaLedgerPath(''), TypeError);
  assert.throws(() => qaLedgerPath(null), TypeError);
});

test('readLedger on a MISSING file is an empty ledger; on a CORRUPT file it fails', () => {
  const dir = tempDir();
  const missing = join(dir, 'qa-verdicts.json');
  const first = readLedger(missing);
  assert.equal(first.ok, true);
  assert.deepEqual(first.ledger.verdicts, []);

  // Corrupt is NOT the same as empty. Returning an empty ledger here would report "no
  // verdicts" over ground that was never examined.
  const corrupt = join(dir, 'corrupt.json');
  writeFileSync(corrupt, '{ this is not json');
  const second = readLedger(corrupt);
  assert.equal(second.ok, false);
  assert.equal(second.ledger, null);
  assert.match(second.error, /unreadable/i);
});

test('readLedger refuses a schema-version mismatch rather than guessing', () => {
  const dir = tempDir();
  const p = join(dir, 'qa-verdicts.json');
  writeFileSync(p, JSON.stringify({ schema_version: 99, verdicts: [] }));
  const out = readLedger(p);
  assert.equal(out.ok, false);
  assert.match(out.error, /schema_version/);
});

test('writeLedger → readLedger round trip is atomic and leaves no temp residue', () => {
  const r = repo();
  const dir = tempDir();
  const p = join(dir, 'nested', 'qa-verdicts.json');
  const { ledger } = ledgerWithApproveAt(r, r.shaA);

  const w = writeLedger(ledger, p);
  assert.equal(w.ok, true, w.error || '');
  assert.ok(existsSync(p));

  const back = readLedger(p);
  assert.equal(back.ok, true, back.error || '');
  assert.deepEqual(back.ledger.verdicts, ledger.verdicts);
  assert.equal(back.ledger.schema_version, QA_SCHEMA_VERSION);

  const residue = readdirSync(join(dir, 'nested')).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(residue, [], 'the temp file must have been renamed away, not left behind');
});

test('MUTATION: writeLedger REFUSES an invalid ledger and writes nothing', () => {
  const r = repo();
  const dir = tempDir();
  const p = join(dir, 'qa-verdicts.json');

  for (const bad of [
    null,
    { schema_version: 99, verdicts: [] },
    { schema_version: QA_SCHEMA_VERSION, verdicts: 'nope' },
    { schema_version: QA_SCHEMA_VERSION, verdicts: [{ tuple: { repo: 'r', branch: 'b', sha: 'abc' }, reviewer: 'x', verdict: 'approve', at: 'now' }] },
  ]) {
    const out = writeLedger(bad, p);
    assert.equal(out.ok, false, `expected refusal for ${JSON.stringify(bad)}`);
    assert.equal(existsSync(p), false, 'nothing must have been written');
  }

  // Positive control: a valid ledger IS written to the same path.
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const ok = writeLedger(ledger, p);
  assert.equal(ok.ok, true, ok.error || '');
  assert.equal(existsSync(p), true);
});

test('a ledger that survives write→read still supersedes correctly (durability, end to end)', () => {
  const r = repo();
  const dir = tempDir();
  const p = join(dir, 'qa-verdicts.json');
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  assert.equal(writeLedger(ledger, p).ok, true);

  const reloaded = readLedger(p).ledger;
  const atA = verdictStatus(reloaded, { repo: r.work, branch: r.branch, headSha: r.shaA, requiredReviewers: ['codex'] });
  const atB = verdictStatus(reloaded, { repo: r.work, branch: r.branch, headSha: r.shaB, requiredReviewers: ['codex'] });
  assert.equal(atA.allCurrentApproved, true);
  assert.equal(atB.allCurrentApproved, false);
  assert.equal(atB.reviewers[0].binding, BINDING.SUPERSEDED);
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

test('renderVerdictSummary names the superseded reviewer, both shas, and does not say APPROVED', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaB, requiredReviewers: ['codex'] });
  const text = renderVerdictSummary(status);

  assert.match(text, /codex/);
  assert.match(text, /SUPERSEDED/);
  assert.ok(text.includes(r.shaA.slice(0, 7)), 'the reviewed sha is named');
  assert.ok(text.includes(r.shaB.slice(0, 7)), 'the current head is named');
  assert.match(text, /NOT APPROVED/);
  assert.ok(!/VERDICT: APPROVED/.test(text));
  assert.match(text, /1 verdict\(s\) examined/);
});

test('renderVerdictSummary says UNKNOWN when the head could not be established', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: null, requiredReviewers: ['codex'] });
  const text = renderVerdictSummary(status);
  assert.match(text, /UNKNOWN/);
  assert.match(text, /NOT APPROVED/);
});

test('POSITIVE CONTROL: renderVerdictSummary does say APPROVED when it genuinely is', () => {
  const r = repo();
  const { ledger } = ledgerWithApproveAt(r, r.shaA);
  const status = verdictStatus(ledger, { repo: r.work, branch: r.branch, headSha: r.shaA, requiredReviewers: ['codex'] });
  const text = renderVerdictSummary(status);
  assert.match(text, /VERDICT: APPROVED AT THIS HEAD/);
  assert.match(text, /CURRENT/);
});
