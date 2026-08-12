// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/structuralWins.test.js
//
// WO-2026-08-12-02 (WP-B15-30), AC8: the nine structural wins from WP-B15-29,
// REGRESSION-PROTECTED BY TEST rather than retained by intent.
//
// Warwick listed them and they must not regress. The order's own words: "Assert
// them in tests, so a regression fails a suite rather than being noticed in a
// percentage." A percentage that quietly drops four points is exactly how a
// structural win gets lost.
//
// ── WHAT A TEST HERE CAN AND CANNOT PROVE. STATED, NOT IMPLIED ──────────
// Seven of the nine are properties of code in this repository and are proved
// here outright. TWO are not, and pretending otherwise would be the "control
// that reports on ground it did not examine" failure:
//
//   * "free brand invention impossible" is ultimately a property of the
//     DEPLOYED GATEWAY honouring strict:true. What is proved here is that the
//     application sends the enforcing shape and REFUSES to believe an
//     out-of-enum answer if enforcement ever stops. That is a tripwire on the
//     property, not the property.
//
//   * "region-1 defect fixed" is proved at MODULE level against agenticLoop.js
//     and its crop map. The WP-B15-30 live path no longer exercises it at all:
//     the agentic tool-loop is SUPERSEDED by the per-band fan-out in
//     bandInspection.js - kept working and covered, but not on the live route.
//     Nothing here implies the run demonstrates it.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineSchema, buildTextFormat, buildProductIdEnum,
  UNKNOWN_VISIBLE_ITEM, NOT_A_LINE, ESCAPE_VALUES,
} from './lineSchema.js';
import { groundLines, assertProductIdsInEnum, checkSourceRegionMembership, DEFAULT_LOOK_AGAIN_BELOW } from './groundLines.js';
import { buildAgenticPrompt } from './buildAgenticPrompt.js';
import { cropsForRegions } from './agenticLoop.js';
import { resolveQuantity } from './quantityRule.js';
import { inspectBandsIndividually } from './bandInspection.js';

const CANDIDATES = [
  { id: '7', name: 'ASDA Crispy Skin-On Fries 750g', aliases: ['chips'] },
  { id: '11', name: 'Lurpak Slightly Salted Butter 200g', aliases: [] },
];
const ENUM = buildProductIdEnum(CANDIDATES);
const REGIONS = [1, 2, 3];
const line = (o) => ({
  line_no: 1, as_written: 'x', visible_line: true, product_id: '7', source_region: 2, quantity: null, confidence: 0.9, ...o,
});

// ── WIN 1: CLOSED CANDIDATE ENUM ──────────────────────────────────────────

test('AC8 win 1: the product_id enum is CLOSED to the supplied candidates plus the two escapes', () => {
  const schema = buildLineSchema({ candidates: CANDIDATES, regionNos: REGIONS });
  const ids = schema.properties.lines.items.properties.product_id.enum;
  assert.deepEqual(ids, ['7', '11', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
  assert.equal(ids.includes('999'), false, 'an id nobody supplied must be unrepresentable');
});

// ── WIN 2: strict:true ────────────────────────────────────────────────────

test('AC8 win 2: strict:true is present - the enforcing switch, not decoration', () => {
  const tf = buildTextFormat(buildLineSchema({ candidates: CANDIDATES, regionNos: REGIONS }));
  assert.equal(tf.strict, true);
  assert.equal(tf.type, 'json_schema');
  // The two forbidden shapes: nesting json_schema inside (loud 400) and
  // sending it as response_format (200 with NO constraint - the silent one).
  assert.equal(tf.json_schema, undefined, 'a nested json_schema returns HTTP 400');
  assert.ok(tf.schema && typeof tf.schema === 'object', 'the schema must sit FLAT under text.format');
});

test('AC8 win 2: strict mode\'s own rules are obeyed - every property required, no additions', () => {
  const items = buildLineSchema({ candidates: CANDIDATES, regionNos: REGIONS }).properties.lines.items;
  assert.equal(items.additionalProperties, false);
  assert.deepEqual([...items.required].sort(), [...Object.keys(items.properties)].sort());
});

// ── WIN 3: FREE BRAND INVENTION IMPOSSIBLE (tripwire, see the header) ──────

test('AC8 win 3: an out-of-enum product_id is REFUSED LOUDLY, never filtered away', () => {
  assert.throws(
    () => assertProductIdsInEnum([line({ product_id: 'Ferrero Rocher' })], ENUM),
    /SCHEMA ENFORCEMENT FAILURE/,
    'a filtered line is a silent regression with extra steps',
  );
});

test('AC8 win 3: the tripwire reports the OFFENDING value so a deployment change is diagnosable', () => {
  assert.throws(() => assertProductIdsInEnum([line({ product_id: 'VO5 gel' })], ENUM), /VO5 gel/);
});

test('AC8 win 3: with NO enum sent the check reports NOT VERIFIED rather than inventing a pass', () => {
  assert.equal(assertProductIdsInEnum([line({ product_id: 'anything' })], null), false);
});

// ── WIN 4: UNKNOWN REMAINS VALID ──────────────────────────────────────────

test('AC8 win 4: both escape values are in EVERY enum - removing them creates worse failures', () => {
  assert.deepEqual(ESCAPE_VALUES, [UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
  assert.ok(buildProductIdEnum([]).includes(UNKNOWN_VISIBLE_ITEM));
  assert.ok(buildProductIdEnum(CANDIDATES).includes(NOT_A_LINE));
});

test('AC8 win 4: an explicit UNKNOWN is ACCEPTED as a real line, not rejected', () => {
  const out = groundLines({
    lines: [line({ product_id: UNKNOWN_VISIBLE_ITEM })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted.length, 1);
  assert.equal(out.counts.unknownVisible, 1);
  assert.equal(out.accepted[0].identified, false);
});

test('AC8 win 4: an absent identity claim is NEVER upgraded into a declared UNKNOWN', () => {
  const out = groundLines({ lines: [line({ product_id: null })], productIdEnum: null, regionNos: REGIONS });
  assert.equal(out.accepted[0].product_id, null, 'only the model may declare an unknown');
  assert.equal(out.counts.unknownVisible, 0);
});

// ── WIN 5: REGION-1 DEFECT FIXED (module level - see the header) ───────────

test('AC8 win 5: region 1 is servable from the crop map - the split-representation defect stays fixed', () => {
  const urls = { 1: 'data:image/jpeg;base64,FULL', 2: 'data:image/jpeg;base64,TWO' };
  assert.deepEqual(cropsForRegions(urls, [1], 'test'), ['data:image/jpeg;base64,FULL']);
});

test('AC8 win 5: an unavailable region fails LOUDLY on every path, never silently dropped', () => {
  assert.throws(
    () => cropsForRegions({ 2: 'x' }, [3], 'cap-branch'),
    /no crop available for 3/,
    'the silent .filter(Boolean) branch is the dangerous one',
  );
});

// ── WIN 6: RICHMOND QUANTITY CLASS FIXED ──────────────────────────────────

test('AC8 win 6: a pack-size number in a product name never becomes a purchase quantity', () => {
  assert.equal(resolveQuantity({ asWritten: 'Richmond 16 pork sausages', reportedQuantity: 16 }).quantity, 1);
  assert.equal(resolveQuantity({ asWritten: 'Ariel Pods 33', reportedQuantity: 33 }).quantity, 1);
});

test('AC8 win 6: the detection flag still fires - the fix must not silence its own evidence', () => {
  const out = groundLines({
    lines: [line({ as_written: 'Richmond 16 pork sausages', quantity: 16 })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.ok(out.accepted[0].flags.includes('unjustified_quantity'));
  assert.equal(out.accepted[0].model_quantity, 16, 'what the model claimed stays visible');
});

// ── WIN 7: APPLICATION-OWNED REGION GROUNDING ─────────────────────────────

test('AC8 win 7: a source_region the application never supplied is REJECTED, not downgraded', () => {
  const out = groundLines({ lines: [line({ source_region: 99 })], productIdEnum: ENUM, regionNos: REGIONS });
  assert.equal(out.accepted.length, 0);
  assert.equal(out.counts.regionRejected, 1);
});

test('AC8 win 7: membership, not nullness - Number(null) === 0 must not read as "region 0"', () => {
  assert.equal(checkSourceRegionMembership({ source_region: null }, REGIONS), 'missing_source_region');
  assert.equal(checkSourceRegionMembership({ source_region: 99 }, REGIONS), 'source_region_not_supplied');
  assert.equal(checkSourceRegionMembership({ source_region: 2 }, REGIONS), null);
});

test('AC8 win 7: on the band path the region is the APPLICATION\'s fact and cannot be got wrong', async () => {
  const out = await inspectBandsIndividually({
    bandRegions: [{ region_no: 4 }],
    bandImageUrls: { 4: 'data:image/jpeg;base64,X' },
    candidates: CANDIDATES,
    callModel: async () => ({
      outputText: JSON.stringify({ lines: [{ as_written: 'milk', product_id: '11', source_region: 77, quantity: null }] }),
      responseId: 'r', usage: null, toolCalls: [],
    }),
  });
  assert.equal(out.lines[0].source_region, 4);
});

// ── WIN 8: HOUSEHOLD CONTEXT RETAINED ─────────────────────────────────────

test('AC8 win 8: the household catalogue and its aliases reach the prompt on BOTH paths', () => {
  const loopPrompt = buildAgenticPrompt({ catalogueItems: CANDIDATES, regionNos: REGIONS, constrained: true });
  assert.match(loopPrompt, /ASDA Crispy Skin-On Fries/);
  assert.match(loopPrompt, /aka: chips/, 'the alias list is the strongest signal for shorthand');
});

test('AC8 win 8: household context may NOT create a PHOTO line - the invariant is still stated', () => {
  const p = buildAgenticPrompt({ catalogueItems: CANDIDATES, regionNos: REGIONS, constrained: true });
  assert.match(p, /NEVER on its own evidence that it is written on THIS week's page/);
});

// ── WIN 9: CONFIDENCE TRIGGERS, NEVER ACCEPTS ─────────────────────────────

test('AC8 win 9: low confidence triggers another look and accepts the line anyway', () => {
  const out = groundLines({
    lines: [line({ confidence: 0.1 })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted.length, 1, 'confidence never makes a line unacceptable');
  assert.equal(out.accepted[0].look_again, true);
  assert.deepEqual(out.lookAgainRegions, [2]);
});

test('AC8 win 9: HIGH confidence does not make a bad line acceptable - Terra can be confidently wrong', () => {
  const out = groundLines({
    lines: [line({ confidence: 1, source_region: 99 })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted.length, 0, 'a region that was never sent is not rescued by confidence');
});

test('AC8 win 9: a MISSING confidence does not become 0 and demote the line', () => {
  const out = groundLines({
    lines: [line({ confidence: undefined })], productIdEnum: ENUM, regionNos: REGIONS,
  });
  assert.equal(out.accepted[0].confidence, null);
  assert.equal(out.accepted[0].look_again, false, 'the Number(null) === 0 hazard must stay closed');
  assert.ok(DEFAULT_LOOK_AGAIN_BELOW > 0);
});
