// BUILD-002 WP4 — file a decision_response from a live Telegram inbound update (the inbound wiring).
//
// This is the code that turns an actual Telegram update (a button tap = callback_query, or a typed
// reply) into a durable, CORRELATED decision_response intent — closing the outbound-card → inbound-reply
// half of the loop. It runs mapInboundDecision (which reads the card_id straight out of the button's
// callback_data, or correlates a reply via the card_ref map), then inserts the intent as cp_directus.
// Idempotent on the update (a re-delivered Telegram update never double-files). The live gateway calls
// this from its long-poll handler once HUB_YOUTUBE_ROUTE-style cut-over is enabled (Warwick-gated); the
// mapping + filing + correlation are exercised here.
import { mapInboundDecision } from '../../hub/decision/telegramInbound.mjs';

// cockpitClient: a pg client connected as cp_directus (INSERT-intent-only). update: a Telegram update.
// opts.keyPrefix: optional prefix for the idempotency key (tests scope their own). opts.resolveCardByMessage:
// reverse lookup for typed replies. Returns { filed, card_id, responder, raw_text, idempotency_key } | { filed:false, reason }.
export async function fileInboundDecision(cockpitClient, update, opts = {}) {
  // DEFAULT-DENY sender boundary (Codex round-4 hazard): if an authorizedUserId is supplied, the reply
  // MUST come from that user — otherwise fail closed. The live gateway passes its authorised Telegram
  // user id here, reusing the same boundary the capture path enforces; an anonymous/foreign tap files nothing.
  if (opts.authorizedUserId !== undefined && opts.authorizedUserId !== null) {
    const fromId = update?.callback_query?.from?.id ?? update?.message?.from?.id;
    if (String(fromId) !== String(opts.authorizedUserId)) return { filed: false, reason: 'unauthorized_sender' };
  }
  // A TYPED reply correlates to its card via the durable sent-message map — an ASYNC DB lookup. Resolve
  // it up front, then hand mapInboundDecision a sync closure over the fetched card id. Button taps
  // self-correlate via callback_data and need no lookup.
  let preResolved = null;
  const msg = update && update.message;
  if (msg && msg.reply_to_message && typeof opts.resolveCardByMessage === 'function') {
    preResolved = await opts.resolveCardByMessage(msg.chat && msg.chat.id, msg.reply_to_message.message_id);
  }
  const mapped = mapInboundDecision(update, { resolveCardByMessage: () => preResolved });
  if (!mapped.ok) return { filed: false, reason: mapped.reason };

  // Idempotency key derived from the update itself so a re-delivered tap/reply never double-files.
  const base = update?.callback_query?.id ? `tgcb:${update.callback_query.id}`
    : update?.message?.message_id ? `tgmsg:${update.message.message_id}`
    : `tg:${mapped.card_id}:${mapped.raw_text}`;
  const idempotency_key = `${opts.keyPrefix ?? ''}${base}`;

  const r = await cockpitClient.query(
    `insert into cockpit.decision_response (card_id, responder, raw_text, idempotency_key)
     values ($1,$2,$3,$4) on conflict (idempotency_key) do nothing returning id`,
    [mapped.card_id, mapped.responder, mapped.raw_text, idempotency_key]);
  return { filed: r.rowCount > 0, card_id: mapped.card_id, responder: mapped.responder, raw_text: mapped.raw_text, idempotency_key };
}
