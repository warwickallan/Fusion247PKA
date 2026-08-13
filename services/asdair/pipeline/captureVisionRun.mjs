// =====================================================================
// BUILD-015 AsdAIr - pipeline/captureVisionRun.mjs
//
// WO-2026-08-13-15 (WP-B15-47). CAPTURE THE REAL VISION TRAFFIC of a real
// interpretation of the committed photograph, and commit it, so that the rest
// of the journey can be driven for real by a process that holds no credential.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────
// The gateway carrier for this estate sits at the ROOT of C:/.fusion247/,
// which GL-012 never permits as a worker grant - three workers have refused on
// that boundary. So the ONE credentialed action in this journey, the
// vision(prompt, imageUrls) HTTP call, is executed here, by an operator who
// holds the credential, and its verbatim answers are committed.
//
// ── WHY IT DRIVES THE REAL PATH INSTEAD OF REBUILDING IT ─────────────────
// This harness calls `deps.js`'s own `realInterpretPhoto`. It does NOT
// hand-assemble a parallel collaborator container. A parallel assembly would
// diverge from production the moment either changed, and the entire value of
// the captured artefact is that it is the REAL orchestrator's REAL traffic -
// the real prompts, in the real order, with the real region geometry. A
// harness that reimplemented the wiring in order to observe it would quietly
// undermine the thing it exists to prove.
//
// ── WHAT IT SUBSTITUTES: PERSISTENCE ONLY, AND NOTHING ELSE ──────────────
// ⛔ THIS HARNESS WRITES NOTHING TO ANY DATABASE. `insertRegionBatch` and
// `insertPhotoProvenanceBatch` are replaced by recorders, and `writeQuery` is
// replaced by a function that THROWS if anything reaches it - so "it persisted
// nothing" is enforced rather than asserted.
//
// That is deliberate and it is not tidiness: AC2 requires the provenance rows
// to belong to the shop THE CONSUMING RUN creates. If this process wrote them,
// they would not be from that run, and it would be reporting rows it did not
// persist.
//
// ── CREDENTIALS: BY RUNTIME, NEVER BY THIS FILE ──────────────────────────
// ⛔ This file opens, reads, prints, echoes and logs NO credential carrier, and
// hard-codes NO path to one. Values arrive through `node --env-file=<path>`,
// exactly as runtime.js and migrate-command-ledger.js already do. Only the
// NAMES of variables appear here. It fails loudly when a required value is
// absent rather than proceeding to a confusing gateway error.
//
// ── RUN IT ───────────────────────────────────────────────────────────────
//   node --env-file=<path-to-env> captureVisionRun.mjs [--household=1] [--shop-id=<n>]
//
// Requires in that environment: FUSION_GATEWAY_URL (+ key/model as the gateway
// needs) and ASDAIR_DB_URL pointing at a THROWAWAY Postgres - the catalogue is
// loaded READ-ONLY through the real production loader so the grounded prompt
// is the real grounded prompt.
// =====================================================================

'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  KNOWN_PHOTO_PATH, KNOWN_PHOTO_SHA256, ARTEFACT_DIR,
  assertPhotoIdentity, computeRegionPlan, regionPlanSha256, validateArtefact,
} from './visionRunArtefact.mjs';

const argOf = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/** Fail loudly and by NAME. Never prints or infers a value. */
function requireEnvName(name) {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(
      `captureVisionRun: ${name} is not set. Pass the environment through `
      + '`node --env-file=<path> captureVisionRun.mjs`. This file never opens a credentials file itself '
      + 'and never contains a path to one.',
    );
  }
  return name;
}

async function main() {
  const photoPath = argOf('photo', KNOWN_PHOTO_PATH);
  const householdId = Number(argOf('household', '1'));
  const shopId = Number(argOf('shop-id', '999000'));

  // ── 1. IDENTITY FIRST, BEFORE ANYTHING ELSE HAPPENS ────────────────────
  // A wrong file must fail here rather than spend real money producing a
  // plausible artefact over the wrong page.
  const photoSha = assertPhotoIdentity(photoPath, KNOWN_PHOTO_SHA256);
  console.log(`captureVisionRun: photograph identity OK - ${photoSha}`);

  // ── 2. REQUIRED ENVIRONMENT, BY NAME ONLY ──────────────────────────────
  requireEnvName('FUSION_GATEWAY_URL');
  requireEnvName('ASDAIR_DB_URL');
  console.log('captureVisionRun: required environment present (names checked, values never read out)');

  // ── 3. THE REGION PLAN, from the real production modules ───────────────
  const imageBuffer = readFileSync(photoPath);
  const plan = await computeRegionPlan(imageBuffer);
  const planSha = regionPlanSha256(plan);
  console.log(`captureVisionRun: region plan - axis=${plan.axis} regions=${plan.regions.length} sha256=${planSha}`);

  // ── 4. THE REAL CATALOGUE, through the real read-only loader ───────────
  const { createDeps, closeDeps, realInterpretPhoto } = await import('./deps.js');
  const deps = createDeps();
  const catalogue = await deps.loadCatalogue(householdId);
  const catalogueSize = Array.isArray(catalogue.candidates) ? catalogue.candidates.length : 0;
  if (catalogueSize === 0) {
    throw new Error(`captureVisionRun: household ${householdId} loaded an EMPTY catalogue - refusing to capture an ungrounded reading`);
  }
  console.log(`captureVisionRun: catalogue loaded - household=${householdId} candidates=${catalogueSize}`);

  // ── 5. THE RECORDERS. Persistence is INERT and PROVABLY so ─────────────
  const regionRowsSeen = [];
  const provenanceRowsSeen = [];
  const inertInsertRegionBatch = async (_deps, sid, regions) => {
    regionRowsSeen.push({ shopId: sid, count: regions.length });
    // The orchestrator needs a region_no -> id map to cite. Synthetic ids are
    // correct here precisely BECAUSE nothing is persisted: the consuming run
    // inserts the real rows and gets the real ids.
    return new Map(regions.map((r) => [r.region_no, -r.region_no]));
  };
  const inertInsertPhotoProvenanceBatch = async (_deps, lines) => {
    provenanceRowsSeen.push(lines.length);
  };
  const refusingWriteQuery = async (sql) => {
    throw new Error(
      'captureVisionRun: a WRITE reached the database from the capture harness, which must persist NOTHING. '
      + `Refused: ${String(sql).slice(0, 120)}`,
    );
  };

  // ── 6. THE ONE OBSERVED SEAM ───────────────────────────────────────────
  const calls = [];
  const onVisionCall = ({ seq, kind, regions, retry, response, cost_usd: costUsd }) => {
    calls.push({ seq, kind, regions, retry, response, cost_usd: costUsd ?? null });
    console.log(`captureVisionRun: recorded call ${seq} kind=${kind} regions=[${(regions || []).join(',')}] retry=${retry} chars=${String(response).length}`);
  };

  const startedAt = new Date().toISOString();
  const lines = await realInterpretPhoto(
    { catalogue, imagePath: photoPath, shopId },
    {
      onVisionCall,
      collaboratorOverrides: {
        insertRegionBatch: inertInsertRegionBatch,
        insertPhotoProvenanceBatch: inertInsertPhotoProvenanceBatch,
        writeQuery: refusingWriteQuery,
      },
    },
  );

  // ── 7. THE ARTEFACT ────────────────────────────────────────────────────
  // Both resolved from their OWN canonical modules - the same ones deps.js
  // reads them from - so the artefact records what the run actually used
  // rather than a second copy of the value.
  const { ROLE_ALIAS } = await import('../../obsidiwikai/src/core/models.mjs');
  const groundedPrompt = await import('../interpret/groundedPrompt.js');
  const PROMPT_VERSION = groundedPrompt.PROMPT_VERSION ?? groundedPrompt.default?.PROMPT_VERSION;
  if (!PROMPT_VERSION) throw new Error('captureVisionRun: could not resolve PROMPT_VERSION from ../interpret/groundedPrompt.js');

  const totalCostUsd = calls.reduce((sum, c) => sum + (c.cost_usd ?? 0), 0);
  const artefact = {
    captured_at: startedAt,
    photo_path: 'services/asdair/pipeline/testdata/known-list/mum-list-2026-08-11.jpg',
    photo_sha256: photoSha,
    household_id: householdId,
    catalogue_size: catalogueSize,
    interpreter_model: ROLE_ALIAS.vision,
    prompt_version: PROMPT_VERSION,
    region_plan_sha256: planSha,
    region_count: plan.regions.length,
    calls: calls.map(({ seq, kind, regions, retry, response }) => ({ seq, kind, regions, retry, response })),
    vision_calls: calls.length,
    total_cost_usd: Number(totalCostUsd.toFixed(6)),
    // Observability only - the consuming run recomputes all of this for real.
    captured_line_count: Array.isArray(lines) ? lines.length : null,
    persisted_nothing: { region_batches: regionRowsSeen.length, provenance_batches: provenanceRowsSeen.length, writes: 0 },
  };

  validateArtefact(artefact);

  const outPath = join(ARTEFACT_DIR, `vision-run-${startedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(outPath, `${JSON.stringify(artefact, null, 2)}\n`, 'utf8');

  console.log('');
  console.log('captureVisionRun: WROTE ' + outPath);
  console.log(`captureVisionRun:   interpreter_model  = ${artefact.interpreter_model}`);
  console.log(`captureVisionRun:   prompt_version     = ${artefact.prompt_version}`);
  console.log(`captureVisionRun:   region_plan_sha256 = ${artefact.region_plan_sha256}`);
  console.log(`captureVisionRun:   vision_calls       = ${artefact.vision_calls}`);
  console.log(`captureVisionRun:   total_cost_usd     = ${artefact.total_cost_usd}`);
  console.log(`captureVisionRun:   captured_line_count= ${artefact.captured_line_count}`);
  console.log('captureVisionRun: persisted NOTHING (writeQuery was a refusing stub throughout).');

  await closeDeps();
}

main().catch((err) => {
  console.error(`captureVisionRun: FAILED - ${err.message}`);
  process.exitCode = 1;
});
