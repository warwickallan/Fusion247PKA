// BUILD-014 PR-1 — contract & acceptance schema proofs for
// 003_contract_acceptance_schema.sql (applied on top of 001 + 002).
//
// DB-GATED but NOT silently self-skipping (mirrors 001's constraint-invariants.test.js):
//   - DATABASE_URL UNSET  -> skip with a LOUD message pointing at the one-command runner.
//   - DATABASE_URL SET but `pg` missing -> FAIL (throw), never green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: this DROPs and rebuilds
// the `ops` schema on every test.
//
//   node services/control-plane/db/test/run-contract-tests.mjs        # provisions + runs
//   DATABASE_URL=postgres://.../scratch node --test <this file>       # against your own DB
//
// What it proves (the PR-1 hard invariants, as SQL failures/successes):
//   1. acceptance_row / prd / plan IMMUTABILITY (UPDATE + DELETE rejected; prd/plan permit
//      ONLY active->superseded; a version cannot be born superseded).
//   2. acceptance_evidence / acceptance_verification APPEND-ONLY (UPDATE + DELETE rejected).
//   3. BUILDER-principal INSERT into acceptance_verification is REJECTED (reviewer-only:
//      larry/warwick rejected; gpt_codex/fable/tower accepted).
//   4. a HEAD MOVE invalidates a prior verification in current_acceptance_state.
//   5. a PRD SUPERSESSION invalidates a prior verification (contract_stale + current view).
//   6. TRUNCATE guards fire on prd/plan/acceptance_row/acceptance_evidence/acceptance_verification.
//   Plus: exact-SHA + contract binding (composite FKs), reviewer CHECK is non-bypassable,
//   supersede-then-insert version discipline, and a catalog fence that every ops function
//   (incl. the ones 003 adds) pins search_path.

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
].map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the DB-gated ` +
    `proofs. Install pg or use run-contract-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/db/test/run-contract-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  for (const m of MIGRATIONS) await pool.query(fs.readFileSync(m, 'utf8'));
  return pool;
}

/** Assert a query rejects (throws). Returns the error for optional code checks. */
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
     values ($1,$2,$3,'PRD','ref://prd','h1','larry') returning id`,
    [buildId, key, version]);
  return rows[0].id;
}

async function seedPlan(pool, buildId, { key = 'PLAN-A', version = 1 } = {}) {
  const { rows } = await pool.query(
    `insert into ops.plan (build_id, plan_key, version, title, content_ref, content_hash, authored_by)
     values ($1,$2,$3,'Plan','ref://plan','h1','larry') returning id`,
    [buildId, key, version]);
  return rows[0].id;
}

async function seedWp(pool, buildId, planVersionId, ref = 'WP-1') {
  const { rows } = await pool.query(
    `insert into ops.wp (build_id, plan_version_id, wp_ref, title) values ($1,$2,$3,'wp') returning id`,
    [buildId, planVersionId, ref]);
  return rows[0].id;
}

async function seedAcceptanceRow(pool, buildId, prdVersionId, wpId, ref = 'AC-01') {
  const { rows } = await pool.query(
    `insert into ops.acceptance_row (build_id, prd_version_id, acceptance_ref, requirement_text, owning_wp_id, expected_proof, impl_path)
     values ($1,$2,$3,'the thing works',$4,'a passing test','src/x.js') returning id`,
    [buildId, prdVersionId, ref, wpId]);
  return rows[0].id;
}

/** Insert a reviewer verification. reviewer defaults to a valid reviewer principal. */
async function insertVerification(pool, {
  acceptanceRowId, checkpointId, reviewer = 'gpt_codex', result = 'pass',
  sha = SHA_A, prdVersionId, planVersionId,
}) {
  return pool.query(
    `insert into ops.acceptance_verification
       (acceptance_row_id, checkpoint_id, reviewer, result, rationale, exact_sha, prd_version_id, plan_version_id)
     values ($1,$2,$3,$4,'ok',$5,$6,$7)`,
    [acceptanceRowId, checkpointId, reviewer, result, sha, prdVersionId, planVersionId]);
}

/** A fully wired build with head authority at SHA_A and one acceptance row. */
async function seedVerifiableBuild(pool) {
  const buildId = await seedBuild(pool);
  const cpId = await seedCheckpoint(pool, buildId, SHA_A, 'cp1');
  // Make SHA_A the authoritative current head (002).
  await pool.query(`select ops.advance_build_head($1,$2,$3)`, [buildId, cpId, SHA_A]);
  const prdId = await seedPrd(pool, buildId);
  const planId = await seedPlan(pool, buildId);
  const wpId = await seedWp(pool, buildId, planId);
  const arId = await seedAcceptanceRow(pool, buildId, prdId, wpId);
  return { buildId, cpId, prdId, planId, wpId, arId };
}

// ---- 1. immutability of acceptance_row / prd / plan ---------------------

gated('1. acceptance_row / prd / plan are immutable (UPDATE+DELETE rejected; prd/plan only active->superseded)', async () => {
  const pool = await freshPool();
  try {
    const { arId, prdId, planId, buildId } = await seedVerifiableBuild(pool);

    // acceptance_row: no UPDATE, no DELETE.
    let e = await rejects(pool, `update ops.acceptance_row set requirement_text='x' where id=$1`, [arId]);
    assert.equal(e.code, '23001', 'acceptance_row UPDATE -> restrict_violation');
    e = await rejects(pool, `delete from ops.acceptance_row where id=$1`, [arId]);
    assert.equal(e.code, '23001', 'acceptance_row DELETE -> restrict_violation');

    // prd: a content change is rejected; DELETE rejected.
    e = await rejects(pool, `update ops.prd set content_ref='y' where id=$1`, [prdId]);
    assert.equal(e.code, '23001', 'prd content UPDATE -> restrict_violation');
    await rejects(pool, `delete from ops.prd where id=$1`, [prdId]);

    // prd: the ONLY permitted transition is active->superseded, and superseded_at is forced.
    await pool.query(`update ops.prd set state='superseded' where id=$1`, [prdId]);
    const { rows: pr } = await pool.query(`select state, superseded_at from ops.prd where id=$1`, [prdId]);
    assert.equal(pr[0].state, 'superseded');
    assert.ok(pr[0].superseded_at, 'superseded_at forced by guard');
    // a superseded prd cannot flip back.
    await rejects(pool, `update ops.prd set state='active', superseded_at=null where id=$1`, [prdId]);

    // plan: a version cannot be born superseded.
    e = await rejects(pool,
      `insert into ops.plan (build_id, plan_key, version, state, superseded_at) values ($1,'PLAN-Z',1,'superseded',now())`,
      [buildId]);
    assert.equal(e.code, '23514', 'plan born-superseded -> check_violation');
    // plan active->superseded works.
    await pool.query(`update ops.plan set state='superseded' where id=$1`, [planId]);
    const { rows: pl } = await pool.query(`select state from ops.plan where id=$1`, [planId]);
    assert.equal(pl[0].state, 'superseded');
  } finally { await pool.end(); }
});

// ---- 2. append-only evidence + verification -----------------------------

gated('2. acceptance_evidence + acceptance_verification are append-only (UPDATE+DELETE rejected)', async () => {
  const pool = await freshPool();
  try {
    const { arId, cpId, prdId, planId } = await seedVerifiableBuild(pool);

    // evidence (builder claim — submitted_by may be the builder).
    const { rows: ev } = await pool.query(
      `insert into ops.acceptance_evidence (acceptance_row_id, checkpoint_id, submitted_by, evidence_type, evidence_ref, exact_sha)
       values ($1,$2,'larry','test','ref://run',$3) returning id`, [arId, cpId, SHA_A]);
    let e = await rejects(pool, `update ops.acceptance_evidence set evidence_ref='z' where id=$1`, [ev[0].id]);
    assert.equal(e.code, '23001', 'evidence UPDATE -> restrict_violation');
    e = await rejects(pool, `delete from ops.acceptance_evidence where id=$1`, [ev[0].id]);
    assert.equal(e.code, '23001', 'evidence DELETE -> restrict_violation');

    // verification (reviewer).
    await insertVerification(pool, { acceptanceRowId: arId, checkpointId: cpId, prdVersionId: prdId, planVersionId: planId });
    const { rows: v } = await pool.query(`select id from ops.acceptance_verification limit 1`);
    e = await rejects(pool, `update ops.acceptance_verification set result='fail' where id=$1`, [v[0].id]);
    assert.equal(e.code, '23001', 'verification UPDATE -> restrict_violation');
    e = await rejects(pool, `delete from ops.acceptance_verification where id=$1`, [v[0].id]);
    assert.equal(e.code, '23001', 'verification DELETE -> restrict_violation');

    // exact-SHA binding: a verification for a head the checkpoint never recorded is an FK violation.
    e = await rejects(pool,
      `insert into ops.acceptance_verification
         (acceptance_row_id, checkpoint_id, reviewer, result, exact_sha, prd_version_id, plan_version_id)
       values ($1,$2,'fable','pass',$3,$4,$5)`, [arId, cpId, SHA_B, prdId, planId]);
    assert.equal(e.code, '23503', 'wrong-head verification -> FK violation');
  } finally { await pool.end(); }
});

// ---- 3. builder cannot verify (reviewer-only) ---------------------------

gated('3. builder-principal INSERT into acceptance_verification is REJECTED (reviewer-only)', async () => {
  const pool = await freshPool();
  try {
    const { arId, cpId, prdId, planId } = await seedVerifiableBuild(pool);

    // larry (builder) and warwick are NOT reviewer principals -> rejected.
    for (const who of ['larry', 'warwick']) {
      const e = await rejects(pool,
        `insert into ops.acceptance_verification
           (acceptance_row_id, checkpoint_id, reviewer, result, exact_sha, prd_version_id, plan_version_id)
         values ($1,$2,$3,'pass',$4,$5,$6)`, [arId, cpId, who, SHA_A, prdId, planId]);
      assert.ok(['23001', '23514'].includes(e.code), `${who} rejected by trigger(23001)/CHECK(23514), got ${e.code}`);
    }

    // The non-bypassable CHECK is present even if the trigger is disabled: prove larry is
    // STILL rejected with the reviewer-only trigger turned off (session_replication_role does
    // not bypass CHECK constraints — this is why reviewer-only is a CHECK, not only a trigger).
    const client = await pool.connect();
    try {
      await client.query(`alter table ops.acceptance_verification disable trigger acceptance_verification_reviewer_only`);
      const e = await rejectsClient(client,
        `insert into ops.acceptance_verification
           (acceptance_row_id, checkpoint_id, reviewer, result, exact_sha, prd_version_id, plan_version_id)
         values ($1,$2,'larry','pass',$3,$4,$5)`, [arId, cpId, SHA_A, prdId, planId]);
      assert.equal(e.code, '23514', 'CHECK still rejects larry with the trigger disabled');
      await client.query(`alter table ops.acceptance_verification enable trigger acceptance_verification_reviewer_only`);
    } finally { client.release(); }

    // Each reviewer principal IS accepted.
    for (const who of ['gpt_codex', 'fable', 'tower']) {
      await insertVerification(pool, {
        acceptanceRowId: arId, checkpointId: cpId, reviewer: who, prdVersionId: prdId, planVersionId: planId,
      });
    }
    const { rows } = await pool.query(`select count(*)::int as n from ops.acceptance_verification`);
    assert.equal(rows[0].n, 3, 'three reviewer verifications accepted');
  } finally { await pool.end(); }
});

async function rejectsClient(client, sql, params) {
  let err = null;
  try { await client.query(sql, params); } catch (e) { err = e; }
  assert.ok(err, `expected rejection for: ${sql}`);
  return err;
}

// ---- 4. head move invalidates a prior verification ----------------------

gated('4. a HEAD MOVE invalidates a prior verification in current_acceptance_state', async () => {
  const pool = await freshPool();
  try {
    const { buildId, arId, cpId, prdId, planId } = await seedVerifiableBuild(pool);

    // Reviewer verifies at the current head (SHA_A).
    await insertVerification(pool, {
      acceptanceRowId: arId, checkpointId: cpId, reviewer: 'gpt_codex', result: 'pass',
      sha: SHA_A, prdVersionId: prdId, planVersionId: planId,
    });
    let { rows } = await pool.query(
      `select is_currently_verified, is_currently_passed, current_result from ops.current_acceptance_state where acceptance_row_id=$1`, [arId]);
    assert.equal(rows[0].is_currently_verified, true, 'verified at current head');
    assert.equal(rows[0].is_currently_passed, true);
    assert.equal(rows[0].current_result, 'pass');

    // Move the head: a NEW checkpoint at SHA_B becomes the authoritative current head.
    const cp2 = await seedCheckpoint(pool, buildId, SHA_B, 'cp2');
    await pool.query(`select ops.advance_build_head($1,$2,$3)`, [buildId, cp2, SHA_B]);

    // The old (SHA_A) verification no longer counts — the requirement reverts to unverified.
    ({ rows } = await pool.query(
      `select is_currently_verified, verification_id from ops.current_acceptance_state where acceptance_row_id=$1`, [arId]));
    assert.equal(rows[0].is_currently_verified, false, 'head move invalidated the prior verification');
    assert.equal(rows[0].verification_id, null);

    // Re-verifying at the NEW head restores it.
    await insertVerification(pool, {
      acceptanceRowId: arId, checkpointId: cp2, reviewer: 'gpt_codex', result: 'pass',
      sha: SHA_B, prdVersionId: prdId, planVersionId: planId,
    });
    ({ rows } = await pool.query(
      `select is_currently_verified from ops.current_acceptance_state where acceptance_row_id=$1`, [arId]));
    assert.equal(rows[0].is_currently_verified, true, 're-verified at the new head');
  } finally { await pool.end(); }
});

// ---- 5. PRD supersession invalidates a prior verification ---------------

gated('5. a PRD SUPERSESSION invalidates a prior verification (contract_stale + current view)', async () => {
  const pool = await freshPool();
  try {
    const { buildId, arId, cpId, prdId, planId } = await seedVerifiableBuild(pool);

    await insertVerification(pool, {
      acceptanceRowId: arId, checkpointId: cpId, reviewer: 'fable', result: 'pass',
      sha: SHA_A, prdVersionId: prdId, planVersionId: planId,
    });
    let { rows } = await pool.query(
      `select is_currently_verified from ops.current_acceptance_state where acceptance_row_id=$1`, [arId]);
    assert.equal(rows[0].is_currently_verified, true, 'verified against active PRD v1');

    // contract_stale reports NOT stale while the contract is active.
    ({ rows } = await pool.query(`select contract_stale, prd_superseded from ops.contract_stale where acceptance_row_id=$1`, [arId]));
    assert.equal(rows[0].contract_stale, false);

    // Supersede PRD v1 -> v2 in ONE transaction (supersede-then-insert is the only path).
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`update ops.prd set state='superseded' where id=$1`, [prdId]);
      await client.query(
        `insert into ops.prd (build_id, prd_key, version, supersedes_id, title, content_ref, content_hash, authored_by)
         values ($1,'PRD-A',2,$2,'PRD v2','ref://prd2','h2','larry')`, [buildId, prdId]);
      await client.query('commit');
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }

    // The prior verification (bound to the now-superseded PRD v1) no longer counts.
    ({ rows } = await pool.query(
      `select is_currently_verified from ops.current_acceptance_state where acceptance_row_id=$1`, [arId]));
    assert.equal(rows[0].is_currently_verified, false, 'PRD supersession invalidated the prior verification');

    // contract_stale now reports the verification's contract as stale.
    ({ rows } = await pool.query(`select contract_stale, prd_superseded from ops.contract_stale where acceptance_row_id=$1`, [arId]));
    assert.equal(rows[0].prd_superseded, true);
    assert.equal(rows[0].contract_stale, true);
  } finally { await pool.end(); }
});

// ---- 5b. supersede-then-insert discipline (partial-unique-active) -------

gated('5b. two ACTIVE PRD versions per key cannot co-exist (supersede-then-insert only)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    await seedPrd(pool, buildId, { key: 'PRD-A', version: 1 });
    // A second ACTIVE version of the same key without superseding the first -> 23505.
    const e = await rejects(pool,
      `insert into ops.prd (build_id, prd_key, version, title) values ($1,'PRD-A',2,'v2')`, [buildId]);
    assert.equal(e.code, '23505', 'a second active version for the same key is rejected');
  } finally { await pool.end(); }
});

// ---- 6. TRUNCATE guards -------------------------------------------------

gated('6. TRUNCATE guards fire on prd/plan/acceptance_row/acceptance_evidence/acceptance_verification', async () => {
  const pool = await freshPool();
  try {
    await seedVerifiableBuild(pool);
    // A bare TRUNCATE is REJECTED on every one. For an FK-REFERENCED table (prd/plan/
    // acceptance_row) Postgres refuses with 0A000 (feature_not_supported) BEFORE the BEFORE
    // TRUNCATE trigger even fires — exactly as 001 documents for `checkpoint`. The
    // non-referenced claim tables (acceptance_evidence/acceptance_verification) hit the guard
    // trigger and surface 23001. Either way TRUNCATE cannot proceed.
    for (const t of ['prd', 'plan', 'acceptance_row', 'acceptance_evidence', 'acceptance_verification']) {
      const e = await rejects(pool, `truncate ops.${t}`);
      assert.ok(['23001', '0A000'].includes(e.code), `TRUNCATE ops.${t} rejected (got ${e.code}); expected trigger 23001 or FK-refusal 0A000`);
    }
    // Prove the GUARD TRIGGER itself fires (not merely the FK refusal): a CASCADE truncate of
    // an FK-referenced table gets past the FK refusal and reaches the BEFORE TRUNCATE trigger,
    // which rejects with 23001.
    const e = await rejects(pool, `truncate ops.prd cascade`);
    assert.equal(e.code, '23001', 'TRUNCATE ops.prd CASCADE hits the guard trigger (restrict_violation)');
  } finally { await pool.end(); }
});

// ---- 7. contract binding: verification must cite the row's PRD version ---

gated('7. a verification citing a DIFFERENT prd_version than the acceptance_row is rejected (composite FK)', async () => {
  const pool = await freshPool();
  try {
    const { buildId, arId, cpId, prdId, planId } = await seedVerifiableBuild(pool);
    // A second, unrelated active PRD (different key) — a valid prd row, but NOT this row's version.
    const otherPrd = await seedPrd(pool, buildId, { key: 'PRD-OTHER', version: 1 });
    const e = await rejects(pool,
      `insert into ops.acceptance_verification
         (acceptance_row_id, checkpoint_id, reviewer, result, exact_sha, prd_version_id, plan_version_id)
       values ($1,$2,'gpt_codex','pass',$3,$4,$5)`, [arId, cpId, SHA_A, otherPrd, planId]);
    assert.equal(e.code, '23503', 'verification must cite the acceptance_row\'s own PRD version');
  } finally { await pool.end(); }
});

// ---- 8. normalised finding + acceptance_finding join --------------------

gated('8. finding is normalised, closes with a resolution, and links to acceptance rows (no array drift)', async () => {
  const pool = await freshPool();
  try {
    const { buildId, arId } = await seedVerifiableBuild(pool);
    const { rows: f } = await pool.query(
      `insert into ops.finding (build_id, finding_ref, opened_by, title, severity, reachability)
       values ($1,'F-1','gpt_codex','x','high','reachable') returning id`, [buildId]);
    const fid = f[0].id;

    // An OPEN finding must be unresolved: closing without a resolution violates the CHECK.
    let e = await rejects(pool, `update ops.finding set state='closed' where id=$1`, [fid]);
    assert.equal(e.code, '23514', 'closed finding needs a resolution disposition');
    // Closing WITH a disposition works (authority re-triage).
    await pool.query(`update ops.finding set state='closed', disposition='fixed' where id=$1`, [fid]);

    // Identity/authority is frozen; DELETE is rejected.
    e = await rejects(pool, `update ops.finding set opened_by='fable' where id=$1`, [fid]);
    assert.equal(e.code, '23001', 'finding opened_by is immutable');
    await rejects(pool, `delete from ops.finding where id=$1`, [fid]);

    // Many-to-many link replaces open_finding_ids[].
    await pool.query(
      `insert into ops.acceptance_finding (acceptance_row_id, finding_id, linked_by) values ($1,$2,'tower')`, [arId, fid]);
    const { rows } = await pool.query(
      `select count(*)::int as n from ops.acceptance_finding where acceptance_row_id=$1 and finding_id=$2`, [arId, fid]);
    assert.equal(rows[0].n, 1);
  } finally { await pool.end(); }
});

// ---- 9. catalog fence: every ops function pins search_path --------------

gated('9. every ops plpgsql/sql function pins search_path (regression fence incl. 003 functions)', async () => {
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

// ---- 10. idempotency: re-applying 003 is a no-op ------------------------

gated('10. migration 003 is idempotent (double-apply is a no-op)', async () => {
  const pool = await freshPool();
  try {
    // freshPool already applied 001+002+003 once; apply 003 again — must not throw.
    await pool.query(fs.readFileSync(MIGRATIONS[2], 'utf8'));
    const { rows } = await pool.query(
      `select count(*)::int as n from information_schema.tables where table_schema='ops' and table_name in
        ('prd','plan','wp','pr','acceptance_row','acceptance_evidence','acceptance_verification','finding','acceptance_finding')`);
    assert.equal(rows[0].n, 9, 'all nine PR-1 tables present after double-apply');
  } finally { await pool.end(); }
});
