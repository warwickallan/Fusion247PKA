// BUILD-015 WP-B15-41 - cockpit-api/dbProofs.test.js
//
// THE PROOFS THAT NEED A REAL POSTGRES.
//
// ⛔ WHAT THESE DO AND DO NOT PROVE. READ THIS BEFORE CITING THEM.
//
// These run against a DISPOSABLE local cluster and NOTHING ELSE. They prove the
// read and resolution paths work against a real PostgreSQL with the real
// migration set and the real grant matrix - which the offline suite, with its
// injected clients, cannot prove at all.
//
// They DO NOT prove that any answer was applied to live household data. Live
// application is explicitly reclassified as MANUAL for this Work Order and is
// Larry's, and the real production event has NOT been exercised here. A green
// in this file is builder evidence about a throwaway database.
//
// ── FIXTURES ACCUMULATE, DELIBERATELY ─────────────────────────────────────
// asdair_rw holds NO DELETE grant on ANY table in the schema - verified against
// the target on 2026-08-13, and it is production-faithful rather than an
// oversight. So these tests cannot clean up after themselves. Every run mints
// UNIQUE identifiers instead, and rows accumulate harmlessly in the throwaway
// database. A test that needed to delete would be a test asking for a grant the
// real writer does not have.
//
// SKIPPED, NOT FAILED, when no target is configured: a developer without a local
// cluster must still get a meaningful run out of `node --test`.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const READ_URL = process.env.ASDAIR_DB_URL || null;
const WRITE_URL = process.env.ASDAIR_WRITE_DB_URL || null;
const ENABLED = !!(READ_URL && WRITE_URL);

// One namespace per run. The clock plus a random tail, because two runs inside
// the same millisecond are not impossible and a collision would look like a
// product defect rather than a fixture one.
const RUN = 'wo41-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

let pg = null;
let writePool = null;
let readPool = null;
// Distinct list_date per seeded shop - see seedShop().
let seedNo = Math.floor(Math.random() * 900) + 50;

function skipMessage() {
  return 'SKIPPED - no disposable target. Set ASDAIR_DB_URL and ASDAIR_WRITE_DB_URL to run these.';
}

async function w(sql, params) {
  if (!writePool) { pg = pg || require('pg'); writePool = new pg.Pool({ connectionString: WRITE_URL }); }
  return writePool.query(sql, params);
}
async function r(sql, params) {
  if (!readPool) { pg = pg || require('pg'); readPool = new pg.Pool({ connectionString: READ_URL }); }
  return readPool.query(sql, params);
}

/**
 * Insert one self-contained shop. Returns its ids.
 *
 * ⚠️ THE HOUSEHOLD IS REUSED, NOT CREATED, AND THAT IS PRODUCTION-FAITHFUL.
 * asdair_rw holds SELECT ONLY on asdair.households - it cannot create one, and
 * a first draft of this helper that tried was correctly refused with
 * "permission denied for table households". That refusal is the grant matrix
 * working: a household is not something the shopping writer invents. So the
 * fixture reads an existing household exactly as the real writer would.
 */
async function seedShop(opts) {
  const o = opts || {};
  const hh = await r('SELECT id FROM asdair.households ORDER BY id ASC LIMIT 1');
  assert.ok(hh.rows[0], 'the disposable database must carry at least one household to attach a shop to');
  const householdId = hh.rows[0].id;

  // A DISTINCT DATE PER SEED. Migration 019's `uq_lists_household_date_unowned`
  // allows one unowned list per household per date, and this run reuses one
  // household (see above), so same-day seeds collide. Walking backwards a day
  // at a time is the cheap, honest way to stay inside a REAL constraint rather
  // than working around it - the constraint is correct and is not mine to
  // relax, and a fixture that fought it would be evidence about nothing.
  seedNo += 1;
  const list = await w(
    'INSERT INTO asdair.shopping_lists (household_id, list_date) '
    + "VALUES ($1, CURRENT_DATE - ($2 || ' days')::interval) RETURNING id",
    [householdId, String(seedNo)]
  );
  const listId = list.rows[0].id;

  // ⚠️ THE REF SHAPE IS A REAL PRODUCT CONSTRAINT, NOT A FIXTURE DETAIL.
  // shopStatus.resolveShop accepts an id or `SHOP-YYYY-MM-DD` with an optional
  // `-M<message id>` suffix, and refuses anything else rather than guessing. A
  // first draft used `SHOP-<runid>-<name>` and was correctly refused - so these
  // fixtures now mint the REAL shape, which also means the read path under test
  // is exercised through the same identifier Warwick actually sees.
  const shopRef = 'SHOP-2026-08-13-M' + String(9000000 + seedNo * 977 + (Date.now() % 1000));
  const shop = await w(
    'INSERT INTO asdair.shop (household_id, shop_ref, source_kind, status, human_state, list_id) '
    + 'VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [householdId, shopRef, 'photo', o.status || 'PROCESSING', o.humanState || 'ASDAIR_WORKING', listId]
  );
  const shopId = shop.rows[0].id;

  return { householdId: householdId, listId: listId, shopId: shopId, shopRef: shopRef };
}

test('DB PRECONDITION: the target is the disposable cluster with migration 020 applied', { skip: !ENABLED && skipMessage() }, async () => {
  const v = await r('SELECT version() AS v');
  assert.match(v.rows[0].v, /PostgreSQL 17/);

  // 020's three artefacts, established by asking the catalogue rather than by
  // trusting that a migration file exists in the repository.
  const cols = await r(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='asdair' "
    + "AND table_name='shop' AND column_name='human_state'"
  );
  assert.equal(cols.rows.length, 1, 'asdair.shop.human_state must exist - migration 020 section 5');

  const tables = await r(
    "SELECT to_regclass('asdair.shop_line_provenance') IS NOT NULL AS ledger, "
    + "to_regclass('asdair.shop_image_region') IS NOT NULL AS regions"
  );
  assert.equal(tables.rows[0].ledger, true);
  assert.equal(tables.rows[0].regions, true);
});

test('DB: THE 020 TABLES ARE EMPTY FOR THIS RUN\'S SHOPS - which is the claim that actually matters',
  { skip: !ENABLED && skipMessage() }, async () => {
  // ⚠️ FINDING F, RESTATED ACCURATELY AFTER THE TARGET MOVED UNDER ME.
  //
  // At preflight both 020 tables were EMPTY on this cluster (0 rows each,
  // read at 07:5x on 2026-08-13). By the time these proofs ran they were not:
  // another lane had written region and provenance rows to the SAME disposable
  // database. The cluster is SHARED, and its contents are not mine to assert.
  //
  // An earlier version of this test asserted `count(*) === 0` globally and
  // failed - correctly. Weakening it to "greater than or equal to 0" would have
  // been asserting nothing at all. So it now asserts the claim the Work Order
  // actually rests on, which is narrower and is genuinely mine to make: the
  // shops THIS run creates have no region or provenance rows, so every
  // AC1/AC2/AC5/AC6 figure below is proven against fixtures created here and
  // never against another lane's carried-over data.
  const seed = await seedShop({ suffix: 'empty' });

  const regions = await r('SELECT count(*)::int AS n FROM asdair.shop_image_region WHERE shop_id = $1', [seed.shopId]);
  assert.equal(regions.rows[0].n, 0, 'a freshly seeded shop has no image regions - 020 does not backfill');

  const prov = await r('SELECT count(*)::int AS n FROM asdair.shop_line_provenance WHERE shop_id = $1', [seed.shopId]);
  assert.equal(prov.rows[0].n, 0, 'and no provenance ledger rows - the vision pipeline writes those');
});

test('DB: the READ role genuinely cannot write - the split is the database\'s, not the code\'s', { skip: !ENABLED && skipMessage() }, async () => {
  // The most valuable assertion in this file: it proves the boundary is real
  // rather than a convention the application is trusted to honour.
  await assert.rejects(
    () => r("INSERT INTO asdair.households (name) VALUES ('should not be possible')"),
    /permission denied/i,
    'ASDAIR_DB_URL must be a SELECT-only role - if this insert succeeds, the read path can corrupt data'
  );
});

test('DB: the WRITE role holds no DELETE anywhere - so nothing here can destroy a row', { skip: !ENABLED && skipMessage() }, async () => {
  const grants = await r(
    "SELECT count(*)::int AS n FROM information_schema.table_privileges "
    + "WHERE grantee='asdair_rw' AND table_schema='asdair' AND privilege_type='DELETE'"
  );
  assert.equal(grants.rows[0].n, 0, 'asdair_rw must hold no DELETE on any asdair table');
});

// =====================================================================
// AC3 - THE ANSWER IS ACTUALLY APPLIED. Against the disposable target.
// =====================================================================
test('AC3 DB: a free-text answer is APPLIED to the durable row', { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const seed = await seedShop({ suffix: 'typed' });

  const key = 'q-' + RUN + '-typed';
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) VALUES ($1,$2,$3,$4)',
    [seed.shopId, key, 'which sauce did you mean?', 'open']
  );

  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: seed.shopRef, question_key: key, answer_text: 'the 500g one' }
  }, { commandDeps: getCommandDeps() });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.applied, true);
  assert.equal(res.body.changed, true);

  // ── THE PROOF THAT MATTERS: the DURABLE ROW MOVED. Read back through the
  // SELECT-only role, so this is not the writer confirming its own work.
  const row = await r(
    'SELECT status, answer_text, answer_source, answered_at FROM asdair.shop_question WHERE question_key = $1',
    [key]
  );
  assert.equal(row.rows[0].status, 'answered');
  assert.equal(row.rows[0].answer_text, 'the 500g one');
  assert.equal(row.rows[0].answer_source, 'typed');
  assert.ok(row.rows[0].answered_at, 'answered_at must be stamped, or nothing records WHEN it was settled');
});

test('AC3 DB: choosing a candidate records answer_source "button"', { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const seed = await seedShop({ suffix: 'choose' });

  const key = 'q-' + RUN + '-choose';
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) VALUES ($1,$2,$3,$4)',
    [seed.shopId, key, 'which one?', 'open']
  );

  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer/choose',
    body: { shop: seed.shopRef, question_key: key, answer_text: 'Arla semi skimmed 4pt' }
  }, { commandDeps: getCommandDeps() });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.applied, true);
  const row = await r('SELECT status, answer_source FROM asdair.shop_question WHERE question_key = $1', [key]);
  assert.equal(row.rows[0].status, 'answered');
  assert.equal(row.rows[0].answer_source, 'button');
});

test('AC3 DB: "not this week" settles the row as skipped, not as an empty answer', { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const seed = await seedShop({ suffix: 'skip' });

  const key = 'q-' + RUN + '-skip';
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) VALUES ($1,$2,$3,$4)',
    [seed.shopId, key, 'do you want this?', 'open']
  );

  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer/skip',
    body: { shop: seed.shopRef, question_key: key }
  }, { commandDeps: getCommandDeps() });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.applied, true);
  const row = await r('SELECT status, answer_text FROM asdair.shop_question WHERE question_key = $1', [key]);
  assert.equal(row.rows[0].status, 'skipped', 'a skip is a real decision with its own status');
  assert.equal(row.rows[0].answer_text, null);
});

test('AC3 DB: FIRST ANSWER WINS - a second answer cannot overwrite the first', { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const seed = await seedShop({ suffix: 'idem' });

  const key = 'q-' + RUN + '-idem';
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) VALUES ($1,$2,$3,$4)',
    [seed.shopId, key, 'which one?', 'open']
  );

  const first = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: seed.shopRef, question_key: key, answer_text: 'FIRST' }
  }, { commandDeps: getCommandDeps() });
  assert.equal(first.body.changed, true);

  const second = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: seed.shopRef, question_key: key, answer_text: 'SECOND - must not land' }
  }, { commandDeps: getCommandDeps() });

  assert.equal(second.status, 200);
  assert.equal(second.body.changed, false, 'the second answer must not move the row');
  assert.equal(second.body.already_answered, true);
  assert.equal(second.body.applied, true, 'the row DOES hold an answer - just not this one');

  const row = await r('SELECT answer_text FROM asdair.shop_question WHERE question_key = $1', [key]);
  assert.equal(row.rows[0].answer_text, 'FIRST', 'a double-tap must never overwrite a decision');
});

test('AC3 DB: an unknown shop is refused and applies nothing', { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const res = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: 'SHOP-DOES-NOT-EXIST-' + RUN, question_key: 'nope', answer_text: 'x' }
  }, { commandDeps: getCommandDeps() });
  assert.equal(res.body.ok, false);
  assert.equal(res.body.applied, false);
});

// =====================================================================
// AC1 / AC6 / AC9 - THE READ PATH, AGAINST A REAL DATABASE.
// =====================================================================
test('AC1 DB: the verdict is READ from the stored human_state column', { skip: !ENABLED && skipMessage() }, async () => {
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'verdict', status: 'PROCESSING', humanState: 'NEEDS_WARWICK' });

  const p = await readWorkspace({ shop: seed.shopRef });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.this_week.verdict, 'NEEDS_WARWICK');
  assert.equal(p.this_week.verdict_is_stored_value, true, 'it must come from the column, not a derivation');
  assert.equal(p.shop.canonical_state_source, 'column');
});

test('LANE F DB: a status/human_state contradiction is DETECTED against a real row', { skip: !ENABLED && skipMessage() }, async () => {
  // Lane F's exact scenario, reproduced through the production read path: a row
  // whose status says one thing and whose stored verdict says another, which is
  // what having NO TRIGGER on the column permits.
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'drift', status: 'READY_TO_SHOP', humanState: 'ASDAIR_WORKING' });

  const p = await readWorkspace({ shop: seed.shopRef });
  assert.equal(p.this_week.verdict, 'ASDAIR_WORKING', 'the stored value is still what is served');
  assert.equal(p.this_week.verdict_agrees_with_status, false);
  assert.equal(p.this_week.verdict_expected_from_status_display, 'READY_FOR_WARWICK');
  assert.match(p.this_week.verdict_contradiction, /NO trigger/);
});

test('AC9 DB: the provenance ledger probe reports TRUE against a database where 020 is applied', { skip: !ENABLED && skipMessage() }, async () => {
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'probe' });

  const p = await readWorkspace({ shop: seed.shopRef });
  assert.equal(p.provenance.ledger_available, true);
  const ruleGap = p.provenance.gaps.find((g) => g.startsWith('RULE:'));
  // THE CORRECTION, PROVEN ON A REAL DATABASE: the payload no longer claims the
  // migration is unapplied on a database where it plainly is.
  assert.ok(!/has not been applied/.test(ruleGap), 'the stale claim must not reach the payload');
  assert.match(ruleGap, /exists on this database/);
});

test('AC6 DB: every count-bearing block of a real payload projects one arithmetic', { skip: !ENABLED && skipMessage() }, async () => {
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'counts' });

  // Two held lines, one settled, and one open question on a held line.
  await w('INSERT INTO asdair.shopping_list_items (list_id, item_name, status, requested_qty) VALUES '
    + '($1,$2,$3,$4), ($1,$5,$6,$7), ($1,$8,$9,$10)',
  [seed.listId, 'settled thing', 'added', 1, 'held thing', 'needs_decision', 1, 'other held thing', 'requested', 2]);

  const item = await r(
    "SELECT id FROM asdair.shopping_list_items WHERE list_id = $1 AND item_name = 'held thing'", [seed.listId]
  );
  await w('INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status, list_item_id) '
    + 'VALUES ($1,$2,$3,$4,$5)',
  [seed.shopId, 'q-' + RUN + '-counts', 'which held thing?', 'open', item.rows[0].id]);

  const p = await readWorkspace({ shop: seed.shopRef });
  const needingYou = p.shop.why.counts.decisions_needing_warwick;
  assert.equal(needingYou, 1);

  assert.equal(p.this_week.blocking_decisions_display, String(needingYou));
  assert.equal(p.questions.needing_you_count_display, String(needingYou));
  assert.equal(p.count_agreement.canonical_needing_you_display, String(needingYou));

  const held = p.shop.why.counts.uncertain_lines;
  assert.equal(held, 2, 'both needs_decision and requested are unsettled lines');
  assert.equal(p.this_week.uncertain_lines_display, String(held));
  assert.equal(p.exceptions.count_display, String(held));
  assert.equal(p.plan.counts.held_display, String(held));
});

test('AC2 DB: a held line carries the question_key a board joins on', { skip: !ENABLED && skipMessage() }, async () => {
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'board' });

  await w('INSERT INTO asdair.shopping_list_items (list_id, item_name, status, requested_qty) VALUES ($1,$2,$3,$4)',
    [seed.listId, 'ambiguous thing', 'needs_decision', 1]);
  const item = await r('SELECT id FROM asdair.shopping_list_items WHERE list_id = $1', [seed.listId]);
  const key = 'q-' + RUN + '-board';
  await w('INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status, list_item_id) '
    + 'VALUES ($1,$2,$3,$4,$5)', [seed.shopId, key, 'which ambiguous thing?', 'open', item.rows[0].id]);

  const p = await readWorkspace({ shop: seed.shopRef });
  const board = p.exceptions.items[0];
  assert.equal(board.question_key, key, 'THE reachable join key, proven end to end against Postgres');
  assert.equal(board.as_written_display, 'ambiguous thing');
  assert.equal(board.can_answer_now, true);
  // And the region reference is present and empty, exactly as Finding F bounds.
  assert.equal(board.image_region.known, false);
});

test('AC5 DB: the final list is brand-sorted and never serves the sort sentinel', { skip: !ENABLED && skipMessage() }, async () => {
  const { readWorkspace } = require('./readWorkspace');
  const seed = await seedShop({ suffix: 'final' });

  await w('INSERT INTO asdair.shopping_list_items (list_id, item_name, status, requested_qty) VALUES '
    + '($1,$2,$3,$4), ($1,$5,$6,$7)',
  [seed.listId, 'unbranded thing', 'added', 1, 'another unbranded thing', 'added', 2]);

  const p = await readWorkspace({ shop: seed.shopRef });
  assert.equal(p.final_list.lines.length, 2);
  p.final_list.lines.forEach((l) => {
    assert.ok(!/no brand recorded/i.test(l.brand_display),
      'the sort sentinel must never reach a display field on a real payload');
  });
  assert.equal(p.final_list.sort_contract, 'brand_az_then_product_az');
});

test.after(async () => {
  // Pools only. NOTHING is deleted: asdair_rw holds no DELETE grant, and the
  // fixtures above are meant to accumulate on a throwaway cluster.
  if (writePool) await writePool.end();
  if (readPool) await readPool.end();
});

// =====================================================================
// WO-2026-08-19-03 - AGAINST A REAL POSTGRES, NOT A FIXTURE.
//
// The read-back for this Work Order said the AC1/AC2 proofs would be offline,
// because no disposable target was available. One was; these are the row-level
// proofs that replaces. Same limits as everything else in this file: a
// throwaway cluster, builder evidence, and no claim whatsoever about live data.
// =====================================================================

test('AC1 DB: correctAnswer dispatches through the Cockpit HTTP layer against a real row',
  { skip: !ENABLED && skipMessage() }, async () => {
  const { handleRequest } = require('./httpApi');
  const { getCommandDeps } = require('./commandDeps');
  const seed = await seedShop({ suffix: 'correct' });

  // ⚠️ THE KEY IS DERIVED BY THE PIPELINE'S OWN FUNCTION, NOT TYPED.
  //
  // correctAnswer REFUSES to open a successor whose key it cannot re-derive
  // from a name the question actually carries - "a successor derived from a
  // different name would be invisible to the planner: recorded, and inert". A
  // hand-written key is therefore not a valid fixture, and the first draft of
  // this test earned exactly that refusal. The refusal is the product working;
  // the fixture was wrong. `item_name` reaches the question by the
  // shop_question.list_item_id -> shopping_list_items.item_name join.
  const { questionKeyFor } = require('../pipeline/keys.js');
  const itemName = 'cat food ' + RUN;
  const key = questionKeyFor(itemName, 1);
  const item = await w(
    'INSERT INTO asdair.shopping_list_items (list_id, item_name, status) VALUES ($1,$2,$3) RETURNING id',
    [seed.listId, itemName, 'held']
  );
  await w(
    'INSERT INTO asdair.shop_question (shop_id, list_item_id, question_key, question_text, status) '
    + 'VALUES ($1,$2,$3,$4,$5)',
    [seed.shopId, item.rows[0].id, key, 'which cat food did you mean?', 'open']
  );

  // 1. He answers, and it binds.
  const answered = await handleRequest({
    method: 'POST', path: '/asdair/answer',
    body: { shop: seed.shopRef, question_key: key, answer_text: 'Dreamies cheese' }
  }, { commandDeps: getCommandDeps() });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal(answered.body.changed, true);

  // 2. THE CAPABILITY THIS WORK ORDER EXISTS FOR. Before it, this call was a
  //    400 unknown_command: the Cockpit could not express the correction at
  //    all, while Telegram could.
  const corrected = await handleRequest({
    method: 'POST', path: '/asdair/command',
    body: {
      command: 'correctAnswer',
      // ⚠️ `actor` TRAVELS INSIDE args, AND THAT IS THE REAL CLIENT'S SHAPE,
      // not a fixture convenience. httpApi.js maps body.actor -> requested_by
      // only, while commands.js requireActor() reads spec.actor directly - so
      // every write through the generic route depends on the caller also
      // putting it in args. services/cockpit/public/app.js already does exactly
      // this, and says so in a comment at its one write function. REPORTED as a
      // seam wart rather than quietly changed here: altering the route would
      // change the contract for all twelve commands, which is wider than this
      // Work Order.
      args: { shopRef: seed.shopRef, questionKey: key, actor: 'cockpit:warwick',
        answerText: 'Felix As Good As It Looks', answerSource: 'typed' },
    }
  }, { commandDeps: getCommandDeps() });

  assert.notEqual(corrected.status, 400,
    'a 400 here means the Cockpit still cannot name the correction capability: ' + JSON.stringify(corrected.body));
  assert.equal(corrected.status, 200, JSON.stringify(corrected.body));
  assert.equal(corrected.body.command, 'correctAnswer');

  // 3. THE PROOF THAT MATTERS - the DURABLE ROWS moved, read back through the
  //    SELECT-only role so this is not the writer confirming its own work.
  const rows = await r(
    'SELECT id, question_key, status, answer_text, question_round, parent_question_id '
    + 'FROM asdair.shop_question WHERE shop_id = $1 ORDER BY id ASC',
    [seed.shopId]
  );
  assert.equal(rows.rows.length, 2,
    'a correction opens a SUCCESSOR round - it never edits the original, which is the record of '
    + 'what he was actually asked and what he actually said');

  const first = rows.rows[0];
  const second = rows.rows[1];
  assert.equal(first.question_key, key);
  assert.equal(first.answer_text, 'Dreamies cheese', 'his original words survive verbatim');
  assert.equal(String(second.parent_question_id), String(first.id),
    'the successor must point at the round it replaced - that link is the whole supersession');
  assert.equal(second.question_round, 2);
});

test('AC2 DB: a SUPERSEDED round is not counted as open by the cockpit arithmetic',
  { skip: !ENABLED && skipMessage() }, async () => {
  const A = require('./shopArithmetic');
  const seed = await seedShop({ suffix: 'superseded' });

  // Round 1, open and never answered. Round 2 replaces it. A third, unrelated
  // question stays genuinely open - so a rule that suppressed everything would
  // fail here rather than look correct.
  const k1 = 'q-' + RUN + '-sup-r1';
  const k2 = 'q-' + RUN + '-sup-r2';
  const k3 = 'q-' + RUN + '-other';
  const parent = await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) '
    + 'VALUES ($1,$2,$3,$4) RETURNING id',
    [seed.shopId, k1, 'which cat food?', 'open']
  );
  const parentId = parent.rows[0].id;
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status, question_round, parent_question_id) '
    + 'VALUES ($1,$2,$3,$4,$5,$6)',
    [seed.shopId, k2, 'which cat food, exactly?', 'open', 2, parentId]
  );
  await w(
    'INSERT INTO asdair.shop_question (shop_id, question_key, question_text, status) VALUES ($1,$2,$3,$4)',
    [seed.shopId, k3, 'which ham?', 'open']
  );

  // Read the rows the way the workspace read does, INCLUDING the 017 columns -
  // the point being that they are actually present on a real database and
  // actually arrive.
  const read = await r(
    'SELECT id, list_item_id, question_key, question_text, candidates, status, answer_text, '
    + 'answer_source, asked_at, answered_at, question_round, parent_question_id '
    + 'FROM asdair.shop_question WHERE shop_id = $1 ORDER BY id ASC',
    [seed.shopId]
  );
  assert.equal(read.rows.length, 3);
  assert.ok(read.rows.some((q) => q.parent_question_id !== null),
    'parent_question_id must be readable, or the cockpit cannot see a supersession at all');

  const facts = A.countShop({
    stage: 'PROCESSING', human_state: 'ASDAIR_WORKING',
    questions: read.rows, lines: [], items: [],
  });

  // THREE rows say status='open'. TWO are questions Warwick still has.
  assert.equal(facts.questions_open, 3, 'the raw status bucket is unchanged, and still sums');
  assert.equal(facts.questions_open_live, 2, 'the replaced round must not read as still open');
  assert.equal(facts.superseded_questions_suppressed, 1);
  assert.deepEqual([...facts.superseded_question_keys], [k1]);
  assert.equal(facts.decisions_needing_warwick, 2);
});

test('AC2 DB: the SELECT the workspace actually builds carries the 017 columns on a real database',
  { skip: !ENABLED && skipMessage() }, async () => {
  const RW = require('./readWorkspace');
  // Ask the catalogue what this database has, exactly as the read path does,
  // rather than trusting that a migration file exists in the repository.
  const cols = await r(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='asdair' "
    + "AND table_name='shop_question'"
  );
  const present = cols.rows.map((c) => c.column_name);
  assert.ok(present.includes('parent_question_id'), 'migration 017 is not applied to this target');

  const sql = RW._internal.buildQuestionSelect(present);
  assert.ok(sql.includes('parent_question_id'));
  assert.ok(sql.includes('question_round'));

  // And it RUNS. A statement that assembles and then fails against the real
  // catalogue would be a green about nothing.
  const seed = await seedShop({ suffix: 'select' });
  const out = await r(sql, [seed.shopId]);
  assert.ok(Array.isArray(out.rows));
});
