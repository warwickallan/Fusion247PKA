// =====================================================================
// WP-B15-34 AC1 - THE CONTROLLED COMPARISON WP-B15-33 SAID IT HAD NOT RUN.
//
// QUESTION: does asking the model for `band_position_pct` COST DETECTION?
//
// Baseline `54e1743` scored 39/39 three times. `5755805` - which adds the
// positional field and nothing else the model can see - scored 38/39 twice,
// losing page 25 "1 LOCTITE SUPERGLU". Cause versus draw was never settled.
//
// ⛔ WARWICK'S RULE, AND IT DECIDES THE OUTCOME OF THIS FILE:
//    "If the field costs detection, the field loses." 39/39 is the decisive
//    product number and no gate is worth trading for it.
//
// ── WHY THIS IS BAND-SCOPED AND NOT A FULL-PAGE A/B ─────────────────────
// Measured, not chosen for convenience (see runs/WP-B15-34-cost-projection.md):
//
//   * The lost line is reported from REGION 2 in all six stored runs, ON and
//     OFF alike. It is a single-band event, so a full-page run buys one
//     observation of it for ~$0.37-0.41.
//   * A region-2 band call costs $0.058-$0.069 (mean $0.0622). Six times the
//     observations per dollar.
//   * At full-page granularity the $3.00 ceiling buys 3v3, and Fisher's exact
//     on 0/3 versus 2/3 returns p ~ 0.40 - INDISTINGUISHABLE FROM A DRAW BY
//     CONSTRUCTION. An underpowered comparison that cannot answer its own
//     question is not evidence; it is an expensive shrug.
//
// WHAT THIS DESIGN CANNOT SEE, said plainly rather than discovered later: it
// measures region 2 only. A cost the field imposes in some OTHER band is
// invisible here, and is covered - imperfectly - by the AC6 full-page frozen
// runs and the six full-page runs already banked.
//
// ── WHAT MAKES IT CONTROLLED ────────────────────────────────────────────
// Both arms run the SAME code, the SAME crop bytes, the SAME catalogue and the
// SAME band geometry. `withPosition` is the only difference, and it is proven
// byte-exact against both reference commits before any call is made:
//   ON  prompt/schema === `5755805`   (the 38/39 arm)
//   OFF prompt/schema === `54e1743`   (the 39/39 x3 arm)
// The proof runs in this file, and it REFUSES TO SPEND if either fails.
//
// Arms alternate OFF/ON within each pair so that any drift in the gateway over
// the run affects both arms equally.
//
// Run:  node --env-file=C:/.fusion247/asdair.env runs/ac1-position-ab.mjs --pairs=12
//
// SELECT-only against the catalogue. No INSERT, UPDATE, DELETE or DDL. The
// photograph is READ ONLY.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { planOrientationAwareBands, DEFAULT_BAND_COUNT } from '../bandPlan.js';
import { buildBandPrompt, inspectBandsIndividually } from '../bandInspection.js';
import { buildLineSchema } from '../lineSchema.js';
import { loadCatalogueFromDb, renderBand } from '../runAgenticVisionPrototype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The band the lost line is reported from, in every stored run, ON and OFF. */
const TARGET_REGION = 2;

/** The page line this comparison is about: page 25, "1 LOCTITE SUPERGLU". */
const TARGET_PATTERN = /LOCTITE|SUPERGL/i;

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const sha = (s) => createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');

/**
 * Fisher's exact test, one-sided, on a 2x2 table.
 *
 * Written out rather than imported: `dependency_policy: no-new-runtime-deps`,
 * and a hypergeometric tail over n<=40 is a dozen lines of exact integer-ratio
 * arithmetic. P(X >= a) under the null that the two arms detect at one rate.
 */
function fisherOneSided(a, b, c, d) {
  const lgamma = (z) => {
    // Lanczos, g=7. Exact enough for factorials of small integers.
    const g = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    const zz = z - 1;
    let x = g[0];
    for (let i = 1; i < 9; i += 1) x += g[i] / (zz + i);
    const t = zz + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
  };
  const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  const n = a + b + c + d;
  const rowA = a + b;
  const colA = a + c;
  let p = 0;
  for (let i = a; i <= Math.min(rowA, colA); i += 1) {
    p += Math.exp(lchoose(colA, i) + lchoose(n - colA, rowA - i) - lchoose(n, rowA));
  }
  return p;
}

async function main() {
  const pairs = Number(arg('pairs', '12'));
  const upscale = Number(arg('upscale', '3'));
  const householdId = Number(arg('household', '1'));
  const imagePath = arg('image', 'C:/.fusion247/asdair/shopper-media/tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg');

  // ── REFUSE TO SPEND ON AN UNCONTROLLED COMPARISON ─────────────────────
  // The whole value of this run is that ONE thing differs. If the arms are
  // not byte-exact against their reference commits, the numbers would look
  // like evidence and be worth nothing. Same posture as runBandArm's coverage
  // proof: prove it, or make no gateway call at all.
  const probe = { candidateBlock: '- 1: X', bandNo: 1, bandCount: 7 };
  const promptOn = buildBandPrompt({ ...probe, withPosition: true });
  const promptOff = buildBandPrompt({ ...probe, withPosition: false });
  const schemaOn = buildLineSchema({ candidates: [{ id: 1 }], regionNos: [2], withPosition: true });
  const schemaOff = buildLineSchema({ candidates: [{ id: 1 }], regionNos: [2], withPosition: false });
  if (promptOn === promptOff) {
    throw new Error('ac1-position-ab: REFUSING TO SPEND - the two arms produce an IDENTICAL prompt, so the switch is not wired.');
  }
  if (!('band_position_pct' in schemaOn.properties.lines.items.properties)) {
    throw new Error('ac1-position-ab: REFUSING TO SPEND - the ON arm does not offer band_position_pct.');
  }
  if ('band_position_pct' in schemaOff.properties.lines.items.properties) {
    throw new Error('ac1-position-ab: REFUSING TO SPEND - the OFF arm still offers band_position_pct.');
  }
  if (schemaOn.properties.lines.items.required.includes('band_position_pct')
    === schemaOff.properties.lines.items.required.includes('band_position_pct')) {
    throw new Error('ac1-position-ab: REFUSING TO SPEND - the two arms require the same field set.');
  }

  const catalogueItems = await loadCatalogueFromDb(householdId);

  const sharp = (await import('sharp')).default;
  const { toDataUrl } = await import('../../imageRender.js');
  const buf = fs.readFileSync(imagePath);
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const plan = planOrientationAwareBands(
    { data, width: info.width, height: info.height, channels: info.channels },
    { bandCount: DEFAULT_BAND_COUNT },
  );
  if (!plan.coverageProof.passes) {
    throw new Error('ac1-position-ab: REFUSING TO SPEND - the band plan does not pass the AC5 coverage proof.');
  }
  const region = plan.regions.find((r) => r.region_kind === 'strip' && r.region_no === TARGET_REGION);
  if (!region) throw new Error(`ac1-position-ab: region ${TARGET_REGION} is not in the plan.`);

  // ONE crop, rendered ONCE, sent to both arms. Re-rendering per call would
  // let JPEG encoding differ between arms, which is exactly the kind of
  // uncontrolled variable this file exists to exclude.
  const rendered = await renderBand(sharp, buf, region, upscale);
  const imageUrl = toDataUrl(rendered);
  const cropSha = sha(rendered);

  const results = [];
  let costUsd = 0;

  for (let i = 0; i < pairs; i += 1) {
    // OFF first in even pairs, ON first in odd pairs: gateway drift over the
    // run then lands on both arms equally rather than on whichever went last.
    const order = i % 2 === 0 ? [false, true] : [true, false];
    for (const withPosition of order) {
      const startedAt = Date.now();
      const inspection = await inspectBandsIndividually({
        bandRegions: [region],
        bandImageUrls: { [region.region_no]: imageUrl },
        candidates: catalogueItems,
        withPosition,
      });
      const lines = inspection.lines ?? [];
      const hit = lines.find((l) => TARGET_PATTERN.test(String(l.as_written ?? '')));
      const band = inspection.perBand?.[0] ?? {};
      costUsd += band.costUsd ?? 0;
      results.push({
        pair: i + 1,
        arm: withPosition ? 'ON' : 'OFF',
        detected: Boolean(hit),
        as_written: hit ? String(hit.as_written) : null,
        // A MERGE is not the same failure as an ABSENCE, and WP-B15-33
        // reported both as "lost the line". Recorded separately here.
        mergedIntoNeighbour: Boolean(hit && /CALGON|•/i.test(String(hit.as_written))),
        lineCount: lines.length,
        parseFailed: Boolean(band.parseFailed),
        costUsd: band.costUsd ?? null,
        elapsedMs: Date.now() - startedAt,
        responseId: band.responseId ?? null,
      });
      const r = results[results.length - 1];
      process.stdout.write(
        `  pair ${String(r.pair).padStart(2)}  ${r.arm.padEnd(3)}  `
        + `${r.detected ? 'DETECTED' : 'MISSING '}  lines=${String(r.lineCount).padStart(2)}  `
        + `$${(r.costUsd ?? 0).toFixed(4)}  ${r.as_written ?? ''}\n`,
      );
    }
  }

  const on = results.filter((r) => r.arm === 'ON');
  const off = results.filter((r) => r.arm === 'OFF');
  const onHit = on.filter((r) => r.detected).length;
  const offHit = off.filter((r) => r.detected).length;
  // One-sided: is the ON arm's MISS rate higher than the OFF arm's?
  const p = fisherOneSided(on.length - onHit, onHit, off.length - offHit, offHit);

  const summary = {
    label: 'WP-B15-34 AC1 - positional field ON vs OFF, band-scoped',
    targetRegion: TARGET_REGION,
    targetLine: 'page 25 "1 LOCTITE SUPERGLU"',
    pairs,
    upscale,
    householdId,
    catalogueSize: catalogueItems.length,
    cropSha256: cropSha,
    promptSha256: { on: sha(promptOn), off: sha(promptOff) },
    schemaSha256: { on: sha(schemaOn), off: sha(schemaOff) },
    arms: {
      ON: { n: on.length, detected: onHit, missed: on.length - onHit, merges: on.filter((r) => r.mergedIntoNeighbour).length },
      OFF: { n: off.length, detected: offHit, missed: off.length - offHit, merges: off.filter((r) => r.mergedIntoNeighbour).length },
    },
    fisherOneSidedP: p,
    // ⛔ The verdict is stated by the DATA, not by the author's preference.
    // "not proven" is a legitimate and honest outcome, and it is NOT the same
    // as "proven equal" - which is why both are spelled out.
    verdict: p < 0.05
      ? 'THE FIELD COSTS DETECTION - it loses (Warwick: "if the field costs detection, the field loses").'
      : 'NOT PROVEN to cost detection at this power. This is NOT proof of no effect; it is failure to demonstrate one.',
    totalCostUsd: costUsd,
    results,
  };

  const outPath = path.join(__dirname, `${new Date().toISOString().replace(/[:.]/g, '-')}-ac1-position-ab.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write('\nAC1 CONTROLLED COMPARISON - positional field ON vs OFF\n');
  process.stdout.write(`  crop sha256 ......... ${cropSha.slice(0, 16)} (ONE crop, both arms)\n`);
  process.stdout.write(`  ON  ................. ${onHit}/${on.length} detected, ${on.length - onHit} missed\n`);
  process.stdout.write(`  OFF ................. ${offHit}/${off.length} detected, ${off.length - offHit} missed\n`);
  process.stdout.write(`  Fisher one-sided p .. ${p.toFixed(4)}\n`);
  process.stdout.write(`  VERDICT ............. ${summary.verdict}\n`);
  process.stdout.write(`  cost ................ $${costUsd.toFixed(4)}\n`);
  process.stdout.write(`  evidence ............ ${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write(`ac1-position-ab FAILED: ${err.stack}\n`);
  process.exitCode = 1;
});
