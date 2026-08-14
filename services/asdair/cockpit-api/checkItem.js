// =====================================================================
// BUILD-015 AsdAIr WP-B15-50 - cockpit-api/checkItem.js
//
// THE SENSE-CHECK. "Have I already got this?" - answered, never asked back.
//
// ── WHAT THIS IS ──────────────────────────────────────────────────────────
//
// Mum types something into "add something else". Before it travels, the page
// asks this route whether the household already has it, so she can be told
// warmly - BY NAME - rather than discovering a duplicate next week.
//
// ⛔ IT IS NOT A SECOND MATCHER. `resolveReading` from
// services/asdair/interpret/resolveByCatalogue.js does the identity work, and
// nothing here re-decides it. That resolver was measured over all 109 real
// regulars using each one's own household alias: 107 resolve back to the exact
// right regular, 0 resolve to a WRONG product, and 2 are honestly ambiguous.
// A second matcher would be a second opinion about identity, which is the exact
// drift commandSurface.js exists to prevent, one layer along.
//
// WP-B15-53 does NOT change that. The display-name duplicate check added there
// runs ONLY after `resolveReading` has declined to name a product, so it can
// widen the nudge's REACH and can never move a term the catalogue already
// resolved. `display_name` still never reaches the resolver. See displayNameHit.
//
// ── ⛔ THE RESPONSE HAS NOWHERE TO PUT A QUESTION (AC2) ────────────────────
//
// Warwick, 2026-08-13: "I will deal with any questions and such through my
// existing process." So no disambiguation, no candidate list, no "which did you
// mean" may ever reach her screen.
//
// The resolver HANDS US ONE. `needs_confirmation` carries `alternatives` - a
// ranked candidate array - and the obvious thing to do is show it. This module
// is built so that is not merely forbidden but IMPOSSIBLE TO DO BY ACCIDENT:
//
//   * the verdict is NEVER spread into the response ({...verdict} is the bug);
//   * the response is assembled by `sealed()` from ONE frozen key list;
//   * `sealed()` THROWS on any key outside that list, so a future edit that
//     adds `alternatives` fails loudly in the test run rather than quietly
//     shipping a question to an 84-year-old.
//
// That is the difference between a rule and a control. RESPONSE_KEYS is pinned
// to a literal in checkItem.test.js, held OUTSIDE this file, so widening the
// list here cannot silently widen the check that guards it.
//
// ── READ-ONLY, AND NO POOL OF ITS OWN (AC1) ───────────────────────────────
//
// The catalogue read reuses readWorkspace's lazy SELECT-only pool - the same
// ASDAIR_DB_URL / asdair_ro path readPacket.js already shares, and for the same
// reason its header gives: a sibling reader opening its own connection its own
// way is a second configuration path to keep in sync, and /asdair/health would
// no longer speak for both. NO WRITE POOL IS OPENED HERE, ever.
//
// `classifyItem` itself is PURE - catalogue in, verdict out, no I/O - so every
// classification proof runs on a box with no database at all.
//
// PURE ASCII.
// =====================================================================

'use strict';

const resolver = require('../interpret/resolveByCatalogue.js');
// WP-B15-51. What MUM READS. `displayNameFor` is the one rule for that, shared
// with the write route so what Warwick types and what she reads cannot drift.
const displayName = require('./displayName');

// WP-B15-53. THE ESTATE'S ONE NORMALISER, borrowed read-only. Writing a second
// one here would be a second opinion about what "the same words" means, which is
// the drift this module's header already refuses for identity.
const normaliseTerm = resolver.normaliseTerm;

// ---------------------------------------------------------------------
// The closed vocabulary. Frozen, and asserted against the check-item route
// contract v1 by the test - a status this route could return that the contract
// does not name is a broken promise to Felix's page, not a detail.
// ---------------------------------------------------------------------
const CHECK_ITEM_STATUSES = Object.freeze([
  'matched',              // she already has this, by name
  'possible_duplicate',   // she already has it AND it is already on today's list
  'needs_confirmation',   // the catalogue is genuinely torn - SHE IS TOLD NOTHING
  'unmatched_new_item',   // genuinely new - SHE IS TOLD NOTHING
  'unreadable'            // no term survived - SHE IS TOLD NOTHING
]);

/**
 * ⛔ THE COMPLETE SET OF KEYS THIS ROUTE MAY RETURN ON SUCCESS.
 *
 * Not documentation - `sealed()` enforces it. `alternatives` is deliberately
 * absent and adding it is a test failure, not a code review conversation.
 */
const RESPONSE_KEYS = Object.freeze([
  'status',
  'matched_name',
  'matched_regular_id',
  'already_on_list'
]);

const RESPONSE_KEY_SET = new Set(RESPONSE_KEYS);

/** The statuses permitted to carry an identity. Every other status returns nulls. */
const IDENTIFYING_STATUSES = Object.freeze(['matched', 'possible_duplicate']);

// SELECT-only, parameterised, and NARROWER than readRules' own regulars query
// on purpose: this asks a question about identity, so it takes the three
// columns identity is made of and nothing else. A presentation shape has no
// business deciding what product a woman meant.
//
// ACTIVE ONLY. resolveByCatalogue's own contract says "active regulars for the
// household", and matching an inactive row would tell her she already has
// something the household stopped buying. `active IS NOT FALSE` treats a NULL
// as active, which is how the column reads everywhere else in this service.
// WP-B15-51. `display_name` joins the three, and it is the ONE column here that
// is not about identity - it is what she is TOLD once identity is settled. It is
// appended only when the database has it (migration 021 reaches live by hand
// after this merges), by the same whitelist-then-intersect route readWorkspace
// uses; without that, this nudge would 500 on a live schema that has not caught
// up, and a failing sense-check drops what she typed.
const REGULARS_BASE_SQL =
  'SELECT id, name, aka FROM asdair.regulars ' +
  'WHERE household_id = $1 AND active IS NOT FALSE ' +
  'ORDER BY id ASC';

const REGULARS_DISPLAY_SQL =
  'SELECT id, name, aka, display_name FROM asdair.regulars ' +
  'WHERE household_id = $1 AND active IS NOT FALSE ' +
  'ORDER BY id ASC';

// Kept under its original name: readWorkspace.test.js-style SELECT-only
// assertions and every existing reference read this constant.
const REGULARS_SQL = REGULARS_BASE_SQL;

/** Errors carry a machine code so the HTTP layer maps them without matching on prose. */
function invalid(code, message) {
  const e = new Error(message);
  e.code = code;
  e.expose = true;          // about HER input, never about configuration
  return e;
}

/**
 * ⛔ THE SEAL. Build a response body from the frozen key list, or throw.
 *
 * Every success body on this route is constructed here. There is no other way
 * to make one, which is what makes "no candidate list can escape" a property of
 * the code rather than a promise in a comment.
 */
function sealed(fields) {
  const out = {};
  const keys = Object.keys(fields);
  for (let i = 0; i < keys.length; i += 1) {
    if (!RESPONSE_KEY_SET.has(keys[i])) {
      throw new Error(
        'checkItem: refusing to return "' + keys[i] + '" - the check-item response is sealed to '
        + RESPONSE_KEYS.join(', ') + '. Mum is never asked a question, so this route has nowhere '
        + 'to put one. See AC2.'
      );
    }
  }
  for (let i = 0; i < RESPONSE_KEYS.length; i += 1) {
    const k = RESPONSE_KEYS[i];
    out[k] = Object.prototype.hasOwnProperty.call(fields, k) ? fields[k] : null;
  }
  return out;
}

/**
 * PURE. One catalogue id, in the one form both sides can compare.
 *
 * The UI sends `chosen` as `regulars.id_display`, which is `String(Number(id))`
 * (readRules.presentRegular -> present.count). The resolver returns
 * `matched_regular_id` as a NUMBER. Comparing those directly is a silent
 * false-negative machine, so both sides normalise through here.
 */
function idKey(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? String(n) : null;
}

/** PURE. The set of catalogue ids already on her list. Junk entries are ignored, never fatal. */
function chosenSet(chosen) {
  const set = new Set();
  if (!Array.isArray(chosen)) return set;
  for (let i = 0; i < chosen.length; i += 1) {
    const k = idKey(chosen[i]);
    if (k !== null) set.add(k);
  }
  return set;
}

/** The display-name check found more than one product. Not a row, and never an id. */
const AMBIGUOUS = Object.freeze({ ambiguous: true });

/**
 * ⭐ WP-B15-53. THE BANANAS GAP, AND THE WHOLE OF THIS WORK PACKAGE.
 *
 * PURE. Did she type the household's own word for something she already has?
 *
 * ── WHY THIS IS NEEDED AT ALL ─────────────────────────────────────────────
 * The matcher reads `name` and `aka`, which is correct and stays that way. But
 * the 55 products that needed a `display_name` are exactly the ones with NO
 * `aka` - so for over half the catalogue the duplicate nudge could never fire.
 * `POST /check-item {"text":"bananas"}` answered `unmatched_new_item` on live
 * while the household had `ASDA 6 Bananas` displaying as "Bananas".
 *
 * ── ⛔ WHY IT CANNOT REDIRECT ANYTHING (AC2, AC4) ──────────────────────────
 * This is not called until `resolveReading` has already returned NO IDENTITY.
 * That is structural rather than a rule to remember: the only call site is
 * inside the no-identity branch, so a term the catalogue resolves confidently
 * never reaches here and cannot be moved onto another product. `display_name`
 * is not passed to the resolver, is not read by it, and adding it to the
 * regulars objects changed no verdict - checkItem.test.js's "a display name
 * never becomes a matching term" is the executed pin on that.
 *
 * ── EXACT NORMALISED EQUALITY, AND NOTHING ELSE (AC1) ─────────────────────
 * `normaliseTerm` is the estate's own normaliser, borrowed. There is no
 * substring test, no token overlap, no score and no threshold, so there is no
 * number here that a later change could loosen. An empty normal form matches
 * NOTHING: "..." normalises to "" and a blank display name normalises to "",
 * and letting those meet would name a product for punctuation.
 *
 * ── AMBIGUITY REFUSES, SILENTLY (AC3) ─────────────────────────────────────
 * Two active regulars sharing a normalised display name is Warwick having
 * named two things the same. The answer is that she is told nothing - the
 * caller turns this into `needs_confirmation` with no name and no list. Mum is
 * never asked a question.
 *
 * @param {*} text
 * @param {Array<{id:*, display_name?:*}>} regulars
 * @returns {object|null} the one matching row, AMBIGUOUS, or null
 */
function displayNameHit(text, regulars) {
  const wanted = normaliseTerm(text);
  if (wanted === '') return null;
  let found = null;
  let hits = 0;
  for (let i = 0; i < regulars.length; i += 1) {
    const r = regulars[i];
    const raw = r && typeof r.display_name === 'string' ? r.display_name : '';
    if (raw.trim() === '') continue;
    if (normaliseTerm(raw) !== wanted) continue;
    hits += 1;
    if (found === null) found = r;
  }
  if (hits === 0) return null;
  return hits > 1 ? AMBIGUOUS : found;
}

/**
 * PURE. Classify ONE thing she typed against the household catalogue.
 *
 * @param {{text:*, regulars:Array<{id:*,name:*,aka:*}>, chosen?:Array}} input
 * @returns {{status:string, matched_name:string|null,
 *            matched_regular_id:number|null, already_on_list:boolean}}
 *
 * ── WHY `possible_duplicate` NEEDS `chosen` ───────────────────────────────
 * A single resolveReading() call CANNOT return it - `possible_duplicate` is set
 * by resolveAll() across a batch, from a `seen` set. One item checked on its own
 * has no batch. So "you have already got that, and it is already on today's
 * list" is answerable only because the page tells us what is already on it.
 */
function classifyItem(input) {
  const req = input && typeof input === 'object' ? input : {};
  const text = typeof req.text === 'string' ? req.text : '';
  if (text.trim() === '') {
    throw invalid('no_text', 'nothing was typed to check');
  }
  const regulars = Array.isArray(req.regulars) ? req.regulars : [];
  const already = chosenSet(req.chosen);

  // ⛔ THE ONE CALL. The verdict is READ, never spread.
  const verdict = resolver.resolveReading(text, regulars);
  const status = verdict && typeof verdict.status === 'string' ? verdict.status : 'unmatched_new_item';
  const matchedId = verdict ? idKey(verdict.matched_regular_id) : null;

  // Anything that is not a clean identity is answered with a status and NOTHING
  // she must decide. `alternatives` is on the verdict right now, and it dies
  // here - unread, never copied, never counted. A status this module does not
  // recognise falls here too: an unknown verdict is not a licence to improvise.
  if (matchedId === null || CHECK_ITEM_STATUSES.indexOf(status) === -1 || status === 'needs_confirmation') {
    // ── WP-B15-53. THE ONLY CALL SITE, AND ITS POSITION IS THE CONTROL ─────
    //
    // The catalogue has just declined to name a product. Only here - after
    // that has happened, and never before it - may the household's own display
    // names be consulted. AC4 ("the resolver still wins where it has an
    // answer") is therefore a property of where this line sits rather than a
    // condition anyone has to keep true.
    const hit = displayNameHit(text, regulars);

    // AC3. Warwick has named two things the same. She is told nothing, and the
    // response has nowhere to put the question anyway.
    if (hit === AMBIGUOUS) {
      return sealed({
        status: 'needs_confirmation',
        matched_name: null,
        matched_regular_id: null,
        already_on_list: false
      });
    }

    const hitId = hit === null ? null : idKey(hit.id);
    if (hitId !== null) {
      // The SAME already-on-list logic the resolver path uses. Two routes
      // reaching one product must not tell her two different things about it.
      const hitOnList = already.has(hitId);
      return sealed({
        status: hitOnList ? 'possible_duplicate' : 'matched',
        // The hit condition IS a non-blank display_name, so this is that name.
        // Routed through the one read rule regardless, so there is still only
        // one place that decides what she reads.
        matched_name: displayName.displayNameFor(hit, null),
        matched_regular_id: Number(hitId),
        already_on_list: hitOnList
      });
    }

    return sealed({
      status: status === 'unreadable' ? 'unreadable'
        : (status === 'needs_confirmation' ? 'needs_confirmation' : 'unmatched_new_item'),
      matched_name: null,
      matched_regular_id: null,
      already_on_list: false
    });
  }

  const onList = already.has(matchedId);

  // ── WP-B15-51 AC3a. WHAT SHE IS TOLD, NOT WHAT THE MATCHER DECIDED ────────
  //
  // THE LIVE DEFECT THIS CLOSES. Warwick typed "milk" into "add something else"
  // on the real Cockpit on 2026-08-13 and this route answered "You've already
  // got cravendale arla filtered fresh semi skimmed milk on your list" - the raw
  // retailer catalogue string, read out to an 84-year-old, from a surface nobody
  // had listed as one where a product name reaches her.
  //
  // The identity above is UNCHANGED and still comes from the resolver. Only the
  // WORDS change, and only after identity is settled - which is why this lookup
  // happens here rather than anywhere near `regulars` on its way in.
  const matched = regulars.filter(function (r) { return idKey(r && r.id) === matchedId; })[0] || null;
  const fallbackName = verdict.matched_product_name === undefined ? null : verdict.matched_product_name;

  return sealed({
    // She already has it either way. `possible_duplicate` is the stronger case -
    // it is ALSO already on the list she is looking at - and the page says so
    // warmly. She may still add it: this route advises, it never refuses.
    status: onList ? 'possible_duplicate' : 'matched',
    matched_name: displayName.displayNameFor(matched, fallbackName),
    matched_regular_id: Number(matchedId),
    already_on_list: onList
  });
}

/**
 * Load the household's active regulars, SELECT-only, inside a read-only
 * transaction - the same shape readRules uses.
 *
 * @param {{household_id?:*, client?:object}} [options]
 *
 * The client is injectable, so the classification proofs never need a database
 * and the one test that DOES want real rows can hand in a real client.
 */
async function loadRegulars(options) {
  const opts = options || {};
  const injected = opts.client || null;
  const householdId = opts.household_id === undefined || opts.household_id === null
    ? 1 : Number(opts.household_id);
  // Lazily, and only when there is no injected client: importing this module
  // must not require `pg` or an environment variable.
  // eslint-disable-next-line global-require
  // eslint-disable-next-line global-require
  const workspace = require('./readWorkspace');
  const client = injected || await workspace._internal.getPool().connect();
  try {
    if (!injected) await client.query('BEGIN TRANSACTION READ ONLY');
    // ONE definition of "which optional regulars columns exist", shared with the
    // workspace reader rather than written twice.
    const present = await workspace._internal.probeRegularsColumns(client);
    const haveDisplayName = present.indexOf('display_name') !== -1;
    const res = await client.query(haveDisplayName ? REGULARS_DISPLAY_SQL : REGULARS_BASE_SQL, [householdId]);
    if (!injected) await client.query('COMMIT');
    const rows = res && Array.isArray(res.rows) ? res.rows : [];
    return rows.map(function (r) {
      return {
        id: r.id,
        name: r.name,
        aka: Array.isArray(r.aka) ? r.aka : [],
        // Carried through even when absent, so classifyItem has one shape to
        // read. `displayNameFor` treats null as "not set".
        display_name: r.display_name === undefined ? null : r.display_name
      };
    });
  } catch (err) {
    if (!injected) {
      try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

module.exports = {
  classifyItem: classifyItem,
  loadRegulars: loadRegulars,
  CHECK_ITEM_STATUSES: CHECK_ITEM_STATUSES,
  RESPONSE_KEYS: RESPONSE_KEYS,
  IDENTIFYING_STATUSES: IDENTIFYING_STATUSES,
  REGULARS_SQL: REGULARS_SQL,
  REGULARS_BASE_SQL: REGULARS_BASE_SQL,
  REGULARS_DISPLAY_SQL: REGULARS_DISPLAY_SQL,
  _internal: {
    sealed: sealed,
    idKey: idKey,
    chosenSet: chosenSet,
    displayNameHit: displayNameHit,
    AMBIGUOUS: AMBIGUOUS
  }
};
