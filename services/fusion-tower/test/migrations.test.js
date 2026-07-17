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
const SQL_0003 = readMigration('0003_wp0_external_write_outbox.sql');
const norm0002 = SQL_0002.toLowerCase();
const norm0003 = SQL_0003.toLowerCase();

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

// ---------------------------------------------------------------------------
// 0003 external-write outbox guards (GPT MEDIUM-1 — the durable idempotency fix).
// ---------------------------------------------------------------------------

test('0003 references the GPT MEDIUM-1 finding in its provenance header', () => {
  assert.match(SQL_0003, /GPT MEDIUM-1/);
});

test('0003 adds the ftw.write_state enum WITHOUT colliding with a table name', () => {
  assert.match(norm0003, /create type ftw\.write_state as enum/);
  // Enum-vs-table collision rule: no table may be named write_state.
  assert.doesNotMatch(norm0003, /create table (if not exists )?ftw\.write_state\b/,
    'no table may share the write_state enum name');
});

test('0003 enum carries all five write states', () => {
  for (const s of ['applying', 'applied_verified', 'outcome_unknown', 'retry_pending', 'failed']) {
    assert.match(norm0003, new RegExp(`'${s}'`), `write_state enum must include ${s}`);
  }
});

test('0003 creates the external_write outbox table', () => {
  assert.match(norm0003, /create table if not exists ftw\.external_write/);
});

test('0003 declares mutation_key UNIQUE with an explicit constraint name (the idempotency key)', () => {
  assert.match(norm0003, /constraint external_write_mutation_key_key unique/);
});

test('0003 declares mutation_id UNIQUE with an explicit constraint name', () => {
  assert.match(norm0003, /constraint external_write_mutation_id_key unique/);
});

test('0003 enforces applied_verified REQUIRES response_id via an explicitly-named CHECK', () => {
  assert.match(norm0003, /constraint external_write_applied_requires_response_chk/);
  // The CHECK must be: state <> 'applied_verified' OR response_id is not null.
  assert.match(
    norm0003,
    /check\s*\(\s*state\s*<>\s*'applied_verified'\s+or\s+response_id\s+is\s+not\s+null\s*\)/,
    'the CHECK must block applied_verified without a response_id',
  );
});

test('0003 has an attempt_count >= 0 CHECK', () => {
  assert.match(norm0003, /constraint external_write_attempt_count_nonneg_chk check \(attempt_count >= 0\)/);
});

test('0003 keeps RLS enabled on external_write', () => {
  assert.match(SQL_0003, /alter table ftw\.external_write\s+enable row level security/i);
});

test('0003 grants + policy are service_role-only (no anon/authenticated grant or policy)', () => {
  assert.match(norm0003, /grant[\s\S]*?to service_role/);
  assert.match(norm0003, /create policy service_role_all_external_write/);
  assert.doesNotMatch(norm0003, /grant[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a grant');
  assert.doesNotMatch(norm0003, /create policy[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a policy');
});

test('0003 does NOT weaken RLS and carries the DO-NOT-WEAKEN block', () => {
  assert.doesNotMatch(norm0003, /disable row level security/,
    '0003 must never disable RLS');
  assert.match(SQL_0003, /DO NOT WEAKEN/,
    '0003 must carry the DO-NOT-WEAKEN security block');
});

// ---------------------------------------------------------------------------
// 0001 / 0002 immutability: the earlier migrations are part of the WP0 proof
// history. 0003 is a pure delta and must NOT have edited their shape.
// ---------------------------------------------------------------------------

test('0001 remains immutable-shape (four tables created, circular FK resolved)', () => {
  for (const t of ['agent_identity', 'governance_run', 'run_turn', 'run_event']) {
    assert.match(SQL_0001, new RegExp(`create table ftw\\.${t}\\b`, 'i'),
      `0001 must still create ftw.${t}`);
  }
  assert.match(SQL_0001, /governance_run_current_turn_fkey/,
    '0001 must still resolve the circular current_turn FK');
});

test('0002 remains immutable-shape (drops vocab CHECK, adds the per-principal binding CHECK)', () => {
  assert.match(norm0002, /drop constraint if exists agent_identity_provider_honest_chk/);
  assert.match(norm0002, /add constraint agent_identity_provider_binding_chk/);
});
