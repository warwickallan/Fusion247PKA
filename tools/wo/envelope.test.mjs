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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  const head = E.worktreeCheck(REPO, null);
  assert.equal(head.state, 'no-head');
  const good = E.worktreeCheck(REPO, head.head);
  assert.equal(good.state, 'match');
  const bad = E.worktreeCheck(REPO, '0000000000000000000000000000000000000000');
  assert.equal(bad.state, 'mismatch');
  assert.match(bad.value, /^MISMATCH/);
});

test('an absent worktree is reported as absent, never assumed present', () => {
  const r = E.worktreeCheck(join(HERE, 'no-such-worktree-anywhere'), 'abc');
  assert.equal(r.state, 'absent');
  assert.match(r.value, /^ABSENT/);
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
