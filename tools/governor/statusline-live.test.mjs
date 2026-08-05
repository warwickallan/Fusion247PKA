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
// AMENDED AGAIN 2026-08-02 (WO-OR-05). `nextModelFor` and the banked programme state
// it read are now DELETED, so every assertion in this file that built a scratch
// worktree carrying `programme-state.json` and asserted a model reached (or failed to
// reach) the line was testing behaviour that no longer exists. Those tests are removed
// rather than adapted: there is no weaker version of them that means anything.
//
// What replaced them is a SINGLE, stronger assertion — `next:` on this surface is UNSET
// unconditionally, because a status line has no knowledge of a next action. That is now
// a property of the code rather than an outcome of a six-condition predicate, so it is
// tested as one.
//
// `locationFrom` went with them: it existed only to feed `nextModelFor`.
//
// THE SURFACE'S PRIMARY JOB IS NOW THE DENOMINATOR OBSERVATION — see the module header.
// The sample it writes is what lets `sampler.resolveWindowTokens` refuse a cross-model
// context-window size, and that is asserted below.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { lineFor, safeLine, LAST_RESORT_LINE } from './statusline-live.mjs';
import { sampleFromStdin, resolveWindowTokens } from './sampler.mjs';
import {
  parseFooter,
  renderFooter,
  adviceFor,
  NEXT_UNSET,
  NEXT_MODELS,
  CONTROL_CONTINUE,
  ADVICE,
  GOV_MARKER,
} from './footer.mjs';
import { STATE } from './evaluator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUSLINE_SRC = join(__dirname, 'statusline-live.mjs');
function tmp(prefix = 'governor-statusline-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// The REAL statusLine payload shape, verified against a live sample under
// ~/.mypka/governor/health/. Note what is NOT here: `cwd`, and
// `workspace.current_dir`. Neither exists. See AC4 below.
//
// ---------------------------------------------------------------------------
// CORRECTED 2026-08-05 (WP-3B, Larry's Amendment 2 B-2) — THIS FIXTURE WAS A FALSE
// WITNESS, and the correction is to the FIXTURE, not to any assertion.
// ---------------------------------------------------------------------------
// It carried `used_percentage` and NO token count, and it is named "real-shaped". A
// census of the whole live store settles that that shape is not real:
//
//     68 samples on disk · statusLine 14, transcript 54
//     14 of 14 statusLine samples carry `context_window.total_input_tokens`
//     54 of 54 transcript samples carry `context_window.used_tokens`
//      0 of 68 carry a percentage with NO count — the shape this fixture asserted
//
// So the fixture encoded a payload the host does not emit, and it would have gone on
// passing while asserting something untrue about the world. `total_input_tokens` is
// added here, consistent with the percentage it already claimed (50% of a 1,000,000
// window is 500,000), and `version` is moved to the version actually observed on this
// host. Nothing else changed: no assertion weakened, no tolerance widened, no
// special-casing. The 50% assertion below still has to be earned.
function realShapedPayload(overrides = {}) {
  return {
    session_id: 'f944fae7-0000-0000-0000-000000000000',
    version: '2.1.221',
    model: { id: 'claude-opus-5', display_name: 'Opus 5' },
    context_window: {
      used_percentage: 50,
      remaining_percentage: 50,
      context_window_size: 1_000_000,
      total_input_tokens: 500_000,
      total_output_tokens: 1_618,
    },
    rate_limits: { five_hour: { used_percentage: 7 }, seven_day: { used_percentage: 85 } },
    workspace: { git_worktree: 'Fusion247PKA-governor' },
    worktree: { name: 'x', path: 'C:/Fusion247PKA-governor', branch: 'build-018/session-governor' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WO-OR-18 — THIS SUITE MUST NOT WRITE INTO WARWICK'S LIVE TELEMETRY STORE
// ---------------------------------------------------------------------------
// It used to. `run()` spawned the real statusLine CLI with no
// MYPKA_GOVERNOR_HEALTH_DIR, so `main()` -> `sampleFromStdin(raw)` wrote through the
// DEFAULT store root and every execution of this suite created two files under
// ~/.mypka/governor/health/C--Fusion247PKA/:
//
//   f944fae7-0000-0000-0000-000000000000.json  (from realShapedPayload, carrying a
//                                               foreign worktree.name "x" and branch
//                                               "build-018/session-governor")
//   s.json                                     (from the HOSTILE_INPUTS fixture
//                                               `{"session_id":"s"}`)
//
// WHY THIS IS A DEFECT AND NOT UNTIDINESS. That store is the one `footer.mjs` reads for
// its DENOMINATOR. Neither file happened to carry a `context_window_size`, so neither was
// yet manufacturing a false percentage — but the suite was one fixture field away from
// planting an observation that would be indistinguishable from a real one. A test harness
// that can write the input of the control it is testing is not a test harness.
//
// The fix is the seam that already exists for exactly this: every child process this file
// spawns is given MYPKA_GOVERNOR_HEALTH_DIR pointing at a throwaway directory.
// `CHILD_ENV` is applied to EVERY spawn in this file rather than only to the two that are
// known to write today, because the next test added here would otherwise silently re-open
// the hole — and it would look exactly like the last one did.
const SCRATCH_STORE = tmp('governor-statusline-store-');
const CHILD_ENV = { ...process.env, MYPKA_GOVERNOR_HEALTH_DIR: SCRATCH_STORE };

after(() => rmSync(SCRATCH_STORE, { recursive: true, force: true }));

const run = (input) => execFileSync('node', [STATUSLINE_SRC], { input, encoding: 'utf8', env: CHILD_ENV });

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

test('WO-OR-05: `next:` is UNSET on this surface UNCONDITIONALLY, for every payload', () => {
  // The predicate that used to be able to return a model is deleted. This asserts the
  // NEW property directly, over payload shapes that previously produced different
  // answers, so 'always UNSET' is established rather than assumed from one example.
  const payloads = [
    realShapedPayload(),
    realShapedPayload({ worktree: undefined }),
    realShapedPayload({ worktree: { path: 'C:/x' } }),
    realShapedPayload({ worktree: { path: 'C:/x', branch: 'b/y' } }),
  ];
  for (const p of payloads) {
    const line = lineFor(JSON.stringify(p));
    assert.equal(parseFooter(line).fields.next, NEXT_UNSET, JSON.stringify(p.worktree));
  }
});

test('WO-OR-05 MUTATION: no model name can reach this line at all', () => {
  // The preserved intent of the deleted suite: a model presented as live advice by a
  // surface that cannot know the next action is the defect. Asserted against the
  // vocabulary itself rather than against one hard-coded name, so adding a model to
  // NEXT_MODELS cannot silently escape this check.
  const line = lineFor(JSON.stringify(realShapedPayload()));
  for (const model of NEXT_MODELS) {
    assert.doesNotMatch(line, new RegExp(model), `${model} must never reach the status line`);
  }
});

test('WO-OR-05: the sample this surface writes carries the DENOMINATOR and its model id', () => {
  // This is why the module was moved from BIN back to KEEP. The transcript path reaches
  // every client but carries no window size; this payload is the only place the runtime
  // states one. If this stops being recorded, the percentage becomes unrenderable.
  const dir = tmp();
  try {
    const payload = realShapedPayload();
    payload.context_window.context_window_size = 1000000;
    sampleFromStdin(JSON.stringify(payload), {
      sampledAt: new Date().toISOString(),
      storeOpts: { envOverride: dir },
    });
    const written = JSON.parse(readFileSync(join(dir, `${payload.session_id}.json`), 'utf8'));
    assert.equal(written.context_window.context_window_size, 1000000, 'the denominator');
    assert.equal(written.model.id, 'claude-opus-5', 'and the model it belongs to');

    // And it is genuinely usable as a denominator — for the session that observed it.
    //
    // RE-AIMED BY WO-OR-09. This used to assert a MODEL-MATCHED lookup, and its mutation
    // used to be "the same observation under a different model id is refused". Codex
    // TQA-001 established that matching on the model id was never evidence about the live
    // session: agreement between observations establishes store consistency, not
    // live-session identity. The resolver now reads this session's own record and nothing
    // else, so the control is aimed at the thing that now carries the meaning.
    assert.deepEqual(
      resolveWindowTokens({ sessionId: payload.session_id, env: {}, storeOpts: { envOverride: dir } }),
      { tokens: 1000000, source: 'statusline-observed' }
    );
    // MUTATION: the same observation, asked for by a DIFFERENT session, must be REFUSED.
    assert.deepEqual(
      resolveWindowTokens({ sessionId: 'some-other-session', env: {}, storeOpts: { envOverride: dir } }),
      { tokens: null, source: null }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
// ===========================================================================
// WO-OR-18 — the spawned CLI's writes are CONTAINED
// ===========================================================================

test('WO-OR-18: the spawned CLI writes its sample into the SCRATCH store', () => {
  // The recurrence guard for the live-store pollution. Asserting the redirect WORKS is
  // what turns `CHILD_ENV` from a convention into a checked property: delete the `env:`
  // from `run()` and this test goes red instead of the store quietly filling up again.
  const payload = realShapedPayload();
  run(JSON.stringify(payload));
  assert.equal(
    existsSync(join(SCRATCH_STORE, `${payload.session_id}.json`)),
    true,
    'the child must have written HERE — if this fails, find out where it wrote instead before assuming it wrote nowhere'
  );
});

test('WO-OR-18 MUTATION: MYPKA_GOVERNOR_HEALTH_DIR is what steers the write, not luck', () => {
  // Makes the test above fail-able. It would pass just as happily if the CLI wrote to
  // BOTH the scratch dir and the default root, or if the scratch file were left over from
  // an earlier test. So: a SECOND, empty directory, and the same payload must land in
  // that one instead — which can only be true if the environment variable is load-bearing.
  const other = tmp('governor-statusline-store-2-');
  try {
    assert.deepEqual(readdirSync(other), [], 'CONTROL: the second store starts empty');
    const payload = realShapedPayload({ session_id: 'wo-or-18-redirect-probe' });
    execFileSync('node', [STATUSLINE_SRC], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, MYPKA_GOVERNOR_HEALTH_DIR: other },
    });
    assert.deepEqual(readdirSync(other), ['wo-or-18-redirect-probe.json'],
      'the sample follows the variable');
    assert.equal(existsSync(join(SCRATCH_STORE, 'wo-or-18-redirect-probe.json')), false,
      'and it did NOT also land in the suite-wide scratch store');
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
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

test('AC5: BLIND is never rendered as GREEN (INV-1) — and never carries graded advice', () => {
  const parsed = parseFooter(lineFor('{}'));
  assert.equal(parsed.fields.state, STATE.BLIND);
  // Warwick 2026-08-02. This asserted `ADVICE.UNSURE` ("KEEP GOING?"), which was encoding
  // the defect: a state meaning "I could not grade this" paired with a recommendation
  // derived from a grade, reading on a phone as a hedged yes. The INV-1 property this
  // test exists for is unchanged and now stated at full strength — not merely "not
  // GREEN", but carrying no graded advice at all.
  assert.equal(parsed.fields.advice, ADVICE.NO_ADVICE, 'unknown telemetry must not advise at all');
  for (const graded of [ADVICE.KEEP_GOING, ADVICE.CLEAR_NOW, ADVICE.UNSURE, ADVICE.TASK_UNKNOWN]) {
    assert.notEqual(parsed.fields.advice, graded, `BLIND must never advise ${graded}`);
  }
  assert.equal(parsed.fields.percent, null);
});

test('AC5: the last-resort literal is byte-identical to what the renderer would produce', () => {
  // The one hand-written copy of the grammar in the module, pinned to a literal
  // held OUTSIDE the source it checks, so the copy cannot silently drift.
  //
  // STRENGTHENED 2026-08-02. The advice was restated here as a second literal
  // (`ADVICE.UNSURE`), so the pin compared one hand-written value against another and
  // stayed green while BOTH carried the retired value — it could only ever catch a typo,
  // never a vocabulary change. It now DERIVES the advice from the single mapping every
  // other surface reads, which makes this the drift-guard for the module's unreachable
  // layer-2 fallback as well: change what BLIND advises anywhere, and this goes red.
  assert.equal(
    LAST_RESORT_LINE,
    renderFooter({
      percent: null,
      approximate: false,
      state: STATE.BLIND,
      advice: adviceFor(STATE.BLIND),
      next: NEXT_UNSET,
      control: CONTROL_CONTINUE,
    })
  );
  assert.equal(parseFooter(LAST_RESORT_LINE).ok, true);
  // And it carries the ruling explicitly, so a reader of this file sees the requirement
  // rather than only its consequence.
  assert.equal(parseFooter(LAST_RESORT_LINE).fields.advice, ADVICE.NO_ADVICE);
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
    const lines = execFileSync('node', [m.path], { input: '{}', encoding: 'utf8', env: CHILD_ENV })
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
      execFileSync('node', [m.path], { input: '{}', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: CHILD_ENV });
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
    { encoding: 'utf8', env: CHILD_ENV }
  );
  assert.match(out, /IMPORTED-CLEANLY/);
  assert.doesNotMatch(out, /⟦GOV⟧/, 'importing must not print a status line');
});

test('REAL PROCESS: a real-shaped payload renders the five-field grammar', () => {
  const line = firstLine(run(JSON.stringify(realShapedPayload())));
  assert.equal(parseFooter(line).ok, true);
  assert.equal(line.split(' · ').length, 5, 'five fields, four separators');
});
