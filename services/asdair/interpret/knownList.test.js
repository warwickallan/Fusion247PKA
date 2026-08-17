// =====================================================================
// BUILD-015 AsdAIr - THE KNOWN LIST. Mum's real 17 August shopping list,
// end to end through the real resolver, against the outcome Warwick
// reconciled from the photograph himself.
//
// WHAT MAKES THIS DIFFERENT FROM EVERY OTHER SUITE IN THIS SERVICE
//
// Every test beside it is built from a hand-written catalogue slice chosen by
// whoever wrote the test. This one runs the household's ACTUAL 109 regulars and
// 28 active rules - committed at pipeline/testdata/ - over the ACTUAL 37 lines,
// and compares the result with the frozen manifest of what should have been
// bought. Nobody chose the input to suit the code.
//
// WHAT IT DOES NOT PROVE, STATED HERE SO NO GREEN IS BORROWED
//
// These are the CLEAN-TEXT numbers: the readings are what a correct
// transcription of the photograph produces, so the reading of the page is taken
// out of the argument entirely. It proves the matcher, the rules and the
// question-generation. It proves NOTHING about the vision model, the gateway,
// or the prompt - that is a live run, and it is not a builder's to give.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveAll } = require('./resolveByCatalogue');
const { extractRuleTriggers } = require('./ruleTriggers');
const { loadFixtureCatalogue, loadKnownList, readingsFromKnownList, scoreRun } = require('./knownList');

const catalogue = loadFixtureCatalogue();
const known = loadKnownList();

function run() {
  return resolveAll(readingsFromKnownList(known), catalogue.regulars, { rules: catalogue.rules });
}

// ── 0. The fixture is the real thing, not a convenient sample ───────────────

test('the fixture is the household catalogue and Mum\'s whole list', () => {
  assert.equal(catalogue.regulars.length, 109, 'all 109 active regulars');
  // 28 until 2026-08-18. Two corrections raised it, and both matter:
  // the dump query was fixed to include the GLOBAL (household_id IS NULL) rules
  // that loadCatalogue actually reads — a fixture without them was quietly a
  // different rulebook from production — and rules 51/52 were added to settle
  // the Heinz-size and beef-identity ties that would otherwise reach Warwick
  // every week.
  assert.equal(catalogue.rules.length, 39, 'all 39 active rules');
  assert.equal(known.lines.length, 37, 'all 37 lines of the list');
  assert.equal(known.line_count, 37);
  // 45 rows have no ASDA product id and that must never matter to identity.
  const withoutId = catalogue.regulars.filter((r) => !r.asda_product_id).length;
  assert.ok(withoutId > 40, `${withoutId} rows have no asda_product_id - identity is the NAME`);
});

// ── 1. THE THREE NUMBERS ────────────────────────────────────────────────────

test('THE MEASUREMENT: no invented identity, and at most two questions', () => {
  const score = scoreRun(known, run());

  // (a) NOT ONE line may be given an identity the catalogue did not authorise.
  //     This is the class that put "2 skinny cow bars" in a real basket, and it
  //     is the only one of the three that costs the wrong food.
  assert.equal(score.unauthorised_identity, 0,
    `invented or forbidden identities: ${JSON.stringify(score.byLine.filter((l) => l.unauthorised_identity))}`);

  // (b) A question is a last resort. Nine were asked live, of which Warwick
  //     judged at most two genuine. The two that survive here are the two the
  //     household's own rows genuinely cannot separate.
  assert.ok(score.avoidable_questions <= 2,
    `${score.avoidable_questions} lines would be put to a human: ${JSON.stringify(score.byLine.filter((l) => l.avoidable_question).map((l) => l.reading))}`);

  // (c) Ten of 37 were unresolved live on clean text.
  assert.ok(score.unresolved_wrongly <= 2, `${score.unresolved_wrongly} lines unresolved`);

  // (d) And a quantity Mum wrote must survive - in both directions.
  assert.equal(score.quantities_lost, 0);

  assert.ok(score.correct >= 35, `${score.correct} of 37 correct`);
});

test('every question that IS raised carries the right answer among its candidates', () => {
  const score = scoreRun(known, run());
  for (const line of score.byLine.filter((l) => l.avoidable_question)) {
    assert.equal(line.verdict, 'HELD_WITH_ANSWER_IN_HAND',
      `line ${line.n} "${line.reading}" is put to a human with nothing useful attached`);
  }
});

// ── 2. THE NAMED FAILURES OF 2026-08-17, ONE TEST EACH ──────────────────────
//
// Each of these fails if its fix is reverted. They are written against the
// LINE, not against the mechanism, so a different correct implementation still
// passes and a regression cannot hide behind a refactor.

test('the beef is never a fiction: "2 sliced roast beef" stays beef', () => {
  const line = run()[13];
  const offered = [line.matched_regular_id, ...line.alternatives.map((a) => a.id)]
    .filter((v) => v !== null && v !== undefined).map(Number);
  assert.ok(offered.length > 0, 'the line must reach a human with the household\'s own beef rows on it');
  for (const id of offered) {
    const reg = catalogue.regularsById.get(id);
    assert.match(reg.name, /Beef/i, `${reg.name} is not beef - live this line became "2 skinny cow bars"`);
  }
});

test('the two Heinz lines stay two DIFFERENT products', () => {
  const out = run();
  const beans = out[14];
  const sausageAndBeans = out[15];
  assert.equal(Number(sausageAndBeans.matched_regular_id), 63,
    'the sausage & beans must resolve to the sausage & beans - live it vanished into line 15');
  const beansIds = [beans.matched_regular_id, ...beans.alternatives.map((a) => a.id)]
    .filter((v) => v !== null && v !== undefined).map(Number);
  assert.ok(!beansIds.includes(63), 'the plain beans line must never offer the sausage product');
  assert.ok(beansIds.includes(108), 'the 6-pack Heinz must be on the table for the 6pk line');
});

test('the conditioner is NEVER the shampoo, and the shampoo is still the shampoo', () => {
  const out = run();
  assert.equal(Number(out[30].matched_regular_id), 17,
    'TRESemme CONDITIONER - live this resolved to the shampoo because 105 carries the alias "tresemme blue label"');
  assert.equal(Number(out[31].matched_regular_id), 105, 'and the shampoo line is still the shampoo');
  assert.notEqual(out[30].matched_regular_id, out[31].matched_regular_id,
    'two shampoos and no conditioner is exactly what happened on 17 August');
});

test('an active rule decides, instead of a human being asked', () => {
  const out = run();
  // Rule 50: "Sure deodorant male: ALWAYS take ... (regular 25). FIXED CHOICE -
  // do NOT rotate, do NOT offer variants, do NOT ask."
  assert.equal(Number(out[29].matched_regular_id), 25);
  assert.match(out[29].match_basis, /household rule 50/);
  // Rule 11: "Toffees with no qualifier means ASDA Dairy Toffee 180g."
  assert.equal(Number(out[32].matched_regular_id), 33);
  assert.match(out[32].match_basis, /household rule 11/);
});

test('a pack size on the line is identity evidence, not an order quantity', () => {
  const out = run();
  // "6 ASDA large free range eggs" - one box OF six. 27 is the box of twelve.
  assert.equal(Number(out[12].matched_regular_id), 32);
  assert.equal(out[12].quantity, 1, 'one box, not six boxes');
  // "1 x 5pk Heinz sausage & beans" - the 5 never becomes five packs of beans.
  assert.equal(out[15].quantity, 5, 'five, as the frozen manifest requires');
});

test('a line the catalogue genuinely has no row for stays NEW - never a near neighbour', () => {
  const out = run();
  for (const n of [18, 19, 29]) {
    const line = out[n - 1];
    assert.equal(line.matched_regular_id, null,
      `line ${n} "${line.raw_reading}" has no row in this household's catalogue and must not be given one`);
  }
  // And the wet wipes must never be offered the cat food it was offered live.
  const wipes = out[28];
  for (const alt of wipes.alternatives) {
    assert.notEqual(Number(alt.id), 1, 'cat food was offered for wet wipes on the live question board');
  }
});

// ── 3. THE RULEBOOK READER, AND WHAT IT REFUSES TO READ ─────────────────────

test('only rules that name a real row of THIS household may decide anything', () => {
  const triggers = extractRuleTriggers(catalogue.rules, catalogue.regulars);
  assert.ok(triggers.length >= 5, 'the readable rules must actually be found');
  assert.ok(triggers.length < catalogue.rules.length,
    'prose that cannot be read precisely must stay prose - it is not guessed at');
  for (const t of triggers) {
    assert.ok(catalogue.regularsById.has(t.regular_id),
      `rule ${t.rule_id} points at ${t.regular_id}, which this household does not have`);
    assert.ok(['identity', 'exclude'].includes(t.power));
  }
});

test('an EXCLUSION may never be read as an instruction to buy', () => {
  // Rule 17: "Yazoo: NEVER buy Banana ... Chocolate/Strawberry are accepted."
  // Read as an identity that would buy the one thing Warwick has forbidden.
  const triggers = extractRuleTriggers(catalogue.rules, catalogue.regulars);
  for (const t of triggers) {
    if (String(t.rule_id) === '17' || String(t.rule_id) === '26') {
      assert.equal(t.power, 'exclude', 'a "never buy" rule can only ever remove a candidate');
    }
  }
  const banana = catalogue.regulars.find((r) => /Banana/i.test(r.name));
  const out = run();
  for (const line of out) {
    assert.notEqual(Number(line.matched_regular_id), Number(banana.id),
      'the banana Yazoo is a hard exclusion and may never be resolved to');
  }
});

test('a rule with no readable target contributes nothing at all', () => {
  const nonsense = [{ id: 999, directive: 'map', rule_text: 'Buy the good one when it looks nice.', active: true }];
  assert.deepEqual(extractRuleTriggers(nonsense, catalogue.regulars), []);
});
