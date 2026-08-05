// =====================================================================
// BUILD-015 AsdAIr — bot: resolveTap.js
//
// THE OTHER HALF OF THE RENDER CONTRACT. questionRender.js records what was
// displayed; this module is the ONLY thing that resolves a tapped index back
// through that record to a product.
//
// ── THE DEFECT THIS FIXES ────────────────────────────────────────────────────
// Question buttons did not work: a tapped candidate was refused, because nothing
// persisted the link between a sent card and what it displayed. The fix is not
// "look the candidates up again" — that is the bug, dressed as the fix. A button
// carries an INDEX (the only thing that fits Telegram's 64-byte callback_data),
// and an index is meaningful ONLY against the list that was on screen. Resolving
// it against a freshly computed list is how button #2 quietly becomes a
// different product.
//
// So: the index is mapped through the STORED `rendered_candidates`, in the
// stored order, and nowhere else. There is no fallback path in this file that
// recomputes candidates, and there must never be one.
//
// ── HOW A STALE TAP IS DETECTED (and it is detected, not guessed at) ─────────
// The callback_data cannot carry the fingerprint. That is arithmetic, not
// oversight: the arg budget is 16 bytes and `<questionKey>.<candidateIndex>`
// already spends all 16 in the worst case (callbackProtocol.js). Widening it
// would push the worst legal payload past 64 bytes, which Telegram rejects.
//
// The CARD ITSELF is therefore the render token. Each render version is bound to
// exactly one Telegram message, and questionRender.persistQuestionRender refuses
// to bind a changed ordering to a message id an earlier version already used —
// so "a new render" and "a new message id" are the same event, enforced.
//
// A tap then falls into exactly one of three buckets:
//
//   (chat, message) IS the recorded card   -> the live render. Resolve it.
//   (chat, message) is NOT, but the question EXISTS
//                                          -> a superseded card. The contract
//                                             has moved on; this button's index
//                                             addresses a list that is no longer
//                                             displayed. REFUSE, VISIBLY, and
//                                             offer a refresh.
//   neither                                -> unknown card. REFUSE.
//
// On top of that, three further checks fail closed rather than guessing:
//   * the stored contract is re-hashed and must match its stored fingerprint
//     (verifyStoredContract) — a row edited without re-sealing is refused;
//   * a caller that KNOWS which render it expects (a queued job, a replayed
//     command) may pin `expectedRenderVersion` / `expectedRenderFingerprint`,
//     and a mismatch is refused;
//   * the index must be inside the stored list — an index past the end is a
//     shrunken re-render, and is treated as staleness, not as a bad tap.
//
// Nowhere does this module conclude "probably still the same order".
//
// ── IDEMPOTENT: FIRST ANSWER WINS ────────────────────────────────────────────
// Telegram redelivers. Warwick double-taps. A repeated tap must return the SAME
// durable answer and must not rewrite it — otherwise the second tap of a
// fat-fingered pair would overwrite a decision that has already been acted on.
// Enforcement is a compare-and-set in the store (`update … where status='open'`),
// not a read-then-write here: two taps racing through this function must not
// both see 'open' and both write. When the CAS does not apply, the stored answer
// is read back and returned verbatim.
//
// ── THE SPINNER ALWAYS STOPS ─────────────────────────────────────────────────
// answerCallbackQuery is emitted on EVERY path, including every refusal. A tap
// that is never answered spins for ~30 seconds and then looks, to Warwick, like
// the bot died — which is worse than an honest "this card is out of date".
//
// ── NO I/O OF ITS OWN ────────────────────────────────────────────────────────
// No database connection is opened here and no credential is read. The `store`
// and the `sender` are injected. Nothing is logged: this module returns
// structured results and lets the caller decide what is safe to print.
// =====================================================================

import { ACTIONS, parseAnswerArg } from './callbackProtocol.js';
import { routeAsdairUpdate } from './inboundRouter.js';
import { verifyStoredContract } from './questionRender.js';

/** Every refusal this resolver can produce. Frozen so callers can switch on them. */
export const TAP_REFUSALS = Object.freeze({
  NOT_A_TAP: 'not a tapped button',
  NOT_AN_ANSWER: 'not a candidate answer tap',
  BAD_ANSWER_ARG: 'malformed answer arg',
  NO_CARD_IDENTITY: 'tap carried no chat/message id to correlate',
  UNKNOWN_CARD: 'no render contract for this card',
  STALE_CARD: 'this card has been superseded by a newer render',
  QUESTION_MISMATCH: 'the card does not belong to that question',
  SHOP_MISMATCH: 'the card does not belong to that shop',
  CONTRACT_CORRUPT: 'the stored render contract does not match its fingerprint',
  INDEX_OUT_OF_RANGE: 'the tapped index is not in the rendered list',
  CANDIDATE_UNIDENTIFIED: 'the rendered candidate has no product id',
  QUESTION_SKIPPED: 'that question was skipped',
  STORE_FAILED: 'the question store could not be reached',
});

/** Outcomes of a successful resolve. */
export const TAP_OUTCOMES = Object.freeze({
  ANSWERED: 'answered',
  ALREADY_ANSWERED: 'already_answered',
});

/** What Warwick sees in the Telegram toast/alert. Short — Telegram caps at 200.
 *  Exported because the pipeline runtime answers some taps itself (it routes a
 *  tap onto the COMMAND surface rather than writing the answer here), and a
 *  second copy of these strings would be a second thing to keep in step. */
export const TAP_NOTICES = Object.freeze({
  [TAP_REFUSALS.STALE_CARD]: 'This card is out of date — the options were re-listed since it was sent. Nothing was changed. Ask for the question again to get a fresh card.',
  [TAP_REFUSALS.INDEX_OUT_OF_RANGE]: 'That option is no longer on the current list. Nothing was changed. Ask for the question again to get a fresh card.',
  [TAP_REFUSALS.QUESTION_MISMATCH]: 'This button does not match the card it is on. Nothing was changed. Ask for the question again.',
  [TAP_REFUSALS.SHOP_MISMATCH]: 'This button belongs to a different shop. Nothing was changed.',
  [TAP_REFUSALS.UNKNOWN_CARD]: 'This card is not on record, so its options cannot be resolved. Nothing was changed. Ask for the question again.',
  [TAP_REFUSALS.CONTRACT_CORRUPT]: 'The record of what this card displayed is not intact, so the tap cannot be resolved safely. Nothing was changed.',
  [TAP_REFUSALS.CANDIDATE_UNIDENTIFIED]: 'That option has no product id on record, so it cannot be resolved safely. Nothing was changed.',
  [TAP_REFUSALS.QUESTION_SKIPPED]: 'That item was skipped for this shop. Nothing was changed.',
  [TAP_REFUSALS.STORE_FAILED]: 'Could not reach the shop record just now. Nothing was changed. Try again.',
  [TAP_REFUSALS.BAD_ANSWER_ARG]: 'That button is malformed and was not acted on.',
  [TAP_REFUSALS.NOT_AN_ANSWER]: 'That button is not a candidate choice.',
  [TAP_REFUSALS.NO_CARD_IDENTITY]: 'This tap carried no card to correlate it to. Nothing was changed.',
});

/** Backwards-compatible internal alias. The exported name is TAP_NOTICES. */
const NOTICES = TAP_NOTICES;

/** Refusals that mean "the card is out of date" — the caller should offer a fresh one. */
const REFRESHABLE = new Set([
  TAP_REFUSALS.STALE_CARD,
  TAP_REFUSALS.INDEX_OUT_OF_RANGE,
  TAP_REFUSALS.QUESTION_MISMATCH,
  TAP_REFUSALS.UNKNOWN_CARD,
]);

/**
 * Stop the spinner. NEVER throws: an ack that fails must not turn a resolved tap
 * into an unresolved one, nor mask the real refusal. The failure is reported in
 * the result instead.
 *
 * The message is passed through untouched — every string here is a constant from
 * NOTICES or a candidate label, never an error object, never an environment
 * value, never a token. (sendShopperMessage masks its own diagnostics; this
 * module deliberately never reads one.)
 */
async function acknowledge(sender, callbackQueryId, text, showAlert) {
  if (!sender || typeof sender.answerCallbackQuery !== 'function') {
    return { acknowledged: false, ackError: 'no sender injected' };
  }
  if (!callbackQueryId) {
    return { acknowledged: false, ackError: 'no callback_query_id on the tap' };
  }
  try {
    await sender.answerCallbackQuery(callbackQueryId, { text, showAlert });
    return { acknowledged: true };
  } catch (err) {
    return { acknowledged: false, ackError: err && err.message ? err.message : 'answerCallbackQuery failed' };
  }
}

function sameId(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a) === String(b);
}

/** The durable answer already on a question row, shaped like a successful resolve. */
function durableAnswer(row) {
  const list = Array.isArray(row.rendered_candidates) ? row.rendered_candidates : [];
  const idx = Number.isInteger(row.callback_index) ? row.callback_index : null;
  const chosen = idx !== null && idx >= 0 && idx < list.length ? list[idx] : null;
  return {
    candidateIndex: idx,
    candidateId: chosen && chosen.id !== undefined ? String(chosen.id) : null,
    candidateLabel: chosen && chosen.label !== undefined ? String(chosen.label) : null,
    answerText: typeof row.answer_text === 'string' ? row.answer_text : null,
    answerSource: typeof row.answer_source === 'string' ? row.answer_source : null,
  };
}

/**
 * READ-ONLY. Resolve a tapped candidate INDEX back to the product text that was
 * actually displayed — and refuse, with a reason, when it cannot be done safely.
 *
 * ── WHY THIS EXISTS ALONGSIDE resolveTap() ───────────────────────────────────
 * resolveTap() is the whole round trip: it resolves AND writes the answer AND
 * acknowledges the tap. The pipeline runtime does not want that: a tap there
 * becomes a member of the COMMAND surface (`answerQuestion`), so that a tap on
 * the phone and a click in the Cockpit are the same durable write. If the runtime
 * called resolveTap() as well, one tap would be written twice, through two
 * different paths, and the ledger would stop being the record of what happened.
 *
 * So this function is the READ half on its own — every staleness check resolveTap
 * makes, in the same order, using the same refusal vocabulary and the same
 * contract verification, and NOTHING ELSE. No write, no acknowledgement. The
 * caller writes through its own command surface and answers the tap itself.
 *
 * It is deliberately here rather than in a new module: this file's header says it
 * is the only thing that reads the render contract back, and that is a property
 * worth keeping true.
 *
 * THE THREE BUCKETS ARE IDENTICAL to resolveTap's, because the defect is:
 *   (chat, message) IS the recorded card  -> live render, resolve the index
 *   not it, but the question exists       -> STALE_CARD. Refuse, visibly.
 *   neither                               -> UNKNOWN_CARD. Refuse.
 * There is NO path here that recomputes candidates. There must never be one.
 *
 * @param {{store:object, shopRef?:string|null, questionKey:string, candidateIndex:number,
 *          chatId:*, messageId:*, expectedRenderVersion?:number,
 *          expectedRenderFingerprint?:string}} args
 * @returns {Promise<{ok:true, questionKey:string, candidateIndex:number, label:string,
 *                    candidateId:string, renderVersion:*, renderFingerprint:*,
 *                    alreadyAnswered:boolean}
 *                 | {ok:false, code:string, reason:string, notice:string, refresh:boolean}>}
 */
export async function resolveCandidateAnswer({
  store, shopRef = null, questionKey, candidateIndex, chatId, messageId,
  expectedRenderVersion, expectedRenderFingerprint,
} = {}) {
  if (!store || typeof store !== 'object') throw new Error('resolveCandidateAnswer: a store must be injected');
  for (const m of ['getQuestionByCard', 'getQuestionByKey']) {
    if (typeof store[m] !== 'function') throw new Error(`resolveCandidateAnswer: store.${m}() is required`);
  }

  const refuse = (code, extra = {}) => ({
    ok: false,
    code,
    reason: code,
    notice: NOTICES[code] || code,
    refresh: REFRESHABLE.has(code),
    questionKey: typeof questionKey === 'string' ? questionKey : null,
    candidateIndex: Number.isInteger(candidateIndex) ? candidateIndex : null,
    ...extra,
  });

  if (typeof questionKey !== 'string' || questionKey.length === 0) return refuse(TAP_REFUSALS.BAD_ANSWER_ARG);
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0) return refuse(TAP_REFUSALS.BAD_ANSWER_ARG);
  if (chatId === null || chatId === undefined || messageId === null || messageId === undefined) {
    return refuse(TAP_REFUSALS.NO_CARD_IDENTITY);
  }

  // ── 1. The card, BY IDENTITY. Never by question key — the key alone finds
  //       whatever render happens to be current, which is the guess this refuses.
  let row;
  try {
    row = await store.getQuestionByCard({ chatId, messageId });
  } catch {
    return refuse(TAP_REFUSALS.STORE_FAILED);
  }

  if (!row) {
    let byKey = null;
    try {
      byKey = await store.getQuestionByKey({ shopRef, questionKey });
    } catch {
      return refuse(TAP_REFUSALS.STORE_FAILED);
    }
    if (byKey) {
      // The question is alive but this is not its card. A SUPERSEDED render —
      // and that is a far more useful fact than "never heard of it".
      return refuse(TAP_REFUSALS.STALE_CARD, {
        tappedCard: { chatId: String(chatId), messageId: String(messageId) },
        currentCard: {
          chatId: byKey.card_chat_id !== undefined && byKey.card_chat_id !== null ? String(byKey.card_chat_id) : null,
          messageId: byKey.card_message_id !== undefined && byKey.card_message_id !== null ? String(byKey.card_message_id) : null,
        },
        currentRenderVersion: byKey.render_version ?? null,
      });
    }
    return refuse(TAP_REFUSALS.UNKNOWN_CARD);
  }

  // ── 2. The card must be the card the button claims to be on.
  if (row.question_key !== questionKey) {
    return refuse(TAP_REFUSALS.QUESTION_MISMATCH, { cardQuestionKey: row.question_key ?? null });
  }
  if (shopRef && row.shop_ref !== undefined && row.shop_ref !== null && !sameId(row.shop_ref, shopRef)) {
    return refuse(TAP_REFUSALS.SHOP_MISMATCH);
  }
  // Belt and braces: the row came back FROM (chat, message), but a store that
  // looked it up loosely would defeat the whole scheme, so re-check the binding.
  if (!sameId(row.card_chat_id, chatId) || !sameId(row.card_message_id, messageId)) {
    return refuse(TAP_REFUSALS.STALE_CARD);
  }

  // ── 3. The stored contract must still describe what it says it describes.
  const integrity = verifyStoredContract(row);
  if (!integrity.ok) return refuse(TAP_REFUSALS.CONTRACT_CORRUPT, { detail: integrity.reason });

  // ── 4. A caller that knows which render it expects may pin it.
  if (expectedRenderVersion !== undefined && expectedRenderVersion !== null
      && row.render_version !== expectedRenderVersion) {
    return refuse(TAP_REFUSALS.STALE_CARD, {
      expectedRenderVersion, actualRenderVersion: row.render_version ?? null,
    });
  }
  if (expectedRenderFingerprint !== undefined && expectedRenderFingerprint !== null
      && row.render_fingerprint !== expectedRenderFingerprint) {
    return refuse(TAP_REFUSALS.STALE_CARD);
  }

  if (row.status === 'skipped') return refuse(TAP_REFUSALS.QUESTION_SKIPPED);

  // ── 5. Index -> candidate, THROUGH THE STORED LIST. The only mapping there is.
  const rendered = Array.isArray(row.rendered_candidates) ? row.rendered_candidates : [];
  if (candidateIndex >= rendered.length) {
    // Past the end of the stored list = the list shrank under this card. That is
    // staleness, and it gets the staleness treatment, not a shrug.
    return refuse(TAP_REFUSALS.INDEX_OUT_OF_RANGE, { renderedCount: rendered.length });
  }
  const chosen = rendered[candidateIndex];
  const candidateId = chosen && chosen.id !== undefined && chosen.id !== null ? String(chosen.id) : '';
  if (candidateId.length === 0) return refuse(TAP_REFUSALS.CANDIDATE_UNIDENTIFIED);
  const candidateLabel = chosen && chosen.label !== undefined && chosen.label !== null && String(chosen.label).length > 0
    ? String(chosen.label)
    : null;

  return {
    ok: true,
    questionKey,
    candidateIndex,
    // The pipeline's answerQuestion command stores answer_text, which is what a
    // human reads back. The id stays alongside it for the audit trail.
    label: candidateLabel || candidateId,
    candidateId,
    renderVersion: row.render_version ?? null,
    renderFingerprint: row.render_fingerprint ?? null,
    alreadyAnswered: row.status === 'answered',
  };
}

/**
 * Resolve one inbound tap into a durable answer.
 *
 * @param {object} intent the intent from routeAsdairUpdate (`{ok:true, action, shopRef, arg, raw}`)
 * @param {{store:object, sender?:object, now?:Function,
 *          expectedRenderVersion?:number, expectedRenderFingerprint?:string}} deps
 * @returns {Promise<object>} `{ok:true, outcome, …}` or `{ok:false, code, reason, …}`;
 *          every result carries `acknowledged` (and `ackError` when the ack failed).
 */
export async function resolveTap(intent, {
  store, sender, now = () => new Date().toISOString(),
  expectedRenderVersion, expectedRenderFingerprint,
} = {}) {
  if (!store || typeof store !== 'object') throw new Error('resolveTap: a store must be injected');
  for (const m of ['getQuestionByCard', 'getQuestionByKey', 'recordAnswer']) {
    if (typeof store[m] !== 'function') throw new Error(`resolveTap: store.${m}() is required`);
  }

  const raw = intent && intent.raw ? intent.raw : null;
  const callbackQueryId = raw ? raw.callbackQueryId : null;

  // Refuse first, acknowledge always. `refuse` is the ONLY exit for a non-answer.
  const refuse = async (code, extra = {}) => {
    const notice = NOTICES[code] || code;
    const ack = await acknowledge(sender, callbackQueryId, notice, true);
    return {
      ok: false,
      code,
      reason: code,
      notice,
      refresh: REFRESHABLE.has(code),
      ...ack,
      ...extra,
    };
  };

  if (!intent || intent.ok !== true || !raw || raw.kind !== 'callback') {
    return refuse(TAP_REFUSALS.NOT_A_TAP);
  }
  if (intent.action !== ACTIONS.ANSWER || intent.arg === null || intent.arg === undefined) {
    // `answer` with NO arg means "open the question queue" — a real intent, but
    // not this module's. Anything else is not a candidate choice at all.
    return refuse(TAP_REFUSALS.NOT_AN_ANSWER);
  }
  const parsed = parseAnswerArg(intent.arg);
  if (!parsed.ok) return refuse(TAP_REFUSALS.BAD_ANSWER_ARG);
  const { questionKey, candidateIndex } = parsed;

  const chatId = raw.chatId;
  const messageId = raw.messageId;
  if (chatId === null || chatId === undefined || messageId === null || messageId === undefined) {
    return refuse(TAP_REFUSALS.NO_CARD_IDENTITY, { questionKey, candidateIndex });
  }

  // ── 1. The card, by identity. NOT by question key: the key alone would find
  //       whatever render happens to be current, which is precisely the guess
  //       this module refuses to make.
  let row;
  try {
    row = await store.getQuestionByCard({ chatId, messageId });
  } catch {
    return refuse(TAP_REFUSALS.STORE_FAILED, { questionKey, candidateIndex });
  }

  if (!row) {
    // The card is not the live render. Is the QUESTION still around? If it is,
    // this is a superseded card — a different and much more informative fact
    // than "never heard of it", and the one Warwick needs to be told.
    let byKey = null;
    try {
      byKey = await store.getQuestionByKey({ shopRef: intent.shopRef, questionKey });
    } catch {
      return refuse(TAP_REFUSALS.STORE_FAILED, { questionKey, candidateIndex });
    }
    if (byKey) {
      return refuse(TAP_REFUSALS.STALE_CARD, {
        questionKey,
        candidateIndex,
        tappedCard: { chatId: String(chatId), messageId: String(messageId) },
        currentCard: {
          chatId: byKey.card_chat_id !== undefined && byKey.card_chat_id !== null ? String(byKey.card_chat_id) : null,
          messageId: byKey.card_message_id !== undefined && byKey.card_message_id !== null ? String(byKey.card_message_id) : null,
        },
        currentRenderVersion: byKey.render_version ?? null,
      });
    }
    return refuse(TAP_REFUSALS.UNKNOWN_CARD, { questionKey, candidateIndex });
  }

  // ── 2. The card must be the card the button claims to be on.
  if (row.question_key !== questionKey) {
    return refuse(TAP_REFUSALS.QUESTION_MISMATCH, {
      questionKey, candidateIndex, cardQuestionKey: row.question_key ?? null,
    });
  }
  if (intent.shopRef && row.shop_ref !== undefined && row.shop_ref !== null
      && !sameId(row.shop_ref, intent.shopRef)) {
    return refuse(TAP_REFUSALS.SHOP_MISMATCH, { questionKey, candidateIndex });
  }
  // Belt and braces: the row came back FROM (chat, message), but a store that
  // looked it up loosely would defeat the whole scheme, so re-check the binding.
  if (!sameId(row.card_chat_id, chatId) || !sameId(row.card_message_id, messageId)) {
    return refuse(TAP_REFUSALS.STALE_CARD, { questionKey, candidateIndex });
  }

  // ── 3. The stored contract must still describe what it says it describes.
  const integrity = verifyStoredContract(row);
  if (!integrity.ok) {
    return refuse(TAP_REFUSALS.CONTRACT_CORRUPT, {
      questionKey, candidateIndex, detail: integrity.reason,
    });
  }

  // ── 4. A caller that knows which render it expects may pin it.
  if (expectedRenderVersion !== undefined && expectedRenderVersion !== null
      && row.render_version !== expectedRenderVersion) {
    return refuse(TAP_REFUSALS.STALE_CARD, {
      questionKey, candidateIndex,
      expectedRenderVersion, actualRenderVersion: row.render_version ?? null,
    });
  }
  if (expectedRenderFingerprint !== undefined && expectedRenderFingerprint !== null
      && row.render_fingerprint !== expectedRenderFingerprint) {
    return refuse(TAP_REFUSALS.STALE_CARD, { questionKey, candidateIndex });
  }

  if (row.status === 'skipped') {
    return refuse(TAP_REFUSALS.QUESTION_SKIPPED, { questionKey, candidateIndex });
  }

  // ── 5. Already answered? Return the DURABLE answer, write nothing.
  if (row.status === 'answered') {
    const answer = durableAnswer(row);
    const ack = await acknowledge(
      sender, callbackQueryId,
      `Already answered: ${answer.answerText || answer.candidateLabel || 'recorded'}`,
      false,
    );
    return {
      ok: true,
      outcome: TAP_OUTCOMES.ALREADY_ANSWERED,
      questionKey,
      candidateIndex: answer.candidateIndex,
      tappedIndex: candidateIndex,
      conflicting: answer.candidateIndex !== null && answer.candidateIndex !== candidateIndex,
      candidateId: answer.candidateId,
      candidateLabel: answer.candidateLabel,
      answerText: answer.answerText,
      answerSource: answer.answerSource,
      renderVersion: row.render_version ?? null,
      renderFingerprint: row.render_fingerprint ?? null,
      wrote: false,
      ...ack,
    };
  }

  // ── 6. Index -> candidate, THROUGH THE STORED LIST. The only mapping there is.
  const rendered = row.rendered_candidates;
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex >= rendered.length) {
    // Past the end of the stored list = the list shrank under this card. That is
    // staleness, and it gets the staleness treatment, not a shrug.
    return refuse(TAP_REFUSALS.INDEX_OUT_OF_RANGE, {
      questionKey, candidateIndex, renderedCount: rendered.length,
    });
  }
  const chosen = rendered[candidateIndex];
  const candidateId = chosen && chosen.id !== undefined && chosen.id !== null ? String(chosen.id) : '';
  if (candidateId.length === 0) {
    return refuse(TAP_REFUSALS.CANDIDATE_UNIDENTIFIED, { questionKey, candidateIndex });
  }
  const candidateLabel = chosen && chosen.label !== undefined && chosen.label !== null
    ? String(chosen.label)
    : null;

  // ── 7. Compare-and-set. First answer wins; a loser reads the winner's answer.
  let result;
  try {
    result = await store.recordAnswer({
      questionId: row.id,
      shopRef: row.shop_ref ?? intent.shopRef ?? null,
      questionKey,
      answerText: candidateLabel || candidateId,
      answerSource: 'button',
      callbackIndex: candidateIndex,
      candidateId,
      renderVersion: row.render_version,
      renderFingerprint: row.render_fingerprint,
      answeredAt: now(),
    });
  } catch {
    return refuse(TAP_REFUSALS.STORE_FAILED, { questionKey, candidateIndex });
  }

  const applied = Boolean(result && result.applied);
  const settled = (result && result.question) || row;
  const answer = durableAnswer(settled);

  const ack = await acknowledge(
    sender, callbackQueryId,
    applied
      ? `Got it: ${answer.answerText || candidateLabel || candidateId}`
      : `Already answered: ${answer.answerText || candidateLabel || candidateId}`,
    false,
  );

  return {
    ok: true,
    outcome: applied ? TAP_OUTCOMES.ANSWERED : TAP_OUTCOMES.ALREADY_ANSWERED,
    questionKey,
    candidateIndex: applied ? candidateIndex : answer.candidateIndex,
    tappedIndex: candidateIndex,
    conflicting: !applied && answer.candidateIndex !== null && answer.candidateIndex !== candidateIndex,
    candidateId: applied ? candidateId : (answer.candidateId ?? candidateId),
    candidateLabel: applied ? candidateLabel : (answer.candidateLabel ?? candidateLabel),
    answerText: answer.answerText ?? (candidateLabel || candidateId),
    answerSource: answer.answerSource ?? 'button',
    renderVersion: settled.render_version ?? row.render_version ?? null,
    renderFingerprint: settled.render_fingerprint ?? row.render_fingerprint ?? null,
    wrote: applied,
    ...ack,
  };
}

/**
 * THE WIRING. One raw Telegram update in, one resolved (or refused) tap out.
 *
 *   update -> inboundRouter.routeAsdairUpdate  (what was asked, by whom)
 *          -> resolveTap                        (what it means, durably)
 *
 * The two stay separate on purpose — routing is not deciding — and this function
 * is the seam, not a merger of them. A non-AsdAIr update is handed back with the
 * router's own refusal and NO acknowledgement: a `decision:` card belongs to the
 * hub, and answering its callback query here would steal the hub's spinner.
 *
 * The update is NOT fetched. It is handed in by services/asdair/intake/, the one
 * and only consumer of the ShopperBot stream.
 *
 * @param {object} update a Telegram Update
 * @param {{store:object, sender?:object, resolveQuestionByMessage?:Function, …}} deps
 *        (`…` = every option resolveTap accepts)
 */
export async function handleAsdairTap(update, deps = {}) {
  const { resolveQuestionByMessage, ...rest } = deps;
  const intent = routeAsdairUpdate(update, { resolveQuestionByMessage });
  if (!intent.ok) return { ok: false, code: intent.reason, reason: intent.reason, routed: false, acknowledged: false };
  if (!intent.raw || intent.raw.kind !== 'callback') {
    // A TYPED reply. It is a legitimate answer, but not an index into a rendered
    // list, so matching the words to a candidate is a decision made downstream.
    return { ok: false, code: TAP_REFUSALS.NOT_A_TAP, reason: TAP_REFUSALS.NOT_A_TAP, routed: true, intent, acknowledged: false };
  }
  return { ...(await resolveTap(intent, rest)), routed: true, intent };
}

export default resolveTap;
