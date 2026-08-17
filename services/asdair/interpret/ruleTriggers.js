// =====================================================================
// BUILD-015 AsdAIr - interpret/ruleTriggers.js
//
// THE HOUSEHOLD'S PROSE RULEBOOK, MADE DETERMINISTIC WHERE IT IS UNAMBIGUOUS.
//
// ── WHAT THIS CLOSES ────────────────────────────────────────────────────────
// The rulebook is prose. `skill/planner.js actionableRules()` keeps only rows
// carrying a `match_term` or `match_category` column, and the household's most
// useful rules carry neither:
//
//   rule 11  "Toffees with no qualifier means ASDA Dairy Toffee 180g"
//   rule 50  "Sure deodorant male: ALWAYS take ... (regular 25). FIXED CHOICE
//             - do NOT rotate, do NOT offer variants, do NOT ask."
//
// Both were active on 2026-08-17. Both name a real product in words a person
// reads without effort. Both were ignored, and Warwick was asked about the
// toffees and the deodorant anyway. That is the defect this module exists for.
//
// ── THE RULE THAT KEEPS IT SAFE: THE CATALOGUE STILL DECIDES IDENTITY ───────
// Nothing here reads a product identity out of prose. A rule may only point at
// a row THIS HOUSEHOLD ALREADY HAS - by explicit id ("regular 25"), or because
// the regular's own catalogue name appears in the rule text. If the target does
// not resolve to EXACTLY ONE active regular, the rule contributes NOTHING and
// the line takes its ordinary course. A rule that cannot be read precisely is
// left to the reasoning consumer exactly as it is today; it is never guessed
// at, and it can never invent a product.
//
// ── AND AN EXCLUSION MAY NEVER NAME A PRODUCT TO BUY ────────────────────────
// "Yazoo: NEVER buy Banana" names a product in order to REFUSE it. Reading that
// as "Yazoo means Banana" would buy the one thing Warwick has forbidden twice.
// So the directive gates the power: `map` may establish identity, `exclude` may
// only remove a candidate, and nothing else does either.
//
// PURE. No database, no model, no clock. ASCII only.
'use strict';

const termMatch = require('../skill/termMatch.js');

// A trigger shorter than this is a filler word, not a name the household uses.
const MIN_TRIGGER_LEN = 4;

// Words that appear in a rule's phrasing rather than in Mum's list. A trigger
// made only of these is not a trigger.
const STOPWORDS = Object.freeze([
  'the', 'a', 'an', 'and', 'or', 'of', 'with', 'for', 'no', 'not', 'only',
  'any', 'all', 'means', 'mean', 'is', 'are', 'be', 'buy', 'add', 'take',
  'use', 'pick', 'this', 'that', 'it', 'if', 'on', 'in', 'to', 'from',
  'mum', 'mums', 'warwick', 'rule', 'always', 'never', 'ever',
]);

function isMeaningful(phrase) {
  const tokens = termMatch.tokensOf(phrase);
  if (tokens.length === 0) return false;
  const solid = tokens.filter((t) => STOPWORDS.indexOf(t) === -1 && t.length >= 3);
  if (solid.length === 0) return false;
  return termMatch.normaliseMatchText(phrase).length >= MIN_TRIGGER_LEN;
}

/**
 * PURE. Which single active regular does this rule point at, if any?
 *
 * Two routes, both requiring the catalogue to agree:
 *   1. an EXPLICIT id - "(regular 25)" - which must exist and be active;
 *   2. the regular's OWN CATALOGUE NAME appearing in the rule text.
 *
 * Route 2 takes the LONGEST unambiguous name, so "ASDA Toffee Assortment 200g"
 * cannot be beaten by a shorter row that happens to share words, and returns
 * null the moment two rows are equally named in the text. Ambiguity here is
 * resolved by refusing, never by ranking.
 */
function targetRegularOf(ruleText, regulars) {
  const text = String(ruleText || '');
  const squashedText = termMatch.squashMatchText(text);

  const explicit = /\bregulars?\s+(\d+)\b/i.exec(text);
  if (explicit) {
    const id = Number(explicit[1]);
    const hit = regulars.find((r) => Number(r.id) === id);
    if (hit) return { regular: hit, via: `rule names regular ${id}` };
    return null;
  }

  const named = regulars
    .filter((r) => {
      const squashedName = termMatch.squashMatchText(r.name);
      return squashedName.length >= 12 && squashedText.indexOf(squashedName) !== -1;
    })
    .sort((a, b) => termMatch.squashMatchText(b.name).length - termMatch.squashMatchText(a.name).length);

  if (named.length === 0) return null;
  // Two rows named equally precisely is a genuine ambiguity in the rule itself.
  if (named.length > 1
    && termMatch.squashMatchText(named[0].name).length === termMatch.squashMatchText(named[1].name).length) {
    return null;
  }
  return { regular: named[0], via: `rule names "${named[0].name}"` };
}

/**
 * PURE. The leading naming part of a rule's subject, before any qualifying
 * clause. The household writes "Toffees WITH NO QUALIFIER means ..." - the
 * thing Mum actually writes on the list is "Toffees", and the rest is the rule
 * explaining itself. Splitting on a clause marker recovers the name without
 * anyone having to enumerate rules one at a time.
 *
 * Kept deliberately blunt: it only ever SHORTENS a phrase that already came
 * from the rule's own subject, so the worst case is a trigger that fails to
 * match and a line that takes its ordinary course.
 */
function leadingNounPhrase(head) {
  return String(head || '')
    .split(/\s*(?:,|;|\bwith\b|\bwhen\b|\bif\b|\bwithout\b|\bexcept\b|\bunless\b|\()/i)[0]
    .trim();
}

/**
 * PURE. The phrases in a rule that identify the LINE it speaks about.
 *
 * The household writes its rules in three shapes, and all three are read
 * literally rather than interpreted:
 *
 *   Mum's "Fruit Splits" = ...        -> the quoted phrase
 *   Toffees with no qualifier means ..-> everything before "means"
 *   Sure deodorant male: ALWAYS take ..-> everything before the colon
 *
 * A phrase that survives is one a person would recognise on a shopping list.
 * Anything else is dropped rather than stretched into a trigger.
 */
function triggerPhrasesOf(ruleText) {
  const text = String(ruleText || '');
  const found = [];

  const quoted = text.match(/"([^"]{2,60})"/g) || [];
  for (const q of quoted) found.push(q.slice(1, -1));

  const meansAt = text.search(/\s+(?:means|=)\s+/i);
  if (meansAt > 0) {
    let head = text.slice(0, meansAt);
    // "Mum's "Fruit Splits"" has already contributed its quoted form.
    head = head.replace(/"[^"]*"/g, ' ').replace(/^[^A-Za-z0-9]+/, '');
    found.push(head);
    found.push(leadingNounPhrase(head));
  }

  const colonAt = text.indexOf(':');
  if (colonAt > 0 && colonAt <= 60) {
    found.push(text.slice(0, colonAt));
    found.push(leadingNounPhrase(text.slice(0, colonAt)));
  }

  const out = [];
  for (const raw of found) {
    const phrase = String(raw).replace(/\s+/g, ' ').trim();
    if (!isMeaningful(phrase)) continue;
    const norm = termMatch.normaliseMatchText(phrase);
    if (out.indexOf(norm) === -1) out.push(norm);
  }
  return out;
}

/**
 * PURE. Turn the household's active rules into deterministic identity evidence.
 *
 * Returns one entry per rule that could be read PRECISELY - never one per rule.
 * A rule this module cannot read contributes nothing and is not reported as a
 * failure: it is prose, and prose is what the reasoning consumer is for.
 *
 * @param {Array<{id:*, directive:string, rule_text:string, active?:boolean}>} rules
 * @param {Array<object>} regulars active household regulars
 * @returns {Array<{rule_id:*, directive:string, power:'identity'|'exclude',
 *                  regular_id:number, regular_name:string, triggers:string[],
 *                  why:string}>}
 */
function extractRuleTriggers(rules, regulars) {
  const out = [];
  for (const rule of (Array.isArray(rules) ? rules : [])) {
    if (!rule || rule.active === false) continue;
    const directive = String(rule.directive || '').toLowerCase();
    // ── THE DIRECTIVE GATES THE POWER ──────────────────────────────────────
    // `map` and `info` are the household stating what a line MEANS. `exclude`
    // names a product in order to refuse it and may only ever remove one.
    // Anything else (needs_decision, rotate) deliberately does neither here:
    // those say "ask" or "vary", which is not an identity claim.
    let power = null;
    if (directive === 'map' || directive === 'info') power = 'identity';
    else if (directive === 'exclude') power = 'exclude';
    if (power === null) continue;

    const target = targetRegularOf(rule.rule_text, regulars);
    if (!target) continue;

    const triggers = triggerPhrasesOf(rule.rule_text);
    if (triggers.length === 0) continue;

    out.push({
      rule_id: rule.id,
      directive,
      power,
      regular_id: Number(target.regular.id),
      regular_name: target.regular.name,
      triggers,
      why: target.via,
    });
  }
  return out;
}

/**
 * PURE. Does any rule speak about this line, and what does it say?
 *
 * A trigger must match the line at a CONFIDENT tier of the shared matcher -
 * the same bar an alias has to clear to establish identity, for the same
 * reason: a rule that fires on the wrong line is a wrong product, and a rule
 * that fails to fire is a question. Those costs are not comparable.
 *
 * @returns {{identity: object|null, excluded: number[], applied: object[]}}
 */
function consultRules(rawReading, ruleTriggers) {
  const applied = [];
  const excluded = [];
  let identity = null;

  for (const t of (Array.isArray(ruleTriggers) ? ruleTriggers : [])) {
    const hit = t.triggers.some((phrase) => termMatch.matchTerms(rawReading, phrase).confident);
    if (!hit) continue;
    applied.push(t);
    if (t.power === 'exclude') {
      if (excluded.indexOf(t.regular_id) === -1) excluded.push(t.regular_id);
      continue;
    }
    // TWO RULES CLAIMING ONE LINE IS NOT A TIE TO BREAK. The household has said
    // two different things about the same words, and choosing between them is
    // exactly the human decision this system exists to protect.
    if (identity && identity.regular_id !== t.regular_id) {
      identity = { conflict: true, rules: [identity.rule_id, t.rule_id] };
    } else if (!identity || !identity.conflict) {
      identity = t;
    }
  }

  return { identity: identity && identity.conflict ? null : identity, excluded, applied };
}

module.exports = {
  extractRuleTriggers,
  consultRules,
  targetRegularOf,
  triggerPhrasesOf,
  MIN_TRIGGER_LEN,
};
