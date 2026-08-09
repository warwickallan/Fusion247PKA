// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/commands.js
//
// THE CHANNEL-NEUTRAL COMMAND SURFACE. The ONE way anything asks AsdAIr to do
// something - Telegram, the Cockpit, a CLI, a future voice surface. There is no
// second door.
//
// ── WHY THIS MATTERS MORE THAN IT LOOKS ─────────────────────────────────────
// The failure this exists to prevent is two surfaces holding two truths: a
// question answered on the phone that the Cockpit still shows as open, a shop
// cancelled in the browser that Telegram still offers to build. That cannot
// happen here, because an answer from Telegram and an answer from the Cockpit
// are LITERALLY THE SAME CALL, writing the same row, under the same unique
// index. Neither channel contains a gram of its own logic; each turns a tap
// into a call and renders whatever comes back.
//
// ── EVERY COMMAND DOES EXACTLY TWO THINGS ───────────────────────────────────
//   1. RECORDS THE INTENT DURABLY, idempotently, in one row.
//   2. Performs ONLY the single atomic durable write that IS that intent -
//      creating the shop, or settling a question. Nothing else.
//
// NO COMMAND ADVANCES THE STATE MACHINE. Advancing is runPipeline's job, and
// only runPipeline's, because that is what keeps multi-stage work out of a
// callback handler and out of an HTTP request. A button tap must never be
// holding a database transaction open while a model reads a photograph.
//
// ── WHAT NO COMMAND CAN DO ──────────────────────────────────────────────────
// Book a slot, check out, pay, enter a password, or auto-substitute a product.
// The surface is an ALLOWLIST (commandNames.js): a name that is not on it
// throws before anything is written. Warwick checks out himself, in his own
// browser session, and tells AsdAIr afterwards.
//
// ── CREDENTIALS ─────────────────────────────────────────────────────────────
// This module opens no connection and reads no credentials file. Everything it
// touches arrives through the injected `deps` (see deps.js), which knows env
// var NAMES only.
// =====================================================================

import { COMMANDS, COMMAND_SPECS, assertCommandName } from './commandNames.js';
import { commandKeyFor, questionKeyFor, sourceIdFor, normaliseTerm } from './keys.js';
import * as store from './store.js';

const SOURCE_KINDS = ['text', 'photo'];

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`commands: ${label} is required (a non-empty string)`);
  }
  return value.trim();
}

/**
 * The actor is recorded on every command, always.
 *
 * A durable intent whose author is unknown is not auditable: "who cancelled the
 * shop?" must be answerable a month later from the row alone. `telegram:<id>`
 * (what inboundRouter.js produces) and `cockpit:<user>` are the two real shapes;
 * anything non-empty is accepted, nothing is invented.
 */
function requireActor(actor) {
  return requireText(actor, 'actor (e.g. "telegram:123456" or "cockpit:warwick")');
}

/**
 * Every answer_source this command surface accepts (WP-B15-A1).
 *
 * ── PINNED, NOT DERIVED ─────────────────────────────────────────────────────
 * Held as a literal HERE rather than imported from shop/shopState.js, and a test
 * in commands.test.js asserts the two lists are identical. Importing it would
 * make this check pass automatically whenever the database vocabulary widened -
 * a control that can never disagree with the thing it checks is not a control.
 */
export const ACCEPTED_ANSWER_SOURCES = Object.freeze(['button', 'typed']);

/**
 * WHAT KIND OF ANSWER IS THIS, AND NEVER A GUESS.
 *
 * ── THE DEFECT THIS REPLACES ────────────────────────────────────────────────
 * This used to be `spec.answerSource === 'typed' ? 'typed' : 'button'`. Every
 * unrecognised value - a typo, a new source someone forgot to add, `'sms'`,
 * `'voice'` - was silently relabelled `button`. shopState validates
 * answer_source against ANSWER_SOURCES, but that check runs AFTER this line, so
 * it never saw the bad value: the coercion had already made it legal. The row
 * then said a human tapped a button when a human had typed a sentence, and
 * `interpreted_by` downstream inherited the lie. Provenance that quietly
 * corrects itself is worse than provenance that fails.
 *
 * ── UNDEFINED STILL MEANS 'button', DELIBERATELY ────────────────────────────
 * Absent is not the same as wrong. A tap has always omitted the field and every
 * current producer relies on that default; throwing on absence would break
 * callers outside this change for no provenance gain, because an absent source
 * asserts nothing false. What is rejected is a value that is PRESENT and not
 * recognised - the case that actually mislabels a row.
 */
function requireAnswerSource(value) {
  if (value === undefined || value === null || value === '') return 'button';
  if (typeof value !== 'string' || !ACCEPTED_ANSWER_SOURCES.includes(value)) {
    throw new Error(
      `commands: unrecognised answerSource ${JSON.stringify(value)} - `
      + `expected one of ${ACCEPTED_ANSWER_SOURCES.join(', ')}. `
      + 'Refusing rather than relabelling it, because a wrong answer_source is a false provenance record.',
    );
  }
  return value;
}

/** The uniform shape every command returns. */
function receipt(command, shop, recorded, effect = {}) {
  return {
    ok: true,
    command,
    shop_id: shop ? shop.id : null,
    shop_ref: shop ? shop.shop_ref : null,
    household_id: shop ? shop.household_id : null,
    status: shop ? shop.status : null,
    recorded: recorded
      ? { action_id: recorded.id, created: recorded.created, resumed: recorded.resumed }
      : null,
    // TRUE when this exact command was already outstanding. The caller SHOULD
    // say so out loud ("already asked for") rather than pretend it just
    // happened - a silent no-op looks like a bug to the person tapping.
    duplicate: recorded ? recorded.created === false : false,
    ...effect,
  };
}

/**
 * Record one command durably. Shared by every command below so the key
 * derivation, the allowlist check and the provenance stamp cannot drift.
 */
async function record(deps, { command, shop, discriminator = null, payload = {}, actor }) {
  assertCommandName(command);
  const spec = COMMAND_SPECS[command];
  if (!spec.durable) throw new Error(`commands: ${command} is a read command and records nothing`);
  return store.recordCommand(deps, {
    householdId: shop.household_id,
    shopId: shop.id,
    command,
    key: commandKeyFor(shop.shop_ref, discriminator),
    payload: { ...payload, actor, shop_ref: shop.shop_ref, command },
  });
}

// =====================================================================
// 1. receiveList - the week's list arrives
// =====================================================================
/**
 * Create or RESUME the week's shop from an inbound list.
 *
 * IDEMPOTENT ON THE MESSAGE, NOT THE DELIVERY. shopStore.createOrResumeShop is
 * INSERT ... ON CONFLICT DO NOTHING against BOTH of migration 006's unique
 * indexes - (telegram_chat_id, telegram_message_id) and (household_id,
 * shop_ref) - followed by a re-select. A Telegram redelivery of the same
 * message therefore RESUMES the existing week and writes nothing at all, and
 * the caller is told which key matched so it can say so rather than pretend the
 * message created it.
 *
 * The raw evidence (the typed text, or the path to the downloaded photograph)
 * is retained unconditionally. There is no option here that discards it.
 *
 * @param {{householdId:*, shopRef?:string, listDate?:string, sourceKind:'text'|'photo',
 *          actor:string, rawText?:string, rawMediaPath?:string,
 *          telegramChatId?:string, telegramMessageId?:string, telegramUpdateId?:string,
 *          sourceId?:string}} spec
 */
export async function receiveList(spec, deps) {
  const {
    householdId, shopRef, listDate, sourceKind, rawText, rawMediaPath,
    telegramChatId = null, telegramMessageId = null, telegramUpdateId = null,
  } = spec || {};
  const actor = requireActor(spec && spec.actor);

  if (!SOURCE_KINDS.includes(sourceKind)) {
    throw new Error(`commands: receiveList sourceKind must be one of ${SOURCE_KINDS.join(', ')}`);
  }
  const ref = shopRef || deps.shopState.nextShopRef(requireText(listDate, 'shopRef or listDate'));

  const created = await deps.shopStore.createOrResumeShop({
    household_id: householdId,
    shop_ref: ref,
    source_kind: sourceKind,
    telegram_chat_id: telegramChatId,
    telegram_message_id: telegramMessageId,
    telegram_update_id: telegramUpdateId,
    raw_text: rawText ?? null,
    raw_media_path: rawMediaPath ?? null,
    // A list that had to be READ rather than typed is flagged at the one moment
    // it can be: creation. There is no writer for needs_review afterwards -
    // shopStore's UPDATE allowlist is (status, last_error, list_id) precisely so
    // progressing a shop can never rewrite what arrived.
    needs_review: spec.needsReview === true,
  });

  const shop = created.shop;
  const sourceId = spec.sourceId || sourceIdFor(shop);

  // ── THE EXACT-SOURCE IMAGE BINDING (WP-B15-1 invariant C) ─────────────────
  // The content hash intake computed from the exact downloaded bytes, persisted
  // beside the shop INSIDE the same durability-before-ack boundary (receiveList
  // runs inside intake's onRecord, before the Telegram offset moves). The
  // PRIMARY KEY makes this first-write-wins: a redelivery RESUMES the shop and
  // adopts the original binding, never overwrites it. A photo shop with no
  // fingerprint (pre-fingerprinting intake, or a non-Telegram entry path)
  // simply gets no row - the confirmation card renders that absence honestly
  // rather than this code inventing a value.
  if (sourceKind === 'photo' && typeof spec.imageFingerprint === 'string' && spec.imageFingerprint.length > 0) {
    await store.recordSourceImage(deps, {
      shopId: shop.id,
      fingerprint: spec.imageFingerprint,
      algo: 'sha256',
      byteLength: Number.isFinite(Number(spec.imageByteLength)) ? Number(spec.imageByteLength) : null,
      capturedAt: spec.receivedAt ?? null,
    });
  }

  // The receive itself is a LATCH: it is a permanent fact about this shop, kept
  // so "where did this week come from, and who sent it?" is answerable later.
  const recorded = await record(deps, {
    command: COMMANDS.RECEIVE_LIST,
    shop,
    discriminator: sourceId,
    actor,
    payload: { source_kind: sourceKind, source_id: sourceId, matched_by: created.matched_by },
  });

  return receipt(COMMANDS.RECEIVE_LIST, shop, recorded, {
    created: created.created,
    resumed: created.resumed,
    matched_by: created.matched_by,
    source_id: sourceId,
    // A redelivery is a duplicate of the MESSAGE even when the command row is new.
    duplicate: created.created === false,
  });
}

// =====================================================================
// 2. interpretList - read the list against the household catalogue
// =====================================================================
/**
 * Ask for the list to be interpreted. Records intent only.
 *
 * The interpretation itself - loading the catalogue, then the ONE grounded
 * model call, then resolving identity from our own rows - happens in
 * runPipeline, off the request path. A vision call inside a Telegram callback
 * handler would hold the tap open for seconds and lose the whole shop if the
 * process restarted mid-flight.
 */
export async function interpretList(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, { command: COMMANDS.INTERPRET_LIST, shop, actor });
  return receipt(COMMANDS.INTERPRET_LIST, shop, recorded);
}

// =====================================================================
// 3. confirmInterpretation - a human says "yes, that is my list"
// =====================================================================
/**
 * The explicit human approval of a list AsdAIr had to review.
 *
 * A LATCH, not a queue entry: once issued it stays true for this shop, so the
 * runner consuming it cannot re-close the gate and park the shop forever
 * waiting for an approval it already has.
 */
export async function confirmInterpretation(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, {
    command: COMMANDS.CONFIRM_INTERPRETATION, shop, actor,
    payload: { note: (spec && spec.note) || null },
  });
  return receipt(COMMANDS.CONFIRM_INTERPRETATION, shop, recorded);
}

// =====================================================================
// 4. correctLine - "no, that line is two pints not one"
// =====================================================================
/**
 * A correction is a NEW DURABLE INTENT against the same list, exactly as
 * services/hub/shopper/shopperRoute.mjs intends - never an edit smuggled in
 * from a chat message, and never a deletion of what originally arrived.
 *
 * The key carries the NORMALISED line, so correcting the same line twice while
 * the first correction is still outstanding adopts it rather than stacking two
 * contradictory instructions.
 */
export async function correctLine(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const itemName = requireText(spec && spec.itemName, 'itemName');
  const status = spec.status === 'needs_decision' ? 'needs_decision' : 'requested';

  let qty = spec.requestedQty;
  if (qty !== undefined && qty !== null) {
    qty = Number(qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error('commands: correctLine requestedQty must be null or an integer 1..99');
    }
  } else {
    qty = null;
  }

  const recorded = await record(deps, {
    command: COMMANDS.CORRECT_LINE, shop, actor,
    discriminator: normaliseTerm(itemName),
    payload: { item_name: itemName, requested_qty: qty, status, note: spec.note ?? null },
  });
  return receipt(COMMANDS.CORRECT_LINE, shop, recorded, { item_name: itemName });
}

// =====================================================================
// 5. buildShop - "Build this shop"
// =====================================================================
/** The receipt card's primary button. Nothing interprets a list, and nothing
 *  spends a model call, until this exists. */
export async function buildShop(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, { command: COMMANDS.BUILD_SHOP, shop, actor });
  return receipt(COMMANDS.BUILD_SHOP, shop, recorded);
}

// =====================================================================
// 6. answerQuestion - the human resolves one genuine ambiguity
// =====================================================================
/**
 * THE COMMAND THAT PROVES THE WHOLE DESIGN.
 *
 * A tap on Telegram and a click in the Cockpit both land HERE, and both write
 * the SAME asdair.shop_question row. That is why an answer given on the phone
 * clears the question the Cockpit is showing - not because the two surfaces
 * synchronise, but because there is only one of them underneath.
 *
 * Performed IMMEDIATELY rather than queued, because it is a single atomic
 * durable write and because a human deserves to see their answer take effect.
 * FIRST ANSWER WINS: shopStore.answerQuestion returns an already-answered
 * question unchanged, so a double-tapped button cannot overwrite a decision or
 * write a second decision event - and the question is never re-asked, because
 * openQuestion's ON CONFLICT recognises it forever after.
 *
 * @param {{shopRef?:string, shopId?:*, actor:string, questionKey:string,
 *          answerText?:string, answerSource?:'button'|'typed', skip?:boolean}} spec
 */
export async function answerQuestion(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const questionKey = requireText(spec && spec.questionKey, 'questionKey');
  const skip = spec.skip === true;
  const answerText = skip ? null : requireText(spec && spec.answerText, 'answerText (or skip: true)');
  const answerSource = requireAnswerSource(spec && spec.answerSource);

  const recorded = await record(deps, {
    command: COMMANDS.ANSWER_QUESTION, shop, actor,
    discriminator: questionKey,
    payload: { question_key: questionKey, answer_text: answerText, answer_source: answerSource, skipped: skip },
  });

  const answered = await deps.shopStore.answerQuestion({
    shop_id: shop.id,
    question_key: questionKey,
    status: skip ? 'skipped' : 'answered',
    answer_text: answerText,
    answer_source: answerSource,
  });

  return receipt(COMMANDS.ANSWER_QUESTION, shop, recorded, {
    question_key: questionKey,
    changed: answered.changed,
    already_answered: answered.already_answered,
    // Truthful to the human: "you already answered this" is a better message
    // than silently doing nothing, and better than pretending it just landed.
    duplicate: answered.changed === false,
  });
}

// =====================================================================
// 7. requestBasketBuild / 8. pauseBasketBuild
// =====================================================================
/**
 * Ask for the ASDA basket to be built.
 *
 * Records intent. The durable browser_build_request is created by runPipeline,
 * where migration 006's one-live-request-per-shop index makes repeated taps
 * RESUME the existing request rather than queue a second one.
 *
 * NOTHING AUTONOMOUS EVER CLAIMS THAT REQUEST. A supervised human runner does,
 * and this command cannot cause a slot to be booked, a checkout to happen or a
 * payment to be made.
 */
export async function requestBasketBuild(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, { command: COMMANDS.REQUEST_BASKET_BUILD, shop, actor });
  return receipt(COMMANDS.REQUEST_BASKET_BUILD, shop, recorded);
}

/**
 * Pause a live basket build.
 *
 * The runner releases the browser request. From WAITING_FOR_BROWSER the shop
 * returns to READY_TO_SHOP - a listed move, precisely so a request can be
 * released without losing the week. From SHOPPING there is no such edge, so the
 * request is cancelled and the shop stays where it is, resumable by asking for
 * the basket again.
 */
export async function pauseBasketBuild(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, {
    command: COMMANDS.PAUSE_BASKET_BUILD, shop, actor,
    payload: { reason: (spec && spec.reason) || null },
  });
  return receipt(COMMANDS.PAUSE_BASKET_BUILD, shop, recorded);
}

// =====================================================================
// 9. submitConfirmation - Warwick forwards the ASDA receipt
// =====================================================================
/**
 * The order confirmation Warwick forwards AFTER he has checked out himself.
 *
 * The raw text is retained on the command row, verbatim, the moment it arrives -
 * it is the evidence everything downstream is derived from, and it must survive
 * a parse failure, a restart and a re-parse. The parse, the reconciliation and
 * the learning all happen in runPipeline, because they are multi-stage work.
 *
 * THIS IS NOT AN ORDER PATH. AsdAIr never placed this order and never could;
 * it is being TOLD what happened.
 */
export async function submitConfirmation(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const rawText = requireText(spec && spec.rawText, 'rawText (the pasted ASDA confirmation, verbatim)');
  const recorded = await record(deps, {
    command: COMMANDS.SUBMIT_CONFIRMATION, shop, actor,
    payload: {
      raw_text: rawText,
      source_kind: spec.sourceKind === 'photo' || spec.sourceKind === 'document' ? spec.sourceKind : 'text',
      received_at: spec.receivedAt ?? null,
    },
  });
  return receipt(COMMANDS.SUBMIT_CONFIRMATION, shop, recorded, { chars: rawText.length });
}

// =====================================================================
// 10. retryStage - resume a FAILED shop
// =====================================================================
/**
 * Ask a parked shop to resume.
 *
 * The target is NOT supplied here and cannot be: shopState permits FAILED ->
 * only the state the shop failed FROM, read from its durable failure event.
 * A caller that could name the resume target could smuggle a shop into a stage
 * it never reached.
 */
export async function retryStage(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, { command: COMMANDS.RETRY_STAGE, shop, actor });
  return receipt(COMMANDS.RETRY_STAGE, shop, recorded);
}

// =====================================================================
// 11. cancelShop
// =====================================================================
/** Abandon the week. Records intent; the runner performs the transition, so
 *  there is exactly ONE place in the system that moves a shop's status. */
export async function cancelShop(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const recorded = await record(deps, {
    command: COMMANDS.CANCEL_SHOP, shop, actor,
    payload: { reason: (spec && spec.reason) || null },
  });
  return receipt(COMMANDS.CANCEL_SHOP, shop, recorded);
}

// =====================================================================
// 12. getStatus - the read
// =====================================================================
/**
 * Where is my shop up to? Answered from durable state, and NOTHING ELSE.
 *
 * Writes nothing - not even a command row. Looking is not an intent to be
 * advanced, and a durable "somebody checked the status" row would fill the
 * machine ledger with noise the runner would then have to retire.
 *
 * Every null in the projection means GENUINELY UNKNOWN and the caller must say
 * "unknown" - never zero, never a guess. That contract belongs to
 * shopStatus.js and is preserved verbatim here; the extra `pipeline` block adds
 * what the shop is WAITING FOR, which is the one thing a stalled shop's owner
 * actually wants to know.
 */
export async function getStatus(spec, deps) {
  const shop = await store.requireShop(deps, spec);
  const projection = await deps.getShopStatus(shop.id, { household_id: shop.household_id });
  const snapshot = await store.readSnapshot(deps, { shopId: shop.id });
  const next = deps.decideNextStep(snapshot);
  return {
    ok: true,
    command: COMMANDS.GET_STATUS,
    shop_id: shop.id,
    shop_ref: shop.shop_ref,
    status: projection,
    pipeline: {
      next_step: next.step,
      reason: next.reason,
      would_move_to: next.to,
      pending_commands: snapshot.pendingCommands.map((c) => ({ command: c.command, key: c.key })),
    },
  };
}

/**
 * The surface, by name. A channel binds to THIS - never to the functions one at
 * a time - so a command added here is automatically available to Telegram and
 * the Cockpit at the same moment, and neither can be quietly left behind.
 */
export const COMMAND_SURFACE = Object.freeze({
  [COMMANDS.RECEIVE_LIST]: receiveList,
  [COMMANDS.INTERPRET_LIST]: interpretList,
  [COMMANDS.CONFIRM_INTERPRETATION]: confirmInterpretation,
  [COMMANDS.CORRECT_LINE]: correctLine,
  [COMMANDS.BUILD_SHOP]: buildShop,
  [COMMANDS.ANSWER_QUESTION]: answerQuestion,
  [COMMANDS.REQUEST_BASKET_BUILD]: requestBasketBuild,
  [COMMANDS.PAUSE_BASKET_BUILD]: pauseBasketBuild,
  [COMMANDS.SUBMIT_CONFIRMATION]: submitConfirmation,
  [COMMANDS.RETRY_STAGE]: retryStage,
  [COMMANDS.CANCEL_SHOP]: cancelShop,
  [COMMANDS.GET_STATUS]: getStatus,
});

/**
 * Dispatch by name. This is what a channel adapter calls.
 *
 * @param {string} command a member of COMMANDS
 * @param {object} spec    the command's arguments (always carries `actor`)
 * @param {object} deps    the wired dependency container (see deps.js)
 */
export async function dispatch(command, spec, deps) {
  assertCommandName(command);
  return COMMAND_SURFACE[command](spec, deps);
}

export { COMMANDS, questionKeyFor };
