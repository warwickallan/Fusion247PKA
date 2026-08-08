// Governance command grammar (BUILD-002 WP2).
//
// PURE classifier: does an authorised private-chat message carry a GOVERNANCE
// command, and if so which? No I/O, no wall-clock, no logging. This module knows
// ONLY the grammar; whether a sender is authorised is the caller's job (the
// detector composes this with the shared authorisePrivateChatSender gate).
//
// SCOPE: WP2 DETECTS governance signals so the sole Telegram poller (the capture
// worker) routes them to the Fusion Tower via a durable ftw.run_event INSTEAD of
// capturing them as notes. WP2 does NOT execute governance — the Tower does.

// The recognised governance command vocabulary (WP2 interface contract).
export const GOVERNANCE_COMMANDS = Object.freeze([
  'status',   // pull a run's status (an explicit query response, not a push)
  'trace',    // request a run trace
  'watch',    // /watch on|milestones|off — set the notification verbosity
  'pause',    // pause a run
  'resume',   // resume a paused run
  'stop',     // stop/cancel a run
  'approve',  // resolve an open human-decision gate (never an autonomous merge)
]);

// Run-start prefixes: RECOGNISED so a `/gov …` or `/run …` message is classified
// as a governance signal (and therefore NOT captured as a note), but run-start
// EXECUTION is the Tower's job. WP2 no-op TODO: we emit the generic command event
// (kind='command:gov' / 'command:run'); the Tower interprets the run-start intent.
export const RUN_START_COMMANDS = Object.freeze(['gov', 'run']);

// /watch takes exactly one of these arguments (validated by the Tower, not here —
// detection stays lenient so a mistyped arg is still recognised as governance and
// never misfiled as a capture).
export const WATCH_ARGS = Object.freeze(['on', 'milestones', 'off']);

/**
 * Parse a message's text into a governance command intent, or null when it is
 * not a governance command (→ the caller treats it as an ordinary capture).
 *
 * @param {unknown} text  the Telegram message text.
 * @returns {{ command:string, args:string[], runStart:boolean } | null}
 */
export function parseGovernanceCommand(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.split(/\s+/);
  // Strip the leading '/', and any '@botname' suffix Telegram appends in groups
  // (harmless here — this BUILD is private-chat only — but keeps the token clean).
  const command = parts[0].slice(1).replace(/@.*$/, '').toLowerCase();
  const args = parts.slice(1);
  if (GOVERNANCE_COMMANDS.includes(command)) {
    return { command, args, runStart: false };
  }
  if (RUN_START_COMMANDS.includes(command)) {
    return { command, args, runStart: true };
  }
  return null;
}

// The Tower's decision cards carry inline-keyboard buttons whose callback_data
// starts with this prefix. Shape: `dec:<gate_token>:<decision>` (the gate token
// itself may contain colons; the decision is the LAST segment).
export const DECISION_PREFIX = 'dec:';

/**
 * Parse an inline-keyboard tap's callback_data into a decision intent, or null
 * when it is not a decision-card tap (→ the caller treats it as an ordinary
 * action-button tap, e.g. SaveToBrain).
 *
 * @param {unknown} callbackData
 * @returns {{ callbackData:string, decision:string, gateToken:string } | null}
 */
export function parseDecisionCallback(callbackData) {
  if (typeof callbackData !== 'string' || !callbackData.startsWith(DECISION_PREFIX)) return null;
  const rest = callbackData.slice(DECISION_PREFIX.length);
  const segments = rest.split(':');
  if (segments.length < 2) {
    // `dec:<token>` with no decision segment — still a decision card, unspecified.
    return { callbackData, decision: '', gateToken: rest };
  }
  const decision = segments[segments.length - 1];
  const gateToken = segments.slice(0, -1).join(':');
  return { callbackData, decision, gateToken };
}
