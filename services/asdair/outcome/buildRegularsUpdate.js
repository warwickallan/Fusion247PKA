// =====================================================================
// IDEA-012 AsdAIr - the learning writer: buildRegularsUpdate.js
//
// The PURE half of the gap outcome/README.md names as
// "THE HIGHEST-VALUE REMAINING GAP":
//
//   > asdair.regulars has no governed writer, so the commonest learning of
//   > all -- "this list name means that product", i.e. a new `aka` alias --
//   > cannot be persisted. Alias coverage improves only by hand, and a fresh
//   > instance re-asks the same questions.
//
// SOP-021 step 3 says every answer is a learning event and "the same question
// is never asked twice". Step 6 says an item missing from the catalogue
// "becomes a regulars row, not a note". Neither was possible. This is that
// missing writer's pure core.
//
//   buildRegularsUpdate(operation) -> a built operation
//   applyAkaMerge(built, existingAka, existingName) -> a NEW built operation
//
// PURE and DETERMINISTIC: no DB, no network, no fs, no clock, no randomness,
// no mutation of the arguments.
//
// TWO OPERATIONS. NOTHING ELSE.
//
//   'upsertRegular'  INSERT a genuinely new regular. It ADOPTS an existing row
//                    and reports created:false whenever the household already
//                    has a regular by that NORMALISED name (the dedupe guard,
//                    see `normalised_name` below) or by the exact UNIQUE
//                    identity. It NEVER overwrites one, because overwriting
//                    would be a route to changing `name`/`active`/anything at
//                    all while bypassing the enrich allowlist below.
//
//   'enrichRegular'  UPDATE an EXISTING regular by id, on a STRICT ALLOWLIST
//                    of columns and nothing else:
//
//                        asda_product_id, asda_url, aka, brand,
//                        substitutes_allowed, typical_qty, updated_at
//
// WHY THE ALLOWLIST IS AN ALLOWLIST AND NOT A DENYLIST:
//   A denylist is only as good as the last person who remembered to extend
//   it. A column added to asdair.regulars tomorrow would be silently
//   writable. Here, an unrecognised key is an ERROR: the failure mode of
//   forgetting to update this file is "the new column cannot be written",
//   never "the new column can be written by anyone".
//
// THE THREE THINGS THIS MODULE MAY NEVER DO -- and how each is prevented
// STRUCTURALLY rather than by care:
//
//   1. NEVER DELETE. There is no delete operation. OPS has two entries, the
//      writer emits INSERT and UPDATE only, and a test asserts no DELETE /
//      TRUNCATE / DROP text exists in either source file. Retired regulars are
//      set inactive BY A HUMAN, never removed -- and see (2).
//
//   2. NEVER set active = false as a side effect. `active` is NOT on the
//      enrich allowlist, so an enrich cannot reach it at all. Retiring an item
//      is a deliberate human act, not something a shop's learning may do while
//      recording a URL. An enrich naming `active` is refused with that reason.
//
//   3. NEVER touch `name` or `household_id` on an existing row. Also absent
//      from the allowlist. They are the row's IDENTITY: the planner matches on
//      `name`, and `household_id` is the boundary that stops one household's
//      preferences leaking into another's basket. Renaming a regular in place
//      would silently repoint every past reference to it. If the household
//      calls it something else, that is an ALIAS -- which is exactly what
//      `aka` is for.
//
// `aka` MERGES, IT NEVER CLOBBERS:
//   `asdair.regulars.aka` is `text[] not null default '{}'::text[]` (see
//   db/004_asdair_regulars.sql; confirmed against live rows, which hold real
//   arrays like ["arla 4pt milk","arla 4pt","milk"] and empty arrays, never
//   NULL). It is the accumulated memory of every way the household has ever
//   written an item down. Replacing it would DESTROY prior learning -- the
//   precise failure this module exists to end -- so:
//
//     * a caller may NOT pass `aka` directly. That is refused. The only way
//       to change aliases is `add_aka`, which can only ever ADD.
//     * the merged array always begins with the existing entries, in their
//       existing order, unchanged. New aliases append. This is structural:
//       existing entries are pushed first and nothing removes them.
//     * de-duplication is case-insensitive, matching how the read path
//       compares (planner.js normaliseTerm).
//
//   ALIAS NORMALISATION -- lower-case, trimmed, whitespace collapsed. This
//   MATCHES services/asdair/skill/planner.js normaliseTerm(), which is what
//   the read path applies to every alias before comparing. Storing "Arla 4pt"
//   would work (the reader lowercases it too), but storing it normalised means
//   the stored form is the compared form -- so "Arla 4pt" and "arla  4pt"
//   cannot both accumulate as separate aliases for the same thing. That folder
//   is read-only by contract and is NOT modified; this only matches its
//   expectation.
//
// `updated_at` IS ON THE ALLOWLIST BUT IS NEVER A CALLER VALUE:
//   The writer always sets it to the SQL literal now(), exactly as
//   recordShopOutcome pins checked_out to a literal. A caller-supplied
//   updated_at is REFUSED: back-dating the audit trail of when a row was last
//   learned about is not a thing this path may do, and this module has no
//   clock of its own to invent one with.
//
// PURE ASCII only.
// =====================================================================

'use strict';

// The two operations. There is no third, and in particular there is no
// delete, no deactivate and no rename.
const OPS = ['upsertRegular', 'enrichRegular'];

// The EXACT column list updateRegulars.js INSERTs for a new regular. One
// exported constant, the same single-source-of-truth discipline as
// ORDER_COLUMNS; schemaCompatIntake.test.js asserts each really exists on
// asdair.regulars in db/004_asdair_regulars.sql.
//
// `created_at` / `updated_at` are ABSENT: this module has no clock, so the
// column defaults record the real times.
const REGULAR_INSERT_COLUMNS = [
  'household_id',
  'high_level_category',
  'category',
  'name',
  'brand',
  'asda_product_id',
  'asda_url',
  'typical_qty',
  'source',
  'active',
  'aka',
  'substitutes_allowed'
];

// THE STRICT ALLOWLIST. Nothing outside this list may EVER be updated on an
// existing regular. Order is the order the SET clause is emitted in, so the
// generated SQL is deterministic and diffable.
const ENRICH_ALLOWED_COLUMNS = [
  'asda_product_id',
  'asda_url',
  'aka',
  'brand',
  'substitutes_allowed',
  'typical_qty',
  'updated_at'
];

// Allowlisted, but owned by the WRITER as a SQL literal -- never a bound
// parameter and never a caller value. (See the header note on updated_at.)
const ENRICH_WRITER_OWNED = ['updated_at'];

// Named explicitly so the refusal explains WHY, rather than just "not
// allowed". These are the columns whose accidental update is the actual
// hazard this allowlist exists to prevent.
const FORBIDDEN_REASONS = {
  active: "'active' is never changed by a learning write: retiring a regular is a deliberate human act, " +
    'not a side effect of recording a product id (and a regular is never deleted, only deactivated by a human)',
  name: "'name' is the row's identity and what the planner matches on: renaming in place would silently " +
    'repoint every past reference. If the household calls it something else, add an ALIAS via add_aka',
  household_id: "'household_id' is the boundary that stops one household's preferences reaching another's " +
    'basket, and is never reassigned by a learning write',
  id: "'id' is the primary key and is never updated",
  source: "'source' is part of the UNIQUE (household_id, source, name) identity and is never updated",
  created_at: "'created_at' is the immutable record of when the regular was first learned",
  high_level_category: "'high_level_category' is catalogue structure, not shop learning; change it deliberately, " +
    'not as a side effect of a shop',
  category: "'category' is catalogue structure, not shop learning; change it deliberately, not as a side " +
    'effect of a shop'
};

// ---------------------------------------------------------------------
// Small pure helpers (same shapes as buildOutcome.js / promoteDecision.js)
// ---------------------------------------------------------------------

function fail(message) {
  throw new Error('buildRegularsUpdate: ' + message);
}

function requireId(value, name) {
  if (value === null || value === undefined || value === '') fail(name + ' is required');
  const s = String(value).trim();
  if (!/^\d+$/.test(s) || s === '0') fail(name + ' must be a positive integer id (got "' + s + '")');
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

function requireText(value, name) {
  if (value === null || value === undefined) fail(name + ' is required');
  const s = String(value).trim();
  if (s === '') fail(name + ' must be a non-empty string');
  return s;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function strictBoolean(value, name, fallback) {
  if (value === null || value === undefined) return fallback;
  if (value !== true && value !== false) {
    fail(name + ' must be exactly true or false when given (got "' + String(value) + '")');
  }
  return value;
}

function optionalQty(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    fail(name + ' must be a positive integer item count when given (got "' + String(value) + '")');
  }
  return n;
}

// ---------------------------------------------------------------------
// normaliseAlias -- MUST match services/asdair/skill/planner.js
// normaliseTerm(): trim, lower-case, collapse internal whitespace. Duplicated
// rather than imported because outcome/ is its own package and must not
// depend on the read-only skill folder (the same reason schemaCompat.test.js
// duplicates the migration parser). The test file pins this behaviour so a
// drift from the read path is caught.
// ---------------------------------------------------------------------
function normaliseAlias(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------
// mergeAka(existing, additions, selfName) -> text[] as a JS array
//
// UNION, DE-DUPLICATED, ORDER-PRESERVING, MERGE-ONLY.
//
//   * `existing` is pushed FIRST, in order, unfiltered. Nothing in this
//     function can drop an existing alias, so the result is always a superset
//     of what was already stored. That is the no-clobber guarantee, and it is
//     structural rather than a rule someone has to remember.
//   * `additions` append in the order given, skipping anything already present
//     (case-insensitively) and anything empty.
//   * `selfName`, when given, blocks an ADDITION equal to the regular's own
//     name -- an item is not an alias of itself. It never removes an existing
//     entry, even one equal to the name: this function does not edit history.
//   * NULL and [] both mean "no aliases yet" (the live column is NOT NULL
//     defaulting to '{}', but a defensive null read is treated the same).
// ---------------------------------------------------------------------
function mergeAka(existing, additions, selfName) {
  const out = [];
  const seen = Object.create(null);

  function push(raw) {
    const s = normaliseAlias(raw);
    if (s === '') return;
    if (seen[s] === true) return;
    seen[s] = true;
    out.push(s);
  }

  // Existing first: order preserved, never dropped.
  (Array.isArray(existing) ? existing : []).forEach(push);

  // Block the item's own name from being ADDED as an alias of itself. Done
  // after the existing pass, so an existing entry equal to the name survives.
  const self = normaliseAlias(selfName);
  if (self !== '') seen[self] = true;

  (Array.isArray(additions) ? additions : []).forEach(push);

  return out;
}

// Validate an add_aka payload purely (before anything is read from the DB).
function requireAliasList(value, name) {
  if (!Array.isArray(value)) fail(name + ' must be an array of alias strings');
  if (value.length === 0) fail(name + ' must not be empty when given');
  value.forEach(function (a, i) {
    if (a === null || a === undefined || typeof a === 'object') {
      fail(name + '[' + i + '] must be a string alias');
    }
    if (normaliseAlias(a) === '') fail(name + '[' + i + '] must be a non-empty alias');
  });
  return value;
}

// ---------------------------------------------------------------------
// buildRegularsUpdate(operation) -> built
//
// upsertRegular ->
//   { op, table, columns, row, conflict_target }
//
// enrichRegular ->
//   { op, table, id, set, add_aka, requires_existing_aka }
//   `set` contains ONLY allowlisted, caller-supplied columns. When add_aka is
//   present, `set.aka` is NOT yet populated and requires_existing_aka is true:
//   the merge cannot be done without knowing what is already stored, so it is
//   completed by applyAkaMerge() once the writer has READ the row -- the same
//   pure-then-verified-then-pure shape as promoteDecision's applySourceVerdict.
//   This is what makes "never clobber" impossible to bypass: no code path
//   produces an `aka` value from caller input alone.
// ---------------------------------------------------------------------
function buildRegularsUpdate(operation) {
  const o = operation || {};
  const op = optionalText(o.op);
  if (op === null) fail('op is required (one of: ' + OPS.join(', ') + ')');
  if (OPS.indexOf(op) === -1) {
    fail('op "' + op + '" is not one of: ' + OPS.join(', ') +
      '. There is deliberately no delete, no deactivate and no rename operation.');
  }

  if (op === 'upsertRegular') return buildUpsert(o);
  return buildEnrich(o);
}

function buildUpsert(o) {
  const r = o.regular;
  if (!r || typeof r !== 'object') fail('upsertRegular requires a `regular` object');

  const name = requireText(r.name, 'regular.name');

  const row = {
    household_id: requireId(r.household_id, 'regular.household_id'),
    high_level_category: optionalText(r.high_level_category),
    category: optionalText(r.category),
    name: name,
    brand: optionalText(r.brand),
    asda_product_id: optionalText(r.asda_product_id),
    asda_url: optionalText(r.asda_url),
    typical_qty: optionalQty(r.typical_qty, 'regular.typical_qty'),
    // Part of the UNIQUE (household_id, source, name) identity; the column
    // default is 'regular'.
    source: r.source === null || r.source === undefined || String(r.source).trim() === ''
      ? 'regular'
      : String(r.source).trim(),
    // A newly-learned regular is live by definition. An explicit false is
    // honoured (creating a row already retired is a legitimate, if odd,
    // catalogue act) but it can never happen by omission.
    active: strictBoolean(r.active, 'regular.active', true),
    // On a CREATE there is nothing to clobber, so an alias list may be given
    // directly -- normalised and de-duplicated by the same merge used
    // everywhere else, with the item's own name filtered out.
    aka: mergeAka([], r.aka === null || r.aka === undefined ? [] : requireAliasList(r.aka, 'regular.aka'), name),
    substitutes_allowed: strictBoolean(r.substitutes_allowed, 'regular.substitutes_allowed', false)
  };

  return {
    op: 'upsertRegular',
    table: 'asdair.regulars',
    columns: REGULAR_INSERT_COLUMNS,
    row: row,
    // The DEDUPE KEY. The table's UNIQUE (household_id, source, name) is an
    // EXACT, source-scoped match, so "Arla 4pt Milk" and "arla 4pt  milk", or
    // the same item arriving under a different `source`, would both slip past
    // it and create a SECOND regular for one item. Two active regulars
    // answering the same term is precisely what planner.js reports as
    // AMBIGUOUS -> needs_decision, so a duplicate does not merely clutter the
    // catalogue: it breaks resolution for that item and puts it back in front
    // of a human every week.
    //
    // So the writer pre-checks this normalised name across the WHOLE
    // household, in the same normalisation the read path matches with
    // (planner.js normaliseTerm), and adopts the existing row instead of
    // creating a near-twin. That is what makes a re-run safe.
    normalised_name: normaliseAlias(name),
    // Adopt-on-conflict, never overwrite: see the header. This remains as the
    // race backstop under the exact identity the database itself enforces.
    conflict_target: '(household_id, source, name)'
  };
}

function buildEnrich(o) {
  const id = requireId(o.id, 'enrichRegular id');

  const set = o.set;
  if (set !== null && set !== undefined && (typeof set !== 'object' || Array.isArray(set))) {
    fail('enrichRegular `set` must be an object of column -> value');
  }
  const supplied = set ? Object.keys(set) : [];

  // ---- THE ALLOWLIST GATE ---------------------------------------------
  // Checked BEFORE anything else is looked at, so a forbidden column is
  // refused even when the rest of the payload is perfect.
  supplied.forEach(function (col) {
    if (ENRICH_ALLOWED_COLUMNS.indexOf(col) === -1) {
      const why = Object.prototype.hasOwnProperty.call(FORBIDDEN_REASONS, col)
        ? ' -- ' + FORBIDDEN_REASONS[col]
        : '';
      fail('enrichRegular may not update "' + col + '"' + why + '. The allowlist is exactly: ' +
        ENRICH_ALLOWED_COLUMNS.join(', ') + '.');
    }
    if (ENRICH_WRITER_OWNED.indexOf(col) !== -1) {
      fail('enrichRegular may not be given "' + col + '": it is written by the writer as the SQL literal ' +
        'now(), never a caller value, so the audit trail of when a regular was last learned about ' +
        'cannot be back-dated.');
    }
  });

  // `aka` may never be assigned wholesale -- only added to.
  if (supplied.indexOf('aka') !== -1) {
    fail('enrichRegular may not SET "aka" directly: that would replace the accumulated aliases and destroy ' +
      'prior learning. Use add_aka, which can only ever ADD (merged, de-duplicated, order-preserving).');
  }

  const out = {};
  if (Object.prototype.hasOwnProperty.call(set || {}, 'asda_product_id')) {
    out.asda_product_id = optionalText(set.asda_product_id);
  }
  if (Object.prototype.hasOwnProperty.call(set || {}, 'asda_url')) {
    out.asda_url = optionalText(set.asda_url);
  }
  if (Object.prototype.hasOwnProperty.call(set || {}, 'brand')) {
    out.brand = optionalText(set.brand);
  }
  if (Object.prototype.hasOwnProperty.call(set || {}, 'typical_qty')) {
    out.typical_qty = optionalQty(set.typical_qty, 'set.typical_qty');
  }
  if (Object.prototype.hasOwnProperty.call(set || {}, 'substitutes_allowed')) {
    // NOT nullable in the schema, and it is a permission flag -- so it must be
    // an explicit boolean, never a coerced truthy value.
    const v = set.substitutes_allowed;
    if (v !== true && v !== false) {
      fail('set.substitutes_allowed must be exactly true or false (it is a NOT NULL permission flag)');
    }
    out.substitutes_allowed = v;
  }

  const addAka = o.add_aka === null || o.add_aka === undefined
    ? null
    : requireAliasList(o.add_aka, 'add_aka');

  if (Object.keys(out).length === 0 && addAka === null) {
    fail('enrichRegular must change something: give a `set` with at least one of ' +
      ENRICH_ALLOWED_COLUMNS.filter(function (c) { return ENRICH_WRITER_OWNED.indexOf(c) === -1 && c !== 'aka'; }).join(', ') +
      ', and/or add_aka');
  }

  return {
    op: 'enrichRegular',
    table: 'asdair.regulars',
    id: id,
    set: out,
    add_aka: addAka,
    // The merge needs what is ALREADY stored, which only a database read can
    // supply. Until applyAkaMerge runs, `set` carries no aka at all.
    requires_existing_aka: addAka !== null,
    // Filled in by applyAkaMerge: the array the UPDATE's optimistic guard
    // requires the row to still hold. null until then.
    expected_aka: null
  };
}

// ---------------------------------------------------------------------
// applyAkaMerge(built, existingAka, existingName) -> a NEW built
//
// PURE. The ONLY place an `aka` value is ever produced, and it is produced
// from the array READ FROM THE DATABASE unioned with the additions -- never
// from caller input alone. Returns a NEW object; never mutates.
//
// It also records `expected_aka` (exactly what was read), which the writer
// puts in the UPDATE's WHERE clause as an optimistic-concurrency guard: if
// another writer changed the aliases between the read and the write, zero rows
// match and the transaction is rolled back rather than silently discarding
// the other writer's alias.
// ---------------------------------------------------------------------
function applyAkaMerge(built, existingAka, existingName) {
  if (!built || built.op !== 'enrichRegular' || built.requires_existing_aka !== true) return built;

  const existing = Array.isArray(existingAka) ? existingAka : [];
  const merged = mergeAka(existing, built.add_aka, existingName);

  return Object.assign({}, built, {
    set: Object.assign({}, built.set, { aka: merged }),
    requires_existing_aka: false,
    expected_aka: existing
  });
}

module.exports = {
  buildRegularsUpdate: buildRegularsUpdate,
  applyAkaMerge: applyAkaMerge,
  mergeAka: mergeAka,
  normaliseAlias: normaliseAlias,
  // Exported so updateRegulars.js and schemaCompatIntake.test.js share ONE
  // source of truth for the columns and the allowlist.
  OPS: OPS,
  REGULAR_INSERT_COLUMNS: REGULAR_INSERT_COLUMNS,
  ENRICH_ALLOWED_COLUMNS: ENRICH_ALLOWED_COLUMNS,
  ENRICH_WRITER_OWNED: ENRICH_WRITER_OWNED
};
