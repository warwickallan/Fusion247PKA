// =====================================================================
// BUILD-015 AsdAIr WP-B15-3 R2 - rulebookWiring.test.js
//
// Runs under: node --test
//
// DOES A HOUSEHOLD JUDGEMENT RULE ACTUALLY CHANGE A REAL SHOP?
//
// `skill/rulebook.js` has 29 of its own tests and they all pass. Every one of
// them calls `applyRulebook` directly. That proves the module works; it proves
// NOTHING about whether a shop ever reaches it - and for weeks, no shop did.
// Veritas measured exactly that at Gate 1: five exports, imported by two test
// files and nothing else.
//
// So nothing in this file calls applyRulebook. Every assertion here is driven
// from the PIPELINE ENTRY - `runPipeline(handle, deps)`, the same call the
// runtime loop makes - over the real planner, the real state machine, the real
// durable writes, and the real durable browser-handoff artefact. The only fake
// is the reasoning consumer itself, injected exactly where production injects
// the Terra binding.
//
// The bar, which is the same bar the four JOIN tests in runPipeline.test.js
// were written to: DELETE THE CALL SITE AND THIS MUST GO RED.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// PURE ASCII. Synthetic fixtures only; never real household data.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { makeHarness, makeCatalogue, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import { STEPS } from './stages.js';

const { buildPayload: realBuildPayload } = createRequire(import.meta.url)('../reconcile/record-confirmation.js');

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

// ── THE FIXTURE RULE ────────────────────────────────────────────────────────
//
// Shaped exactly like the dead 59%: an `info` row with a match_term, carrying a
// JUDGEMENT no deterministic matcher can perform. `planner.actionableRules()`
// drops it (info), `rotationInstructionsFromRules()` ignores it (not rotate),
// and `advisoryRules()` merely ECHOES its words onto the line's note. It has
// never changed a quantity, a product or a status. That is the whole point.
//
// Synthetic. Modelled on live rule 37's SHAPE, not copied from household data.
const PAIR_RULE = Object.freeze({
  id: 3701,
  household_id: HOUSEHOLD_ID,
  active: true,
  directive: 'info',
  match_term: 'gourmet cat food',
  match_category: null,
  rule_text: 'Gourmet cat food: round the quantity up to complete a pair.',
});

/** A rule of the same inert shape that speaks about NOTHING in this basket. */
const UNRELATED_RULE = Object.freeze({
  ...PAIR_RULE,
  id: 3702,
  match_term: 'washing powder',
  rule_text: 'Washing powder: pick the best value by price per wash.',
});

function planningInputs(rules) {
  return {
    rules,
    products: [],
    regulars: [...makeCatalogue().regularsById.values()],
    budget: null,
    lastOrder: null,
    priorAnswers: [],
  };
}

async function receiveText(h, text = '3 gourmet cat food') {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: text, actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
}

/** Drive the pipeline until it parks, exactly as the runtime loop does. */
async function drain(h, max = 12) {
  const steps = [];
  for (let i = 0; i < max; i += 1) {
    const r = await runPipeline(HANDLE, h.deps);
    steps.push(r);
    if (!r.stepped) break;
  }
  return steps;
}

/**
 * The whole journey a typed list takes, up to the DURABLE browser handoff.
 *
 * Returns the handoff block as it was actually written to
 * asdair.browser_build_request.progress - not a plan object held in memory, and
 * not anything this test computed. If the rulebook did not run on the
 * production path, nothing here can differ.
 */
async function shopToHandoff({ rules, consult }) {
  const seen = [];
  const h = makeHarness({
    planningInputs: planningInputs(rules),
    depsOverride: {
      consult: async (grounding) => {
        seen.push(grounding);
        return consult(grounding);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  const steps = await drain(h);
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP',
    `the fixture shop did not reach READY_TO_SHOP - steps were ${JSON.stringify(steps.map((s) => s.step))}`);

  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  const queued = await runPipeline(HANDLE, h.deps);
  assert.equal(queued.step, STEPS.QUEUE_BROWSER_BUILD);

  const request = h.db.browser_build_request[0];
  assert.ok(request, 'no durable browser build request was written');
  return { h, seen, handoff: request.progress.handoff, queued };
}

// =====================================================================
// AC2 - A DISCARDED RULE CHANGES A PLANNED LINE, THROUGH THE WIRED PATH
// =====================================================================

test('AC2 CONTROL: with no judgement, the basket is exactly what the deterministic planner alone decided', async () => {
  // The baseline the next test is measured against. The rule IS sent - the
  // consumer simply applies none of it - so the difference between this and the
  // next test is the judgement, and nothing else.
  const { seen, handoff } = await shopToHandoff({
    rules: [PAIR_RULE],
    consult: async () => ({ judgements: [] }),
  });

  assert.equal(seen.length > 0, true, 'the rulebook was never consulted on the production path at all');
  assert.equal(handoff.expected.total_units, 3,
    'the deterministic planner plans 3 - the quantity on the list. If this is not 3 the fixture has drifted '
    + 'and the next test would be measuring the wrong thing.');
});

test('AC2: a rule the deterministic planner DISCARDS changes a real planned line, all the way to the durable handoff', async () => {
  // Rule 3701 is inert: the planner drops it and always has. The reasoning
  // consumer reads its words and rounds 3 up to 4 to complete a pair.
  //
  // NOTHING in this test calls applyRulebook. The judgement is injected at
  // deps.consult - the same seam deps.js binds realConsultRulebook to - and the
  // number asserted below was written to the durable browser_build_request row
  // by stepQueueBrowserBuild.
  const { seen, handoff } = await shopToHandoff({
    rules: [PAIR_RULE],
    consult: async (grounding) => {
      // Built FROM the grounding the production path actually assembled, never
      // from a literal. A test that hardcodes line_no and rule_id would pass
      // even if the pipeline handed the consumer an empty packet.
      const line = grounding.lines[0];
      const rule = grounding.rules[0];
      return {
        judgements: [{
          line_no: line.line_no,
          rule_id: rule.id,
          kind: 'set_quantity',
          quantity: 4,
          why: 'rounded up to complete a pair',
        }],
      };
    },
  });

  // (a) THE GROUNDING WAS REAL. The consumer was handed the household's own
  //     words and the line they are about - assembled by production code from
  //     the real plan, not by this test.
  // TWO, not one, and that is a real property of the design rather than a
  // quirk of this fixture: there is no plan table, so the plan is RECOMPUTED at
  // every site that needs one, and the rulebook now runs at each recomputation.
  // This journey has two - stepPlan and buildBrowserHandoff. The number is
  // pinned so a third recomputation cannot be added without someone seeing what
  // it costs. See rulebookWiring's own cost test below.
  assert.equal(seen.length, 2,
    'the rulebook was consulted a different number of times than the journey has plan recomputations');
  const grounding = seen[0];
  assert.deepEqual(grounding.rules.map((r) => r.id), [PAIR_RULE.id],
    'the household rule did not reach the consumer');
  assert.equal(grounding.rules[0].text, PAIR_RULE.rule_text,
    "the rule reached the consumer without the household's own words");
  assert.equal(grounding.lines.length, 1);
  assert.match(grounding.lines[0].item_name, /gourmet/i);
  assert.equal(grounding.lines[0].may_set_quantity, true,
    'the line was sent without permission to re-count it, so no judgement could ever apply');

  // (b) THE BASKET CHANGED, DURABLY. 3 -> 4, in the artefact a browser runner
  //     is handed. The control test above pins the unjudged value at 3.
  assert.equal(handoff.expected.total_units, 4,
    "the judgement did not reach the basket. The rule was sent, the consumer answered, and the shop was "
    + 'still built on the deterministic count - which is the defect this lane exists to close.');
});

test('AC2 ATTRIBUTION: the changed line carries `rulebook rule <id>` where a production consumer can read it', async () => {
  // The attribution is on the plan item, and the plan is recomputed rather than
  // stored - so it is observed at the one PRODUCTION dependency that is handed
  // the finished plan: deps.buildConfirmationPayload, which stepRecordConfirmation
  // calls. The override below WRAPS it and then runs the real producer; it does
  // not replace the behaviour.
  let capturedPlan = null;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async (grounding) => ({
        judgements: [{
          line_no: grounding.lines[0].line_no,
          rule_id: grounding.rules[0].id,
          kind: 'set_quantity',
          quantity: 4,
          why: 'rounded up to complete a pair',
        }],
      }),
      buildConfirmationPayload(spec) {
        capturedPlan = spec.plan;
        return realBuildPayload(spec);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP');

  // The browser runner's leg is a different lane and is not what this test is
  // about, so the shop is advanced to the state a finished basket leaves it in.
  // Everything after this line is real production code.
  h.db.shop[0].status = 'BASKET_READY';

  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  const recorded = await runPipeline(HANDLE, h.deps);
  assert.equal(recorded.step, STEPS.RECORD_CONFIRMATION,
    'the confirmation step did not run, so no production consumer was handed the plan');

  assert.ok(capturedPlan, 'no production consumer received the plan');
  const line = capturedPlan.items.find((it) => /gourmet/i.test(it.item_name));
  assert.ok(line, 'the fixture line is not in the plan the confirmation was built from');

  assert.equal(line.planned_qty, 4, 'the judgement did not survive to the reconciliation recomputation');
  assert.ok((line.flags || []).includes(`rulebook rule ${PAIR_RULE.id}`),
    `the changed line names no rule - flags were ${JSON.stringify(line.flags)}. A change nobody can trace `
    + 'back to a household rule is exactly what "why did it do that" has to be answerable from.');
  assert.ok((line.flags || []).includes('quantity set by household rule'),
    `the change is not marked as a rulebook change - flags were ${JSON.stringify(line.flags)}`);
  assert.match(String(line.note || ''), new RegExp(`rule ${PAIR_RULE.id} set the quantity to 4`),
    'the line does not say in words what the rule did');

  // And the audit travels with the plan, so the applied change is countable
  // rather than only visible on one line.
  const applied = ((capturedPlan.summary || {}).rulebook || {}).applied || [];
  assert.deepEqual(applied.map((a) => [a.rule_id, a.from, a.to]), [[PAIR_RULE.id, 3, 4]],
    'summary.rulebook.applied does not record the change that was made');
});

// =====================================================================
// WHAT THE WIRING COSTS - MEASURED, NOT ASSUMED
//
// A model call is money. `planWithDecisions` is called at every plan
// recomputation, so wiring the rulebook into it means one Terra call per
// recomputation - and the number of recomputations is a property of the
// journey, not of this module. Counted here so it cannot grow silently, and so
// the number is on the record rather than in someone's head.
//
// A PARKED shop was established by execution NOT to re-plan: a shop sitting at
// NEEDS_DECISION returns `wait:answers` and consults nothing, however many
// times the runtime loop looks at it. That is the number that would have
// mattered, and it is zero.
// =====================================================================

test('COST: one consult per plan recomputation, and a parked shop consults NOTHING', async () => {
  let calls = 0;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async () => { calls += 1; return { judgements: [] }; },
      buildConfirmationPayload: (spec) => realBuildPayload(spec),
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(calls, 1, 'stepPlan is one recomputation and must consult exactly once');

  // Every further look at a READY shop is a no-op. This is the number that
  // would have been a real spend problem, and it is zero.
  for (let i = 0; i < 5; i += 1) await runPipeline(HANDLE, h.deps);
  assert.equal(calls, 1, 'a parked shop consulted a model just for being looked at');

  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(calls, 2, 'buildBrowserHandoff is the second recomputation');

  h.db.shop[0].status = 'BASKET_READY';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(calls, 3,
    'a whole shop journey consults the rulebook three times - once per plan recomputation. '
    + 'If this number has changed, a recomputation was added or removed and the cost changed with it.');
});

// =====================================================================
// AC4 - THE NO-RULES PATH COSTS NOTHING
// =====================================================================

test('AC4: with no inert rule speaking about the basket, consult is NEVER called', async () => {
  // A household with no judgement layer must spend nothing. `consult` is the
  // only thing on this path that costs money, so "never called" is the whole
  // claim - and it is asserted by counting calls, not by inspecting a flag.
  let calls = 0;
  const h = makeHarness({
    planningInputs: planningInputs([]),
    depsOverride: {
      consult: async () => { calls += 1; return { judgements: [] }; },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop[0].status, 'WAITING_FOR_BROWSER',
    'the shop did not complete its journey, so "never called" would prove nothing');
  assert.equal(calls, 0,
    'the rulebook consulted a model for a household with no judgement rules at all. '
    + 'Every basket would carry a model call it cannot use.');
});

test('AC4: an inert rule that speaks about nothing in THIS basket also costs nothing', async () => {
  // The harder half. Rules exist and are inert; none of them names a line in
  // front of us. Sending them anyway would be paying for prose the consumer
  // cannot act on - and the module's relevance selection is what prevents it.
  let calls = 0;
  const h = makeHarness({
    planningInputs: planningInputs([UNRELATED_RULE]),
    depsOverride: {
      consult: async () => { calls += 1; return { judgements: [] }; },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);

  assert.equal(h.db.shop[0].status, 'WAITING_FOR_BROWSER');
  assert.equal(calls, 0,
    'a rule about washing powder triggered a model call on a basket of cat food');
});

// =====================================================================
// THE DEGRADED PATHS - VERIFIED THROUGH THE WIRING, NOT RE-IMPLEMENTED
//
// `applyRulebook` already handles an unreachable or unreadable consumer. What
// was never established is whether that handling SURVIVES the wiring - i.e.
// whether a gateway outage degrades visibly or takes the shop down with it.
// =====================================================================

test('A consult that THROWS degrades visibly - the shop still completes and nothing is guessed', async () => {
  // The real production case: FUSION_GATEWAY_URL unset, so `answer()` throws.
  // The shop must still plan, and the lines the rulebook would have spoken
  // about must SAY that the household's judgement rules did not run.
  let capturedPlan = null;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async () => { throw new Error('no gateway configured'); },
      buildConfirmationPayload(spec) {
        capturedPlan = spec.plan;
        return realBuildPayload(spec);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  assert.equal(h.db.shop[0].status, 'READY_TO_SHOP',
    'an unreachable reasoning consumer stopped the whole shop - it must degrade, never fail the week');

  h.db.shop[0].status = 'BASKET_READY';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const line = capturedPlan.items.find((it) => /gourmet/i.test(it.item_name));
  assert.equal(line.planned_qty, 3, 'a failed consultation changed a line anyway');
  assert.ok((line.flags || []).includes('rulebook not consulted'),
    `the failure is silent - flags were ${JSON.stringify(line.flags)}. Silence is the one option not on the table.`);
  assert.match(String(((capturedPlan.summary || {}).rulebook || {}).error || ''), /no gateway configured/,
    'the audit does not record why the household rules did not run');
});

test('An unreadable reply is never read as approval', async () => {
  // extractJson returns null on prose. The module must treat that as "the
  // consumer said nothing", not as "the consumer approved the plan".
  let capturedPlan = null;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async () => 'I am afraid I cannot help with that.',
      buildConfirmationPayload(spec) {
        capturedPlan = spec.plan;
        return realBuildPayload(spec);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  h.db.shop[0].status = 'BASKET_READY';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const line = capturedPlan.items.find((it) => /gourmet/i.test(it.item_name));
  assert.equal(line.planned_qty, 3);
  assert.ok((line.flags || []).includes('rulebook not consulted'),
    `an unreadable reply left no trace on the line - flags were ${JSON.stringify(line.flags)}`);
  assert.match(String(((capturedPlan.summary || {}).rulebook || {}).error || ''),
    /returned nothing this module could read/,
    'the audit does not say the reply could not be read');
});

test('A judgement naming a product nobody offered can never buy it - it becomes a question', async () => {
  // The safety envelope, exercised THROUGH the wiring rather than in a unit
  // test. The consumer names a product that was never among the choices; the
  // line must not silently become that product.
  let capturedPlan = null;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async (grounding) => ({
        judgements: [{
          line_no: grounding.lines[0].line_no,
          rule_id: grounding.rules[0].id,
          kind: 'set_product',
          product: 'Caviar for cats, 40 tins',
          why: 'invented',
        }],
      }),
      buildConfirmationPayload(spec) {
        capturedPlan = spec.plan;
        return realBuildPayload(spec);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  h.db.shop[0].status = 'BASKET_READY';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const line = capturedPlan.items.find((it) => /gourmet/i.test(it.item_name));
  assert.notEqual(line.matched_product, 'Caviar for cats, 40 tins',
    'a product nobody offered reached a real basket through the rulebook');
  assert.ok((line.flags || []).includes('rulebook answer rejected')
    || (line.flags || []).includes('rulebook question'),
    `the refusal left no trace - flags were ${JSON.stringify(line.flags)}`);
});

test('A quantity beyond the module bound is refused, and the refusal is recorded', async () => {
  let capturedPlan = null;
  const h = makeHarness({
    planningInputs: planningInputs([PAIR_RULE]),
    depsOverride: {
      consult: async (grounding) => ({
        judgements: [{
          line_no: grounding.lines[0].line_no,
          rule_id: grounding.rules[0].id,
          kind: 'set_quantity',
          quantity: 76,
          why: 'misread "76 washes" as a count',
        }],
      }),
      buildConfirmationPayload(spec) {
        capturedPlan = spec.plan;
        return realBuildPayload(spec);
      },
    },
  });

  await receiveText(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await drain(h);
  h.db.shop[0].status = 'BASKET_READY';
  await commands.submitConfirmation({ shopRef: REF, actor: ACTOR, rawText: 'Order total 12.34' }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const line = capturedPlan.items.find((it) => /gourmet/i.test(it.item_name));
  assert.notEqual(line.planned_qty, 76, '76 tins of cat food reached a real basket');
  const rejected = ((capturedPlan.summary || {}).rulebook || {}).rejected || [];
  assert.ok(rejected.some((r) => /outside 1\.\./.test(String(r.reason))),
    `the out-of-bound quantity was not recorded as rejected - ${JSON.stringify(rejected)}`);
});
