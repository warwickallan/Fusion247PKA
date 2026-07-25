// Bounded WP4B operator.
//
// The extraction and authoritative snapshots are produced by ops/wp4b-core.py
// on the pinned runtime. This command owns the portable DB/API side:
//   prepare -> plan -> apply -> finish
// A failed apply immediately attempts compensating rollback from frozen pre-images.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertConfig } from '../config.mjs';
import { close, q } from '../clients/db.mjs';
import { faithfulClean } from '../core/learnIngest.mjs';
import { buildLens } from '../core/lens.mjs';
import {
  EXTRACTION_PROFILE_VERSION,
  applyPlan,
  beginRun,
  buildCanonicalPlan,
  finishRun,
  idempotencyKey,
  lensFingerprint,
  rollbackPlan,
  selectLensExpansionCandidates,
  sha256,
  storeCandidateAndPlan,
  storeVerification,
  validateBundleIdentity,
  verifyPlan,
} from '../core/wp4b.mjs';

const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const write = (path, value) => writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const asJson = (value) => typeof value === 'string' ? JSON.parse(value) : value;

function lensShapes(row) {
  const shared = {
    lensId: row.lens_id,
    version: Number(row.lens_version),
    origin: row.origin,
    enduring: asJson(row.enduring) || [],
    active: asJson(row.active) || [],
    emerging: asJson(row.emerging) || [],
    goals: asJson(row.goals) || [],
  };
  const currentProjects = asJson(row.current_projects) || [];
  const openQuestions = asJson(row.open_questions) || [];
  const negativeSignals = asJson(row.negative_signals) || [];
  const adjacentTopics = asJson(row.adjacent_topics) || [];
  return [
    { ...shared, currentProjects, openQuestions, negativeSignals, adjacentTopics },
    {
      ...shared,
      current_projects: currentProjects,
      open_questions: openQuestions,
      negative_signals: negativeSignals,
      adjacent_topics: adjacentTopics,
    },
  ];
}

// Recover the exact JS shape that produced the frozen fingerprint. Older WP4B
// runs used snake_case array keys; newer callers may use camelCase.
export function reconstructLedgerLens(row, approvedAdditions, expectedFingerprint) {
  if (!row) throw new Error('original WP4B interest lens is missing');
  const match = lensShapes(row).find(
    (lens) => lensFingerprint(lens, approvedAdditions) === expectedFingerprint,
  );
  if (!match) throw new Error('original interest lens does not match the frozen WP4B lens fingerprint');
  return match;
}

export async function loadResumeLedger(runId, { query = q } = {}) {
  if (!runId) throw new Error('resume command requires runId');
  const run = (await query(
    `select * from obsidiwikai.processing_run where run_id=$1`, [runId],
  )).rows[0];
  if (!run) throw new Error(`WP4B processing run not found: ${runId}`);
  const bundle = (await query(
    `select * from obsidiwikai.wp4b_bundle where run_id=$1`, [runId],
  )).rows[0];
  if (!bundle) throw new Error(`WP4B frozen bundle not found: ${runId}`);
  const lensRow = (await query(
    `select * from obsidiwikai.interest_lens where lens_id=$1`, [run.lens_id],
  )).rows[0];
  if (!lensRow) throw new Error(`WP4B original interest lens not found: ${run.lens_id}`);
  const previousInterpretation = (await query(
    `select * from obsidiwikai.source_interpretation
     where source_id=$1 and is_current=true order by created_at desc limit 1`,
    [run.source_id],
  )).rows[0];
  if (!previousInterpretation) throw new Error(`no preserved BEFORE interpretation exists for ${run.source_id}`);
  const receipts = (await query(
    `select * from obsidiwikai.wp4b_operation_receipt where run_id=$1 order by sequence`,
    [runId],
  )).rows;
  return { run, bundle, lensRow, previousInterpretation, receipts };
}

export function validateResumeLedger(ledger, {
  requireHeld = false,
  requireNoReceipts = false,
  requirePlan = false,
} = {}) {
  const { run, bundle, lensRow, receipts = [] } = ledger;
  const before = asJson(bundle.before_state);
  const candidate = asJson(bundle.candidate_bundle);
  const approvedAdditions = asJson(bundle.approved_additions) || [];
  const plan = asJson(bundle.canonical_plan);
  if (run.run_id !== bundle.run_id) throw new Error('WP4B run and bundle identities differ');
  if (run.source_id !== bundle.source_id || before?.source_id !== bundle.source_id) {
    throw new Error('WP4B ledger source identity mismatch');
  }
  if (!candidate) throw new Error('WP4B frozen candidate bundle is missing');
  const lens = reconstructLedgerLens(lensRow, approvedAdditions, bundle.lens_fingerprint);
  validateBundleIdentity(before, candidate, {
    sourceId: bundle.source_id,
    faithfulCleanSha256: bundle.faithful_clean_sha256,
    lensFingerprint: bundle.lens_fingerprint,
    extractionProfileVersion: bundle.extraction_profile_version,
  });
  const expectedKey = idempotencyKey({
    sourceId: bundle.source_id,
    faithfulCleanSha256: bundle.faithful_clean_sha256,
    lensFingerprint: bundle.lens_fingerprint,
    extractionProfileVersion: bundle.extraction_profile_version,
  });
  if (run.idempotency_key !== expectedKey) throw new Error('WP4B processing-run idempotency identity mismatch');
  const stats = asJson(run.stats) || {};
  if (stats.extraction_profile_version
      && stats.extraction_profile_version !== bundle.extraction_profile_version) {
    throw new Error('WP4B processing-run extraction profile mismatch');
  }
  if (requireHeld && (run.state !== 'held' || bundle.status !== 'held')) {
    throw new Error(`WP4B resume-plan requires held run/bundle, got ${run.state}/${bundle.status}`);
  }
  if (requireNoReceipts && receipts.length) {
    throw new Error('WP4B resume-plan requires the frozen run to have no operation receipts');
  }
  if (requirePlan && !plan) throw new Error('WP4B canonical plan is missing; run resume-plan first');
  return { ...ledger, before, candidate, approvedAdditions, plan, lens };
}

export function validateAfterSnapshot(before, after) {
  if (!after || after.source_id !== before.source_id || after.file_path !== before.file_path) {
    throw new Error('WP4B after snapshot source identity mismatch');
  }
  if (after.faithful_clean_sha256 !== before.faithful_clean_sha256) {
    throw new Error('WP4B after snapshot faithful-clean hash mismatch');
  }
  if (after.document?.id !== before.document?.id) {
    throw new Error('WP4B after snapshot document identity mismatch');
  }
  return after;
}

function usage() {
  console.log(`WP4B additive historical semantic re-mining

prepare <sourceId> <filePath> <before.json> <request.json> <context.json> <approved-interest...>
plan    <before.json> <candidate.json> <context.json> <plan.json>
apply   <before.json> <candidate.json> <context.json> <plan.json>
finish  <runId> <before.json> <after.json> <context.json> <plan.json>
rollback <runId> <plan.json>
resume-plan   <runId>
resume-apply  <runId>
resume-verify <runId> <after.json>
resume-finish <runId>

The approved interest must already have been added using the existing interests control.
The pinned Python helper must create before/candidate/after bundles; this command never
creates or treats a temporary extraction graph as authoritative. Resume commands consume
only the already-frozen ledger bundle and never create a processing run or extract again.`);
}

async function prepare(args) {
  const [sourceId, filePath, beforePath, requestPath, contextPath, ...approvedAdditions] = args;
  if (!sourceId || !filePath || !beforePath || !requestPath || !contextPath || !approvedAdditions.length) {
    throw new Error('prepare requires sourceId, filePath, before/request/context paths, and at least one approved interest');
  }
  const before = read(beforePath);
  const faithful = faithfulClean(sourceId);
  const faithfulCleanSha256 = sha256(faithful);
  if (before.source_id !== sourceId || before.file_path !== filePath) {
    throw new Error('authoritative before snapshot does not match requested source identity');
  }
  if (before.faithful_clean_sha256 !== faithfulCleanSha256) {
    throw new Error('retained faithful-clean hash differs from the authoritative full-document hash');
  }
  const lens = await buildLens();
  const fingerprint = lensFingerprint(lens, approvedAdditions);
  const previousInterpretation = (await q(
    `select * from obsidiwikai.source_interpretation
     where source_id=$1 and is_current=true order by created_at desc limit 1`,
    [sourceId],
  )).rows[0];
  if (!previousInterpretation) throw new Error(`no preserved BEFORE interpretation exists for ${sourceId}`);
  const source = (await q(
    `select source_id,title,raw_ref from obsidiwikai.source where source_id=$1`,
    [sourceId],
  )).rows[0] || { source_id: sourceId };
  const request = {
    source_id: sourceId,
    file_path: filePath,
    document_id: before.document.id,
    faithful_clean: faithful,
    lens_fingerprint: fingerprint,
    extraction_profile_version: EXTRACTION_PROFILE_VERSION,
    approved_additions: approvedAdditions,
    lens,
  };
  const context = {
    source,
    faithful_clean_sha256: faithfulCleanSha256,
    lens,
    lens_fingerprint: fingerprint,
    approved_additions: approvedAdditions,
    previous_interpretation: previousInterpretation,
    extraction_profile_version: EXTRACTION_PROFILE_VERSION,
  };
  write(requestPath, request);
  write(contextPath, context);
  return {
    sourceId,
    documentId: before.document.id,
    chunks: before.counts?.chunks,
    faithfulCleanSha256,
    lensFingerprint: fingerprint,
    approvedAdditions,
    requestPath: resolve(requestPath),
    contextPath: resolve(contextPath),
  };
}

async function plan(args) {
  const [beforePath, candidatePath, contextPath, planPath] = args;
  if (!planPath) throw new Error('plan requires before, candidate, context and output paths');
  const before = read(beforePath);
  const candidate = read(candidatePath);
  const context = read(contextPath);
  validateBundleIdentity(before, candidate, {
    sourceId: before.source_id,
    faithfulCleanSha256: context.faithful_clean_sha256,
    lensFingerprint: context.lens_fingerprint,
    extractionProfileVersion: context.extraction_profile_version,
  });
  const selection = await selectLensExpansionCandidates(
    before,
    candidate,
    context.approved_additions,
  );
  const canonicalPlan = await buildCanonicalPlan(before, candidate, selection);
  write(planPath, canonicalPlan);
  return {
    selectedEntities: selection.entityNames,
    selectedRelationships: selection.relationshipPairs,
    operations: canonicalPlan.operations.map((item) => ({
      sequence: item.sequence,
      kind: item.kind,
      target: item.target,
      evidence: item.evidence.map((entry) => ({
        chunk_id: entry.chunk_id,
        start_char: entry.start_char,
        end_char: entry.end_char,
      })),
    })),
    held: canonicalPlan.held,
    noops: canonicalPlan.noops,
    planPath: resolve(planPath),
  };
}

async function apply(args) {
  const [beforePath, candidatePath, contextPath, planPath] = args;
  if (!planPath) throw new Error('apply requires before, candidate, context and plan paths');
  const before = read(beforePath);
  const candidate = read(candidatePath);
  const context = read(contextPath);
  const canonicalPlan = read(planPath);
  validateBundleIdentity(before, candidate, {
    sourceId: before.source_id,
    faithfulCleanSha256: context.faithful_clean_sha256,
    lensFingerprint: context.lens_fingerprint,
    extractionProfileVersion: context.extraction_profile_version,
  });
  if (!canonicalPlan.operations?.length) {
    return { applied: false, reason: 'no conservatively accepted novel operations', held: canonicalPlan.held };
  }
  const started = await beginRun({
    sourceId: before.source_id,
    title: context.source?.title,
    rawRef: context.source?.raw_ref,
    faithfulCleanSha256: context.faithful_clean_sha256,
    lens: context.lens,
    approvedAdditions: context.approved_additions,
    before,
    extractionProfileVersion: context.extraction_profile_version,
  });
  if (started.existing && ['completed', 'validated'].includes(started.state || started.bundle?.status)) {
    return { applied: false, idempotent: true, runId: started.runId, state: started.state };
  }
  await storeCandidateAndPlan(started.runId, candidate, canonicalPlan);
  try {
    await applyPlan(started.runId, canonicalPlan);
  } catch (error) {
    const rollback = await rollbackPlan(started.runId, canonicalPlan);
    error.message = `${error.message}; compensating rollback: ${JSON.stringify(rollback)}`;
    throw error;
  }
  return {
    applied: true,
    runId: started.runId,
    idempotencyKey: started.idempotencyKey,
    operations: canonicalPlan.operations.length,
  };
}

async function finish(args) {
  const [runId, beforePath, afterPath, contextPath, planPath] = args;
  if (!planPath) throw new Error('finish requires runId, before, after, context and plan paths');
  const before = read(beforePath);
  const after = read(afterPath);
  const context = read(contextPath);
  const canonicalPlan = read(planPath);
  return finishRun({
    runId,
    sourceId: before.source_id,
    before,
    after,
    plan: canonicalPlan,
    lens: context.lens,
    approvedAdditions: context.approved_additions,
    previousInterpretation: context.previous_interpretation,
  });
}

async function rollback(args) {
  const [runId, planPath] = args;
  if (!runId || !planPath) throw new Error('rollback requires runId and plan path');
  return rollbackPlan(runId, read(planPath));
}


export async function resumePlan(args, deps = {}) {
  const [runId] = args;
  const ledger = validateResumeLedger(
    await loadResumeLedger(runId, { query: deps.query || q }),
    { requireHeld: true, requireNoReceipts: true },
  );
  const selection = await (deps.selectCandidates || selectLensExpansionCandidates)(
    ledger.before,
    ledger.candidate,
    ledger.approvedAdditions,
  );
  const canonicalPlan = await (deps.buildPlan || buildCanonicalPlan)(
    ledger.before,
    ledger.candidate,
    selection,
  );
  await (deps.storePlan || storeCandidateAndPlan)(runId, ledger.candidate, canonicalPlan);
  return {
    runId,
    stored: true,
    selectedEntities: selection.entityNames,
    selectedRelationships: selection.relationshipPairs,
    operations: canonicalPlan.operations?.length || 0,
    held: canonicalPlan.held || [],
    noops: canonicalPlan.noops || [],
  };
}

export async function resumeApply(args, deps = {}) {
  const [runId] = args;
  const ledger = validateResumeLedger(
    await loadResumeLedger(runId, { query: deps.query || q }),
    { requirePlan: true },
  );
  if (!['canonicalised', 'applying', 'applied'].includes(ledger.bundle.status)) {
    throw new Error(`WP4B resume-apply requires canonicalised/applying ledger, got ${ledger.bundle.status}`);
  }
  if (!ledger.plan.operations?.length) throw new Error('WP4B resume-apply refuses an empty canonical plan');
  try {
    await (deps.apply || applyPlan)(runId, ledger.plan);
  } catch (error) {
    const rollback = await (deps.rollback || rollbackPlan)(runId, ledger.plan);
    error.message = `${error.message}; compensating rollback: ${JSON.stringify(rollback)}`;
    throw error;
  }
  return { runId, applied: true, operations: ledger.plan.operations.length };
}

export async function resumeVerify(args, deps = {}) {
  const [runId, afterPath] = args;
  if (!afterPath) throw new Error('resume-verify requires runId and after snapshot path');
  const ledger = validateResumeLedger(
    await loadResumeLedger(runId, { query: deps.query || q }),
    { requirePlan: true },
  );
  if (ledger.bundle.status !== 'applied') {
    throw new Error(`WP4B resume-verify requires applied bundle, got ${ledger.bundle.status}`);
  }
  const after = validateAfterSnapshot(ledger.before, (deps.readJson || read)(afterPath));
  const verification = (deps.verify || verifyPlan)(ledger.plan, after);
  await (deps.storeVerification || storeVerification)(runId, verification);
  await (deps.query || q)(
    `update obsidiwikai.wp4b_bundle set after_state=$2,updated_at=now() where run_id=$1`,
    [runId, JSON.stringify(after)],
  );
  return { runId, ...verification };
}

export async function resumeFinish(args, deps = {}) {
  const [runId] = args;
  const ledger = validateResumeLedger(
    await loadResumeLedger(runId, { query: deps.query || q }),
    { requirePlan: true },
  );
  const after = asJson(ledger.bundle.after_state);
  if (!after) throw new Error('WP4B verified after snapshot is missing; run resume-verify first');
  if (ledger.bundle.status !== 'applied') {
    throw new Error(`WP4B resume-finish requires applied bundle, got ${ledger.bundle.status}`);
  }
  validateAfterSnapshot(ledger.before, after);
  const expectedKeys = new Set(ledger.plan.operations.map((operation) => operation.operationKey));
  const verifiedKeys = new Set(
    ledger.receipts.filter((receipt) => receipt.state === 'verified').map((receipt) => receipt.operation_key),
  );
  if ([...expectedKeys].some((key) => !verifiedKeys.has(key))) {
    throw new Error('WP4B resume-finish requires every planned operation receipt to be verified');
  }
  return (deps.finish || finishRun)({
    runId,
    sourceId: ledger.bundle.source_id,
    before: ledger.before,
    after,
    plan: ledger.plan,
    lens: ledger.lens,
    approvedAdditions: ledger.approvedAdditions,
    previousInterpretation: ledger.previousInterpretation,
  });
}

export function isDirectRun(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (!argvPath) return false;
  return resolve(argvPath).toLowerCase() === resolve(fileURLToPath(metaUrl)).toLowerCase();
}

if (isDirectRun()) {
assertConfig();
const [command, ...args] = process.argv.slice(2);
const handlers = { prepare, plan, apply, finish, rollback };
Object.assign(handlers, {
  'resume-plan': resumePlan,
  'resume-apply': resumeApply,
  'resume-verify': resumeVerify,
  'resume-finish': resumeFinish,
});
try {
  if (!handlers[command]) {
    usage();
    if (command) process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await handlers[command](args), null, 2));
  }
} catch (error) {
  console.error(`WP4B ${command || 'command'} failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await close();
}
}
