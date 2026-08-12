// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/lineSchema.js
//
// WO-2026-08-12-01-v2 (WP-B15-29), AC2/AC3: the strict JSON schema that
// CLOSES the loop's output space, and the FLAT `text.format` envelope that
// carries it to /v1/responses.
//
// WHAT THIS IS FOR, in one line: the model can no longer emit a product
// identity that the application did not hand it, because the only identities
// the schema will accept are the ones the application put in the enum.
//
// ── THREE THINGS HERE THAT LOOK OPTIONAL AND ARE NOT ────────────────────
//
// 1. `strict: true` IS THE ENFORCING SWITCH. Live adversarial probing of this
//    deployment (70 constrained samples) found `strict:false` and `strict`
//    omitted BOTH escaped immediately, while `strict:true` produced zero
//    escapes. A schema without it is decoration that returns HTTP 200.
//
// 2. THE TWO ESCAPE VALUES ARE MANDATORY IN EVERY ENUM. With the escape
//    hatches removed, the same probing found the model returned a confidently
//    WRONG in-enum ID 5/5 rather than declining, and silently returned an
//    empty array 2/5. Enforcement does not create honesty - on its own it
//    converts invention into confident mis-identification and silent
//    omission, BOTH of which are harder to detect than the invention they
//    replace. `UNKNOWN_VISIBLE_ITEM` and `NOT_A_LINE` exist so that "I can
//    see a line and cannot name it" and "there is nothing here" are
//    expressible, cheap and legal answers. Never build an enum without them.
//
// 3. `as_written` IS DELIBERATELY UNCONSTRAINED FREE TEXT. A closed enum makes
//    an out-of-enum answer impossible; it does nothing whatever about an
//    in-enum answer that is simply wrong. The verbatim reading is the ONLY
//    field in which a wrong-but-legal identity becomes visible - to a human,
//    to the scorer, and to the duplicate check. Constraining it, summarising
//    it, or letting the model "tidy" it destroys the one signal that detects
//    the failure mode this schema creates.
//
// ── WP-B15-31 AC1: `leading_mark` IS A SEPARATE FIELD BECAUSE `as_written`
//    DEMONSTRABLY LOSES THE COUNT ───────────────────────────────────────
// Measured on the real photograph, not theorised. Every one of the 39 page
// lines begins with a written count. In the WP-B15-30 Arm D run only 38.8%
// of `as_written` values came back starting with a digit; in Arm C, 54.9%.
// The count was being dropped on roughly three lines in five.
//
// It was invisible as a defect because the household default is ONE: on every
// line whose true count IS 1, a lost count and a correctly-read count produce
// the same answer. Only the six lines whose count was NOT 1 ever surfaced as
// quantity errors - so "7 quantity errors" was measuring the overlap between
// a large silent fault and a small subset of lines, never the fault itself.
//
// ⛔ IT IS NOT A RESOLUTION PROBLEM, and that was checked before anything was
// built. The delivered ×3 band crops were re-rendered and inspected: in the
// band carrying "2 BLOO TOILET Rim" the leading "2" is plainly legible, and
// the model returned "BLOO TOILET RIM" from that exact crop while tidying
// "FERBREEZE" to the catalogue's "FEBREZE". More resolution made it WORSE
// (Arm C 54.9% -> Arm D 38.8%), which is the opposite of what a pixel
// shortage predicts. The count was not missing from the image; it was being
// tidied out of a free-text field on its way to a catalogue-shaped name.
//
// So the count gets its own REQUIRED, nullable, transcription-only field. A
// tidy-up of the product name can no longer take the purchase count with it,
// because the count is no longer stored inside the product name. The
// deterministic default-one rule is UNCHANGED and is not weakened, bypassed
// or special-cased - it simply stops being handed evidence that has already
// been destroyed.
//
// ── AC3: THE TWO QUESTIONS ARE SEPARATE FIELDS, NOT ONE ─────────────────
// `visible_line` (is there actually a handwritten line here?) is asked
// distinctly from `product_id` (which supplied candidate is it?). They are
// different questions with different failure modes, and a single field
// conflates "I see something I cannot name" with "I see nothing" - the exact
// conflation that lets a supplied candidate become a PHOTO line with no image
// evidence behind it.
//
// ── STRICT-MODE SCHEMA RULES, obeyed here rather than discovered at runtime ─
// Under `strict:true` EVERY object must set `additionalProperties:false` and
// list EVERY property in `required`. An optional field is expressed as a
// nullable type (`['integer','null']`), never by omission from `required`.
//
// PURE. No I/O, no gateway call, no credentials.
// =====================================================================

'use strict';

/** The model can see a line but cannot say which supplied candidate it is. */
export const UNKNOWN_VISIBLE_ITEM = 'UNKNOWN_VISIBLE_ITEM';

/** There is no handwritten shopping line here (a header, a smudge, a stray mark). */
export const NOT_A_LINE = 'NOT_A_LINE';

/** Both escapes, in the order they are appended to every enum. */
export const ESCAPE_VALUES = Object.freeze([UNKNOWN_VISIBLE_ITEM, NOT_A_LINE]);

/** The schema's `name`, echoed by the gateway and asserted by the wire proof. */
export const SCHEMA_NAME = 'asdair_photo_lines';

/**
 * Build the closed `product_id` enum for one turn: the candidate IDs the
 * application actually supplied, plus the two mandatory escapes.
 *
 * IDs are stringified because `asdair.regulars.id` is a bigint and
 * node-postgres returns it as a STRING - so a numeric enum would compare
 * unequal to the value every downstream consumer actually holds. The same
 * hazard already cost this build one live shop (see loadCatalogue.js's own
 * note on `Number(r.id)`); it is not repeated here by keeping ONE textual
 * form end to end.
 *
 * @param {Array<{id: string|number}>} candidates
 * @returns {string[]}
 */
export function buildProductIdEnum(candidates = []) {
  const ids = [];
  const seen = new Set();
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const id = String(c.id ?? c);
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  for (const escape of ESCAPE_VALUES) {
    if (seen.has(escape)) {
      throw new Error(`buildProductIdEnum: a candidate id collides with the reserved escape value ${escape}`);
    }
  }
  return [...ids, ...ESCAPE_VALUES];
}

/**
 * The strict JSON schema for the loop's final answer.
 *
 * @param {object} args
 * @param {Array<{id: string|number}>} [args.candidates] - the supplied candidate set.
 * @param {number[]} args.regionNos - every region the application supplied this turn.
 * @returns {object} a JSON Schema object.
 */
export function buildLineSchema({ candidates = [], regionNos } = {}) {
  if (!Array.isArray(regionNos) || regionNos.length === 0) {
    throw new Error('buildLineSchema: regionNos is required and must be non-empty');
  }
  const productIdEnum = buildProductIdEnum(candidates);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array',
        description: 'Every line you found, across every region you inspected.',
        items: {
          type: 'object',
          additionalProperties: false,
          // strict mode: EVERY property is required; optionality is a null type.
          required: ['line_no', 'as_written', 'leading_mark', 'visible_line', 'product_id', 'source_region', 'quantity', 'confidence'],
          properties: {
            line_no: {
              type: 'integer',
              description: 'Sequential number of this line in your answer, starting at 1.',
            },
            as_written: {
              type: 'string',
              description: 'VERBATIM what is written on the page for this line, exactly as read, including spelling and abbreviations. Never a tidied, corrected or catalogue-matched name.',
            },
            leading_mark: {
              type: ['string', 'null'],
              description: 'TRANSCRIBE, never interpret: the mark or marks written at the very START of this line, BEFORE the product name begins - for example "2", "16", "1 x 6pts", "4 x 4pts", "2 PKTS.". Copy exactly what is written there, even if it is a single digit. If the line begins directly with a word, this is null. Never infer it, never calculate it, never take a number from later in the line, and never omit it because the line looks like an ordinary single item.',
            },
            visible_line: {
              type: 'boolean',
              description: 'FIRST question, answered independently: is there actually a handwritten shopping line at this place on the page? true = you can see writing here. false = there is no line here.',
            },
            product_id: {
              type: 'string',
              enum: productIdEnum,
              description: `SECOND question, answered only after the first: which supplied candidate does the visible writing correspond to? Use ${UNKNOWN_VISIBLE_ITEM} when you can see a line but cannot confidently match it to a supplied candidate - that is a correct and welcome answer. Use ${NOT_A_LINE} when there is no shopping line here at all.`,
            },
            source_region: {
              type: 'integer',
              enum: [...regionNos],
              description: 'The region number where you actually read this line. Only a region supplied to you is valid.',
            },
            quantity: {
              type: ['integer', 'null'],
              description: 'How many to buy, ONLY when separate evidence says so (a count written before the item, or an explicit multiplier). A number that is part of the product name or pack size is NEVER the quantity. No separate evidence means null.',
            },
            confidence: {
              type: 'number',
              description: 'Your confidence in this READING, 0 to 1. It decides only whether the page is worth another look; it never makes a line acceptable.',
            },
          },
        },
      },
    },
  };
}

/**
 * Wrap a schema in the FLAT `text.format` envelope /v1/responses actually
 * enforces.
 *
 * ⚠️ TWO FORBIDDEN SHAPES, one of which fails silently:
 *   - nesting `json_schema: {...}` INSIDE this object -> loud HTTP 400;
 *   - sending it as `response_format` -> HTTP 200 with NO constraint applied,
 *     on the very endpoint this prototype calls.
 * Anything that returns 200 while enforcing nothing is worse than an error,
 * because the pipeline downstream looks healthy while being unconstrained.
 *
 * @param {object} schema
 * @param {string} [name]
 * @returns {{type:'json_schema', name:string, strict:true, schema:object}}
 */
export function buildTextFormat(schema, name = SCHEMA_NAME) {
  if (!schema || typeof schema !== 'object') {
    throw new Error('buildTextFormat: a schema object is required');
  }
  return {
    type: 'json_schema',
    name,
    strict: true,
    schema,
  };
}
