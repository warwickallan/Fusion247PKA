// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/runAgenticVisionPrototype.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC5: a runnable script, callable
// by Asdair against the real gateway, that exercises this prototype against
// one real photograph and reports the tool-call round count, the real
// per-turn usage/cost (via the corrected AC4 estimateUsdCost()), and the
// final structured line list with source_region provenance on every line.
//
// USAGE (Asdair, later, with a real gateway configured - mirrors
// abAcceptanceHarness.js's own established CLI convention):
//   FUSION_GATEWAY_URL=... FUSION_GATEWAY_KEY=... node runAgenticVisionPrototype.js \
//     <path-to-photo.jpg> [--catalogue=<path-to-catalogue.json>] [--max-iterations=4]
//
// `--catalogue` points at a JSON file: an array of
// `{"name": string, "aliases"?: string[]}` (the household's known Regulars/
// Favourites, as buildAgenticPrompt.js documents). Omit it for an empty
// catalogue (still buildable - see buildAgenticPrompt.test.js). This script
// never fetches that data itself: no DB access, no credentials
// (`credential_scope: none`, `live_authority: none`) - Asdair supplies it
// already loaded, exactly as AC5's own text says ("you do not run it - no
// credentials, same as every prior round").
//
// ── BUILT, CALLABLE, NOT EXECUTED BY KEEL ───────────────────────────────
// Every piece of THIS script's own logic (image prep/render reuse, prompt
// building, report formatting) is unit-testable and IS tested, without
// network, in this directory's own test files. `main()` - the part that
// actually drives runAgenticVisionLoop() against the REAL gateway - has
// never been executed by this Work Order (`network: none`); that run is
// Asdair's, per AC5's own text and this build's established precedent
// (abAcceptanceHarness.js carries the identical "BUILT, CALLABLE, NOT
// EXECUTED" note for the same reason).
//
// STANDALONE: imports ONLY imagePrep.js/imageRender.js (pure, deterministic,
// architecture-agnostic image preparation - "unchanged, already built" per
// the architecture doc's own diagram) and this directory's own modules.
// Nothing here imports interpretPhotoOrchestrator.js, deps.js or
// runPipeline.js, and nothing in those files imports this.
// =====================================================================

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareImage } from '../imagePrep.js';
// `imageRender.js` is LAZILY imported inside prepareForAgenticLoop() below,
// NOT at module top level - it statically imports `sharp`, which may not be
// installed in every environment (imageRender.test.js's own header documents
// exactly this: "a CI job that never ran npm install for this package").
// deps.js already establishes this convention in this same package ("lazily
// await import()s this module only inside the one function that needs it") -
// followed here rather than reinvented, and it is what lets THIS module's
// non-image functions (loadCatalogue, printReport) stay importable and
// testable even where sharp is absent.
import { buildAgenticPrompt } from './buildAgenticPrompt.js';
import { runAgenticVisionLoop, DEFAULT_MAX_TOOL_CALL_ROUNDS } from './agenticLoop.js';
import { REQUEST_CROP_TOOL } from './tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read a `--catalogue=<path>` JSON file: an array of
 * `{name, aliases?}`. Returns `[]` when `catalogPath` is falsy - an empty
 * catalogue is a legitimate, tested input (buildAgenticPrompt.test.js).
 * @param {string|undefined} catalogPath
 * @returns {Array<{name:string, aliases?:string[]}>}
 */
export function loadCatalogue(catalogPath) {
  if (!catalogPath) return [];
  const raw = fs.readFileSync(catalogPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('runAgenticVisionPrototype: --catalogue file must be a JSON array of {name, aliases?}');
  }
  return parsed;
}

/**
 * Prepare one photo (deterministic, sharp-based - the SAME first step the
 * redesigned architecture's own diagram names as "unchanged, already built")
 * into the full-page data URL plus every strip's data URL, keyed by
 * region_no - exactly the shape runAgenticVisionLoop() expects.
 * @param {Buffer} buf - the raw, as-received photo bytes.
 * @returns {Promise<{fullPageImageUrl:string, regionImageUrls:Record<number,string>, regionNos:number[]}>}
 */
export async function prepareForAgenticLoop(buf) {
  const { renderAllRegions, toDataUrl } = await import('../imageRender.js');
  const prepared = prepareImage(buf);
  const transform = { rotate: prepared.rotate, flip: prepared.flip };
  // ONE prepare pass, every region cropped from the SAME prepared buffer -
  // including region_no 1 (full_page), which renderRegionCrop() returns as
  // the whole prepared page re-encoded (imageRender.js's own documented
  // behaviour) - so this is the ONLY render pass, never a duplicate one for
  // "the full page" separately.
  const rendered = await renderAllRegions(buf, transform, prepared.regions);
  const byRegionNo = new Map(rendered.map((r) => [r.region_no, r.buffer]));
  const fullPageBuf = byRegionNo.get(1);
  if (!fullPageBuf) {
    throw new Error('runAgenticVisionPrototype: prepareImage() did not return a full_page region (region_no 1) - imagePrep.js contract violated');
  }
  const fullPageImageUrl = toDataUrl(fullPageBuf);
  const regionImageUrls = {};
  const regionNos = [1];
  for (const [regionNo, buffer] of byRegionNo) {
    if (regionNo === 1) continue; // handled separately as fullPageImageUrl
    regionImageUrls[regionNo] = toDataUrl(buffer);
    regionNos.push(regionNo);
  }
  return { fullPageImageUrl, regionImageUrls, regionNos };
}

/**
 * Run the full prototype against one real photo file: prepare it, build the
 * prompt, run the agentic loop, and return a report shape ready to print.
 * THIS is the function whose call to runAgenticVisionLoop() actually reaches
 * the live gateway (via runAgenticVisionLoop()'s default `callModel` =
 * models.mjs's real visionAgenticTurn) - see the module header: Keel has
 * never executed this function.
 * @param {object} args
 * @param {string} args.imagePath
 * @param {Array<{name:string, aliases?:string[]}>} [args.catalogueItems]
 * @param {number} [args.maxIterations]
 * @returns {Promise<object>} the loop's own result, plus `elapsedMs`,
 *   `totalCostUsd`, and `regionNos`.
 */
export async function runAgainstPhoto({ imagePath, catalogueItems = [], maxIterations = DEFAULT_MAX_TOOL_CALL_ROUNDS }) {
  const buf = fs.readFileSync(imagePath);
  const { fullPageImageUrl, regionImageUrls, regionNos } = await prepareForAgenticLoop(buf);
  const prompt = buildAgenticPrompt({ catalogueItems, regionNos });

  const startedAt = Date.now();
  const result = await runAgenticVisionLoop({
    prompt, fullPageImageUrl, regionImageUrls, tool: REQUEST_CROP_TOOL, maxIterations,
  });
  const elapsedMs = Date.now() - startedAt;

  const knownCosts = result.turns.map((t) => t.costUsd).filter((c) => c !== null);
  const totalCostUsd = knownCosts.length > 0 ? knownCosts.reduce((sum, c) => sum + c, 0) : null;

  return {
    ...result, elapsedMs, totalCostUsd, regionNos,
  };
}

/** Human-readable report to stdout - tool-call round count, per-turn cost, final lines with provenance. */
export function printReport(report) {
  process.stdout.write('\nAgentic vision prototype run report\n');
  process.stdout.write(`  turns: ${report.turns.length}\n`);
  process.stdout.write(`  tool-call rounds: ${report.toolCallRounds}${report.hitIterationCap ? ' (ITERATION CAP HIT)' : ''}\n`);
  process.stdout.write(`  elapsed: ${report.elapsedMs}ms\n`);
  process.stdout.write(`  total cost (USD, AC4-corrected pricing): ${report.totalCostUsd === null ? 'unknown (no usage reported by the gateway)' : `$${report.totalCostUsd.toFixed(4)}`}\n`);
  report.turns.forEach((t) => {
    const cost = t.costUsd === null ? '?' : `$${t.costUsd.toFixed(4)}`;
    process.stdout.write(`    turn ${t.turnNo}: response=${t.responseId} region-requested=${t.requestedRegion ?? '(none)'} cost=${cost}\n`);
  });
  if (report.lines === null) {
    process.stdout.write('  FINAL ANSWER: could not be parsed as strict JSON with a "lines" array.\n');
  } else {
    process.stdout.write(`  FINAL ANSWER: ${report.lines.length} line(s)\n`);
    report.lines.forEach((line) => {
      process.stdout.write(`    line ${line.line_no}: "${line.raw_reading}" qty=${line.quantity ?? '(none)'} source_region=${line.source_region ?? '(unknown)'}\n`);
    });
  }
}

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    process.stderr.write('usage: FUSION_GATEWAY_URL=... FUSION_GATEWAY_KEY=... node runAgenticVisionPrototype.js <path-to-photo.jpg> [--catalogue=<path-to-catalogue.json>] [--max-iterations=4]\n');
    process.exitCode = 1;
    return;
  }
  const catalogueArg = process.argv.find((a) => a.startsWith('--catalogue='));
  const catalogueItems = loadCatalogue(catalogueArg ? catalogueArg.split('=')[1] : undefined);
  const maxIterArg = process.argv.find((a) => a.startsWith('--max-iterations='));
  const maxIterations = maxIterArg ? Number(maxIterArg.split('=')[1]) : DEFAULT_MAX_TOOL_CALL_ROUNDS;

  const report = await runAgainstPhoto({ imagePath, catalogueItems, maxIterations });
  printReport(report);
}

// CLI entrypoint - only runs when this file is executed directly, so
// importing it (as the tests do) never touches the network. Same pattern as
// abAcceptanceHarness.js.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
