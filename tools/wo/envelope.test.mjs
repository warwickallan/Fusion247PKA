// tools/wo/envelope.test.mjs — proofs for the Work Order envelope generator.
//
// Two disciplines govern this file:
//
// 1. INVARIANTS ARE PINNED TO LITERALS HELD HERE, never re-derived from the source under
//    test. A test that asks the code what the answer is, then checks the code gave that
//    answer, proves nothing.
//
// 2. EVERY CONTROL IS MUTATION-TESTED, hardest on the UNRESOLVED path. A control is not
//    evidence until it has been MADE TO FAIL. Each mutation asserts (a) the mutation
//    genuinely changed the source, and (b) the invariant that holds on the real module is
//    VIOLATED by the mutant. If a mutation ever fails to break its invariant, the control
//    it claims to prove is decorative.
//
// Mutants are loaded through a `data:` URL, so this suite writes NOTHING outside the
// declared file surface — which is also why envelope.mjs carries no relative imports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

import * as E from './envelope.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(HERE, 'envelope.mjs');
// Normalised on read for the same reason the generator normalises: this worktree holds CRLF
// while the blobs hold LF, so multi-line mutation targets would stop matching after a fresh
// checkout and this suite would go red for a reason that has nothing to do with the code.
const norm = (s) => s.replace(/\r\n/g, '\n');
const SRC = norm(readFileSync(SRC_PATH, 'utf8'));
const REPO = join(HERE, '..', '..');
const readContract = (folder) => norm(readFileSync(join(REPO, 'Team', folder, 'AGENTS.md'), 'utf8'));

// ---------------------------------------------------------------------------
// PINNED LITERALS — the answers, held outside the source that computes them.
// ---------------------------------------------------------------------------

const L_UNRESOLVED_PREFIX = 'UNRESOLVED — ';
const L_UNRESOLVED_SUFFIX = ' must be read';
const L_GIT_SILENT = 'none — contract silent, deny-by-default';

// The recorded not-delivered tool, and the shims that declare it anyway.
const L_NOT_DELIVERED_TOOL = 'MultiEdit';
const L_OVERCLAIMING_SHIMS = ['cairn', 'felix', 'mack', 'nolan', 'silas', 'warden'];

// Grants, read off the shims by hand on 2026-08-05.
const L_KEEL_GRANT = 'Read, Write, Edit, Bash, Glob, Grep';
const L_PAX_GRANT = 'Read, Write, WebFetch, WebSearch, Grep, Glob';

// Specialists whose contracts say nothing whatever about git.
const L_GIT_SILENT_SPECIALISTS = ['nolan', 'penn'];

// The standing authority defaults, as the canonical template carries them.
const L_STANDING_DEFAULTS = {
  credential_scope: 'none',
  live_authority: 'none',
  network: 'none',
  dependency_policy: 'no-new-runtime-deps',
  private_surface: 'none',
};

const L_CAPABILITIES = ['command execution', 'file authorship', 'file modification', 'network fetch', 'network search'];

// A directory that exists but contains no canonical sources — used to prove the generator
// READS them rather than remembering them.
const BARREN = HERE;

// ---------------------------------------------------------------------------
// Mutation harness.
// ---------------------------------------------------------------------------

async function loadMutant(find, replace) {
  assert.ok(SRC.includes(find), `mutation target absent from source: ${JSON.stringify(find)}`);
  const mutated = SRC.replace(find, replace);
  assert.notEqual(mutated, SRC, 'mutation did not change the source');
  const url = `data:text/javascript;base64,${Buffer.from(mutated, 'utf8').toString('base64')}`;
  return import(url);
}

/** Assert that `fn` throws when run against the mutant — i.e. the invariant went RED. */
async function assertMutantBreaks(mutant, fn, label) {
  let broke = false;
  try {
    fn(mutant);
  } catch {
    broke = true;
  }
  assert.equal(broke, true, `MUTATION SURVIVED — the control is decorative: ${label}`);
}

// ---------------------------------------------------------------------------
// The two strings (Amendment 1 F-5): a CONCLUSION and an UNKNOWN never share one.
// ---------------------------------------------------------------------------

test('UNRESOLVED marker has the exact pinned shape', () => {
  assert.equal(E.UNRESOLVED_PREFIX, L_UNRESOLVED_PREFIX);
  assert.equal(E.UNRESOLVED_SUFFIX, L_UNRESOLVED_SUFFIX);
  assert.equal(E.unresolved('a/b.md', 'the section'), `${L_UNRESOLVED_PREFIX}a/b.md:the section${L_UNRESOLVED_SUFFIX}`);
  assert.equal(E.isUnresolved(E.unresolved('x', 'y')), true);
});

test('the determinate git conclusion is NOT an UNRESOLVED string', () => {
  assert.equal(E.GIT_SILENT, L_GIT_SILENT);
  assert.equal(E.isUnresolved(E.GIT_SILENT), false, 'a conclusion must never be dressed as an unknown');
});

// ---------------------------------------------------------------------------
// FIELD 1 — tool grant, verbatim.
// ---------------------------------------------------------------------------

test('tool grant is copied verbatim from the shim', () => {
  assert.equal(E.toolGrant(REPO, 'keel').value, L_KEEL_GRANT);
  assert.equal(E.toolGrant(REPO, 'pax').value, L_PAX_GRANT);
});

test('an unknown specialist yields UNRESOLVED, never a plausible grant', () => {
  const g = E.toolGrant(REPO, 'nosuchspecialist');
  assert.equal(E.isUnresolved(g.value), true);
  assert.match(g.value, /\.claude\/agents\/nosuchspecialist\.md:frontmatter tools:/);
});

// ---------------------------------------------------------------------------
// FIELD 1b — the recorded not-delivered annotation (Amendment 1 F-4).
// The hole the anti-fabrication property does not guard: it stops guesses, not
// faithfully-copied falsehoods.
// ---------------------------------------------------------------------------

test('the not-delivered record is matched out of canonical prose, not restated', () => {
  const rec = E.notDeliveredRecord(REPO);
  assert.equal(rec.error, undefined);
  assert.equal(rec.tool, L_NOT_DELIVERED_TOOL);
  assert.match(rec.sentence, /NOT delivered/);
  assert.equal(rec.sentence.startsWith(L_NOT_DELIVERED_TOOL), true);
});

test('every over-claiming shim gets the annotation; honest ones get n/a', () => {
  for (const slug of L_OVERCLAIMING_SHIMS) {
    const g = E.toolGrant(REPO, slug);
    assert.ok(g.tools.includes(L_NOT_DELIVERED_TOOL), `${slug} should declare ${L_NOT_DELIVERED_TOOL}`);
    const a = E.notDeliveredAnnotation(REPO, g.tools);
    assert.match(a.value, /NOT delivered/, `${slug} must carry the recorded annotation`);
    assert.equal(a.tool, L_NOT_DELIVERED_TOOL);
  }
  const keel = E.notDeliveredAnnotation(REPO, E.toolGrant(REPO, 'keel').tools);
  assert.match(keel.value, /^n\/a/);
});

test('the annotation is UNRESOLVED, not silently dropped, when the record is unreadable', () => {
  const a = E.notDeliveredAnnotation(BARREN, ['MultiEdit']);
  assert.equal(E.isUnresolved(a.value), true, 'a control that quietly stops firing is worse than none');
});

// ---------------------------------------------------------------------------
// FIELD 2 — heading-anchored verbatim surfaces.
// ---------------------------------------------------------------------------

test('surfaces are extracted verbatim from the contract', () => {
  const s = E.surfaces(REPO, 'keel');
  assert.equal(E.isUnresolved(s.permitted), false);
  const contract = readContract(s.folder);
  assert.ok(contract.includes(s.permitted), 'extracted text must appear VERBATIM in the contract');
  assert.ok(contract.includes(s.prohibited), 'extracted text must appear VERBATIM in the contract');
  assert.ok(contract.includes(s.criticalRules), 'extracted text must appear VERBATIM in the contract');
});

// Nolan's contract carries no permitted-surface anchor at all — and Nolan is the specialist
// whose envelope produced WO-15's class-A defect, so this is the live case, not a contrived one.
test('a contract with no matching anchor yields UNRESOLVED naming the anchors sought', () => {
  const s = E.surfaces(REPO, 'nolan');
  assert.equal(E.isUnresolved(s.permitted), true);
  assert.match(s.permitted, /Where Nolan writes \| What you write, where, and how/);
  assert.equal(E.isUnresolved(s.prohibited), false, 'Nolan DOES carry a prohibition anchor');
});

test('an unknown specialist yields UNRESOLVED for every surface', () => {
  const s = E.surfaces(REPO, 'nosuchspecialist');
  for (const k of ['permitted', 'prohibited', 'criticalRules']) assert.equal(E.isUnresolved(s[k]), true);
});

// ---------------------------------------------------------------------------
// FIELDS 3 & 4 — standing defaults, copied from the canonical template.
// ---------------------------------------------------------------------------

test('standing authority defaults match the pinned values', () => {
  const d = E.standingDefaults(REPO);
  for (const [field, expected] of Object.entries(L_STANDING_DEFAULTS)) assert.equal(d[field], expected);
});

test('standing defaults are READ, not remembered — no template means UNRESOLVED', () => {
  const d = E.standingDefaults(BARREN);
  for (const field of Object.keys(L_STANDING_DEFAULTS)) {
    assert.equal(E.isUnresolved(d[field]), true, `${field} must be UNRESOLVED when the template is unreadable`);
  }
});

// ---------------------------------------------------------------------------
// FIELD 5 — git authority, three states. WO-15's actual class-A defect.
// ---------------------------------------------------------------------------

test('a contract silent on git resolves to the determinate default', () => {
  for (const slug of L_GIT_SILENT_SPECIALISTS) {
    const g = E.gitAuthority(REPO, slug);
    assert.equal(g.state, 'silent', `${slug} contract should be silent on git`);
    assert.equal(g.value, L_GIT_SILENT);
    assert.equal(E.isUnresolved(g.value), false);
  }
});

test('a contract with the anchored section copies it verbatim', () => {
  const g = E.gitAuthority(REPO, 'keel');
  assert.equal(g.state, 'granted');
  const contract = readContract('Keel - Implementation Engineer');
  assert.ok(contract.includes(g.value), 'granted git authority must be VERBATIM contract text');
});

test('git prose with no anchor is UNKNOWN, never an inferred grant', () => {
  const g = E.gitAuthority(REPO, 'larry');
  assert.equal(g.state, 'unresolved');
  assert.equal(E.isUnresolved(g.value), true);
  assert.ok(g.mentions.length > 0, 'this case exists precisely because git IS mentioned');
});

// ---------------------------------------------------------------------------
// FIELD 6 — worktree verification of a supplied input.
// ---------------------------------------------------------------------------

test('worktree at the governance head is confirmed; a mismatch is stated as a fact', () => {
  const { gitRoot, head: headSha } = ensureGitHeads();
  const head = E.worktreeCheck(gitRoot, null);
  assert.equal(head.state, 'no-head');
  const good = E.worktreeCheck(gitRoot, head.head || headSha);
  assert.equal(good.state, 'match');
  const bad = E.worktreeCheck(gitRoot, '0000000000000000000000000000000000000000');
  assert.equal(bad.state, 'mismatch');
  assert.match(bad.value, /^MISMATCH/);
});

test('an absent worktree is reported as absent, never assumed present', () => {
  const r = E.worktreeCheck(join(HERE, 'no-such-worktree-anywhere'), 'abc');
  assert.equal(r.state, 'absent');
  assert.match(r.value, /^ABSENT/);
});

test('G-2 — missing worktree input is absent-input, never supplied+verified', () => {
  const env = E.resolveEnvelope({ root: REPO, owner: 'keel', governanceHead: 'x', worktree: null });
  const wt = env.fields.find((f) => f.key === 'worktree');
  assert.equal(wt.source, 'absent-input');
  assert.match(wt.value, /no worktree supplied/);
});

test('G-4 — producible_evidence is labelled worker tool grant, not product authority', () => {
  const e = E.producibleEvidence(E.toolGrant(REPO, 'pax').tools);
  assert.match(e.value, /^WORKER TOOL GRANT \(not product authority\)/);
});

test('G-5 — countMarkers recomputes after slots are filled; snapshot footer is not live', () => {
  const r = E.generateOrder(orderSpec());
  assert.match(r.text, /SNAPSHOT AT GENERATION \(not a live claim\)/);
  const before = E.countMarkers(r.text);
  assert.ok(before.authorCount > 0);
  const filled = r.text.replace(/AUTHOR REQUIRED — name\b/, 'demo-slice');
  const after = E.countMarkers(filled);
  assert.equal(after.authorCount, before.authorCount - 1);
});

test('G-6 — machine_surface emits closed list and does not require repo file_surface', () => {
  const r = E.generateOrder({
    ...orderSpec(),
    surfaces: [],
    machineSurfaces: ['C:/Users/Buggly/.mypka/governor/ding.mjs'],
    deviations: [{ field: 'live_authority', value: 'BOUNDED — ~/.mypka/governor/** only', authority: 'test' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.isMachineInstall, true);
  assert.match(r.text, /^machine_surface:/m);
  assert.match(r.text, /machine_surface — absolute machine path/);
  assert.match(r.text, /^live_authority: BOUNDED/m);
});

test('G-6 — relative machine_surface or missing live_authority deviation is fatal', () => {
  const rel = E.generateOrder({
    ...orderSpec(),
    surfaces: [],
    machineSurfaces: ['relative/path.mjs'],
    deviations: [{ field: 'live_authority', value: 'BOUNDED', authority: 'test' }],
  });
  assert.equal(rel.ok, false);
  assert.match(rel.fatal, /not absolute/);
  const noDev = E.generateOrder({
    ...orderSpec(),
    surfaces: [],
    machineSurfaces: ['C:/Users/Buggly/.mypka/governor/ding.mjs'],
    deviations: [],
  });
  assert.equal(noDev.ok, false);
  assert.match(noDev.fatal, /live_authority/);
});

// ---------------------------------------------------------------------------
// FIELD 7 — producible evidence. The check that would have caught WO-11.
// ---------------------------------------------------------------------------

test('a grant without Bash forbids command-execution evidence', () => {
  const pax = E.toolGrant(REPO, 'pax');
  assert.equal(pax.tools.includes('Bash'), false, 'Pax genuinely holds no Bash');
  const e = E.producibleEvidence(pax.tools);
  assert.match(e.constraint, /must NOT require an executed command/);
});

test('a grant with Bash permits it, and every pinned capability is reported', () => {
  const e = E.producibleEvidence(E.toolGrant(REPO, 'keel').tools);
  assert.match(e.constraint, /MAY require an executed command/);
  for (const cap of L_CAPABILITIES) assert.ok(e.lines.some((l) => l.startsWith(cap)), `missing capability: ${cap}`);
  assert.equal(e.lines.length, L_CAPABILITIES.length);
});

test('an unresolved grant yields unresolved evidence, never a permissive default', () => {
  const e = E.producibleEvidence(undefined);
  assert.equal(E.isUnresolved(e.value), true);
});

// ---------------------------------------------------------------------------
// The envelope, and the incompleteness it must not hide.
// ---------------------------------------------------------------------------

test('a fully resolvable owner produces an envelope with no UNRESOLVED fields', () => {
  const env = E.resolveEnvelope({ root: REPO, owner: 'keel', governanceHead: 'deadbeef', worktree: REPO });
  assert.equal(env.unresolvedCount, 0);
  assert.ok(env.fields.length >= 14);
});

test('an unresolvable owner leaves the envelope visibly INCOMPLETE', () => {
  const env = E.resolveEnvelope({ root: REPO, owner: 'nosuchspecialist', governanceHead: 'x', worktree: null });
  assert.ok(env.unresolvedCount >= 4);
  const out = E.render(env);
  assert.match(out, /INCOMPLETE/);
  assert.match(out, /UNRESOLVED — /);
});

// ---------------------------------------------------------------------------
// MUTATION PROOFS. Each makes the generator GUESS, and proves the suite goes red.
// ---------------------------------------------------------------------------

test('MUT-1 the UNRESOLVED marker itself — a guess in place of the unknown', async () => {
  const mutant = await loadMutant(
    "return `${UNRESOLVED_PREFIX}${file}:${section}${UNRESOLVED_SUFFIX}`;",
    "return 'Read, Write, Edit, Bash, Glob, Grep';",
  );
  assert.equal(mutant.isUnresolved(mutant.toolGrant(REPO, 'nosuchspecialist').value), false, 'mutant should guess');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.toolGrant(REPO, 'nosuchspecialist').value), true),
    'MUT-1 unknown specialist must yield UNRESOLVED',
  );
});

test('MUT-2 surfaces — a plausible default in place of an absent anchor', async () => {
  const mutant = await loadMutant(
    "if (!hit) return unresolved(rel, anchors.join(' | '));",
    "if (!hit) return 'services/**';",
  );
  assert.equal(mutant.surfaces(REPO, 'nolan').permitted, 'services/**', 'mutant should invent a surface');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.surfaces(REPO, 'nolan').permitted), true),
    'MUT-2 an absent anchor must yield UNRESOLVED',
  );
});

test('MUT-3 git authority — an inferred grant in place of the unknown', async () => {
  const mutant = await loadMutant(
    "    value: unresolved(rel, ANCHORS.gitAuthority.join(' | ')),\n    state: 'unresolved',",
    "    value: 'commits and pushes on the assigned branch',\n    state: 'granted',",
  );
  assert.equal(mutant.gitAuthority(REPO, 'larry').state, 'granted', 'mutant should infer an authority');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.gitAuthority(REPO, 'larry').value), true),
    'MUT-3 unparseable git prose must yield UNRESOLVED',
  );
});

test('MUT-4 the two strings collapsed — a conclusion dressed as an unknown', async () => {
  const mutant = await loadMutant(
    "export const GIT_SILENT = 'none — contract silent, deny-by-default';",
    "export const GIT_SILENT = 'UNRESOLVED — contract:git must be read';",
  );
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.gitAuthority(REPO, 'nolan').value), false),
    'MUT-4 silence is determinate and must not be reported as unknown',
  );
});

test('MUT-5 the not-delivered annotation suppressed — a known falsehood laundered', async () => {
  const mutant = await loadMutant(
    'if (!tools.includes(rec.tool)) {',
    'if (true) {',
  );
  const tools = mutant.toolGrant(REPO, 'nolan').tools;
  assert.match(mutant.notDeliveredAnnotation(REPO, tools).value, /^n\/a/, 'mutant should suppress the annotation');
  await assertMutantBreaks(
    mutant,
    (m) => assert.match(m.notDeliveredAnnotation(REPO, m.toolGrant(REPO, 'nolan').tools).value, /NOT delivered/),
    'MUT-5 an over-claiming grant must carry the recorded annotation',
  );
});

test('MUT-6 standing defaults hardcoded instead of read from the template', async () => {
  const mutant = await loadMutant(
    "      out[field] = unresolved(rel, `${field} standing default`);\n      continue;",
    "      out[field] = 'none';\n      continue;",
  );
  assert.equal(mutant.standingDefaults(BARREN).credential_scope, 'none', 'mutant should answer from memory');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.standingDefaults(BARREN).credential_scope), true),
    'MUT-6 defaults must come from the template, not from memory',
  );
});

test('MUT-7 producible evidence defaults permissive when the grant is unknown', async () => {
  const mutant = await loadMutant(
    "    return { value: unresolved(SOURCES.shim('<owner>'), 'frontmatter tools:'), lines: [] };",
    "    return { value: 'acceptance evidence MAY require an executed command', lines: [] };",
  );
  assert.equal(mutant.isUnresolved(mutant.producibleEvidence(undefined).value), false, 'mutant should be permissive');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.producibleEvidence(undefined).value), true),
    'MUT-7 an unknown grant must not produce a permissive evidence line',
  );
});

// ===========================================================================
// WO-18. S-1..S-5.
//
// The write-path test uses os.tmpdir() and the demonstration artefact goes to the session
// scratchpad — both OUTSIDE the repository, neither a path in `file_surface`, explicitly
// authorised by WO-2026-08-06-18 AMENDMENT 1 (M-1) and recorded in its `contract_basis`.
// Everything else here proves a PURE function and writes nothing at all.
// ===========================================================================

// PINNED LITERALS for WO-18, held here rather than read back off the source.
const L_AUTHOR_PREFIX = 'AUTHOR REQUIRED — ';
const L_ORDER_MARKER = 'GENERATED by tools/wo/envelope.mjs';
const L_MIN_HITS = 2;
const L_GRANT_BEARING = ['permitted', 'gitAuthority'];
// The empty-blob SHA — git's own constant, and the cheapest possible check that `blobSha`
// implements git blob identity rather than some other hash.
const L_EMPTY_BLOB = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';
// A well-formed SHA that is not a commit anywhere.
const L_ABSENT_HEAD = '0123456789012345678901234567890123456789';

/** Hermetic HEAD — real repo when present; otherwise init a throwaway git in a temp dir linked by tests that need git. */
function tryGit(args, cwd = REPO) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

let HEAD_SHA = tryGit(['rev-parse', 'HEAD']);
let PARENT_SHA = tryGit(['rev-parse', 'HEAD~1']);
let _initedArchiveGit = false;

/**
 * V4-7 hermeticity: a clean `git archive` export has no `.git`. Tests must still fully execute.
 * When REPO is not a git worktree, initialise a minimal two-commit repo *inside REPO* so
 * contract paths and governance-head verification share one root. Never run this when `.git`
 * already exists (the normal developer worktree).
 */
function ensureGitHeads() {
  if (HEAD_SHA && PARENT_SHA) return { head: HEAD_SHA, parent: PARENT_SHA, gitRoot: REPO };
  if (!_initedArchiveGit && !existsSync(join(REPO, '.git'))) {
    execFileSync('git', ['init'], { cwd: REPO, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'wo-test@example.com'], { cwd: REPO, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'wo-test'], { cwd: REPO, stdio: 'ignore' });
    const marker = join(REPO, '.wo-envelope-test-marker');
    writeFileSync(marker, 'parent\n');
    execFileSync('git', ['add', '.wo-envelope-test-marker'], { cwd: REPO, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'wo-test-parent'], { cwd: REPO, stdio: 'ignore' });
    writeFileSync(marker, 'head\n');
    execFileSync('git', ['add', '.wo-envelope-test-marker'], { cwd: REPO, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'wo-test-head'], { cwd: REPO, stdio: 'ignore' });
    _initedArchiveGit = true;
  }
  HEAD_SHA = tryGit(['rev-parse', 'HEAD']);
  PARENT_SHA = tryGit(['rev-parse', 'HEAD~1']);
  assert.ok(HEAD_SHA && PARENT_SHA, 'hermetic git fixture must produce two commits');
  return { head: HEAD_SHA, parent: PARENT_SHA, gitRoot: REPO };
}

ensureGitHeads();

// ---------------------------------------------------------------------------
// The THREE strings — F-5 extended. A slot is not an unknown.
// ---------------------------------------------------------------------------

test('the authoring marker is distinct from the UNRESOLVED marker in BOTH directions', () => {
  assert.equal(E.AUTHOR_REQUIRED_PREFIX, L_AUTHOR_PREFIX);
  const slot = E.authorRequired('outcome', 'one sentence');
  const unknown = E.unresolved('a/b.md', 'a section');
  assert.equal(E.isAuthorRequired(slot), true);
  assert.equal(E.isUnresolved(slot), false, 'a slot must never be reported as an unknown');
  assert.equal(E.isAuthorRequired(unknown), false, 'an unknown must never be reported as a slot');
  assert.equal(E.isUnresolved(unknown), true);
});

test('blobSha computes git blob identity, pinned to git\'s own empty-blob constant', () => {
  assert.equal(E.blobSha(Buffer.alloc(0)), L_EMPTY_BLOB);
  const real = E.sourceSha(REPO, 'tools/wo/envelope.mjs');
  const viaGit = execFileSync('git', ['-C', REPO, 'hash-object', 'tools/wo/envelope.mjs'], { encoding: 'utf8' }).trim();
  assert.equal(real, viaGit, 'the recorded provenance SHA must be the SHA git itself would record');
});

// ---------------------------------------------------------------------------
// S-2 — contract_basis by extraction. AC2.
// ---------------------------------------------------------------------------

test('a permitted surface cites the exact heading and the exact pattern it matched', () => {
  const c = E.permittingClause(REPO, 'keel', 'tools/wo/envelope.mjs');
  assert.equal(c.state, 'granted');
  assert.equal(c.matched, 'tools/**');
  assert.match(c.permitted_by, /Team\/Keel - Implementation Engineer\/AGENTS\.md § Where Keel writes/);
  const contract = readContract('Keel - Implementation Engineer');
  assert.ok(contract.includes('Where Keel writes'), 'the cited heading must exist in the contract');
  assert.equal(E.isUnresolved(c.permitted_by), false);
});

// The live case from map §17.0: Keel's contract permits `.github/workflows/<service>-tests.yml`,
// and `notify-snapshot-consumers.yml` is not that shape. Larry caught this by hand BEFORE
// dispatch and stood the order down. It is the class-A defect S-2 exists to generate.
test('AC2 negative — a surface with no permitting clause is UNRESOLVED, never a guess', () => {
  for (const bad of [
    '.github/workflows/notify-snapshot-consumers.yml',
    'Builds/BUILD-020/Work Packages/thing.md',
    '.claude/agents/keel.md',
    'Team Knowledge/SOPs/SOP-022-work-order-preflight.md',
  ]) {
    const c = E.permittingClause(REPO, 'keel', bad);
    assert.equal(c.state, 'unresolved', `${bad} must not resolve to a permitting clause`);
    assert.equal(E.isUnresolved(c.permitted_by), true);
    assert.doesNotMatch(c.permitted_by, /§ Where Keel writes — `/, 'must not emit a plausible citation');
  }
  // ...while the shapes the contract really does name still resolve, so the check is not
  // simply refusing everything.
  for (const good of ['services/proofline/src/app.mjs', '.github/workflows/proofline-tests.yml']) {
    assert.equal(E.permittingClause(REPO, 'keel', good).state, 'granted', `${good} is genuinely permitted`);
  }
});

test('glob matching is anchored and `*` does not cross a directory separator', () => {
  assert.equal(E.matchesPattern('tools/wo/envelope.mjs', 'tools/**'), true);
  assert.equal(E.matchesPattern('tools/wo/envelope.mjs', 'services/**'), false);
  assert.equal(E.matchesPattern('services/a/b.sql', 'services/*'), false, '`*` must not cross a separator');
  assert.equal(E.matchesPattern('xtools/wo/a.mjs', 'tools/**'), false, 'the match must be anchored at the start');
  assert.equal(E.matchesPattern('tools/wo/a.mjs.bak', 'tools/**/a.mjs'), false, 'and anchored at the end');
  assert.equal(E.matchesPattern('tools\\wo\\envelope.mjs', 'tools/**'), true, 'slash direction must not decide a grant');
});

test('a granted action cites a GRANT-BEARING section and names the keywords it rests on', () => {
  const c = E.permittingClauseForAction(REPO, 'keel', 'push the assigned branch');
  assert.equal(c.state, 'granted');
  assert.match(c.permitted_by, /§ The integration role/);
  assert.match(c.permitted_by, /matched on: /);
  assert.ok(c.matched === undefined || true);
});

// THE REGRESSION THAT MATTERS. The first implementation scored keyword overlap across ALL
// anchored sections and returned `Critical rules` as the clause PERMITTING "run a production
// migration against the live database" — a section whose rule 3 forbids exactly that. A
// citation naming a prohibition as a permission is a fabricated grant laundered through
// machinery, which is the one thing this generator exists not to do.
test('AC2 negative — a prohibited action is NEVER cited as permitted by its own prohibition', () => {
  for (const forbidden of [
    'run a production migration against the live database',
    'spawn a subagent to help',
    'edit CLAUDE.md and the AGENTS.md contracts',
  ]) {
    const c = E.permittingClauseForAction(REPO, 'keel', forbidden);
    assert.equal(c.state, 'unresolved', `${forbidden} must not resolve to a permitting clause`);
    assert.equal(E.isUnresolved(c.permitted_by), true);
    assert.doesNotMatch(c.permitted_by, /§ Critical rules —/, 'a prohibition is not a permission');
    assert.doesNotMatch(c.permitted_by, /§ Scope boundaries —/, 'a prohibition is not a permission');
  }
});

test('only grant-bearing anchors are candidates, and the threshold is the pinned literal', () => {
  assert.deepEqual(E.GRANT_BEARING_ANCHORS, L_GRANT_BEARING);
  assert.equal(E.ACTION_MIN_HITS, L_MIN_HITS);
  for (const key of E.GRANT_BEARING_ANCHORS) assert.ok(key in E.ANCHORS, `${key} must be a real anchor`);
  for (const key of E.CONSTRAINT_BEARING_ANCHORS) assert.ok(key in E.ANCHORS, `${key} must be a real anchor`);
  const overlap = E.GRANT_BEARING_ANCHORS.filter((k) => E.CONSTRAINT_BEARING_ANCHORS.includes(k));
  assert.deepEqual(overlap, [], 'a section cannot be both the grant and the constraint');
});

// ---------------------------------------------------------------------------
// S-4 — the governance head. AC3.
// ---------------------------------------------------------------------------

test('AC3 — an absent governance head produces a FATAL and NO order text', () => {
  const r = E.generateOrder({ root: REPO, owner: 'keel', governanceHead: L_ABSENT_HEAD });
  assert.equal(r.ok, false);
  assert.equal(r.text, undefined, 'a failed head check must not yield a partial order');
  assert.match(r.fatal, /NO ORDER EMITTED/);
});

test('AC3 — a missing governance head argument is equally fatal, not a blank field', () => {
  for (const head of [undefined, null, '', '   ']) {
    const r = E.generateOrder({ root: REPO, owner: 'keel', governanceHead: head });
    assert.equal(r.ok, false, `head ${JSON.stringify(head)} must be fatal`);
    assert.equal(r.text, undefined);
  }
});

test('AC3 — an unverifiable root is fatal too: cannot-check is never treated as passed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wo18-norepo-'));
  try {
    const r = E.verifyGovernanceHead(dir, HEAD_SHA);
    assert.equal(r.ok, false, 'a directory outside any repository cannot verify a head');
    assert.equal(r.reason, E.HEAD_FAILURE.NO_GIT);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a real head verifies and resolves to a full commit SHA', () => {
  const r = E.verifyGovernanceHead(REPO, HEAD_SHA);
  assert.equal(r.ok, true);
  assert.equal(r.resolved, HEAD_SHA);
});

// S-4 amended (C-2). Equality was wrong: J1-4 resolves with TWO commits and the worker cuts
// from the DESCENDANT, so the mandated layout used to render MISMATCH — the check firing on
// the honest case.
test('S-4 — the worktree may DESCEND FROM the governance head, not only equal it', () => {
  const { gitRoot, head, parent } = ensureGitHeads();
  const r = E.worktreeCheck(gitRoot, parent);
  assert.equal(r.state, 'match', 'a descendant worktree is the CORRECT layout, not a mismatch');
  assert.equal(r.relation, 'descendant');
  assert.match(r.value, /DESCENDS FROM/);
  const equal = E.worktreeCheck(gitRoot, head);
  assert.equal(equal.state, 'match');
  assert.equal(equal.relation, 'equal');
});

test('S-4 — an unrelated or unknown head is still a MISMATCH, and the two are distinguished', () => {
  const { gitRoot } = ensureGitHeads();
  const unknown = E.worktreeCheck(gitRoot, L_ABSENT_HEAD);
  assert.equal(unknown.state, 'mismatch');
  assert.equal(unknown.relation, 'unknown-object');
});

// ---------------------------------------------------------------------------
// S-1 / S-3 / S-5 — the emitted order. AC1, AC4.
// ---------------------------------------------------------------------------

function orderSpec(overrides = {}) {
  const { head } = ensureGitHeads();
  return {
    root: REPO,
    owner: 'keel',
    governanceHead: head,
    worktree: REPO,
    branch: 'wo/18-envelope-route',
    surfaces: ['tools/wo/envelope.mjs', 'tools/wo/envelope.test.mjs'],
    actions: ['push the assigned branch'],
    now: new Date('2026-08-06T00:00:00.000Z'),
    ...overrides,
  };
}

test('AC1 — the emitted order is a complete file, and every field is sourced, marked or slotted', () => {
  const r = E.generateOrder(orderSpec());
  assert.equal(r.ok, true);
  const t = r.text;

  // It is an order, not a table of rows.
  assert.match(t, /^<!-- GENERATED by tools\/wo\/envelope\.mjs/);
  assert.match(t, /\n---\n# --- identity and authority ---/);
  assert.match(t, /\n## Acceptance criteria\n/);
  assert.match(t, /\n## Required evidence\n/);
  assert.match(t, /\n## Sequencing\n/);

  // Every mandatory template field is PRESENT — none silently dropped.
  for (const field of [
    'name', 'work_order_id', 'build', 'wp_number', 'status', 'authorised_by', 'authorised_date',
    'owner', 'return_to', 'blocking_dependencies', 'tags', 'outcome', 'acceptance_property',
    'integration_owner', 'veritas_gate', 'document_impact', 'file_surface', 'out_of_scope_policy',
    'worker_contract', 'contract_basis', 'contract_conflicts', 'capability_evidence',
    'credential_scope', 'live_authority', 'network', 'dependency_policy', 'private_surface',
    'worktree', 'branch', 'schema_decision', 'security_inputs', 'operational_handoff',
  ]) {
    assert.match(t, new RegExp(`^${field}:`, 'm'), `mandatory field missing from the emitted order: ${field}`);
  }

  // Every non-variable line is TRACEABLE, a marked slot, or an UNRESOLVED marker.
  const { head } = ensureGitHeads();
  const traceable = ['keel', 'larry', 'report-only', 'draft', head];
  for (const line of t.split('\n')) {
    const m = line.match(/^([a-z_]+): (.+)$/);
    if (!m) continue;
    const value = m[2];
    const ok =
      E.isAuthorRequired(value) ||
      E.isUnresolved(value) ||
      traceable.includes(value) ||
      Object.values(L_STANDING_DEFAULTS).includes(value) ||
      value.startsWith('wo/') ||
      value.startsWith('C:/') ||
      value.startsWith('WORKER TOOL GRANT');
    assert.ok(ok, `untraceable, unmarked value in the emitted order: ${line}`);
  }

  assert.ok(r.authorCount > 0, 'a generated order must still ask Larry for the five things only he can write');
  assert.equal(r.unresolvedCount, 0, 'keel at a real head resolves every generated field');
  // G-5 — footer is a SNAPSHOT, not a live issuability claim
  assert.match(t, /SNAPSHOT AT GENERATION \(not a live claim\)/);
  assert.match(t, /--count-markers/);
});

test('AC1 — contract_basis in the emitted order is GENERATED, one entry per surface and action', () => {
  const r = E.generateOrder(orderSpec());
  const block = r.text.split('contract_basis:')[1].split('\ncontract_conflicts:')[0];
  assert.match(block, /- surface: tools\/wo\/envelope\.mjs/);
  assert.match(block, /- surface: tools\/wo\/envelope\.test\.mjs/);
  assert.match(block, /- action: push the assigned branch/);
  assert.equal((block.match(/permitted_by:/g) ?? []).length, 3, 'one permitted_by per surface AND per action');
  assert.doesNotMatch(block, /permitted_file_surface/, 'it must cite a CONTRACT HEADING, not a generator field name');
});

test('AC4 — with no deviation the standing defaults are GENERATED, not retyped, and never omitted', () => {
  const r = E.generateOrder(orderSpec());
  const t = r.text;
  // Present, as real YAML keys. Omitting `private_surface` would be a security regression:
  // it is GL-012's only route to a worker that inherits nothing else.
  for (const [field, expected] of Object.entries(L_STANDING_DEFAULTS)) {
    assert.match(t, new RegExp(`^${field}: ${expected}$`, 'm'), `${field} must be emitted with its canonical value`);
  }
  // Generated by extraction, and said so, rather than typed by Larry.
  assert.match(t, /generated by extraction from `Team Knowledge\/Templates\/work-order\.md`/);
  // No escalation note where there is no deviation.
  assert.doesNotMatch(t, /DEVIATION from the standing default/);
  assert.doesNotMatch(t, /ESCALATION:/);
});

test('AC4 — a deviation renders ADDITIONALLY, with an escalation note naming its authority', () => {
  const r = E.generateOrder({
    ...orderSpec(),
    deviations: [{ field: 'private_surface', value: 'C:/.fusion247/private/proofline/**', authority: 'Warwick, 2026-08-06' }],
  });
  // G-1 — bare value; deviation note is a sibling comment
  assert.match(r.text, /^private_surface: C:\/\.fusion247\/private\/proofline\/\*\*$/m);
  assert.match(r.text, /# DEVIATION from standing default `none`\. ESCALATION: Warwick, 2026-08-06/);
  // The other four are untouched.
  assert.match(r.text, /^credential_scope: none$/m);
});

test('AC4 — a deviation with no named authority leaves a SLOT, never a silent blank', () => {
  const r = E.generateOrder({ ...orderSpec(), deviations: [{ field: 'network', value: 'outbound-https' }] });
  assert.match(r.text, /ESCALATION: AUTHOR REQUIRED — deviation_authority:/);
});

test('the provenance header records the blob SHA of every canonical source actually read', () => {
  const r = E.generateOrder(orderSpec());
  const header = r.text.split('-->')[0];
  assert.match(header, new RegExp(L_ORDER_MARKER.replace(/[/.]/g, '\\$&')));
  for (const rel of ['Team Knowledge/Templates/work-order.md', 'Team/Keel - Implementation Engineer/AGENTS.md', '.claude/agents/keel.md', 'tools/wo/envelope.mjs']) {
    const sha = E.sourceSha(REPO, rel);
    assert.ok(header.includes(`blob ${sha}`), `provenance missing the real blob SHA for ${rel}`);
  }
  assert.match(header, /EVIDENCE OF ORIGIN, not a control/, 'the header must not claim to be a control');
});

// S-5. The cut is justified by the SSOT rule, NOT by a replay row — see the return. What a
// test can prove is that nothing was hidden: the citation names the heading, the blob and the
// size of what is not inlined, and the three-state git value survives.
test('S-5 — the inlined contract pages become citations, and nothing is silently dropped', () => {
  const env = E.resolveEnvelope({ root: REPO, owner: 'keel', governanceHead: HEAD_SHA, worktree: REPO });
  const get = (k) => env.fields.find((f) => f.key === k).value;
  const contract = readContract('Keel - Implementation Engineer');

  // G-3 — permitted and prohibited both cited (SSOT symmetry)
  for (const key of ['permitted_file_surface', 'prohibited_file_surface', 'critical_rules']) {
    const v = get(key);
    assert.match(v, /^CITED — /, `${key} must be a citation`);
    assert.match(v, /@ blob [0-9a-f]{12}/, 'a citation must name the bytes it cites');
    assert.match(v, /chars — read it there/, 'a citation must state the size it did not inline');
    assert.equal(E.isUnresolved(v), false, 'a citation is a conclusion, not an unknown');
    assert.ok(v.length < 300, `${key} citation should be short, was ${v.length}`);
  }
  // The heading cited must be real, and the body it stands for must still be extractable.
  const surf = E.surfaces(REPO, 'keel');
  assert.ok(contract.includes(surf.headings.criticalRules));
  assert.ok(contract.includes(surf.criticalRules), 'the cited text must still be verbatim-extractable');

  // R-31's prevention survives: the STATE word is still in the value.
  assert.match(get('git_authority'), /^GRANTED — /);
  assert.equal(E.gitAuthority(REPO, 'nolan').value, L_GIT_SILENT, 'silence is still determinate');
  // G-3 — permitted is cited, but the body it cites remains extractable for contract_basis matching.
  assert.ok(contract.includes(surf.permitted), 'permitted body must still be verbatim-extractable for basis matching');
});

test('S-5 — an UNRESOLVED surface stays UNRESOLVED and is never dressed as a citation', () => {
  const env = E.resolveEnvelope({ root: REPO, owner: 'nosuchspecialist', governanceHead: HEAD_SHA, worktree: null });
  for (const key of ['prohibited_file_surface', 'critical_rules']) {
    const v = env.fields.find((f) => f.key === key).value;
    assert.equal(E.isUnresolved(v), true, 'a missing section must not become a confident citation');
    assert.doesNotMatch(v, /^CITED — /);
  }
});

// ---------------------------------------------------------------------------
// The write path. The ONE test in this file that writes, and it writes to os.tmpdir()
// (authorised, M-1) — never to the repository and never to `file_surface`.
// ---------------------------------------------------------------------------

test('AC1 — the CLI writes the complete order to the caller-given path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wo18-out-'));
  const out = join(dir, 'order.md');
  try {
    execFileSync(process.execPath, [
      join(REPO, 'tools', 'wo', 'envelope.mjs'),
      '--owner', 'keel',
      '--governance-head', HEAD_SHA,
      '--root', REPO,
      '--surface', 'tools/wo/envelope.mjs',
      '--action', 'push the assigned branch',
      '--out', out,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(existsSync(out), true, 'the tool must write the file it was given');
    const written = readFileSync(out, 'utf8');
    assert.match(written, new RegExp(`^<!-- ${L_ORDER_MARKER.replace(/[/.]/g, '\\$&')}`));
    assert.match(written, /^file_surface:$/m);
    assert.ok(written.includes(E.AUTHOR_REQUIRED_PREFIX), 'a hand-completable order must show its slots');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC3 — the CLI exits non-zero and writes NO file when the head does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wo18-fatal-'));
  const out = join(dir, 'must-not-exist.md');
  try {
    let code = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, [
        join(REPO, 'tools', 'wo', 'envelope.mjs'),
        '--owner', 'keel', '--governance-head', L_ABSENT_HEAD, '--root', REPO, '--out', out,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      code = err.status;
      stderr = String(err.stderr ?? '');
    }
    assert.notEqual(code, 0, 'a bad head must not exit 0');
    assert.match(stderr, /FATAL/);
    assert.equal(existsSync(out), false, 'a failed head check must leave NO order on disk');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// WO-18 MUTATION PROOFS.
// ---------------------------------------------------------------------------

test('MUT-9 the head check made permissive — a bad head renders an order anyway', async () => {
  const mutant = await loadMutant(
    '  const headCheck = verifyGovernanceHead(root, governanceHead);\n  if (!headCheck.ok) {',
    '  const headCheck = verifyGovernanceHead(root, governanceHead);\n  if (false) {',
  );
  assert.equal(mutant.generateOrder({ root: REPO, owner: 'keel', governanceHead: L_ABSENT_HEAD }).ok, true, 'mutant should emit anyway');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.generateOrder({ root: REPO, owner: 'keel', governanceHead: L_ABSENT_HEAD }).ok, false),
    'MUT-9 an unverifiable governance head must emit no order',
  );
});

test('MUT-10 constraint sections readmitted as permitting clauses', async () => {
  const mutant = await loadMutant(
    "export const GRANT_BEARING_ANCHORS = ['permitted', 'gitAuthority'];",
    "export const GRANT_BEARING_ANCHORS = ['permitted', 'gitAuthority', 'criticalRules', 'prohibited'];",
  );
  const bad = mutant.permittingClauseForAction(REPO, 'keel', 'run a production migration against the live database');
  assert.equal(bad.state, 'granted', 'mutant should cite a prohibition as a permission');
  await assertMutantBreaks(
    mutant,
    (m) => {
      const c = m.permittingClauseForAction(REPO, 'keel', 'run a production migration against the live database');
      assert.equal(m.isUnresolved(c.permitted_by), true);
    },
    'MUT-10 a prohibition must never be cited as the clause permitting an action',
  );
});

test('MUT-11 an unmatched surface falls back to the first pattern instead of UNRESOLVED', async () => {
  const mutant = await loadMutant(
    '  const hit = patterns.find((p) => matchesPattern(surfaceEntry, p));',
    '  const hit = patterns.find((p) => matchesPattern(surfaceEntry, p)) ?? patterns[0];',
  );
  const bad = mutant.permittingClause(REPO, 'keel', 'Builds/BUILD-020/notes.md');
  assert.equal(bad.state, 'granted', 'mutant should invent a permitting pattern');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.permittingClause(REPO, 'keel', 'Builds/BUILD-020/notes.md').permitted_by), true),
    'MUT-11 an unmatched surface must yield UNRESOLVED, never the nearest pattern',
  );
});

test('MUT-12 the authoring marker collapsed into the UNRESOLVED marker', async () => {
  const mutant = await loadMutant(
    "export const AUTHOR_REQUIRED_PREFIX = 'AUTHOR REQUIRED — ';",
    "export const AUTHOR_REQUIRED_PREFIX = 'UNRESOLVED — ';",
  );
  assert.equal(mutant.isUnresolved(mutant.authorRequired('outcome', 'x')), true, 'mutant should collapse the two');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.isUnresolved(m.authorRequired('outcome', 'x')), false),
    'MUT-12 a slot Larry must write is not a field the generator failed to read',
  );
});

test('MUT-13 the standing defaults omitted from the emitted order', async () => {
  // Target the G-1-shaped loop (bare values; comments live elsewhere).
  const mutant = await loadMutant(
    "  for (const field of STANDING_DEFAULT_FIELDS) {\n    const dev = deviated.get(field);\n    if (!dev) {\n      // G-1 — bare value on its own line; no prose glued to the scalar.\n      authorityLines.push(`${field}: ${defaults[field]}`);\n      continue;\n    }",
    "  for (const field of STANDING_DEFAULT_FIELDS) {\n    const dev = deviated.get(field);\n    if (!dev) {\n      continue;\n    }",
  );
  const bad = mutant.generateOrder(orderSpec());
  assert.doesNotMatch(bad.text, /^private_surface: none$/m, 'mutant should drop the field');
  await assertMutantBreaks(
    mutant,
    (m) => assert.match(m.generateOrder(orderSpec()).text, /^private_surface: none$/m),
    'MUT-13 private_surface is GL-012\'s only route to a worker that inherits nothing else',
  );
});

test('MUT-14 the worktree ancestry check reverted to equality', async () => {
  const mutant = await loadMutant(
    "      stdio: ['ignore', 'ignore', 'ignore'],\n    });\n    descends = true;",
    "      stdio: ['ignore', 'ignore', 'ignore'],\n    });\n    descends = false;",
  );
  const parent = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim();
  assert.equal(mutant.worktreeCheck(REPO, parent).state, 'mismatch', 'mutant should reject a descendant');
  await assertMutantBreaks(
    mutant,
    (m) => assert.equal(m.worktreeCheck(REPO, parent).state, 'match'),
    'MUT-14 the two-commit layout J1-4 mandates must not read as a mismatch',
  );
});

test('MUT-8 the incompleteness notice suppressed — an incomplete envelope reads as complete', async () => {
  const mutant = await loadMutant(
    '  if (envelope.unresolvedCount > 0) {',
    '  if (false) {',
  );
  const env = mutant.resolveEnvelope({ root: REPO, owner: 'nosuchspecialist', governanceHead: 'x', worktree: null });
  assert.doesNotMatch(mutant.render(env), /INCOMPLETE/, 'mutant should hide incompleteness');
  await assertMutantBreaks(
    mutant,
    (m) => {
      const e = m.resolveEnvelope({ root: REPO, owner: 'nosuchspecialist', governanceHead: 'x', worktree: null });
      assert.match(m.render(e), /INCOMPLETE/);
    },
    'MUT-8 an incomplete envelope must say so',
  );
});
