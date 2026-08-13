// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - productionWiring.test.js
//
// Runs under: node --test
//
// THE PRODUCTION CONTAINER SUPPLIES WHAT PRODUCTION NEEDS.
//
// Veritas D-1: `deps.interpretAnswer` was consumed by runPipeline and bound by
// NOTHING in deps.js. Every test in the suite passed, because every test
// injected its own stub. So a button resolved in production and free text
// could not - half the outcome sentence - and no test could see it, because
// the stub that made the tests pass WAS the thing that was missing.
//
// That is the shape of this whole build's recurring defect: a component that
// is complete, tested and unwired. `buildAnswerLearning` and
// `recordAnswerLearning` had zero production callers. `sendQuestionCard` had
// zero production callers. `shopLines.markCorrected` still has zero. In every
// case the unit tests were green.
//
// SO THIS FILE MUST NOT BE SATISFIABLE BY A STUB. It calls the real
// `createDeps()` with no overrides and asks what is actually in the container.
// A test that accepted an injected dep here would be testing the injection.
//
// ── ZERO MODEL SPEND, AND ZERO DATABASE ─────────────────────────────────────
// Nothing here INVOKES the interpreter. It asserts the WIRING - that a
// callable of the right name is present in the real container, and that the
// consumer's name and the provider's name are the same string. Calling it
// would spend a model call and prove something this test is not for.
//
// createDeps() opens no connection at construction: the pools are lazy
// (getPool/getWritePool are called inside the functions, not at build time),
// which is why this is safe to run offline with no credentials.
//
// PURE ASCII. No network, no database, no model.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDeps } from './deps.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

const runPipelineSrc = stripComments(fs.readFileSync(path.join(HERE, 'runPipeline.js'), 'utf8'));

// =====================================================================
// D-1 - the interpreter is genuinely bound
// =====================================================================

test('D-1: the REAL production container supplies a callable interpretAnswer', () => {
  // No overrides. This is the container runtime.js builds and uses.
  const deps = createDeps();
  assert.equal(typeof deps.interpretAnswer, 'function',
    'deps.interpretAnswer is not bound in production. runPipeline consumes it, so free text '
    + 'cannot be interpreted on a real shop - and no stubbed test can see that.');
});

test('D-1: EVERY dep runPipeline consumes is present in the real container', () => {
  // The general form of D-1, so the next unwired seam fails here rather than
  // on a Sunday. Enumerated from the source, not listed by hand.
  const deps = createDeps();
  const consumed = new Set(
    [...runPipelineSrc.matchAll(/\bdeps\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  );
  assert.ok(consumed.size > 5, 'the consumption scan found almost nothing - it would prove nothing');

  const missing = [...consumed].filter((name) => deps[name] === undefined);
  assert.deepEqual(missing, [],
    `runPipeline consumes deps that production does not supply: ${missing.join(', ')}. `
    + 'Every one of these resolves in tests (which inject them) and is undefined on a real shop.');
});

test('D-1: the consumer and the provider agree on the NAME, exactly', () => {
  // A rename on either side reproduces D-1 precisely: still green everywhere
  // a stub is injected, still undefined in production.
  assert.match(runPipelineSrc, /deps\.interpretAnswer/,
    'runPipeline no longer consumes deps.interpretAnswer - if the seam moved, move this test');
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  assert.match(depsSrc, /interpretAnswer:\s*realInterpretAnswer/,
    'deps.js no longer binds interpretAnswer to a real implementation');
});

test('D-1: the interpreter is reached through the SHARED gateway, not a second credential path', () => {
  const depsSrc = fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8');
  const fn = depsSrc.slice(depsSrc.indexOf('async function realInterpretAnswer'));
  const body = fn.slice(0, fn.indexOf('\nasync function realRecordAnswerLearning'));

  assert.match(body, /obsidiwikai\/src\/core\/models\.mjs/,
    'the interpreter does not use the estate gateway module');
  // credential_scope: none. This function must never read a key or a URL.
  assert.doesNotMatch(body, /process\.env\.(FUSION_GATEWAY_KEY|OPENAI_API_KEY|[A-Z_]*TOKEN)/,
    'the interpreter reads a credential directly - the gateway module owns that');
  assert.doesNotMatch(body, /Authorization|Bearer\s/,
    'the interpreter builds its own auth header instead of using the gateway');
});

test('D-1: no gateway means NO INTERPRETATION - never a silent substitute model', () => {
  // ── RE-CUT 2026-08-09 (WO-B15-03). The old form described a design that has
  // been superseded, and would now pass on a weaker guarantee than the one
  // that exists. It read:
  //
  //   assert.match(body, /gatewayConfigured/, ...);
  //   assert.ok(body.indexOf('gatewayConfigured') < body.indexOf('await reason('), ...);
  //
  // That was right when the answer path called `reason()`, which FALLS BACK to
  // the box, so the interpreter had to guard the call itself. Terra's
  // `answer()` does not fall back - it THROWS - so the guarantee no longer
  // depends on the caller remembering to check. Keeping the old assertion
  // would have required re-introducing a redundant guard to satisfy it.
  //
  // The guarantee is now stronger and is asserted where it actually lives:
  // in models.mjs (see 'TERRA: no gateway THROWS'), plus the degradation chain
  // below.
  const body = interpreterBody();
  assert.doesNotMatch(body, /lightrag/,
    'the interpreter reaches the box directly');
  assert.match(body, /await answer\(/,
    'the interpreter must call the gateway-only answer role, which cannot fall back');

  // And the throw is CAUGHT, so a missing gateway degrades visibly rather than
  // failing the shop: stepReplan records the failure, no decision row is
  // written, the line stays unresolved, and the gate refuses READY_TO_SHOP.
  // Nothing is guessed at any point in that chain.
  assert.match(runPipelineSrc, /catch \(err\) \{[\s\S]{0,400}?interpretation failed:/,
    'an interpretation failure is not caught - a missing gateway would fail the whole shop');
});

test('D-1: unknown always degrades to clarification_required - never to a product', () => {
  const depsSrc = fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8');
  const fn = depsSrc.slice(depsSrc.indexOf('async function realInterpretAnswer'));
  const body = fn.slice(0, fn.indexOf('\nasync function realRecordAnswerLearning'));
  // Every degraded return goes through one helper, so there is one place to
  // check and no second path that could quietly return something else.
  assert.match(body, /const unreadable = \(why\) => \(\{\s*decision_kind: 'clarification_required'/,
    'the degraded-path helper has changed shape - re-check every failure return');
  // And the grounding check exists: an id the model was not shown is refused.
  assert.match(body, /allowedIds\.has\(id\)/,
    'the interpreter does not check the returned id against the evidence it was given');
});

// =====================================================================
// THE TERRA BINDING - DISCRIMINATING, NOT MERELY GREEN
//
// Warwick asked for evidence "that would fail if somebody quietly switched
// this back to `reason`". A test that only asserts "an interpreter is bound"
// is green either way, and that is exactly how the substitution got in once
// already.
//
// So these assert the SPECIFIC binding. Rebinding the answer path to `reason`
// turns them RED; restoring Terra turns them GREEN.
//
// ZERO MODEL SPEND: the gateway is never reached. The wire-body tests load
// models.mjs with a fake FUSION_GATEWAY_URL and capture `fetch`, so the body
// is asserted without a request leaving the process.
// =====================================================================

const MODELS_PATH = path.join(HERE, '..', '..', 'obsidiwikai', 'src', 'core', 'models.mjs');
const MODELS_URL = pathToFileURL(MODELS_PATH).href;
let bust = 0;

/** Load models.mjs under a controlled environment - the same technique
 *  services/asdair/transcribe/visionRole.test.js already uses. */
async function loadModels(env) {
  const keys = ['FUSION_GATEWAY_URL', 'FUSION_GATEWAY_KEY', 'FUSION_MODEL_ANSWER'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return await import(`${MODELS_URL}?bust=${++bust}`);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

function interpreterBody() {
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  const fn = depsSrc.slice(depsSrc.indexOf('async function realInterpretAnswer'));
  return fn.slice(0, fn.indexOf('\nasync function realRecordAnswerLearning'));
}

test('TERRA: EVERY model import and EVERY model call on the answer path is Terra', () => {
  // ── THIS IS AN ABSENCE PROPERTY, AND TWO EARLIER VERSIONS GOT THAT WRONG. ──
  //
  // Warwick's requirement is "would fail if somebody quietly switched this
  // back". That is a claim about what must NOT be reachable - so a presence
  // check can never satisfy it, however specific the thing it looks for.
  //
  // V1 checked `await answer(` present, `await reason(` absent. Defeated by:
  //     const { reason: answer, answerModel } = await import('...models.mjs');
  // The alias rebinds everything while every call site still reads `answer`.
  //
  // V2 re-pinned to the import specifier's SOURCE names, which kills the alias
  // - but used .exec(), which returns the FIRST match only, and kept
  // `assert.match(body, /await answer\(/)`, a PRESENCE check that cannot tell
  // one-of-two calls from two-of-two. Defeated by a SECOND import:
  //     const { answer, answerModel } = await import('...models.mjs'); // honest
  //     const { reason }              = await import('...models.mjs'); // added
  //     let parsed = await extractJson(await reason(prompt));   // PRIMARY call
  //     if (...) parsed = await extractJson(await answer(       // retry only
  // 290/290 green with every real answer going to fusion.reason and only the
  // strict-JSON retry touching Terra.
  //
  // That is the dangerous one, because it is what a WELL-MEANING edit looks
  // like: "reason is fine for the first pass, keep Terra for the retry."
  // Nobody doing it would think they were doing anything wrong.
  //
  // So this asserts two absences over the WHOLE body, not one presence:
  //   1. across EVERY import of the gateway module, the union of source names
  //      is exactly {answer, answerModel};
  //   2. EVERY awaited model callee is `answer` - not "at least one is".
  const body = interpreterBody();

  // ── 1. EVERY import, not the first. matchAll, never exec. ────────────────
  const imports = [...body.matchAll(
    /const\s*\{([^}]*)\}\s*=\s*await import\('\.\.\/\.\.\/obsidiwikai\/src\/core\/models\.mjs'\)/g,
  )];
  assert.ok(imports.length > 0, 'the interpreter no longer imports from the gateway module at all');

  const sourceNames = [...new Set(
    imports.flatMap((m) => m[1].split(',').map((s) => s.trim().split(':')[0].trim()))
      .filter((s) => s !== ''),
  )].sort();

  assert.deepEqual(sourceNames, ['answer', 'answerModel'],
    `the answer interpreter imports {${sourceNames.join(', ')}} from the gateway module across `
    + `${imports.length} import(s). It must import EXACTLY answer and answerModel. Warwick ruled: `
    + '"Do NOT substitute `reason` because it is easier to reach" - and reaching it through a '
    + 'second import, or under an alias, is the substitution rather than an exception to it.');

  // ── 2. EVERY model call is Terra. A count, not a presence check. ─────────
  // Any awaited callee that is a known model-invoking name must be `answer`.
  // Naming the forbidden set explicitly is what makes this an ABSENCE claim:
  // a new role added to models.mjs and used here would have to be added to
  // this set deliberately, which is the review moment.
  const MODEL_CALLEES = new Set(['answer', 'reason', 'vision', 'generate', 'lightrag']);
  const modelCalls = [...body.matchAll(/await\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((m) => m[1])
    .filter((name) => MODEL_CALLEES.has(name));

  assert.ok(modelCalls.length > 0, 'the interpreter makes no model call at all');
  assert.deepEqual([...new Set(modelCalls)], ['answer'],
    `the answer path invokes {${[...new Set(modelCalls)].join(', ')}}. EVERY model call on this `
    + 'path must be answer(). A path where the primary call is reason() and only the retry is '
    + 'answer() sends every real free-text answer to the wrong model.');
});

test('TERRA: the wire body names the Terra model, not a role alias', async () => {
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://gateway.invalid/v1' });
  const realFetch = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
  };
  try {
    await m.answer('interpret this');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(body.model, 'gpt-5.6-terra',
    'the answer role did not resolve to Terra. Warwick chose it deliberately and ruled that '
    + 'fusion.query must NOT be silently assumed to map to it.');
  assert.notEqual(body.model, 'fusion.reason', 'the answer path is using the reason alias');
  assert.equal(body.messages[0].content, 'interpret this');
  assert.equal(body.stream, false);
});

test('TERRA: the model is overridable by env and resolved at CALL time', async () => {
  // The environment is manipulated around the CALL, not around the import -
  // which is the whole distinction being tested. A module that captured the
  // alias at import would return the value present when it was loaded and
  // could never report a mid-life configuration change; the durable row would
  // then name a model that had not answered for some time.
  const m = await loadModels({ FUSION_GATEWAY_URL: 'http://gateway.invalid/v1' });

  const saved = process.env.FUSION_MODEL_ANSWER;
  try {
    delete process.env.FUSION_MODEL_ANSWER;
    assert.equal(m.answerModel(), 'gpt-5.6-terra', 'the default must be Terra');

    process.env.FUSION_MODEL_ANSWER = 'gpt-5-mini';
    assert.equal(m.answerModel(), 'gpt-5-mini',
      'a deliberate box override must be honoured, and seen WITHOUT reloading the module');

    delete process.env.FUSION_MODEL_ANSWER;
    assert.equal(m.answerModel(), 'gpt-5.6-terra', 'and it must follow the environment back');
  } finally {
    if (saved === undefined) delete process.env.FUSION_MODEL_ANSWER;
    else process.env.FUSION_MODEL_ANSWER = saved;
  }
});

test('TERRA: no gateway THROWS - it never falls back to the box model', async () => {
  const m = await loadModels({});
  assert.equal(m.gatewayConfigured, false);
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched += 1; throw new Error('should never be called'); };
  try {
    await assert.rejects(() => m.answer('x'), /no gateway configured/,
      'answer() fell back instead of throwing - a different model would have decided the shop');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(fetched, 0, 'a request was attempted with no gateway configured');
});

test('TERRA: reason() keeps its box fallback - the reasoning role is unchanged', async () => {
  // Adding the answer role must not quietly change behaviour for anything else
  // in the estate that already depends on reason().
  const m = await loadModels({});
  assert.equal(typeof m.reason, 'function');
  const src = fs.readFileSync(MODELS_PATH, 'utf8');
  assert.match(src, /export async function reason\(prompt\) \{[\s\S]{0,200}?lightrag\.generate\(prompt\)/,
    'reason() changed - this Work Order must not alter the reasoning role');
});

test('TERRA: ROLE_ALIAS is byte-identical - the out-of-surface pin still holds', async () => {
  // services/asdair/transcribe/visionRole.test.js deepEquals this object and is
  // OUTSIDE this Work Package's surface, so the answer model is resolved by
  // answerModel() rather than by a new ROLE_ALIAS key. Reported to Larry.
  const m = await loadModels({});
  assert.deepEqual(m.ROLE_ALIAS, {
    extract: 'fusion.extract',
    keyword: 'fusion.keyword',
    query: 'fusion.query',
    reason: 'fusion.reason',
    embed: 'fusion.embed',
    vision: 'fusion.vision',
  });
});

test('TERRA: provenance agrees with the path invoked - interpreted_by terra is now TRUE', () => {
  const body = interpreterBody();
  assert.match(body, /const invoked = answerModel\(\);/,
    'the recorded model is no longer resolved at call time from answerModel()');
  assert.match(body, /model: invoked/, 'the returned provenance is not the invoked alias');
  assert.doesNotMatch(body, /ANSWER_MODEL_LABEL/, 'the superseded reason-role label is back');

  // runPipeline still hard-codes interpreted_by: 'terra' - the claim this order
  // exists to make TRUE, not to soften. 017's vocabulary was not widened.
  assert.match(runPipelineSrc, /interpreted_by: 'terra'/,
    'interpreted_by was changed instead of being made true - Warwick refused widening the vocabulary');
});

// =====================================================================
// D-2 - the park has a voice, and it is renderable
// =====================================================================

test('D-2: the line-resolution park QUEUES a card', () => {
  assert.match(runPipelineSrc, /kind:\s*'lines_unresolved'/,
    'the AWAIT_LINE_RESOLUTION park queues nothing - the shop stops and nobody is told');
  assert.match(runPipelineSrc, /outboxEverQueued\(deps, shop\.id, 'lines_unresolved'\)/,
    'the card is not guarded by outboxEverQueued, so it would be re-queued on every pass');
});

test('D-2: the card is queued BEFORE the park returns, on the park branch only', () => {
  const at = runPipelineSrc.indexOf("kind: 'lines_unresolved'");
  assert.notEqual(at, -1);
  const before = runPipelineSrc.slice(Math.max(0, at - 1200), at);
  assert.match(before, /gate\.step === STEPS\.AWAIT_LINE_RESOLUTION/,
    'the card is not gated on the line-resolution park - it could fire on an unrelated pass');
});

test('D-2: a renderer exists for the queued kind, so the card can actually be SENT', async () => {
  // A queued message with no renderer is a row in a table, not a notification.
  // This is the seam that turns "queued" into "on his phone".
  const { MESSAGES } = await import('../bot/renderMessages.js');
  assert.equal(typeof MESSAGES.lines_unresolved, 'function',
    'lines_unresolved is queued but has no renderer - it would never reach Warwick');
});

test('D-2: the rendered card names what is stuck and states that nothing was ordered', async () => {
  const { MESSAGES } = await import('../bot/renderMessages.js');
  const card = MESSAGES.lines_unresolved({
    shopRef: 'SHOP-2026-08-03',
    items: ['Ariel Pods', 'fruit splits'],
    unresolvedCount: 2,
    awaitingClarification: 1,
  });
  assert.equal(typeof card.text, 'string');
  assert.ok(card.text.includes('Ariel Pods'), 'the card must name what it is waiting on');
  assert.ok(card.text.includes('fruit splits'));
  assert.match(card.text, /nothing has been ordered/i,
    'a stuck shop must say plainly that nothing was bought');
  assert.ok(card.reply_markup, 'the card must give him a way to act on it');
});

// =====================================================================
// LANE C - THE BROWSER OPERATING CONTRACT IS ON THE PRODUCTION ROUTE
//
// Warwick, 2026-08-09: "THE PROVEN BROWSER OPERATING CONTRACT EXISTS, BUT THE
// PRODUCTION ROUTE DOES NOT ENFORCE IT."
//
// `buildExecutionPacket`, `buildHandoff` and `verifyBasket` were complete,
// tested, and had ZERO production callers. Their suites were green - 104, 109
// and 106 tests - and none of it said anything about whether a real shop ever
// reached them. These tests ask the only question those suites cannot: does the
// live route actually get there, from the runtime entry, without a stub.
// =====================================================================

const runtimeSrc = stripComments(fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'));

test('LANE C: the browser build step reaches buildHandoff - and no longer takes the payload-less route', async () => {
  const mod = await import('./runPipeline.js');
  assert.equal(typeof mod.buildBrowserHandoff, 'function',
    'buildBrowserHandoff is the production producer for the browser handoff and must be reachable');

  // The dispatch REALLY arrives at it: QUEUE_BROWSER_BUILD -> stepQueueBrowserBuild
  // -> buildBrowserHandoff -> buildHandoff. Asserted on source rather than on a
  // call spy, because a spy would prove only that a test could reach it.
  const step = runPipelineSrc.slice(runPipelineSrc.indexOf('async function stepQueueBrowserBuild'));
  const body = step.slice(0, step.indexOf('\n}\n'));
  assert.match(body, /buildBrowserHandoff\(deps, shop\)/,
    'stepQueueBrowserBuild does not build a handoff. That WAS the defect: it queued a bare request and the '
    + 'operating contract reached nobody.');
  assert.match(body, /openHandoff\(/,
    'the request must be opened through the durable handoff lifecycle, which carries the artefact');
  assert.doesNotMatch(body, /requestBrowserBuild/,
    'stepQueueBrowserBuild still uses shopStore.requestBrowserBuild, which inserts (shop_id, status) and '
    + 'nothing else - a request that physically cannot carry what the worker must be told.');

  assert.match(runPipelineSrc, /buildHandoff\(packet, \{ operatingRules/,
    'buildBrowserHandoff must call the producer that stamps the method onto the artefact');
});

test('LANE C: the packet producer is reached on the same path', () => {
  assert.match(runPipelineSrc, /buildExecutionPacket\(\{/,
    'nothing on the live route builds an execution packet, so buildExecutionPacket still has no production caller');
  assert.match(runPipelineSrc, /from '\.\.\/packet\/buildExecutionPacket\.js'/,
    'the packet producer must be the real module, not a local re-implementation');
});

test('LANE C: verifyBasket has a production caller on the RETURN leg', () => {
  assert.match(runtimeSrc, /require[A-Za-z]*\('\.\.\/reconcile\/verifyBasket\.js'\)/,
    'runtime.js does not import verifyBasket, so the return leg still verifies nothing');
  assert.match(runtimeSrc, /return verifyBasket\(toVerifyBasketArgs\(/,
    'verifyBasket must actually be CALLED - an import with no call site is the same zero-caller defect');
});

test('LANE C: realWiring SUPPLIES verificationFor, so the handback can be truthful', async () => {
  const wiring = runtimeSrc.slice(runtimeSrc.indexOf('async function realWiring'));
  assert.match(wiring, /verificationFor: makeVerificationFor\(deps\)/,
    'realWiring returns the production wiring object and did not put a verificationFor on it. queueShopCards '
    + 'reads `wiring.verificationFor || null`, so without this every basket-ready handback renders NOT VERIFIED '
    + 'by omission - a check reported as absent because it was never wired, which is the AC4 lie.');

  const mod = await import('./runtime.js');
  assert.equal(typeof mod.makeVerificationFor, 'function');
});

test('LANE C: with no completion report recorded, verification is NULL - never a false verified', async () => {
  const { makeVerificationFor } = await import('./runtime.js');

  // A durable request exists and the worker has said nothing yet. The only
  // honest answer is "no capture has been recorded", which is null - and
  // queueShopCards renders that as a loud NOT VERIFIED.
  const verificationFor = makeVerificationFor({
    readQuery: async () => ({ rows: [{ id: 7, shop_id: 1, status: 'claimed', progress: { handoff: { packet_fingerprint: 'fp' } } }] }),
  });
  assert.equal(await verificationFor({ id: 1, shop_ref: 'SHOP-2026-08-03' }), null,
    'a shop whose worker has not reported must never be reported as verified');

  const noRequest = makeVerificationFor({ readQuery: async () => ({ rows: [] }) });
  assert.equal(await noRequest({ id: 1, shop_ref: 'SHOP-2026-08-03' }), null);
});

test('D-2: every kind the pipeline queues has a renderer - the general form of the defect', async () => {
  // D-2 was "queued with no voice". This is the same question asked of every
  // kind, so the next one fails here instead of in production.
  const { MESSAGES } = await import('../bot/renderMessages.js');

  // Scoped to the OUTBOX enqueue calls specifically. A bare `kind:` scan also
  // catches `source_kind: 'text'` and `resolution: { kind: 'none' }`, neither
  // of which is an outbox message - and a control that reports on ground it
  // did not examine is worse than no control.
  const kinds = new Set(
    [...runPipelineSrc.matchAll(/store\.enqueueMessage\(deps,\s*\{([\s\S]{0,400}?)\}\)/g)]
      .map((m) => /(?<![\w_])kind:\s*'([a-z_]+)'/.exec(m[1]))
      .filter((m) => m !== null)
      .map((m) => m[1]),
  );
  assert.ok(kinds.size > 0, 'no queued outbox kinds found - this test would prove nothing');

  const voiceless = [...kinds].filter((k) => typeof MESSAGES[k] !== 'function');
  assert.deepEqual(voiceless, [],
    `these kinds are queued but have no renderer, so they can never reach Warwick: ${voiceless.join(', ')}`);
});

// =====================================================================
// WP-B15-A1 - THE FREE-TEXT ANSWER PATH IS GENUINELY WIRED
//
// Same discipline as D-1 above, for the same reason: a correlator that exists,
// is tested and is bound by nothing would make free text work in every test and
// in no real week. The unit tests inject their own correlator, so only this file
// can see whether production has one.
//
// The PRODUCTION CALL PATH this proves, by file and line:
//   runtime.js  main()            -> realWiring(deps)      binds bot.routeAsdairUpdate
//   runtime.js  runOnce()         -> loadOpenQuestions()   reads every open question
//   runtime.js  runOnce()         -> claim -> correlateTypedAnswer()
//   runtime.js  correlateTypedAnswer -> deps.correlateAnswer  (bound in deps.js)
//   runtime.js  claim             -> bot.routeAsdairUpdate -> intentToCommands
//   runtime.js  claim             -> commands.dispatch(ANSWER_QUESTION)
//   commands.js answerQuestion    -> shopStore.answerQuestion (the durable CAS)
//
// ZERO MODEL SPEND, ZERO DATABASE - the wiring is asserted, never invoked.
// =====================================================================

// `runtimeSrc` is DELIBERATELY NOT re-declared here. Lane A and Lane C each
// added an identical `const runtimeSrc = stripComments(readFileSync(runtime.js))`
// at the head of their own section; git merged both without a conflict and the
// whole FILE then failed to parse - which does not report its tests as failing,
// it removes them from the run. The single declaration above (in the Lane C
// section) is the one both sections read, and every assertion of both lanes is
// kept. Sharing the binding is the fix; dropping either lane's claims is not.
const routerSrc = stripComments(fs.readFileSync(path.join(HERE, '..', 'bot', 'inboundRouter.js'), 'utf8'));
const rendererSrc = stripComments(fs.readFileSync(path.join(HERE, '..', 'bot', 'renderMessages.js'), 'utf8'));

test('A1: the REAL production container supplies a callable correlateAnswer', () => {
  const deps = createDeps();
  assert.equal(typeof deps.correlateAnswer, 'function',
    'nothing binds correlateAnswer, so a typed message can never be matched to one of several open questions in production');
});

test('A1: correlateAnswer is BOUND TO TERRA, not to the cheaper `reason` route', () => {
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  const at = depsSrc.indexOf('async function realCorrelateAnswer');
  assert.notEqual(at, -1, 'realCorrelateAnswer is gone - the binding above is pointing at something else');
  const body = depsSrc.slice(at, at + 2000);
  assert.ok(body.includes('answerModel()'),
    'the model actually invoked must be recorded at call time, never a name we hoped was invoked');
  assert.ok(!/\breason\s*\(/.test(body),
    'Warwick ruled the answer path is Terra and must NOT be substituted with `reason`');
});

test('A1: the consumer and the provider agree on the name', () => {
  // The D-1 failure was exactly this: a consumer reading one name and a
  // container binding none. Asserted on both sources, not on a call.
  assert.ok(runtimeSrc.includes('deps.correlateAnswer'), 'runtime does not consume the correlator');
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  assert.ok(/correlateAnswer:\s*realCorrelateAnswer/.test(depsSrc),
    'deps.js does not bind correlateAnswer to its real implementation');
});

test('A1: the production loop reads open questions BEFORE intake runs', () => {
  // ROUTE FIRST is an ORDER, and the order is the guarantee: the claim has to be
  // decided while the message is still in intake's hand and before its offset is
  // acknowledged. If loadOpenQuestions moved below pollIntake, the claim would
  // be taken against a stale picture - or not at all.
  const at = runtimeSrc.indexOf('export async function runOnce');
  assert.notEqual(at, -1);
  // THE WINDOW IS THE FUNCTION, NOT A CHARACTER COUNT. A fixed 4000-char slice
  // made this control LIE once already: runOnce grew past it, `pollIntake` fell
  // outside the window, indexOf returned -1, and `x < -1` reported the wiring
  // BROKEN while the order was still correct. A control whose verdict depends on
  // the length of the code it inspects is not a control.
  const nextExport = runtimeSrc.indexOf('\nexport ', at + 1);
  const body = runtimeSrc.slice(at, nextExport === -1 ? runtimeSrc.length : nextExport);
  const loadAt = body.indexOf('loadOpenQuestions');
  const pollAt = body.indexOf('pollIntake');
  // ASSERT BOTH WERE FOUND, then compare - otherwise a rename reads as a
  // comparison of two -1s, which is a verdict about nothing.
  assert.notEqual(loadAt, -1, 'runOnce no longer reads the open questions at all');
  assert.notEqual(pollAt, -1, 'runOnce no longer polls intake at all');
  assert.ok(loadAt < pollAt,
    'intake is polled before the open questions are known - routing cannot claim anything');
});

test('A1: the claim is handed to runIntake, not applied after the fact', () => {
  const at = runtimeSrc.indexOf('export async function pollIntake');
  assert.notEqual(at, -1);
  const body = runtimeSrc.slice(at, at + 3000);
  assert.ok(/runIntake\({[\s\S]*claim,/.test(body),
    'pollIntake does not pass the claim to runIntake, so the decision cannot happen before the offset moves');
});

test('A1: the production router accepts a bare typed message', () => {
  // The exact defect: only `reply_to_message` reached ACTIONS.ANSWER, so a plain
  // message fell out of the bottom of the function as NOT_ASDAIR.
  assert.ok(routerSrc.includes('resolveAnswersByText'),
    'the router has no free-text correlation path - question 76463 would still be dropped');
  assert.ok(routerSrc.includes('UNCORRELATED_TEXT'),
    'an uncorrelated typed message has no distinct refusal, so a genuine list is indistinguishable from a miss');
});

test('A1: EVERY outbox kind runtime can enqueue has a renderer - or it is silently discarded', () => {
  // drainOutbox resolves a row whose kind is not in MESSAGES as `abandoned`. A
  // new kind without a renderer is therefore not a quiet no-op: the message is
  // thrown away and nobody is told, which is the exact silent-drop this Work
  // Package exists to close. This test walks the SOURCE for enqueued kinds so a
  // future kind cannot be added without its renderer.
  // Scoped to the enqueueMessage CALL SITES, not to every `kind:` in the file:
  // `sourceKind` and payload discriminators use the same word and are not
  // message kinds.
  const kindsEnqueuedIn = (src) => [...src.matchAll(/enqueueMessage\(/g)]
    .map((m) => src.slice(m.index, m.index + 600))
    .map((call) => (call.match(/\bkind:\s*'([a-z_]+)'/) || [])[1])
    .filter((k) => typeof k === 'string');

  const enqueued = new Set([...kindsEnqueuedIn(runPipelineSrc), ...kindsEnqueuedIn(runtimeSrc)]);
  assert.ok(enqueued.size > 0, 'no enqueued outbox kind was found - this test would be passing on nothing');
  assert.ok(enqueued.has('clarification_deferred'), 'the new deferred-clarification kind is not enqueued anywhere');

  for (const kind of enqueued) {
    assert.ok(
      new RegExp(`\\n\\s+${kind}:\\s`).test(rendererSrc.slice(rendererSrc.indexOf('export const MESSAGES'))),
      `outbox kind "${kind}" has no renderer registered in MESSAGES - drainOutbox will abandon it silently`,
    );
  }
});

test('A1: the deferred clarification is TOLD, and the reading gate is untouched', () => {
  // Warwick's ruling: the round-2 CARD still waits for the reading confirmation,
  // and he is told now. Both halves are asserted, because removing either one
  // re-opens a real defect - dropping the gate loses the shop-6 recovery, and
  // dropping the notice restores the silent park.
  assert.ok(runPipelineSrc.includes('wantsClarification && !readingConfirmed'),
    'the reading-confirmation gate has been weakened - it is load-bearing and predates this change');
  const at = runPipelineSrc.indexOf('wantsClarification && !readingConfirmed');
  // THE WINDOW IS THE BRANCH, NOT A BYTE COUNT. This slice was `at + 1200`, and
  // 1200 is a number about the length of a comment rather than about the code:
  // B15-3 FIX1 added a guard and the branch's own `continue` fell out of the
  // window, failing a test whose property was untouched. The branch ends where
  // the ordinary round-opening code resumes, so that is where the window ends -
  // it cannot drift, and it cannot silently swallow the next branch either.
  const endsAt = runPipelineSrc.indexOf('const nextRound', at);
  assert.ok(endsAt > at, 'the deferral branch no longer runs into the round-opening code - re-read this test');
  const body = runPipelineSrc.slice(at, endsAt);
  assert.ok(body.includes('clarification_deferred'),
    'a deferred clarification is silent again - Warwick is not told what could not be read');
  assert.ok(body.includes('continue'),
    'the deferral itself must remain: the question card still waits for the reading confirmation');

  // ── B15-3 FIX1: AND IT IS TOLD ONCE ────────────────────────────────────────
  // The same shape as the lines_unresolved guard asserted above, and for the
  // same reason: an unguarded enqueue re-queues on every pass, which is not a
  // theoretical risk here - it put eighteen identical cards on Warwick's phone
  // in seventeen minutes. Asserted on the SOURCE so the guard cannot be dropped
  // while the behavioural proofs in runPipeline.test.js still describe it.
  assert.match(body, /spentLedgerGenerations\(deps, noticeFamily\)/,
    'the once-per-held-line guard is gone - a stuck shop becomes a stream of identical cards again');
  assert.ok(!/outboxEverQueued\(deps, shop\.id, 'clarification_deferred'\)/.test(body),
    'a per-KIND guard here would silence every held line but the first - it must be per FAMILY');
});

// =====================================================================
// WP-B15-3 R2 - THE HOUSEHOLD'S PROSE RULEBOOK IS ON THE PRODUCTION ROUTE
//
// The SAME defect as D-1, A1 and Lane C, for the fourth time on this build:
// `skill/rulebook.js` was complete, tested to 29/29 with mutation proofs in
// both directions, and imported by NOTHING except its own two test files.
// Veritas measured that at Gate 1 - all five of its exports reachable only
// from rulebook.test.js and ruleConsumption.test.js.
//
// So the property these tests hold is the one Veritas measured, made
// executable: FROM THE RUNTIME ENTRY POINT, FOLLOWING ONLY PRODUCTION CODE,
// applyRulebook is reached - with no test-only hop anywhere in the chain.
//
// A green rulebook.test.js says nothing about this. Only a walk of the real
// files can, which is why the chain below is walked from the filesystem and
// every hop is asserted to be a production file.
//
// ZERO MODEL SPEND, ZERO DATABASE. The wiring is asserted, never invoked.
// =====================================================================

/**
 * The chain, hop by hop, from the process entry point to the module.
 *
 * Each hop names the FILE the evidence must be found in and the exact text
 * that proves the hop is taken. Written as data rather than as prose so that
 * breaking any single link fails HERE, naming which link broke, instead of
 * failing somewhere downstream on a Sunday.
 */
const RULEBOOK_CHAIN = [
  {
    file: 'runtime.js',
    hop: 'main() builds the REAL dependency container',
    evidence: [/await import\('\.\/deps\.js'\)/, /createDeps\(\)/],
  },
  {
    file: 'runtime.js',
    hop: 'the loop advances a shop through runPipeline',
    evidence: [/from '\.\/runPipeline\.js'/, /await runPipeline\(\{ shopId: shop\.id \}, deps\)/],
  },
  {
    file: 'runPipeline.js',
    hop: 'every plan recomputation goes through planWithDecisions',
    evidence: [/async function planWithDecisions/, /planWithDecisions\s*\(/],
  },
  {
    file: 'runPipeline.js',
    hop: 'planWithDecisions calls applyRulebook on the REAL module',
    evidence: [/requireCjs\('\.\.\/skill\/rulebook\.js'\)/, /await applyRulebook\(\{/],
  },
];

/** Read a production file from disk, comments stripped. CRLF-safe: nothing
 *  here splits on a bare '\n'. */
function productionSource(file) {
  return stripComments(fs.readFileSync(path.join(HERE, file), 'utf8'));
}

test('R2: applyRulebook is REACHED from the runtime entry point, with no test-only hop', () => {
  // 1. Every hop is a PRODUCTION file. A chain that passes through a test
  //    helper proves only that a test could reach the module, which is exactly
  //    the evidence this build already has too much of.
  for (const link of RULEBOOK_CHAIN) {
    assert.doesNotMatch(link.file, /\.test\.js$/,
      `the chain passes through the test file ${link.file} - that is a test-only hop`);
    assert.doesNotMatch(link.file, /(^|[\\/])test[\\/]/,
      `the chain passes through the test directory at ${link.file} - that is a test-only hop`);
  }

  // 2. Every hop is actually taken, in the real source.
  for (const link of RULEBOOK_CHAIN) {
    const src = productionSource(link.file);
    for (const proof of link.evidence) {
      assert.match(src, proof,
        `the production chain is broken at ${link.file}: ${link.hop}. `
        + `Expected ${proof} in the real source. Without this hop skill/rulebook.js is back to `
        + 'being a module reachable only from its own tests, which is Veritas D1.');
    }
  }

  // 3. The call site is inside planWithDecisions specifically - the ONE
  //    function permitted to build a plan - and not merely somewhere in the
  //    file. Bounded by the NEXT function declaration rather than by a
  //    line-ending literal: this estate's sources are CRLF, and slicing on
  //    '\n}\n' silently returns -1 here, which widens the body to the whole
  //    remaining file and stops the assertion meaning what it says.
  const runPipelineOnly = productionSource('runPipeline.js');
  const from = runPipelineOnly.indexOf('async function planWithDecisions');
  assert.notEqual(from, -1, 'planWithDecisions has disappeared from runPipeline.js');
  const rest = runPipelineOnly.slice(from + 1);
  const nextDecl = rest.search(/\r?\n(export )?(async )?function /);
  const body = nextDecl === -1 ? rest : rest.slice(0, nextDecl);
  assert.match(body, /await applyRulebook\(\{/,
    'applyRulebook is called somewhere in runPipeline.js but NOT inside planWithDecisions. '
    + 'Every production recomputation goes through that function; a call site outside it applies '
    + "the household's judgement rules to some plans and not others.");
  assert.match(body, /deps\.planBasket\s*\(/, 'the planner call has left planWithDecisions');
  assert.match(body, /applyDecisionsToPlan\s*\(/,
    'planWithDecisions no longer applies the decisions it exists to apply');

  // 4. The module really exports what the chain claims to call.
  const rulebook = createRequire(import.meta.url)('../skill/rulebook.js');
  assert.equal(typeof rulebook.applyRulebook, 'function',
    'skill/rulebook.js does not export applyRulebook - the chain above names a function that is not there');
});

test('R2: the PRECEDENCE is planner -> rulebook -> Warwick, so a human answer is never overruled', () => {
  // Order matters more than presence here. If the rulebook ran AFTER
  // applyDecisionsToPlan, a model judgement could displace an answer Warwick
  // actually gave - which is the one thing the judgement layer must never do.
  const src = productionSource('runPipeline.js');
  const planner = src.indexOf('deps.planBasket');
  const rulebook = src.indexOf('await applyRulebook(');
  const human = src.indexOf('applyDecisionsToPlan({');
  assert.ok(planner !== -1 && rulebook !== -1 && human !== -1, 'one of the three stages is missing');
  assert.ok(planner < rulebook,
    'the rulebook runs before the planner - it has no plan to judge');
  assert.ok(rulebook < human,
    "Warwick's recorded decisions are applied BEFORE the rulebook, so a model judgement can overrule "
    + 'an answer he actually gave. The human is always last.');
});

test('R2: the REAL production container supplies a callable consult', () => {
  // No overrides. This is the container runtime.js main() builds and uses.
  // A deps.X that nothing binds is undefined at runtime while every stubbed
  // test passes - the exact D-1 shape, and applyRulebook THROWS on it the
  // moment a real household rule speaks about a real basket.
  const deps = createDeps();
  assert.equal(typeof deps.consult, 'function',
    'deps.consult is not bound in production. planWithDecisions passes it to applyRulebook, so the '
    + "household's 23 judgement rules would throw on a real shop - and no stubbed test can see that.");
});

test('R2: the consumer and the provider agree on the NAME, exactly', () => {
  assert.match(runPipelineSrc, /consult: deps\.consult/,
    'runPipeline no longer passes deps.consult to applyRulebook - if the seam moved, move this test');
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  assert.match(depsSrc, /consult:\s*realConsultRulebook/,
    'deps.js no longer binds consult to a real implementation');
});

/** The consult body, bounded by the next function declaration. CRLF-safe. */
function consultBody() {
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  const at = depsSrc.indexOf('async function realConsultRulebook');
  assert.notEqual(at, -1, 'realConsultRulebook is gone - the binding is pointing at something else');
  const rest = depsSrc.slice(at + 1);
  const next = rest.search(/\r?\n(export )?(async )?function /);
  return next === -1 ? rest : rest.slice(0, next);
}

test('R2: the rulebook consult is BOUND TO TERRA - every import and every model call', () => {
  // The same ABSENCE property the answer path is held to, and for the same
  // reason Warwick gave: "Do NOT substitute `reason` because it is easier to
  // reach." A presence check ("answer( appears") cannot satisfy that - it stays
  // green when a second import adds reason() as the primary call and leaves
  // answer() on the retry. So this asserts two absences over the WHOLE body.
  const body = consultBody();

  const imports = [...body.matchAll(
    /const\s*\{([^}]*)\}\s*=\s*await import\('\.\.\/\.\.\/obsidiwikai\/src\/core\/models\.mjs'\)/g,
  )];
  assert.ok(imports.length > 0, 'the rulebook consult no longer imports from the gateway module at all');
  const sourceNames = [...new Set(
    imports.flatMap((m) => m[1].split(',').map((s) => s.trim().split(':')[0].trim()))
      .filter((s) => s !== ''),
  )].sort();
  assert.deepEqual(sourceNames, ['answer'],
    `the rulebook consult imports {${sourceNames.join(', ')}} from the gateway module across `
    + `${imports.length} import(s). It must import EXACTLY answer - reaching reason() through a `
    + 'second import, or under an alias, is the substitution rather than an exception to it.');

  const MODEL_CALLEES = new Set(['answer', 'reason', 'vision', 'generate', 'lightrag']);
  const modelCalls = [...body.matchAll(/await\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((m) => m[1])
    .filter((name) => MODEL_CALLEES.has(name));
  assert.ok(modelCalls.length > 0, 'the rulebook consult makes no model call at all');
  assert.deepEqual([...new Set(modelCalls)], ['answer'],
    `the rulebook path invokes {${[...new Set(modelCalls)].join(', ')}}. EVERY model call on this path `
    + 'must be answer(), which is gateway-only and cannot fall back to the box.');

  // credential_scope: none. This function must never read a key or a URL, and
  // must never build its own auth header - the gateway module owns both.
  assert.doesNotMatch(body, /process\.env\.(FUSION_GATEWAY_KEY|OPENAI_API_KEY|[A-Z_]*TOKEN)/,
    'the rulebook consult reads a credential directly - the gateway module owns that');
  assert.doesNotMatch(body, /Authorization|Bearer\s/,
    'the rulebook consult builds its own auth header instead of using the gateway');
  assert.doesNotMatch(body, /lightrag/, 'the rulebook consult reaches the box directly');
});

test('R2: the prompt is built by the module that owns it, not re-written at the wire', () => {
  // The safety envelope the household is protected by is STATED in
  // buildRulebookPrompt. A locally-composed prompt here would be a second,
  // unreviewed copy of it that no rulebook test can see.
  const body = consultBody();
  assert.match(body, /buildRulebookPrompt\(grounding\)/,
    'the consult composes its own prompt instead of using buildRulebookPrompt');
  const depsSrc = stripComments(fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8'));
  assert.match(depsSrc, /require\('\.\.\/skill\/rulebook\.js'\)/,
    'deps.js does not import the real rulebook module');
});

test('R2: the rulebook error path is the module\'s ONE layer - deps.js adds no second catch', () => {
  // applyRulebook already catches a throwing consult: no line changes, every
  // affected line is flagged `rulebook not consulted`, audit.error is set. A
  // second catch at the wire would swallow that and turn a visible degradation
  // into a silent one, which is the failure the module exists to prevent.
  const body = consultBody();
  assert.doesNotMatch(body, /\bcatch\s*[({]/,
    'the rulebook consult catches its own failure. applyRulebook already handles it and makes it '
    + 'VISIBLE on every affected line; catching here hides it.');
  // And the module's single layer is still there to do the job.
  const rulebookSrc = stripComments(
    fs.readFileSync(path.join(HERE, '..', 'skill', 'rulebook.js'), 'utf8'),
  );
  assert.match(rulebookSrc, /addFlag\(item, 'rulebook not consulted'\)/,
    'skill/rulebook.js no longer flags the lines an unreachable consumer left unjudged');
});

// =====================================================================
// WP-B15-46 - THE PRODUCTION CALLER FOR NON-PHOTO PROVENANCE
//
// This is the check Veritas performed BY HAND against WP-B15-40 and which
// failed: it grepped services/asdair for production imports of the provenance
// writer, found exactly one - the PHOTO one - and graded AC1 HOLD because
// REGULARS/RULE/WARWICK were reachable only from a test calling the writer
// directly. The check now lives in the suite so the same regression cannot
// recur silently, and so it is answered by execution rather than by a person
// remembering to grep.
// =====================================================================

test('WP-B15-46: a PRODUCTION caller writes the three non-photo provenance kinds', () => {
  // 1. The caller is on the journey, statically imported by the module that
  //    owns the plan - not injected, so it cannot resolve to undefined (D-1).
  assert.match(runPipelineSrc, /import \{ persistPlanProvenance \} from '\.\/planProvenance\.js'/,
    'runPipeline.js no longer imports the non-photo provenance caller');
  assert.match(runPipelineSrc, /await persistPlanProvenance\(deps, \{/,
    'runPipeline.js imports the provenance caller but never calls it - which is the exact '
    + 'shape of the defect Veritas found: present, wired-looking, and not on the journey');

  // 2. It is called from planWithDecisions, which is the ONE place all three
  //    origins are observable, and therefore from every recomputation.
  const planFn = runPipelineSrc.slice(
    runPipelineSrc.indexOf('export async function planWithDecisions'),
    runPipelineSrc.indexOf('export function listDateOf'),
  );
  assert.ok(planFn.length > 0, 'planWithDecisions could not be located in runPipeline.js');
  assert.match(planFn, /persistPlanProvenance/,
    'the provenance write is no longer inside planWithDecisions, so a recomputation path can miss it');

  // 3. The module genuinely reaches the three writers.
  const provenanceSrc = stripComments(fs.readFileSync(path.join(HERE, 'planProvenance.js'), 'utf8'));
  for (const builder of ['buildRegularsProvenanceRow', 'buildRuleProvenanceRow', 'buildWarwickProvenanceRow']) {
    assert.ok(provenanceSrc.includes(`${builder}(`),
      `planProvenance.js never calls ${builder} - that kind has no production caller`);
  }
  assert.match(provenanceSrc, /insertProvenanceRow\(deps, row\)/,
    'planProvenance.js derives rows but never persists them');

  // 4. AND IT MUST NEVER BE ABLE TO CLAIM PHOTO TRUTH. Only the photo
  //    interpreter, which holds resolved region ids, may build a PHOTO row.
  assert.doesNotMatch(provenanceSrc, /buildPhotoProvenanceRow|insertPhotoProvenanceBatch|'PHOTO'|"PHOTO"/,
    'planProvenance.js references PHOTO - the plan path must never be able to record photograph truth');
});
