// Fusion Tower — durable, retry-safe OUTBOUND Telegram notifier (BUILD-010 WP1),
// wired onto Silas's notification outbox (migration 0004 / ftw.notification_outbox).
//
// OUTBOUND ONLY. This module calls the Telegram Bot API `sendMessage` and NOTHING
// ELSE. It NEVER calls getUpdates / opens a long-poll: the BUILD-002 capture worker
// holds the SOLE inbound poll on the bot token, and a second getUpdates consumer
// would 409-conflict. Notifications are one-way pushes to the authorised chat id.
//
// The reliability contract (closes migration 0004's four failure modes):
//   ENQUEUE-BEFORE-SEND — a milestone is durably ENQUEUED (state 'pending') BEFORE
//     any bot send. If Telegram is down or the process crashes, the row survives.
//   DEDUP — the per-EVENT dedup key (run+purpose+recipient+source) makes enqueue
//     idempotent: the same milestone never double-notifies.
//   RETRY-SAFE / NO-LOSS — on a transient send failure the drainer LEAVES the row
//     'pending' (the schema's retriable queue — only 'pending' is claimed), so a
//     later drainOnce re-sends it. A message is NEVER lost to a temporary outage.
//     'failed' is reserved for a bounded TERMINAL give-up (poison-pill guard).
//   SENT-WITH-PROOF — a row reaches 'sent' ONLY once a real Telegram message_id is
//     recorded (store invariant + DB CHECK).
//
// SECRET DISCIPLINE. The bot TOKEN lives ONLY in config (env name TELEGRAM_BOT_TOKEN)
// and only ever travels in the request URL to api.telegram.org. It is NEVER logged,
// NEVER stored, NEVER placed in a notification body or a row's last_error. Every
// error path scrubs the token before it can surface. The outbox stores POINTERS
// only: the recipient (authorised chat id) and the logical_source TAG — never the
// credential.

import crypto from 'node:crypto';
import { scanForSecrets } from './clickupPoster.js';

// The message-identity TAG vocabulary (mirrors the 0004 logical_source CHECK).
export const LOGICAL_SOURCES = Object.freeze(['TOWER', 'CODEX', 'LARRY', 'CI']);

const DEFAULT_DRAIN_LIMIT = 20;
// Bounded give-up: after this many consecutive failed sends for one row the drainer
// records a durable 'failed' (poison-pill guard). Below it, the row stays 'pending'
// and is retried — so a normal transient outage never gives up. Per-process count
// (an attempts Map); a restart resets it, favouring delivery over give-up.
const DEFAULT_MAX_ATTEMPTS = 6;

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

/**
 * The per-EVENT dedup key: sha256(runId | purpose | recipient | logicalSource).
 * Composed app-side; its UNIQUE column (0004) is what makes enqueue idempotent.
 */
export function computeDedupKey({ runId, purpose, recipient, logicalSource }) {
  return sha256hex(`${runId ?? ''}|${purpose}|${recipient}|${logicalSource}`);
}

/** The wire text carries the message-identity TAG: `[<logical_source>] <body>`. */
export function wireText(logicalSource, body) {
  return `[${logicalSource}] ${body}`;
}

/**
 * Replace every occurrence of the bot token with a mask so it can NEVER reach a log,
 * an error message, a stored last_error, or a message body. Defence-in-depth: the
 * client already avoids putting the token in any error, this is the backstop.
 */
export function scrubToken(text, token) {
  const s = String(text ?? '');
  if (!token) return s;
  return s.split(token).join('***telegram-bot-token(masked)***');
}

/**
 * A minimal REAL Telegram client — OUTBOUND sendMessage ONLY. Reads the credential
 * owner (TELEGRAM_BOT_TOKEN) and the default recipient (AUTHORISED_TELEGRAM_USER_ID)
 * from config by env NAME. The token is NEVER logged and NEVER appears in a thrown
 * error (every error is scrubbed).
 *
 * @param {object} args
 * @param {object} args.config    loadConfig() result (telegramBotToken, authorisedTelegramUserId)
 * @param {function} [args.fetchImpl]  injectable fetch (defaults to global fetch)
 */
export function createTelegramClient({ config, fetchImpl } = {}) {
  const token = config?.telegramBotToken ?? null;                 // SECRET — never logged
  const defaultChatId = config?.authorisedTelegramUserId ?? null; // POINTER — safe
  const doFetch = fetchImpl
    ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);

  return {
    get ready() { return Boolean(token && defaultChatId); },

    /**
     * OUTBOUND ONLY. POST sendMessage to the authorised chat. Returns
     * { ok, message_id, chatId } on success; throws a token-scrubbed error otherwise.
     */
    async sendMessage(recipient, text) {
      if (!token) throw new Error('telegramClient: TELEGRAM_BOT_TOKEN is unset (masked) — cannot send');
      if (!doFetch) throw new Error('telegramClient: no fetch implementation available');
      const chatId = recipient ?? defaultChatId;
      if (!chatId) throw new Error('telegramClient: no recipient chat id (AUTHORISED_TELEGRAM_USER_ID unset)');

      // The token travels ONLY here, in the URL to api.telegram.org. It is never
      // interpolated into any log line or thrown error.
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      let res;
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        });
      } catch (err) {
        // undici can embed the request URL (with the token) in the error/cause —
        // scrub before it can surface anywhere.
        throw new Error(`telegramClient: sendMessage transport error: ${scrubToken(err?.message ?? String(err), token)}`);
      }

      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok || !data?.ok) {
        const desc = scrubToken(data?.description ?? `http ${res?.status ?? '?'}`, token);
        throw new Error(`telegramClient: sendMessage rejected: ${desc}`);
      }
      const messageId = data?.result?.message_id;
      if (messageId === undefined || messageId === null) {
        throw new Error('telegramClient: sendMessage returned no message_id');
      }
      return { ok: true, message_id: String(messageId), chatId: String(chatId) };
    },
  };
}

/**
 * Durable ENQUEUE at a milestone — NO send. App-side secret-scan (belt; the DB CHECK
 * is the suspenders) → compute dedupKey → enqueueNotification. Idempotent on the
 * dedup key. Returns the store result plus { dedupKey }.
 */
export async function enqueue(store, {
  runId, recipient, logicalSource, purpose, body,
}, opts = {}) {
  if (!recipient) return { enqueued: false, skipped: 'no-recipient' };
  if (!LOGICAL_SOURCES.includes(logicalSource)) {
    throw new Error(`telegramNotifier.enqueue: invalid logical_source "${logicalSource}"`);
  }
  if (!purpose) throw new Error('telegramNotifier.enqueue: purpose required');
  if (typeof body !== 'string' || body.length === 0) {
    throw new Error('telegramNotifier.enqueue: non-empty body required');
  }
  // APP-SIDE SECRET SCAN — refuse to enqueue a token-shaped body (belt). The DB
  // CHECK notification_outbox_body_no_token_chk is the independent DB backstop.
  const scan = scanForSecrets(body);
  if (!scan.clean) {
    throw new Error(
      `telegramNotifier: refusing to enqueue — body contains secret-shaped content `
      + `[${scan.hits.join(', ')}] (a token can NEVER be enqueued or sent)`,
    );
  }
  const dedupKey = computeDedupKey({ runId, purpose, recipient, logicalSource });
  const r = await store.enqueueNotification(
    { dedupKey, runId, recipient, logicalSource, purpose, body },
    { now: opts.now },
  );
  return { ...r, dedupKey };
}

/**
 * Drain the pending backlog ONCE. Claims pending rows (oldest first), sends each via
 * the OUTBOUND client, and records the outcome durably:
 *   · success            → markNotificationSent(dedupKey, message_id)
 *   · transient failure  → LEAVE the row 'pending' (re-claimable → retried; NO loss)
 *   · give-up (bounded)  → markNotificationFailed(dedupKey, err) after maxAttempts
 * NEVER throws out of the loop — one bad row can't stall the rest.
 *
 * @param {object} store            memoryStore | postgresStore
 * @param {object} telegramClient   { sendMessage(recipient, text) => { message_id } }
 * @param {object} [opts]
 * @param {number} [opts.limit]        max rows to claim this pass (default 20)
 * @param {number} [opts.maxAttempts] consecutive failures before a durable give-up
 * @param {Map}    [opts.attempts]    per-process attempt counter (dedupKey -> count)
 * @param {number} [opts.now]         injectable clock (epoch ms)
 * @returns {Promise<{ sent:number, failed:number, retriable:number }>}
 */
export async function drainOnce(store, telegramClient, opts = {}) {
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.floor(opts.limit) : DEFAULT_DRAIN_LIMIT;
  const maxAttempts = Number.isFinite(opts.maxAttempts) && opts.maxAttempts > 0
    ? Math.floor(opts.maxAttempts) : DEFAULT_MAX_ATTEMPTS;
  const attempts = opts.attempts instanceof Map ? opts.attempts : new Map();

  const pending = await store.claimPendingNotifications(limit);
  let sent = 0;
  let failed = 0;
  let retriable = 0;

  for (const n of pending) {
    const text = wireText(n.logical_source, n.body);
    try {
      const res = await telegramClient.sendMessage(n.recipient, text);
      const messageId = String(res?.message_id ?? '');
      if (!messageId) throw new Error('send returned no message_id');
      // SENT-WITH-PROOF: only ever reaches 'sent' with a real message_id.
      await store.markNotificationSent(n.dedup_key, messageId, { now: opts.now });
      attempts.delete(n.dedup_key);
      sent += 1;
    } catch (err) {
      // The client already scrubs the token from its errors; wrap defensively.
      const scrubbed = new Error(String(err?.message ?? err));
      const tries = (attempts.get(n.dedup_key) ?? 0) + 1;
      attempts.set(n.dedup_key, tries);
      if (tries >= maxAttempts) {
        // Bounded TERMINAL give-up — durable 'failed' (non-claimable) poison guard.
        await store.markNotificationFailed(n.dedup_key, scrubbed, { now: opts.now });
        attempts.delete(n.dedup_key);
        failed += 1;
      } else {
        // TRANSIENT: leave the row 'pending' → re-claimed & re-sent by a later
        // drainOnce. The milestone is NOT lost to a temporary Telegram outage.
        retriable += 1;
      }
    }
  }
  return { sent, failed, retriable };
}

/**
 * Bind a durable notifier to config (recipient + credential owner) and a client.
 * The dispatcher uses `enqueue` at milestones (durable, no send, never blocks the
 * loop); the tower tick / a proof uses `drainOnce` (or `notify` for the immediate
 * optimistic path).
 *
 * @param {object} args
 * @param {object} args.config             loadConfig() result
 * @param {object} [args.telegramClient]   inject a client (tests pass a fake; NO live send)
 * @param {function} [args.fetchImpl]       injectable fetch for the default real client
 */
export function createTelegramNotifier({ config, telegramClient, fetchImpl } = {}) {
  const recipient = config?.authorisedTelegramUserId ?? null;
  const client = telegramClient ?? createTelegramClient({ config, fetchImpl });
  const attempts = new Map(); // per-process bounded-give-up counter

  return {
    recipient,
    client,
    LOGICAL_SOURCES,
    get ready() { return Boolean(client?.ready ?? config?.telegramReady); },

    computeDedupKey(spec) { return computeDedupKey({ recipient, ...spec }); },

    /** Durable enqueue at a milestone (NO send) — the dispatcher's hook. */
    async enqueue(store, spec, opts = {}) {
      return enqueue(store, { ...spec, recipient }, opts);
    },

    /** Enqueue + optimistic immediate drainOnce. An outage never blocks/loses. */
    async notify(store, spec, opts = {}) {
      const enq = await enqueue(store, { ...spec, recipient }, opts);
      const drain = await drainOnce(store, client, { ...opts, attempts });
      return { ...enq, drain };
    },

    /** Drain the pending backlog once with the bound client. */
    async drainOnce(store, opts = {}) {
      return drainOnce(store, client, { ...opts, attempts });
    },
  };
}
