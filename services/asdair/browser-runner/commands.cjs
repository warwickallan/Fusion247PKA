// =====================================================================
// BUILD-015 AsdAIr browser runner - THE COMMAND ALLOWLIST.
//
// This file is the single source of truth for what the runner is able to do
// against the live ASDA session. It is deliberately a CLOSED set: runner.js
// dispatches ONLY through `assertAllowed`, so a step naming anything not
// listed here cannot execute.
//
// There is deliberately NO command - and no code path anywhere in this folder
// - for: checkout, payment, booking or changing a delivery slot, entering a
// password, changing payment details, enabling substitutions, or accepting an
// unapproved substitute. `forbidden.test.cjs` enforces that by scanning this
// folder's own source with comments stripped, and fails the build if any such
// path appears.
//
// THE STRUCTURAL INVARIANT that makes several of those impossible at once:
// the runner NEVER SYNTHESISES KEYBOARD INPUT. It uses no CDP `Input.` domain
// method, ever. Search is performed by navigating to a search URL; quantity is
// changed with the real +/- steppers. A process that cannot type cannot enter a
// password, cannot enter card details, and cannot set a quantity by typing
// (SOP-021's most expensive lesson: typed quantities do not persist
// server-side).
// =====================================================================
'use strict';

/**
 * The allowlisted command surface. `kind` separates commands that touch the
 * browser from control commands that only move the runner's own state.
 *   navigate : opens a permitted surface
 *   read     : reads state, changes nothing
 *   write    : changes the live trolley (only these can mutate anything)
 *   control  : changes runner state only, never touches the browser
 */
const COMMANDS = Object.freeze({
  open_groceries:          { kind: 'navigate', args: [] },
  open_trolley:            { kind: 'navigate', args: [] },
  open_regulars:           { kind: 'navigate', args: [] },
  locate_product:          { kind: 'navigate', args: ['product_ref'] },
  add_known_product:       { kind: 'write',    args: ['product_ref'] },
  search:                  { kind: 'navigate', args: ['term'] },
  select_search_result:    { kind: 'write',    args: ['term', 'product_ref'] },
  set_quantity:            { kind: 'write',    args: ['product_ref', 'qty'] },
  read_quantity:           { kind: 'read',     args: ['product_ref'] },
  add_to_favourites:       { kind: 'write',    args: ['product_ref'] },
  report_unavailable:      { kind: 'read',     args: ['product_ref'] },
  read_basket_line_count:  { kind: 'read',     args: [] },
  read_estimated_total:    { kind: 'read',     args: [] },
  pause:                   { kind: 'control',  args: [] },
  resume:                  { kind: 'control',  args: [] },
  stop_at_basket_ready:    { kind: 'control',  args: [] },
});

const ALLOWED = Object.freeze(Object.keys(COMMANDS).sort());

class NotAllowedError extends Error {
  constructor(name) {
    super(`command not on the allowlist: ${JSON.stringify(String(name))}`);
    this.name = 'NotAllowedError';
    this.command = name;
  }
}

/** Throws unless `name` is on the allowlist. The only dispatch gate. */
function assertAllowed(name) {
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, name)) {
    throw new NotAllowedError(name);
  }
  return COMMANDS[name];
}

/** A product reference is an ASDA numeric product id. Nothing else is accepted. */
function normaliseProductRef(ref) {
  const s = String(ref == null ? '' : ref).trim();
  if (!/^\d{3,12}$/.test(s)) throw new Error(`not an ASDA product reference: ${JSON.stringify(String(ref))}`);
  return s;
}

/** Search terms are letters/digits/spaces/&-'. and nothing that could shape a URL. */
function normaliseTerm(term) {
  const s = String(term == null ? '' : term).trim().replace(/\s+/g, ' ');
  if (!s) throw new Error('empty search term');
  if (s.length > 80) throw new Error('search term too long');
  if (!/^[A-Za-z0-9 &'.\-%+]+$/.test(s)) throw new Error(`unsafe search term: ${JSON.stringify(s)}`);
  return s;
}

/** Quantities are small positive integers. A cap keeps a bad plan cheap. */
const MAX_QTY = 24;
function normaliseQty(qty) {
  // Explicitly reject the empties BEFORE Number(), because Number(null) and
  // Number('') are both 0 - and 0 is a legal quantity (it means "remove"), so a
  // missing value would otherwise be silently accepted as an instruction to
  // empty that line.
  if (qty == null || qty === '' || typeof qty === 'boolean') throw new Error(`quantity out of range 0..${MAX_QTY}: ${JSON.stringify(qty)}`);
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 0 || n > MAX_QTY) {
    throw new Error(`quantity out of range 0..${MAX_QTY}: ${JSON.stringify(qty)}`);
  }
  return n;
}

/**
 * Validate one plan step and return the canonical form the runner executes.
 * `step_id` is the durable idempotency key: a step whose id is already in the
 * completed set is NEVER executed again, which is what makes resume-after-
 * restart safe against duplicate adds.
 */
function validateStep(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('step must be an object');
  const spec = assertAllowed(raw.command);
  const step = { step_id: String(raw.step_id || '').trim(), command: raw.command, kind: spec.kind };
  if (!step.step_id) throw new Error('step_id is required (it is the idempotency key)');
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(step.step_id)) throw new Error(`unsafe step_id: ${JSON.stringify(step.step_id)}`);
  for (const a of spec.args) {
    if (a === 'product_ref') step.product_ref = normaliseProductRef(raw.product_ref);
    else if (a === 'term') step.term = normaliseTerm(raw.term);
    else if (a === 'qty') step.qty = normaliseQty(raw.qty);
  }
  // Optional, non-executable metadata carried through for reporting only.
  if (raw.name != null) step.name = String(raw.name).slice(0, 160);
  if (raw.origin != null) {
    const o = String(raw.origin);
    if (o !== 'regular' && o !== 'searched') throw new Error(`origin must be regular|searched: ${JSON.stringify(o)}`);
    step.origin = o;
  }
  return step;
}

/** Validate a whole plan, rejecting duplicate step ids up front. */
function validatePlan(rawPlan) {
  if (!Array.isArray(rawPlan)) throw new Error('plan must be an array of steps');
  const seen = new Set();
  return rawPlan.map((s, i) => {
    let step;
    try { step = validateStep(s); }
    catch (e) { throw new Error(`plan step ${i}: ${e.message}`); }
    if (seen.has(step.step_id)) throw new Error(`plan step ${i}: duplicate step_id ${step.step_id}`);
    seen.add(step.step_id);
    return step;
  });
}

module.exports = {
  COMMANDS, ALLOWED, MAX_QTY, NotAllowedError,
  assertAllowed, normaliseProductRef, normaliseTerm, normaliseQty,
  validateStep, validatePlan,
};
