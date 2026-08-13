// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/corroborate.js
//
// WO-2026-08-13-04 (WP-B15-37), AC2 + AC3. RECONCILIATION OF THE PHOTO
// OBSERVATIONS - conservative in BOTH directions, and the only place an
// unsupported PHOTO line can still be caught.
//
// ── THE FACT THIS MODULE EXISTS TO ANSWER ─────────────────────────────────
// Vision is FINAL and PARKED. The positional field was measured to COST
// detection (-14.8% lines per band call, permutation p=0.0127) and measured NOT
// to separate phantoms from real lines (invention 5.7% in the BEST-resolved
// bands against 1.5% in the worst; both phantoms came from the best-resolved
// band). It is off. So vision ships with NO STRUCTURAL ANTI-PHANTOM MECHANISM
// and 1-2 catalogue-valid inventions per run reach reconciliation.
//
// What is available here, and costs nothing, is REPEATED INDEPENDENT READINGS
// of the same photograph. Three final runs are banked. A phantom is a thing one
// reading produced and the others did not; a real page line is a thing the
// readings agree about. That is a genuine, measurable discriminator, and unlike
// the positional field it is grounded in evidence rather than in a plausible
// story about resolution.
//
// ⛔ WHAT IT CANNOT DO, STATED PLAINLY RATHER THAN IMPLIED AWAY:
//   * A phantom reproduced by EVERY reading is invisible to it. Corroboration
//     measures agreement, not truth, and three readings of one photograph by
//     one model are not independent in the statistical sense - a systematic
//     misreading is systematically repeated.
//   * It cannot recover a page line NO reading saw. An omission common to all
//     three runs leaves no trace here or anywhere else in the application.
//   * It grades nothing against the page. Only a human looking at the
//     photograph can do that.
// A line this module clears is CORROBORATED, never VERIFIED, and no downstream
// artefact may call it verified.
//
// ── AC2: CONSERVATIVE IN BOTH DIRECTIONS ─────────────────────────────────
// Two failures, not one, and the second is the one that has already happened
// in this build:
//   1. Duplicate observations of ONE physical page line must COLLAPSE.
//   2. Genuinely different purchases with similar names must NOT.
// The key is therefore the RESOLVED CATALOGUE IDENTITY - the household's own
// regulars id - and never a name similarity, a fuzzy score or a confidence.
// Yazoo Strawberry (59) and Yazoo Chocolate (15) are different ids and can
// never meet. Twix Ice Cream (114) and Twix Biscuit Bars (115) are different
// ids and can never meet. Cravendale/Arla milk (4), ASDA milk (2) and Arla BOB
// (69) are three different ids and can never meet.
//
// ⛔ A SURVIVOR IS NEVER ELECTED BY CONFIDENCE. Where one run reads the same
// physical line twice, the survivor is chosen by EVIDENCE BASIS - a count the
// page actually carried beats a household default - and, failing that, by the
// longest verbatim reading. Both are deterministic properties of the page.
// Confidence is recorded for a human to read and decides nothing.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

/**
 * How a corroborated observation was classified. Always reported.
 *
 * ── A FOURTH MEMBER, ADDED DELIBERATELY (WO-2026-08-13-15 / WP-B15-47, AC7) ──
 * `agreementIsNotCertainty.test.js` calls this a CLOSED vocabulary and says
 * plainly that "adding a member is a product decision, not a refactor". It is,
 * and this one was decided: Larry authorised it in AMENDMENT 1 (A4) on the back
 * of Warwick's standing ruling that a line is CORROBORATED, never VERIFIED.
 *
 * THE DEFECT IT CLOSES, because a fourth class needs a reason and not a taste.
 * The classifier below elected UNANIMOUS whenever `support === runCount`. With
 * ONE reading that is trivially true of EVERY observation, so a single-reading
 * run shipped the STRONGEST agreement label in the vocabulary onto every
 * delivered line - `finalList.js` carries `support_class` straight through to
 * the human-readable list. "Unanimous" off one reading is not a weaker claim
 * than "corroborated"; it is a louder one, and nothing had ever supplied a
 * second opinion for it to be unanimous WITH.
 *
 * One reading cannot corroborate itself. SINGLE_READING says exactly that and
 * claims nothing further.
 */
export const SUPPORT = Object.freeze({
  /** Seen by every run that was consulted. Requires at least TWO runs. */
  UNANIMOUS: 'unanimous',
  /** Seen by more than one run but not all. */
  CORROBORATED: 'corroborated',
  /** Seen by exactly one run OUT OF SEVERAL. Cannot be distinguished from a phantom here. */
  UNCORROBORATED: 'uncorroborated',
  /**
   * Only ONE reading was consulted, so corroboration was never available to
   * this observation - it is neither supported nor contradicted by anything.
   * NOT a weaker grade of agreement: an ABSENCE of the mechanism.
   */
  SINGLE_READING: 'single-reading',
});

/** Collapse a verbatim reading to a comparison key. Never used across ids. */
function normaliseText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * A LEADING count or purchase marker is not part of what the line NAMES, so it
 * is stripped before two runs' readings of the same page line are compared.
 * A trailing plural/possessive "s" goes too ("toffees" / "toffee's" / "toffee"
 * are one page line in three handwriting readings). Nothing else is altered:
 * this is a normaliser, not a fuzzy matcher, and only EXACT equality of the
 * result ever merges anything.
 */
const LEADING_NOISE = new Set([
  'x', 'pk', 'pks', 'pkt', 'pkts', 'pack', 'packs', 'packet', 'packets',
  'box', 'boxes', 'bag', 'bags', 'bottle', 'bottles', 'can', 'cans',
  'tin', 'tins', 'pt', 'pts', 'pint', 'pints', 'jar', 'jars', 'tub', 'tubs',
]);

export function pageLineKey(text) {
  const toks = normaliseText(text).split(' ').filter((t) => t !== '');
  const stripped = stripLeadingNoise(toks);
  // ⚠️ NEVER RETURN AN EMPTY KEY. A reading that is ALL leading noise does
  // occur - the frozen runs contain "1 BOX..." where the rest of the line was
  // not legible - and an empty key would collide with every other such line,
  // silently merging unrelated garbage into one purchase. Falling back to the
  // whole normalised reading keeps it distinct.
  return stripped.length > 0 ? stripped.join(' ') : toks.join(' ');
}

function stripLeadingNoise(toks) {
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (/^\d+$/.test(t) || LEADING_NOISE.has(t) || /^\d+[a-z]+$/.test(t)) { i += 1; continue; }
    break;
  }
  return toks.slice(i)
    // A stray possessive "s" left behind when the apostrophe became a space
    // ("TOFFEE'S" -> "toffee s") is not a word.
    .filter((t) => t !== '' && t !== 's')
    // A trailing plural/possessive "s", but never the second "s" of a word that
    // genuinely ends in one ("skinless" must not become "skinles").
    .map((t) => (/[^s]s$/.test(t) ? t.slice(0, -1) : t));
}

/**
 * Vision's sentinel for "I can see a line here but the catalogue does not carry
 * it". It is NOT a product id and must never be keyed as one - doing so merges
 * every unidentified line in the run into a single phantom product.
 */
const NOT_AN_ID = /^[0-9]+$/;

export function isRealProductId(pid) {
  return pid !== null && pid !== undefined && NOT_AN_ID.test(String(pid));
}

/**
 * The identity key for one observation.
 *
 * A resolved catalogue id is the key whenever there is one - that is the whole
 * of AC2's second direction. Only a line the catalogue could NOT identify falls
 * back to its page-line key, and a text key can never collide with an id key
 * because the two namespaces are prefixed apart.
 */
export function identityKey(observation) {
  const pid = observation.product_id;
  const identified = observation.identified === true && isRealProductId(pid);
  return identified ? `id:${String(pid)}` : `text:${pageLineKey(observation.as_written)}`;
}

/**
 * PURE. Collapse duplicate observations of one physical page line WITHIN a
 * single run.
 *
 * Two rows of one run that carry the SAME catalogue identity are the same
 * physical line read twice: a run reads the page once, so it cannot legitimately
 * report the household's single Lenor line as two purchases. Different ids are
 * never touched.
 *
 * @returns {{lines: Array<object>, collapsed: Array<object>}}
 */
export function collapseWithinRun(observations) {
  const groups = new Map();
  for (const obs of observations) {
    const key = identityKey(obs);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obs);
  }

  const lines = [];
  const collapsed = [];
  for (const [key, members] of groups) {
    if (members.length === 1) {
      lines.push({ ...members[0], identity_key: key, collapsed_from: [] });
      continue;
    }
    // DETERMINISTIC SURVIVOR ELECTION. Never by confidence.
    const ranked = [...members].sort((a, b) => {
      const aExplicit = a.quantity_basis === 'explicit-on-page' ? 1 : 0;
      const bExplicit = b.quantity_basis === 'explicit-on-page' ? 1 : 0;
      if (aExplicit !== bExplicit) return bExplicit - aExplicit;
      const aLen = String(a.as_written ?? '').length;
      const bLen = String(b.as_written ?? '').length;
      if (aLen !== bLen) return bLen - aLen;
      return Number(a.line_no ?? 0) - Number(b.line_no ?? 0);
    });
    const survivor = ranked[0];
    const others = ranked.slice(1);
    lines.push({
      ...survivor,
      identity_key: key,
      collapsed_from: others.map((o) => ({
        line_no: o.line_no ?? null,
        as_written: o.as_written ?? null,
        quantity: o.quantity ?? null,
        quantity_basis: o.quantity_basis ?? null,
        source_region: o.source_region ?? null,
      })),
    });
    for (const o of others) {
      collapsed.push({
        identity_key: key,
        survivor_line_no: survivor.line_no ?? null,
        line_no: o.line_no ?? null,
        as_written: o.as_written ?? null,
        reason: 'duplicate observation of one physical page line, same catalogue identity',
      });
    }
  }
  return { lines, collapsed };
}

/**
 * PURE. Corroborate the observations of several runs of the SAME photograph.
 *
 * @param {Array<{label:string, observations:Array<object>}>} runs
 * @returns {{observations:Array<object>, runCount:number, collapsedByRun:object,
 *            counts:{unanimous:number, corroborated:number, uncorroborated:number}}}
 */
export function corroborate(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error('corroborate: at least one run is required');
  }
  const runCount = runs.length;

  const perRun = runs.map((run) => {
    const { lines, collapsed } = collapseWithinRun(run.observations || []);
    return { label: run.label, lines, collapsed };
  });

  // key -> { runs: Set<label>, readings: [{label, line}] }
  const merged = new Map();
  for (const run of perRun) {
    for (const line of run.lines) {
      const key = line.identity_key;
      if (!merged.has(key)) merged.set(key, { key, runs: new Set(), readings: [] });
      const entry = merged.get(key);
      entry.runs.add(run.label);
      entry.readings.push({ label: run.label, line });
    }
  }

  // ── SECOND PASS: ONE PAGE LINE READ TO TWO DIFFERENT CATALOGUE IDS ────────
  //
  // Measured on the three frozen runs: "1 PKT. ROAST BEEF" resolved to regular
  // 80 in one run, 81 in another and to no product at all in the third. Keying
  // by catalogue id alone therefore turns ONE page line into THREE observations,
  // which would put two roast beefs in the trolley and break the accounting.
  //
  // Groups are merged ONLY on EXACT equality of the page-line key - the same
  // words, after a leading count/marker and plural endings are removed. There is
  // no similarity score, no threshold and no confidence anywhere in this pass,
  // which is what keeps AC2's second direction safe: "yazoo strawberry milk
  // shake" and "yazoo chocolate milk shake" are not equal, so they cannot meet,
  // and neither can the Twix or the Arla/ASDA pairs.
  //
  // A merged group that ends up carrying MORE THAN ONE catalogue id is an
  // IDENTITY DISAGREEMENT: the runs did not agree what the line is. That is
  // genuine uncertainty and it is routed, never bought on a coin toss.
  const byPageLine = new Map();
  for (const entry of merged.values()) {
    const keys = new Set(entry.readings.map((r) => pageLineKey(r.line.as_written)).filter((k) => k !== ''));
    entry.pageLineKeys = keys;
    for (const k of keys) {
      if (!byPageLine.has(k)) byPageLine.set(k, []);
      byPageLine.get(k).push(entry);
    }
  }
  const absorbed = new Set();
  for (const [, group] of byPageLine) {
    if (group.length < 2) continue;
    const alive = group.filter((e) => !absorbed.has(e));
    if (alive.length < 2) continue;
    // The group's own head is the entry with the most runs behind it, then the
    // lowest key - deterministic, and never confidence.
    alive.sort((a, b) => (b.runs.size - a.runs.size) || a.key.localeCompare(b.key));
    const head = alive[0];
    for (const other of alive.slice(1)) {
      for (const r of other.readings) {
        head.readings.push(r);
        head.runs.add(r.label);
      }
      head.mergedKeys = [...(head.mergedKeys || []), other.key];
      absorbed.add(other);
      merged.delete(other.key);
    }
  }

  // ── THE SINGLE-READING GUARD (WP-B15-47, AC7) ────────────────────────────
  // Evaluated ONCE, from runCount alone, and deliberately NOT folded into the
  // ternary below. With one run, `support === runCount` is trivially true for
  // every observation, so the unguarded classifier below would elect UNANIMOUS
  // for all of them - the strongest agreement label in the vocabulary, off a
  // reading nothing ever corroborated. Corroboration is not weak here; it is
  // ABSENT, and the class has to say so.
  const singleReading = runCount < 2;

  const observations = [];
  for (const entry of merged.values()) {
    const support = entry.runs.size;
    const supportClass = singleReading
      ? SUPPORT.SINGLE_READING
      : (support === runCount
        ? SUPPORT.UNANIMOUS
        : (support > 1 ? SUPPORT.CORROBORATED : SUPPORT.UNCORROBORATED));

    // The delivered reading is elected the same deterministic way as within a
    // run - evidence basis, then fullest reading - across the runs that saw it.
    const ranked = [...entry.readings].sort((a, b) => {
      const aExplicit = a.line.quantity_basis === 'explicit-on-page' ? 1 : 0;
      const bExplicit = b.line.quantity_basis === 'explicit-on-page' ? 1 : 0;
      if (aExplicit !== bExplicit) return bExplicit - aExplicit;
      const aLen = String(a.line.as_written ?? '').length;
      const bLen = String(b.line.as_written ?? '').length;
      if (aLen !== bLen) return bLen - aLen;
      return String(a.label).localeCompare(String(b.label));
    });
    const chosen = ranked[0].line;

    // QUANTITY AGREEMENT ACROSS RUNS. A disagreement is never averaged, never
    // majority-guessed and never silently resolved - AC4 is explicit that an
    // explicit conflicting observation becomes a Cockpit uncertainty. The
    // deterministic pack-identity rule runs LATER and may still settle it; what
    // this records is the raw disagreement.
    const quantities = [...new Set(entry.readings
      .map((r) => r.line.quantity)
      .filter((q) => Number.isInteger(q)))];

    // IDENTITY AGREEMENT. Every distinct catalogue id the runs proposed for
    // this one page line. More than one is a disagreement the application is
    // not entitled to settle; zero means nobody could identify it.
    const proposedIds = [...new Set(entry.readings
      .map((r) => r.line.product_id)
      .filter((p) => isRealProductId(p))
      .map((p) => String(p)))].sort();
    const identityDisagreement = proposedIds.length > 1;
    const settledId = proposedIds.length === 1 ? proposedIds[0] : null;

    observations.push({
      identity_key: entry.key,
      product_id: settledId,
      identified: settledId !== null,
      identity_disagreement: identityDisagreement,
      identity_candidates: proposedIds,
      merged_identity_keys: entry.mergedKeys || [],
      as_written: chosen.as_written ?? null,
      quantity: chosen.quantity ?? null,
      quantity_basis: chosen.quantity_basis ?? null,
      leading_mark: chosen.leading_mark ?? null,
      quantity_probe_text: chosen.quantity_probe_text ?? chosen.as_written ?? null,
      confidence: chosen.confidence ?? null,
      source_region: chosen.source_region ?? null,
      support,
      support_of: runCount,
      support_class: supportClass,
      seen_in_runs: [...entry.runs].sort(),
      quantity_readings: entry.readings.map((r) => ({
        run: r.label,
        as_written: r.line.as_written ?? null,
        quantity: r.line.quantity ?? null,
        basis: r.line.quantity_basis ?? null,
      })),
      quantity_disagreement: quantities.length > 1,
      quantity_candidates: quantities.sort((a, b) => a - b),
      collapsed_from: chosen.collapsed_from || [],
      vision_needs_human: chosen.needs_human === true,
      vision_needs_human_reasons: chosen.needs_human_reasons || [],
    });
  }

  // Stable order: identified products by id, then unidentified by text.
  observations.sort((a, b) => a.identity_key.localeCompare(b.identity_key, 'en'));

  // Derived from the vocabulary itself rather than a hand-listed literal: the
  // hand-listed form silently produced NaN the moment a fourth class existed,
  // because `counts[o.support_class] += 1` on an absent key is `undefined + 1`.
  const counts = Object.fromEntries(Object.values(SUPPORT).map((v) => [v, 0]));
  for (const o of observations) {
    if (!(o.support_class in counts)) {
      throw new Error(`corroborate: support_class "${o.support_class}" is outside the closed vocabulary`);
    }
    counts[o.support_class] += 1;
  }

  return {
    observations,
    runCount,
    // TRUE when only one reading was consulted, so no observation in this
    // result carries corroborating support of any kind. Callers that render
    // support to a human read this rather than inferring it from `runCount`.
    singleReading,
    runLabels: perRun.map((r) => r.label),
    collapsedByRun: Object.fromEntries(perRun.map((r) => [r.label, r.collapsed])),
    counts,
  };
}
