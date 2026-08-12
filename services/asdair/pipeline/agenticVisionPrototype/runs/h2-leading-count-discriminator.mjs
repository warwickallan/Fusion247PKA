// =====================================================================
// WP-B15-31 AC1 - H2, THE DISCRIMINATING EXPERIMENT. Committed as evidence.
//
// H1 ran FIRST and cost nothing, and it EXONERATED RESOLUTION:
//   * the delivered x3 band crops were re-rendered and inspected by eye - in
//     band 3 the leading "2" of "2 BLOO TOILET Rim" is plainly legible, and
//     Arm D returned "BLOO TOILET RIM" from that exact crop;
//   * Arm C (upscale 1) preserved MORE leading counts than Arm D (upscale 3):
//     54.9% vs 38.8%. More pixels made it worse, which is the opposite of what
//     a resolution shortage predicts.
//
// So the count is not missing from the IMAGE. H2 asks what is actually eating
// it, on ONE band, with the smallest number of live calls that can tell the
// two remaining stories apart.
//
// THE BASELINE IS FREE and already exists: Arm D's own band-3 result, at
// runs/2026-08-12T20-37-00-348Z-arm-d.json. Catalogue present, old schema,
// FOUR lines returned, ZERO leading counts preserved - and "FERBREEZE" came
// back as the catalogue's "FEBREZE". So the baseline call is not re-paid for.
//
//   ARM A - catalogue WITHHELD, old shape (no leading_mark).
//           Names the seam: if the counts come back the moment the candidate
//           list is gone, the loss is candidate contamination, not vision.
//
//   ARM B - catalogue PRESENT, NEW shape (leading_mark required).
//           Tests the FIX under the real production condition, not a
//           laboratory one. This is the arm that has to work.
//
// Two calls, ~$0.04 at the measured band-3 rate of $0.020.
//
// Run:
//   node --env-file="C:\.fusion247\.env keys\shopper.env.txt" \
//        --env-file=C:\.fusion247\asdair.env \
//        runs/h2-leading-count-discriminator.mjs
//
// Credentials are CONSUMED via --env-file and are never opened, parsed,
// printed or logged by this file.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { planOrientationAwareBands } from '../bandPlan.js';
import { buildBandPrompt } from '../bandInspection.js';
import { buildLineSchema, buildTextFormat } from '../lineSchema.js';
import { loadCatalogueFromDb } from '../runAgenticVisionPrototype.js';
import { normalizeResponsesUsage } from '../agenticLoop.js';
import { visionAgenticTurn, estimateUsdCost } from '../../../../obsidiwikai/src/core/models.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE = 'C:/.fusion247/asdair/shopper-media/tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg';
const TARGET_REGION = 3; // the band carrying "2 BLOO TOILET Rim"
const UPSCALE = 3;
const BAND_COUNT = 7;

/** The old contract, reproduced exactly, so ARM A changes ONE variable only. */
function buildLegacySchema({ candidates, regionNos }) {
  const schema = buildLineSchema({ candidates, regionNos });
  const item = schema.properties.lines.items;
  delete item.properties.leading_mark;
  item.required = item.required.filter((f) => f !== 'leading_mark');
  return schema;
}

/** The old prompt, reproduced exactly: rule 2a removed, nothing else touched. */
function stripLeadingMarkRule(prompt) {
  const before = prompt;
  const after = prompt.replace(/\n\n2a\. COPY THE START OF THE LINE[\s\S]*?what is WRITTEN\./, '');
  if (after === before) throw new Error('H2: rule 2a not found - the prompt shape changed, refusing to run a mislabelled arm');
  return after;
}

async function renderBand(sharp, buf, region) {
  const width = region.pixel_right - region.pixel_left;
  const height = region.pixel_bottom - region.pixel_top;
  return sharp(buf)
    .extract({ left: region.pixel_left, top: region.pixel_top, width, height })
    .resize({ width: Math.round(width * UPSCALE), height: Math.round(height * UPSCALE), kernel: 'lanczos3' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function runArm({ label, imageUrl, region, candidates, useLeadingMark }) {
  const schema = useLeadingMark
    ? buildLineSchema({ candidates, regionNos: [region.region_no] })
    : buildLegacySchema({ candidates, regionNos: [region.region_no] });
  const candidateBlock = candidates.length > 0
    ? candidates.map((c) => `- ${c.id}: ${c.name}${Array.isArray(c.aliases) && c.aliases.length ? ` | aka: ${c.aliases.join(', ')}` : ''}${c.brand ? ` | brand: ${c.brand}` : ''}${c.category ? ` | ${c.category}` : ''}${c.typicalQty != null ? ` | usually ${c.typicalQty}` : ''}`).join('\n')
    : '(no known regulars or favourites recorded for this household yet - every visible line will therefore be UNKNOWN_VISIBLE_ITEM, which is the correct answer, not a failure)';
  let prompt = buildBandPrompt({ candidateBlock, bandNo: region.region_no - 1, bandCount: BAND_COUNT });
  if (!useLeadingMark) prompt = stripLeadingMarkRule(prompt);

  const startedAt = Date.now();
  const result = await visionAgenticTurn({
    prompt, imageUrls: [imageUrl], tools: [], previousResponseId: null, toolOutputs: [],
    textFormat: buildTextFormat(schema),
  });
  const elapsedMs = Date.now() - startedAt;
  const costUsd = estimateUsdCost(normalizeResponsesUsage(result.usage));
  let lines = [];
  try { lines = JSON.parse(result.outputText).lines ?? []; } catch { lines = []; }
  return {
    label, elapsedMs, costUsd, candidatesSupplied: candidates.length, leadingMarkField: useLeadingMark, lines,
  };
}

const startsWithDigit = (s) => /^\s*\d/.test(String(s || ''));

async function main() {
  const sharp = (await import('sharp')).default;
  const { toDataUrl } = await import('../../imageRender.js');
  const buf = fs.readFileSync(IMAGE);
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const plan = planOrientationAwareBands(
    { data, width: info.width, height: info.height, channels: info.channels }, { bandCount: BAND_COUNT },
  );
  const region = plan.regions.find((r) => r.region_no === TARGET_REGION);
  if (!region) throw new Error(`H2: region ${TARGET_REGION} not in the plan`);
  const imageUrl = toDataUrl(await renderBand(sharp, buf, region));

  const catalogue = await loadCatalogueFromDb(1);
  process.stdout.write(`catalogue: ${catalogue.length} candidate(s) (household 1, SELECT-only)\n`);
  process.stdout.write(`band region ${region.region_no}: x ${region.pixel_left}..${region.pixel_right}, y ${region.pixel_top}..${region.pixel_bottom}, upscale x${UPSCALE}\n\n`);

  const arms = [];
  arms.push(await runArm({
    label: 'ARM A - catalogue WITHHELD, no leading_mark', imageUrl, region, candidates: [], useLeadingMark: false,
  }));
  arms.push(await runArm({
    label: 'ARM B - catalogue PRESENT, leading_mark REQUIRED', imageUrl, region, candidates: catalogue, useLeadingMark: true,
  }));

  for (const arm of arms) {
    const visible = arm.lines.filter((l) => l.visible_line !== false);
    const withDigit = visible.filter((l) => startsWithDigit(l.as_written));
    const withMark = visible.filter((l) => typeof l.leading_mark === 'string' && l.leading_mark.trim() !== '');
    process.stdout.write(`${arm.label}\n`);
    process.stdout.write(`  candidates supplied ${arm.candidatesSupplied}, leading_mark field ${arm.leadingMarkField ? 'PRESENT' : 'absent'}, ${arm.elapsedMs} ms, $${(arm.costUsd ?? 0).toFixed(6)}\n`);
    process.stdout.write(`  visible lines ${visible.length}; as_written starting with a digit ${withDigit.length}; leading_mark populated ${withMark.length}\n`);
    for (const l of visible) {
      process.stdout.write(`    as_written=${JSON.stringify(l.as_written)} leading_mark=${JSON.stringify(l.leading_mark ?? null)} quantity=${l.quantity ?? null}\n`);
    }
    process.stdout.write('\n');
  }

  const outPath = path.join(__dirname, 'h2-leading-count-discriminator.json');
  fs.writeFileSync(outPath, `${JSON.stringify({
    experiment: 'WP-B15-31 AC1 H2',
    image: IMAGE,
    region,
    upscale: UPSCALE,
    baseline: {
      source: 'runs/2026-08-12T20-37-00-348Z-arm-d.json, band region 3 - FREE, not re-paid for',
      candidatesSupplied: 109,
      leadingMarkField: false,
      visibleLines: 4,
      asWrittenStartingWithDigit: 0,
      readings: ['FEBREZE AIR MIST VANILLA', 'BLOO TOILET RIM', 'VANISH OXI PINK', 'LENOR OUTDOOR'],
      pageTruth: ['1 FERBREEZE AIR MIST VANILLA', '2 BLOO TOILET Rim', '1 VANISH OXi PiNK', '1 LENOR OUTDOOR'],
    },
    arms,
    totalCostUsd: arms.reduce((s, a) => s + (a.costUsd ?? 0), 0),
  }, null, 2)}\n`);
  process.stdout.write(`evidence: ${outPath}\n`);
  process.stdout.write(`total cost of H2: $${arms.reduce((s, a) => s + (a.costUsd ?? 0), 0).toFixed(6)}\n`);
}

main().catch((e) => { process.stderr.write(`H2 FAILED: ${e.message}\n`); process.exitCode = 1; });
