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
import { prepareImage, readExifOrientation } from '../imagePrep.js';
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
import {
  loadFixture, scoreTwoLayer, formatTwoLayer, scoreMetricFamilies, formatFamilies,
} from './twoLayerScore.js';
import { applyVisualEvidenceGate } from './visualEvidenceGate.js';
import { planOrientationAwareBands, proveCoverage, DEFAULT_BAND_COUNT } from './bandPlan.js';
import { inspectBandsIndividually, reconcileAcrossBands } from './bandInspection.js';

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

  // ── WP-B15-33 AC4: RE-SCORE A BANDED ARTEFACT THROUGH THE WHOLE CURRENT
  //    PIPELINE, not just the scorer ────────────────────────────────────────
  //
  // The re-score used to stop at `groundLines`, which meant a banded artefact
  // was graded on a set the run itself never acted on - reconciliation and the
  // AC3 gate both come after it. That made the before/after illegible for
  // exactly the artefacts this order has to compare. Where the artefact carries
  // a band plan, the same reconciliation and the same gate the live run uses
  // are replayed here over the SAME banked raw lines, so the only variable
  // between the old number and the new one is the instrument.
  const plan = artefact.plan ?? null;
  const isBanded = Boolean(plan?.regions?.length);
  const reconciliation = isBanded
    ? reconcileAcrossBands({
      lines: grounded.accepted,
      regions: plan.regions,
      axis: plan.axis,
      linePitch: plan.linePitch?.pitch ?? null,
    })
    : null;
  const gate = isBanded
    ? applyVisualEvidenceGate({
      lines: reconciliation.reconciled,
      regions: plan.regions,
      axis: plan.axis,
      linePitch: plan.linePitch?.pitch ?? null,
    })
    : null;
  const finalLines = gate ? gate.lines : grounded.accepted;

  // AC4 - the instrument that grades. Two layers, never one number.
  const fixture = loadFixture(fixturePath);
  const twoLayer = scoreTwoLayer({
    accepted: finalLines,
    rejected: grounded.rejected,
    duplicateGroups: grounded.duplicateGroups,
    fixture,
  });
  const families = scoreMetricFamilies({
    accepted: finalLines,
    merges: reconciliation ? reconciliation.merges : null,
    duplicateGroups: grounded.duplicateGroups,
    rawObservationCount: Array.isArray(artefact.rawLines) ? artefact.rawLines.length : null,
    fixture,
    gateCounts: gate ? gate.counts : null,
    enumClosed: Boolean(artefact.constrained || isBanded),
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

  return {
    artefact, grounded, reconciliation, gate, finalLines, twoLayer, families, sevenWay,
  };
}

/**
 * AC5's coverage proof, run against a real photograph and against the CURRENT
 * production region plan on the same two properties.
 *
 * Deliberately its own mode, and deliberately runnable WITHOUT credentials or
 * a gateway: the order requires the proof BEFORE any spend, because a run over
 * regions that do not cover the page answers nothing.
 */
export async function proveCoverageForPhoto(imagePath, { bandCount = DEFAULT_BAND_COUNT } = {}) {
  const sharp = (await import('sharp')).default;
  const buf = fs.readFileSync(imagePath);
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const raster = {
    data, width: info.width, height: info.height, channels: info.channels,
  };
  const plan = planOrientationAwareBands(raster, { bandCount });

  // The production plan, held to the SAME two properties, so the comparison is
  // like for like rather than two different questions.
  const prepared = prepareImage(buf);
  const productionBands = prepared.regions
    .filter((r) => r.region_kind === 'strip')
    .map((r, i) => ({
      band_no: i + 1, from: r.pixel_left, to: r.pixel_right - 1, crossFrom: r.pixel_top, crossTo: r.pixel_bottom - 1,
    }));
  const productionProof = proveCoverage({
    bands: productionBands,
    start: plan.stackingExtent.start,
    end: plan.stackingExtent.end,
    lineHeight: plan.linePitch.pitch,
    crossFrom: plan.crossExtent.start,
    crossTo: plan.crossExtent.end,
    axisLimit: plan.axis === 'x' ? info.width - 1 : info.height - 1,
  });

  return {
    image: path.basename(imagePath),
    imageSize: { width: info.width, height: info.height },
    exifOrientation: readExifOrientation(buf),
    detectedStackingAxis: plan.axis,
    alternation: { x: plan.detection.alternationX, y: plan.detection.alternationY, ratio: plan.detection.ratio },
    paperBox: plan.detection.box,
    writtenExtent: plan.stackingExtent,
    lineRunsAcross: plan.crossExtent,
    estimatedLines: plan.linePitch.lineCount,
    estimatedLinePitchPx: plan.linePitch.pitch,
    bands: plan.bands,
    regions: plan.regions,
    newPlanProof: plan.coverageProof,
    productionPlanBands: productionBands,
    productionPlanProof: productionProof,
  };
}

/**
 * Render one band as a JPEG data URL.
 *
 * ── AC5/F8: `upscale` IS THE SECOND ARM, AND IT MOVES A REAL VARIABLE ───
 * `imageRender.renderRegionCrop()` is a pure `extract` with NO resize, so a
 * crop hands the model EXACTLY the same pixels as the full page did. Cropping
 * can reduce competing content per call; it cannot add one bit of information.
 * With ~15 px per handwritten line on this photograph, resolution is a
 * candidate for the binding constraint, so upscaling is run as its own arm
 * rather than folded in - otherwise a gain could not be attributed.
 *
 * Deterministic and application-owned: a fixed factor and a fixed kernel.
 */
async function renderBand(sharp, buf, region, upscale) {
  const width = region.pixel_right - region.pixel_left;
  const height = region.pixel_bottom - region.pixel_top;
  let pipeline = sharp(buf).extract({
    left: region.pixel_left, top: region.pixel_top, width, height,
  });
  if (upscale > 1) {
    pipeline = pipeline.resize({
      width: Math.round(width * upscale), height: Math.round(height * upscale), kernel: 'lanczos3',
    });
  }
  return pipeline.jpeg({ quality: 92 }).toBuffer();
}

/**
 * AC6/AC7 - one arm of the band experiment, end to end.
 *
 * ⚠️ IT REFUSES TO SPEND ON AN UNPROVEN PLAN. If the coverage proof does not
 * pass, no gateway call is made at all: a run over regions that do not cover
 * the page answers nothing, and paying for one would produce a number that
 * looks like evidence and is not.
 */
export async function runBandArm({
  imagePath, catalogueItems = [], bandCount = DEFAULT_BAND_COUNT, upscale = 1, callModel,
}) {
  const sharp = (await import('sharp')).default;
  const { toDataUrl } = await import('../imageRender.js');
  const buf = fs.readFileSync(imagePath);
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const plan = planOrientationAwareBands({
    data, width: info.width, height: info.height, channels: info.channels,
  }, { bandCount });

  if (!plan.coverageProof.passes) {
    throw new Error('runBandArm: REFUSING TO SPEND - the band plan does not pass the AC5 coverage proof '
      + `(${plan.coverageProof.failureCount} interior failure(s), ${plan.coverageProof.spanFailureCount} band(s) clipping a line)`);
  }

  const bandRegions = plan.regions.filter((r) => r.region_kind === 'strip');
  const bandImageUrls = {};
  let renderedBytes = 0;
  for (const region of bandRegions) {
    const rendered = await renderBand(sharp, buf, region, upscale);
    renderedBytes += rendered.length;
    bandImageUrls[region.region_no] = toDataUrl(rendered);
  }

  const startedAt = Date.now();
  const inspection = await inspectBandsIndividually({
    bandRegions, bandImageUrls, candidates: catalogueItems, ...(callModel ? { callModel } : {}),
  });
  const elapsedMs = Date.now() - startedAt;

  const grounded = groundLines({
    lines: inspection.lines,
    productIdEnum: inspection.productIdEnum,
    regionNos: bandRegions.map((r) => r.region_no),
  });
  const reconciliation = reconcileAcrossBands({
    lines: grounded.accepted,
    regions: plan.regions,
    axis: plan.axis,
    linePitch: plan.linePitch?.pitch ?? null,
  });

  // ── WP-B15-33 AC3: THE GATE RUNS LAST, AND IT ONLY WITHHOLDS ────────────
  // Last, because it grades the lines the application would actually act on -
  // grading anything earlier measures a state nothing consumes. Only withholds,
  // because deleting a detected line would trade Warwick's grounding
  // requirement against his 0-omissions requirement, and he asked for both.
  const gate = applyVisualEvidenceGate({
    lines: reconciliation.reconciled,
    regions: plan.regions,
    axis: plan.axis,
    linePitch: plan.linePitch?.pitch ?? null,
  });

  return {
    plan, bandRegions, inspection, grounded, reconciliation, gate, elapsedMs, renderedBytes, upscale, bandCount,
  };
}

async function main() {
  const coveragePath = argValue('coverage-proof');
  if (coveragePath) {
    const proof = await proveCoverageForPhoto(coveragePath, {
      bandCount: Number(argValue('bands', String(DEFAULT_BAND_COUNT))),
    });
    process.stdout.write('\nAC5 COVERAGE PROOF (no gateway call, no credentials)\n');
    process.stdout.write(`  image ................. ${proof.image} ${proof.imageSize.width}x${proof.imageSize.height}, EXIF orientation ${proof.exifOrientation}\n`);
    process.stdout.write(`  detected stacking axis  ${proof.detectedStackingAxis}  (alternation X ${proof.alternation.x.toFixed(4)} vs Y ${proof.alternation.y.toFixed(4)})\n`);
    process.stdout.write(`  written extent ........ ${proof.writtenExtent.start}..${proof.writtenExtent.end} along ${proof.detectedStackingAxis}; a line runs ${proof.lineRunsAcross.start}..${proof.lineRunsAcross.end} across it\n`);
    process.stdout.write(`  estimated lines/pitch . ${proof.estimatedLines} lines, ${proof.estimatedLinePitchPx.toFixed(1)} px pitch\n`);
    process.stdout.write(`  bands ................. ${proof.bands.map((b) => `${b.band_no}:${b.from}-${b.to}`).join('  ')}\n`);
    const fmt = (p) => `${p.passes ? 'PASS' : 'FAIL'} - ${p.checked} positions checked, ${p.failureCount} interior failure(s), `
      + `${p.spanFailureCount} band(s) clipping a line lengthways, ${p.frameClippedCount} frame-clipped`;
    process.stdout.write(`  NEW orientation-aware plan .. ${fmt(proof.newPlanProof)}\n`);
    process.stdout.write(`  CURRENT production plan ..... ${fmt(proof.productionPlanProof)}\n`);
    const outDir = argValue('out', path.join(__dirname, 'runs'));
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'coverage-proof.json');
    fs.writeFileSync(outPath, `${JSON.stringify(proof, null, 2)}\n`);
    process.stdout.write(`  evidence: ${outPath}\n`);
    if (!proof.newPlanProof.passes) process.exitCode = 1;
    return;
  }

  const rescorePath = argValue('rescore');
  if (rescorePath) {
    const fixturePath = argValue('fixture', DEFAULT_FIXTURE_PATH);
    const gtPath = argValue('ground-truth', null);
    const {
      artefact, grounded, reconciliation, gate, twoLayer, families, sevenWay,
    } = rescoreArtefact(rescorePath, { fixturePath, groundTruthPath: gtPath });
    process.stdout.write(`\nRE-SCORED on the CORRECTED instrument (no gateway call) from ${rescorePath}\n`);
    process.stdout.write(`  grounding: accepted ${grounded.counts.accepted}, rejected ${grounded.counts.rejected}, `
      + `identified ${grounded.counts.identified}, explicit UNKNOWN ${grounded.counts.unknownVisible}, `
      + `no identity claim ${grounded.counts.noIdentityClaim}, sanity-flagged ${grounded.counts.quantityNulled}, `
      + `qty from page ${grounded.counts.quantityFromPage}, qty defaulted ${grounded.counts.quantityDefaulted}, `
      + `model qty discarded ${grounded.counts.modelQuantityDiscarded}, `
      + `cross-region collisions ${grounded.counts.crossRegionCollisions}\n`);
    process.stdout.write(`${formatFamilies(families, artefact.label)}\n`);
    process.stdout.write('  FAMILY LIMITS (print these WITH the numbers, never without):\n');
    families.familiesLimits.forEach((l) => process.stdout.write(`    - ${l}\n`));
    process.stdout.write(`\n  SUPERSEDED two-layer score, recomputed on the same raw lines for comparison only:\n${formatTwoLayer(twoLayer, artefact.label)}\n`);
    process.stdout.write(`  omitted page lines: ${twoLayer.omittedPageLines.map((o) => `#${o.page_order} ${o.source_text}`).join(' | ') || '(none)'}\n`);
    twoLayer.limits.forEach((l) => process.stdout.write(`    - ${l}\n`));
    if (sevenWay) {
      process.stdout.write(`\n  SUPERSEDED seven-category scorer, for comparison only:\n${formatSevenWay(sevenWay, artefact.label)}\n`);
    }

    // ── RETAIN THE SUPERSEDED BLOCK. The point of re-scoring the SAME banked
    //    raw lines is that the instrument is the only thing that changed, and
    //    that claim is only checkable while the old numbers are still in the
    //    file beside the new ones. Overwriting them would destroy the very
    //    comparison the re-score exists to make.
    const supersededBlocks = {
      ...(artefact.supersededScores ?? {}),
      ...(artefact.twoLayerScore && !artefact.supersededScores?.twoLayerScore_asRunWPB1532
        ? { twoLayerScore_asRunWPB1532: artefact.twoLayerScore }
        : {}),
      ...(artefact.reconciliation && !artefact.supersededScores?.reconciliation_asRunWPB1532
        ? { reconciliation_asRunWPB1532: artefact.reconciliation }
        : {}),
      note: 'AS RUN at WP-B15-32, retained byte-for-byte. The raw model output in `rawLines` is unchanged, so '
        + 'the difference between these blocks and the current ones is the INSTRUMENT and the application-side '
        + 'pipeline (WP-B15-33), never a different draw from the model.',
    };

    fs.writeFileSync(rescorePath, `${JSON.stringify({
      ...artefact,
      supersededScores: supersededBlocks,
      grounded,
      ...(reconciliation ? { reconciliation } : {}),
      ...(gate ? { visualEvidenceGate: { counts: gate.counts }, finalLines: gate.lines } : {}),
      metricFamilies: families,
      twoLayerScore: twoLayer,
      score: sevenWay ?? artefact.score ?? null,
    }, null, 2)}\n`);
    process.stdout.write(`  artefact updated in place: ${rescorePath}\n`);
    return;
  }

  // ── ARM C / ARM D: the orientation-aware band experiment ────────────────
  if (hasFlag('bands')) {
    const imgPath = process.argv[2];
    if (!imgPath) throw new Error('usage: node --env-file=<env> runAgenticVisionPrototype.js <photo.jpg> --bands [--upscale=3] [--band-count=7] --from-db');
    const upscale = Number(argValue('upscale', '1'));
    const bandCount = Number(argValue('band-count', String(DEFAULT_BAND_COUNT)));
    const label = argValue('label', upscale > 1 ? 'arm-d' : 'arm-c');
    const householdId = Number(argValue('household', '1'));
    const catalogueItems = hasFlag('from-db')
      ? await loadCatalogueFromDb(householdId)
      : loadCatalogue(argValue('catalogue'));
    process.stdout.write(`catalogue: ${catalogueItems.length} candidate(s)${hasFlag('from-db') ? ` (household ${householdId}, SELECT-only)` : ''}\n`);

    const arm = await runBandArm({
      imagePath: imgPath, catalogueItems, bandCount, upscale,
    });
    const fixture = loadFixture(argValue('fixture', DEFAULT_FIXTURE_PATH));
    // SUPERSEDED headline, RETAINED so every number already on the record stays
    // reproducible from the same artefact (WP-B15-33 AC4).
    const score = scoreTwoLayer({
      accepted: arm.gate.lines,
      rejected: arm.grounded.rejected,
      duplicateGroups: arm.grounded.duplicateGroups,
      fixture,
    });
    const families = scoreMetricFamilies({
      accepted: arm.gate.lines,
      merges: arm.reconciliation.merges,
      duplicateGroups: arm.grounded.duplicateGroups,
      rawObservationCount: arm.inspection.lines.length,
      fixture,
      gateCounts: arm.gate.counts,
      enumClosed: true,
    });

    process.stdout.write(`\n${label.toUpperCase()} - orientation-aware bands, upscale x${arm.upscale}\n`);
    process.stdout.write(`  axis ${arm.plan.axis} | ${arm.bandRegions.length} bands | coverage proof PASS\n`);
    process.stdout.write(`  calls ${arm.inspection.calls} | wall time ${arm.elapsedMs}ms | gateway cost ${arm.inspection.totalCostUsd === null ? 'unknown' : `$${arm.inspection.totalCostUsd.toFixed(4)}`}\n`);
    process.stdout.write(`  raw lines ${arm.inspection.lines.length} -> accepted ${arm.grounded.counts.accepted} -> reconciled ${arm.reconciliation.reconciled.length} `
      + `(merged away ${arm.reconciliation.mergedAway}, confirmed by two bands ${arm.reconciliation.confirmedByTwoBands})\n`);
    process.stdout.write(`  per band: ${arm.inspection.perBand.map((b) => `${b.region_no}:${b.parseFailed ? 'PARSE-FAIL' : b.lineCount}`).join(' ')}\n`);
    process.stdout.write(`${formatFamilies(families, label)}\n`);
    process.stdout.write('  FAMILY LIMITS (print these WITH the numbers, never without):\n');
    families.familiesLimits.forEach((l) => process.stdout.write(`    - ${l}\n`));
    process.stdout.write(`\n  SUPERSEDED two-layer score, retained for like-for-like comparison only:\n${formatTwoLayer(score, label)}\n`);
    process.stdout.write(`  omitted page lines: ${score.omittedPageLines.map((o) => `#${o.page_order} ${o.source_text}`).join(' | ') || '(none)'}\n`);
    score.limits.forEach((l) => process.stdout.write(`    - ${l}\n`));

    const outDir = argValue('out', path.join(__dirname, 'runs'));
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify({
      label,
      strategy: 'orientation-aware bands, inspected individually (AC6), reconciled deterministically (AC7)',
      upscale: arm.upscale,
      bandCount: arm.bandCount,
      householdId: hasFlag('from-db') ? householdId : null,
      catalogueSize: catalogueItems.length,
      catalogue: catalogueItems,
      plan: {
        axis: arm.plan.axis,
        detection: arm.plan.detection,
        linePitch: arm.plan.linePitch,
        regions: arm.plan.regions,
        coverageProof: {
          passes: arm.plan.coverageProof.passes,
          checked: arm.plan.coverageProof.checked,
          failureCount: arm.plan.coverageProof.failureCount,
          spanFailureCount: arm.plan.coverageProof.spanFailureCount,
          frameClippedCount: arm.plan.coverageProof.frameClippedCount,
        },
      },
      perBand: arm.inspection.perBand,
      calls: arm.inspection.calls,
      elapsedMs: arm.elapsedMs,
      totalCostUsd: arm.inspection.totalCostUsd,
      renderedBytes: arm.renderedBytes,
      rawLines: arm.inspection.lines,
      grounded: arm.grounded,
      reconciliation: arm.reconciliation,
      visualEvidenceGate: { counts: arm.gate.counts },
      finalLines: arm.gate.lines,
      metricFamilies: families,
      twoLayerScore: score,
    }, null, 2)}\n`);
    process.stdout.write(`\nrun artefact: ${outPath}\n`);
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
