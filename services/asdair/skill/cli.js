// =====================================================================
// IDEA-012 AsdAIr - WP1 skill: cli.js
//
// Wires the read-only adapter (data.js) to the pure planner (planner.js)
// and prints a human-readable basket plan followed by the raw JSON.
//
// Usage:
//   node cli.js --list-date 2026-07-13 --household household-a
//
// Requires the connection string in the environment:
//   ASDAIR_DB_URL=postgres://...   (never passed on the command line)
//
// This CLI is READ-ONLY: it loads via SELECT, plans in memory, and prints.
// It NEVER writes to the database and NEVER checks out a basket.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const data = require('./data');
const { planBasket } = require('./planner');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list-date') { out.listDate = argv[++i]; }
    else if (a === '--household') { out.household = argv[++i]; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function usage() {
  console.log('Usage: node cli.js --list-date <YYYY-MM-DD> --household <name>');
  console.log('Requires ASDAIR_DB_URL in the environment (read-only connection).');
}

function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function printPlan(plan, ctx) {
  const s = plan.summary;
  console.log('');
  console.log('AsdAIr basket plan');
  console.log('  household : ' + ctx.household);
  console.log('  list date : ' + ctx.listDate);
  console.log('  NOTE      : plan only - nothing is ordered, nothing is substituted.');
  console.log('');
  console.log('  ' + pad('STATUS', 16) + pad('QTY', 5) + pad('ITEM', 28) + 'MATCHED PRODUCT');
  console.log('  ' + '-'.repeat(78));
  plan.items.forEach(function (it) {
    console.log('  ' +
      pad(it.status, 16) +
      pad(it.planned_qty + '/' + it.requested_qty, 5) +
      pad(it.item_name, 28) +
      (it.matched_product || '(none - find in Favourites/Regulars)'));
    if (it.flags && it.flags.length > 0) {
      console.log('  ' + pad('', 16) + 'flags: ' + it.flags.join(', '));
    }
    if (it.note) {
      console.log('  ' + pad('', 16) + 'note : ' + it.note);
    }
  });
  console.log('');
  console.log('  summary:');
  console.log('    items requested : ' + s.total_requested);
  console.log('    planned add     : ' + s.planned_add);
  console.log('    needs decision  : ' + s.needs_decision);
  console.log('    excluded        : ' + s.excluded);
  console.log('    estimated total : ' + (s.estimated_total === null ? '(unknown - prices missing)' : s.estimated_total + ' ' + s.currency));
  console.log('    budget flag     : ' + s.budget_flag);
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.listDate || !args.household) {
    usage();
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  try {
    const listBundle = await data.loadList(args.listDate, args.household);
    const rules = await data.loadRules();
    const products = await data.loadProducts();
    const budget = await data.loadBudget(args.household);

    const plan = planBasket({
      listItems: listBundle.listItems,
      rules: rules,
      products: products,
      budget: budget,
      household: listBundle.household_id
    });

    printPlan(plan, { household: args.household, listDate: args.listDate });

    console.log('JSON:');
    console.log(JSON.stringify(plan, null, 2));
  } catch (err) {
    console.error('ERROR: ' + err.message);
    process.exitCode = 1;
  } finally {
    await data.close();
  }
}

main();
