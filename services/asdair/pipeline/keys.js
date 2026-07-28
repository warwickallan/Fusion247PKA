// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/keys.js
//
// EVERY KEY THE PIPELINE RELIES ON FOR IDEMPOTENCY, IN ONE PURE MODULE.
//
// Idempotency in this system is STRUCTURAL: the database refuses the second
// write because a unique index covers it. That only works if the key is
// derived DETERMINISTICALLY from the thing itself - never from a counter, a
// clock, a random value or the order things happened to be processed in.
//
//   * A redelivered Telegram message must produce the SAME shop key.
//   * A repeated button tap must produce the SAME command key.
//   * The same unresolved line, re-planned next run, must produce the SAME
//     question key - that is what stops a question being asked twice.
//
// PURE. No I/O, no clock, no randomness, no global state.
// =====================================================================

import { createHash } from 'node:crypto';

/**
 * The `action_type` prefixes this pipeline writes into asdair.pending_action.
 *
 * WHY pending_action AND NOT A NEW TABLE: migration 006 already gives us a
 * durable, household-scoped record with EXACTLY the idempotency we need -
 * `pending_action_key_uniq` is unique on (household_id, action_type, action_key)
 * WHERE status = 'pending'. So "record this command durably, and let a repeat of
 * the same command adopt the existing one" is one INSERT ... ON CONFLICT DO
 * NOTHING, decided by the database rather than by this code. Adding a table
 * would mean owning a migration in a folder this work package must not modify.
 *
 * The prefixes keep the three populations separable, because
 * shopStatus.outstanding_actions surfaces pending_action rows to a human as
 * "things that must never be forgotten":
 *
 *   cmd:<name>   a durable COMMAND awaiting the runner
 *   msg:<kind>   a durable OUTBOUND MESSAGE awaiting the sender (the outbox)
 *   (anything else) a genuine household to-do, e.g. 'add_favourite'
 *
 * `isPipelineActionType` exists so a surface (the cockpit, the status card) can
 * filter pipeline plumbing out of the human's outstanding-actions list.
 */
export const COMMAND_PREFIX = 'cmd:';
export const OUTBOX_PREFIX = 'msg:';

/** PURE. True when an action_type is pipeline plumbing rather than a household to-do. */
export function isPipelineActionType(actionType) {
  const t = String(actionType ?? '');
  return t.startsWith(COMMAND_PREFIX) || t.startsWith(OUTBOX_PREFIX);
}

/** PURE. The durable action_type for a command. */
export function commandActionType(name) {
  return `${COMMAND_PREFIX}${requireName(name, 'command name')}`;
}

/** PURE. The durable action_type for an outbound message. */
export function outboxActionType(kind) {
  return `${OUTBOX_PREFIX}${requireName(kind, 'message kind')}`;
}

function requireName(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`keys: ${label} is required (a non-empty string)`);
  }
  return value.trim();
}

/**
 * PURE. Lower-case, punctuation-flattened form of a term.
 *
 * Deliberately the SAME normalisation resolveByCatalogue.js and planner.js use,
 * so "the same line" means the same thing to the key builder, the resolver and
 * the planner. If they disagreed, a line could resolve to one product but hash
 * to two different question keys across runs - and the second run would re-ask
 * a question the human had already answered.
 */
export function normaliseTerm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** PURE. A short, stable, hex digest of any string. */
export function digest(text, bytes = 4) {
  return createHash('sha1').update(String(text ?? ''), 'utf8').digest('hex').slice(0, bytes * 2);
}

/**
 * The byte budget a question key must fit, imported in spirit from
 * services/asdair/bot/callbackProtocol.js (MAX_QUESTION_KEY_BYTES = 12).
 *
 * The callback wire format NEVER truncates - it throws - so a question key that
 * is too long is a rendered card that cannot be built at all. Deriving the key
 * to a fixed 9 ASCII bytes makes that structurally impossible rather than
 * unlikely, and `assertQuestionKeyFits` proves it against the protocol's own
 * constant at test time.
 */
export const QUESTION_KEY_BYTES = 9;

/**
 * PURE. The stable key for one genuinely-unresolved line of one shop.
 *
 * Derived from the NORMALISED line text, never from its position in the list.
 * A list re-read in a different order, or with a line inserted above it, still
 * produces the same key for the same item - so `openQuestion`'s
 * ON CONFLICT (shop_id, question_key) recognises it and does not re-ask.
 *
 * The shop is NOT part of the key: (shop_id, question_key) is already the
 * unique index, so scoping is the database's job and spending bytes on it here
 * would only shrink the room left for the line itself.
 *
 * Shape: `q` + 8 hex characters = 9 ASCII bytes, which satisfies the protocol's
 * charset ([A-Za-z0-9._-]) and leaves room for `.<candidateIndex>` inside the
 * 16-byte callback arg budget.
 */
export function questionKeyFor(itemName) {
  const term = normaliseTerm(itemName);
  if (term === '') {
    throw new Error('keys: questionKeyFor needs a non-empty item name - an unreadable line cannot be asked about by name');
  }
  return `q${digest(term, 4)}`;
}

/**
 * PURE. The durable command key.
 *
 * Scoped by shop_ref because the unique index is (household_id, action_type,
 * action_key) and one household runs one shop per week: without the ref, this
 * week's "build the basket" would collide with last week's.
 *
 * `discriminator` is for commands that can legitimately be outstanding more than
 * once at a time for one shop - correcting two different lines, or answering two
 * different questions. Commands without one are one-per-shop-at-a-time by
 * construction, which is exactly what makes a double-tapped button a no-op.
 */
export function commandKeyFor(shopRef, discriminator = null) {
  const ref = requireName(shopRef, 'shopRef');
  if (discriminator === null || discriminator === undefined || discriminator === '') return ref;
  return `${ref}:${String(discriminator)}`;
}

/**
 * PURE. The outbox key for one message.
 *
 * A milestone message is queued AT MOST ONCE while it is unsent: the key is the
 * milestone, not the moment. Two runner passes over the same shop therefore
 * cannot put the same card on Warwick's phone twice.
 */
export function outboxKeyFor(shopRef, discriminator = null) {
  return commandKeyFor(shopRef, discriminator);
}

/**
 * PURE. The idempotency key for one emitted list-item intent.
 *
 * Deliberately the SAME shape services/hub/shopper/shopperRoute.mjs produces
 * (`shop:<sourceId>-<n>`), so an intent this pipeline builds for the grounded
 * photo path and an intent shopperRoute builds for the text path are
 * indistinguishable downstream.
 */
export function intentKeyFor(sourceId, index) {
  return `shop:${requireName(sourceId, 'sourceId')}-${Number(index)}`;
}

/**
 * PURE. The `sourceId` for a shop, used to scope intent idempotency keys.
 *
 * When the shop arrived from Telegram this is EXACTLY
 * shopperIntake.buildSourceId's value, so the receiver and the pipeline agree.
 * A shop with no inbound message (a cockpit-created one) falls back to its ref,
 * which is unique per household and stable across runs.
 */
export function sourceIdFor(shop) {
  const chatId = shop && shop.telegram_chat_id;
  const messageId = shop && shop.telegram_message_id;
  if (chatId !== null && chatId !== undefined && chatId !== ''
    && messageId !== null && messageId !== undefined && messageId !== '') {
    return `tg:shopper:chat:${chatId}:msg:${messageId}`;
  }
  return `asdair:shop:${requireName(shop && shop.shop_ref, 'shop.shop_ref')}`;
}
