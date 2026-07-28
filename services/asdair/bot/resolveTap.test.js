// BUILD-015 AsdAIr bot — resolving a tap through the render contract: unit tests.
// Fully offline. No network, no database, no credentials file, no model.
// The HTTP client is injected; every Telegram call lands on a fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAP_OUTCOMES, TAP_REFUSALS, handleAsdairTap, resolveTap } from './resolveTap.js';
import { persistQuestionRender, prepareQuestionCard, sendQuestionCard } from './questionRender.js';
import { ACTIONS, buildAnswerArg, buildCallbackData } from './callbackProtocol.js';
import { routeAsdairUpdate } from './inboundRouter.js';
import { createShopperSender } from './sendShopperMessage.js';

const REF = 'shop-2026-07-28';
const KEY = 'q7';
const CHAT = 55;

const A = { id: 'P-1001', label: 'Yeo Valley Natural Yogurt 500g' };
const B = { id: 'P-1002', label: 'Arla Skyr Natural 450g' };
const C = { id: 'P-1003', label: 'ASDA Greek Style Natural 500g' };
const CANDIDATES = [A, B, C];

/** asdair.shop_question in memory, with the CAS semantics the real SQL must have. */
function createFakeStore() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    calls: [],
    async getQuestionByCard({ chatId, messageId }) {
      this.calls.push('getQuestionByCard');
      return rows.find((r) => String(r.card_chat_id) === String(chatId)
        && String(r.card_message_id) === String(messageId)) ?? null;
    },
    async getQuestionByKey({ shopRef, questionKey }) {
      this.calls.push('getQuestionByKey');
      return rows.find((r) => r.shop_ref === shopRef && r.question_key === questionKey) ?? null;
    },
    async saveRender({ shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint, renderVersion }) {
      let row = rows.find((r) => r.shop_ref === shopRef && r.question_key === questionKey);
      if (!row) {
        row = {
          id: nextId, shop_ref: shopRef, question_key: questionKey, status: 'open',
          answer_text: null, answer_source: null, callback_index: null, answered_at: null,
        };
        nextId += 1;
        rows.push(row);
      }
      row.card_chat_id = String(chatId);
      row.card_message_id = String(messageId);
      row.rendered_candidates = renderedCandidates;
      row.render_fingerprint = renderFingerprint;
      row.render_version = renderVersion;
      return row;
    },
    async recordAnswer({ questionId, answerText, answerSource, callbackIndex, answeredAt }) {
      this.calls.push('recordAnswer');
      const row = rows.find((r) => r.id === questionId);
      if (!row) return { applied: false, question: null };
      // COMPARE-AND-SET. Two racing taps cannot both see 'open' and both write.
      if (row.status !== 'open') return { applied: false, question: row };
      row.status = 'answered';
      row.answer_text = answerText;
      row.answer_source = answerSource;
      row.callback_index = callbackIndex;
      row.answered_at = answeredAt;
      return { applied: true, question: row };
    },
  };
}

function createFakeSender() {
  const acks = [];
  const sent = [];
  return {
    acks,
    sent,
    async sendMessage(chatId, message) {
      sent.push({ chatId, message });
      return { message_id: 100 + sent.length, chat: { id: chatId } };
    },
    async editMessageText() { return {}; },
    async answerCallbackQuery(callbackQueryId, opts = {}) {
      acks.push({ callbackQueryId, ...opts });
      return true;
    },
  };
}

/** A Telegram callback_query update for candidate #index of KEY, tapped on `messageId`. */
function tapUpdate({ messageId, index, questionKey = KEY, shopRef = REF, id = 'cbq-1', action = ACTIONS.ANSWER }) {
  return {
    callback_query: {
      id,
      from: { id: 9 },
      data: buildCallbackData({
        action,
        shopRef,
        arg: action === ACTIONS.ANSWER ? buildAnswerArg(questionKey, index) : null,
      }),
      message: { message_id: messageId, chat: { id: CHAT } },
    },
  };
}

function intentFor(args) {
  const intent = routeAsdairUpdate(tapUpdate(args));
  assert.equal(intent.ok, true, `fixture did not route: ${intent.reason}`);
  return intent;
}

/** Seed a store with one open question rendered at v1 on message 100. */
async function seed({ candidates = CANDIDATES, messageId = 100, renderVersion = 1 } = {}) {
  const store = createFakeStore();
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, item: 'yogurt', candidates, renderVersion });
  await persistQuestionRender({ store, contract, chatId: CHAT, messageId });
  return { store, contract };
}

// ── the happy path ───────────────────────────────────────────────────────────

test('a tapped candidate resolves to a DURABLE answer, through the stored list', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 100, index: 1 }), { store, sender });

  assert.equal(out.ok, true);
  assert.equal(out.outcome, TAP_OUTCOMES.ANSWERED);
  assert.equal(out.candidateId, B.id);
  assert.equal(out.candidateLabel, B.label);
  assert.equal(out.candidateIndex, 1);
  assert.equal(out.wrote, true);
  assert.equal(out.renderVersion, 1);

  const row = store.rows[0];
  assert.equal(row.status, 'answered');
  assert.equal(row.callback_index, 1);
  assert.equal(row.answer_source, 'button');
  assert.equal(row.answer_text, B.label);
  assert.equal(typeof row.answered_at, 'string');
});

test('the answer is read out of rendered_candidates, NOT recomputed — index 0 is whatever was displayed', async () => {
  // Displayed order is deliberately NOT the "natural" order.
  const { store } = await seed({ candidates: [C, A, B] });
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 100, index: 0 }), { store, sender });
  assert.equal(out.ok, true);
  assert.equal(out.candidateId, C.id);
});

// ── idempotency: first answer wins ───────────────────────────────────────────

test('a REPEATED tap returns the SAME durable answer and does not rewrite it', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const first = await resolveTap(intentFor({ messageId: 100, index: 1 }), { store, sender });
  const snapshot = { ...store.rows[0] };

  const second = await resolveTap(intentFor({ messageId: 100, index: 1, id: 'cbq-2' }), { store, sender });
  assert.equal(second.ok, true);
  assert.equal(second.outcome, TAP_OUTCOMES.ALREADY_ANSWERED);
  assert.equal(second.wrote, false);
  assert.equal(second.candidateId, first.candidateId);
  assert.equal(second.answerText, first.answerText);
  assert.deepEqual({ ...store.rows[0] }, snapshot, 'the stored answer was rewritten by a repeated tap');
  assert.equal(sender.acks.length, 2, 'both taps must be acknowledged');
});

test('a DIFFERENT candidate tapped after the answer returns the first answer, flagged as conflicting', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  await resolveTap(intentFor({ messageId: 100, index: 1 }), { store, sender });
  const snapshot = { ...store.rows[0] };

  const late = await resolveTap(intentFor({ messageId: 100, index: 2, id: 'cbq-2' }), { store, sender });
  assert.equal(late.ok, true);
  assert.equal(late.outcome, TAP_OUTCOMES.ALREADY_ANSWERED);
  assert.equal(late.candidateId, B.id, 'the FIRST answer must win');
  assert.equal(late.tappedIndex, 2);
  assert.equal(late.conflicting, true);
  assert.deepEqual({ ...store.rows[0] }, snapshot);
});

test('two taps racing on the same open question: the CAS lets exactly one write', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const [one, two] = await Promise.all([
    resolveTap(intentFor({ messageId: 100, index: 0, id: 'cbq-a' }), { store, sender }),
    resolveTap(intentFor({ messageId: 100, index: 2, id: 'cbq-b' }), { store, sender }),
  ]);
  const wrote = [one, two].filter((r) => r.wrote);
  assert.equal(wrote.length, 1, 'exactly one tap may write the answer');
  assert.equal(one.candidateId, two.candidateId, 'both taps must report the SAME durable answer');
  assert.equal(store.rows[0].status, 'answered');
});

// ── THE HEADLINE: a reordered re-render must not misresolve an old tap ───────

test('REORDERED CANDIDATES: a tap on the OLD card is REFUSED, never resolved to the new product', async () => {
  const store = createFakeStore();
  const sender = createFakeSender();

  // v1: [A, B, C] on message 101. Warwick sees "1. Yeo Valley, 2. Arla, 3. ASDA".
  const v1 = await sendQuestionCard({
    sender, store, chatId: CHAT, shopRef: REF, questionKey: KEY, item: 'yogurt', candidates: [A, B, C],
  });
  assert.equal(v1.messageId, 101);

  // The planner re-searches and the ranking flips. v2: [C, B, A] on a NEW card.
  const v2 = await sendQuestionCard({
    sender, store, chatId: CHAT, shopRef: REF, questionKey: KEY, item: 'yogurt', candidates: [C, B, A],
  });
  assert.equal(v2.messageId, 102);
  assert.equal(v2.version, 2);

  // Warwick scrolls back and taps candidate #1 on the OLD card. On the old card
  // that was A (Yeo Valley). Against the CURRENT list, index 0 is C (ASDA) —
  // which is exactly the silent wrong product this build exists to stop.
  const stale = await resolveTap(intentFor({ messageId: 101, index: 0 }), { store, sender });

  assert.equal(stale.ok, false, 'a stale tap must be REFUSED');
  assert.equal(stale.code, TAP_REFUSALS.STALE_CARD);
  assert.equal(stale.refresh, true, 'the refusal must offer a refresh');
  assert.equal(stale.candidateId, undefined, 'a refused tap must not resolve to ANY product');
  assert.notEqual(stale.candidateId, C.id, 'it must certainly not resolve to the reordered product');
  assert.equal(stale.currentRenderVersion, 2);
  assert.deepEqual(stale.currentCard, { chatId: String(CHAT), messageId: '102' });

  // Nothing was written, and the question is still open for the CURRENT card.
  assert.equal(store.rows[0].status, 'open');
  assert.equal(store.rows[0].answer_text, null);
  assert.ok(!store.calls.includes('recordAnswer'), 'a stale tap must never reach the write path');

  // Warwick is TOLD, in a popup, not a silent toast.
  const ack = sender.acks.at(-1);
  assert.equal(ack.showAlert, true);
  assert.match(ack.text, /out of date/i);

  // …and the SAME tap on the CURRENT card resolves correctly.
  const fresh = await resolveTap(intentFor({ messageId: 102, index: 0, id: 'cbq-2' }), { store, sender });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.candidateId, C.id);
});

test('an index past the end of the stored list is treated as staleness, not as a bad tap', async () => {
  // The re-render dropped a candidate; the old card still shows three.
  const { store } = await seed({ candidates: [A, B] });
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 100, index: 2 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.INDEX_OUT_OF_RANGE);
  assert.equal(out.refresh, true);
  assert.equal(out.renderedCount, 2);
  assert.equal(store.rows[0].status, 'open');
});

test('a pinned render version or fingerprint that disagrees with the stored one is refused', async () => {
  const { store, contract } = await seed();
  const sender = createFakeSender();

  const byVersion = await resolveTap(intentFor({ messageId: 100, index: 1 }), {
    store, sender, expectedRenderVersion: 2,
  });
  assert.equal(byVersion.ok, false);
  assert.equal(byVersion.code, TAP_REFUSALS.STALE_CARD);
  assert.equal(byVersion.actualRenderVersion, 1);

  const byFingerprint = await resolveTap(intentFor({ messageId: 100, index: 1, id: 'cbq-2' }), {
    store, sender, expectedRenderFingerprint: `${contract.renderFingerprint.slice(0, 63)}0`,
  });
  assert.equal(byFingerprint.ok, false);
  assert.equal(byFingerprint.code, TAP_REFUSALS.STALE_CARD);

  assert.equal(store.rows[0].status, 'open', 'neither refusal may write');
});

// ── other refusals ───────────────────────────────────────────────────────────

test('an UNKNOWN message is refused — no contract, no answer', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 999, index: 0 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.STALE_CARD, 'the question exists, so this is a superseded card');

  // A message for a question that does not exist at all.
  const empty = createFakeStore();
  const none = await resolveTap(intentFor({ messageId: 999, index: 0, id: 'cbq-2' }), { store: empty, sender });
  assert.equal(none.ok, false);
  assert.equal(none.code, TAP_REFUSALS.UNKNOWN_CARD);
  assert.equal(none.refresh, true);
});

test('a button whose question key does not match the card it sits on is refused', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 100, index: 0, questionKey: 'q9' }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.QUESTION_MISMATCH);
  assert.equal(store.rows[0].status, 'open');
});

test('a button carrying a different shop ref is refused', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 100, index: 0, shopRef: 'shop-2026-07-21' }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.SHOP_MISMATCH);
});

test('a stored contract that no longer matches its fingerprint is refused, not trusted', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  // Somebody rewrote the list without re-sealing it — the exact corruption the
  // fingerprint exists to catch.
  store.rows[0].rendered_candidates = [C, B, A].map((c, i) => ({ index: i, id: c.id, label: c.label }));
  const out = await resolveTap(intentFor({ messageId: 100, index: 0 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.CONTRACT_CORRUPT);
  assert.equal(store.rows[0].status, 'open');
});

test('a skipped question refuses further taps', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  store.rows[0].status = 'skipped';
  const out = await resolveTap(intentFor({ messageId: 100, index: 0 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.QUESTION_SKIPPED);
});

test('a store that cannot be reached refuses the tap rather than guessing', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  store.getQuestionByCard = async () => { throw new Error('connection lost'); };
  const out = await resolveTap(intentFor({ messageId: 100, index: 0 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.STORE_FAILED);
  assert.equal(sender.acks.length, 1);
});

test('a non-answer callback and an answer with no arg are both refused here', async () => {
  const { store } = await seed();
  const sender = createFakeSender();

  const status = await resolveTap(intentFor({ messageId: 100, index: 0, action: ACTIONS.STATUS }), { store, sender });
  assert.equal(status.ok, false);
  assert.equal(status.code, TAP_REFUSALS.NOT_AN_ANSWER);

  // `answer` with no arg means "open the question queue" — a real intent, but not this module's.
  const queue = await resolveTap(routeAsdairUpdate({
    callback_query: { id: 'cbq-q', from: { id: 9 }, data: buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF }), message: { message_id: 100, chat: { id: CHAT } } },
  }), { store, sender });
  assert.equal(queue.ok, false);
  assert.equal(queue.code, TAP_REFUSALS.NOT_AN_ANSWER);
});

test('a tap with no card identity is refused rather than correlated by question key alone', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const intent = routeAsdairUpdate({
    callback_query: {
      id: 'cbq-1', from: { id: 9 },
      data: buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF, arg: buildAnswerArg(KEY, 0) }),
    },
  });
  const out = await resolveTap(intent, { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.NO_CARD_IDENTITY);
});

test('resolveTap fails closed on a store that does not implement the contract', async () => {
  await assert.rejects(() => resolveTap(intentFor({ messageId: 100, index: 0 }), {}), /a store must be injected/);
  await assert.rejects(
    () => resolveTap(intentFor({ messageId: 100, index: 0 }), { store: { getQuestionByCard() {} } }),
    /store.getQuestionByKey\(\) is required/,
  );
});

// ── the spinner ALWAYS stops ─────────────────────────────────────────────────

test('answerCallbackQuery is emitted on EVERY path, success and refusal alike', async () => {
  const scenarios = [
    ['happy', async () => { const s = await seed(); return [s.store, intentFor({ messageId: 100, index: 0 })]; }],
    ['stale card', async () => { const s = await seed(); return [s.store, intentFor({ messageId: 777, index: 0 })]; }],
    ['unknown card', async () => [createFakeStore(), intentFor({ messageId: 777, index: 0 })]],
    ['index out of range', async () => { const s = await seed({ candidates: [A] }); return [s.store, intentFor({ messageId: 100, index: 2 })]; }],
    ['question mismatch', async () => { const s = await seed(); return [s.store, intentFor({ messageId: 100, index: 0, questionKey: 'q9' })]; }],
    ['shop mismatch', async () => { const s = await seed(); return [s.store, intentFor({ messageId: 100, index: 0, shopRef: 'other-shop' })]; }],
    ['skipped', async () => { const s = await seed(); s.store.rows[0].status = 'skipped'; return [s.store, intentFor({ messageId: 100, index: 0 })]; }],
    ['corrupt contract', async () => { const s = await seed(); s.store.rows[0].render_fingerprint = 'not-the-hash'; return [s.store, intentFor({ messageId: 100, index: 0 })]; }],
    ['store failure', async () => { const s = await seed(); s.store.getQuestionByCard = async () => { throw new Error('down'); }; return [s.store, intentFor({ messageId: 100, index: 0 })]; }],
    ['not an answer', async () => { const s = await seed(); return [s.store, intentFor({ messageId: 100, index: 0, action: ACTIONS.STATUS })]; }],
    ['already answered', async () => {
      const s = await seed();
      const snd = createFakeSender();
      await resolveTap(intentFor({ messageId: 100, index: 0 }), { store: s.store, sender: snd });
      return [s.store, intentFor({ messageId: 100, index: 0, id: 'cbq-2' })];
    }],
  ];

  for (const [name, setup] of scenarios) {
    const [store, intent] = await setup();
    const sender = createFakeSender();
    const out = await resolveTap(intent, { store, sender });
    assert.equal(sender.acks.length, 1, `${name}: the spinner was left running`);
    assert.equal(sender.acks[0].callbackQueryId, intent.raw.callbackQueryId, `${name}: acked the wrong query`);
    assert.equal(out.acknowledged, true, `${name}: result did not report the acknowledgement`);
    assert.ok(typeof sender.acks[0].text === 'string' && sender.acks[0].text.length > 0, `${name}: acked with no text`);
    if (!out.ok) assert.equal(sender.acks[0].showAlert, true, `${name}: a refusal must be VISIBLE, not a toast`);
  }
});

test('an acknowledgement that fails does not turn a resolved tap into an unresolved one', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  sender.answerCallbackQuery = async () => { throw new Error('ack failed'); };
  const out = await resolveTap(intentFor({ messageId: 100, index: 1 }), { store, sender });
  assert.equal(out.ok, true);
  assert.equal(out.candidateId, B.id);
  assert.equal(out.acknowledged, false);
  assert.equal(typeof out.ackError, 'string');
  assert.equal(store.rows[0].status, 'answered');
});

// ── the wiring ───────────────────────────────────────────────────────────────

test('handleAsdairTap takes a raw Telegram update straight through router -> resolver', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await handleAsdairTap(tapUpdate({ messageId: 100, index: 2 }), { store, sender });
  assert.equal(out.ok, true);
  assert.equal(out.routed, true);
  assert.equal(out.candidateId, C.id);
  assert.equal(out.intent.responder, 'telegram:9');
  assert.equal(store.rows[0].status, 'answered');
});

test('handleAsdairTap does NOT acknowledge a foreign callback — the hub keeps its own spinner', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await handleAsdairTap({
    callback_query: { id: 'hub-1', from: { id: 9 }, data: 'decision:card-1:A', message: { message_id: 100, chat: { id: CHAT } } },
  }, { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.routed, false);
  assert.equal(sender.acks.length, 0);
});

test('handleAsdairTap hands a TYPED reply back unresolved — matching words to a candidate is a decision', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await handleAsdairTap({
    message: {
      message_id: 501, chat: { id: CHAT }, from: { id: 9 },
      text: 'the Yeo Valley one', reply_to_message: { message_id: 100 },
    },
  }, { store, sender, resolveQuestionByMessage: () => ({ questionKey: KEY, shopRef: REF }) });
  assert.equal(out.ok, false);
  assert.equal(out.code, TAP_REFUSALS.NOT_A_TAP);
  assert.equal(out.routed, true);
  assert.equal(out.intent.arg, KEY);
  assert.equal(store.rows[0].status, 'open');
});

// ── secret hygiene ───────────────────────────────────────────────────────────

test('NO token can leak into a result, a refusal, an error or the console', async () => {
  const TOKEN = '1234567890:AAH-thisIsAFakeShopperBotTokenValue_do_not_use';
  const seen = [];
  const write = (chunk) => { seen.push(String(chunk)); return true; };
  const realOut = process.stdout.write;
  const realErr = process.stderr.write;
  process.stdout.write = write;
  process.stderr.write = write;

  let results;
  try {
    // A REAL sender, built on the token, whose every Telegram call fails in a way
    // that echoes the request URL back — the classic leak vector.
    const sender = createShopperSender({
      botToken: TOKEN,
      apiBase: 'https://api.telegram.invalid',
      fetchImpl: async (url) => ({
        async json() { return { ok: false, description: `Bad Request: ${url}` }; },
        status: 400,
      }),
    });
    const { store } = await seed();
    results = [
      await resolveTap(intentFor({ messageId: 100, index: 1 }), { store, sender }),
      await resolveTap(intentFor({ messageId: 777, index: 1, id: 'cbq-2' }), { store, sender }),
      await handleAsdairTap(tapUpdate({ messageId: 100, index: 0, id: 'cbq-3' }), { store, sender }),
    ];
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }

  const blob = JSON.stringify(results);
  assert.ok(!blob.includes(TOKEN), 'the bot token reached a returned result');
  assert.ok(!blob.includes('AAH-thisIsAFakeShopperBotTokenValue'), 'the token body reached a returned result');
  assert.equal(seen.length, 0, `these modules must not print anything: ${seen.join('')}`);
  // The resolve still succeeded even though every Telegram call failed.
  assert.equal(results[0].ok, true);
  assert.equal(results[0].acknowledged, false);
  assert.ok(!String(results[0].ackError).includes(TOKEN), 'the token reached the ack error');
});

test('no rendered candidate label or product id is ever fabricated on a refusal', async () => {
  const { store } = await seed();
  const sender = createFakeSender();
  const out = await resolveTap(intentFor({ messageId: 404, index: 1 }), { store, sender });
  assert.equal(out.ok, false);
  assert.equal(out.candidateId, undefined);
  assert.equal(out.candidateLabel, undefined);
  assert.equal(out.answerText, undefined);
});
