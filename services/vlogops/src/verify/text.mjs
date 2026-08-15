// BUILD-006 Phase 4 — the text machinery the rules share. Pure, total, no I/O.
//
// Every function here is a PURE FUNCTION of its argument, on the same rule package.mjs and
// pack.mjs follow: no database, no filesystem, no clock, no randomness, no process identity. The
// rules that use them are therefore testable without a database, and the verdict a rule reaches
// is reproducible from the same rows on any machine on any day.
//
// ── WHY THE EXTRACTORS ARE DELIBERATELY NARROW ──────────────────────────────────────────────
// Each extractor below decides what the verifier is entitled to have an opinion about, and every
// one of them errs toward NOT having one. A checker that fires on correct work is worse than no
// checker at all: people learn to clear its findings without reading them, and then it is still
// firing on the day it is right.
//
// So the floors — a two-digit minimum on numbers, a forty-character minimum on quotations, a
// closed list of private-detail patterns — are FALSE NEGATIVES BY CHOICE. They are written down
// in src/verify/contract/verification-v1.md, where a human can disagree with them, rather than
// buried here where only a reader of this file would ever find them.

import { normaliseSuppliedText } from '../identity.mjs';

/**
 * Phase 1's normalisation, unchanged and re-used rather than re-implemented: NFC, CRLF and CR
 * folded to LF, trimmed. Applied to BOTH sides of every comparison this module makes.
 */
export function normalise(text) {
  return normaliseSuppliedText(String(text ?? ''));
}

/**
 * Phase 1's normalisation plus whitespace flattening, applied symmetrically.
 *
 * The extension is declared in the ruleset and its reason is narrow: a passage quoted into a
 * script is re-wrapped, and a line break where the source had a space is not a misquotation. It
 * tolerates whitespace and NOTHING else — a changed word, a changed number, a dropped clause or
 * an added one all still fail.
 */
export function flatten(text) {
  return normalise(text).replace(/\s+/g, ' ');
}

// ── quotations ────────────────────────────────────────────────────────────────────────────

/** Matched quotation-mark pairs this estate's prose actually uses. */
const QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],   // “ ”
  ['‘', '’'],   // ‘ ’
  ['«', '»'],   // « »
];

/** The floor below which a delimited span is not treated as a quotation. Ruleset: QUOTATION. */
export const QUOTED_SPAN_MIN_CHARS = 40;

const WORD = /[A-Za-z0-9]/;

/**
 * A delimiter only counts at a word boundary.
 *
 * THIS IS WHAT STOPS AN APOSTROPHE BEING READ AS A QUOTATION MARK. "it is not written in
 * anybody's voice, and it doesn't pretend to be" contains two apostrophes; without this rule the
 * text between them is extracted as a quoted passage, checked against the evidence, and reported
 * as a misquotation. The verifier would then be raising findings about English contractions —
 * which is precisely how a checker earns the reputation that gets it switched off.
 *
 * So an opener must begin a word and a closer must end one.
 */
function isOpenerAt(src, i) {
  return i === 0 || !WORD.test(src[i - 1]);
}

function isCloserAt(src, i) {
  return i === src.length - 1 || !WORD.test(src[i + 1]);
}

/**
 * Every quoted span in a piece of text, flattened, at or above the length floor.
 *
 * Scanning is left-to-right and non-overlapping: an opener consumes up to its own closer, and the
 * search resumes after it. Nesting is not modelled, because prose does not nest quotation marks
 * reliably enough for a checker to reason about — and a checker that guesses at structure is one
 * that will one day guess wrong in the direction of a false pass.
 */
export function extractQuotedSpans(text, minChars = QUOTED_SPAN_MIN_CHARS) {
  const src = normalise(text);
  const spans = [];

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const pair = QUOTE_PAIRS.find(([open]) => open === ch);
    if (pair === undefined || !isOpenerAt(src, i)) { i += 1; continue; }

    let close = src.indexOf(pair[1], i + 1);
    while (close !== -1 && !isCloserAt(src, close)) {
      close = src.indexOf(pair[1], close + 1);
    }
    if (close === -1) { i += 1; continue; }

    const inner = flatten(src.slice(i + 1, close));
    if (inner.length >= minChars) {
      spans.push({ text: inner, start: i, length: inner.length });
    }
    i = close + 1;
  }

  return spans;
}

// ── checkable factual tokens ──────────────────────────────────────────────────────────────

/**
 * Bare integers shorter than this are NOT treated as factual assertions.
 *
 * "STUB SCENE 3", "the second beat", "all 4 siblings" — single digits in prose are overwhelmingly
 * ordinals and enumerations, and admitting them would make FACT fire on nearly every correct
 * package. Declared in the ruleset as a false negative rather than hidden here.
 *
 * A single digit still counts when it carries a unit: `£3`, `3%`, a date or a time.
 */
export const BARE_NUMBER_MIN_DIGITS = 2;

const CURRENCY = '[£$€]';

const TOKEN_PATTERNS = [
  // Money first — it must win over the bare-number rule, and a £3 IS a factual assertion.
  { kind: 'currency', re: new RegExp(`${CURRENCY}\\s?\\d[\\d,]*(?:\\.\\d+)?`, 'g') },
  { kind: 'percentage', re: /\d[\d,]*(?:\.\d+)?\s?%/g },
  { kind: 'date-iso', re: /\b\d{4}-\d{2}-\d{2}\b/g },
  {
    kind: 'date-written',
    re: /\b(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}?,?\s*\d{4}\b/gi,
  },
  { kind: 'time', re: /\b\d{1,2}:\d{2}(?::\d{2})?\b/g },
  { kind: 'number', re: /\b\d[\d,]*(?:\.\d+)?\b/g },
];

/** Digits only, for the bare-number floor. */
function digitCount(s) {
  return (s.match(/\d/g) || []).length;
}

/**
 * The surface forms a token may legitimately take in the evidence.
 *
 * A claim writing "1,234" against a source writing "1234" is the same number, and a checker that
 * called that a factual error would be wrong in the most annoying possible way. Currency and
 * percentage tokens also ground on their bare number, because evidence often carries the figure
 * in a table or a column header without the symbol.
 */
function surfaceForms(kind, raw) {
  const forms = new Set([raw, raw.replace(/\s/g, '')]);
  const bare = raw.replace(/[£$€%,\s]/g, '');
  if (bare !== '') {
    forms.add(bare);
    if (kind === 'currency' || kind === 'percentage' || kind === 'number') {
      forms.add(bare.replace(/\.0+$/, ''));
    }
  }
  if (kind === 'number') forms.add(raw.replace(/,/g, ''));
  return [...forms].filter((f) => f !== '');
}

/**
 * Every checkable factual token in a piece of text.
 *
 * Overlapping matches are resolved by position and precedence: a currency amount claims its
 * digits so the bare-number pattern cannot also report them, which would otherwise turn one
 * assertion into two findings.
 */
export function extractFactTokens(text) {
  const src = flatten(text);
  const claimed = [];
  const tokens = [];

  for (const { kind, re } of TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let m = re.exec(src);
    while (m !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = claimed.some(([s, e]) => start < e && end > s);

      if (!overlaps) {
        const raw = m[0].trim();
        const admissible = kind !== 'number' || digitCount(raw) >= BARE_NUMBER_MIN_DIGITS;
        if (admissible) {
          claimed.push([start, end]);
          tokens.push({ kind, raw, forms: surfaceForms(kind, raw) });
        }
      }
      m = re.exec(src);
    }
  }

  return tokens;
}

/**
 * Is a token present in this evidence text?
 *
 * Compared on the flattened form of both sides, and satisfied by ANY of the token's legitimate
 * surface forms.
 */
export function tokenIsGrounded(token, evidenceFlat) {
  return token.forms.some((f) => evidenceFlat.includes(f));
}

// ── private-detail patterns (PRIV-4) ──────────────────────────────────────────────────────

/**
 * A closed list. Each entry has its own rule id so a finding names WHAT it matched, letting
 * Warwick disagree with the pattern rather than with the machine.
 *
 * There is deliberately no general "does this look private" heuristic here. That would be this
 * code deciding what his private life consists of, which Wayfinder §11 reserves to him.
 */
const PRIVATE_PATTERNS = [
  { rule: 'PRIV-4/email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { rule: 'PRIV-4/phone', re: /(?:\+\d{1,3}[\s-]?)?(?:\(?0\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}\b/g },
  { rule: 'PRIV-4/uk-postcode', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  { rule: 'PRIV-4/iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { rule: 'PRIV-4/card-number', re: /\b(?:\d[ -]?){13,19}\b/g, luhn: true },
  {
    rule: 'PRIV-4/credential',
    re: /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})/g,
  },
];

/**
 * The Luhn check, so a 16-digit build number or a truncated hash does not get reported as a
 * payment card. A pattern that cries wolf on ordinary numbers is one that gets switched off.
 */
function luhnValid(digits) {
  const ds = digits.replace(/\D/g, '');
  if (ds.length < 13 || ds.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = ds.length - 1; i >= 0; i -= 1) {
    let d = Number(ds[i]);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * INTERNAL. Every private-detail match in a piece of text, WITH the matched value.
 *
 * ⛔ THE RAW VALUE MUST NEVER LEAVE THE PROCESS. ⛔ It exists here for exactly one purpose: so
 * that another dimension can recognise a value as private and mask it too. Nothing may put a
 * `raw` from this function into a finding, an evidence object, a manifest, a log line or stdout.
 * `scanPrivatePatterns` below is the safe view and is what callers should reach for.
 */
export function privateMatchesRaw(text) {
  const src = flatten(text);
  const hits = [];

  for (const { rule, re, luhn } of PRIVATE_PATTERNS) {
    re.lastIndex = 0;
    let m = re.exec(src);
    while (m !== null) {
      const raw = m[0];
      if (!luhn || luhnValid(raw)) {
        hits.push({ rule, raw, redacted: redact(raw), length: raw.length });
      }
      m = re.exec(src);
    }
  }

  return hits;
}

/**
 * Scan publishable text for the named private-detail patterns.
 *
 * ⛔ THE MATCH IS NEVER RETURNED IN FULL. A privacy finding that copied the offending value into
 * the findings table — and from there into a report, a demonstration document or a pull request —
 * would have spread the exact thing it exists to stop. What comes back is the rule, the length,
 * and a short masked shape. That is enough for a human to find it in the package and decide.
 */
export function scanPrivatePatterns(text) {
  return privateMatchesRaw(text).map(({ rule, redacted, length }) => ({ rule, redacted, length }));
}

/**
 * Does this factual token sit INSIDE something a privacy rule matched in the same text?
 *
 * ⛔ WHY THIS EXISTS, AND IT IS THE WHOLE OF FINDING D-1 ⛔
 *
 * The privacy dimension masked correctly. The FACT dimension, in the same run, over the same
 * sentence, recorded the digit groups of a planted phone number VERBATIM — as a token in a FACT-2
 * finding and in the stored run manifest. Every Phase 4 table refuses UPDATE and DELETE, so a
 * value written there is UNREMOVABLE; from there it reached a demonstration document committed to
 * a PUBLIC repository, three lines above the sentence claiming it could not happen.
 *
 * Nothing had escaped — the planted values are reserved fakes. But a real private detail in a real
 * package would have been written verbatim into an append-only table by the dimension standing
 * next to the one built to stop exactly that.
 *
 * So masking is a property of the RUN, not of one dimension. Any dimension about to record a
 * value asks this first.
 *
 * Returns the matching hit (rule, redacted, length) or `null`. **The raw value is never returned.**
 */
export function privacyCoverFor(tokenRaw, hits) {
  const bare = String(tokenRaw).replace(/[,\s]/g, '');
  if (bare === '') return null;

  const hit = hits.find((h) => {
    const hay = h.raw;
    return hay.includes(tokenRaw) || hay.replace(/[,\s]/g, '').includes(bare);
  });

  return hit === undefined ? null : { rule: hit.rule, redacted: hit.redacted, length: hit.length };
}

/** First character, last character, everything between them masked. Never the value. */
export function redact(value) {
  const s = String(value);
  if (s.length <= 2) return '*'.repeat(s.length);
  return `${s[0]}${'*'.repeat(Math.min(s.length - 2, 12))}${s[s.length - 1]}`;
}
