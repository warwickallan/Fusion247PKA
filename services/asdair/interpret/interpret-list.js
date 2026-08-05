#!/usr/bin/env node
// BUILD-015 AsdAIr Stage 1 - interpret-list.js
//
// A DIAGNOSTIC CALLER for catalogue-grounded list interpretation.
//
//   node --env-file=<env> interpret-list.js --image <path> [--household 1] [--inspect]
//
// Loads the household's canonical catalogue from Supabase (READ-ONLY), grounds
// ONE vision request with it, then resolves the model's chosen candidate IDS
// against our own catalogue. Canonical product names come from OUR database -
// the model only ever supplies an id and a raw reading, so it cannot invent a
// product that does not exist.
//
// --- THIS IS NOT THE PRODUCTION PATH. READ THIS BEFORE TRUSTING ITS OUTPUT ---
// The live shop interprets through services/asdair/pipeline (realInterpretPhoto
// in pipeline/deps.js). This file is a second entry point kept for diagnosis.
// A green result HERE is evidence about THIS process and nothing else.
//
// --- WHY IT FAILS CLOSED (D-2026-08-03-04, WO-ZA item 4) --------------------
// This file used to take `--dry-run`, which loaded the catalogue, printed the
// prompt, SKIPPED THE MODEL CALL ENTIRELY, and exited 0 with a success-shaped
// JSON document. On 2026-08-03 that clean exit was read as evidence that the
// grounded model path worked. It did not: the gateway served no usable vision
// alias, and a broken interpretation path reached a live household shop.
//
// The lesson is not "label it better" - the old output DID say
// `"note": "no model call was made"`, in a success-shaped body behind exit 0,
// and it was still mistaken for proof. So the shape itself is now incapable of
// being read as success:
//
//   * `--dry-run` is GONE. `--inspect` replaces it, prints to STDERR, is
//     stamped ok:false / model_call_made:false, and EXITS NON-ZERO. No script
//     checking an exit code can ever mistake it for a pass.
//   * a success document is printed on ONE path only - after `vision()` has
//     actually returned - and carries `model_call_made: true`, asserted
//     immediately before the write.
//   * every precondition of a *grounded* interpretation is checked and refused
//     rather than degraded: no catalogue, an EMPTY catalogue, a prompt that
//     does not actually carry the catalogue, an unusable model reply, and a
//     model claiming a product id this household does not have.
//
// Exit codes are distinct so a caller can tell refusal from failure:
//   0 grounded interpretation completed, model call made
//   1 the model path failed (unavailable, or unusable output)
//   2 bad invocation
//   3 REFUSED - preconditions for a grounded interpretation were not met
//   4 REFUSED - inspection only; NOTHING here evidences the model path
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadCatalogue } = require('./loadCatalogue');
const { buildGroundedPrompt, STATUSES } = require('./groundedPrompt');

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function imageToDataUrl(p) {
  const ext = path.extname(p).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`interpret-list: unsupported image type ${ext}`);
  return 'data:' + mime + ';base64,' + fs.readFileSync(p).toString('base64');
}

// Resolve the model's answer against OUR catalogue. This is where a canonical
// name is attached - by id lookup, never by trusting model prose.
function resolve(modelLines, catalogue) {
  const seen = new Map();
  return modelLines.map((l, idx) => {
    // Models commonly return an id as a STRING ("14") or as "14: Batchelors...".
    // Rejecting those would silently discard every real match and make the
    // catalogue look useless, so coerce carefully - but ONLY to an id we
    // actually hold. Anything else stays null.
    const rawId = l.matched_regular_id;
    let id = null;
    if (Number.isInteger(rawId)) id = rawId;
    else if (typeof rawId === 'string') {
      const m = rawId.match(/^\s*(\d+)/);
      if (m) id = Number(m[1]);
    } else if (typeof rawId === 'number' && Number.isFinite(rawId)) id = Math.trunc(rawId);
    const reg = id != null ? catalogue.regularsById.get(id) : null;

    let status = STATUSES.includes(l.status) ? l.status : 'needs_confirmation';
    // A model claiming a match to an id we do not have is not a match.
    if (id != null && !reg) status = 'needs_confirmation';
    // Guard the schema-pressure failure: an id with no real support.
    if (id == null && status === 'matched') status = 'unmatched_new_item';

    if (reg) {
      const prev = seen.get(reg.id);
      if (prev) status = 'possible_duplicate';
      seen.set(reg.id, idx);
    }

    return {
      line_no: l.line_no ?? idx + 1,
      raw_reading: String(l.raw_reading ?? '').trim(),
      quantity: Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : null,
      matched_regular_id: reg ? reg.id : null,
      matched_product_name: reg ? reg.name : null,   // FROM OUR DB, never the model's words
      asda_product_id: reg ? reg.asda_product_id : null,
      match_basis: reg ? (l.match_basis || 'regular product') : null,
      confidence: typeof l.confidence === 'number' ? Math.max(0, Math.min(1, l.confidence)) : null,
      alternatives: Array.isArray(l.alternatives)
        ? l.alternatives
            .map((a) => catalogue.regularsById.get(Number(a)))
            .filter(Boolean)
            .map((r) => ({ id: r.id, name: r.name }))
        : [],
      status,
    };
  });
}

/** The banner. Loud, on stderr, and impossible to mistake for a result. */
function refuse(code, headline, detail) {
  console.error('');
  console.error('  ############################################################');
  console.error('  #  interpret-list: REFUSED - this run proves NOTHING about  #');
  console.error('  #  the grounded model path.                                 #');
  console.error('  ############################################################');
  console.error(`  ${headline}`);
  if (detail) console.error(`  ${detail}`);
  console.error('');
  process.exit(code);
}

/**
 * PURE. Every precondition a GROUNDED interpretation has, checked before the
 * model is asked anything.
 *
 * Exported so the refusals are provable without a database, a gateway or an
 * image - which is the only way this file's fail-closed behaviour can be tested
 * at all under `live_authority: none`.
 *
 * The catalogue-in-prompt check is the load-bearing one: a prompt built from an
 * empty or unrendered catalogue is open-ended OCR wearing a grounded costume,
 * and open-ended OCR is what misread six lines of a real list on 2026-08-03.
 */
function checkGrounding(catalogue, prompt) {
  if (!catalogue) return { ok: false, reason: 'no catalogue was loaded' };
  if (!Array.isArray(catalogue.candidates)) return { ok: false, reason: 'the catalogue has no candidates array' };
  if (catalogue.candidates.length === 0) {
    return { ok: false, reason: 'the catalogue is EMPTY - an interpretation grounded on nothing is open-ended OCR, which is exactly what this entry point exists to avoid' };
  }
  if (typeof prompt !== 'string' || prompt.length === 0) return { ok: false, reason: 'no prompt was built' };

  const missing = catalogue.candidates.filter((c) => !prompt.includes(`${c.id}: `));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `the catalogue was loaded but NOT supplied to the model - ${missing.length} of ${catalogue.candidates.length} candidates do not appear in the prompt`,
    };
  }
  return { ok: true, candidates: catalogue.candidates.length };
}

/**
 * PURE. Did the model claim a product id this household does not have?
 *
 * resolve() already refuses to attach a canonical name to an unknown id, so no
 * invented product can reach a basket. This is the louder half: a model
 * inventing ids is not a line-level oddity to absorb quietly, it is a signal
 * that the whole reply is untrustworthy, and the run refuses rather than
 * returning a document that mostly looks fine.
 */
function unknownIdClaims(modelLines, catalogue) {
  const claims = [];
  for (const [idx, l] of modelLines.entries()) {
    const raw = l && l.matched_regular_id;
    if (raw === null || raw === undefined || raw === '') continue;
    const m = String(raw).match(/^\s*(\d+)/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!catalogue.regularsById.has(id)) claims.push({ line_no: l.line_no ?? idx + 1, claimed_id: id });
  }
  return claims;
}

async function main() {
  const image = arg('image');
  const householdId = Number(arg('household', 1));
  const inspectOnly = arg('inspect') === true;

  // The retired flag. Named explicitly so anyone (or any script) still passing
  // it is stopped rather than silently getting different behaviour.
  if (arg('dry-run') === true) {
    refuse(4, '--dry-run has been REMOVED (D-2026-08-03-04).',
      'It skipped the model call and exited 0, and that clean exit was read as proof the model path worked while it was broken. Use --inspect, which exits non-zero.');
  }
  if (!image || image === true) {
    console.error('interpret-list: --image <path> is required');
    process.exit(2);
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.ASDAIR_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let catalogue;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    catalogue = await loadCatalogue(client, householdId);
    await client.query('COMMIT');
  } finally {
    await client.end();
  }

  const prompt = buildGroundedPrompt(catalogue);

  // FAIL CLOSED, before the model is asked anything.
  const grounding = checkGrounding(catalogue, prompt);
  if (!grounding.ok) {
    refuse(3, 'the preconditions for a GROUNDED interpretation were not met.', grounding.reason);
  }

  if (inspectOnly) {
    // Deliberately stderr, deliberately ok:false, deliberately non-zero. There
    // is no argument combination that prints a success document without a call.
    console.error(JSON.stringify({
      ok: false,
      model_call_made: false,
      inspection_only: true,
      candidates: catalogue.candidates.length,
      rules: catalogue.rules.length,
      last_order_lines: catalogue.last_order ? catalogue.last_order.lines.length : 0,
      prompt_chars: prompt.length,
    }, null, 1));
    refuse(4, 'inspection only - the model was NOT called.',
      'Nothing in this output evidences that the gateway, the vision alias or the grounded path work.');
  }

  const { vision } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');
  const dataUrl = imageToDataUrl(image);

  let parsed = null;
  let raw = '';
  let modelCallMade = false;
  for (let attempt = 0; attempt <= 2 && parsed === null; attempt++) {
    const suffix = attempt > 0 ? '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.' : '';
    raw = await vision(prompt + suffix, dataUrl);
    // Set only once vision() has RETURNED. A throw leaves it false and the
    // success document below becomes unreachable.
    modelCallMade = true;
    parsed = extractJson(raw);
  }
  if (!parsed || !Array.isArray(parsed.lines)) {
    console.error('interpret-list: model did not return usable JSON');
    process.exit(1);
  }

  const invented = unknownIdClaims(parsed.lines, catalogue);
  if (invented.length > 0) {
    refuse(3, `the model claimed ${invented.length} product id(s) this household does not have.`,
      `lines ${invented.map((c) => c.line_no).join(', ')} - the reply is not trustworthy as a whole, so no result is reported`);
  }

  const lines = resolve(parsed.lines, catalogue);
  const summary = lines.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  // THE ONE SUCCESS PATH, and it cannot be reached without a returned call.
  if (!modelCallMade) {
    refuse(3, 'internal: a result was about to be reported without a model call.', 'This is the invariant this file exists to hold.');
  }

  console.log(JSON.stringify({
    ok: true,
    model_call_made: true,
    not_the_production_path: 'the live shop interprets through services/asdair/pipeline; this is a diagnostic caller',
    catalogue_candidates: catalogue.candidates.length,
    lines_detected: lines.length,
    summary,
    lines,
    provenance: { provider: 'fusion-gateway', model: process.env.FUSION_MODEL_VISION || 'fusion.vision' },
  }, null, 1));
}

if (require.main === module) {
  main().catch((e) => { console.error('interpret-list error:', e.message); process.exit(1); });
}

module.exports = { resolve, checkGrounding, unknownIdClaims };
