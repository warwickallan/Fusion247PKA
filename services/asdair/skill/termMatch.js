// =====================================================================
// BUILD-015 AsdAIr - WO-Y: termMatch.js
//
// THE ONE tolerant matcher. Pure, zero-dependency, deterministic.
//
// WHY THIS FILE EXISTS AT ALL
// ---------------------------
// On 2026-08-03 two independent EXACT-STRING gates stood between the
// household's recorded knowledge and the question queue:
//
//   * planner.js regularHits()  - alias match by string equality
//   * planner.js ruleAppliesToItem() - rule match_term by string equality
//
// and a third, LOOSER and differently-wrong one in
// interpret/resolveByCatalogue.js. Real, stored, correct knowledge did not
// fire, and Warwick answered questions he had already answered:
//
//   "2 yazoo choc"            vs stored alias "choc yazoo"      -> WORD ORDER
//   "Double Glouester cheese" vs stored alias "double gloucester" -> ONE LETTER
//
// Two matchers that are supposed to agree, written twice, are exactly how the
// defect got in. So there is now ONE implementation and both callers use it.
//
// THE GOVERNING ASYMMETRY - read this before changing any threshold
// ----------------------------------------------------------------
// A matcher that is too loose SILENTLY BUYS THE WRONG PRODUCT. A matcher that
// is too tight asks a question. Those costs are not comparable, so every rule
// below fails towards asking. Concretely there are TWO grades of match and
// they have DIFFERENT powers:
//
//   CONFIDENT ('exact' | 'token_set' | 'typo' | 'key_subset')
//       May establish IDENTITY: resolve a regular, apply a `map` directive,
//       apply an `exclude`, seed a rotation ring.
//
//   ADVISORY ('shared_distinctive')
//       May NOT establish identity and may NEVER name a product. It may only
//       (a) attach a rule's reason / a recorded prior answer to a line, and
//       (b) HOLD the line for a human. Holding is the safe direction: a wrong
//       advisory costs one question, never a wrong purchase.
//
// This is standing rule 6's "never auto-substitute" applied to matching
// itself: where confidence is marginal, we still ask.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// Match grades, strongest first. Exported so callers name a tier rather than
// hardcoding a string.
const TIER = Object.freeze({
  EXACT: 'exact',                          // identical after normalisation
  TOKEN_SET: 'token_set',                  // same words, different order
  TYPO: 'typo',                            // one word differs by one letter
  KEY_SUBSET: 'key_subset',                // every key word present (>=1 typo allowed)
  SHARED_DISTINCTIVE: 'shared_distinctive' // ADVISORY ONLY - a shared long word
});

// The CONFIDENT set. Anything not in here may never establish identity.
const CONFIDENT_TIERS = Object.freeze([TIER.EXACT, TIER.TOKEN_SET, TIER.TYPO, TIER.KEY_SUBSET]);

// ---------------------------------------------------------------------
// Thresholds. Every one of these is a deliberate refusal boundary, and each
// has a real counter-example pinned in termMatch.test.js. Loosening one
// without adding the counter-example is how this file regrows the defect.
// ---------------------------------------------------------------------

// Minimum length for BOTH tokens of a one-letter-typo pair.
//   6 admits "glouester"/"gloucester" (the real 2026-08-03 failure).
//   6 refuses "beans"/"beers" and "lemon"/"melon" - both distance-1-ish pairs
//   at length 5 that name completely different groceries.
const TYPO_MIN_LEN = 6;

// A typo pair must ALSO agree on its first two characters.
//   "glouester"/"gloucester" -> "gl" == "gl", admitted.
//   "butter"/"batter"        -> "bu" != "ba", refused. Both are length 6 and
//   one substitution apart, and confusing them empties a cake into a chip pan.
const TYPO_PREFIX_LEN = 2;

// A SINGLE-token key may only match by subset (key inside a longer line) when
// it is at least this long. "cream" (5) must not claim "ice cream"; the
// household's alias "gloucester" (10) legitimately claims
// "double gloucester cheese". A single-token key that is EXACTLY equal is
// tier EXACT and is unaffected by this.
const SUBSET_SINGLE_TOKEN_MIN_LEN = 6;

// A key must carry at least one token this long to be matchable by subset at
// all - it stops a key made entirely of filler words claiming a line.
const SUBSET_MIN_SIGNIFICANT_LEN = 4;

// ADVISORY tier: the shared token must be at least this long, and the shared
// tokens must cover at least this proportion of the key.
//   "bottle azera coffee" vs "Nescafe Azera" -> shares "azera" (5), covers
//   1 of 2 key tokens = 0.5 -> ADVISORY. This is the live rule-12 case.
//   The same line vs "Nescafe" shares NOTHING -> no match at all, which is
//   correct: rule 25 must not fire on it.
const ADVISORY_MIN_TOKEN_LEN = 5;
const ADVISORY_MIN_KEY_COVERAGE = 0.5;

// ---------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------

// Lower-case, replace anything that is not a letter/digit/& with a space,
// collapse whitespace, trim. Punctuation and spacing differences therefore
// cannot cause a miss ("yazoo-choc", "Yazoo  Choc", "yazoo, choc" all agree).
//
// This is DELIBERATELY WIDER than planner.js normaliseTerm(), which only
// lower-cases and collapses whitespace. planner.js keeps its own function for
// dedupe keys and exact equality (changing it would move data-shaped keys
// under downstream code); this one is used ONLY for MATCHING.
function normaliseMatchText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A leading count is a QUANTITY, not part of the product's name. Mum writes
// "2 yazoo choc" and "1 4pk orange lucozade"; the quantity is captured on its
// own column and must not pollute the match term.
//
// Behaviour is kept identical to interpret/resolveByCatalogue.js's original
// stripLeadingQuantity so adopting this module changes no interpretation.
// KNOWN LIMIT: a product whose real name STARTS with a bare number ("7 up")
// loses that number here. Reported, not fixed - it is pre-existing behaviour
// and inventing an exception list is exactly the kind of growth this build
// has been burned by.
function stripLeadingQuantity(value) {
  return normaliseMatchText(value)
    .replace(/^\d+\s*x\s*/, '')
    .replace(/^\d+\s*pk\s*/, '')
    .replace(/^\d+\s+/, '')
    .trim();
}

// Distinct tokens, order preserved.
function tokensOf(text) {
  const out = [];
  normaliseMatchText(text).split(' ').forEach(function (t) {
    if (t !== '' && out.indexOf(t) === -1) out.push(t);
  });
  return out;
}

// ---------------------------------------------------------------------
// Edit distance, answered as a QUESTION rather than computed as a number.
//
// "Is the distance exactly 1?" is decidable in one pass and cannot be
// accidentally reused as "is the distance small", which is how edit-distance
// matchers usually turn permissive.
// ---------------------------------------------------------------------
function isOneEditApart(a, b) {
  if (a === b) return false;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  const gap = long.length - short.length;
  if (gap > 1) return false;

  if (gap === 0) {
    // Substitution: exactly one position may differ.
    let diffs = 0;
    for (let i = 0; i < short.length; i++) {
      if (short[i] !== long[i]) {
        diffs += 1;
        if (diffs > 1) return false;
      }
    }
    return diffs === 1;
  }

  // Insertion: the shorter must be the longer with exactly one character removed.
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
    } else {
      if (skipped) return false;
      skipped = true;
      j += 1;
    }
  }
  return true;
}

// A one-letter typo pair, under BOTH guards: long enough, and agreeing on the
// first two characters. See TYPO_MIN_LEN / TYPO_PREFIX_LEN above for the
// counter-examples each guard exists to refuse.
function isTypoPair(a, b) {
  if (a.length < TYPO_MIN_LEN || b.length < TYPO_MIN_LEN) return false;
  if (a.slice(0, TYPO_PREFIX_LEN) !== b.slice(0, TYPO_PREFIX_LEN)) return false;
  return isOneEditApart(a, b);
}

// ---------------------------------------------------------------------
// matchTerms(lineText, keyText) -> { tier, confident, via }
//
// Asks: does the household's LINE (as written, possibly with a leading count
// and extra descriptive words) refer to the thing named by KEY (a stored
// alias, a regular's name, or a rule's match_term)?
//
// Returns tier null when it does not. `via` names the token pair a typo tier
// leant on, or the shared tokens an advisory tier leant on, so a caller can
// explain itself to a human instead of asserting a match with no reason.
// ---------------------------------------------------------------------
function matchTerms(lineText, keyText) {
  const none = { tier: null, confident: false, via: [] };

  const line = stripLeadingQuantity(lineText);
  const key = normaliseMatchText(keyText);
  if (line === '' || key === '') return none;

  if (line === key) return { tier: TIER.EXACT, confident: true, via: [] };

  const lineTokens = tokensOf(line);
  const keyTokens = tokensOf(key);
  if (lineTokens.length === 0 || keyTokens.length === 0) return none;

  const keyOnly = keyTokens.filter(function (t) { return lineTokens.indexOf(t) === -1; });
  const lineOnly = lineTokens.filter(function (t) { return keyTokens.indexOf(t) === -1; });

  // Same words, different order. "yazoo choc" == "choc yazoo".
  if (keyOnly.length === 0 && lineOnly.length === 0) {
    return { tier: TIER.TOKEN_SET, confident: true, via: [] };
  }

  // Same word count, exactly one word out, and that word is a one-letter typo.
  if (keyOnly.length === 1 && lineOnly.length === 1 && isTypoPair(keyOnly[0], lineOnly[0])) {
    return { tier: TIER.TYPO, confident: true, via: [lineOnly[0], keyOnly[0]] };
  }

  // Every key word is present in the line (extra line words allowed), with AT
  // MOST ONE of them matched by a typo. This is the real 2026-08-03 shape:
  // the household writes the alias plus a descriptive word, and misspells one.
  //   "double glouester cheese" covers key "double gloucester".
  const keySubset = coversKey(keyTokens, lineTokens);
  if (keySubset.covered) {
    const singleTokenKey = keyTokens.length === 1;
    const longEnoughSingle = singleTokenKey
      && keyTokens[0].length >= SUBSET_SINGLE_TOKEN_MIN_LEN;
    const hasSignificant = keyTokens.some(function (t) {
      return t.length >= SUBSET_MIN_SIGNIFICANT_LEN;
    });
    if (hasSignificant && (!singleTokenKey || longEnoughSingle)) {
      return { tier: TIER.KEY_SUBSET, confident: true, via: keySubset.via };
    }
  }

  // ADVISORY. A long word in common, covering at least half the key. This can
  // attach a reason and hold a line; it can never name a product.
  const shared = keyTokens.filter(function (t) { return lineTokens.indexOf(t) !== -1; });
  const longShared = shared.filter(function (t) { return t.length >= ADVISORY_MIN_TOKEN_LEN; });
  if (longShared.length > 0 && (shared.length / keyTokens.length) >= ADVISORY_MIN_KEY_COVERAGE) {
    return { tier: TIER.SHARED_DISTINCTIVE, confident: false, via: longShared };
  }

  return none;
}

// Is every key token present in the line, exactly or via AT MOST ONE typo?
// Each line token is consumed at most once, so two key words cannot both claim
// the same line word.
function coversKey(keyTokens, lineTokens) {
  const used = [];
  const via = [];
  let typosUsed = 0;

  for (let k = 0; k < keyTokens.length; k++) {
    const kt = keyTokens[k];
    if (lineTokens.indexOf(kt) !== -1 && used.indexOf(kt) === -1) {
      used.push(kt);
      continue;
    }
    let paired = null;
    for (let i = 0; i < lineTokens.length && paired === null; i++) {
      const lt = lineTokens[i];
      if (used.indexOf(lt) !== -1) continue;
      if (keyTokens.indexOf(lt) !== -1) continue; // reserved for its own exact match
      if (isTypoPair(kt, lt)) paired = lt;
    }
    if (paired === null || typosUsed >= 1) return { covered: false, via: [] };
    typosUsed += 1;
    used.push(paired);
    via.push(paired, kt);
  }
  return { covered: true, via: via };
}

// Convenience: does this line match this key WELL ENOUGH TO ESTABLISH IDENTITY?
function matchesConfidently(lineText, keyText) {
  return matchTerms(lineText, keyText).confident === true;
}

// The best match across several candidate keys (a regular's name plus every
// alias, say). Returns the strongest tier found.
function bestMatch(lineText, keyTexts) {
  const keys = Array.isArray(keyTexts) ? keyTexts : [keyTexts];
  let best = { tier: null, confident: false, via: [] };
  let bestRank = -1;
  keys.forEach(function (key) {
    const m = matchTerms(lineText, key);
    if (m.tier === null) return;
    const rank = rankOf(m.tier);
    if (rank > bestRank) {
      bestRank = rank;
      best = m;
    }
  });
  return best;
}

// Strongest tier = highest rank. SHARED_DISTINCTIVE is deliberately lowest.
function rankOf(tier) {
  const order = [
    TIER.SHARED_DISTINCTIVE,
    TIER.KEY_SUBSET,
    TIER.TYPO,
    TIER.TOKEN_SET,
    TIER.EXACT
  ];
  return order.indexOf(tier);
}

module.exports = {
  TIER: TIER,
  CONFIDENT_TIERS: CONFIDENT_TIERS,
  normaliseMatchText: normaliseMatchText,
  stripLeadingQuantity: stripLeadingQuantity,
  tokensOf: tokensOf,
  isOneEditApart: isOneEditApart,
  isTypoPair: isTypoPair,
  matchTerms: matchTerms,
  matchesConfidently: matchesConfidently,
  bestMatch: bestMatch,
  // exported so a test can assert the thresholds are what the comments claim,
  // pinned to a literal held OUTSIDE this file.
  THRESHOLDS: Object.freeze({
    TYPO_MIN_LEN: TYPO_MIN_LEN,
    TYPO_PREFIX_LEN: TYPO_PREFIX_LEN,
    SUBSET_SINGLE_TOKEN_MIN_LEN: SUBSET_SINGLE_TOKEN_MIN_LEN,
    SUBSET_MIN_SIGNIFICANT_LEN: SUBSET_MIN_SIGNIFICANT_LEN,
    ADVISORY_MIN_TOKEN_LEN: ADVISORY_MIN_TOKEN_LEN,
    ADVISORY_MIN_KEY_COVERAGE: ADVISORY_MIN_KEY_COVERAGE
  })
};
