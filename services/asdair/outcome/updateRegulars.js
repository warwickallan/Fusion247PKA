// =====================================================================
// IDEA-012 AsdAIr - the learning writer: updateRegulars.js
//
// The thin WRITE half of the highest-value gap in outcome/README.md: nothing
// could persist an `aka` alias, a harvested asda_product_id / asda_url, or a
// genuinely-new item, so every fresh instance re-asked the same questions.
//
//   updateRegulars(operation) -> { op, id, created?, updated?, aka? }
//
// WRITE BOUNDARY (why this file is NOT in services/asdair/skill/):
//   services/asdair/skill/ is READ-ONLY BY CONTRACT -- every query in data.js
//   is a SELECT inside `BEGIN TRANSACTION READ ONLY`. That invariant is NOT
//   weakened here: this writer lives in the sibling outcome/ folder, so "the
//   skill never writes" stays literally true and reviewable. loadRegulars()
//   keeps reading exactly as before.
//
// ONE TRANSACTION PER OPERATION:
//   upsertRegular : BEGIN -> dedupe guard (does this household already have a
//                   regular by this NORMALISED name?) -> if so ADOPT it and
//                   change nothing -> else INSERT ... ON CONFLICT DO NOTHING
//                   -> COMMIT.
//   enrichRegular : BEGIN -> SELECT the row -> merge aliases against what was
//                   READ -> UPDATE the allowlisted columns -> COMMIT.
//   Any failure ROLLBACKs.
//
// RE-RUNNING AN UPSERT IS ALWAYS SAFE. The table's own UNIQUE constraint is
// (household_id, source, name) -- an EXACT, source-scoped match -- so it alone
// would happily accept "Arla 4pt  Milk" alongside "arla 4pt milk", or the same
// item again under a different `source`. That is not a cosmetic duplicate:
// planner.js treats two active regulars answering one term as AMBIGUOUS and
// sends the line to a human, so a duplicate BREAKS resolution for that item
// every week. The guard therefore matches on the same normalisation the read
// path uses, across the whole household, and adopts rather than creates.
//
// THE THREE HARD RULES, ENFORCED IN THE SQL ITSELF:
//
//   1. NEVER DELETE. This file emits exactly two statement shapes: INSERT and
//      a column-restricted UPDATE. There is no DELETE, no TRUNCATE, no DROP --
//      and updateRegulars.test.js asserts that on the source text, so the
//      guarantee cannot be quietly lost in a later edit.
//
//   2. NEVER set active = false as a side effect. `active` is not in
//      ENRICH_ALLOWED_COLUMNS, so it cannot appear in a SET clause: the clause
//      is BUILT from the allowlist, it is not filtered against it. A column
//      that is not on the list has no way to reach the SQL at all.
//
//   3. NEVER touch `name` or `household_id` on an existing row. Same
//      mechanism. The UPDATE also never widens beyond `WHERE id = $n`, so it
//      can only ever affect the one row named.
//
// ALIAS MERGE -- READ, MERGE, GUARDED WRITE:
//   `aka` is text[] and holds accumulated learning, so the new value is built
//   from the array READ IN THIS TRANSACTION, never from caller input. The
//   UPDATE then carries `AND aka = $expected::text[]`: if another writer added
//   an alias between the read and the write, zero rows match and the whole
//   thing ROLLBACKs with a clear message, rather than silently discarding
//   somebody else's alias (the classic lost update).
//
//   Deliberately NOT `SELECT ... FOR UPDATE`: in Postgres that requires the
//   UPDATE privilege on the whole row, and this role's UPDATE grant is
//   column-scoped to the allowlist on purpose. The optimistic guard gets the
//   same safety without asking for a privilege the write path must not hold.
//
// SECRETS:
//   * The connection string comes ONLY from process.env.ASDAIR_WRITE_DB_URL,
//     the same convention as recordShopOutcome.js. Never hardcoded, never
//     printed, never logged.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const {
  buildRegularsUpdate,
  applyAkaMerge,
  REGULAR_INSERT_COLUMNS,
  ENRICH_ALLOWED_COLUMNS,
  ENRICH_WRITER_OWNED
} = require('./buildRegularsUpdate');

// updated_at is written as a SQL LITERAL, never a bound parameter -- the same
// discipline recordShopOutcome uses to pin checked_out. This module has no
// clock, and the database's now() is the honest answer for "when was this row
// last learned about".
const ENRICH_LITERALS = {
  updated_at: 'now()'
};

// Read-backs for the dedupe guard, the adopt-on-conflict path and the alias
// merge. All are plain SELECTs on asdair.regulars; no UPDATE privilege is
// implied by any of them.
//
// FIND_REGULAR_BY_NORMALISED_NAME_SQL is THE DEDUPE GUARD. Its expression
// -- lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) -- is the SQL
// equivalent of planner.js normaliseTerm() / buildRegularsUpdate
// normaliseAlias(): trim, collapse internal whitespace, lower-case. It is
// scoped to the household but NOT to `source`, deliberately: the same item
// arriving from a different source is still the same item, and a second row
// for it would make the planner report the term as AMBIGUOUS every week.
// Lowest id wins so the adoption is deterministic.
const FIND_REGULAR_BY_NORMALISED_NAME_SQL =
  "SELECT id, name, source, active FROM asdair.regulars " +
  "WHERE household_id = $1 AND lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = $2 " +
  'ORDER BY id ASC';
const FIND_REGULAR_BY_IDENTITY_SQL =
  'SELECT id FROM asdair.regulars WHERE household_id = $1 AND source = $2 AND name = $3';
const READ_REGULAR_SQL =
  'SELECT id, name, aka, active FROM asdair.regulars WHERE id = $1';

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair Postgres connection string as ASDAIR_WRITE_DB_URL before writing a regular.');
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url });
  return pool;
}

// ---------------------------------------------------------------------
// Build the parameterised INSERT for a new regular. Column identifiers come
// from the shared constant (fixed identifiers, never external input), so every
// value is bound and the statement cannot be injected into.
//
// ON CONFLICT DO NOTHING -- never DO UPDATE: an upsert that overwrote on
// conflict would be a route to changing `name`, `active` or anything else on
// an EXISTING row while completely bypassing the enrich allowlist. Adopting
// the existing row is the only safe conflict behaviour here.
// ---------------------------------------------------------------------
function buildRegularInsert(built) {
  const params = REGULAR_INSERT_COLUMNS.map(function (col) {
    const v = built.row[col];
    return v === undefined ? null : v;
  });
  const placeholders = REGULAR_INSERT_COLUMNS.map(function (_, i) { return '$' + (i + 1); });
  const sql = 'INSERT INTO asdair.regulars (' + REGULAR_INSERT_COLUMNS.join(', ') + ') VALUES (' +
    placeholders.join(', ') + ') ON CONFLICT ' + built.conflict_target + ' DO NOTHING RETURNING id';
  return { sql: sql, params: params };
}

// ---------------------------------------------------------------------
// Build the column-restricted UPDATE.
//
// The SET clause is BUILT FROM THE ALLOWLIST -- it iterates
// ENRICH_ALLOWED_COLUMNS and emits only those the operation carries. A column
// outside the allowlist therefore has no path into the SQL at all; this is not
// a filter that could be bypassed by a cleverly-named key, it is the only
// source the clause is generated from.
//
// updated_at is always emitted, always as the literal now().
// ---------------------------------------------------------------------
function buildRegularUpdate(built) {
  if (built.requires_existing_aka === true) {
    throw new Error('updateRegulars: the alias merge has not been applied yet -- applyAkaMerge must run ' +
      'against the aliases READ from the database before an UPDATE can be built.');
  }

  const params = [];
  const assignments = [];

  ENRICH_ALLOWED_COLUMNS.forEach(function (col) {
    if (Object.prototype.hasOwnProperty.call(ENRICH_LITERALS, col)) {
      assignments.push(col + ' = ' + ENRICH_LITERALS[col]);
      return;
    }
    if (ENRICH_WRITER_OWNED.indexOf(col) !== -1) return;   // writer-owned, no literal: never written
    if (!Object.prototype.hasOwnProperty.call(built.set, col)) return;
    const v = built.set[col];
    params.push(v === undefined ? null : v);
    assignments.push(col + ' = $' + params.length + (col === 'aka' ? '::text[]' : ''));
  });

  params.push(built.id);
  let where = 'id = $' + params.length;

  // Optimistic-concurrency guard: only write the merged aliases if the row
  // still holds exactly what the merge was computed from.
  if (Object.prototype.hasOwnProperty.call(built.set, 'aka')) {
    params.push(Array.isArray(built.expected_aka) ? built.expected_aka : []);
    where += ' AND aka = $' + params.length + '::text[]';
  }

  const sql = 'UPDATE asdair.regulars SET ' + assignments.join(', ') + ' WHERE ' + where + ' RETURNING id';
  return { sql: sql, params: params };
}

// ---------------------------------------------------------------------
// Main entry point.
//
// options.client (optional): an already-connected pg client to run on (see
// recordShopOutcome.js for the rationale). No connection string is ever
// hardcoded.
// ---------------------------------------------------------------------
async function updateRegulars(operation, options) {
  // PURE validation first: a forbidden column, a direct `aka` assignment or a
  // missing field fails BEFORE any connection is opened.
  const built = buildRegularsUpdate(operation);

  const opts = options || {};
  const injected = opts.client || null;
  const client = injected || await getPool().connect();

  try {
    await client.query('BEGIN');

    let result;
    if (built.op === 'upsertRegular') {
      result = await runUpsert(client, built);
    } else {
      result = await runEnrich(client, built);
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (ignore) { /* no-op */ }
    throw err;
  } finally {
    if (!injected) client.release();
  }
}

async function runUpsert(client, built) {
  // ---- THE DEDUPE GUARD, first ------------------------------------------
  // Before creating anything, ask whether this household already has a
  // regular by this name under the normalisation the READ path matches with.
  // If it does, adopt it and change NOTHING: re-running an upsert is
  // therefore always safe, and a near-twin ("Arla 4pt  Milk" vs "arla 4pt
  // milk", or the same item under a different `source`) can never be created.
  const dupes = await client.query(FIND_REGULAR_BY_NORMALISED_NAME_SQL,
    [built.row.household_id, built.normalised_name]);
  const dupeRows = (dupes && dupes.rows) || [];
  if (dupeRows.length > 0) {
    return {
      op: 'upsertRegular',
      id: dupeRows[0].id,
      created: false,
      adopted: true,
      matched_by: 'normalised_name',
      existing_name: dupeRows[0].name,
      // Surfaced rather than acted on: this row may be retired, and
      // reactivating it is a human decision, never a side effect of an import
      // (see the `active` rule).
      existing_active: dupeRows[0].active === undefined ? null : dupeRows[0].active
    };
  }

  const insert = buildRegularInsert(built);
  const res = await client.query(insert.sql, insert.params);
  const rows = (res && res.rows) || [];
  if (rows.length > 0) {
    return { op: 'upsertRegular', id: rows[0].id, created: true, adopted: false, matched_by: null };
  }

  // ON CONFLICT DO NOTHING wrote nothing, so the UNIQUE (household_id,
  // source, name) already holds this regular -- the race backstop for two
  // concurrent upserts that both passed the dedupe guard. Adopt it and change
  // NOTHING about it. Enriching an existing row is a separate, allowlisted
  // operation the caller must ask for explicitly.
  const found = await client.query(FIND_REGULAR_BY_IDENTITY_SQL,
    [built.row.household_id, built.row.source, built.row.name]);
  const foundRows = (found && found.rows) || [];
  if (foundRows.length === 0) {
    throw new Error('updateRegulars: the insert wrote no row and no existing regular matches ' +
      '(household_id, source, name). Nothing was written.');
  }
  return { op: 'upsertRegular', id: foundRows[0].id, created: false, adopted: true, matched_by: 'identity' };
}

async function runEnrich(client, built) {
  // READ first: the alias merge must be computed from what is actually
  // stored, and a clear "no such regular" beats a silent zero-row UPDATE.
  const read = await client.query(READ_REGULAR_SQL, [built.id]);
  const rows = (read && read.rows) || [];
  if (rows.length === 0) {
    throw new Error('updateRegulars: no asdair.regulars row with id ' + String(built.id) + '. Nothing was written.');
  }
  const row = rows[0];

  const merged = applyAkaMerge(built, row.aka, row.name);
  const update = buildRegularUpdate(merged);
  const res = await client.query(update.sql, update.params);

  if (!res || res.rowCount !== 1) {
    // The only way to get here with the row present is the optimistic guard:
    // its aliases changed under us between the read and the write.
    throw new Error('updateRegulars: regular ' + String(built.id) + ' was modified concurrently ' +
      '(its aka array changed between the read and the write), so the merge was computed against stale ' +
      'aliases. Nothing was written -- re-run the enrichment.');
  }

  return {
    op: 'enrichRegular',
    id: built.id,
    updated: true,
    columns: Object.keys(merged.set),
    aka: merged.set.aka || null
  };
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  updateRegulars: updateRegulars,
  close: close,
  // Exported for tests: the SQL builders and the read queries, so all of it
  // can be exercised with no database.
  _internal: {
    buildRegularInsert: buildRegularInsert,
    buildRegularUpdate: buildRegularUpdate,
    FIND_REGULAR_BY_NORMALISED_NAME_SQL: FIND_REGULAR_BY_NORMALISED_NAME_SQL,
    FIND_REGULAR_BY_IDENTITY_SQL: FIND_REGULAR_BY_IDENTITY_SQL,
    READ_REGULAR_SQL: READ_REGULAR_SQL,
    ENRICH_LITERALS: ENRICH_LITERALS
  }
};
