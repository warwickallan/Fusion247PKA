// Dump the household catalogue to committed test fixtures.
//
// WHY THIS EXISTS: the 109 regulars, their aliases and the 40+ shopping rules lived ONLY in
// Supabase, so no test could prove the matcher consults them, and no worker without database
// credentials could work on the intake path at all. That is why a conditioner matched a shampoo
// and ten lines went unresolved on clean text with nobody able to reproduce it offline.
//
// This data is NOT private. Warwick has ruled it three times: shopping content is public and
// belongs in the repo. Only SECRETS stay out, and none are written here.
//
//   node --env-file=<approved env> dump-household-catalogue.mjs
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.ASDAIR_DB_URL || process.env.DATABASE_URL;
if (!url) { console.error('no database URL in environment'); process.exit(78); }

const here = import.meta.dirname;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const write = (name, rows, note) => {
  const file = path.join(here, name);
  fs.writeFileSync(file, `${JSON.stringify({ _note: note, captured_from: 'asdair (household 1)', rows }, null, 2)}\n`);
  console.log(`${name}: ${rows.length} rows`);
};

const regulars = (await client.query(`
  select id, name, display_name, brand, category, aka, typical_qty, asda_product_id, active
    from asdair.regulars where household_id = 1 and active order by id`)).rows;

const rules = (await client.query(`
  select id, category, rule_text, directive, active
    from asdair.rules where household_id = 1 and active order by id`)).rows;

write('household-regulars.json', regulars,
  'The household catalogue. The ASDA product NAME is the identity; asda_product_id is an optimisation and is null for many rows. A line must be buyable without one.');
write('household-rules.json', rules,
  'Active shopping rules. The runtime must OBEY these, not merely be able to read them. Rule 34 mandates trolley reconciliation; rule 40 mandates the Favourites/Regulars Brand A-Z pass; rule 33 maps Fruit Splits to ice lollies.');

const missing = regulars.filter((r) => !r.asda_product_id).length;
console.log(`\nregulars without an asda_product_id: ${missing} of ${regulars.length} — this must never block a purchase`);
await client.end();
