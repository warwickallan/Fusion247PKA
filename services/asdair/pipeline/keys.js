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
 * ── THE MACHINE LEDGER AND THE HUMAN LIST ARE TWO DIFFERENT THINGS ──────────
 *
 * Until migration 009 the pipeline kept its command / resume / outbox
 * bookkeeping in `asdair.pending_action`, namespaced `cmd:` and `msg:`. That
 * table is what the Cockpit and the Telegram status card surface to Warwick as
 * OUTSTANDING ACTIONS - so internal plumbing read as things HE had to do.
 * Filtering it out in the UI was explicitly rejected: that hides the symptom and
 * leaves the confusion in the data. So the two concepts now have two homes:
 *
 *   asdair.pipeline_command  the MACHINE ledger - commands, resume state, outbox
 *   asdair.pending_action    GENUINE HUMAN ACTIONS ONLY, e.g. "add Wall's to
 *                            ASDA Favourites"
 *
 * Nothing the pipeline does for its own bookkeeping writes to pending_action
 * ever again. store.js reads it in exactly one place (listHouseholdActions) and
 * writes it nowhere.
 *
 * ── THE LEGACY PREFIXES, KEPT ON PURPOSE ────────────────────────────────────
 * `cmd:` / `msg:` survive here as LEGACY MARKERS, for exactly two jobs:
 *
 *   1. migrate-command-ledger.js identifies the rows it must move.
 *   2. listHouseholdActions still filters them, so that between deploying this
 *      code and running the backfill Warwick is not shown plumbing that is
 *      already historical.
 *
 * NOTHING PRODUCES THEM ANY MORE. The two builders that used to mint a pipeline
 * row's pending_action action_type have been DELETED, not merely left unused:
 * there is no way left to spell one, which is what makes the separation
 * structural rather than a convention. invariants.test.js asserts their absence
 * over the source of every shipping module.
 */
export const LEGACY_COMMAND_PREFIX = 'cmd:';
export const LEGACY_OUTBOX_PREFIX = 'msg:';

/** PURE. True when an action_type is LEGACY pipeline plumbing rather than a
 *  household to-do. Only pre-migration rows can satisfy this. */
export function isPipelineActionType(actionType) {
  const t = String(actionType ?? '');
  return t.startsWith(LEGACY_COMMAND_PREFIX) || t.startsWith(LEGACY_OUTBOX_PREFIX);
}

/**
 * The two populations `asdair.pipeline_command.kind` distinguishes, matching
 * migration 009's `pipeline_command_kind_known` CHECK exactly.
 */
export const LEDGER_KINDS = Object.freeze({ COMMAND: 'command', OUTBOX: 'outbox' });

/** The statuses migration 009's `pipeline_command_status_known` CHECK allows. */
export const LEDGER_STATUSES = Object.freeze(['pending', 'running', 'done', 'failed', 'retired']);

/** A ledger row in one of these statuses can never be acted on again, so its
 *  generation is spent and the next issue of the same command mints a new one. */
export const LEDGER_TERMINAL_STATUSES = Object.freeze(['done', 'failed', 'retired']);

/**
 * The character that separates a ledger family from its generation.
 *
 * It must not occur inside any component of the family key, or the split would
 * be ambiguous and two different families could share an idempotency key. Every
 * component is checked (`requireKeyComponent`) rather than assumed: the
 * discriminators that reach here include NORMALISED item text and Telegram
 * source ids, and a key builder that silently accepted a stray separator would
 * merge two commands into one.
 */
export const GENERATION_SEPARATOR = '#';

function requireName(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`keys: ${label} is required (a non-empty string)`);
  }
  return value.trim();
}

function requireKeyComponent(value, label) {
  const v = requireName(value, label);
  if (v.includes(GENERATION_SEPARATOR)) {
    throw new Error(`keys: ${label} may not contain "${GENERATION_SEPARATOR}" - it separates a ledger family from its generation`);
  }
  return v;
}

/**
 * PURE. The FAMILY key for one logical unit of machine bookkeeping.
 *
 * "The same command" means the same kind, the same household, the same command
 * (or message kind) and the same action key. Everything that repeats - a
 * double-tapped button, a redelivered Telegram update, a second runner pass over
 * the same milestone - produces the same family key.
 *
 * It is stored verbatim on the row (`args.ledger_key`) as well as forming the
 * prefix of `idempotency_key`, so the family a row belongs to is readable
 * directly off the row and does not have to be reconstructed by parsing.
 */
export function ledgerFamilyKey({ kind, householdId, name, key }) {
  const k = requireKeyComponent(kind, 'ledger kind');
  if (!Object.values(LEDGER_KINDS).includes(k)) {
    throw new Error(`keys: ledger kind must be one of ${Object.values(LEDGER_KINDS).join(', ')}, got "${k}"`);
  }
  return [
    k,
    requireKeyComponent(String(householdId ?? ''), 'householdId'),
    requireKeyComponent(name, k === LEDGER_KINDS.OUTBOX ? 'message kind' : 'command name'),
    requireKeyComponent(key, 'action key'),
  ].join(':');
}

/**
 * PURE. The value written to `asdair.pipeline_command.idempotency_key`, which
 * carries migration 009's UNIQUE index and therefore IS the guarantee.
 *
 * ── WHY A GENERATION, AND WHY IT IS NOT A COUNTER ───────────────────────────
 * Migration 006's index was PARTIAL - unique on (household_id, action_type,
 * action_key) WHERE status = 'pending'. So a repeat while the command was
 * outstanding adopted it, and a repeat AFTER it had been consumed legitimately
 * started a new one. That second half is not a detail: "ask for the basket
 * again after a pause" and "retry a shop that failed twice" are the CONSUME
 * contract in commandNames.js, and a globally-unique key alone would silently
 * refuse both.
 *
 * Migration 009's index is TOTAL, so the generation restores the missing half.
 * It is NOT a counter and NOT a clock: it is derived from durable state - the
 * number of rows of this family that are already terminal - so two racing taps
 * compute the SAME key and the UNIQUE INDEX, not this code, decides which of
 * them wrote. See store.recordLedgerEntry for the full argument.
 */
export function ledgerIdempotencyKey(family, generation) {
  const g = Number(generation);
  if (!Number.isInteger(g) || g < 0) {
    throw new Error(`keys: ledger generation must be a non-negative integer, got ${String(generation)}`);
  }
  return `${requireName(family, 'ledger family key')}${GENERATION_SEPARATOR}${g}`;
}

/**
 * PURE. The idempotency key for one row CARRIED OVER from the legacy
 * pending_action ledger, keyed on the source row's own id.
 *
 * That is what makes the backfill re-runnable without a marker table or a
 * check-then-act: running it twice produces the same key twice, and the second
 * INSERT is refused by the same UNIQUE index that refuses a double tap. The
 * `legacy` prefix on the generation cannot collide with a minted integer
 * generation, so a migrated history never blocks a future issue of the command.
 */
export function legacyLedgerIdempotencyKey(family, pendingActionId) {
  const id = String(pendingActionId ?? '').trim();
  if (id === '' || !/^\d+$/.test(id)) {
    throw new Error(`keys: a legacy ledger key needs the numeric asdair.pending_action id, got "${String(pendingActionId)}"`);
  }
  return `${requireName(family, 'ledger family key')}${GENERATION_SEPARATOR}legacy${id}`;
}

/** PURE. Split an idempotency key back into its family and its generation. The
 *  exact inverse of the two builders above, so a test can prove the round trip. */
export function parseLedgerIdempotencyKey(idempotencyKey) {
  const s = requireName(idempotencyKey, 'idempotencyKey');
  const at = s.lastIndexOf(GENERATION_SEPARATOR);
  if (at <= 0 || at === s.length - 1) {
    throw new Error(`keys: "${s}" is not a ledger idempotency key (<family>${GENERATION_SEPARATOR}<generation>)`);
  }
  return { family: s.slice(0, at), generation: s.slice(at + 1) };
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
 *
 * ── CLARIFICATION ROUNDS (WP-B15-2) ────────────────────────────────────────
 * A clarification is a DIFFERENT question, so it needs a DIFFERENT key. The
 * round travels INSIDE THE HASH INPUT and never into the output, so every key
 * stays exactly 9 ASCII bytes whatever the round number.
 *
 * A textual suffix (`<key>#clarify.1`) was rejected on three independent
 * grounds, recorded here so it is not reintroduced:
 *   1. `#` is not in callbackProtocol's FIELD_RE ([A-Za-z0-9._-]), and
 *      buildCallbackData THROWS rather than truncating - the clarification card
 *      could not be rendered at all.
 *   2. 19 bytes against MAX_QUESTION_KEY_BYTES = 12.
 *   3. Even a legal `.c2` sits at EXACTLY 12 bytes with zero headroom, so the
 *      scheme survives rounds 2-9 and breaks at round 10. A scheme that fails
 *      at a round number is a latent defect, not a design.
 *
 * The key is opaque by design - it does not advertise that it is a
 * clarification. That job belongs to shop_question.parent_question_id and
 * question_round, which are readable, joinable and constrained (migration 017).
 *
 * ROUND 1 IS BYTE-FOR-BYTE UNCHANGED, AND THAT IS LOAD-BEARING. Three live
 * shops carry shop_question rows keyed by the original one-argument
 * derivation. Shifting a round-1 key by a single byte orphans every open
 * question and re-asks every settled one. The `r === 1` branch below therefore
 * returns the ORIGINAL expression - it does NOT hash `term + '#1'` - and
 * keys.test.js pins it against a literal digest held in the test.
 */
export function questionKeyFor(itemName, round = 1) {
  const term = normaliseTerm(itemName);
  if (term === '') {
    throw new Error('keys: questionKeyFor needs a non-empty item name - an unreadable line cannot be asked about by name');
  }
  const r = Number(round);
  if (!Number.isInteger(r) || r < 1) {
    throw new Error(`keys: questionKeyFor round must be an integer >= 1, got ${String(round)}`);
  }
  // THE ORIGINAL EXPRESSION, REACHED BY THE ORIGINAL CALL PATH. Do not
  // "simplify" this into the round-N form below by hashing `${term}#1`: that
  // produces a different digest and silently orphans three live shops.
  if (r === 1) return `q${digest(term, 4)}`;
  return `q${digest(`${term}#${r}`, 4)}`;
}

/**
 * PURE. The durable command key - the `key` half of a ledger family.
 *
 * Scoped by shop_ref because one household runs one shop per week: without the
 * ref, this week's "build the basket" would collide with last week's.
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
