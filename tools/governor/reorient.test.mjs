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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, realpathSync } from 'node:fs';
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
  const dirty = renderLocationSection({
    worktreePath: 'C:/x', resolvedPath: 'C:/x', gitReadable: true,
    repoRoot: 'C:/x', branch: 'b', headSha: 'abc',
    dirty: true, unpushed: null, upstreamRef: null, upstreamSha: null,
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
