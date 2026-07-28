// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: parseConfirmation.js
//
// The PURE parser for a pasted ASDA ORDER CONFIRMATION. It turns the text
// Warwick pastes into ShopperBot into structured lines that can be reconciled
// against what was planned, and then stored.
//
// PURE and DETERMINISTIC, exactly like skill/planner.js and outcome/buildOutcome.js:
//   * No DB, no network, no fs, no Date.now(), no randomness.
//   * Given identical input it always returns an identical result.
//   * It never mutates its argument; every returned object is frozen.
//
// =====================================================================
// THE PRICE CONTRACT - the single most important rule in this module
// =====================================================================
//
// Every emitted line carries a REQUIRED `price_basis` field. It is not an
// optional flag, and there is no code path that produces a line without one:
//
//   'stated'   ASDA explicitly showed this price on this line. `line_price`
//              is that number.
//   'derived'  ASDA did NOT show this price. It was computed by subtraction
//              from an ASDA-stated ORDER TOTAL. `line_price` is the result.
//              It is NOT an ASDA-quoted value and must never be presented as
//              one.
//   'unknown'  No price is known. `line_price` is ALWAYS null.
//
// THE CRITICAL RULE: a line with no visible price gets `line_price: null` and
// `price_basis: 'unknown'`. A price is NEVER invented. Not "0", not the shelf
// price, not an average, not a guess.
//
// Derivation is OPT-IN (`derive_single_missing_price: true`) and is refused
// unless ALL of these hold, so a derived number is never a fiction:
//   1. an AUTHORITATIVE order total was explicitly shown (stated_total_basis
//      === 'stated');
//   2. EXACTLY ONE line is unpriced - two unknowns cannot be separated;
//   3. every other line is 'stated' (never 'derived' - no chaining);
//   4. the confirmation showed NO non-product charge or adjustment (delivery,
//      bags, service charge, savings, voucher, discount). If it did, the
//      residual is not attributable to the missing line and derivation is
//      REFUSED with a recorded reason;
//   5. the residual is strictly positive (>= 0.01). A zero or negative
//      residual is a parse disagreement, not a free item.
//
// Presentation: `formatLinePrice(line)` is the ONLY sanctioned way to render a
// price for a human. It is structurally incapable of rendering a derived price
// in the same form as a stated one.
//
// SCOPE: this module contacts nothing. It never talks to ASDA, never opens a
// browser, never checks out. It reads text and returns data.
//
// PURE ASCII SOURCE ONLY. The pound sign is written as the escape \u00A3 so
// this file stays ASCII while still parsing real ASDA text.
// =====================================================================

'use strict';

// The parser identity recorded alongside a parse, so a stored `parsed` blob
// says which code produced it and can be re-derived or superseded later.
const PARSER_VERSION = 'asdair/reconcile/parseConfirmation@1';

// The asdair.order_confirmation_line.price_basis CHECK vocabulary, validated
// here in pure code so a bad value is impossible before any DB is involved.
const PRICE_BASIS = ['stated', 'derived', 'unknown'];

// The asdair.order_confirmation.source_kind CHECK vocabulary.
const SOURCE_KINDS = ['text', 'photo', 'document'];

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

function fail(message) {
  throw new Error('parseConfirmation: ' + message);
}

// Match the numeric(10,2) money columns and planner.js round2.
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Turn a captured money token ("\u00A312.50", "GBP 12.50", "1,234.56") into a
// number. Returns null when it is not finite, so nothing is ever guessed.
function money(token) {
  const cleaned = String(token).replace(/\u00A3/g, '').replace(/GBP/ig, '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

function collapse(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

// Trim the punctuation ASDA layouts leave dangling once a price or promotion
// has been lifted off the end of a line.
function tidyName(s) {
  return collapse(s).replace(/^[\-*.:,\s]+/, '').replace(/[\-*.:,\s]+$/, '').trim();
}

// ---------------------------------------------------------------------
// Line classification vocabularies
// ---------------------------------------------------------------------

// Headers, footers and layout furniture. Skipped; never a product.
const NOISE_PATTERNS = [
  /^your\s+(?:\w+\s+){0,2}order\b/i,
  // A column-header row: only the words a table header is made of.
  /^(?:item|items|product|description|qty|quantity|price|total|each|amount|line)(?:\s+(?:item|items|product|description|qty|quantity|price|total|each|amount|line))+\s*$/i,
  /^order\s+(number|no\.?|ref|reference|date|summary|confirmation|placed|status)\b/i,
  /^(delivery|collection)\s+(slot|address|date|time|window|instructions)\b/i,
  /^thank(s| you)\b/i,
  /^substitution/i,
  /^unavailable\s+item/i,
  /^(out\s+of\s+stock|not\s+available)\s*$/i,
  /^payment\b/i,
  /^card\s+ending\b/i,
  /^(product|description|price|quantity|qty|item|items)\s*$/i,
  /^qty\s*[\/|]\s*price\b/i,
  /^\d+\s+items?\s*$/i,
  /^total\s+items?\b/i,
  /^[-=_*]{3,}\s*$/,
  /^(groceries|asda|asda\s+groceries)\s*$/i,
  /^we('|)ll\b/i,
  /^estimated\b/i
];

// Non-product money lines. These are NOT products, and their presence makes a
// subtraction-derived line price unsafe, because the residual between the
// order total and the sum of line prices is no longer attributable to the one
// unpriced line. Seeing any of these BLOCKS derivation.
const CHARGE_PATTERNS = [
  /^delivery\s+(charge|fee|cost)\b/i,
  /^delivery\s*[:\u00A3]/i,
  /^(carrier\s+)?bags?\s+(charge|fee)\b/i,
  /^service\s+(charge|fee)\b/i,
  /^packaging\s+(charge|fee)\b/i,
  /^(total\s+)?savings?\b/i,
  /^you\s+saved\b/i,
  /^voucher\b/i,
  /^discount\b/i,
  /^promo(tion)?\s+code\b/i,
  /^(driver\s+)?tip\b/i,
  /^donation\b/i,
  /^sub[\s-]?total\b/i
];

// An AUTHORITATIVE order total. Deliberately narrow: only labels that mean
// "this is what the order came to".
const TOTAL_PATTERNS = [
  /^order\s+total\b/i,
  /^total\s+to\s+pay\b/i,
  /^total\s+paid\b/i,
  /^total\s+cost\b/i,
  /^basket\s+total\b/i,
  /^you\s+paid\b/i,
  /^total\s*[:\u00A3]/i,
  /^total\s*$/i,
  /^total\s+\u00A3/i,
  /^total\s+GBP\b/i
];

// Promotion phrases. Order matters: the specific forms are tried before the
// deliberately loose "N for M" catch-all, so "2 for \u00A35" is captured whole.
const PROMO_PATTERNS = [
  /\b\d+\s+for\s+(?:\u00A3|GBP\s?)\s?\d+(?:\.\d{1,2})?\b/i,
  /\b\d+\s+for\s+\d{1,3}p\b/i,
  /\bbuy\s+\d+\s+get\s+\S+\s+free\b/i,
  /\b\d+\s+for\s+the\s+price\s+of\s+\d+\b/i,
  /\bsave\s+(?:\u00A3|GBP\s?)?\s?\d+(?:\.\d{1,2})?p?\b/i,
  /\bwas\s+(?:\u00A3|GBP\s?)\s?\d+(?:\.\d{1,2})?\b/i,
  /\brollback\b/i,
  /\bprice\s+lock\b/i,
  /\bmulti-?buy\b/i,
  /\bmeal\s+deal\b/i,
  /\bmix\s*(?:and|&)\s*match\b/i,
  /\bany\s+\d+\s+for\b/i,
  /\b\d+\s*for\s*\d+\b/i
];

// Pack / size tokens. Extracting one is READING the name, never inventing:
// pack_size is only ever a substring of what ASDA printed.
const PACK_PATTERNS = [
  /\b\d+(?:\.\d+)?\s?x\s?\d+(?:\.\d+)?\s?(?:kg|g|ml|cl|l)\b/ig,
  /\b\d+(?:\.\d+)?\s?(?:kg|g|mg|ml|cl|l|litres?|pints?)\b/ig,
  /\b\d+\s?(?:pack|pk|rolls?|roll|washes|wash|bags?|sheets?|tablets?|caps?|slices?)\b/ig,
  /\(\s*\d+(?:\.\d+)?\s*(?:kg|g|ml|cl|l|pints?)\s*\)/ig
];

function matchesAny(patterns, s) {
  for (let i = 0; i < patterns.length; i++) {
    patterns[i].lastIndex = 0;
    if (patterns[i].test(s)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Price extraction. A token only counts as a price when it CARRIES a currency
// marker, is written to exactly two decimal places, or is pence ("75p").
// A bare integer at the end of a line (a pack count, a wash count) is NOT a
// price and is never read as one.
// ---------------------------------------------------------------------
function extractTrailingPrice(text) {
  const t = String(text);
  let m;

  m = /^(.*?)\s*(\u00A3\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/.exec(t);
  if (m) return { value: money(m[2]), rest: m[1] };

  m = /^(.*?)\s*\bGBP\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/i.exec(t);
  if (m) return { value: money(m[2]), rest: m[1] };

  m = /^(.*?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/.exec(t);
  if (m) return { value: money(m[2]), rest: m[1] };

  m = /^(.*?)\s+(\d{1,3})p\s*$/.exec(t);
  if (m) return { value: round2(Number(m[2]) / 100), rest: m[1] };

  return null;
}

// Lift every promotion phrase out of a line. Returns what was found and what
// text is left once they are gone.
function extractPromotions(text) {
  let t = String(text);
  const found = [];
  for (let i = 0; i < PROMO_PATTERNS.length; i++) {
    PROMO_PATTERNS[i].lastIndex = 0;
    const m = PROMO_PATTERNS[i].exec(t);
    if (m) {
      found.push(collapse(m[0]));
      t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
    }
  }
  return { promotions: found, rest: t };
}

// A line that is ONLY a promotion (and possibly its price) - ASDA prints these
// under the product they apply to. It belongs to the line above, not to itself.
function isPromotionOnlyLine(s) {
  const p = extractPromotions(s);
  if (p.promotions.length === 0) return false;
  let rest = p.rest;
  const price = extractTrailingPrice(collapse(rest));
  if (price) rest = price.rest;
  return tidyName(rest) === '';
}

// Leading quantity markers: "2 x Foo", "2x Foo", "x2 Foo", "2 \u00D7 Foo".
function extractLeadingQuantity(text) {
  let m = /^(\d{1,4})\s*[x\u00D7]\s+(.+)$/i.exec(text);
  if (m) return { quantity: Number(m[1]), rest: m[2] };
  m = /^(\d{1,4})[x\u00D7]\s*(.+)$/i.exec(text);
  if (m) return { quantity: Number(m[1]), rest: m[2] };
  m = /^[x\u00D7]\s*(\d{1,4})\s+(.+)$/i.exec(text);
  if (m) return { quantity: Number(m[1]), rest: m[2] };
  return null;
}

// "Qty: 2" / "Quantity 2" anywhere on the line.
function extractLabelledQuantity(text) {
  const m = /\b(?:qty|quantity)\s*[:.]?\s*(\d{1,4})\b/i.exec(text);
  if (!m) return null;
  return {
    quantity: Number(m[1]),
    rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
  };
}

// A bare "x2" at the very END of the remaining name (after the price has been
// lifted). Anchored so "4 x 415g" and "30cm x 10m" inside a name are untouched.
function extractTrailingQuantity(text) {
  const m = /^(.*?)\s+[x\u00D7]\s?(\d{1,3})\s*$/i.exec(text);
  if (!m) return null;
  return { quantity: Number(m[2]), rest: m[1] };
}

function extractPackSize(name) {
  let best = null;
  for (let i = 0; i < PACK_PATTERNS.length; i++) {
    const re = PACK_PATTERNS[i];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(name)) !== null) {
      if (best === null || m.index >= best.index) best = { index: m.index, text: collapse(m[0]) };
      if (m[0] === '') re.lastIndex += 1;
    }
  }
  return best ? best.text : null;
}

// ---------------------------------------------------------------------
// Remove the smallest common indentation from the whole block, so that any
// REMAINING indentation is a real signal (a wrapped product name) rather than
// an artefact of how the text was pasted.
// ---------------------------------------------------------------------
function dedent(rawLines) {
  let min = Infinity;
  rawLines.forEach(function (l) {
    if (l.trim() === '') return;
    const m = /^[ \t]*/.exec(l);
    min = Math.min(min, m[0].replace(/\t/g, '    ').length);
  });
  if (!Number.isFinite(min) || min === 0) return rawLines.slice();
  return rawLines.map(function (l) {
    if (l.trim() === '') return l;
    const expanded = l.replace(/^([ \t]*)/, function (w) { return w.replace(/\t/g, '    '); });
    return expanded.slice(min);
  });
}

// ---------------------------------------------------------------------
// parseConfirmation(input) -> a frozen parse result
//
// input : the confirmation TEXT, or
//         { text, source_kind?, derive_single_missing_price? }
//
// RESULT
// {
//   parser_version, source_kind,
//   lines: [ { line_no, product_name, quantity, pack_size, promotion,
//              line_price, price_basis, note, raw } ],
//   stated_total, stated_total_basis,   // 'stated' | 'unknown'
//   derivation: { attempted, applied, blocked_reasons: [] },
//   summary: { ... },
//   warnings: [],
//   skipped: [ { raw, reason } ]
// }
//
// `quantity` is null when ASDA did not show one. A quantity is never assumed
// to be 1, for the same reason a price is never assumed: it would be a
// fabricated fact indistinguishable from an observed one.
// ---------------------------------------------------------------------
function parseConfirmation(input) {
  const args = (typeof input === 'string') ? { text: input } : (input || {});

  if (args.text === null || args.text === undefined) fail('text is required (the pasted confirmation)');
  const text = String(args.text);

  const sourceKind = args.source_kind === undefined || args.source_kind === null || args.source_kind === ''
    ? 'text' : String(args.source_kind).trim();
  if (SOURCE_KINDS.indexOf(sourceKind) === -1) {
    fail('source_kind "' + sourceKind + '" is not one of: ' + SOURCE_KINDS.join(', '));
  }

  const warnings = [];
  const skipped = [];
  const blockedReasons = [];
  const lines = [];

  const rawLines = dedent(text.replace(/\r\n?/g, '\n').split('\n'));

  const totalsSeen = [];
  let pendingPromotions = [];   // a promo line printed ABOVE its product

  function lastLine() {
    return lines.length ? lines[lines.length - 1] : null;
  }

  function addPromotionTo(line, promos) {
    if (!promos || promos.length === 0) return;
    const existing = line.promotion ? line.promotion.split('; ') : [];
    promos.forEach(function (p) { if (existing.indexOf(p) === -1) existing.push(p); });
    line.promotion = existing.join('; ');
  }

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw.trim() === '') continue;

    const indentMatch = /^[ \t]*/.exec(raw);
    const indent = indentMatch[0].replace(/\t/g, '    ').length;
    const s = collapse(raw);

    // ---- 1. an authoritative order total ------------------------------
    if (matchesAny(TOTAL_PATTERNS, s) && !matchesAny(CHARGE_PATTERNS, s)) {
      const p = extractTrailingPrice(s);
      if (p && p.value !== null) {
        totalsSeen.push(p.value);
      } else {
        skipped.push({ raw: s, reason: 'total-line-without-a-price' });
      }
      continue;
    }

    // ---- 2. a non-product charge / adjustment -------------------------
    if (matchesAny(CHARGE_PATTERNS, s)) {
      skipped.push({ raw: s, reason: 'non-product-charge-or-adjustment' });
      const label = collapse(s).slice(0, 60);
      if (blockedReasons.indexOf('non-product charge or adjustment present: "' + label + '"') === -1) {
        blockedReasons.push('non-product charge or adjustment present: "' + label + '"');
      }
      continue;
    }

    // ---- 3. layout furniture ------------------------------------------
    if (matchesAny(NOISE_PATTERNS, s)) {
      skipped.push({ raw: s, reason: 'header-footer-or-layout' });
      continue;
    }

    // ---- 4. a promotion printed on its own line ------------------------
    if (isPromotionOnlyLine(s)) {
      const promos = extractPromotions(s).promotions;
      const prev = lastLine();
      if (prev) addPromotionTo(prev, promos);
      else pendingPromotions = pendingPromotions.concat(promos);
      continue;
    }

    // ---- 5. a wrapped continuation of the line above --------------------
    // Signals, deliberately conservative so a genuinely UNPRICED product line
    // is never swallowed by the next product:
    //   * the line is indented relative to the block, OR
    //   * it starts lower-case / with an opening bracket AND the line above is
    //     still waiting for its price.
    // A quantity marker always starts a NEW line.
    const prev = lastLine();
    const startsNew = extractLeadingQuantity(s) !== null;
    const looksLikeTail = /^[a-z(\[]/.test(s);
    const isContinuation = prev !== null && !startsNew &&
      (indent >= 2 || (looksLikeTail && prev.line_price === null));

    if (isContinuation) {
      const promo = extractPromotions(s);
      addPromotionTo(prev, promo.promotions);
      let rest = collapse(promo.rest);
      const price = extractTrailingPrice(rest);
      if (price && price.value !== null && prev.line_price === null) {
        prev.line_price = price.value;
        prev.price_basis = 'stated';
        rest = price.rest;
      } else if (price && price.value !== null) {
        warnings.push('line ' + prev.line_no + ': a second price was shown on a wrapped line and was ignored');
        rest = price.rest;
      }
      const tail = tidyName(rest);
      if (tail !== '') {
        prev.product_name = tidyName(prev.product_name + ' ' + tail);
        prev.pack_size = extractPackSize(prev.product_name);
      }
      prev.raw = prev.raw + '\n' + s;
      continue;
    }

    // ---- 6. a product line ---------------------------------------------
    let work = s;
    let quantity = null;

    const lead = extractLeadingQuantity(work);
    if (lead) { quantity = lead.quantity; work = lead.rest; }

    const promo = extractPromotions(work);
    work = promo.rest;

    const price = extractTrailingPrice(collapse(work));
    let linePrice = null;
    let priceBasis = 'unknown';
    if (price && price.value !== null) {
      linePrice = price.value;
      priceBasis = 'stated';
      work = price.rest;
    }

    if (quantity === null) {
      const labelled = extractLabelledQuantity(work);
      if (labelled) { quantity = labelled.quantity; work = labelled.rest; }
    }
    if (quantity === null) {
      const trailing = extractTrailingQuantity(collapse(work));
      if (trailing) { quantity = trailing.quantity; work = trailing.rest; }
    }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) quantity = null;

    const productName = tidyName(work);
    if (productName === '') {
      skipped.push({ raw: s, reason: 'no-product-name-left-after-parsing' });
      continue;
    }

    const line = {
      line_no: lines.length + 1,
      product_name: productName,
      quantity: quantity,
      pack_size: extractPackSize(productName),
      promotion: null,
      // THE CRITICAL RULE, applied here and nowhere else: an unpriced line
      // gets null + 'unknown'. There is no branch that supplies a number.
      line_price: linePrice,
      price_basis: priceBasis,
      note: null,
      raw: s
    };
    addPromotionTo(line, promo.promotions);
    if (pendingPromotions.length) {
      addPromotionTo(line, pendingPromotions);
      pendingPromotions = [];
    }
    lines.push(line);
  }

  if (pendingPromotions.length) {
    warnings.push('a promotion line appeared before any product line and was not attached: ' +
      pendingPromotions.join('; '));
  }

  // ---- the order total -------------------------------------------------
  let statedTotal = null;
  let statedTotalBasis = 'unknown';
  const distinctTotals = totalsSeen.filter(function (v, idx) { return totalsSeen.indexOf(v) === idx; });
  if (distinctTotals.length === 1) {
    statedTotal = distinctTotals[0];
    statedTotalBasis = 'stated';
  } else if (distinctTotals.length > 1) {
    warnings.push('two or more DIFFERENT order totals were shown (' +
      distinctTotals.map(function (v) { return v.toFixed(2); }).join(', ') +
      '); stated_total was left null rather than choosing one');
    blockedReasons.push('the confirmation showed conflicting order totals');
  }

  const result = {
    parser_version: PARSER_VERSION,
    source_kind: sourceKind,
    lines: lines,
    stated_total: statedTotal,
    stated_total_basis: statedTotalBasis,
    derivation: { attempted: false, applied: false, blocked_reasons: blockedReasons },
    warnings: warnings,
    skipped: skipped,
    summary: null
  };

  const wantDerive = args.derive_single_missing_price === true;
  const finished = wantDerive ? deriveMissingPrice(result) : result;
  finished.summary = summarise(finished);
  return freezeResult(finished);
}

// ---------------------------------------------------------------------
// summarise(parsed) -> the counts a human and the reconciler both need.
//
// `stated_line_price_sum` is the sum of prices ASDA ACTUALLY SHOWED. Derived
// prices are counted separately and never folded into it, so "what ASDA said"
// stays separable from "what we worked out" at every level, not just per line.
// ---------------------------------------------------------------------
function summarise(parsed) {
  const lines = parsed.lines;
  let statedSum = 0;
  let derivedSum = 0;
  let unitCount = 0;
  let linesWithoutQuantity = 0;
  const perBasis = { stated: 0, derived: 0, unknown: 0 };

  lines.forEach(function (l) {
    perBasis[l.price_basis] += 1;
    if (l.price_basis === 'stated' && l.line_price !== null) statedSum += l.line_price;
    if (l.price_basis === 'derived' && l.line_price !== null) derivedSum += l.line_price;
    if (l.quantity === null) linesWithoutQuantity += 1;
    else unitCount += l.quantity;
  });

  return {
    line_count: lines.length,
    unit_count: unitCount,
    lines_without_quantity: linesWithoutQuantity,
    stated_price_line_count: perBasis.stated,
    derived_price_line_count: perBasis.derived,
    unpriced_line_count: perBasis.unknown,
    stated_line_price_sum: round2(statedSum),
    derived_line_price_sum: round2(derivedSum),
    stated_total: parsed.stated_total,
    stated_total_basis: parsed.stated_total_basis,
    currency: 'GBP'
  };
}

// ---------------------------------------------------------------------
// deriveMissingPrice(parsed) -> a NEW parse result
//
// The ONLY code path in the system that may put a number into `line_price`
// without ASDA having shown it - and it always stamps `price_basis: 'derived'`
// in the same statement, so the two can never come apart.
//
// Every refusal is recorded in derivation.blocked_reasons rather than being
// silent, so "why is this still unknown" is always answerable.
// ---------------------------------------------------------------------
function deriveMissingPrice(parsed) {
  const reasons = parsed.derivation.blocked_reasons.slice();
  const lines = parsed.lines;

  function refuse(reason) {
    if (reasons.indexOf(reason) === -1) reasons.push(reason);
    return Object.assign({}, parsed, {
      lines: lines,
      derivation: { attempted: true, applied: false, blocked_reasons: reasons }
    });
  }

  if (parsed.stated_total === null || parsed.stated_total_basis !== 'stated') {
    return refuse('no authoritative ASDA-stated order total was shown');
  }
  if (reasons.length > 0) {
    return refuse('a pre-existing block was recorded before derivation was attempted');
  }

  const unknowns = lines.filter(function (l) { return l.price_basis === 'unknown'; });
  if (unknowns.length === 0) return refuse('no line is missing a price');
  if (unknowns.length > 1) {
    return refuse(unknowns.length + ' lines are missing a price; a single residual cannot be split between them');
  }
  const alreadyDerived = lines.filter(function (l) { return l.price_basis === 'derived'; });
  if (alreadyDerived.length > 0) {
    return refuse('a derived price is already present; derivation is never chained on top of another derivation');
  }

  let statedSum = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.price_basis === 'unknown') continue;
    if (l.price_basis !== 'stated' || l.line_price === null) {
      return refuse('not every other line carries an ASDA-stated price');
    }
    statedSum += l.line_price;
  }

  const residual = round2(parsed.stated_total - round2(statedSum));
  if (!(residual >= 0.01)) {
    return refuse('the residual (GBP ' + residual.toFixed(2) + ') is not strictly positive, so it is a parse ' +
      'disagreement rather than the missing line price');
  }

  const target = unknowns[0];
  const newLines = lines.map(function (l) {
    if (l.line_no !== target.line_no) return l;
    return Object.assign({}, l, {
      line_price: residual,
      // Set in the SAME object literal as the number. There is no window in
      // which a derived amount exists without its basis.
      price_basis: 'derived',
      note: appendNote(l.note,
        'price DERIVED by subtraction: ASDA-stated order total GBP ' + parsed.stated_total.toFixed(2) +
        ' minus the sum of stated line prices GBP ' + round2(statedSum).toFixed(2) +
        '. NOT an ASDA-quoted price.')
    });
  });

  return Object.assign({}, parsed, {
    lines: newLines,
    derivation: { attempted: true, applied: true, blocked_reasons: reasons }
  });
}

function appendNote(existing, addition) {
  const a = (existing === null || existing === undefined || String(existing).trim() === '') ? '' : String(existing).trim();
  return a === '' ? addition : a + ' | ' + addition;
}

// ---------------------------------------------------------------------
// formatLinePrice(line) -> the ONLY sanctioned human presentation of a price.
//
// Structurally incapable of rendering a derived price the way a stated one is
// rendered: the three branches produce three different, non-overlapping
// strings, and the derived branch always carries the word DERIVED. An unknown
// basis throws rather than falling through to a default.
// ---------------------------------------------------------------------
function formatLinePrice(line) {
  if (!line || typeof line !== 'object') fail('formatLinePrice needs a parsed line');
  const basis = line.price_basis;
  if (PRICE_BASIS.indexOf(basis) === -1) {
    fail('line ' + String(line.line_no) + ' has price_basis "' + String(basis) + '", which is not one of: ' +
      PRICE_BASIS.join(', '));
  }
  if (basis === 'unknown') {
    if (line.line_price !== null && line.line_price !== undefined) {
      fail('line ' + String(line.line_no) + ' claims price_basis "unknown" but carries a price');
    }
    return 'price not shown by ASDA';
  }
  const n = Number(line.line_price);
  if (!Number.isFinite(n)) {
    fail('line ' + String(line.line_no) + ' has price_basis "' + basis + '" but no usable price');
  }
  if (basis === 'stated') return 'GBP ' + n.toFixed(2) + ' (as shown by ASDA)';
  return 'GBP ' + n.toFixed(2) + ' (DERIVED by subtraction - NOT quoted by ASDA)';
}

// ---------------------------------------------------------------------
// Freeze the result so a downstream caller cannot quietly flip a price_basis
// or edit a price in place. Everything downstream (reconcile.js) builds NEW
// objects rather than mutating these.
// ---------------------------------------------------------------------
function freezeResult(result) {
  result.lines = Object.freeze(result.lines.map(function (l) { return Object.freeze(l); }));
  result.warnings = Object.freeze(result.warnings);
  result.skipped = Object.freeze(result.skipped.map(function (s) { return Object.freeze(s); }));
  result.derivation = Object.freeze(Object.assign({}, result.derivation, {
    blocked_reasons: Object.freeze(result.derivation.blocked_reasons)
  }));
  result.summary = Object.freeze(result.summary);
  return Object.freeze(result);
}

module.exports = {
  parseConfirmation: parseConfirmation,
  deriveMissingPrice: deriveMissingPrice,
  formatLinePrice: formatLinePrice,
  PARSER_VERSION: PARSER_VERSION,
  PRICE_BASIS: PRICE_BASIS,
  SOURCE_KINDS: SOURCE_KINDS,
  _internal: {
    round2: round2,
    money: money,
    tidyName: tidyName,
    dedent: dedent,
    summarise: summarise,
    extractTrailingPrice: extractTrailingPrice,
    extractPromotions: extractPromotions,
    isPromotionOnlyLine: isPromotionOnlyLine,
    extractLeadingQuantity: extractLeadingQuantity,
    extractPackSize: extractPackSize,
    appendNote: appendNote
  }
};
