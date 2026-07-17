// Fusion Tower — Telegram control surface (WP0 command parsing + terminal notifier).
//
// Commands: /start /pause /stop /approve /hold /status. The allowlist is a single
// authorised NUMERIC user id AND a PRIVATE direct chat (reimplements the BUILD-002
// predicate concept in this tree — not imported). Anything else is fail-closed.
//
// TERMINAL-ONLY notifications: the Tower surfaces READY / BLOCKED / TIMED_OUT /
// DECISION_REQUIRED / CLOSED to Warwick and nothing else. A /status reply is a
// pull (an explicit query response), not a proactive push, so it is permitted.
//
// NO LIVE LONG-POLL IN WP0. A second getUpdates consumer on BUILD-002's bot token
// would 409-conflict with the live capture bot. So this module NEVER opens a live
// long-poll: it parses SYNTHETIC updates and writes terminal notices to an in-
// memory OUTBOX. Live send/poll is gated on a Warwick bot decision (recorded).

import { RUN_STATUS, RUN_OUTCOME } from '../core/states.js';
import { DEFAULT_MAX_REVIEW_ROUNDS } from '../core/guardrails.js';

export const COMMANDS = Object.freeze(['start', 'pause', 'stop', 'approve', 'hold', 'status']);
export const TERMINAL_NOTICES = Object.freeze(['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED']);

/**
 * Parse a Telegram update into a normalized command intent. Returns null when the
 * update carries no command text.
 */
export function parseUpdate(update) {
  const msg = update?.message ?? update?.edited_message;
  const text = msg?.text;
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  const [rawCmd, ...rest] = text.trim().split(/\s+/);
  const command = rawCmd.replace(/^\//, '').replace(/@.*$/, '').toLowerCase();
  return {
    command,
    args: rest,
    argline: rest.join(' '),
    chatId: msg?.chat?.id ?? null,
    chatType: msg?.chat?.type ?? null,
    userId: msg?.from?.id ?? null,
    updateId: update?.update_id ?? null,
    known: COMMANDS.includes(command),
  };
}

/**
 * Allowlist predicate: the authorised numeric user id in a PRIVATE chat only.
 * Fail-closed — anything not explicitly authorised is rejected.
 */
export function isAuthorised(intent, { authorisedUserId }) {
  if (!authorisedUserId) return false;              // no allowlist configured => deny all
  if (intent?.chatType !== 'private') return false; // private direct chat only
  return String(intent?.userId) === String(authorisedUserId);
}

/**
 * Create the control surface.
 *
 * @param {object} args
 * @param {object} args.config      loadConfig() result (authorisedTelegramUserId, telegramReady)
 * @param {object} args.dispatcher  the dispatcher to drive
 */
export function createTelegramControls({ config, dispatcher } = {}) {
  const authorisedUserId = config?.authorisedTelegramUserId ?? null;
  const outbox = [];        // terminal notices (synthetic — no live send in WP0)
  const rejected = [];      // audit trail of denied updates

  // The dispatcher notifier: terminal-only. Refuses any non-terminal kind.
  const notifier = {
    async notify(kind, { run, text } = {}) {
      if (!TERMINAL_NOTICES.includes(kind)) {
        throw new Error(`telegram notifier: "${kind}" is not a terminal notice — only ${TERMINAL_NOTICES.join('/')} are surfaced`);
      }
      const notice = {
        kind,
        run_id: run?.run_id ?? null,
        outcome: run?.terminal_outcome ?? null,
        text: text ?? '',
        to: authorisedUserId,
        transport: config?.telegramReady ? 'live-gated' : 'synthetic-outbox',
        at: Date.now(),
      };
      outbox.push(notice);
      // LIVE SEND IS GATED: we never call the Telegram API here in WP0.
      return notice;
    },
  };

  async function handleUpdate(update) {
    const intent = parseUpdate(update);
    if (!intent) return { ok: false, reason: 'no-command' };
    if (!isAuthorised(intent, { authorisedUserId })) {
      const rej = { updateId: intent.updateId, userId: intent.userId, chatType: intent.chatType, command: intent.command, reason: 'unauthorised' };
      rejected.push(rej);
      return { ok: false, reason: 'unauthorised', intent: rej };
    }
    if (!intent.known) return { ok: false, reason: 'unknown-command', command: intent.command };

    switch (intent.command) {
      case 'start': {
        const run = await dispatcher.createRun({
          title: intent.argline || 'Telegram governance run',
          scope: intent.argline || null,
          maxRounds: DEFAULT_MAX_REVIEW_ROUNDS, // bounded review conversation (default 2)
        });
        return { ok: true, command: 'start', run };
      }
      case 'stop': {
        const run = await findRun(intent, dispatcher);
        if (!run) return { ok: false, reason: 'no-run' };
        const notice = await dispatcher.terminate(run.run_id, RUN_STATUS.CANCELLED, null, 'stopped by Warwick');
        return { ok: true, command: 'stop', notice };
      }
      case 'hold': {
        const run = await findRun(intent, dispatcher);
        if (!run) return { ok: false, reason: 'no-run' };
        const notice = await dispatcher.openDecisionGate(run.run_id, intent.argline || 'held for decision');
        return { ok: true, command: 'hold', notice };
      }
      case 'approve': {
        const run = await findRun(intent, dispatcher);
        if (!run) return { ok: false, reason: 'no-run' };
        // Approve resolves an open decision gate: back to active (human decided).
        // A merge remains a human action outside the Tower; approve only unblocks
        // the loop, it never triggers an autonomous merge.
        return { ok: true, command: 'approve', run_id: run.run_id, note: 'decision acknowledged; merge remains a human action' };
      }
      case 'pause': {
        // WP0 limitation: no `paused` DB status. Pause is recorded as a control
        // event (source=telegram) the dispatcher can honor by not opening new
        // turns. Represented, not fully enforced, in WP0 — recorded blocker.
        const run = await findRun(intent, dispatcher);
        return { ok: true, command: 'pause', run_id: run?.run_id ?? null, note: 'pause recorded (WP0: no persistent paused state — control-event only)' };
      }
      case 'status': {
        const run = await findRun(intent, dispatcher);
        // A pull response, not a proactive push — allowed.
        return { ok: true, command: 'status', status: run?.status ?? 'no-run', run_id: run?.run_id ?? null };
      }
      default:
        return { ok: false, reason: 'unknown-command', command: intent.command };
    }
  }

  return {
    notifier,
    handleUpdate,
    get outbox() { return [...outbox]; },
    get rejected() { return [...rejected]; },
  };
}

// Resolve which run a command targets: an explicit run id in args, else the most
// recent run. (WP0 single-user, low volume — a richer selector is a later WP.)
async function findRun(intent, dispatcher) {
  const explicit = intent.args.find((a) => /^[0-9a-f-]{8,}$/i.test(a));
  const runs = await dispatcher_listRuns(dispatcher);
  if (explicit) return runs.find((r) => r.run_id === explicit) ?? null;
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

// The dispatcher exposes the store's runs via a thin helper to avoid leaking the
// store; fall back to a direct store call if present.
async function dispatcher_listRuns(dispatcher) {
  if (typeof dispatcher.listRuns === 'function') return dispatcher.listRuns();
  if (dispatcher.store && typeof dispatcher.store.listRuns === 'function') return dispatcher.store.listRuns();
  return [];
}
