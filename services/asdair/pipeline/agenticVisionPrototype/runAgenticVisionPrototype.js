// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/runAgenticVisionPrototype.js
//
// The runnable script that exercises this prototype against one real
// photograph and reports tool-call rounds, real per-turn usage/cost, and the
// final line list with provenance on every line.
//
// ── WO-2026-08-12-01-v2 (WP-B15-29) ─────────────────────────────────────
// Extended from "coverage only" to "coverage PLUS grounding", and from one
// shape of run to two comparable ARMS:
//
//   ARM A  --from-db                 unconstrained loop + real catalogue
//   ARM B  --from-db --constrained   strict-schema loop + real catalogue
//
// The arms exist to isolate ONE variable each against the run already on
// record (unconstrained, NO catalogue). Arm A answers what the household
// catalogue alone does; Arm B answers what structural grounding adds ON TOP.
// A "no catalogue + constrained" arm was deliberately NOT built: with no
// candidates the enum holds only the two escape values, so every line is
// necessarily UNKNOWN and "correct" is structurally zero - a degenerate
// measurement that could not be compared with anything.
//
// USAGE:
//   node --env-file=<env> runAgenticVisionPrototype.js <photo.jpg> \
//     [--from-db] [--household=1] [--catalogue=<path.json>] [--constrained] \
//     [--ground-truth=<path.json>] [--max-iterations=4] [--label=arm-a] [--out=<dir>]
//
// CREDENTIALS: consumed from `process.env` ONLY, supplied by `node --env-file`
// per services/asdair/CONFIGURATION.md. This file never opens, parses, prints
// or writes an env file, and never echoes a credential into a log or an
// artefact.
//
// DATABASE: SELECT-only, through the product's OWN
// services/asdair/interpret/loadCatalogue.js. No INSERT, UPDATE, DELETE or
// DDL exists anywhere in this prototype.
//
// STILL STANDALONE: nothing here imports interpretPhotoOrchestrator.js,
// deps.js or runPipeline.js, and nothing in those files imports this. The
// only production modules reused are read-only ones: imagePrep/imageRender,
// photoSanityChecks (via groundLines.js) and loadCatalogue.
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
// non-image functions stay importable and testable even where sharp is absent.
import { buildAgenticPrompt } from './buildAgenticPrompt.js';
import { runAgenticVisionLoop, DEFAULT_MAX_TOOL_CALL_ROUNDS } from './agenticLoop.js';
import { REQUEST_CROP_TOOL } from './tools.js';
import { buildLineSchema, buildTextFormat, buildProductIdEnum } from './lineSchema.js';
import { groundLines } from './groundLines.js';
import { loadGroundTruth, scoreSevenWay, formatSevenWay } from './sevenWayScore.js';
import { loadFixture, scoreTwoLayer, formatTwoLayer } from './twoLayerScore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * ⚠️ NOT ON THIS BRANCH, and that was silent. `2026-08-12-photo-ground-truth-
 * 39-lines.json` was committed to `main` and never to this branch, so this
 * path resolves to a missing file here: `rescoreArtefact()` threw on it, and a
 * live run printed "NOT SCORED" and banked `score: null` rather than failing.
 * Found at the WP-B15-30 read-back, before it cost a second live run.
 *
 * It is kept, and kept OPTIONAL, because it is still correct for a head that
 * carries the file. The AC3 fixture below is what actually grades from
 * WP-B15-30 onward, and it lives in-surface where this branch can reach it.
 */
export const DEFAULT_GROUND_TRUTH_PATH = path.join(
  __dirname, '..', '..', '..', '..', 'Deliverables', '2026-08-12-photo-ground-truth-39-lines.json',
);

/**
 * The AC3 acceptance fixture - the grading instrument from WP-B15-30 onward.
 * ⛔ TEST DATA ONLY (Warwick). No production path reads it.
 */
export const DEFAULT_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'photo39.fixture.json');

/**
 * Read a `--catalogue=<path>` JSON file: an array of `{name, aliases?}` (or
 * `{id, name, aliases?}` for a constrained run). Returns `[]` when the path is
 * falsy - an empty catalogue is a legitimate, tested input.
 * @param {string|undefined} catalogPath
 * @returns {Array<object>}
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
 * Normalise one `compactRegular` row from the product's own loadCatalogue into
 * this prototype's candidate shape.
 *
 * `id` is stringified deliberately. `asdair.regulars.id` is a bigint and
 * node-postgres returns it as a STRING; keeping ONE textual form from the
 * enum, through the model's answer, to the score means there is no place for a
 * `Number()`/string mismatch to silently lose a match. That exact hazard,
 * in `loadCatalogue`'s own `regularsById`, has already broken one live shop.
 */
export function toCandidate(row) {
  return {
    id: String(row.id),
    name: row.name,
    aliases: Array.isArray(row.aka) ? row.aka : [],
    brand: row.brand ?? null,
    category: row.category ?? null,
    typicalQty: row.typical_qty ?? null,
  };
}

/**
 * Load the REAL household catalogue through the product's own route.
 * SELECT-only. Opens a pg client from ASDAIR_DB_URL (the SELECT-only role),
 * and always closes it.
 *
 * @param {number} householdId
 * @returns {Promise<Array<object>>} candidates in this prototype's shape.
 */
export async function loadCatalogueFromDb(householdId) {
  const dbUrl = process.env.ASDAIR_DB_URL;
  if (!dbUrl) {
    throw new Error('runAgenticVisionPrototype: ASDAIR_DB_URL is not set - supply it with node --env-file, never inline');
  }
  const { default: pg } = await import('pg');
  const interop = await import('../../interpret/loadCatalogue.js');
  const loader = interop.loadCatalogue ?? interop.default?.loadCatalogue;
  if (typeof loader !== 'function') {
    throw new Error('runAgenticVisionPrototype: could not resolve loadCatalogue from services/asdair/interpret/loadCatalogue.js');
  }
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const catalogue = await loader(client, householdId);
    return catalogue.candidates.map(toCandidate);
  } finally {
    await client.end();
  }
}

/**
 * Prepare one photo into the full-page data URL plus every region's data URL.
 *
 * ── AC1: REGION 1 IS NOW IN THE CROP MAP ────────────────────────────────
 * The loop advertised regions `1..N` to the model while `regionImageUrls` held
 * only `2..N` - the full page was passed separately as `fullPageImageUrl` and
 * existed nowhere the crop lookup could find it. So the ONE region the model
 * was most likely to ask for mid-loop (a full-page re-look, which live
 * evidence shows it genuinely uses as a coverage strategy) was the one region
 * that could not be served: a split representation of the same thing.
 *
 * The fix is the narrow one - region 1 is now ALSO in the map, keyed like any
 * other region, while turn 1 still receives the full page separately exactly
 * as before. Note what is deliberately NOT done: region 1 is not withdrawn
 * from the advertised list. Removing it would "fix" the crash by deleting a
 * coverage strategy, which is trading the thing this prototype is for against
 * a wiring bug.
 *
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
  const regionNos = [];
  for (const [regionNo, buffer] of byRegionNo) {
    regionImageUrls[regionNo] = regionNo === 1 ? fullPageImageUrl : toDataUrl(buffer);
    regionNos.push(regionNo);
  }
  regionNos.sort((a, b) => a - b);
  return { fullPageImageUrl, regionImageUrls, regionNos };
}

/**
 * Run the prototype against one real photo file.
 *
 * @param {object} args
 * @param {string} args.imagePath
 * @param {Array<object>} [args.catalogueItems]
 * @param {number} [args.maxIterations]
 * @param {boolean} [args.constrained] - AC2: send the strict JSON schema.
 * @returns {Promise<object>} the loop's result, plus timing, cost, the exact
 *   `text.format` body sent (for the wire proof), and the grounded lines.
 */
export async function runAgainstPhoto({
  imagePath, catalogueItems = [], maxIterations = DEFAULT_MAX_TOOL_CALL_ROUNDS, constrained = false,
}) {
  const buf = fs.readFileSync(imagePath);
  const { fullPageImageUrl, regionImageUrls, regionNos } = await prepareForAgenticLoop(buf);
  const prompt = buildAgenticPrompt({ catalogueItems, regionNos, constrained });

  let textFormat = null;
  let productIdEnum = null;
  if (constrained) {
    productIdEnum = buildProductIdEnum(catalogueItems);
    textFormat = buildTextFormat(buildLineSchema({ candidates: catalogueItems, regionNos }));
  }

  const startedAt = Date.now();
  const result = await runAgenticVisionLoop({
    prompt, fullPageImageUrl, regionImageUrls, tool: REQUEST_CROP_TOOL, maxIterations, textFormat,
  });
  const elapsedMs = Date.now() - startedAt;

  const knownCosts = result.turns.map((t) => t.costUsd).filter((c) => c !== null);
  const totalCostUsd = knownCosts.length > 0 ? knownCosts.reduce((sum, c) => sum + c, 0) : null;

  // AC3-AC8: the application decides what it believes.
  const grounded = result.lines === null
    ? null
    : groundLines({ lines: result.lines, productIdEnum, regionNos });

  return {
    ...result,
    elapsedMs,
    totalCostUsd,
    regionNos,
    constrained,
    textFormatSent: textFormat,
    productIdEnum,
    grounded,
  };
}

/** Human-readable report - rounds, per-turn cost, and the grounded outcome. */
export function printReport(report) {
  process.stdout.write('\nAgentic vision prototype run report\n');
  process.stdout.write(`  mode: ${report.constrained ? 'CONSTRAINED (strict json_schema)' : 'unconstrained'}\n`);
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
      const written = line.as_written ?? line.raw_reading;
      process.stdout.write(`    line ${line.line_no}: "${written}" id=${line.product_id ?? '(none)'} qty=${line.quantity ?? '(none)'} source_region=${line.source_region ?? '(unknown)'} conf=${line.confidence ?? '?'}\n`);
    });
  }
  if (report.grounded) {
    const c = report.grounded.counts;
    process.stdout.write('  GROUNDING (application-side):\n');
    process.stdout.write(`    enum verified client-side: ${report.grounded.enumVerified ? 'YES' : 'no enum sent (unconstrained arm)'}\n`);
    process.stdout.write(`    accepted as PHOTO truth: ${c.accepted}  rejected: ${c.rejected}\n`);
    process.stdout.write(`    identified: ${c.identified}  explicit UNKNOWN: ${c.unknownVisible}  NOT_A_LINE: ${c.notALine}\n`);
    process.stdout.write(`    region-rejected: ${c.regionRejected}  quantity nulled: ${c.quantityNulled}\n`);
    process.stdout.write(`    duplicate groups: ${c.duplicateGroups} (cross-region collisions, no survivor: ${c.crossRegionCollisions})\n`);
    process.stdout.write(`    look-again regions (confidence trigger only): ${report.grounded.lookAgainRegions.join(', ') || '(none)'}\n`);
  }
}

function argValue(name, fallback = undefined) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/**
 * Re-score a SAVED run artefact, without calling the gateway again.
 *
 * This exists because a scoring defect found after a live run must not force
 * a second live run to correct: the raw model output is already banked in the
 * artefact, so re-grounding and re-scoring it is a pure recomputation over
 * the SAME evidence. It also makes every number in the report reproducible by
 * anyone holding the artefact.
 */
export function rescoreArtefact(artefactPath, { fixturePath = DEFAULT_FIXTURE_PATH, groundTruthPath = null } = {}) {
  const artefact = JSON.parse(fs.readFileSync(artefactPath, 'utf8'));
  const grounded = groundLines({
    lines: artefact.rawLines,
    productIdEnum: artefact.constrained ? artefact.productIdEnum ?? null : null,
    regionNos: artefact.regionNos ?? [...new Set((artefact.rawLines || []).map((l) => Number(l.source_region)))],
  });

  // AC4 - the instrument that grades. Two layers, never one number.
  const fixture = loadFixture(fixturePath);
  const twoLayer = scoreTwoLayer({
    accepted: grounded.accepted,
    rejected: grounded.rejected,
    duplicateGroups: grounded.duplicateGroups,
    fixture,
  });

  // The superseded seven-category scorer, run ONLY when its ground-truth file
  // is actually present. It is retained for like-for-like comparison with the
  // WP-B15-29 numbers already on the record - never as the deciding measure.
  let sevenWay = null;
  if (groundTruthPath && fs.existsSync(groundTruthPath)) {
    sevenWay = scoreSevenWay({
      accepted: grounded.accepted,
      rejected: grounded.rejected,
      duplicateGroups: grounded.duplicateGroups,
      groundTruth: loadGroundTruth(groundTruthPath),
      catalogueById: new Map((artefact.catalogue || []).map((c) => [String(c.id), c])),
      identityMode: artefact.constrained ? 'enum' : 'verbatim',
    });
  }

  return { artefact, grounded, twoLayer, sevenWay };
}

async function main() {
  const rescorePath = argValue('rescore');
  if (rescorePath) {
    const fixturePath = argValue('fixture', DEFAULT_FIXTURE_PATH);
    const gtPath = argValue('ground-truth', null);
    const {
      artefact, grounded, twoLayer, sevenWay,
    } = rescoreArtefact(rescorePath, { fixturePath, groundTruthPath: gtPath });
    process.stdout.write(`\nRE-SCORED on the CORRECTED instrument (no gateway call) from ${rescorePath}\n`);
    process.stdout.write(`  grounding: accepted ${grounded.counts.accepted}, rejected ${grounded.counts.rejected}, `
      + `identified ${grounded.counts.identified}, explicit UNKNOWN ${grounded.counts.unknownVisible}, `
      + `no identity claim ${grounded.counts.noIdentityClaim}, sanity-flagged ${grounded.counts.quantityNulled}, `
      + `qty from page ${grounded.counts.quantityFromPage}, qty defaulted ${grounded.counts.quantityDefaulted}, `
      + `model qty discarded ${grounded.counts.modelQuantityDiscarded}, `
      + `cross-region collisions ${grounded.counts.crossRegionCollisions}\n`);
    process.stdout.write(`${formatTwoLayer(twoLayer, artefact.label)}\n`);
    process.stdout.write(`  omitted page lines: ${twoLayer.omittedPageLines.map((o) => `#${o.page_order} ${o.source_text}`).join(' | ') || '(none)'}\n`);
    process.stdout.write('  LIMITS (print these WITH the numbers, never without):\n');
    twoLayer.limits.forEach((l) => process.stdout.write(`    - ${l}\n`));
    if (sevenWay) {
      process.stdout.write(`\n  SUPERSEDED seven-category scorer, for comparison only:\n${formatSevenWay(sevenWay, artefact.label)}\n`);
    }
    fs.writeFileSync(rescorePath, `${JSON.stringify({
      ...artefact, grounded, twoLayerScore: twoLayer, score: sevenWay ?? artefact.score ?? null,
    }, null, 2)}\n`);
    process.stdout.write(`  artefact updated in place: ${rescorePath}\n`);
    return;
  }

  const imagePath = process.argv[2];
  if (!imagePath) {
    process.stderr.write('usage: node --env-file=<env> runAgenticVisionPrototype.js <photo.jpg> [--from-db] [--household=1] [--catalogue=<path>] [--constrained] [--ground-truth=<path>] [--max-iterations=4] [--label=<name>] [--out=<dir>]\n');
    process.exitCode = 1;
    return;
  }
  const constrained = hasFlag('constrained');
  const householdId = Number(argValue('household', '1'));
  const label = argValue('label', constrained ? 'arm-b' : 'arm-a');

  const catalogueItems = hasFlag('from-db')
    ? await loadCatalogueFromDb(householdId)
    : loadCatalogue(argValue('catalogue'));
  process.stdout.write(`catalogue: ${catalogueItems.length} candidate(s)${hasFlag('from-db') ? ` (household ${householdId}, SELECT-only)` : ''}\n`);

  const report = await runAgainstPhoto({
    imagePath,
    catalogueItems,
    maxIterations: Number(argValue('max-iterations', String(DEFAULT_MAX_TOOL_CALL_ROUNDS))),
    constrained,
  });
  printReport(report);

  // AC9/AC10 - score against the 39-line denominator when one is available.
  let score = null;
  const groundTruthPath = argValue('ground-truth', DEFAULT_GROUND_TRUTH_PATH);
  if (report.grounded && fs.existsSync(groundTruthPath)) {
    const groundTruth = loadGroundTruth(groundTruthPath);
    const catalogueById = new Map(catalogueItems.map((c) => [String(c.id), c]));
    score = scoreSevenWay({
      accepted: report.grounded.accepted,
      rejected: report.grounded.rejected,
      duplicateGroups: report.grounded.duplicateGroups,
      groundTruth,
      catalogueById,
      identityMode: constrained ? 'enum' : 'verbatim',
    });
    process.stdout.write(`\nSEVEN-CATEGORY SCORE - ${label}\n${formatSevenWay(score, label)}\n`);
    process.stdout.write('  LIMITS (print these WITH the number, never without):\n');
    score.limits.forEach((l) => process.stdout.write(`    - ${l}\n`));
  } else if (report.grounded) {
    process.stdout.write(`\nNOT SCORED: no ground-truth file at ${groundTruthPath}\n`);
  }

  const outDir = argValue('out', path.join(__dirname, 'runs'));
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `${stamp}-${label}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify({
    label,
    constrained,
    householdId: hasFlag('from-db') ? householdId : null,
    catalogueSize: catalogueItems.length,
    regionNos: report.regionNos,
    // The catalogue is saved WITH the run so the artefact is re-scorable
    // without a second database read or a second gateway call. Household
    // shopping content is explicitly committable to this repository
    // (GL-009, ruling BUILD-015-SHOPPING-DATA-CLASSIFICATION).
    catalogue: catalogueItems,
    // The exact body sent, so the wire proof is evidence rather than a claim.
    textFormatSent: report.textFormatSent,
    productIdEnumSize: report.productIdEnum ? report.productIdEnum.length : null,
    turns: report.turns,
    toolCallRounds: report.toolCallRounds,
    hitIterationCap: report.hitIterationCap,
    elapsedMs: report.elapsedMs,
    totalCostUsd: report.totalCostUsd,
    rawLines: report.lines,
    grounded: report.grounded,
    score,
  }, null, 2)}\n`);
  process.stdout.write(`\nrun artefact: ${outPath}\n`);
}

// CLI entrypoint - only runs when this file is executed directly, so
// importing it (as the tests do) never touches the network.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
