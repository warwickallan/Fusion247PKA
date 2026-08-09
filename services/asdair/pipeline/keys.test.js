// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - keys.test.js
//
// Runs under: node --test
//
// THE ROUND-1 QUESTION KEY IS PINNED TO A LITERAL HELD IN THIS FILE.
//
// Three live shops carry asdair.shop_question rows keyed by the original
// one-argument derivation. If that derivation shifts by a single byte, every
// open question is orphaned - ON CONFLICT (shop_id, question_key) stops
// recognising it - and every settled question is re-asked. There is no error
// and no crash; Warwick is simply asked again on Sunday.
//
// So the expected values below are LITERALS, computed once and written down.
// They are deliberately NOT computed by calling digest() here: a test that
// derives its expectation from the same code it is testing proves only that
// the code is self-consistent, and would happily follow the implementation to
// a new value while still passing. That is the whole point of a pin.
//
// PURE ASCII. No database, no network.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { questionKeyFor, normaliseTerm, digest, QUESTION_KEY_BYTES } from './keys.js';
import { FIELD_RE, MAX_QUESTION_KEY_BYTES } from '../bot/callbackProtocol.js';

// ---------------------------------------------------------------------
// THE PIN. Do not regenerate these by running the code.
// ---------------------------------------------------------------------
// Derived by executing keys.js AS COMMITTED AT d907350 - the head this Work
// Package started from, and the derivation the three live shops' rows were
// written under - and then written down here by hand. The provenance matters:
// they are the HISTORIC values, captured before this file's change, not a
// snapshot of whatever the code does now.
const ROUND_1_PINNED = Object.freeze({
  'fruit splits': 'q80e5fa82',
  'Ariel Pods': 'q549c765f',
  'gourmet cat food': 'q734603ae',
});

test('ROUND 1 IS PINNED: the historic derivation is byte-for-byte unchanged', () => {
  for (const [itemName, expected] of Object.entries(ROUND_1_PINNED)) {
    assert.equal(questionKeyFor(itemName), expected,
      `the round-1 key for "${itemName}" MOVED. Three live shops carry rows on the old value; `
      + 'changing it orphans every open question and re-asks every settled one.');
  }
});

test('ROUND 1 is reached identically by the 1-argument call and by an explicit round of 1', () => {
  // The one-argument call path is what every existing caller uses, and it must
  // not acquire a different meaning by gaining a defaulted parameter.
  for (const itemName of Object.keys(ROUND_1_PINNED)) {
    assert.equal(questionKeyFor(itemName), questionKeyFor(itemName, 1));
  }
});

test('ROUND 1 does NOT hash the round into the input', () => {
  // The bug this forbids: "simplifying" the branch by always hashing
  // `${term}#${round}`. It looks tidier and silently moves every live key.
  const term = normaliseTerm('fruit splits');
  assert.notEqual(questionKeyFor('fruit splits'), `q${digest(`${term}#1`, 4)}`,
    'round 1 must NOT be derived as term#1 - that is a different digest and a different live key');
  assert.equal(questionKeyFor('fruit splits'), `q${digest(term, 4)}`);
});

test('a clarification round produces a DIFFERENT key from its parent, and from every other round', () => {
  const seen = new Set();
  for (let round = 1; round <= 12; round += 1) {
    const key = questionKeyFor('fruit splits', round);
    assert.equal(seen.has(key), false, `round ${round} collided with an earlier round`);
    seen.add(key);
  }
  assert.equal(seen.size, 12);
});

test('EVERY round stays inside the callback protocol budget - including round 10 and beyond', () => {
  // The `#clarify.N` scheme this replaced survived rounds 2-9 and broke at 10,
  // because `.c10` is 13 bytes against a 12-byte ceiling. A scheme that fails
  // at a round number is a latent defect, so the boundary is swept rather than
  // spot-checked.
  for (let round = 1; round <= 250; round += 1) {
    const key = questionKeyFor('gourmet cat food', round);
    assert.equal(Buffer.byteLength(key, 'utf8'), QUESTION_KEY_BYTES,
      `round ${round} produced a ${Buffer.byteLength(key, 'utf8')}-byte key`);
    assert.ok(Buffer.byteLength(key, 'utf8') <= MAX_QUESTION_KEY_BYTES,
      `round ${round} exceeds MAX_QUESTION_KEY_BYTES`);
    assert.match(key, FIELD_RE,
      `round ${round} produced a key the callback wire format would refuse: ${key}`);
  }
});

test('the round-N key never contains the # that separates its hash input', () => {
  // `#` is illegal in FIELD_RE and buildCallbackData THROWS rather than
  // truncating, so a `#` reaching the output is an unrenderable card.
  for (let round = 2; round <= 20; round += 1) {
    assert.equal(questionKeyFor('Ariel Pods', round).includes('#'), false);
  }
});

test('a round below 1, or a non-integer round, is refused rather than coerced', () => {
  for (const bad of [0, -1, 1.5, 'two', NaN]) {
    assert.throws(() => questionKeyFor('fruit splits', bad), /round must be an integer/,
      `round ${String(bad)} must be refused`);
  }
});

test('an unreadable line still cannot be asked about by name, at any round', () => {
  for (const round of [1, 2, 7]) {
    assert.throws(() => questionKeyFor('   ', round), /non-empty item name/);
  }
});
