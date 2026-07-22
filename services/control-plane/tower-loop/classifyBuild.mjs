// BUILD-014 Tower — BUILD classification at ingestion (no fuzzy prose guessing, no BUILD-014 default).
//
// Priority (QA2 correction — a BUILD-002 turn must NOT land as BUILD-014):
//   1. explicit validated build_ref (e.g. the bounded merge-check/run supplies it);
//   2. explicit session/run configuration (TOWER_BUILD_REF env);
//   3. a STRICT BUILD-[0-9]{3} tag in a DEFINED metadata field — here: a LEADING `[BUILD-NNN` tag on
//      the instruction (the established turn-tag convention), NOT any BUILD-xxx buried in free prose;
//   4. otherwise 'UNCLASSIFIED' (never BUILD-014).
export const BUILD_REF_RE = /^BUILD-\d{3}$/;
// Leading BRACKETED tag only: "[BUILD-002 ...]" / "[BUILD-002]" / "[BUILD-002 —". The opening
// bracket is REQUIRED (QA-PR58-002): an unbracketed leading "BUILD-002 …" is NOT a tag and must
// not classify — only the explicit [BUILD-NNN convention counts, never a bare token or prose.
const LEADING_TAG_RE = /^\s*\[\s*(BUILD-\d{3})\b/;
// A full git commit SHA is exactly 40 hex chars — a merge-check must bind to the FULL, unambiguous
// head (QA-PR58-001), never an abbreviation that could resolve to more than one commit.
const FULL_SHA_RE = /^[0-9a-f]{40}$/i;

export function classifyBuildRef({ explicit = null, envRef = null, text = null } = {}) {
  if (explicit && BUILD_REF_RE.test(explicit)) return { build_ref: explicit, source: 'explicit' };
  if (envRef && BUILD_REF_RE.test(envRef)) return { build_ref: envRef, source: 'session_config' };
  const m = typeof text === 'string' ? LEADING_TAG_RE.exec(text) : null;
  if (m) return { build_ref: m[1], source: 'metadata_tag' };
  return { build_ref: 'UNCLASSIFIED', source: 'unclassified' };
}

// Merge-check runs demand FULLY explicit, unambiguous metadata (never inferred from conversation):
// a valid build_ref AND repo AND pr AND a FULL 40-char head SHA. Throws on anything missing/ambiguous.
export function classifyMergeRun({ buildRef, repo, prNumber, headSha } = {}) {
  if (!buildRef || !BUILD_REF_RE.test(buildRef)) throw new Error(`merge-check: explicit valid build_ref required (got "${buildRef}")`);
  if (!repo) throw new Error('merge-check: explicit repo required');
  // QA-PR58-004 — PR number must be a POSITIVE INTEGER. Fail CLOSED for NaN, non-integers,
  // zero/negative, and strings that are not a bare positive-integer (e.g. "", "58abc", "-5", "1.5").
  const prNum = typeof prNumber === 'number' ? prNumber : (/^\s*\d+\s*$/.test(String(prNumber)) ? Number(prNumber) : NaN);
  if (!Number.isInteger(prNum) || prNum <= 0) throw new Error(`merge-check: explicit positive-integer PR number required (got "${prNumber}")`);
  if (!headSha || !FULL_SHA_RE.test(String(headSha))) throw new Error('merge-check: explicit FULL 40-char head sha required');
  return { build_ref: buildRef, source: 'merge_check_explicit' };
}
