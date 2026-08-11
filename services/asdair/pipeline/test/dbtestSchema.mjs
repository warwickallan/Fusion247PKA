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

/** Rewrite one committed migration's text so every `asdair.` reference and schema creation targets `schemaName` instead. */
function rewriteForSchema(sql, schemaName) {
  return sql
    .replace(/create schema if not exists asdair;/gi, 'create schema if not exists ' + schemaName + ';')
    .replace(/\basdair\./g, schemaName + '.');
}

/**
 * Apply MIGRATION_FILES, in order, into a throwaway schema on `client`.
 * @param {import('pg').Client} client
 * @param {string} schemaName
 */
export async function applyThrowawaySchema(client, schemaName) {
  for (const file of MIGRATION_FILES) {
    const raw = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
    await client.query(rewriteForSchema(raw, schemaName));
  }
}

/** Drop the throwaway schema (idempotent - safe even if it was never created). */
export async function dropThrowawaySchema(client, schemaName) {
  await client.query('DROP SCHEMA IF EXISTS ' + schemaName + ' CASCADE');
}
