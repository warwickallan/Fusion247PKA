// BUILD-014 PR-2b — Tower runtime proofs (packet-builder + reviewHandler refactor + risk-routing +
// versioned product-QA prompt + feature-gated readiness). Applied on 001+002+003+004.
//
// DB-GATED but NOT silently self-skipping (mirrors the sibling suites):
//   node services/control-plane/review/test/run-runtime-tests.mjs        # provisions + runs
//   DATABASE_URL=postgres://.../scratch node --test <this file>          # against your own DB
//
// Proves (executed, as real DB writes + JS assertions):
//   1. PACKET-BUILDER: both reviewers get the SAME packet_hash; resolved-payload persisted + hash
//      matches; remove a required source -> BLOCKED (no silent truncation) + no review_runs;
//      truncated diff -> BLOCKED.
//   2. HANDLER: review_run written with prompt version+fingerprint + honest registry identity;
//      head-attestation downgrade (signed head != checkpoint head -> outcome blocked).
//   3. RISK-ROUTING: low-risk -> product_qa only; autonomous-command diff -> product_qa+adversarial
//      +Warwick gate (both reviewers run, same packet_hash); adversarial-required-but-unavailable
//      -> BLOCKED (never silent product_qa-only).
//   4. PRODUCT-QA: an unmet ordinary acceptance criterion is surfaced BEFORE an exotic defect
//      (acceptance-first orientation wired); the runtime stages the REAL versioned prompt, not the
//      legacy thin skill; ALL prior open findings are injected (explicit consumption).
//   5. READINESS: flag ON -> role-based governs; flag OFF (default) -> legacy both-required governs
//      (historical readiness unchanged).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeSignedVerdict } from '../envelope.mjs';
import { createPacketBuilder, packetHash } from '../packetBuilder.mjs';
import { loadProductQaPrompt, DEFAULT_APPROVED_SKILL_PATH, DEFAULT_ORIENTATION_PATH } from '../productQaPrompt.mjs';
import { deriveDiffSurfaces, computeAssurance } from '../riskRouting.mjs';
import { runTowerReview } from '../towerReview.mjs';
import { createReviewHandler } from '../reviewHandler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const MIGRATIONS = [
  '001_control_plane_min_schema.sql',
  '002_current_head_authority.sql',
  '003_contract_acceptance_schema.sql',
  '004_reviewer_registry_and_packet.sql',
  '006_finding_required_disposition.sql', // typed required_disposition merge lever + readiness consume it
].map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;

const SHA_HEAD = 'a'.repeat(40);
const SHA_BASE = 'b'.repeat(40);
const SHA_WRONG = 'c'.repeat(40);
const SHA_HEAD2 = 'd'.repeat(40);
const SILENT = { warn() {}, info() {} };
const BENIGN_DIFF = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.diff'), 'utf8');
const AUTONOMOUS_DIFF = [
  'diff --git a/src/runner.mjs b/src/runner.mjs',
  '--- a/src/runner.mjs',
  '+++ b/src/runner.mjs',
  '@@ -1,2 +1,6 @@',
  "+import { spawn } from 'node:child_process';",
  "+export function runAgent(cmd, args) {",
  "+  return spawn(cmd, args, { shell: false });",
  '+}',
].join('\n');

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }
if (DB && !Pool) {
  throw new Error(`DATABASE_URL is set but 'pg' failed to load: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/review/test/run-runtime-tests.mjs — a skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  for (const m of MIGRATIONS) await pool.query(fs.readFileSync(m, 'utf8'));
  return pool;
}

// ---- seeds ---------------------------------------------------------------
async function seedBuild(pool) {
  const { rows } = await pool.query(
    `insert into ops.build (build_ref, repo) values ($1,$2) returning id, build_ref, repo`,
    [`BUILD-014-${Math.random().toString(36).slice(2)}`, 'warwickallan/Fusion247PKA']);
  return rows[0];
}
async function seedCheckpoint(pool, buildId, sha = SHA_HEAD, ref = 'cp1', branch = 'build-014/x') {
  const { rows } = await pool.query(
    `insert into ops.checkpoint (build_id, checkpoint_ref, head_sha, branch, brief_ref)
     values ($1,$2,$3,$4,'brief://b') returning id`, [buildId, ref, sha, branch]);
  return rows[0].id;
}
async function seedPrd(pool, buildId) {
  const { rows } = await pool.query(
    `insert into ops.prd (build_id, prd_key, version, title, content_ref, content_hash, authored_by)
     values ($1,'PRD-A',1,'PRD','ref://prd','h1','larry') returning id`, [buildId]);
  return rows[0].id;
}
async function seedPlan(pool, buildId) {
  const { rows } = await pool.query(
    `insert into ops.plan (build_id, plan_key, version, title, content_ref, content_hash, authored_by)
     values ($1,'PLAN-A',1,'Plan','ref://plan','h1','larry') returning id`, [buildId]);
  return rows[0].id;
}
async function seedAcceptance(pool, buildId, prdId, ref, text, expectedProof) {
  const { rows } = await pool.query(
    `insert into ops.acceptance_row (build_id, prd_version_id, acceptance_ref, requirement_text, expected_proof)
     values ($1,$2,$3,$4,$5) returning id`, [buildId, prdId, ref, text, expectedProof]);
  return rows[0].id;
}
async function seedOpenFinding(pool, buildId, ref, title) {
  const { rows } = await pool.query(
    `insert into ops.finding (build_id, finding_ref, opened_by, title, severity, disposition, state)
     values ($1,$2,'gpt_codex',$3,'medium','unresolved','open') returning id`, [buildId, ref, title]);
  return rows[0].id;
}
/** A build with PRD+Plan+2 acceptance rows (AC-01 met, AC-02 unmet) + 1 open finding. */
async function seedReviewable(pool, { sha = SHA_HEAD, ref = 'cp1' } = {}) {
  const build = await seedBuild(pool);
  const cpId = await seedCheckpoint(pool, build.id, sha, ref);
  const prdId = await seedPrd(pool, build.id);
  const planId = await seedPlan(pool, build.id);
  await seedAcceptance(pool, build.id, prdId, 'AC-01', 'Dedupe adjacent duplicate lines', 'dedupeAdjacent');
  await seedAcceptance(pool, build.id, prdId, 'AC-02', 'Reflow to a max column width', 'reflowToWidth');
  const findingId = await seedOpenFinding(pool, build.id, 'F-100', 'earlier reflow off-by-one');
  return { build, cpId, prdId, planId, findingId };
}

// ---- injectable evidence (read-only git seam) ----------------------------
function gitFake({ base = SHA_BASE, diffText = BENIGN_DIFF, changedFiles = ['src/tubeair/reflow.mjs', 'test/reflow.test.js'], truncated = false, ok = true } = {}) {
  return {
    resolveGit: async ({ headSha }) => ok
      ? { ok: true, baseSha: base, headSha, diffRange: `${base}..${headSha}`, changedFiles, diffText, truncated, ci: { conclusion: 'success' } }
      : { ok: false, error: 'git unreachable' },
  };
}

// ---- fake reviewers (the injectable adapter seam) ------------------------
// A COMPLIANT reviewer emits the fail-closed machine-readable answers the runtime now requires: a
// result for EVERY staged acceptance criterion, a disposition for EVERY staged prior open finding, and
// three-axis-classified findings. Built from the packet the runtime hands the adapter (acceptance_rows
// + open_findings), so the fakes model an honest reviewer instead of hiding answers in `summary`.
function compliantAnswers(packet, { accResult = 'pass', extraFindings = [], skipFindingRefs = [] } = {}) {
  const acceptance_results = (packet.acceptance_rows ?? []).map((a) => ({
    acceptance_row_id: a.acceptance_ref,
    result: accResult,
    rationale: 'verified against the staged diff',
    evidence: a.expected_proof ?? 'n/a',
  }));
  const prior_finding_results = (packet.open_findings ?? [])
    .filter((f) => !skipFindingRefs.includes(f.finding_ref))
    .map((f) => ({ finding_id: f.finding_ref, status: 'remains_open', rationale: 'unchanged by this diff; still tracked' }));
  return { acceptance_results, prior_finding_results, findings: extraFindings };
}

function fakeReviewer({ principal, provider, verdict = 'approve', reviewedHead = null, blocked = false }) {
  return {
    principal,
    lastSkillText: null,
    async runTurn({ packet, skillText }) {
      this.lastSkillText = skillText;
      const head = reviewedHead ?? packet.head_sha;
      const payload = blocked
        ? { status: 'blocked', kind: 'forced', proposed_action: { type: 'noop', target: '' } }
        : { status: 'ok', verdict, summary: 'fake', claims_verified: [], ...compliantAnswers(packet), proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal, provider, modelId: 'fake', reviewedHead: head, payload }, null);
      if (blocked) return { ok: false, blocked: true, signerPrincipal: principal, structuredResult: payload, envelope, signature, error: 'forced' };
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}
const codex = (opts = {}) => fakeReviewer({ principal: 'gpt_codex', provider: 'openai-codex', ...opts });
const fable = (opts = {}) => fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', ...opts });

// A reviewer that returns arbitrary three-axis-classified findings (auto-disposing every prior open
// finding + passing every acceptance) — used to prove the DISPOSITION-drives-merge rule + idempotency.
function classifyingReviewer({ principal = 'gpt_codex', provider = 'openai-codex', verdict = 'approve', findings = [], accResult = 'pass' } = {}) {
  return {
    principal,
    lastSkillText: null,
    async runTurn({ packet, skillText }) {
      this.lastSkillText = skillText;
      const head = packet.head_sha;
      const payload = { status: 'ok', verdict, summary: 'classified review', claims_verified: [], ...compliantAnswers(packet, { accResult, extraFindings: findings }), proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal, provider, modelId: 'fake', reviewedHead: head, payload }, null);
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}

// A reviewer that can be told to SKIP disposing certain prior findings (to prove fail-closed on an
// omitted disposition) and/or to OPEN a new classified finding (round-1 of the two-round proof).
function disposingReviewer({ principal = 'gpt_codex', provider = 'openai-codex', verdict = 'approve', skipRefs = [], newFindingId = null, newFindingDisposition = 'REQUIRED_BEFORE_LIVE' } = {}) {
  return {
    principal,
    lastSkillText: null,
    async runTurn({ packet, skillText }) {
      this.lastSkillText = skillText;
      const head = packet.head_sha;
      const findings = newFindingId ? [{
        id: newFindingId, technical_impact: 'HIGH', reachability: 'LATENT', required_disposition: newFindingDisposition,
        assumed_deployment_baseline: 'DEV control-plane; no live-apply wired', evidence: 'opened this round', required_correction: 'address before live',
      }] : [];
      const payload = { status: 'ok', verdict, summary: 'disposing review', claims_verified: [], ...compliantAnswers(packet, { extraFindings: findings, skipFindingRefs: skipRefs }), proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal, provider, modelId: 'fake', reviewedHead: head, payload }, null);
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}

// A reviewer that FOLLOWS the acceptance-first prompt: it parses the staged ACCEPTANCE CRITERIA
// block, reports the FIRST unmet ordinary acceptance criterion (expected-proof marker absent from
// the staged diff) BEFORE an exotic edge-case finding. This proves the QA-not-pentest orientation
// is wired into the prompt, not merely requested.
function acceptanceFollowingCodex() {
  return {
    principal: 'gpt_codex',
    lastSkillText: null,
    async runTurn({ packet, skillText }) {
      this.lastSkillText = skillText;
      const head = packet.head_sha;
      // The injected evidence block is ALWAYS appended last, so key on the LAST marker (the
      // orientation prose also mentions the phrase, which is the first occurrence).
      const start = skillText.lastIndexOf('ACCEPTANCE CRITERIA');
      const afterAcc = start >= 0 ? skillText.slice(start) : '';
      const accBlock = afterAcc.split('PRIOR OPEN FINDINGS')[0] ?? '';
      const lines = accBlock.split(/\r?\n/).filter((l) => /^\s*- \[/.test(l));
      const diff = packet.diff_text ?? '';
      const baseline = 'current authorised deployment: DEV control-plane; no live-apply wired';
      const findings = [];
      for (const line of lines) {
        const ref = (line.match(/\[([^\]]+)\]/) || [])[1];
        const proof = (line.match(/expected proof:\s*([^)]+)\)/) || [])[1]?.trim();
        if (ref && proof && !diff.includes(proof)) {
          // An unmet ORDINARY acceptance criterion breaches acceptance -> BLOCKS_CURRENT_MERGE.
          findings.push({
            id: ref, technical_impact: 'HIGH', reachability: 'ACTIVE', required_disposition: 'BLOCKS_CURRENT_MERGE',
            assumed_deployment_baseline: baseline, evidence: `acceptance ${ref} unmet — ${proof} absent from staged diff`,
            required_correction: `implement ${proof}`,
          });
        }
      }
      // Only AFTER acceptance do we add an exotic/perimeter observation (non-blocking, HYPOTHETICAL).
      findings.push({
        id: 'EXOTIC-1', technical_impact: 'LOW', reachability: 'HYPOTHETICAL', required_disposition: 'NOTE_ONLY',
        assumed_deployment_baseline: baseline, evidence: 'hypothetical race under concurrent reflow', required_correction: 'optional guard',
      });
      const acceptance_results = (packet.acceptance_rows ?? []).map((a) => ({
        acceptance_row_id: a.acceptance_ref,
        result: (a.expected_proof && !diff.includes(a.expected_proof)) ? 'fail' : 'pass',
        rationale: 'checked against the staged diff', evidence: a.expected_proof ?? 'n/a',
      }));
      const prior_finding_results = (packet.open_findings ?? []).map((f) => ({ finding_id: f.finding_ref, status: 'remains_open', rationale: 'unchanged by this diff' }));
      const verdict = findings.some((f) => /^AC-/.test(f.id)) ? 'request_changes' : 'approve';
      const payload = { status: 'ok', verdict, summary: 'acceptance-first review', claims_verified: [], acceptance_results, prior_finding_results, findings, proposed_action: { type: 'post_review', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal: 'gpt_codex', provider: 'openai-codex', modelId: 'fake', reviewedHead: head, payload }, null);
      return { ok: true, blocked: false, signerPrincipal: 'gpt_codex', structuredResult: payload, envelope, signature };
    },
  };
}

function loadPrompt() {
  const p = loadProductQaPrompt();
  assert.equal(p.ok, true, `product-QA prompt must load: ${p.error ?? ''}`);
  return p;
}

async function runsForCheckpoint(pool, cpId) {
  const { rows } = await pool.query(
    `select r.reviewer_key, r.review_role::text as role, r.outcome::text as outcome, r.prompt_version,
            r.prompt_fingerprint, r.packet_hash, r.model_provider, r.reviewed_head_sha
       from ops.review_run r join ops.review_packet p on p.id = r.review_packet_id
      where p.checkpoint_id = $1 order by r.review_role`, [cpId]);
  return rows;
}

// ==========================================================================
// 1. PACKET-BUILDER
// ==========================================================================
gated('1a. packet-builder resolves + persists a hashed immutable payload; hash matches recompute', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const packet = await pb.buildPacket({ checkpointId: cpId });
    assert.equal(packet.state, 'ready');
    assert.ok(packet.packetHash.startsWith('sha256:'));
    // resolved payload persisted + hash matches a recompute over the stored payload.
    const { rows } = await pool.query(`select resolved_payload, packet_hash, exact_head_sha, base_sha from ops.review_packet where id=$1`, [packet.packetId]);
    assert.equal(rows[0].packet_hash, packet.packetHash);
    assert.equal(rows[0].exact_head_sha, SHA_HEAD);
    assert.equal(rows[0].base_sha, SHA_BASE);
    assert.equal(packetHash(rows[0].resolved_payload), packet.packetHash, 'persisted resolved_payload re-hashes to packet_hash');
    // ALL prior open findings resolved into the payload (explicit consumption evidence).
    assert.equal(rows[0].resolved_payload.open_findings.length, 1);
    assert.equal(rows[0].resolved_payload.acceptance_rows.length, 2);
    assert.ok(build.id);
  } finally { await pool.end(); }
});

gated('1b. both reviewers receive the SAME packet_hash (one evidence set, two prompts)', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    // autonomous diff -> adversarial required -> BOTH reviewers run against the one packet.
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake({ diffText: AUTONOMOUS_DIFF, changedFiles: ['src/runner.mjs'] }), log: SILENT });
    const res = await runTowerReview({
      pool, checkpointId: cpId, reviewers: [codex(), fable()], packetBuilder: pb,
      productQaPrompt: loadPrompt(), evidenceSources: gitFake({ diffText: AUTONOMOUS_DIFF, changedFiles: ['src/runner.mjs'] }), log: SILENT });
    assert.equal(res.outcome, 'REVIEWED');
    const runs = await runsForCheckpoint(pool, cpId);
    assert.equal(runs.length, 2, 'product_qa + adversarial both ran');
    assert.equal(runs[0].packet_hash, runs[1].packet_hash, 'both review_runs bound to the SAME packet_hash');
  } finally { await pool.end(); }
});

gated('1c. remove a required evidence source (PRD) -> BLOCKED, no silent truncation, no review_runs', async () => {
  const pool = await freshPool();
  try {
    // Build WITHOUT a PRD (so no active contract, no acceptance rows) -> mandatory PRD unresolved.
    const build = await seedBuild(pool);
    const cpId = await seedCheckpoint(pool, build.id, SHA_HEAD, 'cp-noprd');
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const res = await runTowerReview({
      pool, checkpointId: cpId, reviewers: [codex(), fable()], packetBuilder: pb,
      productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    assert.equal(res.outcome, 'BLOCKED — review evidence incomplete');
    assert.equal(res.runs.length, 0, 'no reviewer runs on a blocked packet');
    const { rows } = await pool.query(`select state::text, blocked_reason from ops.review_packet where checkpoint_id=$1`, [cpId]);
    assert.equal(rows[0].state, 'blocked');
    assert.match(rows[0].blocked_reason, /PRD/i, 'blocked reason names the missing contract');
    const { rows: rr } = await pool.query(`select count(*)::int n from ops.review_run`);
    assert.equal(rr[0].n, 0);
  } finally { await pool.end(); }
});

gated('1d. a TRUNCATED diff is BLOCKED (never "review the available bits")', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake({ truncated: true }), log: SILENT });
    const packet = await pb.buildPacket({ checkpointId: cpId });
    assert.equal(packet.state, 'blocked');
    assert.match(packet.blockedReason, /truncated/i);
  } finally { await pool.end(); }
});

// ==========================================================================
// 2. HANDLER: review_run identity + head-attestation
// ==========================================================================
gated('2a. review_run records the versioned prompt (version+fingerprint) + honest registry identity', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const prompt = loadPrompt();
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [codex()], packetBuilder: pb, productQaPrompt: prompt, evidenceSources: gitFake(), log: SILENT });
    const runs = await runsForCheckpoint(pool, cpId);
    assert.equal(runs.length, 1);
    const r = runs[0];
    assert.equal(r.reviewer_key, 'gpt_codex', 'honest registry identity');
    assert.equal(r.role, 'product_qa');
    assert.equal(r.outcome, 'approved');
    assert.match(r.prompt_version, /tower-qa-skill@1\(approved/, 'approved base version recorded (with fingerprint)');
    assert.match(r.prompt_version, /classification-amendment@1\(APPROVED_LIVE/, 'the LIVE classification amendment component is recorded (with fingerprint)');
    assert.match(r.prompt_version, /orientation@1\(APPROVED_FOR_BUILD_014_DEV_CAMPAIGN;approved_by=warwick;governs_live=false\)/, 'orientation carries the campaign-approved provenance (NOT UNRATIFIED-draft)');
    assert.doesNotMatch(r.prompt_version, /UNRATIFIED-draft/, 'the honest-but-superseded UNRATIFIED-draft stamp is gone once campaign-approved');
    assert.equal(r.prompt_fingerprint, prompt.promptFingerprint, 'exact composed prompt-template fingerprint (base+classification+orientation) bound to the run');
    assert.equal(r.model_provider, 'openai-codex', 'honest provider label preserved');
  } finally { await pool.end(); }
});

gated('2b. head-attestation: a reviewer that signs a DIFFERENT head is downgraded to blocked', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    // codex signs SHA_WRONG (not the checkpoint head) -> outcome blocked.
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [codex({ reviewedHead: SHA_WRONG })], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const runs = await runsForCheckpoint(pool, cpId);
    assert.equal(runs[0].outcome, 'blocked', 'head mismatch -> blocked (never an approve for a head the reviewer never saw)');
    // and no legacy approve verdict was written for the wrong head.
    const { rows } = await pool.query(`select verdict::text from ops.verdict where checkpoint_id=$1 and state='active'`, [cpId]);
    assert.equal(rows[0].verdict, 'blocked');
  } finally { await pool.end(); }
});

gated('2c. the packet-driven path also works THROUGH createReviewHandler (job wiring)', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const handler = createReviewHandler({ pool, reviewers: [codex()], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const res = await handler({ job: { payload: { checkpointId: cpId } } });
    assert.equal(res.status, 'succeeded');
    assert.equal(res.review.outcome, 'REVIEWED');
    assert.equal((await runsForCheckpoint(pool, cpId)).length, 1);
  } finally { await pool.end(); }
});

// ==========================================================================
// 3. RISK-ROUTING
// ==========================================================================
gated('3a. pure risk-routing: low-risk diff -> product_qa only; autonomous/permission diff -> +adversarial +Warwick', async () => {
  // Pure functions — no DB.
  const low = computeAssurance({ diffSurfaces: deriveDiffSurfaces({ changedFiles: ['src/tubeair/reflow.mjs'], diffText: BENIGN_DIFF }) });
  assert.equal(low.product_qa_required, true);
  assert.equal(low.adversarial_review_required, false, 'low-risk: no adversarial');
  assert.equal(low.warwick_approval_required, false);

  const surfaces = deriveDiffSurfaces({ changedFiles: ['src/runner.mjs'], diffText: AUTONOMOUS_DIFF });
  assert.ok(surfaces.includes('autonomous_command'), 'autonomous command surface detected');
  const hi = computeAssurance({ diffSurfaces: surfaces });
  assert.equal(hi.product_qa_required, true);
  assert.equal(hi.adversarial_review_required, true, 'autonomous command raises adversarial');
  assert.equal(hi.warwick_approval_required, true, 'autonomous command raises the Warwick gate');
  assert.equal(hi.auto_merge_eligible, false, 'auto-merge stays EXPLICIT/false, never inferred');
});

gated('3b. low-risk checkpoint dispatches product_qa ONLY (adversarial reviewer not run)', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const fableAdapter = fable();
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [codex(), fableAdapter], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const runs = await runsForCheckpoint(pool, cpId);
    assert.equal(runs.length, 1, 'only product_qa ran');
    assert.equal(runs[0].role, 'product_qa');
    assert.equal(fableAdapter.lastSkillText, null, 'the adversarial reviewer was NOT invoked on a low-risk checkpoint');
    const { rows } = await pool.query(`select adversarial_review_required from ops.checkpoint_assurance where checkpoint_id=$1`, [cpId]);
    assert.equal(rows[0].adversarial_review_required, false);
  } finally { await pool.end(); }
});

gated('3c. adversarial-required-but-unavailable -> BLOCKED (never silently product_qa-only)', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    // Disable the ONLY adversarial reviewer.
    await pool.query(`update ops.reviewer_registry set enabled=false where reviewer_key='fable'`);
    const git = gitFake({ diffText: AUTONOMOUS_DIFF, changedFiles: ['src/runner.mjs'] });
    const pb = createPacketBuilder({ pool, evidenceSources: git, log: SILENT });
    const res = await runTowerReview({ pool, checkpointId: cpId, reviewers: [codex(), fable()], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: git, log: SILENT });
    assert.equal(res.outcome, 'BLOCKED — required reviewer unavailable');
    assert.equal(res.runs.length, 0, 'no product_qa-only fallback — the whole review is blocked');
    assert.ok(res.blockedRoles.some((b) => b.role === 'adversarial_assurance'));
    // The readiness view independently agrees: blocked_reviewer_unavailable.
    const { rows } = await pool.query(`select role_based_blocked_reviewer_unavailable from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cpId]);
    assert.equal(rows[0].role_based_blocked_reviewer_unavailable, true);
  } finally { await pool.end(); }
});

// ==========================================================================
// 4. PRODUCT-QA PROMPT (the load-bearing fix)
// ==========================================================================
gated('4a. an unmet ORDINARY acceptance criterion is surfaced BEFORE an exotic defect (acceptance-first wired)', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool); // AC-01 met (dedupeAdjacent in diff), AC-02 unmet (reflowToWidth absent)
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const reviewer = acceptanceFollowingCodex();
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    // The reviewer, following the staged acceptance-first prompt, reported the unmet ordinary AC
    // BEFORE the exotic finding.
    const result = JSON.parse(JSON.stringify((await reviewer.runTurn({ packet: { head_sha: SHA_HEAD, diff_text: BENIGN_DIFF }, skillText: reviewer.lastSkillText })).structuredResult));
    const firstFinding = result.findings[0];
    assert.equal(firstFinding.id, 'AC-02', 'the FIRST finding is the unmet ordinary acceptance criterion, not the exotic edge');
    assert.ok(result.findings.some((f) => f.id === 'EXOTIC-1'), 'the exotic finding exists but comes AFTER acceptance');
    assert.ok(result.findings.findIndex((f) => f.id === 'AC-02') < result.findings.findIndex((f) => f.id === 'EXOTIC-1'),
      'acceptance-before-exotic ordering (QA-not-pentest) is wired');
  } finally { await pool.end(); }
});

gated('4b. the runtime stages the REAL versioned prompt (not the legacy thin/empty skill) + ALL prior open findings', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const reviewer = codex();
    const prompt = loadPrompt();
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb, productQaPrompt: prompt, evidenceSources: gitFake(), log: SILENT });
    const staged = reviewer.lastSkillText;
    assert.ok(staged && staged.length > 200, 'skillText is the REAL prompt, not the legacy empty thin skill');
    assert.match(staged, /Tower QA — independent Codex review/, 'the APPROVED ratified skill body is staged');
    assert.match(staged, /three judgements/i, 'the LIVE reviewer-classification amendment is staged (base+classification+orientation)');
    assert.match(staged, /BLOCKS_CURRENT_MERGE/, 'the disposition vocabulary + fail-closed output contract are staged');
    assert.match(staged, /ACCEPTANCE FIRST/, 'the acceptance-first orientation layer is staged');
    assert.match(staged, /\[AC-01\]/, 'acceptance criteria are staged for verification');
    assert.match(staged, /\[F-100\]/, 'ALL prior open findings are staged (explicit consumption)');
    // The approved artifact was genuinely FOUND (fingerprint matches the on-disk approved skill bytes).
    const onDisk = crypto.createHash('sha256').update(fs.readFileSync(DEFAULT_APPROVED_SKILL_PATH, 'utf8'), 'utf8').digest('hex');
    assert.equal(prompt.approvedSkillFingerprint, onDisk, 'approved product-QA skill found + fingerprinted');
    assert.equal(prompt.approvedSkillRatified, true, 'the base product-QA prompt is Warwick-ratified/approved');
    assert.equal(prompt.classificationRatified, true, 'the classification amendment is APPROVED+LIVE');
    assert.equal(prompt.orientationApproved, false, 'orientation LIVE governance stays gated (governs_live=false) — never flipped');
    assert.equal(prompt.orientationCampaignApproved, true, 'orientation is campaign-approved (bound to the exact approved hash)');
    // The campaign approval is bound to the EXACT bytes Warwick approved — the orientation body is unchanged.
    const orientationDisk = crypto.createHash('sha256').update(fs.readFileSync(DEFAULT_ORIENTATION_PATH, 'utf8'), 'utf8').digest('hex');
    assert.equal(prompt.orientationFingerprint, orientationDisk, 'orientation fingerprint matches the on-disk bytes');
    assert.equal(orientationDisk, 'cd65539a23882309e0b903f81d59ecda32c6befdd9dde08e8651838d9a253135', 'orientation body is byte-for-byte the Warwick-approved hash');
  } finally { await pool.end(); }
});

// ==========================================================================
// 5. READINESS (feature-gated; OFF by default)
// ==========================================================================
gated('5. flag OFF (default) -> legacy both-required governs (unchanged); flag ON -> role-based governs', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool); // low-risk -> product_qa only
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const res = await runTowerReview({ pool, checkpointId: cpId, reviewers: [codex()], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });

    // Default: the flag is OFF -> legacy both-required governs. Only product_qa approved (one legacy
    // verdict), so the legacy path is NOT ready -> effective readiness delegates to legacy = false.
    assert.equal(res.readiness.governing_policy, 'legacy_both_required', 'legacy policy governs by default');
    assert.equal(res.readiness.effective_merge_ready, false, 'role-based does NOT govern while the flag is OFF');
    assert.equal(res.readiness.role_based_all_required_satisfied, true, 'role-based is computable (advisory) while inert');

    // Flip the flag ON (what a Warwick-gated activation will do) -> role-based governs -> ready.
    await pool.query(`update ops.feature_flag set enabled=true where flag_key='role_based_readiness'`);
    const { rows } = await pool.query(`select governing_policy, effective_merge_ready from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cpId]);
    assert.equal(rows[0].governing_policy, 'role_based');
    assert.equal(rows[0].effective_merge_ready, true, 'role-based product_qa-only readiness governs when ON');
  } finally { await pool.end(); }
});

// ==========================================================================
// 6. CLASSIFICATION WRITE-PATH + THE THREE FAIL-CLOSED FIXTURES + IDEMPOTENCY (PR-2b completion)
// ==========================================================================

// Fixture A — TWO-ROUND FINDING PERSISTENCE: a round-1 finding is injected into round-2's packet and
// MUST get an explicit disposition; an omitted disposition FAILS CLOSED (blocked); the finding cannot
// silently vanish (append-only ops.finding).
gated('6a. two-round finding persistence: omitted round-2 disposition fails closed; finding cannot vanish', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool); // head A; seeded open finding F-100
    // Round 1 (head A): dispose F-100 + OPEN a new classified finding (NEW-1).
    const pb1 = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const res1 = await runTowerReview({ pool, checkpointId: cpId, reviewers: [disposingReviewer({ newFindingId: 'NEW-1' })], packetBuilder: pb1, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    assert.equal(res1.runs[0].outcome, 'approved', 'round-1 opens a REQUIRED_BEFORE_LIVE finding — non-blocking, approves');
    const { rows: opened } = await pool.query(`select finding_ref, state::text as state from ops.finding where build_id=$1 and finding_ref like 'TR-%NEW-1%'`, [build.id]);
    assert.equal(opened.length, 1, 'the round-1 finding was persisted (append-only ops.finding)');
    const round1Ref = opened[0].finding_ref;

    // Round 2 (head B): the packet now injects BOTH F-100 and the round-1 finding.
    const cp2 = await seedCheckpoint(pool, build.id, SHA_HEAD2, 'cp2');
    // (i) OMIT the round-1 finding's disposition -> FAIL CLOSED (blocked); the finding must not vanish.
    const pb2 = createPacketBuilder({ pool, evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    const resOmit = await runTowerReview({ pool, checkpointId: cp2, reviewers: [disposingReviewer({ skipRefs: [round1Ref] })], packetBuilder: pb2, productQaPrompt: loadPrompt(), evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    assert.equal(resOmit.runs[0].outcome, 'blocked', 'an omitted prior-finding disposition fails closed (no silent carry-over)');
    const { rows: still } = await pool.query(`select state::text as state from ops.finding where finding_ref=$1`, [round1Ref]);
    assert.equal(still[0].state, 'open', 'the round-1 finding CANNOT silently vanish — still open (append-only)');
    // No acceptance_verification was written for the blocked round-2 attempt.
    const { rows: av2 } = await pool.query(`select count(*)::int n from ops.acceptance_verification where checkpoint_id=$1`, [cp2]);
    assert.equal(av2[0].n, 0, 'a fail-closed (blocked) run persists NO acceptance verifications');

    // (ii) Dispose EVERY prior open finding -> the run succeeds.
    const pb3 = createPacketBuilder({ pool, evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    const resOk = await runTowerReview({ pool, checkpointId: cp2, reviewers: [disposingReviewer({})], packetBuilder: pb3, productQaPrompt: loadPrompt(), evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    assert.equal(resOk.runs[0].outcome, 'approved', 'once every prior finding is explicitly disposed, the review completes');
  } finally { await pool.end(); }
});

// Fixture B — IMPROVEMENT DOES NOT BLOCK: an improvement-only result (NOTE_ONLY / TRACKED_FOLLOWUP,
// even technically HIGH) cannot produce a blocking gate; only a BLOCKS_CURRENT_MERGE finding does.
gated('6b. improvement (NOTE_ONLY/TRACKED_FOLLOWUP) does NOT block; a BLOCKS_CURRENT_MERGE finding DOES', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    // Improvement-only, verdict=approve: a technically-HIGH LATENT finding + a LOW note — neither blocks.
    const improver = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'IMP-1', technical_impact: 'HIGH', reachability: 'LATENT', required_disposition: 'REQUIRED_BEFORE_LIVE', assumed_deployment_baseline: 'DEV; no live-apply', evidence: 'latent hardening for a future live path', required_correction: 'harden before live' },
      { id: 'IMP-2', technical_impact: 'LOW', reachability: 'HYPOTHETICAL', required_disposition: 'NOTE_ONLY', assumed_deployment_baseline: 'DEV', evidence: 'nit', required_correction: 'optional' },
    ] });
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    const res = await runTowerReview({ pool, checkpointId: cpId, reviewers: [improver], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    assert.equal(res.runs[0].outcome, 'approved', 'improvement-only (no BLOCKS_CURRENT_MERGE) does NOT block, even at HIGH technical impact');
    const { rows: fc } = await pool.query(`select count(*)::int n from ops.finding where build_id=$1 and finding_ref like 'TR-%'`, [build.id]);
    assert.ok(fc[0].n >= 2, 'the improvements are TRACKED as findings (nonblocking, not discarded)');

    // Same shape but with a BLOCKS_CURRENT_MERGE finding -> blocks, even though the reviewer said approve.
    const cp2 = await seedCheckpoint(pool, build.id, SHA_HEAD2, 'cp2b');
    const blocker = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'BLK-1', technical_impact: 'HIGH', reachability: 'ACTIVE', required_disposition: 'BLOCKS_CURRENT_MERGE', assumed_deployment_baseline: 'DEV; reachable in the current authorised deployment', evidence: 'active correctness break', required_correction: 'fix now' },
    ] });
    const pb2 = createPacketBuilder({ pool, evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    const res2 = await runTowerReview({ pool, checkpointId: cp2, reviewers: [blocker], packetBuilder: pb2, productQaPrompt: loadPrompt(), evidenceSources: gitFake({ base: SHA_BASE }), log: SILENT });
    assert.equal(res2.runs[0].outcome, 'changes_requested', 'a material BLOCKS_CURRENT_MERGE finding blocks the gate (disposition governs, not the reviewer verdict word)');
  } finally { await pool.end(); }
});

// Fixture C — LOW-RISK NOT OVER-POLISHED: completed acceptance + no material blocker permits approval;
// optional improvements stay tracked + nonblocking; and NO adversarial reviewer is invoked where the
// checkpoint_assurance profile does not require one.
gated('6c. low-risk: completed acceptance approves; improvements tracked+nonblocking; no adversarial invoked', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool); // low-risk benign diff
    const reviewer = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'NICE-1', technical_impact: 'LOW', reachability: 'HYPOTHETICAL', required_disposition: 'TRACKED_FOLLOWUP', assumed_deployment_baseline: 'DEV control-plane', evidence: 'optional polish', required_correction: 'later' },
    ] });
    const fableAdapter = fable();
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer, fableAdapter], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const runs = await runsForCheckpoint(pool, cpId);
    assert.equal(runs.length, 1, 'only product_qa ran on a low-risk checkpoint');
    assert.equal(runs[0].role, 'product_qa');
    assert.equal(runs[0].outcome, 'approved', 'completed acceptance + no material blocker -> approval permitted (not over-polished)');
    assert.equal(fableAdapter.lastSkillText, null, 'NO adversarial reviewer invoked where checkpoint_assurance does not require one');
    const { rows } = await pool.query(`select impact from ops.finding where build_id=$1 and finding_ref like 'TR-%NICE-1%'`, [build.id]);
    assert.equal(rows.length, 1, 'the optional improvement is tracked as a finding');
    assert.match(rows[0].impact, /required_disposition=TRACKED_FOLLOWUP/, 'its nonblocking disposition is recorded on the finding');
    const { rows: av } = await pool.query(`select count(*)::int n from ops.acceptance_verification where checkpoint_id=$1`, [cpId]);
    assert.equal(av[0].n, 2, 'both acceptance criteria were verified + persisted to acceptance_verification (reviewer-principal)');
    const { rows: who } = await pool.query(`select distinct reviewer::text as reviewer from ops.acceptance_verification where checkpoint_id=$1`, [cpId]);
    assert.equal(who[0].reviewer, 'gpt_codex', 'verifications are written under a REVIEWER principal (builder cannot self-verify)');
  } finally { await pool.end(); }
});

// Fixture D — RETRY IDEMPOTENCY (Warwick): re-running the SAME review at the SAME head must NOT
// duplicate acceptance_verification or finding rows (acceptance_verification is append-only in PR-1).
gated('6d. write-path is RETRY-IDEMPOTENT: a re-run at the same head yields no duplicate verification/finding rows', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    const reviewer = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'DUP-1', technical_impact: 'MEDIUM', reachability: 'LATENT', required_disposition: 'REQUIRED_BEFORE_LIVE', assumed_deployment_baseline: 'DEV', evidence: 'x', required_correction: 'later' },
    ] });
    // Run the SAME review TWICE at the SAME head (simulated retry / re-lease). Each call builds a fresh
    // packet, so BOTH reach the write-path — the write-path itself must dedupe (not the run dedup).
    for (let i = 0; i < 2; i += 1) {
      const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
      await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    }
    // exactly ONE acceptance_verification per (acceptance_row, reviewer, head) — no duplicate append.
    const { rows: dup } = await pool.query(
      `select acceptance_row_id, reviewer::text as reviewer, exact_sha, count(*)::int n
         from ops.acceptance_verification where checkpoint_id=$1
        group by acceptance_row_id, reviewer, exact_sha having count(*) > 1`, [cpId]);
    assert.equal(dup.length, 0, 'no duplicate acceptance_verification rows across the retry');
    const { rows: avn } = await pool.query(`select count(*)::int n from ops.acceptance_verification where checkpoint_id=$1`, [cpId]);
    assert.equal(avn[0].n, 2, 'exactly one verification per acceptance row at this head (2 rows), not 4');
    // no duplicate findings (deterministic finding_ref -> on-conflict-do-nothing).
    const { rows: fdup } = await pool.query(
      `select finding_ref, count(*)::int n from ops.finding where build_id=$1 group by finding_ref having count(*) > 1`, [build.id]);
    assert.equal(fdup.length, 0, 'no duplicate finding rows across the retry');
    const { rows: fn } = await pool.query(`select count(*)::int n from ops.finding where build_id=$1 and finding_ref like 'TR-%DUP-1%'`, [build.id]);
    assert.equal(fn[0].n, 1, 'the new finding is opened exactly once across retries');
  } finally { await pool.end(); }
});

// ==========================================================================
// 7. TYPED required_disposition MERGE LEVER (migration 006) — readiness consumes the TYPED column,
//    never parsed from impact text. Both readiness paths proved: flag OFF byte-for-byte legacy;
//    flag ON structurally blocks on BLOCKS_CURRENT_MERGE, non-blockers don't block, a classifier
//    finding missing its classification fails closed. Plus retry does not duplicate/alter records.
// ==========================================================================

async function effReadiness(pool, cpId) {
  const { rows } = await pool.query(
    `select governing_policy, effective_merge_ready, legacy_both_reviewers_approved,
            role_based_all_required_satisfied, role_based_blocked_reviewer_unavailable,
            role_based_disposition_blocked, role_based_unclassified_finding
       from ops.checkpoint_effective_readiness where checkpoint_id=$1`, [cpId]);
  return rows[0];
}
// The typed finding a REQUIRED_BEFORE_LIVE classifier opens (id: REQ-1) — links to the checkpoint's
// review_run via review_run_finding(relation='opened'), so it is "current material" for readiness.
async function openReqBeforeLiveFinding(pool, cpId) {
  const reviewer = classifyingReviewer({ verdict: 'approve', findings: [
    { id: 'REQ-1', technical_impact: 'HIGH', reachability: 'LATENT', required_disposition: 'REQUIRED_BEFORE_LIVE',
      assumed_deployment_baseline: 'DEV control-plane; no live-apply wired', evidence: 'latent hardening', required_correction: 'harden before live' },
  ] });
  const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
  const res = await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
  assert.equal(res.runs[0].outcome, 'approved', 'a REQUIRED_BEFORE_LIVE (non-blocking) finding still approves — roles satisfied');
  return res;
}
async function reqFindingRow(pool, buildId) {
  const { rows } = await pool.query(
    `select id, finding_ref, required_disposition::text as rd, assumed_deployment_baseline as base,
            classification_version as ver, state::text as state
       from ops.finding where build_id=$1 and finding_ref like 'TR-%REQ-1%'`, [buildId]);
  return rows[0];
}

// (i) flag OFF -> historical readiness is byte-for-byte unchanged; the typed lever is INERT (advisory only).
gated('7a. flag OFF -> historical readiness unchanged; a BLOCKS_CURRENT_MERGE finding does NOT leak into the OFF path', async () => {
  const pool = await freshPool();
  try {
    const { cpId } = await seedReviewable(pool);
    // A reviewer that opens a BLOCKS_CURRENT_MERGE finding (so the lever WOULD fire if it governed).
    const blocker = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'OFF-BLK', technical_impact: 'HIGH', reachability: 'ACTIVE', required_disposition: 'BLOCKS_CURRENT_MERGE',
        assumed_deployment_baseline: 'DEV; reachable now', evidence: 'active break', required_correction: 'fix now' },
    ] });
    const pb = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [blocker], packetBuilder: pb, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const eff = await effReadiness(pool, cpId);
    assert.equal(eff.governing_policy, 'legacy_both_required', 'default flag OFF -> legacy governs');
    // The lever IS computed (advisory), proving it saw the blocking finding...
    assert.equal(eff.role_based_disposition_blocked, true, 'the typed lever advisory-fires (a BLOCKS finding is present)');
    // ...but the OFF governing result is EXACTLY the legacy value — the lever cannot leak into the OFF path.
    assert.equal(eff.effective_merge_ready, eff.legacy_both_reviewers_approved,
      'flag OFF: effective readiness == legacy both-required, unchanged by the disposition lever');
    assert.equal(eff.effective_merge_ready, false, 'only product_qa approved -> legacy both-required not ready (unchanged behaviour)');
  } finally { await pool.end(); }
});

// (iii) flag ON -> other dispositions do NOT block by themselves; legacy (unlinked) findings stay off-path.
gated('7b. flag ON -> a non-blocking disposition (REQUIRED_BEFORE_LIVE) does NOT block; a legacy open finding does not fail closed', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool); // also seeds LEGACY open finding F-100 (required_disposition NULL, UNLINKED)
    await openReqBeforeLiveFinding(pool, cpId);
    await pool.query(`update ops.feature_flag set enabled=true where flag_key='role_based_readiness'`);
    const eff = await effReadiness(pool, cpId);
    assert.equal(eff.governing_policy, 'role_based');
    assert.equal(eff.role_based_all_required_satisfied, true, 'product_qa approved -> required roles satisfied');
    assert.equal(eff.role_based_disposition_blocked, false, 'REQUIRED_BEFORE_LIVE does not block the current merge');
    assert.equal(eff.role_based_unclassified_finding, false, 'the classifier finding carries its required_disposition');
    assert.equal(eff.effective_merge_ready, true, 'flag ON: non-blocking disposition -> merge-ready');
    // The LEGACY finding F-100 (required_disposition NULL, never review_run-linked) does NOT fail closed.
    const { rows: leg } = await pool.query(`select state::text as state, required_disposition::text as rd from ops.finding where build_id=$1 and finding_ref='F-100'`, [build.id]);
    assert.equal(leg[0].state, 'open', 'the legacy finding is still open (append-only)');
    assert.equal(leg[0].rd, null, 'the legacy finding keeps required_disposition NULL (not backfilled)');
    // ...yet readiness is still ready -> legacy findings stay behind the compatibility path.
  } finally { await pool.end(); }
});

// (ii) flag ON -> a current BLOCKS_CURRENT_MERGE finding STRUCTURALLY blocks, EVEN when every role is satisfied.
gated('7c. flag ON -> a current BLOCKS_CURRENT_MERGE finding structurally blocks even with all roles satisfied', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    await openReqBeforeLiveFinding(pool, cpId);           // approved review -> roles satisfied; opens REQ-1 (non-blocking)
    const f = await reqFindingRow(pool, build.id);
    await pool.query(`update ops.feature_flag set enabled=true where flag_key='role_based_readiness'`);
    // Baseline: ready (roles satisfied, non-blocking disposition).
    let eff = await effReadiness(pool, cpId);
    assert.equal(eff.effective_merge_ready, true, 'baseline: roles satisfied + non-blocking -> ready');
    // Flip ONLY the typed disposition to BLOCKS_CURRENT_MERGE (roles unchanged) -> structurally NOT ready.
    await pool.query(`update ops.finding set required_disposition='BLOCKS_CURRENT_MERGE' where id=$1`, [f.id]);
    eff = await effReadiness(pool, cpId);
    assert.equal(eff.role_based_all_required_satisfied, true, 'roles are UNCHANGED (the review_run still approved) — the block is the lever, not a role gap');
    assert.equal(eff.role_based_disposition_blocked, true, 'the typed BLOCKS_CURRENT_MERGE lever fires');
    assert.equal(eff.effective_merge_ready, false, 'a current BLOCKS_CURRENT_MERGE finding structurally blocks the merge');
  } finally { await pool.end(); }
});

// (iv) flag ON -> a current classifier finding MISSING its required_disposition FAILS CLOSED.
gated('7d. flag ON -> a current classifier finding missing its required_disposition fails closed (not-ready)', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    await openReqBeforeLiveFinding(pool, cpId);
    const f = await reqFindingRow(pool, build.id);
    assert.equal(f.rd, 'REQUIRED_BEFORE_LIVE', 'precondition: the classifier finding started fully classified');
    await pool.query(`update ops.feature_flag set enabled=true where flag_key='role_based_readiness'`);
    // Strip the required_disposition off a NON-LEGACY (review_run-linked) finding -> fail closed.
    await pool.query(`update ops.finding set required_disposition=null where id=$1`, [f.id]);
    const eff = await effReadiness(pool, cpId);
    assert.equal(eff.role_based_all_required_satisfied, true, 'roles are still satisfied — this is a classification gap, not a role gap');
    assert.equal(eff.role_based_unclassified_finding, true, 'a review_run-opened finding with NULL required_disposition is flagged');
    assert.equal(eff.effective_merge_ready, false, 'a classifier finding missing its required_disposition FAILS CLOSED');
  } finally { await pool.end(); }
});

// (v) retrying the SAME review does NOT duplicate OR alter the typed classification records.
gated('7e. retry-idempotent typed classification: a re-run neither duplicates nor alters the typed columns', async () => {
  const pool = await freshPool();
  try {
    const { build, cpId } = await seedReviewable(pool);
    const reviewer = classifyingReviewer({ verdict: 'approve', findings: [
      { id: 'IDEM-1', technical_impact: 'MEDIUM', reachability: 'LATENT', required_disposition: 'TRACKED_FOLLOWUP',
        assumed_deployment_baseline: 'DEV control-plane', evidence: 'x', required_correction: 'later' },
    ] });
    const readTyped = async () => {
      const { rows } = await pool.query(
        `select finding_ref, required_disposition::text as rd, assumed_deployment_baseline as base,
                classification_version as ver, updated_at
           from ops.finding where build_id=$1 and finding_ref like 'TR-%IDEM-1%'`, [build.id]);
      return rows;
    };
    // Run 1.
    const pb1 = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb1, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const after1 = await readTyped();
    assert.equal(after1.length, 1, 'the typed classification finding is written once');
    assert.equal(after1[0].rd, 'TRACKED_FOLLOWUP', 'the TYPED required_disposition column is populated (not parsed from impact)');
    assert.ok(after1[0].base && after1[0].base.length > 0, 'assumed_deployment_baseline is populated in its own typed column');
    assert.equal(after1[0].ver, 'reviewer-classification-amendment@1', 'classification_version is stamped (marks the finding non-legacy)');
    // Run 2 at the SAME head (fresh packet -> reaches the write-path again; the write-path must dedupe).
    const pb2 = createPacketBuilder({ pool, evidenceSources: gitFake(), log: SILENT });
    await runTowerReview({ pool, checkpointId: cpId, reviewers: [reviewer], packetBuilder: pb2, productQaPrompt: loadPrompt(), evidenceSources: gitFake(), log: SILENT });
    const after2 = await readTyped();
    assert.equal(after2.length, 1, 'no duplicate classification record across the retry');
    assert.equal(after2[0].rd, after1[0].rd, 'required_disposition unchanged across retry');
    assert.equal(after2[0].ver, after1[0].ver, 'classification_version unchanged across retry');
    assert.equal(after2[0].base, after1[0].base, 'assumed_deployment_baseline unchanged across retry');
    assert.equal(after2[0].updated_at.getTime(), after1[0].updated_at.getTime(),
      'updated_at is IDENTICAL — on-conflict-do-nothing did not touch the row (record not altered)');
  } finally { await pool.end(); }
});
