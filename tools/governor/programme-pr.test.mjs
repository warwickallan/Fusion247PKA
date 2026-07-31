import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PR_MARKER,
  GH_ACTIONS,
  PR_ACTION,
  MERGING_FLAGS,
  buildGhArgs,
  renderPrBody,
  upsertProgrammePr,
  renderMergeDecision,
} from './programme-pr.mjs';
import { assessMergeReadiness } from './merge-readiness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const SRC_PATH = join(__dirname, 'programme-pr.mjs');

const REPO = 'warwickallan/Fusion247PKA';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function resolvedState() {
  const state = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  state.tickets = state.tickets.map((t) => ({
    ...t,
    state: 'resolved',
    resolved: '2026-01-02',
    evidence: [`evidence/${t.id}.md`, `tools/governor/${t.id.toLowerCase()}.mjs`],
  }));
  state.unknown = [];
  state.branches = [
    ...state.branches,
    { name: 'main', head: null, upstream: null, ahead: null, behind: null, role: 'main', note: null },
  ];
  return state;
}

// A verdictStatus()-SHAPED literal. qa-binding.mjs belongs to another worker and is
// never imported: this module is contracted to the shape, not to that implementation.
function currentApprovedQa() {
  return {
    headKnown: true,
    head: 'a'.repeat(40),
    reviewers: [
      { reviewer: 'codex', binding: 'current', verdict: 'approve', sha: 'a'.repeat(40), at: '2026-01-02', detail: null },
    ],
    allCurrentApproved: true,
    superseded: [],
    checked: 1,
  };
}

function readyReadiness(state = resolvedState()) {
  const r = assessMergeReadiness({
    state,
    git: { clean: true, headSha: 'b'.repeat(40), remoteHeadSha: 'b'.repeat(40) },
    suite: { executed: true, total: 223, failed: 0 },
    qa: currentApprovedQa(),
  });
  assert.equal(r.ready, true, `test setup must be genuinely ready: ${JSON.stringify(r.blocking)}`);
  return r;
}

function notReadyReadiness() {
  return assessMergeReadiness({
    state: resolvedState(),
    git: { clean: false, headSha: 'b'.repeat(40), remoteHeadSha: 'b'.repeat(40) },
    suite: null,
    qa: currentApprovedQa(),
  });
}

// A recording `gh`. Nothing in this file ever invokes a real `gh` or a real repository.
function recorder(script = {}) {
  const calls = [];
  const execFile = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const action = args[1];
    const handler = script[action];
    if (typeof handler === 'function') return handler(args);
    if (action === 'list') return '[]';
    return '';
  };
  return { execFile, calls };
}

// ---------------------------------------------------------------------------
// THE NEVER-MERGES CONTROL — argv shape, not source text
// ---------------------------------------------------------------------------
// T-10's first attempt at an invariant control banned a STRING IN THE SOURCE and died
// immediately, because the module legitimately printed the banned word in the sentence
// proving the invariant held. A control scoped to source text cannot tell a subcommand
// from a noun in a paragraph. This one is scoped to the argument vector, where the
// authority actually lives: the subcommand POSITION is constrained, so a title or body
// containing the word "merge" is a value element and can never become an action.

function assertNonMergingArgv(argv, label) {
  assert.ok(Array.isArray(argv), `${label}: argv must be an array`);
  assert.equal(argv[0], 'pr', `${label}: argv[0] must be the 'pr' command group`);
  assert.ok(GH_ACTIONS.includes(argv[1]), `${label}: argv[1] (${argv[1]}) must be one of ${GH_ACTIONS.join('/')}`);
  for (const el of argv) {
    if (typeof el === 'string' && el.startsWith('-')) {
      assert.equal(MERGING_FLAGS.includes(el), false, `${label}: ${el} is a merging flag`);
    }
  }
}

const ARGV_CASES = {
  list: { repo: REPO, branch: 'build-999/synthetic' },
  create: { repo: REPO, branch: 'build-999/synthetic', base: 'main', title: 'T', body: 'B' },
  edit: { repo: REPO, number: 42, title: 'T', body: 'B' },
};

test('NEVER MERGES: GH_ACTIONS is exactly the three non-merging subcommands', () => {
  // Asserted as an exact set so a fourth action cannot be added without this test
  // failing first and forcing a review of what it is.
  assert.deepEqual(GH_ACTIONS, ['list', 'create', 'edit']);
});

test('NEVER MERGES: every argv buildGhArgs can produce is structurally non-merging', () => {
  let built = 0;
  for (const action of GH_ACTIONS) {
    const opts = ARGV_CASES[action];
    assert.ok(opts, `every action in GH_ACTIONS must be exercised here — ${action} is not`);
    assertNonMergingArgv(buildGhArgs(action, opts), action);
    built += 1;
  }
  assert.equal(built, GH_ACTIONS.length, 'the enumeration must cover the whole exported action set');
  assert.ok(built > 0);
});

test('NEVER MERGES: an unrecognised action throws — including "merge" itself', () => {
  for (const action of ['merge', 'pr merge', 'ready', 'close', 'review', '', null, undefined, 42]) {
    assert.throws(() => buildGhArgs(action, ARGV_CASES.list), /refusing to build/,
      `action ${JSON.stringify(action)} must throw`);
  }
});

test('NEVER MERGES: the control survives legitimate content containing the word "merge"', () => {
  // The exact failure mode that killed T-10's substring ban. A body that discusses
  // merging, a title that says it, a branch named after it — all legal values, and
  // the control must still hold rather than firing on prose.
  const hostile = {
    repo: REPO,
    branch: 'feature/merge-the-thing',
    base: 'main',
    number: 7,
    title: 'BUILD-018 — ready to merge',
    body: 'Merge readiness: PASS. This tooling can never merge; only Warwick merges. merge merge --merge',
  };
  for (const action of GH_ACTIONS) {
    const argv = buildGhArgs(action, hostile);
    assertNonMergingArgv(argv, `${action} with hostile content`);
    // And prove the hostile content really did travel through, so this is not passing
    // vacuously on an argv that silently dropped it.
    if (action !== 'list') {
      assert.ok(argv.includes(hostile.body), `${action}: the body must be present as a value element`);
    }
  }
  // A `--merge` appearing INSIDE a body value is a value, not a flag — the control
  // must not confuse the two in either direction.
  const createArgv = buildGhArgs('create', hostile);
  assert.equal(createArgv.indexOf('--merge'), -1, 'no standalone --merge element');
  assert.ok(createArgv.some((e) => e.includes('--merge')), 'the body value containing --merge did survive');
});

test('NEVER MERGES: every gh invocation upsertProgrammePr makes is a non-merging one', () => {
  const scenarios = [
    { name: 'no existing pr', script: { list: () => '[]', create: () => 'https://github.com/x/y/pull/9\n' } },
    { name: 'existing open pr', script: { list: () => JSON.stringify([{ number: 42, url: 'u', state: 'OPEN', title: 't', headRefName: 'b', isDraft: false }]) } },
    { name: 'dry run', script: { list: () => '[]' }, opts: { dryRun: true } },
  ];
  let totalCalls = 0;
  for (const s of scenarios) {
    const { execFile, calls } = recorder(s.script);
    const state = resolvedState();
    upsertProgrammePr({ state, readiness: readyReadiness(state), qa: currentApprovedQa(), ghRepo: REPO, execFile, ...(s.opts || {}) });
    assert.ok(calls.length > 0, `${s.name}: expected at least one gh invocation`);
    for (const c of calls) {
      assert.equal(c.cmd, 'gh', `${s.name}: this module shells out to gh and nothing else`);
      assertNonMergingArgv(c.args, `${s.name} invocation`);
    }
    totalCalls += calls.length;
  }
  assert.ok(totalCalls >= 4, `expected several captured invocations, got ${totalCalls}`);
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test('IDEMPOTENT: an existing open PR is UPDATED, and no create invocation is made', () => {
  const { execFile, calls } = recorder({
    list: () => JSON.stringify([{ number: 42, url: 'https://github.com/x/y/pull/42', state: 'OPEN', title: 'old', headRefName: 'build-999/synthetic', isDraft: false }]),
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), qa: currentApprovedQa(), ghRepo: REPO, execFile });

  assert.equal(r.action, PR_ACTION.UPDATED);
  assert.equal(r.number, 42);
  assert.equal(r.url, 'https://github.com/x/y/pull/42');
  assert.equal(calls.filter((c) => c.args[1] === 'create').length, 0, 'a second PR must never be opened');
  assert.equal(calls.filter((c) => c.args[1] === 'edit').length, 1);
  assert.ok(r.checked > 0, 'INV-5: must report a non-zero examined count');
});

test('IDEMPOTENT: running twice against the same open PR updates twice and creates never', () => {
  const script = {
    list: () => JSON.stringify([{ number: 42, url: 'u', state: 'OPEN', title: 't', headRefName: 'b', isDraft: false }]),
  };
  const state = resolvedState();
  const readiness = readyReadiness(state);
  const first = recorder(script);
  const second = recorder(script);
  const a = upsertProgrammePr({ state, readiness, ghRepo: REPO, execFile: first.execFile });
  const b = upsertProgrammePr({ state, readiness, ghRepo: REPO, execFile: second.execFile });
  assert.equal(a.action, PR_ACTION.UPDATED);
  assert.equal(b.action, PR_ACTION.UPDATED);
  assert.equal([...first.calls, ...second.calls].filter((c) => c.args[1] === 'create').length, 0);
});

test('no existing PR: one is CREATED, exactly once, and its number is parsed from the URL', () => {
  const { execFile, calls } = recorder({
    list: () => '[]',
    create: () => 'https://github.com/warwickallan/Fusion247PKA/pull/91\n',
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });

  assert.equal(r.action, PR_ACTION.CREATED);
  assert.equal(r.number, 91);
  assert.equal(r.url, 'https://github.com/warwickallan/Fusion247PKA/pull/91');
  assert.equal(calls.filter((c) => c.args[1] === 'create').length, 1);
  assert.equal(calls.filter((c) => c.args[1] === 'edit').length, 0);
});

test('a MERGED PR on the branch is refused, not edited and not duplicated', () => {
  const { execFile, calls } = recorder({
    list: () => JSON.stringify([{ number: 7, url: 'https://github.com/x/y/pull/7', state: 'MERGED', title: 't', headRefName: 'b', isDraft: false }]),
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });

  assert.equal(r.action, PR_ACTION.REFUSED);
  assert.equal(r.number, 7);
  assert.match(r.reason, /already merged/);
  assert.equal(calls.filter((c) => c.args[1] !== 'list').length, 0, 'nothing beyond the lookup may run');
});

// ---------------------------------------------------------------------------
// The gate — readiness governs, and a refusal has no side effects
// ---------------------------------------------------------------------------

test('MUTATION: readiness not met => REFUSED, naming the blocking checks, with ZERO gh invocations', () => {
  const { execFile, calls } = recorder();
  const r = upsertProgrammePr({ state: resolvedState(), readiness: notReadyReadiness(), ghRepo: REPO, execFile });

  assert.equal(r.action, PR_ACTION.REFUSED);
  assert.equal(calls.length, 0, 'a refusal must not touch the repository at all');
  assert.match(r.reason, /tree-clean \(fail\)/);
  assert.match(r.reason, /suite-green \(unknown\)/);
  assert.equal(r.number, null);
  assert.ok(r.checked > 0, 'INV-5: the refusal must report what it examined');
});

test('MUTATION: an absent readiness assessment is refused — it is never treated as a pass', () => {
  for (const readiness of [null, undefined, {}, { ready: 'yes' }, { ready: false }]) {
    const { execFile, calls } = recorder();
    const r = upsertProgrammePr({ state: resolvedState(), readiness, ghRepo: REPO, execFile });
    assert.equal(r.action, PR_ACTION.REFUSED, `readiness ${JSON.stringify(readiness)} must refuse`);
    assert.equal(calls.length, 0);
  }
});

test('REFUSED means exactly one thing — a dry run does NOT borrow it', () => {
  const state = resolvedState();
  const { execFile, calls } = recorder({ list: () => '[]' });
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile, dryRun: true });

  assert.equal(r.action, PR_ACTION.DRY_RUN);
  assert.notEqual(r.action, PR_ACTION.REFUSED, 'a consumer switching on action must not read a dry run as a failed gate');
  assert.equal(r.would, PR_ACTION.CREATED);
  assert.equal(calls.filter((c) => c.args[1] !== 'list').length, 0, 'a dry run sends nothing');
  assert.ok(r.checked > 0);
});

test('dry run against an existing open PR reports it WOULD have updated it', () => {
  const state = resolvedState();
  const { execFile, calls } = recorder({
    list: () => JSON.stringify([{ number: 42, url: 'u', state: 'OPEN', title: 't', headRefName: 'b', isDraft: false }]),
  });
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile, dryRun: true });
  assert.equal(r.action, PR_ACTION.DRY_RUN);
  assert.equal(r.would, PR_ACTION.UPDATED);
  assert.equal(r.number, 42);
  assert.equal(calls.filter((c) => c.args[1] === 'edit').length, 0);
});

// ---------------------------------------------------------------------------
// Blind — a failing or missing `gh` is never a silent success
// ---------------------------------------------------------------------------

test('MUTATION: `gh` missing/failing on lookup => BLIND, never created and never a quiet no-op', () => {
  const { execFile, calls } = recorder({
    list: () => { const e = new Error('spawn gh ENOENT'); throw e; },
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });

  assert.equal(r.action, PR_ACTION.BLIND);
  assert.match(r.reason, /ENOENT/);
  assert.match(r.reason, /blind is never a silent success/i);
  assert.equal(calls.filter((c) => c.args[1] === 'create').length, 0);
});

test('MUTATION: `gh` failing on create => BLIND, and the result never claims a PR exists', () => {
  const { execFile } = recorder({
    list: () => '[]',
    create: () => { throw new Error('HTTP 422: A pull request already exists'); },
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });
  assert.equal(r.action, PR_ACTION.BLIND);
  assert.equal(r.number, null);
  assert.equal(r.url, null);
});

test('MUTATION: `gh` failing on edit => BLIND, and it says the body may be stale', () => {
  const { execFile } = recorder({
    list: () => JSON.stringify([{ number: 42, url: 'u', state: 'OPEN', title: 't', headRefName: 'b', isDraft: false }]),
    edit: () => { throw new Error('HTTP 403'); },
  });
  const state = resolvedState();
  const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });
  assert.equal(r.action, PR_ACTION.BLIND);
  assert.equal(r.number, 42);
  assert.match(r.reason, /stale body/);
});

test('MUTATION: unparseable or wrong-shaped `gh` output => BLIND, never an empty-list "no PR"', () => {
  for (const out of ['not json', '{"number": 1}', 'null']) {
    const { execFile, calls } = recorder({ list: () => out });
    const state = resolvedState();
    const r = upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });
    assert.equal(r.action, PR_ACTION.BLIND, `output ${out} must be blind, not a create`);
    assert.equal(calls.filter((c) => c.args[1] === 'create').length, 0);
  }
});

test('MUTATION: no gh repo, or no branch in the banked state => BLIND with zero invocations', () => {
  const state = resolvedState();
  const readiness = readyReadiness(state);

  const a = recorder();
  const r1 = upsertProgrammePr({ state, readiness, ghRepo: null, execFile: a.execFile });
  assert.equal(r1.action, PR_ACTION.BLIND);
  assert.equal(a.calls.length, 0);

  const b = recorder();
  const noBranch = resolvedState();
  delete noBranch.repository.branch;
  const r2 = upsertProgrammePr({ state: noBranch, readiness, ghRepo: REPO, execFile: b.execFile });
  assert.equal(r2.action, PR_ACTION.BLIND);
  assert.equal(b.calls.length, 0);
});

test('the create invocation targets the branch and the main-role base from the banked state', () => {
  const { execFile, calls } = recorder({ list: () => '[]', create: () => 'https://x/pull/3' });
  const state = resolvedState();
  upsertProgrammePr({ state, readiness: readyReadiness(state), ghRepo: REPO, execFile });
  const create = calls.find((c) => c.args[1] === 'create');
  assert.equal(create.args[create.args.indexOf('--head') + 1], 'build-999/synthetic');
  assert.equal(create.args[create.args.indexOf('--base') + 1], 'main');
  assert.equal(create.args[create.args.indexOf('--repo') + 1], REPO);
});

// ---------------------------------------------------------------------------
// The body is a PROJECTION
// ---------------------------------------------------------------------------

test('the body carries the stable marker for the build id', () => {
  const state = resolvedState();
  const body = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  assert.ok(body.startsWith(PR_MARKER('BUILD-999')));
  assert.equal(PR_MARKER('BUILD-999'), PR_MARKER('BUILD-999'), 'the marker must be stable for a build id');
});

test('PROJECTION: every resolved ticket id and every evidence path appears VERBATIM', () => {
  const state = resolvedState();
  const body = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  let asserted = 0;
  for (const t of state.tickets) {
    assert.ok(body.includes(t.id), `${t.id} missing from the body`);
    assert.ok(body.includes(t.title), `${t.title} missing from the body`);
    for (const e of t.evidence) {
      assert.ok(body.includes(e), `evidence ${e} missing from the body`);
      asserted += 1;
    }
  }
  assert.ok(asserted > 0, 'this projection test must actually have examined evidence paths (INV-5)');
});

test('MUTATION: removing a ticket\'s evidence removes the claim from the body', () => {
  const state = resolvedState();
  const gone = state.tickets[0].evidence[0];
  const before = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  assert.ok(before.includes(gone));

  state.tickets[0].evidence = [];
  const after = renderPrBody({ state, readiness: assessMergeReadiness({ state }), qa: currentApprovedQa() });
  assert.equal(after.includes(gone), false, 'the body must mirror the state, not remember it');
  assert.match(after, /no evidence recorded/);
});

test('PROJECTION: locked decisions and declared unknowns come from the banked state', () => {
  const state = resolvedState();
  state.locked_decisions = [{ id: 'AD-99', decision: 'A synthetic locked decision', why: 'because' }];
  state.unknown = [{ path: 'workers', why: 'not gathered in this banking' }];
  const body = renderPrBody({ state, readiness: assessMergeReadiness({ state }), qa: currentApprovedQa() });
  assert.match(body, /AD-99/);
  assert.match(body, /A synthetic locked decision/);
  assert.match(body, /`workers` — not gathered in this banking/);
});

test('PROJECTION: with no goal-contract text supplied, the body says so instead of inventing prose', () => {
  const state = resolvedState();
  const without = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  assert.match(without, /not supplied to this render/);
  assert.match(without, /does not compose new prose/);

  const with_ = renderPrBody({
    state, readiness: readyReadiness(state), qa: currentApprovedQa(),
    goalContractText: '## The outcome\n\nOne logical Larry owns a substantial build.',
  });
  assert.match(with_, /One logical Larry owns a substantial build\./);
  assert.equal(/not supplied to this render/.test(with_), false);
});

test('the body reports the readiness verdict and the exact-head review status', () => {
  const state = resolvedState();
  const body = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  assert.match(body, /`suite-green` \| \*\*PASS\*\*/);
  assert.match(body, /`independent-review` \| \*\*PASS\*\*/);
  assert.match(body, /\*\*codex\*\* — current/);
  assert.match(body, /Verdicts examined: \*\*1\*\*/);
});

test('MUTATION: with no review status the body says review is BLOCKED, never waived', () => {
  const state = resolvedState();
  const body = renderPrBody({ state, readiness: assessMergeReadiness({ state }), qa: null });
  assert.match(body, /BLOCKED, never waived/);
});

test('the body never asks anyone to run a git command (AD-20)', () => {
  const state = resolvedState();
  const body = renderPrBody({ state, readiness: readyReadiness(state), qa: currentApprovedQa() });
  assert.equal(/\b(run|type|execute|please)\b[^\n]{0,40}\bgit\b/i.test(body), false);
});

// ---------------------------------------------------------------------------
// Deliverable 4 — the only thing Warwick sees
// ---------------------------------------------------------------------------

test('the merge decision presents ONE decision, with the evidence and the risks', () => {
  const state = resolvedState();
  state.blockers = [{ id: 'Q-9', kind: 'question', summary: 'A synthetic open question', owner: 'warwick', blocks: [], recommendation: 'Pick (b).' }];
  const readiness = readyReadiness(state);
  const out = renderMergeDecision({
    state, readiness, qa: currentApprovedQa(),
    pr: { action: PR_ACTION.CREATED, number: 91, url: 'https://github.com/x/y/pull/91' },
  });

  assert.equal((out.match(/ONE DECISION/g) || []).length, 1, 'exactly one decision may be asked');
  assert.match(out, /merge this, or not/);
  assert.match(out, /#91 — https:\/\/github\.com\/x\/y\/pull\/91/);
  assert.match(out, /THE EVIDENCE/);
  assert.match(out, /THE RISKS/);
  assert.match(out, /\[question\] A synthetic open question/);
  assert.match(out, /Merge-to-main is the single standing gate/);
});

test('the merge decision states the git lifecycle is ALREADY DONE, never asks for it (AD-20)', () => {
  const state = resolvedState();
  const out = renderMergeDecision({
    state, readiness: readyReadiness(state), qa: currentApprovedQa(),
    pr: { action: PR_ACTION.CREATED, number: 91, url: 'u' },
  });
  assert.match(out, /ALREADY DONE/);
  assert.match(out, /branch, the worktree, every commit, the push and this pull request were/);
  assert.match(out, /Larry's and are complete/);
  assert.equal(/\b(run|type|execute|please)\b[^\n]{0,40}\bgit\b/i.test(out), false,
    'Warwick is never asked to manage a branch, worktree, commit, push or PR');
});

test('MUTATION: a superseded verdict surfaces as a named risk', () => {
  const state = resolvedState();
  const qa = currentApprovedQa();
  qa.superseded = [{ reviewer: 'fable', sha: 'd'.repeat(40) }];
  const out = renderMergeDecision({ state, readiness: readyReadiness(state), qa, pr: { number: 91, url: 'u' } });
  assert.match(out, /\[review\] a verdict from fable is SUPERSEDED/);
  assert.match(out, /does not carry forward/);
});

test('MUTATION: a declared unknown surfaces as a risk and is never presented as a zero', () => {
  const state = resolvedState();
  state.unknown = [{ path: 'branches.behind', why: 'no fetch was performed' }];
  const out = renderMergeDecision({
    state, readiness: readyReadiness(state), qa: currentApprovedQa(), pr: { number: 91, url: 'u' },
  });
  assert.match(out, /\[not established\] `branches\.behind` — no fetch was performed/);
  assert.match(out, /it is not a zero/);
});

test('MUTATION: when not ready, NO decision is asked of Warwick at all', () => {
  const out = renderMergeDecision({
    state: resolvedState(), readiness: notReadyReadiness(), qa: currentApprovedQa(), pr: null,
  });
  assert.match(out, /NOT READY/);
  assert.match(out, /No decision is being asked of you/);
  assert.equal(/ONE DECISION/.test(out), false, 'a not-ready programme must not present a merge ask');
  assert.match(out, /tree-clean \(fail\)/);
});

test('the merge decision reports readiness honestly when the pr result is a refusal', () => {
  const state = resolvedState();
  const out = renderMergeDecision({
    state, readiness: readyReadiness(state), qa: currentApprovedQa(),
    pr: { action: PR_ACTION.REFUSED, number: null, url: null, reason: 'x' },
  });
  assert.match(out, /not yet opened/);
});

// ---------------------------------------------------------------------------
// Module shape
// ---------------------------------------------------------------------------

test('CONTROL: programme-pr writes nothing to disk (no filesystem import)', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  const imports = src.match(/^\s*import[^\n]*$/gm) || [];
  assert.ok(imports.length > 0, 'the module does import something — this assertion must not pass vacuously');
  for (const line of imports) {
    assert.equal(/['"]node:fs['"]/.test(line), false, `unexpected filesystem import: ${line}`);
  }
  // The one impure dependency is the injectable child-process default.
  assert.ok(imports.some((l) => /node:child_process/.test(l)));
  assert.equal(/qa-binding/.test(src), false, 'this module must not depend on qa-binding.mjs — it is contracted to the SHAPE');
});

test('CONTROL: PR_ACTION values are distinct, so no state can be mistaken for another', () => {
  const values = Object.values(PR_ACTION);
  assert.equal(new Set(values).size, values.length);
  assert.deepEqual(values.sort(), ['blind', 'created', 'dry-run', 'refused', 'updated']);
});
