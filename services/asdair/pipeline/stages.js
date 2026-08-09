// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/stages.js
//
// THE STAGE TABLE, AS A PURE FUNCTION OF DURABLE STATE.
//
// Given a SNAPSHOT of what the database says about one shop, this module
// answers exactly one question:
//
//     "What is the ONE next legal step for this shop?"
//
// It never assumes anything ran in this process, this hour or this week. It
// reads a snapshot and returns a decision. That is what makes the pipeline
// resumable: kill the runner anywhere, restart it, and the next step is
// re-derived from Postgres rather than remembered.
//
// PURE. No I/O, no clock, no randomness, no global state. Identical snapshots
// always produce an identical decision - which is why the whole stage table can
// be tested without a database, a model or a network.
//
// ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
// There is no step that books a slot, checks out, pays, enters a password or
// substitutes a product. A step that does not exist in STEPS cannot be returned
// by this module, cannot be dispatched by runPipeline.js, and therefore cannot
// happen. invariants.test.js asserts that over the whole vocabulary.
// =====================================================================

import { COMMANDS } from './commandNames.js';

/**
 * Every step the advancer can take, and every reason it can decline to.
 *
 * `act:*`  the pipeline does work and (usually) moves the shop on.
 * `wait:*` the shop is legally parked awaiting a human, a supervised runner or
 *          an inbound message. NOT an error, and NOT a stall to be worked
 *          around - the whole design point is that AsdAIr waits rather than
 *          guesses.
 */
export const STEPS = Object.freeze({
  // acting steps
  CANCEL: 'act:cancel',
  APPLY_CORRECTIONS: 'act:apply_corrections',
  RESUME: 'act:resume',
  TRANSCRIBE: 'act:transcribe',
  INTERPRET: 'act:interpret',
  PLAN: 'act:plan',
  REPLAN: 'act:replan',
  QUEUE_BROWSER_BUILD: 'act:queue_browser_build',
  PAUSE_BUILD: 'act:pause_build',
  RECORD_CONFIRMATION: 'act:record_confirmation',
  RECONCILE: 'act:reconcile',

  // waiting states
  AWAIT_BUILD_COMMAND: 'wait:build_command',
  AWAIT_ANSWERS: 'wait:answers',
  AWAIT_INTERPRETATION_CONFIRMATION: 'wait:interpretation_confirmation',
  // FAIL-SAFE ONLY (WP-B15-2). Lines are undecided but no question is open to
  // decide them, so the clarification round could not be opened. Parking here
  // is what makes READY_TO_SHOP unreachable WITHOUT livelocking the shop - see
  // planOutcome below for why a park and not a transition.
  AWAIT_LINE_RESOLUTION: 'wait:line_resolution',
  AWAIT_BASKET_REQUEST: 'wait:basket_request',
  AWAIT_RUNNER: 'wait:browser_runner',
  AWAIT_BASKET: 'wait:basket',
  AWAIT_CONFIRMATION: 'wait:order_confirmation',
  AWAIT_RETRY: 'wait:retry',
  DONE: 'wait:done',
});

/** The steps that actually do something. Everything else is a legal park. */
export const ACTING_STEPS = Object.freeze(
  Object.values(STEPS).filter((s) => s.startsWith('act:')),
);

export function isActing(step) {
  return typeof step === 'string' && step.startsWith('act:');
}

/**
 * THE STAGE TABLE, as documentation and as data.
 *
 * One row per durable `asdair.shop.status`. `waitsFor` is what a human reading
 * a stalled shop needs to know: who is being waited on.
 */
export const STAGE_TABLE = Object.freeze([
  { status: 'RECEIVED', step: 'transcribe (photo) | interpret (text)', gate: `${COMMANDS.BUILD_SHOP} command`, to: 'TRANSCRIBING | PROCESSING', waitsFor: 'Warwick tapping "Build this shop"' },
  { status: 'TRANSCRIBING', step: 'interpret', gate: 'none', to: 'PROCESSING', waitsFor: null },
  { status: 'PROCESSING', step: 'plan', gate: `interpretation review needs ${COMMANDS.CONFIRM_INTERPRETATION}`, to: 'NEEDS_DECISION | READY_TO_SHOP', waitsFor: 'Warwick confirming a reviewed interpretation' },
  { status: 'NEEDS_DECISION', step: 'replan once every question is settled', gate: 'no open questions', to: 'PROCESSING', waitsFor: 'Warwick answering the open questions' },
  { status: 'READY_TO_SHOP', step: 'queue the browser build', gate: `${COMMANDS.REQUEST_BASKET_BUILD} command`, to: 'WAITING_FOR_BROWSER', waitsFor: 'Warwick tapping "Build ASDA basket"' },
  { status: 'WAITING_FOR_BROWSER', step: 'none - a SUPERVISED runner claims the request', gate: 'n/a', to: 'SHOPPING', waitsFor: 'the supervised browser runner (Larry, at the keyboard)' },
  { status: 'SHOPPING', step: 'none - the supervised runner reports progress', gate: 'n/a', to: 'BASKET_READY | NEEDS_DECISION', waitsFor: 'the supervised browser runner' },
  { status: 'BASKET_READY', step: 'record the order confirmation', gate: `${COMMANDS.SUBMIT_CONFIRMATION} command`, to: 'ORDER_CONFIRMATION_RECEIVED', waitsFor: 'Warwick checking out HIMSELF and forwarding the ASDA confirmation' },
  { status: 'ORDER_CONFIRMATION_RECEIVED', step: 'reconcile and learn', gate: 'none', to: 'RECONCILED', waitsFor: null },
  { status: 'RECONCILED', step: 'none - terminal', gate: 'n/a', to: null, waitsFor: null },
  { status: 'FAILED', step: 'resume to the state it failed from', gate: `${COMMANDS.RETRY_STAGE} command`, to: '<the state it failed from>', waitsFor: 'Warwick tapping "Retry"' },
  { status: 'CANCELLED', step: 'none - terminal', gate: 'n/a', to: null, waitsFor: null },
]);

function decision(step, reason, extra = {}) {
  return { step, reason, to: null, command: null, ...extra };
}

/** PURE. The pending command of a given name, or null. */
export function pendingCommand(snapshot, name) {
  const list = (snapshot && snapshot.pendingCommands) || [];
  return list.find((c) => c.command === name) || null;
}

/** PURE. Every pending command of a given name (corrections and answers can stack). */
export function pendingCommands(snapshot, name) {
  const list = (snapshot && snapshot.pendingCommands) || [];
  return list.filter((c) => c.command === name);
}

/**
 * PURE. Has this command EVER been issued for this shop - pending or resolved?
 *
 * Used for LATCH gates (confirmInterpretation), where "the human has approved"
 * must stay true after the runner has consumed the command. A pending-only
 * check would silently re-close the gate the moment the command was resolved,
 * and the shop would park forever waiting for an approval it already had.
 */
export function everIssued(snapshot, name) {
  const list = (snapshot && snapshot.issuedCommands) || [];
  return list.includes(name);
}

/**
 * PURE. Decide the one next step for a shop, from durable state alone.
 *
 * @param {{
 *   shop: {id:*, shop_ref:string, household_id:*, status:string,
 *          source_kind:'text'|'photo', list_id:*, needs_review:boolean},
 *   openQuestions: number,
 *   pendingCommands: Array<{id:*, command:string, key:string, payload:object}>,
 *   issuedCommands: string[],
 *   browser: {id:*, status:string}|null,
 *   resumeFrom: string|null
 * }} snapshot
 * @returns {{step:string, reason:string, to:string|null, command:object|null}}
 */
export function decideNextStep(snapshot) {
  const shop = (snapshot && snapshot.shop) || null;
  if (!shop || typeof shop.status !== 'string') {
    throw new Error('stages: decideNextStep needs a snapshot carrying shop.status');
  }
  const status = shop.status;
  const openQuestions = Number(snapshot.openQuestions) || 0;

  // ── 1. CANCEL OUTRANKS EVERYTHING ──────────────────────────────────────────
  // Warwick asking to stop must not queue behind a plan, a model call or a
  // browser request. CANCELLED is reachable from every live state, so this is
  // always legal while the shop is still moving.
  const cancel = pendingCommand(snapshot, COMMANDS.CANCEL_SHOP);
  if (cancel && status !== 'CANCELLED' && status !== 'RECONCILED') {
    return decision(STEPS.CANCEL, 'a cancel command is outstanding', { to: 'CANCELLED', command: cancel });
  }

  // ── 2. TERMINAL ────────────────────────────────────────────────────────────
  if (status === 'RECONCILED' || status === 'CANCELLED') {
    return decision(STEPS.DONE, `${status} is terminal - this shop can never move again`);
  }

  // ── 3. PARKED BY A FAILURE ─────────────────────────────────────────────────
  // A FAILED shop is VISIBLE (it has its own status and its own last_error) and
  // RESUMABLE, but never resumed automatically: a step that failed once will
  // usually fail again, and a runner that retried silently would burn the
  // week's model budget in a loop while Warwick believed it was working.
  if (status === 'FAILED') {
    const retry = pendingCommand(snapshot, COMMANDS.RETRY_STAGE);
    if (!retry) {
      return decision(STEPS.AWAIT_RETRY, 'the shop failed and is waiting to be retried', {
        to: snapshot.resumeFrom || null,
      });
    }
    if (!snapshot.resumeFrom) {
      // Refuse rather than guess. shopState only permits FAILED -> the state it
      // failed from, and that state comes from the durable failure event.
      return decision(STEPS.AWAIT_RETRY,
        'a retry was asked for but the shop carries no durable failure event to resume from');
    }
    return decision(STEPS.RESUME, 'resuming to the state the shop failed from', {
      to: snapshot.resumeFrom, command: retry,
    });
  }

  // ── 4. PAUSE A LIVE BROWSER BUILD ──────────────────────────────────────────
  const pause = pendingCommand(snapshot, COMMANDS.PAUSE_BASKET_BUILD);
  if (pause) {
    const live = snapshot.browser
      && ['queued', 'claimed', 'running'].includes(snapshot.browser.status);
    if (live) {
      return decision(STEPS.PAUSE_BUILD, 'a pause command is outstanding and a browser build is live', {
        // WAITING_FOR_BROWSER -> READY_TO_SHOP is a listed move: a request can be
        // released without losing the week. From SHOPPING there is no such edge,
        // so the request is cancelled and the shop stays where it is, resumable.
        to: status === 'WAITING_FOR_BROWSER' ? 'READY_TO_SHOP' : null,
        command: pause,
      });
    }
    // Nothing live to pause - resolve the command rather than leave it nagging.
    return decision(STEPS.PAUSE_BUILD, 'a pause command is outstanding but no browser build is live', {
      to: null, command: pause,
    });
  }

  // ── 5. CORRECTIONS ─────────────────────────────────────────────────────────
  // A correction is a new durable intent against the SAME list, so it is applied
  // before anything is planned from that list.
  const corrections = pendingCommands(snapshot, COMMANDS.CORRECT_LINE);
  if (corrections.length > 0 && shop.list_id !== null && shop.list_id !== undefined) {
    // NO `command` is attached, deliberately. This is the one step that
    // consumes SEVERAL commands, so it resolves them itself - and a command
    // must have exactly one owner for its consumption, or the second attempt
    // fails against shopStore's "only a PENDING action can be resolved" rule.
    return decision(STEPS.APPLY_CORRECTIONS, `${corrections.length} line correction(s) outstanding`);
  }

  // ── 6. THE STAGE TABLE ─────────────────────────────────────────────────────
  switch (status) {
    case 'RECEIVED': {
      // The receipt card asks. Nothing interprets a list, and nothing spends a
      // model call, until Warwick has said go.
      const build = pendingCommand(snapshot, COMMANDS.BUILD_SHOP);
      if (!build) {
        return decision(STEPS.AWAIT_BUILD_COMMAND, 'the list is stored and waiting for "Build this shop"');
      }
      if (shop.source_kind === 'photo') {
        return decision(STEPS.TRANSCRIBE, 'a photo list must be read before it can be interpreted', {
          to: 'TRANSCRIBING', command: build,
        });
      }
      return decision(STEPS.INTERPRET, 'a typed list goes straight to interpretation', {
        to: 'PROCESSING', command: build,
      });
    }

    case 'TRANSCRIBING':
      return decision(STEPS.INTERPRET, 'read the photo against the household catalogue', { to: 'PROCESSING' });

    case 'PROCESSING':
      return decision(STEPS.PLAN, 'plan the list against the rulebook, regulars and the previous order');

    case 'NEEDS_DECISION': {
      if (openQuestions > 0) {
        return decision(STEPS.AWAIT_ANSWERS, `${openQuestions} question(s) are waiting on a human`);
      }
      // Every question is settled. Re-planning (rather than jumping straight to
      // READY_TO_SHOP) is what makes an answer actually change the basket: the
      // planner is re-run with the answers in place, and because openQuestion is
      // idempotent, an already-answered question is never re-asked.
      return decision(STEPS.REPLAN, 'every question is answered - re-plan with the answers in place', {
        to: 'PROCESSING',
      });
    }

    case 'READY_TO_SHOP': {
      const req = pendingCommand(snapshot, COMMANDS.REQUEST_BASKET_BUILD);
      if (!req) {
        return decision(STEPS.AWAIT_BASKET_REQUEST, 'planned and waiting for "Build ASDA basket"');
      }
      return decision(STEPS.QUEUE_BROWSER_BUILD, 'a basket build was asked for', {
        to: 'WAITING_FOR_BROWSER', command: req,
      });
    }

    case 'WAITING_FOR_BROWSER':
      // NOTHING AUTONOMOUS EVER CLAIMS THIS. The browser build is a supervised
      // act performed by a human at the keyboard; the pipeline only records that
      // it was asked for and reports what the runner says it did.
      return decision(STEPS.AWAIT_RUNNER, 'a supervised browser runner has been asked to build the basket');

    case 'SHOPPING':
      return decision(STEPS.AWAIT_BASKET, 'the supervised runner is building the basket');

    case 'BASKET_READY': {
      const sub = pendingCommand(snapshot, COMMANDS.SUBMIT_CONFIRMATION);
      if (!sub) {
        // Warwick checks out himself. AsdAIr waits for the receipt.
        return decision(STEPS.AWAIT_CONFIRMATION,
          'the basket is ready; nothing is ordered until Warwick checks out and forwards the confirmation');
      }
      return decision(STEPS.RECORD_CONFIRMATION, 'an order confirmation has been submitted', {
        to: 'ORDER_CONFIRMATION_RECEIVED', command: sub,
      });
    }

    case 'ORDER_CONFIRMATION_RECEIVED':
      return decision(STEPS.RECONCILE, 'compare what actually arrived against what was planned, and learn from it', {
        to: 'RECONCILED',
      });

    default:
      throw new Error(`stages: no rule for shop status "${status}"`);
  }
}

/**
 * PURE. Where PROCESSING goes once the planner has run.
 *
 * Split out from decideNextStep because it depends on the PLAN, which is not
 * durable state at the moment the step is chosen - it is computed by the step
 * itself. Keeping it pure and separate means the gate is testable on its own.
 *
 * THE INTERPRETATION GATE: a list AsdAIr had to guess at (needs_review) is not
 * declared ready to shop on AsdAIr's own say-so. Either it produced questions -
 * in which case a human is already in the loop - or a human explicitly confirmed
 * the interpretation. `confirmInterpretation` is a LATCH: once issued it stays
 * true for the shop, so consuming the command cannot re-close the gate.
 *
 * ── THE LINE GATE (WP-B15-2), AND WHY IT IS A PARK AND NOT A TRANSITION ─────
 * `'every line is resolved'` used to be an UNCONDITIONAL LITERAL on the
 * fall-through branch: this function consulted no line, only
 * `countOpenQuestions`. So CLOSING A QUESTION - not deciding a line - is what
 * made a shop ready, and a line still `needs_decision` with no matched product
 * passed the moment its question row stopped being open. `unresolvedLines`
 * ends that: the string is now earned rather than asserted.
 *
 * The obvious implementation returns `NEEDS_DECISION` when lines are
 * unresolved. THAT LIVELOCKS THE SHOP, and the loop is exact:
 * `NEEDS_DECISION` with zero open questions -> decideNextStep returns REPLAN ->
 * PROCESSING -> PLAN -> this function -> `NEEDS_DECISION` again, forever,
 * writing a transition event on every pass. `openQuestion` cannot rescue it,
 * because `ON CONFLICT (shop_id, question_key) DO NOTHING` means an already
 * answered question never re-opens.
 *
 * So the unresolved branch PARKS (`to: null`) instead. A park writes no
 * transition and re-runs `stepPlan` on the next pass, which is the same
 * self-healing shape the interpretation gate above already uses and proves.
 * The real exit is upstream: `stepPlan` opens a genuine CLARIFICATION round
 * for each unresolved line BEFORE calling this function, so in the ordinary
 * case `openQuestions` is already non-zero here and the first branch takes it.
 * Reaching the unresolved branch at all means the clarification round could not
 * be opened - a fail-safe, and the shop waits visibly rather than shopping a
 * basket nobody decided.
 */
export function planOutcome({ openQuestions, needsReview, interpretationConfirmed, unresolvedLines = 0 }) {
  if (Number(openQuestions) > 0) {
    return { to: 'NEEDS_DECISION', reason: `${openQuestions} line(s) need a human decision` };
  }
  if (needsReview && !interpretationConfirmed) {
    return {
      to: null,
      step: STEPS.AWAIT_INTERPRETATION_CONFIRMATION,
      reason: 'the list needed review and nobody has confirmed the interpretation yet',
    };
  }
  if (Number(unresolvedLines) > 0) {
    return {
      to: null,
      step: STEPS.AWAIT_LINE_RESOLUTION,
      reason: `${unresolvedLines} line(s) have no structured decision and no open question to settle them`,
    };
  }
  return { to: 'READY_TO_SHOP', reason: 'every line is resolved' };
}
