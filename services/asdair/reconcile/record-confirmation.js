#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr - record-confirmation.js
//
// THE RUNTIME CALLER for the order-confirmation reconciliation loop
// (SOP-021, the step after the shop): parse the confirmation Warwick pasted,
// reconcile it against the STORED PLAN, and persist both so next week's shop
// can learn from what actually arrived.
//
// Usage (from services/asdair/reconcile):
//     node record-confirmation.js --file <payload.json>
//     node record-confirmation.js --file <payload.json> --dry-run
//
// The connection comes ONLY from ASDAIR_WRITE_DB_URL in the environment. It is
// never passed on the command line, never printed, and no credentials file is
// ever read:
//
//     node --env-file=<env> record-confirmation.js --file payload.json
//
// --dry-run parses, reconciles and validates EVERYTHING, prints exactly what
// WOULD be written, and opens NO connection at all. Run it first.
//
// INPUT SHAPE
// {
//   "shop_id": 12,                       // required, asdair.shop.id
//   "order_id": 34,                      // optional, asdair.orders.id
//   "household_id": 1,                   // optional, scopes regulars matching
//   "source_kind": "text",               // text | photo | document
//   "raw_text": "<the pasted ASDA confirmation, verbatim>",
//   "raw_media_path": null,              // when the evidence is a photo/document
//   "parse_provider": "asdair/reconcile/parseConfirmation@1",   // optional
//   "derive_single_missing_price": false,
//   "received_at": null,                 // optional ISO timestamp
//
//   "plan": { "items": [ ... ] },        // REQUIRED: the stored planBasket result
//   "list_items": [ { "item_name": "..." } ],   // the original list
//   "regulars": [ { "id": 4, "name": "...", "aka": ["..."] } ]
// }
//
// `plan` is REQUIRED and is not optional convenience: `omitted` is derived by
// comparing against the stored plan and can be derived no other way. A thing
// absent from a receipt is only "omitted" if it was actually planned.
//
// NEVER contacts ASDA, never opens a browser, never checks out, never pays.
// It reads text you already have and writes it down.
// =====================================================================

'use strict';

const fs = require('node:fs');
const { parseConfirmation, formatLinePrice, PARSER_VERSION } = require('./parseConfirmation');
const { reconcile } = require('./reconcile');
const {
  recordConfirmation,
  confirmationFingerprint,
  close: closeConfirmation,
  _internal: writerInternal
} = require('./recordConfirmation');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return eq === undefined ? fallback : eq.slice(('--' + name + '=').length);
}
const has = function (name) { return process.argv.indexOf('--' + name) >= 0; };

// Build the object the writer takes, from the payload plus the pure results.
// Exported so the tests exercise EXACTLY what the CLI builds, rather than a
// hand-rolled lookalike.
function buildPayload(payload) {
  const p = payload || {};

  if (p.raw_text === null || p.raw_text === undefined || String(p.raw_text).trim() === '') {
    if (p.raw_media_path === null || p.raw_media_path === undefined || String(p.raw_media_path).trim() === '') {
      throw new Error('the payload must carry "raw_text" (the pasted confirmation) or "raw_media_path". ' +
        'The raw evidence is always retained.');
    }
  }

  const parsed = parseConfirmation({
    text: p.raw_text === null || p.raw_text === undefined ? '' : p.raw_text,
    source_kind: p.source_kind,
    derive_single_missing_price: p.derive_single_missing_price === true
  });

  const reconciled = reconcile({
    confirmation: parsed,
    plan: p.plan,
    list_items: p.list_items,
    regulars: p.regulars,
    household_id: p.household_id
  });

  const confirmation = {
    shop_id: p.shop_id,
    order_id: p.order_id === undefined ? null : p.order_id,
    source_kind: parsed.source_kind,
    raw_text: p.raw_text === undefined ? null : p.raw_text,
    raw_media_path: p.raw_media_path === undefined ? null : p.raw_media_path,
    parse_provider: p.parse_provider === undefined || p.parse_provider === null ? PARSER_VERSION : p.parse_provider,
    parser_version: parsed.parser_version,
    stated_total: parsed.stated_total,
    stated_total_basis: parsed.stated_total_basis,
    derivation: parsed.derivation,
    warnings: parsed.warnings,
    skipped: parsed.skipped,
    parse_summary: parsed.summary,
    reconcile_summary: reconciled.summary,
    received_at: p.received_at === undefined ? null : p.received_at,
    reconciled_at: p.reconciled_at === undefined ? null : p.reconciled_at,
    lines: reconciled.lines
  };

  // Fails loudly here - before any connection - if anything violates the price
  // contract or the outcome vocabulary.
  writerInternal.assertRecordable(confirmation);

  return { parsed: parsed, reconciled: reconciled, confirmation: confirmation };
}

// What a dry run can honestly report. Prices are rendered ONLY through
// formatLinePrice, so a derived price can never be printed as a stated one.
function describe(built) {
  return {
    shop_id: built.confirmation.shop_id,
    source_kind: built.confirmation.source_kind,
    natural_key: 'shop_id + content_fingerprint',
    content_fingerprint: confirmationFingerprint(built.confirmation),
    stated_total: built.confirmation.stated_total,
    stated_total_basis: built.confirmation.stated_total_basis,
    derivation: built.confirmation.derivation,
    parse_summary: built.parsed.summary,
    reconcile_summary: built.reconciled.summary,
    warnings: built.parsed.warnings,
    lines: built.confirmation.lines.map(function (l) {
      return {
        line_no: l.line_no,
        product_name: l.product_name,
        quantity: l.quantity,
        outcome: l.outcome,
        price: formatLinePrice(l),
        price_basis: l.price_basis,
        note: l.note
      };
    })
  };
}

async function main() {
  const file = arg('file', null);
  const dryRun = has('dry-run');

  if (!file) {
    console.error('usage: node record-confirmation.js --file <payload.json> [--dry-run]');
    process.exitCode = 2;
    return;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('could not read/parse ' + file + ': ' + e.message);
    process.exitCode = 2;
    return;
  }

  let built;
  try {
    built = buildPayload(payload);
  } catch (e) {
    console.error('the payload is not recordable: ' + e.message);
    process.exitCode = 2;
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      would_write: describe(built),
      note: 'nothing was written and no connection was opened'
    }, null, 1));
    return;
  }

  try {
    const result = await recordConfirmation(built.confirmation);
    console.log(JSON.stringify({
      confirmation_id: result.confirmation_id,
      created: result.created,
      lines_written: result.lines_written,
      content_fingerprint: result.content_fingerprint,
      reconcile_summary: built.reconciled.summary,
      note: result.created
        ? 'recorded'
        : 'already recorded for this shop - re-submitting the same confirmation is a no-op'
    }, null, 1));
  } finally {
    await closeConfirmation().catch(function () {});
  }
}

if (require.main === module) {
  main().catch(function (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exitCode = 1;
  });
}

module.exports = { buildPayload: buildPayload, describe: describe };
