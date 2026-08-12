// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/lineSchema.test.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC2/AC3: proofs for the strict schema and
// its FLAT `text.format` envelope. PURE - no network, no gateway.
//
// These tests pin the three properties that live probing showed are the
// difference between a real constraint and a decorative one: `strict:true`
// present, the two escape values in EVERY enum, and the flat envelope shape.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductIdEnum, buildLineSchema, buildTextFormat,
  UNKNOWN_VISIBLE_ITEM, NOT_A_LINE, SCHEMA_NAME,
} from './lineSchema.js';

const CANDIDATES = [{ id: 7, name: 'Weetabix' }, { id: '42', name: 'Marmite' }];

test('buildProductIdEnum: exactly the supplied ids, stringified, plus BOTH mandatory escapes', () => {
  const e = buildProductIdEnum(CANDIDATES);
  assert.deepEqual(e, ['7', '42', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
});

test('buildProductIdEnum: an EMPTY catalogue still yields both escapes - never an empty enum', () => {
  // An empty enum is not a schema, it is an impossible field. With no
  // candidates the only honest answers are "I see something I cannot name"
  // and "there is nothing here", and both must remain expressible.
  assert.deepEqual(buildProductIdEnum([]), [UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
});

test('buildProductIdEnum: duplicate candidate ids collapse, so the enum cannot carry the same id twice', () => {
  assert.deepEqual(buildProductIdEnum([{ id: 7 }, { id: '7' }]), ['7', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
});

test('buildProductIdEnum: a candidate id colliding with an escape value is refused, never silently shadowed', () => {
  assert.throws(() => buildProductIdEnum([{ id: UNKNOWN_VISIBLE_ITEM }]), /collides with the reserved escape value/);
});

test('AC2: the schema carries all four required fields on every line', () => {
  const schema = buildLineSchema({ candidates: CANDIDATES, regionNos: [1, 2, 3] });
  const props = schema.properties.lines.items.properties;
  for (const field of ['product_id', 'as_written', 'source_region', 'confidence']) {
    assert.ok(props[field], `${field} is required by AC2 and must be in the schema`);
  }
});

test('AC2: product_id is a CLOSED enum - exactly the supplied ids plus the escapes', () => {
  const schema = buildLineSchema({ candidates: CANDIDATES, regionNos: [1] });
  assert.deepEqual(schema.properties.lines.items.properties.product_id.enum, ['7', '42', UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);
});

test('AC2: as_written is UNCONSTRAINED free text - the only field where a wrong-but-legal id becomes visible', () => {
  const written = buildLineSchema({ candidates: CANDIDATES, regionNos: [1] }).properties.lines.items.properties.as_written;
  assert.equal(written.type, 'string');
  assert.equal(written.enum, undefined, 'constraining the verbatim reading destroys the only detector of a confident mis-identification');
  assert.equal(written.pattern, undefined);
});

test('AC5: source_region is closed to the regions the application actually supplied', () => {
  const schema = buildLineSchema({ candidates: CANDIDATES, regionNos: [1, 4] });
  assert.deepEqual(schema.properties.lines.items.properties.source_region.enum, [1, 4]);
});

test('AC3: visible_line is a SEPARATE boolean field from product_id', () => {
  const props = buildLineSchema({ candidates: CANDIDATES, regionNos: [1] }).properties.lines.items.properties;
  assert.equal(props.visible_line.type, 'boolean');
  assert.notEqual(props.visible_line, props.product_id);
});

test('strict-mode rules: every object sets additionalProperties:false and requires EVERY property', () => {
  const schema = buildLineSchema({ candidates: CANDIDATES, regionNos: [1] });
  assert.equal(schema.additionalProperties, false);
  const items = schema.properties.lines.items;
  assert.equal(items.additionalProperties, false);
  assert.deepEqual(
    [...items.required].sort(),
    Object.keys(items.properties).sort(),
    'under strict:true an omitted required key is a 400, not an optional field',
  );
});

test('quantity is nullable by TYPE, not by being optional - strict mode forbids the latter', () => {
  const q = buildLineSchema({ candidates: CANDIDATES, regionNos: [1] }).properties.lines.items.properties.quantity;
  assert.deepEqual(q.type, ['integer', 'null']);
});

test('buildLineSchema: refuses to build with no regions - a schema that cites nothing is not a constraint', () => {
  assert.throws(() => buildLineSchema({ candidates: CANDIDATES, regionNos: [] }), /regionNos is required/);
});

test('AC2: the envelope is FLAT, named, and strict:true - the one shape that actually enforces', () => {
  const fmt = buildTextFormat(buildLineSchema({ candidates: CANDIDATES, regionNos: [1] }));
  assert.equal(fmt.type, 'json_schema');
  assert.equal(fmt.name, SCHEMA_NAME);
  assert.equal(fmt.strict, true, 'strict:false and strict omitted BOTH escaped under live probing - this is the enforcing switch');
  assert.ok(fmt.schema.properties.lines);
  // The forbidden shapes, asserted as absent rather than described in prose:
  assert.equal(fmt.json_schema, undefined, 'a NESTED json_schema under text.format returns a loud 400');
  assert.equal(fmt.response_format, undefined, 'response_format on /responses returns 200 and enforces NOTHING - the silent trap');
});
