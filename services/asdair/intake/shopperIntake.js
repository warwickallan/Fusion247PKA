// =====================================================================
// IDEA-012 AsdAIr — intake: shopperIntake.js
//
// THE RECEIVER. The weekly shopping list arrives as a Telegram message to a
// dedicated bot (@Fusion247shopperbot) — either typed text or a PHOTO of a
// handwritten list. This module fetches those messages and turns each one into
// a payload the hub's shopper route already accepts.
//
// Why it exists: this receiver used to be hand-written into a session scratchpad
// every week and thrown away — operational capability living in session memory
// instead of in Git. It is now a committed, tested module.
//
// ── WHERE THIS MODULE'S JOB ENDS ─────────────────────────────────────────────
// It NEVER transcribes. For a photo it downloads the bytes and reports the local
// image path — reading the handwriting is a SEPARATE step performed by a vision
// model, injected downstream as `transcribers.transcribeImage` into
// `services/hub/shopper/shopperRoute.mjs` (see resolvePayload.mjs: photo payloads
// FAIL CLOSED without an injected transcriber, they are never guessed at).
// It NEVER places an order, never checks out, never pays. It never touches
// Postgres — no database connection exists anywhere in this folder.
//
// ── OUTPUT CONTRACT ──────────────────────────────────────────────────────────
// Each accepted message becomes one record:
//   { sourceId, payload, meta }
// where `payload` is EXACTLY a resolvePayload shape — { kind:'text', text } or
// { kind:'photo', imageRef } — and `sourceId` is stable + unique per inbound
// message. shopperRoute REQUIRES sourceId: it scopes the per-item idempotency
// keys, so two different messages can never collide on shop-0/shop-1.
// `meta` is receiver bookkeeping (chat/message/update ids, timestamps); the
// downstream route ignores it.
//
// ── PATTERN PROVENANCE ───────────────────────────────────────────────────────
// The Telegram fetch/offset/secret-hygiene approach is the proven one already in
// this repo — services/fusion-capture-gateway/src/adapters/telegramLiveAdapter.js
// (injected fetchImpl, masked token, one transient-network retry, long-poll wait
// kept under the ~45s home-NAT kill window) and .../src/live/liveRunner.js
// (offset advanced ONLY after an update is durably handled; a failure HOLDS the
// offset and stops the batch so nothing is skipped). Those modules are bound to
// the BUILD-002 capture envelope/contracts and its Supabase chat-boundary import,
// which this shopper path has no business dragging in — so the APPROACH is
// reused here on a small, dependency-free surface rather than the module.
//
// ── SECRETS ──────────────────────────────────────────────────────────────────
// The bot token and the allowed-sender ids come ONLY from the environment (pass
// the credentials with `node --env-file=<path>`; see README). This module never
// opens a credential file itself, never accepts a token on the command line, and
// never logs/throws/returns a token — every diagnostic goes through maskToken().
//
// Zero runtime dependencies (Node 18+ global fetch, node:fs, node:path, node:os).
// =====================================================================

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_API_BASE = 'https://api.telegram.org';

// A one-shot weekly fetch wants whatever is already queued, so the default
// long-poll wait is 0 (return immediately). Any configured wait is CAPPED at 25s:
// live finding 2026-07-17 (telegramLiveAdapter.js) — Warwick's home router/NAT
// silently kills a TCP connection held open for ~45s, poisoning the pooled socket.
export const MAX_POLL_TIMEOUT_SECONDS = 25;
const DEFAULT_POLL_TIMEOUT_SECONDS = 0;
const DEFAULT_UPDATE_LIMIT = 100;
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 250;

// Photo extensions Telegram can hand back. The remote `file_path` is UNTRUSTED
// input — only a validated extension from this allowlist is ever used to build a
// local filename (no path segment from Telegram ever reaches the filesystem).
const ALLOWED_IMAGE_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
const FALLBACK_IMAGE_EXTENSION = '.jpg';

// Why a message can be refused. All are terminal decisions, not failures.
export const IGNORE_REASONS = Object.freeze({
  NO_MESSAGE: 'no_message',
  UNAUTHORISED_SENDER: 'unauthorised_sender',
  NON_PRIVATE_CHAT: 'non_private_chat',
  UNSUPPORTED_CONTENT_TYPE: 'unsupported_content_type',
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — environment variable NAMES only. No values, no defaults that could
// ever be a credential.
// ─────────────────────────────────────────────────────────────────────────────

export const SHOPPER_INTAKE_ENV = Object.freeze({
  // SECRET — the @Fusion247shopperbot bot token (a full bot account credential).
  // Deliberately NOT the gateway's TELEGRAM_BOT_TOKEN: a distinct name makes it
  // impossible to pick up Larry's capture bot by accident.
  SHOPPER_BOT_TOKEN: 'SHOPPER_BOT_TOKEN',
  // Allowlist of permitted Telegram NUMERIC sender ids, comma/space separated.
  // Not a secret. Absent/empty => the receiver refuses to run (no allow-all).
  SHOPPER_ALLOWED_SENDER_IDS: 'SHOPPER_ALLOWED_SENDER_IDS',
  // Where the last-processed update id is persisted. Defaults OUTSIDE the repo.
  SHOPPER_INTAKE_STATE_FILE: 'SHOPPER_INTAKE_STATE_FILE',
  // Where downloaded list photos land. Defaults OUTSIDE the repo.
  SHOPPER_INTAKE_MEDIA_DIR: 'SHOPPER_INTAKE_MEDIA_DIR',
  // Test/diagnostic override of the Bot API base. Not a secret.
  SHOPPER_TELEGRAM_API_BASE: 'SHOPPER_TELEGRAM_API_BASE',
  // Optional long-poll wait in seconds (capped at MAX_POLL_TIMEOUT_SECONDS).
  SHOPPER_POLL_TIMEOUT_SECONDS: 'SHOPPER_POLL_TIMEOUT_SECONDS',
});

export const SHOPPER_INTAKE_SECRET_KEYS = Object.freeze([SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN]);

/**
 * The local state/media root. It is deliberately OUTSIDE this (PUBLIC) repo:
 * the offset file and the downloaded photos are household personal data, and the
 * personal-data doctrine forbids them ever entering git. On Windows this is the
 * machine's existing local store root (C:\.fusion247), which is where the other
 * runtime state and env files for this machine already live.
 *
 * @param {object} [deps] injectable for tests: { platform, homedir }
 */
export function defaultIntakeHome({ platform = process.platform, homedir = os.homedir() } = {}) {
  if (platform === 'win32') return 'C:/.fusion247/asdair';
  return path.join(homedir, '.fusion247', 'asdair');
}

export function defaultStateFile(deps) {
  return path.join(defaultIntakeHome(deps), 'shopper-intake-state.json');
}

export function defaultMediaDir(deps) {
  return path.join(defaultIntakeHome(deps), 'shopper-media');
}

/**
 * Mask a bot token for any diagnostic. Never reveals the secret body — keeps only
 * the public-ish numeric bot-id prefix. Mirrors telegramLiveAdapter.maskToken.
 */
export function maskToken(token) {
  if (typeof token !== 'string' || token.length === 0) return '(unset)';
  const colon = token.indexOf(':');
  if (colon <= 0) return '***masked***';
  return `${token.slice(0, colon)}:***masked***`;
}

/** Replace every occurrence of the token in a diagnostic string with its mask. */
export function maskTokenIn(text, token) {
  if (typeof text !== 'string') return String(text ?? '');
  if (typeof token !== 'string' || token.length === 0) return text;
  return text.split(token).join(maskToken(token));
}

/**
 * PURE. Parse the sender allowlist. Telegram user ids are numeric and
 * non-spoofable; anything else is a configuration error, not a sender to trust.
 * Default-deny: an absent/empty/all-blank list throws rather than allowing all.
 *
 * @returns {readonly string[]} de-duplicated ids, as strings
 */
export function parseAllowedSenderIds(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(`${SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS} required — at least one numeric Telegram sender id (no allow-all)`);
  }
  const parts = raw.split(/[\s,;]+/).filter((p) => p.length > 0);
  const bad = parts.filter((p) => !/^-?\d+$/.test(p));
  if (bad.length > 0) {
    throw new Error(`${SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS} must be numeric Telegram user ids; rejected ${bad.length} non-numeric entr${bad.length === 1 ? 'y' : 'ies'}`);
  }
  if (parts.length === 0) {
    throw new Error(`${SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS} required — at least one numeric Telegram sender id (no allow-all)`);
  }
  return Object.freeze([...new Set(parts)]);
}

/**
 * Load the receiver config from an environment map (defaults to process.env).
 * Throws when a required credential/allowlist is absent — the receiver must
 * fail closed rather than start half-configured.
 *
 * `describe()` is a log-safe snapshot: the token is always masked.
 */
export function loadIntakeConfig(env = process.env, pathDeps) {
  const get = (name) => {
    const v = env[name];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };

  const botToken = get(SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN);
  if (!botToken) {
    throw new Error(`${SHOPPER_INTAKE_ENV.SHOPPER_BOT_TOKEN} is required (pass it with node --env-file=<credentials file>; never on the command line)`);
  }
  // Accepted aliases for the sender allowlist. The pre-existing machine credentials
  // file for this bot uses SHOPPER_ALLOWED_USER_IDS, which predates this module; the
  // canonical name is SHOPPER_ALLOWED_SENDER_IDS. First non-empty wins. This is an
  // alias, NOT a relaxation: an absent/empty/all-blank list still throws (default-deny),
  // and there is still no allow-all.
  const allowedSenderIds = parseAllowedSenderIds(
    get(SHOPPER_INTAKE_ENV.SHOPPER_ALLOWED_SENDER_IDS) ?? get('SHOPPER_ALLOWED_USER_IDS'),
  );

  const rawTimeout = get(SHOPPER_INTAKE_ENV.SHOPPER_POLL_TIMEOUT_SECONDS);
  const pollTimeoutSeconds = clampPollTimeout(rawTimeout === null ? DEFAULT_POLL_TIMEOUT_SECONDS : Number(rawTimeout));

  const config = {
    botToken, // SECRET — never logged, never returned by describe()
    allowedSenderIds,
    stateFile: get(SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_STATE_FILE) ?? defaultStateFile(pathDeps),
    mediaDir: get(SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_MEDIA_DIR) ?? defaultMediaDir(pathDeps),
    apiBase: get(SHOPPER_INTAKE_ENV.SHOPPER_TELEGRAM_API_BASE) ?? DEFAULT_API_BASE,
    pollTimeoutSeconds,

    describe() {
      return {
        SHOPPER_BOT_TOKEN: maskToken(botToken),
        SHOPPER_ALLOWED_SENDER_IDS: `${allowedSenderIds.length} allowed sender id(s)`,
        SHOPPER_INTAKE_STATE_FILE: config.stateFile,
        SHOPPER_INTAKE_MEDIA_DIR: config.mediaDir,
        SHOPPER_TELEGRAM_API_BASE: config.apiBase,
        SHOPPER_POLL_TIMEOUT_SECONDS: config.pollTimeoutSeconds,
      };
    },
  };
  return config;
}

/** PURE. Keep any configured long-poll wait inside the safe window. */
export function clampPollTimeout(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_POLL_TIMEOUT_SECONDS;
  return Math.min(Math.trunc(n), MAX_POLL_TIMEOUT_SECONDS);
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE CORE — no I/O, no clock, no randomness. Everything below this line up to
// the "IMPURE" banner is a total function of its arguments.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PURE. Stable, unique id for one inbound message.
 *
 * Keyed on the MESSAGE identity (chat + message_id), not the delivery
 * (update_id): a Telegram redelivery of the same message must resolve to the
 * SAME sourceId so shopperRoute's idempotency keys dedup it, while two genuinely
 * different messages can never collide.
 */
export function buildSourceId({ chatId, messageId }) {
  return `tg:shopper:chat:${chatId}:msg:${messageId}`;
}

/**
 * PURE. Pick the highest-resolution PhotoSize from a Telegram `photo` array.
 * Telegram sends the same image at several sizes; a handwritten list needs the
 * biggest one to be legible. Ranks by pixel area, tie-broken by file_size.
 *
 * @returns {object|null} the chosen PhotoSize, or null when there is none
 */
export function pickLargestPhoto(photoSizes) {
  if (!Array.isArray(photoSizes) || photoSizes.length === 0) return null;
  let best = null;
  let bestArea = -1;
  let bestBytes = -1;
  for (const p of photoSizes) {
    if (!p || typeof p !== 'object' || typeof p.file_id !== 'string' || p.file_id.length === 0) continue;
    const area = (Number(p.width) || 0) * (Number(p.height) || 0);
    const bytes = Number(p.file_size) || 0;
    if (area > bestArea || (area === bestArea && bytes > bestBytes)) {
      best = p;
      bestArea = area;
      bestBytes = bytes;
    }
  }
  return best;
}

/**
 * PURE. Classify one raw Telegram update against the sender allowlist and the
 * supported content types. No I/O — the caller does the downloading.
 *
 * Check order mirrors the proven gateway mapping (telegramMapping.js): sender
 * allowlist FIRST so a stranger never gets a content-type oracle, then the
 * private-direct-chat boundary, then content.
 *
 * @param {object} update              a raw Telegram Update
 * @param {object} opts
 * @param {readonly string[]} opts.allowedSenderIds
 * @returns {{ok:false, reason:string, senderId:string|null, updateId:number|null}
 *          |{ok:true, kind:'text'|'photo', ...}}
 */
export function classifyUpdate(update, { allowedSenderIds } = {}) {
  if (!Array.isArray(allowedSenderIds) || allowedSenderIds.length === 0) {
    throw new Error('classifyUpdate: allowedSenderIds required (allowlist, default-deny)');
  }
  const updateId = update && Number.isFinite(Number(update.update_id)) ? Number(update.update_id) : null;

  const message = update && typeof update === 'object' ? update.message : undefined;
  if (!message || typeof message !== 'object') {
    // edited_message / callback_query / channel_post / … — not a list submission.
    return { ok: false, reason: IGNORE_REASONS.NO_MESSAGE, senderId: null, updateId };
  }

  const from = message.from;
  const senderId = from && from.id !== undefined && from.id !== null ? String(from.id) : null;

  // ALLOWLIST, default-deny. A message from anyone else is IGNORED — never
  // processed, never downloaded, never replied to. The caller logs it.
  if (senderId === null || !allowedSenderIds.includes(senderId)) {
    return { ok: false, reason: IGNORE_REASONS.UNAUTHORISED_SENDER, senderId, updateId };
  }

  // Private DM only — never a group/supergroup/channel (same posture as the
  // gateway's private-direct-chat boundary).
  const chat = message.chat;
  const chatOk = chat && typeof chat === 'object' && chat.type === 'private'
    && chat.id !== undefined && String(chat.id) === senderId;
  if (!chatOk) {
    return { ok: false, reason: IGNORE_REASONS.NON_PRIVATE_CHAT, senderId, updateId };
  }

  const chatId = String(chat.id);
  const messageId = message.message_id;
  const sourceId = buildSourceId({ chatId, messageId });
  const caption = typeof message.caption === 'string' && message.caption.trim().length > 0
    ? message.caption
    : null;
  const base = { ok: true, senderId, updateId, chatId, messageId, sourceId, caption };

  // PHOTO first: a photo message can also carry a caption, and the photo IS the
  // list. Text-only messages fall through to the text branch.
  const photo = pickLargestPhoto(message.photo);
  if (photo) {
    return {
      ...base,
      kind: 'photo',
      fileId: photo.file_id,
      fileUniqueId: typeof photo.file_unique_id === 'string' ? photo.file_unique_id : null,
      width: Number(photo.width) || null,
      height: Number(photo.height) || null,
      fileSize: Number(photo.file_size) || null,
    };
  }

  const text = typeof message.text === 'string' ? message.text : '';
  if (text.trim().length > 0) {
    return { ...base, kind: 'text', text };
  }

  // voice / document / sticker / empty — resolvePayload can take voice, but this
  // receiver deliberately handles only the two shapes the weekly list arrives in.
  //
  // WP-B15-11 AC5. This refusal is TERMINAL and the caller advances the offset
  // past it, which is correct — otherwise one unsupported message wedges the
  // queue forever. But it is also the one refusal shape that can be REAL DATA
  // LOSS: an allowed sender's genuine weekly list, sent as a document or a voice
  // note, is refused and consumed with no trace of what it was. So the verdict
  // now carries the KINDS of content the message held — kinds only, never
  // content, never a filename, never a file id (see contentKindsOf). Offset
  // semantics are UNCHANGED; only the visibility of the refusal is.
  return {
    ok: false,
    reason: IGNORE_REASONS.UNSUPPORTED_CONTENT_TYPE,
    senderId,
    updateId,
    contentKinds: contentKindsOf(message),
  };
}

/**
 * PURE. Which CONTENT-BEARING fields a Telegram message carried, by NAME.
 *
 * Names only, taken from a CLOSED allowlist of Telegram field names. No value
 * from the message is ever read, so no message text, caption body, filename,
 * mime type, file id or duration can leak through this into a log line. The
 * allowlist being closed is the mechanism: an unknown future field is reported
 * as nothing rather than by echoing its key.
 *
 * Only ever computed for a sender who has ALREADY passed the allowlist — a
 * stranger never gets a content-type oracle, the same posture as the
 * allowlist-first check order in classifyUpdate.
 */
export function contentKindsOf(message) {
  const KNOWN = [
    'text', 'photo', 'document', 'voice', 'audio', 'video', 'video_note',
    'sticker', 'animation', 'location', 'contact', 'poll', 'caption',
  ];
  if (!message || typeof message !== 'object') return [];
  return KNOWN.filter((k) => message[k] !== undefined && message[k] !== null);
}

/**
 * PURE. The resolvePayload-shaped payload for a classified TEXT message.
 * See services/hub/shopper/resolvePayload.mjs — { kind:'text', text }.
 */
export function buildTextPayload(verdict) {
  return { kind: 'text', text: verdict.text };
}

/**
 * PURE. The resolvePayload-shaped payload for a classified PHOTO message.
 * See services/hub/shopper/resolvePayload.mjs — { kind:'photo', imageRef }.
 * `imageRef` is the LOCAL path of the downloaded bytes; resolvePayload hands it
 * to the injected vision transcriber. This module never reads the pixels.
 */
export function buildPhotoPayload(verdict, imageRef) {
  return { kind: 'photo', imageRef };
}

/**
 * PURE. The immutable content fingerprint of one downloaded image.
 *
 * WP-B15-1 invariant C: a shop must be bound to the exact CONTENT of the
 * photograph it was read from, not merely to a mutable file path plus Telegram
 * identifiers. Computed HERE, at intake, from the exact buffer that is written
 * to the media store - the one moment the bytes are provably in hand - and
 * carried on the record's meta so the pipeline can persist it beside the shop
 * before the Telegram offset is acknowledged. Downstream consumers read the
 * STORED value; nothing recomputes it from a path.
 *
 * Lowercase hex SHA-256. Deterministic: same bytes, same fingerprint, forever.
 */
export function imageFingerprintOf(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    throw new Error('imageFingerprintOf: a Buffer of the downloaded image bytes is required');
  }
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * PURE. A safe local filename for a downloaded list photo. The remote
 * `file_path` is untrusted: ONLY a validated extension is taken from it, never a
 * path segment, so nothing Telegram sends can traverse or escape the media dir.
 */
export function safeMediaFilename({ sourceId, fileUniqueId, remoteFilePath }) {
  const slug = String(sourceId ?? 'unknown').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const unique = String(fileUniqueId ?? '').replace(/[^A-Za-z0-9._-]+/g, '');
  const rawExt = typeof remoteFilePath === 'string' ? path.posix.extname(remoteFilePath).toLowerCase() : '';
  const ext = ALLOWED_IMAGE_EXTENSIONS.includes(rawExt) ? rawExt : FALLBACK_IMAGE_EXTENSION;
  return `${slug}${unique ? `-${unique}` : ''}${ext}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPURE — injected-dependency seams. Each is a small factory so the tests can
// pass a fake and never touch the network or the real filesystem defaults.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a fetch REJECTION as a transient network/socket failure. fetch()
 * rejects only at the network layer — an HTTP 4xx/5xx RESOLVES and is never
 * retried. Same classification as telegramLiveAdapter.isTransientNetworkError
 * (live finding: a NAT-killed keep-alive socket fails the next pooled request
 * once; one retry draws a fresh socket).
 */
export function isTransientNetworkError(err) {
  const TRANSIENT_CODES = [
    'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT',
    'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
  ];
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth += 1) {
    const msg = typeof e.message === 'string' ? e.message : '';
    const code = typeof e.code === 'string' ? e.code : '';
    if (TRANSIENT_CODES.includes(code)
      || msg.includes('fetch failed')
      || msg.includes('socket hang up')
      || msg.includes('other side closed')
      || msg.includes('terminated')) {
      return true;
    }
  }
  return false;
}

/**
 * The ShopperBot Telegram client: getUpdates / getFile / downloadFile.
 *
 * HERMETIC BY DESIGN — `fetchImpl` is injected (defaults to the Node global
 * fetch, no npm dependency). Tests pass a fake and an obviously-fake token.
 * SECRET HYGIENE: the token appears ONLY inside the request URL handed to
 * fetchImpl. It is never logged, never thrown, never returned; every error
 * message is passed through maskTokenIn().
 */
export function createShopperTelegramClient({
  botToken,
  fetchImpl = (typeof fetch === 'function' ? fetch : undefined),
  apiBase = DEFAULT_API_BASE,
  retryDelayMs = DEFAULT_TRANSIENT_RETRY_DELAY_MS,
} = {}) {
  if (typeof botToken !== 'string' || botToken.length === 0) {
    throw new Error('createShopperTelegramClient: botToken required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('createShopperTelegramClient: fetchImpl required (global fetch or an injected fake)');
  }
  const apiRoot = `${apiBase}/bot${botToken}`;
  const fileRoot = `${apiBase}/file/bot${botToken}`;

  async function withOneRetry(label, doIt) {
    try {
      return await doIt();
    } catch (netErr) {
      if (!isTransientNetworkError(netErr)) {
        throw new Error(`shopper ${label} request failed: ${maskTokenIn(netErr && netErr.message ? netErr.message : String(netErr), botToken)}`);
      }
      await new Promise((resolve) => { setTimeout(resolve, retryDelayMs); });
      try {
        return await doIt();
      } catch (retryErr) {
        throw new Error(`shopper ${label} request failed after retry: ${maskTokenIn(retryErr && retryErr.message ? retryErr.message : String(retryErr), botToken)}`);
      }
    }
  }

  async function callApi(method, body) {
    const res = await withOneRetry(method, () => fetchImpl(`${apiRoot}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
    const parsed = await res.json();
    if (!parsed || parsed.ok !== true) {
      const desc = parsed && parsed.description ? parsed.description : `http_${res && res.status}`;
      // Telegram's own error text — masked defensively in case a token echoes.
      throw new Error(`shopper ${method} rejected: ${maskTokenIn(String(desc), botToken)}`);
    }
    return parsed;
  }

  return {
    /** Fetch pending updates. `offset` acks everything below it (Telegram semantics). */
    async getUpdates({ offset, timeout = DEFAULT_POLL_TIMEOUT_SECONDS, limit = DEFAULT_UPDATE_LIMIT } = {}) {
      const parsed = await callApi('getUpdates', {
        ...(offset === undefined || offset === null ? {} : { offset }),
        timeout: clampPollTimeout(timeout),
        limit,
      });
      return Array.isArray(parsed.result) ? parsed.result : [];
    },

    /** Resolve a file_id to a downloadable file_path (valid ~1 hour). */
    async getFile(fileId) {
      const parsed = await callApi('getFile', { file_id: fileId });
      return parsed.result || {};
    },

    /** Download the bytes of a resolved file_path. Returns a Buffer. */
    async downloadFile(remoteFilePath) {
      if (typeof remoteFilePath !== 'string' || remoteFilePath.length === 0) {
        throw new Error('shopper downloadFile: a resolved file_path is required');
      }
      const res = await withOneRetry('downloadFile', () => fetchImpl(`${fileRoot}/${remoteFilePath}`));
      if (!res || res.ok === false) {
        throw new Error(`shopper downloadFile rejected: http_${res && res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    },

    /** Diagnostics only — masked. Never returns the real token. */
    describe() {
      return { bot: 'shopperbot', api_base: apiBase, bot_token: maskToken(botToken) };
    },
  };
}

/**
 * Durable offset store: the last SUCCESSFULLY processed update id, in a JSON
 * file. The default path is outside the repo (see defaultIntakeHome) and the
 * write is atomic (tmp + rename) so a crash mid-write cannot leave a truncated
 * file that would replay or skip the week's list.
 */
export function createFileStateStore(stateFile) {
  if (typeof stateFile !== 'string' || stateFile.length === 0) {
    throw new Error('createFileStateStore: stateFile path required');
  }
  return {
    path: stateFile,
    /** @returns {{lastUpdateId: number|null}} — a missing/corrupt file reads as "nothing processed yet". */
    async read() {
      let text;
      try {
        text = await fsp.readFile(stateFile, 'utf8');
      } catch (err) {
        if (err && err.code === 'ENOENT') return { lastUpdateId: null };
        throw err;
      }
      try {
        const parsed = JSON.parse(text);
        const n = Number(parsed && parsed.last_update_id);
        return { lastUpdateId: Number.isFinite(n) ? n : null };
      } catch {
        // A corrupt state file must not silently re-run the whole history.
        throw new Error(`shopper intake state file is not valid JSON: ${stateFile}`);
      }
    },
    async write(lastUpdateId, { now = Date.now } = {}) {
      await fsp.mkdir(path.dirname(stateFile), { recursive: true });
      const tmp = `${stateFile}.tmp`;
      const body = `${JSON.stringify({ last_update_id: lastUpdateId, updated_at: new Date(now()).toISOString() }, null, 2)}\n`;
      await fsp.writeFile(tmp, body, 'utf8');
      await fsp.rename(tmp, stateFile);
      return lastUpdateId;
    },
  };
}

/** Where downloaded list photos land. Defaults outside the repo. */
export function createFileMediaStore(mediaDir) {
  if (typeof mediaDir !== 'string' || mediaDir.length === 0) {
    throw new Error('createFileMediaStore: mediaDir path required');
  }
  return {
    dir: mediaDir,
    async save(filename, bytes) {
      await fsp.mkdir(mediaDir, { recursive: true });
      // path.basename defends the directory even if a caller passes something odd.
      const target = path.join(mediaDir, path.basename(filename));
      await fsp.writeFile(target, bytes);
      return path.resolve(target);
    },
  };
}

/** An in-memory state store — used by --dry-run so nothing is ever persisted. */
export function createMemoryStateStore(initialLastUpdateId = null) {
  let last = initialLastUpdateId;
  return {
    path: '(memory)',
    async read() { return { lastUpdateId: last }; },
    async write(lastUpdateId) { last = lastUpdateId; return lastUpdateId; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RECEIVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch pending ShopperBot messages and emit one record per accepted message.
 *
 * OFFSET / IDEMPOTENCY CONTRACT (the liveRunner rule):
 *  - The offset is read from the durable state file and passed to getUpdates as
 *    lastUpdateId + 1, so an already-processed message is never re-fetched.
 *  - Updates are handled in update_id order, and the offset is advanced +
 *    PERSISTED only AFTER an update has been fully handled.
 *  - A FAILURE (e.g. the photo download errored) does NOT advance the offset and
 *    STOPS the batch there, so that message — and every later one — is redelivered
 *    next run rather than silently skipped.
 *  - An IGNORED message (unauthorised sender, wrong chat, unsupported type) is a
 *    terminal DECISION, not a failure: the offset advances past it, otherwise a
 *    single stranger's message would wedge the queue forever. It is logged.
 *
 * DRY RUN: fetches and reports what WOULD be emitted. Downloads nothing (photos
 * report imageRef: null with `wouldDownload: true`) and writes no state.
 *
 * @param {object} deps
 * @param {object} deps.config     loadIntakeConfig() result
 * @param {object} deps.telegram   { getUpdates, getFile, downloadFile }
 * @param {object} deps.state      { read(), write(id) }
 * @param {object} [deps.media]    { save(filename, bytes) } — required unless dryRun
 * @param {boolean} [deps.dryRun]
 * @param {() => number} [deps.now]  injected clock (epoch ms)
 * @param {(event:string, detail:object) => void} [deps.log]
 * @returns {Promise<{emitted:object[], ignored:object[], failed:object[],
 *                    fetched:number, offsetBefore:number|null,
 *                    offsetAfter:number|null, dryRun:boolean}>}
 */
export async function runIntake({
  config,
  telegram,
  state,
  media,
  dryRun = false,
  now = Date.now,
  log = () => {},
  // Durable-persistence hook. When supplied, a record MUST be persisted by this
  // callback before its Telegram offset is acknowledged - see the ordering note
  // at the advance site. The runtime supplies it; standalone/dry-run does not.
  onRecord = null,
  // ROUTE-FIRST HOOK (WP-B15-A1). Asked, BEFORE this message is treated as a
  // shopping list, whether the control surface is claiming it as an answer to an
  // open question. `true` means "handled elsewhere, durably" and intake builds
  // and persists nothing for it.
  //
  // ── WHY A HOOK AND NOT A PREDICATE INSIDE classifyUpdate ──────────────────
  // classifyUpdate is PURE and stays pure. Deciding whether an open question
  // exists needs the database and may need a model call; putting that behind a
  // pure classifier would make "what kind of message is this?" depend on live
  // state - untestable, and a different answer on every pass. Classification
  // says WHAT the message is; the claim says WHO it belongs to. Two questions,
  // two places.
  //
  // ── WHY IT SITS HERE AND NOT AFTER THE LOOP ───────────────────────────────
  // There is exactly one poller and the offset ACK is destructive. The claim
  // must be decided - and the answer written durably by the claimant - BEFORE
  // this message's offset advances, for precisely the reason receiveList runs
  // inside onRecord. A claim resolved after the ACK would lose the answer to any
  // crash in that window, which is the failure this ordering exists to prevent.
  claim = null,
} = {}) {
  if (!config || !Array.isArray(config.allowedSenderIds)) throw new Error('runIntake: config (loadIntakeConfig result) required');
  if (!telegram || typeof telegram.getUpdates !== 'function') throw new Error('runIntake: telegram client required (injected)');
  if (!state || typeof state.read !== 'function' || typeof state.write !== 'function') throw new Error('runIntake: state store required (injected)');
  if (!dryRun && (!media || typeof media.save !== 'function')) throw new Error('runIntake: media store required (injected) unless dryRun');
  // ── THE FAIL-CLOSED DURABLE-CAPTURE GUARD (WP-B15-11 AC3/AC4) ──────────────
  //
  // A LIVE run advances the shared Telegram offset, and advancing it is
  // DESTRUCTIVE: Telegram then forgets the update permanently. Without somewhere
  // durable to put the record first, a live run therefore consumes a real
  // shopping list and loses it - silently, with no error and nothing to recover
  // from. `fetch-shopper-list.js` did exactly that, because `onRecord` was
  // OPTIONAL and its absence simply skipped the persistence step.
  //
  // The requirement is not "remember to pass onRecord". It is that an unsafe
  // live run cannot START. So the hook is REQUIRED in live mode, here at the
  // seam, where every caller - present, future, the CLI, `npm run fetch` - has
  // to come through. It is deliberately the same shape as the media guard above
  // it: a missing collaborator that would make the run unsafe is a refusal, not
  // a branch to skip.
  //
  // There is intentionally NO opt-out flag. An escape hatch would re-open this
  // hole for the first caller that found the guard inconvenient.
  if (!dryRun && typeof onRecord !== 'function') {
    throw new Error(
      'runIntake: onRecord (durable capture) required unless dryRun - a live run advances the Telegram '
      + 'offset, which permanently consumes the message, so the record must be persisted first. '
      + 'Use dryRun to inspect without consuming, or supply a durable onRecord (see pollIntake).',
    );
  }

  const { lastUpdateId } = await state.read();
  const offsetBefore = lastUpdateId;
  const emitted = [];
  const ignored = [];
  const failed = [];
  const claimed = [];

  const updates = await telegram.getUpdates({
    offset: lastUpdateId === null || lastUpdateId === undefined ? undefined : lastUpdateId + 1,
    timeout: config.pollTimeoutSeconds,
  });
  const ordered = [...updates].sort((a, b) => (Number(a && a.update_id) || 0) - (Number(b && b.update_id) || 0));
  log('fetched', { count: ordered.length, offset: offsetBefore, dry_run: dryRun });

  let offsetAfter = offsetBefore;

  for (const update of ordered) {
    const verdict = classifyUpdate(update, { allowedSenderIds: config.allowedSenderIds });

    if (!verdict.ok) {
      // Terminal decision — logged as ignored, never processed. No content is
      // logged (a stranger's message body never reaches a log line).
      // `contentKinds` is present only where classifyUpdate computed it (an
      // allowed sender whose content type this receiver does not handle). It is
      // field NAMES only - see contentKindsOf - so no content is logged here,
      // and a stranger's message still produces nothing but a reason.
      const entry = {
        updateId: verdict.updateId,
        senderId: verdict.senderId,
        reason: verdict.reason,
        ...(verdict.contentKinds ? { contentKinds: verdict.contentKinds } : {}),
      };
      ignored.push(entry);
      log('ignored', entry);
      if (verdict.updateId !== null) offsetAfter = verdict.updateId;
      if (!dryRun && verdict.updateId !== null) await state.write(verdict.updateId, { now });
      continue;
    }

    // ── ROUTE FIRST. Does this message belong to an open question? ──────────
    //
    // Asked BEFORE buildRecord, so a claimed message is never downloaded, never
    // becomes a shop and never resumes one. That ordering is AC2: until it
    // existed, a typed answer was classified as a shopping list and reached
    // receiveList, so the same words could be both answered and eaten.
    //
    // A CLAIM THAT THROWS DOES NOT EAT THE MESSAGE. Routing failing is not a
    // reason to lose a shopping list, so the error is logged and the message
    // falls through to intake exactly as it does today. Failing towards "not
    // claimed" is the safe direction: the worst case is the pre-existing
    // behaviour, never a silently discarded message.
    if (typeof claim === 'function') {
      let wasClaimed = false;
      try {
        wasClaimed = (await claim(verdict, update)) === true;
      } catch (err) {
        log('claim_failed', {
          updateId: verdict.updateId,
          sourceId: verdict.sourceId,
          error: maskTokenIn(err && err.message ? err.message : String(err), config.botToken),
        });
      }
      if (wasClaimed) {
        // A terminal decision like `ignored`, and for the same reason: the
        // message HAS been handled, durably, by the claimant before this point.
        // The offset advances so it is not redelivered and answered twice.
        const entry = { updateId: verdict.updateId, sourceId: verdict.sourceId, senderId: verdict.senderId };
        claimed.push(entry);
        log('claimed_by_router', entry);
        if (verdict.updateId !== null) offsetAfter = verdict.updateId;
        if (!dryRun && verdict.updateId !== null) await state.write(verdict.updateId, { now });
        continue;
      }
    }

    let record;
    try {
      record = await buildRecord(verdict, { telegram, media, dryRun, now });
    } catch (err) {
      // HOLD the offset and STOP the batch — this message must be redelivered.
      const entry = {
        updateId: verdict.updateId,
        sourceId: verdict.sourceId,
        error: maskTokenIn(err && err.message ? err.message : String(err), config.botToken),
      };
      failed.push(entry);
      log('failed_offset_held', entry);
      break;
    }

    // THE ORDERING THAT MATTERS. Advancing the Telegram offset is an
    // ACKNOWLEDGEMENT: it tells Telegram "I have this, stop sending it", and
    // Telegram then forgets the update permanently. If we acknowledge before the
    // shop exists durably, a crash in the window between the two loses a
    // shopping list SILENTLY - no error, no retry, nothing to recover from.
    //
    // So when the caller supplies onRecord (the runtime does), the record must be
    // durably persisted FIRST and the offset advances only after that resolves.
    // A throw holds the offset and stops the batch, exactly like a download
    // failure, so Telegram redelivers and the list survives.
    //
    // Duplicate-on-redelivery is handled downstream and structurally: the shop
    // table's unique (telegram_chat_id, telegram_message_id) index makes a
    // second delivery resume the same shop instead of creating another. Given a
    // choice between "might process twice" and "might lose it forever", the
    // duplicate is the safe failure - and here it is not even a duplicate.
    //
    // WP-B15-11: in LIVE mode this branch is now UNCONDITIONAL - the guard at
    // the top of this function refuses to start without `onRecord`, so there is
    // no live path in which the offset advances without a durable capture
    // having resolved first. The condition remains only because `dryRun` legally
    // has no sink, and a dry run advances nothing.
    if (typeof onRecord === 'function') {
      try {
        await onRecord(record);
      } catch (err) {
        const entry = {
          updateId: verdict.updateId,
          sourceId: record.sourceId,
          error: maskTokenIn(err && err.message ? err.message : String(err), config.botToken),
        };
        failed.push(entry);
        log('persist_failed_offset_held', entry);
        break;
      }
    }

    emitted.push(record);
    log('emitted', { sourceId: record.sourceId, kind: record.payload.kind, updateId: verdict.updateId });
    if (verdict.updateId !== null) offsetAfter = verdict.updateId;
    if (!dryRun && verdict.updateId !== null) await state.write(verdict.updateId, { now });
  }

  return {
    emitted,
    ignored,
    failed,
    // Reported separately from `ignored` on purpose: an ignored message was
    // refused, a claimed one was HANDLED. Collapsing them would make a working
    // answer path look like a stream of rejections.
    claimed,
    fetched: ordered.length,
    offsetBefore,
    offsetAfter,
    dryRun,
  };
}

/**
 * Build the emitted record for one ACCEPTED message. Text needs no I/O; a photo
 * is resolved via getFile and downloaded to the media store (unless dry-run).
 * NOTHING here reads the image content — transcription is a separate, downstream,
 * vision-model step.
 */
async function buildRecord(verdict, { telegram, media, dryRun, now }) {
  const meta = {
    channel: 'telegram',
    bot: 'shopperbot',
    updateId: verdict.updateId,
    messageId: verdict.messageId,
    chatId: verdict.chatId,
    senderId: verdict.senderId,
    caption: verdict.caption,
    receivedAt: new Date(now()).toISOString(),
    transcribed: false, // ALWAYS false here — this receiver never transcribes.
  };

  if (verdict.kind === 'text') {
    return { sourceId: verdict.sourceId, payload: buildTextPayload(verdict), meta };
  }

  // photo
  const photoMeta = {
    ...meta,
    fileUniqueId: verdict.fileUniqueId,
    width: verdict.width,
    height: verdict.height,
    fileSize: verdict.fileSize,
  };

  if (dryRun) {
    // Downloads nothing. The payload is reported with a null imageRef so it is
    // obvious this is a preview, not something to hand to a transcriber.
    return {
      sourceId: verdict.sourceId,
      payload: buildPhotoPayload(verdict, null),
      meta: { ...photoMeta, wouldDownload: true },
    };
  }

  const file = await telegram.getFile(verdict.fileId);
  const remoteFilePath = file && typeof file.file_path === 'string' ? file.file_path : null;
  if (!remoteFilePath) throw new Error(`getFile returned no file_path for ${verdict.sourceId}`);
  const bytes = await telegram.downloadFile(remoteFilePath);
  const filename = safeMediaFilename({
    sourceId: verdict.sourceId,
    fileUniqueId: verdict.fileUniqueId,
    remoteFilePath,
  });
  const imagePath = await media.save(filename, bytes);

  return {
    sourceId: verdict.sourceId,
    payload: buildPhotoPayload(verdict, imagePath),
    // `imageSha256` rides META, not the payload: the payload contract is
    // EXACTLY a resolvePayload shape ({ kind:'photo', imageRef }) and stays so.
    // Hashed from the same buffer `media.save` just wrote, so the fingerprint
    // and the stored file cannot disagree at the moment of capture.
    meta: { ...photoMeta, imagePath, bytes: bytes.length, imageSha256: imageFingerprintOf(bytes) },
  };
}

/**
 * Convenience wiring for a real run: build the client + stores from a config and
 * run the receiver. Still fully injectable (fetchImpl) so nothing here forces a
 * network call. Used by fetch-shopper-list.js.
 */
export async function runIntakeFromConfig(config, { fetchImpl, dryRun = false, now = Date.now, log, onRecord = null } = {}) {
  // WP-B15-11. Refuse a live run with no durable sink BEFORE constructing a
  // client or touching the state file, so a refusal costs no network call and
  // cannot acknowledge anything away. This layer deliberately does NOT supply a
  // sink of its own: a silent no-op onRecord would satisfy the seam guard while
  // re-opening the exact hole it exists to close. A caller that genuinely has
  // somewhere durable to put the record passes it in; the shipped CLI has no
  // database by design (see the header of fetch-shopper-list.js) and so has no
  // live mode.
  if (!dryRun && typeof onRecord !== 'function') {
    throw new Error(
      'runIntakeFromConfig: a live run requires onRecord (durable capture) - without it the Telegram '
      + 'offset would advance and permanently consume the message. Pass dryRun to inspect safely.',
    );
  }
  const telegram = createShopperTelegramClient({
    botToken: config.botToken,
    apiBase: config.apiBase,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  // DRY RUN never touches the real state file — not even to create its directory.
  const state = dryRun
    ? createMemoryStateStore((await createFileStateStore(config.stateFile).read().catch(() => ({ lastUpdateId: null }))).lastUpdateId)
    : createFileStateStore(config.stateFile);
  const media = dryRun ? undefined : createFileMediaStore(config.mediaDir);
  return runIntake({ config, telegram, state, media, dryRun, now, log, ...(onRecord ? { onRecord } : {}) });
}

/** True when a path exists — small helper for the CLI's status line. */
export function pathExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}
