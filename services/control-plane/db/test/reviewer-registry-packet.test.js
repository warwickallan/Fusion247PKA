// BUILD-014 PR-2a — reviewer-registry / review-packet / review-run / checkpoint-assurance
// proofs for 004_reviewer_registry_and_packet.sql (applied on top of 001 + 002 + 003).
//
// DB-GATED but NOT silently self-skipping (mirrors 001's/003's suites):
//   - DATABASE_URL UNSET  -> skip with a LOUD message pointing at the one-command runner.
//   - DATABASE_URL SET but `pg` missing -> FAIL (throw), never green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: this DROPs and rebuilds
// the `ops` schema on every test.
//
//   node services/control-plane/db/test/run-registry-tests.mjs        # provisions + runs
//   DATABASE_URL=postgres://.../scratch node --test <this file>       # against your own DB
//
// What it proves (the PR-2a hard invariants, as SQL failures/successes):
//   1. the REGISTRY drives role authorisation — a reviewer can only fill its AUTHORISED roles;
//      a NEW reviewer (grok) is added by config (one row + one grant), NO schema/enum change.
//   2. review_packet is IMMUTABLE once ready/hashed; packet_hash is write-once; ready requires
//      a hash + resolved payload; illegal state transitions + born consumed/stale rejected.
//   3. review_run is BOUND (composite FK) to the packet's packet_hash + exact head + prd/plan
//      contract versions, and is append-only.
//   4. MODEL-AGNOSTIC role-based readiness: low-risk product_qa-only -> ready on product_qa;
//      adversarial-required -> BLOCKED until the adversarial role approves; adversarial-required-
//      but-unavailable -> BLOCKED (never silently downgraded to product_qa-only).
//   5. HISTORICAL verdicts preserved + the old both-required rule CANNOT govern a risk-tiered
//      checkpoint (a low-risk checkpoint is ready on product_qa alone where 001's view blocks).
//   6. migration 004 is idempotent (double-apply is a no-op).
//   7. catalog fence — every ops function (incl. 004's) pins search_path.
//   8. reviewer_registry identity durability (DELETE rejected; reviewer_key immutable; enable toggle).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '001_control_plane_min_schema.sql',
  '002_current_head_authority.sql',
  '003_contract_acceptance_schema.sql',
  '004_reviewer_registry_and_packet.sql',
].map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const HASH = 'sha256:packet-hash-0001';

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the DB-gated ` +
    `proofs. Install pg or use run-registry-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/db/test/run-registry-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  for (const m of MIGRATIONS) await pool.query(fs.readFileSync(m, 'utf8'));
  return pool;
}

async function rejects(pool, sql, params) {
  let err = null;
  try { await pool.query(sql, params); } catch (e) { err = e; }
  assert.ok(err, `expected rejection for: ${sql}`);
  return err;
}

// ---- seed helpers -------------------------------------------------------

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

async function seedPrd(pool, buildId, { key = 'PRD-A', version = 1 } = {}) {
  const { rows } = await pool.query(
    `insert into ops.prd (build_id, prd_key, version, title, content_ref, content_hash, authored_by)
     values ($1,$2,$3,'PRD','ref://prd','h1','larry') returning id`, [buildId, key, version]);
  return rows[0].id;
}

async function seedPlan(pool, buildId, { key = 'PLAN-A', version = 1 } = {}) {
  const { rows } = await pool.query(
    `insert into ops.plan (build_id, plan_key, version, title, content_ref, content_hash, authored_by)
     values ($1,$2,$3,'Plan','ref://plan','h1','larry') returning id`, [buildId, key, version]);
  return rows[0].id;
}

async function seedAssurance(pool, checkpointId, buildId, {
  productQa = true, adversarial = false, security = false, warwick = false, autoMerge = false,
} = {}) {
  await pool.query(
    `insert into ops.checkpoint_assurance
       (checkpoint_id, build_id, product_qa_required, adversarial_review_required,
        security_review_required, warwick_approval_required, auto_merge_eligible, policy_version)
     values ($1,$2,$3,$4,$5,$6,$7,'v1')`,
    [checkpointId, buildId, productQa, adversarial, security, warwick, autoMerge]);
}

/** A READY, hashed packet bound to (checkpoint, head, prd, plan). */
async function seedReadyPacket(pool, { buildId, checkpointId, sha = SHA_A, prdId, planId, hash = HASH }) {
  const { rows } = await pool.query(
    `insert into ops.review_packet
       (build_id, checkpoint_id, exact_head_sha, base_sha, prd_version_id, plan_version_id,
        resolved_payload, packet_hash, state)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'ready') returning id`,
    [buildId, checkpointId, sha, SHA_C, prdId, planId, JSON.stringify({ snapshot: 'resolved' }), hash]);
  return rows[0].id;
}

async function insertRun(pool, {
  packetId, reviewerKey = 'gpt_codex', role = 'product_qa', sha = SHA_A, prdId, planId,
  hash = HASH, outcome = 'approved', completed = true,
}) {
  return pool.query(
    `insert into ops.review_run
       (review_packet_id, reviewer_key, review_role, model_provider, model_id, prompt_version,
        prompt_fingerprint, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id,
        completed_at, outcome)
     values ($1,$2,$3,'openai','m','pv','fp',$4,$5,$6,$7,$8,$9)`,
    [packetId, reviewerKey, role, hash, sha, prdId, planId, completed ? new Date() : null, outcome]);
}

/** A fully wired build + checkpoint + contract + ready packet. */
async function seedReviewable(pool, { sha = SHA_A, cpRef = 'cp1' } = {}) {
  const buildId = await seedBuild(pool);
  const cpId = await seedCheckpoint(pool, buildId, sha, cpRef);
  const prdId = await seedPrd(pool, buildId);
  const planId = await seedPlan(pool, buildId);
  const packetId = await seedReadyPacket(pool, { buildId, checkpointId: cpId, sha, prdId, planId });
  return { buildId, cpId, prdId, planId, packetId };
}

// ---- 1. registry drives role authorisation ------------------------------

gated('1. the registry drives role authorisation — a reviewer can only fill AUTHORISED roles; a new reviewer is added by config, no schema/enum change', async () => {
  const pool = await freshPool();
  try {
    const { packetId, prdId, planId, buildId } = await seedReviewable(pool);

    // fable is authorised ONLY for adversarial_assurance -> product_qa run is rejected (FK).
    let e = await rejects(pool,
      `insert into ops.review_run
         (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'fable','product_qa',$2,$3,$4,$5,now(),'approved')`,
      [packetId, HASH, SHA_A, prdId, planId]);
    assert.equal(e.code, '23503', 'fable cannot fill product_qa (unauthorised role -> FK violation)');

    // gpt_codex IS authorised for product_qa -> accepted.
    await insertRun(pool, { packetId, reviewerKey: 'gpt_codex', role: 'product_qa', prdId, planId });

    // gpt_codex is NOT (yet) authorised for adversarial_assurance -> rejected.
    e = await rejects(pool,
      `insert into ops.review_run
         (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'gpt_codex','adversarial_assurance',$2,$3,$4,$5,now(),'approved')`,
      [packetId, HASH, SHA_A, prdId, planId]);
    assert.equal(e.code, '23503', 'gpt_codex cannot fill an unauthorised role');

    // Grant it by CONFIG (one row) — now it may fill that role. No schema change.
    await pool.query(`insert into ops.reviewer_authorised_role (reviewer_key, review_role) values ('gpt_codex','adversarial_assurance')`);
    await insertRun(pool, { packetId, reviewerKey: 'gpt_codex', role: 'adversarial_assurance', prdId, planId });

    // A brand-NEW reviewer ('grok') is unknown -> its run is rejected until it is registered.
    e = await rejects(pool,
      `insert into ops.review_run
         (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'grok','adversarial_assurance',$2,$3,$4,$5,now(),'approved')`,
      [packetId, HASH, SHA_A, prdId, planId]);
    assert.equal(e.code, '23503', 'an unregistered reviewer cannot fill any role');

    // Register grok by CONFIG (one registry row + one grant) — NO schema/enum change, NO ops.principal edit.
    await pool.query(
      `insert into ops.reviewer_registry (reviewer_key, provider, model, adapter_identity, honest_label)
       values ('grok','xai','grok-latest','adapter://grok','xAI Grok — adversarial reviewer (config-added)')`);
    await pool.query(`insert into ops.reviewer_authorised_role (reviewer_key, review_role) values ('grok','adversarial_assurance')`);
    await insertRun(pool, { packetId, reviewerKey: 'grok', role: 'adversarial_assurance', prdId, planId });

    // Prove grok was NOT added to the ops.principal enum (it stays the closed 001 vocabulary).
    const { rows: en } = await pool.query(
      `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
       join pg_namespace n on n.oid=t.typnamespace where n.nspname='ops' and t.typname='principal' order by enumlabel`);
    const labels = en.map((r) => r.enumlabel);
    assert.ok(!labels.includes('grok'), 'grok must NOT be an ops.principal enum value');
    assert.deepEqual(labels, ['fable', 'gpt_codex', 'larry', 'tower', 'warwick'], 'ops.principal is unchanged');

    // Sanity: three authorised runs landed.
    const { rows } = await pool.query(`select count(*)::int n from ops.review_run where review_packet_id=$1`, [packetId]);
    assert.equal(rows[0].n, 3);
    assert.ok(buildId);
  } finally { await pool.end(); }
});

// ---- 2. review_packet immutability + packet_hash binding ----------------

gated('2. review_packet is immutable once ready/hashed; packet_hash write-once; ready requires hash+payload; illegal transitions rejected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, buildId, SHA_A, 'cp1');
    const prdId = await seedPrd(pool, buildId);
    const planId = await seedPlan(pool, buildId);

    // A packet born 'building' (no hash yet). Mutating payload while building is allowed.
    const { rows: pk } = await pool.query(
      `insert into ops.review_packet (build_id, checkpoint_id, exact_head_sha, base_sha, prd_version_id, plan_version_id, resolved_payload, state)
       values ($1,$2,$3,$4,$5,$6,'{"a":1}'::jsonb,'building') returning id`,
      [buildId, cpId, SHA_A, SHA_C, prdId, planId]);
    const packetId = pk[0].id;
    await pool.query(`update ops.review_packet set resolved_payload='{"a":2}'::jsonb where id=$1`, [packetId]);

    // Transitioning to 'ready' WITHOUT a hash violates the ready-requires-hash CHECK.
    let e = await rejects(pool, `update ops.review_packet set state='ready' where id=$1`, [packetId]);
    assert.equal(e.code, '23514', 'ready without a hash -> check_violation');

    // Transition to ready WITH hash + payload is allowed.
    await pool.query(`update ops.review_packet set state='ready', packet_hash=$2 where id=$1`, [packetId, HASH]);

    // Now hashed/ready: payload, hash and identity are frozen; DELETE rejected.
    e = await rejects(pool, `update ops.review_packet set resolved_payload='{"a":3}'::jsonb where id=$1`, [packetId]);
    assert.equal(e.code, '23001', 'payload immutable once ready');
    e = await rejects(pool, `update ops.review_packet set packet_hash='sha256:other' where id=$1`, [packetId]);
    assert.equal(e.code, '23001', 'packet_hash is write-once');
    // A genuine identity/binding change on a hashed packet is frozen.
    e = await rejects(pool, `update ops.review_packet set exact_head_sha=$2 where id=$1`, [packetId, SHA_B]);
    assert.equal(e.code, '23001', 'exact_head_sha frozen once ready');
    await rejects(pool, `delete from ops.review_packet where id=$1`, [packetId]);

    // Illegal transition ready->building rejected; valid ready->consumed->stale allowed.
    e = await rejects(pool, `update ops.review_packet set state='building' where id=$1`, [packetId]);
    assert.equal(e.code, '23001', 'ready->building is illegal');
    await pool.query(`update ops.review_packet set state='consumed' where id=$1`, [packetId]);
    await pool.query(`update ops.review_packet set state='stale' where id=$1`, [packetId]);

    // A packet cannot be born consumed/stale.
    e = await rejects(pool,
      `insert into ops.review_packet (build_id, checkpoint_id, exact_head_sha, base_sha, resolved_payload, packet_hash, state)
       values ($1,$2,$3,$4,'{}'::jsonb,$5,'consumed')`, [buildId, cpId, SHA_A, SHA_C, HASH]);
    assert.equal(e.code, '23514', 'born-consumed rejected');

    // A blocked packet must state a reason (no silent truncation).
    e = await rejects(pool,
      `insert into ops.review_packet (build_id, checkpoint_id, exact_head_sha, base_sha, state)
       values ($1,$2,$3,$4,'blocked')`, [buildId, cpId, SHA_A, SHA_C]);
    assert.equal(e.code, '23514', 'blocked without a reason rejected');
    await pool.query(
      `insert into ops.review_packet (build_id, checkpoint_id, exact_head_sha, base_sha, state, blocked_reason)
       values ($1,$2,$3,$4,'blocked','mandatory CI evidence unresolvable')`, [buildId, cpId, SHA_A, SHA_C]);

    // A packet bound to a head the checkpoint never recorded is an FK violation.
    e = await rejects(pool,
      `insert into ops.review_packet (build_id, checkpoint_id, exact_head_sha, base_sha, resolved_payload, packet_hash, state)
       values ($1,$2,$3,$4,'{}'::jsonb,$5,'ready')`, [buildId, cpId, SHA_B, SHA_C, HASH]);
    assert.equal(e.code, '23503', 'wrong-head packet -> FK violation');
  } finally { await pool.end(); }
});

// ---- 3. review_run bound to packet_hash + SHA + contract ----------------

gated('3. review_run is bound (composite FK) to packet_hash + exact head + prd/plan versions, and is append-only', async () => {
  const pool = await freshPool();
  try {
    const { packetId, prdId, planId, buildId } = await seedReviewable(pool);
    const otherPrd = await seedPrd(pool, buildId, { key: 'PRD-OTHER' });

    // Wrong packet_hash -> FK violation.
    let e = await rejects(pool,
      `insert into ops.review_run (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'gpt_codex','product_qa','sha256:WRONG',$2,$3,$4,now(),'approved')`, [packetId, SHA_A, prdId, planId]);
    assert.equal(e.code, '23503', 'wrong packet_hash -> FK violation');

    // Wrong head -> FK violation.
    e = await rejects(pool,
      `insert into ops.review_run (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'gpt_codex','product_qa',$2,$3,$4,$5,now(),'approved')`, [packetId, HASH, SHA_B, prdId, planId]);
    assert.equal(e.code, '23503', 'wrong reviewed head -> FK violation');

    // Wrong PRD version -> FK violation.
    e = await rejects(pool,
      `insert into ops.review_run (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, completed_at, outcome)
       values ($1,'gpt_codex','product_qa',$2,$3,$4,$5,now(),'approved')`, [packetId, HASH, SHA_A, otherPrd, planId]);
    assert.equal(e.code, '23503', 'wrong prd_version -> FK violation');

    // completed consistency: approved without completed_at rejected.
    e = await rejects(pool,
      `insert into ops.review_run (review_packet_id, reviewer_key, review_role, packet_hash, reviewed_head_sha, prd_version_id, plan_version_id, outcome)
       values ($1,'gpt_codex','product_qa',$2,$3,$4,$5,'approved')`, [packetId, HASH, SHA_A, prdId, planId]);
    assert.equal(e.code, '23514', 'approved run must carry completed_at');

    // A correct run is accepted, and is append-only.
    await insertRun(pool, { packetId, prdId, planId });
    const { rows: r } = await pool.query(`select id from ops.review_run limit 1`);
    e = await rejects(pool, `update ops.review_run set outcome='blocked' where id=$1`, [r[0].id]);
    assert.equal(e.code, '23001', 'review_run UPDATE rejected (append-only)');
    e = await rejects(pool, `delete from ops.review_run where id=$1`, [r[0].id]);
    assert.equal(e.code, '23001', 'review_run DELETE rejected (append-only)');
  } finally { await pool.end(); }
});

// ---- 4. model-agnostic, risk-tiered readiness ---------------------------

gated('4. role-based readiness: low-risk ready on product_qa alone; adversarial-required blocks until adversarial approves; adversarial-required-but-unavailable is BLOCKED (never silently downgraded)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const prdId = await seedPrd(pool, buildId);
    const planId = await seedPlan(pool, buildId);

    // --- low-risk checkpoint: only product_qa required ---
    const cpLow = await seedCheckpoint(pool, buildId, SHA_A, 'cp-low');
    await seedAssurance(pool, cpLow, buildId, { productQa: true });
    const pkLow = await seedReadyPacket(pool, { buildId, checkpointId: cpLow, sha: SHA_A, prdId, planId, hash: 'h-low' });
    await insertRun(pool, { packetId: pkLow, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_A, prdId, planId, hash: 'h-low' });
    let { rows } = await pool.query(
      `select all_required_roles_satisfied, blocked_reviewer_unavailable from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cpLow]);
    assert.equal(rows[0].all_required_roles_satisfied, true, 'low-risk: merge-ready on product_qa ALONE');
    assert.equal(rows[0].blocked_reviewer_unavailable, false);

    // Prove the OLD 001 both-reviewers rule would BLOCK this same low-risk checkpoint (no verdicts).
    ({ rows } = await pool.query(
      `select both_reviewers_approved_this_head from ops.checkpoint_merge_readiness where checkpoint_id=$1`, [cpLow]));
    assert.equal(rows[0].both_reviewers_approved_this_head, false,
      'the old both-required rule cannot govern a risk-tiered checkpoint (it would block a product_qa-ready one)');

    // --- adversarial-required checkpoint ---
    const cpAdv = await seedCheckpoint(pool, buildId, SHA_B, 'cp-adv');
    await seedAssurance(pool, cpAdv, buildId, { productQa: true, adversarial: true });
    const pkAdv = await seedReadyPacket(pool, { buildId, checkpointId: cpAdv, sha: SHA_B, prdId, planId, hash: 'h-adv' });
    await insertRun(pool, { packetId: pkAdv, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_B, prdId, planId, hash: 'h-adv' });
    ({ rows } = await pool.query(
      `select all_required_roles_satisfied, adversarial_satisfied, blocked_reviewer_unavailable from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cpAdv]));
    assert.equal(rows[0].all_required_roles_satisfied, false, 'adversarial required but not yet reviewed -> not ready');
    assert.equal(rows[0].blocked_reviewer_unavailable, false, 'fable is available -> not a reviewer-unavailable block');

    // Fable (authorised adversarial) approves -> now ready.
    await insertRun(pool, { packetId: pkAdv, reviewerKey: 'fable', role: 'adversarial_assurance', sha: SHA_B, prdId, planId, hash: 'h-adv' });
    ({ rows } = await pool.query(
      `select all_required_roles_satisfied from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cpAdv]));
    assert.equal(rows[0].all_required_roles_satisfied, true, 'adversarial approved -> ready');

    // --- adversarial-required-but-unavailable: disable fable, no other adversarial reviewer ---
    await pool.query(`update ops.reviewer_registry set enabled=false where reviewer_key='fable'`);
    const cpUnavail = await seedCheckpoint(pool, buildId, SHA_C, 'cp-unavail');
    await seedAssurance(pool, cpUnavail, buildId, { productQa: true, adversarial: true });
    const pkU = await seedReadyPacket(pool, { buildId, checkpointId: cpUnavail, sha: SHA_C, prdId, planId, hash: 'h-un' });
    await insertRun(pool, { packetId: pkU, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_C, prdId, planId, hash: 'h-un' });
    ({ rows } = await pool.query(
      `select all_required_roles_satisfied, adversarial_available, blocked_reviewer_unavailable from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cpUnavail]));
    assert.equal(rows[0].adversarial_available, false, 'no ENABLED adversarial reviewer');
    assert.equal(rows[0].blocked_reviewer_unavailable, true, 'adversarial-required-but-unavailable -> BLOCKED');
    assert.equal(rows[0].all_required_roles_satisfied, false, 'NOT silently downgraded to product_qa-only');
  } finally { await pool.end(); }
});

// ---- 5. historical verdicts preserved; old rule cannot govern risk-tier --

gated('5. historical verdicts are preserved + surfaced (not relabelled); the old both-required rule cannot govern a new risk-tiered checkpoint', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const cpHist = await seedCheckpoint(pool, buildId, SHA_A, 'cp-hist');

    // Legacy two-reviewer flow (001): both required verdicts at SHA_A.
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpHist, SHA_A]);
    await pool.query(
      `insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict)
       values ($1,$2,'fable','cold_final','approve')`, [cpHist, SHA_A]);

    // 001's view still governs the legacy checkpoint (both approved).
    let { rows } = await pool.query(
      `select both_reviewers_approved_this_head from ops.checkpoint_merge_readiness where checkpoint_id=$1`, [cpHist]);
    assert.equal(rows[0].both_reviewers_approved_this_head, true, '001 view intact for historical rows');

    // Historical verdict identity is UNTOUCHED, and surfaces via ops.verdict_reviewer registry map.
    ({ rows } = await pool.query(
      `select legacy_principal, registry_reviewer_key, registry_provider from ops.verdict_reviewer where checkpoint_id=$1 order by legacy_principal::text`, [cpHist]));
    assert.equal(rows.length, 2);
    // fable row
    assert.equal(rows[0].legacy_principal, 'fable');
    assert.equal(rows[0].registry_reviewer_key, 'fable', 'fable verdict surfaces its registry identity');
    // gpt_codex row
    assert.equal(rows[1].legacy_principal, 'gpt_codex');
    assert.equal(rows[1].registry_reviewer_key, 'gpt_codex');
    assert.equal(rows[1].registry_provider, 'openai', 'honest provider label preserved');

    // The raw verdict rows are unchanged (no relabel).
    ({ rows } = await pool.query(`select reviewer::text from ops.verdict where checkpoint_id=$1 order by reviewer::text`, [cpHist]));
    assert.deepEqual(rows.map((r) => r.reviewer), ['fable', 'gpt_codex'], 'no historical reviewer identity rewritten');

    // A NEW risk-tiered (low-risk) checkpoint: product_qa only, one approved product_qa run.
    const prdId = await seedPrd(pool, buildId);
    const planId = await seedPlan(pool, buildId);
    const cpRisk = await seedCheckpoint(pool, buildId, SHA_B, 'cp-risk');
    await seedAssurance(pool, cpRisk, buildId, { productQa: true });
    const pkRisk = await seedReadyPacket(pool, { buildId, checkpointId: cpRisk, sha: SHA_B, prdId, planId, hash: 'h-risk' });
    await insertRun(pool, { packetId: pkRisk, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_B, prdId, planId, hash: 'h-risk' });

    // NEW view: ready on product_qa alone.
    ({ rows } = await pool.query(
      `select all_required_roles_satisfied from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cpRisk]));
    assert.equal(rows[0].all_required_roles_satisfied, true, 'risk-tiered: ready on product_qa alone');

    // OLD view over the SAME checkpoint: both-required is false -> the old rule would wrongly block it.
    ({ rows } = await pool.query(
      `select both_reviewers_approved_this_head from ops.checkpoint_merge_readiness where checkpoint_id=$1`, [cpRisk]));
    assert.equal(rows[0].both_reviewers_approved_this_head, false,
      'the old both-required rule cannot govern the risk-tiered checkpoint');
  } finally { await pool.end(); }
});

// ---- 6. idempotency: re-applying 004 is a no-op -------------------------

gated('6. migration 004 is idempotent (double-apply is a no-op)', async () => {
  const pool = await freshPool();
  try {
    await pool.query(fs.readFileSync(MIGRATIONS[3], 'utf8'));
    const { rows: t } = await pool.query(
      `select count(*)::int n from information_schema.tables where table_schema='ops' and table_name in
        ('reviewer_registry','reviewer_authorised_role','checkpoint_assurance','review_packet','review_run','review_run_finding')`);
    assert.equal(t[0].n, 6, 'all six PR-2a tables present after double-apply');
    const { rows: en } = await pool.query(
      `select count(*)::int n from pg_type t join pg_namespace n on n.oid=t.typnamespace
       where n.nspname='ops' and t.typname in ('review_role','packet_state','review_outcome')`);
    assert.equal(en[0].n, 3, 'all three PR-2a enums present');
    // seed rows survived (on conflict do nothing).
    const { rows: rg } = await pool.query(`select count(*)::int n from ops.reviewer_registry`);
    assert.equal(rg[0].n, 2, 'gpt_codex + fable seeded exactly once');
  } finally { await pool.end(); }
});

// ---- 7. catalog fence: every ops function pins search_path ---------------

gated('7. every ops plpgsql/sql function pins search_path (regression fence incl. 004 functions)', async () => {
  const pool = await freshPool();
  try {
    const { rows } = await pool.query(`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'ops'
        and l.lanname in ('plpgsql','sql')
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
          where c like 'search_path=%'
        )`);
    assert.equal(rows.length, 0, `functions without a pinned search_path: ${rows.map((r) => r.proname).join(', ')}`);
  } finally { await pool.end(); }
});

// ---- 8. reviewer_registry identity durability ---------------------------

gated('8. reviewer_registry identity is durable (DELETE rejected; reviewer_key immutable; enable toggle works)', async () => {
  const pool = await freshPool();
  try {
    // DELETE rejected (retire via enabled=false).
    let e = await rejects(pool, `delete from ops.reviewer_registry where reviewer_key='fable'`);
    assert.equal(e.code, '23001', 'reviewer_registry DELETE rejected');

    // reviewer_key immutable.
    e = await rejects(pool, `update ops.reviewer_registry set reviewer_key='codex2' where reviewer_key='gpt_codex'`);
    assert.equal(e.code, '23001', 'reviewer_key is immutable');

    // enabled toggle + honest-label update are allowed (config).
    await pool.query(`update ops.reviewer_registry set enabled=false, notes='parked' where reviewer_key='fable'`);
    const { rows } = await pool.query(`select enabled from ops.reviewer_registry where reviewer_key='fable'`);
    assert.equal(rows[0].enabled, false);

    // principal_alias is unique (one registry row per legacy principal).
    e = await rejects(pool,
      `insert into ops.reviewer_registry (reviewer_key, provider, principal_alias) values ('codex_dup','openai','gpt_codex')`);
    assert.equal(e.code, '23505', 'principal_alias is unique');
  } finally { await pool.end(); }
});

// ---- 9. role-based readiness is INERT / feature-gated OFF by default -----

gated('9. role-based readiness is INERT by default (gate OFF -> legacy both-required governs, unchanged); ON -> role-based governs; adversarial-unavailable stays BLOCKED', async () => {
  const pool = await freshPool();
  try {
    // The flag defaults OFF (deny-by-default; PR-2b flips it).
    let { rows } = await pool.query(`select ops.role_based_readiness_enabled() as on`);
    assert.equal(rows[0].on, false, 'role-based readiness OFF by default');

    const buildId = await seedBuild(pool);
    const prdId = await seedPrd(pool, buildId);
    const planId = await seedPlan(pool, buildId);

    // A low-risk checkpoint the ROLE-BASED view considers ready (product_qa approved).
    const cp = await seedCheckpoint(pool, buildId, SHA_A, 'cp1');
    await seedAssurance(pool, cp, buildId, { productQa: true });
    const pk = await seedReadyPacket(pool, { buildId, checkpointId: cp, sha: SHA_A, prdId, planId, hash: 'h1' });
    await insertRun(pool, { packetId: pk, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_A, prdId, planId, hash: 'h1' });
    ({ rows } = await pool.query(`select all_required_roles_satisfied from ops.checkpoint_role_readiness where checkpoint_id=$1`, [cp]));
    assert.equal(rows[0].all_required_roles_satisfied, true, 'role-based advisory view: ready');

    // (ii) with the gate OFF, the EFFECTIVE (governing) readiness delegates to LEGACY both-required
    // = false. The role-based logic does NOT govern; historical readiness is unchanged.
    ({ rows } = await pool.query(
      `select governing_policy, effective_merge_ready, role_based_all_required_satisfied from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cp]));
    assert.equal(rows[0].governing_policy, 'legacy_both_required', 'legacy policy governs by default');
    assert.equal(rows[0].effective_merge_ready, false, 'role-based does NOT govern while gated OFF');
    assert.equal(rows[0].role_based_all_required_satisfied, true, 'role-based remains computable (advisory) while inert');

    // A LEGACY checkpoint with both verdicts is merge-ready via the unchanged legacy path (gate OFF).
    const cpH = await seedCheckpoint(pool, buildId, SHA_B, 'cpH');
    await pool.query(`insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict) values ($1,$2,'gpt_codex','correction_loop','approve')`, [cpH, SHA_B]);
    await pool.query(`insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict) values ($1,$2,'fable','cold_final','approve')`, [cpH, SHA_B]);
    ({ rows } = await pool.query(`select governing_policy, effective_merge_ready from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cpH]));
    assert.equal(rows[0].governing_policy, 'legacy_both_required');
    assert.equal(rows[0].effective_merge_ready, true, 'legacy both-required still governs + works unchanged (gate OFF)');

    // (i) flip the gate ON (what PR-2b will do) -> role-based governs; the low-risk checkpoint is ready.
    await pool.query(`update ops.feature_flag set enabled=true where flag_key='role_based_readiness'`);
    ({ rows } = await pool.query(`select governing_policy, effective_merge_ready from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cp]));
    assert.equal(rows[0].governing_policy, 'role_based', 'role-based governs when the gate is ON');
    assert.equal(rows[0].effective_merge_ready, true);

    // (iii) adversarial-required-but-unavailable stays BLOCKED under the role-based policy when ON.
    await pool.query(`update ops.reviewer_registry set enabled=false where reviewer_key='fable'`);
    const cpU = await seedCheckpoint(pool, buildId, SHA_C, 'cpU');
    await seedAssurance(pool, cpU, buildId, { productQa: true, adversarial: true });
    const pkU = await seedReadyPacket(pool, { buildId, checkpointId: cpU, sha: SHA_C, prdId, planId, hash: 'hu' });
    await insertRun(pool, { packetId: pkU, reviewerKey: 'gpt_codex', role: 'product_qa', sha: SHA_C, prdId, planId, hash: 'hu' });
    ({ rows } = await pool.query(
      `select effective_merge_ready, role_based_blocked_reviewer_unavailable from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cpU]));
    assert.equal(rows[0].role_based_blocked_reviewer_unavailable, true, 'adversarial-required-but-unavailable -> BLOCKED');
    assert.equal(rows[0].effective_merge_ready, false, 'never silently downgraded to product_qa-only');
  } finally { await pool.end(); }
});
