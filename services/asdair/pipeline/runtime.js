#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/runtime.js
//
// THE LOOP. Poll intake once, advance every shop that has work, send whatever
// is waiting in the outbox, exit cleanly.
//
//     node --env-file=<env> runtime.js --once
//     node --env-file=<env> runtime.js --watch [--interval 60]
//
// ── THIS IS A DETERMINISTIC WORKER, NOT AN LLM DAEMON ───────────────────────
// There is no agent here, no conversation, no autonomous decision and no
// reasoning loop. Every pass is the same three deterministic phases in the same
// order, and every decision about what to do next comes from the pure stage
// table reading durable Postgres state. The ONLY model call in the whole system
// is the single grounded vision request that reads a photograph of a
// handwritten list - and even that never NAMES a product; identity comes from
// the household catalogue.
//
// ── ONE POLLER, TWO CONSUMERS ───────────────────────────────────────────────
// Telegram long-polling is DESTRUCTIVE: fetching updates with an offset ACKS
// every update below it, so two pollers race and the loser silently swallows
// the week's shopping list. services/asdair/intake/ is the one poller. This
// runtime does not add a second: it wraps the intake client so the raw updates
// intake IGNORES (button taps and typed replies carry no `message` a receiver
// can use) are CAPTURED on the way past and routed through the bot's own
// inboundRouter. One fetch, one offset, both consumers served.
//
// ── EACH PASS ADVANCES EACH SHOP BY ONE STEP ────────────────────────────────
// Not "until it stops". One. A shop that needs four steps takes four passes,
// which keeps every pass bounded, keeps a wedged shop from starving the others,
// and makes the loop trivially safe to interrupt. `--once` is therefore also
// the unit of recovery after a reboot: run it, and every shop moves on by one
// legal step from whatever the database says.
//
// ── CREDENTIALS ─────────────────────────────────────────────────────────────
// Everything arrives through `node --env-file=`. This file opens no credentials
// file, prints no token, and knows env var NAMES only.
// =====================================================================

import * as commands from './commands.js';
import { runPipeline, buildBrowserHandoff } from './runPipeline.js';
import * as store from './store.js';
import { intentToCommand, intentToCommands } from './telegramAdapter.js';
// WP-B15-A1. resolveExactCandidate is PURE and opens no connection, so importing
// it statically does not break this file's "importable on a box with no pg"
// property - the same reasoning as the three bot imports below.
import * as shopDecisions from './shopDecisions.js';
// WP-B15-15. stages.js is PURE - no I/O, no pg - so the board can read the
// authority on what parks a shop instead of restating it. STEPS names the park
// the board reports; everIssued is the same latch predicate the gate itself
// uses for the interpretation confirmation.
import { STEPS, everIssued } from './stages.js';
import { COMMANDS } from './commandNames.js';
import { LEDGER_KINDS, ledgerFamilyKey, outboxKeyFor } from './keys.js';
import { supersededQuestionIds } from './applyDecisions.js';
// WO-2026-08-18-03 AC1. A MODEL MAPPING IS NOT EVIDENCE. Pure, zero-dep, opens
// no connection - same reasoning as the shopDecisions import above.
import { bindingVerdict } from './answerCorroboration.js';
// The bot folder is PURE and zero-dependency (it opens no connection; a test in
// that folder enforces it), so importing these three statically does NOT break
// the property the dynamic import of deps.js below protects: this file must stay
// importable on a box with no `pg` installed. The Telegram SENDER and the
// question STORE remain injected, because those are the parts that touch a wire.
import { normaliseStoredCandidates, questionLookupFrom } from '../bot/questionRender.js';
import { resolveCandidateAnswer } from '../bot/resolveTap.js';
import { ACTIONS, CALLBACK_NAMESPACE, CALLBACK_SEPARATOR } from '../bot/callbackProtocol.js';
// WP-B15-09. The board's numbering contract and its inverse live together in the
// renderer, for the same reason buildAnswerArg and parseAnswerArg share a file:
// a format and the thing that reads it must not be able to drift apart.
import { parseBoardReply } from '../bot/renderMessages.js';

// THE RETURN LEG. `handoff/claim.js`, `handoff/completion.js` and
// `reconcile/verifyBasket.js` are CommonJS, pure, and open no connection of
// their own - claim.js takes an injected `query` exactly as this file's callers
// do - so importing them statically preserves the property the dynamic
// deps.js import above protects: this file stays importable with no `pg`.
//
// Before this, `verifyBasket` had zero production callers and `verificationFor`
// was never supplied by anything, so every basket-ready handback rendered NOT
// VERIFIED by omission. The card was not lying about a check that had run; it
// was reporting the absence of one that had never been wired.
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const { peekHandoff } = requireCjs('../handoff/claim.js');
const { toVerifyBasketArgs } = requireCjs('../handoff/completion.js');
const { verifyBasket } = requireCjs('../reconcile/verifyBasket.js');

// deps.js is imported DYNAMICALLY, inside main() only. It binds the real
// components, which transitively pull in `pg` - and the loop's library exports
// (runOnce, runWatch, pollIntake, ...) all take `deps` as an argument, so they
// must stay importable on a box with no dependencies installed. That is what
// lets the whole offline test suite import this file.

const DEFAULT_INTERVAL_SECONDS = 60;

/**
 * Wrap a ShopperBot Telegram client so every raw update it fetches is captured.
 *
 * runIntake consumes the stream and reports what it IGNORED, but only as
 * `{updateId, senderId, reason}` - the payload of a button tap is gone by then.
 * Capturing on the way past is what lets the SAME fetch serve both the list
 * receiver and the control surface, without a second poller.
 */
export function createCapturingTelegram(inner) {
  const captured = [];
  return {
    captured,
    async getUpdates(opts) {
      const updates = await inner.getUpdates(opts);
      captured.push(...updates);
      return updates;
    },
    getFile: (...a) => inner.getFile(...a),
    downloadFile: (...a) => inner.downloadFile(...a),
    describe: () => (inner.describe ? inner.describe() : { bot: 'shopperbot' }),
  };
}

/**
 * PHASE 1 - intake. Every accepted message becomes a receiveList command.
 *
 * Idempotency is the receiver's offset file PLUS createOrResumeShop's two
 * unique indexes, belt and braces: even if the offset file were lost and the
 * whole history redelivered, every message would RESUME its existing week and
 * write nothing.
 */
export async function pollIntake(deps, { intake, householdId, now, claim = null, log = () => {} } = {}) {
  if (!intake) return { fetched: 0, received: [], ignored: [], failed: [], claimed: [] };
  // THE CLOCK IS INJECTED, never reached for. The week a list belongs to is
  // derived from the receiver's stamp, so the whole loop is deterministic under
  // test - and a runtime with a wrong clock is a wrong shop_ref, which is the
  // kind of bug that only shows up on the night it matters.
  const clock = now || intake.now || Date.now;
  // THE ACKNOWLEDGEMENT BOUNDARY.
  //
  // Advancing the Telegram offset tells Telegram "I have this", and Telegram
  // then forgets the update permanently. This used to happen the moment a record
  // was emitted, with the shop created afterwards - so a crash in that window
  // lost a shopping list SILENTLY: no error, no retry, nothing to recover from.
  //
  // receiveList now runs INSIDE onRecord, so the shop is durable BEFORE the
  // offset moves. If it throws, the offset is held, the batch stops, and
  // Telegram redelivers. A redelivery is harmless because shop's unique
  // (telegram_chat_id, telegram_message_id) index resumes the same shop rather
  // than creating a second one.
  const received = [];

  const persist = async (record) => {
    const meta = record.meta || {};
    // The week a list belongs to is the day it arrived. Derived once, from the
    // receiver's own stamp, so a redelivery cannot land on a different week -
    // and even if it did, the inbound unique key would still resume the shop.
    const listDate = String(meta.receivedAt || '').slice(0, 10);
    const spec = {
      householdId,
      listDate,
      sourceKind: record.payload.kind,
      rawText: record.payload.kind === 'text' ? record.payload.text : null,
      rawMediaPath: record.payload.kind === 'photo' ? record.payload.imageRef : null,
      // A photograph of handwriting is ALWAYS a list that was read rather than
      // typed, so it is flagged for review; the interpretation gate then refuses
      // to declare it ready to shop on AsdAIr's own say-so.
      needsReview: record.payload.kind === 'photo',
      telegramChatId: meta.chatId != null ? String(meta.chatId) : null,
      telegramMessageId: meta.messageId != null ? String(meta.messageId) : null,
      telegramUpdateId: meta.updateId != null ? String(meta.updateId) : null,
      sourceId: record.sourceId,
      actor: `telegram:${meta.senderId ?? 'unknown'}`,
      // WP-B15-1 invariant C: the immutable content hash intake computed from
      // the exact downloaded bytes, plus the receiver's own stamp. Carried into
      // receiveList so the binding is durable BEFORE the offset moves, in the
      // same boundary as the shop itself. Absent on text shops, honestly.
      imageFingerprint: record.payload.kind === 'photo' ? (meta.imageSha256 ?? null) : null,
      imageByteLength: record.payload.kind === 'photo' ? (meta.bytes ?? null) : null,
      receivedAt: meta.receivedAt ?? null,
    };
    received.push(await commands.receiveList(spec, deps));
  };

  const result = await intake.runIntake({
    config: intake.config,
    telegram: intake.telegram,
    state: intake.state,
    media: intake.media,
    now: clock,
    log,
    onRecord: persist,
    // WP-B15-A1. Route first: runIntake asks this BEFORE treating a message as a
    // shopping list, so an answer is never also eaten as a list.
    claim,
  });

  return {
    fetched: result.fetched,
    received,
    ignored: result.ignored,
    failed: result.failed,
    claimed: result.claimed || [],
  };
}

/**
 * Every question still OPEN, across every active shop. (WP-B15-A1)
 *
 * Read once per pass, BEFORE the fetch, because the claim decision has to be
 * taken while a message is still in intake's hand - see runIntake's `claim`
 * hook for why that ordering is not negotiable.
 *
 * A lookup that fails returns an EMPTY list, never a throw. No open questions
 * means nothing is claimed, which is exactly today's behaviour: an unreadable
 * question table must degrade to "typed messages are shopping lists", never to
 * a pass that cannot run at all.
 */
export async function loadOpenQuestions(deps, opts = {}) {
  return (await loadBoardQuestions(deps, opts)).open;
}

/**
 * OPEN *AND* SETTLED, WITH THE SAME ORDINALS THE BOARD PRINTS.
 * (WO-2026-08-18-04.)
 *
 * loadOpenQuestions used to be the whole of this, and it dropped every settled
 * row on the floor. That was correct while the only thing a typed message could
 * do was ANSWER something: a number naming a settled question is a late answer
 * and must not be written. It stopped being correct the moment a message could
 * also CORRECT one - a correction names a settled question BY DEFINITION, so
 * the set it has to resolve against is exactly the set that used to be
 * discarded.
 *
 * BOTH LISTS ARE NUMBERED FROM THE SAME `i + 1` OVER ALL ROWS, in the shop's
 * own immutable `ORDER BY q.id ASC`. That is the same derivation boardStateOf
 * uses to print the card, which is what makes "change 3" and the "3." he is
 * looking at the same question. Numbering the two lists separately would be a
 * quiet off-by-everything: settled rows are exactly what the shared counter
 * exists to skip over.
 */
export async function loadBoardQuestions(deps, { householdId = null, log = () => {} } = {}) {
  const open = [];
  const settled = [];
  let shops = [];
  try {
    shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  } catch (err) {
    log('open_questions_lookup_failed', { detail: String(err && err.message ? err.message : err) });
    return { open, settled };
  }

  for (const shop of shops) {
    if (householdId !== null && householdId !== undefined
        && shop.household_id !== null && shop.household_id !== undefined
        && String(shop.household_id) !== String(householdId)) continue;
    try {
      const rows = await store.listQuestions(deps, shop.id);
      rows.forEach((q, i) => {
        if (q.status !== 'open') {
          // A settled row carries far less than an open one because far less is
          // asked of it: a correction names it by number and replaces its
          // answer. The answer it currently holds travels so a caller can say
          // WHAT is being superseded without a second read.
          settled.push({
            shopRef: shop.shop_ref,
            shopId: shop.id,
            householdId: shop.household_id,
            questionKey: q.question_key,
            itemName: q.item_name || null,
            questionText: q.question_text || null,
            ordinal: i + 1,
            status: q.status,
            answerText: q.answer_text || null,
          });
          return;
        }
        open.push({
          shopRef: shop.shop_ref,
          shopId: shop.id,
          questionKey: q.question_key,
          questionText: q.question_text || null,
          itemName: q.item_name || null,
          // THE BOARD'S NUMBER FOR THIS QUESTION (WP-B15-09). Derived from the
          // same immutable `ORDER BY q.id ASC` the board renders from, so what
          // he reads and what a reply resolves against cannot disagree. It is
          // computed HERE rather than passed around because this is the one
          // place that already reads every row of the shop.
          ordinal: i + 1,
          candidates: Array.isArray(q.candidates) ? q.candidates : [],
          renderedCandidates: Array.isArray(q.rendered_candidates) ? q.rendered_candidates : [],
        });
      });
    } catch (err) {
      // One shop's questions must not stop another shop's - same posture as
      // queueShopCards, and for the same reason.
      log('open_questions_lookup_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }
  }
  return { open, settled };
}

/** PURE. The comparison form for "are these the same words?" - whitespace and
 *  case only. NOT normaliseTerm: that flattens punctuation, and "no, the 60g"
 *  and "no the 60g" are the same answer while "yes" and "yes!" being equal is
 *  fine but "500g" and "500 g" must not silently become one. */
function sameWords(a, b) {
  return String(a == null ? '' : a).trim().replace(/\s+/g, ' ').toLowerCase()
    === String(b == null ? '' : b).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Did the row actually end up carrying THESE words? (WO-2026-08-10-B15-04)
 *
 * Answers the one question a `duplicate: true` receipt leaves open: was this a
 * redelivery of the same message (safe to claim) or a different message hitting
 * a question somebody else already settled (must NOT be claimed and swallowed)?
 *
 * FAILS TOWARDS "NOT RECORDED". An unreadable row cannot evidence that his
 * words landed, and the safe direction here is to not claim - the worst case is
 * the pre-existing behaviour, never a silently discarded message.
 */
async function recordedAnswerMatches(deps, {
  open, questionKey, shopId = null, shopRef = null, words, log = () => {},
} = {}) {
  // ── SCOPED BY SHOP (WP-B15-18) ────────────────────────────────────────────
  // A question_key is derived from the ITEM NAME and carries no shop component
  // (keys.js questionKeyFor), so two active shops asking about the same item
  // hold the IDENTICAL key. Finding the entry by key alone returned the FIRST
  // match in shop-id order, which is not necessarily his shop - so this check
  // could read a stranger's row, conclude his words had not landed, and decline
  // a reply that was in fact a redelivery of his own answer. Declining it means
  // it is not claimed, and an unclaimed reply becomes a shopping list.
  //
  // `shopRef` comes from the CARD he replied to, which is positive evidence
  // about which shop he meant. It stays optional so a caller with no such
  // evidence gets exactly today's behaviour rather than a silent refusal.
  //
  // ── RESOLVED WITHOUT `open` WHEN THE CALLER ALREADY KNOWS (WP-B15-22, F1) ──
  // `open` is `openQuestions`, read ONCE at the top of this pass. The one case
  // this function exists for - a duplicate receipt on a question that is
  // ALREADY settled - is EXACTLY the case where that question is no longer in
  // `open`: it left the open set the moment it was answered, possibly on an
  // EARLIER pass entirely. Looking it up in `open` therefore finds nothing,
  // `entry` is undefined, and this function returned `false` unconditionally -
  // even when the words on the row are byte-identical to his redelivered
  // message. Proven with ONE shop, no cross-shop element at all: PASS 1 records
  // the answer; PASS 2's `open` no longer carries it; the redelivery is refused
  // with a message calling his own identical words "different".
  //
  // `commands.dispatch`'s receipt for `answerQuestion` already carries the
  // shop it resolved (`receipt.shop_id` - see commands.js `receipt()`), which
  // is positive evidence independent of `open`'s staleness. When a caller
  // supplies it, the `open` lookup is skipped entirely and the row is read
  // straight from that shop. `open`/`shopRef` remain the fallback for a caller
  // with no resolved shop id, and the function still fails towards `false`.
  let resolvedShopId = shopId;
  if (resolvedShopId === null || resolvedShopId === undefined) {
    const entry = (Array.isArray(open) ? open : []).find((q) => q.questionKey === questionKey
      && (shopRef === null || shopRef === undefined || q.shopRef === shopRef));
    if (!entry) return false;
    resolvedShopId = entry.shopId;
  }
  try {
    const rows = await store.listQuestions(deps, resolvedShopId);
    const row = rows.find((q) => q.question_key === questionKey);
    return row ? sameWords(row.answer_text, words) : false;
  } catch (err) {
    log('recorded_answer_lookup_failed', {
      question_key: questionKey, detail: String(err && err.message ? err.message : err),
    });
    return false;
  }
}

/**
 * Every shop AWAITING A DEFERRED CLARIFICATION. (WO-2026-08-10-B15-04 AC2)
 *
 * ── WHY THIS EXISTS SEPARATELY FROM loadOpenQuestions ───────────────────────
 * These are questions AsdAIr OWES Warwick and has already TOLD him about, and
 * which have deliberately NOT been opened as rows: runPipeline withholds the
 * round-2 clarification until the photographed reading is confirmed, because
 * asking "which variant of line 3?" before he agrees we read line 3 at all is
 * asking the wrong question first. That gate is right and is not touched here.
 *
 * The consequence was not right. A card sat on his phone inviting a reply while
 * `status = 'open'` matched nothing, so runOnce built no claim at all, intake
 * was never asked whether the message belonged to anyone, and his answer became
 * SHOP-2026-08-10 - a whole shopping list made out of one sentence.
 *
 * ── THE SIGNAL IS DURABLE AND ALREADY EXISTS ────────────────────────────────
 * A `clarification_deferred` outbox row for an ACTIVE shop is exactly "AsdAIr
 * told him a clarification is owed here". It survives restart, it is in the
 * ledger the Cockpit already reads, and it needs no schema change and no new
 * message kind. `outboxEverQueued` is deliberately per-KIND here: the question
 * being asked is about the SHOP's state, not about one held line.
 *
 * A lookup that fails returns an EMPTY list, never a throw - same posture as
 * loadOpenQuestions, and for the same reason: an unreadable ledger must degrade
 * to today's behaviour, never to a pass that cannot run.
 */
/**
 * Every shop that has ALREADY BEEN SENT A BOARD. (WP-B15-09 AC8)
 *
 * ── WHY THIS EXISTS AND WHY IT IS THIS NARROW ───────────────────────────────
 * Warwick's standing guard is "no open question, no claim" - it is what stops a
 * genuine new shopping list ever being swallowed, and it is not being weakened
 * here. But a board sits on his phone after every question is settled, inviting
 * a reply, and a reply to it with nothing open fell straight through to intake
 * and became a shop. Same shape as the deferred window: a card is outstanding,
 * so a reply to it is foreseeable and must not be mistaken for a list.
 *
 * The signal is durable and already exists - a `question_board` outbox row for
 * an active shop - so this needs no schema change and no new state. The CLAIM
 * itself stays narrower still: see the reply branch in runOnce, which declines
 * unless the message is genuinely a reply to one of our own messages.
 *
 * A lookup that fails returns an EMPTY list, never a throw - same posture as
 * loadOpenQuestions, and for the same reason.
 */
export async function loadBoardTargets(deps, { householdId = null, log = () => {} } = {}) {
  const boarded = [];
  let shops = [];
  try {
    shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  } catch (err) {
    log('board_targets_lookup_failed', { detail: String(err && err.message ? err.message : err) });
    return boarded;
  }
  for (const shop of shops) {
    if (householdId !== null && householdId !== undefined
        && shop.household_id !== null && shop.household_id !== undefined
        && String(shop.household_id) !== String(householdId)) continue;
    try {
      const family = boardFamily(shop);
      const spent = await store.spentLedgerGenerations(deps, family);
      if (spent === 0) continue;
      const last = await store.findLedgerGeneration(deps, family, spent - 1);
      const delivery = last && last.result && last.result.delivery ? last.result.delivery : null;
      boarded.push({
        shopRef: shop.shop_ref,
        shopId: shop.id,
        householdId: shop.household_id,
        chatId: delivery ? String(delivery.chatId) : null,
        messageId: delivery ? String(delivery.messageId) : null,
      });
    } catch (err) {
      log('board_targets_lookup_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }
  }
  return boarded;
}

/** PURE. Is this reply pointed at a board we actually sent? EXACT match on both
 *  ids, for the same reason questionStore.getQuestionByCard is exact: the whole
 *  scheme rests on "this reply came from THAT card", and a loose match here
 *  would let an unrelated reply be read as an answer. */
function boardAt(boardTargets, replyTo) {
  if (!replyTo || !Array.isArray(boardTargets)) return null;
  return boardTargets.find((b) => b.chatId !== null && b.messageId !== null
    && b.chatId === String(replyTo.chatId) && b.messageId === String(replyTo.messageId)) || null;
}

/**
 * PURE. Which tokens CANNOT be resolved without knowing which shop he meant?
 * (WP-B15-18)
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * Every identifier a typed answer is correlated by is unique WITHIN a shop and
 * not across them: the board ordinal restarts at 1 on every board, and a
 * question_key hashes the item name with no shop component. Both were fed
 * straight into `new Map(...)`, which is LAST-WRITE-WINS - so with two shops
 * active the higher shop id silently took every contested token and the answer
 * was written to a shop he was never looking at. It succeeded and it logged
 * success, which is why nobody saw it.
 *
 * ── WHY A SET OF AMBIGUOUS TOKENS RATHER THAN A FILTER ──────────────────────
 * Returning the tokens to DROP keeps one rule in one place and makes the
 * bound and unbound cases the same code: when the candidate set has already
 * been scoped to one shop, every token belongs to one shop, this returns an
 * EMPTY set, and nothing is dropped. There is no branch to get wrong.
 *
 * It drops rather than picks, deliberately. Choosing between two shops that
 * both offer a token is the guess this whole function refuses to make - the
 * doctrine already written at "AMBIGUITY GOES UP, NEVER SIDEWAYS" below,
 * extended across shops rather than newly invented.
 */
function tokensOfferedByMoreThanOneShop(rows, tokenOf) {
  const shopsByToken = new Map();
  for (const q of Array.isArray(rows) ? rows : []) {
    const token = tokenOf(q);
    if (token === null || token === undefined) continue;
    const shops = shopsByToken.get(token) || new Set();
    shops.add(String(q.shopId));
    shopsByToken.set(token, shops);
  }
  const ambiguous = new Set();
  for (const [token, shops] of shopsByToken) if (shops.size > 1) ambiguous.add(token);
  return ambiguous;
}

export async function loadDeferredClarifications(deps, { householdId = null, log = () => {} } = {}) {
  const waiting = [];
  let shops = [];
  try {
    shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  } catch (err) {
    log('deferred_clarifications_lookup_failed', { detail: String(err && err.message ? err.message : err) });
    return waiting;
  }

  for (const shop of shops) {
    if (householdId !== null && householdId !== undefined
        && shop.household_id !== null && shop.household_id !== undefined
        && String(shop.household_id) !== String(householdId)) continue;
    try {
      if (!(await store.outboxEverQueued(deps, shop.id, 'clarification_deferred'))) continue;
      waiting.push({
        shopRef: shop.shop_ref,
        shopId: shop.id,
        householdId: shop.household_id,
      });
    } catch (err) {
      // One shop must not stop another - same posture as queueShopCards.
      log('deferred_clarifications_lookup_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }
  }
  return waiting;
}

/**
 * WHICH open question(s) did this bare typed message answer? (WP-B15-A1)
 *
 * Returns already-resolved mappings for the router, or `null` for "not ours".
 *
 * ── DETERMINISTIC FIRST, AND THE MODEL IS THE LAST RESORT ───────────────────
 * Three steps, in this order, and the order is the guarantee:
 *
 *   1. An EXACT candidate label match, through the same resolveExactCandidate
 *      the decision spine uses. Costs no model call. If exactly one open
 *      question offered that label, the words are unambiguously that question's.
 *   2. Exactly ONE open question. There is nothing to choose between, so there
 *      is nothing for a model to decide.
 *   3. Only then Terra, ONCE, with every open question key at the same time.
 *
 * ── AMBIGUITY GOES UP, NEVER SIDEWAYS ───────────────────────────────────────
 * Two questions offering the SAME label is ambiguous, so it falls through to the
 * model rather than picking the first - picking would be the least-bad match
 * this estate refuses everywhere else.
 *
 * ── ONLY A SURE CORRELATION IS CLAIMED ──────────────────────────────────────
 * A `low` confidence mapping is dropped. `confidence` is about WHICH QUESTION
 * the words belong to, not about whether the answer is understandable: an answer
 * unmistakably aimed at one question but unclear in meaning is claimed `high`,
 * recorded as that question's typed answer, and the EXISTING decision spine then
 * refuses to guess and opens a real round-2 clarification naming what it could
 * not read. That is the AC6 path, and it needed no new machinery.
 *
 * ── NOT CORRELATED IS NOT A FAILURE ─────────────────────────────────────────
 * `null` means the message is not ours, so intake gets it and a genuine new
 * shopping list is never lost. Every degraded path - no interpreter wired, a
 * throw, an unusable return - lands on `null` for that reason. Failing towards
 * "not mine" is the only safe direction here.
 */
/**
 * Do these words answer a question in this shop that is ALREADY SETTLED?
 *
 * The signature of the 2026-08-17 slide. A message whose text resolves to a
 * candidate of an answered question is a LATE answer to that question - it is
 * not evidence about whatever question happens to be open now, and writing it
 * there is unrecoverable.
 *
 * Fails towards `null` (bind as before) on any lookup error: this guard exists
 * to stop a specific wrong write, and it must never become a new way to lose an
 * answer.
 */
async function answersASettledQuestion(deps, { shopId, words, log = () => {} } = {}) {
  if (shopId === null || shopId === undefined) return null;
  let rows;
  try {
    rows = await store.listQuestions(deps, shopId);
  } catch (err) {
    log('settled_question_lookup_failed', { detail: String(err && err.message ? err.message : err) });
    return null;
  }
  for (const row of rows || []) {
    if (!row || row.status === 'open') continue;
    const hit = shopDecisions.resolveExactCandidate({
      status: 'open',
      answer_text: words,
      candidates: row.candidates,
      rendered_candidates: row.rendered_candidates,
    });
    if (hit !== null) return { questionKey: row.question_key, status: row.status };
  }
  return null;
}

export async function correlateTypedAnswer(deps, { text, open, settled = [], boardShopId = null, log = () => {} } = {}) {
  const words = typeof text === 'string' ? text.trim() : '';
  const all = Array.isArray(open) ? open : [];
  const allSettled = Array.isArray(settled) ? settled : [];

  // ── THE SHOP SCOPE (WP-B15-18). ONE PLACE, BEFORE ANY STEP RUNS. ──────────
  //
  // Two shops are simultaneously active whenever last week's has not reconciled
  // and this week's has arrived - the ordinary state, not an edge case. Every
  // step below then had to answer "which question is this?" against a candidate
  // set spanning shops, keyed by tokens that are only unique within one. The
  // answer went to the wrong shop's row, successfully and silently.
  //
  // `boardShopId` is the shop whose BOARD he replied to, matched exactly on
  // (chat, message). It is the only positive evidence in the message about
  // which shop he meant, so where it exists everything downstream sees just
  // that shop and inherits the scope from here rather than each step
  // re-deriving it. Where it does not exist, correlation is NOT disabled -
  // ambiguity is dropped token by token below, so a candidate that only one
  // shop offers still resolves exactly as it does today.
  const scoped = boardShopId === null || boardShopId === undefined
    ? all
    : all.filter((q) => String(q.shopId) === String(boardShopId));
  // Settled rows are scoped by the SAME rule, for the same reason: a number
  // means "the question printed beside it on the board I am looking at".
  const scopedSettled = boardShopId === null || boardShopId === undefined
    ? allSettled
    : allSettled.filter((q) => String(q.shopId) === String(boardShopId));

  // A CORRECTION IS THE ONE THING THAT WORKS WITH NOTHING OPEN, and that is the
  // case it exists for: every question settled, the shop planned, and one of the
  // answers wrong. The old guard returned here on `scoped.length === 0` and
  // would have made the whole capability unreachable at exactly the moment
  // Warwick needs it.
  if (words === '' || (scoped.length === 0 && scopedSettled.length === 0)) return null;

  // ── 0. THE BOARD'S OWN NUMBERS (WP-B15-09). ───────────────────────────────
  //
  // "1: the 12 skinless ones\n4: the 33 pack" answers TWO questions in one
  // message, and it does so with no model call and no ambiguity: the human
  // named the questions himself, using the numbers the board printed. That is
  // strictly better evidence than any correlation further down this function,
  // so it goes first.
  //
  // A number with no open question behind it is DROPPED, not mapped onto the
  // nearest thing - it is either already answered (so his instruction is late,
  // and the AC8 notice tells him) or it was never a question at all.
  const numbered = parseBoardReply(words);
  if (numbered.length > 0) {
    // A number he typed means "the question printed beside that number on the
    // board I am looking at". With no board to bind to, a number offered by two
    // shops names two different questions and is dropped rather than guessed.
    const ambiguousOrdinals = tokensOfferedByMoreThanOneShop(scoped, (q) => q.ordinal);
    const byOrdinal = new Map(scoped
      .filter((q) => !ambiguousOrdinals.has(q.ordinal))
      .map((q) => [q.ordinal, q]));
    // The settled half gets its OWN ambiguity drop rather than sharing one. Two
    // shops each offering a settled "3" name two different questions, and
    // correcting the wrong shop's answer is the same class of error as
    // answering it.
    const ambiguousSettled = tokensOfferedByMoreThanOneShop(scopedSettled, (q) => q.ordinal);
    const settledByOrdinal = new Map(scopedSettled
      .filter((q) => !ambiguousSettled.has(q.ordinal))
      .map((q) => [q.ordinal, q]));
    const mappings = [];
    let refusedForShop = 0;
    for (const n of numbered) {
      // -- A CORRECTION RESOLVES AGAINST THE SETTLED ROWS (WO-2026-08-18-04) --
      //
      // And ONLY when he typed the keyword. `correction` comes off
      // parseBoardReply and is the human's own explicit act; nothing here infers
      // it from the words, the timing or the state of the board.
      if (n.correction === true) {
        if (ambiguousSettled.has(n.ordinal)) { refusedForShop += 1; continue; }
        const settledQ = settledByOrdinal.get(n.ordinal);
        if (settledQ) {
          mappings.push({
            questionKey: settledQ.questionKey,
            shopRef: settledQ.shopRef,
            answerText: n.answerText,
            correction: true,
          });
          continue;
        }
        // "change 4" against a question that is still OPEN is not a correction -
        // there is nothing settled to supersede. It falls through and becomes an
        // ordinary answer, which is what he plainly meant and what the command
        // surface would otherwise refuse.
      }
      if (ambiguousOrdinals.has(n.ordinal)) { refusedForShop += 1; continue; }
      const q = byOrdinal.get(n.ordinal);
      if (!q) continue;
      mappings.push({
        questionKey: q.questionKey, shopRef: q.shopRef, answerText: n.answerText, correction: false,
      });
    }
    if (refusedForShop > 0) {
      log('board_reply_shop_ambiguous', {
        numbered: numbered.length,
        refused: refusedForShop,
        open_questions: scoped.length,
      });
    }
    if (mappings.length > 0) {
      log('board_reply_correlated', {
        numbered: numbered.length,
        matched: mappings.length,
        corrections: mappings.filter((m) => m.correction === true).length,
      });
      return { mappings, unmapped: null, modelCalled: false };
    }
    // Every number missed. Fall through rather than refusing: "3 for £5" is a
    // shopping-list line, and this parser must never be the thing that decides
    // a genuine list is an answer.
    log('board_reply_uncorrelated', { numbered: numbered.length, open_questions: scoped.length });
  }

  // NOTHING OPEN. Steps 1-3 all correlate against OPEN questions, so with none
  // there is nothing for them to do - and step 3 would put a model call on the
  // wire carrying an empty question list, which can only ever come back wrong.
  // Reached whenever a correction was the only thing that could have matched and
  // did not; the caller then tells him rather than writing anything.
  if (scoped.length === 0) {
    log('typed_message_nothing_open', { settled_questions: scopedSettled.length });
    return null;
  }

  // ── 1. DETERMINISTIC. No model call, and the same resolver the spine uses. ─
  //
  // NEEDS NO AMBIGUITY DROP OF ITS OWN, and that is worth stating rather than
  // leaving to be rediscovered: `exact.length === 1` already requires the label
  // to be unique across the whole candidate set, so a label offered by two
  // shops falls through here by construction. What was wrong before WP-B15-18
  // was the SET - unscoped, so the single match could belong to a shop he was
  // not addressing. Scoping the set is the entire fix for this step.
  const exact = scoped.filter((q) => shopDecisions.resolveExactCandidate({
    status: 'open',
    answer_text: words,
    candidates: q.candidates,
    rendered_candidates: q.renderedCandidates,
  }) !== null);
  if (exact.length === 1) {
    return {
      mappings: [{ questionKey: exact[0].questionKey, shopRef: exact[0].shopRef, answerText: words }],
      unmapped: null,
      modelCalled: false,
    };
  }

  // ── 2. NOTHING TO CHOOSE BETWEEN. ─────────────────────────────────────────
  //
  // THE WORST OF THE FOUR, because it needs no number and no label - so when it
  // wrote to the wrong shop there was nothing left in the message for anyone to
  // blame. "Nothing to choose between" is only true inside ONE shop: with his
  // board fully settled and another shop holding one open question, this used
  // to read the estate as having exactly one candidate and answer a shop he was
  // not looking at. Scoped, the question is asked of his board and the settled
  // case is caught earlier, by the notice in runOnce.
  //
  // ── THE LATE-ANSWER GUARD (WO-2026-08-18-B15-RUNTIME) ─────────────────────
  //
  // THIS STEP IS ALSO HOW ANSWERS SLID ONTO THE FOLLOWING QUESTION on
  // 2026-08-17: as each question was settled, the next became the sole open
  // one, and the next thing Warwick typed was absorbed by it. Four answers
  // ended up on the wrong rows and could not be taken back, because
  // `answerQuestion` is a compare-and-set on status='open' and the first write
  // wins.
  //
  // BINDING MUST BE BY QUESTION IDENTITY, NEVER BY ARRIVAL ORDER. But the
  // opposite failure is ALSO a real, quoted Warwick defect - 2026-08-09,
  // WP-B15-A1: "I dont have a bloody card I can type an answer... I don't want
  // to be pressing buttons." A bare typed message MUST still be able to answer
  // the open question, and dropping it is not an improvement.
  //
  // Both hold at once, because the two cases are distinguishable on EVIDENCE
  // rather than on timing. The slide has a signature the ordinary case does
  // not: the words resolve to a candidate of a question in this shop that has
  // ALREADY BEEN ANSWERED. That is a late answer to a settled question, and it
  // is the one thing that must never be written onto whatever happens to be
  // open now. Everything else binds exactly as it did.
  if (scoped.length === 1) {
    const only = scoped[0];
    const late = await answersASettledQuestion(deps, { shopId: only.shopId, words, log });
    if (late) {
      // REFUSED, not mis-bound, and not silent: returning null leaves the
      // caller to decline the claim and tell him, which is recoverable. A
      // wrong write on a compare-and-set row is not.
      log('late_answer_to_a_settled_question', {
        shop_ref: only.shopRef,
        settled_question_key: late.questionKey,
        open_question_key: only.questionKey,
        detail: 'these words answer a question that is already settled - they are NOT written onto the question that happens to be open now',
      });
      return null;
    }
    return {
      mappings: [{ questionKey: only.questionKey, shopRef: only.shopRef, answerText: words }],
      unmapped: null,
      modelCalled: false,
    };
  }

  // ── 3. TERRA, ONCE, WITH EVERY OPEN KEY. ──────────────────────────────────
  if (typeof deps.correlateAnswer !== 'function') {
    log('answer_correlation_unavailable', {
      open_questions: scoped.length,
      detail: 'no answer correlator is wired into this runtime, so a typed message cannot be matched to one of several open questions',
    });
    return null;
  }

  let returned = null;
  try {
    returned = await deps.correlateAnswer({
      answer_text: words,
      questions: scoped.map((q) => ({
        question_key: q.questionKey,
        question_text: q.questionText,
        item_name: q.itemName,
        candidates: q.candidates,
      })),
    });
  } catch (err) {
    log('answer_correlation_failed', {
      open_questions: scoped.length, detail: String(err && err.message ? err.message : err),
    });
    return null;
  }

  if (!returned || !Array.isArray(returned.mappings) || returned.mappings.length === 0) {
    log('answer_correlation_empty', { open_questions: scoped.length });
    return null;
  }

  // A question_key hashes the ITEM NAME and nothing else, so two shops asking
  // about the same thing mint the identical key and the model's answer names
  // BOTH of them. Unscoped, last-write-wins picked one. That derivation is
  // pinned to live rows and is not ours to change - the lookup is.
  const ambiguousKeys = tokensOfferedByMoreThanOneShop(scoped, (q) => q.questionKey);
  const byKey = new Map(scoped
    .filter((q) => !ambiguousKeys.has(q.questionKey))
    .map((q) => [q.questionKey, q]));
  const mappings = [];
  // ── THE CORROBORATION GATE (WO-2026-08-18-03 AC1) ────────────────────────
  //
  // Mappings the model claimed at `high` confidence WHILE HIS WORDS NAMED A
  // DIFFERENT OPEN QUESTION. This is the 2026-08-17 defect: seven answers
  // written in 2.5 seconds, the first three right, and from the fourth on every
  // one landed on the question above - "Ice lollies..." onto Ben & Jerry's while
  // fruit lolly ice sat open one row below. `answerQuestion` is a compare-and-
  // set, so each of those writes was permanent on arrival and the only way out
  // was cancelling the shop, which is what Warwick did.
  //
  // CONTRADICTION-ONLY, on his ruling of 2026-08-18: an answer that names
  // nothing in particular STILL BINDS, because refusing his shorthand is a cost
  // he declined to pay. See answerCorroboration.js for the residual he
  // acknowledged rather than waived. These refusals are carried back to the
  // caller rather than dropped, because a refusal he is not told about is a
  // silent loss and that is the failure this whole path already exists to
  // prevent.
  const uncorroborated = [];
  let refusedForShop = 0;
  for (const m of returned.mappings) {
    if (!m || m.confidence !== 'high') continue;
    if (ambiguousKeys.has(m.question_key)) { refusedForShop += 1; continue; }
    const q = byKey.get(m.question_key);
    // A key the correlator was never shown is dropped, not corrected.
    if (!q) continue;
    const answerText = m.answer_text || words;

    const verdict = bindingVerdict({ answerText, question: q, scoped });
    if (!verdict.bind) {
      uncorroborated.push({
        questionKey: q.questionKey,
        shopRef: q.shopRef,
        shopId: q.shopId,
        ordinal: q.ordinal,
        itemName: q.itemName || q.questionText || null,
        answerText,
      });
      log('answer_mapping_uncorroborated', {
        shop_ref: q.shopRef,
        question_key: q.questionKey,
        open_questions: scoped.length,
        points_at: verdict.elsewhere.map((e) => e.questionKey),
        on: verdict.elsewhere.flatMap((e) => e.on),
        detail: 'the model mapped these words to this question and the words name a DIFFERENT open question - REFUSED, not written',
      });
      continue;
    }

    mappings.push({ questionKey: q.questionKey, shopRef: q.shopRef, answerText });
  }
  if (refusedForShop > 0) {
    log('answer_correlation_shop_ambiguous', {
      refused: refusedForShop, open_questions: scoped.length,
    });
  }
  if (mappings.length === 0 && uncorroborated.length === 0) {
    log('answer_correlation_low_confidence', { open_questions: scoped.length, offered: returned.mappings.length });
    return null;
  }

  // ── WHY THIS IS NOT `null` WHEN EVERYTHING WAS REFUSED ────────────────────
  //
  // `null` means "not ours", and the caller hands a message that is not ours to
  // intake - where it becomes a NEW SHOPPING LIST. Returning null here would
  // turn a refused answer into a phantom shop, which is a worse failure than
  // the one being fixed. An empty `mappings` with a populated `uncorroborated`
  // says the opposite: this IS ours, we refused to place it, and the caller
  // owes him a question.
  return {
    mappings, unmapped: returned.unmapped_text || null, modelCalled: true, uncorroborated,
  };
}

/**
 * PURE. The (chat, message) of the card a typed reply is replying TO.
 *
 * That pair is the ONLY correlation there is for a typed answer: the reply text
 * carries nothing that names a question, and matching the words to a candidate is
 * a decision nothing in this path is allowed to make.
 */
function replyTargetOf(update) {
  const msg = update && update.message;
  const target = msg && msg.reply_to_message;
  if (!msg || !target || typeof target !== 'object') return null;
  const chatId = msg.chat && msg.chat.id !== undefined ? msg.chat.id : null;
  const messageId = target.message_id !== undefined ? target.message_id : null;
  if (chatId === null || messageId === null) return null;
  return { chatId, messageId };
}

/**
 * PURE. Is this update a callback button THIS product drew? (WP-B15-08 AC10)
 *
 * Decided on the NAMESPACE and nothing else. A list of action names would have
 * to be edited every time an action is added, and the one that was missing from
 * such a list is exactly the one nobody notices - `search` was declared,
 * rendered on every question card, and handled nowhere.
 */
function isOurCallback(update) {
  const data = update && update.callback_query && typeof update.callback_query.data === 'string'
    ? update.callback_query.data
    : '';
  return data.startsWith(`${CALLBACK_NAMESPACE}${CALLBACK_SEPARATOR}`);
}

/**
 * PURE. The action and shop a callback CLAIMS, read off the raw payload.
 *
 * Deliberately NOT parseCallbackData: this is used on the path where that parser
 * has already REFUSED, and the point is to tell the human which shop and which
 * control he touched. Reading two fields out of a string we have already decided
 * not to act on carries no risk - nothing downstream of here dispatches on it.
 */
function claimedCallbackParts(update) {
  const data = update && update.callback_query && typeof update.callback_query.data === 'string'
    ? update.callback_query.data : '';
  const parts = data.split(CALLBACK_SEPARATOR);
  return {
    action: parts[1] || null,
    shopRef: parts[2] && /^[A-Za-z0-9._-]{1,32}$/.test(parts[2]) ? parts[2] : null,
  };
}

/**
 * TELL HIM A CONTROL WAS REFUSED, BY A ROUTE THAT SURVIVES. (WP-B15-09 AC6/AC7)
 *
 * ── ONE NOTICE PER TAP, EVER ────────────────────────────────────────────────
 * The family is keyed on the UPDATE ID, and a spent generation of that family is
 * the honest question. Without it, a stale button pressed five times - or one
 * press redelivered because the offset never advanced - mints a notice every
 * pass and rebuilds the exact storm this Work Package is closing. Same guard,
 * same reasoning, as the deferred-window notice further down this file.
 *
 * ── IT NEVER THROWS ─────────────────────────────────────────────────────────
 * This runs inside tap routing. A notice that cannot be queued must not take the
 * pass down with it; the toast and the journal line are still attempted, and the
 * failure is logged loudly.
 */
async function tellControlRefused(deps, { update, action, reason, detail, log = () => {} } = {}) {
  const { shopRef } = claimedCallbackParts(update);
  if (!shopRef) return false;
  try {
    const shop = await store.findShopByRef(deps, shopRef);
    if (!shop) return false;
    const updateId = update && update.update_id !== undefined ? update.update_id : null;
    if (updateId === null) return false;
    const key = outboxKeyFor(shop.shop_ref, `control_refused.${updateId}`);
    const family = ledgerFamilyKey({
      kind: LEDGER_KINDS.OUTBOX,
      householdId: shop.household_id,
      name: 'control_refused',
      key,
    });
    if ((await store.spentLedgerGenerations(deps, family)) > 0) return false;
    await store.enqueueMessage(deps, {
      householdId: shop.household_id,
      shopId: shop.id,
      kind: 'control_refused',
      key,
      payload: { shopRef: shop.shop_ref, control: action || null, reason: reason || null, detail: detail || null },
    });
    return true;
  } catch (err) {
    log('control_refused_notice_failed', {
      updateId: update && update.update_id,
      detail: String(err && err.message ? err.message : err),
    });
    return false;
  }
}

/**
 * PHASE 1b - route the taps and typed replies the receiver ignored.
 *
 * A tap becomes a command through the SAME surface the Cockpit uses. Nothing
 * here decides anything: it routes, translates, calls, and answers the tap.
 *
 * ── CORRELATION IS PER-UPDATE, AND IT GOES THROUGH THE CARD ─────────────────
 * The two lookups the router and the adapter need are SYNCHRONOUS, and the
 * adapter's `resolveCandidate(shopRef, questionKey, index)` is not even handed
 * the card the button was on. So both are built HERE, per update, from a lookup
 * that has already been done asynchronously against the ONE card this update
 * actually came from:
 *
 *   a typed reply   -> getQuestionByCard(chat, replied-to message)
 *   a candidate tap -> resolveCandidateAnswer(..., chat, tapped message)
 *
 * That is what makes a STALE TAP detectable rather than guessed at. An index is
 * meaningless except against the exact list that was displayed, so it is resolved
 * against the render contract bound to THAT card and against nothing else. A tap
 * on a superseded card finds no contract at that (chat, message), the question is
 * found alive under a NEWER card, and the tap is refused out loud - it is never
 * mapped onto whatever now happens to sit at that index.
 *
 * `questions` is the injected question store (getQuestionByCard/getQuestionByKey).
 * Without it the older injected `bot.resolveQuestionByMessage` / `bot.resolveCandidate`
 * closures are used unchanged, so a caller that wires neither still behaves exactly
 * as before - it just cannot resolve an answer, which is the defect this fixes.
 */
export async function routeTaps(deps, {
  updates, bot, questions = null, claimedUpdateIds = null, log = () => {},
} = {}) {
  if (!bot || !Array.isArray(updates) || updates.length === 0) return { routed: [], refused: [] };
  const routed = [];
  const refused = [];

  // ── THE TOAST NEVER STOPS THE SHOP (WO-2026-08-10-B15-04 AC3) ─────────────
  //
  // answerCallbackQuery is a grey toast on a button. Telegram rejects it with
  // "query is too old and response timeout expired or query ID is invalid"
  // whenever the tap has been sitting for more than ~15 minutes - which is
  // routine here, because a pass runs on an interval and a tap can easily be
  // older than the pass that picks it up.
  //
  // Unguarded, that throw escaped routeTaps, escaped runOnce, and runWatch
  // logged pass_failed - over and over on the evening of 2026-08-09. Everything
  // after routeTaps in the pass (advanceAll, queueShopCards, drainOutbox) never
  // ran, so nothing advanced and no card reached Warwick's phone.
  //
  // THE TAP ITSELF IS ALREADY DURABLE - every answer landed in Postgres despite
  // this. So the only thing lost by swallowing the rejection is the toast, and
  // the fix is to swallow it LOUDLY: logged as tap_ack_failed, never rethrown.
  //
  // NOT fixed by removing the acknowledgement. The missing confirmation is a
  // real UX defect - Warwick tapped repeatedly because nothing came back - and
  // it is REPORTED separately, not resolved by deleting the call.
  /** PURE. The callback-query id of a raw update, for the refusal path where no
   *  parsed intent exists to carry one. */
  const cbIdOf = (update) => (update && update.callback_query && update.callback_query.id !== undefined
    ? update.callback_query.id : null);

  const acknowledge = async (intent, text) => {
    if (!bot.answerTap || !intent || !intent.raw || !intent.raw.callbackQueryId) return;
    try {
      await bot.answerTap(intent.raw.callbackQueryId, text);
    } catch (err) {
      log('tap_ack_failed', {
        action: intent.action,
        callbackQueryId: intent.raw.callbackQueryId,
        detail: String(err && err.message ? err.message : err),
      });
    }
  };

  for (const update of updates) {
    // ALREADY HANDLED. A message the route-first claim answered during intake is
    // durably settled; routing it a second time would try to answer the same
    // question twice. Harmless (answerQuestion is a compare-and-set) but noisy
    // and misleading in the report, so it is skipped explicitly.
    if (claimedUpdateIds && update && claimedUpdateIds.has(update.update_id)) continue;
    // ── a typed reply: correlate to the card it replies to, before routing.
    let resolveQuestionByMessage = bot.resolveQuestionByMessage;
    const replyTo = questions ? replyTargetOf(update) : null;
    if (replyTo) {
      let row = null;
      try {
        row = await questions.getQuestionByCard(replyTo);
      } catch (err) {
        // A lookup that cannot run must not become a WRONG correlation.
        log('question_lookup_failed', { detail: String(err && err.message ? err.message : err) });
      }
      resolveQuestionByMessage = questionLookupFrom(row ? [row] : []);
    }

    const intent = bot.routeAsdairUpdate(update, { resolveQuestionByMessage });
    if (!intent.ok) {
      // Not ours (the hub's `decision:` cards share this phone), or malformed.
      // Never guessed at - and, since WP-B15-A1, never SILENT either.
      //
      // This was a bare `continue` with no log at all, which is how a dropped
      // inbound became invisible: question 76463 was answered by a real person
      // and there was nothing anywhere - no row, no line, no counter - saying
      // the message had arrived and been discarded. A refusal is a decision, and
      // a decision with no trace cannot be debugged, cannot be counted, and
      // cannot be noticed. Every refused inbound now leaves one.
      //
      // ── THE TRACE IS A LOG LINE, NOT A `refused` ENTRY, AND THAT IS EXACT ──
      // `refused` is what the pass REPORTS, and a foreign namespace - the hub's
      // `decision:` cards share this phone - is not AsdAIr's to refuse out loud.
      // An existing test pins that ("a foreign namespace is not ours to refuse
      // out loud") and it is right: reporting other systems' traffic as our
      // refusals would make every pass look broken. So the trace goes to the
      // journal, where a dropped inbound can be found, and the report stays
      // about our own messages.
      //
      // ── BUT OUR OWN NAMESPACE IS NOT FOREIGN TRAFFIC (WP-B15-08 AC10) ─────
      // That rule was being applied to EVERYTHING, including callbacks in our
      // own `asd:` namespace that came off cards we drew ourselves. Warwick
      // pressed a button we rendered and the only record was a journal line he
      // will never read. The distinction is the NAMESPACE - never a list of
      // action names, which would go stale the moment an action is added.
      //
      // ── AND A PASS REPORT IS NOT A ROUTE TO A HUMAN (WP-B15-09 AC6) ───────
      // Pushing the refusal into `refused` was where WP-B15-08 stopped, and it
      // is not enough: the comment above says "the only record was a journal
      // line he will never read" and the fix wrote to a pass report, which he
      // reads even less often. He gets the toast AND a card that survives it.
      log('inbound_refused', { updateId: update && update.update_id, reason: intent.reason });
      if (isOurCallback(update)) {
        const { action: claimed } = claimedCallbackParts(update);
        refused.push({ action: claimed, reason: intent.reason, detail: null, refresh: false });
        await acknowledge(
          { action: claimed, raw: { callbackQueryId: cbIdOf(update) } },
          'That button is not one I can act on - check the list I sent you',
        );
        await tellControlRefused(deps, {
          update, action: claimed, reason: intent.reason, detail: null, log,
        });
      }
      continue;
    }

    // ── a candidate tap: resolve the INDEX through the render contract of the
    //    card it was on. `refusal` carries the honest reason when it cannot be.
    let resolveCandidate = bot.resolveCandidate;
    let refusal = null;
    if (questions
        && intent.action === ACTIONS.ANSWER
        && intent.arg
        && intent.raw && intent.raw.kind === 'callback') {
      const parsed = bot.parseAnswerArg ? bot.parseAnswerArg(intent.arg) : { ok: false };
      if (parsed.ok) {
        const resolved = await resolveCandidateAnswer({
          store: questions,
          shopRef: intent.shopRef,
          questionKey: parsed.questionKey,
          candidateIndex: parsed.candidateIndex,
          chatId: intent.raw.chatId,
          messageId: intent.raw.messageId,
        });
        if (resolved.ok) {
          // Bound to THIS tap. It answers for no other question and no other index.
          resolveCandidate = (ref, key, index) => (
            key === parsed.questionKey && index === parsed.candidateIndex ? resolved.label : null
          );
        } else {
          refusal = resolved;
          resolveCandidate = () => null;
        }
      }
    }

    const mapped = intentToCommand(intent, {
      parseAnswerArg: bot.parseAnswerArg,
      resolveCandidate,
    });
    if (!mapped.ok) {
      // A refusal from the render contract is more informative than the adapter's
      // generic "could not be resolved", and it is what Warwick is told.
      const reason = refusal ? refusal.code : mapped.reason;
      const detail = refusal ? refusal.notice : mapped.detail;
      refused.push({
        action: intent.action, reason, detail,
        refresh: refusal ? refusal.refresh === true : false,
      });
      // Recorded as well as returned (WP-B15-A1, AC4). The report reaches
      // whoever reads the pass result; the log reaches whoever is reading the
      // journal at 7am wondering why an answer did nothing.
      log('inbound_refused', { updateId: update && update.update_id, action: intent.action, reason });
      await acknowledge(intent, detail || reason);
      // ── THE TOAST IS NOT A ROUTE HE CAN RELY ON (WP-B15-09 AC6/AC7) ───────
      // This branch DID acknowledge, and it is the branch Warwick's `Search
      // ASDA` tap actually took on 2026-08-10 - the journal line carries an
      // `action` field, which only this call site emits. He still saw nothing,
      // because answerCallbackQuery is rejected once a tap is more than about
      // fifteen minutes old and a pass runs on an interval. So the defect was
      // never a missing acknowledge; it was that the only route expires.
      if (intent.raw && intent.raw.kind === 'callback') {
        await tellControlRefused(deps, { update, action: intent.action, reason, detail, log });
      }
      continue;
    }
    // THE DISPATCH IS THE ONLY THING THIS try GUARDS. Acknowledging outside it
    // is deliberate: a landed command whose toast failed used to be caught here
    // and reported as `command failed`, which is a lie about a durable answer -
    // and then the catch's OWN answerTap threw again and escaped the function.
    let receipt = null;
    try {
      receipt = await commands.dispatch(mapped.command, mapped.spec, deps);
    } catch (err) {
      const detail = String(err && err.message ? err.message : err);
      refused.push({ action: intent.action, reason: 'command failed', detail });
      log('tap_failed', { action: intent.action, detail });
      await acknowledge(intent, 'That did not work - check the status card');
      continue;
    }
    routed.push({ action: intent.action, command: mapped.command, receipt });
    // ── A READ THAT PRODUCES NOTHING VISIBLE IS A DEAD CONTROL (AC5) ────────
    // getStatus is `durable:false` - it writes no row and queues no card. So
    // "View status", "Review list", "View held items", "View exceptions",
    // "Answer N questions" and "Show me what is waiting" ALL landed here and
    // produced, on his phone, precisely nothing. Six controls that read as
    // actionable and did nothing. The board is the answer to every one of them.
    if (mapped.command === COMMANDS.GET_STATUS && receipt && receipt.shop_id !== undefined) {
      try {
        const shop = await store.findShopById(deps, receipt.shop_id);
        if (shop) await queueBoard(deps, shop, { force: true, log });
      } catch (err) {
        log('board_on_demand_failed', {
          action: intent.action, detail: String(err && err.message ? err.message : err),
        });
      }
    }
    await acknowledge(intent, receipt.duplicate ? 'Already asked for' : 'Got it');
  }
  return { routed, refused };
}

/** PHASE 2 - advance every shop that is still moving, by exactly one step -
 *  plus any finished shop still carrying a command that must be retired. */
export async function advanceAll(deps, { log = () => {} } = {}) {
  const shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  const results = [];
  for (const shop of shops) {
    try {
      const r = await runPipeline({ shopId: shop.id }, deps);
      results.push(r);
      log('advanced', { shop_ref: shop.shop_ref, step: r.step, stepped: r.stepped, to: r.to });
    } catch (err) {
      // A shop whose SNAPSHOT could not even be read must not stop the others.
      results.push({
        ok: false, shop_id: shop.id, shop_ref: shop.shop_ref, stepped: false,
        error: String(err && err.message ? err.message : err),
      });
    }
  }
  return results;
}

/**
 * PHASE 2b - QUEUE THE CARDS A SHOP HAS EARNED BUT NOTHING ELSE PRODUCES.
 *
 * ── WHY THIS IS HERE AND NOT IN THE STATE MACHINE ───────────────────────────
 * Both cards below are BOOKKEEPING ALONGSIDE A PASS, not transitions. That is
 * the same argument runPipeline makes for the receipt and the "reading your list"
 * cards, and it matters for the same reason: `messageForTransition` is keyed per
 * TRANSITION, so a shop that reaches a state twice would re-mint a card it has
 * already sent. These are facts about a shop's whole life.
 *
 * ── THE QUESTION CARD (the defect this exists to close) ─────────────────────
 * Every question in this system was, until now, answered because a human was
 * asked BY HAND. `sendQuestionCard()` was complete and tested and had zero
 * production callers; nothing anywhere enqueued an outbox row of kind `question`.
 * A shop could sit at NEEDS_DECISION indefinitely, silently, waiting for a
 * question it had never actually asked.
 *
 * ── NEVER TWICE, AND THE IDEMPOTENCY IS NOT outboxEverQueued ────────────────
 * `store.outboxEverQueued(deps, shopId, kind)` is per-KIND-per-shop. That is
 * exactly right for the receipt and for basket_ready (one per shop, ever) and
 * exactly WRONG for questions: one shop holds many, so the first question would
 * card and every other question would be silently swallowed forever. Per-question
 * idempotency is therefore two durable facts, and neither is a flag this process
 * remembers:
 *
 *   1. `shop_question.card_message_id` is set by persistQuestionRender only after
 *      a card is genuinely on Warwick's phone. A question carrying one has been
 *      asked, and is skipped here for good - across passes, restarts and reboots.
 *   2. Between the enqueue and the send that row is still null, and the window is
 *      closed by the ledger itself: the outbox family key is derived from the
 *      question key, so a second pass computes the SAME key while the first row
 *      is still pending and `recordLedgerEntry` ADOPTS it rather than queueing a
 *      second card. The database decides the duplicate, not this code.
 */
/**
 * THE BASKET HANDBACK CONTRACT IN FORCE. Bump it when the SHAPE of the
 * basket_ready payload changes, and fill the payload in the same change.
 *
 * ── WHY A VERSION AND NOT A ONE-PER-SHOP FLAG ───────────────────────────────
 * The obvious guard - `outboxEverQueued(shopId, 'basket_ready')` - reads the
 * FULL ledger history per KIND, so once ANY basket_ready card has gone out that
 * shop can never receive another one. That is correct while the card's contents
 * are fixed, and it becomes a SILENT TRAP the moment they are not: a shop that
 * received today's near-empty handback (there is no basket-lines table and no
 * basket writer yet, so every field except the ref would be invented) would be
 * permanently suppressed from ever receiving the real one. The guard working
 * exactly as designed is what makes that failure silent, which is the whole
 * reason it is worth removing before it can happen rather than after.
 *
 * So "already handed back" is asked PER CONTRACT, not per kind. Each contract
 * is its own ledger family, and the once-ever property is preserved INSIDE each
 * family - trading a permanent-suppression trap for a duplicate-card trap would
 * not be progress.
 *
 * ── AND THE TRANSITION IS ON THE ROW, NOT INFERRED ──────────────────────────
 * A row carries `handbackContract` and, when it replaces earlier ones,
 * `supersedes: [n, ...]` listing the contracts this shop was ALREADY sent. So
 * "why did this shop get two handbacks" is answered by reading the ledger row,
 * not by diffing kinds or by finding the change that introduced it.
 */
export const BASKET_HANDBACK_CONTRACT = 2;

/**
 * PURE. The basket_ready payload, DERIVED FROM THE VERIFICATION REPORT and never
 * from raw captured lines.
 *
 * `report` is exactly what `reconcile/verifyBasket.js` returns. Nothing here
 * recomputes a verdict, and nothing here reads the captured basket directly:
 * "basket ready" is a claim that reconciliation passed, so the reconciler's own
 * output is the only thing entitled to make it.
 *
 * ── verified IS NOT DERIVED FROM THE COUNTS, AND CANNOT BE ──────────────────
 * `report.verified` is passed through untouched. verifyBasket computes it from
 * the LINES precisely because two wrong products swapped for each other produce
 * a perfect headline, and its own suite mutation-tests that exact substitution.
 * `countsMatch` travels beside it, separately, labelled by the renderer as not
 * the verdict.
 *
 * ── packetSelfConsistent: null WHEN NOTHING WAS DECLARED TO CHECK ───────────
 * verifyBasket returns `packet_self_consistent: true` when the packet declares
 * no counts at all - vacuously, because there was nothing to disagree with. That
 * is honest inside that module and MISLEADING once it reaches a card, where a
 * `true` reads as "checked and fine". Executed evidence, not inference: passing
 * a real `buildHandoff()` artefact straight into verifyBasket leaves
 * `headline.declared_*` null and `packet_self_consistent` true even when the
 * packet's declared counts are deliberately corrupted to 999 (see the handback -
 * the two modules name different fields for the same fact). So a report that
 * declared nothing yields `null` here - "not checked" - never `true`.
 */
export function basketHandbackPayload(report) {
  const outcome = (name) => report.lines.filter((l) => l.outcome === name);
  const headline = report.headline || {};
  const declaredNothing = (headline.declared_distinct_products === null
    || headline.declared_distinct_products === undefined)
    && (headline.declared_total_units === null || headline.declared_total_units === undefined);

  return {
    verified: report.verified === true,
    blocking: Array.isArray(report.blocking) ? report.blocking.slice() : [],
    countsMatch: typeof report.counts_match === 'boolean' ? report.counts_match : null,

    // Two separate facts. The renderer never merges them into one "count".
    expectedDistinctProducts: headline.expected_distinct_products ?? null,
    actualDistinctProducts: headline.actual_distinct_products ?? null,
    expectedTotalUnits: headline.expected_total_units ?? null,
    actualTotalUnits: headline.actual_total_units ?? null,

    // NEVER the word "substituted": the outcome does not exist in this product.
    unavailable: outcome('unavailable').map((l) => ({
      name: l.canonical_product_name, quantity: l.actual_quantity ?? l.expected_quantity ?? null,
    })),
    missing: outcome('missing').map((l) => ({
      name: l.canonical_product_name, quantity: l.expected_quantity ?? null,
    })),
    quantityMismatches: outcome('quantity_mismatch').map((l) => ({
      name: l.canonical_product_name, expected: l.expected_quantity, actual: l.actual_quantity,
    })),
    unexpected: (report.unexpected || []).map((u) => ({ name: u.product_name, quantity: u.quantity ?? null })),

    // The weakest identity there is. A reviewer deserves to know which lines
    // rest on nothing but a name.
    nameOnlyMatches: report.lines
      .filter((l) => l.matched_on === 'name')
      .map((l) => l.canonical_product_name),

    packetSelfConsistent: declaredNothing ? null : report.packet_self_consistent === true,
  };
}

/** The ledger family one shop's basket handback occupies at one contract. */
function basketHandbackFamily(shop, contract) {
  return ledgerFamilyKey({
    kind: LEDGER_KINDS.OUTBOX,
    householdId: shop.household_id,
    name: 'basket_ready',
    key: outboxKeyFor(shop.shop_ref, `basket_ready.c${contract}`),
  });
}

/**
 * Has a basket handback at THIS contract already gone out for this shop?
 *
 * A spent generation means a row of this family reached a terminal status -
 * sent, failed or retired - so the card has had its one life. A row that is
 * still PENDING is deliberately not counted: re-enqueueing it computes the same
 * family, and recordLedgerEntry adopts the existing row rather than stacking a
 * second, so the database closes that window without this code checking first.
 */
async function handbackAlreadySpent(deps, shop, contract) {
  return (await store.spentLedgerGenerations(deps, basketHandbackFamily(shop, contract))) > 0;
}

/**
 * @param {{shops?:Array, contract?:number, log?:Function}} options
 *   `contract` is the basket handback contract in force. It defaults to the
 *   constant above and is injectable for the same reason the clock is injected
 *   into pollIntake: the SUPERSESSION - a shop moving from one contract to the
 *   next - is a behaviour, and a behaviour that cannot be exercised cannot be
 *   proven.
 */
/** The outbox kind of THE BOARD - the one surface (WP-B15-09). */
export const BOARD_KIND = 'question_board';

/** The reason the board gives when the shop's own open questions are the
 *  blocker. Unchanged from WP-B15-09 - an open question is the one blocker the
 *  board can see for itself. */
const BLOCKED_BY_QUESTIONS = 'READY_TO_SHOP cannot be reached while a question is open.';

/**
 * PURE. Which of `planOutcome`'s PARKS this shop is sitting in, from DURABLE
 * evidence only. (WP-B15-15)
 *
 * ── THE ENUMERATION, AND WHY IT IS THE WHOLE SCOPE ──────────────────────────
 * `planOutcome` (stages.js:337-356) has four exits. A park is an exit carrying
 * `to: null`; `stepPlan` then writes NO transition and the shop STAYS where it
 * is. There are exactly two:
 *
 *   E0      openQuestions > 0                       -> NEEDS_DECISION  (moves)
 *   PARK-1  needsReview && !interpretationConfirmed  -> to:null  wait:interpretation_confirmation
 *   PARK-2  unresolvedLines > 0                      -> to:null  wait:line_resolution
 *   E3      else                                     -> READY_TO_SHOP  (moves)
 *
 * BOTH are structurally unreachable unless `openQuestions === 0`, because the
 * first branch returns before either is evaluated. That is exactly the state in
 * which the board's `outstanding` array is empty - so before this function the
 * board answered "nothing is blocking" in precisely the two states where
 * something was.
 *
 * ── WHY `PROCESSING` IS THE WHOLE WINDOW ────────────────────────────────────
 * `planOutcome` is called from `stepPlan`, which only runs at `PROCESSING`, and
 * a park writes no transition. So a parked shop is a PROCESSING shop with no
 * open question, and no other status can be holding one of these two parks.
 *
 * ── WHY THE THIRD STATE EXISTS RATHER THAN A GUESS ──────────────────────────
 * PARK-2's condition is `unresolvedLines`, which is computed by the PLANNER
 * inside runPipeline (catalogue + rulebook + Warwick's decisions). It is not
 * durable state and this module cannot re-derive it without re-running the
 * planner. Re-implementing it here would create a SECOND authority that can
 * drift from stages.js - which is the very class of defect this closes. So the
 * board reads the durable trace the park itself leaves, and where there is no
 * trace it STOPS CLAIMING rather than guessing.
 *
 * @returns {null|{parked:true|null, step:string|null, reason:string|null}}
 *   `null`   - outside the park window entirely; questions alone decide.
 *   `parked:true`  - a park is EVIDENCED, with the authority's own step.
 *   `parked:null`  - inside the window with no evidence either way. The board
 *                    must say so and must never say `false`.
 */
export function parkStateOf(evidence = {}) {
  const status = evidence.status || null;
  const openQuestions = Number(evidence.openQuestions) || 0;
  if (status !== 'PROCESSING' || openQuestions > 0) return null;

  // THE ORDER IS THE AUTHORITY'S ORDER, NOT A CHOICE. planOutcome evaluates the
  // interpretation gate BEFORE the line gate, so a shop holding both reports
  // the interpretation - and flips to the lines the moment Warwick confirms the
  // reading. Picking the other one would make the board disagree with the
  // reason the shop is actually stopped.
  if (evidence.needsReview === true && evidence.interpretationConfirmed !== true) {
    return {
      parked: true,
      step: STEPS.AWAIT_INTERPRETATION_CONFIRMATION,
      reason: 'The list needed review and nobody has confirmed the interpretation yet. '
        + 'READY_TO_SHOP cannot be reached until you confirm I read it correctly.',
    };
  }

  // The durable trace of PARK-2. `lines_unresolved` is queued by stepPlan on
  // the pass that parks the shop, at most once ever - so this row IS the park's
  // durable evidence, and that is why retiring the card would blind the board.
  if (evidence.linesUnresolvedAnnounced === true) {
    return {
      parked: true,
      step: STEPS.AWAIT_LINE_RESOLUTION,
      reason: 'Some lines have no structured decision and no open question to settle them. '
        + 'READY_TO_SHOP cannot be reached until those lines are resolved.',
    };
  }

  return { parked: null, step: null, reason: null };
}

/** PURE. Tri-state `blocked`, and the reason that goes with it. */
function blockedFrom(outstandingCount, park) {
  // An OPEN question wins outright: it is the one blocker the board can see for
  // itself, and it is a fact rather than an inference.
  if (outstandingCount > 0) return { blocked: true, blockedReason: BLOCKED_BY_QUESTIONS };
  if (!park || park.parked === false) return { blocked: false, blockedReason: null };
  if (park.parked === true) return { blocked: true, blockedReason: park.reason };
  // The third state. renderMessages has shipped it since WP-B15-09 - "I cannot
  // tell you whether anything is blocking this shop" - and nothing had ever
  // produced it. `null` is strictly more honest than `false` in the one window
  // where the board cannot see.
  return { blocked: null, blockedReason: null };
}

/** The ledger family one shop's board occupies. ONE family for the life of the
 *  shop: every rewrite is the next GENERATION of the same family, which is what
 *  makes the previous one addressable by arithmetic rather than by a new column. */
function boardFamily(shop) {
  return ledgerFamilyKey({
    kind: LEDGER_KINDS.OUTBOX,
    householdId: shop.household_id,
    name: BOARD_KIND,
    key: outboxKeyFor(shop.shop_ref, 'board'),
  });
}

/**
 * PURE. The board's whole content, derived from the shop's question rows.
 *
 * ── THE ORDINAL IS THE ROW ORDER, INCLUDING ANSWERED ONES ───────────────────
 * store.listQuestions returns `ORDER BY q.id ASC`, which is immutable, so a
 * question's number is fixed for the life of the shop. Numbering only the
 * OUTSTANDING ones would have been prettier and is a live wrong-answer hazard:
 * he reads a board, types "2", and by the time it lands "2" is a different
 * question because he answered one in between. See renderQuestionBoard.
 *
 * ── THE FINGERPRINT IS WHAT "SOMETHING CHANGED" MEANS ───────────────────────
 * It covers the question set, each status and each accepted answer - i.e. every
 * fact the board displays. Two passes with the same fingerprint render the same
 * bytes, so the board is neither re-sent nor rewritten. That is what stops this
 * becoming an eight-card storm with extra steps.
 */
export function boardStateOf(questionRows, park = null) {
  const rows = Array.isArray(questionRows) ? questionRows : [];
  const outstanding = [];
  const answered = [];
  const byOrdinal = new Map();

  // -- A SUPERSEDED CARD LEAVES THE BOARD (WO-2026-08-18-07 AC3) ------------
  //
  // A question a LATER ROUND has replaced is history, and showing it beside its
  // own successor would leave the condemned board - the cat food, the ham, the
  // quarter pounders - sitting on Warwick's phone next to the card that
  // replaced it. Removing the row from the DATABASE is not the answer: it is
  // the record of what he was actually asked, and `parent_question_id` is what
  // makes the supersession legible without editing history.
  //
  // `byOrdinal` still carries EVERY row, and `n` is still each row's own index
  // over the full list, so a tap from a card sent before the supersession
  // resolves to the same question it always did - it is refused by the render
  // contract as a stale card, which is the correct refusal, rather than
  // silently resolving to a different line because the numbering moved.
  const replaced = supersededQuestionIds(rows);

  rows.forEach((q, i) => {
    const n = i + 1;
    // `item_name` is the thing itself; `question_text` is a whole sentence
    // ("Which product is \"dreamies cheese\"?") and reads terribly in a list.
    // Neither is fabricated - an absent name travels as null and renders
    // "unknown".
    const item = q.item_name || q.question_text || null;
    byOrdinal.set(n, { questionKey: q.question_key, status: q.status });
    if (replaced.has(String(q.id))) return;
    if (q.status === 'open') {
      const { candidates, unidentified } = normaliseStoredCandidates(q.candidates);
      outstanding.push({
        n,
        item,
        questionKey: q.question_key,
        candidates: [...candidates.map((c) => c.label), ...unidentified],
      });
    } else {
      answered.push({ n, item, questionKey: q.question_key, answer: q.answer_text || null });
    }
  });

  const { blocked, blockedReason } = blockedFrom(outstanding.length, park);

  return {
    total: rows.length,
    outstanding,
    answered,
    byOrdinal,
    blocked,
    blockedReason,
    // WP-B15-15: THE PARK IS PART OF WHAT THE BOARD SAYS, SO IT IS PART OF WHAT
    // "SOMETHING CHANGED" MEANS. Without this a shop that BECOMES parked keeps
    // the board it had before - the question rows have not moved, so the
    // fingerprint would not either, and the corrected board would be computed
    // and then silently discarded as `unchanged`. The fix would exist and never
    // reach his phone.
    fingerprint: rows
      .map((q) => `${q.question_key}~${q.status}~${q.answer_text || ''}`)
      .concat(`park~${String(blocked)}~${(park && park.step) || ''}`)
      .join('|'),
  };
}

/** The board payload as it is stored on the outbox row and handed to the
 *  renderer. `byOrdinal` is deliberately NOT carried: it is a lookup for the
 *  inbound side, not something the card displays. */
function boardPayload(shop, state, delivery) {
  return {
    shopRef: shop.shop_ref,
    total: state.total,
    outstanding: state.outstanding.map((q) => ({ n: q.n, item: q.item, candidates: q.candidates })),
    answered: state.answered.map((q) => ({ n: q.n, item: q.item, answer: q.answer })),
    // Tri-state since WP-B15-15: true | false | null. The renderer already
    // distinguishes all three, and `null` is never dressed up as either of the
    // other two. The REASON is carried rather than re-derived here, so the
    // board's verdict and its explanation cannot disagree.
    blocked: state.blocked,
    blockedReason: state.blockedReason,
    // WHAT THIS BOARD IS REPLACING. Carried ON THE ROW so drainOutbox needs no
    // second read, and so "why did this go out as an edit" is answered by
    // reading the row rather than by re-deriving anything.
    boardFingerprint: state.fingerprint,
    editChatId: delivery ? delivery.chatId : null,
    editMessageId: delivery ? delivery.messageId : null,
  };
}

/**
 * Queue or REWRITE the board for one shop. (WP-B15-09)
 *
 * Returns `{queued, reason}`; `queued:false` with reason `unchanged` is the
 * ordinary quiet case and is not a failure.
 */
/**
 * The park evidence for one shop, read from durable state. (WP-B15-15)
 *
 * Two extra reads, and only in the window where a park can exist - a shop with
 * an open question, or at any status other than PROCESSING, costs nothing.
 */
async function parkEvidenceFor(deps, shop, questionRows) {
  const openQuestions = questionRows.filter((q) => q.status === 'open').length;
  const outside = parkStateOf({ status: shop.status, openQuestions });
  if (outside === null) return null;

  const [issued, linesUnresolvedAnnounced] = await Promise.all([
    store.listIssuedCommandNames(deps, shop.id),
    store.outboxEverQueued(deps, shop.id, 'lines_unresolved'),
  ]);
  return parkStateOf({
    status: shop.status,
    openQuestions,
    needsReview: shop.needs_review === true,
    // stages.everIssued is the SAME latch predicate stepPlan uses to decide the
    // interpretation gate, called here rather than re-written, so the board and
    // the gate cannot disagree about whether he has confirmed the reading.
    interpretationConfirmed: everIssued({ issuedCommands: issued }, COMMANDS.CONFIRM_INTERPRETATION),
    linesUnresolvedAnnounced,
  });
}

async function queueBoard(deps, shop, { force = false, log = () => {} } = {}) {
  const rows = await store.listQuestions(deps, shop.id);
  const park = await parkEvidenceFor(deps, shop, rows);

  // ── SILENCE IS NOT AN ACCEPTABLE ANSWER EITHER (WP-B15-15 AC2) ────────────
  // A shop with no question rows used to get no board at all - leaving Warwick
  // with NOTHING in exactly the state he most needs telling. A shop with an
  // EVIDENCED park now gets one regardless.
  //
  // The unknown state deliberately does NOT queue a board of its own: an
  // "I cannot tell" card for every question-less PROCESSING shop is the storm
  // WP-B15-09 removed, and it would say nothing actionable.
  if (rows.length === 0 && !(park && park.parked === true)) {
    return { queued: false, reason: 'no questions' };
  }

  const state = boardStateOf(rows, park);
  const family = boardFamily(shop);
  const spent = await store.spentLedgerGenerations(deps, family);
  // The generation that has already been through the outbox, if any. It carries
  // both facts this decision needs: what the board last SAID, and where it
  // landed. One read, no new table, no migration.
  const previous = spent > 0 ? await store.findLedgerGeneration(deps, family, spent - 1) : null;
  const previousArgs = (previous && previous.args) || {};
  const unchanged = Boolean(previous) && previousArgs.boardFingerprint === state.fingerprint;

  if (unchanged && !force) return { queued: false, reason: 'unchanged' };

  // ── A REFRESH HE ASKED FOR MUST BE VISIBLE (WP-B15-09 AC5) ────────────────
  // Rewriting a message in place with identical bytes is invisible to him, and
  // Telegram rejects it outright as "message is not modified". So an explicit
  // refresh whose content has not moved is SENT FRESH, landing where he is
  // actually looking; the new message then becomes the one that gets rewritten.
  // A refresh whose content HAS moved edits in place as usual - he is looking at
  // the board he just tapped, and it changes under him.
  const delivery = (unchanged && force) ? null
    : (previous && previous.result && previous.result.delivery ? previous.result.delivery : null);

  const queued = await store.enqueueMessage(deps, {
    householdId: shop.household_id,
    shopId: shop.id,
    kind: BOARD_KIND,
    key: outboxKeyFor(shop.shop_ref, 'board'),
    payload: boardPayload(shop, state, delivery),
  });
  // ADOPTED means a board queued by an earlier pass has not gone out yet. It
  // will render from ITS payload, which is now stale - so the fresher state is
  // reported, and the next pass after that send picks the change up again.
  if (!queued || !queued.created) return { queued: false, reason: 'already pending' };
  log('board_queued', {
    shop_ref: shop.shop_ref,
    outstanding: state.outstanding.length,
    answered: state.answered.length,
    rewrites: delivery ? 'in place' : 'first send',
  });
  return { queued: true, reason: delivery ? 'edit' : 'send' };
}

export async function queueShopCards(deps, {
  shops, contract = BASKET_HANDBACK_CONTRACT, verificationFor = null,
  // ── THE BOARD IS THE DEFAULT, AND THE STORM IS OFF (WP-B15-09) ────────────
  // Eight questions used to mean eight cards. A board PLUS eight cards is still
  // eight cards, so per-question cards do not fire unless a caller deliberately
  // asks for them. Nothing in realWiring does, and a test pins that.
  //
  // The path is kept rather than deleted for one honest reason: it is the only
  // thing that seals a question's RENDER CONTRACT (card_message_id plus the
  // exact displayed candidate list), which is what makes a candidate-index tap
  // resolvable and a stale tap detectable. Shops carded before this change still
  // have live buttons that depend on it.
  perQuestionCards = false,
  log = () => {},
} = {}) {
  const questions = [];
  const basketReady = [];
  const boards = [];
  const list = Array.isArray(shops) ? shops : await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);

  for (const shop of list) {
    // ── THE BOARD. One card, rewritten in place, for every shop with questions.
    try {
      const board = await queueBoard(deps, shop, { log });
      if (board.queued) boards.push({ shop_ref: shop.shop_ref, reason: board.reason });
    } catch (err) {
      // One shop's board must not stop another shop's - same posture as below.
      log('board_queue_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }

    // ── open questions -> question cards (OFF by default: see perQuestionCards)
    try {
      for (const q of perQuestionCards ? await store.listQuestions(deps, shop.id) : []) {
        if (q.status !== 'open') continue;
        // Already on his phone. Asked once, never twice.
        if (q.card_message_id !== null && q.card_message_id !== undefined && String(q.card_message_id) !== '') continue;

        // The planner stores candidates in ITS shape. Only the ones carrying a
        // trustworthy id may become buttons; the rest are shown as text he can
        // reply to, because an index resolving to a label is the ambiguity the
        // render contract exists to remove.
        const { candidates, unidentified } = normaliseStoredCandidates(q.candidates);
        // WP-B15-08 AC4. "Also suggested" reads as an addendum to a list of
        // buttons. When NONE of the candidates carried a product id there are no
        // buttons, the Note is the whole offer, and the card must say so in
        // words that match what it is showing.
        const note = unidentified.length > 0
          ? `${candidates.length > 0 ? 'Also suggested' : 'Suggested'} (no product id - reply with the one you want): ${unidentified.join('; ')}`
          : null;

        const queued = await store.enqueueMessage(deps, {
          householdId: shop.household_id,
          shopId: shop.id,
          kind: 'question',
          key: outboxKeyFor(shop.shop_ref, `question.${q.question_key}`),
          payload: {
            shopRef: shop.shop_ref,
            questionKey: q.question_key,
            item: q.question_text || null,
            note,
            candidates,
          },
        });
        // ADOPTED, not created, means the card from an earlier pass is still
        // waiting to go out. Reporting that as a fresh queue would make a
        // stalled outbox look like repeated activity.
        if (queued && queued.created) {
          questions.push({ shop_ref: shop.shop_ref, question_key: q.question_key, candidates: candidates.length });
        }
      }
    } catch (err) {
      // One shop's questions must not stop another shop's.
      log('question_card_queue_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }

    // ── the basket handback. `renderBasketReady` existed with no producer, so a
    //    built basket told Warwick nothing at all.
    try {
      if (shop.status === 'BASKET_READY' && !(await handbackAlreadySpent(deps, shop, contract))) {
        // Which EARLIER contracts this shop was already handed back at. Read from
        // the ledger, never assumed - a shop that only ever saw contract 3 must
        // not be recorded as superseding 1 and 2 it never received.
        const supersedes = [];
        for (let earlier = 1; earlier < contract; earlier += 1) {
          if (await handbackAlreadySpent(deps, shop, earlier)) supersedes.push(earlier);
        }

        // THE VERIFICATION IS THE SUBJECT OF THIS CARD. It is fetched, never
        // computed here: runtime holds no execution packet and no basket capture,
        // and a card that reported contents without reporting whether they
        // reconcile would be the same lie in a friendlier font.
        //
        // A provider that is absent, returns nothing, or THROWS all land in the
        // same place: `verification: null`, which renderBasketReady renders as a
        // loud NOT VERIFIED with no counts and no zeros. Failing towards the
        // alarming card is the only safe direction.
        let verification = null;
        let notVerifiedReason = 'no basket verification is wired into this runtime yet';
        if (typeof verificationFor === 'function') {
          try {
            const report = await verificationFor(shop);
            if (report && Array.isArray(report.lines)) {
              verification = basketHandbackPayload(report);
              notVerifiedReason = null;
            } else {
              notVerifiedReason = 'no basket capture has been recorded for this shop';
            }
          } catch (err) {
            // A verification that could not run is NOT a verification that passed.
            notVerifiedReason = 'the basket verification could not be run';
            log('basket_verification_failed', {
              shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
            });
          }
        }

        const queued = await store.enqueueMessage(deps, {
          householdId: shop.household_id,
          shopId: shop.id,
          kind: 'basket_ready',
          key: outboxKeyFor(shop.shop_ref, `basket_ready.c${contract}`),
          payload: {
            shopRef: shop.shop_ref,
            // On the ROW, so the ledger answers "why two handbacks" by itself.
            // renderBasketReady reads neither, so neither reaches the card.
            handbackContract: contract,
            supersedes,
            verification,
            notVerifiedReason,
          },
        });
        if (queued && queued.created) {
          basketReady.push({ shop_ref: shop.shop_ref, contract, supersedes });
        }
      }
    } catch (err) {
      log('basket_ready_queue_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }
  }

  return { questions, basketReady, boards };
}

/**
 * PURE. Apply the deployment's cockpit base URL to a card's checklist path, at
 * SEND time.
 *
 * ── WHY THE HOST IS APPLIED HERE AND NOWHERE EARLIER ────────────────────────
 * runPipeline.js writes `/api/asdair/checklist?shop=<ref>` onto the DURABLE
 * outbox payload and must never write a host: a host stored in the database is
 * wrong the day the machine, the port or the tailnet name changes, and every
 * card queued before that day would still be carrying it. The path is the
 * durable fact; the host is deployment configuration, and this is the last
 * moment before the bytes leave for Telegram.
 *
 * ── WHY IT MATTERS THAT IT IS ABSOLUTE ──────────────────────────────────────
 * Telegram linkifies an absolute https URL and does not linkify a bare path. A
 * path on the card is a string Warwick has to reassemble against a host he is
 * expected to remember, standing in a shop. That is the same class of failure
 * as the unreachable route itself: technically present, practically absent.
 *
 * ── ABSENT CONFIG IS THE HONEST DEGRADED STATE, NOT A GUESS ─────────────────
 * With no base URL configured the payload is returned UNCHANGED and the card
 * shows the path exactly as before. Nothing is invented, nothing is defaulted
 * to a plausible-looking host, and an absent checklist path still renders
 * nothing rather than a dead link.
 *
 * @param {object} payload   the durable outbox payload - never mutated
 * @param {string|null} baseUrl  e.g. https://host:8443 - trailing slash tolerated
 */
export function withChecklistUrl(payload, baseUrl) {
  const base = typeof baseUrl === 'string' ? baseUrl.trim().replace(/\/+$/, '') : '';
  const p = payload && typeof payload === 'object' ? payload : null;
  if (!base || !p) return payload;
  const rel = typeof p.checklistPath === 'string' ? p.checklistPath.trim() : '';
  // Only a relative path is prefixed. A payload that already carries an absolute
  // URL is left alone rather than having a second origin glued onto the front.
  if (rel === '' || !rel.startsWith('/')) return payload;
  return { ...p, checklistPath: base + rel };
}

/**
 * PHASE 3 - drain the outbox.
 *
 * A message is rendered from its durable payload, sent, and only THEN resolved.
 * A crash between the send and the resolve re-sends one card next pass; a crash
 * the other way round would lose it silently, and a lost failure card is a shop
 * that stalls without telling anyone. Duplicated beats missing, and the outbox
 * key means it cannot duplicate more than once.
 */
/** PURE. The message a board payload says it is replacing, or null. Both halves
 *  are required: half a target is not a target. */
function deliveryTargetOf(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  if (p.editChatId === null || p.editChatId === undefined || p.editChatId === '') return null;
  if (p.editMessageId === null || p.editMessageId === undefined || p.editMessageId === '') return null;
  return { chatId: String(p.editChatId), messageId: String(p.editMessageId) };
}

/** PURE. Where a send actually landed, from Telegram's own returned Message.
 *  A sender that returns nothing useful yields null - recorded as "unknown",
 *  never as a fabricated id. */
function receiptTargetOf(chatId, receipt) {
  const id = receipt && typeof receipt === 'object' ? receipt.message_id : null;
  if (id === null || id === undefined) return null;
  const chat = receipt && receipt.chat && receipt.chat.id !== undefined ? receipt.chat.id : chatId;
  return { chatId: String(chat), messageId: String(id) };
}

export async function drainOutbox(deps, { bot, log = () => {} } = {}) {
  const queued = await store.listOutbox(deps);
  const sent = [];
  const failed = [];
  if (!bot || !bot.send) return { sent, failed, queued: queued.length };

  for (const item of queued) {
    try {
      const render = bot.messages[item.kind];
      if (!render) {
        await store.resolveCommand(deps, item.id, 'abandoned', `no renderer for message kind "${item.kind}"`);
        continue;
      }
      const shop = await store.findShopById(deps, item.shop_id);
      const chatId = (shop && shop.telegram_chat_id) || bot.chatId;
      if (!chatId) {
        await store.resolveCommand(deps, item.id, 'abandoned', 'no chat to send to');
        continue;
      }

      // ── A QUESTION CARD IS NOT SENT THROUGH THE GENERIC PATH ──────────────
      // `bot.messages.question` is renderQuestionCard, which would render a
      // perfectly good card and send it - with NO render contract recorded. Every
      // button on it would then refuse forever, because an index is meaningless
      // without the stored list it indexes into. sendQuestionCard is the only
      // thing that sends AND seals, in that order, so a question goes through it
      // or it does not go at all.
      if (item.kind === 'question') {
        if (typeof bot.sendQuestionCard !== 'function') {
          // NOT abandoned. A runtime wired without a question sender must not
          // throw a question away; leaving it queued is what lets a later pass -
          // on a runner that IS wired - ask it.
          failed.push({ kind: item.kind, key: item.key, detail: 'no question sender is wired into this runtime' });
          log('send_failed', { kind: item.kind, detail: 'no question sender is wired into this runtime' });
          continue;
        }
        await bot.sendQuestionCard({ ...item.payload, chatId });
        await store.resolveCommand(deps, item.id, 'done', 'sent');
        sent.push({ kind: item.kind, key: item.key });
        continue;
      }

      // The cockpit base URL is applied HERE, at the last moment before sending,
      // so the durable payload never carries a host. See withChecklistUrl.
      const message = render(withChecklistUrl(item.payload, bot.checklistBaseUrl));

      // ── THE BOARD IS REWRITTEN, NOT RE-SENT (WP-B15-09) ───────────────────
      // Warwick's complaint was having to reconstruct state by scrolling. A
      // fresh board each time he answers is a better eight-cards, not a fix, so
      // the board edits the message it already occupies.
      //
      // FALLING BACK IS SAFE IN ONE DIRECTION ONLY. An edit that fails because
      // he deleted the message, or because the chat moved, must become a send -
      // otherwise the board disappears silently, which is the whole class of
      // defect this Work Package exists to close. But "message is not modified"
      // is Telegram saying the bytes are ALREADY what we want, so falling back
      // there would post a duplicate board for no reason: it is a success.
      const target = item.kind === BOARD_KIND ? deliveryTargetOf(item.payload) : null;
      let delivered = null;
      if (target && typeof bot.editMessage === 'function') {
        try {
          await bot.editMessage(target.chatId, target.messageId, message);
          delivered = target;
        } catch (err) {
          const detail = String(err && err.message ? err.message : err);
          if (/not modified/i.test(detail)) {
            delivered = target;
          } else {
            log('board_edit_failed', { key: item.key, detail });
          }
        }
      }
      if (!delivered) {
        const receipt = await bot.send(chatId, message);
        delivered = receiptTargetOf(chatId, receipt);
      }
      // WHERE IT LANDED, ON THE ROW. This is what the next pass reads to rewrite
      // this exact message. An unknown message id is recorded as absent, never
      // guessed - the next board then sends fresh, which is visible and safe.
      await store.resolveCommand(deps, item.id, 'done', 'sent',
        delivered ? { delivery: delivered } : null);
      sent.push({ kind: item.kind, key: item.key });
    } catch (err) {
      const detail = String(err && err.message ? err.message : err);
      failed.push({ kind: item.kind, key: item.key, detail });
      log('send_failed', { kind: item.kind, detail });
    }
  }
  return { sent, failed, queued: queued.length };
}

/**
 * ONE PASS. Deterministic, bounded, and safe to interrupt at any point.
 *
 * @param {object} deps    the wired dependency container (see deps.js)
 * @param {{intake?:object, bot?:object, householdId?:*, log?:Function}} wiring
 */
export async function runOnce(deps, wiring = {}) {
  const log = wiring.log || (() => {});
  const startedFrom = 'durable state';

  const capturing = wiring.intake && wiring.intake.telegram
    ? createCapturingTelegram(wiring.intake.telegram)
    : null;
  const intake = capturing ? { ...wiring.intake, telegram: capturing } : wiring.intake;

  // ── ROUTE FIRST, INTAKE SECOND (WP-B15-A1) ────────────────────────────────
  //
  // Not by call order - by CLAIM order, and the difference is the whole design.
  // There is exactly one poller: the fetch happens inside pollIntake via
  // createCapturingTelegram, so calling routeTaps first would hand it an empty
  // list, and a second poll is forbidden because the offset ACK is destructive
  // and would race the receiver for the week's shopping list.
  //
  // So the open questions are read BEFORE the fetch, and the claim decision is
  // taken inside runIntake, before that message is treated as a list and before
  // its offset advances. Routing genuinely goes first; only the function call
  // order looks otherwise.
  const board = await loadBoardQuestions(deps, { householdId: wiring.householdId, log });
  const openQuestions = board.open;
  // WO-2026-08-18-04. The settled rows a correction can name. Loaded in the same
  // pass as the open ones so both carry the identical board ordinal.
  const settledQuestions = board.settled;
  // ── THE DEFERRED WINDOW (WO-2026-08-10-B15-04 AC2) ────────────────────────
  // Read ONLY when nothing is open, so the ordinary claim path is untouched in
  // every other state.
  const deferred = openQuestions.length === 0
    ? await loadDeferredClarifications(deps, { householdId: wiring.householdId, log })
    : [];
  // ── THE BOARD WINDOW (WP-B15-09 AC8). Read only when nothing is open, so the
  // ordinary claim path is untouched in every other state - same shape and same
  // reason as the deferred window above.
  // Read EVERY pass, because a reply to a board is possible whether or not
  // anything is still open: with questions open it is an ANSWER, and with none
  // open it is the AC8 notice. Knowing the exact (chat, message) of each board
  // is what lets such a reply be correlated on evidence rather than on a guess.
  const boardTargets = await loadBoardTargets(deps, { householdId: wiring.householdId, log });
  const boarded = openQuestions.length === 0 ? boardTargets : [];
  const claimedUpdateIds = new Set();
  const answers = [];
  const refusals = [];

  // Resolved BEFORE the claim is built, because the claim now needs it: a reply
  // is correlated through the card it replies to, and that lookup is the
  // question store's. It was previously resolved after pollIntake, which is
  // exactly why the reply branch had nothing to correlate with and gave up.
  const questions = wiring.questions || (wiring.bot && wiring.bot.questions) || null;

  // NO OPEN QUESTION AND NOTHING DEFERRED, NO CLAIM. Warwick's guard, and the
  // reason a genuine new shopping list is never lost: with nothing to correlate
  // to, routing does not get a vote and intake behaves exactly as it always has.
  const claim = ((openQuestions.length === 0 && deferred.length === 0 && boarded.length === 0)
    || !wiring.bot || typeof wiring.bot.routeAsdairUpdate !== 'function')
    ? null
    : async (verdict, update) => {
      // A photo is ALWAYS a list. Only text can be an answer.
      if (!verdict || verdict.kind !== 'text') return false;
      const msg = update && update.message;
      if (!msg) return false;

      // ── HE REPLIED TO A CARD (WP-B15-08 AC1) ────────────────────────────
      //
      // THE LIVE DEFECT OF 2026-08-10, and the whole reason this branch exists.
      // This used to read `if (msg.reply_to_message) return false;` - declining
      // the claim on the grounds that "routeTaps handles it". routeTaps DOES
      // handle it, and it runs LATER IN THE SAME PASS, by which time intake has
      // already treated the same message as a shopping list and minted a shop.
      // Warwick answered eight question cards and got four junk shopping lists
      // (SHOP-2026-08-10-M76, M77, M79, M82) for his trouble. His answers landed
      // AND his answers became lists: a DOUBLE effect, never a lost answer.
      //
      // ── WHY THIS RECORDS THE ANSWER RATHER THAN JUST CLAIMING ───────────
      // routeTaps SKIPS every update in `claimedUpdateIds`. So claiming a reply
      // here and leaving the answering to routeTaps would convert a visible
      // double effect into a SILENT DROP - his words recorded nowhere, no card,
      // no shop, nothing to notice. That is strictly worse than the defect. The
      // claim is therefore taken ONLY after the answer is durably written, which
      // is the same rule the bare-text branch below already follows.
      // ── WHICH CARD DID HE REPLY TO? ─────────────────────────────────────
      // A QUESTION card resolves to exactly one question and takes the branch
      // below. THE BOARD resolves to nothing here - it is one card carrying
      // every question - and must NOT be handed to intake on that basis, which
      // is what used to happen. It falls through to the shared correlation path,
      // where the board's own numbers settle it deterministically.
      let cardRow = null;
      let repliedToBoard = null;
      if (msg.reply_to_message) {
        const replyTo = replyTargetOf(update);
        if (questions && typeof questions.getQuestionByCard === 'function' && replyTo) {
          try {
            cardRow = await questions.getQuestionByCard(replyTo);
          } catch (err) {
            // A lookup that cannot run must not become a WRONG correlation, and
            // must not eat the message either.
            log('question_lookup_failed', { detail: String(err && err.message ? err.message : err) });
            return false;
          }
        }
        repliedToBoard = cardRow ? null : boardAt(boardTargets, replyTo);
        // ── NOT A CARD OF OURS => STILL A LIST, EXACTLY AS BEFORE ──────────
        //
        // This is the line the existing suite protects, and it caught a real
        // hazard in an earlier draft of this change. Correlating ANY unmatched
        // reply through the free-text path lets `correlateTypedAnswer`'s
        // "only one open question, so nothing to choose between" shortcut fire
        // on a message that was never an answer - and "3 gourmet cat food",
        // replied to some unrelated message, gets recorded as the answer to the
        // one open question and never becomes the shop it was.
        //
        // That shortcut is sound for a BARE typed message, where an outstanding
        // card makes answering the likely intent. It is not sound here, because
        // the reply target is positive evidence about what he was answering. So
        // the fall-through is allowed for a reply to a BOARD and for nothing
        // else, matched exactly on (chat, message).
        if (!cardRow && !repliedToBoard) {
          log('typed_reply_not_claimed', { updateId: verdict.updateId, reason: 'uncorrelated_reply' });
          return false;
        }
      }

      if (cardRow) {
        const row = cardRow;
        const replyIntent = wiring.bot.routeAsdairUpdate(update, {
          resolveQuestionByMessage: questionLookupFrom([row]),
        });
        if (!replyIntent.ok) {
          log('typed_reply_route_refused', { updateId: verdict.updateId, reason: replyIntent.reason });
          return false;
        }
        const replyMapped = intentToCommand(replyIntent, { parseAnswerArg: wiring.bot.parseAnswerArg });
        if (!replyMapped.ok) {
          log('typed_reply_unmapped', { updateId: verdict.updateId, reason: replyMapped.reason });
          return false;
        }

        let replyReceipt;
        try {
          replyReceipt = await commands.dispatch(replyMapped.command, replyMapped.spec, deps);
        } catch (err) {
          const detail = String(err && err.message ? err.message : err);
          answers.push({ question_key: replyMapped.spec.questionKey, shop_ref: replyMapped.spec.shopRef, error: detail });
          log('typed_reply_failed', { updateId: verdict.updateId, question_key: replyMapped.spec.questionKey, detail });
          return false;
        }

        // THE SAME DUPLICATE DISCIPLINE AS THE BARE-TEXT BRANCH (B15-04).
        // answerQuestion is a compare-and-set on status='open': a row already
        // settled refuses the write and returns `duplicate: true`, and THESE
        // words were stored nowhere. A redelivery of the same message must
        // still be claimed (or it becomes a shopping list); a different reply
        // to a settled card must not be, or it vanishes.
        const duplicate = replyReceipt.duplicate === true;
        let recorded = !duplicate;
        if (duplicate) {
          recorded = await recordedAnswerMatches(deps, {
            open: openQuestions,
            questionKey: replyMapped.spec.questionKey,
            // The command we just dispatched RESOLVED a shop and told us which
            // one (replyReceipt.shop_id) - that is stronger evidence than
            // `open`, which may no longer carry this question at all if it was
            // settled on an earlier pass (WP-B15-22, F1). Falls back to the
            // shopRef-scoped `open` lookup only if the receipt carries none.
            shopId: replyReceipt.shop_id,
            shopRef: replyMapped.spec.shopRef,
            words: replyMapped.spec.answerText,
            log,
          });
        }
        if (!recorded) {
          answers.push({
            question_key: replyMapped.spec.questionKey,
            shop_ref: replyMapped.spec.shopRef,
            error: 'not recorded - the question was already answered with different words',
          });
          log('typed_reply_not_recorded', { updateId: verdict.updateId, question_key: replyMapped.spec.questionKey });
          return false;
        }

        answers.push({ question_key: replyMapped.spec.questionKey, shop_ref: replyMapped.spec.shopRef, duplicate });
        claimedUpdateIds.add(verdict.updateId);
        log('typed_reply_claimed', { updateId: verdict.updateId, question_key: replyMapped.spec.questionKey });
        return true;
      }

      // ── HE TYPED INTO THE DEFERRED WINDOW ───────────────────────────────
      //
      // A clarification is OWED and he has been TOLD about it, but no question
      // row is open to receive an answer: the round-2 question is deliberately
      // withheld until the reading is confirmed. He read that card and typed.
      //
      // Three things must all hold, and only the first is obvious:
      //   * his words are NOT started as a new shopping list (the live defect,
      //     SHOP-2026-08-10);
      //   * his words are NOT written as an answer either - answerQuestion is a
      //     compare-and-set on status='open', so the already-answered row
      //     refuses the write and returns `duplicate: true`. Claiming on that
      //     receipt records his words NOWHERE. Measured, not assumed;
      //   * HE IS TOLD. A claim that returns true without telling him is a
      //     SILENT DROP, which is strictly worse than the spurious shop because
      //     he cannot see it and therefore cannot correct it.
      //
      // So the claim is taken only once the notice is durably queued. If the
      // enqueue fails we return false and fall back to the old behaviour: a
      // wrong shop he can see beats a message that vanished.
      // ── HE REPLIED TO THE BOARD WITH NOTHING LEFT OPEN (AC8) ────────────
      //
      // Every question is settled and a board is still sitting on his phone
      // inviting a reply. His words answer nothing, and they are not a list
      // either - so the only honest outcome is to start no shop, record no
      // answer, and TELL HIM. The claim is taken ONLY once the notice is
      // durably queued: a claim with no notice is the silent drop, which is
      // strictly worse than the spurious shop because he cannot see it.
      //
      // THE CONDITION IS DELIBERATELY NARROW. It fires only on a genuine reply
      // to one of OUR OWN messages. A plain typed message with nothing open is
      // still a shopping list, exactly as Warwick's standing guard requires -
      // this widens nothing for the case that guard protects.
      // ── AND THE CONDITION IS PER-BOARD, NOT PER-ESTATE (WP-B15-18) ──────
      //
      // This used to ask whether the ESTATE had nothing open. With two shops
      // active that is a different question from the one that matters, and the
      // gap between them was the quietest failure in this file: his board fully
      // settled, another shop holding one open question, so this notice did not
      // fire, correlation ran instead, and "there is only one open question"
      // wrote his words onto a shop he was not looking at. No number in the
      // message, no error, nothing to notice.
      //
      // Asked of HIS board it is the honest question: is there anything open on
      // the shop whose card he replied to? With exactly one active shop the two
      // conditions are identical, so the single-shop journey is untouched.
      const openOnRepliedBoard = repliedToBoard
        ? openQuestions.filter((q) => String(q.shopId) === String(repliedToBoard.shopId))
        : openQuestions;
      // -- AND A CORRECTION IS NOT A REPLY THAT WAS NOT TAKEN (WO-2026-08-18-04)
      //
      // This branch fires on precisely the state a correction lives in: every
      // question settled, a board still on his phone, and him replying to it.
      // Left alone it would CLAIM the message and answer "I could not take that"
      // before correlation ever ran - so the capability would be unreachable in
      // the one situation it was built for, and the failure would look like a
      // polite refusal rather than a bug.
      //
      // The test is narrow and it is HIS OWN KEYWORD against HIS OWN BOARD: a
      // numbered line marked `correction` whose ordinal names a settled question
      // on the shop whose card he replied to. Anything else still lands here.
      const correctionsOnRepliedBoard = repliedToBoard
        ? parseBoardReply(verdict.text)
          .filter((n) => n.correction === true)
          .filter((n) => settledQuestions.some((q) => String(q.shopId) === String(repliedToBoard.shopId)
            && q.ordinal === n.ordinal)).length
        : 0;
      if (openOnRepliedBoard.length === 0 && deferred.length === 0 && repliedToBoard
          && correctionsOnRepliedBoard === 0) {
        const target = repliedToBoard;
        const noticeKey = outboxKeyFor(target.shopRef, `reply_not_taken.${verdict.updateId}`);
        try {
          // ONE NOTICE PER MESSAGE, EVER - the same family guard as below, for
          // the same reason: a redelivery must not mint a new generation every
          // pass and rebuild the storm.
          const family = ledgerFamilyKey({
            kind: LEDGER_KINDS.OUTBOX,
            householdId: target.householdId,
            name: 'reply_not_taken',
            key: noticeKey,
          });
          if ((await store.spentLedgerGenerations(deps, family)) === 0) {
            await store.enqueueMessage(deps, {
              householdId: target.householdId,
              shopId: target.shopId,
              kind: 'reply_not_taken',
              key: noticeKey,
              payload: { shopRef: target.shopRef, answeredAlready: null },
            });
          }
        } catch (err) {
          // TOLD HIM NOTHING => DO NOT CLAIM. Never a silent drop.
          log('reply_not_taken_notice_failed', {
            updateId: verdict.updateId,
            shop_ref: target.shopRef,
            detail: String(err && err.message ? err.message : err),
          });
          return false;
        }
        refusals.push({ updateId: verdict.updateId, shop_ref: target.shopRef, reason: 'reply_not_taken' });
        claimedUpdateIds.add(verdict.updateId);
        log('typed_reply_not_taken', { updateId: verdict.updateId, shop_ref: target.shopRef });
        return true;
      }

      if (openQuestions.length === 0 && deferred.length > 0) {
        const target = deferred[0];
        const noticeKey = outboxKeyFor(target.shopRef, `clarification_deferred.refused.${verdict.updateId}`);
        try {
          // ONE NOTICE PER MESSAGE, EVER - the AC1 lesson applied directly. The
          // family is keyed on the UPDATE ID and a spent generation of that
          // family is the honest question. Without this, a message redelivered
          // because the offset never advanced would mint a new generation every
          // pass and rebuild the exact storm this Work Order just closed.
          const family = ledgerFamilyKey({
            kind: LEDGER_KINDS.OUTBOX,
            householdId: target.householdId,
            name: 'clarification_deferred',
            key: noticeKey,
          });
          if ((await store.spentLedgerGenerations(deps, family)) === 0) {
            await store.enqueueMessage(deps, {
              householdId: target.householdId,
              shopId: target.shopId,
              kind: 'clarification_deferred',
              key: noticeKey,
              payload: {
                shopRef: target.shopRef,
                items: [],
                reason: 'I am still waiting for you to confirm I read this list correctly, so I had nowhere to put that.',
                messageNotAccepted: true,
              },
            });
          }
        } catch (err) {
          // TOLD HIM NOTHING => DO NOT CLAIM. Never a silent drop.
          log('deferred_window_notice_failed', {
            updateId: verdict.updateId,
            shop_ref: target.shopRef,
            detail: String(err && err.message ? err.message : err),
          });
          return false;
        }
        refusals.push({ updateId: verdict.updateId, shop_ref: target.shopRef, reason: 'clarification_deferred' });
        claimedUpdateIds.add(verdict.updateId);
        log('typed_message_refused_deferred_window', {
          updateId: verdict.updateId, shop_ref: target.shopRef, deferred_shops: deferred.length,
        });
        return true;
      }

      // The board he replied to is the only thing in this message that says
      // which shop he meant, so it travels with the words (WP-B15-18). A bare
      // typed message carries no such evidence and passes null, which keeps
      // correlation running and drops only what two shops both offer.
      const correlation = await correlateTypedAnswer(deps, {
        text: verdict.text,
        open: openQuestions,
        settled: settledQuestions,
        boardShopId: repliedToBoard ? repliedToBoard.shopId : null,
        log,
      });
      if (!correlation) {
        log('typed_message_not_claimed', {
          updateId: verdict.updateId, open_questions: openQuestions.length,
        });
        return false;
      }

      // ── ASKING IS THE FALLBACK, AND IT IS NOT A FAILURE (AC2) ────────────
      //
      // The corroboration gate refused to place at least part of this message.
      // He gets told, through the ordinary surface, with the board numbers he
      // is already looking at - so answering is "5: the ones in favourites",
      // an ordinary typed reply on a path that already exists. NO new command,
      // NO new callback action, nothing added to the allowlist.
      //
      // It does NOT park and it does NOT drop. The North Star permits asking
      // about genuine ambiguity; an answer nothing supports IS genuine
      // ambiguity. What it forbids is guessing, and guessing is what this
      // replaces.
      const unplaced = Array.isArray(correlation.uncorroborated) ? correlation.uncorroborated : [];
      if (unplaced.length > 0) {
        const target = unplaced[0];
        const stillOpen = openQuestions.filter((q) => String(q.shopId) === String(target.shopId));
        const noticeKey = outboxKeyFor(target.shopRef, `answer_not_attributed.${verdict.updateId}`);
        try {
          // ONE QUESTION PER MESSAGE, EVER - the same family guard as the two
          // notices above, for the same reason: a redelivery must never mint a
          // new generation on every pass and rebuild the storm.
          const family = ledgerFamilyKey({
            kind: LEDGER_KINDS.OUTBOX,
            householdId: wiring.householdId,
            name: 'answer_not_attributed',
            key: noticeKey,
          });
          if ((await store.spentLedgerGenerations(deps, family)) === 0) {
            await store.enqueueMessage(deps, {
              householdId: wiring.householdId,
              shopId: target.shopId,
              kind: 'answer_not_attributed',
              key: noticeKey,
              payload: {
                shopRef: target.shopRef,
                words: target.answerText,
                questions: stillOpen.map((q) => ({
                  n: q.ordinal,
                  item: q.itemName || q.questionText || null,
                })),
              },
            });
          }
        } catch (err) {
          // TOLD HIM NOTHING => DO NOT CLAIM. Never a silent drop. Returning
          // false holds the offset and lets Telegram redeliver, which is the
          // recovery this loop already has.
          log('answer_not_attributed_notice_failed', {
            updateId: verdict.updateId,
            shop_ref: target.shopRef,
            detail: String(err && err.message ? err.message : err),
          });
          return false;
        }
        log('typed_answer_not_attributed', {
          updateId: verdict.updateId,
          shop_ref: target.shopRef,
          refused: unplaced.length,
          also_bound: correlation.mappings.length,
        });

        // NOTHING PLACEABLE AT ALL: he has been asked, so the message is
        // CLAIMED. Handing it back to intake would turn his answer into a new
        // shopping list, which is the failure this branch exists to prevent.
        if (correlation.mappings.length === 0) {
          refusals.push({
            updateId: verdict.updateId, shop_ref: target.shopRef, reason: 'answer_not_attributed',
          });
          claimedUpdateIds.add(verdict.updateId);
          return true;
        }
        // Otherwise part of the message DID place. Those mappings are settled
        // below on their own rows, and the question above covers the rest.
      }

      const intent = wiring.bot.routeAsdairUpdate(update, {
        resolveAnswersByText: () => correlation,
      });
      if (!intent.ok) {
        log('typed_answer_route_refused', { updateId: verdict.updateId, reason: intent.reason });
        return false;
      }

      const mapped = intentToCommands(intent, { parseAnswerArg: wiring.bot.parseAnswerArg });
      if (!mapped.ok) {
        log('typed_answer_unmapped', { updateId: verdict.updateId, reason: mapped.reason });
        return false;
      }

      // PER MAPPING, DISPATCHED INDEPENDENTLY. One message answering three
      // questions settles each on its own row: two can land durably while a
      // third fails, and the two that landed are not rolled back by the one
      // that did not.
      let settled = 0;
      for (const c of mapped.commands) {
        try {
          const receipt = await commands.dispatch(c.command, c.spec, deps);
          const duplicate = receipt.duplicate === true;
          // ── A DUPLICATE RECEIPT IS NOT A RECORDED ANSWER (B15-04) ────────
          //
          // answerQuestion is a compare-and-set on status='open'. A row that is
          // already answered REFUSES the write and comes back `duplicate: true`
          // - and the words in THIS message were stored nowhere. Counting that
          // as settled lets the claim return true and swallow a message it
          // never recorded, telling him nothing. That is the silent-loss trap.
          //
          // A genuine redelivery of the SAME message must still be claimed,
          // though, or it becomes a shopping list. So the two are separated by
          // the only evidence that distinguishes them: whether what is on the
          // row is what he just sent.
          let recorded = !duplicate;
          if (duplicate) {
            recorded = await recordedAnswerMatches(deps, {
              open: openQuestions,
              questionKey: c.spec.questionKey,
              // Same reasoning as the cardRow branch above: the receipt just
              // returned by THIS dispatch names the shop it resolved, which
              // survives `open` no longer carrying an already-settled question
              // (WP-B15-22, F1). shopRef is also passed as the `open`-lookup
              // fallback for a receipt that somehow carries no shop_id.
              shopId: receipt.shop_id,
              shopRef: c.spec.shopRef,
              words: c.spec.answerText,
              log,
            });
            if (!recorded) {
              answers.push({
                question_key: c.spec.questionKey,
                shop_ref: c.spec.shopRef,
                error: 'not recorded - the question was already answered with different words',
              });
              log('typed_answer_not_recorded', {
                updateId: verdict.updateId, question_key: c.spec.questionKey,
              });
              continue;   // NOT settled => not claimed on this mapping.
            }
          }
          answers.push({ question_key: c.spec.questionKey, shop_ref: c.spec.shopRef, duplicate });
          settled += 1;
        } catch (err) {
          // Reported, never swallowed.
          const detail = String(err && err.message ? err.message : err);
          answers.push({ question_key: c.spec.questionKey, shop_ref: c.spec.shopRef, error: detail });
          log('typed_answer_failed', { updateId: verdict.updateId, question_key: c.spec.questionKey, detail });
        }
      }

      // NOTHING LANDED MEANS NOTHING IS CLAIMED. Returning false hands the
      // message back to intake, whose own persist path holds the offset and lets
      // Telegram redeliver - which is the recovery this loop already has.
      // Claiming a message we failed to answer would throw the answer away.
      if (settled === 0) return false;

      claimedUpdateIds.add(verdict.updateId);
      log('typed_answer_claimed', {
        updateId: verdict.updateId, settled, model_called: correlation.modelCalled === true,
      });
      return true;
    };

  const intakeReport = await pollIntake(deps, {
    intake, householdId: wiring.householdId, now: wiring.now, claim, log,
  });

  const tapReport = await routeTaps(deps, {
    updates: capturing ? capturing.captured : [],
    bot: wiring.bot,
    questions,
    claimedUpdateIds,
    log,
  });
  const advanced = await advanceAll(deps, { log });

  // ── WO-2026-08-18-B15-RUNTIME, GAP 3. THE PASS SHOPS. ────────────────────
  //
  // `advanceAll` moves a READY_TO_SHOP shop to WAITING_FOR_BROWSER and queues
  // an `asdair.browser_build_request` row. Until now NOTHING IN THE ESTATE
  // EVER CLAIMED ONE - the stage table said it was waiting for "the supervised
  // browser operator", and that operator was a human with a shell.
  //
  // This is that operator. It runs inside the pass that is already running, on
  // the poll that is already polling, under the pid lock that already
  // guarantees a single consumer. No new scheduler, no new queue, no new
  // table: the request row and its lease have existed for weeks.
  //
  // WIRED, NEVER ASSUMED. `wiring.shopBasket` is absent in every test that has
  // no business driving a browser, so the branch is explicit rather than a
  // silent no-op, and `realWiring` is the only thing that supplies it.
  // -- BEFORE THE LANE RUNS, GIVE BACK WHAT THE ENVIRONMENT TOOK (AC4) -----
  // A request terminated for a configuration reason becomes claimable again the
  // moment the configuration exists, and it is claimed on THIS pass rather than
  // the next one. Wrapped in its own try for the same reason `shopBasket` is: a
  // recovery that throws must not cost the pass that was going to do the work.
  if (typeof wiring.recoverBrowserEnvironment === 'function') {
    try {
      await wiring.recoverBrowserEnvironment({ log });
    } catch (err) {
      log('browser_environment_recovery_failed', { detail: String(err && err.message ? err.message : err) });
    }
  }

  let basket = null;
  if (typeof wiring.shopBasket === 'function') {
    try {
      basket = await wiring.shopBasket({ log });
      if (basket) log('browser_build_consumed', { request_id: basket.requestId, shop_ref: basket.shopRef, basket_ready: basket.ready });
    } catch (err) {
      // A failed shop must not kill the pass: the request has already been
      // released back to `queued` by the consumer, so the NEXT pass retries it.
      // That is the recovery path, and it only works if this pass survives.
      log('browser_build_failed', { detail: String(err && err.message ? err.message : err) });
    }
  }

  // AFTER the advance, so a question opened by THIS pass's planning step is
  // carded on this pass rather than waiting a full interval for the next one.
  const cards = await queueShopCards(deps, {
    verificationFor: wiring.verificationFor || null,
    // OFF unless a caller deliberately asks. realWiring never does, and
    // productionWiring pins that - see queueShopCards for why the path survives.
    perQuestionCards: wiring.perQuestionCards === true,
    log,
  });
  const outbox = await drainOutbox(deps, { bot: wiring.bot, log });

  return {
    ok: true,
    started_from: startedFrom,
    intake: {
      fetched: intakeReport.fetched,
      received: intakeReport.received.length,
      ignored: intakeReport.ignored.length,
      failed: intakeReport.failed.length,
      // Claimed as an ANSWER rather than received as a list (WP-B15-A1).
      // Reported separately because "handled" and "refused" are different facts.
      claimed: (intakeReport.claimed || []).length,
    },
    // Typed answers settled from plain messages this pass, with the question each
    // one settled. A pass that answered nothing shows an empty list, not silence.
    answers,
    // Messages REFUSED into the deferred window - not a list, not an answer, and
    // he was told. Reported so a refusal is visible in the pass result rather
    // than only in the journal.
    refusals,
    open_questions_seen: openQuestions.length,
    deferred_clarifications_seen: deferred.length,
    taps: { routed: tapReport.routed.length, refused: tapReport.refused.length, detail: tapReport.refused },
    shops: advanced.map((r) => ({
      shop_ref: r.shop_ref, step: r.step, stepped: r.stepped,
      from: r.from, to: r.to, ok: r.ok !== false, error: r.error || null,
    })),
    stepped: advanced.filter((r) => r.stepped).length,
    // The browser half of the pass. `null` means nothing was claimable, which
    // is the ordinary answer and is reported rather than left to inference.
    basket: basket
      ? { request_id: basket.requestId, shop_ref: basket.shopRef, ready: basket.ready }
      : null,
    cards: {
      questions: cards.questions.length,
      basket_ready: cards.basketReady.length,
      // THE BOARD, reported separately: "a board was rewritten" and "a question
      // was carded" are different facts and a shop should now only ever see the
      // first (WP-B15-09).
      boards: (cards.boards || []).length,
      detail: cards.questions,
    },
    outbox,
  };
}

/**
 * WATCH. runOnce on an interval, until interrupted.
 *
 * Every pass is independent and starts from durable state, so an interval that
 * is missed, a pass that throws, or a machine that reboots costs exactly one
 * pass - never a shop. `stop()` lets a caller (and the test suite) end the loop
 * without a signal.
 */
export function runWatch(deps, wiring = {}, { intervalSeconds = DEFAULT_INTERVAL_SECONDS, maxPasses = Infinity } = {}) {
  let stopped = false;
  let timer = null;
  const log = wiring.log || (() => {});

  const done = (async () => {
    let passes = 0;
    while (!stopped && passes < maxPasses) {
      try {
        const report = await runOnce(deps, wiring);
        log('pass', { pass: passes, stepped: report.stepped, shops: report.shops.length });
      } catch (err) {
        // A pass that blows up must not kill the loop: the next one re-derives
        // everything from Postgres anyway.
        log('pass_failed', { pass: passes, error: String(err && err.message ? err.message : err) });
      }
      passes += 1;
      if (stopped || passes >= maxPasses) break;
      // Deliberately NOT unref'd: a watch loop is the process's reason to be
      // alive, and an unref'd timer lets Node exit between passes.
      await new Promise((resolve) => { timer = setTimeout(resolve, intervalSeconds * 1000); });
    }
    return passes;
  })();

  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    done,
  };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/**
 * THE REAL BASKET VERIFICATION, FOR ONE SHOP.
 *
 * `queueShopCards` has always taken a `verificationFor` provider and always
 * failed towards the alarming card when it was absent. Nothing ever supplied
 * one, so `verification` was permanently null and every basket-ready handback
 * rendered NOT VERIFIED by omission. That is the lie this closes - not a wrong
 * check, an absent one reported as though the question had been asked.
 *
 * Returns a verifyBasket report, or NULL where there is genuinely nothing to
 * verify against. Null is not a failure and must never be dressed up as one:
 * `queueShopCards` renders it as a loud NOT VERIFIED with its own reason, which
 * is the honest state of a shop whose worker has not reported back yet.
 *
 * WHAT IT COMPARES. `expected` is the packet rebuilt from durable state by the
 * same function that produced the handoff - there is no plan table, and
 * recomputation is this system's established way of having one truth rather
 * than two that can drift. `actual` is the completion report the supervised
 * worker recorded on the durable request (progress.report), converted through
 * handoff/completion.js, which is the module that owns that shape.
 */
export function makeVerificationFor(deps, { log = () => {} } = {}) {
  return async function verificationFor(shop) {
    const rows = await peekHandoff(deps.readQuery, { shopId: shop.id });
    const request = Array.isArray(rows) ? rows[0] : rows;      // most recent first
    const progress = (request && request.progress) || null;
    const report = progress && progress.report ? progress.report : null;

    // No request, or a worker that has not reported: NOT a verified basket, and
    // NOT an empty one either. Both are "no capture has been recorded", which is
    // exactly what the card says.
    if (!report) return null;

    const { packet, handoff } = await buildBrowserHandoff(deps, shop);

    // A report recorded against a DIFFERENT packet cannot be verified against
    // this one. Saying so is the whole point: quietly comparing them would
    // report a basket built from one list as reconciling against another.
    const storedFingerprint = (progress.handoff && progress.handoff.packet_fingerprint) || null;
    if (storedFingerprint && storedFingerprint !== handoff.packet_fingerprint) {
      log('basket_verification_packet_changed', {
        shop_ref: shop.shop_ref, stored: storedFingerprint, rebuilt: handoff.packet_fingerprint,
      });
      return null;
    }

    return verifyBasket(toVerifyBasketArgs(packet, handoff, report));
  };
}

/** Build the real Telegram wiring from the environment. Names only - no value
 *  is read from a credentials file by this module. */
/** The outbox kind the browser lane's environment failure travels on. Named
 *  once: the enqueue, the renderer registration in bot/renderMessages.js and
 *  the idempotency family all have to agree, and a literal repeated three times
 *  is a literal that will eventually disagree with itself. */
export const BASKET_BLOCKED_ON_ENVIRONMENT = 'basket_blocked_on_environment';

/**
 * THE BROWSER LANE'S OUTCOME, TOLD DURABLY WHEN IT IS A FAILURE.
 *
 * Extracted from `realWiring` so the production function is the function under
 * test. See the call site for why.
 *
 * -- SUCCESS IS UNCHANGED AND DELIBERATELY WRITES NOTHING ------------------
 * "Mum's basket is ready" is issued by `advanceAll` -> `queueShopCards` ->
 * `drainOutbox` over a truthful reconciliation. A second card from here would
 * be a second truth about one event, which is the defect the browser lane Work
 * Order removed rather than one to add back in a new place.
 *
 * -- ONCE PER SHOP PER DISTINCT FACT, NOT ONCE PER PASS --------------------
 * The family key carries whether AsdAIr is still trying, so one outage
 * produces at most two cards - "it stopped and I am retrying" and "I have
 * stopped trying" - and never a stream. Same `spentLedgerGenerations` guard and
 * the same reason as the clarification notice in runPipeline.js: an outbox KEY
 * alone stopped a duplicate only while the card sat unsent and re-issued the
 * moment it was delivered. Eighteen identical cards in seventeen minutes is the
 * measured cost of getting this wrong.
 *
 * Root CLAUDE.md: *failure must never be silent.* A log line in a journal
 * nobody reads is silence with a timestamp on it.
 */
export async function announceBasketOutcome(deps, payload, { log = () => {} } = {}) {
  const p = payload || {};
  log('basket_outcome', {
    kind: p.kind,
    shop_ref: p.shop_ref,
    request_id: p.request_id,
    blockers: (p.blockers || []).map((b) => b && b.kind),
  });
  if (p.kind !== BASKET_BLOCKED_ON_ENVIRONMENT) return null;
  if (p.shop_id === null || p.shop_id === undefined) return null;

  const phase = p.terminal === true ? 'terminal' : 'retrying';
  const key = outboxKeyFor(p.shop_ref, `${BASKET_BLOCKED_ON_ENVIRONMENT}.${phase}`);
  const family = ledgerFamilyKey({
    kind: LEDGER_KINDS.OUTBOX,
    householdId: p.household_id ?? null,
    name: BASKET_BLOCKED_ON_ENVIRONMENT,
    key,
  });
  if ((await store.spentLedgerGenerations(deps, family)) !== 0) return null;

  return store.enqueueMessage(deps, {
    householdId: p.household_id ?? null,
    shopId: p.shop_id,
    kind: BASKET_BLOCKED_ON_ENVIRONMENT,
    key,
    payload: {
      shopRef: p.shop_ref,
      // Blocker KINDS only. The blocker's `detail` carries a launcher message
      // naming environment variables, and a card is not a config reference -
      // pipeline-runtime/RUNBOOK.md is.
      blockers: (p.blockers || []).map((b) => ({ kind: b && b.kind ? String(b.kind) : null })),
      attempts: p.attempts ?? null,
      maxAttempts: p.max_attempts ?? null,
      terminal: p.terminal === true,
    },
  });
}

/**
 * The shop statuses in which a browser build is STILL the work to do.
 *
 * A positive allow-list, not a deny-list: `requeueEnvironmentFailures` must
 * never resurrect a request for a shop that has been cancelled, reconciled, or
 * whose basket has already been reported - and a deny-list would let a status
 * added later qualify by accident.
 */
const BROWSER_WANTED_SHOP_STATUSES = Object.freeze([
  'READY_TO_SHOP', 'WAITING_FOR_BROWSER', 'SHOPPING',
]);

async function realWiring(deps) {
  const intakeMod = await import('../intake/shopperIntake.js');
  const botRouter = await import('../bot/inboundRouter.js');
  const botMessages = await import('../bot/renderMessages.js');
  const botSender = await import('../bot/sendShopperMessage.js');
  const callback = await import('../bot/callbackProtocol.js');
  const questionRender = await import('../bot/questionRender.js');
  const questionStoreMod = await import('../bot/questionStore.js');

  const config = intakeMod.loadIntakeConfig();
  const { sender, chatId } = botSender.createShopperSenderFromEnv();

  // The durable render contract, over the pipeline's OWN read/write roles - so
  // the SELECT-only role stays SELECT-only and this module still opens no
  // connection of its own.
  const questions = questionStoreMod.createQuestionStoreFromQueries({
    read: (sql, params) => deps.readQuery(sql, params),
    write: (sql, params) => deps.writeQuery(sql, params),
  });

  return {
    questions,
    householdId: Number(process.env.ASDAIR_HOUSEHOLD_ID || 1),

    // THE PROVIDER THAT WAS NEVER THERE. queueShopCards reads
    // `wiring.verificationFor`; until now nothing put one on this object, so
    // the basket-ready card could only ever say NOT VERIFIED.
    verificationFor: makeVerificationFor(deps),

    // ── GAPS 3, 4 AND 5. THE BROWSER, OWNED BY THE RUNTIME. ────────────────
    //
    // GAP 4 - CREDENTIALS. Nothing new is opened, read, printed or copied
    // here. The executor runs INSIDE this process, so it inherits the
    // environment the runtime was started with by its scheduled task - the
    // same `--env-file` pair that already supplies SHOPPER_BOT_TOKEN and the
    // database URLs. Last night's `--env-file` on Larry's shell was not a
    // missing mechanism; it was a missing CALLER. This module knows variable
    // NAMES only, exactly as the rest of this file does.
    //
    // GAP 5 - THE BROWSER. `launcher.cjs` reads ASDAIR_CHROME_PATH,
    // ASDAIR_CHROME_PROFILE_DIR and ASDAIR_CDP_PORT from that same
    // environment and reuses a debuggable Chrome if one is already answering,
    // launching one against the dedicated profile if not. So the browser
    // dependency belongs to AsdAIr and no longer waits for a human to start
    // it. An expired ASDA sign-in is still Warwick's - the runner raises
    // ReauthRequiredError and never attempts to resolve it - but an ORDINARY
    // signed-in session now needs nobody.
    // -- A CONFIGURATION FAILURE IS NOT A PERMANENT FAILURE (AC4) ----------
    //
    // Runs BEFORE `shopBasket` on the same pass, so a request that becomes
    // claimable is claimed immediately rather than a full interval later.
    //
    // THE ENVIRONMENT IS TESTED BY THE PRODUCTION VALIDATOR, not by a second
    // opinion about which variables matter. `launcher.resolveConfig` is the
    // exact function `ensureChrome` calls and the exact function that threw
    // when the values were absent - so "ready" here means "ready by the same
    // rule that refused", and the two cannot drift. It reads variable NAMES
    // only and never prints or returns a value.
    //
    // THE ALLOW-LIST IS POSITIVE. Only a shop that still WANTS a browser build
    // has its request resurrected; a cancelled, reconciled or already-basketed
    // shop is never touched, and a new shop status cannot silently qualify by
    // failing to appear on a deny-list.
    recoverBrowserEnvironment: async ({ log: passLog = () => {} } = {}) => {
      const launcher = await import('../basket-executor/launcher.cjs');
      const lease = await import('../browser-runner/lease.cjs');
      try {
        launcher.default.resolveConfig({}, process.env);
      } catch {
        // Still not configured. Nothing to recover, and nothing to say - the
        // card that says so was queued when the request was released.
        return [];
      }
      const requeued = await lease.default.requeueEnvironmentFailures(
        (sql, params) => deps.writeQuery(sql, params),
        {
          shopStatuses: BROWSER_WANTED_SHOP_STATUSES,
          reason: 'the browser environment is configured again - re-queued for another attempt',
        },
      );
      if (requeued.length > 0) {
        passLog('browser_environment_recovered', {
          requeued: requeued.length,
          request_ids: requeued.map((r) => Number(r.id)),
        });
      }
      return requeued;
    },

    shopBasket: async ({ log: passLog = () => {} } = {}) => {
      const { consumeOneBrowserBuildRequest } = await import('../basket-executor/consume-request.cjs');
      const { runBasket } = await import('../basket-executor/run-basket.cjs');
      const shopLines = await import('./shopLines.js');

      return consumeOneBrowserBuildRequest({
        query: (sql, params) => deps.writeQuery(sql, params),
        loadShop: async (shopId) => {
          const shopRows = await deps.readQuery(
            'select id, shop_ref, household_id, status from asdair.shop where id = $1::bigint', [String(shopId)],
          );
          const shop = shopRows.rows[0];
          if (!shop) throw new Error(`browser build request names shop ${shopId}, which does not exist`);
          const lines = await shopLines.listLines(deps, shop.id);
          return { shop, lines };
        },
        // The household catalogue, from our OWN rows. This is what turns Mum's
        // wording into the canonical ASDA description the identity ladder
        // matches on - and it is why a regular with no stored id is an
        // ordinary line rather than a blocked one.
        loadCatalogue: async () => {
          const res = await deps.readQuery(
            'select id, name, display_name, brand, category, aka, typical_qty, asda_product_id, active '
            + 'from asdair.regulars where household_id = $1 and active is not false',
            [Number(process.env.ASDAIR_HOUSEHOLD_ID || 1)],
          );
          return { rows: res.rows };
        },
        loadRules: async () => {
          const res = await deps.readQuery(
            'select id, rule_text, directive, category, active from asdair.rules where active is true order by id', [],
          );
          return { rows: res.rows };
        },
        runBasket,
        // ── NO SECOND ANNOUNCEMENT PATH, DELIBERATELY ────────────────────────
        //
        // AsdAIr already tells Warwick the basket is ready: `advanceAll` moves
        // SHOPPING -> BASKET_READY once the request is complete and carries a
        // report, and `queueShopCards` queues the basket-ready card that
        // `drainOutbox` sends. Writing a card from here would be a SECOND
        // truth about the same event - which is the defect this Work Order
        // exists to remove, not one to add in a new place.
        //
        // THE GATE STILL BINDS, AND IT BINDS ON THE EXISTING RAILS. The
        // consumer finishes the request `complete` only when the
        // reconciliation is truthful, and `failed` with the blockers in
        // `last_error` when it is not. A failed request does not satisfy the
        // RECORD_BASKET_READY gate, so the shop does not advance and the card
        // is never queued. "Mum's basket is ready" therefore cannot be said
        // over an untruthful reconciliation, and nothing had to be invented to
        // make that so.
        // -- AND THE FAILURE HALF IS NOT SILENT (WO-2026-08-18-07 AC5) -----
        //
        // Everything above stays true FOR THE SUCCESS CASE and is unchanged:
        // "Mum's basket is ready" is still issued once, by `advanceAll` ->
        // `queueShopCards` -> `drainOutbox`, over a truthful reconciliation,
        // and nothing here writes a second truth about it.
        //
        // The FAILURE case had no such route at all. This binding WAS a log
        // line and only a log line, so when four requests died on 2026-08-18
        // for want of three environment variables, no outbox row was written
        // (the newest `pipeline_command` was id 282, hours earlier) and
        // nothing reached anybody.
        //
        // THE BODY IS A NAMED, EXPORTED FUNCTION AND NOT AN INLINE ARROW, on
        // purpose. An inline closure inside `realWiring` is reachable only by
        // standing up the whole runtime, so the only thing a test could have
        // asserted about it is that the SOURCE TEXT mentions an outbox - which
        // is the shape of proof this build already has too much of. Extracted,
        // the production function itself is what the test executes.
        announce: (payload) => announceBasketOutcome(deps, payload, { log: passLog }),
      }, { log: (m) => passLog('basket', { detail: m }) });
    },
    intake: {
      runIntake: intakeMod.runIntake,
      config,
      telegram: intakeMod.createShopperTelegramClient({ botToken: config.botToken, apiBase: config.apiBase }),
      state: intakeMod.createFileStateStore(config.stateFile),
      media: intakeMod.createFileMediaStore(config.mediaDir),
    },
    bot: {
      routeAsdairUpdate: botRouter.routeAsdairUpdate,
      parseAnswerArg: callback.parseAnswerArg,
      messages: botMessages.MESSAGES,
      chatId,
      // THE COCKPIT'S BASE URL - a NAME, never a value read from a credentials
      // file, exactly like every other config on this object. Unset is a valid
      // state and the honest one: the card then shows the cockpit PATH, which is
      // what it did before. Set it to the tailnet origin Warwick actually opens
      // and the same card carries a link he can tap. Owned by Mack, who owns
      // values and their placement; this module only names the variable.
      checklistBaseUrl: process.env.ASDAIR_COCKPIT_BASE_URL || null,
      send: (chat, message) => sender.sendMessage(chat, message),
      // THE BOARD IS REWRITTEN, NOT RE-SENT (WP-B15-09). editMessageText has
      // existed in sendShopperMessage.js since the bot was built and had no
      // production caller; without it on this object, drainOutbox can only ever
      // send, and Warwick is back to reading a scrolling history of superseded
      // boards - which is the exact complaint this Work Package answers.
      editMessage: (chat, messageId, message) => sender.editMessageText(chat, messageId, message),
      answerTap: (id, text) => sender.answerCallbackQuery(id, { text }),
      // THE ONLY THING THAT MAY SEND A QUESTION. It sends, then seals the render
      // contract against the message id Telegram allocated. The failure window is
      // therefore "a card exists with no contract", and that direction is safe -
      // a tap on it is refused. The dangerous direction, a contract that does not
      // describe the live card, is unreachable.
      sendQuestionCard: (spec) => questionRender.sendQuestionCard({ sender, store: questions, ...spec }),
      // The correlation lookups are no longer stubs. They are built PER UPDATE in
      // routeTaps, from the card the update actually came from - see that
      // function's header for why the card, and not the question key, is the
      // thing correlated on.
      questions,
    },
  };
}

async function main() {
  const once = arg('once') === true;
  const watch = arg('watch') === true;
  if (!once && !watch) {
    console.error('usage: node --env-file=<env> runtime.js --once | --watch [--interval <seconds>]');
    process.exit(2);
  }
  const { createDeps, closeDeps } = await import('./deps.js');
  const deps = createDeps();
  const wiring = await realWiring(deps);
  wiring.log = (event, detail) => console.log(JSON.stringify({ event, ...detail }));

  // ── OBSERVABLE AT BOOT, 2026-08-10 ─────────────────────────────────────────
  // The checklist link's origin is read ONCE, from the environment, when the
  // bot is wired. Nothing exposed it, so nobody could tell from outside what
  // the next handover card would carry - and a card carrying a bare path is
  // the whole defect this base URL exists to fix.
  //
  // Veritas held on exactly that: not a stable approved runtime, not
  // observable, real production event not exercised. This closes the middle
  // one. It reports what THIS process actually resolved, not what a status
  // tool's own environment happens to hold - a value read in a different
  // process is a surface merely correlated with the outcome, which is the
  // measurement mistake this estate keeps making.
  //
  // Absent is logged as loudly as present, because absent is the state that
  // silently degrades the card back to an unusable path.
  wiring.log('checklist_base_url', {
    set: Boolean(wiring.bot && wiring.bot.checklistBaseUrl),
    value: (wiring.bot && wiring.bot.checklistBaseUrl) || null,
    consequence: (wiring.bot && wiring.bot.checklistBaseUrl)
      ? 'handover cards carry a tappable absolute URL'
      : 'handover cards carry a BARE PATH Warwick cannot open - set ASDAIR_COCKPIT_BASE_URL',
  });

  try {
    if (once) {
      const report = await runOnce(deps, wiring);
      console.log(JSON.stringify(report, null, 1));
      return;
    }
    const interval = Number(arg('interval', DEFAULT_INTERVAL_SECONDS)) || DEFAULT_INTERVAL_SECONDS;
    const loop = runWatch(deps, wiring, { intervalSeconds: interval });
    const stop = () => { console.log(JSON.stringify({ event: 'stopping' })); loop.stop(); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    await loop.done;
  } finally {
    await closeDeps();
  }
}

const isCli = process.argv[1] && process.argv[1].endsWith('runtime.js');
if (isCli) {
  main().catch((e) => { console.error('runtime error:', e.message); process.exit(1); });
}

export { COMMANDS };
