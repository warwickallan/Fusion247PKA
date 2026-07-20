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

  // IDEMPOTENCY — claim the (turn_id, reason) slot FIRST. If we do not win the insert, this
  // notification already exists (e.g. a restart re-processed the turn): do NOT POST again and
  // do NOT create a duplicate row. Only the winner of the insert POSTs to Telegram.
  const claim = await pool.query(
    `insert into tower.notification (turn_id, reason, state, message, telegram_ok)
     values ($1, $2, $3, $4, false)
     on conflict (turn_id, reason) do nothing
     returning id`,
    [turnId, reason, state, message],
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
    detail = 'not sent — TOWER_NOTIFY_TRANSPORT=none (test double, no network)';
  } else if (!token || !chatId) {
    detail = `not sent — missing ${!token ? 'TELEGRAM_BOT_TOKEN' : ''}${!token && !chatId ? ' and ' : ''}${!chatId ? 'AUTHORISED_TELEGRAM_USER_ID' : ''}`;
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
      let resp;
      try {
        resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const bodyText = await resp.text();
      let body = null;
      try { body = JSON.parse(bodyText); } catch { /* keep raw */ }
      if (resp.ok && body?.ok) {
        telegramOk = true;
        telegramMessageId = body.result?.message_id ?? null;
        detail = `sent via bot ${maskToken(token)} → message_id ${telegramMessageId}`;
      } else {
        // Never echo the token in an error path.
        detail = `telegram API rejected (http ${resp.status}): ${String(body?.description ?? bodyText).slice(0, 200)}`;
      }
    } catch (e) {
      detail = `telegram send failed: ${String(e?.message ?? e).slice(0, 200)}`;
    }
  }

  // Record the REAL delivery result onto the row we already claimed.
  await pool.query(
    `update tower.notification set telegram_ok = $2, telegram_message_id = $3 where id = $1`,
    [notificationId, telegramOk, telegramMessageId],
  );

  return { notificationId, deduped: false, telegram_ok: telegramOk, telegram_message_id: telegramMessageId, detail };
}

/** Compose the human-facing Watcher message body. Identifies turn/build, state, Codex verdict, action. */
export function composeMessage({ buildRef, turnSeq, turnId, state, verdict, summary, nextAction, warwickNeeded }) {
  const lines = [
    `🗼 Tower ${buildRef ?? 'BUILD-014'} — turn #${turnSeq ?? '?'}`,
    `state: ${state}`,
    verdict ? `supervisor verdict: ${verdict}` : null,
    summary ? `— ${summary}` : null,
    nextAction ? `next: ${nextAction}` : null,
    warwickNeeded ? '⚠️ Warwick needs to act.' : null,
    `turn: ${turnId}`,
  ].filter(Boolean);
  return lines.join('\n');
}
