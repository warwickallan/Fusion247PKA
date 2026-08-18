// =====================================================================
// BUILD-015 AsdAIr - interpret/confidenceIsNotABinding.test.js
//
// ⛔ A CONFIDENCE VALUE WITHOUT AN IDENTITY BINDING IS NOT A SUCCESSFUL MATCH.
//    Warwick, 2026-08-18. An acceptance rule, not a remark.
//
// ── THE INCIDENT THIS EXISTS TO STOP RECURRING ────────────────────────────
// `Deliverables/2026-08-18-what-a-capable-model-does-with-this-list.md` said of
// the live shop's line 14, "2 sliced roast beef", that it was *"already matched
// at 0.99"*. It was not. The durable row carried:
//
//     match_confidence     0.99
//     matched_regular_id   NULL
//     status               needs_confirmation
//
// while `asdair.regulars` held BOTH 80 "ASDA Sliced Topside of Beef 90g" and
// 81 "Exceptional by ASDA Roast Topside of Beef 90g", active. Veritas caught the
// error in the acceptance standard itself, and Larry corrected the document at
// 76637e3. This file makes the distinction executable, so the next reader cannot
// make the same inference from the same two columns.
//
// ── WHY THE MISREADING IS EASY, AND WHY IT MATTERS ────────────────────────
// The two columns describe DIFFERENT THINGS, and only one of them is about
// identity:
//
//   match_confidence     how sure the VISION model was that it READ THE
//                        HANDWRITING correctly. A property of the reading.
//   matched_regular_id   which household product this line IS. A property of
//                        the identity - and the only one a basket can be
//                        filled from.
//
// So 0.99 with a NULL binding is the perfectly ordinary, perfectly honest state
// of "I am certain the page says 'sliced roast beef', and I have not decided
// which of your two beef products that is". Reading it as a successful match is
// how a line nobody had identified gets reported as resolved.
//
// PURE. No database, no gateway, no model.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { resolveAll } = require('./resolveByCatalogue.js');
const { loadFixtureCatalogue } = require('./knownList.js');

const catalogue = loadFixtureCatalogue();

/** One reading, driven through the real resolver at a chosen confidence. */
function resolveOne(reading, confidence, lineNo) {
  return resolveAll(
    [{ line_no: lineNo || 1, raw_reading: reading, quantity: 1, vision_confidence: confidence }],
    catalogue.regulars,
    { rules: catalogue.rules },
  )[0];
}

// ⚠️ A DIVERGENCE FOUND WHILE WRITING THIS FILE, AND REPORTED RATHER THAN
// SMOOTHED OVER. The live shop's line 14 carried `matched_regular_id NULL`;
// driven through THIS resolver against the COMMITTED catalogue, the same words
// ("2 sliced roast beef") bind regular 81, which the corpus accepts as one of
// two correct answers. So the null-binding state is a property of the live
// input, not of these words - and a test that claimed to reproduce line 14 here
// would be asserting something this code does not do. The DISTINCTION is what
// matters and is what is proven below, on lines that genuinely do not bind.

test('THE DISTINCTION: 0.99 confidence with a NULL binding is NOT a match', () => {
  // "1 wet wipes" - corpus line 29, `kind: new`. The household holds no row for
  // it, so nothing may bind, however perfectly the page was read.
  const line = resolveOne('1 wet wipes', 0.99, 29);

  assert.equal(line.match_confidence, 0.99,
    'the reading confidence is not carried, so the durable row cannot reproduce the case');
  assert.equal(line.matched_regular_id, null,
    'an identity was bound for a line the household has no row for');
  assert.notEqual(line.status, 'matched',
    'a line with no bound identity was reported as matched. "Already matched at 0.99" is exactly '
    + 'the claim Veritas falsified against the live row');
});

test('THE DISTINCTION: a perfect reading of an unknown product is still an unknown product', () => {
  const line = resolveOne("2 pks Ben & Jerry's cookie dough", 0.99, 18);
  assert.equal(line.match_confidence, 0.99);
  assert.equal(line.matched_regular_id, null,
    'a new product was given an identity the catalogue never authorised - the invention defect');
  assert.notEqual(line.status, 'matched');
});

test('THE RELATION IS ONE-DIRECTIONAL: confidence can WITHHOLD a binding, never SUPPLY one', () => {
  // Established by execution rather than assumed - an earlier draft of this test
  // asserted that the binding is INDEPENDENT of confidence, and the code proved
  // otherwise: below VISION_CONFIDENCE_THRESHOLD the resolver deliberately holds
  // the identity back and asks (`applyVisionConfidenceGate`). That is correct
  // and is not what Warwick's rule is about.
  //
  // The rule, stated precisely: a HIGH number can never create an identity the
  // catalogue does not authorise; a LOW number may refuse one it does. Identity
  // only ever flows from the catalogue, and confidence can only ever subtract.
  const known = '1 Princes lean corned beef';
  const certain = resolveOne(known, 0.99);
  const unsure = resolveOne(known, 0.10);

  // 1. Below the gate: the identity is WITHHELD, and the line says so.
  assert.equal(unsure.matched_regular_id, null,
    'a barely-read line kept its binding - the confidence gate is not firing');
  assert.equal(unsure.status, 'needs_confirmation',
    'a withheld identity must become a question, not a silent drop');

  // 2. Above the gate: the identity comes from the CATALOGUE, not the number.
  assert.equal(Number(certain.matched_regular_id), 9);

  // 3. And the number can never manufacture one. Same perfect confidence, a
  //    product the household does not hold: still nothing bound.
  const unknown = resolveOne('1 wet wipes', 0.99);
  assert.equal(unknown.matched_regular_id, null,
    'a high confidence supplied an identity. That is the direction the rule forbids: a confidence '
    + 'value without an identity binding is not a successful match');
});

test('A REAL BINDING carries an id, and that is what "matched" means', () => {
  // The contrast case: a line the catalogue really does answer, at the same
  // confidence. `matched` is earned by the id, never by the number beside it.
  const line = resolveAll(
    [{ line_no: 1, raw_reading: '1 Princes lean corned beef', quantity: 1, vision_confidence: 0.99 }],
    catalogue.regulars,
    { rules: catalogue.rules },
  )[0];

  assert.equal(line.match_confidence, 0.99);
  assert.notEqual(line.matched_regular_id, null,
    'a line the catalogue genuinely answers must bind an identity');
  assert.equal(Number(line.matched_regular_id), 9);
  assert.equal(line.status, 'matched');
});

test('THE RULE, AS A PREDICATE: "matched" is decided by the id and never by the number', () => {
  // Stated as an assertion a future reader can apply anywhere, over the whole
  // committed corpus rather than one hand-picked line.
  const lines = resolveAll(
    require('./knownList.js').loadKnownList().lines.map((l) => ({
      line_no: l.n, raw_reading: l.reading, quantity: l.qty, vision_confidence: 0.99,
    })),
    catalogue.regulars,
    { rules: catalogue.rules },
  );

  const liars = lines.filter((l) => l.status === 'matched' && l.matched_regular_id == null);
  assert.deepEqual(liars, [],
    'a line is reported `matched` while carrying no identity. Every one of these is a line that '
    + 'looks resolved in a report and cannot be bought');

  assert.ok(lines.every((l) => l.match_confidence === 0.99),
    'every line carries the same reading confidence here, deliberately - so any difference in '
    + 'status below is about IDENTITY and cannot be about the number');
  assert.ok(lines.some((l) => l.matched_regular_id == null),
    'no unbound line in the corpus, so this assertion proves nothing');
});
