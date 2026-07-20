// BUILD-014 Tower supervisor loop — merge-class turn detection (FIX 1).
//
// A "merge-class" turn is one that involves a PR, checkpoint, completion/"done" claim,
// review, merge, or deploy. Such a turn must ALSO run the APPROVED Tower QA skill against
// REAL Git evidence — never accept a prose "it's done". Detection is two-pronged:
//
//   1) EXPLICIT — the turn was ingested with kind='merge_review' AND a concrete code target
//      (pr_number OR head_sha). This is the authoritative signal.
//   2) HEURISTIC — the turn was ingested ordinary, but Larry's response asserts completion /
//      merge / PR / done / review / deploy. We fail SAFE: a suspected merge-class turn is
//      treated as merge-class so a false "done" cannot slip through as a bare delivery review.
//
// Detection never fabricates a code target: if a heuristic hit has no resolvable head, the
// git-evidence gatherer fails closed (the review is BLOCKED, never assume-and-pass).

// Whole-word-ish assertions that a turn claims completion / a merge event. Bounded + explicit
// so the heuristic is auditable (no vague catch-alls).
const COMPLETION_PATTERNS = [
  /\bdone\b/i,
  /\bcompleted?\b/i,
  /\bfinished\b/i,
  /\bshipped?\b/i,
  /\bmerge(d|s|-ready)?\b/i,
  /\bdeploy(ed|ing|ment)?\b/i,
  /\bpull request\b/i,
  /\bPR\s*#?\d+/i,
  /\bcheckpoint\b/i,
  /\bready to (ship|merge|land)\b/i,
  /\bpasses? (all )?(the )?(tests|ci)\b/i,
];

/**
 * Decide whether a turn row is merge-class.
 * @param {object} turn  a row from tower.turn (needs: kind, pr_number, head_sha, base_sha,
 *   repo, larry_response). Extra fields ignored.
 * @param {object} [opts]
 * @param {boolean} [opts.heuristic=true]  when false, ONLY an explicit kind='merge_review'
 *   counts (the response-content heuristic is disabled). The live watcher keeps it ON; the
 *   deterministic test harnesses turn it OFF and declare merge-class turns explicitly.
 * @returns {{ isMergeClass:boolean, source:'explicit'|'heuristic'|null, reason:string,
 *   matched:string[] }}
 */
export function detectMergeClass(turn = {}, { heuristic = true } = {}) {
  const kind = String(turn.kind ?? 'ordinary');
  const hasTarget = turn.pr_number != null || (turn.head_sha != null && turn.head_sha !== '');

  // 1) Explicit declaration wins.
  if (kind === 'merge_review') {
    return {
      isMergeClass: true,
      source: 'explicit',
      reason: hasTarget
        ? `explicit kind='merge_review' with a code target (pr=${turn.pr_number ?? '-'} head=${turn.head_sha ?? '-'})`
        : "explicit kind='merge_review' (no code target provided — gatherer will fail closed if head is unresolvable)",
      matched: [],
    };
  }

  // 2) Heuristic on Larry's response (unless disabled).
  if (!heuristic) {
    return { isMergeClass: false, source: null, reason: 'ordinary (heuristic disabled; no explicit merge_review)', matched: [] };
  }
  const text = String(turn.larry_response ?? '');
  const matched = [];
  for (const re of COMPLETION_PATTERNS) {
    const m = text.match(re);
    if (m) matched.push(m[0]);
  }
  if (matched.length > 0) {
    return {
      isMergeClass: true,
      source: 'heuristic',
      reason: `response asserts completion/merge/PR/done/review/deploy (matched: ${matched.join(', ')})`,
      matched,
    };
  }

  return { isMergeClass: false, source: null, reason: 'ordinary delivery turn (no merge-class signal)', matched: [] };
}
