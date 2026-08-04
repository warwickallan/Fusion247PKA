// =====================================================================
// BUILD-015 AsdAIr - the PRE-HANDOVER basket check: verifyBasket.js
//
// THE GAP THIS FILLS (END-TO-END-PROCESS-AUDIT.md step 15, WO-S):
//   reconcile.js compares the forwarded ASDA ORDER CONFIRMATION against the
//   recomputed plan - i.e. it runs AFTER Warwick has already checked out. By
//   then a wrong product has been bought and paid for.
//
//   This is the check that runs BEFORE the handover, while the basket is still
//   editable: expected (from the Sonnet execution packet) against actual (what
//   is really in the basket), per IDENTITY and per QUANTITY.
//
//   verifyBasket({ expected, actual }) -> report
//
// PURE and DETERMINISTIC, exactly like reconcile.js and skill/planner.js:
//   * No DB, no network, no fs, no clock, no randomness.
//   * It never mutates its arguments; every returned line is a NEW object.
//   * Identical inputs always produce an identical report, including line
//     order and which actual line each expected line claimed.
//
// ---------------------------------------------------------------------
// THE RULE THAT IS THE WHOLE POINT
// ---------------------------------------------------------------------
// CANONICAL-WEEKLY-SHOP-PROCESS.md section G:
//
//   "A matching headline count alone is insufficient if the wrong product or
//    quantity is present."
//
// So this module reports TWO different things and never lets one stand in for
// the other:
//
//   counts_match : the headline arithmetic agrees. WEAK. Two wrong products
//                  swapped for each other match perfectly.
//   verified     : every expected line is present at the expected quantity AND
//                  nothing unexpected is in the basket. This is the only value
//                  that may gate a handover.
//
// `verified` is computed from the LINES, never from the counts. It is
// structurally impossible for a headline match to produce verified: true on a
// basket whose contents are wrong - and verifyBasket.test.js proves exactly
// that case, because it is the failure mode the requirement names.
//
// ---------------------------------------------------------------------
// NORMALISATION
// ---------------------------------------------------------------------
// Name comparison uses the PLANNER'S OWN `normaliseTerm`, imported from
// services/asdair/skill/planner.js rather than reimplemented - the same
// discipline, and the same reason, as reconcile.js:78. skill/ is READ-ONLY BY
// CONTRACT and is only READ here.
//
// ---------------------------------------------------------------------
// THE `actual` CONTRACT - DEFINED HERE, PUBLISHED DELIBERATELY
// ---------------------------------------------------------------------
// No basket-capture code exists anywhere in the estate yet (audit step 14), so
// this shape is DEFINED here and must be published to whoever builds the
// capture. It is deliberately minimal: identity, name, quantity, and the two
// states a basket can be in that a count cannot express.
//
//   actual = {
//     captured_at : optional string, informational only - never compared
//     lines: [
//       {
//         asda_product_ref     : string of digits, or null
//         canonical_product_id : integer, or null
//         product_name         : string, REQUIRED (the human-readable fallback
//                                identity, and what a report has to print)
//         quantity             : integer >= 1, REQUIRED
//         unavailable          : optional boolean. TRUE means ASDA showed the
//                                line as out of stock / unobtainable. It is NOT
//                                a substitution: nothing here ever substitutes.
//       }
//     ]
//   }
//
// At least ONE of asda_product_ref / canonical_product_id should be present on
// every line. A name-only line still reconciles, but the report says so via
// `matched_on: 'name'`, because a name match is the weakest identity we have
// and a reviewer deserves to know which lines rest on it.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const planner = require('../skill/planner');
const normaliseTerm = planner._internal.normaliseTerm;

// Every expected line gets EXACTLY ONE of these.
const OUTCOMES = [
  'present',            // matched; identity and quantity both agree
  'quantity_mismatch',  // matched; the basket holds a different number
  'unavailable',        // matched; ASDA showed it as unobtainable
  'missing'             // expected and NOT in the basket at all
];

// A basket line no expected line claimed. Reported separately because it is a
// fact about the basket rather than about a packet line.
const UNEXPECTED = 'unexpected';

// How an expected line found its basket line, weakest last. Reported per line.
const MATCH_BASES = ['asda_product_ref', 'canonical_product_id', 'name'];

// The order the packet declares its lines are already in.
const EXPECTED_SORT_CONTRACT = 'brand_az_then_product_az';

function fail(message) {
  throw new Error('verifyBasket: ' + message);
}

function requireText(value, name) {
  if (value === null || value === undefined) fail(name + ' is required');
  const s = String(value).trim();
  if (s === '') fail(name + ' must be a non-empty string');
  return s;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// A quantity is a COUNT OF ITEMS. Unlike planner.normaliseQty, a bad value is
// NOT quietly defaulted to 1 here: this module exists to catch quantity errors,
// so silently inventing a quantity would defeat it.
function requireQty(value, name) {
  if (value === null || value === undefined || value === '') fail(name + ' is required');
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    fail(name + ' must be a whole number of items, 1 or more (got ' + JSON.stringify(value) + ')');
  }
  return n;
}

function optionalId(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s) || s === '0') fail(name + ' must be a positive integer id when given (got "' + s + '")');
  return String(Number(s));
}

// ---------------------------------------------------------------------
// Normalise the two sides into comparable shapes, validating as we go.
// ---------------------------------------------------------------------
function readExpectedLines(expected) {
  const lines = expected.lines;
  if (!Array.isArray(lines)) fail('expected.lines must be an array (the execution packet\'s own lines)');
  if (lines.length === 0) fail('expected.lines must not be empty - there is nothing to verify');

  return lines.map(function (line, i) {
    const at = 'expected.lines[' + i + ']';
    const l = line || {};
    return {
      index: i,
      seq: l.seq === null || l.seq === undefined ? i + 1 : Number(l.seq),
      canonical_product_id: optionalId(l.canonical_product_id, at + '.canonical_product_id'),
      canonical_product_name: requireText(l.canonical_product_name, at + '.canonical_product_name'),
      asda_product_ref: optionalText(l.asda_product_ref),
      brand: optionalText(l.brand),
      normalized_brand: optionalText(l.normalized_brand) === null
        ? normaliseTerm(l.brand)
        : normaliseTerm(l.normalized_brand),
      required_quantity: requireQty(l.required_quantity, at + '.required_quantity'),
      origin: optionalText(l.origin),
      source_view: optionalText(l.source_view),
      original_list_line: optionalText(l.original_list_line)
    };
  });
}

function readActualLines(actual) {
  const lines = actual.lines;
  if (!Array.isArray(lines)) fail('actual.lines must be an array (the captured basket)');

  return lines.map(function (line, i) {
    const at = 'actual.lines[' + i + ']';
    const l = line || {};
    if (l.unavailable !== undefined && l.unavailable !== null &&
        l.unavailable !== true && l.unavailable !== false) {
      fail(at + '.unavailable must be exactly true or false when given');
    }
    return {
      index: i,
      canonical_product_id: optionalId(l.canonical_product_id, at + '.canonical_product_id'),
      product_name: requireText(l.product_name, at + '.product_name'),
      asda_product_ref: optionalText(l.asda_product_ref),
      quantity: requireQty(l.quantity, at + '.quantity'),
      unavailable: l.unavailable === true,
      claimed_by: null
    };
  });
}

// ---------------------------------------------------------------------
// Identity matching, strongest first. Each actual line may be claimed by at
// most ONE expected line, so two packet lines can never both "find" the same
// basket line and both report present - which would hide a genuine omission.
// Claiming runs in packet order, which is deterministic by the packet's own
// sort contract.
// ---------------------------------------------------------------------
function claim(expectedLine, actualLines) {
  const byRef = expectedLine.asda_product_ref;
  const byId = expectedLine.canonical_product_id;
  const byName = normaliseTerm(expectedLine.canonical_product_name);

  const tries = [
    byRef === null ? null : { basis: 'asda_product_ref', test: function (a) { return a.asda_product_ref === byRef; } },
    byId === null ? null : { basis: 'canonical_product_id', test: function (a) { return a.canonical_product_id === byId; } },
    byName === '' ? null : { basis: 'name', test: function (a) { return normaliseTerm(a.product_name) === byName; } }
  ];

  for (let t = 0; t < tries.length; t++) {
    const attempt = tries[t];
    if (attempt === null) continue;
    for (let i = 0; i < actualLines.length; i++) {
      const a = actualLines[i];
      if (a.claimed_by !== null) continue;
      if (attempt.test(a)) {
        a.claimed_by = expectedLine.index;
        return { actual: a, matched_on: attempt.basis };
      }
    }
  }
  return { actual: null, matched_on: null };
}

// ---------------------------------------------------------------------
// verifyBasket({ expected, actual }) -> report
//
// `expected` is the Sonnet execution packet (or any object carrying the same
// three fields): { expected_distinct_products, expected_total_units, lines,
// sort_contract? }.
//
// `actual` is the captured basket - see the contract in the header.
//
// Returns:
// {
//   verified            : boolean - THE handover gate. Lines, never counts.
//   counts_match        : boolean - the headline arithmetic only. WEAK.
//   headline            : { expected_distinct_products, actual_distinct_products,
//                           expected_total_units, actual_total_units,
//                           declared_distinct_products, declared_total_units }
//   packet_self_consistent : boolean - do the packet's DECLARED counts agree
//                            with its own lines? A false here is a defect in
//                            the packet, not in the basket.
//   sort_contract_ok    : boolean|null - is the packet in the order it claims?
//   lines               : one entry per EXPECTED line, each with exactly one outcome
//   unexpected          : basket lines no expected line claimed
//   summary             : counts per outcome
//   blocking            : the human-readable reasons verified is false
// }
// ---------------------------------------------------------------------
function verifyBasket(input) {
  const args = input || {};
  const expected = args.expected;
  const actual = args.actual;

  if (!expected || typeof expected !== 'object') {
    fail('an `expected` execution packet is required (with expected_distinct_products, ' +
         'expected_total_units and lines)');
  }
  if (!actual || typeof actual !== 'object') {
    fail('an `actual` captured basket is required (with lines). A missing capture is NOT an empty ' +
         'basket, and must never be verified as one.');
  }

  const expectedLines = readExpectedLines(expected);
  const actualLines = readActualLines(actual);

  // ---- the per-line comparison: identity AND quantity ---------------------
  const lines = expectedLines.map(function (e) {
    const found = claim(e, actualLines);

    const base = {
      seq: e.seq,
      canonical_product_id: e.canonical_product_id,
      canonical_product_name: e.canonical_product_name,
      asda_product_ref: e.asda_product_ref,
      original_list_line: e.original_list_line,
      expected_quantity: e.required_quantity,
      actual_quantity: null,
      matched_on: found.matched_on,
      actual_product_name: null,
      outcome: 'missing',
      note: null
    };

    if (found.actual === null) {
      return Object.assign(base, {
        note: 'expected in the basket and not found. Nothing was substituted for it.'
      });
    }

    const a = found.actual;
    const out = Object.assign(base, {
      actual_quantity: a.quantity,
      actual_product_name: a.product_name
    });

    // Precedence: an unavailable line is a fact about obtainability that
    // outranks its quantity - "3 of a thing you cannot have" is not a quantity
    // problem. Nothing is ever substituted for it.
    if (a.unavailable) {
      return Object.assign(out, {
        outcome: 'unavailable',
        note: 'ASDA showed this as unobtainable. It must NOT be substituted; Warwick decides.'
      });
    }
    if (a.quantity !== e.required_quantity) {
      return Object.assign(out, {
        outcome: 'quantity_mismatch',
        note: 'expected ' + e.required_quantity + ', basket holds ' + a.quantity + '.'
      });
    }
    return Object.assign(out, { outcome: 'present' });
  });

  // ---- basket lines nobody expected --------------------------------------
  const unexpected = actualLines
    .filter(function (a) { return a.claimed_by === null; })
    .map(function (a) {
      return {
        product_name: a.product_name,
        asda_product_ref: a.asda_product_ref,
        canonical_product_id: a.canonical_product_id,
        quantity: a.quantity,
        outcome: UNEXPECTED,
        note: 'in the basket and on no packet line. Deliberately NOT called an addition: ' +
              'we do not know whether it was added off-plan or mis-captured.'
      };
    });

  // ---- headline arithmetic: reported, never trusted -----------------------
  const declaredDistinct = expected.expected_distinct_products;
  const declaredUnits = expected.expected_total_units;

  const expectedDistinct = expectedLines.length;
  const expectedUnits = expectedLines.reduce(function (n, e) { return n + e.required_quantity; }, 0);
  const actualDistinct = actualLines.length;
  const actualUnits = actualLines.reduce(function (n, a) { return n + a.quantity; }, 0);

  const headline = {
    expected_distinct_products: expectedDistinct,
    actual_distinct_products: actualDistinct,
    expected_total_units: expectedUnits,
    actual_total_units: actualUnits,
    declared_distinct_products: declaredDistinct === undefined ? null : declaredDistinct,
    declared_total_units: declaredUnits === undefined ? null : declaredUnits
  };

  const countsMatch = expectedDistinct === actualDistinct && expectedUnits === actualUnits;

  // A packet whose declared counts disagree with its own lines is a defect in
  // the PRODUCER, and would otherwise be blamed on the basket.
  const packetSelfConsistent =
    (declaredDistinct === undefined || declaredDistinct === null || declaredDistinct === expectedDistinct) &&
    (declaredUnits === undefined || declaredUnits === null || declaredUnits === expectedUnits);

  // ---- the sort contract: asserted rather than trusted --------------------
  const sortContractOk = expected.sort_contract === undefined || expected.sort_contract === null
    ? null
    : (expected.sort_contract === EXPECTED_SORT_CONTRACT && isSorted(expectedLines));

  // ---- the verdict: FROM THE LINES ---------------------------------------
  const summary = { present: 0, quantity_mismatch: 0, unavailable: 0, missing: 0, unexpected: unexpected.length };
  lines.forEach(function (l) { summary[l.outcome] += 1; });

  const blocking = [];
  if (summary.missing > 0) blocking.push(summary.missing + ' expected product(s) missing from the basket');
  if (summary.quantity_mismatch > 0) blocking.push(summary.quantity_mismatch + ' product(s) at the wrong quantity');
  if (summary.unavailable > 0) blocking.push(summary.unavailable + ' product(s) unavailable and awaiting Warwick');
  if (summary.unexpected > 0) blocking.push(summary.unexpected + ' basket line(s) on no packet line');
  if (packetSelfConsistent === false) blocking.push('the packet\'s declared counts disagree with its own lines');

  return {
    // THE gate. Derived from the lines only: a headline match can never
    // produce a true here on a basket whose contents are wrong.
    verified: blocking.length === 0,
    // The headline. Reported because it is useful, separated because it is weak.
    counts_match: countsMatch,
    headline: headline,
    packet_self_consistent: packetSelfConsistent,
    sort_contract_ok: sortContractOk,
    lines: lines,
    unexpected: unexpected,
    summary: summary,
    blocking: blocking
  };
}

// Is the packet actually in the order it declares? Brand A-Z then canonical
// product name A-Z, both on the normalised values. A null brand sorts last,
// per the schema's own note.
function isSorted(expectedLines) {
  for (let i = 1; i < expectedLines.length; i++) {
    if (compareLines(expectedLines[i - 1], expectedLines[i]) > 0) return false;
  }
  return true;
}

function compareLines(a, b) {
  const brandA = a.normalized_brand === '' ? null : a.normalized_brand;
  const brandB = b.normalized_brand === '' ? null : b.normalized_brand;
  if (brandA === null && brandB !== null) return 1;    // null brand sorts last
  if (brandA !== null && brandB === null) return -1;
  if (brandA !== null && brandB !== null && brandA !== brandB) return brandA < brandB ? -1 : 1;
  const nameA = normaliseTerm(a.canonical_product_name);
  const nameB = normaliseTerm(b.canonical_product_name);
  if (nameA === nameB) return 0;
  return nameA < nameB ? -1 : 1;
}

module.exports = {
  verifyBasket: verifyBasket,
  OUTCOMES: OUTCOMES,
  UNEXPECTED: UNEXPECTED,
  MATCH_BASES: MATCH_BASES,
  EXPECTED_SORT_CONTRACT: EXPECTED_SORT_CONTRACT,
  _internal: {
    normaliseTerm: normaliseTerm,
    readExpectedLines: readExpectedLines,
    readActualLines: readActualLines,
    claim: claim,
    isSorted: isSorted,
    compareLines: compareLines
  }
};
