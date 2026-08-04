// =====================================================================
// BUILD-015 AsdAIr - packet/schemaAssert.test.js
//
// MUTATION-TESTS THE VALIDATOR ITSELF.
//
// Every other proof in this module rests on schemaAssert saying "valid".
// A validator that has never been watched REJECT anything is an untested
// control, and a control reporting on ground it did not examine is worse
// than no control at all. So for every keyword class schemaAssert claims
// to implement, there is a deliberately-broken instance here that it MUST
// reject - plus a proof that an unimplemented keyword THROWS rather than
// being silently ignored.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { validate, assertValid, SchemaAssertError, SUPPORTED_KEYWORDS } from './schemaAssert.js';
import { SCHEMA, SCHEMA_PATH, SCHEMA_SHA256 } from './committedSchema.js';

// ---------------------------------------------------------------------
// The fail-closed property: the reason this validator can be trusted.
// ---------------------------------------------------------------------

test('an UNIMPLEMENTED keyword throws NOT VALIDATED - it is never ignored', () => {
  const schema = { type: 'object', unevaluatedProperties: false };
  assert.throws(
    () => validate(schema, { a: 1 }),
    (err) => err instanceof SchemaAssertError && /unsupported schema keyword "unevaluatedProperties"/.test(err.message)
  );
});

test('an unimplemented keyword nested deep inside still throws', () => {
  const schema = {
    type: 'object',
    properties: { a: { type: 'array', items: { type: 'object', patternProperties: { '^x': {} } } } }
  };
  assert.throws(
    () => validate(schema, { a: [{ x1: 1 }] }),
    (err) => err instanceof SchemaAssertError && /unsupported schema keyword "patternProperties"/.test(err.message)
  );
});

test('an unknown "format" throws rather than passing unchecked', () => {
  assert.throws(
    () => validate({ type: 'string', format: 'ipv6' }, '::1'),
    (err) => err instanceof SchemaAssertError && /unsupported "format" value "ipv6"/.test(err.message)
  );
});

test('the draft-07 tuple form of items throws rather than validating nothing', () => {
  assert.throws(
    () => validate({ type: 'array', items: [{ type: 'string' }] }, ['a']),
    (err) => err instanceof SchemaAssertError && /tuple form of "items"/.test(err.message)
  );
});

test('an external $ref throws - it cannot be fetched, so it must not appear to pass', () => {
  assert.throws(
    () => validate({ $ref: 'https://example.com/other.json' }, {}),
    (err) => err instanceof SchemaAssertError && /unsupported \$ref/.test(err.message)
  );
});

test('an unresolvable local $ref throws', () => {
  assert.throws(
    () => validate({ $defs: {}, $ref: '#/$defs/missing' }, {}),
    (err) => err instanceof SchemaAssertError && /does not resolve/.test(err.message)
  );
});

test('a NOT-VALIDATED condition inside an if/anyOf branch propagates, never reads as "did not match"', () => {
  // If the throw were swallowed by the branch evaluator, the instance would
  // silently take the else-branch and report VALID. That is the subtle
  // false green this asserts against.
  const schema = {
    type: 'object',
    if: { properties: { a: { const: 1 } }, contains: { type: 'string' } },
    then: { required: ['b'] }
  };
  assert.throws(
    () => validate(schema, { a: 1 }),
    (err) => err instanceof SchemaAssertError && /unsupported schema keyword "contains"/.test(err.message)
  );
});

// ---------------------------------------------------------------------
// One deliberate breakage per implemented assertion keyword.
// ---------------------------------------------------------------------

const REJECTION_CASES = [
  ['type (scalar)', { type: 'string' }, 42],
  ['type (union)', { type: ['integer', 'null'] }, 'nope'],
  ['type integer rejects a fractional number', { type: 'integer' }, 1.5],
  ['const', { const: 1 }, 2],
  ['enum', { enum: ['regulars', 'favourites', 'search'] }, 'substituted'],
  ['pattern', { type: 'string', pattern: '^SHOP-[0-9]{4}-[0-9]{2}-[0-9]{2}$' }, 'SHOP-26-08-03'],
  ['minLength', { type: 'string', minLength: 1 }, ''],
  ['maxLength', { type: 'string', maxLength: 2 }, 'abc'],
  ['format date-time', { type: 'string', format: 'date-time' }, '2026-08-04'],
  ['format uri', { type: 'string', format: 'uri' }, 'not a url'],
  ['minimum', { type: 'integer', minimum: 1 }, 0],
  ['maximum', { type: 'integer', maximum: 99 }, 100],
  ['exclusiveMinimum', { type: 'integer', exclusiveMinimum: 0 }, 0],
  ['exclusiveMaximum', { type: 'integer', exclusiveMaximum: 10 }, 10],
  ['multipleOf', { type: 'number', multipleOf: 2 }, 3],
  ['minItems', { type: 'array', minItems: 1 }, []],
  ['maxItems', { type: 'array', maxItems: 1 }, [1, 2]],
  ['uniqueItems', { type: 'array', uniqueItems: true }, [{ a: 1 }, { a: 1 }]],
  ['items', { type: 'array', items: { type: 'integer' } }, [1, 'two']],
  ['required', { type: 'object', required: ['seq'] }, {}],
  ['additionalProperties false', { type: 'object', properties: { a: {} }, additionalProperties: false }, { a: 1, b: 2 }],
  ['properties (nested)', { type: 'object', properties: { a: { type: 'integer' } } }, { a: 'x' }],
  ['allOf', { allOf: [{ type: 'object' }, { required: ['a'] }] }, {}],
  ['anyOf', { anyOf: [{ type: 'string' }, { type: 'integer' }] }, true],
  ['oneOf (matches none)', { oneOf: [{ type: 'string' }, { type: 'integer' }] }, true],
  ['oneOf (matches both)', { oneOf: [{ type: 'integer' }, { minimum: 0 }] }, 5],
  ['not', { not: { type: 'string' } }, 'x'],
  ['if/then', { if: { properties: { o: { const: 'known' } }, required: ['o'] }, then: { required: ['ref'] } }, { o: 'known' }],
  ['if/else', { if: { properties: { o: { const: 'known' } }, required: ['o'] }, else: { required: ['term'] } }, { o: 'new' }],
  ['schema false', { type: 'object', properties: { a: false }, additionalProperties: true }, { a: 1 }]
];

for (const [label, schema, instance] of REJECTION_CASES) {
  test('REJECTS: ' + label, () => {
    const { valid, errors } = validate(schema, instance);
    assert.equal(valid, false, label + ' should have been rejected but the validator said VALID');
    assert.ok(errors.length > 0, 'a rejection must carry at least one error message');
  });
}

const ACCEPTANCE_CASES = [
  ['type union accepts null', { type: ['integer', 'null'] }, null],
  ['pattern accepts a good shop_ref', { type: 'string', pattern: '^SHOP-[0-9]{4}-[0-9]{2}-[0-9]{2}$' }, 'SHOP-2026-08-03'],
  ['format date-time accepts an ISO instant', { type: 'string', format: 'date-time' }, '2026-08-04T09:30:00.000Z'],
  ['format date-time accepts an offset', { type: 'string', format: 'date-time' }, '2026-08-04T09:30:00+01:00'],
  ['format uri accepts an https url', { type: 'string', format: 'uri' }, 'https://groceries.asda.com/product/1000383091'],
  ['format is not applied to a null', { type: ['string', 'null'], format: 'uri' }, null],
  ['if/then satisfied', { if: { properties: { o: { const: 'known' } }, required: ['o'] }, then: { required: ['ref'] } }, { o: 'known', ref: '123' }],
  ['if not triggered', { if: { properties: { o: { const: 'known' } }, required: ['o'] }, then: { required: ['ref'] } }, { o: 'new_approved' }],
  ['$ref resolves locally', { $defs: { id: { type: 'integer', minimum: 1 } }, $ref: '#/$defs/id' }, 7]
];

for (const [label, schema, instance] of ACCEPTANCE_CASES) {
  test('ACCEPTS: ' + label, () => {
    const { valid, errors } = validate(schema, instance);
    assert.equal(valid, true, label + ' should have been accepted; errors: ' + errors.join(' | '));
  });
}

test('assertValid throws a SchemaAssertError listing every problem, and returns true when clean', () => {
  const schema = { type: 'object', required: ['a', 'b'], properties: { c: { type: 'integer' } } };
  assert.throws(
    () => assertValid(schema, { c: 'x' }, 'packet'),
    (err) => err instanceof SchemaAssertError &&
             /missing required property "a"/.test(err.message) &&
             /missing required property "b"/.test(err.message) &&
             /expected type integer/.test(err.message)
  );
  assert.equal(assertValid(schema, { a: 1, b: 2, c: 3 }, 'packet'), true);
});

// ---------------------------------------------------------------------
// The committed contract must be fully appliable by this validator.
// ---------------------------------------------------------------------

test('the COMMITTED schema uses no keyword this validator cannot apply', () => {
  // Validating a deliberately empty object walks the whole root schema and
  // throws on the first unimplemented keyword. If Larry tightens the
  // contract with a keyword schemaAssert lacks, this test - not a silent
  // pass - is what reports it.
  const { valid } = validate(SCHEMA, {});
  assert.equal(valid, false, 'an empty object is not a valid packet');

  // And walk the line/heldLine subschemas, which the root walk only reaches
  // once `lines` is populated.
  const probe = {
    packet_version: 1,
    shop_ref: 'SHOP-2026-08-03',
    generated_at: '2026-08-04T09:00:00.000Z',
    expected_distinct_products: 0,
    expected_total_units: 0,
    lines: [{}],
    held: [{}]
  };
  const probed = validate(SCHEMA, probe);
  assert.equal(probed.valid, false);
  assert.ok(probed.errors.length > 0);
});

test('evidence: the schema actually loaded is named and hashed', () => {
  assert.ok(SCHEMA_PATH.endsWith('SONNET-BROWSER-EXECUTION-PACKET.schema.json'));
  assert.match(SCHEMA_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(SCHEMA.$schema, 'https://json-schema.org/draft/2020-12/schema');
  // Printed so the handback evidence names the exact bytes proven against.
  console.log('    committed schema : ' + SCHEMA_PATH);
  console.log('    sha256           : ' + SCHEMA_SHA256);
  console.log('    keywords applied : ' + SUPPORTED_KEYWORDS.join(' '));
});
