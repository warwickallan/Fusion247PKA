// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/commandNames.js
//
// THE COMMAND VOCABULARY, IN ONE PLACE.
//
// Both halves of the pipeline import it - commands.js (which records them) and
// stages.js (which consumes them) - so the name a Telegram tap writes and the
// name the runner looks for cannot drift apart. Exactly the discipline
// services/asdair/bot/callbackProtocol.js applies to the wire format, applied
// here to the command surface.
//
// ── WHAT IS NOT IN THIS LIST, AND NEVER WILL BE ─────────────────────────────
// There is no checkout, no pay, no order, no slot, no substitute and no
// password command. The command surface is an allowlist: a name that is not
// here cannot be recorded by commands.js (it throws), cannot be returned by
// stages.js, and cannot be dispatched by runPipeline.js. Warwick checks out
// himself, in his own browser, and AsdAIr is told about it afterwards.
//
// invariants.test.js asserts this over the source, not over good intentions.
//
// PURE. No I/O.
// =====================================================================

/**
 * How a command is consumed once the runner has acted on it.
 *
 *   'consume'  the pending record is resolved 'done' when the step succeeds, so
 *              the same command can legitimately be issued again later
 *              (Warwick can ask for a basket build again after a pause).
 *   'latch'    the record is a permanent fact about the shop ("a human approved
 *              this"). Gates that read it ask "was this EVER issued", so
 *              resolving it cannot silently re-close the gate.
 */
export const CONSUMPTION = Object.freeze({ CONSUME: 'consume', LATCH: 'latch' });

export const COMMANDS = Object.freeze({
  RECEIVE_LIST: 'receiveList',
  INTERPRET_LIST: 'interpretList',
  CONFIRM_INTERPRETATION: 'confirmInterpretation',
  CORRECT_LINE: 'correctLine',
  BUILD_SHOP: 'buildShop',
  ANSWER_QUESTION: 'answerQuestion',
  REQUEST_BASKET_BUILD: 'requestBasketBuild',
  PAUSE_BASKET_BUILD: 'pauseBasketBuild',
  SUBMIT_CONFIRMATION: 'submitConfirmation',
  RETRY_STAGE: 'retryStage',
  CANCEL_SHOP: 'cancelShop',
  GET_STATUS: 'getStatus',
});

export const COMMAND_NAMES = Object.freeze(Object.values(COMMANDS));

/**
 * Per-command metadata the rest of the pipeline reads rather than hardcodes.
 *
 * `durable:false` marks the one read-only command. getStatus answers from the
 * status projection and writes nothing at all - recording a durable "somebody
 * looked at the status" row would fill the household's outstanding-actions list
 * with noise, and looking is not an intent to be advanced.
 *
 * `perLine`/`perQuestion` mark the two commands that may legitimately be
 * outstanding more than once at a time for one shop, and therefore carry a
 * discriminator in their durable key.
 */
export const COMMAND_SPECS = Object.freeze({
  [COMMANDS.RECEIVE_LIST]: { durable: true, consumption: CONSUMPTION.LATCH, discriminator: 'sourceId' },
  [COMMANDS.INTERPRET_LIST]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.CONFIRM_INTERPRETATION]: { durable: true, consumption: CONSUMPTION.LATCH, discriminator: null },
  [COMMANDS.CORRECT_LINE]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: 'line' },
  [COMMANDS.BUILD_SHOP]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.ANSWER_QUESTION]: { durable: true, consumption: CONSUMPTION.LATCH, discriminator: 'question' },
  [COMMANDS.REQUEST_BASKET_BUILD]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.PAUSE_BASKET_BUILD]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.SUBMIT_CONFIRMATION]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.RETRY_STAGE]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.CANCEL_SHOP]: { durable: true, consumption: CONSUMPTION.CONSUME, discriminator: null },
  [COMMANDS.GET_STATUS]: { durable: false, consumption: null, discriminator: null },
});

/** PURE. Throws unless `name` is a member of the allowlist. */
export function assertCommandName(name) {
  if (!COMMAND_NAMES.includes(name)) {
    throw new Error(`pipeline: "${String(name)}" is not an AsdAIr command. The surface is an allowlist: ${COMMAND_NAMES.join(', ')}`);
  }
  return name;
}
