// BUILD-002 WP4 — parseChoice unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChoice } from './parseChoice.mjs';

const OPTS = [{ key: 'A', label: 'Accept' }, { key: 'B', label: 'Decline' }, { key: 'C', label: 'Defer' }];

test('matches the bare key, any case', () => {
  assert.deepEqual(parseChoice('A', OPTS), { ok: true, key: 'A', label: 'Accept' });
  assert.deepEqual(parseChoice('b', OPTS), { ok: true, key: 'B', label: 'Decline' });
});

test('matches "option A", "A)", "A.", "A - accept"', () => {
  assert.equal(parseChoice('option C', OPTS).key, 'C');
  assert.equal(parseChoice('A)', OPTS).key, 'A');
  assert.equal(parseChoice('B.', OPTS).key, 'B');
  assert.equal(parseChoice('A - accept it', OPTS).key, 'A');
});

test('matches the full label', () => {
  assert.equal(parseChoice('Decline', OPTS).key, 'B');
  assert.equal(parseChoice('defer', OPTS).key, 'C');
});

test('refuses to guess: empty, unknown, ambiguous', () => {
  assert.equal(parseChoice('', OPTS).ok, false);
  assert.equal(parseChoice('maybe later', OPTS).ok, false);
  assert.equal(parseChoice('Z', OPTS).ok, false);
  // "A" appears in "Accept" but a substring must not match — only exact/label/prefixed forms do.
  assert.equal(parseChoice('I think Accept and Decline', OPTS).ok, false);
});

test('no options -> not ok', () => {
  assert.equal(parseChoice('A', []).ok, false);
});
