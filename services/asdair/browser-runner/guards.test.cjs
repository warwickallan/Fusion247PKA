'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const G = require('./guards.cjs');

test('the navigation allowlist admits exactly the six permitted surfaces', () => {
  const ok = [
    'https://www.asda.com/',
    'https://www.asda.com/groceries',
    'https://www.asda.com/groceries/trolley',
    'https://www.asda.com/groceries/product/489747',
    'https://www.asda.com/groceries/product/semi-skimmed-milk/cravendale/489747',
    'https://www.asda.com/groceries/search/mixed%20herbs',
    'https://www.asda.com/groceries/favourites-lists/regulars',
  ];
  for (const u of ok) assert.strictEqual(G.assertPermittedUrl(u), u, `should permit ${u}`);
});

test('there is no reachable URL for any forbidden surface', () => {
  const denied = [
    'https://www.asda.com/groceries/checkout',
    'https://www.asda.com/checkout/payment',
    'https://www.asda.com/groceries/booking/slots',
    'https://www.asda.com/groceries/delivery-slots',
    'https://login.asda.com/shopper/authorise',
    'https://www.asda.com/account/payment-cards',
    'http://www.asda.com/groceries/trolley',
    'https://evil.example.com/groceries/trolley',
    'https://www.asda.com.evil.example/groceries/trolley',
    'https://www.asda.com/groceries/trolley/../checkout',
    'javascript:alert(1)',
  ];
  for (const u of denied) assert.throws(() => G.assertPermittedUrl(u), /not on the navigation allowlist/, `should refuse ${u}`);
});

test('the click deny-list refuses every forbidden control by its accessible name', () => {
  const labels = [
    'Checkout', 'Check out', 'Proceed to checkout', 'Proceed to payment',
    'Place your order', 'Pay now', 'Payment method', 'Card number', 'CVV',
    'Billing address', 'Sign in', 'Log in', 'Password',
    'Book a delivery slot', 'Change slot', 'Delivery slot', 'Reserve slot',
    'Allow substitutions', 'Enable substitutions', 'Accept this replacement',
  ];
  for (const l of labels) assert.throws(() => G.assertSafeTarget(l), /forbidden vocabulary/, `should refuse "${l}"`);
});

test('the deny-list still admits the controls the runner legitimately needs', () => {
  for (const l of ['Add', 'Add item Cravendale to cart', 'Increase Cravendale Milk 2L', 'Decrease Cravendale Milk 2L', 'Remove Cravendale Milk 2L', 'Add to Favourites', 'Trolley']) {
    assert.strictEqual(G.assertSafeTarget(l), l, `should permit "${l}"`);
  }
});

test('the runner may never issue a CDP Input method - that is what makes typing impossible', () => {
  for (const m of ['Input.dispatchKeyEvent', 'Input.insertText', 'Input.dispatchMouseEvent', 'Input.imeSetComposition']) {
    assert.throws(() => G.assertSafeCdpMethod(m), /never synthesises input/, `should refuse ${m}`);
  }
  for (const m of ['Page.navigate', 'Runtime.evaluate', 'Page.enable', 'Runtime.enable']) {
    assert.strictEqual(G.assertSafeCdpMethod(m), m);
  }
});

test('an authentication surface is recognised however it arrives', () => {
  assert.ok(G.looksLikeAuthSurface({ url: 'https://login.asda.com/shopper/authorise?x=1' }));
  assert.ok(G.looksLikeAuthSurface({ url: 'https://www.asda.com/signin' }));
  assert.ok(G.looksLikeAuthSurface({ url: 'https://www.asda.com/x', text: 'Sign in to your ASDA account' }));
  assert.ok(!G.looksLikeAuthSurface({ url: 'https://www.asda.com/groceries/trolley', title: 'Trolley - ASDA Groceries' }));
});

test('the in-page deny regex is generated from the same source as the Node one', () => {
  const literal = G.inPageDenyRegexLiteral();
  assert.match(literal, /^new RegExp\(/);
  const rebuilt = eval(literal); // eslint-disable-line no-eval
  assert.strictEqual(rebuilt.source, G.DENY_TARGET.source);
  assert.ok(rebuilt.test('Proceed to checkout'));
  assert.ok(!rebuilt.test('Increase Cravendale Milk 2L'));
});
