// =====================================================================
// BUILD-015 AsdAIr WP-B15-48 - cockpit-api/cockpitIntake.js
//
// THE COCKPIT'S TRANSLATOR. NOT A SECOND INTAKE SERVICE.
//
// ── WHAT THIS IS, AND THE ANTI-PATTERN IT REFUSES ──────────────────────────
//
// Addendum C section 5 names the failure precisely: "building a Cockpit intake
// service. The moment a second module owns list intake, pollIntake's translator
// layer has been copied rather than joined." So this file is the SAME SHAPE as
// runtime.js:146-175 - the Telegram translator - and nothing more. It turns one
// channel's request into the `receiveList` spec that channel-neutral command
// already accepts, and then it stops.
//
// It implements NO shopping logic. It resolves no product, consults no
// catalogue, applies no rule, opens no connection, reads no environment
// variable and touches no clock it was not handed. Everything downstream of the
// spec is the pipeline's, unchanged, and shared byte-for-byte with Telegram.
//
//   Telegram  ->  runtime.js persist()   -\
//                                          >-- receiveList(spec, deps) -> ONE row
//   Cockpit   ->  THIS FILE               -/
//
// ── THE THREE `telegram*` FIELDS ARE LEFT UNSET, DELIBERATELY ──────────────
//
// A Cockpit submission has no chat and no message. Inventing values would make
// the inbound unique index (telegram_chat_id, telegram_message_id) match rows it
// has no business matching. Left null, the only natural key in play is
// (household_id, shop_ref), which is exactly right for a channel that has no
// message identity of its own.
//
// ── WHY A CONTENT-DERIVED sourceId (Work Order AMENDMENT 1, ruling A1) ─────
//
// `sourceId` becomes receiveList's command discriminator, so it decides whether
// a second submission leaves a durable trace:
//
//   sourceIdFor(shop) - the default - returns `asdair:shop:<shop_ref>`, which is
//   IDENTICAL on every submission that day. A woman who forgets the bread,
//   corrects her list and re-sends would leave NO durable trace that she sent
//   anything the second time: the shop row is discarded by ON CONFLICT DO
//   NOTHING, `raw_*` is deliberately absent from shopStore's UPDATE allowlist,
//   and the command row is idempotent on the same key. The whole second send
//   would vanish.
//
// Deriving it from the CONTENT fixes exactly that and nothing else:
//   - an IDENTICAL re-send still collapses to one row (same content, same key);
//   - a CHANGED re-send writes one honest command row recording what she sent.
//
// It does NOT make the corrected list take effect - the shop's `raw_text` still
// belongs to the first submission, by design, and saying otherwise is the
// "changes the display but not the durable record" defect. What it buys is that
// the second send is not invisible.
//
// PURE. No `pg`, no env, no I/O. Every test in cockpitIntake.test.js runs on a
// box with nothing installed.
// =====================================================================

'use strict';

const crypto = require('crypto');

// ---------------------------------------------------------------------
// Limits. Small, explicit, and enforced HERE rather than at the HTTP edge, so
// the same bounds hold for any caller of this module.
//
// These are shape limits, not shopping opinions: they stop a malformed or
// hostile client turning one tap into a megabyte of evidence text. What counts
// as a sensible weekly shop is nobody's business in this file.
// ---------------------------------------------------------------------
const MAX_ITEMS = 200;
const MAX_NAME_LENGTH = 120;
const MIN_QTY = 1;
const MAX_QTY = 20;

const ACTOR = 'cockpit:mum';
const SOURCE_KIND = 'text';

// Control characters, written as explicit escapes so this file carries no
// literal control bytes and the class cannot be misread as a printable range.
// An earlier draft of this line used a literal class that resolved to
// space-through-hyphen, which would have eaten the hyphen out of "semi-skimmed".
const CONTROL_CHARS = /[\x00-\x1f\x7f]+/g;

/** Errors carry a machine code so the HTTP layer maps them without matching on prose. */
function invalid(code, message) {
  const e = new Error(message);
  e.code = code;
  e.expose = true;           // safe to show the caller: it is about HER input, never about config
  return e;
}

/**
 * One displayed name, made safe to store on one line WITHOUT changing the words.
 *
 * Control characters and newlines become a space, because the rendering is
 * line-per-item and a smuggled newline would forge a second item in the
 * evidence text. Everything else she was shown is preserved exactly - including
 * accents, hyphens and punctuation. This is not sanitising her language, it is
 * keeping one line one line.
 */
function cleanName(value, index) {
  if (typeof value !== 'string') {
    throw invalid('list_item_invalid', 'item ' + (index + 1) + ' has no name');
  }
  const flat = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (flat === '') {
    throw invalid('list_item_invalid', 'item ' + (index + 1) + ' has an empty name');
  }
  if (flat.length > MAX_NAME_LENGTH) {
    throw invalid('list_item_invalid',
      'item ' + (index + 1) + ' has a name longer than ' + MAX_NAME_LENGTH + ' characters');
  }
  return flat;
}

/** A whole number in [1, 20]. An absent quantity means one, which is what a tap means. */
function cleanQty(value, index) {
  if (value === undefined || value === null || value === '') return 1;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < MIN_QTY || n > MAX_QTY) {
    throw invalid('list_qty_invalid',
      'item ' + (index + 1) + ' has a quantity of ' + JSON.stringify(value)
      + ' - it must be a whole number from ' + MIN_QTY + ' to ' + MAX_QTY);
  }
  return n;
}

/** The catalogue id she tapped, when the UI knew one. Opaque here: never parsed, never resolved. */
function cleanId(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return s === '' ? null : s.slice(0, MAX_NAME_LENGTH);
}

/**
 * PURE validation of one submitted list.
 *
 * Returns the cleaned items. Throws a coded, exposable error on the first
 * problem - naming the item number, because "item 4 has no name" is actionable
 * and "invalid list" is not.
 */
function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw invalid('list_empty', 'the list has no items on it');
  }
  if (items.length > MAX_ITEMS) {
    throw invalid('list_too_long', 'the list has ' + items.length + ' items, and the limit is ' + MAX_ITEMS);
  }
  return items.map(function (raw, i) {
    const item = raw && typeof raw === 'object' ? raw : {};
    return { id: cleanId(item.id), name: cleanName(item.name, i), qty: cleanQty(item.qty, i) };
  });
}

/** The household. Never defaulted: a list written to the wrong household is a silent disaster. */
function normaliseHousehold(value) {
  if (value === undefined || value === null || value === '') {
    throw invalid('household_missing', 'no household was named on the submission');
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 1) {
    throw invalid('household_invalid', 'the household must be a positive whole number');
  }
  return n;
}

/**
 * THE EVIDENCE TEXT. Deterministic, one line per item, quantity included.
 *
 * `receiveList` promises the raw evidence is retained unconditionally, and for a
 * tapped list this rendering IS the raw evidence - there is no typed message to
 * keep. So it is written to be readable months later by a human looking at
 * `asdair.shop.raw_text` with no other context:
 *
 *     2 x Semi skimmed milk 4 pints
 *     1 x Hovis soft white medium
 *
 * HER ORDER IS PRESERVED. It is not sorted, deduplicated or tidied: this is a
 * record of what she sent, not a normalised shopping intent. The catalogue id is
 * deliberately absent - this line is the name SHE WAS SHOWN, and a machine id in
 * the evidence text would make it harder to read, not easier to trust.
 */
function renderList(items) {
  return items.map(function (it) { return it.qty + ' x ' + it.name; }).join('\n');
}

/**
 * THE CONTENT FINGERPRINT behind `sourceId`.
 *
 * Hashed over a canonical `id|qty|name` per line rather than over the rendered
 * text, so it is strictly MORE sensitive than the evidence: swapping one
 * catalogue product for another that happens to display the same words is a
 * different list, and this notices. Order is part of the identity, because the
 * evidence text preserves order and a fingerprint that disagreed with the
 * evidence beside it would be worse than no fingerprint.
 *
 * The household is included so two households cannot collide; the DATE is NOT,
 * because the shop_ref already carries the week and the key is scoped to it.
 */
function listFingerprint(householdId, items) {
  const canonical = items
    .map(function (it) { return (it.id === null ? '' : it.id) + '|' + it.qty + '|' + it.name; })
    .join('\n');
  return crypto.createHash('sha256')
    .update('asdair:cockpit:list:v1\n' + householdId + '\n' + canonical, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

/**
 * The source identity of ONE submitted list.
 *
 * Shaped like the Telegram one (`tg:shopper:chat:<c>:msg:<m>`) so the two read
 * as siblings in the ledger: channel first, then whatever that channel uses to
 * identify a delivery. Telegram has a message id; the Cockpit has the content.
 */
function sourceIdFor(householdId, items) {
  return 'cockpit:mum:list:' + listFingerprint(householdId, items);
}

/**
 * The week a list belongs to is the day it arrived.
 *
 * THE CLOCK IS INJECTED, never reached for - the same rule pollIntake follows,
 * and for the same reason: a runtime with a wrong clock is a wrong shop_ref, and
 * a wrong shop_ref is a duplicated week. `receivedAt` is the receiver's own
 * stamp, taken once at the HTTP edge and carried through.
 */
function listDateFrom(receivedAt) {
  const iso = receivedAt instanceof Date ? receivedAt.toISOString() : String(receivedAt || '');
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!m) {
    // Not exposable: this is the caller's bug, not hers.
    const e = new Error('cockpitIntake: receivedAt must be an ISO timestamp or a Date, got '
      + JSON.stringify(receivedAt));
    e.code = 'intake_clock_invalid';
    throw e;
  }
  return m[1];
}

/**
 * TRANSLATE ONE COCKPIT SUBMISSION INTO A receiveList SPEC.
 *
 * @param {{household:*, items:Array<{id?:*,name:*,qty?:*}>}} request  what the Cockpit POSTed
 * @param {{receivedAt:(string|Date)}} options  the receiver's own stamp
 * @returns {{spec:object, items:Array, rawText:string}}
 *
 * The spec is handed to the SHARED command unchanged. Every field below exists
 * in receiveList's own documented spec; nothing here is invented for this
 * channel, and nothing the Telegram path sets is quietly omitted except the
 * three `telegram*` fields, which have no meaning here.
 */
function buildReceiveListSpec(request, options) {
  const req = request && typeof request === 'object' ? request : {};
  const opts = options || {};

  const householdId = normaliseHousehold(req.household);
  const items = normaliseItems(req.items);
  const rawText = renderList(items);

  const spec = {
    householdId: householdId,
    listDate: listDateFrom(opts.receivedAt),
    sourceKind: SOURCE_KIND,
    rawText: rawText,
    rawMediaPath: null,
    // No chat, no message: this channel has no message identity. See the header.
    telegramChatId: null,
    telegramMessageId: null,
    telegramUpdateId: null,
    // WHO SENT IT. Recorded on the command row so "who sent this week's list?"
    // is answerable from the row alone a month later.
    actor: ACTOR,
    // Ruling A1. The discriminator that makes a CHANGED re-send visible.
    sourceId: sourceIdFor(householdId, items),
    // A tapped list was never read from a photograph, so it needs no review
    // gate. Photo shops set this; a typed or tapped one must not, or every
    // Cockpit shop would be held for a human check that has nothing to check.
    needsReview: false,
    receivedAt: opts.receivedAt instanceof Date ? opts.receivedAt.toISOString() : (opts.receivedAt || null),
  };

  return { spec: spec, items: items, rawText: rawText };
}

module.exports = {
  buildReceiveListSpec: buildReceiveListSpec,
  ACTOR: ACTOR,
  SOURCE_KIND: SOURCE_KIND,
  MAX_ITEMS: MAX_ITEMS,
  MAX_NAME_LENGTH: MAX_NAME_LENGTH,
  MIN_QTY: MIN_QTY,
  MAX_QTY: MAX_QTY,
  _internal: {
    normaliseItems: normaliseItems,
    normaliseHousehold: normaliseHousehold,
    renderList: renderList,
    listFingerprint: listFingerprint,
    sourceIdFor: sourceIdFor,
    listDateFrom: listDateFrom,
  },
};
