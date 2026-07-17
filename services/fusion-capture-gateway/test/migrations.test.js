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
const sql0005 = fs.readFileSync(path.join(MIGRATIONS_DIR, '0005_wp0_card_target_and_poll_offset.sql'), 'utf8');
const sql0006 = fs.readFileSync(path.join(MIGRATIONS_DIR, '0006_wp1_cloud_intake_rpcs.sql'), 'utf8');

const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');

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

// ── 0006 (WP1) static guards — the migration must ADD the cloud surface without
//    weakening ANY WP0 posture: RLS deny-by-default, tap-gate, EXECUTE scope.

test('0006 declares every constraint name it creates explicitly (CI-checkable determinism, P1)', () => {
  const declared = extractAll(sql0006, 'constraint\\s+(\\w+)\\b');
  for (const name of [
    'channel_update_dedup_kind_chk',
    'channel_update_dedup_capture_id_fkey',
    'channel_update_dedup_pkey',
  ]) {
    assert.ok(declared.includes(name), `0006 must explicitly declare constraint "${name}"`);
  }
});

test('0006 enables RLS on every table it creates and never disables RLS anywhere (security gate — DO NOT WEAKEN)', () => {
  const body = stripComments(sql0006);
  const created = extractAll(body, 'create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(fcg\\.\\w+)');
  assert.ok(created.includes('fcg.channel_update_dedup'), 'sanity: 0006 creates fcg.channel_update_dedup');
  const rlsEnabled = new Set(extractAll(body, 'alter\\s+table\\s+(fcg\\.\\w+)\\s+enable\\s+row\\s+level\\s+security'));
  for (const table of created) {
    assert.ok(rlsEnabled.has(table), `RLS must be enabled on ${table} (security gate — DO NOT WEAKEN)`);
  }
  assert.doesNotMatch(body, /disable\s+row\s+level\s+security/i, '0006 must not disable RLS');
});

test('0006 drops nothing and grants anon/authenticated/PUBLIC nothing (deny-by-default stands)', () => {
  const body = stripComments(sql0006);
  assert.doesNotMatch(body, /\bdrop\s+(table|constraint|policy|function|type|schema|index)\b/i, '0006 is strictly additive');
  // No GRANT of any kind to anon/authenticated/PUBLIC. (REVOKE ... FROM them is
  // required and present — the regex targets grants only.)
  assert.doesNotMatch(body, /grant\s+[^;]*\bto\s+(anon|authenticated|public)\b/i, '0006 must not grant anon/authenticated/PUBLIC anything');
  // ... and no RLS policy names them.
  const policyRoles = extractAll(body, 'create\\s+policy\\s+\\w+[^;]*?\\bto\\s+(\\w+)');
  for (const role of policyRoles) {
    assert.ok(['service_role', 'fcg_rpc_owner'].includes(role), `0006 policy scoped to unexpected role "${role}"`);
  }
});

test('0006 SECURITY DEFINER hardening: every definer function pins search_path = \'\' and is EXECUTE service_role-only (Vex gate)', () => {
  const body = stripComments(sql0006);
  const fnChunks = body.split(/create\s+function/i).slice(1);
  assert.equal(fnChunks.length, 3, '0006 defines exactly the three WP1 RPCs');
  for (const chunk of fnChunks) {
    assert.match(chunk, /security\s+definer/i, 'every 0006 function is SECURITY DEFINER by design');
    assert.match(chunk, /set\s+search_path\s*=\s*''/i, 'every SECURITY DEFINER function must pin an empty search_path');
  }
  for (const fn of ['fcg_webhook_intake', 'fcg_webhook_confirm_tap', 'fcg_webhook_card_ref']) {
    assert.match(
      body,
      new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}[^;]*from\\s+public,\\s*anon,\\s*authenticated`, 'i'),
      `EXECUTE on ${fn} must be revoked from PUBLIC/anon/authenticated`,
    );
    assert.match(
      body,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[^;]*to\\s+service_role`, 'i'),
      `EXECUTE on ${fn} must be granted to service_role only`,
    );
    assert.match(
      body,
      new RegExp(`alter\\s+function\\s+public\\.${fn}[^;]*owner\\s+to\\s+fcg_rpc_owner`, 'i'),
      `${fn} must be owned by the least-privilege fcg_rpc_owner`,
    );
  }
  // grant execute lines target service_role EXCLUSIVELY.
  const grantees = extractAll(body, 'grant\\s+execute\\s+on\\s+function[^;]*\\bto\\s+(\\w+)');
  for (const g of grantees) assert.equal(g, 'service_role', `EXECUTE granted to unexpected principal "${g}"`);
});

test('0006 least-privilege definer role: no DELETE grant, no raw_object/evidence_pointer/channel_poll_offset access for fcg_rpc_owner', () => {
  const body = stripComments(sql0006);
  const ownerGrants = body.match(/grant\s+[^;]*\bto\s+fcg_rpc_owner\s*;/gi) ?? [];
  assert.ok(ownerGrants.length > 0, 'sanity: fcg_rpc_owner receives its narrow grants');
  for (const grant of ownerGrants) {
    assert.doesNotMatch(grant, /\bdelete\b/i, `fcg_rpc_owner must never hold DELETE: ${grant.trim()}`);
    assert.doesNotMatch(grant, /raw_object|evidence_pointer|channel_poll_offset/i, `fcg_rpc_owner must not touch this surface: ${grant.trim()}`);
  }
  // The transient CREATE-on-public needed for ownership transfer is revoked in
  // the same migration — no standing CREATE privilege survives.
  assert.match(body, /grant\s+create\s+on\s+schema\s+public\s+to\s+fcg_rpc_owner/i, 'sanity: the transient grant exists');
  assert.match(body, /revoke\s+create\s+on\s+schema\s+public\s+from\s+fcg_rpc_owner/i, 'the transient CREATE grant must be revoked in 0006 itself');
});

test('0006 tap-gate / enqueue-token invariant (RPC path): intake lands ONLY at accepted; the ONLY state assignment is accepted → offline_queued inside fcg_webhook_confirm_tap', () => {
  const body = stripComments(sql0006);

  // Every `set state = '<literal>'` in the whole migration must be the single
  // offline_queued hop — nothing may set queued/claimed/writing/completed/etc.
  const stateSets = extractAll(body, "set\\s+state\\s*=\\s*'(\\w+)'");
  assert.deepEqual(stateSets, ['offline_queued'], '0006 may only ever assign state offline_queued (the gated tap hop)');

  // ... and that assignment lives INSIDE fcg_webhook_confirm_tap, guarded by an
  // explicit accepted-state check (the cloud twin of confirmedByTap).
  const confirmTapBody = body.split(/create\s+function\s+public\.fcg_webhook_confirm_tap/i)[1]?.split(/create\s+function/i)[0] ?? '';
  assert.match(confirmTapBody, /set\s+state\s*=\s*'offline_queued'/i, 'the hop lives in confirm_tap');
  assert.match(confirmTapBody, /if\s+v_state\s*=\s*'accepted'\s+then/i, 'the hop is gated on the accepted state');
  assert.match(confirmTapBody, /p_action\s+is\s+distinct\s+from\s+'SaveToBrain'/i, 'only SaveToBrain confirms');
  assert.match(confirmTapBody, /update_kind\)\s*[\s\S]*?'callback_query'/i, 'confirm_tap ledgers only callback_query updates');

  // The intake function inserts processing_state ONLY at accepted (tap-gate hold).
  const intakeBody = body.split(/create\s+function\s+public\.fcg_webhook_intake/i)[1]?.split(/create\s+function/i)[0] ?? '';
  assert.match(intakeBody, /insert\s+into\s+fcg\.processing_state[\s\S]*?'accepted'/i, 'webhook intake lands at accepted');
  assert.doesNotMatch(intakeBody, /'offline_queued'|'queued'(?!_)/, 'webhook intake must never enqueue');

  // card_ref RPC touches card_ref/updated_at only — never state.
  const cardRefBody = body.split(/create\s+function\s+public\.fcg_webhook_card_ref/i)[1] ?? '';
  assert.doesNotMatch(cardRefBody, /set\s+state\s*=/i, 'fcg_webhook_card_ref must never change state');
});

test('0006 does not touch any 0001–0005 object it should not (poll offset, claim predicate, erasure cascade untouched)', () => {
  const body = stripComments(sql0006);
  assert.doesNotMatch(body, /channel_poll_offset/i, '0006 must not touch the poll cursor');
  assert.doesNotMatch(body, /alter\s+table\s+fcg\.(idempotency_key|evidence_pointer|processing_state|raw_object|channel_identity)\b/i,
    '0006 alters only capture_envelope (intake_transport column) among existing tables');
});

test('0006 carries the DO-NOT-WEAKEN security-gate block (Vex gate marker)', () => {
  assert.match(sql0006, /!! SECURITY GATE \(Vex\) — DO NOT WEAKEN !!/, 'the gate marker must survive edits');
  assert.match(sql0006, /cloud twin of the wp0 confirmedbytap|CLOUD TWIN of the WP0 confirmedByTap/i, 'the confirm-tap contract note must survive');
});

test('0005 enables RLS on its new table with a service_role-only policy (security gate — DO NOT WEAKEN)', () => {
  const created = new Set(extractAll(sql0005, 'create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(fcg\\.\\w+)'));
  assert.ok(created.has('fcg.channel_poll_offset'), 'sanity: 0005 creates fcg.channel_poll_offset');
  const rlsEnabled = new Set(extractAll(sql0005, 'alter\\s+table\\s+(fcg\\.\\w+)\\s+enable\\s+row\\s+level\\s+security'));
  for (const table of created) {
    assert.ok(rlsEnabled.has(table), `RLS must be enabled on ${table} (security gate — DO NOT WEAKEN)`);
  }
  // The only policy is scoped to service_role; nothing grants anon/authenticated.
  assert.match(sql0005, /for\s+all\s+to\s+service_role/i, '0005 policy must be service_role-only');
  assert.doesNotMatch(sql0005, /\bto\s+anon\b/i, '0005 must not grant anon');
  assert.doesNotMatch(sql0005, /\bto\s+authenticated\b/i, '0005 must not grant authenticated');
  assert.doesNotMatch(sql0005, /disable\s+row\s+level\s+security/i, '0005 must not disable RLS');
});
