// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/runPipeline.js
//
// THE RESUMABLE ADVANCER. Given a shop, work out from DURABLE STATE what the
// next legal step is, take EXACTLY ONE, and return.
//
// ── THE RESUMABILITY CONTRACT ───────────────────────────────────────────────
// This function never assumes the previous step ran in this process, this hour
// or this week. It reads a snapshot from Postgres, asks the pure stage table
// what comes next, does that one thing, and stops. Kill the runner at any point
// - between the catalogue load and the model call, between the model call and
// the list write, between the list write and the transition - restart it, and
// it re-derives the next step from what is durably true. There is no in-memory
// progress to lose, because there is no in-memory progress.
//
// ── HOW WORK IS CLAIMED, AND WHY THAT IS ENOUGH ─────────────────────────────
// Every acting step ends in a GUARDED transition: shopStore's applyTransition
// carries `AND status = <the status the step was chosen from>`. Two runners
// racing the same shop therefore cannot both advance it - the loser matches
// zero rows, its transaction ROLLBACKs, and this module reports `claimed:false`
// rather than double-advancing. The database is the mutual exclusion; there is
// no advisory lock, no lease and no lock file to go stale after a crash.
//
// The work a step does BEFORE that transition is idempotent by construction, so
// a lost race costs a repeated no-op and never a duplicate row:
//   * list items      upsert on (list_id, lower(item_name))   [asdairCommands]
//   * questions       ON CONFLICT (shop_id, question_key)     [shopStore]
//   * browser build   one live request per shop               [migration 006]
//   * confirmation    natural key (shop_id, content_fingerprint) [recordConfirmation]
//   * commands        unique while pending                    [migration 006]
// The one genuinely non-idempotent cost of a lost race is a repeated MODEL CALL
// on the interpret step. That is money, not correctness, and it is stated here
// rather than hidden: in the real deployment exactly one runtime loop advances
// shops.
//
// ── THE CATALOGUE INVARIANT ─────────────────────────────────────────────────
// The household catalogue is loaded BEFORE any interpretation, always. It is
// not an optimisation and not a fallback: the model READS and RANKS, the
// CATALOGUE DETERMINES IDENTITY (resolveByCatalogue.js), the human resolves
// genuine ambiguity, and confirmed outcomes enrich aliases. `interpret()` below
// takes the catalogue as its first argument and REFUSES to run without a
// non-empty one, so open-ended transcription cannot become the primary path by
// accident. Asserted by invariants.test.js on the call ORDER, not on the prose.
//
// ── WHAT THIS MODULE CANNOT DO ──────────────────────────────────────────────
// Book a slot, check out, pay, enter a password, auto-substitute, or set
// checked_out. There is no step for any of them. The browser build is CLAIMED
// BY A SUPERVISED HUMAN; this module only records that it was asked for and
// reports what the runner said it did.
// =====================================================================

import { COMMANDS, COMMAND_SPECS, CONSUMPTION } from './commandNames.js';
import { STEPS, decideNextStep, planOutcome, everIssued, pendingCommands } from './stages.js';
import {
  questionKeyFor, intentKeyFor, sourceIdFor, outboxKeyFor, normaliseTerm,
  ledgerFamilyKey, LEDGER_KINDS,
} from './keys.js';
import * as store from './store.js';
import * as shopLines from './shopLines.js';
import * as shopDecisions from './shopDecisions.js';
import * as rememberedChoice from './rememberedChoice.js';
import { applyDecisionsToPlan } from './applyDecisions.js';

// ── THE BROWSER HANDOFF, ON THE LIVE ROUTE ─────────────────────────────────
//
// Warwick, 2026-08-09: "THE PROVEN BROWSER OPERATING CONTRACT EXISTS, BUT THE
// PRODUCTION ROUTE DOES NOT ENFORCE IT."
//
// Before these three imports, `buildExecutionPacket`, `buildHandoff` and the
// durable `openHandoff` lifecycle had ZERO production callers. All complete.
// All tested. Reachable only from their own unit tests - which is this build's
// recurring defect, the same shape Veritas D-1 found on `interpretAnswer` and
// the same shape `shopLines.markCorrected` still has.
//
// Imported directly rather than injected through `deps`, exactly like `store`
// and `applyDecisionsToPlan` above: they are pure, or pure over an injected
// query. A `deps.X` that nothing binds is undefined at runtime while every
// stubbed test passes; a static import cannot fail that way.
import { buildExecutionPacket } from '../packet/buildExecutionPacket.js';
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const { buildHandoff } = requireCjs('../handoff/buildHandoff.js');
const { openHandoff } = requireCjs('../handoff/claim.js');

// ── THE HOUSEHOLD'S PROSE RULEBOOK, ON THE LIVE ROUTE (WP-B15-3) ───────────
//
// Same defect, third time: `skill/rulebook.js` was complete, tested to 29/29
// with mutation proofs in both directions, and reachable ONLY from its own two
// test files. Veritas found it at Gate 1. This import and the one call site
// below are what make it production code.
//
// Imported directly rather than injected, exactly like `applyDecisionsToPlan`
// above: the module is pure apart from the `consult` callable it is GIVEN, and
// that callable IS injected (deps.consult). Injecting the pure half as well
// would buy nothing and cost the D-1 failure mode.
const { applyRulebook } = requireCjs('../skill/rulebook.js');

/**
 * THE ONE PLACE A PLAN IS BUILT (WP-B15-2).
 *
 * There is no plan table. `planBasket` is pure and is recomputed from durable
 * inputs at EVERY site that needs a plan, which is exactly why applying the
 * human's decisions at one of those sites and not the others would be a
 * silently half-working fix: the shop would look decided while it was planned,
 * and undecided when it was reconciled.
 *
 * So no step calls `deps.planBasket` directly any more. Every production
 * recomputation on the shopping journey goes through here, which means
 * "decisions are applied" is a property of the FUNCTION, not a discipline each
 * call site has to remember. `runPipeline.test.js` asserts on this module's
 * source that no other `deps.planBasket(` call site exists.
 *
 * ── AND IT IS ALSO THE ONE PLACE THE PROSE RULEBOOK RUNS (WP-B15-3) ─────────
 *
 * For exactly the same reason. There is no plan table, so "the household's
 * judgement rules were applied" is a claim about EVERY recomputation, and the
 * only way to make it true everywhere is to make it a property of this
 * function. Wiring it beside the planner call at each site would re-create the
 * half-working shape this function exists to end - and would need a second
 * `deps.planBasket(` call site, which decisionSpine.test.js forbids outright.
 *
 * ── THE ORDER OF THE THREE STAGES IS THE PRECEDENCE, AND IT IS DELIBERATE ───
 *
 *   1. planBasket           - what the deterministic rules alone decide
 *   2. applyRulebook        - what the household's PROSE rules judge
 *   3. applyDecisionsToPlan - what WARWICK actually said, this week
 *
 * The human is last, so a recorded decision always overrules a model
 * judgement about the same line. Nothing a reasoning consumer says can
 * displace an answer Warwick gave.
 *
 * @returns {{plan:object, applied:Array, unresolved:Array, unlinkable:Array,
 *           decisions:Array}}
 */
async function planWithDecisions(deps, shop, { listItems, inputs, catalogue }) {
  const planned = deps.planBasket({
    listItems,
    rules: inputs.rules,
    products: inputs.products,
    regulars: inputs.regulars,
    budget: inputs.budget,
    lastOrder: inputs.lastOrder,
    // THE ANSWERS WARWICK HAS ALREADY GIVEN, as cross-week rule evidence. This
    // is the FORWARD-LEARNING channel (asdair.rule_qa_log) and it is NOT how a
    // current-shop decision travels - see applyDecisions.js. Lane B owns it.
    priorAnswers: inputs.priorAnswers,
    household: shop.household_id,
  });

  // ── THE JUDGEMENT LAYER (WP-B15-3) ────────────────────────────────────────
  // The SAME rules array the planner was given, so the two halves cannot
  // disagree about what the household's rulebook says. `applyRulebook` returns
  // a NEW plan and never mutates its input.
  //
  // `deps.consult` is passed straight through, UNGUARDED, on purpose. Where no
  // inert rule speaks about this basket the module never calls it and never
  // asks for it, so a household with no judgement layer spends nothing. Where a
  // rule DOES speak and nothing is bound, it throws - loudly, at the moment the
  // rules were about to be applied - rather than skipping the judgement layer
  // and leaving the shop looking planned. That is the same choice
  // `realLoadPlanningInputs` makes about priorAnswers, for the same reason: a
  // silent skip here is indistinguishable from the defect this lane closes.
  //
  // A `consult` that THROWS is already caught inside the module: no line
  // changes, every affected line carries `rulebook not consulted`, and the
  // audit records why. There is deliberately no second catch here.
  const { plan: judged } = await applyRulebook({
    plan: planned,
    rules: inputs.rules,
    household: shop.household_id,
    consult: deps.consult,
  });

  const decisions = await shopDecisions.listDecisions(deps, shop.id);
  const regularsById = catalogue && catalogue.regularsById instanceof Map
    ? catalogue.regularsById
    : new Map(((catalogue && catalogue.regulars) || []).map((r) => [Number(r.id), r]));

  const result = applyDecisionsToPlan({ plan: judged, decisions, questionKeyFor, regularsById });

  // ── AND THE CHOICE HE MADE LAST TIME (WP-B15-3-M1) ────────────────────────
  // LAST, and only over what is STILL unresolved after all three stages above.
  //
  // The order is the precedence and it is deliberate: a standing preference is
  // the WEAKEST of the four inputs. It cannot reach a line a hard exclusion
  // removed, a line a rule already resolved, or a line Warwick has decided
  // this week - those are no longer unresolved by the time this runs. It can
  // only collapse an already-grounded, already-permitted ambiguity down to one
  // of its own members.
  //
  // It lives HERE, inside planWithDecisions, for exactly the reason the
  // rulebook and the decisions do: there is no plan table, so "the household's
  // last choice was applied" is a claim about EVERY recomputation, and the only
  // way to make it true everywhere is to make it a property of this function.
  // Wiring it into stepPlan alone would resolve the list for the questions and
  // leave the BROWSER PACKET planning as though nothing had been remembered -
  // and Warwick's requirement is that the list resolve BEFORE browser
  // execution.
  const memory = await resolveRememberedChoices(deps, shop, {
    plan: result.plan, unresolved: result.unresolved, regularsById,
  });

  return {
    ...result,
    plan: memory.plan,
    unresolved: memory.unresolved,
    remembered: memory.remembered,
    remembered_refused: memory.refused,
    decisions,
  };
}

/**
 * THE READ HALF OF "REMEMBER THE CHOICE I MADE LAST TIME".
 *
 * Warwick, 2026-08-09: "use that last choice so the list can resolve BEFORE
 * browser execution rather than asking me the same choice again... If the
 * remembered product is unavailable or no longer a valid grounded candidate,
 * behave honestly rather than fabricating a match."
 *
 * ── THIS WEEK'S CANDIDATE SET IS RECOMPUTED, NEVER READ OFF THE MEMORY ──────
 * The stored `candidate_regular_ids` is EVIDENCE of what was on the table when
 * he chose - it is what lets AsdAIr say "last time it was between A, B and C".
 * It is NOT the set a memory is validated against. That set is derived here,
 * fresh, by the SAME `planCandidates` that builds a question card, from the
 * SAME durable interpretation rows - so "a grounded candidate" means one thing
 * whether a line is being asked about or remembered about.
 *
 * ── COSTS NOTHING WHEN THERE IS NOTHING TO REMEMBER ────────────────────────
 * A plan with no unresolved lines issues no statement at all: no shop_line
 * read, no memory read. The common case - a fully resolved list - is
 * byte-for-byte the traffic it was before this existed.
 *
 * ── AN UNREADABLE MEMORY DEGRADES VISIBLY; IT NEVER FAILS A SHOP ───────────
 * MIGRATION 018 IS AUTHORED, NOT APPLIED. Until Larry applies it under
 * Warwick's authority `asdair.remembered_choice` DOES NOT EXIST, and this read
 * raises an undefined-table error on every pass. Letting that propagate would
 * fail every shop in the estate between this merging and that migration
 * landing - a shop that is otherwise entirely correct, because a household
 * with no memory simply ASKS, which is what it did last week.
 *
 * So the READ is caught, and that is `applyRulebook`'s established precedent
 * rather than a new one: where the enrichment cannot be consulted NO LINE
 * CHANGES, every affected line stays held for a human, and the reason is
 * RECORDED. It is the judgement `realRecordLearning` makes and the opposite of
 * the one `recordAnswerLearning` makes - for the stated reason that an answer
 * surviving the week IS that path's outcome, whereas a preference is next
 * week's convenience and this week's shop is complete without it.
 *
 * ⚠️ CAUGHT IS NOT SWALLOWED. The failure travels in `refused`, reaches the
 * step's own return, and goes through deps.log. A silence here would look
 * identical to "this household has no preferences yet", which is exactly the
 * D-1 shape this build has already paid for three times.
 *
 * ONLY THE I/O IS INSIDE THE `try`. `applyRememberedToPlan` is pure and is
 * deliberately outside it: a defect in the RESOLUTION RULE must be loud,
 * immediately and everywhere, and must never be absorbed as "the memory could
 * not be read".
 */
async function resolveRememberedChoices(deps, shop, { plan, unresolved, regularsById }) {
  const empty = { plan, unresolved, remembered: [], refused: [] };
  const held = (Array.isArray(unresolved) ? unresolved : [])
    .filter((u) => u && u.needs_clarification_round !== true);
  if (held.length === 0) return empty;

  const candidateIdsByTerm = new Map();
  const terms = [];
  let memoriesByTerm = null;

  try {
    // The interpretation is the ONLY source of trustworthy regulars ids on a
    // candidate - see planCandidates. Read once, for the whole plan.
    const interpreted = await shopLines.listLines(deps, shop.id);
    const byReading = new Map(interpreted.map((l) => [normaliseTerm(l.raw_reading), l]));
    const lineByKey = new Map();
    for (const it of (Array.isArray(plan.items) ? plan.items : [])) {
      if (!it || !it.item_name) continue;
      try { lineByKey.set(questionKeyFor(it.item_name), it); } catch { /* unreadable line - no key */ }
    }

    for (const entry of held) {
      const term = normaliseTerm(entry.item_name);
      if (term === '') continue;
      const line = lineByKey.get(entry.question_key) || { item_name: entry.item_name, alternatives: [] };
      const ids = planCandidates(line, byReading.get(term) || null)
        .map((c) => c.regular_id)
        .filter((v) => v !== null && v !== undefined)
        .map(Number);
      candidateIdsByTerm.set(term, ids);
      if (!terms.includes(term)) terms.push(term);
    }
    if (terms.length === 0) return empty;

    memoriesByTerm = await rememberedChoice.loadRememberedChoices(deps, shop.household_id, terms);
  } catch (err) {
    const detail = String(err && err.message ? err.message : err);
    if (typeof deps.log === 'function') {
      deps.log('remembered_choice_read_failed', { shop_ref: shop.shop_ref, detail });
    }
    return {
      ...empty,
      // NAMED, ONE LINE PER LINE THAT COULD HAVE BEEN RESOLVED. A degradation
      // nobody can see is a degradation nobody fixes.
      refused: held.map((u) => ({
        item_name: u.item_name,
        question_key: u.question_key,
        reason: `the household's remembered choices could not be read: ${detail}`,
      })),
    };
  }

  if (memoriesByTerm.size === 0) return empty;

  return rememberedChoice.applyRememberedToPlan({
    plan,
    unresolved,
    memoriesByTerm,
    candidateIdsByTerm,
    activeRegularIds: regularsById,
    normaliseTerm,
  });
}

/**
 * THE WRITE HALF. One settled decision of the authorised kind becomes the
 * household's most recent preference for that ambiguity.
 *
 * ── WHY A FAILURE HERE IS REPORTED AND NOT THROWN ──────────────────────────
 * Warwick's own boundary: "Keep normal immutable current-shop decisions and
 * provenance intact." The decision row is ALREADY WRITTEN by the time this
 * runs, and this week's shop is completely correct without a memory - the
 * memory is next week's convenience. Failing the shop over it would let a
 * forward-learning write destroy a current-shop outcome, which is the exact
 * separation migration 017 exists to preserve.
 *
 * It is `realRecordLearning`'s reasoning, not `recordAnswerLearning`'s: the
 * latter throws because the answer surviving the week IS its outcome. This is
 * the former case.
 *
 * ⚠️ AND IT IS REPORTED, NEVER SWALLOWED. The failure travels back in the
 * step's own return AND through deps.log. A silence here would look identical
 * to "there was nothing to remember", which is the shape of defect this whole
 * Work Package exists to end.
 *
 * NOTE FOR THE FIRST LIVE RUN: migration 018 is AUTHORED, NOT APPLIED. Until
 * Larry applies it under Warwick's authority, this write fails with an
 * undefined-table error on every shop - reported on every pass, failing
 * nothing, and self-healing the moment 018 lands because the same decision is
 * re-offered on the next pass.
 */
async function rememberIfAuthorised(deps, shop, question, decision) {
  let verdict;
  try {
    verdict = rememberedChoice.decideToRemember({ shop, question, decision, normaliseTerm });
  } catch (err) {
    return { remembered: false, reason: String(err && err.message ? err.message : err) };
  }
  if (!verdict.remember) return { remembered: false, reason: verdict.reason };

  try {
    const res = await rememberedChoice.rememberChoice(deps, verdict.spec);
    return {
      remembered: true,
      created: res.created,
      remembered_choice_id: res.choice ? res.choice.id ?? null : null,
      choice_term: verdict.spec.choice_term,
    };
  } catch (err) {
    const detail = String(err && err.message ? err.message : err);
    if (typeof deps.log === 'function') {
      deps.log('remembered_choice_write_failed', {
        shop_ref: shop.shop_ref,
        question_key: question ? question.question_key : null,
        detail,
      });
    }
    return { remembered: false, failed: true, reason: detail };
  }
}

/** The list_date a shop belongs to, taken from its ref. NO CLOCK: a retry that
 *  crossed midnight must not put this week's items on next week's list. */
export function listDateOf(shopRef) {
  const m = /^SHOP-(\d{4}-\d{2}-\d{2})$/.exec(String(shopRef || ''));
  if (!m) throw new Error(`runPipeline: shop_ref "${shopRef}" is not SHOP-YYYY-MM-DD, so its list date cannot be derived`);
  return m[1];
}

/** Recognise the guarded-transition loss so it is reported as a lost race
 *  rather than recorded as a failure of the shop. */
function isLostRace(err) {
  const m = err && err.message ? String(err.message) : '';
  return m.includes('was modified concurrently') || m.includes('answered concurrently');
}

function outcome(step, extra = {}) {
  return { ok: true, stepped: false, step, claimed: true, from: null, to: null, ...extra };
}

// =====================================================================
// THE INVARIANT GUARD
// =====================================================================
/**
 * Refuse to interpret anything without a real household catalogue.
 *
 * This is the measured correction of 2026-07-28 encoded as a precondition. The
 * same photograph, the same model and the same gateway produced "gourmet
 * coffee" ungrounded and "3 gourmet cat food" grounded; an empty catalogue
 * silently reverts the system to the ungrounded behaviour while still LOOKING
 * like it worked. So it throws instead.
 */
export function assertCatalogueLoaded(catalogue, where) {
  if (!catalogue || typeof catalogue !== 'object') {
    throw new Error(`runPipeline: ${where} requires the household catalogue, which was not loaded. `
      + 'Never interpret a shopping list without first loading the household catalogue.');
  }
  const candidates = Array.isArray(catalogue.candidates) ? catalogue.candidates : [];
  if (candidates.length === 0) {
    throw new Error(`runPipeline: ${where} was handed an EMPTY catalogue for household `
      + `${catalogue.household_id}. Interpreting against nothing is open-ended transcription, which is the `
      + 'measured-wrong method. Load the household regulars first.');
  }
  return catalogue;
}

/** The full regular rows the resolver needs (loadCatalogue keeps them in a Map
 *  separately from the compact prompt candidates, so ids/urls never reach the model). */
function regularsOf(catalogue) {
  if (catalogue.regularsById instanceof Map) return [...catalogue.regularsById.values()];
  if (Array.isArray(catalogue.regulars)) return catalogue.regulars;
  return catalogue.candidates || [];
}

// =====================================================================
// THE STEPS
// =====================================================================

/**
 * PURE. Turn a shop's raw evidence into READINGS - one per line on the page.
 *
 * A reading is what was WRITTEN, not what it means. Identity comes later, and
 * only from the catalogue. Both source kinds converge on this shape so the rest
 * of the step has ONE path, and so a typed list is grounded against the
 * household catalogue exactly as a photographed one is.
 */
function readingsFromRoute(routed) {
  return routed.intents.map((it, i) => ({
    line_no: i + 1,
    raw_reading: it.args.item_name,
    quantity: it.args.requested_qty,
    // shopperRoute already decided this line could not be read cleanly. That
    // verdict survives whatever the catalogue then thinks of it.
    forced_review: it.args.status === 'needs_decision',
  }));
}

/**
 * INTERPRET. Catalogue first. Then read. Then identity from OUR rows. Then
 * persist the interpretation, and only then the list.
 *
 * The two source kinds differ ONLY in how the readings are obtained:
 *   text  - the committed hub route (shopperRoute.mjs) splits the pasted list.
 *           Deterministic; no model involved.
 *   photo - ONE grounded vision request (never a daemon, never a conversation),
 *           returning a raw_reading per line.
 *
 * From there both paths are identical, and that is deliberate: the catalogue
 * DETERMINES IDENTITY on both, so a typed "arla 4pt" and a photographed one
 * resolve to the same regulars.id by the same code.
 */
async function stepInterpret(deps, snapshot) {
  const shop = snapshot.shop;
  const listDate = listDateOf(shop.shop_ref);
  const sourceId = sourceIdFor(shop);

  // ── THE INVARIANT: the catalogue is loaded BEFORE anything is interpreted ──
  const catalogue = assertCatalogueLoaded(
    await deps.loadCatalogue(shop.household_id),
    'interpretation',
  );

  let readings;
  // The SIZE of the prompt, never the prompt. See recordGroundingEvidence below.
  let promptChars = null;
  if (shop.source_kind === 'photo') {
    if (!shop.raw_media_path) {
      throw new Error(`runPipeline: shop ${shop.shop_ref} is a photo shop with no raw_media_path - the raw evidence is missing`);
    }
    const prompt = deps.buildGroundedPrompt(catalogue);
    promptChars = String(prompt).length;
    // ONE SHOT. Not a loop, not a daemon, not a conversation.
    const modelLines = await deps.interpretPhoto({
      catalogue, prompt, imagePath: shop.raw_media_path, householdId: shop.household_id,
    });
    if (!Array.isArray(modelLines)) {
      throw new Error('runPipeline: the grounded interpreter must return an array of { raw_reading, quantity } lines');
    }
    readings = modelLines.map((l, i) => ({
      line_no: l.line_no ?? i + 1,
      raw_reading: l.raw_reading,
      quantity: l.quantity ?? null,
      forced_review: false,
    }));
  } else {
    if (!shop.raw_text) {
      throw new Error(`runPipeline: shop ${shop.shop_ref} is a text shop with no raw_text - the raw evidence is missing`);
    }
    readings = readingsFromRoute(await deps.shopperRoute(
      { kind: 'text', text: shop.raw_text },
      { sourceId, listDate, requestedBy: 'asdair:pipeline' },
    ));
  }

  // ── IDENTITY IS THE CATALOGUE'S, NOT THE MODEL'S ──────────────────────────
  // resolveByCatalogue maps a reading onto a real asdair.regulars.id, or says
  // it cannot. Every `id` below therefore comes from ONE source - our own
  // regulars - and nothing here reads an id off any other table.
  const resolved = deps.resolveAll(readings, regularsOf(catalogue)).map((l, i) => ({
    ...l,
    line_no: readings[i].line_no,
    // A line shopperRoute could not read cleanly stays unresolved even if the
    // catalogue would happily match it - the earlier doubt is not erased.
    ...(readings[i].forced_review && l.status === 'matched'
      ? { status: 'needs_confirmation', matched_regular_id: null, matched_product_name: null }
      : {}),
  }));

  // ── THE GROUNDING RECORD (D-2026-08-03-04) ────────────────────────────────
  // Written HERE rather than inside deps.interpretPhoto, and that placement is
  // the point. A caller inside the dependency could never be exercised: every
  // offline test replaces `deps.interpretPhoto` wholesale, so a record written
  // in there would be unreachable by any proof and decorative by construction -
  // which is the exact defect this record exists to detect.
  //
  // It is written from what the call RETURNED, after it returned. `readings`
  // only has a length if something answered; a --dry-run that skipped the model
  // entirely - the 2026-08-03 failure - cannot produce this row, and that is the
  // whole reason it is a count rather than a flag.
  //
  // SANITIZED: COUNTS AND IDS ONLY. Never a product name, never a raw reading,
  // never the prompt text, never the photograph. The prompt is measured in
  // characters. What is stored is the SHAPE of the grounding, which is what
  // makes the claim checkable, and none of the household's data, which is what
  // keeps an audit record from becoming a second copy of the shopping list.
  //
  // Recorded for BOTH source kinds: `source_kind` distinguishes them, and a
  // typed list is grounded against the same catalogue by the same code, so
  // recording only the photo path would leave half the interpretations
  // unevidenced. One shot ever per shop, on the ledger's total unique index - a
  // re-run after a crash finds the row already there and writes nothing.
  await store.recordGroundingEvidence(deps, {
    shopId: shop.id,
    householdId: shop.household_id,
    sourceKind: shop.source_kind,
    catalogueCandidates: catalogue.candidates.length,
    promptChars,
    readingsReturned: readings.length,
    lineNos: resolved.map((l) => l.line_no),
    matchedRegularIds: resolved
      .map((l) => l.matched_regular_id)
      .filter((v) => v !== null && v !== undefined),
  });

  // ── PERSIST THE INTERPRETATION (migration 008) ────────────────────────────
  // Before the list rows, so a crash between the two leaves the interpretation
  // recorded rather than lost. UNIQUE (shop_id, line_no) means a re-read
  // UPDATES line 7 and never appends a second copy of the list.
  const lineWrites = await shopLines.upsertLines(deps, shop.id, resolved.map((l) => ({
    line_no: l.line_no,
    raw_reading: l.raw_reading,
    quantity: l.quantity,
    matched_regular_id: l.matched_regular_id,
    match_basis: l.match_basis,
    alternatives: (l.alternatives || []).map((a) => ({ regular_id: a.id, name: a.name })),
    status: l.status,
  })));

  // What is durably stored wins over what we just computed: a line a human had
  // already confirmed refuses the re-read, and the list must follow the stored
  // truth rather than the fresh guess.
  const stored = shopLines.withCanonicalNames(lineWrites.map((w) => w.line), catalogue);
  const intents = buildGroundedIntents(stored, { sourceId, listDate, requestedBy: 'asdair:pipeline' });
  deps.assertAllowedIntents(intents);

  // Materialise the real list rows. add_list_item upserts on (list_id,
  // lower(item_name)), so re-running this step after a crash updates rather
  // than duplicates - which is why the interpret step is safe to repeat.
  const written = await deps.executeIntents(intents, { householdId: shop.household_id, listDate });

  // Bind each interpreted line to the list item it became. THE REPLAY GUARD:
  // a line carrying a list_item_id has already been materialised.
  for (let i = 0; i < stored.length; i += 1) {
    const itemId = written.results[i] && written.results[i].item_id;
    if (itemId) await shopLines.linkListItem(deps, shop.id, stored[i].line_no, itemId);
  }

  // The list_id rides the transition, in one transaction with its audit event.
  await store.advanceWithList(deps, {
    shopId: shop.id,
    fromStatus: shop.status,
    toStatus: 'PROCESSING',
    listId: written.listId,
    description: `interpreted ${intents.length} line(s) against a catalogue of ${catalogue.candidates.length} known products`,
  });

  return {
    stepped: true, from: shop.status, to: 'PROCESSING',
    lines: intents.length,
    catalogue_candidates: catalogue.candidates.length,
    list_id: written.listId,
    // The gate reads the DURABLE flag on the shop; this is the fresh evidence
    // for the same fact, reported so a caller can see why.
    unresolved: stored.filter((l) => l.status !== 'matched').length,
    lines_confirmed_and_kept: lineWrites.filter((w) => w.skipped).length,
    interpreted: stored,
  };
}

/**
 * PURE. Turn catalogue-resolved lines into shopperRoute-shaped intents.
 *
 * ── COMPONENT GAP, STATED OUT LOUD ─────────────────────────────────────────
 * services/hub/shopper/shopperRoute.mjs only accepts a RAW payload; it has no
 * entry point that takes already-catalogue-resolved lines, and feeding the
 * grounded names back through its text normaliser would throw away exactly the
 * identity the catalogue just established. So the grounded path builds the same
 * shape here - the same `add_list_item` command, the same `shop:<sourceId>-<n>`
 * idempotency key - and every intent is validated against shopperRoute's own
 * exported ALLOWED_SHOPPER_COMMANDS before it can be executed.
 *
 * item_name comes from `canonical_name`, which shopLines.withCanonicalNames
 * looked up FROM asdair.regulars BY ID. It is never a name the model wrote.
 * When the line did not resolve, the raw reading is used and the item is stored
 * `needs_decision` - never dropped, never guessed at.
 */
export function buildGroundedIntents(lines, { sourceId, listDate, requestedBy }) {
  return lines.map((l, i) => {
    const matched = l.matched_regular_id !== null && l.matched_regular_id !== undefined;
    const readable = String(l.raw_reading || '').trim();
    // A line with NEITHER a catalogue match NOR anything readable is not
    // dropped and not guessed at. resolveByCatalogue already says the vision
    // model genuinely could not read it (status "unreadable", carried into the
    // `needs review: ...` note below) - so, exactly like any other unresolved
    // line, it becomes a needs_decision intent rather than a thrown exception.
    // The item_name is HONEST rather than invented: it names the line so a
    // human can act on it as a real question, and it is never a
    // plausible-sounding product name for text nobody could read. "Never
    // dropped, never guessed at" (the doc comment above) holds for this case
    // exactly as it already does for the readable-but-unmatched one below.
    const name = matched ? l.canonical_name
      : (readable || `Line ${i + 1}: illegible - please tell me what this is`);
    const notes = [];
    if (l.match_basis) notes.push(`matched by ${l.match_basis}`);
    if (!matched) notes.push(`needs review: ${l.status}`);
    if (Array.isArray(l.alternatives) && l.alternatives.length > 0) {
      // `regular_id` is named, not `id`: these came from resolveByCatalogue and
      // are asdair.regulars ids. Nothing here reads an id off any other table.
      notes.push(`alternatives: ${l.alternatives.map((a) => a.name).filter(Boolean).join(', ')}`);
    }
    return {
      command: 'add_list_item',
      args: {
        context: 'shopping',
        list_date: listDate,
        item_name: name,
        requested_qty: Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : null,
        note: notes.length ? notes.join('; ') : null,
        status: matched ? 'requested' : 'needs_decision',
      },
      idempotency_key: intentKeyFor(sourceId, i),
      requested_by: requestedBy,
    };
  });
}

/**
 * PLAN. Run the deterministic planner over the durable list, then ASK about
 * everything it could not resolve.
 *
 * A question is opened per unresolved line under a key derived from the
 * NORMALISED line text, so re-planning the same list next run recognises the
 * same question and does not re-ask it. An already-answered question comes back
 * `already_answered` and writes nothing - that is the whole mechanism behind
 * "a question answered once is never re-asked".
 */
async function stepPlan(deps, snapshot) {
  const shop = snapshot.shop;
  if (shop.list_id === null || shop.list_id === undefined) {
    throw new Error(`runPipeline: shop ${shop.shop_ref} is PROCESSING with no list_id - nothing to plan`);
  }

  // The catalogue is a planning INPUT too, not merely an interpretation one.
  const catalogue = assertCatalogueLoaded(await deps.loadCatalogue(shop.household_id), 'planning');
  const listItems = await store.listListItems(deps, shop.list_id);
  const inputs = await deps.loadPlanningInputs(shop.household_id);

  // THE PLAN, WITH WARWICK'S CURRENT-SHOP DECISIONS ALREADY APPLIED. Not the
  // raw planner output: a line he has decided is no longer a line that needs
  // him, and `unresolved` is the set that genuinely still does.
  // `remembered` is the set of lines that resolved from the choice Warwick made
  // last time, WITHOUT a question being raised. `remembered_refused` is the
  // honest other half: a memory existed and was NOT used, with the reason -
  // reported so a refusal never looks like a memory that simply never existed.
  const {
    plan, applied, unresolved, remembered, remembered_refused: rememberedRefused,
  } = await planWithDecisions(deps, shop, { listItems, inputs, catalogue });

  // The interpretation is the ONLY source of regulars ids on a candidate. See
  // planCandidates below for why that matters.
  const interpreted = await shopLines.listLines(deps, shop.id);
  const byReading = new Map(interpreted.map((l) => [normaliseTerm(l.raw_reading), l]));

  // ── THE DURABLE item_name CARRIER ─────────────────────────────────────────
  // asdair.shop_question has no column for the item a question is ABOUT, and
  // question_text is a whole sentence. The name travels by id instead:
  // shop_question.list_item_id -> shopping_list_items.item_name, which is what
  // store.listQuestions() LEFT JOINs and what a card renders as its `Item:`.
  //
  // The id is recovered from `listItems` - the rows as READ - and never from
  // plan.items, because dedupeList() builds a fresh object per merged line and
  // does not carry the shopping_list_items id onto it. Taking it from the plan
  // would silently bind every question to null.
  //
  // Keyed by normaliseTerm, the same normalisation dedupeList used to merge the
  // lines in the first place, so "the same line" means one thing on both sides.
  const listItemIdByTerm = new Map();
  for (const item of listItems) {
    const term = normaliseTerm(item.item_name);
    if (term !== '' && !listItemIdByTerm.has(term)) listItemIdByTerm.set(term, item.id);
  }

  // ── ASK ABOUT EVERY LINE THAT STILL NEEDS A HUMAN ─────────────────────────
  // `unresolved` - not `status === 'needs_decision'` - is the set to ask about.
  // A line Warwick has decided is no longer held even though the PLANNER still
  // classified it that way, because the planner does not know what he said.
  //
  // Two populations, and they need different questions:
  //
  //   * NO DECISION YET      -> the original round-1 question, unchanged. Its
  //                             key is byte-for-byte the historic derivation,
  //                             so ON CONFLICT still recognises a question
  //                             asked in a previous pass and does not re-ask.
  //   * CLARIFICATION NEEDED -> a genuinely NEW question row for round N+1.
  //                             The round-1 row cannot be reused: recordAnswer
  //                             is a compare-and-set on status='open', so
  //                             round 2 could only be recorded by forcing the
  //                             status back - and round 1's answer_text, which
  //                             is Warwick's exact words, would be overwritten
  //                             by it. One row per round is forced by the
  //                             schema, not chosen.
  //
  // THIS IS ALSO WHAT PREVENTS THE LIVELOCK. Opening the next round here means
  // countOpenQuestions is non-zero by the time planOutcome runs, so the gate
  // takes its ordinary NEEDS_DECISION branch and the shop waits on a real
  // question with a real card - instead of bouncing PROCESSING <-> NEEDS_DECISION
  // forever against a question that can never re-open.
  const lineByKey = new Map();
  for (const it of plan.items) {
    if (!it || !it.item_name) continue;
    try { lineByKey.set(questionKeyFor(it.item_name), it); } catch { /* unreadable line - no key */ }
  }

  // ── A CLARIFICATION WAITS FOR THE READING TO BE CONFIRMED ────────────────
  // The interpretation gate is the EARLIER gate: a list AsdAIr had to guess at
  // is not acted on until a human agrees it says what we think it says. Asking
  // Warwick which variant of line 3 he meant, before he has confirmed we read
  // line 3 correctly at all, is asking the wrong question first - and because
  // planOutcome checks open questions BEFORE the interpretation gate, an open
  // clarification would also suppress the confirmation card entirely (the
  // WP-B15-1 behaviour that recovered shop 6).
  //
  // The decision row is still written either way, so nothing is stranded: the
  // clarification simply opens on the first pass after he confirms the reading.
  const readingConfirmed = shop.needs_review !== true
    || everIssued(snapshot, COMMANDS.CONFIRM_INTERPRETATION);

  const opened = [];
  for (const held of unresolved) {
    const line = lineByKey.get(held.question_key) || { item_name: held.item_name, alternatives: [] };
    const term = normaliseTerm(held.item_name);

    // The clarification round, when one is owed. `question_round` on the
    // decision's own question row is the round we are IN; the next is +1.
    const wantsClarification = held.needs_clarification_round === true;
    if (wantsClarification && !readingConfirmed) {
      // ── THE CARD WAITS. THE WORD DOES NOT. (WP-B15-A1) ────────────────────
      //
      // The deferral itself is unchanged and stays exactly as it was: asking
      // "which variant of line 3?" before Warwick has confirmed we read line 3
      // correctly is asking the wrong question first, and this gate recovered a
      // real shop. What was wrong was that the deferral was SILENT - he answered,
      // AsdAIr could not read the answer, and nothing on his phone said so.
      //
      // Warwick: "it should tell me if there is something it does not understand
      // or is not clear!" So the round-2 question still waits for the reading
      // confirmation, and he is told NOW, durably, through the ordinary outbox.
      //
      // ONCE PER HELD LINE, EVER - AND THE OUTBOX KEY ALONE NEVER GAVE THAT.
      // This comment used to claim idempotency by outbox key. It was false, and
      // Warwick received EIGHTEEN identical cards in seventeen minutes proving
      // it. recordLedgerEntry mints a NEW generation once the previous one is
      // TERMINAL - deliberately, because "ask for the basket again after a
      // pause" must be new work - so the key stopped a duplicate only while the
      // card sat unsent, and re-issued it the moment the card was delivered.
      // A spent generation of THIS family is therefore the honest question, and
      // it is asked PER FAMILY, exactly as runtime.handbackAlreadySpent asks it:
      // per-KIND (outboxEverQueued) would silence every held line but the first.
      try {
        const noticeFamily = ledgerFamilyKey({
          kind: LEDGER_KINDS.OUTBOX,
          householdId: shop.household_id,
          name: 'clarification_deferred',
          key: outboxKeyFor(shop.shop_ref, `clarification_deferred.${held.question_key}`),
        });
        // A PENDING row is deliberately not counted: re-enqueueing computes the
        // same family and recordLedgerEntry adopts it, so the database closes
        // that window without this code reading first and writing second.
        if ((await store.spentLedgerGenerations(deps, noticeFamily)) === 0) {
          await store.enqueueMessage(deps, {
            householdId: shop.household_id,
            shopId: shop.id,
            kind: 'clarification_deferred',
            key: outboxKeyFor(shop.shop_ref, `clarification_deferred.${held.question_key}`),
            payload: {
              shopRef: shop.shop_ref,
              items: [held.item_name].filter((i) => typeof i === 'string' && i !== ''),
              reason: held.clarification_reason || null,
            },
          });
        }
      } catch (err) {
        // Telling him matters; it does not matter more than the rest of the
        // pass. Logged, never thrown - one undeliverable notice must not stop
        // the other lines being planned.
        if (typeof deps.log === 'function') {
          deps.log('clarification_notice_failed', {
            shop_ref: shop.shop_ref,
            question_key: held.question_key,
            detail: String(err && err.message ? err.message : err),
          });
        }
      }
      continue;
    }

    const nextRound = wantsClarification
      ? Number(held.question_round || 1) + 1
      : 1;

    const key = nextRound === 1 ? held.question_key : questionKeyFor(held.item_name, nextRound);
    const questionText = nextRound === 1
      ? `Which product is "${held.item_name}"?`
      : `About "${held.item_name}" - ${held.clarification_reason || 'I could not tell which you meant'}. Which did you mean?`;

    const res = await deps.shopStore.openQuestion({
      shop_id: shop.id,
      question_key: key,
      // Null when the plan line answers to no stored list item. The joins are
      // LEFT for exactly this: a question with no carrier still reaches the
      // human with a degraded card, and is never dropped.
      list_item_id: listItemIdByTerm.get(term) ?? null,
      question_text: questionText,
      candidates: planCandidates(line, byReading.get(term) || null),
      // Absent on round 1, so that INSERT stays byte-for-byte what it was.
      ...(nextRound > 1
        ? { question_round: nextRound, parent_question_id: held.question_id }
        : {}),
    });
    opened.push({
      key, created: res.created, already_answered: res.already_answered, round: nextRound,
    });
  }

  const openNow = await store.countOpenQuestions(deps, shop.id);
  const gate = planOutcome({
    openQuestions: openNow,
    needsReview: shop.needs_review === true,
    interpretationConfirmed: everIssued(snapshot, COMMANDS.CONFIRM_INTERPRETATION),
    // THE LINE GATE. Zero open questions no longer means "every line is
    // resolved" - this is the count that makes that sentence earned.
    unresolvedLines: unresolved.length,
  });

  // ── THE LINE-RESOLUTION PARK MUST SPEAK (WP-B15-2, Veritas D-2) ──────────
  // A park that tells nobody is the defect this build keeps re-creating. The
  // gate above makes READY_TO_SHOP unreachable while a line is undecided -
  // which is correct - and shipping it WITHOUT this card would have re-created
  // shop 6's exact live shape: a shop stopped indefinitely, no event, no
  // message, nothing telling Warwick it was waiting on him. That is the
  // sibling of the very park WP-B15-1 was commissioned to fix, and root
  // CLAUDE.md is unambiguous: "failure must never be silent."
  //
  // Found by Veritas, not by me and not by the external reviewer.
  //
  // Same self-healing shape as the confirmation card below, deliberately
  // reused rather than reinvented: guarded by outboxEverQueued over the FULL
  // outbox history so it is queued AT MOST ONCE per shop ever, and a shop
  // ALREADY parked here before this code shipped gets its card on the very
  // next pass, because every pass over a parked PROCESSING shop re-runs this
  // step. No manual insert, no restart of durable state.
  //
  // Built from durable reads only, so it renders the same facts however many
  // passes later it is sent. The item names come from the unresolved set the
  // gate itself computed - the card cannot disagree with the reason the shop
  // is parked, because they are the same data.
  if (gate.step === STEPS.AWAIT_LINE_RESOLUTION
    && !(await store.outboxEverQueued(deps, shop.id, 'lines_unresolved'))) {
    await store.enqueueMessage(deps, {
      householdId: shop.household_id,
      shopId: shop.id,
      kind: 'lines_unresolved',
      key: outboxKeyFor(shop.shop_ref, 'lines_unresolved'),
      payload: {
        shopRef: shop.shop_ref,
        // What is actually stuck, by name, so the card is actionable rather
        // than an apology. Capped: a card is a message, not a report.
        items: unresolved.slice(0, 10).map((u) => u.item_name),
        unresolvedCount: unresolved.length,
        // Why each one is stuck, which is the difference between "I never got
        // an answer" and "I could not understand the answer you gave".
        awaitingClarification: unresolved.filter((u) => u.needs_clarification_round === true).length,
      },
    });
  }

  if (gate.to === null) {
    // Legally parked: the list needed review and nobody has confirmed it.
    //
    // ── THE CONFIRMATION CARD, SELF-HEALING (WP-B15-1 item 1) ───────────────
    // Until this card, the park above was SILENT: it wrote no event and queued
    // nothing, so a shop could sit here for days (shop 6's exact live shape:
    // PROCESSING, needs_review, every question answered, five days, not one
    // event) with nothing telling anyone it was being waited on. The card is
    // the missing production surface for the gate.
    //
    // Same self-healing shape as the receipt and progress cards in runPipeline
    // below, and for the same reasons: bookkeeping alongside a pass, never a
    // transition; guarded by outboxEverQueued over the FULL outbox history, so
    // it is queued AT MOST ONCE per shop, ever - and a shop ALREADY parked
    // here before this code shipped gets its card on the very next pass,
    // because every pass over a parked PROCESSING shop re-runs this step. No
    // manual insert, no restart of the durable state.
    //
    // The payload is built from DURABLE reads only (the stored fingerprint
    // binding, the stored prior photo shop, the stored interpreted lines), so
    // the card renders the same facts however many passes later it is sent.
    // A missing binding travels as null and is rendered as an honest absence -
    // nothing here fabricates a fingerprint or a count.
    if (!(await store.outboxEverQueued(deps, shop.id, 'confirm_interpretation'))) {
      const iso = (v) => {
        if (v === null || v === undefined) return null;
        if (v instanceof Date) return v.toISOString();
        return String(v);
      };
      const source = await store.findSourceImage(deps, shop.id);
      const prior = await store.findPriorPhotoShop(deps, shop.household_id, shop.id);
      await store.enqueueMessage(deps, {
        householdId: shop.household_id,
        shopId: shop.id,
        kind: 'confirm_interpretation',
        key: outboxKeyFor(shop.shop_ref, 'confirm_interpretation'),
        payload: {
          shopRef: shop.shop_ref,
          // What was read, counted from the durable interpretation rows. There
          // is deliberately NO physical-line count: none exists anywhere in
          // this system, and the renderer says so instead of inventing one.
          interpretedLines: interpreted.length,
          // The exact-source binding (invariant C). Null when the shop predates
          // fingerprinting - the renderer states that plainly.
          fingerprintPrefix: source && source.fingerprint ? String(source.fingerprint).slice(0, 12) : null,
          fingerprintAlgo: source ? source.algo : null,
          receivedAt: iso(source && source.captured_at ? source.captured_at : shop.created_at),
          // The human-readable prior-photograph comparison (wrong-week
          // protection): the previous photo shop's identity and received time,
          // and - when BOTH fingerprints exist - whether this is literally the
          // same photograph. null means "could not be compared", never "fine".
          priorShopRef: prior ? prior.shop_ref : null,
          priorReceivedAt: prior ? iso(prior.captured_at ?? prior.created_at) : null,
          samePhotoAsPrior: source && source.fingerprint && prior && prior.fingerprint
            ? source.fingerprint === prior.fingerprint
            : null,
        },
      });
    }
    return {
      stepped: false, step: gate.step, from: shop.status, to: null,
      reason: gate.reason, plan_summary: plan.summary, questions: opened,
      decisions_applied: applied, lines_unresolved: unresolved,
      remembered_choices: remembered, remembered_refused: rememberedRefused,
    };
  }

  const moved = await deps.shopStore.transition(shop.id, gate.to, gate.reason);
  return {
    stepped: moved.changed, from: shop.status, to: gate.to,
    plan_summary: plan.summary, questions: opened,
    questions_open: openNow,
    decisions_applied: applied, lines_unresolved: unresolved,
    remembered_choices: remembered, remembered_refused: rememberedRefused,
  };
}

/**
 * PURE. The candidate list for one question card - WITH THE SOURCE OF EVERY ID
 * MADE EXPLICIT.
 *
 * There are two populations of "alternative" in this system and they are NOT
 * interchangeable:
 *
 *   1. planner.rankAlternatives / regularCandidates return
 *      `{ name, price, reason, score }`. THEY CARRY NO ID AT ALL. Treating a
 *      field on one of them as a regulars id would be inventing one.
 *   2. asdair.product_alternatives rows have their OWN primary key, which is
 *      NOT an asdair.regulars.id. Reading it as one puts an id on screen
 *      pointing at a completely different product.
 *   3. resolveByCatalogue.resolveAll returns `{ id, name }` where `id` IS an
 *      asdair.regulars.id, because the resolver's whole job is to determine
 *      identity against asdair.regulars.
 *
 * So: names may come from the planner (it ranks better), but a `regular_id` may
 * come from (3) and NOWHERE ELSE. Every candidate emitted here declares its
 * `source`, so a downstream reader never has to guess which table an id is from
 * - and when there is no trustworthy id, the field is absent rather than
 * populated with something that merely looks like one.
 */
export function planCandidates(planLine, interpretedLine) {
  const out = [];
  // (3) The catalogue resolver's alternatives - the ONLY trustworthy regulars ids.
  const resolverAlts = interpretedLine && Array.isArray(interpretedLine.alternatives)
    ? interpretedLine.alternatives : [];
  for (const a of resolverAlts) {
    const id = a.regular_id ?? null;
    if (id === null || id === undefined) continue;
    out.push({ label: a.name || null, regular_id: Number(id), source: 'asdair.regulars (resolveByCatalogue)' });
  }
  // (1) The planner's ranked suggestions - NAMES ONLY. No id field is emitted,
  // because the planner does not return one and inventing one would be a lie.
  for (const a of (planLine.alternatives || [])) {
    const label = a.name || a.alternative_name || null;
    if (!label) continue;
    if (out.some((c) => c.label === label)) continue;
    out.push({ label, source: 'planner suggestion (no product id)' });
  }
  return out.slice(0, 8);
}

/**
 * RE-PLAN, AND FIRST WRITE THE LEARNING FOR EVERY ANSWER THAT SETTLED IT.
 *
 * This step is reached from NEEDS_DECISION with ZERO open questions - i.e. at
 * the one moment where "Warwick has answered" is durably true and the answers
 * have not yet been consumed by anything. That is why the write-back lives here
 * rather than in commands.answerQuestion: an answer arrives one tap at a time
 * and may arrive twice, but a shop crosses this line once per round of
 * questions, from state the database is holding rather than from an event.
 *
 * outcome/buildAnswerLearning.js and outcome/recordAnswerLearning.js were both
 * complete, both tested, and had ZERO production callers - so every answer
 * Warwick has ever given died with the shop that asked for it.
 *
 * ── applies_going_forward IS AN EXPLICIT LITERAL false, AND THAT IS THE POINT ─
 * buildAnswerLearning demands a STRICT boolean and hard-errors on an absent one,
 * so there is no default to fall into. The pipeline passes `false` because it
 * holds NO human act asserting a standing rule: a tapped button and a typed
 * reply both say "this is the one I mean", neither says "and do this every week
 * from now on". Inferring the second from the first is exactly the ambiguous
 * inference promoteDecision's provenance guard exists to refuse - see the note
 * on realRecordLearning in deps.js, which this obeys rather than amends.
 *
 * ── CORRECTED 2026-08-09 (WP-B15-2). THIS COMMENT USED TO BE FALSE. ─────────
 * It previously read: "It is NOT a no-op. ... That log row is what data.js
 * loadRuleQaLog() reads back as `priorAnswers`, which stepPlan now feeds to the
 * planner - so the loop closes through the decision log, not through rule
 * promotion."
 *
 * THE LOOP DID NOT CLOSE. The claim was accurate about the write and the read
 * and wrong about the end: `promoteDecision` does write the rule_qa_log row
 * unconditionally, and `loadRuleQaLog` does read it back - and then
 * `planner.js` discards it, because `eligiblePriorAnswers` admits only rows
 * where `applies_going_forward === true`, which is the exact literal this step
 * passes as `false`. Every row written here was filtered out by the consumer.
 * The defect was documented as the fix, and the comment cost two separate
 * investigations before anyone read both ends of the chain.
 *
 * What is true now: this write is the FORWARD-LEARNING channel and it remains
 * inert until Lane B consumes it. It is NOT how an answer changes this week's
 * shop. That job belongs to asdair.shop_decision and applyDecisions.js, which
 * are a different table on a different path for a deliberately different
 * concern (Warwick, 2026-08-09: current-shop meaning and future household
 * learning are different concerns). If the command surface ever grows an
 * explicit "and going forward" act, THAT is what flips this literal, and
 * nothing else may.
 *
 * ── WHY A FAILURE HERE FAILS THE SHOP ──────────────────────────────────────
 * recordAnswerLearning throws by design and this step does not catch it: the
 * shop parks FAILED, visibly and resumably, and Warwick is told. Swallowing it
 * would leave the loop LOOKING wired while the answer quietly evaporated, which
 * is indistinguishable from the defect being fixed and would only be discovered
 * next Sunday when he is asked the same question again. The claim row is left
 * unresolved on the way out, which is precisely how the retry knows to re-run.
 */
async function stepReplan(deps, snapshot) {
  const shop = snapshot.shop;
  const learned = [];
  const decided = [];

  for (const q of await store.listQuestions(deps, shop.id)) {
    if (q.status !== 'answered' && q.status !== 'skipped') continue;

    // ── WHAT THE ANSWER MEANT FOR THIS WEEK (WP-B15-2) ────────────────────
    // Derived HERE, beside the learning write, for the same reason the
    // learning write lives here: this is the one moment where "Warwick has
    // answered" is durably true and nothing has consumed it yet. Deriving it
    // in the tap handler instead would put a model call on the interactive
    // path, where a slow or failing gateway would look to Warwick like a
    // button that did nothing.
    //
    // Idempotent by the database: shop_decision_question_uniq means a re-run
    // resolves to the SAME row. A second, differently-worded reading of the
    // same answer cannot overwrite the first.
    try {
      const outcome = await decideAnswer(deps, shop, q);
      if (outcome) decided.push(outcome);
    } catch (err) {
      // A failure to INTERPRET must not fail the shop and must not be
      // swallowed. The line simply stays unresolved, the gate refuses
      // READY_TO_SHOP, and the next pass tries again - which is a visible,
      // recoverable state rather than a basket built on a guess.
      decided.push({
        question_key: q.question_key, decided: false,
        reason: `interpretation failed: ${String(err && err.message ? err.message : err)}`,
      });
    }

    // The evidence of WHAT was asked about. Read from durable state - the
    // photographed wording from asdair.shop_line, else the list item's own
    // name - and NEVER reconstructed from question_text, which is a sentence.
    // With neither, nothing is claimed and nothing is written: a question that
    // predates the carrier is reported and left for a later pass, because
    // inventing the wording would put words in the decision log that nobody
    // wrote.
    const wording = q.photographed_wording || q.item_name || null;
    if (!wording) {
      learned.push({ question_key: q.question_key, learned: false, reason: 'no durable wording to learn from' });
      continue;
    }

    // ONE SHOT, EVER. rule_qa_log has no idempotency key of its own, so a
    // re-run would append a duplicate decision to the audit log. The database
    // decides the duplicate, not a read-then-write here.
    const claim = await store.claimAnswerLearning(deps, {
      shopId: shop.id, householdId: shop.household_id, questionKey: q.question_key,
    });
    if (claim.already) {
      learned.push({ question_key: q.question_key, learned: false, reason: 'already recorded' });
      continue;
    }

    const receipt = await deps.recordAnswerLearning({
      shop_id: shop.id,
      household_id: shop.household_id,
      question_key: q.question_key,
      question_text: q.question_text,
      status: q.status,
      answer_text: q.status === 'skipped' ? null : q.answer_text,
      answer_source: q.answer_source,
      photographed_wording: wording,
      // NO CLOCK. The week the shop belongs to, from its own ref - a retry that
      // crossed midnight must not date the decision to the following day.
      asked_on: listDateOf(shop.shop_ref),
      applies_going_forward: false,
      // The pipeline resolves no catalogue IDENTITY from an answer. It records
      // the decision; identity remains the resolver's job and record-shop.js's.
      resolution: { kind: 'none' },
    });

    await store.resolveCommand(deps, claim.id, 'done',
      `answer learning recorded (rule_qa_log ${receipt.log_id})`);
    learned.push({ question_key: q.question_key, learned: true, log_id: receipt.log_id });
  }

  const moved = await deps.shopStore.transition(
    shop.id, 'PROCESSING', 'every question is answered - re-planning with the answers in place',
  );
  return {
    stepped: moved.changed, from: shop.status, to: 'PROCESSING',
    answer_learning: learned, decisions: decided,
  };
}

/**
 * ONE ANSWER -> ONE STRUCTURED CURRENT-SHOP DECISION.
 *
 * THE ORDER OF THE TWO BRANCHES IS THE POINT, not an optimisation:
 *
 *   1. AN EXACT CANDIDATE IS RESOLVED DETERMINISTICALLY, WITH NO MODEL CALL.
 *      Warwick picked from a list we rendered and the candidate carries a real
 *      asdair.regulars id. Nothing is left to interpret. Handing that to a
 *      model would spend a call to re-derive a fact we already hold, and give
 *      it an opportunity to be wrong about something certain.
 *
 *   2. FREE TEXT goes to the bounded interpreter, and ONLY free text.
 *
 * The interpreter is an injected seam (`deps.interpretAnswer`) so the suite
 * stubs it at the boundary and spends nothing. A runtime with no interpreter
 * wired does NOT guess: the answer stays uninterpreted, the line stays
 * unresolved, and the gate refuses READY_TO_SHOP - which is the whole design.
 *
 * ── WHAT THE INTERPRETER MAY ASSERT ─────────────────────────────────────────
 * It returns STRUCTURED MEANING, never prose authority, and it may only name a
 * product present in the grounded evidence it was given. That is enforced in
 * three places rather than trusted once: the prompt bounds it, `buildDecision`
 * rejects a shape that decides nothing while claiming to, and
 * `decided_regular_id` is a real FOREIGN KEY - so an invented product is
 * refused by the database, not by the model's good intentions. Unknown means
 * `clarification_required`; there is no least-bad match anywhere on this path.
 */
async function decideAnswer(deps, shop, question) {
  // Already decided - the database owns that fact, not this process.
  const existing = await shopDecisions.findDecisionForQuestion(deps, question.id);
  if (existing) {
    // SELF-HEALING, and deliberately so. A shop decided before migration 018
    // existed - or on a pass where the memory write failed - gets its
    // remembered choice on the next pass, from the decision the database is
    // already holding. The insert is idempotent on source_decision_id, so a
    // decision that has already been remembered costs one refused INSERT and
    // changes nothing.
    const memory = await rememberIfAuthorised(deps, shop, question, existing);
    return {
      question_key: question.question_key, decided: false, reason: 'already decided', memory,
    };
  }

  // ── 1. DETERMINISTIC. No model call on this path, and a test asserts it. ──
  const exact = shopDecisions.resolveExactCandidate(question);
  if (exact) {
    const res = await shopDecisions.recordDecision(deps, {
      shop_id: shop.id, question_id: question.id, ...exact.decided,
    });
    // A TAP ON A CARD OFFERING TWO OR MORE GROUNDED CANDIDATES IS *EXACTLY*
    // WHAT WARWICK DESCRIBED: "several grounded catalogue candidates are
    // genuinely acceptable and I choose one". It is also the common case, so
    // the memory must be written on the deterministic path and not only on the
    // free-text one - and it costs no model call here either.
    const memory = await rememberIfAuthorised(deps, shop, question, res.decision);
    return {
      question_key: question.question_key, decided: res.created,
      kind: res.decision.decision_kind, interpreted_by: res.decision.interpreted_by,
      model_called: false, memory,
    };
  }

  // ── 2. FREE TEXT. Bounded, grounded interpretation. ──────────────────────
  //
  // ── EVERY FAILURE FROM HERE ON OPENS A QUESTION (Codex F2) ───────────────
  // A line whose question is already ANSWERED has exactly one route back to a
  // human: a `clarification_required` decision, which opens a genuine round-2
  // question. Anything that instead throws or returns without writing a
  // decision leaves the line unresolved with NO open question - the shop parks
  // at wait:line_resolution and the lines_unresolved card tells Warwick it is
  // stuck while giving him nothing to answer. A notification is not an answer
  // path.
  //
  // Five paths used to end that way, not one. Codex found the second; the
  // CLASS is what matters:
  //   1. no interpreter wired            -> returned early, no decision
  //   2. structurally invalid return     -> threw            (Codex F2)
  //   3. buildAnswerGrounding throwing    -> propagated
  //   4. the interpreter itself throwing  -> propagated (e.g. no gateway)
  //   5. recordDecision refusing a shape  -> propagated (Terra returns
  //                                          existing_regular with no id)
  //
  // The inconsistency was the tell: an unknown KIND already became a
  // clarification and gave Warwick a real question, while a malformed SHAPE
  // gave him a dead end. Same underlying situation - Terra did not return
  // something usable - and "I could not read the answer" is precisely the case
  // where asking again is correct. So they all take the same route now.
  //
  // THIS GUESSES NOTHING. A clarification decides nothing about the line: it
  // records that the answer could not be read and asks Warwick again.
  let grounding = null;
  let returned = null;
  let failure = null;

  try {
    if (typeof deps.interpretAnswer !== 'function') {
      failure = 'no interpreter is wired into this runtime, so your answer could not be read';
    } else {
      grounding = await buildAnswerGrounding(deps, shop, question);
      returned = await deps.interpretAnswer(grounding);
      if (!returned || typeof returned !== 'object' || Array.isArray(returned)
        || typeof returned.decision_kind !== 'string') {
        failure = 'the interpreter did not return a usable structured answer';
        returned = null;
      }
    }
  } catch (err) {
    failure = `the interpreter could not be reached: ${String(err && err.message ? err.message : err)}`;
  }

  // PROVENANCE STAYS TRUE. A failure-derived clarification was decided by this
  // code's own rule, NOT by a model - in three of the five paths no model was
  // ever successfully invoked at all. Recording 'terra' for those would be the
  // same false provenance WO-2026-08-09-B15-03 existed to remove.
  const failureSpec = () => ({
    shop_id: shop.id,
    question_id: question.id,
    decision_kind: 'clarification_required',
    clarification_reason: failure,
    interpreted_by: 'rule',
    decision_evidence: {
      model_return: returned,
      grounding: grounding ? grounding.sanitized : null,
      failure,
    },
    grounding_fingerprint: grounding ? grounding.fingerprint ?? null : null,
    evidence_shop_line_id: grounding ? grounding.shop_line_id ?? null : null,
  });

  if (failure !== null) {
    const res = await shopDecisions.recordDecision(deps, failureSpec());
    return {
      question_key: question.question_key, decided: res.created,
      kind: res.decision.decision_kind, interpreted_by: 'rule',
      model_called: returned !== null, reason: failure,
    };
  }

  let res;
  try {
    res = await shopDecisions.recordDecision(deps, {
      shop_id: shop.id,
      question_id: question.id,
      decision_kind: returned.decision_kind,
      decided_regular_id: returned.decided_regular_id ?? null,
      decided_quantity: returned.decided_quantity ?? null,
      decided_item_name: returned.decided_item_name ?? null,
      clarification_reason: returned.clarification_reason ?? null,
      // STORED, ROUTED NOWHERE. Lane B consumes it; nothing here does.
      forward_intent: returned.forward_intent ?? null,
      interpreted_by: 'terra',
      interpreted_model: returned.model ?? null,
      // THE EVIDENCE OF WHAT IT WAS GIVEN. 017's shop_decision_terra_shows_its_work
      // CHECK makes a terra decision with empty evidence unstorable, so this is
      // not a convention that can quietly lapse.
      decision_evidence: { model_return: returned, grounding: grounding.sanitized },
      grounding_fingerprint: grounding.fingerprint ?? null,
      evidence_shop_line_id: grounding.shop_line_id ?? null,
    });
  } catch (err) {
    // PATH 5. The model returned a well-formed object describing an ILL-FORMED
    // decision - `existing_regular` naming no product, `new_item` with no name.
    // buildDecision and migration 017 both refuse it, correctly. Refusing it
    // must not also strand the line, so it degrades to the same question.
    failure = `the interpreter returned a decision the database refuses: ${String(err && err.message ? err.message : err)}`;
    const fallback = await shopDecisions.recordDecision(deps, failureSpec());
    return {
      question_key: question.question_key, decided: fallback.created,
      kind: fallback.decision.decision_kind, interpreted_by: 'rule',
      model_called: true, reason: failure,
    };
  }

  // The free-text half of the same rule. `clarification_required` never
  // reaches here as a rememberable kind - decideToRemember refuses it, and the
  // composite foreign key would refuse the row - so an answer AsdAIr could not
  // read can never become a standing preference.
  const memory = await rememberIfAuthorised(deps, shop, question, res.decision);
  return {
    question_key: question.question_key, decided: res.created,
    kind: res.decision.decision_kind, interpreted_by: 'terra', model_called: true, memory,
  };
}

/**
 * THE BOUNDED EVIDENCE PACKET one answer is interpreted against.
 *
 * The boundary is a closed list, and everything outside it is deliberately
 * absent: the model gets the original wording, the exact question, Warwick's
 * exact words, the candidates that were offered, the catalogue identities in
 * play, and the household rules that apply. It does not get the shop, the
 * database, the other lines, or anything it could use to decide something it
 * was not asked about.
 *
 * `sanitized` is what is DURABLY RECORDED as evidence: shapes, counts and ids,
 * never the household's content twice over. An audit record must make the claim
 * checkable without becoming a second copy of the shopping list.
 */
async function buildAnswerGrounding(deps, shop, question) {
  const catalogue = assertCatalogueLoaded(await deps.loadCatalogue(shop.household_id), 'answer interpretation');
  const inputs = await deps.loadPlanningInputs(shop.household_id);
  const interpreted = await shopLines.listLines(deps, shop.id);
  const wording = question.photographed_wording || question.item_name || null;
  const line = wording
    ? interpreted.find((l) => normaliseTerm(l.raw_reading) === normaliseTerm(wording)) || null
    : null;

  const candidates = [
    ...(Array.isArray(question.rendered_candidates) ? question.rendered_candidates : []),
    ...(Array.isArray(question.candidates) ? question.candidates : []),
  ].filter((c) => c && typeof c === 'object');

  return {
    // What the model is asked to interpret.
    original_wording: wording,
    question_text: question.question_text,
    answer_text: question.answer_text,
    answer_source: question.answer_source,
    candidates,
    regulars: regularsOf(catalogue),
    rules: inputs.rules,
    shop_line_id: line ? line.id : null,
    fingerprint: null,
    // What is durably recorded ABOUT the call: counts and ids only. Never a
    // product name, never the list, never the prompt text.
    sanitized: {
      question_id: question.id,
      candidates_offered: candidates.length,
      candidate_regular_ids: candidates.map((c) => c.regular_id ?? null).filter((v) => v !== null),
      regulars_supplied: (regularsOf(catalogue) || []).length,
      rules_supplied: Array.isArray(inputs.rules) ? inputs.rules.length : 0,
      answer_source: question.answer_source,
      had_original_wording: wording !== null,
    },
  };
}

/** APPLY CORRECTIONS. A correction is a new durable intent against the same
 *  list; add_list_item's upsert makes applying it twice a no-op. */
async function stepApplyCorrections(deps, snapshot) {
  const shop = snapshot.shop;
  const listDate = listDateOf(shop.shop_ref);
  const corrections = pendingCommands(snapshot, COMMANDS.CORRECT_LINE);
  const applied = [];

  for (const c of corrections) {
    const intents = [{
      command: 'add_list_item',
      args: {
        context: 'shopping',
        list_date: listDate,
        item_name: c.payload.item_name,
        requested_qty: c.payload.requested_qty ?? null,
        note: c.payload.note ?? `corrected by ${c.payload.actor}`,
        status: c.payload.status || 'requested',
      },
      idempotency_key: `${c.key}:correction`,
      requested_by: c.payload.actor || 'asdair:pipeline',
    }];
    deps.assertAllowedIntents(intents);
    const written = await deps.executeIntents(intents, { householdId: shop.household_id, listDate });
    await store.resolveCommand(deps, c.id, 'done', `applied to list ${written.listId}`);
    applied.push({ item_name: c.payload.item_name, list_id: written.listId });
  }

  return { stepped: applied.length > 0, from: shop.status, to: null, corrections: applied };
}

/**
 * THE PLAN, AS EXECUTION PACKET LINES.
 *
 * Nothing invented, ever. A planned line becomes a shoppable line only when the
 * household catalogue can supply its IDENTITY - the regulars row the planner
 * matched it to, with its id, brand and (where we have one) ASDA reference.
 * Everything else becomes a HELD entry carrying the reason, which is the
 * packet's own mechanism for "a human must look at this" and is why this
 * adapter never has to guess.
 *
 * WHY THE LOOKUP IS BY NAME. `planBasket` returns `matched_product` as a NAME,
 * not an id - see its publicItems projection. The identity therefore has to be
 * recovered from the same regulars rows the planner was given, which is what
 * `inputs.regulars` is. A line whose name no longer resolves is HELD, not
 * shopped: an unresolvable identity at this point is a real defect, and the
 * right thing to do with a real defect is show it to Warwick.
 *
 * BRAND IS LOAD-BEARING, NOT DECORATION (Warwick, 2026-08-09): the packet sorts
 * brand A-Z so the plan order and the ASDA Regulars page order under Sort A-Z
 * are the SAME sequence. That is what makes a single top-to-bottom pass
 * possible instead of a search per line.
 */
function packetLinesFromPlan(planItems, regulars, unusableRefs = []) {
  const byName = new Map();
  for (const r of Array.isArray(regulars) ? regulars : []) {
    const key = normaliseTerm(r && r.name);
    if (key !== '' && !byName.has(key)) byName.set(key, r);
  }

  return (Array.isArray(planItems) ? planItems : []).map((item, i) => {
    const shopLineNo = i + 1;
    const original = String(item.item_name || '').trim() || `line ${shopLineNo}`;
    const hold = (reason, detail) => ({
      shop_line_no: shopLineNo, original_list_line: original, hold: { reason, detail: detail || null },
    });

    // `hold.reason` is a CLOSED vocabulary owned by the packet contract, so the
    // reason is MAPPED onto it rather than extended - a private reason string
    // here would be refused by the producer, and rightly: the reasons are what
    // the cockpit and the reconciler branch on. The specifics never go missing;
    // they travel in `detail`.
    if (item.status !== 'add') {
      const excluded = item.status === 'excluded' || item.status === 'excluded_this_week';
      return hold(excluded ? 'excluded_by_rule' : 'awaiting_decision',
        `the planner left this line as "${item.status}"`);
    }

    const regular = byName.get(normaliseTerm(item.matched_product));
    if (!regular) {
      return hold('ambiguous',
        `the plan names "${item.matched_product}" but no regulars row carries that name, so this line has no `
        + 'durable identity to shop against. Held rather than free-searched on a guess.');
    }

    const qty = Number.isInteger(item.planned_qty) ? item.planned_qty : null;
    if (qty === null || qty < 1 || qty > 99) {
      return hold('awaiting_decision', 'a quantity is never invented - see the packet contract');
    }

    // A REFERENCE WE CANNOT USE IS, OPERATIONALLY, A REFERENCE WE DO NOT HAVE.
    //
    // `asdair.regulars.asda_product_id` is a free-text column (migration 004);
    // an ASDA reference is 3-12 digits. A value that is neither - a typo, or a
    // placeholder from before the packet contract existed - cannot be used to
    // add the product.
    //
    // Ruling 2 governs what happens next, and it is explicit: "if we HAVE a
    // usable reference, use it... If we do NOT have one, retrieval by search is
    // permitted", travelling with the verify-before-add and stop-if-ambiguous
    // duties. So the line is SHOPPED, by bounded retrieval against the identity
    // we do hold - not held. Holding it would mean the household does not get
    // its groceries because of a typo in a reference column, which is a worse
    // outcome than looking the product up and verifying it before adding.
    //
    // It is not swallowed either: `unusable_references` is counted and reported
    // on the step, so the data defect is visible without costing the shop.
    const rawRef = regular.asda_product_id == null ? null : String(regular.asda_product_id);
    const ref = rawRef !== null && /^[0-9]{3,12}$/.test(rawRef) ? rawRef : null;
    if (rawRef !== null && ref === null) unusableRefs.push(String(regular.name));
    return {
      shop_line_no: shopLineNo,
      original_list_line: original,
      origin: 'known',
      canonical_product_id: Number(regular.id),
      canonical_product_name: String(regular.name),
      brand: regular.brand == null ? null : String(regular.brand),
      // Ruling 2: identity and RETRIEVAL are separate concerns. With a usable
      // reference the line is added from Regulars/Favourites; without one it is
      // retrieved by search - and buildHandoff attaches the bounded retrieval
      // contract to exactly those lines, which is what keeps search a fallback
      // rather than the default.
      source_view: ref ? 'regulars' : 'search',
      asda_product_ref: ref,
      required_quantity: qty,
      substitutes_allowed: regular.substitutes_allowed === true,
    };
  });
}

/**
 * QUEUE THE BROWSER BUILD - AND IT CANNOT BE QUEUED WITHOUT THE METHOD.
 *
 * ── WHAT THIS STEP USED TO BE, AND WHY IT WAS THE DEFECT ────────────────────
 * Two lines: `shopStore.requestBrowserBuild(shop.id)` inserted a row carrying
 * (shop_id, status) and nothing else, then the shop moved to
 * WAITING_FOR_BROWSER. No packet was built, no handoff was built, and the
 * operating contract in handoff/instructions.js reached nobody. The worker got
 * a bare "go and shop" and rediscovered ASDA from memory - which is exactly
 * what Warwick ruled must become impossible.
 *
 * The producers were not missing. `buildExecutionPacket`, `buildHandoff` and
 * `verifyBasket` were complete, tested, and had ZERO production callers. This
 * is the call site that gives the first two one.
 *
 * ── WHY openHandoff AND NOT requestBrowserBuild (Larry's ruling, 2026-08-09) ─
 * Because the shopStore route physically cannot carry a payload:
 * `requestBrowserBuild` inserts only (shop_id, status), and
 * `updateBrowserProgress` refuses any row that is not already claimed/running,
 * so a just-queued request can never be back-filled with what it must carry.
 * `handoff/claim.js openHandoff` inserts the request WITH its handoff block in
 * one statement, under the same partial unique index, so repeated taps still
 * resume exactly one live request per shop.
 *
 * It is also ARM-AGNOSTIC, which matters: RUNTIME-DECISION.md names Sonnet in
 * Claude for Chrome as the live writer while the Wayfinder keeps CDP as "the
 * arm, not yet the accepted method". A durable request carrying the contract
 * serves either, and this step does not have to choose between them.
 */
export async function buildBrowserHandoff(deps, shop) {
  // The plan is recomputed here through the ONE function that applies Warwick's
  // decisions - never `deps.planBasket` directly. See planWithDecisions.
  //
  // RECOMPUTED, not stored, for the reason stated at the top of this file:
  // there is no plan table, and every site that needs a plan derives it from
  // the same durable inputs. That is what lets the return leg rebuild exactly
  // what was handed over without a second copy of the truth to keep in step.
  const catalogue = assertCatalogueLoaded(await deps.loadCatalogue(shop.household_id), 'browser handoff');
  const listItems = await store.listListItems(deps, shop.list_id);
  const inputs = await deps.loadPlanningInputs(shop.household_id);
  const { plan } = await planWithDecisions(deps, shop, { listItems, inputs, catalogue });

  // NO CLOCK, for the same reason listDateOf() takes the date from the shop_ref
  // rather than from today: a retry must produce the same packet as the run it
  // is retrying. `updated_at` is the durable record of when this shop last
  // moved, which is exactly when its packet was prepared.
  const unusableRefs = [];
  const packet = buildExecutionPacket({
    shop_ref: shop.shop_ref,
    generated_at: shop.updated_at || shop.created_at,
    household_id: shop.household_id == null ? undefined : Number(shop.household_id),
    lines: packetLinesFromPlan(plan.items, inputs.regulars, unusableRefs),
  });

  // THE REFUSAL THAT MAKES THE CONTRACT REAL. buildHandoff throws
  // PacketContractError unless the artefact carries all 18 method steps, all 5
  // prohibitions and a usable instructions_version. There is therefore no
  // ordering of this function in which a browser build request exists and the
  // method did not: the throw happens BEFORE openHandoff is reached.
  //
  // operatingRules stays empty deliberately. The household's shelf-guidance
  // rules are a separate lane, and passing rows this step has no contract for
  // would be inventing guidance.
  const handoff = buildHandoff(packet, { operatingRules: [] });
  return { packet, handoff, unusableRefs };
}

async function stepQueueBrowserBuild(deps, snapshot, command) {
  const shop = snapshot.shop;
  const { handoff, unusableRefs } = await buildBrowserHandoff(deps, shop);

  const opened = await openHandoff(deps.writeQuery, {
    shopId: shop.id,
    handoff,
    openedBy: 'asdair:pipeline',
  });

  const moved = await deps.shopStore.transition(
    shop.id, 'WAITING_FOR_BROWSER',
    'browser build requested - a SUPERVISED runner will claim it; nothing autonomous ever does',
  );

  return {
    stepped: moved.changed,
    from: shop.status,
    to: 'WAITING_FOR_BROWSER',
    browser_request_id: opened.request.id,
    request_created: opened.created,
    request_resumed: opened.resumed === true,
    request_superseded: opened.superseded === true,
    // Reported so a run's log SAYS which contract governed it, rather than
    // leaving it to be inferred from whatever instructions.js happens to say
    // on the day someone reads the log.
    packet_fingerprint: handoff.packet_fingerprint,
    instructions_version: handoff.instructions_version,
    method_steps: handoff.method.length,
    prohibited_actions: handoff.prohibited_actions.length,
    packet_lines: handoff.lines.length,
    held_lines: handoff.held.length,
    // Named, not swallowed: catalogue rows whose asda_product_id is not a usable
    // ASDA reference. Those lines are still shopped, by bounded retrieval - this
    // is how the data defect stays visible without costing Warwick the item.
    unusable_references: unusableRefs.length,
    unusable_reference_products: unusableRefs,
    command,
  };
}

/** PAUSE. Release the browser request; from WAITING_FOR_BROWSER the week
 *  returns to READY_TO_SHOP without being lost. */
async function stepPauseBuild(deps, snapshot, to) {
  const shop = snapshot.shop;
  let cancelled = null;
  if (snapshot.browserIsLive) {
    cancelled = await deps.shopStore.finishBrowserBuild(snapshot.browser.id, { status: 'cancelled' });
  }
  let moved = { changed: false };
  if (to) moved = await deps.shopStore.transition(shop.id, to, 'browser build paused at the human\'s request');
  return {
    stepped: !!cancelled || moved.changed, from: shop.status, to: to || null,
    browser_request_cancelled: !!cancelled,
  };
}

/**
 * RECORD THE CONFIRMATION. Parse what Warwick forwarded, reconcile it against
 * the plan, and persist both.
 *
 * The plan is RECOMPUTED here rather than read from a plan table, because there
 * is no plan table and inventing one would mean a migration in a folder this
 * work package must not touch.
 *
 * ── RECOMPUTATION IS NOT DETERMINISTIC ANY MORE, AND THIS SAYS SO ───────────
 * This comment used to read "planBasket is pure and deterministic, so given the
 * same durable inputs it reproduces the same plan - which is exactly what makes
 * recomputation honest rather than a guess." The first clause is still true and
 * the conclusion is NOT. Since WP-B15-3 wired the prose rulebook, every plan on
 * this path is built by `planWithDecisions`, which CONSULTS A MODEL at every
 * recomputation (measured: 3 consults on a full journey). `planBasket` is pure;
 * the plan this function reconciles against is not, and two recomputations from
 * identical durable inputs may legitimately differ wherever a household prose
 * rule applies.
 *
 * What makes recomputation honest today is narrower, and worth having exactly
 * right:
 *   * the DETERMINISTIC layer is reproducible - identity, exclusion, mapping,
 *     quantities and the status chain come from `planBasket` alone;
 *   * WARWICK'S ANSWERS are applied last and always win, so nothing a model
 *     says can displace a decision already on record;
 *   * where the judgement layer cannot be applied confidently it produces a
 *     QUESTION or a visible flag, never a silent substitution - so a divergence
 *     between two recomputations is something a person can see and answer.
 *
 * That is a weaker guarantee than the old sentence claimed, and writing the
 * weaker one down is the point. Making a judged choice durable so a later
 * recomputation REPRODUCES it rather than re-deciding it is separate work; it
 * is deliberately not anticipated, stubbed or hooked for here.
 *
 * ── AND THAT IS EXACTLY WHY DECISIONS MUST BE APPLIED HERE TOO (WP-B15-2) ───
 * "Deterministic given the same durable inputs" is only true if the DECISIONS
 * are among the inputs. Before this change, this site recomputed the plan
 * WITHOUT them - and, separately, without `priorAnswers` - so the basket
 * reconciled against a plan that had never heard of anything Warwick said.
 * Warwick would have seen his answer change the shop, then watched
 * reconciliation quietly disagree with it, which is worse than the answer
 * never landing at all. `planWithDecisions` is now the only way a plan is
 * built anywhere in this module.
 *
 * recordConfirmation is idempotent on (shop_id, content_fingerprint): the same
 * confirmation submitted twice writes nothing the second time.
 */
async function stepRecordConfirmation(deps, snapshot, command) {
  const shop = snapshot.shop;
  const catalogue = assertCatalogueLoaded(await deps.loadCatalogue(shop.household_id), 'reconciliation');
  const listItems = await store.listListItems(deps, shop.list_id);
  const inputs = await deps.loadPlanningInputs(shop.household_id);
  const { plan } = await planWithDecisions(deps, shop, { listItems, inputs, catalogue });

  const built = deps.buildConfirmationPayload({
    shop_id: shop.id,
    household_id: shop.household_id,
    source_kind: command.payload.source_kind || 'text',
    raw_text: command.payload.raw_text,
    received_at: command.payload.received_at || null,
    plan,
    list_items: listItems,
    regulars: regularsOf(catalogue),
  });

  const written = await deps.recordConfirmation(built.confirmation);
  const moved = await deps.shopStore.transition(
    shop.id, 'ORDER_CONFIRMATION_RECEIVED',
    `order confirmation recorded (${built.confirmation.lines.length} line(s))`,
  );
  // The command is consumed by runPipeline's single consumption path, not here.
  // One owner per consumption - see stages.js on APPLY_CORRECTIONS.

  return {
    stepped: moved.changed, from: shop.status, to: 'ORDER_CONFIRMATION_RECEIVED',
    confirmation_id: written.confirmation_id,
    confirmation_created: written.created,
    reconcile_summary: built.reconciled.summary,
  };
}

/**
 * RECONCILE AND LEARN. The last arc of the cycle: what actually arrived becomes
 * next week's catalogue.
 *
 * `recordLearning` is an injected seam with a conservative default (alias
 * enrichment only). Learning NEVER fails the shop: a shop that reconciled
 * correctly but could not write an alias has still done its job, so the errors
 * are collected and reported rather than thrown.
 */
async function stepReconcile(deps, snapshot) {
  const shop = snapshot.shop;
  let learning = { attempted: 0, applied: 0, errors: [] };
  try {
    learning = await deps.recordLearning({ shop, deps });
  } catch (err) {
    learning = { attempted: 0, applied: 0, errors: [String(err && err.message ? err.message : err)] };
  }
  const moved = await deps.shopStore.transition(
    shop.id, 'RECONCILED',
    'reconciled against the order confirmation; this shop is finished',
  );
  return { stepped: moved.changed, from: shop.status, to: 'RECONCILED', learning };
}

// =====================================================================
// THE ADVANCER
// =====================================================================

/**
 * Advance ONE shop by exactly ONE step.
 *
 * Safe to call repeatedly (a shop with nothing to do returns `stepped:false`
 * and a reason) and safe to call concurrently (the guarded transition is the
 * mutual exclusion; the loser returns `claimed:false`).
 *
 * @param {{shopId?:*, shopRef?:string, householdId?:*}} handle
 * @param {object} deps the wired dependency container (see deps.js)
 */
export async function runPipeline(handle, deps) {
  const snapshot = await store.readSnapshot(deps, handle);
  const shop = snapshot.shop;

  // ── THE RECEIPT CARD, SELF-HEALING ──────────────────────────────────────
  // Queued the first time (ever) a shop is found at RECEIVED - independent of
  // whatever step decideNextStep chooses THIS pass, including
  // AWAIT_BUILD_COMMAND, a wait: step dispatchStep below never reaches. That is
  // why this lives here as a side effect rather than as a new act: step in
  // stages.js: it is bookkeeping alongside a pass, not a transition of the
  // state machine - the same reason failShop (below) enqueues its own failure
  // card directly rather than through queueMilestoneMessage/messageForTransition,
  // which are keyed by the transition's `to`.
  //
  // outboxEverQueued reads the FULL history (pending or resolved), so a shop
  // already carrying this card - from this pass, an earlier pass, or a pass
  // that ran before this check existed - is left alone. That is what recovers
  // a shop that has been sitting at RECEIVED for real, on its very next pass,
  // with no restart of the DURABLE STATE and no manual insert: only a restart
  // of the runner process (to pick up this code) is required, and that is
  // never this module's job to perform.
  if (shop.status === 'RECEIVED' && !(await store.outboxEverQueued(deps, shop.id, 'receipt'))) {
    await store.enqueueMessage(deps, {
      householdId: shop.household_id,
      shopId: shop.id,
      kind: 'receipt',
      key: outboxKeyFor(shop.shop_ref, 'receipt'),
      payload: { shopRef: shop.shop_ref, source: shop.source_kind === 'photo' ? 'photo' : 'text' },
    });
  }

  // ── THE "READING YOUR LIST" PROGRESS CARD, SELF-HEALING ─────────────────
  // Before this fix the only outbox messages were the one-time receipt above,
  // the milestone cards keyed by messageForTransition, and a failure card -
  // nothing between "Build this shop" and either a real milestone or a crash,
  // which reads as total silence for however long the vision call takes.
  //
  // Queued the first time (ever) a shop is found at TRANSCRIBING - same
  // self-healing shape as the receipt above, and deliberately NOT wired
  // through messageForTransition/queueMilestoneMessage: those are keyed per
  // TRANSITION, not per shop, so a shop that fails during interpretation and
  // is retried (act:resume -> TRANSCRIBING, exactly SHOP-2026-08-03's own
  // shape) would transition INTO TRANSCRIBING a second time and, under that
  // mechanism, could re-mint and re-send an already-sent card. outboxEverQueued
  // reads the FULL history (pending or resolved), so this card is sent AT MOST
  // ONCE per shop, ever - "reading your list now" is a fact about a shop's
  // whole life, not about one pass of the advancer.
  //
  // A TEXT shop never visits TRANSCRIBING at all (RECEIVED -> act:interpret
  // goes straight to PROCESSING - see stages.js), so this is naturally scoped
  // to the photo path, where the vision call is the actual source of the
  // silence this card exists to break.
  if (shop.status === 'TRANSCRIBING' && !(await store.outboxEverQueued(deps, shop.id, 'progress'))) {
    await store.enqueueMessage(deps, {
      householdId: shop.household_id,
      shopId: shop.id,
      kind: 'progress',
      key: outboxKeyFor(shop.shop_ref, 'transcribing'),
      payload: { shopRef: shop.shop_ref, stage: 'reading the photograph of your list against the household catalogue' },
    });
  }

  const next = decideNextStep(snapshot);

  // A legal park. NOT an error, and not something to work around.
  //
  // `to` is carried through even though nothing moved: a parked shop must still
  // be able to say where it WOULD go. "FAILED, and it would resume to
  // TRANSCRIBING" is the answer a human needs; "FAILED" alone is not.
  if (!next.step.startsWith('act:')) {
    // HOUSEKEEPING ON A FINISHED WEEK. A command issued against a shop that has
    // since reconciled or been cancelled can never be consumed - the stage
    // table will not act on a terminal shop - so without this it would sit
    // "pending" in the machine ledger forever, holding that generation of the
    // command open. Retired with a reason, never silently dropped. (It never
    // reaches the household's outstanding-actions list at all: since migration
    // 009 the machine ledger and the human list are different tables.)
    const abandoned = next.step === STEPS.DONE
      ? await abandonOutstanding(deps, snapshot)
      : [];
    return outcome(next.step, {
      stepped: false, from: shop.status, to: next.to ?? null,
      reason: next.reason, shop_ref: shop.shop_ref, shop_id: shop.id,
      abandoned_commands: abandoned,
    });
  }

  try {
    const result = await dispatchStep(deps, snapshot, next);
    // Consume the command that authorised the step, once the step has actually
    // landed. A LATCH command is never consumed - see commandNames.js.
    if (result.stepped && next.command) {
      const spec = COMMAND_SPECS[next.command.command];
      if (spec && spec.consumption === CONSUMPTION.CONSUME) {
        await store.resolveCommand(deps, next.command.id, 'done', `consumed by ${next.step}`);
      }
    }
    if (result.stepped) await queueMilestoneMessage(deps, snapshot, result);
    return {
      ok: true, claimed: true, step: next.step, reason: next.reason,
      shop_ref: shop.shop_ref, shop_id: shop.id, ...result,
    };
  } catch (err) {
    if (isLostRace(err)) {
      // Another runner advanced this shop between the snapshot and the write.
      // Nothing was written; the winner's step stands.
      return outcome(next.step, {
        claimed: false, stepped: false, from: shop.status,
        reason: 'another runner advanced this shop first; nothing was written',
        shop_ref: shop.shop_ref, shop_id: shop.id,
      });
    }
    return failShop(deps, snapshot, next, err);
  }
}

/**
 * Retire every command still outstanding against a terminal shop.
 *
 * LATCH commands are left alone - `receiveList` and `confirmInterpretation` are
 * permanent facts about the week ("this is where it came from", "a human
 * approved this"), and abandoning them would erase the record rather than tidy
 * it. Only commands that were waiting to be ACTED ON are retired.
 */
async function abandonOutstanding(deps, snapshot) {
  const shop = snapshot.shop;
  const retired = [];
  for (const c of snapshot.pendingCommands) {
    const spec = COMMAND_SPECS[c.command];
    if (!spec || spec.consumption !== CONSUMPTION.CONSUME) continue;
    try {
      await store.resolveCommand(deps, c.id, 'abandoned',
        `the shop was already ${shop.status} when this command came up for action`);
      retired.push(c.command);
    } catch { /* another pass retired it first; nothing to do */ }
  }
  return retired;
}

async function dispatchStep(deps, snapshot, next) {
  const shop = snapshot.shop;
  switch (next.step) {
    case STEPS.CANCEL: {
      const moved = await deps.shopStore.transition(
        shop.id, 'CANCELLED', next.command.payload.reason || 'cancelled by the human',
      );
      return { stepped: moved.changed, from: shop.status, to: 'CANCELLED' };
    }
    case STEPS.APPLY_CORRECTIONS:
      return stepApplyCorrections(deps, snapshot);
    case STEPS.RESUME: {
      // shopState permits FAILED -> ONLY the state it failed from, and
      // shopStore reads that from the durable failure event inside the same
      // transaction. Nothing here names the target.
      const moved = await deps.shopStore.transition(
        shop.id, next.to, `resumed from FAILED back to ${next.to}`,
      );
      return { stepped: moved.changed, from: 'FAILED', to: next.to };
    }
    case STEPS.TRANSCRIBE: {
      const moved = await deps.shopStore.transition(
        shop.id, 'TRANSCRIBING', 'reading the photograph of the list against the household catalogue',
      );
      return { stepped: moved.changed, from: shop.status, to: 'TRANSCRIBING' };
    }
    case STEPS.INTERPRET:
      return stepInterpret(deps, snapshot);
    case STEPS.PLAN:
      return stepPlan(deps, snapshot);
    case STEPS.REPLAN:
      return stepReplan(deps, snapshot);
    case STEPS.QUEUE_BROWSER_BUILD:
      return stepQueueBrowserBuild(deps, snapshot, next.command);
    case STEPS.PAUSE_BUILD:
      return stepPauseBuild(deps, snapshot, next.to);
    case STEPS.RECORD_CONFIRMATION:
      return stepRecordConfirmation(deps, snapshot, next.command);
    case STEPS.RECONCILE:
      return stepReconcile(deps, snapshot);
    default:
      throw new Error(`runPipeline: no handler for step "${next.step}"`);
  }
}

/**
 * A step failed. Park the shop VISIBLY and RESUMABLY.
 *
 * recordFailure writes the error, moves the shop to FAILED and emits a failure
 * event whose from_status IS the resume point - so `retryStage` can put the
 * shop back exactly where it was, and failing twice does not decay that target.
 * A failure message is queued so Warwick is TOLD: a supervised shop that
 * silently stalls is worse than one that fails loudly, because he would keep
 * waiting for a basket that is never coming.
 */
async function failShop(deps, snapshot, next, err) {
  const shop = snapshot.shop;
  const detail = String(err && err.message ? err.message : err);
  let failure = null;
  try {
    failure = await deps.shopStore.recordFailure(shop.id, detail);
  } catch (nested) {
    // The shop could not even be parked (it may already be terminal). Report
    // both, honestly, rather than swallowing one.
    return {
      ok: false, claimed: true, stepped: false, step: next.step,
      shop_ref: shop.shop_ref, shop_id: shop.id, from: shop.status, to: null,
      error: detail, park_error: String(nested && nested.message ? nested.message : nested),
    };
  }
  try {
    await store.enqueueMessage(deps, {
      householdId: shop.household_id, shopId: shop.id, kind: 'failure',
      key: outboxKeyFor(shop.shop_ref, `${next.step}:${failure.resume_from || 'unknown'}`),
      payload: { shopRef: shop.shop_ref, stage: shop.status, detail },
    });
  } catch { /* the outbox is best-effort; the failure itself is already durable */ }
  return {
    ok: false, claimed: true, stepped: false, step: next.step,
    shop_ref: shop.shop_ref, shop_id: shop.id,
    from: shop.status, to: 'FAILED',
    error: detail, resume_from: failure.resume_from,
  };
}

/**
 * Queue the one message this milestone deserves.
 *
 * MILESTONE-LEVEL ONLY. A message per list line would bury the two things that
 * actually need Warwick's attention under dozens of notifications and make the
 * phone unusable during a shop. The outbox key is the milestone, not the
 * moment, so a repeated advance cannot put the same card on his phone twice.
 */
async function queueMilestoneMessage(deps, snapshot, result) {
  const shop = snapshot.shop;
  const spec = messageForTransition(shop, result);
  if (!spec) return null;
  return store.enqueueMessage(deps, {
    householdId: shop.household_id,
    shopId: shop.id,
    kind: spec.kind,
    key: outboxKeyFor(shop.shop_ref, spec.discriminator || spec.kind),
    payload: spec.payload,
  });
}

/** PURE. Which card (if any) a completed step earns. */
export function messageForTransition(shop, result) {
  switch (result.to) {
    case 'NEEDS_DECISION':
    case 'READY_TO_SHOP':
      return {
        kind: 'plan_ready',
        discriminator: `plan.${result.to === 'NEEDS_DECISION' ? 'q' : 'ok'}`,
        payload: {
          shopRef: shop.shop_ref,
          listLines: result.plan_summary ? result.plan_summary.total_requested : null,
          resolved: result.plan_summary ? result.plan_summary.planned_add : null,
          needDecision: result.questions_open ?? null,
          excludedByRule: result.plan_summary ? result.plan_summary.excluded : null,
          substitutions: 'never auto-substitute',
        },
      };
    case 'WAITING_FOR_BROWSER':
      return {
        kind: 'progress',
        discriminator: 'browser.queued',
        payload: { shopRef: shop.shop_ref, stage: 'browser build requested' },
      };
    case 'ORDER_CONFIRMATION_RECEIVED':
      return {
        kind: 'confirmation_received',
        discriminator: 'confirmation',
        payload: { shopRef: shop.shop_ref, source: 'forwarded ASDA confirmation' },
      };
    case 'RECONCILED':
      return {
        kind: 'reconciliation_summary',
        discriminator: 'reconciled',
        payload: { shopRef: shop.shop_ref },
      };
    default:
      return null;
  }
}

export { STEPS, decideNextStep };
