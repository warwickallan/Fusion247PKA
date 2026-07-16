// Static migration-correctness verification (Sonnet review fix, area D).
//
// These SQL files are ARTIFACTS — not executed by the WP0 test suite (no real
// Postgres in fixtures). But 0002 drops-and-recreates foreign-key constraints
// BY NAME, and before this fix those names were only implicitly correct
// (Postgres's undeclared default-naming convention). This test statically
// parses both files as text and proves the contract holds WITHOUT needing a
// live database: every constraint 0002 drops is explicitly DECLARED in 0001,
// and every constraint 0002 re-adds keeps the SAME name (a rename, not a
// silent drift). A future edit that breaks this contract fails CI here,
// long before anyone applies these migrations against a real project.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const sql0001 = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_wp0_operational_baseline.sql'), 'utf8');
const sql0002 = fs.readFileSync(path.join(MIGRATIONS_DIR, '0002_wp0_deletion_and_retention.sql'), 'utf8');

function extractAll(sql, regex) {
  const names = [];
  let m;
  const re = new RegExp(regex, 'gi');
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(sql)) !== null) names.push(m[1]);
  return names;
}

test('0001 explicitly declares constraint names (no reliance on implicit Postgres defaults)', () => {
  const declared = extractAll(sql0001, 'constraint\\s+(\\w+)\\b');
  // The four FKs 0002 manipulates, at minimum.
  for (const name of [
    'capture_envelope_raw_object_ref_fkey',
    'idempotency_key_capture_id_fkey',
    'processing_state_capture_id_fkey',
    'evidence_pointer_capture_id_fkey',
  ]) {
    assert.ok(declared.includes(name), `0001 must explicitly declare constraint "${name}"`);
  }
});

test('every constraint 0002 DROPS is one 0001 explicitly DECLARED', () => {
  const declaredIn0001 = new Set(extractAll(sql0001, 'constraint\\s+(\\w+)\\b'));
  const droppedIn0002 = extractAll(sql0002, 'drop\\s+constraint\\s+(\\w+)\\b');

  assert.ok(droppedIn0002.length > 0, 'sanity: 0002 does drop at least one constraint');
  for (const name of droppedIn0002) {
    assert.ok(
      declaredIn0001.has(name),
      `0002 drops constraint "${name}" which 0001 never explicitly declares — `
        + 'this would silently rely on Postgres\'s implicit default naming.',
    );
  }
});

test('every constraint 0002 DROPS is re-ADDED under the exact same name (rename-safe, not silently renamed)', () => {
  const dropped = extractAll(sql0002, 'drop\\s+constraint\\s+(\\w+)\\b');
  const added = extractAll(sql0002, 'add\\s+constraint\\s+(\\w+)\\b');
  assert.deepEqual(
    [...dropped].sort(),
    [...added].sort(),
    '0002 must re-add every constraint it drops under the identical declared name',
  );
});

test('0001 never gives a CREATE TYPE the same name as a CREATE TABLE (implicit composite-type collision, 42710)', () => {
  // Every Postgres table implicitly registers a composite type of the same name
  // in the same schema. A `create type fcg.x` + `create table fcg.x` pair fails
  // with 42710 at live apply — invisible to the fixtures-only suite. Caught here.
  // Strip `--` comments first: the 0001 header narrates the original collision.
  const sql0001NoComments = sql0001.replace(/--[^\n]*/g, '');
  const types = extractAll(sql0001NoComments, 'create\\s+type\\s+(fcg\\.\\w+)');
  const tables = new Set(extractAll(sql0001NoComments, 'create\\s+table\\s+(fcg\\.\\w+)'));
  assert.ok(types.length > 0, 'sanity: 0001 creates at least one type');
  for (const typeName of types) {
    assert.ok(
      !tables.has(typeName),
      `0001 creates both a type and a table named "${typeName}" — collides with the table's implicit composite type (42710)`,
    );
  }
});

test('0001 enables row-level security on every table it creates (security gate — DO NOT WEAKEN)', () => {
  const tables = extractAll(sql0001, 'create\\s+table\\s+(fcg\\.\\w+)');
  const rlsEnabled = new Set(extractAll(sql0001, 'alter\\s+table\\s+(fcg\\.\\w+)\\s+enable\\s+row\\s+level\\s+security'));
  assert.ok(tables.length > 0, 'sanity: 0001 creates at least one table');
  for (const table of tables) {
    assert.ok(rlsEnabled.has(table), `RLS must be enabled on ${table} (security gate — DO NOT WEAKEN)`);
  }
});

test('0002 does not add a permissive RLS policy or disable RLS (security gate — DO NOT WEAKEN)', () => {
  assert.doesNotMatch(sql0002, /create\s+policy/i, '0002 must not add a permissive policy');
  assert.doesNotMatch(sql0002, /disable\s+row\s+level\s+security/i, '0002 must not disable RLS');
});
