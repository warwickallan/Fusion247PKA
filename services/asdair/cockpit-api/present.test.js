// BUILD-015 - cockpit-api/present.test.js
//
// The two presentation rules the cockpit exists to keep. Offline, no DB.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const P = require('./present');

test('an unknown COUNT reads as "unknown" and never as 0', () => {
  assert.equal(P.count(null), 'unknown');
  assert.equal(P.count(undefined), 'unknown');
  assert.equal(P.count(''), 'unknown');
  assert.equal(P.count('   '), 'unknown');
  assert.equal(P.count(NaN), 'unknown');
  assert.equal(P.count('not a number'), 'unknown');
  // A boolean is not a count - true must never print as "1".
  assert.equal(P.count(true), 'unknown');
});

test('a REAL zero still reads as 0 - "unknown" must not swallow a measured result', () => {
  assert.equal(P.count(0), '0');
  assert.equal(P.count('0'), '0');
  assert.equal(P.count(12), '12');
});

test('an unknown text/date/boolean/confidence all read as "unknown"', () => {
  assert.equal(P.text(null), 'unknown');
  assert.equal(P.text(''), 'unknown');
  assert.equal(P.when(null), 'unknown');
  assert.equal(P.when('not-a-date'), 'unknown');
  assert.equal(P.bool(null), 'unknown');
  assert.equal(P.bool(false), 'no');
  assert.equal(P.bool(true), 'yes');
  assert.equal(P.confidence(null), 'unknown');
  assert.equal(P.confidence(0.82), '82%');
  // 0 confidence is a real measurement, not a missing one.
  assert.equal(P.confidence(0), '0%');
});

test('a STATED price is presented as an ASDA figure', () => {
  const m = P.money({ amount: 12.5, currency: 'GBP', basis: 'stated', source: 'order_confirmation' });
  assert.equal(m.known, true);
  assert.equal(m.basis, 'stated');
  assert.equal(m.is_asda_quoted, true);
  assert.equal(m.display, '12.50 GBP');
});

test('a DERIVED price is NEVER presented as a stated/ASDA-quoted value', () => {
  const derived = P.money({ amount: 12.5, currency: 'GBP', basis: 'derived', source: 'browser_progress' });
  const stated = P.money({ amount: 12.5, currency: 'GBP', basis: 'stated', source: 'order_confirmation' });

  assert.equal(derived.is_asda_quoted, false);
  assert.notEqual(derived.display, stated.display, 'a derived amount must not render identically to a stated one');
  assert.match(derived.display, /inferred/i);
  assert.match(derived.basis_label, /NOT an ASDA-quoted price/);
  assert.doesNotMatch(derived.display, /ASDA stated/i);
});

test('a bare number carries NO basis, so it degrades to unknown-basis - never to stated', () => {
  const m = P.money(41.99);
  assert.equal(m.known, true);
  assert.equal(m.basis, 'unknown');
  assert.equal(m.is_asda_quoted, false);
  assert.match(m.display, /basis unknown/);
});

test('an unrecognised basis string can never become "stated"', () => {
  const m = P.money({ amount: 5, basis: 'asda_says_honestly' });
  assert.equal(m.basis, 'unknown');
  assert.equal(m.is_asda_quoted, false);
});

test('a missing amount is "unknown", not 0.00', () => {
  [null, undefined, { amount: null, basis: 'stated' }, { amount: '', basis: 'stated' }].forEach((v) => {
    const m = P.money(v);
    assert.equal(m.known, false);
    assert.equal(m.display, 'unknown');
    assert.equal(m.is_asda_quoted, false);
  });
});

test('lineMoney carries the column basis through, including "unknown"', () => {
  assert.equal(P.lineMoney(3.2, 'stated').is_asda_quoted, true);
  assert.equal(P.lineMoney(3.2, 'derived').is_asda_quoted, false);
  assert.equal(P.lineMoney(3.2, 'unknown').is_asda_quoted, false);
  assert.equal(P.lineMoney(null, 'stated').display, 'unknown');
});
