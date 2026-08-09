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
import { fileURLToPath } from 'node:url';

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

test('D-1: no gateway means a CLARIFICATION, never a silent substitute model', () => {
  // `reason()` falls back to the box when FUSION_GATEWAY_URL is unset. That
  // would swap the model deciding Warwick's shop with nothing on the record
  // saying so. The interpreter must refuse and ask instead.
  const depsSrc = fs.readFileSync(path.join(HERE, 'deps.js'), 'utf8');
  const fn = depsSrc.slice(depsSrc.indexOf('async function realInterpretAnswer'));
  const body = fn.slice(0, fn.indexOf('\nasync function realRecordAnswerLearning'));
  assert.match(body, /gatewayConfigured/,
    'the interpreter does not check whether a gateway exists, so it can silently use the box model');
  assert.ok(body.indexOf('gatewayConfigured') < body.indexOf('await reason('),
    'the gateway check must happen BEFORE the model is called');
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
