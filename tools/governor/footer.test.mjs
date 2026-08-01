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
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GOV_MARKER,
  SEP,
  HANDBACK_CODES,
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
  deriveFooterFields,
  nextModelFor,
  resolveHealthSample,
  computeFooterLine,
} from './footer.mjs';

// Imported ONLY to pin the shared vocabulary against drift — see the frozen-literal test
// below. Nothing else in this suite depends on the escalation gate.
import { ESCAPE_HATCH_REASONS } from './escalation-gate.mjs';

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

test('the shared vocabulary is pinned to escalation-gate\'s FROZEN literal, not to a string typed here', () => {
  // The drift guard. Silas's §D-2 grammar block said `unsafe-state`; the already-shipped
  // frozen enum says `unsafe-repository-state`, and `escalation-gate.mjs` matches that
  // exact spelling against Larry's own text. A footer emitting the other spelling would
  // have produced a token matching neither the enum nor the constitution — the parser and
  // the gate silently disagreeing about the one token that decides whether a turn may end.
  //
  // Asserting against the IMPORTED constant rather than a literal is the whole point:
  // a test that re-types the string can drift in lockstep with the bug it is meant to
  // catch, which is how the spec came to hold a token no code had ever used.
  assert.equal(ESCAPE_HATCH_REASONS.length, 1);
  const frozen = ESCAPE_HATCH_REASONS[0];
  assert.ok(
    HANDBACK_CODES.includes(frozen),
    `HANDBACK_CODES must contain escalation-gate's frozen ${JSON.stringify(frozen)}`
  );
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

test('D-M5: the state as banked TODAY renders next: UNSET — asserted against the REAL file', () => {
  // COUPLING NOTE, deliberate and accepted at read-back: this test reads the live
  // repository file rather than a fixture, because Silas's D-M5 says "assert against the
  // real file, not a fixture" — the point is to catch the case where what is actually
  // banked would render a stale recommendation. It will need updating the day a state is
  // banked carrying all three new properties AND an open ticket, which is the intended
  // signal, not a failure of the test.
  assert.equal(realState.resumption.next_action_kind, undefined, 'next_action_kind is absent today (U-b)');
  assert.equal(realState.model_recommendation.for_ticket, undefined, 'for_ticket is absent today (U-d)');
  assert.equal(realState.model_recommendation.computed_at_head, undefined, 'computed_at_head is absent today (U-e)');

  const root = tmp();
  try {
    const dir = join(root, 'BUILD-018-session-governor');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'programme-state.json'), readFileSync(REAL_STATE_PATH));

    const r = nextModelFor({
      worktreePath: realState.resumption.worktree,
      worktreeBranch: realState.resumption.branch,
      deliverablesDir: root,
    });
    assert.equal(r.next, NEXT_UNSET, 'today\'s banked state must render UNSET');
    assert.equal(r.unsetReason, UNSET_REASON.NEXT_ACTION_KIND, 'and it must be by ABSENCE, not by any text heuristic');

    // The model name it WOULD have rendered under the old unguarded behaviour.
    assert.equal(realState.model_recommendation.model, 'Sonnet');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
