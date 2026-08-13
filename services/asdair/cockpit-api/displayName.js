// =====================================================================
// BUILD-015 AsdAIr WP-B15-51 - cockpit-api/displayName.js
//
// THE THIRD FIELD. What Mum READS, and the door through which Warwick sets it.
//
// ── WARWICK'S DESIGN, AND WHY IT IS SAFER THAN THE ONE IT REPLACED ─────────
//
// The obvious fix for "Mum's tile shows a retailer catalogue string" was to let
// Warwick edit `aka`. That would have been a silent defect: `aka` is THE
// MATCHER'S INPUT (resolveByCatalogue.js aliasesOf), so improving what she READS
// would have changed what MATCHES - renaming the BOB milk to "milk" makes every
// written "milk" ambiguous against the Cravendale. Warwick separated the two
// concerns himself.
//
//   name          the official ASDA listing. Not editable. The matcher reads it.
//   aka           what Mum writes on her lists. A MATCHING TERM. Not editable.
//                 The matcher reads it; nothing shows it to her.
//   display_name  THIS. What Mum reads. Warwick edits it. The matcher never
//                 reads it - displayName.test.js proves that by execution.
//
// The asymmetry is the design: a nudge is OUTPUT to her, the resolver is INPUT
// from her. Same column, opposite directions, and only one direction sees it.
//
// ── WHY `name` AND `aka` ARE SAFE FROM THIS ROUTE ─────────────────────────
// The UPDATE below names one column, written once, as text. It is not assembled
// from input, and setDisplayName() is handed two validated primitives rather
// than the request body - so no key of that body reaches the statement.
//
// For `name` the database refuses it anyway: asdair_rw holds no UPDATE
// privilege on that column (005's column-scoped grant). `aka` IS granted to
// that role, because the weekly learning write-back needs it, so `aka` is safe
// here by how this route is written rather than by the grant.
//
// ── PURE AT IMPORT ────────────────────────────────────────────────────────
// No `pg`, no environment variable, no pool. The write takes an injected
// `writeQuery`, as everything else in this folder does, so the validation proofs
// run on a box with no database at all.
//
// PURE ASCII.
// =====================================================================

'use strict';

/**
 * The only statement this module issues. ONE row, ONE editable column, plus
 * `updated_at` - written because a row that changed while carrying a stale
 * `updated_at` is a lie, and because every other writer here maintains it.
 * `updated_at` is inside asdair_rw's existing grant (005) and is not a widening.
 */
const UPDATE_SQL =
  'UPDATE asdair.regulars SET display_name = $1, updated_at = now() ' +
  'WHERE id = $2 RETURNING id, display_name';

/**
 * 60 characters, enforced HERE and nowhere else. Warwick's Work Order proposed
 * the number and did not rule it.
 *
 * Deliberately not also a database CHECK: this route is reachable only by
 * Warwick, on his own tailnet, and if a long name ever did land he would edit
 * it. That is the whole recovery story and it is enough.
 */
const MAX_DISPLAY_NAME = 60;

/** Errors carry a machine code so the HTTP layer maps them without matching prose. */
function invalid(code, message) {
  const e = new Error(message);
  e.code = code;
  e.expose = true;          // about WARWICK'S input, never about configuration
  return e;
}

/**
 * PURE. What Warwick typed, reduced to what may be stored - or null.
 *
 * TRIMMED, AND OTHERWISE UNTOUCHED. No case folding, no collapsing of internal
 * spaces, no title-casing. His words are his; whitespace at the ends is a typing
 * artefact rather than a choice.
 *
 * NULL AND EMPTY BOTH CLEAR IT. He must be able to undo a bad name, not only
 * overwrite it, and "cleared" has exactly one storable representation.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normaliseDisplayName(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw invalid('display_name_invalid', 'A display name has to be text, or empty to clear it.');
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > MAX_DISPLAY_NAME) {
    // NEVER A TRUNCATION. Silently storing 60 characters of a 74-character name
    // would put words on Mum's tile that nobody chose and he would not know had
    // been cut.
    throw invalid(
      'display_name_too_long',
      'That display name is ' + trimmed.length + ' characters; the limit is ' + MAX_DISPLAY_NAME + '.'
    );
  }
  return trimmed;
}

/**
 * PURE. The catalogue id, as a positive integer, or a refusal.
 *
 * asdair.regulars.id is `bigint`, which node-postgres returns as a STRING, and
 * the Cockpit sends back whatever JSON carried. Both sides normalise here so a
 * type mismatch cannot become a silent no-op UPDATE against nothing.
 */
function normaliseId(value) {
  if (typeof value === 'boolean' || value === null || value === undefined || value === '') {
    throw invalid('id_invalid', 'Which product? No catalogue id arrived with that request.');
  }
  const n = Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw invalid('id_invalid', 'That catalogue id is not a whole positive number.');
  }
  return n;
}

/**
 * ⭐ THE READ RULE, AND IT IS A RULE RATHER THAN A PATCH.
 *
 * PURE. What MUM should read for this product, everywhere her eyes land on one -
 * a tile, a nudge, a confirmation. `display_name` when Warwick has set one;
 * otherwise whatever the caller would have shown her.
 *
 * WHY IT LIVES BESIDE THE WRITE RULE. The two halves of this column are one
 * decision: what he types is what she reads. Splitting them across modules is
 * how a second surface ends up choosing differently - and the surface that
 * exposed this requirement was one nobody had listed: on 2026-08-13 Warwick
 * typed "milk" into Mum's own page and the sense-check nudge read back
 * "you've already got cravendale arla filtered fresh semi skimmed milk".
 *
 * ⛔ NOT FOR THE MATCHER. Output to Mum only. Nothing on the interpretation path
 *    calls this.
 *
 * @param {object|null|undefined} regular  the catalogue row
 * @param {string|null} fallback           what would have been shown otherwise
 * @returns {string|null}
 */
function displayNameFor(regular, fallback) {
  const r = regular && typeof regular === 'object' ? regular : null;
  const chosen = r ? r.display_name : null;
  if (typeof chosen === 'string' && chosen.trim() !== '') return chosen;
  return fallback === undefined ? null : fallback;
}

/**
 * Set (or clear) ONE regular's display name.
 *
 * Takes two primitives, not a body: the HTTP layer reads exactly `id` and
 * `display_name` off the request and passes nothing else.
 *
 * @param {{id:*, display_name:*}} input
 * @param {{writeQuery: Function}} deps
 * @returns {Promise<{id:number, display_name:string|null}>}
 */
async function setDisplayName(input, deps) {
  const req = input && typeof input === 'object' ? input : {};
  const d = deps || {};
  if (typeof d.writeQuery !== 'function') {
    const e = new Error('asdair cockpit-api: no write connection, so no display name can be saved.');
    e.code = 'ASDAIR_CONFIG_MISSING';
    throw e;
  }

  // Both validated before the database is touched, so a bad name and a bad id
  // refuse the same way whether or not a connection exists.
  const id = normaliseId(req.id);
  const value = normaliseDisplayName(req.display_name);

  const res = await d.writeQuery(UPDATE_SQL, [value, id]);
  const rows = res && Array.isArray(res.rows) ? res.rows : [];
  if (rows.length === 0) {
    // No row means no such regular. A write that matched nothing must never
    // report that it saved something.
    throw invalid('regular_not_found', 'There is no product with that catalogue id.');
  }
  return {
    id: Number(rows[0].id),
    display_name: rows[0].display_name === undefined ? null : rows[0].display_name
  };
}

module.exports = {
  setDisplayName: setDisplayName,
  displayNameFor: displayNameFor,
  normaliseDisplayName: normaliseDisplayName,
  normaliseId: normaliseId,
  UPDATE_SQL: UPDATE_SQL,
  MAX_DISPLAY_NAME: MAX_DISPLAY_NAME
};
