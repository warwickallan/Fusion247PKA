// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/planProvenanceProductionSeam.dbtest.js
//
// WO-2026-08-13-13 (WP-B15-46), AC1 + AC2 + AC3. THE ACCEPTANCE.
//
// ── WHAT VERITAS ACTUALLY ASKED FOR ──────────────────────────────────────
// Its WP-B15-40 receipt graded AC1 HOLD because REGULARS/RULE/WARWICK rows
// existed only in `lineProvenance.dbtest.js`, "which calls the writer DIRECTLY
// ... No caller exists." A test that calls a writer is capability evidence. So
// this file does NOT call a writer. It drives the PRODUCTION FUNCTION -
// `runPipeline.planWithDecisions` - and then goes and looks in Postgres for
// what that function caused to be written.
//
// ── WHY THIS IS A SECOND RUN AND NOT THE KNOWN PHOTOGRAPH ────────────────
// The known photograph carries ONLY photo lines: `separately_justified_
// additions: 0`, `provenance_counts {"PHOTO":39,"REGULARS":0,"RULE":0,
// "WARWICK":0}`. Making it emit the other three kinds would mean inventing
// origins it does not have, which moves the 39-line/53-item accounting that
// WP-B15-46 AC4 explicitly reserves - and is the contamination
// `finalise/finalList.js` refuses by design ("Do not contaminate PHOTO truth
// merely to make the final plan balance"). So the known photograph is re-proven
// UNCHANGED by `finalise/producedList.test.js`, and the three non-photo origins
// are exercised HERE, on a purpose-built household input that genuinely has
// them. Authorised by Larry on the WP-B15-46 read-back.
//
// ── WHAT IS REAL HERE ────────────────────────────────────────────────────
//   * runPipeline.planWithDecisions          THE PRODUCTION CALLER, verbatim
//   * skill/planner.js planBasket            REAL
//   * skill/rulebook.js applyRulebook        REAL
//   * pipeline/applyDecisions.js             REAL
//   * pipeline/planProvenance.js             REAL derivation + REAL writer
//   * PostgreSQL 17.4, migration 020 applied REAL, and disposable
//
// FAKE, and named rather than implied: the model `consult` call (a gateway
// call this order's `network: none` forbids, and which rulebook.js's own tests
// stub for the same reason), and the surrounding durable store, which is the
// offline `fakePg.js` exactly as `finalise/produceFinalList.mjs` already uses
// for the whole journey. ONLY the provenance ledger is routed to real Postgres,
// because that ledger is the thing under test.
//
// ── SHARED CLUSTER. EVERY ASSERTION IS SCOPED TO THIS RUN'S OWN SHOP ─────
// The disposable target is shared with other lanes and moves underneath this
// test: at the time of writing it already held 98 shops and PHOTO 9 / WARWICK 5
// / REGULARS 62 rows written by other work. Lane C was bitten by exactly this.
// So nothing here asserts global emptiness or a global count - every query
// carries `WHERE shop_id = <the shop this run created>`, and the schema is a
// throwaway one this file creates and drops.
//
// HOW TO RUN (throwaway/local Postgres only, never live):
//   ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE=1 \
//     ASDAIR_DB_URL=postgresql://postgres@127.0.0.1:55432/asdair_test \
//     node --test test/planProvenanceProductionSeam.dbtest.js
//
// PURE ASCII only.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { assertSafeDbTarget, destructiveTestsEnabled } from './dbSafeTarget.mjs';
import { applyThrowawaySchema, dropThrowawaySchema } from './dbtestSchema.mjs';
import { createFakeDatabase, createFakeClient } from './fakePg.js';
import { planWithDecisions } from '../runPipeline.js';
import { derivePlanProvenance, NON_PHOTO_KINDS } from '../planProvenance.js';
import { questionKeyFor } from '../keys.js';

const require = createRequire(import.meta.url);
const { planBasket } = require('../../skill/planner.js');

const DB_URL = process.env.ASDAIR_DB_URL;
const OPTED_IN = destructiveTestsEnabled();

const gate = (OPTED_IN && DB_URL)
  ? { skip: false }
  : {
    skip: !OPTED_IN
      ? 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE not set to 1|true -- destructive Postgres test skipped (no-op)'
      : 'ASDAIR_DB_URL not set -- Postgres test skipped (no-op)',
  };

const SCHEMA = 'asdair_test_wo_b15_46_plan_seam';

/** Routes ONLY the provenance ledger at real Postgres; everything else stays on
 *  the offline store. `asdair.` is rewritten to the throwaway schema, which is
 *  the convention provenanceProductionSeam.dbtest.js already established. */
function hybridQuery(pgClient, fakeClient) {
  return async (sql, params) => {
    if (/shop_line_provenance/i.test(sql)) {
      return pgClient.query(sql.replace(/asdair\./g, `${SCHEMA}.`), params);
    }
    return fakeClient.query(sql, params);
  };
}

test('AC1/AC3: the REAL planWithDecisions writes REGULARS, RULE and WARWICK rows to real Postgres', gate, async (t) => {
  assertSafeDbTarget(DB_URL);
  const { Client } = require('pg');
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  try {
    await dropThrowawaySchema(pg, SCHEMA);
    await applyThrowawaySchema(pg, SCHEMA);

    // ── REAL ROWS FIRST. `matched_regular_id` is a genuine FOREIGN KEY, so a
    //    fixture citing an invented id is refused by the database - correctly.
    const household = (await pg.query(
      `INSERT INTO ${SCHEMA}.households (name) VALUES ('Test Household - WP-B15-46') RETURNING id`,
    )).rows[0];
    const shop = (await pg.query(
      `INSERT INTO ${SCHEMA}.shop (household_id, shop_ref, source_kind)
       VALUES ($1, 'SHOP-TEST-B15-46', 'photo') RETURNING id`, [household.id],
    )).rows[0];
    const sausages = (await pg.query(
      `INSERT INTO ${SCHEMA}.regulars (household_id, name, active)
       VALUES ($1, 'Richmond Thick Pork Sausages 16 Pack', true) RETURNING id`, [household.id],
    )).rows[0];
    const milk = (await pg.query(
      `INSERT INTO ${SCHEMA}.regulars (household_id, name, active)
       VALUES ($1, 'Arla Semi Skimmed Milk 4 Pints', true) RETURNING id`, [household.id],
    )).rows[0];

    // ── THE OFFLINE DURABLE STORE, seeded so the real reads inside
    //    planWithDecisions find this shop's rows.
    const store = createFakeDatabase({
      shop: [{
        id: shop.id, household_id: household.id, shop_ref: 'SHOP-TEST-B15-46',
        status: 'PROCESSING', list_id: 1, needs_review: false, source_kind: 'photo',
      }],
    });
    const fake = createFakeClient(store, {});

    // A question Warwick actually answered, and the decision he recorded. Both
    // are ordinary rows; applyDecisionsToPlan reads them through the real
    // shopDecisions.listDecisions.
    const decidedItem = 'arla semi skimmed milk';
    store.db.shop_question.push({
      id: 1, shop_id: shop.id, question_key: questionKeyFor(decidedItem),
      question_text: 'Which Arla milk did you mean?', status: 'answered',
      list_item_id: 2, answer_text: 'the 4 pint one', round: 1,
    });
    store.db.shop_decision.push({
      id: 1, shop_id: shop.id, question_id: 1, decision_kind: 'existing_regular',
      decided_regular_id: milk.id, decided_quantity: null, decided_item_name: null,
      clarification_reason: null, forward_intent: null, round: 1,
      question_key: questionKeyFor(decidedItem),
    });

    const regulars = [
      {
        id: Number(sausages.id), household_id: Number(household.id),
        name: 'Richmond Thick Pork Sausages 16 Pack', brand: 'Richmond',
        category: 'meat', aka: ['richmond sausages'], typical_qty: 1, active: true,
      },
      {
        id: Number(milk.id), household_id: Number(household.id),
        name: 'Arla Semi Skimmed Milk 4 Pints', brand: 'Arla',
        category: 'dairy', aka: ['arla semi skimmed milk', 'arla 4pt'], typical_qty: 2, active: true,
      },
    ];
    const catalogue = {
      household_id: Number(household.id),
      candidates: regulars.map((r) => ({
        id: r.id, name: r.name, brand: r.brand, category: r.category, aka: r.aka, typical_qty: r.typical_qty,
      })),
      regularsById: new Map(regulars.map((r) => [r.id, r])),
      rules: [], last_order: null, regulars,
    };

    // THE LIST. Neither line has a shop_line behind it - `db.shop_line` is empty
    // for this shop - so by construction neither came off a photograph. That is
    // what makes them REGULARS origins, and it is derived from the durable rows
    // rather than declared.
    const listItems = [
      { id: 1, item_name: 'Richmond Thick Pork Sausages 16 Pack', requested_qty: 1, status: 'requested' },
      { id: 2, item_name: 'arla semi skimmed milk', requested_qty: 2, status: 'requested' },
    ];

    // A household rule with WORDS, and a consult that judges it. The rule is
    // `info` - precisely the judgement layer that `actionableRules()` drops and
    // that skill/rulebook.js exists to carry.
    const rules = [{
      id: 91, household_id: Number(household.id), kind: 'info',
      match_term: 'richmond', match_category: null, matched_product: null,
      rule_text: 'Richmond sausages: buy two packs when they are on the list.',
      active: true,
    }];

    const deps = {
      planBasket,
      readQuery: hybridQuery(pg, fake),
      writeQuery: hybridQuery(pg, fake),
      log: () => {},
      // The judgement shape is the rulebook's own contract, and `kind` is
      // mandatory: an entry without one is REJECTED as "unknown judgement kind
      // - treated as ask", which is the module failing safe rather than
      // guessing. An earlier draft of this test omitted it and got zero RULE
      // rows; the module was right and the fixture was wrong.
      consult: async () => ({
        judgements: [{
          line_no: 1, rule_id: 91, kind: 'set_quantity', quantity: 2,
          why: 'the household rule says two packs',
        }],
      }),
    };

    const shopRow = {
      id: shop.id, household_id: household.id, shop_ref: 'SHOP-TEST-B15-46',
      status: 'PROCESSING', list_id: 1, needs_review: false,
    };

    let result;
    await t.test('the production function runs and reports what it wrote', async () => {
      result = await planWithDecisions(deps, shopRow, {
        listItems,
        inputs: {
          rules, products: [], regulars, budget: null, lastOrder: null, priorAnswers: [],
        },
        catalogue,
      });
      assert.ok(result.provenance, 'planWithDecisions must report its provenance write');
      assert.ok(result.provenance.written.length > 0,
        'the production caller wrote NOTHING - that is the exact HOLD this work package exists to discharge');
    });

    // ── THE ACCEPTANCE: rows read back out of Postgres, BY KIND, scoped to
    //    the shop THIS run created.
    let rows;
    await t.test('all three non-photo kinds are in the database, written by production code', async () => {
      rows = (await pg.query(
        `SELECT id, provenance, line_no, matched_regular_id, quantity, raw_text, source_region_id
           FROM ${SCHEMA}.shop_line_provenance WHERE shop_id = $1 ORDER BY id`, [shop.id],
      )).rows;

      const kinds = [...new Set(rows.map((r) => r.provenance))].sort();
      assert.deepEqual(kinds, ['REGULARS', 'RULE', 'WARWICK'],
        `expected all three non-photo kinds persisted by the production path; got ${JSON.stringify(kinds)}`);

      // AC3 - each kind carries its OWN identity, not PHOTO's.
      const regularsRows = rows.filter((r) => r.provenance === 'REGULARS');
      assert.ok(regularsRows.length > 0);
      for (const r of regularsRows) {
        assert.ok(r.matched_regular_id !== null,
          'a REGULARS row names the household product it came from - migration 020 requires it');
      }

      const ruleRows = rows.filter((r) => r.provenance === 'RULE');
      assert.equal(ruleRows.length, 1, 'one household rule fired, so one RULE row');
      assert.match(ruleRows[0].raw_text, /rule 91/, 'a RULE row must say which rule put the line there');
      assert.equal(Number(ruleRows[0].quantity), 2, 'the RULE row records the quantity the rule set');

      const warwickRows = rows.filter((r) => r.provenance === 'WARWICK');
      assert.equal(warwickRows.length, 1, 'one recorded decision was applied, so one WARWICK row');
      assert.equal(Number(warwickRows[0].matched_regular_id), Number(milk.id),
        'the WARWICK row names the product HE chose');
    });

    // ── AC2 - THE CONVERSE. Nothing on this journey may claim photo truth.
    await t.test('AC2: the production path cannot record a non-photo line as PHOTO', async () => {
      for (const r of rows) {
        assert.notEqual(r.provenance, 'PHOTO',
          'planWithDecisions emitted a PHOTO row; only the photo interpreter, which holds region ids, may');
        assert.equal(r.source_region_id, null,
          'a non-photo row must not cite a photograph region');
      }
      assert.ok(!NON_PHOTO_KINDS.includes('PHOTO'),
        'planProvenance.js must not even name PHOTO as a kind it can produce');
    });

    await t.test('AC2: the DATABASE refuses a PHOTO row with no citable region, not just the code', async () => {
      // Straight past every application guard, as AC3 of the sibling proof does
      // deliberately - this must be the DATABASE refusing, never our politeness.
      await assert.rejects(
        () => pg.query(
          `INSERT INTO ${SCHEMA}.shop_line_provenance
             (shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text)
           VALUES ($1, 'PHOTO', NULL, 'some-model', 'v1', 'a catalogue item pretending to be on the page')`,
          [shop.id],
        ),
        (err) => {
          assert.equal(err.code, '23514', `expected a CHECK violation, got ${err.code}`);
          assert.match(String(err.constraint), /region_iff_photo/);
          return true;
        },
        'the database accepted a PHOTO row with no region - clause 2 is not enforced',
      );
    });

    await t.test('AC2: the DATABASE refuses a PHOTO row citing ANOTHER shop\'s region', async () => {
      const other = (await pg.query(
        `INSERT INTO ${SCHEMA}.shop (household_id, shop_ref, source_kind)
         VALUES ($1, 'SHOP-TEST-B15-46-OTHER', 'photo') RETURNING id`, [household.id],
      )).rows[0];
      const foreignRegion = (await pg.query(
        `INSERT INTO ${SCHEMA}.shop_image_region
           (shop_id, region_no, region_kind, image_fingerprint)
         VALUES ($1, 1, 'full_page', 'a1b2c3d4e5f60718') RETURNING id`, [other.id],
      )).rows[0];

      await assert.rejects(
        () => pg.query(
          `INSERT INTO ${SCHEMA}.shop_line_provenance
             (shop_id, provenance, source_region_id, interpreter_model, prompt_version, raw_text)
           VALUES ($1, 'PHOTO', $2, 'some-model', 'v1', 'a line from someone else photograph')`,
          [shop.id, foreignRegion.id],
        ),
        (err) => {
          assert.equal(err.code, '23503', `expected an FK violation, got ${err.code}`);
          return true;
        },
        'a shop was able to cite another shop photograph as its source',
      );
    });

    // ── IDEMPOTENCE. planWithDecisions runs at EVERY recomputation; a second
    //    pass must record nothing new, or the ledger becomes noise.
    await t.test('a second recomputation writes NO duplicate rows', async () => {
      const before = rows.length;
      const again = await planWithDecisions(deps, shopRow, {
        listItems,
        inputs: { rules, products: [], regulars, budget: null, lastOrder: null, priorAnswers: [] },
        catalogue,
      });
      assert.equal(again.provenance.written.length, 0, 'a recomputation wrote new rows');
      assert.ok(again.provenance.skipped > 0, 'the idempotence guard did not report skipping anything');

      const after = (await pg.query(
        `SELECT count(*)::int AS n FROM ${SCHEMA}.shop_line_provenance WHERE shop_id = $1`, [shop.id],
      )).rows[0].n;
      assert.equal(after, before, `row count moved from ${before} to ${after} on a pure recomputation`);
    });
  } finally {
    await dropThrowawaySchema(pg, SCHEMA).catch(() => {});
    await pg.end();
  }
});

// =====================================================================
// THE DERIVATION ITSELF - made to fail, not merely exercised.
// =====================================================================

test('AC2 mutation: derivePlanProvenance can never construct a PHOTO row', () => {
  const regularsById = new Map([[7, { id: 7, name: 'Some Regular' }]]);
  const { rows } = derivePlanProvenance({
    shopId: 1,
    listItems: [{ id: 1, item_name: 'Some Regular', requested_qty: 1 }],
    shopLines: [],
    plan: { items: [{ item_name: 'Some Regular', matched_product: 'Some Regular', requested_qty: 1 }] },
    rulebookAudit: { applied: [{ line_no: 1, rule_id: 5, kind: 'set_quantity', item_name: 'Some Regular', to: 2 }] },
    decisionsApplied: [{ item_name: 'Some Regular', question_key: 'qabcd', kind: 'existing_regular', regular_id: 7 }],
    regularsById,
  });

  assert.equal(rows.length, 3, 'one origin of each kind should have been derived');
  for (const r of rows) {
    assert.notEqual(r.provenance, 'PHOTO');
    assert.equal(r.source_region_id, null);
  }
  assert.deepEqual([...new Set(rows.map((r) => r.provenance))].sort(), ['REGULARS', 'RULE', 'WARWICK']);
});

test('AC1: a list line that DID come off the photograph is NOT recorded as REGULARS', () => {
  const regularsById = new Map([[7, { id: 7, name: 'Some Regular' }]]);
  const args = {
    shopId: 1,
    listItems: [{ id: 1, item_name: 'Some Regular', requested_qty: 1 }],
    shopLines: [{ line_no: 1, list_item_id: 1, raw_reading: 'SOME REGULAR' }],
    plan: { items: [{ item_name: 'Some Regular', matched_product: 'Some Regular', requested_qty: 1 }] },
    rulebookAudit: null,
    decisionsApplied: [],
    regularsById,
  };
  assert.equal(derivePlanProvenance(args).rows.length, 0,
    'a photo-backed line must never be double-counted as a planner addition');

  // MADE TO FAIL: break the join and the REGULARS row appears. This is what
  // proves the shop_line check above is load-bearing rather than decorative.
  const orphaned = { ...args, shopLines: [{ line_no: 1, list_item_id: null, raw_reading: 'SOME REGULAR' }] };
  const out = derivePlanProvenance(orphaned).rows;
  assert.equal(out.length, 1);
  assert.equal(out[0].provenance, 'REGULARS');
});

test('AC1: an unresolvable line is DECLINED with a reason, never given an invented identity', () => {
  const { rows, declined } = derivePlanProvenance({
    shopId: 1,
    listItems: [{ id: 1, item_name: 'something we do not stock', requested_qty: 1 }],
    shopLines: [],
    plan: { items: [{ item_name: 'something we do not stock', matched_product: null, requested_qty: 1 }] },
    rulebookAudit: null,
    decisionsApplied: [],
    regularsById: new Map(),
  });
  assert.equal(rows.length, 0, 'a REGULARS row was written without a real household product');
  assert.equal(declined.length, 1);
  assert.match(declined[0].reason, /inventing an identity/);
});
