// BUILD-014 Tower — classifyBuild unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBuildRef, classifyMergeRun } from '../classifyBuild.mjs';

test('priority 1: explicit valid build_ref wins', () => {
  assert.deepEqual(classifyBuildRef({ explicit: 'BUILD-002', text: '[BUILD-014] foo' }), { build_ref: 'BUILD-002', source: 'explicit' });
});

test('priority 2: session/run env when no explicit', () => {
  assert.deepEqual(classifyBuildRef({ envRef: 'BUILD-011', text: 'no tag' }), { build_ref: 'BUILD-011', source: 'session_config' });
});

test('priority 3: strict LEADING [BUILD-NNN] BRACKETED tag (not prose, not unbracketed)', () => {
  assert.equal(classifyBuildRef({ text: '[BUILD-002] proof turn' }).build_ref, 'BUILD-002');
  assert.equal(classifyBuildRef({ text: '[BUILD-002 — recover]' }).build_ref, 'BUILD-002');
  // BUILD-002 buried in prose is NOT matched (no fuzzy guessing).
  assert.equal(classifyBuildRef({ text: 'please look at the BUILD-002 work' }).build_ref, 'UNCLASSIFIED');
  // QA-PR58-002: an UNBRACKETED leading token is NOT a tag — the [ is required.
  assert.equal(classifyBuildRef({ text: 'BUILD-002 do the thing' }).build_ref, 'UNCLASSIFIED');
});

test('priority 4: unknown -> UNCLASSIFIED, never BUILD-014', () => {
  assert.equal(classifyBuildRef({ text: 'a plain turn' }).build_ref, 'UNCLASSIFIED');
  assert.equal(classifyBuildRef({}).build_ref, 'UNCLASSIFIED');
  assert.notEqual(classifyBuildRef({ text: 'x' }).build_ref, 'BUILD-014');
});

test('invalid explicit ref falls through (not trusted)', () => {
  assert.equal(classifyBuildRef({ explicit: 'BUILD-2', text: 'x' }).build_ref, 'UNCLASSIFIED'); // wrong shape
});

test('classifyMergeRun demands fully explicit metadata incl. a FULL 40-char head SHA', () => {
  const FULL = 'c7f641b70bdfbf5257eeafd1ae697941a4ca5f6d'; // 40 hex
  assert.deepEqual(classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: 57, headSha: FULL }), { build_ref: 'BUILD-002', source: 'merge_check_explicit' });
  assert.throws(() => classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: 57 }), /head sha/);
  // QA-PR58-001: an ABBREVIATED SHA is rejected — only a full 40-char head is accepted.
  assert.throws(() => classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: 57, headSha: 'c7f641b' }), /FULL 40-char head sha/);
  assert.throws(() => classifyMergeRun({ repo: 'o/r', prNumber: 57, headSha: FULL }), /build_ref/);
  assert.throws(() => classifyMergeRun({ buildRef: 'BUILD-002', prNumber: 57, headSha: FULL }), /repo/);
});

test('classifyMergeRun rejects invalid PR numbers (QA-PR58-004, fail-closed)', () => {
  const FULL = 'c7f641b70bdfbf5257eeafd1ae697941a4ca5f6d';
  for (const bad of [NaN, 0, -1, 1.5, '', 'abc', '58abc', '-5', '1.5', ' ', null, undefined]) {
    assert.throws(() => classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: bad, headSha: FULL }),
      /positive-integer PR number/, `PR "${String(bad)}" must be rejected`);
  }
  // valid: a positive integer as number OR bare numeric string.
  assert.equal(classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: 58, headSha: FULL }).build_ref, 'BUILD-002');
  assert.equal(classifyMergeRun({ buildRef: 'BUILD-002', repo: 'o/r', prNumber: '58', headSha: FULL }).build_ref, 'BUILD-002');
});
