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
import { questionKeyFor, intentKeyFor, sourceIdFor, outboxKeyFor, normaliseTerm } from './keys.js';
import * as store from './store.js';
import * as shopLines from './shopLines.js';

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
  if (shop.source_kind === 'photo') {
    if (!shop.raw_media_path) {
      throw new Error(`runPipeline: shop ${shop.shop_ref} is a photo shop with no raw_media_path - the raw evidence is missing`);
    }
    const prompt = deps.buildGroundedPrompt(catalogue);
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

  const plan = deps.planBasket({
    listItems,
    rules: inputs.rules,
    products: inputs.products,
    regulars: inputs.regulars,
    budget: inputs.budget,
    lastOrder: inputs.lastOrder,
    household: shop.household_id,
  });

  // The interpretation is the ONLY source of regulars ids on a candidate. See
  // planCandidates below for why that matters.
  const interpreted = await shopLines.listLines(deps, shop.id);
  const byReading = new Map(interpreted.map((l) => [normaliseTerm(l.raw_reading), l]));

  const held = plan.items.filter((it) => it.status === 'needs_decision');
  const opened = [];
  for (const line of held) {
    const key = questionKeyFor(line.item_name);
    const res = await deps.shopStore.openQuestion({
      shop_id: shop.id,
      question_key: key,
      question_text: `Which product is "${line.item_name}"?`,
      candidates: planCandidates(line, byReading.get(normaliseTerm(line.item_name)) || null),
    });
    opened.push({ key, created: res.created, already_answered: res.already_answered });
  }

  const openNow = await store.countOpenQuestions(deps, shop.id);
  const gate = planOutcome({
    openQuestions: openNow,
    needsReview: shop.needs_review === true,
    interpretationConfirmed: everIssued(snapshot, COMMANDS.CONFIRM_INTERPRETATION),
  });

  if (gate.to === null) {
    // Legally parked: the list needed review and nobody has confirmed it.
    return {
      stepped: false, step: gate.step, from: shop.status, to: null,
      reason: gate.reason, plan_summary: plan.summary, questions: opened,
    };
  }

  const moved = await deps.shopStore.transition(shop.id, gate.to, gate.reason);
  return {
    stepped: moved.changed, from: shop.status, to: gate.to,
    plan_summary: plan.summary, questions: opened,
    questions_open: openNow,
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

/** QUEUE THE BROWSER BUILD. Repeated taps RESUME the live request rather than
 *  queueing a second one - migration 006's partial unique index decides. */
async function stepQueueBrowserBuild(deps, snapshot, command) {
  const shop = snapshot.shop;
  const req = await deps.shopStore.requestBrowserBuild(shop.id);
  const moved = await deps.shopStore.transition(
    shop.id, 'WAITING_FOR_BROWSER',
    'browser build requested - a SUPERVISED runner will claim it; nothing autonomous ever does',
  );
  return {
    stepped: moved.changed, from: shop.status, to: 'WAITING_FOR_BROWSER',
    browser_request_id: req.request.id, request_created: req.created, command,
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
 * work package must not touch. planBasket is pure and deterministic, so given
 * the same durable inputs it reproduces the same plan - which is exactly what
 * makes recomputation honest rather than a guess.
 *
 * recordConfirmation is idempotent on (shop_id, content_fingerprint): the same
 * confirmation submitted twice writes nothing the second time.
 */
async function stepRecordConfirmation(deps, snapshot, command) {
  const shop = snapshot.shop;
  const catalogue = assertCatalogueLoaded(await deps.loadCatalogue(shop.household_id), 'reconciliation');
  const listItems = await store.listListItems(deps, shop.list_id);
  const inputs = await deps.loadPlanningInputs(shop.household_id);
  const plan = deps.planBasket({
    listItems,
    rules: inputs.rules,
    products: inputs.products,
    regulars: inputs.regulars,
    budget: inputs.budget,
    lastOrder: inputs.lastOrder,
    household: shop.household_id,
  });

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
    case STEPS.REPLAN: {
      const moved = await deps.shopStore.transition(
        shop.id, 'PROCESSING', 'every question is answered - re-planning with the answers in place',
      );
      return { stepped: moved.changed, from: shop.status, to: 'PROCESSING' };
    }
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
