// Fusion247 Cockpit — CAPAE, the closed learning loop, read out of the session_report mirror.
//
// BUILD-020 Sub-phase 4D. Deliberately built to the same shape as `rotation-report.mjs`: pure
// mappers plus a response builder that takes an injected `query` function and imports nothing that
// touches a database. `capae-check.mjs` executes the whole mapping without a server or a connection.
//
// WHAT CAPAE IS, in one line, because a reader of this file should not have to go and find out:
// Corrective Action, Preventive Action and Effectiveness — not just fixing what went wrong, but
// establishing WHY, making the smallest change that should reduce recurrence, and then proving
// through NORMAL FUTURE OPERATION that the prevention actually worked.
//
// THE TWO PROPERTIES THIS FILE EXISTS TO PRESERVE:
//
//   1. A FAMILY IS THE UNIT, NOT AN INCIDENT. `slug` is unique in the schema, so a recurrence
//      updates a family and appends an occurrence; it can never mint a sibling. This module never
//      groups by anything else, because grouping by a shared DETECTION or ESCAPE surface would
//      merge unrelated causes — the exact error Warwick corrected on 2026-08-08.
//
//   2. ABSENT IS NEVER ZERO, AND UNPROVEN IS NEVER PROVEN. `null` round-trips as `null`. A family
//      with no established root cause reports UNESTABLISHED, which is a valid answer and not a gap
//      to be filled with something plausible. A family whose exposures are too rare to accumulate
//      reports UNMEASURABLE rather than carrying a counter that cannot advance.

// THE ONE SELECTION CONTRACT. Imported from the governor rather than reimplemented here, so the
// list the Cockpit labels "Larry's Active Brief" is computed by the same function that builds the
// brief Larry is actually handed at Continue. See `activeBrief` below.
import { selectActive } from '../../tools/governor/capae-brief.mjs';

/**
 * Families, newest activity first, with the pilot surfaced ahead of the rest.
 *
 * ORDERED IN SQL, NOT IN JS. The Cockpit renders "in the order supplied" and says so to Warwick, so
 * the order has to be a property of the query rather than of whoever last edited the view.
 * `last_occurrence_at` can be NULL for a family that has been described but not yet observed —
 * NULLS LAST keeps those at the bottom instead of silently at the top.
 */
export const FAMILY_SQL = `
  select * from session_report.capae_family
  order by is_pilot desc, last_occurrence_at desc nulls last, occurrences desc, slug asc`;

/** Occurrence history for a known set of families, newest first. */
export const OCCURRENCE_SQL = `
  select o.*, r.session_date, r.deliverable_path, r.branch, r.closing_head
  from session_report.capae_occurrence o
  left join session_report.rotation r on r.id = o.rotation_id
  where o.family_id = any($1::uuid[])
  order by o.occurred_at desc`;

/** SQLSTATEs worth a sentence a human can act on. Same contract as the rotation reports. */
export const SQLSTATE_REASONS = Object.freeze({
  '28P01': 'the database rejected the cockpit credentials',
  '3F000': 'the session_report schema does not exist yet',
  '42P01': 'the CAPAE tables have not been created yet',
  '42501': 'the cockpit role is not permitted to read the CAPAE tables',
});

/**
 * A failure sentence built from SQLSTATE ALONE.
 *
 * Never from `e.message`, which on a connection failure carries the DSN, host, port and role. This
 * endpoint is reachable from the tailnet, so an error string is an output surface like any other.
 */
export function readFailure(e) {
  const code = e && e.code;
  const known = code && SQLSTATE_REASONS[code];
  if (known) return known;
  return code ? `the database refused the read (SQLSTATE ${code})` : 'the database could not be reached';
}

/** `null`/`undefined` stay null. Never coerced to 0 — "not established" is not "none". */
export function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function jsonList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

export function jsonObj(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; }
  }
  return {};
}

export function toIso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * The one-line effectiveness statement, and it is the sentence most likely to be over-read.
 *
 * Warwick's brief is explicit: effectiveness is NOT "we haven't seen the problem again yet" — it is
 * evidence from a qualified future opportunity where the prevention SHOULD have worked. So this
 * function refuses to render progress that no exposure supports:
 *
 *   - UNMEASURABLE says so outright and shows no fraction, because a counter that cannot advance
 *     implies progress and there is none to imply.
 *   - 0 clean exposures reports "not yet measured", never "0/5 — on track".
 *   - Only a family with a target AND real clean exposures gets a fraction.
 */
export function effectivenessLine(f) {
  if (f.unmeasurable) return 'UNMEASURABLE — qualified exposures are too rare to prove effectiveness. No counter is open.';
  const clean = num(f.exposures_clean) ?? 0;
  const need = num(f.exposures_required);
  if (f.state === 'EFFECTIVE') return need ? `PROVEN — ${clean}/${need} qualified exposures clean.` : 'PROVEN by qualified exposure.';
  if (f.state === 'INEFFECTIVE') return 'INEFFECTIVE — the defect recurred after the prevention was in place. Cause and remedy reopen.';
  if (f.state === 'CHALLENGED') return need
    ? `CHALLENGED — the current prevention is in doubt. ${clean}/${need} clean.`
    : 'CHALLENGED — the current prevention is in doubt.';
  if (clean === 0) return need ? `NOT YET MEASURED — 0/${need} qualified exposures so far.` : 'NOT YET MEASURED — no qualified exposure has occurred.';
  return need ? `MONITORING — ${clean}/${need} qualified exposures clean.` : `MONITORING — ${clean} clean so far.`;
}

/** One family row + its occurrences → one entry of the API contract. */
export function mapFamily(row, occurrenceRows = []) {
  return {
    slug: str(row.slug),
    title: str(row.title),
    cause_class: str(row.cause_class),
    is_pilot: row.is_pilot === true,

    // The lifecycle, exposed as first-class fields rather than buried in prose. Warwick's brief:
    // Finding → Correction → RCA → Corrective/Preventive Action → Effectiveness → Proven Lesson.
    finding: str(row.finding),
    latest_correction: str(row.latest_correction),
    root_cause: str(row.root_cause),
    rca_status: str(row.rca_status) || 'UNESTABLISHED',
    rca_confidence: str(row.rca_confidence),
    // Warwick's causal correction: cause, detection and escape are three different questions, and a
    // remedy aimed at the wrong one leaves the generator running.
    cause_detection_escape: jsonObj(row.cause_detection_escape),
    preventive_action: str(row.preventive_action),
    required_larry_behaviour: str(row.required_larry_behaviour),

    state: str(row.state) || 'MONITORING',
    unmeasurable: row.unmeasurable === true,
    exposures_clean: num(row.exposures_clean) ?? 0,
    exposures_required: num(row.exposures_required),
    effectiveness: effectivenessLine(row),
    effectiveness_note: str(row.effectiveness_note),

    occurrences: num(row.occurrences) ?? 0,
    first_seen_at: toIso(row.first_seen_at),
    last_occurrence_at: toIso(row.last_occurrence_at),
    evidence_refs: jsonList(row.evidence_refs),
    history: occurrenceRows.map(mapOccurrence),
  };
}

export function mapOccurrence(row) {
  return {
    occurred_at: toIso(row.occurred_at),
    disposition: str(row.disposition) || 'RECURRENCE',
    summary: str(row.summary),
    evidence_ref: str(row.evidence_ref),
    // Present only when this occurrence was observed inside a recorded rotation. A family instance
    // found outside one is normal — evidence predates the mirror — and renders as absent, not zero.
    session_date: row.session_date ? String(row.session_date).slice(0, 10) : null,
    deliverable_path: str(row.deliverable_path),
    branch: str(row.branch),
    closing_head: str(row.closing_head),
  };
}

/**
 * The ACTIVE brief — what a fresh Larry is handed at Continue, and nothing more.
 *
 * ⛔ THE SELECTION IS NOT IMPLEMENTED HERE. It is `selectActive` in
 * `tools/governor/capae-brief.mjs` — the SAME function that computes the brief Larry actually
 * receives — and this module only shapes the selected rows for the Cockpit's display.
 *
 * WHY THAT MATTERS MORE THAN THE DUPLICATION IT REMOVES: this file previously carried its own
 * copy of the eligibility test, the ranking weights AND a limit of 5, while the governor used 4.
 * The two were never reconciled, so the Cockpit's heading — "Larry's Active Brief" — was a claim
 * the code could not honour. A surface that says it shows what Larry sees must not compute its
 * own answer. There is one contract, and it lives with the producer.
 */
export function activeBrief(families, opts = {}) {
  return selectActive(families, opts)
    .map((f) => ({
      slug: f.slug,
      title: f.title,
      cause: f.root_cause,
      must: f.required_larry_behaviour,
      effectiveness: f.effectiveness,
      occurrences: f.occurrences,
    }));
}

export async function capaeFamilies(query) {
  const res = await query(FAMILY_SQL);
  const rows = (res && res.rows) || [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id).filter((id) => id !== null && id !== undefined);
  let occ = [];
  if (ids.length > 0) {
    const o = await query(OCCURRENCE_SQL, [ids]);
    occ = (o && o.rows) || [];
  }
  const byFamily = new Map(rows.map((r) => [String(r.id), []]));
  for (const o of occ) {
    const bucket = byFamily.get(String(o.family_id));
    if (bucket) bucket.push(o);
  }
  return rows.map((r) => mapFamily(r, byFamily.get(String(r.id)) || []));
}

/**
 * What `GET /api/capae` returns, verbatim.
 *
 * A database failure comes back as HTTP 200 `{ ok:false, error }` — the house pattern — so it can
 * never take another route down with it, and the sentence is built from SQLSTATE alone so it cannot
 * carry a DSN, host, role or path.
 */
export async function capaeResponse(query) {
  try {
    const families = await capaeFamilies(query);
    // `overview` and `ordered` are DERIVED here rather than in the template, so the executive screen
    // is assertable by capae-check.mjs without a browser. Same data, decided once.
    return {
      ok: true,
      families,
      active: activeBrief(families),
      overview: capaeOverview(families),
      ordered: familiesByUrgency(families).map((f) => f.slug),
    };
  } catch (e) {
    return { ok: false, error: `The CAPAE record could not be read — ${readFailure(e)}.` };
  }
}

// ---------------------------------------------------------------------------
// THE EXECUTIVE LAYER (2026-08-08, Warwick's phone review)
// ---------------------------------------------------------------------------
// "Cockpit must bring the important thing to Warwick visually. Warwick must NOT have to read a
// report in order to discover what matters."
//
// Everything below is DERIVED from data already mapped above. No new query, no new column, no new
// store. These are display decisions, and they live here rather than in the template so they can be
// asserted by capae-check.mjs without a browser.

/**
 * State presentation. NEVER COLOUR ALONE — every state carries a word and a mark, because a red
 * chip is invisible to a colourblind reader and meaningless in a screenshot pasted into a report.
 */
export const STATE_PRESENTATION = Object.freeze({
  INEFFECTIVE:  { tone: 'urgent',    label: 'INEFFECTIVE',  mark: '⛔', rank: 0 },
  CHALLENGED:   { tone: 'prominent', label: 'CHALLENGED',   mark: '⚠',  rank: 1 },
  MONITORING:   { tone: 'quiet',     label: 'MONITORING',   mark: '•',  rank: 2 },
  UNMEASURABLE: { tone: 'neutral',   label: 'UNMEASURABLE', mark: '–',  rank: 3 },
  EFFECTIVE:    { tone: 'positive',  label: 'EFFECTIVE',    mark: '✓',  rank: 4 },
});

export function familyPresentation(family) {
  const s = (family && family.state) || 'MONITORING';
  return STATE_PRESENTATION[s] || STATE_PRESENTATION.MONITORING;
}

/** One line of WHY, taken from the record in priority order. Null when the record has none. */
export function whyThisMatters(family) {
  if (!family) return null;
  return family.root_cause || family.finding || family.required_larry_behaviour || null;
}

/**
 * Effectiveness as progress, but ONLY where progress is a meaningful idea.
 * Without a threshold there is no denominator, and inventing one would imply a bar nobody set.
 */
export function effectivenessProgress(family) {
  if (!family || family.unmeasurable) return null;
  const req = family.exposures_required;
  if (req === null || req === undefined || req <= 0) return null;
  const clean = family.exposures_clean || 0;
  return { clean, required: req, complete: clean >= req, label: `${clean} of ${req} clean exposures` };
}

/** The most recent occurrence that was a FAILURE, across every family. Null if there has been none. */
export function latestRecurrence(families) {
  let best = null;
  for (const f of families || []) {
    for (const o of f.history || []) {
      if (o.disposition !== 'RECURRENCE' && o.disposition !== 'NEW') continue;
      if (!best || String(o.occurred_at || '') > String(best.occurred_at || '')) {
        best = { slug: f.slug, title: f.title, summary: o.summary, occurred_at: o.occurred_at, disposition: o.disposition };
      }
    }
  }
  return best;
}

/**
 * THE FIRST CAPAE SCREEN, in one object. Answers Warwick's four at-a-glance questions without him
 * opening anything: does CAPAE need me · what is the most important family · is learning being
 * proven · what most recently went wrong.
 */
export function capaeOverview(families) {
  const list = Array.isArray(families) ? families : [];
  const counts = { MONITORING: 0, CHALLENGED: 0, EFFECTIVE: 0, INEFFECTIVE: 0, UNMEASURABLE: 0 };
  for (const f of list) if (counts[f.state] !== undefined) counts[f.state] += 1;

  // CHALLENGED means a prevention that HAD been proven has failed since. That is the reopening
  // signal, and it is derived from the state machine rather than guessed at from counts.
  const reopened = list.filter((f) => f.state === 'CHALLENGED')
    .map((f) => ({ slug: f.slug, title: f.title, occurrences: f.occurrences }));
  const ineffective = list.filter((f) => f.state === 'INEFFECTIVE')
    .map((f) => ({ slug: f.slug, title: f.title, occurrences: f.occurrences }));
  const becameEffective = list.filter((f) => f.state === 'EFFECTIVE')
    .map((f) => ({ slug: f.slug, title: f.title }));

  const pilotRow = list.find((f) => f.is_pilot) || null;
  const pilot = pilotRow ? {
    slug: pilotRow.slug,
    title: pilotRow.title,
    state: pilotRow.state,
    occurrences: pilotRow.occurrences,
    // What would COUNT as its next qualified exposure — the record's own words, not a paraphrase.
    nextQualifiedExposure: pilotRow.required_larry_behaviour || null,
    progress: effectivenessProgress(pilotRow),
  } : null;

  const needsAttention = ineffective.length > 0 || reopened.length > 0;
  const attention = needsAttention
    ? `${ineffective.length + reopened.length} prevention${ineffective.length + reopened.length === 1 ? '' : 's'} in doubt`
    : (counts.MONITORING > 0 ? 'Nothing in doubt — preventions under observation' : 'Nothing needs attention');

  return {
    total: list.length,
    counts,
    needsAttention,
    attention,
    ineffective,
    reopened,
    becameEffective,
    pilot,
    latest: latestRecurrence(list),
  };
}

/** Families ordered for the executive list: worst first, pilot lifted within its band. */
export function familiesByUrgency(families) {
  return (Array.isArray(families) ? families : []).slice().sort((a, b) => {
    const ra = familyPresentation(a).rank, rb = familyPresentation(b).rank;
    if (ra !== rb) return ra - rb;
    if (a.is_pilot !== b.is_pilot) return a.is_pilot ? -1 : 1;
    return (b.occurrences || 0) - (a.occurrences || 0) || String(a.slug).localeCompare(String(b.slug));
  });
}
