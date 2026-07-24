// Bounded WP4B operator.
//
// The extraction and authoritative snapshots are produced by ops/wp4b-core.py
// on the pinned runtime. This command owns the portable DB/API side:
//   prepare -> plan -> apply -> finish
// A failed apply immediately attempts compensating rollback from frozen pre-images.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  lensFingerprint,
  rollbackPlan,
  selectLensExpansionCandidates,
  sha256,
  storeCandidateAndPlan,
  validateBundleIdentity,
} from '../core/wp4b.mjs';

const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const write = (path, value) => writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

function usage() {
  console.log(`WP4B additive historical semantic re-mining

prepare <sourceId> <filePath> <before.json> <request.json> <context.json> <approved-interest...>
plan    <before.json> <candidate.json> <context.json> <plan.json>
apply   <before.json> <candidate.json> <context.json> <plan.json>
finish  <runId> <before.json> <after.json> <context.json> <plan.json>
rollback <runId> <plan.json>

The approved interest must already have been added using the existing interests control.
The pinned Python helper must create before/candidate/after bundles; this command never
creates or treats a temporary extraction graph as authoritative.`);
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

assertConfig();
const [command, ...args] = process.argv.slice(2);
const handlers = { prepare, plan, apply, finish, rollback };
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
