// =====================================================================
// BUILD-015 AsdAIr - THE ACCEPTANCE PROPERTY: answerSurvivesTheWeek.test.js
//
// Runs under: node --test
//
//   >> AN ANSWER GIVEN THIS WEEK MUST PREVENT THE SAME QUESTION NEXT WEEK. <<
//
// That is the whole point of blocker 7 and it is proven here, across TWO
// simulated shops with DIFFERENT shop_ids - because a different shop_id is
// precisely the failure mode. asdair.shop_question is UNIQUE on
// (shop_id, question_key), so next week's shop makes every question a fresh
// question: the database's idempotency is per-shop and cannot help across
// weeks. Something in the CATALOGUE has to change, or Warwick answers again.
//
// ---------------------------------------------------------------------
// WHAT IS REAL HERE AND WHAT IS SIMULATED - read this before trusting it
// ---------------------------------------------------------------------
// REAL, imported from the production sources and not reimplemented:
//   * skill/planner.js  planBasket()  - the actual matcher that decides
//                                       whether a line is 'needs_decision'
//   * skill/planner.js  normaliseTerm - the actual read-path normalisation
//   * pipeline/keys.js  questionKeyFor - the actual question key
//   * outcome/buildAnswerLearning.js  - the module under test
//   * outcome/buildRegularsUpdate.js  applyAkaMerge / buildRegularsUpdate -
//                                       the actual alias merge, so the aliases
//                                       this test stores are computed by the
//                                       same code the writer uses
//
// SIMULATED, and named honestly:
//   * asdair.shop_question, as an in-memory store enforcing the SAME
//     (shop_id, question_key) unique index the migration declares.
//   * the catalogue, as an array of regulars rows.
//   * runPipeline.stepPlan()'s rule "every plan line with status
//     'needs_decision' becomes a question". That rule is transcribed from
//     runPipeline.js:324-384, which lives outside this Work Order's file
//     surface and is therefore NOT executed here.
//
// So this proves the LEARNING WRITE-BACK closes the loop against the real
// matcher. It does NOT prove the live pipeline calls it - nothing in this
// file surface can, because the caller lives in pipeline/**.
//
// SYNTHETIC FIXTURES ONLY. ZERO real household data. NO DATABASE.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const planner = require('../skill/planner');
const { buildAnswerLearning } = require('./buildAnswerLearning');
const {
  buildRegularsUpdate,
  applyAkaMerge,
  normaliseAlias
} = require('./buildRegularsUpdate');

const HOUSEHOLD = 1;
const SHOP_THIS_WEEK = 1001;
const SHOP_NEXT_WEEK = 1002;      // a DIFFERENT shop_id. This is the defect.

// The wording on the photograph. Nothing in the catalogue answers to it yet.
const PHOTOGRAPHED = 'bottle Azzera coffee';

// ---------------------------------------------------------------------
// The catalogue this household starts the week with. The Azzera jar EXISTS
// as a regular; it simply does not answer to the words mum wrote.
// ---------------------------------------------------------------------
function startingCatalogue() {
  return [
    {
      id: 108,
      household_id: HOUSEHOLD,
      name: 'Widget Azzera Instant 100g',
      brand: 'Widget',
      asda_product_id: '910000000001',
      category: 'Hot Drinks',
      active: true,
      aka: ['azzera jar'],
      substitutes_allowed: false
    },
    {
      id: 109,
      household_id: HOUSEHOLD,
      name: 'Widget Semi Skimmed Milk 4pt',
      brand: 'Widget',
      asda_product_id: '910000000002',
      category: 'Dairy',
      active: true,
      aka: ['4pt milk'],
      substitutes_allowed: false
    }
  ];
}

// ---------------------------------------------------------------------
// asdair.shop_question, simulated with its REAL uniqueness rule.
// db/006_shop_control_surface.sql:107
//   create unique index shop_question_key_uniq on asdair.shop_question
//     (shop_id, question_key)
// ---------------------------------------------------------------------
function questionStore() {
  const rows = [];
  return {
    rows: rows,
    // Mirrors deps.shopStore.openQuestion: idempotent WITHIN one shop.
    openQuestion: function (q) {
      const exists = rows.some(function (r) {
        return r.shop_id === q.shop_id && r.question_key === q.question_key;
      });
      if (exists) return { opened: false };
      rows.push(Object.assign({ status: 'open' }, q));
      return { opened: true };
    },
    forShop: function (shopId) {
      return rows.filter(function (r) { return r.shop_id === shopId; });
    }
  };
}

// ---------------------------------------------------------------------
// One shop: run the REAL planner, then open a question for every line the
// REAL planner held. This is runPipeline.stepPlan()'s rule, transcribed.
// ---------------------------------------------------------------------
async function runShop(shopId, listItems, catalogue, rules, store) {
  const { questionKeyFor } = await import('../pipeline/keys.js');

  const plan = planner.planBasket({
    listItems: listItems,
    rules: rules || [],
    products: [],
    regulars: catalogue,
    budget: { household_id: HOUSEHOLD, min_normal: 120, max_normal: 150 },
    household: HOUSEHOLD
  });

  const held = plan.items.filter(function (line) { return line.status === 'needs_decision'; });
  held.forEach(function (line) {
    store.openQuestion({
      shop_id: shopId,
      question_key: questionKeyFor(line.item_name),
      question_text: 'Which product is "' + line.item_name + '"?'
    });
  });

  return { plan: plan, held: held };
}

// ---------------------------------------------------------------------
// Apply a buildAnswerLearning plan to the in-memory catalogue, using the REAL
// alias merge rather than a hand-rolled one. This is what updateRegulars.js
// does against Postgres: read the row, merge against what was read, write.
// ---------------------------------------------------------------------
function applyLearningToCatalogue(learning, catalogue) {
  learning.regulars.forEach(function (operation) {
    const built = buildRegularsUpdate(operation);

    if (built.op === 'upsertRegular') {
      // updateRegulars' dedupe guard: adopt an existing row with the same
      // NORMALISED name rather than creating a near-twin.
      const existing = catalogue.filter(function (r) {
        return r.household_id === built.row.household_id &&
          normaliseAlias(r.name) === built.normalised_name;
      });
      if (existing.length > 0) return;
      catalogue.push(Object.assign({}, built.row, {
        id: 900 + catalogue.length,
        aka: built.row.aka.slice()
      }));
      return;
    }

    const row = catalogue.filter(function (r) { return r.id === built.id; })[0];
    assert.ok(row, 'enrichRegular targeted a regular that is not in the catalogue');
    const merged = applyAkaMerge(built, row.aka, row.name);
    row.aka = merged.set.aka;
  });
}

// The answer Warwick gives: "that is the Azzera jar we already have".
function warwicksAnswer(overrides) {
  return Object.assign({
    shop_id: SHOP_THIS_WEEK,
    question_key: 'placeholder-filled-in-by-the-test',
    question_text: 'Which product is "' + PHOTOGRAPHED + '"?',
    asked_on: '2026-08-03',
    status: 'answered',
    answer_text: 'That is the Widget Azzera Instant 100g we always get',
    answer_source: 'button',
    household_id: HOUSEHOLD,
    photographed_wording: PHOTOGRAPHED,
    applies_going_forward: false,
    source_document_id: 3,
    resolution: { kind: 'known_product', regular_id: 108 }
  }, overrides || {});
}

// =====================================================================
// 0. The coupling this whole mechanism rests on
// =====================================================================

test('the alias normalisation is IDENTICAL to the planner read path it must match', function () {
  // Pinned against the PLANNER'S OWN function, imported - not against a copy
  // of the rule written down here. If either drifts, the alias silently stops
  // matching and blocker 7 re-opens with every test still green.
  const cases = [
    'bottle Azzera coffee',
    '  Bottle   AZZERA   Coffee  ',
    'YAZOO choc',
    'Gloucester',
    '',
    '   ',
    'a\tb\nc'
  ];
  cases.forEach(function (input) {
    assert.equal(
      normaliseAlias(input),
      planner._internal.normaliseTerm(input),
      'normaliseAlias and planner.normaliseTerm disagree on ' + JSON.stringify(input)
    );
  });
});

// =====================================================================
// 1. THE DEFECT, reproduced: without the write-back the question returns
// =====================================================================

test('MUTATION CONTROL: with NO write-back, next week asks the identical question again', async function () {
  const { questionKeyFor } = await import('../pipeline/keys.js');
  const catalogue = startingCatalogue();
  const store = questionStore();
  const list = [{ item_name: PHOTOGRAPHED, requested_qty: 1 }];

  const weekOne = await runShop(SHOP_THIS_WEEK, list, catalogue, [], store);
  assert.equal(weekOne.held.length, 1, 'week one must genuinely hold the line');
  assert.equal(store.forShop(SHOP_THIS_WEEK).length, 1);

  // Warwick answers... and NOTHING is written back. This is 2026-08-03.
  const weekTwo = await runShop(SHOP_NEXT_WEEK, list, catalogue, [], store);

  assert.equal(weekTwo.held.length, 1, 'the same line is held again next week');
  assert.equal(store.forShop(SHOP_NEXT_WEEK).length, 1, 'a NEW question row is opened next week');

  // And the two questions are the SAME question: identical key, different shop.
  const key = questionKeyFor(PHOTOGRAPHED);
  assert.equal(store.forShop(SHOP_THIS_WEEK)[0].question_key, key);
  assert.equal(store.forShop(SHOP_NEXT_WEEK)[0].question_key, key);
  assert.equal(store.rows.length, 2,
    'the (shop_id, question_key) index cannot dedupe across shops - that IS blocker 7');
});

// =====================================================================
// 2. THE PROPERTY: with the write-back, next week does not ask
// =====================================================================

test('ACCEPTANCE: an answer given this week prevents the same question next week', async function () {
  const { questionKeyFor } = await import('../pipeline/keys.js');
  const catalogue = startingCatalogue();
  const store = questionStore();
  const list = [{ item_name: PHOTOGRAPHED, requested_qty: 1 }];

  // ---- week one: the question is genuinely raised ------------------------
  const weekOne = await runShop(SHOP_THIS_WEEK, list, catalogue, [], store);
  assert.equal(weekOne.held.length, 1);
  const key = questionKeyFor(PHOTOGRAPHED);
  assert.equal(store.forShop(SHOP_THIS_WEEK)[0].question_key, key);

  // ---- Warwick answers, and THE LOOP CLOSES ------------------------------
  const learning = buildAnswerLearning(warwicksAnswer({ question_key: key }));
  assert.equal(learning.suppression.prevents_repeat, true);
  applyLearningToCatalogue(learning, catalogue);

  // ---- week two: a DIFFERENT shop_id, the same photograph wording ---------
  const weekTwo = await runShop(SHOP_NEXT_WEEK, list, catalogue, [], store);

  assert.deepEqual(weekTwo.held, [], 'next week must hold nothing for this line');
  assert.deepEqual(store.forShop(SHOP_NEXT_WEEK), [], 'next week must open NO question');
  assert.equal(store.rows.length, 1, 'exactly one question was ever asked about this item');

  // ...and it resolved to the RIGHT product, not merely to something.
  const line = weekTwo.plan.items[0];
  assert.equal(line.status, 'add');
  assert.equal(line.matched_product, 'Widget Azzera Instant 100g');
  assert.equal(line.planned_qty, 1);
  assert.ok(line.flags.indexOf('matched from regulars') !== -1);
});

test('ACCEPTANCE: a genuinely NEW product approved this week is known next week', async function () {
  const catalogue = startingCatalogue();
  const store = questionStore();
  const wording = 'them choc yazoos';
  const list = [{ item_name: wording, requested_qty: 2 }];

  const weekOne = await runShop(SHOP_THIS_WEEK, list, catalogue, [], store);
  assert.equal(weekOne.held.length, 1, 'a genuinely new product must be asked about once');

  const learning = buildAnswerLearning({
    shop_id: SHOP_THIS_WEEK,
    question_key: 'k',
    question_text: 'Which product is "' + wording + '"?',
    asked_on: '2026-08-03',
    status: 'answered',
    answer_text: 'Widget Chocolate Milk Drink 400ml, and favourite it',
    answer_source: 'typed',
    household_id: HOUSEHOLD,
    photographed_wording: wording,
    applies_going_forward: false,
    source_document_id: 3,
    resolution: {
      kind: 'new_product',
      approved_search_term: 'widget chocolate milk 400ml',
      product: {
        name: 'Widget Chocolate Milk Drink 400ml',
        brand: 'Widget',
        asda_product_id: '910000000003',
        asda_url: 'https://groceries.asda.com/product/910000000003',
        category: 'Dairy Drinks',
        high_level_category: 'Chilled',
        typical_qty: 2,
        source_view: 'favourites',
        favourite_action_completed: false
      }
    }
  });

  // The un-clicked Favourite is NOT lost - it becomes a durable pending action.
  assert.equal(learning.pending_actions.length, 1);
  assert.equal(learning.pending_actions[0].action_type, 'add_favourite');

  applyLearningToCatalogue(learning, catalogue);

  const weekTwo = await runShop(SHOP_NEXT_WEEK, list, catalogue, [], store);
  assert.deepEqual(weekTwo.held, [], 'the newly learned product must not be asked about again');
  assert.deepEqual(store.forShop(SHOP_NEXT_WEEK), []);
  assert.equal(weekTwo.plan.items[0].matched_product, 'Widget Chocolate Milk Drink 400ml');
  assert.equal(weekTwo.plan.items[0].planned_qty, 2);
});

test('ACCEPTANCE: the approved SEARCH wording also resolves next week', async function () {
  // Warwick is asked about mum's wording but approves a search term. Either
  // wording may appear on next week's photograph, so both must resolve.
  const catalogue = startingCatalogue();
  const store = questionStore();

  const learning = buildAnswerLearning(warwicksAnswer({
    question_key: 'k',
    resolution: {
      kind: 'known_product',
      regular_id: 108,
      approved_search_term: 'azzera instant coffee'
    }
  }));
  applyLearningToCatalogue(learning, catalogue);

  const byPhotograph = await runShop(SHOP_NEXT_WEEK,
    [{ item_name: PHOTOGRAPHED, requested_qty: 1 }], catalogue, [], store);
  const bySearchTerm = await runShop(SHOP_NEXT_WEEK + 1,
    [{ item_name: 'Azzera Instant Coffee', requested_qty: 1 }], catalogue, [], store);

  assert.deepEqual(byPhotograph.held, []);
  assert.deepEqual(bySearchTerm.held, []);
  assert.equal(bySearchTerm.plan.items[0].matched_product, 'Widget Azzera Instant 100g');
});

// =====================================================================
// 3. What the write-back must NOT do
// =====================================================================

test('a SKIPPED question is still asked next week - and that is correct', async function () {
  // "Leave it this week" is transient (rule 10). Suppressing it next week
  // would silently drop an item from every future shop.
  const catalogue = startingCatalogue();
  const store = questionStore();
  const list = [{ item_name: PHOTOGRAPHED, requested_qty: 1 }];

  await runShop(SHOP_THIS_WEEK, list, catalogue, [], store);

  const learning = buildAnswerLearning(warwicksAnswer({
    question_key: 'k',
    status: 'skipped',
    answer_text: undefined,
    resolution: undefined
  }));
  assert.deepEqual(learning.regulars, []);
  applyLearningToCatalogue(learning, catalogue);

  const weekTwo = await runShop(SHOP_NEXT_WEEK, list, catalogue, [], store);
  assert.equal(weekTwo.held.length, 1, 'a declined item must still be asked about next week');
  assert.equal(store.forShop(SHOP_NEXT_WEEK).length, 1);
});

test('the write-back never retires, renames or re-homes an existing regular', function () {
  const catalogue = startingCatalogue();
  const before = JSON.parse(JSON.stringify(catalogue));

  const learning = buildAnswerLearning(warwicksAnswer({ question_key: 'k' }));
  applyLearningToCatalogue(learning, catalogue);

  const row = catalogue.filter(function (r) { return r.id === 108; })[0];
  const wasRow = before.filter(function (r) { return r.id === 108; })[0];

  assert.equal(row.name, wasRow.name, 'name must be untouched');
  assert.equal(row.active, wasRow.active, 'active must be untouched');
  assert.equal(row.household_id, wasRow.household_id, 'household_id must be untouched');
  assert.equal(row.asda_product_id, wasRow.asda_product_id);
  assert.equal(catalogue.length, before.length, 'no regular was added or removed');

  // Aliases only ever GROW.
  wasRow.aka.forEach(function (alias) {
    assert.ok(row.aka.indexOf(alias) !== -1, 'prior alias "' + alias + '" must survive');
  });
  assert.ok(row.aka.length > wasRow.aka.length);
});

test('learning the same answer twice is safe and creates no duplicate regular', async function () {
  // Two active regulars answering one term is what planner.js reports as
  // AMBIGUOUS -> needs_decision, i.e. a duplicate would CAUSE the question
  // this whole mechanism exists to prevent.
  const catalogue = startingCatalogue();
  const store = questionStore();
  const wording = 'them choc yazoos';

  const learning = buildAnswerLearning({
    shop_id: SHOP_THIS_WEEK,
    question_key: 'k',
    question_text: 'q',
    asked_on: '2026-08-03',
    status: 'answered',
    answer_text: 'Widget Chocolate Milk Drink 400ml',
    household_id: HOUSEHOLD,
    photographed_wording: wording,
    applies_going_forward: false,
    source_document_id: 3,
    resolution: {
      kind: 'new_product',
      product: { name: 'Widget Chocolate Milk Drink 400ml', source_view: 'regulars' }
    }
  });

  applyLearningToCatalogue(learning, catalogue);
  const afterFirst = catalogue.length;
  applyLearningToCatalogue(learning, catalogue);
  assert.equal(catalogue.length, afterFirst, 're-running the write-back must adopt, never duplicate');

  const weekTwo = await runShop(SHOP_NEXT_WEEK,
    [{ item_name: wording, requested_qty: 1 }], catalogue, [], store);
  assert.deepEqual(weekTwo.held, [], 'a duplicated regular would make this ambiguous -> needs_decision');
});
