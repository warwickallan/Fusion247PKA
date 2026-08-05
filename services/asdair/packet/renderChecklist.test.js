// =====================================================================
// BUILD-015 AsdAIr - packet/renderChecklist.test.js
//
// The checklist is what Warwick actually reads on a phone, so these tests
// assert the properties that make it usable and safe: the SAME order as
// the packet, the quantity and the source view visible per line, held
// lines visible rather than dropped, approved wording quoted verbatim,
// and no known item ever presented as something to search for.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExecutionPacket } from './buildExecutionPacket.js';
import { renderChecklist, ChecklistError, STANDING_BOUNDARIES, WRAP_WIDTH } from './renderChecklist.js';

const GENERATED_AT = '2026-08-04T09:00:00.000Z';
const SHOP_REF = 'SHOP-2026-08-03';

// Caller prose is wrapped to phone width, so content assertions run against
// whitespace-flattened text. This still proves the exact words in the exact
// order - it only tolerates WHERE the line break landed.
const flat = (s) => s.replace(/\s+/g, ' ');

function samplePacket() {
  return buildExecutionPacket({
    shop_ref: SHOP_REF,
    generated_at: GENERATED_AT,
    household_id: 1,
    lines: [
      { original_list_line: 'milk 2', origin: 'known', canonical_product_id: 41, canonical_product_name: 'Semi Skimmed Milk 2L', brand: 'ASDA', source_view: 'regulars', asda_product_ref: '1000383091', required_quantity: 2 },
      { original_list_line: 'picnic bars', origin: 'known', canonical_product_id: 88, canonical_product_name: 'Picnic Chocolate Bar 4 Pack', brand: 'Cadbury', source_view: 'favourites', asda_product_ref: '910284', required_quantity: 4, applied_rules: [37], quantity_rationale: 'list said 3; rule 37 rounds up to 4 for the any-2-for-X offer' },
      { original_list_line: 'bananas', origin: 'known', canonical_product_id: 5, canonical_product_name: 'Bananas Loose', brand: null, source_view: 'regulars', asda_product_ref: '223344', required_quantity: 6, substitutes_allowed: true },
      { original_list_line: 'oat mlk', origin: 'new_approved', canonical_product_id: null, canonical_product_name: 'Oat Milk Barista 1L', brand: 'Oatly', source_view: 'search', approved_search_term: 'oatly barista oat drink 1l', required_quantity: 1 },
      { original_list_line: 'that sauce', hold: { reason: 'ambiguous', detail: 'three candidates in Regulars', rule_id: 12 } }
    ]
  });
}

test('the checklist renders in the SAME order as the packet, and seq matches', () => {
  const packet = samplePacket();
  const text = renderChecklist(packet);

  const positions = packet.lines.map((line) => {
    const at = text.indexOf(line.canonical_product_name);
    assert.notEqual(at, -1, line.canonical_product_name + ' is missing from the checklist');
    return at;
  });
  const ascending = positions.slice().sort((a, b) => a - b);
  assert.deepEqual(positions, ascending, 'the checklist order must follow the packet order exactly');

  packet.lines.forEach((line) => {
    assert.match(text, new RegExp('\\b' + line.seq + '\\. \\[ \\] x' + line.required_quantity + '\\b'));
  });
});

test('every basket line shows its quantity and a checkbox', () => {
  const packet = samplePacket();
  const text = renderChecklist(packet);
  const boxes = text.match(/\[ \]/g) || [];
  assert.equal(boxes.length, packet.lines.length);
  assert.match(text, /x2 {2}ASDA -- Semi Skimmed Milk 2L/);
  assert.match(text, /x6 {2}\(no brand\) -- Bananas Loose/);
});

test('a KNOWN line shows its source view and product ref, and is NEVER presented as a search', () => {
  const text = renderChecklist(samplePacket());
  assert.match(text, /REGULARS {2}ref 1000383091/);
  assert.match(text, /FAVOURITES {2}ref 910284/);

  // Exactly one line tells the agent to search, and it is the new item.
  const searchLines = text.split('\n').filter((l) => /search these exact words/.test(l));
  assert.equal(searchLines.length, 1, 'exactly one line is a genuinely new approved item');
  assert.ok(!searchLines[0].includes('Semi Skimmed Milk'));
});

test('a NEW_APPROVED line carries the approved wording VERBATIM and says to favourite it', () => {
  const text = renderChecklist(samplePacket());
  assert.match(flat(text), /\*\* NEW - APPROVED \*\* search these exact words: > oatly barista oat drink 1l/);
  assert.match(text, /then FAVOURITE it and capture its real ASDA product id\./);
});

test('the standing boundaries always appear, whatever the caller passes', () => {
  const text = renderChecklist(samplePacket());
  const flattened = flat(text);
  STANDING_BOUNDARIES.forEach((boundary) => assert.ok(flattened.includes(flat(boundary)), 'missing boundary: ' + boundary));
  assert.match(text, /NEVER free-search a known item/);
  assert.match(text, /NEVER substitute/);
  assert.match(text, /NEVER book a slot, check out, pay/);
});

test('the header carries the sort contract and both reconciliation counts', () => {
  const packet = samplePacket();
  const text = renderChecklist(packet);
  assert.match(text, /Order {5}: brand A-Z, then product A-Z {2}\[brand_az_then_product_az\]/);
  assert.match(text, new RegExp('Expect {4}: ' + packet.expected_distinct_products + ' distinct product\\(s\\), ' + packet.expected_total_units + ' unit\\(s\\)'));
  assert.match(text, /Set the ASDA ordering to Brand A-Z/);
  assert.ok(text.includes(SHOP_REF));
  assert.ok(text.includes(GENERATED_AT));
});

test('HELD lines are shown with their reason - visible, not dropped', () => {
  const text = renderChecklist(samplePacket());
  assert.match(text, /HELD -- NOT IN THE BASKET -- 1 line\(s\)/);
  assert.match(text, /- "that sauce"/);
  assert.match(flat(text), /ambiguous -- three candidates in Regulars \[rule 12\]/);
  assert.match(text, /These are NOT dropped\. They are waiting on a human\./);
});

test('an empty held list still renders its section, saying so explicitly', () => {
  const packet = buildExecutionPacket({
    shop_ref: SHOP_REF, generated_at: GENERATED_AT,
    lines: [{ original_list_line: 'milk', origin: 'known', canonical_product_id: 41, canonical_product_name: 'Milk', brand: 'ASDA', source_view: 'regulars', asda_product_ref: '111222', required_quantity: 1 }]
  });
  const text = renderChecklist(packet);
  assert.match(text, /HELD -- NOT IN THE BASKET -- 0 line\(s\)/);
  assert.match(text, /\(none - every line on the list is in the basket above\)/);
});

test('quantity rationale and applied rules are shown, so a rule that fired is VISIBLE', () => {
  const text = renderChecklist(samplePacket());
  assert.match(flat(text), /why: list said 3; rule 37 rounds up to 4 for the any-2-for-X offer/);
  assert.match(text, /rules: 37/);
});

test('substitutes_allowed is shown as a HUMAN decision, never as permission to swap', () => {
  const text = renderChecklist(samplePacket());
  assert.match(flat(text), /subs: substitute permitted - a HUMAN decision only, never yours\./);
  // Only the one line that set it
  assert.equal((text.match(/subs: /g) || []).length, 1);
});

// ---------------------------------------------------------------------
// Packet-level guidance (rule 38)
// ---------------------------------------------------------------------

test('packet-level guidance renders with its rule id - the worked case is rule 38', () => {
  const text = renderChecklist(samplePacket(), {
    guidance: [{ text: 'A failed add means OUT OF STOCK, not an expired slot.', rule_id: 38 }]
  });
  assert.match(text, / GUIDANCE/);
  assert.match(flat(text), /\* A failed add means OUT OF STOCK, not an expired slot\. \[rule 38\]/);
  // Guidance precedes the basket so it is read before the work starts.
  assert.ok(text.indexOf('GUIDANCE') < text.indexOf('BASKET --'));
});

test('guidance accepts a bare string, and the section is absent when none is supplied', () => {
  const withString = renderChecklist(samplePacket(), { guidance: ['Check the fridge date codes.'] });
  assert.match(withString, /\* Check the fridge date codes\.$/m);

  const without = renderChecklist(samplePacket());
  assert.ok(!without.includes(' GUIDANCE'));
});

test('malformed guidance is REJECTED rather than rendered as noise', () => {
  const packet = samplePacket();
  assert.throws(() => renderChecklist(packet, { guidance: 'not an array' }),
    (err) => err instanceof ChecklistError && /must be an array/.test(err.message));
  assert.throws(() => renderChecklist(packet, { guidance: [''] }),
    (err) => err instanceof ChecklistError && /empty string/.test(err.message));
  assert.throws(() => renderChecklist(packet, { guidance: [{ text: 'x', rule_id: 0 }] }),
    (err) => err instanceof ChecklistError && /rule_id/.test(err.message));
  assert.throws(() => renderChecklist(packet, { guidance: [42] }),
    (err) => err instanceof ChecklistError && /must be a string or/.test(err.message));
});

// ---------------------------------------------------------------------
// Shape and safety
// ---------------------------------------------------------------------

test('the output is PURE ASCII, so it survives every channel it is pasted into', () => {
  const text = renderChecklist(samplePacket(), { guidance: [{ text: 'A failed add means OUT OF STOCK.', rule_id: 38 }] });
  // eslint-disable-next-line no-control-regex
  const nonAscii = text.match(/[^\x0A\x20-\x7E]/g);
  assert.equal(nonAscii, null, 'non-ASCII characters found: ' + JSON.stringify(nonAscii));
});

test('EVERY line stays short enough to read on a phone - no carve-outs', () => {
  const text = renderChecklist(samplePacket(), { guidance: [{ text: 'A failed add means OUT OF STOCK, not an expired slot.', rule_id: 38 }] });
  const tooLong = text.split('\n').filter((l) => l.length > WRAP_WIDTH);
  assert.deepEqual(tooLong, [], 'these lines are too wide for a phone: ' + JSON.stringify(tooLong));
});

test('long caller-supplied prose is WRAPPED, never truncated - nothing is lost from the page', () => {
  const rationale = 'list said 3 but rule 37 rounds the quantity up to 4 so the any-2-for-X multibuy applies, ' +
    'and the fourth unit is deliberately the female variant because that is what the household actually uses';
  const packet = buildExecutionPacket({
    shop_ref: SHOP_REF, generated_at: GENERATED_AT,
    lines: [{
      original_list_line: 'a very long original list line that mum wrote right across the width of the page',
      origin: 'known', canonical_product_id: 1,
      canonical_product_name: 'An Extremely Long Canonical Product Name That Will Not Fit On One Phone Line 500g',
      brand: 'A Very Long Brand Name Indeed', source_view: 'regulars',
      asda_product_ref: '123456', required_quantity: 4,
      applied_rules: [37], quantity_rationale: rationale
    }]
  });
  const text = renderChecklist(packet, { guidance: ['A guidance note that is itself far too long to sit on a single line of a phone screen without wrapping'] });

  assert.deepEqual(text.split('\n').filter((l) => l.length > WRAP_WIDTH), []);
  // Wrapped, not truncated: every word survives.
  const flattened = text.replace(/\s+/g, ' ');
  rationale.split(' ').forEach((word) => assert.ok(flattened.includes(word), 'lost word: ' + word));
  assert.ok(flattened.includes('An Extremely Long Canonical Product Name'));
});

test('renderChecklist REJECTS anything that is not a packet', () => {
  assert.throws(() => renderChecklist(null), (err) => err instanceof ChecklistError);
  assert.throws(() => renderChecklist({ lines: [] }), (err) => err instanceof ChecklistError && /non-empty array/.test(err.message));
  assert.throws(() => renderChecklist([]), (err) => err instanceof ChecklistError);
});

test('PURE: the same packet always renders the identical string', () => {
  assert.equal(renderChecklist(samplePacket()), renderChecklist(samplePacket()));
});

test('a rendered checklist is shown once in full, as executed evidence', () => {
  const text = renderChecklist(samplePacket(), {
    guidance: [{ text: 'A failed add means OUT OF STOCK, not an expired slot.', rule_id: 38 }]
  });
  assert.ok(text.length > 0);
  console.log(text);
});
