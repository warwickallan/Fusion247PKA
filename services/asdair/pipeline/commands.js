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

  // ── THE VACUOUS-SUCCESS GUARD (WP-B15-07 AC4) ─────────────────────────────
  //
  // receiveList runs INSIDE intake's onRecord, before the Telegram offset moves.
  // So "this function returned" is what the receiver reads as "the list is
  // durably captured, it is safe to let Telegram forget the message". On
  // 2026-08-10 that reading was false: the list had been absorbed into a
  // CANCELLED shop, nothing was written, and the message was acknowledged and
  // lost forever. A returned receipt must MEAN capture, or this must throw.
  //
  // THE TEST IS DURABLE CAPTURE OF THIS MESSAGE, NOT THE SHOP'S LIVENESS, and
  // that distinction is load-bearing. A redelivery of a message whose shop
  // Warwick later cancelled matches on the INBOUND key: that content did reach a
  // shop, nothing was lost, and raising there would hold the offset and make
  // Telegram redeliver the same message forever - a permanently wedged poller,
  // which is a worse outage than the defect being fixed here.
  //
  // So exactly one case loses a list: the REF matched a terminal shop, meaning
  // this message was never captured. shopStore now creates a fresh shop instead,
  // so this branch is unreachable through the store - it stands as defence in
  // depth, because the cost of being wrong is a silently lost shopping list.
  if (created.matched_by === 'shop_ref'
      && deps.shopState.TERMINAL_STATUSES.includes(created.shop.status)) {
    throw new Error(
      `commands: receiveList refuses to report success - shop ${created.shop.shop_ref} is `
      + `${created.shop.status} (terminal) and this inbound message `
      + `(${telegramMessageId ?? 'no message id'}) was never captured. A terminal shop never advances, so `
      + 'acknowledging this to Telegram would lose the list permanently. Hold the offset and redeliver.'
    );
  }

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
    // Non-null ONLY when this list had to start a fresh shop because a terminal
    // one already owned the date. Carried out so a card, the Cockpit or an
    // operator can say WHY the week has two shops rather than leaving it to be
    // inferred from a ref suffix.
    superseded_terminal_ref: created.superseded_terminal_ref ?? null,
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

  // WP-B15-35 AC6. OPTIONAL, AND THE HONEST HALF OF THE SHAPE MISMATCH.
  //
  // `shopLines.markCorrected(deps, shopId, lineNo, confirmedBy)` needs an
  // INTEGER line number. This command has only ever carried an item_name
  // STRING, so the two could not be joined without either a cast (dishonest -
  // Number('Cravendale') is NaN) or a guess.
  //
  // A caller that KNOWS the line - the Cockpit board renders shop_line rows and
  // therefore has line_no in hand - may now say so, and the correction is
  // recorded against that exact line. A caller that does not (Telegram free
  // text, where Warwick types a product name) omits it, and the pipeline
  // resolves it by unique name match or records that it could not. Neither
  // path invents a line number.
  let lineNo = spec.lineNo;
  if (lineNo !== undefined && lineNo !== null && lineNo !== '') {
    lineNo = Number(lineNo);
    if (!Number.isInteger(lineNo) || lineNo < 1) {
      throw new Error('commands: correctLine lineNo must be omitted or a positive integer - it is ' +
        'asdair.shop_line.line_no, never a name');
    }
  } else {
    lineNo = null;
  }

  const recorded = await record(deps, {
    command: COMMANDS.CORRECT_LINE, shop, actor,
    discriminator: normaliseTerm(itemName),
    payload: { item_name: itemName, line_no: lineNo, requested_qty: qty, status, note: spec.note ?? null },
  });
  return receipt(COMMANDS.CORRECT_LINE, shop, recorded, { item_name: itemName, line_no: lineNo });
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
// 6b. correctAnswer - "no, that is not what I meant"  (WO-2026-08-18-04)
// =====================================================================
/**
 * SUPERSEDE A SETTLED ANSWER. THE DELIBERATE ACT, BESIDE FIRST-ANSWER-WINS.
 *
 * -- WHERE THE LINE BETWEEN ACCIDENT AND INTENT SITS, AND WHY IT SITS THERE --
 *
 * It sits on the ROUTE TAKEN, never on the content of the words.
 *
 *   * A bare board reply - "3: the blue one" - is answerQuestion. It is a
 *     compare-and-set on status='open', so against a settled question it writes
 *     NOTHING. An accidental double tap, a redelivered message, a second
 *     thought typed into the same board: all still no-ops, exactly as before.
 *     Nothing in this file weakens that, and it is the protection that rule was
 *     built to give.
 *   * A board reply that OPENS WITH THE WORD "change" is this command.
 *
 * Nothing about the answer decides which one you get. Only the act of typing a
 * keyword - which a double tap cannot produce, a redelivery cannot invent, and
 * nobody types by accident. That is the whole distinction, and it is why this
 * is a separate COMMAND rather than a flag on answerQuestion: a flag would have
 * to be trusted at every call site, whereas a second name simply cannot be
 * reached by the path an accident takes.
 *
 * -- AUDITED MEANS THE ORIGINAL SURVIVES, AND IT SURVIVES BY CONSTRUCTION ----
 *
 * NOTHING here rewrites the settled row. A correction is a NEW ROUND - a new
 * asdair.shop_question with question_round = N+1 and parent_question_id
 * pointing at the row being superseded (migration 017). The original keeps its
 * answer_text, answer_source and answered_at because no statement on this path
 * can reach them, not because a trail was bolted on afterwards.
 *
 * The trail has two independent carriers, and either alone would answer "who
 * changed it, when, and to what":
 *
 *   1. THE CHAIN. shop_question.parent_question_id walks back from the current
 *      answer through every answer that preceded it, each with its answered_at.
 *   2. THE COMMAND ROW. This command's durable payload records the superseded
 *      text, its source, its timestamp and its status ALONGSIDE the replacement
 *      - and `actor` says WHO, which the question row has never carried.
 *
 * -- AND IT IS ONE ATOMIC INTENT, PERFORMED IMMEDIATELY ---------------------
 *
 * Like answerQuestion, and for the same reason: he has already said what he
 * meant, and making him answer a fresh card to complete a correction he just
 * typed would be a second chance to lose it. The successor round is opened AND
 * answered here. Advancing the shop is still the runner's job - see stages.js,
 * which brings a shop that had already reached READY_TO_SHOP back to
 * NEEDS_DECISION so the plan is actually recomputed.
 *
 * -- THE JOIN IS PROVEN AT WRITE TIME, NEVER HOPED FOR ----------------------
 *
 * applyDecisionsToPlan finds a line's decision by walking
 * questionKeyFor(item_name, round) upward from round 1. So a successor whose
 * key does not derive from the SAME item name at the NEXT round is invisible to
 * the planner - recorded, audited, and inert, which is the exact failure this
 * order exists to end. This function therefore reproduces the ORIGINAL key from
 * the candidate name first and REFUSES if it cannot. A loud refusal is a
 * recoverable defect; a silent mis-derivation is a basket built on a wrong
 * answer that nobody can see was wrong.
 *
 * @param {{shopRef?:string, shopId?:*, actor:string, questionKey:string,
 *          answerText:string, answerSource?:'button'|'typed'}} spec
 */
export async function correctAnswer(spec, deps) {
  const actor = requireActor(spec && spec.actor);
  const shop = await store.requireShop(deps, spec);
  const questionKey = requireText(spec && spec.questionKey, 'questionKey');
  // A correction with no replacement is a complaint, not a correction. Refusing
  // it is what stops a bare "change 3:" from wiping a settled answer to null.
  const answerText = requireText(spec && spec.answerText, 'answerText (the replacement answer)');
  const answerSource = requireAnswerSource(spec && spec.answerSource);

  const questions = await store.listQuestions(deps, shop.id);
  const named = questions.find((q) => q.question_key === questionKey) || null;
  if (!named) {
    throw new Error(`commands: correctAnswer found no question "${questionKey}" on shop ${shop.shop_ref}. Nothing was written.`);
  }

  // -- CORRECT THE NEWEST ROUND, NOT THE ONE HE POINTED AT -------------------
  // The board numbers a question by its position, so "change 3" keeps naming
  // round 1 forever even after round 2 has superseded it. Correcting round 1
  // twice would collide on one successor key and the second correction would
  // silently no-op - his change lost, behind a receipt saying it landed.
  // "Change what I most recently said about this line" is the only reading that
  // composes, and it is the same reading applyDecisionsToPlan already takes
  // when it walks the chain and keeps the highest round.
  let original = named;
  for (;;) {
    const child = questions.find((q) => q.parent_question_id !== null
      && q.parent_question_id !== undefined
      && String(q.parent_question_id) === String(original.id));
    if (!child) break;
    original = child;
  }

  // -- THE TIP IS OPEN: ANSWER IT, DO NOT SUPERSEDE ANYTHING ----------------
  // He typed "change 3" and the newest round of that line is a question still
  // waiting on him - typically a clarification AsdAIr opened because it could
  // not read his last answer. What he means is unambiguous, and answering an
  // OPEN row overwrites nothing, so the correction becomes an ordinary answer
  // and no round is opened.
  //
  // REFUSING HERE WAS THE FIRST DESIGN AND IT WAS WRONG. The refusal throws
  // inside the inbound claim path, the claim is declined, and his words go on to
  // intake as a NEW SHOPPING LIST - which is the single worst failure this
  // system has, arrived at while protecting a rule that was not in danger.
  if (original.status === 'open') {
    const answeredOpen = await deps.shopStore.answerQuestion({
      shop_id: shop.id,
      question_key: original.question_key,
      status: 'answered',
      answer_text: answerText,
      answer_source: answerSource,
    });
    const recordedOpen = await record(deps, {
      command: COMMANDS.CORRECT_ANSWER, shop, actor,
      discriminator: original.question_key,
      payload: {
        question_key: original.question_key,
        question_round: Number(original.question_round || 1),
        superseded_question_id: original.id,
        superseded_status: 'open',
        superseded_answer_text: null,
        superseded_answer_source: null,
        superseded_answered_at: null,
        successor_question_key: null,
        successor_question_round: null,
        item_name: original.item_name || null,
        answer_text: answerText,
        answer_source: answerSource,
        outcome: 'answered an open round - nothing was superseded',
      },
    });
    return receipt(COMMANDS.CORRECT_ANSWER, shop, recordedOpen, {
      question_key: original.question_key,
      successor_question_key: null,
      answered_open_round: true,
      corrected: false,
      opened: false,
      duplicate: answeredOpen.changed === false,
    });
  }

  // -- THE SAME WORDS AGAIN ARE NOT A SECOND CORRECTION --------------------
  // Whether they arrive because Telegram redelivered the message or because he
  // typed the same thing twice, the current answer for this line ALREADY says
  // what he is asking for. Opening a round to change an answer into itself would
  // grow the chain on every retry and make the audit trail unreadable.
  //
  // Compared on WORDS - whitespace and case only. Not normaliseTerm, which
  // flattens punctuation: "500g" and "500 g" must stay different answers.
  const sameAnswer = (a, b) => String(a == null ? '' : a).trim().replace(/\s+/g, ' ').toLowerCase()
    === String(b == null ? '' : b).trim().replace(/\s+/g, ' ').toLowerCase();
  if (original.status === 'answered' && sameAnswer(original.answer_text, answerText)) {
    return receipt(COMMANDS.CORRECT_ANSWER, shop, null, {
      question_key: original.question_key,
      successor_question_key: null,
      corrected: false,
      opened: false,
      duplicate: true,
      unchanged: true,
    });
  }

  // -- REPRODUCE THE KEY, OR REFUSE -----------------------------------------
  // Two names can carry a line: the list item's own name, and what was actually
  // written on the photographed page. Whichever produced this question's key is
  // the one the planner derives the successor's from, so it is ESTABLISHED by
  // re-derivation rather than chosen.
  const round = Number(original.question_round || 1);
  let itemName = null;
  for (const candidate of [original.item_name, original.photographed_wording]) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    let derived = null;
    try { derived = questionKeyFor(candidate, round); } catch { derived = null; }
    if (derived === original.question_key) { itemName = candidate; break; }
  }
  if (itemName === null) {
    throw new Error(
      `commands: correctAnswer cannot reproduce question key "${original.question_key}" (round ${round}) from any name `
      + `this question carries on shop ${shop.shop_ref}. A successor derived from a different name would be invisible `
      + 'to the planner - recorded, and inert. Refusing rather than writing one. Nothing was written.',
    );
  }

  const nextRound = round + 1;
  const nextKey = questionKeyFor(itemName, nextRound);

  // THE AUDIT ROW. Written BEFORE the change it describes, and carrying both
  // sides of it: what was there, and what replaces it. `actor` is the only
  // record anywhere of WHO corrected it - asdair.shop_question has no such
  // column - which is why AC2's "who changed it" lives here.
  const recorded = await record(deps, {
    command: COMMANDS.CORRECT_ANSWER, shop, actor,
    discriminator: original.question_key,
    payload: {
      question_key: original.question_key,
      question_round: round,
      superseded_question_id: original.id,
      superseded_status: original.status,
      superseded_answer_text: original.answer_text ?? null,
      superseded_answer_source: original.answer_source ?? null,
      superseded_answered_at: original.answered_at ?? null,
      successor_question_key: nextKey,
      successor_question_round: nextRound,
      item_name: itemName,
      answer_text: answerText,
      answer_source: answerSource,
    },
  });

  const previously = original.status === 'skipped'
    ? 'you skipped it'
    : `you said "${original.answer_text}"`;

  const opened = await deps.shopStore.openQuestion({
    shop_id: shop.id,
    question_key: nextKey,
    // Inherited, never re-derived: the successor is about the SAME line, and a
    // question that answered to no stored list item still answers to none.
    list_item_id: original.list_item_id ?? null,
    question_text: `About "${itemName}" - ${previously}, and you have changed that. Which did you mean?`,
    // The same candidates that were offered the first time, so the correction
    // keeps the deterministic no-model-call path in decideAnswer available to
    // it exactly as the original answer had.
    candidates: Array.isArray(original.candidates) ? original.candidates : [],
    question_round: nextRound,
    parent_question_id: original.id,
  });

  // Answered immediately, on the round just opened. A redelivery of the same
  // correction re-derives the same key, finds it already answered, and changes
  // nothing - first-answer-wins doing its ordinary job on the new row.
  const answered = await deps.shopStore.answerQuestion({
    shop_id: shop.id,
    question_key: nextKey,
    status: 'answered',
    answer_text: answerText,
    answer_source: answerSource,
  });

  return receipt(COMMANDS.CORRECT_ANSWER, shop, recorded, {
    question_key: original.question_key,
    successor_question_key: nextKey,
    question_round: nextRound,
    // AC2, carried out to the caller so a card can SAY it rather than infer it.
    superseded_answer_text: original.answer_text ?? null,
    superseded_answered_at: original.answered_at ?? null,
    corrected: answered.changed === true,
    opened: opened.created === true,
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
  [COMMANDS.CORRECT_ANSWER]: correctAnswer,
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
