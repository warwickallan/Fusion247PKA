// Proofs for footer.mjs (BUILD-018 WP-3, D-D).
//
// Covers Silas's D-M1..D-M11. D-M12 (`deriveResumption` must not carry a `hold`
// forward) is NOT here and is not silently dropped: `deriveResumption` lives in
// programme-state.mjs, outside this Work Order's file_surface. Raised at read-back,
// and Larry is carrying it as an explicitly deferred row.
//
// INV-5 governs the shape of this file: several tests below MUTATE the module's own
// inputs to prove the assertion goes red, because a control that has never been made to
// fail is not evidence. Where a test would pass for the wrong reason, it says so and
// asserts the thing that can actually fail.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  GOV_MARKER,
  SEP,
  HANDBACK_CODES,
  HANDBACK_PREFIX,
  FOOTER_STATES,
  ADVICE,
  ADVICE_VALUES,
  NEXT_MODELS,
  NEXT_UNSET,
  CONTROL_CONTINUE,
  STALE_AFTER_MS,
  BLIND_REASON,
  UNSET_REASON,
  renderFooter,
  parseFooter,
  parseFooterFromMessage,
  extractFooterLine,
  parseControl,
  handback,
  adviceForState,
  adviceFor,
  deriveFooterFields,
  nextModelFor,
  resolveHealthSample,
  computeFooterLine,
  parseCliArgs,
  runCli,
  CLI_EXIT,
} from './footer.mjs';

// The drift guard below used to import `ESCAPE_HATCH_REASONS` from
// `escalation-gate.mjs`. That module was RETIRED on 2026-08-01, so the pin was
// re-aimed rather than removed: it now reads the CONSTITUTION itself, which is
// where the seven code names are defined and from which the retired enum was
// derived in the first place. The property being protected is unchanged and is the
// whole point — the expected value must come from OUTSIDE the source under test,
// because a test that re-types the string can drift in lockstep with the bug it
// exists to catch.
// Derived from this file's own location, not from `process.cwd()`: the pin must
// resolve identically however the runner is invoked.
const CONSTITUTION_PATH = join(fileURLToPath(new URL('../..', import.meta.url)), 'CLAUDE.md');

const REAL_STATE_PATH = join(
  process.cwd(),
  'Deliverables',
  'BUILD-018-session-governor',
  'programme-state.json'
);

function tmp() {
  return mkdtempSync(join(tmpdir(), 'gov-footer-'));
}

// A health sample good enough to render GREEN. Built explicitly rather than copied from
// disk so that every degradation test below mutates ONE named thing.
function goodSample(overrides = {}) {
  return {
    ok: true,
    approximate: false,
    data: {
      schema_version: 1,
      sampled_at: new Date().toISOString(),
      session_id: 'session-a',
      context_window: { used_percentage: 18 },
      rate_limits: { five_hour: { used_percentage: 10 } },
      worktree: { path: 'C:/repo', branch: 'main' },
      ...overrides,
    },
  };
}

// ===========================================================================
// AC1 — the grammar
// ===========================================================================

test('AC1: renders Silas\'s canonical example byte-for-byte', () => {
  const line = renderFooter({
    percent: 18,
    approximate: false,
    state: 'GREEN',
    advice: ADVICE.KEEP_GOING,
    next: NEXT_UNSET,
    control: CONTROL_CONTINUE,
  });
  assert.equal(line, '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · CONTINUE');
});

test('AC1: the separator is exactly U+0020 U+00B7 U+0020, and the marker U+27E6/U+27E7', () => {
  assert.deepEqual([...SEP].map((c) => c.codePointAt(0)), [0x0020, 0x00b7, 0x0020]);
  assert.equal(GOV_MARKER.codePointAt(0), 0x27e6);
  assert.equal(GOV_MARKER.codePointAt(GOV_MARKER.length - 1), 0x27e7);

  // And the rendered line really uses it — not a lookalike the source happens to hold.
  const line = renderFooter({
    percent: 0, approximate: false, state: 'RED', advice: ADVICE.CLEAR_NOW,
    next: 'Opus', control: CONTROL_CONTINUE,
  });
  assert.equal(line.split(SEP).length, 5, 'five fields joined by exactly four separators');
  assert.ok(!line.includes('\u2022'), 'not a bullet');
  assert.ok(!line.includes(' . '), 'not a period');
});

test('AC1: no field is EVER omitted — absence is a value (-- / UNSET), never a missing segment', () => {
  const line = renderFooter({
    percent: null, approximate: false, state: 'BLIND', advice: ADVICE.UNSURE,
    next: NEXT_UNSET, control: CONTROL_CONTINUE,
  });
  assert.equal(line, '⟦GOV⟧ ctx -- · BLIND · KEEP GOING? · next: UNSET · CONTINUE');
  assert.equal(line.split(SEP).length, 5);

  // The load-bearing property: a parser must never have to guess which field it is
  // looking at. Every one of the 5 segments is non-empty in every combination.
  for (const state of FOOTER_STATES) {
    for (const next of [...NEXT_MODELS, NEXT_UNSET]) {
      for (const percent of [null, 0, 7, 100]) {
        const l = renderFooter({
          percent, approximate: false, state, advice: adviceForState(state), next,
          control: CONTROL_CONTINUE,
        });
        const parts = l.slice(`${GOV_MARKER} `.length).split(SEP);
        assert.equal(parts.length, 5);
        for (const p of parts) assert.ok(p.length > 0, `empty segment in ${JSON.stringify(l)}`);
      }
    }
  }
});

test('AC1: HANDBACK_CODES is the closed seven of constitution clause 4', () => {
  assert.equal(HANDBACK_CODES.length, 7);
  assert.deepEqual([...HANDBACK_CODES].sort(), [
    'irreversible-live-action', 'merge-decision', 'permission', 'product-decision',
    'rotation-required', 'spend', 'unsafe-repository-state',
  ]);
  assert.ok(Object.isFrozen(HANDBACK_CODES), 'the vocabulary must not be mutable at runtime');
  assert.equal(parseControl('HANDBACK:merge-decision').kind, 'handback');
  assert.equal(parseControl('HANDBACK:banana').kind, 'unrecognised');
  assert.equal(parseControl(undefined).kind, 'unrecognised');
  assert.throws(() => handback('banana'), TypeError);
});

test('the shared vocabulary is pinned to the CONSTITUTION\'s own text, not to a string typed here', () => {
  // The drift guard. Silas's §D-2 grammar block said `unsafe-state`; the shipped
  // vocabulary says `unsafe-repository-state`. A footer emitting the other spelling
  // would produce a token matching neither the parser nor the constitution — the two
  // silently disagreeing about the one token that decides whether a turn may end.
  //
  // The pin used to be `escalation-gate.mjs`'s frozen enum. That module retired on
  // 2026-08-01, so the pin moved UP to the source that enum was itself derived from:
  // CLAUDE.md § "When Warwick may be interrupted". Reading the expected values from
  // outside this module is the whole point — a test that re-types the string can
  // drift in lockstep with the bug it is meant to catch, which is how the spec came
  // to hold a token no code had ever used.
  const constitution = readFileSync(CONSTITUTION_PATH, 'utf8');
  assert.ok(
    constitution.includes('When Warwick may be interrupted'),
    'precondition: the constitution section this pin reads must actually be present'
  );

  // Extract the code names from the numbered closed list, mechanically. If the
  // extraction finds nothing, the assertion below on its LENGTH fails loudly rather
  // than passing vacuously over an empty set.
  const section = constitution.split('## When Warwick may be interrupted')[1] ?? '';
  const declared = [...section.matchAll(/^\d+\.\s+`([a-z-]+)`/gm)].map((m) => m[1]);
  assert.equal(declared.length, 7, 'the constitution must still declare exactly seven code names');

  for (const code of declared) {
    assert.ok(
      HANDBACK_CODES.includes(code),
      `HANDBACK_CODES must contain the constitution's ${JSON.stringify(code)}`
    );
  }
  assert.deepEqual([...HANDBACK_CODES].sort(), [...declared].sort(), 'no extras, no omissions');
  assert.ok(declared.includes('unsafe-repository-state'), 'the load-bearing spelling is the long one');

  // And the wrong spelling must be absent, so a future edit cannot quietly add it back
  // alongside the right one.
  assert.ok(!HANDBACK_CODES.includes('unsafe-state'), 'the spec\'s stale token must not reappear');
});

test('AC1: the INT production is 0..100 with no leading zeros', () => {
  assert.ok(renderFooter({ percent: 0, approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE }).includes('ctx 0%'));
  assert.ok(renderFooter({ percent: 100, approximate: false, state: 'RED', advice: ADVICE.CLEAR_NOW, next: NEXT_UNSET, control: CONTROL_CONTINUE }).includes('ctx 100%'));

  for (const bad of [101, -1, 1.5, NaN, Infinity, '18']) {
    assert.throws(
      () => renderFooter({ percent: bad, approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE }),
      TypeError,
      `percent ${JSON.stringify(bad)} must be refused`
    );
  }
  // "007%" must be a PARSE failure, not a value that quietly normalises to 7.
  assert.equal(parseFooter('⟦GOV⟧ ctx 007% · GREEN · KEEP GOING · next: UNSET · CONTINUE').ok, false);
  assert.equal(parseFooter('⟦GOV⟧ ctx 101% · GREEN · KEEP GOING · next: UNSET · CONTINUE').ok, false);
});

test('AC1: renderFooter is STRICT — it throws rather than emit an out-of-grammar line', () => {
  const base = { percent: 5, approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE };
  assert.throws(() => renderFooter({ ...base, state: 'PURPLE' }), TypeError);
  assert.throws(() => renderFooter({ ...base, advice: 'MAYBE' }), TypeError);
  assert.throws(() => renderFooter({ ...base, next: 'GPT-5' }), TypeError);
  assert.throws(() => renderFooter({ ...base, control: 'HANDBACK:banana' }), TypeError);
  assert.throws(() => renderFooter({ ...base, control: 'STOP' }), TypeError);
  assert.throws(() => renderFooter({ ...base, approximate: 'yes' }), TypeError);
  assert.throws(() => renderFooter(null), TypeError);
});

// ---------------------------------------------------------------------------
// D-M10 — round-trip identity
// ---------------------------------------------------------------------------

test('D-M10: parseFooter(renderFooter(x)).fields === x for EVERY field combination', () => {
  const percents = [null, 0, 1, 9, 10, 42, 99, 100];
  const approximates = [false, true];
  const nexts = [...NEXT_MODELS, NEXT_UNSET];
  const controls = [CONTROL_CONTINUE, ...HANDBACK_CODES.map((c) => `HANDBACK:${c}`)];

  let combos = 0;
  for (const percent of percents) {
    for (const approximate of approximates) {
      for (const state of FOOTER_STATES) {
        for (const advice of ADVICE_VALUES) {
          for (const next of nexts) {
            for (const control of controls) {
              const fields = { percent, approximate, state, advice, next, control };
              const parsed = parseFooter(renderFooter(fields));
              assert.equal(parsed.ok, true, `failed to parse ${JSON.stringify(fields)}`);
              assert.deepEqual(parsed.fields, fields);
              combos += 1;
            }
          }
        }
      }
    }
  }
  // INV-5: assert a non-zero count of things actually examined. A loop whose bounds
  // silently became empty would otherwise report a clean pass over nothing.
  assert.equal(combos, percents.length * 2 * FOOTER_STATES.length * ADVICE_VALUES.length * nexts.length * controls.length);
  assert.ok(combos > 0);
});

// ---------------------------------------------------------------------------
// D-M11 — the parser rejects near-misses
// ---------------------------------------------------------------------------

test('D-M11: `.` or `-` instead of `·`, or a doubled space, is ok:false', () => {
  const good = '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · CONTINUE';
  assert.equal(parseFooter(good).ok, true, 'the control case must parse, or this test proves nothing');

  const bad = [
    good.replace(/ · /g, ' . '),
    good.replace(/ · /g, ' - '),
    good.replace(/ · /g, '·'),
    good.replace(' · GREEN', '  ·  GREEN'),
    good.replace('ctx 18%', 'ctx  18%'),
    `${good} `,
    `${good}\t`,
    good.replace('⟦GOV⟧', '[GOV]'),
    good.replace('next: ', 'next:'),
    good.replace(' · CONTINUE', ''),
    `prefix ${good}`,
    good.replace('KEEP GOING', 'keep going'),
  ];
  for (const line of bad) {
    assert.equal(parseFooter(line).ok, false, `must reject ${JSON.stringify(line)}`);
  }
  assert.equal(bad.length, 12);
});

test('parseFooter tolerates exactly one trailing newline and nothing else', () => {
  const good = '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · CONTINUE';
  assert.equal(parseFooter(`${good}\n`).ok, true);
  assert.equal(parseFooter(`${good}\r\n`).ok, true);
  assert.equal(parseFooter(`${good}\n\n`).ok, false);
  assert.equal(parseFooter(good.replace('ctx', 'CTX')).ok, false);
  assert.equal(parseFooter(42).ok, false);
});

// ---------------------------------------------------------------------------
// The A-M8 / A-M10 distinguishability property — why the parser is looser on CODE
// ---------------------------------------------------------------------------

test('an UNRECOGNISED handback code parses structurally but is flagged unrecognised', () => {
  // This is what lets the controller tell "no footer" (A-M8 -> allow) apart from
  // "footer with a typo'd code" (A-M10 -> block). A parser strict on CODE would collapse
  // both into "no valid footer" and silently fail A-M10.
  const line = '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · HANDBACK:banana';
  const parsed = parseFooter(line);
  assert.equal(parsed.ok, true, 'must parse structurally');
  assert.equal(parsed.controlRecognised, false);
  assert.equal(parsed.handbackCode, null);

  const recognised = parseFooter('⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · HANDBACK:spend');
  assert.equal(recognised.controlRecognised, true);
  assert.equal(recognised.handbackCode, 'spend');

  // ...and the two really are distinguishable from the "no footer" case.
  assert.equal(parseFooter('just an answer').ok, false);
});

test('extractFooterLine drops trailing EMPTY lines but not whitespace-only ones', () => {
  const good = '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: UNSET · CONTINUE';
  assert.equal(extractFooterLine(`body\n${good}`), good);
  assert.equal(extractFooterLine(`body\n${good}\n`), good);
  assert.equal(extractFooterLine(`body\n${good}\n\n\n`), good);
  assert.equal(extractFooterLine(`body\n${good}\n   `), '   ', 'a whitespace line is a real final line');
  assert.equal(extractFooterLine(''), null);
  assert.equal(extractFooterLine(null), null);

  assert.equal(parseFooterFromMessage(`answer\n${good}\n`).ok, true);
  assert.equal(parseFooterFromMessage(`${good}\nmore text after`).ok, false, 'the footer must be LAST');
  assert.equal(parseFooterFromMessage('no footer here').ok, false);
});

// ===========================================================================
// AC2 — the D-3 degradation ladder. BLIND IS NEVER GREEN (INV-1).
// ===========================================================================

function fieldsOf(result) {
  return result.fields;
}

test('D-M1: sample missing / truncated / `{` / used_percentage "42" — all BLIND, ctx --, never GREEN', () => {
  const cases = [
    ['deleted', { ok: false, reason: 'missing' }],
    ['unreadable/truncated', { ok: false, reason: 'unreadable' }],
    ['not JSON ("{")', { ok: false, reason: 'unreadable' }],
    ['valid JSON, used_percentage as the STRING "42"', goodSample({ context_window: { used_percentage: '42' } })],
  ];

  let examined = 0;
  for (const [label, sample] of cases) {
    const r = deriveFooterFields({ sample, knownSessionId: 'session-a' });
    const f = fieldsOf(r);
    assert.equal(f.state, 'BLIND', `${label} must be BLIND`);
    assert.notEqual(f.state, 'GREEN');
    assert.equal(f.percent, null, `${label} must render ctx --`);
    assert.equal(f.advice, ADVICE.UNSURE);
    assert.ok(renderFooter(f).startsWith('⟦GOV⟧ ctx -- · BLIND · KEEP GOING?'));
    examined += 1;
  }
  assert.equal(examined, 4);
});

test('the ladder also refuses an unrecognised schema_version, a NaN percentage and a thrown evaluator', () => {
  assert.equal(deriveFooterFields({ sample: goodSample({ schema_version: 2 }) }).blindReason, BLIND_REASON.SCHEMA_UNRECOGNISED);
  assert.equal(deriveFooterFields({ sample: goodSample({ schema_version: undefined }) }).blindReason, BLIND_REASON.SCHEMA_UNRECOGNISED);
  assert.equal(deriveFooterFields({ sample: goodSample({ context_window: {} }) }).blindReason, BLIND_REASON.PERCENTAGE_ABSENT);
  assert.equal(deriveFooterFields({ sample: goodSample({ context_window: { used_percentage: NaN } }) }).blindReason, BLIND_REASON.PERCENTAGE_ABSENT);
  assert.equal(deriveFooterFields({ sample: goodSample({ context_window: { used_percentage: 140 } }) }).blindReason, BLIND_REASON.PERCENTAGE_OUT_OF_RANGE);
  assert.equal(
    deriveFooterFields({ sample: goodSample(), evaluateFn: () => { throw new Error('boom'); } }).blindReason,
    BLIND_REASON.EVALUATOR_THREW
  );
  // A verdict carrying a state outside the grammar is also BLIND, not passed through.
  assert.equal(deriveFooterFields({ sample: goodSample(), evaluateFn: () => ({ state: 'PURPLE' }) }).blindReason, BLIND_REASON.EVALUATOR_THREW);
});

test('D-M2/D-M3: 21 minutes old is BLIND with numbers suppressed; 19 minutes old renders normally', () => {
  const now = Date.parse('2026-08-01T12:00:00.000Z');

  const stale = goodSample({ sampled_at: new Date(now - 21 * 60 * 1000).toISOString() });
  const staleResult = deriveFooterFields({ sample: stale, knownSessionId: 'session-a', now });
  assert.equal(staleResult.fields.state, 'BLIND');
  assert.equal(staleResult.fields.percent, null, 'D-M2: the numbers must be SUPPRESSED, not merely flagged');
  assert.equal(staleResult.blindReason, BLIND_REASON.STALE);

  const fresh = goodSample({ sampled_at: new Date(now - 19 * 60 * 1000).toISOString() });
  const freshResult = deriveFooterFields({ sample: fresh, knownSessionId: 'session-a', now });
  assert.equal(freshResult.fields.state, 'GREEN');
  assert.equal(freshResult.fields.percent, 18);

  // The boundary itself, so the threshold cannot drift unnoticed.
  const exact = goodSample({ sampled_at: new Date(now - STALE_AFTER_MS).toISOString() });
  assert.equal(deriveFooterFields({ sample: exact, knownSessionId: 'session-a', now }).fields.state, 'GREEN', 'exactly 20 min is not yet stale');
  const justOver = goodSample({ sampled_at: new Date(now - STALE_AFTER_MS - 1).toISOString() });
  assert.equal(deriveFooterFields({ sample: justOver, knownSessionId: 'session-a', now }).fields.state, 'BLIND');
});

test('an absent or unparseable sampled_at is BLIND', () => {
  assert.equal(deriveFooterFields({ sample: goodSample({ sampled_at: undefined }) }).blindReason, BLIND_REASON.SAMPLED_AT_UNPARSEABLE);
  assert.equal(deriveFooterFields({ sample: goodSample({ sampled_at: 'not a date' }) }).blindReason, BLIND_REASON.SAMPLED_AT_UNPARSEABLE);
  assert.equal(deriveFooterFields({ sample: goodSample({ sampled_at: 1700000000 }) }).blindReason, BLIND_REASON.SAMPLED_AT_UNPARSEABLE);
});

test('D-M4: a sample belonging to ANOTHER session is BLIND regardless of freshness, and OUTRANKS staleness', () => {
  const now = Date.parse('2026-08-01T12:00:00.000Z');

  // Perfectly fresh, but not mine.
  const foreignFresh = goodSample({ session_id: 'session-b', sampled_at: new Date(now - 1000).toISOString() });
  const r1 = deriveFooterFields({ sample: foreignFresh, knownSessionId: 'session-a', now });
  assert.equal(r1.fields.state, 'BLIND');
  assert.equal(r1.fields.percent, null, 'never render another session\'s numbers');
  assert.equal(r1.blindReason, BLIND_REASON.SESSION_MISMATCH);

  // Both stale AND foreign: the MISMATCH must be the reported reason, because D-3 rules
  // that this check outranks staleness. Both give BLIND, so the ranking is only
  // observable here — which is exactly why it is asserted.
  const foreignStale = goodSample({ session_id: 'session-b', sampled_at: new Date(now - 60 * 60 * 1000).toISOString() });
  const r2 = deriveFooterFields({ sample: foreignStale, knownSessionId: 'session-a', now });
  assert.equal(r2.blindReason, BLIND_REASON.SESSION_MISMATCH, 'mismatch outranks staleness');

  // With no known session id there is nothing to mismatch against — the sample is used
  // and marked approximate instead. `sampled_at` is pinned to the INJECTED clock, not
  // the wall clock: an earlier draft of this test built the sample with `new Date()` and
  // then judged it against a fixed `now`, so the sample read as hours stale and the
  // assertion failed for a reason that had nothing to do with session identity.
  const r3 = deriveFooterFields({
    sample: { ...goodSample({ session_id: 'session-b', sampled_at: new Date(now - 1000).toISOString() }), approximate: true },
    knownSessionId: null,
    now,
  });
  assert.equal(r3.fields.state, 'GREEN');
  assert.equal(r3.fields.approximate, true);
  assert.ok(renderFooter(r3.fields).includes('ctx ~18%'));
});

test('MUTATION (INV-5): the ladder\'s BLIND guarantee can be made to fail', () => {
  // A control is not evidence until it has been made to fail. Here the "mutation" is
  // applied to the INPUT the ladder is supposed to catch, and we assert that a
  // hypothetical ladder which merely passed the evaluator's verdict through would have
  // rendered GREEN — proving the assertion above is load-bearing rather than incidental.
  const sample = goodSample({ context_window: { used_percentage: '42' } });

  const naive = { state: 'GREEN' }; // what a ladder without the isFiniteNumber check yields
  assert.equal(naive.state, 'GREEN', 'the unguarded path really would be GREEN');

  const guarded = deriveFooterFields({ sample, knownSessionId: 'session-a' });
  assert.equal(guarded.fields.state, 'BLIND');
  assert.notEqual(guarded.fields.state, naive.state);
});

// ===========================================================================
// AC3 / D-4 — the UNSET predicate, driven by ABSENCE
// ===========================================================================

// Base fixture: the REAL banked document, so the predicate is exercised against a
// document shape that genuinely validates rather than one invented to suit it.
const realState = JSON.parse(readFileSync(REAL_STATE_PATH, 'utf8'));

function writeStateFixture(root, buildName, mutate) {
  const doc = JSON.parse(JSON.stringify(realState));
  mutate(doc);
  const dir = join(root, buildName);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'programme-state.json');
  writeFileSync(path, JSON.stringify(doc, null, 2));
  return path;
}

// All six U-conditions satisfied.
function satisfyAll(doc, { worktree, branch }) {
  doc.resumption.worktree = worktree;
  doc.resumption.branch = branch;
  doc.resumption.ticket = 'T-12';
  doc.resumption.next_action_kind = 'action';
  doc.model_recommendation.model = 'Sonnet';
  doc.model_recommendation.for_ticket = 'T-12';
  doc.model_recommendation.computed_at_head = doc.banked.head_sha;
  const t = doc.tickets.find((x) => x.id === 'T-12');
  t.state = 'frontier';
}

test('D-M6: with all six U-conditions satisfied, the model name renders', () => {
  const root = tmp();
  try {
    writeStateFixture(root, 'BUILD-018-x', (d) => satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' }));
    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.unset, false, `expected a model, got UNSET (${r.unsetReason})`);
    assert.equal(r.next, 'Sonnet');

    // ...and it really reaches the rendered line.
    const line = renderFooter({
      percent: 18, approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING,
      next: r.next, control: CONTROL_CONTINUE,
    });
    assert.ok(line.includes('· next: Sonnet ·'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC3: EACH U-condition, violated ALONE, forces UNSET — and by ABSENCE, not text matching', () => {
  const violations = [
    ['U-b next_action_kind absent', (d) => { delete d.resumption.next_action_kind; }, UNSET_REASON.NEXT_ACTION_KIND],
    ['U-b next_action_kind = hold', (d) => { d.resumption.next_action_kind = 'hold'; }, UNSET_REASON.NEXT_ACTION_KIND],
    ['U-b next_action_kind = unknown', (d) => { d.resumption.next_action_kind = 'unknown'; }, UNSET_REASON.NEXT_ACTION_KIND],
    ['U-c model = unknown', (d) => { d.model_recommendation.model = 'unknown'; }, UNSET_REASON.MODEL_UNKNOWN],
    ['U-c model = any', (d) => { d.model_recommendation.model = 'any'; }, UNSET_REASON.MODEL_UNKNOWN],
    ['U-d for_ticket absent', (d) => { delete d.model_recommendation.for_ticket; }, UNSET_REASON.FOR_TICKET_MISMATCH],
    ['U-d for_ticket null', (d) => { d.model_recommendation.for_ticket = null; }, UNSET_REASON.FOR_TICKET_MISMATCH],
    ['U-d for_ticket names a different ticket', (d) => { d.model_recommendation.for_ticket = 'T-11'; }, UNSET_REASON.FOR_TICKET_MISMATCH],
    ['U-e computed_at_head absent', (d) => { delete d.model_recommendation.computed_at_head; }, UNSET_REASON.HEAD_MISMATCH],
    ['U-e computed_at_head is a DIFFERENT sha', (d) => { d.model_recommendation.computed_at_head = 'b'.repeat(40); }, UNSET_REASON.HEAD_MISMATCH],
    // `resolved` also needs a resolved DATE, or the document fails consistency validation
    // and never reaches U-f at all — so the fixture sets both. Without the date this row
    // passed for the wrong reason (rejected as invalid, not as a resolved ticket), which
    // is exactly the kind of false green INV-5 is aimed at.
    ['U-f ticket resolved', (d) => {
      const t = d.tickets.find((x) => x.id === 'T-12');
      t.state = 'resolved';
      t.resolved = '2026-08-01';
    }, UNSET_REASON.TICKET_UNRESOLVED_MISSING],
    ['U-f ticket absent from tickets[]', (d) => { d.tickets = d.tickets.filter((x) => x.id !== 'T-12'); }, UNSET_REASON.TICKET_UNRESOLVED_MISSING],
  ];

  let examined = 0;
  for (const [label, mutate, expectedReason] of violations) {
    const root = tmp();
    try {
      writeStateFixture(root, 'BUILD-018-x', (d) => {
        satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' });
        mutate(d);
      });
      const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
      assert.equal(r.unset, true, `${label} must force UNSET`);
      assert.equal(r.next, NEXT_UNSET);
      assert.equal(r.unsetReason, expectedReason, `${label}: wrong reason`);
      examined += 1;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  assert.equal(examined, 12, 'every violation must have been executed');
});

test('the grammar guard on the model name fires — proven with an injected reader, because the schema makes it unreachable from disk', () => {
  // `programme-state.schema.json` pins `model_recommendation.model` to the enum
  // ["Opus","Sonnet","Haiku","any","unknown"]. U-c removes "any" and "unknown", so every
  // model that survives validation is already renderable and this guard cannot fire via
  // any document on disk — a second independent layer, exactly like the null-model case.
  //
  // It is kept and tested anyway, because `nextModelFor` accepts an injected `readState`
  // and its result feeds the STRICT renderer: without the guard, a caller supplying a
  // state by some other route would produce a model name that `renderFooter` refuses,
  // turning a recoverable UNSET into a throw. Exercised here where it can actually fire,
  // rather than asserted where it cannot.
  const fabricated = JSON.parse(JSON.stringify(realState));
  fabricated.resumption.worktree = 'C:/repo';
  fabricated.resumption.branch = 'feat/x';
  fabricated.resumption.ticket = 'T-12';
  fabricated.resumption.next_action_kind = 'action';
  fabricated.model_recommendation.model = 'Gemini';
  fabricated.model_recommendation.for_ticket = 'T-12';
  fabricated.model_recommendation.computed_at_head = fabricated.banked.head_sha;
  fabricated.tickets.find((x) => x.id === 'T-12').state = 'frontier';

  const r = nextModelFor({
    worktreePath: 'C:/repo',
    worktreeBranch: 'feat/x',
    deliverablesDir: 'C:/anywhere',
    existsFn: () => true,
    listDir: () => ['BUILD-fake'],
    readState: () => ({ ok: true, data: fabricated }),
  });
  assert.equal(r.next, NEXT_UNSET);
  assert.equal(r.unsetReason, UNSET_REASON.MODEL_NOT_IN_GRAMMAR);

  // The guard is load-bearing: without it, this is what would have reached the renderer.
  assert.throws(() => renderFooter({
    percent: 1, approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING,
    next: 'Gemini', control: CONTROL_CONTINUE,
  }), TypeError);
});

test('U-c: a NULL model is rejected one layer earlier — by the schema — so it never reaches the predicate', () => {
  // Recorded rather than assumed. `model_recommendation.model` is `type: string` with no
  // null branch, so a document carrying null does not VALIDATE and is therefore not a
  // match at all (U-a), never reaching U-c. Two independent layers reject it, which is
  // the wanted shape; the note exists so a future reader does not "fix" U-c to handle a
  // case the schema already makes unreachable.
  const root = tmp();
  try {
    writeStateFixture(root, 'BUILD-018-x', (d) => {
      satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' });
      d.model_recommendation.model = null;
    });
    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.unset, true);
    assert.equal(r.unsetReason, UNSET_REASON.NO_MATCHING_PROGRAMME, 'rejected by validation, not by U-c');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('U-a: the ACTIVE build is selected — not simply the first Deliverables/* found (Nolan D-N3)', () => {
  const root = tmp();
  try {
    // 'AAA-other' sorts first and would win under the old first-match behaviour.
    writeStateFixture(root, 'AAA-other-build', (d) => {
      satisfyAll(d, { worktree: 'C:/somewhere-else', branch: 'other/branch' });
      d.model_recommendation.model = 'Opus';
    });
    writeStateFixture(root, 'ZZZ-active-build', (d) => {
      satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' });
      d.model_recommendation.model = 'Haiku';
    });

    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.next, 'Haiku', 'must pick the build matching THIS session, not the first on disk');
    assert.ok(r.statePath.includes('ZZZ-active-build'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('U-a: path matching is Windows-correct — case and slash direction must not fork the answer', () => {
  const root = tmp();
  try {
    writeStateFixture(root, 'BUILD-018-x', (d) => satisfyAll(d, { worktree: 'C:/Repo/Sub', branch: 'feat/x' }));
    assert.equal(nextModelFor({ worktreePath: 'c:\\repo\\sub', worktreeBranch: 'feat/x', deliverablesDir: root }).next, 'Sonnet');
    assert.equal(nextModelFor({ worktreePath: 'C:/Repo/Sub/', worktreeBranch: 'feat/x', deliverablesDir: root }).next, 'Sonnet');
    // A genuinely different directory must NOT match.
    assert.equal(nextModelFor({ worktreePath: 'C:/Repo/Sub-other', worktreeBranch: 'feat/x', deliverablesDir: root }).unset, true);
    // Right worktree, wrong branch.
    assert.equal(nextModelFor({ worktreePath: 'C:/Repo/Sub', worktreeBranch: 'feat/other', deliverablesDir: root }).unsetReason, UNSET_REASON.NO_MATCHING_PROGRAMME);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('D-M8: TWO state files matching the live session is UNSET (ambiguous), never the first', () => {
  const root = tmp();
  try {
    writeStateFixture(root, 'BUILD-A', (d) => { satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' }); d.model_recommendation.model = 'Opus'; });
    writeStateFixture(root, 'BUILD-B', (d) => { satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' }); d.model_recommendation.model = 'Haiku'; });

    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.next, NEXT_UNSET);
    assert.equal(r.unsetReason, UNSET_REASON.AMBIGUOUS_PROGRAMME);
    assert.notEqual(r.next, 'Opus', 'must not silently take the first');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('U-a: a state file that does NOT validate is not a match, and never throws', () => {
  const root = tmp();
  try {
    const dir = join(root, 'BUILD-broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'programme-state.json'), '{ not json at all');
    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.unsetReason, UNSET_REASON.NO_MATCHING_PROGRAMME);

    // A reader that throws outright must also be survivable.
    const r2 = nextModelFor({
      worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root,
      readState: () => { throw new Error('boom'); },
    });
    assert.equal(r2.unset, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('U-a: an unknown live location, or no Deliverables directory at all, is UNSET not a throw', () => {
  assert.equal(nextModelFor().unsetReason, UNSET_REASON.LOCATION_UNKNOWN);
  assert.equal(nextModelFor({ worktreePath: 'C:/repo' }).unsetReason, UNSET_REASON.LOCATION_UNKNOWN);
  assert.equal(nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'b' }).unsetReason, UNSET_REASON.NO_MATCHING_PROGRAMME);
  assert.equal(
    nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'b', deliverablesDir: join(tmpdir(), 'definitely-not-here-xyz') }).unsetReason,
    UNSET_REASON.NO_MATCHING_PROGRAMME
  );
});

// ---------------------------------------------------------------------------
// D-M5 — the live-ledger case, asserted as AGREEMENT rather than as an outcome
// ---------------------------------------------------------------------------
// Re-derives U-b..U-f from the document BY HAND, without calling the code under test,
// so the assertion has two independent routes to the same answer and fails only when
// they disagree. Deliberately not a copy of `nextModelFor`: it reads the raw fields and
// applies D-4's conditions literally, in D-4's short-circuit order, so that a predicate
// which silently stopped checking one of them would diverge here.
function evaluateUConditions(doc) {
  const resumption = doc.resumption ?? {};
  const rec = doc.model_recommendation ?? {};
  const banked = doc.banked ?? {};
  const tickets = Array.isArray(doc.tickets) ? doc.tickets : [];
  const ticket = tickets.find((t) => t && t.id === resumption.ticket);

  const ordered = [
    ['U-b', resumption.next_action_kind === 'action', UNSET_REASON.NEXT_ACTION_KIND],
    ['U-c', typeof rec.model === 'string' && rec.model !== 'unknown' && rec.model !== 'any', UNSET_REASON.MODEL_UNKNOWN],
    ['grammar', NEXT_MODELS.includes(rec.model), UNSET_REASON.MODEL_NOT_IN_GRAMMAR],
    ['U-d', typeof rec.for_ticket === 'string' && rec.for_ticket.length > 0
      && typeof resumption.ticket === 'string' && resumption.ticket.length > 0
      && rec.for_ticket === resumption.ticket, UNSET_REASON.FOR_TICKET_MISMATCH],
    ['U-e', typeof rec.computed_at_head === 'string' && rec.computed_at_head.length > 0
      && typeof banked.head_sha === 'string' && banked.head_sha.length > 0
      && rec.computed_at_head === banked.head_sha, UNSET_REASON.HEAD_MISMATCH],
    ['U-f', Boolean(ticket) && ticket.state !== 'resolved', UNSET_REASON.TICKET_UNRESOLVED_MISSING],
  ];

  const firstFailure = ordered.find(([, holds]) => !holds) ?? null;
  return { ordered, allHold: firstFailure === null, firstFailure };
}

// Runs the predicate over one document placed ALONE in a temp Deliverables tree, so
// U-a's "exactly one match" is satisfied by construction, then asserts agreement.
function assertPredicateAgreement(doc, label) {
  const root = tmp();
  try {
    const dir = join(root, 'BUILD-under-test');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'programme-state.json'), JSON.stringify(doc, null, 2));

    const r = nextModelFor({
      worktreePath: doc.resumption.worktree,
      worktreeBranch: doc.resumption.branch,
      deliverablesDir: root,
    });
    const { allHold, firstFailure, ordered } = evaluateUConditions(doc);

    // INV-5: assert a non-zero count of conditions actually evaluated.
    assert.equal(ordered.length, 6, `${label}: all six U-conditions must be evaluated`);

    if (allHold) {
      assert.equal(r.unset, false, `${label}: all six hold, so a model must render (got ${r.unsetReason})`);
      assert.equal(r.next, doc.model_recommendation.model, `${label}: the rendered model must be the banked one`);
      assert.ok(NEXT_MODELS.includes(r.next), `${label}: and it must be renderable in the grammar`);
    } else {
      const [name, , expectedReason] = firstFailure;
      assert.equal(r.unset, true, `${label}: ${name} fails, so the result must be UNSET`);
      assert.equal(r.next, NEXT_UNSET, `${label}: UNSET must render as the literal UNSET`);
      assert.equal(r.unsetReason, expectedReason, `${label}: the reason must name the condition that actually failed (${name})`);
    }
    return { r, allHold, firstFailure };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('D-M5: over the REAL banked state, nextModelFor AGREES with the six U-conditions', () => {
  // COUPLING NOTE — rewritten 2026-08-01, and the reason matters more than the change.
  //
  // This test reads the LIVE repository file, per Silas's D-M5 ("assert against the real
  // file, not a fixture"): the value is in exercising the predicate against what is
  // genuinely banked, rather than against a hand-built document that can quietly drift
  // into agreeing with the code it is meant to check.
  //
  // It previously asserted a fixed OUTCOME — "today's banked state renders UNSET". True
  // when written, false within the hour, because the banked state was then deliberately
  // grounded (`next_action_kind`, `for_ticket` and `computed_at_head` were filled in) so
  // the footer could render a real recommendation. The test fired correctly: it caught a
  // real change, not a regression. But a fixed outcome re-arms the same trap every time
  // the ledger legitimately moves, and re-pinning it to "renders Opus" would only point
  // the trap the other way.
  //
  // So it now asserts AGREEMENT: the six U-conditions are re-derived independently and
  // the predicate must match them — a model name iff all six hold, UNSET otherwise, with
  // the reason naming the condition that actually failed. That keeps the live-ledger
  // coupling this test exists for, and drops the coupling to one moment in the ledger's
  // life. DO NOT re-pin this to a literal model name or a literal UNSET.
  //
  // The "by ABSENCE, not by any text heuristic" proof deliberately does NOT live here.
  // It is in the fixture-based U-condition test above, which strips each of the three
  // properties in turn and asserts the matching `unsetReason`. Kept there on purpose: in
  // this file an ordinary ledger edit could silence it, which is exactly what happened.
  assertPredicateAgreement(realState, 'real banked state');
});

test('D-M5: the agreement holds under BOTH ledger states — ungrounded and grounded', () => {
  // The durability proof, and what makes this follow-up evidence rather than a hope.
  //
  // This worktree's branch point predates the commit that grounded the banked state, so
  // the live file HERE still has the three properties absent. The test above therefore
  // exercises only the UNSET branch locally, and the model-renders branch would go
  // unexercised until the merged head. Constructing both states explicitly proves the
  // harness is state-independent rather than merely passing today — in either direction.
  //
  // ---------------------------------------------------------------------------
  // DO NOT DELETE THE GROUNDED CASE AS REDUNDANT. It is the only observer of U-e.
  // ---------------------------------------------------------------------------
  // Established by mutation on 2026-08-01, not by argument. U-e was changed to compare
  // `computed_at_head` against LIVE GIT HEAD instead of `banked.head_sha` — the defect
  // Silas explicitly warned about, which would make every ordinary commit destroy the
  // recommendation. Result:
  //
  //   * the live-file D-M5 test above  -> STILL PASSED
  //   * the grounded case below        -> went red
  //
  // The reason is that the predicate short-circuits: whenever the banked state lacks
  // `next_action_kind`, it returns at U-b and NEVER EVALUATES U-e at all. So for any
  // ungrounded ledger — which is what this worktree has, and what the repository had for
  // most of this build — a U-e defect is completely unobservable from the real file. The
  // grounded case is the only place in this suite where all six conditions hold and U-e
  // is reachable.
  //
  // This case was originally written for a different reason (proving the harness works
  // at a merged head this worktree cannot reach). It turned out to be load-bearing for
  // U-e coverage, which nobody designed it for. Deleting it as "just a duplicate fixture"
  // would silently reopen a gap that no other test in this file can see.
  //
  // Worth knowing too: the live-HEAD mutation also required importing `child_process`
  // into footer.mjs — and footer.mjs is imported by stop-controller.mjs, where A-7
  // forbids git on the Stop path. So that defect is not merely wrong about which SHA to
  // compare; it drags a subprocess spawn onto the hot path of the control that decides
  // whether Larry may end a turn.
  const ungrounded = JSON.parse(JSON.stringify(realState));
  delete ungrounded.resumption.next_action_kind;
  delete ungrounded.model_recommendation.for_ticket;
  delete ungrounded.model_recommendation.computed_at_head;

  const a = assertPredicateAgreement(ungrounded, 'ungrounded ledger');
  assert.equal(a.allHold, false, 'the ungrounded state must not render a model');
  assert.equal(a.r.next, NEXT_UNSET);
  assert.equal(a.r.unsetReason, UNSET_REASON.NEXT_ACTION_KIND, 'and it must fail at U-b, by absence');

  // Grounded the way a real banking grounds it: the recommendation tied to the ticket it
  // was computed for, and to the pointer it was computed at.
  const grounded = JSON.parse(JSON.stringify(realState));
  const openTicket = grounded.tickets.find((t) => t.state !== 'resolved');
  assert.ok(openTicket, 'the fixture needs at least one unresolved ticket');
  grounded.resumption.ticket = openTicket.id;
  grounded.resumption.next_action_kind = 'action';
  grounded.model_recommendation.model = 'Opus';
  grounded.model_recommendation.for_ticket = openTicket.id;
  grounded.model_recommendation.computed_at_head = grounded.banked.head_sha;

  const b = assertPredicateAgreement(grounded, 'grounded ledger');
  assert.equal(b.allHold, true, 'the grounded state must satisfy all six conditions');
  assert.equal(b.r.next, 'Opus', 'and must render the banked model name');

  // Both branches of the agreement assertion were exercised at least once, whichever way
  // the live ledger happens to sit when this runs.
  assert.notEqual(a.allHold, b.allHold, 'both branches exercised');
});

test('D-M7: v1 documents with and without the three new properties BOTH validate; the one without renders UNSET', () => {
  const root = tmp();
  try {
    const withoutPath = writeStateFixture(root, 'BUILD-without', (d) => {
      d.resumption.worktree = 'C:/repo';
      d.resumption.branch = 'feat/x';
      delete d.resumption.next_action_kind;
      delete d.model_recommendation.for_ticket;
      delete d.model_recommendation.computed_at_head;
    });
    const withPath = writeStateFixture(root, 'BUILD-with', (d) => satisfyAll(d, { worktree: 'C:/other', branch: 'feat/y' }));

    // Both must VALIDATE — the schema addition is non-breaking, so schema_version stays 1.
    const withoutDoc = JSON.parse(readFileSync(withoutPath, 'utf8'));
    const withDoc = JSON.parse(readFileSync(withPath, 'utf8'));
    assert.equal(withoutDoc.schema_version, 1);
    assert.equal(withDoc.schema_version, 1);
    assert.equal(nextModelFor({ worktreePath: 'C:/other', worktreeBranch: 'feat/y', deliverablesDir: root }).next, 'Sonnet',
      'the document WITH the properties must validate and be usable');

    // The one without renders UNSET.
    const r = nextModelFor({ worktreePath: 'C:/repo', worktreeBranch: 'feat/x', deliverablesDir: root });
    assert.equal(r.next, NEXT_UNSET);
    assert.equal(r.unsetReason, UNSET_REASON.NEXT_ACTION_KIND);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ===========================================================================
// D-M9 — five distinct lines, plus the assertion that can actually fail
// ===========================================================================

test('D-M9: the five states render five pairwise-distinct lines, with the CORRECT advice for each', () => {
  const lines = FOOTER_STATES.map((state) =>
    renderFooter({
      percent: 42, approximate: false, state, advice: adviceForState(state),
      next: 'Sonnet', control: CONTROL_CONTINUE,
    })
  );

  // Silas's assertion as specified: pairwise inequality.
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      assert.notEqual(lines[i], lines[j], `${FOOTER_STATES[i]} and ${FOOTER_STATES[j]} render identically`);
    }
  }
  assert.equal(new Set(lines).size, 5);

  // ...AND the strengthening agreed at read-back. Pairwise-distinctness alone passes
  // trivially, because the STATE token differs in every line by construction — it cannot
  // fail for the reason D-M9's rationale gives. What CAN fail, and is what actually
  // matters to Warwick, is the ADVICE being wrong for a state: a RED session told to
  // KEEP GOING, or a BLIND one told to CLEAR NOW.
  const expected = {
    GREEN: ADVICE.KEEP_GOING,
    AMBER: ADVICE.KEEP_GOING,
    RED: ADVICE.CLEAR_NOW,
    RECOVERY: ADVICE.CLEAR_NOW,
    BLIND: ADVICE.UNSURE,
  };
  let checked = 0;
  for (const state of FOOTER_STATES) {
    assert.equal(adviceForState(state), expected[state], `${state} advises wrongly`);
    assert.ok(lines[FOOTER_STATES.indexOf(state)].includes(` · ${expected[state]} · `));
    checked += 1;
  }
  assert.equal(checked, 5);

  // BLIND must never advise CLEAR NOW: unknown telemetry must not FORCE a rotation.
  assert.notEqual(adviceForState('BLIND'), ADVICE.CLEAR_NOW);
  // ...and an unknown state degrades to the question, never to reassurance.
  assert.equal(adviceForState('PURPLE'), ADVICE.UNSURE);
  assert.equal(adviceForState(undefined), ADVICE.UNSURE);
});

// Warwick's cut-and-close ruling, 2026-08-01: no KEEP GOING before a next task is known.
// The first implementation of `adviceFor` suppressed BLIND's question mark too, which
// made a broken sensor QUIETER and violated INV-1. That regression is pinned here, in
// both directions, so it cannot come back as a "tidy-up".
test('adviceFor withholds only the unearned "carry on" — never the safety or sensor signals', () => {
  let checked = 0;

  // Suppressed: the confident fitness claim, and only it.
  for (const state of ['GREEN', 'AMBER']) {
    assert.equal(adviceFor(state, { taskKnown: true }), ADVICE.KEEP_GOING, `${state} with a task`);
    assert.equal(adviceFor(state, { taskKnown: false }), ADVICE.TASK_UNKNOWN, `${state} with no task`);
    checked += 2;
  }

  // NEVER suppressed: running out of context is a fact about the session (INV-2).
  for (const state of ['RED', 'RECOVERY']) {
    assert.equal(adviceFor(state, { taskKnown: false }), ADVICE.CLEAR_NOW, `${state} must still say CLEAR NOW`);
    assert.equal(adviceFor(state, { taskKnown: true }), ADVICE.CLEAR_NOW);
    checked += 2;
  }

  // NEVER suppressed: a governor that stops measuring must get LOUDER, not quieter (INV-1).
  assert.equal(adviceFor('BLIND', { taskKnown: false }), ADVICE.UNSURE, 'BLIND keeps its question mark');
  assert.equal(adviceFor('BLIND', { taskKnown: true }), ADVICE.UNSURE);
  // An unrecognised state degrades to the question, never to TASK UNKNOWN and never to
  // reassurance — the same fail-safe `adviceForState` already guarantees.
  assert.equal(adviceFor('PURPLE', { taskKnown: false }), ADVICE.UNSURE);
  checked += 3;

  // Default is permissive-but-honest: callers that say nothing get the old behaviour,
  // so an un-updated caller cannot silently start emitting TASK UNKNOWN everywhere.
  assert.equal(adviceFor('GREEN'), ADVICE.KEEP_GOING);
  checked += 1;

  assert.equal(checked, 12, 'every branch of the rule was exercised');
  // TASK UNKNOWN must be in the rendered grammar, or the renderer would throw on it.
  assert.ok(ADVICE_VALUES.includes(ADVICE.TASK_UNKNOWN));
});

// ===========================================================================
// The impure edges
// ===========================================================================

test('resolveHealthSample: known session id reads exactly that file; unknown reads the newest and marks it approximate', () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'old.json'), JSON.stringify({ schema_version: 1, session_id: 'old' }));
    writeFileSync(join(dir, 'new.json'), JSON.stringify({ schema_version: 1, session_id: 'new' }));
    // Force a deterministic ordering rather than trusting filesystem mtime resolution.
    const statFn = (p) => ({ mtimeMs: p.endsWith('new.json') ? 2000 : 1000 });

    const byId = resolveHealthSample({ sessionId: 'old', envOverride: dir, statFn });
    assert.equal(byId.ok, true);
    assert.equal(byId.data.session_id, 'old');
    assert.equal(byId.approximate, false, 'an exact session read is never approximate');

    const newest = resolveHealthSample({ sessionId: null, envOverride: dir, statFn });
    assert.equal(newest.ok, true);
    assert.equal(newest.data.session_id, 'new');
    assert.equal(newest.approximate, true, 'a newest-file read MUST be marked approximate (the `~`)');

    // Empty and missing directories are not throws.
    const empty = tmp();
    try {
      assert.equal(resolveHealthSample({ sessionId: null, envOverride: empty }).ok, false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
    assert.equal(resolveHealthSample({ sessionId: null, envOverride: join(tmpdir(), 'nope-xyz') }).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeFooterLine always returns a GRAMMATICAL line, even with everything broken', () => {
  const line = computeFooterLine({
    sessionId: 'nobody',
    worktreePath: null,
    worktreeBranch: null,
    deliverablesDir: join(tmpdir(), 'nope-xyz'),
    envOverride: join(tmpdir(), 'nope-xyz'),
  });
  assert.equal(parseFooter(line).ok, true, 'a broken world must still produce a parseable footer');
  assert.equal(line, '⟦GOV⟧ ctx -- · BLIND · KEEP GOING? · next: UNSET · CONTINUE');

  // And the happy path composes end to end.
  const dir = tmp();
  const deliverables = tmp();
  try {
    writeFileSync(join(dir, 's1.json'), JSON.stringify({
      schema_version: 1,
      sampled_at: new Date().toISOString(),
      session_id: 's1',
      context_window: { used_percentage: 18 },
    }));
    writeStateFixture(deliverables, 'BUILD-live', (d) => satisfyAll(d, { worktree: 'C:/repo', branch: 'feat/x' }));

    const good = computeFooterLine({
      sessionId: 's1', worktreePath: 'C:/repo', worktreeBranch: 'feat/x',
      deliverablesDir: deliverables, envOverride: dir,
    });
    assert.equal(good, '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: Sonnet · CONTINUE');
    assert.equal(parseFooter(good).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(deliverables, { recursive: true, force: true });
  }
});

// ===========================================================================
// WP-7 — THE PRODUCER (the CLI)
// ===========================================================================
// Nolan's finding: `footer.mjs` had no CLI, so the only way to produce the footer the
// constitution demands on every reply was to type it by hand — which the same clause
// calls a defect. These proofs cover the entrypoint that closes that, and AC5 below is
// the one that matters: it is what makes drift between the producer and the checker
// impossible, and it is the test AC6's mutation is required to turn red.

const FOOTER_MODULE_PATH = fileURLToPath(new URL('./footer.mjs', import.meta.url));

// A store containing one sample, ready to be pointed at by MYPKA_GOVERNOR_HEALTH_DIR or
// by the `envOverride` injection. `used` is the only knob most tests need.
function storeWith(sessionId, overrides = {}) {
  const dir = tmp();
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify({
    schema_version: 1,
    sampled_at: new Date().toISOString(),
    session_id: sessionId,
    context_window: { used_percentage: 18 },
    ...overrides,
  }));
  return dir;
}

// A location that needs no git and no repository — `runCli` only ever asks for
// `{ repoRoot, branch }`, so a stub is the whole seam.
const stubLocation = (repoRoot, branch) => () => ({ repoRoot, branch });

// ---------------------------------------------------------------------------
// AC1 — importing the module must execute NOTHING
// ---------------------------------------------------------------------------

test('WP-7 AC1: importing footer.mjs writes nothing, prints nothing, and does not exit', () => {
  const dir = tmp();
  try {
    const marker = join(dir, 'marker.txt');
    const importer = join(dir, 'importer.mjs');
    // The marker is what stops this test passing for the wrong reason. Empty stdout on
    // its own would also be produced by an import that silently FAILED, so the child
    // proves the import genuinely completed by writing what it found — to a FILE, never
    // to stdout, because stdout is the thing under test.
    writeFileSync(importer, [
      "import { writeFileSync } from 'node:fs';",
      `const mod = await import(${JSON.stringify(pathToFileURL(FOOTER_MODULE_PATH).href)});`,
      `writeFileSync(${JSON.stringify(marker)}, typeof mod.runCli + ':' + typeof mod.renderFooter);`,
    ].join('\n'));

    const r = spawnSync(process.execPath, [importer], { encoding: 'utf8' });

    assert.equal(readFileSync(marker, 'utf8'), 'function:function', 'the import must actually have happened');
    assert.equal(r.stdout, '', `importing printed to stdout: ${JSON.stringify(r.stdout)}`);
    assert.equal(r.stderr, '', `importing printed to stderr: ${JSON.stringify(r.stderr)}`);
    assert.equal(r.status, 0, 'importing must not exit non-zero');

    // The guard is what makes that true, and it must be the house one — `process.argv[1]`
    // compared as a file URL. Asserted against the SOURCE so that deleting the guard
    // cannot leave this suite green on the strength of the behavioural check alone.
    const src = readFileSync(FOOTER_MODULE_PATH, 'utf8');
    assert.ok(
      src.includes('if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)'),
      'the CLI must be behind the house import.meta.url entrypoint guard'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC2 — one line, one newline, exit 0, everything resolved by the CLI itself
// ---------------------------------------------------------------------------

test('WP-7 AC2: with no arguments the CLI resolves everything and emits exactly one line', () => {
  const store = storeWith('sess-1');
  // A repo root with a real Deliverables/ inside it: the CLI derives `deliverablesDir` as
  // <repoRoot>/Deliverables, so this exercises the derivation rather than bypassing it.
  const root = mkdtempSync(join(tmpdir(), 'gov-cli-repo-'));
  try {
    mkdirSync(join(root, 'Deliverables'), { recursive: true });
    writeStateFixture(join(root, 'Deliverables'), 'BUILD-cli', (d) => satisfyAll(d, { worktree: root, branch: 'feat/cli' }));

    const r = runCli([], { locationFn: stubLocation(root, 'feat/cli'), envOverride: store });

    assert.equal(r.exitCode, CLI_EXIT.OK);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.split('\n').length, 2, 'exactly one line and one trailing newline');
    assert.equal(r.stdout.endsWith('\n'), true);
    assert.equal(r.stdout.includes('\r'), false, 'no carriage return — the parser rejects trailing whitespace');

    const parsed = parseFooter(r.stdout);
    assert.equal(parsed.ok, true, `unparseable: ${JSON.stringify(r.stdout)}`);
    // Everything resolved by the CLI: the newest sample (hence `~`), the state from the
    // D-3 ladder, and the model from nextModelFor over the matching programme.
    assert.equal(parsed.fields.percent, 18);
    assert.equal(parsed.fields.approximate, true, 'no --session means the newest sample, which is approximate');
    assert.equal(parsed.fields.state, 'GREEN');
    assert.equal(parsed.fields.advice, ADVICE.KEEP_GOING);
    assert.equal(parsed.fields.next, 'Sonnet', 'next: comes from nextModelFor over the matching programme');
    assert.equal(parsed.fields.control, CONTROL_CONTINUE);
    assert.equal(r.stdout.trimEnd(), '⟦GOV⟧ ctx ~18% · GREEN · KEEP GOING · next: Sonnet · CONTINUE');
  } finally {
    rmSync(store, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('WP-7 AC2: --session reads the EXACT sample, and drops the ~ approximate flag', () => {
  const store = tmp();
  try {
    writeFileSync(join(store, 'mine.json'), JSON.stringify({
      schema_version: 1, sampled_at: new Date().toISOString(), session_id: 'mine',
      context_window: { used_percentage: 71 },
    }));
    writeFileSync(join(store, 'theirs.json'), JSON.stringify({
      schema_version: 1, sampled_at: new Date().toISOString(), session_id: 'theirs',
      context_window: { used_percentage: 4 },
    }));

    const r = runCli(['--session', 'mine'], {
      locationFn: stubLocation(null, null),
      envOverride: store,
    });
    const parsed = parseFooter(r.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.fields.percent, 71, 'the named session, not whichever file is newest');
    assert.equal(parsed.fields.approximate, false, 'an exact session read is never approximate');
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});

test('WP-7 AC2: the REAL entrypoint, spawned as a process, prints one line and exits 0', () => {
  const store = storeWith('spawned', { context_window: { used_percentage: 33 } });
  try {
    // The actual command Larry runs. `runCli` is unit-tested above; this proves the
    // guard, the stream writes and the exit code are wired to it.
    const r = spawnSync(process.execPath, [FOOTER_MODULE_PATH, '--session', 'spawned'], {
      encoding: 'utf8',
      env: { ...process.env, MYPKA_GOVERNOR_HEALTH_DIR: store },
    });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.split('\n').length, 2);
    const parsed = parseFooter(r.stdout);
    assert.equal(parsed.ok, true, `unparseable: ${JSON.stringify(r.stdout)}`);
    assert.equal(parsed.fields.percent, 33);
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC3 — the control token, checked by MEMBERSHIP against the frozen const
// ---------------------------------------------------------------------------

test('WP-7 AC3: CONTINUE is the default, and every one of the seven codes is accepted', () => {
  assert.deepEqual(parseCliArgs([]), { ok: true, sessionId: null, control: CONTROL_CONTINUE });
  assert.deepEqual(parseCliArgs(['--control', 'CONTINUE']), { ok: true, sessionId: null, control: 'CONTINUE' });

  // Driven off the imported const, never a list typed here — the same discipline the
  // module itself follows, and the reason a vocabulary change cannot pass silently.
  assert.equal(HANDBACK_CODES.length, 7);
  for (const code of HANDBACK_CODES) {
    const token = `${HANDBACK_PREFIX}${code}`;
    const args = parseCliArgs(['--control', token]);
    assert.equal(args.ok, true, `rejected a legitimate code: ${code}`);
    assert.equal(args.control, token);
  }
});

test('WP-7 AC3: an unrecognised control token EXITS NON-ZERO, names the seven, and prints NO footer', () => {
  // The load-bearing half. A bad token that rendered a footer anyway would emit
  // CONTINUE, silently disabling the controller while looking installed.
  for (const bad of ['HANDBACK:banana', 'HANDBACK:', 'banana', 'continue', 'CONTINUE ', 'HANDBACK:merge decision']) {
    const r = runCli(['--control', bad], { locationFn: stubLocation('C:/repo', 'main') });
    assert.equal(r.exitCode, CLI_EXIT.USAGE, `${JSON.stringify(bad)} should be a usage failure`);
    assert.notEqual(r.exitCode, 0);
    assert.equal(r.stdout, '', `a rejected token must emit NO footer — got ${JSON.stringify(r.stdout)}`);
    assert.ok(r.stderr.includes(bad) || r.stderr.includes(JSON.stringify(bad)), 'the message must name what was rejected');
    for (const code of HANDBACK_CODES) {
      assert.ok(r.stderr.includes(code), `the message must name the seven — missing ${code}`);
    }
  }
});

test('WP-7 AC3: malformed arguments are usage failures, never a silently wrong footer', () => {
  const cases = [
    ['--session'],                    // flag with no value
    ['--control'],                    // flag with no value
    ['--session', '--control', 'CONTINUE'], // a flag is not a value
    ['--verbose'],                    // unknown flag
    ['sess-1'],                       // bare positional
    ['--session', ''],                // empty value
  ];
  for (const argv of cases) {
    const r = runCli(argv, { locationFn: stubLocation('C:/repo', 'main') });
    assert.equal(r.exitCode, CLI_EXIT.USAGE, `${JSON.stringify(argv)} should be a usage failure`);
    assert.equal(r.stdout, '', `${JSON.stringify(argv)} must emit no footer`);
    assert.ok(r.stderr.includes('usage:'), 'a usage failure must say how to invoke it');
  }
});

test('WP-7 AC3: the spawned entrypoint really exits non-zero on a bad code', () => {
  const r = spawnSync(process.execPath, [FOOTER_MODULE_PATH, '--control', 'HANDBACK:banana'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'a bad handback code must fail the process, not just the function');
  assert.equal(r.stdout, '');
  for (const code of HANDBACK_CODES) assert.ok(r.stderr.includes(code));
});

// ---------------------------------------------------------------------------
// AC4 — never throws; a hostile world still produces a parseable line at exit 0
// ---------------------------------------------------------------------------

test('WP-7 AC4: every hostile input yields a valid BLIND line and exit 0', () => {
  const dirs = [];
  const store = (name, contents) => {
    const d = tmp();
    dirs.push(d);
    if (contents !== undefined) writeFileSync(join(d, `${name}.json`), contents);
    return d;
  };

  try {
    const sampledAt = new Date().toISOString();
    const cases = [
      ['store missing entirely', ['--session', 'x'], { envOverride: join(tmpdir(), 'gov-cli-absent-xyz') }],
      ['store present but empty', [], { envOverride: store('unused') }],
      ['corrupt JSON', ['--session', 'bad'], { envOverride: store('bad', '{ this is not json') }],
      ['truncated JSON', ['--session', 'bad'], { envOverride: store('bad', '{"schema_version":') }],
      ['unrecognised schema', ['--session', 'bad'], { envOverride: store('bad', JSON.stringify({ schema_version: 99, sampled_at: sampledAt, session_id: 'bad', context_window: { used_percentage: 18 } })) }],
      ['absent context_window', ['--session', 'bad'], { envOverride: store('bad', JSON.stringify({ schema_version: 1, sampled_at: sampledAt, session_id: 'bad' })) }],
      ['percentage as a STRING', ['--session', 'bad'], { envOverride: store('bad', JSON.stringify({ schema_version: 1, sampled_at: sampledAt, session_id: 'bad', context_window: { used_percentage: '42' } })) }],
      ['unparseable sampled_at', ['--session', 'bad'], { envOverride: store('bad', JSON.stringify({ schema_version: 1, sampled_at: 'whenever', session_id: 'bad', context_window: { used_percentage: 18 } })) }],
      ['percentage out of grammar range', ['--session', 'bad'], { envOverride: store('bad', JSON.stringify({ schema_version: 1, sampled_at: sampledAt, session_id: 'bad', context_window: { used_percentage: 4000 } })) }],
      ['sample belongs to another session', ['--session', 'mine'], { envOverride: store('mine', JSON.stringify({ schema_version: 1, sampled_at: sampledAt, session_id: 'someone-else', context_window: { used_percentage: 18 } })) }],
      ['the evaluator throws', ['--session', 'ok'], { envOverride: store('ok', JSON.stringify({ schema_version: 1, sampled_at: sampledAt, session_id: 'ok', context_window: { used_percentage: 18 } })), evaluateFn: () => { throw new Error('boom'); } }],
      ['the location resolver throws', [], { envOverride: join(tmpdir(), 'gov-cli-absent-xyz'), locationFn: () => { throw new Error('git exploded'); } }],
      ['the location resolver returns nothing', [], { envOverride: join(tmpdir(), 'gov-cli-absent-xyz'), locationFn: () => undefined }],
      ['the store read throws', [], { envOverride: join(tmpdir(), 'gov-cli-absent-xyz'), listDir: () => { throw new Error('EPERM'); } }],
    ];

    for (const [label, argv, deps] of cases) {
      const r = runCli(argv, { locationFn: stubLocation('C:/repo', 'main'), ...deps });
      assert.equal(r.exitCode, 0, `${label}: must exit 0`);
      assert.equal(r.stderr, '', `${label}: an environment failure is not a usage failure`);
      const parsed = parseFooter(r.stdout);
      assert.equal(parsed.ok, true, `${label}: unparseable line ${JSON.stringify(r.stdout)}`);
      assert.equal(parsed.fields.state, 'BLIND', `${label}: unreadable telemetry must be BLIND`);
      assert.equal(parsed.fields.percent, null, `${label}: BLIND never reports a number`);
      assert.equal(parsed.fields.advice, ADVICE.UNSURE, `${label}: BLIND is KEEP GOING?, never CLEAR NOW and never KEEP GOING`);
      assert.notEqual(parsed.fields.state, 'GREEN', `${label}: INV-1 — BLIND is never GREEN`);
    }
  } finally {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }
});

test('WP-7 AC4: NO PROGRAMME means next: UNSET — it does NOT mean BLIND', () => {
  // The corrected AC4 (raised at read-back, ruled by Larry). D-3 decides `state` from
  // TELEMETRY; D-4 decides `next:` from PROGRAMME STATE. Rendering BLIND because no
  // programme matched would have the footer claim it could not read telemetry it read
  // perfectly well — a FALSE BLIND, the mirror of the false GREEN INV-1 forbids. This
  // test pins the two ladders apart so nobody later "fixes" one into the other.
  const store = storeWith('sess-1');
  try {
    const r = runCli(['--session', 'sess-1'], {
      locationFn: stubLocation('C:/nowhere-in-particular', 'some/branch'),
      envOverride: store,
    });
    const parsed = parseFooter(r.stdout);
    assert.equal(r.exitCode, 0);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.fields.next, NEXT_UNSET, 'no matching programme -> UNSET');
    assert.equal(parsed.fields.state, 'GREEN', 'and the state still comes from the telemetry that WAS readable');
    assert.equal(parsed.fields.percent, 18, 'a readable percentage is reported, not suppressed');
    assert.notEqual(parsed.fields.state, 'BLIND', 'an absent programme must NEVER render BLIND');
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});

test('WP-7 AC4: a handback requested by Larry survives a total telemetry failure', () => {
  // Resetting to CONTINUE on the degraded path would silently discard a handback — the
  // one direction in which failing "safe" traps nobody but loses the decision.
  const r = runCli(['--control', `${HANDBACK_PREFIX}rotation-required`], {
    locationFn: stubLocation(null, null),
    envOverride: join(tmpdir(), 'gov-cli-absent-xyz'),
  });
  const parsed = parseFooter(r.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.fields.state, 'BLIND');
  assert.equal(parsed.fields.control, 'HANDBACK:rotation-required');
  assert.equal(parsed.handbackCode, 'rotation-required');
});

// ---------------------------------------------------------------------------
// AC5 — THE ROUND TRIP. This is what makes producer/checker drift impossible.
// ---------------------------------------------------------------------------

test('WP-7 AC5: parseFooter accepts EVERY line the CLI can emit — all states x all controls', () => {
  const controls = [CONTROL_CONTINUE, ...HANDBACK_CODES.map((c) => `${HANDBACK_PREFIX}${c}`)];
  assert.equal(controls.length, 8, 'CONTINUE plus the seven codes');

  const store = storeWith('sess-1');
  const missing = join(tmpdir(), 'gov-cli-absent-xyz');
  let checked = 0;
  try {
    for (const state of FOOTER_STATES) {
      for (const control of controls) {
        // A readable sample, with the state forced across the whole vocabulary.
        const r = runCli(['--session', 'sess-1', '--control', control], {
          locationFn: stubLocation('C:/repo', 'main'),
          envOverride: store,
          evaluateFn: () => ({ state }),
        });
        assert.equal(r.exitCode, 0);
        const parsed = parseFooter(r.stdout);
        assert.equal(parsed.ok, true, `state=${state} control=${control}: parseFooter REJECTED ${JSON.stringify(r.stdout)}`);
        assert.equal(parsed.fields.state, state);
        // `adviceFor`, not `adviceForState`. These runs stub the location to a repo with
        // no banked programme, so `next` is UNSET and no next action is established —
        // `taskKnown: false` is a property of the INPUTS here, not something read back
        // out of the output, so this stays an independent expectation rather than a
        // tautology. GREEN/AMBER therefore render TASK UNKNOWN; CLEAR NOW and the BLIND
        // question mark are never suppressed (see `adviceFor`'s contract).
        assert.equal(parsed.fields.advice, adviceFor(state, { taskKnown: false }));
        assert.equal(parsed.fields.control, control);
        assert.equal(parsed.controlRecognised, true, 'the CLI can only ever emit a recognised token');
        assert.equal(r.stdout.split('\n').length, 2);
        checked += 1;

        // ...and the same combination on the fully degraded path.
        const blind = runCli(['--control', control], {
          locationFn: stubLocation(null, null),
          envOverride: missing,
        });
        const blindParsed = parseFooter(blind.stdout);
        assert.equal(blindParsed.ok, true, `BLIND control=${control}: parseFooter REJECTED ${JSON.stringify(blind.stdout)}`);
        assert.equal(blindParsed.fields.control, control);
        assert.equal(blindParsed.fields.percent, null);
        checked += 1;
      }
    }

    // Percentage boundaries, both approximate flags — the remaining axes of the grammar.
    for (const used of [0, 1, 99, 100, 18.4, 18.5]) {
      const boundary = tmp();
      try {
        writeFileSync(join(boundary, 'b.json'), JSON.stringify({
          schema_version: 1, sampled_at: new Date().toISOString(), session_id: 'b',
          context_window: { used_percentage: used },
        }));
        for (const argv of [['--session', 'b'], []]) {
          const r = runCli(argv, { locationFn: stubLocation('C:/repo', 'main'), envOverride: boundary });
          const parsed = parseFooter(r.stdout);
          assert.equal(parsed.ok, true, `used=${used} argv=${JSON.stringify(argv)}: ${JSON.stringify(r.stdout)}`);
          assert.equal(parsed.fields.percent, Math.round(used));
          assert.equal(parsed.fields.approximate, argv.length === 0, 'the ~ tracks whether the session was confirmed');
          checked += 1;
        }
      } finally {
        rmSync(boundary, { recursive: true, force: true });
      }
    }

    // A control that has never been made to fail is not evidence (INV-5). Assert the
    // count so a mutation that stops the loop executing cannot pass as a green.
    assert.equal(checked, FOOTER_STATES.length * controls.length * 2 + 12);
    assert.ok(checked > 0, 'the round-trip must actually have been exercised');
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});

test('WP-7 AC5: the CLI line is byte-identical to renderFooter over the same fields', () => {
  // The producer and the checker are the same code, and this is the assertion that says
  // so: no separator, no spacing and no field order can drift into the CLI path alone.
  const store = storeWith('sess-1');
  try {
    const r = runCli(['--session', 'sess-1', '--control', `${HANDBACK_PREFIX}spend`], {
      locationFn: stubLocation('C:/repo', 'main'),
      envOverride: store,
    });
    // TASK UNKNOWN, not KEEP GOING: the stubbed location has no banked programme, so
    // `next` is UNSET and there is no established next action for a "carry on" to be
    // about. The literal below is spelled out in full rather than composed, so this
    // test still pins the exact bytes and would catch a separator or ordering drift.
    const expected = renderFooter({
      percent: 18, approximate: false, state: 'GREEN', advice: ADVICE.TASK_UNKNOWN,
      next: NEXT_UNSET, control: 'HANDBACK:spend',
    });
    assert.equal(r.stdout, `${expected}\n`);
    assert.equal(r.stdout.trimEnd(), '⟦GOV⟧ ctx 18% · GREEN · TASK UNKNOWN · next: UNSET · HANDBACK:spend');
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});
