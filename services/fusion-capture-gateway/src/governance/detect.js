// Governance-detection seam (BUILD-002 WP2).
//
// The ADDITIVE pre-check the sole Telegram poller runs on every inbound update
// BEFORE treating it as a capture. It classifies an update as one of:
//
//   'gov_command'  — an authorised private-chat message matching the governance
//                    grammar (/status, /trace, /watch, /pause, /resume, /stop,
//                    /approve, and the /gov|/run run-start prefix). NOT captured.
//   'gov_decision' — an authorised private-chat inline-keyboard tap whose
//                    callback_data starts 'dec:' (a Tower decision card). NOT
//                    captured; answered so Telegram stops the button spinner.
//   'capture'      — anything else that reaches the message/callback paths,
//                    including UNAUTHORISED or NON-PRIVATE updates. These fall
//                    through to the UNCHANGED capture behaviour, which applies
//                    the SAME default-deny and stays quiet. No governance oracle
//                    is ever offered to a stranger: auth runs FIRST, and a failed
//                    auth returns 'capture' WITHOUT parsing the command.
//   'ignore'       — an update that is neither a message nor a callback_query.
//
// REUSE, not duplicate: authority is the SHARED authorisePrivateChatSender gate
// (the same allowlist + private-direct-chat predicate the capture mapping uses),
// and the grammar is the shared commandGrammar module.

import { authorisePrivateChatSender } from '../adapters/telegramMapping.js';
import { parseGovernanceCommand, parseDecisionCallback } from './commandGrammar.js';

/**
 * @param {object} args
 * @param {object} args.update            a Telegram update.
 * @param {string|number} args.authorisedUserId  the single allowlisted numeric id.
 * @returns {{ kind:'capture'|'gov_command'|'gov_decision'|'ignore', [k:string]:any }}
 */
export function classifyUpdate({ update, authorisedUserId } = {}) {
  if (!update || typeof update !== 'object') return { kind: 'ignore' };

  // ── MESSAGE path ──────────────────────────────────────────────────────────
  if (update.message && typeof update.message === 'object') {
    const message = update.message;
    const auth = authorisePrivateChatSender({
      from: message.from, chat: message.chat, authorisedUserId,
    });
    // Not an authorised private-chat sender → NOT a governance signal. Hand back
    // to the capture path (which default-denies, quietly). No command parse.
    if (!auth.ok) return { kind: 'capture' };
    const gov = parseGovernanceCommand(message.text);
    if (!gov) return { kind: 'capture' };
    return {
      kind: 'gov_command',
      senderId: auth.senderId,
      chatId: (message.chat && message.chat.id !== undefined) ? String(message.chat.id) : auth.senderId,
      updateId: update.update_id,
      command: gov.command,
      args: gov.args,
      runStart: gov.runStart === true,
    };
  }

  // ── CALLBACK path ─────────────────────────────────────────────────────────
  if (update.callback_query && typeof update.callback_query === 'object') {
    const cq = update.callback_query;
    const msg = (cq.message && typeof cq.message === 'object') ? cq.message : {};
    const auth = authorisePrivateChatSender({
      from: cq.from, chat: msg.chat, authorisedUserId,
    });
    // Unauthorised / non-private tap → capture path (its own quiet default-deny).
    if (!auth.ok) return { kind: 'capture' };
    const decision = parseDecisionCallback(cq.data);
    // Not a 'dec:' tap → an ordinary action-button tap (SaveToBrain/KeepRaw/…).
    if (!decision) return { kind: 'capture' };
    return {
      kind: 'gov_decision',
      senderId: auth.senderId,
      chatId: (msg.chat && msg.chat.id !== undefined) ? String(msg.chat.id) : auth.senderId,
      messageId: msg.message_id,
      callbackId: cq.id,
      callbackData: decision.callbackData,
      decision: decision.decision,
      gateToken: decision.gateToken,
    };
  }

  return { kind: 'ignore' };
}
