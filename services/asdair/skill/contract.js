// =====================================================================
// BUILD-015 AsdAIr - skill/contract.js
//
// THE APPROVED CONTRACT, READ AT RUNTIME, CARRIED INTO THE DECISION.
//
// ── WHY THIS FILE EXISTS (Veritas Gate 2, finding 8) ───────────────────────
// "The runtime consumes no contract or SOP text at any point." That was true:
// `SOP-021` appeared inside `services/asdair/**` only in code comments, and the
// approved goal contract reached the running process not at all. So the estate
// had a contract ABOUT the runtime rather than a contract IN it, and repairing
// the documents - which Nolan did, correctly - closed a contradiction without
// closing that defect.
//
// Warwick, 2026-08-18: "THE APPROVED CONTRACT DID NOT BECOME LOAD-BEARING
// RUNTIME BEHAVIOUR." This module is the first half of making it so. The second
// half is skill/decide.js, which puts these bytes in front of the model at the
// moment it chooses what to buy.
//
// ── WHY THE CANONICAL BYTES AND NEVER A COPY ───────────────────────────────
// A distilled copy under services/ would be a second contract text, and a
// second text is the drift that produced the stale specialist shim in the first
// place. There is exactly one home for each of these documents; this module
// READS them where they live and never restates them. That is the SSOT rule
// applied to runtime data rather than to prose.
//
// Reaching the repository root from a service module is not new here:
// basket-executor/run-basket.cjs already resolves `REPO` the same way.
//
// ── FAIL LOUD. THIS IS THE POINT OF THE MODULE. ────────────────────────────
// If a contract source is missing or unreadable, this throws. It does NOT
// return partial text, does not fall back to an embedded summary, and does not
// let the decision proceed uncontracted. A decision taken without the contract
// is exactly the state Gate 2 failed, and it must never be reachable by
// accident - so the failure is noisy and stops the step, rather than quietly
// degrading into the behaviour this build is removing.
//
// ── THE DIGEST IS EVIDENCE, NOT DECORATION ─────────────────────────────────
// `sha256` is computed over the exact bytes that go into the prompt, and the
// caller records it in the durable audit. That is what lets a reviewer
// establish AFTER THE FACT which contract governed a given decision, instead of
// taking the runtime's word that one did. "The contract reached the decision
// point" stops being a claim and becomes a checkable fact.
//
// PURE apart from the file read. No database, no gateway, no clock.
// =====================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// services/asdair/skill -> services/asdair -> services -> <repo root>
const REPO = path.resolve(__dirname, '..', '..', '..');

/**
 * The canonical contract sources, in the order they are carried.
 *
 * BOTH are load-bearing and they answer different questions:
 *   * the goal contract states WHAT AsdAIr is for, the two structural rules,
 *     the identity ruling (the ASDA description is the identity, never the id),
 *     the resolution order, and the product boundaries;
 *   * the specialist contract states HOW Asdair decides - "Deterministic
 *     components serve Asdair; they never decide for it. Asdair decides; code
 *     executes."
 *
 * Neither is quoted here. Quoting one would create the second copy this module
 * exists to avoid.
 */
const CONTRACT_SOURCES = Object.freeze([
  path.join('Builds', 'BUILD-015-asdair-durable-household-shopping-steward', 'BUILD-015-goal-contract.md'),
  path.join('Team', 'Asdair - Household Shopping Steward', 'AGENTS.md'),
]);

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Read the approved contract from its canonical committed location.
 *
 * @param {{repoRoot?:string, sources?:string[]}} [options] test seam only. The
 *        production call takes no arguments and reads the real repository.
 * @returns {{text:string, sha256:string, bytes:number,
 *            sources:Array<{path:string, bytes:number, sha256:string}>}}
 * @throws {Error} when any source is missing, unreadable or empty. Loudly.
 */
function loadContract(options) {
  const opts = options || {};
  const root = opts.repoRoot || REPO;
  const rel = Array.isArray(opts.sources) && opts.sources.length > 0 ? opts.sources : CONTRACT_SOURCES;

  const sources = [];
  const parts = [];
  rel.forEach(function (r) {
    const full = path.join(root, r);
    let buf;
    try {
      buf = fs.readFileSync(full);
    } catch (e) {
      throw new Error(
        'asdair contract: cannot read the approved contract at "' + full + '" (' + (e && e.code ? e.code : e)
        + '). The decision point REFUSES to run uncontracted - see Veritas Gate 2 finding 8. '
        + 'Nothing was decided and nothing was written.'
      );
    }
    if (buf.length === 0) {
      throw new Error('asdair contract: "' + full + '" is empty. Refusing to decide against an empty contract.');
    }
    sources.push({ path: r.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) });
    // The document's own path is carried into the text so the model - and any
    // human reading the recorded prompt afterwards - can see WHICH authority a
    // clause came from rather than reading two documents fused into one.
    parts.push('# SOURCE: ' + r.split(path.sep).join('/') + '\n\n' + buf.toString('utf8'));
  });

  const text = parts.join('\n\n---\n\n');
  const buf = Buffer.from(text, 'utf8');
  return { text: text, sha256: sha256(buf), bytes: buf.length, sources: sources };
}

module.exports = { loadContract, CONTRACT_SOURCES, REPO };
