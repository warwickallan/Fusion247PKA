// Mechanical git-lifecycle escalation gate (BUILD-018 T-17, AMENDED 2026-07-31)
//
// WHAT THIS ACTUALLY COVERS — READ THIS BEFORE RELYING ON IT (AC6)
// -------------------------------------------------------------------
// This module detects and refuses exactly ONE mechanically-decidable shape of
// unnecessary escalation: an AskUserQuestion whose offered options propose a
// git history/lifecycle operation (force-push, amend of an already-pushed
// ref, rebase, reset --hard, filter-branch, filter-repo) as something for
// WARWICK to decide. It does this NOT by judging whether the underlying
// defect is cosmetic — see "WHY THIS IS GROUNDED ON AD-20, NOT AD-26'S
// COSMETIC QUESTION" below — but by a single mechanical fact: AD-20 already
// assigns the complete git lifecycle to Larry, unconditionally. Offering
// Warwick that choice is wrong regardless of what is behind it.
//
// IT DOES NOT ENFORCE AD-26 GENERALLY. AD-26 also says never escalate typos,
// wording, formatting, naming, ticket boundaries, completed workers, or
// ordinary routing choices — NONE of those have any enumerable, mechanical
// signal this module (or, as far as this ticket could determine, any
// mechanical module) can check. They have NO detector here and remain
// UNENFORCED. Larry observing AD-26 for those categories is still,
// exactly as before this ticket, unaided by any control. No comment, log
// line, verdict reason or evidence-doc sentence in this module may be read as
// implying broader coverage than this. If you are extending this module,
// extend the header first.
//
// THE FAILURE THIS CLOSES (D-4)
// -------------------------------
// A write-back commit landed and pushed correctly. Larry noticed a stray '@'
// in the commit SUBJECT LINE and raised an AskUserQuestion offering to amend
// + force-push already-pushed history to fix it. Warwick ruled this an
// acceptance failure: a harmless no-action default existed, so it was never
// his decision, and asking manufactured a pause (D-4, AD-26).
//
// WHY THIS IS GROUNDED ON AD-20, NOT AD-26'S COSMETIC QUESTION
// ----------------------------------------------------------------
// The first draft of this ticket asked for a classifier that could tell
// "cosmetic defect" from "genuine product decision". Keel's read-back
// (T-17, CLARIFY) found that determination has NO mechanical signal — and
// that a caller-supplied field asserting it would be self-attestation by the
// very actor (Larry) who wants to escalate: a hope, not a control, in
// delegation-gate.mjs's own words. Warwick's amendment removed that
// determination from the gate entirely and re-grounded it on AD-20, already
// a locked decision in this build: "Warwick never manages branches,
// worktrees, commits, pushes or PR creation. Larry owns the complete Git
// lifecycle." That makes the refusal mechanical with NO judgement step: an
// escalation offering Warwick a git-lifecycle choice is wrong whether or not
// the defect behind it is cosmetic, because that choice was never his to
// begin with. AC3 requires the D-4 test case to pass with NO "is cosmetic"
// input anywhere — the refusal stands on AD-20 alone.
//
// THE MECHANICAL CORE VS. THE HEURISTIC TEXT LAYER — KEPT DELIBERATELY SEPARATE
// ---------------------------------------------------------------------------
// `classifyEscalation` (the pure core, AC1/AD-11) makes its decision over an
// ALREADY-STRUCTURED `proposedOperations` list drawn from the exported,
// enumerable `GIT_LIFECYCLE_OPERATIONS` vocabulary (AC2) — membership
// checking, not text judgement. That is the whole mechanical claim.
//
// `detectGitLifecycleOperations` (below the "BEST-EFFORT TEXT EXTRACTION"
// marker) is a SEPARATE, honestly-labelled heuristic: a keyword/phrase scan
// over raw escalation text, needed because the real AskUserQuestion surface
// hands this module free text, not a pre-built operations list. It is biased
// toward UNDER-detection on purpose (AC4's fail-open direction): a missed
// operation falls through to UNCLASSIFIABLE/ALLOWED, which is the safe
// failure; the one thing it must never do is invent a match that produces a
// wrongful REFUSED. It is not, and does not claim to be, natural-language
// understanding — it is exported and tested separately from the mechanical
// core precisely so the two are never confused with each other.
//
// THE UNPROVEN AskUserQuestion PAYLOAD SHAPE — NAMED FOG, NOT SOLVED HERE
// ----------------------------------------------------------------------
// Keel's T-17 preflight searched this entire estate for a captured/proven
// schema of what a real PreToolUse hook receives for an AskUserQuestion tool
// call and found NONE — unlike T-01's proven statusLine schema, there is no
// local evidence here. `network: none` withholds WebFetch/WebSearch from
// Keel, so this could not be verified against documentation either. Per the
// amended Work Order, this module is designed against Keel's OWN DOCUMENTED
// assumed shape (see `describeEscalationFromToolInput` below):
//   tool_input.questions: [{ question, header, options: [{ label, description }], multiSelect }]
// If the real shape differs, `describeEscalationFromToolInput` extracts
// nothing usable (it never throws, never guesses a different shape) and the
// call safely falls through to UNCLASSIFIABLE -> ALLOWED — fail-open applies
// here too. Confirming or correcting this assumed shape against a REAL
// captured payload is fog for the separate, not-yet-authorised activation
// step (installing this gate into `.claude/settings.local.json`), exactly as
// T-03's sampler deferred live statusLine wiring.
//
// FAIL-DIRECTION (AC4, AD-6/INV-2 posture, T-16's precedent)
// -------------------------------------------------------------
// This is a discipline gate over Larry's own escalation behaviour, not a
// safety-critical file-protection control. REFUSED is reserved for a
// positive, successfully-computed match against the enumerable vocabulary
// with no valid escape-hatch reason. Every other outcome — malformed input,
// an unreadable operations list, a thrown error anywhere in the impure
// wrapper — ALLOWS. Over-blocking a legitimate escalation (a merge decision,
// a spend, an irreversible live action, a genuine unsafe-repository-state
// report) is the worse defect; missing a needless question is the safe
// failure. Proved by mutation test in escalation-gate.test.mjs.
//
// COMPOSED ADDITIVELY ONTO worktree-guard.mjs — NOT MODIFIED
// ---------------------------------------------------------------
// This module imports `parseHookInput` and `DECISION` (read-only) from
// worktree-guard.mjs, the same PreToolUse hook-input parsing and decision
// vocabulary delegation-gate.mjs (T-16) already reuses. worktree-guard.mjs
// itself is untouched — not one exported function, not one line of
// behaviour — proven at handback by its own test file (27/27, unchanged) and
// an empty `git diff`.
//
// THE ESCAPE HATCH (AC5) — CLOSED ENUM, NEVER FREE TEXT
// ----------------------------------------------------------
// AD-26 puts "an unsafe repository state" on the ESCALATE list (e.g. a secret
// committed to pushed history, where a history rewrite genuinely is the
// right and necessary remedy). This module never tries to detect that case
// from prose — that would be exactly the free-text judgement problem this
// gate exists to avoid. Instead `ESCAPE_HATCH_REASONS` is a closed,
// single-entry enum (mirroring delegation-gate.mjs's `REASON_ENUM` /
// `justify` precedent), its use is checked by exact string equality only,
// and every time it fires it is RECORDED in the returned verdict
// (`escapeHatchUsed`) rather than silently suppressing the match — visible,
// not silent, per AC5.
//
// ACTIVATION IS OUT OF SCOPE
// -----------------------------
// This ticket builds and proves the mechanism only. Wiring it into
// `install-hooks.mjs` / `.claude/settings.local.json` is a separate,
// not-yet-authorised step (same posture as T-03's sampler and T-16's
// delegation gate before its own activation).

import { parseHookInput, DECISION } from './worktree-guard.mjs';
import { pathToFileURL } from 'node:url';

export { DECISION };

// ---------------------------------------------------------------------------
// Enumerable verdict constants (AC1) — evaluator.mjs's STATE/EXIT_CODE
// precedent. UNCLASSIFIABLE gets its own exit code, distinct from ALLOWED,
// for the same reason BLIND is never GREEN in evaluator.mjs: "could not
// decide" must never look identical to "positively checked and fine".
// ---------------------------------------------------------------------------

export const VERDICT = Object.freeze({
  REFUSED: 'REFUSED',
  ALLOWED: 'ALLOWED',
  UNCLASSIFIABLE: 'UNCLASSIFIABLE',
});

export const EXIT_CODE = Object.freeze({
  [VERDICT.ALLOWED]: 0,
  [VERDICT.UNCLASSIFIABLE]: 1,
  [VERDICT.REFUSED]: 2,
});

// The AC2 vocabulary — the ENTIRE mechanical signal set this module looks
// at. Exported so a reviewer can see it in one place, following
// evaluator.mjs's SIGNAL_KEYS precedent and worktree-guard.mjs's
// classifyBashCommand style of enumerable, deterministic classification.
export const GIT_LIFECYCLE_OPERATIONS = Object.freeze([
  'push-force', // git push --force / -f
  'force-with-lease', // git push --force-with-lease
  'amend-pushed', // git commit --amend targeting an ALREADY-PUSHED ref
  'rebase',
  'reset-hard',
  'filter-branch',
  'filter-repo',
]);

// AC5 — closed, single-entry today. Not v1-populated beyond what AD-26
// actually names (mirrors delegation-gate.mjs's SPECIALIST_MATCH_ENUM
// "reserved but not populated" discipline): extend only when a NEW
// AD-26-escalate-only category is named, never speculatively.
export const ESCAPE_HATCH_REASONS = Object.freeze(['unsafe-repository-state']);

// ---------------------------------------------------------------------------
// Pure: the mechanical core (AC1, AC2, AD-11 purity — zero fs/git/estate
// knowledge, zero text parsing in this function)
// ---------------------------------------------------------------------------

function normaliseOperations(list) {
  // Absence is UNKNOWN, never "confirmed zero" — the same discipline
  // evaluator.mjs applies to every signal it reads. A malformed or missing
  // `proposedOperations` field means "we cannot tell", not "nothing was
  // proposed"; only an explicitly-supplied (possibly empty) array counts as
  // a confident "checked, and here is what was found".
  if (!Array.isArray(list)) return null;
  const set = new Set();
  for (const item of list) {
    if (typeof item === 'string' && GIT_LIFECYCLE_OPERATIONS.includes(item)) set.add(item);
  }
  return [...set];
}

function resolveEscapeHatch(reason) {
  return typeof reason === 'string' && ESCAPE_HATCH_REASONS.includes(reason) ? reason : null;
}

/**
 * classifyEscalation(describedEscalation) -> verdict
 *
 * describedEscalation is a plain object, Keel's own documented shape (no
 * proven real-world schema exists — see the module header):
 *   {
 *     proposedOperations?: string[]  // subset of GIT_LIFECYCLE_OPERATIONS
 *     escapeHatchReason?: string     // one of ESCAPE_HATCH_REASONS, or absent
 *   }
 *
 * Every field is OPTIONAL and every failure to read it lands on
 * UNCLASSIFIABLE, never REFUSED — this function cannot itself deny anything
 * on a guess. Zero filesystem/git/myPKA knowledge (AD-11): it only ever
 * looks at the object handed to it.
 */
export function classifyEscalation(describedEscalation) {
  const input =
    describedEscalation && typeof describedEscalation === 'object' && !Array.isArray(describedEscalation)
      ? describedEscalation
      : null;

  if (!input) {
    return {
      verdict: VERDICT.UNCLASSIFIABLE,
      exitCode: EXIT_CODE[VERDICT.UNCLASSIFIABLE],
      matchedOperations: [],
      escapeHatchUsed: null,
      reason: 'describedEscalation was not a usable object — cannot classify; allowed by default (fail open).',
    };
  }

  const matchedOperations = normaliseOperations(input.proposedOperations);
  if (matchedOperations === null) {
    return {
      verdict: VERDICT.UNCLASSIFIABLE,
      exitCode: EXIT_CODE[VERDICT.UNCLASSIFIABLE],
      matchedOperations: [],
      escapeHatchUsed: null,
      reason: 'proposedOperations was not a readable array — cannot classify; allowed by default (fail open).',
    };
  }

  if (matchedOperations.length === 0) {
    return {
      verdict: VERDICT.ALLOWED,
      exitCode: EXIT_CODE[VERDICT.ALLOWED],
      matchedOperations: [],
      escapeHatchUsed: null,
      reason: 'no recognised git-lifecycle operation was proposed to Warwick.',
    };
  }

  const escapeHatchUsed = resolveEscapeHatch(input.escapeHatchReason);
  if (escapeHatchUsed) {
    return {
      verdict: VERDICT.ALLOWED,
      exitCode: EXIT_CODE[VERDICT.ALLOWED],
      matchedOperations,
      escapeHatchUsed,
      reason:
        `git-lifecycle operation(s) [${matchedOperations.join(', ')}] proposed, but the declared ` +
        `escape-hatch reason "${escapeHatchUsed}" applies — AD-26 puts unsafe-repository-state on the ` +
        'escalate-only list.',
    };
  }

  return {
    verdict: VERDICT.REFUSED,
    exitCode: EXIT_CODE[VERDICT.REFUSED],
    matchedOperations,
    escapeHatchUsed: null,
    reason:
      `AD-20 assigns the complete git lifecycle to Larry, never Warwick. This escalation proposes ` +
      `[${matchedOperations.join(', ')}] as a choice for Warwick, which is not his decision to make ` +
      'regardless of whether the underlying defect is cosmetic (see D-4). Safe default: Larry resolves ' +
      'this himself, or takes the no-action default, and continues without asking.',
  };
}

// ---------------------------------------------------------------------------
// BEST-EFFORT TEXT EXTRACTION — heuristic, NOT the mechanical core. See the
// module header ("THE MECHANICAL CORE VS. THE HEURISTIC TEXT LAYER").
// ---------------------------------------------------------------------------

const FORCE_WITH_LEASE_PATTERN = /--force-with-lease/i;
const PUSH_FORCE_PATTERN = /\bforce[\s-]?push\b|\bpush\b[^.\n]{0,20}\B--?force\b|\bpush\s+-f\b/i;
const REBASE_PATTERN = /\brebase\b/i;
const RESET_HARD_PATTERN = /\breset\s+--hard\b|\bhard\s+reset\b/i;
const FILTER_BRANCH_PATTERN = /\bfilter-branch\b/i;
const FILTER_REPO_PATTERN = /\bfilter-repo\b/i;
const AMEND_PATTERN = /\bamend(?:ed|ing)?\b/i;
const PUSHED_CONTEXT_PATTERN = /\balready[\s-]?pushed\b|\bpushed\s+history\b|\bpublished\b|\bremote\s+history\b/i;
const ESCAPE_HATCH_MARKER = /\[AD-26:unsafe-repository-state\]/i;

/**
 * detectGitLifecycleOperations(text) -> string[] (subset of GIT_LIFECYCLE_OPERATIONS)
 *
 * A keyword/phrase scan, not intent parsing. Biased toward under-detection —
 * a paraphrase this misses falls through to UNCLASSIFIABLE/ALLOWED (safe);
 * it must never invent a match that causes a wrongful REFUSED. `amend` alone
 * never counts: only in combination with an explicit force-push signal or an
 * "already pushed"-shaped phrase, because a bare amend of an unpushed commit
 * is routine, harmless, and not remotely escalation-worthy.
 */
export function detectGitLifecycleOperations(text) {
  if (typeof text !== 'string' || text.trim() === '') return [];
  const ops = new Set();
  if (FORCE_WITH_LEASE_PATTERN.test(text)) ops.add('force-with-lease');
  if (PUSH_FORCE_PATTERN.test(text)) ops.add('push-force');
  if (REBASE_PATTERN.test(text)) ops.add('rebase');
  if (RESET_HARD_PATTERN.test(text)) ops.add('reset-hard');
  if (FILTER_BRANCH_PATTERN.test(text)) ops.add('filter-branch');
  if (FILTER_REPO_PATTERN.test(text)) ops.add('filter-repo');
  if (
    AMEND_PATTERN.test(text) &&
    (ops.has('push-force') || ops.has('force-with-lease') || PUSHED_CONTEXT_PATTERN.test(text))
  ) {
    ops.add('amend-pushed');
  }
  return [...ops];
}

/**
 * detectEscapeHatchReason(text) -> 'unsafe-repository-state' | null
 *
 * A literal, exact marker string, NOT sentiment or free-text judgement — the
 * same mechanical standard as the operations vocabulary above. Larry (or a
 * future caller) types the literal marker to declare the escape hatch
 * explicitly; nothing here infers intent from surrounding prose.
 */
export function detectEscapeHatchReason(text) {
  if (typeof text !== 'string') return null;
  return ESCAPE_HATCH_MARKER.test(text) ? 'unsafe-repository-state' : null;
}

/**
 * describeEscalationFromToolInput(toolInput) -> describedEscalation
 *
 * Builds a `describedEscalation` object (classifyEscalation's input shape)
 * out of a raw AskUserQuestion `tool_input`, under Keel's OWN DOCUMENTED,
 * UNPROVEN assumption of that payload's shape — see the module header.
 * Never throws: any unexpected shape simply yields no extracted signal.
 */
export function describeEscalationFromToolInput(toolInput) {
  const questions = toolInput && Array.isArray(toolInput.questions) ? toolInput.questions : [];
  const textParts = [];
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    if (typeof q.question === 'string') textParts.push(q.question);
    if (typeof q.header === 'string') textParts.push(q.header);
    const options = Array.isArray(q.options) ? q.options : [];
    for (const opt of options) {
      if (!opt || typeof opt !== 'object') continue;
      if (typeof opt.label === 'string') textParts.push(opt.label);
      if (typeof opt.description === 'string') textParts.push(opt.description);
    }
  }
  const combinedText = textParts.join('\n');
  return {
    proposedOperations: detectGitLifecycleOperations(combinedText),
    escapeHatchReason: detectEscapeHatchReason(combinedText),
  };
}

// ---------------------------------------------------------------------------
// Impure: the one composition function usable from a PreToolUse hook (AC1)
// ---------------------------------------------------------------------------
// Mirrors delegation-gate.mjs's evaluateDelegationGate/runCheckHook shape.
// Matches ONLY AskUserQuestion; every other tool DEFERs (no opinion, exactly
// like worktree-guard's own decide() deferring on ungoverned tools).

// `describe`/`classify` are injectable purely so a test can force the throw
// path against the real functions' contract without monkey-patching an ES
// module's named export — the same technique status-line.mjs's
// `computeStatusLine` uses for `evaluateFn`, needed for the same reason: both
// real functions are proven total over their documented domain by their own
// test files and so cannot be made to throw without injection.
export function evaluateEscalationGate({
  toolName,
  toolInput,
  describe = describeEscalationFromToolInput,
  classify = classifyEscalation,
} = {}) {
  if (toolName !== 'AskUserQuestion') {
    return {
      decision: DECISION.DEFER,
      reason: `${toolName ?? '(no tool)'} is not governed by the escalation gate.`,
    };
  }

  let described;
  try {
    described = describe(toolInput);
  } catch (err) {
    // Fail open (AC4): a broken extraction must never become a denial.
    return { decision: DECISION.ALLOW, reason: `could not describe the escalation (${err.message}); failing open.` };
  }

  let result;
  try {
    result = classify(described);
  } catch (err) {
    return {
      decision: DECISION.ALLOW,
      reason: `classifyEscalation threw (${err.message}); failing open.`,
      described,
    };
  }

  if (result.verdict === VERDICT.REFUSED) {
    return { decision: DECISION.DENY, reason: buildRefusalMessage(result), verdict: result, described };
  }
  return { decision: DECISION.ALLOW, verdict: result, described };
}

function buildRefusalMessage(result) {
  return [
    '🚨 ESCALATION GATE — the BUILD-018 Session Governor blocked this AskUserQuestion call.',
    '',
    `Proposed git-lifecycle operation(s): ${result.matchedOperations.join(', ')}`,
    '',
    "AD-20: Warwick never manages branches, worktrees, commits, pushes or PR creation — Larry owns",
    "the complete git lifecycle. Offering Warwick this choice is not his decision to make, regardless",
    'of whether the underlying defect is cosmetic (see D-4, the acceptance failure this gate closes).',
    '',
    'SAFE DEFAULT: resolve this yourself (or take the no-action default) and continue without asking.',
    '',
    "If this genuinely IS an unsafe-repository-state escalation (e.g. a secret committed to pushed",
    "history — AD-26's escalate-only list), declare it explicitly with the closed escape-hatch reason",
    "'unsafe-repository-state' rather than relying on this gate to infer intent from wording.",
  ].join('\n');
}

// toHookOutput is duplicated as a literal from delegation-gate.mjs's own
// 8-line function rather than imported, for the same reason model-gate.mjs
// duplicates CONTEXT_CAP instead of importing it: this is a sibling gate
// module, not a layer beneath delegation-gate.mjs, and importing across
// sibling gates for eight lines would create a dependency edge neither
// module otherwise needs.
export function toHookOutput(result) {
  if (!result || result.decision !== DECISION.DENY) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    },
  };
}

export function runEscalationGateHook(raw) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) {
    return { decision: DECISION.ALLOW, reason: `could not read input (${parsed.reason}); failing open.` };
  }
  const payload = parsed.payload;
  try {
    return evaluateEscalationGate({ toolName: payload.tool_name, toolInput: payload.tool_input || {} });
  } catch (err) {
    return { decision: DECISION.ALLOW, reason: `escalation gate errored (${err.message}); failing open.` };
  }
}

// ---------------------------------------------------------------------------
// CLI — a PreToolUse hook ALWAYS exits 0 (never traps the session over its
// own bug), mirroring delegation-gate.mjs's `check` subcommand exactly. NOT
// wired into install-hooks.mjs by this ticket (activation is out of scope) —
// this exists so the module is genuinely "usable from a PreToolUse hook" per
// AC1, ready for that separate, not-yet-authorised activation step.
// ---------------------------------------------------------------------------

async function readStdin() {
  let raw = '';
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }
  return raw;
}

async function mainCheck() {
  const raw = await readStdin();
  let out = null;
  try {
    out = toHookOutput(runEscalationGateHook(raw));
  } catch {
    out = null; // fail open
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

function usage() {
  return 'usage: node escalation-gate.mjs check   (reads a PreToolUse hook payload from stdin)';
}

async function main() {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'check') return mainCheck();
  process.stderr.write(usage() + '\n');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
