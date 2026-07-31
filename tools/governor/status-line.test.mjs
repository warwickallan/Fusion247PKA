import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { renderStatusLine, computeStatusLine } from './status-line.mjs';
import { evaluate, STATE, EXIT_CODE, SIGNAL_KEYS } from './evaluator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// AC1: a distinct, readable line for each of the five evaluator states, driven
// by REAL evaluate() output over representative signal combinations built from
// evaluator.mjs's own SIGNAL_KEYS shape (per the accepted read-back: reuse the
// APPROACH, not a literal import of evaluator.test.mjs's unexported helpers).
// ---------------------------------------------------------------------------

const REPRESENTATIVE_SIGNALS_BY_STATE = {
  [STATE.GREEN]: { contextUsedPercentage: 10 },
  [STATE.AMBER]: { contextUsedPercentage: 60 },
  [STATE.RED]: { contextUsedPercentage: 90, safeBoundary: true },
  [STATE.RECOVERY]: { contextUsedPercentage: 10, compactions: 1 },
  [STATE.BLIND]: {},
};

test('sanity: the representative signal combinations actually drive real evaluate() to the state they are meant to', () => {
  for (const [expectedState, signals] of Object.entries(REPRESENTATIVE_SIGNALS_BY_STATE)) {
    const verdict = evaluate(signals);
    assert.equal(verdict.state, expectedState, `signals ${JSON.stringify(signals)} produced ${verdict.state}, expected ${expectedState}`);
  }
});

test('AC1: renderStatusLine produces a distinct, readable line for each of the five states (real evaluate() output)', () => {
  const lines = {};
  for (const [expectedState, signals] of Object.entries(REPRESENTATIVE_SIGNALS_BY_STATE)) {
    const verdict = evaluate(signals);
    const line = renderStatusLine(verdict);

    assert.equal(typeof line, 'string');
    assert.ok(line.length > 0, `line for ${expectedState} must not be empty`);
    assert.ok(line.includes(expectedState), `line for ${expectedState} must name its own state: ${JSON.stringify(line)}`);
    // "readable" — must carry the evaluator's own advice text, not just the bare state.
    assert.ok(typeof verdict.advice === 'string' && verdict.advice.length > 0, `evaluator produced no advice for ${expectedState}`);
    assert.ok(line.includes(verdict.advice), `line for ${expectedState} must carry the evaluator's advice: ${JSON.stringify(line)}`);

    lines[expectedState] = line;
  }

  const distinctLines = new Set(Object.values(lines));
  assert.equal(distinctLines.size, 5, `all five state lines must be distinct: ${JSON.stringify(lines, null, 2)}`);
});

test('AC1: computeStatusLine (the real integration path, default evaluateFn) renders all five states correctly', () => {
  for (const [expectedState, signals] of Object.entries(REPRESENTATIVE_SIGNALS_BY_STATE)) {
    const line = computeStatusLine(signals);
    assert.equal(typeof line, 'string');
    assert.ok(line.includes(expectedState), `computeStatusLine(${JSON.stringify(signals)}) => ${JSON.stringify(line)}, expected to name ${expectedState}`);
  }
});

// ---------------------------------------------------------------------------
// AC2 — the mutation test named by the map (02-MAP.md section 9, T-05 row):
// evaluate() throws -> the status line still renders, and it renders BLIND.
// Never crashes the caller, never returns undefined/empty, never reports a
// healthier state (INV-1, AD-3: unreadable telemetry is never GREEN).
// ---------------------------------------------------------------------------

test('MUTATION (AC2): evaluate() throwing an Error -> status line still renders, and renders BLIND, not a crash', () => {
  const throwingEvaluate = () => {
    throw new Error('forced failure for the mutation test');
  };

  let line;
  assert.doesNotThrow(() => {
    line = computeStatusLine({ contextUsedPercentage: 10 }, { evaluateFn: throwingEvaluate });
  }, 'computeStatusLine must never propagate a throw from evaluateFn');

  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0, 'a thrown evaluate() must still produce a non-empty line');
  assert.ok(line.includes(STATE.BLIND), `line must report BLIND on a throw, got: ${JSON.stringify(line)}`);

  // The BLIND advice text itself legitimately contains the word "GREEN" (as a
  // warning: "never report GREEN"), so a blanket substring check is the wrong
  // assertion. What must never happen is the line's OWN reported state being one
  // of the other four — check the state field the line actually names, per the
  // "GOVERNOR <STATE> — " prefix renderStatusLine always produces.
  for (const otherState of [STATE.GREEN, STATE.AMBER, STATE.RED, STATE.RECOVERY]) {
    assert.ok(!line.startsWith(`GOVERNOR ${otherState} `), `line on a throw must never report its state as ${otherState}: ${JSON.stringify(line)}`);
  }
});

test('MUTATION (AC2): evaluate() throwing a non-Error value (e.g. a bare string) -> still renders BLIND, never crashes', () => {
  const throwingEvaluate = () => {
    // eslint-disable-next-line no-throw-literal
    throw 'a bare string, not an Error instance';
  };

  let line;
  assert.doesNotThrow(() => {
    line = computeStatusLine({}, { evaluateFn: throwingEvaluate });
  });
  assert.ok(line.includes(STATE.BLIND), `line must report BLIND even on a non-Error throw: ${JSON.stringify(line)}`);
});

test('defensive: evaluateFn returning a malformed (non-object) value without throwing still renders without throwing', () => {
  let line;
  assert.doesNotThrow(() => {
    line = computeStatusLine({}, { evaluateFn: () => undefined });
  });
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0);
});

// ---------------------------------------------------------------------------
// AC3 — AD-11 purity split. renderStatusLine is independently unit-testable
// with hand-built verdict objects, WITHOUT ever calling evaluate().
// ---------------------------------------------------------------------------

test('AC3: renderStatusLine renders correctly from a hand-built verdict object per state, without calling evaluate()', () => {
  const handBuilt = {
    [STATE.GREEN]: {
      state: STATE.GREEN,
      exitCode: EXIT_CODE.GREEN,
      reasons: ['context used_percentage 10 < 55 (GREEN).'],
      unknownSignals: ['rateLimitFiveHourUsedPercentage'],
      examinedSignals: SIGNAL_KEYS.length,
      advice: 'headroom available — continue.',
    },
    [STATE.AMBER]: {
      state: STATE.AMBER,
      exitCode: EXIT_CODE.AMBER,
      reasons: ['context used_percentage 60 >= 55 (AMBER threshold).'],
      unknownSignals: [],
      examinedSignals: SIGNAL_KEYS.length,
      advice: 'rotation worthwhile at the next safe boundary; do not start a new substantial item, finish the current one.',
    },
    [STATE.RED]: {
      state: STATE.RED,
      exitCode: EXIT_CODE.RED,
      reasons: ['context used_percentage 90 >= 75 (RED threshold).'],
      unknownSignals: [],
      examinedSignals: SIGNAL_KEYS.length,
      advice: 'rotate now.',
    },
    [STATE.RECOVERY]: {
      state: STATE.RECOVERY,
      exitCode: EXIT_CODE.RECOVERY,
      reasons: ['compactions=1 (>= 1) — authoritative in-context state has been partly lost.'],
      unknownSignals: ['rateLimitFiveHourUsedPercentage', 'safeBoundary'],
      examinedSignals: SIGNAL_KEYS.length,
      advice: 'do not trust in-context memory — re-read durable state before acting.',
    },
    [STATE.BLIND]: {
      state: STATE.BLIND,
      exitCode: EXIT_CODE.BLIND,
      reasons: ['contextUsedPercentage is unreadable — the evaluator cannot determine headroom without it.'],
      unknownSignals: [...SIGNAL_KEYS],
      examinedSignals: SIGNAL_KEYS.length,
      advice: 'telemetry unreadable — treat as at least AMBER; say so loudly, never report GREEN.',
    },
  };

  const lines = {};
  for (const [state, verdict] of Object.entries(handBuilt)) {
    const line = renderStatusLine(verdict);
    assert.ok(line.includes(state), `hand-built ${state} verdict must render a line naming ${state}: ${JSON.stringify(line)}`);
    assert.ok(line.includes(verdict.advice), `hand-built ${state} verdict must render its advice text`);
    lines[state] = line;
  }

  assert.equal(new Set(Object.values(lines)).size, 5, 'all five hand-built lines must be distinct');
});

test('AC3 (structural): status-line.mjs imports nothing but evaluator.mjs — zero filesystem/git/myPKA-estate imports', () => {
  const source = readFileSync(join(__dirname, 'status-line.mjs'), 'utf8');
  const importLines = source
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line));

  assert.ok(importLines.length > 0, 'expected at least one import line (evaluator.mjs)');
  for (const line of importLines) {
    assert.ok(
      line.includes("'./evaluator.mjs'") || line.includes('"./evaluator.mjs"'),
      `status-line.mjs must import only from ./evaluator.mjs, found: ${line.trim()}`
    );
  }

  const forbidden = ['node:fs', 'node:child_process', 'node:process', './health-store.mjs', './programme-state.mjs', './worktree-guard.mjs', './collect-state.mjs', './sampler.mjs'];
  for (const banned of forbidden) {
    assert.ok(!source.includes(banned), `status-line.mjs must never import ${banned}`);
  }
});

// ---------------------------------------------------------------------------
// AC4 — degrades gracefully: a verdict missing optional fields still renders
// without throwing.
// ---------------------------------------------------------------------------

test('AC4: verdict missing advice entirely -> renders without throwing, with a fallback advice text', () => {
  let line;
  assert.doesNotThrow(() => {
    line = renderStatusLine({ state: STATE.GREEN, exitCode: 0, reasons: [], unknownSignals: [], examinedSignals: SIGNAL_KEYS.length });
  });
  assert.ok(line.includes(STATE.GREEN));
  assert.ok(line.length > 0);
});

test('AC4: verdict with empty reasons array -> renders without throwing', () => {
  let line;
  assert.doesNotThrow(() => {
    line = renderStatusLine({ state: STATE.AMBER, advice: 'x', reasons: [], unknownSignals: [], examinedSignals: 0 });
  });
  assert.ok(line.includes(STATE.AMBER));
});

test('AC4: verdict with unknownSignals absent entirely -> renders without throwing, no unknown-count suffix', () => {
  let line;
  assert.doesNotThrow(() => {
    line = renderStatusLine({ state: STATE.RED, advice: 'rotate now.' });
  });
  assert.ok(line.includes(STATE.RED));
  assert.ok(!line.includes('unknown'), `no unknownSignals field should mean no unknown-count suffix: ${JSON.stringify(line)}`);
});

test('AC4: null or undefined verdict -> renders a fallback line, never throws', () => {
  let lineNull, lineUndefined;
  assert.doesNotThrow(() => {
    lineNull = renderStatusLine(null);
  });
  assert.doesNotThrow(() => {
    lineUndefined = renderStatusLine(undefined);
  });
  assert.equal(typeof lineNull, 'string');
  assert.equal(typeof lineUndefined, 'string');
  assert.ok(lineNull.length > 0);
  assert.ok(lineUndefined.length > 0);
});

test('AC4: verdict with a non-object shape (e.g. a bare string) -> renders a fallback line, never throws', () => {
  let line;
  assert.doesNotThrow(() => {
    line = renderStatusLine('not a verdict object');
  });
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0);
});

test('AC4: unknown-count suffix reports N/M when both unknownSignals and examinedSignals are present', () => {
  const line = renderStatusLine({
    state: STATE.BLIND,
    advice: 'telemetry unreadable.',
    unknownSignals: ['contextUsedPercentage', 'compactions'],
    examinedSignals: SIGNAL_KEYS.length,
  });
  assert.ok(line.includes(`2/${SIGNAL_KEYS.length} signals unknown`), `expected a 2/${SIGNAL_KEYS.length} suffix, got: ${JSON.stringify(line)}`);
});
