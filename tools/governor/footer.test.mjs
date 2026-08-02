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
  refreshSampleFromTranscript,
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
    // WO-OR-10: the largest count the codec is faithful over, carried through the FULL
    // combination sweep rather than only through its own boundary test — the boundary
    // has to survive every state, advice, next and control too, not just the happy one.
    { percent: null, usedTokens: 9007199254740900, windowTokens: null },
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

// ---------------------------------------------------------------------------
// WO-OR-10 — THE ACCEPTED DOMAIN AND THE REPRESENTABLE DOMAIN MUST AGREE
// ---------------------------------------------------------------------------
// D3 states `parseFooter(renderFooter(x)) === x` as a criterion. It did not hold. Three
// defects, ONE principle — refuse what cannot be represented — and none of them was a
// live rendering bug: no path through `deriveFooterFields` reaches any of the three
// (verified by sweeping the producer over 1,080 realistic telemetry combinations, 0
// hits). They are defects in a CODEC that other code calls, and that is why they are
// worth closing.
//
//   F1  renderFooter accepted `percent` + `usedTokens` with a null `windowTokens` and
//       silently DROPPED the numerator, because the parenthesised pair is emitted only
//       when a denominator is present. Found by Codex; rated ACTIVE by Codex and
//       correctly re-rated LATENT by Larry against execution.
//   F2  `isRenderableTokens` accepted counts beyond `Number.MAX_SAFE_INTEGER`, where
//       the format/parse pair is no longer exact. Codex claimed this and named `1e24`;
//       Larry's probe showed `1e24` is REJECTED for an unrelated reason and recorded
//       F2 as disproven. Both point-checks were right; the generalisation was not.
//   §4  `toRenderableTokens` — the MIRROR of F1: the PRODUCER emitting what the
//       renderer refuses, despite documenting itself as doing the opposite.
//
// THE BOUNDARY, stated once: the codec is faithful over exactly the non-negative
// multiples of TOKENS_GRAIN that are SAFE INTEGERS. Below that bound the round-trip is
// exact BY CONSTRUCTION — `whole * 1000` stays inside 2^53 so the reconstruction is
// exact arithmetic, and `whole < 1e21` so `String` never reaches exponent notation.
// Above it, survival is incidental. That is a FIDELITY bound, not a plausibility bound;
// a "no real window exceeds N tokens" rule would be a meaning judgement, and this
// module keeps meaning in the producer and fidelity in the codec.

test('WO-OR-10 F1: percent + usedTokens with NO windowTokens is REFUSED, not silently dropped', () => {
  // The exact case Codex reported, pinned as the literal field object it filed.
  // Before this repair it returned "⟦GOV⟧ ctx 38% · GREEN · KEEP GOING · next: UNSET ·
  // CONTINUE" and `parseFooter(...).fields.usedTokens` came back `null`, not 72600.
  const reported = {
    percent: 38, usedTokens: 72600, windowTokens: null, approximate: false,
    state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE,
  };
  assert.throws(() => renderFooter(reported), TypeError, 'the numerator must not be silently discarded');

  // The zero edge and the boundary percent, so the refusal is not keyed to one value.
  const base = { approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE };
  assert.throws(() => renderFooter({ ...base, percent: 0, usedTokens: 0, windowTokens: null }), TypeError);
  assert.throws(() => renderFooter({ ...base, percent: 100, usedTokens: 900, windowTokens: null }), TypeError);

  // CONTROL — the three shapes that REMAIN legal must still render and still round-trip,
  // or this test would pass just as well against a renderer that refused everything.
  for (const ctx of [
    { percent: 38, usedTokens: null, windowTokens: null },
    { percent: null, usedTokens: 72600, windowTokens: null },
    { percent: 38, usedTokens: 72600, windowTokens: 190000 },
  ]) {
    const fields = { ...base, ...ctx };
    const parsed = parseFooter(renderFooter(fields));
    assert.equal(parsed.ok, true, `the legal shape ${JSON.stringify(ctx)} must still render`);
    assert.deepEqual(parsed.fields, fields);
  }
});

test('WO-OR-10: the CTX shape space is TOTAL — every combination either round-trips or is refused', () => {
  // A curated list of shapes can only SAMPLE the space; the F1 gap survived years of a
  // curated list. This enumerates the space instead, so a combination that renders a
  // line it cannot read back has nowhere to hide.
  //
  // The expectation is an INDEPENDENT restatement of D-2's four shapes, not something
  // read back out of the module under test — otherwise the test would agree with the
  // code by construction and could never fail.
  //
  // `-0` ADDED TO BOTH NUMERIC DIMENSIONS BY WO-OR-16, and this is where that defect
  // should have been caught. The sweep's COMPARISON was never the gap — this file imports
  // `node:assert/strict`, where `deepEqual` IS `deepStrictEqual` and already distinguishes
  // -0 from +0. The gap was the DOMAIN: -0 was never among the values swept, so the
  // strictest comparison in the world had nothing to compare. A totality test is only
  // total over the values it is given.
  const percents = [null, -0, 0, 38, 100];
  const useds = [null, -0, 0, 900, 72600];
  const windows = [null, 190000];

  // Representable iff a denominator appears with BOTH a percent and a numerator, a
  // numerator never appears beside a percent without one, and NEITHER number is a signed
  // zero — `-0` renders as the byte "0" and reads back as `+0`, so it is a value the
  // grammar cannot carry back to its caller. Still an independent restatement of the
  // requirement; nothing here is read out of the module under test.
  const isNegZero = (n) => Object.is(n, -0);
  const representable = (p, u, w) =>
    !isNegZero(p) && !isNegZero(u) &&
    (w === null ? !(p !== null && u !== null) : (p !== null && u !== null));

  const base = { approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING, next: NEXT_UNSET, control: CONTROL_CONTINUE };
  let accepted = 0;
  let refused = 0;
  for (const percent of percents) {
    for (const usedTokens of useds) {
      for (const windowTokens of windows) {
        const fields = { percent, usedTokens, windowTokens, ...base };
        if (representable(percent, usedTokens, windowTokens)) {
          const parsed = parseFooter(renderFooter(fields));
          assert.equal(parsed.ok, true, `unparseable: ${JSON.stringify(fields)}`);
          assert.deepEqual(parsed.fields, fields, `round-trip lost data for ${JSON.stringify(fields)}`);
          accepted += 1;
        } else {
          assert.throws(() => renderFooter(fields), TypeError, `must be refused: ${JSON.stringify(fields)}`);
          refused += 1;
        }
      }
    }
  }
  // INV-5: assert the executed counts against the product of the dimensions, so a loop
  // whose bounds silently collapsed cannot report a clean pass over nothing.
  assert.equal(accepted + refused, percents.length * useds.length * windows.length);
  // 50 combinations, not 32 (WO-OR-16 widened the domain by one value per numeric
  // dimension). The accepted side is UNCHANGED at 16 — every shape that round-tripped
  // before still does — and all 18 new combinations land on the refused side, which is
  // what "narrow the accepted domain, never widen the grammar" means when counted.
  assert.equal(accepted, 16);
  assert.equal(refused, 34);
  assert.ok(refused > 0, 'a partition with nothing on the refused side would prove nothing');
});

test('WO-OR-10 F2: the token codec is bounded at MAX_SAFE_INTEGER, and the LOSSY value is pinned', () => {
  // THIS VALUE IS THE ONE THAT MATTERS, and it is pinned as a literal rather than
  // computed because it is the number that would have reached Warwick as a plausible
  // lie. It is not a crash and not an ugly line: it rendered, it PARSED, `ok` was true,
  // and the count that came back was different from the count that went in.
  const LOSSY = 100000000000001200;
  assert.ok(LOSSY > Number.MAX_SAFE_INTEGER, 'precondition: outside safe integer arithmetic');
  assert.equal(LOSSY % TOKENS_GRAIN, 0, 'precondition: it IS on the grain, so only the bound can refuse it');
  assert.equal(isRenderableTokens(LOSSY), false, 'the codec must refuse what it cannot read back');
  assert.throws(() => formatTokens(LOSSY), TypeError);
  assert.throws(
    () => renderFooter({
      percent: null, usedTokens: LOSSY, windowTokens: null, approximate: false,
      state: 'BLIND', advice: ADVICE.UNSURE, next: NEXT_UNSET, control: CONTROL_CONTINUE,
    }),
    TypeError
  );

  // WHY it must be refused, DEMONSTRATED rather than asserted. The text below is built
  // from the grammar's own production, not from the module's internals, so it stays a
  // real proof that this magnitude cannot survive the trip.
  const text = `${Math.floor(LOSSY / 1000)}.${(LOSSY / TOKENS_GRAIN) % 10}k`;
  assert.match(text, /^[0-9]+\.[0-9]k$/, 'the old renderer emitted a perfectly GRAMMATICAL line');
  assert.notEqual(parseTokens(text), LOSSY, 'and it read back a DIFFERENT number — the silent failure');

  // Class B, the louder one: at and above 1e24 the whole number goes exponential and
  // the line stops parsing altogether. Refused now for the same reason.
  const EXPONENT = 1006632960000000000000000;
  assert.equal(EXPONENT % TOKENS_GRAIN, 0, 'precondition: on the grain');
  assert.ok(EXPONENT > Number.MAX_SAFE_INTEGER);
  assert.equal(isRenderableTokens(EXPONENT), false);
  assert.match(String(Math.floor(EXPONENT / 1000)), /e\+/, 'the old renderer would have emitted exponent notation');

  // Codex named `1e24`. It is rejected, but for an UNRELATED reason — the nearest
  // double is not a multiple of the grain — which is exactly why probing it looked like
  // a disproof. Recorded so nobody re-runs that probe and re-reaches the wrong verdict.
  assert.notEqual(1e24 % TOKENS_GRAIN, 0, 'the double nearest 1e24 is not on the grain');
  assert.equal(isRenderableTokens(1e24), false);

  // THE BOUNDARY ITSELF, from both sides, so it cannot drift unnoticed.
  const LARGEST = 9007199254740900;
  assert.ok(LARGEST <= Number.MAX_SAFE_INTEGER, 'the largest multiple of the grain inside safe range');
  assert.equal(isRenderableTokens(LARGEST), true, 'the largest faithful value must still be ACCEPTED');
  assert.equal(parseTokens(formatTokens(LARGEST)), LARGEST, 'and it must round-trip EXACTLY');
  assert.equal(
    isRenderableTokens(LARGEST + TOKENS_GRAIN), false,
    'and the very next value on the grain must not — the bound is here, not somewhere nearby'
  );

  // The whole legal range still round-trips: this is the half that stops the bound
  // being "fixed" by simply refusing more.
  let exact = 0;
  for (const n of [0, 100, 900, 1000, 72600, 190000, 1e6, 1e9, 1e12, 1e15, 9e15, LARGEST]) {
    assert.equal(isRenderableTokens(n), true, `${n} must remain accepted`);
    assert.equal(parseTokens(formatTokens(n)), n, `${n} must round-trip exactly`);
    exact += 1;
  }
  assert.equal(exact, 12);
});

test('WO-OR-10: toRenderableTokens can never hand the renderer a value it refuses', () => {
  // THE MIRROR DEFECT. F1 is the renderer accepting what the parser cannot represent;
  // this is the PRODUCER emitting what the renderer refuses. The function documents
  // itself as rounding a raw count "onto the grain so the renderer will accept it", and
  // above ~1e23 it did not: the nearest double is not a multiple of the grain, so the
  // rounded result came straight back out and `renderFooter` threw on it.
  //
  // Asserted as a PROPERTY over the input domain rather than at the four magnitudes
  // that happened to fail — the next failing magnitude is not something a list can
  // anticipate, which is the whole reason the original list-shaped check missed this.
  let checked = 0;
  let produced = 0;
  const raws = [
    0, 1, 49, 50, 99, 100, 151, 72_601, 72_651, 111_019, 210_781,
    1e6, 1e12, 1e15, 9e15, 9007199254740900, Number.MAX_SAFE_INTEGER,
    1e16, 1e17, 100000000000001200, 1e21, 1e22, 1e23, 1e24, 1e25, 1.5e24,
    -1, -100, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  ];
  for (const raw of raws) {
    const out = toRenderableTokens(raw);
    checked += 1;
    if (out === null) continue;
    produced += 1;
    assert.equal(isRenderableTokens(out), true, `toRenderableTokens(${raw}) = ${out}, which the renderer REFUSES`);
    // ...and it is renderable end to end, not merely predicate-clean.
    assert.equal(parseTokens(formatTokens(out)), out, `toRenderableTokens(${raw}) = ${out} does not round-trip`);
  }
  assert.equal(checked, raws.length);
  assert.ok(produced > 0, 'a run where everything returned null would prove nothing');

  // The specific escapes, named so the regression cannot come back quietly.
  for (const raw of [1e23, 1e24, 1e25, 1.5e24]) {
    assert.equal(toRenderableTokens(raw), null, `${raw} must be refused, not rounded into an unrenderable value`);
  }
  // ROUNDING UP ACROSS THE BOUND is the subtle one: the input is inside safe range and
  // the ROUNDED value is not, so the check has to be on the result, never the argument.
  assert.equal(toRenderableTokens(Number.MAX_SAFE_INTEGER), null, 'rounding up must not cross the bound unnoticed');

  // ...and the ordinary producer-side rounding this whole ladder depends on is UNCHANGED.
  assert.equal(toRenderableTokens(72_601), 72_600);
  assert.equal(toRenderableTokens(72_651), 72_700);
  assert.equal(toRenderableTokens(0), 0);
  assert.equal(toRenderableTokens(9_007_199_254_740_900), 9_007_199_254_740_900);
  assert.equal(toRenderableTokens(-1), null);
  assert.equal(toRenderableTokens(Number.NaN), null);
});

// ---------------------------------------------------------------------------
// WO-OR-12 / Codex F3 — a DISPLAY transform must never feed the ARITHMETIC
// ---------------------------------------------------------------------------
// `toRenderableTokens` rounds a raw count onto TOKENS_GRAIN so the DISPLAY codec can
// render it exactly. The ladder then divided those two already-rounded values to produce
// the percentage — so the most load-bearing number this module emits was computed from
// two values that exist only in order to be rendered.
//
// THE REACHABILITY DEFENCE WAS TESTED AND IS FALSE, which is why these tests pin
// realistic magnitudes and not only Codex's 149-token example. The argument for leaving
// it alone was that real windows are 200000 or 1000000 — both exact multiples of the
// grain, so the denominator is untouched — and that a numerator error of at most 50
// tokens is far below the integer percent actually rendered. Both premises are true and
// the conclusion is wrong: across every used-token value in a 200000 window, 4996 of
// 200001 (2.498%) render a DIFFERENT integer percent, and 100 of them cross an evaluator
// threshold and change the STATE. The rows below are drawn from that sweep.
//
// The percent is the LESS dangerous half. A grade computed off a rounded numerator can
// tell Warwick to rotate when the true figure does not: `used_tokens: 149950` in a 200000
// window rounds to exactly 75.000% and grades RED · CLEAR NOW, where the truth is 74.975%
// and AMBER. Same rendered percent, different instruction.

const F3_AT = '2026-08-02T12:00:00.000Z';
const F3_NOW = Date.parse(F3_AT) + 1000; // fresh, so staleness is never the reason

// The TRANSCRIPT path — a raw numerator and denominator with NO reported percentage. It
// is the only path that divides; a sample carrying `used_percentage` short-circuits above.
function f3Sample({ used, window: windowSize, percentage = null }) {
  return {
    ok: true,
    approximate: false,
    data: {
      schema_version: 1,
      sampled_at: F3_AT,
      session_id: 'f3',
      source: 'transcript',
      context_window: {
        used_percentage: percentage,
        used_tokens: used,
        context_window_size: windowSize,
      },
    },
  };
}

const f3Derive = (opts) =>
  deriveFooterFields({ sample: f3Sample(opts), knownSessionId: 'f3', now: F3_NOW });

test('WO-OR-12 F3: the percentage comes from the RAW numerator and denominator, never the display-rounded pair', () => {
  // Every row FAILS against the pre-fix code. That is what makes this evidence rather
  // than decoration — a test that never failed proves only that it was written.
  const cases = [
    {
      what: "Codex's own case — a numerator that rounds away to ZERO",
      used: 49, window: 149,
      percent: 33, // true 32.885%; the old arithmetic divided 0/100 and rendered 0%
      state: 'GREEN',
    },
    {
      what: 'a REALISTIC 200k window — the rendered percent is a full point wrong',
      used: 950, window: 200_000,
      percent: 0, // true 0.475%; the old arithmetic divided 1000/200000 -> 0.5% -> 1%
      state: 'GREEN',
    },
    {
      what: 'a REALISTIC 200k window at the RED threshold — the STATE is wrong, not the number',
      used: 149_950, window: 200_000,
      percent: 75, // rounds to 75 either way: the percent field HIDES this one entirely
      state: 'AMBER', // true 74.975%; the old arithmetic hit exactly 75.000% and graded RED
    },
    {
      what: 'a REALISTIC 200k window at the AMBER threshold',
      used: 109_950, window: 200_000,
      percent: 55,
      state: 'GREEN', // true 54.975%; the old arithmetic hit exactly 55.000% and graded AMBER
    },
    {
      what: 'the same defect in a 1M window',
      used: 549_950, window: 1_000_000,
      percent: 55,
      state: 'GREEN', // true 54.995%; the old arithmetic hit exactly 55.000%
    },
  ];

  let checked = 0;
  for (const c of cases) {
    const { fields, blind } = f3Derive({ used: c.used, window: c.window });
    assert.equal(blind, false, `${c.what}: must not be BLIND`);
    assert.equal(fields.percent, c.percent, `${c.what}: percent`);
    assert.equal(fields.state, c.state, `${c.what}: state`);

    // Asserted as the PROPERTY as well as the literal, so a future edit cannot satisfy
    // the four literals above by some other route.
    assert.equal(
      fields.percent,
      Math.round((c.used / c.window) * 100),
      `${c.what}: percent must be the RAW quotient, rounded once at the end`
    );
    checked += 1;
  }
  assert.equal(checked, cases.length, 'a run that executed no case would prove nothing');

  // The readings that already AGREED must still agree — this fix is not licensed to move
  // anything else. Both values are exercised end to end elsewhere in this file.
  assert.equal(f3Derive({ used: 210_781, window: 1_000_000 }).fields.percent, 21);
  assert.equal(f3Derive({ used: 111_019, window: 1_000_000 }).fields.percent, 11);

  // A sample that REPORTS a percentage still short-circuits to it untouched, raw tokens
  // present or not. The statusLine path never divided and must not start.
  assert.equal(f3Derive({ used: 950, window: 200_000, percentage: 42 }).fields.percent, 42);
});

test('WO-OR-12: the RENDERED token fields are still grain-aligned, and the codec still round-trips', () => {
  // THE REGRESSION THIS FIX COULD HAVE CAUSED. "Divide raw" must never become "render
  // raw": grain alignment is what makes `parseFooter(renderFooter(x)).fields` deep-equal
  // `x` (D-M10) for the token fields, and it was hard-won in WO-OR-10.
  const cases = [
    { used: 49, window: 149 },
    { used: 950, window: 200_000 },
    { used: 149_950, window: 200_000 },
    { used: 91_234, window: 200_000 },
    { used: 210_781, window: 1_000_000 },
  ];

  let checked = 0;
  for (const { used, window: windowSize } of cases) {
    const { fields } = f3Derive({ used, window: windowSize });

    // Still DISPLAY-ROUNDED, and still exactly what the display codec produces.
    assert.equal(fields.usedTokens, toRenderableTokens(used), `usedTokens for ${used}`);
    assert.equal(fields.windowTokens, toRenderableTokens(windowSize), `windowTokens for ${windowSize}`);
    assert.equal(isRenderableTokens(fields.usedTokens), true, `usedTokens for ${used} must be renderable`);
    assert.equal(isRenderableTokens(fields.windowTokens), true, `windowTokens for ${windowSize} must be renderable`);
    assert.equal(fields.usedTokens % TOKENS_GRAIN, 0, `usedTokens for ${used} must be grain-aligned`);
    assert.equal(fields.windowTokens % TOKENS_GRAIN, 0, `windowTokens for ${windowSize} must be grain-aligned`);

    // D-M10, end to end, for the field set the ladder actually produced.
    const line = renderFooter(fields);
    const parsed = parseFooter(line);
    assert.equal(parsed.ok, true, `${line} must parse`);
    assert.deepEqual(parsed.fields, fields, `${line} must round-trip exactly`);
    checked += 1;
  }
  assert.equal(checked, cases.length, 'a run that executed no case would prove nothing');

  // The whole change in one assertion: the value RENDERED is not the value DIVIDED. If
  // these ever coincide for a raw count off the grain, the display transform has crept
  // back into the arithmetic and F3 is open again.
  const { fields } = f3Derive({ used: 950, window: 200_000 });
  assert.equal(fields.usedTokens, 1000, 'the rendered numerator is rounded ONTO the grain');
  assert.notEqual(fields.usedTokens, 950, '...and is therefore NOT the raw count');
  assert.equal(fields.percent, 0, '...while the percentage came from the raw 950, not from the rendered 1000');
});

test('WO-OR-12: dividing the RAW values did not move the arithmetic past a single guard', () => {
  // The obvious way to fix F3 is to reach for the raws BEFORE the checks the rounded
  // values were subject to — trading a rounding error for a NaN, an Infinity, a division
  // by zero or a negative percentage reaching the grammar. That would be a worse defect
  // than the one being repaired, so every rung is pinned here as UNCHANGED.
  const blindCases = [
    { what: 'a zero denominator', used: 500, window: 0, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'a negative denominator', used: 500, window: -200_000, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'a NaN denominator', used: 500, window: Number.NaN, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'an infinite denominator', used: 500, window: Number.POSITIVE_INFINITY, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'a STRING denominator', used: 500, window: '200000', reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'an absent denominator', used: 500, window: null, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'an unrepresentable denominator', used: 500, window: 1e24, reason: BLIND_REASON.WINDOW_SIZE_UNKNOWN },
    { what: 'a negative numerator', used: -5, window: 200_000, reason: BLIND_REASON.PERCENTAGE_ABSENT },
    { what: 'a NaN numerator', used: Number.NaN, window: 200_000, reason: BLIND_REASON.PERCENTAGE_ABSENT },
    { what: 'an infinite numerator', used: Number.POSITIVE_INFINITY, window: 200_000, reason: BLIND_REASON.PERCENTAGE_ABSENT },
    { what: 'a STRING numerator', used: '42', window: 200_000, reason: BLIND_REASON.PERCENTAGE_ABSENT },
    { what: 'an absent numerator', used: null, window: 200_000, reason: BLIND_REASON.PERCENTAGE_ABSENT },
  ];

  let checked = 0;
  for (const c of blindCases) {
    const { fields, blind, blindReason } = f3Derive({ used: c.used, window: c.window });
    assert.equal(blind, true, `${c.what} must be BLIND`);
    assert.equal(blindReason, c.reason, `${c.what} must report the SAME rung as before the fix`);
    assert.equal(fields.percent, null, `${c.what} must render NO percentage`);
    assert.equal(fields.state, 'BLIND', `${c.what}: state`);

    // ...and the line is still grammatical, carrying no arithmetic wreckage.
    const line = renderFooter(fields);
    assert.equal(parseFooter(line).ok, true, `${c.what}: ${line} must parse`);
    assert.doesNotMatch(line, /NaN|Infinity|-[0-9]/, `${c.what}: ${line} must carry no wreckage`);
    checked += 1;
  }
  assert.equal(checked, blindCases.length, 'a run that executed no case would prove nothing');

  // The boundary that is deliberately NOT blind: a zero numerator over a real denominator
  // is a true 0%, and must stay a real graded reading rather than being swept in above.
  const zero = f3Derive({ used: 0, window: 200_000 });
  assert.equal(zero.blind, false, 'a zero numerator is a READING, not a failure');
  assert.equal(zero.fields.percent, 0);
  assert.equal(zero.fields.state, 'GREEN');
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
    assert.equal(f.advice, ADVICE.NO_ADVICE);
    assert.ok(renderFooter(f).startsWith('⟦GOV⟧ ctx -- · BLIND · NO ADVICE'));
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
  assert.equal(staleResult.fields.percent, null, 'D-M2: the GRADED number must be SUPPRESSED, not merely flagged');
  assert.equal(staleResult.blindReason, BLIND_REASON.STALE);
  // ...but the RAW COUNT survives. D-M2 exists to stop a stale PERCENTAGE being
  // presented as current; it never required throwing away a true measurement.
  // Observed live 2026-08-02: a sample holding `used_tokens: 258933` aged past 20
  // minutes mid-turn and the footer rendered `ctx --` — no number at all — which is
  // neither real information nor an honest unavailable state. Warwick's own ruling
  // is true-count-only when the denominator is not established; this rung was
  // discarding the numerator that ruling exists to keep.
  //
  // Enumerated, not spot-checked: the rungs that can hold a real numerator are exactly
  // STALE and WINDOW_SIZE_UNKNOWN. Both must carry it; SESSION_MISMATCH must not.
  const withTokens = (extra) => goodSample({
    sampled_at: new Date(now - 21 * 60 * 1000).toISOString(),
    context_window: { used_tokens: 250000, context_window_size: 1000000 },
    ...extra,
  });

  const staleWithTokens = deriveFooterFields({ sample: withTokens(), knownSessionId: 'session-a', now });
  assert.equal(staleWithTokens.blindReason, BLIND_REASON.STALE);
  assert.equal(staleWithTokens.fields.state, 'BLIND', 'still ungraded');
  assert.equal(staleWithTokens.fields.percent, null, 'still no stale percentage');
  assert.equal(staleWithTokens.fields.usedTokens, 250000, 'a stale sample still carries its TRUE token count');
  assert.equal(
    staleWithTokens.fields.windowTokens, null,
    'but NOT the window — renderFooter rejects a denominator with no percentage beside it, ' +
    'and carrying it was the first attempt at this fix'
  );

  // The regression this pins: `ctx --` when a real measurement was in hand.
  assert.match(renderFooter(staleWithTokens.fields), /ctx 250k · BLIND/);

  // ...and the boundary of the class. Another session's count is not a fact about
  // this one, so SESSION_MISMATCH stays bare no matter how many tokens it holds.
  const otherSession = deriveFooterFields({
    sample: withTokens({ session_id: 'session-b' }), knownSessionId: 'session-a', now,
  });
  assert.equal(otherSession.blindReason, BLIND_REASON.SESSION_MISMATCH);
  assert.equal(otherSession.fields.usedTokens, null, 'a FOREIGN session\'s count must never be carried');

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
    // Warwick 2026-08-02: BLIND must render advice UNAVAILABLE, not a graded
    // recommendation. This row said ADVICE.UNSURE ("KEEP GOING?") and was encoding the
    // defect — the state that means "I could not grade this" was paired with a hedged
    // yes derived from a grade.
    BLIND: ADVICE.NO_ADVICE,
  };
  let checked = 0;
  for (const state of FOOTER_STATES) {
    assert.equal(adviceForState(state), expected[state], `${state} advises wrongly`);
    assert.ok(lines[FOOTER_STATES.indexOf(state)].includes(` · ${expected[state]} · `));
    checked += 1;
  }
  assert.equal(checked, 5);

  // WARWICK'S RULING, 2026-08-02, as the closed statement rather than one example:
  // BLIND may pair with NOTHING that is derived from a grade. CLEAR NOW was already
  // forbidden (unknown telemetry must not FORCE a rotation); KEEP GOING and its hedged
  // form were the half that was wrong, because a state meaning "I could not grade this"
  // cannot then offer a recommendation premised on the grade.
  assert.equal(adviceForState('BLIND'), ADVICE.NO_ADVICE);
  for (const graded of [ADVICE.CLEAR_NOW, ADVICE.KEEP_GOING, ADVICE.UNSURE, ADVICE.TASK_UNKNOWN]) {
    assert.notEqual(adviceForState('BLIND'), graded, `BLIND must never advise ${graded}`);
  }
  // ...and an unknown state is ungraded too, so it degrades the same way.
  assert.equal(adviceForState('PURPLE'), ADVICE.NO_ADVICE);
  assert.equal(adviceForState(undefined), ADVICE.NO_ADVICE);
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

  // NEVER suppressed: a governor that stops measuring must get LOUDER, not quieter
  // (INV-1). The signal is now NO ADVICE rather than a question mark — the same
  // never-suppressed sensor signal, saying outright what the question mark only implied.
  assert.equal(adviceFor('BLIND', { taskKnown: false }), ADVICE.NO_ADVICE, 'BLIND keeps its own signal');
  assert.equal(adviceFor('BLIND', { taskKnown: true }), ADVICE.NO_ADVICE);
  assert.notEqual(adviceFor('BLIND', { taskKnown: false }), ADVICE.TASK_UNKNOWN, 'and it is NOT folded into task knowledge');
  // An unrecognised state is ungraded, so it degrades the same way — never to TASK
  // UNKNOWN and never to reassurance.
  assert.equal(adviceFor('PURPLE', { taskKnown: false }), ADVICE.NO_ADVICE);
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
  assert.equal(line, '⟦GOV⟧ ctx -- · BLIND · NO ADVICE · next: UNSET · CONTINUE');

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
    assert.equal(bare, '⟦GOV⟧ ctx 210.8k · BLIND · NO ADVICE · next: Opus/high · CONTINUE');
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
      assert.equal(parsed.fields.advice, ADVICE.NO_ADVICE, `${label}: BLIND is NO ADVICE, never CLEAR NOW and never KEEP GOING`);
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
// THE SEAM: extractTranscriptSample -> deriveFooterFields -> renderFooter
// (added WO-OR-08; re-aimed WO-OR-09)
// ===========================================================================
//
// WHY THIS BLOCK EXISTS. Every test above this line drives the ladder and the renderer
// from SYNTHETIC fields — `goodSample()` and the 46,080-combination round-trip both
// build their inputs by hand. Nothing drove a REAL `extractTranscriptSample` output
// across into `deriveFooterFields`. That gap is not academic: it is precisely why a
// borrowed denominator rendered a 1M-context session at roughly five times its true
// percentage, graded AMBER, advising rotation — through a green suite.
//
// RE-AIMED BY WO-OR-09. These tests originally pinned the VARIANT-AMBIGUITY repair, so
// their fixtures were keyed by model id and their negative case needed two conflicting
// namespaces to fire. Codex TQA-001 established that the ambiguity was a symptom: the
// unsound part was inferring this session's window from ANY other session's observation,
// which fired just as readily on an unambiguous store. The fixtures below are therefore
// keyed by SESSION ID, and the negative case is now the harder one — a single stranger's
// observation with nothing to contradict it.
//
// A round-trip over invented fields proves the CODEC. It cannot prove that the two
// halves agree about what they are exchanging. These tests cross that seam.
//
// FIXTURES ONLY. No live machine transcript and no live health store is read here, so
// this passes in CI and in a fresh worktree. The store contents below are modelled on
// the real ones, but they are written by this test.

/**
 * A statusLine observation, in the shape the real health store holds: one file per
 * session, NAMED for the session that made it.
 *
 * WO-OR-09 re-keyed these fixtures. They used to be filed under `obs-<modelId>-<size>`
 * and matched to the live session by MODEL ID, which is the inference Codex TQA-001
 * disproved — agreement between observations establishes store consistency, not
 * live-session identity. The session id is now the only linkage, so the fixture writes
 * the file the resolver will actually look for.
 */
function writeSeamObservation(dir, sessionId, size, { modelId = 'claude-opus-5', at = '2026-08-01T00:49:52Z' } = {}) {
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify({
    schema_version: 1,
    sampled_at: at,
    session_id: sessionId,
    source: SOURCE_STATUSLINE,
    model: { id: modelId },
    context_window: { context_window_size: size },
  }));
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

test('WO-OR-09 SEAM: a store holding only OTHER sessions yields a TRUE token count and NO graded percentage', () => {
  // THE REGRESSION, RE-AIMED BY WO-OR-09. It used to demonstrate variant AMBIGUITY: a 1M
  // observation under a variant-suffixed id beside a 200k one under the bare id. Codex
  // TQA-001 showed the ambiguity was never the defect — the CROSS-SESSION INFERENCE was,
  // and it fired just as happily on the unambiguous store below, where a single 200k
  // observation belonging to a stranger has nothing to contradict it.
  //
  // So the fixture is now the harder case, not the easier one: ONE observation, no
  // sibling, no disagreement, numerator comfortably inside it. Every WO-OR-08 guard stays
  // silent here. The number Warwick reads must still be true or absent, never wrong.
  const dir = tmp();
  try {
    writeSeamObservation(dir, 'a-different-session', 200000, { at: '2026-08-01T00:49:56Z' });

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
    // `NO ADVICE` — not `TASK UNKNOWN` — is correct and deliberate here: BLIND is a
    // SENSOR-failure signal and `adviceFor` never suppresses it, because a governor that
    // stops measuring must get louder, not quieter (INV-1). It read `KEEP GOING?` until
    // Warwick's 2026-08-02 ruling; the reasoning is unchanged, the value is not.
    assert.equal(line, '⟦GOV⟧ ctx 111k · BLIND · NO ADVICE · next: UNSET · CONTINUE');
    assert.doesNotMatch(line, /\d+%/, 'no percentage may appear in this line at all');
    assert.doesNotMatch(line, /AMBER/, 'and it must never be GRADED off a borrowed window');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-OR-09 SEAM: this session\'s OWN observation renders a real, graded percentage end to end', () => {
  // The positive control for the seam, and the one that keeps the feature honest: if the
  // repair had simply made the footer permanently BLIND, the test above would still pass
  // and this one would fail. This is the terminal case — statusLine observed THIS
  // session's window, so the percentage Warwick reads is real and may be graded.
  const dir = tmp();
  try {
    writeSeamObservation(dir, 'seam-session', 1000000);

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
    writeSeamObservation(dir, 'seam-session', 1000000);
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

// ===========================================================================
// WO-OR-13 — INV-1: A VALUE THE GRAMMAR CANNOT REPRESENT MAY NEVER BE GRADED
// ===========================================================================
//
// The range check ran AFTER `Math.round`, so it tested the DISPLAY form and not the
// value being judged. `Math.round` is round-half-UP, which folds [-0.5, 0) onto `-0`
// (and `-0 < 0` is FALSE) and (100, 100.5) onto 100 — so both bands walked past the
// guard. Every case in the LOW band below rendered `ctx 0% · GREEN`: telemetry the
// grammar explicitly rejects, wearing the most reassuring state the footer can emit.
//
// THE TWO HALVES ARE GRADED SEPARATELY AND DELIBERATELY. The low band is INV-1 proper
// — a false GREEN. The high band graded RED, which breaches the same rule (no graded
// state from an unrepresentable input) but is NOT a false GREEN, and letting one claim
// carry both would overstate what was found. The bands are asymmetric because the
// rounding is.

const OOR = BLIND_REASON.PERCENTAGE_OUT_OF_RANGE;

test('WO-OR-13 INV-1: an out-of-grammar percentage is BLIND, never graded — including the band Math.round hid', () => {
  const cases = [
    // --- THE LOW BAND: these rendered `ctx 0% · GREEN` before the fix. INV-1 proper. ---
    { what: 'low band: -0.4 rounded to -0, and -0 < 0 is false', pct: -0.4, band: 'low' },
    { what: 'low band: -0.5, the round-half-up edge that slips through', pct: -0.5, band: 'low' },
    // --- THE HIGH BAND: these rendered `ctx 100% · RED`. Graded, not GREEN. ---
    { what: 'high band: 100.4 rounds down into range', pct: 100.4, band: 'high' },
    { what: 'high band: 100.49, the last value that rounds down', pct: 100.49, band: 'high' },
    // --- CONTROLS: already caught before the fix. Their REASON must not have moved. ---
    { what: 'control: -0.6 rounds to -1', pct: -0.6, band: 'was-caught' },
    { what: 'control: -1', pct: -1, band: 'was-caught' },
    { what: 'control: 100.5 rounds UP to 101 — the asymmetry, stated', pct: 100.5, band: 'was-caught' },
    { what: 'control: 140, the pin that already existed', pct: 140, band: 'was-caught' },
  ];

  let checked = 0;
  const bands = new Set();
  for (const c of cases) {
    const r = deriveFooterFields({
      sample: goodSample({ context_window: { used_percentage: c.pct } }),
      knownSessionId: 'session-a',
    });
    assert.equal(r.blind, true, `${c.what}: must be BLIND`);
    // The SPECIFIC rung, not merely "it went BLIND" — a collapsed ladder would pass the
    // line above and tell the next investigator nothing about what caught it.
    assert.equal(r.blindReason, OOR, `${c.what}: blindReason`);
    assert.equal(r.fields.state, 'BLIND', `${c.what}: state`);
    assert.notEqual(r.fields.state, 'GREEN', `${c.what}: INV-1 — BLIND is never GREEN`);
    assert.equal(r.fields.percent, null, `${c.what}: the number must be SUPPRESSED`);
    assert.ok(
      renderFooter(r.fields).startsWith('⟦GOV⟧ ctx -- · BLIND · NO ADVICE'),
      `${c.what}: rendered line`
    );
    bands.add(c.band);
    checked += 1;
  }
  assert.equal(checked, cases.length, 'a run that executed no case would prove nothing');
  assert.equal(bands.size, 3, 'both breached bands AND the already-caught controls must be exercised');

  // THE DIVISION PATH REACHES THE SAME RUNG. The transcript route computes `used` rather
  // than reading it, so it needs its own proof that the repair is not statusLine-only.
  // 200800/200000 = 100.4% — both inputs raw, finite and grain-aligned, so nothing else
  // on the ladder can be the thing that caught it.
  const divided = f3Derive({ used: 200_800, window: 200_000 });
  assert.equal(divided.blind, true, 'the divided high band must be BLIND too');
  assert.equal(divided.blindReason, OOR);
  assert.equal(divided.fields.percent, null);
  // ...and a divided percentage far out of range was ALWAYS caught. Control.
  assert.equal(f3Derive({ used: 300_000, window: 200_000 }).blindReason, OOR);
});

test('WO-OR-13: the BLIND ladder still distinguishes its rungs — nine reasons, none collapsed', () => {
  // INV-5. The repair narrowed ONE rung; a repair that widened it into its neighbours
  // would still make every INV-1 assertion above pass. This asserts the class, not an
  // instance: each rung fires on its own trigger AND the reasons stay mutually distinct.
  // `now` is taken from the clock rather than pinned to a literal date, because
  // `goodSample()` stamps `sampled_at` with the REAL current time. A fixed `now` makes
  // freshness depend on what time of day the suite runs — which it did, and the
  // `evaluator threw` rung reported `sample-stale` instead. Every offset below is
  // relative, so the only thing this test asserts is the ladder.
  const now = Date.now();
  const at = (ms) => new Date(now - ms).toISOString();

  const rungs = [
    ['unreadable sample', { sample: { ok: false, reason: 'missing' } }, BLIND_REASON.SAMPLE_UNREADABLE],
    ['schema', { sample: goodSample({ schema_version: 2 }) }, BLIND_REASON.SCHEMA_UNRECOGNISED],
    ['no usage at all', { sample: goodSample({ context_window: {} }) }, BLIND_REASON.PERCENTAGE_ABSENT],
    ['sampled_at', { sample: goodSample({ sampled_at: 'not-a-date' }) }, BLIND_REASON.SAMPLED_AT_UNPARSEABLE],
    ['foreign session', { sample: goodSample({ session_id: 'someone-else' }) }, BLIND_REASON.SESSION_MISMATCH],
    ['stale', { sample: goodSample({ sampled_at: at(STALE_AFTER_MS + 1000) }) }, BLIND_REASON.STALE],
    ['evaluator threw', { sample: goodSample(), evaluateFn: () => { throw new Error('boom'); } }, BLIND_REASON.EVALUATOR_THREW],
    ['out of range', { sample: goodSample({ context_window: { used_percentage: -0.4 } }) }, OOR],
    [
      'window size unknown',
      { sample: goodSample({ context_window: { used_tokens: 72_600 } }) },
      BLIND_REASON.WINDOW_SIZE_UNKNOWN,
    ],
  ];

  const seen = [];
  for (const [what, opts, expected] of rungs) {
    const r = deriveFooterFields({ knownSessionId: 'session-a', now, ...opts });
    assert.equal(r.blind, true, `${what}: must be BLIND`);
    assert.equal(r.blindReason, expected, `${what}: must report ITS OWN reason`);
    seen.push(r.blindReason);
  }
  assert.equal(seen.length, rungs.length, 'a loop that executed nothing would prove nothing');
  assert.equal(new Set(seen).size, rungs.length, 'two rungs reporting the same reason IS a collapse');
});

test('WO-OR-13: `percent` is never NEGATIVE ZERO — asserted with Object.is, because the suite is loose', () => {
  // WHY Object.is AND NOT assert.equal. `-0 == 0` and `assert.deepEqual(-0, 0)` both
  // PASS, so every existing percent assertion in this file is structurally blind to
  // this. A loose test here would go green against the broken code and prove nothing.
  //
  // `used === -0` legitimately survives the range guard — -0 IS zero and 0% is in the
  // grammar — but `Math.round(-0)` is `-0`, which `renderFooter` accepts and emits as
  // `0%` while `parseFooter` reads back `+0`. That makes D-M10's round-trip identity
  // FALSE for a value the renderer accepts: the same class as the F1 defect WO-OR-10
  // closed. Normalised in the producer; asserted here at both ends.
  const routes = [
    ['reported directly', deriveFooterFields({
      sample: goodSample({ context_window: { used_percentage: -0 } }),
      knownSessionId: 'session-a',
    })],
    ['divided from a -0 numerator', f3Derive({ used: -0, window: 200_000 })],
  ];

  let checked = 0;
  for (const [what, r] of routes) {
    assert.equal(r.blind, false, `${what}: -0 is zero, so it must still GRADE`);
    assert.equal(r.fields.state, 'GREEN', `${what}: state`);
    assert.ok(Object.is(r.fields.percent, 0), `${what}: percent must be +0, got ${Object.is(r.fields.percent, -0) ? '-0' : r.fields.percent}`);
    assert.ok(!Object.is(r.fields.percent, -0), `${what}: percent must not be -0`);

    // D-M10, at the exact field that broke it, with the comparison that can see it.
    const parsed = parseFooter(renderFooter(r.fields));
    assert.equal(parsed.ok, true, `${what}: must parse`);
    assert.ok(
      Object.is(parsed.fields.percent, r.fields.percent),
      `${what}: parseFooter(renderFooter(x)).percent must be IDENTICAL to x.percent, not merely equal`
    );
    checked += 1;
  }
  assert.equal(checked, routes.length, 'a run that executed no route would prove nothing');
});

test('WO-OR-13: in-range telemetry does not move — same percent, same state, same bytes', () => {
  // THE REGRESSION THIS FIX COULD HAVE CAUSED. Moving the range decision onto the raw
  // value is only correct if it changes NOTHING inside the domain, thresholds included.
  const cases = [
    { pct: 0, percent: 0, state: 'GREEN' },
    { pct: 0.4, percent: 0, state: 'GREEN' },
    { pct: 0.5, percent: 1, state: 'GREEN' },
    { pct: 18, percent: 18, state: 'GREEN' },
    { pct: 54.9, percent: 55, state: 'GREEN' },   // rounds UP across the label, grades below it
    { pct: 55, percent: 55, state: 'AMBER' },
    { pct: 74.9, percent: 75, state: 'AMBER' },   // the WO-OR-12 shape: number 75, grade AMBER
    { pct: 75, percent: 75, state: 'RED' },
    { pct: 99.5, percent: 100, state: 'RED' },
    { pct: 100, percent: 100, state: 'RED' },
  ];

  let checked = 0;
  for (const c of cases) {
    const r = deriveFooterFields({
      sample: goodSample({ context_window: { used_percentage: c.pct } }),
      knownSessionId: 'session-a',
    });
    assert.equal(r.blind, false, `${c.pct}%: must NOT be BLIND`);
    assert.equal(r.blindReason, null, `${c.pct}%: no reason`);
    assert.equal(r.fields.percent, c.percent, `${c.pct}%: percent`);
    assert.equal(r.fields.state, c.state, `${c.pct}%: state`);
    checked += 1;
  }
  assert.equal(checked, cases.length, 'a run that executed no case would prove nothing');

  // Byte pins at both ends of the domain, so a change to the CTX field or the separators
  // cannot hide behind the field-level assertions above.
  const line = (pct) => renderFooter(deriveFooterFields({
    sample: goodSample({ context_window: { used_percentage: pct } }),
    knownSessionId: 'session-a',
  }).fields);
  assert.equal(line(0), '⟦GOV⟧ ctx 0% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');
  assert.equal(line(18), '⟦GOV⟧ ctx 18% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');
  assert.equal(line(100), '⟦GOV⟧ ctx 100% · RED · CLEAR NOW · next: UNSET · CONTINUE');
});

// ===========================================================================
// WO-OR-16 — THE RENDERER'S OWN DOMAIN STILL ADMITTED A VALUE IT CANNOT READ BACK
// ===========================================================================
//
// `-0` satisfies EVERY numeric check `renderFooter` makes: it IS an integer, `-0 < 0` is
// FALSE, and it is a safe-integer multiple of the grain. And `String(-0)` is `"0"`, so it
// renders as an ordinary zero and `parseFooter` reads it back as `+0`. D3's round-trip
// identity is therefore FALSE for a value the renderer ACCEPTED — the same class as
// WO-OR-10's F1, and closed the same way: NARROW the accepted domain to the representable
// one, never widen the grammar.
//
// WHY REFUSED AND NOT NORMALISED — the alternative was considered and is UNSOUND, not
// merely less tidy. Normalising inside the renderer is a NO-OP ON THE OUTPUT, because
// `String(-0)` is already `"0"`: the emitted bytes are identical either way, for every
// input in this grammar. And it cannot make the reported assertion true, because
// `Object.is(x.percent, parseFooter(renderFooter(x)).fields.percent)` compares the
// CALLER's object, which still holds -0. Under normalisation the only writable assertion
// is `Object.is(parsed.percent, 0)` — which PASSES against the unrepaired code. Refusal is
// the only route with a test that can go red.
//
// TWO FIELDS, NOT ONE, AND THE UNREPORTED ONE IS THE WORSE OF THE TWO.
//   percent    — the reported case, and RENDERER-ONLY: `deriveFooterFields` has normalised
//                it since WO-OR-13 (`Math.round(used) + 0`), so no producer path reaches
//                it. That normalisation is NOT made redundant by this repair — it is now
//                what stops the strict renderer THROWING on an honest 0% reading, which
//                `computeFooterLine` would answer with a FALSE BLIND.
//   usedTokens — NOT reported, and REACHABLE FROM THE LIVE PRODUCER. `JSON.parse("-0")` is
//                -0, `toRenderableTokens(-0)` returned -0, and nothing normalised it — so a
//                sample carrying `used_tokens: -0` put -0 into the rendered field set and
//                broke the identity through the real path, not just the codec's. Repaired
//                on BOTH sides: the codec refuses it, and the producer normalises it rather
//                than returning null, which would have degraded a real zero-token reading
//                into BLIND — trading this defect for a worse one.
//   windowTokens — ALREADY SAFE and pinned below so it stays that way: the existing
//                `windowTokens === 0` guard catches -0, because `-0 === 0` is true.

test('WO-OR-16: the SUITE ITSELF can see a signed zero — the harness property every assertion below rests on', () => {
  // A control that cannot distinguish the thing it exists to check is not a control. Every
  // -0 assertion in this file is worthless if the import at the top of the file changes:
  // plain `node:assert` has a LOOSE `deepEqual`/`equal` that treat -0 and +0 as equal, and
  // the whole class would go silently untested while every test stayed green.
  //
  // Pinned here as an executed fact because it was got WRONG during this Work Order: the
  // sweep above was reported as "blind by construction" on the strength of a probe run
  // against plain `node:assert`, when this file imports `node:assert/strict`, where
  // `deepEqual` IS `deepStrictEqual`. The comparison was never the gap; the swept DOMAIN
  // was. A claim about a control that was not checked against the control actually in use
  // is the same error in miniature as the defect this file exists to close.
  assert.throws(() => assert.equal(-0, 0), 'assert.equal must distinguish -0 from +0');
  assert.throws(() => assert.deepEqual({ p: -0 }, { p: 0 }), 'assert.deepEqual must distinguish -0 from +0');
  // ...and it must still accept the ordinary case, or the two lines above would be
  // satisfied by an assert that rejected everything.
  assert.equal(0, 0);
  assert.deepEqual({ p: 0 }, { p: 0 });
});

test('WO-OR-16: renderFooter REFUSES -0 in percent AND usedTokens, so D3 holds over the WHOLE accepted domain', () => {
  const base = {
    approximate: false, state: 'GREEN', advice: ADVICE.KEEP_GOING,
    next: NEXT_UNSET, control: CONTROL_CONTINUE,
  };

  // THE DEFECT. Every row here RENDERED before the repair:
  //   percent: -0     -> '⟦GOV⟧ ctx 0% · ...'   and parsed back as +0
  //   usedTokens: -0  -> '⟦GOV⟧ ctx 0k · ...'   and parsed back as +0
  const refused = [
    ['percent, bare shape', { ...base, percent: -0, usedTokens: null, windowTokens: null }],
    ['usedTokens, bare shape', { ...base, percent: null, usedTokens: -0, windowTokens: null }],
    // The pair shape too, so the refusal is not keyed to one CTX production.
    ['percent, pair shape', { ...base, percent: -0, usedTokens: 72_600, windowTokens: 200_000 }],
    ['usedTokens, pair shape', { ...base, percent: 36, usedTokens: -0, windowTokens: 200_000 }],
    // CONTROL for a guard that already held: `windowTokens === 0` catches -0 because
    // `-0 === 0`. Pinned so a later edit cannot lose it without a red test.
    ['windowTokens (already refused before this repair)', { ...base, percent: 0, usedTokens: 0, windowTokens: -0 }],
  ];

  let refusals = 0;
  for (const [what, fields] of refused) {
    assert.throws(() => renderFooter(fields), TypeError, `${what}: -0 must be REFUSED, never rendered`);
    refusals += 1;
  }
  assert.equal(refusals, refused.length, 'a run that refused nothing would prove nothing');

  // THE MESSAGE MUST NAME WHAT IT REJECTED. `JSON.stringify(-0)` is "0", so folding this
  // into the generic range message would report `got 0` — a rejection that misreports its
  // own subject, which is this same defect wearing a different hat.
  assert.throws(
    () => renderFooter({ ...base, percent: -0, usedTokens: null, windowTokens: null }),
    (err) => err instanceof TypeError && /negative zero/.test(err.message) && !/got 0/.test(err.message),
    'the percent refusal must say it refused NEGATIVE ZERO'
  );
  assert.throws(
    () => renderFooter({ ...base, percent: null, usedTokens: -0, windowTokens: null }),
    (err) => err instanceof TypeError && /-0|negative zero/.test(err.message),
    'the usedTokens refusal must name the signed zero too'
  );

  // CONTROLS — `+0` must STILL render and STILL round-trip. Without these the test would
  // pass just as well against a renderer that had learned to refuse every zero, which
  // would be a worse defect than the one being fixed.
  const accepted = [
    ['percent +0', { ...base, percent: 0, usedTokens: null, windowTokens: null }],
    ['usedTokens +0', { ...base, percent: null, usedTokens: 0, windowTokens: null }],
    ['both zero, pair shape', { ...base, percent: 0, usedTokens: 0, windowTokens: 200_000 }],
  ];
  let round_trips = 0;
  for (const [what, fields] of accepted) {
    const parsed = parseFooter(renderFooter(fields));
    assert.equal(parsed.ok, true, `${what}: must still render and parse`);
    assert.deepEqual(parsed.fields, fields, `${what}: round trip`);
    // Stated with Object.is as well, so this evidence does not depend on the reader
    // knowing which `assert` module the file imported.
    assert.ok(Object.is(parsed.fields.percent, fields.percent), `${what}: percent identity`);
    assert.ok(Object.is(parsed.fields.usedTokens, fields.usedTokens), `${what}: usedTokens identity`);
    round_trips += 1;
  }
  assert.equal(round_trips, accepted.length);
  assert.ok(refusals > 0 && round_trips > 0, 'a partition with an empty side proves nothing');

  // THE BYTES OF THE ZERO CASES ARE UNCHANGED, pinned as literals held outside the module
  // that produces them. `0%` and `0k` are exactly what -0 used to render, which is why the
  // defect was invisible — so these are the two lines a wrong repair would move.
  assert.equal(
    renderFooter({ ...base, percent: 0, usedTokens: null, windowTokens: null }),
    '⟦GOV⟧ ctx 0% · GREEN · KEEP GOING · next: UNSET · CONTINUE'
  );
  assert.equal(
    renderFooter({ ...base, percent: null, usedTokens: 0, windowTokens: null }),
    '⟦GOV⟧ ctx 0k · GREEN · KEEP GOING · next: UNSET · CONTINUE'
  );
});

test('WO-OR-16: the PRODUCER normalises -0 rather than degrading it — on the token path as well as the percent path', () => {
  // The codec half above is only safe because the producer half holds. These two are a
  // pair: refuse in the codec, normalise in the producer. Break either and the other turns
  // into a defect — a strict renderer with a -0-emitting producer yields a FALSE BLIND.

  // 1. THE PREDICATE. `isRenderableTokens` promises values it can render AND read back
  //    exactly; -0 is not one of them.
  assert.equal(isRenderableTokens(-0), false, '-0 is not a renderable token count');
  assert.equal(isRenderableTokens(0), true, '+0 still is — the control');

  // 2. THE PRODUCER-SIDE ROUNDER must return +0, NOT -0 and NOT null. Returning null would
  //    push an honest zero-token reading onto the PERCENTAGE_ABSENT rung and render BLIND.
  assert.ok(Object.is(toRenderableTokens(-0), 0), 'toRenderableTokens(-0) must be +0');
  assert.notEqual(toRenderableTokens(-0), null, 'a real zero reading must not degrade to null');
  assert.ok(Object.is(toRenderableTokens(0), 0));
  assert.ok(Object.is(toRenderableTokens(49), 0), 'the ordinary rounds-to-zero case must be unmoved');

  // 3. THE LIVE PATH. `JSON.parse('-0')` is -0, which is how a sample can carry one at all.
  //    Before this repair the ladder put -0 straight into `fields.usedTokens`.
  const negZeroTokens = JSON.parse('-0');
  assert.ok(Object.is(negZeroTokens, -0), 'the fixture must really be a signed zero');
  const r = deriveFooterFields({
    sample: {
      ok: true,
      approximate: false,
      data: {
        schema_version: 1,
        sampled_at: new Date().toISOString(),
        session_id: 'session-a',
        context_window: { used_tokens: negZeroTokens },
      },
    },
    knownSessionId: 'session-a',
  });
  // Still the honest rung — a numerator with no denominator cannot be graded — and NOT
  // the absent-usage rung, which is what a null would have produced.
  assert.equal(r.blindReason, BLIND_REASON.WINDOW_SIZE_UNKNOWN, 'the reading is real, just ungradeable');
  assert.ok(Object.is(r.fields.usedTokens, 0), 'the producer must emit +0');
  assert.ok(!Object.is(r.fields.usedTokens, -0), 'the producer must not emit -0');
  const line = renderFooter(r.fields);
  assert.equal(line, '⟦GOV⟧ ctx 0k · BLIND · NO ADVICE · next: UNSET · CONTINUE');
  assert.ok(Object.is(parseFooter(line).fields.usedTokens, r.fields.usedTokens), 'D3 through the live path');

  // 4. THE PERCENT PATH — WO-OR-13's `+ 0` is now LOAD-BEARING, not redundant, and this is
  //    the assertion that says why. The producer emits +0, and had it emitted -0 the strict
  //    renderer would now REFUSE the field set, which `computeFooterLine` answers with a
  //    BLIND line for a perfectly healthy 0% reading. WO-OR-13's own test is untouched;
  //    this states the coupling that repair now carries.
  const pct = deriveFooterFields({
    sample: goodSample({ context_window: { used_percentage: -0 } }),
    knownSessionId: 'session-a',
  });
  assert.ok(Object.is(pct.fields.percent, 0), 'the producer must still normalise the percent');
  assert.equal(renderFooter(pct.fields), '⟦GOV⟧ ctx 0% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE');
  assert.throws(
    () => renderFooter({ ...pct.fields, percent: -0 }),
    TypeError,
    'and WITHOUT that normalisation the renderer would now refuse it — which is why the producer guard must stay'
  );
});

// ===========================================================================
// WO-GF-01 — THE COUNT IS FRESH AT RENDER TIME, OR HONESTLY OLD
// ===========================================================================
//
// THE DEFECT. Samples are written at TURN BOUNDARIES and nothing re-samples during a long
// turn, so the footer rendered a count that was true as of its sample time with nothing in
// the line to say how old it was. Observed live 2026-08-02: `ctx 258.9k · BLIND` off a
// sample twenty-four minutes old. A true number and a misleading line.
//
// WHY THESE TESTS CARE SO MUCH ABOUT A SINGLE NUMBER. On this estate the denominator is
// usually not established, so the ladder sits on WINDOW_SIZE_UNKNOWN permanently — no
// percentage, state BLIND — and the raw count is the ENTIRE payload of the line.
//
// EVERY TEST BELOW ASSERTS ITS OWN CONTROL. A freshness test that only checks the fresh
// number passes just as happily when the refresh never ran and the stored number happened
// to match, so each case here pins the value the OTHER path would have produced and
// asserts the two differ. That is the difference between a proof and a coincidence.

/** A transcript line in the real shape, with the fields the refresh actually reads. */
function gfLine({ sessionId = 'gf-session', at, tokens }) {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    timestamp: at,
    effort: 'high',
    message: { model: 'claude-opus-5', usage: { input_tokens: tokens } },
  });
}

function gfTranscript(dir, lines, name = 'gf-transcript.jsonl') {
  const p = join(dir, name);
  writeFileSync(p, `${lines.join('\n')}\n`);
  return p;
}

/** A stored TRANSCRIPT-sourced sample, in the shape `sampler.extractTranscriptSample` writes. */
function gfStored({ at, tokens, sessionId = 'gf-session', transcriptPath = null, window = null }) {
  return {
    ok: true,
    approximate: false,
    data: {
      schema_version: 1,
      sampled_at: at,
      session_id: sessionId,
      source: 'transcript',
      transcript_path: transcriptPath,
      context_window: {
        used_percentage: null,
        used_tokens: tokens,
        context_window_size: window,
        context_window_source: null,
      },
    },
  };
}

const GF_NOW = Date.parse('2026-08-02T21:30:00.000Z');
const gfAt = (msAgo) => new Date(GF_NOW - msAgo).toISOString();

test('WO-GF-01: a stale STORED count is replaced by the live transcript count, dated by the MESSAGE', () => {
  const dir = tmp();
  try {
    // The exact live shape: the last turn ended 25 minutes ago and wrote 100k; the
    // transcript has been appended throughout this turn and now stands at 300k.
    const p = gfTranscript(dir, [
      gfLine({ at: gfAt(25 * 60 * 1000), tokens: 100_000 }),
      gfLine({ at: gfAt(30 * 1000), tokens: 300_000 }),
    ]);
    const stored = gfStored({ at: gfAt(25 * 60 * 1000), tokens: 100_000, transcriptPath: p });

    // THE CONTROL FIRST — what the old behaviour produces, so this test cannot pass by
    // accident. Identical sample, minus only the path the refresh needs.
    const unrefreshed = gfStored({ at: gfAt(25 * 60 * 1000), tokens: 100_000 });
    const before = deriveFooterFields({ sample: unrefreshed, knownSessionId: 'gf-session', now: GF_NOW });
    assert.equal(before.blindReason, BLIND_REASON.STALE, 'without the refresh the sample is STALE');
    assert.equal(before.fields.usedTokens, 100_000, 'and Warwick reads a 25-minute-old number');

    // THE REPAIR.
    const refreshed = refreshSampleFromTranscript(stored);
    assert.equal(refreshed.refreshedFromTranscript, true, 'the re-read actually happened');
    assert.equal(refreshed.data.context_window.used_tokens, 300_000, 'the LIVE count');
    assert.equal(
      refreshed.data.sampled_at, gfAt(30 * 1000),
      'dated by the MESSAGE it was read from, never by the clock of whoever read it'
    );

    const after = deriveFooterFields({ sample: refreshed, knownSessionId: 'gf-session', now: GF_NOW });
    assert.equal(after.blindReason, BLIND_REASON.WINDOW_SIZE_UNKNOWN, 'no longer stale — just ungraded');
    assert.equal(after.fields.usedTokens, 300_000);
    assert.equal(after.fields.percent, null, 'and STILL no invented percentage');
    assert.equal(after.fields.state, 'BLIND', 'a fresh count is still ungraded without a denominator');
    assert.equal(renderFooter(after.fields), '⟦GOV⟧ ctx 300k · BLIND · NO ADVICE · next: UNSET · CONTINUE');

    // The two paths genuinely differ — the assertion that makes the pair a proof.
    assert.notEqual(renderFooter(after.fields), renderFooter(before.fields));
    assert.doesNotMatch(renderFooter(after.fields), /ctx --/, 'and never `ctx --` with a real measurement in hand');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-GF-01: a session that has genuinely STOPPED still reads STALE — and still carries its count', () => {
  // THE LIE THIS FORBIDS, and the reason `sampled_at` is the message\'s time and not
  // `now`: a refresh that stamped the read time would mark every count fresh forever and
  // silently disable the staleness rung it sits beside. Here the newest message is 40
  // minutes old — newer than the stored sample, so the refresh DOES run — and the age it
  // carries is the truth about a session nobody is using.
  const dir = tmp();
  try {
    const p = gfTranscript(dir, [gfLine({ at: gfAt(40 * 60 * 1000), tokens: 260_000 })]);
    const stored = gfStored({ at: gfAt(45 * 60 * 1000), tokens: 250_000, transcriptPath: p });

    const refreshed = refreshSampleFromTranscript(stored);
    assert.equal(refreshed.refreshedFromTranscript, true, 'the refresh ran — this is not the decline case');
    assert.equal(refreshed.data.sampled_at, gfAt(40 * 60 * 1000), 'and it is dated 40 minutes ago, not now');

    const derived = deriveFooterFields({ sample: refreshed, knownSessionId: 'gf-session', now: GF_NOW });
    assert.equal(derived.blindReason, BLIND_REASON.STALE, 'still STALE, because it genuinely is');
    assert.equal(derived.fields.usedTokens, 260_000, 'and the true count still reaches Warwick');
    assert.equal(derived.fields.percent, null);
    assert.match(renderFooter(derived.fields), /ctx 260k · BLIND/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-GF-01: the refresh REFUSES a foreign transcript, a backwards one, and a sample with no path', () => {
  const dir = tmp();
  try {
    const fresh = gfAt(30 * 1000);
    const stored = (over) => gfStored({ at: gfAt(25 * 60 * 1000), tokens: 100_000, ...over });
    let examined = 0;

    // 1. IDENTITY. The transcript names ANOTHER session — the one thing the whole ladder
    //    exists to prevent. `SESSION_MISMATCH` refuses this downstream; the refresh must
    //    refuse it upstream too, because a mismatched count copied into THIS session's
    //    sample would arrive wearing this session's id and never reach that rung.
    const foreign = gfTranscript(dir, [gfLine({ sessionId: 'someone-else', at: fresh, tokens: 999_000 })], 'foreign.jsonl');
    const r1 = refreshSampleFromTranscript(stored({ transcriptPath: foreign }));
    assert.equal(r1.refreshedFromTranscript, undefined, 'a foreign transcript must not refresh anything');
    assert.equal(r1.data.context_window.used_tokens, 100_000, "and another session's count must never appear");
    examined += 1;

    // 2. AN UNIDENTIFIED transcript line is not an identity match either — absence of a
    //    contradiction is not evidence of agreement.
    const anon = gfTranscript(dir, [JSON.stringify({
      type: 'assistant', timestamp: fresh, message: { model: 'm', usage: { input_tokens: 999_000 } },
    })], 'anon.jsonl');
    assert.equal(refreshSampleFromTranscript(stored({ transcriptPath: anon })).refreshedFromTranscript, undefined);
    examined += 1;

    // 3. NEVER BACKWARDS. The tail read is bounded, and one multi-megabyte tool result can
    //    push the genuinely newest message out of the window — measured on this machine.
    //    The refresh must then decline, not backdate a newer stored reading.
    const older = gfTranscript(dir, [gfLine({ at: gfAt(50 * 60 * 1000), tokens: 40_000 })], 'older.jsonl');
    const r3 = refreshSampleFromTranscript(stored({ transcriptPath: older }));
    assert.equal(r3.refreshedFromTranscript, undefined, 'an older message must never replace a newer sample');
    assert.equal(r3.data.context_window.used_tokens, 100_000);
    assert.equal(r3.data.sampled_at, gfAt(25 * 60 * 1000), 'and the sample must not be backdated');
    examined += 1;

    // 4. A message with NO timestamp cannot be dated honestly, so it is not used.
    const undated = gfTranscript(dir, [JSON.stringify({
      type: 'assistant', sessionId: 'gf-session', message: { model: 'm', usage: { input_tokens: 999_000 } },
    })], 'undated.jsonl');
    assert.equal(refreshSampleFromTranscript(stored({ transcriptPath: undated })).refreshedFromTranscript, undefined);
    examined += 1;

    // 5. NO PATH — every sample written before this change. The refresh declines and the
    //    caller gets back the very object it passed, so the old behaviour is preserved by
    //    identity rather than by reconstruction.
    const noPath = stored({});
    assert.equal(refreshSampleFromTranscript(noPath), noPath, 'the same object, untouched');
    examined += 1;

    // 6. NOT A TRANSCRIPT SAMPLE. A statusLine sample carries no transcript path and its
    //    numerator is not what this reads.
    const statusLine = { ...noPath, data: { ...noPath.data, source: SOURCE_STATUSLINE, transcript_path: gfTranscript(dir, [gfLine({ at: fresh, tokens: 999_000 })], 'sl.jsonl') } };
    assert.equal(refreshSampleFromTranscript(statusLine), statusLine);
    examined += 1;

    // 7. Unreadable telemetry stays unreadable — never an exception on this path.
    const missing = stored({ transcriptPath: join(dir, 'does-not-exist.jsonl') });
    assert.equal(refreshSampleFromTranscript(missing), missing);
    assert.equal(refreshSampleFromTranscript(null), null);
    assert.equal(refreshSampleFromTranscript({ ok: false, approximate: false }).refreshedFromTranscript, undefined);
    examined += 1;

    assert.equal(examined, 7, 'every refusal in the class was exercised');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-GF-01 END TO END: computeFooterLine renders the LIVE count off a stale store', () => {
  // The wiring, through the real store and a real file — the path
  // `services/tower-baton/bin/notify-milestone.js` uses when it appends a footer to a
  // handback notification. Every check above operates on the function in isolation; this
  // one proves the composition actually calls it.
  const dir = tmp();
  try {
    const p = gfTranscript(dir, [
      gfLine({ sessionId: 'gf-live', at: gfAt(24 * 60 * 1000), tokens: 258_900 }),
      gfLine({ sessionId: 'gf-live', at: gfAt(20 * 1000), tokens: 411_300 }),
    ]);
    const stale = gfStored({ at: gfAt(24 * 60 * 1000), tokens: 258_900, sessionId: 'gf-live', transcriptPath: p });
    writeFileSync(join(dir, 'gf-live.json'), JSON.stringify(stale.data));

    const line = computeFooterLine({ sessionId: 'gf-live', envOverride: dir, now: GF_NOW, next: 'Opus/high' });
    assert.equal(line, '⟦GOV⟧ ctx 411.3k · BLIND · NO ADVICE · next: Opus/high · CONTINUE');

    // The control: the same store with the path stripped is what shipped before, and it
    // is a DIFFERENT line — 24 minutes old, with nothing saying so.
    writeFileSync(join(dir, 'gf-live.json'), JSON.stringify({ ...stale.data, transcript_path: null }));
    const old = computeFooterLine({ sessionId: 'gf-live', envOverride: dir, now: GF_NOW, next: 'Opus/high' });
    assert.equal(old, '⟦GOV⟧ ctx 258.9k · BLIND · NO ADVICE · next: Opus/high · CONTINUE');
    assert.notEqual(line, old, 'the refresh is what moves the line, not the fixture');

    // And the whole line still round-trips through the grammar it never changed.
    assert.equal(parseFooter(line).ok, true);
    assert.equal(parseFooter(line).fields.usedTokens, 411_300);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-GF-01 SEAM: the REAL sampler writes the path, and the REAL refresh reads it back', () => {
  // Every WO-GF-01 test above builds its stored sample BY HAND, which cannot prove that
  // the two modules agree about what they are exchanging — a typo in the field name on
  // either side would leave all of them green while the feature was inert on the machine.
  // This walks the actual seam: `sampler.extractTranscriptSample` writes the sample at a
  // turn boundary, the transcript then grows during the next turn, and
  // `refreshSampleFromTranscript` goes back to the source it recorded.
  const dir = tmp();
  try {
    const p = join(dir, 'seam-gf.jsonl');
    const turnEnd = gfAt(25 * 60 * 1000);
    const midTurn = gfAt(15 * 1000);
    writeFileSync(p, `${gfLine({ sessionId: 'seam-gf', at: turnEnd, tokens: 120_000 })}\n`);

    // 1. The Stop hook's half, run for real.
    const stored = extractTranscriptSample({
      transcriptPath: p, sessionId: 'seam-gf', sampledAt: turnEnd, env: {}, storeOpts: { envOverride: dir },
    });
    assert.equal(stored.transcript_path, p, 'the sampler records WHERE the count came from');
    assert.equal(stored.context_window.used_tokens, 120_000);

    // 2. The turn runs long; the transcript grows. Nothing re-samples.
    writeFileSync(p, `${gfLine({ sessionId: 'seam-gf', at: turnEnd, tokens: 120_000 })}\n${gfLine({ sessionId: 'seam-gf', at: midTurn, tokens: 333_300 })}\n`);

    // 3. The footer's half, run for real, on the wrapper shape it actually consumes.
    const wrapped = { ok: true, approximate: false, data: stored };
    const before = deriveFooterFields({ sample: wrapped, knownSessionId: 'seam-gf', now: GF_NOW });
    assert.equal(before.blindReason, BLIND_REASON.STALE, 'the control: the stored sample IS stale by now');

    const after = deriveFooterFields({
      sample: refreshSampleFromTranscript(wrapped), knownSessionId: 'seam-gf', now: GF_NOW,
    });
    assert.equal(after.blindReason, BLIND_REASON.WINDOW_SIZE_UNKNOWN, 'and the refreshed one is not');
    assert.equal(after.fields.usedTokens, 333_300, 'the count Warwick reads is the one from thirty seconds ago');
    assert.equal(renderFooter(after.fields), '⟦GOV⟧ ctx 333.3k · BLIND · NO ADVICE · next: UNSET · CONTINUE');
    assert.notEqual(renderFooter(after.fields), renderFooter(before.fields));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WO-GF-01: `~` survives onto a BLIND rung that carries a NUMBER, and only there', () => {
  // The defect the STALE repair widened. `blind()` forced `approximate: false` on every
  // rung, which was right while BLIND meant `ctx --` — "approximately unknown" is not a
  // fact about anything. Two rungs now carry a real measurement, and for those the flag
  // means something precise: this sample's session could not be confirmed as mine. Live
  // case, not hypothetical — the footer CLI without `--session` reads the newest sample
  // for the project key and marks it approximate.
  const approx = (over) => ({ ...gfStored({ at: gfAt(25 * 60 * 1000), tokens: 250_000, ...over }), approximate: true });

  // 1. STALE, with a number -> `~`.
  const stale = deriveFooterFields({ sample: approx({}), knownSessionId: 'gf-session', now: GF_NOW });
  assert.equal(stale.blindReason, BLIND_REASON.STALE);
  assert.equal(stale.fields.approximate, true, 'an unconfirmed count must carry its qualifier');
  assert.equal(renderFooter(stale.fields), '⟦GOV⟧ ctx ~250k · BLIND · NO ADVICE · next: UNSET · CONTINUE');

  // 2. WINDOW_SIZE_UNKNOWN, with a number -> `~`. Same rule, the other numeric rung.
  const rung7 = deriveFooterFields({ sample: approx({ at: gfAt(1000) }), knownSessionId: 'gf-session', now: GF_NOW });
  assert.equal(rung7.blindReason, BLIND_REASON.WINDOW_SIZE_UNKNOWN);
  assert.equal(rung7.fields.approximate, true);
  assert.match(renderFooter(rung7.fields), /ctx ~250k/);

  // 3. NO NUMBER -> NO `~`. The original judgement stands wherever it still applies:
  //    `ctx ~--` remains unreachable from the ladder.
  const unreadable = deriveFooterFields({ sample: { ok: false, approximate: true }, now: GF_NOW });
  assert.equal(unreadable.blindReason, BLIND_REASON.SAMPLE_UNREADABLE);
  assert.equal(unreadable.fields.approximate, false, 'approximately unknown is not a fact about anything');
  assert.equal(renderFooter(unreadable.fields), '⟦GOV⟧ ctx -- · BLIND · NO ADVICE · next: UNSET · CONTINUE');

  // 4. SESSION_MISMATCH carries no number by construction, so it can never carry the `~`
  //    either — the boundary of the class, asserted rather than assumed.
  const foreign = deriveFooterFields({ sample: approx({ sessionId: 'someone-else' }), knownSessionId: 'gf-session', now: GF_NOW });
  assert.equal(foreign.blindReason, BLIND_REASON.SESSION_MISMATCH);
  assert.equal(foreign.fields.usedTokens, null);
  assert.equal(foreign.fields.approximate, false);

  // 5. A CONFIRMED sample never gains a `~` it did not earn — the control that stops this
  //    test passing off a flag hardcoded true.
  const confirmed = deriveFooterFields({
    sample: gfStored({ at: gfAt(25 * 60 * 1000), tokens: 250_000 }),
    knownSessionId: 'gf-session', now: GF_NOW,
  });
  assert.equal(confirmed.fields.approximate, false);
  assert.match(renderFooter(confirmed.fields), /ctx 250k/);

  // 6. And it round-trips: the `~` is grammar, not decoration.
  assert.equal(parseFooter(renderFooter(stale.fields)).fields.approximate, true);
});

// ===========================================================================
// WARWICK 2026-08-02 — BLIND MAY NOT CARRY A GRADE-DERIVED RECOMMENDATION
// ===========================================================================
//
// THE RULING, verbatim: "The footer must not pair BLIND with KEEP GOING or CLEAR NOW.
// BLIND must render advice unavailable while still showing the truthful absolute count."
//
// THE DEFECT. `BLIND` means "I could not grade this". Every other member of the advice
// vocabulary is a recommendation DERIVED from a grade. Pairing them had the footer
// withhold the judgement and then offer advice premised on the judgement it had just
// withheld — and `KEEP GOING?` reads on a phone as a hedged yes, which is the reassurance
// BLIND exists to refuse. Same class as `ctx --` over a real measurement: a field
// asserting more than the evidence supports.
//
// ENUMERATED, NOT SPOT-CHECKED. Inspection has no completion condition — "I checked a
// couple of BLIND cases and they looked right" is how a class stays open. Every rung the
// ladder can reach is walked here, and the test asserts a non-zero executed count so it
// cannot go green on an empty loop.

test('WARWICK: every BLIND rung renders NO ADVICE — never KEEP GOING, CLEAR NOW or a hedge', () => {
  const at = (ms) => new Date(GF_NOW - ms).toISOString();
  const pct = (over) => ({
    ok: true, approximate: false,
    data: { schema_version: 1, sampled_at: at(1000), session_id: 'w-session', context_window: { used_percentage: 18 }, ...over },
  });

  // Every rung of D-3's ladder, by its BLIND_REASON, and whether it carries a count.
  const rungs = [
    ['sample unreadable', { sample: { ok: false, approximate: false } }, BLIND_REASON.SAMPLE_UNREADABLE, null],
    ['schema unrecognised', { sample: pct({ schema_version: 2 }) }, BLIND_REASON.SCHEMA_UNRECOGNISED, null],
    ['no usage at all', { sample: pct({ context_window: {} }) }, BLIND_REASON.PERCENTAGE_ABSENT, null],
    ['sampled_at unparseable', { sample: pct({ sampled_at: 'not a date' }) }, BLIND_REASON.SAMPLED_AT_UNPARSEABLE, null],
    ['session mismatch', { sample: pct({ session_id: 'someone-else' }) }, BLIND_REASON.SESSION_MISMATCH, null],
    ['percentage out of range', { sample: pct({ context_window: { used_percentage: 140 } }) }, BLIND_REASON.PERCENTAGE_OUT_OF_RANGE, null],
    ['evaluator threw', { sample: pct(), evaluateFn: () => { throw new Error('boom'); } }, BLIND_REASON.EVALUATOR_THREW, null],
    // The two that carry a real measurement — the half of the ruling that says the count
    // must SURVIVE the advice being withheld.
    ['stale, with a count', { sample: gfStored({ at: at(25 * 60 * 1000), tokens: 250_000, sessionId: 'w-session' }) }, BLIND_REASON.STALE, 250_000],
    ['window unknown, with a count', { sample: gfStored({ at: at(1000), tokens: 461_800, sessionId: 'w-session' }) }, BLIND_REASON.WINDOW_SIZE_UNKNOWN, 461_800],
  ];

  const GRADED = [ADVICE.KEEP_GOING, ADVICE.CLEAR_NOW, ADVICE.UNSURE, ADVICE.TASK_UNKNOWN];
  let examined = 0;

  for (const [label, args, reason, tokens] of rungs) {
    // `taskKnown` is forced BOTH ways: the TASK UNKNOWN suppression must not be able to
    // reach into a BLIND line from either direction.
    for (const next of [NEXT_UNSET, 'Opus/high']) {
      const r = deriveFooterFields({ knownSessionId: 'w-session', now: GF_NOW, next, ...args });
      assert.equal(r.fields.state, 'BLIND', `${label}: must be BLIND`);
      assert.equal(r.blindReason, reason, `${label}: on the expected rung`);
      assert.equal(r.fields.advice, ADVICE.NO_ADVICE, `${label}: advice must be unavailable`);
      for (const graded of GRADED) {
        assert.notEqual(r.fields.advice, graded, `${label}: BLIND must never advise ${graded}`);
      }
      const line = renderFooter(r.fields);
      assert.match(line, / · BLIND · NO ADVICE · /, `${label}: the rendered bytes`);
      assert.doesNotMatch(line, /KEEP GOING|CLEAR NOW|TASK UNKNOWN/, `${label}: no graded advice anywhere in the line`);

      // THE OTHER HALF OF THE RULING: the truthful absolute count still renders.
      assert.equal(r.fields.usedTokens, tokens, `${label}: the count is unaffected by the grade being absent`);
      if (tokens !== null) {
        assert.match(line, new RegExp(`ctx ${(tokens / 1000).toString().replace('.', '\\.')}k`), `${label}: and it reaches the line`);
      }
      // And the line is still readable by the grammar's own parser — the value is in
      // ADVICE_VALUES, so the derived alternation in FOOTER_RE accepts it.
      const parsed = parseFooter(line);
      assert.equal(parsed.ok, true, `${label}: must round-trip`);
      assert.equal(parsed.fields.advice, ADVICE.NO_ADVICE);
      examined += 1;
    }
  }
  assert.equal(examined, 18, 'every rung was walked in both task-knowledge directions');

  // THE CONTROL — the graded states are untouched, so this test cannot pass by the
  // advice field having been flattened for everyone.
  assert.equal(adviceFor('GREEN', { taskKnown: true }), ADVICE.KEEP_GOING);
  assert.equal(adviceFor('AMBER', { taskKnown: true }), ADVICE.KEEP_GOING);
  assert.equal(adviceFor('GREEN', { taskKnown: false }), ADVICE.TASK_UNKNOWN);
  assert.equal(adviceFor('RED', { taskKnown: false }), ADVICE.CLEAR_NOW);
  assert.equal(adviceFor('RECOVERY', { taskKnown: true }), ADVICE.CLEAR_NOW);

  const green = deriveFooterFields({ sample: pct(), knownSessionId: 'w-session', now: GF_NOW, next: 'Opus/high' });
  assert.equal(renderFooter(green.fields), '⟦GOV⟧ ctx 18% · GREEN · KEEP GOING · next: Opus/high · CONTINUE');
});

test('WARWICK: `KEEP GOING?` is RETIRED, not deleted — the parser still reads lines already sent', () => {
  // A grammar in circulation cannot drop a value it has emitted. Transcripts, Telegram
  // notifications sent by tower-baton and the session record all hold lines carrying
  // `KEEP GOING?`, and a parser that rejects its own history is a worse defect than the
  // one this change fixes — `parseFooter` failing means "no footer", which B6 treats as
  // ALLOW. So the member stays readable and simply has no producer.
  const historical = '⟦GOV⟧ ctx 258.9k · BLIND · KEEP GOING? · next: UNSET · CONTINUE';
  const parsed = parseFooter(historical);
  assert.equal(parsed.ok, true, 'a line this estate has already sent must still parse');
  assert.equal(parsed.fields.advice, ADVICE.UNSURE);
  assert.equal(renderFooter(parsed.fields), historical, 'and it still round-trips exactly');

  // ...but NOTHING PRODUCES IT any more. The producer is the whole ladder: sweep every
  // state through both entry points and assert the retired value never comes back.
  let checked = 0;
  for (const state of FOOTER_STATES) {
    assert.notEqual(adviceForState(state), ADVICE.UNSURE, `${state} must not produce the retired value`);
    for (const taskKnown of [true, false]) {
      assert.notEqual(adviceFor(state, { taskKnown }), ADVICE.UNSURE);
      checked += 1;
    }
  }
  assert.equal(checked, FOOTER_STATES.length * 2);
  assert.equal(checked, 10, 'five states, both task-knowledge directions');
});
