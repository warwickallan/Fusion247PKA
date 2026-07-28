#!/usr/bin/env node
// =====================================================================
// IDEA-012 AsdAIr - update-regulars.js
//
// THE RUNTIME CALLER for the regulars learning writer (SOP-021 step 6).
//
// outcome/README.md names this the HIGHEST-VALUE REMAINING GAP: nothing in the
// system could write asdair.regulars, so "this list name means that product"
// -- a new `aka` alias -- could not be persisted, and every fresh instance
// re-asked the same questions. SOP-021 step 3 requires the opposite: "so the
// same question is never asked twice". Step 6 requires an item missing from
// the catalogue to become "a regulars row, not a note". This file is the
// missing step, committed.
//
// Usage (after a shop, from services/asdair/outcome):
//     node update-regulars.js --file <regulars.json>
//     node update-regulars.js --file <regulars.json> --dry-run
//
// The connection comes ONLY from ASDAIR_WRITE_DB_URL in the environment. It is
// never passed on the command line and never printed.
//
//     node --env-file=<env> update-regulars.js --file regulars.json
//
// INPUT SHAPE
// {
//   "operations": [
//     {
//       "op": "upsertRegular",
//       "regular": {
//         "household_id": 1,
//         "high_level_category": "Chilled",
//         "category": "Dairy",
//         "name": "Arla 4pt Semi Skimmed Milk",
//         "brand": "Arla",
//         "asda_product_id": "1000000000000",
//         "asda_url": "https://groceries.asda.com/product/1000000000000",
//         "typical_qty": 2,
//         "aka": ["arla 4pt", "4pt milk"],
//         "substitutes_allowed": false,
//         "source": "regular",
//         "active": true
//       }
//     },
//     {
//       "op": "enrichRegular",
//       "id": 4,
//       "set": { "asda_product_id": "1000000000000", "brand": "Arla" },
//       "add_aka": ["blue milk", "the blue one"]
//     }
//   ]
// }
//
// TWO OPERATIONS, AND NOTHING ELSE:
//
//   upsertRegular  Create a genuinely-new regular. SAFE TO RE-RUN: if the
//                  household already has a regular by that name (normalised
//                  the way the planner matches -- trimmed, lower-cased,
//                  whitespace-collapsed) the existing row is ADOPTED and
//                  NOTHING is changed. The reported id is the existing one.
//
//   enrichRegular  Update an existing regular by id, on a STRICT allowlist:
//                    asda_product_id, asda_url, aka, brand,
//                    substitutes_allowed, typical_qty, updated_at
//                  Any other column is REFUSED. `aka` cannot be assigned --
//                  only ADDED to, via add_aka, which merges (union,
//                  de-duplicated, order-preserving) with what is already
//                  stored. Prior aliases are never lost.
//
// WHAT THIS TOOL CANNOT DO, BY CONSTRUCTION: delete a regular, retire one
// (set active = false), rename one, or move one to another household. Those
// are deliberate human acts, not side effects of a shop's learning. There is
// no flag that enables them.
//
// EACH OPERATION IS ITS OWN TRANSACTION, for the same reason record-shop.js
// gives each decision one: a single bad entry must not roll back the
// enrichments that already succeeded before it. A failed operation is
// reported per-index and the exit code is 1.
//
// --dry-run validates every operation and prints what WOULD be written,
// opening no connection at all. Run it first. Note that a dry run cannot show
// the final `aka` array: the merge is computed from the aliases READ FROM THE
// DATABASE, precisely so that caller input can never replace them.
// =====================================================================

'use strict';

const fs = require('node:fs');
const { buildRegularsUpdate } = require('./buildRegularsUpdate');
const { updateRegulars, close: closeRegulars } = require('./updateRegulars');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return eq === undefined ? fallback : eq.slice(('--' + name + '=').length);
}
const has = function (name) { return process.argv.indexOf('--' + name) >= 0; };

// What a dry run can honestly report about one operation. It never claims a
// final alias list, because that is not knowable without reading the row.
function describe(built) {
  if (built.op === 'upsertRegular') {
    return {
      op: built.op,
      name: built.row.name,
      household_id: built.row.household_id,
      source: built.row.source,
      normalised_name: built.normalised_name,
      aka: built.row.aka,
      note: 'adopts the existing row instead of creating a duplicate if this household already has a ' +
        'regular with this normalised name'
    };
  }
  return {
    op: built.op,
    id: built.id,
    set: built.set,
    add_aka: built.add_aka,
    note: built.requires_existing_aka
      ? 'the final aka array is merged with the aliases READ from the database at write time; existing ' +
        'aliases are always kept'
      : 'no alias change'
  };
}

async function main() {
  const file = arg('file', null);
  const dryRun = has('dry-run');

  if (!file) {
    console.error('usage: node update-regulars.js --file <regulars.json> [--dry-run]');
    process.exitCode = 2;
    return;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('could not read/parse ' + file + ': ' + e.message);
    process.exitCode = 2;
    return;
  }

  // A bare array, or { operations: [...] }, or a single operation object.
  let operations;
  if (Array.isArray(payload)) operations = payload;
  else if (payload && Array.isArray(payload.operations)) operations = payload.operations;
  else if (payload && payload.op) operations = [payload];
  else operations = null;

  if (!Array.isArray(operations) || operations.length === 0) {
    console.error('the file must carry a non-empty "operations" array (or be one such array, or a single ' +
      'operation object with an "op").');
    process.exitCode = 2;
    return;
  }

  // Validate EVERY operation before opening a connection or writing anything,
  // so a forbidden column in operation 5 is caught before operation 1 is
  // committed.
  const built = operations.map(function (o, i) {
    try {
      return buildRegularsUpdate(o);
    } catch (e) {
      throw new Error('operations[' + i + '] is not writable: ' + e.message);
    }
  });

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      operations: built.map(describe),
      note: 'nothing was written and no connection was opened'
    }, null, 1));
    return;
  }

  const results = [];
  try {
    for (let i = 0; i < operations.length; i++) {
      try {
        const r = await updateRegulars(operations[i]);
        results.push(Object.assign({ index: i }, r));
      } catch (e) {
        results.push({ index: i, op: built[i].op, error: e.message });
      }
    }
  } finally {
    await closeRegulars().catch(function () {});
  }

  const failed = results.filter(function (r) { return r.error; });
  console.log(JSON.stringify({ results: results }, null, 1));
  if (failed.length) {
    console.error(failed.length + ' operation(s) were NOT written - see errors above.');
    process.exitCode = 1;
  }
}

main().catch(function (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exitCode = 1;
});
