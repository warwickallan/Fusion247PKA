// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/telegramAdapter.js
//
// THE THIN CHANNEL ADAPTER. It turns one routed Telegram intent into one CALL
// ON THE COMMAND SURFACE - and contains no logic of its own beyond that
// translation.
//
// This file is where "Telegram and the Cockpit both drive the SAME commands"
// is actually true. Every tap on Warwick's phone becomes a member of
// commandNames.COMMANDS, recorded in the same durable ledger the Cockpit
// writes to, advanced by the same runner. There is no Telegram-only code path,
// no Telegram-only state and no Telegram-only decision.
//
// ── WHAT IT REFUSES, AND WHY THAT IS RIGHT ──────────────────────────────────
// Some buttons on the control surface are not commands at all - "Search ASDA"
// is a supervised browser act, "Send order confirmation" is a PROMPT asking
// Warwick to forward an email. Mapping them onto the nearest-looking command
// would be a guess with real consequences (mapping "Close shop" onto
// cancelShop, say, would throw away a finished week's record). So they return a
// STRUCTURED REFUSAL carrying an honest reason, which the caller answers the tap
// with. Nothing is guessed.
//
// PURE. No I/O, no clock, no randomness - it maps an intent onto a call.
// =====================================================================

import { COMMANDS } from './commandNames.js';

/** Why an intent did not become a command. Frozen so a caller can switch on it. */
export const ADAPTER_REFUSALS = Object.freeze({
  NO_SHOP: 'the tap carried no shop reference',
  NOT_A_COMMAND: 'that button is not a command - it is answered by the runner or by a human',
  BAD_ANSWER_ARG: 'the answer payload did not name a question',
  UNKNOWN_ACTION: 'unknown action',
});

function refuse(reason, detail = null) {
  return { ok: false, reason, detail };
}

/**
 * Map one routed intent (services/asdair/bot/inboundRouter.js) onto a command.
 *
 * @param {{action:string, shopRef:string|null, arg:string|null, responder:string, raw:object}} intent
 * @param {{parseAnswerArg:Function, resolveCandidate?:Function}} deps
 *        `parseAnswerArg` is callbackProtocol's own inverse, injected so the
 *        wire format has exactly one owner. `resolveCandidate(shopRef,
 *        questionKey, index)` turns the candidate INDEX that travels on the
 *        button back into the product text - the caller persisted that ordered
 *        list when it rendered the card, so only the caller can do it.
 * @returns {{ok:true, command:string, spec:object}|{ok:false, reason:string}}
 */
export function intentToCommand(intent, deps = {}) {
  if (!intent || intent.ok === false) return refuse(ADAPTER_REFUSALS.UNKNOWN_ACTION, intent && intent.reason);
  const actor = intent.responder || 'telegram:unknown';
  const shopRef = intent.shopRef;

  // Every command names a shop. A tap that does not is refused rather than
  // applied to "the latest" one - guessing which week a button meant is exactly
  // how you cancel the wrong shop.
  const needsShop = () => (shopRef ? null : refuse(ADAPTER_REFUSALS.NO_SHOP));

  switch (intent.action) {
    case 'build': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.BUILD_SHOP, spec: { shopRef, actor } };
    }
    case 'cancel': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.CANCEL_SHOP, spec: { shopRef, actor, reason: 'cancelled from Telegram' } };
    }
    case 'basket': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.REQUEST_BASKET_BUILD, spec: { shopRef, actor } };
    }
    case 'pause': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.PAUSE_BASKET_BUILD, spec: { shopRef, actor } };
    }
    case 'retry': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.RETRY_STAGE, spec: { shopRef, actor } };
    }
    case 'review': {
      const bad = needsShop(); if (bad) return bad;
      // "Review list" is a read. Confirming what was read is a separate,
      // deliberate act (confirmInterpretation) so a glance can never be
      // mistaken for an approval.
      return { ok: true, command: COMMANDS.GET_STATUS, spec: { shopRef, actor } };
    }
    case 'status':
    case 'held':
    case 'exceptions': {
      const bad = needsShop(); if (bad) return bad;
      return { ok: true, command: COMMANDS.GET_STATUS, spec: { shopRef, actor, view: intent.action } };
    }
    case 'skip': {
      const bad = needsShop(); if (bad) return bad;
      if (!intent.arg) return refuse(ADAPTER_REFUSALS.BAD_ANSWER_ARG);
      // "Skip this week" IS an answer - a real one ("leave it"). It settles the
      // question exactly as a chosen candidate does, so it can never be re-asked.
      return { ok: true, command: COMMANDS.ANSWER_QUESTION, spec: { shopRef, actor, questionKey: intent.arg, skip: true, answerSource: 'button' } };
    }
    case 'answer': {
      const bad = needsShop(); if (bad) return bad;
      if (!intent.arg) {
        // No arg means "open the question queue" - a read, not a decision.
        return { ok: true, command: COMMANDS.GET_STATUS, spec: { shopRef, actor, view: 'questions' } };
      }
      if (intent.raw && intent.raw.kind === 'reply') {
        // A TYPED reply. `arg` is the question, and the text is passed through
        // verbatim - deciding which candidate the words mean is a decision the
        // router deliberately did not make, and neither does this adapter: the
        // human's own words become the answer.
        return {
          ok: true,
          command: COMMANDS.ANSWER_QUESTION,
          spec: { shopRef, actor, questionKey: intent.arg, answerText: intent.raw.text, answerSource: 'typed' },
        };
      }
      const parsed = deps.parseAnswerArg ? deps.parseAnswerArg(intent.arg) : { ok: false };
      if (!parsed.ok) return refuse(ADAPTER_REFUSALS.BAD_ANSWER_ARG, intent.arg);
      const label = deps.resolveCandidate
        ? deps.resolveCandidate(shopRef, parsed.questionKey, parsed.candidateIndex)
        : null;
      if (!label) {
        // The index travels, not the product id - so an index the caller can no
        // longer resolve is refused rather than answered with a number.
        return refuse(ADAPTER_REFUSALS.BAD_ANSWER_ARG, `candidate ${parsed.candidateIndex} of ${parsed.questionKey} could not be resolved`);
      }
      return {
        ok: true,
        command: COMMANDS.ANSWER_QUESTION,
        spec: { shopRef, actor, questionKey: parsed.questionKey, answerText: label, answerSource: 'button' },
      };
    }
    case 'search':
      // Searching ASDA is a SUPERVISED browser act. There is no command for it,
      // deliberately: nothing in this pipeline drives a browser.
      return refuse(ADAPTER_REFUSALS.NOT_A_COMMAND, 'searching ASDA is a supervised browser step, not a pipeline command');
    case 'confirm':
      // A PROMPT, not an action: it asks Warwick to forward the ASDA email.
      // The email itself arrives as a message and becomes submitConfirmation.
      return refuse(ADAPTER_REFUSALS.NOT_A_COMMAND, 'forward the ASDA confirmation email to ShopperBot and it will be recorded');
    case 'close':
      // Deliberately NOT mapped onto cancelShop. Cancelling a reconciled week
      // would throw away the record the whole build exists to keep.
      return refuse(ADAPTER_REFUSALS.NOT_A_COMMAND, 'a shop closes itself when it reconciles; there is nothing to close by hand');
    default:
      return refuse(ADAPTER_REFUSALS.UNKNOWN_ACTION, intent.action);
  }
}
