// =====================================================================
// WO-2026-08-18-B15-RUNTIME - GAP 10. THE METHOD THE RUNTIME ACTUALLY OBEYS.
//
// THE FAILURE THIS CLOSES, in Warwick's words: "Do not repeat tonight's mistake
// of proving rules exist in files while the executor ignores them."
//
// On 2026-08-17 the production browser method was already written down, pinned,
// versioned and covered by a passing test - in `handoff/instructions.js`, whose
// `regulars_favourites_first` entry says in terms "Source from the Regulars /
// Favourites view FIRST". The executor that actually drove the trolley had
// never read that file. It free-searched every line without a stored id, one
// navigation and one model call each, and produced four abstentions on products
// that were sitting on the Favourites page with unambiguous descriptions.
//
// Both halves were green the whole time. The method was proven to EXIST;
// nothing proved it was OBEYED.
//
// -------------------------------------------------------------------------
// SO THIS MODULE IS A CONSUMER, NOT A SECOND COPY.
// -------------------------------------------------------------------------
// It restates no behaviour. It reads the pinned BROWSER_METHOD and turns the
// ids that are PRESENT into the flags the executor branches on. There is
// deliberately no default, no fallback set and no local literal of the method:
// if an id is not in the pinned method, the behaviour it authorises does not
// run.
//
// THAT IS THE TEST WARWICK ASKED FOR, and it is a behavioural one rather than a
// documentary one:
//
//     remove `regulars_favourites_first` from the pinned method
//       -> policy.favouritesFirst becomes false
//       -> the executor stops reading the Favourites grid
//       -> the resolution ladder loses its Favourites rung
//
// A rule change alters what the runtime does. `method.test.cjs` proves it by
// mutating an injected method set and asserting the executor's behaviour moved,
// which is why this module takes the method as an ARGUMENT and does not reach
// for the module-level import except at the default.
//
// -------------------------------------------------------------------------
// WHAT THIS IS NOT
// -------------------------------------------------------------------------
// Not a rule engine, not a registry, not a DSL, not a policy service. It is a
// lookup over a frozen array of ids that already existed, plus the honest
// statement of which ids this executor is CAPABLE of obeying - because claiming
// to obey an instruction there is no code path for is the same defect in a new
// direction.
//
// PURE. No I/O, no clock, no network.
// =====================================================================
'use strict';

const { BROWSER_METHOD, INSTRUCTIONS_VERSION } = require('../handoff/instructions.js');

/**
 * The method ids this executor has an actual code path for, mapped to the flag
 * that path reads.
 *
 * THE `capability` FIELD IS THE HONESTY COLUMN. `true` means this process
 * implements the behaviour itself; `false` means the instruction is real and
 * pinned but is carried out somewhere else (or by a human), so a report may say
 * it was DELIVERED and must never say it was ENFORCED here.
 */
const OBEYED = Object.freeze({
  audit_trolley_first: { flag: 'auditTrolleyFirst', capability: true },
  regulars_favourites_first: { flag: 'favouritesFirst', capability: true },
  known_item_retrieval: { flag: 'retrieveKnownBySearch', capability: true },
  new_item_search_exact_wording: { flag: 'searchNewItemsVerbatim', capability: true },
  favourite_and_capture_new_product: { flag: 'captureNewProductRef', capability: true },
  one_session_one_page_context: { flag: 'oneSessionOnePage', capability: true },
  batch_adds_and_split_on_failure: { flag: 'bulkPassWithSplitOnFailure', capability: true },
  verify_each_add_from_trolley: { flag: 'verifyAddsFromTrolley', capability: true },
  unavailable_item_handling: { flag: 'unavailableIsNotAmbiguous', capability: true },
  quantity_by_stepper_not_typing: { flag: 'quantityByStepper', capability: true },
  reconcile_from_quantity_field: { flag: 'reconcileFromQuantityField', capability: true },
  stop_at_checkout_ready_basket: { flag: 'stopAtReadyBasket', capability: true },
  batch_questions_into_one_ask: { flag: 'batchQuestions', capability: true },
  // Pinned, real, and NOT this process's to perform. `set_brand_az_ordering`
  // needs a sort control on the Regulars grid that nothing here has ever been
  // able to verify against the live page; `consume_plan_in_order` is satisfied
  // by the manifest's own ordering upstream; `read_structure_not_pixels` is a
  // property of how this runner works (page text and the accessibility tree -
  // it takes no screenshots at all) rather than a branch it takes;
  // `reacquire_refs_after_mutation` likewise - every read is a fresh
  // evaluation against the live DOM, so there is no stale reference to hold.
  set_brand_az_ordering: { flag: 'brandAzOrdering', capability: false },
  consume_plan_in_order: { flag: 'planOrderIsFixed', capability: false },
  read_structure_not_pixels: { flag: 'readStructureNotPixels', capability: false },
  reacquire_refs_after_mutation: { flag: 'reacquireRefsAfterMutation', capability: false },
  record_run_and_mark_reuse: { flag: 'recordRunForReuse', capability: false },
});

/** Every flag name, so a policy object has a fixed shape whatever the method says. */
const ALL_FLAGS = Object.freeze(Object.values(OBEYED).map((v) => v.flag).sort());

/**
 * The pinned method -> the flags the executor branches on.
 *
 * ABSENT MEANS OFF. There is no default-on flag and no "sensible fallback": a
 * behaviour that has been removed from the method must stop happening, or this
 * module is decoration.
 */
function methodPolicy(method = BROWSER_METHOD) {
  const ids = new Set((method || []).map((m) => m && m.id).filter(Boolean));
  const policy = {};
  for (const flag of ALL_FLAGS) policy[flag] = false;
  for (const [id, spec] of Object.entries(OBEYED)) {
    if (ids.has(id)) policy[spec.flag] = true;
  }
  return Object.freeze(policy);
}

/**
 * What the runtime should SAY about the method it is running under.
 *
 * Emitted into the run log at the top of every run. Three numbers a reader can
 * check against the pinned file without trusting this process's summary of it:
 * how many instructions were delivered, how many this executor implements, and
 * WHICH ones it does not - by id, never as a count alone.
 */
function methodReport(method = BROWSER_METHOD) {
  const list = (method || []).filter((m) => m && m.id);
  const known = list.filter((m) => OBEYED[m.id]);
  const implemented = known.filter((m) => OBEYED[m.id].capability);
  return {
    instructions_version: INSTRUCTIONS_VERSION,
    source: 'services/asdair/handoff/instructions.js BROWSER_METHOD',
    delivered: list.length,
    implemented_here: implemented.length,
    implemented_ids: implemented.map((m) => m.id).sort(),
    delivered_but_not_implemented_here: known
      .filter((m) => !OBEYED[m.id].capability)
      .map((m) => m.id).sort(),
    delivered_but_unrecognised: list
      .filter((m) => !OBEYED[m.id])
      .map((m) => m.id).sort(),
  };
}

/**
 * The household rulebook rows this executor is obeying, as a fact rather than a
 * hope.
 *
 * Rules 33, 34 and 40 are the ones the 2026-08-17 run demonstrably ignored, and
 * they are DATA - `asdair.rules` rows, fixtured at
 * `services/asdair/pipeline/testdata/household-rules.json`. The executor cannot
 * "implement rule 33" in code without hard-coding a household decision, which
 * is exactly the mini-language this estate has already paid for once. What it
 * can do, and what this does, is carry the ACTIVE rows through to the judgement
 * prompt and record which ones travelled.
 *
 * `directive: 'info'` rows are included deliberately. The old planner dropped
 * every info row - "the dead 59%" - which is how rule 34's mandatory
 * reconciliation and rule 40's bulk pass were active for weeks and never fired.
 */
function rulesForRun(rules) {
  const rows = Array.isArray(rules) ? rules : ((rules && rules.rows) || []);
  const active = rows.filter((r) => r && r.active !== false);
  return {
    count: active.length,
    ids: active.map((r) => String(r.id)).sort((a, b) => Number(a) - Number(b)),
    rows: active,
  };
}

module.exports = { methodPolicy, methodReport, rulesForRun, OBEYED, ALL_FLAGS, BROWSER_METHOD };
