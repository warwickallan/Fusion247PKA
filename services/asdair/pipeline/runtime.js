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
import { runPipeline } from './runPipeline.js';
import * as store from './store.js';
import { intentToCommand, intentToCommands } from './telegramAdapter.js';
// WP-B15-A1. resolveExactCandidate is PURE and opens no connection, so importing
// it statically does not break this file's "importable on a box with no pg"
// property - the same reasoning as the three bot imports below.
import * as shopDecisions from './shopDecisions.js';
import { COMMANDS } from './commandNames.js';
import { LEDGER_KINDS, ledgerFamilyKey, outboxKeyFor } from './keys.js';
// The bot folder is PURE and zero-dependency (it opens no connection; a test in
// that folder enforces it), so importing these three statically does NOT break
// the property the dynamic import of deps.js below protects: this file must stay
// importable on a box with no `pg` installed. The Telegram SENDER and the
// question STORE remain injected, because those are the parts that touch a wire.
import { normaliseStoredCandidates, questionLookupFrom } from '../bot/questionRender.js';
import { resolveCandidateAnswer } from '../bot/resolveTap.js';
import { ACTIONS } from '../bot/callbackProtocol.js';

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
export async function loadOpenQuestions(deps, { householdId = null, log = () => {} } = {}) {
  const open = [];
  let shops = [];
  try {
    shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  } catch (err) {
    log('open_questions_lookup_failed', { detail: String(err && err.message ? err.message : err) });
    return open;
  }

  for (const shop of shops) {
    if (householdId !== null && householdId !== undefined
        && shop.household_id !== null && shop.household_id !== undefined
        && String(shop.household_id) !== String(householdId)) continue;
    try {
      for (const q of await store.listQuestions(deps, shop.id)) {
        if (q.status !== 'open') continue;
        open.push({
          shopRef: shop.shop_ref,
          shopId: shop.id,
          questionKey: q.question_key,
          questionText: q.question_text || null,
          itemName: q.item_name || null,
          candidates: Array.isArray(q.candidates) ? q.candidates : [],
          renderedCandidates: Array.isArray(q.rendered_candidates) ? q.rendered_candidates : [],
        });
      }
    } catch (err) {
      // One shop's questions must not stop another shop's - same posture as
      // queueShopCards, and for the same reason.
      log('open_questions_lookup_failed', {
        shop_ref: shop.shop_ref, detail: String(err && err.message ? err.message : err),
      });
    }
  }
  return open;
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
export async function correlateTypedAnswer(deps, { text, open, log = () => {} } = {}) {
  const words = typeof text === 'string' ? text.trim() : '';
  if (words === '' || !Array.isArray(open) || open.length === 0) return null;

  // ── 1. DETERMINISTIC. No model call, and the same resolver the spine uses. ─
  const exact = open.filter((q) => shopDecisions.resolveExactCandidate({
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
  if (open.length === 1) {
    return {
      mappings: [{ questionKey: open[0].questionKey, shopRef: open[0].shopRef, answerText: words }],
      unmapped: null,
      modelCalled: false,
    };
  }

  // ── 3. TERRA, ONCE, WITH EVERY OPEN KEY. ──────────────────────────────────
  if (typeof deps.correlateAnswer !== 'function') {
    log('answer_correlation_unavailable', {
      open_questions: open.length,
      detail: 'no answer correlator is wired into this runtime, so a typed message cannot be matched to one of several open questions',
    });
    return null;
  }

  let returned = null;
  try {
    returned = await deps.correlateAnswer({
      answer_text: words,
      questions: open.map((q) => ({
        question_key: q.questionKey,
        question_text: q.questionText,
        item_name: q.itemName,
        candidates: q.candidates,
      })),
    });
  } catch (err) {
    log('answer_correlation_failed', {
      open_questions: open.length, detail: String(err && err.message ? err.message : err),
    });
    return null;
  }

  if (!returned || !Array.isArray(returned.mappings) || returned.mappings.length === 0) {
    log('answer_correlation_empty', { open_questions: open.length });
    return null;
  }

  const byKey = new Map(open.map((q) => [q.questionKey, q]));
  const mappings = [];
  for (const m of returned.mappings) {
    if (!m || m.confidence !== 'high') continue;
    const q = byKey.get(m.question_key);
    // A key the correlator was never shown is dropped, not corrected.
    if (!q) continue;
    mappings.push({ questionKey: q.questionKey, shopRef: q.shopRef, answerText: m.answer_text || words });
  }
  if (mappings.length === 0) {
    log('answer_correlation_low_confidence', { open_questions: open.length, offered: returned.mappings.length });
    return null;
  }

  return { mappings, unmapped: returned.unmapped_text || null, modelCalled: true };
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
      log('inbound_refused', { updateId: update && update.update_id, reason: intent.reason });
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
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, detail || reason);
      }
      continue;
    }
    try {
      const receipt = await commands.dispatch(mapped.command, mapped.spec, deps);
      routed.push({ action: intent.action, command: mapped.command, receipt });
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, receipt.duplicate ? 'Already asked for' : 'Got it');
      }
    } catch (err) {
      const detail = String(err && err.message ? err.message : err);
      refused.push({ action: intent.action, reason: 'command failed', detail });
      log('tap_failed', { action: intent.action, detail });
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, 'That did not work - check the status card');
      }
    }
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
export async function queueShopCards(deps, {
  shops, contract = BASKET_HANDBACK_CONTRACT, verificationFor = null, log = () => {},
} = {}) {
  const questions = [];
  const basketReady = [];
  const list = Array.isArray(shops) ? shops : await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);

  for (const shop of list) {
    // ── open questions -> question cards
    try {
      for (const q of await store.listQuestions(deps, shop.id)) {
        if (q.status !== 'open') continue;
        // Already on his phone. Asked once, never twice.
        if (q.card_message_id !== null && q.card_message_id !== undefined && String(q.card_message_id) !== '') continue;

        // The planner stores candidates in ITS shape. Only the ones carrying a
        // trustworthy id may become buttons; the rest are shown as text he can
        // reply to, because an index resolving to a label is the ambiguity the
        // render contract exists to remove.
        const { candidates, unidentified } = normaliseStoredCandidates(q.candidates);
        const note = unidentified.length > 0
          ? `Also suggested (no product id - reply with the one you want): ${unidentified.join('; ')}`
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

  return { questions, basketReady };
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

      await bot.send(chatId, render(item.payload));
      await store.resolveCommand(deps, item.id, 'done', 'sent');
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
  const openQuestions = await loadOpenQuestions(deps, { householdId: wiring.householdId, log });
  const claimedUpdateIds = new Set();
  const answers = [];

  // NO OPEN QUESTION, NO CLAIM. Warwick's guard, and the reason a genuine new
  // shopping list is never lost: with nothing to correlate to, routing does not
  // get a vote and intake behaves exactly as it always has.
  const claim = (openQuestions.length === 0 || !wiring.bot || typeof wiring.bot.routeAsdairUpdate !== 'function')
    ? null
    : async (verdict, update) => {
      // A photo is a list. A reply already correlates through the card it
      // replies to, and routeTaps handles it. Only bare text reaches here.
      if (!verdict || verdict.kind !== 'text') return false;
      const msg = update && update.message;
      if (!msg || msg.reply_to_message) return false;

      const correlation = await correlateTypedAnswer(deps, {
        text: verdict.text, open: openQuestions, log,
      });
      if (!correlation) {
        log('typed_message_not_claimed', {
          updateId: verdict.updateId, open_questions: openQuestions.length,
        });
        return false;
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
          answers.push({ question_key: c.spec.questionKey, shop_ref: c.spec.shopRef, duplicate: receipt.duplicate === true });
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
  const questions = wiring.questions || (wiring.bot && wiring.bot.questions) || null;

  const tapReport = await routeTaps(deps, {
    updates: capturing ? capturing.captured : [],
    bot: wiring.bot,
    questions,
    claimedUpdateIds,
    log,
  });
  const advanced = await advanceAll(deps, { log });
  // AFTER the advance, so a question opened by THIS pass's planning step is
  // carded on this pass rather than waiting a full interval for the next one.
  const cards = await queueShopCards(deps, { verificationFor: wiring.verificationFor || null, log });
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
    open_questions_seen: openQuestions.length,
    taps: { routed: tapReport.routed.length, refused: tapReport.refused.length, detail: tapReport.refused },
    shops: advanced.map((r) => ({
      shop_ref: r.shop_ref, step: r.step, stepped: r.stepped,
      from: r.from, to: r.to, ok: r.ok !== false, error: r.error || null,
    })),
    stepped: advanced.filter((r) => r.stepped).length,
    cards: {
      questions: cards.questions.length,
      basket_ready: cards.basketReady.length,
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

/** Build the real Telegram wiring from the environment. Names only - no value
 *  is read from a credentials file by this module. */
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
      send: (chat, message) => sender.sendMessage(chat, message),
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
