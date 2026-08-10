// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/shopLines.js
//
// THE DURABLE HOME OF THE INTERPRETATION (migration 008, asdair.shop_line).
//
// Until this table existed the grounded interpreter's output had nowhere to
// live: it was computed, turned into list rows, and then forgotten. That meant
// "what did AsdAIr think line 7 said, and how confident was it?" could only be
// answered by reading the model again - which is exactly the
// knowledge-evaporates-with-the-session failure this build exists to end.
//
// ── WHY THIS WRITER IS HERE AND NOT IN shop/ ────────────────────────────────
// asdair.shop_line has no existing owner: it arrived with migration 008 for
// precisely this stage. shopStore.js owns the shop CONTROL surface (status,
// questions, browser requests, pending actions) and this work package must not
// modify it. So the pipeline owns its own table, under the same discipline
// shopStore applies to its own:
//
//   * IDEMPOTENT BY CONSTRUCTION. INSERT ... ON CONFLICT (shop_id, line_no)
//     DO UPDATE. Re-running interpretation UPDATES line 7; it never appends a
//     second copy of the list.
//   * COLUMN ALLOWLIST. The SET clause is BUILT from INTERPRETATION_COLUMNS,
//     not filtered against it, so `confirmed_by`, `confirmed_at` and
//     `list_item_id` have no path into the interpretation write at all.
//   * NEVER DELETES. This module emits exactly two statement shapes, INSERT and
//     a column-restricted UPDATE. shopLines.test.js asserts that on the source.
//   * A HUMAN'S CONFIRMATION IS NEVER OVERWRITTEN. The upsert carries
//     `WHERE shop_line.confirmed_by IS NULL`, so a re-read cannot undo a
//     decision Warwick already made. A skipped update is reported honestly
//     (`skipped: true`), never silently.
//
// ── THE NAME IS DELIBERATELY NOT STORED ─────────────────────────────────────
// A `matched` line carries `matched_regular_id` and NOTHING ELSE identifying.
// The canonical product name is looked up from asdair.regulars by that id -
// so a rename cannot leave a stale name behind, and model prose can never
// masquerade as a canonical product name. `withCanonicalNames` below is the
// only way a name is attached, and it reads the catalogue, never the row.
//
// ── QUANTITY: NULL MEANS "ASK A HUMAN" ──────────────────────────────────────
// A quantity that was not visibly written is null. It is never defaulted to 1
// and never guessed - the schema's CHECK rejects <= 0 and > 999, and this
// module refuses anything non-integer before it can reach the statement.
// =====================================================================

/** The status vocabulary, mirroring migration 008's CHECK. */
export const LINE_STATUSES = Object.freeze([
  'matched', 'needs_confirmation', 'unmatched_new_item', 'unreadable', 'possible_duplicate', 'excluded',
]);

/**
 * The columns an INTERPRETATION may write. Note what is ABSENT and must stay
 * absent: confirmed_by, confirmed_at, list_item_id, corrected. Re-reading a
 * photograph must never be able to rewrite what a human decided about it.
 */
export const INTERPRETATION_COLUMNS = Object.freeze([
  'shop_id', 'line_no', 'raw_reading', 'quantity', 'matched_regular_id',
  'match_basis', 'match_confidence', 'alternatives', 'status',
]);

const SELECT_LIST =
  'id, shop_id, line_no, raw_reading, quantity, matched_regular_id, match_basis, match_confidence, ' +
  'alternatives, status, confirmed_by, confirmed_at, corrected, list_item_id, created_at, updated_at';

const UPSERT_SQL =
  `INSERT INTO asdair.shop_line (${INTERPRETATION_COLUMNS.join(', ')}) ` +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) ' +
  'ON CONFLICT (shop_id, line_no) DO UPDATE SET ' +
  INTERPRETATION_COLUMNS
    .filter((c) => c !== 'shop_id' && c !== 'line_no')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ') +
  ', updated_at = now() ' +
  // A HUMAN'S CONFIRMATION IS NEVER OVERWRITTEN BY A RE-READ.
  'WHERE asdair.shop_line.confirmed_by IS NULL ' +
  `RETURNING ${SELECT_LIST}`;

const SELECT_BY_KEY_SQL =
  `SELECT ${SELECT_LIST} FROM asdair.shop_line WHERE shop_id = $1 AND line_no = $2`;

const SELECT_BY_SHOP_SQL =
  `SELECT ${SELECT_LIST} FROM asdair.shop_line WHERE shop_id = $1 ORDER BY line_no ASC`;

const LINK_LIST_ITEM_SQL =
  'UPDATE asdair.shop_line SET list_item_id = $3, updated_at = now() ' +
  `WHERE shop_id = $1 AND line_no = $2 RETURNING ${SELECT_LIST}`;

const MARK_CORRECTED_SQL =
  'UPDATE asdair.shop_line SET corrected = true, confirmed_by = $3, confirmed_at = now(), updated_at = now() ' +
  `WHERE shop_id = $1 AND line_no = $2 RETURNING ${SELECT_LIST}`;

// Which of these list items are claimed by the interpretation of a DIFFERENT
// shop? (WP-B15-10)
//
// `asdair.shopping_lists` carries `unique (household_id, list_date)`
// (001_asdair_schema.sql:251, never altered by a later migration), so two shops
// on one calendar date SHARE one list row - by schema, not by choice. This
// statement is the only durable evidence that a row on that shared list was put
// there by somebody else's shop.
//
// ⚠️ IT ANSWERS ONE QUESTION, AND THE NEGATIVE IS NOT ITS ANSWER. A row that
// comes back is PROVABLY another shop's. A row that does not come back is NOT
// thereby proven to be this shop's: `stepInterpret` is the ONLY caller of
// linkListItem in the estate, so a line added by `stepApplyCorrections`
// (Warwick correcting or adding one) or by the cockpit's
// `add_regular_to_next_week` (which has no shop context and can never link)
// carries no claim at all. Unclaimed rows belong to nobody and must be LEFT
// ALONE.
//
// Reading this as an allowlist - keeping only what this shop claims - silently
// drops the things Warwick himself asked for. That is the same harm as the
// defect this exists to fix, and worse for being silent. It was built that way
// once, the suite killed it, and this comment is why it must not come back.
const SELECT_FOREIGN_CLAIMS_SQL =
  'SELECT DISTINCT list_item_id FROM asdair.shop_line ' +
  'WHERE shop_id <> $1 AND list_item_id = ANY($2::bigint[])';

function fail(message) { throw new Error(`shopLines: ${message}`); }

/**
 * PURE. Validate and shape one interpreted line into the row migration 008 will
 * accept. Every CHECK the database enforces is checked HERE first, so a
 * violation is a readable sentence rather than a 23514.
 */
export function buildLine(shopId, line) {
  const lineNo = Number(line.line_no);
  if (!Number.isInteger(lineNo) || lineNo < 1) {
    fail(`line_no must be a positive integer, got ${String(line.line_no)}`);
  }

  const status = line.status || 'unmatched_new_item';
  if (!LINE_STATUSES.includes(status)) {
    fail(`status "${status}" is not one of: ${LINE_STATUSES.join(', ')}`);
  }

  const matchedId = line.matched_regular_id === null || line.matched_regular_id === undefined
    ? null : Number(line.matched_regular_id);
  if (matchedId !== null && (!Number.isInteger(matchedId) || matchedId <= 0)) {
    fail(`matched_regular_id must be a positive integer or null, got ${String(line.matched_regular_id)}`);
  }
  // THE GROUNDING INVARIANT, checked before the database checks it: nothing may
  // record a confident match to nothing.
  if (status === 'matched' && matchedId === null) {
    fail(`line ${lineNo} claims status "matched" with no matched_regular_id. `
      + 'A confident match to no product is exactly the fabrication catalogue grounding exists to prevent.');
  }

  let quantity = null;
  if (line.quantity !== null && line.quantity !== undefined && line.quantity !== '') {
    const q = Number(line.quantity);
    // NEVER defaulted to 1. Null means "not visibly written - ask a human".
    if (!Number.isInteger(q) || q < 1 || q > 999) {
      fail(`line ${lineNo} quantity must be an integer 1..999 or null (a quantity that was not visibly written stays null; it is never guessed), got ${String(line.quantity)}`);
    }
    quantity = q;
  }

  let confidence = null;
  if (line.match_confidence !== null && line.match_confidence !== undefined) {
    const c = Number(line.match_confidence);
    if (!Number.isFinite(c) || c < 0 || c > 1) fail(`line ${lineNo} match_confidence must be 0..1 or null`);
    confidence = c;
  }

  const alternatives = Array.isArray(line.alternatives) ? line.alternatives : [];

  return {
    shop_id: shopId,
    line_no: lineNo,
    raw_reading: String(line.raw_reading ?? '').trim() || null,
    quantity,
    matched_regular_id: matchedId,
    match_basis: line.match_basis ?? null,
    match_confidence: confidence,
    alternatives,
    status,
  };
}

/**
 * Persist one interpreted line. Idempotent on (shop_id, line_no).
 *
 * @returns {{line:object, written:boolean, skipped:boolean}} `skipped` is true
 *          when a human had already confirmed the line and the re-read was
 *          therefore refused - reported, never silent.
 */
export async function upsertLine(deps, shopId, line) {
  const row = buildLine(shopId, line);
  const params = [
    row.shop_id, row.line_no, row.raw_reading, row.quantity, row.matched_regular_id,
    row.match_basis, row.match_confidence, JSON.stringify(row.alternatives), row.status,
  ];
  const res = await deps.writeQuery(UPSERT_SQL, params);
  const written = ((res && res.rows) || [])[0] || null;
  if (written) return { line: written, written: true, skipped: false };

  // Zero rows means the WHERE guard refused the update: a human has confirmed
  // this line. Hand back what is actually stored.
  const existing = ((await deps.readQuery(SELECT_BY_KEY_SQL, [shopId, row.line_no])).rows || [])[0] || null;
  if (!existing) {
    fail(`the upsert wrote nothing for shop ${shopId} line ${row.line_no} and no such line exists. Nothing was written.`);
  }
  return { line: existing, written: false, skipped: true };
}

/** Persist a whole interpretation. Returns one result per line, in page order. */
export async function upsertLines(deps, shopId, lines) {
  const out = [];
  for (const line of lines) out.push(await upsertLine(deps, shopId, line));
  return out;
}

/** Every interpreted line of a shop, in page order. */
export async function listLines(deps, shopId) {
  const res = await deps.readQuery(SELECT_BY_SHOP_SQL, [shopId]);
  return (res && res.rows) || [];
}

/**
 * Bind an interpreted line to the real list item it became.
 *
 * THIS IS THE REPLAY GUARD: a line that already carries a list_item_id has
 * already been materialised, so a re-run knows not to treat it as new.
 */
export async function linkListItem(deps, shopId, lineNo, listItemId) {
  const res = await deps.writeQuery(LINK_LIST_ITEM_SQL, [shopId, lineNo, listItemId]);
  return ((res && res.rows) || [])[0] || null;
}

/**
 * The list items, out of those given, that a DIFFERENT shop's interpretation
 * claims. See SELECT_FOREIGN_CLAIMS_SQL above for what this does and does not
 * prove - the negative is not its answer.
 *
 * Returns ids as STRINGS, because callers compare them against
 * `shopping_list_items.id` values that arrive from `pg` as either, and a
 * `bigint` that came back as a string must not silently miss its own row.
 *
 * @returns {Promise<string[]>} possibly empty; empty means "nothing here is
 *          provably another shop's", never "everything here is this shop's".
 */
export async function listForeignClaimedItemIds(deps, shopId, listItemIds) {
  const ids = (Array.isArray(listItemIds) ? listItemIds : [])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  // Nothing to ask about. Never send an empty array to the database for it.
  if (ids.length === 0) return [];
  const res = await deps.readQuery(SELECT_FOREIGN_CLAIMS_SQL, [shopId, ids]);
  return ((res && res.rows) || [])
    .map((r) => (r ? r.list_item_id : null))
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(String);
}

/** Record that a human corrected (and thereby confirmed) a line. A confirmed
 *  line is immune to being overwritten by a later re-read. */
export async function markCorrected(deps, shopId, lineNo, confirmedBy) {
  const res = await deps.writeQuery(MARK_CORRECTED_SQL, [shopId, lineNo, confirmedBy]);
  return ((res && res.rows) || [])[0] || null;
}

/**
 * PURE. Attach canonical product names by LOOKING THEM UP from the catalogue.
 *
 * The only route a canonical name has into anything this module produces. The
 * row stores an id; the name comes from asdair.regulars via that id; a model's
 * own words stay in `raw_reading` where they belong and can never be mistaken
 * for a product we stock.
 */
export function withCanonicalNames(lines, catalogue) {
  const byId = catalogue && catalogue.regularsById instanceof Map
    ? catalogue.regularsById
    : new Map((catalogue && catalogue.regulars ? catalogue.regulars : []).map((r) => [r.id, r]));
  return lines.map((l) => {
    const reg = l.matched_regular_id === null || l.matched_regular_id === undefined
      ? null : byId.get(Number(l.matched_regular_id)) || null;
    return {
      ...l,
      // FROM OUR OWN ROWS, BY ID. Never the model's words.
      canonical_name: reg ? reg.name : null,
      asda_product_id: reg ? reg.asda_product_id ?? null : null,
    };
  });
}

export const _internal = {
  UPSERT_SQL, SELECT_BY_KEY_SQL, SELECT_BY_SHOP_SQL, LINK_LIST_ITEM_SQL, MARK_CORRECTED_SQL,
  SELECT_FOREIGN_CLAIMS_SQL,
};
