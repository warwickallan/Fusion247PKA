// BUILD-015 AsdAIr bot — the message catalogue: unit tests. Fully offline, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGES,
  MAX_BUTTON_LABEL_CHARS,
  UNKNOWN,
  count,
  humanTime,
  labelFor,
  renderBasketReady,
  renderConfirmInterpretation,
  renderConfirmationReceived,
  renderFailure,
  renderPlanReady,
  renderProgress,
  renderQuestionCard,
  renderReceipt,
  renderReconciliationSummary,
  renderStatus,
  value,
} from './renderMessages.js';
import {
  ACTION_VALUES,
  CALLBACK_DATA_MAX_BYTES,
  MAX_SHOP_REF_BYTES,
  byteLength,
  parseCallbackData,
} from './callbackProtocol.js';

const REF = 'shop-2026-07-28';

/** Minimal-but-valid arguments for every renderer in the catalogue. */
const SAMPLES = {
  receipt: { shopRef: REF, source: 'telegram photo' },
  plan_ready: { shopRef: REF, listLines: 41, resolved: 36, needDecision: 3, excludedByRule: 2, substitutions: 'never auto-substitute' },
  question: { shopRef: REF, questionKey: 'q7', item: 'yoghurt', candidates: ['Yeo Valley Natural 500g', 'Arla Skyr 450g'] },
  confirm_interpretation: {
    shopRef: REF, interpretedLines: 35,
    fingerprintPrefix: 'ab12cd34ef56', fingerprintAlgo: 'sha256',
    receivedAt: '2026-08-08T20:41:00.000Z',
    priorShopRef: 'shop-2026-07-21', priorReceivedAt: '2026-07-21T09:12:00.000Z',
    samePhotoAsPrior: false,
  },
  // WP-B15-2: the voice of the line-resolution park. Without this card the
  // gate that makes READY_TO_SHOP unreachable stops a shop in SILENCE, which
  // is shop 6's live shape re-created by the gate meant to prevent it.
  lines_unresolved: {
    shopRef: REF, items: ['Ariel Pods', 'fruit splits'],
    unresolvedCount: 2, awaitingClarification: 1,
  },
  progress: { shopRef: REF, stage: 'search items', regularsAdded: 30, searchItemsAdded: 5, held: 2, substitutions: 0, basketLines: 35 },
  // The basket handback is DERIVED FROM THE VERIFICATION. `verification` is not
  // optional garnish: absent or null renders the loud NOT-VERIFIED card, by
  // design, so a producer that forgets it can never emit a reassuring one.
  basket_ready: {
    shopRef: REF,
    verification: {
      verified: true, blocking: [], countsMatch: true,
      expectedDistinctProducts: 4, actualDistinctProducts: 4,
      expectedTotalUnits: 7, actualTotalUnits: 7,
      unavailable: [], missing: [], quantityMismatches: [], unexpected: [],
      nameOnlyMatches: [], packetSelfConsistent: null,
    },
    lines: ['Milk 4pt', { label: 'Bananas', qty: 2 }],
    estimatedTotal: '£84.20', newRegulars: 1, aliasesLearned: 2, productIdsCaptured: 4, exceptions: 1,
  },
  status: { shopRef: REF, state: 'building', listLines: 41, resolved: 36, needDecision: 3, held: 2, basketLines: 35, substitutions: 0, exceptions: 1, estimatedTotal: null, lastEvent: 'basket line added', updatedAt: '2026-07-28T12:00:00Z' },
  failure: { shopRef: REF, stage: 'search items', detail: 'ASDA search returned no results for "yoghurt"' },
  confirmation_received: { shopRef: REF, source: 'forwarded email' },
  reconciliation_summary: { shopRef: REF, purchasedAsPlanned: 33, addedAfterPlanning: 1, omitted: 2, qtyChanged: 1, variantChanged: 0, priceMissing: 35, unresolved: 0 },
  clarification_deferred: { shopRef: REF, items: ['dreamies cheese'], reason: 'I could not tell which size you meant' },
};

function everyButton(rendered) {
  const rows = (rendered.reply_markup && rendered.reply_markup.inline_keyboard) || [];
  return rows.flat();
}

// ── catalogue-wide shape ─────────────────────────────────────────────────────

test('the catalogue covers every message the directive specifies', () => {
  // 'confirm_interpretation' added by WP-B15-1 (the needs_review gate's
  // production surface). 'lines_unresolved' added by WP-B15-2 (the
  // line-resolution gate's production surface - Veritas D-2). Both exist for
  // the same reason: a gate that parks a shop must be able to say so.
  // The list grows; nothing was removed or renamed.
  // 'clarification_deferred' added by WP-B15-A1, for the same reason again: the
  // reading-confirmation gate DEFERS a round-2 clarification, and a deferral
  // nobody is told about is a silent park. The card waits; the word does not.
  //
  // THIS LIST IS THE CONTROL. A new outbox kind whose renderer is not registered
  // in MESSAGES is not a quiet no-op - runtime.js drainOutbox resolves it
  // 'abandoned' and the message is discarded. Pinning the exact key set here,
  // OUTSIDE renderMessages.js, is what makes an unregistered kind impossible to
  // ship unnoticed.
  assert.deepEqual(Object.keys(MESSAGES).sort(), [
    'basket_ready', 'clarification_deferred', 'confirm_interpretation', 'confirmation_received',
    'failure', 'lines_unresolved', 'plan_ready', 'progress', 'question', 'receipt',
    'reconciliation_summary', 'status',
  ]);
});

test('EVERY renderer returns { text, reply_markup } with a non-empty text and well-formed buttons', () => {
  for (const [name, render] of Object.entries(MESSAGES)) {
    const out = render(SAMPLES[name]);
    assert.equal(typeof out.text, 'string', `${name}: text`);
    assert.ok(out.text.trim().length > 0, `${name}: empty text`);
    assert.ok(Array.isArray(out.reply_markup.inline_keyboard), `${name}: keyboard`);
    for (const b of everyButton(out)) {
      assert.equal(typeof b.text, 'string', `${name}: button label`);
      assert.ok(b.text.length > 0 && b.text.length <= MAX_BUTTON_LABEL_CHARS, `${name}: label length`);
      assert.ok(byteLength(b.callback_data) <= CALLBACK_DATA_MAX_BYTES, `${name}: callback_data too long`);
      const parsed = parseCallbackData(b.callback_data);
      assert.equal(parsed.ok, true, `${name}: unparseable callback_data ${b.callback_data}`);
      assert.ok(ACTION_VALUES.includes(parsed.action), `${name}: unknown action`);
      assert.equal(parsed.shopRef, REF, `${name}: wrong shop ref on a button`);
    }
  }
});

test('EVERY renderer is pure — the same argument object yields byte-identical output twice', () => {
  for (const [name, render] of Object.entries(MESSAGES)) {
    const a = render(SAMPLES[name]);
    const b = render(SAMPLES[name]);
    assert.deepEqual(a, b, `${name} is not deterministic`);
  }
});

test('EVERY renderer fails closed on a shop ref that cannot ride a 64-byte button', () => {
  const tooLong = 'r'.repeat(MAX_SHOP_REF_BYTES + 1);
  for (const [name, render] of Object.entries(MESSAGES)) {
    assert.throws(() => render({ ...SAMPLES[name], shopRef: tooLong }), /shopRef/, `${name} did not refuse`);
    assert.throws(() => render({ ...SAMPLES[name], shopRef: undefined }), /shopRef/, `${name} accepted a missing ref`);
  }
});

test('no renderer emits a checkout or payment action', () => {
  for (const [name, render] of Object.entries(MESSAGES)) {
    const out = render(SAMPLES[name]);
    for (const b of everyButton(out)) {
      const { action } = parseCallbackData(b.callback_data);
      assert.ok(!['checkout', 'pay', 'order', 'slot'].includes(action), `${name} offers ${action}`);
    }
  }
});

// ── never fabricate ──────────────────────────────────────────────────────────

test('count() renders unknown for anything that is not a finite number — never 0', () => {
  for (const bad of [null, undefined, NaN, Infinity, -Infinity, '3', '', {}, [], true, false]) {
    assert.equal(count(bad), UNKNOWN, `count(${String(bad)})`);
  }
  assert.equal(count(0), '0');
  assert.equal(count(-2), '-2');
  assert.equal(count(41), '41');
});

test('value() renders unknown for absent/blank, and passes a caller-formatted string straight through', () => {
  for (const bad of [null, undefined, '', '   ', NaN, {}, [], true]) {
    assert.equal(value(bad), UNKNOWN, `value(${String(bad)})`);
  }
  assert.equal(value('£84.20'), '£84.20');
  assert.equal(value(0), '0');
});

test('an entirely empty status projection renders every field as "unknown" and fabricates nothing', () => {
  const out = renderStatus({ shopRef: REF });
  const fields = ['State', 'List lines', 'Resolved', 'Need a decision', 'Held', 'Basket lines',
    'Substitutions', 'Exceptions', 'Estimated total', 'Last event', 'Updated'];
  for (const f of fields) {
    assert.match(out.text, new RegExp(`^${f}: unknown$`, 'm'), `${f} was not "unknown"`);
  }
  // The crucial negative: nothing invented a zero.
  assert.ok(!/: 0$/m.test(out.text), 'a null value was rendered as 0');
});

test('a partially-known status projection renders the known values and only the unknown ones as "unknown"', () => {
  const out = renderStatus({ shopRef: REF, held: 0, basketLines: 35, estimatedTotal: null, needDecision: undefined });
  assert.match(out.text, /^Held: 0$/m);              // a REAL zero is a real zero
  assert.match(out.text, /^Basket lines: 35$/m);
  assert.match(out.text, /^Estimated total: unknown$/m); // no price source exists — say so
  assert.match(out.text, /^Need a decision: unknown$/m);
});

test('unknown counts propagate into button labels rather than being invented', () => {
  const out = renderPlanReady({ shopRef: REF });
  assert.match(out.text, /^Need a decision: unknown$/m);
  assert.equal(everyButton(out)[0].text, 'Answer unknown questions');
});

// ── individual messages ──────────────────────────────────────────────────────

test('receipt says the list is safely stored and offers build / review / cancel', () => {
  const out = renderReceipt(SAMPLES.receipt);
  assert.match(out.text, /^🛒 Shopping list received$/m);
  assert.match(out.text, /^Ref: shop-2026-07-28$/m);
  assert.match(out.text, /^Source: telegram photo$/m);
  assert.match(out.text, /^Status: Safely stored$/m);
  assert.match(out.text, /^Next: Ready to process$/m);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Build this shop', 'Review list', 'Cancel']);
});

test('the receipt deliberately offers NO "keep raw" choice — retention is unconditional, it is the evidence', () => {
  const out = renderReceipt(SAMPLES.receipt);
  const labels = everyButton(out).map((b) => b.text.toLowerCase()).join(' ');
  assert.ok(!labels.includes('keep'), 'a "keep raw" button appeared');
  assert.ok(!labels.includes('raw'), 'a raw-list choice appeared');
  assert.ok(!labels.includes('discard'), 'a discard choice appeared');
  assert.ok(!labels.includes('delete'), 'a delete choice appeared');
});

test('plan ready reports the five planning counts and offers answer / basket / status', () => {
  const out = renderPlanReady(SAMPLES.plan_ready);
  assert.match(out.text, /^List lines: 41$/m);
  assert.match(out.text, /^Resolved: 36$/m);
  assert.match(out.text, /^Need a decision: 3$/m);
  assert.match(out.text, /^Excluded by a standing rule: 2$/m);
  assert.match(out.text, /^Substitutions: never auto-substitute$/m);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Answer 3 questions', 'Build ASDA basket', 'View status']);
});

test('a question card lists its candidates, offers one button each, and invites a typed reply', () => {
  const out = renderQuestionCard(SAMPLES.question);
  assert.match(out.text, /^Item: yoghurt$/m);
  assert.match(out.text, /1\. Yeo Valley Natural 500g/);
  assert.match(out.text, /2\. Arla Skyr 450g/);
  assert.match(out.text, /reply to this message/i);
  const buttons = everyButton(out);
  // 'Search ASDA' was WITHDRAWN by WP-B15-08 AC10: the runtime has no handler
  // for it and refuses it when pressed. This expectation changed because the
  // REQUIREMENT changed - not to make a failing assertion pass.
  assert.deepEqual(buttons.map((b) => b.text), ['Yeo Valley Natural 500g', 'Arla Skyr 450g', 'Skip this week']);
  assert.equal(parseCallbackData(buttons[0].callback_data).arg, 'q7.0');
  assert.equal(parseCallbackData(buttons[1].callback_data).arg, 'q7.1');
  assert.equal(parseCallbackData(buttons[2].callback_data).arg, 'q7');
});

test('a question with no candidates still asks, and still offers skip', () => {
  const out = renderQuestionCard({ shopRef: REF, questionKey: 'q9', item: 'that blue tin' });
  assert.match(out.text, /No candidate products found\./);
  // Search withdrawn by WP-B15-08 AC10. Skip and a typed reply are the surface.
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Skip this week']);
  assert.match(out.text, /reply to this message/i, 'with no buttons, the invitation to type is the only way to answer');
});

test('an absurdly long product name shortens the LABEL only — callback_data is still valid and under 64 bytes', () => {
  const monster = 'ASDA Extra Special Slow Matured Aberdeen Angus Something Or Other 400g Pack Of Two';
  const out = renderQuestionCard({ shopRef: REF, questionKey: 'q7', item: monster, candidates: [monster] });
  const [first] = everyButton(out);
  assert.ok(first.text.length <= MAX_BUTTON_LABEL_CHARS);
  assert.ok(first.text.endsWith('…'));
  assert.ok(byteLength(first.callback_data) <= CALLBACK_DATA_MAX_BYTES);
  assert.equal(parseCallbackData(first.callback_data).arg, 'q7.0');
  // The FULL name is still in the message body — only the button label shortened.
  assert.ok(out.text.includes(monster.slice(0, 40)));
});

test('a question card refuses an over-long question key rather than truncating it onto the wire', () => {
  assert.throws(() => renderQuestionCard({ shopRef: REF, questionKey: 'q'.repeat(20), item: 'x' }), /questionKey/);
});

test('progress is milestone-level and offers held / status / pause', () => {
  const out = renderProgress(SAMPLES.progress);
  assert.match(out.text, /^Regulars added: 30$/m);
  assert.match(out.text, /^Search items added: 5$/m);
  assert.match(out.text, /^Held: 2$/m);
  assert.match(out.text, /^Substitutions: 0$/m);
  assert.match(out.text, /^Basket lines: 35$/m);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['View held items', 'View status', 'Pause']);
});

test('basket ready lists the products, the learning counts, and states that nothing was ordered', () => {
  const out = renderBasketReady(SAMPLES.basket_ready);
  assert.match(out.text, /• Milk 4pt/);
  assert.match(out.text, /• Bananas x2/);
  assert.match(out.text, /^Estimated total: £84\.20$/m);
  assert.match(out.text, /^New regulars: 1$/m);
  assert.match(out.text, /^Aliases learned: 2$/m);
  assert.match(out.text, /^Product IDs captured: 4$/m);
  assert.match(out.text, /^Exceptions: 1$/m);
  assert.match(out.text, /Nothing has been ordered/);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Send order confirmation', 'View exceptions', 'Close shop']);
  // NEW CONTRACT: the verdict is the headline, and the two count facts are
  // reported separately from it.
  assert.match(out.text, /^🧺 Basket ready — VERIFIED against the plan$/m);
  assert.match(out.text, /^Distinct products: expected 4, basket 4$/m);
  assert.match(out.text, /^Total units: expected 7, basket 7$/m);
  assert.match(out.text, /^Counts match: yes — headline only, NOT the verdict$/m);
});

test('basket ready with no price source says "unknown", not a made-up total', () => {
  const out = renderBasketReady({ ...SAMPLES.basket_ready, lines: [], estimatedTotal: null });
  assert.match(out.text, /^Estimated total: unknown$/m);
  // A basket with no product lines prints NO product-lines section at all rather
  // than a "(0)" heading, because a count we did not take is not a zero.
  assert.ok(!/^Product lines/m.test(out.text));
});

// ── the basket handback is a claim that reconciliation PASSED ────────────────

test('FAIL SAFE: no verification renders NOT VERIFIED — never a reassuring card of zeros', () => {
  for (const spec of [
    { shopRef: REF },
    { shopRef: REF, verification: null, notVerifiedReason: 'no basket capture has been recorded' },
    { shopRef: REF, verification: null, lines: ['Milk 4pt'], estimatedTotal: '£84.20' },
  ]) {
    const out = renderBasketReady(spec);
    assert.match(out.text, /^⚠️ Basket NOT VERIFIED$/m);
    assert.match(out.text, /has NOT been checked against the plan/);
    assert.match(out.text, /Do not treat this as ready/);
    // THE CRUCIAL NEGATIVES: no measurement we never took.
    assert.ok(!/: 0$/m.test(out.text), 'a card with no verification fabricated a zero');
    assert.ok(!/Counts match/.test(out.text), 'a card with no verification reported a count comparison');
    assert.ok(!/Distinct products/.test(out.text));
    assert.ok(!/Product lines/.test(out.text), 'an unverified card listed basket contents');
    assert.ok(!/£84\.20/.test(out.text), 'an unverified card reported a total');
    assert.match(out.text, /no checkout, no payment, no delivery slot/);
  }
});

test('a FAILED verification says so FIRST, and a matching headline cannot make it read as ready', () => {
  const out = renderBasketReady({
    shopRef: REF,
    verification: {
      verified: false,
      blocking: ['1 expected product(s) missing from the basket', '1 basket line(s) on no packet line'],
      // The exact trap the reconciler mutation-tests: the headline agrees while
      // the contents are wrong.
      countsMatch: true,
      expectedDistinctProducts: 4, actualDistinctProducts: 4,
      expectedTotalUnits: 7, actualTotalUnits: 7,
      missing: [{ name: 'Rice Pot', quantity: 3 }],
      unexpected: [{ name: 'Cola 2L', quantity: 1 }],
    },
  });
  const firstLine = out.text.split('\n')[0];
  assert.equal(firstLine, '⚠️ Basket NOT VERIFIED — do not check out yet',
    'a failed verification did not lead the card');
  assert.ok(out.text.indexOf('Not verified because:') < out.text.indexOf('Counts match'),
    'the reassuring headline appeared before the reason it is not ready');
  assert.match(out.text, /^Counts match: yes — headline only, NOT the verdict$/m);
  assert.match(out.text, /• 1 expected product\(s\) missing from the basket/);
  assert.match(out.text, /MISSING from the basket:/);
  assert.match(out.text, /• Rice Pot x3/);
  assert.match(out.text, /IN THE BASKET but on no planned line:/);
  assert.match(out.text, /• Cola 2L x1/);
});

test('an unavailable line is NAMED, and the word "substitut" appears nowhere on this card', () => {
  const out = renderBasketReady({
    shopRef: REF,
    verification: {
      verified: false,
      blocking: ['1 product(s) unavailable and awaiting Warwick'],
      countsMatch: false,
      expectedDistinctProducts: 2, actualDistinctProducts: 2,
      expectedTotalUnits: 4, actualTotalUnits: 4,
      unavailable: [{ name: 'Rice Pot', quantity: 3 }],
      quantityMismatches: [{ name: 'Oat Crunch', expected: 2, actual: 1 }],
      nameOnlyMatches: ['Cocoa Drops'],
      packetSelfConsistent: false,
    },
  });
  assert.match(out.text, /UNAVAILABLE at ASDA — nothing was put in its place, you decide:/);
  assert.match(out.text, /• Rice Pot x3/);
  assert.match(out.text, /^WRONG QUANTITY:$/m);
  assert.match(out.text, /• Oat Crunch: expected 2, basket 1/);
  assert.match(out.text, /Matched on NAME ONLY/);
  assert.match(out.text, /• Cocoa Drops/);
  // A producer defect is named as one and never blamed on the basket.
  assert.match(out.text, /defect in the plan, not in the basket/);
  // THE PRODUCT RULE: substitution is not a permitted outcome anywhere, so the
  // word must not appear on the card that hands the basket over.
  assert.ok(!/substitut/i.test(out.text), 'the basket handback used the word "substitut*"');
});

test('a section with no members is omitted entirely rather than rendered empty', () => {
  const out = renderBasketReady(SAMPLES.basket_ready);
  for (const heading of ['UNAVAILABLE at ASDA', 'MISSING from the basket', 'WRONG QUANTITY',
    'IN THE BASKET but on no planned line', 'Matched on NAME ONLY', 'Not verified because']) {
    assert.ok(!out.text.includes(heading), `${heading} was rendered on a clean basket`);
  }
});

test('a quantity that is not a whole number is never invented on the card', () => {
  const out = renderBasketReady({
    shopRef: REF,
    verification: {
      verified: false, blocking: ['1 expected product(s) missing from the basket'],
      countsMatch: null,
      missing: [{ name: 'Rice Pot' }],
    },
  });
  assert.match(out.text, /• Rice Pot$/m, 'a missing quantity was rendered as a made-up number');
  assert.ok(!/Rice Pot x/.test(out.text));
  assert.match(out.text, /^Counts match: unknown$/m);
  assert.match(out.text, /^Distinct products: expected unknown, basket unknown$/m);
});

test('failure is visible and offers retry', () => {
  const out = renderFailure(SAMPLES.failure);
  assert.match(out.text, /^🚨 Shop step failed$/m);
  assert.match(out.text, /^Stage: search items$/m);
  assert.match(out.text, /ASDA search returned no results/);
  assert.match(out.text, /Nothing was ordered\./);
  assert.equal(everyButton(out)[0].text, 'Retry');
});

test('confirmation received acknowledges and says reconciliation has started', () => {
  const out = renderConfirmationReceived(SAMPLES.confirmation_received);
  assert.match(out.text, /^🧾 Order confirmation received$/m);
  assert.match(out.text, /^Ref: shop-2026-07-28$/m);
  assert.match(out.text, /^Status: Reconciling against planned basket$/m);
});

test('the reconciliation summary reports all seven planned-vs-actual buckets', () => {
  const out = renderReconciliationSummary(SAMPLES.reconciliation_summary);
  assert.match(out.text, /^Purchased as planned: 33$/m);
  assert.match(out.text, /^Added after planning: 1$/m);
  assert.match(out.text, /^Omitted: 2$/m);
  assert.match(out.text, /^Quantity changed: 1$/m);
  assert.match(out.text, /^Variant changed: 0$/m);
  assert.match(out.text, /^Price missing: 35$/m);
  assert.match(out.text, /^Unresolved: 0$/m);
});

// ── rendering safety ─────────────────────────────────────────────────────────

test('Markdown-hostile product names survive verbatim — the catalogue is plain text, so nothing is escaped or lost', () => {
  const nasty = "Nature's Pick 100% Fruit_Bar *2* [6 pack] (new) `deal`";
  const out = renderQuestionCard({ shopRef: REF, questionKey: 'q1', item: nasty, candidates: [nasty] });
  assert.ok(out.text.includes(nasty), 'a Markdown-hostile name was mangled');
  assert.ok(!out.text.includes('\\'), 'the renderer escaped something — it must not');
});

test('labelFor never returns an empty label', () => {
  assert.equal(labelFor(''), '(unnamed)');
  assert.equal(labelFor(null), '(unnamed)');
  assert.equal(labelFor(undefined), '(unnamed)');
  assert.equal(labelFor(123), '(unnamed)');
  assert.equal(labelFor('  ok  '), 'ok');
});

test('NO SECRET can reach rendered output: a token-shaped value passed into every renderer never appears', () => {
  // A realistic bot-token shape. If a renderer ever reached for the environment,
  // or echoed an unexpected field, this would catch it.
  // Shaped to NOT match the repo secret-scan's `telegram-token-bare` pattern
  // ([0-9]{8,}:[A-Za-z0-9_-]{30,}) - see the note on the same fixture in
  // sendShopperMessage.test.js.
  const TOKEN = '1234567890:TESTFIXTURE.not.a.real.telegram.token';
  const originalEnv = process.env.SHOPPER_BOT_TOKEN;
  process.env.SHOPPER_BOT_TOKEN = TOKEN;
  try {
    for (const [name, render] of Object.entries(MESSAGES)) {
      const out = render(SAMPLES[name]);
      const serialised = JSON.stringify(out);
      assert.ok(!serialised.includes(TOKEN), `${name} leaked a token-shaped value`);
      assert.ok(!/TESTFIXTURE/.test(serialised), `${name} leaked a token body`);
      assert.ok(!/SHOPPER_BOT_TOKEN/.test(serialised), `${name} leaked a secret env NAME`);
      assert.ok(!/bot\d+:/.test(serialised), `${name} leaked a bot API path`);
    }
  } finally {
    if (originalEnv === undefined) delete process.env.SHOPPER_BOT_TOKEN;
    else process.env.SHOPPER_BOT_TOKEN = originalEnv;
  }
});

// ── WP-B15-1: the interpretation-confirmation card ───────────────────────────
// The needs_review gate's production surface. What these prove: the card binds
// the reading to the EXACT photograph (fingerprint prefix + received time),
// renders every absence honestly instead of fabricating, carries a
// HUMAN-READABLE prior-photograph comparison, and its primary tap is the
// distinct `approve` action - never the reconcile-stage `confirm`.

test('CONFIRMATION CARD: names the exact photograph - fingerprint prefix and received time both rendered', () => {
  const out = renderConfirmInterpretation(SAMPLES.confirm_interpretation);
  assert.ok(out.text.includes('sha256:ab12cd34ef56'), 'the fingerprint prefix is missing');
  assert.ok(out.text.includes('Sat 2026-08-08 20:41 UTC'), 'the received time is missing or not human-readable');
  assert.ok(out.text.includes('read from the photograph received'), 'the wording does not bind reading to photograph');
  assert.ok(out.text.includes('Lines read from the photograph: 35'));
});

test('CONFIRMATION CARD: a shop with NO stored fingerprint says so in words - never a fabricated value', () => {
  const out = renderConfirmInterpretation({
    shopRef: REF, interpretedLines: 35,
    fingerprintPrefix: null, fingerprintAlgo: null,
    receivedAt: '2026-08-03T19:05:00.000Z',
    priorShopRef: null, priorReceivedAt: null, samePhotoAsPrior: null,
  });
  assert.ok(out.text.includes('none was recorded at intake'), 'a missing fingerprint must be stated, not hidden');
  assert.ok(!out.text.includes('sha256:'), 'no fingerprint may be rendered when none is stored');
  assert.ok(out.text.includes('none on record'), 'a missing prior photo shop must be stated');
});

test('CONFIRMATION CARD: never claims a mechanical physical-line count - the human verifies against the photograph', () => {
  const out = renderConfirmInterpretation(SAMPLES.confirm_interpretation);
  assert.ok(out.text.includes('not counted by AsdAIr'), 'the card must say no physical count exists');
  assert.ok(/check the reading/i.test(out.text), 'the card must direct the human to verify against the photograph');
});

test('CONFIRMATION CARD: the prior-photograph comparison is human-readable, and identical content warns LOUDLY', () => {
  const spec = { ...SAMPLES.confirm_interpretation };
  const normal = renderConfirmInterpretation(spec);
  assert.ok(normal.text.includes('shop-2026-07-21'), 'the prior shop is not named');
  assert.ok(normal.text.includes('Tue 2026-07-21 09:12 UTC'), 'the prior received time is not human-readable');
  assert.ok(!normal.text.includes('SAME PHOTOGRAPH'), 'different photographs must not warn');

  const resent = renderConfirmInterpretation({ ...spec, samePhotoAsPrior: true });
  assert.ok(resent.text.includes('SAME PHOTOGRAPH'), 'an identical re-sent photograph must warn');
  assert.ok(resent.text.includes('do NOT confirm'), 'the warning must tell the human not to confirm');

  const uncomparable = renderConfirmInterpretation({ ...spec, samePhotoAsPrior: null });
  assert.ok(uncomparable.text.includes('could not be compared'), 'null must render as not-compared, never as fine');
});

test('CONFIRMATION CARD: the primary tap is `approve` - and no button on it is the reconcile-stage `confirm`', () => {
  const out = renderConfirmInterpretation(SAMPLES.confirm_interpretation);
  const actions = everyButton(out).map((b) => parseCallbackData(b.callback_data).action);
  assert.ok(actions.includes('approve'), 'the card must offer the approve tap');
  assert.ok(!actions.includes('confirm'), 'the order-email `confirm` action must never appear on this card');
});

test('humanTime: deterministic UTC rendering, and anything unparseable is unknown - never a fabricated time', () => {
  assert.equal(humanTime('2026-08-08T20:41:00.000Z'), 'Sat 2026-08-08 20:41 UTC');
  assert.equal(humanTime('2026-08-08T22:41:00+02:00'), 'Sat 2026-08-08 20:41 UTC', 'an offset suffix must normalise to UTC');
  assert.equal(humanTime('2026-02-30T10:00:00Z'), UNKNOWN, 'an impossible calendar date must not be normalised into a real one');
  assert.equal(humanTime('2026-07-21T09:12:00.000Z'), 'Tue 2026-07-21 09:12 UTC');
  for (const bad of [null, undefined, '', '   ', 'not-a-date', 42]) {
    assert.equal(humanTime(bad), UNKNOWN, `humanTime(${String(bad)})`);
  }
});

// =====================================================================
// WP-B15-08 AC4 - A CARD MUST NOT CONTRADICT ITSELF
//
// Warwick received cards that printed "No candidate products found." with a
// Note listing suggested products directly above it. Both halves are generated
// from the SAME question row: the planner's candidates split into the ones
// carrying a trustworthy product id (which become buttons) and the ones that do
// not (which become the Note). When every candidate lands in the second bucket
// the button list is empty and the card announces there are none - while
// printing them.
// =====================================================================

test('AC4 a card with a suggestion NOTE never claims it has no candidates', () => {
  const out = renderQuestionCard({
    shopRef: REF,
    questionKey: 'q9',
    item: 'that blue tin',
    note: 'Suggested (reply with the one you want): Heinz Baked Beans 415g; Branston Beans 410g',
    candidates: [],
  });
  assert.doesNotMatch(out.text, /No candidate products found/,
    'the card lists candidates in the Note and denies having any in the same breath');
  assert.match(out.text, /Heinz Baked Beans 415g/, 'the suggestions must still reach him');
  assert.match(out.text, /reply to this message/i, 'he must still be told how to answer');
});

test('AC4 a card with NEITHER buttons NOR a note still says so, honestly', () => {
  const out = renderQuestionCard({ shopRef: REF, questionKey: 'q9', item: 'that blue tin' });
  assert.match(out.text, /No candidate products found\./,
    'a genuinely empty card must still tell him there is nothing to choose from');
});

test('AC4 buttons and the "none" line can never both be absent-and-present', () => {
  // The invariant, checked over every combination rather than reasoned about:
  // the "none found" line appears if and only if the card offers NOTHING -
  // no candidate buttons and no suggestion note.
  const cases = [
    { candidates: ['Yeo Valley Natural 500g'], note: null },
    { candidates: ['Yeo Valley Natural 500g'], note: 'Suggested: Arla Skyr 450g' },
    { candidates: [], note: 'Suggested: Arla Skyr 450g' },
    { candidates: [], note: null },
  ];
  for (const c of cases) {
    const out = renderQuestionCard({ shopRef: REF, questionKey: 'q7', item: 'yoghurt', ...c });
    const offersSomething = c.candidates.length > 0 || Boolean(c.note);
    const saysNone = /No candidate products found\./.test(out.text);
    assert.equal(saysNone, !offersSomething,
      `card contradicts itself for ${JSON.stringify(c)}`);
  }
});

// =====================================================================
// WP-B15-08 AC10 - A CONTROL THE SYSTEM REFUSES MUST NOT BE DRAWN
//
// Warwick tapped "Search ASDA" on 2026-08-10. From the live runtime log:
//   {"event":"inbound_refused","updateId":171031159,"action":"search",
//    "reason":"that button is not a command - it is answered by the runner or
//    by a human"}
// The button was rendered on EVERY question card and no handler for it exists
// anywhere in the runtime. A control the product refuses when pressed must not
// be drawn. This does NOT implement ASDA search - it withdraws a dead control.
// ACTIONS.SEARCH stays in the protocol; nothing renders it.
// =====================================================================

test('AC10 no question card draws a control the runtime has no handler for', () => {
  const withCandidates = renderQuestionCard(SAMPLES.question);
  const without = renderQuestionCard({ shopRef: REF, questionKey: 'q9', item: 'that blue tin' });
  for (const out of [withCandidates, without]) {
    const labels = everyButton(out).map((b) => b.text);
    assert.ok(!labels.includes('Search ASDA'),
      'the card still offers Search ASDA, which the runtime refuses when pressed');
    const actions = everyButton(out).map((b) => parseCallbackData(b.callback_data).action);
    assert.ok(!actions.includes('search'),
      'a search callback is still reachable from a card');
  }
});

test('AC10 withdrawing search leaves every card still answerable', () => {
  const withCandidates = everyButton(renderQuestionCard(SAMPLES.question)).map((b) => b.text);
  assert.deepEqual(withCandidates, ['Yeo Valley Natural 500g', 'Arla Skyr 450g', 'Skip this week']);

  // The line Warwick is blocked on RIGHT NOW - "1 PKT HAM ON THE BONE" - has no
  // candidate buttons at all. With search withdrawn, Skip and a typed reply are
  // the whole of the surface, so the invitation to type is what makes the card
  // answerable and it must always be there.
  const bare = renderQuestionCard({ shopRef: REF, questionKey: 'q9', item: '1 PKT HAM ON THE BONE' });
  assert.deepEqual(everyButton(bare).map((b) => b.text), ['Skip this week']);
  assert.match(bare.text, /reply to this message/i,
    'a card with no buttons and no invitation to type is unanswerable');
});
