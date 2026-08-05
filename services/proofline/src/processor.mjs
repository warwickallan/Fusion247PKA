// Proofline — the analysis processor.
//
// A PURE function of the text alone. No I/O, no clock, no locale, no float,
// no randomness. Same text in → byte-identical `result` out, on any key, after
// any restart, in any process. That is G-4.
//
// The spec implemented here is map §5.2, stated exhaustively so nothing is left
// to a guess. Where a line below looks pedantic, it is guarding a real defect:
//
//   - `Array.from(s).length`, never `s.length` — `.length` counts UTF-16 code
//     units, so an emoji would count as 2.
//   - `toLowerCase`, never `toLocaleLowerCase` — the Turkish dotless-i would
//     change `uniqueWords` on a differently-configured machine.
//   - `cmp`, never `localeCompare` — see canonical.mjs.
//   - `avgWordLengthMilli` is explicitly guarded at `words === 0`, because
//     `0/0` is `NaN` and `JSON.stringify` silently renders NaN as `null`.
//   - integer arithmetic only; no float ever reaches JSON.

import { sha256Utf8 } from './canonical.mjs';

export const RESULT_VERSION = 1;

/** Unicode-aware, locale-INDEPENDENT token pattern (map §5.2). */
const TOKEN_SOURCE = "[\\p{L}\\p{N}_']+";

/** Count Unicode code points. NEVER String#length. */
export function codePoints(s) {
  return Array.from(s).length;
}

function tokenise(raw) {
  return raw.match(new RegExp(TOKEN_SOURCE, 'gu')) ?? [];
}

function countChar(raw, ch) {
  let n = 0;
  for (let i = 0; i < raw.length; i++) if (raw[i] === ch) n++;
  return n;
}

function sentenceCount(raw) {
  if (raw.trim() === '') return 0;
  const m = raw.match(/[.!?]+(?=\s|$)/gu);
  return Math.max(1, m ? m.length : 0);
}

function paragraphCount(raw) {
  const blocks = raw.split(/\n[ \t]*\r?\n/);
  let n = 0;
  for (const b of blocks) if (/\S/.test(b)) n++;
  return n;
}

function longestLineOf(raw) {
  if (raw === '') return { index: 0, length: 0 };
  const lines = raw.split('\n');
  let bestIndex = 0;
  let bestLength = -1;
  for (let i = 0; i < lines.length; i++) {
    // Strip ONE trailing '\r' per line (map §5.2).
    const line = lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i];
    const len = codePoints(line);
    // Strictly greater ⇒ the FIRST line of maximal length wins.
    if (len > bestLength) {
      bestLength = len;
      bestIndex = i;
    }
  }
  return { index: bestIndex, length: bestLength };
}

function topTermsOf(tokens) {
  const counts = new Map();
  for (const t of tokens) {
    const k = t.toLowerCase(); // NEVER toLocaleLowerCase
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const entries = [...counts.entries()].map(([term, count]) => ({ term, count }));
  entries.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count; // count DESC
    return a.term < b.term ? -1 : a.term > b.term ? 1 : 0; // then term ASC, code-unit
  });
  return entries.slice(0, 10);
}

/**
 * Analyse `raw` into the structured, deterministic result object.
 *
 * @param {string} raw the text EXACTLY as received
 * @returns {object} every value an integer, a string, or an array/object of those
 */
export function analyze(raw) {
  if (typeof raw !== 'string') throw new TypeError('analyze: text must be a string');

  const tokens = tokenise(raw);
  const words = tokens.length;

  let tokenCodePointSum = 0;
  for (const t of tokens) tokenCodePointSum += codePoints(t);

  const uniqueWords = new Set(tokens.map((t) => t.toLowerCase())).size;

  const result = {
    version: RESULT_VERSION,
    textSha256: sha256Utf8(raw),
    chars: codePoints(raw),
    charsNoWhitespace: codePoints(raw.replace(/\s/gu, '')),
    lines: raw === '' ? 0 : countChar(raw, '\n') + 1,
    words,
    uniqueWords,
    sentences: sentenceCount(raw),
    paragraphs: paragraphCount(raw),
    // trunc(sum * 1000 / words), guarded at words === 0 so NaN can never appear.
    avgWordLengthMilli: words === 0 ? 0 : Math.trunc((tokenCodePointSum * 1000) / words),
    topTerms: topTermsOf(tokens),
    longestLine: longestLineOf(raw),
    // ceil(words * 3 / 10) by exact integer arithmetic — 200 wpm.
    readingTimeSeconds: Math.floor((words * 3 + 9) / 10),
  };

  return result;
}
