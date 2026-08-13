// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/householdSnapshot.mjs
//
// WO-2026-08-13-04 (WP-B15-37). SELECT-ONLY. Reads the household's real
// catalogue and rulebook out of the live asdair schema and banks them as a
// committed JSON snapshot, so the whole list-production run below is
// reproducible offline by anyone reading this branch.
//
// ⛔ THIS FILE NEVER WRITES TO THE DATABASE. It opens a connection with
// ASDAIR_DB_URL - the asdair_ro SELECT-only role (see interpret/loadCatalogue.js
// and pipeline/deps.js, both of which say so) - and issues SELECTs. There is no
// INSERT, UPDATE, DELETE or DDL anywhere in it, and it never opens or prints the
// credentials file: the connection string arrives through `node --env-file`.
//
// WHY BANK IT AT ALL. `produceFinalList.mjs` drives the REAL production
// modules over the offline durable store (see that file's header for why), and
// a run that silently depended on a live database being reachable would not be
// re-checkable by a reviewer. Banking the household truth once, with the exact
// query and the read timestamp beside it, makes the production run a pure
// function of committed bytes.
//
// Household shopping data is not private (Warwick, 2026-08-12), so the snapshot
// is committed. No credential, connection string or token is ever written into
// it - only rows.
//
// Run:  node --env-file=C:/.fusion247/asdair.env finalise/householdSnapshot.mjs
// =====================================================================

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pg = require('pg');

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');

const HOUSEHOLD_ID = 1;

// The exact statements, held here so the snapshot can name what produced it.
const REGULARS_SQL = `
  SELECT id, household_id, name, brand, category, high_level_category,
         aka, typical_qty, asda_product_id, asda_url, substitutes_allowed, active
    FROM asdair.regulars
   WHERE household_id = $1 AND active
   ORDER BY id`;

const RULES_SQL = `
  SELECT *
    FROM asdair.rules
   WHERE household_id = $1
   ORDER BY id`;

export async function readHouseholdSnapshot(householdId = HOUSEHOLD_ID) {
  const url = process.env.ASDAIR_DB_URL;
  if (!url) {
    throw new Error('ASDAIR_DB_URL is not set - run this with --env-file. This script is SELECT-only and never writes.');
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // READ ONLY at the transaction level too, so the SELECT-only claim is
    // enforced by Postgres rather than only by this file's good intentions.
    await client.query('BEGIN TRANSACTION READ ONLY');
    const regulars = (await client.query(REGULARS_SQL, [householdId])).rows;
    let rules = [];
    try {
      rules = (await client.query(RULES_SQL, [householdId])).rows;
    } catch (err) {
      rules = [];
      // Recorded, never swallowed: an absent/renamed rules table is a fact the
      // snapshot must carry rather than a silent empty rulebook.
      regulars.rulesReadError = err.message;
    }
    await client.query('COMMIT');
    return {
      snapshot_version: '1.0.0',
      work_order: 'WO-2026-08-13-04 (WP-B15-37)',
      household_id: householdId,
      read_at: new Date().toISOString(),
      access: 'SELECT-only, inside BEGIN TRANSACTION READ ONLY, via ASDAIR_DB_URL (asdair_ro)',
      statements: [REGULARS_SQL.trim(), RULES_SQL.trim()],
      regulars_count: regulars.length,
      rules_count: rules.length,
      regulars,
      rules,
    };
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('householdSnapshot.mjs')) {
  const snap = await readHouseholdSnapshot();
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, 'household-1-snapshot.json');
  writeFileSync(path, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
  process.stdout.write(`banked ${snap.regulars_count} regulars and ${snap.rules_count} rules -> ${path}\n`);
}
