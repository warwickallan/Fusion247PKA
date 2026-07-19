// BUILD-014 WP-A — constraint-invariant proofs for 001_control_plane_min_schema.sql
//
// DB-GATED: self-skips when DATABASE_URL is unset (like the fusion-tower DB proofs),
// so it NEVER touches prod by default. Point it at an ISOLATED throwaway dev Postgres
// only. It DROPs and rebuilds the `ops` schema — do NOT run against anything you care
// about.
//
//   DATABASE_URL=postgres://user:pass@localhost:5432/scratch_dev \
//     node --test services/control-plane/db/test/constraint-invariants.test.js
//
// What it proves (the WP-A hard invariants, as SQL failures/successes):
//   1. ops.git_sha REFUSES a short/upper-case SHA; canonicalize_sha raises on short.
//   2. verdict.reviewed_commit_sha / reviewer / verdict are NOT NULL.
//   3. a verdict for the WRONG head is a FK violation (exact-SHA binding).
//   4. no duplicate ACTIVE verdict; supersede-then-insert succeeds.
//   5. agent_event UPDATE and DELETE are rejected (append-only trigger).
//   6. merge_gate.expected_head_sha NOT NULL; overall_action_state transitions
//      (head_moved -> mergeable) via the derived generated column; one live gate/build.
//   7. idempotency/delivery-key collisions are rejected (job/event/command).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(__dirname, '..', 'migrations', '001_control_plane_min_schema.sql');
const DB = process.env.DATABASE_URL;

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

let Pool = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); } catch { /* pg absent */ }

const gated = (name, fn) => test(name, { skip: !DB || !Pool ? 'DATABASE_URL and pg required (DB-gated proof)' : false }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  await pool.query(fs.readFileSync(MIGRATION, 'utf8'));
  return pool;
}

/** Assert a query rejects (throws). Returns the error for optional code checks. */
async function rejects(pool, sql, params) {
  let err = null;
  try { await pool.query(sql, params); } catch (e) { err = e; }
  assert.ok(err, `expected rejection for: ${sql}`);
  return err;
}

async function seedBuild(pool) {
  const { rows } = await pool.query(
    `insert into ops.build (build_ref, repo) values ($1, $2) returning id`,
    [`BUILD-014-${Math.random().toString(36).slice(2)}`, 'warwickallan/Fusion247PKA']);
  return rows[0].id;
}

gated('1. ops.git_sha domain refuses short/upper-case SHAs; canonicalize_sha raises on short', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    // short (7-char) head is refused by the domain
    await rejects(pool,
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp','abc1234')`, [buildId]);
    // upper-case full head is refused by the domain
    await rejects(pool,
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp',$2)`, [buildId, SHA_A.toUpperCase()]);
    // canonicalize_sha raises on a short head (the Tower /7,40/ acceptance is refused)
    await rejects(pool, `select ops.canonicalize_sha('abc1234')`);
    // canonicalize_sha lower-cases + accepts a full head
    const { rows } = await pool.query(`select ops.canonicalize_sha($1) as s`, [SHA_A.toUpperCase()]);
    assert.equal(rows[0].s, SHA_A);
  } finally { await pool.end(); }
});

gated('2 & 3. verdict NOT NULLs + exact-SHA composite-FK head binding', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const { rows: cp } = await pool.query(
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp',$2) returning id`,
      [buildId, SHA_A]);
    const cpId = cp[0].id;

    // NOT NULL reviewed_commit_sha
    await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewer, verdict_type, verdict) values ($1,'gpt_codex','correction_loop','approve')`, [cpId]);

    // WRONG head (SHA_B) for a checkpoint recorded at SHA_A -> FK violation
    const fkErr = await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_B]);
    assert.equal(fkErr.code, '23503', 'wrong-head verdict must be a foreign_key_violation');

    // RIGHT head succeeds
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
  } finally { await pool.end(); }
});

gated('4. no duplicate ACTIVE verdict; supersede-then-insert succeeds', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const { rows: cp } = await pool.query(
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp',$2) returning id`,
      [buildId, SHA_A]);
    const cpId = cp[0].id;

    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
    // second ACTIVE verdict for the same (reviewer, head, type, generation) -> unique violation
    const dupErr = await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','request_changes')`, [cpId, SHA_A]);
    assert.equal(dupErr.code, '23505', 'duplicate active verdict must be a unique_violation');

    // supersede the prior, then a new active verdict is allowed
    await pool.query(
      `update ops.verdict set state='superseded', superseded_at=now()
       where checkpoint_id=$1 and state='active'`, [cpId]);
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, active_generation)
       values ($1,$2,'gpt_codex','correction_loop','approve',2)`, [cpId, SHA_A]);
  } finally { await pool.end(); }
});

gated('5. agent_event is append-only (UPDATE and DELETE rejected)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const { rows } = await pool.query(
      `insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash)
       values ($1,'dk-1','checkpoint.posted','sha256:deadbeef') returning id`, [buildId]);
    const id = rows[0].id;
    const upErr = await rejects(pool, `update ops.agent_event set event_kind='x' where id=$1`, [id]);
    assert.equal(upErr.code, '2F004', 'UPDATE must hit the append-only trigger (restrict_violation)');
    const delErr = await rejects(pool, `delete from ops.agent_event where id=$1`, [id]);
    assert.equal(delErr.code, '2F004', 'DELETE must hit the append-only trigger (restrict_violation)');
    // sensitive events are structurally ineligible for public git provenance
    const { rows: sens } = await pool.query(
      `insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash, classification)
       values ($1,'dk-2','household.note','sha256:beef','sensitive') returning git_provenance_eligible`, [buildId]);
    assert.equal(sens[0].git_provenance_eligible, false);
  } finally { await pool.end(); }
});

gated('6. merge_gate NOT NULL head + dual-gate derived overall_action_state + one live gate/build', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    // expected_head_sha NOT NULL
    await rejects(pool,
      `insert into ops.merge_gate (build_id, fusion_policy_decision) values ($1,'approved')`, [buildId]);

    // Fusion approved for SHA_A, but GitHub cached head is SHA_B -> head_moved
    const { rows: g1 } = await pool.query(
      `insert into ops.merge_gate (build_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,'approved',$2,'clean',$3)
       returning heads_agree, overall_action_state`, [buildId, SHA_A, SHA_B]);
    assert.equal(g1[0].heads_agree, false);
    assert.equal(g1[0].overall_action_state, 'head_moved');

    // a second LIVE gate for the same build is refused until the first is superseded
    await rejects(pool,
      `insert into ops.merge_gate (build_id, fusion_policy_decision, expected_head_sha)
       values ($1,'approved',$2)`, [buildId, SHA_A]);
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1`, [buildId]);

    // now aligned: approved + heads agree + github clean -> mergeable
    const { rows: g2 } = await pool.query(
      `insert into ops.merge_gate (build_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,'approved',$2,'clean',$2)
       returning heads_agree, overall_action_state`, [buildId, SHA_A]);
    assert.equal(g2[0].heads_agree, true);
    assert.equal(g2[0].overall_action_state, 'mergeable');

    // github blocked flips overall away from mergeable even when heads agree + approved
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1 and superseded_at is null`, [buildId]);
    const { rows: g3 } = await pool.query(
      `insert into ops.merge_gate (build_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,'approved',$2,'blocked',$2)
       returning overall_action_state`, [buildId, SHA_A]);
    assert.equal(g3[0].overall_action_state, 'github_blocked');
  } finally { await pool.end(); }
});

gated('7. idempotency/delivery-key + job lease/dead-letter invariants', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    // job idempotency key collision
    await pool.query(`insert into ops.job (queue, idempotency_key) values ('q','idem-1')`);
    assert.equal((await rejects(pool, `insert into ops.job (queue, idempotency_key) values ('q','idem-1')`)).code, '23505');

    // leased status requires an owner + deadline
    await rejects(pool, `insert into ops.job (queue, idempotency_key, status) values ('q','idem-2','leased')`);
    // dead_letter requires exhausted attempts
    await rejects(pool,
      `insert into ops.job (queue, idempotency_key, status, attempts, max_attempts)
       values ('q','idem-3','dead_letter',0,5)`);
    await pool.query(
      `insert into ops.job (queue, idempotency_key, status, attempts, max_attempts)
       values ('q','idem-4','dead_letter',5,5)`);

    // event delivery key + command idempotency key collisions
    await pool.query(`insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash) values ($1,'dk','k','h')`, [buildId]);
    assert.equal((await rejects(pool, `insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash) values ($1,'dk','k','h')`, [buildId])).code, '23505');
    await pool.query(`insert into ops.command_request (idempotency_key, command_kind, requested_by) values ('c','restart','larry')`);
    assert.equal((await rejects(pool, `insert into ops.command_request (idempotency_key, command_kind, requested_by) values ('c','restart','larry')`)).code, '23505');
  } finally { await pool.end(); }
});
