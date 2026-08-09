// =====================================================================
// BUILD-015 AsdAIr WP-B15-2 - pipeline/applyDecisions.js
//
// WHERE A HUMAN ANSWER ACTUALLY CHANGES THIS WEEK'S BASKET.
//
// `planBasket` is a pure, deterministic function of the durable list, the
// rulebook, the regulars and the previous order. It decides which lines need a
// human. It does NOT know what the human said - and there is no plan table, so
// the plan is recomputed from those inputs at every site that needs it
// (runPipeline.js:723: "The plan is RECOMPUTED here rather than read from a
// plan table, because there is no plan table"). This module is what turns a
// recorded decision into a changed line, and it must therefore run at EVERY
// one of those recomputation sites - not merely the first one anybody thought
// of. `applyDecisionsToPlan` is the whole of that transformation.
//
// ── ROUTE B, AND THE CONDITION WARWICK ATTACHED ─────────────────────────────
// Two routes were available. Route A: teach `skill/planner.js` to consume the
// decisions directly. Route B: apply them to the plan the planner returned.
// Warwick chose B, on the condition that the seam allow planner-level
// consumption later WITHOUT another data-model rewrite.
//
// That condition is why this file is PURE and has NO IMPORTS. It takes plain
// data - plan items, decisions keyed by question key, a regulars lookup - and
// returns plain data. It opens no connection, reads no environment, and knows
// nothing about the pipeline. `skill/planner.js` can import this exact module
// and call this exact function on its own items, with the same decision rows,
// on the day route A is taken. Nothing about the schema, the writer or the
// decision vocabulary would change; only the call site moves.
//
// ── WHY THE QUESTION KEY IS THE JOIN ────────────────────────────────────────
// A decision belongs to a QUESTION, and a question was opened for a plan line
// under `questionKeyFor(line.item_name)`. That derivation is the only durable
// link between a plan line (recomputed, never stored) and a database row. It
// is deliberately passed IN rather than imported, so this module stays free of
// pipeline imports and a caller can never accidentally use a different one.
//
// ── UNRESOLVED IS A FIRST-CLASS RETURN, NOT AN INFERENCE ────────────────────
// `READY_TO_SHOP` used to be decided by `countOpenQuestions === 0` alone, so
// closing a question - not deciding a line - made a shop "ready". The gate now
// needs to know which LINES are still undecided, and that is what `unresolved`
// carries. A line is unresolved when the planner still wants a human AND
// nothing has been decided for it, or the decision that exists is itself a
// request for clarification. "Answered" is not "decided", and this is the only
// place that distinction is computed.
// =====================================================================

/** Flags this module attaches, as data, so tests pin the string once. */
export const DECISION_FLAGS = Object.freeze({
  DECIDED: 'decided by Warwick this week',
  QUANTITY: 'quantity set by Warwick this week',
  SKIPPED: 'skipped this week by Warwick',
  NEW_ITEM: 'new item approved by Warwick this week',
  CLARIFY: 'awaiting clarification from Warwick',
});

/** The kinds that resolve a line to a stocked product. */
const RESOLVING_KINDS = Object.freeze(['existing_regular', 'variant_choice', 'quantity_change']);

function pushFlag(flags, flag) {
  const list = Array.isArray(flags) ? flags.slice() : [];
  if (list.indexOf(flag) === -1) list.push(flag);
  return list;
}

function nameFor(regularsById, id) {
  if (id === null || id === undefined) return null;
  const map = regularsById instanceof Map ? regularsById : new Map();
  const reg = map.get(Number(id)) || null;
  return reg ? (reg.name ?? null) : null;
}

/**
 * PURE. Index decision rows by the question key they belong to.
 *
 * Rows are expected to carry `question_key` (joined from asdair.shop_question).
 * A row without one cannot be linked to a line and is returned in `unlinkable`
 * rather than dropped - silently discarding a recorded human decision is the
 * exact failure this Work Package exists to end.
 */
export function indexDecisions(decisions) {
  const byKey = new Map();
  const unlinkable = [];
  for (const d of Array.isArray(decisions) ? decisions : []) {
    if (!d) continue;
    const key = d.question_key === null || d.question_key === undefined ? '' : String(d.question_key);
    if (key === '') { unlinkable.push(d); continue; }
    // FIRST DECISION WINS, matching the database: shop_decision_question_uniq
    // permits exactly one row per question, so a second row for the same key
    // can only be a later ROUND of a different question. Keeping the first
    // keeps this consistent with what the database would have allowed.
    if (!byKey.has(key)) byKey.set(key, d);
  }
  return { byKey, unlinkable };
}

/**
 * PURE. Apply structured current-shop decisions to a plan.
 *
 * @param {object}   spec
 * @param {object}   spec.plan            the planBasket result ({ items, summary })
 * @param {Array}    spec.decisions       shop_decision rows, each carrying question_key
 * @param {Function} spec.questionKeyFor  (itemName) => key. Passed in, never imported.
 * @param {Map}      [spec.regularsById]  catalogue lookup, id -> { name, ... }
 *
 * @returns {{plan:object, applied:Array, unresolved:Array, unlinkable:Array}}
 *   `plan` is a NEW object - the input is never mutated, because the caller may
 *   legitimately want to report what the planner alone decided.
 */
export function applyDecisionsToPlan({ plan, decisions, questionKeyFor, regularsById = null }) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('applyDecisions: plan is required (the planBasket result)');
  }
  if (typeof questionKeyFor !== 'function') {
    throw new Error('applyDecisions: questionKeyFor must be supplied - the join between a recomputed plan line and a stored decision');
  }

  const { byKey, unlinkable } = indexDecisions(decisions);
  const applied = [];
  const unresolved = [];

  const items = (Array.isArray(plan.items) ? plan.items : []).map((item) => {
    if (!item || typeof item !== 'object') return item;

    // ── WALK THE ROUND CHAIN, NEWEST WINS ─────────────────────────────────
    // A line's conversation may run several rounds, and EACH ROUND IS A
    // DIFFERENT QUESTION WITH A DIFFERENT KEY. Looking up round 1 alone finds
    // only the decision that ASKED for a clarification, never the one that
    // answered it - so the line would stay unresolved forever while the
    // pipeline opened round 3, then 4, then 5, about something Warwick had
    // already settled.
    //
    // The effective decision is therefore the HIGHEST round on record: the
    // latest thing he said about this line. Earlier rounds are history.
    //
    // Found by answerJourney.test.js driving a real second round, not by
    // reasoning about the code - which is exactly why that test exists.
    let key = null;
    let decision = null;
    for (let round = 1; ; round += 1) {
      let candidateKey;
      try {
        candidateKey = questionKeyFor(item.item_name, round);
      } catch {
        // An unreadable line cannot be asked about by name, so it can carry no
        // decision. It is still unresolved if the planner wanted a human.
        break;
      }
      if (round === 1) key = candidateKey;
      const found = byKey.get(candidateKey) || null;
      // A gap ends the chain: rounds are opened consecutively, so the absence
      // of round N means there is no round N+1 either.
      if (!found) break;
      decision = found;
      key = candidateKey;
    }

    // NOTHING DECIDED. The line is exactly what the planner made it - and if
    // the planner wanted a human, it still does. An ANSWERED question with no
    // structured decision lands here, which is precisely shop 6's shape and
    // precisely what must not reach READY_TO_SHOP.
    if (!decision) {
      if (item.status === 'needs_decision') {
        unresolved.push({ item_name: item.item_name, question_key: key, reason: 'no structured decision recorded' });
      }
      return item;
    }

    const kind = String(decision.decision_kind || '');

    // A CLARIFICATION DECIDES NOTHING, DELIBERATELY. Unknown means ask again;
    // it never means take the least-bad match. The line stays needing a human
    // and is reported unresolved, which is what opens the next round.
    if (kind === 'clarification_required') {
      unresolved.push({
        item_name: item.item_name,
        question_key: key,
        reason: 'clarification required',
        clarification_reason: decision.clarification_reason ?? null,
        question_id: decision.question_id ?? null,
        // The round this decision was made IN. The next round is this + 1, and
        // it is read from the joined question row rather than counted here, so
        // a resumed pass cannot disagree with the database about which round
        // it is on.
        question_round: Number(decision.question_round ?? 1),
        needs_clarification_round: true,
      });
      return { ...item, status: 'needs_decision', planned_qty: 0, flags: pushFlag(item.flags, DECISION_FLAGS.CLARIFY) };
    }

    if (kind === 'skip_this_week') {
      applied.push({ item_name: item.item_name, question_key: key, kind });
      // 'excluded_this_week' is the planner's OWN vocabulary for a transient,
      // this-list-only exclusion (rule 10). Reusing it means every downstream
      // reader that already understands a skipped line understands this one,
      // and nothing new has to learn a fifth status.
      return {
        ...item,
        status: 'excluded_this_week',
        planned_qty: 0,
        flags: pushFlag(item.flags, DECISION_FLAGS.SKIPPED),
      };
    }

    if (kind === 'new_item') {
      applied.push({ item_name: item.item_name, question_key: key, kind });
      const qty = decision.decided_quantity === null || decision.decided_quantity === undefined
        ? item.requested_qty : Number(decision.decided_quantity);
      return {
        ...item,
        // A new item is by definition absent from the catalogue, so it carries
        // NO matched_product. The approved name travels in its own field and
        // never overwrites item_name, which is the question-key derivation
        // input and must stay stable.
        matched_product: null,
        decided_item_name: decision.decided_item_name ?? null,
        requested_qty: qty,
        planned_qty: qty,
        status: 'add',
        flags: pushFlag(item.flags, DECISION_FLAGS.NEW_ITEM),
      };
    }

    if (RESOLVING_KINDS.includes(kind)) {
      // THE NAME IS LOOKED UP FROM THE CATALOGUE BY ID, NEVER TAKEN FROM THE
      // DECISION ROW. Same rule 008 states for shop_line: an id is the
      // identity, a name is a rendering of it, and model prose can never
      // masquerade as a product we stock. A decision whose regular is not in
      // the supplied catalogue resolves to null rather than to a guess.
      const canonical = nameFor(regularsById, decision.decided_regular_id);
      const qty = kind === 'quantity_change' && decision.decided_quantity !== null
        && decision.decided_quantity !== undefined
        ? Number(decision.decided_quantity)
        : item.requested_qty;

      applied.push({ item_name: item.item_name, question_key: key, kind, regular_id: decision.decided_regular_id ?? null });

      return {
        ...item,
        matched_product: canonical === null ? item.matched_product : canonical,
        decided_regular_id: decision.decided_regular_id ?? null,
        requested_qty: qty,
        planned_qty: qty,
        status: 'add',
        flags: pushFlag(item.flags, kind === 'quantity_change' ? DECISION_FLAGS.QUANTITY : DECISION_FLAGS.DECIDED),
      };
    }

    // An unknown kind is never silently ignored. The database's CHECK makes it
    // unstorable, so reaching here means the vocabulary drifted between the
    // migration and this module - which must be loud, not absorbed.
    throw new Error(`applyDecisions: unknown decision_kind "${kind}" for question_key ${key}. `
      + 'The migration 017 CHECK and this module have drifted apart.');
  });

  // The summary is RECOMPUTED from the changed items, never carried over.
  // A stale summary beside a changed basket is how a plan starts lying about
  // itself, and every downstream reader takes these counts at face value.
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
    decisions_applied: applied.length,
    lines_unresolved: unresolved.length,
  };

  return { plan: { ...plan, items, summary }, applied, unresolved, unlinkable };
}

export default applyDecisionsToPlan;
