// Fusion247 Cockpit — the rotation performance reports, read out of the session_report mirror.
//
// Git stays the durable SSOT: the human-readable report is the Markdown Deliverable. Supabase is a
// QUERYABLE MIRROR of the same evidence, and this module is the only thing that turns that mirror
// into the shape the System tab renders. It is not a second report and it is not a third store.
//
// ── WHY THIS IS ITS OWN MODULE, WITH THE QUERY INJECTED ──────────────────────────────────────────
// `server.mjs` imports `db.mjs`, which constructs two live Postgres pools AT MODULE LOAD. Anything
// that imports `server.mjs` therefore opens production connections just by being loaded, which means
// it cannot be executed inside a gate. So the read logic lives here, takes its `query` function as an
// argument, and imports nothing that touches a database. `rotation-report-check.mjs` proves that by
// recording every module the process actually loads and asserting `db.mjs` is not among them — the
// same construction as `provenance.mjs` / `provenance-check.mjs`, and the same reasoning that pulled
// `static.mjs` and `down-reason.mjs` out before them.
//
// ── THE PROPERTY THIS FILE EXISTS TO HOLD ────────────────────────────────────────────────────────
// Warwick, verbatim: "Do not convert missing values into zero. 'Unknown,' 'not established' and zero
// are materially different."
//
// A SQL NULL must arrive at the browser as JSON `null`. Never `0`, never `"0"`, never `""`, never
// `"unknown"`, and never as an absent key. The 4A rotation is the case that makes this concrete: it
// holds `wo_first_dispatch_success = 0` — a TRUE zero, nought Work Orders survived first read-back —
// sitting in the same row as `elapsed_minutes = null` and `total_context_tokens_in = null`, which are
// TRUE unknowns nobody ever measured. Rendering those three identically would be a lie in both
// directions at once: it would invent a measurement, and it would hide a real failure behind it.
//
// Every conversion below is written to fail towards `null`. `Number('')` is 0 in JavaScript and
// `Number(null)` is 0 as well, so the guards in `num()` are the load-bearing lines of this file.

import { whyDown } from './down-reason.mjs';

/**
 * ORDERING. `created_at` descending, and the choice is deliberate rather than incidental.
 *
 * `session_date` is a DATE. Two rotations closed on the same day tie, and a tie has no defined order
 * — so "most recent first" would silently become "arbitrary among today's rotations", which is
 * exactly the kind of nondeterminism that reads as a rendering bug months later. `created_at` is a
 * timestamptz written by the database at insert time, so it totally orders the rows and cannot be
 * affected by the producer's clock or timezone.
 */
export const ROTATION_ORDER_BY = 'created_at desc';

/**
 * `select *` rather than an explicit column list, and this is a fail-soft decision.
 *
 * The columns this reader wants are added by a forward-only migration that a human applies. Between
 * deploying this code and applying that migration, an explicit list would raise `42703 undefined
 * column` and take the whole endpoint down. `select *` instead returns the columns that do exist, the
 * absent ones map to `null`, and the UI honestly reports "not established" until the migration lands.
 * Unknown is the correct answer to "what is this column's value" when the column is not there yet.
 */
export const ROTATION_SQL = `select * from session_report.rotation order by ${ROTATION_ORDER_BY}`;

/** Specialist rows for a known set of rotations. Ordered so the nested arrays are stable. */
export const SPECIALIST_SQL =
  'select * from session_report.specialist_dispatch where rotation_id = any($1::uuid[]) order by specialist asc';

/**
 * Postgres failures, in words, WITHOUT the driver's message.
 *
 * `err.message` is never read here. A pg error message can carry a host, a role name or a connection
 * detail, and this string is rendered in a browser. SQLSTATE is a fixed five-character code that
 * carries no deployment detail, so it can be mapped safely; anything unrecognised falls through to
 * `whyDown()`, which is already the house resolver and also never reads `message`.
 */
export const SQLSTATE_REASONS = Object.freeze({
  '42501': 'the cockpit’s read role has not been granted access to it',
  '3F000': 'the session_report schema does not exist yet',
  '42P01': 'the rotation tables have not been created yet',
  '42703': 'the schema change adding the newer columns has not been applied yet',
  '28000': 'the cockpit’s database role was rejected',
  '28P01': 'the cockpit’s database role was rejected',
  '53300': 'the database refused another connection',
  '57P03': 'the database is still starting up',
});

/** @returns {string} A phrase that completes "… — <this>." Never carries a DSN, host, role or path. */
export function readFailure(e) {
  if (e && typeof e === 'object' && typeof e.code === 'string' && SQLSTATE_REASONS[e.code]) {
    return SQLSTATE_REASONS[e.code];
  }
  return whyDown(e);
}

/**
 * A JSON number, or null. THE central guard of this module.
 *
 * `numeric` and `bigint`/int8 both arrive from `pg` as STRINGS — numeric because it is arbitrary
 * precision, int8 because it can exceed Number.MAX_SAFE_INTEGER. Both must become JSON numbers for
 * the contract, and null must survive that conversion untouched.
 *
 * The two traps, both of which produce a plausible-looking 0:
 *   - `Number(null)` is 0;
 *   - `Number('')` is 0.
 * Hence the explicit null/undefined guard first and the empty-string guard second. `'0'` reaches
 * `Number` and correctly becomes 0, because that is a real value.
 */
export function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A string, or null. An absent value stays absent — it never degrades to ''. */
export function str(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** A jsonb value, or null. NULL here means "never recorded" and is not the same as `[]` or `{}`. */
export function jsonOrNull(v) {
  return v === null || v === undefined ? null : v;
}

/** A jsonb LIST column. Its schema default is `[]`, so an empty list is a real answer: "none". */
export function jsonList(v) {
  if (Array.isArray(v)) return v;
  return v === null || v === undefined ? [] : v;
}

/**
 * An ISO instant, or null. `timestamptz` arrives from `pg` as a JS Date; a Date without a driver
 * (a fixture, or a row read through PostgREST) arrives as a string and is passed through.
 */
export function toIso(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  return String(v);
}

/**
 * A calendar date as `YYYY-MM-DD`, or null.
 *
 * NOT `toISOString().slice(0, 10)`. `pg` parses a DATE into a Date at LOCAL midnight, so converting
 * it through UTC shifts the day backwards for every host east of Greenwich — the row would say
 * 2026-08-06 for a rotation that closed on the 7th. The local field accessors round-trip exactly
 * what the driver built, on every offset.
 */
export function toDateString(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

/** One specialist_dispatch row → the contract's nested shape. */
export function mapSpecialist(row) {
  return {
    specialist: str(row.specialist),
    dispatches: num(row.dispatches),
    // ⭐ `tokens` IS THE MEASURED TOTAL, and this mapper dropped it on the floor.
    // populate.mjs has been writing it since the column was added; schema.sql documents it as
    // "measured TOTAL … NOT a sum of tokens_in/tokens_out — those are separately absent". The
    // Cockpit mapped only the in/out pair, both of which are always NULL, so every per-specialist
    // cost in the estate rendered as "not established" while the real number sat in the row.
    tokens: num(row.tokens),
    tokensIn: num(row.tokens_in),
    tokensOut: num(row.tokens_out),
    notes: str(row.notes),
  };
}

/**
 * The rotation's total specialist dispatches — a SUM, and sums are where "unknown" quietly becomes
 * zero.
 *
 * No rows at all → null. Not 0: nothing was recorded, so the total is not established. (The empty
 * ARRAY still ships as `[]` under `specialists`; that says "no rows", while this says "no total".)
 *
 * A row whose `dispatches` is null → the whole sum is null. Adding 0 for the unknown member would
 * produce a total that looks measured and is not. The column is `not null` today, so this branch
 * should be unreachable in production — it is here because the property must hold by construction
 * rather than by a constraint someone could later relax.
 */
export function sumDispatches(specialists) {
  if (!Array.isArray(specialists) || specialists.length === 0) return null;
  let total = 0;
  for (const s of specialists) {
    if (s.dispatches === null || s.dispatches === undefined) return null;
    total += s.dispatches;
  }
  return total;
}

/** One rotation row plus its specialist rows → one entry of the frozen API contract. */
export function mapRotation(row, specialistRows = []) {
  const specialists = (Array.isArray(specialistRows) ? specialistRows : []).map(mapSpecialist);
  const closingHead = str(row.closing_head);
  return {
    id: str(row.id),
    createdAt: toIso(row.created_at),
    sessionDate: toDateString(row.session_date),
    host: str(row.host),
    hostVersion: str(row.host_version),
    branch: str(row.branch),
    closingHead,
    // Derived, never stored twice. Null head → null short head, rather than a '' that looks like a sha.
    closingHeadShort: closingHead === null ? null : closingHead.slice(0, 7),
    mapPath: str(row.map_path),
    deliverablePath: str(row.deliverable_path),
    elapsedMinutes: num(row.elapsed_minutes),
    contextTokensIn: num(row.total_context_tokens_in),
    contextTokensOut: num(row.total_context_tokens_out),
    subagentTokens: num(row.total_subagent_tokens),
    specialistDispatches: sumDispatches(specialists),
    // Any member may be null, and 0 and null are different answers. `total` is the STORED denominator
    // written by populate.mjs; it is never re-derived here from the three outcome counts beside it.
    workOrders: {
      total: num(row.wo_total),
      firstDispatchSuccess: num(row.wo_first_dispatch_success),
      amendments: num(row.wo_amendments),
      refusals: num(row.wo_refusals),
    },
    lines: {
      docChanged: num(row.doc_lines_changed),
      productChanged: num(row.product_lines_changed),
    },
    gitStat: jsonOrNull(row.git_stat),
    allocation: {
      productPct: num(row.allocation_product_pct),
      adminPct: num(row.allocation_admin_pct),
      evidencePct: num(row.allocation_evidence_pct),
      reworkPct: num(row.allocation_rework_pct),
      waitingPct: num(row.allocation_waiting_pct),
    },
    findings: jsonList(row.findings),
    unestablished: jsonList(row.unestablished),
    notes: str(row.notes),
    specialists,
  };
}

/**
 * The reports, most recent first. Throws whatever the query function throws — the caller below turns
 * that into words.
 *
 * @param {(text: string, params?: unknown[]) => Promise<{rows: any[]}>} query
 */
export async function rotationReports(query) {
  const rotations = await query(ROTATION_SQL);
  const rows = (rotations && rotations.rows) || [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id).filter((id) => id !== null && id !== undefined);
  let specialistRows = [];
  if (ids.length > 0) {
    const specialists = await query(SPECIALIST_SQL, [ids]);
    specialistRows = (specialists && specialists.rows) || [];
  }

  // Grouped in one pass. A rotation with no specialist rows gets [] — an empty array, never null and
  // never an error, because "this rotation dispatched nobody" is a normal and reportable outcome.
  const byRotation = new Map(rows.map((r) => [String(r.id), []]));
  for (const s of specialistRows) {
    const bucket = byRotation.get(String(s.rotation_id));
    if (bucket) bucket.push(s);
  }

  return rows.map((r) => mapRotation(r, byRotation.get(String(r.id)) || []));
}

/**
 * What `GET /api/rotation-reports` returns, verbatim.
 *
 * The endpoint returns exactly this object, so what the gate executes and what Warwick sees are one
 * construction rather than two that have to be kept in step — the `provenancePayload()` precedent.
 *
 * A database failure comes back as HTTP 200 with `{ ok: false, error }`, the house pattern
 * (server.mjs:261/263/266/277/279/282). It never throws, so it can never take another route down with
 * it, and the sentence is built from SQLSTATE alone so it cannot carry a DSN, host, role or path.
 */
export async function rotationReportsResponse(query) {
  try {
    const reports = await rotationReports(query);
    // `overview` and each report's `summary` are DERIVED here, not in the template, so the executive
    // view is assertable by rotation-report-check.mjs without a browser.
    return {
      ok: true,
      reports: reports.map((r) => ({ ...r, summary: reportSummary(r), econ: sessionEconomics(r) })),
      overview: reportsOverview(reports),
    };
  } catch (e) {
    return { ok: false, error: `The rotation reports could not be read — ${readFailure(e)}.` };
  }
}

// ---------------------------------------------------------------------------
// THE EXECUTIVE LAYER (2026-08-08, Warwick's phone review)
// ---------------------------------------------------------------------------
// "Warwick must NOT have to read a report in order to discover what matters." Everything below is
// DERIVED from fields already mapped above — no new query, no new column, no invented analytic. A
// measure that is not established stays null and is COUNTED, not printed twenty-one times.

/**
 * A finding's DISPLAY headline. The original text is never altered or replaced — `lead` is a prefix
 * of `full`, and `full` is Pax's own summary verbatim. The label is derived from the exposure word,
 * which is a closed vocabulary, so this cannot drift into paraphrasing evidence.
 */
export const EXPOSURE_PRESENTATION = Object.freeze({
  'recurrence':                     { label: 'PREVENTION FAILED TO STICK', tone: 'urgent',    mark: '🔴', failure: true },
  'new':                            { label: 'NEW FAILURE FAMILY',         tone: 'urgent',    mark: '🔴', failure: true },
  'clean':                          { label: 'PREVENTION HELD',            tone: 'positive',  mark: '🟢', failure: false },
  'none-this-session':              { label: 'NO QUALIFIED EXPOSURE',      tone: 'quiet',     mark: '⚪', failure: false },
  'unmeasurable-at-this-frequency': { label: 'TOO RARE TO MEASURE',        tone: 'neutral',   mark: '⚪', failure: false },
});

/** First sentence or clause, for the one-line lead. A PREFIX of the original, never a rewrite. */
function leadOf(text, max = 110) {
  const s = String(text || '').trim();
  if (!s) return null;
  const stop = s.search(/[.;]\s/);
  const cut = stop > 20 && stop < max ? stop + 1 : (s.length > max ? s.lastIndexOf(' ', max) : s.length);
  return s.slice(0, cut > 20 ? cut : s.length).trim() + (cut < s.length ? '…' : '');
}

export function findingHeadline(finding) {
  const f = finding && typeof finding === 'object' ? finding : {};
  const exposure = String(f.exposure || '').trim().toLowerCase();
  const p = EXPOSURE_PRESENTATION[exposure] || { label: 'FINDING', tone: 'quiet', mark: '⚪', failure: false };
  const full = str(f.summary) || (typeof finding === 'string' ? finding : null);
  return {
    family: str(f.family),
    exposure: exposure || null,
    label: p.label, tone: p.tone, mark: p.mark, failure: p.failure,
    lead: leadOf(full),
    full,
  };
}

/** Only measures that are actually established. Absent stays absent — it is counted, not rendered.
 *
 * ⛔ FIXED — VERA V-4, 2026-08-13. This rendered the literal string "undefined/undefined" on
 * Warwick's System pane, live since 2026-08-08, for any report whose containers are null.
 *
 * THE MECHANISM, because it is subtle and it will recur: `r.workOrders || {}` turns a NULL container
 * into an EMPTY OBJECT, whose fields are then `undefined` — and `undefined !== null` is TRUE. So a
 * guard written as `!== null` PASSES for a value that was never measured, and the template dutifully
 * prints JavaScript at a human. The `|| {}` fallback and the `!== null` guard are individually
 * reasonable and lethal together.
 *
 * The tell that this was a known hazard: the FOURTH guard below already read
 * `!== null && !== undefined`. One of four. That is what a defect class looks like just before it
 * ships — fixed in the place it bit, left alone everywhere else. `has()` now closes all four.
 *
 * Rendering an absence as a value is the same defect as the API's word `unknown` reaching a product
 * name, and the estate's rule is the same in both places: unknown, not established and zero are
 * three different facts and none may be dressed as another.
 */
const measured = (v) => v !== null && v !== undefined;
export function headlineMeasures(r) {
  const out = [];
  const wo = r.workOrders || {};
  if (measured(wo.total) && measured(wo.firstDispatchSuccess)) {
    out.push({ label: 'WO first pass', value: `${wo.firstDispatchSuccess}/${wo.total}`,
      tone: wo.total > 0 && wo.firstDispatchSuccess === 0 ? 'urgent' : 'quiet' });
  }
  if (r.allocation && measured(r.allocation.reworkPct)) {
    out.push({ label: 'Rework', value: `${r.allocation.reworkPct}%`,
      tone: r.allocation.reworkPct >= 25 ? 'urgent' : 'quiet' });
  }
  if (measured(r.subagentTokens)) {
    const m = r.subagentTokens / 1_000_000;
    out.push({ label: 'Subagent', value: m >= 1 ? `${m.toFixed(2)}M` : `${Math.round(r.subagentTokens / 1000)}k`, tone: 'quiet' });
  }
  if (measured(r.specialistDispatches)) {
    out.push({ label: 'Dispatches', value: String(r.specialistDispatches), tone: 'quiet' });
  }
  return out.slice(0, 4);
}

/** One session → one collapsed card's worth of truth. */
export function reportSummary(r) {
  const findings = (r.findings || []).map(findingHeadline);
  const failures = findings.filter((f) => f.failure);
  const unestablished = (r.unestablished || []).length;

  // ⛔ AN EMPTY ARRAY IS NOT POSITIVE EVIDENCE. This used to render "No findings recorded" in the
  // POSITIVE tone, which told Warwick a session had been reviewed clean when the truth was that no
  // structured findings existed — most often because the rotation predates the findings field
  // entirely. Green is earned by evidence. Absence is neutral, and says so.
  let headline;
  if (failures.length) headline = `${failures.length} prevention${failures.length === 1 ? '' : 's'} failed to stick`;
  else if (findings.length) headline = `${findings.length} finding${findings.length === 1 ? '' : 's'}, none a failure`;
  else headline = 'No structured findings recorded';

  return {
    headline,
    tone: failures.length ? 'urgent' : (findings.length ? 'quiet' : 'neutral'),
    measures: headlineMeasures(r),
    findings,
    findingsCount: findings.length,
    failuresCount: failures.length,
    unestablishedCount: unestablished,
  };
}

/**
 * ACROSS recent sessions. Every field is null when the underlying measure is not established —
 * a trend computed from one established value and one absent one is a fabricated trend.
 */
export function reportsOverview(reports) {
  const list = Array.isArray(reports) ? reports : [];
  if (list.length === 0) return null;

  const sum = (pick) => {
    const vals = list.map(pick).filter((v) => v !== null && v !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  // ⚠️ SUM THE PAIR, NOT THE COLUMNS. Summing `firstDispatchSuccess` and `total` independently
  // produced `13 of 7` against live data on 2026-08-08 — rotations that recorded a success count but
  // no denominator inflated the numerator against a denominator they never contributed to. Only
  // rotations where BOTH halves are established can contribute to either half.
  let woSuccess = null, woTotal = null;
  for (const r of list) {
    const w = r.workOrders || {};
    if (w.total === null || w.total === undefined) continue;
    if (w.firstDispatchSuccess === null || w.firstDispatchSuccess === undefined) continue;
    woSuccess = (woSuccess ?? 0) + w.firstDispatchSuccess;
    woTotal = (woTotal ?? 0) + w.total;
  }
  const allFindings = list.flatMap((r) => (r.findings || []).map(findingHeadline));

  // TREND — only when BOTH the latest and the previous value are established.
  let trend = null;
  if (list.length >= 2) {
    const a = list[0].allocation && list[0].allocation.reworkPct;
    const b = list[1].allocation && list[1].allocation.reworkPct;
    if (a !== null && a !== undefined && b !== null && b !== undefined) {
      const delta = a - b;
      trend = {
        measure: 'Rework', latest: a, previous: b, delta,
        direction: delta < 0 ? 'improving' : delta > 0 ? 'degrading' : 'flat',
        tone: delta < 0 ? 'positive' : delta > 0 ? 'urgent' : 'quiet',
      };
    }
  }

  // STANDOUT — the session carrying the most failures, named only if there is one.
  let standout = null;
  for (const r of list) {
    const s = reportSummary(r);
    if (s.failuresCount > 0 && (!standout || s.failuresCount > standout.failuresCount)) {
      standout = { sessionDate: r.sessionDate, failuresCount: s.failuresCount, headline: s.headline };
    }
  }

  return {
    sessions: list.length,
    woFirstPass: woTotal === null ? null : { success: woSuccess, total: woTotal },
    amendments: sum((r) => r.workOrders && r.workOrders.amendments),
    refusals: sum((r) => r.workOrders && r.workOrders.refusals),
    subagentTokens: sum((r) => r.subagentTokens),
    // `?? 0` inside the sum turned "never established" into a measured zero and reported 0 tokens
    // against nine real sessions. Only rotations that established a value contribute at all.
    contextTokens: sum((r) => {
      const i = r.contextTokensIn, o = r.contextTokensOut;
      if ((i === null || i === undefined) && (o === null || o === undefined)) return null;
      return (i ?? 0) + (o ?? 0);
    }),
    findingsTotal: allFindings.length,
    failuresTotal: allFindings.filter((f) => f.failure).length,
    unestablishedTotal: sum((r) => (r.unestablished || []).length),
    trend,
    standout,
  };
}

/**
 * SESSION ECONOMICS — Larry and the specialists as PEERS, never as one number.
 *
 * ⛔ LARRY'S CONTEXT OCCUPANCY IS NOT SUBAGENT TOKEN TRAFFIC. Adding them produces a figure that
 * means nothing: one is how full a single context got, the other is how much work was fanned out.
 * Warwick's instruction is explicit, and this function is the reason the template cannot get it
 * wrong — the two live in separate objects and are never summed.
 *
 * Unmeasured is stated ONCE per side, as a flag, rather than as a column of "not established".
 */
export function sessionEconomics(r) {
  const specialists = Array.isArray(r.specialists) ? r.specialists : [];
  const tokenVals = specialists.map((s) => s.tokens).filter((v) => v !== null && v !== undefined);

  const larry = {
    contextIn: r.contextTokensIn,
    contextOut: r.contextTokensOut,
    // "Movement" is only truthful when BOTH ends were measured. One end plus an assumed zero is a
    // fabricated delta, which is the same class of error as `?? 0` in the cross-session totals.
    movement: (r.contextTokensIn !== null && r.contextTokensIn !== undefined
      && r.contextTokensOut !== null && r.contextTokensOut !== undefined)
      ? r.contextTokensOut - r.contextTokensIn : null,
    elapsedMinutes: r.elapsedMinutes,
    measured: (r.contextTokensIn !== null && r.contextTokensIn !== undefined)
      || (r.contextTokensOut !== null && r.contextTokensOut !== undefined),
  };

  const specialist = {
    // The rotation-level total is authoritative where present; the per-specialist sum is a fallback
    // and is labelled as derived so the two are never confused.
    tokens: r.subagentTokens !== null && r.subagentTokens !== undefined
      ? r.subagentTokens
      : (tokenVals.length ? tokenVals.reduce((a, b) => a + b, 0) : null),
    tokensAreDerived: (r.subagentTokens === null || r.subagentTokens === undefined) && tokenVals.length > 0,
    dispatches: r.specialistDispatches,
    count: specialists.length,
    measuredCount: tokenVals.length,
    roster: specialists,
  };

  return { larry, specialist };
}
