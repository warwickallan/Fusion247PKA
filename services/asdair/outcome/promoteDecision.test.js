// =====================================================================
// IDEA-012 AsdAIr - outcome recorder: promoteDecision.test.js
//
// Runs under: node --test
//
// SYNTHETIC FIXTURES ONLY (invented questions, answers and product names).
// ZERO real household data or real decisions. This file runs in CI on the
// PUBLIC repo.
//
// NO DATABASE. The promotion rules are pure (buildPromotion) and the
// transaction shape is proven against a FAKE client. The real-Postgres proof
// (the back-link actually lands, the CHECK constraints bite) lives in the
// DB-gated test/outcome.dbtest.js.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { promoteDecision, buildPromotion, _internal } = require('./promoteDecision');

// A fake pg client: records statements, hands back synthetic ids. The log
// insert and the rule insert get DIFFERENT ids so the back-link can be
// proven to carry the RULE id, not just "an" id.
function fakeClient(options) {
  const opts = options || {};
  const calls = [];
  return {
    calls: calls,
    query: async function (sql, params) {
      const text = String(sql);
      calls.push({ sql: text, params: params || [] });
      if (opts.failOn && opts.failOn.test(text)) {
        throw new Error('synthetic failure on: ' + text.slice(0, 40));
      }
      if (/INSERT INTO asdair\.rule_qa_log/i.test(text)) return { rows: [{ id: opts.logId || 501 }] };
      if (/INSERT INTO asdair\.rules/i.test(text)) return { rows: [{ id: opts.ruleId || 902 }] };
      return { rows: [] };
    }
  };
}

function sqlOf(client) {
  return client.calls.map(function (c) { return c.sql; });
}

// A standing decision: "never buy Widget A again" -> a real, targeted rule.
function standingDecision(overrides) {
  const base = {
    asked_on: '2026-07-27',
    question: 'Should we keep buying Widget A?',
    answer: 'No - stop buying Widget A from now on.',
    applies_going_forward: true,
    household_id: 1,
    rule: {
      category: 'household',
      rule_text: 'Do not buy Widget A.',
      scope: 'product',
      directive: 'exclude',
      match_term: 'Widget A',
      reason: 'household decided it is not wanted'
    }
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

// ---------------------------------------------------------------------
// PURE promotion rules
// ---------------------------------------------------------------------

test('applies_going_forward false: the answer is logged and NOTHING is promoted', function () {
  const built = buildPromotion({
    asked_on: '2026-07-27',
    question: 'Skip Widget A this week?',
    answer: 'Yes, just this week.',
    applies_going_forward: false,
    household_id: 1
  });
  assert.equal(built.rule, null);
  assert.deepEqual(built.log, {
    asked_on: '2026-07-27',
    question: 'Skip Widget A this week?',
    answer: 'Yes, just this week.',
    applies_going_forward: false,
    household_id: 1
  });
});

test('applies_going_forward true: a STRUCTURED rule is built the planner can actually act on', function () {
  const built = buildPromotion(standingDecision());
  assert.deepEqual(built.rule, {
    category: 'household',
    rule_text: 'Do not buy Widget A.',
    scope: 'product',
    directive: 'exclude',
    match_term: 'Widget A',
    match_category: null,
    matched_product: null,
    reason: 'household decided it is not wanted',
    note: null,
    active: true,                 // a promoted rule is live by definition
    household_id: 1               // inherits the decision's household
  });
  assert.deepEqual(Object.keys(built.rule).slice().sort(), _internal.RULE_COLUMNS.slice().sort());
});

test('rule 10: a one-week-only decision is NEVER promoted', function () {
  assert.throws(function () {
    buildPromotion(standingDecision({ one_week_only: true }));
  }, /one-week-only/);

  // Scope 'one_time' is the same transient thing wearing a rule's clothes.
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'household', rule_text: 'Skip Widget A', scope: 'one_time', directive: 'exclude', match_term: 'Widget A' }
    }));
  }, /one_time/);

  // Recording the SAME transient decision without promoting it is fine.
  const ok = buildPromotion({
    asked_on: '2026-07-27',
    question: 'Skip Widget A this week?',
    answer: 'Yes, this week only.',
    applies_going_forward: false,
    one_week_only: true,
    household_id: 1
  });
  assert.equal(ok.rule, null);
});

test('a target-less actionable directive is refused (it would be a silent no-op rule)', function () {
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'household', rule_text: 'Do not buy it', scope: 'global', directive: 'exclude' }
    }));
  }, /must name a match_term or a match_category/);

  // Empty / whitespace-only is NOT a target, exactly like the DB CHECK.
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'household', rule_text: 'Do not buy it', scope: 'global', directive: 'exclude', match_term: '   ' }
    }));
  }, /must name a match_term or a match_category/);

  // A purely informational rule may be target-less.
  const info = buildPromotion(standingDecision({
    rule: { category: 'general', rule_text: 'Deliveries are Tuesdays.', scope: 'global', directive: 'info' }
  }));
  assert.equal(info.rule.directive, 'info');
  assert.equal(info.rule.match_term, null);
});

test("a 'map' directive with nothing to map to is refused", function () {
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'mapping', rule_text: 'Widget A maps to something', scope: 'product', directive: 'map', match_term: 'Widget A' }
    }));
  }, /must carry a matched_product/);

  const ok = buildPromotion(standingDecision({
    rule: {
      category: 'mapping', rule_text: 'Widget A maps to Widget A Deluxe', scope: 'product',
      directive: 'map', match_term: 'Widget A', matched_product: 'Widget A Deluxe'
    }
  }));
  assert.equal(ok.rule.matched_product, 'Widget A Deluxe');
});

test('an out-of-vocabulary directive or scope is refused', function () {
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'x', rule_text: 'y', scope: 'product', directive: 'ban', match_term: 'Widget A' }
    }));
  }, /directive "ban" is not one of/);
  assert.throws(function () {
    buildPromotion(standingDecision({
      rule: { category: 'x', rule_text: 'y', scope: 'weekly', directive: 'exclude', match_term: 'Widget A' }
    }));
  }, /scope "weekly" is not one of/);
});

test('applies_going_forward must be an explicit boolean, and the log fields are required', function () {
  ['yes', 1, null, undefined, ''].forEach(function (bad) {
    assert.throws(function () {
      buildPromotion(standingDecision({ applies_going_forward: bad }));
    }, /must be exactly true or false/);
  });
  assert.throws(function () { buildPromotion(standingDecision({ asked_on: undefined })); }, /asked_on is required/);
  assert.throws(function () { buildPromotion(standingDecision({ asked_on: '27-07-2026' })); }, /YYYY-MM-DD/);
  assert.throws(function () { buildPromotion(standingDecision({ question: '  ' })); }, /question/);
  assert.throws(function () { buildPromotion(standingDecision({ answer: '' })); }, /answer/);
});

test('a rule payload alongside applies_going_forward false is a loud error, never a silent drop', function () {
  assert.throws(function () {
    buildPromotion(standingDecision({ applies_going_forward: false }));
  }, /remove the rule payload/);
});

test('applies_going_forward true with no rule payload is refused', function () {
  assert.throws(function () {
    buildPromotion({
      asked_on: '2026-07-27', question: 'q', answer: 'a', applies_going_forward: true, household_id: 1
    });
  }, /decision\.rule is required/);
});

// ---------------------------------------------------------------------
// Transaction shape (fake client, no database)
// ---------------------------------------------------------------------

test('promotion writes the log, the rule, and the back-link in ONE transaction', async function () {
  const client = fakeClient({ logId: 501, ruleId: 902 });
  const res = await promoteDecision(standingDecision(), { client: client });

  assert.deepEqual(res, { logId: 501, ruleId: 902 });

  const statements = sqlOf(client);
  assert.equal(statements.length, 5);
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /^INSERT INTO asdair\.rule_qa_log \(/);
  assert.match(statements[2], /^INSERT INTO asdair\.rules \(/);
  assert.equal(statements[3], _internal.BACKLINK_SQL);
  assert.equal(statements[4], 'COMMIT');

  // The back-link carries the RULE id into the LOG row -- the link the
  // schema designed and nothing had ever written.
  assert.deepEqual(client.calls[3].params, [902, 501]);

  // The log row is written with exactly the contracted columns.
  const cols = client.calls[1].sql.match(/\(([^)]*)\) VALUES/)[1].split(',').map(function (s) { return s.trim(); });
  assert.deepEqual(cols, _internal.LOG_COLUMNS);
});

test('applies_going_forward false: no rule is inserted and no back-link is written', async function () {
  const client = fakeClient();
  const res = await promoteDecision({
    asked_on: '2026-07-27',
    question: 'Skip Widget A this week?',
    answer: 'Yes, just this week.',
    applies_going_forward: false,
    household_id: 1
  }, { client: client });

  assert.equal(res.ruleId, null, 'promoted_rule_id stays null');

  const statements = sqlOf(client);
  assert.deepEqual(statements, ['BEGIN', statements[1], 'COMMIT']);
  assert.match(statements[1], /^INSERT INTO asdair\.rule_qa_log \(/);
  assert.equal(statements.some(function (s) { return /INSERT INTO asdair\.rules/.test(s); }), false);
  assert.equal(statements.some(function (s) { return /promoted_rule_id/.test(s); }), false);
});

test('a refused promotion never opens a transaction at all', async function () {
  const client = fakeClient();
  await assert.rejects(promoteDecision(standingDecision({ one_week_only: true }), { client: client }), /one-week-only/);
  assert.equal(client.calls.length, 0);
});

test('a failure after the log insert ROLLBACKs, so a log never claims a rule that does not exist', async function () {
  const client = fakeClient({ failOn: /INSERT INTO asdair\.rules/ });
  await assert.rejects(promoteDecision(standingDecision(), { client: client }), /synthetic failure/);

  const statements = sqlOf(client);
  assert.equal(statements.indexOf('COMMIT'), -1);
  assert.equal(statements[statements.length - 1], 'ROLLBACK');
});

test('no connection string is ever hardcoded; ASDAIR_DB_URL is the only env var read', function () {
  const src = fs.readFileSync(path.join(__dirname, 'promoteDecision.js'), 'utf8');
  assert.equal(/postgres(ql)?:\/\//.test(src), false);
  const envReads = src.match(/process\.env\.[A-Z_]+/g) || [];
  assert.deepEqual(Array.from(new Set(envReads)), ['process.env.ASDAIR_DB_URL']);
});
