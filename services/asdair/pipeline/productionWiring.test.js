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
