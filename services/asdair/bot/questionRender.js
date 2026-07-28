// =====================================================================
// BUILD-015 AsdAIr — bot: questionRender.js
//
// THE RENDER CONTRACT. What was DISPLAYED, recorded before it can be tapped.
//
// ── WHY THIS MODULE HAS TO EXIST ─────────────────────────────────────────────
// A question card's buttons carry a candidate INDEX, not a product id. That is
// not laziness — it is the only way the payload provably fits Telegram's 64-byte
// callback_data ceiling (callbackProtocol.js sets out the arithmetic). An ASDA
// product id is unbounded; an index is one to three digits.
//
// The consequence is absolute: **an index is meaningless except against the
// exact list that was displayed.** If the candidates for a question are ever
// recomputed in a different order — a fresh catalogue search, a re-ranked match,
// a candidate that has since gone out of stock and dropped out — then button #2
// on the card still in Warwick's scrollback now points at a DIFFERENT PRODUCT.
// Nothing would error. The wrong thing would simply be added to the basket, and
// nobody would find out until it arrived.
//
// So the ordered list is persisted at render time, and the index is resolved
// against THAT stored list, never against a freshly computed one. This module
// writes the contract; resolveTap.js is the only thing that reads it back.
//
// ── ONE FUNCTION PRODUCES BOTH THE CARD AND THE CONTRACT ─────────────────────
// prepareQuestionCard() calls renderMessages.renderQuestionCard() and builds the
// contract from the SAME sliced, ordered array. They cannot drift, because there
// is no second list to drift from. (renderQuestionCard caps the card at
// MAX_CANDIDATE_BUTTONS; if the contract were built from the uncapped input the
// two would disagree the moment a question had nine candidates.)
//
// ── EVERY CANDIDATE MUST CARRY AN ID ─────────────────────────────────────────
// A bare string candidate is refused here, even though renderQuestionCard
// happily renders one. A string is a LABEL, and two ASDA products can share a
// label ("Semi Skimmed Milk 2 Pints"). Resolving a tap to a label would
// reintroduce, one layer down, exactly the ambiguity this module exists to
// remove. Fail closed: no id, no card.
//
// ── A RE-RENDER MUST BE A NEW CARD ───────────────────────────────────────────
// asdair.shop_question holds ONE contract per (shop, question_key): the CURRENT
// render. Staleness is therefore detected by card identity — a tap whose
// (chat_id, message_id) is not the recorded card is a tap on a superseded
// render, and resolveTap refuses it.
//
// That detection only works if a new render gets a new message_id. So
// persistQuestionRender() THROWS if asked to bind a changed candidate ordering
// to a message_id an earlier version already used. Editing a question card's
// candidates in place would leave the old buttons live, addressing the new list,
// with no signal that anything had changed — the precise silent-misresolution
// this build exists to stop. Re-render = new card. Always.
//
// ── NO I/O OF ITS OWN ────────────────────────────────────────────────────────
// No database connection is opened here. Persistence is an INJECTED `store`
// (see the Store contract below) and the Telegram send is an INJECTED `sender`
// from sendShopperMessage.js. The only impure thing this module reaches for is
// node:crypto, to hash the contract.
// =====================================================================

import { createHash } from 'node:crypto';
import { MAX_CANDIDATE_BUTTONS, labelFor, renderQuestionCard } from './renderMessages.js';
import { assertQuestionKey, assertShopRef } from './callbackProtocol.js';

/**
 * Domain separator baked into every fingerprint. Changing it invalidates every
 * stored fingerprint by design — so it is versioned, and a bump is a migration.
 */
export const FINGERPRINT_DOMAIN = 'asdair.shop_question.render/v1';

/** The hash. Hex-encoded sha256; asdair.shop_question.render_fingerprint is text. */
export const FINGERPRINT_ALGORITHM = 'sha256';

/** The version a question's first render is recorded at. Matches the column default. */
export const FIRST_RENDER_VERSION = 1;

/**
 * PURE. The EXACT fingerprint definition.
 *
 *   sha256_hex( JSON.stringify([ FINGERPRINT_DOMAIN,
 *                                question_key,
 *                                render_version,
 *                                [candidate_id_0, …, candidate_id_n] ]) )
 *
 * Three properties earn the JSON tuple over a delimiter-joined string:
 *  1. INJECTION-PROOF. JSON escapes every field, so a candidate id containing a
 *     separator cannot forge an extra element and collide with a different list.
 *  2. ORDER-SENSITIVE. The ids are an array, not a set. Reordering the SAME
 *     candidates changes the fingerprint — which is the entire point, because a
 *     reorder is exactly what silently repoints an index at another product.
 *  3. VERSION-BOUND. render_version is inside the hash, so version N and version
 *     N+1 of an identical list still fingerprint differently and a contract
 *     cannot be replayed across versions.
 *
 * Deliberately NOT in the hash: chat id and message id. The fingerprint seals
 * WHAT WAS DISPLAYED; WHERE it was displayed is checked separately, by exact
 * (card_chat_id, card_message_id) match. Keeping them apart means the
 * fingerprint can be computed before the card is sent — i.e. before a message id
 * exists — and lets a caller pin an expected fingerprint into a downstream job.
 */
export function renderFingerprint({ questionKey, candidateIds, renderVersion } = {}) {
  if (typeof questionKey !== 'string' || questionKey.length === 0) {
    throw new Error('renderFingerprint: questionKey required');
  }
  if (!Array.isArray(candidateIds)) {
    throw new Error('renderFingerprint: candidateIds must be an array (order is significant)');
  }
  for (const id of candidateIds) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('renderFingerprint: every candidate id must be a non-empty string');
    }
  }
  if (!Number.isInteger(renderVersion) || renderVersion < 1) {
    throw new Error(`renderFingerprint: renderVersion must be an integer >= 1, got ${renderVersion}`);
  }
  const canonical = JSON.stringify([FINGERPRINT_DOMAIN, questionKey, renderVersion, candidateIds]);
  return createHash(FINGERPRINT_ALGORITHM).update(canonical, 'utf8').digest('hex');
}

/**
 * PURE. The stable id of one candidate. FAILS CLOSED.
 *
 * Accepts `{ id }`, `{ productId }` or `{ product_id }`. A bare string is
 * REFUSED: renderQuestionCard treats a string as a label, and a label is not an
 * identity — two products can share one. Silently promoting a label to an id
 * would put the wrong product in the basket exactly as often as a reorder would.
 */
export function candidateIdOf(candidate, index) {
  const where = `candidate #${index}`;
  if (typeof candidate === 'string') {
    throw new Error(
      `questionRender: ${where} is a bare string. A candidate on a persisted render must carry an id ({ id, label }) — a label is not an identity, and resolving a tapped index to a label would put the wrong product in the basket`,
    );
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`questionRender: ${where} must be an object with an id`);
  }
  const raw = candidate.id ?? candidate.productId ?? candidate.product_id;
  if (raw === undefined || raw === null) {
    throw new Error(`questionRender: ${where} has no id (expected { id } / { productId } / { product_id })`);
  }
  const id = String(raw).trim();
  if (id.length === 0) throw new Error(`questionRender: ${where} has an empty id`);
  return id;
}

/**
 * PURE. The ordered candidate ids of a rendered list, in DISPLAY order.
 * `list` must already be the displayed (sliced) array.
 */
export function candidateIds(list) {
  return list.map((c, i) => candidateIdOf(c, i));
}

/**
 * PURE. Normalise one displayed candidate into the row stored in
 * asdair.shop_question.rendered_candidates. Deliberately small: the id (the only
 * load-bearing field), the label that was actually shown, and the index the
 * button carries. Anything else belongs on `products`, not in a render receipt.
 */
function renderedRow(candidate, index) {
  return {
    index,
    id: candidateIdOf(candidate, index),
    label: labelFor(candidate && candidate.label),
  };
}

/**
 * PURE. Build the card AND its render contract from one list, so the buttons and
 * the stored order cannot disagree.
 *
 * @param {{shopRef:string, questionKey:string, item?:string, note?:string,
 *          candidates?:Array<{id?:any, productId?:any, product_id?:any, label?:string}>,
 *          renderVersion?:number}} spec
 * @returns {{message:{text:string, reply_markup:object},
 *            contract:{shopRef:string, questionKey:string, renderVersion:number,
 *                      renderedCandidates:Array<{index:number,id:string,label:string}>,
 *                      candidateIds:string[], renderFingerprint:string}}}
 */
export function prepareQuestionCard({
  shopRef, questionKey, item, note, candidates = [], renderVersion = FIRST_RENDER_VERSION,
} = {}) {
  assertShopRef(shopRef);
  assertQuestionKey(questionKey);
  if (!Number.isInteger(renderVersion) || renderVersion < 1) {
    throw new Error(`prepareQuestionCard: renderVersion must be an integer >= 1, got ${renderVersion}`);
  }
  if (!Array.isArray(candidates)) throw new Error('prepareQuestionCard: candidates must be an array');

  // THE displayed list. renderQuestionCard applies the same slice internally, so
  // taking it here is what keeps the buttons and the contract in lockstep.
  const displayed = candidates.slice(0, MAX_CANDIDATE_BUTTONS);
  const renderedCandidates = displayed.map(renderedRow);
  const ids = renderedCandidates.map((r) => r.id);

  const message = renderQuestionCard({ shopRef, questionKey, item, note, candidates: displayed });

  return {
    message,
    contract: {
      shopRef,
      questionKey,
      renderVersion,
      renderedCandidates,
      candidateIds: ids,
      renderFingerprint: renderFingerprint({ questionKey, candidateIds: ids, renderVersion }),
    },
  };
}

/**
 * PURE. Recompute a stored contract's fingerprint and compare it to the stored
 * one. Catches a row whose rendered_candidates were edited without the
 * fingerprint being recomputed — i.e. a contract that no longer describes what
 * was displayed. Returns a structured result; the caller refuses on `ok:false`.
 *
 * @param {{question_key:string, render_version:number, rendered_candidates:Array,
 *          render_fingerprint:string}} row an asdair.shop_question row
 */
export function verifyStoredContract(row) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'no stored render contract' };
  const questionKey = row.question_key;
  const version = row.render_version;
  const stored = row.render_fingerprint;
  const list = row.rendered_candidates;
  if (typeof questionKey !== 'string' || questionKey.length === 0) {
    return { ok: false, reason: 'stored contract has no question_key' };
  }
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'stored contract has no usable render_version' };
  }
  if (!Array.isArray(list)) {
    return { ok: false, reason: 'stored contract has no rendered_candidates array' };
  }
  if (typeof stored !== 'string' || stored.length === 0) {
    // A card was sent without its contract being sealed. Fail closed: this is
    // indistinguishable from a contract that was tampered with.
    return { ok: false, reason: 'stored contract has no render_fingerprint' };
  }
  let ids;
  try {
    ids = list.map((c, i) => candidateIdOf(c, i));
  } catch (err) {
    return { ok: false, reason: `stored contract has an unidentifiable candidate: ${err.message}` };
  }
  const recomputed = renderFingerprint({ questionKey, candidateIds: ids, renderVersion: version });
  if (recomputed !== stored) {
    return { ok: false, reason: 'stored render_fingerprint does not match rendered_candidates', recomputed };
  }
  return { ok: true, fingerprint: recomputed, candidateIds: ids };
}

/**
 * PURE. Which version the NEXT render of this question should be recorded at.
 * First render is 1; every subsequent card bumps. A card is never re-numbered
 * downwards, so a fingerprint from an old version can never be re-minted.
 */
export function nextRenderVersion(previousRow) {
  const previous = previousRow && Number.isInteger(previousRow.render_version)
    ? previousRow.render_version
    : 0;
  return Math.max(previous, 0) + 1;
}

// ── the Store contract ───────────────────────────────────────────────────────
//
// Injected, never constructed here. Four methods, all async. Rows come back in
// the DATABASE's own shape (snake_case columns of asdair.shop_question, plus a
// joined `shop_ref`), because reading them leniently is how a misread starts.
//
//   getQuestionByCard({ chatId, messageId })       -> row | null
//   getQuestionByKey({ shopRef, questionKey })     -> row | null
//   saveRender({ shopRef, questionKey, chatId, messageId,
//                renderedCandidates, renderFingerprint, renderVersion })
//                                                  -> row
//   recordAnswer({ questionId, answerText, answerSource, callbackIndex, answeredAt })
//                                                  -> { applied:boolean, question:row }
//
// recordAnswer MUST be a compare-and-set against status='open' — see resolveTap.js
// and the README. The SQL is in the README so it is written once, correctly.

function assertStore(store, methods) {
  if (!store || typeof store !== 'object') throw new Error('questionRender: a store must be injected');
  for (const m of methods) {
    if (typeof store[m] !== 'function') throw new Error(`questionRender: store.${m}() is required`);
  }
  return store;
}

/**
 * Persist a render contract against a SENT card.
 *
 * THE LOAD-BEARING RULE: a changed candidate ordering may never be bound to a
 * message id an earlier version already used. Doing so would leave the old
 * buttons live and addressing the new list, with nothing to detect it — the
 * silent misresolution this whole module exists to prevent. Re-render = new card.
 *
 * Re-persisting the SAME message with the SAME ordered ids is idempotent: the
 * existing row is returned unchanged and the version is NOT bumped, so a retried
 * send after a flaky ack does not inflate the version or rewrite the contract.
 *
 * @param {{store:object, contract:object, chatId:any, messageId:any, previous?:object|null}} args
 * @returns {Promise<{row:object, version:number, fingerprint:string, unchanged:boolean}>}
 */
export async function persistQuestionRender({ store, contract, chatId, messageId, previous } = {}) {
  assertStore(store, ['getQuestionByKey', 'saveRender']);
  if (!contract || typeof contract !== 'object') throw new Error('persistQuestionRender: contract required');
  if (chatId === undefined || chatId === null || chatId === '') throw new Error('persistQuestionRender: chatId required');
  if (messageId === undefined || messageId === null) throw new Error('persistQuestionRender: messageId required');

  const { shopRef, questionKey } = contract;
  assertShopRef(shopRef);
  assertQuestionKey(questionKey);

  const prior = previous !== undefined
    ? previous
    : await store.getQuestionByKey({ shopRef, questionKey });

  if (prior) {
    const sameCard = String(prior.card_message_id) === String(messageId)
      && String(prior.card_chat_id) === String(chatId);
    const priorIds = Array.isArray(prior.rendered_candidates)
      ? prior.rendered_candidates.map((c) => (c && c.id !== undefined ? String(c.id) : ''))
      : [];
    const sameOrder = priorIds.length === contract.candidateIds.length
      && priorIds.every((id, i) => id === contract.candidateIds[i]);

    if (sameCard && sameOrder) {
      // A retried send of the identical card. Nothing to rewrite.
      return {
        row: prior,
        version: prior.render_version,
        fingerprint: prior.render_fingerprint,
        unchanged: true,
      };
    }
    if (sameCard && !sameOrder) {
      throw new Error(
        `persistQuestionRender: refusing to rebind question "${questionKey}" to the SAME card (chat ${String(chatId)}, message ${String(messageId)}) with a DIFFERENT candidate order. The buttons already on that card carry indexes into the old list; rewriting the contract under them would silently resolve them to different products. Send a NEW card for a re-render.`,
      );
    }
    if (prior.status === 'answered') {
      throw new Error(
        `persistQuestionRender: question "${questionKey}" is already answered — re-rendering it would reopen a settled decision. Ask a new question key instead.`,
      );
    }
  }

  const row = await store.saveRender({
    shopRef,
    questionKey,
    chatId,
    messageId,
    renderedCandidates: contract.renderedCandidates,
    renderFingerprint: contract.renderFingerprint,
    renderVersion: contract.renderVersion,
  });

  return {
    row,
    version: contract.renderVersion,
    fingerprint: contract.renderFingerprint,
    unchanged: false,
  };
}

/**
 * Render a question card, put it on the wire, and seal its render contract.
 *
 * ORDER MATTERS, AND THE ORDER IS SEND-THEN-PERSIST — because the contract keys
 * on a message id that does not exist until Telegram allocates it. The failure
 * window is therefore "a card exists with no contract", and that direction is
 * SAFE: resolveTap refuses a tap it has no contract for. The dangerous direction
 * — a contract that does not describe the live card — is unreachable.
 *
 * If the persist fails, the card is edited to say so (best effort) so Warwick is
 * not left tapping a button that will only ever refuse, and the error is
 * re-thrown for the pipeline to handle.
 *
 * @param {{sender:object, store:object, chatId:any, renderVersion?:number}} deps
 *        plus the prepareQuestionCard spec.
 */
export async function sendQuestionCard({
  sender, store, chatId, shopRef, questionKey, item, note, candidates = [], renderVersion,
} = {}) {
  assertStore(store, ['getQuestionByKey', 'saveRender']);
  if (!sender || typeof sender.sendMessage !== 'function') {
    throw new Error('sendQuestionCard: a sender with sendMessage() must be injected');
  }
  if (chatId === undefined || chatId === null || chatId === '') throw new Error('sendQuestionCard: chatId required');

  const previous = await store.getQuestionByKey({ shopRef, questionKey });
  const version = Number.isInteger(renderVersion) ? renderVersion : nextRenderVersion(previous);
  const { message, contract } = prepareQuestionCard({
    shopRef, questionKey, item, note, candidates, renderVersion: version,
  });

  const sent = await sender.sendMessage(chatId, message);
  const messageId = sent && sent.message_id !== undefined ? sent.message_id : null;
  if (messageId === null) {
    throw new Error('sendQuestionCard: Telegram returned no message_id — the render contract cannot be bound to a card');
  }

  let persisted;
  try {
    persisted = await persistQuestionRender({ store, contract, chatId, messageId, previous });
  } catch (err) {
    // Best effort: neutralise a card whose contract could not be sealed. Every
    // tap on it would refuse anyway; say so rather than leaving it looking live.
    if (typeof sender.editMessageText === 'function') {
      try {
        await sender.editMessageText(chatId, messageId, {
          text: 'This question card could not be recorded and is not usable. Nothing was changed. Ask for it again.',
          reply_markup: { inline_keyboard: [] },
        });
      } catch { /* the original failure is the one that matters */ }
    }
    throw err;
  }

  return { message, contract, messageId, chatId, ...persisted };
}

/**
 * The reverse lookup inboundRouter.js wants for a TYPED reply, backed by the
 * same render contract the buttons use — so a tap and a typed reply correlate
 * through one source of truth rather than two that can disagree.
 *
 * inboundRouter calls the lookup SYNCHRONOUSLY, so this builds the function over
 * a snapshot of rows the caller has already loaded — which also keeps the choice
 * of when to read the database with whoever owns the connection.
 *
 * @param {Array<{card_chat_id:any, card_message_id:any, question_key:string, shop_ref?:string}>} rows
 */
export function questionLookupFrom(rows = []) {
  const byCard = new Map();
  for (const row of rows) {
    if (!row || row.card_message_id === undefined || row.card_message_id === null) continue;
    byCard.set(`${String(row.card_chat_id)}#${String(row.card_message_id)}`, {
      questionKey: row.question_key,
      shopRef: row.shop_ref ?? null,
    });
  }
  return function resolveQuestionByMessage(chatId, messageId) {
    return byCard.get(`${String(chatId)}#${String(messageId)}`) ?? null;
  };
}

export default prepareQuestionCard;
