// =====================================================================
// IDEA-012 AsdAIr - skill: listNormaliser.js
//
// The deterministic raw-list -> normalized-list parser.
//
// normaliseRawList(text) -> { items, needs_review }
//   items        : [ { item_name, requested_qty, note } ]
//   needs_review : [ { raw, reason } ]
//
// This is the KEYLESS, GATE-FREE deterministic half of the parked "B"
// convergence work (see Deliverables/2026-07-18-asdair-gateway-
// convergence-contract.md section 5, `transcribe(raw) -> {items,
// confidence}`). The model/OCR call that produces `raw` is GATED and
// PARKED; the deterministic post-parse below is NOT gated and is built
// here. It performs the "normalized structured list" step ONLY.
//
// PURE and DETERMINISTIC:
//   * No DB, no network, no fs, no clock, no randomness, no model call.
//   * Given identical input text it always returns an identical result.
//   * No side effects; it only reads its argument and returns a value.
//
// HARD GUARANTEES (stricter bar, 2026-07-20):
//   * It NEVER silently drops a line. Every non-blank line -- INCLUDING a
//     line that reduces to only a list marker/ordinal ("-", "*", "5.", "2)")
//     -- becomes EXACTLY one `items` entry or one `needs_review` entry.
//     Marker-only lines are surfaced to `needs_review` (reason
//     `marker-only line`), NEVER dropped. (This supersedes the earlier
//     "documented skip" behaviour for lone markers.)
//   * It NEVER guesses an ambiguous quantity, and it NEVER silently defaults
//     to qty 1 when a leading/trailing token merely LOOKS like a quantity but
//     is not a clean supported positive-integer form. Conflicting quantities,
//     and malformed numeric-looking tokens -- SIGNED (`+2`, `-2`), DECIMAL
//     (`1.5`, `2.5`, `2.`), NON-ASCII / UNICODE digits (fullwidth, Arabic-
//     indic) -- all send the line to `needs_review` untouched.
//   * A NUMBERED-LIST marker ("1. ", "2. ", "3) ") is a list marker, NOT a
//     quantity: it is stripped and the item parses normally at qty 1, so a real
//     numbered list ("1. jam / 2. bread / 3. milk") yields ordinary items. Only
//     a marker-ONLY line (no item text after stripping: "5.", "-") -> review.
//   * A SPELLED-OUT leading word-number is only read as a quantity when a
//     SINGLE token follows ("two milk" -> 2). Followed by MULTIPLE tokens
//     ("four cheese pizza", "six pack beer") it is ambiguous -> review, never a
//     silent guessed quantity. Digit forms ("4 cheese pizza") are exempt.
//   * A line with NO numeric-looking leading/trailing token at all defaults
//     to requested_qty = 1. A bare in-name integer that is not a quantity
//     form ("omega 3", "2x4 timber") stays part of the item name.
//
// PURE ASCII only (unicode-digit handling is done via property escapes; the
// source stays ASCII).
// =====================================================================

'use strict';

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

// Collapse a string to single-spaced, trimmed form (preserves case).
function collapseWs(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

// Normalise an item name: collapse whitespace + lower-case. This is the
// canonical display form the downstream planner also lower-cases when it
// matches, so it stays stable end to end.
function normaliseItemName(value) {
  return collapseWs(value).toLowerCase();
}

// A parsed name is only a real item if it carries at least one letter.
// "2", "###", or an emptied string are NOT items -> needs_review.
function hasLetter(value) {
  return /[a-z]/i.test(value);
}

// A whitespace-delimited token that LOOKS like a quantity but is NOT one of
// the clean supported positive-integer forms. Used to guard the residual item
// text's leading/trailing token so a numeric-looking scrap is surfaced to
// review instead of being silently swallowed into the name at qty 1.
//
// Flags (all -> needs_review):
//   * SIGNED integer .............. "+2", "-2", "+10"
//   * DECIMAL / dotted number ..... "1.5", "2.5", ".5", "2.", "-2.5"
//   * NON-ASCII / UNICODE digits ... fullwidth "\uFF12", Arabic-indic "\u0662"
//     (a token made ENTIRELY of decimal digits where at least one digit is not
//      ASCII 0-9). A plain ASCII integer ("3" in "omega 3") is NOT flagged --
//      that is a legitimate in-name number, not a malformed quantity.
// It deliberately does NOT flag mixed alnum tokens ("2x4", "b12") or clean
// ASCII integers; those are handled elsewhere or are legitimate item text.
function isMalformedNumericToken(t) {
  if (typeof t !== 'string' || t === '') return false;
  // signed integer: "+2", "-2"
  if (/^[+-]\d+$/.test(t)) return true;
  // decimal / dotted number, optionally signed: "1.5", ".5", "2.", "-2.5"
  if (/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(t)) return true;
  // token made entirely of decimal digits, at least one of them non-ASCII
  // (fullwidth / Arabic-indic / etc.). \p{Nd} = any Unicode decimal digit;
  // [^\P{Nd}0-9] = a Unicode digit that is not ASCII 0-9.
  if (/^\p{Nd}+$/u.test(t) && /[^\P{Nd}0-9]/u.test(t)) return true;
  return false;
}

// Return the distinct numeric values in order of first appearance.
function distinctNumbers(nums) {
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    if (out.indexOf(nums[i]) === -1) out.push(nums[i]);
  }
  return out;
}

// Word-number vocabulary supported as a LEADING quantity ("two milk").
// Deliberately bounded and explicit (one..twenty) so the parser stays
// deterministic and never guesses at vague words ("several", "a few").
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20
};

// Known WORD-NUMBER COLLISIONS: product names whose first token is also a
// spelled-out number, so the leading word-number extractor would otherwise
// read the number as a quantity and the product's tail as the item
// ("seven up" -> qty 7 x "up"; "five spice" -> qty 5 x "spice"). Both are
// real grocery items, so in the NEVER-GUESS spirit these route to review.
//
// We use an explicit, curated exception list rather than the broader rule
// "any leading word-number followed by a single-token remainder -> review".
// That broader rule is unsafe here because it also flags LEGITIMATE
// quantities with a single-token item ("two milk", "three eggs") -- both of
// which are existing, correct fixtures. Digit forms ("7 up") are left alone:
// a typed digit is a much stronger quantity signal than a spelled word.
// Keys are the fully normalised (lower-cased, single-spaced) phrase.
const WORD_NUMBER_COLLISIONS = {
  'seven up': true,   // 7 Up (soft drink)
  'five spice': true  // Chinese five-spice blend
};

// Upper sanity bound on an explicit quantity. A household shopping list will
// never legitimately request more than this; a value above it (or one that
// has lost integer precision past Number.MAX_SAFE_INTEGER) is far likelier a
// typo or an OCR run-on than a real request, so it routes to review. This is
// the symmetric partner of the existing non-positive ("0 milk") guard.
const MAX_QTY = 999;

// ---------------------------------------------------------------------
// Prefix stripping (bullets and ordinals)
//
// Removes a leading list marker so it is never mistaken for content:
//   * "- ", "* ", bullet "\u2022 "  -> dash / star / bullet
//   * "1. ", "2) "                  -> NUMBERED ORDINAL. The number here is
//                                      an ordinal, NOT a quantity, so it is
//                                      dropped. This is what distinguishes
//                                      "1. milk" (ordinal -> qty 1) from
//                                      "2 milk" (bare number -> qty 2).
// The ordinal form requires the "." / ")" to be followed by whitespace or
// end-of-line, so a decimal like "1.5 milk" is never split, yet a line that
// is ONLY a marker ("-" or "1.") collapses to empty. Such marker-only lines
// are no longer skipped: the caller surfaces them to `needs_review` (reason
// `marker-only line`) so nothing is silently dropped.
//
// Note on ordinal magnitude: stripPrefix removes ANY "N." / "N)" marker of ANY
// magnitude, because a numbered-list marker is never a quantity. "2. milk" and
// "3) eggs" therefore strip to "milk" / "eggs" and parse as ordinary items at
// qty 1 -- a real numbered list parses as a list. (Contrast "2 milk", a bare
// number with no "." / ")", which IS a quantity of 2.)
// ---------------------------------------------------------------------
function stripPrefix(s) {
  return s
    .replace(/^\s*[-*\u2022](?:\s+|$)/, '')
    .replace(/^\s*\d+[.)](?:\s+|$)/, '');
}

// ---------------------------------------------------------------------
// Parenthetical extraction
//
// Every "(...)" group is pulled out of the working string:
//   * purely numeric ("(2)" or "(x2)") -> a QUANTITY signal
//   * anything else ("(organic)")      -> a trailing NOTE
// Multiple notes are joined with "; ". The parenthetical is replaced by a
// space so it never welds two words together.
// ---------------------------------------------------------------------
function extractParentheticals(s) {
  const qtys = [];
  const notes = [];
  const stripped = s.replace(/\(([^)]*)\)/g, function (_whole, inner) {
    const numeric = inner.trim().match(/^x?\s*(\d+)\s*$/i);
    if (numeric) {
      qtys.push(parseInt(numeric[1], 10));
    } else {
      const t = collapseWs(inner);
      if (t) notes.push(t);
    }
    return ' ';
  });
  return { stripped: stripped, qtys: qtys, note: notes.join('; ') };
}

// ---------------------------------------------------------------------
// Leading / trailing quantity extraction on the paren-stripped core.
//
// Recognised forms (case-insensitive), each contributing a quantity value
// and being removed from the working string:
//   * trailing " xN"  -> "milk x2"
//   * leading  "xN "  -> "x2 milk"
//   * leading  "Nx "  -> "2x milk"   (x must be followed by whitespace, so
//                        a pack spec like "2x4 timber" is left untouched)
//   * leading  "N "   -> "2 milk"    (bare number)
//   * leading  word   -> "two milk"  (one..twenty)
//
// Every detected value is collected; the caller decides agreement vs
// conflict. This function never resolves a conflict itself.
//
// Leading extraction LOOPS: a line like "4x 5x widgets" yields BOTH 4 and 5
// so an unconsumed second quantity surfaces as a conflict rather than being
// welded into the item name ("5x widgets").
// ---------------------------------------------------------------------
function extractLeadingQuantity(working) {
  let m;
  if ((m = working.match(/^x\s*(\d+)(?:\s+|$)/i)) !== null) {
    return { value: parseInt(m[1], 10), rest: working.slice(m[0].length).trim() };
  }
  if ((m = working.match(/^(\d+)\s*x\s+/i)) !== null) {
    return { value: parseInt(m[1], 10), rest: working.slice(m[0].length).trim() };
  }
  if ((m = working.match(/^(\d+)\s+/)) !== null) {
    return { value: parseInt(m[1], 10), rest: working.slice(m[0].length).trim() };
  }
  if ((m = working.match(/^([a-z]+)\s+/i)) !== null &&
      Object.prototype.hasOwnProperty.call(WORD_NUMBERS, m[1].toLowerCase())) {
    return { value: WORD_NUMBERS[m[1].toLowerCase()], rest: working.slice(m[0].length).trim() };
  }
  return null;
}

function extractQuantities(coreIn) {
  let working = collapseWs(coreIn);
  const qtys = [];

  // trailing " xN", consumed REPEATEDLY until none remains. A single pass
  // would leave a second trailing form welded into the name: "milk x2 x3"
  // would strip only " x3" and keep "milk x2" as the item. Looping surfaces
  // BOTH quantities so a doubled trailing form ("milk x2 x3", or with a note
  // interleaved "milk x2 (organic) x3" once the paren is stripped upstream)
  // becomes a conflict in the caller rather than a silently guessed qty. The
  // leading loop below already works this way; the two are now symmetric.
  let trailing = working.match(/(?:^|\s)x\s*(\d+)\s*$/i);
  while (trailing) {
    qtys.push(parseInt(trailing[1], 10));
    working = working.slice(0, trailing.index).trim();
    trailing = working.match(/(?:^|\s)x\s*(\d+)\s*$/i);
  }

  // leading quantities, consumed repeatedly until none remains
  let lead = extractLeadingQuantity(working);
  while (lead !== null) {
    qtys.push(lead.value);
    working = lead.rest;
    lead = extractLeadingQuantity(working);
  }

  return { qtys: qtys, rest: working };
}

// ---------------------------------------------------------------------
// Parse ONE already-prefix-stripped, non-empty line.
//
// Returns one of:
//   { kind: 'item',   item_name, requested_qty, note }
//   { kind: 'review', reason }
// ---------------------------------------------------------------------
function parseLine(line) {
  const paren = extractParentheticals(line);

  // Word-number collision guard (runs BEFORE quantity extraction): if the
  // whole paren-stripped line is a known product whose first token is a
  // spelled number ("seven up", "five spice"), do not let the leading
  // word-number extractor split it. The check is on the fully normalised
  // phrase so it is case- and whitespace-insensitive, and it fires whether
  // or not a trailing note was present ("seven up (organic)" strips to the
  // same key). Digit forms ("7 up") never match a key and pass straight
  // through as a real quantity.
  const collisionKey = normaliseItemName(paren.stripped);
  if (Object.prototype.hasOwnProperty.call(WORD_NUMBER_COLLISIONS, collisionKey)) {
    return { kind: 'review', reason: 'ambiguous word-number vs item name: ' + collisionKey };
  }

  // Leading word-number ambiguity heuristic (runs BEFORE quantity extraction).
  // A SPELLED-OUT leading number ("two", "four", "six") is only an unambiguous
  // quantity when EXACTLY ONE token follows it: "two milk" -> 2 x milk,
  // "twenty apples" -> 20 x apples. When MULTIPLE tokens follow, the leading
  // word could equally be part of the product name ("four cheese pizza",
  // "six pack beer"), so -- in the NEVER-GUESS spirit -- the line routes to
  // review rather than silently asserting a quantity and a truncated name
  // (which is what "four cheese pizza" -> 4 x "cheese pizza" would do).
  //
  // Scope is deliberately narrow:
  //   * DIGIT forms are EXEMPT ("4 cheese pizza" stays 4 x "cheese pizza"): a
  //     typed digit is a far stronger quantity signal than a spelled word, so
  //     the current digit behaviour is preserved unchanged.
  //   * SINGLE-token spelled forms pass through here and are resolved by the
  //     normal extractor, so legit quantities ("two milk", "three eggs") are
  //     untouched. The curated WORD_NUMBER_COLLISIONS list above still handles
  //     the single-token product collisions ("seven up", "five spice").
  const leadToks = collapseWs(paren.stripped).split(' ').filter(function (x) { return x !== ''; });
  if (leadToks.length > 2 &&
      Object.prototype.hasOwnProperty.call(WORD_NUMBERS, leadToks[0].toLowerCase())) {
    return {
      kind: 'review',
      reason: 'ambiguous word-number vs item name: ' + normaliseItemName(paren.stripped)
    };
  }

  const quant = extractQuantities(paren.stripped);

  const allQtys = paren.qtys.concat(quant.qtys);
  const distinct = distinctNumbers(allQtys);
  const item_name = normaliseItemName(quant.rest);
  const note = paren.note;

  // Conflicting explicit quantities are ambiguous -> never guessed.
  if (distinct.length > 1) {
    return { kind: 'review', reason: 'conflicting quantities: ' + distinct.join(' vs ') };
  }
  // A single explicit non-positive quantity ("0 milk") is ambiguous.
  if (distinct.length === 1 && distinct[0] < 1) {
    return { kind: 'review', reason: 'non-positive quantity: ' + distinct[0] };
  }
  // A single explicit quantity above the household sanity cap (or one that
  // has overflowed integer precision) is implausible -> review. Symmetric
  // with the non-positive guard above; keeps "999999999999999999999 milk"
  // out of the item list instead of asserting a nonsense 1e21 request.
  if (distinct.length === 1 && distinct[0] > MAX_QTY) {
    return { kind: 'review', reason: 'implausible quantity: ' + distinct[0] };
  }
  // Malformed numeric-looking residue guard. After the clean quantity forms
  // have been consumed, if the LEADING or TRAILING token of the residual item
  // text still looks like a quantity but is not a clean supported form
  // (signed "+2"/"-2", decimal "1.5"/"2.", or a non-ASCII/unicode digit like
  // "\uFF12"/"\u0662"), the line is ambiguous -> review. It is NEVER silently defaulted
  // to qty 1. Checked on the raw residual (pre-lowercase) tokens.
  const restToks = collapseWs(quant.rest).split(' ').filter(function (x) { return x !== ''; });
  if (restToks.length > 0) {
    const leadTok = restToks[0];
    const tailTok = restToks[restToks.length - 1];
    if (isMalformedNumericToken(leadTok)) {
      return { kind: 'review', reason: 'malformed quantity syntax: ' + leadTok };
    }
    if (isMalformedNumericToken(tailTok)) {
      return { kind: 'review', reason: 'malformed quantity syntax: ' + tailTok };
    }
  }
  // A quantity (or nothing) but no item text ("x2", "(2)", "5") -> review.
  if (!hasLetter(item_name)) {
    return { kind: 'review', reason: 'no item text' };
  }

  const requested_qty = distinct.length === 1 ? distinct[0] : 1;
  return { kind: 'item', item_name: item_name, requested_qty: requested_qty, note: note };
}

// ---------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------
function normaliseRawList(text) {
  const items = [];
  const needs_review = [];

  const source = text === null || text === undefined ? '' : String(text);
  const lines = source.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();
    if (trimmed === '') continue;             // truly blank line -> skipped, never reviewed

    const core = stripPrefix(trimmed).trim();
    if (core === '') {
      // A non-blank line that reduces to only a marker/ordinal ("-", "*",
      // "5.", "2)") is surfaced, NEVER silently dropped.
      needs_review.push({ raw: trimmed, reason: 'marker-only line' });
      continue;
    }

    // A numbered-list marker ("1. ", "2. ", "3) ") is a LIST MARKER, not a
    // quantity: stripPrefix has already removed it, so the residual item text
    // parses normally and defaults to qty 1 (unless it carries its own quantity
    // form). This is what makes a real numbered list ("1. jam\n2. bread\n3. milk")
    // parse as three ordinary items at qty 1 rather than sending items 2 and 3
    // to review. A marker whose line has NO item text after stripping ("5.",
    // "2)", "-") is caught by the `core === ''` marker-only branch above and
    // surfaced to needs_review; it is never dropped.
    const parsed = parseLine(core);
    if (parsed.kind === 'item') {
      items.push({
        item_name: parsed.item_name,
        requested_qty: parsed.requested_qty,
        note: parsed.note
      });
    } else {
      needs_review.push({ raw: trimmed, reason: parsed.reason });
    }
  }

  return { items: items, needs_review: needs_review };
}

module.exports = {
  normaliseRawList: normaliseRawList,
  // exported for unit tests of the pure helpers
  _internal: {
    collapseWs: collapseWs,
    normaliseItemName: normaliseItemName,
    stripPrefix: stripPrefix,
    extractParentheticals: extractParentheticals,
    extractQuantities: extractQuantities,
    isMalformedNumericToken: isMalformedNumericToken,
    parseLine: parseLine,
    WORD_NUMBERS: WORD_NUMBERS
  }
};
