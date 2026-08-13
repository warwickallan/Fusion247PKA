// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/dbtestSchema.mjs
//
// WO-2026-08-11-B15-VISION-01. Shared throwaway-SCHEMA DDL applier for this
// Work Order's DB-gated proofs. Ports the exact pattern already proven in
// services/asdair/skill/test/constraints.dbtest.js's buildTestDdl(): rewrite
// the COMMITTED migration files so every object lands in one throwaway
// schema, never the real `asdair` schema, then apply them in the order
// migration 020's own header states its dependencies (001, 004, 006, 008,
// then 020 itself).
//
// NEVER touches the real `asdair` schema. NEVER reads outside
// services/asdair/db/** (this Work Order's own declared surface).
// =====================================================================

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', '..', 'db');

// Migration 020's own stated dependency chain
// (services/asdair/db/020_shop_line_provenance_and_human_state.sql header:
// "Depends on: 001 (asdair.shopping_list_items), 004 (asdair.regulars),
// 006 (asdair.shop), 008 (asdair.shop_line)"), applied in that order, then
// 020 itself. 016/017/018/019 are DELIBERATELY not applied - 020's own
// header states it depends on none of them.
export const MIGRATION_FILES = [
  '001_asdair_schema.sql',
  '004_asdair_regulars.sql',
  '006_shop_control_surface.sql',
  '008_shop_line_interpretation.sql',
  '020_shop_line_provenance_and_human_state.sql',
];

/**
 * A short, deterministic, collision-safe prefix for one throwaway schema's
 * constraint names. Short because Postgres identifiers cap at 63 characters and
 * these migrations' constraint names are already long.
 */
function constraintPrefix(schemaName) {
  return 't' + createHash('sha1').update(schemaName).digest('hex').slice(0, 8) + '_';
}

/**
 * Rewrite one committed migration's text so every `asdair.` reference and schema
 * creation targets `schemaName` instead.
 *
 * ── WHY CONSTRAINT NAMES ARE REWRITTEN TOO (WO-2026-08-13-10, WP-B15-40) ────
 * Migration 020 guards its composite foreign keys with
 *
 *     if not exists (select 1 from pg_constraint where conname = '<name>') then
 *
 * `pg_constraint.conname` IS NOT GLOBALLY UNIQUE in Postgres - it is unique per
 * table - but that lookup is not qualified by schema or table. So once the REAL
 * `asdair` schema exists in the same database, the guard finds ITS constraint
 * and SILENTLY SKIPS creating the constraint in the throwaway schema. No error,
 * no warning: the throwaway table simply comes up without the composite foreign
 * keys that are the entire anti-hallucination guarantee, and every proof that
 * depends on them stops being able to bite.
 *
 * This was invisible until 2026-08-13, because until then no disposable
 * Postgres in this estate had ever had a real `asdair` schema beside a
 * throwaway one. The defect is in `services/asdair/db/020_*.sql`, which is
 * OUTSIDE WP-B15-40's file surface and is REPORTED, not fixed, in its return.
 *
 * Namespacing the constraint names here is this harness doing the job its own
 * header already claims - "rewrite the COMMITTED migration files so every
 * object lands in one throwaway schema". A constraint is an object. The
 * distinguishing suffix is preserved, so a test asserting on
 * `err.constraint` still matches it as a substring.
 */
function rewriteForSchema(sql, schemaName) {
  const prefix = constraintPrefix(schemaName);
  return sql
    .replace(/create schema if not exists asdair;/gi, 'create schema if not exists ' + schemaName + ';')
    .replace(/\basdair\./g, schemaName + '.')
    .replace(/\bconname\s*=\s*'([a-z0-9_]+)'/gi, (_m, name) => `conname = '${prefix}${name}'`)
    .replace(/\badd\s+constraint\s+([a-z0-9_]+)/gi, (_m, name) => `add constraint ${prefix}${name}`);
}

/**
 * Apply MIGRATION_FILES, in order, into a throwaway schema on `client`.
 *
 * @param {import('pg').Client} client
 * @param {string} schemaName
 * @param {{transform?: (sql:string, file:string) => string}} [opts]
 *   `transform` is applied to each migration's text AFTER the schema rewrite.
 *
 *   WO-2026-08-13-10 (WP-B15-40) added it for ONE purpose: a MUTATION PROOF
 *   that removes a named constraint from the REAL committed migration and shows
 *   the guarded insert then succeeds - which is what turns "the database refuses
 *   this" from an assertion into evidence. Mutating the real migration text is
 *   the point; a hand-written copy of the DDL would prove only that a copy
 *   behaves as its author expected.
 *
 *   It is NOT a general schema-shaping hook. Every ordinary caller omits it and
 *   gets the committed migrations verbatim.
 */
export async function applyThrowawaySchema(client, schemaName, opts = {}) {
  const transform = typeof opts.transform === 'function' ? opts.transform : null;
  for (const file of MIGRATION_FILES) {
    const raw = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
    const rewritten = rewriteForSchema(raw, schemaName);
    await client.query(transform ? transform(rewritten, file) : rewritten);
  }
}

/** Drop the throwaway schema (idempotent - safe even if it was never created). */
export async function dropThrowawaySchema(client, schemaName) {
  await client.query('DROP SCHEMA IF EXISTS ' + schemaName + ' CASCADE');
}
