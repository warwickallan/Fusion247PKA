// BUILD-014 Tower supervisor loop — the AUTOMATIC Watcher Telegram.
//
// notify(pool, {turnId, reason, state, message}) sends a REAL Telegram message via the Bot
// API and records the actual delivery result into tower.notification. Tower owns this wire;
// Codex never sees the Telegram credentials (they are stripped from the Codex child env).
//
// Env (validated at call time, fail-loud, never logged): TELEGRAM_BOT_TOKEN,
// AUTHORISED_TELEGRAM_USER_ID. If either is absent the notification is recorded HONESTLY as
// not-sent (telegram_ok=false) with the reason — the loop never fabricates a delivery.
//
// Node 22 has global fetch; no dependency added.

export const NOTIFY_REASONS = Object.freeze([
  'warwick_input_required',
  'codex_block_or_redirect',
  'goal_complete',
  'tower_failure',
]);

const TELEGRAM_TIMEOUT_MS = 15000;

function maskToken(token) {
  if (!token) return '(unset)';
  const s = String(token);
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * Send one automatic Watcher Telegram and record the real result.
 *
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {string} args.turnId
 * @param {string} args.reason   one of NOTIFY_REASONS
 * @param {string} args.state    the turn state at send time
 * @param {string} args.message  the human-facing message body
 * @returns {Promise<{notificationId:string, telegram_ok:boolean, telegram_message_id:number|null, detail:string}>}
 */
export async function notify(pool, { turnId, reason, state, message }) {
  if (!NOTIFY_REASONS.includes(reason)) {
    throw new Error(`notify: unknown reason '${reason}' (expected one of ${NOTIFY_REASONS.join('|')})`);
  }

  // `message` may be a single string OR an array of strings. An array is sent as SEPARATE Telegram
  // messages in order — e.g. Larry's turn, THEN Codex's verdict: an actual back-and-forth, not one
  // combined message — while still recording exactly ONE dedup row per (turn_id, reason).
  const parts = (Array.isArray(message) ? message : [message]).filter((m) => typeof m === 'string' && m.trim() !== '');
  const stored = parts.join('\n----\n');

  // IDEMPOTENCY — claim the (turn_id, reason) slot FIRST. If we do not win the insert, this
  // notification already exists (e.g. a restart re-processed the turn): do NOT POST again and
  // do NOT create a duplicate row. Only the winner of the insert POSTs to Telegram.
  const claim = await pool.query(
    `insert into tower.notification (turn_id, reason, state, message, telegram_ok)
     values ($1, $2, $3, $4, false)
     on conflict (turn_id, reason) do nothing
     returning id`,
    [turnId, reason, state, stored],
  );
  if (claim.rows.length === 0) {
    return {
      notificationId: null, deduped: true, telegram_ok: false, telegram_message_id: null,
      detail: 'deduped — notification already exists for (turn_id, reason); Telegram not re-sent',
    };
  }
  const notificationId = claim.rows[0].id;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.AUTHORISED_TELEGRAM_USER_ID;

  let telegramOk = false;
  let telegramMessageId = null;
  let detail = '';

  // FAKE TRANSPORT (test double, injected via env): TOWER_NOTIFY_TRANSPORT=none makes notify
  // record the notification (dedup insert already happened above) WITHOUT any network call —
  // so the CI doubles suite exercises the real dedup path with no Telegram dependency.
  if (process.env.TOWER_NOTIFY_TRANSPORT === 'none') {
    detail = `not sent — TOWER_NOTIFY_TRANSPORT=none (test double, no network); ${parts.length} message(s)`;
  } else if (!token || !chatId) {
    detail = `not sent — missing ${!token ? 'TELEGRAM_BOT_TOKEN' : ''}${!token && !chatId ? ' and ' : ''}${!chatId ? 'AUTHORISED_TELEGRAM_USER_ID' : ''}`;
  } else {
    // Send each part as a SEPARATE Telegram message, in order (Larry's, then Codex's).
    let allOk = parts.length > 0;
    let okCount = 0;
    let firstErr = '';
    for (const part of parts) {
      const r = await sendOneTelegram(token, chatId, part);
      if (r.ok) { okCount += 1; if (telegramMessageId === null) telegramMessageId = r.messageId; }
      else { allOk = false; if (!firstErr) firstErr = r.detail; }
    }
    telegramOk = allOk;
    detail = `sent ${okCount}/${parts.length} via bot ${maskToken(token)}${allOk ? '' : ` — ${firstErr}`}`;
  }

  // Record the REAL delivery result onto the row we already claimed.
  await pool.query(
    `update tower.notification set telegram_ok = $2, telegram_message_id = $3 where id = $1`,
    [notificationId, telegramOk, telegramMessageId],
  );

  return { notificationId, deduped: false, telegram_ok: telegramOk, telegram_message_id: telegramMessageId, detail, sent: parts.length };
}

// Send ONE Telegram message. Never throws; never echoes the token. Returns {ok, messageId, detail}.
async function sendOneTelegram(token, chatId, text) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
    const bodyText = await resp.text();
    let body = null; try { body = JSON.parse(bodyText); } catch { /* keep raw */ }
    if (resp.ok && body?.ok) return { ok: true, messageId: body.result?.message_id ?? null, detail: 'sent' };
    return { ok: false, messageId: null, detail: `telegram API rejected (http ${resp.status}): ${String(body?.description ?? bodyText).slice(0, 160)}` };
  } catch (e) {
    return { ok: false, messageId: null, detail: `telegram send failed: ${String(e?.message ?? e).slice(0, 160)}` };
  }
}

// Bounded, human-readable excerpt of Larry's turn so the Telegram message shows LARRY'S SIDE of
// the Larry<->Codex dialogue, not just Codex's verdict (Warwick's ask: "I have no idea what you
// are doing in response to Codex"). Strips code fences + collapses whitespace and caps the length
// so a long turn can never blow up the message.
export function summariseLarry(text, max = 280) {
  if (text === null || text === undefined) return '';
  const clean = String(text)
    .replace(/```[\s\S]*?```/g, ' [code] ')  // closed fenced blocks -> placeholder
    .replace(/`+/g, ' ')                       // F-002: any leftover/unmatched backticks -> space
    .replace(/\s+/g, ' ').trim();
  if (clean === '') return '';
  return clean.length > max ? (clean.slice(0, max - 1).trimEnd() + '…') : clean;
}

/**
 * Compose LARRY'S message — his side of the Larry<->Codex dialogue, sent as its OWN Telegram message
 * BEFORE Codex's (a real back-and-forth, not one combined message — Warwick's requirement). Returns ''
 * when there is no larry_response, in which case only the Codex message is sent.
 */
export function composeLarryMessage({ buildRef, turnSeq, turnId, larryResponse }) {
  const larry = summariseLarry(larryResponse);
  if (!larry) return '';
  return [
    `🗣 Larry — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    larry,
    `turn: ${turnId}`,
  ].join('\n');
}

/** Compose CODEX'S message — the supervisor verdict/action, sent as its OWN Telegram message after Larry's. */
export function composeMessage({ buildRef, turnSeq, turnId, state, verdict, summary, nextAction, warwickNeeded }) {
  const lines = [
    `🤖 Codex — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    `state: ${state}`,
    verdict ? `verdict: ${verdict}` : null,
    summary ? `— ${summary}` : null,
    nextAction ? `next: ${nextAction}` : null,
    warwickNeeded ? '⚠️ Warwick needs to act.' : null,
    `turn: ${turnId}`,
  ].filter(Boolean);
  return lines.join('\n');
}
