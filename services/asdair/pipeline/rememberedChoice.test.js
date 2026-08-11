// =====================================================================
// BUILD-015 AsdAIr WP-B15-3-M1 - rememberedChoice.test.js
//
// "WHEN THERE IS MORE THAN ONE VALID CHOICE, REMEMBER THE CHOICE I MADE LAST
//  TIME." - Warwick, 2026-08-09.
//
// AND THE HALF HE CARED ABOUT MOST, WHICH IS WHY IT IS FIRST IN THIS FILE:
//
//   "If the remembered product is unavailable or no longer a valid grounded
//    candidate, BEHAVE HONESTLY RATHER THAN FABRICATING A MATCH."
//
// A memory that resolves confidently to the wrong thing is worse than no
// memory, so the honest-failure cases are proved BEFORE the happy path - and
// they are proved to have EXECUTED, by asserting that a question was raised and
// that the basket did not change, never by asserting an absence alone.
//
// ── THE TEST DOUBLE FOR MIGRATION 018, AND WHY IT IS HERE ──────────────────
//
// `test/fakePg.js` models the statement shapes this pipeline emits and THROWS
// on one it does not know - deliberately, so a test cannot pass by silently
// running a query nobody modelled. It does not know migration 018's two
// statements, and it is OUTSIDE this Work Order's declared file_surface, so it
// could not be taught them here.
//
// `installRememberedChoiceTable` below is therefore a SECOND, NARROW model that
// serves exactly those two statements and delegates everything else to the real
// fake. It inherits fakePg's loud-failure property rather than softening it:
//
//   * it enforces EVERY constraint migration 018 declares, including the
//     COMPOSITE FOREIGN KEY to asdair.shop_decision (id, decision_kind) - which
//     is the whole mechanism by which "authorised, not accidental" is PROVED
//     rather than asserted, so a model that skipped it would prove nothing;
//   * it models `unique (source_decision_id)` as a real index, because "the
//     second insert wrote nothing" is only meaningful if the first is there;
//   * it models NO update and NO delete, because migration 018 grants neither
//     to anybody - so a statement that tried one would fall through and throw;
//   * ANY other statement naming asdair.remembered_choice THROWS.
//
// ⚠️ It is a model of 018, not a Postgres emulator, and it proves nothing about
// Postgres. Two constraints it cannot enforce are named at the point they would
// have applied: the FOREIGN KEY on chosen_regular_id -> asdair.regulars (the
// fake models no regulars table) and the exact Unicode behaviour of the
// normalisation CHECK.
//
// FULLY OFFLINE. No database, no network, no model call, no credentials.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeHarness, makeCatalogue, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import { normaliseTerm } from './keys.js';
import {
  AUTHORISED_BY, TERM_NORMALISER, REMEMBERABLE_KINDS, MIN_CANDIDATES, REMEMBERED_FLAG,
  buildRememberedChoice, decideToRemember, groundedCandidateIds, isNormalisedTerm,
  loadRememberedChoices, rememberChoice, resolveFromMemory, applyRememberedToPlan,
  _internal,
} from './rememberedChoice.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTOR = 'telegram:555';

// =====================================================================
// THE MIGRATION-018 TEST DOUBLE
// =====================================================================

/** Every CHECK migration 018 declares, in the order it declares them. */
function assertMigration018(row, db) {
  const bad = (c) => { throw new Error(`018 model: CHECK/FK ${c} violated`); };

  if (row.household_id === null || row.household_id === undefined) bad('household_id NOT NULL');
  if (row.choice_term === null || row.choice_term === undefined) bad('choice_term NOT NULL');
  if (row.term_normaliser === null || row.term_normaliser === undefined) bad('term_normaliser NOT NULL');
  if (row.chosen_regular_id === null || row.chosen_regular_id === undefined) bad('chosen_regular_id NOT NULL');
  if (row.chosen_at === null || row.chosen_at === undefined) bad('chosen_at NOT NULL (no default, deliberately)');
  if (row.source_shop_id === null || row.source_shop_id === undefined) bad('source_shop_id NOT NULL');
  if (row.source_decision_id === null || row.source_decision_id === undefined) bad('source_decision_id NOT NULL');

  const cands = Array.isArray(row.candidate_regular_ids) ? row.candidate_regular_ids : null;
  if (cands === null) bad('candidate_regular_ids NOT NULL');
  if (cands.some((c) => c === null || c === undefined)) bad('remembered_choice_candidates_are_ids');
  if (cands.length < 2) bad('remembered_choice_needs_an_ambiguity');
  if (!cands.map(Number).includes(Number(row.chosen_regular_id))) bad('remembered_choice_chosen_is_a_candidate');

  const t = String(row.choice_term);
  const normalised = t.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t !== normalised) bad('remembered_choice_term_normalised');
  if (t.trim() === '' || t.length > 200) bad('remembered_choice_term_shaped');
  if (String(row.term_normaliser).trim() === '' || String(row.term_normaliser).length > 80) {
    bad('remembered_choice_normaliser_shaped');
  }
  if (row.authorised_by !== 'standing-rule-2026-08-09') bad('remembered_choice_authorised_by_known');
  if (!['existing_regular', 'variant_choice'].includes(row.source_decision_kind)) {
    bad('remembered_choice_source_kind_known');
  }

  // ── THE COMPOSITE FOREIGN KEY. THE LOAD-BEARING ONE. ────────────────────
  // (source_decision_id, source_decision_kind) -> shop_decision (id,
  // decision_kind). This is what makes "this was an authorised standing
  // preference" PROVED by the database rather than asserted by a writer, and
  // it is why AC6's negative case is structural rather than conventional.
  const parent = (db.shop_decision || []).find((d) => String(d.id) === String(row.source_decision_id));
  if (!parent) bad('remembered_choice_decision_fk (no such decision)');
  if (String(parent.decision_kind) !== String(row.source_decision_kind)) {
    bad('remembered_choice_decision_fk (decision_kind does not match the sourcing decision)');
  }

  // NOT ENFORCED HERE, AND SAID RATHER THAN IMPLIED:
  //   * chosen_regular_id -> asdair.regulars(id). The fake models no regulars
  //     table, so this model cannot refuse an id the catalogue lacks. In
  //     Postgres that FK is what makes a fabricated match UNSTORABLE. The
  //     read-side guard (resolveFromMemory) is proved separately below and does
  //     not depend on it.
  //   * the exact Unicode behaviour of the normalisation CHECK - JS `\s` and
  //     Postgres `[[:space:]]` differ, which 018 records as a known residual.
}

/**
 * Serve migration 018's two statements over the harness's fake client.
 *
 * Returns the in-memory rows so a test can inspect what landed. Every other
 * statement - including any UPDATE or DELETE, which 018 grants to nobody -
 * falls through to fakePg and its loud "no handler" throw.
 */
function installRememberedChoiceTable(h) {
  const rows = [];
  let nextId = 0;
  const base = h.client;

  const serve = (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    if (!/asdair\.remembered_choice/i.test(text)) return null;

    if (/^INSERT INTO asdair\.remembered_choice \(/i.test(text)) {
      const cols = /INSERT INTO asdair\.remembered_choice\s*\(([^)]*)\)/i.exec(text)[1]
        .split(',').map((c) => c.trim());
      const row = {};
      cols.forEach((c, i) => { row[c] = params[i] === undefined ? null : params[i]; });
      assertMigration018(row, h.db);
      // unique (source_decision_id) - ON CONFLICT DO NOTHING.
      if (rows.some((r) => String(r.source_decision_id) === String(row.source_decision_id))) {
        return { rows: [], rowCount: 0 };
      }
      nextId += 1;
      const created = { id: nextId, created_at: '2026-08-09T00:00:00.000Z', ...row };
      rows.push(created);
      return { rows: [{ ...created }], rowCount: 1 };
    }

    // WP-B15-20: the statement no longer carries a term predicate - it selects
    // the household's rows and `distinct on (choice_term)` collapses each
    // term's history to its newest. The model follows the statement exactly,
    // INCLUDING the fact that it no longer filters by term: a model that kept
    // filtering would hide the very miss this Work Package fixes.
    if (/^SELECT DISTINCT ON \(choice_term\)/i.test(text)) {
      assert.doesNotMatch(text, /choice_term = ANY/i,
        'the model must track the statement: a term predicate here would defeat the separator-blind lookup');
      const [household] = params;
      const mine = rows.filter((r) => String(r.household_id) === String(household));
      const newestByTerm = new Map();
      for (const r of mine) {
        const prev = newestByTerm.get(r.choice_term);
        // ORDER BY choice_term, chosen_at DESC, id DESC - NEWEST WINS.
        const beats = !prev || (r.chosen_at === prev.chosen_at
          ? Number(r.id) > Number(prev.id)
          : r.chosen_at > prev.chosen_at);
        if (beats) newestByTerm.set(r.choice_term, r);
      }
      const out = [...newestByTerm.keys()].sort()
        .map((term) => ({ ...newestByTerm.get(term) }));
      return { rows: out, rowCount: out.length };
    }

    if (/^SELECT .* FROM asdair\.remembered_choice WHERE source_decision_id = \$1/i.test(text)) {
      const hits = rows.filter((r) => String(r.source_decision_id) === String(params[0])).map((r) => ({ ...r }));
      return { rows: hits, rowCount: hits.length };
    }

    throw new Error('018 model: no handler for a statement naming asdair.remembered_choice:\n' + text
      + '\nMigration 018 grants UPDATE and DELETE to NOBODY, so a mutating statement other than the '
      + 'single INSERT is not something this table can serve.');
  };

  h.deps.readQuery = async (sql, p = []) => serve(sql, p) || base.query(sql, p);
  h.deps.writeQuery = async (sql, p = []) => serve(sql, p) || base.query(sql, p);
  return rows;
}

// =====================================================================
// THE TWO-VARIANT HOUSEHOLD - a genuine, grounded, catalogue-level ambiguity
// =====================================================================

const ARIEL_A = {
  id: 21, name: 'Ariel 3-in-1 Pods 38pk', brand: 'Ariel', category: 'laundry',
  aka: ['ariel pods'], typical_qty: 1, asda_product_id: 'A21', substitutes_allowed: false,
};
const ARIEL_B = {
  id: 22, name: 'Ariel All-in-1 Pods 50pk', brand: 'Ariel', category: 'laundry',
  aka: ['ariel pods'], typical_qty: 1, asda_product_id: 'A22', substitutes_allowed: false,
};
const CAT_FOOD = {
  id: 11, name: 'Gourmet cat food', brand: 'Gourmet', category: 'pet',
  aka: ['gourmet cat food', 'gourmet'], typical_qty: 3, asda_product_id: 'A11', substitutes_allowed: false,
};

const AMBIGUOUS_CATALOGUE = () => makeCatalogue({ regulars: [CAT_FOOD, ARIEL_A, ARIEL_B] });
const LIST_TEXT = '3 gourmet cat food\nariel pods';

function shopHandle(ref) { return { shopRef: ref }; }

async function drain(h, ref, max = 12) {
  const steps = [];
  for (let i = 0; i < max; i += 1) {
    const r = await runPipeline(shopHandle(ref), h.deps);
    steps.push(r);
    if (!r.stepped) break;
  }
  return steps;
}

/**
 * Run ONE complete shop up to the point where it is either waiting on a human
 * or ready to go, with migration 018 served and the memory rows shared across
 * shops through `carry`.
 */
async function runShop(h, { ref, listDate, messageId, rows }) {
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate, sourceKind: 'text', rawText: LIST_TEXT,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: String(messageId),
  }, h.deps);
  await commands.buildShop({ shopRef: ref, actor: ACTOR }, h.deps);
  const steps = await drain(h, ref);
  return { steps, rows };
}

/** The shop row for a ref, from the fake database. */
const shopOf = (h, ref) => h.db.shop.find((s) => s.shop_ref === ref);
/** The open questions for a shop. */
const questionsOf = (h, ref) => h.db.shop_question.filter((q) => String(q.shop_id) === String(shopOf(h, ref).id));

// =====================================================================
// AC4 - HONEST FAILURE. FIRST, BECAUSE IT MATTERS MOST.
// =====================================================================

test('AC4: a remembered product that is NOT a grounded candidate this week is REFUSED, with a reason', () => {
  const memory = { id: 7, chosen_regular_id: 22, candidate_regular_ids: [21, 22] };

  // This week the resolver produced a DIFFERENT pair. 22 is simply not on the
  // table - it was delisted, renamed into a different row, or never resolved.
  const verdict = resolveFromMemory({
    memory, candidateIds: [21, 23], activeRegularIds: new Set([21, 22, 23]),
  });

  assert.equal(verdict.use, false, 'a memory whose product is not a candidate this week must NOT be used');
  assert.match(verdict.reason, /not a grounded candidate/i);
  assert.equal(verdict.regular_id, undefined, 'nothing may be resolved on a refusal');
});

test('AC4: it does NOT fall back to the nearest candidate, however similar the name', () => {
  // 24 is "Ariel All-in-1 Pods 50pk (New Pack)" - the SAME product to a human,
  // a different row to the catalogue. A near-match here is the exact failure
  // Warwick named: "behave honestly rather than fabricating a match."
  const memory = { id: 8, chosen_regular_id: 22, candidate_regular_ids: [21, 22] };
  const verdict = resolveFromMemory({
    memory, candidateIds: [21, 24], activeRegularIds: new Set([21, 24]),
  });
  assert.equal(verdict.use, false);
  assert.equal(verdict.regular_id, undefined,
    'a renamed or repacked near-match must never be substituted for the remembered product');
});

test('AC4: a remembered product that is no longer an ACTIVE regular is REFUSED', () => {
  const memory = { id: 9, chosen_regular_id: 22, candidate_regular_ids: [21, 22] };
  // It is still offered as a candidate, but it is no longer in the live
  // catalogue - loadCatalogue selects `active = true`, so absence IS retirement.
  const verdict = resolveFromMemory({
    memory, candidateIds: [21, 22], activeRegularIds: new Set([21]),
  });
  assert.equal(verdict.use, false);
  assert.match(verdict.reason, /no longer an active regular/i);
});

test('AC4: a line that is not an ambiguity this week is REFUSED even when a memory exists', () => {
  const memory = { id: 10, chosen_regular_id: 21, candidate_regular_ids: [21, 22] };
  const verdict = resolveFromMemory({
    memory, candidateIds: [21], activeRegularIds: new Set([21, 22]),
  });
  assert.equal(verdict.use, false, "one candidate is not the ambiguity Warwick's rule fires on");
  assert.match(verdict.reason, /not the ambiguity/i);
});

test('AC4: and when everything IS still true, it resolves - so the refusals above are not vacuous', () => {
  const memory = { id: 11, chosen_regular_id: 22, candidate_regular_ids: [21, 22] };
  const verdict = resolveFromMemory({
    memory, candidateIds: [21, 22], activeRegularIds: new Set([21, 22]),
  });
  assert.equal(verdict.use, true);
  assert.equal(verdict.regular_id, 22);
});

// =====================================================================
// AC6 - NO ACCIDENTAL PROMOTION. WARWICK'S OWN DISTINCTION, AS A NEGATIVE.
// =====================================================================

test('AC6: an ordinary one-week answer is NOT of the authorised kind and creates no memory', () => {
  const shop = { id: 1, household_id: HOUSEHOLD_ID, shop_ref: 'SHOP-2026-08-03' };
  const question = {
    item_name: 'ariel pods',
    candidates: [
      { label: 'A', regular_id: 21, source: 'asdair.regulars (resolveByCatalogue)' },
      { label: 'B', regular_id: 22, source: 'asdair.regulars (resolveByCatalogue)' },
    ],
  };

  // The four kinds that are an ANSWER but not a STANDING PREFERENCE.
  for (const kind of ['skip_this_week', 'new_item', 'quantity_change', 'clarification_required']) {
    const verdict = decideToRemember({
      shop,
      question,
      decision: { id: 5, decision_kind: kind, decided_regular_id: 21, interpreted_at: '2026-08-03T10:00:00Z' },
      normaliseTerm,
    });
    assert.equal(verdict.remember, false, `"${kind}" must never become a standing preference`);
    assert.match(verdict.reason, /not an authorised standing-preference kind/i);
  }

  // And the two that ARE, so the check above is not just refusing everything.
  for (const kind of REMEMBERABLE_KINDS) {
    const verdict = decideToRemember({
      shop,
      question,
      decision: { id: 5, decision_kind: kind, decided_regular_id: 21, interpreted_at: '2026-08-03T10:00:00Z' },
      normaliseTerm,
    });
    assert.equal(verdict.remember, true, `"${kind}" IS an authorised standing-preference kind`);
  }
});

test('AC6: a single-candidate resolution is not an ambiguity, so it is not remembered', () => {
  const verdict = decideToRemember({
    shop: { id: 1, household_id: HOUSEHOLD_ID },
    question: { item_name: 'ariel pods', candidates: [{ label: 'A', regular_id: 21 }] },
    decision: { id: 5, decision_kind: 'existing_regular', decided_regular_id: 21, interpreted_at: '2026-08-03T10:00:00Z' },
    normaliseTerm,
  });
  assert.equal(verdict.remember, false);
  assert.match(verdict.reason, /MORE THAN ONE valid choice/i);
});

test('AC6: there is NO boolean successor to applies_going_forward anywhere in this module', () => {
  const src = fs.readFileSync(path.join(HERE, 'rememberedChoice.js'), 'utf8');
  const sql = fs.readFileSync(path.join(HERE, '..', 'db', '018_remembered_choice.sql'), 'utf8');
  // The field that "silently discarded every answer Warwick ever gave" must not
  // be reintroduced under any name. It is the durability decision itself that
  // may not be a per-row flag; a comment naming the old field is fine.
  for (const [what, text] of [['the module', src], ['migration 018', sql]]) {
    assert.doesNotMatch(text, /\bapplies_going_forward\s+boolean/i, `${what} declares an applies_going_forward column`);
    assert.doesNotMatch(text, /\b(applies_going_forward|is_standing|remember_forward|applies_forward)\s*[:=]\s*(true|false)/i,
      `${what} carries a boolean durability flag - the exact instrument that failed`);
  }
  // The authorisation is a CLOSED VOCABULARY plus a composite FK, not a flag.
  assert.match(sql, /remembered_choice_authorised_by_known/);
  assert.match(sql, /remembered_choice_decision_fk/);
  assert.match(sql, /references asdair\.shop_decision \(id, decision_kind\)/i);
});

test('AC6: the writer refuses a kind, an authorisation and a candidate count the database would refuse', () => {
  const ok = {
    household_id: 1, choice_term: 'ariel pods', term_normaliser: TERM_NORMALISER,
    chosen_regular_id: 22, candidate_regular_ids: [21, 22], authorised_by: AUTHORISED_BY,
    source_decision_kind: 'variant_choice', chosen_at: '2026-08-03T10:00:00Z',
    source_shop_id: 1, source_decision_id: 5,
  };
  assert.ok(buildRememberedChoice(ok), 'the valid shape must build - or every refusal below proves nothing');

  const refuses = [
    ['source_decision_kind', { source_decision_kind: 'skip_this_week' }, /not one of/],
    ['authorised_by', { authorised_by: 'because-i-said-so' }, /standing authorisation/],
    ['one candidate', { candidate_regular_ids: [22] }, /MORE THAN ONE/],
    ['chosen not a candidate', { chosen_regular_id: 99, candidate_regular_ids: [21, 22] }, /not among its own candidates/],
    ['null in candidates', { candidate_regular_ids: [21, null] }, /must not contain null/],
    ['un-normalised term', { choice_term: 'Ariel  Pods!' }, /not normalised/],
    ['no chosen_at', { chosen_at: null }, /chosen_at is required/],
    ['no product id', { chosen_regular_id: null }, /required/],
  ];
  for (const [what, override, pattern] of refuses) {
    assert.throws(() => buildRememberedChoice({ ...ok, ...override }), pattern,
      `${what} must be refused before it reaches the database`);
  }
});

// =====================================================================
// AC5 - A PREFERENCE YIELDS. IT NEVER OVERRIDES.
// =====================================================================

const memoryFor = (term, id) => new Map([[term, {
  id: 1, choice_term: term, chosen_regular_id: id, candidate_regular_ids: [21, 22],
  chosen_at: '2026-08-03T10:00:00Z', source_shop_id: 1,
}]]);

const ACTIVE = new Map([[21, ARIEL_A], [22, ARIEL_B]]);

test('AC5: a hard EXCLUDE is never overridden - an excluded line is not in the unresolved set at all', () => {
  const plan = {
    items: [
      { item_name: 'ariel pods', status: 'excluded', planned_qty: 0, requested_qty: 1, flags: ['excluded by rule'] },
    ],
    summary: {},
  };
  // An excluded line never reaches `unresolved` - the planner did not ask for a
  // human, it removed the line. This is the structural half of the guarantee.
  const out = applyRememberedToPlan({
    plan, unresolved: [], memoriesByTerm: memoryFor('ariel pods', 22),
    candidateIdsByTerm: new Map([['ariel pods', [21, 22]]]),
    activeRegularIds: ACTIVE, normaliseTerm,
  });
  assert.equal(out.remembered.length, 0, 'a preference must never resurrect an excluded line');
  assert.equal(out.plan.items[0].status, 'excluded');
  assert.equal(out.plan.items[0].planned_qty, 0);
});

test('AC5: a line a MAP rule already resolved is never re-decided by a preference', () => {
  const plan = {
    items: [
      { item_name: 'ariel pods', status: 'add', matched_product: 'Mapped Own-Brand Pods', planned_qty: 1, requested_qty: 1, flags: ['mapped by rule'] },
    ],
    summary: {},
  };
  const out = applyRememberedToPlan({
    plan, unresolved: [], memoriesByTerm: memoryFor('ariel pods', 22),
    candidateIdsByTerm: new Map([['ariel pods', [21, 22]]]),
    activeRegularIds: ACTIVE, normaliseTerm,
  });
  assert.equal(out.remembered.length, 0);
  assert.equal(out.plan.items[0].matched_product, 'Mapped Own-Brand Pods',
    'a mapped product must not be replaced by a remembered one');
});

test('AC5: a live CLARIFICATION hold outranks the preference - it asks again', () => {
  const plan = {
    items: [{ item_name: 'ariel pods', status: 'needs_decision', planned_qty: 0, requested_qty: 1, flags: [] }],
    summary: {},
  };
  const unresolved = [{
    item_name: 'ariel pods', question_key: 'qdeadbeef', reason: 'clarification required',
    needs_clarification_round: true, question_round: 1,
  }];
  const out = applyRememberedToPlan({
    plan, unresolved, memoriesByTerm: memoryFor('ariel pods', 22),
    candidateIdsByTerm: new Map([['ariel pods', [21, 22]]]),
    activeRegularIds: ACTIVE, normaliseTerm,
  });
  assert.equal(out.remembered.length, 0,
    'Warwick answered and AsdAIr could not read it - a stored preference must not paper over that');
  assert.equal(out.unresolved.length, 1, 'the line must stay unresolved so the next round is opened');
  assert.equal(out.plan.items[0].status, 'needs_decision');
});

test('AC5: and on an ordinary unresolved line it DOES resolve - so the three refusals above are not vacuous', () => {
  const plan = {
    items: [{ item_name: 'ariel pods', status: 'needs_decision', planned_qty: 0, requested_qty: 1, flags: [] }],
    summary: {},
  };
  const unresolved = [{ item_name: 'ariel pods', question_key: 'qdeadbeef', reason: 'no structured decision recorded' }];
  const out = applyRememberedToPlan({
    plan, unresolved, memoriesByTerm: memoryFor('ariel pods', 22),
    candidateIdsByTerm: new Map([['ariel pods', [21, 22]]]),
    activeRegularIds: ACTIVE, normaliseTerm,
  });
  assert.equal(out.remembered.length, 1);
  assert.equal(out.unresolved.length, 0);
  assert.equal(out.plan.items[0].status, 'add');
  assert.equal(out.plan.items[0].decided_regular_id, 22);
  // THE NAME COMES FROM THE CATALOGUE BY ID, never from the memory row.
  assert.equal(out.plan.items[0].matched_product, ARIEL_B.name);
  assert.ok(out.plan.items[0].flags.includes(REMEMBERED_FLAG), 'the line must say WHY it resolved');
  assert.equal(out.remembered[0].reason, REMEMBERED_FLAG);
});

test('AC5: a preference carries no vocabulary with which to disobey', () => {
  const sql = fs.readFileSync(path.join(HERE, '..', 'db', '018_remembered_choice.sql'), 'utf8');
  const columns = sql.slice(sql.indexOf('create table if not exists asdair.remembered_choice'));
  const body = columns.slice(0, columns.indexOf('constraint remembered_choice_chosen_is_a_candidate'));
  for (const forbidden of ['directive', 'matched_product', 'exclude', 'quantity', 'price']) {
    assert.doesNotMatch(body, new RegExp(`^\\s{2}${forbidden}\\b`, 'mi'),
      `asdair.remembered_choice declares a "${forbidden}" column - it could then override a rule`);
  }
});

// =====================================================================
// AC2 + AC3 - THE JOURNEY. TWO SHOPS, THROUGH THE REAL ADVANCER.
// =====================================================================

test('AC2 JOURNEY: answering a genuine two-candidate ambiguity records a remembered choice', async () => {
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);
  const REF = 'SHOP-2026-08-03';

  await runShop(h, { ref: REF, listDate: '2026-08-03', messageId: 900, rows });

  const open = questionsOf(h, REF);
  assert.equal(open.length, 1, 'the two-variant line must reach a human exactly once');
  const question = open[0];
  const ids = groundedCandidateIds(question);
  assert.deepEqual(ids.sort(), [21, 22], 'the card must offer BOTH grounded variants');

  // Warwick taps the 50-pack.
  await commands.answerQuestion({
    shopRef: REF, actor: ACTOR, questionKey: question.question_key,
    answerText: ARIEL_B.name, answerSource: 'button',
  }, h.deps);
  await runPipeline(shopHandle(REF), h.deps);

  // THE CURRENT-SHOP DECISION IS UNTOUCHED - Warwick required that explicitly.
  assert.equal(h.db.shop_decision.length, 1, 'the current-shop decision must still be written');
  const decision = h.db.shop_decision[0];
  assert.equal(decision.decision_kind, 'existing_regular');
  assert.equal(Number(decision.decided_regular_id), 22);
  assert.equal(decision.interpreted_by, 'human', 'a tap spends no model call and records no model');
  assert.equal(h.db.shop_question[0].answer_text, ARIEL_B.name,
    "Warwick's exact words must survive the learning write");

  // AND THE MEMORY IS THE OTHER, SEPARATE ROW.
  assert.equal(rows.length, 1, 'the authorised choice produced no remembered_choice row');
  const memory = rows[0];
  assert.equal(memory.choice_term, 'ariel pods', 'the key must be the plain, readable, normalised term');
  assert.equal(memory.term_normaliser, TERM_NORMALISER);
  assert.equal(Number(memory.chosen_regular_id), 22);
  assert.deepEqual(memory.candidate_regular_ids.map(Number).sort(), [21, 22]);
  assert.equal(memory.authorised_by, AUTHORISED_BY);
  assert.equal(memory.source_decision_kind, 'existing_regular');
  assert.equal(String(memory.source_decision_id), String(decision.id),
    'provenance is a JOIN back to the decision, never a copy of it');
  // chosen_at is WHEN HE CHOSE, taken from the decision - not the write clock.
  assert.equal(memory.chosen_at, decision.interpreted_at);
  // NO product name is stored anywhere on the row.
  assert.equal('chosen_product_name' in memory, false);

  // IDEMPOTENT. A second pass over the same decision writes nothing.
  await runPipeline(shopHandle(REF), h.deps);
  assert.equal(rows.length, 1, 'a replayed pass minted a second, competing memory');
});

test('AC3 JOURNEY: a LATER shop resolves the same ambiguity with NO question raised', async () => {
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);

  // ── SHOP 1. It asks, and Warwick answers. ────────────────────────────────
  const REF1 = 'SHOP-2026-08-03';
  await runShop(h, { ref: REF1, listDate: '2026-08-03', messageId: 900, rows });
  const q1 = questionsOf(h, REF1);
  assert.equal(q1.length, 1, 'shop 1 must ask');
  await commands.answerQuestion({
    shopRef: REF1, actor: ACTOR, questionKey: q1[0].question_key,
    answerText: ARIEL_B.name, answerSource: 'button',
  }, h.deps);
  await drain(h, REF1);
  assert.equal(rows.length, 1, 'shop 1 must have left a remembered choice behind');

  // ── SHOP 2. The SAME ambiguity, a week later. ────────────────────────────
  const REF2 = 'SHOP-2026-08-10';
  const { steps } = await runShop(h, { ref: REF2, listDate: '2026-08-10', messageId: 901, rows });

  assert.equal(questionsOf(h, REF2).length, 0,
    'shop 2 asked the SAME question again - the remembered choice did not resolve it');

  const planStep = steps.find((s) => s.plan_summary);
  assert.ok(planStep, 'shop 2 never reached a plan');
  assert.equal(planStep.lines_unresolved.length, 0, 'nothing may still be held for a human');

  // AND IT NAMES THE REMEMBERED CHOICE AS ITS REASON.
  assert.equal(planStep.remembered_choices.length, 1);
  assert.equal(planStep.remembered_choices[0].item_name, 'ariel pods');
  assert.equal(planStep.remembered_choices[0].regular_id, 22);
  assert.equal(planStep.remembered_choices[0].reason, REMEMBERED_FLAG);
  assert.equal(String(planStep.remembered_choices[0].remembered_choice_id), String(rows[0].id));

  // THE LIST RESOLVED BEFORE BROWSER EXECUTION - the whole point.
  assert.equal(shopOf(h, REF2).status, 'READY_TO_SHOP',
    'the list must resolve before browser execution rather than asking again');
  assert.equal(planStep.plan_summary.needs_decision, 0);
});

test('AC4 JOURNEY: when the remembered product is gone this week, shop 2 ASKS AGAIN', async () => {
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);

  const REF1 = 'SHOP-2026-08-03';
  await runShop(h, { ref: REF1, listDate: '2026-08-03', messageId: 900, rows });
  const q1 = questionsOf(h, REF1);
  await commands.answerQuestion({
    shopRef: REF1, actor: ACTOR, questionKey: q1[0].question_key,
    answerText: ARIEL_B.name, answerSource: 'button',
  }, h.deps);
  await drain(h, REF1);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].chosen_regular_id), 22);

  // ── THE 50-PACK IS WITHDRAWN, AND A NEAR-MATCH TAKES ITS PLACE. ──────────
  // "Ariel All-in-1 Pods 52pk" is the same product to a human and a DIFFERENT
  // ROW to the catalogue. This is the case Warwick cared about most.
  const NEAR = {
    id: 23, name: 'Ariel All-in-1 Pods 52pk', brand: 'Ariel', category: 'laundry',
    aka: ['ariel pods'], typical_qty: 1, asda_product_id: 'A23', substitutes_allowed: false,
  };
  const nextCatalogue = makeCatalogue({ regulars: [CAT_FOOD, ARIEL_A, NEAR] });
  h.deps.loadCatalogue = async () => nextCatalogue;
  h.deps.loadPlanningInputs = async () => ({
    rules: [], products: [], regulars: [...nextCatalogue.regularsById.values()],
    budget: null, lastOrder: null, priorAnswers: [],
  });

  const REF2 = 'SHOP-2026-08-10';
  const { steps } = await runShop(h, { ref: REF2, listDate: '2026-08-10', messageId: 901, rows });

  // ── PROVE IT EXECUTED: A QUESTION, NOT A GUESS. ─────────────────────────
  const q2 = questionsOf(h, REF2);
  assert.equal(q2.length, 1, 'the shop must ASK AGAIN when the remembered product is gone');
  assert.deepEqual(groundedCandidateIds(q2[0]).sort(), [21, 23],
    'and it must ask about THIS WEEK\'S candidates');

  const planStep = steps.find((s) => s.plan_summary);
  assert.equal(planStep.remembered_choices.length, 0, 'nothing may have been resolved from memory');
  assert.equal(planStep.lines_unresolved.length, 1, 'the line must still be held for a human');

  // THE REFUSAL IS REPORTED, not silent - a refusal that says nothing is
  // indistinguishable from a memory that never existed.
  assert.equal(planStep.remembered_refused.length, 1);
  assert.match(planStep.remembered_refused[0].reason, /not a grounded candidate/i);

  // AND ABOVE ALL: THE NEAR-MATCH IS NOT IN THE BASKET.
  assert.notEqual(shopOf(h, REF2).status, 'READY_TO_SHOP',
    'a shop must never become ready on a fabricated match');
  const decisionsForShop2 = h.db.shop_decision.filter((d) => String(d.shop_id) === String(shopOf(h, REF2).id));
  assert.equal(decisionsForShop2.length, 0, 'no decision may be invented for an unanswered line');
  assert.equal(rows.length, 1, 'and no second memory may be minted from a guess');
});

// =====================================================================
// THE STORE, AND THE WIRING
// =====================================================================

test('the writer is INSERT-ONLY and idempotent on the sourcing decision', async () => {
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);
  // A sourcing decision must exist for the composite FK to be satisfiable.
  h.db.shop_decision.push({ id: 501, shop_id: 1, question_id: 1, decision_kind: 'variant_choice' });

  const spec = {
    household_id: HOUSEHOLD_ID, choice_term: 'ariel pods', term_normaliser: TERM_NORMALISER,
    chosen_regular_id: 22, candidate_regular_ids: [21, 22], authorised_by: AUTHORISED_BY,
    source_decision_kind: 'variant_choice', chosen_at: '2026-08-03T10:00:00Z',
    source_shop_id: 1, source_decision_id: 501,
  };

  const first = await rememberChoice(h.deps, spec);
  assert.equal(first.created, true);
  const second = await rememberChoice(h.deps, spec);
  assert.equal(second.created, false, 'a replay must resolve to the SAME row');
  assert.equal(second.already, true);
  assert.equal(String(second.choice.id), String(first.choice.id));
  assert.equal(rows.length, 1);

  // NO UPDATE AND NO DELETE EXIST TO EMIT.
  const src = fs.readFileSync(path.join(HERE, 'rememberedChoice.js'), 'utf8');
  assert.doesNotMatch(src, /UPDATE\s+asdair\.remembered_choice/i);
  assert.doesNotMatch(src, /DELETE\s+FROM\s+asdair\.remembered_choice/i);
  assert.match(_internal.INSERT_SQL, /ON CONFLICT \(source_decision_id\) DO NOTHING/i);
});

test('the reader returns the NEWEST row per term, and issues no statement when there is nothing to look up', async () => {
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);
  h.db.shop_decision.push(
    { id: 601, shop_id: 1, question_id: 1, decision_kind: 'variant_choice' },
    { id: 602, shop_id: 2, question_id: 2, decision_kind: 'variant_choice' },
  );
  const base = {
    household_id: HOUSEHOLD_ID, choice_term: 'ariel pods', term_normaliser: TERM_NORMALISER,
    candidate_regular_ids: [21, 22], authorised_by: AUTHORISED_BY,
    source_decision_kind: 'variant_choice', source_shop_id: 1,
  };
  await rememberChoice(h.deps, { ...base, chosen_regular_id: 21, chosen_at: '2026-08-03T10:00:00Z', source_decision_id: 601 });
  await rememberChoice(h.deps, { ...base, chosen_regular_id: 22, chosen_at: '2026-08-10T10:00:00Z', source_decision_id: 602 });
  assert.equal(rows.length, 2, 'a changed mind is a NEW ROW, never an edit');

  const found = await loadRememberedChoices(h.deps, HOUSEHOLD_ID, ['ariel pods']);
  assert.equal(found.size, 1);
  assert.equal(Number(found.get('ariel pods').chosen_regular_id), 22, 'newest wins');

  // An empty term list must not spend a query.
  let asked = 0;
  const counting = { readQuery: async () => { asked += 1; return { rows: [] }; } };
  assert.equal((await loadRememberedChoices(counting, HOUSEHOLD_ID, [])).size, 0);
  assert.equal(asked, 0, 'a plan with nothing unresolved must issue no memory read at all');
});

test('WIRING: the remembered choice is read inside planWithDecisions and written in decideAnswer', () => {
  // The D-1 guard, and this build has paid for it three times: a module that is
  // complete, tested and reachable only from its own test file is not shipped.
  const src = fs.readFileSync(path.join(HERE, 'runPipeline.js'), 'utf8');
  assert.match(src, /from '\.\/rememberedChoice\.js'/, 'runPipeline.js does not import the module at all');

  const from = src.indexOf('async function planWithDecisions');
  assert.notEqual(from, -1);
  const body = src.slice(from, src.indexOf('\n}', from));
  assert.match(body, /resolveRememberedChoices\s*\(/,
    'planWithDecisions does not resolve remembered choices, so a recomputation elsewhere would ignore them');

  const decide = src.indexOf('async function decideAnswer');
  assert.notEqual(decide, -1);
  const decideBody = src.slice(decide, src.indexOf('\n}\n', decide));
  assert.match(decideBody, /rememberIfAuthorised\s*\(/,
    'decideAnswer records no remembered choice, so nothing would ever be remembered');
});

test('an UNREADABLE memory store degrades VISIBLY: no line changes, and the reason is reported', async () => {
  // This is the shape of the first live run: migration 018 is AUTHORED, NOT
  // APPLIED, so asdair.remembered_choice does not exist yet. The plain harness
  // reproduces it exactly - fakePg has no handler for the statement and throws.
  const h = makeHarness({ catalogue: AMBIGUOUS_CATALOGUE() });
  const logged = [];
  h.deps.log = (event, detail) => logged.push({ event, detail });

  const REF = 'SHOP-2026-08-03';
  const { steps } = await runShop(h, { ref: REF, listDate: '2026-08-03', messageId: 900, rows: [] });

  // THE SHOP IS UNHARMED. It asks, exactly as it did before this existed.
  assert.equal(shopOf(h, REF).status, 'NEEDS_DECISION',
    'an unreadable preference store must never fail a shop that is otherwise correct');
  assert.equal(questionsOf(h, REF).length, 1, 'and the human is still asked');

  // AND THE DEGRADATION IS REPORTED, NEVER SILENT.
  const planStep = steps.find((s) => s.plan_summary);
  assert.equal(planStep.remembered_choices.length, 0);
  assert.equal(planStep.remembered_refused.length, 1);
  assert.match(planStep.remembered_refused[0].reason, /could not be read/i);
  assert.ok(logged.some((l) => l.event === 'remembered_choice_read_failed'),
    'a failure nobody can see is a failure nobody fixes - it must reach deps.log too');
});

test('the normalisation guard agrees with keys.normaliseTerm on the terms this module will see', () => {
  for (const raw of ['Ariel Pods', 'ariel  pods', ' ariel pods! ', 'M&S teabags', 'ARLA 4PT']) {
    const term = normaliseTerm(raw);
    assert.equal(isNormalisedTerm(term), true, `normaliseTerm("${raw}") is not its own fixed point`);
  }
  assert.equal(isNormalisedTerm('Ariel Pods'), false);
  assert.equal(MIN_CANDIDATES, 2);
});

// =====================================================================
// WP-B15-20 - THE MEMORY MUST AGREE WITH THE MATCHER
//
// WP-B15-13 made product MATCHING separator-blind, so "VANISH PRETREAT GEL"
// and "Vanish Pre-Treat Gel" name the same product. It did not touch pipeline/,
// so the MEMORY still disagreed:
//
//   normaliseTerm('VANISH PRETREAT GEL')  -> 'vanish pretreat gel'
//   normaliseTerm('Vanish Pre-Treat Gel') -> 'vanish pre treat gel'
//
// Same product, two keys, SQL exact equality - so the answer Warwick gave under
// one spelling was not found under the other and he was asked again.
//
// ⛔ THE KEY IS NOT FUZZY AND MUST NOT BECOME FUZZY. keys.normaliseTerm is
// untouched - it is data-shaped and mints question_key and idempotency_key, and
// migration 018:128 says "DO NOT MAKE THIS KEY FUZZY TO CLOSE THAT". What
// changed is the LOOKUP, and it applies the ONE shared matcher's own rule
// (skill/termMatch.js squashMatchText) rather than a second notion of sameness.
// =====================================================================

// TWO GENUINE VARIANTS BEHIND ONE ALIAS - the same shape as the ARIEL pair
// above, so the ambiguity is real and grounded rather than manufactured.
const VANISH_A = {
  id: 31, name: 'Vanish Pre-Treat Gel 500ml', brand: 'Vanish', category: 'laundry',
  aka: ['vanish pre-treat gel'], typical_qty: 1, asda_product_id: 'A31', substitutes_allowed: false,
};
const VANISH_B = {
  id: 32, name: 'Vanish Pre-Treat Gel 1L', brand: 'Vanish', category: 'laundry',
  aka: ['vanish pre-treat gel'], typical_qty: 1, asda_product_id: 'A32', substitutes_allowed: false,
};
const VANISH_CATALOGUE = () => makeCatalogue({ regulars: [CAT_FOOD, VANISH_A, VANISH_B] });

// THE TWO SPELLINGS, AS WARWICK ACTUALLY WROTE THEM (2026-08-10).
const SPELLING_CATALOGUE_WAY = 'Vanish Pre-Treat Gel';
const SPELLING_AS_HE_TYPED_IT = 'VANISH PRETREAT GEL';

/** `runShop`, but the list wording is the variable under test. */
async function runShopSpelled(h, { ref, listDate, messageId, spelling }) {
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate, sourceKind: 'text', rawText: `3 gourmet cat food\n${spelling}`,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: String(messageId),
  }, h.deps);
  await commands.buildShop({ shopRef: ref, actor: ACTOR }, h.deps);
  return drain(h, ref);
}

test('B15-20 FIXTURE: both spellings ground to the SAME candidate set, so the memory key is the only variable', async () => {
  // If this ever fails, the journey tests below stop proving what they claim -
  // a question in shop 2 would mean the RESOLVER missed, not the MEMORY.
  const h = makeHarness({ catalogue: VANISH_CATALOGUE() });
  installRememberedChoiceTable(h);

  for (const [i, spelling] of [SPELLING_CATALOGUE_WAY, SPELLING_AS_HE_TYPED_IT].entries()) {
    const ref = `SHOP-2026-09-0${i + 1}`;
    await runShopSpelled(h, { ref, listDate: `2026-09-0${i + 1}`, messageId: 950 + i, spelling });
    const q = questionsOf(h, ref);
    assert.equal(q.length, 1, `"${spelling}" did not reach a human as a two-variant ambiguity`);
    assert.deepEqual(groundedCandidateIds(q[0]).sort(), [31, 32],
      `"${spelling}" must offer BOTH grounded variants - B15-13's separator-blind matching`);
  }

  // AND THE KEYS GENUINELY DIFFER - which is the whole defect.
  assert.notEqual(normaliseTerm(SPELLING_AS_HE_TYPED_IT), normaliseTerm(SPELLING_CATALOGUE_WAY),
    'the two spellings must produce DIFFERENT memory keys, or this Work Package fixes nothing');
});

test('AC2 B15-20 JOURNEY: the choice he made under one spelling is FOUND under the other, and no question is opened', async () => {
  const h = makeHarness({ catalogue: VANISH_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);

  // ── SHOP 1. He writes it the catalogue way, and answers. ─────────────────
  const REF1 = 'SHOP-2026-08-03';
  await runShopSpelled(h, {
    ref: REF1, listDate: '2026-08-03', messageId: 900, spelling: SPELLING_CATALOGUE_WAY,
  });
  const q1 = questionsOf(h, REF1);
  assert.equal(q1.length, 1, 'shop 1 must ask');
  await commands.answerQuestion({
    shopRef: REF1, actor: ACTOR, questionKey: q1[0].question_key,
    answerText: VANISH_B.name, answerSource: 'button',
  }, h.deps);
  await drain(h, REF1);

  assert.equal(rows.length, 1, 'shop 1 must have left a remembered choice behind');
  assert.equal(rows[0].choice_term, 'vanish pre treat gel',
    'the stored key is keys.normaliseTerm output and is NOT squashed - the KEY did not become fuzzy');
  assert.equal(rows[0].term_normaliser, TERM_NORMALISER);

  // ── SHOP 2. THE SAME PRODUCT, SPELLED THE WAY HE ACTUALLY TYPED IT. ──────
  const REF2 = 'SHOP-2026-08-10';
  const steps = await runShopSpelled(h, {
    ref: REF2, listDate: '2026-08-10', messageId: 901, spelling: SPELLING_AS_HE_TYPED_IT,
  });

  assert.equal(questionsOf(h, REF2).length, 0,
    'HE WAS ASKED A QUESTION HE HAD ALREADY ANSWERED - the memory missed across the separator difference');

  const planStep = steps.find((s) => s.plan_summary);
  assert.ok(planStep, 'shop 2 never reached a plan');
  assert.equal(planStep.lines_unresolved.length, 0, 'nothing may still be held for a human');
  assert.equal(planStep.remembered_choices.length, 1, 'the remembered choice was not applied');
  assert.equal(planStep.remembered_choices[0].regular_id, 32,
    'it must resolve to the product he actually chose, by id');
  assert.equal(planStep.remembered_choices[0].reason, REMEMBERED_FLAG);
  assert.equal(String(planStep.remembered_choices[0].remembered_choice_id), String(rows[0].id),
    'and it must name the row it came from - provenance, not a guess');

  // THE LIST RESOLVED BEFORE BROWSER EXECUTION - Warwick's actual requirement.
  assert.equal(shopOf(h, REF2).status, 'READY_TO_SHOP');
  assert.equal(planStep.plan_summary.needs_decision, 0);
  assert.equal(rows.length, 1, 'a found memory must not mint a second, competing row');
});

test('AC3 + AC6 B15-20 JOURNEY: a refusal STILL refuses through the new lookup - and is now REPORTED, not silent', async () => {
  // The refusal must fire on the SEPARATOR-BLIND path, not only on the old
  // exact one: the memory is filed under "vanish pre treat gel", the list says
  // "VANISH PRETREAT GEL", and the remembered product is GONE this week.
  const h = makeHarness({ catalogue: VANISH_CATALOGUE() });
  const rows = installRememberedChoiceTable(h);

  const REF1 = 'SHOP-2026-08-03';
  await runShopSpelled(h, {
    ref: REF1, listDate: '2026-08-03', messageId: 900, spelling: SPELLING_CATALOGUE_WAY,
  });
  await commands.answerQuestion({
    shopRef: REF1, actor: ACTOR, questionKey: questionsOf(h, REF1)[0].question_key,
    answerText: VANISH_B.name, answerSource: 'button',
  }, h.deps);
  await drain(h, REF1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].choice_term, 'vanish pre treat gel');
  assert.equal(Number(rows[0].chosen_regular_id), 32);

  // ── THE 1L IS WITHDRAWN AND A NEAR-MATCH REPLACES IT. ────────────────────
  // Same product to a human, a different row to the catalogue.
  const NEAR = {
    id: 33, name: 'Vanish Pre-Treat Gel 1 Litre', brand: 'Vanish', category: 'laundry',
    aka: ['vanish pre-treat gel'], typical_qty: 1, asda_product_id: 'A33', substitutes_allowed: false,
  };
  const nextCatalogue = makeCatalogue({ regulars: [CAT_FOOD, VANISH_A, NEAR] });
  h.deps.loadCatalogue = async () => nextCatalogue;
  h.deps.loadPlanningInputs = async () => ({
    rules: [], products: [], regulars: [...nextCatalogue.regularsById.values()],
    budget: null, lastOrder: null, priorAnswers: [],
  });

  const REF2 = 'SHOP-2026-08-10';
  const steps = await runShopSpelled(h, {
    ref: REF2, listDate: '2026-08-10', messageId: 901, spelling: SPELLING_AS_HE_TYPED_IT,
  });

  // THE REFUSAL EXECUTED: a question, not a guess.
  const q2 = questionsOf(h, REF2);
  assert.equal(q2.length, 1, 'the shop must ASK AGAIN when the remembered product is gone');
  assert.deepEqual(groundedCandidateIds(q2[0]).sort(), [31, 33], "and about THIS WEEK'S candidates");

  const planStep = steps.find((s) => s.plan_summary);
  assert.equal(planStep.remembered_choices.length, 0, 'nothing may be resolved from a withdrawn memory');
  assert.equal(planStep.lines_unresolved.length, 1, 'the line must still be held for a human');

  // ── AC6. THIS IS THE ASSERTION THE OLD CODE COULD NOT PASS. ──────────────
  // Under exact-equality keying the memory was never found, `memories.has`
  // was false, and NO refused entry was emitted - the miss was invisible, which
  // is how it survived unnoticed. It must now be reported.
  assert.equal(planStep.remembered_refused.length, 1,
    'a memory that exists and is not used must be REPORTED - a silent miss is how this survived');
  assert.match(planStep.remembered_refused[0].reason, /not a grounded candidate/i);

  // AND ABOVE ALL: NO FABRICATED MATCH.
  assert.notEqual(shopOf(h, REF2).status, 'READY_TO_SHOP',
    'a shop must never become ready on a near-match the human did not choose');
  assert.equal(rows.length, 1, 'no second memory may be minted from a guess');
});

// =====================================================================
// WP-B15-20 UNIT PROOFS - the lookup itself, with an injected readQuery.
// No harness, no database, no statement modelling: `loadRememberedChoices`
// takes `deps.readQuery`, so the boundary is the injection point.
// =====================================================================

/** A `deps` whose read returns exactly these stored rows, counting its calls. */
function storeOf(rows) {
  const calls = [];
  return {
    calls,
    deps: {
      readQuery: async (sql, params) => {
        calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
        return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
      },
    },
  };
}

const memRow = (over) => ({
  id: 1, household_id: HOUSEHOLD_ID, choice_term: 'vanish pre treat gel',
  term_normaliser: TERM_NORMALISER, chosen_regular_id: 32, candidate_regular_ids: [31, 32],
  authorised_by: AUTHORISED_BY, source_decision_kind: 'variant_choice',
  chosen_at: '2026-08-03T10:00:00Z', source_shop_id: 1, source_decision_id: 601, ...over,
});

test('B15-20: the Map is keyed on the REQUESTED term, never on the stored spelling', async () => {
  const { deps } = storeOf([memRow()]);
  const asked = normaliseTerm(SPELLING_AS_HE_TYPED_IT); // 'vanish pretreat gel'
  const found = await loadRememberedChoices(deps, HOUSEHOLD_ID, [asked]);

  assert.equal(found.size, 1, 'the separator difference must not hide the memory');
  assert.ok(found.has(asked),
    'applyRememberedToPlan reads by the term the PLAN LINE produced - the Map must answer to that key');
  assert.equal(found.has('vanish pre treat gel'), false,
    'keying on the STORED spelling is the half-fix: it finds the row and then misses it on the Map');
  assert.equal(Number(found.get(asked).chosen_regular_id), 32);
  // The stored row is handed back UNCHANGED - nothing squashed is written.
  assert.equal(found.get(asked).choice_term, 'vanish pre treat gel',
    'the stored key must travel intact; only the SEARCH is separator-blind');
});

test('B15-20 AC4: a digit-to-digit separator is NEVER removed, so 1.5L is not 15L', async () => {
  // The guard belongs to squashMatchText (termMatch.js:164-176). This asserts
  // it survives THROUGH the lookup, so a future edit here cannot quietly lose
  // it and start resolving a 15 litre drum from a 1.5 litre memory.
  const { deps } = storeOf([memRow({ choice_term: 'coca cola 1 5l', chosen_regular_id: 41 })]);

  const wrong = await loadRememberedChoices(deps, HOUSEHOLD_ID, [normaliseTerm('Coca Cola 15L')]);
  assert.equal(wrong.size, 0,
    'a 1.5 litre bottle and a 15 litre drum are not the same purchase');

  const right = await loadRememberedChoices(deps, HOUSEHOLD_ID, [normaliseTerm('Coca-Cola 1.5L')]);
  assert.equal(right.size, 1, 'and the genuine separator difference must still resolve');
  assert.equal(Number(right.get('coca cola 1 5l').chosen_regular_id), 41);
});

test('B15-20: SEPARATOR-BLIND IS NOT FUZZY - a misspelling is still a miss', async () => {
  const { deps } = storeOf([memRow()]);
  for (const miss of ['vanish pretreet gel', 'vanish pre treat', 'vanish gel', 'vanish pre treat gels']) {
    const found = await loadRememberedChoices(deps, HOUSEHOLD_ID, [miss]);
    assert.equal(found.size, 0, `"${miss}" must NOT resolve - this is a lookup, not a similarity measure`);
  }
});

test('B15-20: when two stored spellings collide, the NEWEST wins - the statement\'s own precedence', async () => {
  // Squashing can make two DIFFERENT stored terms compete for one lookup.
  // Ruled: inherit ORDER BY chosen_at DESC, id DESC rather than invent a rule.
  const older = memRow({
    id: 5, choice_term: 'vanish pre treat gel', chosen_regular_id: 31, chosen_at: '2026-08-03T10:00:00Z',
  });
  const newer = memRow({
    id: 6, choice_term: 'vanish pretreat gel', chosen_regular_id: 32, chosen_at: '2026-08-10T10:00:00Z',
  });

  for (const rows of [[older, newer], [newer, older]]) {
    const { deps } = storeOf(rows);
    const found = await loadRememberedChoices(deps, HOUSEHOLD_ID, ['vanish pre treat gel']);
    assert.equal(Number(found.get('vanish pre treat gel').chosen_regular_id), 32,
      'the most recent preference must win regardless of the order rows arrive in');
  }

  // Same instant - the higher id is the later row.
  const sameA = memRow({ id: 8, choice_term: 'vanish pre treat gel', chosen_regular_id: 31, chosen_at: 'T' });
  const sameB = memRow({ id: 9, choice_term: 'vanishpretreat gel', chosen_regular_id: 32, chosen_at: 'T' });
  const { deps } = storeOf([sameB, sameA]);
  const tie = await loadRememberedChoices(deps, HOUSEHOLD_ID, ['vanish pre treat gel']);
  assert.equal(Number(tie.get('vanish pre treat gel').chosen_regular_id), 32, 'id desc breaks the tie');
});

test('B15-20: the statement carries NO term predicate, and still scopes to the household', async () => {
  const { calls, deps } = storeOf([memRow()]);
  await loadRememberedChoices(deps, HOUSEHOLD_ID, ['vanish pretreat gel']);

  assert.equal(calls.length, 1, 'ONE statement per plan, never one per line');
  assert.doesNotMatch(calls[0].sql, /choice_term = ANY/i,
    'a SQL term predicate cannot express the digit guard without a third copy of the rule');
  assert.match(calls[0].sql, /WHERE household_id = \$1/i,
    "there is no global scope in Warwick's rule, and the index's leading column is household_id");
  assert.match(calls[0].sql, /DISTINCT ON \(choice_term\)/i);
  assert.match(calls[0].sql, /ORDER BY choice_term, chosen_at DESC, id DESC/i);
  assert.deepEqual(calls[0].params, [HOUSEHOLD_ID], 'the household is the only parameter now');
});

test('B15-20: the shared matcher is IMPORTED, not reimplemented', async () => {
  // The defect being fixed was a SECOND normaliser. A third one - even a
  // correct one - would be the same mistake again, so this pins the source.
  const src = fs.readFileSync(path.join(HERE, 'rememberedChoice.js'), 'utf8');
  assert.match(src, /requireCjs\('\.\.\/skill\/termMatch\.js'\)/,
    'the separator-blind rule must come from skill/termMatch.js, the ONE shared matcher');
  assert.doesNotMatch(src, /function squashMatchText/,
    'a local copy of squashMatchText is the defect wearing a third hat');

  // And keys.normaliseTerm is untouched: the KEY did not become fuzzy.
  const keysSrc = fs.readFileSync(path.join(HERE, 'keys.js'), 'utf8');
  assert.match(keysSrc, /\.replace\(\/\[\^a-z0-9&\\s\]\/g, ' '\)/,
    'keys.normaliseTerm must still flatten punctuation to SPACES - it mints question_key and idempotency_key');
});
