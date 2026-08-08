// The ACTIVE CAPAE brief a fresh Larry is handed at session start — and nothing more.
//
// BUILD-020 Sub-phase 4D. Warwick's CAPAE Brief: "Larry should not fetch or read the complete CAPAE
// history. Nor should he have to remember 'after Continue I must query the CAPAE table.' Proofline's
// successful interface is already: Warwick says Continue; the system brings Larry what he needs."
//
// PRECOMPUTED, AND READ FROM DISK — NOT QUERIED AT SESSION START. Three reasons, in order of how
// badly each one bites:
//
//   1. A network call on the SessionStart hook makes orientation depend on Supabase being reachable
//      and the Cockpit being up. Neither is true at 3am, and a hook that hangs delays every session.
//   2. The hook must never throw. A read of a local JSON file has one failure mode and it is
//      trivially containable; a fetch has many.
//   3. "Precomputed" is what the brief actually asks for. The computation belongs at `/rotate`,
//      where the evidence is already being written, not at the moment Larry needs the answer.
//
// THE FILE IS WRITTEN BY THE ROTATION PATH. If it is absent or stale that is a fact worth stating,
// not a reason to guess — see `renderActiveBrief`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export const BRIEF_PATH = join(homedir(), '.mypka', 'governor', 'capae-active.json');

/** How old a brief may be before the render says so rather than presenting it as current. */
export const STALE_AFTER_DAYS = 14;

/**
 * SELECTION — one binary test, replacing the four-factor formula the brief sketched.
 *
 * Include a family iff its prevention is STILL UNPROVEN **and** a qualified exposure is plausible.
 * Both halves are read off the record, so the list bounds itself and "no actionable CAPAE state
 * means no CAPAE noise" is mechanically true rather than aspirational.
 *
 * EXCLUDED, DELIBERATELY:
 *   - EFFECTIVE — the prevention is proven, so the family LEAVES Larry's attention. This is the
 *     brief's "the list should naturally rotate" property. It returns by itself if it recurs,
 *     because a recurrence moves the family off EFFECTIVE.
 *   - UNMEASURABLE — no qualified exposure is plausible, so a line about it is something Larry can
 *     read but cannot act on. A counter that cannot advance implies progress nothing supports.
 *
 * RANKING approximates relevance × recurrence × consequence × prevention-still-unproven: the pilot
 * is pinned, a CHALLENGED prevention (already in doubt, so most likely to fail again) outranks a
 * MONITORING one, and recurrence count breaks the remaining ties.
 */
export function selectActive(families, { limit = 4 } = {}) {
  const list = Array.isArray(families) ? families : [];
  const eligible = list.filter((f) => f && !f.unmeasurable && f.state !== 'EFFECTIVE');
  const weight = (f) => (f.is_pilot ? 1000 : 0) + (f.state === 'CHALLENGED' ? 100 : 0) + Math.min(Number(f.occurrences) || 0, 20);
  return eligible
    .slice()
    .sort((a, b) => weight(b) - weight(a) || String(a.slug || '').localeCompare(String(b.slug || '')))
    .slice(0, limit);
}

/** The on-disk shape. Deliberately tiny — this file is read on every session start. */
export function buildBrief(families, { at = null } = {}) {
  return {
    schema: 1,
    written_at: at || new Date().toISOString(),
    families: selectActive(families).map((f) => ({
      slug: String(f.slug || ''),
      title: String(f.title || ''),
      occurrences: Number(f.occurrences) || 0,
      state: String(f.state || 'MONITORING'),
      cause: f.root_cause ? String(f.root_cause) : null,
      must: f.required_larry_behaviour ? String(f.required_larry_behaviour) : null,
      effectiveness: f.effectiveness ? String(f.effectiveness) : null,
    })),
  };
}

export function writeBrief(families, { path = BRIEF_PATH, at = null } = {}) {
  const brief = buildBrief(families, { at });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(brief, null, 2) + '\n');
  return brief;
}

/**
 * THE OPENING BRIEF — what Larry was handed at THIS session's start, preserved for /rotate.
 *
 * WHY THIS EXISTS, and it is the whole of Warwick's comparison loop (2026-08-08): `capae-sync.mjs`
 * REWRITES `capae-active.json` at every rotation. So by the time Pax is asked "did the preventions
 * Larry was told about actually hold?", the file no longer contains what Larry was told — it
 * contains what the NEXT session will be told. Pax would have been comparing behaviour against a
 * brief that did not exist when the behaviour happened.
 *
 * The snapshot is taken at SessionStart, overwritten once per session, and read at /rotate. It is a
 * copy of a small JSON file — deliberately not a store, not a table and not a session registry.
 * If it is absent, /rotate says so; it never substitutes the current brief and calls it the opening
 * one, because that is the exact substitution this function exists to prevent.
 */
export const OPENING_BRIEF_PATH = join(homedir(), '.mypka', 'governor', 'capae-opening.json');

export function snapshotOpeningBrief({ from = BRIEF_PATH, to = OPENING_BRIEF_PATH } = {}) {
  try {
    const raw = readFileSync(from, 'utf8');
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.families)) return null;
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, JSON.stringify({ ...j, snapshot_of: from, snapshot_at: new Date().toISOString() }, null, 2) + '\n');
    return j;
  } catch { return null; }
}

export function readOpeningBrief({ path = OPENING_BRIEF_PATH, io = { readFileSync } } = {}) {
  try {
    const j = JSON.parse(io.readFileSync(path, 'utf8'));
    return j && Array.isArray(j.families) ? j : null;
  } catch { return null; }
}

export function readBrief({ path = BRIEF_PATH, io = { readFileSync } } = {}) {
  try {
    const raw = io.readFileSync(path, 'utf8');
    const j = JSON.parse(raw);
    return j && Array.isArray(j.families) ? j : null;
  } catch { return null; }
}

/**
 * The rendered block, and it is the whole of what CAPAE costs Larry's context.
 *
 * THE CONTENT IS A MEASUREMENT INSTRUCTION, NOT AN EXHORTATION, and that inversion is the point.
 * The estate has already ruled the exhortation class exhausted: the map records a correction that
 * was "correct, present, canonical, already on main, and already duplicated into Larry's own
 * contract — and the behaviour still regressed within the same session, minutes later." Another
 * MUST-DO line at hour zero is a remedy already proven not to work, delivered at the hour of lowest
 * risk. So each line names what would COUNT as a qualified exposure, because recording the outcome
 * is the one thing CAPAE genuinely needs from Larry and the one thing only he can do.
 *
 * Returns '' when there is nothing actionable. NO ACTIONABLE STATE MEANS NO CAPAE NOISE.
 */
export function renderActiveBrief(brief, { now = new Date() } = {}) {
  if (!brief || !Array.isArray(brief.families) || brief.families.length === 0) return '';

  const lines = [`⟦GOV⟧ CAPAE WATCH — ${brief.families.length} active. Recall and measurement only, ZERO authority.`];

  // A STALE BRIEF SAYS SO. Presenting a fortnight-old list as current is the confident-wrong
  // failure this estate keeps paying for; the age is cheap to state and the reader can discount it.
  const writtenMs = Date.parse(brief.written_at || '');
  if (Number.isFinite(writtenMs)) {
    const days = Math.floor((now.getTime() - writtenMs) / 86400000);
    if (days >= STALE_AFTER_DAYS) {
      lines.push(`  ⚠️ this brief was computed ${days} days ago and may not reflect the current record — verify before relying on it.`);
    }
  }

  for (const f of brief.families) {
    const bits = [`  • ${f.title}`];
    if (f.cause) bits.push(`— cause: ${f.cause}`);
    lines.push(bits.join(' '));
    if (f.must) lines.push(`      MUST: ${f.must}`);
    lines.push(`      ${f.occurrences} occurrence${f.occurrences === 1 ? '' : 's'} · ${f.effectiveness || f.state}`);
  }
  lines.push('  → If one of these situations arises this session, it is a QUALIFIED EXPOSURE: record the outcome in the rotation report against its family slug. Do not manufacture work to create one.');
  return lines.join('\n');
}
