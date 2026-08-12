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

const normaliseTerm = termMatch.normaliseMatchText;
const stripLeadingQuantity = termMatch.stripLeadingQuantity;

const BASIS = Object.freeze({
  EXACT_ALIAS: 'exact alias',
  REGULAR: 'regular product',
  APPROX_ALIAS: 'approximate alias',
  BRAND_VARIANT: 'known brand + variant',
  PREVIOUS_ORDER: 'previous-order match',
});

function aliasesOf(reg) {
  return Array.isArray(reg.aka) ? reg.aka.filter(Boolean) : [];
}

// ── AC3 (WO-2026-08-12-B15-VISION-02) - THE SIZE/IDENTITY GUARD ────────────
//
// The diagnostic run's real wrong-milk confusion: "1 pkt ASDA semi skimmed
// milk 6 pints" resolved against "Cravendale Arla Filtered Fresh Semi
// Skimmed Milk 2L Fresher for Longer" - a DIFFERENT product at a DIFFERENT
// size. Traced to its ROOT CAUSE (Amendment 4, point 8, and this order's
// own instruction: fix it HERE, never by touching the vision prompt or
// enlarging a crop): pass 3 below matches on ANY alias that token-contains
// the reading, and the Cravendale regular's own alias list includes the
// bare word "milk" - which token-contains EVERY milk reading regardless of
// size, hijacking resolution before the more size-aware word-overlap pass
// (4) ever gets a turn. A household's pack size/volume is part of a
// regular's IDENTITY, not incidental wording, so this guard runs BEFORE
// every pass below, not just pass 4: when the reading carries an explicit
// size/volume/count marker, any candidate whose OWN recorded size markers
// (its name AND every alias) actively DISAGREE is excluded from the whole
// candidate pool for this reading - it can never again be the sole
// confident match, via any pass.
//
// LENIENT BY DESIGN, matching this codebase's own real, messy household
// data: regular id 4 in the live catalogue is literally named "...2L..."
// but carries the alias "arla 4pt milk" for the SAME physical product (2L
// is colloquially "about 4 pints" to this household) - a candidate is only
// EXCLUDED when it has AT LEAST ONE recorded size marker and NONE of them
// agree with the reading's; a candidate with NO recorded size information
// anywhere is never excluded by this guard, because absence of a size claim
// is not a claim it disagrees.
//
// DELIBERATELY VOLUME/WEIGHT UNITS ONLY - "pk"/"pack"/"packs" is EXCLUDED
// even though it looks size-shaped: "1 pk small Mars bars" uses "pk" as a
// PURCHASE-COUNT marker (buy one multipack), not a claim about the
// product's own physical size, and the live catalogue's own "Mars Caramel
// Multipack... 8 x 34.5g" carries a real weight token that would otherwise
// wrongly exclude the correct match. Pack-count is AC1's concern
// (photoSanityChecks.js), not this identity guard's.
const SIZE_TOKEN_RE = /(\d+(?:\.\d+)?)\s*(l|litre|litres|ltr|ml|millilitre|millilitres|pt|pts|pint|pints|kg|kilogram|kilograms|g|gram|grams)\b/i;

const SIZE_UNIT_ALIASES = Object.freeze({
  litre: 'l', litres: 'l', ltr: 'l',
  millilitre: 'ml', millilitres: 'ml',
  pts: 'pt', pint: 'pt', pints: 'pt',
  kilogram: 'kg', kilograms: 'kg',
  gram: 'g', grams: 'g',
});

/** The one size/volume/count token found in `text`, normalised, or null. PURE. */
function sizeToken(text) {
  const m = String(text || '').toLowerCase().match(SIZE_TOKEN_RE);
  if (!m) return null;
  const unit = SIZE_UNIT_ALIASES[m[2]] || m[2];
  return `${Number(m[1])}${unit}`;
}

/** Every DISTINCT size token recorded anywhere on a regular - its name and every alias. */
function regularSizeTokens(reg) {
  const tokens = [];
  const nameSize = sizeToken(reg.name);
  if (nameSize !== null) tokens.push(nameSize);
  aliasesOf(reg).forEach((a) => {
    const s = sizeToken(a);
    if (s !== null && tokens.indexOf(s) === -1) tokens.push(s);
  });
  return tokens;
}

/**
 * Is `reg` compatible with the reading's size claim? True when the reading
 * carries no size claim at all, OR the regular carries no recorded size
 * information at all, OR at least ONE of the regular's recorded size tokens
 * agrees with the reading's. False only when the regular has recorded size
 * information and NONE of it agrees - the only case this guard excludes.
 */
function sizeCompatible(termSizeToken, reg) {
  if (termSizeToken === null) return true;
  const candTokens = regularSizeTokens(reg);
  if (candTokens.length === 0) return true;
  return candTokens.indexOf(termSizeToken) !== -1;
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

/** The catalogue-only resolution, unchanged in every particular except its
 *  name - see `resolveReading` above for the gate now wrapped around it. */
function resolveReadingByCatalogue(rawReading, regulars, opts = {}) {
  const term = stripLeadingQuantity(rawReading);
  const none = { matched_regular_id: null, matched_product_name: null, match_basis: null, alternatives: [], status: 'unmatched_new_item' };
  if (!term) return { ...none, status: 'unreadable' };

  // AC3 SIZE/IDENTITY GUARD - applied ONCE, before every pass below, so a
  // size-mismatched candidate can never win via ANY pass (see the guard's
  // own header comment above `sizeToken` for the real bug this closes:
  // pass 3's generic "milk" alias used to hijack resolution before pass 4's
  // word-overlap scoring ever ran).
  const termSizeToken = sizeToken(rawReading);
  const candidates = termSizeToken === null
    ? regulars
    : regulars.filter((r) => sizeCompatible(termSizeToken, r));

  const hit = (regs, basis) => {
    if (regs.length === 1) {
      const r = regs[0];
      return { matched_regular_id: r.id, matched_product_name: r.name, match_basis: basis, alternatives: [], status: 'matched' };
    }
    if (regs.length > 1) {
      return {
        matched_regular_id: null,
        matched_product_name: null,
        match_basis: basis,
        alternatives: regs.map((r) => ({ id: r.id, name: r.name })),
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
  let out = hit(candidates.filter((r) => aliasesOf(r).some((a) => termMatch.squashMatchText(a) === squashedTerm)), BASIS.EXACT_ALIAS);
  if (out) return out;

  // 2. Exact canonical name.
  out = hit(candidates.filter((r) => termMatch.squashMatchText(r.name) === squashedTerm), BASIS.REGULAR);
  if (out) return out;

  // 2b. TOLERANT alias match (WO-Y). Word order and one-letter spelling only,
  //     via the shared matcher, and CONFIDENT tiers only. This is what makes
  //     "2 yazoo choc" reach the stored alias "choc yazoo", and
  //     "Double Glouester cheese" reach "double gloucester" - both real
  //     2026-08-03 failures against real stored aliases.
  out = hit(
    candidates.filter((r) => termMatch.bestMatch(rawReading, [r.name].concat(aliasesOf(r))).confident),
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
    candidates.filter((r) => aliasesOf(r).some((a) => {
      const na = normaliseTerm(a);
      return na.length >= 4 && (tokensContain(term, na) || tokensContain(na, term));
    })),
    BASIS.APPROX_ALIAS,
  );
  if (out) return out;

  // 4. Strong word overlap with the canonical name (brand + variant).
  //    Requires >= 2 shared significant words, and a single clear winner.
  //
  //    ── AC3 (WO-2026-08-12-B15-VISION-06) - THE PASS-4 BRAND-ANCHOR GUARD ──
  //
  //    THE BUG THIS CLOSES, reproduced from round 5's live re-test: with the
  //    real "Febreze Fabric Freshener Spray Lenor Spring Awakening" product
  //    not (yet) a recorded regular, the raw reading "FEBREZE FABRIC SPRAY
  //    LENOR" matched the UNRELATED Lenor Outdoorable conditioner via THIS
  //    pass - "lenor" and "fabric" are 2 shared significant words, clearing
  //    the >= 2 threshold, even though NEITHER is the reading's own real
  //    identity: the reading's distinguishing word is "febreze" (its actual
  //    brand), present nowhere in the Lenor regular's own name or aliases.
  //    "lenor" here is a co-branded SCENT name Febreze's own real product
  //    genuinely carries too, and "fabric" is a bare category word - neither
  //    is evidence THIS candidate is the one being described.
  //
  //    This pass is already documented as "brand + variant" evidence; the
  //    guard below makes that presupposition an ENFORCED fact instead of an
  //    implicit hope: a candidate is only ELIGIBLE for this pass's scoring
  //    when the READING's own first significant word (length > 3, the same
  //    "significant" bar this pass already uses) appears somewhere in that
  //    candidate's own name or alias list. A reading whose first word is too
  //    short to judge (<=3 chars) gets no guard at all - absence of a usable
  //    lead word is not evidence of a mismatch, the same "absence is not a
  //    claim it disagrees" principle the SIZE guard above already applies.
  //
  //    Passes 1-3 are UNTOUCHED: an exact alias/name (1-2) stays "the
  //    household's own shorthand - strongest signal there is", and the
  //    tolerant alias/subset passes (2b, 3) already run their own real
  //    token-level evidence checks; only this pass's generic overlap gets a
  //    brand anchor.
  const readingLeadWord = (() => {
    const parts = term.split(' ').filter((w) => w.length > 3);
    return parts.length > 0 ? parts[0] : null;
  })();
  const candidateOwnWords = (reg) => {
    const set = new Set(normaliseTerm(reg.name).split(' '));
    aliasesOf(reg).forEach((a) => normaliseTerm(a).split(' ').forEach((w) => set.add(w)));
    return set;
  };
  const brandEligible = readingLeadWord === null
    ? candidates
    : candidates.filter((r) => candidateOwnWords(r).has(readingLeadWord));

  const words = new Set(term.split(' ').filter((w) => w.length > 3));
  const scored = brandEligible
    .map((r) => {
      const nw = normaliseTerm(r.name).split(' ').filter((w) => w.length > 3);
      const overlap = nw.filter((w) => words.has(w)).length;
      return { r, overlap, score: overlap / Math.max(1, Math.min(words.size, nw.length)) };
    })
    .filter((s) => s.overlap >= 2)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap);

  if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) {
    const r = scored[0].r;
    return { matched_regular_id: r.id, matched_product_name: r.name, match_basis: BASIS.BRAND_VARIANT, alternatives: [], status: 'matched' };
  }
  if (scored.length > 1) {
    return {
      matched_regular_id: null, matched_product_name: null, match_basis: BASIS.BRAND_VARIANT,
      alternatives: scored.slice(0, 4).map((s) => ({ id: s.r.id, name: s.r.name })),
      status: 'needs_confirmation',
    };
  }

  // Nothing genuinely fits. Say so - never return the least-bad catalogue item
  // just because the output schema has a field for one.
  return none;
}

// ── AC3 (WO-2026-08-12-B15-VISION-03) - THE AUTHORITATIVE DUPLICATE COLLAPSE ──
//
// THE BUG THIS CLOSES, traced by reading the actual materialisation path
// (runPipeline.js buildGroundedIntents): every interpreted line becomes a
// real `add_list_item` intent UNCONDITIONALLY - there is no status this
// function could set that buildGroundedIntents itself would skip. The OLD
// behaviour here only ever set `status = 'possible_duplicate'` on a repeat,
// which is a label NOTHING downstream ever acted on - a genuine duplicate
// (the round-3 live re-test's real Febreze pair: two raw readings both
// correctly resolving to the SAME real catalogue product) therefore reached
// the basket as TWO separate lines. This is the SAME defect SHAPE
// photoSanityChecks.resolveCrossStripDuplicates already fixed for the
// Vanish case (WO-2026-08-12-B15-VISION-02, AC4) - "generalise the
// duplicate-collapsing mechanism" (AC3) means giving THIS layer, which runs
// on the AUTHORITATIVE catalogue identity rather than the model's own
// unreliable self-claim, the same real teeth: `runPipeline.js`'s single
// call site now SKIPS a line whose status is `excluded` before building any
// intent - see that file's own comment on the change.
//
// THE KEY, matching photoSanityChecks.duplicateKey's own already-tested
// semantics exactly: (matched_regular_id, quantity). Two reads of the SAME
// real product at the SAME quantity are the same physical purchase read
// twice; two reads of the SAME product at DIFFERENT quantities are the
// design doc's own protected case ("two real milk lines at different
// quantities must NOT collapse") and are left completely unflagged, never
// merely relabelled - matching what a genuinely separate purchase deserves.
//
// `excluded` (never `possible_duplicate`) is what a true duplicate now
// receives - a value shopLines.LINE_STATUSES has carried since migration
// 008 and this estate already treats elsewhere (runPipeline.js's own
// standing-rule exclusions, applyDecisions.js, planner.js) as "durably kept
// on record, never a real basket line". The row is NEVER dropped from this
// array - matching this whole codebase's insert-only, audit-trail
// discipline (see lineProvenance.js's own header) - only its status
// changes, so shop_line still carries a full, honest account of every
// reading the model produced.
function duplicateKey(matchedRegularId, quantity) {
  return String(matchedRegularId) + '|' + String(quantity ?? null);
}

// ── AC1 (WO-2026-08-12-B15-VISION-04, AMENDMENT 1) - A COLLISION IS ONLY
//    AUTHORITATIVE WHEN THERE IS REAL EVIDENCE IT IS THE SAME PHYSICAL LINE ──
//
// THE BUG THIS CLOSES: the collapse below (AC3, WO-...-VISION-03) trusted
// `matched_regular_id` as ground truth for EVERY collision. The round-3 live
// re-test proved that trust misplaced: two genuinely different real
// products - Lenor Outdoorable Spring Awakening and Febreze Fabric Freshener
// Spring Awakening - both resolved to the SAME regular id, and the
// "authoritative" collapse silently deleted the real Febreze line from the
// basket. A shared `matched_regular_id` is evidence of a misidentification
// exactly as often as it is evidence of a genuine repeat - the collapse
// needed a SECOND, independent signal before either line could be trusted
// over the other.
//
// THE EVIDENCE, exactly as Larry's Amendment 1 states it: two readings from
// the SAME source_region are near-certainly the same physical handwriting
// read twice (a strip re-scanned, an OCR echo) - that is real supporting
// evidence. Two readings from DIFFERENT source_regions sharing an id have NO
// such evidence: the shared id is exactly as likely to be a
// misidentification as a genuine duplicate, and nothing about which reading
// the model happened to emit FIRST says otherwise - trusting array/
// processing order as though it were correctness is precisely the mistake
// Amendment 1 corrected ("an accident of region-processing order").
//
// THE RULE: a colliding group where every KNOWN source_region agrees (or no
// member carries region evidence at all - see regionsAgree below) keeps
// ONE-SURVIVOR auto-collapse exactly as AC3 already proved correct (AC4):
// the first stays whatever it resolved to, every later member of the group
// is `excluded`. A colliding group with genuine evidence of DISAGREEING
// regions - at least two members whose source_region values are both known
// and different - has NO survivor: EVERY member of that group demotes to
// `needs_confirmation`, never merely the second (or the first) one, so the
// pipeline never silently DROPS one real reading (the old `excluded` bug)
// and never silently KEEPS one as sole authoritative on nothing more than
// emission order (the bug Amendment 1 corrected in this Work Order's own
// read-back). This generalises past exactly two colliding lines: ANY
// disagreement anywhere in the group removes the whole group's survivor,
// because a single confirmed cross-region pair is already proof the id
// cannot be trusted as ground truth for this group.
//
// A demoted line's matched_regular_id/matched_product_name are nulled and
// the collided candidate is carried into `alternatives` - the exact shape
// `applyVisionConfidenceGate`'s own needs_confirmation branch already uses
// above - so `runPipeline.js`'s buildGroundedIntents materialises it as a
// real `needs_decision` list row (a human decision), never a silent drop and
// never a silent keep.
function regionsAgree(regions) {
  const known = (Array.isArray(regions) ? regions : [])
    .filter((r) => r !== null && r !== undefined);
  // Fewer than two KNOWN regions is no evidence of disagreement - the same
  // "absence of a claim is not a claim it disagrees" guard this file already
  // applies in sizeCompatible above. This is also what keeps every existing
  // same-region/no-region test (AC3's chips and Febreze-alias cases, neither
  // of which carries a source_region at all) auto-collapsing exactly as
  // before (AC4).
  if (known.length < 2) return true;
  return known.every((r) => r === known[0]);
}

/**
 * Resolve a whole interpreted list. Two phases:
 *
 *   1. Resolve every reading independently (unchanged from before this
 *      Work Order) and note which lines share a (matched_regular_id,
 *      quantity) key - the SAME real catalogue product at the SAME
 *      quantity as an earlier line in this batch.
 *   2. Decide, PER COLLIDING GROUP, whether that shared identity is
 *      authoritative - see the AC1/Amendment-1 header comment above
 *      `regionsAgree` for the full rule and why a single pass (trusting
 *      whichever line happened to resolve first) is exactly the defect
 *      this Work Order exists to close.
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
 *
 * `source_region` (AC1, WO-2026-08-12-B15-VISION-04) is read off each line
 * exactly like `vision_confidence`/`vision_status` - present only on a
 * photo-sourced reading, `null` for a typed one (never region-graded) - and
 * carried into the output for the same durability reason `match_confidence`
 * is: the signal that decided a collision stays visible after the gate has
 * already fired, not only while it is firing.
 */
function resolveAll(lines, regulars, opts = {}) {
  // PHASE 1 - resolve independently. Grouped by duplicate key but not yet
  // acted on: AC1 needs to see EVERY member of a colliding group's
  // source_region before any single member can be trusted as the survivor.
  const resolved = lines.map((l, i) => {
    const lineOpts = {
      ...opts,
      visionConfidence: l && Object.prototype.hasOwnProperty.call(l, 'vision_confidence') ? l.vision_confidence : undefined,
      visionStatus: l && Object.prototype.hasOwnProperty.call(l, 'vision_status') ? l.vision_status : undefined,
    };
    const r = resolveReading(l.raw_reading, regulars, lineOpts);
    const quantity = l.quantity ?? null;
    const match_confidence = lineOpts.visionConfidence === undefined
      ? null
      : (Number.isFinite(Number(lineOpts.visionConfidence)) ? Number(lineOpts.visionConfidence) : null);
    const source_region = l && Number.isInteger(l.source_region) ? l.source_region : null;
    return {
      line_no: l.line_no ?? i + 1, raw_reading: l.raw_reading, quantity,
      match_confidence, source_region, ...r,
    };
  });

  // PHASE 2 - group every resolved line that carries an identity by its
  // duplicate key, then decide each group per the rule above. A group of
  // one (no collision) is left completely untouched, exactly as before.
  const groups = new Map();
  resolved.forEach((line, idx) => {
    if (line.matched_regular_id == null) return;
    const key = duplicateKey(line.matched_regular_id, line.quantity);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx);
  });

  groups.forEach((indices) => {
    if (indices.length < 2) return;
    const regions = indices.map((idx) => resolved[idx].source_region);
    if (regionsAgree(regions)) {
      // AC3/AC4, UNCHANGED: real supporting evidence (same region, or no
      // region evidence to contradict it) - one survivor. Identity and
      // quantity stay on the excluded row so the audit trail still shows
      // exactly what this reading was; only `status` moves to `excluded` so
      // runPipeline.js's materialisation step skips it.
      indices.slice(1).forEach((idx) => { resolved[idx].status = 'excluded'; });
    } else {
      // AMENDMENT 1: genuine cross-region disagreement - NO survivor. Every
      // member of the group is demoted, never merely the later one(s), and
      // never left as the sole "confident" one on nothing but emission order.
      indices.forEach((idx) => {
        const line = resolved[idx];
        const suggestion = { id: line.matched_regular_id, name: line.matched_product_name };
        line.status = 'needs_confirmation';
        line.match_basis = `${line.match_basis || 'catalogue match'} (held: colliding with another reading from a different image region - identity not authoritative, see WO-2026-08-12-B15-VISION-04 Amendment 1)`;
        line.alternatives = [suggestion].concat(line.alternatives || []);
        line.matched_regular_id = null;
        line.matched_product_name = null;
      });
    }
  });

  return resolved;
}

module.exports = {
  resolveReading, resolveAll, normaliseTerm, stripLeadingQuantity, BASIS,
  VISION_CONFIDENCE_THRESHOLD, applyVisionConfidenceGate,
  // AC3 (WO-2026-08-12-B15-VISION-02) - exported so the size/identity guard
  // is testable in isolation, not only through resolveReading's end result.
  sizeToken, regularSizeTokens, sizeCompatible,
  // AC1 (WO-2026-08-12-B15-VISION-04) - exported for the same reason.
  regionsAgree,
};
