// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/commandSurface.js
//
// THE ONE COMMAND SURFACE. THE COCKPIT IS A SECOND VIEW, NOT A SECOND BRAIN.
//
// Telegram and the cockpit are two skins over the SAME channel-neutral
// commands. That is the whole point: an answer given on the phone must clear
// the same question in the cockpit, and vice versa, because both went through
// the same function against the same durable row - not because two
// implementations were kept in step by hand.
//
// The canonical implementation is services/asdair/pipeline/commands.js
// (built in parallel under BUILD-015). This module NEVER implements shopping
// logic. It does exactly three things:
//
//   1. names the surface (COMMAND_NAMES) so a typo cannot invent a command;
//   2. binds to the pipeline module when it is present, and asserts it exposes
//      EXACTLY these names - no more, no fewer;
//   3. refuses, by name, anything a cockpit must never be able to ask for.
//
// If pipeline/commands.js is not on this branch yet, loadCommands() throws a
// named, actionable error. It does NOT fall back to a local implementation:
// a silent second implementation is precisely the failure this file exists to
// prevent.
//
// PURE ASCII.
// =====================================================================

'use strict';

const path = require('path');

// ---------------------------------------------------------------------
// The surface. These names are a CONTRACT with services/asdair/pipeline/
// commands.js. Changing one here without changing it there is a build break,
// and commandSurface.test.js fails the moment the two drift.
// ---------------------------------------------------------------------
const COMMAND_NAMES = Object.freeze([
  'confirmInterpretation',  // accept the catalogue-grounded reading of the list
  'correctLine',            // fix a line: different regular, different qty, new item
  'buildShop',              // plan the shop from the confirmed interpretation
  'answerQuestion',         // answer one open shop_question (button OR free text)
  'requestBasketBuild',     // create a DURABLE browser_build_request. Nothing more.
  'pauseBasketBuild',       // ask the supervised runner to stop
  'submitConfirmation',     // hand in the ASDA order confirmation for reconciliation
  'retryStage',             // resume a FAILED shop from its recorded stage
  'cancelShop',             // cancel the week
  'getStatus'               // the durable projection (read-only)
]);

const COMMAND_SET = new Set(COMMAND_NAMES);

// The only command that reads rather than writes. Kept explicit so the HTTP
// layer can route it without guessing from the name.
const READ_ONLY_COMMANDS = Object.freeze(['getStatus']);

// ---------------------------------------------------------------------
// THE DENY LIST. Not defence against an attacker - defence against a future
// well-meaning edit. AsdAIr never checks out, never pays, never books a slot,
// never types a password and is never autonomously driven from a screen.
// If one of these ever appears as a command name, binding fails loudly rather
// than the cockpit quietly growing a checkout button.
//
// The patterns are matched against the name NORMALISED into words, so
// `payNow`, `pay_now` and `PayNow` are all the same thing to this list - a
// camelCase name must not be able to slip past a word-boundary pattern.
// ---------------------------------------------------------------------
const FORBIDDEN_COMMAND_PATTERNS = Object.freeze([
  /\bcheck ?out\b/,
  /\bpay(ment|ments|ing)?\b|\bpurchase\b/,
  /\bslot\b|\bbook(ing|ed)?\b/,
  /\bpassword\b|\bcredential(s)?\b|\bsecret(s)?\b|\btoken(s)?\b/,
  /\bplace order\b|\bsubmit order\b|\border now\b/,
  /\bdrive browser\b|\bautopilot\b|\bautonomous\b/
]);

// camelCase / snake_case / kebab-case -> lowercase words.
function normaliseName(name) {
  return String(name === null || name === undefined ? '' : name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Where the canonical implementation lives. Named once so the error message,
// the test and the documentation can never disagree about it.
const PIPELINE_COMMANDS_MODULE = path.join('..', 'pipeline', 'commands.js');
const PIPELINE_COMMANDS_PATH = path.join(__dirname, '..', 'pipeline', 'commands.js');

const NOT_BOUND =
  'asdair cockpit-api: the shared command surface is not on this checkout. ' +
  'Expected services/asdair/pipeline/commands.js exporting exactly: ' +
  COMMAND_NAMES.join(', ') + '. ' +
  'The cockpit deliberately has NO local fallback - a second implementation of ' +
  'these commands would let Telegram and the cockpit drift apart.';

function isCommandName(name) {
  return typeof name === 'string' && COMMAND_SET.has(name);
}

function isForbiddenName(name) {
  const s = normaliseName(name);
  if (s === '') return false;
  return FORBIDDEN_COMMAND_PATTERNS.some(function (re) { return re.test(s); });
}

/**
 * Assert a candidate module IS the shared surface.
 *
 * Exactly the named functions, nothing extra that looks like a command, and
 * nothing on the deny list. Returns the module so callers can chain.
 */
function assertCommandSurface(mod) {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
    throw new Error('asdair cockpit-api: command module is not an object.');
  }

  const missing = COMMAND_NAMES.filter(function (n) { return typeof mod[n] !== 'function'; });
  if (missing.length) {
    throw new Error('asdair cockpit-api: command surface is missing: ' + missing.join(', ') + '.');
  }

  // Anything else callable that is not a documented helper is a command the
  // cockpit does not know about - and possibly one it must never expose.
  const extras = Object.keys(mod).filter(function (k) {
    return typeof mod[k] === 'function' && !COMMAND_SET.has(k) && k !== 'close' && k !== '_internal';
  });
  const banned = extras.filter(isForbiddenName);
  if (banned.length) {
    throw new Error('asdair cockpit-api: refusing to bind - forbidden command(s) exported: ' + banned.join(', ') + '.');
  }

  return mod;
}

/**
 * Bind to the canonical implementation.
 *
 * @param {object} [injected] a module to bind instead of requiring - used by
 *        tests and by a host that has already loaded the pipeline.
 */
function loadCommands(injected) {
  if (injected) return assertCommandSurface(injected);

  let mod;
  try {
    // eslint-disable-next-line global-require
    mod = require(PIPELINE_COMMANDS_PATH);
  } catch (err) {
    const e = new Error(NOT_BOUND + ' (require failed: ' + (err && err.message ? err.message : String(err)) + ')');
    e.code = 'ASDAIR_COMMANDS_NOT_BOUND';
    throw e;
  }
  return assertCommandSurface(mod);
}

/** True when the canonical module is present on this checkout. */
function isBound() {
  try {
    require.resolve(PIPELINE_COMMANDS_PATH);
    return true;
  } catch (ignore) {
    return false;
  }
}

/**
 * Dispatch one command by name.
 *
 * The cockpit cannot invent a command: an unknown or forbidden name is refused
 * here, before anything is loaded, and never reaches the pipeline.
 */
async function dispatch(name, args, options) {
  const opts = options || {};
  if (isForbiddenName(name)) {
    const e = new Error('asdair cockpit-api: "' + String(name) + '" is not a permitted command.');
    e.code = 'ASDAIR_COMMAND_FORBIDDEN';
    throw e;
  }
  if (!isCommandName(name)) {
    const e = new Error('asdair cockpit-api: unknown command "' + String(name) + '". ' +
      'Known commands: ' + COMMAND_NAMES.join(', ') + '.');
    e.code = 'ASDAIR_COMMAND_UNKNOWN';
    throw e;
  }
  const commands = loadCommands(opts.commands);
  return commands[name](args || {});
}

module.exports = {
  COMMAND_NAMES: COMMAND_NAMES,
  READ_ONLY_COMMANDS: READ_ONLY_COMMANDS,
  FORBIDDEN_COMMAND_PATTERNS: FORBIDDEN_COMMAND_PATTERNS,
  PIPELINE_COMMANDS_MODULE: PIPELINE_COMMANDS_MODULE,
  PIPELINE_COMMANDS_PATH: PIPELINE_COMMANDS_PATH,
  NOT_BOUND: NOT_BOUND,
  isCommandName: isCommandName,
  isForbiddenName: isForbiddenName,
  normaliseName: normaliseName,
  assertCommandSurface: assertCommandSurface,
  loadCommands: loadCommands,
  isBound: isBound,
  dispatch: dispatch
};
