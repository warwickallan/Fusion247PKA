// =====================================================================
// BUILD-015 AsdAIr WP-B15-3-M1 - pipeline/rememberedChoice.js
//
// THE HOUSEHOLD'S REMEMBERED LAST CHOICE (migration 018,
// asdair.remembered_choice).
//
// Warwick, 2026-08-09:
//
//   "WHEN THERE IS MORE THAN ONE VALID CHOICE, REMEMBER THE CHOICE I MADE LAST
//    TIME. ... use that last choice so the list can resolve BEFORE browser
//    execution rather than asking me the same choice again. ... It is a
//    PREFERENCE, NOT PERMISSION to invent products or ignore hard exclusions.
//    If the remembered product is unavailable or no longer a valid grounded
//    candidate, behave honestly rather than fabricating a match."
//
// Two halves, and they are deliberately different in kind:
//
//   WRITE  - `rememberChoice`. Derived from a shop_decision that has already
//            been recorded. Idempotent on source_decision_id.
//   READ   - `loadRememberedChoices` + the PURE `applyRememberedToPlan`. The
//            impure half is one SELECT; every judgement about whether a memory
//            may be used is pure and testable without a database.
//
// ── THE ONE RULE THAT GOVERNS THIS WHOLE MODULE ────────────────────────────
//
//   A MEMORY THAT RESOLVES CONFIDENTLY TO THE WRONG THING IS WORSE THAN NO
//   MEMORY.
//
// So there is NO near-match anywhere on this path, no closest-thing-available,
// no renamed-product tolerance and no least-bad fallback. A memory is applied
// ONLY when the remembered product is, this week, in the line's own grounded
// candidate set AND still an active regular. Anything else asks Warwick again.
// That is `resolveFromMemory` below, and it is the first thing this module was
// written to get right.
//
// ── A PREFERENCE YIELDS. IT NEVER OVERRIDES. ───────────────────────────────
// This module only ever looks at lines the plan has ALREADY left genuinely
// unresolved - a line the planner held for a human, with no structured
// decision recorded, and not awaiting a clarification. It therefore cannot
// reach a line that a hard `exclude` removed, a `map` rule resolved, or a
// `clarification_required` decision is holding. That is structural, not a
// promise: see `applyRememberedToPlan`'s guards and the four AC5 proofs in
// rememberedChoice.test.js.
//
// ── WHAT IT CANNOT DO, BY CONSTRUCTION ─────────────────────────────────────
// The table carries one asdair.regulars id and NO directive vocabulary. There
// is no way to spell an exclusion, a mapping, an invented product or a
// quantity change in a remembered choice, so "a preference, not permission" is
// an absence of columns rather than a rule anybody has to remember.
//
// ── NO BOOLEAN. NOT EVER. ──────────────────────────────────────────────────
// `asdair.rule_qa_log.applies_going_forward` was a filter a writer had to
// remember to set, defaulting to the value that discarded everything - so
// "every answer Warwick ever gave was written, read back, and discarded"
// (017's own header). There is NO boolean successor here. Every row in
// asdair.remembered_choice is, by construction, a remembered choice, and the
// AUTHORISED-vs-ACCIDENTAL distinction is carried by a composite foreign key
// to shop_decision (id, decision_kind) - PROVED by the database, never
// asserted by this module.
// =====================================================================

// ── THE ONE SHARED MATCHER, REACHED OUTWARD (WP-B15-20) ────────────────────
//
// `squashMatchText` is WP-B15-13's separator-blind normal form, and it is the
// household's ONE notion of "the same product spelled differently". It is
// IMPORTED, never reimplemented: a second copy in this file - whose entire
// defect was that a second normaliser existed - would be the same mistake
// wearing a third hat (skill/termMatch.js:20-22, migration 018:128-133).
//
// The direction is forced, exactly as runPipeline.js:85-91 records it: skill/
// is CommonJS and pipeline/ is ESM, so the shared rule lives on the skill side
// and is imported outward through createRequire.
//
// ⚠️ LOOKUP ONLY. Nothing below ever WRITES a squashed value: `choice_term` is
// still minted by keys.normaliseTerm and still stamped TERM_NORMALISER, and
// migration 018's remembered_choice_term_normalised CHECK still governs it.
// The KEY did not become fuzzy - the SEARCH became aware of one already-ruled
// equivalence. See `loadRememberedChoices`.
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const { squashMatchText } = requireCjs('../skill/termMatch.js');

/**
 * The standing authorisation these rows are written under. Closed vocabulary,
 * mirroring 018's remembered_choice_authorised_by_known.
 *
 * A future second learning rule adds a value IN A FUTURE MIGRATION - which is
 * the whole difference between this and a boolean anybody can flip.
 */
export const AUTHORISED_BY = 'standing-rule-2026-08-09';

/**
 * Which normaliser produced `choice_term`. Recorded in the row so a future
 * normalisation change becomes a QUERYABLE, VISIBLE break rather than a memory
 * that quietly stops firing.
 *
 * There are two normaliseTerm implementations in this tree (pipeline/keys.js
 * and skill/termMatch.js) pinned to agree only by a sample-based test. This
 * module writes and reads terms produced by the FIRST of those, and says so.
 */
export const TERM_NORMALISER = 'keys.normaliseTerm@1';

/**
 * The ONLY decision kinds a remembered choice may be sourced from, mirroring
 * 018's remembered_choice_source_kind_known.
 *
 * `skip_this_week`, `new_item`, `quantity_change` and `clarification_required`
 * are structurally never remembered. This constant is the readable error; the
 * composite foreign key is the enforcement.
 */
export const REMEMBERABLE_KINDS = Object.freeze(['existing_regular', 'variant_choice']);

/** The minimum candidate count Warwick's rule fires on: "MORE THAN ONE valid
 *  choice". One candidate is not an ambiguity and must not be remembered. */
export const MIN_CANDIDATES = 2;

/** The flag a resolved-from-memory line carries, as data, so tests and
 *  renderers pin the string once. */
export const REMEMBERED_FLAG = 'resolved from the choice you made last time';

const INSERT_COLUMNS = Object.freeze([
  'household_id', 'choice_term', 'term_normaliser', 'chosen_regular_id',
  'candidate_regular_ids', 'authorised_by', 'source_decision_kind',
  'chosen_at', 'source_shop_id', 'source_decision_id',
]);

const SELECT_LIST =
  'id, household_id, choice_term, term_normaliser, chosen_regular_id, ' +
  'candidate_regular_ids, authorised_by, source_decision_kind, chosen_at, ' +
  'source_shop_id, source_decision_id, created_at';

// THE ONLY MUTATING STATEMENT THIS MODULE EMITS. No UPDATE, no DELETE - not
// because none is written, but because migration 018 grants neither to
// anybody. A changed mind is a NEWER ROW.
const INSERT_SQL =
  `INSERT INTO asdair.remembered_choice (${INSERT_COLUMNS.join(', ')}) ` +
  'VALUES ($1, $2, $3, $4, $5::bigint[], $6, $7, $8, $9, $10) ' +
  'ON CONFLICT (source_decision_id) DO NOTHING ' +
  `RETURNING ${SELECT_LIST}`;

const SELECT_BY_DECISION_SQL =
  `SELECT ${SELECT_LIST} FROM asdair.remembered_choice WHERE source_decision_id = $1`;

// THE READ PATH, AND IT IS "NEWEST WINS" IN ONE STATEMENT.
//
// `distinct on (choice_term)` with `order by choice_term, chosen_at desc,
// id desc` returns exactly one row per term - the most recent preference. The
// index remembered_choice_lookup_idx (household_id, choice_term, chosen_at
// desc, id desc) is ordered to serve precisely this, and household_id is still
// its leading column so this statement still uses it.
//
// ── WHY THE TERM PREDICATE WENT (WP-B15-20) ────────────────────────────────
//
// This used to carry `AND choice_term = ANY($2::text[])`. It cannot any more,
// and the reason is worth keeping: the terms this plan wants are matched
// SEPARATOR-BLIND, and `squashMatchText`'s one exception - a separator between
// two DIGITS is never removed, so "1.5L" never becomes "15L" - is not
// expressible in SQL without writing a THIRD copy of the rule. Copying the
// rule into SQL is the defect this Work Package exists to stop, so the
// comparison happens in process instead and the statement fetches the
// household's own rows.
//
// ── THE BOUND, STATED RATHER THAN ASSUMED ──────────────────────────────────
//
// Rows returned = the number of DISTINCT choice_terms this household has ever
// recorded, not the number of rows in the table: `distinct on` collapses the
// history server-side, so a household that changes its mind weekly for a year
// still returns one row per term. It is ONE statement per plan, not one per
// line. Measured live 2026-08-10: the whole table holds 1 row. It grows by one
// term the first time a NEW ambiguity is answered, and by one more per distinct
// SPELLING of that ambiguity until this lookup covers them - which is now
// separator-blind, so the spelling axis largely stops growing.
//
// If a household ever reached a size where fetching its terms is wasteful, the
// answer is a stored squashed column and an index on it - a SILAS DECISION and
// a migration, deliberately NOT taken here (WO-2026-08-11-03 AC5).
const SELECT_NEWEST_FOR_HOUSEHOLD_SQL =
  `SELECT DISTINCT ON (choice_term) ${SELECT_LIST} ` +
  'FROM asdair.remembered_choice ' +
  'WHERE household_id = $1 ' +
  'ORDER BY choice_term, chosen_at DESC, id DESC';

function fail(message) { throw new Error(`rememberedChoice: ${message}`); }

function positiveInt(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > Number.MAX_SAFE_INTEGER) {
    fail(`${label} must be a positive integer, got ${String(value)}`);
  }
  return n;
}

/**
 * PURE. Is this string already its own normalised fixed point?
 *
 * Mirrors 018's remembered_choice_term_normalised in JS, in the SAME order
 * pipeline/keys.js normaliseTerm uses: lower -> punctuation-to-space ('&'
 * preserved) -> collapse -> trim.
 *
 * THIS IS A BETTER ERROR MESSAGE, NEVER A SUBSTITUTE FOR THE CHECK. The
 * database remains the enforcer, and the two are deliberately spelled the same
 * way so a drift between them is visible rather than silent.
 */
export function isNormalisedTerm(term) {
  const s = String(term === null || term === undefined ? '' : term);
  const normalised = s.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s === normalised;
}

/**
 * PURE. Validate and shape one remembered choice into the row migration 018
 * will accept.
 *
 * Mirrors every CHECK in 018, in the order they appear there, so a violation
 * is a readable English sentence rather than a Postgres 23514 from inside a
 * pipeline step.
 *
 * ── THE TWO REFUSALS THAT CARRY WARWICK'S OWN DISTINCTION ──────────────────
 *   * a decision kind outside REMEMBERABLE_KINDS - an ordinary one-week answer
 *     (a skip, a new item, a quantity change, a clarification) is NOT of the
 *     authorised kind and must not create a memory;
 *   * fewer than MIN_CANDIDATES grounded candidates - his rule fires only
 *     "when there is MORE THAN ONE valid choice", so a one-candidate
 *     resolution is not the thing he authorised.
 *
 * Both are refused here AND unstorable in the database: the first by the
 * composite foreign key to shop_decision (id, decision_kind), the second by
 * remembered_choice_needs_an_ambiguity. This function is the readable half of
 * a guard that does not depend on it.
 */
export function buildRememberedChoice(spec) {
  const s = spec || {};

  const householdId = positiveInt(s.household_id, 'household_id');
  if (householdId === null) fail('household_id is required - a preference belongs to a household, and there is no global scope in Warwick\'s rule');

  const rawTerm = s.choice_term === null || s.choice_term === undefined ? '' : String(s.choice_term);
  const term = rawTerm.trim() === '' ? '' : rawTerm;
  if (term === '') {
    fail('choice_term is required - a memory keyed on nothing can never be found again');
  }
  if (!isNormalisedTerm(term)) {
    fail(`choice_term "${term}" is not normalised. It must already be its own normalised fixed point `
      + '(lower-case, punctuation flattened to spaces with "&" preserved, whitespace collapsed, trimmed), '
      + 'because that is the form next week\'s list line will normalise to.');
  }
  if (term.length > 200) fail(`choice_term must be 200 characters or fewer, got ${term.length}`);

  const normaliser = String(s.term_normaliser ?? '').trim();
  if (normaliser === '') fail('term_normaliser is required - which normaliser produced choice_term');
  if (normaliser.length > 80) fail(`term_normaliser must be 80 characters or fewer, got ${normaliser.length}`);

  const chosen = positiveInt(s.chosen_regular_id, 'chosen_regular_id');
  if (chosen === null) {
    fail('chosen_regular_id is required - a remembered choice names a REAL catalogue product by id, never a name. '
      + 'That is what makes a fabricated match unstorable rather than merely discouraged.');
  }

  const rawCandidates = Array.isArray(s.candidate_regular_ids) ? s.candidate_regular_ids : null;
  if (rawCandidates === null) fail('candidate_regular_ids is required and must be an array of regulars ids');
  const candidates = [];
  for (const c of rawCandidates) {
    const n = positiveInt(c, 'candidate_regular_ids entry');
    if (n === null) {
      fail('candidate_regular_ids must not contain null - a null element would silently defeat the '
        + '"the chosen product was one of its own candidates" check');
    }
    if (!candidates.includes(n)) candidates.push(n);
  }
  if (candidates.length < MIN_CANDIDATES) {
    fail(`Warwick's rule fires only when there is MORE THAN ONE valid choice, so at least ${MIN_CANDIDATES} `
      + `grounded candidates are required; this one had ${candidates.length}. A single-candidate resolution `
      + 'is not an ambiguity and must not become a standing preference.');
  }
  if (!candidates.includes(chosen)) {
    fail(`chosen_regular_id ${chosen} was not among its own candidates (${candidates.join(', ')}). `
      + 'A choice that was never on the table is incoherent.');
  }

  const authorisedBy = String(s.authorised_by ?? '').trim();
  if (authorisedBy !== AUTHORISED_BY) {
    fail(`authorised_by "${authorisedBy}" is not the standing authorisation "${AUTHORISED_BY}". `
      + 'A new kind of learning needs a MIGRATION, which is deliberate, reviewable and visible - '
      + 'not a literal a writer may choose.');
  }

  const sourceKind = String(s.source_decision_kind ?? '').trim();
  if (!REMEMBERABLE_KINDS.includes(sourceKind)) {
    fail(`source_decision_kind "${sourceKind}" is not one of: ${REMEMBERABLE_KINDS.join(', ')}. `
      + 'An ordinary one-week answer is NOT an authorised standing preference, and the composite foreign key '
      + 'to asdair.shop_decision (id, decision_kind) proves the kind rather than trusting this literal.');
  }

  const chosenAt = s.chosen_at;
  if (chosenAt === null || chosenAt === undefined || String(chosenAt).trim() === '') {
    fail('chosen_at is required and has NO DEFAULT, deliberately - it records WHEN WARWICK CHOSE, not when '
      + 'the row was written. "How old is this preference" is the entire point of the column.');
  }

  const shopId = positiveInt(s.source_shop_id, 'source_shop_id');
  if (shopId === null) fail('source_shop_id is required - which shop the choice was made in');
  const decisionId = positiveInt(s.source_decision_id, 'source_decision_id');
  if (decisionId === null) fail('source_decision_id is required - provenance is a JOIN, never a copy');

  return {
    household_id: householdId,
    choice_term: term,
    term_normaliser: normaliser,
    chosen_regular_id: chosen,
    candidate_regular_ids: candidates,
    authorised_by: authorisedBy,
    source_decision_kind: sourceKind,
    chosen_at: chosenAt instanceof Date ? chosenAt.toISOString() : String(chosenAt),
    source_shop_id: shopId,
    source_decision_id: decisionId,
  };
}

/**
 * PURE. The grounded regulars ids a question actually OFFERED.
 *
 * Only a candidate carrying a `regular_id` counts, and that field is emitted
 * by `planCandidates` ONLY for resolveByCatalogue alternatives - the one
 * population whose ids are genuine asdair.regulars ids. A planner suggestion
 * carries a name and no id ON PURPOSE, and treating its label as an identity
 * would be exactly the fabrication planCandidates' three-population comment
 * exists to prevent.
 *
 * The rendered list is preferred over `candidates` because it is what the
 * human actually SAW - the same precedence shopDecisions.resolveExactCandidate
 * applies.
 */
export function groundedCandidateIds(question) {
  const q = question || {};
  const offered = [
    ...(Array.isArray(q.rendered_candidates) ? q.rendered_candidates : []),
    ...(Array.isArray(q.candidates) ? q.candidates : []),
  ];
  const ids = [];
  for (const c of offered) {
    if (!c || typeof c !== 'object') continue;
    const raw = c.regular_id;
    if (raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) continue;
    if (!ids.includes(n)) ids.push(n);
  }
  return ids;
}

/**
 * PURE. Should this settled decision become a remembered choice, and with what
 * row?
 *
 * Returns `{ remember: false, reason }` far more often than it returns a spec,
 * and that is correct: the mechanism Warwick authorised is narrow. Every
 * refusal names itself so a caller can report WHY nothing was remembered
 * instead of leaving a silence that looks identical to a bug.
 *
 * ── WHY THE TERM COMES FROM `item_name` AND NOT THE PHOTOGRAPHED WORDING ────
 * The memory is looked up next week from a PLAN LINE, and a plan line's name
 * is a shopping_list_items.item_name. The photographed wording is evidence of
 * what the camera saw this week and is not reproducible next week from a
 * different photograph, so keying on it would write memories that can never
 * fire. A question with no durable item_name therefore remembers NOTHING and
 * says so, rather than inventing a key.
 */
export function decideToRemember({ shop, question, decision, normaliseTerm }) {
  if (typeof normaliseTerm !== 'function') {
    fail('normaliseTerm must be supplied - it is the join between a memory and next week\'s plan line, '
      + 'and passing it in is what keeps this module free of pipeline imports');
  }
  const d = decision || {};
  const kind = String(d.decision_kind ?? '');

  // WARWICK'S OWN DISTINCTION, FIRST. An ordinary one-week answer is not of
  // the authorised kind and must not create a remembered choice.
  if (!REMEMBERABLE_KINDS.includes(kind)) {
    return { remember: false, reason: `decision_kind "${kind}" is not an authorised standing-preference kind` };
  }

  const chosen = d.decided_regular_id === null || d.decided_regular_id === undefined
    ? null : Number(d.decided_regular_id);
  if (chosen === null || !Number.isInteger(chosen)) {
    return { remember: false, reason: 'the decision names no catalogue product' };
  }

  const rawName = question && question.item_name !== undefined && question.item_name !== null
    ? String(question.item_name) : '';
  const term = normaliseTerm(rawName);
  if (term === '') {
    return { remember: false, reason: 'the question has no durable list wording, so no key could be reproduced next week' };
  }

  const candidates = groundedCandidateIds(question);
  if (candidates.length < MIN_CANDIDATES) {
    return {
      remember: false,
      reason: `only ${candidates.length} grounded candidate(s) were offered - Warwick's rule fires when there is MORE THAN ONE valid choice`,
    };
  }
  if (!candidates.includes(chosen)) {
    // Defensive and deliberately NOT repaired: the decision resolved to a
    // product that was not among the grounded options rendered for this
    // question. That is a fact worth reporting, never a set to widen.
    return { remember: false, reason: 'the chosen product was not among the grounded candidates offered for this question' };
  }

  // WHEN HE CHOSE - from the decision's own interpreted_at, else the
  // question's answered_at. NEVER the clock at write time: a replayed or
  // resumed pass must not re-date a preference.
  const chosenAt = d.interpreted_at ?? (question ? question.answered_at : null) ?? null;
  if (chosenAt === null || chosenAt === undefined || String(chosenAt).trim() === '') {
    return { remember: false, reason: 'no durable time for the choice - chosen_at has no default, deliberately' };
  }

  return {
    remember: true,
    spec: {
      household_id: shop.household_id,
      choice_term: term,
      term_normaliser: TERM_NORMALISER,
      chosen_regular_id: chosen,
      candidate_regular_ids: candidates,
      authorised_by: AUTHORISED_BY,
      source_decision_kind: kind,
      chosen_at: chosenAt,
      source_shop_id: shop.id,
      source_decision_id: d.id,
    },
  };
}

/**
 * Persist one remembered choice. Idempotent on source_decision_id.
 *
 * @returns {{choice:object, created:boolean, already:boolean}} `already` is
 *          true when this decision has already been remembered - reported,
 *          never silent, and the STORED row is handed back rather than the one
 *          that was refused.
 */
export async function rememberChoice(deps, spec) {
  const row = buildRememberedChoice(spec);
  const params = [
    row.household_id, row.choice_term, row.term_normaliser, row.chosen_regular_id,
    row.candidate_regular_ids, row.authorised_by, row.source_decision_kind,
    row.chosen_at, row.source_shop_id, row.source_decision_id,
  ];
  const res = await deps.writeQuery(INSERT_SQL, params);
  const written = ((res && res.rows) || [])[0] || null;
  if (written) return { choice: written, created: true, already: false };

  // Zero rows means ON CONFLICT refused it: this decision is already
  // remembered. Hand back what is actually stored, never what we tried to
  // write - the same shape shopDecisions.recordDecision uses.
  const existing = ((await deps.readQuery(SELECT_BY_DECISION_SQL, [row.source_decision_id])).rows || [])[0] || null;
  if (!existing) {
    fail(`the insert wrote nothing for decision ${row.source_decision_id} and no remembered choice exists for it. Nothing was written.`);
  }
  return { choice: existing, created: false, already: true };
}

/**
 * PURE. Newer of two remembered rows, by the statement's OWN precedence.
 *
 * `chosen_at` descending, then `id` descending - byte-for-byte the ordering
 * `SELECT_NEWEST_FOR_HOUSEHOLD_SQL` already applies. Squashing can make two
 * DIFFERENT stored terms compete for one lookup ("ariel pods" and "arielpods"),
 * and this decides that contest by INHERITING the existing rule rather than
 * inventing a second one. Ruled by Larry, 2026-08-10 (Amendment 1, ruling 2).
 */
function newerOf(a, b) {
  if (!a) return b;
  if (!b) return a;
  const at = String(a.chosen_at ?? '');
  const bt = String(b.chosen_at ?? '');
  if (at !== bt) return at > bt ? a : b;
  return Number(b.id) > Number(a.id) ? b : a;
}

/**
 * The newest remembered choice for each of the supplied normalised terms.
 *
 * ONE statement, never one per line. Returns a Map keyed by the term the
 * CALLER ASKED FOR - never by the stored `choice_term` - so the pure half below
 * never has to know how the rows were fetched, nor which spelling they were
 * filed under.
 *
 * ── WHY THE MAP IS KEYED ON THE REQUEST (WP-B15-20) ────────────────────────
 *
 * THIS IS THE WHOLE FIX, AND IT IS EASY TO GET HALF RIGHT. The lookup lives in
 * TWO places, not one: this statement, and `applyRememberedToPlan`'s
 * `memories.get(term)` / `memories.has(term)`, which read by the term the PLAN
 * LINE normalises to. This function used to key the Map on `row.choice_term` -
 * the STORED spelling - so making only the fetch separator-blind would find the
 * row and then MISS IT AGAIN on the Map, one line later, looking exactly like
 * a fix that works.
 *
 * Keying on the requested term means the pure half is UNCHANGED and stays
 * exact-equality: it asks for the term it computed and gets the memory that
 * belongs to it. `applyRememberedToPlan` needed no edit for this Work Package.
 *
 * AND IT IS WHAT MAKES THE MISS VISIBLE. `applyRememberedToPlan:588` only
 * reports a refusal when `memories.has(term)` - so under the old keying a
 * separator miss emitted NO `refused` entry and vanished. (It never even got
 * that far: runPipeline.js short-circuits on an empty Map, so the inner branch
 * was never reached at all.) A memory that is found and then honestly refused
 * now travels as a reported refusal, because the key it is filed under is the
 * key the caller looks for.
 *
 * ⛔ STILL NOT FUZZY. Two terms agree here only if they carry the SAME letters
 * and digits in the SAME order; a misspelling is still a miss, and a separator
 * between two digits is still never removed. There is no score, no threshold
 * and no exception list to loosen.
 *
 * An empty term list issues NO statement at all - a plan with nothing left
 * unresolved must not spend a query proving it.
 */
export async function loadRememberedChoices(deps, householdId, terms) {
  const wanted = [];
  for (const t of Array.isArray(terms) ? terms : []) {
    const s = t === null || t === undefined ? '' : String(t);
    if (s !== '' && !wanted.includes(s)) wanted.push(s);
  }
  if (wanted.length === 0) return new Map();

  const res = await deps.readQuery(SELECT_NEWEST_FOR_HOUSEHOLD_SQL, [householdId]);

  // The household's memories, indexed by the shared matcher's normal form.
  // `distinct on` already collapsed each exact term's history; this collapses
  // the terms that squash together, by the same precedence.
  const bySquashed = new Map();
  for (const row of (res && res.rows) || []) {
    if (!row) continue;
    const key = squashMatchText(row.choice_term);
    if (key === '') continue;
    bySquashed.set(key, newerOf(bySquashed.get(key) || null, row));
  }

  const byTerm = new Map();
  for (const term of wanted) {
    const hit = bySquashed.get(squashMatchText(term));
    if (hit) byTerm.set(term, hit);
  }
  return byTerm;
}

/**
 * PURE. May this memory be used for this line, THIS WEEK?
 *
 * ⛔ THIS IS THE FUNCTION THAT MUST NEVER BECOME CLEVER. ⛔
 *
 * Warwick: "If the remembered product is unavailable or no longer a valid
 * grounded candidate, BEHAVE HONESTLY RATHER THAN FABRICATING A MATCH."
 *
 * There is no near-match, no renamed-product tolerance, no closest-thing-
 * available and no least-bad fallback anywhere below. Two conditions, both
 * required, both exact-id:
 *
 *   1. the remembered product is in THIS LINE'S grounded candidate set THIS
 *      WEEK - the ids the resolver produced from the live catalogue, not last
 *      week's stored set, which is evidence only;
 *   2. the remembered product is still an ACTIVE regular - `loadCatalogue`
 *      selects `active = true`, so presence in the catalogue IS that check.
 *
 * Anything else returns `{ use: false, reason }` and the caller asks Warwick
 * again. The reason is carried so the refusal can be reported rather than
 * looking like a memory that simply never existed.
 *
 * @param {object}  spec
 * @param {object}  spec.memory              the stored remembered_choice row
 * @param {number[]} spec.candidateIds       THIS WEEK'S grounded candidate ids
 * @param {Set|Map} spec.activeRegularIds    the live catalogue's regulars
 */
export function resolveFromMemory({ memory, candidateIds, activeRegularIds }) {
  if (!memory) return { use: false, reason: 'no remembered choice for this line' };

  const chosen = Number(memory.chosen_regular_id);
  if (!Number.isInteger(chosen)) {
    return { use: false, reason: 'the remembered choice names no usable product id' };
  }

  const thisWeek = Array.isArray(candidateIds) ? candidateIds.map(Number) : [];
  if (thisWeek.length < MIN_CANDIDATES) {
    // Not an ambiguity this week. Whatever the memory says, this is not the
    // situation Warwick authorised it for.
    return {
      use: false,
      reason: `this line has ${thisWeek.length} grounded candidate(s) this week, so it is not the ambiguity the preference was recorded for`,
    };
  }
  if (!thisWeek.includes(chosen)) {
    // THE CASE THAT MATTERS MOST. The remembered product is not on this week's
    // table. Ask again. Never substitute, never approximate.
    return {
      use: false,
      reason: 'the remembered product is not a grounded candidate for this line this week',
    };
  }

  const active = activeRegularIds instanceof Set
    ? activeRegularIds
    : new Set(activeRegularIds instanceof Map ? [...activeRegularIds.keys()].map(Number) : []);
  if (!active.has(chosen)) {
    return { use: false, reason: 'the remembered product is no longer an active regular' };
  }

  return { use: true, regular_id: chosen, memory };
}

function pushFlag(flags, flag) {
  const list = Array.isArray(flags) ? flags.slice() : [];
  if (list.indexOf(flag) === -1) list.push(flag);
  return list;
}

/**
 * PURE. Resolve what can honestly be resolved from memory, and leave the rest
 * for Warwick.
 *
 * Takes the plan AFTER `applyDecisionsToPlan` has run, together with the
 * `unresolved` set that function computed, and returns a new plan plus a
 * SHRUNKEN unresolved set. Nothing is mutated: the caller may legitimately
 * want to report what the plan looked like before the memories were applied.
 *
 * ── THREE POPULATIONS IT WILL NOT TOUCH, AND WHY EACH IS STRUCTURAL ────────
 *
 *   1. A line a hard `exclude` removed. The planner gave it `excluded` /
 *      `excluded_this_week`, so it never enters `unresolved` at all.
 *   2. A line a `map` rule (or any other planner rule) already resolved. It is
 *      `add`, not `needs_decision`, so it never enters `unresolved` either.
 *   3. A line awaiting a CLARIFICATION - `needs_clarification_round`. Warwick
 *      answered and AsdAIr could not read the answer; asking again is exactly
 *      right, and a preference papering over that would be the mechanism
 *      overriding a live human hold. Skipped explicitly below.
 *
 * A preference therefore only ever collapses an ALREADY-GROUNDED,
 * ALREADY-PERMITTED set of candidates down to one of its own members. It can
 * never add a product, remove one, change a quantity, or overrule a rule.
 *
 * @param {object}   spec
 * @param {object}   spec.plan             the plan applyDecisionsToPlan returned
 * @param {Array}    spec.unresolved       its unresolved set
 * @param {Map}      spec.memoriesByTerm   choice_term -> remembered_choice row
 * @param {Map}      spec.candidateIdsByTerm normalised term -> this week's ids
 * @param {Map|Set}  spec.activeRegularIds the live catalogue's regulars
 * @param {Function} spec.normaliseTerm    passed in, never imported
 *
 * @returns {{plan:object, remembered:Array, unresolved:Array, refused:Array}}
 */
export function applyRememberedToPlan({
  plan, unresolved, memoriesByTerm, candidateIdsByTerm, activeRegularIds, normaliseTerm,
}) {
  if (!plan || typeof plan !== 'object') {
    fail('applyRememberedToPlan: plan is required');
  }
  if (typeof normaliseTerm !== 'function') {
    fail('applyRememberedToPlan: normaliseTerm must be supplied - it is the join between a stored memory '
      + 'and a recomputed plan line, and passing it in keeps this module free of pipeline imports');
  }

  const held = Array.isArray(unresolved) ? unresolved : [];
  const memories = memoriesByTerm instanceof Map ? memoriesByTerm : new Map();
  const candidatesByTerm = candidateIdsByTerm instanceof Map ? candidateIdsByTerm : new Map();

  const remembered = [];
  const refused = [];
  const stillUnresolved = [];
  const resolvedByTerm = new Map();

  for (const entry of held) {
    // POPULATION 3. A live clarification hold outranks any preference.
    if (entry && entry.needs_clarification_round === true) {
      stillUnresolved.push(entry);
      continue;
    }

    const term = normaliseTerm(entry && entry.item_name !== undefined ? entry.item_name : '');
    if (term === '') { stillUnresolved.push(entry); continue; }

    const verdict = resolveFromMemory({
      memory: memories.get(term) || null,
      candidateIds: candidatesByTerm.get(term) || [],
      activeRegularIds,
    });

    if (!verdict.use) {
      // HONEST FAILURE. The line stays unresolved and a question is opened for
      // it exactly as if no memory existed. The reason travels for reporting
      // and is never used to widen the search.
      if (memories.has(term)) {
        refused.push({ item_name: entry.item_name, question_key: entry.question_key, reason: verdict.reason });
      }
      stillUnresolved.push(entry);
      continue;
    }

    resolvedByTerm.set(term, verdict);
    remembered.push({
      item_name: entry.item_name,
      question_key: entry.question_key,
      regular_id: verdict.regular_id,
      remembered_choice_id: verdict.memory.id ?? null,
      chosen_at: verdict.memory.chosen_at ?? null,
      source_shop_id: verdict.memory.source_shop_id ?? null,
      // THE REASON, NAMED. A resolution that cannot say why it happened is
      // indistinguishable from a guess.
      reason: REMEMBERED_FLAG,
    });
  }

  if (resolvedByTerm.size === 0) {
    return { plan, remembered, unresolved: stillUnresolved, refused };
  }

  const activeById = activeRegularIds instanceof Map ? activeRegularIds : null;

  const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (item.status !== 'needs_decision') return item;
    const term = normaliseTerm(item.item_name === undefined ? '' : item.item_name);
    const verdict = resolvedByTerm.get(term);
    if (!verdict) return item;

    // THE NAME IS LOOKED UP FROM THE CATALOGUE BY ID, NEVER STORED ON THE
    // MEMORY. 008's rule, and the reason `remembered_choice` carries no
    // product-name column at all: a renamed product renders as its CURRENT
    // name and a withdrawn one renders as nothing, never as a stale string
    // that still looks live.
    const reg = activeById ? activeById.get(Number(verdict.regular_id)) || null : null;
    const canonical = reg && reg.name !== undefined && reg.name !== null ? reg.name : null;

    return {
      ...item,
      matched_product: canonical === null ? item.matched_product : canonical,
      decided_regular_id: verdict.regular_id,
      remembered_choice_id: verdict.memory.id ?? null,
      planned_qty: item.requested_qty,
      status: 'add',
      flags: pushFlag(item.flags, REMEMBERED_FLAG),
    };
  });

  // The summary is RECOMPUTED from the changed items, never carried over - the
  // same discipline applyDecisions.js applies, and for the same reason: a
  // stale summary beside a changed basket is how a plan starts lying about
  // itself.
  const countBy = (s) => items.filter((it) => it && it.status === s).length;
  const excludedStanding = countBy('excluded');
  const excludedThisWeek = countBy('excluded_this_week');

  const summary = {
    ...(plan.summary || {}),
    total_requested: items.length,
    planned_add: countBy('add'),
    needs_decision: countBy('needs_decision'),
    excluded: excludedStanding + excludedThisWeek,
    excluded_standing: excludedStanding,
    excluded_this_week: excludedThisWeek,
    lines_unresolved: stillUnresolved.length,
    remembered_choices_applied: remembered.length,
  };

  return {
    plan: { ...plan, items, summary },
    remembered,
    unresolved: stillUnresolved,
    refused,
  };
}

export const _internal = {
  INSERT_SQL,
  SELECT_BY_DECISION_SQL,
  SELECT_NEWEST_FOR_HOUSEHOLD_SQL,
  INSERT_COLUMNS,
  SELECT_LIST,
};
