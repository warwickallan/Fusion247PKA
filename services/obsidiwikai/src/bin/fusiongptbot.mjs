// The ChatGPT->Honcho outbox FRONT DOOR: a dedicated Telegram bot (fusiongptbot).
// You paste/forward a compact packet from ChatGPT; it enqueues to the Context Outbox; the
// outbox-worker delivers it to Honcho. Separate bot/token from the main capture gateway, so
// there is NO poller conflict. Needs FUSIONGPTBOT_TOKEN (drop the creds in .fusion247 and run).
import { assertConfig } from '../config.mjs';
import { enqueuePacket, effectiveSensitivity, validatePacket } from '../core/contextOutbox.mjs';

const TOKEN = process.env.FUSIONGPTBOT_TOKEN || process.env.FUSIONGPT_BOT_TOKEN;
const AUTH = String(process.env.FUSIONGPTBOT_AUTHORISED_USER_ID || process.env.AUTHORISED_TELEGRAM_USER_ID || '');
if (!TOKEN) {
  console.error('FUSIONGPTBOT_TOKEN not set. Add the fusiongptbot token (e.g. C:\\.fusion247\\fusiongptbot.env) and run with --env-file.');
  process.exit(2);
}
assertConfig();

const API = `https://api.telegram.org/bot${TOKEN}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tg(method, body) {
  const r = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

// A message is either a JSON packet (from ChatGPT following the contract) or freeform text
// (a note Warwick forwarded), which becomes a compact session_conclusion.
function toPacket(text) {
  const t = text.trim();
  if (t.startsWith('{')) {
    try { const j = JSON.parse(t); if (validatePacket(j).ok) return j; } catch { /* not json */ }
  }
  return { type: 'session_conclusion', summary: t.slice(0, 600), source_pointer: 'telegram:fusiongptbot' };
}

let offset = 0;
console.log('fusiongptbot outbox listener started (single getUpdates consumer — no poller conflict)');
for (;;) {
  let upd;
  try { upd = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }); }
  catch { await sleep(3000); continue; }
  for (const u of upd.result || []) {
    offset = u.update_id + 1;
    const m = u.message;
    if (!m || !m.text) continue;
    if (AUTH && String(m.from?.id) !== AUTH) { await tg('sendMessage', { chat_id: m.chat.id, text: 'Unauthorised.' }); continue; }
    try {
      const p = toPacket(m.text);
      const id = await enqueuePacket(p);
      const sens = effectiveSensitivity(p);
      const note = !id ? 'already captured (duplicate).'
        : sens === 'restricted' ? 'received — held for your review (looks sensitive).'
          : 'received — queued for Honcho.';
      await tg('sendMessage', { chat_id: m.chat.id, text: `🧠 ${note}` });
    } catch (e) {
      await tg('sendMessage', { chat_id: m.chat.id, text: 'Could not capture: ' + String(e.message).slice(0, 120) });
    }
  }
}
