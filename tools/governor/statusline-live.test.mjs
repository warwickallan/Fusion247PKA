// The live status line, AFTER it was wired to the single footer contract
// (BUILD-018 WP-5, AC3/AC4/AC5).
//
// ---------------------------------------------------------------------------
// RECORDED SPEC AMENDMENT — read this before concluding a proof was weakened
// ---------------------------------------------------------------------------
// The previous version of this file tested `recommendedModel()`, a selection rule
// this surface no longer owns, and asserted that `next:` is ABSENT when no model
// is established. Both were correct against the interim contract and are wrong
// against the shipped one:
//
//   * `recommendedModel()` is DELETED. `nextModelFor` (footer.mjs, D-4) replaces
//     it with a strictly stronger rule. Two rival selection rules on one surface
//     is the SSOT defect, so the weaker one does not survive as dead code. Its
//     replacement is exercised directly and far more thoroughly in
//     footer.test.mjs; re-testing it here would be duplicate coverage of another
//     module's contract, so what is tested HERE is the WIRING.
//   * `next:` is now ALWAYS emitted, because D-2 expresses absence as the VALUE
//     `UNSET` and never as a missing segment — a five-field line with a dropped
//     segment is ambiguous to a parser.
//
// The REAL intent of the superseded assertions is preserved below and is what
// actually mattered: a non-active or non-matching build's model must never reach
// the line. That is still asserted as `doesNotMatch(/Haiku/)`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { locationFrom, lineFor, safeLine, LAST_RESORT_LINE } from './statusline-live.mjs';
import {
  parseFooter,
  renderFooter,
  NEXT_UNSET,
  CONTROL_CONTINUE,
  ADVICE,
  GOV_MARKER,
} from './footer.mjs';
import { STATE } from './evaluator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUSLINE_SRC = join(__dirname, 'statusline-live.mjs');
const MINIMAL_STATE = join(__dirname, 'fixtures', 'programme-state.minimal.json');

// The base document is the REAL minimal fixture, so every state written here
// genuinely validates rather than being invented to suit the assertion.
const baseState = JSON.parse(readFileSync(MINIMAL_STATE, 'utf8'));

function tmp(prefix = 'governor-statusline-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// A scratch WORKTREE carrying `Deliverables/<id>/programme-state.json` files.
// `mutate` receives a deep copy of the valid base document.
function makeWorktree(builds) {
  const root = tmp();
  for (const b of builds) {
    const doc = JSON.parse(JSON.stringify(baseState));
    b.mutate(doc, root);
    const dir = join(root, 'Deliverables', b.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'programme-state.json'), JSON.stringify(doc, null, 2) + '\n');
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// All six of D-4's U-conditions satisfied for this (worktree, branch).
function satisfyAll(doc, { worktree, branch, model }) {
  doc.resumption.worktree = worktree;
  doc.resumption.branch = branch;
  doc.resumption.ticket = 'T-02'; // `frontier` in the base fixture, i.e. unresolved
  doc.resumption.next_action_kind = 'action';
  doc.model_recommendation.model = model;
  doc.model_recommendation.for_ticket = 'T-02';
  doc.model_recommendation.computed_at_head = doc.banked.head_sha;
}

// The REAL statusLine payload shape, verified against a live sample under
// ~/.mypka/governor/health/. Note what is NOT here: `cwd`, and
// `workspace.current_dir`. Neither exists. See AC4 below.
function realShapedPayload(overrides = {}) {
  return {
    session_id: 'f944fae7-0000-0000-0000-000000000000',
    version: '2.1.220',
    model: { id: 'claude-opus-5', display_name: 'Opus 5' },
    context_window: { used_percentage: 50, remaining_percentage: 50 },
    rate_limits: { five_hour: { used_percentage: 7 }, seven_day: { used_percentage: 85 } },
    workspace: { git_worktree: 'Fusion247PKA-governor' },
    worktree: { name: 'x', path: 'C:/Fusion247PKA-governor', branch: 'build-018/session-governor' },
    ...overrides,
  };
}

const run = (input) => execFileSync('node', [STATUSLINE_SRC], { input, encoding: 'utf8' });

const firstLine = (out) => out.split('\n').filter((l) => l.length > 0)[0];

// ===========================================================================
// AC3 — the line IS the footer grammar, not a look-alike
// ===========================================================================

test('AC3: the rendered line parses as a valid footer', () => {
  const line = lineFor(JSON.stringify(realShapedPayload()));
  const parsed = parseFooter(line);
  assert.equal(parsed.ok, true, `the status line must satisfy the footer grammar — got: ${line}`);
  assert.equal(parsed.fields.percent, 50);
  assert.equal(parsed.fields.control, CONTROL_CONTINUE);
});

test('AC3: the line round-trips through the ONE parser (D-M10)', () => {
  const line = lineFor(JSON.stringify(realShapedPayload()));
  const parsed = parseFooter(line);
  assert.equal(renderFooter(parsed.fields), line, 'render(parse(line)) must be byte-identical');
});

test('AC3 MUTATION: the grammar check is real — a look-alike line is rejected', () => {
  // Makes the two controls above fail-able. If parseFooter accepted anything
  // opening with the marker, asserting `ok` would prove nothing.
  assert.equal(parseFooter(`${GOV_MARKER} ctx 50% · GREEN · KEEP GOING`).ok, false, 'four fields must not pass');
  assert.equal(
    parseFooter(`${GOV_MARKER} ctx 50%. GREEN. KEEP GOING. next: UNSET. CONTINUE`).ok,
    false,
    '"." is not "·"'
  );
  assert.equal(parseFooter(lineFor('{}')).ok, true, 'and the real line still passes');
});

test('AC3: `next:` is ALWAYS emitted — absence is the VALUE UNSET, never a missing segment', () => {
  // SPEC AMENDMENT (see header): the superseded test asserted `doesNotMatch(/next:/)`.
  // D-2 forbids dropping a segment, so the requirement itself changed.
  const line = lineFor(JSON.stringify(realShapedPayload({ worktree: undefined })));
  assert.match(line, /· next: UNSET ·/, 'an unresolvable model renders UNSET, not silence');
  assert.equal(parseFooter(line).fields.next, NEXT_UNSET);
});

test('AC3: the UNSET predicate genuinely APPLIES here — a state failing U-d renders UNSET', () => {
  // The live banked state's exact condition today: a model is present, but
  // `for_ticket` is absent, so the recommendation is no longer grounded.
  const w = makeWorktree([
    {
      id: 'BUILD-777-ungrounded',
      mutate: (d, root) => {
        satisfyAll(d, { worktree: root, branch: 'b/x', model: 'Sonnet' });
        delete d.model_recommendation.for_ticket;
      },
    },
  ]);
  try {
    const line = lineFor(JSON.stringify(realShapedPayload({ worktree: { path: w.root, branch: 'b/x' } })));
    assert.match(line, /next: UNSET/, 'an ungrounded recommendation must not be presented as live advice');
    assert.doesNotMatch(line, /Sonnet/, 'and the stale literal must not reach the line at all');
  } finally {
    w.cleanup();
  }
});

test('AC3: a fully grounded state DOES reach the line — UNSET is not a stuck value', () => {
  // Without this, every UNSET assertion above would be satisfied by a surface
  // that can only ever say UNSET, which would prove nothing at all.
  const w = makeWorktree([
    {
      id: 'BUILD-888-grounded',
      mutate: (d, root) => satisfyAll(d, { worktree: root, branch: 'b/x', model: 'Opus' }),
    },
  ]);
  try {
    const line = lineFor(JSON.stringify(realShapedPayload({ worktree: { path: w.root, branch: 'b/x' } })));
    assert.match(line, /· next: Opus ·/, 'a grounded recommendation must render');
  } finally {
    w.cleanup();
  }
});

test("PRESERVED INTENT: another programme's model never reaches the line", () => {
  // The half of the superseded tests that still binds: a build that does not
  // match this session must never answer for it.
  const w = makeWorktree([
    {
      id: 'BUILD-001-finished',
      mutate: (d) => satisfyAll(d, { worktree: 'C:/somewhere-else', branch: 'other/branch', model: 'Haiku' }),
    },
  ]);
  try {
    const line = lineFor(JSON.stringify(realShapedPayload({ worktree: { path: w.root, branch: 'b/x' } })));
    assert.doesNotMatch(line, /Haiku/, 'a non-matching build must never reach the line');
    assert.match(line, /next: UNSET/);
  } finally {
    w.cleanup();
  }
});

// ===========================================================================
// AC4 — the payload fields that actually exist
// ===========================================================================

test('AC4: the location comes from worktree.path / worktree.branch', () => {
  const loc = locationFrom(realShapedPayload());
  assert.equal(loc.worktreePath, 'C:/Fusion247PKA-governor');
  assert.equal(loc.worktreeBranch, 'build-018/session-governor');
});

test('AC4 MUTATION: the fields the OLD code read are absent from the real payload', () => {
  // The defect, made visible. The old expression was
  // `payload?.cwd || payload?.workspace?.current_dir`. Against a real payload
  // BOTH are undefined, so it fell through to process.cwd() — answering about
  // whatever directory this process happened to be run in.
  const real = realShapedPayload();
  assert.equal(real.cwd, undefined, 'the real payload carries no `cwd`');
  assert.equal(real.workspace.current_dir, undefined, 'nor `workspace.current_dir`');
  const oldExpression = real?.cwd || real?.workspace?.current_dir;
  assert.equal(oldExpression, undefined, 'so the old lookup could only ever fall back');

  // And the new one succeeds on the same payload — the two genuinely differ.
  assert.notEqual(locationFrom(real).worktreePath, oldExpression);
});

test('AC4: a payload carrying ONLY the old fields yields NO location, and never a guess', () => {
  const loc = locationFrom({ cwd: 'C:/anywhere', workspace: { current_dir: 'C:/anywhere' } });
  assert.equal(loc.worktreePath, null, 'absent is "not established", never a fallback (INV-1)');
  assert.equal(loc.worktreeBranch, null);
});

test('AC4: a partial location (path but no branch) is still UNSET — U-a needs both', () => {
  const line = lineFor(JSON.stringify(realShapedPayload({ worktree: { path: 'C:/x' } })));
  assert.match(line, /next: UNSET/);
});

// ===========================================================================
// AC5 — never throws, always exits 0, always exactly one line
// ===========================================================================

const HOSTILE_INPUTS = [
  ['empty string', ''],
  ['whitespace only', '   \n  '],
  ['not JSON at all', 'this is not json {{{'],
  ['JSON null', 'null'],
  ['JSON array', '[1,2,3]'],
  ['JSON string', '"hello"'],
  ['JSON number', '42'],
  ['empty object', '{}'],
  ['absent context_window', JSON.stringify({ session_id: 's' })],
  ['null context_window', JSON.stringify({ context_window: null })],
  ['percentage as a STRING', JSON.stringify({ context_window: { used_percentage: '42' } })],
  ['percentage NaN-ish', JSON.stringify({ context_window: { used_percentage: 'NaN' } })],
  ['percentage out of range', JSON.stringify({ context_window: { used_percentage: 4200 } })],
  ['negative percentage', JSON.stringify({ context_window: { used_percentage: -5 } })],
  ['worktree is a string not an object', JSON.stringify({ worktree: 'C:/x' })],
  ['worktree is null', JSON.stringify({ worktree: null })],
  ['deeply wrong types', JSON.stringify({ context_window: [], worktree: 7, session_id: {} })],
];

for (const [label, input] of HOSTILE_INPUTS) {
  test(`AC5: ${label} — one grammatical line, exit 0`, () => {
    const lines = run(input).split('\n').filter((l) => l.length > 0);
    assert.equal(lines.length, 1, 'a statusLine command must print exactly one line');
    assert.equal(parseFooter(lines[0]).ok, true, `and it must be a valid footer — got: ${lines[0]}`);
  });
}

test('AC5: lineFor itself never throws on any hostile input', () => {
  for (const [label, input] of HOSTILE_INPUTS) {
    assert.doesNotThrow(() => lineFor(input), `lineFor threw on: ${label}`);
  }
});

test('AC5: BLIND is never rendered as GREEN (INV-1)', () => {
  const parsed = parseFooter(lineFor('{}'));
  assert.equal(parsed.fields.state, STATE.BLIND);
  assert.equal(parsed.fields.advice, ADVICE.UNSURE, 'unknown telemetry must not read as healthy');
  assert.equal(parsed.fields.percent, null);
});

test('AC5: the last-resort literal is byte-identical to what the renderer would produce', () => {
  // The one hand-written copy of the grammar in the module, pinned to a literal
  // held OUTSIDE the source it checks, so the copy cannot silently drift.
  assert.equal(
    LAST_RESORT_LINE,
    renderFooter({
      percent: null,
      approximate: false,
      state: STATE.BLIND,
      advice: ADVICE.UNSURE,
      next: NEXT_UNSET,
      control: CONTROL_CONTINUE,
    })
  );
  assert.equal(parseFooter(LAST_RESORT_LINE).ok, true);
});

test('AC5: safeLine degrades to a valid footer even when the input is hostile', () => {
  assert.equal(parseFooter(safeLine('{{{')).ok, true);
});

// ---------------------------------------------------------------------------
// AC6 MUTATION for AC5 — the safety net is made to FAIL
// ---------------------------------------------------------------------------
// INV-5: a control is not evidence until it has been made to fail. "It exits 0"
// proves nothing on inputs that were never going to throw, so this forces the
// throw, then removes the net, and asserts the two outcomes DIFFER.

function mutantOf(replacements, prefix) {
  // Normalise line endings before matching. The source is CRLF on this machine
  // and the patterns below are written with `\n`; without this the mutation
  // would silently fail to apply, and a mutation test that does not mutate is
  // the exact false-green INV-5 exists to prevent. The `assert.ok` on each
  // replacement is the backstop that makes that failure loud.
  let src = readFileSync(STATUSLINE_SRC, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of replacements) {
    assert.ok(src.includes(from), `mutation precondition failed — source no longer contains: ${from}`);
    src = src.replace(from, to);
  }
  // Its imports are relative siblings, so the mutant must live beside them.
  const path = join(__dirname, `.mutant-${prefix}${process.pid}.mjs`);
  writeFileSync(path, src);
  return { path, cleanup: () => rmSync(path, { force: true }) };
}

// A payload cannot easily force lineFor to throw — it is defensive by design —
// so the mutation makes it throw outright, which is the exact condition the net
// exists for.
const FORCE_THROW = [
  'export function lineFor(raw, { now = Date.now(), sampledAt = new Date().toISOString() } = {}) {',
  'export function lineFor(raw, { now = Date.now(), sampledAt = new Date().toISOString() } = {}) {\n  throw new Error("MUTANT");',
];

test('AC6 MUTATION (AC5): with lineFor throwing, the net still prints one valid footer and exits 0', () => {
  const m = mutantOf([FORCE_THROW], 'net-intact-');
  try {
    const lines = execFileSync('node', [m.path], { input: '{}', encoding: 'utf8' })
      .split('\n')
      .filter((l) => l.length > 0);
    assert.equal(lines.length, 1);
    assert.equal(parseFooter(lines[0]).ok, true, 'the net must degrade to a GRAMMATICAL line');
  } finally {
    m.cleanup();
  }
});

test('AC6 MUTATION (AC5): REMOVE the net and the same input FAILS — proving the net is what holds', () => {
  const m = mutantOf(
    [
      FORCE_THROW,
      // Remove the entrypoint's catch, so nothing rescues the throw.
      ["  try {\n    line = main();\n  } catch {\n    line = safeLine('');\n  }", '  line = main();'],
    ],
    'net-removed-'
  );
  try {
    let failed = false;
    try {
      execFileSync('node', [m.path], { input: '{}', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      failed = true;
      assert.notEqual(err.status, 0, 'the unprotected mutant must exit non-zero');
    }
    assert.equal(failed, true, 'if this passes, the net was never the thing keeping the line alive');
  } finally {
    m.cleanup();
  }
});

// ===========================================================================
// The module boundary — unchanged requirements that still bind
// ===========================================================================

test('REAL PROCESS: importing the module does NOT execute it', () => {
  // The module used to run main() and call process.exit(0) at import time, which
  // made it untestable — importing it killed the test runner. That guard is why
  // every test above can run at all.
  const out = execFileSync(
    'node',
    ['-e', `import(${JSON.stringify(pathToFileURL(STATUSLINE_SRC).href)}).then(() => console.log('IMPORTED-CLEANLY'))`],
    { encoding: 'utf8' }
  );
  assert.match(out, /IMPORTED-CLEANLY/);
  assert.doesNotMatch(out, /⟦GOV⟧/, 'importing must not print a status line');
});

test('REAL PROCESS: a real-shaped payload renders the five-field grammar', () => {
  const line = firstLine(run(JSON.stringify(realShapedPayload())));
  assert.equal(parseFooter(line).ok, true);
  assert.equal(line.split(' · ').length, 5, 'five fields, four separators');
});
