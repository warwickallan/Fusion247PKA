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
const SQL_0004 = readMigration('0004_wp1_notification_outbox.sql');
const SQL_0005 = readMigration('0005_wp1_run_control_state.sql');
const SQL_0006 = readMigration('0006_wp1_notification_cards.sql');
const norm0002 = SQL_0002.toLowerCase();
const norm0003 = SQL_0003.toLowerCase();
const norm0004 = SQL_0004.toLowerCase();
const norm0005 = SQL_0005.toLowerCase();
const norm0006 = SQL_0006.toLowerCase();
// Code-only view of 0006: strip `--` line comments so DO-NOT-WEAKEN prose that names
// merge/rls/policy does not trip the vocabulary / DDL guards below.
const code0006 = norm0006.split('\n').map((line) => line.replace(/--.*$/, '')).join('\n');
// Code-only view of 0005: strip `--` line comments so the DO-NOT-WEAKEN prose that
// legitimately NAMES rls/grant/policy does not trip the DDL-absence guards below.
const code0005 = norm0005.split('\n').map((line) => line.replace(/--.*$/, '')).join('\n');

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
// 0004 notification outbox guards (BUILD-010 WP1 — durable + retry-safe +
// deduplicated Telegram notifications).
// ---------------------------------------------------------------------------

test('0004 references the convergence-brief notification-outbox requirement in its header', () => {
  assert.match(SQL_0004, /durable \+ retry-safe \+ deduplicated/i);
});

test('0004 adds the ftw.notification_state enum WITHOUT colliding with a table name', () => {
  assert.match(norm0004, /create type ftw\.notification_state as enum/);
  // Enum-vs-table collision rule: no table may be named notification_state.
  assert.doesNotMatch(norm0004, /create table (if not exists )?ftw\.notification_state\b/,
    'no table may share the notification_state enum name');
});

test('0004 enum carries all four notification states', () => {
  for (const s of ['pending', 'sent', 'failed', 'superseded']) {
    assert.match(norm0004, new RegExp(`'${s}'`), `notification_state enum must include ${s}`);
  }
});

test('0004 creates the notification_outbox table', () => {
  assert.match(norm0004, /create table if not exists ftw\.notification_outbox/);
});

test('0004 declares dedup_key UNIQUE with an explicit constraint name (the idempotency key)', () => {
  assert.match(norm0004, /constraint notification_outbox_dedup_key_key unique/);
});

test('0004 enforces sent REQUIRES provider_message_id via an explicitly-named CHECK', () => {
  assert.match(norm0004, /constraint notification_outbox_sent_requires_provider_chk/);
  // The CHECK must be: state <> 'sent' OR provider_message_id is not null.
  assert.match(
    norm0004,
    /check\s*\(\s*state\s*<>\s*'sent'\s+or\s+provider_message_id\s+is\s+not\s+null\s*\)/,
    'the CHECK must block sent without a provider_message_id',
  );
});

test('0004 constrains the logical_source vocabulary to TOWER/CODEX/LARRY/CI (message-identity tag)', () => {
  assert.match(norm0004, /constraint notification_outbox_logical_source_chk/);
  for (const s of ['TOWER', 'CODEX', 'LARRY', 'CI']) {
    assert.match(SQL_0004, new RegExp(`'${s}'`), `logical_source CHECK must include ${s}`);
  }
});

test('0004 has a body no-token CHECK (defence-in-depth secret backstop)', () => {
  assert.match(norm0004, /constraint notification_outbox_body_no_token_chk/);
});

test('0004 has an attempt_count >= 0 CHECK', () => {
  assert.match(norm0004, /constraint notification_outbox_attempt_count_nonneg_chk check \(attempt_count >= 0\)/);
});

test('0004 links run_id via an explicit FK with on delete cascade (nullable)', () => {
  assert.match(norm0004, /constraint notification_outbox_run_id_fkey/);
  assert.match(norm0004, /references ftw\.governance_run \(run_id\) on delete cascade/);
});

test('0004 keeps RLS enabled on notification_outbox', () => {
  assert.match(SQL_0004, /alter table ftw\.notification_outbox\s+enable row level security/i);
});

test('0004 grants + policy are service_role-only (no anon/authenticated grant or policy)', () => {
  assert.match(norm0004, /grant[\s\S]*?to service_role/);
  assert.match(norm0004, /create policy service_role_all_notification_outbox/);
  assert.doesNotMatch(norm0004, /grant[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a grant');
  assert.doesNotMatch(norm0004, /create policy[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a policy');
});

test('0004 does NOT weaken RLS and carries the DO-NOT-WEAKEN block', () => {
  assert.doesNotMatch(norm0004, /disable row level security/,
    '0004 must never disable RLS');
  assert.match(SQL_0004, /DO NOT WEAKEN/,
    '0004 must carry the DO-NOT-WEAKEN security block');
});

test('0004 stores POINTERS ONLY — recipient is a chat id, never a token', () => {
  // The recipient column comment must flag it as a chat-id pointer, never a token.
  assert.match(norm0004, /the authorised chat id/);
  // The message-identity tag is deliberately separate from the credential owner.
  assert.match(norm0004, /separate from the telegram credential owner/i);
});

// ---------------------------------------------------------------------------
// 0005 run control-state guards (BUILD-010 WP1 — durable /pause /resume /watch
// /stop state on ftw.governance_run, plus the ftw.watch_level enum).
// ---------------------------------------------------------------------------

test('0005 references the shared convergence/interface contract in its header', () => {
  assert.match(SQL_0005, /CONVERGENCE-fusion-governance-interface\.md/);
});

test('0005 adds the ftw.watch_level enum WITHOUT colliding with a table name', () => {
  assert.match(norm0005, /create type ftw\.watch_level as enum/);
  // Enum-vs-table collision rule: no table may be named watch_level.
  assert.doesNotMatch(norm0005, /create table (if not exists )?ftw\.watch_level\b/,
    'no table may share the watch_level enum name');
});

test('0005 enum carries all three watch levels', () => {
  for (const s of ['all', 'milestones', 'terminal']) {
    assert.match(norm0005, new RegExp(`'${s}'`), `watch_level enum must include ${s}`);
  }
});

test('0005 adds the five control columns to ftw.governance_run (guarded/idempotent)', () => {
  const cols = [
    ['paused', /add column if not exists paused boolean not null default false/],
    ['watch_level', /add column if not exists watch_level ftw\.watch_level not null default 'milestones'/],
    ['paused_at', /add column if not exists paused_at timestamptz/],
    ['stop_requested', /add column if not exists stop_requested boolean not null default false/],
    ['stop_requested_at', /add column if not exists stop_requested_at timestamptz/],
  ];
  for (const [name, re] of cols) {
    assert.match(norm0005, re, `0005 must add ${name} to governance_run guarded by IF NOT EXISTS`);
  }
  // The columns are added to the EXISTING run table — no new table is created.
  assert.match(norm0005, /alter table ftw\.governance_run/);
});

test('0005 creates NO new table (it is a pure ALTER + enum delta)', () => {
  assert.doesNotMatch(norm0005, /create table/,
    '0005 must not create any table — it only ALTERs governance_run and adds an enum');
});

test('0005 leaves RLS UNCHANGED (no RLS/grant/policy/role DDL — prose in the security block aside)', () => {
  // The code (comments stripped) must issue NO RLS/grant/policy DDL. governance_run
  // keeps its 0001 deny-by-default posture; the DO-NOT-WEAKEN comment may name these.
  assert.doesNotMatch(code0005, /row level security/,
    '0005 must not enable/disable RLS in code');
  assert.doesNotMatch(code0005, /create policy/, '0005 must add no policy');
  assert.doesNotMatch(code0005, /\bgrant\b/, '0005 must add no grant');
  assert.doesNotMatch(code0005, /\bto (anon|authenticated)\b/,
    '0005 must never grant/policy anon or authenticated');
  assert.match(SQL_0005, /DO NOT WEAKEN/, '0005 must carry the DO-NOT-WEAKEN security block');
});

test('0005 documents that /stop is a request the LOOP honours at a safe atomic boundary', () => {
  assert.match(norm0005, /atomic boundary/);
  assert.match(norm0005, /outcome_unknown/);
});

// ---------------------------------------------------------------------------
// 0001 / 0002 / 0003 / 0004 immutability: the earlier migrations are part of the
// WP0/WP1 proof history. 0005 is a pure delta and must NOT have edited their shape.
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

test('0003 remains immutable-shape (external_write outbox, per-mutation key, applied-requires-response CHECK)', () => {
  assert.match(norm0003, /create table if not exists ftw\.external_write/);
  assert.match(norm0003, /constraint external_write_mutation_key_key unique/);
  assert.match(norm0003, /constraint external_write_applied_requires_response_chk/);
});

test('0004 remains immutable-shape (notification_outbox, dedup key, sent-requires-provider CHECK)', () => {
  assert.match(norm0004, /create table if not exists ftw\.notification_outbox/);
  assert.match(norm0004, /constraint notification_outbox_dedup_key_key unique/);
  assert.match(norm0004, /constraint notification_outbox_sent_requires_provider_chk/);
  // 0006 must NOT have edited 0004 to add the card column — that belongs in 0006.
  assert.doesNotMatch(norm0004, /reply_markup/, '0004 stays immutable; reply_markup is a 0006 delta');
});

// ---------------------------------------------------------------------------
// 0006 — the HUMAN DECISION GATE delta (OI §4a): notification cards + decision_gate.
// ---------------------------------------------------------------------------

test('0006 references the APPROVED human-decision-gate contract in its header', () => {
  assert.match(SQL_0006, /fusion-tower-operating-instructions\.md/);
  assert.match(norm0006, /§?4a|human decision gate/);
});

test('0006 adds notification_outbox.reply_markup as a nullable jsonb, guarded/idempotent', () => {
  assert.match(norm0006, /alter table ftw\.notification_outbox\s+add column if not exists reply_markup jsonb/);
  // It must NOT be NOT NULL (a plain text notification carries no card).
  assert.doesNotMatch(norm0006, /reply_markup jsonb not null/);
});

test('0006 creates ftw.decision_gate with the gate_token UNIQUE + one-pending-per-run guarantee', () => {
  assert.match(norm0006, /create table if not exists ftw\.decision_gate/);
  assert.match(norm0006, /constraint decision_gate_gate_token_key unique/);
  assert.match(norm0006, /create unique index if not exists decision_gate_one_pending_per_run_idx[\s\S]*?where status = 'pending'/);
  assert.match(norm0006, /references ftw\.governance_run \(run_id\) on delete cascade/);
});

test('0006 decision vocabulary is proceed|hold|stop ONLY — a card is NEVER a merge', () => {
  assert.match(norm0006, /decision in \('proceed','hold','stop'\)/);
  assert.match(norm0006, /allowed_decisions <@ array\['proceed','hold','stop'\]/);
  // No merge/deploy/destructive verb may appear in the gate's EXECUTABLE code. Strip
  // `comment on … ;` statements too (their honest "never a merge" prose is not a path).
  const exec0006 = code0006.replace(/comment on[\s\S]*?;/g, '');
  for (const forbidden of ['merge', 'deploy', 'force_push', 'delete_repo']) {
    assert.ok(!exec0006.includes(forbidden), `0006 decision_gate executable code must not mention "${forbidden}"`);
  }
});

test('0006 enforces the decided-requires-decision invariant (no empty decided row)', () => {
  assert.match(norm0006, /decision_gate_decided_requires_decision_chk/);
  assert.match(norm0006, /status <> 'decided'[\s\S]*?decision is not null/);
});

test('0006 adds NO enum (text + CHECK vocabulary) — no enum/table name collision', () => {
  assert.doesNotMatch(norm0006, /create type ftw\./,
    '0006 uses text + CHECK for status/decision, so it adds no enum (no collision risk)');
});

test('0006 keeps RLS deny-by-default on decision_gate: service_role-only, no anon/authenticated', () => {
  assert.match(norm0006, /alter table ftw\.decision_gate enable row level security/);
  assert.match(norm0006, /create policy service_role_all_decision_gate[\s\S]*?for all to service_role/);
  assert.doesNotMatch(code0006, /grant[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a grant');
  assert.doesNotMatch(code0006, /create policy[\s\S]*?to (anon|authenticated)\b/,
    'anon/authenticated must never receive a policy');
  assert.match(SQL_0006, /DO NOT WEAKEN/, '0006 must carry the DO-NOT-WEAKEN security block');
});
