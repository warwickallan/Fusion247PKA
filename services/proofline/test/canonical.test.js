// Canonical serialisation — the machinery G-4 rests on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cmp, canonicalJson, sha256Hex, sha256Utf8, utf8ByteLength } from '../src/canonical.mjs';

test('cmp is code-unit ordering, NOT locale ordering', () => {
  // The exact pair that motivates the ban: opposite answers.
  assert.equal('Z'.localeCompare('a'), 1);
  assert.equal(cmp('Z', 'a'), -1);
  assert.equal(cmp('a', 'a'), 0);
});

test('canonicalJson sorts object keys ascending, recursively, with no whitespace', () => {
  const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
  const b = { c: { y: 2, z: 1 }, a: 2, b: 1 };
  assert.equal(canonicalJson(a), '{"a":2,"b":1,"c":{"y":2,"z":1}}');
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('canonicalJson preserves array order', () => {
  assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test('canonicalJson REFUSES a float rather than rounding it', () => {
  assert.throws(() => canonicalJson({ x: 1.5 }), /non-integer/);
  assert.throws(() => canonicalJson({ x: NaN }), /non-integer/);
  assert.throws(() => canonicalJson({ x: Infinity }), /non-integer/);
});

test('canonicalJson refuses undefined and functions rather than dropping them', () => {
  assert.throws(() => canonicalJson(undefined), /undefined/);
  assert.throws(() => canonicalJson({ f: () => {} }), /function/);
});

test('canonicalJson normalises -0 to 0', () => {
  assert.equal(canonicalJson(-0), '0');
});

test('sha256Utf8 hashes EXACTLY what arrived — no CRLF folding, no NFC/NFD folding', () => {
  // Map §5.1, both halves verified here rather than asserted in prose.
  assert.notEqual(sha256Utf8('a\r\nb'), sha256Utf8('a\nb'));
  const nfc = 'é'; // é as one code point
  const nfd = 'é'; // e + combining acute
  assert.notEqual(sha256Utf8(nfc), sha256Utf8(nfd));
  assert.notEqual(sha256Utf8(' a'), sha256Utf8('a'));
});

test('sha256Hex over a Buffer and over the equivalent string agree', () => {
  assert.equal(sha256Hex(Buffer.from('hello', 'utf8')), sha256Hex('hello'));
});

test('utf8ByteLength counts bytes, not UTF-16 code units', () => {
  assert.equal(utf8ByteLength('abc'), 3);
  assert.equal(utf8ByteLength('é'), 2);
  assert.equal(utf8ByteLength('\u{1F600}'), 4);
});
