// =====================================================================
// WP-B15-31 step 1 - RE-SCORE EVERY STORED ARM ON THE CURRENT INSTRUMENT.
//
// FREE. No gateway call, no credentials, no database. It re-runs the grading
// of raw model output that was already paid for.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────
// The WP-B15-30 headline - "38/39 detected, 1 omission, 0 duplicates, 0
// inventions" - is NOT a measurement of the current instrument. Re-scoring the
// UNCHANGED Arm D raw data on the code at 14d14dd, with the WP-B15-31 changes
// stashed out, returns 39/39 detected, 0 omitted, 10 duplicates, 8 quantity
// errors. The stored block was written by an older scorer and never refreshed
// after the scorer was corrected.
//
// ⛔ THE STALE FIGURES ARE NOT OVERWRITTEN. They are moved, intact, to
// `twoLayerScore_SUPERSEDED` and labelled. Those numbers are already in
// Warwick's hands and on the Wayfinder, so the DELTA has to stay legible - a
// quiet substitution would leave two incomparable numbers in circulation and
// no record of which was which.
//
// Run:  node runs/rescore-all-arms.mjs
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rescoreArtefact } from '../runAgenticVisionPrototype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARTEFACTS = fs.readdirSync(__dirname)
  .filter((f) => /^\d{4}-\d{2}-\d{2}T.*-arm-.*\.json$/.test(f))
  .sort();

const F = (v) => (v === null || v === undefined ? '-' : String(v));
const rows = [];

for (const file of ARTEFACTS) {
  const full = path.join(__dirname, file);
  const artefact = JSON.parse(fs.readFileSync(full, 'utf8'));
  const stale = artefact.twoLayerScore ?? null;

  const { grounded, twoLayer } = rescoreArtefact(full);
  const a = twoLayer.layerA;
  const staleA = stale?.layerA ?? {};

  rows.push({
    label: artefact.label,
    upscale: artefact.upscale ?? '-',
    accepted: grounded.accepted.length,
    was: {
      detected: staleA.detected, omitted: staleA.omitted, invented: staleA.invented,
      duplicates: staleA.duplicates, quantityErrors: staleA.quantityErrors,
      visibleTextAccuracyPct: staleA.visibleTextAccuracyPct,
    },
    now: {
      detected: a.detected, omitted: a.omitted, invented: a.invented,
      duplicates: a.duplicates, quantityErrors: a.quantityErrors,
      contestedExcluded: a.quantityErrorsContestedExcluded,
      leadingCountPreserved: `${a.leadingCountPreserved}/${a.detectedWherePageCarriesCount}`,
      leadingCountPreservationPct: a.leadingCountPreservationPct,
      visibleTextAccuracyPct: a.visibleTextAccuracyPct,
    },
  });

  const next = {
    ...artefact,
    grounded,
    twoLayerScore: twoLayer,
    // The old block, intact, clearly marked, never silently dropped.
    ...(stale ? {
      twoLayerScore_SUPERSEDED: {
        SUPERSEDED_BY: 'WP-B15-31 re-score on the corrected instrument',
        WHY: 'Written by an older scorer and never refreshed after the scorer was corrected. '
          + 'Retained because these figures are already in circulation (Warwick, the Wayfinder, '
          + 'the WP-B15-30 report) and the delta must stay legible.',
        SAME_RAW_DATA: true,
        block: stale,
      },
    } : {}),
  };
  fs.writeFileSync(full, `${JSON.stringify(next, null, 2)}\n`);
}

process.stdout.write('\nRE-SCORE OF EVERY STORED ARM ON THE CURRENT INSTRUMENT (no gateway call)\n');
process.stdout.write('Same raw model output in every case. Only the grading changed.\n\n');
process.stdout.write('arm      up  acc | WAS det/om/inv/dup/qty  vtx% | NOW det/om/inv/dup/qty (contested) leadCount%  vtx%\n');
process.stdout.write('-'.repeat(118) + '\n');
for (const r of rows) {
  process.stdout.write(
    `${String(r.label).padEnd(8)} ${String(r.upscale).padEnd(3)} ${String(r.accepted).padStart(3)} | `
    + `${F(r.was.detected)}/${F(r.was.omitted)}/${F(r.was.invented)}/${F(r.was.duplicates)}/${F(r.was.quantityErrors)}`.padEnd(22)
    + `${F(r.was.visibleTextAccuracyPct)}`.padEnd(6) + '| '
    + `${F(r.now.detected)}/${F(r.now.omitted)}/${F(r.now.invented)}/${F(r.now.duplicates)}/${F(r.now.quantityErrors)} (${F(r.now.contestedExcluded)})`.padEnd(24)
    + `${F(r.now.leadingCountPreserved)} ${F(r.now.leadingCountPreservationPct)}%`.padEnd(14)
    + `${F(r.now.visibleTextAccuracyPct)}\n`,
  );
}
const outPath = path.join(__dirname, 'rescore-all-arms.json');
fs.writeFileSync(outPath, `${JSON.stringify({
  note: 'WP-B15-31 step 1. Same raw data, current instrument. Stale blocks retained in each artefact as twoLayerScore_SUPERSEDED.',
  rows,
}, null, 2)}\n`);
process.stdout.write(`\nevidence: ${outPath}\n`);
