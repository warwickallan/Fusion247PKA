// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/twoLayerScore.test.js
//
// WO-2026-08-12-02 (WP-B15-30), AC4. The properties that make the two layers
// worth having - above all that they cannot be collapsed into one number, and
// that layer B's denominator is DETECTED lines rather than 39.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreTwoLayer, loadFixture, TWO_LAYER_LIMITS } from './twoLayerScore.js';
import { UNKNOWN_VISIBLE_ITEM, NOT_A_LINE } from './lineSchema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(HERE, 'fixtures', 'photo39.fixture.json');

const FIXTURE = {
  lines: [
    {
      page_order: 1, source_text: '2 CHiPS WiTH SKiNS ON', catalogue_product: 'ASDA Crispy Skin-On Fries 750g',
      expected_product_id: '7', identity_established: true, expected_quantity: 2, quantity_basis: 'explicit-on-page',
    },
    {
      page_order: 2, source_text: '1 LURPACK BUTTER', catalogue_product: 'Lurpak Slightly Salted Butter 200g',
      expected_product_id: '11', identity_established: true, expected_quantity: 1, quantity_basis: 'explicit-on-page',
    },
    {
      page_order: 3, source_text: '1 BOX ASDA FRUiT LOLLY iCES', catalogue_product: 'ASDA Assorted Fruit Splits Lollies box',
      expected_product_id: null, identity_established: false, expected_quantity: 1, quantity_basis: 'explicit-on-page',
    },
  ],
};

const answer = (o) => ({
  as_written: '', product_id: null, identified: false, quantity: null, source_region: 2, ...o,
});

// ── THE DISCRIMINATING CASE THE WHOLE FIXTURE EXISTS FOR ──────────────────

test('AC3/AC4: "2 chips with skins on" reconciles to ASDA Crispy Skin-On Fries - the join failure is GONE', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '2 chips with skins on', product_id: '7', identified: true, quantity: 2 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1, 'this line was reported as an INVENTION by the previous scorer');
  assert.equal(s.layerA.invented, 0);
  assert.equal(s.layerB.correctIdentity, 1);
});

// ── LAYER SEPARATION - the point of AC4 ───────────────────────────────────

test('AC4: a run that reads half the page and names it perfectly scores LOW on A and 100% on B', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1);
  assert.equal(s.layerA.omitted, 2, 'a coverage failure');
  assert.equal(s.layerB.correctIdentityPct, 100, 'and NOT a catalogue-matching failure');
});

test('AC4: layer B\'s denominator is DETECTED gradable lines, never the 39', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerB.gradableDetected, 1);
  assert.notEqual(s.layerB.gradableDetected, FIXTURE.lines.length);
});

test('AC4: there is NO single collapsed "correct %" anywhere in the result', () => {
  const s = scoreTwoLayer({ accepted: [], fixture: FIXTURE });
  const keys = [...Object.keys(s), ...Object.keys(s.layerA), ...Object.keys(s.layerB)];
  assert.ok(!keys.includes('correct'), 'a bare `correct` would be the collapsed number Warwick forbade');
  assert.ok(!keys.includes('correctPct'));
});

// ── IDENTITY THAT CANNOT BE GRADED IS EXCLUDED, NOT GUESSED ───────────────

test('AC4: a detected line whose catalogue identity was never established is NOT GRADABLE, not wrong', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 box ASDA fruit lolly ices', product_id: '33', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1, 'layer A still counts it - the line WAS read');
  assert.equal(s.layerB.notGradable, 1);
  assert.equal(s.layerB.wrongIdentity, 0, 'grading it wrong would invent an answer the fixture does not hold');
  assert.equal(s.layerB.gradableDetected, 0);
});

// ── THE READING ANCHORS THE TRUTH - kept from the previous scorer ─────────

test('AC4: a supplied candidate with NO matching reading is an INVENTION, not a detection', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: 'Ferrero Rocher', product_id: '7', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 0);
  assert.equal(s.layerA.invented, 1);
  assert.equal(s.layerA.inventedFromSuppliedCandidate, 1, 'the mechanism must stay distinguishable');
});

test('AC4: "read X, named Y" is WRONG IDENTITY - the reading decides which line it is', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 Lurpack butter', product_id: '7', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1, 'the reading is right, so the line was seen');
  assert.equal(s.layerB.wrongIdentity, 1, 'and the identity is wrong - two separate facts');
});

test('AC4: an honest UNKNOWN on a real line is a DETECTION and a layer-B unresolved, never an invention', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 Lurpack butter', product_id: UNKNOWN_VISIBLE_ITEM, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1);
  assert.equal(s.layerA.invented, 0);
  assert.equal(s.layerA.explicitUnknownOnRealLine, 1);
  assert.equal(s.layerB.unresolvedUnknown, 1);
  assert.equal(s.layerB.wrongIdentity, 0);
});

test('AC4: a declared NOT_A_LINE is neither a detection nor an invention', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: 'scribble', product_id: NOT_A_LINE })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 0);
  assert.equal(s.layerA.invented, 0);
  assert.equal(s.layerA.notALineDeclared, 1);
});

test('AC4: the same line read twice is ONE detection plus ONE duplicate, never two detections', () => {
  const s = scoreTwoLayer({
    accepted: [
      answer({ as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 2 }),
      answer({ as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1, source_region: 3 }),
    ],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.detected, 1);
  assert.equal(s.layerA.duplicates, 1);
  assert.equal(s.layerA.invented, 0, 'a duplicate must never be counted as an invention');
});

// ── QUANTITY, AND THE OMISSION LIST ───────────────────────────────────────

test('AC4: an explicit quantity error is counted in layer A and does not affect layer B', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '2 chips with skins on', product_id: '7', identified: true, quantity: 5 })],
    fixture: FIXTURE,
  });
  assert.equal(s.layerA.quantityErrors, 1);
  assert.equal(s.layerB.correctIdentity, 1, 'the identity was right even though the count was not');
});

test('AC4: omitted page lines are NAMED, not just counted', () => {
  const s = scoreTwoLayer({ accepted: [], fixture: FIXTURE });
  assert.equal(s.layerA.omitted, 3);
  assert.deepEqual(s.omittedPageLines.map((o) => o.page_order), [1, 2, 3]);
});

// ── THE LIMITS TRAVEL WITH THE SCORE ──────────────────────────────────────

test('AC4: the visible-text metric is labelled NOT INDEPENDENTLY GRADED wherever it appears', () => {
  const s = scoreTwoLayer({
    accepted: [answer({ as_written: '1 Lurpack butter', product_id: '11', identified: true, quantity: 1 })],
    fixture: FIXTURE,
  });
  assert.match(s.layerA.visibleTextGrading, /NOT INDEPENDENTLY GRADED/);
  assert.ok(s.limits.some((l) => l.includes('NOT INDEPENDENTLY GRADED')));
  assert.equal(s.limits, TWO_LAYER_LIMITS);
});

// ── THE REAL COMMITTED FIXTURE ────────────────────────────────────────────

test('AC3: the committed fixture holds 39 page lines, 36 established identities and 2 struck-through lines', () => {
  const f = loadFixture(FIXTURE_PATH);
  assert.equal(f.lines.length, 39);
  assert.equal(f.lines.filter((l) => l.identity_established).length, 36);
  assert.equal(f.struck_through_lines.length, 2);
  assert.deepEqual(f.contested_lines, [8], 'the Richmond line is contested and must stay visible');
});

test('AC3: every committed fixture line carries its provenance and a resolved-or-null identity', () => {
  const f = loadFixture(FIXTURE_PATH);
  for (const l of f.lines) {
    assert.equal(l.source_text_provenance, 'NON-INDEPENDENT');
    assert.equal(typeof l.source_text, 'string');
    assert.ok(l.source_text.length > 0);
    assert.equal(l.identity_established, l.expected_product_id !== null);
    assert.ok(Number.isInteger(l.expected_quantity));
  }
});

test('AC3: the fixture states in its own bytes that it is TEST DATA ONLY', () => {
  const f = loadFixture(FIXTURE_PATH);
  assert.match(f.TEST_DATA_ONLY, /TEST DATA ONLY/);
  assert.match(f.provenance.source_text, /NON-INDEPENDENT/);
});
