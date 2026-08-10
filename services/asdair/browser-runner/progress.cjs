// =====================================================================
// BUILD-015 AsdAIr browser runner - the DURABLE PROGRESS MODEL.
//
// Everything in this file is pure: it takes the `progress` jsonb as it exists
// in asdair.browser_build_request and returns the next value. No I/O, so the
// whole restart/resume story is unit-testable offline with no database, no
// Chrome and no ASDA.
//
// THE FOUR REPORTED KEYS ARE FIXED BY CONTRACT and read by Telegram and the
// Cockpit: regulars_added, searched_added, basket_product_count,
// estimated_total. `normalise` guarantees they are always present, so a
// consumer never has to guess whether a missing key means zero or unknown.
//
// `basket_shortfall` is a report too, and it is DELIBERATELY NOT in
// REPORTED_KEYS. That list is a contract with consumers outside this folder;
// widening it is their change to accept, not this file's to take. Nothing is
// lost by its absence - `summary()` returns the key either way.
//
// Runner-internal bookkeeping is prefixed with `_` so a consumer can tell at a
// glance what is a report and what is machinery.
// =====================================================================
'use strict';

const REPORTED_KEYS = Object.freeze([
  'regulars_added', 'searched_added', 'basket_product_count', 'estimated_total',
]);

// `dry_run` is its own terminal state and not a flavour of `basket_ready`. A
// rehearsal issues no browser command, so it has built nothing and read
// nothing; recording it as basket_ready would be the runner claiming an outcome
// it never went and looked at. Nothing outside this folder reads this field.
const RUNNER_STATES = Object.freeze([
  'idle', 'running', 'paused', 'human_takeover', 'basket_ready', 'dry_run', 'failed',
]);

/** The shape every progress read is coerced to. Missing -> explicit zero/empty. */
function normalise(progress) {
  const p = (progress && typeof progress === 'object' && !Array.isArray(progress)) ? { ...progress } : {};
  p.regulars_added = int(p.regulars_added);
  p.searched_added = int(p.searched_added);
  p.basket_product_count = p.basket_product_count == null ? 0 : int(p.basket_product_count);
  p.estimated_total = p.estimated_total == null ? null : String(p.estimated_total);
  p.held_items = arr(p.held_items);
  p.unavailable_items = arr(p.unavailable_items);
  p.failed_actions = arr(p.failed_actions);
  p.pending_favourite_actions = arr(p.pending_favourite_actions);
  p.last_successful_browser_step = p.last_successful_browser_step == null ? null : String(p.last_successful_browser_step);
  p.human_reauth_required = p.human_reauth_required === true;
  p.basket_shortfall = obj(p.basket_shortfall);
  p._completed_steps = arr(p._completed_steps);
  p._runner_state = RUNNER_STATES.includes(p._runner_state) ? p._runner_state : 'idle';
  return p;
}

const int = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0; };
const arr = (v) => (Array.isArray(v) ? v.slice() : []);
// null, not {} - "no shortfall has been computed" and "a shortfall of zero" are
// different facts, and collapsing them would let an unmeasured run read as a
// clean one.
const obj = (v) => ((v && typeof v === 'object' && !Array.isArray(v)) ? { ...v } : null);

/**
 * The commands that put a product in the trolley.
 *
 * Taken from commands.cjs's own `kind: 'write'` classification rather than
 * invented here, and narrowed to the two that ADD: `set_quantity` and
 * `add_to_favourites` are writes that change nothing about how many products
 * the plan intended to place.
 */
const ADD_COMMANDS = Object.freeze(['add_known_product', 'select_search_result']);

/** How many DISTINCT products the plan set out to put in the trolley. */
function intendedAdds(plan) {
  const refs = new Set();
  for (const s of (Array.isArray(plan) ? plan : [])) {
    if (s && ADD_COMMANDS.includes(s.command) && s.product_ref != null) refs.add(String(s.product_ref));
  }
  return refs.size;
}

/**
 * THE DIFFERENCE BETWEEN WHAT WAS INTENDED AND WHAT THE TROLLEY GOT.
 *
 * A shortfall is NOT a failure. Items go out of stock; that is ordinary
 * shopping, and this estate already treats a shortfall as a per-line reported
 * outcome (`short: 'fewer than planned'`) rather than a threshold to fail on.
 * What was missing was not a rule - it was the SUBTRACTION. Nothing anywhere
 * compared the two numbers, so a trolley holding less than the list asked for
 * was indistinguishable from one holding all of it.
 *
 * `missing` is deliberately the whole gap, with `unavailable`/`held`/`failed`
 * beside it as the explanation. A gap larger than those three accounts for is
 * itself the interesting signal: something went wrong that nobody recorded.
 */
function basketShortfall(plan, progress) {
  const p = normalise(progress);
  const intended = intendedAdds(plan);
  const added = p.regulars_added + p.searched_added;
  return {
    intended,
    added,
    missing: Math.max(0, intended - added),
    unavailable: p.unavailable_items.length,
    held: p.held_items.length,
    failed: p.failed_actions.length,
    basket_product_count: p.basket_product_count,
  };
}

/** Fold the shortfall into progress, where it is durable and reportable. */
function applyShortfall(progress, plan) {
  const p = normalise(progress);
  p.basket_shortfall = basketShortfall(plan, p);
  return p;
}

/** Ids of every step already durably recorded as done. */
function completedStepIds(progress) {
  return new Set(normalise(progress)._completed_steps.map((e) => (e && e.step_id) || String(e)));
}

/**
 * Reconstruct what is left to do after a restart. THIS is the anti-duplicate
 * rule: a step whose id is in the completed set is dropped, never re-run, even
 * if the process died between the browser click and the database write - see
 * `pendingBeforeCommit` below for how that window is closed.
 */
function remainingPlan(plan, progress) {
  const done = completedStepIds(progress);
  return plan.filter((s) => !done.has(s.step_id));
}

/**
 * The crash window: a step is marked `_in_flight` BEFORE the browser action and
 * moved to `_completed_steps` after. On restart, an id still sitting in
 * `_in_flight` means "we may or may not have clicked it". The safe answer is
 * never to click it again blind: it is reported for verification and the step
 * is treated as needing a read-back before any further write.
 */
function inFlightStepId(progress) {
  const p = normalise(progress);
  return typeof p._in_flight === 'string' && p._in_flight ? p._in_flight : null;
}

function markInFlight(progress, stepId) {
  const p = normalise(progress);
  p._in_flight = String(stepId);
  return p;
}

/** Record a step as durably done. Idempotent: recording twice does not double-count. */
function markCompleted(progress, step, result = {}) {
  const p = normalise(progress);
  const done = new Set(p._completed_steps.map((e) => e.step_id));
  if (p._in_flight === step.step_id) delete p._in_flight;
  if (done.has(step.step_id)) return p;
  p._completed_steps = p._completed_steps.concat([{
    step_id: step.step_id,
    command: step.command,
    product_ref: step.product_ref || null,
    at: result.at || new Date().toISOString(),
    outcome: result.outcome || 'ok',
  }]);
  if (result.outcome === 'ok' || result.outcome == null) {
    if (step.command === 'add_known_product' && step.origin !== 'searched') p.regulars_added += 1;
    if (step.command === 'select_search_result' || (step.command === 'add_known_product' && step.origin === 'searched')) p.searched_added += 1;
    if (step.command === 'add_to_favourites') {
      p.pending_favourite_actions = p.pending_favourite_actions.filter((f) => refOf(f) !== step.product_ref);
    }
    p.last_successful_browser_step = `${step.command}${step.product_ref ? ':' + step.product_ref : ''}${step.term ? ':' + step.term : ''}`;
  }
  return p;
}

const refOf = (x) => (x && typeof x === 'object' ? String(x.product_ref) : String(x));

/** A step attempted and failed. Recorded, never silently dropped. */
function markFailed(progress, step, reason) {
  const p = normalise(progress);
  if (p._in_flight === step.step_id) delete p._in_flight;
  p.failed_actions = p.failed_actions.concat([{
    step_id: step.step_id, command: step.command,
    product_ref: step.product_ref || null,
    reason: String(reason).slice(0, 400), at: new Date().toISOString(),
  }]);
  return p;
}

/** An item ASDA could not supply. Reported; never substituted. */
function markUnavailable(progress, step, note) {
  const p = markCompleted(progress, step, { outcome: 'unavailable' });
  p.unavailable_items = p.unavailable_items.concat([{
    step_id: step.step_id, product_ref: step.product_ref || null,
    name: step.name || null, note: note == null ? null : String(note).slice(0, 200),
    at: new Date().toISOString(),
  }]);
  return p;
}

/** An item deliberately held back for a human answer. */
function markHeld(progress, step, reason) {
  const p = normalise(progress);
  if (p.held_items.some((h) => h.step_id === step.step_id)) return p;
  p.held_items = p.held_items.concat([{
    step_id: step.step_id, product_ref: step.product_ref || null,
    name: step.name || null, reason: String(reason).slice(0, 200),
    at: new Date().toISOString(),
  }]);
  return p;
}

/** A favourite action the browser could not complete. Surfaced, never forgotten. */
function markPendingFavourite(progress, step, reason) {
  const p = normalise(progress);
  if (p.pending_favourite_actions.some((f) => refOf(f) === step.product_ref)) return p;
  p.pending_favourite_actions = p.pending_favourite_actions.concat([{
    product_ref: step.product_ref || null, name: step.name || null,
    reason: String(reason).slice(0, 200), at: new Date().toISOString(),
  }]);
  return p;
}

/** Fold a trolley read-back into the two basket keys. */
function applyBasketRead(progress, read) {
  const p = normalise(progress);
  if (read && read.product_count != null) p.basket_product_count = int(read.product_count);
  if (read && read.order_total != null) p.estimated_total = String(read.order_total);
  return p;
}

function setRunnerState(progress, state) {
  if (!RUNNER_STATES.includes(state)) throw new Error(`unknown runner state: ${state}`);
  const p = normalise(progress);
  p._runner_state = state;
  return p;
}

function setReauthRequired(progress, required, detail) {
  const p = normalise(progress);
  p.human_reauth_required = required === true;
  if (required) p._reauth_detected_at = new Date().toISOString();
  if (detail) p._reauth_detail = String(detail).slice(0, 300);
  return p;
}

/** The compact summary the report/proof quotes. Reported keys only. */
function summary(progress) {
  const p = normalise(progress);
  return {
    regulars_added: p.regulars_added,
    searched_added: p.searched_added,
    basket_product_count: p.basket_product_count,
    estimated_total: p.estimated_total,
    basket_shortfall: p.basket_shortfall,
    held_items: p.held_items.length,
    unavailable_items: p.unavailable_items.length,
    failed_actions: p.failed_actions.length,
    pending_favourite_actions: p.pending_favourite_actions.length,
    last_successful_browser_step: p.last_successful_browser_step,
    human_reauth_required: p.human_reauth_required,
    runner_state: p._runner_state,
    completed_steps: p._completed_steps.length,
  };
}

module.exports = {
  REPORTED_KEYS, RUNNER_STATES, ADD_COMMANDS,
  normalise, completedStepIds, remainingPlan, inFlightStepId, markInFlight,
  markCompleted, markFailed, markUnavailable, markHeld, markPendingFavourite,
  applyBasketRead, intendedAdds, basketShortfall, applyShortfall,
  setRunnerState, setReauthRequired, summary,
};
