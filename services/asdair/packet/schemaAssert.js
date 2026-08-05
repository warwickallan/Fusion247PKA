// =====================================================================
// BUILD-015 AsdAIr - packet/schemaAssert.js
//
// A SMALL, ZERO-DEPENDENCY JSON Schema (draft 2020-12) assertion helper,
// written because `dependency_policy: no-new-runtime-deps` forbids pulling
// in ajv and no validator is reachable from services/asdair/**.
//
// It exists for ONE job: assert that a produced Sonnet Browser Execution
// Packet really does satisfy the COMMITTED contract at
//   Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json
// rather than being hand-checked.
//
// -------------------------------------------------------------------
// THE DESIGN RULE THAT MATTERS MOST: IT FAILS CLOSED.
// -------------------------------------------------------------------
// A partial validator that silently ignores the keywords it does not
// implement is WORSE THAN NO VALIDATOR: it returns a confident green over
// ground it never examined. So every keyword encountered must be either
// IMPLEMENTED or explicitly listed as a known annotation. Anything else
// throws SchemaAssertError('unsupported schema keyword ...') and the test
// suite goes RED.
//
// That property is deliberate and load-bearing. The committed schema is
// owned by someone else and is being tightened (Larry, 2026-08-04, to
// forbid null in the origin-conditional branches). If that tightening
// introduces a keyword this file does not implement, the correct outcome
// is a LOUD FAILURE saying "not validated", never a quiet pass.
//
// schemaAssert.test.js mutation-tests this file: for every keyword class
// below there is a deliberately-broken instance that MUST be rejected. A
// validator nobody has watched reject anything is an untested control.
//
// KNOWN, DELIBERATE DEVIATIONS FROM THE DRAFT (both make it STRICTER,
// never more permissive, so neither can manufacture a false green):
//   1. `format` is ASSERTED, not merely annotated. draft 2020-12 treats
//      format as an annotation by default; here "date-time" and "uri" are
//      checked. An unknown format value throws rather than passing.
//   2. `items` accepts only the 2020-12 single-schema form. The draft-07
//      tuple form (an array) throws as unsupported.
//
// PURE ASCII. No I/O, no clock, no network.
// =====================================================================

export class SchemaAssertError extends Error {
  constructor(message) {
    super('schemaAssert: ' + message);
    this.name = 'SchemaAssertError';
  }
}

// Keywords that carry no assertion. Encountering one is fine; it is
// listed here so that "ignored" is an explicit decision per keyword and
// never a fall-through default.
const ANNOTATION_KEYWORDS = new Set([
  '$schema', '$id', '$anchor', '$comment', '$defs',
  'title', 'description', 'default', 'examples', 'deprecated',
  'readOnly', 'writeOnly'
]);

// Keywords this file actually implements below.
const IMPLEMENTED_KEYWORDS = new Set([
  '$ref',
  'type', 'enum', 'const',
  'required', 'properties', 'additionalProperties',
  'pattern', 'minLength', 'maxLength', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'items', 'minItems', 'maxItems', 'uniqueItems',
  'allOf', 'anyOf', 'oneOf', 'not',
  'if', 'then', 'else'
]);

// ---------------------------------------------------------------------
// Type test. draft 2020-12 semantics: "integer" matches a number with a
// zero fractional part; "number" matches any finite JSON number.
// ---------------------------------------------------------------------
function matchesType(value, type) {
  switch (type) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      throw new SchemaAssertError('unsupported "type" value "' + String(type) + '"');
  }
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// Structural equality for `const` / `enum` / `uniqueItems`, over JSON data.
function jsonEqual(a, b) {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!jsonEqual(a[i], b[i])) return false;
    return true;
  }
  if (a !== null && typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return false;
    for (let i = 0; i < ka.length; i += 1) if (!jsonEqual(a[ka[i]], b[ka[i]])) return false;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// format assertions. Deliberately strict, and an unknown format is an
// ERROR rather than a pass: an unrecognised format silently ignored is
// the same false-green failure mode as an unrecognised keyword.
// ---------------------------------------------------------------------
// RFC 3339 date-time, which is what JSON Schema's "date-time" means.
const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function checkFormat(format, value) {
  if (typeof value !== 'string') return null; // format only applies to strings
  if (format === 'date-time') {
    if (!RFC3339.test(value)) return 'is not an RFC 3339 date-time';
    if (!Number.isFinite(Date.parse(value))) return 'is not a parseable date-time';
    return null;
  }
  if (format === 'uri') {
    // An absolute URI: a scheme is mandatory. URL also rejects malformed input.
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return 'is not an absolute URI (no scheme)';
    try {
      new URL(value);
    } catch {
      return 'is not a parseable URI';
    }
    return null;
  }
  throw new SchemaAssertError('unsupported "format" value "' + format + '" -- the instance was NOT checked against it');
}

// ---------------------------------------------------------------------
// $ref resolution. Local JSON pointers only ("#", "#/$defs/line").
// An external ref throws: this helper cannot fetch, and pretending to
// validate against a document it never loaded is the false green again.
// ---------------------------------------------------------------------
function resolveRef(ref, root) {
  if (typeof ref !== 'string' || ref.length === 0 || ref[0] !== '#') {
    throw new SchemaAssertError('unsupported $ref "' + String(ref) + '" -- only local pointers beginning "#" are resolvable here');
  }
  if (ref === '#') return root;
  if (ref[1] !== '/') {
    throw new SchemaAssertError('unsupported $ref "' + ref + '" -- $anchor references are not implemented');
  }
  const parts = ref.slice(2).split('/');
  let node = root;
  for (const rawPart of parts) {
    const part = decodeURIComponent(rawPart).replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) {
      throw new SchemaAssertError('$ref "' + ref + '" does not resolve inside this schema');
    }
    node = node[part];
  }
  return node;
}

// ---------------------------------------------------------------------
// The recursive core. Pushes human-readable messages onto `errors`;
// throws only for NOT-VALIDATED conditions (unsupported keyword, bad
// schema, unresolvable ref) which are a different class of problem from
// "the instance is wrong".
// ---------------------------------------------------------------------
function validateNode(schema, instance, instPath, schemaPath, root, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push(instPath + ': schema at ' + schemaPath + ' permits no value');
    return;
  }
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new SchemaAssertError('schema at ' + schemaPath + ' is not an object or boolean');
  }

  // FAIL CLOSED on anything not implemented, before any assertion runs.
  for (const keyword of Object.keys(schema)) {
    if (IMPLEMENTED_KEYWORDS.has(keyword) || ANNOTATION_KEYWORDS.has(keyword)) continue;
    throw new SchemaAssertError(
      'unsupported schema keyword "' + keyword + '" at ' + schemaPath +
      ' -- the instance was NOT VALIDATED against it. Implement it in schemaAssert.js; do not ignore it.'
    );
  }

  const before = errors.length;

  // $ref. In draft 2020-12 $ref no longer suppresses sibling keywords.
  if (Object.prototype.hasOwnProperty.call(schema, '$ref')) {
    validateNode(resolveRef(schema.$ref, root), instance, instPath, schema.$ref, root, errors);
  }

  // ---- type -----------------------------------------------------------
  if (Object.prototype.hasOwnProperty.call(schema, 'type')) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(instance, t))) {
      errors.push(instPath + ': expected type ' + types.join('|') + ' but got ' + typeOf(instance));
      // Type is wrong, so downstream keyword messages would be noise.
      return;
    }
  }

  // ---- const / enum ---------------------------------------------------
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    if (!jsonEqual(instance, schema.const)) {
      errors.push(instPath + ': must equal const ' + JSON.stringify(schema.const) + ' but was ' + JSON.stringify(instance));
    }
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'enum')) {
    if (!Array.isArray(schema.enum)) throw new SchemaAssertError('"enum" at ' + schemaPath + ' must be an array');
    if (!schema.enum.some((candidate) => jsonEqual(instance, candidate))) {
      errors.push(instPath + ': ' + JSON.stringify(instance) + ' is not one of ' + JSON.stringify(schema.enum));
    }
  }

  // ---- strings --------------------------------------------------------
  if (typeof instance === 'string') {
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(instance)) {
      errors.push(instPath + ': ' + JSON.stringify(instance) + ' does not match pattern ' + schema.pattern);
    }
    if (typeof schema.minLength === 'number' && instance.length < schema.minLength) {
      errors.push(instPath + ': shorter than minLength ' + schema.minLength);
    }
    if (typeof schema.maxLength === 'number' && instance.length > schema.maxLength) {
      errors.push(instPath + ': longer than maxLength ' + schema.maxLength);
    }
    if (typeof schema.format === 'string') {
      const problem = checkFormat(schema.format, instance);
      if (problem) errors.push(instPath + ': ' + JSON.stringify(instance) + ' ' + problem + ' (format: ' + schema.format + ')');
    }
  }

  // ---- numbers --------------------------------------------------------
  if (typeof instance === 'number' && Number.isFinite(instance)) {
    if (typeof schema.minimum === 'number' && instance < schema.minimum) {
      errors.push(instPath + ': ' + instance + ' is below minimum ' + schema.minimum);
    }
    if (typeof schema.maximum === 'number' && instance > schema.maximum) {
      errors.push(instPath + ': ' + instance + ' is above maximum ' + schema.maximum);
    }
    if (typeof schema.exclusiveMinimum === 'number' && instance <= schema.exclusiveMinimum) {
      errors.push(instPath + ': ' + instance + ' is not above exclusiveMinimum ' + schema.exclusiveMinimum);
    }
    if (typeof schema.exclusiveMaximum === 'number' && instance >= schema.exclusiveMaximum) {
      errors.push(instPath + ': ' + instance + ' is not below exclusiveMaximum ' + schema.exclusiveMaximum);
    }
    if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
      const ratio = instance / schema.multipleOf;
      if (!Number.isInteger(Number(ratio.toFixed(9)))) {
        errors.push(instPath + ': ' + instance + ' is not a multiple of ' + schema.multipleOf);
      }
    }
  }

  // ---- arrays ---------------------------------------------------------
  if (Array.isArray(instance)) {
    if (typeof schema.minItems === 'number' && instance.length < schema.minItems) {
      errors.push(instPath + ': has ' + instance.length + ' item(s), fewer than minItems ' + schema.minItems);
    }
    if (typeof schema.maxItems === 'number' && instance.length > schema.maxItems) {
      errors.push(instPath + ': has ' + instance.length + ' item(s), more than maxItems ' + schema.maxItems);
    }
    if (schema.uniqueItems === true) {
      for (let i = 0; i < instance.length; i += 1) {
        for (let j = i + 1; j < instance.length; j += 1) {
          if (jsonEqual(instance[i], instance[j])) {
            errors.push(instPath + ': items ' + i + ' and ' + j + ' are duplicates but uniqueItems is true');
          }
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'items')) {
      if (Array.isArray(schema.items)) {
        throw new SchemaAssertError(
          'the draft-07 tuple form of "items" (an array) at ' + schemaPath + ' is not implemented -- instance NOT VALIDATED'
        );
      }
      instance.forEach((item, i) => {
        validateNode(schema.items, item, instPath + '[' + i + ']', schemaPath + '/items', root, errors);
      });
    }
  }

  // ---- objects --------------------------------------------------------
  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(instance, key)) {
          errors.push(instPath + ': missing required property "' + key + '"');
        }
      }
    }
    const declared = (schema.properties && typeof schema.properties === 'object') ? schema.properties : null;
    if (declared) {
      for (const key of Object.keys(declared)) {
        if (Object.prototype.hasOwnProperty.call(instance, key)) {
          validateNode(
            declared[key], instance[key],
            instPath + '.' + key, schemaPath + '/properties/' + key, root, errors
          );
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'additionalProperties')) {
      for (const key of Object.keys(instance)) {
        if (declared && Object.prototype.hasOwnProperty.call(declared, key)) continue;
        if (schema.additionalProperties === false) {
          errors.push(instPath + ': property "' + key + '" is not permitted (additionalProperties is false)');
        } else {
          validateNode(
            schema.additionalProperties, instance[key],
            instPath + '.' + key, schemaPath + '/additionalProperties', root, errors
          );
        }
      }
    }
  }

  // ---- applicators ----------------------------------------------------
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((sub, i) => {
      validateNode(sub, instance, instPath, schemaPath + '/allOf/' + i, root, errors);
    });
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some((sub, i) => isValidAgainst(sub, instance, instPath, schemaPath + '/anyOf/' + i, root));
    if (!ok) errors.push(instPath + ': matched none of the anyOf branches at ' + schemaPath);
  }
  if (Array.isArray(schema.oneOf)) {
    const matched = schema.oneOf.filter((sub, i) => isValidAgainst(sub, instance, instPath, schemaPath + '/oneOf/' + i, root)).length;
    if (matched !== 1) errors.push(instPath + ': matched ' + matched + ' oneOf branches at ' + schemaPath + ' (exactly 1 required)');
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'not')) {
    if (isValidAgainst(schema.not, instance, instPath, schemaPath + '/not', root)) {
      errors.push(instPath + ': must NOT match the schema at ' + schemaPath + '/not');
    }
  }

  // ---- if / then / else ----------------------------------------------
  if (Object.prototype.hasOwnProperty.call(schema, 'if')) {
    const conditionHolds = isValidAgainst(schema.if, instance, instPath, schemaPath + '/if', root);
    if (conditionHolds && Object.prototype.hasOwnProperty.call(schema, 'then')) {
      validateNode(schema.then, instance, instPath, schemaPath + '/then', root, errors);
    }
    if (!conditionHolds && Object.prototype.hasOwnProperty.call(schema, 'else')) {
      validateNode(schema.else, instance, instPath, schemaPath + '/else', root, errors);
    }
  }

  void before;
}

// Sub-validation used by anyOf/oneOf/not/if, where failure is a normal
// outcome rather than an error to report. A SchemaAssertError still
// propagates: "not validated" must never be swallowed as "did not match".
function isValidAgainst(schema, instance, instPath, schemaPath, root) {
  const scratch = [];
  validateNode(schema, instance, instPath, schemaPath, root, scratch);
  return scratch.length === 0;
}

/**
 * Validate `instance` against `schema` (a parsed draft 2020-12 document).
 * @returns {{ valid: boolean, errors: string[] }}
 * @throws {SchemaAssertError} if any part of the schema could not be applied.
 */
export function validate(schema, instance) {
  const errors = [];
  validateNode(schema, instance, '$', '#', schema, errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Throwing form, for use in tests and at a trust boundary.
 * @throws {SchemaAssertError} on an invalid instance or an unappliable schema.
 */
export function assertValid(schema, instance, label) {
  const { valid, errors } = validate(schema, instance);
  if (!valid) {
    throw new SchemaAssertError(
      (label ? label + ' ' : '') + 'failed schema validation:\n  - ' + errors.join('\n  - ')
    );
  }
  return true;
}

export const SUPPORTED_KEYWORDS = Object.freeze(Array.from(IMPLEMENTED_KEYWORDS).sort());
