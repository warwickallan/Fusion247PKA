// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/harness.js
//
// A FULLY-WIRED, FULLY-OFFLINE PIPELINE.
//
// What is REAL in here (this matters - it is the difference between testing the
// join and testing a mock of the join):
//   * services/asdair/shop/shopStore.js        the durable writer, verbatim
//   * services/asdair/shop/shopState.js        the state machine, verbatim
//   * services/hub/shopper/shopperRoute.mjs    list -> intents, verbatim
//   * services/control-plane/.../asdairCommands.mjs  intents -> rows, verbatim
//   * services/asdair/interpret/resolveByCatalogue.js  IDENTITY, verbatim
//   * services/asdair/interpret/groundedPrompt.js      the prompt, verbatim
//   * services/asdair/skill/planner.js         the planner, verbatim
//   * services/asdair/bot/*                    render + route, verbatim
//
// What is FAKE:
//   * `pg`                 an in-memory database with the real unique indexes
//   * the model gateway    an injected function that returns scripted readings
//   * Telegram             an injected client; no token, no network, no fetch
//   * the catalogue        a synthetic household catalogue in the same shape
//                          loadCatalogue returns
//
// NO DATABASE. NO NETWORK. NO CREDENTIALS FILE IS OPENED OR READ. Every token
// that appears anywhere in the suite is an obvious fake.
//
// Test support only. Synthetic fixtures; never real household data.
// =====================================================================

import { createRequire } from 'node:module';
import { createFakeDatabase, createFakeClient } from './fakePg.js';
import { decideNextStep } from '../stages.js';

const require = createRequire(import.meta.url);

const realShopStore = require('../../shop/shopStore.js');
const realShopState = require('../../shop/shopState.js');
const { buildGroundedPrompt } = require('../../interpret/groundedPrompt.js');
const { resolveAll } = require('../../interpret/resolveByCatalogue.js');
const { planBasket } = require('../../skill/planner.js');

export const HOUSEHOLD_ID = 1;

/**
 * A small synthetic household catalogue, in exactly the shape loadCatalogue
 * returns - including `regularsById` as a Map, because resolveByCatalogue and
 * the grounded prompt read different halves of it.
 */
export function makeCatalogue(overrides = {}) {
  const regulars = overrides.regulars || [
    { id: 11, name: 'Gourmet cat food', brand: 'Gourmet', category: 'pet', aka: ['gourmet cat food', 'gourmet'], typical_qty: 3, asda_product_id: 'A11', substitutes_allowed: false },
    { id: 12, name: 'Weetabix Protein', brand: 'Weetabix', category: 'cereal', aka: ['weetabix protein'], typical_qty: 1, asda_product_id: 'A12', substitutes_allowed: false },
    { id: 13, name: 'Arla semi skimmed 4pt', brand: 'Arla', category: 'dairy', aka: ['arla 4pt', 'arla 4pts'], typical_qty: 3, asda_product_id: 'A13', substitutes_allowed: false },
  ];
  return {
    household_id: HOUSEHOLD_ID,
    candidates: regulars.map((r) => ({ id: r.id, name: r.name, brand: r.brand, category: r.category, aka: r.aka, typical_qty: r.typical_qty })),
    regularsById: new Map(regulars.map((r) => [r.id, r])),
    rules: overrides.rules || [],
    last_order: overrides.last_order ?? null,
    ...overrides.extra,
  };
}

/**
 * Wrap the REAL shopStore so every call runs on the injected fake client.
 *
 * shopStore already exposes the seam - `options.client` is used as-is so a
 * caller can own the transaction boundary - so nothing about the module is
 * changed or re-implemented here. The proxy simply always supplies the client.
 */
function bindShopStore(client) {
  const bind = (fn, optionsArgIndex) => (...args) => {
    const opts = { ...(args[optionsArgIndex] || {}), client };
    const filled = args.slice();
    while (filled.length <= optionsArgIndex) filled.push(undefined);
    filled[optionsArgIndex] = opts;
    return fn(...filled);
  };
  return {
    createOrResumeShop: bind(realShopStore.createOrResumeShop, 1),
    transition: bind(realShopStore.transition, 3),
    recordFailure: bind(realShopStore.recordFailure, 2),
    openQuestion: bind(realShopStore.openQuestion, 1),
    answerQuestion: bind(realShopStore.answerQuestion, 1),
    requestBrowserBuild: bind(realShopStore.requestBrowserBuild, 1),
    claimBrowserBuild: bind(realShopStore.claimBrowserBuild, 2),
    updateBrowserProgress: bind(realShopStore.updateBrowserProgress, 2),
    finishBrowserBuild: bind(realShopStore.finishBrowserBuild, 2),
    addPendingAction: bind(realShopStore.addPendingAction, 1),
    resolvePendingAction: bind(realShopStore.resolvePendingAction, 2),
    close: async () => {},
    _internal: {
      ...realShopStore._internal,
      // advanceWithList composes these two; binding the client here keeps the
      // real applyTransition (and therefore the real status guard) in play.
      inTransaction: (options, fn) => realShopStore._internal.inTransaction({ ...(options || {}), client }, fn),
    },
  };
}

/**
 * Build a complete offline pipeline.
 *
 * `script` controls the two things a test needs to steer:
 *   modelLines   what the grounded vision request "reads" off the photograph
 *   catalogue    the household catalogue the invariant demands be loaded first
 *
 * `calls` records, in order, every dependency the pipeline reached for - which
 * is how invariants.test.js proves the catalogue is loaded BEFORE the model is
 * asked to read anything, rather than merely asserting the prose says so.
 */
export function makeHarness(script = {}) {
  const store = createFakeDatabase(script.seed);
  const client = createFakeClient(store, {});
  const calls = [];
  const catalogue = script.catalogue === undefined ? makeCatalogue() : script.catalogue;

  const shopStore = bindShopStore(client);

  const deps = {
    shopStore,
    shopState: realShopState,
    decideNextStep,

    async readQuery(sql, params) {
      return client.query(sql, params);
    },

    async writeQuery(sql, params) {
      return client.query(sql, params);
    },

    async loadCatalogue(householdId) {
      calls.push({ dep: 'loadCatalogue', householdId });
      return catalogue;
    },

    buildGroundedPrompt(cat) {
      calls.push({ dep: 'buildGroundedPrompt', candidates: cat.candidates.length });
      return buildGroundedPrompt(cat);
    },

    /** The ONE model call, faked. It returns raw READINGS only - never a
     *  product name it invented - exactly as the grounded contract requires.
     *
     * ── DEFAULT CONFIDENCE, WP-B15-22 GATE ZERO ─────────────────────────────
     * The real model is asked for a per-line `confidence` (groundedPrompt.js)
     * and resolveByCatalogue.js's vision-confidence gate now reads it - a
     * missing/low value forces `needs_confirmation` REGARDLESS of catalogue
     * match strength (Warwick's own incident: a confident catalogue match on
     * a line the model itself was unsure about). Every `modelLines` fixture
     * across this suite predates that field and never set one, so defaulting
     * a MISSING `confidence` to a HIGH value here - rather than letting it
     * fall through to the gate's own "missing means 0" production rule - is
     * what keeps ~500 existing tests describing an ordinary confident read,
     * not a newly-injected uncertainty none of them asked for. A test that
     * wants to exercise the gate sets `confidence` (and/or `status`)
     * explicitly on its own `modelLines` entries, which this never overrides. */
    /** The image-preparation step, faked. It touches no file: what matters to
     *  the pipeline is that the step HAPPENS before the model is asked, and
     *  that its provenance reaches the grounding record. The real arithmetic is
     *  proven against Mum's actual photograph in transcribe/prepareImage.test.js.
     *  Bound here rather than left undefined on purpose - a `deps.X` that
     *  nothing binds is undefined at runtime while every stubbed test passes,
     *  which is the exact defect this build has already paid for three times. */
    async prepareImage(imagePath) {
      calls.push({ dep: 'prepareImage', imagePath });
      return {
        dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
        provenance: script.imagePreparation || {
          source_width: 720, source_height: 1280, scale: 2, width: 1440, height: 2560,
          prepared: true, floor: 1440,
        },
      };
    },

    async interpretPhoto({ catalogue: cat, prompt }) {
      calls.push({ dep: 'interpretPhoto', promptChars: prompt.length, candidates: cat.candidates.length });
      if (script.modelThrows) throw new Error(script.modelThrows);
      return (script.modelLines || []).map((l) => {
        // A fixture writes `status` because that is the MODEL's own field
        // name (groundedPrompt.js) - the natural word for someone authoring
        // "what the model said". This function stands in for the WHOLE of
        // deps.interpretPhoto though, so its OUTPUT must match what the real
        // realInterpretPhoto returns: `model_status`, not `status` - the same
        // rename that function performs. Getting this wrong is silent: the
        // gate simply never sees the model's status and falls through to
        // treating the line as an ordinary catalogue match.
        const { status, model_status, ...rest } = l;
        return {
          confidence: 1,
          ...rest,
          model_status: model_status !== undefined ? model_status : (typeof status === 'string' ? status : null),
        };
      });
    },

    resolveAll(lines, regulars, opts) {
      // `opts` is passed THROUGH, not dropped: stepInterpret hands the household's
      // rules here, and a harness that swallowed them would make a rule look
      // wired in production while every test proved nothing about it.
      calls.push({ dep: 'resolveAll', lines: lines.length, regulars: regulars.length, rules: (opts && opts.rules && opts.rules.length) || 0 });
      return resolveAll(lines, regulars, opts);
    },

    /** WP-B15-22 (Gate Zero): the resolved vision model id, faked as a fixed,
     *  obviously-synthetic string so a test asserting on it never depends on
     *  a real env var. A test that cares which value was recorded overrides
     *  this on its own harness instance, exactly like every other dep here. */
    async visionModel() {
      calls.push({ dep: 'visionModel' });
      return script.visionModel !== undefined ? script.visionModel : 'fake-vision-model';
    },

    async shopperRoute(payload, opts) {
      calls.push({ dep: 'shopperRoute', kind: payload.kind });
      const { shopperRoute } = await import('../../../hub/shopper/shopperRoute.mjs');
      return shopperRoute(payload, opts);
    },

    async assertAllowedIntents(intents) {
      const { ALLOWED_SHOPPER_COMMANDS } = await import('../../../hub/shopper/shopperRoute.mjs');
      for (const i of intents) {
        if (!ALLOWED_SHOPPER_COMMANDS.includes(i.command)) {
          throw new Error(`pipeline: refusing a non-allowlisted command "${i.command}"`);
        }
      }
      return intents;
    },

    /** The REAL asdairCommands.execute, on the fake client, in one transaction. */
    async executeIntents(intents, { householdId }) {
      calls.push({ dep: 'executeIntents', count: intents.length });
      const asdairCommands = await import('../../../control-plane/wp-d-proof/asdairCommands.mjs');
      await client.query('BEGIN');
      let listId = null;
      const results = [];
      for (const intent of intents) {
        const res = await asdairCommands.execute(client, intent.command, { ...intent.args, household: householdId });
        if (!res.ok) { await client.query('ROLLBACK'); throw new Error(`executeIntents: ${res.error}`); }
        listId = res.list_id;
        results.push(res);
      }
      await client.query('COMMIT');
      return { listId, results };
    },

    planBasket(input) {
      calls.push({ dep: 'planBasket', lines: input.listItems.length });
      return planBasket(input);
    },

    async loadPlanningInputs() {
      calls.push({ dep: 'loadPlanningInputs' });
      return script.planningInputs || {
        rules: [], products: [],
        regulars: [...catalogue.regularsById.values()],
        budget: null, lastOrder: catalogue.last_order,
        // asdair.rule_qa_log, as data.js loadRuleQaLog() returns it. Defaulted
        // to empty rather than omitted: planBasket treats priorAnswers as
        // optional, so a harness that left the key off entirely could not tell
        // "the pipeline passed no prior answers" apart from "there were none".
        priorAnswers: [],
      };
    },

    /**
     * THE REAL recordAnswerLearning, on the fake client.
     *
     * Same seam and same reason as recordConfirmation above: the module takes an
     * already-connected client, so the offline suite runs the genuine
     * buildAnswerLearning -> promoteDecision path rather than a re-implementation
     * of it. A stub here would assert only that runPipeline called something,
     * which is the shape of proof this build already has too much of.
     */
    async recordAnswerLearning(answer) {
      calls.push({ dep: 'recordAnswerLearning', questionKey: answer.question_key });
      const { recordAnswerLearning } = require('../../outcome/recordAnswerLearning.js');
      return recordAnswerLearning(answer, { client });
    },

    buildConfirmationPayload(payload) {
      calls.push({ dep: 'buildConfirmationPayload' });
      const { buildPayload } = require('../../reconcile/record-confirmation.js');
      return buildPayload(payload);
    },

    async recordConfirmation(confirmation) {
      calls.push({ dep: 'recordConfirmation', lines: confirmation.lines.length });
      const { recordConfirmation } = require('../../reconcile/recordConfirmation.js');
      return recordConfirmation(confirmation, { client });
    },

    async recordLearning() {
      calls.push({ dep: 'recordLearning' });
      return { attempted: 0, applied: 0, errors: [] };
    },

    async getShopStatus(shopId) {
      calls.push({ dep: 'getShopStatus', shopId });
      const shop = store.db.shop.find((s) => String(s.id) === String(shopId));
      return { shop_id: shop.id, shop_ref: shop.shop_ref, stage: shop.status, unknown_means_unknown: true };
    },

    log: () => {},
    ...script.depsOverride,
  };

  return { deps, store, client, calls, catalogue, db: store.db };
}

/** A synthetic Telegram update carrying a typed list. Obvious fixtures only. */
export function textUpdate({ updateId = 1, chatId = 555, messageId = 900, text = '3 gourmet cat food\n1 weetabix protein' } = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: chatId },
      chat: { id: chatId, type: 'private' },
      text,
    },
  };
}

/** A synthetic tapped button. `data` must be a real callbackProtocol payload. */
export function callbackUpdate({ updateId = 2, chatId = 555, data = 'asd:build:SHOP-2026-08-03', queryId = 'cbq-1' } = {}) {
  return {
    update_id: updateId,
    callback_query: {
      id: queryId,
      from: { id: chatId },
      data,
      message: { message_id: 901, chat: { id: chatId } },
    },
  };
}

/** The frozen clock every fixture shares, so a shop_ref is deterministic. */
export const FIXED_NOW = Date.parse('2026-08-03T09:00:00.000Z');

/** An intake wiring whose Telegram client is a scripted fake. No token, no fetch. */
export function makeIntake(updates, { mediaPath = 'C:/.fusion247/asdair/shopper-media/fake.jpg' } = {}) {
  let lastUpdateId = null;
  const delivered = [];
  return {
    // INJECTED CLOCK. The week a list belongs to must not depend on the day the
    // test happens to run.
    now: () => FIXED_NOW,
    runIntake: async (args) => {
      const { runIntake } = await import('../../intake/shopperIntake.js');
      return runIntake(args);
    },
    config: {
      // An OBVIOUSLY fake token, and it never leaves this object - the fake
      // client below ignores it entirely and no fetch exists in this suite.
      botToken: '000000:FAKE-TOKEN-NOT-A-CREDENTIAL',
      allowedSenderIds: ['555'],
      pollTimeoutSeconds: 0,
    },
    telegram: {
      async getUpdates({ offset } = {}) {
        delivered.push(offset ?? null);
        return updates.filter((u) => offset === undefined || offset === null || u.update_id >= offset);
      },
      async getFile() { return { file_path: 'photos/fake.jpg' }; },
      async downloadFile() { return Buffer.from('not-a-real-photo'); },
    },
    state: {
      async read() { return { lastUpdateId }; },
      async write(v) { lastUpdateId = v; return v; },
    },
    media: { async save() { return mediaPath; } },
    delivered,
  };
}
