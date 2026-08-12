// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/buildAgenticPrompt.test.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC6: PURE, no network - proves
// the prompt-builder includes what AC2 requires (household context, region
// list, the tool-driven re-inspection instruction, the final-answer JSON
// contract with source_region) without asserting brittle exact wording.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgenticPrompt } from './buildAgenticPrompt.js';

test('buildAgenticPrompt: includes every catalogue item and its aliases', () => {
  const text = buildAgenticPrompt({
    catalogueItems: [{ name: 'Weetabix', aliases: ['Weetabix Original', 'wheat biscuits'] }, { name: 'Marmite' }],
    regionNos: [1, 2, 3],
  });
  assert.match(text, /Weetabix/);
  assert.match(text, /Weetabix Original/);
  assert.match(text, /wheat biscuits/);
  assert.match(text, /Marmite/);
});

test('buildAgenticPrompt: an empty catalogue is still buildable (a household with no recorded regulars yet)', () => {
  const text = buildAgenticPrompt({ catalogueItems: [], regionNos: [1, 2] });
  assert.match(text, /no known regulars or favourites/);
});

test('buildAgenticPrompt: lists every region number the model may cite', () => {
  const text = buildAgenticPrompt({ regionNos: [1, 2, 3, 4, 5] });
  assert.match(text, /1, 2, 3, 4, 5/);
});

test('buildAgenticPrompt: instructs re-inspection until the WHOLE page is covered, not just the first pass', () => {
  const text = buildAgenticPrompt({ regionNos: [1, 2] });
  assert.match(text, /request_crop/);
  assert.match(text, /whole page/i);
});

test('buildAgenticPrompt: the final-answer JSON contract requires source_region on every line', () => {
  const text = buildAgenticPrompt({ regionNos: [1, 2] });
  assert.match(text, /"source_region"/);
  assert.match(text, /"raw_reading"/);
  assert.match(text, /"quantity"/);
});

test('buildAgenticPrompt: refuses an empty or missing regionNos - a prompt with nothing to cite is under-specified', () => {
  assert.throws(() => buildAgenticPrompt({ regionNos: [] }), /regionNos is required/);
  assert.throws(() => buildAgenticPrompt({}), /regionNos is required/);
});
