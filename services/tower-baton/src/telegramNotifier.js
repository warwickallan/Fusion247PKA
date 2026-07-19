// Tower baton — OUTBOUND-ONLY Telegram milestone notifier.
//
// Copied + trimmed from the frozen fusion-tower telegramNotifier.js (no ftw/Supabase
// outbox — dedup lives in the local durable state instead). OUTBOUND ONLY: this calls
// Telegram `sendMessage` and NOTHING else. It NEVER calls getUpdates / long-polls —
// the BUILD-002 capture worker holds the SOLE inbound poll on the bot token; a second
// getUpdates would 409-conflict.
//
// MILESTONES, NOT A CONSOLE. Only milestone events notify (watcher online/recovered,
// a verdict posted, an escalation, a blocker, TOWER_UNAVAILABLE). Internal file/test
// chatter never notifies — `notifyMilestone` drops any purpose not on MILESTONES.
//
// DEDUP. The per-event dedup key (source|purpose|checkpoint/run) is recorded in the
// durable state so the same milestone never double-notifies across restarts.
//
// SECRET DISCIPLINE. TELEGRAM_BOT_TOKEN travels ONLY in the request URL to
// api.telegram.org. It is NEVER logged, stored, or placed in a message body; every
// error path scrubs it.

import crypto from 'node:crypto';

// The milestone vocabulary. A purpose NOT in here is internal chatter → not notified.
export const MILESTONES = Object.freeze([
  'watcher_online',
  'watcher_recovered',
  'review_posted',      // a [TOWER → LARRY] verdict was posted to the thread
  'escalation',         // DECISION_REQUIRED / max-rounds
  'blocked',            // BLOCKED verdict / fail-closed
  'tower_unavailable',  // handoff timeout — Larry must HALT
  'clickup_token_missing',
]);

export const LOGICAL_SOURCES = Object.freeze(['TOWER', 'CODEX', 'FABLE', 'LARRY', 'CI']);

function sha256hex(s) { return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'); }

export function computeDedupKey({ purpose, checkpointId = '', extra = '' }) {
  return sha256hex(`${purpose}|${checkpointId}|${extra}`);
}

export function wireText(logicalSource, body) { return `[${logicalSource}] ${body}`; }

/** Replace every occurrence of the bot token with a mask (defence-in-depth). */
export function scrubToken(text, token) {
  const s = String(text ?? '');
  if (!token) return s;
  return s.split(token).join('***telegram-bot-token(masked)***');
}

/** A minimal REAL Telegram client — OUTBOUND sendMessage ONLY. */
export function createTelegramClient({ config, fetchImpl } = {}) {
  const token = config?.telegramBotToken ?? null;                 // SECRET — never logged
  const defaultChatId = config?.authorisedTelegramUserId ?? null; // POINTER — safe
  const doFetch = fetchImpl ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  return {
    get ready() { return Boolean(token && defaultChatId); },
    /**
     * Masked outbound self-test: GET getMe (NOT getUpdates — no inbound poll, no 409).
     * Confirms the FusionDevBot credential can reach Telegram WITHOUT revealing it.
     * Returns { ok, botId } — never the token. Used by the launcher pre-flight only.
     */
    async verifyOutbound() {
      if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN unset (masked)' };
      if (!doFetch) return { ok: false, error: 'no fetch implementation' };
      try {
        const res = await doFetch(`https://api.telegram.org/bot${token}/getMe`, { method: 'GET' });
        let data = null; try { data = await res.json(); } catch { data = null; }
        if (!res.ok || !data?.ok) return { ok: false, error: scrubToken(data?.description ?? `http ${res?.status ?? '?'}`, token) };
        return { ok: true, botId: String(data?.result?.id ?? '') };
      } catch (err) {
        return { ok: false, error: scrubToken(err?.message ?? String(err), token) };
      }
    },
    async sendMessage(recipient, text) {
      if (!token) throw new Error('telegramClient: TELEGRAM_BOT_TOKEN is unset (masked) — cannot send');
      if (!doFetch) throw new Error('telegramClient: no fetch implementation available');
      const chatId = recipient ?? defaultChatId;
      if (!chatId) throw new Error('telegramClient: no recipient chat id (AUTHORISED_TELEGRAM_USER_ID unset)');
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      let res;
      try {
        res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
      } catch (err) {
        throw new Error(`telegramClient: sendMessage transport error: ${scrubToken(err?.message ?? String(err), token)}`);
      }
      let data = null; try { data = await res.json(); } catch { data = null; }
      if (!res.ok || !data?.ok) throw new Error(`telegramClient: sendMessage rejected: ${scrubToken(data?.description ?? `http ${res?.status ?? '?'}`, token)}`);
      const messageId = data?.result?.message_id;
      if (messageId === undefined || messageId === null) throw new Error('telegramClient: sendMessage returned no message_id');
      return { ok: true, message_id: String(messageId), chatId: String(chatId) };
    },
  };
}

/**
 * Create the milestone notifier. Dedup is backed by the durable `state` (isNotified /
 * recordNotified). A non-milestone purpose is silently dropped (no console spam). An
 * outage never throws out of the caller — a failed send is reported, not fatal.
 *
 * @param {object} args
 * @param {object} args.config          loadConfig() result (token owner + recipient)
 * @param {object} args.state           openState() result (dedup cache)
 * @param {object} [args.client]        inject a client (tests pass a fake; NO live send)
 * @param {function} [args.fetchImpl]   injectable fetch for the default real client
 */
export function createMilestoneNotifier({ config, state, client, fetchImpl } = {}) {
  const recipient = config?.authorisedTelegramUserId ?? null;
  const impl = client ?? createTelegramClient({ config, fetchImpl });

  return {
    recipient,
    client: impl,
    MILESTONES,
    get ready() { return Boolean(impl?.ready); },

    /**
     * Notify a milestone. Returns { sent, skipped?, deduped?, error? }. NEVER throws.
     *   · purpose not a milestone  → { sent:false, skipped:'not-a-milestone' }
     *   · already notified (dedup) → { sent:false, deduped:true }
     *   · not ready (no token)     → { sent:false, skipped:'not-ready' }
     */
    async notifyMilestone({ purpose, logicalSource = 'TOWER', body, checkpointId = '', extra = '' } = {}) {
      if (!MILESTONES.includes(purpose)) return { sent: false, skipped: 'not-a-milestone' };
      if (!LOGICAL_SOURCES.includes(logicalSource)) return { sent: false, skipped: 'bad-source' };
      const dedupKey = computeDedupKey({ purpose, checkpointId, extra });
      if (state?.isNotified?.(dedupKey)) return { sent: false, deduped: true, dedupKey };
      if (!impl?.ready) {
        // Not ready is not an error — record nothing so a later ready run can still send.
        return { sent: false, skipped: 'not-ready', dedupKey };
      }
      try {
        const res = await impl.sendMessage(recipient, wireText(logicalSource, body));
        state?.recordNotified?.(dedupKey);
        return { sent: true, dedupKey, messageId: res.message_id };
      } catch (err) {
        // Outage → do NOT record; a later run retries. The token is already scrubbed.
        return { sent: false, error: String(err?.message ?? err), dedupKey };
      }
    },
  };
}
