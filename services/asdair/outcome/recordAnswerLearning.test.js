// =====================================================================
// BUILD-015 AsdAIr - the learning loop: recordAnswerLearning.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY. ZERO real household data. This file runs in CI on
// the PUBLIC repo.
//
// NO DATABASE. The runtime join's ordering, its receipt, its refusals and its
// loud-failure contract are proven against a FAKE pg client that records every
// statement it is given. The real-Postgres proof that this SQL is valid
// against the committed migrations does NOT exist yet and is named in the
// handback as NOT VERIFIED.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { recordAnswerLearning, _internal } = require('./recordAnswerLearning');

// ---------------------------------------------------------------------
// A fake pg client covering every statement the three writers issue.
// ---------------------------------------------------------------------
function fakeClient(options) {
  const opts = options || {};
  const calls = [];
  let nextId = opts.firstId || 500;

  return {
    calls: calls,
    query: async function (sql, params) {
      const text = String(sql);
      calls.push({ sql: text, params: params || [] });

      if (opts.failOn && opts.failOn.test(text)) {
        throw new Error('synthetic failure on: ' + text.slice(0, 48));
      }

      // promoteDecision's provenance lookup.
      if (/FROM asdair\.source_documents/i.test(text)) {
        return { rows: opts.docType === null ? [] : [{ doc_type: opts.docType || 'decisions_log' }] };
      }
      // updateRegulars' dedupe / identity / read queries.
      if (/FROM asdair\.regulars/i.test(text)) {
        return { rows: opts.existingRegular ? [opts.existingRegular] : [] };
      }
      if (/^UPDATE asdair\.regulars/i.test(text)) {
        return { rowCount: 1, rows: [{ id: params[params.length - (/aka = \$/.test(text) ? 2 : 1)] }] };
      }
      if (/RETURNING id/i.test(text)) {
        if (opts.pendingConflict && /pending_action/i.test(text)) return { rows: [] };
        return { rows: [{ id: nextId++ }] };
      }
      return { rows: [] };
    }
  };
}

function sqlOf(client) {
  return client.calls.map(function (c) { return c.sql; });
}

// The module's EXECUTABLE text, with line and block comments removed. Source
// assertions below are claims about what the code can DO; a header that
// explains a boundary must never fail a rule that guards it.
function sourceCodeOf(file) {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, file), 'utf8');
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const KNOWN_REGULAR = {
  id: 108,
  name: 'Widget Azzera Instant 100g',
  aka: ['azzera jar'],
  active: true
};

function answer(overrides) {
  return Object.assign({
    shop_id: 41,
    question_key: 'q1a2b3c4d',
    question_text: 'Which product is "bottle Azzera coffee"?',
    asked_on: '2026-08-03',
    status: 'answered',
    answer_text: 'The Widget Azzera Instant 100g',
    answer_source: 'button',
    household_id: 1,
    photographed_wording: 'bottle Azzera coffee',
    applies_going_forward: false,
    source_document_id: 3,
    resolution: { kind: 'known_product', regular_id: 108 }
  }, overrides || {});
}

// =====================================================================
// 1. The three writes, in the right order
// =====================================================================

test('the decision is written BEFORE the catalogue changes', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR });
  await recordAnswerLearning(answer(), { client: client });

  const statements = sqlOf(client);
  const logInsert = statements.findIndex(function (s) { return /INSERT INTO asdair\.rule_qa_log/i.test(s); });
  const akaUpdate = statements.findIndex(function (s) { return /UPDATE asdair\.regulars/i.test(s); });

  assert.ok(logInsert !== -1, 'a rule_qa_log row must always be written');
  assert.ok(akaUpdate !== -1, 'the alias must be written');
  assert.ok(logInsert < akaUpdate,
    'a mutated catalogue with no record of why is worse than a recorded answer that must be re-applied');
});

test('the receipt names the decision, the catalogue change and the suppression', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR });
  const receipt = await recordAnswerLearning(answer(), { client: client });

  assert.equal(receipt.shop_id, 41);
  assert.equal(receipt.question_key, 'q1a2b3c4d');
  assert.ok(receipt.log_id !== null, 'the rule_qa_log id must be returned');
  assert.equal(receipt.rule_id, null, 'nothing was promoted, so there is no rule id');
  assert.equal(receipt.regulars.length, 1);
  assert.equal(receipt.regulars[0].op, 'enrichRegular');
  assert.equal(receipt.suppression.prevents_repeat, true);
  assert.equal(receipt.suppression.photographed_term, 'bottle azzera coffee');
});

test('the photographed wording reaches the database as an alias parameter', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR });
  await recordAnswerLearning(answer(), { client: client });

  const update = client.calls.filter(function (c) { return /UPDATE asdair\.regulars/i.test(c.sql); })[0];
  assert.ok(update, 'an UPDATE must have been issued');
  const akaParam = update.params.filter(function (p) { return Array.isArray(p); })[0];
  assert.ok(akaParam.indexOf('bottle azzera coffee') !== -1,
    'the photographed wording must be in the alias array actually sent to Postgres');
  assert.ok(akaParam.indexOf('azzera jar') !== -1, 'the prior alias must survive the merge');
});

// =====================================================================
// 2. The provenance guard is used, not bypassed
// =====================================================================

test('an authoritative source document grants the requested actionable directive', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR, docType: 'decisions_log' });
  const receipt = await recordAnswerLearning(answer({
    applies_going_forward: true,
    rule: {
      category: 'Hot Drinks',
      rule_text: 'Widget means the Azzera jar only',
      directive: 'map',
      match_term: 'widget',
      matched_product: 'Widget Azzera Instant 100g'
    }
  }), { client: client });

  assert.ok(receipt.rule_id !== null, 'a rule must have been created');
  const ruleInsert = client.calls.filter(function (c) { return /INSERT INTO asdair\.rules/i.test(c.sql); })[0];
  assert.ok(ruleInsert);
  assert.ok(ruleInsert.params.indexOf('map') !== -1,
    'a decisions_log provenance must yield the requested actionable directive');
});

test('a NON-authoritative source document downgrades the rule to inert info', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR, docType: 'order_history' });
  await recordAnswerLearning(answer({
    applies_going_forward: true,
    rule: {
      category: 'Hot Drinks',
      rule_text: 'Widget means the Azzera jar only',
      directive: 'map',
      match_term: 'widget',
      matched_product: 'Widget Azzera Instant 100g'
    }
  }), { client: client });

  const ruleInsert = client.calls.filter(function (c) { return /INSERT INTO asdair\.rules/i.test(c.sql); })[0];
  assert.ok(ruleInsert.params.indexOf('info') !== -1, 'an unproven promotion must be inert');
  assert.equal(ruleInsert.params.indexOf('map'), -1, 'the actionable directive must NOT have been granted');
});

test('this module offers no route to grant a directive the database did not', async function () {
  // CODE only: the header legitimately DISCUSSES the gate, and a rule that
  // fired on prose would just teach the next author to stop explaining things.
  const code = sourceCodeOf('recordAnswerLearning.js');
  assert.equal(/applySourceVerdict/.test(code), false,
    'the gate is promoteDecision\'s alone; touching it from here would move the trust boundary');
  assert.equal(/AUTHORITATIVE_DOC_TYPES/.test(code), false);
});

// =====================================================================
// 3. Failures are LOUD - the difference from deps.js realRecordLearning
// =====================================================================

test('a failed catalogue write THROWS and names the step, carrying what did land', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR, failOn: /UPDATE asdair\.regulars/i });

  await assert.rejects(
    recordAnswerLearning(answer(), { client: client }),
    function (err) {
      assert.match(err.message, /step "updateRegulars\[0\] \(enrichRegular\)" failed/);
      assert.ok(err.receipt, 'the receipt must survive the throw');
      assert.ok(err.receipt.log_id !== null, 'the decision that DID land must be reported');
      assert.deepEqual(err.receipt.regulars, []);
      return true;
    }
  );
});

test('a failed decision write throws before the catalogue is touched at all', async function () {
  const client = fakeClient({ existingRegular: KNOWN_REGULAR, failOn: /INSERT INTO asdair\.rule_qa_log/i });

  await assert.rejects(
    recordAnswerLearning(answer(), { client: client }),
    function (err) {
      assert.match(err.message, /step "promoteDecision" failed/);
      return true;
    }
  );
  assert.equal(sqlOf(client).some(function (s) { return /UPDATE asdair\.regulars/i.test(s); }), false,
    'no catalogue change may follow a failed decision');
});

test('learning failures are never swallowed', async function () {
  // pipeline/deps.js realRecordLearning deliberately swallows; this path
  // deliberately does not. A swallowed failure here is indistinguishable from
  // the defect being fixed, and would surface next Sunday as a re-ask.
  const code = sourceCodeOf('recordAnswerLearning.js');
  assert.equal(/catch\s*\(\s*ignore\s*\)/.test(code), false, 'no error may be ignored on this path');
  assert.equal(/errors\.push/.test(code), false, 'failures throw; they are not collected and continued past');
});

// =====================================================================
// 4. A pure refusal never opens a connection
// =====================================================================

test('an invalid answer is refused before any statement is issued', async function () {
  const client = fakeClient({});
  await assert.rejects(
    recordAnswerLearning(answer({ applies_going_forward: 'yes' }), { client: client }),
    /applies_going_forward must be exactly true or false/
  );
  assert.deepEqual(client.calls, [], 'nothing may be sent to the database for a malformed answer');
});

test('a skipped question writes its decision and touches no catalogue row', async function () {
  const client = fakeClient({});
  const receipt = await recordAnswerLearning(answer({
    status: 'skipped', answer_text: undefined, resolution: undefined
  }), { client: client });

  assert.ok(receipt.log_id !== null);
  assert.deepEqual(receipt.regulars, []);
  assert.equal(sqlOf(client).some(function (s) { return /asdair\.regulars/i.test(s); }), false);
});

// =====================================================================
// 5. The un-clicked ASDA Favourite is never forgotten
// =====================================================================

function newFavouriteAnswer() {
  return answer({
    photographed_wording: 'them choc yazoos',
    answer_text: 'Widget Chocolate Milk Drink 400ml',
    resolution: {
      kind: 'new_product',
      product: {
        name: 'Widget Chocolate Milk Drink 400ml',
        asda_product_id: '910000000003',
        source_view: 'favourites',
        favourite_action_completed: false
      }
    }
  });
}

test('an unconfirmed Favourite click is persisted as a pending_action', async function () {
  const client = fakeClient({});
  const receipt = await recordAnswerLearning(newFavouriteAnswer(), { client: client });

  assert.equal(receipt.pending_actions.length, 1);
  assert.equal(receipt.pending_actions[0].created, true);
  assert.equal(receipt.pending_actions[0].action_type, 'add_favourite');

  const insert = client.calls.filter(function (c) { return /asdair\.pending_action/i.test(c.sql); })[0];
  assert.ok(insert, 'a pending_action INSERT must have been issued');
  assert.match(insert.sql, /ON CONFLICT/i);
  assert.equal(insert.params[0], 1, 'household_id');
  assert.equal(insert.params[1], 41, 'shop_id');
  assert.equal(insert.params[2], 'add_favourite');
});

test('re-recording an outstanding Favourite action is a no-op, not a duplicate', async function () {
  const client = fakeClient({ pendingConflict: true });
  const receipt = await recordAnswerLearning(newFavouriteAnswer(), { client: client });
  assert.equal(receipt.pending_actions[0].created, false);
  assert.equal(receipt.pending_actions[0].id, null);
});

test('the new regular is created and its id is reported back on the suppression record', async function () {
  const client = fakeClient({});
  const receipt = await recordAnswerLearning(newFavouriteAnswer(), { client: client });

  assert.equal(receipt.regulars.length, 1);
  assert.equal(receipt.regulars[0].op, 'upsertRegular');
  const newNames = receipt.suppression.terms.filter(function (t) { return t.mechanism === 'new_regular'; });
  assert.ok(newNames.length > 0);
  newNames.forEach(function (t) {
    assert.ok(t.regular_id !== null, 'the created regular id must be reported back');
  });
});

// =====================================================================
// 6. Secrets and SQL shape
// =====================================================================

test('no connection string is ever hardcoded here', function () {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'recordAnswerLearning.js'), 'utf8');
  // The literal-URL ban applies to the WHOLE file, comments included: a
  // connection string pasted into a header is exactly as leaked as one in code.
  assert.equal(/postgres(ql)?:\/\//i.test(src), false, 'no connection string may appear in the source');
  // The env-var ban applies to CODE: this module reads no environment variable
  // at all, delegating entirely to the two writers that own their pools.
  const code = sourceCodeOf('recordAnswerLearning.js');
  assert.equal(/process\.env/.test(code), false,
    'this module must read no environment variable of its own');
});

test('the pending_action insert is fully parameterised', function () {
  const sql = _internal.PENDING_ACTION_SQL;
  assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4, \$5::jsonb, \$6\)/);
  assert.equal(/'\s*\+\s*/.test(sql), false, 'no value may be concatenated into the SQL text');
});

test('this module issues no DELETE, TRUNCATE or DROP', function () {
  const code = sourceCodeOf('recordAnswerLearning.js');
  ['DELETE', 'TRUNCATE', 'DROP'].forEach(function (word) {
    assert.equal(new RegExp('\\b' + word + '\\b').test(code), false,
      word + ' must never appear in a learning write path');
  });
});
