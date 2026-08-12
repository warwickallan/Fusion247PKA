// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/bandInspection.test.js
//
// WO-2026-08-12-02 (WP-B15-30), AC6 and AC7.
//
// Every model call is a scripted fake. Nothing here touches the network.
//
// AC7's required evidence is a MUTATION PROOF: force the same line into two
// overlapping bands and show it resolves to ONE line - not two, and not a
// dropped duplicate. Both failure directions are asserted, because a
// reconciler that deletes the line passes any test that only counts to one.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBandsIndividually, reconcileAcrossBands, buildBandPrompt } from './bandInspection.js';
import { UNKNOWN_VISIBLE_ITEM } from './lineSchema.js';

const CANDIDATES = [
  { id: '7', name: 'ASDA Crispy Skin-On Fries 750g', aliases: ['chips'] },
  { id: '11', name: 'Lurpak Slightly Salted Butter 200g', aliases: [] },
];
const BANDS = [{ region_no: 2 }, { region_no: 3 }, { region_no: 4 }];
const URLS = { 2: 'data:image/jpeg;base64,AAA', 3: 'data:image/jpeg;base64,BBB', 4: 'data:image/jpeg;base64,CCC' };

const reply = (lines) => ({
  outputText: JSON.stringify({ lines }),
  responseId: 'resp-x',
  usage: { input_tokens: 100, output_tokens: 20 },
  toolCalls: [],
});

const line = (o) => ({
  as_written: '', product_id: null, identified: false, quantity: null, source_region: 2, line_no: 1, ...o,
});

// ── AC6: INDIVIDUAL INSPECTION, NOT BUNDLING ──────────────────────────────

test('AC6: ONE call per band, each carrying exactly ONE image - never a bundle', async () => {
  const seen = [];
  await inspectBandsIndividually({
    bandRegions: BANDS,
    bandImageUrls: URLS,
    candidates: CANDIDATES,
    callModel: async (args) => { seen.push(args); return reply([]); },
  });
  assert.equal(seen.length, 3, 'three bands, three calls');
  for (const call of seen) {
    assert.equal(call.imageUrls.length, 1, 'bundling is exactly what AC6 forbids');
  }
});

test('AC6: no tool and no previous_response_id - the loop is superseded on this path', async () => {
  const seen = [];
  await inspectBandsIndividually({
    bandRegions: BANDS,
    bandImageUrls: URLS,
    candidates: CANDIDATES,
    callModel: async (args) => { seen.push(args); return reply([]); },
  });
  for (const call of seen) {
    assert.deepEqual(call.tools, [], 'a fan-out has no conversation to continue');
    assert.equal(call.previousResponseId, null);
    assert.deepEqual(call.toolOutputs, []);
  }
});

test('AC6: the strict schema is sent on EVERY band call, with the closed candidate enum', async () => {
  const seen = [];
  await inspectBandsIndividually({
    bandRegions: BANDS, bandImageUrls: URLS, candidates: CANDIDATES,
    callModel: async (args) => { seen.push(args); return reply([]); },
  });
  for (const call of seen) {
    assert.equal(call.textFormat.type, 'json_schema');
    assert.equal(call.textFormat.strict, true, 'strict:true IS the enforcing switch');
    const ids = call.textFormat.schema.properties.lines.items.properties.product_id.enum;
    assert.deepEqual(ids, ['7', '11', 'UNKNOWN_VISIBLE_ITEM', 'NOT_A_LINE']);
  }
});

test('AC6: source_region is the APPLICATION\'s fact - a model claiming another band is overwritten', async () => {
  const out = await inspectBandsIndividually({
    bandRegions: BANDS,
    bandImageUrls: URLS,
    candidates: CANDIDATES,
    // The model claims region 99 for every line. It cannot be believed and it
    // does not need to be: the application knows which band it sent.
    callModel: async () => reply([{ as_written: 'milk', product_id: '11', source_region: 99, quantity: null }]),
  });
  assert.deepEqual(out.lines.map((l) => l.source_region), [2, 3, 4]);
});

test('AC6: each band\'s schema offers only ITS OWN region number', async () => {
  const seen = [];
  await inspectBandsIndividually({
    bandRegions: BANDS, bandImageUrls: URLS, candidates: CANDIDATES,
    callModel: async (args) => { seen.push(args); return reply([]); },
  });
  const enums = seen.map((c) => c.textFormat.schema.properties.lines.items.properties.source_region.enum);
  assert.deepEqual(enums, [[2], [3], [4]]);
});

test('AC6: a band with NO rendered crop fails LOUDLY - never a silent skip', async () => {
  await assert.rejects(
    () => inspectBandsIndividually({
      bandRegions: BANDS, bandImageUrls: { 2: URLS[2] }, candidates: CANDIDATES, callModel: async () => reply([]),
    }),
    /no rendered crop for band region 3/,
    'a band nobody looked at would make the coverage proof a lie',
  );
});

test('AC6: line numbering is continuous across bands, and cost/calls are reported', async () => {
  const out = await inspectBandsIndividually({
    bandRegions: BANDS,
    bandImageUrls: URLS,
    candidates: CANDIDATES,
    callModel: async () => reply([{ as_written: 'a' }, { as_written: 'b' }]),
  });
  assert.deepEqual(out.lines.map((l) => l.line_no), [1, 2, 3, 4, 5, 6]);
  assert.equal(out.calls, 3);
  assert.ok(out.totalCostUsd > 0);
});

test('AC6: an unparseable band answer is recorded as a parse failure, not as zero lines', async () => {
  const out = await inspectBandsIndividually({
    bandRegions: [{ region_no: 2 }],
    bandImageUrls: URLS,
    candidates: CANDIDATES,
    callModel: async () => ({ outputText: 'sorry, I cannot', responseId: 'r', usage: null, toolCalls: [] }),
  });
  assert.equal(out.perBand[0].parseFailed, true);
  assert.equal(out.perBand[0].lineCount, null, 'null says "we do not know", 0 would say "there was nothing there"');
});

test('AC6: the band prompt tells the model to report an overlapping line ANYWAY', () => {
  const p = buildBandPrompt({ candidateBlock: '- 1: x', bandNo: 2, bandCount: 7 });
  assert.match(p, /OVERLAP/i);
  assert.match(p, /Report it anyway/i);
  assert.match(p, /CROSSED-OUT line is NOT a purchase/i);
});

// ── AC7: THE MUTATION PROOF ───────────────────────────────────────────────

test('AC7 MUTATION PROOF: the SAME line forced into two overlapping bands resolves to ONE line', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({
        line_no: 1, as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 2,
      }),
      line({
        line_no: 2, as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 3,
      }),
    ],
  });
  // NOT TWO - the duplicate must not survive as a second purchase.
  assert.equal(out.reconciled.length, 1);
  // NOT DROPPED - the line must still be there. A reconciler that deletes it
  // would also satisfy "not two", which is why both directions are asserted.
  assert.equal(out.reconciled[0].as_written, '1 Lurpack butter');
  assert.equal(out.mergedAway, 1);
  // And the overlap must be VISIBLE as having done its job.
  assert.deepEqual(out.reconciled[0].seen_in_regions, [2, 3]);
  assert.equal(out.confirmedByTwoBands, 1);
});

test('AC7 MUTATION PROOF: differing READINGS of the same line still resolve to one', () => {
  // The realistic case: two bands read the same handwriting slightly
  // differently. Identity is unavailable (one band could not name it), so the
  // text similarity has to carry it.
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '2 chips with skins on', source_region: 2 }),
      line({ line_no: 2, as_written: '2 chips with skins', source_region: 3 }),
    ],
  });
  assert.equal(out.reconciled.length, 1);
  assert.equal(out.confirmedByTwoBands, 1);
});

test('AC7: TWO GENUINELY DIFFERENT LINES ARE NEVER MERGED', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 2 }),
      line({ line_no: 2, as_written: '2 chips with skins on', product_id: '7', identified: true, quantity: 2, source_region: 3 }),
    ],
  });
  assert.equal(out.reconciled.length, 2);
  assert.equal(out.mergedAway, 0);
});

test('AC7: the same product at DIFFERENT quantities is two real purchases, never collapsed', () => {
  // The design doc's own worked example. The household buys both.
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '2 milk', product_id: '11', identified: true, quantity: 2, source_region: 2 }),
      line({ line_no: 2, as_written: '4 milk', product_id: '11', identified: true, quantity: 4, source_region: 3 }),
    ],
  });
  assert.equal(out.reconciled.length, 2, 'collapsing these deletes a real purchase');
});

test('AC7: identical readings from NON-ADJACENT bands are NOT merged', () => {
  // A page can legitimately carry the same item twice in two different places,
  // and bands 2 and 5 do not overlap - so there is no overlap explanation for
  // the repeat.
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 2 }),
      line({ line_no: 2, as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 5 }),
    ],
  });
  assert.equal(out.reconciled.length, 2, 'only ADJACENT bands can explain a repeat as overlap');
});

test('AC7: a repeat WITHIN one band is still one line', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '2 Vanish oxi pink', source_region: 3 }),
      line({ line_no: 2, as_written: '2 Vanish oxi pink', source_region: 3 }),
    ],
  });
  assert.equal(out.reconciled.length, 1);
});

test('AC7: two UNKNOWNs with different readings stay two lines', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: 'something illegible', product_id: UNKNOWN_VISIBLE_ITEM, source_region: 2 }),
      line({ line_no: 2, as_written: 'a different scrawl', product_id: UNKNOWN_VISIBLE_ITEM, source_region: 3 }),
    ],
  });
  assert.equal(out.reconciled.length, 2);
});

test('AC7: what was merged is RECORDED - a merge is never invisible', () => {
  const out = reconcileAcrossBands({
    lines: [
      line({ line_no: 1, as_written: '1 Lurpack butter', source_region: 2 }),
      line({ line_no: 2, as_written: '1 Lurpack butter', source_region: 3 }),
    ],
  });
  assert.equal(out.merges.length, 1);
  assert.equal(out.merges[0].merged_line_no, 2);
  assert.equal(out.reconciled[0].merged_from.length, 1);
});

test('AC7: reconciliation is order-independent for the same set of reads', () => {
  const a = [
    line({ line_no: 1, as_written: '1 Lurpack butter', source_region: 2 }),
    line({ line_no: 2, as_written: '1 Lurpack butter', source_region: 3 }),
    line({ line_no: 3, as_written: '2 chips with skins on', source_region: 3 }),
  ];
  const b = [a[2], a[1], a[0]];
  assert.equal(reconcileAcrossBands({ lines: a }).reconciled.length,
    reconcileAcrossBands({ lines: b }).reconciled.length);
});
