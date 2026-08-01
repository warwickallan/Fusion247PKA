import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseHookInput,
  listWorktrees,
  discoverStateFiles,
  assessBankedFreshness,
  truncateField,
  assembleBrief,
  renderOrientationBrief,
  renderProblemBrief,
  reorient,
  runHook,
  toHookOutput,
  gitFacts,
  CONTEXT_CAP,
  VERDICT,
  briefModeFor,
  BRIEF_MODE,
  SOURCE_POLICY,
} from './reorient.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const REORIENT_SRC = join(__dirname, 'reorient.mjs');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

// A scratch estate: a real git repo with a real Deliverables/<X>/programme-state.json.
function makeEstate({ state = loadFixture(), programme = 'BUILD-TEST', branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'governor-reorient-'));
  execFileSync('git', ['-C', root, 'init', '-q', '-b', branch]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);

  const home = join(root, 'Deliverables', programme);
  mkdirSync(home, { recursive: true });
  writeFileSync(join(root, 'seed.txt'), 'seed\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'seed']);
  const baseSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // AD-14: banked.head_sha is the head the state DESCRIBES — the parent of the
  // commit that carries the state file. So bank against the CURRENT head, then commit.
  const doc = JSON.parse(JSON.stringify(state));
  doc.programme.id = programme;
  doc.programme.status = 'active';
  doc.programme.home = `Deliverables/${programme}`;
  doc.banked.head_sha = baseSha;
  doc.repository.worktree = root.replace(/\\/g, '/');
  doc.repository.head_sha = baseSha;
  // The canonical LOCATION must describe this estate too, or every real-estate
  // test would read as WRONG WORKTREE against the fixture's synthetic paths —
  // which would be the harness lying, not the control firing.
  doc.repository.branch = branch;
  doc.resumption.worktree = root.replace(/\\/g, '/');
  doc.resumption.branch = branch;

  const statePath = join(home, 'programme-state.json');
  writeFileSync(statePath, JSON.stringify(doc, null, 2) + '\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'bank']);
  const bankingSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  return { root, home, statePath, baseSha, bankingSha, doc, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// Hook input — pure, never throws
// ---------------------------------------------------------------------------

test('parseHookInput: reads a real SessionStart payload', () => {
  const r = parseHookInput(JSON.stringify({ source: 'clear', cwd: 'C:/x', session_id: 'abc' }));
  assert.equal(r.ok, true);
  assert.equal(r.payload.source, 'clear');
});

test('parseHookInput: malformed and empty input never throw', () => {
  for (const bad of ['', '   ', '{not json', 'null', '[]', '"a string"']) {
    const r = parseHookInput(bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} must not be ok`);
    assert.ok(r.reason, 'must carry a reason');
  }
  assert.equal(parseHookInput(undefined).ok, false);
});

// ---------------------------------------------------------------------------
// Bounded firing
// ---------------------------------------------------------------------------

// SPEC AMENDMENT (WO-2026-08-01-01 AC1, Silas D-B §B-2, authorised by Larry
// 2026-08-01). This test previously asserted the OPPOSITE — that every source
// but `clear` was skipped silently. That was the DEFECT, not the requirement:
// `startup` and `resume` are two of the three real ways a build is re-entered,
// and they carry the emptiest context. The requirement changed; this is not a
// test edited to fit the code.
test('reorient: EVERY source is dispatched — none is skipped for being unrecognised', () => {
  for (const source of ['clear', 'startup', 'resume', 'compact', 'fork', undefined]) {
    const mode = briefModeFor(source);
    assert.ok(mode, `source ${String(source)} must resolve to a brief mode`);
    assert.ok(
      mode.mode === BRIEF_MODE.FULL || mode.mode === BRIEF_MODE.DELTA,
      'every source must map to a real brief mode, never to silence'
    );
    assert.ok(mode.headline.length > 0, 'every source must carry a headline');
  }
  assert.equal(briefModeFor('clear').mode, BRIEF_MODE.FULL);
  assert.equal(briefModeFor('startup').mode, BRIEF_MODE.FULL);
  assert.equal(briefModeFor('compact').mode, BRIEF_MODE.FULL);
  assert.equal(briefModeFor('resume').mode, BRIEF_MODE.DELTA);
  // An unknown source falls through to the MOST informative brief, not to
  // silence — an over-informative brief costs a few hundred characters, an
  // absent one loses the build.
  assert.equal(briefModeFor('fork').recognised, false);
  assert.equal(briefModeFor('fork').mode, BRIEF_MODE.FULL);
  assert.equal(briefModeFor(undefined).recognised, false);
  assert.equal(briefModeFor(undefined).mode, BRIEF_MODE.FULL);
  assert.match(briefModeFor('fork').headline, /UNRECOGNISED/);
  assert.match(briefModeFor('fork').headline, /"fork"/, 'must name the value it did not recognise');
  assert.match(briefModeFor(undefined).headline, /\(absent\)/);
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

test('listWorktrees: reads real worktrees; returns null (not []) when git fails', () => {
  const e = makeEstate();
  try {
    const wts = listWorktrees(e.root);
    assert.ok(Array.isArray(wts) && wts.length >= 1);
    assert.equal(
      listWorktrees(join(tmpdir(), 'definitely-not-a-repo-xyz')),
      null,
      'a failed enumeration must be unknown, never an empty list (T-09 D-2)'
    );
  } finally {
    e.cleanup();
  }
});

test('discoverStateFiles: finds the state, and tolerates worktrees with no Deliverables', () => {
  const e = makeEstate();
  try {
    const found = discoverStateFiles([e.root, join(tmpdir(), 'no-such-worktree-abc')]);
    assert.equal(found.length, 1);
    assert.match(found[0].path, /programme-state\.json$/);
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// AD-14 — staleness against REAL git
// ---------------------------------------------------------------------------

test('REAL GIT: a freshly banked state reads as FRESH (AD-14 banking-commit comparison)', () => {
  const e = makeEstate();
  try {
    const facts = { ...gitFacts(e.root), worktreePath: e.root.replace(/\\/g, '/') };
    // Positive control: the naive comparison would call this stale.
    assert.notEqual(facts.headSha, e.doc.banked.head_sha, 'HEAD is the banking commit, not the banked head');
    assert.equal(facts.headParentSha, e.doc.banked.head_sha, 'banked head is the banking commit\'s PARENT');

    const f = assessBankedFreshness(e.doc, facts);
    assert.equal(f.stale, false, 'a freshly banked state must not report stale (AD-14)');
    assert.ok(f.checked > 0, 'must assert a non-zero count of checks actually run (INV-5)');
  } finally {
    e.cleanup();
  }
});

test('MUTATION (REAL GIT): moving HEAD past the banking commit reports STALE with both SHAs', () => {
  const e = makeEstate();
  try {
    writeFileSync(join(e.root, 'later.txt'), 'later\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '-m', 'later work']);

    const facts = { ...gitFacts(e.root), worktreePath: e.root.replace(/\\/g, '/') };
    const f = assessBankedFreshness(e.doc, facts);
    assert.equal(f.stale, true, 'a moved HEAD must report stale');
    assert.ok(
      f.warnings.some((w) => w.includes(e.doc.banked.head_sha.slice(0, 7)) && w.includes(facts.headSha.slice(0, 7))),
      'the warning must name both the banked head and the live head'
    );
  } finally {
    e.cleanup();
  }
});

test('MUTATION: an unknown banked head or unreadable HEAD is STALE, never fresh (INV-1)', () => {
  const doc = loadFixture();
  doc.banked.head_sha = 'unknown';
  assert.equal(assessBankedFreshness(doc, { headSha: 'abc', dirty: false, unpushed: 0 }).stale, true);

  const doc2 = loadFixture();
  assert.equal(assessBankedFreshness(doc2, { headSha: null, dirty: false, unpushed: 0 }).stale, true);
});

test('MUTATION: unknown dirtiness and unknown unpushed count each raise a warning, never pass quietly', () => {
  const doc = loadFixture();
  const f = assessBankedFreshness(doc, { headSha: doc.banked.head_sha, dirty: null, unpushed: null });
  assert.ok(f.warnings.some((w) => /cleanliness could not be determined/i.test(w)));
  assert.ok(f.warnings.some((w) => /unknown is never zero/i.test(w)));
});

test('REAL GIT: a dirty programme worktree is reported even when the banked head is fresh', () => {
  const e = makeEstate();
  try {
    writeFileSync(join(e.root, 'scratch.txt'), 'uncommitted\n');
    const facts = { ...gitFacts(e.root), worktreePath: e.root.replace(/\\/g, '/') };
    assert.equal(facts.dirty, true);
    const f = assessBankedFreshness(e.doc, facts);
    assert.ok(f.warnings.some((w) => /DIRTY/i.test(w)));
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// THE SPECIFIED MUTATION TEST — oversized state truncates SAFELY
// ---------------------------------------------------------------------------

test('MUTATION: an oversized state truncates safely, SAYS it truncated, and never drops the next action', () => {
  const doc = loadFixture();
  doc.programme.status = 'active';
  // Blow every optional section far past the cap.
  doc.resumption.do_not = Array.from({ length: 200 }, (_, i) => `Do not do forbidden thing number ${i} `.repeat(12));
  doc.resumption.read_first = Array.from({ length: 200 }, (_, i) => `Read source document number ${i} `.repeat(12));
  doc.resumption.focus = 'F'.repeat(40000);
  doc.resumption.next_action = 'THE-NEXT-ACTION-SENTINEL. ' + 'x'.repeat(60);

  const b = renderOrientationBrief(doc, {
    statePath: 'X/programme-state.json',
    worktree: 'C:/wt',
    freshness: { stale: false, warnings: [], checked: 4 },
  });

  assert.ok(b.length <= CONTEXT_CAP, `brief must respect the ${CONTEXT_CAP}-char cap, got ${b.length}`);
  assert.equal(b.fits, true);
  assert.ok(b.dropped.length > 0, 'this state cannot fit — sections must actually have been dropped');
  assert.match(b.text, /TRUNCATED/, 'truncation must be announced, never silent');
  assert.match(b.text, /THE-NEXT-ACTION-SENTINEL/, 'the next action must survive truncation (the whole point)');
  assert.match(b.text, /THE EXACT NEXT ACTION/, 'the next-action heading must survive');
  for (const name of b.dropped) {
    assert.ok(b.text.includes(name), `the notice must name the dropped section "${name}"`);
  }
});

test('MUTATION: a next_action longer than the cap is truncated WITH a pointer, never dropped', () => {
  const r = truncateField('N'.repeat(50000), 2400, 'Deliverables/X/programme-state.json');
  assert.equal(r.truncated, true);
  assert.ok(r.text.length <= 2400);
  assert.match(r.text, /TRUNCATED/);
  assert.match(r.text, /Deliverables\/X\/programme-state\.json/, 'must point at where the full text lives');
});

test('assembleBrief: required sections are never dropped, even when only they remain', () => {
  const sections = [
    { name: 'core', required: true, body: 'CORE '.repeat(400) },
    { name: 'extra', required: false, body: 'EXTRA '.repeat(400) },
  ];
  const b = assembleBrief(sections, { cap: 1000 });
  assert.deepEqual(b.dropped, ['extra']);
  assert.match(b.text, /CORE/);
  assert.ok(b.text.length <= 1000);
});

test('assembleBrief: a brief that already fits is untouched and announces nothing', () => {
  const b = assembleBrief([{ name: 'core', required: true, body: 'short' }], { cap: 1000 });
  assert.equal(b.text, 'short');
  assert.deepEqual(b.dropped, []);
  assert.equal(b.fits, true);
});

// ---------------------------------------------------------------------------
// AC1 — a RENDERED BRIEF on every entry path (Silas D-B §B-2, mutations B-M1..4)
// ---------------------------------------------------------------------------
// These assert on the CONTENT of the brief, never on the fact that reorient()
// was called or that the verdict is not SKIPPED. Per D-B §B-2 note 4 an
// invocation-shaped assertion is insufficient and must not be written: it would
// pass while the behaviour stayed broken, which is exactly the false-control
// failure this estate has already been burned by.

// The three facts a re-entering session cannot obtain without the brief.
function assertCarriesTheEssentials(text, e) {
  assert.match(text, /branch\s+:/, 'brief must carry the branch');
  assert.match(text, /banked\s+:/, 'brief must carry the banked head');
  assert.match(text, /THE EXACT NEXT ACTION/, 'brief must carry the next action');
  assert.ok(
    text.includes(String(e.baseSha).slice(0, 7)),
    'brief must carry the actual banked head sha, not a placeholder'
  );
}

test('AC1/B-M1: source=startup renders a FULL brief carrying head, branch and next action', () => {
  const e = makeEstate();
  try {
    const r = reorient({ source: 'startup', cwd: e.root });
    assert.ok(r.context && r.context.length > 0, 'a fresh session must receive a brief');
    assert.notEqual(r.verdict, VERDICT.SKIPPED);
    assertCarriesTheEssentials(r.context, e);
    assert.match(r.context, /FRESH session/, 'must name the entry path');
    assert.ok(toHookOutput(r), 'the brief must reach the session');
  } finally {
    e.cleanup();
  }
});

test('AC1: source=clear still renders a FULL brief, and still says the context was cleared', () => {
  const e = makeEstate();
  try {
    const r = reorient({ source: 'clear', cwd: e.root });
    assertCarriesTheEssentials(r.context, e);
    assert.match(r.context, /CLEARED/, 'the pre-existing /clear behaviour is preserved');
  } finally {
    e.cleanup();
  }
});

test('AC1/B-M2: source=resume renders a SHORT DELTA, strictly shorter than the full brief', () => {
  const e = makeEstate();
  try {
    const full = reorient({ source: 'startup', cwd: e.root });
    const delta = reorient({ source: 'resume', cwd: e.root });
    assert.ok(delta.context && delta.context.length > 0, 'a resumed session must still be told the delta');
    // Strictly shorter — the whole point of the delta is that it does not spend
    // context re-stating what the restored transcript already carries.
    assert.ok(
      delta.context.length < full.context.length,
      `resume brief (${delta.context.length}) must be strictly shorter than full (${full.context.length})`
    );
    // But it must still carry what a resumed session CANNOT get from its own
    // transcript: where the durable truth is now.
    assert.match(delta.context, /branch\s+:/);
    assert.match(delta.context, /banked\s+:/);
    assert.match(delta.context, /THE EXACT NEXT ACTION/);
    assert.match(delta.context, /durable state on disk wins/i,
      'a resumed session must be told its restored history may predate the banked state');
  } finally {
    e.cleanup();
  }
});

test('AC1/B-M3: source=compact renders a FULL brief headlined RECOVERY', () => {
  const e = makeEstate();
  try {
    const r = reorient({ source: 'compact', cwd: e.root });
    assertCarriesTheEssentials(r.context, e);
    assert.match(r.context, /RECOVERY/, 'a compacted context is the evaluator RECOVERY state');
    assert.match(r.context, /lossy summary/, 'and must say why its own memory is not evidence');
  } finally {
    e.cleanup();
  }
});

test('AC1/B-M4: an unrecognised or absent source renders a FULL brief that NAMES the value', () => {
  const e = makeEstate();
  try {
    const odd = reorient({ source: 'banana', cwd: e.root });
    assertCarriesTheEssentials(odd.context, e);
    assert.match(odd.context, /UNRECOGNISED/);
    assert.match(odd.context, /"banana"/, 'must name the unrecognised value so it can be reported');

    const absent = reorient({ cwd: e.root });
    assertCarriesTheEssentials(absent.context, e);
    assert.match(absent.context, /UNRECOGNISED/);
    assert.match(absent.context, /\(absent\)/, 'an absent source is "absent", never silently treated as known');
  } finally {
    e.cleanup();
  }
});

test('AC1 MUTATION: restoring the old source guard makes the startup proof FAIL', () => {
  // The control that proves the AC1 tests above can actually fail. The old
  // behaviour was `if (source !== 'clear') return SKIPPED` — reproduced here
  // exactly, and asserted to be incompatible with what AC1 requires.
  const oldGuard = (source) =>
    source !== 'clear' ? { verdict: VERDICT.SKIPPED, context: null } : { verdict: VERDICT.ORIENTED, context: 'x' };

  const underOldGuard = oldGuard('startup');
  assert.equal(underOldGuard.context, null, 'the old guard produced no brief for startup — the defect');

  const e = makeEstate();
  try {
    const now = reorient({ source: 'startup', cwd: e.root });
    assert.notEqual(now.context, null, 'the repaired code must produce what the old guard suppressed');
    assert.ok(
      now.context.length > 0 && underOldGuard.context === null,
      'AC1 is exactly the difference between these two'
    );
  } finally {
    e.cleanup();
  }
});

// Every source in the policy must be reachable through the real dispatcher.
test('AC1: no SOURCE_POLICY entry is unreachable or silent', () => {
  const e = makeEstate();
  try {
    for (const source of Object.keys(SOURCE_POLICY)) {
      const r = reorient({ source, cwd: e.root });
      assert.ok(r.context && r.context.length > 0, `source=${source} must render a brief`);
      assert.equal(r.sourceMode.source, source);
    }
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Loud failure — INV-1
// ---------------------------------------------------------------------------

test('MUTATION: no state anywhere produces a LOUD missing brief, not silence', () => {
  const root = mkdtempSync(join(tmpdir(), 'governor-empty-'));
  execFileSync('git', ['-C', root, 'init', '-q', '-b', 'main']);
  try {
    const r = reorient({ source: 'clear', cwd: root });
    assert.equal(r.verdict, VERDICT.MISSING);
    assert.ok(r.context && r.context.length > 0, 'missing state must still inject a brief');
    assert.match(r.context, /NO BANKED PROGRAMME STATE FOUND/);
    assert.match(r.context, /Do NOT assume there is nothing in flight/,
      'must warn against reading "found none" as "nothing is running"');
    assert.ok(toHookOutput(r), 'a missing-state result must still produce hook output');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('MUTATION: a CORRUPT state file is reported loudly, never silently skipped as "no programme"', () => {
  const e = makeEstate();
  try {
    writeFileSync(e.statePath, '{ this is not valid json');
    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.CORRUPT);
    assert.match(r.context, /UNUSABLE/);
    assert.match(r.context, /unreadable/i);
    assert.match(r.context, /programme-state\.json/);
    assert.equal(r.corrupt.length, 1);
  } finally {
    e.cleanup();
  }
});

test('MUTATION: a state that VALIDATES but fails the schema is reported as corrupt, not as missing', () => {
  const e = makeEstate();
  try {
    const doc = JSON.parse(readFileSync(e.statePath, 'utf8'));
    delete doc.resumption; // a required top-level field
    writeFileSync(e.statePath, JSON.stringify(doc, null, 2));
    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.CORRUPT);
    assert.match(r.context, /invalid/i);
  } finally {
    e.cleanup();
  }
});

test('MUTATION: git worktree enumeration failing produces a FAILED brief, not a false "missing"', () => {
  const r = reorient({ source: 'clear', cwd: join(tmpdir(), 'not-a-repo-at-all-zzz') });
  assert.equal(r.verdict, VERDICT.FAILED);
  assert.match(r.context, /REORIENTATION FAILED/);
  assert.match(r.context, /could not be searched/);
});

test('MUTATION: two active programmes are reported as AMBIGUOUS, both named, neither guessed', () => {
  const e = makeEstate({ programme: 'BUILD-AAA' });
  try {
    // A second active programme in the same worktree.
    const home2 = join(e.root, 'Deliverables', 'BUILD-BBB');
    mkdirSync(home2, { recursive: true });
    const doc2 = JSON.parse(readFileSync(e.statePath, 'utf8'));
    doc2.programme.id = 'BUILD-BBB';
    doc2.programme.home = 'Deliverables/BUILD-BBB';
    writeFileSync(join(home2, 'programme-state.json'), JSON.stringify(doc2, null, 2));

    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.AMBIGUOUS);
    assert.match(r.context, /BUILD-AAA/);
    assert.match(r.context, /BUILD-BBB/);
    assert.match(r.context, /will not guess/);
  } finally {
    e.cleanup();
  }
});

test('a corrupt SIBLING is surfaced even when a good active programme is found', () => {
  const e = makeEstate({ programme: 'BUILD-GOOD' });
  try {
    const home2 = join(e.root, 'Deliverables', 'BUILD-BROKEN');
    mkdirSync(home2, { recursive: true });
    writeFileSync(join(home2, 'programme-state.json'), '{{{');

    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.ORIENTED);
    assert.match(r.context, /failed validation and were ignored/);
    assert.match(r.context, /BUILD-BROKEN/);
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// The happy path, end to end, against a real estate
// ---------------------------------------------------------------------------

test('REAL ESTATE: a clean banked programme orients, under cap, carrying the next action', () => {
  const e = makeEstate({ programme: 'BUILD-REAL' });
  try {
    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.ORIENTED, `expected oriented, got ${r.verdict}: ${r.context?.slice(0, 300)}`);
    assert.ok(r.context.length <= CONTEXT_CAP);
    assert.match(r.context, /RESUMING BUILD-REAL/);
    assert.match(r.context, /THE EXACT NEXT ACTION/);
    assert.match(r.context, new RegExp(e.doc.resumption.ticket));
    assert.match(r.context, /branch\s+:/);
    assert.match(r.context, /worktree\s+:/);
    assert.match(r.context, /model\s+:/);
    assert.match(r.context, /product SSOT/, 'the artefact hierarchy (AD-17) must be legible in the brief');
    assert.match(r.context, /Banked state is FRESH/);

    const out = toHookOutput(r);
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(out.hookSpecificOutput.additionalContext, r.context);
  } finally {
    e.cleanup();
  }
});

test('REAL ESTATE: after HEAD moves, the SAME estate orients but is flagged STALE', () => {
  const e = makeEstate({ programme: 'BUILD-STALE' });
  try {
    writeFileSync(join(e.root, 'more.txt'), 'more\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '-m', 'more']);

    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.STALE);
    assert.match(r.context, /BANKED STATE IS STALE/);
    assert.match(r.context, /RECOVERY/);
    assert.match(r.context, /THE EXACT NEXT ACTION/, 'stale still orients — it warns, it does not withhold');
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// runHook — the envelope
// ---------------------------------------------------------------------------

test('MUTATION: malformed stdin produces a FAILED brief that admits nothing was inspected', () => {
  const r = runHook('{not json');
  assert.equal(r.verdict, VERDICT.FAILED);
  assert.match(r.context, /could not read its input/);
  assert.match(r.context, /No state was inspected/);
});

// SPEC AMENDMENT (WO-2026-08-01-01 AC1). Previously asserted that `startup`
// injected nothing — the defect. A fresh session must now be reoriented, and a
// source is never the reason a brief is withheld.
test('runHook: a fresh-session source is dispatched, never skipped for its source', () => {
  const r = runHook(JSON.stringify({ source: 'startup', cwd: 'C:/x' }));
  assert.notEqual(r.verdict, VERDICT.SKIPPED, 'startup must not be skipped for being startup');
  assert.ok(r.context && r.context.length > 0, 'a fresh session must be told something');
  assert.ok(toHookOutput(r), 'and that something must reach the session as hook output');
});

test('MUTATION: an internal throw becomes a FAILED brief, never an exception', () => {
  const r = runHook(JSON.stringify({ source: 'clear', cwd: 'C:/x' }), {
    execFile: () => {
      throw new Error('boom');
    },
    readdir: () => {
      throw new Error('boom');
    },
  });
  // listWorktrees swallows the throw and returns null → FAILED, loudly.
  assert.equal(r.verdict, VERDICT.FAILED);
  assert.ok(r.context.length > 0);
});

// ---------------------------------------------------------------------------
// The real child process — the CLI as the host actually invokes it
// ---------------------------------------------------------------------------

test('REAL PROCESS: the hook CLI emits valid hook JSON and exits 0 on a real estate', () => {
  const e = makeEstate({ programme: 'BUILD-CLI' });
  try {
    const out = execFileSync('node', [REORIENT_SRC], {
      input: JSON.stringify({ source: 'clear', cwd: e.root, session_id: 'x', transcript_path: 'y' }),
      encoding: 'utf8',
    });
    const parsed = JSON.parse(out);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.ok(parsed.hookSpecificOutput.additionalContext.includes('BUILD-CLI'));
    assert.ok(parsed.hookSpecificOutput.additionalContext.length <= CONTEXT_CAP);
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: garbage stdin still exits 0 and still says something (INV-2)', () => {
  const out = execFileSync('node', [REORIENT_SRC], { input: 'not json at all', encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert.match(parsed.hookSpecificOutput.additionalContext, /REORIENTATION FAILED/);
});

test('REAL PROCESS: empty stdin exits 0 and does not crash the session start', () => {
  const out = execFileSync('node', [REORIENT_SRC], { input: '', encoding: 'utf8' });
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /could not read its input/);
});

// SPEC AMENDMENT (WO-2026-08-01-01 AC1) — and the strongest available proof of
// it. This previously asserted that a `startup` session start wrote NOTHING;
// that was the whole defect, end to end. It now drives the REAL script as a
// REAL child process, over a REAL SessionStart payload, and asserts on the
// CONTENT of what the session would actually receive. An assertion that the
// hook was invoked, or that the verdict is not SKIPPED, would be insufficient
// here — it would pass while the behaviour stayed broken (D-B §B-2 note 4).
// Driven against a FIXTURE estate, not the developer's own checkout: the live
// estate has several worktrees each carrying a copy of the same programme
// state, so `process.cwd()` here resolves to AMBIGUOUS and the result would
// depend on how many worktrees happen to exist on the machine. A fixture makes
// the proof deterministic without weakening it — it is still the real script,
// as a real child process, over a real SessionStart payload.
test('REAL PROCESS: a fresh (startup) session start emits a RENDERED BRIEF on stdout', () => {
  const e = makeEstate();
  try {
    const out = execFileSync('node', [REORIENT_SRC], {
      input: JSON.stringify({ source: 'startup', cwd: e.root }),
      encoding: 'utf8',
    });
    // THE defect, end to end: this produced an EMPTY stdout before AC1.
    assert.ok(out.trim().length > 0, 'a fresh session start must inject context, not silence');
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.ok(ctx && ctx.length > 0, 'additionalContext must be a non-empty brief');
    // T-15's model gate composes ON TOP of the brief in the real hook path and
    // may substitute its own compact render when a model switch is owed. That
    // layer is pre-existing and out of scope here, so this asserts the content
    // the session receives EITHER WAY — the build it is resuming and where it
    // is up to. The unsubstituted full brief is asserted directly, against the
    // same render path, in the AC1/B-M1..B-M4 tests above.
    assert.match(ctx, /BUILD-TEST/, 'the session must be told which build it is resuming');
    assert.match(ctx, /T-02/, 'and the ticket it is resuming at');
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Every problem brief respects the cap
// ---------------------------------------------------------------------------

test('every problem brief stays under the cap even with absurd inputs', () => {
  for (const v of [VERDICT.MISSING, VERDICT.CORRUPT, VERDICT.AMBIGUOUS, VERDICT.FAILED]) {
    const b = renderProblemBrief(v, {
      detail: 'D'.repeat(30000),
      candidates: Array.from({ length: 50 }, (_, i) => ({
        id: `BUILD-${i}`,
        title: 'T'.repeat(500),
        path: 'P'.repeat(500),
        worktree: 'W'.repeat(500),
      })),
    });
    assert.ok(b.text.length <= CONTEXT_CAP, `${v} brief exceeded the cap: ${b.text.length}`);
  }
});

// ---------------------------------------------------------------------------
// Requirements 4, 5 and 7 — location verification INSIDE the brief
// ---------------------------------------------------------------------------
// The gate (worktree-guard.mjs) refuses the writes; the brief is what tells a
// fresh Larry WHY, before it tries. Both read the same comparison from the same
// module, so the brief can never say "aligned" while the gate is denying.

function addWorktree(estate, name, branch) {
  const path = join(estate.root, '..', `${name}-${Math.abs(hashish(estate.root + name))}`);
  // Cut from the SEED commit: the wrong worktree must not carry the build's own
  // Deliverables, which is the realistic shape (you end up on main by mistake).
  execFileSync('git', ['-C', estate.root, 'worktree', 'add', '-q', '-b', branch, path, estate.baseSha]);
  const real = execFileSync('git', ['-C', path, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' })
    .trim()
    .replace(/\\/g, '/');
  return { path: real, remove: () => {
    try { execFileSync('git', ['-C', estate.root, 'worktree', 'remove', '--force', path]); } catch { /* temp dir */ }
  } };
}

function hashish(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

test('REAL GIT: reorienting FROM the canonical worktree verifies location and permits implementation', () => {
  const e = makeEstate();
  try {
    const r = reorient({ source: 'clear', cwd: e.root });
    assert.equal(r.verdict, VERDICT.ORIENTED);
    assert.equal(r.implementationPermitted, true);
    assert.equal(r.location.verdict, 'aligned');
    assert.match(r.context, /LOCATION VERIFIED/);
    assert.match(r.context, /Implementation is permitted/);
    assert.ok(r.context.length <= CONTEXT_CAP);
  } finally {
    e.cleanup();
  }
});

test('REQUIREMENT 5 (MUTATION, REAL GIT): reorienting from the WRONG worktree returns WRONG WORKTREE and permits nothing', () => {
  const e = makeEstate();
  const wrong = addWorktree(e, 'wrong', 'not/the-build-branch');
  try {
    const r = reorient({ source: 'clear', cwd: wrong.path });

    assert.equal(r.verdict, VERDICT.WRONG_WORKTREE, 'the verdict itself must carry the refusal');
    assert.equal(r.implementationPermitted, false);
    assert.equal(r.location.verdict, 'wrong-worktree');

    // Loud, and unmissable.
    assert.match(r.context, /WRONG WORKTREE/);
    assert.match(r.context, /DO NOT IMPLEMENT ANYTHING/);
    assert.match(r.context, /NO IMPLEMENTATION IS PERMITTED/);

    // Requirement 7 — the recovery protocol, verbatim, in the brief itself.
    assert.ok(r.context.includes('"Approve the pending EnterWorktree request in the local Claude terminal"'));
    assert.match(r.context, /Larry calls EnterWorktree with path: /);
    assert.match(r.context, /must NOT spin silently/);
    assert.match(r.context, /must NOT ask Warwick to run git commands/);

    // ORDER is part of the control: a reader who meets the next action first
    // starts working before learning it may not.
    assert.ok(
      r.context.indexOf('WRONG WORKTREE') < r.context.indexOf('THE EXACT NEXT ACTION'),
      'the refusal must appear ABOVE the next action'
    );

    // It names both places, or the reader cannot act on it.
    assert.ok(r.context.includes(e.root.replace(/\\/g, '/')), 'names where it should be');
    assert.ok(r.context.includes('not/the-build-branch'), 'names the branch it is wrongly on');
    assert.ok(r.context.length <= CONTEXT_CAP, 'still bounded');
  } finally {
    wrong.remove();
    e.cleanup();
  }
});

test('MUTATION: WRONG WORKTREE outranks STALE — the stronger refusal is the one reported', () => {
  const e = makeEstate();
  const wrong = addWorktree(e, 'stale', 'another/wrong-branch');
  try {
    // Move HEAD so the banked state is genuinely stale as well.
    writeFileSync(join(e.root, 'drift.txt'), 'drift\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '-m', 'drift']);

    const r = reorient({ source: 'clear', cwd: wrong.path });
    assert.equal(r.freshness.stale, true, 'the state really is stale too');
    assert.equal(r.verdict, VERDICT.WRONG_WORKTREE, 'but "do not implement" outranks "re-read first"');
    assert.equal(r.implementationPermitted, false);
    assert.match(r.context, /STATE HEALTH/, 'staleness is still reported, not swallowed');
  } finally {
    wrong.remove();
    e.cleanup();
  }
});

test('MUTATION: the WRONG WORKTREE banner is REQUIRED — it survives truncation of an oversized state', () => {
  const doc = loadFixture();
  doc.programme.status = 'active';
  doc.resumption.do_not = Array.from({ length: 200 }, (_, i) => `Forbidden thing ${i} `.repeat(12));
  doc.resumption.read_first = Array.from({ length: 200 }, (_, i) => `Document ${i} `.repeat(12));
  doc.resumption.focus = 'F'.repeat(40000);
  doc.resumption.next_action = 'THE-NEXT-ACTION-SENTINEL.';

  const canonical = { programmeId: 'BUILD-999', worktree: 'C:/right-place', branch: 'build/right', ticket: 'T-99' };
  const location = {
    verdict: 'wrong-worktree',
    checked: 3,
    mismatches: [
      { field: 'repository root', expected: 'C:/right-place', actual: 'C:/wrong-place' },
      { field: 'branch', expected: 'build/right', actual: 'main' },
    ],
    live: { cwd: 'C:/wrong-place', repoRoot: 'C:/wrong-place', branch: 'main', headSha: 'abc1234' },
  };

  const b = renderOrientationBrief(doc, {
    statePath: 'X/programme-state.json',
    worktree: 'C:/right-place',
    freshness: { stale: false, warnings: [], checked: 4 },
    canonical,
    location,
  });

  assert.ok(b.length <= CONTEXT_CAP, `must respect the ${CONTEXT_CAP}-char cap, got ${b.length}`);
  assert.ok(b.dropped.length > 0, 'this state cannot fit — sections must have been dropped');
  assert.match(b.text, /TRUNCATED/, 'truncation announced');
  assert.match(b.text, /WRONG WORKTREE/, 'the refusal is never a droppable section');
  assert.ok(b.text.includes('"Approve the pending EnterWorktree request in the local Claude terminal"'));
  assert.match(b.text, /THE-NEXT-ACTION-SENTINEL/, 'and the next action still survives');
  assert.ok(!b.dropped.includes('location'), 'the location section must never appear in the dropped list');
});
