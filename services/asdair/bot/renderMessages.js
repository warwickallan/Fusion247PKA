// =====================================================================
// BUILD-015 AsdAIr — bot: renderMessages.js
//
// THE MESSAGE CATALOGUE. Every message ShopperBot sends while Warwick drives a
// supervised weekly shop from Telegram, as a PURE function returning exactly
//   { text, reply_markup }
// — the two fields sendShopperMessage.js puts on the wire.
//
// ── PURITY CONTRACT (enforced by review AND by the tests) ────────────────────
// No clock. No network. No database. No filesystem. No randomness. No global
// state. EVERY number, name and count in the output comes from the argument
// object. A renderer called twice with the same argument returns the same bytes.
// That is what makes the catalogue reviewable: if a count is wrong on Warwick's
// phone, the fault is upstream in the projection, never in here.
//
// ── NEVER FABRICATE ──────────────────────────────────────────────────────────
// A missing or unknown value renders as the literal word "unknown". Never 0,
// never "-", never a guess. `count()` and `value()` below are the only way a
// dynamic value reaches the text, so this holds catalogue-wide, not just on the
// status card the directive called out. A shop where AsdAIr does not know how
// many items were held must SAY it does not know.
//
// ── PLAIN TEXT, NO parse_mode ────────────────────────────────────────────────
// Sent as plain text with NO parse_mode, exactly as services/hub/decision/
// renderCard.mjs does and for the same reason: real product names routinely
// contain `_ * [ ] ( )` and backticks ("Nature's Pick 100% Fruit (6 pack)"),
// which would break a Markdown send or, worse, be silently swallowed. Plain
// text is unambiguously safe for any content, so nothing needs escaping.
//
// ── WHAT THIS MODULE IS NOT ──────────────────────────────────────────────────
// It does not plan, resolve, substitute, drive a browser, check out or pay. It
// turns an already-computed object into words and buttons. Nothing more.
// =====================================================================

import {
  ACTIONS,
  buildCallbackData,
  buildAnswerArg,
  assertShopRef,
  assertQuestionKey,
} from './callbackProtocol.js';

/** Longest button LABEL we will render. Cosmetic only — never applied to
 *  callback_data, which is validated and never truncated (callbackProtocol.js). */
export const MAX_BUTTON_LABEL_CHARS = 40;

/** Sanity cap on how many candidate buttons one question card offers. */
export const MAX_CANDIDATE_BUTTONS = 8;

/** The literal rendered for anything AsdAIr does not know. */
export const UNKNOWN = 'unknown';

// ── value helpers ────────────────────────────────────────────────────────────

/**
 * PURE. Render a COUNT. Only a finite number is a count; null, undefined, NaN,
 * a string and a boolean are all "unknown". Deliberately strict: a count is the
 * kind of value a half-built projection is most likely to leave absent, and
 * printing 0 for "I have not worked that out yet" is the exact lie this build
 * exists to stop telling.
 */
export function count(v) {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : UNKNOWN;
}

/**
 * PURE. Render any scalar (a number, or a caller-formatted string such as
 * "£84.20" or "never auto-substitute"). Empty/blank/absent => "unknown".
 * Currency is NEVER formatted here — this module has no idea what currency,
 * rounding or VAT treatment applies, so it prints exactly what it was given.
 */
export function value(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : UNKNOWN;
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return UNKNOWN;
}

/** PURE. Shorten a button LABEL for display only. Never touches callback_data. */
export function labelFor(text, fallback = '(unnamed)') {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s) return fallback;
  if (s.length <= MAX_BUTTON_LABEL_CHARS) return s;
  return `${s.slice(0, MAX_BUTTON_LABEL_CHARS - 1)}…`;
}

// ── keyboard helpers ─────────────────────────────────────────────────────────

/** PURE. One inline button. The callback_data goes through the protocol, always. */
export function button(label, action, shopRef, arg = null) {
  return { text: labelFor(label), callback_data: buildCallbackData({ action, shopRef, arg }) };
}

/** PURE. Wrap rows of buttons into a Telegram reply_markup. */
function keyboard(rows) {
  return { inline_keyboard: rows.filter((r) => Array.isArray(r) && r.length > 0) };
}

/** PURE. Join non-empty lines. */
function block(lines) {
  return lines.filter((l) => l !== null && l !== undefined).join('\n');
}

// ── 1. Receipt ───────────────────────────────────────────────────────────────

/**
 * PURE. Acknowledge that the week's list landed and is safe.
 *
 * THERE IS DELIBERATELY NO "Keep raw" BUTTON. The raw list — the typed text or
 * the photo of Mum's handwriting — is ALWAYS retained, unconditionally and
 * without asking. It is the evidence the shop was produced from: every later
 * claim ("this is what you asked for", "this line was excluded by rule 6",
 * "that substitution was never authorised") is only checkable against the
 * original. Offering to discard it would make retention look optional, and a
 * single mis-tap would destroy the audit trail for that week's shop. Retention
 * is a property of the system, not a choice on a card.
 *
 * @param {{shopRef:string, source?:string}} spec
 */
export function renderReceipt({ shopRef, source } = {}) {
  assertShopRef(shopRef);
  return {
    text: block([
      '🛒 Shopping list received',
      `Ref: ${value(shopRef)}`,
      `Source: ${value(source)}`,
      'Status: Safely stored',
      'Next: Ready to process',
    ]),
    reply_markup: keyboard([
      [button('Build this shop', ACTIONS.BUILD, shopRef)],
      [button('Review list', ACTIONS.REVIEW, shopRef), button('Cancel', ACTIONS.CANCEL, shopRef)],
    ]),
  };
}

// ── 2. Plan ready ────────────────────────────────────────────────────────────

/**
 * PURE. The planner has resolved the list against Regulars, aliases and the
 * standing rules; here is what it found and what it still needs.
 *
 * `needDecision` drives the first button's label ("Answer N questions"), so a
 * null count renders "Answer unknown questions" rather than inventing "0" and
 * implying there is nothing to answer.
 *
 * @param {{shopRef:string, listLines?:number, resolved?:number, needDecision?:number,
 *          excludedByRule?:number, substitutions?:string}} spec
 */
export function renderPlanReady({
  shopRef, listLines, resolved, needDecision, excludedByRule, substitutions,
} = {}) {
  assertShopRef(shopRef);
  return {
    text: block([
      '📋 Plan ready',
      `Ref: ${value(shopRef)}`,
      `List lines: ${count(listLines)}`,
      `Resolved: ${count(resolved)}`,
      `Need a decision: ${count(needDecision)}`,
      `Excluded by a standing rule: ${count(excludedByRule)}`,
      `Substitutions: ${value(substitutions)}`,
    ]),
    reply_markup: keyboard([
      [button(`Answer ${count(needDecision)} questions`, ACTIONS.ANSWER, shopRef)],
      [button('Build ASDA basket', ACTIONS.BASKET, shopRef), button('View status', ACTIONS.STATUS, shopRef)],
    ]),
  };
}

// ── 3. Question card ─────────────────────────────────────────────────────────

/**
 * PURE. ONE genuinely unresolved item. Standing rule: an item AsdAIr cannot
 * confidently match is asked about, never silently resolved and never
 * auto-substituted — so this card is the only route from "unknown" to "in the
 * basket".
 *
 * Candidates may be plain strings or `{ label }` objects. The candidate INDEX
 * (its position in `candidates`, 0-based) is what travels in callback_data —
 * see buildAnswerArg — so the caller MUST persist this exact ordered candidate
 * list against `questionKey`.
 *
 * A typed reply is equally valid: inboundRouter.js correlates a reply to THIS
 * message back to `questionKey`, and the prompt below tells Warwick so.
 *
 * @param {{shopRef:string, questionKey:string, item?:string, note?:string,
 *          candidates?:Array<string|{label:string}>}} spec
 */
export function renderQuestionCard({ shopRef, questionKey, item, note, candidates = [] } = {}) {
  assertShopRef(shopRef);
  assertQuestionKey(questionKey);
  const list = Array.isArray(candidates) ? candidates.slice(0, MAX_CANDIDATE_BUTTONS) : [];
  const labels = list.map((c) => labelFor(typeof c === 'string' ? c : (c && c.label)));

  const lines = [
    '❓ Needs a decision',
    `Ref: ${value(shopRef)}`,
    `Item: ${value(item)}`,
  ];
  if (note) lines.push(`Note: ${value(note)}`);
  if (labels.length > 0) {
    lines.push('');
    lines.push('Candidates:');
    labels.forEach((l, i) => lines.push(`  ${i + 1}. ${l}`));
  } else if (!note) {
    // ── WP-B15-08 AC4: THE CARD MUST SAY ONE TRUE THING ────────────────────
    // This line used to depend on the BUTTON list alone. The planner's
    // candidates are split by whether they carry a trustworthy product id: the
    // ones that do become buttons, the ones that do not become the Note above.
    // So a card whose candidates ALL landed in the second bucket printed its
    // suggestions and then announced, directly underneath them, that there were
    // none. Both halves are generated from the SAME question row and cannot be
    // allowed to disagree. "None found" is now said only when the card is
    // genuinely offering nothing - no buttons AND no note.
    lines.push('');
    lines.push('No candidate products found.');
  }
  lines.push('');
  lines.push(labels.length > 0
    ? 'Tap a candidate, or reply to this message with the product you want.'
    : 'Reply to this message with the product you want.');

  const rows = labels.map((l, i) => [button(l, ACTIONS.ANSWER, shopRef, buildAnswerArg(questionKey, i))]);
  // ── WP-B15-08 AC10: A CONTROL THE SYSTEM REFUSES MUST NOT BE DRAWN ────────
  // 'Search ASDA' (ACTIONS.SEARCH) was rendered here on EVERY question card and
  // handled NOWHERE: telegramAdapter refuses it as NOT_A_COMMAND, because
  // searching ASDA is a supervised browser step and nothing in this pipeline
  // drives a browser. Warwick pressed it on 2026-08-10 and nothing happened -
  //   {"event":"inbound_refused","updateId":171031159,"action":"search", ...}
  // Withdrawing the button is the honest fix. ACTIONS.SEARCH stays in the
  // protocol (other surfaces declare it); what is removed is the DRAWING of a
  // control this runtime will refuse. This deliberately does NOT implement an
  // ASDA search - that is unscoped product work.
  rows.push([button('Skip this week', ACTIONS.SKIP, shopRef, questionKey)]);

  return { text: block(lines), reply_markup: keyboard(rows) };
}

// ── 3b. Interpretation-confirmation card ─────────────────────────────────────

/** Day names for humanTime(). UTC, deterministic, no locale machinery. */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ISO-8601 timestamp, minute precision or better, optional zone suffix. */
const ISO_TS_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** PURE. Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm). */
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** PURE. The exact inverse of daysFromCivil. */
function civilFromDays(z0) {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

/**
 * PURE. A human-readable UTC rendering of an ISO timestamp string.
 *
 * "Sat 2026-08-08 20:41 UTC" - enough for a human to compare two photographs'
 * arrival times at a glance, which is the wrong-week criterion's whole point.
 *
 * DELIBERATELY WITHOUT the Date constructor: this folder's purity guard
 * (noPolling.test.js) forbids it in the pure modules, and rightly - it drags
 * in the host clock and locale machinery. So the string is
 * parsed and converted by calendar arithmetic instead: a `Z` or offset suffix
 * is normalised to UTC exactly, and the weekday falls out of days-since-epoch
 * (1970-01-01 was a Thursday). Anything unparseable - including an impossible
 * calendar date like Feb 30, caught by the round-trip check - renders as
 * "unknown", never as a fabricated time.
 */
export function humanTime(isoString) {
  if (typeof isoString !== 'string') return UNKNOWN;
  const m = ISO_TS_RE.exec(isoString.trim());
  if (!m) return UNKNOWN;
  const [, ys, mos, ds, hs, mins, zone] = m;
  const y = Number(ys); const mo = Number(mos); const d = Number(ds);
  const h = Number(hs); const min = Number(mins);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || min > 59) return UNKNOWN;
  const days = daysFromCivil(y, mo, d);
  const back = civilFromDays(days);
  if (back.y !== y || back.m !== mo || back.d !== d) return UNKNOWN; // Feb 30 etc.

  let offsetMin = 0;
  if (zone && zone !== 'Z') {
    const zm = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
    if (!zm) return UNKNOWN;
    offsetMin = (zm[1] === '-' ? -1 : 1) * (Number(zm[2]) * 60 + Number(zm[3]));
  }

  const totalMin = days * 1440 + h * 60 + min - offsetMin;
  const utcDays = Math.floor(totalMin / 1440);
  const rem = totalMin - utcDays * 1440;
  const civil = civilFromDays(utcDays);
  const weekday = ((utcDays % 7) + 4 + 7) % 7; // 1970-01-01 (day 0) was Thursday (4)
  const pad = (n) => String(n).padStart(2, '0');
  return `${DAY_NAMES[weekday]} ${civil.y}-${pad(civil.m)}-${pad(civil.d)} `
    + `${pad(Math.floor(rem / 60))}:${pad(rem % 60)} UTC`;
}

/**
 * PURE. THE INTERPRETATION-CONFIRMATION CARD (WP-B15-1) - the production
 * surface of the needs_review gate. A photographed list is not declared ready
 * to shop on AsdAIr's own say-so: this card shows the human WHAT was read and
 * exactly WHICH photograph it was read from, and the Confirm tap is the
 * deliberate act that opens the gate.
 *
 * ── EXACT-SOURCE BINDING, RENDERED HONESTLY ─────────────────────────────────
 * The card names the photograph by its received time and immutable content-
 * fingerprint prefix. A shop with no stored fingerprint (received before
 * fingerprinting existed) says so in words - the absence is rendered, never
 * papered over with a fabricated value.
 *
 * ── THE WRONG-WEEK COMPARISON IS HUMAN-READABLE, NOT A BARE HASH ────────────
 * A hash prefix alone is not evidence a human can act on: a re-sent July
 * photograph arrives with THIS week's received timestamp, and two hex strings
 * differ invisibly. So the card carries the PREVIOUS photo shop's identity and
 * received time beside this one's, and - when both fingerprints exist and are
 * EQUAL - a loud "same photograph" warning, because identical content is the
 * one wrong-week condition that can be stated mechanically without lying.
 *
 * ── NO PHYSICAL-LINE COUNT IS CLAIMED, BECAUSE NONE EXISTS ──────────────────
 * Only the model's own line count is recorded anywhere in this system. Line
 * completeness is verified by the HUMAN at this gate, comparing card against
 * photograph - the card says exactly that, and never presents the interpreted
 * count as an independent check.
 *
 * @param {{shopRef:string, interpretedLines?:number,
 *          fingerprintPrefix?:string|null, fingerprintAlgo?:string|null,
 *          receivedAt?:string|null,
 *          priorShopRef?:string|null, priorReceivedAt?:string|null,
 *          samePhotoAsPrior?:boolean|null}} spec
 */
export function renderConfirmInterpretation({
  shopRef, interpretedLines,
  fingerprintPrefix, fingerprintAlgo,
  receivedAt,
  priorShopRef, priorReceivedAt, samePhotoAsPrior,
} = {}) {
  assertShopRef(shopRef);

  const lines = [
    '🔍 Confirm this reading',
    `Ref: ${value(shopRef)}`,
    '',
    `This plan was read from the photograph received ${humanTime(receivedAt)}.`,
    typeof fingerprintPrefix === 'string' && fingerprintPrefix.length > 0
      ? `Photo fingerprint: ${value(fingerprintAlgo)}:${fingerprintPrefix}…`
      : 'Photo fingerprint: none was recorded at intake for this shop.',
    '',
    `Lines read from the photograph: ${count(interpretedLines)}`,
    'Physical lines on the page: not counted by AsdAIr — check the reading',
    'against the photograph yourself before confirming.',
    '',
  ];

  if (priorShopRef) {
    lines.push(`Previous photo shop: ${value(priorShopRef)}, photograph received ${humanTime(priorReceivedAt)}.`);
    if (samePhotoAsPrior === true) {
      lines.push('⚠️ THIS IS THE SAME PHOTOGRAPH as that shop\'s — if you expected a new');
      lines.push('list this week, do NOT confirm.');
    } else if (samePhotoAsPrior === null || samePhotoAsPrior === undefined) {
      lines.push('(The two photographs could not be compared by content — check the times.)');
    }
  } else {
    lines.push('Previous photo shop: none on record — this is the first photographed list.');
  }

  lines.push('');
  lines.push('Tap Confirm this reading to approve it. If anything is wrong, do not');
  lines.push('confirm — review the list first.');

  return {
    text: block(lines),
    reply_markup: keyboard([
      [button('Confirm this reading', ACTIONS.APPROVE, shopRef)],
      [button('Review list', ACTIONS.REVIEW, shopRef), button('Cancel', ACTIONS.CANCEL, shopRef)],
    ]),
  };
}

// ── 4. Progress ──────────────────────────────────────────────────────────────

/**
 * PURE. MILESTONE-LEVEL ONLY. Warwick gets one message per meaningful stage of
 * the basket build, not a line per click: a per-item feed would bury the two
 * things that actually need his attention (held items and substitutions) under
 * dozens of notifications, and would make the phone unusable during a shop.
 *
 * ── WHERE THE CHECKLIST IS (AC7) ────────────────────────────────────────────
 * This card announced that the browser build had been requested and gave
 * Warwick NO WAY TO REACH WHAT HE WAS SUPPOSED TO SHOP FROM. The checklist -
 * every line, the full method, the five prohibitions - was rendered nowhere, by
 * nothing, because `handoff/renderChecklist.js` had no production caller. Being
 * told a shop is ready, with no list, is the same silent park this build has
 * closed three times already.
 *
 * `checklistPath` is rendered ONLY when the producer supplied one, so the older
 * progress cards - which have no checklist behind them - do not grow a line
 * pointing at nothing. An absent path renders NOTHING rather than an "unknown":
 * a dead link on a card someone is holding in a supermarket is worse than
 * silence.
 *
 * @param {{shopRef:string, stage?:string, regularsAdded?:number, searchItemsAdded?:number,
 *          held?:number, substitutions?:number, basketLines?:number,
 *          checklistPath?:string}} spec
 */
export function renderProgress({
  shopRef, stage, regularsAdded, searchItemsAdded, held, substitutions, basketLines,
  checklistPath,
} = {}) {
  assertShopRef(shopRef);
  const checklist = typeof checklistPath === 'string' && checklistPath.trim() !== ''
    ? ['', 'Your checklist - every line, the method, and what never to do:', checklistPath.trim()]
    : [];
  return {
    text: block([
      '⏳ Building the basket',
      `Ref: ${value(shopRef)}`,
      `Stage: ${value(stage)}`,
      `Regulars added: ${count(regularsAdded)}`,
      `Search items added: ${count(searchItemsAdded)}`,
      `Held: ${count(held)}`,
      `Substitutions: ${count(substitutions)}`,
      `Basket lines: ${count(basketLines)}`,
      ...checklist,
    ]),
    reply_markup: keyboard([
      [button('View held items', ACTIONS.HELD, shopRef)],
      [button('View status', ACTIONS.STATUS, shopRef), button('Pause', ACTIONS.PAUSE, shopRef)],
    ]),
  };
}

// ── 5. Basket ready ──────────────────────────────────────────────────────────

/**
 * PURE. The basket is built and waiting. NOTHING has been ordered: AsdAIr never
 * books a slot, never checks out and never pays — Warwick does that himself, in
 * his own browser session, and then forwards the confirmation.
 *
 * `estimatedTotal` is very often null in practice: there is no price column on
 * products or regulars (BUILD-015 goal contract, "Deferred"), so it renders
 * "unknown" rather than a fabricated figure.
 *
 * @param {{shopRef:string, lines?:Array<string|{label:string, qty?:number|string}>,
 *          estimatedTotal?:number|string, substitutions?:number, newRegulars?:number,
 *          aliasesLearned?:number, productIdsCaptured?:number, exceptions?:number}} spec
 */
/** The boundary this product never crosses, stated on every basket handback. */
const NO_ORDER_LINE =
  'Nothing has been ordered: no checkout, no payment, no delivery slot. Those stay with you.';

/** PURE. One itemised section, omitted entirely when it has no members. */
function section(out, heading, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  out.push('');
  out.push(heading);
  for (const item of items) out.push(`  • ${item}`);
}

/**
 * PURE. Name a product line for display. Never invents a quantity: a line whose
 * quantity is unknown prints its name alone rather than "x unknown", because a
 * fabricated 1 is exactly what verifyBasket refuses to default.
 */
function namedQty(name, qty) {
  return Number.isInteger(qty) ? `${value(name)} x${qty}` : value(name);
}

/**
 * PURE. THE BASKET HANDBACK, DERIVED FROM THE VERIFICATION — NEVER FROM RAW
 * CAPTURED LINES.
 *
 * ── WHY THE VERIFICATION IS THE SUBJECT AND THE CONTENTS ARE NOT ────────────
 * "Basket ready" is a CLAIM THAT RECONCILIATION PASSED. A card that reports what
 * is in the basket without reporting whether it reconciles is the same lie in a
 * friendlier font: it reads as ready, and the wrong product is bought and paid
 * for before anybody finds out. So `verification` is the first thing rendered
 * and the thing the headline is derived from.
 *
 * ── FAIL SAFE: ABSENT VERIFICATION IS LOUD, NOT REASSURING ──────────────────
 * `verification` absent or null renders **NOT VERIFIED**, with no counts, no
 * product lines and no totals. It deliberately does NOT fall back to a
 * well-shaped card full of zeros — a zero is a measurement, and rendering one we
 * never took is the `ok: true` failure this build keeps re-committing. A producer
 * that forgets the field therefore gets the alarming card, never the calm one.
 *
 * ── counts_match IS NOT THE VERDICT, AND IS LABELLED SO ─────────────────────
 * reconcile/verifyBasket.js computes `verified` from the LINES and reports
 * `counts_match` separately, precisely because two wrong products swapped for
 * each other match perfectly. The card keeps them apart and says which one is
 * the verdict, so a matching headline can never read as ready.
 *
 * ── THE WORD "SUBSTITUTED" DOES NOT APPEAR, AND CANNOT ──────────────────────
 * Substitution is not a permitted outcome anywhere in this product; the report
 * status enum deliberately has no such value. An unobtainable line is named as
 * UNAVAILABLE and handed to Warwick to decide. The old `Substitutions: <count>`
 * field is gone from this card: a field that can only ever be 0 still implies
 * the thing could happen.
 *
 * @param {{shopRef:string,
 *          verification?: null | {
 *            verified:boolean, blocking?:string[], countsMatch?:boolean|null,
 *            expectedDistinctProducts?:number, actualDistinctProducts?:number,
 *            expectedTotalUnits?:number, actualTotalUnits?:number,
 *            unavailable?:Array<{name:string, quantity?:number}>,
 *            missing?:Array<{name:string, quantity?:number}>,
 *            quantityMismatches?:Array<{name:string, expected:number, actual:number}>,
 *            unexpected?:Array<{name:string, quantity?:number}>,
 *            nameOnlyMatches?:string[],
 *            packetSelfConsistent?:boolean|null },
 *          notVerifiedReason?:string,
 *          boundaryConfirmationsComplete?:boolean,
 *          boundaryConfirmationsMissing?:string[],
 *          lines?:Array, estimatedTotal?:*, newRegulars?:*, aliasesLearned?:*,
 *          productIdsCaptured?:*, exceptions?:*}} spec
 */
export function renderBasketReady({
  shopRef, verification, notVerifiedReason,
  boundaryConfirmationsComplete, boundaryConfirmationsMissing,
  lines = [], estimatedTotal, newRegulars, aliasesLearned, productIdsCaptured, exceptions,
} = {}) {
  assertShopRef(shopRef);

  const buttons = keyboard([
    [button('Send order confirmation', ACTIONS.CONFIRM, shopRef)],
    [button('View exceptions', ACTIONS.EXCEPTIONS, shopRef), button('Close shop', ACTIONS.CLOSE, shopRef)],
  ]);

  // ── NOT VERIFIED. No counts, no lines, no totals, no zeros. ───────────────
  if (verification === null || verification === undefined) {
    return {
      text: block([
        '⚠️ Basket NOT VERIFIED',
        `Ref: ${value(shopRef)}`,
        '',
        'The basket has NOT been checked against the plan, so nothing below can be',
        'reported about its contents.',
        `Reason: ${value(notVerifiedReason)}`,
        '',
        'Do not treat this as ready. Check the basket yourself before you check out.',
        '',
        NO_ORDER_LINE,
      ]),
      reply_markup: buttons,
    };
  }

  const v = verification;
  const ok = v.verified === true;

  // THE HEADLINE IS THE VERDICT. Not the counts, and when it is false it is the
  // first thing on the card, before anything that could read as reassurance.
  const out = [
    ok ? '🧺 Basket ready — VERIFIED against the plan' : '⚠️ Basket NOT VERIFIED — do not check out yet',
    `Ref: ${value(shopRef)}`,
  ];

  if (!ok) {
    section(out, 'Not verified because:',
      Array.isArray(v.blocking) && v.blocking.length > 0
        ? v.blocking
        : ['the verification did not pass, and reported no reason']);
  }

  // Two separate facts, never merged into one "count".
  out.push('');
  out.push(`Distinct products: expected ${count(v.expectedDistinctProducts)}, basket ${count(v.actualDistinctProducts)}`);
  out.push(`Total units: expected ${count(v.expectedTotalUnits)}, basket ${count(v.actualTotalUnits)}`);
  out.push(
    v.countsMatch === true || v.countsMatch === false
      ? `Counts match: ${v.countsMatch ? 'yes' : 'no'} — headline only, NOT the verdict`
      : 'Counts match: unknown',
  );

  section(out, 'UNAVAILABLE at ASDA — nothing was put in its place, you decide:',
    (v.unavailable || []).map((u) => namedQty(u && u.name, u && u.quantity)));
  section(out, 'MISSING from the basket:',
    (v.missing || []).map((m) => namedQty(m && m.name, m && m.quantity)));
  section(out, 'WRONG QUANTITY:',
    (v.quantityMismatches || []).map((q) => `${value(q && q.name)}: expected ${count(q && q.expected)}, basket ${count(q && q.actual)}`));
  section(out, 'IN THE BASKET but on no planned line:',
    (v.unexpected || []).map((u) => namedQty(u && u.name, u && u.quantity)));
  section(out, 'Matched on NAME ONLY (the weakest identity — worth an eye):',
    (v.nameOnlyMatches || []).map((n) => value(n)));

  // A producer defect, and named as one so it is never blamed on the basket.
  if (v.packetSelfConsistent === false) {
    out.push('');
    out.push('NOTE: the plan\'s own declared counts disagree with its own lines.');
    out.push('That is a defect in the plan, not in the basket.');
  }

  if (boundaryConfirmationsComplete === false) {
    section(out, 'NOT CONFIRMED by the shopper:',
      (boundaryConfirmationsMissing || []).map((b) => value(b)));
  }

  // The learning counts stay, unchanged, below the verification.
  const products = Array.isArray(lines) ? lines : [];
  if (products.length > 0) {
    out.push('');
    out.push(`Product lines (${count(products.length)}):`);
    for (const line of products) {
      if (typeof line === 'string') { out.push(`  • ${value(line)}`); continue; }
      const qty = line && line.qty !== undefined ? ` x${value(line.qty)}` : '';
      out.push(`  • ${value(line && line.label)}${qty}`);
    }
  }
  out.push('');
  out.push(`Estimated total: ${value(estimatedTotal)}`);
  out.push(`New regulars: ${count(newRegulars)}`);
  out.push(`Aliases learned: ${count(aliasesLearned)}`);
  out.push(`Product IDs captured: ${count(productIdsCaptured)}`);
  out.push(`Exceptions: ${count(exceptions)}`);
  out.push('');
  out.push(NO_ORDER_LINE);

  return { text: block(out), reply_markup: buttons };
}

// ── 6. Status ────────────────────────────────────────────────────────────────

/**
 * PURE. Render a STATUS PROJECTION built elsewhere. This renderer takes a plain
 * object and reads named fields off it — it never queries, derives or infers.
 *
 * Any field that is absent, null, or not a finite number renders as "unknown".
 * That is the whole point of this card: mid-shop, "I do not know how many items
 * are held" is a true and useful answer, whereas "0 held" is a lie that would
 * send Warwick to checkout with items missing.
 *
 * @param {{shopRef:string, state?:string, listLines?:number, resolved?:number,
 *          needDecision?:number, held?:number, basketLines?:number,
 *          substitutions?:number, exceptions?:number, estimatedTotal?:number|string,
 *          lastEvent?:string, updatedAt?:string}} projection
 */
export function renderStatus(projection = {}) {
  const p = projection && typeof projection === 'object' ? projection : {};
  assertShopRef(p.shopRef);
  return {
    text: block([
      '📊 Shop status',
      `Ref: ${value(p.shopRef)}`,
      `State: ${value(p.state)}`,
      `List lines: ${count(p.listLines)}`,
      `Resolved: ${count(p.resolved)}`,
      `Need a decision: ${count(p.needDecision)}`,
      `Held: ${count(p.held)}`,
      `Basket lines: ${count(p.basketLines)}`,
      `Substitutions: ${count(p.substitutions)}`,
      `Exceptions: ${count(p.exceptions)}`,
      `Estimated total: ${value(p.estimatedTotal)}`,
      `Last event: ${value(p.lastEvent)}`,
      `Updated: ${value(p.updatedAt)}`,
    ]),
    reply_markup: keyboard([
      [button('View held items', ACTIONS.HELD, p.shopRef), button('View exceptions', ACTIONS.EXCEPTIONS, p.shopRef)],
    ]),
  };
}

// ── 7. Failure ───────────────────────────────────────────────────────────────

/**
 * PURE. A step failed, and Warwick is TOLD. A supervised shop that silently
 * stalls is worse than one that fails loudly: he would keep waiting for a
 * basket that is never coming. `detail` must already be a caller-sanitised,
 * human-readable string — this renderer prints exactly what it is handed and
 * never reaches for an error object, a stack or an environment value.
 *
 * @param {{shopRef:string, stage?:string, detail?:string}} spec
 */
export function renderFailure({ shopRef, stage, detail } = {}) {
  assertShopRef(shopRef);
  return {
    text: block([
      '🚨 Shop step failed',
      `Ref: ${value(shopRef)}`,
      `Stage: ${value(stage)}`,
      `Detail: ${value(detail)}`,
      '',
      'Nothing was ordered. Retry when you are ready.',
    ]),
    reply_markup: keyboard([
      [button('Retry', ACTIONS.RETRY, shopRef), button('View status', ACTIONS.STATUS, shopRef)],
    ]),
  };
}

// ── 8. Confirmation received ─────────────────────────────────────────────────

/**
 * PURE. Warwick has forwarded the ASDA order confirmation. Reconciliation of
 * what was actually bought against what was planned starts now — this card only
 * says so; it does not perform it.
 *
 * @param {{shopRef:string, source?:string}} spec
 */
export function renderConfirmationReceived({ shopRef, source } = {}) {
  assertShopRef(shopRef);
  const lines = ['🧾 Order confirmation received', `Ref: ${value(shopRef)}`];
  if (source !== undefined) lines.push(`Source: ${value(source)}`);
  lines.push('Status: Reconciling against planned basket');
  return {
    text: block(lines),
    reply_markup: keyboard([[button('View status', ACTIONS.STATUS, shopRef)]]),
  };
}

// ── 9. Reconciliation summary ────────────────────────────────────────────────

/**
 * PURE. What the confirmation says versus what was planned. This is the record
 * that makes the next shop better informed than this one — the difference
 * between planned and actual is exactly where new regulars, new aliases and
 * corrected quantities come from.
 *
 * "Price missing" is expected to be non-zero for the foreseeable future: there
 * is no committed price source (goal contract, "Deferred"). It is reported, not
 * hidden.
 *
 * @param {{shopRef:string, purchasedAsPlanned?:number, addedAfterPlanning?:number,
 *          omitted?:number, qtyChanged?:number, variantChanged?:number,
 *          priceMissing?:number, unresolved?:number}} spec
 */
export function renderReconciliationSummary({
  shopRef, purchasedAsPlanned, addedAfterPlanning, omitted,
  qtyChanged, variantChanged, priceMissing, unresolved,
} = {}) {
  assertShopRef(shopRef);
  return {
    text: block([
      '📑 Reconciliation summary',
      `Ref: ${value(shopRef)}`,
      `Purchased as planned: ${count(purchasedAsPlanned)}`,
      `Added after planning: ${count(addedAfterPlanning)}`,
      `Omitted: ${count(omitted)}`,
      `Quantity changed: ${count(qtyChanged)}`,
      `Variant changed: ${count(variantChanged)}`,
      `Price missing: ${count(priceMissing)}`,
      `Unresolved: ${count(unresolved)}`,
    ]),
    reply_markup: keyboard([
      [button('View exceptions', ACTIONS.EXCEPTIONS, shopRef), button('Close shop', ACTIONS.CLOSE, shopRef)],
    ]),
  };
}

/**
 * THE SHOP IS WAITING ON A LINE, NOT ON A QUESTION (WP-B15-2).
 *
 * The gate that makes READY_TO_SHOP unreachable while a line is undecided
 * needs a voice, or it is just a shop that stopped. This is that voice.
 *
 * It names the items so the message is actionable rather than an apology, and
 * it distinguishes the two reasons a line is stuck - never answered, versus
 * answered in a way that could not be understood - because they need
 * different things from Warwick.
 */
export function renderLinesUnresolved({
  shopRef, items, unresolvedCount, awaitingClarification,
} = {}) {
  assertShopRef(shopRef);

  const named = Array.isArray(items) ? items.filter((i) => typeof i === 'string' && i !== '') : [];
  const total = Number.isFinite(Number(unresolvedCount)) ? Number(unresolvedCount) : named.length;
  const clarifying = Number.isFinite(Number(awaitingClarification)) ? Number(awaitingClarification) : 0;

  const lines = [
    '⏸️ Waiting on you before this shop can go ahead',
    `Ref: ${value(shopRef)}`,
    '',
    `${count(total)} line(s) still need a decision, so the basket is not ready.`,
    '',
  ];

  if (named.length > 0) {
    lines.push('Waiting on:');
    for (const item of named) lines.push(`  • ${value(item)}`);
    if (total > named.length) lines.push(`  …and ${count(total - named.length)} more`);
    lines.push('');
  }

  if (clarifying > 0) {
    lines.push(`${count(clarifying)} of these were answered, but the answer could not be`);
    lines.push('read confidently — a follow-up question has been sent rather than');
    lines.push('a guess being made.');
    lines.push('');
  }

  lines.push('Nothing has been added to a basket and nothing has been ordered.');
  lines.push('Answer the open question(s) above and this shop will carry on by itself.');

  return {
    text: block(lines),
    reply_markup: keyboard([
      // ANSWER with NO arg is "open the question queue" - the same act the
      // plan-ready card offers. It deliberately does not carry a question key:
      // this card is about the shop being stuck, not about one line.
      [button('Show me what is waiting', ACTIONS.ANSWER, shopRef)],
    ]),
  };
}

// ── 11b. THE BOARD (WP-B15-09) ───────────────────────────────────────────────

/**
 * PURE. THE ONE SURFACE. Every question this shop is waiting on, every question
 * already settled and what was accepted for it, and whether anything is still
 * blocking the shop - in a single message that is REWRITTEN IN PLACE as answers
 * land.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE, IN HIS OWN WORDS ───────────────────────
 * Eight independent question cards arrived for one shop on 2026-08-10. He
 * answered some of them and then asked: "How am I supposed to know I have
 * answered all the questions and the basket is not stuck?" Nothing in the
 * product could answer that. `lines_unresolved` was gated once-per-shop and went
 * stale the moment he replied to anything; he never received one; and Larry had
 * to query Postgres to tell him "6 of 8". A surface that needs a database query
 * to interpret is not a surface.
 *
 * ── WHY THE NUMBERS ARE STABLE, AND WHY THAT IS LOAD-BEARING ────────────────
 * Each question carries an ordinal that NEVER MOVES for the life of the shop -
 * its position in the shop's own question order, counting the answered ones too.
 * Numbering only the outstanding ones would renumber the list every time he
 * answered something, so a "2" typed against the board he was looking at would
 * land on a different question by the time it arrived. A number that changes
 * under a reply is a wrong answer waiting to be recorded, so it does not change.
 * parseBoardReply below is the exact inverse and lives beside it for the same
 * reason buildAnswerArg and parseAnswerArg share a file.
 *
 * ── ONE CONTROL, AND IT IS ONE THE SYSTEM ANSWERS ───────────────────────────
 * The single button is ANSWER-with-no-arg, which telegramAdapter already maps to
 * getStatus. Nothing here draws a control this runtime would refuse (WP-B15-08
 * AC10), and nothing draws one that looks actionable and does nothing: routeTaps
 * rebuilds the board on that command.
 *
 * @param {{shopRef:string,
 *          outstanding?:Array<{n:number, item:string, candidates?:string[]}>,
 *          answered?:Array<{n:number, item:string, answer:string}>,
 *          total?:number, blocked?:boolean|null, blockedReason?:string|null}} spec
 */
export function renderQuestionBoard({
  shopRef, outstanding = [], answered = [], total, blocked, blockedReason,
} = {}) {
  assertShopRef(shopRef);
  const waiting = Array.isArray(outstanding) ? outstanding : [];
  const done = Array.isArray(answered) ? answered : [];
  // NEVER FABRICATED. An absent total renders "unknown" like every other count
  // in this catalogue - a made-up denominator is the "6 of 8" lie in a
  // friendlier font.
  const of = count(total);

  const lines = [
    '🗒️ Everything I still need from you',
    `Ref: ${value(shopRef)}`,
    '',
    `STILL WAITING ON YOU — ${count(waiting.length)} of ${of}`,
  ];

  if (waiting.length === 0) {
    lines.push('  (nothing)');
  } else {
    for (const q of waiting) {
      lines.push(`  ${count(q && q.n)}. ${value(q && q.item)}`);
      const cands = q && Array.isArray(q.candidates)
        ? q.candidates.filter((c) => value(c) !== UNKNOWN) : [];
      if (cands.length > 0) lines.push(`     could be: ${cands.map((c) => value(c)).join('; ')}`);
    }
  }

  lines.push('');
  lines.push(`ALREADY ANSWERED — ${count(done.length)} of ${of}`);
  if (done.length === 0) {
    lines.push('  (none yet)');
  } else {
    // WHAT WAS ACCEPTED, not merely that it is done. "Answered" without the
    // answer is one more thing he would have to go and look up.
    for (const q of done) {
      lines.push(`  ${count(q && q.n)}. ${value(q && q.item)} → ${value(q && q.answer)}`);
    }
  }

  lines.push('');
  if (blocked === true) {
    lines.push('⛔ THIS SHOP IS BLOCKED. Nothing goes in a basket until the questions');
    lines.push('   above are answered.');
    if (blockedReason) lines.push(`   ${value(blockedReason)}`);
  } else if (blocked === false) {
    lines.push('✅ NOTHING IS BLOCKING THIS SHOP — every question is answered.');
  } else {
    // The third state is real, and it is never dressed up as either of the
    // other two.
    lines.push('❔ I cannot tell you whether anything is blocking this shop.');
  }

  lines.push('');
  lines.push('Reply to THIS message. You can answer several at once — start each');
  lines.push('line with its number:');
  lines.push('   1: the 12 skinless ones');
  lines.push('   4: the 33 pack');
  lines.push('');
  lines.push('This card is rewritten in place every time you answer, so what you');
  lines.push('are reading now is always the current state.');

  return {
    text: block(lines),
    reply_markup: keyboard([
      // No arg = "open the question queue", already mapped to getStatus.
      [button('Refresh this list', ACTIONS.ANSWER, shopRef)],
    ]),
  };
}

/** Longest board reply this parser will consider, in lines. Anything longer is
 *  a shopping list, not an answer. */
export const MAX_BOARD_REPLY_LINES = 40;

/**
 * PURE. THE INVERSE OF THE BOARD'S NUMBERING.
 *
 * "1: the 12 skinless ones\n4: the 33 pack" -> [{ordinal:1,..},{ordinal:4,..}]
 *
 * ── IT REFUSES FAR MORE THAN IT ACCEPTS, ON PURPOSE ─────────────────────────
 * The cost of a false positive here is a genuine shopping list being eaten as an
 * answer, which is the worst failure this system has. So a line counts only when
 * it opens with a small integer AND a separator AND carries words after it.
 * "2 pints of milk" does not match - no separator. "12" alone does not match -
 * no answer text. A message where NOTHING matches returns an empty array and the
 * caller falls back to the ordinary correlation path. It never guesses.
 *
 * The ordinal is NOT resolved to a question here: this module has no idea which
 * questions exist. Mapping a number onto a question is the caller's job, and a
 * number with no question behind it must be reported to the human rather than
 * silently dropped.
 */
export function parseBoardReply(text) {
  if (typeof text !== 'string' || text.trim() === '') return [];
  const lines = text.split(/\r?\n/).slice(0, MAX_BOARD_REPLY_LINES);
  const out = [];
  const seen = new Set();
  for (const raw of lines) {
    // <n><separator><answer>. The separator is mandatory - that is the whole
    // guard against a quantity at the head of a shopping-list line.
    const m = /^\s*(\d{1,3})\s*[.:)\]–—-]\s*(\S.*)$/.exec(raw);
    if (!m) continue;
    const ordinal = Number(m[1]);
    if (!Number.isInteger(ordinal) || ordinal < 1) continue;
    if (seen.has(ordinal)) {
      // The human contradicting himself inside one message. Take NEITHER:
      // choosing between two conflicting instructions is a guess.
      const at = out.findIndex((o) => o.ordinal === ordinal);
      if (at !== -1) out.splice(at, 1);
      continue;
    }
    seen.add(ordinal);
    out.push({ ordinal, answerText: m[2].trim() });
  }
  return out;
}

// ── 12. Clarification deferred (WP-B15-A1) ───────────────────────────────────

/**
 * PURE. AsdAIr could not read one of Warwick's answers, AND the follow-up
 * question cannot honestly be asked yet.
 *
 * ── WHY THIS CARD EXISTS ────────────────────────────────────────────────────
 * runPipeline DEFERS a round-2 clarification while a photographed list is still
 * unconfirmed: asking "which variant of line 3?" before Warwick has agreed we
 * read line 3 correctly at all is asking the wrong question first, and that
 * deferral recovered a real shop. The deferral is RIGHT. The SILENCE was not.
 * Warwick's rule is "it should tell me if there is something it does not
 * understand or is not clear" — so the question card waits and the WORD does not.
 *
 * ── WHY IT OFFERS NO ANSWER BUTTON ──────────────────────────────────────────
 * There is no answerable question yet — that is the whole situation being
 * reported. An answer button would invite a reply with nowhere to land. The one
 * action offered is the one that actually unblocks it: confirming the reading,
 * after which the real round-2 question is asked through ordinary machinery.
 *
 * ── AND WHY IT ALSO ANSWERS A MESSAGE IT COULD NOT ACCEPT (B15-04 AC2) ──────
 * The note above says an answer button "would invite a reply with nowhere to
 * land". The CARD invites one anyway - Warwick read it and typed, and with no
 * open question his words were consumed by intake as next week's shopping list
 * (SHOP-2026-08-10, one line: his answer). The route-first claim seam never ran,
 * because runOnce only builds a claim when a question is OPEN.
 *
 * `messageNotAccepted: true` is that same situation reported back to him. It is
 * the SAME outbox kind and the SAME renderer deliberately - no new message kind
 * was introduced - and it is purely ADDITIVE: without the flag every existing
 * card renders byte-for-byte as before.
 *
 * It must read correctly for BOTH readers: the one answering the clarification,
 * and the one who was genuinely sending a new list and needs to know it was not
 * taken. Saying only "I could not read your answer" would strand the second.
 *
 * @param {{shopRef:string, items?:string[], reason?:string, messageNotAccepted?:boolean}} spec
 */
export function renderClarificationDeferred({ shopRef, items, reason, messageNotAccepted } = {}) {
  assertShopRef(shopRef);

  const refused = messageNotAccepted === true;
  const named = Array.isArray(items) ? items.filter((i) => typeof i === 'string' && i.trim() !== '') : [];
  const lines = [
    refused ? '🤔 I have not taken that message as anything' : '🤔 I could not read one of your answers',
    `Ref: ${value(shopRef)}`,
    '',
  ];

  if (named.length > 0) {
    lines.push('What I could not read:');
    for (const item of named) lines.push(`  • ${value(item)}`);
    lines.push('');
  }

  if (typeof reason === 'string' && reason.trim() !== '') {
    lines.push(`Why: ${value(reason)}`);
    lines.push('');
  }

  if (refused) {
    // BOTH READERS, IN ORDER. First what did NOT happen to his words, because
    // that is the thing he cannot see; then the one action that unblocks it;
    // then the person who was sending a list, who must not walk away thinking
    // it landed.
    lines.push('It was NOT recorded as an answer, and it was NOT started as a');
    lines.push('new shopping list. Nothing has been added to a basket.');
    lines.push('');
    lines.push('I am still waiting for you to confirm I read this list correctly.');
    lines.push('Tap below, and then I can ask you properly.');
    lines.push('');
    lines.push('If you were sending a NEW shopping list, it has not been taken -');
    lines.push('please send it again once this shop is finished.');
  } else {
    lines.push('I have NOT guessed, and nothing has been added to a basket.');
    lines.push('I will ask you about it properly once you confirm I read the list');
    lines.push('correctly - that check deliberately comes first.');
  }

  return {
    text: block(lines),
    reply_markup: keyboard([
      [button('Check what I read', ACTIONS.REVIEW, shopRef)],
    ]),
  };
}

/**
 * The catalogue, by name. Lets a caller (and the test suite) enumerate every
 * renderer without importing them one at a time — the shape test in
 * renderMessages.test.js walks this map, so a NEW renderer added here is
 * automatically covered by the "every renderer returns {text, reply_markup}"
 * and "no secret leaks into rendered output" proofs.
 *
 * ── A KIND WITH NO ENTRY HERE IS A SILENT DROP ──────────────────────────────
 * runtime.js drainOutbox resolves an outbox row whose `kind` is absent from this
 * map as `abandoned`: the message is discarded and nobody is told. A new outbox
 * kind is therefore not complete until its renderer is registered HERE, which is
 * why `clarification_deferred` appears in this map and not merely above it.
 */
/**
 * PURE. A CONTROL HE PRESSED THAT THIS SYSTEM WILL NOT ACT ON. (WP-B15-09 AC6)
 *
 * ── WHY A MESSAGE AND NOT A TOAST ───────────────────────────────────────────
 * A refused tap already had a route: answerCallbackQuery, the grey toast on the
 * button. That route is unreliable by design - Telegram rejects it with "query
 * is too old and response timeout expired" once the tap has been sitting for
 * more than about fifteen minutes, which is routine here because a pass runs on
 * an interval. On 2026-08-10 Warwick pressed "Search ASDA", the runtime refused
 * it correctly, the toast never arrived, and the only surviving record was
 *   {"event":"inbound_refused","updateId":171031159,"action":"search",...}
 * in a journal he will never read. Routing that same refusal into the pass
 * report instead was not a fix: journal to pass-report is journal to journal.
 *
 * So the toast is still attempted AND this card is queued. The toast is the fast
 * path; this is the one that survives.
 *
 * ── IT NAMES WHAT DID NOT HAPPEN, WHICH IS THE PART HE CANNOT SEE ───────────
 * "Nothing has changed" is the load-bearing sentence. A refusal he cannot see is
 * indistinguishable from a shop that quietly did the thing.
 *
 * @param {{shopRef:string, control?:string, reason?:string, detail?:string}} spec
 */
export function renderControlRefused({ shopRef, control, reason, detail } = {}) {
  assertShopRef(shopRef);
  const named = typeof control === 'string' && control.trim() !== '' ? value(control) : null;
  return {
    text: block([
      '🚫 That button did nothing, and here is why',
      `Ref: ${value(shopRef)}`,
      '',
      named
        ? `You pressed a control this shop no longer acts on: "${named}".`
        : 'You pressed a control this shop could not act on.',
      `Why: ${value(detail || reason)}`,
      '',
      'NOTHING HAS CHANGED. No answer was recorded, nothing was added to a',
      'basket and nothing was ordered.',
      '',
      'Older cards in this chat can still carry buttons that have since been',
      'withdrawn — they cannot be un-sent. Use the list below instead.',
    ]),
    reply_markup: keyboard([
      [button('Show me what is waiting', ACTIONS.ANSWER, shopRef)],
    ]),
  };
}

/**
 * PURE. HE REPLIED, AND THERE WAS NOTHING FOR IT TO ANSWER. (WP-B15-09 AC8)
 *
 * ── THE TRAP THIS SITS IN THE MIDDLE OF ─────────────────────────────────────
 * Two outcomes are both wrong, and avoiding one lands on the other:
 *
 *   * treat the words as a new list  -> SHOP-2026-08-10-M76/M77/M79/M82, four
 *     junk shops minted out of four answers;
 *   * claim the words and say nothing -> a SILENT DROP, which is strictly worse,
 *     because he cannot see it and therefore cannot correct it.
 *
 * The only exit is the third one: do not start a shop, do not pretend to have
 * recorded an answer, and TELL HIM. Which is what this card is.
 *
 * ── IT MUST READ CORRECTLY FOR TWO DIFFERENT PEOPLE ─────────────────────────
 * The one correcting an answer he already gave, and the one who was genuinely
 * sending next week's list and needs to know it was not taken. Saying only "that
 * question is already answered" strands the second.
 *
 * @param {{shopRef:string, answeredAlready?:string|null}} spec
 */
export function renderReplyNotTaken({ shopRef, answeredAlready } = {}) {
  assertShopRef(shopRef);
  const lines = [
    '🤔 I have not taken that message as anything',
    `Ref: ${value(shopRef)}`,
    '',
    'There is no open question for it to answer — everything I asked about',
    'this shop has been settled.',
  ];
  if (answeredAlready) {
    lines.push('');
    lines.push(`The answer I already have is: ${value(answeredAlready)}`);
  }
  lines.push('');
  lines.push('It was NOT recorded as an answer, and it was NOT started as a new');
  lines.push('shopping list. Nothing has been added to a basket and nothing has');
  lines.push('been ordered.');
  lines.push('');
  lines.push('If you want to CHANGE something, tell me which numbered line and');
  lines.push('I will ask you about it properly.');
  lines.push('');
  lines.push('If you were sending a NEW shopping list, it has not been taken —');
  lines.push('please send it again once this shop is finished.');

  return {
    text: block(lines),
    reply_markup: keyboard([
      [button('Show me what is waiting', ACTIONS.ANSWER, shopRef)],
    ]),
  };
}

export const MESSAGES = Object.freeze({
  receipt: renderReceipt,
  plan_ready: renderPlanReady,
  question: renderQuestionCard,
  question_board: renderQuestionBoard,
  control_refused: renderControlRefused,
  reply_not_taken: renderReplyNotTaken,
  confirm_interpretation: renderConfirmInterpretation,
  lines_unresolved: renderLinesUnresolved,
  progress: renderProgress,
  basket_ready: renderBasketReady,
  status: renderStatus,
  failure: renderFailure,
  confirmation_received: renderConfirmationReceived,
  reconciliation_summary: renderReconciliationSummary,
  clarification_deferred: renderClarificationDeferred,
});
