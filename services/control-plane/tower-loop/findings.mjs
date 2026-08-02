// WO-OR-22 Tower supervisor loop — FINDING CARRY-FORWARD + the DISPOSITION GATE.
//
// Extracted from watcher.mjs (which previously held loadOpenFindings and the staged-input
// injection inline) so the gate can live beside the loader AND still be the code the REAL
// review round runs. That last part is the whole point: a gate in a module watcher.mjs never
// calls would be a seam the actual review path does not use.
//
// WHAT THIS ADDS over the original carry-forward: a prior open finding must carry a
// DISPOSITION, and that disposition must have been judged AT THIS ROUND'S HEAD. Otherwise the
// review round is REJECTED before any reviewer is invoked. No silent carry-over.
//
// Shape deliberately mirrors review/reviewClassification.mjs:80-98 — collect errors, name the
// offending finding in each, never throw, fail closed. That module is this estate's house
// pattern for fail-closed disposition checking and this is the tower.* counterpart of it.

/** The PRIOR-FINDING vocabulary. Verbatim from review/reviewClassification.mjs:20
 *  (PRIOR_FINDING_STATUSES). Deliberately NOT the five-value ops.required_disposition
 *  merge-authority axis — see comment_schema.sql §3 and db/migrations/006:15-22. */
export const FINDING_DISPOSITIONS = Object.freeze(['addressed', 'remains_open', 'unrelated']);

/** Load a build's OPEN findings, now carrying their disposition columns. Ordering is stable
 *  (created_at asc) so the staged input is byte-identical across restarts — the property the
 *  packet_hash audit depends on. */
export async function loadOpenFindings(pool, buildRef) {
  const { rows } = await pool.query(
    `select id, build_ref, description, state, created_at, opened_turn_id,
            disposition, disposition_rationale, disposition_source,
            disposition_comment_id, disposition_head_sha, disposition_at
       from tower.finding where build_ref = $1 and state = 'open' order by created_at asc`,
    [buildRef],
  );
  return rows;
}

/** Normalise a head for comparison. Canonical SHAs are stored lower-case by domain constraint;
 *  the turn side is plain text and may carry anything, so trim + lower-case before comparing. */
const normHead = (s) => String(s ?? '').trim().toLowerCase();

/**
 * THE GATE. Given a build's open findings, decide whether the next review round may proceed.
 *
 * A finding requires a disposition when it is a PRIOR finding — i.e. it was not opened by the
 * turn currently under review. A finding with no opened_turn_id is treated as prior
 * (fail closed: unknown provenance is never waved through).
 *
 * Two rejection classes, both naming the finding:
 *   · UNDISPOSED   — an open prior finding with no disposition at all. This is the
 *                    "no silent carry-over" rule from reviewClassification.mjs:93-97.
 *   · STALE        — a disposition judged at a DIFFERENT head than this round's. This is what
 *                    stops an answer written against an older head from being reused after the
 *                    PR moves on. Only checked when the round HAS a head to compare against;
 *                    an ordinary (non-PR) turn carries no head_sha, so the comparison is
 *                    skipped there and only the presence rule applies. Stated limitation.
 *
 * @returns {{ok: boolean, errors: string[], required: number, disposed: number}}
 *          NEVER throws — same contract as validateReviewerResult.
 */
export function checkFindingDispositions(openFindings = [], { currentTurnId = null, headSha = null } = {}) {
  const errors = [];
  const roundHead = normHead(headSha);
  let required = 0;
  let disposed = 0;

  for (const f of Array.isArray(openFindings) ? openFindings : []) {
    if (!f) continue;
    // Opened by THIS turn ⇒ not a prior finding; it has not had a round to be answered in yet.
    if (currentTurnId && f.opened_turn_id && String(f.opened_turn_id) === String(currentTurnId)) continue;
    required += 1;

    if (!f.disposition) {
      errors.push(
        `prior open finding ${f.id} has no disposition (no silent carry-over, fail-closed) — `
        + `"${String(f.description ?? '').slice(0, 80)}"`);
      continue;
    }
    if (!FINDING_DISPOSITIONS.includes(f.disposition)) {
      errors.push(`prior open finding ${f.id} has an invalid disposition: ${String(f.disposition)}`);
      continue;
    }
    // STALE: the answer was judged at a head this round is no longer at.
    const dispHead = normHead(f.disposition_head_sha);
    if (roundHead && dispHead && dispHead !== roundHead) {
      errors.push(
        `prior open finding ${f.id} was disposed at head ${dispHead.slice(0, 12)} but this round `
        + `is at head ${roundHead.slice(0, 12)} — a disposition from an older head is STALE and is `
        + `not carried forward (re-answer it at the current head)`);
      continue;
    }
    disposed += 1;
  }

  return { ok: errors.length === 0, errors, required, disposed };
}

/**
 * Build the staged reviewer input: the reconstructed turn text plus the build's open findings,
 * each carrying its disposition and that disposition's provenance. This is how the dispositions
 * parsed out of a PR comment reach the next review round AUTOMATICALLY FROM THE DATABASE —
 * nothing is hand-carried into the packet.
 */
export function buildStagedInput(baseText, buildRef, openFindings = []) {
  if (!Array.isArray(openFindings) || openFindings.length === 0) return baseText;
  return [
    baseText,
    `## Open findings for ${buildRef} — MUST be accounted for`,
    `These findings are still OPEN from earlier reviews. If Larry's response silently drops`,
    `any of them without resolving it, do NOT continue — correct or block, and carry it`,
    `forward. Never let a finding silently disappear.`,
    `Each line carries the disposition recorded for it, and where that disposition came from.`,
    ...openFindings.map((f) => formatFindingLine(f)),
    ``,
  ].join('\n');
}

/** One staged line per finding. The disposition and its provenance are part of the reviewer's
 *  input, so the reviewer can see not just WHAT was answered but WHERE the answer came from
 *  (an ingested PR comment vs a hand-typed claim) and at which head. */
export function formatFindingLine(f) {
  const base = `- [finding ${f.id}] (${f.state}) ${f.description}`;
  if (!f.disposition) return `${base}\n    disposition: NONE — undisposed`;
  const src = f.disposition_source === 'pr_comment'
    ? `pr_comment:${f.disposition_comment_id}`
    : String(f.disposition_source ?? 'unknown');
  const head = f.disposition_head_sha ? String(f.disposition_head_sha).slice(0, 12) : 'no-head';
  const why = f.disposition_rationale ? ` — ${f.disposition_rationale}` : '';
  return `${base}\n    disposition: ${f.disposition} (source=${src} head=${head})${why}`;
}
