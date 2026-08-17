// BUILD-015 AsdAIr Stage 1 - resolveByCatalogue.js
//
// THE AUTHORITY BOUNDARY, IN CODE:
//
//   the model      READS and RANKS   (raw_reading, candidate suggestions)
//   the catalogue  DETERMINES IDENTITY  <- this file
//   the human      RESOLVES genuine ambiguity
//   confirmed outcomes ENRICH ALIASES for next week
//
// The model never names a product. It supplies a raw reading; THIS module maps
// that reading onto a real `asdair.regulars.id`. Canonical names are looked up
// from our own catalogue by id, so a product that does not exist cannot appear
// in a basket no matter what a model says.
//
// PURE. No DB, no network, no clock, no randomness - the catalogue is passed in.
'use strict';

// WO-Y: normalisation and tolerant matching now come from ONE module, shared
// with skill/planner.js. They used to be written twice with DIFFERENT rules -
// the read path and the plan path disagreed about what "the same product"
// means, which is how a stored alias could satisfy one and not the other. The
// module is pure and zero-dependency, so requiring it keeps this file pure.
const termMatch = require('../skill/termMatch.js');
const { consultRules, extractRuleTriggers } = require('./ruleTriggers.js');

const normaliseTerm = termMatch.normaliseMatchText;
const stripLeadingQuantity = termMatch.stripLeadingQuantity;

const BASIS = Object.freeze({
  EXACT_ALIAS: 'exact alias',
  REGULAR: 'regular product',
  APPROX_ALIAS: 'approximate alias',
  BRAND_VARIANT: 'known brand + variant',
  PREVIOUS_ORDER: 'previous-order match',
  HOUSEHOLD_RULE: 'household rule',
  UNIQUE_NAME: 'unique catalogue name',
});

// ── THE CATEGORY THE HOUSEHOLD'S OWN ROWS ARE FILED UNDER (2026-08-17) ──────
//
// THE FAILURE THIS EXISTS FOR. Mum wrote "1 TRESemme hair CONDITIONER, blue
// label". Regular 105 is the SHAMPOO and carries the alias "tresemme blue
// label", so the alias fired at KEY_SUBSET strength and the conditioner became
// a second shampoo - while regular 17, the actual conditioner, sat unused. The
// word CONDITIONER was on the line the whole time, and the matcher never
// looked at it, because until now nothing in this file read `category` at all.
//
// No product taxonomy is invented here and none is hardcoded. The vocabulary is
// whatever the household's own `regulars.category` values happen to say, so it
// grows and shrinks with their catalogue and can never disagree with it.
function categoryTokensOf(regulars) {
  const all = new Set();
  for (const r of regulars) {
    for (const t of termMatch.tokensOf(r.category || '')) all.add(t);
  }
  return all;
}

/** Every word a regular answers to: its category, its name, and its aliases. */
function vocabularyOf(reg) {
  const words = new Set();
  for (const t of termMatch.tokensOf(reg.category || '')) words.add(t);
  for (const t of termMatch.tokensOf(reg.name || '')) words.add(t);
  for (const a of aliasesOf(reg)) for (const t of termMatch.tokensOf(a)) words.add(t);
  return words;
}

// The one lexical fact this file states out loud, because the household's rows
// say "Men S Spray Deodorant" while Mum writes "male". It NARROWS a candidate
// set and can never widen one, so the worst case is a question.
const GENDER_SYNONYMS = Object.freeze({
  male: 'men', males: 'men', mens: 'men', men: 'men', man: 'men',
  female: 'women', females: 'women', womens: 'women', women: 'women', woman: 'women',
});

function genderOf(tokens) {
  for (const t of tokens) {
    if (Object.prototype.hasOwnProperty.call(GENDER_SYNONYMS, t)) return GENDER_SYNONYMS[t];
  }
  return null;
}

function aliasesOf(reg) {
  return Array.isArray(reg.aka) ? reg.aka.filter(Boolean) : [];
}

// Does `haystack` contain every WHOLE WORD of `needle`? Word-boundary aware,
// unlike the raw substring test this replaces - see pass 3 below for why.
function tokensContain(haystack, needle) {
  const hay = termMatch.tokensOf(haystack);
  const need = termMatch.tokensOf(needle);
  if (need.length === 0) return false;
  return need.every((t) => hay.indexOf(t) !== -1);
}

// ── THE VISION-CONFIDENCE GATE (WP-B15-22, GATE ZERO) ──────────────────────
//
// groundedPrompt.js explicitly asks the model for a per-line `confidence`
// (0.0-1.0) and permits `status:"unreadable"` - and until this Work Package
// that signal was dropped on the floor between the model's reply and this
// module (deps.js `realInterpretPhoto` mapped only {line_no, raw_reading,
// quantity}), so a confident CATALOGUE match could reach a real basket on a
// line the MODEL ITSELF was unsure about. That is precisely SHOP-2026-08-10-
// M64's incident (Deliverables/2026-08-11-GATE-ZERO-source-truth-established.md):
// ~17 real items missing, 7 invented, because a large closed candidate list
// pressures the model into picking a plausible candidate rather than using
// the escape hatch the prompt itself offers.
//
// THE THRESHOLD, AND WHY IT IS 0.6. Below "plausible but uncertain" (0.5,
// a coin flip) and clearly below "the model is basically sure". A judgement
// call, not a derived constant - documented here rather than left silent.
const VISION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * PURE. Does this catalogue verdict survive the model's OWN confidence about
 * the reading it was derived from? A confident catalogue match on a line the
 * model itself flagged as unreadable, or scored below the threshold, is
 * exactly the failure mode this gate exists to close - REGARDLESS of how
 * strong the catalogue match looked, which is the whole point: catalogue
 * strength and reading confidence are independent signals, and either one
 * being weak is enough to hold a line for a human.
 *
 * A line carrying NO vision signal at all (`visionConfidence` and
 * `visionStatus` both `undefined` - a TYPED line, which was never read by a
 * vision model) is untouched: the gate answers "was the MODEL sure it read
 * this correctly", which has no meaning for text that was never read by a
 * model in the first place.
 *
 * A vision-graded line with a MISSING or non-numeric confidence is treated
 * as the WORST case (0), never defaulted to 1.0 - the model was asked for
 * this field and a caller that cannot supply it gets no benefit of the
 * doubt (Warwick, ruling on this Work Order: "a missing confidence on a
 * line should itself be treated as low-confidence, not as 1.0").
 *
 * @param {object} verdict           the catalogue-only resolveReading result
 * @param {{visionConfidence?: number|null, visionStatus?: string|null}} opts
 */
function applyVisionConfidenceGate(verdict, opts) {
  const graded = opts && (opts.visionConfidence !== undefined || opts.visionStatus !== undefined);
  if (!graded) return verdict;

  if (opts.visionStatus === 'unreadable') {
    return {
      matched_regular_id: null, matched_product_name: null, match_basis: null,
      alternatives: verdict.alternatives || [], status: 'unreadable',
    };
  }

  const confidence = Number.isFinite(Number(opts.visionConfidence)) ? Number(opts.visionConfidence) : 0;
  if (confidence < VISION_CONFIDENCE_THRESHOLD && verdict.status === 'matched') {
    // GENUINELY UNRESOLVED, NOT MERELY RELABELLED. A "needs_confirmation"
    // line must not still carry a matched identity - shop_line's own CHECK
    // only requires the reverse (a 'matched' row needs an id; it says nothing
    // about a held one), so this was NOT caught by the schema, only by a
    // dedicated proof. The catalogue's best guess is preserved as a single
    // candidate in `alternatives` rather than discarded outright - the same
    // shape a genuinely ambiguous match already uses elsewhere in this file,
    // so the human is asked "is it this?" rather than starting from nothing.
    const suggestion = verdict.matched_regular_id !== null && verdict.matched_regular_id !== undefined
      ? [{ id: verdict.matched_regular_id, name: verdict.matched_product_name }]
      : (verdict.alternatives || []);
    return {
      matched_regular_id: null,
      matched_product_name: null,
      match_basis: `${verdict.match_basis || 'catalogue match'} (held: model confidence ${confidence} below ${VISION_CONFIDENCE_THRESHOLD})`,
      alternatives: suggestion,
      status: 'needs_confirmation',
    };
  }
  return verdict;
}

/**
 * Resolve ONE raw reading against the household catalogue.
 *
 * Ordered strongest-evidence-first. Each pass must be UNAMBIGUOUS: if two
 * regulars answer equally well the line is handed to the human rather than
 * guessed, because two active regulars answering one term is precisely the
 * case that silently breaks a shop every week.
 *
 * THE RESULT THEN PASSES THROUGH `applyVisionConfidenceGate` (WP-B15-22)
 * before being returned - a confident catalogue match never overrides the
 * model's own uncertainty about the reading it came from. See that
 * function's doc comment for the full rule.
 *
 * @param {string} rawReading
 * @param {Array<object>} regulars - active regulars for the household
 * @param {{lastOrderNames?: string[], visionConfidence?: number|null,
 *          visionStatus?: string|null}} [opts]
 * @returns {{matched_regular_id: number|null, matched_product_name: string|null,
 *            match_basis: string|null, alternatives: Array<{id:number,name:string}>,
 *            status: string}}
 */
function resolveReading(rawReading, regulars, opts = {}) {
  return applyVisionConfidenceGate(resolveReadingByCatalogue(rawReading, regulars, opts), opts);
}

/**
 * PURE. Does the LINE name a product category that the candidate is not filed
 * under, while the household HAS rows filed under it?
 *
 * Returns the rival rows if so, and null when there is no contradiction. A word
 * the candidate already answers to - in its category, its name or one of its
 * aliases - is never a contradiction: "Lenor ... Fabric Conditioner 86 Washes"
 * legitimately answers "conditioner".
 */
function categoryContradiction(term, candidate, pool, catTokens) {
  const lineTokens = termMatch.tokensOf(term);
  const answers = vocabularyOf(candidate);
  for (const word of lineTokens) {
    if (!catTokens.has(word) || answers.has(word)) continue;
    // ── A RIVAL MUST ALSO BE ABOUT THIS LINE ────────────────────────────────
    // Otherwise a word that is a category HERE and an ordinary adjective on the
    // page raises a contradiction out of nothing: "1 Canderel RED label" was
    // held against "ASDA British Double Gloucester 400g", because the household
    // files a cheese under "Red Leicester Gloucester". The rival has to share
    // something distinctive with the line before its shelf label means anything.
    const rivals = pool.filter((r) => termMatch.tokensOf(r.category || '').indexOf(word) !== -1)
      .filter((r) => sharesDistinctiveToken(lineTokens, r, word, catTokens));
    if (rivals.length > 0) return { word, rivals };
  }
  return null;
}

/** PURE. Two words the household would treat as the same word. Used ONLY to
 *  narrow an existing candidate set - never to establish identity - so a plural
 *  that is really a different product costs a question and never a purchase. */
function sameWord(a, b) {
  return a === b || (a.length > 3 && b.length > 3 && (a === `${b}s` || b === `${a}s`));
}

/** PURE. Does this regular answer to a word on the line that is neither the
 *  category word in question nor a shelf label - i.e. a brand or product word? */
function sharesDistinctiveToken(lineTokens, reg, exceptWord, catTokens) {
  const words = vocabularyOf(reg);
  return lineTokens.some((t) => t !== exceptWord
    && t.length >= 4
    && !catTokens.has(t)
    && [...words].some((w) => sameWord(w, t)));
}

/** PURE. How many of the line's distinctive words does this regular answer to?
 *  The tie-break of last resort: "1 x 5pk Heinz SAUSAGE & beans" and three
 *  Heinz rows, only one of which is the sausage one. */
function distinctiveOverlap(lineTokens, reg, catTokens) {
  const words = vocabularyOf(reg);
  return lineTokens.filter((t) => t.length >= 4 && !catTokens.has(t)
    && [...words].some((w) => sameWord(w, t))).length;
}

/**
 * PURE. Narrow a candidate set by everything the LINE says that is not the
 * product's name: the category word, and the gender the household files its
 * deodorants under. Only ever removes candidates.
 */
function narrowByLineWords(term, candidates) {
  const lineTokens = termMatch.tokensOf(term);
  const gender = genderOf(lineTokens);
  if (!gender || candidates.length < 2) return candidates;
  const gendered = candidates.filter((r) => {
    const words = vocabularyOf(r);
    const other = gender === 'men' ? 'women' : 'men';
    return words.has(gender) && !words.has(other);
  });
  return gendered.length > 0 ? gendered : candidates;
}

/**
 * PURE. The numbers a line carries that are PACK SIZES rather than order
 * quantities, and which the household's own product names also carry.
 *
 * `stripLeadingQuantity` throws these away - correctly, for quantity - and that
 * loss is what made three lines unanswerable on 2026-08-17:
 *
 *   "6 ASDA large free range eggs"   32 is "ASDA Free Range 6 Large Eggs" and
 *                                    27 is "ASDA 12 Free Range Large Eggs".
 *                                    With the 6 gone the two are identical.
 *   "1 x 6pk Heinz baked beans"      63 is a single 200g tin; 79 and 108 are
 *                                    the six-packs. With the 6 gone all three
 *                                    tie, and the line was put to a human.
 *
 * Used ONLY to break a tie between rows that already matched. It can never
 * create a match, so a number that means something else costs nothing.
 */
function packNumbersOf(rawReading) {
  const text = termMatch.normaliseMatchText(rawReading);
  const out = [];
  const push = (n) => { if (Number.isFinite(n) && n > 1 && out.indexOf(n) === -1) out.push(n); };
  const packish = text.match(/\b(\d+)\s*(?:pk|pack|packs|pkt|pkts|x)\b/g) || [];
  for (const m of packish) push(Number(/\d+/.exec(m)[0]));
  const leading = /^(\d+)\b/.exec(text);
  if (leading) push(Number(leading[1]));
  return out;
}

/** PURE. Does this regular's own name carry one of the line's pack numbers? */
function carriesPackNumber(reg, packNumbers) {
  if (packNumbers.length === 0) return false;
  const nameNumbers = (termMatch.normaliseMatchText(reg.name).match(/\b\d+\b/g) || []).map(Number);
  return packNumbers.some((n) => nameNumbers.indexOf(n) !== -1);
}

/** The catalogue-only resolution, unchanged in every particular except its
 *  name - see `resolveReading` above for the gate now wrapped around it. */
function resolveReadingByCatalogue(rawReading, allRegulars, opts = {}) {
  const term = stripLeadingQuantity(rawReading);
  const none = { matched_regular_id: null, matched_product_name: null, match_basis: null, alternatives: [], status: 'unmatched_new_item' };
  if (!term) return { ...none, status: 'unreadable' };

  // ── THE HOUSEHOLD'S OWN RULES COME FIRST ─────────────────────────────────
  // Rule 50 says "Sure deodorant male: ALWAYS take regular 25. FIXED CHOICE -
  // do NOT rotate, do NOT offer variants, do NOT ask." Rule 11 says toffees
  // with no qualifier are the Dairy Toffee. Both were active on 2026-08-17,
  // both name a real row, and Warwick was asked about both anyway. An explicit
  // instruction from the household outranks anything this file can infer -
  // which is also why the category guard below does NOT second-guess it.
  const ruleVerdict = consultRules(rawReading, opts.ruleTriggers);
  const regulars = ruleVerdict.excluded.length
    ? allRegulars.filter((r) => ruleVerdict.excluded.indexOf(Number(r.id)) === -1)
    : allRegulars;

  if (ruleVerdict.identity) {
    const target = regulars.find((r) => Number(r.id) === ruleVerdict.identity.regular_id);
    if (target) {
      return {
        matched_regular_id: target.id,
        matched_product_name: target.name,
        match_basis: `${BASIS.HOUSEHOLD_RULE} ${ruleVerdict.identity.rule_id}`,
        alternatives: [],
        status: 'matched',
      };
    }
  }

  const catTokens = categoryTokensOf(regulars);

  // ── THE GUARD EVERY CATALOGUE-DERIVED MATCH PASSES THROUGH ───────────────
  // It can send a match three ways, and two of them are safe by construction:
  // redirect to the household's own row for the category the line names (only
  // when exactly one row answers), hold for a human with the rival rows on the
  // table, or let the match stand. It never invents and never widens.
  const guard = (r, basis) => {
    const clash = categoryContradiction(term, r, regulars, catTokens);
    if (!clash) return { matched_regular_id: r.id, matched_product_name: r.name, match_basis: basis, alternatives: [], status: 'matched' };

    // Which rival does the rest of the line actually point at? Every rival here
    // already shares a distinctive word with the line (see categoryContradiction),
    // so this narrows further on gender and takes the row only when ONE is left.
    const shared = narrowByLineWords(term, clash.rivals);
    if (shared.length === 1) {
      return {
        matched_regular_id: shared[0].id,
        matched_product_name: shared[0].name,
        match_basis: `${basis} (category-corrected: the line says "${clash.word}", which is ${shared[0].category || 'this row'}, not ${r.category || 'the first match'})`,
        alternatives: [],
        status: 'matched',
      };
    }
    return {
      matched_regular_id: null,
      matched_product_name: null,
      match_basis: `${basis} (held: the line says "${clash.word}" and ${r.name} is not)`,
      alternatives: (shared.length ? shared : clash.rivals).concat([r]).map((x) => ({ id: x.id, name: x.name })),
      status: 'needs_confirmation',
    };
  };

  // The pack the household wrote: taken from the model's own `pack_size` field
  // where it supplied one, and otherwise recovered from the reading itself. Both
  // routes only ever break a tie.
  const packNumbers = packNumbersOf(rawReading);
  if (Number.isInteger(opts.packSize) && opts.packSize > 1 && packNumbers.indexOf(opts.packSize) === -1) {
    packNumbers.push(opts.packSize);
  }

  const hit = (regs, basis) => {
    if (regs.length === 1) return guard(regs[0], basis);
    if (regs.length > 1) {
      // ── BREAK THE TIE ON WHAT THE LINE ACTUALLY SAYS, NOT ON A RANKING ────
      // Two narrowings, both of which can only ever REMOVE a candidate: the
      // pack size Mum wrote, and the category/gender words she wrote. If either
      // leaves exactly one row standing, the tie was never real - the evidence
      // to settle it was on the line and was being discarded. If they leave
      // several, the human is asked, exactly as before, with a SHORTER and more
      // honest list of candidates.
      let narrowed = regs;
      const byPack = narrowed.filter((r) => carriesPackNumber(r, packNumbers));
      if (byPack.length > 0 && byPack.length < narrowed.length) narrowed = byPack;
      narrowed = narrowByLineWords(term, narrowed);

      // The distinctive words Mum wrote that only some candidates answer to.
      const lineTokens = termMatch.tokensOf(term);
      const best = Math.max(...narrowed.map((r) => distinctiveOverlap(lineTokens, r, catTokens)));
      const byWords = narrowed.filter((r) => distinctiveOverlap(lineTokens, r, catTokens) === best);
      if (byWords.length > 0 && byWords.length < narrowed.length) narrowed = byWords;

      if (narrowed.length === 1) {
        return guard(narrowed[0], `${basis} (narrowed by the pack size and wording on the line)`);
      }
      return {
        matched_regular_id: null,
        matched_product_name: null,
        match_basis: basis,
        alternatives: narrowed.map((r) => ({ id: r.id, name: r.name })),
        status: 'needs_confirmation',
      };
    }
    return null;
  };

  // Passes 1 and 2 compare on the SEPARATOR-BLIND form (WP-B15-13), so
  // "VANISH PRETREAT GEL" is recognised as the regular "Vanish Pre-Treat Gel"
  // HERE, at its true strength, instead of falling through to pass 2b and
  // being recorded as an "approximate alias". A punctuation-only difference is
  // the canonical name, and match_basis is a durable record that reviewers and
  // future sessions read. The letters and digits must still agree exactly and
  // in order - see skill/termMatch.js squashMatchText().
  const squashedTerm = termMatch.squashMatchText(term);

  // 1. Exact alias - the household's own shorthand. Strongest signal there is.
  let out = hit(regulars.filter((r) => aliasesOf(r).some((a) => termMatch.squashMatchText(a) === squashedTerm)), BASIS.EXACT_ALIAS);
  if (out) return out;

  // 2. Exact canonical name.
  out = hit(regulars.filter((r) => termMatch.squashMatchText(r.name) === squashedTerm), BASIS.REGULAR);
  if (out) return out;

  // 2b. TOLERANT alias match (WO-Y). Word order and one-letter spelling only,
  //     via the shared matcher, and CONFIDENT tiers only. This is what makes
  //     "2 yazoo choc" reach the stored alias "choc yazoo", and
  //     "Double Glouester cheese" reach "double gloucester" - both real
  //     2026-08-03 failures against real stored aliases.
  out = hit(
    regulars.filter((r) => termMatch.bestMatch(rawReading, [r.name].concat(aliasesOf(r))).confident),
    BASIS.APPROX_ALIAS,
  );
  if (out) return out;

  // 3. Alias contained in the line, or the line inside an alias
  //    ("1 dreamies cheese large" vs alias "dreamies cheese").
  //
  //    WO-Y CORRECTION - REPORTED, and fixed because it is the same defect
  //    class this Work Order exists to close. This pass used raw SUBSTRING
  //    containment (`term.includes(na) || na.includes(term)`), which matches
  //    ACROSS WORD BOUNDARIES: a line reading "bread" resolved against an
  //    alias "shortbread", and "cream" against "ice cream". That is the
  //    silently-buys-the-wrong-product failure, and adding tolerance elsewhere
  //    while leaving it would have been indefensible. Containment is now
  //    TOKEN-WISE: every word of one side must appear as a whole word in the
  //    other. "dreamies cheese" still matches "1 dreamies cheese large";
  //    "bread" no longer matches "shortbread".
  out = hit(
    regulars.filter((r) => aliasesOf(r).some((a) => {
      const na = normaliseTerm(a);
      return na.length >= 4 && (tokensContain(term, na) || tokensContain(na, term));
    })),
    BASIS.APPROX_ALIAS,
  );
  if (out) return out;

  // 4. Strong word overlap with the canonical name (brand + variant).
  //    Requires >= 2 shared significant words, and a single clear winner.
  const words = new Set(term.split(' ').filter((w) => w.length > 3));
  const scored = regulars
    .map((r) => {
      const nw = normaliseTerm(r.name).split(' ').filter((w) => w.length > 3);
      const overlap = nw.filter((w) => words.has(w)).length;
      return { r, overlap, score: overlap / Math.max(1, Math.min(words.size, nw.length)) };
    })
    .filter((s) => s.overlap >= 2)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap);

  if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) {
    return guard(scored[0].r, BASIS.BRAND_VARIANT);
  }
  if (scored.length > 1) {
    return hit(scored.map((s) => s.r), BASIS.BRAND_VARIANT);
  }

  // 5. A DISTINCTIVE WORD THAT NAMES EXACTLY ONE ROW IN THE WHOLE CATALOGUE.
  //
  //    "1 Sweetex" went unresolved on 2026-08-17 and became a question, while
  //    "Sweetex Calorie Free Sweeteners 600 Tablets" sat in the household's
  //    regulars - because pass 4 needs TWO shared words and Mum wrote one. A
  //    single word is weak evidence in general and decisive in the one case
  //    that matters: when no other product in this household answers to it.
  //
  //    Every guard here is about uniqueness rather than similarity, so it
  //    cannot be loosened by tuning a number: the word must be long, it must
  //    not be a category word (that describes a shelf, not a product), it must
  //    appear in EXACTLY ONE row, and - the guard that keeps it honest - it
  //    must be that row's BRAND. Two rows sharing it is a question.
  //
  //    THE COUNTER-EXAMPLE THAT SHAPED THE BRAND GUARD, and it is pinned in
  //    tolerantResolve.test.js rather than described here: "BATCHLORS MAC N
  //    CHEESE" shares exactly one long word with "Batchelors Pasta 'n' Sauce
  //    Mac 'n' Cheese" - the word CHEESE - and that line must stay unmatched.
  //    Uniqueness alone would have credited a separator rule with fixing a
  //    misspelling. A brand name is a proprietary word; "cheese" is food.
  const distinctive = termMatch.tokensOf(term)
    .filter((w) => w.length >= 6 && !catTokens.has(w) && !/^\d+$/.test(w));
  for (const word of distinctive) {
    const owners = regulars.filter((r) => vocabularyOf(r).has(word));
    if (owners.length !== 1) continue;
    if (termMatch.tokensOf(owners[0].brand || '').indexOf(word) === -1) continue;
    return guard(owners[0], `${BASIS.UNIQUE_NAME} ("${word}")`);
  }

  // ── NOTHING FITS. SAY SO - BUT NEVER HAND A HUMAN AN EMPTY QUESTION ───────
  //
  // The identity is still null: no least-bad catalogue item is ever returned,
  // and `unmatched_new_item` still means what it has always meant. What changes
  // is that the line no longer arrives at the question board with NOTHING
  // attached, which is how Warwick came to be offered cat food for wet wipes
  // and bananas for toffees - the board had no candidates from this module, so
  // it filled the space from somewhere else.
  //
  // These are ADVISORY, in the shared matcher's exact sense: they may be shown
  // to a human and may never establish identity. Where even advisory evidence
  // is absent the list is empty, and an empty list is the honest answer to
  // "which of your products is this?" when the answer is "none of them".
  const advisory = regulars
    .map((r) => ({ r, m: termMatch.bestMatch(rawReading, [r.name].concat(aliasesOf(r))) }))
    .filter((x) => x.m.tier !== null)
    .slice(0, 4)
    .map((x) => ({ id: x.r.id, name: x.r.name }));

  return { ...none, alternatives: advisory };
}

/**
 * Resolve a whole interpreted list. Marks a repeat of an already-resolved
 * regular as possible_duplicate rather than silently ordering it twice.
 *
 * ── PER-LINE VISION SIGNAL, NEVER SHARED ACROSS THE BATCH (WP-B15-22) ──────
 * `opts` may carry `lastOrderNames` (batch-wide, unchanged), but
 * `visionConfidence`/`visionStatus` are read OFF EACH LINE, never off `opts`
 * itself - confidence is a property of one reading, not of the whole list,
 * and sharing it would gate every line by whichever line happened to be
 * least sure. A line that never carried the key at all (a typed line) passes
 * `undefined` through untouched, which `applyVisionConfidenceGate` reads as
 * "not vision-graded" and leaves alone.
 *
 * The RAW confidence (never the gated verdict) is also attached to the
 * output as `match_confidence` - the column `shop_line.match_confidence`
 * already has and nothing previously populated - so the signal is durable
 * even when the gate did not need to fire.
 */
function resolveAll(lines, regulars, opts = {}) {
  const seen = new Set();
  // Read the household's rulebook ONCE for the whole list rather than per line.
  // `rules` is what loadCatalogue already returns, so the caller passes the
  // catalogue it already has; a caller that passes none behaves exactly as it
  // did before this existed.
  const ruleTriggers = opts.ruleTriggers
    || (opts.rules ? extractRuleTriggers(opts.rules, regulars) : []);
  return lines.map((l, i) => {
    const lineOpts = {
      ...opts,
      ruleTriggers,
      packSize: l && Number.isInteger(l.pack_size) ? l.pack_size : undefined,
      visionConfidence: l && Object.prototype.hasOwnProperty.call(l, 'vision_confidence') ? l.vision_confidence : undefined,
      visionStatus: l && Object.prototype.hasOwnProperty.call(l, 'vision_status') ? l.vision_status : undefined,
    };
    const r = resolveReading(l.raw_reading, regulars, lineOpts);
    if (r.matched_regular_id != null) {
      if (seen.has(r.matched_regular_id)) r.status = 'possible_duplicate';
      seen.add(r.matched_regular_id);
    }
    const match_confidence = lineOpts.visionConfidence === undefined
      ? null
      : (Number.isFinite(Number(lineOpts.visionConfidence)) ? Number(lineOpts.visionConfidence) : null);
    return {
      line_no: l.line_no ?? i + 1, raw_reading: l.raw_reading, quantity: l.quantity ?? null,
      match_confidence, ...r,
    };
  });
}

module.exports = {
  resolveReading, resolveAll, normaliseTerm, stripLeadingQuantity, BASIS,
  categoryContradiction, packNumbersOf, carriesPackNumber, narrowByLineWords,
  VISION_CONFIDENCE_THRESHOLD, applyVisionConfidenceGate,
};
