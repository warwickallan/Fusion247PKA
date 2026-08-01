// The Governor footer — ONE renderer, ONE parser, ONE vocabulary (BUILD-018 WP-3, D-D).
//
// This module owns the `⟦GOV⟧` line end-to-end: the byte grammar (D-2), the
// degradation ladder that decides what it says (D-3), and the `UNSET` predicate that
// decides whether a model name may appear at all (D-4). `stop-controller.mjs` and the
// live status line both import from here. Nothing re-implements the grammar — that is
// the whole point of the module (Silas D-1): a footer produced by one actor and checked
// by another is only a contract if both go through the same code. Two hand-written
// copies are a convention, and conventions drift.
//
// ---------------------------------------------------------------------------
// A CONSIDERED CORRECTION TO SILAS'S D-1 SIGNATURE — not drift (Larry, WP-3 amendment)
// ---------------------------------------------------------------------------
// D-1 specifies `renderFooter(model) -> string`. That signature cannot work and the
// decision document is the defect: a model name alone cannot produce CTX, STATE, ADVICE
// or CTRL, which are four of the grammar's five fields. It is also incompatible with
// D-M10, which requires `parseFooter(renderFooter(x)) === x` to hold "for every field
// combination" — a round-trip identity that is only meaningful if `renderFooter` is
// given the field set it is supposed to round-trip. The signature here is therefore
// `renderFooter(fields)` over the five grammar fields plus the `~` approximate flag.
// Raised at read-back, ruled by Larry, recorded here so the next reader sees a decision
// rather than a deviation.
//
// ---------------------------------------------------------------------------
// STRICT RENDER, DEGRADING DERIVE — the split, and why it runs this way
// ---------------------------------------------------------------------------
// `status-line.mjs` degrades rather than throws, and that is right for it: it renders a
// human-facing line from a verdict object and a wrong line there is merely ugly. This
// module is different, because its output is CONSUMED — `stop-controller.mjs` parses the
// footer and acts on the control token. So the two halves take opposite postures:
//
//   * `renderFooter` is STRICT and THROWS on any field outside the grammar. Coercing a
//     bad field into something renderable would emit a plausible-but-wrong footer, and a
//     wrong footer feeds a control decision. Callers already wrap their rendering in
//     try/catch (see `statusline-live.mjs`'s last-resort handler), so a throw degrades
//     visibly instead of silently.
//   * `deriveFooterFields` NEVER throws. It is where the degradation lives: anything it
//     cannot read, parse, trust or represent becomes BLIND (INV-1 — BLIND is never
//     GREEN), and BLIND is a perfectly valid footer that renders cleanly.
//
// Net effect: unreadable telemetry produces an honest BLIND line; a caller passing
// garbage FIELDS produces a loud failure. Neither produces a false GREEN.
//
// ---------------------------------------------------------------------------
// IMPORT COST, because this sits on the Stop path
// ---------------------------------------------------------------------------
// A-7 forbids any `git` invocation in the Stop path. Nothing here shells out, and none
// of the four modules imported below executes anything at import time —
// `worktree-guard.mjs` imports `execFileSync` but only calls it inside functions this
// module never touches. `samePath` is imported rather than copied because path equality
// that disagrees with the rest of the estate is exactly the bug that produces a
// permanent false WRONG WORKTREE (worktree-guard.mjs's own note), and SSOT says one
// implementation.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, STATE } from './evaluator.mjs';
import { samePath } from './worktree-guard.mjs';
import { readProgrammeState } from './programme-state.mjs';
import { readHealthSample, healthStoreDir } from './health-store.mjs';

// ---------------------------------------------------------------------------
// The vocabulary — closed sets, membership-checked, never text-judged
// ---------------------------------------------------------------------------
// `escalation-gate.mjs`'s AC2 precedent: a closed vocabulary is checked by MEMBERSHIP,
// never by asking whether a string "looks like" a handback reason. A vocabulary gap must
// surface as an unrecognised token (which B6 treats as CONTINUE), never as a judgement
// call made at the moment someone wants a particular answer.

// U+27E6 / U+27E7. Spelled as escapes so the marker survives any editor or terminal that
// mangles astral-adjacent punctuation — the bytes are load-bearing, not decorative.
export const GOV_OPEN = '⟦';
export const GOV_CLOSE = '⟧';
export const GOV_MARKER = `${GOV_OPEN}GOV${GOV_CLOSE}`;

// SEP is exactly U+0020 U+00B7 U+0020 (D-2). A middle dot is NOT a period and NOT a
// hyphen; D-M11 exists to prove the parser rejects both.
export const SEP = ' · ';

// Constitution clause 4's seven legitimate interruptions, one-for-one. The source of
// this list is root CLAUDE.md § "When Warwick may be interrupted"; this const is the
// machine-readable copy the controller checks against, and it must not grow a member
// that has no clause behind it.
//
// `unsafe-repository-state` — NOT `unsafe-state`. Silas's §D-2 grammar block carries the
// wrong token (its `CODE` production and its A-3 list both say `unsafe-state`), and the
// decision document is the stale copy. The authority is the already-shipped, frozen
// literal in `escalation-gate.mjs`: `ESCAPE_HATCH_REASONS = Object.freeze([
// 'unsafe-repository-state' ])`, which that module also applies to Larry's own text as
// `/\[AD-26:unsafe-repository-state\]/i`. `unsafe-state` appears nowhere in `tools/`.
// Had this shipped as written, the footer would have emitted a code matching neither the
// frozen enum nor the constitution, and the parser and the escalation gate would have
// disagreed about the single token that decides whether Larry may end a turn.
// footer.test.mjs asserts this membership against the imported literal rather than
// against a string typed here, so the two cannot drift apart again. Do not "correct"
// this back.
export const HANDBACK_CODES = Object.freeze([
  'product-decision',
  'permission',
  'spend',
  'irreversible-live-action',
  'unsafe-repository-state',
  'rotation-required',
  'merge-decision',
]);

export const FOOTER_STATES = Object.freeze(['GREEN', 'AMBER', 'RED', 'RECOVERY', 'BLIND']);

export const ADVICE = Object.freeze({
  KEEP_GOING: 'KEEP GOING',
  CLEAR_NOW: 'CLEAR NOW',
  UNSURE: 'KEEP GOING?',
});
export const ADVICE_VALUES = Object.freeze([ADVICE.KEEP_GOING, ADVICE.CLEAR_NOW, ADVICE.UNSURE]);

// D-2's NEXT production. This is narrower than D-4's U-c (which only excludes `unknown`
// and `any`), and the grammar wins where they meet: a `model_recommendation.model` of
// "GPT-5" satisfies U-c but has no representation in the footer, so it renders UNSET.
// Stated explicitly because it is a real constraint D-4 does not mention.
export const NEXT_MODELS = Object.freeze(['Opus', 'Sonnet', 'Haiku']);
export const NEXT_UNSET = 'UNSET';

export const CONTROL_CONTINUE = 'CONTINUE';
export const HANDBACK_PREFIX = 'HANDBACK:';

// D-3: twenty minutes, chosen against the observed cadence — the status line re-renders
// every turn, so a sample older than one long tool-running turn is from a session that
// has stopped producing telemetry.
export const STALE_AFTER_MS = 20 * 60 * 1000;

// The health sample's schema version (health-store.mjs / sampler.mjs write `1`).
// Anything else is "unrecognised schema" on D-3's ladder.
export const HEALTH_SCHEMA_VERSION = 1;

// Why a footer is BLIND. Distinct values so a caller — and a test — can tell WHICH rung
// of the ladder fired, rather than only that something did. INV-5: a control that cannot
// say what it caught cannot be made to fail convincingly.
export const BLIND_REASON = Object.freeze({
  SAMPLE_UNREADABLE: 'sample-missing-or-unreadable',
  SCHEMA_UNRECOGNISED: 'sample-schema-unrecognised',
  PERCENTAGE_ABSENT: 'context-percentage-absent-or-non-finite',
  PERCENTAGE_OUT_OF_RANGE: 'context-percentage-out-of-grammar-range',
  SAMPLED_AT_UNPARSEABLE: 'sampled-at-absent-or-unparseable',
  SESSION_MISMATCH: 'sample-belongs-to-another-session',
  STALE: 'sample-stale',
  EVALUATOR_THREW: 'evaluator-threw',
});

// Why `next:` is UNSET. Same reasoning as BLIND_REASON.
export const UNSET_REASON = Object.freeze({
  LOCATION_UNKNOWN: 'live-worktree-path-or-branch-unknown',
  NO_MATCHING_PROGRAMME: 'no-programme-state-matches-this-session',
  AMBIGUOUS_PROGRAMME: 'more-than-one-programme-state-matches-this-session',
  NEXT_ACTION_KIND: 'resumption.next_action_kind is not "action"',
  MODEL_UNKNOWN: 'model_recommendation.model is unknown/any',
  MODEL_NOT_IN_GRAMMAR: 'model_recommendation.model has no footer representation',
  FOR_TICKET_MISMATCH: 'model_recommendation.for_ticket does not match resumption.ticket',
  HEAD_MISMATCH: 'model_recommendation.computed_at_head does not match banked.head_sha',
  TICKET_UNRESOLVED_MISSING: 'resumption.ticket names no unresolved ticket in tickets[]',
});

// ---------------------------------------------------------------------------
// Pure: advice
// ---------------------------------------------------------------------------
// Mirrors `statusline-live.mjs`'s existing mapping exactly, so the two surfaces cannot
// disagree about what a state means. BLIND is deliberately "KEEP GOING?" and not
// "CLEAR NOW": unknown telemetry must never FORCE a rotation (that would let a broken
// sensor cost Warwick his session), but it must never read as healthy either — the
// question mark is the whole distinction (AD-3 / INV-1).

export function adviceForState(state) {
  switch (state) {
    case STATE.RED:
    case STATE.RECOVERY:
      return ADVICE.CLEAR_NOW;
    case STATE.GREEN:
    case STATE.AMBER:
      return ADVICE.KEEP_GOING;
    case STATE.BLIND:
      return ADVICE.UNSURE;
    default:
      return ADVICE.UNSURE;
  }
}

// ---------------------------------------------------------------------------
// Pure: the control token
// ---------------------------------------------------------------------------

export function isHandbackCode(code) {
  return typeof code === 'string' && HANDBACK_CODES.includes(code);
}

export function handback(code) {
  if (!isHandbackCode(code)) {
    throw new TypeError(`unknown handback code: ${JSON.stringify(code)}`);
  }
  return `${HANDBACK_PREFIX}${code}`;
}

/**
 * parseControl(control) -> { kind: 'continue' | 'handback' | 'unrecognised', code: string|null }
 *
 * `unrecognised` is a first-class outcome, not an error. B6 treats a missing or
 * unrecognised control token as CONTINUE precisely so that a vocabulary gap can never
 * become a trap — a token this module has never heard of must not be able to grant an
 * unconditional allow (that is what `handback` does), nor to crash the controller.
 */
export function parseControl(control) {
  if (control === CONTROL_CONTINUE) return { kind: 'continue', code: null };
  if (typeof control === 'string' && control.startsWith(HANDBACK_PREFIX)) {
    const code = control.slice(HANDBACK_PREFIX.length);
    if (isHandbackCode(code)) return { kind: 'handback', code };
    return { kind: 'unrecognised', code };
  }
  return { kind: 'unrecognised', code: null };
}

// ---------------------------------------------------------------------------
// Pure: render
// ---------------------------------------------------------------------------

function requireMember(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${label} must be one of ${allowed.join(' | ')} — got ${JSON.stringify(value)}`);
  }
}

/**
 * renderFooter(fields) -> string  (no trailing newline; the caller owns line framing)
 *
 * fields = {
 *   percent:     integer 0..100, or null for "--"
 *   approximate: boolean — the D-3 `~`, meaning "this sample's session could not be
 *                confirmed as mine"
 *   state:       GREEN | AMBER | RED | RECOVERY | BLIND
 *   advice:      KEEP GOING | CLEAR NOW | KEEP GOING?
 *   next:        Opus | Sonnet | Haiku | UNSET
 *   control:     CONTINUE | HANDBACK:<code>
 * }
 *
 * Every field is always emitted. D-2 is explicit that absence is expressed by a VALUE
 * (`--`, `UNSET`) and never by a missing segment, so that a parser never has to guess
 * which field it is looking at — a five-field line with one dropped segment is
 * ambiguous, and an ambiguous control input is worse than no control input.
 *
 * Throws TypeError on any out-of-grammar field. See the header for why this half is
 * strict while `deriveFooterFields` degrades.
 */
export function renderFooter(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new TypeError('renderFooter requires a fields object');
  }
  const { percent, approximate = false, state, advice, next, control } = fields;

  if (percent !== null && percent !== undefined) {
    if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new TypeError(`percent must be an integer 0..100 or null — got ${JSON.stringify(percent)}`);
    }
  }
  if (typeof approximate !== 'boolean') {
    throw new TypeError(`approximate must be a boolean — got ${JSON.stringify(approximate)}`);
  }
  requireMember(state, FOOTER_STATES, 'state');
  requireMember(advice, ADVICE_VALUES, 'advice');
  requireMember(next, [...NEXT_MODELS, NEXT_UNSET], 'next');

  const parsedControl = parseControl(control);
  if (parsedControl.kind === 'unrecognised') {
    throw new TypeError(
      `control must be ${CONTROL_CONTINUE} or ${HANDBACK_PREFIX}<code> with code in ` +
      `${HANDBACK_CODES.join(' | ')} — got ${JSON.stringify(control)}`
    );
  }

  const tilde = approximate ? '~' : '';
  const value = percent === null || percent === undefined ? '--' : `${percent}%`;

  // Five fields, four separators. The marker is followed by a PLAIN SPACE (D-2's
  // `FOOTER := "⟦GOV⟧" SP CTX ...`), not by SEP — that first space is the one place the
  // line does not use the middle dot, and getting it wrong is invisible to a human and
  // fatal to the parser.
  const fieldValues = [`ctx ${tilde}${value}`, state, advice, `next: ${next}`, control];
  return `${GOV_MARKER} ${fieldValues.join(SEP)}`;
}

// ---------------------------------------------------------------------------
// Pure: parse
// ---------------------------------------------------------------------------
// Anchored and total. Every deviation D-M11 names — `.` or `-` for `·`, a doubled space
// — falls out of the anchoring rather than needing its own branch, which is what makes
// the rejection exhaustive instead of a list someone has to keep complete.
//
// INT is `0 | [1-9][0-9]? | 100`: 0..100 with no leading zeros, exactly D-2's production.
// Written out rather than validated numerically after the fact, so "007%" is a PARSE
// failure and not a value that quietly normalises to 7.

// ---------------------------------------------------------------------------
// WHY THE PARSER IS LOOSER THAN THE RENDERER ON THE CODE — forced by A-M8 vs A-M10
// ---------------------------------------------------------------------------
// D-2's `CODE` production is the closed seven, and `renderFooter` honours that exactly:
// it will not emit an unrecognised code. The PARSER cannot be that strict, and the proof
// is in Silas's own mutation table, where two rows demand OPPOSITE outcomes:
//
//   A-M8   footer absent from `last_assistant_message`      -> ALLOW
//   A-M10  footer present, token `HANDBACK:banana`          -> BLOCK
//
// A parser that rejects the whole line on an unknown code makes those two states
// INDISTINGUISHABLE — both would come back "no valid footer", and the controller would
// have to allow in both, silently failing A-M10. So the structural grammar (marker,
// five fields, four `·` separators, spacing, the INT production) stays byte-strict —
// D-M11 still rejects `.`, `-` and doubled spaces — while the CODE is parsed as a token
// and its MEMBERSHIP is reported separately, in `controlRecognised`.
//
// That separation is also what makes B6 implementable as written: "the control token is
// CONTINUE, **or** the control token is missing/unrecognised" is only expressible if an
// unrecognised token can survive parsing. And it is the behaviour that matters most in
// practice — a typo'd handback code must not silently grant Larry an escape hatch
// (A-3's "recognised code always allows" applies to RECOGNISED codes only), while also
// never trapping anyone, because B6 treats it as CONTINUE inside an already-governed
// reply. A vocabulary gap must not become a trap in either direction.
//
// `controlRecognised` is returned BESIDE `fields`, never inside it, so that D-M10's
// `parseFooter(renderFooter(x)).fields` round-trip identity stays exact.

const HANDBACK_TOKEN = '[A-Za-z0-9][A-Za-z0-9._-]*';
const FOOTER_RE = new RegExp(
  `^${GOV_OPEN}GOV${GOV_CLOSE} ctx (~)?(?:(0|[1-9][0-9]?|100)%|--)` +
  `${SEP}(${FOOTER_STATES.join('|')})` +
  // Longest-first: "KEEP GOING?" must be offered before "KEEP GOING", otherwise the
  // shorter alternative matches and leaves a stray "?" to fail the following separator.
  // Backtracking would recover, but relying on it is a trap for the next editor.
  `${SEP}(KEEP GOING\\?|KEEP GOING|CLEAR NOW)` +
  `${SEP}next: (${[...NEXT_MODELS, NEXT_UNSET].join('|')})` +
  `${SEP}(${CONTROL_CONTINUE}|${HANDBACK_PREFIX}(?:${HANDBACK_TOKEN}))$`
);

/**
 * parseFooter(line)
 *   -> { ok: true, fields, controlRecognised, handbackCode } | { ok: false, reason }
 *
 * Accepts at most ONE trailing newline (`\n` or `\r\n`) — invisible, universal, and
 * emitted by every writer. It does NOT accept trailing spaces or tabs: D-2 forbids
 * trailing whitespace, and unlike a newline that is a difference a human can see.
 *
 * `fields` carries exactly the six round-trippable keys and nothing else, so
 * `parseFooter(renderFooter(x)).fields` deep-equals `x` (D-M10). Recognition of the
 * handback code is reported alongside — see the note above the regex.
 */
export function parseFooter(line) {
  if (typeof line !== 'string') return { ok: false, reason: 'not-a-string' };

  const candidate = line.replace(/\r?\n$/, '');
  const m = FOOTER_RE.exec(candidate);
  if (!m) return { ok: false, reason: 'does-not-match-grammar' };

  const [, tilde, intPart, state, advice, next, control] = m;
  const parsedControl = parseControl(control);
  return {
    ok: true,
    fields: {
      percent: intPart === undefined ? null : Number(intPart),
      approximate: tilde === '~',
      state,
      advice,
      next,
      control,
    },
    controlRecognised: parsedControl.kind !== 'unrecognised',
    handbackCode: parsedControl.kind === 'handback' ? parsedControl.code : null,
  };
}

/**
 * extractFooterLine(message) -> string|null — the FINAL line of an assistant message.
 *
 * Trailing EMPTY lines are dropped before taking the last one; trailing whitespace-only
 * lines are not. The asymmetry is deliberate and sits on the safe side of INV-2 in the
 * direction that matters: dropping invisible trailing newlines is what makes B5 work at
 * all (every writer emits at least one), while refusing to look past a line of actual
 * spaces means a malformed reply simply has no footer — and no footer means ALLOW, which
 * is the outcome that can never trap anyone.
 */
export function extractFooterLine(message) {
  if (typeof message !== 'string' || message.length === 0) return null;
  const lines = message.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return null;
  return lines[lines.length - 1];
}

/**
 * parseFooterFromMessage(message) — the composition B5 actually needs: take the final
 * line of `last_assistant_message` and parse it.
 */
export function parseFooterFromMessage(message) {
  const line = extractFooterLine(message);
  if (line === null) return { ok: false, reason: 'no-final-line' };
  return parseFooter(line);
}

// ---------------------------------------------------------------------------
// Pure: the D-3 degradation ladder
// ---------------------------------------------------------------------------

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * deriveFooterFields({ sample, knownSessionId, now, next, control, evaluateFn })
 *   -> { fields, blind, blindReason }
 *
 * Never throws. Every failure lands on BLIND, and BLIND never renders as GREEN (INV-1).
 *
 * ORDER OF THE LADDER, and the one place it departs from D-3's list order:
 *
 *   1. sample missing / unreadable / not JSON      -> BLIND
 *   2. schema_version unrecognised                 -> BLIND
 *   3. used_percentage absent or non-finite        -> BLIND
 *   4. sampled_at absent or unparseable            -> BLIND
 *   5. sample.session_id != known session id       -> BLIND   <-- BEFORE staleness
 *   6. now - sampled_at > 20 min                   -> BLIND, numbers suppressed
 *
 * D-3 lists staleness before the session check but then rules that the session check
 * "outranks staleness". Both orders produce BLIND, so the ranking is only observable in
 * the REASON — and the ruling is explicit, so the mismatch check runs first and a sample
 * that is both stale AND foreign reports the mismatch. Never render another session's
 * numbers is the stronger statement, and it is the one that gets to be true.
 *
 * A sample from the FUTURE (negative age, i.e. clock skew between writer and reader) is
 * not stale — `now - sampled_at` is negative and does not exceed the threshold. That is
 * the permissive side, and per the standing tie-break on this build, permissive wins.
 */
export function deriveFooterFields({
  sample = null,
  knownSessionId = null,
  now = Date.now(),
  next = NEXT_UNSET,
  control = CONTROL_CONTINUE,
  evaluateFn = evaluate,
} = {}) {
  // `approximate` is deliberately forced false on every BLIND path. The grammar permits
  // `ctx ~--`, and the parser round-trips it, but "approximately unknown" is not a fact
  // about anything — so the ladder never emits it even though the renderer would accept
  // it. Grammar fidelity in the codec, meaning in the producer.
  const blind = (blindReason) => ({
    fields: {
      percent: null,
      approximate: false,
      state: STATE.BLIND,
      advice: adviceForState(STATE.BLIND),
      next,
      control,
    },
    blind: true,
    blindReason,
  });

  if (!sample || sample.ok !== true || !sample.data || typeof sample.data !== 'object') {
    return blind(BLIND_REASON.SAMPLE_UNREADABLE);
  }
  const data = sample.data;

  if (data.schema_version !== HEALTH_SCHEMA_VERSION) {
    return blind(BLIND_REASON.SCHEMA_UNRECOGNISED);
  }

  const used = data.context_window?.used_percentage;
  if (!isFiniteNumber(used)) {
    // Catches absent, null, NaN, Infinity — and the string "42", which is D-M1's fourth
    // mutation and the one a looser `!= null` check would have let through as GREEN.
    return blind(BLIND_REASON.PERCENTAGE_ABSENT);
  }

  const sampledAt = typeof data.sampled_at === 'string' ? Date.parse(data.sampled_at) : NaN;
  if (!Number.isFinite(sampledAt)) {
    return blind(BLIND_REASON.SAMPLED_AT_UNPARSEABLE);
  }

  // Exact, not heuristic (D-3), and ahead of staleness by explicit ruling.
  if (typeof knownSessionId === 'string' && knownSessionId.length > 0 && data.session_id !== knownSessionId) {
    return blind(BLIND_REASON.SESSION_MISMATCH);
  }

  if (now - sampledAt > STALE_AFTER_MS) {
    return blind(BLIND_REASON.STALE);
  }

  const percent = Math.round(used);
  if (percent < 0 || percent > 100) {
    // Out of the grammar's range. Clamping would render a number the sample did not
    // support; BLIND says "I cannot represent this", which is the honest answer and the
    // one INV-1 asks for.
    return blind(BLIND_REASON.PERCENTAGE_OUT_OF_RANGE);
  }

  let verdict;
  try {
    verdict = evaluateFn({
      contextUsedPercentage: used,
      rateLimitFiveHourUsedPercentage: isFiniteNumber(data.rate_limits?.five_hour?.used_percentage)
        ? data.rate_limits.five_hour.used_percentage
        : undefined,
      // compactions / bankedStateStale / safeBoundary are genuinely unknown from a health
      // sample alone. Absent is `unknown`, never 0 — the evaluator's own missing-field rule.
    });
  } catch {
    return blind(BLIND_REASON.EVALUATOR_THREW);
  }

  const state = FOOTER_STATES.includes(verdict?.state) ? verdict.state : null;
  if (state === null) return blind(BLIND_REASON.EVALUATOR_THREW);

  return {
    fields: {
      percent,
      approximate: sample.approximate === true,
      state,
      advice: adviceForState(state),
      next,
      control,
    },
    blind: state === STATE.BLIND,
    blindReason: null,
  };
}

// ---------------------------------------------------------------------------
// Pure-ish: the D-4 UNSET predicate
// ---------------------------------------------------------------------------
// Driven by ABSENCE, not by text matching. This is the load-bearing property of the
// whole predicate and it is why there is no keyword scan anywhere in this function: a
// heuristic over `next_action` prose ("does this sentence sound like a hold?") is
// exactly the caller-supplied self-attestation `escalation-gate.mjs` was re-grounded to
// avoid. Absence of provenance is a FACT. "This looks like an action" is a judgement by
// the actor who wants the answer to be yes.
//
// Every filesystem call is injectable so the mutation tests can drive zero-match,
// one-match and ambiguous-match estates without an estate, and without ever touching
// Warwick's real tree.

function listProgrammeStatePaths(deliverablesDir, { listDir, existsFn }) {
  if (!deliverablesDir || !existsFn(deliverablesDir)) return [];
  let entries;
  try {
    entries = listDir(deliverablesDir);
  } catch {
    return [];
  }
  const paths = [];
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    if (typeof name !== 'string') continue;
    const p = join(deliverablesDir, name, 'programme-state.json');
    try {
      if (existsFn(p)) paths.push(p);
    } catch {
      // An unreadable directory entry is one fewer candidate, never a throw. Fewer
      // candidates can only ever move the answer toward UNSET, which is the safe side.
    }
  }
  return paths;
}

/**
 * nextModelFor({ worktreePath, worktreeBranch, deliverablesDir, ... })
 *   -> { next, unset, unsetReason, statePath }
 *
 * U-a also closes the defect Nolan recorded as D-N3: `statusline-live.mjs`'s
 * `recommendedModel()` returns the FIRST `Deliverables/*` state file it finds rather
 * than the ACTIVE build's, so on a machine carrying more than one build it renders
 * another programme's recommendation with complete confidence. Matching on
 * (branch, worktree) against the live sample fixes it with no git call and no registry
 * lookup, because the live status-line payload already carries `worktree.path` and
 * `worktree.branch` — verified against a real sample, where `payload.cwd` and
 * `payload.workspace.current_dir` are BOTH absent.
 */
export function nextModelFor({
  worktreePath = null,
  worktreeBranch = null,
  deliverablesDir = null,
  readState = readProgrammeState,
  listDir = readdirSync,
  existsFn = existsSync,
} = {}) {
  const unset = (unsetReason, statePath = null) => ({
    next: NEXT_UNSET,
    unset: true,
    unsetReason,
    statePath,
  });

  if (typeof worktreePath !== 'string' || worktreePath.length === 0) return unset(UNSET_REASON.LOCATION_UNKNOWN);
  if (typeof worktreeBranch !== 'string' || worktreeBranch.length === 0) return unset(UNSET_REASON.LOCATION_UNKNOWN);

  // U-a: exactly one state file that VALIDATES and matches this session.
  const matches = [];
  for (const path of listProgrammeStatePaths(deliverablesDir, { listDir, existsFn })) {
    let result;
    try {
      result = readState(path);
    } catch {
      continue; // an unreadable state file is not a match; it is not an error either
    }
    if (!result || result.ok !== true || !result.data) continue; // does not validate
    const r = result.data.resumption;
    if (!r || typeof r !== 'object') continue;
    if (r.branch !== worktreeBranch) continue;
    if (!samePath(r.worktree, worktreePath)) continue;
    matches.push({ path, state: result.data });
  }

  if (matches.length === 0) return unset(UNSET_REASON.NO_MATCHING_PROGRAMME);
  if (matches.length > 1) return unset(UNSET_REASON.AMBIGUOUS_PROGRAMME);

  const { path, state } = matches[0];
  const resumption = state.resumption ?? {};
  const rec = state.model_recommendation ?? {};
  const banked = state.banked ?? {};

  // U-b — absent, "hold" and "unknown" all fall through to UNSET.
  if (resumption.next_action_kind !== 'action') return unset(UNSET_REASON.NEXT_ACTION_KIND, path);

  // U-c
  const model = rec.model;
  if (typeof model !== 'string' || model === 'unknown' || model === 'any') {
    return unset(UNSET_REASON.MODEL_UNKNOWN, path);
  }
  // The grammar constraint D-4 does not state — see NEXT_MODELS above.
  if (!NEXT_MODELS.includes(model)) return unset(UNSET_REASON.MODEL_NOT_IN_GRAMMAR, path);

  // U-d — both non-null AND equal.
  if (
    typeof rec.for_ticket !== 'string' || rec.for_ticket.length === 0 ||
    typeof resumption.ticket !== 'string' || resumption.ticket.length === 0 ||
    rec.for_ticket !== resumption.ticket
  ) {
    return unset(UNSET_REASON.FOR_TICKET_MISMATCH, path);
  }

  // U-e — compared to `banked.head_sha`, NEVER to live git HEAD. Comparing to live HEAD
  // would make every ordinary commit destroy the recommendation; this asserts internal
  // coherence AT BANKING TIME. Staleness against live git has its own channel
  // (bankedStateStale -> RECOVERY).
  // Comparing to live git HEAD would also drag child_process onto the Stop path (A-7).
  if (
    typeof rec.computed_at_head !== 'string' || rec.computed_at_head.length === 0 ||
    typeof banked.head_sha !== 'string' || banked.head_sha.length === 0 ||
    rec.computed_at_head !== banked.head_sha
  ) {
    return unset(UNSET_REASON.HEAD_MISMATCH, path);
  }

  // U-f — referential integrity: the ticket must exist and must not be resolved.
  const tickets = Array.isArray(state.tickets) ? state.tickets : [];
  const ticket = tickets.find((t) => t && t.id === resumption.ticket);
  if (!ticket || ticket.state === 'resolved') return unset(UNSET_REASON.TICKET_UNRESOLVED_MISSING, path);

  return { next: model, unset: false, unsetReason: null, statePath: path };
}

// ---------------------------------------------------------------------------
// Impure: resolve which health sample to read (D-3's resolution order)
// ---------------------------------------------------------------------------

/**
 * resolveHealthSample({ sessionId, cwd, ... }) -> { ok, data?, approximate, reason?, path? }
 *
 * 1. session id KNOWN  -> read exactly `<sessionId>.json`, `approximate: false`
 * 2. session id UNKNOWN -> read the NEWEST file in `<projectKey>/`, `approximate: true`
 *
 * The `approximate` flag is what becomes the `~` in `ctx ~NN%`, and it means precisely
 * "this sample's session could not be confirmed as mine". It is not a confidence score
 * and not a rounding marker.
 *
 * Never throws — every failure returns `{ ok: false }`, which the ladder turns into BLIND.
 */
export function resolveHealthSample({
  sessionId = null,
  cwd = process.cwd(),
  homeDir,
  envOverride,
  readSample = readHealthSample,
  dirFor = healthStoreDir,
  listDir = readdirSync,
  existsFn = existsSync,
  statFn = statSync,
} = {}) {
  const storeOpts = {};
  if (cwd !== undefined) storeOpts.cwd = cwd;
  if (homeDir !== undefined) storeOpts.homeDir = homeDir;
  if (envOverride !== undefined) storeOpts.envOverride = envOverride;

  if (typeof sessionId === 'string' && sessionId.length > 0) {
    try {
      const result = readSample(sessionId, storeOpts);
      return { ...result, approximate: false };
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err?.message, approximate: false };
    }
  }

  try {
    const dir = dirFor(storeOpts);
    if (!existsFn(dir)) return { ok: false, reason: 'missing', approximate: true, path: dir };
    const candidates = listDir(dir)
      .filter((n) => typeof n === 'string' && n.endsWith('.json'))
      .map((n) => {
        try {
          return { name: n, mtime: statFn(join(dir, n)).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);

    if (candidates.length === 0) return { ok: false, reason: 'missing', approximate: true, path: dir };
    const newestSessionId = candidates[0].name.replace(/\.json$/, '');
    const result = readSample(newestSessionId, storeOpts);
    return { ...result, approximate: true };
  } catch (err) {
    return { ok: false, reason: 'unreadable', error: err?.message, approximate: true };
  }
}

// ---------------------------------------------------------------------------
// Impure: the one composition function
// ---------------------------------------------------------------------------

/**
 * computeFooterLine(opts) -> string
 *
 * The full path: resolve a sample -> run the ladder -> run the UNSET predicate -> render.
 * Mirrors `status-line.mjs`'s single-impure-composition shape (AD-11): everything above
 * this function is independently unit-testable without an estate, and this is the only
 * place that touches disk.
 *
 * Never throws. A footer that cannot be computed is still a footer — BLIND, UNSET,
 * CONTINUE — because the alternative is no visible line at all, and an absent governor
 * is indistinguishable from a healthy one (the failure mode this build exists to kill).
 */
export function computeFooterLine({
  sessionId = null,
  worktreePath = null,
  worktreeBranch = null,
  deliverablesDir = null,
  cwd = process.cwd(),
  homeDir,
  envOverride,
  now = Date.now(),
  control = CONTROL_CONTINUE,
  // Injections, forwarded EXPLICITLY below and never by spreading this bag —
  // delegation-gate.mjs's rule, and for its reason: one opts object serving three
  // different callees lets a key meant for the state reader be silently reinterpreted
  // as a filesystem injection by the sample resolver.
  readState,
  readSample,
  dirFor,
  listDir,
  existsFn,
  statFn,
  evaluateFn,
} = {}) {
  let next = NEXT_UNSET;
  try {
    next = nextModelFor({ worktreePath, worktreeBranch, deliverablesDir, readState, listDir, existsFn }).next;
  } catch {
    next = NEXT_UNSET;
  }

  let sample;
  try {
    sample = resolveHealthSample({ sessionId, cwd, homeDir, envOverride, readSample, dirFor, listDir, existsFn, statFn });
  } catch {
    sample = { ok: false, approximate: false };
  }

  const { fields } = deriveFooterFields({
    sample,
    knownSessionId: sessionId,
    now,
    next,
    control,
    evaluateFn,
  });

  try {
    return renderFooter(fields);
  } catch {
    // The strict renderer refused a field set the ladder produced — that is a bug in
    // this module, not a runtime condition. Still emit a grammatical line rather than
    // throwing into a status line or a Stop hook.
    return renderFooter({
      percent: null,
      approximate: false,
      state: STATE.BLIND,
      advice: ADVICE.UNSURE,
      next: NEXT_UNSET,
      control: CONTROL_CONTINUE,
    });
  }
}
