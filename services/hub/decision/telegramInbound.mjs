// BUILD-002 WP4 — map a Telegram inbound reply/callback onto a decision_response intent (pure).
//
// The real inbound half of the human-tap gate. When a decision_card is sent live, its inline buttons
// carry callback_data `decision:<card_id>:<choiceKey>`; a tapped button arrives as a callback_query.
// A typed reply to the card message arrives as a message with reply_to_message. This maps either onto
// the {card_id, responder, raw_text} an inbound handler files into cockpit.decision_response (which the
// worker then parses against the card's options — this mapper never decides the outcome, only routes
// the reply to the right card). Pure + deterministic; wiring it into liveRunner.handleCallback is the
// Warwick-present cut-over (it needs the live gateway restart), but the mapping is built + tested here.
export const DECISION_CALLBACK_PREFIX = 'decision:';

// Build the callback_data a live decision card button carries. Kept here so the outbound card and the
// inbound parser agree on the exact wire format.
export function decisionCallbackData(cardId, choiceKey) {
  return `${DECISION_CALLBACK_PREFIX}${cardId}:${choiceKey}`;
}

// update: a Telegram update object. resolveCardByMessage?(chatId,messageId)->cardId|null lets a typed
// reply correlate to the card it answers (the live handler passes a card_ref reverse lookup).
export function mapInboundDecision(update, { resolveCardByMessage } = {}) {
  // 1) Inline-button tap: callback_query with our decision: data.
  const cq = update && update.callback_query;
  if (cq && typeof cq.data === 'string' && cq.data.startsWith(DECISION_CALLBACK_PREFIX)) {
    const rest = cq.data.slice(DECISION_CALLBACK_PREFIX.length);
    const idx = rest.indexOf(':');
    if (idx <= 0) return { ok: false, reason: 'malformed decision callback_data' };
    const cardId = rest.slice(0, idx);
    const choiceKey = rest.slice(idx + 1);
    if (!cardId || !choiceKey) return { ok: false, reason: 'malformed decision callback_data' };
    const responder = cq.from && cq.from.id !== undefined ? `telegram:${cq.from.id}` : 'telegram:unknown';
    return { ok: true, kind: 'callback', card_id: cardId, responder, raw_text: choiceKey };
  }
  // 2) Typed reply to the card message: correlate via reply_to_message + the card_ref reverse lookup.
  const msg = update && update.message;
  if (msg && typeof msg.text === 'string' && msg.reply_to_message && typeof resolveCardByMessage === 'function') {
    const chatId = msg.chat && msg.chat.id;
    const repliedMsgId = msg.reply_to_message.message_id;
    const cardId = resolveCardByMessage(chatId, repliedMsgId);
    if (!cardId) return { ok: false, reason: 'reply not correlated to a known card' };
    const responder = msg.from && msg.from.id !== undefined ? `telegram:${msg.from.id}` : 'telegram:unknown';
    return { ok: true, kind: 'reply', card_id: cardId, responder, raw_text: msg.text };
  }
  return { ok: false, reason: 'not a decision reply' };
}
