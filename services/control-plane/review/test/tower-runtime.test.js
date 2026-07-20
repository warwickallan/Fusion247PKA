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
import { loadProductQaPrompt, DEFAULT_APPROVED_SKILL_PATH } from '../productQaPrompt.mjs';
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
].map((f) => path.join(MIGRATIONS_DIR, f));
const DB = process.env.DATABASE_URL;

const SHA_HEAD = 'a'.repeat(40);
const SHA_BASE = 'b'.repeat(40);
const SHA_WRONG = 'c'.repeat(40);
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
function fakeReviewer({ principal, provider, verdict = 'approve', reviewedHead = null, blocked = false }) {
  return {
    principal,
    lastSkillText: null,
    async runTurn({ packet, skillText }) {
      this.lastSkillText = skillText;
      const head = reviewedHead ?? packet.head_sha;
      const payload = blocked
        ? { status: 'blocked', kind: 'forced', proposed_action: { type: 'noop', target: '' } }
        : { status: 'ok', verdict, summary: 'fake', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
      const { envelope, signature } = makeSignedVerdict({ principal, provider, modelId: 'fake', reviewedHead: head, payload }, null);
      if (blocked) return { ok: false, blocked: true, signerPrincipal: principal, structuredResult: payload, envelope, signature, error: 'forced' };
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature };
    },
  };
}
const codex = (opts = {}) => fakeReviewer({ principal: 'gpt_codex', provider: 'openai-codex', ...opts });
const fable = (opts = {}) => fakeReviewer({ principal: 'claude_fable', provider: 'anthropic', ...opts });

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
      const findings = [];
      for (const line of lines) {
        const ref = (line.match(/\[([^\]]+)\]/) || [])[1];
        const proof = (line.match(/expected proof:\s*([^)]+)\)/) || [])[1]?.trim();
        if (ref && proof && !diff.includes(proof)) {
          findings.push({ id: ref, severity: 'high', evidence: `acceptance ${ref} unmet`, rationale: 'ordinary acceptance criterion not met', required_correction: `implement ${proof}` });
        }
      }
      // Only AFTER acceptance do we add an exotic/perimeter observation.
      findings.push({ id: 'EXOTIC-1', severity: 'low', evidence: 'hypothetical race under concurrent reflow', rationale: 'edge', required_correction: 'guard' });
      const verdict = findings.some((f) => /^AC-/.test(f.id)) ? 'request_changes' : 'approve';
      const payload = { status: 'ok', verdict, summary: 'acceptance-first review', claims_verified: [], findings, proposed_action: { type: 'post_review', target: '' } };
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
    assert.match(r.prompt_version, /tower-qa-skill@1\(approved\)/, 'approved base version recorded');
    assert.match(r.prompt_version, /orientation-draft@1\(UNRATIFIED-draft\)/, 'draft orientation flagged in the version stamp');
    assert.equal(r.prompt_fingerprint, prompt.promptFingerprint, 'exact prompt-template fingerprint bound to the run');
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
    assert.match(staged, /ACCEPTANCE FIRST/, 'the acceptance-first orientation layer is staged');
    assert.match(staged, /\[AC-01\]/, 'acceptance criteria are staged for verification');
    assert.match(staged, /\[F-100\]/, 'ALL prior open findings are staged (explicit consumption)');
    // The approved artifact was genuinely FOUND (fingerprint matches the on-disk approved skill bytes).
    const onDisk = crypto.createHash('sha256').update(fs.readFileSync(DEFAULT_APPROVED_SKILL_PATH, 'utf8'), 'utf8').digest('hex');
    assert.equal(prompt.approvedSkillFingerprint, onDisk, 'approved product-QA skill found + fingerprinted');
    assert.equal(prompt.approvedSkillRatified, true, 'the base product-QA prompt is Warwick-ratified/approved');
    assert.equal(prompt.orientationApproved, false, 'the orientation layer is (honestly) flagged NOT-YET-APPROVED');
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
