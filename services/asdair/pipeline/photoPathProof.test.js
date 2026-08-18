// =====================================================================
// BUILD-015 AsdAIr - WO-2026-08-18-01: THE PHOTO DOOR, PROVEN BY EXECUTION.
//
// On 2026-08-17 a real weekly shop was attempted three times and the PHOTO
// door produced three defects. Attempt 3 reached the freeze point by switching
// to the TEXT door - a legitimate way to get a shop, and NOT evidence that the
// photo path works. Every claim in this file is therefore made against a
// `kind:'photo'` payload driven through the production loop, never against a
// text payload and never against a README.
//
// WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY IS NOT.
//
// It is a PROOF file, not a repair. Where the product is correct it says so
// with an assertion that dies if the fix is reverted. Where the product is
// still wrong it says THAT, with a test that asserts the CORRECT behaviour and
// carries a `todo` marker naming the defect - never an assertion of the
// observed-and-wrong behaviour, which would pin the defect in place and go
// green while doing it.
//
// FULLY OFFLINE. The fake in-memory pg, an injected Telegram client, injected
// model functions. No database, no network, no credentials, no live runtime.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { makeHarness, makeIntake, textUpdate, callbackUpdate, HOUSEHOLD_ID } from './test/harness.js';
import { runOnce } from './runtime.js';
import { COMMANDS, COMMAND_NAMES } from './commandNames.js';
import { questionKeyFor } from './keys.js';
import { sendQuestionCard } from '../bot/questionRender.js';

const here = import.meta.dirname;
const REF = 'SHOP-2026-08-03';
const read = (...p) => fs.readFileSync(path.join(here, ...p), 'utf8');

// =====================================================================
// FIXTURES - the inbound wire, as Telegram actually delivers it.
// =====================================================================

/** A raw Telegram PHOTO update. The dimensions are Mum's real ones: Telegram's
 *  largest size for her 17 August list was 720 x 1280. */
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

/** A bare typed message - no reply_to. This is the shape Warwick used on
 *  2026-08-17: he types the answer, he does not press buttons. */
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

/** The durable render contract, backed by the fake database - the same shape
 *  runtime.test.js uses, so a reply is correlated the way production does it. */
function makeQuestionStore(h) {
  const rowOf = (shopId, questionKey) =>
    h.db.shop_question.find((q) => String(q.shop_id) === String(shopId) && q.question_key === questionKey);
  const shopIdOf = (shopRef) => (h.db.shop.find((s) => s.shop_ref === shopRef) || {}).id;
  const withRef = (row) => (row
    ? { ...row, shop_ref: (h.db.shop.find((s) => s.id === row.shop_id) || {}).shop_ref }
    : null);
  return {
    async getQuestionByKey({ shopRef, questionKey }) {
      return withRef(rowOf(shopIdOf(shopRef), questionKey));
    },
    async getQuestionByCard({ chatId, messageId }) {
      const row = h.db.shop_question.find((q) => String(q.card_chat_id) === String(chatId)
        && String(q.card_message_id) === String(messageId));
      return withRef(row);
    },
    async saveRender({
      shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint, renderVersion,
    }) {
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
    async sendMessage(chatId, message) {
      cards.push({ chatId, message });
      return { message_id: 9000 + cards.length, chat: { id: chatId } };
    },
    async editMessageText() { return {}; },
  };
  bot.cards = cards;
  bot.questions = questions;
  bot.sendQuestionCard = (spec) => sendQuestionCard({ sender, store: questions, ...spec });
  return bot;
}

const questionRow = (h, key) => h.db.shop_question.find((q) => q.question_key === key);

/**
 * Drive a shop from the INBOUND UPDATE to a resolved shop line, recording what
 * it traversed. `kind` selects the door; everything else is identical, which is
 * what makes the two call sequences comparable evidence.
 */
async function driveOneShop(kind, { passes = 4 } = {}) {
  const h = makeHarness({
    modelLines: [
      { line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 },
      { line_no: 2, raw_reading: '1 weetabix protein', quantity: 1 },
    ],
  });
  const bot = await makeBot();
  const inbound = kind === 'photo'
    ? photoTgUpdate()
    : textUpdate({ text: '3 gourmet cat food\n1 weetabix protein' });

  const statuses = [];
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([inbound]), bot });
  statuses.push(h.db.shop[0].status);
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    intake: makeIntake([callbackUpdate({ updateId: 2, data: `asd:build:${REF}` })]),
    bot,
  });
  statuses.push(h.db.shop[0].status);
  for (let i = 0; i < passes; i += 1) {
    await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]), bot });
    statuses.push(h.db.shop[0].status);
  }
  return { h, bot, statuses, deps: h.calls.map((c) => c.dep), shop: h.db.shop[0] };
}

// =====================================================================
// AC1 - THE PHOTO PATH, TRACED BY EXECUTION.
//
// The trace is the ORDERED SEQUENCE OF DEPENDENCY CALLS the loop actually
// made, captured by the harness as the production modules ran. It is not read
// off a README and it is not a list of imports: an imported module proves
// nothing about whether the payload went through it.
// =====================================================================

test('AC1 a kind:photo payload traverses intake -> receiveList -> TRANSCRIBING -> the vision read -> resolved lines', async () => {
  const { statuses, deps, shop } = await driveOneShop('photo');

  // The inbound wire really was a photograph, and the receive path recorded it
  // as one - source_kind and the review flag are both set by runtime.js's
  // persist(), before the Telegram offset moves.
  assert.equal(shop.source_kind, 'photo');
  assert.equal(shop.needs_review, true,
    'a photographed list is ALWAYS a list that was read rather than typed, and must be flagged for review');
  assert.ok(shop.raw_media_path, 'the downloaded media path must be bound at receive, not discovered later');

  // THE ORDERED TRACE. Each step is performed by a named module:
  //   loadCatalogue        interpret/loadCatalogue.js   (via deps.js)
  //   buildGroundedPrompt  interpret/groundedPrompt.js
  //   prepareImage         transcribe/prepareImage.js   (via deps.js realPrepareImage)
  //   interpretPhoto       deps.js realInterpretPhoto -> the vision gateway
  //   resolveAll           interpret/resolveByCatalogue.js
  //   executeIntents       control-plane asdairCommands.mjs -> asdair.shop_line
  const upToLines = deps.slice(0, deps.indexOf('executeIntents') + 1);
  assert.deepEqual(upToLines, [
    'loadCatalogue', 'buildGroundedPrompt', 'prepareImage', 'interpretPhoto', 'resolveAll', 'executeIntents',
  ], 'the photo path changed shape - re-run the trace before trusting anything else in this file');

  // TRANSCRIBING is the state only a photograph has: stages.js sends a photo
  // shop there and a typed list straight to PROCESSING.
  assert.ok(statuses.includes('TRANSCRIBING'), 'a photo list must be READ before it can be interpreted');
  assert.equal(statuses[0], 'RECEIVED');
});

test('AC1 WHERE THE TWO DOORS DIVERGE, AND WHERE THEY REJOIN - measured, not asserted from prose', async () => {
  const photo = await driveOneShop('photo');
  const text = await driveOneShop('text');

  // DIVERGE. Both doors load the household catalogue first (the grounding
  // invariant). What happens NEXT is the whole difference.
  assert.equal(photo.deps[0], 'loadCatalogue');
  assert.equal(text.deps[0], 'loadCatalogue');

  const photoReadSteps = photo.deps.slice(1, photo.deps.indexOf('resolveAll'));
  const textReadSteps = text.deps.slice(1, text.deps.indexOf('resolveAll'));
  assert.deepEqual(photoReadSteps, ['buildGroundedPrompt', 'prepareImage', 'interpretPhoto'],
    'the photo door reads pixels: prompt, prepare, one vision call');
  assert.deepEqual(textReadSteps, ['shopperRoute'],
    'the text door parses words and never touches an image');

  // REJOIN. From resolveAll onwards the two are the SAME machinery: the
  // catalogue resolver decides identity, and executeIntents writes the lines.
  // Everything downstream of here - questions, the board, answer binding,
  // first-answer-wins - is therefore shared, which is why a defect proven on
  // one door is NOT thereby proven fixed on the other.
  const from = (t) => t.deps.slice(t.deps.indexOf('resolveAll'), t.deps.indexOf('executeIntents') + 1);
  assert.deepEqual(from(photo), ['resolveAll', 'executeIntents']);
  assert.deepEqual(from(text), ['resolveAll', 'executeIntents']);

  // THE PHOTO-ONLY GATE. A photo shop parks for human confirmation of the
  // READING; a typed list never does, because nothing read it.
  assert.ok(photo.statuses.includes('TRANSCRIBING'));
  assert.ok(!text.statuses.includes('TRANSCRIBING'));
  assert.equal(photo.shop.needs_review, true);
  assert.equal(text.shop.needs_review, false);
});

// =====================================================================
// AC2 - DEFECT 1, TERRA INVENTION. Is the preparation step ON the live path?
//
// "2 sliced roast beef" came back as "2 skinny cow bars" from a 720x1280
// photograph - about 34 pixels per handwritten line. prepareImage.js is the
// claimed fix. The question this answers is not whether it works (its own
// suite proves that against Mum's actual photograph) but whether the LIVE
// PHOTO PATH REACHES IT.
// =====================================================================

test('AC2 the LIVE photo path invokes the preparation step BEFORE the model reads anything', async () => {
  const { deps } = await driveOneShop('photo');
  const prepAt = deps.indexOf('prepareImage');
  const modelAt = deps.indexOf('interpretPhoto');
  assert.notEqual(prepAt, -1,
    'the photograph reached the model exactly as Telegram compressed it - that is where the invention came from');
  assert.notEqual(modelAt, -1);
  assert.ok(prepAt < modelAt, 'preparation AFTER the read is not preparation');
});

test('AC2 the PRODUCTION container binds the real preparer - not merely something callable', async () => {
  // The defect class this guards is the one this build has paid for three
  // times: a component that is complete, tested, and reachable only from its
  // own test file. `typeof === function` does not catch it, because the test
  // harness binds a stub of the same type.
  const { createDeps } = await import('./deps.js');
  const bound = createDeps().prepareImage;
  assert.equal(typeof bound, 'function');
  assert.equal(bound.name, 'realPrepareImage',
    'deps.prepareImage is bound to something OTHER than the real preparer - the live path would send raw pixels while every offline test passed');

  // And the ONE place an image can reach the model prepares it even if a
  // caller forgets - CRLF-safe, because this estate has lost controls to a
  // line-splitting assumption.
  const depsSrc = read('deps.js');
  assert.match(depsSrc, /prepareImage:\s*realPrepareImage/);
  assert.match(depsSrc, /prepareImage\(imagePath\)\)\.dataUrl/);
  assert.match(read('runPipeline.js'), /await deps\.prepareImage\(shop\.raw_media_path\)/);
});

// =====================================================================
// AC3 - DEFECT 2, THE ANSWERS BOUND TO THE WRONG QUESTIONS.
//
// Nine typed answers, each landing on the question ABOVE the one it answered.
// The binding routes on the photo path are exactly two:
//
//   1. HE REPLIED TO A CARD -> questionStore.getQuestionByCard({chatId,
//      messageId}), an EXACT match on the pair. Binding is by IDENTITY.
//   2. A BARE TYPED MESSAGE -> runtime.js correlateTypedAnswer(), four steps:
//        0. the board's own printed numbers        (he names the question)
//        1. an exact candidate label               (identity)
//        2. EXACTLY ONE OPEN QUESTION              <- ARRIVAL ORDER
//        3. the model, once, with every open key   (identity, high confidence)
//
// Step 2 is the one that slid. The committed guard (d132aeb) refuses a bare
// message whose words resolve to a candidate of an ALREADY-SETTLED question.
// =====================================================================

/** A PHOTO shop, driven in through the real inbound path, carrying `n` open
 *  questions. This is the 2026-08-17 shape: a photographed list whose reading
 *  left several lines needing a human decision. */
async function photoShopWithQuestions(h, bot, specs) {
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([photoTgUpdate()]), bot });
  const shop = h.db.shop[0];
  assert.equal(shop.source_kind, 'photo',
    'this fixture must be a PHOTO shop or it proves nothing about the photo door');
  const keys = [];
  for (const s of specs) {
    const questionKey = questionKeyFor(s.item);
    await h.deps.shopStore.openQuestion({
      shop_id: shop.id,
      question_key: questionKey,
      question_text: `Which product is "${s.item}"?`,
      candidates: s.candidates || [],
    });
    keys.push(questionKey);
  }
  return { shop, keys };
}

/** The nine items of the 17 August queue, in the order the board printed them.
 *  Synthetic candidate labels; the ITEMS are the real ones from the run. */
const NINE = [
  { item: 'ben and jerrys cookie dough', candidates: [{ label: "Ben & Jerry's Cookie Dough 465ml", regular_id: 51 }] },
  { item: 'fruit lolly ice', candidates: [{ label: 'ASDA Fruit Lolly Ice 8pk', regular_id: 52 }] },
  { item: 'wet wipes', candidates: [{ label: 'ASDA Baby Wipes 64pk', regular_id: 53 }] },
  { item: 'sliced roast beef', candidates: [{ label: 'ASDA Sliced Roast Beef 120g', regular_id: 54 }] },
  { item: 'heinz sausage and beans', candidates: [{ label: 'Heinz Sausage & Beans 415g', regular_id: 55 }] },
  { item: 'sweetex', candidates: [{ label: 'Sweetex Calorie Free Sweeteners 600', regular_id: 56 }] },
  { item: 'toffee', candidates: [{ label: 'ASDA Dairy Toffee 180g', regular_id: 57 }] },
  { item: 'gourmet cat food', candidates: [{ label: 'Gourmet Perle 12pk', regular_id: 58 }] },
  { item: 'arla semi skimmed', candidates: [{ label: 'Arla Semi Skimmed 4pt', regular_id: 59 }] },
];

test('AC3 A REPLY TO A CARD binds by IDENTITY on a photo shop - the (chat, message) pair, never a position', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, keys } = await photoShopWithQuestions(h, bot, NINE);

  // Card the SIXTH question only. Its Telegram message id is what the reply
  // will point at, and it is deliberately not the first or the last.
  const sixth = keys[5];
  await bot.sendQuestionCard({
    shopRef: shop.shop_ref,
    questionKey: sixth,
    chatId: 555,
    item: 'sweetex',
    // The RENDER contract's candidate shape - an id and a label, because a
    // tapped index must resolve to an identity and never to a label.
    candidates: NINE[5].candidates.map((c) => ({ id: `regular:${c.regular_id}`, label: c.label })),
  });
  const cardMessageId = (h.db.shop_question.find((q) => q.question_key === sixth) || {}).card_message_id;
  assert.ok(cardMessageId, 'the render contract did not record the card - the reply has nothing to correlate to');

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([{
      update_id: 800,
      message: {
        message_id: 7001,
        from: { id: 555 },
        chat: { id: 555, type: 'private' },
        text: 'the 600 tablet one',
        reply_to_message: { message_id: Number(cardMessageId), chat: { id: 555 } },
      },
    }]),
  });

  assert.equal(questionRow(h, sixth).status, 'answered',
    'a reply to the sixth card must answer the SIXTH question');
  assert.equal(questionRow(h, sixth).answer_text, 'the 600 tablet one');
  // And NOTHING ELSE moved. This is the assertion that would catch an
  // off-by-one: the questions either side must be untouched.
  assert.equal(questionRow(h, keys[4]).status, 'open',
    'the question ABOVE was settled by a reply aimed elsewhere');
  assert.equal(questionRow(h, keys[6]).status, 'open',
    'the question BELOW was settled by a reply aimed elsewhere');
});

test('AC3 A BARE TYPED MESSAGE binds by ARRIVAL ORDER whenever exactly one question is open', async () => {
  // This is not a defect on its own - it is Warwick's own quoted requirement
  // from 2026-08-09 ("I dont have a bloody card I can type an answer"). It is
  // recorded here because it is the MECHANISM the 17 August slide rode on, and
  // because nothing in the product makes the binding depend on the words.
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { keys } = await photoShopWithQuestions(h, bot, [NINE[0]]);

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 810, text: 'literally anything he feels like typing' })]),
  });

  const row = questionRow(h, keys[0]);
  assert.equal(row.status, 'answered');
  assert.equal(row.answer_text, 'literally anything he feels like typing',
    'the sole open question absorbs the next typed message whatever it says - binding is positional here, by construction');
});

test('AC3 THE COMMITTED GUARD WORKS FOR A CANDIDATE LABEL: a late answer naming a settled candidate is refused', async () => {
  // The guard that landed in d132aeb. Proven here ON A PHOTO SHOP, because the
  // existing proof of it (runtime.test.js) seeds a TEXT shop.
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { keys } = await photoShopWithQuestions(h, bot, [NINE[0], NINE[1]]);
  const [first, second] = keys;

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 820, text: "Ben & Jerry's Cookie Dough 465ml" })]),
  });
  assert.equal(questionRow(h, first).status, 'answered');
  assert.equal(questionRow(h, second).status, 'open', 'the second question is now the SOLE open one');

  // The same words again. They answer a question that is ALREADY SETTLED.
  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 821, text: "Ben & Jerry's Cookie Dough 465ml" })]),
  });
  assert.equal(questionRow(h, second).status, 'open',
    'a late answer to a settled question was written onto the question that happens to be open now');
  assert.equal(questionRow(h, second).answer_text, null);
});

// ── ⛔ RE-CUT BY WO-2026-08-18-03. The `{ todo }` that stood here asserted a
//    MECHANISM THAT DOES NOT EXIST, and it is withdrawn rather than unskipped.
//
//    It drove two open questions with a bare free-text message and expected the
//    first to absorb it "because it is the sole open question". It is not: with
//    two open, `correlateTypedAnswer` step 2 is guarded by `scoped.length === 1`
//    and cannot fire, step 1 needs the words to EQUAL a candidate label, and the
//    plain harness wires no correlator - so the message bound to NOTHING and the
//    test failed at its first assertion, not its last. It was diagnosing the
//    wrong step.
//
//    The real 17 August binder was step 3 - Terra, wired in production at
//    deps.js `correlateAnswer: realCorrelateAnswer` - returning `high` on nine
//    questions that were all opened in one planning pass. The proof of that
//    defect, and of its repair, is the corpus replay in
//    answerBindingReplay.test.js, driven by the durable rows.
//
//    What is kept here is the fact the old test needed and never established:
//    with more than one question open and no correlator wired, a free-text
//    answer places nowhere. That is the baseline the replay's injected
//    correlator exists to move, and pinning it is what stops the replay being
//    mistaken for a test of its own stub.
test('AC3 WITH MORE THAN ONE QUESTION OPEN, a bare free-text message places NOWHERE without a correlator', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { keys } = await photoShopWithQuestions(h, bot, [NINE[0], NINE[1]]);
  const [first, second] = keys;

  await runOnce(h.deps, {
    householdId: HOUSEHOLD_ID,
    bot,
    questions: bot.questions,
    intake: makeIntake([typed({ updateId: 830, text: 'Ice lollies are in favourites. stupid question' })]),
  });

  assert.equal(questionRow(h, first).status, 'open',
    'step 2 is guarded by scoped.length === 1 and cannot fire with two questions open');
  assert.equal(questionRow(h, first).answer_text, null);
  assert.equal(questionRow(h, second).status, 'open');
  assert.equal(questionRow(h, second).answer_text, null);
});

// =====================================================================
// AC4 - DEFECT 3, FIRST-ANSWER-WINS AS A TRAP.
//
// The rule is good: a later answer must never silently overwrite an earlier
// one. The question this answers is the one that cost Warwick the shop - once
// an answer is bound to the WRONG question, what route remains?
//
// This section REPORTS. It designs nothing.
// =====================================================================

test('AC4 first-answer-wins: the second answer changes nothing and says so', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, keys } = await photoShopWithQuestions(h, bot, [NINE[0]]);

  const firstWrite = await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'the WRONG answer', answer_source: 'typed',
  });
  assert.equal(firstWrite.changed, true);

  const secondWrite = await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'the answer he meant', answer_source: 'typed',
  });
  assert.equal(secondWrite.changed, false,
    'a correction must not silently overwrite - that half of the rule is right');
  assert.equal(secondWrite.already_answered, true);
  assert.equal(questionRow(h, keys[0]).answer_text, 'the WRONG answer',
    'and the wrong answer is what remains on the row');
});

test('AC4 re-opening the question is not a route either - openQuestion writes nothing over a settled row', async () => {
  const h = makeHarness();
  const bot = await makeAskingBot(h);
  const { shop, keys } = await photoShopWithQuestions(h, bot, [NINE[0]]);
  await h.deps.shopStore.answerQuestion({
    shop_id: shop.id, question_key: keys[0], answer_text: 'the WRONG answer', answer_source: 'typed',
  });

  const reopened = await h.deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: keys[0],
    question_text: 'Which product is "ben and jerrys cookie dough"?',
    candidates: NINE[0].candidates,
  });
  assert.equal(reopened.created, false);
  assert.equal(reopened.already_answered, true);
  assert.equal(questionRow(h, keys[0]).status, 'answered');
  assert.equal(questionRow(h, keys[0]).answer_text, 'the WRONG answer');
});

test('AC4 THE ENUMERATION, RE-CUT: exactly ONE command may supersede a settled answer, and the row is still written by only TWO statements', () => {
  // -- WHY THIS TEST CHANGED, AND WHAT DID NOT ------------------------------
  //
  // WO-2026-08-18-03 recorded a FINDING here: no command in the surface could
  // amend a settled answer, so a wrong answer was permanent and cancelling the
  // week was the only way out. Warwick refused that residual, and
  // WO-2026-08-18-04 closed it. The finding is therefore out of date BY DESIGN
  // and this test is re-cut rather than deleted - deleting it would retire the
  // control along with the finding, and the control is the valuable half.
  //
  // What it guards NOW is the narrower and more dangerous property: that the
  // correction route did not become a second way to REWRITE a settled row.
  // Superseding and overwriting look identical from a distance and are opposite
  // things - one keeps the original, the other destroys it.

  // (a) THE COMMAND SURFACE. A closed allowlist, so this is exhaustive rather
  // than a sample. Both literals are pinned HERE, outside the source they
  // check, so a command added without revisiting this reasoning reddens.
  assert.equal(COMMAND_NAMES.length, 13,
    'the command surface changed - re-run the AC4 enumeration before trusting its answer');

  const amending = COMMAND_NAMES.filter((n) => /reopen|amend|correctAnswer|changeAnswer|unanswer|clearAnswer/i.test(n));
  assert.deepEqual(amending, ['correctAnswer'],
    'exactly one command may supersede a settled answer, and it is correctAnswer');

  // (b) AND IT SUPERSEDES BY OPENING A NEW ROUND, NEVER BY REWRITING THE ROW.
  // Read off the source, because this is the property that would decay quietly:
  // a future edit that "simplified" correctAnswer into an UPDATE would still
  // pass every behavioural test that only checks the CURRENT answer.
  const correctAnswerBody = read('commands.js')
    .split('export async function correctAnswer')[1]
    .split('\nexport ')[0];
  assert.match(correctAnswerBody, /parent_question_id: original\.id/,
    'correctAnswer no longer chains the new round to the row it supersedes - the audit trail is gone');
  assert.match(correctAnswerBody, /question_round: nextRound/,
    'correctAnswer no longer opens a NEW round, so it must be writing over the old one');
  assert.ok(!/superseded_answer_text:\s*answerText/.test(correctAnswerBody),
    'correctAnswer records the replacement as though it were the original');

  // correctLine is still NOT this route: it records a correction against a shop
  // LINE by item name and never touches asdair.shop_question or the decision row.
  assert.ok(COMMAND_NAMES.includes(COMMANDS.CORRECT_LINE));
  const correctLineBody = read('commands.js')
    .split('export async function correctLine')[1]
    .split('\nexport ')[0];
  assert.ok(!/shop_question|answerQuestion/.test(correctLineBody),
    'correctLine now touches the question row - the AC4 finding is out of date');

  // (c) THE WRITE INVENTORY, UNCHANGED AND THAT IS THE POINT. Two statements in
  // the whole store touch asdair.shop_question: the INSERT in openQuestion
  // (ON CONFLICT DO NOTHING) and the single UPDATE in answerQuestion, guarded by
  // status='open'. correctAnswer adds NO third statement - it reuses both, which
  // is exactly why first-answer-wins still protects every settled row including
  // the ones a correction creates.
  const storeSrc = fs.readFileSync(path.join(here, '..', 'shop', 'shopStore.js'), 'utf8');
  const writes = storeSrc.match(/(INSERT INTO|UPDATE) asdair\.shop_question/g) || [];
  assert.equal(writes.length, 2,
    'the number of writes to asdair.shop_question changed - re-run the AC4 enumeration');
  assert.match(storeSrc, /ON CONFLICT \(shop_id, question_key\) DO NOTHING/);
  assert.match(storeSrc, /WHERE id = \$4 AND status = 'open'/);
});

// =====================================================================
// AC5 - THIS FILE IS DISCOVERED BY THE BARE `node --test` THAT CI RUNS.
//
// Proven by the fact that this assertion executed at all: the workflow's
// pipeline step runs `node --test` with no arguments in this directory, and a
// file it does not discover cannot fail. The subtest COUNT in the runner's
// output is the evidence a reviewer should read, never the exit code.
// =====================================================================

test('AC5 this proof file runs under the bare `node --test` the workflow invokes', () => {
  assert.ok(fs.existsSync(path.join(here, 'photoPathProof.test.js')));
  const workflow = fs.readFileSync(
    path.join(here, '..', '..', '..', '.github', 'workflows', 'asdair-tests.yml'), 'utf8',
  );
  assert.match(workflow, /working-directory: services\/asdair\/pipeline\r?\n\s*run: node --test/,
    'the workflow no longer runs a bare `node --test` in this directory, so this file would be CI-invisible');
});
