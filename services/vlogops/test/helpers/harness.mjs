// Shared test harness — a real Postgres, a real migration, real rows.
//
// Nothing here fakes the database. There is no in-memory stand-in, because every property
// this Work Order asks about — primary-key dedupe, CHECK constraints, immutability
// triggers, transactional atomicity under an abrupt kill — is a property OF POSTGRES. A
// fake would model the assumption and prove the assumption.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVICE_ROOT = path.dirname(path.dirname(__dirname));
export const DB_DIR = path.join(SERVICE_ROOT, 'db');
export const REPO_ROOT = path.dirname(path.dirname(SERVICE_ROOT));

export const MIGRATION_FILE = '001_vlogops_content_seed.sql';

export function readSql(name) {
  return fs.readFileSync(path.join(DB_DIR, name), 'utf8');
}

/** Every numbered migration in this service's own db/ directory, in numeric order. */
export function migrationFiles() {
  return fs.readdirSync(DB_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)));
}

export function databaseUrl() {
  const url = process.env.VLOGOPS_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'VLOGOPS_DB_URL (or DATABASE_URL) is unset. Run these proofs through ' +
      'test/run-vlogops-tests.mjs, which provisions a disposable cluster.',
    );
  }
  return url;
}

export function newPool() {
  return new pg.Pool({ connectionString: databaseUrl(), max: 4 });
}

/** Apply every migration in order. */
export async function applyMigrations(client) {
  for (const f of migrationFiles()) {
    await client.query(readSql(f));
  }
}

/** Drop this service's namespace and nothing else. */
export async function teardown(client) {
  await client.query(readSql('teardown.sql'));
}

/**
 * A clean `vlogops` namespace: tear down, then apply. Used at the start of each proof file
 * so no file inherits another's rows.
 */
export async function freshSchema(pool) {
  const client = await pool.connect();
  try {
    await teardown(client);
    await applyMigrations(client);
  } finally {
    client.release();
  }
}

/**
 * A structural fingerprint of the namespace: every column of every table with its type and
 * nullability, every constraint, every index, every trigger. Comparing this across a
 * re-apply is what "leaves identical structure" means concretely, rather than "the second
 * apply did not error".
 */
export async function structuralFingerprint(client) {
  const columns = await client.query(`
    select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
     where table_schema = 'vlogops'
     order by table_name, column_name`);

  const constraints = await client.query(`
    select conrelid::regclass::text as rel, conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where connamespace = 'vlogops'::regnamespace
     order by rel, conname`);

  const indexes = await client.query(`
    select tablename, indexname, indexdef
      from pg_indexes
     where schemaname = 'vlogops'
     order by tablename, indexname`);

  const triggers = await client.query(`
    select c.relname as rel, t.tgname, pg_get_triggerdef(t.oid) as def
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relnamespace = 'vlogops'::regnamespace and not t.tgisinternal
     order by rel, tgname`);

  return JSON.stringify({
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    triggers: triggers.rows,
  }, null, 2);
}

/** Config object for the route modules, pointed at the real repository. */
export function testConfig(overrides = {}) {
  return {
    databaseUrl: databaseUrl(),
    repoRoot: REPO_ROOT,
    serviceRoot: SERVICE_ROOT,
    migrationsDir: DB_DIR,
    bundleMaxArtefacts: 12,
    bundleMaxBytes: 2 * 1024 * 1024,
    snapshotMaxInlineBytes: 1 * 1024 * 1024,
    ...overrides,
  };
}
