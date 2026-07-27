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

const { promoteDecision, buildPromotion, applySourceVerdict, _internal } = require('./promoteDecision');

// A fake pg client: records statements, hands back synthetic ids. The log
// insert and the rule insert get DIFFERENT ids so the back-link can be
// proven to carry the RULE id, not just "an" id.
// opts.docType   : what the fake asdair.source_documents lookup returns.
//                  undefined -> the id resolves to NO row.
// opts.docFails  : the lookup throws (denied grant / missing table).
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
      if (/FROM asdair\.source_documents/i.test(text)) {
        if (opts.docFails) throw new Error('synthetic: permission denied for table source_documents');
        // undefined -> the id resolves to NO row. Any other value (including
        // null or '') -> a row that exists but is not authoritative.
        return { rows: opts.docType !== undefined ? [{ doc_type: opts.docType }] : [] };
      }
      if (/INSERT INTO asdair\.rule_qa_log/i.test(text)) return { rows: [{ id: opts.logId || 501 }] };
      if (/INSERT INTO asdair\.rules/i.test(text)) return { rows: [{ id: opts.ruleId || 902 }] };
      return { rows: [] };
    }
  };
}

// Pull the row a fake INSERT was given, as { column: value }.
function insertedRow(client, tableRe) {
  const call = client.calls.find(function (c) { return tableRe.test(c.sql); });
  if (!call) return null;
  const cols = call.sql.match(/\(([^)]*)\) VALUES/)[1].split(',').map(function (s) { return s.trim(); });
  const row = {};
  cols.forEach(function (c, i) { row[c] = call.params[i]; });
  return row;
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
  assert.equal(built.verification, null);
  assert.deepEqual(built.log, {
    asked_on: '2026-07-27',
    question: 'Skip Widget A this week?',
    answer: 'Yes, just this week.',
    applies_going_forward: false,
    household_id: 1,
    source_document_id: null
  });
});

test('applies_going_forward true: a STRUCTURED rule is built the planner can actually act on', function () {
  const built = buildPromotion(standingDecision());
  assert.deepEqual(built.rule, {
    category: 'household',
    rule_text: 'Do not buy Widget A.',
    scope: 'product',
    // DEFAULT-DENY: 'exclude' was REQUESTED, but the pure layer never grants an
    // actionable directive -- only a verified authoritative source can.
    directive: 'info',
    match_term: 'Widget A',
    match_category: null,
    matched_product: null,
    reason: 'household decided it is not wanted',
    note: null,
    active: true,                 // a promoted rule is live by definition
    household_id: 1,              // inherits the decision's household
    // TQA-PR73-002: the rule carries its own provenance pointer, always the SAME
    // document the decision cited. Null here because this fixture cites none.
    source_document_id: null
  });
  assert.deepEqual(built.verification, {
    required: true,
    requested_directive: 'exclude',
    source_document_id: null
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

// =====================================================================
// THE PROVENANCE GUARD
//
// An ACTIONABLE directive (exclude / needs_decision / map) changes every
// future basket. It may be created ONLY where the decision's own durable
// provenance -- asdair.source_documents.doc_type, read from the DATABASE --
// shows the instruction was explicit. Everything else is DOWNGRADED to the
// inert 'info', never refused: the learning is still worth keeping.
// =====================================================================

// Real doc_types that are NOT instructions, plus the degenerate rows.
const NON_AUTHORITATIVE = ['order_history', 'shopping_list', 'readme', 'meeting_notes', '', null];

// The same decision, promoted through a fake client whose source-document
// lookup returns `docType`. Returns the asdair.rules row that was inserted.
async function promoteWithSource(docType, extra, clientOpts) {
  const client = fakeClient(Object.assign({ docType: docType }, clientOpts || {}));
  const res = await promoteDecision(
    standingDecision(Object.assign({ source_document_id: 77 }, extra || {})),
    { client: client }
  );
  return { rule: insertedRow(client, /INSERT INTO asdair\.rules/), client: client, res: res };
}

// ---- 1. an ambiguous/automatic learning CANNOT create an actionable rule ----

test('GUARD 1: a non-authoritative source can NEVER produce an actionable directive', async function () {
  for (const docType of NON_AUTHORITATIVE) {
    const out = await promoteWithSource(docType);
    assert.equal(out.rule.directive, 'info',
      'doc_type ' + JSON.stringify(docType) + ' must not be able to authorise an actionable directive');
    assert.match(out.rule.note, /auto-downgraded/);
  }
});

test('GUARD 1: an ABSENT, UNRESOLVABLE or UNREADABLE source is equally unproven', async function () {
  // No source_document_id at all.
  const noneClient = fakeClient();
  await promoteDecision(standingDecision(), { client: noneClient });
  assert.equal(insertedRow(noneClient, /INSERT INTO asdair\.rules/).directive, 'info');

  // An id that resolves to no row (docType undefined -> zero rows).
  const missing = await promoteWithSource(undefined);
  assert.equal(missing.rule.directive, 'info');
  assert.match(missing.rule.note, /resolves to no asdair\.source_documents row/);

  // The lookup itself fails (e.g. the SELECT grant was revoked). Fail SAFE:
  // unproven, not "assume yes", and NOT a lost decision.
  const denied = await promoteWithSource('agent_spec', null, { docFails: true });
  assert.equal(denied.rule.directive, 'info',
    'a failed lookup must never be treated as proof');
  assert.match(denied.rule.note, /could not be completed/);
  assert.ok(denied.res.logId, 'the decision is still recorded');
});

// ---- 2. the learning is PRESERVED, not dropped and not refused -------------

test('GUARD 2: a downgraded learning is preserved intact, with the reason recorded', async function () {
  const out = await promoteWithSource('order_history');

  assert.equal(out.rule.directive, 'info');
  // Everything the human actually said survives.
  assert.equal(out.rule.rule_text, 'Do not buy Widget A.');
  assert.equal(out.rule.category, 'household');
  assert.equal(out.rule.match_term, 'Widget A');
  assert.equal(out.rule.household_id, 1);
  assert.equal(out.rule.active, true);
  assert.equal(out.rule.reason, 'household decided it is not wanted',
    'the caller-supplied reason must not be clobbered');

  // ...and WHY it was downgraded is durable and human-readable.
  assert.match(out.rule.note, /auto-downgraded/);
  assert.match(out.rule.note, /'exclude'/);
  assert.match(out.rule.note, /order_history/);
  assert.match(out.rule.note, /not authoritative/);
});

test('GUARD 2: a downgrade APPENDS to an existing note rather than overwriting it', async function () {
  const out = await promoteWithSource('readme', {
    rule: {
      category: 'household', rule_text: 'Do not buy Widget A.', scope: 'product',
      directive: 'exclude', match_term: 'Widget A', note: 'raised at the Tuesday review'
    }
  });
  assert.match(out.rule.note, /^raised at the Tuesday review \| /);
  assert.match(out.rule.note, /auto-downgraded/);
});

// ---- 3. a genuinely explicit source STILL creates the actionable rule -------

test('GUARD 3: an authoritative source still produces the intended actionable directive', async function () {
  for (const docType of _internal.AUTHORITATIVE_DOC_TYPES) {
    const out = await promoteWithSource(docType);
    assert.equal(out.rule.directive, 'exclude',
      "doc_type '" + docType + "' is authoritative and must promote as asked");
    assert.equal(out.rule.note, null, 'a granted directive carries no downgrade note');
    assert.equal(out.rule.match_term, 'Widget A');
  }
  assert.deepEqual(_internal.AUTHORITATIVE_DOC_TYPES, ['agent_spec', 'decisions_log']);
});

test("GUARD 3: 'map' and 'needs_decision' are granted on proof too, and inert without it", async function () {
  const mapRule = {
    category: 'mapping', rule_text: 'Widget A maps to Widget A Deluxe', scope: 'product',
    directive: 'map', match_term: 'Widget A', matched_product: 'Widget A Deluxe'
  };
  const proven = await promoteWithSource('decisions_log', { rule: mapRule });
  assert.equal(proven.rule.directive, 'map');
  assert.equal(proven.rule.matched_product, 'Widget A Deluxe');

  const unproven = await promoteWithSource('shopping_list', { rule: mapRule });
  assert.equal(unproven.rule.directive, 'info');
  assert.equal(unproven.rule.matched_product, 'Widget A Deluxe', 'the mapping itself is preserved');

  const nd = await promoteWithSource('agent_spec', {
    rule: { category: 'household', rule_text: 'Ask about Widget A', scope: 'product',
            directive: 'needs_decision', match_term: 'Widget A' }
  });
  assert.equal(nd.rule.directive, 'needs_decision');
});

// ---- 4. rule 10 is untouched by any of this --------------------------------

test('GUARD 4: one_week_only / one_time stays non-promotable EVEN from an authoritative source', async function () {
  const client = fakeClient({ docType: 'agent_spec' });
  await assert.rejects(
    promoteDecision(standingDecision({ source_document_id: 77, one_week_only: true }), { client: client }),
    /one-week-only/);

  await assert.rejects(promoteDecision(standingDecision({
    source_document_id: 77,
    rule: { category: 'household', rule_text: 'Skip Widget A', scope: 'one_time',
            directive: 'exclude', match_term: 'Widget A' }
  }), { client: client }), /one_time/);

  // Refused BEFORE anything is read or written -- authoritative provenance
  // buys no exemption from rule 10.
  assert.equal(client.calls.length, 0);
});

// ---- 5. provenance / back-link intact in EVERY promoting case --------------

test('GUARD 5: the back-link is written whether the directive was granted or downgraded', async function () {
  for (const docType of ['agent_spec', 'order_history', undefined]) {
    const client = fakeClient({ docType: docType, logId: 501, ruleId: 902 });
    const res = await promoteDecision(
      standingDecision({ source_document_id: 77 }), { client: client });

    assert.deepEqual(res, { logId: 501, ruleId: 902 });
    const backlink = client.calls.find(function (c) { return c.sql === _internal.BACKLINK_SQL; });
    assert.ok(backlink, 'the promoted_rule_id back-link must always be written');
    assert.deepEqual(backlink.params, [902, 501]);
    assert.equal(client.calls[client.calls.length - 1].sql, 'COMMIT');
  }
});

test('GUARD 5: the verified source_document_id is persisted; an unresolvable one is nulled (FK-safe)', async function () {
  // Resolved -> the evidence that authorised the directive is itself durable.
  const proven = fakeClient({ docType: 'agent_spec' });
  await promoteDecision(standingDecision({ source_document_id: 77 }), { client: proven });
  assert.equal(insertedRow(proven, /INSERT INTO asdair\.rule_qa_log/).source_document_id, 77);

  // Unresolvable -> null, or the FK would raise 23503 and REFUSE the decision,
  // which is exactly the outcome the downgrade contract forbids.
  const dangling = fakeClient({ docType: undefined });
  const res = await promoteDecision(standingDecision({ source_document_id: 999999 }), { client: dangling });
  assert.equal(insertedRow(dangling, /INSERT INTO asdair\.rule_qa_log/).source_document_id, null);
  assert.ok(res.logId, 'the decision is still recorded');
});

test('GUARD 5: the provenance lookup happens BEFORE BEGIN, so a denied read cannot abort the write', async function () {
  const client = fakeClient({ docType: 'agent_spec' });
  await promoteDecision(standingDecision({ source_document_id: 77 }), { client: client });

  const statements = sqlOf(client);
  assert.match(statements[0], /FROM asdair\.source_documents/);
  assert.equal(statements[1], 'BEGIN');
  assert.deepEqual(client.calls[0].params, [77]);
});

// ---- 6. THE PROPERTY MOST LIKELY TO BE ERODED LATER ------------------------

test('GUARD 6: NO caller-supplied boolean can force an actionable directive', async function () {
  // Every flag name a future change might plausibly reach for, on BOTH the
  // decision and the rule payload, with a deliberately non-authoritative
  // source. If any of these ever works, the trust boundary has moved from
  // source evidence back to caller assertion and the guard is void.
  const FLAGS = [
    'explicit', 'trusted', 'force', 'forced', 'verified', 'authoritative',
    'is_explicit', 'source_authoritative', 'skip_verification', 'bypass',
    'directive_verified', 'allow_actionable', 'confirmed', 'human_confirmed',
    'override', 'proven', 'validated', 'trust', 'admin', 'internal'
  ];

  for (const flag of FLAGS) {
    // On the decision.
    const a = await promoteWithSource('order_history', (function () {
      const o = {}; o[flag] = true; return o;
    })());
    assert.equal(a.rule.directive, 'info',
      'decision.' + flag + ' must not be able to force an actionable directive');

    // On the rule payload.
    const ruleWithFlag = {
      category: 'household', rule_text: 'Do not buy Widget A.', scope: 'product',
      directive: 'exclude', match_term: 'Widget A'
    };
    ruleWithFlag[flag] = true;
    const b = await promoteWithSource('order_history', { rule: ruleWithFlag });
    assert.equal(b.rule.directive, 'info',
      'rule.' + flag + ' must not be able to force an actionable directive');
  }

  // ...and the verification record itself is not a caller-writable back door:
  // a decision cannot declare its own request already satisfied.
  const spoofed = await promoteWithSource('order_history', {
    verification: { required: false, requested_directive: 'exclude' }
  });
  assert.equal(spoofed.rule.directive, 'info');
});

test('GUARD 6: doc_type from the DATABASE is the ONLY variable that flips the outcome', function () {
  // Identical decision, identical everything -- only the database verdict
  // differs. That is the whole trust boundary, stated as a property.
  const built = buildPromotion(standingDecision({ source_document_id: 77 }));
  assert.equal(built.rule.directive, 'info', 'the pure layer NEVER emits an actionable directive');

  const granted = applySourceVerdict(built.rule, built.verification,
    { supplied: true, resolved: true, doc_type: 'agent_spec', failed: false });
  const refused = applySourceVerdict(built.rule, built.verification,
    { supplied: true, resolved: true, doc_type: 'order_history', failed: false });

  assert.equal(granted.directive, 'exclude');
  assert.equal(refused.directive, 'info');

  // Pure: the input rule is never mutated.
  assert.equal(built.rule.directive, 'info');

  // A missing/garbage verdict is unproven, never a grant.
  [undefined, {}, { resolved: true }, { resolved: false, doc_type: 'agent_spec' },
   { resolved: true, doc_type: 'AGENT_SPEC' }].forEach(function (v) {
    assert.equal(applySourceVerdict(built.rule, built.verification, v).directive, 'info',
      'verdict ' + JSON.stringify(v) + ' must not grant an actionable directive');
  });
});

test('GUARD 6: buildPromotion is DB-free and applySourceVerdict is pure', function () {
  // The guard's pure half must stay pure: these run with no database, no
  // client, and no env var set at all.
  const saved = process.env.ASDAIR_WRITE_DB_URL;
  delete process.env.ASDAIR_WRITE_DB_URL;
  try {
    const built = buildPromotion(standingDecision({ source_document_id: 77 }));
    assert.equal(built.verification.requested_directive, 'exclude');
    assert.equal(applySourceVerdict(built.rule, built.verification,
      { supplied: true, resolved: true, doc_type: 'decisions_log' }).directive, 'exclude');
  } finally {
    if (saved !== undefined) process.env.ASDAIR_WRITE_DB_URL = saved;
  }

  // No I/O crept into the pure function.
  const src = fs.readFileSync(path.join(__dirname, 'promoteDecision.js'), 'utf8');
  const pure = src.slice(src.indexOf('function buildPromotion('), src.indexOf('function applySourceVerdict('));
  assert.equal(/client|query|await|pool|getPool/i.test(pure), false,
    'buildPromotion must contain no I/O');
});

test('GUARD 6: source_document_id is validated like any other id', function () {
  ['0', -1, 'abc', '12x'].forEach(function (bad) {
    assert.throws(function () {
      buildPromotion(standingDecision({ source_document_id: bad }));
    }, /source_document_id must be a positive integer id/);
  });
});

test('no connection string is ever hardcoded; ASDAIR_WRITE_DB_URL is the only env var read', function () {
  const src = fs.readFileSync(path.join(__dirname, 'promoteDecision.js'), 'utf8');
  assert.equal(/postgres(ql)?:\/\//.test(src), false);
  const envReads = src.match(/process\.env\.[A-Z_]+/g) || [];
  assert.deepEqual(Array.from(new Set(envReads)), ['process.env.ASDAIR_WRITE_DB_URL']);
});

// TQA-PR73-002 guard. The rule's provenance pointer must always be the SAME
// document the DECISION cited. If a caller could supply it separately, it could
// cite an authoritative document to pass the verification gate and then stamp a
// different one onto the artefact that survives -- defeating the audit.
test('the rule cites the SAME source document as its decision, never a separate one', function () {
  const built = buildPromotion(standingDecision({
    source_document_id: 7,
    rule: {
      category: 'household', rule_text: 'Do not buy Widget A.', directive: 'exclude',
      match_term: 'Widget A', scope: 'product',
      source_document_id: 99          // a caller trying to stamp a different document
    }
  }));
  assert.equal(built.rule.source_document_id, 7, 'must inherit the decision document, not the rule payload one');
  assert.equal(built.log.source_document_id, 7);
  assert.equal(built.verification.source_document_id, 7);
});

// TQA-PR73-004 (HIGH, merge-blocking). source_document_id is a FOREIGN KEY on
// BOTH rule_qa_log and rules. When the cited id does not resolve, the null must
// be applied to BOTH rows -- otherwise the rule insert raises 23503, the whole
// transaction rolls back, and the decision is REFUSED instead of downgraded to
// inert info. That inverts the downgrade-never-refuse contract exactly.
test('an unresolvable source document nulls the pointer on the RULE as well as the log', async function () {
  const client = fakeClient({ docType: undefined });   // id resolves to NO row
  const out = await promoteDecision(
    standingDecision({ source_document_id: 4242 }),
    { client: client }
  );

  const logRow = insertedRow(client, /INSERT INTO asdair\.rule_qa_log/i);
  const ruleRow = insertedRow(client, /INSERT INTO asdair\.rules/i);

  assert.equal(logRow.source_document_id, null, 'log pointer must be nulled');
  assert.ok(ruleRow, 'the decision must still be promoted, not refused');
  assert.equal(ruleRow.source_document_id, null, 'RULE pointer must be nulled too, or the FK dangles');
  assert.equal(ruleRow.directive, 'info', 'unresolvable provenance can never grant an actionable directive');
  assert.ok(/resolves to no/i.test(String(ruleRow.note)), 'the downgrade must be explained on the rule');
  assert.ok(out.ruleId, 'a rule id is returned, proving the transaction committed');
});
