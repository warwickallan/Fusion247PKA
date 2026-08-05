// =====================================================================
// BUILD-015 AsdAIr - the learning loop: buildAnswerLearning.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented ids, "Widget"-style names). ZERO real
// household data. This file runs in CI on the PUBLIC repo.
//
// NO DATABASE. buildAnswerLearning is pure, so every rule below is proven with
// no connection of any kind.
//
// The cross-shop acceptance property - "an answer given this week prevents the
// same question next week" - is NOT proven here. It is proven against the REAL
// planner in answerSurvivesTheWeek.test.js, because asserting it against this
// module alone would only prove that this module agrees with itself.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAnswerLearning,
  SOURCE_VIEW_TO_REGULARS_SOURCE,
  ADD_FAVOURITE_ACTION,
  SKIP_ANSWER_TEXT
} = require('./buildAnswerLearning');

// A minimal, valid answer. Individual tests override one field at a time so a
// failure names exactly one cause.
function answer(overrides) {
  return Object.assign({
    shop_id: 41,
    question_key: 'bottle-widget-coffee',
    question_text: 'The list says "bottle widget coffee" - which product is that?',
    asked_on: '2026-08-03',
    status: 'answered',
    answer_text: 'That is the Widget Barista Jar 100g',
    answer_source: 'button',
    household_id: 1,
    photographed_wording: 'bottle Widget coffee',
    applies_going_forward: false,
    source_document_id: 3,
    resolution: { kind: 'known_product', regular_id: 108 }
  }, overrides || {});
}

// =====================================================================
// 1. Every answer produces a decision - that is not optional
// =====================================================================

test('every answer produces a rule_qa_log decision carrying the question and the answer verbatim', function () {
  const plan = buildAnswerLearning(answer());
  assert.equal(plan.decision.question, 'The list says "bottle widget coffee" - which product is that?');
  assert.equal(plan.decision.answer, 'That is the Widget Barista Jar 100g');
  assert.equal(plan.decision.asked_on, '2026-08-03');
  assert.equal(plan.decision.applies_going_forward, false);
  assert.equal(plan.decision.household_id, 1);
  assert.equal(plan.decision.source_document_id, 3);
});

test('a decision that does not apply going forward carries NO rule payload', function () {
  const plan = buildAnswerLearning(answer());
  assert.equal(Object.prototype.hasOwnProperty.call(plan.decision, 'rule'), false);
});

// =====================================================================
// 2. THE HIGHEST-VALUE LINE: the photographed wording becomes an alias,
//    and the caller cannot omit it
// =====================================================================

test('the photographed wording becomes an alias on the identified regular', function () {
  const plan = buildAnswerLearning(answer());
  assert.equal(plan.regulars.length, 1);
  assert.equal(plan.regulars[0].op, 'enrichRegular');
  assert.equal(plan.regulars[0].id, 108);
  assert.deepEqual(plan.regulars[0].add_aka, ['bottle widget coffee']);
});

test('the photographed alias is added even when the caller supplies its own alias list', function () {
  // The caller cannot displace it: a caller that forgets the photographed
  // wording is exactly how 2026-08-03 happened.
  const plan = buildAnswerLearning(answer({
    resolution: { kind: 'known_product', regular_id: 108, aliases: ['widget jar'] }
  }));
  assert.deepEqual(plan.regulars[0].add_aka, ['bottle widget coffee', 'widget jar']);
});

test('aliases are normalised the way the read path matches, and de-duplicated', function () {
  const plan = buildAnswerLearning(answer({
    photographed_wording: '  Bottle   WIDGET Coffee ',
    resolution: {
      kind: 'known_product',
      regular_id: 108,
      aliases: ['bottle widget coffee', 'BOTTLE WIDGET COFFEE', 'widget jar']
    }
  }));
  assert.deepEqual(plan.regulars[0].add_aka, ['bottle widget coffee', 'widget jar']);
});

test('the approved search wording is persisted as an alias too', function () {
  // asdair.regulars has no column for an approved search term, so the alias
  // array is its durable home - and it is also what makes next week's
  // matching work if Warwick used that wording.
  const plan = buildAnswerLearning(answer({
    resolution: {
      kind: 'known_product',
      regular_id: 108,
      approved_search_term: 'Widget Barista Jar 100g'
    }
  }));
  assert.deepEqual(plan.regulars[0].add_aka, ['bottle widget coffee', 'widget barista jar 100g']);
});

test('suppression names the photographed term and reports it as load-bearing', function () {
  const plan = buildAnswerLearning(answer());
  assert.equal(plan.suppression.photographed_term, 'bottle widget coffee');
  assert.equal(plan.suppression.prevents_repeat, true);
  assert.deepEqual(plan.suppression.terms, [
    { term: 'bottle widget coffee', mechanism: 'alias', regular_id: 108 }
  ]);
});

// =====================================================================
// 3. A genuinely new product becomes next week's catalogue
// =====================================================================

function newProductAnswer(productOverrides) {
  return answer({
    photographed_wording: 'bottle azzera coffee',
    answer_text: 'New one - Widget Azzera Instant 100g',
    resolution: {
      kind: 'new_product',
      approved_search_term: 'Widget Azzera Instant 100g',
      product: Object.assign({
        name: 'Widget Azzera Instant 100g',
        brand: 'Widget',
        asda_product_id: '910000000001',
        asda_url: 'https://groceries.asda.com/product/910000000001',
        category: 'Hot Drinks',
        high_level_category: 'Ambient',
        typical_qty: 1,
        source_view: 'regulars',
        favourite_action_completed: true
      }, productOverrides || {})
    }
  });
}

test('a new product persists ASDA reference, URL, canonical name and brand', function () {
  const plan = buildAnswerLearning(newProductAnswer());
  assert.equal(plan.regulars.length, 1);
  const op = plan.regulars[0];
  assert.equal(op.op, 'upsertRegular');
  assert.equal(op.regular.name, 'Widget Azzera Instant 100g');
  assert.equal(op.regular.brand, 'Widget');
  assert.equal(op.regular.asda_product_id, '910000000001');
  assert.equal(op.regular.asda_url, 'https://groceries.asda.com/product/910000000001');
  assert.equal(op.regular.active, true);
});

test('a new product carries the photographed wording as an alias on the row it creates', function () {
  // One operation, not two: a crash between "create the regular" and "teach it
  // the wording" would leave a row that does not answer to the words that
  // created it - i.e. the question would be asked again anyway.
  const plan = buildAnswerLearning(newProductAnswer());
  assert.equal(plan.regulars.length, 1);
  assert.deepEqual(plan.regulars[0].regular.aka, ['bottle azzera coffee']);
});

test('an approved search term DIFFERENT from the canonical name is kept as an alias', function () {
  const plan = buildAnswerLearning(newProductAnswer());
  plan.regulars.length = 0;   // guard against accidental reuse below
  const withSearch = buildAnswerLearning(answer({
    photographed_wording: 'bottle azzera coffee',
    answer_text: 'New one',
    resolution: {
      kind: 'new_product',
      approved_search_term: 'azzera instant coffee',
      product: { name: 'Widget Azzera Instant 100g', source_view: 'regulars' }
    }
  }));
  assert.deepEqual(withSearch.regulars[0].regular.aka,
    ['bottle azzera coffee', 'azzera instant coffee']);
});

test('the canonical name is never stored as an alias of itself', function () {
  // approved_search_term here is byte-identical to the product name.
  const plan = buildAnswerLearning(newProductAnswer());
  assert.equal(plan.regulars[0].regular.aka.indexOf('widget azzera instant 100g'), -1);
});

test('the source view decides Regulars vs Favourites through ONE mapping constant', function () {
  const regulars = buildAnswerLearning(newProductAnswer({ source_view: 'regulars' }));
  const favourites = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', favourite_action_completed: true
  }));
  assert.equal(regulars.regulars[0].regular.source, SOURCE_VIEW_TO_REGULARS_SOURCE.regulars);
  assert.equal(favourites.regulars[0].regular.source, SOURCE_VIEW_TO_REGULARS_SOURCE.favourites);
  // The two halves are NOT equally evidenced, and a test that treated them as
  // if they were would quietly launder a forward contract into a fact.
  assert.notEqual(SOURCE_VIEW_TO_REGULARS_SOURCE.regulars, SOURCE_VIEW_TO_REGULARS_SOURCE.favourites,
    'the two views must not collapse to one value, or the distinction is unrepresentable');
});

test('the Favourites mapping is a FORWARD CONTRACT, not a description of live data', function () {
  // Live, 2026-08-04: `select distinct source from asdair.regulars` returns
  // 'regular' and nothing else. No 'favourite' row exists or ever has.
  //
  // This test does not - and cannot - assert anything about the database. It
  // exists to make the SOURCE of the two values legible in the one place a
  // reader looks for behaviour, so that a green suite is never mistaken for
  // evidence that Favourites are modelled live. That claim needs a row.
  assert.equal(SOURCE_VIEW_TO_REGULARS_SOURCE.regulars, 'regular',
    "'regular' is the value live rows actually carry");
  assert.equal(SOURCE_VIEW_TO_REGULARS_SOURCE.favourites, 'favourite',
    "'favourite' is what this build WILL write; it describes no existing row");
});

test('a caller may override the mapping, because the forward contract may be wrong', function () {
  // The override is the escape hatch for exactly the case that bit us: a live
  // vocabulary nobody had checked. It must not be removed as redundant.
  const plan = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', regulars_source: 'regular'
  }));
  assert.equal(plan.regulars[0].regular.source, 'regular');
});

test('an explicit regulars_source overrides the source-view mapping', function () {
  const plan = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', regulars_source: 'favourites-live-spelling'
  }));
  assert.equal(plan.regulars[0].regular.source, 'favourites-live-spelling');
});

test('an unconfirmed ASDA Favourite click becomes a durable pending_action', function () {
  const plan = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', favourite_action_completed: false
  }));
  assert.equal(plan.pending_actions.length, 1);
  const action = plan.pending_actions[0];
  assert.equal(action.action_type, ADD_FAVOURITE_ACTION);
  assert.equal(action.action_key, 'widget azzera instant 100g');
  assert.equal(action.household_id, 1);
  assert.equal(action.shop_id, 41);
  assert.equal(action.payload.asda_product_id, '910000000001');
});

test('a CONFIRMED Favourite click leaves no pending action', function () {
  const plan = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', favourite_action_completed: true
  }));
  assert.deepEqual(plan.pending_actions, []);
});

test('an unstated Favourite outcome is never asserted either way', function () {
  // Absent means "nobody told us", which is not the same as "it failed".
  const plan = buildAnswerLearning(newProductAnswer({
    source_view: 'favourites', favourite_action_completed: undefined
  }));
  assert.deepEqual(plan.pending_actions, []);
});

test('favourite_action_completed must be a real boolean, never a truthy value', function () {
  assert.throws(function () {
    buildAnswerLearning(newProductAnswer({ favourite_action_completed: 'yes' }));
  }, /must be exactly true or false/);
});

// =====================================================================
// 4. Nothing is inferred - the refusals that keep the guard intact
// =====================================================================

test('applies_going_forward must be a strict boolean; absent is an error, not a default', function () {
  assert.throws(function () {
    const a = answer();
    delete a.applies_going_forward;
    buildAnswerLearning(a);
  }, /applies_going_forward must be exactly true or false/);

  assert.throws(function () {
    buildAnswerLearning(answer({ applies_going_forward: 'yes' }));
  }, /applies_going_forward must be exactly true or false/);
});

test('applies_going_forward true with no structured rule is refused', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({ applies_going_forward: true }));
  }, /`rule` is required/);
});

test('a rule payload with applies_going_forward false is refused rather than silently dropped', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({
      applies_going_forward: false,
      rule: { category: 'Coffee', rule_text: 'x', directive: 'info' }
    }));
  }, /no rule may be promoted/);
});

test('rule 10: a one-week-only decision is never promoted, and fails before any plan exists', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({
      applies_going_forward: true,
      one_week_only: true,
      rule: { category: 'Coffee', rule_text: 'x', directive: 'exclude', match_term: 'widget' }
    }));
  }, /never promoted into a standing rule \(rule 10\)/);
});

test('a one-week-only decision that does NOT promote is recorded, and marks itself', function () {
  const plan = buildAnswerLearning(answer({ one_week_only: true }));
  assert.equal(plan.decision.one_week_only, true);
  assert.equal(plan.decision.applies_going_forward, false);
});

test('asked_on is passed through untouched - this module has no clock', function () {
  const plan = buildAnswerLearning(answer({ asked_on: '2026-07-06' }));
  assert.equal(plan.decision.asked_on, '2026-07-06');
});

test('source_document_id is passed through and never fabricated', function () {
  const plan = buildAnswerLearning(answer({ source_document_id: null }));
  assert.equal(plan.decision.source_document_id, null);
});

test('no flag exists that could grant an actionable directive', function () {
  // The provenance gate lives in promoteDecision.applySourceVerdict, fed by a
  // database read. If a caller could pass "trusted"/"force"/"explicit" through
  // this module, the ambiguous inference would simply move upstream - which is
  // the exact failure promoteDecision's header refuses.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'buildAnswerLearning.js'), 'utf8');
  ['\\btrusted\\b', '\\bforce\\b', '\\bexplicit_directive\\b', '\\boverride\\b'].forEach(function (pattern) {
    assert.equal(new RegExp(pattern).test(src.replace(/\/\/.*$/gm, '')), false,
      'buildAnswerLearning must expose no "' + pattern + '" escape hatch outside comments');
  });
});

// =====================================================================
// 5. A skip establishes nothing
// =====================================================================

test('a skipped question writes its decision but learns no identity', function () {
  const plan = buildAnswerLearning(answer({
    status: 'skipped',
    answer_text: undefined,
    resolution: undefined
  }));
  assert.equal(plan.decision.answer, SKIP_ANSWER_TEXT);
  assert.equal(plan.decision.applies_going_forward, false);
  assert.deepEqual(plan.regulars, []);
  assert.deepEqual(plan.pending_actions, []);
  assert.equal(plan.suppression.prevents_repeat, false);
});

test('a skip carrying a resolution is refused - declining an item is not approving it', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({
      status: 'skipped',
      answer_text: undefined,
      resolution: { kind: 'known_product', regular_id: 108 }
    }));
  }, /A skipped question resolves no identity/);
});

test('a skip may never promote a standing rule', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({
      status: 'skipped',
      answer_text: undefined,
      resolution: undefined,
      applies_going_forward: true,
      rule: { category: 'Coffee', rule_text: 'x', directive: 'exclude', match_term: 'widget' }
    }));
  }, /transient by definition \(rule 10\)/);
});

test('a skip carrying answer words is refused rather than recorded', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({ status: 'skipped', answer_text: 'maybe next time' }));
  }, /carries no answer/);
});

// =====================================================================
// 6. A promoted rule is reported as an AUDIT record, never as the mechanism
// =====================================================================

test('a promoted rule is labelled standing_rule and does NOT by itself prevent a repeat', function () {
  const plan = buildAnswerLearning(answer({
    photographed_wording: 'sum thing else',
    applies_going_forward: true,
    resolution: { kind: 'none' },
    rule: {
      category: 'Coffee',
      rule_text: 'Widget means the Azzera jar only; add only if on offer',
      directive: 'exclude',
      match_term: 'widget'
    }
  }));
  const mechanisms = plan.suppression.terms.map(function (t) { return t.mechanism; });
  assert.deepEqual(mechanisms, ['standing_rule']);
  // The rule names a DIFFERENT term from the photographed wording, and a rule
  // is not a load-bearing suppression mechanism anyway.
  assert.equal(plan.suppression.prevents_repeat, false);
});

test('an answer can both promote a rule AND alias the wording - they are independent', function () {
  const plan = buildAnswerLearning(answer({
    applies_going_forward: true,
    resolution: { kind: 'known_product', regular_id: 108 },
    rule: {
      category: 'Coffee',
      rule_text: 'Widget means the Azzera jar only',
      directive: 'map',
      match_term: 'widget',
      matched_product: 'Widget Azzera Instant 100g'
    }
  }));
  assert.equal(plan.regulars.length, 1);
  assert.equal(plan.decision.rule.directive, 'map');
  const byMechanism = {};
  plan.suppression.terms.forEach(function (t) { byMechanism[t.mechanism] = t.term; });
  assert.equal(byMechanism.alias, 'bottle widget coffee');
  assert.equal(byMechanism.standing_rule, 'widget');
  assert.equal(plan.suppression.prevents_repeat, true);
});

// =====================================================================
// 7. Required fields
// =====================================================================

test('the question identity and the photographed wording are all required', function () {
  [
    ['shop_id', /shop_id is required/],
    ['question_key', /question_key is required/],
    ['question_text', /question_text is required/],
    ['photographed_wording', /photographed_wording is required/]
  ].forEach(function (pair) {
    assert.throws(function () {
      const a = answer();
      delete a[pair[0]];
      buildAnswerLearning(a);
    }, pair[1], 'missing ' + pair[0] + ' must be refused');
  });
});

test('a known_product resolution must name the regular it resolved to', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({ resolution: { kind: 'known_product' } }));
  }, /resolution.regular_id is required/);
});

test('a new_product resolution must carry the row to create', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({ resolution: { kind: 'new_product' } }));
  }, /resolution.product is required/);
});

test('an unknown resolution kind is refused rather than guessed at', function () {
  assert.throws(function () {
    buildAnswerLearning(answer({ resolution: { kind: 'probably_the_blue_one' } }));
  }, /is not one of/);
});

test('the plan never mutates the answer it was given', function () {
  const a = answer({ resolution: { kind: 'known_product', regular_id: 108, aliases: ['widget jar'] } });
  const before = JSON.stringify(a);
  buildAnswerLearning(a);
  assert.equal(JSON.stringify(a), before);
});

test('identical input produces an identical plan (pure and deterministic)', function () {
  assert.deepEqual(buildAnswerLearning(newProductAnswer()), buildAnswerLearning(newProductAnswer()));
});
