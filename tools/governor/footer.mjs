// The Governor footer — ONE renderer, ONE parser, ONE vocabulary (BUILD-018 WP-3, D-D).
//
// This module owns the `⟦GOV⟧` line end-to-end: the byte grammar (D-2) and the
// degradation ladder that decides what it says (D-3). The `UNSET` predicate that used to
// decide whether a model name may appear (D-4) was deleted by WO-OR-05 along with the
// programme state it read; `next:` is a caller-supplied input now, and carries an EFFORT
// as well as a model. `statusline-live.mjs` imports from here (`stop-controller.mjs` did
// too, until the same Work Order deleted it). Nothing re-implements the grammar — that is
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
// module is different, because its output is CONSUMED: the footer is parsed and its
// control token acted on. So the two halves take opposite postures:
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
// A-7 forbids any `git` invocation in the Stop path. That now holds STRUCTURALLY rather
// than by argument: WO-OR-05 removed the `worktree-guard.mjs` import (whose `liveLocation`
// was the one reachable `git` call) and the `programme-state.mjs` import, so the only
// modules left below are the evaluator and the health store, neither of which executes
// anything at import time or shells out at all.
//
// `sampler.mjs` JOINED THAT LIST (WO-GF-01) and is held to the same bar: it shells out to
// nothing, executes nothing at import (its CLI block is behind the same entrypoint guard
// every module here uses), imports no new dependency, and does not import this module
// back. What it brings is the three functions that already know how to read a token count
// out of a transcript — reused rather than re-implemented, because a second copy of that
// logic here is exactly the drift this module exists to refuse.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluate, STATE } from './evaluator.mjs';
import { readHealthSample, healthStoreDir } from './health-store.mjs';
import { readFileSync } from 'node:fs';
import {
  readTranscriptTail,
  newestAssistantUsage,
  sumUsedTokens,
  SOURCE_TRANSCRIPT,
  SOURCE_STATUSLINE,
} from './sampler.mjs';

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
// decision document is the stale copy. `unsafe-state` appears nowhere in `tools/`. Had
// this shipped as written, the footer would have emitted a code matching neither the
// constitution nor the parser, and the two would have disagreed about the single token
// that decides whether Larry may end a turn. Do not "correct" this back.
//
// PROVENANCE CORRECTED 2026-08-01. This note used to cite `escalation-gate.mjs`'s frozen
// `ESCAPE_HATCH_REASONS` as "the authority" for the token. That module was RETIRED by
// Warwick's cut-and-close ruling and no longer exists, so the citation pointed at
// nothing — while the same comment instructed the next reader not to change it, which
// would have preserved the dangling reference indefinitely. THIS list is now the
// machine-readable authority, and root CLAUDE.md § "When Warwick may be interrupted" is
// the human one. Found by Nolan's post-cut constitution audit.
//
// THE DRIFT GUARD THIS NOTE USED TO CLAIM NO LONGER EXISTS — stated rather than left to
// be discovered. It said `stop-controller.mjs` imports this literal instead of re-typing
// it, "so the two still cannot drift apart". WO-OR-05 deleted `stop-controller.mjs`, so
// this const now has NO importing consumer, and nothing mechanical ties it to the
// constitution. The seven members and their exact spelling remain load-bearing and are
// deliberately unchanged by that Work Order; what changed is that only a reader enforces
// them. Re-pointing this comment at another module would be worse than saying so.
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

// TASK_UNKNOWN added 2026-08-01 by Warwick's cut-and-close ruling: "unsupported
// KEEP/CLEAR/model claims appended before a next task is known" were named as
// anti-goal, and "context and model advice must happen AFTER you have understood
// Warwick's next requirement."
//
// KEEP GOING is a claim about FITNESS FOR A PURPOSE. With no established next
// action there is no purpose to be fit for, so the claim has no truth-maker — it
// is exactly the "banked literal presented as live advice" defect D-4 already
// refuses for the model field, applied to the advice field. TASK UNKNOWN says the
// honest thing instead: telemetry is being read, but no advice is owed yet.
//
// CLEAR NOW is NOT suppressed this way — see `adviceFor` for why. Running out of
// context is a fact about the SESSION, not about the task, and INV-2 forbids a
// change that could let Warwick sail into a wall while the footer stays quiet.
// NO_ADVICE added 2026-08-02 by Warwick's ruling: "the footer must not pair BLIND with
// KEEP GOING or CLEAR NOW. BLIND must render advice unavailable while still showing the
// truthful absolute count."
//
// The defect it closes is the same class as `ctx --` over a real measurement, one field
// to the right. `BLIND` says "I could not grade this"; every other member of this
// vocabulary is a recommendation DERIVED from a grade. Pairing them withheld the
// judgement and then offered advice premised on the judgement just withheld —
// `KEEP GOING?` reads to a human as "probably fine, carry on", which is precisely the
// claim BLIND exists to refuse. `CLEAR NOW` beside BLIND would be worse: a rotation
// instruction with nothing behind it.
//
// WHY `NO ADVICE` AND NOT `UNGRADED` OR `ADVICE UNAVAILABLE`. Two words, the register of
// `TASK UNKNOWN` (a state of knowledge, not an instruction), and readable at a glance on
// a phone, which is where Warwick actually reads this line. `UNGRADED` restates what the
// STATE field one segment to the left already says; `ADVICE UNAVAILABLE` says the same
// thing in twice the width of a field whose position already tells you it is the advice.
//
// `UNSURE` ("KEEP GOING?") IS RETAINED IN THE VOCABULARY AND NO LONGER PRODUCED. Deleting
// it would be a REMOVAL from a grammar that is already in circulation: `parseFooter` must
// still read back the lines this estate has already emitted — in transcripts, in Telegram
// notifications sent by tower-baton, in the session record — and a parser that rejects
// its own history is a worse defect than the one being fixed. Nothing emits it now; the
// members below are what the renderer may be handed, not what the producer chooses.
export const ADVICE = Object.freeze({
  KEEP_GOING: 'KEEP GOING',
  CLEAR_NOW: 'CLEAR NOW',
  UNSURE: 'KEEP GOING?',
  TASK_UNKNOWN: 'TASK UNKNOWN',
  NO_ADVICE: 'NO ADVICE',
});
export const ADVICE_VALUES = Object.freeze([
  ADVICE.KEEP_GOING,
  ADVICE.CLEAR_NOW,
  ADVICE.UNSURE,
  ADVICE.TASK_UNKNOWN,
  ADVICE.NO_ADVICE,
]);

// D-2's NEXT production. This is narrower than D-4's U-c (which only excludes `unknown`
// and `any`), and the grammar wins where they meet: a recommendation of "GPT-5" has no
// representation in the footer, so it renders UNSET.
//
// ---------------------------------------------------------------------------
// NEXT NOW CARRIES MODEL **AND** EFFORT (operating-reset Phase 5, WO-OR-05)
// ---------------------------------------------------------------------------
// `next: Opus` answered half the question. The harness runs five effort levels and the
// transcript records the one in force, so a recommendation that names a model and stays
// silent on effort is under-specified advice about the phase ahead — Warwick still has
// to guess the half that changes cost and latency most.
//
// The production is `MODEL "/" EFFORT`, with `UNSET` still bare. Both vocabularies are
// frozen literals, and BOTH the renderer and `FOOTER_RE` derive from `NEXT_VALUES`
// below — hand-listing the alternation is exactly the drift that let `TASK UNKNOWN` be
// added to the renderer while the parser silently could not read it back.
export const NEXT_MODELS = Object.freeze(['Opus', 'Sonnet', 'Haiku']);
// Five, not three. The harness genuinely has all five and the transcript carries an
// `effort` field, so a three-value list would be wrong on contact with reality.
export const NEXT_EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
export const NEXT_UNSET = 'UNSET';

// The complete closed set of renderable `next:` values — the cross-product plus UNSET.
// DERIVED, never hand-listed, for the reason above.
export const NEXT_VALUES = Object.freeze([
  ...NEXT_MODELS.flatMap((m) => NEXT_EFFORTS.map((e) => `${m}/${e}`)),
  NEXT_UNSET,
]);

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
  // WIDENED (WO-OR-05): a sample was usable if it carried EITHER a percentage or a raw
  // token count.
  //
  // NARROWED AGAIN (WP-3B, Larry's Amendment 1 A-3) — and the direction matters, so read
  // why before "restoring" it. The widening let a sample carrying ONLY `used_percentage`
  // render `ctx 42%`, which is a reported percentage standing in for a measurement nobody
  // took. This rung now fires when the sample carries no COUNT FOR ITS OWN SOURCE, and a
  // percentage alone no longer rescues it. Nothing real is lost: both live producers write
  // a count (`statusLine` -> `total_input_tokens`, `transcript` -> `used_tokens`), so the
  // only samples this newly blinds are ones no producer emits. The percentage is still
  // rendered — beside the count it belongs to, never instead of it.
  PERCENTAGE_ABSENT: 'context-usage-absent-or-non-finite',
  PERCENTAGE_OUT_OF_RANGE: 'context-percentage-out-of-grammar-range',
  SAMPLED_AT_UNPARSEABLE: 'sampled-at-absent-or-unparseable',
  SESSION_MISMATCH: 'sample-belongs-to-another-session',
  STALE: 'sample-stale',
  EVALUATOR_THREW: 'evaluator-threw',
  // NEW (WO-OR-05). Tokens are known, the window size is not, so the number is real but
  // it CANNOT BE CLASSIFIED. See the note on `deriveFooterFields` for why this stays
  // BLIND rather than being graded into GREEN/AMBER/RED off a guessed denominator.
  WINDOW_SIZE_UNKNOWN: 'context-window-size-not-authoritatively-known',
});

// ---------------------------------------------------------------------------
// WHICH MEASUREMENT THE NUMBER IS — WP-3B(a), and the rule is Larry's not this module's
// ---------------------------------------------------------------------------
// Two producers write context counts and THEY ARE NOT THE SAME MEASUREMENT:
//
//   * `sampler.mjs`'s statusLine writer emits `context_window.total_input_tokens` — the
//     host's own report of the input tokens presented to the model — and NEVER writes
//     `used_tokens`.
//   * `sampler.mjs`'s transcript writer emits `context_window.used_tokens`, derived by
//     summing usage out of the transcript file, and explicitly writes
//     `total_input_tokens: null`.
//
// The defect this closes (WP-3B finding (a)): the consumer read only `used_tokens`, which
// a statusLine sample never carries, so the module fell back to the reported percentage
// and rendered `ctx 42%` while `418,491` sat unread on disk.
//
// THE FIX IS NOT A RENAME, and reading both fields with a `??` would be worse than the
// defect. Unioning two different measurements behind one number is exactly the
// "one number treated as cost without proving what it means" hazard: the reader could no
// longer tell which quantity they were being shown. So the source SELECTS the field, one
// branch reads exactly one field, and the selection is reported alongside the number.
//
// A sample with no recognised `source` is a real count that cannot be attributed. It is
// still shown — refusing to show a measured number is the WO-OR-05 defect all over again
// — but it is labelled `unattributed` rather than claimed as either producer's.
export const CONTEXT_MEASUREMENT = Object.freeze({
  STATUSLINE_TOTAL_INPUT: 'statusLine.total_input_tokens',
  TRANSCRIPT_USED: 'transcript.used_tokens',
  UNATTRIBUTED_USED: 'unattributed.used_tokens',
});

/**
 * selectContextCount(data) -> { raw, measurement }
 *
 * Pure, never throws. `raw` is whatever the field held (including `undefined`); the
 * caller applies `isFiniteNumber`, so this function decides PROVENANCE only and never
 * decides validity. `measurement` is a `CONTEXT_MEASUREMENT` member and is never null,
 * so every count this module renders can name the quantity it is.
 */
export function selectContextCount(data) {
  const cw = data?.context_window;
  if (data?.source === SOURCE_STATUSLINE) {
    return { raw: cw?.total_input_tokens, measurement: CONTEXT_MEASUREMENT.STATUSLINE_TOTAL_INPUT };
  }
  if (data?.source === SOURCE_TRANSCRIPT) {
    return { raw: cw?.used_tokens, measurement: CONTEXT_MEASUREMENT.TRANSCRIPT_USED };
  }
  return { raw: cw?.used_tokens, measurement: CONTEXT_MEASUREMENT.UNATTRIBUTED_USED };
}

// `UNSET_REASON` was DELETED here by WO-OR-05, together with `nextModelFor`, its sole
// producer. Every one of its nine members named a property of banked BUILD-* programme
// state (`resumption.next_action_kind`, `model_recommendation.for_ticket`,
// `banked.head_sha`, …), and programme state no longer exists in this estate. A reason
// enum whose only producer has been deleted is a corpse, not an interface: nothing can
// ever emit one of those strings again, so keeping them would leave a reviewer looking
// for a code path that is not there. `next:` is now an INPUT (see `deriveFooterFields`),
// and its absence has exactly one meaning — nobody supplied a grounded recommendation.

// ---------------------------------------------------------------------------
// Pure: advice
// ---------------------------------------------------------------------------
// One mapping for every surface, so two of them cannot disagree about what a state means.
//
// BLIND YIELDS `NO ADVICE` (Warwick, 2026-08-02). It used to yield `KEEP GOING?`, and the
// reasoning recorded here was half right: unknown telemetry must never FORCE a rotation —
// a broken sensor must not cost Warwick his session — and it must never read as healthy
// either. The old answer satisfied the first and FAILED the second. A question mark is
// not a refusal to advise; on a phone `KEEP GOING?` reads as a hedged yes, which is a
// grade-derived claim from a state that exists to say no grade was possible.
//
// `NO ADVICE` satisfies both halves properly: it forces nothing, and it asserts nothing.
// AD-3 / INV-1 are honoured more exactly than before, not relaxed — BLIND still never
// renders as anything a reader could mistake for healthy, and the loudness INV-1 asks for
// now lives in a field that says outright that the governor cannot answer.
//
// THE `default` BRANCH MOVES WITH IT, and for the same reason rather than for symmetry: a
// state outside this vocabulary is a state nothing has graded, so advice derived from it
// would be derived from nothing. (`deriveFooterFields` already converts an unrecognised
// verdict state to BLIND, so this branch is defence in depth, not a live path.)

export function adviceForState(state) {
  switch (state) {
    case STATE.RED:
    case STATE.RECOVERY:
      return ADVICE.CLEAR_NOW;
    case STATE.GREEN:
    case STATE.AMBER:
      return ADVICE.KEEP_GOING;
    case STATE.BLIND:
      return ADVICE.NO_ADVICE;
    default:
      return ADVICE.NO_ADVICE;
  }
}

/**
 * adviceFor(state, { taskKnown }) — the advice actually rendered.
 *
 * `adviceForState` above is retained UNCHANGED and still answers the narrower question
 * it always answered ("what does this health state mean on its own"). This function is
 * the one the footer uses, and it adds the second input Warwick's ruling requires: is
 * there an established next action for the advice to be ABOUT?
 *
 * ONLY THE CONFIDENT CLAIM IS SUPPRESSED. A later reader will want to "tidy" the
 * asymmetry away; it is the whole point, and the first draft of this function got it
 * wrong in a way footer.test.mjs caught:
 *
 *   KEEP GOING (from GREEN/AMBER) IS suppressed. It is a claim that the current context
 *   is FIT to continue, and fitness is relative to a purpose. With no known next action
 *   there is no purpose, so the claim has no truth-maker — asserting it anyway is the
 *   "state what was proven, not what it implies" failure in miniature.
 *
 *   CLEAR NOW is NEVER suppressed. RED and RECOVERY are facts about the SESSION —
 *   context nearly spent, or in-context memory already degraded. True whether or not a
 *   task is known, and the two states where staying quiet costs Warwick the session.
 *   INV-2 (never trap Warwick) outranks tidiness.
 *
 *   NO ADVICE (from BLIND) is NEVER suppressed either, and this is the correction — it
 *   was `KEEP GOING?` until Warwick's 2026-08-02 ruling and the argument is unchanged by
 *   the rename. The first draft folded it into TASK UNKNOWN, which is wrong: BLIND means
 *   the telemetry could not be read, and INV-1 says a governor that stops measuring must
 *   become LOUDER, not quieter. Replacing the sensor-failure signal with an unrelated one
 *   about task knowledge makes it quieter in exactly the field a human reads first. The
 *   two unknowns are different facts and both deserve to survive: the STATE field still
 *   carries BLIND, and the ADVICE field still says outright that no advice is available.
 *
 * So TASK UNKNOWN replaces exactly one thing — an unearned "yes, carry on".
 *
 * THE STRUCTURE ALSO CARRIES WARWICK'S RULING WITHOUT A SECOND GUARD. Only the KEEP GOING
 * branch is reachable past the early return, so BLIND can never leave this function as
 * KEEP GOING, as CLEAR NOW, or as TASK UNKNOWN — it returns `adviceForState`'s answer
 * directly, and that answer is NO ADVICE.
 */
export function adviceFor(state, { taskKnown = true } = {}) {
  const base = adviceForState(state);
  if (base !== ADVICE.KEEP_GOING) return base;
  return taskKnown ? base : ADVICE.TASK_UNKNOWN;
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
// Pure: the token production (WO-OR-05)
// ---------------------------------------------------------------------------
// WHY THE FOOTER GREW AN ABSOLUTE NUMBER AT ALL.
//
// The percentage has exactly one honest source: a used-token count DIVIDED BY the
// context window size. The transcript JSONL — the only telemetry that reaches Warwick's
// web and Android clients — carries the numerator and NOT the denominator. Verified by
// reading real transcripts: the newest assistant message's `usage` gives
// input/cache-creation/cache-read/output tokens, and no field anywhere states the window
// size.
//
// The tempting fix is a model -> window lookup table. It is forbidden here, by ruling:
// this very estate runs 1M-context and 200k-context sessions of the SAME model, so such
// a table renders a confidently wrong percentage — a false reading manufactured by a
// control that was never told the size of the thing it measures.
//
// So the footer reports what it knows. `ctx 72.6k` is a true absolute number; it is
// strictly more useful than `ctx --` and strictly more honest than a fabricated `38%`.
// When a denominator IS authoritatively known the line carries both: `ctx 38% (72.6k/190k)`.
//
// GRAIN. Tokens render to one decimal of a thousand, so the renderer requires a value
// that is already a multiple of `TOKENS_GRAIN`. That is not fussiness — it is what makes
// `parseFooter(renderFooter(x)).fields` deep-equal `x` (D-M10) for the token fields.
// Rounding inside the renderer would silently break that identity; rounding in the
// PRODUCER keeps the codec exact. Same split as everywhere else in this module: meaning
// in the producer, fidelity in the codec.
export const TOKENS_GRAIN = 100;

/**
 * True when `n` is a token count this grammar can render EXACTLY — and, the stronger
 * half and the one this predicate used to get wrong, READ BACK exactly.
 *
 * BOUNDED AT `Number.MAX_SAFE_INTEGER` (WO-OR-10). The grain alone is not sufficient
 * for the D-M10 identity, because `parseTokens` reconstructs `whole * 1000 + frac *
 * TOKENS_GRAIN` and that arithmetic stops being exact above 2^53. Two failure classes
 * were reachable from the old, unbounded predicate, and the quiet one is the reason
 * this bound exists:
 *
 *   LOSSY (silent). `100000000000001200` was accepted, rendered `100000000000001.2k`,
 *   and parsed back as `100000000000001180`. The line was grammatical, `ok` was true,
 *   and the number had changed. A footer that reports a plausible wrong figure is worse
 *   than one that reports nothing — it is INV-1's false GREEN wearing a token count.
 *
 *   UNGRAMMATICAL (loud). At and above 1e24, `String(whole)` switches to exponent
 *   notation (`1.00663296e+21k`) and `parseFooter` rejects the whole line.
 *
 * WHY `Number.MAX_SAFE_INTEGER` AND NOT A DOMAIN CAP. A "no real context window exceeds
 * N tokens" rule would be a MEANING judgement, and this module keeps meaning in the
 * producer and fidelity in the codec (see the TOKENS_GRAIN note above). The safe-integer
 * bound is a fidelity bound: it is precisely where the arithmetic below stops being
 * exact, so the rule has the same shape as the defect. It is also exact BY CONSTRUCTION
 * rather than by sampling — inside it, `whole * 1000 <= n < 2^53` so the reconstruction
 * is exact integer arithmetic, and `whole < 1e21` so `String` never goes exponential.
 *
 * `Number.isSafeInteger` rather than `Number.isInteger` plus a hand-written comparison:
 * it subsumes the integer check and names the property instead of a magic constant.
 *
 * `-0` is EXCLUDED (WO-OR-16): it formats to "0k" and reads back as `+0`, failing the
 * READ-BACK half above. See the negative-zero guard in `renderFooter`.
 */
export function isRenderableTokens(n) {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n % TOKENS_GRAIN === 0 && !Object.is(n, -0);
}

/** 72600 -> "72.6k"  ·  190000 -> "190k"  ·  900 -> "0.9k"  ·  0 -> "0k" */
export function formatTokens(n) {
  if (!isRenderableTokens(n)) {
    throw new TypeError(
      `tokens must be a non-negative SAFE-INTEGER multiple of ${TOKENS_GRAIN} ` +
      `(<= ${Number.MAX_SAFE_INTEGER}) — got ${JSON.stringify(n)}`
    );
  }
  // Integer arithmetic throughout: no float division, so no 72.60000000000001.
  const tenths = n / TOKENS_GRAIN;
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return frac === 0 ? `${whole}k` : `${whole}.${frac}k`;
}

/** "72.6k" -> 72600. Exact inverse of `formatTokens` over its whole range. */
export function parseTokens(text) {
  const m = /^([0-9]+)(?:\.([0-9]))?k$/.exec(text ?? '');
  if (!m) return null;
  return Number(m[1]) * 1000 + Number(m[2] ?? 0) * TOKENS_GRAIN;
}

/**
 * Round a raw count onto the grain so the renderer will accept it, or `null` when no
 * such value exists.
 *
 * THE CONTRACT IS NOW ENFORCED RATHER THAN ASSERTED (WO-OR-10). This function claimed
 * to produce something `renderFooter` accepts and did not: above roughly 1e23 the
 * nearest double is not a multiple of the grain, so `Math.round(n / GRAIN) * GRAIN`
 * handed the rounded value straight back and the strict renderer THREW on it. That is
 * the exact mirror of the F1 defect — there the renderer accepted what the parser could
 * not represent, here the producer emitted what the renderer would not accept.
 *
 * The result is therefore checked against `isRenderableTokens` rather than assumed to
 * satisfy it, which makes the two functions agree BY CONSTRUCTION instead of by
 * coincidence. Checking the RESULT and not the argument is load-bearing: a count just
 * inside the safe range can round UP across the bound (`Number.MAX_SAFE_INTEGER` does
 * exactly that), so a guard on the input would leak the one case it was written for.
 */
export function toRenderableTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  // `+ 0` normalises -0 (WO-OR-16): the codec refuses it, and returning null instead would
  // degrade a real zero-token reading into BLIND. Meaning in the producer.
  const rounded = Math.round(n / TOKENS_GRAIN) * TOKENS_GRAIN + 0;
  return isRenderableTokens(rounded) ? rounded : null;
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
 *   percent:     integer 0..100, or null
 *   usedTokens:  non-negative integer multiple of TOKENS_GRAIN, or null
 *   windowTokens: positive integer multiple of TOKENS_GRAIN, or null
 *   approximate: boolean — the D-3 `~`, meaning "this sample's session could not be
 *                confirmed as mine"
 *   state:       GREEN | AMBER | RED | RECOVERY | BLIND
 *   advice:      KEEP GOING | CLEAR NOW | KEEP GOING? | TASK UNKNOWN | NO ADVICE
 *   next:        <Model>/<effort> | UNSET
 *   control:     CONTINUE | HANDBACK:<code>
 * }
 *
 * The CTX field has four shapes and they are total over the field set:
 *
 *   percent + usedTokens + windowTokens   ->  `ctx 38% (72.6k/190k)`
 *   percent only                          ->  `ctx 38%`
 *   usedTokens only                       ->  `ctx 72.6k`
 *   neither                               ->  `ctx --`
 *
 * Those four shapes are the WHOLE of the representable space, and the field set has one
 * more combination than that. Both unrepresentable combinations THROW:
 *
 *   windowTokens without BOTH a percent and a usedTokens — a denominator with nothing
 *   to divide is a caller bug, and silently discarding it would hide the bug behind a
 *   plausible line.
 *
 *   percent + usedTokens with NO windowTokens (WO-OR-10, Codex F1) — the numerator has
 *   nowhere to go, because the parenthesised pair is emitted only alongside a
 *   denominator. This used to render `ctx 38%` and DROP the 72.6k silently, so
 *   `parseFooter(renderFooter(x)).fields.usedTokens` came back `null` and the D3
 *   round-trip identity was false for that shape.
 *
 * The repair is deliberately a NARROWING of the accepted domain rather than a widening
 * of the grammar. Encoding the numerator in that shape would need a fifth CTX
 * production, and a footer grammar that grows a shape to accommodate a caller nobody
 * has is a worse trade than a caller being told it asked for something unrepresentable.
 * Refuse-what-you-cannot-represent is already this module's character: strict renderer,
 * degrading producer. No caller is affected — no path through `deriveFooterFields`
 * emits this shape, verified by sweeping the producer across its telemetry range.
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
  const {
    percent,
    usedTokens = null,
    windowTokens = null,
    approximate = false,
    state,
    advice,
    next,
    control,
  } = fields;

  // The three presence facts the CTX shape rules are written in terms of. Named once
  // (WO-OR-10) rather than re-spelled as `x !== null && x !== undefined` at each of the
  // six places that needed them: the F1 gap was precisely a MISSING combination of these
  // three, and a rule set you cannot read at a glance is one whose gaps you cannot see.
  const hasPercent = percent !== null && percent !== undefined;
  const hasUsed = usedTokens !== null && usedTokens !== undefined;
  const hasWindow = windowTokens !== null && windowTokens !== undefined;

  if (hasPercent) {
    // WO-OR-16. `-0` walks every check below (it IS an integer; `-0 < 0` is FALSE), renders
    // as the byte "0" and reads back as `+0` — D3 false for a value this codec ACCEPTED, the
    // F1 class closed the same way. Refused, not normalised, and given its own message
    // because `JSON.stringify(-0)` is "0". Full argument: footer.test.mjs § WO-OR-16.
    if (Object.is(percent, -0)) {
      throw new TypeError('percent must not be negative zero — it renders 0% and reads back +0');
    }
    if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new TypeError(`percent must be an integer 0..100 or null — got ${JSON.stringify(percent)}`);
    }
  }
  if (hasUsed && !isRenderableTokens(usedTokens)) {
    throw new TypeError(
      `usedTokens must be a non-negative safe-integer multiple of ${TOKENS_GRAIN} ` +
      `(<= ${Number.MAX_SAFE_INTEGER}), never -0, or null — ` +
      `got ${Object.is(usedTokens, -0) ? '-0' : JSON.stringify(usedTokens)}`
    );
  }
  if (hasWindow) {
    if (!isRenderableTokens(windowTokens) || windowTokens === 0) {
      throw new TypeError(
        `windowTokens must be a positive safe-integer multiple of ${TOKENS_GRAIN} ` +
        `(<= ${Number.MAX_SAFE_INTEGER}) or null — got ${JSON.stringify(windowTokens)}`
      );
    }
    if (!hasPercent || !hasUsed) {
      throw new TypeError('windowTokens requires both percent and usedTokens — a denominator with nothing to divide is a caller bug');
    }
  }
  // WO-OR-10 / Codex F1. The converse of the check above, and the one that was missing:
  // a numerator beside a percent has no representation WITHOUT a denominator, so the
  // four CTX shapes rendered `ctx <percent>%` and dropped it. A silently discarded field
  // is worse than a refused one — it yields a footer that parses cleanly and disagrees
  // with the fields it was rendered from.
  if (hasPercent && hasUsed && !hasWindow) {
    throw new TypeError(
      'percent with usedTokens requires windowTokens — the numerator has no representation ' +
      'in the bare percent shape and would be silently dropped'
    );
  }
  if (typeof approximate !== 'boolean') {
    throw new TypeError(`approximate must be a boolean — got ${JSON.stringify(approximate)}`);
  }
  requireMember(state, FOOTER_STATES, 'state');
  requireMember(advice, ADVICE_VALUES, 'advice');
  requireMember(next, NEXT_VALUES, 'next');

  const parsedControl = parseControl(control);
  if (parsedControl.kind === 'unrecognised') {
    throw new TypeError(
      `control must be ${CONTROL_CONTINUE} or ${HANDBACK_PREFIX}<code> with code in ` +
      `${HANDBACK_CODES.join(' | ')} — got ${JSON.stringify(control)}`
    );
  }

  // The four shapes, and by this point they are exhaustive over what survived
  // validation: `hasPercent && hasUsed && !hasWindow` was refused above, so the
  // `hasPercent` branch can only be the pair form or the bare percent form.
  const tilde = approximate ? '~' : '';
  let value;
  if (hasPercent) {
    value = hasWindow
      ? `${percent}% (${formatTokens(usedTokens)}/${formatTokens(windowTokens)})`
      : `${percent}%`;
  } else if (hasUsed) {
    value = formatTokens(usedTokens);
  } else {
    value = '--';
  }

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

// The two CTX sub-productions, written once and shared by every alternative below so the
// four shapes cannot drift apart. INT is D-2's original `0 | [1-9][0-9]? | 100` — spelled
// out rather than range-checked afterwards, so "007%" is a PARSE failure and never a
// value that quietly normalises to 7. TOK is the WO-OR-05 token production, at most one
// decimal place, matching `formatTokens` exactly.
const INT_P = '(?:0|[1-9][0-9]?|100)';
const TOK_P = '(?:[0-9]+(?:\\.[0-9])?k)';

// Longest alternative FIRST. `38% (72.6k/190k)` and `38%` share a prefix, and offering
// the short one first would match `38%` and then fail on the following separator.
const CTX_P =
  `(?:(${INT_P})% \\((${TOK_P})/(${TOK_P})\\)` +
  `|(${INT_P})%` +
  `|(${TOK_P})` +
  `|--)`;

const FOOTER_RE = new RegExp(
  `^${GOV_OPEN}GOV${GOV_CLOSE} ctx (~)?${CTX_P}` +
  `${SEP}(${FOOTER_STATES.join('|')})` +
  // DERIVED from ADVICE_VALUES, not hand-listed. The alternation used to be a literal
  // copy of the vocabulary, which meant adding a member (TASK UNKNOWN did exactly this)
  // silently desynced the parser from the renderer while every existing test stayed
  // green — the renderer would emit a value the parser could not read back. One source,
  // sorted longest-first and regex-escaped, removes that trap rather than documenting it.
  //
  // Longest-first still matters for the same reason the old comment gave: "KEEP GOING?"
  // must be offered before "KEEP GOING", or the shorter alternative matches and leaves a
  // stray "?" to fail the following separator.
  `${SEP}(${ADVICE_VALUES.slice()
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})` +
  // DERIVED from NEXT_VALUES, sorted longest-first, for the same reason the advice
  // alternation is: the renderer and the parser must read one vocabulary or a member
  // added to one silently becomes unreadable by the other.
  `${SEP}next: (${NEXT_VALUES.slice()
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})` +
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
 * `fields` carries exactly the eight round-trippable keys and nothing else, so
 * `parseFooter(renderFooter(x)).fields` deep-equals `x` (D-M10). Recognition of the
 * handback code is reported alongside — see the note above the regex.
 */
export function parseFooter(line) {
  if (typeof line !== 'string') return { ok: false, reason: 'not-a-string' };

  const candidate = line.replace(/\r?\n$/, '');
  const m = FOOTER_RE.exec(candidate);
  if (!m) return { ok: false, reason: 'does-not-match-grammar' };

  const [, tilde, pBoth, usedBoth, windowBoth, pOnly, usedOnly, state, advice, next, control] = m;
  const parsedControl = parseControl(control);

  // Exactly one of the three CTX alternatives can have matched (or none, for `--`), so
  // these coalesces are unambiguous rather than a priority order.
  const intPart = pBoth ?? pOnly;
  const usedPart = usedBoth ?? usedOnly;

  return {
    ok: true,
    fields: {
      percent: intPart === undefined ? null : Number(intPart),
      usedTokens: usedPart === undefined ? null : parseTokens(usedPart),
      windowTokens: windowBoth === undefined ? null : parseTokens(windowBoth),
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
 *   3. NEITHER used_percentage NOR used_tokens     -> BLIND
 *   4. sampled_at absent or unparseable            -> BLIND
 *   5. sample.session_id != known session id       -> BLIND   <-- BEFORE staleness
 *   6. now - sampled_at > 20 min                   -> BLIND, numbers suppressed
 *   7. tokens known, window size NOT known         -> BLIND state, REAL number rendered
 *
 * RUNG 3 WIDENED, AND RUNG 7 ADDED (WO-OR-05). Rung 3 used to demand a percentage, which
 * is why the footer read BLIND for Warwick on every client: the percentage's only source
 * was the terminal statusLine, which does not run on claude.ai web or Android. A sample
 * carrying a raw token count is now enough to say something true.
 *
 * WHY RUNG 7 IS STILL `BLIND` — a deliberate, reported judgement, not an oversight.
 * `state` is a CLASSIFICATION (GREEN/AMBER/RED come from thresholds on a percentage) and
 * a token count with no denominator cannot be classified: 72.6k is comfortable in a 1M
 * window and nearly fatal in an 80k one. Grading it would require inventing the very
 * denominator this build refuses to invent, and would produce a GREEN that no telemetry
 * supports — INV-1's false GREEN, arrived at by the back door. So the CTX field carries
 * the real number and the STATE field honestly says "I cannot grade this". The defect
 * that was actually reported — that Warwick sees no number at all on his clients — is
 * repaired; the classification is not fabricated to go with it.
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
  // Is there an established next action for the advice to be ABOUT? Defaults to the
  // D-4 predicate's own answer rather than to `true`: `next` is already UNSET exactly
  // when no grounded, current next action exists, so reusing it avoids inventing a
  // SECOND rival notion of "do we know what we are doing" that could disagree with the
  // first. A caller with better information may still pass this explicitly.
  //
  // The imprecision is one-directional and deliberately so: `next` is also UNSET when a
  // task IS known but its recommended model has no footer representation, which makes
  // this read TASK UNKNOWN slightly too often. That errs toward withholding a claim we
  // cannot fully support, which is the direction this whole change exists to move in.
  taskKnown = next !== NEXT_UNSET,
} = {}) {
  // ---------------------------------------------------------------------------
  // `~` QUALIFIES A NUMBER — so it survives exactly where a number does (WO-GF-01)
  // ---------------------------------------------------------------------------
  // This used to force `approximate: false` on EVERY blind path, and the reasoning given
  // was right when it was written: the grammar permits `ctx ~--`, and the parser
  // round-trips it, but "approximately unknown" is not a fact about anything.
  //
  // THAT REASONING IS SUPERSEDED BY THERE BEING A NUMBER TO QUALIFY. Two blind rungs now
  // carry a real measurement — WINDOW_SIZE_UNKNOWN (WO-OR-05) and STALE (2026-08-02) —
  // and the `~` means one precise thing: "this sample's session could not be confirmed as
  // mine." That is a live case, not a hypothetical: the footer CLI invoked without
  // `--session` resolves the NEWEST sample for the project key and marks it approximate,
  // and this machine's store holds several sessions at once. Rendering that count as a
  // bare `ctx 259k` states it more strongly than the evidence supports; `ctx ~259k` is
  // the same number with its one caveat attached.
  //
  // The flag is therefore tied to the NUMERATOR and not to the rung: no number, no
  // qualifier, so `ctx ~--` remains unreachable and the original judgement stands
  // wherever it still applies. SESSION_MISMATCH carries no number by construction (it
  // must never carry another session's count) and so can never carry the `~` either.
  const blind = (blindReason, ctx = {}) => {
    const ctxFields = { percent: null, usedTokens: null, windowTokens: null, ...ctx };
    return {
      fields: {
        ...ctxFields,
        approximate: ctxFields.usedTokens !== null && sample?.approximate === true,
        state: STATE.BLIND,
        advice: adviceFor(STATE.BLIND, { taskKnown }),
        next,
        control,
      },
      blind: true,
      blindReason,
      // Read from the parameter rather than closed over a later `const`, so the rungs
      // that fire BEFORE the sample has been unpacked can still answer it. A blind rung
      // that carries a number (STALE, WINDOW_SIZE_UNKNOWN) must be able to say which
      // measurement that number is, for the same reason the success path must.
      measurement: sample?.data && typeof sample.data === 'object'
        ? selectContextCount(sample.data).measurement
        : null,
    };
  };

  if (!sample || sample.ok !== true || !sample.data || typeof sample.data !== 'object') {
    return blind(BLIND_REASON.SAMPLE_UNREADABLE);
  }
  const data = sample.data;

  if (data.schema_version !== HEALTH_SCHEMA_VERSION) {
    return blind(BLIND_REASON.SCHEMA_UNRECOGNISED);
  }

  // `isFiniteNumber` catches absent, null, NaN, Infinity — and the string "42", which is
  // D-M1's fourth mutation and the one a looser `!= null` check would have let through
  // as GREEN. Applied to every one of the three numbers below, not just the percentage.
  const reportedPct = data.context_window?.used_percentage;
  // SOURCE-SELECTED, never unioned — see `selectContextCount`. `measurement` travels with
  // the number all the way out of this function so no caller has to re-derive which
  // quantity it is holding.
  const { raw: usedTokensRaw, measurement } = selectContextCount(data);
  const windowRaw = data.context_window?.context_window_size;

  const usedTokens = isFiniteNumber(usedTokensRaw) ? toRenderableTokens(usedTokensRaw) : null;
  const windowTokens =
    isFiniteNumber(windowRaw) && windowRaw > 0 ? toRenderableTokens(windowRaw) : null;

  // A-3: no count for this sample's own source is BLIND. A reported percentage does NOT
  // rescue it — see the note on `BLIND_REASON.PERCENTAGE_ABSENT`.
  if (usedTokens === null) {
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

  // ---------------------------------------------------------------------------
  // THE STALE RUNG CARRIES THE NUMERATOR TOO — the defect CLASS, not one instance
  // ---------------------------------------------------------------------------
  // This used to `return blind(BLIND_REASON.STALE)` bare, which DISCARDED a real,
  // measured `used_tokens` the sample was holding, and rendered `ctx --`. Observed
  // live 2026-08-02: a sample carrying `used_tokens: 258933` aged past 20 minutes
  // mid-turn and the footer went to `ctx --` — no number at all — while the very
  // same missing information one rung lower (rung 7, WINDOW_SIZE_UNKNOWN) is
  // deliberately rendered as `ctx 259k · BLIND`.
  //
  // Two rungs, the same question ("we cannot GRADE this, do we still know the
  // count?"), two different answers. WO-OR-09 fixed the instance it was pointed at
  // and left the class open — inspection finding one case is not the same as
  // enumerating them. The rungs that can hold a real numerator are exactly:
  // STALE (this one) and WINDOW_SIZE_UNKNOWN (rung 7). SESSION_MISMATCH must NOT
  // carry it — another session's count is not a fact about this one — and the
  // rungs above simply have no numerator to carry.
  //
  // `state` stays BLIND, so nothing is graded off an old reading. What Warwick gets
  // is a true measurement with no grade instead of a blank where a number existed.
  //
  // `windowTokens` is forced to null exactly as rung 7 does, and that is NOT tidiness:
  // `renderFooter` throws `windowTokens requires both percent and usedTokens — a
  // denominator with nothing to divide is a caller bug`. Carrying the window here was
  // the first attempt at this fix and the suite caught it. A denominator with no
  // percentage beside it is the display half of the exact false-confidence this module
  // exists to prevent.
  if (now - sampledAt > STALE_AFTER_MS) {
    return blind(BLIND_REASON.STALE, { usedTokens, windowTokens: null });
  }

  // The percentage, from the ONLY two honest sources: one the sample reported directly
  // (the statusLine path), or one DIVIDED from a real numerator by an authoritative
  // denominator (the transcript path). Never from a model -> window guess.
  //
  // ---------------------------------------------------------------------------
  // WO-OR-12 / Codex F3 — A DISPLAY TRANSFORM MUST NEVER FEED THE ARITHMETIC
  // ---------------------------------------------------------------------------
  // This division used to read `(usedTokens / windowTokens) * 100`. Both of those have
  // been through `toRenderableTokens`, which rounds onto `TOKENS_GRAIN` for the DISPLAY
  // codec — so the single most load-bearing number this module emits was computed from
  // two values that exist only in order to be rendered. It divides the RAW numerator by
  // the RAW denominator now. Display rounded, divide raw.
  //
  // THE MAGNITUDE ARGUMENT FOR LEAVING IT ALONE WAS TESTED AND IS FALSE — recorded here
  // because it is what makes this a real repair rather than a purity exercise. The
  // defence was that real windows are 200000 or 1000000, both exact multiples of the
  // grain, so the denominator is unaffected and a numerator error of at most 50 tokens
  // sits far below the integer percent actually rendered. The first two clauses are
  // true. The conclusion is not: swept across every used-token value in a 200000 window,
  // 4996 of 200001 (2.498%) render a DIFFERENT integer percent, and 100 of them cross an
  // evaluator threshold and change the STATE. `used_tokens: 149950` graded RED · CLEAR
  // NOW off a numerator rounded up to exactly 75.000%, where the true figure is 74.975%
  // and the honest grade is AMBER. A governor telling Warwick to rotate on the strength
  // of a rounding artefact is the class of false reading INV-1 exists to forbid.
  // "Correct because the inputs are usually big enough" is TQA-001's shape — correct by
  // luck of environment, and it reads green right up until it does not.
  //
  // EVERY GUARD THE ROUNDED VALUES WERE SUBJECT TO STILL GATES THIS DIVISION, and that
  // is the half worth reading twice: moving arithmetic upstream of a check is the
  // obvious way to fix this defect and introduce a worse one. `usedTokens !== null`
  // establishes that `usedTokensRaw` passed `isFiniteNumber` and is non-negative;
  // `windowTokens !== null` establishes that `windowRaw` passed `isFiniteNumber` AND
  // `> 0`. So no NaN, no division by zero and no negative numerator is reachable here,
  // and the representability rungs below still fire exactly as they did.
  //
  // The `usedTokens !== null` conjunct is DELIBERATELY explicit even though rung 3 above
  // already guarantees it (reaching this line with a non-finite `reportedPct` is only
  // possible when `usedTokens` is non-null). It changes no behaviour. It states the
  // precondition of the raw division AT the raw division, instead of leaving it inherited
  // from a guard forty lines away that a later edit could move.
  const used = isFiniteNumber(reportedPct)
    ? reportedPct
    : usedTokens !== null && windowTokens !== null
      ? (usedTokensRaw / windowRaw) * 100
      : null;

  // Rung 7. A real number we cannot grade. Both token fields are carried into the
  // fields, so `renderFooter` emits `ctx 72.6k` instead of the `ctx --` Warwick used to
  // get — while `state` stays BLIND because nothing here can classify it.
  if (used === null) {
    return blind(BLIND_REASON.WINDOW_SIZE_UNKNOWN, { usedTokens, windowTokens: null });
  }

  // ---------------------------------------------------------------------------
  // WO-OR-13 / INV-1 — THE RANGE DECISION IS MADE ON `used`, NOT ON ITS DISPLAY FORM
  // ---------------------------------------------------------------------------
  // This used to check `Math.round(used)`, which asked whether the DISPLAY was in range
  // rather than the value being judged. `Math.round` is round-half-UP, so it folded
  // [-0.5, 0) onto `-0` — and `-0 < 0` is FALSE — and (100, 100.5) onto 100. Both bands
  // walked past the guard: `used_percentage: -0.4` rendered `ctx 0% · GREEN`, telemetry
  // the grammar explicitly rejects wearing the most reassuring state the footer can
  // emit. The band is asymmetric because the rounding is; the low side was the false
  // GREEN, the high side graded RED off an input with no representation.
  //
  // NEVER MOVE THIS CHECK BACK AFTER THE ROUNDING. `used` feeds a THRESHOLD, and a step
  // function converts an arbitrarily small input error into a maximal output change at
  // the boundary — so "the rounding error is tiny" is the wrong instrument wherever a
  // value meets a cutoff. Swept the module for the same shape: schema equality,
  // `windowRaw > 0`, staleness and the evaluator's 55/75 all already test raw values.
  // This rung was the only instance.
  //
  // Negated conjunction rather than `used < 0 || used > 100` so it fails CLOSED: a NaN
  // lands on BLIND instead of passing two false comparisons into the evaluator.
  if (!(used >= 0 && used <= 100)) {
    // Clamping would render a number the sample did not support; BLIND says "I cannot
    // represent this", which is the honest answer and the one INV-1 asks for.
    return blind(BLIND_REASON.PERCENTAGE_OUT_OF_RANGE);
  }

  // `+ 0` IS LOAD-BEARING — it normalises the one negative zero that survives the guard.
  // `used === -0` passes above, and rightly (-0 IS zero, and 0% is in the grammar), but
  // `Math.round(-0)` is `-0`, which `renderFooter` accepts and emits as `0%` while
  // `parseFooter` reads back `+0`. D-M10's `parseFooter(renderFooter(x)).fields`
  // identity is therefore FALSE for a value the renderer accepts — the same class as
  // the F1 defect WO-OR-10 closed. The suite cannot see it loosely (`-0 == 0`, and
  // `deepEqual` agrees), so its proof asserts with `Object.is`. Normalised in the
  // PRODUCER rather than by tightening the renderer: meaning in the producer, fidelity
  // in the codec, and no survey exists of what a stricter renderer would break in its
  // callers. `-0 + 0` is `+0`; every other value is unchanged.
  const percent = Math.round(used) + 0;

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

  // The parenthetical `(72.6k/190k)` is emitted ONLY when BOTH numbers are real. A
  // percentage the sample reported directly, with no token counts behind it, still
  // renders as the bare `ctx 38%` it always did.
  const showTokens = usedTokens !== null && windowTokens !== null;

  return {
    fields: {
      percent,
      usedTokens: showTokens ? usedTokens : null,
      windowTokens: showTokens ? windowTokens : null,
      approximate: sample.approximate === true,
      state,
      advice: adviceFor(state, { taskKnown }),
      next,
      control,
    },
    blind: state === STATE.BLIND,
    blindReason: null,
    // NOT inside `fields`. `fields` is exactly the grammar's field set and D-M10 asserts
    // `parseFooter(renderFooter(x)).fields` round-trips it; an extra key there would be a
    // key the rendered line cannot carry back. The label rides beside the fields instead.
    measurement,
  };
}

// ---------------------------------------------------------------------------
// `nextModelFor` and `listProgrammeStatePaths` were DELETED here by WO-OR-05.
// ---------------------------------------------------------------------------
// D-4 decided `next:` by reading banked BUILD-* programme state off disk and checking
// six coherence conditions against it. Programme state no longer exists in this estate,
// so that predicate had exactly one possible answer — UNSET — for every input, forever.
// A predicate that cannot return anything else is not a predicate, and the five
// programme-shaped `UNSET_REASON` members it produced went with it (see that const).
//
// `next:` is therefore an INPUT now, defaulted to UNSET and supplied by the one actor
// that still knows the next action. That is not a weakening of D-4: the constitution
// requires that a model renders ONLY when grounded in a real, current next action, and
// the grounding check has moved to the only place that can still perform it. What D-4
// forbade — a banked literal presented as live advice — remains impossible, because
// there is no longer any banked literal to present.

// ---------------------------------------------------------------------------
// WP-3B(b) — `next:` GROUNDED IN THE ACTIVE MAP, on the ON-DEMAND PATH ONLY
// ---------------------------------------------------------------------------
// `next:` stays an INPUT everywhere it was one. What is added here is a way for the
// on-demand CLI to COMPUTE it when no caller supplied one, instead of rendering UNSET at
// the exact moment Warwick asked. `--next` still wins outright when given, so no existing
// caller changes behaviour.
//
// WHERE THE POLICY COMES FROM, AND WHERE IT DOES NOT. The five rows below are LARRY'S
// operating parameter (Amendment 1, A-5) — an advisory recommendation Warwick may
// overrule, not governing law, and NOT this module's to invent. What lives here is the
// deterministic MECHANICS of applying them: how the frontier text is located, how it is
// classified, and what happens when it cannot be. The one place judgement genuinely
// enters is the vocabulary literal, which is why it is a frozen, readable export rather
// than a regex buried in a function — a reviewer must be able to disagree with a word.
//
// A-4 IS WHAT KEEPS THIS OFF THE HOT PATH, and it is structural rather than argued.
// `resolveActiveMapPath` (continuity.mjs) shells out to `git grep` and `git log`.
// `footer.mjs` is imported by `statusline-live.mjs`, which runs on EVERY statusline
// refresh, and `footer.mjs:49`'s A-7 invariant forbids a `git` invocation on that path.
// So nothing here is imported at module scope and nothing here is reachable from
// `deriveFooterFields`: the resolver arrives as an INJECTED dependency that only the
// direct-execution entrypoint supplies. An importer of this module therefore cannot
// reach a `git` call even by accident, and the statusline keeps rendering `next: UNSET`.
// That limitation is real and is recorded rather than hidden.

// Capability order, highest first. "The HIGHER of the candidates" needs a total order,
// and fail-safe means MORE capability, never less.
export const NEXT_RANK = Object.freeze(['Opus/high', 'Sonnet/medium', 'Sonnet/low']);

// The vocabulary. Lower-cased substring membership — deterministic, no stemming, no
// scoring, no "looks like". Terms are drawn from Larry's own row wording plus the
// estate's proper nouns for the same activities.
//
// `merge decision` and `record update` are MULTI-WORD deliberately: bare "decision" and
// bare "record" appear in almost every map and would make row 4 fire constantly.
export const FRONTIER_VOCABULARY = Object.freeze({
  'Opus/high': Object.freeze([
    'assurance', 'veritas', 'codex', 'review', 'adjudicat', 'design',
    'uncertain', 'investigat', 'unresolved', 'unestablished', 'fog',
  ]),
  'Sonnet/medium': Object.freeze([
    'implement', 'mechanical', 'bounded', 'record-keeping', 'migration',
    'test suite', 'wire ', 'install', 'rename', 'single known edit',
  ]),
  'Sonnet/low': Object.freeze([
    'merge decision', 'merge-decision', 'record update',
  ]),
});

/**
 * frontierTextFromMap(mapText) -> { text, headings } — pure, never throws.
 *
 * "The remaining work in the active phase", located mechanically. Two section kinds are
 * collected and concatenated: the last section whose heading names a FRONTIER, and the
 * last section whose heading names a PHASE. Either alone is demonstrably insufficient on
 * the real map — the frontier section can be three lines that point elsewhere, and the
 * phase section can be long enough to have a stale opening — so both are read and the
 * classifier sees their union.
 *
 * A heading marked superseded, historical or closed is EXCLUDED. That is not a nicety:
 * this estate's maps keep superseded frontiers in place on purpose, with `⛔ SUPERSEDED
 * AND HISTORICAL. DO NOT READ THIS AS THE CURRENT FRONTIER` written across them, and a
 * reader that ignored those words would confidently recommend for a phase that closed.
 *
 * `headings` is returned so a caller can say WHICH sections it read. A recommendation
 * whose provenance cannot be stated is the banked-literal defect wearing a new hat.
 */
export function frontierTextFromMap(mapText) {
  if (typeof mapText !== 'string' || mapText.length === 0) return null;
  const lines = mapText.split(/\r?\n/);

  const sections = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    sections.push({ level: m[1].length, title: m[2], start: i });
  }
  if (sections.length === 0) return null;

  const EXCLUDED = /superseded|historical|closed|do not read/i;
  const bodyOf = (idx) => {
    const s = sections[idx];
    let end = lines.length;
    for (let j = idx + 1; j < sections.length; j += 1) {
      if (sections[j].level <= s.level) { end = sections[j].start; break; }
    }
    return lines.slice(s.start, end).join('\n');
  };

  const pick = (re) => {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      if (re.test(sections[i].title) && !EXCLUDED.test(sections[i].title)) return i;
    }
    return -1;
  };

  const frontierIdx = pick(/frontier/i);
  const phaseIdx = pick(/phase\s*\d/i);
  if (frontierIdx === -1 && phaseIdx === -1) return null;

  const chosen = [...new Set([frontierIdx, phaseIdx].filter((i) => i !== -1))];
  return {
    text: chosen.map(bodyOf).join('\n'),
    headings: chosen.map((i) => sections[i].title),
  };
}

/**
 * classifyFrontier(text) -> { next, matched } — pure, never throws.
 *
 * Membership, then Larry's precedence: no category matched is UNSET (never a guess), one
 * category is that category, more than one is the HIGHEST-RANKED of them.
 */
export function classifyFrontier(text) {
  if (typeof text !== 'string' || text.length === 0) return { next: NEXT_UNSET, matched: [] };
  const hay = text.toLowerCase();
  const matched = NEXT_RANK.filter((row) =>
    FRONTIER_VOCABULARY[row].some((term) => hay.includes(term))
  );
  if (matched.length === 0) return { next: NEXT_UNSET, matched };
  // NEXT_RANK is highest-first and `matched` preserves its order, so [0] IS the higher.
  return { next: matched[0], matched };
}

/**
 * recommendNext({ mapPathFn, readFileFn, cwd }) -> { next, reason, mapPath, headings }
 *
 * The one impure step, and it never throws: every failure is a reason string and an
 * UNSET. `mapPathFn` is injected — see the A-4 note above for why this module must not
 * import the resolver itself.
 */
export function recommendNext({ mapPathFn = null, readFileFn = readFileSync, cwd = process.cwd() } = {}) {
  const unset = (reason) => ({ next: NEXT_UNSET, reason, mapPath: null, headings: [] });
  if (typeof mapPathFn !== 'function') return unset('no-map-resolver-supplied');

  let mapPath;
  try {
    mapPath = mapPathFn({ cwd });
  } catch {
    return unset('map-resolver-threw');
  }
  if (typeof mapPath !== 'string' || mapPath.length === 0) return unset('no-active-map-found');

  let text;
  try {
    text = readFileFn(mapPath, 'utf8');
  } catch {
    return unset('map-unreadable');
  }

  const frontier = frontierTextFromMap(text);
  if (frontier === null) return { ...unset('no-frontier-section'), mapPath };

  const { next, matched } = classifyFrontier(frontier.text);
  return {
    next,
    reason: matched.length === 0 ? 'frontier-unclassifiable' : `matched:${matched.join('+')}`,
    mapPath,
    headings: frontier.headings,
  };
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
// Impure: make the count FRESH AT RENDER TIME (WO-GF-01)
// ---------------------------------------------------------------------------
// THE DEFECT. A health sample is written at a TURN BOUNDARY — by the Stop hook via
// `sampler.sampleFromTranscript`, or by the statusLine — and nothing re-samples during a
// long working turn. So on any turn longer than `STALE_AFTER_MS` the footer rendered a
// count that was true as of its sample time with NOTHING in the line to say how old it
// was: a 30-second-old count and a 25-minute-old one looked identical. Observed live
// 2026-08-02 at 24 minutes.
//
// This matters more here than it sounds. On this estate the denominator is usually not
// established (every recent sample for this project key carries
// `context_window_size: null`), so the footer sits on the WINDOW_SIZE_UNKNOWN rung
// permanently — no percentage, state BLIND — and the raw count is the ENTIRE payload of
// the line. Its freshness is not a refinement of the feature; it is the feature.
//
// THE REPAIR IS TO REMOVE THE STALENESS, NOT TO LABEL IT. The transcript is appended
// throughout a turn (measured at six seconds old mid-turn on this machine), and the
// sample now records the path it was read from, so the count can simply be re-read at the
// moment it is rendered. Nothing is added to the byte grammar, nothing new is scheduled,
// cached or configured, and no new module exists: this reuses `sampler.mjs`'s existing
// tail reader and its usage arithmetic, and on failure returns the caller's own sample
// unchanged so the behaviour degrades to exactly what it was before.
//
// FOUR REFUSALS, and each one is why this cannot quietly make things worse:
//
//   IDENTITY, NEVER INFERENCE. The transcript's newest assistant message must name the
//   SAME session the sample does. A transcript is just a file path; without this check a
//   stale or hand-edited path could put another session's count on this session's line,
//   which is the one thing the whole ladder is built to prevent. Matching ids is the same
//   principle `resolveWindowTokens` settled in WO-OR-09: identity may cross a boundary
//   that similarity may not.
//
//   NEVER GO BACKWARDS. The tail read is bounded at `TRANSCRIPT_TAIL_BYTES`, and a single
//   multi-megabyte tool result can push the genuinely newest assistant message out of
//   that window — observed on this machine, where the "newest" message found was five
//   minutes behind the file's own mtime. Without this check the refresh could REPLACE a
//   newer stored count with an older one and backdate the sample. A refresh that can make
//   the reading worse is not a repair.
//
//   THE MESSAGE'S OWN TIME, NEVER `now`. `sampled_at` becomes the timestamp of the
//   message the count was read from. Stamping the read time would mark every count fresh
//   forever and silently disable the STALE rung — the same class of lie as a stale count
//   presented as current, in the opposite direction. Taking the message's time instead
//   composes with that rung rather than defeating it: a session that has genuinely
//   stopped still reads STALE, and still carries its true count.
//
//   TRANSCRIPT SAMPLES ONLY. A statusLine sample's numerator is not what this reads, and
//   it carries no transcript path, so this declines rather than guessing one.
//
// Never throws. Every failure path returns the sample it was given.

/**
 * refreshSampleFromTranscript(sample, deps) -> sample
 *
 * `sample` is a health-store READ RESULT (`{ ok, data, approximate }`), the same shape
 * `deriveFooterFields` consumes — not a bare sample. Returns a NEW read result carrying a
 * fresher `used_tokens` and `sampled_at`, or the original object untouched.
 *
 * `refreshedFromTranscript: true` is set on a refreshed result so a caller — and a test —
 * can tell that the re-read actually happened, rather than inferring it from a number
 * that might have come out either way. INV-5's rule applied to a new path: a control that
 * cannot say what it did cannot be made to fail convincingly.
 */
export function refreshSampleFromTranscript(sample, {
  readTail = readTranscriptTail,
  findUsage = newestAssistantUsage,
  sumTokens = sumUsedTokens,
} = {}) {
  if (!sample || sample.ok !== true || !sample.data || typeof sample.data !== 'object') return sample;
  const data = sample.data;
  if (data.source !== SOURCE_TRANSCRIPT) return sample;

  const path = data.transcript_path;
  if (typeof path !== 'string' || path.length === 0) return sample;

  let found;
  try {
    found = findUsage(readTail(path));
  } catch {
    return sample;
  }
  if (!found) return sample;

  // IDENTITY. Both sides must state a session id and they must agree.
  if (typeof found.sessionId !== 'string' || found.sessionId.length === 0) return sample;
  if (found.sessionId !== data.session_id) return sample;

  // THE MESSAGE'S OWN TIME. Unusable time, no refresh — a count with no honest as-of is
  // worth less than a count whose age the existing ladder already judges correctly.
  const at = typeof found.timestamp === 'string' ? Date.parse(found.timestamp) : NaN;
  if (!Number.isFinite(at)) return sample;

  // NEVER GO BACKWARDS. An unparseable stored `sampled_at` cannot be compared, and the
  // ladder rejects it anyway (SAMPLED_AT_UNPARSEABLE), so a real timestamp is an
  // improvement on it and the refresh proceeds.
  const storedAt = typeof data.sampled_at === 'string' ? Date.parse(data.sampled_at) : NaN;
  if (Number.isFinite(storedAt) && at <= storedAt) return sample;

  const usedTokens = sumTokens(found.usage);
  if (typeof usedTokens !== 'number' || !Number.isFinite(usedTokens)) return sample;

  return {
    ...sample,
    data: {
      ...data,
      sampled_at: found.timestamp,
      context_window: { ...data.context_window, used_tokens: usedTokens },
    },
    refreshedFromTranscript: true,
  };
}

// ---------------------------------------------------------------------------
// Impure: the one composition function
// ---------------------------------------------------------------------------

/**
 * computeFooterLine(opts) -> string
 *
 * The full path: resolve a sample -> run the ladder -> render. Mirrors
 * `status-line.mjs`'s single-impure-composition shape (AD-11): everything above this
 * function is independently unit-testable without an estate, and this is the only place
 * that touches disk.
 *
 * `next` is an INPUT (WO-OR-05) rather than something derived here — see the note where
 * `nextModelFor` used to live. An unrecognised value is coerced to UNSET rather than
 * throwing: this function's contract is that it always returns a grammatical line, and a
 * caller's bad recommendation must not be able to silence the footer entirely.
 *
 * Never throws. A footer that cannot be computed is still a footer — BLIND, UNSET,
 * CONTINUE — because the alternative is no visible line at all, and an absent governor
 * is indistinguishable from a healthy one (the failure mode this build exists to kill).
 */
export function computeFooterLine({
  sessionId = null,
  cwd = process.cwd(),
  homeDir,
  envOverride,
  now = Date.now(),
  next = NEXT_UNSET,
  control = CONTROL_CONTINUE,
  // Injections, forwarded EXPLICITLY below and never by spreading this bag —
  // delegation-gate.mjs's rule, and for its reason: one opts object serving three
  // different callees lets a key meant for one callee be silently reinterpreted as a
  // filesystem injection by the sample resolver.
  readSample,
  dirFor,
  listDir,
  existsFn,
  statFn,
  evaluateFn,
} = {}) {
  const nextValue = NEXT_VALUES.includes(next) ? next : NEXT_UNSET;

  let sample;
  try {
    sample = resolveHealthSample({ sessionId, cwd, homeDir, envOverride, readSample, dirFor, listDir, existsFn, statFn });
  } catch {
    sample = { ok: false, approximate: false };
  }

  // WO-GF-01. The stored sample was written at a turn boundary; this is render time, and
  // the transcript has moved on since. Re-read the count from its own source so the line
  // states what is true NOW rather than what was true when the last turn ended. Declines
  // on every failure and returns the stored sample unchanged, so nothing here can make
  // the line worse than it was — including the `catch`, which exists because this
  // function owes its caller a line under all conditions and that promise is not one it
  // gets to borrow from a callee.
  try {
    sample = refreshSampleFromTranscript(sample);
  } catch { /* the stored sample stands */ }

  const { fields } = deriveFooterFields({
    sample,
    knownSessionId: sessionId,
    now,
    next: nextValue,
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
      usedTokens: null,
      windowTokens: null,
      approximate: false,
      state: STATE.BLIND,
      advice: ADVICE.UNSURE,
      next: NEXT_UNSET,
      control: CONTROL_CONTINUE,
    });
  }
}

// ---------------------------------------------------------------------------
// THE PRODUCER — a CLI entrypoint (BUILD-018 WP-7)
// ---------------------------------------------------------------------------
// WHY THIS EXISTS. Root CLAUDE.md § "Governor advice" requires every reply to end with a
// `⟦GOV⟧` footer AND states that a hand-composed footer is a defect. Until this block,
// those two clauses could not both be satisfied: this module exported functions only, and
// its consumers were `statusline-live.mjs` (a terminal status line, which Warwick cannot
// see — he works on claude.ai web and Android) and a Stop-path parser that WO-OR-05 has
// since deleted.
// So the only available producer was a human typing the bytes, which is the forbidden one.
// Nolan's final acceptance audit: "the footer has no producer."
//
// The risk is not tidiness. A hand-composed footer one field short is REJECTED by
// `parseFooter`, and B6 treats "no valid footer" as ALLOW — so the execution controller
// silently permits every stop and a governor that has stopped governing looks EXACTLY
// like one that works. One generator removes that failure mode by construction: the line
// Larry emits and the line the controller checks come out of the same code.
//
// ---------------------------------------------------------------------------
// TWO EXIT CLASSES, and the split is load-bearing (Larry's ruling, WP-7 read-back)
// ---------------------------------------------------------------------------
//   * USAGE errors — an unknown flag, a missing value, an unrecognised `--control`
//     token — write to STDERR, exit NON-ZERO, and print NOTHING on stdout. Emitting a
//     footer for a mistyped handback code is the one thing this must never do: a bad
//     token that silently rendered CONTINUE would disable the controller while looking
//     installed. Refusing loudly is the whole point.
//   * ENVIRONMENT failures — missing store, unreadable sample, corrupt JSON, absent
//     fields, no matching programme — print a valid BLIND/UNSET line and exit 0. Same
//     contract as the status line, for the same reason: an absent governor is
//     indistinguishable from a healthy one, so there is no input for which this prints
//     nothing.
//
// ---------------------------------------------------------------------------
// BLIND AND UNSET ARE INDEPENDENT LADDERS — do not "fix" one into the other
// ---------------------------------------------------------------------------
// `deriveFooterFields` decides `state` from TELEMETRY. `next:` is supplied by the caller
// and says NOTHING about the state — the line can be, and routinely is, `GREEN` with
// `next: UNSET`. Rendering BLIND because no recommendation was supplied would have the
// footer claim it could not read telemetry it read perfectly well: a FALSE BLIND, the
// exact mirror of the false GREEN INV-1 exists to forbid, and it would nudge Warwick
// toward rotating on the strength of a missing command-line flag. WP-7's original AC4
// said "no programme -> BLIND"; it was raised at read-back and corrected. The ladders
// stay separate, and they stay separate now that `next:` comes from a flag rather than
// from a file.

export const CLI_EXIT = Object.freeze({ OK: 0, USAGE: 2 });

export const CLI_USAGE =
  'usage: node tools/governor/footer.mjs [--session <id>] [--next <Model>/<effort>|UNSET] ' +
  '[--control CONTINUE|HANDBACK:<code>] [--help]';

// ---------------------------------------------------------------------------
// WP-3B(c) — WHY THIS TEXT EXISTS, AND WHY IT IS THE WHOLE OF (c)
// ---------------------------------------------------------------------------
// The measured cost of one rendered footer was ~79k tokens because obtaining it meant
// dispatching a specialist that READ this 82 KB module to learn how to call it. The
// cheap route already existed — one `node` invocation, exit 0, one line of stdout — and
// nothing was wrong with it except that you could not find out about it without reading
// the module. `--help` previously exited 2 as an unrecognised argument.
//
// So the remaining build for (c) is this string and the flag that prints it. Not a new
// wrapper, not a new script, not a launcher: §16.4's verbs are remove, shorten, combine,
// change. What is documented here is chosen by one test — could a reader who has never
// opened this file call it correctly and know what the answer means?
export const CLI_HELP = [
  CLI_USAGE,
  '',
  'Prints ONE ⟦GOV⟧ line to stdout and exits 0. Environment failures still print a valid',
  'BLIND line and still exit 0; only a malformed invocation exits 2.',
  '',
  'ctx — the context field. Two producers write context counts and they are DIFFERENT',
  'measurements, so the number is selected by the sample\'s own source and never merged:',
  `  ${CONTEXT_MEASUREMENT.STATUSLINE_TOTAL_INPUT}  — the host\'s own report of input tokens presented`,
  `  ${CONTEXT_MEASUREMENT.TRANSCRIPT_USED}        — summed from the transcript file`,
  `  ${CONTEXT_MEASUREMENT.UNATTRIBUTED_USED}     — a real count from a sample with no recognised source`,
  'A sample carrying no count for its own source renders BLIND. A reported percentage is',
  'never shown in place of a count. `ctx ~` means the sample could not be confirmed as',
  'this session\'s. `ctx 33% (327.4k/1000k)` is percentage, count and window together.',
  '',
  'next: — the model/effort recommendation. Supply --next to state it yourself; that',
  'always wins. With no --next, the direct-execution entrypoint resolves the active',
  'Wayfinder map and classifies the current frontier under Larry\'s policy. If no frontier',
  'can be established it renders UNSET — never a guess. Imported callers (the statusline)',
  'get UNSET: resolving the map shells out to git, which is forbidden on that path.',
  '',
  `  next values: ${NEXT_RANK.join(', ')}, or ${NEXT_UNSET}`,
  `  --next also accepts any of: ${NEXT_MODELS.join('|')}/${NEXT_EFFORTS.join('|')}`,
  `  --control: ${CONTROL_CONTINUE}, or ${HANDBACK_PREFIX}<code> where <code> is one of:`,
  `    ${HANDBACK_CODES.join(', ')}`,
  '',
  'examples:',
  '  node tools/governor/footer.mjs',
  '  node tools/governor/footer.mjs --session <session-id>',
  '  node tools/governor/footer.mjs --control HANDBACK:merge-decision',
].join('\n');

function usageFailure(message) {
  return { exitCode: CLI_EXIT.USAGE, stdout: '', stderr: `footer: ${message}\n${CLI_USAGE}\n` };
}

/**
 * parseCliArgs(argv) -> { ok: true, sessionId, next, control } | { ok: false, error }
 *
 * Separated from `runCli` so the argument grammar is testable without touching disk.
 *
 * Both `--control` and `--next` are validated by MEMBERSHIP against the frozen consts
 * this module already owns, read directly rather than re-typed. A second list of seven
 * codes — or of sixteen next-values — anywhere is the drift this whole module exists to
 * prevent, and the constitution's own § "When Warwick may be interrupted" is the source
 * of `HANDBACK_CODES`.
 *
 * `--next` is validated STRICTLY at the CLI boundary even though `computeFooterLine`
 * coerces an unrecognised value to UNSET. The two are not in tension and the split is the
 * same one `--control` already makes: a MISTYPED flag from a human must fail loudly
 * (silently rendering UNSET would look identical to "no recommendation was available",
 * so a typo would be indistinguishable from an honest absence), while a bad value
 * arriving through the programmatic API must still yield a grammatical line.
 */
export function parseCliArgs(argv = []) {
  let sessionId = null;
  let next = NEXT_UNSET;
  let control = CONTROL_CONTINUE;
  // WP-3B(b): whether the CALLER stated `next`, which is not the same question as whether
  // `next` is UNSET — `--next UNSET` is a caller stating it, and must not be overridden by
  // a computed recommendation.
  let nextSupplied = false;

  const FLAGS = ['--session', '--next', '--control'];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    // `--help` takes no value and short-circuits everything. Checked inside the loop so
    // it works in any position, and BEFORE the unrecognised-argument refusal so that the
    // one flag a lost reader will try is the one flag that answers them.
    if (arg === '--help' || arg === '-h') return { ok: true, help: true };
    if (!FLAGS.includes(arg)) {
      return { ok: false, error: `unrecognised argument ${JSON.stringify(arg)}` };
    }
    const value = argv[i + 1];
    // A value that is absent, empty, or itself a flag is a MISSING value, not a value.
    // `--session --control CONTINUE` must fail loudly rather than silently reading
    // "--control" as a session id and then reporting BLIND about a session nobody has.
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
      return { ok: false, error: `${arg} requires a value` };
    }
    i += 1;
    if (arg === '--session') sessionId = value;
    else if (arg === '--next') { next = value; nextSupplied = true; }
    else control = value;
  }

  if (!NEXT_VALUES.includes(next)) {
    return {
      ok: false,
      error:
        `--next must be <Model>/<effort> or ${NEXT_UNSET}, where <Model> is one of ` +
        `${NEXT_MODELS.join(', ')} and <effort> is one of ${NEXT_EFFORTS.join(', ')} — ` +
        `got ${JSON.stringify(next)}`,
    };
  }

  if (parseControl(control).kind === 'unrecognised') {
    return {
      ok: false,
      error:
        `--control must be ${CONTROL_CONTINUE} or ${HANDBACK_PREFIX}<code>, where <code> is ` +
        `one of: ${HANDBACK_CODES.join(', ')} — got ${JSON.stringify(control)}`,
    };
  }

  return { ok: true, help: false, sessionId, next, control, nextSupplied };
}

/**
 * runCli(argv, deps) -> { exitCode, stdout, stderr }
 *
 * Returns the streams rather than writing them (model-gate.mjs's shape), so the whole
 * entrypoint is unit-testable without spawning a process and without any test needing to
 * capture stdout.
 *
 * Everything is resolved here — nothing is passed in on the command line beyond the three
 * optional flags:
 *   * the health sample, from the store: the exact one when `--session <id>` is given,
 *     otherwise the NEWEST for this project (which sets the `~` approximate flag);
 *   * `state` / `advice`, via the degradation ladder;
 *   * `next:`, straight from `--next` when the caller supplied it; otherwise COMPUTED
 *     from the active map's frontier, but ONLY when a `mapPathFn` was injected. No
 *     resolver, no computation, and the value stays UNSET — which is what every
 *     programmatic caller of this function gets, by design (A-4).
 *
 * A-7 IS NOW SATISFIED OUTRIGHT RATHER THAN BY ARGUMENT (WO-OR-05). This file used to
 * call `liveLocation` here — a real `git` invocation, reachable from a module that sits
 * on the Stop path — and carried a long note explaining why that was acceptable because
 * an import executes nothing. The location was only ever needed to match a worktree and
 * branch against banked programme state, and there is no banked programme state any
 * more. So the call is GONE, along with the import that made it possible, and the
 * property A-7 asks for is now structural instead of argued.
 */
export function runCli(argv = [], {
  cwd = process.cwd(),
  // Forwarded EXPLICITLY to computeFooterLine below, never by spreading this bag — the
  // same rule and the same reason as computeFooterLine's own injection note.
  now,
  homeDir,
  envOverride,
  readSample,
  dirFor,
  listDir,
  existsFn,
  statFn,
  evaluateFn,
  // WP-3B(b). Absent by default and absent for every importer — only the direct-execution
  // entrypoint supplies it. See the A-4 note above `recommendNext`.
  mapPathFn = null,
  readFileFn,
} = {}) {
  const args = parseCliArgs(argv);
  if (!args.ok) return usageFailure(args.error);
  if (args.help) return { exitCode: CLI_EXIT.OK, stdout: `${CLI_HELP}\n`, stderr: '' };

  // `--next` WINS OUTRIGHT when the caller stated one, including `--next UNSET`. The
  // computed value only ever fills a silence, so no existing caller's behaviour moves.
  let nextValue = args.next;
  if (!args.nextSupplied && mapPathFn) {
    try {
      nextValue = recommendNext({ mapPathFn, readFileFn, cwd }).next;
    } catch {
      // `recommendNext` promises not to throw; this entrypoint owes a line on its own
      // account rather than borrowing that promise from a callee.
      nextValue = NEXT_UNSET;
    }
    if (!NEXT_VALUES.includes(nextValue)) nextValue = NEXT_UNSET;
  }

  let line;
  try {
    line = computeFooterLine({
      sessionId: args.sessionId,
      cwd,
      homeDir,
      envOverride,
      now,
      next: nextValue,
      control: args.control,
      readSample,
      dirFor,
      listDir,
      existsFn,
      statFn,
      evaluateFn,
    });
  } catch {
    // Belt and braces. `computeFooterLine` and `liveLocation` both promise not to throw,
    // but "always prints a parseable line" is a contract this entrypoint owes on its own
    // account rather than one it borrows. This second layer cannot itself throw: every
    // field below is a frozen const, and `args.control` was already validated by
    // membership above — so `renderFooter`'s strict checks are all satisfied by
    // construction. The requested control token is PRESERVED rather than reset to
    // CONTINUE: a handback Larry asked for must not be silently discarded by a telemetry
    // failure.
    line = renderFooter({
      percent: null,
      usedTokens: null,
      windowTokens: null,
      approximate: false,
      state: STATE.BLIND,
      advice: ADVICE.UNSURE,
      next: NEXT_UNSET,
      control: args.control,
    });
  }

  return { exitCode: CLI_EXIT.OK, stdout: `${line}\n`, stderr: '' };
}

// Run ONLY when executed directly — the entrypoint guard every other module in
// tools/governor/ uses. Importing this module must execute NOTHING: it is imported by
// hooks that run on the Stop path, and a module that printed or exited at import time
// would take its importer down with it.
//
// `process.exitCode` rather than `process.exit()`: an explicit exit can truncate a pending
// stdout write on a Windows pipe, and a truncated footer is precisely the four-field line
// this whole Work Package exists to make impossible. Setting the code lets Node drain and
// leave on its own.
//
// WP-3B(b) / A-4 — THE MAP RESOLVER IS IMPORTED **HERE** AND NOWHERE ELSE.
// `continuity.mjs`'s `resolveActiveMapPath` shells out to `git grep` and `git log`.
// `footer.mjs` is imported by `statusline-live.mjs`, which runs on every statusline
// refresh, and A-7 forbids a `git` invocation on that path. A module-scope import would
// put a shelling-out module into that import graph even if nothing called it, so the
// import lives inside the direct-execution guard: an importer of this module cannot reach
// it at all, and the property stays STRUCTURAL rather than argued — the same standard
// WO-OR-05 set when it removed the `worktree-guard.mjs` import.
//
// The failure posture is the module's usual one: if the resolver cannot be loaded, the
// recommendation is simply not computed and `next:` renders UNSET. A footer is still
// printed and the exit code is still 0.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let mapPathFn = null;
  try {
    const { resolveActiveMapPath } = await import('./continuity.mjs');
    if (typeof resolveActiveMapPath === 'function') {
      mapPathFn = ({ cwd }) => resolveActiveMapPath({ cwd });
    }
  } catch { /* no resolver -> next: UNSET, which is the honest answer */ }

  const { exitCode, stdout, stderr } = runCli(process.argv.slice(2), { mapPathFn });
  if (stderr) process.stderr.write(stderr);
  if (stdout) process.stdout.write(stdout);
  process.exitCode = exitCode;
}
