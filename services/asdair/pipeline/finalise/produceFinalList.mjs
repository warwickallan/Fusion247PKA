// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/produceFinalList.mjs
//
// WO-2026-08-13-04 (WP-B15-37). TURN THE FROZEN 39-LINE PHOTOGRAPH READING
// INTO A DURABLE, BRAND-SORTED SHOPPING LIST AND A BROWSER-READY HANDOFF.
//
// ── WHAT RUNS HERE, AND WHAT DOES NOT ────────────────────────────────────
// The Work Order says the ACTUAL PRODUCTION PATH must produce the list, and
// separately forbids ANY database write. Those two cannot both be satisfied
// literally: `runPipeline.stepInterpret` is constitutively a writer - it calls
// `shopLines.upsertLines`, `deps.executeIntents` (add_list_item),
// `shopLines.linkListItem` and `store.advanceWithList` - and the browser step
// calls the durable `openHandoff`. There is no configuration in which the real
// path produces a list without writing one down.
//
// So the production MODULES run verbatim, over the OFFLINE DURABLE STORE the
// package already owns (`pipeline/test/fakePg.js`), which carries the real
// unique indexes. Real, not stubbed, and not re-implemented here:
//
//     pipeline/runPipeline.js               the advancer, stage by stage
//     pipeline/stages.js                    the stage table
//     pipeline/shopLines.js                 the durable interpretation
//     shop/shopStore.js, shop/shopState.js  the guarded transitions
//     interpret/resolveByCatalogue.js       IDENTITY - the catalogue decides
//     hub/shopper/shopperRoute.mjs          list -> intents
//     control-plane/.../asdairCommands.mjs  intents -> rows
//     skill/planner.js                      the deterministic plan
//     skill/rulebook.js                     the household's prose rules
//     packet/buildExecutionPacket.js        the browser packet contract
//     handoff/buildHandoff.js               the operating method
//
// ⛔ NOTHING is written to the live database. ⛔ NO browser, trolley, checkout,
// payment, slot or order action occurs, and no step that could perform one is
// ever reached. ⛔ This is PRODUCT CAPABILITY EVIDENCE, not acceptance: no
// production photograph event is exercised, so nothing here may be described as
// a live run or as AsdAIr being accepted.
//
// ── WHERE THE PHOTO TRUTH COMES FROM ─────────────────────────────────────
// Vision is FINAL and PARKED at 54c3b0b. Its three frozen final runs of the real
// photograph are banked under `agenticVisionPrototype/runs/*wp1534-final*.json`
// and are consumed here as evidence. No vision model is called, no comparison is
// re-run and no prompt is touched - re-running it is exactly what the order
// forbids, and the banked artefacts ARE its production output.
//
// ⛔ The 39-line ground-truth FIXTURE is NEVER read by this file. It is test
// data ("no production path may read this file"), and it is used only by the
// proofs beside this one to GRADE what this file produced.
//
// Run:  node finalise/produceFinalList.mjs
// =====================================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeHarness, HOUSEHOLD_ID } from '../test/harness.js';
import * as commands from '../commands.js';
import { runPipeline, buildBrowserHandoff } from '../runPipeline.js';
import { corroborate } from './corroborate.js';
import { settleQuantity } from './settleQuantity.js';
import { routeToHuman } from './humanRouting.js';
import { buildFinalList } from './finalList.js';
import { buildAccounting } from './accounting.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const RUNS_DIR = join(HERE, '..', 'agenticVisionPrototype', 'runs');

const SHOP_REF = 'SHOP-2026-08-13';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: SHOP_REF };
const PHOTO = 'C:/.fusion247/asdair/shopper-media/tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg';

/** The three FINAL frozen vision runs. Named by prefix, never by index. */
export const FINAL_RUN_SUFFIX = '-wp1534-final.json';

export function loadFrozenRuns(dir = RUNS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith(FINAL_RUN_SUFFIX)).sort();
  if (files.length === 0) throw new Error(`produceFinalList: no frozen final vision runs found in ${dir}`);
  return files.map((file) => {
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    return {
      label: file.slice(11, 19),
      file,
      costUsd: Number(json.totalCostUsd) || 0,
      observations: Array.isArray(json.finalLines) ? json.finalLines : [],
    };
  });
}

/** The household truth banked SELECT-only by householdSnapshot.mjs. */
export function loadHousehold(outDir = OUT) {
  return JSON.parse(readFileSync(join(outDir, 'household-1-snapshot.json'), 'utf8'));
}

/**
 * Shape the banked regulars into the catalogue `loadCatalogue` returns, so the
 * production modules receive exactly what they receive in production.
 */
export function catalogueFromSnapshot(snapshot) {
  const regulars = snapshot.regulars.map((r) => ({
    id: Number(r.id),
    household_id: Number(r.household_id),
    name: r.name,
    brand: r.brand,
    category: r.category,
    aka: Array.isArray(r.aka) ? r.aka : [],
    typical_qty: r.typical_qty,
    asda_product_id: r.asda_product_id,
    asda_url: r.asda_url,
    substitutes_allowed: r.substitutes_allowed,
    active: r.active,
  }));
  return {
    household_id: snapshot.household_id,
    candidates: regulars.map((r) => ({
      id: r.id, name: r.name, brand: r.brand, category: r.category,
      aka: r.aka, typical_qty: r.typical_qty,
    })),
    regularsById: new Map(regulars.map((r) => [r.id, r])),
    rules: snapshot.rules || [],
    last_order: null,
    regulars,
  };
}

/**
 * Turn corroborated observations into the EXACT shape `deps.interpretPhoto`
 * returns on the real photo path, so `stepInterpret` cannot tell the difference.
 *
 * The confidence field is doing real work here and is not decoration: a line the
 * runs disagree about, or that only one run saw, is handed over with a
 * confidence of 0 so `resolveByCatalogue`'s own vision-confidence gate holds it
 * as `needs_confirmation` and the planner opens a question. That is how genuine
 * uncertainty reaches Warwick through the production route instead of being
 * decided here.
 *
 * WO-2026-08-13-10 AC5: the decision is now `finalise/humanRouting.js`, and it
 * adds a FOURTH cause the three original ones could not express - an UNDISCHARGED
 * VISION REFERRAL. That cause is independent of agreement, so a line every
 * reading agreed on can still reach a human. Read that module's header for why
 * unanimity was never evidence of truth here.
 */
export function modelLinesFrom(observations, productNameById) {
  return observations.map((obs, i) => {
    const settled = settleQuantity(obs, productNameById);
    const route = routeToHuman(obs, settled);
    const uncertain = route.human;
    return {
      line_no: i + 1,
      raw_reading: obs.as_written,
      quantity: settled.quantity,
      confidence: uncertain ? 0 : (Number.isFinite(Number(obs.confidence)) ? Number(obs.confidence) : 0.9),
      source_region: Number.isInteger(obs.source_region) ? obs.source_region : null,
      _observation: obs,
      _settled: settled,
      _uncertain: uncertain,
      _route: route,
    };
  });
}

export async function produce({ runs, snapshot } = {}) {
  const frozen = runs || loadFrozenRuns();
  const household = snapshot || loadHousehold();
  const catalogue = catalogueFromSnapshot(household);
  const productNameById = new Map(household.regulars.map((r) => [String(r.id), r.name]));

  // ── 1. RECONCILE THE PHOTO OBSERVATIONS ──────────────────────────────────
  const reconciled = corroborate(frozen.map((r) => ({ label: r.label, observations: r.observations })));

  // Only a line MORE THAN ONE independent reading saw is treated as an
  // established page line. A line one run alone produced cannot be told apart
  // from a phantom, and vision no longer carries any mechanism that could.
  const established = reconciled.observations.filter((o) => o.support >= 2);
  const unsupported = reconciled.observations.filter((o) => o.support < 2);

  const modelLines = modelLinesFrom(established, productNameById);

  // ── 2. DRIVE THE REAL PIPELINE ───────────────────────────────────────────
  const harness = makeHarness({
    catalogue,
    modelLines: modelLines.map(({ _observation, _settled, _uncertain, _route, ...line }) => line),
    visionModel: 'frozen-run:wp1534-final (vision PARKED at 54c3b0b)',
    planningInputs: {
      rules: household.rules || [],
      products: [],
      regulars: catalogue.regulars,
      budget: null,
      lastOrder: null,
      priorAnswers: [],
    },
    depsOverride: {
      // ── THE JUDGEMENT LAYER IS DECLINED, LOUDLY AND ON PURPOSE ───────────
      //
      // `skill/rulebook.js` consults a reasoning consumer about the household's
      // INERT prose rules (the `info` directives - "milk means Cravendale Arla,
      // never a BOB variant"). The deterministic `map` / `exclude` / `rotate`
      // directives do not go through it; `skill/planner.js` applies those
      // itself, so the household's hard rules ARE applied on this run.
      //
      // This Work Order's live_authority is bounded to "live gateway runs
      // against the one named photograph". A rulebook consultation is a
      // DIFFERENT gateway call about a different thing, and anything the
      // deviation does not name remains `none` - so it is not made.
      //
      // Declining is a supported state, not a workaround: the module catches a
      // throwing consult, changes NO line, and flags every line an inert rule
      // would have spoken about with `rulebook not consulted`. That is visible
      // in the artefact and in this note. Silence was the one option not taken.
      consult: async () => {
        throw new Error('rulebook consultation declined: WO-2026-08-13-04 live_authority is bounded to gateway runs against the named photograph and does not name a rulebook consultation');
      },
    },
  });

  await commands.receiveList({
    householdId: HOUSEHOLD_ID,
    listDate: '2026-08-13',
    sourceKind: 'photo',
    rawMediaPath: PHOTO,
    needsReview: true,
    actor: ACTOR,
    telegramChatId: '555',
    telegramMessageId: '86',
  }, harness.deps);
  await commands.buildShop({ shopRef: SHOP_REF, actor: ACTOR }, harness.deps);

  const steps = [];
  for (let i = 0; i < 12; i += 1) {
    const r = await runPipeline(HANDLE, harness.deps);
    steps.push({ step: r.step, from: r.from ?? null, to: r.to ?? null, stepped: r.stepped === true });
    if (!r.stepped) break;
  }

  const shop = harness.db.shop[0];

  // ── 3. THE BROWSER-READY HANDOFF, THROUGH THE PRODUCTION FUNCTION ────────
  // `buildBrowserHandoff` is the exported production function `stepQueueBrowserBuild`
  // calls. It is invoked directly rather than through that step because the step
  // additionally OPENS a durable browser request, and this Work Order forbids
  // requesting a browser build of any kind. The artefact is identical; what is
  // deliberately not done is asking anyone to go and shop it.
  const { packet, handoff, unusableRefs } = await buildBrowserHandoff(harness.deps, shop);

  // ── 4. THE DURABLE ARTEFACTS ─────────────────────────────────────────────
  const finalList = buildFinalList({
    shop,
    listItems: harness.db.shopping_list_items,
    shopLines: harness.db.shop_line,
    questions: harness.db.shop_question || [],
    packet,
    handoff,
    modelLines,
    catalogue,
    reconciled,
    unsupported,
  });

  const accounting = buildAccounting({
    reconciled,
    established,
    unsupported,
    finalList,
    shopLines: harness.db.shop_line,
  });

  return {
    frozen, household, catalogue, reconciled, established, unsupported,
    modelLines, harness, steps, shop, packet, handoff, unusableRefs,
    finalList, accounting,
  };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('produceFinalList.mjs')) {
  const result = await produce();
  mkdirSync(OUT, { recursive: true });

  writeFileSync(join(OUT, 'final-shopping-list.json'), `${JSON.stringify(result.finalList, null, 2)}\n`, 'utf8');
  writeFileSync(join(OUT, 'accounting.json'), `${JSON.stringify(result.accounting, null, 2)}\n`, 'utf8');
  writeFileSync(join(OUT, 'browser-handoff.json'), `${JSON.stringify({
    packet: result.packet, handoff: result.handoff, unusable_references: result.unusableRefs,
  }, null, 2)}\n`, 'utf8');

  const { renderFinalListMarkdown } = await import('./finalList.js');
  writeFileSync(join(OUT, 'final-shopping-list.md'), renderFinalListMarkdown(result.finalList), 'utf8');

  // WO-2026-08-13-10 AC2. The derivation, generated from the artefact that was
  // just built - never hand-authored, and never a second opinion about the
  // numbers the production run already settled.
  const { renderQuantityDerivationMarkdown } = await import('./quantityDerivation.js');
  writeFileSync(join(OUT, 'quantity-derivation.md'), renderQuantityDerivationMarkdown(result.finalList), 'utf8');

  process.stdout.write([
    `steps            : ${result.steps.map((s) => s.step).join(' -> ')}`,
    `shop status      : ${result.shop.status}`,
    `photo lines      : ${result.established.length} established (support >= 2 of ${result.reconciled.runCount})`,
    `unsupported      : ${result.unsupported.length} routed as unsupported photo candidates`,
    `products         : ${result.finalList.totals.product_count}`,
    `items            : ${result.finalList.totals.item_count}`,
    `shoppable lines  : ${result.finalList.totals.shoppable_lines}`,
    `held lines       : ${result.finalList.totals.held_lines}`,
    `accounting closes: ${result.accounting.closes}`,
    `vision cost      : $0.00 this run (three frozen runs consumed; none re-executed)`,
    '',
  ].join('\n'));
}
