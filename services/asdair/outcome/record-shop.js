#!/usr/bin/env node
// =====================================================================
// IDEA-012 AsdAIr / BUILD-015 - record-shop.js
//
// THE RUNTIME CALLER for the outcome + learning writers.
//
// TQA-PR73-006 (HIGH): recordShopOutcome and promoteDecision were built,
// tested and proven end-to-end, but NOTHING INVOKED THEM. So two steps of the
// approved supervised bar --
//
//     ... -> record actual outcome -> persist learning for the next shop
//
// -- could only happen if a human hand-rolled a script, which is exactly the
// per-session-scratchpad failure this build exists to end. This file is that
// missing step, committed.
//
// Usage (after a shop, from services/asdair/outcome):
//     node record-shop.js --file <shop.json>
//     node record-shop.js --file <shop.json> --dry-run
//
// The connection comes ONLY from ASDAIR_WRITE_DB_URL in the environment. It is
// never passed on the command line and never printed.
//
//     node --env-file=<env> record-shop.js --file shop.json
//
// INPUT SHAPE (see SOP-021 steps 5 and 6):
// {
//   "plan": <the planBasket result for this shop, verbatim>,
//   "reconcile": { list_id, household_id, run_at?, attempt?, source_document_id?,
//                  basket_total?, budget?,
//                  items: [ ... what ACTUALLY happened, per line ... ],
//                  events: [ { event_type, description, occurred_at? } ] },
//   "decisions": [ { asked_on, question, answer, applies_going_forward,
//                    household_id?, source_document_id?, one_week_only?,
//                    rule?: { category, rule_text, directive, match_term, ... } } ]
// }
//
// `plan` is what was intended; `reconcile` is what actually happened - the whole
// point of the record. buildOutcome derives the order and event rows from both,
// so a planned-add line that hit an out-of-stock is recorded honestly rather
// than as a success. `decisions` are the answers the human gave
// during it - each becomes a rule_qa_log row, and is promoted into a durable
// rule ONLY where its provenance proves the instruction was explicit (see
// README, "What the guard guarantees"). Non-authoritative learning is preserved
// as behaviourally inert `info`, never dropped.
//
// --dry-run validates the payload and prints what WOULD be written, opening no
// connection at all. Run it first.
//
// NEVER writes checked_out = true. The agent produces a checkout-ready basket
// and never checks out (standing rule 8); recordShopOutcome enforces that in
// SQL rather than trusting this input.
// =====================================================================

'use strict';

const fs = require('node:fs');
const { buildOutcome } = require('./buildOutcome');
const { recordShopOutcome, close: closeOutcome } = require('./recordShopOutcome');
const { promoteDecision, buildPromotion, close: closePromote } = require('./promoteDecision');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const has = function (name) { return process.argv.indexOf('--' + name) >= 0; };

async function main() {
  const file = arg('file', null);
  const dryRun = has('dry-run');

  if (!file) {
    console.error('usage: node record-shop.js --file <shop.json> [--dry-run]');
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

  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];

  // Validate EVERYTHING before opening a connection or writing anything, so a
  // malformed decision cannot leave a shop half-recorded.
  if (!payload.plan) {
    throw new Error('shop file must carry "plan" (the planBasket result) alongside "reconcile" - the record is '
      + 'what was INTENDED vs what actually HAPPENED, and without the plan the outcome cannot be derived.');
  }
  const outcome = buildOutcome({ plan: payload.plan, reconcile: payload.reconcile || {} });
  decisions.forEach(function (d, i) {
    try { buildPromotion(d); }
    catch (e) { throw new Error('decision[' + i + '] is not recordable: ' + e.message); }
  });

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      order: outcome.order,
      events: outcome.events.length,
      decisions: decisions.length,
      note: 'nothing was written and no connection was opened'
    }, null, 1));
    return;
  }

  const result = { order_id: null, decisions: [] };
  try {
    // recordShopOutcome returns the new order id directly, not an object.
    result.order_id = await recordShopOutcome({ order: outcome.order, events: outcome.events });

    // Each decision is its own transaction: one bad answer must not roll back
    // the shop that has already been recorded, nor the answers before it.
    for (let i = 0; i < decisions.length; i++) {
      try {
        const r = await promoteDecision(decisions[i]);
        result.decisions.push({ index: i, logId: r.logId, ruleId: r.ruleId || null });
      } catch (e) {
        result.decisions.push({ index: i, error: e.message });
      }
    }
  } finally {
    await closeOutcome().catch(function () {});
    await closePromote().catch(function () {});
  }

  const failed = result.decisions.filter(function (d) { return d.error; });
  console.log(JSON.stringify(result, null, 1));
  if (failed.length) {
    console.error(failed.length + ' decision(s) were NOT recorded - see errors above.');
    process.exitCode = 1;
  }
}

main().catch(function (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exitCode = 1;
});
