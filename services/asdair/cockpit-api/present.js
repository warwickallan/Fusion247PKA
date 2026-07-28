// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/present.js
//
// PRESENTATION, DONE ONCE, SERVER SIDE.
//
// WHY THIS FILE EXISTS AT ALL: the two rules the cockpit must never break are
// presentation rules -
//
//   1. an unknown fact reads as "unknown", never as 0 and never as a guess;
//   2. a DERIVED price is never shown as an ASDA-quoted value.
//
// A rule that lives in a .vue template cannot be exercised by `node --test`.
// So the payload the workspace renders carries the finished display string
// alongside the raw value, and the browser has nothing left to fabricate from.
// The Vue side prints `field.display`; it does not decide what unknown looks
// like, and it cannot decide that a derived total is an ASDA price.
//
// PURE. No DB, no clock, no network, no randomness. PURE ASCII.
// Currency is written as "GBP", never a symbol.
// =====================================================================

'use strict';

const UNKNOWN = 'unknown';

// The three bases migration 006 allows on order_confirmation_line.price_basis.
const PRICE_BASES = Object.freeze(['stated', 'derived', 'unknown']);

// The wording is deliberate. "derived" must READ as not-from-ASDA even to
// somebody skim-reading a phone screen at the door.
const BASIS_LABELS = Object.freeze({
  stated: 'ASDA stated this price',
  derived: 'inferred by us - NOT an ASDA-quoted price',
  unknown: 'price basis unknown'
});

const BASIS_SUFFIX = Object.freeze({
  stated: '',
  derived: ' (inferred - not an ASDA price)',
  unknown: ' (basis unknown)'
});

function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

// A string fact. Absent -> "unknown". Never an empty box the reader has to
// interpret, and never a placeholder that could be mistaken for content.
function text(value) {
  return isMissing(value) ? UNKNOWN : String(value);
}

// A COUNT. This is the function the "null is not zero" rule lives in.
//   null / undefined / ''  -> "unknown"
//   0                      -> "0"      (a real, measured zero)
// A missing count must never come out as "0", because "0 lines" reads as an
// empty list rather than as "we do not know yet".
function count(value) {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'boolean') return UNKNOWN;
  if (typeof value === 'string' && value.trim() === '') return UNKNOWN;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : UNKNOWN;
}

function bool(value) {
  if (value === null || value === undefined) return UNKNOWN;
  return value ? 'yes' : 'no';
}

function when(value) {
  if (isMissing(value)) return UNKNOWN;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? UNKNOWN : d.toISOString();
}

// A confidence is a 0..1 number from the transcription/matching step. Absent
// means the step never reported one - which is NOT "0% confident".
function confidence(value) {
  if (value === null || value === undefined || value === '') return UNKNOWN;
  const n = Number(value);
  if (!Number.isFinite(n)) return UNKNOWN;
  const pct = n <= 1 ? n * 100 : n;
  return String(Math.round(pct)) + '%';
}

// ---------------------------------------------------------------------
// MONEY. Every amount travels with HOW IT IS KNOWN, exactly as shopStatus.js
// produces it: { amount, currency, basis, source }.
//
// Fail-safe by construction: anything that is not explicitly `basis: 'stated'`
// comes back with is_asda_quoted === false and a display string that says so.
// A bare number (no basis) is therefore treated as basis-unknown, never as an
// ASDA figure - so a future caller that forgets the basis degrades to honest
// rather than to a lie.
// ---------------------------------------------------------------------
function money(value) {
  const missing = {
    known: false,
    amount: null,
    currency: null,
    basis: null,
    source: null,
    basis_label: UNKNOWN,
    is_asda_quoted: false,
    display: UNKNOWN
  };
  if (value === null || value === undefined) return missing;

  const raw = typeof value === 'object' ? value.amount : value;
  if (raw === null || raw === undefined || raw === '') return missing;
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return missing;

  const declared = typeof value === 'object' ? value.basis : null;
  const basis = PRICE_BASES.indexOf(declared) === -1 ? 'unknown' : declared;
  const currency = (typeof value === 'object' && value.currency) ? String(value.currency) : 'GBP';
  const source = (typeof value === 'object' && value.source) ? String(value.source) : null;

  return {
    known: true,
    amount: amount,
    currency: currency,
    basis: basis,
    source: source,
    basis_label: BASIS_LABELS[basis],
    is_asda_quoted: basis === 'stated',
    display: amount.toFixed(2) + ' ' + currency + BASIS_SUFFIX[basis]
  };
}

// A confirmation line stores the amount and the basis in separate columns.
function lineMoney(amount, priceBasis, source) {
  if (amount === null || amount === undefined || amount === '') return money(null);
  return money({ amount: amount, currency: 'GBP', basis: priceBasis, source: source || 'order_confirmation_line' });
}

module.exports = {
  UNKNOWN: UNKNOWN,
  PRICE_BASES: PRICE_BASES,
  BASIS_LABELS: BASIS_LABELS,
  text: text,
  count: count,
  bool: bool,
  when: when,
  confidence: confidence,
  money: money,
  lineMoney: lineMoney,
  _internal: { isMissing: isMissing, BASIS_SUFFIX: BASIS_SUFFIX }
};
