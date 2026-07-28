// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: parseConfirmation.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (see fixtures.js). ZERO real household data. This
// file runs in CI on the PUBLIC repo.
//
// NO DATABASE, NO NETWORK, NO CREDENTIALS. parseConfirmation is pure, so every
// one of these tests is arithmetic over a string.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseConfirmation,
  deriveMissingPrice,
  formatLinePrice,
  PRICE_BASIS
} = require('./parseConfirmation');

const F = require('./fixtures');
const P = F.P;

// ---------------------------------------------------------------------
// THE HEADLINE CASE: the real shape of a weekly ASDA confirmation.
// ---------------------------------------------------------------------

test('the messy 32-line confirmation parses to 32 lines, 47 units and GBP 110.75 of STATED prices', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });

  assert.equal(parsed.summary.line_count, F.EXPECTED_LINE_COUNT, '32 distinct product lines');
  assert.equal(parsed.summary.unit_count, F.EXPECTED_UNIT_COUNT, '47 purchased units');
  assert.equal(parsed.summary.stated_line_price_sum, F.EXPECTED_STATED_PRICE_SUM,
    'GBP 110.75 in EXPLICITLY SHOWN line prices');
  assert.equal(parsed.summary.stated_price_line_count, 31);
  assert.equal(parsed.summary.unpriced_line_count, 1);
  assert.equal(parsed.summary.derived_price_line_count, 0);
  assert.equal(parsed.summary.lines_without_quantity, 0);
});

test('every one of the 32 lines carries the exact name, quantity and price ASDA showed', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  assert.equal(parsed.lines.length, F.EXPECTED_LINES.length);
  F.EXPECTED_LINES.forEach(function (expected, i) {
    const line = parsed.lines[i];
    assert.equal(line.line_no, i + 1);
    assert.equal(line.product_name, expected[0], 'line ' + (i + 1) + ' name');
    assert.equal(line.quantity, expected[1], 'line ' + (i + 1) + ' quantity');
    assert.equal(line.line_price, expected[2], 'line ' + (i + 1) + ' price');
    assert.equal(line.price_basis, expected[2] === null ? 'unknown' : 'stated', 'line ' + (i + 1) + ' basis');
  });
});

test('THE CRITICAL RULE: the line with no visible price keeps line_price null and price_basis "unknown"', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const walls = parsed.lines.filter(function (l) { return l.product_name === F.UNPRICED_PRODUCT; });

  assert.equal(walls.length, 1, 'the unpriced product is present as a real line, not dropped');
  assert.equal(walls[0].line_price, null, 'no price was invented');
  assert.equal(walls[0].price_basis, 'unknown');
  assert.equal(walls[0].quantity, 2, 'its quantity WAS shown and is kept');
  assert.equal(formatLinePrice(walls[0]), 'price not shown by ASDA');
});

test('no order total was shown, so stated_total stays null and derivation is never even attempted', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  assert.equal(parsed.stated_total, null);
  assert.equal(parsed.stated_total_basis, 'unknown');
  assert.equal(parsed.derivation.attempted, false);
  assert.equal(parsed.derivation.applied, false);
});

test('headers, footers, the column header row and non-product charges are skipped, never sold as products', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const names = parsed.lines.map(function (l) { return l.product_name.toLowerCase(); });

  ['your asda groceries order', 'order number: 900000000123', 'item qty price',
    'delivery charge', 'total savings', 'thanks for shopping with asda'].forEach(function (junk) {
    assert.ok(names.indexOf(junk) === -1, '"' + junk + '" must not be a product line');
  });

  const reasons = parsed.skipped.map(function (s) { return s.reason; });
  assert.ok(reasons.indexOf('non-product-charge-or-adjustment') !== -1);
  assert.ok(reasons.indexOf('header-footer-or-layout') !== -1);
});

test('a standalone promotion line attaches to the product ABOVE it, and never becomes a line of its own', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const byName = {};
  parsed.lines.forEach(function (l) { byName[l.product_name] = l; });

  assert.equal(byName['ASDA Broccoli 350g'].promotion, 'Rollback');
  assert.equal(byName['Yazoo Strawberry Milkshake 400ml'].promotion, '2 for ' + P + '5');
  assert.equal(byName['Cadbury Dairy Milk 110g'].promotion, 'Save 30p');

  const promoNames = parsed.lines.map(function (l) { return l.product_name; });
  assert.ok(promoNames.indexOf('Rollback') === -1);
  assert.ok(promoNames.indexOf('2 for ' + P + '5') === -1);
});

test('a wrapped product name is rejoined and takes the price from its continuation line', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const persil = parsed.lines.filter(function (l) { return l.product_name.indexOf('Persil') === 0; });
  assert.equal(persil.length, 1, 'the wrap produced ONE line, not two');
  assert.equal(persil[0].product_name, 'Persil Non Bio Washing Liquid 38 Wash');
  assert.equal(persil[0].line_price, 13.50);
  assert.equal(persil[0].price_basis, 'stated');
  assert.equal(persil[0].quantity, 1);
});

test('a product name containing "x" and units is not mangled into a quantity or a price', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  const byName = {};
  parsed.lines.forEach(function (l) { byName[l.product_name] = l; });

  assert.equal(byName['Heinz Baked Beans 4 x 415g'].quantity, 1);
  assert.equal(byName['Heinz Baked Beans 4 x 415g'].line_price, 4.50);
  assert.equal(byName['ASDA Kitchen Foil 30cm x 10m'].quantity, 1);
  assert.equal(byName['ASDA Kitchen Foil 30cm x 10m'].line_price, 1.50);
});

// ---------------------------------------------------------------------
// Price recognition
// ---------------------------------------------------------------------

test('the pound sign, GBP, a bare 2dp amount and pence are all recognised as prices', function () {
  const parsed = parseConfirmation({
    text: [
      '1 x Widget Pound ' + P + '2.50',
      '1 x Widget GBP GBP 3.75',
      '1 x Widget Bare 4.05',
      '1 x Widget Pence 75p',
      '1 x Widget Thousands ' + P + '1,234.56'
    ].join('\n')
  });
  assert.deepEqual(parsed.lines.map(function (l) { return l.line_price; }), [2.50, 3.75, 4.05, 0.75, 1234.56]);
  parsed.lines.forEach(function (l) { assert.equal(l.price_basis, 'stated'); });
});

test('a bare integer at the end of a line is a pack count, NOT a price, and never becomes one', function () {
  const parsed = parseConfirmation({ text: '2 x ASDA Eggs Box Of 12\n1 x ASDA Batteries AA 4' });
  assert.equal(parsed.lines.length, 2);
  parsed.lines.forEach(function (l) {
    assert.equal(l.line_price, null, 'no price was invented from "' + l.product_name + '"');
    assert.equal(l.price_basis, 'unknown');
  });
});

test('a quantity that was never shown stays null - it is never assumed to be 1', function () {
  const parsed = parseConfirmation({ text: 'Generic Widget Deluxe 500g ' + P + '2.99' });
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.lines[0].quantity, null);
  assert.equal(parsed.summary.lines_without_quantity, 1);
  assert.equal(parsed.summary.unit_count, 0, 'unknown quantities contribute nothing rather than a guessed 1');
});

test('"Qty: N" and a trailing "xN" are both read as quantities', function () {
  const a = parseConfirmation({ text: 'Generic Widget A 500g Qty: 3 ' + P + '2.00' });
  assert.equal(a.lines[0].quantity, 3);
  assert.equal(a.lines[0].line_price, 2.00);

  const b = parseConfirmation({ text: 'Generic Widget B 500g x 4 ' + P + '2.00' });
  assert.equal(b.lines[0].quantity, 4);
  assert.equal(b.lines[0].product_name, 'Generic Widget B 500g');
});

// ---------------------------------------------------------------------
// The order total
// ---------------------------------------------------------------------

test('an authoritative order total is captured; a subtotal, savings or delivery line is not', function () {
  const parsed = parseConfirmation({
    text: [
      '1 x Generic Widget A ' + P + '5.00',
      'Subtotal ' + P + '5.00',
      'Delivery charge ' + P + '4.50',
      'Total savings ' + P + '1.00',
      'Order total ' + P + '9.50'
    ].join('\n')
  });
  assert.equal(parsed.stated_total, 9.50);
  assert.equal(parsed.stated_total_basis, 'stated');
  assert.equal(parsed.lines.length, 1, 'none of the money furniture became a product');
});

test('two DIFFERENT order totals leave stated_total null with a warning, rather than one being chosen', function () {
  const parsed = parseConfirmation({
    text: [
      '1 x Generic Widget A ' + P + '5.00',
      'Order total ' + P + '9.50',
      'Total to pay ' + P + '11.00'
    ].join('\n')
  });
  assert.equal(parsed.stated_total, null);
  assert.equal(parsed.stated_total_basis, 'unknown');
  assert.ok(parsed.warnings.some(function (w) { return /conflict|DIFFERENT/i.test(w); }));
});

// ---------------------------------------------------------------------
// DERIVATION - the only path that may put an unstated number in a price
// ---------------------------------------------------------------------

test('the derived-price path fills the missing line AND labels it "derived", never "stated"', function () {
  const parsed = parseConfirmation({ text: F.DERIVABLE_CONFIRMATION_TEXT, derive_single_missing_price: true });

  assert.equal(parsed.derivation.attempted, true);
  assert.equal(parsed.derivation.applied, true);
  assert.deepEqual(parsed.derivation.blocked_reasons, []);

  const derived = parsed.lines.filter(function (l) { return l.price_basis === 'derived'; });
  assert.equal(derived.length, 1);
  assert.equal(derived[0].product_name, 'Generic Widget B 250g');
  assert.equal(derived[0].line_price, 3.50, '8.50 stated total - 5.00 of stated line prices');
  assert.match(derived[0].note, /DERIVED by subtraction/);
  assert.match(derived[0].note, /NOT an ASDA-quoted price/);

  assert.equal(parsed.summary.stated_line_price_sum, 5.00, 'the derived amount is NOT folded into the stated sum');
  assert.equal(parsed.summary.derived_line_price_sum, 3.50);
});

test('a DERIVED price can never be emitted as a STATED one', function () {
  const parsed = parseConfirmation({ text: F.DERIVABLE_CONFIRMATION_TEXT, derive_single_missing_price: true });
  const derived = parsed.lines.filter(function (l) { return l.price_basis === 'derived'; })[0];
  const stated = parsed.lines.filter(function (l) { return l.price_basis === 'stated'; })[0];

  // 1. The rendered forms are different strings, and the derived one says so.
  const derivedText = formatLinePrice(derived);
  assert.match(derivedText, /DERIVED/);
  assert.match(derivedText, /NOT quoted by ASDA/);
  assert.doesNotMatch(derivedText, /as shown by ASDA/);
  assert.notEqual(derivedText, formatLinePrice(stated));

  // 2. A line with the SAME amount but a stated basis renders differently, so
  //    the distinction lives in the basis and not in the number.
  const sameAmountStated = { line_no: 99, line_price: derived.line_price, price_basis: 'stated' };
  assert.notEqual(formatLinePrice(sameAmountStated), derivedText);

  // 3. The basis cannot be flipped on the emitted object: it is frozen.
  assert.throws(function () { derived.price_basis = 'stated'; }, TypeError);
  assert.equal(derived.price_basis, 'derived');

  // 4. formatLinePrice refuses anything outside the vocabulary rather than
  //    falling through to the stated form.
  assert.throws(function () { formatLinePrice({ line_no: 1, line_price: 1, price_basis: 'quoted' }); },
    /not one of/);
  assert.throws(function () { formatLinePrice({ line_no: 1, line_price: 1, price_basis: 'unknown' }); },
    /claims price_basis "unknown" but carries a price/);
});

test('derivation is REFUSED when the confirmation also shows a delivery charge or a saving', function () {
  const parsed = parseConfirmation({
    text: [
      '2 x Generic Widget A 500g ' + P + '5.00',
      '1 x Generic Widget B 250g',
      'Delivery charge ' + P + '4.50',
      'Order total ' + P + '13.00'
    ].join('\n'),
    derive_single_missing_price: true
  });
  assert.equal(parsed.derivation.applied, false);
  assert.ok(parsed.derivation.blocked_reasons.some(function (r) { return /non-product charge/.test(r); }));
  const b = parsed.lines.filter(function (l) { return l.product_name.indexOf('Widget B') !== -1; })[0];
  assert.equal(b.line_price, null);
  assert.equal(b.price_basis, 'unknown');
});

test('derivation is REFUSED when more than one line is unpriced - a residual cannot be split', function () {
  const parsed = parseConfirmation({
    text: [
      '1 x Generic Widget A ' + P + '5.00',
      '1 x Generic Widget B',
      '1 x Generic Widget C',
      'Order total ' + P + '12.00'
    ].join('\n'),
    derive_single_missing_price: true
  });
  assert.equal(parsed.derivation.applied, false);
  assert.ok(parsed.derivation.blocked_reasons.some(function (r) { return /cannot be split/.test(r); }));
  assert.equal(parsed.summary.unpriced_line_count, 2);
  assert.equal(parsed.summary.derived_price_line_count, 0);
});

test('derivation is REFUSED when there is no ASDA-stated order total to subtract from', function () {
  const parsed = parseConfirmation({
    text: '1 x Generic Widget A ' + P + '5.00\n1 x Generic Widget B',
    derive_single_missing_price: true
  });
  assert.equal(parsed.derivation.applied, false);
  assert.ok(parsed.derivation.blocked_reasons.some(function (r) { return /no authoritative/.test(r); }));
  assert.equal(parsed.lines[1].price_basis, 'unknown');
});

test('derivation is REFUSED when the residual is zero or negative rather than claiming a free item', function () {
  const parsed = parseConfirmation({
    text: [
      '1 x Generic Widget A ' + P + '5.00',
      '1 x Generic Widget B',
      'Order total ' + P + '5.00'
    ].join('\n'),
    derive_single_missing_price: true
  });
  assert.equal(parsed.derivation.applied, false);
  assert.ok(parsed.derivation.blocked_reasons.some(function (r) { return /not strictly positive/.test(r); }));
  assert.equal(parsed.lines[1].line_price, null);
});

test('derivation is never chained on top of an existing derived price', function () {
  const first = parseConfirmation({ text: F.DERIVABLE_CONFIRMATION_TEXT, derive_single_missing_price: true });
  const again = deriveMissingPrice({
    stated_total: first.stated_total,
    stated_total_basis: first.stated_total_basis,
    lines: first.lines.concat([{ line_no: 3, product_name: 'Generic Widget C', quantity: 1, pack_size: null,
      promotion: null, line_price: null, price_basis: 'unknown', note: null, raw: '' }]),
    derivation: { attempted: false, applied: false, blocked_reasons: [] }
  });
  assert.equal(again.derivation.applied, false);
  assert.ok(again.derivation.blocked_reasons.some(function (r) { return /never chained/.test(r); }));
});

test('derivation is OFF by default: the same text without the opt-in leaves the line unknown', function () {
  const off = parseConfirmation({ text: F.DERIVABLE_CONFIRMATION_TEXT });
  assert.equal(off.derivation.attempted, false);
  assert.equal(off.lines[1].line_price, null);
  assert.equal(off.lines[1].price_basis, 'unknown');
});

// ---------------------------------------------------------------------
// Structural guarantees
// ---------------------------------------------------------------------

test('price_basis is a REQUIRED field on every emitted line, always in the CHECK vocabulary', function () {
  [F.MESSY_CONFIRMATION_TEXT, F.SEVEN_OUTCOME_CONFIRMATION_TEXT, F.DERIVABLE_CONFIRMATION_TEXT].forEach(function (t) {
    const parsed = parseConfirmation({ text: t, derive_single_missing_price: true });
    parsed.lines.forEach(function (l) {
      assert.ok(Object.prototype.hasOwnProperty.call(l, 'price_basis'), 'price_basis is present');
      assert.ok(PRICE_BASIS.indexOf(l.price_basis) !== -1, 'price_basis is in the vocabulary');
      if (l.price_basis === 'unknown') assert.equal(l.line_price, null);
      else assert.ok(Number.isFinite(l.line_price));
    });
  });
});

test('the parse result is frozen, so no caller can quietly edit a price or a basis', function () {
  const parsed = parseConfirmation({ text: F.MESSY_CONFIRMATION_TEXT });
  assert.throws(function () { parsed.lines[0].line_price = 999; }, TypeError);
  assert.throws(function () { parsed.stated_total = 999; }, TypeError);
  assert.throws(function () { parsed.lines.push({}); }, TypeError);
  assert.equal(parsed.lines[0].line_price, 3.35);
});

test('parsing is pure: identical input gives an identical result and the input is untouched', function () {
  const text = F.MESSY_CONFIRMATION_TEXT;
  const a = parseConfirmation({ text: text });
  const b = parseConfirmation({ text: text });
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.equal(text, F.MESSY_CONFIRMATION_TEXT);

  const input = { text: text, source_kind: 'text' };
  parseConfirmation(input);
  assert.deepEqual(input, { text: text, source_kind: 'text' });
});

test('CRLF, tab indentation and a uniformly indented paste all parse to the same lines', function () {
  const base = '2 x Generic Widget A 500g ' + P + '5.00\n1 x Generic Widget B 250g ' + P + '2.00';
  const crlf = base.replace(/\n/g, '\r\n');
  const indented = base.split('\n').map(function (l) { return '    ' + l; }).join('\n');

  const a = parseConfirmation({ text: base });
  const b = parseConfirmation({ text: crlf });
  const c = parseConfirmation({ text: indented });

  [b, c].forEach(function (other) {
    assert.deepEqual(
      other.lines.map(function (l) { return [l.product_name, l.quantity, l.line_price, l.price_basis]; }),
      a.lines.map(function (l) { return [l.product_name, l.quantity, l.line_price, l.price_basis]; })
    );
  });
});

test('an unknown source_kind is rejected against the asdair.order_confirmation CHECK vocabulary', function () {
  assert.throws(function () { parseConfirmation({ text: 'x', source_kind: 'voicemail' }); }, /not one of/);
  ['text', 'photo', 'document'].forEach(function (k) {
    assert.equal(parseConfirmation({ text: '1 x Generic Widget ' + P + '1.00', source_kind: k }).source_kind, k);
  });
});

test('an empty confirmation yields zero lines rather than an invented one', function () {
  const parsed = parseConfirmation({ text: '\n\n   \n' });
  assert.equal(parsed.lines.length, 0);
  assert.equal(parsed.summary.stated_line_price_sum, 0);
  assert.equal(parsed.stated_total, null);
});
