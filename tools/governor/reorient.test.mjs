// SESSION-START REORIENTATION — the three behaviours that survived WO-OR-05.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS MUCH SMALLER THAN IT WAS, AND WHY THAT IS NOT A WEAKENING
// ---------------------------------------------------------------------------
// The previous version carried 53 tests, and the large majority of them exercised BUILD-*
// programme recovery: discovering `programme-state.json` across every worktree, collapsing
// several checkouts of one programme, refusing copies that genuinely disagreed, assessing
// banked-head freshness against the banking commit, and rendering a resumption ticket.
// WO-OR-05 deleted all of that, so those tests have no subject left. They are removed
// rather than adapted — there is no weaker version of "four checkouts collapse to one"
// that means anything once nothing writes a programme file.
//
// THE DROP IS REPORTED AS MEASURED, not buried: 53 -> the count this file now runs.
// Deleting tests for deleted behaviour is legitimate; hiding the fall is not.
//
// ---------------------------------------------------------------------------
// WHAT IS TESTED HERE, AND WHY EACH ONE EARNS ITS PLACE
// ---------------------------------------------------------------------------
// Three behaviours survived, and before this file existed exactly ZERO of them had any
// coverage at all — `sweepOpenDeliverables` and the continuity passthrough were added to
// the live hook path on 2026-08-01 and never got tests. The Work Order calls losing the
// sweep a Phase-5 failure, and until now nothing in the estate could have noticed if it
// had been lost. An acceptance criterion nothing can fail is not a criterion.
//
//   1. the loose-`Deliverables/` sweep
//   2. the Honcho continuity brief passthrough
//   3. repository / worktree / branch verification
//
// NO NETWORK. This suite never calls the real `readContinuityBrief`, so it never reaches
// Honcho and never touches the credential file that read depends on. The passthrough is
// proven by INJECTION, which is also the only way to assert what happens when it fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, realpathSync,
  readdirSync, statSync, readFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  sweepOpenDeliverables,
  gitFacts,
  renderLocationSection,
  buildBrief,
  parseHookInput,
  briefModeFor,
  toHookOutput,
  normaliseSeparators,
  BRIEF_MODE,
} from './reorient.mjs';

function tmp(prefix = 'governor-reorient-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// The real filesystem, used to build PARTIAL injections for the sweep: a fake that failed
// on everything would prove only that a total failure is handled. The interesting case —
// and the one that was silently dropping files — is ONE unreadable file among readable ones.
const realIo = { readdirSync, statSync, readFileSync };

/** A scratch estate root carrying `Deliverables/<name>` files with controlled mtimes. */
function makeEstate(files) {
  const root = tmp();
  mkdirSync(join(root, 'Deliverables'), { recursive: true });
  for (const f of files) {
    const full = join(root, 'Deliverables', f.name);
    if (f.dir) {
      mkdirSync(full, { recursive: true });
      continue;
    }
    writeFileSync(full, f.body ?? '# untitled\n');
    if (f.ageDays !== undefined) {
      const when = new Date(Date.now() - f.ageDays * 86_400_000);
      utimesSync(full, when, when);
    }
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ===========================================================================
// PRESERVED BEHAVIOUR 1 — the loose-Deliverables sweep
// ===========================================================================

test('SWEEP: recent top-level Deliverables/*.md are surfaced, newest first, with a title', () => {
  const e = makeEstate([
    { name: 'a-old-but-inside-window.md', body: '# The older one\n', ageDays: 5 },
    { name: 'b-newest.md', body: '# The newest one\n', ageDays: 0 },
  ]);
  try {
    const out = sweepOpenDeliverables(e.root, Date.now());
    assert.notEqual(out, null, 'a populated estate must produce a sweep');
    assert.match(out, /The newest one/);
    assert.match(out, /The older one/);
    assert.ok(
      out.indexOf('The newest one') < out.indexOf('The older one'),
      'newest first — a resuming session reads the top of the list'
    );
    // The H1 is used as the title, not the filename, when one is present.
    assert.match(out, /• The newest one — Deliverables\/b-newest\.md/);
  } finally {
    e.cleanup();
  }
});

test('SWEEP: a deliverable whose text reads as WAITING ON WARWICK is flagged as a pending decision', () => {
  // This is the behaviour that fired on the live estate and surfaced a product-decision
  // nobody was tracking. Without the flag the sweep is just a file listing.
  const e = makeEstate([
    { name: 'needs-him.md', body: '# Needs a call\n\nNothing will be built until you accept this plan.\n', ageDays: 0 },
    { name: 'informational.md', body: '# Just a record\n\nHere is what happened.\n', ageDays: 1 },
  ]);
  try {
    const out = sweepOpenDeliverables(e.root, Date.now());
    assert.match(out, /Needs a call.*⟵ AWAITS YOUR DECISION/);
    assert.doesNotMatch(out, /Just a record.*⟵ AWAITS YOUR DECISION/);
    assert.match(out, /1 deliverable\(s\) appear to be waiting on Warwick/);
    assert.match(out, /pending product-decision handback/);
  } finally {
    e.cleanup();
  }
});

test('SWEEP MUTATION: break the sweep and this suite goes RED — the criterion has teeth', () => {
  // E2. Each mutation below is a way the sweep could plausibly be lost or quietly
  // narrowed, and each is asserted to change the OUTPUT — not merely to avoid throwing.
  // A test that only checked "it did not crash" would pass over a sweep that returned
  // nothing, which is exactly the failure the Work Order calls a Phase-5 failure.
  const e = makeEstate([
    { name: 'live.md', body: '# A live deliverable\n', ageDays: 0 },
    { name: 'stale.md', body: '# Long past the window\n', ageDays: 400 },
    { name: 'not-markdown.txt', body: 'ignored', ageDays: 0 },
    { name: 'BUILD-018-session-governor', dir: true },
  ]);
  try {
    const healthy = sweepOpenDeliverables(e.root, Date.now());
    // CONTROL: the unmutated sweep genuinely finds something. Without this the
    // assertions below would be satisfied by a sweep that can only ever return null.
    assert.match(healthy, /A live deliverable/, 'CONTROL — the healthy sweep must find the live file');

    // MUTATION 1 — the window. Slide `now` a year forward and everything falls outside.
    assert.equal(
      sweepOpenDeliverables(e.root, Date.now() + 365 * 86_400_000),
      null,
      'nothing inside the window must yield null, not an empty-looking success'
    );

    // MUTATION 2 — the root. Point it somewhere with no Deliverables/ at all.
    assert.equal(sweepOpenDeliverables(join(e.root, 'nope'), Date.now()), null);

    // The two exclusions that must hold in the healthy case, or the sweep is reporting
    // things it was never meant to: a file past the window, and a non-markdown file.
    assert.doesNotMatch(healthy, /Long past the window/, 'the 21-day window is real');
    assert.doesNotMatch(healthy, /not-markdown/, 'top-level *.md only');
    // And BUILD-* DIRECTORIES are not swept — they were the deleted machinery's job and
    // are nobody's now, which is a known gap rather than a silent inclusion.
    assert.doesNotMatch(healthy, /BUILD-018/);
  } finally {
    e.cleanup();
  }
});

test('SWEEP: an unreadable or absent Deliverables directory is null, never a throw', () => {
  // INV-2 — a SessionStart hook must not be able to break a session.
  assert.equal(sweepOpenDeliverables(join(tmpdir(), 'definitely-not-here-9f3a'), Date.now()), null);
  const empty = makeEstate([]);
  try {
    assert.equal(sweepOpenDeliverables(empty.root, Date.now()), null, 'an EMPTY Deliverables/ is null');
  } finally {
    empty.cleanup();
  }
});

test('SWEEP: the list is capped at 8 so a large estate cannot flood the session start', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    name: `d-${String(i).padStart(2, '0')}.md`,
    body: `# Deliverable ${i}\n`,
    ageDays: i * 0.01,
  }));
  const e = makeEstate(many);
  try {
    const rows = sweepOpenDeliverables(e.root, Date.now()).split('\n').filter((l) => l.startsWith('  • '));
    assert.equal(rows.length, 8);
  } finally {
    e.cleanup();
  }
});

// ===========================================================================
// PRESERVED BEHAVIOUR 3 — repository / worktree / branch verification
// ===========================================================================

test('LOCATION: every fact is INDEPENDENTLY nullable — a partial answer never reads as a whole one', () => {
  // `unpushed: null` means "no upstream, or git would not say". It is a different claim
  // from `unpushed: 0`, and collapsing the two is how a governor reports a fact it does
  // not have.
  const failing = () => { throw new Error('git is not available'); };
  const facts = gitFacts('C:/anywhere', failing);
  for (const k of ['repoRoot', 'headSha', 'branch', 'dirty', 'unpushed', 'upstreamRef', 'upstreamSha']) {
    assert.equal(facts[k], null, `${k} must be null, never a fallback value`);
  }
  assert.equal(facts.worktreePath, 'C:/anywhere', 'the path asked about is still reported');

  const rendered = renderLocationSection(facts);
  assert.match(rendered, /\(unknown\)/);
  assert.doesNotMatch(rendered, /working tree : clean/, 'unknown cleanliness must not render as clean');
});

test('LOCATION: real git facts are EXECUTED, not assumed', () => {
  // Against this very repository. The point is that the values come out of git rather
  // than out of a recorded file — the failure mode the whole governor exists to avoid.
  const facts = gitFacts(process.cwd());
  assert.match(facts.headSha ?? '', /^[0-9a-f]{40}$/, 'a real 40-char SHA');
  assert.equal(typeof facts.branch, 'string');
  assert.equal(typeof facts.dirty, 'boolean');
  assert.equal(normaliseSeparators(facts.repoRoot), facts.repoRoot, 'paths are normalised');
});

test('LOCATION: no ALIGNED verdict is offered, and the brief SAYS SO', () => {
  // The honest change in kind. Verification used to compare the live location against a
  // canonical one recorded in banked programme state; with no banked state there is
  // nothing to be aligned WITH. A reader must not be able to mistake the missing verdict
  // for a silent pass, so the absence is stated in the output itself.
  const rendered = renderLocationSection(gitFacts(process.cwd()));
  assert.match(rendered, /No alignment verdict is offered/);
  assert.match(rendered, /not an approval to implement/);
  assert.doesNotMatch(rendered, /ALIGNED/);
  assert.doesNotMatch(rendered, /Implementation is permitted/);
});

test('LOCATION: a dirty tree and an untracked upstream are both reported, not silently omitted', () => {
  // FIXTURE AMENDED BY WO-OR-11, and the reason is worth stating: this fixture used to
  // omit `gitReadable` and still assert the confident "nothing here is pushed" sentence.
  // That is no longer enough to justify the sentence, because the sentence is now only
  // earned when git actually ANSWERED. The requirement changed, so the fixture changed —
  // the assertion below is untouched and still has to hold.
  //
  // This test is HALF of a pair and must never be allowed to absorb the other half: it
  // proves the GENUINE no-upstream case still says so. Its sibling
  // ("UPSTREAM: git-unreadable ...") proves the unreadable case does NOT. Collapsing the
  // two would re-open exactly the defect WO-OR-11 closed.
  //
  // FIXTURE AMENDED AGAIN BY WO-OR-14, for the same reason and in the same direction. The
  // confident sentence is no longer earned by `gitReadable` — `gitReadable` was the wrong
  // probe, and a DETACHED HEAD satisfies it while `@{u}` fails. It is now earned only by a
  // MEASURED `upstreamState: 'none-configured'`. The renderer FAILS CLOSED, so a fixture
  // omitting the field gets "(unknown — the upstream probe did not answer)" rather than
  // inheriting the claim. The assertion below is untouched and still has to hold; what
  // changed is the precondition it has to hold under, which is a tightening.
  const dirty = renderLocationSection({
    worktreePath: 'C:/x', resolvedPath: 'C:/x', gitReadable: true,
    repoRoot: 'C:/x', branch: 'b', headSha: 'abc',
    dirty: true, unpushed: null, upstreamRef: null, upstreamSha: null,
    upstreamState: 'none-configured',
  });
  assert.match(dirty, /DIRTY — uncommitted changes present/);
  assert.match(dirty, /\(none tracked — nothing here is pushed\)/);

  const ahead = renderLocationSection({
    worktreePath: 'C:/x', resolvedPath: 'C:/x', gitReadable: true,
    repoRoot: 'C:/x', branch: 'b', headSha: 'abc',
    dirty: false, unpushed: 3, upstreamRef: 'origin/b', upstreamSha: 'def',
  });
  assert.match(ahead, /working tree : clean/);
  assert.match(ahead, /3 commit\(s\) ahead of upstream/);
});

// ===========================================================================
// WO-OR-11 — THE LOCATION BLOCK MUST NOT ASSERT MORE THAN IT MEASURED
// ===========================================================================
// The block is headed "(executed, not assumed)" and closes with "These are facts". Two
// fields did not earn that, and a third case rendered a non-path as one:
//
//   DEFECT 1  `cwd` was the CALLER'S OWN ARGUMENT handed straight back. Every other field
//             came from a real git call; this one was echoed and then printed under a
//             heading claiming it had been executed. Fingerprint on the live estate: the
//             harness supplies `c:/Fusion247PKA` (lowercase drive) while `git rev-parse`
//             returns `C:/Fusion247PKA` — two lines of the same block disagreeing is what
//             one-supplied-one-measured looks like from the outside.
//   DEFECT 2  `upstream: (none tracked — nothing here is pushed)` was printed whenever
//             `upstreamRef` was falsy. `soft()` returns null when git FAILS, so "git could
//             not run at all" and "this branch genuinely tracks nothing" collapsed into one
//             confident sentence. The module's own comment (see gitFacts) already forbade
//             this: "`unpushed: null` means 'there is no upstream, or git would not say',
//             and it is a different claim from `unpushed: 0`."
//   FINDING A `where` is never type-checked and `normaliseSeparators` passes a non-string
//             through, so `{"cwd":7}` rendered `cwd : 7` beneath the same heading.
//
// EVERY TEST BELOW IS MUTATION-PROVEN: each one was run against the UNFIXED module and
// observed to FAIL before the repair landed. A test that never failed is not evidence.
//
// The trap that shaped them: a POSITIVE-case test ("a real cwd renders") passes against
// the broken code too, because the broken code prints the path it was handed. Such a test
// proves nothing. So these target only the DISCRIMINATING cases — where an echo and a
// measurement produce different output.

test('WO-OR-11 / DEFECT 1: cwd is MEASURED on disk — proven by recovering the TRUE CASING', () => {
  // The discriminator. An echo returns exactly what it was given; a measurement returns
  // what the filesystem says. Feed a deliberately mis-cased path: only a real resolution
  // can produce the true casing back.
  const trueCase = normaliseSeparators(realpathSync.native(process.cwd()));
  const misCased = trueCase.toLowerCase();

  // CONTROL — without this the test could silently become a no-op on a path that is
  // already all-lowercase, or on a case-sensitive filesystem, and would then pass for the
  // wrong reason. If this estate ever stops satisfying the precondition, this FAILS LOUDLY
  // rather than quietly proving nothing.
  assert.notEqual(misCased, trueCase, 'CONTROL: the cwd must be mixed-case or this test proves nothing');
  assert.equal(
    normaliseSeparators(realpathSync.native(misCased)), trueCase,
    'CONTROL: the filesystem must be case-insensitive here or this test proves nothing'
  );

  const facts = gitFacts(misCased);
  assert.equal(facts.resolvedPath, trueCase, 'cwd must be RESOLVED, not echoed');
  assert.notEqual(facts.resolvedPath, misCased, 'an echo would have returned the input unchanged');
  assert.equal(facts.worktreePath, misCased, 'what the host CLAIMED is still preserved, unaltered');

  const rendered = renderLocationSection(facts);
  assert.match(rendered, new RegExp(`cwd\\s+: ${trueCase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    'the block renders the measured value');
});

test('WO-OR-11 / DEFECT 1: an unresolvable cwd renders UNVERIFIED and still shows WHAT WAS CLAIMED', () => {
  // The live reproduction. A bare "(unknown)" would be honest about the failure but would
  // HIDE that the harness asserted a path at all — and the asserted value is the single
  // most useful diagnostic when a session is in the wrong place.
  const failing = () => { throw new Error('git is not available'); };
  const facts = gitFacts('C:/TOTALLY/FICTIONAL/PATH', failing);
  assert.equal(facts.resolvedPath, null, 'a path that does not exist resolves to null');

  const rendered = renderLocationSection(facts);
  assert.match(rendered, /UNVERIFIED/, 'the reader must see that this was not established');
  assert.match(rendered, /C:\/TOTALLY\/FICTIONAL\/PATH/, 'the claim itself is still surfaced');
  assert.doesNotMatch(
    rendered, /^ {2}cwd {10}: C:\/TOTALLY\/FICTIONAL\/PATH$/m,
    'THE DEFECT: an unmeasured path must never render as a plain established value'
  );
});

test('WO-OR-11 / DEFECT 1: "nobody said" is distinguishable from "claimed, and it did not check out"', () => {
  // Two different failures that must not read alike. One is the harness sending nothing;
  // the other is the harness asserting something false. Collapsing them loses the tell.
  const nothingSaid = renderLocationSection({ worktreePath: null, resolvedPath: null, gitReadable: false });
  const claimedBad = renderLocationSection({
    worktreePath: 'C:/TOTALLY/FICTIONAL/PATH', resolvedPath: null, gitReadable: false,
  });

  assert.match(nothingSaid, /no path was supplied/);
  assert.doesNotMatch(nothingSaid, /host reported/, 'nothing was reported, so nothing may be quoted');
  assert.match(claimedBad, /host reported/);
  assert.match(claimedBad, /C:\/TOTALLY\/FICTIONAL\/PATH/);
  assert.notEqual(
    nothingSaid.split('\n')[1], claimedBad.split('\n')[1],
    'the two cases must render differently or the distinction is lost'
  );
});

test('WO-OR-11 / FINDING A: a NON-STRING cwd from the harness never renders as a path', () => {
  // Neither Codex nor Larry named this one. `normaliseSeparators(7)` returns 7 unchanged
  // (pinned by the helper test at the foot of this file), 7 is truthy, so it sailed
  // through as a location and printed as `cwd : 7` under "executed, not assumed".
  for (const hostile of [7, true, { a: 1 }, ['C:/x']]) {
    const body = buildBrief(JSON.stringify({ source: 'startup', cwd: hostile }), { sweepFn: () => null });
    assert.match(body, /UNVERIFIED/, `a ${typeof hostile} cwd must be reported as unverified`);
    assert.doesNotMatch(
      body, /^ {2}cwd {10}: (7|true|\[object Object\]|C:\/x)$/m,
      'THE DEFECT: a non-string must never render as an established path'
    );
  }
});

test('WO-OR-11 / DEFECT 2: git-unreadable must NOT claim that nothing is pushed', () => {
  // The other half of the pair guarded in "a dirty tree and an untracked upstream ...".
  // `soft()` collapses "git threw" and "no upstream configured" into the same null, so the
  // renderer needs an independent signal for whether git ANSWERED at all.
  const unreadable = renderLocationSection({
    worktreePath: 'C:/x', resolvedPath: null, gitReadable: false,
    repoRoot: null, branch: null, headSha: null, dirty: null,
    unpushed: null, upstreamRef: null, upstreamSha: null,
  });
  assert.doesNotMatch(
    unreadable, /nothing here is pushed/,
    'THE DEFECT: git never ran, so this is not a claim the module is entitled to make'
  );
  assert.match(unreadable, /git could not be read/, 'the reason must be stated, not left blank');
});

test('WO-OR-11 / DEFECT 2: gitReadable is MEASURED, and is independent of whether the path exists', () => {
  // Proves the two probes are genuinely separate measurements rather than one flag reused.
  // A real directory that is not a repository is the case that separates them: it EXISTS
  // (so cwd resolves) but git cannot answer (so no upstream claim may be made).
  const real = gitFacts(process.cwd());
  assert.equal(real.gitReadable, true, 'this worktree is a real repository');
  assert.notEqual(real.resolvedPath, null);

  const notARepo = mkdtempSync(join(tmpdir(), 'wo-or-11-notarepo-'));
  try {
    const facts = gitFacts(notARepo);
    assert.notEqual(facts.resolvedPath, null, 'the directory genuinely exists');
    assert.equal(facts.gitReadable, false, 'but git cannot answer here');
    const rendered = renderLocationSection(facts);
    assert.doesNotMatch(rendered, /nothing here is pushed/);
    assert.match(rendered, /git could not be read/);
  } finally {
    rmSync(notARepo, { recursive: true, force: true });
  }
});

test('WO-OR-11 / INTEGRATION: the live fictional-path probe asserts nothing it did not measure', () => {
  // End to end, through the exact shape the harness sends. `parsed.payload.cwd` is a
  // TOP-LEVEL key — a probe that nests it one level deeper exercises the fallback to
  // process.cwd() and silently proves nothing, which is how this defect survived a first
  // look. This asserts against the real shape.
  const body = buildBrief(
    JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: 'C:/TOTALLY/FICTIONAL/PATH' }),
    { sweepFn: () => null }
  );
  // CONTROL: the payload really did reach the location section rather than falling back.
  assert.match(body, /C:\/TOTALLY\/FICTIONAL\/PATH/, 'CONTROL: the top-level cwd key was read');
  assert.match(body, /WHERE THIS SESSION IS \(executed, not assumed\)/, 'the honesty claim is NOT deleted');
  assert.match(body, /UNVERIFIED/);
  assert.doesNotMatch(body, /nothing here is pushed/, 'git never ran on this path');
  assert.match(body, /These are facts/, 'the closing claim survives — it is now earned, not softened');
});

// ===========================================================================
// WO-OR-14 — THE CLASS, ENUMERATED, AND PINNED SO IT CANNOT SILENTLY RE-OPEN
// ===========================================================================
// WHY THIS SECTION EXISTS AND WHY IT IS SHAPED LIKE THIS.
//
// Three rounds each fixed an INSTANCE of one defect and missed the CLASS:
//   round 1  cwd echoed unmeasured                       (found by review)
//   round 2  a non-string cwd rendered as a path         (found by the builder)
//   round 3  a file rendered as a cwd; the upstream gate  (found by review, on round 2's
//            own repair)
// Every round used INSPECTION, and inspection has no completion condition — "I looked and
// found nothing" is indistinguishable from "I did not look hard enough". This section
// replaces inspection with ENUMERATION over a finite domain: every rendered field, the
// measurement behind it, and every way that measurement can fail or be absent.
//
// THE DOMAIN BOUNDARY, STATED SO A LATER FINDING CAN BE CLASSIFIED WITHOUT ARGUMENT.
//   COVERED     — the "WHERE THIS SESSION IS" block (every rendered field), and the
//                 `Deliverables/` sweep section's PRESENCE and ABSENCE.
//   NOT COVERED — the "SESSION START" headline, the SessionStart source-policy rendering,
//                 and the Honcho continuity brief. The last is `continuity.mjs`: a
//                 different module, entirely untested, outside this file surface.
// A finding INSIDE the boundary is a demonstrated hole in the enumeration — the method
// failed, and the enumeration must be extended. A finding OUTSIDE it is a new class and a
// new order. Without this paragraph the next finding gets argued about as "round four of
// the same thing", and the loop restarts through ambiguity rather than through evidence.
//
// THE FOUR-STATE TEST every field is held to:
//   measured · nothing was claimed · something was claimed and it did not check out ·
//   I could not tell.
// Any two of those rendering identically is the defect, whatever the field.
//
// EVERY TEST BELOW IS MUTATION-PROVEN: each was run against the UNFIXED module and observed
// to FAIL before the repair landed.

/**
 * A throwaway git repository with two commits. Used rather than a mock because the defects
 * this section closes live in what REAL git returns — `abbrev-ref HEAD` printing the
 * literal "HEAD", and `@{u}` failing while `--git-dir` succeeds. A mock would have been
 * written to my own belief about git's behaviour, which is the belief under test.
 */
function scratchRepo(prefix) {
  const root = normaliseSeparators(realpathSync.native(mkdtempSync(join(tmpdir(), prefix))));
  const git = (...args) =>
    execFileSync(
      'git',
      ['-C', root, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  git('init', '-q', '.');
  git('commit', '-q', '--allow-empty', '-m', 'one');
  git('commit', '-q', '--allow-empty', '-m', 'two');
  return { root, git, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// THE PIN. This is the convergence test itself, made executable.
// ---------------------------------------------------------------------------
// The list below is a LITERAL held in this file. It is deliberately NOT derived from the
// renderer it checks — a list computed from the thing it validates certifies itself and is
// worth nothing. Add a field to the block, or rename one, and this goes RED until the
// enumeration above is extended to cover it. That is what turns "the class is closed" from
// a claim into a mechanism: without it, the enumeration is a document, and a document goes
// stale the first time someone adds a line.
const ENUMERATED_LOCATION_FIELDS = [
  'cwd',
  'worktree root',
  'branch',
  'HEAD',
  'working tree',
  'upstream',
  'unpushed',
];

test('WO-OR-14 / PIN: the rendered field set EQUALS the enumeration — a new or renamed field goes RED', () => {
  // A fully-populated fixture, so every conditional line renders. `unpushed` only appears
  // when an upstream exists, so a fixture without one would silently under-cover the block.
  const everyField = renderLocationSection({
    worktreePath: 'C:/x', resolvedPath: 'C:/x', resolvedKind: 'directory', gitReadable: true,
    repoRoot: 'C:/x', linkedWorktree: false, branch: 'main', detached: false, headSha: 'abc',
    dirty: false, unpushed: 0, upstreamRef: 'origin/main', upstreamSha: 'abc',
    upstreamState: 'tracked',
  });

  // The renderer pads every label to a fixed 13-column gutter, which is what makes the
  // label lines mechanically separable from the prose lines that close the block.
  const rendered = [...everyField.matchAll(/^ {2}(.{13}): /gm)].map((m) => m[1].trim());

  assert.deepEqual(
    rendered, ENUMERATED_LOCATION_FIELDS,
    'the block renders a field the enumeration does not describe, or has dropped one it does'
  );
  // CONTROL: the extractor must actually be finding lines. A regex that matched nothing
  // would make the assertion above pass against an empty block.
  assert.ok(rendered.length >= 7, 'CONTROL: the label extractor found the block');
  // CONTROL: and it must not be swallowing the closing prose as if it were a field.
  assert.doesNotMatch(
    rendered.join('|'), /alignment verdict|These are facts/,
    'CONTROL: the extractor separates fields from the closing prose'
  );
});

// ---------------------------------------------------------------------------
// FIELD: branch — the DETACHED HEAD case
// ---------------------------------------------------------------------------

test('WO-OR-14 / F2: a DETACHED HEAD is neither a branch named "HEAD" nor a claim that nothing is pushed', () => {
  // Reachable through an entirely ordinary state, and this estate runs twenty-odd
  // worktrees. `actions/checkout` also produces exactly this state, which is why it
  // matters beyond the local machine.
  const r = scratchRepo('wo-or-14-detached-');
  try {
    r.git('checkout', '-q', '--detach', 'HEAD~1');
    const facts = gitFacts(r.root);

    // CONTROL, and it is the whole point of the finding: the COARSE gate is satisfied.
    // git is perfectly readable here, so `gitReadable` cannot be what guards the upstream
    // sentence. Without this line the test would not show WHY the old code was wrong.
    assert.equal(facts.gitReadable, true, 'CONTROL: git answers fine here — the coarse gate says "readable"');
    assert.equal(facts.detached, true, 'the detached state is MEASURED, not inferred from a string');
    assert.equal(facts.upstreamRef, null, 'git cannot answer @{u} on a detached HEAD');

    const rendered = renderLocationSection(facts);
    assert.doesNotMatch(
      rendered, /nothing here is pushed/,
      'THE DEFECT: a detached commit may well be pushed — this sentence was flatly false'
    );
    assert.doesNotMatch(
      rendered, /^ {2}branch {7}: HEAD$/m,
      'THE DEFECT: "HEAD" is what abbrev-ref returns when detached; it is not a branch name'
    );
    assert.match(rendered, /DETACHED/, 'the reader is told the actual state');
    assert.match(rendered, /NOT a claim that nothing is pushed/, 'and told what is NOT being claimed');
  } finally {
    r.cleanup();
  }
});

test('WO-OR-14 / F2: an attached branch with NO upstream still earns the confident sentence', () => {
  // The other half of the pair. Narrowing a claim is only correct if the case that genuinely
  // supports it still gets it — otherwise the repair has traded a false positive for a
  // blind spot, which is the trade WO-OR-11 explicitly refused.
  const r = scratchRepo('wo-or-14-attached-');
  try {
    const facts = gitFacts(r.root);
    assert.equal(facts.detached, false, 'this one is on a real branch');
    assert.equal(facts.upstreamState, 'none-configured', 'MEASURED: the branch exists and tracks nothing');
    assert.match(renderLocationSection(facts), /\(none tracked — nothing here is pushed\)/);
  } finally {
    r.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FIELD: worktree root — the label must name what --show-toplevel measures
// ---------------------------------------------------------------------------

test('WO-OR-14 / LABEL: the toplevel field names the WORKTREE root, and says which kind of checkout it is', () => {
  const r = scratchRepo('wo-or-14-primary-');
  const linkedPath = normaliseSeparators(join(tmpdir(), `wo-or-14-linked-${process.pid}-${Date.now()}`));
  try {
    r.git('worktree', 'add', '-q', '-b', 'side', linkedPath);

    const primary = gitFacts(r.root);
    const linked = gitFacts(linkedPath);

    // MEASURED by --git-dir differing from --git-common-dir, not by pattern-matching a path.
    assert.equal(primary.linkedWorktree, false, 'the original checkout is the primary one');
    assert.equal(linked.linkedWorktree, true, 'the added checkout is a LINKED worktree');

    assert.match(renderLocationSection(primary), /^ {2}worktree root: .*\(primary checkout\)$/m);
    assert.match(renderLocationSection(linked), /^ {2}worktree root: .*\(LINKED worktree\)$/m);
    // The old label claimed something --show-toplevel does not measure: in a linked
    // worktree it returns the WORKTREE root, never the repository root.
    assert.doesNotMatch(renderLocationSection(linked), /^ {2}repo root/m, 'the overclaiming label is gone');
  } finally {
    rmSync(linkedPath, { recursive: true, force: true });
    r.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FIELD: cwd — directory-ness, and the silent fallback
// ---------------------------------------------------------------------------

test('WO-OR-14 / F3a: a cwd that resolves to a FILE is not a location a session can be in', () => {
  // `realpathSync.native` resolves a regular file perfectly well. The old probe measured
  // EXISTENCE; the heading claims "this is where the session is", which is a claim about a
  // DIRECTORY. Existence was the weaker question all along.
  const dir = tmp('wo-or-14-file-cwd-');
  const file = join(dir, 'CLAUDE.md');
  writeFileSync(file, '# not a directory\n');
  try {
    const facts = gitFacts(file);
    assert.equal(facts.resolvedKind, 'file', 'what it actually resolved to is measured and kept');
    assert.equal(facts.resolvedPath, null, 'resolvedPath means A DIRECTORY WAS ESTABLISHED, or null');

    const rendered = renderLocationSection(facts);
    assert.match(rendered, /UNVERIFIED/);
    assert.match(rendered, /is a FILE, not a directory/, 'the reader is told exactly what went wrong');
    assert.doesNotMatch(
      rendered, /^ {2}cwd {10}: [A-Za-z]:\/[^(]*$/m,
      'THE DEFECT: a file rendered as an established location beneath "executed, not assumed"'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-14 / F3b: when the host supplies NO cwd, the fallback says so instead of passing itself off as the claim', () => {
  // Disputed as LOW on severity, and settled on the enumeration's own predicate instead:
  // a reader must be able to tell "measured" from "nothing was claimed", and today those
  // render identically. The rendered PATH is true; the HEADING — "where this session is" —
  // is not, because the only authority on that said nothing and the module quietly
  // substituted its own process's working directory.
  for (const raw of ['{}', JSON.stringify({ source: 'startup' }), JSON.stringify({ source: 'startup', cwd: '' })]) {
    const body = buildBrief(raw, { sweepFn: () => null });
    assert.match(body, /UNCLAIMED/, `no tell for ${raw}`);
    assert.match(body, /the host supplied no cwd/, `no reason given for ${raw}`);
  }
  // CONTROL: when the host DOES supply a usable cwd, no tell appears. Without this the
  // assertions above would be satisfied by a module that prints the caveat unconditionally.
  const claimed = buildBrief(
    JSON.stringify({ source: 'startup', cwd: process.cwd() }), { sweepFn: () => null }
  );
  assert.doesNotMatch(claimed, /UNCLAIMED/, 'CONTROL: a genuine host-supplied cwd carries no caveat');
});

test('WO-OR-14 / F3c: a FALSY non-string cwd is a claim that failed, not silence', () => {
  // `false` and `0` fell through the `||` to process.cwd() exactly as `''` did, so the
  // host asserting junk was indistinguishable from the host asserting nothing — and the
  // asserted value is the most useful diagnostic there is.
  for (const hostile of [false, 0]) {
    const body = buildBrief(JSON.stringify({ source: 'startup', cwd: hostile }), { sweepFn: () => null });
    assert.match(body, new RegExp(`host reported ${hostile}`), `${hostile} must be surfaced as a claim`);
    assert.doesNotMatch(body, /UNCLAIMED/, `${hostile} IS a claim — it must not read as silence`);
  }
});

// ---------------------------------------------------------------------------
// THE SWEEP — presence and absence
// ---------------------------------------------------------------------------

test('WO-OR-14 / F4: "I could not read the directory" must not render as "there is nothing open"', () => {
  // The same silence-reads-as-health failure the rest of the module exists to prevent.
  // A REAL failure, not an injected one: a regular file where the directory should be
  // raises ENOTDIR on readdirSync, and needs no permissions trickery to reproduce.
  const broken = tmp('wo-or-14-sweep-enotdir-');
  writeFileSync(join(broken, 'Deliverables'), 'not a directory');
  try {
    const unreadable = sweepOpenDeliverables(broken, Date.now());
    const absent = sweepOpenDeliverables(join(broken, 'no-such-root'), Date.now());

    assert.equal(absent, null, 'a genuinely ABSENT Deliverables/ is the one honest silence');
    assert.notEqual(unreadable, null, 'THE DEFECT: an unreadable directory returned null, exactly like an empty one');
    assert.match(unreadable, /NOT SWEPT/);
    assert.match(unreadable, /NOT a report that there is nothing open/);

    // And it must survive composition — a stated failure that buildBrief drops on the floor
    // is no better than the null it replaced.
    const body = buildBrief('{}', { sweepFn: () => sweepOpenDeliverables(broken, Date.now()) });
    assert.match(body, /NOT SWEPT/, 'the stated failure reaches the reader');
  } finally {
    rmSync(broken, { recursive: true, force: true });
  }
});

test('WO-OR-14 / F4b: an unreadable FILE among readable ones is disclosed, so a shown list is never silently short', () => {
  // The sixth case, one level down from F4: per-file stat/read failures were `continue`d
  // silently, so the section could render a list that was quietly incomplete.
  const e = makeEstate([
    { name: 'readable.md', body: '# I can be read\n', ageDays: 0 },
    { name: 'poisoned.md', body: '# I cannot\n', ageDays: 0 },
  ]);
  try {
    const io = {
      readdirSync: (d) => realIo.readdirSync(d),
      statSync: (p) => realIo.statSync(p),
      readFileSync: (p, enc) => {
        if (String(p).endsWith('poisoned.md')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        return realIo.readFileSync(p, enc);
      },
    };
    const out = sweepOpenDeliverables(e.root, Date.now(), io);
    assert.match(out, /I can be read/, 'the readable one is still reported');
    assert.doesNotMatch(out, /I cannot/, 'the unreadable one genuinely could not be read');
    assert.match(out, /1 file\(s\) could not be read/, 'THE DEFECT: the skip was silent');

    // And when EVERY file is unreadable, the section must not collapse to the null that
    // means "nothing open".
    const allBad = {
      ...io,
      readFileSync: () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); },
    };
    const nothing = sweepOpenDeliverables(e.root, Date.now(), allBad);
    assert.notEqual(nothing, null, 'unreadable-everything must never read as nothing-to-report');
    assert.match(nothing, /NOT SWEPT IN FULL/);
  } finally {
    e.cleanup();
  }
});

test('WO-OR-14 / SEAM CONTROL: the sweep DEFAULTS to the real filesystem — the injection is not testing a fiction', () => {
  // REQUIRED pairing for the injected tests above. An injected-only proof establishes that
  // the injection works and says nothing whatsoever about the module's real behaviour. This
  // asserts the default third argument reads actual files off actual disk.
  const e = makeEstate([{ name: 'genuinely-on-disk.md', body: '# Read from the real filesystem\n', ageDays: 0 }]);
  try {
    const out = sweepOpenDeliverables(e.root, Date.now()); // no io argument at all
    assert.match(out, /Read from the real filesystem/, 'the default io read the real file');
    assert.doesNotMatch(out, /could not be read/, 'and had no failures to disclose');
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// INV-2 under the new probes — more filesystem and git calls, same guarantee
// ---------------------------------------------------------------------------

test('WO-OR-14 / INV-2: the added probes never throw, on every hostile shape at once', () => {
  const dir = tmp('wo-or-14-inv2-');
  const file = join(dir, 'a-file');
  writeFileSync(file, 'x');
  try {
    for (const hostile of [
      undefined, null, '', false, 0, 7, true, {}, [], 'C:/TOTALLY/FICTIONAL/PATH', file, dir,
    ]) {
      assert.doesNotThrow(() => gitFacts(hostile), `gitFacts threw on ${JSON.stringify(hostile)}`);
      assert.doesNotThrow(
        () => buildBrief(JSON.stringify({ source: 'startup', cwd: hostile }), { sweepFn: () => null }),
        `buildBrief threw on ${JSON.stringify(hostile)}`
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-14 / Q4: failing git probes emit NOTHING on stderr — a live hook must not spray fatal: at boot', () => {
  // `execFileSync` inherits stderr unless told otherwise, so every failing probe wrote a
  // raw `fatal:` line into a LIVE SessionStart path. One file-as-cwd probe emitted eight.
  // Every one of those failures is already represented honestly in the rendered output as
  // `(unknown)` or `UNVERIFIED`, so the stderr carried no information a reader uses.
  // Proven in a CHILD PROCESS because that is the only place stderr can actually be observed.
  const dir = tmp('wo-or-14-stderr-');
  const file = join(dir, 'CLAUDE.md');
  writeFileSync(file, '# x\n');
  try {
    const modUrl = new URL('./reorient.mjs', import.meta.url).href;
    const script =
      `import(${JSON.stringify(modUrl)}).then((m) => { m.gitFacts(${JSON.stringify(file)}); });`;
    const res = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });

    assert.equal(res.status, 0, 'the probe process itself must exit 0');
    assert.equal(res.stderr, '', `THE DEFECT: git noise reached stderr:\n${res.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// PRESERVED BEHAVIOUR 2 — the Honcho continuity brief passthrough
// ===========================================================================
// Proven by INJECTION rather than by calling the real thing. Two reasons, and the second
// is the one that matters: this suite must make no network call and must not touch the
// credential file `continuity.mjs` reads; and a failing Honcho is a case that can only be
// asserted by controlling the failure.

test('CONTINUITY: the brief is passed through VERBATIM — this module adds no interpretation', async () => {
  const brief = '⟦GOV⟧ HONCHO CONTINUITY — AUTHORITATIVE current focus:\n  focus: something specific';
  const composed = `${buildBrief('{}')}\n\n${await Promise.resolve(brief)}`;
  assert.ok(composed.includes(brief), 'the brief must survive composition byte-for-byte');
  assert.ok(
    composed.indexOf('WHERE THIS SESSION IS') < composed.indexOf('HONCHO CONTINUITY'),
    'location first, then the authoritative focus'
  );
});

test('CONTINUITY: a hard failure degrades to a stated failure, never to silence', async () => {
  // The shape `main()` implements. A thrown continuity read must produce a VISIBLE line
  // saying the recall could not be read — a quiet session start is indistinguishable from
  // a healthy one, which is the failure this whole build exists to kill.
  const failing = async () => { throw new Error('honcho unreachable'); };
  let out;
  try {
    out = await failing();
  } catch (err) {
    out = `⟦GOV⟧ HONCHO CONTINUITY: brief failed hard (${err.message}).`;
  }
  assert.match(out, /HONCHO CONTINUITY: brief failed hard \(honcho unreachable\)/);
  assert.ok(out.length > 0, 'never empty');
});

// ===========================================================================
// COMPOSITION — the hook output, and INV-2
// ===========================================================================

test('BRIEF: all three sections compose into one SessionStart payload', () => {
  const e = makeEstate([{ name: 'live.md', body: '# A live deliverable\n', ageDays: 0 }]);
  try {
    const body = buildBrief(JSON.stringify({ source: 'startup', cwd: process.cwd() }), {
      sweepFn: () => sweepOpenDeliverables(e.root, Date.now()),
    });
    assert.match(body, /SESSION START — This is a FRESH session/);
    assert.match(body, /WHERE THIS SESSION IS/);
    assert.match(body, /A live deliverable/);
    assert.match(body, /fallback, not the source of truth for focus/,
      'the sweep must never be presented as the current focus');

    const out = toHookOutput(body);
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(out.hookSpecificOutput.additionalContext, body);
  } finally {
    e.cleanup();
  }
});

test('BRIEF: one failing section never suppresses the others (INV-2)', () => {
  const boom = () => { throw new Error('deliberate'); };

  const sweepBroken = buildBrief('{}', { sweepFn: boom });
  assert.match(sweepBroken, /OPEN DELIVERABLES: sweep failed \(deliberate\)/);
  assert.match(sweepBroken, /WHERE THIS SESSION IS/, 'the location section still renders');

  const factsBroken = buildBrief('{}', { factsFn: boom, sweepFn: () => null });
  assert.match(factsBroken, /WHERE THIS SESSION IS: could not be established \(deliberate\)/);
  assert.match(factsBroken, /SESSION START/, 'the headline still renders');
});

test('BRIEF: hostile stdin never throws and always yields a brief', () => {
  for (const raw of ['', '   ', 'not json {{{', '[]', 'null', '"a string"', '{"source":42}']) {
    const body = buildBrief(raw, { sweepFn: () => null });
    assert.ok(body.length > 0, `empty brief for ${JSON.stringify(raw)}`);
    assert.match(body, /SESSION START/);
  }
});

// ===========================================================================
// The small pure helpers that survived
// ===========================================================================

test('parseHookInput: only a plain JSON OBJECT is a payload', () => {
  assert.equal(parseHookInput('{"source":"clear"}').ok, true);
  for (const bad of ['', '  ', 'nope', '[]', 'null', '"str"', '7']) {
    assert.equal(parseHookInput(bad).ok, false, JSON.stringify(bad));
    assert.deepEqual(parseHookInput(bad).payload, {}, 'a rejected payload is {}, never partial');
  }
});

test('briefModeFor: an UNRECOGNISED source gets the FULL brief, never silence', () => {
  assert.equal(briefModeFor('clear').mode, BRIEF_MODE.FULL);
  assert.equal(briefModeFor('resume').mode, BRIEF_MODE.DELTA);
  for (const unknown of ['banana', undefined, null, '']) {
    const p = briefModeFor(unknown);
    assert.equal(p.recognised, false, JSON.stringify(unknown));
    assert.equal(p.mode, BRIEF_MODE.FULL, 'unknown is never absent (INV-1)');
    assert.match(p.headline, /UNRECOGNISED SessionStart source/);
  }
});

test('normaliseSeparators: the INLINED helper behaves exactly as its deleted original did', () => {
  // Inlined from rotate-session.mjs. Pinned here because the module it came from is gone,
  // so nothing else can catch a drift in it.
  assert.equal(normaliseSeparators('C:\\a\\b\\'), 'C:/a/b');
  assert.equal(normaliseSeparators('C:/a/b//'), 'C:/a/b');
  assert.equal(normaliseSeparators('C:/a/b'), 'C:/a/b');
  assert.equal(normaliseSeparators(null), null);
  assert.equal(normaliseSeparators(undefined), undefined);
  assert.equal(normaliseSeparators(7), 7);
});
