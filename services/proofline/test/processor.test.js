// The processor spec (map §5.2), field by field, plus the integer guarantee.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, codePoints } from '../src/processor.mjs';
import { canonicalJson, sha256Hex, sha256Utf8 } from '../src/canonical.mjs';

function sha(text) {
  return sha256Hex(canonicalJson(analyze(text)));
}

/** Walk a value and assert every number is an integer and nothing is null. */
function assertAllIntegers(value, path = 'result') {
  if (value === null) assert.fail(`${path} is null — a NaN leaked through JSON.stringify`);
  if (typeof value === 'number') {
    assert.equal(Number.isInteger(value), true, `${path} = ${value} is not an integer`);
    return;
  }
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertAllIntegers(v, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertAllIntegers(v, `${path}.${k}`);
    return;
  }
  assert.fail(`${path} has unexpected type ${typeof value}`);
}

test('codePoints counts code points, never UTF-16 code units', () => {
  assert.equal('\u{1F600}'.length, 2);
  assert.equal(codePoints('\u{1F600}'), 1);
});

test('empty text produces integers everywhere, never null', () => {
  const r = analyze('');
  assertAllIntegers(r);
  assert.equal(r.chars, 0);
  assert.equal(r.lines, 0);
  assert.equal(r.words, 0);
  assert.equal(r.sentences, 0);
  assert.equal(r.paragraphs, 0);
  assert.equal(r.avgWordLengthMilli, 0, 'the words===0 guard is what stops 0/0 becoming NaN → null');
  assert.deepEqual(r.longestLine, { index: 0, length: 0 });
  assert.equal(r.readingTimeSeconds, 0);
  // The real failure mode: NaN survives the object and dies in JSON.
  assert.equal(JSON.parse(JSON.stringify(r)).avgWordLengthMilli, 0);
});

test('whitespace-only text produces integers everywhere, never null', () => {
  for (const raw of ['   ', '\n\n', ' \t \n  \r\n ']) {
    const r = analyze(raw);
    assertAllIntegers(r, `result(${JSON.stringify(raw)})`);
    assert.equal(r.words, 0);
    assert.equal(r.sentences, 0);
    assert.equal(r.paragraphs, 0);
    assert.equal(r.charsNoWhitespace, 0);
    assert.equal(JSON.parse(JSON.stringify(r)).avgWordLengthMilli, 0);
  }
});

test('lines counts newlines + 1, and is 0 only for empty text', () => {
  assert.equal(analyze('a').lines, 1);
  assert.equal(analyze('a\nb').lines, 2);
  assert.equal(analyze('a\n').lines, 2);
  assert.equal(analyze('\n').lines, 2);
});

test('words / uniqueWords tokenise Unicode-aware and lowercase locale-independently', () => {
  const r = analyze("Ampère's ampère's ÉCOLE école 42 _x");
  assert.equal(r.words, 6);
  assert.equal(r.uniqueWords, 4, "case folds; apostrophes and digits are inside tokens");
  // Never toLocaleLowerCase: a Turkish locale would fold 'I' differently.
  assert.equal(analyze('I i').uniqueWords, 1);
});

test('sentences uses terminator-followed-by-space-or-end, floored at 1 for non-blank text', () => {
  assert.equal(analyze('no terminator here').sentences, 1);
  assert.equal(analyze('One. Two! Three?').sentences, 3);
  assert.equal(analyze('Wait... really?').sentences, 2, 'runs of terminators collapse to one');
  assert.equal(analyze('   ').sentences, 0);
});

test('paragraphs counts non-blank blocks separated by a blank line, CRLF included', () => {
  assert.equal(analyze('a\n\nb').paragraphs, 2);
  assert.equal(analyze('a\r\n\r\nb').paragraphs, 2);
  assert.equal(analyze('a\n   \nb').paragraphs, 2, 'a whitespace-only separator line still separates');
  assert.equal(analyze('a\nb').paragraphs, 1);
  assert.equal(analyze('\n\n').paragraphs, 0);
});

test('longestLine strips ONE trailing CR and returns the FIRST maximal line', () => {
  assert.deepEqual(analyze('abc\r\nabc\r\nx').longestLine, { index: 0, length: 3 });
  assert.deepEqual(analyze('a\nbbbb\ncc').longestLine, { index: 1, length: 4 });
  assert.deepEqual(analyze('').longestLine, { index: 0, length: 0 });
  // Code points, not code units.
  assert.deepEqual(analyze('\u{1F600}\u{1F600}\nabc').longestLine, { index: 1, length: 3 });
});

test('avgWordLengthMilli truncates and is exact integer arithmetic', () => {
  // "ab cde" → (2 + 3) * 1000 / 2 = 2500
  assert.equal(analyze('ab cde').avgWordLengthMilli, 2500);
  // "a ab abc" → 6 * 1000 / 3 = 2000
  assert.equal(analyze('a ab abc').avgWordLengthMilli, 2000);
  // "a ab" → 3 * 1000 / 2 = 1500
  assert.equal(analyze('a ab').avgWordLengthMilli, 1500);
  // truncation, not rounding: "a a b" → 3*1000/3 = 1000 ; "ab a a" → 4000/3 = 1333.33 → 1333
  assert.equal(analyze('ab a a').avgWordLengthMilli, 1333);
});

test('readingTimeSeconds is ceil(words * 3 / 10) by integer arithmetic', () => {
  const cases = [0, 1, 3, 10, 11, 33, 200, 201];
  for (const n of cases) {
    const text = Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    assert.equal(analyze(text).readingTimeSeconds, Math.ceil((n * 3) / 10), `words=${n}`);
  }
});

test('topTerms sorts by count DESC then term ASC (code-unit), capped at 10', () => {
  const r = analyze('b b a a c Z');
  assert.deepEqual(r.topTerms.slice(0, 3), [
    { term: 'a', count: 2 },
    { term: 'b', count: 2 },
    { term: 'c', count: 1 },
  ]);
  // 'z' (from 'Z') sorts after 'c' by code unit — and would sort differently
  // under localeCompare, which is precisely why it is banned.
  assert.deepEqual(r.topTerms[3], { term: 'z', count: 1 });

  const many = Array.from({ length: 25 }, (_, i) => `t${String(i).padStart(2, '0')}`).join(' ');
  assert.equal(analyze(many).topTerms.length, 10);
});

test('result carries version and the text digest', () => {
  const r = analyze('hello');
  assert.equal(r.version, 1);
  assert.equal(r.textSha256, sha256Utf8('hello'));
});

test('T-2 (part) — analysis is a pure function of the text: repeated calls are byte-identical', () => {
  const text = 'The quick brown fox.\n\nJumped over 2 lazy dogs — twice.\r\nÉcole; école.';
  const first = canonicalJson(analyze(text));
  for (let i = 0; i < 25; i++) {
    assert.equal(canonicalJson(analyze(text)), first);
  }
});

test('T-2 (part) — different text gives a different digest; identical text gives the same one', () => {
  assert.equal(sha('same'), sha('same'));
  assert.notEqual(sha('same'), sha('Same'));
  assert.notEqual(sha('a\r\nb'), sha('a\nb'));
});

test('analyze rejects a non-string rather than coercing it', () => {
  assert.throws(() => analyze(42), /must be a string/);
  assert.throws(() => analyze(null), /must be a string/);
});
