// =====================================================================
// BUILD-015 AsdAIr Stage 1 - probe-pending-updates.mjs
//
// "IS THE LIST STILL WAITING?" - ANSWERED WITHOUT CONSUMING IT.
//
//   node --env-file=<env> probe-pending-updates.mjs
//
// ── WHY THIS IS SAFE, PRECISELY ─────────────────────────────────────────────
// Telegram's getUpdates confirms - and permanently DELETES - every update whose
// id is BELOW the `offset` argument. Passing no offset at all confirms nothing.
// That is the entire trick: this probe calls getUpdates with NO offset, so the
// queue is read and left exactly as it was found. It also:
//
//   * writes NO state file, so the receiver's durable offset is untouched;
//   * downloads NO media, so nothing is fetched or stored;
//   * creates NO shop, so the pipeline is not started by a look.
//
// Run it twice and you get the same answer twice. That is the test of a
// non-destructive read, and the proof harness relies on it.
//
// ── WHAT IT PRINTS, AND WHAT IT REFUSES TO PRINT ────────────────────────────
// Update ids, message kinds, arrival dates and a masked sender id ONLY. It
// never prints message text, never prints a photo path or file id, and never
// prints the bot token - the token is loaded and used by the intake module's
// own code and never touched by this file. This output is designed to be
// pasteable into a status note, and the household's shopping list is not
// status metadata.
//
// LIMIT OF THE ANSWER: this reports what THE BOT still holds. If a message were
// consumed by some other process at some earlier time, it would simply not be
// here - so "0 pending" is not by itself proof that nothing was ever received.
// Read it together with the offset file, which asdair-status.mjs reports.
// =====================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { intakeStateFile } from './runtime-paths.mjs';
import { readOffset } from './asdair-status.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function kindOf(update) {
  const m = update.message || update.edited_message || null;
  if (update.callback_query) return 'button tap';
  if (!m) return 'other';
  if (Array.isArray(m.photo) && m.photo.length > 0) return 'photo';
  if (m.document) return 'document';
  if (m.voice) return 'voice';
  if (typeof m.text === 'string') return 'text';
  return 'other';
}

function maskId(id) {
  const s = String(id ?? '');
  return s.length <= 4 ? '***' : `***${s.slice(-4)}`;
}

const intake = await import(new URL(`file:///${path.join(HERE, '..', 'intake', 'shopperIntake.js').replace(/\\/g, '/')}`).href);

const config = intake.loadIntakeConfig();
const telegram = intake.createShopperTelegramClient({ botToken: config.botToken, apiBase: config.apiBase });

// NO OFFSET. This is the whole safety property - do not "improve" this call.
const updates = await telegram.getUpdates({ timeout: 0, limit: 100 });

const offset = readOffset(intakeStateFile());

console.log(JSON.stringify({
  probed_at: new Date().toISOString(),
  consuming: false,
  method: 'getUpdates with NO offset - Telegram confirms nothing, so the queue is left exactly as found',
  pending_count: updates.length,
  pending: updates.map((u) => ({
    update_id: u.update_id,
    kind: kindOf(u),
    from: maskId((u.message || u.callback_query || {}).from?.id),
    date: (u.message && u.message.date) ? new Date(u.message.date * 1000).toISOString() : null,
  })),
  receiver_offset: offset,
  verdict: updates.length === 0
    ? 'the bot holds nothing right now'
    : `${updates.length} update(s) are STILL WAITING on the bot and have not been consumed`,
}, null, 1));
