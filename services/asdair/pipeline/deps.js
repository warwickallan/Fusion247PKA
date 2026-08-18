// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/deps.js
//
// THE WIRING. Every component the pipeline joins is reached through ONE
// injectable container, so:
//
//   * the real runtime binds the real modules, and
//   * the whole test suite binds fakes and runs FULLY OFFLINE - no database,
//     no Telegram, no ASDA, no model gateway, no credentials file.
//
// Nothing in commands.js, runPipeline.js or runtime.js imports a component
// directly. That is not tidiness: it is what makes "prove this without touching
// Warwick's household data" possible at all.
//
// ── CREDENTIALS ─────────────────────────────────────────────────────────────
// This module knows env var NAMES and nothing else. It never opens, parses,
// prints or inspects a credentials file; values arrive via `node --env-file=`.
//
//   ASDAIR_DB_URL         SELECT-only (asdair_ro)  - every read
//   ASDAIR_WRITE_DB_URL   asdair_rw                - every write
//   SHOPPER_BOT_TOKEN     SECRET                   - the ShopperBot account
//   SHOPPER_CHAT_ID                                - the control-surface chat
//   FUSION_MODEL_VISION                            - the grounded vision model
//
// The write URL is never read HERE: shopStore, recordConfirmation and
// updateRegulars each take it from the environment themselves, exactly as they
// already do. This module does not centralise a secret that is currently spread
// safely.
// =====================================================================

import { createRequire } from 'node:module';
import { decideNextStep } from './stages.js';

const require = createRequire(import.meta.url);

// CommonJS components, loaded through createRequire so the ESM pipeline and the
// CJS components can live side by side without either changing module system.
const shopStore = require('../shop/shopStore.js');
const shopState = require('../shop/shopState.js');
const shopStatus = require('../shop/shopStatus.js');
const { loadCatalogue } = require('../interpret/loadCatalogue.js');
const { buildGroundedPrompt } = require('../interpret/groundedPrompt.js');
const { resolveAll } = require('../interpret/resolveByCatalogue.js');
const { planBasket } = require('../skill/planner.js');
// The household's PROSE rulebook (B15-3). Only the prompt builder is needed
// here: `applyRulebook` is called by runPipeline.js, which owns the plan. This
// module owns exactly one thing about the rulebook - the model call.
const { buildRulebookPrompt } = require('../skill/rulebook.js');
// The SEMANTIC DECISION POINT (WO-2026-08-18-06). Only the prompt builder is
// needed here: `decideBasket` is called by runPipeline.js, which owns the plan.
// This module owns exactly one thing about the decision - the model call.
const { buildDecisionPrompt } = require('../skill/decide.js');
const { buildPayload } = require('../reconcile/record-confirmation.js');
const { recordConfirmation } = require('../reconcile/recordConfirmation.js');
const { updateRegulars } = require('../outcome/updateRegulars.js');

// ── WHY THE BROWSER HANDOFF SUBSYSTEM IS *NOT* IN THIS CONTAINER ────────────
//
// `buildExecutionPacket`, `buildHandoff`, `openHandoff` and `verifyBasket` are
// consumed on the live route (runPipeline.js stepQueueBrowserBuild, runtime.js
// realWiring) by DIRECT IMPORT, exactly as `store`, `shopLines` and
// `applyDecisionsToPlan` already are - and deliberately not through `deps`.
//
// The container exists for what needs configuration or I/O: a pool, a model
// call, a clock. These four are pure, or pure-over-an-injected-query
// (`openHandoff` takes `deps.writeQuery`, which IS in the container). Injecting
// a pure function buys nothing and costs the D-1 failure mode: a consumer
// reading `deps.X` that nothing binds resolves to undefined at runtime while
// every stubbed test passes. A static import cannot fail that way - it fails at
// load, everywhere, immediately.

/**
 * The decision vocabulary, imported from the module that owns it rather than
 * retyped, so the interpreter cannot drift from migration 017's CHECK.
 */
const { DECISION_KINDS } = require('./shopDecisions.js');

/**
 * SUPERSEDED 2026-08-09 (Warwick's ruling, WO-2026-08-09-B15-03).
 *
 * There used to be an `ANSWER_MODEL_LABEL` constant here reading
 * `fusion-gateway:reason:${FUSION_MODEL_REASON}`, because the answer path was
 * bound to the `reason` role. Warwick ruled that out in his own words:
 *
 *   "I chose bounded Terra deliberately for natural-language shopping-answer
 *    interpretation. Do NOT substitute `reason` because it is easier to reach.
 *    Do NOT widen the durable vocabulary so `reason` can become acceptable
 *    after the fact."
 *
 * So there is no module-level label any more, deliberately: what is recorded
 * in `shop_decision.interpreted_model` is `answerModel()` resolved AT CALL
 * TIME inside realInterpretAnswer. A constant captured at import could not
 * report a mid-life configuration change, and the row's whole job is to say
 * what actually answered.
 *
 * Migration 017 was NOT widened. `interpreted_by` stays 'terra' and is now
 * TRUE, rather than being made acceptable by loosening the vocabulary.
 */

// NOTE ON WHAT IS *NOT* IMPORTED HERE, AND WHY:
//   interpret/interpret-list.js, outcome/record-shop.js and shop/shop-cli.js
//   all call main() at module scope - they are CLIs, not libraries, and
//   importing one would run it (and process.exit) on import. So the pipeline
//   uses the libraries beneath them: resolveByCatalogue for identity,
//   recordConfirmation for the write, updateRegulars for the learning.
//   reconcile/record-confirmation.js IS importable (it guards on require.main).

/** Lazily-built read pool. `pg` is required only when a real read happens, so
 *  the whole pure surface loads on a box with no dependencies installed. */
let readPool = null;
function getReadPool() {
  if (readPool) return readPool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string as ASDAIR_DB_URL before running the pipeline.');
  }
  const { Pool } = require('pg');
  readPool = new Pool({ connectionString: url });
  return readPool;
}

let writePool = null;
function getWritePool() {
  if (writePool) return writePool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair WRITE connection string as ASDAIR_WRITE_DB_URL before running the pipeline.');
  }
  const { Pool } = require('pg');
  writePool = new Pool({ connectionString: url });
  return writePool;
}

/** Every read runs inside BEGIN TRANSACTION READ ONLY - belt and braces on top
 *  of the SELECT-only role, exactly as skill/data.js and shopStatus.js do. */
async function realReadQuery(sql, params) {
  const client = await getReadPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The write path this module opens for the two tables shopStore does not own:
 *
 *   asdair.shop_line        migration 008 - the durable interpretation. Every
 *                           statement is built in shopLines.js from a column
 *                           allowlist.
 *   asdair.pipeline_command migration 009 - the MACHINE ledger (commands,
 *                           resume state, outbox), which since 009 is a
 *                           different table from asdair.pending_action, the
 *                           list of things WARWICK must do. Every statement is
 *                           a named constant in store.js.
 *
 * There is no DELETE among them, and neither table is written anywhere else.
 */
async function realWriteQuery(sql, params) {
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/** The household catalogue, loaded read-only. THE precondition of every
 *  interpretation - see runPipeline.assertCatalogueLoaded. */
async function realLoadCatalogue(householdId) {
  const client = await getReadPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const catalogue = await loadCatalogue(client, Number(householdId));
    await client.query('COMMIT');
    return catalogue;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The vision model id ACTUALLY resolved for a grounded photo interpretation -
 * read at call time, exactly as `answerModel()` (services/obsidiwikai/src/
 * core/models.mjs) already does for the answer role, and for the same
 * reason: a durable provenance row must say what actually answered, not a
 * literal frozen at some earlier point that env resolution could since have
 * moved past. Never hardcoded (WP-B15-22 Gate Zero - Warwick: do not write
 * "gpt-5-mini" here, resolve it the same way the codebase already does).
 */
async function realVisionModel() {
  const { ROLE_ALIAS } = await import('../../obsidiwikai/src/core/models.mjs');
  return ROLE_ALIAS.vision;
}

/**
 * Prepare the photograph for ONE vision request, and report what was done.
 *
 * Lazily imported for the same reason `pg` is: the pure command surface and the
 * whole offline suite must stay loadable on a box where no dependency has been
 * installed. `jimp` is only reached when a real photograph is really being read.
 */
async function realPrepareImage(imagePath) {
  const { prepareImage } = await import('../transcribe/prepareImage.js');
  return prepareImage(imagePath);
}

/**
 * ONE grounded vision request. Not a daemon, not a conversation, not an agent.
 *
 * The prompt is built from the catalogue by groundedPrompt.js and asks the model
 * for a raw_reading per line. The model's own candidate id is deliberately
 * IGNORED for identity: resolveByCatalogue decides that from our rows, so a
 * product that does not exist cannot reach a basket whatever the model claims.
 *
 * A single strict-JSON retry is allowed, and no more. That is a formatting
 * repair, not a second opinion.
 */
async function realInterpretPhoto({ prompt, imagePath, imageDataUrl = null }) {
  // ── THE PIXELS THE MODEL IS GIVEN ARE PART OF THE REQUEST ────────────────
  // Telegram's largest size for Mum's list is 720 x 1280 - roughly 34 pixels
  // per handwritten line - and at that size the model stopped failing honestly
  // and produced a plausible product instead: "2 sliced roast beef" came back
  // as "2 skinny cow bars". transcribe/prepareImage.js lifts the short edge
  // over a MEASURED floor and never rotates; the arm-by-arm measurement,
  // including the rotation arms that LOST whole lines, is in its header.
  //
  // stepInterpret normally prepares the image itself, so that what was done can
  // be recorded durably. Preparing again here when it did not is deliberate:
  // there is exactly ONE way an image reaches the model, and no caller can send
  // raw 720px pixels by forgetting a step.
  const dataUrl = imageDataUrl
    || (await (await import('../transcribe/prepareImage.js')).prepareImage(imagePath)).dataUrl;

  const { vision } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');

  let parsed = await extractJson(await vision(prompt, dataUrl));
  if (!parsed || !Array.isArray(parsed.lines)) {
    parsed = await extractJson(await vision(
      `${prompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`, dataUrl,
    ));
  }
  if (!parsed || !Array.isArray(parsed.lines)) {
    throw new Error('pipeline: the grounded vision request did not return usable JSON');
  }
  return parsed.lines.map((l, i) => ({
    line_no: l.line_no ?? i + 1,
    raw_reading: String(l.raw_reading ?? '').trim(),
    quantity: Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : null,
    // ── THE PACK SIZE, WHICH IS NOT AN ORDER QUANTITY (2026-08-17) ───────
    // "2 x 4pk orange sport Lucozade" carries TWO numbers meaning different
    // things, and collapsing them cost half of Mum's drinks. The prompt now
    // asks for them separately, so this carries the second one through rather
    // than leaving every downstream reader to re-derive it from prose.
    // IDENTITY uses it - a 6pk of beans is not a single tin - and the order
    // quantity never does. Pass-through only: no default, no inference.
    pack_size: Number.isInteger(l.pack_size) && l.pack_size > 1 ? l.pack_size : null,
    // ── GATE ZERO (WP-B15-22) ────────────────────────────────────────────
    // groundedPrompt.js EXPLICITLY asks for these two fields per line
    // (confidence 0.0-1.0, and status "unreadable" when the model cannot
    // read something) and until this fix they were dropped here, before
    // ever reaching resolveByCatalogue.js or shop_line.match_confidence -
    // asked for, almost certainly returned, and thrown away in this mapping.
    // Passed through FAITHFULLY: a missing/non-numeric confidence becomes
    // `null` (never invented, never defaulted to 1.0 - that decision belongs
    // to whoever GATES on it, not to this pass-through), and the model's own
    // status string is carried as-is rather than re-interpreted here.
    confidence: Number.isFinite(Number(l.confidence)) ? Number(l.confidence) : null,
    model_status: typeof l.status === 'string' && l.status.trim() !== '' ? l.status.trim() : null,
  }));
}

/**
 * Execute add_list_item intents against the real list, in ONE transaction.
 *
 * asdairCommands.execute takes pg_advisory_xact_lock, which is only meaningful
 * inside a transaction - so the transaction boundary is opened here rather than
 * left to chance. A partial write is impossible: either every line of the list
 * lands or none does.
 */
async function realExecuteIntents(intents, { householdId }) {
  const asdairCommands = await import('../../control-plane/wp-d-proof/asdairCommands.mjs');
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');
    let listId = null;
    const results = [];
    for (const intent of intents) {
      const res = await asdairCommands.execute(client, intent.command, { ...intent.args, household: householdId });
      if (!res.ok) throw new Error(`pipeline: ${intent.command} refused: ${res.error}`);
      listId = res.list_id;
      results.push(res);
    }
    await client.query('COMMIT');
    return { listId, results };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * services/asdair/skill/data.js is the ONE component here that requires `pg`
 * EAGERLY, at module scope. Loading it lazily keeps this whole module - and
 * therefore the pure command surface, the stage table and the entire offline
 * test suite - importable on a box with no dependencies installed, which is the
 * same discipline shopStore.js and shopStatus.js already apply to themselves.
 */
let skillDataModule = null;
function skillData() {
  if (!skillDataModule) skillDataModule = require('../skill/data.js');
  return skillDataModule;
}

/**
 * Everything planBasket needs, all of it read-only.
 *
 * ── priorAnswers: asdair.rule_qa_log, which the planner never used to read ──
 * loadRuleQaLog is SELECT-only inside a read-only transaction, scoped to the
 * named household PLUS global (household_id IS NULL) rows. planBasket takes it
 * as OPTIONAL and ADDITIVE: with none supplied, planning is byte-for-byte what
 * it was.
 *
 * NOTE WHAT IS DELIBERATELY *NOT* HERE: a `.catch(() => [])`. budget and
 * lastOrder swallow their errors because a shop can genuinely plan without
 * them. Prior answers are different in kind - they are the entire mechanism by
 * which an answer Warwick gave on 6 July stops the same question being asked on
 * 3 August. A swallowed failure here would leave the loop LOOKING wired while
 * silently planning as though nothing had ever been answered, which is
 * indistinguishable from the defect this wiring exists to close. It fails loudly
 * instead.
 */
async function realLoadPlanningInputs(householdId) {
  const skill = skillData();
  const [rules, products, regulars, budget, lastOrder, priorAnswers] = await Promise.all([
    skill.loadRules(),
    skill.loadProducts(),
    skill.loadRegulars(householdId),
    skill.loadBudget(householdId).catch(() => null),
    skill.loadLastOrder(householdId).catch(() => null),
    skill.loadRuleQaLog(householdId),
  ]);
  return { rules, products, regulars, budget, lastOrder, priorAnswers };
}

/**
 * THE LEARNING ARC, conservatively wired.
 *
 * Confirmed outcomes enrich aliases: a line whose raw reading resolved to a
 * regular by anything WEAKER than an exact alias is exactly the case where the
 * household's shorthand is missing from the catalogue, and adding it is what
 * makes next week's read better. `add_aka` can only ever ADD - updateRegulars
 * merges against what it reads in the same transaction and refuses a lost
 * update - so this can never destroy prior learning.
 *
 * DELIBERATELY NOT WIRED HERE: promoteDecision, which turns a human answer into
 * a STANDING RULE that changes every future basket forever. That needs the
 * provenance proving the instruction was explicit, and the pipeline does not
 * currently capture "and this applies going forward" as a distinct human act.
 * Guessing it would be exactly the ambiguous-inference failure promoteDecision's
 * own provenance guard exists to stop. It stays with record-shop.js until the
 * command surface can carry the intent honestly.
 */
async function realRecordLearning({ shop, deps }) {
  const errors = [];
  let applied = 0;
  let attempted = 0;
  const res = await deps.readQuery(
    `SELECT id, product_name, matched_regular_id, note
       FROM asdair.order_confirmation_line
      WHERE confirmation_id = (SELECT id FROM asdair.order_confirmation
                                WHERE shop_id = $1 ORDER BY id DESC LIMIT 1)
        AND matched_regular_id IS NOT NULL`, [shop.id],
  );
  for (const line of (res && res.rows) || []) {
    attempted += 1;
    try {
      await updateRegulars({
        op: 'enrichRegular',
        id: line.matched_regular_id,
        add_aka: [String(line.product_name)],
      });
      applied += 1;
    } catch (err) {
      // Learning NEVER fails a shop that otherwise reconciled correctly.
      errors.push(String(err && err.message ? err.message : err));
    }
  }
  return { attempted, applied, errors };
}

/**
 * THE ANSWER-LEARNING WRITER. The join that was missing on 2026-08-03.
 *
 * outcome/buildAnswerLearning.js turns one settled answer into a write plan and
 * outcome/recordAnswerLearning.js performs it - decision event, rule_qa_log row,
 * aliases (including the photographed wording), new-product identity, and the
 * Regulars/Favourites pending action. Both were complete, both were tested, and
 * until now NOTHING CALLED EITHER OF THEM.
 *
 * ── THIS DEPENDENCY WIDENS A SHAPE, AND THAT IS STATED RATHER THAN HIDDEN ───
 * Every other write in this container goes through `writeQuery` (one statement,
 * its own transaction) or through a component that owns its own pool.
 * recordAnswerLearning needs an actual CONNECTED pg CLIENT: asdair.pending_action
 * has no writer of its own, so the module has no pool to take one from and says
 * so by failing loudly. So this function takes one from the write pool that
 * already exists here, hands it over, and releases it in a `finally`.
 *
 * It does NOT open a transaction. Each underlying writer (promoteDecision,
 * updateRegulars) still owns its own BEGIN/COMMIT exactly as it does today, so
 * no existing atomicity guarantee is changed and none is nested. The client is
 * shared so that a multi-step answer is written through one connection, which is
 * the convention recordAnswerLearning documents.
 *
 * FAILURES PROPAGATE. realRecordLearning() below swallows errors on purpose -
 * enriching an alias must never fail a shop that otherwise reconciled. This is
 * the opposite case and recordAnswerLearning.js argues it at length: a swallowed
 * failure on the path whose entire purpose is that an answer survives the week
 * is indistinguishable from the bug, and would be discovered next Sunday when
 * Warwick is asked the same question again.
 */
/**
 * INTERPRET ONE FREE-TEXT ANSWER, BOUNDED AND GROUNDED (WP-B15-2).
 *
 * The other half of the outcome sentence. A tap resolves deterministically and
 * spends nothing; only free text reaches here, and only ever ONE answer at a
 * time. Reached through the same gateway route the photo interpreter uses -
 * FUSION_GATEWAY_URL via obsidiwikai - so there is no second credential path
 * and no configuration this file owns.
 *
 * ── WHAT IT IS GIVEN, AND WHAT IT IS NOT ────────────────────────────────────
 * Exactly the packet runPipeline's buildAnswerGrounding assembled: the
 * original photographed/list wording, the exact question, Warwick's exact
 * answer, the candidates that were offered, the catalogue identities in play,
 * and the applicable household rules. It is not given the shop, the database,
 * the other lines, or anything it could use to decide something it was not
 * asked about.
 *
 * ── IT MAY ONLY NAME A PRODUCT IT WAS SHOWN, AND THE PROMPT IS NOT THE
 *    ENFORCEMENT ─────────────────────────────────────────────────────────────
 * The prompt says so, and the prompt is the weakest of the three guards. The
 * real ones are downstream and do not depend on the model cooperating:
 * `buildDecision` refuses a shape that decides nothing while claiming to, and
 * `shop_decision.decided_regular_id` is a genuine FOREIGN KEY to
 * asdair.regulars - so an invented product is refused by the DATABASE. That is
 * why the id set is also filtered here before the row is built: three guards,
 * none of them trusting the model's good intentions.
 *
 * ── UNKNOWN MEANS ASK AGAIN ─────────────────────────────────────────────────
 * There is no least-bad match anywhere on this path. Anything the model cannot
 * settle - an unparseable return, a kind outside the vocabulary, an id it was
 * never shown - becomes `clarification_required`, which opens a real follow-up
 * question rather than putting a guess in the basket. A failure to interpret
 * degrades to another human question; it never degrades to a wrong product.
 */
async function realInterpretAnswer(grounding) {
  // ── BOUND TO TERRA, NOT TO `reason` ───────────────────────────────────────
  // Warwick chose Terra deliberately for interpreting a natural-language
  // shopping answer and ruled it must not be substituted with `reason` because
  // `reason` is easier to reach. `answer()` is gateway-only and THROWS where
  // no gateway is configured - it never falls back to the box - so the ruling
  // is enforced by the call, not by a comment asking nicely.
  const { answer, answerModel } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');

  // THE ALIAS ACTUALLY INVOKED, resolved at CALL TIME - never a name we hoped
  // was invoked. If the box points FUSION_MODEL_ANSWER elsewhere, the durable
  // row says what really answered, which is the entire reason it is recorded.
  const invoked = answerModel();

  // UNKNOWN MEANS ASK AGAIN. Every degraded path below lands on this.
  const unreadable = (why) => ({
    decision_kind: 'clarification_required', clarification_reason: why,
    decided_regular_id: null, decided_quantity: null, decided_item_name: null,
    forward_intent: null, model: invoked,
  });

  // The ONLY ids the model is permitted to assert, taken from the evidence it
  // is actually given. Anything outside this set is treated as not understood.
  const offered = Array.isArray(grounding.candidates) ? grounding.candidates : [];
  const allowedIds = new Set(
    offered.map((c) => (c && c.regular_id !== undefined && c.regular_id !== null ? Number(c.regular_id) : null))
      .filter((v) => v !== null),
  );
  for (const r of (Array.isArray(grounding.regulars) ? grounding.regulars : [])) {
    if (r && r.id !== undefined && r.id !== null) allowedIds.add(Number(r.id));
  }

  const catalogue = [...allowedIds].map((id) => {
    const fromCandidates = offered.find((c) => c && Number(c.regular_id) === id);
    const fromRegulars = (grounding.regulars || []).find((r) => r && Number(r.id) === id);
    return { regular_id: id, name: (fromCandidates && fromCandidates.label) || (fromRegulars && fromRegulars.name) || null };
  });

  const prompt = [
    'You are interpreting ONE answer a person gave about ONE line of this week\'s shopping list.',
    'Return ONLY valid JSON. No prose, no markdown, no code fences.',
    '',
    `The line as originally written: ${JSON.stringify(grounding.original_wording)}`,
    `The question they were asked: ${JSON.stringify(grounding.question_text)}`,
    `Their exact answer: ${JSON.stringify(grounding.answer_text)}`,
    '',
    'The ONLY products you may name, with the id you must use for each:',
    JSON.stringify(catalogue),
    '',
    'Household rules that apply:',
    JSON.stringify((grounding.rules || []).map((r) => (r && r.text) || (r && r.rule) || r)),
    '',
    'Return this shape:',
    '{"decision_kind":"existing_regular|quantity_change|variant_choice|new_item|skip_this_week|clarification_required",',
    ' "decided_regular_id": <id from the list above, or null>,',
    ' "decided_quantity": <integer 1-999, or null>,',
    ' "decided_item_name": <string, ONLY for new_item, else null>,',
    ' "clarification_reason": <string, ONLY for clarification_required, else null>,',
    ' "forward_intent": "yes"|"no"|"unclear"|null}',
    '',
    'RULES:',
    '- You may ONLY use a regular_id from the list above. Never invent one.',
    '- If you cannot tell which product they mean, return clarification_required',
    '  with a short reason. NEVER pick the closest match.',
    '- forward_intent records whether they also said to do this every week from',
    '  now on. null means they said nothing about it; "unclear" means they did',
    '  and you could not read it.',
  ].join('\n');

  // A single strict-JSON retry, and no more. That is a formatting repair, not
  // a second opinion - the same rule realInterpretPhoto follows.
  let parsed = await extractJson(await answer(prompt));
  if (!parsed || typeof parsed !== 'object' || typeof parsed.decision_kind !== 'string') {
    parsed = await extractJson(await answer(
      `${prompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`,
    ));
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.decision_kind !== 'string') {
    return unreadable('the interpreter did not return a usable structured answer');
  }
  if (!DECISION_KINDS.includes(parsed.decision_kind)) {
    return unreadable(`the interpreter returned an unknown decision kind (${String(parsed.decision_kind).slice(0, 40)})`);
  }

  const id = parsed.decided_regular_id === null || parsed.decided_regular_id === undefined
    ? null : Number(parsed.decided_regular_id);
  // THE GROUNDING CHECK. An id it was never shown is not a product we stock as
  // far as this answer is concerned - so it is not understood, not corrected.
  if (id !== null && !allowedIds.has(id)) {
    return unreadable('the interpreter named a product it was not shown');
  }

  return {
    decision_kind: parsed.decision_kind,
    decided_regular_id: id,
    decided_quantity: parsed.decided_quantity ?? null,
    decided_item_name: parsed.decided_item_name ?? null,
    clarification_reason: parsed.clarification_reason ?? null,
    forward_intent: parsed.forward_intent ?? null,
    model: invoked,
  };
}

/**
 * WHICH open question did this bare typed message answer? (WP-B15-A1)
 *
 * ── A DIFFERENT JOB FROM realInterpretAnswer, AND THE TWO MUST NOT MERGE ─────
 * interpretAnswer is handed ONE question and asked what the answer MEANS. This
 * is handed EVERY open question and asked WHICH of them the words were aimed at.
 * It decides nothing about a product: it only says "these words belong to that
 * question", and the existing decision spine then interprets each mapped answer
 * exactly as it always has. Correlation and interpretation are separate steps
 * and stay separate — collapsing them would put a correlation guess inside a
 * product decision, where it would be invisible.
 *
 * ── PER-QUESTION, WHICH IS THE ENTIRE POINT ─────────────────────────────────
 * The return is an ARRAY, one entry per question the message actually addressed.
 * One message covering three open questions must be able to settle two of them
 * durably while the third falls to a clarification. A single-verdict return
 * would let one unreadable fragment discard two perfectly good answers, which is
 * the failure this shape exists to make impossible.
 *
 * ── NOTHING IS GUESSED, AND `confidence` IS ABOUT CORRELATION ───────────────
 * `confidence` says how sure the model is that the words were aimed at THAT
 * question — it says nothing about whether the answer is understandable. Only a
 * `high` correlation is ever claimed by the caller. A question the model does
 * not mention is simply not mapped and stays open; text belonging to no question
 * comes back as `unmapped_text`. There is no least-bad correlation here, exactly
 * as there is no least-bad match in realInterpretAnswer.
 *
 * @param {{answer_text:string, questions:{question_key:string, question_text:string,
 *          item_name?:string, candidates?:{label?:string}[]}[]}} grounding
 * @returns {Promise<{mappings:{question_key:string, answer_text:string,
 *                    confidence:'high'|'low'}[], unmapped_text:string|null, model:*}>}
 */
async function realCorrelateAnswer(grounding) {
  // ── BOUND TO TERRA, FOR THE SAME REASON interpretAnswer IS ────────────────
  // Warwick ruled that reading a natural-language shopping answer is Terra's
  // job and must not be substituted with `reason` because `reason` is easier to
  // reach. `answer()` is gateway-only and THROWS where no gateway is configured
  // - it never falls back to the box - so the ruling is enforced by the call.
  const { answer, answerModel } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');
  const invoked = answerModel();

  const open = Array.isArray(grounding && grounding.questions) ? grounding.questions : [];
  const text = grounding && grounding.answer_text !== undefined && grounding.answer_text !== null
    ? String(grounding.answer_text) : '';

  // The ONLY keys the model may name. Anything else is not a question we asked,
  // and naming one is treated as not understood rather than corrected - the same
  // grounding check realInterpretAnswer applies to regular ids.
  const allowedKeys = new Set(
    open.map((q) => (q && typeof q.question_key === 'string' ? q.question_key : null))
      .filter((k) => k !== null && k !== ''),
  );
  // NOTHING OPEN MEANS NOTHING TO CORRELATE. Never a model call, never a claim.
  if (allowedKeys.size === 0 || text.trim() === '') {
    return { mappings: [], unmapped_text: null, model: invoked };
  }

  const asked = open
    .filter((q) => q && allowedKeys.has(q.question_key))
    .map((q) => ({
      question_key: q.question_key,
      about: q.item_name || null,
      question: q.question_text || null,
      options: (Array.isArray(q.candidates) ? q.candidates : [])
        .map((c) => (c && c.label !== undefined && c.label !== null ? String(c.label) : null))
        .filter((l) => l !== null && l !== ''),
    }));

  const prompt = [
    'A person was asked several questions about this week\'s shopping list, and',
    'has replied with ONE message. Work out which questions that message answers.',
    'Return ONLY valid JSON. No prose, no markdown, no code fences.',
    '',
    `Their exact message: ${JSON.stringify(text)}`,
    '',
    'The questions currently open, with the key you must use for each:',
    JSON.stringify(asked),
    '',
    'Return this shape:',
    '{"mappings":[{"question_key":<key from the list above>,',
    '              "answer_text":<the part of their message that answers it>,',
    '              "confidence":"high"|"low"}],',
    ' "unmapped_text": <any part of the message that answers none of them, or null>}',
    '',
    'RULES:',
    '- You may ONLY use a question_key from the list above. Never invent one.',
    '- Include a question ONLY if the message genuinely addresses it. A question',
    '  the message says nothing about is simply left out; it stays open.',
    '- "high" means you are sure the words were aimed at THAT question. Use "low"',
    '  when the message might be about it but you cannot tell. NEVER pick the',
    '  closest question just to have an answer.',
    '- confidence is about WHICH QUESTION the words belong to, not about whether',
    '  you understand the answer itself. An answer aimed unmistakably at one',
    '  question is "high" even when its meaning is unclear.',
    '- answer_text is THEIR wording for that question, copied, never paraphrased',
    '  and never resolved to a product.',
    '- If the message looks like a new shopping list rather than an answer,',
    '  return an empty mappings array.',
  ].join('\n');

  // A single strict-JSON retry, and no more. That is a formatting repair, not a
  // second opinion - the same rule realInterpretAnswer and realInterpretPhoto follow.
  let parsed = await extractJson(await answer(prompt));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.mappings)) {
    parsed = await extractJson(await answer(
      `${prompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`,
    ));
  }

  // UNREADABLE MEANS NOTHING IS CLAIMED. A correlation that could not be made is
  // not an error and never a guess: the caller does not claim the message, so it
  // reaches intake exactly as it does today. Failing towards "not mine" is the
  // only safe direction, because the alternative is eating a real shopping list.
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.mappings)) {
    return { mappings: [], unmapped_text: text, model: invoked };
  }

  const mappings = [];
  const seen = new Set();
  for (const m of parsed.mappings) {
    if (!m || typeof m !== 'object') continue;
    const key = typeof m.question_key === 'string' ? m.question_key : '';
    // THE GROUNDING CHECK, and the duplicate guard. A key it was never shown is
    // dropped, not corrected; a key named twice settles once.
    if (!allowedKeys.has(key) || seen.has(key)) continue;
    const mapped = m.answer_text === null || m.answer_text === undefined ? '' : String(m.answer_text).trim();
    if (mapped === '') continue;
    seen.add(key);
    mappings.push({
      question_key: key,
      answer_text: mapped,
      // Anything that is not explicitly "high" is treated as low. An absent,
      // misspelled or invented confidence must never read as certainty.
      confidence: m.confidence === 'high' ? 'high' : 'low',
    });
  }

  const leftover = parsed.unmapped_text === null || parsed.unmapped_text === undefined
    ? null : (String(parsed.unmapped_text).trim() || null);

  return { mappings, unmapped_text: leftover, model: invoked };
}

async function realRecordAnswerLearning(answer) {
  const { recordAnswerLearning } = require('../outcome/recordAnswerLearning.js');
  const client = await getWritePool().connect();
  try {
    return await recordAnswerLearning(answer, { client });
  } finally {
    client.release();
  }
}

/**
 * THE HOUSEHOLD'S JUDGEMENT RULES, READ BY TERRA (WP-B15-3).
 *
 * ── WHAT THIS CLOSES ────────────────────────────────────────────────────────
 * `skill/planner.js actionableRules()` drops every `info` row and every row
 * with no match_term/match_category - on the live corpus, 23 of 39 active
 * rules, and not a random subset: precisely the JUDGEMENT layer. "Pick the best
 * value by price per wash", "buy up to the offer quantity", "round it up to
 * complete a pair" have been active for weeks and have never once fired.
 * `skill/rulebook.js` was built to carry them AS PROSE and, until this binding,
 * was reachable only from its own two test files. This is the seam that makes
 * it production code.
 *
 * ── BOUND TO TERRA, FOR THE SAME REASON interpretAnswer AND correlateAnswer
 *    ARE ────────────────────────────────────────────────────────────────────
 * Warwick ruled that reading the household's natural language is Terra's job
 * and must NOT be substituted with `reason` because `reason` is easier to
 * reach. `answer()` is gateway-only and THROWS where no gateway is configured -
 * it never falls back to the box - so the ruling is enforced by the call rather
 * than by a comment asking nicely. Same gateway, same route, no second
 * credential path and no configuration this file owns.
 *
 * ── NO SECOND LAYER OF ERROR HANDLING HERE, DELIBERATELY ────────────────────
 * A throw from this function is ALREADY caught inside `applyRulebook`: no line
 * changes, every affected line is flagged `rulebook not consulted`, and
 * `audit.error` records why. Catching it here as well would convert a visible
 * degradation into a silent one, which is the failure the module was written to
 * prevent. A reply this module cannot read is handled the same way - the parser
 * returns null and the module treats that as "the consumer said nothing",
 * NEVER as "the consumer approved the plan".
 *
 * PROMPT AND GROUNDING ARE NOT BUILT HERE. `buildRulebookPrompt` owns the
 * wording and the safety envelope it states; this function is the wire.
 *
 * @param {object} grounding the packet buildRulebookGrounding assembled
 * @returns {Promise<object|null>} the parsed reply, or null when unreadable
 */
async function realConsultRulebook(grounding) {
  const { answer } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');
  return extractJson(await answer(buildRulebookPrompt(grounding)));
}

/**
 * THE SEMANTIC DECISION CALL. The wire, and nothing else.
 *
 * `buildDecisionPrompt` owns the wording and the safety envelope it states, and
 * `decideBasket` owns the grounding, the validation of every id that comes back
 * and the refusal to proceed without a contract. This function is the model
 * call, exactly as `realConsultRulebook` above is - deliberately its sibling,
 * so neither carries a product instruction of its own.
 *
 * ── WHY THE `answer` ROLE AND NOT `reason` ────────────────────────────────
 * Because Warwick ruled on precisely this temptation (WO-2026-08-09-B15-03):
 * "Do NOT substitute `reason` because it is easier to reach." That ruling was
 * about the answer-interpretation path rather than this one, so it does not
 * decide this call - but reaching for the role a standing instruction warned
 * against, unasked, is not an implementer's decision to make. This uses the
 * role the household's existing judgement call already uses. Moving it is a
 * product decision, and it is recorded here as one rather than taken quietly.
 *
 * A failure here is NOT caught. `decideBasket` converts it into a
 * DecisionUnavailableError and the step fails loudly, because the only
 * alternative - carrying on without a decision - is the word-overlap scoring
 * this build exists to remove.
 */
async function realDecideBasket(grounding) {
  const { answer } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');
  return extractJson(await answer(buildDecisionPrompt(grounding)));
}

/** The model id that ACTUALLY answered, resolved at call time - never a literal
 *  frozen at import, for the same reason `answerModel()` is read at call time
 *  everywhere else: a durable provenance row must say what really answered. */
async function realDecisionModel() {
  const { answerModel } = await import('../../obsidiwikai/src/core/models.mjs');
  return answerModel();
}

/** The hard allowlist, imported from the route that owns it so the two cannot
 *  drift. add-to-draft-list is the ONLY command that can reach the database. */
async function realAssertAllowedIntents(intents) {
  const { ALLOWED_SHOPPER_COMMANDS } = await import('../../hub/shopper/shopperRoute.mjs');
  for (const i of intents) {
    if (!ALLOWED_SHOPPER_COMMANDS.includes(i.command)) {
      throw new Error(`pipeline: refusing a non-allowlisted command "${i.command}" - the surface is add-to-draft-list only (no checkout, no payment, no substitution)`);
    }
  }
  return intents;
}

/**
 * Build the real dependency container.
 *
 * Every member is overridable, which is how the test suite runs offline. The
 * defaults are the REAL components - nothing here is a stub in production.
 */
export function createDeps(overrides = {}) {
  const base = {
    // durable state
    shopStore,
    shopState,
    readQuery: realReadQuery,
    writeQuery: realWriteQuery,
    getShopStatus: (handle, opts) => shopStatus.getShopStatus(handle, opts),

    // interpretation - catalogue FIRST, always
    loadCatalogue: realLoadCatalogue,
    buildGroundedPrompt,
    // MAKE THE HANDWRITING RESOLVABLE BEFORE ANYTHING READS IT. A container
    // member rather than a detail inside interpretPhoto, because stepInterpret
    // has to record WHAT WAS DONE - on 17 August nobody could tell a good read
    // from a lucky one, since nothing anywhere recorded the pixels the model
    // was actually given.
    prepareImage: realPrepareImage,
    interpretPhoto: realInterpretPhoto,
    visionModel: realVisionModel,
    resolveAll,

    // list -> intents -> real rows
    shopperRoute: async (payload, opts) => {
      const { shopperRoute } = await import('../../hub/shopper/shopperRoute.mjs');
      return shopperRoute(payload, opts);
    },
    assertAllowedIntents: realAssertAllowedIntents,
    executeIntents: realExecuteIntents,

    // planning - MECHANICAL ONLY since WO-2026-08-18-06. planBasket performs
    // exact, unambiguous catalogue lookups, exclusions, quantities and budget.
    // It does not choose among candidates and it does not decide identity.
    planBasket,
    loadPlanningInputs: realLoadPlanningInputs,

    // ⭐ THE SEMANTIC DECISION. Bound here and nowhere else. An unbound `decide`
    // does not silently degrade to the deterministic scorer - decideBasket
    // throws, which is the whole point of Veritas Gate 2's correction.
    decide: realDecideBasket,
    decisionModel: realDecisionModel,

    // the answer -> current-shop decision seam (WP-B15-2).
    // A tap never reaches this; only free text does. Without this binding a
    // button resolves in production and free text CANNOT, which is half the
    // outcome this Work Package exists to deliver (Veritas D-1).
    interpretAnswer: realInterpretAnswer,

    // WHICH open question a bare typed message answered (WP-B15-A1). A separate
    // binding from interpretAnswer on purpose: that one is handed ONE question
    // and reads the answer, this one is handed EVERY open question and works out
    // which the words were aimed at. Without it a plain message can only be read
    // when exactly one question is open, and Warwick's "answer them all in one
    // message" cannot work at all.
    correlateAnswer: realCorrelateAnswer,

    // THE PROSE RULEBOOK'S REASONING CONSUMER (WP-B15-3). Without this binding
    // `applyRulebook` throws the moment a real household rule speaks about a
    // real basket, and the 23 judgement rules stay exactly where they have been
    // for weeks: on the floor. A deps.X that nothing binds is undefined at
    // runtime while every stubbed test passes - which is Veritas D-1, and the
    // reason productionWiring.test.js asks the REAL container rather than a stub.
    consult: realConsultRulebook,

    // confirmation + learning
    buildConfirmationPayload: buildPayload,
    recordConfirmation: (confirmation) => recordConfirmation(confirmation),
    recordLearning: realRecordLearning,
    recordAnswerLearning: realRecordAnswerLearning,

    // the pure stage table, injected so getStatus can report the next step
    decideNextStep,

    // diagnostics
    log: () => {},
  };
  return { ...base, ...overrides };
}

/** Close every pool this module opened. Call once when a run finishes. */
export async function closeDeps() {
  const closers = [
    readPool ? readPool.end() : null,
    writePool ? writePool.end() : null,
    shopStore.close(),
    shopStatus.close(),
    // Only if it was ever loaded - closing a pool that was never opened would
    // pull `pg` in purely to shut it down.
    skillDataModule ? skillDataModule.close() : null,
  ].filter(Boolean);
  readPool = null;
  writePool = null;
  await Promise.allSettled(closers);
}
