import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHECK,
  CHECK_IDS,
  assessMergeReadiness,
  renderReadiness,
} from './merge-readiness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const SRC_PATH = join(__dirname, 'merge-readiness.mjs');

// ---------------------------------------------------------------------------
// Signal builders. `readySignals()` is the POSITIVE CONTROL: without it, five
// negatives proving "each null signal blocks" would also pass against a function
// that returned ready:false unconditionally.
// ---------------------------------------------------------------------------

function resolvedState() {
  const state = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  // The fixture deliberately carries an unresolved frontier and a blocked ticket
  // (it is the base for OTHER mutation tests). A merge-ready programme has neither.
  state.tickets = state.tickets.map((t) => ({
    ...t,
    state: 'resolved',
    resolved: '2026-01-02',
    evidence: [`evidence/${t.id}.md`],
  }));
  state.unknown = [];
  return state;
}

// A verdictStatus()-SHAPED literal. qa-binding.mjs is owned by another worker and is
// deliberately never imported here: this module is contracted to the SHAPE, and a
// test that imports the real producer would stop proving this consumer in isolation.
function currentApprovedQa() {
  return {
    headKnown: true,
    head: 'a'.repeat(40),
    reviewers: [
      { reviewer: 'codex', binding: 'current', verdict: 'approve', sha: 'a'.repeat(40), at: '2026-01-02', detail: null },
      { reviewer: 'fable', binding: 'current', verdict: 'approve', sha: 'a'.repeat(40), at: '2026-01-02', detail: null },
    ],
    allCurrentApproved: true,
    superseded: [],
    checked: 2,
  };
}

function readySignals() {
  return {
    state: resolvedState(),
    git: {
      clean: true,
      headSha: 'b'.repeat(40),
      remoteHeadSha: 'b'.repeat(40),
    },
    suite: { executed: true, total: 223, failed: 0 },
    qa: currentApprovedQa(),
  };
}

function checkById(readiness, id) {
  const c = readiness.checks.find((x) => x.id === id);
  assert.ok(c, `expected a check with id ${id}`);
  return c;
}

// ---------------------------------------------------------------------------
// POSITIVE CONTROL — five negatives prove nothing without this one
// ---------------------------------------------------------------------------

test('POSITIVE CONTROL: all five signals passing yields ready === true', () => {
  const r = assessMergeReadiness(readySignals());
  assert.equal(r.ready, true, `expected ready, blocking: ${JSON.stringify(r.blocking)}`);
  assert.deepEqual(r.blocking, []);
  for (const c of r.checks) assert.equal(c.status, CHECK.PASS, `${c.id} should PASS: ${c.detail}`);
});

test('POSITIVE CONTROL: `checked` counts things actually examined, not a constant 5 (INV-5)', () => {
  const signals = readySignals();
  const r = assessMergeReadiness(signals);
  assert.ok(r.checked > 0, 'checked must be non-zero');
  // 5 checks + one per ticket examined.
  assert.equal(r.checked, CHECK_IDS.length + signals.state.tickets.length);

  // MUTATION on the counter itself: add tickets, the count must move. A `checked`
  // that does not scale with real scope is a number that proves nothing.
  const bigger = readySignals();
  bigger.state.tickets.push({
    id: 'T-99', title: 'Another', state: 'resolved', model: 'Sonnet',
    depends_on: [], resolved: '2026-01-02', evidence: ['evidence/T-99.md'], note: null,
  });
  assert.equal(assessMergeReadiness(bigger).checked, r.checked + 1);
});

// ---------------------------------------------------------------------------
// FAILS CLOSED — each of the five signals nulled in turn
// ---------------------------------------------------------------------------

const NULL_MUTATIONS = [
  ['tickets-resolved-with-evidence', (s) => { s.state.tickets = null; }],
  ['suite-green', (s) => { s.suite = null; }],
  ['tree-clean', (s) => { s.git.clean = null; }],
  ['head-pushed', (s) => { s.git.remoteHeadSha = null; }],
  ['independent-review', (s) => { s.qa = null; }],
];

for (const [id, mutate] of NULL_MUTATIONS) {
  test(`MUTATION: a null signal makes ${id} UNKNOWN and the programme NOT ready`, () => {
    const signals = readySignals();
    mutate(signals);
    const r = assessMergeReadiness(signals);

    assert.equal(checkById(r, id).status, CHECK.UNKNOWN, `${id}: ${checkById(r, id).detail}`);
    assert.equal(r.ready, false, 'an UNKNOWN check must block exactly as a FAIL does');
    assert.ok(r.blocking.some((c) => c.id === id), `${id} must appear in blocking`);
    assert.ok(r.checked > 0, 'must still report a non-zero examined count');

    // Only the mutated check moved — otherwise a single null could be blocking for
    // an unrelated reason and this test would prove nothing about that signal.
    for (const other of r.checks.filter((c) => c.id !== id)) {
      assert.equal(other.status, CHECK.PASS, `${other.id} should be unaffected: ${other.detail}`);
    }
  });
}

test('null is never zero: a null head and a null remote head do not compare equal', () => {
  const signals = readySignals();
  signals.git.headSha = null;
  signals.git.remoteHeadSha = null;
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'head-pushed').status, CHECK.UNKNOWN);
  assert.equal(r.ready, false);
});

test('an entirely absent signal bundle blocks every check it feeds', () => {
  const r = assessMergeReadiness({});
  assert.equal(r.ready, false);
  assert.equal(r.blocking.length, CHECK_IDS.length);
  for (const c of r.checks) assert.notEqual(c.status, CHECK.PASS);
});

// ---------------------------------------------------------------------------
// suite-green — the zero-count green
// ---------------------------------------------------------------------------

test('MUTATION: a suite of ZERO tests reporting zero failures is NOT green', () => {
  const signals = readySignals();
  signals.suite = { executed: true, total: 0, failed: 0 };
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'suite-green');
  assert.equal(c.status, CHECK.FAIL, 'zero tests, zero failures must FAIL, not pass and not unknown');
  assert.match(c.detail, /never.?ran|zero/i);
  assert.equal(r.ready, false);
});

test('MUTATION: a suite that did not execute is NOT green even with a test count', () => {
  const signals = readySignals();
  signals.suite = { executed: false, total: 223, failed: 0 };
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'suite-green').status, CHECK.FAIL);
  assert.equal(r.ready, false);
});

test('MUTATION: failures in the suite FAIL the check and name the count', () => {
  const signals = readySignals();
  signals.suite = { executed: true, total: 223, failed: 3 };
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'suite-green');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, /3 of 223/);
});

test('a suite with an unreported total or failure count is UNKNOWN, not zero', () => {
  for (const suite of [
    { executed: true, total: null, failed: 0 },
    { executed: true, total: 5, failed: null },
    { total: 5, failed: 0 },
  ]) {
    const signals = readySignals();
    signals.suite = suite;
    const r = assessMergeReadiness(signals);
    assert.equal(checkById(r, 'suite-green').status, CHECK.UNKNOWN, JSON.stringify(suite));
    assert.equal(r.ready, false);
  }
});

// ---------------------------------------------------------------------------
// tickets-resolved-with-evidence
// ---------------------------------------------------------------------------

test('MUTATION: a ticket resolved with EMPTY evidence FAILs, and the detail names it', () => {
  const signals = readySignals();
  signals.state.tickets[1].evidence = [];
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'tickets-resolved-with-evidence');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, new RegExp(signals.state.tickets[1].id));
  assert.match(c.detail, /NO evidence/);
  assert.equal(r.ready, false);
});

test('MUTATION: a ticket resolved with NO evidence key at all FAILs', () => {
  const signals = readySignals();
  delete signals.state.tickets[0].evidence;
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'tickets-resolved-with-evidence').status, CHECK.FAIL);
});

test('MUTATION: any unresolved ticket FAILs, and the detail names it and its state', () => {
  const signals = readySignals();
  signals.state.tickets[2].state = 'frontier';
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'tickets-resolved-with-evidence');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, new RegExp(`${signals.state.tickets[2].id} \\[frontier\\]`));
});

test('MUTATION: an EMPTY ticket list is not "every ticket resolved" — the zero-count green again', () => {
  const signals = readySignals();
  signals.state.tickets = [];
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'tickets-resolved-with-evidence');
  assert.notEqual(c.status, CHECK.PASS, 'a verdict over zero tickets must never be a pass');
  assert.equal(c.status, CHECK.FAIL);
  assert.equal(r.ready, false);
});

test('tickets declared in the banked state\'s `unknown` list read UNKNOWN, never complete', () => {
  const signals = readySignals();
  signals.state.unknown = [{ path: 'tickets', why: 'the collection was not gathered during this banking' }];
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'tickets-resolved-with-evidence');
  assert.equal(c.status, CHECK.UNKNOWN);
  assert.match(c.detail, /not gathered/);
  assert.equal(r.ready, false);
});

// ---------------------------------------------------------------------------
// tree-clean and head-pushed
// ---------------------------------------------------------------------------

test('MUTATION: a dirty tree FAILs; an undeterminable tree is UNKNOWN — the two are distinct', () => {
  const dirty = readySignals();
  dirty.git.clean = false;
  assert.equal(checkById(assessMergeReadiness(dirty), 'tree-clean').status, CHECK.FAIL);

  const undetermined = readySignals();
  delete undetermined.git.clean;
  assert.equal(checkById(assessMergeReadiness(undetermined), 'tree-clean').status, CHECK.UNKNOWN);
});

test('MUTATION: a local head ahead of the remote-tracking head FAILs', () => {
  const signals = readySignals();
  signals.git.headSha = 'c'.repeat(40);
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'head-pushed');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, /ccccccc/);
  assert.match(c.detail, /bbbbbbb/);
});

test('head-pushed states honestly WHAT it compared — it never implies the remote was contacted', () => {
  const r = assessMergeReadiness(readySignals());
  const c = checkById(r, 'head-pushed');
  assert.equal(c.status, CHECK.PASS);
  assert.match(c.detail, /remote-tracking ref/);
  assert.match(c.detail, /does not itself contact the remote/);
});

test('the literal string "unknown" in a sha field is treated as unknown, not as a value', () => {
  const signals = readySignals();
  signals.git.headSha = 'unknown';
  signals.git.remoteHeadSha = 'unknown';
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'head-pushed').status, CHECK.UNKNOWN,
    'two "unknown" strings must not compare equal into a PASS');
});

// ---------------------------------------------------------------------------
// independent-review — the vacuous-approval hole, closed on the consumer side
// ---------------------------------------------------------------------------

test('MUTATION: a review claiming approval while having examined ZERO verdicts does NOT pass', () => {
  const signals = readySignals();
  signals.qa = {
    headKnown: true,
    head: 'a'.repeat(40),
    reviewers: [],
    allCurrentApproved: true, // the vacuous true
    superseded: [],
    checked: 0,               // over nothing at all
  };
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'independent-review');
  assert.notEqual(c.status, CHECK.PASS, 'a clean bill from an empty scan must never pass');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, /ZERO verdicts/);
  assert.equal(r.ready, false);
});

test('POSITIVE CONTROL for the above: the same shape with checked > 0 DOES pass', () => {
  const signals = readySignals();
  assert.equal(signals.qa.checked, 2);
  assert.equal(checkById(assessMergeReadiness(signals), 'independent-review').status, CHECK.PASS);
});

test('MUTATION: not-all-approved FAILs and names the non-current reviewers', () => {
  const signals = readySignals();
  signals.qa.allCurrentApproved = false;
  signals.qa.reviewers[1] = { reviewer: 'fable', binding: 'superseded', verdict: 'approve', sha: 'd'.repeat(40), at: '2026-01-01', detail: null };
  signals.qa.superseded = [{ reviewer: 'fable', sha: 'd'.repeat(40) }];
  const r = assessMergeReadiness(signals);
  const c = checkById(r, 'independent-review');
  assert.equal(c.status, CHECK.FAIL);
  assert.match(c.detail, /fable: superseded/);
  assert.match(c.detail, /does not carry forward/);
});

test('MUTATION: an unknown head is never "the reviewed head"', () => {
  const signals = readySignals();
  signals.qa.headKnown = false;
  signals.qa.head = null;
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'independent-review').status, CHECK.UNKNOWN);
  assert.equal(r.ready, false);
});

test('a review status that does not report how much it examined is UNKNOWN', () => {
  const signals = readySignals();
  delete signals.qa.checked;
  const r = assessMergeReadiness(signals);
  assert.equal(checkById(r, 'independent-review').status, CHECK.UNKNOWN);
});

// ---------------------------------------------------------------------------
// Contract shape — exactly five checks, no sixth
// ---------------------------------------------------------------------------

test('CONTRACT: exactly the five frozen check ids, in order, no sixth', () => {
  assert.deepEqual(CHECK_IDS, [
    'tickets-resolved-with-evidence',
    'suite-green',
    'tree-clean',
    'head-pushed',
    'independent-review',
  ]);
  const r = assessMergeReadiness(readySignals());
  assert.deepEqual(r.checks.map((c) => c.id), CHECK_IDS);
  assert.equal(r.checks.length, 5);
  for (const c of r.checks) {
    assert.ok(typeof c.title === 'string' && c.title.length > 0, `${c.id} needs a title`);
    assert.ok(typeof c.detail === 'string' && c.detail.length > 0, `${c.id} needs a detail`);
    assert.ok(Object.values(CHECK).includes(c.status), `${c.id} status must be one of CHECK`);
  }
});

test('CONTRACT: ready is true only when EVERY check passes — no single check can carry it', () => {
  for (const id of CHECK_IDS) {
    const signals = readySignals();
    // Break exactly one check, leave the rest green.
    if (id === 'tickets-resolved-with-evidence') signals.state.tickets[0].evidence = [];
    if (id === 'suite-green') signals.suite.failed = 1;
    if (id === 'tree-clean') signals.git.clean = false;
    if (id === 'head-pushed') signals.git.headSha = 'e'.repeat(40);
    if (id === 'independent-review') signals.qa.allCurrentApproved = false;
    const r = assessMergeReadiness(signals);
    assert.equal(r.ready, false, `breaking ${id} alone must block`);
    assert.equal(r.blocking.length, 1);
    assert.equal(r.blocking[0].id, id);
  }
});

// ---------------------------------------------------------------------------
// Purity — by construction, asserted on the dependency graph
// ---------------------------------------------------------------------------
// This inspects the module's IMPORT STATEMENTS, not its prose. It is deliberately not
// a substring ban: T-10 shipped one of those and it fired on a sentence proving the
// invariant held. An import assertion cannot misfire on a comment.

test('CONTROL: the readiness module imports nothing impure (AD-11 purity by construction)', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  const imports = src.match(/^\s*import[^\n]*$/gm) || [];
  assert.equal(imports.length, 0, `expected zero imports, found: ${imports.join(' | ')}`);
  assert.equal(/\brequire\s*\(/.test(src), false, 'no CommonJS require either');
});

test('CONTROL: assessMergeReadiness does not mutate its inputs', () => {
  const signals = readySignals();
  const before = JSON.stringify(signals);
  assessMergeReadiness(signals);
  assert.equal(JSON.stringify(signals), before);
});

test('CONTROL: the same signals always produce the same verdict (no clock, no environment)', () => {
  const a = assessMergeReadiness(readySignals());
  const b = assessMergeReadiness(readySignals());
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// renderReadiness
// ---------------------------------------------------------------------------

test('renderReadiness names every blocking check and says an UNKNOWN blocks like a FAIL', () => {
  const signals = readySignals();
  signals.suite = null;
  signals.git.clean = null;
  const out = renderReadiness(assessMergeReadiness(signals));
  assert.match(out, /NOT READY/);
  assert.match(out, /suite-green \(unknown\)/);
  assert.match(out, /tree-clean \(unknown\)/);
  assert.match(out, /UNKNOWN check blocks exactly as a FAIL/);
});

test('renderReadiness never asks anyone to run a git command (AD-20)', () => {
  const out = renderReadiness(assessMergeReadiness(readySignals())) +
    renderReadiness(assessMergeReadiness({}));
  assert.equal(/\b(run|type|execute|please)\b[^\n]{0,40}\bgit\b/i.test(out), false,
    'the readiness render must never instruct anyone to run git');
  assert.match(out, /READY/);
});

test('renderReadiness on a missing assessment says so — it does not render as a pass', () => {
  const out = renderReadiness(null);
  assert.match(out, /not a pass/i);
  assert.equal(/\bREADY\b/.test(out.split('\n')[0]), false);
});
