// =====================================================================
// BUILD-015 AsdAIr - THE INTAKE SEAM, ASSERTED ON THE PRODUCTION SOURCE.
//
// WHY A SOURCE-LEVEL TEST RATHER THAN A BEHAVIOURAL ONE
//
// This build has paid three times for the same defect: a component that is
// complete, tested and reachable only from its own test file. `skill/rulebook.js`
// sat unused for weeks. `interpretAnswer` was bound in every test and in nothing
// else. The offline suite replaces `deps.resolveAll` wholesale, so a suite can be
// entirely green while the live path passes the resolver NOTHING - which is
// exactly what happened to the household's rules: `loadCatalogue` has selected
// them since the day it was written, and stepInterpret handed them only to the
// model in the prompt.
//
// So these assertions are made against the bytes that actually run. They are
// ugly on purpose: a behavioural test here would pass on a stub.
// pipeline/ is ESM ("type": "module"), so this suite is written the same way
// its neighbours are - see productionWiring.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { makeHarness } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';

const here = import.meta.dirname;
const runPipelineSrc = fs.readFileSync(path.join(here, 'runPipeline.js'), 'utf8');
const depsSrc = fs.readFileSync(path.join(here, 'deps.js'), 'utf8');
const promptSrc = fs.readFileSync(path.join(here, '..', 'interpret', 'groundedPrompt.js'), 'utf8');

test('the live interpret step hands the household RULES to the resolver', () => {
  // CRLF-safe: the estate has lost three controls to a line-splitting assumption.
  const call = /deps\.resolveAll\(\s*readings,\s*regularsOf\(catalogue\)\s*,\s*\{[\s\S]{0,200}?rules:\s*catalogue\.rules/;
  assert.match(runPipelineSrc, call,
    'stepInterpret must pass catalogue.rules to resolveAll - without it rule 11 and rule 50 are advice to a model rather than something the system applies');
});

test('there is still exactly ONE resolveAll call site on the shopping journey', () => {
  const sites = runPipelineSrc.match(/deps\.resolveAll\(/g) || [];
  assert.equal(sites.length, 1,
    'a second call site is how "the rules were applied" becomes true in one place and false in another');
});

test('the pack size the model reports survives the mapping into the pipeline', () => {
  assert.match(depsSrc, /pack_size:\s*Number\.isInteger\(l\.pack_size\)/,
    'realInterpretPhoto must carry pack_size - the field it asks for and used to discard');
  assert.match(runPipelineSrc, /pack_size:\s*l\.pack_size\s*\?\?\s*null/,
    'stepInterpret must carry pack_size onto the reading');
});

test('the prompt asks for the pack size and the order quantity SEPARATELY', () => {
  assert.match(promptSrc, /pack_size/,
    'the reply schema must carry pack_size');
  assert.match(promptSrc, /2 x 4pk orange sport Lucozade/,
    'the worked example of two numbers on one line must be in the prompt - this is the line that lost half of Mum\'s drinks');
});

test('the prompt no longer instructs the reader to collapse a repeated product', () => {
  // The old rule 7 read: "If the same product appears twice, mark the later one
  // possible_duplicate." Mum's two Heinz lines came back as one, and the sausage
  // and beans were never bought. A reading step must report what is on the page.
  assert.doesNotMatch(promptSrc, /If the same product appears twice, mark the later one/,
    'the deduplicating instruction must not come back');
  assert.match(promptSrc, /ONE LINE ON THE PAPER IS ONE LINE IN YOUR ANSWER/,
    'and the reading task must say so explicitly');
});

// ── THE PREPARATION STEP, PROVEN THROUGH THE PIPELINE ITSELF ───────────────
//
// Not a source scan: the pipeline is actually driven, and the ORDER of the
// dependency calls is what is asserted. A preparation step that runs after the
// model has already read the photograph is not a preparation step.

const HOUSEHOLD_ID = 1;
const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

async function interpretOnePhoto(h) {
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // the interpretation
}

test('THE IMAGE IS PREPARED BEFORE THE MODEL IS ASKED TO READ IT', async () => {
  const h = makeHarness({ modelLines: [{ line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 }] });
  await interpretOnePhoto(h);

  const order = h.calls.map((c) => c.dep);
  const prepAt = order.indexOf('prepareImage');
  const modelAt = order.indexOf('interpretPhoto');
  assert.notEqual(prepAt, -1,
    'the photograph went to the model exactly as Telegram compressed it - 720x1280 is where "2 skinny cow bars" came from');
  assert.ok(prepAt < modelAt, 'the image must be prepared BEFORE the model reads it, not after');
});

test('a TYPED list is never image-prepared - there is no photograph', async () => {
  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food', actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  assert.equal(h.calls.some((c) => c.dep === 'prepareImage'), false);
});

test('what the model was SHOWN is recorded durably, beside what it was told', async () => {
  const h = makeHarness({ modelLines: [{ line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 }] });
  await interpretOnePhoto(h);

  const evidence = h.db.pipeline_command.filter((c) => c.command === 'groundingEvidence');
  assert.equal(evidence.length, 1);
  const prep = evidence[0].args.image_preparation;
  assert.ok(prep, 'nothing recorded the pixels the model was given - which is why nobody could tell a good read from a lucky one');
  assert.equal(prep.source_width, 720);
  assert.equal(prep.scale, 2);
  assert.equal(prep.width, 1440);
  assert.equal(prep.prepared, true);

  // Still sanitised: dimensions are not household data, and nothing else leaked.
  const serialised = JSON.stringify(evidence[0]).toLowerCase();
  for (const leak of ['gourmet', 'shopper-media', '.jpg']) {
    assert.ok(!serialised.includes(leak), `the grounding record leaked "${leak}"`);
  }
});

test('the production container binds the preparation step - not just the test harness', async () => {
  // The defect this build has paid for three times is a component that is
  // complete, tested, and reachable only from its own test file.
  const { createDeps } = await import('./deps.js');
  const deps = createDeps();
  assert.equal(typeof deps.prepareImage, 'function',
    'deps.prepareImage is unbound in production, so the live path would send raw pixels while every test passed');
  assert.match(depsSrc, /prepareImage:\s*realPrepareImage/);
  assert.match(runPipelineSrc, /await deps\.prepareImage\(shop\.raw_media_path\)/);
  // And the one place an image can reach the model prepares it even if a caller forgets.
  assert.match(depsSrc, /prepareImage\(imagePath\)\)\.dataUrl/);
});

test('nothing in the intake path rotates the photograph', () => {
  // Rotation was the intuitive fix and it LOST LINES: 37 -> 32 and 34 across
  // the two arms. This is a cheap pin against it being reintroduced as a tidy-up.
  const prepSrc = fs.readFileSync(path.join(here, '..', 'transcribe', 'prepareImage.js'), 'utf8');
  assert.doesNotMatch(prepSrc, /\.rotate\s*\(/, 'prepareImage must never rotate');
  assert.doesNotMatch(runPipelineSrc, /\.rotate\s*\(/);
  assert.doesNotMatch(depsSrc, /\.rotate\s*\(/);
});

test('the prompt still carries the grounding invariant it always had', () => {
  // Guarding my own change: the fix above must not have loosened SOP-021 s1.
  assert.match(promptSrc, /matched_regular_id MUST be an id from the list/);
  assert.match(promptSrc, /DO NOT pick the least-bad candidate/);
  assert.match(promptSrc, /do not add a line that is not visibly there/);
});
