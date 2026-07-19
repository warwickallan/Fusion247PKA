// BUILD-014 WP-A — constraint-invariant proofs for 001_control_plane_min_schema.sql
//
// DB-GATED but NOT silently self-skipping (F8):
//   - DATABASE_URL UNSET  -> the suite skips with a LOUD message pointing at the
//     one-command runner (test/run-db-tests.mjs), which provisions a throwaway
//     Postgres cluster and runs this file for you. "Skipped" is never mistaken for
//     "passed": the runner is the documented, executed path and CI uses it.
//   - DATABASE_URL SET but `pg` missing -> the suite FAILS (throws) rather than
//     skipping, so a mis-provisioned CI job is loud, not green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: this DROPs and
// rebuilds the `ops` schema on every test.
//
//   node services/control-plane/db/test/run-db-tests.mjs          # provisions + runs
//   DATABASE_URL=postgres://.../scratch node --test <this file>   # against your own DB
//
// What it proves (the WP-A hard invariants, as SQL failures/successes):
//   1. ops.git_sha REFUSES a short/upper-case SHA; canonicalize_sha raises on short.
//   2. verdict.reviewed_commit_sha / reviewer / verdict are NOT NULL.
//   3. a verdict for the WRONG head is a FK violation (exact-SHA binding).
//   4. no duplicate ACTIVE verdict; supersede-then-insert succeeds.
//   4b. F1: a cross-GENERATION second active verdict is STILL rejected (generation is
//       audit-only, not part of the active-uniqueness key).
//   4c. F1: a stale active approve next to a newer active reject cannot co-exist, and
//       once the reject is the single active verdict the readiness view reports NOT approved.
//   5. agent_event UPDATE and DELETE are rejected (append-only trigger, 23001).
//   5b. F5: TRUNCATE of an append-only/evidence table is rejected.
//   6. merge_gate.expected_head_sha NOT NULL; overall_action_state transitions
//      (unobserved/head_moved/github_blocked/mergeable) via the derived generated column.
//   6b. F2: a gate cannot be 'approved'/'mergeable' without a head-bound two-reviewer
//       approve; F7: a non-APPROVED cached GitHub review decision blocks mergeable.
//   7. idempotency/delivery-key collisions + job lease/dead-letter invariants.
//   7b. F9: claim_job leases atomically + increments attempts; reclaim_expired_leases
//       returns an expired lease to pending (or dead_letter when exhausted).
//   8. F3: verdict UPDATE of value/reviewer/sha is rejected; verdict DELETE is rejected;
//      checkpoint DELETE while referenced by a verdict is rejected (23503); checkpoint
//      identity UPDATE (head_sha) is rejected.
//   9. F6: a verdict whose reviewer does not match its type is rejected.

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
const SHA_C = 'c'.repeat(40);

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

// F8: if DATABASE_URL is set we INTEND to run against a DB — a missing `pg` is then a
// hard failure, not a skip. Only a genuinely unset DATABASE_URL skips (loudly).
if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the DB-gated ` +
    `proofs. Install pg or use run-db-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/db/test/run-db-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

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

async function seedCheckpoint(pool, buildId, sha = SHA_A, ref = 'cp') {
  const { rows } = await pool.query(
    `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,$2,$3) returning id`,
    [buildId, ref, sha]);
  return rows[0].id;
}

/** Insert the two required approving verdicts (codex correction_loop + fable cold_final). */
async function approveBothReviewers(pool, cpId, sha = SHA_A) {
  await pool.query(
    `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
     values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, sha]);
  await pool.query(
    `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
     values ($1,$2,'fable','cold_final','approve')`, [cpId, sha]);
}

gated('1. ops.git_sha domain refuses short/upper-case SHAs; canonicalize_sha raises on short', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    await rejects(pool,
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp','abc1234')`, [buildId]);
    await rejects(pool,
      `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha) values ($1,'cp',$2)`, [buildId, SHA_A.toUpperCase()]);
    await rejects(pool, `select ops.canonicalize_sha('abc1234')`);
    const { rows } = await pool.query(`select ops.canonicalize_sha($1) as s`, [`  ${SHA_A.toUpperCase()}  `]);
    assert.equal(rows[0].s, SHA_A, 'canonicalize trims + lower-cases a full head');
  } finally { await pool.end(); }
});

gated('2 & 3. verdict NOT NULLs + exact-SHA composite-FK head binding', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);

    await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewer, verdict_type, verdict) values ($1,'gpt_codex','correction_loop','approve')`, [cpId]);

    const fkErr = await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_B]);
    assert.equal(fkErr.code, '23503', 'wrong-head verdict must be a foreign_key_violation');

    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
  } finally { await pool.end(); }
});

gated('4. no duplicate ACTIVE verdict; supersede-then-insert succeeds', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);

    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
    const dupErr = await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','request_changes')`, [cpId, SHA_A]);
    assert.equal(dupErr.code, '23505', 'duplicate active verdict must be a unique_violation');

    // supersede-then-insert in ONE transaction is the only path to a new active verdict
    await pool.query('begin');
    await pool.query(
      `update ops.verdict set state='superseded', superseded_at=now()
       where checkpoint_id=$1 and state='active'`, [cpId]);
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, active_generation)
       values ($1,$2,'gpt_codex','correction_loop','approve',2)`, [cpId, SHA_A]);
    await pool.query('commit');
  } finally { await pool.end(); }
});

gated('4b. F1: a bumped active_generation can NOT conjure a second concurrent active verdict', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, active_generation)
       values ($1,$2,'gpt_codex','correction_loop','approve',1)`, [cpId, SHA_A]);
    // round-1 hole: a second active row at generation 2 WITHOUT superseding the first.
    const err = await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, active_generation)
       values ($1,$2,'gpt_codex','correction_loop','request_changes',2)`, [cpId, SHA_A]);
    assert.equal(err.code, '23505', 'generation is audit-only; a second active row is still a unique_violation');
  } finally { await pool.end(); }
});

gated('4c. F1: a newer active reject is not masked by a stale approve (readiness reports NOT approved)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);
    // fable already approved cold_final so that side is not the variable under test.
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'fable','cold_final','approve')`, [cpId, SHA_A]);
    // codex approves, then supersedes with a request_changes — the reject is now the
    // ONLY active correction_loop verdict.
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
    await pool.query('begin');
    await pool.query(
      `update ops.verdict set state='superseded', superseded_at=now()
       where checkpoint_id=$1 and reviewer='gpt_codex' and state='active'`, [cpId]);
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, active_generation)
       values ($1,$2,'gpt_codex','correction_loop','request_changes',2)`, [cpId, SHA_A]);
    await pool.query('commit');

    const { rows } = await pool.query(
      `select correction_loop_approved, cold_final_approved, both_reviewers_approved_this_head
         from ops.checkpoint_merge_readiness where checkpoint_id=$1`, [cpId]);
    assert.equal(rows[0].correction_loop_approved, false, 'the single active correction_loop verdict is a reject');
    assert.equal(rows[0].both_reviewers_approved_this_head, false, 'a stale approve can NOT mask the newer reject');
  } finally { await pool.end(); }
});

gated('5 & 5b. agent_event append-only (UPDATE/DELETE 23001) + TRUNCATE rejected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const { rows } = await pool.query(
      `insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash)
       values ($1,'dk-1','checkpoint.posted','sha256:deadbeef') returning id`, [buildId]);
    const id = rows[0].id;
    // F8: restrict_violation is SQLSTATE 23001 (round-1 mis-asserted 2F004).
    const upErr = await rejects(pool, `update ops.agent_event set event_kind='x' where id=$1`, [id]);
    assert.equal(upErr.code, '23001', 'UPDATE must hit the append-only trigger (restrict_violation = 23001)');
    const delErr = await rejects(pool, `delete from ops.agent_event where id=$1`, [id]);
    assert.equal(delErr.code, '23001', 'DELETE must hit the append-only trigger (restrict_violation = 23001)');
    // F5: TRUNCATE is rejected by the statement-level guard.
    const truncErr = await rejects(pool, `truncate ops.agent_event`);
    assert.equal(truncErr.code, '23001', 'TRUNCATE must hit the no-truncate guard');
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
      `insert into ops.merge_gate (build_id, fusion_policy_decision) values ($1,'pending')`, [buildId]);

    // A non-approved gate needs no reviewers: pending gate with an unobserved GitHub side.
    const { rows: g0 } = await pool.query(
      `insert into ops.merge_gate (build_id, expected_head_sha) values ($1,$2)
       returning overall_action_state`, [buildId, SHA_A]);
    assert.equal(g0[0].overall_action_state, 'fusion_not_approved');
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1`, [buildId]);

    // Approve requires the two-reviewer chain: seed checkpoint + both approvals at SHA_A.
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);
    await approveBothReviewers(pool, cpId, SHA_A);

    // Fusion approved for SHA_A, GitHub cached head is SHA_B -> head_moved
    const { rows: g1 } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,$2,'approved',$3,'clean',$4)
       returning heads_agree, overall_action_state`, [buildId, cpId, SHA_A, SHA_B]);
    assert.equal(g1[0].heads_agree, false);
    assert.equal(g1[0].overall_action_state, 'head_moved');

    // second LIVE gate refused until the first is superseded
    await rejects(pool,
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha)
       values ($1,$2,'approved',$3)`, [buildId, cpId, SHA_A]);
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1 and superseded_at is null`, [buildId]);

    // F13: no cached head at all -> github_unobserved (distinct from head_moved)
    const { rows: gu } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha)
       values ($1,$2,'approved',$3) returning overall_action_state`, [buildId, cpId, SHA_A]);
    assert.equal(gu[0].overall_action_state, 'github_unobserved');
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1 and superseded_at is null`, [buildId]);

    // aligned: approved + heads agree + github clean + no review decision -> mergeable
    const { rows: g2 } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,$2,'approved',$3,'clean',$3)
       returning heads_agree, overall_action_state`, [buildId, cpId, SHA_A]);
    assert.equal(g2[0].heads_agree, true);
    assert.equal(g2[0].overall_action_state, 'mergeable');
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1 and superseded_at is null`, [buildId]);

    // github mechanical blocked flips overall away from mergeable
    const { rows: g3 } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached)
       values ($1,$2,'approved',$3,'blocked',$3) returning overall_action_state`, [buildId, cpId, SHA_A]);
    assert.equal(g3[0].overall_action_state, 'github_blocked');
    await pool.query(`update ops.merge_gate set superseded_at=now() where build_id=$1 and superseded_at is null`, [buildId]);

    // F7: a non-APPROVED cached GitHub review decision blocks mergeable even when clean + heads agree
    const { rows: g4 } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached, github_review_decision_cached)
       values ($1,$2,'approved',$3,'clean',$3,'CHANGES_REQUESTED') returning overall_action_state`,
      [buildId, cpId, SHA_A]);
    assert.equal(g4[0].overall_action_state, 'github_blocked', 'CHANGES_REQUESTED must block mergeable (F7)');
  } finally { await pool.end(); }
});

gated('6b. F2: a gate can NOT be approved/mergeable without a head-bound two-reviewer approve', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);

    // no verdicts yet -> approving is rejected by merge_gate_require_reviewers
    const noRev = await rejects(pool,
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha)
       values ($1,$2,'approved',$3)`, [buildId, cpId, SHA_A]);
    assert.equal(noRev.code, '23514', 'approve without reviewers is a check_violation');

    // only ONE reviewer approves -> still rejected (needs BOTH distinct reviewers)
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpId, SHA_A]);
    await rejects(pool,
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha)
       values ($1,$2,'approved',$3)`, [buildId, cpId, SHA_A]);

    // an approved gate whose checkpoint_id is NULL is rejected (no head under review)
    await rejects(pool,
      `insert into ops.merge_gate (build_id, fusion_policy_decision, expected_head_sha)
       values ($1,'approved',$2)`, [buildId, SHA_A]);

    // composite FK (checkpoint_id, expected_head_sha) -> checkpoint(id, head_sha): a head
    // the checkpoint never recorded is rejected. Use a NON-approved decision so the
    // require-reviewers trigger (which would fire first for 'approved') is out of the way
    // and the FK itself is the rejecter -> 23503.
    const fk = await rejects(pool,
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha)
       values ($1,$2,'pending',$3)`, [buildId, cpId, SHA_C]);
    assert.equal(fk.code, '23503', 'gate head must be a recorded checkpoint head (composite FK)');

    // both reviewers approve -> approving now succeeds and can be mergeable
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'fable','cold_final','approve')`, [cpId, SHA_A]);
    const { rows } = await pool.query(
      `insert into ops.merge_gate (build_id, checkpoint_id, fusion_policy_decision, expected_head_sha,
         github_mech_state_cached, github_head_sha_cached, github_review_decision_cached)
       values ($1,$2,'approved',$3,'clean',$3,'APPROVED') returning overall_action_state`,
      [buildId, cpId, SHA_A]);
    assert.equal(rows[0].overall_action_state, 'mergeable');
  } finally { await pool.end(); }
});

gated('7. idempotency/delivery-key + job lease/dead-letter invariants', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    await pool.query(`insert into ops.job (queue, idempotency_key) values ('q','idem-1')`);
    assert.equal((await rejects(pool, `insert into ops.job (queue, idempotency_key) values ('q','idem-1')`)).code, '23505');

    // leased status requires an owner + deadline (biconditional check)
    await rejects(pool, `insert into ops.job (queue, idempotency_key, status) values ('q','idem-2','leased')`);
    // and the reverse: a non-leased status may NOT carry a lease owner
    await rejects(pool,
      `insert into ops.job (queue, idempotency_key, status, lease_owner) values ('q','idem-2b','pending','worker')`);
    // dead_letter requires exhausted attempts
    await rejects(pool,
      `insert into ops.job (queue, idempotency_key, status, attempts, max_attempts)
       values ('q','idem-3','dead_letter',0,5)`);
    await pool.query(
      `insert into ops.job (queue, idempotency_key, status, attempts, max_attempts)
       values ('q','idem-4','dead_letter',5,5)`);

    await pool.query(`insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash) values ($1,'dk','k','h')`, [buildId]);
    assert.equal((await rejects(pool, `insert into ops.agent_event (build_id, delivery_key, event_kind, payload_hash) values ($1,'dk','k','h')`, [buildId])).code, '23505');
    await pool.query(`insert into ops.command_request (idempotency_key, command_kind, requested_by) values ('c','restart','larry')`);
    assert.equal((await rejects(pool, `insert into ops.command_request (idempotency_key, command_kind, requested_by) values ('c','restart','larry')`)).code, '23505');
  } finally { await pool.end(); }
});

gated('7b. F9: claim_job leases atomically + increments attempts; reclaim_expired_leases retries/dead-letters', async () => {
  const pool = await freshPool();
  try {
    await pool.query(`insert into ops.job (queue, idempotency_key) values ('w','j1')`);
    await pool.query(`insert into ops.job (queue, idempotency_key) values ('w','j2')`);

    // claim leases the oldest pending, sets owner/deadline, increments attempts
    const { rows: c1 } = await pool.query(`select * from ops.claim_job('w','worker-1',30)`);
    assert.equal(c1[0].idempotency_key, 'j1');
    assert.equal(c1[0].status, 'leased');
    assert.equal(c1[0].attempts, 1);
    assert.ok(c1[0].lease_owner === 'worker-1' && c1[0].lease_deadline_at, 'lease owner + deadline set');

    // a second claim skips the locked/leased j1 and takes j2 (SKIP LOCKED, FIFO)
    const { rows: c2 } = await pool.query(`select * from ops.claim_job('w','worker-2',30)`);
    assert.equal(c2[0].idempotency_key, 'j2');

    // empty queue -> NULL (no row conjured)
    const { rows: c3 } = await pool.query(`select (ops.claim_job('w','worker-3',30)).id as id`);
    assert.equal(c3[0].id, null, 'no pending work -> NULL claim');

    // expire j1's lease in the past, then reclaim -> back to pending (attempts < max)
    await pool.query(`update ops.job set lease_deadline_at = now() - interval '1 minute' where idempotency_key='j1'`);
    const { rows: r1 } = await pool.query(`select * from ops.reclaim_expired_leases()`);
    const reclaimed = r1.find(r => r.idempotency_key === 'j1');
    assert.ok(reclaimed, 'expired lease is reclaimed');
    assert.equal(reclaimed.status, 'pending');
    assert.equal(reclaimed.lease_owner, null);

    // exhaust attempts on j1, expire again -> reclaim parks it in dead_letter
    await pool.query(`update ops.job set attempts = max_attempts, status='leased',
      lease_owner='w', lease_deadline_at = now() - interval '1 minute' where idempotency_key='j1'`);
    const { rows: r2 } = await pool.query(`select * from ops.reclaim_expired_leases()`);
    const dead = r2.find(r => r.idempotency_key === 'j1');
    assert.equal(dead.status, 'dead_letter');
    assert.ok(dead.dead_lettered_at, 'dead_lettered_at stamped');
  } finally { await pool.end(); }
});

gated('8. F3: verdict UPDATE/DELETE + checkpoint DELETE-while-referenced + checkpoint identity are protected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);
    const { rows: v } = await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve') returning id`, [cpId, SHA_A]);
    const vId = v[0].id;

    // verdict value/reviewer/sha are frozen (only active->superseded is allowed)
    assert.equal((await rejects(pool, `update ops.verdict set verdict='request_changes' where id=$1`, [vId])).code, '23001');
    assert.equal((await rejects(pool, `update ops.verdict set reviewer='fable' where id=$1`, [vId])).code, '23001');
    assert.equal((await rejects(pool, `update ops.verdict set reviewed_commit_sha=$2 where id=$1`, [vId, SHA_A])).code, '23001');
    // DELETE of a verdict is always rejected
    assert.equal((await rejects(pool, `delete from ops.verdict where id=$1`, [vId])).code, '23001');

    // a superseded verdict can NOT flip back to active
    await pool.query(`update ops.verdict set state='superseded', superseded_at=now() where id=$1`, [vId]);
    assert.equal((await rejects(pool, `update ops.verdict set state='active' where id=$1`, [vId])).code, '23001');

    // checkpoint DELETE while a verdict references it -> 23503 (NO ACTION, not cascade)
    assert.equal((await rejects(pool, `delete from ops.checkpoint where id=$1`, [cpId])).code, '23503');
    // checkpoint identity (head_sha) is immutable
    assert.equal((await rejects(pool, `update ops.checkpoint set head_sha=$2 where id=$1`, [cpId, SHA_B])).code, '23001');
    // but a mutable pointer (branch) can be updated
    await pool.query(`update ops.checkpoint set branch='release' where id=$1`, [cpId]);

    // a build with dependent evidence can NOT be deleted -> 23503 (NO ACTION)
    assert.equal((await rejects(pool, `delete from ops.build where id=$1`, [buildId])).code, '23503');
  } finally { await pool.end(); }
});

gated('9. F6: reviewer<->type binding — a mismatched reviewer/type verdict is rejected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A);
    // fable can not file a correction_loop verdict
    assert.equal((await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'fable','correction_loop','approve')`, [cpId, SHA_A])).code, '23514');
    // gpt_codex can not file a cold_final verdict
    assert.equal((await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','cold_final','approve')`, [cpId, SHA_A])).code, '23514');
    // larry (orchestrator) can not file either -> can never fill a reviewer slot
    assert.equal((await rejects(pool,
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'larry','correction_loop','approve')`, [cpId, SHA_A])).code, '23514');
  } finally { await pool.end(); }
});
