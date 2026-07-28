// BUILD-015 AsdAIr bot — the message catalogue: unit tests. Fully offline, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGES,
  MAX_BUTTON_LABEL_CHARS,
  UNKNOWN,
  count,
  labelFor,
  renderBasketReady,
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
  progress: { shopRef: REF, stage: 'search items', regularsAdded: 30, searchItemsAdded: 5, held: 2, substitutions: 0, basketLines: 35 },
  basket_ready: { shopRef: REF, lines: ['Milk 4pt', { label: 'Bananas', qty: 2 }], estimatedTotal: '£84.20', substitutions: 0, newRegulars: 1, aliasesLearned: 2, productIdsCaptured: 4, exceptions: 1 },
  status: { shopRef: REF, state: 'building', listLines: 41, resolved: 36, needDecision: 3, held: 2, basketLines: 35, substitutions: 0, exceptions: 1, estimatedTotal: null, lastEvent: 'basket line added', updatedAt: '2026-07-28T12:00:00Z' },
  failure: { shopRef: REF, stage: 'search items', detail: 'ASDA search returned no results for "yoghurt"' },
  confirmation_received: { shopRef: REF, source: 'forwarded email' },
  reconciliation_summary: { shopRef: REF, purchasedAsPlanned: 33, addedAfterPlanning: 1, omitted: 2, qtyChanged: 1, variantChanged: 0, priceMissing: 35, unresolved: 0 },
};

function everyButton(rendered) {
  const rows = (rendered.reply_markup && rendered.reply_markup.inline_keyboard) || [];
  return rows.flat();
}

// ── catalogue-wide shape ─────────────────────────────────────────────────────

test('the catalogue covers every message the directive specifies', () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), [
    'basket_ready', 'confirmation_received', 'failure', 'plan_ready',
    'progress', 'question', 'receipt', 'reconciliation_summary', 'status',
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
  assert.deepEqual(buttons.map((b) => b.text), ['Yeo Valley Natural 500g', 'Arla Skyr 450g', 'Search ASDA', 'Skip this week']);
  assert.equal(parseCallbackData(buttons[0].callback_data).arg, 'q7.0');
  assert.equal(parseCallbackData(buttons[1].callback_data).arg, 'q7.1');
  assert.equal(parseCallbackData(buttons[2].callback_data).arg, 'q7');
  assert.equal(parseCallbackData(buttons[3].callback_data).arg, 'q7');
});

test('a question with no candidates still asks, and still offers search / skip', () => {
  const out = renderQuestionCard({ shopRef: REF, questionKey: 'q9', item: 'that blue tin' });
  assert.match(out.text, /No candidate products found\./);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Search ASDA', 'Skip this week']);
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
  assert.match(out.text, /Nothing has been ordered\./);
  assert.deepEqual(everyButton(out).map((b) => b.text), ['Send order confirmation', 'View exceptions', 'Close shop']);
});

test('basket ready with no price source says "unknown", not a made-up total', () => {
  const out = renderBasketReady({ shopRef: REF, lines: [], estimatedTotal: null });
  assert.match(out.text, /^Estimated total: unknown$/m);
  assert.match(out.text, /\(none\)/);
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
  // Shaped to NOT match the repo secret-scan's Telegram pattern - see the note
  // on the same fixture in sendShopperMessage.test.js.
  const TOKEN = '1234567890:TESTFIXTURE-not-a-real-telegram-token';
  const originalEnv = process.env.SHOPPER_BOT_TOKEN;
  process.env.SHOPPER_BOT_TOKEN = TOKEN;
  try {
    for (const [name, render] of Object.entries(MESSAGES)) {
      const out = render(SAMPLES[name]);
      const serialised = JSON.stringify(out);
      assert.ok(!serialised.includes(TOKEN), `${name} leaked a token-shaped value`);
      assert.ok(!/AAF-thisIsNot/.test(serialised), `${name} leaked a token body`);
      assert.ok(!/SHOPPER_BOT_TOKEN/.test(serialised), `${name} leaked a secret env NAME`);
      assert.ok(!/bot\d+:/.test(serialised), `${name} leaked a bot API path`);
    }
  } finally {
    if (originalEnv === undefined) delete process.env.SHOPPER_BOT_TOKEN;
    else process.env.SHOPPER_BOT_TOKEN = originalEnv;
  }
});
