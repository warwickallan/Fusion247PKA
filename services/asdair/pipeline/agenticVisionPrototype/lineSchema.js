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
// ── WP-B15-33 C6: `band_position_pct` — WHERE THE LINE WAS SEEN ─────────
// AUTHORISED BY LARRY, 2026-08-12 (Amendment 1 to WO-2026-08-12-06), and
// reported to Warwick as Larry's ruling. It is the SAME PATTERN as
// `leading_mark`: a transcription-only observation field, added because a
// decision the application must make deterministically had no evidence to
// make it from.
//
// ⛔ WHY THIS IS NOT WHAT WARWICK CLOSED. He forbade redesigning the vision
// architecture, another model experiment, and prompt whack-a-mole. This is
// none of those. Regions, reading axis, 3x enlargement, individual band
// inspection, the closed enum, UNKNOWN and the explicit quantity field are
// ALL UNTOUCHED. Nothing about how the page is SEEN changes.
//
// WHY IT IS NECESSARY RATHER THAN NICE. Warwick's AC3 requires that a
// catalogue product with no supporting visual evidence cannot enter PHOTO
// provenance, and requires it STRUCTURALLY rather than as a prompt request.
// Measured on the three variance artefacts, the phantoms - "1 box MILKY WAY",
// "1 TRESemme conditioner", "1 WALLS SAUSAGE ROLLS" - each carry a VALID
// application-supplied `source_region`, a non-empty `as_written` and an
// in-enum `product_id`. They pass every gate the application has. Without a
// per-line positional signal there is nothing structural left to test: the
// only other application-owned candidate, the geometric line budget, is
// per-BAND not per-LINE and is strong enough to reject a real line.
//
// ⛔ THE BOUND, AND IT IS THE WHOLE SAFETY OF THE FIELD:
//   * TRANSCRIPTION ONLY - where the writing physically sits in this crop.
//   * NO BEARING on identity, on quantity, or on the candidate set.
//   * IT MAY NEVER BE A REASON TO ACCEPT A LINE. It may only ever be a reason
//     to WITHHOLD one. A missing or useless value therefore costs detection
//     nothing and can never manufacture confidence.
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

// =====================================================================
// WP-B15-34 AC1 - THE POSITIONAL FIELD LOSES. MEASURED, NOT ARGUED.
//
// ⛔ WARWICK'S RULE, QUOTED, AND IT IS WHAT THIS CONSTANT EXECUTES:
//    "If the field costs detection, the field loses - 39/39 is the decisive
//     product number and no gate is worth trading for it."
//
// THE CONTROLLED COMPARISON (runs/*-ac1-position-ab.json, 12 pairs, ONE crop
// rendered once and sent to both arms, arms proven byte-exact against their
// reference commits before any gateway call):
//
//   lines returned per band call   ON 6.25   OFF 7.33   (-14.8%)
//   two-sided permutation test     p = 0.0127
//   neighbour-JOIN readings        ON 6/12   OFF 3/12   (roughly doubled)
//   page-25 detection              ON 11/12  OFF 12/12  (Fisher p = 0.50)
//
// ── READ THE TWO TESTS TOGETHER, BECAUSE ONE OF THEM IS A TRAP ──────────
// The single-line test is the UNDERPOWERED one: a 1-in-39 event cannot be
// resolved at n=12, and its p = 0.50 says only "not demonstrated", never "no
// effect". The LINE-COUNT test is the powerful one, and it is decisive: asking
// for a position costs a whole line per band call.
//
// The mechanism is visible in the readings themselves. With the field ON the
// model returns "CALGON • SUPERGLUE" - two adjacent page lines JOINED into one
// answer - at twice the rate. Being asked "where does this line sit?" appears
// to push it towards describing a REGION of ink rather than enumerating the
// lines in it. That is exactly how page 25 was lost in WP-B15-33: the artefact
// shows it merged into its neighbour in one run and absent in another - TWO
// mechanisms, not the one the Work Order assumed.
//
// ── AND IT WAS NOT BUYING ANYTHING (AC2) ────────────────────────────────
// Measured over the three WP-B15-33 artefacts, positional precision does NOT
// separate phantoms from real lines: invention rate 5.7% in the best-resolved
// bands against 1.5% in the worst, and BOTH "TRESemme conditioner" phantoms
// were granted PHOTO from the best-resolved band in the whole dataset.
//
// So the field costs detection and buys no discrimination. Both findings point
// the same way and the rule decides it.
//
// ⛔ THE GATE IS NOT DELETED, AND THIS IS DELIBERATE. With no position in the
//    contract, `applyVisualEvidenceGate` reports NOT_ASSESSED for every line
//    and withholds nothing - the path it already had for every pre-WP-B15-33
//    artefact, and the honest state AC2 explicitly authorises: "if calibration
//    cannot separate the phantoms from real lines, say so and set the gate to
//    not-assessed rather than ship an outage." NOT_ASSESSED is not a pass, and
//    nothing may render it as one.
//
//    Flipping this constant to `true` restores the field and its calibrated
//    gate in one place, with the measurement above as the standing reason not
//    to without new evidence.
// =====================================================================

/** Whether the model is asked for `band_position_pct`. WP-B15-34 AC1: no. */
export const ASK_FOR_BAND_POSITION = false;

/**
 * The strict JSON schema for the loop's final answer.
 *
 * @param {object} args
 * @param {Array<{id: string|number}>} [args.candidates] - the supplied candidate set.
 * @param {number[]} args.regionNos - every region the application supplied this turn.
 * @param {boolean} [args.withPosition=ASK_FOR_BAND_POSITION] - WP-B15-34 AC1.
 *   When false, the `band_position_pct` property is neither offered nor
 *   required, and the schema returns to its `54e1743` shape byte-for-byte.
 *   The default is now `false` - see `ASK_FOR_BAND_POSITION`.
 * @returns {object} a JSON Schema object.
 */
export function buildLineSchema({ candidates = [], regionNos, withPosition = ASK_FOR_BAND_POSITION } = {}) {
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
          required: withPosition
            ? ['line_no', 'as_written', 'leading_mark', 'band_position_pct', 'visible_line', 'product_id', 'source_region', 'quantity', 'confidence']
            : ['line_no', 'as_written', 'leading_mark', 'visible_line', 'product_id', 'source_region', 'quantity', 'confidence'],
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
            ...(withPosition ? {
              band_position_pct: {
                type: ['integer', 'null'],
                description: 'OBSERVATION ONLY: how far along this crop, in the direction you are reading the lines, the START of this line physically sits. 0 = hard against the beginning edge of this crop, 100 = hard against the far edge. Read it off where the ink actually is. NEVER derive it from the order of your answer, never space your lines out evenly to look tidy, and never adjust it to make two lines differ. If you genuinely cannot place the line in this crop, return null - that is an honest and acceptable answer. This value says nothing about what the line is or how many to buy.',
              },
            } : {}),
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
