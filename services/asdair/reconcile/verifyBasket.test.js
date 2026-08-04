// =====================================================================
// BUILD-015 AsdAIr - the PRE-HANDOVER basket check: verifyBasket.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented ASDA refs, "Widget"-style names). ZERO
// real household data. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE. verifyBasket is pure.
//
// THE HEADLINE TEST IN THIS FILE is "a matching headline count does not verify
// a wrong basket" - that is the requirement CANONICAL-WEEKLY-SHOP-PROCESS.md
// section G states in exactly those words, and it is the reason this module
// reports `verified` and `counts_match` as two separate values.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyBasket, EXPECTED_SORT_CONTRACT } = require('./verifyBasket');

// A three-line packet, correctly sorted brand A-Z then product A-Z.
function packet(overrides) {
  return Object.assign({
    packet_version: 1,
    shop_ref: 'shop-2026-08-10',
    sort_contract: EXPECTED_SORT_CONTRACT,
    expected_distinct_products: 3,
    expected_total_units: 6,
    lines: [
      {
        seq: 1,
        original_list_line: 'arla milk',
        canonical_product_id: 109,
        canonical_product_name: 'Arla Semi Skimmed Milk 4pt',
        brand: 'Arla',
        asda_product_ref: '910000000002',
        required_quantity: 2,
        origin: 'known',
        source_view: 'regulars'
      },
      {
        seq: 2,
        original_list_line: 'bottle azzera coffee',
        canonical_product_id: 108,
        canonical_product_name: 'Widget Azzera Instant 100g',
        brand: 'Widget',
        asda_product_ref: '910000000001',
        required_quantity: 1,
        origin: 'known',
        source_view: 'regulars'
      },
      {
        seq: 3,
        original_list_line: 'them choc yazoos',
        canonical_product_id: null,
        canonical_product_name: 'Widget Chocolate Milk Drink 400ml',
        brand: 'Widget',
        asda_product_ref: '910000000003',
        required_quantity: 3,
        origin: 'new_approved',
        source_view: 'search',
        approved_search_term: 'widget chocolate milk 400ml'
      }
    ]
  }, overrides || {});
}

// The basket that exactly satisfies that packet.
function perfectBasket() {
  return {
    captured_at: '2026-08-10T11:00:00.000Z',
    lines: [
      { asda_product_ref: '910000000002', canonical_product_id: 109, product_name: 'Arla Semi Skimmed Milk 4pt', quantity: 2 },
      { asda_product_ref: '910000000001', canonical_product_id: 108, product_name: 'Widget Azzera Instant 100g', quantity: 1 },
      { asda_product_ref: '910000000003', canonical_product_id: null, product_name: 'Widget Chocolate Milk Drink 400ml', quantity: 3 }
    ]
  };
}

// =====================================================================
// 1. THE REQUIREMENT: a matching headline count is NOT sufficient
// =====================================================================

test('THE RULE: identical headline counts do NOT verify a basket holding the WRONG PRODUCT', function () {
  const actual = perfectBasket();
  // Swap the coffee for something else entirely. Same distinct count (3), same
  // total units (6). A headline check passes this basket. It must not verify.
  actual.lines[1] = {
    asda_product_ref: '910000000099',
    canonical_product_id: 999,
    product_name: 'Widget Decaf Granules 200g',
    quantity: 1
  };

  const report = verifyBasket({ expected: packet(), actual: actual });

  assert.equal(report.counts_match, true, 'the headline arithmetic genuinely does agree');
  assert.equal(report.verified, false, 'and it must NOT be enough to hand over');
  assert.equal(report.summary.missing, 1);
  assert.equal(report.summary.unexpected, 1);
  assert.equal(report.lines[1].outcome, 'missing');
  assert.equal(report.unexpected[0].product_name, 'Widget Decaf Granules 200g');
});

test('THE RULE: identical headline counts do NOT verify a basket with the WRONG QUANTITIES', function () {
  const actual = perfectBasket();
  // Move one unit from the milk to the yazoos. Distinct = 3, units = 6, both
  // exactly as expected. Two lines are wrong.
  actual.lines[0].quantity = 1;
  actual.lines[2].quantity = 4;

  const report = verifyBasket({ expected: packet(), actual: actual });

  assert.equal(report.counts_match, true);
  assert.equal(report.verified, false);
  assert.equal(report.summary.quantity_mismatch, 2);
  assert.equal(report.lines[0].outcome, 'quantity_mismatch');
  assert.equal(report.lines[0].expected_quantity, 2);
  assert.equal(report.lines[0].actual_quantity, 1);
  assert.equal(report.lines[2].outcome, 'quantity_mismatch');
});

test('MUTATION CONTROL: a verdict taken from the counts would pass both wrong baskets', function () {
  // Proves the two tests above are not vacuous: the naive check they exist to
  // replace really does return true on both.
  const wrongProduct = perfectBasket();
  wrongProduct.lines[1] = { asda_product_ref: '910000000099', product_name: 'Widget Decaf Granules 200g', quantity: 1 };
  const wrongQty = perfectBasket();
  wrongQty.lines[0].quantity = 1;
  wrongQty.lines[2].quantity = 4;

  [wrongProduct, wrongQty].forEach(function (actual) {
    const report = verifyBasket({ expected: packet(), actual: actual });
    assert.equal(report.counts_match, true, 'the naive headline verdict passes this basket');
    assert.equal(report.verified, false, 'the real verdict must not');
  });
});

// =====================================================================
// 2. The happy path
// =====================================================================

test('a basket that matches the packet exactly is verified', function () {
  const report = verifyBasket({ expected: packet(), actual: perfectBasket() });

  assert.equal(report.verified, true);
  assert.equal(report.counts_match, true);
  assert.deepEqual(report.blocking, []);
  assert.equal(report.summary.present, 3);
  assert.equal(report.summary.missing, 0);
  assert.equal(report.summary.unexpected, 0);
  assert.equal(report.headline.expected_total_units, 6);
  assert.equal(report.headline.actual_total_units, 6);
});

test('every expected line gets exactly one outcome, and the report is per line', function () {
  const report = verifyBasket({ expected: packet(), actual: perfectBasket() });
  assert.equal(report.lines.length, 3);
  report.lines.forEach(function (line) {
    assert.ok(['present', 'quantity_mismatch', 'unavailable', 'missing'].indexOf(line.outcome) !== -1);
    assert.equal(typeof line.canonical_product_name, 'string');
    assert.equal(typeof line.expected_quantity, 'number');
  });
});

// =====================================================================
// 3. Identity matching, strongest first
// =====================================================================

test('identity matches on the ASDA product reference before anything else', function () {
  const actual = perfectBasket();
  // Same ref, a completely different display name: the ref is the identity.
  actual.lines[1].product_name = 'WIDGET AZZERA INSTANT COFFEE 100 G';
  const report = verifyBasket({ expected: packet(), actual: actual });

  assert.equal(report.lines[1].outcome, 'present');
  assert.equal(report.lines[1].matched_on, 'asda_product_ref');
});

test('a line with no ASDA ref falls back to the canonical id, and says so', function () {
  const p = packet();
  p.lines[1].asda_product_ref = null;
  const actual = perfectBasket();
  actual.lines[1].asda_product_ref = null;

  const report = verifyBasket({ expected: p, actual: actual });
  assert.equal(report.lines[1].outcome, 'present');
  assert.equal(report.lines[1].matched_on, 'canonical_product_id');
});

test('a name-only match still reconciles but is REPORTED as the weakest identity', function () {
  const p = packet();
  p.lines[1].asda_product_ref = null;
  p.lines[1].canonical_product_id = null;
  const actual = perfectBasket();
  actual.lines[1].asda_product_ref = null;
  actual.lines[1].canonical_product_id = null;

  const report = verifyBasket({ expected: p, actual: actual });
  assert.equal(report.lines[1].outcome, 'present');
  assert.equal(report.lines[1].matched_on, 'name',
    'a reviewer must be able to see which lines rest on a name match');
});

test('name matching uses the planner normalisation, so case and spacing do not matter', function () {
  const p = packet();
  p.lines[1].asda_product_ref = null;
  p.lines[1].canonical_product_id = null;
  const actual = perfectBasket();
  actual.lines[1].asda_product_ref = null;
  actual.lines[1].canonical_product_id = null;
  actual.lines[1].product_name = '  widget   AZZERA instant 100g ';

  const report = verifyBasket({ expected: p, actual: actual });
  assert.equal(report.lines[1].outcome, 'present');
});

test('one basket line can be claimed by at most ONE expected line', function () {
  // Two packet lines naming the same product must not both report present off
  // a single basket line - that would hide a real omission.
  const p = packet();
  p.lines[2] = Object.assign({}, p.lines[1], { seq: 3, required_quantity: 1 });
  p.expected_distinct_products = 3;
  p.expected_total_units = 4;

  const actual = { lines: [perfectBasket().lines[0], perfectBasket().lines[1]] };
  const report = verifyBasket({ expected: p, actual: actual });

  assert.equal(report.summary.present, 2);
  assert.equal(report.summary.missing, 1, 'the second claim on one basket line must fail');
  assert.equal(report.verified, false);
});

// =====================================================================
// 4. Unavailable and unexpected
// =====================================================================

test('an unavailable product blocks the handover and is never substituted', function () {
  const actual = perfectBasket();
  actual.lines[2].unavailable = true;

  const report = verifyBasket({ expected: packet(), actual: actual });
  assert.equal(report.lines[2].outcome, 'unavailable');
  assert.equal(report.verified, false);
  assert.match(report.blocking.join(' '), /unavailable/);
  assert.match(report.lines[2].note, /must NOT be substituted/);
});

test('unavailability outranks a quantity difference on the same line', function () {
  const actual = perfectBasket();
  actual.lines[2].unavailable = true;
  actual.lines[2].quantity = 1;

  const report = verifyBasket({ expected: packet(), actual: actual });
  assert.equal(report.lines[2].outcome, 'unavailable',
    '"1 of a thing you cannot have" is not a quantity problem');
});

test('an unexpected basket line is reported and is deliberately not called an addition', function () {
  const actual = perfectBasket();
  actual.lines.push({ asda_product_ref: '910000000077', product_name: 'Widget Biscuits 300g', quantity: 1 });

  const report = verifyBasket({ expected: packet(), actual: actual });
  assert.equal(report.verified, false);
  assert.equal(report.summary.unexpected, 1);
  assert.equal(report.unexpected[0].outcome, 'unexpected');
  assert.match(report.unexpected[0].note, /do not know whether/);
});

test('a missing product is reported with the original list line, so a human can read it', function () {
  const actual = perfectBasket();
  actual.lines.splice(0, 1);

  const report = verifyBasket({ expected: packet(), actual: actual });
  assert.equal(report.lines[0].outcome, 'missing');
  assert.equal(report.lines[0].original_list_line, 'arla milk');
  assert.equal(report.lines[0].actual_quantity, null);
  assert.equal(report.counts_match, false);
});

// =====================================================================
// 5. The packet is checked too - a producer defect is not a basket defect
// =====================================================================

test('a packet whose declared counts disagree with its own lines is flagged as the packet\'s defect', function () {
  const p = packet({ expected_total_units: 99 });
  const report = verifyBasket({ expected: p, actual: perfectBasket() });

  assert.equal(report.packet_self_consistent, false);
  assert.equal(report.verified, false);
  assert.match(report.blocking.join(' '), /declared counts disagree with its own lines/);
  // ...and every line is still individually correct, which is how a reviewer
  // tells a packet bug from a basket bug.
  assert.equal(report.summary.present, 3);
  assert.equal(report.summary.missing, 0);
});

test('declared counts that agree with the lines are self-consistent', function () {
  const report = verifyBasket({ expected: packet(), actual: perfectBasket() });
  assert.equal(report.packet_self_consistent, true);
  assert.equal(report.headline.declared_distinct_products, 3);
  assert.equal(report.headline.declared_total_units, 6);
});

test('the declared sort contract is ASSERTED, not trusted', function () {
  const good = verifyBasket({ expected: packet(), actual: perfectBasket() });
  assert.equal(good.sort_contract_ok, true);

  const p = packet();
  const swapped = [p.lines[1], p.lines[0], p.lines[2]];   // Widget before Arla
  const bad = verifyBasket({ expected: Object.assign({}, p, { lines: swapped }), actual: perfectBasket() });
  assert.equal(bad.sort_contract_ok, false);
});

test('a packet declaring no sort contract reports null rather than a guess', function () {
  const p = packet();
  delete p.sort_contract;
  const report = verifyBasket({ expected: p, actual: perfectBasket() });
  assert.equal(report.sort_contract_ok, null);
});

// =====================================================================
// 6. Refusals - a missing capture is never an empty basket
// =====================================================================

test('a missing capture is refused, never verified as an empty basket', function () {
  assert.throws(function () {
    verifyBasket({ expected: packet(), actual: null });
  }, /A missing capture is NOT an empty basket/);
});

test('an empty basket is a real, verifiable state and reports every line missing', function () {
  const report = verifyBasket({ expected: packet(), actual: { lines: [] } });
  assert.equal(report.verified, false);
  assert.equal(report.summary.missing, 3);
  assert.equal(report.headline.actual_total_units, 0);
});

test('an empty packet is refused - there is nothing to verify', function () {
  assert.throws(function () {
    verifyBasket({ expected: packet({ lines: [] }), actual: perfectBasket() });
  }, /must not be empty/);
});

test('a quantity is never silently defaulted - this module exists to catch quantity errors', function () {
  assert.throws(function () {
    const actual = perfectBasket();
    actual.lines[0].quantity = 'two';
    verifyBasket({ expected: packet(), actual: actual });
  }, /must be a whole number of items/);

  assert.throws(function () {
    const actual = perfectBasket();
    delete actual.lines[0].quantity;
    verifyBasket({ expected: packet(), actual: actual });
  }, /quantity is required/);
});

test('an actual line with no product name is refused rather than reported as nameless', function () {
  assert.throws(function () {
    const actual = perfectBasket();
    delete actual.lines[0].product_name;
    verifyBasket({ expected: packet(), actual: actual });
  }, /product_name is required/);
});

test('unavailable must be a real boolean when given', function () {
  assert.throws(function () {
    const actual = perfectBasket();
    actual.lines[0].unavailable = 'out of stock';
    verifyBasket({ expected: packet(), actual: actual });
  }, /must be exactly true or false/);
});

// =====================================================================
// 7. Purity
// =====================================================================

test('verifyBasket never mutates its arguments', function () {
  const p = packet();
  const a = perfectBasket();
  const beforeP = JSON.stringify(p);
  const beforeA = JSON.stringify(a);
  verifyBasket({ expected: p, actual: a });
  assert.equal(JSON.stringify(p), beforeP);
  assert.equal(JSON.stringify(a), beforeA);
});

test('identical inputs produce an identical report', function () {
  assert.deepEqual(
    verifyBasket({ expected: packet(), actual: perfectBasket() }),
    verifyBasket({ expected: packet(), actual: perfectBasket() })
  );
});

test('the report is deterministic under a reordered basket', function () {
  const shuffled = perfectBasket();
  shuffled.lines.reverse();
  const a = verifyBasket({ expected: packet(), actual: perfectBasket() });
  const b = verifyBasket({ expected: packet(), actual: shuffled });
  assert.deepEqual(a.lines.map(function (l) { return l.outcome; }),
    b.lines.map(function (l) { return l.outcome; }));
  assert.equal(b.verified, true);
});
