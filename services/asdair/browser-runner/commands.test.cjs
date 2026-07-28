'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const C = require('./commands.cjs');

test('the allowlist is exactly the agreed command surface - nothing more', () => {
  assert.deepStrictEqual(C.ALLOWED, [
    'add_known_product', 'add_to_favourites', 'locate_product', 'open_groceries',
    'open_regulars', 'open_trolley', 'pause', 'read_basket_line_count',
    'read_estimated_total', 'read_quantity', 'report_unavailable', 'resume',
    'search', 'select_search_result', 'set_quantity', 'stop_at_basket_ready',
  ]);
});

test('only four commands can change the trolley', () => {
  const writers = C.ALLOWED.filter((n) => C.COMMANDS[n].kind === 'write');
  assert.deepStrictEqual(writers.sort(), ['add_known_product', 'add_to_favourites', 'select_search_result', 'set_quantity']);
});

test('anything off the allowlist is refused, by name', () => {
  for (const bad of ['checkout', 'pay', 'book_slot', 'enter_password', 'enable_substitutions', 'accept_substitute', '', null, 42, '__proto__', 'constructor']) {
    assert.throws(() => C.assertAllowed(bad), /not on the allowlist/, `should refuse ${JSON.stringify(bad)}`);
  }
});

test('product references must be ASDA numeric ids', () => {
  assert.strictEqual(C.normaliseProductRef(' 489747 '), '489747');
  for (const bad of ['../../etc', '48', 'abc', '489747; drop table', '', null, '1e9']) {
    assert.throws(() => C.normaliseProductRef(bad), /not an ASDA product reference/);
  }
});

test('search terms cannot shape a URL', () => {
  assert.strictEqual(C.normaliseTerm('  mixed   herbs '), 'mixed herbs');
  for (const bad of ['../trolley', 'a/b', 'x?y=1', 'a#b', '<script>', '', 'x'.repeat(81)]) {
    assert.throws(() => C.normaliseTerm(bad));
  }
});

test('quantities are bounded small integers', () => {
  assert.strictEqual(C.normaliseQty('3'), 3);
  assert.strictEqual(C.normaliseQty(0), 0);
  for (const bad of [-1, 25, 1.5, 'x', null, Infinity]) assert.throws(() => C.normaliseQty(bad), /quantity out of range/);
});

test('a step without a step_id is refused - the idempotency key is not optional', () => {
  assert.throws(() => C.validateStep({ command: 'add_known_product', product_ref: '489747' }), /step_id is required/);
});

test('a plan with duplicate step ids is refused up front', () => {
  const plan = [
    { step_id: 's1', command: 'add_known_product', product_ref: '489747' },
    { step_id: 's1', command: 'add_known_product', product_ref: '544334' },
  ];
  assert.throws(() => C.validatePlan(plan), /duplicate step_id/);
});

test('a plan naming a forbidden command fails validation, not execution', () => {
  assert.throws(() => C.validatePlan([{ step_id: 's1', command: 'checkout' }]), /not on the allowlist/);
});

test('validateStep returns only canonical fields - no arbitrary payload survives', () => {
  const s = C.validateStep({ step_id: 's1', command: 'add_known_product', product_ref: '489747', name: 'Milk', origin: 'regular', evil: 'x' });
  assert.deepStrictEqual(Object.keys(s).sort(), ['command', 'kind', 'name', 'origin', 'product_ref', 'step_id']);
});
