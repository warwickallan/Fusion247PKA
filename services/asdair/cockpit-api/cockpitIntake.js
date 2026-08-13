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
// ── WP-B15-50: WHAT SHE TYPED, AND WHAT HER TABLET CLAIMED THE DATE WAS ────
//
// TWO ADDITIONS, both of which keep the promises the page makes to her:
//
//   `extras`  the things she typed rather than tapped. They travel VERBATIM
//             into the evidence text AND into the content fingerprint. The
//             fingerprint half is the load-bearing one - see listFingerprint().
//
//   `clock`   her tablet's `list_date`, compared against the server's own date.
//             An ASSERTION to be checked, never a source: shop_ref still comes
//             from the server's clock. Reported to Warwick, never to her, and
//             never a reason to refuse her list.
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
// WP-B15-50 AC3. The things she TYPES rather than taps. Same kind of bound, same
// reason: a shape limit on a malformed client, never an opinion about her shop.
const MAX_EXTRAS = 50;
// Longer than an item name on purpose - a tapped item is a catalogue name, an
// extra is a sentence ("some of those little cakes from the bakery bit").
const MAX_EXTRA_LENGTH = 200;

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

/**
 * ── WP-B15-50 AC3. WHAT SHE TYPED, AND IT IS NOT TIDIED ───────────────────
 *
 * ⛔ HER EXACT WORDS. No title-casing, no spell-correction, no de-duplication,
 * no sorting, no "helpful" singularisation. The pipeline resolves identity
 * downstream against the real catalogue; her raw words are EVIDENCE, and an
 * evidence record that has been improved is not evidence.
 *
 * The ONE transformation applied is the same one `cleanName` applies and for
 * the same reason: control characters and newlines become a space, because the
 * evidence text is line-per-item and a smuggled newline would forge a line she
 * never wrote. That is keeping one line one line, not editing her language.
 *
 * ⛔ AND NOTHING IS SILENTLY DROPPED. An extra that cannot be carried - not a
 * string, empty, or longer than the bound - throws a coded, exposable error and
 * the whole submission fails loudly. Succeeding with less than she asked for,
 * while telling her it went, is the exact class of defect this Work Package
 * exists to close.
 */
function normaliseExtras(extras) {
  if (extras === undefined || extras === null) return [];
  if (!Array.isArray(extras)) {
    throw invalid('list_extras_invalid', 'the extra items did not arrive as a list');
  }
  if (extras.length > MAX_EXTRAS) {
    throw invalid('list_extras_too_many',
      'there are ' + extras.length + ' typed extras, and the limit is ' + MAX_EXTRAS);
  }
  return extras.map(function (raw, i) {
    if (typeof raw !== 'string') {
      throw invalid('list_extra_invalid', 'typed item ' + (i + 1) + ' is not something I can read');
    }
    const flat = raw.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
    if (flat === '') {
      // Loud, not dropped. The route contract tells the page to omit `extras`
      // entirely when there is nothing in it, so a blank arriving here means the
      // page sent something it should not have - and answering that with a plain
      // sentence is recoverable, where silently discarding it is not.
      throw invalid('list_extra_invalid', 'typed item ' + (i + 1) + ' is empty');
    }
    if (flat.length > MAX_EXTRA_LENGTH) {
      throw invalid('list_extra_invalid',
        'typed item ' + (i + 1) + ' is longer than ' + MAX_EXTRA_LENGTH + ' characters');
    }
    return flat;
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
/**
 * WP-B15-50 AC3. Typed extras are appended AS PLAIN LINES, after the tapped ones.
 *
 * No "1 x" prefix, because she did not say one of anything - inventing a
 * quantity would be this file having a shopping opinion. No marker, no bullet,
 * no bracketed "(typed)": a bare line is EXACTLY what a typed Telegram list
 * looks like to the interpreter downstream, so her extras travel through the
 * same unchanged path as everything else rather than needing a special case.
 *
 *     2 x Semi skimmed milk 4 pints
 *     1 x Hovis soft white medium
 *     some of those little cakes
 */
function renderList(items, extras) {
  const lines = items.map(function (it) { return it.qty + ' x ' + it.name; });
  const typed = Array.isArray(extras) ? extras : [];
  return lines.concat(typed).join('\n');
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
function listFingerprint(householdId, items, extras) {
  const canonical = items
    .map(function (it) { return (it.id === null ? '' : it.id) + '|' + it.qty + '|' + it.name; })
    .join('\n');
  const typed = Array.isArray(extras) ? extras : [];
  // ── ⛔ WP-B15-50. THE EXTRAS ARE PART OF THE IDENTITY OF A LIST ──────────
  //
  // THE DEFECT THIS CLOSES, EXACTLY. Before this line existed the digest was
  // taken over the TAPPED ITEMS ONLY. So a woman who taps her usual items, adds
  // "some of those little cakes" and sends produced a byte-identical `sourceId`
  // to her earlier submission - which means:
  //
  //   * the command row collapsed on ON CONFLICT DO NOTHING     -> recorded_new: false
  //   * her page therefore said "Today's list has already gone. Nothing has
  //     changed."                                                <- A LIE
  //   * no notification fired, so Warwick was never told
  //   * and `raw_*` is excluded from shopStore's UPDATE allowlist, so the words
  //     she typed reached nothing at all.
  //
  // She would have been told, in plain English, that nothing happened, WHILE
  // something she asked for was discarded. That is ruling A1's defect one layer
  // along, and AC3 cannot hold without this.
  //
  // ── WHY THE SECTION IS APPENDED ONLY WHEN NON-EMPTY ─────────────────────
  // A list with no typed extras must hash EXACTLY as it did before this Work
  // Package - shops recorded by the live service today already carry v1 digests,
  // and changing them would make the next identical resubmission look like a
  // change, fire a notification and tell her something happened when nothing
  // did. Pinned by a literal in cockpitIntake.test.js so it cannot drift.
  //
  // ORDER IS PART OF THE IDENTITY, as it is for items: the evidence text
  // preserves her order, and a fingerprint that disagreed with the evidence
  // beside it would be worse than no fingerprint.
  const extrasSection = typed.length === 0 ? '' : '\n#extras\n' + typed.join('\n');
  return crypto.createHash('sha256')
    .update('asdair:cockpit:list:v1\n' + householdId + '\n' + canonical + extrasSection, 'utf8')
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
function sourceIdFor(householdId, items, extras) {
  return 'cockpit:mum:list:' + listFingerprint(householdId, items, extras);
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
 * ── WP-B15-50. THE DATE SHE CONFIRMED IS AN ASSERTION, NOT A SOURCE ───────
 *
 * Her tablet sends `list_date` - the date she confirmed on screen. It does NOT
 * become the shop's date: `shop_ref` still derives from the SERVER's clock
 * alone, exactly as it did, because a shop_ref taken from a client is a
 * duplicated week waiting to happen.
 *
 * What it IS good for is catching the case where the tablet's idea of today and
 * the server's have drifted apart - which nobody would otherwise notice until a
 * shop landed on the wrong day.
 *
 * ⛔ IT NEVER BLOCKS HER, AND SHE IS NEVER TOLD. A disagreement, a malformed
 * date, a date from 1970 - all of it travels, the submission succeeds, and the
 * mismatch is reported to WARWICK on the response and in the ShopperBot
 * message. She did nothing wrong and there is nothing for her to fix.
 *
 * THE COMPARISON LIVES HERE, IN THE ADAPTER, because this is the only place
 * both values exist together. Deriving the server's date a second time at the
 * transport to compare it against this one is how two derivations of one date
 * drift apart.
 *
 * `agrees: null` means she asserted nothing - a genuinely different answer from
 * `false`, and never rendered as a disagreement.
 */
function compareClock(claimedRaw, recorded) {
  if (claimedRaw === undefined || claimedRaw === null || claimedRaw === '') {
    return { claimed: null, recorded: recorded, agrees: null };
  }
  // Flattened and capped for the same reason every other free string here is:
  // this value is reported onward into a log line and a Telegram message, and a
  // smuggled newline in either is a forged line.
  const claimed = String(claimedRaw)
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return { claimed: claimed, recorded: recorded, agrees: claimed === recorded };
}

/**
 * TRANSLATE ONE COCKPIT SUBMISSION INTO A receiveList SPEC.
 *
 * @param {{household:*, items:Array<{id?:*,name:*,qty?:*}>, extras?:Array<string>,
 *          list_date?:string}} request  what the Cockpit POSTed
 * @param {{receivedAt:(string|Date)}} options  the receiver's own stamp
 * @returns {{spec:object, items:Array, extras:Array<string>, rawText:string,
 *            clock:{claimed:string|null, recorded:string, agrees:boolean|null}}}
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
  const extras = normaliseExtras(req.extras);
  const rawText = renderList(items, extras);
  const listDate = listDateFrom(opts.receivedAt);
  const clock = compareClock(req.list_date, listDate);

  const spec = {
    householdId: householdId,
    listDate: listDate,
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
    // Ruling A1, extended by WP-B15-50 to cover what she TYPED as well as what
    // she tapped. The discriminator that makes a CHANGED re-send visible.
    sourceId: sourceIdFor(householdId, items, extras),
    // A tapped list was never read from a photograph, so it needs no review
    // gate. Photo shops set this; a typed or tapped one must not, or every
    // Cockpit shop would be held for a human check that has nothing to check.
    needsReview: false,
    receivedAt: opts.receivedAt instanceof Date ? opts.receivedAt.toISOString() : (opts.receivedAt || null),
  };

  return { spec: spec, items: items, extras: extras, rawText: rawText, clock: clock };
}

module.exports = {
  buildReceiveListSpec: buildReceiveListSpec,
  ACTOR: ACTOR,
  SOURCE_KIND: SOURCE_KIND,
  MAX_ITEMS: MAX_ITEMS,
  MAX_NAME_LENGTH: MAX_NAME_LENGTH,
  MIN_QTY: MIN_QTY,
  MAX_QTY: MAX_QTY,
  MAX_EXTRAS: MAX_EXTRAS,
  MAX_EXTRA_LENGTH: MAX_EXTRA_LENGTH,
  _internal: {
    normaliseItems: normaliseItems,
    normaliseExtras: normaliseExtras,
    normaliseHousehold: normaliseHousehold,
    renderList: renderList,
    listFingerprint: listFingerprint,
    sourceIdFor: sourceIdFor,
    listDateFrom: listDateFrom,
    compareClock: compareClock,
  },
};
