import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from './llm.mjs';

test('extractJson parses plain JSON', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
});

test('extractJson strips code fences', () => {
  assert.deepEqual(extractJson('```json\n{"ok":true}\n```'), { ok: true });
});

test('extractJson finds JSON amid prose', () => {
  assert.deepEqual(extractJson('Sure! Here you go: [1,2,3] hope that helps'), [1, 2, 3]);
});

test('extractJson tolerates trailing junk', () => {
  assert.deepEqual(extractJson('{"x":5} <-- done'), { x: 5 });
});

test('extractJson returns null on no json', () => {
  assert.equal(extractJson('no json here'), null);
});
