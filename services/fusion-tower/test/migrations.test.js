// Static (no-DB) migration guards for the ftw control-plane DDL.
//
// These read the migration SQL as TEXT and assert structural invariants so the
// honest-identity posture cannot silently drift in a future edit — they run under
// the default `node --test` with NO database. They complement the real-Postgres
// behavioural proofs in postgresStore.integration.test.js.
//
// COVERAGE:
//   - 0001 stays immutable in shape (RLS enabled on every table, service_role-only,
//     no anon/authenticated policy, honest seed rows, DO-NOT-WEAKEN block present).
//   - 0002 closes F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL: it drops the
//     vocabulary-only CHECK and adds an EXACT per-principal binding CHECK, and it
//     does NOT weaken RLS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function readMigration(file) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
}

const SQL_0001 = readMigration('0001_wp0_control_plane.sql');
const SQL_0002 = readMigration('0002_wp0_identity_provider_binding.sql');
const norm0002 = SQL_0002.toLowerCase();

// ---------------------------------------------------------------------------
// 0001 immutable-shape guards (unchanged posture — no weakening allowed).
// ---------------------------------------------------------------------------

test('0001 keeps RLS enabled on all four ftw tables', () => {
  for (const t of ['agent_identity', 'governance_run', 'run_turn', 'run_event']) {
    assert.match(SQL_0001, new RegExp(`alter table ftw\\.${t}\\s+enable row level security`, 'i'),
      `RLS must stay enabled on ftw.${t}`);
  }
});

test('0001 grants + policies are service_role-only (no anon/authenticated grant or policy)', () => {
  assert.match(SQL_0001, /grant[\s\S]*?to service_role/i);
  assert.doesNotMatch(SQL_0001, /grant[\s\S]*?to (anon|authenticated)\b/i,
    'anon/authenticated must never receive a grant');
  assert.doesNotMatch(SQL_0001, /create policy[\s\S]*?to (anon|authenticated)\b/i,
    'anon/authenticated must never receive a policy');
});

test('0001 seeds the four honest per-principal pairs', () => {
  for (const [p, prov] of [
    ['larry', 'anthropic-claude-code'],
    ['gpt_codex', 'openai-codex'],
    ['warwick', 'human'],
    ['tower', 'fusion-tower'],
  ]) {
    assert.match(SQL_0001, new RegExp(`'${p}'[\\s\\S]*?'${prov}'`),
      `0001 seed must pair ${p} -> ${prov}`);
  }
});

// ---------------------------------------------------------------------------
// 0002 per-principal binding guards (the fix under review).
// ---------------------------------------------------------------------------

test('0002 references the Codex finding id in its provenance header', () => {
  assert.match(SQL_0002, /F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL/);
});

test('0002 drops the vocabulary-only 0001 CHECK', () => {
  assert.match(norm0002, /drop constraint if exists agent_identity_provider_honest_chk/);
});

test('0002 adds the explicitly-named per-principal binding CHECK', () => {
  assert.match(norm0002, /add constraint agent_identity_provider_binding_chk/);
  assert.match(norm0002, /\bcheck\s*\(/);
});

test('0002 binds EACH principal to its OWN honest provider (all four pairs, exact)', () => {
  const pairs = [
    ['larry', 'anthropic-claude-code'],
    ['gpt_codex', 'openai-codex'],
    ['warwick', 'human'],
    ['tower', 'fusion-tower'],
  ];
  for (const [p, prov] of pairs) {
    // principal = '<p>' AND provider = '<prov>' — the exact honest pair.
    assert.match(
      norm0002,
      new RegExp(`principal\\s*=\\s*'${p}'\\s+and\\s+provider\\s*=\\s*'${prov}'`),
      `binding CHECK must contain the exact pair ${p} = ${prov}`,
    );
  }
});

test('0002 is NOT a drift back to a vocabulary-only CHECK', () => {
  // The old shape was `check (provider in ( ... ))` with no principal binding.
  // The new binding CHECK must reference `principal` — a bare provider-IN list
  // (with no principal predicate) would be a regression to the defective form.
  assert.match(norm0002, /principal\s*=\s*'/,
    'the binding CHECK must predicate on principal, not provider alone');
});

test('0002 does NOT weaken RLS or the honest posture', () => {
  assert.doesNotMatch(norm0002, /disable row level security/,
    '0002 must never disable RLS');
  assert.doesNotMatch(norm0002, /to (anon|authenticated)\b/,
    '0002 must never grant/policy anon or authenticated');
  assert.match(SQL_0002, /DO NOT WEAKEN/,
    '0002 must carry the DO-NOT-WEAKEN security block');
});
