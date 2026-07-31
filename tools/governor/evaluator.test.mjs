import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluate, STATE, EXIT_CODE, THRESHOLDS, SIGNAL_KEYS } from './evaluator.mjs';

// ---------------------------------------------------------------------------
// INV-1: BLIND is not GREEN. The mutation test named by the map (T-04 row):
// delete the state file -> assert BLIND, never GREEN. At this pure layer that
// is modelled as "no signals at all" (an adapter that could not read the store
// hands the evaluator {} or undefined), which must never resolve to GREEN.
// ---------------------------------------------------------------------------

test('no signals at all (state file effectively deleted) -> BLIND, never GREEN', () => {
  const verdict = evaluate({});
  assert.equal(verdict.state, STATE.BLIND);
  assert.notEqual(verdict.state, STATE.GREEN);
  assert.equal(verdict.exitCode, EXIT_CODE.BLIND);
});

test('undefined signals argument -> BLIND, never GREEN, never throws', () => {
  const verdict = evaluate(undefined);
  assert.equal(verdict.state, STATE.BLIND);
});

test('null signals argument -> BLIND, never throws', () => {
  const verdict = evaluate(null);
  assert.equal(verdict.state, STATE.BLIND);
});

// ---------------------------------------------------------------------------
// INV-5: no control is trusted until it has been made to fail, and every check
// asserts a non-zero count of things actually examined — so "did not run" can
// never look identical to "ran and found nothing".
// ---------------------------------------------------------------------------

test('INV-5: examinedSignals is non-zero even when every signal is missing', () => {
  const verdict = evaluate({});
  assert.ok(verdict.examinedSignals > 0, 'examinedSignals must be > 0');
  assert.equal(verdict.examinedSignals, SIGNAL_KEYS.length);
});

test('INV-5: examinedSignals is always the full signal count, regardless of which state wins', () => {
  const scenarios = [
    {},
    { contextUsedPercentage: 10 },
    { contextUsedPercentage: 80 },
    { contextUsedPercentage: 10, compactions: 1 },
  ];
  for (const signals of scenarios) {
    const verdict = evaluate(signals);
    assert.equal(verdict.examinedSignals, SIGNAL_KEYS.length, JSON.stringify(signals));
  }
});

// ---------------------------------------------------------------------------
// Main axis: GREEN / AMBER / RED from context used_percentage thresholds.
// ---------------------------------------------------------------------------

test('context used_percentage below AMBER threshold -> GREEN', () => {
  const verdict = evaluate({ contextUsedPercentage: THRESHOLDS.CONTEXT_AMBER - 1 });
  assert.equal(verdict.state, STATE.GREEN);
  assert.equal(verdict.exitCode, EXIT_CODE.GREEN);
});

test('context used_percentage at AMBER threshold -> AMBER', () => {
  const verdict = evaluate({ contextUsedPercentage: THRESHOLDS.CONTEXT_AMBER });
  assert.equal(verdict.state, STATE.AMBER);
});

test('context used_percentage between AMBER and RED -> AMBER', () => {
  const verdict = evaluate({ contextUsedPercentage: THRESHOLDS.CONTEXT_RED - 1 });
  assert.equal(verdict.state, STATE.AMBER);
});

test('context used_percentage at RED threshold -> RED', () => {
  const verdict = evaluate({ contextUsedPercentage: THRESHOLDS.CONTEXT_RED });
  assert.equal(verdict.state, STATE.RED);
  assert.equal(verdict.exitCode, EXIT_CODE.RED);
});

test('context used_percentage well above RED threshold -> RED', () => {
  const verdict = evaluate({ contextUsedPercentage: 99 });
  assert.equal(verdict.state, STATE.RED);
});

// ---------------------------------------------------------------------------
// Missing-field semantics (map section 4): an absent field is unknown, never 0.
// A threshold over an unknown input does not fire. Absence of an optional
// signal alone is NOT BLIND.
// ---------------------------------------------------------------------------

test('missing optional signals do not fire their thresholds and do not cause BLIND', () => {
  const verdict = evaluate({ contextUsedPercentage: 10 });
  assert.equal(verdict.state, STATE.GREEN);
  assert.ok(verdict.unknownSignals.includes('rateLimitFiveHourUsedPercentage'));
  assert.ok(verdict.unknownSignals.includes('growthProjectedRedBeforeCompletion'));
  assert.ok(verdict.unknownSignals.includes('compactions'));
  assert.ok(verdict.unknownSignals.includes('bankedStateStale'));
  assert.ok(verdict.unknownSignals.includes('safeBoundary'));
  assert.ok(!verdict.unknownSignals.includes('contextUsedPercentage'));
});

test('a zero value is NOT treated as unknown (0 is a real, readable reading)', () => {
  const verdict = evaluate({ contextUsedPercentage: 0, rateLimitFiveHourUsedPercentage: 0, compactions: 0 });
  assert.equal(verdict.state, STATE.GREEN);
  assert.ok(!verdict.unknownSignals.includes('contextUsedPercentage'));
  assert.ok(!verdict.unknownSignals.includes('rateLimitFiveHourUsedPercentage'));
  assert.ok(!verdict.unknownSignals.includes('compactions'));
});

test('a non-numeric contextUsedPercentage is treated as unreadable -> BLIND', () => {
  const verdict = evaluate({ contextUsedPercentage: 'not-a-number' });
  assert.equal(verdict.state, STATE.BLIND);
});

test('a non-numeric optional signal is skipped, not fatal', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, rateLimitFiveHourUsedPercentage: 'nope' });
  assert.equal(verdict.state, STATE.GREEN);
  assert.ok(verdict.unknownSignals.includes('rateLimitFiveHourUsedPercentage'));
});

// ---------------------------------------------------------------------------
// Floors: rate-limit and growth-rate can push GREEN -> AMBER, but never lower
// a worse axis reading, and never fire on an unknown input.
// ---------------------------------------------------------------------------

test('rate-limit five_hour >= 85 floors an otherwise-GREEN reading to AMBER', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, rateLimitFiveHourUsedPercentage: 85 });
  assert.equal(verdict.state, STATE.AMBER);
});

test('rate-limit five_hour below 85 does not floor a GREEN reading', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, rateLimitFiveHourUsedPercentage: 84 });
  assert.equal(verdict.state, STATE.GREEN);
});

test('rate-limit floor does not downgrade an already-RED reading', () => {
  const verdict = evaluate({ contextUsedPercentage: 99, rateLimitFiveHourUsedPercentage: 90 });
  assert.equal(verdict.state, STATE.RED);
});

test('growth-rate heuristic floors an otherwise-GREEN reading to AMBER', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, growthProjectedRedBeforeCompletion: true });
  assert.equal(verdict.state, STATE.AMBER);
});

test('growth-rate heuristic false does not floor a GREEN reading', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, growthProjectedRedBeforeCompletion: false });
  assert.equal(verdict.state, STATE.GREEN);
});

// ---------------------------------------------------------------------------
// RECOVERY: authoritative state already partly lost. Outranks the main axis
// in both directions — fires even when context is low, and overrides RED.
// ---------------------------------------------------------------------------

test('any compaction (>=1) this session -> RECOVERY even when context is low', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, compactions: 1 });
  assert.equal(verdict.state, STATE.RECOVERY);
  assert.equal(verdict.exitCode, EXIT_CODE.RECOVERY);
});

test('zero compactions does not trigger RECOVERY', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, compactions: 0 });
  assert.equal(verdict.state, STATE.GREEN);
});

test('banked state stale vs HEAD -> RECOVERY even when context is low', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, bankedStateStale: true });
  assert.equal(verdict.state, STATE.RECOVERY);
});

test('banked state known fresh (false) does not trigger RECOVERY', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, bankedStateStale: false });
  assert.equal(verdict.state, STATE.GREEN);
});

test('RECOVERY outranks RED', () => {
  const verdict = evaluate({ contextUsedPercentage: 99, compactions: 2, rateLimitFiveHourUsedPercentage: 95 });
  assert.equal(verdict.state, STATE.RECOVERY);
});

test('RECOVERY reasons mention both triggers when both fire', () => {
  const verdict = evaluate({ contextUsedPercentage: 10, compactions: 1, bankedStateStale: true });
  assert.equal(verdict.state, STATE.RECOVERY);
  assert.ok(verdict.reasons.some((r) => r.includes('compactions=1')));
  assert.ok(verdict.reasons.some((r) => r.includes('stale vs the live git HEAD')));
});

// ---------------------------------------------------------------------------
// BLIND outranks everything, including RECOVERY.
// ---------------------------------------------------------------------------

test('BLIND outranks RECOVERY: missing required signal wins even with compaction + staleness present', () => {
  const verdict = evaluate({ compactions: 3, bankedStateStale: true });
  assert.equal(verdict.state, STATE.BLIND);
});

test('explicit null for the required signal -> BLIND, same as absence', () => {
  const verdict = evaluate({ contextUsedPercentage: null });
  assert.equal(verdict.state, STATE.BLIND);
});

// ---------------------------------------------------------------------------
// safe-boundary modulates ADVICE only, never the state.
// ---------------------------------------------------------------------------

test('safeBoundary=true at RED -> "rotate now" advice, state still RED', () => {
  const verdict = evaluate({ contextUsedPercentage: 99, safeBoundary: true });
  assert.equal(verdict.state, STATE.RED);
  assert.match(verdict.advice, /rotate now/);
});

test('safeBoundary=false at RED -> "reach a safe boundary urgently" advice, state still RED', () => {
  const verdict = evaluate({ contextUsedPercentage: 99, safeBoundary: false });
  assert.equal(verdict.state, STATE.RED);
  assert.match(verdict.advice, /reach a safe boundary urgently/);
});

test('safeBoundary unknown at RED -> advice says status unknown, state still RED', () => {
  const verdict = evaluate({ contextUsedPercentage: 99 });
  assert.equal(verdict.state, STATE.RED);
  assert.match(verdict.advice, /unknown/);
});

test('safeBoundary never changes a GREEN state either way', () => {
  const withTrue = evaluate({ contextUsedPercentage: 10, safeBoundary: true });
  const withFalse = evaluate({ contextUsedPercentage: 10, safeBoundary: false });
  assert.equal(withTrue.state, STATE.GREEN);
  assert.equal(withFalse.state, STATE.GREEN);
});

// ---------------------------------------------------------------------------
// Exit codes: every state has its own distinct code (INV-1 — "did not run"
// must never be mistaken for "healthy").
// ---------------------------------------------------------------------------

test('every state maps to a distinct exit code', () => {
  const codes = Object.values(EXIT_CODE);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(Object.keys(EXIT_CODE).length, 5);
});

test('verdict.exitCode always matches EXIT_CODE[verdict.state]', () => {
  const cases = [
    {},
    { contextUsedPercentage: 10 },
    { contextUsedPercentage: 60 },
    { contextUsedPercentage: 90 },
    { contextUsedPercentage: 10, compactions: 1 },
  ];
  for (const signals of cases) {
    const verdict = evaluate(signals);
    assert.equal(verdict.exitCode, EXIT_CODE[verdict.state]);
  }
});

// ---------------------------------------------------------------------------
// Full state-space sweep: every subset of known/unknown signals must produce a
// structurally valid verdict and must never throw. 2^6 = 64 combinations.
// ---------------------------------------------------------------------------

function powerSet(keys) {
  const result = [[]];
  for (const key of keys) {
    const withKey = result.map((combo) => [...combo, key]);
    result.push(...withKey);
  }
  return result;
}

const SAMPLE_VALUES = {
  contextUsedPercentage: 60,
  rateLimitFiveHourUsedPercentage: 90,
  growthProjectedRedBeforeCompletion: true,
  compactions: 1,
  bankedStateStale: true,
  safeBoundary: true,
};

test('every combination of present/unknown signals produces a structurally valid verdict', () => {
  const combos = powerSet(SIGNAL_KEYS);
  assert.equal(combos.length, 64);

  for (const presentKeys of combos) {
    const signals = {};
    for (const key of presentKeys) signals[key] = SAMPLE_VALUES[key];

    let verdict;
    assert.doesNotThrow(() => {
      verdict = evaluate(signals);
    }, `evaluate threw for present keys: ${presentKeys.join(',') || '(none)'}`);

    assert.ok(Object.values(STATE).includes(verdict.state));
    assert.equal(verdict.exitCode, EXIT_CODE[verdict.state]);
    assert.equal(verdict.examinedSignals, SIGNAL_KEYS.length);
    assert.ok(Array.isArray(verdict.reasons) && verdict.reasons.length > 0);
    assert.ok(Array.isArray(verdict.unknownSignals));
    assert.equal(verdict.unknownSignals.length, SIGNAL_KEYS.length - presentKeys.length);
    assert.equal(typeof verdict.advice, 'string');
    assert.ok(verdict.advice.length > 0);

    // The one invariant that must hold across every combination (INV-1):
    // absence of the required signal alone is always BLIND, never GREEN.
    if (!presentKeys.includes('contextUsedPercentage')) {
      assert.equal(verdict.state, STATE.BLIND, `missing contextUsedPercentage must be BLIND for combo: ${presentKeys.join(',')}`);
    } else {
      assert.notEqual(verdict.state, STATE.BLIND, `contextUsedPercentage present must never be BLIND for combo: ${presentKeys.join(',')}`);
    }
  }
});
