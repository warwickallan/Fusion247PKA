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

test('the prompt still carries the grounding invariant it always had', () => {
  // Guarding my own change: the fix above must not have loosened SOP-021 s1.
  assert.match(promptSrc, /matched_regular_id MUST be an id from the list/);
  assert.match(promptSrc, /DO NOT pick the least-bad candidate/);
  assert.match(promptSrc, /do not add a line that is not visibly there/);
});
