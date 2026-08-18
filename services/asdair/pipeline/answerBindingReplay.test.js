// =====================================================================
// WO-2026-08-18-03 AC3 - THE NINE REAL ANSWERS, REPLAYED.
//
// The corpus is `testdata/2026-08-17-shop-33-answers.json`: the nine rows
// of `asdair.shop_question` for shop 33, the photographed weekly list
// that was cancelled. Real question text, Warwick's real words, and the
// question each was ACTUALLY written to.
//
// ── WHY THE HARNESS INJECTS A CORRELATOR, AND WHY THAT IS NOT A STUB
//    PROVING ITSELF ──────────────────────────────────────────────────
//
// With nine questions open, NOTHING in this product binds a free-text
// answer except step 3 - Terra. The plain harness wires no correlator at
// all, so every answer would bind to nothing, "zero bound to a different
// question" would pass on the UNREPAIRED code, and the mutation could
// not bite. That green would retire the question while proving nothing.
//
// So the correlator injected here REPRODUCES WHAT PRODUCTION ACTUALLY
// DID, read off the durable rows: each answer is mapped, at `high`
// confidence, to the question it was really written to on 2026-08-17.
// The stub is not the thing under test - it is the recorded input. What
// is under test is whether this product still writes those rows.
//
// ── WHAT THE TIMESTAMPS SAY, AND WHAT THIS FILE DELIBERATELY DOES ────
//
// All seven answers were written between 18:19:19.475Z and 18:19:21.938Z
// - 2.5 seconds, ~350ms apart. That is a batch, not a man typing. The
// main replay feeds them ONE PER PASS anyway, giving the product the
// FRESHEST possible open set at every step, so any mis-bind that still
// happens cannot be blamed on a stale read. The second test then feeds
// all seven in ONE pass, which is the real shape, and holds the same
// line.
//
// FULLY OFFLINE. Fake pg, injected bot, injected correlator. No
// database, no network, no credentials, no live runtime.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { makeHarness, makeIntake, HOUSEHOLD_ID } from './test/harness.js';
import { runOnce } from './runtime.js';
import { questionKeyFor } from './keys.js';
import { sendQuestionCard } from '../bot/questionRender.js';

const CORPUS = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'testdata', '2026-08-17-shop-33-answers.json'), 'utf8'),
);
const ROWS = CORPUS.rows;

/** The headline of the AC2 card. Asserting on the text he would actually read
 *  is the point: an enqueue nobody renders is a silent loss wearing a fix's
 *  clothes, and drainOutbox abandons a kind with no registered renderer. */
const ASK_HEADLINE = 'I could not tell which question that answers';

// ── the fixture: a PHOTO shop carrying all nine questions ───────────────────

function photoTgUpdate({ updateId = 1, chatId = 555, messageId = 900 } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      photo: [{ file_id: 'BIG', file_unique_id: 'u', width: 720, height: 1280, file_size: 99139 }],
    },
  };
}

/** A bare typed message - no reply_to, no card, no number. The shape Warwick
 *  used on 2026-08-17: he types the answer, he does not press buttons. */
function typed({ updateId, text, chatId = 555, messageId = 7000 }) {
  return {
    update_id: updateId,
    message: { message_id: messageId, from: { id: chatId }, chat: { id: chatId, type: 'private' }, text },
  };
}

async function makeBot() {
  const router = await import('../bot/inboundRouter.js');
  const messages = await import('../bot/renderMessages.js');
  const callback = await import('../bot/callbackProtocol.js');
  const sent = [];
  return {
    sent,
    routeAsdairUpdate: router.routeAsdairUpdate,
    parseAnswerArg: callback.parseAnswerArg,
    messages: messages.MESSAGES,
    chatId: '555',
    send: async (chatId, message) => { sent.push({ chatId, message }); return { message_id: sent.length }; },
    answerTap: async () => true,
    resolveQuestionByMessage: () => null,
    resolveCandidate: () => null,
  };
}

function makeQuestionStore(h) {
  const rowOf = (shopId, questionKey) =>
    h.db.shop_question.find((q) => String(q.shop_id) === String(shopId) && q.question_key === questionKey);
  const shopIdOf = (shopRef) => (h.db.shop.find((s) => s.shop_ref === shopRef) || {}).id;
  const withRef = (row) => (row
    ? { ...row, shop_ref: (h.db.shop.find((s) => s.id === row.shop_id) || {}).shop_ref }
    : null);
  return {
    async getQuestionByKey({ shopRef, questionKey }) { return withRef(rowOf(shopIdOf(shopRef), questionKey)); },
    async getQuestionByCard({ chatId, messageId }) {
      return withRef(h.db.shop_question.find((q) => String(q.card_chat_id) === String(chatId)
        && String(q.card_message_id) === String(messageId)));
    },
    async saveRender({ shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint, renderVersion }) {
      const row = rowOf(shopIdOf(shopRef), questionKey);
      if (!row) return null;
      row.card_chat_id = String(chatId);
      row.card_message_id = String(messageId);
      row.rendered_candidates = renderedCandidates;
      row.render_fingerprint = renderFingerprint;
      row.render_version = renderVersion;
      return withRef(row);
    },
  };
}

async function makeAskingBot(h) {
  const bot = await makeBot();
  const questions = makeQuestionStore(h);
  const cards = [];
  const sender = {
    async sendMessage(chatId, message) { cards.push({ chatId, message }); return { message_id: 9000 + cards.length, chat: { id: chatId } }; },
    async editMessageText() { return {}; },
  };
  bot.cards = cards;
  bot.questions = questions;
  bot.sendQuestionCard = (spec) => sendQuestionCard({ sender, store: questions, ...spec });
  return bot;
}

/** THE 17 AUGUST QUEUE: a photo shop with all nine questions open at once,
 *  which is what one planning pass produced on the real run. */
async function nineQuestionPhotoShop() {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([photoTgUpdate()]), bot });
  const shop = h.db.shop[0];
  assert.equal(shop.source_kind, 'photo',
    'this fixture must be a PHOTO shop or it proves nothing about the door that failed');

  const keys = [];
  for (const row of ROWS) {
    const questionKey = questionKeyFor(row.item);
    await h.deps.shopStore.openQuestion({
      shop_id: shop.id,
      question_key: questionKey,
      question_text: row.questionText,
      candidates: [],
    });
    keys.push(questionKey);
  }
  assert.equal(new Set(keys).size, 9, 'nine distinct questions');
  assert.equal(h.db.shop_question.filter((q) => q.status === 'open').length, 9,
    'all nine open AT ONCE - which is why step 2 was structurally unreachable');
  return { h, bot, shop, keys };
}

/**
 * THE RECORDED PRODUCTION BEHAVIOUR, as an injected correlator.
 *
 * Maps each answer to the question it was ACTUALLY written to on 2026-08-17,
 * at the `high` confidence the real correlator claimed. Rows 1-3 are correct;
 * from row 4 the answer lands one question above where it belongs. This is not
 * a guess about Terra - it is the durable rows played back.
 */
function slideCorrelator(keys) {
  return async ({ answer_text: answerText, questions }) => {
    const row = ROWS.find((r) => r.answerText === answerText);
    if (!row) return { mappings: [] };
    const questionKey = keys[row.n - 1];
    const offered = (questions || []).some((q) => q.question_key === questionKey);
    if (!offered) return { mappings: [] };
    return { mappings: [{ question_key: questionKey, confidence: 'high', answer_text: answerText }] };
  };
}

const rowOf = (h, key) => h.db.shop_question.find((q) => q.question_key === key);
const asked = (bot) => bot.sent.filter((s) => s.message && String(s.message.text).includes(ASK_HEADLINE));

/**
 * THE ACCEPTANCE NUMBER. How many of Warwick's answers ended up recorded
 * against a question they do not answer?
 *
 * Counted ONLY over rows whose correct target is ESTABLISHED. Rows 6 and 8 are
 * recorded in the corpus as ambiguous and not-established respectively, and the
 * Work Order forbids resolving them to make a cleaner test - so they can be
 * neither a correct bind nor a mis-bind here, and they are excluded rather than
 * quietly counted as passes.
 */
function boundToADifferentQuestion(h, keys) {
  const offences = [];
  for (const row of ROWS) {
    if (row.establishment !== 'established' || row.answerText === null) continue;
    const landed = h.db.shop_question.find((q) => q.answer_text === row.answerText);
    if (!landed) continue;                       // bound to nothing - the ask path, not a mis-bind
    const correctKey = keys[row.answersQuestion - 1];
    if (landed.question_key !== correctKey) {
      offences.push({ n: row.n, answersQuestion: row.answersQuestion, landedOn: landed.question_key });
    }
  }
  return offences;
}

/** The nine-row evidence table the Work Order asks for, printed from the real
 *  post-replay state rather than written by hand. */
function reportTable(h, keys) {
  const lines = ['', '  #  answers  bound to  status   verdict'];
  for (const row of ROWS) {
    const landed = row.answerText === null
      ? null
      : h.db.shop_question.find((q) => q.answer_text === row.answerText);
    const landedN = landed ? keys.indexOf(landed.question_key) + 1 : null;
    const own = rowOf(h, keys[row.n - 1]);
    let verdict;
    if (row.answerText === null) verdict = 'never recorded on the real run - left open';
    else if (landedN === null) verdict = 'bound to nothing, and he was asked';
    else if (row.answersQuestion === null) verdict = 'BOUND WITHOUT AN ESTABLISHED TARGET';
    else verdict = landedN === row.answersQuestion ? 'bound correctly' : 'MIS-BOUND';
    lines.push(`  ${row.n}  ${String(row.answersQuestion ?? '-').padEnd(7)}  ${String(landedN ?? '-').padEnd(8)}  ${String(own.status).padEnd(7)}  ${verdict}`);
  }
  return lines.join('\n');
}

// =====================================================================
// AC3 - THE REPLAY
// =====================================================================

test('⭐ AC3 THE NINE REAL ANSWERS OF 2026-08-17, replayed against the nine-question photo queue', async () => {
  const { h, bot, keys } = await nineQuestionPhotoShop();
  h.deps.correlateAnswer = slideCorrelator(keys);

  // One per pass: the product gets the freshest possible open set every time,
  // so nothing here can be blamed on a stale read.
  let updateId = 800;
  for (const row of ROWS) {
    if (row.answerText === null) continue;      // rows 7 and 9 were never recorded
    updateId += 1;
    await runOnce(h.deps, {
      householdId: HOUSEHOLD_ID,
      bot,
      questions: bot.questions,
      intake: makeIntake([typed({ updateId, text: row.answerText, messageId: updateId })]),
    });
  }
  // Flush the outbox so what he would actually READ has been sent.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake([]) });

  console.log(reportTable(h, keys));

  // ── THE ACCEPTANCE PROPERTY. A LITERAL ZERO, pinned. ─────────────────────
  const offences = boundToADifferentQuestion(h, keys);
  assert.deepEqual(offences, [],
    `an answer was recorded against a question it does not answer: ${JSON.stringify(offences)}`);
  assert.equal(offences.length, 0, 'the count of answers bound to a DIFFERENT question must be exactly 0');

  // ── rows 1-3 bound correctly on the real run and must NOT regress ────────
  for (const n of [1, 2, 3]) {
    const row = rowOf(h, keys[n - 1]);
    assert.equal(row.status, 'answered', `question ${n} must still be answered`);
    assert.equal(row.answer_text, ROWS[n - 1].answerText, `question ${n} must carry his exact words`);
  }

  // ── rows 4 and 5 are the discriminating ones ─────────────────────────────
  for (const n of [4, 5]) {
    const row = rowOf(h, keys[n - 1]);
    assert.equal(row.status, 'open', `question ${n} must NOT have absorbed an answer to another question`);
    assert.equal(row.answer_text, null, `question ${n} must carry nothing`);
  }

  // ── rows 6 and 8 are honestly unresolvable, so they are asked about ──────
  for (const n of [6, 8]) {
    const row = rowOf(h, keys[n - 1]);
    assert.equal(row.status, 'open', `question ${n} is not established and must not be written`);
    assert.equal(row.answer_text, null);
  }

  // ── rows 7 and 9 were never recorded on the real run ─────────────────────
  for (const n of [7, 9]) {
    const row = rowOf(h, keys[n - 1]);
    assert.equal(row.status, 'open');
    assert.equal(row.answer_text, null);
  }

  // ── AC2: NOT ONE OF THEM WAS SILENTLY DROPPED ────────────────────────────
  // Four answers could not be placed, and he was asked about all four -
  // through the ordinary Telegram surface, as text he can reply to.
  assert.equal(asked(bot).length, 4,
    'every answer that could not be placed must produce a question back - refusing in silence is the failure, not the fix');
});

test('AC2 THE ASK IS ANSWERABLE WITHOUT A TECHNICAL BRIDGE - it carries the board numbers and his own words', async () => {
  const { h, bot, keys } = await nineQuestionPhotoShop();
  h.deps.correlateAnswer = slideCorrelator(keys);

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 901, text: ROWS[3].answerText, messageId: 901 })]),
  });
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake([]) });

  const cards = asked(bot);
  assert.equal(cards.length, 1);
  const { text } = cards[0].message;

  assert.ok(text.includes('Ice lollies are in favourites. stupid question'),
    'it quotes what he said back, so he knows exactly which message is being asked about');
  assert.ok(text.includes('I have NOT recorded it against anything'),
    'it says plainly that nothing was written');
  assert.ok(/\n\s+5\. .*fruit lolly ice/.test(text),
    'the question he actually meant is listed, with the board number that answers it');
  assert.ok(text.includes('5: the ones in favourites'),
    'it shows him the reply shape parseBoardReply already accepts - an ordinary typed reply');

  // NO NEW COMMAND AND NO NEW CALLBACK ACTION. The one button is the ANSWER
  // action that already exists; the 12-name command allowlist is untouched.
  const buttons = (cards[0].message.reply_markup.inline_keyboard || []).flat();
  assert.equal(buttons.length, 1);
  assert.ok(String(buttons[0].callback_data).includes('answer'));
});

test('AC3 THE 2.5-SECOND BATCH: all seven in ONE pass, against a deliberately stale open set', async () => {
  // The real shape. `openQuestions` is read once at the top of a pass, so every
  // answer in this batch is correlated against a set that still lists questions
  // settled earlier in the same pass. The gate holds there too.
  const { h, bot, keys } = await nineQuestionPhotoShop();
  h.deps.correlateAnswer = slideCorrelator(keys);

  const batch = ROWS.filter((r) => r.answerText !== null)
    .map((r, i) => typed({ updateId: 950 + i, text: r.answerText, messageId: 950 + i }));
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake(batch) });
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake([]) });

  assert.deepEqual(boundToADifferentQuestion(h, keys), [],
    'the count of answers bound to a DIFFERENT question must be exactly 0 in the batch shape too');
  for (const n of [4, 5]) {
    assert.equal(rowOf(h, keys[n - 1]).answer_text, null, `question ${n} carries nothing`);
  }
});

// =====================================================================
// THE REFUSAL IS NOT A DROP - the failure this repair must not become.
// =====================================================================

test('a refused answer is CLAIMED, never handed back to intake as a new shopping list', async () => {
  const { h, bot, keys } = await nineQuestionPhotoShop();
  h.deps.correlateAnswer = slideCorrelator(keys);
  const shopsBefore = h.db.shop.length;

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 970, text: ROWS[3].answerText, messageId: 970 })]),
  });

  assert.equal(h.db.shop.length, shopsBefore,
    'his answer must not become a phantom second shop - that would be worse than the defect being fixed');
});

test('the ask is minted ONCE per message, however many times Telegram redelivers it', async () => {
  const { h, bot, keys } = await nineQuestionPhotoShop();
  h.deps.correlateAnswer = slideCorrelator(keys);

  const update = typed({ updateId: 980, text: ROWS[3].answerText, messageId: 980 });
  for (let i = 0; i < 3; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake([update]) });
  }
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, bot, questions: bot.questions, intake: makeIntake([]) });

  assert.equal(asked(bot).length, 1,
    'a redelivered message must not mint a new generation on every pass and rebuild the notification storm');
});

// =====================================================================
// THE GATE MUST NOT BECOME A MUTE BUTTON.
// =====================================================================

test('⭐ A CORROBORATED MAPPING STILL BINDS - the repair refuses wrong answers, not all answers', async () => {
  const { h, bot, keys } = await nineQuestionPhotoShop();
  // The SAME words that were refused against question 4, now mapped to the
  // question they actually answer. If this does not bind, the repair has
  // silenced the product instead of correcting it.
  h.deps.correlateAnswer = async ({ answer_text: answerText }) => ({
    mappings: [{ question_key: keys[4], confidence: 'high', answer_text: answerText }],
  });

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 990, text: ROWS[3].answerText, messageId: 990 })]),
  });

  const row = rowOf(h, keys[4]);
  assert.equal(row.status, 'answered', 'a mapping the words DO support must still bind');
  assert.equal(row.answer_text, 'Ice lollies are in favourites. stupid question');
  assert.equal(asked(bot).length, 0, 'and he is not asked about an answer that placed cleanly');
});
