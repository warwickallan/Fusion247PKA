#!/usr/bin/env node
// BUILD-015 AsdAIr Stage 1 - interpret-list.js
//
// THE RUNTIME CALLER for catalogue-grounded list interpretation.
//
//   node --env-file=<env> interpret-list.js --image <path> [--household 1] [--json] [--dry-run]
//
// Loads the household's canonical catalogue from Supabase (READ-ONLY), grounds
// ONE vision request with it, then resolves the model's chosen candidate IDS
// against our own catalogue. Canonical product names come from OUR database -
// the model only ever supplies an id and a raw reading, so it cannot invent a
// product that does not exist.
//
// --dry-run loads the catalogue and prints the prompt WITHOUT making a model call.
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

async function main() {
  const image = arg('image');
  const householdId = Number(arg('household', 1));
  const dryRun = arg('dry-run') === true;
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

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      candidates: catalogue.candidates.length,
      rules: catalogue.rules.length,
      last_order_lines: catalogue.last_order ? catalogue.last_order.lines.length : 0,
      prompt_chars: prompt.length,
      note: 'no model call was made',
    }, null, 1));
    return;
  }

  const { vision } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');
  const dataUrl = imageToDataUrl(image);

  let parsed = null;
  let raw = '';
  for (let attempt = 0; attempt <= 2 && parsed === null; attempt++) {
    const suffix = attempt > 0 ? '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.' : '';
    raw = await vision(prompt + suffix, dataUrl);
    parsed = extractJson(raw);
  }
  if (!parsed || !Array.isArray(parsed.lines)) {
    console.error('interpret-list: model did not return usable JSON');
    process.exit(1);
  }

  const lines = resolve(parsed.lines, catalogue);
  const summary = lines.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  console.log(JSON.stringify({
    catalogue_candidates: catalogue.candidates.length,
    lines_detected: lines.length,
    summary,
    lines,
    provenance: { provider: 'fusion-gateway', model: process.env.FUSION_MODEL_VISION || 'fusion.vision' },
  }, null, 1));
}

main().catch((e) => { console.error('interpret-list error:', e.message); process.exit(1); });

module.exports = { resolve };
