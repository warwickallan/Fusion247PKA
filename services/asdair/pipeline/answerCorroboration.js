// =====================================================================
// A MODEL MAPPING IS NOT EVIDENCE.  (WO-2026-08-18-03, AC1)
//
// ── WHAT HAPPENED, FROM THE DURABLE ROWS AND NOT FROM THE STORY ──────
//
// On 2026-08-17 a photographed weekly list opened NINE questions in a
// single planning pass (runPipeline.js, the loop that calls
// shopStore.openQuestion). Warwick then typed his answers. Seven were
// written to `asdair.shop_question` between 18:19:19.475Z and
// 18:19:21.938Z - 2.5 seconds, roughly 350ms apart. The first THREE
// bound correctly. From the fourth on, every answer landed on the
// question ABOVE the one it answers, and two were never recorded at all.
//
// ── WHY THE OBVIOUS SUSPECT IS INNOCENT ──────────────────────────────
//
// It is tempting to blame `correlateTypedAnswer` step 2, which binds a
// bare typed message to "the single open question". It cannot have been
// that: step 2 is guarded by `scoped.length === 1` and nine questions
// were open. Step 1 needs the words to EQUAL a candidate label and none
// of them did. `parseBoardReply` needs a leading "4:" and none of them
// had one.
//
// That leaves step 3 - Terra - which is wired in production
// (deps.js: `correlateAnswer: realCorrelateAnswer`). It returned
// `confidence: 'high'` and runtime.js wrote the mapping STRAIGHT
// THROUGH onto a row whose `answerQuestion` is a compare-and-set. First
// answer wins, so the wrong answer was permanent the instant it landed,
// and the only escape left was to cancel the whole shop. Warwick
// cancelled the whole shop.
//
// ── THE RULE THIS MODULE IMPLEMENTS ──────────────────────────────────
//
// CORRELATION POLICY = A, CONTRADICTION-ONLY. Warwick's ruling of
// 2026-08-18, in his own words:
//
//   "Preserve the existing shorthand behaviour. Use the narrow
//    corroboration rule: if Warwick's words clearly belong to a
//    different open question, refuse the proposed binding and ask;
//    otherwise preserve the shorthand/deictic path that already works.
//    Do NOT implement B and do not increase ordinary shopping
//    interruptions merely to make correlation stricter."
//
// So: REFUSE A MAPPING ONLY WHEN THE WORDS POSITIVELY SUPPORT A
// DIFFERENT OPEN QUESTION. Where they support nothing in particular -
// "the four pack", "the big ones please" - the mapping BINDS, exactly as
// it does today. The model's confidence is overruled by evidence
// pointing somewhere else; it is NOT overruled by the mere absence of
// evidence.
//
// THE STRICTER RULE WAS BUILT, MEASURED AND WITHDRAWN, and that is
// recorded here so nobody re-derives it as an improvement. Requiring
// positive support for the mapped question closed the same two mis-binds
// AND refused every deictic answer, failing two committed tests -
// B15-18 AC2b and B15-18 AC5a - one of which records in its own
// assertion message that refusing that path "would delete a path that
// resolves correctly today". Warwick chose to keep the shorthand. Do not
// reinstate strict.
//
// ── THE RESIDUAL. ACKNOWLEDGED BY HIM, AND NOT WAIVED ────────────────
//
// Contradiction-only does NOT catch a wrong binding whose words support
// nothing at all. Row 6 of the corpus is a live example: "there is a
// rule about this" supports no question, so it binds wherever the model
// put it. His words on that residual:
//
//   "an answer that matches nothing at all is still accepted and cannot
//    be changed afterwards. That permanence is not acceptable as the
//    completed North Star."
//
// The answer is answer CORRECTION, which he UNPARKED in the same ruling.
// It is a separate Work Order with its own audit trail. It is NOT closed
// by tightening this file, and tightening this file is what he refused.
//
//   "Ice lollies are in favourites. stupid question"
//        vs "1 x 4pk Ben & Jerry's cookie dough"   -> NO SUPPORT, refuse
//        vs "1 pk fruit lolly ice"                 -> lolly, ice, accept
//
// That pair is the whole design in two lines, and it is the pair the
// replay test asserts: the SAME words are refused against the question
// they were mis-bound to and accepted against the question they answer.
// A gate that refused both would be a mute button, not a repair.
//
// ── DISCRIMINATING, NOT MERELY SHARED ────────────────────────────────
//
// A shared word only counts when it belongs to ONE question in the open
// set. "asda" appears in two of the nine, so "the asda one" names
// neither. This is what keeps the stopword list small and honest: the
// open set tunes the gate itself, and a word that cannot tell two open
// questions apart is not evidence about either. The list below only has
// to carry words that would falsely match while a question happens to be
// alone in offering them - packaging, sizes, retailer names.
//
// ── WHICH WAY IT FAILS, AND IT IS NOT THE SAFE-LOOKING DIRECTION ─────
//
// Towards BINDING. Under Warwick's ruling an unsupported answer is
// written rather than questioned, because interrupting him on every
// shorthand reply is a real cost he has explicitly refused to pay.
// Asking happens only where the words point somewhere else. That is a
// deliberate trade with a named owner and a named successor Work Order -
// not an oversight in this file, and not a thing to quietly harden.
//
// PURE. No I/O, no deps, no model, zero dependencies.
// =====================================================================

/**
 * Words that appear in item names and product labels without telling two
 * of them apart. Dropped BEFORE the uniqueness test, because a word that
 * is unique only by accident of what else happens to be open is still a
 * bad reason to write a permanent row.
 *
 * Deliberately short. The uniqueness rule does the heavy lifting, and a
 * long list of "common words" would eventually swallow a real brand.
 */
const STOPWORDS = new Set([
  // retailer and own-brand noise
  'asda', 'own', 'brand', 'value', 'essential',
  // packaging and quantity
  'pack', 'packet', 'pkt', 'box', 'bag', 'bottle', 'jar', 'tub', 'pot',
  'tin', 'can', 'carton', 'punnet', 'multipack', 'size', 'each', 'per',
  // generic descriptors
  'large', 'small', 'medium', 'mini', 'maxi', 'twin', 'family', 'standard',
  'regular', 'original', 'classic', 'plain', 'free', 'new', 'item',
  'product', 'thing', 'one', 'some', 'any',
  // grammar that survives the length filter
  'and', 'the', 'for', 'with', 'from', 'this', 'that', 'these', 'those',
  'not', 'but', 'you', 'your', 'are', 'was', 'were', 'has', 'had', 'have',
  'which', 'what', 'when', 'who', 'why', 'how', 'all', 'out', 'off', 'non',
]);

/** Shortest token worth considering. Two characters carry no evidence:
 *  "pk", "ml", "1l", "x2" match everything and mean nothing. */
const MIN_TOKEN_CHARS = 3;

/**
 * PURE. Crude, deliberate singularisation.
 *
 * "toffees"/"toffee", "lollies"/"lolly" and "wipes"/"wipe" are the same
 * word in every way this gate cares about, and an exact-token rule that
 * missed them would send Warwick a question about an answer that plainly
 * named the item. This is not a stemmer and is not trying to be one - it
 * is three rules that cover English plurals on grocery nouns.
 */
function fold(token) {
  if (token.length >= 5 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  // "boxes" -> "box", "dishes" -> "dish", "glasses" -> "glass".
  if (token.length >= 5 && token.endsWith('es') && /[sxzh]$/.test(token.slice(0, -2))) {
    return token.slice(0, -2);
  }
  // "eggs" -> "egg". Never "glass" -> "glas".
  if (token.length >= 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/**
 * PURE. The evidence-bearing words of a piece of text.
 *
 * Lowercased, split on anything that is not a letter or digit, folded,
 * short words and stopwords dropped. Returns a Set so a caller cannot
 * accidentally count the same word twice.
 */
export function tokenise(text) {
  const out = new Set();
  if (typeof text !== 'string' || text.trim() === '') return out;
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw === '') continue;
    const token = fold(raw);
    if (token.length < MIN_TOKEN_CHARS) continue;
    if (STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

/**
 * PURE. The words that would identify THIS question to a human.
 *
 * The item name where we have one; otherwise the quoted span of the
 * question text, because every question this product asks is shaped
 * `Which product is "<item>"?` and the wrapper words are identical on
 * every row - feeding them in would make "product" corroborate the whole
 * open set at once. Candidate labels are included because an answer
 * naming a product he was offered is exactly the evidence this gate
 * exists to look for.
 *
 * `item_name` is LEFT-joined in production and is legitimately null on a
 * question whose plan line answers to no stored list item, so the
 * fallbacks are load-bearing rather than defensive decoration.
 */
export function questionTokens(question) {
  const q = question || {};
  const parts = [];

  if (q.itemName) parts.push(String(q.itemName));
  else if (q.questionText) {
    const quoted = String(q.questionText).match(/"([^"]+)"/);
    parts.push(quoted ? quoted[1] : String(q.questionText));
  }

  for (const list of [q.renderedCandidates, q.candidates]) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      if (c.label !== null && c.label !== undefined) parts.push(String(c.label));
    }
  }

  const out = new Set();
  for (const part of parts) for (const t of tokenise(part)) out.add(t);
  return out;
}

/**
 * PURE. Does `answerText` independently support binding to `question`,
 * given everything else that is open?
 *
 * Returns `{ corroborated, on }` where `on` is the sorted list of
 * discriminating words that carried it - which is what goes in the log,
 * so a refusal can be understood afterwards without re-running it.
 *
 * `scoped` is the open-question set the mapping was chosen from. A word
 * shared with any OTHER open question is not evidence about this one and
 * is discarded before the verdict.
 */
export function corroboration({ answerText, question, scoped = [] } = {}) {
  const answer = tokenise(answerText);
  if (answer.size === 0) return { corroborated: false, on: [] };

  const mine = questionTokens(question);
  if (mine.size === 0) return { corroborated: false, on: [] };

  const key = question && question.questionKey;
  const others = new Set();
  for (const q of Array.isArray(scoped) ? scoped : []) {
    if (!q) continue;
    if (key !== undefined && key !== null && q.questionKey === key) continue;
    for (const t of questionTokens(q)) others.add(t);
  }

  const on = [];
  for (const t of answer) {
    if (!mine.has(t)) continue;
    if (others.has(t)) continue;      // shared with another open question: names neither
    on.push(t);
  }
  on.sort();
  return { corroborated: on.length > 0, on };
}

/**
 * THE POLICY. Should this model mapping be written, or asked about?
 *
 * CONTRADICTION-ONLY (Warwick, 2026-08-18). Three outcomes, and only the
 * middle one refuses:
 *
 *   supported     the words name this question          -> BIND
 *   contradicted  the words name a DIFFERENT open one   -> REFUSE, ask
 *   shorthand     the words name nothing in particular  -> BIND
 *
 * The third case is the whole of his ruling: "the four pack" and "the big
 * ones please" are how he actually answers, and refusing them to make
 * correlation tidier is the increase in ordinary interruptions he ruled
 * out. It is also the residual - a wrong mapping whose words say nothing
 * still lands, and answer correction is what closes that, not this file.
 *
 * `elsewhere` carries the questions the words DO name, so a refusal log
 * says where they pointed rather than merely that it refused.
 */
export function bindingVerdict({ answerText, question, scoped = [] } = {}) {
  const own = corroboration({ answerText, question, scoped });
  if (own.corroborated) return { bind: true, reason: 'supported', on: own.on, elsewhere: [] };

  const key = question && question.questionKey;
  const elsewhere = [];
  for (const q of Array.isArray(scoped) ? scoped : []) {
    if (!q) continue;
    if (key !== undefined && key !== null && q.questionKey === key) continue;
    const other = corroboration({ answerText, question: q, scoped });
    if (other.corroborated) {
      elsewhere.push({ questionKey: q.questionKey, ordinal: q.ordinal ?? null, on: other.on });
    }
  }
  if (elsewhere.length > 0) return { bind: false, reason: 'contradicted', on: [], elsewhere };

  // Nothing anywhere. Preserve the path that already works.
  return { bind: true, reason: 'shorthand', on: [], elsewhere: [] };
}
