// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shopState.js
//
// The PURE half of the shop control surface: the state machine, the shop_ref
// convention, and the builders that turn an INTENT into the exact rows
// migration 006 will accept.
//
// PURE and DETERMINISTIC, exactly like buildOutcome.js / planner.js:
//   * No DB, no network, no fs, no Date.now(), no randomness.
//   * Identical inputs always produce an identical result.
//   * It never mutates its arguments; it returns freshly-built plain objects.
//
// WHY A STATE MACHINE AT ALL
//   Telegram is a VIEW over asdair.shop - never the record. A tap, a
//   redelivered update or a second runner must therefore be answerable from
//   durable state alone, and the only way that stays true is if every legal
//   move is written down in ONE place and every other move is refused with a
//   readable reason. `RECONCILED -> SHOPPING` is not a bug to be discovered in
//   production; it is a sentence this module refuses to say.
//
// THE THREE SHAPES OF STATE
//   LIVE      a shop that is still moving. FAILED and CANCELLED are reachable
//             from every live state, because anything can go wrong anywhere.
//   PARKED    FAILED. Not terminal: a failed shop must be resumable back to
//             EXACTLY the state it failed from, which is why the resume target
//             is not guessed here - it is read from the durable failure event
//             and passed in as `resume_from`.
//   TERMINAL  RECONCILED (finished) and CANCELLED (abandoned). Nothing leaves
//             either. A finished week cannot be re-entered; it can only be
//             followed by a NEW shop with a new shop_ref.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// ---------------------------------------------------------------------
// The vocabularies. Every one of these mirrors a CHECK constraint in
// db/006_shop_control_surface.sql; schemaCompat.test.js parses that migration
// and asserts these lists match it, so a drift is a CI failure and not a
// run-time surprise on a real shop.
// ---------------------------------------------------------------------
const SHOP_STATUSES = [
  'RECEIVED',
  'TRANSCRIBING',
  'PROCESSING',
  'NEEDS_DECISION',
  'READY_TO_SHOP',
  'WAITING_FOR_BROWSER',
  'SHOPPING',
  'BASKET_READY',
  'ORDER_CONFIRMATION_RECEIVED',
  'RECONCILED',
  'FAILED',
  'CANCELLED'
];

const SOURCE_KINDS = ['text', 'photo'];
const EVENT_TYPES = ['transition', 'milestone', 'failure', 'decision', 'note'];
const QUESTION_STATUSES = ['open', 'answered', 'skipped'];
const ANSWER_SOURCES = ['button', 'typed'];
const BROWSER_STATUSES = ['queued', 'claimed', 'running', 'complete', 'failed', 'cancelled'];
const PENDING_ACTION_STATUSES = ['pending', 'done', 'abandoned'];

// A browser build request is LIVE in exactly the statuses migration 006's
// partial unique index covers. Keeping the two in step is what makes "repeated
// taps resume rather than queue again" structural rather than conventional.
const BROWSER_LIVE_STATUSES = ['queued', 'claimed', 'running'];

// FAILED is deliberately absent from both lists below: it is neither live nor
// terminal, it is PARKED, and it has its own rule.
const TERMINAL_STATUSES = ['RECONCILED', 'CANCELLED'];
const LIVE_STATUSES = [
  'RECEIVED',
  'TRANSCRIBING',
  'PROCESSING',
  'NEEDS_DECISION',
  'READY_TO_SHOP',
  'WAITING_FOR_BROWSER',
  'SHOPPING',
  'BASKET_READY',
  'ORDER_CONFIRMATION_RECEIVED'
];

// The states a shop may be aborted INTO from any live state.
const ABORT_STATUSES = ['FAILED', 'CANCELLED'];

// ---------------------------------------------------------------------
// THE TRANSITION MAP - the forward moves, and nothing else.
//
// Aborts (-> FAILED / -> CANCELLED) are NOT listed here: they are legal from
// every live state and listing them twelve times would invite one of them to
// be forgotten. They are granted by rule, in isTransitionAllowed().
//
// Reading the map:
//   RECEIVED       a photo goes to TRANSCRIBING first; pasted text does not.
//   PROCESSING     planning. It ends either with unresolved lines
//                  (NEEDS_DECISION) or with a plan a human can approve.
//   NEEDS_DECISION can be entered from PROCESSING (planning found an
//                  ambiguity) OR from SHOPPING (an out-of-stock mid-shop), so
//                  it must be able to return to either - plus straight to
//                  READY_TO_SHOP when the answers settled everything.
//   WAITING_FOR_BROWSER -> READY_TO_SHOP exists because a browser request can
//                  be cancelled or released without the week being lost.
//   BASKET_READY -> SHOPPING exists because Warwick may send the runner back
//                  in to amend the basket before he confirms anything.
//   RECONCILED     empty. This is the rule the brief names explicitly:
//                  RECONCILED -> SHOPPING must be impossible.
//   FAILED         empty HERE. Resuming is a rule, not a list: see below.
//   CANCELLED      empty. Abandoned is abandoned.
// ---------------------------------------------------------------------
const ALLOWED_TRANSITIONS = {
  RECEIVED: ['TRANSCRIBING', 'PROCESSING'],
  TRANSCRIBING: ['PROCESSING'],
  PROCESSING: ['NEEDS_DECISION', 'READY_TO_SHOP'],
  NEEDS_DECISION: ['PROCESSING', 'READY_TO_SHOP', 'SHOPPING'],
  READY_TO_SHOP: ['WAITING_FOR_BROWSER'],
  WAITING_FOR_BROWSER: ['SHOPPING', 'READY_TO_SHOP'],
  SHOPPING: ['BASKET_READY', 'NEEDS_DECISION'],
  BASKET_READY: ['ORDER_CONFIRMATION_RECEIVED', 'SHOPPING'],
  ORDER_CONFIRMATION_RECEIVED: ['RECONCILED'],
  RECONCILED: [],
  FAILED: [],
  CANCELLED: []
};

// The INSERT column list for asdair.shop, kept as ONE exported constant so the
// builder, the writer and schemaCompat.test.js all read the same source of
// truth. Columns with database defaults that no caller may drive
// (created_at, updated_at, last_error) are deliberately absent.
const SHOP_INSERT_COLUMNS = [
  'household_id',
  'shop_ref',
  'status',
  'source_kind',
  'telegram_chat_id',
  'telegram_message_id',
  'telegram_update_id',
  'raw_text',
  'raw_media_path',
  'transcript',
  'transcript_provider',
  'transcript_model',
  'transcript_confidence',
  'needs_review',
  'list_id'
];

const QUESTION_INSERT_COLUMNS = [
  'shop_id',
  'list_item_id',
  'question_key',
  'question_text',
  'candidates',
  'card_chat_id',
  'card_message_id'
];

const PENDING_ACTION_INSERT_COLUMNS = [
  'household_id',
  'shop_id',
  'action_type',
  'action_key',
  'payload'
];

// THE SHOP REF, AND WHY IT IS NO LONGER JUST A DATE (WP-B15-07).
//
// It was `SHOP-YYYY-MM-DD` and nothing else. That made the date the whole
// identity, and on 2026-08-10 a real shopping list was lost because of it: the
// date's shop had been CANCELLED, a new photograph computed the DEAD row's ref,
// the INSERT hit shop_ref_uniq, ON CONFLICT DO NOTHING wrote nothing, and the
// list was acknowledged to Telegram as consumed. A terminal shop never moves
// again, so no card was ever sent.
//
// A date can therefore legitimately carry MORE THAN ONE shop, and the ref must
// be able to say which. The suffix is `-M<telegram message id>`:
//
//   DETERMINISTIC  the same message always computes the same ref, so a Telegram
//                  redelivery still resolves to the same shop. No counter, no
//                  clock, no randomness - this module has none of those on
//                  purpose, and inventing one here would let a retry that
//                  crossed midnight produce a second shop.
//   GROUNDED       the identity comes from the actual inbound event, which is
//                  what makes "same message" and "different message" a fact
//                  about the world rather than about our own bookkeeping.
//   READABLE       Warwick reads these refs. `SHOP-2026-08-10-M63` is still a
//                  date he recognises, with a message he can look up.
//
// The plain date form is UNCHANGED and stays what an ordinary week gets: the
// suffix appears ONLY when a terminal shop already owns the date. No existing
// ref changes meaning, and the date part stays extractable by everything
// downstream - runPipeline.listDateOf, the execution packet and the browser
// handoff all accept the optional suffix and keep reading the date.
const SHOP_REF_PATTERN = /^SHOP-\d{4}-\d{2}-\d{2}(?:-M\d+)?$/;

// ---------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------

function fail(message) {
  throw new Error('shopState: ' + message);
}

// A database id: a positive integer, accepted as a number or a numeric string
// (pg returns bigint as a string). Returns a Number when safely
// representable, else the trimmed string, so a large bigint is never mangled.
function toDbId(value, label) {
  if (value === null || value === undefined || value === '') {
    fail(label + ' is required.');
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) fail(label + ' must be a positive integer, got ' + String(value) + '.');
    return value;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!/^[1-9][0-9]*$/.test(t)) fail(label + ' must be a positive integer, got "' + value + '".');
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : t;
  }
  return fail(label + ' must be a positive integer, got ' + typeof value + '.');
}

function optionalDbId(value, label) {
  if (value === null || value === undefined || value === '') return null;
  return toDbId(value, label);
}

function requireText(value, label) {
  if (value === null || value === undefined) fail(label + ' is required.');
  if (typeof value !== 'string') fail(label + ' must be a string, got ' + typeof value + '.');
  const t = value.trim();
  if (t === '') fail(label + ' must not be empty.');
  return t;
}

function optionalText(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') fail(label + ' must be a string when given, got ' + typeof value + '.');
  const t = value.trim();
  return t === '' ? null : t;
}

function requireOneOf(value, vocabulary, label) {
  if (vocabulary.indexOf(value) === -1) {
    fail(label + ' "' + String(value) + '" is not one of: ' + vocabulary.join(', ') + '.');
  }
  return value;
}

function optionalBoolean(value, label, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(label + ' must be a boolean when given, got ' + typeof value + '.');
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---------------------------------------------------------------------
// nextShopRef - the human handle for a week.
//
// PURE: the date is passed IN. This module has no clock, deliberately - a
// module that could ask the machine what day it is could silently produce a
// different shop_ref on a retry that crossed midnight, and a different
// shop_ref means a duplicated week.
//
// The calendar check is done arithmetically rather than with `new Date(...)`,
// which is timezone-sensitive and would accept 2026-02-30 by rolling it over
// to 2026-03-02.
// ---------------------------------------------------------------------
function daysInMonth(year, month) {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return lengths[month - 1];
}

function toDatePart(dateISO) {
  const raw = requireText(dateISO, 'dateISO');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(raw);
  if (!m) {
    fail('dateISO must be YYYY-MM-DD (an ISO timestamp is accepted and its date part used), got "' + raw + '".');
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) fail('dateISO month ' + m[2] + ' is not a real month (in "' + raw + '").');
  if (day < 1 || day > daysInMonth(year, month)) {
    fail('dateISO day ' + m[3] + ' is not a real day of ' + m[1] + '-' + m[2] + ' (in "' + raw + '").');
  }
  return m[1] + '-' + m[2] + '-' + m[3];
}

function nextShopRef(dateISO) {
  return 'SHOP-' + toDatePart(dateISO);
}

// ---------------------------------------------------------------------
// collisionShopRef - the ref for a genuinely NEW list arriving on a date whose
// shop is already TERMINAL.
//
// PURE and DETERMINISTIC, like everything else here: same date + same message
// always gives the same ref, so a Telegram redelivery cannot produce a second
// shop. The identity is GROUNDED IN THE INBOUND EVENT, which is what makes
// "the same list again" and "a different list" distinguishable at all.
//
// IT THROWS WHEN THERE IS NO INBOUND MESSAGE, and that is deliberate (ruled
// 2026-08-10). A shop-cli entry or a pasted text carries no message id, so
// there is nothing to ground an identity on. The honest answers were: refuse,
// or invent one. An invented identity - a counter, a timestamp, a random
// suffix - would either need a clock this module refuses to have, or would make
// a retry create a second shop, which is the very failure this exists to end.
// A loud refusal on an edge path is recoverable; a fabricated identity is not.
// ---------------------------------------------------------------------
function collisionShopRef(collidingRef, telegramMessageId) {
  const base = requireText(collidingRef, 'collisionShopRef: collidingRef');
  const m = /^SHOP-(\d{4}-\d{2}-\d{2})$/.exec(base);
  if (!m) {
    fail('collisionShopRef: the colliding ref must be the plain date form SHOP-YYYY-MM-DD, got "' + base +
      '". A collision ref is never derived from another collision ref - the inbound message id already makes ' +
      'the first one unique, so a second suffix could only mean the first one was wrong.');
  }
  const date = toDatePart(m[1]);
  const raw = telegramMessageId === null || telegramMessageId === undefined
    ? '' : String(telegramMessageId).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) {
    fail('collisionShopRef: a fresh shop for ' + date + ' needs the inbound Telegram message id to ground its ' +
      'identity on, and got ' + (raw === '' ? 'nothing' : '"' + raw + '"') + '. That date already belongs to a ' +
      'terminal shop, so the date alone cannot identify this list - and no counter, clock or invented suffix is ' +
      'substituted for a real inbound event.');
  }
  return 'SHOP-' + date + '-M' + raw;
}

function isShopRef(value) {
  return typeof value === 'string' && SHOP_REF_PATTERN.test(value.trim());
}

// ---------------------------------------------------------------------
// THE TRANSITION RULE
//
// isTransitionAllowed(from, to, options) -> { ok, kind, reason }
//
//   kind 'noop'    from === to. Not an error: a redelivered Telegram update
//                  re-driving a shop to the stage it already holds must be a
//                  no-op, not a failure. The writer records nothing for it.
//   kind 'advance' a forward move listed in ALLOWED_TRANSITIONS.
//   kind 'abort'   any live state -> FAILED or CANCELLED, plus the one extra
//                  case FAILED -> CANCELLED (abandoning a parked shop).
//   kind 'resume'  FAILED -> the state it failed from. `options.resume_from`
//                  MUST be supplied by the caller from the durable failure
//                  event; this module never guesses it, and a resume to any
//                  other state is refused by name.
// ---------------------------------------------------------------------
function isTransitionAllowed(from, to, options) {
  const opts = options || {};

  if (SHOP_STATUSES.indexOf(from) === -1) {
    return { ok: false, kind: null, reason: 'unknown current status "' + String(from) + '" (not one of: ' + SHOP_STATUSES.join(', ') + ')' };
  }
  if (SHOP_STATUSES.indexOf(to) === -1) {
    return { ok: false, kind: null, reason: 'unknown target status "' + String(to) + '" (not one of: ' + SHOP_STATUSES.join(', ') + ')' };
  }

  if (from === to) {
    return { ok: true, kind: 'noop', reason: 'the shop is already ' + to };
  }

  if (TERMINAL_STATUSES.indexOf(from) !== -1) {
    return {
      ok: false,
      kind: null,
      reason: from + ' is terminal: a ' + (from === 'RECONCILED' ? 'reconciled' : 'cancelled') +
        ' shop can never move again (start a NEW shop with a new shop_ref instead)'
    };
  }

  if (from === 'FAILED') {
    if (to === 'CANCELLED') {
      return { ok: true, kind: 'abort', reason: 'a failed shop may be abandoned' };
    }
    const resumeFrom = opts.resume_from === undefined ? null : opts.resume_from;
    if (resumeFrom === null || resumeFrom === '') {
      return {
        ok: false,
        kind: null,
        reason: 'FAILED -> ' + to + ' needs the state the shop FAILED FROM (resume_from), read from its ' +
          'durable failure event. Without it a resume cannot be proven legal, so it is refused.'
      };
    }
    if (SHOP_STATUSES.indexOf(resumeFrom) === -1) {
      return { ok: false, kind: null, reason: 'resume_from "' + String(resumeFrom) + '" is not a known status' };
    }
    if (to !== resumeFrom) {
      return {
        ok: false,
        kind: null,
        reason: 'a FAILED shop may only resume to the state it failed from (' + resumeFrom + '), not to ' + to
      };
    }
    if (LIVE_STATUSES.indexOf(to) === -1) {
      return { ok: false, kind: null, reason: 'cannot resume into ' + to + ', which is not a live state' };
    }
    return { ok: true, kind: 'resume', reason: 'resuming to the state the shop failed from' };
  }

  // From here `from` is a LIVE state.
  if (ABORT_STATUSES.indexOf(to) !== -1) {
    return { ok: true, kind: 'abort', reason: to + ' is reachable from every live state' };
  }

  const forward = ALLOWED_TRANSITIONS[from] || [];
  if (forward.indexOf(to) !== -1) {
    return { ok: true, kind: 'advance', reason: 'a listed forward move' };
  }

  return {
    ok: false,
    kind: null,
    reason: from + ' -> ' + to + ' is not a legal move. From ' + from + ' the shop may go to: ' +
      (forward.length ? forward.join(', ') : '(nothing)') + ', FAILED or CANCELLED.'
  };
}

function assertTransition(from, to, options) {
  const verdict = isTransitionAllowed(from, to, options);
  if (!verdict.ok) fail(verdict.reason + '.');
  return verdict;
}

// ---------------------------------------------------------------------
// buildShopCreate - the INSERT row for a new weekly shop.
//
// TWO STRUCTURAL CHECKS THAT MATTER MORE THAN THEY LOOK:
//
//  1. telegram_chat_id and telegram_message_id are all-or-nothing. Migration
//     006's idempotency index is PARTIAL (`where telegram_chat_id is not null
//     and telegram_message_id is not null`), so a row carrying only one of
//     them is NOT covered by it - and a redelivered update would then create a
//     second shop for the same week in total silence. Half an inbound key is
//     worse than none, so it is rejected here.
//
//  2. The evidence must actually be present: a 'photo' shop needs
//     raw_media_path, a 'text' shop needs raw_text. Raw evidence is what the
//     shop was produced from and migration 006 says it is ALWAYS retained; a
//     shop with nothing to read is not a shop.
//
// A shop is always created at RECEIVED. Moving on is a TRANSITION, which is
// audited; letting a caller create a row directly at, say, SHOPPING would
// produce a shop with no history of how it got there.
// ---------------------------------------------------------------------
function buildShopCreate(intent) {
  if (!isPlainObject(intent)) fail('buildShopCreate: an intent object is required.');

  const status = intent.status === undefined || intent.status === null ? 'RECEIVED' : intent.status;
  if (status !== 'RECEIVED') {
    fail('buildShopCreate: a shop is always created at RECEIVED (asked for "' + String(status) +
      '"). Move it on with a transition, which writes an audit event.');
  }

  const sourceKind = requireOneOf(intent.source_kind, SOURCE_KINDS, 'buildShopCreate: source_kind');
  const shopRef = requireText(intent.shop_ref, 'buildShopCreate: shop_ref');
  if (!SHOP_REF_PATTERN.test(shopRef)) {
    fail('buildShopCreate: shop_ref must look like SHOP-YYYY-MM-DD, optionally with a -M<message id> ' +
      'suffix when a terminal shop already owns the date (see nextShopRef / collisionShopRef), got "' + shopRef + '".');
  }

  const chatId = optionalText(intent.telegram_chat_id, 'buildShopCreate: telegram_chat_id');
  const messageId = optionalText(intent.telegram_message_id, 'buildShopCreate: telegram_message_id');
  if ((chatId === null) !== (messageId === null)) {
    fail('buildShopCreate: telegram_chat_id and telegram_message_id must be given together or not at all. ' +
      'The idempotency index in migration 006 is partial and only covers rows where BOTH are set, so half ' +
      'an inbound key would let a redelivered message silently duplicate the week.');
  }

  const rawText = optionalText(intent.raw_text, 'buildShopCreate: raw_text');
  const rawMediaPath = optionalText(intent.raw_media_path, 'buildShopCreate: raw_media_path');
  if (sourceKind === 'text' && rawText === null) {
    fail('buildShopCreate: a text shop must carry raw_text - the raw evidence is always retained.');
  }
  if (sourceKind === 'photo' && rawMediaPath === null) {
    fail('buildShopCreate: a photo shop must carry raw_media_path - the raw evidence is always retained.');
  }

  let confidence = null;
  if (intent.transcript_confidence !== undefined && intent.transcript_confidence !== null) {
    const c = Number(intent.transcript_confidence);
    if (!Number.isFinite(c) || c < 0 || c > 1) {
      fail('buildShopCreate: transcript_confidence must be a number between 0 and 1, got ' +
        String(intent.transcript_confidence) + '.');
    }
    confidence = c;
  }

  const row = {
    household_id: toDbId(intent.household_id, 'buildShopCreate: household_id'),
    shop_ref: shopRef,
    status: 'RECEIVED',
    source_kind: sourceKind,
    telegram_chat_id: chatId,
    telegram_message_id: messageId,
    telegram_update_id: optionalText(intent.telegram_update_id, 'buildShopCreate: telegram_update_id'),
    raw_text: rawText,
    raw_media_path: rawMediaPath,
    transcript: optionalText(intent.transcript, 'buildShopCreate: transcript'),
    transcript_provider: optionalText(intent.transcript_provider, 'buildShopCreate: transcript_provider'),
    transcript_model: optionalText(intent.transcript_model, 'buildShopCreate: transcript_model'),
    transcript_confidence: confidence,
    needs_review: optionalBoolean(intent.needs_review, 'buildShopCreate: needs_review', false),
    list_id: optionalDbId(intent.list_id, 'buildShopCreate: list_id')
  };

  return {
    row: row,
    columns: SHOP_INSERT_COLUMNS.slice(),
    // Which natural keys this row can be resumed by, most specific first. The
    // writer re-selects on these after an ON CONFLICT DO NOTHING that wrote
    // nothing; see shopStore.createOrResumeShop.
    resume_keys: chatId === null ? ['shop_ref'] : ['telegram_message', 'shop_ref']
  };
}

// ---------------------------------------------------------------------
// buildTransition - the status change AND the audit event it is inseparable
// from. They are returned together because they are written together; there
// is no shape in this module that represents a status change on its own.
// ---------------------------------------------------------------------
function buildTransition(intent) {
  if (!isPlainObject(intent)) fail('buildTransition: an intent object is required.');

  const from = intent.from_status;
  const to = intent.to_status;
  const verdict = assertTransition(from, to, { resume_from: intent.resume_from });

  const description = optionalText(intent.description, 'buildTransition: description') ||
    defaultTransitionDescription(from, to, verdict.kind);

  if (verdict.kind === 'noop') {
    return { kind: 'noop', from_status: from, to_status: to, status: to, event: null };
  }

  return {
    kind: verdict.kind,
    from_status: from,
    to_status: to,
    status: to,
    event: {
      event_type: 'transition',
      from_status: from,
      to_status: to,
      description: description
    }
  };
}

function defaultTransitionDescription(from, to, kind) {
  if (kind === 'resume') return 'resumed from FAILED back to ' + to;
  if (kind === 'abort') return 'moved to ' + to + ' from ' + from;
  return from + ' -> ' + to;
}

// ---------------------------------------------------------------------
// buildQuestion - one genuinely-unresolved item, asked at most once.
//
// question_key is the whole point: migration 006 makes (shop_id, question_key)
// UNIQUE, so a re-run cannot re-ask. The key must therefore be STABLE across
// runs for the same underlying question - derive it from the list line, not
// from a counter or a timestamp.
// ---------------------------------------------------------------------
function buildQuestion(intent) {
  if (!isPlainObject(intent)) fail('buildQuestion: an intent object is required.');

  let candidates = intent.candidates;
  if (candidates === undefined || candidates === null) candidates = [];
  if (!Array.isArray(candidates)) {
    fail('buildQuestion: candidates must be an array (jsonb, defaults to []), got ' + typeof candidates + '.');
  }
  candidates.forEach(function (c, i) {
    if (c === null || c === undefined) fail('buildQuestion: candidates[' + i + '] must not be null.');
    if (typeof c !== 'string' && !isPlainObject(c)) {
      fail('buildQuestion: candidates[' + i + '] must be a string or an object, got ' + typeof c + '.');
    }
  });

  const cardChat = optionalText(intent.card_chat_id, 'buildQuestion: card_chat_id');
  const cardMessage = optionalText(intent.card_message_id, 'buildQuestion: card_message_id');

  const row = {
    shop_id: toDbId(intent.shop_id, 'buildQuestion: shop_id'),
    list_item_id: optionalDbId(intent.list_item_id, 'buildQuestion: list_item_id'),
    question_key: requireText(intent.question_key, 'buildQuestion: question_key'),
    question_text: requireText(intent.question_text, 'buildQuestion: question_text'),
    candidates: candidates,
    card_chat_id: cardChat,
    card_message_id: cardMessage
  };

  const columns = QUESTION_INSERT_COLUMNS.slice();

  // ── CLARIFICATION ROUNDS (WP-B15-2, migration 017) ────────────────────────
  // Round 1 is the overwhelmingly common case and its INSERT stays BYTE-FOR-
  // BYTE what it was: the two columns are added only when a round above 1 is
  // genuinely asked for. That is deliberate - the round-1 statement shape is
  // what three live shops, the fake database and the existing suite all
  // already agree on, and widening it unconditionally would change a working
  // path to serve an uncommon one.
  //
  // 017's shop_question_round_parent_agree CHECK is `(parent is null) = (round
  // = 1)`, so the two fields are validated together here rather than
  // separately: a round above 1 with no parent, or a parent on round 1, is an
  // incoherent chain and the database would refuse it anyway.
  const roundGiven = intent.question_round !== undefined && intent.question_round !== null;
  const parentGiven = intent.parent_question_id !== undefined && intent.parent_question_id !== null;
  if (roundGiven || parentGiven) {
    const round = Number(intent.question_round);
    if (!Number.isInteger(round) || round < 1) {
      fail('buildQuestion: question_round must be an integer >= 1, got ' + String(intent.question_round) + '.');
    }
    if (round === 1 && parentGiven) {
      fail('buildQuestion: round 1 is the original question and must have no parent_question_id.');
    }
    if (round > 1 && !parentGiven) {
      fail('buildQuestion: question_round ' + round + ' is a clarification and requires parent_question_id ' +
        '- a round with no parent is an orphaned chain the database refuses.');
    }
    if (round > 1) {
      row.question_round = round;
      row.parent_question_id = optionalDbId(intent.parent_question_id, 'buildQuestion: parent_question_id');
      columns.push('question_round', 'parent_question_id');
    }
  }

  return { row: row, columns: columns };
}

// ---------------------------------------------------------------------
// buildAnswer - the human's decision on one question.
//
// 'skipped' is a real answer ("leave it"), so answer_text is only required for
// 'answered'. A decision event always accompanies it; see shopStore.
// ---------------------------------------------------------------------
function buildAnswer(intent) {
  if (!isPlainObject(intent)) fail('buildAnswer: an intent object is required.');

  const status = intent.status === undefined || intent.status === null ? 'answered' : intent.status;
  if (status !== 'answered' && status !== 'skipped') {
    fail('buildAnswer: status must be "answered" or "skipped" (a question is created "open"), got "' +
      String(status) + '".');
  }

  const questionId = optionalDbId(intent.question_id, 'buildAnswer: question_id');
  const shopId = optionalDbId(intent.shop_id, 'buildAnswer: shop_id');
  const questionKey = optionalText(intent.question_key, 'buildAnswer: question_key');
  if (questionId === null && (shopId === null || questionKey === null)) {
    fail('buildAnswer: identify the question either by question_id, or by shop_id + question_key.');
  }

  let answerText = optionalText(intent.answer_text, 'buildAnswer: answer_text');
  if (status === 'answered' && answerText === null) {
    fail('buildAnswer: answer_text is required when status is "answered".');
  }

  let answerSource = optionalText(intent.answer_source, 'buildAnswer: answer_source');
  if (answerSource !== null) requireOneOf(answerSource, ANSWER_SOURCES, 'buildAnswer: answer_source');

  return {
    question_id: questionId,
    shop_id: shopId,
    question_key: questionKey,
    set: {
      status: status,
      answer_text: answerText,
      answer_source: answerSource
    },
    event: {
      event_type: 'decision',
      from_status: null,
      to_status: null,
      description: optionalText(intent.description, 'buildAnswer: description') ||
        ('question "' + (questionKey || String(questionId)) + '" ' + status +
          (answerText === null ? '' : ': ' + answerText))
    }
  };
}

// ---------------------------------------------------------------------
// buildBrowserRequest - the durable "build the ASDA basket" ask.
//
// Always created 'queued'. A caller cannot create one already 'claimed':
// claiming is an atomic UPDATE in the writer, and that is the only thing that
// keeps two runners from both believing they hold it.
// ---------------------------------------------------------------------
function buildBrowserRequest(intent) {
  const source = isPlainObject(intent) ? intent : { shop_id: intent };
  if (source.status !== undefined && source.status !== null && source.status !== 'queued') {
    fail('buildBrowserRequest: a request is always created "queued" (asked for "' + String(source.status) +
      '"). Claiming is an atomic UPDATE, never an INSERT.');
  }
  return {
    row: {
      shop_id: toDbId(source.shop_id, 'buildBrowserRequest: shop_id'),
      status: 'queued'
    },
    columns: ['shop_id', 'status']
  };
}

// ---------------------------------------------------------------------
// buildPendingAction - browser-only maintenance that could not be completed
// (e.g. "add Wall's to ASDA Favourites"). Surfaced in status, never forgotten.
// ---------------------------------------------------------------------
function buildPendingAction(intent) {
  if (!isPlainObject(intent)) fail('buildPendingAction: an intent object is required.');

  let payload = intent.payload;
  if (payload === undefined || payload === null) payload = {};
  if (!isPlainObject(payload)) {
    fail('buildPendingAction: payload must be an object (jsonb, defaults to {}), got ' +
      (Array.isArray(payload) ? 'an array' : typeof payload) + '.');
  }

  const row = {
    household_id: toDbId(intent.household_id, 'buildPendingAction: household_id'),
    shop_id: optionalDbId(intent.shop_id, 'buildPendingAction: shop_id'),
    action_type: requireText(intent.action_type, 'buildPendingAction: action_type'),
    action_key: requireText(intent.action_key, 'buildPendingAction: action_key'),
    payload: payload
  };

  return { row: row, columns: PENDING_ACTION_INSERT_COLUMNS.slice() };
}

module.exports = {
  // vocabularies
  SHOP_STATUSES: SHOP_STATUSES,
  SOURCE_KINDS: SOURCE_KINDS,
  EVENT_TYPES: EVENT_TYPES,
  QUESTION_STATUSES: QUESTION_STATUSES,
  ANSWER_SOURCES: ANSWER_SOURCES,
  BROWSER_STATUSES: BROWSER_STATUSES,
  BROWSER_LIVE_STATUSES: BROWSER_LIVE_STATUSES,
  PENDING_ACTION_STATUSES: PENDING_ACTION_STATUSES,
  LIVE_STATUSES: LIVE_STATUSES,
  TERMINAL_STATUSES: TERMINAL_STATUSES,
  ABORT_STATUSES: ABORT_STATUSES,

  // column lists
  SHOP_INSERT_COLUMNS: SHOP_INSERT_COLUMNS,
  QUESTION_INSERT_COLUMNS: QUESTION_INSERT_COLUMNS,
  PENDING_ACTION_INSERT_COLUMNS: PENDING_ACTION_INSERT_COLUMNS,

  // the state machine
  ALLOWED_TRANSITIONS: ALLOWED_TRANSITIONS,
  isTransitionAllowed: isTransitionAllowed,
  assertTransition: assertTransition,

  // refs
  nextShopRef: nextShopRef,
  collisionShopRef: collisionShopRef,
  isShopRef: isShopRef,
  SHOP_REF_PATTERN: SHOP_REF_PATTERN,

  // builders
  buildShopCreate: buildShopCreate,
  buildTransition: buildTransition,
  buildQuestion: buildQuestion,
  buildAnswer: buildAnswer,
  buildBrowserRequest: buildBrowserRequest,
  buildPendingAction: buildPendingAction,

  _internal: {
    toDbId: toDbId,
    requireText: requireText,
    toDatePart: toDatePart,
    daysInMonth: daysInMonth
  }
};
