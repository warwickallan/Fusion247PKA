// =====================================================================
// BUILD-015 AsdAIr - B15-3: rulebook.js
//
// THE DEAD 59%, MADE LIVE - AND THEN DELIBERATELY NARROWED.
//
// `actionableRules()` (planner.js) drops every `info` row and every row with no
// match_term / match_category. On the live corpus that is 23 of 39 active rules
// and it is NOT a random subset: it is precisely the JUDGEMENT layer. What
// survives is `map` and `exclude` -- identity and prohibition, the two things a
// deterministic matcher can do. What died was every rule that says "pick the
// better one", "buy up to the offer", "round it up".
//
// Active for weeks. Never fired once. Warwick, verbatim: "there is no way to
// teach the system new rules and get it to learn if I keep having to tell it
// which aerial every bloody week!"
//
// -- WHAT THIS MODULE NO LONGER DOES (Warwick, 2026-08-09) ------------------
//
// He then changed his mind about the BEST-VALUE half of that and ARCHIVED it:
//
//   "Do not make Terra, the planner, or the browser phase attempt to optimise
//    Ariel/other choices by live price, price-per-wash, multibuy maths, or
//    bargain judgement before handing the list to the browser. ... The
//    objective is deliberately to SIMPLIFY the handoff. ... AsdAIr should
//    prepare the right shop reliably. It does not need to become a supermarket
//    arbitrage desk."
//
// So no money reaches the reasoning consumer from here. The grounding packet
// carries no price field, the rendered lines carry no money, and the prompt no
// longer invites a value, offer or bargain judgement. The household rules that
// asked for one - best value per wash, buy up to the multibuy quantity, round a
// "any 2 for GBP X" quantity up to a pair - are archived as DATA in
// `asdair.rules`, which is Warwick's change to run. THIS MODULE HARD-CODES NO
// RULE ID, and archiving a rule is never a code change.
//
// The removal is the deliverable, not a regression, and it is not to be
// re-grown behind a flag: a dormant price path is precisely the thing being
// removed. `rulebook.test.js` holds a two-part control over it - a behavioural
// one (a priced catalogue still produces a packet with no money in it) and a
// source one whose forbidden vocabulary is pinned in README.md rather than in
// this file, so widening the code cannot widen its own check.
//
// -- WHAT THE MODULE IS STILL FOR -------------------------------------------
//
// The household's genuinely NON-PRICE prose: rotation, what an add-to-trolley
// failure actually means, exclusions, aliases, standing quantities. That job is
// real, it is unchanged, and it is still the 59% the deterministic planner
// cannot carry.
//
// -- WHAT THIS MODULE IS, AND WHAT IT DELIBERATELY IS NOT -------------------
//
// It is NOT a second directive vocabulary. No `directive='value'`, no
// `directive='rounding'`, no rule grammar, no matcher DSL, no registry. Adding
// a new deterministic directive type for every kind of judgement a household
// can express is an ever-growing mini-language that is always one household
// sentence behind -- and this estate has already paid once for exactly that
// shape of regrowth.
//
// THE PROSE IS THE INTERFACE. Terra is the interpreter.
//
// This module does four things and nothing else:
//
//   1. ENUMERATES the rules the deterministic planner never acts on.
//   2. SELECTS the ones plausibly relevant to the lines in front of us, and
//      assembles them - as the household's own words - into a grounding packet
//      and a prompt.
//   3. HANDS that to an INJECTED reasoning consumer. This module never opens a
//      socket, never reads an env var and never imports a model client. It is
//      pure apart from the callable it is given, exactly like the rest of the
//      planner half of this service.
//   4. APPLIES the reply to the plan, inside a narrow safety envelope, with
//      every change attributed to the rule id that caused it.
//
// -- THE SAFETY ENVELOPE, WHICH IS THE LOAD-BEARING PART --------------------
//
// A model reading household prose may:
//
//   * NAME A PRODUCT for a line the deterministic planner could not identify -
//     and only from the candidates it was actually shown, and only where the
//     line is held for an IDENTIFICATION cause (ambiguous / no mapping). It may
//     never overrule a `map` rule, an `exclude` rule, an out-of-stock, a
//     quantity conflict, a foreign-household product id, a rule that
//     deliberately holds the line, or any hold cause this module does not
//     recognise. Unrecognised cause -> untouched. Fail safe, not fail open.
//   * CHANGE A QUANTITY on a line that is already being bought, bounded, never
//     to zero. Exclusion stays deterministic: judgement can add nothing to the
//     basket that was excluded and can remove nothing that was not.
//   * ASK. Which is the third and most important verb.
//
// -- UNCERTAINTY IS SPOKEN, NEVER GUESSED AND NEVER SILENTLY PARKED ---------
//
// The failure this replaces is a rule falling silently on the floor. So an
// unclear rule, a self-contradicting pair of rules, a reply this module cannot
// map to a line, an answer naming a product nobody offered, a quantity outside
// the bound, or an attribution to a rule that was never sent - none of them
// degrade to "the deterministic answer, quietly". They become a QUESTION
// carrying the household's own words, or (where the line is not one this module
// may touch) a visible flag and an audit entry. Nothing is dropped in silence.
// =====================================================================
'use strict';

const termMatch = require('./termMatch.js');

// The complete verb list. THREE, and the third one is "ask".
//
// This is a REPLY contract for one model call - the same shape
// pipeline/deps.js already uses for `interpretAnswer` (a small closed
// vocabulary, anything outside it meaning "ask again"). It is NOT a rule
// vocabulary: no household rule is ever classified, tagged or stored as one of
// these, and adding a fourth is a design decision, not a way of teaching the
// system a new kind of rule. New kinds of rule need no code here at all - that
// is the entire point of prose.
const JUDGEMENT_KINDS = Object.freeze(['set_product', 'set_quantity', 'ask']);

// A weekly household line. A standing-quantity rule of the "we get through two
// a week" kind nudges a count by ones and twos; nothing legitimate here asks
// for forty. An unbounded numeric effect from a model reply is how a misread
// "76 washes" becomes 76 boxes in a real basket.
const MAX_JUDGED_QTY = 24;

// Hold causes this module may resolve. All three mean the same thing: the
// planner could not work out WHICH PRODUCT this is. That is the question a
// household judgement rule exists to answer.
const RESOLVABLE_CAUSES = Object.freeze([
  'ambiguous match',
  'ambiguous regulars match',
  'no explicit product mapping'
]);

// Flags that describe book-keeping rather than a hold CAUSE. A held line whose
// flags are all causes-we-may-resolve plus these is resolvable; any other flag
// - including one added by a future change nobody told this module about -
// makes the line untouchable. The list is an allowlist on purpose.
const BENIGN_FLAGS = Object.freeze([
  'never auto-substitute',
  'alternatives available',
  'one week only',
  'prior decision on record',
  'prior decision recorded as rules',
  'prior batch answer not split',
  'rule advisory',
  'matched from regulars',
  'no substitutes allowed'
]);

function normalise(value) {
  return String(value === null || value === undefined ? '' : value).trim().toLowerCase();
}

function sameHousehold(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

function ruleWords(rule) {
  // The household's own words, in the order a person would want to read them.
  // Identical preference order to planner.ruleReasonText - a rule must not read
  // differently depending on which path surfaced it.
  if (!rule) return '';
  const candidates = [rule.rule_text, rule.reason, rule.note];
  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function hasTarget(rule) {
  return normalise(rule && rule.match_term) !== '' || normalise(rule && rule.match_category) !== '';
}

// ---------------------------------------------------------------------
// 1. WHAT THE DETERMINISTIC PLANNER NEVER ACTS ON
//
// Mirrors planner.actionableRules() and planner.rotationInstructionsFromRules()
// as a NEGATIVE. Deliberately derived from the same two conditions rather than
// from a hand-listed set of rule ids, so a rule that becomes actionable (e.g. a
// row given a match_term) leaves this set automatically.
//
// NOTE what "inert" does and does not mean. planner.advisoryRules() already
// ECHOES targeted `info` rules onto a line's note and global ones into
// summary.advisories - the household's words are shown. They have still never
// CHANGED anything: no product, no quantity, no status. Carried, never applied.
// This module is about the applying.
// ---------------------------------------------------------------------
function inertRules(rules, household) {
  return (Array.isArray(rules) ? rules : []).filter(function (r) {
    if (!r || r.active === false) return false;
    if (r.household_id !== null && r.household_id !== undefined) {
      if (!sameHousehold(r.household_id, household)) return false;
    }
    const d = normalise(r.directive);
    // Consumed deterministically: any targeted directive other than info, plus
    // targeted `rotate` (rotationInstructionsFromRules). Everything else is on
    // the floor.
    if (d === 'rotate') return !hasTarget(r);
    if (d !== '' && d !== 'info') return !hasTarget(r);
    return true;   // info, or no directive at all (the README's default)
  });
}

// ---------------------------------------------------------------------
// 2. RELEVANCE - over-inclusive ON PURPOSE
//
// Sending 23 rules with every basket would be cheap in tokens and expensive in
// attention: a model given a wall of irrelevant prose applies it worse. Sending
// too few re-creates the defect this module exists to end.
//
// So the failure direction is chosen deliberately: OVER-INCLUDE. A rule is
// attached to a line when its target matches that line's text OR its resolved
// product name at ANY tier - advisory-grade similarity included - which is
// looser than the grade the planner requires before a rule may buy or drop
// anything. It can afford to be: nothing selected here can act on its own.
// The cost of a false positive is a sentence Terra reads and ignores; the cost
// of a false negative is the rule going back on the floor.
//
// A rule with NO target belongs to the whole basket (live rules 36 and 38) and
// is always included. A rule matching no line at all is omitted, and the COUNT
// of omissions is reported so the omission is visible rather than assumed.
// ---------------------------------------------------------------------
// A CATEGORY-targeted rule cannot be matched here at all, and that is a
// property of the plan rather than a shortcut: planBasket's public item shape
// carries no category (see the returned object at the end of planBasket), so
// there is nothing to compare a match_category against without dragging the raw
// list into this module's interface. Rather than let that class fall silently
// back on the floor - which is the exact defect being fixed - a category rule is
// carried at BASKET scope with its category stated in the prose, so the
// consumer can apply it to the lines it belongs to and ignore the rest. Chosen
// over-inclusion, declared, not a silent omission.
function ruleTouchesLine(rule, item) {
  const term = normalise(rule.match_term);
  if (term === '') return false;
  const names = [item.item_name];
  if (item.matched_product) names.push(item.matched_product);
  return names.some(function (n) {
    if (normalise(n) === '') return false;
    return termMatch.matchTerms(n, rule.match_term).tier !== null;
  });
}

function selectRelevantRules(items, rules, household) {
  const inert = inertRules(rules, household).filter(function (r) { return ruleWords(r) !== ''; });
  const basket = inert.filter(function (r) { return normalise(r.match_term) === ''; });
  const targeted = inert.filter(function (r) { return normalise(r.match_term) !== ''; });

  const used = [];
  const byLine = (Array.isArray(items) ? items : []).map(function (item) {
    const hits = targeted.filter(function (r) { return ruleTouchesLine(r, item); });
    hits.forEach(function (r) { if (used.indexOf(r) === -1) used.push(r); });
    return hits;
  });

  return {
    basket: basket,
    byLine: byLine,
    selected: basket.concat(used),
    omitted: targeted.filter(function (r) { return used.indexOf(r) === -1; }),
    // A rule whose every text field is empty carries nothing a reader could
    // act on. Counted, never silently equated with "no such rule".
    wordless: inertRules(rules, household).filter(function (r) { return ruleWords(r) === ''; })
  };
}

// ---------------------------------------------------------------------
// 3. THE GROUNDING PACKET AND THE PROMPT
//
// Only lines that a relevant rule actually speaks about are sent - the rest of
// the basket is not the consumer's business. Candidates come from the line's
// own `alternatives` array, which the planner has already ranked; a product
// name that was never offered is refused on the way back in (below), so the
// model is structurally unable to introduce one.
// ---------------------------------------------------------------------
function ruleIdOf(rule) {
  return (rule && rule.id !== undefined && rule.id !== null) ? rule.id : null;
}

function isResolvableHold(item) {
  if (!item || item.status !== 'needs_decision') return false;
  const flags = Array.isArray(item.flags) ? item.flags : [];
  const isCause = function (f) { return RESOLVABLE_CAUSES.indexOf(f) !== -1; };
  const isBenign = function (f) { return BENIGN_FLAGS.indexOf(f) !== -1; };
  if (!flags.some(isCause)) return false;
  return flags.every(function (f) { return isCause(f) || isBenign(f); });
}

function mayChangeQuantity(item) {
  if (!item || item.status !== 'add') return false;
  const flags = Array.isArray(item.flags) ? item.flags : [];
  return flags.indexOf('quantity conflict') === -1;
}

function buildRulebookGrounding(plan, rules, household) {
  const items = (plan && Array.isArray(plan.items)) ? plan.items : [];
  const rel = selectRelevantRules(items, rules, household);

  const lines = [];
  items.forEach(function (item, idx) {
    const lineRules = rel.byLine[idx] || [];
    const actionable = isResolvableHold(item) || mayChangeQuantity(item);
    // WHICH LINES ARE SHOWN.
    //   * a line a targeted rule names -> ALWAYS, even where nothing may be
    //     done to it: the consumer may still have a question worth carrying,
    //     and hiding the line hides the rule again.
    //   * a line no targeted rule names -> only when a BASKET-scope rule exists
    //     AND something may actually be done to the line. A line that can
    //     neither be identified nor re-counted contributes nothing to a
    //     basket-wide rule except prompt weight.
    if (lineRules.length === 0 && !(rel.basket.length > 0 && actionable)) return;
    const applicable = lineRules.concat(rel.basket);
    lines.push({
      line_no: idx + 1,
      item_name: item.item_name,
      matched_product: item.matched_product,
      status: item.status,
      requested_qty: item.requested_qty,
      planned_qty: item.planned_qty,
      note: item.note || '',
      // NAMES ONLY. The planner's `alternatives` rows carry a price field; it
      // is dropped here and never forwarded. A consumer that cannot see money
      // cannot be asked to shop on it, which is the removal Warwick ordered
      // made structural rather than merely instructed.
      candidates: (Array.isArray(item.alternatives) ? item.alternatives : []).map(function (a) {
        return { name: a.name };
      }),
      may_set_product: isResolvableHold(item),
      may_set_quantity: mayChangeQuantity(item),
      rule_ids: applicable.map(ruleIdOf).filter(function (v) { return v !== null; })
    });
  });

  if (lines.length === 0) return null;

  const seen = [];
  const sent = [];
  lines.forEach(function (l) {
    l.rule_ids.forEach(function (id) { if (seen.indexOf(String(id)) === -1) seen.push(String(id)); });
  });
  rel.selected.forEach(function (r) {
    const id = ruleIdOf(r);
    if (id === null) return;
    if (seen.indexOf(String(id)) === -1) return;
    if (sent.some(function (s) { return String(s.id) === String(id); })) return;
    const byTerm = normalise(r.match_term) !== '';
    sent.push({
      id: id,
      target: byTerm ? r.match_term : (r.match_category || null),
      scope: byTerm ? 'line' : (r.match_category ? 'category' : 'basket'),
      text: ruleWords(r)
    });
  });

  return {
    household: household === undefined ? null : household,
    lines: lines,
    rules: sent,
    omitted_rule_count: rel.omitted.length,
    wordless_rule_count: rel.wordless.length
  };
}

function renderRules(rules) {
  return rules.map(function (r) {
    let where = 'WHOLE BASKET';
    if (r.scope === 'line') where = 'about: ' + r.target;
    else if (r.scope === 'category') where = 'any item in category: ' + r.target;
    return '  [rule ' + r.id + '] (' + where + ') ' + r.text;
  }).join('\n');
}

function renderLines(lines) {
  return lines.map(function (l) {
    const bits = [
      '  line ' + l.line_no + ': "' + l.item_name + '"',
      '    resolved product : ' + (l.matched_product || '(none - the planner could not identify it)'),
      '    planner status   : ' + l.status
        + ' (asked for ' + l.requested_qty + ', planning ' + l.planned_qty + ')',
      '    rules about it   : ' + (l.rule_ids.length ? l.rule_ids.join(', ') : '(basket rules only)')
    ];
    if (l.note) bits.push('    what is known    : ' + l.note);
    if (l.candidates.length) {
      // NAMES ONLY, and no money in any form - not a figure, not "unknown", not
      // a currency word. Saying "(unknown)" beside a choice is still an
      // invitation to shop on the thing that is unknown.
      bits.push('    choices offered  :');
      l.candidates.forEach(function (c) {
        bits.push('      - ' + c.name);
      });
    }
    const may = [];
    if (l.may_set_product) may.push('set_product');
    if (l.may_set_quantity) may.push('set_quantity');
    may.push('ask');
    bits.push('    you may          : ' + may.join(' | '));
    return bits.join('\n');
  }).join('\n\n');
}

function buildRulebookPrompt(grounding) {
  return `You are applying ONE household's own standing shopping rules to this week's planned basket.

These rules are the household's WORDS, not a program. They were written by the person who shops here.
Several of them express a JUDGEMENT ("rotate the scent", "that means the blue one", "we get through two
a week") which no deterministic matcher can carry out, which is why they are being shown to you.

YOU ARE NOT SHOPPING FOR MONEY. You are shown no money at all - no shelf figures, no offers, no pack
economics - and you must not ask for them, estimate them or reason about them. Which item is the
better buy is not your question and is not this system's question; a person makes that call at the
shop. If a rule can only be settled by comparing what things cost, say so with "ask" and stop there.

THEIR STANDING RULES THAT BEAR ON THIS BASKET:
${renderRules(grounding.rules)}

THE PLANNED LINES THOSE RULES SPEAK ABOUT:
${renderLines(grounding.lines)}

WHAT YOU MAY DO, PER LINE - and each line says which of these it will accept:
  set_product   name ONE product for this line, copied EXACTLY from the choices offered on that line.
                Never a product that is not in that list. Never a product for a line that does not
                offer set_product.
  set_quantity  a whole number of units, at least 1 and at most ${MAX_JUDGED_QTY}.
  ask           you cannot apply the rule confidently. SAY SO.

WHEN TO ASK - this matters more than getting an answer:
  * the rule needs information you were not given (what was bought last week, what something costs,
    what is on offer) - ASK. Do not estimate it, and do not fall back on what the planner already
    decided.
  * two rules point different ways on the same line - ASK, and say which two.
  * the rule's words are unclear, or you are not sure it is really about this line - ASK.
An answer you are unsure of is worse than a question. A question costs one tap; a wrong product costs
a real weekly shop.

EVERY judgement must name the rule id that caused it. A change nobody can trace back to one of the
rules above will be rejected, because the household has to be able to ask "why did it do that" and get
an answer.

Return ONLY strict JSON, no prose and no code fences:

{"judgements":[{"line_no":1,
                "rule_id":32,
                "kind":"one of: ${JUDGEMENT_KINDS.join(' | ')}",
                "product":null,
                "quantity":null,
                "why":"one short sentence a person would accept as the reason"}]}

product is used only with set_product, quantity only with set_quantity, and both are null for ask.
Return an empty judgements list if none of the rules changes anything - that is a valid answer.`;
}

// Accepts either an already-parsed object or the raw text a model returns.
// Anything unusable returns null, which the caller treats as "the consumer said
// nothing" - never as "the consumer approved the plan".
function parseRulebookReply(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      obj = JSON.parse(raw.slice(start, end + 1));
    } catch (e) {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  if (!Array.isArray(obj.judgements)) return null;
  return { judgements: obj.judgements };
}

// ---------------------------------------------------------------------
// 4. APPLYING THE REPLY
//
// Every rejection below is RECORDED, not swallowed. The audit is the answer to
// "why did it do that", and equally to "why did it NOT do that".
// ---------------------------------------------------------------------
function cloneItem(item) {
  return {
    item_name: item.item_name,
    matched_product: item.matched_product,
    requested_qty: item.requested_qty,
    planned_qty: item.planned_qty,
    status: item.status,
    flags: (Array.isArray(item.flags) ? item.flags.slice() : []),
    note: item.note,
    alternatives: item.alternatives
  };
}

function addFlag(item, flag) {
  if (item.flags.indexOf(flag) === -1) item.flags.push(flag);
}

function addNote(item, text) {
  if (!text) return;
  if (item.note && item.note.indexOf(text) !== -1) return;
  item.note = item.note ? (item.note + '; ' + text) : text;
}

function askOnLine(item, rule, why) {
  // A question, carrying the household's OWN words plus whatever the consumer
  // could say about why it could not decide. An `add` line becomes a question;
  // a line that is already a question gets the rule's reason attached to it,
  // which is the property ruleConsumption.test.js already holds the planner to.
  const words = rule ? ruleWords(rule) : '';
  const id = rule ? ruleIdOf(rule) : null;
  addFlag(item, 'rulebook question');
  if (id !== null) addFlag(item, 'rulebook rule ' + id);
  const parts = [];
  if (id !== null && words) parts.push('rule ' + id + ' could not be applied: "' + words + '"');
  else if (words) parts.push('a household rule could not be applied: "' + words + '"');
  else parts.push('a household rule could not be applied');
  if (why) parts.push(String(why).trim());
  addNote(item, parts.join(' - '));
  if (item.status === 'add') {
    item.status = 'needs_decision';
    item.planned_qty = 0;
    addFlag(item, 'never auto-substitute');
  }
}

function recordApplied(audit, entry) { audit.applied.push(entry); }
function recordRejected(audit, entry) { audit.rejected.push(entry); }

function applyJudgement(j, ctx) {
  const audit = ctx.audit;
  const lineNo = Number(j && j.line_no);
  const item = ctx.byLineNo.get(lineNo);
  if (!item) {
    recordRejected(audit, { line_no: (j && j.line_no) === undefined ? null : j.line_no, rule_id: (j && j.rule_id) === undefined ? null : j.rule_id, reason: 'no such line was sent' });
    return;
  }
  const rule = ctx.rulesById.get(String(j && j.rule_id));
  if (!rule) {
    // Attribution failure. The change is refused (AC4 has no exception), and
    // the LINE is flagged so a silently-unapplied rule cannot look like a rule
    // that had nothing to say.
    recordRejected(audit, { line_no: lineNo, rule_id: (j && j.rule_id) === undefined ? null : j.rule_id, reason: 'rule id was not among the rules sent' });
    addFlag(item, 'rulebook answer rejected');
    addNote(item, 'a rulebook answer was refused because it named no rule that was sent');
    return;
  }

  const kind = normalise(j.kind);
  if (JUDGEMENT_KINDS.indexOf(kind) === -1 || kind === 'ask') {
    // An unknown verb is treated exactly as `ask`: unknown means ask again.
    askOnLine(item, rule, j && j.why);
    recordRejected(audit, {
      line_no: lineNo, rule_id: ruleIdOf(rule),
      reason: kind === 'ask' ? 'consumer asked' : 'unknown judgement kind "' + kind + '" - treated as ask'
    });
    return;
  }

  if (kind === 'set_product') {
    if (!isResolvableHold(item)) {
      recordRejected(audit, { line_no: lineNo, rule_id: ruleIdOf(rule), reason: 'line is not held for a cause a rule may resolve (status ' + item.status + ')' });
      addFlag(item, 'rulebook answer rejected');
      return;
    }
    const offered = (Array.isArray(item.alternatives) ? item.alternatives : []).map(function (a) { return a.name; });
    const chosen = offered.find(function (n) { return normalise(n) === normalise(j.product); });
    if (!chosen) {
      // The three-guards discipline of pipeline/deps.js: the prompt asks, the
      // code enforces. A product nobody offered is not a match - it becomes a
      // question rather than a purchase.
      askOnLine(item, rule, 'the answer named a product that was not among the choices offered');
      recordRejected(audit, { line_no: lineNo, rule_id: ruleIdOf(rule), reason: 'product "' + String(j.product) + '" was not offered on this line' });
      return;
    }
    const from = item.matched_product;
    item.matched_product = chosen;
    item.status = 'add';
    item.planned_qty = item.requested_qty;
    addFlag(item, 'chosen by household rule');
    addFlag(item, 'rulebook rule ' + ruleIdOf(rule));
    addNote(item, 'rule ' + ruleIdOf(rule) + ' chose this: ' + (j.why ? String(j.why).trim() : ruleWords(rule)));
    recordApplied(audit, {
      line_no: lineNo, item_name: item.item_name, rule_id: ruleIdOf(rule),
      kind: 'set_product', from: from, to: chosen, why: j.why || ruleWords(rule)
    });
    // planned_qty moved from 0 to a real count, so any basket estimate computed
    // before this pass is now wrong. Same invalidation as a quantity change.
    ctx.quantityChanged = true;
    return;
  }

  // set_quantity
  if (!mayChangeQuantity(item)) {
    recordRejected(audit, { line_no: lineNo, rule_id: ruleIdOf(rule), reason: 'quantity may only change on a line that is being bought (status ' + item.status + ')' });
    addFlag(item, 'rulebook answer rejected');
    return;
  }
  const qty = Number(j.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_JUDGED_QTY) {
    askOnLine(item, rule, 'the answer gave a quantity this module will not apply unchecked (' + String(j.quantity) + ')');
    recordRejected(audit, { line_no: lineNo, rule_id: ruleIdOf(rule), reason: 'quantity ' + String(j.quantity) + ' outside 1..' + MAX_JUDGED_QTY + ' or not a whole number' });
    return;
  }
  const fromQty = item.planned_qty;
  if (qty === fromQty) {
    recordRejected(audit, { line_no: lineNo, rule_id: ruleIdOf(rule), reason: 'quantity already ' + qty + ' - nothing to change' });
    return;
  }
  item.planned_qty = qty;
  addFlag(item, 'quantity set by household rule');
  addFlag(item, 'rulebook rule ' + ruleIdOf(rule));
  addNote(item, 'rule ' + ruleIdOf(rule) + ' set the quantity to ' + qty + ': ' + (j.why ? String(j.why).trim() : ruleWords(rule)));
  recordApplied(audit, {
    line_no: lineNo, item_name: item.item_name, rule_id: ruleIdOf(rule),
    kind: 'set_quantity', from: fromQty, to: qty, why: j.why || ruleWords(rule)
  });
  ctx.quantityChanged = true;
}

function recount(plan, quantityChanged, audit) {
  const items = plan.items;
  const excludedStanding = items.filter(function (it) { return it.status === 'excluded'; }).length;
  const excludedThisWeek = items.filter(function (it) { return it.status === 'excluded_this_week'; }).length;
  const summary = Object.assign({}, plan.summary, {
    total_requested: items.length,
    planned_add: items.filter(function (it) { return it.status === 'add'; }).length,
    needs_decision: items.filter(function (it) { return it.status === 'needs_decision'; }).length,
    excluded: excludedStanding + excludedThisWeek,
    excluded_standing: excludedStanding,
    excluded_this_week: excludedThisWeek,
    rulebook: audit
  });
  // The estimate was computed from unit prices this module cannot see, so a
  // changed count makes it WRONG rather than stale. A number that is wrong is
  // worse than no number: budget_flag is read by a human. Dropped, loudly.
  if (quantityChanged && summary.estimated_total !== null && summary.estimated_total !== undefined) {
    summary.estimated_total = null;
    summary.budget_flag = 'unknown';
    audit.estimate_invalidated = true;
  }
  return { items: items, summary: summary };
}

/**
 * Apply the household's prose rulebook to a computed plan.
 *
 * PURE except for `consult`, which is injected. This module performs no I/O of
 * any kind and holds no credential.
 *
 * @param {object}   spec
 * @param {object}   spec.plan       a planBasket() result: { items, summary }
 * @param {Array}    spec.rules      the SAME rules array planBasket was given
 * @param {*}        [spec.household] active household id
 * @param {Function} spec.consult    async (grounding) => reply | reply text.
 *                                   Given the grounding packet; returns either
 *                                   `{ judgements: [...] }` or the raw model
 *                                   text containing that JSON.
 * @returns {Promise<{plan: object, grounding: object|null, audit: object}>}
 *          A NEW plan. The input plan is never mutated.
 */
async function applyRulebook(spec) {
  const args = spec || {};
  const plan = args.plan;
  if (!plan || !Array.isArray(plan.items)) {
    throw new Error('applyRulebook: plan is required (the planBasket result)');
  }
  const household = args.household === undefined ? null : args.household;

  const audit = {
    consulted: false,
    applied: [],
    rejected: [],
    rules_sent: [],
    rules_omitted: 0,
    rules_wordless: 0,
    error: null
  };

  const grounding = buildRulebookGrounding(plan, args.rules, household);
  const items = plan.items.map(cloneItem);
  const working = { items: items, summary: plan.summary };

  if (!grounding) {
    // No inert rule speaks about any line. Nothing to consult about - and
    // saying so explicitly is what stops a silent no-op looking like a
    // consultation that approved everything.
    return { plan: recount(working, false, audit), grounding: null, audit: audit };
  }

  audit.rules_sent = grounding.rules.map(function (r) { return r.id; });
  audit.rules_omitted = grounding.omitted_rule_count;
  audit.rules_wordless = grounding.wordless_rule_count;

  if (typeof args.consult !== 'function') {
    throw new Error('applyRulebook: consult must be a function (the injected reasoning consumer)');
  }

  let reply = null;
  try {
    reply = parseRulebookReply(await args.consult(grounding));
    audit.consulted = true;
  } catch (e) {
    // THE CONSUMER WAS UNREACHABLE. Deliberately NOT turned into a question per
    // line: a gateway outage would then fill the basket with forty identical
    // questions, which is noise, and noise is how a real signal gets missed.
    // Instead every line the rulebook would have spoken about carries a visible
    // flag, and the basket says once, loudly, that the household's judgement
    // rules did not run this week. Silence is the one option not on the table.
    audit.error = String((e && e.message) || e);
    grounding.lines.forEach(function (l) {
      const item = items[l.line_no - 1];
      if (item) addFlag(item, 'rulebook not consulted');
    });
    return { plan: recount(working, false, audit), grounding: grounding, audit: audit };
  }

  if (!reply) {
    audit.error = 'the reasoning consumer returned nothing this module could read';
    grounding.lines.forEach(function (l) {
      const item = items[l.line_no - 1];
      if (item) addFlag(item, 'rulebook not consulted');
    });
    return { plan: recount(working, false, audit), grounding: grounding, audit: audit };
  }

  const byLineNo = new Map();
  grounding.lines.forEach(function (l) {
    const item = items[l.line_no - 1];
    if (item) byLineNo.set(l.line_no, item);
  });
  const rulesById = new Map();
  (Array.isArray(args.rules) ? args.rules : []).forEach(function (r) {
    const id = ruleIdOf(r);
    if (id === null) return;
    if (grounding.rules.some(function (s) { return String(s.id) === String(id); })) rulesById.set(String(id), r);
  });

  const ctx = { byLineNo: byLineNo, rulesById: rulesById, audit: audit, quantityChanged: false };
  reply.judgements.forEach(function (j) { applyJudgement(j, ctx); });

  return { plan: recount(working, ctx.quantityChanged, audit), grounding: grounding, audit: audit };
}

module.exports = {
  applyRulebook: applyRulebook,
  buildRulebookGrounding: buildRulebookGrounding,
  buildRulebookPrompt: buildRulebookPrompt,
  parseRulebookReply: parseRulebookReply,
  inertRules: inertRules,
  JUDGEMENT_KINDS: JUDGEMENT_KINDS,
  MAX_JUDGED_QTY: MAX_JUDGED_QTY,
  // exported for unit tests of the pure helpers
  _internal: {
    selectRelevantRules: selectRelevantRules,
    isResolvableHold: isResolvableHold,
    mayChangeQuantity: mayChangeQuantity,
    ruleWords: ruleWords,
    RESOLVABLE_CAUSES: RESOLVABLE_CAUSES,
    BENIGN_FLAGS: BENIGN_FLAGS
  }
};
