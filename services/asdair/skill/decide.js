// =====================================================================
// BUILD-015 AsdAIr - skill/decide.js
//
// THE SEMANTIC DECISION POINT. "MODEL DECIDES. PLANNER / EXECUTOR EXECUTES."
// (Warwick, 2026-08-18.)
//
// ── WHAT THIS REPLACES, AND WHY IT IS A NEW MODULE RATHER THAN A TUNE ──────
// Until this module existed, the shape of the live path was:
//
//     planBasket (deterministic)  ->  decided which lines were unresolved AND
//                                     produced every candidate a human saw
//     applyRulebook (the model)   ->  adjusted that output, and ONLY where an
//                                     inert prose rule already spoke
//
// Veritas Gate 2 measured what that produces: ham, eggs, freezer bags, quarter
// pounders and bananas offered for "2 pkts ASDA plain toffees" while the
// household's own toffee rows scored ZERO; cat food offered for "1 wet wipes";
// four women's deodorants offered for a line reading MALE; and zero rulebook
// events across 91,219 log lines. The scorer was the semantic decision-maker,
// which the approved goal contract forbids in terms:
//
//   "A deterministic executor may perform mechanical browser actions UNDERNEATH
//    an AI. It must never be the semantic decision-maker."
//
// Warwick ruled out the alternative repair explicitly: "Do not explain it away,
// narrow the contract, or tune the existing scorer. The failure is
// architectural." So the scorer is not improved here. It is REMOVED FROM THE
// DECISION, and this module is what decides instead.
//
// ── WHERE THE PROHIBITION BITES (Larry, confirming the read-back) ──────────
// At the DECISION POINT. No deterministic component may choose among
// candidates, rank them, or decide that a line is unresolved. An EXACT AND
// UNAMBIGUOUS alias or id match is a LOOKUP, not a decision, and the goal
// contract preserves it deliberately: "stored id if present (fast path) ->
// otherwise search ASDA and match on the unique product description -> select
// when clear -> abstain only on genuine ambiguity."
//
// The addition that closes the class rather than the instance: the fast path
// must be exact AND unambiguous. Two exact matches is AMBIGUITY and comes here.
// It is never settled by a tie-break - an alphabetical tie-break is how
// regularCandidates came to offer bananas.
//
// ── THE CONTRACT IS IN THE CALL, NOT ABOUT IT (finding 8) ─────────────────
// `spec.contract` carries the bytes skill/contract.js read from the canonical
// committed documents, and its sha256 is returned in the audit so a reviewer
// can establish afterwards WHICH contract governed a decision. A decision
// without it does not happen: see the throw below.
//
// ── ONE CALL PER SHOP, NOT ONE PER LINE ───────────────────────────────────
// Deliberate. The model must be able to reason ACROSS lines: on 17 August
// "1 x 6pk Heinz baked beans" and "1 x 5pk Heinz sausages & beans" collapsed
// into one product because nothing ever saw them together. A per-line call
// cannot see that, however good the model is.
//
// ── FAIL LOUD. NEVER FALL BACK TO THE SCORER. ─────────────────────────────
// If the model is unbound, unreachable, or returns something this module cannot
// read, it THROWS. There is deliberately no degraded mode: the degraded mode
// would be the deterministic path this build exists to remove, and a board of
// cat food is worse than no board. The step fails visibly and the shop stays
// resumable, which is what the durable spine is for.
//
// ── AND IT NEVER TRUSTS AN ID IT WAS GIVEN ────────────────────────────────
// Every `regular_id` the model returns is validated against the household
// catalogue: it must exist, be active, and be in household scope. An invented
// or out-of-scope id is REFUSED and recorded in the audit - the line falls back
// to an honest question carrying the model's own labels. The model decides; it
// does not get to mint identities the household does not hold.
//
// PURE over an injected `consult`. No database, no gateway, no clock, no I/O.
// =====================================================================
'use strict';

// NO IMPORT OF planner.js, AND NO LOCAL COPY OF ITS HELPERS - DELIBERATE.
//
// An earlier draft of this module reached for `normaliseTerm` to rebuild a
// brand-prefixed display name the way planner.regularDisplayName does. Two
// things were wrong with that. It does not live in termMatch.js (it is
// planner-internal, and a `require` of it resolves to `undefined` while every
// stubbed test still passes - the exact D-1 failure shape this codebase has hit
// before), and it was solving a problem the contract already settles:
//
//   "Every ASDA product description is unique. That is the identity AsdAIr
//    matches on."
//
// So the catalogue's own `name` IS the identity and is used verbatim. Nothing
// is reconstructed, nothing is duplicated, and there is one less way for a
// display string to drift from the row it names.

/** Thrown when the decision could not be taken. Never swallowed here. */
class DecisionUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'DecisionUnavailableError'; }
}

const VERDICTS = Object.freeze(['select', 'search', 'ask']);

/** A line the planner did NOT bind by exact lookup, i.e. a real decision. */
function needsDecision(item) {
  if (!item) return false;
  const status = String(item.status || '');
  if (status === 'excluded' || status === 'excluded_this_week') return false;
  if (status === 'needs_decision') return true;
  // An "add" line with nothing named is not planned, whatever its status says.
  return item.matched_product === null || item.matched_product === undefined
    || String(item.matched_product).trim() === '';
}

/**
 * A binding the deterministic matcher made on SIMILARITY rather than on exact
 * alias equality. It is a real binding - it stays in the plan and costs no
 * extra model call - but AsdAIr may overturn it, because deciding which of two
 * similar products a line means is a semantic judgement.
 *
 * The measured case: "1 TRESemme hair conditioner, blue label" bound to
 * "TRESemme Rich Moisture HAIR SHAMPOO 680 ml", and the very next line - the
 * one that really was shampoo - bound to the same product.
 */
function isTolerantBinding(item) {
  return Array.isArray(item && item.flags) && item.flags.includes('matched tolerantly');
}

/** How this line came to be bound, as the model is told. */
function bindingKind(item) {
  if (needsDecision(item)) return 'none';
  return isTolerantBinding(item) ? 'tolerant' : 'exact';
}

function activeInScope(reg, household) {
  if (!reg || reg.active === false) return false;
  const hid = reg.household_id;
  if (hid === null || hid === undefined) return true;                 // global row
  if (household === null || household === undefined) return true;
  return String(hid) === String(household);
}

/**
 * The grounding packet. Everything the decision is allowed to stand on, and
 * nothing it is not: the contract, the household's own catalogue, its rules,
 * and the WHOLE list (so cross-line reasoning is possible).
 */
function buildDecisionGrounding(spec) {
  const plan = spec.plan;
  const household = spec.household === undefined ? null : spec.household;
  const regulars = (Array.isArray(spec.regulars) ? spec.regulars : []).filter(function (r) {
    return activeInScope(r, household);
  });
  const rules = (Array.isArray(spec.rules) ? spec.rules : []).filter(function (r) {
    return r && r.active !== false;
  });

  const lines = [];
  const decisionLineNos = [];
  const correctableLineNos = [];
  plan.items.forEach(function (item, idx) {
    const lineNo = idx + 1;
    const binding = bindingKind(item);
    const entry = {
      line_no: lineNo,
      as_written: item.item_name,
      quantity: item.requested_qty === undefined ? null : item.requested_qty,
      planner_status: item.status,
      // What the lookup already bound, so the model sees the whole basket
      // rather than only its own workload.
      already_bound: item.matched_product || null,
      // HOW it was bound, which decides whether the model may overturn it:
      //   'exact'    - alias equality. Settled. A verdict against it is refused.
      //   'tolerant' - a similarity match. AsdAIr may correct it.
      //   'none'     - nothing bound it. AsdAIr must decide it.
      binding: binding,
      note: item.note || null,
      needs_decision: binding === 'none',
    };
    if (binding === 'none') decisionLineNos.push(lineNo);
    if (binding === 'tolerant') correctableLineNos.push(lineNo);
    lines.push(entry);
  });

  // ── THE LIVE RETAILER SURFACE. EMPTY HERE, AND THE SHAPE ADMITS IT. ──────
  //
  // Warwick, 2026-08-18: "The fact that no committed fixture contains the live
  // Favourites list does NOT waive the requirement for the joined production
  // route to inspect/use the live Favourites surface."
  //
  // The established shopping method is unchanged and binding:
  //   live ASDA Favourites / Regulars FIRST -> exact, unambiguous fast path
  //   -> model judgement where identity is not mechanically certain
  //   -> live search ONLY where genuinely absent or new.
  //
  // Nothing in the estate holds that list today, so no offline proof can
  // exercise it and NOTHING HERE FABRICATES ONE. What this module guarantees is
  // that the decision call CAN receive it the moment the browser lane reads it:
  // `spec.retailerEvidence` flows through untouched, and the prompt below tells
  // the model to consult it first when it is present.
  //
  // ⛔ ABSENT IS NOT EMPTY, AND THE DIFFERENCE IS LOAD-BEARING. An absent
  // surface is reported as null - "not inspected on this route" - and never as
  // an empty list. An empty list would tell the model the Favourites grid was
  // READ AND DID NOT CONTAIN THIS PRODUCT, which is a fact nobody established,
  // and would push a line to `search` on the strength of evidence that was
  // never gathered.
  const retailer = spec.retailerEvidence && typeof spec.retailerEvidence === 'object'
    ? {
      source: spec.retailerEvidence.source || 'browser lane',
      captured_at: spec.retailerEvidence.captured_at || null,
      favourites: Array.isArray(spec.retailerEvidence.favourites) ? spec.retailerEvidence.favourites : [],
      regulars: Array.isArray(spec.retailerEvidence.regulars) ? spec.retailerEvidence.regulars : [],
    }
    : null;

  return {
    household: household,
    contract: spec.contract && spec.contract.text ? spec.contract.text : null,
    contract_sha256: spec.contract && spec.contract.sha256 ? spec.contract.sha256 : null,
    lines: lines,
    decision_line_nos: decisionLineNos,
    correctable_line_nos: correctableLineNos,
    live_retailer_surface: retailer,
    catalogue: regulars.map(function (r) {
      return {
        regular_id: Number(r.id),
        name: r.name,
        brand: r.brand || null,
        category: r.category || null,
        aka: Array.isArray(r.aka) ? r.aka : [],
        typical_qty: r.typical_qty === undefined ? null : r.typical_qty,
        // An OPTIMISATION ONLY. The goal contract is explicit that the unique
        // ASDA description is the identity and a missing id never blocks a line.
        asda_product_id: r.asda_product_id || null,
      };
    }),
    rules: rules.map(function (r) {
      return {
        rule_id: Number(r.id),
        text: r.rule_text || r.text || null,
        directive: r.directive || null,
        category: r.category || null,
      };
    }),
  };
}

/**
 * THE WORDING. Owned here, exactly as skill/rulebook.js owns its own prompt,
 * so the wire (deps.js) carries no product instruction of its own.
 */
function buildDecisionPrompt(grounding) {
  const g = grounding || {};
  const mumsList = "MUM'S LIST, in full, so you can reason across lines and never merge two different products:";
  return [
    'You are AsdAIr, the household shopping steward. You are DECIDING what to buy.',
    'The contract below is your operating law, read from the canonical committed documents at run time.',
    'It is not background: where it speaks, it governs, and it outranks anything convenient.',
    '',
    '===== CONTRACT (sha256 ' + String(g.contract_sha256) + ') =====',
    String(g.contract),
    '===== END CONTRACT =====',
    '',
    'THE HOUSEHOLD CATALOGUE (asdair.regulars - these ids are the ONLY identities you may cite):',
    JSON.stringify(g.catalogue),
    '',
    'THE HOUSEHOLD RULES (asdair.rules - active rows; obey them, do not merely read them):',
    JSON.stringify(g.rules),
    '',
    'THE LIVE ASDA SURFACE (Favourites / Regulars, as read by the browser this run):',
    (g.live_retailer_surface
      ? JSON.stringify(g.live_retailer_surface)
      : 'NOT INSPECTED ON THIS ROUTE. This is NOT the same as "not in Favourites" - nobody looked. '
        + 'Do not conclude a product is absent from the household ASDA account from this line.'),
    '',
    'THE ESTABLISHED SHOPPING METHOD, in order. Follow it:',
    '  1. The LIVE ASDA Favourites / Regulars surface above, where it was inspected - it comes first;',
    '  2. an exact, unambiguous match in the household catalogue;',
    '  3. YOUR judgement where identity is not mechanically certain;',
    '  4. a live search ONLY where the product is genuinely absent or new.',
    '',
    mumsList,
    JSON.stringify(g.lines),
    '',
    'DECIDE every line whose "needs_decision" is true: ' + JSON.stringify(g.decision_line_nos) + '.',
    '',
    'You may ALSO correct any line whose "binding" is "tolerant": '
      + JSON.stringify(g.correctable_line_nos || []) + '.',
    'Those were matched by SIMILARITY, not exactly. Most are right - leave those alone. Return a',
    'verdict for one only where "already_bound" is the WRONG product for what the line says, or where',
    'two lines have been bound to the SAME product and one of them must be something else.',
    'A line whose "binding" is "exact" is settled: a verdict against it will be refused.',
    '',
    'For each line return exactly one verdict:',
    '  "select" - this IS a product the household already holds. Give its regular_id from the catalogue above.',
    '  "search" - the household has no row for it. It is a NORMAL case, not a problem. Give the exact ASDA',
    '             product description to search for, and search terms. Never resolve it to a near neighbour.',
    '  "ask"    - genuine ambiguity that only the human can settle. Give the candidates YOU consider real,',
    '             with their regular_id where the household holds them. Never ask with no options.',
    '',
    'Rules that are not negotiable:',
    '  * NEVER invent a regular_id. Cite only ids present in the catalogue above.',
    '  * NEVER offer a product for the wrong person, the wrong category or the wrong meal.',
    '  * A missing asda_product_id NEVER blocks a line - the unique ASDA description is the identity.',
    '  * Prefer "search" over a wrong "select". Abstain only on GENUINE ambiguity, never to be safe.',
    '',
    'Reply with JSON only, no prose:',
    '{"decisions":[{"line_no":1,"verdict":"select","regular_id":12,"product":"...","reason":"..."},',
    ' {"line_no":2,"verdict":"search","product":"...","search_terms":["..."],"reason":"..."},',
    ' {"line_no":3,"verdict":"ask","question":"...","candidates":[{"regular_id":4,"label":"..."}],"reason":"..."}]}',
  ].join('\n');
}

/** PURE. Read the reply, or return null. Never throws on shape. */
function parseDecisionReply(reply) {
  if (reply === null || reply === undefined) return null;
  let obj = reply;
  if (typeof reply === 'string') {
    try { obj = JSON.parse(reply); } catch (e) { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const list = Array.isArray(obj.decisions) ? obj.decisions : (Array.isArray(obj) ? obj : null);
  if (!list) return null;
  const out = [];
  list.forEach(function (d) {
    if (!d || typeof d !== 'object') return;
    const lineNo = Number(d.line_no);
    if (!Number.isFinite(lineNo) || lineNo < 1) return;
    const verdict = String(d.verdict || '').toLowerCase();
    if (VERDICTS.indexOf(verdict) === -1) return;
    out.push({
      line_no: lineNo,
      verdict: verdict,
      regular_id: (d.regular_id === null || d.regular_id === undefined) ? null : Number(d.regular_id),
      product: (d.product === null || d.product === undefined) ? null : String(d.product).trim(),
      search_terms: Array.isArray(d.search_terms)
        ? d.search_terms.map(function (t) { return String(t).trim(); }).filter(function (t) { return t !== ''; })
        : [],
      question: (d.question === null || d.question === undefined) ? null : String(d.question).trim(),
      candidates: Array.isArray(d.candidates) ? d.candidates : [],
      reason: (d.reason === null || d.reason === undefined) ? null : String(d.reason).trim(),
    });
  });
  return out;
}

function addFlag(item, flag) {
  if (!Array.isArray(item.flags)) item.flags = [];
  if (item.flags.indexOf(flag) === -1) item.flags.push(flag);
  return item;
}

function addNote(item, text) {
  if (!text) return item;
  const note = item.note ? String(item.note) : '';
  if (note.indexOf(text) !== -1) return item;
  item.note = note ? (note + '; ' + text) : text;
  return item;
}

/**
 * The name a decision resolves to: the catalogue row's own ASDA description.
 *
 * The goal contract makes this the identity, so it is used as stored rather
 * than recomposed. Where a row carries a brand the name does not already lead
 * with, the brand is prefixed - the one case where the stored name alone would
 * not name the actual thing to buy.
 */
function displayName(cat) {
  if (!cat) return null;
  const name = cat.name === null || cat.name === undefined ? '' : String(cat.name).trim();
  const brand = cat.brand === null || cat.brand === undefined ? '' : String(cat.brand).trim();
  if (name === '') return brand === '' ? null : brand;
  if (brand === '') return name;
  return name.toLowerCase().indexOf(brand.toLowerCase()) === 0 ? name : brand + ' ' + name;
}

/**
 * THE DECISION.
 *
 * @param {{plan:object, regulars:Array, rules:Array, contract:{text:string,sha256:string},
 *          household:*, consult:Function, model?:string}} spec
 * @returns {Promise<{plan:object, decisions:Array, grounding:object, audit:object}>}
 * @throws {DecisionUnavailableError} when the model is unbound, unreachable or unreadable.
 */
async function decideBasket(spec) {
  const args = spec || {};
  const plan = args.plan;
  if (!plan || !Array.isArray(plan.items)) {
    throw new Error('decideBasket: plan is required (the planBasket result)');
  }
  if (!args.contract || typeof args.contract.text !== 'string' || args.contract.text.trim() === ''
      || typeof args.contract.sha256 !== 'string' || args.contract.sha256 === '') {
    throw new DecisionUnavailableError(
      'decideBasket: the approved contract was not supplied. Veritas Gate 2 finding 8 is that the runtime '
      + 'consumed no contract text at the decision point; deciding without it is the defect, not a degraded mode.'
    );
  }

  const items = plan.items.map(function (it) {
    return Object.assign({}, it, { flags: Array.isArray(it.flags) ? it.flags.slice() : [] });
  });
  const working = Object.assign({}, plan, { items: items });

  const grounding = buildDecisionGrounding(Object.assign({}, args, { plan: working }));
  const audit = {
    consulted: false,
    contract_sha256: args.contract.sha256,
    contract_bytes: args.contract.text.length,
    contract_sources: (args.contract.sources || []).map(function (s) {
      return { path: s.path, sha256: s.sha256 };
    }),
    model: args.model || null,
    catalogue_size: grounding.catalogue.length,
    rules_sent: grounding.rules.map(function (r) { return r.rule_id; }),
    lines_total: grounding.lines.length,
    lines_sent: grounding.decision_line_nos.slice(),
    selected: [], searched: [], asked: [], rejected: [], undecided: [], corrected: [],
  };

  // NOTHING TO DECIDE is a legitimate outcome and costs nothing. It is NOT the
  // same as "the model was not consulted", and the audit says which.
  if (grounding.decision_line_nos.length === 0 && grounding.correctable_line_nos.length === 0) {
    audit.reason_not_consulted = 'every line was bound by exact catalogue lookup; there was no decision to take';
    return { plan: working, decisions: [], grounding: grounding, audit: audit };
  }

  if (typeof args.consult !== 'function') {
    throw new DecisionUnavailableError(
      'decideBasket: no reasoning consumer is bound. The deterministic planner MUST NOT decide in its place '
      + '(goal contract structural rule 1), so this fails rather than falling back to word-overlap scoring.'
    );
  }

  let decisions = null;
  try {
    decisions = parseDecisionReply(await args.consult(grounding));
    audit.consulted = true;
  } catch (e) {
    throw new DecisionUnavailableError(
      'decideBasket: the reasoning consumer failed (' + String((e && e.message) || e) + '). '
      + 'No fallback to the deterministic scorer exists by design.'
    );
  }
  if (!decisions || decisions.length === 0) {
    throw new DecisionUnavailableError(
      'decideBasket: the reasoning consumer returned nothing this module could read. '
      + 'A board built from word-overlap scoring is exactly what Veritas Gate 2 failed; refusing to build one.'
    );
  }

  const byId = new Map();
  grounding.catalogue.forEach(function (c) { byId.set(Number(c.regular_id), c); });
  const applied = [];
  const seen = new Set();

  decisions.forEach(function (d) {
    const item = items[d.line_no - 1];
    if (!item) {
      audit.rejected.push({ line_no: d.line_no, why: 'no such line in the plan' });
      return;
    }
    if (!needsDecision(item) && !isTolerantBinding(item)) {
      // The model answered a line the EXACT lookup bound. Refused, not applied:
      // a decision may not overwrite an identity that was never in doubt.
      audit.rejected.push({ line_no: d.line_no, why: 'line was already bound by exact lookup; not a decision point' });
      return;
    }
    if (!needsDecision(item)) {
      // A TOLERANT binding the model has chosen to overturn. Recorded as a
      // correction rather than a decision, because something WAS bought here
      // before and a reviewer needs to see that it changed.
      audit.corrected.push({ line_no: d.line_no, was: item.matched_product || null, verdict: d.verdict });
    }
    if (seen.has(d.line_no)) {
      audit.rejected.push({ line_no: d.line_no, why: 'duplicate decision for one line' });
      return;
    }
    seen.add(d.line_no);

    if (d.verdict === 'select') {
      const cat = d.regular_id === null ? null : byId.get(Number(d.regular_id));
      if (!cat) {
        // THE INVENTION GUARD. An id the household does not hold is refused,
        // and the line becomes an honest question rather than a wrong purchase.
        audit.rejected.push({
          line_no: d.line_no, verdict: 'select',
          why: 'regular_id ' + String(d.regular_id) + ' is not an active in-scope household regular',
        });
        item.status = 'needs_decision';
        item.planned_qty = 0;
        item.alternatives = [];
        addFlag(item, 'model cited an id the household does not hold');
        addNote(item, 'asked: the decision named a product this household has no row for');
        audit.asked.push(d.line_no);
        return;
      }
      const name = displayName(cat) || cat.name;
      item.matched_product = name;
      item.status = 'add';
      item.planned_qty = (item.requested_qty === null || item.requested_qty === undefined) ? 1 : item.requested_qty;
      item.alternatives = [];
      item.decided_regular_id = Number(cat.regular_id);
      addFlag(item, 'decided by asdair');
      addFlag(item, 'never auto-substitute');
      addNote(item, 'asdair decided: ' + name + ' (regulars id ' + cat.regular_id + ')'
        + (d.reason ? ' - ' + d.reason : ''));
      applied.push({
        line_no: d.line_no, verdict: 'select', regular_id: Number(cat.regular_id),
        product: name, reason: d.reason,
      });
      audit.selected.push(d.line_no);
      return;
    }

    if (d.verdict === 'search') {
      // A previously unseen product is a NORMAL case (goal contract). It goes to
      // the executor to find by its unique ASDA description - it does NOT become
      // a question, and it is never resolved to a near neighbour here.
      const product = d.product || null;
      if (!product) {
        audit.rejected.push({ line_no: d.line_no, verdict: 'search', why: 'search verdict named no product description' });
        item.status = 'needs_decision';
        item.alternatives = [];
        addFlag(item, 'asdair returned no decision for this line');
        audit.asked.push(d.line_no);
        return;
      }
      item.matched_product = product;
      item.status = 'add';
      item.planned_qty = (item.requested_qty === null || item.requested_qty === undefined) ? 1 : item.requested_qty;
      item.alternatives = [];
      item.search_terms = d.search_terms.length > 0 ? d.search_terms.slice() : [product];
      addFlag(item, 'decided by asdair');
      addFlag(item, 'new item - resolve by ASDA search');
      addFlag(item, 'never auto-substitute');
      addNote(item, 'asdair decided: search ASDA for "' + product + '"' + (d.reason ? ' - ' + d.reason : ''));
      applied.push({
        line_no: d.line_no, verdict: 'search', product: product,
        search_terms: item.search_terms, reason: d.reason,
      });
      audit.searched.push(d.line_no);
      return;
    }

    // 'ask' - genuine ambiguity. The candidates the human sees are the MODEL's,
    // validated against the catalogue. This is the channel that used to be a
    // word-overlap scorer.
    const candidates = [];
    (d.candidates || []).forEach(function (c) {
      if (!c) return;
      const raw = typeof c === 'string' ? { label: c } : c;
      const id = (raw.regular_id === null || raw.regular_id === undefined) ? null : Number(raw.regular_id);
      if (id !== null) {
        const cat = byId.get(id);
        if (!cat) {
          audit.rejected.push({
            line_no: d.line_no, verdict: 'ask',
            why: 'candidate regular_id ' + String(id) + ' is not an active in-scope household regular',
          });
          return;                                   // dropped, never printed
        }
        const name = displayName(cat) || cat.name;
        candidates.push({ name: name, regular_id: id, reason: raw.reason || 'asdair candidate', score: null });
        return;
      }
      const label = String(raw.label || raw.name || '').trim();
      if (label === '') return;
      candidates.push({ name: label, regular_id: null, reason: raw.reason || 'asdair candidate', score: null });
    });

    item.status = 'needs_decision';
    item.planned_qty = 0;
    item.alternatives = candidates;
    addFlag(item, 'decided by asdair: ask');
    addNote(item, d.question ? ('asdair asks: ' + d.question) : 'asdair could not settle this line');
    if (d.reason) addNote(item, d.reason);
    applied.push({
      line_no: d.line_no, verdict: 'ask', question: d.question,
      candidates: candidates, reason: d.reason,
    });
    audit.asked.push(d.line_no);
  });

  // A line the model was asked about and did not answer stays unresolved and
  // says so. It never silently acquires a candidate from anywhere else.
  grounding.decision_line_nos.forEach(function (n) {
    if (seen.has(n)) return;
    const item = items[n - 1];
    if (!item) return;
    item.status = 'needs_decision';
    item.alternatives = Array.isArray(item.alternatives) ? item.alternatives : [];
    addFlag(item, 'asdair returned no decision for this line');
    audit.undecided.push(n);
  });

  const summary = Object.assign({}, working.summary || {});
  summary.lines_decided_by_model = audit.selected.length + audit.searched.length;
  summary.lines_asked = audit.asked.length;
  summary.decision_contract_sha256 = audit.contract_sha256;

  return {
    plan: Object.assign({}, working, { items: items, summary: summary }),
    decisions: applied,
    grounding: grounding,
    audit: audit,
  };
}

module.exports = {
  decideBasket,
  buildDecisionGrounding,
  buildDecisionPrompt,
  parseDecisionReply,
  needsDecision,
  DecisionUnavailableError,
  VERDICTS,
};
