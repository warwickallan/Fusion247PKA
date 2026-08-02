// Proofs for footer.mjs (BUILD-018 WP-3, D-D).
//
// Covers Silas's D-M1..D-M11. D-M12 (`deriveResumption` must not carry a `hold`
// forward) is CLOSED rather than deferred: `deriveResumption` lived in
// programme-state.mjs, which WO-OR-05 deleted along with the programme state it read.
// The deferred row it was carried as is closed by the deletion, not by a proof.
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
  NEXT_EFFORTS,
  NEXT_VALUES,
  NEXT_UNSET,
  TOKENS_GRAIN,
  isRenderableTokens,
  formatTokens,
  parseTokens,
  toRenderableTokens,
  CONTROL_CONTINUE,
  STALE_AFTER_MS,
  BLIND_REASON,
  renderFooter,
  parseFooter,
  parseFooterFromMessage,
  extractFooterLine,
  parseControl,
  handback,
  adviceForState,
  adviceFor,
  deriveFooterFields,
  resolveHealthSample,
  computeFooterLine,
  parseCliArgs,
  runCli,
  CLI_EXIT,
} from './footer.mjs';
// WO-OR-08: the seam block at the foot of this file drives a REAL sampler output into
// the ladder. Every other test here builds its inputs by hand, which is exactly how a
// denominator from the wrong namespace crossed this boundary through a green suite.
import { extractTranscriptSample, SOURCE_STATUSLINE } from './sampler.mjs';

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
    next: 'Opus/high', control: CONTROL_CONTINUE,
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
    for (const next of NEXT_VALUES) {
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
  // WIDENED by WO-OR-05, not weakened: the field set grew from six keys to eight (the
  // token numerator and denominator), and `next` grew from 4 values to 16. Every
  // combination is still enumerated exhaustively and the executed count is still
  // asserted against the product of the dimensions, so a loop whose bounds silently
  // collapsed would still be caught.
  //
  // The CTX field has four SHAPES and they are not independent of each other — a
  // denominator with no numerator is not renderable — so the shapes are enumerated as
  // triples rather than as three free dimensions.
  const ctxShapes = [
    { percent: null, usedTokens: null, windowTokens: null },   // ctx --
    { percent: 0, usedTokens: null, windowTokens: null },      // ctx 0%
    { percent: 42, usedTokens: null, windowTokens: null },     // ctx 42%
    { percent: 100, usedTokens: null, windowTokens: null },
    { percent: null, usedTokens: 0, windowTokens: null },      // ctx 0k
    { percent: null, usedTokens: 900, windowTokens: null },    // ctx 0.9k
    { percent: null, usedTokens: 72600, windowTokens: null },  // ctx 72.6k
    { percent: 21, usedTokens: 210800, windowTokens: 1000000 }, // ctx 21% (210.8k/1000k)
    { percent: 36, usedTokens: 72600, windowTokens: 200000 },
  ];
  const approximates = [false, true];
  const controls = [CONTROL_CONTINUE, ...HANDBACK_CODES.map((c) => `HANDBACK:${c}`)];

  let combos = 0;
  for (const ctx of ctxShapes) {
    for (const approximate of approximates) {
      for (const state of FOOTER_STATES) {
        for (const advice of ADVICE_VALUES) {
          for (const next of NEXT_VALUES) {
            for (const control of controls) {
              const fields = { ...ctx, approximate, state, advice, next, control };
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
  assert.equal(
    combos,
    ctxShapes.length * approximates.length * FOOTER_STATES.length * ADVICE_VALUES.length *
      NEXT_VALUES.length * controls.length
  );
  assert.ok(combos > 0);
});

test('WO-OR-05: the four CTX shapes render the exact bytes ruled for them', () => {
  // The bytes Warwick reads. Pinned as literals held OUTSIDE the module that produces
  // them, so a change to the renderer cannot quietly redefine what "correct" means.
  const base = { approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: 'Opus/high', control: CONTROL_CONTINUE };
  const cases = [
    [{ percent: null, usedTokens: null, windowTokens: null }, '⟦GOV⟧ ctx -- · GREEN · KEEP GOING · next: Opus/high · CONTINUE'],
    [{ percent: 38, usedTokens: null, windowTokens: null }, '⟦GOV⟧ ctx 38% · GREEN · KEEP GOING · next: Opus/high · CONTINUE'],
    [{ percent: null, usedTokens: 72600, windowTokens: null }, '⟦GOV⟧ ctx 72.6k · GREEN · KEEP GOING · next: Opus/high · CONTINUE'],
    [{ percent: 38, usedTokens: 72600, windowTokens: 190000 }, '⟦GOV⟧ ctx 38% (72.6k/190k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE'],
  ];
  for (const [ctx, expected] of cases) {
    assert.equal(renderFooter({ ...base, ...ctx }), expected);
  }
  assert.equal(cases.length, 4);
});

test('WO-OR-05: the token codec is EXACT over its whole grain, both directions', () => {
  // D-M10 identity depends on this being exact, not approximate. Rounding inside the
  // renderer would break the round-trip silently, so the renderer REFUSES an
  // off-grain value and the producer is the one that rounds.
  const pairs = [[0, '0k'], [100, '0.1k'], [900, '0.9k'], [1000, '1k'], [72600, '72.6k'], [190000, '190k'], [1000000, '1000k']];
  for (const [n, text] of pairs) {
    assert.equal(formatTokens(n), text, `format ${n}`);
    assert.equal(parseTokens(text), n, `parse ${text}`);
  }
  assert.equal(pairs.length, 7);

  // MUTATION: an off-grain count is REFUSED by the renderer rather than rounded.
  assert.equal(isRenderableTokens(72_601), false);
  assert.throws(() => formatTokens(72_601), TypeError);
  assert.throws(() => renderFooter({ percent: null, usedTokens: 72_601, windowTokens: null, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE }), TypeError);
  // and the producer-side rounding puts it back on the grain.
  assert.equal(toRenderableTokens(72_601), 72_600);
  assert.equal(toRenderableTokens(72_651), 72_700);
  assert.equal(toRenderableTokens(-1), null);
  assert.equal(toRenderableTokens(Number.NaN), null);
  assert.equal(TOKENS_GRAIN, 100);
});

test('WO-OR-05: a denominator with nothing to divide is REFUSED, never silently dropped', () => {
  const base = { approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE };
  assert.throws(() => renderFooter({ ...base, percent: null, usedTokens: null, windowTokens: 190000 }), TypeError);
  assert.throws(() => renderFooter({ ...base, percent: 38, usedTokens: null, windowTokens: 190000 }), TypeError);
  assert.throws(() => renderFooter({ ...base, percent: null, usedTokens: 72600, windowTokens: 190000 }), TypeError);
  assert.throws(() => renderFooter({ ...base, percent: 38, usedTokens: 72600, windowTokens: 0 }), TypeError);
});

test('WO-OR-05: `next:` carries MODEL AND EFFORT, and both vocabularies are closed', () => {
  assert.deepEqual(NEXT_MODELS, ['Opus', 'Sonnet', 'Haiku']);
  assert.deepEqual(NEXT_EFFORTS, ['low', 'medium', 'high', 'xhigh', 'max']);
  // DERIVED, not hand-listed — 3 x 5 + UNSET.
  assert.equal(NEXT_VALUES.length, NEXT_MODELS.length * NEXT_EFFORTS.length + 1);
  assert.ok(NEXT_VALUES.includes(NEXT_UNSET));

  // MUTATION: the BARE model form is no longer grammatical, in EITHER direction. This
  // is the assertion that proves the effort half is required rather than decorative.
  const bare = `${GOV_MARKER} ctx 38%${SEP}GREEN${SEP}KEEP GOING${SEP}next: Opus${SEP}CONTINUE`;
  assert.equal(parseFooter(bare).ok, false, 'the parser must reject a model with no effort');
  assert.throws(
    () => renderFooter({ percent: 38, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: 'Opus', control: CONTROL_CONTINUE }),
    TypeError,
    'and the renderer must refuse to emit one'
  );
  // An effort outside the closed five is refused too.
  assert.throws(() => renderFooter({ percent: 38, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: 'Opus/turbo', control: CONTROL_CONTINUE }), TypeError);
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
// THE D-4 / `nextModelFor` SECTION WAS DELETED HERE BY WO-OR-05
// ===========================================================================
// Roughly a dozen tests lived here. Every one of them built a scratch worktree
// carrying `Deliverables/<id>/programme-state.json`, then asserted that one of six
// U-conditions did or did not let a model name reach the footer. Both the predicate
// and the programme state are deleted, so there is no weakened version of these tests
// that still means something — the subject of the assertions is gone.
//
// THE COUNT DROPS AND THAT IS NOT A REGRESSION HIDDEN IN A DIFF: this file falls by
// about a dozen tests and the fall is reported as measured. Deleting tests for deleted
// behaviour is legitimate; deleting them quietly is not.
//
// What the section actually protected — that a model must never be presented as live
// advice unless it is grounded in a real, current next action — is now structural. A
// recommendation cannot come from a stale file because no file supplies it; it comes
// from a caller who knows the next action, and `--next` is validated by membership at
// the CLI boundary. That boundary IS tested, under WP-7 AC3 below.
test('D-M9: the five states render five pairwise-distinct lines, with the CORRECT advice for each', () => {
  const lines = FOOTER_STATES.map((state) =>
    renderFooter({
      percent: 42, approximate: false, state, advice: adviceForState(state),
      next: 'Sonnet/medium', control: CONTROL_CONTINUE,
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

  // And the happy path composes end to end. `next` is now an INPUT rather than something
  // read out of a scratch programme-state fixture, which is why this no longer builds a
  // Deliverables tree — there is nothing left on disk for it to read.
  const dir = tmp();
  try {
    writeFileSync(join(dir, 's1.json'), JSON.stringify({
      schema_version: 1,
      sampled_at: new Date().toISOString(),
      session_id: 's1',
      context_window: { used_percentage: 18 },
    }));

    const good = computeFooterLine({ sessionId: 's1', envOverride: dir, next: 'Sonnet/medium' });
    assert.equal(good, '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: Sonnet/medium · CONTINUE');
    assert.equal(parseFooter(good).ok, true);

    // WO-OR-05: a caller passing an out-of-grammar recommendation gets UNSET rather than
    // a throw or a silenced footer. The CLI is the layer that refuses a typo loudly (see
    // WP-7 AC3); the programmatic path must always return a grammatical line.
    const coerced = computeFooterLine({ sessionId: 's1', envOverride: dir, next: 'GPT-5' });
    assert.equal(coerced, '⟦GOV⟧ ctx 18% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');

    // And the end-to-end TOKEN path — the shape Warwick actually gets on web/Android.
    writeFileSync(join(dir, 's2.json'), JSON.stringify({
      schema_version: 1,
      sampled_at: new Date().toISOString(),
      session_id: 's2',
      source: 'transcript',
      context_window: { used_percentage: null, used_tokens: 210_781, context_window_size: 1_000_000 },
    }));
    const tokens = computeFooterLine({ sessionId: 's2', envOverride: dir, next: 'Opus/high' });
    assert.equal(tokens, '⟦GOV⟧ ctx 21% (210.8k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE');

    // Numerator only: a REAL number and an honest BLIND, never `--` and never a graded
    // state over a denominator nobody supplied.
    writeFileSync(join(dir, 's3.json'), JSON.stringify({
      schema_version: 1,
      sampled_at: new Date().toISOString(),
      session_id: 's3',
      source: 'transcript',
      context_window: { used_percentage: null, used_tokens: 210_781, context_window_size: null },
    }));
    const bare = computeFooterLine({ sessionId: 's3', envOverride: dir, next: 'Opus/high' });
    assert.equal(bare, '⟦GOV⟧ ctx 210.8k · BLIND · KEEP GOING? · next: Opus/high · CONTINUE');
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
  try {
    const r = runCli([], { envOverride: store });

    assert.equal(r.exitCode, CLI_EXIT.OK);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.split('\n').length, 2, 'exactly one line and one trailing newline');
    assert.equal(r.stdout.endsWith('\n'), true);
    assert.equal(r.stdout.includes('\r'), false, 'no carriage return — the parser rejects trailing whitespace');

    const parsed = parseFooter(r.stdout);
    assert.equal(parsed.ok, true, `unparseable: ${JSON.stringify(r.stdout)}`);
    // Everything resolved by the CLI: the newest sample (hence `~`) and the state from the
    // degradation ladder. `next:` is UNSET because none was supplied — WO-OR-05 deleted
    // the programme-state lookup that used to answer it, and the CLI no longer shells out
    // to git to find a worktree to match against.
    assert.equal(parsed.fields.percent, 18);
    assert.equal(parsed.fields.approximate, true, 'no --session means the newest sample, which is approximate');
    assert.equal(parsed.fields.state, 'GREEN');
    assert.equal(parsed.fields.next, NEXT_UNSET);
    assert.equal(parsed.fields.control, CONTROL_CONTINUE);
    assert.equal(r.stdout.trimEnd(), '⟦GOV⟧ ctx ~18% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');

    // WO-OR-05: --next is what puts a recommendation on the line, and it carries EFFORT.
    const withNext = runCli(['--next', 'Opus/xhigh'], { envOverride: store });
    assert.equal(withNext.exitCode, CLI_EXIT.OK);
    assert.equal(
      withNext.stdout.trimEnd(),
      '⟦GOV⟧ ctx ~18% · GREEN · KEEP GOING · next: Opus/xhigh · CONTINUE',
      'and supplying one flips the advice off TASK UNKNOWN, because now there is a purpose to be fit for'
    );
  } finally {
    rmSync(store, { recursive: true, force: true });
  }
});

test('WP-7 AC3: a MISTYPED --next fails loudly and prints no footer', () => {
  // The split that matters: the programmatic API coerces an unknown value to UNSET so a
  // line is always produced, but a human typo at the CLI must NOT silently render UNSET —
  // that would be indistinguishable from an honest "no recommendation available".
  for (const bad of ['Opus', 'opus/high', 'Opus/turbo', 'GPT-5', 'Opus/']) {
    const r = runCli(['--next', bad]);
    assert.equal(r.exitCode, CLI_EXIT.USAGE, `--next ${bad} must be a usage failure`);
    assert.equal(r.stdout, '', 'no footer on a usage failure');
    assert.match(r.stderr, /--next must be/);
  }
  // Control: every legal value is accepted, so the check above is not simply refusing all.
  for (const good of NEXT_VALUES) {
    assert.equal(runCli(['--next', good], { envOverride: tmp() }).exitCode, CLI_EXIT.OK, good);
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
  assert.deepEqual(parseCliArgs([]), { ok: true, sessionId: null, next: NEXT_UNSET, control: CONTROL_CONTINUE });
  assert.deepEqual(parseCliArgs(['--control', 'CONTINUE']), { ok: true, sessionId: null, next: NEXT_UNSET, control: 'CONTINUE' });

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

// ===========================================================================
// WO-OR-08 — THE SEAM: extractTranscriptSample -> deriveFooterFields -> renderFooter
// ===========================================================================
//
// WHY THIS BLOCK EXISTS. Every test above this line drives the ladder and the renderer
// from SYNTHETIC fields — `goodSample()` and the 46,080-combination round-trip both
// build their inputs by hand. Nothing drove a REAL `extractTranscriptSample` output
// across into `deriveFooterFields`. That gap is not academic: it is precisely why a
// denominator from the wrong namespace rendered a 1M-context session at roughly five
// times its true percentage, graded AMBER, advising rotation — through a green suite.
//
// A round-trip over invented fields proves the CODEC. It cannot prove that the two
// halves agree about what they are exchanging. These tests cross that seam.
//
// FIXTURES ONLY. No live machine transcript and no live health store is read here, so
// this passes in CI and in a fresh worktree. The store contents below are modelled on
// the real ones, but they are written by this test.

/** A statusLine observation, in the shape the real health store holds. */
function seamObservation(id, size, at) {
  return JSON.stringify({
    schema_version: 1,
    sampled_at: at,
    session_id: `obs-${id}-${size}`,
    source: SOURCE_STATUSLINE,
    model: { id },
    context_window: { context_window_size: size },
  });
}

/** A one-line JSONL transcript carrying a single assistant usage block. */
function seamTranscript(dir, { usedTokens, model }) {
  const p = join(dir, 'transcript.jsonl');
  writeFileSync(p, JSON.stringify({
    type: 'assistant',
    sessionId: 'seam-session',
    effort: 'high',
    message: { model, usage: { input_tokens: usedTokens } },
  }) + '\n');
  return p;
}

const SEAM_AT = '2026-08-02T05:22:31.045Z';
const SEAM_NOW = Date.parse(SEAM_AT) + 1000; // fresh, so staleness is never the reason

/** The seam, walked exactly as the Stop hook and the footer do. */
function walkSeam(dir, { model, usedTokens }) {
  const sample = extractTranscriptSample({
    transcriptPath: seamTranscript(dir, { usedTokens, model }),
    sessionId: 'seam-session',
    sampledAt: SEAM_AT,
    env: {},
    storeOpts: { envOverride: dir },
  });
  // THE WRAPPER. `deriveFooterFields` consumes a health-store READ RESULT, not a bare
  // sample. See the contract test below for why this line is load-bearing.
  const derived = deriveFooterFields({
    sample: { ok: true, approximate: false, data: sample },
    knownSessionId: 'seam-session',
    now: SEAM_NOW,
  });
  return { sample, derived, line: renderFooter(derived.fields) };
}

test('WO-OR-08 SEAM: an ambiguous store yields a TRUE token count and NO graded percentage', () => {
  // THE REGRESSION. The store holds a 1M observation under a variant-suffixed id and an
  // unrelated 200k observation under the bare id; the transcript reports the BARE id.
  // Before the repair this rendered a confident percentage over the borrowed 200k window
  // for a session that was actually about a tenth used, and GRADED it. The number
  // Warwick reads must now be true or absent, never wrong.
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'a.json'), seamObservation('claude-opus-5[1m]', 1000000, '2026-08-01T00:49:52Z'));
    writeFileSync(join(dir, 'b.json'), seamObservation('claude-opus-5', 200000, '2026-08-01T00:49:56Z'));

    const { sample, derived, line } = walkSeam(dir, { model: 'claude-opus-5', usedTokens: 111019 });

    // The sampler's half of the seam.
    assert.equal(sample.context_window.used_tokens, 111019, 'the numerator is real');
    assert.equal(sample.context_window.context_window_size, null, 'and no denominator was established');

    // The footer's half.
    assert.equal(derived.blind, true);
    assert.equal(derived.blindReason, BLIND_REASON.WINDOW_SIZE_UNKNOWN);
    assert.equal(derived.fields.percent, null, 'NO percentage is rendered');
    assert.equal(derived.fields.usedTokens, 111000, 'but the real count still reaches Warwick');
    assert.equal(derived.fields.state, 'BLIND');

    // The bytes. Pinned as a literal, and pinned NEGATIVELY against the exact lie.
    // `KEEP GOING?` — not `TASK UNKNOWN` — is correct and deliberate here: BLIND is a
    // SENSOR-failure signal and `adviceFor` never suppresses it, because a governor that
    // stops measuring must get louder, not quieter (INV-1).
    assert.equal(line, '⟦GOV⟧ ctx 111k · BLIND · KEEP GOING? · next: UNSET · CONTINUE');
    assert.doesNotMatch(line, /\d+%/, 'no percentage may appear in this line at all');
    assert.doesNotMatch(line, /AMBER/, 'and it must never be GRADED off a borrowed window');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08 SEAM: an UNAMBIGUOUS store renders a real, graded percentage end to end', () => {
  // The positive control for the seam. If the repair had simply made the footer
  // permanently BLIND, the test above would still pass and this one would fail.
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'a.json'), seamObservation('claude-opus-5', 1000000, '2026-08-01T00:49:52Z'));

    const { sample, derived, line } = walkSeam(dir, { model: 'claude-opus-5', usedTokens: 111019 });

    assert.equal(sample.context_window.context_window_size, 1000000, 'the denominator IS established');
    assert.equal(sample.context_window.context_window_source, 'statusline-observed');
    assert.equal(derived.blind, false);
    assert.equal(derived.fields.percent, 11, 'the TRUE figure, not the one the old rule produced');
    assert.equal(derived.fields.state, 'GREEN');
    assert.equal(line, '⟦GOV⟧ ctx 11% (111k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-08 SEAM: the WRAPPER CONTRACT is pinned — a bare sample is silently indistinguishable from telemetry loss', () => {
  // THE SHAPE HAZARD, made executable.
  //
  // `deriveFooterFields` consumes `{ ok: true, data: <sample> }` — a health-store READ
  // RESULT. `extractTranscriptSample` returns the BARE sample. Hand the bare sample
  // straight over and the ladder's first rung rejects it as unreadable, producing a
  // perfectly ordinary BLIND footer whose reason is `sample-missing-or-unreadable` —
  // byte-identical to what a total telemetry failure produces. A caller that gets this
  // wrong gets NO signal: no throw, no distinct reason, no different line.
  //
  // DECIDED (WO-OR-08, Larry concurring): pin the contract HERE rather than make the
  // boundary refuse loudly. Refusing loudly would mean a new `BLIND_REASON` member and a
  // rung in `deriveFooterFields` — a change to footer.mjs, outside this Work Order's
  // file surface — and it sits awkwardly against that function's never-throws,
  // always-returns-a-grammatical-line invariant. The follow-up is recorded in the
  // handback. Until it lands, THIS test is the control.
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'a.json'), seamObservation('claude-opus-5', 1000000, '2026-08-01T00:49:52Z'));
    const sample = extractTranscriptSample({
      transcriptPath: seamTranscript(dir, { usedTokens: 111019, model: 'claude-opus-5' }),
      sessionId: 'seam-session',
      sampledAt: SEAM_AT,
      env: {},
      storeOpts: { envOverride: dir },
    });
    assert.ok(sample && sample.context_window.used_tokens === 111019, 'the sample itself is good');

    const args = { knownSessionId: 'seam-session', now: SEAM_NOW };
    const wrapped = deriveFooterFields({ sample: { ok: true, approximate: false, data: sample }, ...args });
    const bare = deriveFooterFields({ sample, ...args });
    const absent = deriveFooterFields({ sample: null, ...args });

    // 1. The CORRECT shape works, and is the contract every caller must use.
    assert.equal(wrapped.blind, false);
    assert.equal(wrapped.fields.percent, 11);
    assert.equal(wrapped.blindReason, null);

    // 2. The WRONG shape fails, and fails INVISIBLY. This is the hazard, asserted rather
    //    than described: identical reason AND identical rendered bytes to no telemetry.
    assert.equal(bare.blind, true);
    assert.equal(bare.blindReason, BLIND_REASON.SAMPLE_UNREADABLE);
    assert.deepEqual(bare.fields, absent.fields);
    assert.equal(bare.blindReason, absent.blindReason);
    assert.equal(renderFooter(bare.fields), renderFooter(absent.fields));

    // 3. And the two shapes genuinely differ, so this test cannot pass vacuously.
    assert.notEqual(renderFooter(wrapped.fields), renderFooter(bare.fields));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
